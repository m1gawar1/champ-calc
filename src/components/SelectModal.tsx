import { useState, useMemo } from 'react';
import { createPortal } from 'react-dom';
import { GlassLayers } from './Glass';
import { useTheme, TYPE_COLORS } from '../theme';
import { TYPE_JA } from '../i18n';

export interface SelectItem {
  label: string;
  value: string;
  sub?: string;       // 右側に小さく表示する補助情報（英語名・効果など）
  type?: string;      // タイプ（英語名）。指定があるとタイプ絞り込みバーを表示
  power?: number;     // 威力（並び替え用）
  category?: string;  // 'Physical' | 'Special'（並び替え用）
}

export type SortKey = 'gojuon' | 'power' | 'type';
const SORT_LABELS: { key: SortKey; label: string }[] = [
  { key: 'gojuon', label: '50音' },
  { key: 'power', label: '威力' },
  { key: 'type', label: 'タイプ' },
];
// 分類フィルター（物理/特殊）
const CATEGORIES: { key: string; label: string }[] = [
  { key: 'Physical', label: '物理' },
  { key: 'Special', label: '特殊' },
];

// タイプ絞り込みバーの並び順（標準18タイプ）
const TYPE_ORDER = [
  'Normal', 'Fire', 'Water', 'Electric', 'Grass', 'Ice', 'Fighting', 'Poison', 'Ground',
  'Flying', 'Psychic', 'Bug', 'Rock', 'Ghost', 'Dragon', 'Dark', 'Steel', 'Fairy',
];

interface Props {
  title: string;
  items: SelectItem[];
  value: string;
  onSelect: (value: string) => void;
  onClose: () => void;
  sortable?: boolean;     // 並び替えバーを表示
  persistKey?: string;    // 選んだ並び順を localStorage に保存するキー
}

function toKatakana(str: string) {
  return str.replace(/[ぁ-ゖ]/g, m => String.fromCharCode(m.charCodeAt(0) + 0x60));
}

// 技・持ち物などを大きな画面で検索選択する汎用モーダル
export function SelectModal({ title, items, value, onSelect, onClose, sortable, persistKey }: Props) {
  const t = useTheme();
  const [search, setSearch] = useState('');
  const [typeFilter, setTypeFilter] = useState<string | null>(null);
  const [categoryFilter, setCategoryFilter] = useState<string | null>(null);
  const [sort, setSort] = useState<SortKey>(() =>
    (persistKey && (localStorage.getItem(persistKey) as SortKey)) || 'gojuon'
  );

  function changeSort(s: SortKey) {
    setSort(s);
    if (persistKey) localStorage.setItem(persistKey, s);
  }

  // items に含まれるタイプだけをバーに出す（標準順）
  const availableTypes = useMemo(() => {
    const present = new Set(items.map(i => i.type).filter(Boolean) as string[]);
    return TYPE_ORDER.filter(ty => present.has(ty));
  }, [items]);

  const hasCategory = useMemo(() => items.some(i => i.category), [items]);

  const filtered = useMemo(() => {
    let arr = items;
    if (typeFilter) arr = arr.filter(it => it.type === typeFilter);
    if (categoryFilter) arr = arr.filter(it => it.category === categoryFilter);
    if (search) {
      const lower = search.toLowerCase();
      const kata = toKatakana(search);
      arr = arr.filter(it =>
        toKatakana(it.label).includes(kata) ||
        it.value.toLowerCase().includes(lower) ||
        (it.sub ? toKatakana(it.sub).includes(kata) : false),
      );
    }
    if (sortable) {
      const gojuon = (a: SelectItem, b: SelectItem) => a.label.localeCompare(b.label, 'ja');
      arr = [...arr].sort((a, b) => {
        switch (sort) {
          case 'power':    return (b.power ?? 0) - (a.power ?? 0) || gojuon(a, b);
          case 'type':     return (TYPE_ORDER.indexOf(a.type ?? '') - TYPE_ORDER.indexOf(b.type ?? '')) || gojuon(a, b);
          default:         return gojuon(a, b); // 50音
        }
      });
    }
    return arr;
  }, [items, search, typeFilter, categoryFilter, sortable, sort]);

  // Glass カードの stacking context から脱出させるため #root へ portal する
  return createPortal(
    <div
      style={{ position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.8)', zIndex: 1000, display: 'flex', alignItems: 'center', justifyContent: 'center', padding: 16 }}
      onClick={onClose}
    >
      <div
        style={{ width: '100%', maxWidth: 440, maxHeight: '82vh', display: 'flex', flexDirection: 'column', position: 'relative', borderRadius: 26, overflow: 'hidden', isolation: 'isolate' }}
        onClick={e => e.stopPropagation()}
      >
        <GlassLayers radius={26} />

        {/* ヘッダー */}
        <div style={{ position: 'relative', zIndex: 3, display: 'flex', alignItems: 'center', justifyContent: 'space-between', padding: '16px 16px 12px' }}>
          <span style={{ fontSize: 17, fontWeight: 800, color: t.text }}>{title}</span>
          <button onClick={onClose} style={{ color: t.textMuted, background: 'none', border: 'none', cursor: 'pointer', fontSize: 20, padding: '0 4px' }}>✕</button>
        </div>

        {/* 検索バー */}
        <div style={{ position: 'relative', zIndex: 3, padding: '0 12px 10px' }}>
          <input
            type="text"
            value={search}
            onChange={e => setSearch(e.target.value)}
            placeholder="名前で検索... (ひらがな/カタカナ)"
            autoFocus
            style={{
              width: '100%', boxSizing: 'border-box',
              background: t.glassNest, color: t.text,
              border: `1px solid ${t.rim}`,
              borderRadius: 12, padding: '9px 12px',
              fontSize: 14, outline: 'none', fontFamily: 'inherit',
            }}
          />
        </div>

        {/* タイプ絞り込みバー（技モーダルのみ） */}
        {availableTypes.length > 0 && (
          <div style={{ position: 'relative', zIndex: 3, display: 'flex', flexWrap: 'wrap', gap: 5, padding: '0 12px 10px' }}>
            <button
              onClick={() => setTypeFilter(null)}
              style={{
                padding: '4px 11px', borderRadius: 999, fontSize: 11, fontWeight: 700, cursor: 'pointer', border: 'none',
                background: typeFilter === null ? 'rgba(90,200,250,0.25)' : t.glassChip2,
                color: typeFilter === null ? t.accentAtk : t.textMuted,
                boxShadow: `inset 0 0 0 0.5px ${typeFilter === null ? t.rimAccent : t.rim}`,
              }}
            >全て</button>
            {availableTypes.map(ty => {
              const c = TYPE_COLORS[ty] ?? { bg: 'rgba(120,120,120,0.6)', fg: '#fff' };
              const on = typeFilter === ty;
              return (
                <button
                  key={ty}
                  onClick={() => setTypeFilter(on ? null : ty)}
                  style={{
                    padding: '4px 10px', borderRadius: 999, fontSize: 11, fontWeight: 700, cursor: 'pointer',
                    border: 'none', background: c.bg, color: c.fg,
                    opacity: typeFilter && !on ? 0.35 : 1,
                    boxShadow: on
                      ? 'inset 0 1px 0 rgba(255,255,255,0.4), 0 0 0 2px rgba(255,255,255,0.9)'
                      : 'inset 0 1px 0 rgba(255,255,255,0.4), 0 1px 2px rgba(0,0,0,0.15)',
                    transition: 'opacity 0.15s',
                  }}
                >{TYPE_JA[ty] ?? ty}</button>
              );
            })}
          </div>
        )}

        {/* 分類フィルター（物理 / 特殊） */}
        {hasCategory && (
          <div style={{ position: 'relative', zIndex: 3, display: 'flex', alignItems: 'center', gap: 5, padding: '0 12px 10px' }}>
            <span style={{ fontSize: 10, color: t.textWeak, fontWeight: 600 }}>分類</span>
            {CATEGORIES.map(cat => {
              const on = categoryFilter === cat.key;
              return (
                <button
                  key={cat.key}
                  onClick={() => setCategoryFilter(on ? null : cat.key)}
                  style={{
                    padding: '4px 12px', borderRadius: 999, fontSize: 11, fontWeight: 700, cursor: 'pointer', border: 'none',
                    background: on ? 'rgba(90,200,250,0.25)' : t.glassChip2,
                    color: on ? t.accentAtk : t.textMuted,
                    boxShadow: `inset 0 0 0 0.5px ${on ? t.rimAccent : t.rim}`,
                  }}
                >{cat.label}</button>
              );
            })}
          </div>
        )}

        {/* 並び替えバー */}
        {sortable && (
          <div style={{ position: 'relative', zIndex: 3, display: 'flex', alignItems: 'center', gap: 5, padding: '0 12px 10px' }}>
            <span style={{ fontSize: 10, color: t.textWeak, fontWeight: 600 }}>並び替え</span>
            {SORT_LABELS.map(s => {
              const on = sort === s.key;
              return (
                <button
                  key={s.key}
                  onClick={() => changeSort(s.key)}
                  style={{
                    padding: '4px 10px', borderRadius: 999, fontSize: 11, fontWeight: 700, cursor: 'pointer', border: 'none',
                    background: on ? 'rgba(90,200,250,0.25)' : t.glassChip2,
                    color: on ? t.accentAtk : t.textMuted,
                    boxShadow: `inset 0 0 0 0.5px ${on ? t.rimAccent : t.rim}`,
                  }}
                >{s.label}</button>
              );
            })}
          </div>
        )}

        {/* リスト */}
        <div style={{ position: 'relative', zIndex: 3, flex: 1, overflowY: 'auto', padding: '0 8px 12px' }}>
          {filtered.length === 0 ? (
            <div style={{ textAlign: 'center', color: t.textMuted, padding: '32px 0', fontSize: 14 }}>
              見つかりません
            </div>
          ) : (
            <div style={{ display: 'flex', flexDirection: 'column', gap: 4 }}>
              {filtered.map(item => {
                const selected = item.value === value;
                return (
                  <button
                    key={item.value || '__none__'}
                    onClick={() => { onSelect(item.value); onClose(); }}
                    style={{
                      width: '100%', textAlign: 'left',
                      display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 8,
                      padding: '12px 14px', borderRadius: 12,
                      background: selected ? 'rgba(90,200,250,0.22)' : t.glassChip2,
                      border: `1px solid ${selected ? t.rimAccent : t.rim}`,
                      color: t.text, fontSize: 15, fontWeight: 700,
                      cursor: 'pointer', transition: 'background 0.15s',
                    }}
                    onMouseEnter={e => { if (!selected) e.currentTarget.style.background = t.glassChip; }}
                    onMouseLeave={e => { if (!selected) e.currentTarget.style.background = t.glassChip2; }}
                  >
                    <span>{item.label}</span>
                    {item.sub && <span style={{ color: t.textWeak, fontSize: 11, fontWeight: 600 }}>{item.sub}</span>}
                  </button>
                );
              })}
            </div>
          )}
        </div>
      </div>
    </div>,
    document.getElementById('root')!,
  );
}
