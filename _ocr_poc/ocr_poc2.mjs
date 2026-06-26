// OCR PoC v2 — 前処理 + カードクロップ
// sharp による画像前処理 + Tesseract.js 日本語OCR 精度検証

import { createWorker } from 'tesseract.js';
import sharp from 'sharp';
import path from 'path';
import fs from 'fs/promises';
import { existsSync, mkdirSync } from 'fs';

const SCREENSHOTS = {
  ability: 'C:\\Users\\Owner\\Documents\\My Data Sources\\Pokemon\\screenshot\\HGZkMQ-agAATFVY.jpg',
  status:  'C:\\Users\\Owner\\Documents\\My Data Sources\\Pokemon\\screenshot\\HGZkMQ_acAAVggw.jpg',
};

const TMP_DIR = 'C:\\Users\\Owner\\Documents\\My Data Sources\\Pokemon\\app\\_ocr_poc\\tmp';
if (!existsSync(TMP_DIR)) mkdirSync(TMP_DIR, { recursive: true });

// threshold 値候補
const THRESHOLDS = [140, 160, 180];

// PSM モード候補（Tesseract page segmentation modes）
const PSM_MODES = [6, 4, 11];

// --------------------------------------------------
// 前処理: グレースケール → 3倍拡大 → normalize → threshold
// --------------------------------------------------
async function preprocess(srcPath, threshVal, suffix) {
  const outPath = path.join(TMP_DIR, `${suffix}_thr${threshVal}.png`);
  await sharp(srcPath)
    .grayscale()
    .resize({ width: null, height: null, factor: 3, kernel: 'lanczos3' })
    .normalize()
    .threshold(threshVal)
    .png()
    .toFile(outPath);
  return outPath;
}

// --------------------------------------------------
// カードクロップ: ヘッダー帯 (上15%) を除外、残りを 3行×2列 に分割
// --------------------------------------------------
async function cropCards(srcPath, threshVal, suffix) {
  const meta = await sharp(srcPath).metadata();
  const W = meta.width;
  const H = meta.height;

  // ヘッダー帯を除いた領域
  const headerH = Math.round(H * 0.15);
  const bodyH = H - headerH;

  // 各カードのサイズ（整数化）
  const cardW = Math.floor(W / 2);
  const cardH = Math.floor(bodyH / 3);

  const labels = ['左上', '右上', '左中', '右中', '左下', '右下'];
  const cards = [];

  for (let row = 0; row < 3; row++) {
    for (let col = 0; col < 2; col++) {
      const idx = row * 2 + col;
      const left = col * cardW;
      const top  = headerH + row * cardH;
      // 最後の行・列は端数を吸収
      const width  = (col === 1) ? W - left : cardW;
      const height = (row === 2) ? H - top  : cardH;

      const cardSuffix = `${suffix}_card${idx}_${labels[idx]}_thr${threshVal}`;
      const outPath = path.join(TMP_DIR, `${cardSuffix}.png`);

      await sharp(srcPath)
        .extract({ left, top, width, height })
        .grayscale()
        .resize({ width: width * 3, height: height * 3, kernel: 'lanczos3' })
        .normalize()
        .threshold(threshVal)
        .png()
        .toFile(outPath);

      cards.push({ label: labels[idx], path: outPath });
    }
  }
  return cards;
}

// --------------------------------------------------
// OCR ヘルパー: PSM を変えて試し、最長結果を返す
// --------------------------------------------------
async function ocrWithBestPsm(worker, imgPath, label) {
  let best = { text: '', psm: PSM_MODES[0] };
  for (const psm of PSM_MODES) {
    await worker.setParameters({ tessedit_pageseg_mode: String(psm) });
    const r = await worker.recognize(imgPath);
    const t = r.data.text.trim();
    if (t.length > best.text.length) {
      best = { text: t, psm };
    }
  }
  return best;
}

// --------------------------------------------------
// メイン
// --------------------------------------------------
async function main() {
  process.stderr.write('Tesseract ワーカー起動中...\n');
  const worker = await createWorker('jpn', 1, {
    langPath: 'C:\\Users\\Owner\\Documents\\My Data Sources\\Pokemon\\app\\_ocr_poc',
    logger: m => {
      if (m.status === 'recognizing text') {
        process.stderr.write(`\r  [OCR] ${(m.progress * 100).toFixed(0)}%   `);
      }
    },
  });

  for (const [key, srcPath] of Object.entries(SCREENSHOTS)) {
    const label = key === 'ability' ? '能力タブ' : 'ステータスタブ';
    console.log('\n' + '█'.repeat(70));
    console.log(`■ ${label}  (${path.basename(srcPath)})`);
    console.log('█'.repeat(70));

    // (A) 前処理済み全体画像 OCR — threshold ごと
    console.log('\n── (A) 前処理済み全体画像 OCR ──────────────────────────────────');
    let bestWhole = { text: '', thr: THRESHOLDS[0], psm: PSM_MODES[0] };
    for (const thr of THRESHOLDS) {
      process.stderr.write(`\n[前処理] threshold=${thr} ...\n`);
      const procPath = await preprocess(srcPath, thr, key);
      const result = await ocrWithBestPsm(worker, procPath, `${label} thr${thr}`);
      console.log(`\n  [threshold=${thr}, PSM=${result.psm}]`);
      console.log(result.text);
      if (result.text.length > bestWhole.text.length) {
        bestWhole = { text: result.text, thr, psm: result.psm };
      }
    }
    console.log(`\n→ 全体画像ベスト: threshold=${bestWhole.thr}, PSM=${bestWhole.psm} (文字数: ${bestWhole.text.length})`);

    // (B) カード個別 OCR — ベスト threshold を使用
    console.log('\n── (B) カード個別 OCR ───────────────────────────────────────────');
    // 3 threshold 全部試してカードごとに最良を選ぶ
    // まず全 threshold でクロップ
    const allCardsByThr = {};
    for (const thr of THRESHOLDS) {
      process.stderr.write(`\n[クロップ] threshold=${thr} ...\n`);
      allCardsByThr[thr] = await cropCards(srcPath, thr, key);
    }
    // カードごとに threshold 横断で最長結果を採用
    const numCards = allCardsByThr[THRESHOLDS[0]].length;
    for (let i = 0; i < numCards; i++) {
      let cardBest = { text: '', thr: THRESHOLDS[0], psm: PSM_MODES[0] };
      for (const thr of THRESHOLDS) {
        const cardInfo = allCardsByThr[thr][i];
        const result = await ocrWithBestPsm(worker, cardInfo.path, cardInfo.label);
        if (result.text.length > cardBest.text.length) {
          cardBest = { text: result.text, thr, psm: result.psm, label: cardInfo.label };
        }
      }
      console.log(`\n  ▼ カード[${cardBest.label}]  (threshold=${cardBest.thr}, PSM=${cardBest.psm})`);
      console.log(cardBest.text);
      console.log(`  --- (文字数: ${cardBest.text.length}) ---`);
    }
  }

  await worker.terminate();
  process.stderr.write('\n\n完了\n');
}

main().catch(e => { console.error(e); process.exit(1); });
