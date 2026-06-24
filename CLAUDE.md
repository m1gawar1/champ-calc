# CLAUDE.md — app/（ポケモンチャンピオンズ ダメ計 Webアプリ）

**技術スタック**: React + Vite + TypeScript + Tailwind CSS v4
**データ**: GitHub raw URL から動的 fetch（`otterlyclueless/pokemon-champions-data`）
**永続化**: localStorage（キー: `champ_store_v1`）
**デプロイ予定**: Vercel（静的サイト）

## 開発サーバー起動

```bash
cd app
npm run dev -- --host   # → http://localhost:5173
```

## 主要ファイル

| パス | 内容 |
|---|---|
| `src/engine/damage.ts` | ダメージ計算（16段階乱数） |
| `src/engine/stats.ts` | 実数値計算（Lv50・SP→EV換算） |
| `src/engine/typeChart.ts` | タイプ相性テーブル（Gen6+） |
| `src/components/Calculator.tsx` | ダメ計メイン UI |
| `src/components/PartyPage.tsx` | パーティ管理 UI |
| `src/App.tsx` | タブバー + AppStore 管理 |
| `src/i18n.ts` | 英語→日本語変換（名前・技・タイプ・性格） |
| `src/data/pokemon-ja.json` | ポケモン日本語名マッピング（1026件） |
| `src/data/moves-ja.json` | 技日本語名マッピング（494件） |
| `scripts/generate-ja-names.mjs` | 日本語名マッピング生成スクリプト |

## SPシステム（チャンピオンズ独自）

- 合計 66SP・1ステータス最大 32SP
- 計算式: `SP × 8 = EV換算`（Gen9標準式に代入）

## 実装状況

| フェーズ | 内容 | 状態 |
|---|---|---|
| Phase 1 | ダメージ計算 | 完了 |
| Phase 2 | パーティ保存 | 完了 |
| Phase 3 | 素早さ比較 | 完了 |
| Phase 4 | 写真取り込み | 未着手 |

## 日本語名マッピング再生成

```bash
cd app
node --experimental-sqlite scripts/generate-ja-names.mjs
```

pokedex.db 参照先: `../pokecham/pokedex/pokedex.db`
