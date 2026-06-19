import type { ThemeName } from '../theme';

export type TabKey = 'calc' | 'party' | 'speed' | 'history' | 'settings';

// シンプル化した背景: テーマごとの単色フラット（グラデ・光彩・星などの装飾なし）。
// ガラスカードのぼかし/光沢/枠線はこの単色の上でもそのまま機能する。
const BG: Record<ThemeName, string> = {
  dark:  '#0f0e17',
  light: '#eef0f5',
};

export function Backdrop({ theme }: { tab: TabKey; theme: ThemeName }) {
  return (
    <div style={{ position: 'absolute', inset: 0, overflow: 'hidden', background: BG[theme] }} />
  );
}
