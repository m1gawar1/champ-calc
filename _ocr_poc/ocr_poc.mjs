// OCR PoC — Tesseract.js 日本語精度検証
// 対象: ポケモンチーム概要スクリーンショット2枚

import { createWorker } from 'tesseract.js';
import path from 'path';

const SCREENSHOTS = {
  ability: 'C:\\Users\\Owner\\Documents\\My Data Sources\\Pokemon\\screenshot\\HGZkMQ-agAATFVY.jpg',
  status:  'C:\\Users\\Owner\\Documents\\My Data Sources\\Pokemon\\screenshot\\HGZkMQ_acAAVggw.jpg',
};

async function recognizeFile(worker, filePath, label) {
  process.stdout.write(`\n${'='.repeat(60)}\n`);
  process.stdout.write(`【${label}】全文OCR: ${path.basename(filePath)}\n`);
  process.stdout.write('='.repeat(60) + '\n');

  const result = await worker.recognize(filePath);
  const text = result.data.text;
  process.stdout.write(text + '\n');

  return text;
}

async function main() {
  const worker = await createWorker('jpn', 1, {
    logger: m => {
      if (m.status === 'recognizing text') {
        process.stderr.write(`\r[${m.jobId?.slice(0,6)}] 進捗: ${(m.progress * 100).toFixed(1)}%  `);
      }
    },
  });

  // 画像1: 能力タブ
  await recognizeFile(worker, SCREENSHOTS.ability, '能力タブ');

  // 画像2: ステータスタブ
  await recognizeFile(worker, SCREENSHOTS.status, 'ステータスタブ');

  await worker.terminate();
  process.stderr.write('\n完了\n');
}

main().catch(e => { console.error(e); process.exit(1); });
