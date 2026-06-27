// OCR 結果（元画像座標の行群）を「2列×3行＝6カード」へ割り当て、
// 各カード内のローカル座標に変換した CardOcr[6] を返す。
//
// 旧ハーネスは画像を固定比率でクロップしてからOCRしていたため、カード境界で
// 文字が切れて隣カードへ流出し、名前行が消える等の事故が多発した。
// ここでは「全体を1回OCRした結果」を、各行の中心座標が属するセルへ振り分ける。
// 行は分割されず必ず1カードに入るため、はみ出しが起きない。
//
// スロット順は行優先（左上=0, 右上=1, 左中=2, 右中=3, 左下=4, 右下=5）。
// ゲーム画面のカード番号 1..6 の並びと一致する。

import type { OcrResult } from '../ocr/types';
import type { CardOcr } from './parseTeam';

export interface GridLayout {
  headerRatio?: number; // 上部ヘッダー帯（スロット名/チームID等）の高さ比率。既定 0.13
  cols?: number;        // 既定 2
  rows?: number;        // 既定 3
}

export function assignToCards(ocr: OcrResult, layout: GridLayout = {}): CardOcr[] {
  const cols = layout.cols ?? 2;
  const rows = layout.rows ?? 3;
  const headerRatio = layout.headerRatio ?? 0.13;

  // 参照フレーム: width/height があればそれを、無ければ行の最大 extent で近似。
  let W = ocr.width;
  let H = ocr.height;
  if (!W || !H) {
    W = Math.max(1, ...ocr.lines.map(l => l.bbox.x + l.bbox.w));
    H = Math.max(1, ...ocr.lines.map(l => l.bbox.y + l.bbox.h));
  }

  const gridTop = H * headerRatio;
  const gridH = Math.max(1, H - gridTop);
  const cellW = W / cols;
  const cellH = gridH / rows;

  const cards: CardOcr[] = Array.from({ length: cols * rows }, () => ({ lines: [] }));

  for (const line of ocr.lines) {
    const cx = line.bbox.x + line.bbox.w / 2;
    const cy = line.bbox.y + line.bbox.h / 2;
    if (cy < gridTop) continue; // ヘッダー帯は無視

    let col = Math.floor(cx / cellW);
    col = Math.min(cols - 1, Math.max(0, col));
    let row = Math.floor((cy - gridTop) / cellH);
    row = Math.min(rows - 1, Math.max(0, row));

    const idx = row * cols + col; // 行優先
    const originX = col * cellW;
    const originY = gridTop + row * cellH;

    cards[idx].lines.push({
      text: line.text,
      x: line.bbox.x - originX, // カード内ローカル座標へ
      y: line.bbox.y - originY,
      w: line.bbox.w,
      h: line.bbox.h,
    });
  }

  return cards;
}
