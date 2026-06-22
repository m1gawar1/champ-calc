import type { RosterEntry, BaseStats, Move, Nature, ChampionsData, LearnsetEntry } from './types';
import seasonMb from './data/season-mb.json';
import seasonMbMegas from './data/season-mb-megas.json';

const BASE_URL =
  'https://raw.githubusercontent.com/otterlyclueless/pokemon-champions-data/main';

// season-mb*.json を typed として扱う（JSON import は unknown になるため）
type MbData = { roster: RosterEntry[]; baseStats: BaseStats[] };
// 自動取得分（PokeAPI）＋ チャンピオンズ独自メガ（手動管理）を結合
const MB_ROSTER = [
  ...(seasonMb as MbData).roster,
  ...(seasonMbMegas as unknown as MbData).roster,
];
const MB_BASE_STATS = [
  ...(seasonMb as MbData).baseStats,
  ...(seasonMbMegas as unknown as MbData).baseStats,
];

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

  // ローカル技上書き: 上流が未反映/古い値の技を Champions 仕様に補正
  // Make It Rain（ゴールドラッシュ・サーフゴー専用技）は上流が inChampions:false のため
  // 技選択に出てこない。Champions では実装済み・命中95 に下方修正されているため上書きする。
  // Rage Fist（ふんどのこぶし）も上流が inChampions:false のため同様に有効化する。
  for (const m of moves) {
    if (m.name === 'Make It Rain') {
      m.inChampions = true;
      m.accuracy = 95;
    }
    if (m.name === 'Rage Fist') {
      m.inChampions = true;
    }
  }

  // サーフゴー(Gholdengo)の learnset に Make It Rain を補完
  // 上流 learnsets にゴールドラッシュが含まれないため、覚え技フィルタON時に非表示になる
  if (learnsets['Gholdengo']) {
    const alreadyHas = learnsets['Gholdengo'].moves.some(m => m.name === 'Make It Rain');
    if (!alreadyHas) {
      learnsets['Gholdengo'].moves.push({ name: 'Make It Rain' });
    }
  }

  // MB独自メガの learnset 継承: 上流に learnset が無いメガフォームは
  // ベース種の learnset をコピーし、覚え技フィルタが機能するようにする
  for (const entry of MB_ROSTER) {
    if (entry.form === 'Mega' && !learnsets[entry.name]) {
      // "Mega Raichu X" → "Raichu"、"Mega Staraptor" → "Staraptor" のように導出
      const baseName = entry.name
        .replace(/^Mega /, '')  // 先頭の "Mega " を除去
        .replace(/ [XY]$/, ''); // 末尾の " X" " Y" を除去
      const baseEntry = learnsets[baseName];
      if (baseEntry) {
        learnsets[entry.name] = { ...baseEntry };
      }
    }
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

// ロスターから選択用ポケモンリスト（Megaを除く・dexNumber昇順）
export function getSelectableRoster(roster: RosterEntry[]): RosterEntry[] {
  return [...roster.filter((r) => r.form !== 'Mega')].sort((a, b) => a.dexNumber - b.dexNumber);
}

// チャンピオンズで使える技に絞る（inChampions or unverified）
export function getSelectableMoves(moves: Move[]): Move[] {
  return moves.filter((m) => m.inChampions !== false && m.category !== 'Status' && m.power > 0);
}
