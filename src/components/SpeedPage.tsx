import { useState, useMemo, useEffect } from 'react';
import { Glass, SpSlider } from './Glass';
import { useTheme, useThemeName } from '../theme';
import type { ChampionsData, PokemonBuild } from '../types';
import type { BoxPokemon } from '../store';
import { findBaseStats, getMegaForms } from '../data';
import { computeStats, calcStat } from '../engine/stats';
import {
  finalSpeed, speedPresets, compareSpeed,
  DEFAULT_SPEED_CONDITIONS,
  type SpeedConditions,
  detectSpeedAbility,
  type SpeedAbilityInfo,
} from '../engine/speed';
import { PokemonSelectModal } from './PokemonSelectModal';
import { displayPokemonName, abilityJaName } from '../i18n';
import { getSpriteUrl, getFallbackSpriteUrl, getMegaSpriteUrl } from '../sprites';

// ─── Props ───
interface Props {
  data: ChampionsData;
  myPartyMembers: (PokemonBuild | null)[];  // アクティブパーティのスロット（null=空き）
  box: BoxPokemon[];                        // ボックス個体プール
  opponentMembers: PokemonBuild[];          // ダメ計タブで登録した相手パーティ
}

// ─── 自分側候補（パーティ + ボックス）───
interface MyCandidate {
  /** 表示名（日本語） */
  displayName: string;
  /** スプライト取得用の名前（メガ考慮済み） */
  spriteName: string;
  /** ロスター名（フォールバックスプライット取得用） */
  rosterName: string;
  /** 図鑑番号（フォールバックスプライット用） */
  dexNumber: number;
  /** ビルド本体 */
  build: PokemonBuild;
  /** ニックネーム（ボックス個体のみ） */
  nickname?: string;
  /** 候補の出所 */
  source: 'party' | 'box';
}

// ─── ランクステッパー ───
function RankStepper({ value, onChange }: { value: number; onChange: (v: number) => void }) {
  const t = useTheme();
  const btnStyle = (disabled: boolean): React.CSSProperties => ({
    width: 28, height: 28, borderRadius: 8,
    background: t.glassChip, border: `0.5px solid ${t.rim}`,
    color: disabled ? t.textWeak : t.text,
    fontSize: 16, fontWeight: 700, cursor: disabled ? 'default' : 'pointer',
    display: 'flex', alignItems: 'center', justifyContent: 'center',
    transition: 'opacity 0.15s',
    opacity: disabled ? 0.4 : 1,
    flexShrink: 0,
  });
  return (
    <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
      <button style={btnStyle(value <= -6)} onClick={() => onChange(Math.max(-6, value - 1))}>−</button>
      <span style={{
        width: 28, textAlign: 'center',
        fontSize: 14, fontWeight: 800,
        color: value > 0 ? 'rgba(80,220,160,0.95)' : value < 0 ? 'rgba(255,110,110,0.95)' : t.text,
      }}>
        {value > 0 ? `+${value}` : value}
      </span>
      <button style={btnStyle(value >= 6)} onClick={() => onChange(Math.min(6, value + 1))}>＋</button>
    </div>
  );
}

// ─── トグルチップ ───
function ToggleChip({ label, active, onClick }: { label: string; active: boolean; onClick: () => void }) {
  const t = useTheme();
  const isDark = useThemeName() === 'dark';
  return (
    <button
      onClick={onClick}
      style={{
        padding: '5px 11px', borderRadius: 20, border: 'none',
        background: active
          ? (isDark ? 'rgba(0,220,160,0.28)' : 'rgba(0,180,130,0.22)')
          : t.glassChip,
        boxShadow: active
          ? `inset 0 0 0 1.5px rgba(0,220,160,0.75)`
          : `inset 0 0 0 0.5px ${t.rim}`,
        color: active ? (isDark ? 'rgba(0,255,200,0.95)' : 'rgba(0,140,100,0.95)') : t.textMuted,
        fontSize: 12, fontWeight: 700, cursor: 'pointer',
        transition: 'all 0.18s',
        whiteSpace: 'nowrap',
      }}
    >
      {label}
    </button>
  );
}

// ─── 補正コントロールブロック ───
function CondControls({ cond, onChange }: { cond: SpeedConditions; onChange: (c: SpeedConditions) => void }) {
  const t = useTheme();
  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
      {/* ランク */}
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
        <span style={{ fontSize: 12, color: t.textMuted, fontWeight: 600 }}>ランク補正</span>
        <RankStepper value={cond.rank} onChange={v => onChange({ ...cond, rank: v })} />
      </div>
      {/* チップ群 */}
      <div style={{ display: 'flex', gap: 6, flexWrap: 'wrap' }}>
        <ToggleChip label="スカーフ" active={cond.scarf}     onClick={() => onChange({ ...cond, scarf: !cond.scarf })} />
        <ToggleChip label="おいかぜ" active={cond.tailwind}  onClick={() => onChange({ ...cond, tailwind: !cond.tailwind })} />
        <ToggleChip label="まひ"     active={cond.paralyzed} onClick={() => onChange({ ...cond, paralyzed: !cond.paralyzed })} />
      </div>
    </div>
  );
}

// ─── 比較結果の色 ───
function verdictColor(verdict: 'faster' | 'tie' | 'slower', isDark: boolean): string {
  if (verdict === 'faster')  return isDark ? 'rgba(60,220,120,0.95)' : 'rgba(0,140,70,0.95)';
  if (verdict === 'tie')     return isDark ? 'rgba(255,210,0,0.95)'  : 'rgba(180,130,0,0.95)';
  return isDark ? 'rgba(255,90,90,0.95)' : 'rgba(200,30,30,0.95)';
}
function verdictBg(verdict: 'faster' | 'tie' | 'slower', isDark: boolean): string {
  if (verdict === 'faster')  return isDark ? 'rgba(60,220,120,0.18)' : 'rgba(0,180,90,0.14)';
  if (verdict === 'tie')     return isDark ? 'rgba(255,210,0,0.18)'  : 'rgba(200,150,0,0.14)';
  return isDark ? 'rgba(255,90,90,0.18)' : 'rgba(200,30,30,0.12)';
}
function verdictRim(verdict: 'faster' | 'tie' | 'slower', isDark: boolean): string {
  if (verdict === 'faster')  return isDark ? 'rgba(60,220,120,0.6)'  : 'rgba(0,160,80,0.7)';
  if (verdict === 'tie')     return isDark ? 'rgba(255,210,0,0.6)'   : 'rgba(200,150,0,0.7)';
  return isDark ? 'rgba(255,90,90,0.6)' : 'rgba(200,30,30,0.6)';
}

// ─── 自由比較スロット ───
// 好きなポケモンを1体選び、SP振り＋性格補正から素早さ実数値を算出して指定する。
interface FreeSlot {
  rosterName: string;
  isMega: boolean;
  megaFormName: string;
  sp: number;          // 素早さへの SP 振り（0〜32）
  natureMult: number;  // 性格補正: 0.9=下降 / 1.0=無補正 / 1.1=上昇
  cond: SpeedConditions;
  abilityOn: boolean;
}

const EMPTY_FREE_SLOT: FreeSlot = {
  rosterName: '', isMega: false, megaFormName: '',
  sp: 32, natureMult: 1.0,
  cond: { ...DEFAULT_SPEED_CONDITIONS }, abilityOn: false,
};

// スロットの素早さ実数値（補正前）。IV31固定・SP振り・性格補正から算出。
function slotBaseStat(data: ChampionsData, slot: FreeSlot): number | null {
  if (!slot.rosterName) return null;
  const bs = findBaseStats(data.baseStats, slot.rosterName, slot.isMega, slot.megaFormName);
  if (!bs) return null;
  return calcStat(bs.spe, 31, slot.sp, slot.natureMult);
}

// スロットの素早さ特性（メガ時はメガフォームのエントリを参照）
function slotSpeedAbility(data: ChampionsData, slot: FreeSlot): { en: string; info: SpeedAbilityInfo } | null {
  const entryName = slot.isMega && slot.megaFormName ? slot.megaFormName : slot.rosterName;
  const entry = data.roster.find(r => r.name === entryName);
  return detectSpeedAbility(entry?.abilities ?? {});
}

// スロットの最終素早さ（補正・特性込み）
function slotFinalSpeed(data: ChampionsData, slot: FreeSlot): number | null {
  const stat = slotBaseStat(data, slot);
  if (stat === null) return null;
  const ab = slot.abilityOn ? slotSpeedAbility(data, slot) : null;
  const cond: SpeedConditions = ab
    ? { ...slot.cond, abilityMod: ab.info.mod, ignoreParaSpeed: ab.info.ignorePara }
    : slot.cond;
  return finalSpeed(stat, cond);
}

// ─── 自由比較の1スロットカード ───
function FreeSlotCard({ data, slot, onChange, accent, label, myPartyMembers, opponentMembers, onRemove }: {
  data: ChampionsData; slot: FreeSlot; onChange: (s: FreeSlot) => void;
  accent: string; label: string;
  myPartyMembers: (PokemonBuild | null)[]; opponentMembers: PokemonBuild[];
  onRemove?: () => void;
}) {
  const t = useTheme();
  const [showModal, setShowModal] = useState(false);

  const bs = slot.rosterName ? findBaseStats(data.baseStats, slot.rosterName, slot.isMega, slot.megaFormName) : null;
  const megaForms = useMemo(() => slot.rosterName ? getMegaForms(data.baseStats, slot.rosterName) : [], [data.baseStats, slot.rosterName]);
  const ability = slot.rosterName ? slotSpeedAbility(data, slot) : null;
  const baseStat = slotBaseStat(data, slot); // SP振り＋性格補正からの実数値
  const finalSp = slotFinalSpeed(data, slot);

  const rosterEntry = data.roster.find(r => r.name === slot.rosterName);
  const spriteName = slot.isMega && slot.megaFormName ? slot.megaFormName : slot.rosterName;
  const dispName = slot.isMega && slot.megaFormName
    ? displayPokemonName(slot.megaFormName)
    : slot.rosterName ? displayPokemonName(slot.rosterName) : '';

  // メガON/OFF（素早さ計算用：ベース種族値と特性が変わる）
  function toggleMega(megaName: string, on: boolean) {
    onChange({ ...slot, isMega: on, megaFormName: on ? megaName : '', abilityOn: false });
  }

  return (
    <Glass tint={t.glassTint} radius={20} padding={14} style={{ flex: 1, minWidth: 0 }}>
      {/* ラベル行（削除ボタン付き） */}
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 8 }}>
        <div style={{ fontSize: 10, fontWeight: 800, color: accent, letterSpacing: 1.2 }}>{label}</div>
        {onRemove && (
          <button onClick={onRemove} style={{ background: 'none', border: 'none', cursor: 'pointer', color: t.textWeak, fontSize: 14, padding: 0 }}>✕</button>
        )}
      </div>

      {/* ポケモン選択ボタン */}
      <button
        onClick={() => setShowModal(true)}
        style={{
          width: '100%', display: 'flex', alignItems: 'center', gap: 8,
          background: t.glassChip, border: `0.5px solid ${t.rim}`, borderRadius: 12,
          padding: '8px 10px', cursor: 'pointer', textAlign: 'left',
        }}
      >
        {rosterEntry && (
          <img
            src={slot.isMega && slot.megaFormName ? getMegaSpriteUrl(rosterEntry.dexNumber, slot.megaFormName) : getSpriteUrl(spriteName)}
            onError={e => {
              const img = e.target as HTMLImageElement;
              if (img.dataset.fellBack) { img.style.opacity = '0'; return; }
              img.dataset.fellBack = '1';
              img.src = getFallbackSpriteUrl(rosterEntry.dexNumber);
            }}
            alt="" style={{ width: 32, height: 32, imageRendering: 'pixelated', flexShrink: 0 }}
          />
        )}
        <span style={{ flex: 1, minWidth: 0, fontSize: 14, fontWeight: 700, color: slot.rosterName ? t.text : t.textMuted, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
          {dispName || 'ポケモンを選択...'}
        </span>
        {bs && <span style={{ fontSize: 11, color: t.textMuted, flexShrink: 0 }}>種族値S {bs.spe}</span>}
      </button>

      {/* メガトグル */}
      {megaForms.length > 0 && (
        <div style={{ display: 'flex', gap: 6, flexWrap: 'wrap', marginTop: 8 }}>
          {megaForms.map(mf => {
            const suffix = mf.name.replace(`Mega ${slot.rosterName}`, '').trim() || 'メガ';
            const sel = slot.isMega && slot.megaFormName === mf.name;
            return (
              <ToggleChip key={mf.name} label={`メガ${suffix === 'メガ' ? '' : ' ' + suffix}`}
                active={sel} onClick={() => toggleMega(mf.name, !sel)} />
            );
          })}
        </div>
      )}

      {bs && (
        <>
          {/* 性格補正 + SP振り → 実数値を算出（IV31固定） */}
          <div style={{ marginTop: 12 }}>
            <div style={{ fontSize: 11, color: t.textMuted, fontWeight: 600, marginBottom: 6 }}>性格補正</div>
            <div style={{ display: 'flex', gap: 6, flexWrap: 'wrap' }}>
              {([[0.9, '下降'], [1.0, '無補正'], [1.1, '上昇']] as const).map(([mult, lbl]) => (
                <ToggleChip key={lbl} label={lbl}
                  active={slot.natureMult === mult}
                  onClick={() => onChange({ ...slot, natureMult: mult })} />
              ))}
            </div>
            <div style={{ marginTop: 10 }}>
              <SpSlider label="SP振り" value={slot.sp} onChange={v => onChange({ ...slot, sp: v })} actual={baseStat ?? undefined} />
            </div>
          </div>

          {/* 補正 */}
          <div style={{ marginTop: 12 }}>
            <CondControls cond={slot.cond} onChange={c => onChange({ ...slot, cond: c })} />
            {ability && (
              <div style={{ marginTop: 8 }}>
                <ToggleChip
                  label={`${abilityJaName(ability.en)}（${ability.info.label}）`}
                  active={slot.abilityOn}
                  onClick={() => onChange({ ...slot, abilityOn: !slot.abilityOn })}
                />
              </div>
            )}
          </div>

          {/* 最終素早さ */}
          <div style={{ marginTop: 12, textAlign: 'center', padding: '10px 0 2px', borderTop: `0.5px solid ${t.track}` }}>
            <div style={{ fontSize: 10, color: t.textMuted, letterSpacing: 0.4, marginBottom: 2 }}>最終素早さ</div>
            <div style={{ fontSize: 34, fontWeight: 900, color: accent, lineHeight: 1 }}>{finalSp ?? '—'}</div>
          </div>
        </>
      )}

      {showModal && (
        <PokemonSelectModal
          data={data} pokemonHistory={[]}
          myPartyMembers={myPartyMembers} opponentMembers={opponentMembers}
          currentName={slot.rosterName}
          onSelect={name => { onChange({ ...EMPTY_FREE_SLOT, rosterName: name }); setShowModal(false); }}
          onClose={() => setShowModal(false)}
        />
      )}
    </Glass>
  );
}

// ─── SpeedPage 本体 ───
export function SpeedPage({ data, myPartyMembers, box, opponentMembers }: Props) {
  const t = useTheme();
  const isDark = useThemeName() === 'dark';

  // モード: 'battle'=対戦用（パーティ/ボックス vs 登録した相手）, 'free'=自由比較（可変複数体）
  const [mode, setMode] = useState<'battle' | 'free'>('battle');
  // 自由比較スロット（最小2・最大6の可変配列）
  const [freeSlots, setFreeSlots] = useState<FreeSlot[]>([
    { ...EMPTY_FREE_SLOT, cond: { ...DEFAULT_SPEED_CONDITIONS } },
    { ...EMPTY_FREE_SLOT, cond: { ...DEFAULT_SPEED_CONDITIONS } },
  ]);
  // 基準ポケモン（このスロットを基準に各行の抜ける/抜かれるを判定）
  const [refIdx, setRefIdx] = useState(0);

  // 自分側の補正
  const [myCond, setMyCond] = useState<SpeedConditions>(DEFAULT_SPEED_CONDITIONS);
  // 相手側：おいかぜのみ共通（場の効果）
  const [theirTailwind, setTheirTailwind] = useState(false);
  // 相手個体ごとの補正（idxキー）。未設定はデフォルト。
  const [oppConds, setOppConds] = useState<Record<number, { rank: number; scarf: boolean; paralyzed: boolean }>>({});
  // 自分側選択中インデックス（candidates 配列のインデックス）
  const [selectedIdx, setSelectedIdx] = useState<number | null>(null);
  // 自分の素早さ特性トグル
  const [myAbilityOn, setMyAbilityOn] = useState(false);
  // 相手個体別の素早さ特性トグル（キー: opponentMembers のインデックス）
  const [oppAbilityOn, setOppAbilityOn] = useState<Record<number, boolean>>({});

  // ── 自分側候補を組み立て ──
  // 1) アクティブパーティの非 null メンバー
  // 2) ボックス個体（build を持つもの）
  const candidates: MyCandidate[] = useMemo(() => {
    const list: MyCandidate[] = [];

    // パーティメンバー
    for (const member of myPartyMembers) {
      if (!member?.rosterName) continue;
      const rosterEntry = data.roster.find(r => r.name === member.rosterName);
      if (!rosterEntry) continue;
      // メガシンカ時はメガフォーム名でスプライトを取得
      const spriteName = member.isMega && member.megaFormName ? member.megaFormName : member.rosterName;
      list.push({
        displayName: member.isMega && member.megaFormName
          ? displayPokemonName(member.megaFormName)
          : displayPokemonName(member.rosterName),
        spriteName,
        rosterName: member.rosterName,
        dexNumber: rosterEntry.dexNumber,
        build: member,
        source: 'party',
      });
    }

    // ボックス個体
    for (const boxmon of box) {
      if (!boxmon.build?.rosterName) continue;
      const rosterEntry = data.roster.find(r => r.name === boxmon.build.rosterName);
      if (!rosterEntry) continue;
      const spriteName = boxmon.build.isMega && boxmon.build.megaFormName
        ? boxmon.build.megaFormName : boxmon.build.rosterName;
      list.push({
        displayName: boxmon.build.isMega && boxmon.build.megaFormName
          ? displayPokemonName(boxmon.build.megaFormName)
          : displayPokemonName(boxmon.build.rosterName),
        spriteName,
        rosterName: boxmon.build.rosterName,
        dexNumber: rosterEntry.dexNumber,
        build: boxmon.build,
        nickname: boxmon.nickname,
        source: 'box',
      });
    }

    return list;
  }, [myPartyMembers, box, data.roster]);

  // 選択中候補
  const selected = selectedIdx !== null ? candidates[selectedIdx] ?? null : null;

  // 選択個体が変わったら特性トグルをリセット。
  // こだわりスカーフ所持なら自動でスカーフ補正をON、非所持ならOFFにする。
  useEffect(() => {
    setMyAbilityOn(false);
    const holdsScarf = selected?.build.item === 'Choice Scarf';
    setMyCond(c => ({ ...c, scarf: holdsScarf }));
  }, [selectedIdx]); // eslint-disable-line react-hooks/exhaustive-deps

  // 選択中個体のロースターエントリから素早さ特性を検出
  const mySpeedAbility = useMemo((): { en: string; info: SpeedAbilityInfo } | null => {
    if (!selected) return null;
    // メガ時はメガフォーム名のエントリを参照（特性固定なので chosen 無し）
    // 非メガ時はユーザーが選択した特性（build.ability）を優先
    const entryName = selected.build.isMega && selected.build.megaFormName
      ? selected.build.megaFormName
      : selected.build.rosterName;
    const entry = data.roster.find(r => r.name === entryName);
    const chosen = (!selected.build.isMega && selected.build.ability) ? selected.build.ability : undefined;
    return detectSpeedAbility(entry?.abilities ?? {}, chosen);
  }, [selected, data.roster]);

  // 選択中個体の S 実数値を computeStats で算出
  const myStatSpe: number | null = useMemo(() => {
    if (!selected) return null;
    const bs = findBaseStats(
      data.baseStats,
      selected.build.rosterName,
      selected.build.isMega,
      selected.build.megaFormName,
    );
    if (!bs) return null;
    const nature = data.natures.find(n => n.name === selected.build.nature)
      ?? { name: 'Hardy', increasedStat: null, decreasedStat: null };
    // statMult がある場合は multOverride として渡す（Calculator.tsx と同方式）
    const computed = computeStats(bs, selected.build.ivs, selected.build.sp, nature, selected.build.statMult);
    return computed.spe;
  }, [selected, data.baseStats, data.natures]);

  // 素早さ特性ONを反映した補正（特性がONのときのみ abilityMod を注入）
  const myCondEff: SpeedConditions = mySpeedAbility && myAbilityOn
    ? { ...myCond, abilityMod: mySpeedAbility.info.mod, ignoreParaSpeed: mySpeedAbility.info.ignorePara }
    : myCond;

  // 自分の最終素早さ
  const myFinalSpeed: number | null = myStatSpe !== null ? finalSpeed(myStatSpe, myCondEff) : null;

  // ── 自由比較スロット操作ヘルパー ──
  const MAX_FREE_SLOTS = 6;
  function updateFreeSlot(i: number, s: FreeSlot) {
    setFreeSlots(prev => prev.map((x, idx) => (idx === i ? s : x)));
  }
  function addFreeSlot() {
    setFreeSlots(prev => (prev.length >= MAX_FREE_SLOTS ? prev : [...prev, { ...EMPTY_FREE_SLOT, cond: { ...DEFAULT_SPEED_CONDITIONS } }]));
  }
  function removeFreeSlot(i: number) {
    setFreeSlots(prev => prev.filter((_, idx) => idx !== i));
    setRefIdx(prev => (i === prev ? 0 : i < prev ? prev - 1 : prev));
  }
  const slotLetter = (i: number) => String.fromCharCode(65 + i);

  return (
    <div style={{ padding: '70px 16px 130px', maxWidth: 500, margin: '0 auto' }}>

      {/* ── ヘッダー ── */}
      <div style={{ marginBottom: 18 }}>
        <div style={{ fontSize: 13, fontWeight: 600, color: t.textMuted, letterSpacing: 0.4, marginBottom: 2 }}>SPEED CHECK</div>
        <div style={{ fontSize: 30, fontWeight: 800, color: t.text, letterSpacing: 0.2, lineHeight: 1.1 }}>素早さ比較</div>
      </div>

      {/* ── モード切替（対戦 / 自由比較）── */}
      <Glass tint={t.tabTint} radius={14} padding={4} style={{ marginBottom: 14 }}>
        <div style={{ display: 'flex', gap: 4 }}>
          {([['battle', '対戦'], ['free', '自由比較']] as const).map(([m, lbl]) => (
            <button
              key={m}
              onClick={() => setMode(m)}
              style={{
                flex: 1, padding: '9px 0', textAlign: 'center', borderRadius: 11,
                background: mode === m ? t.tabActiveBg : 'transparent',
                boxShadow: mode === m ? t.tabActiveShadow : 'none',
                color: mode === m ? t.text : t.tabInactive,
                fontSize: 13, fontWeight: 700, border: 'none', cursor: 'pointer',
                transition: 'all 0.2s',
              }}
            >{lbl}</button>
          ))}
        </div>
      </Glass>

      {/* ── 自由比較モード ── */}
      {mode === 'free' && (
        <>
          <p style={{ fontSize: 12, color: t.textMuted, margin: '0 0 12px' }}>
            好きなポケモンを並べて素早さを比較できます。基準ポケモンを選ぶと抜ける/抜かれるが色分け表示されます。
          </p>
          {/* スロットカード群（縦並び・可変） */}
          <div style={{ display: 'flex', flexDirection: 'column', gap: 10, marginBottom: 12 }}>
            {freeSlots.map((slot, i) => (
              <FreeSlotCard
                key={i}
                data={data}
                slot={slot}
                onChange={s => updateFreeSlot(i, s)}
                label={`ポケモン ${slotLetter(i)}`}
                accent={i === refIdx ? t.accentAtk : t.accentDef}
                myPartyMembers={myPartyMembers}
                opponentMembers={opponentMembers}
                onRemove={freeSlots.length > 2 ? () => removeFreeSlot(i) : undefined}
              />
            ))}
          </div>
          {/* ＋ ポケモンを追加ボタン（最大未満のときだけ表示） */}
          {freeSlots.length < MAX_FREE_SLOTS && (
            <button
              onClick={addFreeSlot}
              style={{
                width: '100%', padding: '10px 0', borderRadius: 14,
                background: t.glassChip, boxShadow: `inset 0 0 0 0.5px ${t.rim}`,
                color: t.textMuted, fontSize: 13, fontWeight: 700,
                border: 'none', cursor: 'pointer', marginBottom: 12,
              }}
            >
              ＋ ポケモンを追加
            </button>
          )}
          {/* 素早さランキング表（有効スロット2件以上のとき表示） */}
          {(() => {
            // 素早さ確定済みスロットだけ抽出して降順ソート
            const ranked = freeSlots
              .map((slot, i) => ({ i, slot, final: slotFinalSpeed(data, slot) }))
              .filter((x): x is { i: number; slot: FreeSlot; final: number } => x.final !== null)
              .sort((a, b) => b.final - a.final);
            if (ranked.length < 2) return null;
            const refFinal = slotFinalSpeed(data, freeSlots[refIdx]);
            return (
              <Glass tint={t.glassTint} radius={16} padding={14} style={{ marginBottom: 12 }}>
                {/* 見出し行 */}
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 10 }}>
                  <span style={{ fontSize: 11, fontWeight: 800, color: t.textMuted, letterSpacing: 0.8 }}>素早さ順</span>
                  <span style={{ fontSize: 11, color: t.textMuted }}>基準: {slotLetter(refIdx)}</span>
                </div>
                <div style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
                  {ranked.map(({ i, slot, final }, rank) => {
                    const isRef = i === refIdx;
                    const v = !isRef && refFinal !== null ? compareSpeed(final, refFinal) : null;
                    const re = data.roster.find(r => r.name === slot.rosterName);
                    // 表示名（メガ時はメガフォーム名）
                    const dispName = slot.isMega && slot.megaFormName
                      ? displayPokemonName(slot.megaFormName)
                      : slot.rosterName ? displayPokemonName(slot.rosterName) : '';
                    return (
                      <div
                        key={i}
                        onClick={() => setRefIdx(i)}
                        style={{
                          display: 'flex', alignItems: 'center', gap: 8,
                          padding: '8px', borderRadius: 10, cursor: 'pointer',
                          background: isRef ? t.glassChip2 : 'transparent',
                          border: isRef ? `1px solid ${t.rimAccent}` : `1px solid ${t.rim}`,
                        }}
                      >
                        {/* 順位 */}
                        <span style={{ fontSize: 12, color: t.textMuted, width: 16, textAlign: 'center', flexShrink: 0 }}>{rank + 1}</span>
                        {/* レターバッジ */}
                        <span style={{
                          fontSize: 11, fontWeight: 800,
                          color: isRef ? t.accentAtk : t.textMuted,
                          background: t.glassChip, borderRadius: 6,
                          padding: '1px 5px', flexShrink: 0,
                        }}>{slotLetter(i)}</span>
                        {/* スプライト（26px） */}
                        {re && (
                          <img
                            src={slot.isMega && slot.megaFormName
                              ? getMegaSpriteUrl(re.dexNumber, slot.megaFormName)
                              : getSpriteUrl(slot.isMega && slot.megaFormName ? slot.megaFormName : slot.rosterName)}
                            onError={e => {
                              const img = e.target as HTMLImageElement;
                              if (img.dataset.fellBack) { img.style.opacity = '0'; return; }
                              img.dataset.fellBack = '1';
                              img.src = getFallbackSpriteUrl(re.dexNumber);
                            }}
                            alt=""
                            style={{ width: 26, height: 26, imageRendering: 'pixelated', flexShrink: 0 }}
                          />
                        )}
                        {/* 名前（省略表示） */}
                        <span style={{
                          flex: 1, minWidth: 0, fontSize: 13, fontWeight: 700, color: t.text,
                          overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap',
                        }}>{dispName || '—'}</span>
                        {/* 最終素早さ */}
                        <span style={{ fontSize: 16, fontWeight: 900, color: t.text, flexShrink: 0 }}>{final}</span>
                        {/* 判定チップ */}
                        {isRef ? (
                          <span style={{
                            fontSize: 11, fontWeight: 800, padding: '3px 10px', borderRadius: 999,
                            background: t.glassChip, color: t.textMuted,
                          }}>基準</span>
                        ) : v ? (
                          <span style={{
                            fontSize: 11, fontWeight: 800, padding: '3px 10px', borderRadius: 999,
                            background: verdictBg(v, isDark), color: verdictColor(v, isDark),
                            boxShadow: `inset 0 0 0 0.5px ${verdictRim(v, isDark)}`,
                          }}>
                            {v === 'faster' ? '抜ける' : v === 'tie' ? '同速' : '抜かれる'}
                          </span>
                        ) : null}
                      </div>
                    );
                  })}
                </div>
              </Glass>
            );
          })()}
        </>
      )}

      {/* ── 対戦モード ── */}
      {mode === 'battle' && (<>

      {/* ── 自分側カード ── */}
      <Glass tint={t.glassTint} radius={22} padding={16} style={{ marginBottom: 12 }}>
        <div style={{ fontSize: 10, fontWeight: 800, color: t.accentAtk, letterSpacing: 1.4, marginBottom: 10 }}>MY POKEMON</div>

        {candidates.length === 0 ? (
          <p style={{ fontSize: 13, color: t.textMuted, margin: 0, textAlign: 'center', padding: '12px 0' }}>
            パーティタブでポケモンを登録してください
          </p>
        ) : (
          <>
            {/* 候補チップ（横スクロール） */}
            <div style={{
              display: 'flex', gap: 8, overflowX: 'auto', paddingBottom: 6,
              WebkitOverflowScrolling: 'touch',
            } as React.CSSProperties}>
              {candidates.map((c, i) => {
                const isActive = selectedIdx === i;
                return (
                  <button
                    key={`${c.source}-${c.rosterName}-${i}`}
                    onClick={() => setSelectedIdx(i)}
                    title={c.nickname ? `${c.nickname}（${c.displayName}）` : c.displayName}
                    style={{
                      flexShrink: 0,
                      width: 56, height: 56,
                      borderRadius: 14,
                      background: isActive ? 'rgba(0,220,160,0.22)' : t.glassChip,
                      boxShadow: isActive
                        ? 'inset 0 0 0 1.5px rgba(0,220,160,0.8), 0 0 8px rgba(0,220,160,0.4)'
                        : `inset 0 0 0 0.5px ${t.rim}`,
                      border: 'none', cursor: 'pointer',
                      display: 'flex', alignItems: 'center', justifyContent: 'center',
                      overflow: 'hidden', position: 'relative',
                      transition: 'box-shadow 0.15s',
                    }}
                  >
                    <img
                      src={c.build.isMega && c.build.megaFormName
                        ? getMegaSpriteUrl(c.dexNumber, c.build.megaFormName)
                        : getSpriteUrl(c.spriteName)}
                      onError={e => {
                        // Serebii / Showdown が404の場合、dex番号でフォールバック（無限ループ防止）
                        const img = e.target as HTMLImageElement;
                        if (img.dataset.fellBack) { img.style.opacity = '0'; return; }
                        img.dataset.fellBack = '1';
                        img.src = getFallbackSpriteUrl(c.dexNumber);
                      }}
                      alt={c.displayName}
                      style={{ width: '88%', height: '88%', objectFit: 'contain', imageRendering: 'pixelated' }}
                    />
                    {/* ボックス出身バッジ */}
                    {c.source === 'box' && (
                      <span style={{
                        position: 'absolute', bottom: 2, right: 3,
                        fontSize: 8, fontWeight: 800,
                        color: isDark ? 'rgba(0,220,160,0.9)' : 'rgba(0,140,100,0.9)',
                        lineHeight: 1,
                      }}>BOX</span>
                    )}
                  </button>
                );
              })}
            </div>

            {/* 選択中個体の情報 */}
            {selected && (
              <div style={{ marginTop: 12, display: 'flex', alignItems: 'center', gap: 10 }}>
                <div>
                  <div style={{ fontSize: 15, fontWeight: 800, color: t.text }}>
                    {selected.nickname
                      ? <>{selected.nickname}<span style={{ fontSize: 11, fontWeight: 600, color: t.textMuted, marginLeft: 6 }}>({selected.displayName})</span></>
                      : selected.displayName}
                  </div>
                  <div style={{ fontSize: 12, color: t.textMuted, marginTop: 2 }}>
                    素早さ実数値: <span style={{ fontWeight: 800, color: t.text }}>{myStatSpe ?? '—'}</span>
                  </div>
                </div>
              </div>
            )}

            {/* 補正コントロール */}
            <div style={{ marginTop: 14 }}>
              <CondControls cond={myCond} onChange={setMyCond} />
              {/* 素早さ特性トグル（特性がある場合のみ表示） */}
              {mySpeedAbility && (
                <div style={{ marginTop: 8 }}>
                  <ToggleChip
                    label={`${abilityJaName(mySpeedAbility.en)}（${mySpeedAbility.info.label}）`}
                    active={myAbilityOn}
                    onClick={() => setMyAbilityOn(v => !v)}
                  />
                </div>
              )}
            </div>

            {/* 最終素早さ大表示 */}
            <div style={{
              marginTop: 14, textAlign: 'center',
              padding: '12px 0 6px',
              borderTop: `0.5px solid ${t.track}`,
            }}>
              <div style={{ fontSize: 11, color: t.textMuted, letterSpacing: 0.4, marginBottom: 4 }}>最終素早さ</div>
              <div style={{ fontSize: 42, fontWeight: 900, color: t.accentAtk, lineHeight: 1 }}>
                {myFinalSpeed !== null ? myFinalSpeed : '—'}
              </div>
            </div>
          </>
        )}
      </Glass>

      {/* ── 相手側セクション ── */}
      <Glass tint={t.glassTint} radius={22} padding={16} style={{ marginBottom: 12 }}>
        <div style={{ fontSize: 10, fontWeight: 800, color: t.accentDef, letterSpacing: 1.4, marginBottom: 10 }}>OPPONENT POKEMON</div>

        {/* 場の効果（味方全体で共通） */}
        <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
          <span style={{ fontSize: 12, color: t.textMuted, fontWeight: 600 }}>おいかぜ（味方全体）</span>
          <ToggleChip label="おいかぜ" active={theirTailwind} onClick={() => setTheirTailwind(v => !v)} />
        </div>

        <div style={{ height: 1, background: t.track, margin: '14px 0' }} />

        {opponentMembers.length === 0 ? (
          <p style={{ fontSize: 13, color: t.textMuted, margin: 0, textAlign: 'center', padding: '12px 0' }}>
            ダメ計タブで相手ポケモンを登録してください
          </p>
        ) : (
          <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
            {opponentMembers.map((opp, idx) => {
              if (!opp.rosterName) return null;

              // 相手のベースステータスを取得（メガ対応）
              const bs = findBaseStats(data.baseStats, opp.rosterName, opp.isMega, opp.megaFormName);
              if (!bs) return null;

              // 種族値 S から4ラインを生成
              const presets = speedPresets(bs.spe);

              // スプライト名（メガ考慮）
              const spriteName = opp.isMega && opp.megaFormName ? opp.megaFormName : opp.rosterName;
              const dispName = opp.isMega && opp.megaFormName
                ? displayPokemonName(opp.megaFormName)
                : displayPokemonName(opp.rosterName);
              const rosterEntry = data.roster.find(r => r.name === opp.rosterName);

              // 特性検出用エントリ（メガ時はメガフォームのエントリを使う）
              const abilEntry = opp.isMega && opp.megaFormName
                ? data.roster.find(r => r.name === opp.megaFormName) ?? rosterEntry
                : rosterEntry;
              const oppSpeedAbility = detectSpeedAbility(abilEntry?.abilities ?? {});

              // 個体ごとの補正（未設定はデフォルト）
              const rowCond = oppConds[idx] ?? { rank: 0, scarf: false, paralyzed: false };
              const setRow = (patch: Partial<typeof rowCond>) =>
                setOppConds(prev => ({ ...prev, [idx]: { ...rowCond, ...patch } }));

              // 個体補正＋共通おいかぜで theirCondEff を組み立て
              const theirCondEff: SpeedConditions = {
                rank: rowCond.rank,
                scarf: rowCond.scarf,
                tailwind: theirTailwind,
                paralyzed: rowCond.paralyzed,
                ...(oppSpeedAbility && oppAbilityOn[idx]
                  ? { abilityMod: oppSpeedAbility.info.mod, ignoreParaSpeed: oppSpeedAbility.info.ignorePara }
                  : {}),
              };

              return (
                <div key={idx} style={{
                  padding: 12, borderRadius: 16,
                  background: isDark ? 'rgba(255,255,255,0.04)' : 'rgba(0,0,0,0.03)',
                  boxShadow: `inset 0 0 0 0.5px ${t.track}`,
                }}>
                  {/* 相手個体ヘッダー */}
                  <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 8 }}>
                    <img
                      src={opp.isMega && opp.megaFormName && rosterEntry
                        ? getMegaSpriteUrl(rosterEntry.dexNumber, opp.megaFormName)
                        : getSpriteUrl(spriteName)}
                      onError={e => {
                        // Serebii / Showdown が404の場合、dex番号でフォールバック（無限ループ防止）
                        const img = e.target as HTMLImageElement;
                        if (img.dataset.fellBack) { img.style.opacity = '0'; return; }
                        img.dataset.fellBack = '1';
                        if (rosterEntry) img.src = getFallbackSpriteUrl(rosterEntry.dexNumber);
                      }}
                      alt={dispName}
                      style={{ width: 40, height: 40, imageRendering: 'pixelated', flexShrink: 0 }}
                    />
                    <div style={{ flex: 1 }}>
                      <div style={{ fontSize: 14, fontWeight: 800, color: t.text }}>{dispName}</div>
                      <div style={{ fontSize: 11, color: t.textMuted }}>種族値S: {bs.spe}</div>
                    </div>
                    {/* 素早さ特性トグル（特性がある場合のみ表示） */}
                    {oppSpeedAbility && (
                      <ToggleChip
                        label={`${abilityJaName(oppSpeedAbility.en)}（${oppSpeedAbility.info.label}）`}
                        active={!!oppAbilityOn[idx]}
                        onClick={() => setOppAbilityOn(prev => ({ ...prev, [idx]: !prev[idx] }))}
                      />
                    )}
                  </div>

                  {/* 個体ごとの補正 */}
                  <div style={{ display: 'flex', alignItems: 'center', gap: 8, flexWrap: 'wrap', marginBottom: 8 }}>
                    <RankStepper value={rowCond.rank} onChange={v => setRow({ rank: v })} />
                    <ToggleChip label="スカーフ" active={rowCond.scarf} onClick={() => setRow({ scarf: !rowCond.scarf })} />
                    <ToggleChip label="まひ" active={rowCond.paralyzed} onClick={() => setRow({ paralyzed: !rowCond.paralyzed })} />
                  </div>

                  {/* 速度プリセットチップ */}
                  <div style={{ display: 'flex', gap: 6, flexWrap: 'wrap' }}>
                    {presets.map(preset => {
                      const theirFinal = finalSpeed(preset.stat, theirCondEff);
                      // 自分の最終素早さが確定している場合のみ色分け
                      const verdict = myFinalSpeed !== null
                        ? compareSpeed(myFinalSpeed, theirFinal)
                        : null;

                      return (
                        <div
                          key={preset.key}
                          style={{
                            padding: '5px 10px', borderRadius: 12,
                            background: verdict ? verdictBg(verdict, isDark) : (isDark ? 'rgba(255,255,255,0.07)' : 'rgba(0,0,0,0.05)'),
                            boxShadow: verdict
                              ? `inset 0 0 0 1px ${verdictRim(verdict, isDark)}`
                              : `inset 0 0 0 0.5px ${t.track}`,
                            display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 1,
                            minWidth: 52,
                          }}
                        >
                          <span style={{ fontSize: 10, fontWeight: 700, color: t.textMuted }}>{preset.label}</span>
                          <span style={{
                            fontSize: 15, fontWeight: 900,
                            color: verdict ? verdictColor(verdict, isDark) : t.text,
                          }}>
                            {theirFinal}
                          </span>
                        </div>
                      );
                    })}
                  </div>
                </div>
              );
            })}
          </div>
        )}
      </Glass>

      {/* 凡例 */}
      {myFinalSpeed !== null && opponentMembers.length > 0 && (
        <div style={{
          display: 'flex', gap: 12, flexWrap: 'wrap', justifyContent: 'center',
          padding: '8px 0',
        }}>
          {(['faster', 'tie', 'slower'] as const).map(v => (
            <div key={v} style={{ display: 'flex', alignItems: 'center', gap: 5 }}>
              <div style={{ width: 10, height: 10, borderRadius: 3, background: verdictBg(v, isDark), boxShadow: `inset 0 0 0 1px ${verdictRim(v, isDark)}` }} />
              <span style={{ fontSize: 11, color: t.textMuted, fontWeight: 600 }}>
                {v === 'faster' ? '抜ける' : v === 'tie' ? '同速' : '抜かれる'}
              </span>
            </div>
          ))}
        </div>
      )}

      </>)}
    </div>
  );
}
