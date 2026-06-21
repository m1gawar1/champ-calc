import { useState, useMemo, useEffect, useRef } from 'react';
import { PokemonSelectModal } from './PokemonSelectModal';
import { SelectModal } from './SelectModal';
import { Glass, GlassLayers, SpSlider } from './Glass';
import { useTheme, useThemeName, TYPE_COLORS } from '../theme';
import type { ChampionsData, PokemonBuild, SpAlloc, BattleConditions } from '../types';
import { DEFAULT_IVS, DEFAULT_SP, DEFAULT_CONDITIONS } from '../types';
import type { CalcHistoryEntry } from '../store';
import { findBaseStats, getMegaForms, getSelectableRoster, getSelectableMoves, getPokemonLearnset } from '../data';
import { computeStats, getNatureMult } from '../engine/stats';
import { calcDamageRolls, buildResult, calcHazardDamage, getWeatherBallType } from '../engine/damage';
import { reverseCalcDefense, reverseCalcAttack } from '../engine/reverseCalc';
import { getTypeEffectiveness, effectivenessLabel } from '../engine/typeChart';
import { getPokemonJaList, getMoveJaList, displayPokemonName, moveJa, TYPE_JA } from '../i18n';
import { getSpriteUrl, getFallbackSpriteUrl } from '../sprites';
import { getAbilityItems, getItemItems, ABILITY_JA } from '../engine/competitive';
import { MULTI_HIT_MOVES, ESCALATING_POWER_MOVES } from '../engine/moveFlags';

interface Props {
  data: ChampionsData;
  myPartyMembers?: (PokemonBuild | null)[];
  opponentMembers?: PokemonBuild[];
  pokemonHistory?: string[];
  onHistoryAdd?: (name: string) => void;
  onCalcHistory?: (entry: { attacker: PokemonBuild; defender: PokemonBuild; moveSlots: string[]; conditions: BattleConditions; results: { moveName: string; minPercent: number; maxPercent: number; ko1Chance: number; guaranteed2HKO: boolean }[] }) => void;
  reloadEntry?: CalcHistoryEntry | null;
  onReloadConsumed?: () => void;
  onOpponentChange?: (members: PokemonBuild[]) => void; // 相手パーティ（store）更新用
}

function defaultBuild(name = ''): PokemonBuild {
  return { rosterName: name, isMega: false, megaFormName: '', nature: 'Hardy', ivs: DEFAULT_IVS, sp: { ...DEFAULT_SP }, item: '', ability: '', moves: [] };
}

// タイプピル
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

// KO判定の色
function koColor(ko1Chance: number, guaranteed2HKO: boolean, isDark: boolean, textColor: string): string {
  if (ko1Chance >= 16) return '#FF3B30';
  if (ko1Chance >= 8)  return isDark ? '#FF6E6E' : '#c92a2a';
  if (ko1Chance > 0)   return isDark ? '#FF9F40' : '#c95a00';
  if (guaranteed2HKO)  return isDark ? '#FFD460' : '#c97a00';
  return textColor;
}

// パーティクイック選択バー
function PartyQuickBar({ label, accentColor, members, selectedName, onSelect }: {
  label: string; accentColor: string;
  members: (PokemonBuild | null)[];
  selectedName: string; onSelect: (b: PokemonBuild) => void;
}) {
  const t = useTheme();
  const filled = members.filter((m): m is PokemonBuild => !!m?.rosterName);
  if (filled.length === 0) return null;

  const isAtk = label === '自';
  const selBg  = isAtk ? 'rgba(90,200,250,0.3)'  : 'rgba(255,110,110,0.3)';
  const selRim = isAtk ? 'rgba(90,200,250,0.8)'  : 'rgba(255,110,110,0.8)';

  return (
    <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
      <span style={{ fontSize: 10, fontWeight: 700, color: accentColor, letterSpacing: 0.6, flexShrink: 0 }}>{label}</span>
      <div style={{ flex: 1, minWidth: 0, display: 'grid', gridTemplateColumns: 'repeat(6, 1fr)', gap: 4 }}>
        {filled.map((m, i) => {
          const spriteName = m.isMega && m.megaFormName ? m.megaFormName : m.rosterName;
          const jaName = m.isMega && m.megaFormName ? displayPokemonName(m.megaFormName) : displayPokemonName(m.rosterName);
          const isSelected = selectedName === m.rosterName;
          return (
            <button key={i} onClick={() => onSelect(m)} title={jaName}
              style={{
                width: '100%', aspectRatio: '1', padding: 0, borderRadius: 12,
                background: isSelected ? selBg : t.glassChip,
                boxShadow: isSelected
                  ? `inset 0 0 0 1.5px ${selRim}, 0 0 8px ${selRim}`
                  : `inset 0 0 0 0.5px ${t.btnSoftRim}`,
                border: 'none', cursor: 'pointer',
                display: 'flex', alignItems: 'center', justifyContent: 'center',
                overflow: 'hidden',
                transition: 'box-shadow 0.15s',
              }}
            >
              <img
                src={getSpriteUrl(spriteName)}
                onError={e => { (e.target as HTMLImageElement).style.opacity = '0'; }}
                alt={jaName}
                style={{ width: '85%', height: '85%', objectFit: 'contain', imageRendering: 'pixelated' }}
              />
            </button>
          );
        })}
      </div>
    </div>
  );
}

// ─── ポケモンパネル ───
function PokemonPanel({ title, build, onChange, data, showAtkSp, cond, onCondChange, pokemonHistory = [], myPartyMembers = [], opponentMembers = [], onHistoryAdd = () => {} }: {
  title: string; build: PokemonBuild; onChange: (b: PokemonBuild) => void;
  data: ChampionsData; showAtkSp: boolean;
  cond: BattleConditions; onCondChange: (c: BattleConditions) => void;
  pokemonHistory?: string[];
  myPartyMembers?: (PokemonBuild | null)[];
  opponentMembers?: PokemonBuild[];
  onHistoryAdd?: (name: string) => void;
}) {
  const t = useTheme();
  const [showPokemonModal, setShowPokemonModal] = useState(false);
  const [showItemModal, setShowItemModal] = useState(false);
  const roster = useMemo(() => getSelectableRoster(data.roster), [data.roster]);
  const megaForms = useMemo(() => build.rosterName ? getMegaForms(data.baseStats, build.rosterName) : [], [data.baseStats, build.rosterName]);
  const rosterEntry = useMemo(() => roster.find(r => r.name === build.rosterName), [roster, build.rosterName]);
  const megaRosterEntry = useMemo(() => build.isMega && build.megaFormName
    ? data.roster.find(r => r.name === build.megaFormName) ?? null : null,
    [data.roster, build.isMega, build.megaFormName]);
  const activeEntry = megaRosterEntry ?? rosterEntry;
  const activeTypes = activeEntry?.types ?? rosterEntry?.types ?? [];
  const bs = useMemo(() => findBaseStats(data.baseStats, build.rosterName, build.isMega, build.megaFormName),
    [data.baseStats, build.rosterName, build.isMega, build.megaFormName]);
  const nature = data.natures.find(n => n.name === build.nature) ?? { name: 'Hardy', increasedStat: null, decreasedStat: null };
  const computed = bs ? computeStats(bs, build.ivs, build.sp, nature, build.statMult) : null;
  // 現在の補正倍率（statMult 優先、なければ性格から）
  const multOf = (stat: 'atk' | 'def' | 'spa' | 'spd' | 'spe') => build.statMult?.[stat] ?? getNatureMult(nature, stat);
  function setMult(stat: 'atk' | 'def' | 'spa' | 'spd' | 'spe', v: number) {
    onChange({ ...build, statMult: { ...build.statMult, [stat]: v } });
  }
  const itemItems = useMemo(() => getItemItems(), []);
  const abilityItems = useMemo(() => getAbilityItems(activeEntry?.abilities ?? {}), [activeEntry]);

  // SP合計66・各32上限でクランプ（66超過時は今振れる残量まで）
  function clampSp(k: keyof SpAlloc, v: number): number {
    const others = (['hp', 'atk', 'def', 'spa', 'spd', 'spe'] as const)
      .filter(s => s !== k).reduce((sum, s) => sum + build.sp[s], 0);
    return Math.max(0, Math.min(v, 32, 66 - others));
  }
  function setSp(k: keyof SpAlloc, v: number) { onChange({ ...build, sp: { ...build.sp, [k]: clampSp(k, v) } }); }

  // ランク補正（攻撃側=atkRank / 防御側=defRank）。バトル状況からこのパネルへ移設。
  const rankKey: 'atkRank' | 'defRank' = showAtkSp ? 'atkRank' : 'defRank';
  const rankVal = cond[rankKey];
  function setRank(v: number) { onCondChange({ ...cond, [rankKey]: Math.max(-6, Math.min(6, v)) }); }

  function toggleMega(megaName: string, isOn: boolean) {
    const entry = data.roster.find(r => r.name === megaName);
    const autoAbility = isOn && entry ? Object.values(entry.abilities)[0] ?? '' : (rosterEntry ? Object.values(rosterEntry.abilities)[0] ?? '' : '');
    onChange({ ...build, isMega: isOn, megaFormName: isOn ? megaName : '', ability: autoAbility });
  }

  const displayName = build.isMega && build.megaFormName
    ? displayPokemonName(build.megaFormName)
    : build.rosterName ? displayPokemonName(build.rosterName) : '';

  const accentColor = showAtkSp ? t.accentAtk : t.accentDef;
  const headerLabel = showAtkSp ? 'ATTACKER' : 'DEFENDER';
  const atkSpKeys: (keyof SpAlloc)[] = ['atk', 'spa'];
  const defSpKeys: (keyof SpAlloc)[] = ['hp', 'def', 'spd'];
  const relevantKeys = showAtkSp ? atkSpKeys : defSpKeys;

  function setPreset(val: number) {
    const next = { ...build.sp };
    // 一旦対象キーを0にしてから、合計66を超えないよう順に充填する
    relevantKeys.forEach(k => { next[k] = 0; });
    if (val > 0) {
      let used = (Object.keys(next) as (keyof SpAlloc)[]).reduce((s, k) => s + next[k], 0);
      for (const k of relevantKeys) {
        const give = Math.max(0, Math.min(val, 32, 66 - used));
        next[k] = give; used += give;
      }
    }
    onChange({ ...build, sp: next });
  }

  return (
    <Glass tint={t.glassTint} radius={8} padding={16} style={{ marginBottom: 10 }}>
      {/* ヘッダー */}
      <div style={{ marginBottom: 10 }}>
        <span style={{ fontSize: 10, fontWeight: 800, color: accentColor, letterSpacing: 1.4 }}>{headerLabel}</span>
        <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginTop: 4 }}>
          {rosterEntry && (
            <img
              src={build.isMega && build.megaFormName
                ? getSpriteUrl(build.megaFormName)
                : getSpriteUrl(rosterEntry.name)}
              onError={e => { (e.target as HTMLImageElement).src = getFallbackSpriteUrl(rosterEntry.dexNumber); }}
              alt=""
              style={{ width: 48, height: 48, imageRendering: 'pixelated', flexShrink: 0 }}
            />
          )}
          {displayName && (
            <span style={{ fontSize: 19, fontWeight: 800, color: t.text, whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis', flex: 1 }}>
              {displayName}
            </span>
          )}
          {bs && (
            <span style={{ fontFamily: '"DM Mono", "SF Mono", "SFMono-Regular", Consolas, monospace', fontSize: 11, color: t.textMuted, flexShrink: 0 }}>
              {showAtkSp ? `A:${bs.atk}  C:${bs.spa}` : `H:${bs.hp}  B:${bs.def}  D:${bs.spd}`}
            </span>
          )}
        </div>
      </div>

      {/* ポケモン選択 + メガ */}
      <div style={{ display: 'flex', gap: 8, alignItems: 'center', marginBottom: 10 }}>
        <button
          onClick={() => setShowPokemonModal(true)}
          style={{
            flex: 1, background: t.glassNest, color: build.rosterName ? t.text : t.textMuted,
            border: `1px solid ${t.rim}`, borderRadius: 12,
            padding: '10px 14px', fontSize: 14, fontWeight: 700, textAlign: 'left', cursor: 'pointer',
          }}
        >
          {build.rosterName ? (getPokemonJaList([build.rosterName])[0]?.label ?? build.rosterName) : 'ポケモンを選択...'}
        </button>
        {megaForms.length === 1 && (
          <button onClick={() => toggleMega(megaForms[0].name, !build.isMega)}
            style={{
              padding: '10px 12px', borderRadius: 12, fontSize: 12, fontWeight: 800,
              background: build.isMega ? 'linear-gradient(180deg, rgba(190,130,255,0.9), rgba(140,90,220,0.8))' : t.glassChip,
              boxShadow: `inset 0 0 0 0.5px ${t.rim}`,
              color: build.isMega ? '#fff' : t.textMuted, border: 'none', cursor: 'pointer', whiteSpace: 'nowrap',
            }}>メガ</button>
        )}
        {megaForms.length > 1 && megaForms.map(mf => {
          const suffix = mf.name.replace(`Mega ${build.rosterName}`, '').trim() || 'メガ';
          const sel = build.isMega && build.megaFormName === mf.name;
          return (
            <button key={mf.name} onClick={() => toggleMega(mf.name, !sel)}
              style={{
                padding: '10px 10px', borderRadius: 12, fontSize: 12, fontWeight: 800,
                background: sel ? 'linear-gradient(180deg, rgba(190,130,255,0.9), rgba(140,90,220,0.8))' : t.glassChip,
                boxShadow: `inset 0 0 0 0.5px ${t.rim}`,
                color: sel ? '#fff' : t.textMuted, border: 'none', cursor: 'pointer',
              }}>{suffix}</button>
          );
        })}
      </div>

      {/* タイプバッジ */}
      {activeTypes.length > 0 && (
        <div style={{ display: 'flex', gap: 6, marginBottom: 12 }}>
          {activeTypes.map(type => <TypePill key={type} type={type} />)}
        </div>
      )}

      {/* 持ち物 + 特性 */}
      <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 8, marginBottom: 12 }}>
        <Glass tint={t.glassNest} radius={6} padding={10} blur={14}>
          <div style={{ fontSize: 10, color: t.textMuted, marginBottom: 5, fontWeight: 600 }}>持ち物</div>
          <button
            onClick={() => setShowItemModal(true)}
            style={{
              width: '100%', textAlign: 'left', cursor: 'pointer',
              display: 'flex', alignItems: 'center', gap: 6,
              background: t.inputBg, color: build.item ? t.text : t.textMuted,
              border: `1px solid ${t.rim}`, borderRadius: 10,
              padding: '8px 10px', fontSize: 13, fontWeight: 600, fontFamily: 'inherit',
              overflow: 'hidden', whiteSpace: 'nowrap',
            }}
          >
            {(() => { const it = itemItems.find(i => i.value === build.item); return (
              <>
                {it?.icon && (
                  <img src={it.icon} alt="" loading="lazy"
                    onError={e => { (e.currentTarget.style.display = 'none'); }}
                    style={{ width: 20, height: 20, objectFit: 'contain', imageRendering: 'pixelated', flexShrink: 0 }} />
                )}
                <span style={{ overflow: 'hidden', textOverflow: 'ellipsis' }}>{it?.label ?? 'なし'}</span>
              </>
            ); })()}
          </button>
        </Glass>
        <Glass tint={t.glassNest} radius={6} padding={10} blur={14}>
          <div style={{ fontSize: 10, color: t.textMuted, marginBottom: 5, fontWeight: 600 }}>特性</div>
          <select
            value={build.ability}
            onChange={e => onChange({ ...build, ability: e.target.value })}
            style={{
              width: '100%', background: t.inputBg, color: t.text,
              border: `1px solid ${t.rim}`, borderRadius: 10,
              padding: '8px 10px', fontSize: 13, outline: 'none',
            }}
          >
            {abilityItems.map(a => <option key={a.value} value={a.value}>{a.label}</option>)}
          </select>
        </Glass>
      </div>

      {/* 性格補正（倍率を直接指定。相手の性格不明時の予測用）。タブバー風セグメントで1行表示 */}
      <div style={{ marginBottom: 14 }}>
        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
          <span style={{ fontSize: 11, color: t.textMuted, fontWeight: 600 }}>性格補正</span>
          {/* ランク補正（攻撃側=攻撃ランク / 防御側=防御ランク） */}
          <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
            <span style={{ fontSize: 11, color: t.textMuted, fontWeight: 600 }}>{showAtkSp ? '攻撃ランク' : '防御ランク'}</span>
            <button onClick={() => setRank(rankVal - 1)}
              style={{ width: 24, height: 24, borderRadius: 99, background: t.glassChip, boxShadow: `inset 0 0 0 0.5px ${t.rim}`, color: t.text, border: 'none', cursor: 'pointer', fontSize: 13, fontWeight: 700, lineHeight: 1 }}>−</button>
            <span style={{ width: 26, textAlign: 'center', fontSize: 13, fontWeight: 800, color: rankVal > 0 ? t.accentAtk : rankVal < 0 ? t.accentDef : t.textMuted }}>{rankVal > 0 ? `+${rankVal}` : rankVal}</span>
            <button onClick={() => setRank(rankVal + 1)}
              style={{ width: 24, height: 24, borderRadius: 99, background: t.glassChip, boxShadow: `inset 0 0 0 0.5px ${t.rim}`, color: t.text, border: 'none', cursor: 'pointer', fontSize: 13, fontWeight: 700, lineHeight: 1 }}>＋</button>
          </div>
        </div>
        <div style={{ display: 'flex', gap: 10, marginTop: 8 }}>
          {(showAtkSp ? (['atk', 'spa'] as const) : (['def', 'spd'] as const)).map(stat => {
            const cur = multOf(stat);
            const statLabel = { atk: 'A', spa: 'C', def: 'B', spd: 'D' }[stat];
            return (
              <div key={stat} style={{ display: 'flex', alignItems: 'center', gap: 6, flex: 1, minWidth: 0 }}>
                <span style={{ fontSize: 12, color: t.textMuted, fontWeight: 700, width: 14, textAlign: 'center', flexShrink: 0 }}>{statLabel}</span>
                {/* ピル型コンテナ（下タブバーと同じノリ） */}
                <div style={{ display: 'flex', flex: 1, minWidth: 0, background: t.track, borderRadius: 99, padding: 3, gap: 2 }}>
                  {([0.9, 1.0, 1.1] as const).map(v => {
                    const active = Math.abs(cur - v) < 0.001;
                    const accent = v < 1 ? 'rgba(255,100,100,0.95)' : v > 1 ? 'rgba(90,200,250,0.95)' : t.text;
                    return (
                      <button key={v} onClick={() => setMult(stat, v)}
                        style={{
                          flex: 1, minWidth: 0, padding: '5px 0', borderRadius: 99, border: 0, cursor: 'pointer',
                          fontFamily: '"DM Mono", "SF Mono", "SFMono-Regular", Consolas, monospace', fontSize: 11, fontWeight: 700,
                          background: active ? t.tabActiveBg : 'transparent',
                          boxShadow: active ? t.tabActiveShadow : 'none',
                          color: active ? accent : t.textMuted,
                          transition: 'all 0.2s cubic-bezier(0.4,0,0.2,1)',
                        }}>
                        {v.toFixed(1)}
                      </button>
                    );
                  })}
                </div>
              </div>
            );
          })}
        </div>
      </div>

      {/* SP振り */}
      <div>
        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 10 }}>
          <span style={{ fontSize: 11, color: t.textMuted, fontWeight: 600 }}>SP振り</span>
          <div style={{ display: 'flex', gap: 6 }}>
            <button onClick={() => setPreset(0)}
              style={{ fontSize: 11, padding: '3px 10px', borderRadius: 99, background: t.glassChip, boxShadow: `inset 0 0 0 0.5px ${t.rim}`, color: t.textMuted, border: 'none', cursor: 'pointer' }}>
              無振り
            </button>
            <button onClick={() => setPreset(32)}
              style={{ fontSize: 11, padding: '3px 10px', borderRadius: 99, background: t.glassChip, boxShadow: `inset 0 0 0 0.5px ${t.rim}`, color: t.textMuted, border: 'none', cursor: 'pointer' }}>
              最大
            </button>
          </div>
        </div>
        <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
          {showAtkSp ? (
            <>
              <SpSlider label="攻撃(A)" value={build.sp.atk} onChange={v => setSp('atk', v)} actual={computed?.atk} />
              <SpSlider label="特攻(C)" value={build.sp.spa} onChange={v => setSp('spa', v)} actual={computed?.spa} />
            </>
          ) : (
            <>
              <SpSlider label="HP(H)" value={build.sp.hp} onChange={v => setSp('hp', v)} actual={computed?.hp} />
              <SpSlider label="防御(B)" value={build.sp.def} onChange={v => setSp('def', v)} actual={computed?.def} />
              <SpSlider label="特防(D)" value={build.sp.spd} onChange={v => setSp('spd', v)} actual={computed?.spd} />
            </>
          )}
        </div>
      </div>

      {showPokemonModal && (
        <PokemonSelectModal
          data={data} pokemonHistory={pokemonHistory}
          myPartyMembers={myPartyMembers} opponentMembers={opponentMembers}
          onSelect={name => { onChange({ ...defaultBuild(name) }); onHistoryAdd(name); }}
          onClose={() => setShowPokemonModal(false)}
        />
      )}
      {showItemModal && (
        <SelectModal
          title="持ち物を選択"
          items={itemItems}
          value={build.item}
          onSelect={v => onChange({ ...build, item: v })}
          onClose={() => setShowItemModal(false)}
        />
      )}
    </Glass>
  );
}

// ─── バトル状況パネル ───
function ConditionsPanel({ cond, onChange }: { cond: BattleConditions; onChange: (c: BattleConditions) => void }) {
  const t = useTheme();
  const [open, setOpen] = useState(false);
  const hasCondition = cond.weather || cond.field || cond.isCrit || cond.isBurned ||
    !cond.defAtFullHp ||
    cond.reflect || cond.lightScreen || cond.auroraVeil ||
    cond.stealthRock || cond.spikes > 0 || cond.sandTurns > 0;

  const weathers: { v: BattleConditions['weather']; label: string }[] = [
    { v: null, label: 'なし' }, { v: 'sun', label: '晴れ' },
    { v: 'rain', label: '雨' }, { v: 'sand', label: '砂嵐' }, { v: 'hail', label: '霰' },
  ];
  const fields: { v: BattleConditions['field']; label: string }[] = [
    { v: null, label: 'なし' }, { v: 'electric', label: 'エレキ' },
    { v: 'grassy', label: 'グラス' }, { v: 'psychic', label: 'サイコ' }, { v: 'misty', label: 'ミスト' },
  ];

  function ChipBtn({ active, onClick, label, activeColor }: { active: boolean; onClick: () => void; label: string; activeColor?: string }) {
    return (
      <button onClick={onClick} style={{
        padding: '6px 12px', borderRadius: 99, fontSize: 12, fontWeight: 600,
        background: active ? (activeColor ?? 'rgba(90,200,250,0.25)') : t.glassChip,
        boxShadow: active ? `inset 0 0 0 0.5px ${t.rimAccent}` : `inset 0 0 0 0.5px ${t.rim}`,
        color: active ? t.text : t.textMuted, border: 'none', cursor: 'pointer',
        transition: 'all 0.15s',
      }}>{label}</button>
    );
  }

  return (
    <Glass tint={t.glassTint2} radius={8} padding={0} style={{ overflow: 'hidden', marginBottom: 10 }}>
      <button onClick={() => setOpen(o => !o)}
        style={{
          width: '100%', display: 'flex', alignItems: 'center', justifyContent: 'space-between',
          padding: '14px 16px', background: 'none', border: 'none', cursor: 'pointer',
        }}>
        <span style={{ fontSize: 11, fontWeight: 800, color: t.textMuted, letterSpacing: 1.4 }}>バトル状況</span>
        <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
          {hasCondition && <span style={{ fontSize: 11, color: t.accentAtk, fontWeight: 700 }}>設定あり</span>}
          <span style={{ fontSize: 11, color: t.textWeak }}>{open ? '▲' : '▼'}</span>
        </div>
      </button>

      {open && (
        <div style={{ padding: '0 16px 16px', display: 'flex', flexDirection: 'column', gap: 14, borderTop: `1px solid ${t.rim}` }}>
          <div style={{ paddingTop: 14 }}>
            <div style={{ fontSize: 11, color: t.textMuted, fontWeight: 600, marginBottom: 8 }}>天候</div>
            <div style={{ display: 'flex', gap: 6, flexWrap: 'wrap' }}>
              {weathers.map(w => (
                <ChipBtn key={String(w.v)} active={cond.weather === w.v} onClick={() => onChange({ ...cond, weather: w.v })} label={w.label} />
              ))}
            </div>
          </div>
          <div>
            <div style={{ fontSize: 11, color: t.textMuted, fontWeight: 600, marginBottom: 8 }}>フィールド</div>
            <div style={{ display: 'flex', gap: 6, flexWrap: 'wrap' }}>
              {fields.map(f => (
                <ChipBtn key={String(f.v)} active={cond.field === f.v} onClick={() => onChange({ ...cond, field: f.v })} label={f.label} />
              ))}
            </div>
          </div>
          <div style={{ display: 'flex', gap: 6, flexWrap: 'wrap' }}>
            <ChipBtn active={cond.isCrit} onClick={() => onChange({ ...cond, isCrit: !cond.isCrit })} label="急所" activeColor="rgba(255,210,0,0.3)" />
            <ChipBtn active={cond.isBurned} onClick={() => onChange({ ...cond, isBurned: !cond.isBurned })} label="攻撃側やけど" activeColor="rgba(255,120,60,0.3)" />
            <ChipBtn active={cond.defAtFullHp} onClick={() => onChange({ ...cond, defAtFullHp: !cond.defAtFullHp })} label="防御側満タン" activeColor="rgba(80,200,150,0.3)" />
          </div>
          <div>
            <div style={{ fontSize: 11, color: t.textMuted, fontWeight: 600, marginBottom: 8 }}>スクリーン（防御側）</div>
            <div style={{ display: 'flex', gap: 6, flexWrap: 'wrap' }}>
              <ChipBtn active={cond.reflect}     onClick={() => onChange({ ...cond, reflect:     !cond.reflect })}     label="リフレクター" activeColor="rgba(90,160,255,0.3)" />
              <ChipBtn active={cond.lightScreen} onClick={() => onChange({ ...cond, lightScreen: !cond.lightScreen })} label="ひかりのかべ"   activeColor="rgba(90,160,255,0.3)" />
              <ChipBtn active={cond.auroraVeil}  onClick={() => onChange({ ...cond, auroraVeil:  !cond.auroraVeil })}  label="オーロラベール" activeColor="rgba(90,160,255,0.3)" />
            </div>
          </div>

          <div>
            <div style={{ fontSize: 11, color: t.textMuted, fontWeight: 600, marginBottom: 8 }}>消耗ダメージ（防御側）</div>
            <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
              <ChipBtn active={cond.stealthRock} onClick={() => onChange({ ...cond, stealthRock: !cond.stealthRock })} label="ステルスロック" activeColor="rgba(200,100,80,0.3)" />
              <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                <span style={{ fontSize: 12, color: t.textMuted, width: 60 }}>まきびし</span>
                {[0, 1, 2, 3].map(n => (
                  <button key={n} onClick={() => onChange({ ...cond, spikes: n })}
                    style={{
                      width: 32, padding: '6px 0', borderRadius: 10,
                      background: cond.spikes === n ? 'rgba(220,120,60,0.3)' : t.glassChip,
                      boxShadow: cond.spikes === n ? `inset 0 0 0 0.5px rgba(220,120,60,0.6)` : `inset 0 0 0 0.5px ${t.rim}`,
                      color: cond.spikes === n ? t.text : t.textMuted, fontSize: 12, border: 'none', cursor: 'pointer',
                    }}>{n}</button>
                ))}
              </div>
              <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                <span style={{ fontSize: 12, color: t.textMuted, width: 60 }}>砂ダメ</span>
                {[0, 1, 2, 3].map(n => (
                  <button key={n} onClick={() => onChange({ ...cond, sandTurns: n })}
                    style={{
                      width: 36, padding: '6px 0', borderRadius: 10,
                      background: cond.sandTurns === n ? 'rgba(200,160,80,0.3)' : t.glassChip,
                      boxShadow: cond.sandTurns === n ? `inset 0 0 0 0.5px rgba(200,160,80,0.6)` : `inset 0 0 0 0.5px ${t.rim}`,
                      color: cond.sandTurns === n ? t.text : t.textMuted, fontSize: 12, border: 'none', cursor: 'pointer',
                    }}>{n === 0 ? '0' : `${n}T`}</button>
                ))}
              </div>
            </div>
          </div>

          {hasCondition && (
            <button onClick={() => onChange({ ...DEFAULT_CONDITIONS })}
              style={{ alignSelf: 'flex-start', fontSize: 12, color: t.textWeak, background: 'none', border: 'none', cursor: 'pointer' }}>
              すべてリセット
            </button>
          )}
        </div>
      )}
    </Glass>
  );
}

// ─── 技スロット ───
function MoveSlots({ slots, onChange, data, rosterName, learnsetFilter, onToggleFilter }: {
  slots: string[]; onChange: (i: number, v: string) => void;
  data: ChampionsData; rosterName: string;
  learnsetFilter: boolean; onToggleFilter: () => void;
}) {
  const t = useTheme();
  const [includeStatus, setIncludeStatus] = useState(false); // 変化技も候補に含めるか
  const learnset = useMemo(() => learnsetFilter && rosterName
    ? getPokemonLearnset(data.learnsets, rosterName) : null,
    [data.learnsets, rosterName, learnsetFilter]);
  const verifiedMoves = useMemo(() => getSelectableMoves(data.moves), [data.moves]); // 攻撃技（変化除く）
  const verifiedWithStatus = useMemo(() => data.moves.filter(m => m.inChampions !== false && (m.power > 0 || m.category === 'Status')), [data.moves]);
  const allDamagingMoves = useMemo(() => data.moves.filter(m => m.power > 0 && m.category !== 'Status'), [data.moves]);
  const allWithStatus = useMemo(() => data.moves.filter(m => m.power > 0 || m.category === 'Status'), [data.moves]);
  const filteredMoves = useMemo(() => {
    if (!learnset) return includeStatus ? verifiedWithStatus : verifiedMoves;
    return (includeStatus ? allWithStatus : allDamagingMoves).filter(m => learnset.has(m.name));
  }, [verifiedMoves, verifiedWithStatus, allDamagingMoves, allWithStatus, learnset, includeStatus]);
  const learnsetFound = !learnsetFilter || !rosterName || learnset !== null;
  // 技選択モーダル用（日本語名 + タイプ・威力を補助表示）
  const moveSelectItems = useMemo(() =>
    filteredMoves.map(m => ({ label: moveJa(m.name), value: m.name, sub: `${TYPE_JA[m.type] ?? m.type} ${m.power}`, type: m.type, power: m.power, category: m.category })),
    [filteredMoves]);
  const [openSlot, setOpenSlot] = useState<number | null>(null);

  return (
    <Glass tint={t.glassTint} radius={8} padding={16} style={{ marginBottom: 10 }}>
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 12 }}>
        <span style={{ fontSize: 11, fontWeight: 800, color: t.textMuted, letterSpacing: 1.4 }}>技</span>
        <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
          {learnsetFilter && !learnsetFound && <span style={{ fontSize: 11, color: 'rgba(255,200,60,0.9)' }}>データなし</span>}
          {learnsetFilter && learnsetFound && learnset && <span style={{ fontSize: 11, color: t.textWeak }}>{filteredMoves.length}技</span>}
          <button onClick={() => setIncludeStatus(s => !s)}
            style={{
              fontSize: 11, padding: '4px 10px', borderRadius: 99,
              background: includeStatus ? 'rgba(90,200,250,0.2)' : t.glassChip,
              boxShadow: includeStatus ? `inset 0 0 0 0.5px ${t.rimAccent}` : `inset 0 0 0 0.5px ${t.rim}`,
              color: includeStatus ? t.accentAtk : t.textMuted,
              border: 'none', cursor: 'pointer', fontWeight: 600,
            }}>変化</button>
          <button onClick={onToggleFilter}
            style={{
              fontSize: 11, padding: '4px 10px', borderRadius: 99,
              background: learnsetFilter ? 'rgba(90,200,250,0.2)' : t.glassChip,
              boxShadow: learnsetFilter ? `inset 0 0 0 0.5px ${t.rimAccent}` : `inset 0 0 0 0.5px ${t.rim}`,
              color: learnsetFilter ? t.accentAtk : t.textMuted,
              border: 'none', cursor: 'pointer', fontWeight: 600,
            }}>覚え技のみ</button>
        </div>
      </div>
      <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 8 }}>
        {slots.map((slot, i) => {
          const move = data.moves.find(m => m.name === slot);
          const isActive = !!slot;
          return (
            <Glass
              key={i}
              tint={isActive ? 'rgba(90,200,250,0.12)' : t.glassChip2}
              radius={6}
              padding={10}
              blur={14}
              rim={isActive ? t.rimAccent : t.btnSoftRim}
            >
              <button
                onClick={() => setOpenSlot(i)}
                style={{
                  width: '100%', textAlign: 'left', cursor: 'pointer',
                  background: t.inputBg, color: slot ? t.text : t.textMuted,
                  border: `1px solid ${t.rim}`, borderRadius: 10,
                  padding: '8px 10px', fontSize: 13, fontWeight: 600, fontFamily: 'inherit',
                  overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap',
                }}
              >
                {slot ? moveJa(slot) : `技${i + 1}`}
              </button>
              {move && (
                <div style={{ display: 'flex', alignItems: 'center', gap: 5, marginTop: 6 }}>
                  <TypePill type={move.type} size={9} />
                  <span style={{ fontSize: 9, color: t.textMuted }}>{move.category === 'Physical' ? '物理' : move.category === 'Special' ? '特殊' : '変化'}</span>
                  <span style={{ fontFamily: 'monospace', fontSize: 10, color: t.text, fontWeight: 700, marginLeft: 'auto' }}>{move.power}</span>
                </div>
              )}
            </Glass>
          );
        })}
      </div>
      {openSlot !== null && (
        <SelectModal
          title={`技${openSlot + 1} を選択`}
          items={[{ label: '（なし）', value: '' }, ...moveSelectItems]}
          value={slots[openSlot]}
          onSelect={v => onChange(openSlot, v)}
          onClose={() => setOpenSlot(null)}
          sortable
          persistKey="champ_move_sort"
        />
      )}
    </Glass>
  );
}

// ─── 結果カード（1技分） ───
function ResultCard({ data, attacker, defender, moveEnName, cond, swapped }: {
  data: ChampionsData; attacker: PokemonBuild; defender: PokemonBuild;
  moveEnName: string; cond: BattleConditions; swapped: boolean;
}) {
  const t = useTheme();
  const isDark = useThemeName() === 'dark';
  const [expanded, setExpanded] = useState(false);
  const [reverseMode, setReverseMode] = useState<'dmg' | 'pct'>('dmg');
  const [reverseDmg, setReverseDmg] = useState('');
  const [reversePct, setReversePct] = useState('');
  const [reverseResult, setReverseResult] = useState<ReturnType<typeof reverseCalcDefense>>(null);

  const calc = useMemo(() => {
    if (!attacker.rosterName || !defender.rosterName || !moveEnName) return null;
    const move = data.moves.find(m => m.name === moveEnName);
    const atkBs = findBaseStats(data.baseStats, attacker.rosterName, attacker.isMega, attacker.megaFormName);
    const defBs = findBaseStats(data.baseStats, defender.rosterName, defender.isMega, defender.megaFormName);
    if (!move || !atkBs || !defBs) return null;
    const atkNature = data.natures.find(n => n.name === attacker.nature) ?? { name: 'Hardy', increasedStat: null, decreasedStat: null };
    const defNature = data.natures.find(n => n.name === defender.nature) ?? { name: 'Hardy', increasedStat: null, decreasedStat: null };
    const atkStats = computeStats(atkBs, attacker.ivs, attacker.sp, atkNature, attacker.statMult);
    const defStats = computeStats(defBs, defender.ivs, defender.sp, defNature, defender.statMult);
    const atkEntry = attacker.isMega && attacker.megaFormName
      ? data.roster.find(r => r.name === attacker.megaFormName)
      : getSelectableRoster(data.roster).find(r => r.name === attacker.rosterName);
    const defEntry = defender.isMega && defender.megaFormName
      ? data.roster.find(r => r.name === defender.megaFormName)
      : getSelectableRoster(data.roster).find(r => r.name === defender.rosterName);
    const atkTypes = atkEntry?.types ?? [];
    const defTypes = defEntry?.types ?? [];
    // ウェザーボールは天候で実効タイプ・威力が変わる（表示・相性に反映）
    const isWB = move.name === 'Weather Ball' && (cond.weather ?? null) !== null;
    const dispType = isWB ? getWeatherBallType(cond.weather) : move.type;
    const dispPower = isWB ? move.power * 2 : move.power;
    const effectiveness = getTypeEffectiveness(dispType, defTypes);
    const rolls = calcDamageRolls(atkStats, defStats, atkTypes, defTypes, move, cond, attacker.item, defender.item, attacker.ability, defender.ability);
    const result = buildResult(rolls, defStats.hp, effectiveness, moveEnName, dispType, dispPower, move.category);
    const isPhysical = move.category === 'Physical';
    const defStatKey = isPhysical ? 'def' : 'spd';
    let minDefSp: number | null = null;
    let minHpSp: number | null = null;
    if (result.ko1Chance > 0) {
      for (let sp = 0; sp <= 32; sp++) {
        const testSp = { ...defender.sp, [defStatKey]: sp };
        const testStats = computeStats(defBs, defender.ivs, testSp, defNature, defender.statMult);
        const testRolls = calcDamageRolls(atkStats, testStats, atkTypes, defTypes, move, cond, attacker.item, defender.item, attacker.ability, defender.ability);
        if (testRolls[0] < testStats.hp) { minDefSp = sp; break; }
      }
      for (let sp = 0; sp <= 32; sp++) {
        const testSp = { ...defender.sp, hp: sp };
        const testStats = computeStats(defBs, defender.ivs, testSp, defNature, defender.statMult);
        const testRolls = calcDamageRolls(atkStats, testStats, atkTypes, defTypes, move, cond, attacker.item, defender.item, attacker.ability, defender.ability);
        if (testRolls[0] < testStats.hp) { minHpSp = sp; break; }
      }
    }
    const hazard = calcHazardDamage(defStats.hp, defTypes, defender.ability ?? '', { stealthRock: cond.stealthRock, spikes: cond.spikes, sandTurns: cond.sandTurns });
    // 威力が段階的に増える連続技（Triple Axel等）の各ヒット個別ロール
    const escalatingPowers = ESCALATING_POWER_MOVES[moveEnName] ?? null;
    const escalatingHitRolls: number[][] | null = escalatingPowers
      ? escalatingPowers.map(p =>
          calcDamageRolls(atkStats, defStats, atkTypes, defTypes,
            { ...move, power: p }, cond, attacker.item, defender.item, attacker.ability, defender.ability)
        )
      : null;
    return { result, defStatKey, minDefSp, minHpSp, hazard, escalatingHitRolls };
  }, [data, attacker, defender, moveEnName, cond]);

  if (!calc) return null;
  const { result, defStatKey, minDefSp, minHpSp, hazard, escalatingHitRolls } = calc;

  const effectiveHp = Math.max(1, result.defenderHp - hazard.total);
  const hasHazard = hazard.total > 0;
  const effLabel = effectivenessLabel(result.effectiveness);

  const ko1Pct = Math.round(result.ko1Chance / 16 * 100);
  const ko2Count = result.rolls.filter(r => r * 2 >= result.defenderHp).length;
  const ko2Pct = Math.round(ko2Count / 16 * 100);

  const ko1WithHazard = result.rolls.filter(r => r >= effectiveHp).length;
  const ko2WithHazard = result.rolls[0] * 2 >= effectiveHp;
  const koWithHazardText = ko1WithHazard === 16 ? '確定1発'
    : ko1WithHazard > 0 ? `乱数1発 (${Math.round(ko1WithHazard / 16 * 100)}%)`
    : ko2WithHazard ? '確定2発'
    : null;

  // 連続技判定
  const multiHit = MULTI_HIT_MOVES[moveEnName] ?? null;
  const isVariable = multiHit !== null && multiHit.min !== multiHit.max;

  // 残HP割合（min/max）- 連続技はメインバーを最大ヒット時（可変は3ヒット期待値）で表示
  const displayHits = multiHit ? (isVariable ? 3 : multiHit.max) : 1;

  // 累積ダメージロール（段階威力技は各ヒット合計、固定威力はn倍）
  const cumulativeRolls: number[] = escalatingHitRolls
    ? Array(16).fill(0).map((_, r) => escalatingHitRolls.reduce((sum, hr) => sum + hr[r], 0))
    : result.rolls.map(r => r * displayHits);

  const mhMinPct = multiHit
    ? Math.floor(cumulativeRolls[0] / result.defenderHp * 1000) / 10
    : result.minPercent;
  const mhMaxPct = multiHit
    ? Math.floor(cumulativeRolls[15] / result.defenderHp * 1000) / 10
    : result.maxPercent;
  const remainingMin = Math.max(0, 100 - mhMaxPct);
  const remainingMax = Math.max(0, 100 - mhMinPct);
  const isKO = remainingMax === 0;

  // KO判定（連続技は累積ダメージで判定）
  const displayKoCount = cumulativeRolls.filter(r => r >= result.defenderHp).length;
  const koText = multiHit
    ? (displayKoCount === 16 ? '確定KO'
      : displayKoCount > 0 ? `乱数KO (${Math.round(displayKoCount / 16 * 100)}%)`
      : '耐え')
    : (result.ko1Chance === 16 ? '確定1発'
      : result.ko1Chance > 0 ? `乱数1発 (${ko1Pct}%)`
      : result.guaranteed2HKO ? '確定2発'
      : ko2Count > 0 ? `乱数2発 (${ko2Pct}%)`
      : '確定3発以上');
  const kCol = koColor(
    multiHit ? displayKoCount : result.ko1Chance,
    multiHit ? false : result.guaranteed2HKO,
    isDark, t.text,
  );
  const barColor = isKO
    ? 'linear-gradient(90deg,#FF6E6E,#FF3B30)'
    : remainingMax <= 20
    ? 'linear-gradient(90deg,#FF9F40,#FF6E6E)'
    : remainingMax <= 49
    ? 'linear-gradient(90deg,#FFD460,#FFA630)'
    : 'linear-gradient(90deg,#5AC8FA,#34C759)';

  return (
    <Glass tint={t.glassTint} radius={8} padding={14}>
      {/* ヘッダー行 */}
      <button
        style={{ width: '100%', display: 'flex', alignItems: 'center', gap: 8, background: 'none', border: 'none', cursor: 'pointer', padding: 0, marginBottom: 8 }}
        onClick={() => setExpanded(e => !e)}
      >
        <TypePill type={result.moveType} size={10} />
        <span style={{ fontSize: 14, fontWeight: 700, color: t.text, flex: 1, textAlign: 'left', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
          {moveJa(result.moveName)}
        </span>
        {effLabel && (
          <span style={{ fontSize: 11, fontWeight: 700, color: result.effectiveness > 1 ? t.accentDef : t.accentAtk }}>
            {effLabel}
          </span>
        )}
        <div style={{ textAlign: 'right' }}>
          {multiHit && (
            <div style={{ fontSize: 9, color: t.textWeak, marginBottom: 1 }}>
              {isVariable ? `${displayHits}ヒット（期待値）` : `${displayHits}ヒット累積`}
            </div>
          )}
          <div style={{ fontFamily: '"DM Mono", "SF Mono", monospace', fontSize: 15, fontWeight: 800, color: t.text }}>
            {mhMinPct}%〜{mhMaxPct}%
          </div>
          <div style={{ fontSize: 10, fontWeight: 700, color: kCol }}>{koText}</div>
        </div>
        <span style={{ fontSize: 11, color: t.textWeak, marginLeft: 4 }}>{expanded ? '▲' : '▼'}</span>
      </button>

      {/* 残HPプログレスバー */}
      <div style={{ marginBottom: 4 }}>
        {multiHit && (
          <div style={{ fontSize: 9, color: t.textWeak, marginBottom: 3 }}>
            {isVariable ? `${displayHits}ヒット（期待値）` : `${displayHits}ヒット時`}の残HP
          </div>
        )}
        <div style={{ height: 6, borderRadius: 99, background: t.track2, overflow: 'hidden', position: 'relative' }}>
          <div style={{ position: 'absolute', left: 0, top: 0, height: '100%', width: `${remainingMin}%`, background: barColor, borderRadius: 99 }} />
          <div style={{ position: 'absolute', top: 0, height: '100%', left: `${remainingMin}%`, width: `${remainingMax - remainingMin}%`, background: barColor, borderRadius: 99, opacity: 0.45 }} />
        </div>
        <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: 9, color: t.textWeak, marginTop: 2, padding: '0 2px' }}>
          <span>0%</span><span>100%</span>
        </div>
      </div>

      {/* 連続技累積ダメージテーブル */}
      {multiHit && (
        <div style={{ marginTop: 8, marginBottom: 4 }}>
          <div style={{ fontSize: 10, fontWeight: 700, color: t.textMuted, letterSpacing: 0.8, marginBottom: 6 }}>
            連続ヒット累積ダメージ
            {isVariable && <span style={{ fontWeight: 500, color: t.textWeak, marginLeft: 6 }}>（★ 期待値 3ヒット）</span>}
          </div>
          <div style={{ display: 'flex', flexDirection: 'column', gap: 3 }}>
            {Array.from({ length: multiHit.max }, (_, i) => i + 1).map(n => {
              // 段階威力技は各ヒットの実際の威力で計算、固定威力は n 倍
              const nMin = escalatingHitRolls
                ? escalatingHitRolls.slice(0, n).reduce((sum, hr) => sum + hr[0], 0)
                : result.rolls[0] * n;
              const nMax = escalatingHitRolls
                ? escalatingHitRolls.slice(0, n).reduce((sum, hr) => sum + hr[15], 0)
                : result.rolls[15] * n;
              const minPct = Math.floor(nMin / result.defenderHp * 1000) / 10;
              const maxPct = Math.floor(nMax / result.defenderHp * 1000) / 10;
              const isConfirmedKO = nMin >= result.defenderHp;
              const koCount = escalatingHitRolls
                ? Array.from({ length: 16 }, (_, r) =>
                    escalatingHitRolls.slice(0, n).reduce((sum, hr) => sum + hr[r], 0)
                  ).filter(d => d >= result.defenderHp).length
                : result.rolls.filter(r => r * n >= result.defenderHp).length;
              const isRandKO = !isConfirmedKO && koCount > 0;
              const nKoText = isConfirmedKO ? '確定KO'
                : isRandKO ? `乱数KO ${Math.round(koCount / 16 * 100)}%`
                : '耐え';
              const nKoColor = isConfirmedKO ? '#FF3B30'
                : isRandKO ? (isDark ? '#FF9F40' : '#c95a00')
                : t.textWeak;
              const isExpected = isVariable && n === 3;
              // 可変技で min より小さいヒット数はスキップ
              if (isVariable && n < multiHit.min) return null;

              return (
                <div
                  key={n}
                  style={{
                    display: 'flex', alignItems: 'center', gap: 8,
                    padding: '3px 8px', borderRadius: 8,
                    background: isExpected ? t.glassChip : 'transparent',
                    boxShadow: isExpected ? `inset 0 0 0 0.5px ${t.rim}` : 'none',
                  }}
                >
                  <span style={{ fontSize: 11, color: isExpected ? t.text : t.textMuted, fontWeight: isExpected ? 700 : 500, width: 52 }}>
                    {n}ヒット{isExpected ? '★' : ''}
                  </span>
                  <span style={{ fontFamily: '"DM Mono", "SF Mono", monospace', fontSize: 11, color: t.text, flex: 1 }}>
                    {minPct.toFixed(1)}%〜{maxPct.toFixed(1)}%
                  </span>
                  <span style={{ fontSize: 11, fontWeight: 700, color: nKoColor, minWidth: 80, textAlign: 'right' }}>
                    {nKoText}
                  </span>
                </div>
              );
            })}
          </div>
        </div>
      )}

      {/* 展開エリア */}
      {expanded && (
        <div style={{ borderTop: `1px solid ${t.rim}`, paddingTop: 12, display: 'flex', flexDirection: 'column', gap: 10 }}>
          <div style={{ fontSize: 11, color: t.textMuted, display: 'flex', flexWrap: 'wrap', gap: 8 }}>
            <span>HP: {result.defenderHp}</span>
          </div>

          {/* ヒット別残HPバー（連続技のみ） */}
          {multiHit && (
            <div>
              <div style={{ fontSize: 10, fontWeight: 700, color: t.textMuted, letterSpacing: 0.8, marginBottom: 6 }}>ヒット別残HP</div>
              <div style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
                {Array.from({ length: multiHit.max }, (_, i) => i + 1)
                  .filter(n => !isVariable || n >= multiHit.min)
                  .map(n => {
                    const cumMin = escalatingHitRolls
                      ? escalatingHitRolls.slice(0, n).reduce((sum, hr) => sum + hr[0], 0)
                      : result.rolls[0] * n;
                    const cumMax = escalatingHitRolls
                      ? escalatingHitRolls.slice(0, n).reduce((sum, hr) => sum + hr[15], 0)
                      : result.rolls[15] * n;
                    const nMinPct = Math.min(100, Math.floor(cumMin / result.defenderHp * 1000) / 10);
                    const nMaxPct = Math.min(100, Math.floor(cumMax / result.defenderHp * 1000) / 10);
                    const nRemMin = Math.max(0, 100 - nMaxPct);
                    const nRemMax = Math.max(0, 100 - nMinPct);
                    const nIsKO = nRemMax === 0;
                    const nColor = nIsKO
                      ? 'linear-gradient(90deg,#FF6E6E,#FF3B30)'
                      : nRemMax <= 20 ? 'linear-gradient(90deg,#FF9F40,#FF6E6E)'
                      : nRemMax <= 49 ? 'linear-gradient(90deg,#FFD460,#FFA630)'
                      : 'linear-gradient(90deg,#5AC8FA,#34C759)';
                    const isExpected = isVariable && n === 3;
                    return (
                      <div key={n}>
                        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 2 }}>
                          <span style={{ fontSize: 10, color: isExpected ? t.text : t.textMuted, fontWeight: isExpected ? 700 : 500 }}>
                            {n}ヒット{isExpected ? '（期待値）' : ''}
                          </span>
                          <span style={{ fontFamily: '"DM Mono", "SF Mono", monospace', fontSize: 10, color: t.text }}>
                            残 {nRemMin.toFixed(1)}〜{nRemMax.toFixed(1)}%
                          </span>
                        </div>
                        <div style={{ height: 4, borderRadius: 99, background: t.track2, overflow: 'hidden', position: 'relative' }}>
                          <div style={{ position: 'absolute', left: 0, top: 0, height: '100%', width: `${nRemMin}%`, background: nColor, borderRadius: 99 }} />
                          <div style={{ position: 'absolute', top: 0, height: '100%', left: `${nRemMin}%`, width: `${nRemMax - nRemMin}%`, background: nColor, borderRadius: 99, opacity: 0.45 }} />
                        </div>
                      </div>
                    );
                  })}
              </div>
            </div>
          )}

          <div style={{ fontSize: 11, color: t.textMuted, display: 'flex', flexWrap: 'wrap', gap: 8 }}>
            <span>{result.moveCategory === 'Physical' ? '物理' : result.moveCategory === 'Special' ? '特殊' : '変化'} {result.movePower}</span>
            {attacker.item && <span>{attacker.item}</span>}
            {attacker.ability && <span>{ABILITY_JA[attacker.ability] ?? attacker.ability}</span>}
          </div>

          {/* 消耗ダメージ */}
          {hasHazard && (
            <Glass tint={t.glassNest} radius={6} padding={10} blur={12}>
              <div style={{ fontSize: 11, color: t.textMuted, fontWeight: 700, marginBottom: 4 }}>消耗ダメージ</div>
              {hazard.stealthRock > 0 && <div style={{ fontSize: 11, color: 'rgba(255,120,100,0.9)' }}>ステルスロック: {hazard.stealthRock} ({(hazard.stealthRock / result.defenderHp * 100).toFixed(1)}%)</div>}
              {hazard.spikes > 0 && <div style={{ fontSize: 11, color: 'rgba(255,160,80,0.9)' }}>まきびし: {hazard.spikes} ({(hazard.spikes / result.defenderHp * 100).toFixed(1)}%)</div>}
              {hazard.sand > 0 && <div style={{ fontSize: 11, color: 'rgba(220,180,80,0.9)' }}>砂ダメージ: {hazard.sand}</div>}
              <div style={{ borderTop: `1px solid ${t.rim}`, paddingTop: 4, marginTop: 4, fontSize: 11, color: t.text }}>
                実質HP: {effectiveHp} ({Math.floor(effectiveHp / result.defenderHp * 100)}%)
                {koWithHazardText && koWithHazardText !== koText && (
                  <span style={{ marginLeft: 8, color: t.accentAtk }}>→ 消耗込み: {koWithHazardText}</span>
                )}
              </div>
            </Glass>
          )}

          {/* 確定1発を防ぐ最小SP */}
          {(minDefSp !== null || minHpSp !== null) && (
            <Glass tint={t.glassNest} radius={6} padding={10} blur={12}>
              <div style={{ fontSize: 11, color: t.textMuted, fontWeight: 700, marginBottom: 4 }}>確定1発を防ぐ最小SP</div>
              {minDefSp !== null && (
                <div style={{ fontSize: 11, color: 'rgba(90,200,250,0.9)' }}>{defStatKey === 'def' ? '防御(B)' : '特防(D)'}: SP {minDefSp} 以上</div>
              )}
              {minHpSp !== null && (
                <div style={{ fontSize: 11, color: 'rgba(100,220,150,0.9)' }}>HP(H): SP {minHpSp} 以上</div>
              )}
            </Glass>
          )}

          {/* 乱数テーブル */}
          <div style={{ display: 'flex', flexWrap: 'wrap', gap: 4 }}>
            {result.rolls.map((r, i) => (
              <span key={i} style={{
                fontSize: 11, padding: '2px 6px', borderRadius: 6,
                fontFamily: 'monospace',
                background: r >= result.defenderHp ? 'rgba(220,60,60,0.3)' : t.glassChip2,
                boxShadow: r >= result.defenderHp ? 'inset 0 0 0 0.5px rgba(220,60,60,0.6)' : `inset 0 0 0 0.5px ${t.rim}`,
                color: r >= result.defenderHp ? 'rgba(255,120,100,0.9)' : t.text,
              }}>{r}</span>
            ))}
          </div>

          {/* ダメージから逆算 */}
          <Glass tint={t.glassNest} radius={6} padding={10} blur={12}>
            <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 10 }}>
              <div style={{ fontSize: 11, color: t.textMuted, fontWeight: 700 }}>▼ ダメージから相手の型を逆算（{swapped ? '攻撃側' : '防御側'}）</div>
              <div style={{ display: 'flex', gap: 4 }}>
                {(['dmg', 'pct'] as const).map(mode => (
                  <button key={mode} onClick={() => { setReverseMode(mode); setReverseResult(null); }}
                    style={{
                      fontSize: 11, padding: '3px 9px', borderRadius: 99,
                      background: reverseMode === mode ? 'rgba(90,200,250,0.2)' : t.glassChip,
                      boxShadow: reverseMode === mode ? `inset 0 0 0 0.5px ${t.rimAccent}` : `inset 0 0 0 0.5px ${t.rim}`,
                      color: reverseMode === mode ? t.accentAtk : t.textMuted,
                      border: 'none', cursor: 'pointer', fontWeight: 600,
                    }}>
                    {mode === 'dmg' ? '実数値' : '%'}
                  </button>
                ))}
              </div>
            </div>
            <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 8 }}>
              <span style={{ fontSize: 11, color: t.textMuted }}>与えたダメージ:</span>
              {reverseMode === 'dmg' ? (
                <input
                  type="number"
                  value={reverseDmg}
                  onChange={e => setReverseDmg(e.target.value)}
                  onFocus={e => e.target.select()}
                  placeholder="実数値"
                  style={{
                    width: 72, background: t.inputBg, color: t.text,
                    border: `1px solid ${t.rim}`, borderRadius: 8,
                    padding: '5px 8px', fontSize: 12, outline: 'none', textAlign: 'center',
                  }}
                />
              ) : (
                <div style={{ display: 'flex', alignItems: 'center', gap: 4 }}>
                  <input
                    type="number"
                    value={reversePct}
                    onChange={e => setReversePct(e.target.value)}
                    onFocus={e => e.target.select()}
                    placeholder="52.3"
                    style={{
                      width: 72, background: t.inputBg, color: t.text,
                      border: `1px solid ${t.rim}`, borderRadius: 8,
                      padding: '5px 8px', fontSize: 12, outline: 'none', textAlign: 'center',
                    }}
                  />
                  <span style={{ fontSize: 12, color: t.textMuted }}>%</span>
                </div>
              )}
              <button
                onClick={() => {
                  const move = data.moves.find(m => m.name === moveEnName);
                  if (!move) return;
                  let dmg: number;
                  if (reverseMode === 'dmg') {
                    dmg = parseInt(reverseDmg);
                  } else {
                    const pct = parseFloat(reversePct);
                    if (!pct || pct <= 0) return;
                    dmg = Math.round(result.defenderHp * pct / 100);
                  }
                  if (!dmg || dmg <= 0) return;
                  setReverseResult(
                    swapped
                      ? reverseCalcAttack(data, attacker, defender, move, cond, dmg)
                      : reverseCalcDefense(data, attacker, defender, move, cond, dmg),
                  );
                }}
                style={{
                  padding: '5px 12px', borderRadius: 99,
                  background: 'rgba(90,200,250,0.2)', boxShadow: `inset 0 0 0 0.5px ${t.rimAccent}`,
                  color: t.accentAtk, fontSize: 12, fontWeight: 700, border: 'none', cursor: 'pointer',
                }}
              >逆算</button>
            </div>
            {reverseResult && (
              <div>
                <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 6 }}>
                  <div style={{ fontSize: 11, color: t.text, fontWeight: 700 }}>
                    {reverseResult.statLabel} の候補（補正区分別）:
                  </div>
                  <button onClick={() => setReverseResult(null)}
                    style={{ fontSize: 11, padding: '3px 9px', borderRadius: 99, background: t.glassChip, boxShadow: `inset 0 0 0 0.5px ${t.rim}`, color: t.textMuted, border: 'none', cursor: 'pointer', fontWeight: 600 }}>
                    ✕ クリア
                  </button>
                </div>
                {reverseResult.groups.every(g => g.entries.length === 0) ? (
                  <div style={{ fontSize: 11, color: 'rgba(255,100,100,0.8)' }}>該当なし（値を確認してください）</div>
                ) : (
                  <div style={{ display: 'flex', gap: 6 }}>
                    {reverseResult.groups.map((g) => (
                      <div key={g.correction} style={{
                        flex: 1, background: t.glassChip, borderRadius: 8,
                        boxShadow: `inset 0 0 0 0.5px ${t.rim}`, padding: '6px 8px',
                      }}>
                        <div style={{ fontSize: 10.5, fontWeight: 700, color: t.accentAtk, marginBottom: 4 }}>{g.label}</div>
                        {g.entries.length === 0 ? (
                          <div style={{ fontSize: 10, color: t.textWeak }}>—</div>
                        ) : (
                          <div style={{ display: 'flex', flexDirection: 'column', gap: 3 }}>
                            {g.entries.map((e, i) => (
                              <div key={i} style={{ fontSize: 10.5, lineHeight: 1.4 }}>
                                <span style={{ color: t.text, fontWeight: 700 }}>{e.statValue}</span>
                                <span style={{ color: t.textMuted }}>
                                  {' '}(SP{e.spMin === e.spMax ? e.spMin : `${e.spMin}–${e.spMax}`})
                                </span>
                              </div>
                            ))}
                          </div>
                        )}
                      </div>
                    ))}
                  </div>
                )}
              </div>
            )}
          </Glass>
        </div>
      )}
    </Glass>
  );
}

// ─── 結果セクション（自動保存付き） ───
function ResultsSection({ data, attacker, defender, moveSlots, cond, onCalcHistory, swapped }: {
  data: ChampionsData; attacker: PokemonBuild; defender: PokemonBuild;
  moveSlots: string[]; cond: BattleConditions;
  onCalcHistory?: Props['onCalcHistory'];
  swapped: boolean;
}) {
  const t = useTheme();
  const activeMoves = moveSlots.filter(Boolean);
  const savedRef = useRef('');

  const results = useMemo(() => {
    return activeMoves.map(moveEnName => {
      const move = data.moves.find(m => m.name === moveEnName);
      if (!move) return null;
      const atkBs = findBaseStats(data.baseStats, attacker.rosterName, attacker.isMega, attacker.megaFormName);
      const defBs = findBaseStats(data.baseStats, defender.rosterName, defender.isMega, defender.megaFormName);
      if (!atkBs || !defBs) return null;
      const atkNature = data.natures.find(n => n.name === attacker.nature) ?? { name: 'Hardy', increasedStat: null, decreasedStat: null };
      const defNature = data.natures.find(n => n.name === defender.nature) ?? { name: 'Hardy', increasedStat: null, decreasedStat: null };
      const atkStats = computeStats(atkBs, attacker.ivs, attacker.sp, atkNature, attacker.statMult);
      const defStats = computeStats(defBs, defender.ivs, defender.sp, defNature, defender.statMult);
      const atkEntry = attacker.isMega && attacker.megaFormName
        ? data.roster.find(r => r.name === attacker.megaFormName)
        : getSelectableRoster(data.roster).find(r => r.name === attacker.rosterName);
      const defEntry = defender.isMega && defender.megaFormName
        ? data.roster.find(r => r.name === defender.megaFormName)
        : getSelectableRoster(data.roster).find(r => r.name === defender.rosterName);
      const atkTypes = atkEntry?.types ?? [];
      const defTypes = defEntry?.types ?? [];
      const effectiveness = getTypeEffectiveness(move.type, defTypes);
      const rolls = calcDamageRolls(atkStats, defStats, atkTypes, defTypes, move, cond, attacker.item, defender.item, attacker.ability, defender.ability);
      return buildResult(rolls, defStats.hp, effectiveness, moveEnName, move.type, move.power, move.category);
    }).filter(Boolean) as ReturnType<typeof buildResult>[];
  }, [data, attacker, defender, activeMoves.join(','), cond]);

  useEffect(() => {
    if (!onCalcHistory || results.length === 0 || !attacker.rosterName || !defender.rosterName) return;
    const key = JSON.stringify({ a: attacker.rosterName, d: defender.rosterName, m: activeMoves, r: results.map(r => r.minPercent) });
    if (key === savedRef.current) return;
    savedRef.current = key;
    onCalcHistory({
      attacker, defender, moveSlots, conditions: cond,
      results: results.map(r => ({ moveName: r.moveName, minPercent: r.minPercent, maxPercent: r.maxPercent, ko1Chance: r.ko1Chance, guaranteed2HKO: r.guaranteed2HKO })),
    });
  }, [results]);

  return (
    <div>
      <div style={{ fontSize: 11, fontWeight: 800, color: t.textMuted, letterSpacing: 1.4, padding: '0 4px 10px' }}>計算結果</div>
      <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
        {moveSlots.map((m, i) => m ? (
          <ResultCard key={i} data={data} attacker={attacker} defender={defender} moveEnName={m} cond={cond} swapped={swapped} />
        ) : null)}
      </div>
    </div>
  );
}

// ─── メイン ───
export function Calculator({ data, myPartyMembers = [], opponentMembers = [], pokemonHistory = [], onHistoryAdd = () => {}, onCalcHistory, reloadEntry, onReloadConsumed, onOpponentChange }: Props) {
  const t = useTheme();
  const [attacker, setAttacker] = useState<PokemonBuild>(defaultBuild());
  const [defender, setDefender] = useState<PokemonBuild>(defaultBuild());
  const [moveSlots, setMoveSlots] = useState<string[]>(['', '', '', '']);
  // 反対向き（攻守入替後）の技セットを保持し、往復しても各向きの技を復元する
  const [otherMoveSlots, setOtherMoveSlots] = useState<string[]>(['', '', '', '']);
  const [cond, setCond] = useState<BattleConditions>({ ...DEFAULT_CONDITIONS });
  const [learnsetFilter, setLearnsetFilter] = useState(true);
  // 攻守の向き: false=自が攻撃/相が防御, true=相が攻撃/自が防御
  const [swapped, setSwapped] = useState(false);

  useEffect(() => {
    if (reloadEntry) {
      setAttacker(reloadEntry.attacker);
      setDefender(reloadEntry.defender);
      setMoveSlots([...reloadEntry.moveSlots, '', '', '', ''].slice(0, 4));
      setOtherMoveSlots(['', '', '', '']);
      setCond(reloadEntry.conditions);
      setSwapped(false);
      onReloadConsumed?.();
    }
  }, [reloadEntry]);

  function setSlot(i: number, v: string) {
    const next = [...moveSlots]; next[i] = v; setMoveSlots(next);
  }
  function loadIntoAttacker(build: PokemonBuild) {
    setAttacker(build);
    if (build.moves?.length) setMoveSlots([...build.moves, '', '', ''].slice(0, 4));
  }
  function loadIntoDefender(build: PokemonBuild) {
    setDefender(build);
  }
  function swap() {
    const [a, d] = [attacker, defender];
    setAttacker(d); setDefender(a);
    // 技は向きごとに保持。現在の技と反対向きの技を入れ替える
    setMoveSlots(otherMoveSlots);
    setOtherMoveSlots(moveSlots);
    setSwapped(s => !s); // 向きを保持（交替したまま）
  }

  // 相手側のメガ変更を保存済み相手パーティに同期（同名メンバーのメガ状態を更新）
  function syncOpponentMega(b: PokemonBuild) {
    if (!onOpponentChange || !b.rosterName) return;
    let changed = false;
    const next = opponentMembers.map(m => {
      if (m.rosterName === b.rosterName && (m.isMega !== b.isMega || m.megaFormName !== b.megaFormName)) {
        changed = true;
        return { ...m, isMega: b.isMega, megaFormName: b.megaFormName, ability: b.ability };
      }
      return m;
    });
    if (changed) onOpponentChange(next);
  }
  // 攻守の向きに応じて「相手側」の変更だけ同期する
  function changeAttacker(b: PokemonBuild) { setAttacker(b); if (swapped) syncOpponentMega(b); }
  function changeDefender(b: PokemonBuild) { setDefender(b); if (!swapped) syncOpponentMega(b); }

  const activeMoves = moveSlots.filter(Boolean);

  return (
    <div style={{ padding: '70px 16px 130px', maxWidth: 500, margin: '0 auto' }}>
      {/* ヘッダー */}
      <div style={{ marginBottom: 14 }}>
        <div style={{ fontSize: 13, fontWeight: 600, color: t.textMuted, letterSpacing: 0.4, marginBottom: 2 }}>POKÉMON CHAMPIONS</div>
        <div style={{ fontSize: 30, fontWeight: 800, color: t.text, letterSpacing: 0.2, lineHeight: 1.1 }}>ダメ計</div>
      </div>

      {/* パーティクイック選択 */}
      {(myPartyMembers.some(Boolean) || opponentMembers.some(m => m?.rosterName)) && (
        <Glass tint={t.glassTint2} radius={8} padding={12} style={{ marginBottom: 12 }}>
          <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
            <PartyQuickBar label="自" accentColor={t.accentAtk} members={myPartyMembers}
              selectedName={swapped ? defender.rosterName : attacker.rosterName}
              onSelect={swapped ? loadIntoDefender : loadIntoAttacker} />
            <PartyQuickBar label="相" accentColor={t.accentDef} members={opponentMembers}
              selectedName={swapped ? attacker.rosterName : defender.rosterName}
              onSelect={swapped ? loadIntoAttacker : loadIntoDefender} />
          </div>
        </Glass>
      )}

      <PokemonPanel
        title="攻撃側" build={attacker} onChange={changeAttacker} data={data} showAtkSp={true}
        cond={cond} onCondChange={setCond}
        pokemonHistory={pokemonHistory} myPartyMembers={myPartyMembers} opponentMembers={opponentMembers}
        onHistoryAdd={onHistoryAdd}
      />

      <MoveSlots slots={moveSlots} onChange={setSlot} data={data}
        rosterName={attacker.rosterName} learnsetFilter={learnsetFilter}
        onToggleFilter={() => setLearnsetFilter(f => !f)} />

      <ConditionsPanel cond={cond} onChange={setCond} />

      <div style={{ display: 'flex', justifyContent: 'center', marginBottom: 10 }}>
        <button
          onClick={swap}
          style={{
            padding: '8px 20px', borderRadius: 99,
            background: t.glassChip, boxShadow: `inset 0 0 0 0.5px ${t.rim}`,
            color: t.textMuted, fontSize: 13, fontWeight: 600, border: 'none', cursor: 'pointer',
          }}
        >⇅ 攻守入れ替え</button>
      </div>

      <PokemonPanel
        title="防御側" build={defender} onChange={changeDefender} data={data} showAtkSp={false}
        cond={cond} onCondChange={setCond}
        pokemonHistory={pokemonHistory} myPartyMembers={myPartyMembers} opponentMembers={opponentMembers}
        onHistoryAdd={onHistoryAdd}
      />

      {activeMoves.length > 0 ? (
        <ResultsSection data={data} attacker={attacker} defender={defender} moveSlots={moveSlots} cond={cond} onCalcHistory={onCalcHistory} swapped={swapped} />
      ) : (
        <Glass tint={t.glassTint2} radius={8} padding={16}>
          <p style={{ textAlign: 'center', color: t.textMuted, fontSize: 14, margin: 0 }}>ポケモンと技を選択してください</p>
        </Glass>
      )}
    </div>
  );
}
