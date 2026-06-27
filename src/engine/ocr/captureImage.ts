// 画像取得ヘルパー。
// ネイティブ（iOS）: @capacitor/camera の Camera.getPhoto() を使用する。
// Web（開発）: <input type="file"> を動的生成してファイルを選ばせる。
// 返り値は OcrInput なので、そのまま getOcrEngine().recognize() に渡せる。

import { Capacitor } from '@capacitor/core';
import { Camera, CameraResultType, CameraSource } from '@capacitor/camera';
import type { OcrInput } from './types';

/**
 * 1枚の画像を取得して OcrInput として返す。
 * - ネイティブ（iOS）: カメラまたはライブラリから選択し、ファイルパス文字列を返す。
 * - Web（開発）: ファイル選択ダイアログを開き、File オブジェクトを返す。
 *
 * 2枚取り込む場合はこの関数を 2 回呼ぶ（能力タブ・ステータスタブそれぞれ 1 回）。
 */
export async function captureImage(): Promise<OcrInput> {
  if (Capacitor.isNativePlatform()) {
    // ネイティブ: CameraSource.Prompt でカメラ/ライブラリをユーザーに選ばせる
    const photo = await Camera.getPhoto({
      resultType: CameraResultType.Uri,
      source: CameraSource.Prompt,
      quality: 90,
    });

    // ネイティブでは path（ファイルシステムパス）を優先し、
    // 取れない場合は webPath（Capacitor が提供する web アクセス可能パス）を使う
    const path = photo.path ?? photo.webPath;
    if (!path) throw new Error('画像パスを取得できませんでした');
    return path;
  }

  // Web: <input type="file"> を動的に生成してファイルを 1 枚選ばせる
  return new Promise<File>((resolve, reject) => {
    const input = document.createElement('input');
    input.type = 'file';
    input.accept = 'image/*';

    input.onchange = () => {
      const file = input.files?.[0];
      if (file) {
        resolve(file);
      } else {
        reject(new Error('ファイルが選択されませんでした'));
      }
    };

    // キャンセル時は reject する（Chrome 113+ でサポートされているイベント）
    input.addEventListener('cancel', () => {
      reject(new Error('ファイル選択がキャンセルされました'));
    });

    input.click();
  });
}
