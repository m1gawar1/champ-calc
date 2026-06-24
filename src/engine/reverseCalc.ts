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
  // イカサマは「相手の攻撃」と「相手の防御」の2変数に依存し耐久逆算が成立しないため非対応
  if (move.name === 'Foul Play') return null;
  // サイコショック系は特殊技でも防御(B)で受けるため、走査軸を Def にする
  const usesTargetDef = ['Psyshock', 'Psystrike', 'Secret Sword'].includes(move.name);
  const statKey: 'def' | 'spd' = (isPhysical || usesTargetDef) ? 'def' : 'spd';
  const statLabel = (isPhysical || usesTargetDef) ? '防御(B)' : '特防(D)';

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
  const atkStats = computeStats(atkBs, attacker.ivs, attacker.sp, atkNature, attacker.statMult);

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
        const statValue = defStats[statKey];
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

/**
 * 与えたダメージから相手の攻撃SP・性格を逆算する（自分が防御側のとき用）
 *
 * reverseCalcDefense と対称。防御側（自分）の実数値は固定し、
 * 攻撃側（相手）の攻撃(A)/特攻(C) SP・性格を 0..32 で走査して候補を求める。
 */
export function reverseCalcAttack(
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
  // イカサマは相手のステータスではなく自分(防御側)の攻撃に依存するため、相手の火力逆算が成立しない
  if (move.name === 'Foul Play') return null;
  // ボディプレスは相手の防御(B)で殴ってくるため、走査軸を Def にする
  const usesOwnDef = move.name === 'Body Press';
  const statKey: 'atk' | 'spa' | 'def' = usesOwnDef ? 'def' : (isPhysical ? 'atk' : 'spa');
  const statLabel = usesOwnDef ? '防御(B)' : (isPhysical ? '攻撃(A)' : '特攻(C)');

  // タイプ取得
  const atkEntry = attacker.isMega && attacker.megaFormName
    ? data.roster.find(r => r.name === attacker.megaFormName)
    : getSelectableRoster(data.roster).find(r => r.name === attacker.rosterName);
  const defEntry = defender.isMega && defender.megaFormName
    ? data.roster.find(r => r.name === defender.megaFormName)
    : getSelectableRoster(data.roster).find(r => r.name === defender.rosterName);
  const atkTypes = atkEntry?.types ?? [];
  const defTypes = defEntry?.types ?? [];

  // 防御側（自分）の実数値は固定
  const defNature = data.natures.find(n => n.name === defender.nature) ?? { name: 'Hardy', increasedStat: null, decreasedStat: null };
  const defStats = computeStats(defBs, defender.ivs, defender.sp, defNature, defender.statMult);

  const neutralNature = { name: 'Hardy', increasedStat: null, decreasedStat: null };
  const upNature = data.natures.find(n => getNatureMult(n, statKey) > 1) ?? neutralNature;
  const downNature = data.natures.find(n => getNatureMult(n, statKey) < 1) ?? neutralNature;

  const reps: { correction: Correction; label: string; nature: typeof neutralNature }[] = [
    { correction: 'up', label: '補正あり (↑)', nature: upNature },
    { correction: 'neutral', label: '無補正', nature: neutralNature },
    { correction: 'down', label: '下降補正 (↓)', nature: downNature },
  ];

  const groups: ReverseGroup[] = reps.map(rep => {
    const byStat = new Map<number, number[]>();

    for (let sp = 0; sp <= 32; sp++) {
      const testSp = { ...attacker.sp, [statKey]: sp };
      const atkStats = computeStats(atkBs, attacker.ivs, testSp, rep.nature);

      const rolls = calcDamageRolls(
        atkStats, defStats, atkTypes, defTypes, move, cond,
        attacker.item, defender.item, attacker.ability, defender.ability,
      );

      if (observedDamage >= rolls[0] && observedDamage <= rolls[15]) {
        const statValue = atkStats[statKey];
        const arr = byStat.get(statValue) ?? [];
        arr.push(sp);
        byStat.set(statValue, arr);
      }
    }

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
