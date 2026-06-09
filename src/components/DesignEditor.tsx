import { useRef, useState } from 'react';
import App from '../App';
import {
  TH,
  loadCustomTheme,
  saveCustomTheme,
  resolveTheme,
  type ThemeName,
  type ThemeKey,
  type ThemeOverrides,
} from '../theme';

// ─── 色パース用ヘルパー ───
function parseColor(v: string): { hex: string; alpha: number } | null {
  const s = v.trim();
  let m = /^#([0-9a-f]{3}|[0-9a-f]{6})$/i.exec(s);
  if (m) {
    let h = m[1];
    if (h.length === 3) h = h.split('').map(c => c + c).join('');
    return { hex: '#' + h.toLowerCase(), alpha: 1 };
  }
  m = /^rgba?\(\s*([\d.]+)[,\s]+([\d.]+)[,\s]+([\d.]+)\s*(?:[,/]\s*([\d.]+)\s*)?\)$/i.exec(s);
  if (m) {
    const r = +m[1], g = +m[2], b = +m[3];
    const a = m[4] !== undefined ? +m[4] : 1;
    const hex = '#' + [r, g, b].map(n => Math.round(n).toString(16).padStart(2, '0')).join('');
    return { hex, alpha: a };
  }
  return null;
}

function hexToRgb(hex: string): [number, number, number] {
  const h = hex.slice(1);
  return [parseInt(h.slice(0, 2), 16), parseInt(h.slice(2, 4), 16), parseInt(h.slice(4, 6), 16)];
}

function composeColor(hex: string, alpha: number): string {
  if (alpha >= 1) return hex;
  const [r, g, b] = hexToRgb(hex);
  return `rgba(${r},${g},${b},${alpha})`;
}

// 任意の色表現を "r,g,b,a"（a は小数2桁）に正規化。色でなければ null。
function canonical(v: string): string | null {
  const c = parseColor(v);
  if (c) {
    const [r, g, b] = hexToRgb(c.hex);
    return `${r},${g},${b},${c.alpha.toFixed(2)}`;
  }
  // 計算済みスタイル（rgb()/rgba()）
  const m = /^rgba?\(\s*([\d.]+)[,\s]+([\d.]+)[,\s]+([\d.]+)\s*(?:[,/]\s*([\d.]+)\s*)?\)$/i.exec(v.trim());
  if (m) {
    const a = m[4] !== undefined ? +m[4] : 1;
    return `${Math.round(+m[1])},${Math.round(+m[2])},${Math.round(+m[3])},${a.toFixed(2)}`;
  }
  return null;
}

// ─── 日本語ラベル ───
const LABELS: Record<ThemeKey, string> = {
  text: '主要テキスト', textMuted: '補助テキスト', textWeak: '微弱テキスト',
  accentAtk: '攻撃アクセント', accentDef: '防御アクセント', rimAccent: 'アクセント枠線', rimActive: '選択時枠線',
  glassTint: 'ガラス地色', glassTint2: 'ガラス地色2', glassDeep: 'ガラス（濃）', glassNest: '入れ子ガラス',
  glassChip: 'チップ地色', glassChip2: 'チップ地色2',
  rim: '標準枠線', track: 'トラック', track2: 'トラック2', dashedRim: '破線枠', btnSoftRim: 'ソフトボタン枠',
  tabTint: 'タブ地色', tabRim: 'タブ枠線', tabActiveBg: 'タブ選択背景', tabActiveShadow: 'タブ選択影',
  tabInactive: 'タブ非選択文字', tabIconInactive: 'タブ非選択アイコン',
  badgeAtkBg: 'バッジ背景', badgeAtkFg: 'バッジ文字', btnSoft: 'ソフトボタン', inputBg: '入力欄背景',
  sheenTop: '上部光沢', sheenBottom: '下部光沢', topHighlight: '上端ハイライト',
};

// ─── グループ分け ───
const GROUPS: { label: string; keys: ThemeKey[] }[] = [
  { label: 'テキスト', keys: ['text', 'textMuted', 'textWeak'] },
  { label: 'アクセント', keys: ['accentAtk', 'accentDef', 'rimAccent', 'rimActive'] },
  { label: 'ガラス面', keys: ['glassTint', 'glassTint2', 'glassDeep', 'glassNest', 'glassChip', 'glassChip2'] },
  { label: '枠線・トラック', keys: ['rim', 'track', 'track2', 'dashedRim', 'btnSoftRim'] },
  { label: 'タブバー', keys: ['tabTint', 'tabRim', 'tabActiveBg', 'tabActiveShadow', 'tabInactive', 'tabIconInactive'] },
  { label: 'バッジ・ボタン・入力', keys: ['badgeAtkBg', 'badgeAtkFg', 'btnSoft', 'inputBg'] },
  { label: '光沢（数値）', keys: ['sheenTop', 'sheenBottom', 'topHighlight'] },
];

// ─── デバイスプリセット ───
const DEVICES = [
  { label: 'iPhone 15 / 14 Pro (393×852)', w: 393, h: 852 },
  { label: 'iPhone 14 Pro Max (430×932)', w: 430, h: 932 },
  { label: 'iPhone SE (375×667)', w: 375, h: 667 },
  { label: 'Pixel 7 (412×915)', w: 412, h: 915 },
  { label: 'Small (360×640)', w: 360, h: 640 },
];

const inputStyle: React.CSSProperties = {
  background: 'rgba(255,255,255,0.07)', border: '1px solid rgba(255,255,255,0.15)',
  borderRadius: 6, color: '#fff', padding: '4px 6px', fontSize: 11, width: 72, outline: 'none',
};

const btnStyle: React.CSSProperties = {
  background: 'rgba(255,255,255,0.1)', border: '1px solid rgba(255,255,255,0.2)',
  borderRadius: 8, color: '#fff', padding: '7px 12px', fontSize: 12, fontWeight: 600, cursor: 'pointer',
};

// ─── 1項目分の編集行 ───
function FieldRow({
  k, value, base, highlight, onChange,
}: {
  k: ThemeKey;
  value: string | number;
  base: string | number;
  highlight: boolean;
  onChange: (v: string | number) => void;
}) {
  const isNumber = typeof base === 'number';
  const strVal = String(value);
  const color = isNumber ? null : parseColor(strVal);
  const changed = value !== base;

  return (
    <div
      id={`field-${k}`}
      style={{
        display: 'flex', alignItems: 'center', gap: 8, padding: '5px 6px', borderRadius: 6,
        background: highlight ? 'rgba(120,200,255,0.25)' : 'transparent',
        transition: 'background 0.4s',
      }}
    >
      <div style={{ flex: '0 0 116px', fontSize: 11, color: changed ? '#ffd479' : 'rgba(255,255,255,0.7)' }}>
        {LABELS[k]}
      </div>

      {isNumber ? (
        <input type="number" step={0.01} min={0} max={1} value={value as number}
          onChange={(e) => onChange(parseFloat(e.target.value) || 0)} style={inputStyle} />
      ) : (
        <>
          {color ? (
            <input type="color" value={color.hex}
              onChange={(e) => onChange(composeColor(e.target.value, color.alpha))}
              style={{ width: 30, height: 26, border: 0, borderRadius: 6, background: 'transparent', cursor: 'pointer', padding: 0 }}
              title="色を選択" />
          ) : (
            <div style={{ width: 30, height: 26, borderRadius: 6, background: strVal, border: '1px solid rgba(255,255,255,0.2)' }} title="複合値（テキストで編集）" />
          )}
          {color && (
            <input type="range" min={0} max={1} step={0.01} value={color.alpha}
              onChange={(e) => onChange(composeColor(color.hex, parseFloat(e.target.value)))}
              style={{ width: 50 }} title={`不透明度 ${color.alpha}`} />
          )}
          <input type="text" value={strVal} onChange={(e) => onChange(e.target.value)}
            style={{ ...inputStyle, flex: 1, fontFamily: 'monospace', fontSize: 10 }} />
        </>
      )}
    </div>
  );
}

// ─── デザインエディタ本体 ───
export function DesignEditor() {
  const [overrides, setOverrides] = useState<ThemeOverrides>(() => loadCustomTheme());
  const [history, setHistory] = useState<ThemeOverrides[]>([]); // Undo用スタック
  const [previewTheme, setPreviewTheme] = useState<ThemeName>('dark');
  const [toast, setToast] = useState<string | null>(null);
  const [openGroups, setOpenGroups] = useState<Record<string, boolean>>(
    () => Object.fromEntries(GROUPS.map(g => [g.label, true]))
  );
  const [device, setDevice] = useState(DEVICES[0]);
  const [editMode, setEditMode] = useState(false); // false=操作モード, true=編集モード
  const [highlight, setHighlight] = useState<ThemeKey[]>([]);
  const [refUrl, setRefUrl] = useState<string | null>(null);
  const [refOpacity, setRefOpacity] = useState(0.5);

  const screenRef = useRef<HTMLDivElement>(null);
  const base = TH[previewTheme];

  function setVal(k: ThemeKey, v: string | number) {
    setHistory(h => [...h, overrides]);
    setOverrides((prev) => {
      const patch = { ...(prev[previewTheme] ?? {}) };
      if (v === base[k]) delete patch[k];
      else patch[k] = v;
      return { ...prev, [previewTheme]: patch };
    });
  }

  function undo() {
    setHistory(h => {
      if (h.length === 0) return h;
      const prev = h[h.length - 1];
      setOverrides(prev);
      return h.slice(0, -1);
    });
  }

  function flash(msg: string) {
    setToast(msg);
    setTimeout(() => setToast(null), 1800);
  }

  function handleSave() { saveCustomTheme(overrides); flash('保存しました（通常アプリに反映されます）'); }
  function handleReset() { setHistory(h => [...h, overrides]); setOverrides({}); saveCustomTheme({}); flash('デフォルトに戻しました'); }
  async function handleCopy() {
    try { await navigator.clipboard.writeText(JSON.stringify(overrides, null, 2)); flash('JSONをコピーしました'); }
    catch { flash('コピーに失敗しました'); }
  }

  function handleRefImage(e: React.ChangeEvent<HTMLInputElement>) {
    const f = e.target.files?.[0];
    if (f) setRefUrl(URL.createObjectURL(f));
  }

  // 編集モード: スマホ内クリック → 表示色から該当テーマ色を特定
  function handleScreenClick(e: React.MouseEvent) {
    if (!editMode) return;
    e.preventDefault();
    e.stopPropagation();
    const overlay = e.currentTarget as HTMLElement;
    overlay.style.pointerEvents = 'none';
    const el = document.elementFromPoint(e.clientX, e.clientY) as HTMLElement | null;
    overlay.style.pointerEvents = 'auto';
    if (!el) return;

    // クリック要素とその祖先から表示色を収集
    const seen = new Set<string>();
    let node: HTMLElement | null = el;
    for (let i = 0; i < 5 && node; i++, node = node.parentElement) {
      const cs = getComputedStyle(node);
      [cs.color, cs.backgroundColor].forEach(c => {
        const cc = canonical(c);
        if (cc) seen.add(cc);
      });
    }

    // 現在の解決済みテーマと突き合わせ
    const resolved = resolveTheme(previewTheme, overrides);
    const matched: ThemeKey[] = [];
    (Object.keys(resolved) as ThemeKey[]).forEach(k => {
      const cc = canonical(String(resolved[k]));
      if (cc && seen.has(cc)) matched.push(k);
    });

    if (matched.length === 0) { flash('一致する色が見つかりませんでした'); return; }
    // 該当グループを開いて先頭をスクロール＆ハイライト
    setOpenGroups(g => {
      const next = { ...g };
      GROUPS.forEach(grp => { if (grp.keys.some(k => matched.includes(k))) next[grp.label] = true; });
      return next;
    });
    setHighlight(matched);
    setTimeout(() => document.getElementById(`field-${matched[0]}`)?.scrollIntoView({ behavior: 'smooth', block: 'center' }), 60);
    setTimeout(() => setHighlight([]), 2500);
  }

  const changedCount = Object.keys(overrides.dark ?? {}).length + Object.keys(overrides.light ?? {}).length;

  return (
    <div style={{ position: 'fixed', inset: 0, display: 'flex', background: '#15161d', color: '#fff', fontFamily: '-apple-system, "Noto Sans JP", system-ui, sans-serif' }}>
      {/* ─── 左：コントロールパネル ─── */}
      <div style={{ width: 380, flexShrink: 0, display: 'flex', flexDirection: 'column', borderRight: '1px solid rgba(255,255,255,0.1)' }}>
        <div style={{ padding: '16px 16px 12px', borderBottom: '1px solid rgba(255,255,255,0.1)' }}>
          <div style={{ fontSize: 15, fontWeight: 700 }}>🎨 デザインエディタ</div>
          <div style={{ fontSize: 11, color: 'rgba(255,255,255,0.5)', marginTop: 4 }}>
            本物アプリをライブ編集。保存でこちらに反映します。
          </div>

          {/* 操作 / 編集 モード */}
          <div style={{ display: 'flex', gap: 6, marginTop: 12 }}>
            {[{ k: false, label: '操作モード' }, { k: true, label: '編集モード' }].map((m) => (
              <button key={m.label} onClick={() => { setEditMode(m.k); setHighlight([]); }}
                style={{ ...btnStyle, flex: 1, background: editMode === m.k ? 'rgba(120,200,255,0.25)' : 'rgba(255,255,255,0.07)', borderColor: editMode === m.k ? 'rgba(120,200,255,0.6)' : 'rgba(255,255,255,0.15)' }}>
                {m.label}
              </button>
            ))}
          </div>
          {editMode && (
            <div style={{ fontSize: 10, color: 'rgba(120,200,255,0.85)', marginTop: 6 }}>
              スマホ内の要素をクリック → 該当する色設定にジャンプします
            </div>
          )}

          {/* デバイス選択 + dark/light + 参照画像 */}
          <div style={{ display: 'flex', gap: 6, marginTop: 12 }}>
            <select value={device.label} onChange={(e) => setDevice(DEVICES.find(d => d.label === e.target.value)!)}
              style={{ ...inputStyle, flex: 1, width: 'auto' }}>
              {DEVICES.map(d => <option key={d.label} value={d.label}>{d.label}</option>)}
            </select>
          </div>
          <div style={{ display: 'flex', gap: 6, marginTop: 8, alignItems: 'center' }}>
            {(['dark', 'light'] as ThemeName[]).map((t) => (
              <button key={t} onClick={() => setPreviewTheme(t)}
                style={{ ...btnStyle, flex: 1, background: previewTheme === t ? 'rgba(120,200,255,0.25)' : 'rgba(255,255,255,0.07)', borderColor: previewTheme === t ? 'rgba(120,200,255,0.6)' : 'rgba(255,255,255,0.15)' }}>
                {t === 'dark' ? 'ダーク' : 'ライト'}
              </button>
            ))}
            <label style={{ ...btnStyle, cursor: 'pointer' }}>
              📷 参照画像
              <input type="file" accept="image/*" onChange={handleRefImage} style={{ display: 'none' }} />
            </label>
          </div>
          {refUrl && (
            <div style={{ display: 'flex', gap: 8, marginTop: 8, alignItems: 'center', fontSize: 11 }}>
              <span style={{ color: 'rgba(255,255,255,0.6)' }}>参照 透明度</span>
              <input type="range" min={0} max={1} step={0.05} value={refOpacity} onChange={(e) => setRefOpacity(parseFloat(e.target.value))} style={{ flex: 1 }} />
              <button onClick={() => setRefUrl(null)} style={{ ...btnStyle, padding: '3px 8px' }}>外す</button>
            </div>
          )}
        </div>

        {/* スクロール可能な編集領域 */}
        <div style={{ flex: 1, overflowY: 'auto', padding: '8px 12px 24px' }}>
          {GROUPS.map((g) => {
            const open = openGroups[g.label];
            return (
              <div key={g.label} style={{ marginTop: 10 }}>
                <button onClick={() => setOpenGroups(s => ({ ...s, [g.label]: !s[g.label] }))}
                  style={{ width: '100%', display: 'flex', justifyContent: 'space-between', alignItems: 'center', background: 'rgba(255,255,255,0.05)', border: 0, borderRadius: 6, padding: '7px 10px', cursor: 'pointer', color: 'rgba(120,200,255,0.95)', fontSize: 12, fontWeight: 700 }}>
                  <span>{g.label}</span>
                  <span style={{ transform: open ? 'rotate(0deg)' : 'rotate(-90deg)', transition: 'transform 0.2s' }}>▾</span>
                </button>
                {open && (
                  <div style={{ marginTop: 2 }}>
                    {g.keys.map((k) => (
                      <FieldRow key={k} k={k}
                        value={(overrides[previewTheme]?.[k] ?? base[k]) as string | number}
                        base={base[k] as string | number}
                        highlight={highlight.includes(k)}
                        onChange={(v) => setVal(k, v)} />
                    ))}
                  </div>
                )}
              </div>
            );
          })}
        </div>

        {/* フッターアクション */}
        <div style={{ padding: 12, borderTop: '1px solid rgba(255,255,255,0.1)', display: 'flex', gap: 8 }}>
          <button onClick={undo} disabled={history.length === 0}
            style={{ ...btnStyle, opacity: history.length === 0 ? 0.4 : 1 }}>↩ 戻す</button>
          <button onClick={handleReset} style={{ ...btnStyle, color: 'rgba(255,150,150,0.95)' }}>初期値</button>
          <button onClick={handleCopy} style={btnStyle}>JSON</button>
          <button onClick={handleSave} style={{ ...btnStyle, flex: 1, background: 'rgba(120,220,150,0.25)', borderColor: 'rgba(120,220,150,0.6)' }}>Save</button>
        </div>
        <div style={{ padding: '0 12px 10px', fontSize: 10, color: 'rgba(255,255,255,0.4)' }}>
          変更中: {changedCount} 項目　/　※背景アートはテーマ外のため未対応
        </div>
      </div>

      {/* ─── 右：スマホプレビュー（原寸表示。縮小すると中のスライダー等の操作判定が狂うため） ─── */}
      <div style={{ flex: 1, display: 'flex', alignItems: 'flex-start', justifyContent: 'center', overflow: 'auto', padding: 32 }}>
        <div
          ref={screenRef}
          style={{
            // translateZ(0)（等倍transform）で内部の position:fixed をこの枠内に閉じ込める
            transform: 'translateZ(0)',
            width: device.w, height: device.h, flexShrink: 0,
            position: 'relative', overflow: 'hidden',
            borderRadius: 40,
            boxShadow: '0 0 0 12px #050505, 0 30px 80px rgba(0,0,0,0.6), 0 0 0 13px rgba(255,255,255,0.08)',
            background: '#000',
          }}
        >
          <App themeOverride={overrides} forcedTheme={previewTheme} />

          {/* 参照画像オーバーレイ */}
          {refUrl && (
            <img src={refUrl} alt="参照" style={{ position: 'absolute', inset: 0, width: '100%', height: '100%', objectFit: 'cover', opacity: refOpacity, pointerEvents: 'none', zIndex: 150 }} />
          )}

          {/* 編集モード時のクリックキャプチャ層 */}
          {editMode && (
            <div onClick={handleScreenClick}
              style={{ position: 'absolute', inset: 0, zIndex: 160, cursor: 'crosshair' }}
              title="クリックで色を特定" />
          )}
        </div>
      </div>

      {/* トースト */}
      {toast && (
        <div style={{ position: 'fixed', bottom: 24, left: 'calc(50% + 190px)', transform: 'translateX(-50%)', background: 'rgba(30,32,44,0.95)', border: '1px solid rgba(255,255,255,0.2)', borderRadius: 10, padding: '10px 18px', fontSize: 13, zIndex: 200, boxShadow: '0 8px 24px rgba(0,0,0,0.4)' }}>
          {toast}
        </div>
      )}
    </div>
  );
}
