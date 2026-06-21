// 競技用持ち物・特性のリストと日本語名定義

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

// パーティ/ボックス編集用の「名前だけ」の全持ち物リスト（管理用・効果はダメ計に反映しない）。
// ダメージ系（COMPETITIVE_ITEMS）＋対戦でよく使う一般道具を列挙する。
const GENERAL_ITEMS: CompetitiveItem[] = [
  { en: 'Leftovers',         ja: 'たべのこし' },
  { en: 'Sitrus Berry',      ja: 'オボンのみ' },
  { en: 'Focus Sash',        ja: 'きあいのタスキ' },
  { en: 'Lum Berry',         ja: 'ラムのみ' },
  { en: 'Eviolite',          ja: 'しんかのきせき' },
  { en: 'Assault Vest',      ja: 'とつげきチョッキ' },
  { en: 'Choice Band',       ja: 'こだわりハチマキ' },
  { en: 'Choice Scarf',      ja: 'こだわりスカーフ' },
  { en: 'Choice Specs',      ja: 'こだわりメガネ' },
  { en: 'Rocky Helmet',      ja: 'ゴツゴツメット' },
  { en: 'Heavy-Duty Boots',  ja: 'あつぞこブーツ' },
  { en: 'Light Clay',        ja: 'ひかりのねんど' },
  { en: 'Mental Herb',       ja: 'メンタルハーブ' },
  { en: 'White Herb',        ja: 'しろいハーブ' },
  { en: 'Power Herb',        ja: 'パワフルハーブ' },
  { en: 'Eject Button',      ja: 'だっしゅつボタン' },
  { en: 'Red Card',          ja: 'レッドカード' },
  { en: 'Safety Goggles',    ja: 'ぼうじんゴーグル' },
  { en: 'Protective Pads',   ja: 'ぼうごパッド' },
  { en: 'Clear Amulet',      ja: 'クリアチャーム' },
  { en: 'Booster Energy',    ja: 'ブーストエナジー' },
  { en: 'Covert Cloak',      ja: 'おんみつマント' },
  { en: 'Loaded Dice',       ja: 'いかさまダイス' },
  { en: 'Wide Lens',         ja: 'こうかくレンズ' },
  { en: 'Scope Lens',        ja: 'ピントレンズ' },
  { en: 'Quick Claw',        ja: 'せんせいのツメ' },
  { en: "King's Rock",       ja: 'おうじゃのしるし' },
  { en: 'Razor Claw',        ja: 'するどいツメ' },
  { en: 'Bright Powder',     ja: 'ひかりのこな' },
  { en: 'Weakness Policy',   ja: 'じゃくてんほけん' },
  { en: 'Throat Spray',      ja: 'のどスプレー' },
  { en: 'Air Balloon',       ja: 'ふうせん' },
  { en: 'Mirror Herb',       ja: 'ものまねハーブ' },
  { en: 'Ability Shield',    ja: 'とくせいガード' },
  { en: 'Toxic Orb',         ja: 'どくどくだま' },
  { en: 'Flame Orb',         ja: 'かえんだま' },
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
export function getItemItems(): { label: string; value: string }[] {
  return COMPETITIVE_ITEMS.map(item => ({
    value: item.en === 'No Item' ? '' : item.en,
    label: item.ja + (item.note ? ` (${item.note})` : ''),
  }));
}

// パーティ/ボックス編集用の全持ち物リスト（名前のみ・管理用）。
// ダメージ系（noteあり）＋一般道具を結合し、英名重複は除外する。
export function getAllItemItems(): { label: string; value: string }[] {
  const seen = new Set<string>();
  const out: { label: string; value: string }[] = [];
  for (const item of [...COMPETITIVE_ITEMS, ...GENERAL_ITEMS]) {
    const value = item.en === 'No Item' ? '' : item.en;
    if (seen.has(value)) continue;
    seen.add(value);
    out.push({ value, label: item.ja + (item.note ? ` (${item.note})` : '') });
  }
  return out;
}
