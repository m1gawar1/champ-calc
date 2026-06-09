import type { CSSProperties, ReactNode } from 'react';
import { useTheme, useThemeName } from '../theme';

interface GlassLayersProps {
  tint?: string;
  radius?: number;
  blur?: number;
  rim?: string;
  sheenTop?: number;
  sheenBottom?: number;
}

// Liquid Glass の3層構造: Tint+Blur / Sheen / Rim
export function GlassLayers({ tint, radius = 24, blur = 28, rim, sheenTop, sheenBottom }: GlassLayersProps) {
  const t = useTheme();
  const themeName = useThemeName();
  const sTop = sheenTop ?? t.sheenTop;
  const sBot = sheenBottom ?? t.sheenBottom;
  const topHL = themeName === 'dark' ? 0.22 : 0.85;

  return (
    <>
      {/* 層1: Tint + Blur */}
      <div style={{
        position: 'absolute', inset: 0, borderRadius: radius,
        backdropFilter: `blur(${blur}px) saturate(190%)`,
        WebkitBackdropFilter: `blur(${blur}px) saturate(190%)`,
        background: tint ?? t.glassTint,
        zIndex: 0,
      } as CSSProperties} />
      {/* 層2: Sheen（上→下の白いハイライト） */}
      <div style={{
        position: 'absolute', inset: 0, borderRadius: radius,
        background: `linear-gradient(180deg, rgba(255,255,255,${sTop}) 0%, rgba(255,255,255,0) 38%, rgba(255,255,255,0) 70%, rgba(255,255,255,${sBot}) 100%)`,
        zIndex: 1, pointerEvents: 'none',
      }} />
      {/* 層3: Rim（内側0.5px ボーダー + 上端ハイライト） */}
      <div style={{
        position: 'absolute', inset: 0, borderRadius: radius,
        boxShadow: `inset 0 0 0 0.5px ${rim ?? t.rim}, inset 0 1px 0 rgba(255,255,255,${topHL})`,
        zIndex: 2, pointerEvents: 'none',
      }} />
    </>
  );
}

interface GlassProps extends GlassLayersProps {
  children: ReactNode;
  style?: CSSProperties;
  padding?: number | string;
  onClick?: () => void;
}

export function Glass({ children, radius = 24, tint, style, blur, rim, padding = 16, sheenTop, sheenBottom, onClick }: GlassProps) {
  return (
    <div
      style={{ position: 'relative', borderRadius: radius, overflow: 'hidden', isolation: 'isolate', ...style }}
      onClick={onClick}
    >
      <GlassLayers tint={tint} radius={radius} blur={blur} rim={rim} sheenTop={sheenTop} sheenBottom={sheenBottom} />
      <div style={{ position: 'relative', zIndex: 3, padding }}>{children}</div>
    </div>
  );
}

// SP振りスライダー（Calculator / PartyPage 共用）
export function SpSlider({ label, value, onChange }: {
  label: string;
  value: number;
  onChange: (v: number) => void;
}) {
  const t = useTheme();
  return (
    <div>
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 5 }}>
        <span style={{ fontSize: 11, color: t.textMuted, fontWeight: 600 }}>{label}</span>
        <div style={{ display: 'flex', gap: 5, alignItems: 'center' }}>
          <button
            onClick={() => onChange(0)}
            style={{
              fontSize: 9, padding: '2px 7px', borderRadius: 99,
              background: t.glassChip, boxShadow: `inset 0 0 0 0.5px ${t.rim}`,
              color: t.textMuted, border: 'none', cursor: 'pointer',
            }}
          >0</button>
          <div style={{ display: 'flex', alignItems: 'baseline', gap: 1 }}>
            <input
              type="number" min={0} max={32} value={value}
              onChange={e => onChange(Math.max(0, Math.min(32, Math.floor(Number(e.target.value) || 0))))}
              style={{
                width: 30, textAlign: 'right',
                fontFamily: '"SF Mono", "SFMono-Regular", Consolas, monospace', fontSize: 11, fontWeight: 700,
                color: t.text, background: t.glassChip, border: `1px solid ${t.rim}`,
                borderRadius: 6, padding: '1px 3px', outline: 'none',
              }}
            />
            <span style={{ fontFamily: '"SF Mono", "SFMono-Regular", Consolas, monospace', fontSize: 11, color: t.textWeak }}>/32</span>
          </div>
          <button
            onClick={() => onChange(32)}
            style={{
              fontSize: 9, padding: '2px 7px', borderRadius: 99,
              background: value === 32 ? 'rgba(90,200,250,0.25)' : t.glassChip,
              boxShadow: `inset 0 0 0 0.5px ${value === 32 ? t.rimAccent : t.rim}`,
              color: value === 32 ? t.accentAtk : t.textMuted,
              border: 'none', cursor: 'pointer',
            }}
          >MAX</button>
        </div>
      </div>
      {/* プログレスバー + 丸いつまみ（不可視rangeInputをオーバーレイして操作） */}
      <div style={{ position: 'relative', height: 20, display: 'flex', alignItems: 'center' }}>
        {/* トラック */}
        <div style={{ position: 'absolute', left: 0, right: 0, height: 4, borderRadius: 99, background: t.track, overflow: 'hidden' }}>
          <div style={{
            height: '100%',
            width: `${(value / 32) * 100}%`,
            background: 'linear-gradient(90deg, #5AC8FA 0%, #74E0FF 100%)',
            borderRadius: 99,
            boxShadow: value > 0 ? '0 0 8px rgba(90,200,250,0.5)' : 'none',
            transition: 'width 0.1s ease',
          }} />
        </div>
        {/* 丸いつまみ（見た目のみ。操作は下の range が受ける）。両端ではみ出さないよう left を補正 */}
        <div style={{
          position: 'absolute',
          left: `calc(${(value / 32) * 100}% - ${(value / 32) * 16}px)`,
          top: '50%', transform: 'translateY(-50%)',
          width: 16, height: 16, borderRadius: 99,
          background: '#fff',
          boxShadow: `0 1px 4px rgba(0,0,0,0.35), inset 0 0 0 ${value > 0 ? 1.5 : 0.5}px ${value > 0 ? 'rgba(90,200,250,0.9)' : t.rim}`,
          pointerEvents: 'none',
          transition: 'left 0.1s ease',
        }} />
        <input
          type="range" min={0} max={32} value={value}
          onChange={e => onChange(Number(e.target.value))}
          style={{
            position: 'absolute', inset: 0, width: '100%', height: '100%',
            opacity: 0, cursor: 'pointer', margin: 0, padding: 0,
          }}
        />
      </div>
    </div>
  );
}
