// parse_test.mts
// tesseract.js + sharp でスクリーンショット2枚をOCR → parseTeam を呼んで精度評価
// 実行: (app/_ocr_poc ディレクトリで) npx tsx parse_test.mts

import { createWorker } from 'tesseract.js';
import sharp from 'sharp';
import path from 'path';
import { existsSync, mkdirSync } from 'fs';

// ── アプリソースからインポート（tsx が .js → .ts を解決）────────────────────────
import { loadData } from '../src/data.js';
import { parseTeam } from '../src/engine/import/parseTeam.js';
import type { CardOcr, CardLine } from '../src/engine/import/parseTeam.js';
import { displayPokemonName, moveJa, ABILITY_JA, NATURE_JA } from '../src/i18n.js';
import { resolveItem } from '../src/engine/competitive.js';
import type { PokemonBuild } from '../src/types.js';

// ── パス定義 ───────────────────────────────────────────────────────────────────

const SCREENSHOTS = {
  ability: 'C:\\Users\\Owner\\Documents\\My Data Sources\\Pokemon\\screenshot\\HGZkMQ-agAATFVY.jpg',
  status:  'C:\\Users\\Owner\\Documents\\My Data Sources\\Pokemon\\screenshot\\HGZkMQ_acAAVggw.jpg',
};

const LANG_PATH = 'C:\\Users\\Owner\\Documents\\My Data Sources\\Pokemon\\app\\_ocr_poc';

const TMP_DIR = path.join(LANG_PATH, 'tmp');
if (!existsSync(TMP_DIR)) mkdirSync(TMP_DIR, { recursive: true });

// ── OCR 前処理パラメータ ───────────────────────────────────────────────────────
const THRESHOLD    = 160;  // グレースケール二値化閾値
const HEADER_RATIO = 0.13; // 上 13% をヘッダーとして除外

// ── word レベル bbox ───────────────────────────────────────────────────────────
interface WordBbox {
  text: string;
  x0: number; y0: number;
  x1: number; y1: number;
}

/**
 * words のリストを y 座標の近さでグループ化し、各グループを x 昇順で連結した
 * CardLine[] を返す。
 * yGap: 同一行とみなす y0 の最大差（3x スケール換算）。
 */
function buildLinesFromWords(words: WordBbox[], yGap: number): CardLine[] {
  if (words.length === 0) return [];
  const sorted = [...words].sort((a, b) => a.y0 !== b.y0 ? a.y0 - b.y0 : a.x0 - b.x0);
  const groups: WordBbox[][] = [];
  for (const w of sorted) {
    const last = groups[groups.length - 1];
    const groupTopY = last ? Math.min(...last.map(lw => lw.y0)) : Infinity;
    if (last && w.y0 - groupTopY < yGap) {
      last.push(w);
    } else {
      groups.push([w]);
    }
  }
  return groups
    .map(group => {
      const byX = [...group].sort((a, b) => a.x0 - b.x0);
      return {
        text: byX.map(w => w.text).join(' '),
        x: Math.min(...group.map(w => w.x0)),
        y: Math.min(...group.map(w => w.y0)),
        w: Math.max(...group.map(w => w.x1)) - Math.min(...group.map(w => w.x0)),
        h: Math.max(...group.map(w => w.y1)) - Math.min(...group.map(w => w.y0)),
      };
    })
    .filter(l => l.text.trim().length > 0);
}

// ── カードクロップ＋OCR ────────────────────────────────────────────────────────

/**
 * 画像を 6 枚のカードにクロップし、各カードを OCR して CardOcr[] を返す。
 * カード順: 行優先（左上=0, 右上=1, ..., 右下=5）。
 *
 * テキストを word レベルで取得し、x 座標でカラム分けした後、
 * y グループ化して CardLine を構築する。
 * これにより左列（名前/特性/持ち物）と右列（技）が同じ y 位置でも分離できる。
 */
async function cropAndOcrCards(
  srcPath: string,
  label: string,
  worker: any, // tesseract.js の Worker 型
  threshold: number = THRESHOLD,
): Promise<CardOcr[]> {
  const meta = await sharp(srcPath).metadata();
  const W = meta.width!;
  const H = meta.height!;

  const headerH = Math.round(H * HEADER_RATIO);
  const bodyH   = H - headerH;
  const cardW   = Math.floor(W / 2);
  const cardH   = Math.floor(bodyH / 3);

  const cards: CardOcr[] = [];

  for (let row = 0; row < 3; row++) {
    for (let col = 0; col < 2; col++) {
      const left   = col * cardW;
      const top    = headerH + row * cardH;
      const width  = col === 1 ? W - left : cardW;
      const height = row === 2 ? H - top  : cardH;
      const scaledW = width * 3;

      // カードを切り出し → グレースケール 3倍拡大 → normalize → threshold
      const buf = await sharp(srcPath)
        .extract({ left, top, width, height })
        .grayscale()
        .resize({ width: scaledW, height: height * 3, kernel: 'lanczos3' })
        .normalize()
        .threshold(threshold)
        .png()
        .toBuffer();

      // PSM 6 で OCR。blocks: true で word ツリーも取得
      await worker.setParameters({ tessedit_pageseg_mode: '6' });
      const result = await worker.recognize(buf, {}, { blocks: true });

      // blocks → paragraphs → lines → words の順に word bbox を収集
      const allWords: WordBbox[] = [];
      for (const block of (result.data.blocks ?? [])) {
        for (const para of (block.paragraphs ?? [])) {
          for (const line of (para.lines ?? [])) {
            for (const word of (line.words ?? [])) {
              const text: string = (word.text ?? '').trim();
              if (!text) continue;
              allWords.push({
                text,
                x0: word.bbox.x0, y0: word.bbox.y0,
                x1: word.bbox.x1, y1: word.bbox.y1,
              });
            }
          }
        }
      }

      // カード幅の 45% でカラム分け（左列 = 名前/特性/持ち物 or HP/ATK/DEF）
      const colThreshold = scaledW * 0.45;
      const leftWords  = allWords.filter(w => w.x0 <  colThreshold);
      const rightWords = allWords.filter(w => w.x0 >= colThreshold);

      // y 近接グループ化（行間 ~100-160px、グループ内差 ≤50px）
      const Y_GAP = 50;
      const lines: CardLine[] = [
        ...buildLinesFromWords(leftWords,  Y_GAP),
        ...buildLinesFromWords(rightWords, Y_GAP),
      ];

      cards.push({ lines });
      const lc = buildLinesFromWords(leftWords, Y_GAP).length;
      const rc = buildLinesFromWords(rightWords, Y_GAP).length;
      process.stderr.write(
        `  [${label}] カード[${row},${col}] 左${lc}行 右${rc}行\n`,
      );
    }
  }

  return cards;
}

// ── 正解データ（日本語名でハードコード） ──────────────────────────────────────

interface StatEntry { v: number; sp: number }
interface GroundTruth {
  jaName:  string;
  ability: string;  // 日本語特性名
  item:    string;  // 日本語道具名（メガは「◯◯ナイト(メガ)」形式）
  isMega:  boolean;
  moves:   string[]; // 日本語技名（最大4）
  stats: {
    hp: StatEntry; atk: StatEntry; def: StatEntry;
    spa: StatEntry; spd: StatEntry; spe: StatEntry;
  };
}

const GROUND_TRUTH: GroundTruth[] = [
  {
    jaName: 'フラエッテ', ability: 'フラワーベール',
    item: 'フラエッテナイト(メガ)', isMega: true,
    moves: ['マジカルシャイン', 'はめつのひかり', 'めいそう', 'まもる'],
    stats: { hp:{v:163,sp:14}, atk:{v:76,sp:0}, def:{v:87,sp:0},
             spa:{v:181,sp:20}, spd:{v:148,sp:0}, spe:{v:144,sp:32} },
  },
  {
    jaName: 'ガブリアス', ability: 'さめはだ',
    item: 'ひかりのこな', isMega: false,
    moves: ['スケイルショット', 'じしん', 'いわなだれ', 'まもる'],
    stats: { hp:{v:202,sp:19}, atk:{v:187,sp:20}, def:{v:116,sp:1},
             spa:{v:90,sp:0}, spd:{v:106,sp:1}, spe:{v:147,sp:25} },
  },
  {
    jaName: 'イダイトウ', ability: 'てきおうりょく',
    item: 'カシブのみ', isMega: false,
    moves: ['ウェーブタックル', 'おはかまいり', 'アクアジェット', 'まもる'],
    stats: { hp:{v:215,sp:20}, atk:{v:180,sp:32}, def:{v:93,sp:8},
             spa:{v:90,sp:0}, spd:{v:96,sp:1}, spe:{v:103,sp:5} },
  },
  {
    jaName: 'ドドゲザン', ability: 'まけんき',
    item: 'ヨプのみ', isMega: false,
    moves: ['ドゲザン', 'ふいうち', 'けたぐり', 'まもる'],
    stats: { hp:{v:207,sp:32}, atk:{v:198,sp:25}, def:{v:142,sp:2},
             spa:{v:72,sp:0}, spd:{v:106,sp:1}, spe:{v:76,sp:6} },
  },
  {
    jaName: 'カイリュー', ability: 'せいしんりょく',
    item: 'カイリュナイト(メガ)', isMega: true,
    moves: ['りゅうせいぐん', 'エアスラッシュ', '10まんボルト', 'まもる'],
    stats: { hp:{v:183,sp:17}, atk:{v:138,sp:0}, def:{v:115,sp:0},
             spa:{v:159,sp:25}, spd:{v:120,sp:0}, spe:{v:124,sp:24} },
  },
  {
    jaName: 'オオニューラ', ability: 'かるわざ',
    item: 'しろいハーブ', isMega: false,
    moves: ['フェイタルクロー', 'インファイト', 'コーチング', 'まもる'],
    stats: { hp:{v:156,sp:10}, atk:{v:200,sp:32}, def:{v:81,sp:1},
             spa:{v:54,sp:0}, spd:{v:100,sp:0}, spe:{v:172,sp:32} },
  },
];

// ── 表示ヘルパー ───────────────────────────────────────────────────────────────

/** PokemonBuild のメガ考慮アイテム日本語ラベル */
function buildItemLabel(b: PokemonBuild): string {
  if (b.isMega) {
    const base = b.megaFormName.replace(/^Mega\s+/i, '').replace(/\s+[XY]$/i, '');
    const jaBase = displayPokemonName(base);
    const stoneName = jaBase.replace(/ー$/, '') + 'ナイト';
    return `${stoneName}(メガ)`;
  }
  if (!b.item) return 'なし';
  return resolveItem(b.item).label;
}

// ── diff 出力 ─────────────────────────────────────────────────────────────────

const STAT_ORDER: (keyof GroundTruth['stats'])[] = ['hp','atk','def','spa','spd','spe'];
const STAT_JA_MAP: Record<string, string> = {
  hp:'HP', atk:'こうげき', def:'ぼうぎょ', spa:'とくこう', spd:'とくぼう', spe:'すばやさ',
};

function mark(ok: boolean): string { return ok ? '◯' : '✕'; }
function pct(ok: number, total: number): string {
  return total === 0 ? 'N/A' : `${ok}/${total} (${(ok/total*100).toFixed(0)}%)`;
}

function printDiff(builds: PokemonBuild[]): void {
  const cnt = {
    name:    {ok:0, tot:0},
    ability: {ok:0, tot:0},
    item:    {ok:0, tot:0},
    moves:   {ok:0, tot:0},
    sp:      {ok:0, tot:0},
  };

  for (let i = 0; i < GROUND_TRUTH.length; i++) {
    const gt = GROUND_TRUTH[i];
    const b  = builds[i];

    console.log(`\n${'═'.repeat(62)}`);
    console.log(`スロット ${i + 1}`);
    console.log('═'.repeat(62));

    if (!b) { console.log('  [結果なし]'); continue; }

    // 種族名
    const jaName = displayPokemonName(b.rosterName);
    const nameOk = jaName === gt.jaName;
    cnt.name.ok += nameOk ? 1 : 0; cnt.name.tot++;
    console.log(`  種族:    ${mark(nameOk)} ${jaName}${nameOk ? '' : `  ← 正解: ${gt.jaName}`}`);

    // 特性
    const jaAbility = ABILITY_JA[b.ability] ?? b.ability;
    const abilOk = jaAbility === gt.ability;
    cnt.ability.ok += abilOk ? 1 : 0; cnt.ability.tot++;
    console.log(`  特性:    ${mark(abilOk)} ${jaAbility}${abilOk ? '' : `  ← 正解: ${gt.ability}`}`);

    // 持ち物
    const itemLabel = buildItemLabel(b);
    const itemOk    = itemLabel === gt.item;
    cnt.item.ok += itemOk ? 1 : 0; cnt.item.tot++;
    console.log(`  持ち物:  ${mark(itemOk)} ${itemLabel}${itemOk ? '' : `  ← 正解: ${gt.item}`}`);

    // 技（最大4）
    for (let mi = 0; mi < 4; mi++) {
      const parsed = b.moves[mi] ? moveJa(b.moves[mi]) : '―';
      const expect = gt.moves[mi] ?? '―';
      const moveOk = parsed === expect;
      cnt.moves.ok += moveOk ? 1 : 0; cnt.moves.tot++;
      console.log(`  技${mi + 1}:    ${mark(moveOk)} ${parsed}${moveOk ? '' : `  ← 正解: ${expect}`}`);
    }

    // SP 振り（6ステータス）
    for (const key of STAT_ORDER) {
      const gtStat   = gt.stats[key];
      const parsedSp = b.sp[key as keyof typeof b.sp];
      const spOk     = parsedSp === gtStat.sp;
      cnt.sp.ok += spOk ? 1 : 0; cnt.sp.tot++;
      const flag = spOk ? '' : `  ← 正解SP: ${gtStat.sp}`;
      console.log(
        `  ${STAT_JA_MAP[key].padEnd(5)}: ${mark(spOk)} SP=${parsedSp}  実数値正解=${gtStat.v}${flag}`,
      );
    }

    // 性格（参考値）
    console.log(`  性格:    ${NATURE_JA[b.nature] ?? b.nature}  (推定)`);
  }

  // ── サマリ ────────────────────────────────────────────────────────────────
  console.log(`\n${'═'.repeat(62)}`);
  console.log('項目別一致率');
  console.log('═'.repeat(62));
  console.log(`  種族          ${pct(cnt.name.ok,    cnt.name.tot)}`);
  console.log(`  特性          ${pct(cnt.ability.ok, cnt.ability.tot)}`);
  console.log(`  持ち物        ${pct(cnt.item.ok,    cnt.item.tot)}`);
  console.log(`  技 (6体×4)    ${pct(cnt.moves.ok,   cnt.moves.tot)}`);
  console.log(`  SP振り (6体×6) ${pct(cnt.sp.ok,     cnt.sp.tot)}`);

  const grandOk  = cnt.name.ok + cnt.ability.ok + cnt.item.ok + cnt.moves.ok + cnt.sp.ok;
  const grandTot = cnt.name.tot + cnt.ability.tot + cnt.item.tot + cnt.moves.tot + cnt.sp.tot;
  console.log(`  総合          ${pct(grandOk, grandTot)}`);
}

// ── メイン ─────────────────────────────────────────────────────────────────────

async function main(): Promise<void> {
  process.stderr.write('ChampionsData ロード中 (GitHub fetch)...\n');
  const data = await loadData();
  process.stderr.write(`  roster: ${data.roster.length}体  moves: ${data.moves.length}技\n`);

  process.stderr.write('\nTesseract ワーカー起動中 (jpn)...\n');
  const worker = await createWorker('jpn', 1, {
    langPath: LANG_PATH,
    gzip: false, // _ocr_poc には非圧縮 jpn.traineddata がある
    logger: (m: { status: string; progress: number }) => {
      if (m.status === 'recognizing text') {
        process.stderr.write(`\r  [OCR] ${(m.progress * 100).toFixed(0)}%   `);
      }
    },
  });

  process.stderr.write('\n\n── 能力タブ OCR ─────────────────────────\n');
  const abilityCards = await cropAndOcrCards(SCREENSHOTS.ability, '能力', worker);

  process.stderr.write('\n── ステータスタブ OCR ───────────────────\n');
  const statusCards = await cropAndOcrCards(SCREENSHOTS.status, 'ステータス', worker);

  await worker.terminate();
  process.stderr.write('\nOCR 完了\n');

  // ── デバッグ: OCR 生テキスト確認 ──────────────────────────────────────────
  console.log('\n=== 能力タブ OCR 生テキスト ===');
  abilityCards.forEach((card, i) => {
    console.log(`\n[カード ${i + 1}]`);
    card.lines.forEach(l =>
      console.log(`  x=${String(l.x).padStart(5)} y=${String(l.y).padStart(5)}  "${l.text}"`),
    );
  });

  console.log('\n=== ステータスタブ OCR 生テキスト ===');
  statusCards.forEach((card, i) => {
    console.log(`\n[カード ${i + 1}]`);
    card.lines.forEach(l =>
      console.log(`  x=${String(l.x).padStart(5)} y=${String(l.y).padStart(5)}  "${l.text}"`),
    );
  });

  // ── parseTeam 実行 ────────────────────────────────────────────────────────
  process.stderr.write('\nparseTeam 実行中...\n');
  const builds = parseTeam(abilityCards, statusCards, data);

  // ── 正解との diff 表示 ────────────────────────────────────────────────────
  console.log('\n\n╔══════════════════════════════════════════════════════════════╗');
  console.log('║               パーサ精度評価レポート                             ║');
  console.log('╚══════════════════════════════════════════════════════════════╝');
  printDiff(builds);
}

main().catch(e => { console.error(e); process.exit(1); });
