import { useState, useRef, useEffect } from 'react';
import { createPortal } from 'react-dom';
import { useTheme } from '../theme';

function toKatakana(str: string): string {
  return str.replace(/[\u3041-\u3096]/g, c => String.fromCharCode(c.charCodeAt(0) + 0x60));
}

function normalize(str: string): string {
  return toKatakana(str.toLowerCase());
}

interface ComboboxItem {
  label: string;
  value: string;
  icon?: string; // 左に表示するアイコンURL（持ち物など）。'' なら非表示
}

interface ComboboxProps {
  items: ComboboxItem[];
  value: string;
  onChange: (value: string) => void;
  placeholder?: string;
  className?: string;
  hideValueHint?: boolean; // 右側の value（英語名）を表示しない（日本語名が見切れる対策）
}

const SMALL_LIST_THRESHOLD = 150;
const MAX_SEARCH_RESULTS = 20;

export function Combobox({ items, value, onChange, placeholder, hideValueHint }: ComboboxProps) {
  const t = useTheme();
  const selectedItem = items.find(i => i.value === value);
  const selectedLabel = selectedItem?.label ?? '';
  // 選択中の項目にアイコンがあり、かつ検索入力中でなければ入力欄左にアイコンを出す
  const showLeadingIcon = !!selectedItem?.icon && query === selectedLabel;
  const [query, setQuery] = useState(selectedLabel);
  const [open, setOpen] = useState(false);
  const [rect, setRect] = useState<{ left: number; top: number; bottom: number; width: number } | null>(null);
  const containerRef = useRef<HTMLDivElement>(null);
  const inputRef = useRef<HTMLInputElement>(null);
  const dropdownRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    setQuery(selectedLabel);
  }, [selectedLabel]);

  useEffect(() => {
    function onDown(e: MouseEvent) {
      const target = e.target as Node;
      const inContainer = containerRef.current?.contains(target);
      const inDropdown = dropdownRef.current?.contains(target);
      if (!inContainer && !inDropdown) {
        setOpen(false);
        setQuery(selectedLabel);
      }
    }
    document.addEventListener('mousedown', onDown);
    return () => document.removeEventListener('mousedown', onDown);
  }, [selectedLabel]);

  // 開いている間、入力欄の画面位置を追従（スクロール・リサイズ対応）
  useEffect(() => {
    if (!open) return;
    const update = () => {
      const el = inputRef.current;
      if (el) {
        const r = el.getBoundingClientRect();
        setRect({ left: r.left, top: r.top, bottom: r.bottom, width: r.width });
      }
    };
    update();
    window.addEventListener('scroll', update, true);
    window.addEventListener('resize', update);
    return () => {
      window.removeEventListener('scroll', update, true);
      window.removeEventListener('resize', update);
    };
  }, [open]);

  const normalizedQuery = normalize(query);
  const isSearching = query.length > 0 && query !== selectedLabel;

  const filtered = isSearching
    ? items
        .filter(item =>
          normalize(item.label).includes(normalizedQuery) ||
          normalize(item.value).includes(normalizedQuery),
        )
        .slice(0, MAX_SEARCH_RESULTS)
    : items.length <= SMALL_LIST_THRESHOLD
      ? items
      : [];

  const showSearchPrompt = open && !isSearching && items.length > SMALL_LIST_THRESHOLD;

  function select(item: ComboboxItem) {
    onChange(item.value);
    setQuery(item.label);
    setOpen(false);
  }

  return (
    <div ref={containerRef} style={{ position: 'relative' }}>
      {showLeadingIcon && (
        <img src={selectedItem!.icon} alt="" loading="lazy"
          onError={e => { (e.currentTarget.style.display = 'none'); }}
          style={{ position: 'absolute', left: 8, top: '50%', transform: 'translateY(-50%)', width: 20, height: 20, objectFit: 'contain', imageRendering: 'pixelated', pointerEvents: 'none' }} />
      )}
      <input
        ref={inputRef}
        type="text"
        value={query}
        onChange={e => { setQuery(e.target.value); setOpen(true); }}
        onFocus={() => setOpen(true)}
        placeholder={placeholder}
        autoComplete="off"
        style={{
          width: '100%', boxSizing: 'border-box',
          background: t.inputBg,
          color: t.text,
          border: `1px solid ${t.rim}`,
          borderRadius: 10, padding: '8px 10px', paddingLeft: showLeadingIcon ? 32 : 10,
          fontSize: 13, fontWeight: 600,
          outline: 'none',
          fontFamily: 'inherit',
        }}
      />
      {open && rect && (showSearchPrompt || filtered.length > 0) && (() => {
        // 画面下に十分な余白が無ければ上向きに開く
        const spaceBelow = window.innerHeight - rect.bottom - 12;
        const spaceAbove = rect.top - 12;
        const openUp = spaceBelow < 160 && spaceAbove > spaceBelow;
        const maxHeight = Math.min(260, Math.max(120, openUp ? spaceAbove : spaceBelow));
        const pos: React.CSSProperties = openUp
          ? { bottom: window.innerHeight - rect.top + 4 }
          : { top: rect.bottom + 4 };

        // Glass カードの overflow:hidden / isolation から脱出させるため #root へ portal
        return createPortal(
          <div
            ref={dropdownRef}
            style={{ position: 'fixed', left: rect.left, width: rect.width, zIndex: 1000, ...pos }}
          >
            {showSearchPrompt && (
              <div style={{
                background: t.glassTint,
                backdropFilter: 'blur(20px)', WebkitBackdropFilter: 'blur(20px)',
                border: `1px solid ${t.rim}`, borderRadius: 10, padding: '8px 12px',
                boxShadow: '0 8px 24px rgba(0,0,0,0.3)',
              }}>
                <span style={{ fontSize: 12, color: t.textMuted }}>名前を入力して検索（{items.length}件）</span>
              </div>
            )}
            {filtered.length > 0 && (
              <ul style={{
                background: t.glassTint,
                backdropFilter: 'blur(20px)', WebkitBackdropFilter: 'blur(20px)',
                border: `1px solid ${t.rim}`, borderRadius: 10, maxHeight, overflowY: 'auto',
                boxShadow: '0 8px 24px rgba(0,0,0,0.3)', listStyle: 'none', padding: 4, margin: 0,
              }}>
                {filtered.map(item => (
                  <li
                    key={item.value}
                    onMouseDown={() => select(item)}
                    style={{
                      padding: '8px 12px', fontSize: 13, color: t.text, fontWeight: 600,
                      cursor: 'pointer', borderRadius: 8,
                      display: 'flex', justifyContent: 'space-between',
                    }}
                    onMouseEnter={e => (e.currentTarget.style.background = t.glassChip)}
                    onMouseLeave={e => (e.currentTarget.style.background = 'transparent')}
                  >
                    <span style={{ display: 'flex', alignItems: 'center', gap: 8, minWidth: 0 }}>
                      {item.icon && (
                        <img src={item.icon} alt="" loading="lazy"
                          onError={e => { (e.currentTarget.style.display = 'none'); }}
                          style={{ width: 20, height: 20, objectFit: 'contain', imageRendering: 'pixelated', flexShrink: 0 }} />
                      )}
                      <span style={{ overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{item.label}</span>
                    </span>
                    {!hideValueHint && item.label !== item.value && (
                      <span style={{ color: t.textWeak, fontSize: 11, marginLeft: 8, flexShrink: 0 }}>{item.value}</span>
                    )}
                  </li>
                ))}
              </ul>
            )}
          </div>,
          document.getElementById('root')!,
        );
      })()}
    </div>
  );
}
