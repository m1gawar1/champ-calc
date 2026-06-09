// pokedex.dbとPokeAPIからポケモン・技の日本語名マッピングJSONを生成
import { DatabaseSync } from 'node:sqlite';
import { writeFileSync, mkdirSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { dirname, join } from 'node:path';

const __dirname = dirname(fileURLToPath(import.meta.url));
const DB_PATH = 'C:\\Users\\Owner\\Documents\\My Data Sources\\Pokemon\\pokecham\\pokedex\\pokedex.db';
const OUT_DIR = join(__dirname, '../src/data');
const CHAMPIONS_BASE = 'https://raw.githubusercontent.com/otterlyclueless/pokemon-champions-data/main';

mkdirSync(OUT_DIR, { recursive: true });

async function fetchJson(url) {
  const res = await fetch(url);
  if (!res.ok) throw new Error(`fetch failed: ${url} (${res.status})`);
  return res.json();
}

// =====================
// 1. ポケモン名マッピング（pokedex.db）
// =====================
console.log('=== ポケモン名マッピング生成 ===');
const db = new DatabaseSync(DB_PATH);

const engRows = db.prepare(
  "SELECT globalNo, COALESCE(form,'') as form, COALESCE(region,'') as region, COALESCE(mega_evolution,'') as mega, name FROM pokedex_name WHERE language='eng'"
).all();

const jpnRows = db.prepare(
  "SELECT globalNo, COALESCE(form,'') as form, COALESCE(region,'') as region, COALESCE(mega_evolution,'') as mega, name FROM pokedex_name WHERE language='jpn'"
).all();

function pKey(r) { return `${r.globalNo}|${r.form}|${r.region}|${r.mega}`; }
const jpnPokemonMap = new Map(jpnRows.map(r => [pKey(r), r.name]));

const pokemonNameMap = {};
for (const eng of engRows) {
  const jpn = jpnPokemonMap.get(pKey(eng));
  if (jpn) pokemonNameMap[eng.name] = jpn;
}
console.log(`ポケモン名マッピング: ${Object.keys(pokemonNameMap).length}件`);

// メガシンカ名追加（"Mega Venusaur" → "メガフシギバナ"）
for (const [en, ja] of Object.entries(pokemonNameMap)) {
  if (!en.startsWith('Mega ')) continue;
  // すでにあればスキップ
}

writeFileSync(join(OUT_DIR, 'pokemon-ja.json'), JSON.stringify(pokemonNameMap, null, 2));
console.log('pokemon-ja.json 生成完了');

// =====================
// 2. 技名マッピング（PokeAPI）
// =====================
console.log('\n=== 技名マッピング生成（PokeAPI） ===');

const movesData = await fetchJson(`${CHAMPIONS_BASE}/moves/moves.json`);
const targetMoves = movesData.filter(m => m.inChampions !== false);
console.log(`対象技数: ${targetMoves.length}`);

async function getMoveJaName(moveName) {
  // PokeAPI slug: 小文字・スペースをハイフン・特殊文字除去
  const slug = moveName
    .toLowerCase()
    .replace(/['']/g, '')       // アポストロフィ除去
    .replace(/\s+/g, '-')       // スペース→ハイフン
    .replace(/[^a-z0-9-]/g, ''); // それ以外除去
  try {
    const data = await fetchJson(`https://pokeapi.co/api/v2/move/${slug}/`);
    const ja = data.names.find(n => n.language.name === 'ja-Hrkt')
            ?? data.names.find(n => n.language.name === 'ja');
    return ja?.name ?? null;
  } catch {
    return null;
  }
}

const moveNameMap = {};
const BATCH = 15;
const failed = [];

for (let i = 0; i < targetMoves.length; i += BATCH) {
  const batch = targetMoves.slice(i, i + BATCH);
  const results = await Promise.all(
    batch.map(async (m) => ({ en: m.name, ja: await getMoveJaName(m.name) }))
  );
  for (const { en, ja } of results) {
    if (ja) moveNameMap[en] = ja;
    else failed.push(en);
  }
  process.stdout.write(`\r  進行: ${Math.min(i + BATCH, targetMoves.length)}/${targetMoves.length}`);
  await new Promise(r => setTimeout(r, 150));
}

console.log(`\n技名マッピング: ${Object.keys(moveNameMap).length}件 / 失敗: ${failed.length}件`);
if (failed.length > 0) console.log('未変換:', failed.slice(0, 20));

writeFileSync(join(OUT_DIR, 'moves-ja.json'), JSON.stringify(moveNameMap, null, 2));
console.log('moves-ja.json 生成完了');
