import { useRef } from 'react';
import type { CSSProperties, PointerEvent as ReactPointerEvent, ReactNode } from 'react';
import { useTheme } from '../theme';

const MONO = '"DM Mono", "SF Mono", "SFMono-Regular", Consolas, monospace';

interface GlassLayersProps {
  tint?: string;
  radius?: number;
  blur?: number;   // 分析ツール調では未使用（フラット）。互換のため受けるだけ。
  rim?: string;
  sheenTop?: number;
  sheenBottom?: number;
}

// 分析ツール調のフラットカード: 単色の塗り + 1px 罫線（ぼかし・光沢なし）。
// かつての Liquid Glass 3層構造から差し替え。props 互換は維持。
export function GlassLayers({ tint, radius = 6, rim }: GlassLayersProps) {
  const t = useTheme();
  return (
    <>
      {/* 塗り */}
      <div style={{
        position: 'absolute', inset: 0, borderRadius: radius,
        background: tint ?? t.glassTint,
        zIndex: 0,
      } as CSSProperties} />
      {/* 罫線 */}
      <div style={{
        position: 'absolute', inset: 0, borderRadius: radius,
        boxShadow: `inset 0 0 0 1px ${rim ?? t.rim}`,
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

export function Glass({ children, radius = 6, tint, style, blur, rim, padding = 13, sheenTop, sheenBottom, onClick }: GlassProps) {
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

// SP振りスライダー（Calculator / PartyPage 共用）。分析ツール調: シアンの細トラック + リング型つまみ。
export function SpSlider({ label, value, onChange, actual }: {
  label: string;
  value: number;
  onChange: (v: number) => void;
  actual?: number; // SP振り後の実数値（ラベル横に表示）
}) {
  const t = useTheme();
  const trackRef = useRef<HTMLDivElement>(null);
  const accent = t.accentAtk;

  // 指/カーソルの X 座標から 0〜32 の値を算出（つまみ12pxの両端補正込み）
  function valueFromClientX(clientX: number): number {
    const el = trackRef.current;
    if (!el) return value;
    const rect = el.getBoundingClientRect();
    const ratio = (clientX - rect.left) / rect.width;
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

  const pct = (value / 32) * 100;

  return (
    <div>
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'baseline', marginBottom: 7 }}>
        <span style={{ fontSize: 12, fontWeight: 800, color: t.text }}>
          {label}
          <span style={{ fontFamily: MONO, fontSize: 11, fontWeight: 400, color: t.textWeak, marginLeft: 6 }}>{value}</span>
        </span>
        <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
          {actual !== undefined && (
            <span style={{ fontFamily: MONO, fontSize: 14, fontWeight: 500, color: accent }}>{actual}</span>
          )}
          {/* ±1 微調整ボタン（細かい数値合わせ用）。上限32は親側のクランプに委ねる */}
          <button onClick={() => onChange(value - 1)} aria-label="1減らす"
            style={{ width: 26, height: 26, borderRadius: 6, background: t.glassChip, boxShadow: `inset 0 0 0 0.5px ${t.rim}`, color: t.text, border: 'none', cursor: 'pointer', fontFamily: MONO, fontSize: 14, fontWeight: 700, lineHeight: 1 }}>−</button>
          <input
            type="number" min={0} max={32} value={value}
            onChange={e => onChange(Math.max(0, Math.min(32, Math.floor(Number(e.target.value) || 0))))}
            style={{
              width: 34, textAlign: 'right',
              fontFamily: MONO, fontSize: 11, fontWeight: 500,
              color: t.text, background: t.inputBg, border: `1px solid ${t.rim}`,
              borderRadius: 3, padding: '1px 4px', outline: 'none',
            }}
          />
          <button onClick={() => onChange(value + 1)} aria-label="1増やす"
            style={{ width: 26, height: 26, borderRadius: 6, background: t.glassChip, boxShadow: `inset 0 0 0 0.5px ${t.rim}`, color: t.text, border: 'none', cursor: 'pointer', fontFamily: MONO, fontSize: 14, fontWeight: 700, lineHeight: 1 }}>＋</button>
        </div>
      </div>
      {/* トラック行: 0 〜 MAX（端ラベルはクイック設定ボタンも兼ねる） */}
      <div style={{ display: 'flex', alignItems: 'center', gap: 9 }}>
        <button onClick={() => onChange(0)}
          style={{ fontFamily: MONO, fontSize: 10, color: t.textWeak, background: 'none', border: 'none', cursor: 'pointer', padding: '6px 2px', minWidth: 14 }}>0</button>
        <div
          ref={trackRef}
          onPointerDown={handlePointerDown}
          onPointerMove={handlePointerMove}
          style={{
            position: 'relative', flex: 1, height: 22, display: 'flex', alignItems: 'center',
            touchAction: 'none', cursor: 'pointer', userSelect: 'none', WebkitUserSelect: 'none',
          }}
        >
          {/* トラック */}
          <div style={{ position: 'absolute', left: 0, right: 0, height: 4, borderRadius: 2, background: t.track }}>
            <div style={{
              position: 'absolute', left: 0, top: 0, bottom: 0,
              width: `${pct}%`, background: accent, borderRadius: 2,
              transition: 'width 0.1s ease',
            }} />
          </div>
          {/* リング型つまみ */}
          <div style={{
            position: 'absolute',
            left: `${pct}%`, top: '50%',
            transform: 'translate(-50%, -50%)',
            width: 12, height: 12, borderRadius: '50%',
            background: '#fff', border: `2px solid ${accent}`,
            pointerEvents: 'none',
            transition: 'left 0.1s ease',
          }} />
        </div>
        <button onClick={() => onChange(32)}
          style={{ fontFamily: MONO, fontSize: 10, color: value === 32 ? accent : t.textWeak, background: 'none', border: 'none', cursor: 'pointer', padding: '6px 2px', minWidth: 24 }}>MAX</button>
      </div>
    </div>
  );
}
