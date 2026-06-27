// ML Kit / Apple Vision ベースの OCR エンジン（iOS ネイティブ専用）。
// @capacitor-community/image-to-text の Ocr.detectText() を呼び出す。
// Android は対象外だが、import エラーにはしない。

import { Ocr } from '@capacitor-community/image-to-text';
import type { OcrEngine, OcrInput, OcrLine, OcrResult } from './types';

/** Blob を base64 文字列（データ部のみ）へ変換する */
async function blobToBase64(blob: Blob): Promise<string> {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = () => {
      const dataUrl = reader.result as string;
      // "data:image/...;base64," プレフィックスを除去する
      resolve(dataUrl.split(',')[1] ?? dataUrl);
    };
    reader.onerror = reject;
    reader.readAsDataURL(blob);
  });
}

/** ArrayBuffer を base64 文字列へ変換する */
function arrayBufferToBase64(buffer: ArrayBuffer): string {
  const bytes = new Uint8Array(buffer);
  let binary = '';
  bytes.forEach(b => { binary += String.fromCharCode(b); });
  return btoa(binary);
}

/** HTMLCanvasElement を PNG の base64 文字列へ変換する */
function canvasToBase64(canvas: HTMLCanvasElement): string {
  const dataUrl = canvas.toDataURL('image/png');
  return dataUrl.split(',')[1] ?? '';
}

/** HTMLImageElement を Canvas に描画して base64 文字列へ変換する */
function imageElementToBase64(img: HTMLImageElement): string {
  const canvas = document.createElement('canvas');
  canvas.width = img.naturalWidth || img.width;
  canvas.height = img.naturalHeight || img.height;
  const ctx = canvas.getContext('2d');
  if (!ctx) return '';
  ctx.drawImage(img, 0, 0);
  return canvasToBase64(canvas);
}

export const mlkitEngine: OcrEngine = {
  name: 'mlkit',

  async recognize(input: OcrInput): Promise<OcrResult> {
    // 入力を detectText が受け付ける形式に変換する
    let detectParam: { filename: string } | { base64: string };

    if (typeof input === 'string') {
      if (input.startsWith('data:')) {
        // data URL → base64 部分だけを抽出して渡す
        detectParam = { base64: input.split(',')[1] ?? input };
      } else {
        // ファイルパスとして扱う
        detectParam = { filename: input };
      }
    } else if (input instanceof Blob) {
      detectParam = { base64: await blobToBase64(input) };
    } else if (input instanceof ArrayBuffer) {
      detectParam = { base64: arrayBufferToBase64(input) };
    } else if (input instanceof HTMLCanvasElement) {
      detectParam = { base64: canvasToBase64(input) };
    } else {
      // HTMLImageElement
      detectParam = { base64: imageElementToBase64(input) };
    }

    const result = await Ocr.detectText(detectParam);
    const detections = result.textDetections ?? [];

    // 全検出の四隅座標の最大値から画像サイズを近似する（プラグインはサイズを返さないため）
    let maxX = 0;
    let maxY = 0;

    const lines: OcrLine[] = detections.map(det => {
      // 四隅から x/y の min/max を求めて axis-aligned bbox に変換する
      const xs = [det.topLeft[0], det.topRight[0], det.bottomLeft[0], det.bottomRight[0]];
      const ys = [det.topLeft[1], det.topRight[1], det.bottomLeft[1], det.bottomRight[1]];

      const minX = Math.min(...xs);
      const minY = Math.min(...ys);
      const bboxW = Math.max(...xs) - minX;
      const bboxH = Math.max(...ys) - minY;

      maxX = Math.max(maxX, Math.max(...xs));
      maxY = Math.max(maxY, Math.max(...ys));

      return {
        text: det.text,
        bbox: { x: minX, y: minY, w: bboxW, h: bboxH },
      };
    });

    return {
      lines,
      width: maxX,
      height: maxY,
      // デバッグ用に全テキストを連結して格納する
      raw: detections.map(d => d.text).join('\n'),
    };
  },
};
