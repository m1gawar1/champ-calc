// OCR エンジンの差し替え可能インターフェイス。
// Web/開発 = Tesseract.js、iOS本番 = ML Kit（@capacitor-mlkit/text-recognition）を
// この IF の裏で入れ替える。パーサ側は engine 実装に依存しない。

// 矩形（元画像のピクセル座標系。クロップした場合も必ず元画像座標に戻すこと）
export interface BBox {
  x: number;
  y: number;
  w: number;
  h: number;
}

// 認識した1行（テキスト＋元画像座標での位置）
export interface OcrLine {
  text: string;
  bbox: BBox;
}

// OCR 結果。lines は元画像座標系に揃える。width/height は元画像サイズ。
export interface OcrResult {
  lines: OcrLine[];
  width: number;
  height: number;
  raw?: string; // デバッグ用の素の全文（任意）
}

// OCR への入力（実装ごとに受け付けられる型が違うので緩く許容）
export type OcrInput = string | Blob | ArrayBuffer | HTMLCanvasElement | HTMLImageElement;

// 差し替え可能な OCR エンジン
export interface OcrEngine {
  readonly name: string;
  recognize(image: OcrInput): Promise<OcrResult>;
}
