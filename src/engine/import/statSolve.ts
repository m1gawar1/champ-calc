// ステータスタブで読んだ「実数値」と「SP振り」から、SP振りを式で検証・補正し、
// 画面に出ない「性格」を逆算する。
//
// 前提:
//  - Lv50・IV31 固定（Champions想定）。
//  - 実数値は計算式 calcHp / calcStat と一致するはず。
//  - SP は OCR 誤読の可能性があるため、実数値（比較的読めている）を真として整合を取る。
//  - 性格は1ステータス×1.1上昇 + 1ステータス×0.9下降（または無補正）。

import type { BaseStats, Nature, SpAlloc } from '../../types';
import { calcHp, calcStat } from '../stats';

type NonHp = keyof Omit<SpAlloc, 'hp'>;
const NON_HP: NonHp[] = ['atk', 'def', 'spa', 'spd', 'spe'];

// stat キー → natures データの increasedStat/decreasedStat 文字列
const STAT_TO_NATURE_KEY: Record<NonHp, string> = {
  atk: 'attack',
  def: 'defense',
  spa: 'sp_attack',
  spd: 'sp_defense',
  spe: 'speed',
};

// OCR で読んだ1ステータスぶんの値
export interface StatReading {
  value: number; // 実数値
  sp: number;    // SP振り（誤読の可能性あり）
}

export interface StatReadings {
  hp: StatReading;
  atk: StatReading;
  def: StatReading;
  spa: StatReading;
  spd: StatReading;
  spe: StatReading;
}

export interface StatSolveResult {
  sp: SpAlloc;
  nature: string;                 // 解決した性格名（英語）。決まらなければ 'Hardy'
  incStat: NonHp | null;
  decStat: NonHp | null;
  warnings: string[];             // 整合が取れなかった項目（プレビューで要確認）
}

// HP の SP を解く。読んだ SP がそのまま整合すれば採用、ダメなら 0..32 を総当たり。
function solveHpSp(base: number, reading: StatReading): { sp: number; ok: boolean } {
  if (calcHp(base, 31, reading.sp) === reading.value) return { sp: reading.sp, ok: true };
  for (let sp = 0; sp <= 32; sp++) {
    if (calcHp(base, 31, sp) === reading.value) return { sp, ok: true };
  }
  return { sp: reading.sp, ok: false };
}

// HP以外の1ステータスについて (sp, mult) を解く。
// 読んだ SP を優先し、その SP で value を再現する mult を探す。
// 見つからなければ 0..32 × {1.0,0.9,1.1} を総当たりし、読んだ SP に最も近い候補を採る。
function solveStat(
  base: number,
  reading: StatReading,
): { sp: number; mult: number; ok: boolean } {
  const mults = [1.0, 1.1, 0.9];

  // 1) 読んだ SP を信じて mult を特定
  const hit = mults.filter(m => calcStat(base, 31, reading.sp, m) === reading.value);
  if (hit.length === 1) return { sp: reading.sp, mult: hit[0], ok: true };
  // 読んだ SP で複数 mult が一致する曖昧ケースは無補正(1.0)を優先
  if (hit.length > 1) return { sp: reading.sp, mult: hit.includes(1.0) ? 1.0 : hit[0], ok: true };

  // 2) SP を総当たりして value を再現する (sp, mult) を集め、読んだ SP に近いものを採用
  const cands: { sp: number; mult: number }[] = [];
  for (let sp = 0; sp <= 32; sp++) {
    for (const m of mults) {
      if (calcStat(base, 31, sp, m) === reading.value) cands.push({ sp, mult: m });
    }
  }
  if (cands.length === 0) return { sp: reading.sp, mult: 1.0, ok: false };
  cands.sort((a, b) => {
    const da = Math.abs(a.sp - reading.sp);
    const db = Math.abs(b.sp - reading.sp);
    if (da !== db) return da - db;
    // 距離同点なら無補正を優先
    return (a.mult === 1.0 ? 0 : 1) - (b.mult === 1.0 ? 0 : 1);
  });
  return { sp: cands[0].sp, mult: cands[0].mult, ok: true };
}

// (incStat, decStat) から性格名を引く。natures は ChampionsData.natures。
function findNatureName(
  natures: Nature[],
  inc: NonHp | null,
  dec: NonHp | null,
): string {
  // 無補正
  if (!inc && !dec) {
    const neutral = natures.find(n => n.increasedStat === null && n.decreasedStat === null);
    return neutral?.name ?? 'Hardy';
  }
  const incKey = inc ? STAT_TO_NATURE_KEY[inc] : null;
  const decKey = dec ? STAT_TO_NATURE_KEY[dec] : null;
  const found = natures.find(n => n.increasedStat === incKey && n.decreasedStat === decKey);
  return found?.name ?? 'Hardy';
}

export function solveStats(
  base: BaseStats,
  readings: StatReadings,
  natures: Nature[],
): StatSolveResult {
  const warnings: string[] = [];

  const hpSolved = solveHpSp(base.hp, readings.hp);
  if (!hpSolved.ok) warnings.push('HPの実数値とSP振りが計算式と一致しませんでした');

  const sp: SpAlloc = { hp: hpSolved.sp, atk: 0, def: 0, spa: 0, spd: 0, spe: 0 };
  const mults: Record<NonHp, number> = { atk: 1, def: 1, spa: 1, spd: 1, spe: 1 };

  for (const k of NON_HP) {
    const r = solveStat(base[k], readings[k]);
    sp[k] = r.sp;
    mults[k] = r.mult;
    if (!r.ok) warnings.push(`${k}の実数値が計算式と一致しませんでした`);
  }

  // 性格の上昇/下降ステータスを判定
  const incs = NON_HP.filter(k => mults[k] > 1.0);
  const decs = NON_HP.filter(k => mults[k] < 1.0);

  let incStat: NonHp | null = incs[0] ?? null;
  let decStat: NonHp | null = decs[0] ?? null;

  if (incs.length > 1) {
    warnings.push('性格の上昇ステータスが複数検出されました（要確認）');
    incStat = incs[0];
  }
  if (decs.length > 1) {
    warnings.push('性格の下降ステータスが複数検出されました（要確認）');
    decStat = decs[0];
  }
  // 上昇のみ/下降のみ（無補正性格＝Hardy系ではありえない組み合わせ）も一応許容しつつ性格を引く

  const nature = findNatureName(natures, incStat, decStat);

  return { sp, nature, incStat, decStat, warnings };
}
