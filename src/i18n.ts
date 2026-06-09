// 日本語名マッピングのロード・検索ユーティリティ
import pokemonJa from './data/pokemon-ja.json';
import movesJa from './data/moves-ja.json';
import abilityJa from './data/ability-ja.json';

const POKEMON_JA = pokemonJa as Record<string, string>;
const MOVES_JA = movesJa as Record<string, string>;
export const ABILITY_JA = abilityJa as Record<string, string>;

// 英語特性名 → 日本語名
export function abilityJaName(enName: string): string {
  return ABILITY_JA[enName] ?? enName;
}

// 地域フォームのプレフィックス変換
const REGIONAL_PREFIX: Record<string, string> = {
  Alolan:  'アローラ',
  Galarian: 'ガラル',
  Paldean: 'パルデア',
  Hisuian: 'ヒスイ',
};

// ポケモン表示名（地域フォーム・メガシンカ対応）
export function displayPokemonName(enName: string): string {
  // 地域フォーム: "Alolan Raichu" → "アローラ ライチュウ"
  for (const [prefix, jaPrefix] of Object.entries(REGIONAL_PREFIX)) {
    if (enName.startsWith(prefix + ' ')) {
      const baseName = enName.slice(prefix.length + 1);
      const jaBase = POKEMON_JA[baseName] ?? baseName;
      return `${jaPrefix} ${jaBase}`;
    }
  }

  // メガシンカ: "Mega Venusaur" → "メガフシギバナ"
  //             "Mega Charizard X" → "メガリザードンX"
  if (enName.startsWith('Mega ')) {
    const rest = enName.slice(5);
    const parts = rest.split(' ');
    const last = parts[parts.length - 1];
    if (/^[XY]$/.test(last)) {
      const baseName = parts.slice(0, -1).join(' ');
      const jaBase = POKEMON_JA[baseName] ?? baseName;
      return `メガ${jaBase}${last}`;
    }
    const jaBase = POKEMON_JA[rest] ?? rest;
    return `メガ${jaBase}`;
  }

  return POKEMON_JA[enName] ?? enName;
}

// 英語技名 → 日本語名
export function moveJa(enName: string): string {
  return MOVES_JA[enName] ?? enName;
}

// Combobox用アイテムリスト（label=日本語表示名, value=英語）
export function getPokemonJaList(enNames: string[]): { label: string; value: string }[] {
  return enNames.map(en => ({ value: en, label: displayPokemonName(en) }));
}

export function getMoveJaList(enNames: string[]): { label: string; value: string }[] {
  return enNames.map(en => ({ value: en, label: MOVES_JA[en] ?? en }));
}

// タイプ名（英語 → 日本語）
export const TYPE_JA: Record<string, string> = {
  Normal: 'ノーマル', Fire: 'ほのお', Water: 'みず', Electric: 'でんき',
  Grass: 'くさ', Ice: 'こおり', Fighting: 'かくとう', Poison: 'どく',
  Ground: 'じめん', Flying: 'ひこう', Psychic: 'エスパー', Bug: 'むし',
  Rock: 'いわ', Ghost: 'ゴースト', Dragon: 'ドラゴン', Dark: 'あく',
  Steel: 'はがね', Fairy: 'フェアリー',
};

// 性格名（英語 → 日本語）
export const NATURE_JA: Record<string, string> = {
  Hardy: 'がんばりや', Lonely: 'さみしがり', Brave: 'ゆうかん', Adamant: 'いじっぱり',
  Naughty: 'やんちゃ', Bold: 'ずぶとい', Docile: 'すなお', Relaxed: 'のんき',
  Impish: 'わんぱく', Lax: 'のうてんき', Timid: 'おくびょう', Hasty: 'せっかち',
  Serious: 'まじめ', Jolly: 'ようき', Naive: 'むじゃき', Modest: 'ひかえめ',
  Mild: 'おっとり', Quiet: 'れいせい', Bashful: 'てれや', Rash: 'うっかりや',
  Calm: 'おだやか', Gentle: 'おとなしい', Sassy: 'なまいき', Careful: 'しんちょう',
  Quirky: 'きまぐれ',
};

// 性格の上昇・下降ステータス表示名
export const STAT_JA: Record<string, string> = {
  attack: '攻撃',
  defense: '防御',
  sp_attack: '特攻',
  sp_defense: '特防',
  speed: '素早さ',
};
