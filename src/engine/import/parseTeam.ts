// parseTeam.ts
// OCR 結果（カード単位のテキスト行＋座標）から PokemonBuild を組み立てるパーサ。
// 画像処理・OCR には依存しない（テスト可能）。

import type { ChampionsData, PokemonBuild } from '../../types';
import { DEFAULT_IVS } from '../../types';
import type { StatReadings } from './statSolve';
import { solveStats, pickStatReading } from './statSolve';
import type { Candidate, MatchResult } from './match';
import { closestMatch } from './match';
import { displayPokemonName, moveJa, ABILITY_JA } from '../../i18n';
import {
  getSelectableRoster,
  findBaseStats,
  getMegaForms,
  getPokemonLearnset,
} from '../../data';
import { getAllItemItems } from '../competitive';
import { MEGA_STONES } from '../../data/megaStones';

// ── 公開型定義 ─────────────────────────────────────────────────────────────────

/** OCR で読んだ1行ぶんの情報（カード内ローカル座標） */
export interface CardLine {
  text: string;
  x: number; // カード左端からの水平距離（px）
  y: number; // カード上端からの垂直距離（px）
  w: number; // テキストボックス幅
  h: number; // テキストボックス高さ
}

/** 1枚のカードの OCR 結果（lines はカード内ローカル座標ベース） */
export interface CardOcr {
  lines: CardLine[];
}

// ── ユーティリティ ──────────────────────────────────────────────────────────────

/**
 * OCR ラベル前置詞（「特性」「持ち物」等）を除去し値部分だけを残す。
 * 例: "特性 フラワーベール" → "フラワーベール"
 */
function stripLabel(text: string): string {
  return text
    .replace(/^(特性|持ち物|わざ|技|名前|アイテム|どうぐ)\s*/u, '')
    .replace(/^[：:]\s*/u, '')
    .trim();
}

/**
 * テキストから整数を全て抽出（OCR 誤読補正付き）。
 * 補正: O/o → 0、I（大文字）/ l（小文字）→ 1
 */
function extractNumbers(text: string): number[] {
  const corrected = text
    .replace(/[Oo]/g, '0')
    .replace(/[Il]/g, '1');
  const matches = corrected.match(/\d+/g);
  return matches ? matches.map(Number) : [];
}

/**
 * 行リストを左列・右列に分割（x 座標で判定）。
 * 推定カード幅の 45% 未満 → 左列、以上 → 右列。
 * 各列は y 昇順でソート。
 */
function splitColumns(lines: CardLine[]): { left: CardLine[]; right: CardLine[] } {
  if (lines.length === 0) return { left: [], right: [] };
  // カード幅推定: 全行の (x + w) の最大値
  const cardWidth = Math.max(...lines.map(l => l.x + l.w), 1);
  const threshold = cardWidth * 0.45;
  const left  = lines.filter(l => l.x <  threshold).sort((a, b) => a.y - b.y);
  const right = lines.filter(l => l.x >= threshold).sort((a, b) => a.y - b.y);
  return { left, right };
}

// ── メガストーン候補型 ───────────────────────────────────────────────────────────

/** メガストーン候補（Candidate + メガフォーム名） */
interface MegaStoneCandidate extends Candidate {
  megaFormName: string; // 対応メガフォームの英語名（例: "Mega Floette"）
}

// ── 能力カードパーサ ────────────────────────────────────────────────────────────

/** parseAbilityCard の返り値 */
export interface AbilityCardResult {
  rosterName: string;   // 英語種族名
  ability: string;      // 英語特性名
  item: string;         // 英語道具名（Champions独自メガは ''）
  isMega: boolean;
  megaFormName: string; // メガの場合のみ有効（例: "Mega Floette"）
  moves: string[];      // 英語技名（最大4）
}

/**
 * 能力タブ 1 カードを解析し、種族 / 特性 / 持ち物 / 技 を返す。
 *
 * レイアウト想定（座標ベース）:
 *  左列 (x 小) — 上から: 名前 → 特性 → 持ち物
 *  右列 (x 大) — 上から: 技1 → 技2 → 技3 → 技4
 */
export function parseAbilityCard(
  card: CardOcr,
  data: ChampionsData,
): AbilityCardResult {
  const { left, right } = splitColumns(card.lines);

  // ラベル行（stripLabel 後 1 文字以下）を除去し、有効な行だけを使う
  const meaningfulLeft = left.filter(l => stripLabel(l.text).length >= 2);

  // ── 名前の確定 ────────────────────────────────────────────────────────────
  const roster = getSelectableRoster(data.roster);
  const nameCandidates: Candidate[] = roster.map(r => ({
    ja: displayPokemonName(r.name),
    value: r.name,
  }));

  const nameText = meaningfulLeft[0] ? stripLabel(meaningfulLeft[0].text) : '';
  let nameMatch: MatchResult | null = closestMatch(nameText, nameCandidates);
  if (!nameMatch) {
    // フォールバック: 左列全行を連結して再試行
    nameMatch = closestMatch(
      meaningfulLeft.map(l => l.text).join(''),
      nameCandidates,
    );
  }
  const rosterName = nameMatch?.value ?? '';

  // ── 特性の確定 ────────────────────────────────────────────────────────────
  const rosterEntry = data.roster.find(r => r.name === rosterName);
  let ability = '';

  if (rosterEntry) {
    const abilityValues = Object.values(rosterEntry.abilities).filter(Boolean);
    const abilityCandidates: Candidate[] = abilityValues.map(en => ({
      ja: ABILITY_JA[en] ?? en,
      value: en,
    }));

    const abilityText = meaningfulLeft[1] ? stripLabel(meaningfulLeft[1].text) : '';
    // 2 行目が低スコアなら 3 行目も試してより良い方を採用
    let abilityMatch = closestMatch(abilityText, abilityCandidates);
    if (meaningfulLeft[2]) {
      const alt = closestMatch(stripLabel(meaningfulLeft[2].text), abilityCandidates);
      if (alt && (!abilityMatch || alt.score > abilityMatch.score)) {
        abilityMatch = alt;
      }
    }
    ability = abilityMatch?.value ?? '';
  }

  // ── 持ち物の確定（メガ判定含む） ──────────────────────────────────────────
  // 通常道具候補: 全チャンピオンズアイテム（「なし」= value:'' を除外）
  const allItems: Candidate[] = getAllItemItems()
    .filter(i => i.value !== '')
    .map(i => ({ ja: i.label, value: i.value }));

  // メガストーン候補: この種族に対応するメガフォームから導出
  const megaForms = rosterName ? getMegaForms(data.baseStats, rosterName) : [];
  const megaStoneCandidates: MegaStoneCandidate[] = megaForms.map(form => {
    const stone = MEGA_STONES[form.name];
    if (stone) {
      // 公式メガストーン
      return { ja: stone.ja, value: stone.en, megaFormName: form.name };
    }
    // Champions 独自メガ（公式ストーン無し）: ベース種日本語名 + 「ナイト」
    // 例: "Mega Floette" → フラエッテ + ナイト = フラエッテナイト
    const baseName = form.name.replace(/^Mega\s+/i, '').replace(/\s+[XY]$/i, '');
    const jaBase = displayPokemonName(baseName);
    // 末尾の長音符「ー」を除去（カイリュー → カイリュナイト 等）
    const stoneName = jaBase.replace(/ー$/, '') + 'ナイト';
    return { ja: stoneName, value: '', megaFormName: form.name };
  });

  const itemText = meaningfulLeft[2] ? stripLabel(meaningfulLeft[2].text) : (
    meaningfulLeft[3] ? stripLabel(meaningfulLeft[3].text) : ''
  );

  let isMega = false;
  let megaFormName = '';
  let item = '';

  // メガストーン候補を優先して試す（閾値を高めに設定）
  if (megaStoneCandidates.length > 0 && itemText) {
    const megaMatch = closestMatch(itemText, megaStoneCandidates, 0.5);
    if (megaMatch) {
      isMega = true;
      const hit = megaStoneCandidates.find(
        c => c.ja === megaMatch.ja && c.value === megaMatch.value,
      );
      megaFormName = hit?.megaFormName ?? '';
      item = megaMatch.value; // 公式メガストーン英語名。独自メガは ''
    }
  }

  if (!isMega && itemText) {
    // 通常道具にマッチ
    const normalMatch = closestMatch(itemText, allItems);
    item = normalMatch?.value ?? '';
  }

  // ── 技の確定 ──────────────────────────────────────────────────────────────
  // 技候補: この種族の learnset（取れない場合は全 Champions 技にフォールバック）
  const learnsetSet = rosterName
    ? getPokemonLearnset(data.learnsets, rosterName)
    : null;

  const moveSourceNames = learnsetSet
    ? [...learnsetSet]
    : data.moves.filter(m => m.inChampions !== false).map(m => m.name);

  const moveCandidates: Candidate[] = moveSourceNames.map(en => ({
    ja: moveJa(en),
    value: en,
  }));

  const moves: string[] = [];
  for (const line of right.slice(0, 4)) {
    const text = stripLabel(line.text);
    if (!text) continue;
    const match = closestMatch(text, moveCandidates);
    if (match && !moves.includes(match.value)) {
      moves.push(match.value);
    }
  }

  return { rosterName, ability, item, isMega, megaFormName, moves };
}

// ── ステータスカードパーサ ──────────────────────────────────────────────────────

/**
 * ステータスタブ 1 カードを解析し、StatReadings を返す。
 *
 * レイアウト想定（ラベルは誤読が多いので位置で判定）:
 *  左列 3 行 (y 昇順): HP → こうげき → ぼうぎょ
 *  右列 3 行 (y 昇順): とくこう → とくぼう → すばやさ
 *
 * 各行から数字を 2 つ抽出: 1 つ目 = 実数値, 2 つ目 = SP 振り
 */
export function parseStatusReadings(card: CardOcr): StatReadings {
  const { left, right } = splitColumns(card.lines);

  /** 行リストの idx 番目から StatReading を抽出（素朴版） */
  function readStat(lines: CardLine[], idx: number): { value: number; sp: number } {
    const line = lines[idx];
    if (!line) return { value: 0, sp: 0 };
    const nums = extractNumbers(line.text);
    return { value: nums[0] ?? 0, sp: nums[1] ?? 0 };
  }

  return {
    hp:  readStat(left,  0),
    atk: readStat(left,  1),
    def: readStat(left,  2),
    spa: readStat(right, 0),
    spd: readStat(right, 1),
    spe: readStat(right, 2),
  };
}

/** 1ステータス位置ぶんの「生の数字列」（列マージ対策に式で選別するため値を絞らない） */
export interface StatRawNumbers {
  hp: number[]; atk: number[]; def: number[];
  spa: number[]; spd: number[]; spe: number[];
}

/**
 * ステータスカードから「各位置の生数字列」を取り出す。
 * ラベル誤読が多いので位置で割り当て（左列上から HP/こうげき/ぼうぎょ、右列上から とくこう/とくぼう/すばやさ）。
 * value/sp の確定は base 既知後に pickStatReading で式ベース選別する。
 */
export function parseStatusRawNumbers(card: CardOcr): StatRawNumbers {
  const { left, right } = splitColumns(card.lines);
  const nums = (lines: CardLine[], idx: number) =>
    lines[idx] ? extractNumbers(lines[idx].text) : [];
  return {
    hp:  nums(left,  0),
    atk: nums(left,  1),
    def: nums(left,  2),
    spa: nums(right, 0),
    spd: nums(right, 1),
    spe: nums(right, 2),
  };
}

// ── メインパーサ ────────────────────────────────────────────────────────────────

/**
 * 能力カード 6 枚 + ステータスカード 6 枚 → PokemonBuild 6 体分。
 *
 * スロット対応: 行優先（左上=0, 右上=1, 左中=2, 右中=3, 左下=4, 右下=5）。
 */
export function parseTeam(
  abilityCards: CardOcr[],
  statusCards: CardOcr[],
  data: ChampionsData,
): PokemonBuild[] {
  const builds: PokemonBuild[] = [];
  const len = Math.min(abilityCards.length, statusCards.length, 6);

  for (let i = 0; i < len; i++) {
    const ar = parseAbilityCard(abilityCards[i], data);

    const base = findBaseStats(
      data.baseStats,
      ar.rosterName,
      ar.isMega,
      ar.megaFormName || undefined,
    );

    let nature = 'Hardy';
    let sp = { hp: 0, atk: 0, def: 0, spa: 0, spd: 0, spe: 0 };

    if (base) {
      // 種族値が分かったので、生数字列から式に一致する実数値/SPを選別（列マージに強い）
      const raw = parseStatusRawNumbers(statusCards[i]);
      const readings: StatReadings = {
        hp:  pickStatReading(base.hp,  raw.hp,  true),
        atk: pickStatReading(base.atk, raw.atk, false),
        def: pickStatReading(base.def, raw.def, false),
        spa: pickStatReading(base.spa, raw.spa, false),
        spd: pickStatReading(base.spd, raw.spd, false),
        spe: pickStatReading(base.spe, raw.spe, false),
      };
      const solved = solveStats(base, readings, data.natures);
      nature = solved.nature;
      sp = solved.sp;
    }

    builds.push({
      rosterName:   ar.rosterName,
      isMega:       ar.isMega,
      megaFormName: ar.megaFormName,
      nature,
      ivs:  DEFAULT_IVS,
      sp,
      item:    ar.item,
      ability: ar.ability,
      moves:   ar.moves.slice(0, 4),
    });
  }

  return builds;
}
