# カテゴリーナビゲーション デザイン仕様

## 概要

ツール数の増加に対応するため、上部ナビをカテゴリー単位で整理する。現在ページの特定、同カテゴリー内ページへの導線、モバイル対応を含む。

## カテゴリー定義

`src/lib/site.ts` に `categories` 配列を追加し、各ツールに `category` フィールドで紐づける。

| カテゴリー id | ラベル | 対象ツール |
|---|---|---|
| `music` | 楽曲制作 | BPM Tapper |
| `programming` | プログラミング | ヘボン式変換 |
| `image` | 画像 | 画像変換・SNS画像リサイズ・証明写真 |
| `investment` | 投資 | NISA年率計算・NISA積立シミュレーター |

## site.ts 構造

```ts
export const site = {
  // ...既存フィールド...
  categories: [
    { id: 'music',       label: '楽曲制作' },
    { id: 'programming', label: 'プログラミング' },
    { id: 'image',       label: '画像' },
    { id: 'investment',  label: '投資' },
  ],
  tools: [
    { href: '/bpm-tapper',                label: 'BPM Tapper',          description: '...', visible: true,  category: 'music' },
    { href: '/hepburn-converter',         label: 'ヘボン式変換',         description: '...', visible: true,  category: 'programming' },
    { href: '/image-tools',               label: '画像変換(開発中)',      description: '...', visible: false, category: 'image' },
    { href: '/sns-image-resize',          label: 'SNS画像リサイズ(開発中)', description: '...', visible: true,  category: 'image' },
    { href: '/id-photo',                  label: '証明写真(開発中)',      description: '...', visible: true,  category: 'image' },
    { href: '/nisa-simple-calculator',    label: 'NISA年率計算(開発中)',  description: '...', visible: true,  category: 'investment' },
    { href: '/nisa-accumulation-simulator', label: 'NISA積立シミュレーター(開発中)', description: '...', visible: true, category: 'investment' },
  ],
} as const
```

## ナビゲーション (`+layout.svelte`)

### 上部ナビ

- カテゴリー名のみを横並びで表示する
- **表示条件:** カテゴリー内に `visible: true` のツールが1件以上ある場合のみ表示
- 現在ページが属するカテゴリーはティール色（`text-teal-700`）で強調
- カテゴリー名をクリック/タップするとドロップダウンが開く
  - ドロップダウン内: カテゴリー内の `visible: true` ツールを一覧表示
  - 現在ページはティールのドット＋太字でハイライト
  - ドロップダウン外クリックで閉じる
- PC・スマホ共に同じ挙動（横スクロール対応）

### フッター直上カテゴリーバー

- ツールページのみ表示（トップページ `/` では非表示）
- **表示条件:** 現在ページのカテゴリー内に `visible: true` のツールが2件以上ある場合のみ表示（1件のみなら不要）
- 1行レイアウト: `[カテゴリーラベル] | [ページA] [ページB] [ページC]`
  - カテゴリーラベル: グレー小文字
  - 各ページ: 角丸ピル形式
  - 現在ページ: ティール背景・太字ピル
- ページが多くて横幅に収まらない場合は折り返し（`flex-wrap`）

## トップページ (`+page.svelte`)

- ツールカードをカテゴリーごとにグループ化して表示
- カテゴリーグループ: グループ見出し（カテゴリーラベル）＋カードグリッド
- `visible: true` のツールのみ表示
- `visible: true` のツールが存在しないカテゴリーはグループごと非表示

## 変更ファイル一覧

| ファイル | 変更内容 |
|---|---|
| `src/lib/site.ts` | `categories` 追加、各ツールに `category` フィールド追加 |
| `src/routes/+layout.svelte` | カテゴリーナビ・ドロップダウン・カテゴリーバー実装 |
| `src/routes/+page.svelte` | カテゴリーグループ表示 |
