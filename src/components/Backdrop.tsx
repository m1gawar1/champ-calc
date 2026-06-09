import type { ThemeName } from '../theme';

export type TabKey = 'calc' | 'party' | 'history' | 'settings';

// タブ×テーマ別の背景アート（Liquid Glass の透過感の土台）
const BACKDROPS: Record<ThemeName, Record<TabKey, JSX.Element>> = {
  dark: {
    calc: (
      <div style={{ position: 'absolute', inset: 0 }}>
        <div style={{ position: 'absolute', inset: 0, background: 'radial-gradient(120% 80% at 80% 10%, #4f3a8a 0%, #2a2152 45%, #0e0b24 100%)' }} />
        <div style={{ position: 'absolute', inset: 0, background: 'radial-gradient(50% 30% at 18% 22%, rgba(90,200,250,0.55) 0%, transparent 70%)' }} />
        <div style={{ position: 'absolute', inset: 0, background: 'radial-gradient(40% 28% at 78% 70%, rgba(255,110,130,0.5) 0%, transparent 70%)' }} />
        <div style={{ position: 'absolute', inset: 0, background: 'radial-gradient(30% 22% at 30% 75%, rgba(120,255,180,0.35) 0%, transparent 70%)' }} />
        {Array.from({ length: 40 }).map((_, i) => {
          const x = (i * 137) % 100;
          const y = (i * 73) % 100;
          const s = (i % 3) ? 1 : 1.6;
          return <div key={i} style={{ position: 'absolute', left: `${x}%`, top: `${y}%`, width: s, height: s, borderRadius: 99, background: 'rgba(255,255,255,0.7)' }} />;
        })}
      </div>
    ),
    party: (
      <div style={{ position: 'absolute', inset: 0 }}>
        <div style={{ position: 'absolute', inset: 0, background: 'linear-gradient(180deg, #0c2d3a 0%, #0a1d2e 60%, #050a1a 100%)' }} />
        <div style={{ position: 'absolute', inset: 0, background: 'radial-gradient(60% 40% at 20% 15%, rgba(40,210,200,0.55) 0%, transparent 70%)' }} />
        <div style={{ position: 'absolute', inset: 0, background: 'radial-gradient(50% 32% at 85% 60%, rgba(170,120,255,0.5) 0%, transparent 70%)' }} />
        <div style={{ position: 'absolute', inset: 0, background: 'radial-gradient(40% 28% at 50% 90%, rgba(90,200,250,0.42) 0%, transparent 70%)' }} />
      </div>
    ),
    history: (
      <div style={{ position: 'absolute', inset: 0 }}>
        <div style={{ position: 'absolute', inset: 0, background: 'linear-gradient(180deg, #2c0e3d 0%, #1a0a2c 55%, #07051a 100%)' }} />
        <div style={{ position: 'absolute', inset: 0, background: 'radial-gradient(55% 36% at 80% 18%, rgba(255,150,90,0.55) 0%, transparent 70%)' }} />
        <div style={{ position: 'absolute', inset: 0, background: 'radial-gradient(45% 30% at 18% 75%, rgba(120,90,255,0.55) 0%, transparent 70%)' }} />
        <div style={{ position: 'absolute', inset: 0, background: 'radial-gradient(40% 28% at 60% 50%, rgba(255,90,160,0.4) 0%, transparent 70%)' }} />
      </div>
    ),
    settings: (
      <div style={{ position: 'absolute', inset: 0 }}>
        <div style={{ position: 'absolute', inset: 0, background: 'linear-gradient(180deg, #1a1a2e 0%, #16213e 60%, #0f3460 100%)' }} />
        <div style={{ position: 'absolute', inset: 0, background: 'radial-gradient(50% 35% at 20% 20%, rgba(100,100,255,0.4) 0%, transparent 70%)' }} />
        <div style={{ position: 'absolute', inset: 0, background: 'radial-gradient(40% 30% at 80% 70%, rgba(80,200,180,0.4) 0%, transparent 70%)' }} />
      </div>
    ),
  },
  light: {
    calc: (
      <div style={{ position: 'absolute', inset: 0 }}>
        <div style={{ position: 'absolute', inset: 0, background: 'linear-gradient(180deg, #d8ecff 0%, #f5e9ff 50%, #ffeaf2 100%)' }} />
        <div style={{ position: 'absolute', inset: 0, background: 'radial-gradient(55% 36% at 18% 18%, rgba(120,200,255,0.95) 0%, transparent 70%)' }} />
        <div style={{ position: 'absolute', inset: 0, background: 'radial-gradient(45% 30% at 82% 28%, rgba(255,180,200,0.85) 0%, transparent 70%)' }} />
        <div style={{ position: 'absolute', inset: 0, background: 'radial-gradient(40% 28% at 50% 85%, rgba(180,230,210,0.85) 0%, transparent 70%)' }} />
      </div>
    ),
    party: (
      <div style={{ position: 'absolute', inset: 0 }}>
        <div style={{ position: 'absolute', inset: 0, background: 'linear-gradient(180deg, #e6f5ff 0%, #d6eef5 60%, #fff5e0 100%)' }} />
        <div style={{ position: 'absolute', inset: 0, background: 'radial-gradient(60% 40% at 25% 18%, rgba(140,220,255,0.95) 0%, transparent 70%)' }} />
        <div style={{ position: 'absolute', inset: 0, background: 'radial-gradient(48% 32% at 85% 65%, rgba(220,200,255,0.9) 0%, transparent 70%)' }} />
        <div style={{ position: 'absolute', inset: 0, background: 'radial-gradient(40% 28% at 50% 90%, rgba(255,220,180,0.8) 0%, transparent 70%)' }} />
      </div>
    ),
    history: (
      <div style={{ position: 'absolute', inset: 0 }}>
        <div style={{ position: 'absolute', inset: 0, background: 'linear-gradient(180deg, #fff0e8 0%, #f6e8ff 55%, #e8edff 100%)' }} />
        <div style={{ position: 'absolute', inset: 0, background: 'radial-gradient(55% 36% at 80% 18%, rgba(255,200,160,0.9) 0%, transparent 70%)' }} />
        <div style={{ position: 'absolute', inset: 0, background: 'radial-gradient(45% 30% at 18% 78%, rgba(200,180,255,0.85) 0%, transparent 70%)' }} />
        <div style={{ position: 'absolute', inset: 0, background: 'radial-gradient(40% 28% at 60% 50%, rgba(255,180,210,0.7) 0%, transparent 70%)' }} />
      </div>
    ),
    settings: (
      <div style={{ position: 'absolute', inset: 0 }}>
        <div style={{ position: 'absolute', inset: 0, background: 'linear-gradient(180deg, #e8f4ff 0%, #f0e8ff 55%, #fff0e8 100%)' }} />
        <div style={{ position: 'absolute', inset: 0, background: 'radial-gradient(50% 35% at 20% 20%, rgba(160,200,255,0.9) 0%, transparent 70%)' }} />
        <div style={{ position: 'absolute', inset: 0, background: 'radial-gradient(40% 30% at 80% 70%, rgba(200,220,255,0.8) 0%, transparent 70%)' }} />
      </div>
    ),
  },
};

export function Backdrop({ tab, theme }: { tab: TabKey; theme: ThemeName }) {
  return (
    <div style={{ position: 'absolute', inset: 0, overflow: 'hidden' }}>
      {BACKDROPS[theme][tab]}
    </div>
  );
}
