import type { BaseStats, Nature, SpAlloc, IvAlloc } from '../types';

const LEVEL = 50;

// SP → EV換算（1 SP = 8 EV、最大32SP = 256EV相当）
function spToEv(sp: number): number {
  return sp * 8;
}

// HP実数値（Lv50）
export function calcHp(base: number, iv: number, sp: number): number {
  const ev = spToEv(sp);
  return Math.floor(((2 * base + iv + Math.floor(ev / 4)) * LEVEL) / 100 + LEVEL + 10);
}

// HP以外の実数値（Lv50）
export function calcStat(base: number, iv: number, sp: number, natureMult: number): number {
  const ev = spToEv(sp);
  return Math.floor(
    Math.floor(((2 * base + iv + Math.floor(ev / 4)) * LEVEL) / 100 + 5) * natureMult,
  );
}

// 性格倍率を取得（stat は "atk" | "def" | "spa" | "spd" | "spe"）
export function getNatureMult(nature: Nature, stat: keyof Omit<SpAlloc, 'hp'>): number {
  const map: Record<string, string> = {
    atk: 'attack',
    def: 'defense',
    spa: 'sp_attack',
    spd: 'sp_defense',
    spe: 'speed',
  };
  const mapped = map[stat];
  if (nature.increasedStat === mapped) return 1.1;
  if (nature.decreasedStat === mapped) return 0.9;
  return 1.0;
}

export interface ComputedStats {
  hp: number;
  atk: number;
  def: number;
  spa: number;
  spd: number;
  spe: number;
}

export function computeStats(
  bs: BaseStats,
  ivs: IvAlloc,
  sp: SpAlloc,
  nature: Nature,
): ComputedStats {
  return {
    hp:  calcHp(bs.hp, ivs.hp, sp.hp),
    atk: calcStat(bs.atk, ivs.atk, sp.atk, getNatureMult(nature, 'atk')),
    def: calcStat(bs.def, ivs.def, sp.def, getNatureMult(nature, 'def')),
    spa: calcStat(bs.spa, ivs.spa, sp.spa, getNatureMult(nature, 'spa')),
    spd: calcStat(bs.spd, ivs.spd, sp.spd, getNatureMult(nature, 'spd')),
    spe: calcStat(bs.spe, ivs.spe, sp.spe, getNatureMult(nature, 'spe')),
  };
}
