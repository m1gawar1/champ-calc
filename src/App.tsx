import { useEffect, useState } from 'react';
import type { ChampionsData, PokemonBuild, BattleConditions } from './types';
import type { AppStore, CalcHistoryEntry } from './store';
import { loadData } from './data';
import { loadStore, saveStore, addPokemonToHistory, addCalcHistory } from './store';
import { ThemeCtx, resolveTheme, loadCustomTheme, type ThemeName, type ThemeOverrides } from './theme';
import { useTheme } from './theme';
import { Backdrop, type TabKey } from './components/Backdrop';
import { Calculator } from './components/Calculator';
import { PartyPage } from './components/PartyPage';
import { HistoryPage } from './components/HistoryPage';
import { SettingsPage } from './components/SettingsPage';
import { SpeedPage } from './components/SpeedPage';

// ─── フローティングタブバー ───
function TabBar({ active, onChange, store }: {
  active: TabKey;
  onChange: (t: TabKey) => void;
  store: AppStore;
}) {
  const t = useTheme();
  const tabs: { key: TabKey; label: string; icon: (c: string) => JSX.Element }[] = [
    {
      key: 'calc', label: 'ダメ計',
      icon: (c) => (
        <svg width="22" height="22" viewBox="0 0 22 22" fill="none">
          <rect x="3" y="2.5" width="16" height="17" rx="3.4" stroke={c} strokeWidth="1.6"/>
          <rect x="6" y="5.5" width="10" height="3.4" rx="1.2" fill={c} opacity="0.45"/>
          <circle cx="7.2" cy="12.2" r="1.1" fill={c}/><circle cx="11" cy="12.2" r="1.1" fill={c}/>
          <circle cx="14.8" cy="12.2" r="1.1" fill={c}/><circle cx="7.2" cy="15.8" r="1.1" fill={c}/>
          <circle cx="11" cy="15.8" r="1.1" fill={c}/>
          <rect x="13.7" y="14.7" width="2.2" height="2.2" rx="0.6" fill={c}/>
        </svg>
      ),
    },
    {
      key: 'party', label: 'パーティ',
      icon: (c) => (
        <svg width="22" height="22" viewBox="0 0 22 22" fill="none">
          <circle cx="7.5" cy="8" r="3.2" stroke={c} strokeWidth="1.6"/>
          <circle cx="14.5" cy="8" r="3.2" stroke={c} strokeWidth="1.6"/>
          <path d="M2 18.5c0-2.6 2.5-4.4 5.5-4.4s5.5 1.8 5.5 4.4" stroke={c} strokeWidth="1.6" strokeLinecap="round"/>
          <path d="M11.2 14.4c.95-.2 2.05-.3 3.3-.3 3 0 5.5 1.8 5.5 4.4" stroke={c} strokeWidth="1.6" strokeLinecap="round"/>
        </svg>
      ),
    },
    {
      key: 'speed', label: '素早さ',
      icon: (c) => (
        // 稲妻アイコン（素早さタブ用）
        <svg width="22" height="22" viewBox="0 0 22 22" fill="none">
          <path d="M13 2.5L5.5 12.5h5.5L8.5 19.5l9-10h-5.5L13 2.5z" stroke={c} strokeWidth="1.6" strokeLinecap="round" strokeLinejoin="round"/>
        </svg>
      ),
    },
    {
      key: 'history', label: '履歴',
      icon: (c) => (
        <svg width="22" height="22" viewBox="0 0 22 22" fill="none">
          <path d="M11 3.5a7.5 7.5 0 1 1-7.4 8.6" stroke={c} strokeWidth="1.6" strokeLinecap="round"/>
          <path d="M3.5 4.2v3.6h3.6" stroke={c} strokeWidth="1.6" strokeLinecap="round" strokeLinejoin="round"/>
          <path d="M11 7v4.2l2.8 1.7" stroke={c} strokeWidth="1.6" strokeLinecap="round"/>
        </svg>
      ),
    },
    {
      key: 'settings', label: '設定',
      icon: (c) => (
        <svg width="22" height="22" viewBox="0 0 22 22" fill="none">
          <circle cx="11" cy="11" r="2.8" stroke={c} strokeWidth="1.6"/>
          <path d="M11 2.5v2M11 17.5v2M2.5 11h2M17.5 11h2M4.7 4.7l1.4 1.4M15.9 15.9l1.4 1.4M4.7 17.3l1.4-1.4M15.9 6.1l1.4-1.4" stroke={c} strokeWidth="1.6" strokeLinecap="round"/>
        </svg>
      ),
    },
  ];

  return (
    // 分析ツール調: フラットな固定フッター（上罫線・単色背景・浮遊なし）
    <div style={{
      position: 'absolute', left: 0, right: 0, bottom: 0, zIndex: 80,
      background: t.tabTint, borderTop: `1px solid ${t.tabRim}`,
      paddingBottom: 'env(safe-area-inset-bottom, 0px)',
    }}>
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', padding: '10px 24px 14px' }}>
        {tabs.map(tb => {
          const isActive = active === tb.key;
          const iconColor = isActive ? t.accentAtk : t.tabIconInactive;
          return (
            <button
              key={tb.key}
              onClick={() => onChange(tb.key)}
              style={{
                position: 'relative',
                background: 'transparent', border: 0, cursor: 'pointer',
                display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center',
                gap: 4, color: isActive ? t.accentAtk : t.tabInactive,
                fontFamily: '"Hanken Grotesk", -apple-system, "Noto Sans JP", system-ui, sans-serif',
                fontSize: 9, fontWeight: 800, letterSpacing: 0.2,
                minWidth: 44, minHeight: 44, padding: '2px 4px',
                transition: 'color 0.2s',
              }}
            >
              {tb.icon(iconColor)}
              {isActive && <span style={{ whiteSpace: 'nowrap' }}>{tb.label}</span>}
              {/* 履歴件数インジケーター（非アクティブ時） */}
              {tb.key === 'history' && (store.calcHistory.length + store.battleHistory.length) > 0 && !isActive && (
                <span style={{
                  position: 'absolute', top: 2, right: 6,
                  width: 6, height: 6, borderRadius: 99,
                  background: t.accentAtk,
                }} />
              )}
            </button>
          );
        })}
      </div>
    </div>
  );
}

// ─── メインアプリ ───
// デザインエディタからプレビュー表示する際は props で色・テーマを上書きする。
export interface AppProps {
  themeOverride?: ThemeOverrides; // プレビュー用の編集中カスタム色
  forcedTheme?: ThemeName;        // プレビュー用に dark/light を固定
}

export default function App({ themeOverride, forcedTheme }: AppProps = {}) {
  const [data, setData] = useState<ChampionsData | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [tab, setTab] = useState<TabKey>('calc');
  const [store, setStore] = useState<AppStore>(() => loadStore());
  const [reloadEntry, setReloadEntry] = useState<CalcHistoryEntry | null>(null);

  // テーマ名（localStorageで永続化）。プレビュー時は forcedTheme を優先。
  const [themeState, setTheme] = useState<ThemeName>(() =>
    localStorage.getItem('champ_theme') === 'dark' ? 'dark' : 'light'
  );
  const theme = forcedTheme ?? themeState;

  // カスタム色の上書き。プレビュー時は props を優先、通常時は localStorage から。
  const overrides = themeOverride ?? loadCustomTheme();
  const resolvedTheme = resolveTheme(theme, overrides);

  function changeTheme(t: ThemeName) {
    setTheme(t);
    localStorage.setItem('champ_theme', t);
  }

  useEffect(() => {
    loadData().then(setData).catch((e: unknown) => setError(String(e)));
  }, []);

  function updateStore(partial: Partial<AppStore>) {
    // 1イベント内で複数回呼ばれても上書きで消えないよう関数型更新で合成する
    setStore(prev => {
      const next = { ...prev, ...partial };
      saveStore(next);
      return next;
    });
  }

  function handleHistoryAdd(name: string) {
    // 最新 state を基に更新し、battleHistory 等の他フィールドを巻き戻さない
    setStore(prev => {
      const next = addPokemonToHistory(prev, name);
      saveStore(next);
      return next;
    });
  }

  function handleCalcHistory(entry: Omit<CalcHistoryEntry, 'id' | 'timestamp'>) {
    // 最新 state を基に更新し、battleHistory 等の他フィールドを巻き戻さない
    setStore(prev => {
      const next = addCalcHistory(prev, entry);
      saveStore(next);
      return next;
    });
  }

  function handleReload(entry: CalcHistoryEntry) {
    setReloadEntry(entry);
    setTab('calc');
  }

  const activeParty = store.myParties.find(p => p.id === store.activePartyId) ?? null;

  if (error) {
    return (
      <ThemeCtx.Provider value={{ name: theme, theme: resolvedTheme }}>
        <div style={{ position: 'fixed', inset: 0, display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
          <Backdrop tab="calc" theme={theme} />
          <div style={{ position: 'relative', zIndex: 1, color: 'rgba(255,100,100,0.9)', fontSize: 14, padding: 24, textAlign: 'center' }}>
            データ読み込みエラー: {error}
          </div>
        </div>
      </ThemeCtx.Provider>
    );
  }

  if (!data) {
    return (
      <ThemeCtx.Provider value={{ name: theme, theme: resolvedTheme }}>
        <div style={{ position: 'fixed', inset: 0, display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
          <Backdrop tab="calc" theme={theme} />
          <div style={{ position: 'relative', zIndex: 1, color: 'rgba(255,255,255,0.5)', fontSize: 14 }}>
            データ読み込み中...
          </div>
        </div>
      </ThemeCtx.Provider>
    );
  }

  return (
    <ThemeCtx.Provider value={{ name: theme, theme: resolvedTheme }}>
      <div style={{ position: 'fixed', inset: 0 }}>
        {/* 背景アート（Liquid Glass の透過感の土台） */}
        <Backdrop tab={tab} theme={theme} />

        {/* スクロール可能なコンテンツ領域 */}
        <div style={{ position: 'absolute', inset: 0, overflowY: 'auto', WebkitOverflowScrolling: 'touch' } as React.CSSProperties}>
          {/* ダメ計は常にマウントしたまま表示/非表示を切替（タブ移動で入力を保持） */}
          <div style={{ display: tab === 'calc' ? 'block' : 'none' }}>
            <Calculator
              data={data}
              myPartyMembers={activeParty?.members ?? []}
              opponentMembers={store.opponentParty}
              pokemonHistory={store.pokemonHistory}
              onHistoryAdd={handleHistoryAdd}
              onCalcHistory={handleCalcHistory}
              reloadEntry={reloadEntry}
              onReloadConsumed={() => setReloadEntry(null)}
              onOpponentChange={(members) => updateStore({ opponentParty: members })}
            />
          </div>
          {tab === 'party' && (
            <PartyPage data={data} store={store} onUpdate={updateStore} />
          )}
          {tab === 'speed' && (
            <SpeedPage
              data={data}
              myPartyMembers={activeParty?.members ?? []}
              box={store.box}
              opponentMembers={store.opponentParty}
            />
          )}
          {tab === 'history' && (
            <HistoryPage
              history={store.calcHistory}
              battleHistory={store.battleHistory}
              onReload={handleReload}
              onClear={() => updateStore({ calcHistory: [] })}
              onClearBattles={() => updateStore({ battleHistory: [] })}
              onDeleteBattle={(id) => updateStore({ battleHistory: store.battleHistory.filter(b => b.id !== id) })}
            />
          )}
          {tab === 'settings' && (
            <SettingsPage theme={theme} onThemeChange={changeTheme} />
          )}
        </div>

        {/* フローティングタブバー */}
        <TabBar active={tab} onChange={setTab} store={store} />
      </div>
    </ThemeCtx.Provider>
  );
}
