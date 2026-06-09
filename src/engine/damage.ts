import type { Move, DamageResult, BattleConditions } from '../types';
import type { ComputedStats } from './stats';
import { getTypeEffectiveness } from './typeChart';
import {
  PUNCH_MOVES, BITE_MOVES, PULSE_MOVES, SOUND_MOVES, RECOIL_MOVES,
  isContact, hasSecondaryEffect,
} from './moveFlags';
import { TYPE_BOOST_ITEMS } from './competitive';

// 4096チェーン乗算
function chain(val: number, num: number, den = 4096): number {
  return Math.floor(val * num / den);
}

// ランク補正（攻撃/防御実数値に直接かける）
function applyRank(stat: number, rank: number): number {
  if (rank === 0) return stat;
  if (rank > 0) return Math.floor(stat * (2 + rank) / 2);
  return Math.floor(stat * 2 / (2 - rank));
}

export function calcDamageRolls(
  atkStats: ComputedStats,
  defStats: ComputedStats,
  attackerTypes: string[],
  defenderTypes: string[],
  move: Move,
  cond: Partial<BattleConditions> = {},
  attackerItem = '',
  defenderItem = '',
  attackerAbility = '',
  defenderAbility = '',
): number[] {
  if (move.category === 'Status' || move.power <= 0) return Array(16).fill(0);

  const isPhysical = move.category === 'Physical';

  // ── 防御側特性による無効チェック ──
  if (defenderAbility === 'Wonder Guard' && getTypeEffectiveness(move.type, defenderTypes) <= 1) return Array(16).fill(0);
  if (defenderAbility === 'Levitate'     && move.type === 'Ground')   return Array(16).fill(0);
  if (defenderAbility === 'Flash Fire'   && move.type === 'Fire')     return Array(16).fill(0);
  if (defenderAbility === 'Water Absorb' && move.type === 'Water')    return Array(16).fill(0);
  if (defenderAbility === 'Volt Absorb'  && move.type === 'Electric') return Array(16).fill(0);
  if (defenderAbility === 'Lightning Rod'&& move.type === 'Electric') return Array(16).fill(0);
  if (defenderAbility === 'Storm Drain'  && move.type === 'Water')    return Array(16).fill(0);
  if (defenderAbility === 'Sap Sipper'   && move.type === 'Grass')    return Array(16).fill(0);
  if (defenderAbility === 'Motor Drive'  && move.type === 'Electric') return Array(16).fill(0);

  // タイプ相性
  const effectiveness = getTypeEffectiveness(move.type, defenderTypes);
  if (effectiveness === 0) return Array(16).fill(0);

  // ── ランク補正後の実数値 ──
  let atkVal = isPhysical ? atkStats.atk : atkStats.spa;
  let defVal = isPhysical ? defStats.def  : defStats.spd;
  atkVal = applyRank(atkVal, cond.atkRank ?? 0);
  defVal = applyRank(defVal, cond.defRank ?? 0);

  // ── 攻撃側特性による攻撃実数値補正 ──
  if ((attackerAbility === 'Huge Power' || attackerAbility === 'Pure Power') && isPhysical) {
    atkVal *= 2;
  }
  if (attackerAbility === 'Hustle' && isPhysical) {
    atkVal = Math.floor(atkVal * 3 / 2);
  }

  // ── 防御側アイテムによる防御実数値補正 ──
  if (defenderItem === 'Assault Vest' && !isPhysical) {
    defVal = Math.floor(defVal * 3 / 2);
  }
  if (defenderItem === 'Eviolite') {
    defVal = Math.floor(defVal * 3 / 2);
  }

  // ── 有効威力（テクニシャン等） ──
  let power = move.power;
  if (attackerAbility === 'Technician' && power <= 60) {
    power = Math.floor(power * 3 / 2);
  }

  // ── ベースダメージ（Lv50: 2*50/5+2 = 22） ──
  const baseDmg = Math.floor(Math.floor(22 * power * atkVal / defVal) / 50) + 2;

  const contact = isContact(move.name, isPhysical);
  const isBurned = (cond.isBurned ?? false) && attackerAbility !== 'Guts';

  const rolls: number[] = [];
  for (let r = 85; r <= 100; r++) {
    let d = baseDmg;

    // ── 天候 ──
    const weather = cond.weather ?? null;
    if (weather === 'sun') {
      if (move.type === 'Fire')  d = chain(d, 6144);
      if (move.type === 'Water') d = chain(d, 2048);
    } else if (weather === 'rain') {
      if (move.type === 'Water') d = chain(d, 6144);
      if (move.type === 'Fire')  d = chain(d, 2048);
    }

    // サンドフォース（砂嵐中のいわ/はがね/じめん）
    if (weather === 'sand' && attackerAbility === 'Sand Force' &&
        ['Rock', 'Steel', 'Ground'].includes(move.type)) {
      d = chain(d, 5325); // ×1.3
    }

    // もらいび（攻撃側）
    if (attackerAbility === 'Flash Fire' && move.type === 'Fire') {
      d = chain(d, 6144); // ×1.5
    }

    // ── フィールド ──
    const field = cond.field ?? null;
    if (field === 'electric' && move.type === 'Electric') d = chain(d, 5325);
    if (field === 'grassy') {
      if (move.type === 'Grass') d = chain(d, 5325);
      if (['Earthquake', 'Bulldoze', 'Magnitude'].includes(move.name)) d = chain(d, 2048);
    }
    if (field === 'psychic' && move.type === 'Psychic') d = chain(d, 5325);
    if (field === 'misty'   && move.type === 'Dragon')  d = chain(d, 2048);

    // ── 急所（×1.5） ──
    if (cond.isCrit) d = chain(d, 6144);

    // ── 乱数（85〜100） ──
    d = Math.floor(d * r / 100);

    // ── STAB ──
    if (attackerTypes.includes(move.type)) {
      d = chain(d, attackerAbility === 'Adaptability' ? 8192 : 6144);
    }

    // ── タイプ相性 ──
    if (effectiveness === 4)    { d = chain(d, 8192); d = chain(d, 8192); }
    else if (effectiveness === 2)    d = chain(d, 8192);
    else if (effectiveness === 0.5)  d = chain(d, 2048);
    else if (effectiveness === 0.25) { d = chain(d, 2048); d = chain(d, 2048); }

    // ── やけど（物理・×0.5） ──
    if (isPhysical && isBurned) d = chain(d, 2048);

    // ── 攻撃側アイテム ──
    if (attackerItem === 'Choice Band'    && isPhysical)             d = chain(d, 6144);
    if (attackerItem === 'Choice Specs'   && !isPhysical)            d = chain(d, 6144);
    if (attackerItem === 'Life Orb')                                  d = chain(d, 5324);
    if (attackerItem === 'Expert Belt'    && effectiveness > 1)       d = chain(d, 4915);
    if (attackerItem === 'Muscle Band'    && isPhysical)             d = chain(d, 4505);
    if (attackerItem === 'Wise Glasses'   && !isPhysical)            d = chain(d, 4505);
    if (attackerItem === 'Punching Glove' && PUNCH_MOVES.has(move.name)) d = chain(d, 4505);

    // タイプ強化アイテム（×1.2）。集約値 'TypeBoost' / 旧個別アイテム両対応
    if (attackerItem === 'TypeBoost' || TYPE_BOOST_ITEMS[attackerItem] === move.type) d = chain(d, 4915);

    // 半減きのみ（受け側・該当タイプ×0.5）。ノーマルは常時、他は効果抜群時のみ発動
    if (defenderItem === 'ResistBerry' && (move.type === 'Normal' || effectiveness > 1)) d = chain(d, 2048);

    // ── 攻撃側特性（ダメージ修正子） ──
    if (attackerAbility === 'Sheer Force'   && hasSecondaryEffect(move.name))  d = chain(d, 5325);
    if (attackerAbility === 'Iron Fist'     && PUNCH_MOVES.has(move.name))     d = chain(d, 4506);
    if (attackerAbility === 'Tough Claws'   && contact)                        d = chain(d, 5325);
    if (attackerAbility === 'Strong Jaw'    && BITE_MOVES.has(move.name))      d = chain(d, 6144);
    if (attackerAbility === 'Mega Launcher' && PULSE_MOVES.has(move.name))     d = chain(d, 6144);
    if (attackerAbility === 'Reckless'      && RECOIL_MOVES.has(move.name))    d = chain(d, 4915);
    if (attackerAbility === "Dragon's Maw"  && move.type === 'Dragon')         d = chain(d, 6144);
    if (attackerAbility === 'Transistor'    && move.type === 'Electric')       d = chain(d, 5325);
    if (attackerAbility === 'Rocky Payload' && move.type === 'Rock')           d = chain(d, 6144);
    if (attackerAbility === 'Punk Rock'     && SOUND_MOVES.has(move.name))     d = chain(d, 5325);

    // HP1/3以下特性（簡略：常に適用としてUIでトグル可能に）
    // overgrow/blaze/torrent/swarm は別途 "ピンチ特性ON" フラグで処理

    // こんじょう（やけど中に物理×1.5、ただし上のisBurned補正はすでに外している）
    if (attackerAbility === 'Guts' && (cond.isBurned ?? false) && isPhysical) d = chain(d, 6144);

    // ── 防御側特性 ──
    if ((defenderAbility === 'Multiscale' || defenderAbility === 'Shadow Shield') &&
        (cond.defAtFullHp !== false)) {
      d = chain(d, 2048); // ×0.5
    }
    if (defenderAbility === 'Thick Fat' && (move.type === 'Fire' || move.type === 'Ice')) {
      d = chain(d, 2048);
    }
    if ((defenderAbility === 'Filter' || defenderAbility === 'Solid Rock' || defenderAbility === 'Prism Armor') &&
        effectiveness > 1) {
      d = chain(d, 3072); // ×0.75
    }
    if (defenderAbility === 'Fluffy') {
      if (contact)              d = chain(d, 2048);
      if (move.type === 'Fire') d = chain(d, 8192);
    }
    if (defenderAbility === 'Punk Rock' && SOUND_MOVES.has(move.name)) d = chain(d, 2048);
    if (defenderAbility === 'Ice Scales' && !isPhysical)               d = chain(d, 2048);

    // ── スクリーン（急所時は無効）──
    const isCritHit = cond.isCrit ?? false;
    if (!isCritHit) {
      if ((cond.reflect    || cond.auroraVeil) && isPhysical)  d = chain(d, 2048);
      if ((cond.lightScreen || cond.auroraVeil) && !isPhysical) d = chain(d, 2048);
    }

    rolls.push(d);
  }
  return rolls;
}

// 確定数計算（n発確定）
export function calcKoChance(rolls: number[], hp: number): { n: number; chance: number } { // eslint-disable-line @typescript-eslint/no-unused-vars
  for (let n = 1; n <= 4; n++) {
    // n発の最小累積ダメージ = rolls[0] * n
    const minTotal = rolls[0] * n;
    if (minTotal >= hp) return { n, chance: 16 }; // 確定n発
    // n発の乱数チャンス: rolls[i] で n回合計がhp以上になる確率
    const chance = rolls.filter(r => r * n >= hp).length;
    if (chance > 0) return { n, chance };
  }
  return { n: 5, chance: 0 };
}

// ── 消耗ダメージ計算（ステルスロック・まきびし・砂嵐） ──
export interface HazardDamage {
  stealthRock: number;
  spikes: number;
  sand: number;
  total: number;
}

// ステルスロックのタイプ相性（いわ技への相性）
const SR_TYPE_MULT: Record<string, number> = {
  Fire: 2, Ice: 2, Flying: 2, Bug: 2,
  Grass: 0.5, Steel: 0.5, Fighting: 0.5, Ground: 0.5,
  Rock: 0.25,
};

export function calcHazardDamage(
  defenderHp: number,
  defenderTypes: string[],
  defenderAbility: string,
  cond: { stealthRock: boolean; spikes: number; sandTurns: number },
): HazardDamage {
  const isFlying = defenderTypes.includes('Flying') || defenderAbility === 'Levitate';
  const isSandImmune = defenderTypes.some(t => ['Rock', 'Steel', 'Ground'].includes(t));

  // ステルスロック
  let srEff = 1;
  for (const t of defenderTypes) srEff *= (SR_TYPE_MULT[t] ?? 1);
  const stealthRockDmg = cond.stealthRock ? Math.floor(defenderHp * srEff / 8) : 0;

  // まきびし（ひこう・ふゆう免疫）
  const spikesFrac = [0, 8, 6, 4];
  const spikesDmg = (!isFlying && cond.spikes > 0)
    ? Math.floor(defenderHp / spikesFrac[Math.min(cond.spikes, 3)])
    : 0;

  // 砂嵐ダメージ
  const sandDmg = (!isSandImmune && cond.sandTurns > 0)
    ? Math.floor(defenderHp / 16) * cond.sandTurns
    : 0;

  const total = stealthRockDmg + spikesDmg + sandDmg;
  return { stealthRock: stealthRockDmg, spikes: spikesDmg, sand: sandDmg, total };
}

export function buildResult(
  rolls: number[],
  defenderHp: number,
  effectiveness: number,
  moveName: string,
  moveType: string,
  movePower: number,
  moveCategory: string,
): DamageResult {
  return {
    rolls,
    defenderHp,
    minPercent: Math.floor((rolls[0] / defenderHp) * 1000) / 10,
    maxPercent: Math.floor((rolls[15] / defenderHp) * 1000) / 10,
    ko1Chance: rolls.filter(r => r >= defenderHp).length,
    guaranteed2HKO: rolls[0] * 2 >= defenderHp,
    effectiveness,
    moveName,
    moveType,
    movePower,
    moveCategory,
  };
}
