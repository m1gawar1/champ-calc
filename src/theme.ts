import { createContext, useContext } from 'react';

export type ThemeName = 'dark' | 'light';

// 分析ツール / ダッシュボード調（フラット）。
// グラスのトークン名はそのまま流用し、値だけをフラットなカード色に差し替えている。
// （sheen/topHighlight は 0 = 光沢なし。Glass はこれらが 0 のとき単色フラットで描画する）
export const TH = {
  // ── ダーク（資料の §ダークテーマ指針 準拠）──
  dark: {
    text:           '#e8edf1',
    textMuted:      '#9aa4ac',
    textWeak:       '#6b757d',
    accentAtk:      '#19b6d8',
    accentDef:      '#ff6b5e',
    glassTint:      '#1c2026',
    glassTint2:     '#181b20',
    glassDeep:      '#1c2026',
    glassNest:      '#23272d',
    glassChip:      '#262b32',
    glassChip2:     '#1f242a',
    rim:            '#2c333a',
    rimAccent:      '#19b6d8',
    rimActive:      '#19b6d8',
    sheenTop:       0,
    sheenBottom:    0,
    topHighlight:   0,
    track:          '#2c333a',
    track2:         '#23272d',
    tabTint:        '#15181c',
    tabRim:         '#2c333a',
    tabActiveBg:    'rgba(25,182,216,0.15)',
    tabActiveShadow:'none',
    tabInactive:    '#6b757d',
    tabIconInactive:'#6b757d',
    badgeAtkBg:     '#19b6d8',
    badgeAtkFg:     '#0a1416',
    btnSoft:        '#23272d',
    btnSoftRim:     '#2c333a',
    dashedRim:      '#2c333a',
    inputBg:        '#1c2026',
  },
  // ── ライト（資料の確定トークン）──
  light: {
    text:           '#15202b',
    textMuted:      '#5a646c',
    textWeak:       '#8a949c',
    accentAtk:      '#0a96b8',
    accentDef:      '#d2453a',
    glassTint:      '#ffffff',
    glassTint2:     '#fbfcfc',
    glassDeep:      '#ffffff',
    glassNest:      '#f3f5f6',
    glassChip:      '#eef1f3',
    glassChip2:     '#f5f7f8',
    rim:            '#c6ccd1',
    rimAccent:      '#0a96b8',
    rimActive:      '#0a96b8',
    sheenTop:       0,
    sheenBottom:    0,
    topHighlight:   0,
    track:          '#d3d9dd',
    track2:         '#e1e6e9',
    tabTint:        '#fbfcfc',
    tabRim:         '#c6ccd1',
    tabActiveBg:    '#e3f4f8',
    tabActiveShadow:'none',
    tabInactive:    '#a7afb5',
    tabIconInactive:'#a7afb5',
    badgeAtkBg:     '#0a96b8',
    badgeAtkFg:     '#ffffff',
    btnSoft:        '#eef1f3',
    btnSoftRim:     '#c6ccd1',
    dashedRim:      '#c6ccd1',
    inputBg:        '#ffffff',
  },
} as const;

export type Theme = typeof TH['dark'];
export type ThemeKey = keyof Theme;

// ─── カスタムテーマ上書き ───
// dark/light それぞれのパレットに対する部分上書き。値は色文字列または数値。
export type ThemeOverrides = {
  dark?: Partial<Record<ThemeKey, string | number>>;
  light?: Partial<Record<ThemeKey, string | number>>;
};

const CUSTOM_THEME_KEY = 'champ_custom_theme';

export function loadCustomTheme(): ThemeOverrides {
  try {
    const raw = localStorage.getItem(CUSTOM_THEME_KEY);
    if (!raw) return {};
    return JSON.parse(raw) as ThemeOverrides;
  } catch {
    return {};
  }
}

export function saveCustomTheme(ov: ThemeOverrides): void {
  try {
    localStorage.setItem(CUSTOM_THEME_KEY, JSON.stringify(ov));
  } catch { /* quota など */ }
}

// ベースパレット + 上書きを合成して解決済みテーマを返す
export function resolveTheme(name: ThemeName, ov: ThemeOverrides): Theme {
  const patch = ov[name];
  if (!patch) return TH[name];
  return { ...TH[name], ...patch } as Theme;
}

// コンテキストは「解決済みパレット」と「テーマ名」の両方を保持する
export interface ThemeCtxValue {
  name: ThemeName;
  theme: Theme;
}

export const ThemeCtx = createContext<ThemeCtxValue>({ name: 'dark', theme: TH.dark });
export const useTheme = (): Theme => useContext(ThemeCtx).theme;
export const useThemeName = (): ThemeName => useContext(ThemeCtx).name;

// タイプカラー（英語名キー）
export const TYPE_COLORS: Record<string, { bg: string; fg: string }> = {
  Electric: { bg: 'rgba(255,210,0,0.85)',   fg: '#3a2a00' },
  Fire:     { bg: 'rgba(255,120,60,0.85)',   fg: '#fff' },
  Water:    { bg: 'rgba(80,160,255,0.85)',   fg: '#fff' },
  Grass:    { bg: 'rgba(90,210,130,0.85)',   fg: '#0d2a18' },
  Ice:      { bg: 'rgba(140,230,255,0.85)',  fg: '#0a2734' },
  Steel:    { bg: 'rgba(180,190,210,0.85)',  fg: '#1a2030' },
  Fairy:    { bg: 'rgba(255,170,210,0.9)',   fg: '#3a0a24' },
  Dragon:   { bg: 'rgba(120,90,230,0.85)',   fg: '#fff' },
  Dark:     { bg: 'rgba(70,55,55,0.92)',     fg: '#fff' },
  Ground:   { bg: 'rgba(200,160,90,0.9)',    fg: '#33240a' },
  Flying:   { bg: 'rgba(150,170,230,0.9)',   fg: '#1a2050' },
  Psychic:  { bg: 'rgba(255,110,170,0.88)',  fg: '#fff' },
  Normal:   { bg: 'rgba(180,180,170,0.88)',  fg: '#1a1a14' },
  Ghost:    { bg: 'rgba(120,90,160,0.88)',   fg: '#fff' },
  Poison:   { bg: 'rgba(170,90,180,0.88)',   fg: '#fff' },
  Bug:      { bg: 'rgba(170,200,80,0.88)',   fg: '#1a2008' },
  Rock:     { bg: 'rgba(180,160,110,0.9)',   fg: '#1a1208' },
  Fighting: { bg: 'rgba(220,80,60,0.88)',    fg: '#fff' },
};
