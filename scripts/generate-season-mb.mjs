// Regulation M-B 追加ポケモンのデータを PokeAPI から取得して season-mb.json を生成する
import { writeFileSync, mkdirSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { dirname, join } from 'node:path';

const __dirname = dirname(fileURLToPath(import.meta.url));
const OUT_DIR = join(__dirname, '../src/data');
const POKEAPI = 'https://pokeapi.co/api/v2';

mkdirSync(OUT_DIR, { recursive: true });

// --- 対象スラッグ ---

// 通常種 22体（チャンピオンズ独自メガは含まない）
// Pyroar は PokeAPI で `pyroar-male` というスラッグになっている
const NORMAL_SLUGS = [
  'vileplume', 'qwilfish', 'sceptile', 'blaziken', 'swampert',
  'mawile', 'metagross', 'staraptor', 'musharna', 'scolipede',
  'scrafty', 'eelektross', 'pyroar-male', 'malamar', 'barbaracle',
  'dragalge', 'grimmsnarl', 'falinks', 'overqwil', 'houndstone',
  'annihilape', 'gholdengo',
];

// スラッグがフォーム付き（pyroar-male 等）の場合、表示名をスラッグから直接計算できない
// PokeAPI species の英語名で上書きするスラッグのセット
const FETCH_SPECIES_FOR_NAME = new Set(['pyroar-male']);

// 実在メガ 5体（PokeAPI slug）
const MEGA_SLUGS = [
  'sceptile-mega', 'blaziken-mega', 'swampert-mega', 'mawile-mega', 'metagross-mega',
];

// --- ユーティリティ ---

async function fetchJson(url) {
  const res = await fetch(url);
  if (!res.ok) throw new Error(`fetch failed: ${url} (${res.status})`);
  return res.json();
}

function sleep(ms) {
  return new Promise(r => setTimeout(r, ms));
}

function capitalize(s) {
  return s.charAt(0).toUpperCase() + s.slice(1);
}

// タイプスラッグ（lowercase）→ 表示名（Title Case, 単語）
function typeSlugToName(slug) {
  return capitalize(slug);
}

// 特性スラッグ→英語表示名のキャッシュ
const abilityNameCache = new Map();

async function getAbilityEnName(abilitySlug) {
  if (abilityNameCache.has(abilitySlug)) return abilityNameCache.get(abilitySlug);
  try {
    const data = await fetchJson(`${POKEAPI}/ability/${abilitySlug}/`);
    // PokeAPI は 'en' で英語名を持つ
    const enEntry = data.names.find(n => n.language.name === 'en');
    const name = enEntry?.name ?? capitalize(abilitySlug.replace(/-/g, ' '));
    abilityNameCache.set(abilitySlug, name);
    await sleep(80); // レート制限対策
    return name;
  } catch (e) {
    console.warn(`  ⚠ ability fetch failed: ${abilitySlug} → ${e.message}`);
    const fallback = capitalize(abilitySlug.replace(/-/g, ' '));
    abilityNameCache.set(abilitySlug, fallback);
    return fallback;
  }
}

// pokemon.abilities 配列 → { "0": "Blaze", "H": "Speed Boost" } 形式に変換
// slot 1(非hidden)→"0", slot 2(非hidden)→"1", is_hidden=true→"H"
async function buildAbilities(pokemonAbilities) {
  const abilities = {};
  for (const ab of pokemonAbilities) {
    const key = ab.is_hidden ? 'H' : String(ab.slot - 1);
    abilities[key] = await getAbilityEnName(ab.ability.name);
  }
  return abilities;
}

// pokemon.stats 配列 → { hp, atk, def, spa, spd, spe } に変換
function parseStats(statsArray) {
  const map = {};
  for (const s of statsArray) map[s.stat.name] = s.base_stat;
  return {
    hp: map['hp'],
    atk: map['attack'],
    def: map['defense'],
    spa: map['special-attack'],
    spd: map['special-defense'],
    spe: map['speed'],
  };
}

// --- メイン処理 ---

const roster = [];
const baseStats = [];
const failed = [];

// 通常種の処理
console.log('=== 通常種 処理 ===');
for (const slug of NORMAL_SLUGS) {
  process.stdout.write(`  ${slug} ... `);
  try {
    const pokemon = await fetchJson(`${POKEAPI}/pokemon/${slug}/`);

    const dexNumber = pokemon.id; // 通常種は pokemon.id = 全国図鑑番号
    // pokemon.name はスラッグ形式。フォーム付きスラッグ（pyroar-male等）は
    // species の英語名を取得して使う。それ以外は先頭大文字化で変換。
    let name;
    if (FETCH_SPECIES_FOR_NAME.has(slug)) {
      const species = await fetchJson(pokemon.species.url);
      name = species.names.find(n => n.language.name === 'en')?.name
        ?? capitalize(species.name);
      await sleep(100);
    } else {
      name = capitalize(pokemon.name);
    }

    const types = pokemon.types
      .sort((a, b) => a.slot - b.slot)
      .map(t => typeSlugToName(t.type.name));

    const abilities = await buildAbilities(pokemon.abilities);

    const { hp, atk, def, spa, spd, spe } = parseStats(pokemon.stats);
    const total = hp + atk + def + spa + spd + spe;

    roster.push({ name, dexNumber, types, form: 'Base', abilities, championsVerified: false });
    baseStats.push({ name, dexNumber, form: 'Base', hp, atk, def, spa, spd, spe, total, championsVerified: false });

    console.log(`OK (#${dexNumber} ${name}, types=${types.join('/')}, total=${total})`);
    await sleep(150);
  } catch (e) {
    console.log(`FAILED: ${e.message}`);
    failed.push(slug);
  }
}

// 実在メガの処理
console.log('\n=== 実在メガ 処理 ===');
for (const megaSlug of MEGA_SLUGS) {
  process.stdout.write(`  ${megaSlug} ... `);
  try {
    const pokemon = await fetchJson(`${POKEAPI}/pokemon/${megaSlug}/`);

    // ベース種の全国図鑑番号と英語名は species から取得
    const species = await fetchJson(pokemon.species.url);
    await sleep(100);

    const dexNumber = species.pokedex_numbers
      .find(p => p.pokedex.name === 'national')?.entry_number;
    if (!dexNumber) throw new Error('national dex number not found');

    // species.names から英語表示名を取得してメガ名を構築
    const baseEnName = species.names.find(n => n.language.name === 'en')?.name
      ?? capitalize(species.name);
    const megaName = `Mega ${baseEnName}`;

    const types = pokemon.types
      .sort((a, b) => a.slot - b.slot)
      .map(t => typeSlugToName(t.type.name));

    const abilities = await buildAbilities(pokemon.abilities);

    const { hp, atk, def, spa, spd, spe } = parseStats(pokemon.stats);
    const total = hp + atk + def + spa + spd + spe;

    roster.push({ name: megaName, dexNumber, types, form: 'Mega', abilities, championsVerified: false });
    baseStats.push({ name: megaName, dexNumber, form: 'Mega', hp, atk, def, spa, spd, spe, total, championsVerified: false });

    console.log(`OK (#${dexNumber} ${megaName}, types=${types.join('/')}, total=${total})`);
    await sleep(150);
  } catch (e) {
    console.log(`FAILED: ${e.message}`);
    failed.push(megaSlug);
  }
}

// --- 出力 ---
const output = { roster, baseStats };
writeFileSync(
  join(OUT_DIR, 'season-mb.json'),
  JSON.stringify(output, null, 2),
  'utf-8',
);

console.log(`\n=== 完了 ===`);
console.log(`roster   : ${roster.length} 件`);
console.log(`baseStats: ${baseStats.length} 件`);
if (failed.length > 0) {
  console.log(`失敗: ${failed.join(', ')}`);
} else {
  console.log('失敗: なし');
}
