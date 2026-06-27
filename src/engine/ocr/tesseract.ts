// Tesseract.js ベースの OCR エンジン（開発・Web フォールバック用）。
// tesseract.js は動的 import して、ネイティブビルドに含めず初期ロードも汚さない。
// ブラウザ専用（DOM/Canvas 前提）。Node.js では使わない。

import type { OcrEngine, OcrInput, OcrLine, OcrResult } from './types';

// ── Tesseract.js の内部型（必要なフィールドのみ定義する） ────────────────────────

interface TesseractBbox {
  x0: number;
  y0: number;
  x1: number;
  y1: number;
}

interface TesseractWord {
  text: string;
  bbox: TesseractBbox;
}

interface TesseractLine {
  text: string;
  bbox: TesseractBbox;
  words: TesseractWord[];
}

interface TesseractParagraph {
  text: string;
  bbox: TesseractBbox;
  lines: TesseractLine[];
}

interface TesseractBlock {
  paragraphs: TesseractParagraph[];
}

interface TesseractPage {
  blocks: TesseractBlock[] | null;
}

/** tesseract.js recognize 関数のシグネチャ */
type RecognizeFn = (
  image: HTMLCanvasElement,
  langs?: string,
) => Promise<{ data: TesseractPage }>;

// ── 前処理ヘルパー ──────────────────────────────────────────────────────────────

/**
 * OcrInput を Canvas に描画して返す。
 * 2倍拡大＋グレースケール変換で OCR 精度を改善する。
 * 元画像サイズ（origW/origH）も返す（座標を戻すときに必要）。
 */
async function loadToCanvas(
  input: OcrInput,
): Promise<{ canvas: HTMLCanvasElement; origW: number; origH: number }> {
  const SCALE = 2;
  let objectUrl: string | null = null;

  try {
    let srcW: number;
    let srcH: number;
    let drawSource: CanvasImageSource;

    if (input instanceof HTMLCanvasElement) {
      srcW = input.width;
      srcH = input.height;
      drawSource = input;
    } else if (input instanceof HTMLImageElement) {
      srcW = input.naturalWidth || input.width;
      srcH = input.naturalHeight || input.height;
      drawSource = input;
    } else {
      // string / Blob / ArrayBuffer → Object URL 経由で HTMLImageElement として読み込む
      let url: string;
      if (typeof input === 'string') {
        url = input;
      } else if (input instanceof Blob) {
        objectUrl = URL.createObjectURL(input);
        url = objectUrl;
      } else {
        // ArrayBuffer → Blob に変換してから URL 化する
        const blob = new Blob([input]);
        objectUrl = URL.createObjectURL(blob);
        url = objectUrl;
      }

      const img = await new Promise<HTMLImageElement>((resolve, reject) => {
        const el = new Image();
        el.onload = () => resolve(el);
        el.onerror = reject;
        el.crossOrigin = 'anonymous';
        el.src = url;
      });
      srcW = img.naturalWidth;
      srcH = img.naturalHeight;
      drawSource = img;
    }

    // 2倍拡大して Canvas に描画する
    const canvas = document.createElement('canvas');
    canvas.width = srcW * SCALE;
    canvas.height = srcH * SCALE;
    const ctx = canvas.getContext('2d');
    if (!ctx) throw new Error('Canvas 2D コンテキストを取得できませんでした');
    ctx.drawImage(drawSource, 0, 0, canvas.width, canvas.height);

    // グレースケール変換（輝度を揃えて文字のコントラストを改善する）
    const imageData = ctx.getImageData(0, 0, canvas.width, canvas.height);
    const d = imageData.data;
    for (let i = 0; i < d.length; i += 4) {
      const gray = Math.round(0.299 * d[i] + 0.587 * d[i + 1] + 0.114 * d[i + 2]);
      d[i] = d[i + 1] = d[i + 2] = gray;
      // アルファは変更しない（d[i+3] はそのまま）
    }
    ctx.putImageData(imageData, 0, 0);

    return { canvas, origW: srcW, origH: srcH };
  } finally {
    // Object URL はここで必ず解放する
    if (objectUrl) URL.revokeObjectURL(objectUrl);
  }
}

// ── Tesseract 結果ツリーのフラット化ヘルパー ─────────────────────────────────────

/** blocks ツリーを word 単位でフラット化する */
function extractWords(page: TesseractPage): TesseractWord[] {
  if (!page.blocks) return [];
  const words: TesseractWord[] = [];
  for (const block of page.blocks) {
    for (const para of block.paragraphs) {
      for (const line of para.lines) {
        for (const word of line.words) {
          if (word.text.trim()) words.push(word);
        }
      }
    }
  }
  return words;
}

/** blocks ツリーを line 単位でフラット化する（word が取れない場合のフォールバック） */
function extractLines(page: TesseractPage): Array<{ text: string; bbox: TesseractBbox }> {
  if (!page.blocks) return [];
  const lines: Array<{ text: string; bbox: TesseractBbox }> = [];
  for (const block of page.blocks) {
    for (const para of block.paragraphs) {
      for (const line of para.lines) {
        if (line.text.trim()) lines.push(line);
      }
    }
  }
  return lines;
}

/** blocks ツリーを paragraph 単位でフラット化する（line も空の場合の最終フォールバック） */
function extractParagraphs(page: TesseractPage): Array<{ text: string; bbox: TesseractBbox }> {
  if (!page.blocks) return [];
  return page.blocks.flatMap(b =>
    b.paragraphs
      .filter(p => p.text.trim())
      .map(p => ({ text: p.text, bbox: p.bbox })),
  );
}

// ── エンジン本体 ────────────────────────────────────────────────────────────────

export const tesseractEngine: OcrEngine = {
  name: 'tesseract',

  async recognize(input: OcrInput): Promise<OcrResult> {
    const { canvas, origW, origH } = await loadToCanvas(input);

    // tesseract.js を動的 import する（初期バンドルに含めない）
    // CJS モジュールなので、Vite がラップした場合は .default 経由になることがある
    const mod = await import('tesseract.js') as unknown as
      | { recognize: RecognizeFn; default?: undefined }
      | { default: { recognize: RecognizeFn } };

    const recognizeFn: RecognizeFn =
      'recognize' in mod && typeof (mod as { recognize?: unknown }).recognize === 'function'
        ? (mod as { recognize: RecognizeFn }).recognize
        : (mod as { default: { recognize: RecognizeFn } }).default.recognize;

    const { data } = await recognizeFn(canvas, 'jpn');

    // 前処理で 2 倍拡大した分、座標を 1/2 して元画像座標に戻す
    const SCALE = 2;
    const toOcrLine = (item: { text: string; bbox: TesseractBbox }): OcrLine => ({
      text: item.text.trim(),
      bbox: {
        x: item.bbox.x0 / SCALE,
        y: item.bbox.y0 / SCALE,
        w: (item.bbox.x1 - item.bbox.x0) / SCALE,
        h: (item.bbox.y1 - item.bbox.y0) / SCALE,
      },
    });

    // words → lines → paragraphs の順でフォールバックして行リストを確定する
    const wordItems = extractWords(data);
    let rawItems: Array<{ text: string; bbox: TesseractBbox }>;
    if (wordItems.length > 0) {
      rawItems = wordItems;
    } else {
      const lineItems = extractLines(data);
      rawItems = lineItems.length > 0 ? lineItems : extractParagraphs(data);
    }

    const lines = rawItems.map(toOcrLine).filter(l => l.text.length > 0);

    return {
      lines,
      width: origW,
      height: origH,
      raw: lines.map(l => l.text).join('\n'),
    };
  },
};
