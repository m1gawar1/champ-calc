// MB追加ポケモンの覚え技マッピングを PokeAPI から生成し season-mb-learnsets.json を出力する。
// 上流 learnsets.json は MB 追加ポケモン（season-mb.json のベース種）を未収録のため、
// 覚え技フィルタONで「データなし」になる。これを補完する。
//
// 方針:
//   - 技名は PokeAPI のスラッグ → Champions moves.json の英語名へ逆引き（英語ネイティブで変換ロス無し）
//   - version_group 'scarlet-violet' の技を優先。SV未収録（DLC外のGen5/6等）の場合は全世代の和集合で代替
//   - メガ（"Mega ..."）は data.ts 側でベース種から継承するためここでは生成しない
//
// 実行: node app/scripts/generate-mb-learnsets.mjs
import { writeFileSync, readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { dirname, join } from 'node:path';

const __dirname = dirname(fileURLToPath(import.meta.url));
const DATA_DIR = join(__dirname, '../src/data');
const CHAMPIONS_BASE = 'https://raw.githubusercontent.com/otterlyclueless/pokemon-champions-data/main';

// Champions の英語技名 → PokeAPI スラッグ規則（generate-ja-names.mjs と同じ）
function slug(en) {
  return en.toLowerCase().replace(/['’]/g, '').replace(/\s+/g, '-').replace(/[^a-z0-9-]/g, '');
}

async function getJson(url, tries = 5) {
  for (let i = 0; i < tries; i++) {
    try { const r = await fetch(url); if (r.ok) return await r.json(); } catch { /* retry */ }
    await new Promise(r => setTimeout(r, 400));
  }
  throw new Error(`fetch failed: ${url}`);
}

const mb = JSON.parse(readFileSync(join(DATA_DIR, 'season-mb.json'), 'utf-8'));
const moves = await getJson(`${CHAMPIONS_BASE}/moves/moves.json`);
const slug2en = {};
for (const m of moves) slug2en[slug(m.name)] = m.name;

// ベース種のみ（メガは data.ts で継承）。dexNumber を ID フォールバックに使う。
const bases = mb.roster.filter(r => !r.name.startsWith('Mega '));
const out = {};
for (const r of bases) {
  const name = r.name;
  let d;
  try {
    d = await getJson(`https://pokeapi.co/api/v2/pokemon/${slug(name)}/`);
  } catch {
    // 名前で引けない場合は dexNumber で再試行（Pyroar 等の取りこぼし対策）
    d = await getJson(`https://pokeapi.co/api/v2/pokemon/${r.dexNumber}/`);
  }
  const sv = new Set(), all = new Set();
  for (const mv of d.moves) {
    all.add(mv.move.name);
    if (mv.version_group_details.some(v => v.version_group.name === 'scarlet-violet')) sv.add(mv.move.name);
  }
  const src = sv.size > 0 ? sv : all; // SV技が無ければ全世代和集合
  const uniq = [...new Set([...src].map(s => slug2en[s]).filter(Boolean))].sort();
  out[name] = { moves: uniq.map(m => ({ name: m })) };
  console.log(`${name.padEnd(12)} ${sv.size > 0 ? 'SV' : 'ALL'}=${uniq.length}`);
  await new Promise(r => setTimeout(r, 150));
}

writeFileSync(join(DATA_DIR, 'season-mb-learnsets.json'), JSON.stringify(out, null, 2));
console.log(`season-mb-learnsets.json 生成完了 (${Object.keys(out).length}件)`);
