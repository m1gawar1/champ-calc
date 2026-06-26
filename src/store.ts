import type { PokemonBuild, BattleConditions } from './types';
import { DEFAULT_IVS, DEFAULT_SP } from './types';

export interface SavedParty {
  id: string;
  name: string;
  members: (PokemonBuild | null)[]; // 6スロット、null=空き
}

// ボックス個体（育成個体プール）。パーティはここを参照する設計へ段階移行する。
export interface BoxPokemon {
  id: string;
  build: PokemonBuild;
  nickname?: string; // 任意のニックネーム（管理用）
  createdAt: number;
}

export interface CalcHistoryEntry {
  id: string;
  timestamp: number;
  attacker: PokemonBuild;
  defender: PokemonBuild;
  moveSlots: string[];
  conditions: BattleConditions;
  results: {
    moveName: string;
    minPercent: number;
    maxPercent: number;
    ko1Chance: number;
    guaranteed2HKO: boolean;
  }[];
}

// 1試合の対戦記録（相手パーティ＋双方の選出）
export interface BattleHistoryEntry {
  id: string;
  timestamp: number;
  opponentParty: PokemonBuild[];     // 相手の登録6体（スナップショット）
  myParty?: PokemonBuild[];          // 自分の登録6体（スナップショット）
  myPartyName: string;               // 自分パーティ名
  mySelection: PokemonBuild[];       // 自分の選出（最大3体・後方互換）
  opponentSelection: PokemonBuild[]; // 相手の選出（最大3体・後方互換）
  mySelectionOrder?: number[];       // 自分パーティ内の選出インデックス（選出順）
  opponentSelectionOrder?: number[]; // 相手パーティ内の選出インデックス（選出順）
  result: 'win' | 'lose' | null;     // 勝敗（任意）
}

export interface AppStore {
  myParties: SavedParty[];
  opponentParty: PokemonBuild[]; // 最大6体
  activePartyId: string | null;  // 対戦で使用中のパーティID
  pokemonHistory: string[];      // 直近で選択したポケモンのrosterName
  calcHistory: CalcHistoryEntry[]; // 計算履歴（最大20件）
  battleHistory: BattleHistoryEntry[]; // 対戦履歴（最大20件）
  box: BoxPokemon[]; // ボックス（育成個体プール）
}

const STORAGE_KEY = 'champ_store_v1';

const DEFAULT: AppStore = {
  myParties: [],
  opponentParty: [],
  activePartyId: null,
  pokemonHistory: [],
  calcHistory: [],
  battleHistory: [],
  box: [],
};

export function loadStore(): AppStore {
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    if (!raw) return DEFAULT;
    return { ...DEFAULT, ...(JSON.parse(raw) as AppStore) };
  } catch {
    return DEFAULT;
  }
}

export function saveStore(store: AppStore): void {
  try {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(store));
  } catch { /* quota exceeded など */ }
}

export function addPokemonToHistory(store: AppStore, rosterName: string): AppStore {
  if (!rosterName) return store;
  // 重複を削除し、先頭に追加。最大100件。
  const newHistory = [rosterName, ...store.pokemonHistory.filter(name => name !== rosterName)].slice(0, 100);
  return { ...store, pokemonHistory: newHistory };
}

export function addCalcHistory(store: AppStore, entry: Omit<CalcHistoryEntry, 'id' | 'timestamp'>): AppStore {
  const newEntry: CalcHistoryEntry = {
    ...entry,
    id: crypto.randomUUID(),
    timestamp: Date.now(),
  };
  const newHistory = [newEntry, ...store.calcHistory].slice(0, 20);
  return { ...store, calcHistory: newHistory };
}

export function addBattleHistory(store: AppStore, entry: Omit<BattleHistoryEntry, 'id' | 'timestamp'>): AppStore {
  const newEntry: BattleHistoryEntry = {
    ...entry,
    id: crypto.randomUUID(),
    timestamp: Date.now(),
  };
  const newHistory = [newEntry, ...store.battleHistory].slice(0, 20);
  return { ...store, battleHistory: newHistory };
}

// ── ボックス個体 CRUD ──

// 個体を1体追加（先頭に挿入）。生成した BoxPokemon を返す。
export function addBoxPokemon(store: AppStore, build: PokemonBuild, nickname?: string): { store: AppStore; created: BoxPokemon } {
  const created: BoxPokemon = {
    id: crypto.randomUUID(),
    build,
    nickname,
    createdAt: Date.now(),
  };
  return { store: { ...store, box: [created, ...store.box] }, created };
}

// 指定個体を部分更新（build / nickname）。
export function updateBoxPokemon(store: AppStore, id: string, patch: Partial<Pick<BoxPokemon, 'build' | 'nickname'>>): AppStore {
  return { ...store, box: store.box.map(b => b.id === id ? { ...b, ...patch } : b) };
}

// 指定個体を削除。
export function removeBoxPokemon(store: AppStore, id: string): AppStore {
  return { ...store, box: store.box.filter(b => b.id !== id) };
}

export function newParty(name: string): SavedParty {
  return {
    id: crypto.randomUUID(),
    name,
    members: Array(6).fill(null),
  };
}

// 空の対戦相手ビルド（名前のみ）
export function opponentBuild(rosterName = ''): PokemonBuild {
  return {
    rosterName,
    isMega: false,
    megaFormName: '',
    nature: 'Hardy',
    ivs: DEFAULT_IVS,
    sp: { ...DEFAULT_SP },
    item: '',
    ability: '',
    moves: [],
  };
}
