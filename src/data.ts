import type { RosterEntry, BaseStats, Move, Nature, ChampionsData, LearnsetEntry } from './types';
import seasonMb from './data/season-mb.json';

const BASE_URL =
  'https://raw.githubusercontent.com/otterlyclueless/pokemon-champions-data/main';

// season-mb.json を typed として扱う（JSON import は unknown になるため）
const MB_ROSTER = (seasonMb as { roster: RosterEntry[]; baseStats: BaseStats[] }).roster;
const MB_BASE_STATS = (seasonMb as { roster: RosterEntry[]; baseStats: BaseStats[] }).baseStats;

let cache: ChampionsData | null = null;

async function fetchJson<T>(path: string): Promise<T> {
  const res = await fetch(`${BASE_URL}/${path}`);
  if (!res.ok) throw new Error(`fetch failed: ${path} (${res.status})`);
  return res.json() as Promise<T>;
}

export async function loadData(): Promise<ChampionsData> {
  if (cache) return cache;
  const [roster, baseStats, moves, natures, learnsets] = await Promise.all([
    fetchJson<RosterEntry[]>('pokemon/roster.json'),
    fetchJson<BaseStats[]>('pokemon/base-stats.json'),
    fetchJson<Move[]>('moves/moves.json'),
    fetchJson<Nature[]>('natures/natures.json'),
    fetchJson<Record<string, LearnsetEntry>>('learnsets/learnsets.json'),
  ]);
  // ローカル補完: season-mb.json のエントリのうち、上流に同名が無いものを追記
  const rosterNames = new Set(roster.map(r => r.name));
  for (const entry of MB_ROSTER) {
    if (!rosterNames.has(entry.name)) roster.push(entry);
  }
  const baseStatsNames = new Set(baseStats.map(b => b.name));
  for (const entry of MB_BASE_STATS) {
    if (!baseStatsNames.has(entry.name)) baseStats.push(entry);
  }

  cache = { roster, baseStats, moves, natures, learnsets };
  return cache;
}

// ポケモンの覚え技リストを返す（フィルタOFF時は全技）
export function getPokemonLearnset(
  learnsets: Record<string, LearnsetEntry>,
  rosterName: string,
): Set<string> | null {
  const entry = learnsets[rosterName];
  if (!entry) return null;
  return new Set(entry.moves.map(m => m.name));
}

// ロスター名 + isMega + megaFormName からベースステータスを検索
export function findBaseStats(
  baseStatsList: BaseStats[],
  rosterName: string,
  isMega: boolean,
  megaFormName?: string,
): BaseStats | undefined {
  if (isMega) {
    // 特定のメガフォームが指定されている場合はそちらを優先
    if (megaFormName) {
      return baseStatsList.find((s) => s.form === 'Mega' && s.name === megaFormName);
    }
    // 指定がなければ先頭のメガフォームを返す
    return baseStatsList.find(
      (s) => s.form === 'Mega' && s.name.toLowerCase().startsWith(`mega ${rosterName.toLowerCase()}`),
    );
  }
  return (
    baseStatsList.find((s) => s.name === rosterName && s.form !== 'Mega') ??
    baseStatsList.find((s) => s.name === rosterName)
  );
}

// メガシンカ候補を返す
export function getMegaForms(baseStatsList: BaseStats[], rosterName: string): BaseStats[] {
  return baseStatsList.filter(
    (s) => s.form === 'Mega' && s.name.toLowerCase().startsWith(`mega ${rosterName.toLowerCase()}`),
  );
}

// ロスターから選択用ポケモンリスト（Megaを除く）
export function getSelectableRoster(roster: RosterEntry[]): RosterEntry[] {
  return roster.filter((r) => r.form !== 'Mega');
}

// チャンピオンズで使える技に絞る（inChampions or unverified）
export function getSelectableMoves(moves: Move[]): Move[] {
  return moves.filter((m) => m.inChampions !== false && m.category !== 'Status' && m.power > 0);
}
