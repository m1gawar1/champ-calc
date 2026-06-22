import { createPortal } from 'react-dom';
import { Glass } from './Glass';
import { useTheme } from '../theme';
import { NATURE_JA } from '../i18n';

interface Props {
  value: string;
  onChange: (nature: string) => void;
  onClose: () => void;
}

const STATS = ['attack', 'defense', 'sp_attack', 'sp_defense', 'speed'] as const;
const STAT_LABEL: Record<string, string> = {
  attack: '攻', defense: '防', sp_attack: '特攻', sp_defense: '特防', speed: '素早',
};

const NATURE_GRID: string[][] = [
  ['Hardy',  'Lonely',  'Adamant', 'Naughty', 'Brave'  ],
  ['Bold',   'Docile',  'Impish',  'Lax',     'Relaxed'],
  ['Modest', 'Mild',    'Bashful', 'Rash',    'Quiet'  ],
  ['Calm',   'Gentle',  'Careful', 'Quirky',  'Sassy'  ],
  ['Timid',  'Hasty',   'Jolly',   'Naive',   'Serious'],
];

export function NatureModal({ value, onChange, onClose }: Props) {
  const t = useTheme();

  // Glass カードの stacking context から脱出させるため #root へ portal する
  return createPortal(
    <div
      style={{
        position: 'fixed', inset: 0, zIndex: 1000,
        display: 'flex', alignItems: 'center', justifyContent: 'center',
        padding: 0, background: 'rgba(0,0,0,0.7)',
      }}
      onClick={onClose}
    >
      <Glass
        tint={t.glassTint}
        radius={0}
        padding={16}
        // 全画面化。テーブルは小さいので中身を縦中央に寄せて自然に見せる
        style={{ width: '100%', height: '100dvh', display: 'flex', flexDirection: 'column', justifyContent: 'center' }}
        onClick={e => e.stopPropagation()}
      >
        {/* ヘッダー（ノッチ対策で上端にセーフエリア余白） */}
        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 14, paddingTop: 'env(safe-area-inset-top)' }}>
          <span style={{ fontSize: 15, fontWeight: 800, color: t.text }}>性格を選択</span>
          <button
            onClick={onClose}
            style={{ color: t.textMuted, background: 'none', border: 'none', cursor: 'pointer', fontSize: 18, lineHeight: 1, padding: '0 4px' }}
          >✕</button>
        </div>

        <div style={{ overflowX: 'auto' }}>
          <table style={{ width: '100%', fontSize: 12, borderCollapse: 'collapse' }}>
            <thead>
              <tr>
                <th style={{ width: 24 }}></th>
                {STATS.map(s => (
                  <th key={s} style={{ textAlign: 'center', color: 'rgba(255,100,100,0.9)', fontWeight: 600, padding: '2px 2px 6px', fontSize: 11, whiteSpace: 'nowrap' }}>
                    {STAT_LABEL[s]}↓
                  </th>
                ))}
              </tr>
            </thead>
            <tbody>
              {NATURE_GRID.map((row, ri) => (
                <tr key={ri}>
                  <td style={{ color: 'rgba(90,200,250,0.9)', fontWeight: 600, textAlign: 'right', paddingRight: 4, whiteSpace: 'nowrap', fontSize: 11 }}>
                    {STAT_LABEL[STATS[ri]]}↑
                  </td>
                  {row.map((nature, ci) => {
                    const isSelected = value === nature;
                    const isNeutral = ri === ci;
                    return (
                      <td
                        key={ci}
                        onClick={() => { onChange(nature); onClose(); }}
                        style={{
                          textAlign: 'center', padding: '8px 2px',
                          cursor: 'pointer', borderRadius: 8, fontSize: 11,
                          whiteSpace: 'nowrap', letterSpacing: '-0.03em',
                          color: isSelected ? '#fff' : isNeutral ? t.textWeak : t.text,
                          background: isSelected ? 'rgba(90,200,250,0.3)' : isNeutral ? t.glassChip2 : 'transparent',
                          boxShadow: isSelected ? `inset 0 0 0 0.5px ${t.rimAccent}` : 'none',
                          fontWeight: isSelected ? 700 : 500,
                          transition: 'background 0.15s',
                        }}
                      >
                        {NATURE_JA[nature] ?? nature}
                      </td>
                    );
                  })}
                </tr>
              ))}
            </tbody>
          </table>
        </div>

        <p style={{ fontSize: 11, color: t.textWeak, marginTop: 12, textAlign: 'center' }}>
          <span style={{ color: 'rgba(90,200,250,0.8)' }}>青↑</span> 上昇 ／ <span style={{ color: 'rgba(255,100,100,0.8)' }}>赤↓</span> 下降
        </p>
      </Glass>
    </div>,
    document.getElementById('root')!,
  );
}
