import { Glass } from './Glass';
import { useTheme, type ThemeName } from '../theme';

interface Props {
  theme: ThemeName;
  onThemeChange: (t: ThemeName) => void;
}

export function SettingsPage({ theme, onThemeChange }: Props) {
  const t = useTheme();

  return (
    <div style={{ padding: '70px 16px 130px', maxWidth: 500, margin: '0 auto' }}>
      {/* ヘッダー */}
      <div style={{ marginBottom: 24 }}>
        <div style={{ fontSize: 13, fontWeight: 600, color: t.textMuted, letterSpacing: 0.4, marginBottom: 2 }}>PREFERENCES</div>
        <div style={{ fontSize: 30, fontWeight: 800, color: t.text, letterSpacing: 0.2, lineHeight: 1.1 }}>設定</div>
      </div>

      {/* テーマ選択 */}
      <Glass tint={t.glassTint} radius={22} padding={16} style={{ marginBottom: 12 }}>
        <div style={{ fontSize: 11, fontWeight: 800, color: t.textMuted, letterSpacing: 1.4, marginBottom: 14 }}>テーマ</div>
        <div style={{ display: 'flex', gap: 10 }}>
          {(['dark', 'light'] as const).map(name => {
            const isActive = theme === name;
            return (
              <button
                key={name}
                onClick={() => onThemeChange(name)}
                style={{
                  flex: 1, padding: '14px 0', borderRadius: 16,
                  background: isActive ? t.tabActiveBg : t.glassChip,
                  boxShadow: isActive ? t.tabActiveShadow : `inset 0 0 0 0.5px ${t.rim}`,
                  color: isActive ? t.text : t.textMuted,
                  fontSize: 15, fontWeight: 700, cursor: 'pointer', border: 'none',
                  transition: 'all 0.2s cubic-bezier(0.4,0,0.2,1)',
                  display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 6,
                }}
              >
                <span style={{ fontSize: 22 }}>{name === 'dark' ? '🌙' : '☀️'}</span>
                <span>{name === 'dark' ? 'ダーク' : 'ライト'}</span>
              </button>
            );
          })}
        </div>
        <p style={{ fontSize: 11, color: t.textWeak, marginTop: 12, textAlign: 'center' }}>
          設定は自動的に保存されます
        </p>
      </Glass>

      {/* アプリ情報 */}
      <Glass tint={t.glassTint2} radius={22} padding={16}>
        <div style={{ fontSize: 11, fontWeight: 800, color: t.textMuted, letterSpacing: 1.4, marginBottom: 12 }}>アプリ情報</div>
        {[
          { label: 'データソース', value: 'pokemon-champions-data' },
          { label: '計算式', value: 'Gen9 / Lv50 / 4096チェーン' },
          { label: 'SPシステム', value: '合計66SP・最大32SP/stat' },
        ].map(({ label, value }) => (
          <div key={label} style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', paddingBottom: 10, marginBottom: 10, borderBottom: `1px solid ${t.rim}` }}>
            <span style={{ fontSize: 13, color: t.textMuted, fontWeight: 600 }}>{label}</span>
            <span style={{ fontSize: 12, color: t.text, fontFamily: '"SF Mono", monospace' }}>{value}</span>
          </div>
        ))}
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
          <span style={{ fontSize: 13, color: t.textMuted, fontWeight: 600 }}>バージョン</span>
          <span style={{ fontSize: 12, color: t.text, fontFamily: '"SF Mono", monospace' }}>Phase 5</span>
        </div>
      </Glass>
    </div>
  );
}
