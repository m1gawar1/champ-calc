import type { CSSProperties } from 'react';
import type { ThemeName } from '../theme';

export type TabKey = 'calc' | 'party' | 'speed' | 'history' | 'settings';

// 分析ツール調の背景: 単色 + 薄いグリッド線（26px セル）。タブ共通。
const BG: Record<ThemeName, { base: string; line: string }> = {
  dark:  { base: '#14171b', line: '#2f363e' },
  light: { base: '#edf0f2', line: '#bcc6cf' },
};

export function Backdrop({ theme }: { tab: TabKey; theme: ThemeName }) {
  const { base, line } = BG[theme];
  return (
    <div style={{
      position: 'absolute', inset: 0, overflow: 'hidden',
      backgroundColor: base,
      backgroundImage: `linear-gradient(${line} 1px, transparent 1px), linear-gradient(90deg, ${line} 1px, transparent 1px)`,
      backgroundSize: '26px 26px',
    } as CSSProperties} />
  );
}
