# サイト全体リデザイン 設計書

## 概要

Utilities-Svelte のWeb画面全体をリデザインする。目標は「モダンで安っぽく見えない」外観と、作者情報の表示。

**決定事項（ブレインストーミングで承認済み）:**
- デザイン方向: グラデーション / モダン
- カラー: ティール → ブルー（落ち着いたトーン）
- レイアウト: フェードグラデーション背景 + すりガラスナビ + 半透明カード

---

## カラーパレット

| 用途 | 値 |
|------|----|
| グラデーション（開始） | `#0f766e`（ティール） |
| グラデーション（終了） | `#0284c7`（スカイブルー） |
| ページ背景グラデーション | `linear-gradient(160deg, #e6fffe 0%, #e0f2fe 40%, #f0f9ff 70%, #fff 100%)` |
| 本文テキスト | `#0f172a` |
| サブテキスト | `#64748b` |
| カード背景 | `rgba(255, 255, 255, 0.80)` |
| カードボーダー | `rgba(15, 118, 110, 0.15)` |
| ナビ背景 | `rgba(255, 255, 255, 0.65)` |

---

## グローバルレイアウト

### ページ背景

全ページ共通。`+layout.svelte` の最外ラッパーに適用する。

```css
background: linear-gradient(160deg, #e6fffe 0%, #e0f2fe 40%, #f0f9ff 70%, #fff 100%);
min-height: 100vh;
```

`background-attachment: fixed` は使わない（スクロール時のちらつき防止）。代わりに `min-height: 100vh` でページが短い場合もグラデーションが全面に出るようにする。

### ナビゲーション（ヘッダー）

sticky で画面上部に固定。すりガラス効果。

```css
position: sticky;
top: 0;
z-index: 10;
background: rgba(255, 255, 255, 0.65);
backdrop-filter: blur(12px);
-webkit-backdrop-filter: blur(12px);
border-bottom: 1px solid rgba(15, 118, 110, 0.10);
```

- **ロゴ "Utilities"**: グラデーションテキスト（`#0f766e` → `#0284c7`）、font-weight 800
- **ナビリンク（非アクティブ）**: `color: #64748b`、font-weight 500
- **ナビリンク（アクティブ）**: `color: #0f766e`、font-weight 600

### フッター

全ページ共通。`+layout.svelte` の `<main>` の下に追加する。

```css
border-top: 1px solid rgba(15, 118, 110, 0.10);
background: rgba(255, 255, 255, 0.50);
backdrop-filter: blur(8px);
padding: 14px 20px;
display: flex;
align-items: center;
justify-content: space-between;
```

**表示内容:**
- 左: アバター（グラデーション円）+ 名前「96X」+ Xリンク「@96X_SBRB」（`https://x.com/96X_SBRB`）
- 右: キャッチコピー「個人開発ツール集」

---

## ホームページ（`/`）

### ヒーローエリア

```
<h1>Utilities</h1>        ← グラデーションテキスト、font-size clamp(2rem, 8vw, 3rem)、font-weight 800
<p>個人開発ツール集</p>   ← color #64748b、font-size 0.875rem
```

### ツールカード

2カラムグリッド。各カードのスタイル:

```css
background: rgba(255, 255, 255, 0.80);
backdrop-filter: blur(8px);
border: 1px solid rgba(15, 118, 110, 0.15);
border-radius: 14px;
box-shadow: 0 2px 16px rgba(15, 118, 110, 0.06), 0 1px 3px rgba(0,0,0,0.04);
transition: all 0.18s ease;
```

**ホバー時:**

```css
border-color: rgba(15, 118, 110, 0.35);
box-shadow: 0 6px 24px rgba(15, 118, 110, 0.12), 0 2px 6px rgba(0,0,0,0.06);
transform: translateY(-2px);
```

カード内: タイトル（`color: #0f172a`、font-weight 700）+ 説明文（`color: #64748b`）+ 右矢印アクセント（`color: #0f766e`）

---

## ツールページ（共通）

コンテンツ部分の変更は最小限にとどめ、グローバルレイアウト（背景・ナビ・フッター）が適用されるだけで見た目が揃う。

### 既存コンポーネントの調整

- **設定パネル / ボーダー付きコンテナ**: `border-color` を `rgba(15, 118, 110, 0.12)` に更新
- **プライマリボタン（「変換」等）**: 現行の `bg-blue-600` → グラデーション（`#0f766e` → `#0284c7`）に変更
- **入力欄 focus リング**: `focus:ring-blue-300` → `focus:ring-teal-300` に変更
- **アクセントカラー全般**: Tailwind の `blue-600` クラスをすべて `teal-700`（`#0f766e`相当）に置換。`blue-300`（focus ring）は `teal-300` に置換。

---

## 実装スコープ

### 変更対象ファイル

| ファイル | 変更内容 |
|----------|----------|
| `src/routes/+layout.svelte` | ページ背景・ナビスタイル刷新、フッターコンポーネント追加 |
| `src/routes/+page.svelte` | h1グラデーション化、ツールカードスタイル更新 |
| `src/routes/bpm-tapper/+page.svelte` | ボタン・アクセントカラーを teal 系に統一 |
| `src/routes/hepburn-converter/+page.svelte` | ボタン・アクセントカラーを teal 系に統一 |
| `src/app.css` | 不要であれば変更なし（Tailwind のみ使用） |

### 変更しないもの

- 各ツールのロジック・機能
- コンポーネントの構造（JSX/Svelte テンプレートの大枠）
- ルーティング

---

## 作者情報（フッター）

| 項目 | 値 |
|------|----|
| 表示名 | 96X |
| Xハンドル | @96X_SBRB |
| XプロフィールURL | `https://x.com/96X_SBRB` |
| キャッチコピー | 個人開発ツール集 |
