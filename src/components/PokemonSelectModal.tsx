import { useState, useMemo, useRef, useEffect } from 'react';
import { createPortal } from 'react-dom';
import type { ChampionsData, PokemonBuild } from '../types';
import { getSelectableRoster, getMegaForms } from '../data';
import { displayPokemonName, getPokemonJaList, TYPE_JA } from '../i18n';
import { Glass, GlassLayers } from './Glass';
import { useTheme, TYPE_COLORS } from '../theme';
import { getSpriteUrl, getFallbackSpriteUrl } from '../sprites';

// タイプ絞り込みバーの並び順（標準18タイプ）
const TYPE_ORDER = [
  'Normal', 'Fire', 'Water', 'Electric', 'Grass', 'Ice', 'Fighting', 'Poison', 'Ground',
  'Flying', 'Psychic', 'Bug', 'Rock', 'Ghost', 'Dragon', 'Dark', 'Steel', 'Fairy',
];

interface Props {
  data: ChampionsData;
  pokemonHistory: string[];
  myPartyMembers: (PokemonBuild | null)[];
  opponentMembers: PokemonBuild[];
  onSelect: (name: string) => void;
  onClose: () => void;
  /** 現在選択中ポケモンの英語 rosterName（省略可） */
  currentName?: string;
}

type TabType = 'all' | 'history' | 'party';

function toKatakana(str: string) {
  return str.replace(/[\u3041-\u3096]/g, m => String.fromCharCode(m.charCodeAt(0) + 0x60));
}

export function PokemonSelectModal({ data, pokemonHistory, myPartyMembers, opponentMembers, onSelect, onClose, currentName }: Props) {
  const t = useTheme();
  const [tab, setTab] = useState<TabType>('all');
  // currentName があれば初期値をその日本語名にする（フォーカス時に全選択で即上書き可能）
  const [search, setSearch] = useState(() => currentName ? displayPokemonName(currentName) : '');
  const [typeFilter, setTypeFilter] = useState<string | null>(null);
  // メガのみフィルタ
  const [megaOnly, setMegaOnly] = useState(false);

  // 検索 input への ref（autoFocus が効かないモバイル端末対策）
  const inputRef = useRef<HTMLInputElement>(null);
  useEffect(() => {
    // requestAnimationFrame でモーダル描画完了後にフォーカス＋全選択
    const raf = requestAnimationFrame(() => {
      inputRef.current?.focus();
      inputRef.current?.select();
    });
    return () => cancelAnimationFrame(raf);
  }, []);

  // rosterName → タイプ配列 / dexNumber（アイコンのフォールバック用）
  const typeMap = useMemo(() => {
    const m: Record<string, string[]> = {};
    data.roster.forEach(r => { m[r.name] = r.types; });
    return m;
  }, [data.roster]);
  const dexMap = useMemo(() => {
    const m: Record<string, number> = {};
    data.roster.forEach(r => { m[r.name] = r.dexNumber; });
    return m;
  }, [data.roster]);

  const roster = useMemo(() => getSelectableRoster(data.roster), [data.roster]);
  const pokemonItems = useMemo(() => getPokemonJaList(roster.map(r => r.name)), [roster]);

  // メガフォームを持つ rosterName のセット（#18）
  const megaSet = useMemo(() => {
    const s = new Set<string>();
    roster.forEach(r => {
      if (getMegaForms(data.baseStats, r.name).length > 0) s.add(r.name);
    });
    return s;
  }, [roster, data.baseStats]);

  const filteredAll = useMemo(() => {
    if (!search) return pokemonItems;
    const lowerSearch = search.toLowerCase();
    const searchKata = toKatakana(search);
    return pokemonItems.filter(p => {
      const labelKata = toKatakana(p.label);
      return labelKata.includes(searchKata) || p.value.toLowerCase().includes(lowerSearch);
    });
  }, [pokemonItems, search]);

  const partyItems = useMemo(() => {
    const items: { label: string; value: string }[] = [];
    myPartyMembers.forEach(m => { if (m?.rosterName) items.push({ label: displayPokemonName(m.rosterName), value: m.rosterName }); });
    opponentMembers.forEach(m => { if (m?.rosterName) items.push({ label: displayPokemonName(m.rosterName), value: m.rosterName }); });
    const unique = new Map<string, { label: string; value: string }>();
    items.forEach(item => unique.set(item.value, item));
    return Array.from(unique.values());
  }, [myPartyMembers, opponentMembers]);

  const historyItems = useMemo(() =>
    pokemonHistory.map(name => ({ label: displayPokemonName(name), value: name })),
    [pokemonHistory],
  );

  const baseItems = tab === 'all' ? filteredAll : tab === 'history' ? historyItems : partyItems;

  // 現在のタブに含まれるタイプだけをバーに出す（標準順）
  const availableTypes = useMemo(() => {
    const present = new Set<string>();
    baseItems.forEach(it => (typeMap[it.value] ?? []).forEach(ty => present.add(ty)));
    return TYPE_ORDER.filter(ty => present.has(ty));
  }, [baseItems, typeMap]);

  // タイプフィルタ・メガのみフィルタを順に適用（検索との併用可）
  const activeItems = useMemo(() => {
    let items = baseItems;
    if (typeFilter) items = items.filter(it => (typeMap[it.value] ?? []).includes(typeFilter));
    if (megaOnly) items = items.filter(it => megaSet.has(it.value));
    return items;
  }, [baseItems, typeFilter, megaOnly, typeMap, megaSet]);

  const tabLabels: { key: TabType; label: string }[] = [
    { key: 'all', label: '全て' },
    { key: 'history', label: '履歴' },
    { key: 'party', label: 'パーティ' },
  ];

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
          <span style={{ fontSize: 17, fontWeight: 800, color: t.text }}>ポケモンを選択</span>
          <button onClick={onClose} style={{ color: t.textMuted, background: 'none', border: 'none', cursor: 'pointer', fontSize: 20, padding: '0 4px' }}>✕</button>
        </div>

        {/* 検索バー */}
        <div style={{ position: 'relative', zIndex: 3, padding: '0 12px 10px' }}>
          <div style={{ position: 'relative' }}>
            <svg style={{ position: 'absolute', left: 10, top: '50%', transform: 'translateY(-50%)', color: t.textMuted }} width="14" height="14" viewBox="0 0 14 14" fill="none">
              <circle cx="6" cy="6" r="4.5" stroke="currentColor" strokeWidth="1.5"/>
              <path d="M9.5 9.5L13 13" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round"/>
            </svg>
            <input
              ref={inputRef}
              type="text"
              inputMode="search"
              value={search}
              onChange={e => setSearch(e.target.value)}
              placeholder="名前で検索... (ひらがな/カタカナ)"
              autoFocus
              // フォーカス時に全選択 → そのまま打ち直しで即置換できる
              onFocus={e => e.currentTarget.select()}
              style={{
                width: '100%', boxSizing: 'border-box',
                background: t.glassNest, color: t.text,
                border: `1px solid ${t.rim}`,
                borderRadius: 12, padding: '9px 12px 9px 32px',
                fontSize: 14, outline: 'none', fontFamily: 'inherit',
              }}
            />
          </div>
        </div>

        {/* タブ */}
        <div style={{ position: 'relative', zIndex: 3, display: 'flex', gap: 6, padding: '0 12px 10px' }}>
          {tabLabels.map(({ key, label }) => (
            <button
              key={key}
              onClick={() => setTab(key)}
              style={{
                flex: 1, padding: '7px 0', fontSize: 13, fontWeight: 700,
                borderRadius: 10, border: 'none', cursor: 'pointer',
                background: tab === key ? t.tabActiveBg : t.glassChip2,
                boxShadow: tab === key ? t.tabActiveShadow : `inset 0 0 0 0.5px ${t.rim}`,
                color: tab === key ? t.text : t.textMuted,
                transition: 'all 0.2s',
              }}
            >{label}</button>
          ))}
        </div>

        {/* タイプ絞り込みバー */}
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
                    padding: '4px 10px', borderRadius: 999, fontSize: 11, fontWeight: 700, cursor: 'pointer', border: 'none',
                    background: c.bg, color: c.fg,
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

        {/* メガのみトグルチップ（#18） */}
        <div style={{ position: 'relative', zIndex: 3, display: 'flex', padding: '0 12px 10px' }}>
          <button
            onClick={() => setMegaOnly(v => !v)}
            style={{
              padding: '4px 12px', borderRadius: 999, fontSize: 11, fontWeight: 700, cursor: 'pointer', border: 'none',
              background: megaOnly ? 'rgba(255,180,50,0.28)' : t.glassChip2,
              color: megaOnly ? '#f5a623' : t.textMuted,
              boxShadow: `inset 0 0 0 0.5px ${megaOnly ? 'rgba(245,166,35,0.7)' : t.rim}`,
              transition: 'all 0.15s',
            }}
          >⚡ メガのみ</button>
        </div>

        {/* リスト */}
        <div style={{ position: 'relative', zIndex: 3, flex: 1, overflowY: 'auto', padding: '0 8px 12px' }}>
          {activeItems.length === 0 ? (
            <div style={{ textAlign: 'center', color: t.textMuted, padding: '32px 0', fontSize: 14 }}>
              ポケモンが見つかりません
            </div>
          ) : (
            <div style={{ display: 'flex', flexDirection: 'column', gap: 4 }}>
              {activeItems.map(item => (
                <button
                  key={item.value}
                  onClick={() => { onSelect(item.value); onClose(); }}
                  style={{
                    width: '100%', textAlign: 'left',
                    display: 'flex', alignItems: 'center', gap: 8,
                    padding: '8px 14px', borderRadius: 12,
                    background: t.glassChip2, border: `1px solid ${t.rim}`,
                    color: t.text, fontSize: 15, fontWeight: 700,
                    cursor: 'pointer', transition: 'background 0.15s',
                  }}
                  onMouseEnter={e => (e.currentTarget.style.background = t.glassChip)}
                  onMouseLeave={e => (e.currentTarget.style.background = t.glassChip2)}
                >
                  <img
                    src={getSpriteUrl(item.value)}
                    onError={e => { const dex = dexMap[item.value]; if (dex) (e.target as HTMLImageElement).src = getFallbackSpriteUrl(dex); }}
                    alt=""
                    style={{ width: 32, height: 32, imageRendering: 'pixelated', flexShrink: 0 }}
                  />
                  <span style={{ flex: 1, minWidth: 0, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{item.label}</span>
                  {/* 右側にタイプピル */}
                  <span style={{ display: 'flex', gap: 4, flexShrink: 0 }}>
                    {(typeMap[item.value] ?? []).map(ty => {
                      const c = TYPE_COLORS[ty] ?? { bg: 'rgba(120,120,120,0.6)', fg: '#fff' };
                      return (
                        <span key={ty} style={{
                          padding: '2px 8px', borderRadius: 999, fontSize: 10, fontWeight: 700,
                          background: c.bg, color: c.fg,
                          boxShadow: 'inset 0 1px 0 rgba(255,255,255,0.4), 0 1px 2px rgba(0,0,0,0.15)',
                          whiteSpace: 'nowrap',
                        }}>{TYPE_JA[ty] ?? ty}</span>
                      );
                    })}
                  </span>
                </button>
              ))}
            </div>
          )}
        </div>
      </div>
    </div>,
    document.getElementById('root')!,
  );
}
