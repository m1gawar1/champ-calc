// 素早さ比較エンジン
// 計算順序は本家準拠: ランク補正(floor) → 4096ベース補正チェーン(pokeRound) → まひ半減(floor)
import { calcStat } from './stats';

// 素早さに影響する状況補正（基本セット）
export interface SpeedConditions {
  rank: number;        // ランク補正 -6〜+6
  scarf: boolean;      // こだわりスカーフ ×1.5
  tailwind: boolean;   // おいかぜ ×2
  paralyzed: boolean;  // まひ ×0.5
}

export const DEFAULT_SPEED_CONDITIONS: SpeedConditions = {
  rank: 0, scarf: false, tailwind: false, paralyzed: false,
};

// 本家の丸め: 小数部がちょうど 0.5 のときは切り捨て、それより大きければ切り上げ
function pokeRound(x: number): number {
  return x % 1 > 0.5 ? Math.ceil(x) : Math.floor(x);
}

// 4096ベースの補正値を連結（(a×b + 2048) >> 12）
function chainMod(a: number, b: number): number {
  return (a * b + 2048) >> 12;
}

// ランク補正後の素早さ（floor）
function applyRank(stat: number, rank: number): number {
  const r = Math.max(-6, Math.min(6, rank));
  return r >= 0
    ? Math.floor((stat * (2 + r)) / 2)
    : Math.floor((stat * 2) / (2 - r));
}

// 実数値 + 状況補正 → 最終素早さ
export function finalSpeed(stat: number, cond: SpeedConditions): number {
  let speed = applyRank(stat, cond.rank);

  // 持ち物・場の補正を 4096 ベースで連結してから一括適用
  let mod = 4096;
  if (cond.scarf) mod = chainMod(mod, 6144);    // ×1.5
  if (cond.tailwind) mod = chainMod(mod, 8192); // ×2
  if (mod !== 4096) speed = pokeRound((speed * mod) / 4096);

  if (cond.paralyzed) speed = Math.floor((speed * 50) / 100);

  return Math.min(speed, 10000);
}

// 相手の想定努力値配分ライン（種族値から算出する素の実数値）
export type SpeedPresetKey = 'fastest' | 'fast' | 'neutral' | 'slowest';

export interface SpeedPreset {
  key: SpeedPresetKey;
  label: string;
  stat: number; // 補正前の実数値
}

export function speedPresets(baseSpe: number): SpeedPreset[] {
  return [
    { key: 'fastest', label: '最速',   stat: calcStat(baseSpe, 31, 32, 1.1) }, // IV31・SP32・上昇性格
    { key: 'fast',    label: '準速',   stat: calcStat(baseSpe, 31, 32, 1.0) }, // IV31・SP32・無補正
    { key: 'neutral', label: '無振り', stat: calcStat(baseSpe, 31, 0, 1.0) },  // IV31・SP0・無補正
    { key: 'slowest', label: '最遅',   stat: calcStat(baseSpe, 0, 0, 0.9) },   // IV0・SP0・下降性格
  ];
}

// 自分から見た比較結果
export type SpeedVerdict = 'faster' | 'tie' | 'slower';

export function compareSpeed(mySpeed: number, theirSpeed: number): SpeedVerdict {
  if (mySpeed > theirSpeed) return 'faster';
  if (mySpeed < theirSpeed) return 'slower';
  return 'tie';
}
