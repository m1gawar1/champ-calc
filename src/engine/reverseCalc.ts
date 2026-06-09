// ダメージ逆算エンジン
// 観測ダメージから相手のSP振り・性格の組み合わせを逆算する

import type { ChampionsData, PokemonBuild, BattleConditions, Move } from '../types';
import { findBaseStats, getSelectableRoster } from '../data';
import { computeStats, getNatureMult } from './stats';
import { calcDamageRolls } from './damage';
import { NATURE_JA } from '../i18n';

export type Correction = 'up' | 'neutral' | 'down';

export interface ReverseEntry {
  statValue: number;      // 実数値
  spMin: number;          // この実数値になる最小SP
  spMax: number;          // この実数値になる最大SP
}

export interface ReverseGroup {
  correction: Correction; // 補正区分
  label: string;          // '補正あり (↑)' / '無補正' / '下降補正 (↓)'
  natureJa: string;       // 代表となる性格の日本語名（例: ずぶとい）
  entries: ReverseEntry[];// 観測ダメージに一致した実数値の候補
}

export interface ReverseResult {
  statLabel: string;      // '防御(B)' or '特防(D)'
  groups: ReverseGroup[]; // ↑ / 無 / ↓ の3グループ
}

/**
 * 与えたダメージから相手の防御SP・性格を逆算する
 * 
 * @param data - チャンピオンズデータ
 * @param attacker - 攻撃側ビルド（自分）
 * @param defender - 防御側ビルド（相手、SPが未知）
 * @param move - 使用した技
 * @param cond - バトル条件
 * @param observedDamage - 観測ダメージ（HP実数値での減少量）
 * @returns 候補リスト
 */
export function reverseCalcDefense(
  data: ChampionsData,
  attacker: PokemonBuild,
  defender: PokemonBuild,
  move: Move,
  cond: BattleConditions,
  observedDamage: number,
): ReverseResult | null {
  const atkBs = findBaseStats(data.baseStats, attacker.rosterName, attacker.isMega, attacker.megaFormName);
  const defBs = findBaseStats(data.baseStats, defender.rosterName, defender.isMega, defender.megaFormName);
  if (!atkBs || !defBs) return null;

  const isPhysical = move.category === 'Physical';
  const statKey = isPhysical ? 'def' : 'spd';
  const statLabel = isPhysical ? '防御(B)' : '特防(D)';

  // 攻撃側タイプ取得
  const atkEntry = attacker.isMega && attacker.megaFormName
    ? data.roster.find(r => r.name === attacker.megaFormName)
    : getSelectableRoster(data.roster).find(r => r.name === attacker.rosterName);
  const defEntry = defender.isMega && defender.megaFormName
    ? data.roster.find(r => r.name === defender.megaFormName)
    : getSelectableRoster(data.roster).find(r => r.name === defender.rosterName);
  const atkTypes = atkEntry?.types ?? [];
  const defTypes = defEntry?.types ?? [];

  // 攻撃側の実数値（逆算中は固定）
  const atkNature = data.natures.find(n => n.name === attacker.nature) ?? { name: 'Hardy', increasedStat: null, decreasedStat: null };
  const atkStats = computeStats(atkBs, attacker.ivs, attacker.sp, atkNature);

  // 補正区分ごとの代表性格を選ぶ
  // up: その能力を上げる性格 / down: 下げる性格 / neutral: 無補正(Hardy相当)
  const neutralNature = { name: 'Hardy', increasedStat: null, decreasedStat: null };
  const upNature = data.natures.find(n => getNatureMult(n, statKey) > 1) ?? neutralNature;
  const downNature = data.natures.find(n => getNatureMult(n, statKey) < 1) ?? neutralNature;

  const reps: { correction: Correction; label: string; nature: typeof neutralNature }[] = [
    { correction: 'up', label: '補正あり (↑)', nature: upNature },
    { correction: 'neutral', label: '無補正', nature: neutralNature },
    { correction: 'down', label: '下降補正 (↓)', nature: downNature },
  ];

  const groups: ReverseGroup[] = reps.map(rep => {
    // 実数値 → 一致したSPの集合
    const byStat = new Map<number, number[]>();

    for (let sp = 0; sp <= 32; sp++) {
      const testSp = { ...defender.sp, [statKey]: sp };
      const defStats = computeStats(defBs, defender.ivs, testSp, rep.nature);

      const rolls = calcDamageRolls(
        atkStats, defStats, atkTypes, defTypes, move, cond,
        attacker.item, defender.item, attacker.ability, defender.ability,
      );

      // 観測ダメージがロール範囲に含まれるか
      if (observedDamage >= rolls[0] && observedDamage <= rolls[15]) {
        const statValue = isPhysical ? defStats.def : defStats.spd;
        const arr = byStat.get(statValue) ?? [];
        arr.push(sp);
        byStat.set(statValue, arr);
      }
    }

    // 実数値ごとに SP の最小・最大をまとめる
    const entries: ReverseEntry[] = [...byStat.entries()]
      .map(([statValue, sps]) => ({ statValue, spMin: Math.min(...sps), spMax: Math.max(...sps) }))
      .sort((a, b) => a.statValue - b.statValue);

    return {
      correction: rep.correction,
      label: rep.label,
      natureJa: NATURE_JA[rep.nature.name] ?? rep.nature.name,
      entries,
    };
  });

  return { statLabel, groups };
}
