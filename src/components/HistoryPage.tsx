import { useState, useMemo } from 'react';
import type { CalcHistoryEntry, BattleHistoryEntry } from '../store';
import type { PokemonBuild } from '../types';
import { displayPokemonName, moveJa } from '../i18n';
import { getSpriteUrl } from '../sprites';
import { Glass } from './Glass';
import { useTheme, useThemeName } from '../theme';

interface Props {
  history: CalcHistoryEntry[];
  battleHistory: BattleHistoryEntry[];
  onReload: (entry: CalcHistoryEntry) => void;
  onClear: () => void;
  onClearBattles: () => void;
  onDeleteBattle: (id: string) => void;
}

function timeAgo(ts: number): string {
  const diff = Math.floor((Date.now() - ts) / 1000);
  if (diff < 60) return 'たった今';
  if (diff < 3600) return `${Math.floor(diff / 60)}分前`;
  if (diff < 86400) return `${Math.floor(diff / 3600)}時間前`;
  return `${Math.floor(diff / 86400)}日前`;
}

function getKoColor(ko1Chance: number, guaranteed2HKO: boolean, isDark: boolean, textColor: string, textMuted: string): string {
  if (ko1Chance >= 16) return '#FF3B30';
  if (ko1Chance >= 8) return isDark ? '#FF6E6E' : '#c92a2a';
  if (ko1Chance > 0) return isDark ? '#FF9F40' : '#c95a00';
  if (guaranteed2HKO) return isDark ? '#FFD460' : '#c97a00';
  return textColor;
  return textMuted;
}

function koLabel(r: CalcHistoryEntry['results'][number], isDark: boolean, textColor: string, textMuted: string): { text: string; color: string } {
  const pct = Math.round(r.ko1Chance / 16 * 100);
  if (r.ko1Chance >= 16) return { text: '確定1発', color: '#FF3B30' };
  if (r.ko1Chance >= 8)  return { text: `乱数1発 ${pct}%`, color: isDark ? '#FF6E6E' : '#c92a2a' };
  if (r.ko1Chance > 0)   return { text: `乱数1発 ${pct}%`, color: isDark ? '#FF9F40' : '#c95a00' };
  if (r.guaranteed2HKO)  return { text: '確定2発', color: isDark ? '#FFD460' : '#c97a00' };
  return { text: '確定3発以上', color: textColor };
}

function HistoryCard({ entry, onReload }: { entry: CalcHistoryEntry; onReload: () => void }) {
  const t = useTheme();
  const isDark = useThemeName() === 'dark';

  const atkName = entry.attacker.isMega && entry.attacker.megaFormName
    ? displayPokemonName(entry.attacker.megaFormName)
    : displayPokemonName(entry.attacker.rosterName);
  const defName = entry.defender.isMega && entry.defender.megaFormName
    ? displayPokemonName(entry.defender.megaFormName)
    : displayPokemonName(entry.defender.rosterName);

  return (
    <Glass tint={t.glassTint} radius={22} padding={14}>
      {/* 攻 → 防 + 再ロード */}
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 10 }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 8, flex: 1, minWidth: 0 }}>
          <span style={{ fontSize: 14, fontWeight: 800, color: t.accentAtk, whiteSpace: 'nowrap' }}>{atkName}</span>
          <svg width="16" height="10" viewBox="0 0 16 10" fill="none">
            <path d="M1 5h13m0 0L10 1m4 4l-4 4" stroke={t.textWeak} strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round"/>
          </svg>
          <span style={{ fontSize: 14, fontWeight: 800, color: t.accentDef, whiteSpace: 'nowrap' }}>{defName}</span>
        </div>
        <button
          onClick={onReload}
          style={{
            background: t.tabActiveBg, boxShadow: t.tabActiveShadow,
            border: 'none', borderRadius: 99, padding: '5px 10px',
            color: t.text, fontSize: 10, fontWeight: 700, letterSpacing: 0.3,
            cursor: 'pointer', whiteSpace: 'nowrap', marginLeft: 8,
          }}
        >再ロード</button>
      </div>

      {/* 技結果 */}
      <div style={{ display: 'flex', flexDirection: 'column', gap: 5, marginBottom: 8 }}>
        {entry.results.map((r, i) => {
          const { text, color } = koLabel(r, isDark, t.text, t.textMuted);
          return (
            <div key={i} style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
              <span style={{ fontSize: 12, color: t.text, flex: 1, fontWeight: 600 }}>{moveJa(r.moveName)}</span>
              <span style={{ fontFamily: '"SF Mono", monospace', fontSize: 11, color: t.textMuted, whiteSpace: 'nowrap' }}>
                {r.minPercent.toFixed(1)}〜{r.maxPercent.toFixed(1)}%
              </span>
              <span style={{ fontSize: 10, fontWeight: 800, color, minWidth: 80, textAlign: 'right', letterSpacing: 0.2 }}>{text}</span>
            </div>
          );
        })}
      </div>

      <div style={{ fontSize: 10, color: t.textWeak }}>{timeAgo(entry.timestamp)}</div>
    </Glass>
  );
}

// 選出スプライト行（フォールバックは onError で透過）
function SpriteRow({ members, cols }: { members: PokemonBuild[]; cols: number }) {
  const t = useTheme();
  const filled = members.filter(m => m.rosterName);
  if (filled.length === 0) return <span style={{ fontSize: 11, color: t.textWeak }}>—</span>;
  return (
    <div style={{ display: 'grid', gridTemplateColumns: `repeat(${cols}, 1fr)`, gap: 4 }}>
      {filled.map((m, i) => {
        const name = m.isMega && m.megaFormName ? m.megaFormName : m.rosterName;
        return (
          <div key={i} title={displayPokemonName(name)} style={{
            width: '100%', aspectRatio: '1', borderRadius: 10, background: t.glassChip,
            boxShadow: `inset 0 0 0 0.5px ${t.btnSoftRim}`,
            display: 'flex', alignItems: 'center', justifyContent: 'center', overflow: 'hidden',
          }}>
            <img src={getSpriteUrl(name)} onError={e => { (e.target as HTMLImageElement).style.opacity = '0'; }}
              alt="" style={{ width: '85%', height: '85%', objectFit: 'contain', imageRendering: 'pixelated' }} />
          </div>
        );
      })}
    </div>
  );
}

// パーティ6体グリッド：選出されたポケモンを枠線で囲み、選出順の番号バッジを表示
function PartyGrid({ members, selectionOrder, accent }: {
  members: PokemonBuild[]; selectionOrder?: number[]; accent: string;
}) {
  const t = useTheme();
  const filled = members.filter(m => m.rosterName);
  if (filled.length === 0) return <span style={{ fontSize: 11, color: t.textWeak }}>—</span>;
  // フィルタ後インデックス → 選出順（0始まり）
  const orderMap = new Map<number, number>();
  (selectionOrder ?? []).forEach((idx, k) => orderMap.set(idx, k));
  return (
    <div style={{ display: 'grid', gridTemplateColumns: 'repeat(6, 1fr)', gap: 4 }}>
      {filled.map((m, i) => {
        const name = m.isMega && m.megaFormName ? m.megaFormName : m.rosterName;
        const order = orderMap.get(i);
        const selected = order !== undefined;
        return (
          <div key={i} title={displayPokemonName(name)} style={{
            position: 'relative', width: '100%', aspectRatio: '1', borderRadius: 10, background: t.glassChip,
            boxShadow: selected
              ? `inset 0 0 0 1.5px ${accent}, 0 0 8px ${accent}`
              : `inset 0 0 0 0.5px ${t.btnSoftRim}`,
            display: 'flex', alignItems: 'center', justifyContent: 'center', overflow: 'hidden',
            opacity: selected ? 1 : 0.45,
          }}>
            <img src={getSpriteUrl(name)} onError={e => { (e.target as HTMLImageElement).style.opacity = '0'; }}
              alt="" style={{ width: '85%', height: '85%', objectFit: 'contain', imageRendering: 'pixelated' }} />
            {selected && (
              <span style={{
                position: 'absolute', top: 2, left: 2, width: 14, height: 14, borderRadius: 99,
                background: accent, color: '#fff', fontSize: 9, fontWeight: 800,
                display: 'flex', alignItems: 'center', justifyContent: 'center',
              }}>{order + 1}</span>
            )}
          </div>
        );
      })}
    </div>
  );
}

function BattleHistoryCard({ entry, onDelete }: { entry: BattleHistoryEntry; onDelete: () => void }) {
  const t = useTheme();
  const resultBadge = entry.result === 'win'
    ? { text: '勝ち', bg: 'rgba(90,200,250,0.3)', ring: 'rgba(90,200,250,0.8)' }
    : entry.result === 'lose'
      ? { text: '負け', bg: 'rgba(255,110,110,0.3)', ring: 'rgba(255,110,110,0.8)' }
      : null;

  return (
    <Glass tint={t.glassTint} radius={22} padding={14}>
      {/* ヘッダー: 勝敗 + 日時 + 削除 */}
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 12 }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
          {resultBadge && (
            <span style={{
              fontSize: 11, fontWeight: 800, padding: '3px 10px', borderRadius: 99,
              background: resultBadge.bg, boxShadow: `inset 0 0 0 1px ${resultBadge.ring}`,
              color: t.text, letterSpacing: 0.4,
            }}>{resultBadge.text}</span>
          )}
          <span style={{ fontSize: 11, color: t.textWeak }}>{timeAgo(entry.timestamp)}</span>
        </div>
        <button onClick={onDelete} style={{ fontSize: 12, color: t.textWeak, background: 'none', border: 'none', cursor: 'pointer', padding: '4px 8px' }}>削除</button>
      </div>

      {/* 新データ：両パーティを並べ、選出を枠線＋番号でハイライト */}
      {entry.myParty ? (
        <div style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
          <div>
            <div style={{ fontSize: 10, fontWeight: 700, color: t.accentAtk, marginBottom: 6, letterSpacing: 0.4 }}>
              自分のパーティ{entry.myPartyName ? `（${entry.myPartyName}）` : ''}
            </div>
            <PartyGrid members={entry.myParty} selectionOrder={entry.mySelectionOrder} accent={t.accentAtk} />
          </div>
          <div>
            <div style={{ fontSize: 10, fontWeight: 700, color: t.accentDef, marginBottom: 6, letterSpacing: 0.4 }}>相手パーティ</div>
            <PartyGrid members={entry.opponentParty} selectionOrder={entry.opponentSelectionOrder} accent={t.accentDef} />
          </div>
          <div style={{ fontSize: 9, color: t.textWeak, letterSpacing: 0.3 }}>枠で囲まれたポケモンが選出（番号は選出順）</div>
        </div>
      ) : (
        /* 旧データ：従来表示にフォールバック */
        <>
          <div style={{ fontSize: 10, fontWeight: 700, color: t.textMuted, marginBottom: 6, letterSpacing: 0.4 }}>相手パーティ</div>
          <SpriteRow members={entry.opponentParty} cols={6} />
          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 10, marginTop: 12 }}>
            <div>
              <div style={{ fontSize: 10, fontWeight: 700, color: t.accentAtk, marginBottom: 6 }}>自分の選出</div>
              <SpriteRow members={entry.mySelection} cols={3} />
            </div>
            <div>
              <div style={{ fontSize: 10, fontWeight: 700, color: t.accentDef, marginBottom: 6 }}>相手の選出</div>
              <SpriteRow members={entry.opponentSelection} cols={3} />
            </div>
          </div>
        </>
      )}
    </Glass>
  );
}

export function HistoryPage({ history, battleHistory, onReload, onClear, onClearBattles, onDeleteBattle }: Props) {
  const t = useTheme();
  const [seg, setSeg] = useState<'calc' | 'battle'>('calc');
  const [search, setSearch] = useState('');

  const filtered = useMemo(() => {
    if (!search) return history;
    const q = search.toLowerCase();
    return history.filter(e =>
      displayPokemonName(e.attacker.rosterName).includes(search) ||
      displayPokemonName(e.defender.rosterName).includes(search) ||
      e.attacker.rosterName.toLowerCase().includes(q) ||
      e.defender.rosterName.toLowerCase().includes(q) ||
      e.results.some(r => moveJa(r.moveName).includes(search) || r.moveName.toLowerCase().includes(q)),
    );
  }, [history, search]);

  return (
    <div style={{ padding: '70px 16px 130px', maxWidth: 500, margin: '0 auto' }}>
      {/* ヘッダー */}
      <div style={{ display: 'flex', alignItems: 'flex-end', justifyContent: 'space-between', marginBottom: 18 }}>
        <div>
          <div style={{ fontSize: 13, fontWeight: 600, color: t.textMuted, letterSpacing: 0.4, marginBottom: 2 }}>
            {seg === 'calc' ? 'RECENT CALCULATIONS' : 'BATTLE LOG'}
          </div>
          <div style={{ fontSize: 30, fontWeight: 800, color: t.text, letterSpacing: 0.2, lineHeight: 1.1 }}>
            {seg === 'calc' ? '計算履歴' : '対戦履歴'}
          </div>
        </div>
        {seg === 'calc' && history.length > 0 && (
          <button
            onClick={onClear}
            style={{
              padding: '6px 12px', borderRadius: 99,
              background: t.btnSoft, boxShadow: `inset 0 0 0 0.5px ${t.btnSoftRim}`,
              color: t.textMuted, fontSize: 11, fontWeight: 600,
              border: 'none', cursor: 'pointer',
            }}
          >すべて削除</button>
        )}
        {seg === 'battle' && battleHistory.length > 0 && (
          <button
            onClick={onClearBattles}
            style={{
              padding: '6px 12px', borderRadius: 99,
              background: t.btnSoft, boxShadow: `inset 0 0 0 0.5px ${t.btnSoftRim}`,
              color: t.textMuted, fontSize: 11, fontWeight: 600,
              border: 'none', cursor: 'pointer',
            }}
          >すべて削除</button>
        )}
      </div>

      {/* セグメント切替（計算 / 対戦） */}
      <Glass tint={t.tabTint} radius={14} padding={4} style={{ marginBottom: 16 }}>
        <div style={{ display: 'flex', gap: 4 }}>
          {(['calc', 'battle'] as const).map(s => (
            <button
              key={s}
              onClick={() => setSeg(s)}
              style={{
                flex: 1, padding: '9px 0', textAlign: 'center', borderRadius: 11,
                background: seg === s ? t.tabActiveBg : 'transparent',
                boxShadow: seg === s ? t.tabActiveShadow : 'none',
                color: seg === s ? t.text : t.tabInactive,
                fontSize: 13, fontWeight: 700, border: 'none', cursor: 'pointer',
                transition: 'all 0.2s',
              }}
            >{s === 'calc' ? '計算' : '対戦'}</button>
          ))}
        </div>
      </Glass>

      {seg === 'calc' && (
        <>
          {/* 検索バー */}
          {history.length > 0 && (
            <Glass tint={t.glassTint2} radius={14} padding={11} style={{ marginBottom: 14 }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: 8, color: t.textMuted }}>
                <svg width="14" height="14" viewBox="0 0 14 14" fill="none">
                  <circle cx="6" cy="6" r="4.5" stroke="currentColor" strokeWidth="1.5"/>
                  <path d="M9.5 9.5L13 13" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round"/>
                </svg>
                <input
                  type="text"
                  value={search}
                  onChange={e => setSearch(e.target.value)}
                  placeholder="ポケモン名・技名で検索"
                  style={{
                    flex: 1, background: 'transparent', border: 'none', outline: 'none',
                    color: t.text, fontSize: 14, fontFamily: 'inherit',
                  }}
                />
              </div>
            </Glass>
          )}

          {history.length === 0 ? (
            <div style={{ textAlign: 'center', padding: '48px 0' }}>
              <p style={{ color: t.textMuted, fontSize: 14, marginBottom: 6 }}>計算履歴はまだありません</p>
              <p style={{ color: t.textWeak, fontSize: 12 }}>ダメ計タブで計算すると自動的に保存されます</p>
            </div>
          ) : filtered.length === 0 ? (
            <div style={{ textAlign: 'center', padding: '32px 0', color: t.textMuted, fontSize: 14 }}>
              「{search}」は見つかりませんでした
            </div>
          ) : (
            <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
              {filtered.map(entry => (
                <HistoryCard key={entry.id} entry={entry} onReload={() => onReload(entry)} />
              ))}
            </div>
          )}
        </>
      )}

      {seg === 'battle' && (
        battleHistory.length === 0 ? (
          <div style={{ textAlign: 'center', padding: '48px 0' }}>
            <p style={{ color: t.textMuted, fontSize: 14, marginBottom: 6 }}>対戦履歴はまだありません</p>
            <p style={{ color: t.textWeak, fontSize: 12 }}>パーティタブの相手パーティから「この対戦を記録」で保存できます</p>
          </div>
        ) : (
          <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
            {battleHistory.map(entry => (
              <BattleHistoryCard key={entry.id} entry={entry} onDelete={() => onDeleteBattle(entry.id)} />
            ))}
          </div>
        )
      )}
    </div>
  );
}
