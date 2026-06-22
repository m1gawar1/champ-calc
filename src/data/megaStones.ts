// メガシンカ → 対応メガストーン（英名=スプライト/キー用、日本語名=表示用）。
// キーはロスターのメガフォーム名（例: "Mega Charizard X"）。
// 公式メガのみ収録。Champions独自メガ（メガストラアプティ等）は公式ストーンが無いため未収録。

export interface MegaStone { en: string; ja: string }

export const MEGA_STONES: Record<string, MegaStone> = {
  'Mega Venusaur':    { en: 'Venusaurite',   ja: 'フシギバナナイト' },
  'Mega Charizard X': { en: 'Charizardite X', ja: 'リザードナイトX' },
  'Mega Charizard Y': { en: 'Charizardite Y', ja: 'リザードナイトY' },
  'Mega Blastoise':   { en: 'Blastoisinite', ja: 'カメックスナイト' },
  'Mega Beedrill':    { en: 'Beedrillite',   ja: 'スピアナイト' },
  'Mega Pidgeot':     { en: 'Pidgeotite',    ja: 'ピジョットナイト' },
  'Mega Alakazam':    { en: 'Alakazite',     ja: 'フーディナイト' },
  'Mega Slowbro':     { en: 'Slowbronite',   ja: 'ヤドランナイト' },
  'Mega Gengar':      { en: 'Gengarite',     ja: 'ゲンガナイト' },
  'Mega Kangaskhan':  { en: 'Kangaskhanite', ja: 'ガルーラナイト' },
  'Mega Pinsir':      { en: 'Pinsirite',     ja: 'カイロスナイト' },
  'Mega Gyarados':    { en: 'Gyaradosite',   ja: 'ギャラドスナイト' },
  'Mega Aerodactyl':  { en: 'Aerodactylite', ja: 'プテラナイト' },
  'Mega Mewtwo X':    { en: 'Mewtwonite X',  ja: 'ミュウツナイトX' },
  'Mega Mewtwo Y':    { en: 'Mewtwonite Y',  ja: 'ミュウツナイトY' },
  'Mega Ampharos':    { en: 'Ampharosite',   ja: 'デンリュウナイト' },
  'Mega Steelix':     { en: 'Steelixite',    ja: 'ハガネールナイト' },
  'Mega Scizor':      { en: 'Scizorite',     ja: 'ハッサムナイト' },
  'Mega Heracross':   { en: 'Heracronite',   ja: 'ヘラクロスナイト' },
  'Mega Houndoom':    { en: 'Houndoominite', ja: 'ヘルガナイト' },
  'Mega Tyranitar':   { en: 'Tyranitarite',  ja: 'バンギラスナイト' },
  'Mega Sceptile':    { en: 'Sceptilite',    ja: 'ジュカインナイト' },
  'Mega Blaziken':    { en: 'Blazikenite',   ja: 'バシャーモナイト' },
  'Mega Swampert':    { en: 'Swampertite',   ja: 'ラグラージナイト' },
  'Mega Gardevoir':   { en: 'Gardevoirite',  ja: 'サーナイトナイト' },
  'Mega Sableye':     { en: 'Sablenite',     ja: 'ヤミラミナイト' },
  'Mega Mawile':      { en: 'Mawilite',      ja: 'クチートナイト' },
  'Mega Aggron':      { en: 'Aggronite',     ja: 'ボスゴドラナイト' },
  'Mega Medicham':    { en: 'Medichamite',   ja: 'チャーレムナイト' },
  'Mega Manectric':   { en: 'Manectite',     ja: 'ライボルトナイト' },
  'Mega Sharpedo':    { en: 'Sharpedonite',  ja: 'サメハダナイト' },
  'Mega Camerupt':    { en: 'Cameruptite',   ja: 'バクーダナイト' },
  'Mega Altaria':     { en: 'Altarianite',   ja: 'チルタリスナイト' },
  'Mega Banette':     { en: 'Banettite',     ja: 'ジュペッタナイト' },
  'Mega Absol':       { en: 'Absolite',      ja: 'アブソルナイト' },
  'Mega Glalie':      { en: 'Glalitite',     ja: 'オニゴーリナイト' },
  'Mega Salamence':   { en: 'Salamencite',   ja: 'ボーマンダナイト' },
  'Mega Metagross':   { en: 'Metagrossite',  ja: 'メタグロスナイト' },
  'Mega Latias':      { en: 'Latiasite',     ja: 'ラティアスナイト' },
  'Mega Latios':      { en: 'Latiosite',     ja: 'ラティオスナイト' },
  'Mega Lopunny':     { en: 'Lopunnite',     ja: 'ミミロップナイト' },
  'Mega Garchomp':    { en: 'Garchompite',   ja: 'ガブリアスナイト' },
  'Mega Lucario':     { en: 'Lucarionite',   ja: 'ルカリオナイト' },
  'Mega Abomasnow':   { en: 'Abomasite',     ja: 'ユキノオーナイト' },
  'Mega Gallade':     { en: 'Galladite',     ja: 'エルレイドナイト' },
  'Mega Audino':      { en: 'Audinite',      ja: 'タブンネナイト' },
  'Mega Diancie':     { en: 'Diancite',      ja: 'ディアンシーナイト' },
};

// メガフォーム名から対応ストーンを取得（無ければ null）
export function getMegaStone(formName: string): MegaStone | null {
  return MEGA_STONES[formName] ?? null;
}

// メガフォーム名から表示用ラベルを取得。
// 公式メガは対応ストーン名、Champions独自メガ（公式ストーン無し）は汎用プレースホルダを返す。
// en が空文字なら「実体のあるメガストーンは無い（独自メガ）」を意味する。
export function getMegaStoneLabel(formName: string): MegaStone {
  return MEGA_STONES[formName] ?? { en: '', ja: 'メガストーン' };
}
