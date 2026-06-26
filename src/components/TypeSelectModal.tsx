import { useState } from 'react';
import { createPortal } from 'react-dom';
import { GlassLayers } from './Glass';
import { useTheme, TYPE_COLORS } from '../theme';
import { TYPE_JA } from '../i18n';

// 標準18タイプ（表示順）
const TYPE_ORDER = [
  'Normal', 'Fire', 'Water', 'Electric', 'Grass', 'Ice', 'Fighting', 'Poison', 'Ground',
  'Flying', 'Psychic', 'Bug', 'Rock', 'Ghost', 'Dragon', 'Dark', 'Steel', 'Fairy',
];

interface Props {
  baseTypes: string[];      // 素タイプ（「戻す」用）
  current: string[];        // 現在のタイプ（上書き中ならその値、なければ素タイプ）
  onApply: (types: string[] | null) => void; // null = 上書き解除（素タイプに戻す）
  onClose: () => void;
}

// タイプを手動で1〜2個選び直すモーダル。へんげんじざい/テラス等のタイプ変化再現用。
export function TypeSelectModal({ baseTypes, current, onApply, onClose }: Props) {
  const t = useTheme();
  const [sel, setSel] = useState<string[]>(current);

  // タイプをトグル。最大2個まで。先に選んだものから押し出す。
  function toggle(ty: string) {
    setSel(prev => {
      if (prev.includes(ty)) return prev.filter(x => x !== ty);
      if (prev.length >= 2) return [prev[1], ty];
      return [...prev, ty];
    });
  }

  const sameAsBase = sel.length === baseTypes.length && sel.every(x => baseTypes.includes(x));

  return createPortal(
    <div
      style={{ position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.8)', zIndex: 1000, display: 'flex', alignItems: 'center', justifyContent: 'center', padding: 0 }}
      onClick={onClose}
    >
      <div
        style={{ width: '100%', height: '100dvh', display: 'flex', flexDirection: 'column', position: 'relative', borderRadius: 0, overflow: 'hidden', isolation: 'isolate' }}
        onClick={e => e.stopPropagation()}
      >
        <GlassLayers radius={0} />

        {/* ヘッダー */}
        <div style={{ position: 'relative', zIndex: 3, display: 'flex', alignItems: 'center', justifyContent: 'space-between', padding: 'calc(env(safe-area-inset-top) + 16px) 16px 12px' }}>
          <span style={{ fontSize: 17, fontWeight: 800, color: t.text }}>タイプを選択</span>
          <button onClick={onClose} style={{ color: t.textMuted, background: 'none', border: 'none', cursor: 'pointer', fontSize: 20, padding: '0 4px' }}>✕</button>
        </div>

        <div style={{ position: 'relative', zIndex: 3, padding: '0 16px 10px', fontSize: 12, color: t.textMuted, fontWeight: 600 }}>
          1〜2タイプを選択（へんげんじざい・テラス等の変化用）
        </div>

        {/* タイプグリッド */}
        <div style={{ position: 'relative', zIndex: 3, flex: 1, overflowY: 'auto', padding: '0 12px calc(env(safe-area-inset-bottom) + 12px)' }}>
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3, 1fr)', gap: 8 }}>
            {TYPE_ORDER.map(ty => {
              const c = TYPE_COLORS[ty] ?? { bg: 'rgba(120,120,120,0.6)', fg: '#fff' };
              const on = sel.includes(ty);
              const order = sel.indexOf(ty);
              return (
                <button
                  key={ty}
                  onClick={() => toggle(ty)}
                  style={{
                    position: 'relative',
                    padding: '12px 0', borderRadius: 12, fontSize: 13, fontWeight: 700, cursor: 'pointer',
                    border: 'none', background: c.bg, color: c.fg,
                    opacity: on ? 1 : 0.4,
                    boxShadow: on
                      ? 'inset 0 1px 0 rgba(255,255,255,0.4), 0 0 0 2px rgba(255,255,255,0.9)'
                      : 'inset 0 1px 0 rgba(255,255,255,0.3)',
                    transition: 'opacity 0.15s',
                  }}
                >
                  {TYPE_JA[ty] ?? ty}
                  {on && sel.length === 2 && (
                    <span style={{ position: 'absolute', top: 4, right: 6, fontSize: 10, fontWeight: 800, opacity: 0.85 }}>{order + 1}</span>
                  )}
                </button>
              );
            })}
          </div>
        </div>

        {/* フッター操作 */}
        <div style={{ position: 'relative', zIndex: 3, display: 'flex', gap: 8, padding: '10px 16px calc(env(safe-area-inset-bottom) + 16px)' }}>
          <button
            onClick={() => { onApply(null); onClose(); }}
            disabled={sameAsBase}
            style={{
              flex: 1, padding: '12px 0', borderRadius: 12, fontSize: 14, fontWeight: 700, cursor: sameAsBase ? 'default' : 'pointer',
              background: t.glassChip2, color: sameAsBase ? t.textWeak : t.textMuted,
              border: `1px solid ${t.rim}`, opacity: sameAsBase ? 0.5 : 1,
            }}
          >素タイプに戻す</button>
          <button
            onClick={() => { onApply(sel); onClose(); }}
            disabled={sel.length === 0}
            style={{
              flex: 1, padding: '12px 0', borderRadius: 12, fontSize: 14, fontWeight: 800, cursor: sel.length === 0 ? 'default' : 'pointer',
              background: sel.length === 0 ? t.glassChip2 : 'rgba(90,200,250,0.25)',
              color: sel.length === 0 ? t.textWeak : t.accentAtk,
              border: `1px solid ${sel.length === 0 ? t.rim : t.rimAccent}`,
            }}
          >適用</button>
        </div>
      </div>
    </div>,
    document.getElementById('root')!,
  );
}
