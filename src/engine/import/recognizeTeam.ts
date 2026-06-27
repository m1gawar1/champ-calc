// 2枚のOCR結果（能力タブ・ステータスタブ）から6体の PokemonBuild を組み立てる入口。
// OCRエンジン（ML Kit / Tesseract）は呼び出し側で実行し、その OcrResult を渡す。

import type { ChampionsData, PokemonBuild } from '../../types';
import type { OcrResult } from '../ocr/types';
import { assignToCards, type GridLayout } from './assignToCards';
import { parseTeam } from './parseTeam';

export function recognizeTeam(
  abilityOcr: OcrResult,
  statusOcr: OcrResult,
  data: ChampionsData,
  layout?: GridLayout,
): PokemonBuild[] {
  const abilityCards = assignToCards(abilityOcr, layout);
  const statusCards = assignToCards(statusOcr, layout);
  return parseTeam(abilityCards, statusCards, data);
}
