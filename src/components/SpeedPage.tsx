import { useState, useMemo } from 'react';
import { Glass } from './Glass';
import { useTheme, useThemeName } from '../theme';
import type { ChampionsData, PokemonBuild } from '../types';
import type { BoxPokemon } from '../store';
import { findBaseStats } from '../data';
import { computeStats } from '../engine/stats';
import {
  finalSpeed, speedPresets, compareSpeed,
  DEFAULT_SPEED_CONDITIONS,
  type SpeedConditions,
} from '../engine/speed';
import { displayPokemonName } from '../i18n';
import { getSpriteUrl, getFallbackSpriteUrl } from '../sprites';

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

// ─── SpeedPage 本体 ───
export function SpeedPage({ data, myPartyMembers, box, opponentMembers }: Props) {
  const t = useTheme();
  const isDark = useThemeName() === 'dark';

  // 自分側の補正
  const [myCond, setMyCond] = useState<SpeedConditions>(DEFAULT_SPEED_CONDITIONS);
  // 相手側の一括補正
  const [theirCond, setTheirCond] = useState<SpeedConditions>(DEFAULT_SPEED_CONDITIONS);
  // 自分側選択中インデックス（candidates 配列のインデックス）
  const [selectedIdx, setSelectedIdx] = useState<number | null>(null);

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

  // 自分の最終素早さ
  const myFinalSpeed: number | null = myStatSpe !== null ? finalSpeed(myStatSpe, myCond) : null;

  return (
    <div style={{ padding: '70px 16px 130px', maxWidth: 500, margin: '0 auto' }}>

      {/* ── ヘッダー ── */}
      <div style={{ marginBottom: 18 }}>
        <div style={{ fontSize: 13, fontWeight: 600, color: t.textMuted, letterSpacing: 0.4, marginBottom: 2 }}>SPEED CHECK</div>
        <div style={{ fontSize: 30, fontWeight: 800, color: t.text, letterSpacing: 0.2, lineHeight: 1.1 }}>素早さ比較</div>
      </div>

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
                      src={getSpriteUrl(c.spriteName)}
                      onError={e => { (e.target as HTMLImageElement).src = getFallbackSpriteUrl(c.dexNumber); }}
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

        {/* 相手側一括補正 */}
        <CondControls cond={theirCond} onChange={setTheirCond} />

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

              return (
                <div key={idx} style={{
                  padding: 12, borderRadius: 16,
                  background: isDark ? 'rgba(255,255,255,0.04)' : 'rgba(0,0,0,0.03)',
                  boxShadow: `inset 0 0 0 0.5px ${t.track}`,
                }}>
                  {/* 相手個体ヘッダー */}
                  <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 8 }}>
                    <img
                      src={getSpriteUrl(spriteName)}
                      onError={e => {
                        if (rosterEntry) (e.target as HTMLImageElement).src = getFallbackSpriteUrl(rosterEntry.dexNumber);
                      }}
                      alt={dispName}
                      style={{ width: 40, height: 40, imageRendering: 'pixelated', flexShrink: 0 }}
                    />
                    <div>
                      <div style={{ fontSize: 14, fontWeight: 800, color: t.text }}>{dispName}</div>
                      <div style={{ fontSize: 11, color: t.textMuted }}>種族値S: {bs.spe}</div>
                    </div>
                  </div>

                  {/* 速度プリセットチップ */}
                  <div style={{ display: 'flex', gap: 6, flexWrap: 'wrap' }}>
                    {presets.map(preset => {
                      const theirFinal = finalSpeed(preset.stat, theirCond);
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
    </div>
  );
}
