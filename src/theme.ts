import { createContext, useContext } from 'react';

export type ThemeName = 'dark' | 'light';

export const TH = {
  dark: {
    text:           '#ffffff',
    textMuted:      'rgba(255,255,255,0.55)',
    textWeak:       'rgba(255,255,255,0.4)',
    accentAtk:      'rgba(120,210,255,0.95)',
    accentDef:      'rgba(255,150,150,0.95)',
    glassTint:      'rgba(34,30,55,0.4)',
    glassTint2:     'rgba(28,30,48,0.38)',
    glassDeep:      'rgba(34,40,68,0.45)',
    glassNest:      'rgba(255,255,255,0.07)',
    glassChip:      'rgba(255,255,255,0.1)',
    glassChip2:     'rgba(255,255,255,0.06)',
    rim:            'rgba(255,255,255,0.18)',
    rimAccent:      'rgba(120,220,255,0.55)',
    rimActive:      'rgba(120,220,255,0.6)',
    sheenTop:       0.32,
    sheenBottom:    0.04,
    topHighlight:   0.22,
    track:          'rgba(255,255,255,0.1)',
    track2:         'rgba(255,255,255,0.08)',
    tabTint:        'rgba(20,18,30,0.42)',
    tabRim:         'rgba(255,255,255,0.22)',
    tabActiveBg:    'linear-gradient(180deg, rgba(255,255,255,0.22) 0%, rgba(255,255,255,0.08) 100%)',
    tabActiveShadow:'inset 0 0 0 0.5px rgba(255,255,255,0.4), inset 0 1px 0 rgba(255,255,255,0.5), 0 4px 12px rgba(0,0,0,0.2)',
    tabInactive:    'rgba(255,255,255,0.6)',
    tabIconInactive:'rgba(255,255,255,0.55)',
    badgeAtkBg:     'linear-gradient(180deg, rgba(120,220,255,0.95), rgba(70,180,250,0.85))',
    badgeAtkFg:     '#0b1d2a',
    btnSoft:        'rgba(255,255,255,0.08)',
    btnSoftRim:     'rgba(255,255,255,0.18)',
    dashedRim:      'rgba(255,255,255,0.25)',
    inputBg:        'rgba(255,255,255,0.07)',
  },
  light: {
    text:           '#0d0f1a',
    textMuted:      'rgba(20,22,40,0.55)',
    textWeak:       'rgba(20,22,40,0.38)',
    accentAtk:      '#0a84d8',
    accentDef:      '#d23a4a',
    glassTint:      'rgba(255,255,255,0.55)',
    glassTint2:     'rgba(255,255,255,0.5)',
    glassDeep:      'rgba(255,255,255,0.62)',
    glassNest:      'rgba(255,255,255,0.55)',
    glassChip:      'rgba(255,255,255,0.6)',
    glassChip2:     'rgba(255,255,255,0.45)',
    rim:            'rgba(255,255,255,0.95)',
    rimAccent:      'rgba(60,160,240,0.7)',
    rimActive:      'rgba(60,160,240,0.85)',
    sheenTop:       0.7,
    sheenBottom:    0.05,
    topHighlight:   0.85,
    track:          'rgba(20,22,40,0.08)',
    track2:         'rgba(20,22,40,0.06)',
    tabTint:        'rgba(255,255,255,0.55)',
    tabRim:         'rgba(255,255,255,0.95)',
    tabActiveBg:    'linear-gradient(180deg, rgba(255,255,255,0.95) 0%, rgba(255,255,255,0.65) 100%)',
    tabActiveShadow:'inset 0 0 0 0.5px rgba(255,255,255,0.95), inset 0 1px 0 rgba(255,255,255,1), 0 4px 12px rgba(0,40,90,0.12)',
    tabInactive:    'rgba(20,22,40,0.6)',
    tabIconInactive:'rgba(20,22,40,0.5)',
    badgeAtkBg:     'linear-gradient(180deg, #5AC8FA, #1a9fef)',
    badgeAtkFg:     '#fff',
    btnSoft:        'rgba(255,255,255,0.7)',
    btnSoftRim:     'rgba(255,255,255,0.95)',
    dashedRim:      'rgba(20,22,40,0.18)',
    inputBg:        'rgba(255,255,255,0.7)',
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
