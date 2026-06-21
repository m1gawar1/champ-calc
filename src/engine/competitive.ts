// 競技用持ち物・特性のリストと日本語名定義
import { getItemSpriteUrl } from '../sprites';

export interface CompetitiveItem {
  en: string;
  ja: string;
  note?: string; // 効果メモ（UI表示用）
}

export interface CompetitiveAbility {
  en: string;
  ja: string;
}

// ダメージに影響する持ち物（Pokémon Champions 準拠）
// Champions ではタイプ強化18種・半減きのみ18種が実装され、こだわり系/いのちのたま/
// とつげきチョッキ/しんかのきせき等は未実装。タイプ別アイテムは1つに集約して表示する。
export const COMPETITIVE_ITEMS: CompetitiveItem[] = [
  { en: 'No Item',     ja: 'なし' },
  // タイプ強化アイテム18種を集約（攻撃側・タイプ一致技×1.2）
  { en: 'TypeBoost',   ja: 'タイプ強化アイテム', note: 'タイプ一致技×1.2' },
  // 半減きのみ18種を集約（防御側・受けた該当タイプ×0.5。ノーマル以外は効果抜群時）
  { en: 'ResistBerry', ja: '半減きのみ',         note: '該当タイプ×0.5' },
  // Regulation M-B（2026-06）で追加。全技ダメージ×1.3（エンジンは damage.ts で対応済み）
  { en: 'Life Orb',    ja: 'いのちのたま',       note: '全技×1.3' },
  // 効果抜群の技ダメージ×1.2（エンジンは damage.ts で対応済み）
  { en: 'Expert Belt', ja: 'たつじんのおび',     note: '効果抜群×1.2' },
];

// Pokémon Champions で使用可能な持ち物（オーナー提供の道具一覧画像 2枚＝2026-06-21 に準拠）。
// パーティ/ボックス編集の「名前だけ」の管理用リスト。日本語名は画像どおり。
// en はアイコン（PokeAPI スプライト）とキー用。一部 en は推定（アイコンが無い場合は表示側で自動非表示）。
const CHAMPIONS_ITEMS: CompetitiveItem[] = [
  // ── 画像1（威力・補助系） ──
  { en: 'Wide Lens',       ja: '広角レンズ' },
  { en: 'Life Orb',        ja: 'いのちのたま' },
  { en: 'Light Clay',      ja: 'ひかりのねんど' },
  { en: 'Expert Belt',     ja: 'たつじんのおび' },
  { en: 'Wise Glasses',    ja: 'ものしりメガネ' },
  { en: 'Muscle Band',     ja: 'ちからのハチマキ' },
  { en: 'Icy Rock',        ja: 'つめたいいわ' },
  { en: 'Iron Ball',       ja: 'くろいてっきゅう' },
  { en: 'Metronome',       ja: 'メトロノーム' },
  { en: 'Zoom Lens',       ja: 'フォーカスレンズ' },
  { en: 'Big Root',        ja: 'おおきなねっこ' },
  { en: 'Shed Shell',      ja: 'きれいなぬけがら' },
  { en: 'Damp Rock',       ja: 'しめったいわ' },
  { en: 'Heat Rock',       ja: 'あついいわ' },
  { en: 'Smooth Rock',     ja: 'さらさらいわ' },
  // ── 画像2（汎用・タイプ強化・きのみ） ──
  { en: "King's Rock",     ja: 'おうじゃのしるし' },
  { en: 'Shell Bell',      ja: 'かいがらのすず' },
  { en: 'Hard Stone',      ja: 'かたいいし' },
  { en: 'Focus Sash',      ja: 'きあいのタスキ' },
  { en: 'Focus Band',      ja: 'きあいのハチマキ' },
  { en: 'Miracle Seed',    ja: 'きせきのタネ' },
  { en: 'Silver Powder',   ja: 'ぎんのこな' },
  { en: 'Black Glasses',   ja: 'くろいメガネ' },
  { en: 'Black Belt',      ja: 'くろおび' },
  { en: 'Choice Scarf',    ja: 'こだわりスカーフ' },
  { en: 'Magnet',          ja: 'じしゃく' },
  { en: 'Silk Scarf',      ja: 'シルクのスカーフ' },
  { en: 'White Herb',      ja: 'しろいハーブ' },
  { en: 'Mystic Water',    ja: 'しんぴのしずく' },
  { en: 'Sharp Beak',      ja: 'するどいくちばし' },
  { en: 'Quick Claw',      ja: 'せんせいのツメ' },
  { en: 'Leftovers',       ja: 'たべのこし' },
  { en: 'Light Ball',      ja: 'でんきだま' },
  { en: 'Poison Barb',     ja: 'どくバリ' },
  { en: 'Never-Melt Ice',  ja: 'とけないこおり' },
  { en: 'Spell Tag',       ja: 'のろいのおふだ' },
  { en: 'Bright Powder',   ja: 'ひかりのこな' },
  { en: 'Scope Lens',      ja: 'ピントレンズ' },
  { en: 'Twisted Spoon',   ja: 'まがったスプーン' },
  { en: 'Metal Coat',      ja: 'メタルコート' },
  { en: 'Mental Herb',     ja: 'メンタルハーブ' },
  { en: 'Charcoal',        ja: 'もくたん' },
  { en: 'Soft Sand',       ja: 'やわらかいすな' },
  { en: 'Fairy Feather',   ja: 'ようせいのハネ' },
  { en: 'Dragon Fang',     ja: 'りゅうのキバ' },
  // きのみ（タイプ半減・状態回復・HP回復など）
  { en: 'Passho Berry',    ja: 'イトケのみ' },
  { en: 'Payapa Berry',    ja: 'ウタンのみ' },
  { en: 'Occa Berry',      ja: 'オッカのみ' },
  { en: 'Sitrus Berry',    ja: 'オボンのみ' },
  { en: 'Oran Berry',      ja: 'オレンのみ' },
  { en: 'Chesto Berry',    ja: 'カゴのみ' },
  { en: 'Kasib Berry',     ja: 'カシブのみ' },
  { en: 'Persim Berry',    ja: 'キーのみ' },
  { en: 'Cheri Berry',     ja: 'クラボのみ' },
  { en: 'Shuca Berry',     ja: 'シュカのみ' },
  { en: 'Wacan Berry',     ja: 'ソクのみ' },
  { en: 'Tanga Berry',     ja: 'タンガのみ' },
  { en: 'Rawst Berry',     ja: 'チーゴのみ' },
  { en: 'Babiri Berry',    ja: 'ナナシのみ' },
  { en: 'Colbur Berry',    ja: 'ナモのみ' },
  { en: 'Kebia Berry',     ja: 'バコウのみ' },
  { en: 'Haban Berry',     ja: 'ハバンのみ' },
  { en: 'Chilan Berry',    ja: 'ビアーのみ' },
  { en: 'Leppa Berry',     ja: 'ヒメリのみ' },
  { en: 'Charti Berry',    ja: 'ホズのみ' },
  { en: 'Pecha Berry',     ja: 'モモンのみ' },
  { en: 'Yache Berry',     ja: 'ヤチェのみ' },
  { en: 'Chople Berry',    ja: 'ヨプのみ' },
  { en: 'Coba Berry',      ja: 'ヨロギのみ' },
  { en: 'Lum Berry',       ja: 'ラムのみ' },
  { en: 'Rowap Berry',     ja: 'リリバのみ' },
  { en: 'Rindo Berry',     ja: 'リンドのみ' },
  { en: 'Roseli Berry',    ja: 'ロゼルのみ' },
];

// タイプ強化アイテム（英語名 → タイプ）
export const TYPE_BOOST_ITEMS: Record<string, string> = {
  Charcoal: 'Fire', 'Mystic Water': 'Water', Magnet: 'Electric',
  'Miracle Seed': 'Grass', "Never-Melt Ice": 'Ice', 'Black Belt': 'Fighting',
  'Poison Barb': 'Poison', 'Soft Sand': 'Ground', 'Sharp Beak': 'Flying',
  'Twisted Spoon': 'Psychic', 'Silver Powder': 'Bug', 'Hard Stone': 'Rock',
  'Spell Tag': 'Ghost', 'Dragon Fang': 'Dragon', 'Black Glasses': 'Dark',
  'Metal Coat': 'Steel',
  'Flame Plate': 'Fire', 'Splash Plate': 'Water', 'Zap Plate': 'Electric',
  'Meadow Plate': 'Grass', 'Icicle Plate': 'Ice', 'Fist Plate': 'Fighting',
  'Toxic Plate': 'Poison', 'Earth Plate': 'Ground', 'Sky Plate': 'Flying',
  'Mind Plate': 'Psychic', 'Insect Plate': 'Bug', 'Stone Plate': 'Rock',
  'Spooky Plate': 'Ghost', 'Draco Plate': 'Dragon', 'Dread Plate': 'Dark',
  'Iron Plate': 'Steel', 'Pixie Plate': 'Fairy',
};

// ダメージに影響する特性（攻撃側・防御側）
export const COMPETITIVE_ABILITIES: CompetitiveAbility[] = [
  // ──── 攻撃側 ────
  { en: 'Adaptability',     ja: 'てきおうりょく' },
  { en: 'Huge Power',       ja: 'ちからもち' },
  { en: 'Pure Power',       ja: 'ヨガパワー' },
  { en: 'Hustle',           ja: 'はりきり' },
  { en: 'Technician',       ja: 'テクニシャン' },
  { en: 'Sheer Force',      ja: 'ちからずく' },
  { en: 'Iron Fist',        ja: 'てつのこぶし' },
  { en: 'Tough Claws',      ja: 'かたいツメ' },
  { en: 'Strong Jaw',       ja: 'がんじょうあご' },
  { en: 'Mega Launcher',    ja: 'メガランチャー' },
  { en: "Dragon's Maw",     ja: 'りゅうのあぎと' },
  { en: 'Transistor',       ja: 'トランジスタ' },
  { en: 'Rocky Payload',    ja: 'がんじょうおもし' },
  { en: 'Punk Rock',        ja: 'パンクロック' },
  { en: 'Reckless',         ja: 'すてみ' },
  { en: 'Sand Force',       ja: 'すなのちから' },
  { en: 'Flash Fire',       ja: 'もらいび' },
  { en: 'Guts',             ja: 'こんじょう' },
  { en: 'Overgrow',         ja: 'しんりょく' },
  { en: 'Blaze',            ja: 'もうか' },
  { en: 'Torrent',          ja: 'げきりゅう' },
  { en: 'Swarm',            ja: 'むしのしらせ' },
  // ──── 防御側 ────
  { en: 'Multiscale',       ja: 'マルチスケイル' },
  { en: 'Shadow Shield',    ja: 'シャドーシールド' },
  { en: 'Thick Fat',        ja: 'あついしぼう' },
  { en: 'Filter',           ja: 'フィルター' },
  { en: 'Solid Rock',       ja: 'ハードロック' },
  { en: 'Prism Armor',      ja: 'プリズムアーマー' },
  { en: 'Fluffy',           ja: 'もふもふ' },
  { en: 'Ice Scales',       ja: 'こおりのりんぷん' },
  { en: 'Wonder Guard',     ja: 'ふしぎなまもり' },
  { en: 'Levitate',         ja: 'ふゆう' },
  { en: 'Water Absorb',     ja: 'ちょすい' },
  { en: 'Volt Absorb',      ja: 'ちくでん' },
  { en: 'Lightning Rod',    ja: 'ひらいしん' },
  { en: 'Storm Drain',      ja: 'よびみず' },
  { en: 'Flash Fire',       ja: 'もらいび' },
  { en: 'Sap Sipper',       ja: 'そうしょく' },
  { en: 'Motor Drive',      ja: 'でんきエンジン' },
];

// UIで特性選択リストを生成（ポケモンの持てる特性）
// 日本語名は i18n の ABILITY_JA（ability-ja.json）を使う
import { ABILITY_JA } from '../i18n';
export { ABILITY_JA };

export function getAbilityItems(pokemonAbilities: Record<string, string>): { label: string; value: string }[] {
  const items: { label: string; value: string }[] = [{ label: 'なし', value: '' }];
  for (const [, abilityEn] of Object.entries(pokemonAbilities)) {
    if (abilityEn && !items.some(i => i.value === abilityEn)) {
      items.push({ label: ABILITY_JA[abilityEn] ?? abilityEn, value: abilityEn });
    }
  }
  return items;
}

// UIで持ち物選択リストを生成（ダメ計用・ダメージ系のみ）
export function getItemItems(): { label: string; value: string; icon: string }[] {
  return COMPETITIVE_ITEMS.map(item => {
    const value = item.en === 'No Item' ? '' : item.en;
    return {
      value,
      label: item.ja + (item.note ? ` (${item.note})` : ''),
      icon: getItemSpriteUrl(value),
    };
  });
}

// パーティ/ボックス編集用の全持ち物リスト（名前のみ・管理用）。
// Champions で使える道具（CHAMPIONS_ITEMS）を「なし」付きで返す。
export function getAllItemItems(): { label: string; value: string; icon: string }[] {
  const out: { label: string; value: string; icon: string }[] = [
    { value: '', label: 'なし', icon: '' },
  ];
  for (const item of CHAMPIONS_ITEMS) {
    out.push({ value: item.en, label: item.ja, icon: getItemSpriteUrl(item.en) });
  }
  return out;
}
