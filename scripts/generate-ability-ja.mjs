// Champions roster から全特性を収集し、PokeAPI で日本語名マッピングを生成
import { writeFileSync, mkdirSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { dirname, join } from 'node:path';

const __dirname = dirname(fileURLToPath(import.meta.url));
const CHAMPIONS_BASE = 'https://raw.githubusercontent.com/otterlyclueless/pokemon-champions-data/main';
const OUT_DIR = join(__dirname, '../src/data');

mkdirSync(OUT_DIR, { recursive: true });

async function fetchJson(url) {
  const res = await fetch(url);
  if (!res.ok) throw new Error(`${url}: ${res.status}`);
  return res.json();
}

// Champions roster から全特性名を収集
const roster = await fetchJson(`${CHAMPIONS_BASE}/pokemon/roster.json`);
const abilitySet = new Set();
for (const p of roster) {
  if (p.abilities) {
    for (const v of Object.values(p.abilities)) {
      if (v) abilitySet.add(v);
    }
  }
}
const abilities = [...abilitySet].sort();
console.log(`対象特性数: ${abilities.length}`);

// PokeAPI から日本語名取得
async function getAbilityJaName(abilityEn) {
  const slug = abilityEn.toLowerCase().replace(/['']/g, '').replace(/\s+/g, '-').replace(/[^a-z0-9-]/g, '');
  try {
    const data = await fetchJson(`https://pokeapi.co/api/v2/ability/${slug}/`);
    const ja = data.names.find(n => n.language.name === 'ja-Hrkt')
            ?? data.names.find(n => n.language.name === 'ja');
    return ja?.name ?? null;
  } catch {
    return null;
  }
}

const mapping = {};
const failed = [];
const BATCH = 10;

for (let i = 0; i < abilities.length; i += BATCH) {
  const batch = abilities.slice(i, i + BATCH);
  const results = await Promise.all(batch.map(async en => ({ en, ja: await getAbilityJaName(en) })));
  for (const { en, ja } of results) {
    if (ja) mapping[en] = ja;
    else failed.push(en);
  }
  process.stdout.write(`\r  進行: ${Math.min(i + BATCH, abilities.length)}/${abilities.length}`);
  await new Promise(r => setTimeout(r, 150));
}

console.log(`\n特性マッピング: ${Object.keys(mapping).length}件 / 失敗: ${failed.length}件`);
if (failed.length > 0) console.log('未変換:', failed);

writeFileSync(join(OUT_DIR, 'ability-ja.json'), JSON.stringify(mapping, null, 2));
console.log('ability-ja.json 生成完了');
