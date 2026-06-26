// OCR で読んだ和名を「制約付き候補リスト」へあいまい一致させる。
// 候補を全件ではなく「その種族の覚える技」「その種族の特性」等に絞ることで、
// OCR が多少崩れても正解に寄せられる（弱いOCR × 強い制約）。

// 正規化: 空白・中黒・区切り記号などOCRが混入しやすいノイズを除去。
// 長音/カタカナはそのまま（候補側も同じ正規化をかけて比較する）。
export function normalize(s: string): string {
  return s
    .replace(/[\s　]/g, '')          // 半角/全角スペース
    .replace(/[・,.，。、:：;；|｜/／\\]/g, '') // 区切り・記号類
    .trim();
}

// レーベンシュタイン距離
export function levenshtein(a: string, b: string): number {
  const m = a.length;
  const n = b.length;
  if (m === 0) return n;
  if (n === 0) return m;
  let prev = new Array(n + 1);
  let curr = new Array(n + 1);
  for (let j = 0; j <= n; j++) prev[j] = j;
  for (let i = 1; i <= m; i++) {
    curr[0] = i;
    for (let j = 1; j <= n; j++) {
      const cost = a[i - 1] === b[j - 1] ? 0 : 1;
      curr[j] = Math.min(prev[j] + 1, curr[j - 1] + 1, prev[j - 1] + cost);
    }
    [prev, curr] = [curr, prev];
  }
  return prev[n];
}

// 類似度スコア（0〜1、1が完全一致）。長さで正規化した距離の補数。
export function similarity(a: string, b: string): number {
  const na = normalize(a);
  const nb = normalize(b);
  if (na === nb) return 1;
  const maxLen = Math.max(na.length, nb.length);
  if (maxLen === 0) return 0;
  return 1 - levenshtein(na, nb) / maxLen;
}

export interface Candidate {
  ja: string;     // 比較対象の和名
  value: string;  // 返したい内部値（英語名など）
}

export interface MatchResult {
  value: string;
  ja: string;
  score: number;  // 0〜1
}

// input に最も近い候補を返す。candidates が空なら null。
// threshold 未満なら一致なしとみなして null（呼び出し側で「読めなかった」扱いにできる）。
export function closestMatch(
  input: string,
  candidates: Candidate[],
  threshold = 0.34,
): MatchResult | null {
  if (!input || candidates.length === 0) return null;
  let best: MatchResult | null = null;
  for (const c of candidates) {
    const score = similarity(input, c.ja);
    if (!best || score > best.score) best = { value: c.value, ja: c.ja, score };
  }
  if (best && best.score < threshold) return null;
  return best;
}
