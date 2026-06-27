// スクショ2枚（能力タブ・ステータスタブ）からマイパーティを取り込むモーダル。
// createPortal でフルスクリーン表示し、SelectModal と同じ Glass + セーフエリア作法に従う。

import { useState } from 'react';
import { createPortal } from 'react-dom';
import { Capacitor } from '@capacitor/core';
import { GlassLayers } from './Glass';
import { useTheme } from '../theme';
import { captureImage } from '../engine/ocr/captureImage';
import { recognizeImage } from '../engine/ocr';
import { recognizeTeam } from '../engine/import/recognizeTeam';
import type { OcrInput } from '../engine/ocr';
import type { ChampionsData, PokemonBuild } from '../types';

interface Props {
  data: ChampionsData;
  onImported: (builds: PokemonBuild[]) => void;
  onClose: () => void;
}

export function ImportPartyModal({ data, onImported, onClose }: Props) {
  const t = useTheme();

  // 各タブの OcrInput（未選択は null）
  const [abilityInput, setAbilityInput] = useState<OcrInput | null>(null);
  const [statusInput, setStatusInput] = useState<OcrInput | null>(null);

  // Web の File のみプレビュー URL を生成できる
  const [abilityPreview, setAbilityPreview] = useState<string | null>(null);
  const [statusPreview, setStatusPreview] = useState<string | null>(null);

  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  // 画像を1枚取得し、state に保存する
  async function pickImage(slot: 'ability' | 'status') {
    setError(null);
    try {
      const input = await captureImage();

      // Web（File オブジェクト）の場合はプレビュー URL を生成する
      let preview: string | null = null;
      if (!Capacitor.isNativePlatform() && input instanceof File) {
        preview = URL.createObjectURL(input);
      }

      if (slot === 'ability') {
        // 古いプレビュー URL を解放してからセット
        if (abilityPreview) URL.revokeObjectURL(abilityPreview);
        setAbilityInput(input);
        setAbilityPreview(preview);
      } else {
        if (statusPreview) URL.revokeObjectURL(statusPreview);
        setStatusInput(input);
        setStatusPreview(preview);
      }
    } catch (e) {
      // キャンセルや権限拒否は無視（クラッシュさせない）
      const msg = e instanceof Error ? e.message : '';
      if (!msg.includes('キャンセル') && !msg.includes('cancel') && !msg.includes('Cancel')) {
        setError('画像の取得に失敗しました。');
      }
    }
  }

  // OCR 実行 → recognizeTeam → onImported
  async function handleImport() {
    if (!abilityInput || !statusInput) return;
    setLoading(true);
    setError(null);
    try {
      const abilityOcr = await recognizeImage(abilityInput);
      const statusOcr = await recognizeImage(statusInput);
      const builds = recognizeTeam(abilityOcr, statusOcr, data);
      onImported(builds);
    } catch (e) {
      console.error('OCR 取り込みエラー:', e);
      setError('読み取りに失敗しました。明るく正面から撮った画像で再度お試しください。');
    } finally {
      setLoading(false);
    }
  }

  // 両方そろっていて、かつロード中でないときだけ「取り込む」ボタンを活性化
  const canImport = abilityInput !== null && statusInput !== null && !loading;

  return createPortal(
    <div
      style={{
        position: 'fixed', inset: 0,
        background: 'rgba(0,0,0,0.82)',
        zIndex: 1000,
        display: 'flex', alignItems: 'center', justifyContent: 'center',
        padding: 0,
      }}
      onClick={onClose}
    >
      <div
        style={{
          width: '100%', height: '100dvh',
          display: 'flex', flexDirection: 'column',
          position: 'relative', borderRadius: 0,
          overflow: 'hidden', isolation: 'isolate',
        }}
        onClick={e => e.stopPropagation()}
      >
        <GlassLayers radius={0} />

        {/* ヘッダー（ノッチ対策でセーフエリア上余白） */}
        <div
          style={{
            position: 'relative', zIndex: 3,
            display: 'flex', alignItems: 'center', justifyContent: 'space-between',
            padding: 'calc(env(safe-area-inset-top) + 16px) 16px 12px',
          }}
        >
          <span style={{ fontSize: 17, fontWeight: 800, color: t.text }}>
            スクショから取り込み
          </span>
          <button
            onClick={onClose}
            style={{
              color: t.textMuted, background: 'none', border: 'none',
              cursor: 'pointer', fontSize: 20, padding: '0 4px',
            }}
          >✕</button>
        </div>

        {/* 説明文 */}
        <div style={{ position: 'relative', zIndex: 3, padding: '0 16px 16px' }}>
          <p style={{ margin: 0, fontSize: 13, color: t.textMuted, lineHeight: 1.7 }}>
            チーム概要の「能力」タブと「ステータス」タブの2枚を読み込みます。
          </p>
        </div>

        {/* 画像選択エリア */}
        <div
          style={{
            position: 'relative', zIndex: 3,
            flex: 1, overflowY: 'auto',
            padding: '0 16px calc(env(safe-area-inset-bottom) + 24px)',
            display: 'flex', flexDirection: 'column', gap: 16,
          }}
        >
          {/* ① 能力タブ */}
          <ImageSlot
            label="① 能力タブの画像"
            selected={abilityInput !== null}
            preview={abilityPreview}
            onPick={() => pickImage('ability')}
            disabled={loading}
          />

          {/* ② ステータスタブ */}
          <ImageSlot
            label="② ステータスタブの画像"
            selected={statusInput !== null}
            preview={statusPreview}
            onPick={() => pickImage('status')}
            disabled={loading}
          />

          {/* ローディング表示 */}
          {loading && (
            <div
              style={{
                textAlign: 'center', padding: '12px 0',
                color: t.textMuted, fontSize: 14, fontWeight: 600,
              }}
            >
              画像を解析中…
            </div>
          )}

          {/* エラーメッセージ */}
          {error && (
            <div
              style={{
                padding: '10px 14px', borderRadius: 12,
                background: 'rgba(255,80,80,0.15)',
                border: '1px solid rgba(255,80,80,0.35)',
                color: '#ff6060', fontSize: 13, lineHeight: 1.6,
              }}
            >
              {error}
            </div>
          )}

          {/* 取り込みボタン */}
          <button
            onClick={handleImport}
            disabled={!canImport}
            style={{
              width: '100%', padding: '14px 0',
              borderRadius: 14, border: 'none',
              cursor: canImport ? 'pointer' : 'not-allowed',
              background: canImport
                ? 'linear-gradient(180deg, rgba(90,200,250,0.85), rgba(60,160,220,0.75))'
                : t.glassChip,
              boxShadow: canImport
                ? 'inset 0 1px 0 rgba(255,255,255,0.4)'
                : `inset 0 0 0 0.5px ${t.rim}`,
              color: canImport ? '#fff' : t.textWeak,
              fontSize: 15, fontWeight: 800,
              opacity: canImport ? 1 : 0.55,
              transition: 'opacity 0.2s, background 0.2s',
            }}
          >
            取り込む
          </button>
        </div>
      </div>
    </div>,
    document.getElementById('root')!,
  );
}

// 画像スロット（選択前: ダッシュ枠ボタン, 選択後: サムネ or 選択済みラベル）
interface SlotProps {
  label: string;
  selected: boolean;
  preview: string | null; // Web のみ。native は null
  onPick: () => void;
  disabled: boolean;
}

function ImageSlot({ label, selected, preview, onPick, disabled }: SlotProps) {
  const t = useTheme();
  return (
    <div>
      <div style={{ fontSize: 12, fontWeight: 700, color: t.textMuted, marginBottom: 6 }}>
        {label}
      </div>
      <button
        onClick={onPick}
        disabled={disabled}
        style={{
          width: '100%', minHeight: 80,
          borderRadius: 16,
          border: `1.5px dashed ${selected ? t.rimAccent : t.dashedRim}`,
          background: selected ? 'rgba(90,200,250,0.08)' : 'transparent',
          cursor: disabled ? 'not-allowed' : 'pointer',
          display: 'flex', flexDirection: 'column',
          alignItems: 'center', justifyContent: 'center',
          gap: 6, padding: 10,
          transition: 'border-color 0.15s, background 0.15s',
        }}
      >
        {/* サムネイル（Web でファイルを選んだ場合のみ表示） */}
        {preview ? (
          <img
            src={preview}
            alt={label}
            style={{
              maxHeight: 160, maxWidth: '100%',
              borderRadius: 10, objectFit: 'contain',
            }}
          />
        ) : selected ? (
          /* ネイティブ（path 文字列）は URL 生成できないのでラベルのみ */
          <span style={{ fontSize: 13, fontWeight: 700, color: t.accentAtk }}>
            選択済み ✓
          </span>
        ) : (
          <span style={{ fontSize: 13, fontWeight: 600, color: t.textWeak }}>
            タップして選択
          </span>
        )}
      </button>
    </div>
  );
}
