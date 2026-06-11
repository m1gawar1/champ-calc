export interface RosterEntry {
  name: string;
  dexNumber: number;
  types: string[];
  form: string; // "Base" | "Mega" | "Regional"
  abilities: Record<string, string>;
  championsVerified: boolean;
}

export interface BaseStats {
  name: string;
  dexNumber: number;
  form: string;
  hp: number;
  atk: number;
  def: number;
  spa: number;
  spd: number;
  spe: number;
  total: number;
  championsVerified: boolean;
}

export interface Move {
  name: string;
  type: string;
  category: 'Physical' | 'Special' | 'Status';
  power: number;
  accuracy: number | null;
  pp: number;
  priority: number;
  inChampions: boolean;
  championsVerified: boolean;
}

export interface Nature {
  name: string;
  increasedStat: string | null;
  decreasedStat: string | null;
}

export interface SpAlloc {
  hp: number; atk: number; def: number;
  spa: number; spd: number; spe: number;
}

export interface IvAlloc {
  hp: number; atk: number; def: number;
  spa: number; spd: number; spe: number;
}

export const DEFAULT_IVS: IvAlloc = { hp: 31, atk: 31, def: 31, spa: 31, spd: 31, spe: 31 };
export const DEFAULT_SP: SpAlloc = { hp: 0, atk: 0, def: 0, spa: 0, spd: 0, spe: 0 };

export interface PokemonBuild {
  rosterName: string;
  isMega: boolean;
  megaFormName: string;
  nature: string;
  ivs: IvAlloc;
  sp: SpAlloc;
  item: string;       // 英語アイテム名（なし = ''）
  ability: string;    // 英語特性名（なし = ''）
  moves: string[];    // 英語技名（最大4つ）
  // 計算タブ用: ステータス別の性格補正倍率（0.9/1.0/1.1）を直接指定。
  // 未指定のステータスは nature から算出（後方互換）。相手の性格不明時の予測計算用。
  statMult?: Partial<Record<keyof Omit<SpAlloc, 'hp'>, number>>;
}

// バトル状況（計算オプション）
export interface BattleConditions {
  weather: 'sun' | 'rain' | 'sand' | 'hail' | null;
  field: 'electric' | 'grassy' | 'psychic' | 'misty' | null;
  isCrit: boolean;
  isBurned: boolean;
  atkRank: number;
  defRank: number;
  defAtFullHp: boolean;
  // スクリーン
  reflect: boolean;
  lightScreen: boolean;
  auroraVeil: boolean;
  // 消耗ダメージ（防御側）
  stealthRock: boolean;
  spikes: number;      // 0〜3層
  sandTurns: number;   // 砂嵐ダメージ経過ターン数
}

export const DEFAULT_CONDITIONS: BattleConditions = {
  weather: null, field: null,
  isCrit: false, isBurned: false,
  atkRank: 0, defRank: 0,
  defAtFullHp: true,
  reflect: false, lightScreen: false, auroraVeil: false,
  stealthRock: false, spikes: 0, sandTurns: 0,
};

export interface DamageResult {
  rolls: number[];
  defenderHp: number;
  minPercent: number;
  maxPercent: number;
  ko1Chance: number;
  guaranteed2HKO: boolean;
  effectiveness: number;
  moveName: string;
  moveType: string;
  movePower: number;
  moveCategory: string;
}

// 覚え技データ
export interface LearnsetEntry {
  dexNumber: number;
  form: string;
  moves: { name: string }[];
  moveCount: number;
}

export interface ChampionsData {
  roster: RosterEntry[];
  baseStats: BaseStats[];
  moves: Move[];
  natures: Nature[];
  learnsets: Record<string, LearnsetEntry>;
}
