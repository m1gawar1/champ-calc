import { useState, useMemo } from 'react';
import { NatureModal } from './NatureModal';
import { Glass } from './Glass';
import { SpSlider } from './Glass';
import { computeStats } from '../engine/stats';
import { useTheme, TYPE_COLORS } from '../theme';
import { SelectModal } from './SelectModal';
import type { ChampionsData, PokemonBuild, SpAlloc } from '../types';
import { DEFAULT_IVS, DEFAULT_SP } from '../types';
import type { AppStore, SavedParty } from '../store';
import { newParty, opponentBuild, addPokemonToHistory, addBattleHistory, addBoxPokemon, updateBoxPokemon, removeBoxPokemon } from '../store';
import { getMegaForms, getSelectableRoster, getPokemonLearnset, findBaseStats } from '../data';
import { PokemonSelectModal } from './PokemonSelectModal';
import { getPokemonJaList, displayPokemonName, moveJa, NATURE_JA, STAT_JA, TYPE_JA } from '../i18n';
import { getSpriteUrl, getFallbackSpriteUrl, getBaseSpriteFromName, getMegaSpriteUrl, KEY_STONE_ICON } from '../sprites';
import { getAbilityItems, getAllItemItems, resolveItem, ITEM_CATEGORIES } from '../engine/competitive';
import { getMegaStone, getMegaStoneLabel } from '../data/megaStones';

interface Props {
  data: ChampionsData;
  store: AppStore;
  onUpdate: (partial: Partial<AppStore>) => void;
}

function emptyBuild(name = ''): PokemonBuild {
  return { rosterName: name, isMega: false, megaFormName: '', nature: 'Hardy', ivs: DEFAULT_IVS, sp: { ...DEFAULT_SP }, item: '', ability: '', moves: [] };
}

// タイプpill（ダメ計画面と同じ見た目）
function TypePill({ type, size = 10 }: { type: string; size?: number }) {
  const c = TYPE_COLORS[type] ?? { bg: 'rgba(120,120,120,0.6)', fg: '#fff' };
  return (
    <span style={{
      display: 'inline-flex', alignItems: 'center', justifyContent: 'center',
      padding: `3px ${size <= 9 ? 6 : 9}px`, borderRadius: 999,
      fontSize: size, fontWeight: 700,
      background: c.bg, color: c.fg, letterSpacing: 0.2,
      boxShadow: 'inset 0 1px 0 rgba(255,255,255,0.4), 0 1px 2px rgba(0,0,0,0.15)',
      whiteSpace: 'nowrap',
    }}>
      {TYPE_JA[type] ?? type}
    </span>
  );
}

// メガシンカ共通の目印（キーストーン）アイコン
function KeyStone({ size = 14 }: { size?: number }) {
  return (
    <img src={KEY_STONE_ICON} alt="" onError={e => { e.currentTarget.style.display = 'none'; }}
      style={{ width: size, height: size, objectFit: 'contain', imageRendering: 'pixelated', flexShrink: 0 }} />
  );
}

// 1体分のビルドエディタ
function MemberEditor({ build, onChange, onRemove, data, index, store, onUpdateHistory, defaultOpen, hideIndex }: {
  build: PokemonBuild; onChange: (b: PokemonBuild) => void;
  onRemove: () => void; data: ChampionsData; index: number;
  store: AppStore; onUpdateHistory: (name: string) => void;
  defaultOpen?: boolean; // 初期展開状態（ボックス追加時などに true）
  hideIndex?: boolean;   // スロット番号を隠す（ボックスなど単体編集時）
}) {
  const t = useTheme();
  const [open, setOpen] = useState(defaultOpen ?? false);
  const [showNatureModal, setShowNatureModal] = useState(false);
  const [showPokemonModal, setShowPokemonModal] = useState(false);
  const [showItemModal, setShowItemModal] = useState(false);
  const [openMoveSlot, setOpenMoveSlot] = useState<number | null>(null);
  const rosterNames = useMemo(() => getSelectableRoster(data.roster).map(r => r.name), [data.roster]);
  const pokemonItems = useMemo(() => getPokemonJaList(rosterNames), [rosterNames]);
  const megaForms = useMemo(() => (build.rosterName ? getMegaForms(data.baseStats, build.rosterName) : []), [data.baseStats, build.rosterName]);
  const rosterEntry = useMemo(() => getSelectableRoster(data.roster).find(r => r.name === build.rosterName), [data.roster, build.rosterName]);
  const megaRosterEntry = useMemo(() =>
    build.isMega && build.megaFormName ? data.roster.find(r => r.name === build.megaFormName) ?? null : null,
    [data.roster, build.isMega, build.megaFormName],
  );
  const activeEntry = megaRosterEntry ?? rosterEntry;
  const bs = useMemo(() => build.rosterName ? findBaseStats(data.baseStats, build.rosterName, build.isMega, build.megaFormName) : undefined,
    [data.baseStats, build.rosterName, build.isMega, build.megaFormName]);
  const nature = data.natures.find(n => n.name === build.nature) ?? { name: 'Hardy', increasedStat: null, decreasedStat: null };
  const computed = bs ? computeStats(bs, build.ivs, build.sp, nature) : null;
  const learnset = useMemo(() => build.rosterName ? getPokemonLearnset(data.learnsets, build.rosterName) : null, [data.learnsets, build.rosterName]);
  const moveCandidates = useMemo(() => {
    const all = data.moves.filter(m => m.inChampions !== false);
    return learnset ? all.filter(m => learnset.has(m.name)) : all;
  }, [data.moves, learnset]);
  // 技選択モーダル用（日本語名 + タイプ・威力・分類）。ダメ計画面の MoveSlots と同形式。
  const moveSelectItems = useMemo(() =>
    moveCandidates.map(m => ({ label: moveJa(m.name), value: m.name, sub: `${TYPE_JA[m.type] ?? m.type} ${m.power}`, type: m.type, power: m.power, category: m.category })),
    [moveCandidates]);
  const abilityItems = useMemo(() => getAbilityItems(activeEntry?.abilities ?? {}), [activeEntry]);
  // パーティ/ボックス編集は名前だけの全持ち物リスト（管理用）
  const itemItems = useMemo(() => getAllItemItems(), []);

  // SP合計66・各32上限でクランプ（66超過時は今振れる残量まで）
  function clampSp(key: keyof SpAlloc, val: number): number {
    const others = (['hp', 'atk', 'def', 'spa', 'spd', 'spe'] as const)
      .filter(k => k !== key).reduce((s, k) => s + build.sp[k], 0);
    return Math.max(0, Math.min(val, 32, 66 - others));
  }
  function setSp(key: keyof SpAlloc, val: number) { onChange({ ...build, sp: { ...build.sp, [key]: clampSp(key, val) } }); }
  function setMove(i: number, v: string) {
    const next = [...(build.moves ?? []), '', '', '', ''].slice(0, 4);
    next[i] = v;
    onChange({ ...build, moves: next.filter((_, idx) => idx < 4) });
  }
  function toggleMega(megaName: string, isOn: boolean) {
    const entry = data.roster.find(r => r.name === megaName);
    const autoAbility = isOn && entry ? Object.values(entry.abilities)[0] ?? '' : (rosterEntry ? Object.values(rosterEntry.abilities)[0] ?? '' : '');
    // メガシンカ時は持ち物を対応メガストーンに。解除時は外す。
    const item = isOn ? (getMegaStone(megaName)?.en ?? '') : '';
    onChange({ ...build, isMega: isOn, megaFormName: isOn ? megaName : '', ability: autoAbility, item });
  }

  const moves = [...(build.moves ?? []), '', '', '', ''].slice(0, 4);
  const displayName = build.isMega && build.megaFormName
    ? displayPokemonName(build.megaFormName) : build.rosterName ? displayPokemonName(build.rosterName) : hideIndex ? 'ポケモンを選択' : `スロット ${index + 1}`;
  const spTotal = Object.values(build.sp).reduce((a, b) => a + b, 0);
  const expanded = hideIndex || open; // 単体モード（ボックス）は常に展開

  return (
    <Glass tint={t.glassTint2} radius={18} padding={0} style={{ overflow: 'hidden' }}>
      {/* ヘッダー行（単体モードでは非表示） */}
      {!hideIndex && (
      <div style={{ display: 'flex', alignItems: 'center', gap: 8, padding: '10px 12px' }}>
        {!hideIndex && <span style={{ fontSize: 11, color: t.textWeak, width: 16 }}>{index + 1}</span>}
        {rosterEntry && (
          <img
            src={build.isMega && build.megaFormName
              ? getMegaSpriteUrl(rosterEntry.dexNumber, build.megaFormName)
              : getSpriteUrl(rosterEntry.name)}
            onError={e => {
              // Serebii / Showdown が404の場合、ベース種→dex番号の順でフォールバック（無限ループ防止）
              const img = e.target as HTMLImageElement;
              if (!img.dataset.fb) { img.dataset.fb = '1'; img.src = getBaseSpriteFromName(rosterEntry.name); }
              else { img.src = getFallbackSpriteUrl(rosterEntry.dexNumber); }
            }}
            alt=""
            style={{ width: 36, height: 36, imageRendering: 'pixelated', flexShrink: 0 }}
          />
        )}
        <button
          onClick={() => setOpen(o => !o)}
          style={{ display: 'flex', alignItems: 'center', gap: 6, minWidth: 0, flexShrink: 1, textAlign: 'left', background: 'none', border: 'none', cursor: 'pointer', padding: 0 }}
        >
          <span style={{ fontSize: 14, fontWeight: 700, color: t.text, whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>{displayName}</span>
          <span style={{ fontSize: 11, color: t.textWeak, flexShrink: 0 }}>{open ? '▲' : '▼'}</span>
        </button>
        {/* メガボタンは展開時のみ、名前のすぐ横に（折り返し防止のため flexShrink:0） */}
        {open && megaForms.length === 1 && (
          <button onClick={() => toggleMega(megaForms[0].name, !build.isMega)}
            style={{
              flexShrink: 0, display: 'inline-flex', alignItems: 'center', gap: 3,
              padding: '3px 8px', borderRadius: 99, fontSize: 11, fontWeight: 700,
              background: build.isMega ? 'linear-gradient(180deg, rgba(190,130,255,0.9), rgba(140,90,220,0.8))' : t.glassChip,
              boxShadow: `inset 0 0 0 0.5px ${t.rim}`,
              color: build.isMega ? '#fff' : t.textMuted, border: 'none', cursor: 'pointer',
            }}><KeyStone size={22} /></button>
        )}
        {open && megaForms.length > 1 && megaForms.map(mf => {
          const suffix = mf.name.replace(`Mega ${build.rosterName}`, '').trim() || 'メガ';
          const sel = build.isMega && build.megaFormName === mf.name;
          return (
            <button key={mf.name} onClick={() => toggleMega(mf.name, !sel)}
              style={{
                flexShrink: 0, display: 'inline-flex', alignItems: 'center', gap: 3,
                padding: '3px 7px', borderRadius: 99, fontSize: 11, fontWeight: 700,
                background: sel ? 'linear-gradient(180deg, rgba(190,130,255,0.9), rgba(140,90,220,0.8))' : t.glassChip,
                boxShadow: `inset 0 0 0 0.5px ${t.rim}`,
                color: sel ? '#fff' : t.textMuted, border: 'none', cursor: 'pointer',
              }}><KeyStone size={18} />{suffix === 'メガ' ? '' : suffix}</button>
          );
        })}
        {/* スペーサーで SP表示と✕を右端へ */}
        <div style={{ flex: 1 }} />
        {spTotal > 0 && !open && (
          <span style={{ fontSize: 10, color: t.textMuted, fontFamily: 'monospace', flexShrink: 0 }}>SP {spTotal}/66</span>
        )}
        <button onClick={onRemove} style={{ flexShrink: 0, color: t.textWeak, background: 'none', border: 'none', cursor: 'pointer', fontSize: 14, padding: '0 2px' }}>✕</button>
      </div>
      )}

      {/* 展開エリア */}
      {expanded && (
        <div style={{ padding: '0 12px 14px', borderTop: `1px solid ${t.rim}`, display: 'flex', flexDirection: 'column', gap: 12 }}>
          {/* ポケモン選択（単体モードはメガボタンを名前の右に並べる） */}
          <div style={{ paddingTop: 12, display: 'flex', alignItems: 'center', gap: 8 }}>
            <button onClick={() => setShowPokemonModal(true)}
              style={{
                flex: 1, minWidth: 0, background: t.glassNest, color: t.text,
                border: `1px solid ${t.rim}`, borderRadius: 12,
                padding: '10px 14px', fontSize: 14, fontWeight: 700, textAlign: 'left', cursor: 'pointer',
                overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap',
              }}>
              {build.rosterName ? displayPokemonName(build.rosterName) : 'ポケモンを選択...'}
            </button>
            {/* 単体モードはヘッダーが無いので、メガボタンを名前の右に表示 */}
            {hideIndex && megaForms.length > 0 && (
              <div style={{ display: 'flex', gap: 6, flexWrap: 'wrap', flexShrink: 0 }}>
                {megaForms.length === 1 ? (
                  <button onClick={() => toggleMega(megaForms[0].name, !build.isMega)}
                    style={{
                      display: 'inline-flex', alignItems: 'center', gap: 4,
                      padding: '5px 12px', borderRadius: 99, fontSize: 12, fontWeight: 700,
                      background: build.isMega ? 'linear-gradient(180deg, rgba(190,130,255,0.9), rgba(140,90,220,0.8))' : t.glassChip,
                      boxShadow: `inset 0 0 0 0.5px ${t.rim}`,
                      color: build.isMega ? '#fff' : t.textMuted, border: 'none', cursor: 'pointer',
                    }}><KeyStone size={24} /></button>
                ) : megaForms.map(mf => {
                  const suffix = mf.name.replace(`Mega ${build.rosterName}`, '').trim();
                  const sel = build.isMega && build.megaFormName === mf.name;
                  return (
                    <button key={mf.name} onClick={() => toggleMega(mf.name, !sel)}
                      style={{
                        display: 'inline-flex', alignItems: 'center', gap: 4,
                        padding: '5px 11px', borderRadius: 99, fontSize: 12, fontWeight: 700,
                        background: sel ? 'linear-gradient(180deg, rgba(190,130,255,0.9), rgba(140,90,220,0.8))' : t.glassChip,
                        boxShadow: `inset 0 0 0 0.5px ${t.rim}`,
                        color: sel ? '#fff' : t.textMuted, border: 'none', cursor: 'pointer',
                      }}><KeyStone size={20} />{suffix}</button>
                  );
                })}
              </div>
            )}
          </div>

          {/* 持ち物 + 特性 */}
          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 8 }}>
            <div>
              <div style={{ fontSize: 10, color: t.textMuted, marginBottom: 4, fontWeight: 600 }}>持ち物</div>
              {build.isMega ? (() => {
                // メガ時は持ち物をメガストーンに固定表示
                const it = resolveItem(build.item ?? '');
                // 独自メガは公式ストーンが無く item が空 → 汎用プレースホルダ（キーストーンアイコン）で表示
                const placeholder = !build.item;
                const itemLabel = placeholder ? getMegaStoneLabel(build.megaFormName).ja : it.label;
                const itemIcon = placeholder ? KEY_STONE_ICON : it.icon;
                return (
                  <div style={{
                    display: 'flex', alignItems: 'center', gap: 6,
                    background: t.inputBg, border: `1px solid ${t.rim}`, borderRadius: 10,
                    padding: '8px 10px', fontSize: 13, fontWeight: 600, color: t.text,
                    overflow: 'hidden', whiteSpace: 'nowrap',
                  }}>
                    {itemIcon && (
                      <img src={itemIcon} alt="" loading="lazy"
                        onError={e => { e.currentTarget.style.display = 'none'; }}
                        style={{ width: 20, height: 20, objectFit: 'contain', imageRendering: 'pixelated', flexShrink: 0 }} />
                    )}
                    <span style={{ overflow: 'hidden', textOverflow: 'ellipsis' }}>{itemLabel}</span>
                  </div>
                );
              })() : (() => {
                // 技と同じ検索付きモーダルで選択
                const it = resolveItem(build.item ?? '');
                return (
                  <button onClick={() => setShowItemModal(true)}
                    style={{
                      width: '100%', textAlign: 'left', cursor: 'pointer',
                      display: 'flex', alignItems: 'center', gap: 6,
                      background: t.inputBg, color: build.item ? t.text : t.textMuted,
                      border: `1px solid ${t.rim}`, borderRadius: 10,
                      padding: '8px 10px', fontSize: 13, fontWeight: 600, fontFamily: 'inherit',
                      overflow: 'hidden', whiteSpace: 'nowrap',
                    }}>
                    {it.icon && (
                      <img src={it.icon} alt="" loading="lazy"
                        onError={e => { e.currentTarget.style.display = 'none'; }}
                        style={{ width: 20, height: 20, objectFit: 'contain', imageRendering: 'pixelated', flexShrink: 0 }} />
                    )}
                    <span style={{ overflow: 'hidden', textOverflow: 'ellipsis' }}>{it.label}</span>
                  </button>
                );
              })()}
            </div>
            <div>
              <div style={{ fontSize: 10, color: t.textMuted, marginBottom: 4, fontWeight: 600 }}>特性</div>
              <select
                value={build.ability ?? ''}
                onChange={e => onChange({ ...build, ability: e.target.value })}
                style={{
                  width: '100%', background: t.inputBg, color: t.text,
                  border: `1px solid ${t.rim}`, borderRadius: 10,
                  padding: '8px 10px', fontSize: 13, outline: 'none',
                }}
              >
                {abilityItems.map(a => <option key={a.value} value={a.value}>{a.label}</option>)}
              </select>
            </div>
          </div>

          {/* 技（ダメ計画面と同じ：タップでモーダル選択、タイプ・分類・威力を表示） */}
          <div>
            <div style={{ fontSize: 10, color: t.textMuted, marginBottom: 6, fontWeight: 600 }}>技</div>
            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 8 }}>
              {moves.map((mv, i) => {
                const mvData = data.moves.find(m => m.name === mv);
                const isActive = !!mv;
                return (
                  <Glass key={i} tint={isActive ? 'rgba(90,200,250,0.12)' : t.glassChip2} radius={14} padding={10} blur={14} rim={isActive ? t.rimAccent : t.btnSoftRim}>
                    <button
                      onClick={() => setOpenMoveSlot(i)}
                      style={{
                        width: '100%', textAlign: 'left', cursor: 'pointer',
                        background: t.inputBg, color: mv ? t.text : t.textMuted,
                        border: `1px solid ${t.rim}`, borderRadius: 10,
                        padding: '8px 10px', fontSize: 13, fontWeight: 600, fontFamily: 'inherit',
                        overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap',
                      }}
                    >
                      {mv ? moveJa(mv) : `技${i + 1}`}
                    </button>
                    {mvData && (
                      <div style={{ display: 'flex', alignItems: 'center', gap: 5, marginTop: 6 }}>
                        <TypePill type={mvData.type} size={9} />
                        <span style={{ fontSize: 9, color: t.textMuted }}>{mvData.category === 'Physical' ? '物理' : mvData.category === 'Special' ? '特殊' : '変化'}</span>
                        <span style={{ fontFamily: 'monospace', fontSize: 10, color: t.text, fontWeight: 700, marginLeft: 'auto' }}>{mvData.power}</span>
                      </div>
                    )}
                  </Glass>
                );
              })}
            </div>
          </div>

          {/* 性格 */}
          <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
            <span style={{ fontSize: 11, color: t.textMuted, fontWeight: 600, width: 28 }}>性格</span>
            <button
              onClick={() => setShowNatureModal(true)}
              style={{
                flex: 1, background: t.glassNest, border: `1px solid ${t.rim}`,
                borderRadius: 10, padding: '8px 12px', fontSize: 13, fontWeight: 600,
                color: t.text, textAlign: 'left', cursor: 'pointer',
              }}
            >{NATURE_JA[build.nature] ?? build.nature}</button>
          </div>

          {/* SP振り */}
          <div>
            <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: 10 }}>
              <span style={{ fontSize: 11, color: t.textMuted, fontWeight: 600 }}>SP振り</span>
              <span style={{ fontSize: 11, color: t.textWeak, fontFamily: 'monospace' }}>{spTotal}/66</span>
            </div>
            <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
              {(['hp', 'atk', 'def', 'spa', 'spd', 'spe'] as const).map(k => (
                <SpSlider key={k}
                  label={{ hp: 'HP(H)', atk: '攻撃(A)', def: '防御(B)', spa: '特攻(C)', spd: '特防(D)', spe: '素早さ(S)' }[k]}
                  value={build.sp[k]}
                  onChange={v => setSp(k, v)}
                  actual={computed?.[k]}
                />
              ))}
            </div>
          </div>
        </div>
      )}

      {openMoveSlot !== null && (
        <SelectModal
          key={openMoveSlot}            // スロット切替で再マウントし検索欄・フィルタをリセット
          title={`技${openMoveSlot + 1} を選択`}
          items={[{ label: '（なし）', value: '' }, ...moveSelectItems]}
          value={moves[openMoveSlot]}
          onSelect={v => {
            setMove(openMoveSlot, v);
            // 1つ選ぶと次の技スロットへ自動で切替。4つ目（slot 3）を選んだら閉じる
            if (openMoveSlot < 3) setOpenMoveSlot(openMoveSlot + 1);
            else setOpenMoveSlot(null);
          }}
          onClose={() => setOpenMoveSlot(null)}
          sortable
          persistKey="champ_move_sort"
          keepOpenOnSelect
        />
      )}
      {showItemModal && (
        <SelectModal
          title="持ち物を選択"
          items={itemItems}
          value={build.item ?? ''}
          onSelect={v => onChange({ ...build, item: v })}
          onClose={() => setShowItemModal(false)}
          categoryOptions={ITEM_CATEGORIES}
        />
      )}
      {showNatureModal && (
        <NatureModal value={build.nature} onChange={n => onChange({ ...build, nature: n })} onClose={() => setShowNatureModal(false)} />
      )}
      {showPokemonModal && (
        <PokemonSelectModal
          data={data} pokemonHistory={store.pokemonHistory}
          myPartyMembers={store.myParties.find(p => p.id === store.activePartyId)?.members ?? []}
          opponentMembers={store.opponentParty}
          currentName={build.rosterName}
          onSelect={name => { onChange({ ...emptyBuild(name) }); onUpdateHistory(name); }}
          onClose={() => setShowPokemonModal(false)}
        />
      )}
    </Glass>
  );
}

// パーティ編集フォーム
function PartyEditor({ party, data, onSave, onCancel, store, onUpdateHistory }: {
  party: SavedParty; data: ChampionsData;
  onSave: (p: SavedParty) => void; onCancel: () => void;
  store: AppStore; onUpdateHistory: (name: string) => void;
}) {
  const t = useTheme();
  const [draft, setDraft] = useState<SavedParty>(() => ({
    ...party,
    members: [...Array(6)].map((_, i) => party.members[i] ?? null),
  }));
  // 全画面シートで編集中のメンバーインデックス（null なら一覧表示）
  const [editingIndex, setEditingIndex] = useState<number | null>(null);

  function setMember(i: number, build: PokemonBuild) {
    const next = [...draft.members] as (PokemonBuild | null)[];
    next[i] = build;
    setDraft({ ...draft, members: next });
  }
  function removeMember(i: number) {
    const next = [...draft.members] as (PokemonBuild | null)[];
    next[i] = null;
    setDraft({ ...draft, members: next });
  }
  // 空枠を追加し、追加先インデックスを返す（無ければ null）
  function addSlot(): number | null {
    const firstEmpty = draft.members.findIndex(m => !m);
    if (firstEmpty === -1) return null;
    setMember(firstEmpty, emptyBuild());
    return firstEmpty;
  }

  const filledCount = draft.members.filter(Boolean).length;

  // ボックスピッカーモーダルの表示状態
  const [showBoxPicker, setShowBoxPicker] = useState(false);

  // ボックス個体をコピーして最初の空スロットに追加。追加先インデックスを返す（無ければ null）
  function addFromBox(build: PokemonBuild): number | null {
    const firstEmpty = draft.members.findIndex(m => !m);
    if (firstEmpty === -1) return null;
    setMember(firstEmpty, structuredClone(build)); // 原本を壊さないようディープコピー
    return firstEmpty;
  }

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
      <input
        type="text" value={draft.name}
        onChange={e => setDraft({ ...draft, name: e.target.value })}
        placeholder="パーティ名"
        style={{
          width: '100%', boxSizing: 'border-box',
          background: t.inputBg, color: t.text,
          border: `1px solid ${t.rim}`, borderRadius: 12,
          padding: '10px 14px', fontSize: 15, fontWeight: 700, outline: 'none',
        }}
      />
      {/* メンバーはサマリ行で一覧表示。タップで全画面シート編集 */}
      <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
        {draft.members.map((m, i) => {
          if (m === null) return null;
          const rosterEntry = getSelectableRoster(data.roster).find(r => r.name === m.rosterName);
          const filled = !!m.rosterName;
          const name = m.isMega && m.megaFormName
            ? displayPokemonName(m.megaFormName)
            : filled ? displayPokemonName(m.rosterName) : 'ポケモンを選択';
          return (
            <Glass key={i} tint={t.glassTint2} radius={16} padding={0} style={{ overflow: 'hidden' }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: 8, padding: '10px 12px' }}>
                <button
                  onClick={() => setEditingIndex(i)}
                  style={{ flex: 1, minWidth: 0, display: 'flex', alignItems: 'center', gap: 8, background: 'none', border: 'none', cursor: 'pointer', padding: 0, textAlign: 'left' }}
                >
                  {rosterEntry ? (
                    <img
                      src={m.isMega && m.megaFormName
                        ? getMegaSpriteUrl(rosterEntry.dexNumber, m.megaFormName)
                        : getSpriteUrl(rosterEntry.name)}
                      onError={e => {
                        // Serebii / Showdown が404の場合、ベース種→dex番号の順でフォールバック（無限ループ防止）
                        const img = e.target as HTMLImageElement;
                        if (!img.dataset.fb) { img.dataset.fb = '1'; img.src = getBaseSpriteFromName(rosterEntry.name); }
                        else { img.src = getFallbackSpriteUrl(rosterEntry.dexNumber); }
                      }}
                      alt=""
                      style={{ width: 36, height: 36, imageRendering: 'pixelated', flexShrink: 0 }}
                    />
                  ) : (
                    <span style={{ width: 36, height: 36, flexShrink: 0 }} />
                  )}
                  <span style={{ fontSize: 14, fontWeight: 700, color: filled ? t.text : t.textMuted, whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>{name}</span>
                </button>
                <button onClick={() => removeMember(i)} style={{ flexShrink: 0, color: t.textWeak, background: 'none', border: 'none', cursor: 'pointer', fontSize: 14, padding: '0 2px' }}>✕</button>
              </div>
            </Glass>
          );
        })}
      </div>
      {filledCount < 6 && (
        <button
          onClick={() => {
            // ボックスに個体があれば選択モーダルを開く、なければ空枠追加してすぐ編集シートを開く
            if (store.box.length > 0) {
              setShowBoxPicker(true);
            } else {
              const idx = addSlot();
              if (idx !== null) setEditingIndex(idx);
            }
          }}
          style={{
            width: '100%', padding: '12px 0',
            border: `1px dashed ${t.dashedRim}`, borderRadius: 16,
            color: t.textMuted, fontSize: 14, fontWeight: 600,
            background: 'transparent', cursor: 'pointer',
          }}
        >+ ポケモンを追加</button>
      )}

      {/* ボックスから個体を選ぶピッカーモーダル */}
      {showBoxPicker && (
        <div
          onClick={() => setShowBoxPicker(false)}
          style={{
            position: 'fixed', inset: 0, zIndex: 200, background: 'rgba(0,0,0,0.5)',
            display: 'flex', alignItems: 'center', justifyContent: 'center', padding: 0,
          }}
        >
          <div
            onClick={e => e.stopPropagation()}
            style={{ width: '100%', height: '100dvh', overflowY: 'auto', WebkitOverflowScrolling: 'touch', paddingBottom: 'calc(env(safe-area-inset-bottom) + 8px)' } as React.CSSProperties}
          >
            <Glass tint={t.glassTint} radius={0} padding={16}>
              {/* ヘッダー（ノッチ対策で上端にセーフエリア余白） */}
              <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 12, paddingTop: 'env(safe-area-inset-top)' }}>
                <div style={{ fontSize: 11, fontWeight: 800, color: t.textMuted, letterSpacing: 1.4 }}>
                  ボックスから追加
                </div>
                <button
                  onClick={() => setShowBoxPicker(false)}
                  aria-label="閉じる"
                  style={{ color: t.textMuted, background: 'none', border: 'none', cursor: 'pointer', fontSize: 20, padding: '0 4px', lineHeight: 1 }}
                >✕</button>
              </div>

              {/* 空の個体を追加ボタン */}
              <button
                onClick={() => { const idx = addSlot(); setShowBoxPicker(false); if (idx !== null) setEditingIndex(idx); }}
                style={{
                  width: '100%', padding: '10px 0', marginBottom: 12,
                  border: `1px dashed ${t.dashedRim}`, borderRadius: 12,
                  color: t.textMuted, fontSize: 13, fontWeight: 600,
                  background: 'transparent', cursor: 'pointer',
                }}
              >＋ 空の個体を追加</button>

              {/* ボックス個体グリッド */}
              <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3, 1fr)', gap: 8 }}>
                {store.box.map(b => {
                  const entry = data.roster.find(r => r.name === b.build.rosterName);
                  const spriteName = b.build.isMega && b.build.megaFormName ? b.build.megaFormName : b.build.rosterName;
                  return (
                    <Glass key={b.id} tint={t.glassTint} radius={16} padding={10}
                      onClick={() => { const idx = addFromBox(b.build); setShowBoxPicker(false); if (idx !== null) setEditingIndex(idx); }}
                      style={{ cursor: 'pointer' }}>
                      <div style={{
                        width: '100%', aspectRatio: '1', borderRadius: 12, background: t.glassChip,
                        boxShadow: `inset 0 0 0 0.5px ${t.btnSoftRim}`,
                        display: 'flex', alignItems: 'center', justifyContent: 'center', overflow: 'hidden', marginBottom: 6,
                      }}>
                        <img
                          src={b.build.isMega && b.build.megaFormName && entry
                            ? getMegaSpriteUrl(entry.dexNumber, b.build.megaFormName)
                            : getSpriteUrl(spriteName)}
                          onError={e => {
                            // Serebii / Showdown が404の場合、dex番号でフォールバック（無限ループ防止）
                            const img = e.target as HTMLImageElement;
                            if (img.dataset.fellBack) { img.style.opacity = '0'; return; }
                            img.dataset.fellBack = '1';
                            if (entry) img.src = getFallbackSpriteUrl(entry.dexNumber);
                          }}
                          alt="" style={{ width: '85%', height: '85%', objectFit: 'contain', imageRendering: 'pixelated' }}
                        />
                      </div>
                      <div style={{ fontSize: 12, fontWeight: 700, color: t.text, textAlign: 'center', whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>
                        {displayPokemonName(spriteName)}
                      </div>
                      {b.nickname && (
                        <div style={{ fontSize: 10, color: t.textMuted, textAlign: 'center', whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>
                          {b.nickname}
                        </div>
                      )}
                    </Glass>
                  );
                })}
              </div>
            </Glass>
          </div>
        </div>
      )}

      {/* メンバー編集の全画面シート（ボックスの個体編集シートと同形式） */}
      {editingIndex !== null && draft.members[editingIndex] && (
        <div
          onClick={() => setEditingIndex(null)}
          style={{
            position: 'fixed', inset: 0, zIndex: 200, background: 'rgba(0,0,0,0.5)',
            display: 'flex', alignItems: 'center', justifyContent: 'center', padding: 0,
          }}
        >
          <div
            onClick={e => e.stopPropagation()}
            style={{ width: '100%', height: '100dvh', overflowY: 'auto', WebkitOverflowScrolling: 'touch', paddingBottom: 'calc(env(safe-area-inset-bottom) + 8px)' } as React.CSSProperties}
          >
            <Glass tint={t.glassTint} radius={0} padding={16}>
              {/* ヘッダー（ノッチ対策で上端にセーフエリア余白） */}
              <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 12, paddingTop: 'env(safe-area-inset-top)' }}>
                <div style={{ fontSize: 11, fontWeight: 800, color: t.textMuted, letterSpacing: 1.4 }}>
                  ポケモンを編集
                </div>
                <button
                  onClick={() => setEditingIndex(null)}
                  aria-label="閉じる"
                  style={{ color: t.textMuted, background: 'none', border: 'none', cursor: 'pointer', fontSize: 20, padding: '0 4px', lineHeight: 1 }}
                >✕</button>
              </div>
              <MemberEditor
                build={draft.members[editingIndex]!}
                onChange={b => setMember(editingIndex!, b)}
                onRemove={() => { removeMember(editingIndex!); setEditingIndex(null); }}
                data={data} index={editingIndex!}
                store={store} onUpdateHistory={onUpdateHistory}
                defaultOpen hideIndex
              />
            </Glass>
          </div>
        </div>
      )}

      {/* 下タブバー（固定）と重ならないようセーフエリア分の余白を確保 */}
      <div style={{ display: 'flex', gap: 8, marginBottom: 'calc(env(safe-area-inset-bottom) + 8px)' }}>
        <button
          onClick={() => onSave(draft)}
          style={{
            flex: 1, padding: '12px 0', borderRadius: 14,
            background: 'linear-gradient(180deg, rgba(90,200,250,0.8), rgba(60,160,220,0.7))',
            boxShadow: 'inset 0 1px 0 rgba(255,255,255,0.4), 0 4px 12px rgba(90,200,250,0.3)',
            color: '#fff', fontSize: 14, fontWeight: 800, border: 'none', cursor: 'pointer',
          }}
        >保存</button>
        <button
          onClick={onCancel}
          style={{
            flex: 1, padding: '12px 0', borderRadius: 14,
            background: t.glassChip, boxShadow: `inset 0 0 0 0.5px ${t.rim}`,
            color: t.textMuted, fontSize: 14, fontWeight: 700, border: 'none', cursor: 'pointer',
          }}
        >キャンセル</button>
      </div>
    </div>
  );
}

// パーティカード（一覧表示）
function PartyCard({ party, isActive, onActivate, onEdit, onDelete, data }: {
  party: SavedParty; isActive: boolean;
  onActivate: () => void; onEdit: () => void; onDelete: () => void;
  data: ChampionsData;
}) {
  const t = useTheme();
  const members = party.members.filter(Boolean) as PokemonBuild[];

  return (
    <Glass
      tint={isActive ? t.glassDeep : t.glassTint2}
      radius={22}
      padding={14}
      rim={isActive ? t.rimActive : undefined}
    >
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 12 }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
          <span style={{ fontSize: 16, fontWeight: 800, color: t.text }}>{party.name}</span>
          {isActive && (
            <span style={{
              fontSize: 10, fontWeight: 800, padding: '3px 10px', borderRadius: 99,
              background: t.badgeAtkBg, color: t.badgeAtkFg,
              boxShadow: 'inset 0 1px 0 rgba(255,255,255,0.5), 0 2px 8px rgba(90,200,250,0.4)',
              letterSpacing: 0.4,
            }}>使用中</span>
          )}
        </div>
        <div style={{ display: 'flex', gap: 4 }}>
          <button onClick={onEdit} style={{ fontSize: 12, color: t.textMuted, background: 'none', border: 'none', cursor: 'pointer', padding: '4px 8px' }}>編集</button>
          <button onClick={onDelete} style={{ fontSize: 12, color: t.textWeak, background: 'none', border: 'none', cursor: 'pointer', padding: '4px 8px' }}>削除</button>
        </div>
      </div>

      {/* メンバーグリッド */}
      {members.length === 0 ? (
        <span style={{ fontSize: 12, color: t.textWeak }}>メンバーなし</span>
      ) : (
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(6, 1fr)', gap: 4, marginBottom: isActive ? 0 : 12 }}>
          {members.slice(0, 6).map((m, i) => {
            const entry = data.roster.find(r => r.name === m.rosterName);
            if (!entry) return null;
            const spriteName = m.isMega && m.megaFormName ? m.megaFormName : entry.name;
            const jaName = displayPokemonName(spriteName);
            return (
              <div key={i} title={jaName} style={{
                position: 'relative', width: '100%', aspectRatio: '1', borderRadius: 12,
                background: t.glassChip2,
                boxShadow: `inset 0 0 0 0.5px ${t.btnSoftRim}, inset 0 1px 0 rgba(255,255,255,0.12)`,
                display: 'flex', alignItems: 'center', justifyContent: 'center', overflow: 'hidden',
              }}>
                <img
                  src={m.isMega && m.megaFormName
                    ? getMegaSpriteUrl(entry.dexNumber, m.megaFormName)
                    : getSpriteUrl(spriteName)}
                  onError={e => {
                    // Serebii / Showdown が404の場合、dex番号でフォールバック（無限ループ防止）
                    const img = e.target as HTMLImageElement;
                    if (img.dataset.fellBack) { img.style.opacity = '0'; return; }
                    img.dataset.fellBack = '1';
                    img.src = getFallbackSpriteUrl(entry.dexNumber);
                  }}
                  alt={jaName}
                  style={{ width: '85%', height: '85%', objectFit: 'contain', imageRendering: 'pixelated' }}
                />
                {m.isMega && (
                  <span style={{
                    position: 'absolute', top: 1, right: 1,
                    display: 'inline-flex', padding: 1, borderRadius: 99,
                    background: 'rgba(0,0,0,0.25)',
                  }}>
                    <KeyStone size={18} />
                  </span>
                )}
              </div>
            );
          })}
        </div>
      )}

      {!isActive && (
        <button
          onClick={onActivate}
          style={{
            width: '100%', padding: '8px 0', borderRadius: 12,
            background: t.glassChip, boxShadow: `inset 0 0 0 0.5px ${t.rimAccent}`,
            color: t.accentAtk, fontSize: 12, fontWeight: 700, border: 'none', cursor: 'pointer',
          }}
        >対戦で使用する</button>
      )}
    </Glass>
  );
}

// 相手パーティ編集
function OpponentEditor({ members, data, onChange, store, onUpdateHistory }: {
  members: PokemonBuild[]; data: ChampionsData;
  onChange: (members: PokemonBuild[]) => void;
  store: AppStore; onUpdateHistory: (name: string) => void;
}) {
  const t = useTheme();
  const [modalIndex, setModalIndex] = useState<number | null>(null);
  const slots = [...Array(6)].map((_, i) => members[i] ?? opponentBuild());

  function setSlot(i: number, build: PokemonBuild) {
    // スロット位置を保つため詰めずに6枠固定で保存（空きは rosterName '' のまま）
    const next = [...slots];
    next[i] = build;
    onChange(next);
  }

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
      {slots.map((slot, i) => {
        const megaForms = slot.rosterName ? getMegaForms(data.baseStats, slot.rosterName) : [];
        return (
          <Glass key={i} tint={t.glassTint2} radius={16} padding={10}>
            <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
              <span style={{ fontSize: 11, color: t.textWeak, width: 16 }}>{i + 1}</span>
              <button
                onClick={() => setModalIndex(i)}
                style={{
                  flex: 1, background: t.glassNest, color: slot.rosterName ? t.text : t.textMuted,
                  border: `1px solid ${t.rim}`, borderRadius: 10,
                  padding: '8px 12px', fontSize: 14, fontWeight: 600, textAlign: 'left',
                  cursor: 'pointer', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap',
                }}>
                {slot.rosterName ? displayPokemonName(slot.rosterName) : 'ポケモンを選択...'}
              </button>
              {megaForms.length === 1 && (
                <button
                  onClick={() => {
                    const isOn = !slot.isMega;
                    const entry = data.roster.find(r => r.name === megaForms[0].name);
                    const autoAbil = (isOn && entry) ? Object.values(entry.abilities)[0] ?? '' : '';
                    // メガON時は持ち物をメガストーンに、OFFで外す
                    const item = isOn ? (getMegaStone(megaForms[0].name)?.en ?? '') : '';
                    setSlot(i, { ...slot, isMega: isOn, megaFormName: isOn ? megaForms[0].name : '', ability: autoAbil || slot.ability, item });
                  }}
                  style={{
                    display: 'inline-flex', alignItems: 'center', gap: 3,
                    padding: '4px 8px', borderRadius: 99, fontSize: 11, fontWeight: 700,
                    background: slot.isMega ? 'linear-gradient(180deg, rgba(190,130,255,0.9), rgba(140,90,220,0.8))' : t.glassChip,
                    boxShadow: `inset 0 0 0 0.5px ${t.rim}`,
                    color: slot.isMega ? '#fff' : t.textMuted, border: 'none', cursor: 'pointer',
                  }}
                ><KeyStone size={22} /></button>
              )}
              {/* リザードン/ライチュウ等のX/Yメガは各フォームを個別ボタンに（MemberEditor と同形式） */}
              {megaForms.length > 1 && megaForms.map(mf => {
                const suffix = mf.name.replace(`Mega ${slot.rosterName}`, '').trim();
                const sel = slot.isMega && slot.megaFormName === mf.name;
                return (
                  <button key={mf.name}
                    onClick={() => {
                      const isOn = !sel;
                      const entry = data.roster.find(r => r.name === mf.name);
                      const autoAbil = (isOn && entry) ? Object.values(entry.abilities)[0] ?? '' : '';
                      // メガON時は持ち物をメガストーンに（独自メガは空のまま）、OFFで外す
                      const item = isOn ? (getMegaStone(mf.name)?.en ?? '') : '';
                      setSlot(i, { ...slot, isMega: isOn, megaFormName: isOn ? mf.name : '', ability: autoAbil || slot.ability, item });
                    }}
                    style={{
                      display: 'inline-flex', alignItems: 'center', gap: 3,
                      padding: '4px 7px', borderRadius: 99, fontSize: 11, fontWeight: 700,
                      background: sel ? 'linear-gradient(180deg, rgba(190,130,255,0.9), rgba(140,90,220,0.8))' : t.glassChip,
                      boxShadow: `inset 0 0 0 0.5px ${t.rim}`,
                      color: sel ? '#fff' : t.textMuted, border: 'none', cursor: 'pointer',
                    }}
                  ><KeyStone size={18} />{suffix}</button>
                );
              })}
              {slot.rosterName && (
                <button onClick={() => setSlot(i, opponentBuild())}
                  style={{ color: t.textWeak, background: 'none', border: 'none', cursor: 'pointer', fontSize: 14 }}>✕</button>
              )}
            </div>
          </Glass>
        );
      })}
      {modalIndex !== null && (
        <PokemonSelectModal
          data={data} pokemonHistory={store.pokemonHistory}
          myPartyMembers={store.myParties.find(p => p.id === store.activePartyId)?.members ?? []}
          opponentMembers={store.opponentParty}
          currentName={slots[modalIndex].rosterName}
          onSelect={name => { setSlot(modalIndex, { ...opponentBuild(name) }); onUpdateHistory(name); }}
          onClose={() => setModalIndex(null)}
        />
      )}
    </div>
  );
}

// 対戦記録モーダル（自分・相手の選出を3体ずつ選択 + 勝敗）
function SelectionRecordModal({ myMembers, myPartyName, opponentMembers, data, onSave, onClose }: {
  myMembers: PokemonBuild[]; myPartyName: string;
  opponentMembers: PokemonBuild[]; data: ChampionsData;
  onSave: (e: { mySelection: PokemonBuild[]; opponentSelection: PokemonBuild[]; mySelectionOrder: number[]; opponentSelectionOrder: number[]; result: 'win' | 'lose' | null }) => void;
  onClose: () => void;
}) {
  const t = useTheme();
  const [mySel, setMySel] = useState<number[]>([]);
  const [oppSel, setOppSel] = useState<number[]>([]);
  const [result, setResult] = useState<'win' | 'lose' | null>(null);

  function toggle(list: number[], setList: (n: number[]) => void, i: number) {
    if (list.includes(i)) setList(list.filter(x => x !== i));
    else if (list.length < 3) setList([...list, i]);
  }

  const canSave = mySel.length > 0 && oppSel.length > 0;

  // 選出グリッド（タップで選択、選択順を番号表示、3体上限）
  function renderGrid(members: PokemonBuild[], sel: number[], setSel: (n: number[]) => void, accent: string) {
    return (
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(6, 1fr)', gap: 4 }}>
        {members.map((m, i) => {
          const entry = data.roster.find(r => r.name === m.rosterName);
          if (!entry) return null;
          const spriteName = m.isMega && m.megaFormName ? m.megaFormName : entry.name;
          const order = sel.indexOf(i);
          const selected = order >= 0;
          return (
            <button key={i} onClick={() => toggle(sel, setSel, i)} title={displayPokemonName(spriteName)}
              style={{
                position: 'relative', width: '100%', aspectRatio: '1', padding: 0, borderRadius: 12,
                background: t.glassChip,
                boxShadow: selected ? `inset 0 0 0 1.5px ${accent}, 0 0 8px ${accent}` : `inset 0 0 0 0.5px ${t.btnSoftRim}`,
                border: 'none', cursor: 'pointer',
                display: 'flex', alignItems: 'center', justifyContent: 'center', overflow: 'hidden',
                opacity: !selected && sel.length >= 3 ? 0.4 : 1,
              }}>
              <img
                src={m.isMega && m.megaFormName
                  ? getMegaSpriteUrl(entry.dexNumber, m.megaFormName)
                  : getSpriteUrl(spriteName)}
                onError={e => {
                  // Serebii / Showdown が404の場合、dex番号でフォールバック（無限ループ防止）
                  const img = e.target as HTMLImageElement;
                  if (img.dataset.fellBack) { img.style.opacity = '0'; return; }
                  img.dataset.fellBack = '1';
                  img.src = getFallbackSpriteUrl(entry.dexNumber);
                }}
                alt="" style={{ width: '85%', height: '85%', objectFit: 'contain', imageRendering: 'pixelated' }} />
              {selected && (
                <span style={{
                  position: 'absolute', top: 2, left: 2, width: 14, height: 14, borderRadius: 99,
                  background: accent, color: '#fff', fontSize: 9, fontWeight: 800,
                  display: 'flex', alignItems: 'center', justifyContent: 'center',
                }}>{order + 1}</span>
              )}
            </button>
          );
        })}
      </div>
    );
  }

  return (
    <div onClick={onClose} style={{
      position: 'fixed', inset: 0, zIndex: 200, background: 'rgba(0,0,0,0.5)',
      display: 'flex', alignItems: 'center', justifyContent: 'center', padding: 16,
    }}>
      <div onClick={e => e.stopPropagation()} style={{ width: '100%', maxWidth: 420 }}>
        <Glass tint={t.glassTint} radius={22} padding={18}>
          <div style={{ fontSize: 16, fontWeight: 800, color: t.text, marginBottom: 4 }}>対戦を記録</div>
          <div style={{ fontSize: 11, color: t.textMuted, marginBottom: 14 }}>選出をそれぞれ3体までタップで選択</div>

          <div style={{ fontSize: 11, fontWeight: 700, color: t.accentAtk, marginBottom: 6 }}>自分の選出（{myPartyName}）{mySel.length}/3</div>
          {renderGrid(myMembers, mySel, setMySel, t.accentAtk)}

          <div style={{ fontSize: 11, fontWeight: 700, color: t.accentDef, margin: '14px 0 6px' }}>相手の選出 {oppSel.length}/3</div>
          {renderGrid(opponentMembers, oppSel, setOppSel, t.accentDef)}

          <div style={{ fontSize: 11, fontWeight: 700, color: t.textMuted, margin: '14px 0 6px' }}>勝敗</div>
          <div style={{ display: 'flex', gap: 6 }}>
            {([['win', '勝ち'], ['lose', '負け'], [null, '記録なし']] as const).map(([v, lbl]) => {
              const on = result === v;
              const ring = v === 'win' ? 'rgba(90,200,250,0.8)' : v === 'lose' ? 'rgba(255,110,110,0.8)' : t.rim;
              const bg = v === 'win' ? 'rgba(90,200,250,0.3)' : v === 'lose' ? 'rgba(255,110,110,0.3)' : t.glassChip;
              return (
                <button key={lbl} onClick={() => setResult(v)}
                  style={{
                    flex: 1, padding: '8px 0', borderRadius: 10, fontSize: 12, fontWeight: 700, border: 'none', cursor: 'pointer',
                    background: on ? bg : t.glassChip,
                    boxShadow: on ? `inset 0 0 0 1px ${ring}` : `inset 0 0 0 0.5px ${t.rim}`,
                    color: t.text,
                  }}>{lbl}</button>
              );
            })}
          </div>

          <div style={{ display: 'flex', gap: 8, marginTop: 16 }}>
            <button disabled={!canSave}
              onClick={() => onSave({ mySelection: mySel.map(i => myMembers[i]), opponentSelection: oppSel.map(i => opponentMembers[i]), mySelectionOrder: mySel, opponentSelectionOrder: oppSel, result })}
              style={{
                flex: 1, padding: '11px 0', borderRadius: 12, border: 'none', cursor: canSave ? 'pointer' : 'not-allowed',
                background: canSave ? 'linear-gradient(180deg, rgba(90,200,250,0.8), rgba(60,160,220,0.7))' : t.glassChip,
                color: canSave ? '#fff' : t.textWeak, fontSize: 14, fontWeight: 800, opacity: canSave ? 1 : 0.6,
              }}>記録する</button>
            <button onClick={onClose}
              style={{
                flex: 1, padding: '11px 0', borderRadius: 12, background: t.glassChip, boxShadow: `inset 0 0 0 0.5px ${t.rim}`,
                color: t.textMuted, fontSize: 14, fontWeight: 700, border: 'none', cursor: 'pointer',
              }}>キャンセル</button>
          </div>
        </Glass>
      </div>
    </div>
  );
}

// メインのパーティページ
export function PartyPage({ data, store, onUpdate }: Props) {
  const t = useTheme();
  const [editingId, setEditingId] = useState<string | null>(null);
  const [section, setSection] = useState<'my' | 'opponent' | 'box'>('my');
  const [showRecord, setShowRecord] = useState(false);
  const [boxDraft, setBoxDraft] = useState<PokemonBuild | null>(null); // ボックス追加/編集中の個体
  const [editingBoxId, setEditingBoxId] = useState<string | null>(null); // 編集中のボックスID（nullなら新規追加）

  function handleSave(updated: SavedParty) {
    const exists = store.myParties.some(p => p.id === updated.id);
    const next = exists ? store.myParties.map(p => p.id === updated.id ? updated : p) : [...store.myParties, updated];
    onUpdate({ myParties: next });
    setEditingId(null);
  }
  function handleDelete(id: string) {
    onUpdate({
      myParties: store.myParties.filter(p => p.id !== id),
      activePartyId: store.activePartyId === id ? null : store.activePartyId,
    });
  }
  function createNew() {
    const p = newParty(`パーティ${store.myParties.length + 1}`);
    setEditingId(p.id);
    onUpdate({ myParties: [...store.myParties, p] });
  }
  function handleUpdateHistory(name: string) {
    onUpdate({ pokemonHistory: addPokemonToHistory(store, name).pokemonHistory });
  }

  const editingParty = store.myParties.find(p => p.id === editingId);

  return (
    <div style={{ padding: '70px 16px 130px', maxWidth: 500, margin: '0 auto' }}>
      {/* ヘッダー */}
      <div style={{ marginBottom: 18 }}>
        <div style={{ fontSize: 13, fontWeight: 600, color: t.textMuted, letterSpacing: 0.4, marginBottom: 2 }}>MY TEAMS</div>
        <div style={{ fontSize: 30, fontWeight: 800, color: t.text, letterSpacing: 0.2, lineHeight: 1.1 }}>パーティ</div>
      </div>

      {/* セグメント切替 */}
      <Glass tint={t.tabTint} radius={14} padding={4} style={{ marginBottom: 16 }}>
        <div style={{ display: 'flex', gap: 4 }}>
          {(['my', 'opponent', 'box'] as const).map(s => (
            <button
              key={s}
              onClick={() => setSection(s)}
              style={{
                flex: 1, padding: '9px 0', textAlign: 'center', borderRadius: 11,
                background: section === s ? t.tabActiveBg : 'transparent',
                boxShadow: section === s ? t.tabActiveShadow : 'none',
                color: section === s ? t.text : t.tabInactive,
                fontSize: 13, fontWeight: 700, border: 'none', cursor: 'pointer',
                transition: 'all 0.2s',
              }}
            >{s === 'my' ? 'マイ' : s === 'opponent' ? '相手' : 'ボックス'}</button>
          ))}
        </div>
      </Glass>

      {section === 'my' && (
        <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
          {editingParty && editingId && (
            <Glass tint={t.glassTint} radius={22} padding={16}>
              <div style={{ fontSize: 11, fontWeight: 800, color: t.textMuted, letterSpacing: 1.4, marginBottom: 12 }}>
                {store.myParties.find(p => p.id === editingId)?.name ?? '編集中'}
              </div>
              <PartyEditor
                party={editingParty} data={data} onSave={handleSave}
                onCancel={() => {
                  const hadMembers = editingParty.members.some(Boolean);
                  if (!hadMembers) handleDelete(editingId);
                  setEditingId(null);
                }}
                store={store} onUpdateHistory={handleUpdateHistory}
              />
            </Glass>
          )}
          {/* 編集中は他パーティ・新規作成を隠し、エディタに集中させる */}
          {!editingId && store.myParties.map(p => (
            <PartyCard key={p.id} party={p} isActive={store.activePartyId === p.id}
              onActivate={() => onUpdate({ activePartyId: p.id })}
              onEdit={() => setEditingId(p.id)}
              onDelete={() => handleDelete(p.id)}
              data={data}
            />
          ))}
          {!editingId && (
            <button
              onClick={createNew}
              style={{
                width: '100%', padding: '14px 0',
                border: `1px dashed ${t.dashedRim}`, borderRadius: 22,
                color: t.textMuted, fontSize: 14, fontWeight: 600,
                background: 'transparent', cursor: 'pointer',
              }}
            >＋ 新しいパーティを作成</button>
          )}
        </div>
      )}

      {section === 'opponent' && (
        <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
          <p style={{ fontSize: 12, color: t.textMuted, margin: 0 }}>対戦中に相手のパーティをここに登録すると、ダメ計画面でタップして防御側に素早くセットできます。</p>
          <OpponentEditor
            members={store.opponentParty} data={data}
            onChange={opp => onUpdate({ opponentParty: opp })}
            store={store} onUpdateHistory={handleUpdateHistory}
          />
          {(() => {
            const myActive = store.myParties.find(p => p.id === store.activePartyId);
            const myMembers = (myActive?.members.filter(Boolean) as PokemonBuild[] | undefined) ?? [];
            const oppMembers = store.opponentParty.filter(m => m.rosterName);
            const canRecord = myMembers.length > 0 && oppMembers.length > 0;
            return (
              <>
                <button
                  onClick={() => canRecord && setShowRecord(true)}
                  disabled={!canRecord}
                  style={{
                    width: '100%', padding: '12px 0', borderRadius: 14, border: 'none',
                    cursor: canRecord ? 'pointer' : 'not-allowed',
                    background: canRecord ? 'linear-gradient(180deg, rgba(90,200,250,0.8), rgba(60,160,220,0.7))' : t.glassChip,
                    boxShadow: canRecord ? 'inset 0 1px 0 rgba(255,255,255,0.4)' : `inset 0 0 0 0.5px ${t.rim}`,
                    color: canRecord ? '#fff' : t.textWeak, fontSize: 14, fontWeight: 800,
                    opacity: canRecord ? 1 : 0.6,
                  }}
                >この対戦を記録</button>
                {!canRecord && (
                  <p style={{ fontSize: 11, color: t.textWeak, margin: 0, textAlign: 'center' }}>
                    使用中のマイパーティと相手パーティを登録すると記録できます
                  </p>
                )}
                {showRecord && (
                  <SelectionRecordModal
                    myMembers={myMembers} myPartyName={myActive?.name ?? ''}
                    opponentMembers={oppMembers} data={data}
                    onSave={e => {
                      const updated = addBattleHistory(store, {
                        opponentParty: store.opponentParty,
                        myParty: myMembers,
                        myPartyName: myActive?.name ?? '',
                        mySelection: e.mySelection,
                        opponentSelection: e.opponentSelection,
                        mySelectionOrder: e.mySelectionOrder,
                        opponentSelectionOrder: e.opponentSelectionOrder,
                        result: e.result,
                      });
                      onUpdate({ battleHistory: updated.battleHistory });
                      setShowRecord(false);
                    }}
                    onClose={() => setShowRecord(false)}
                  />
                )}
              </>
            );
          })()}
          {store.opponentParty.some(m => m.rosterName) && (
            <button
              onClick={() => onUpdate({ opponentParty: [] })}
              style={{
                width: '100%', padding: '8px 0', background: 'none', border: 'none',
                color: t.textWeak, fontSize: 12, cursor: 'pointer',
              }}
            >相手パーティをリセット</button>
          )}
        </div>
      )}

      {section === 'box' && (
        <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
          <p style={{ fontSize: 12, color: t.textMuted, margin: 0 }}>
            育成個体のプール。ここに貯めた個体を、今後パーティから選べるようにしていきます。
          </p>

          {/* 追加中の個体エディタ（別画面シート） */}
          {boxDraft && (
            <div
              onClick={() => { setBoxDraft(null); setEditingBoxId(null); }}
              style={{
                position: 'fixed', inset: 0, zIndex: 200, background: 'rgba(0,0,0,0.5)',
                display: 'flex', alignItems: 'center', justifyContent: 'center', padding: 0,
              }}
            >
              <div
                onClick={e => e.stopPropagation()}
                style={{ width: '100%', height: '100dvh', overflowY: 'auto', WebkitOverflowScrolling: 'touch', paddingBottom: 'calc(env(safe-area-inset-bottom) + 8px)' } as React.CSSProperties}
              >
                <Glass tint={t.glassTint} radius={0} padding={16}>
                  {/* ヘッダー（ノッチ対策で上端にセーフエリア余白） */}
                  <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 12, paddingTop: 'env(safe-area-inset-top)' }}>
                    <div style={{ fontSize: 11, fontWeight: 800, color: t.textMuted, letterSpacing: 1.4 }}>
                      {editingBoxId ? '個体を編集' : '新しい個体'}
                    </div>
                    <button
                      onClick={() => { setBoxDraft(null); setEditingBoxId(null); }}
                      aria-label="閉じる"
                      style={{ color: t.textMuted, background: 'none', border: 'none', cursor: 'pointer', fontSize: 20, padding: '0 4px', lineHeight: 1 }}
                    >✕</button>
                  </div>
                  <MemberEditor
                    build={boxDraft} onChange={setBoxDraft}
                    onRemove={() => { setBoxDraft(null); setEditingBoxId(null); }}
                    data={data} index={0}
                    store={store} onUpdateHistory={handleUpdateHistory}
                    defaultOpen hideIndex
                  />
                  <div style={{ display: 'flex', gap: 8, marginTop: 12 }}>
                    <button
                      disabled={!boxDraft.rosterName}
                      onClick={() => {
                        if (editingBoxId) {
                          onUpdate({ box: updateBoxPokemon(store, editingBoxId, { build: boxDraft }).box });
                        } else {
                          const { store: next } = addBoxPokemon(store, boxDraft);
                          onUpdate({ box: next.box });
                        }
                        setBoxDraft(null); setEditingBoxId(null);
                      }}
                      style={{
                        flex: 1, padding: '11px 0', borderRadius: 12, border: 'none',
                        cursor: boxDraft.rosterName ? 'pointer' : 'not-allowed',
                        background: boxDraft.rosterName ? 'linear-gradient(180deg, rgba(90,200,250,0.8), rgba(60,160,220,0.7))' : t.glassChip,
                        color: boxDraft.rosterName ? '#fff' : t.textWeak, fontSize: 14, fontWeight: 800,
                        opacity: boxDraft.rosterName ? 1 : 0.6,
                      }}
                    >{editingBoxId ? '保存' : 'ボックスに保存'}</button>
                    <button
                      onClick={() => { setBoxDraft(null); setEditingBoxId(null); }}
                      style={{
                        flex: 1, padding: '11px 0', borderRadius: 12, background: t.glassChip,
                        boxShadow: `inset 0 0 0 0.5px ${t.rim}`, color: t.textMuted,
                        fontSize: 14, fontWeight: 700, border: 'none', cursor: 'pointer',
                      }}
                    >キャンセル</button>
                  </div>
                  {editingBoxId && (
                    <button
                      onClick={() => {
                        onUpdate({ box: removeBoxPokemon(store, editingBoxId).box });
                        setBoxDraft(null); setEditingBoxId(null);
                      }}
                      style={{
                        width: '100%', marginTop: 8, padding: '8px 0', background: 'none', border: 'none',
                        color: 'rgba(255,110,110,0.9)', fontSize: 12, fontWeight: 700, cursor: 'pointer',
                      }}
                    >この個体を削除</button>
                  )}
                </Glass>
              </div>
            </div>
          )}

          {/* 個体を追加ボタン */}
          {!boxDraft && (
            <button
              onClick={() => { setEditingBoxId(null); setBoxDraft(emptyBuild()); }}
              style={{
                width: '100%', padding: '14px 0',
                border: `1px dashed ${t.dashedRim}`, borderRadius: 22,
                color: t.textMuted, fontSize: 14, fontWeight: 600,
                background: 'transparent', cursor: 'pointer',
              }}
            >＋ 個体を追加</button>
          )}

          {store.box.length === 0 ? (
            <div style={{ textAlign: 'center', padding: '40px 0' }}>
              <p style={{ color: t.textMuted, fontSize: 14, marginBottom: 6 }}>ボックスは空です</p>
              <p style={{ color: t.textWeak, fontSize: 12 }}>「＋ 個体を追加」から登録できます</p>
            </div>
          ) : (
            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3, 1fr)', gap: 8 }}>
              {store.box.map(b => {
                const entry = data.roster.find(r => r.name === b.build.rosterName);
                const spriteName = b.build.isMega && b.build.megaFormName ? b.build.megaFormName : b.build.rosterName;
                return (
                  <Glass key={b.id} tint={t.glassTint} radius={16} padding={10}
                    onClick={() => { setBoxDraft(b.build); setEditingBoxId(b.id); }}
                    style={{ cursor: 'pointer' }}>
                    <div style={{
                      width: '100%', aspectRatio: '1', borderRadius: 12, background: t.glassChip,
                      boxShadow: `inset 0 0 0 0.5px ${t.btnSoftRim}`,
                      display: 'flex', alignItems: 'center', justifyContent: 'center', overflow: 'hidden', marginBottom: 6,
                    }}>
                      <img
                        src={b.build.isMega && b.build.megaFormName && entry
                          ? getMegaSpriteUrl(entry.dexNumber, b.build.megaFormName)
                          : getSpriteUrl(spriteName)}
                        onError={e => {
                          // Serebii / Showdown が404の場合、dex番号でフォールバック（無限ループ防止）
                          const img = e.target as HTMLImageElement;
                          if (img.dataset.fellBack) { img.style.opacity = '0'; return; }
                          img.dataset.fellBack = '1';
                          if (entry) img.src = getFallbackSpriteUrl(entry.dexNumber);
                        }}
                        alt="" style={{ width: '85%', height: '85%', objectFit: 'contain', imageRendering: 'pixelated' }} />
                    </div>
                    <div style={{ fontSize: 12, fontWeight: 700, color: t.text, textAlign: 'center', whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>
                      {displayPokemonName(spriteName)}
                    </div>
                    {b.nickname && (
                      <div style={{ fontSize: 10, color: t.textMuted, textAlign: 'center', whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>
                        {b.nickname}
                      </div>
                    )}
                  </Glass>
                );
              })}
            </div>
          )}
        </div>
      )}
    </div>
  );
}
