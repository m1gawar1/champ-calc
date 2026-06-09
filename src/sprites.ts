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
