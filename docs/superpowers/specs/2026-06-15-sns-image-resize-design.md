# SNS画像リサイズツール 設計ドキュメント

Date: 2026-06-15

## 概要

SvelteKitプロジェクトに、SNS各サービスの推奨サイズにワンクリックでクロップ・リサイズできるクライアントサイド完結型ツールを追加する。既存の画像変換ツール(`/image-tools`)とは別ページ。

## 確定事項

- 状態管理: `+page.svelte` にフラット集約（アプローチA）
- ImageUploader: 既存 `src/lib/components/ImageUploader.svelte` を再利用し、ページ側で `files[0]` のみ使用
- クロップUI: `svelte-easy-crop` を採用
- 出力形式: PNG固定（MVP）

## アーキテクチャ

### 状態（+page.svelte が所有）

```ts
selectedPreset: SnsPreset | null
imageFile: File | null
crop: { x: number; y: number }
zoom: number
croppedAreaPixels: Area | null  // svelte-easy-crop の onCropComplete から
```

### ファイル構成

```
src/
  routes/
    sns-image-resize/
      +page.svelte      # ページ本体・状態オーナー
      +page.ts          # SEOメタデータ
  lib/
    data/
      snsPresets.ts     # 9プリセット定数配列
    components/
      PresetSelector.svelte   # プリセット選択カードグリッド（新規）
      CropEditor.svelte        # svelte-easy-cropラッパー + zoomスライダー（新規）
      ImageUploader.svelte    # 既存・変更なし
    utils/
      cropToBlob.ts     # croppedAreaPixels → Canvas → PNG Blob（新規）
```

## プリセット一覧

| 名称 | 幅 | 高さ | アスペクト比 |
|---|---|---|---|
| Instagram 投稿（正方形） | 1080 | 1080 | 1:1 |
| Instagram 投稿（縦長） | 1080 | 1350 | 4:5 |
| Instagram ストーリー / リール | 1080 | 1920 | 9:16 |
| X(Twitter) 投稿画像 | 1600 | 900 | 16:9 |
| X(Twitter) ヘッダー画像 | 1500 | 500 | 3:1 |
| YouTube サムネイル | 1280 | 720 | 16:9 |
| YouTube チャンネルアート | 2560 | 1440 | 16:9 |
| Facebook カバー画像 | 820 | 312 | 約2.6:1 |
| LinkedIn 投稿画像 | 1200 | 627 | 約1.91:1 |

型定義:
```ts
interface SnsPreset {
  id: string
  label: string
  service: string
  width: number
  height: number
}
```

## データフロー

```
[画像選択] → ImageUploader.onfiles → imageFile = files[0]
[プリセット選択] → selectedPreset → CropEditorのaspect prop更新
[クロップ操作] → svelte-easy-cropのonCropComplete → croppedAreaPixels更新
[ダウンロード] → cropToBlob(croppedAreaPixels, imageFile, preset) → Blob → <a download>
```

## cropToBlob.ts の処理

1. `imageFile` から `HTMLImageElement` を生成
2. `croppedAreaPixels`（px座標）を `OffscreenCanvas` 上に描画（`drawImage` でクロップ領域を切り出し）
3. Canvas を `preset.width × preset.height` にスケール
4. `canvas.toBlob('image/png')` でBlob出力し、`<a download>` でダウンロード

## ページレイアウト

スペック準拠の順序（上から）:
1. 広告枠 `ad-slot ad-slot--top`
2. タイトル・説明文（「サーバーに送信されません」を含める）
3. PresetSelector（カードグリッド、選択中をハイライト）
4. ImageUploader（既存コンポーネント）
5. CropEditor（imageFile && selectedPreset の場合のみ表示）
6. ダウンロードボタン（「ダウンロード(1080 × 1080 PNG)」形式）
7. 広告枠 `ad-slot ad-slot--in-content`
8. SEO説明文（200〜400文字）+ 画像圧縮ツールへの内部リンク

## site.ts への追加

```ts
{ href: '/sns-image-resize', label: 'SNS画像リサイズ(開発中)', visible: true }
```

## SEO

- title: `SNS画像サイズ変換 - Instagram・X・YouTube対応の無料ツール`
- description: 各SNSの推奨サイズに画像をリサイズ・クロップできる無料ツール。Instagram・X・YouTube・Facebook・LinkedIn対応。サーバーへのアップロード不要。

## 広告枠

- クラス名を画像圧縮ツールと統一: `ad-slot ad-slot--top`, `ad-slot ad-slot--in-content`
- 後で広告タグを一括差し替えできるよう、クラス名で管理

## 依存パッケージ

- `svelte-easy-crop` (新規インストール)
- その他は既存パッケージで賄える
