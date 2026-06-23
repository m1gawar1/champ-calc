import type { RosterEntry, BaseStats, Move, Nature, ChampionsData, LearnsetEntry } from './types';
import seasonMb from './data/season-mb.json';
import seasonMbMegas from './data/season-mb-megas.json';
import seasonMbLearnsets from './data/season-mb-learnsets.json';
import rotomForms from './data/rotom-forms.json';

const BASE_URL =
  'https://raw.githubusercontent.com/otterlyclueless/pokemon-champions-data/main';

// season-mb*.json を typed として扱う（JSON import は unknown になるため）
type MbData = { roster: RosterEntry[]; baseStats: BaseStats[] };
// 自動取得分（PokeAPI）＋ チャンピオンズ独自メガ（手動管理）を結合
const MB_ROSTER = [
  ...(seasonMb as MbData).roster,
  ...(seasonMbMegas as unknown as MbData).roster,
  ...(rotomForms as unknown as MbData).roster,
];
const MB_BASE_STATS = [
  ...(seasonMb as MbData).baseStats,
  ...(seasonMbMegas as unknown as MbData).baseStats,
  ...(rotomForms as unknown as MbData).baseStats,
];
// MB追加ポケモンの覚え技（PokeAPI由来・SV優先、SV未収録は全世代和集合）。上流 learnsets 未収録分を補完。
const MB_LEARNSETS = seasonMbLearnsets as unknown as Record<string, LearnsetEntry>;

// Champions の覚え技を実態に合わせて補正（追加/削除）。
// PokeAPI(SV)由来の learnset には Champions と異なる技が含まれるため、ポケモンごとに調整する。
const LEARNSET_PATCHES: Record<string, { add?: string[]; remove?: string[] }> = {
  // サーフゴー: ゴールドラッシュ・なみのりを習得、でんじは（Champions非対応）を除外
  Gholdengo: { add: ['Make It Rain', 'Surf'], remove: ['Thunder Wave'] },
  // オーロンゲ: すてゼリフを習得、でんじは（Champions非対応）を除外
  Grimmsnarl: { add: ['Parting Shot'], remove: ['Thunder Wave'] },
  // ガメノデス: インファイトを習得（上流 learnset 未収録）
  Barbaracle: { add: ['Close Combat'] },
};

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

  // ローカル補完: MB追加ポケモンの learnset（上流 learnsets 未収録）を追記。
  // この後のメガ継承がベース種の learnset を参照するため、メガ継承より前に実行する。
  for (const [name, entry] of Object.entries(MB_LEARNSETS)) {
    if (!learnsets[name]) learnsets[name] = entry;
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

  // Champions 仕様に合わせて learnset を補正（追加/削除）。メガ継承より前に適用し、継承先にも反映させる。
  for (const [name, patch] of Object.entries(LEARNSET_PATCHES)) {
    const entry = learnsets[name];
    if (!entry) continue;
    let moveList = entry.moves;
    if (patch.remove) moveList = moveList.filter(m => !patch.remove!.includes(m.name));
    if (patch.add) {
      for (const mv of patch.add) {
        if (!moveList.some(m => m.name === mv)) moveList = [...moveList, { name: mv }];
      }
    }
    learnsets[name] = { ...entry, moves: moveList };
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

  // ロトムのフォルムは原種ロトムの learnset を継承（上流に form 別 learnset が無いため）。
  // 原種ロトムの覚え技には各フォルムのシグネチャ技（オーバーヒート等）が既に含まれる。
  for (const entry of (rotomForms as unknown as MbData).roster) {
    if (!learnsets[entry.name] && learnsets['Rotom']) {
      learnsets[entry.name] = { ...learnsets['Rotom'] };
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
