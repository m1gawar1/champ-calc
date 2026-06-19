import type { CSSProperties } from 'react';
import type { ThemeName } from '../theme';

export type TabKey = 'calc' | 'party' | 'speed' | 'history' | 'settings';

// 分析ツール調の背景: 単色 + 薄いグリッド線（26px セル）。タブ共通。
const BG: Record<ThemeName, { base: string; line: string }> = {
  dark:  { base: '#15181c', line: '#23272d' },
  light: { base: '#eceef0', line: '#dde1e4' },
};

export function Backdrop({ theme }: { tab: TabKey; theme: ThemeName }) {
  const { base, line } = BG[theme];
  return (
    <div style={{
      position: 'absolute', inset: 0, overflow: 'hidden',
      background: base,
      backgroundImage: `linear-gradient(${line} 1px, transparent 1px), linear-gradient(90deg, ${line} 1px, transparent 1px)`,
      backgroundSize: '26px 26px',
    } as CSSProperties} />
  );
}
