// Pokémon Showdown スプライット（名前ベース、メガ・リージョンフォルム対応）
const SHOWDOWN = 'https://play.pokemonshowdown.com/sprites/gen5';
const POKEAPI  = 'https://raw.githubusercontent.com/PokeAPI/sprites/master/sprites/pokemon';

// roster名 / megaFormName → Showdown スラッグ変換
function toSlug(name: string): string {
  const s = name.toLowerCase();

  // "Mega Charizard X/Y" → "charizard-megax/y"（Showdown はハイフンなし）
  const megaXY = s.match(/^mega (.+) (x|y)$/);
  if (megaXY) return `${megaXY[1].replace(/ /g, '')}-mega${megaXY[2]}`;

  // "Mega Lopunny" → "lopunny-mega"
  const mega = s.match(/^mega (.+)$/);
  if (mega) return `${mega[1].replace(/ /g, '')}-mega`;

  // リージョンフォルム
  const alolan   = s.match(/^alolan (.+)$/);
  if (alolan)   return `${alolan[1].replace(/ /g, '')}-alola`;

  const galarian = s.match(/^galarian (.+)$/);
  if (galarian) return `${galarian[1].replace(/ /g, '')}-galar`;

  const hisuian  = s.match(/^hisuian (.+)$/);
  if (hisuian)  return `${hisuian[1].replace(/ /g, '')}-hisui`;

  const paldean  = s.match(/^paldean (.+)$/);
  if (paldean)  return `${paldean[1].replace(/ /g, '')}-paldea`;

  return s.replace(/ /g, '');
}

// メインスプライット（Showdown）
export function getSpriteUrl(name: string): string {
  return `${SHOWDOWN}/${toSlug(name)}.png`;
}

// Showdown に存在しない場合のフォールバック（PokeAPI dexNumber ベース）
export function getFallbackSpriteUrl(dexNumber: number): string {
  return `${POKEAPI}/${dexNumber}.png`;
}

// メガ名（"Mega Raichu X" 等）から先頭"Mega "と末尾" X"/" Y"を外したベース種名を得る。
// 独自メガは Showdown に絵が無いため、ベース種スプライトへフォールバックする用途。
export function getBaseSpriteFromName(name: string): string {
  const base = name.replace(/^Mega\s+/i, '').replace(/\s+(X|Y)$/i, '');
  return getSpriteUrl(base);
}

// メガシンカの公式アート（Serebii）。Showdown gen5 にはチャンピオンズ独自メガの絵が無いため、
// メガは dexNumber ベースで Serebii アートを使う。語尾 " X"/" Y" は -mx/-my。
export function getMegaSpriteUrl(dexNumber: number, megaFormName: string): string {
  const pad = String(dexNumber).padStart(3, '0');
  const suffix = / X$/.test(megaFormName) ? '-mx' : / Y$/.test(megaFormName) ? '-my' : '-m';
  return `https://www.serebii.net/pokemon/art/${pad}${suffix}.png`;
}

// 持ち物アイコン（PokeAPI item スプライト）。英語名 → スラッグ変換。
// 集約アイテム（TypeBoost/ResistBerry）や「なし」は実物が無いので '' を返す。
// 一部（heavy-duty-boots 等）は404のため、表示側は onError でアイコンを隠すこと。
const POKEAPI_ITEMS = 'https://raw.githubusercontent.com/PokeAPI/sprites/master/sprites/items';
// PokeAPI に無い道具アイコンの個別差し替え（読み込み失敗時は表示側で自動非表示）
const ITEM_ICON_OVERRIDES: Record<string, string> = {
  'Fairy Feather': 'https://www.serebii.net/itemdex/sprites/fairyfeather.png',
};
export function getItemSpriteUrl(en: string): string {
  if (!en || en === 'TypeBoost' || en === 'ResistBerry') return '';
  if (ITEM_ICON_OVERRIDES[en]) return ITEM_ICON_OVERRIDES[en];
  const slug = en.toLowerCase().replace(/['.]/g, '').replace(/\s+/g, '-');
  return `${POKEAPI_ITEMS}/${slug}.png`;
}

// キーストーン（メガシンカ共通の目印アイコン）。ポケモン非依存なので独自メガにも使える。
export const KEY_STONE_ICON = `${POKEAPI_ITEMS}/key-stone.png`;
