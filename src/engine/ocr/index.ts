// OCR エンジンセレクタ。
// Capacitor ネイティブ（iOS）なら ML Kit / Apple Vision エンジンを使用し、
// ブラウザ（開発・Web）なら Tesseract.js エンジンを使用する。

import { Capacitor } from '@capacitor/core';
import type { OcrEngine, OcrInput, OcrResult } from './types';
import { mlkitEngine } from './mlkit';
import { tesseractEngine } from './tesseract';

// エンジン・型を re-export してパッケージ境界を集約する
export { mlkitEngine, tesseractEngine };
export type { OcrEngine, OcrInput, OcrLine, OcrResult, BBox } from './types';

/**
 * 実行環境に応じて適切な OCR エンジンを返す。
 * - iOS ネイティブ: ML Kit（Apple Vision）エンジン
 * - ブラウザ / 開発: Tesseract.js エンジン
 */
export function getOcrEngine(): OcrEngine {
  return Capacitor.isNativePlatform() ? mlkitEngine : tesseractEngine;
}

/**
 * 入力画像を OCR して OcrResult を返す便利関数。
 * 実行環境に応じたエンジンを自動選択する。
 */
export async function recognizeImage(input: OcrInput): Promise<OcrResult> {
  return getOcrEngine().recognize(input);
}
