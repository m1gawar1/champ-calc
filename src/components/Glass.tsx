import { useRef } from 'react';
import type { CSSProperties, PointerEvent as ReactPointerEvent, ReactNode } from 'react';
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
export function SpSlider({ label, value, onChange, actual }: {
  label: string;
  value: number;
  onChange: (v: number) => void;
  actual?: number; // SP振り後の実数値（ラベル横に表示）
}) {
  const t = useTheme();
  const trackRef = useRef<HTMLDivElement>(null);

  // 指/カーソルの X 座標から 0〜32 の値を算出（つまみ16pxの両端補正込み）
  function valueFromClientX(clientX: number): number {
    const el = trackRef.current;
    if (!el) return value;
    const rect = el.getBoundingClientRect();
    const ratio = (clientX - rect.left - 8) / (rect.width - 16);
    return Math.max(0, Math.min(32, Math.round(ratio * 32)));
  }

  function handlePointerDown(e: ReactPointerEvent<HTMLDivElement>) {
    e.preventDefault();
    e.currentTarget.setPointerCapture(e.pointerId);
    onChange(valueFromClientX(e.clientX));
  }

  function handlePointerMove(e: ReactPointerEvent<HTMLDivElement>) {
    if (!e.currentTarget.hasPointerCapture(e.pointerId)) return;
    onChange(valueFromClientX(e.clientX));
  }

  return (
    <div>
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 5 }}>
        <span style={{ fontSize: 11, color: t.textMuted, fontWeight: 600 }}>
          {label}
          {actual !== undefined && (
            <span style={{
              fontFamily: '"SF Mono", "SFMono-Regular", Consolas, monospace',
              fontSize: 12, fontWeight: 700, color: value > 0 ? t.accentAtk : t.text, marginLeft: 6,
            }}>{actual}</span>
          )}
        </span>
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
      {/* プログレスバー + 丸いつまみ（Pointer Events で直接操作。touch-action:none でスクロールと競合しない） */}
      <div
        ref={trackRef}
        onPointerDown={handlePointerDown}
        onPointerMove={handlePointerMove}
        style={{
          position: 'relative', height: 28, display: 'flex', alignItems: 'center',
          touchAction: 'none', cursor: 'pointer', userSelect: 'none', WebkitUserSelect: 'none',
        }}
      >
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
      </div>
    </div>
  );
}
