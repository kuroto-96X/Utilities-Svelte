# サイト全体リデザイン 実装計画

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Utilities-Svelte のWeb画面全体を、ティール→ブルーのグラデーション背景 + すりガラスナビ + フッター（作者情報）スタイルにリデザインする。

**Architecture:** グローバルな背景グラデーションと半透明ナビ・フッターを `+layout.svelte` に集約する。各ツールページは Tailwind クラスの差し替えと `<style>` セクション内のカラー値更新のみ。ロジック変更なし、スタイルのみ変更。

**Tech Stack:** SvelteKit 5, Tailwind CSS v3（`bg-white/65`、`border-teal-700/10` など opacity modifier 構文を使用）

---

## 変更ファイル一覧

| ファイル | 変更内容 |
|----------|----------|
| `src/app.css` | `.gradient-bg` カスタムクラス追加 |
| `src/routes/+layout.svelte` | ナビリデザイン・フッター追加 |
| `src/routes/+page.svelte` | h1・ツールカードのリデザイン |
| `src/routes/bpm-tapper/+page.svelte` | TAP ボタン・リプル・グラフ・スライダー色を teal 系に更新 |
| `src/routes/hepburn-converter/+page.svelte` | 変換ボタン・設定パネル・focus リングを teal 系に更新 |

---

## Task 1: グローバル背景クラスの追加

**Files:**
- Modify: `src/app.css`

- [ ] **Step 1: `app.css` に `.gradient-bg` を追加する**

`src/app.css` を以下に書き換える：

```css
@import 'tailwindcss/base';
@import 'tailwindcss/components';
@import 'tailwindcss/utilities';

.gradient-bg {
  background: linear-gradient(160deg, #e6fffe 0%, #e0f2fe 40%, #f0f9ff 70%, #fff 100%);
  min-height: 100vh;
}
```

- [ ] **Step 2: ビルドが通ることを確認する**

```bash
npm run build
```

Expected: エラーなし

- [ ] **Step 3: コミット**

```bash
git add src/app.css
git commit -m "style: グラデーション背景クラスを追加"
```

---

## Task 2: ナビゲーションとフッターのリデザイン

**Files:**
- Modify: `src/routes/+layout.svelte`

- [ ] **Step 1: `+layout.svelte` を書き換える**

`src/routes/+layout.svelte` 全体を以下に置き換える：

```svelte
<script lang="ts">
  import '../app.css'
  import favicon from '$lib/assets/favicon.svg'
  import { page } from '$app/stores'

  let { children } = $props()
</script>

<svelte:head>
  <link rel="icon" href="{favicon}" />
</svelte:head>

<div class="gradient-bg flex flex-col">
  <header class="sticky top-0 z-10 border-b border-teal-700/10 bg-white/65 backdrop-blur-md">
    <nav class="max-w-4xl mx-auto px-4 py-2.5 flex items-center gap-6">
      <a
        href="/"
        class="font-extrabold text-lg tracking-tight mr-2 bg-gradient-to-r from-teal-700 to-sky-600 bg-clip-text text-transparent"
      >
        Utilities
      </a>
      <a
        href="/bpm-tapper"
        class="text-sm font-medium transition-colors"
        class:text-teal-700={($page.url.pathname as string) === '/bpm-tapper'}
        class:font-semibold={($page.url.pathname as string) === '/bpm-tapper'}
        class:text-slate-500={($page.url.pathname as string) !== '/bpm-tapper'}
      >
        BPM Tapper
      </a>
      <a
        href="/hepburn-converter"
        class="text-sm font-medium transition-colors"
        class:text-teal-700={($page.url.pathname as string) === '/hepburn-converter'}
        class:font-semibold={($page.url.pathname as string) === '/hepburn-converter'}
        class:text-slate-500={($page.url.pathname as string) !== '/hepburn-converter'}
      >
        ヘボン式変換
      </a>
    </nav>
  </header>

  <main class="flex-1">
    {@render children()}
  </main>

  <footer class="border-t border-teal-700/10 bg-white/50 backdrop-blur-md">
    <div class="max-w-4xl mx-auto px-4 py-4 flex items-center justify-between">
      <div class="flex items-center gap-3">
        <div
          class="w-7 h-7 rounded-full bg-gradient-to-br from-teal-700 to-sky-600 flex items-center justify-center text-white text-xs font-bold select-none"
          aria-hidden="true"
        >96</div>
        <div>
          <p class="text-sm font-bold text-slate-800">96X</p>
          <a
            href="https://x.com/96X_SBRB"
            target="_blank"
            rel="noopener noreferrer"
            class="text-xs text-sky-600 hover:underline"
          >@96X_SBRB</a>
        </div>
      </div>
      <p class="text-xs text-slate-400">個人開発ツール集</p>
    </div>
  </footer>
</div>
```

- [ ] **Step 2: ビルドが通ることを確認する**

```bash
npm run build
```

Expected: エラーなし

- [ ] **Step 3: 開発サーバーで見た目を確認する**

```bash
npm run dev
```

`http://localhost:5173` を開き、以下を確認する：
- ページ全体にティール系のグラデーション背景が適用されている
- ナビが半透明 + すりガラス（スクロールしても上部に固定）
- ロゴ「Utilities」がグラデーションテキスト（ティール → ブルー）
- ページ下部にフッターが表示され、「96X」「@96X_SBRB」「個人開発ツール集」が確認できる

- [ ] **Step 4: コミット**

```bash
git add src/routes/+layout.svelte
git commit -m "style: ナビゲーションをすりガラス化・フッターを追加"
```

---

## Task 3: ホームページのリデザイン

**Files:**
- Modify: `src/routes/+page.svelte`

- [ ] **Step 1: `+page.svelte` を書き換える**

`src/routes/+page.svelte` 全体を以下に置き換える：

```svelte
<svelte:head>
  <title>Utilities</title>
</svelte:head>

<div class="max-w-4xl mx-auto px-4 py-12">
  <h1 class="text-4xl font-extrabold tracking-tight bg-gradient-to-r from-teal-700 to-sky-600 bg-clip-text text-transparent mb-3">
    Utilities
  </h1>
  <p class="text-sm text-slate-500 mb-10">個人開発ツール集</p>

  <div class="grid grid-cols-1 sm:grid-cols-2 gap-4">
    <a
      href="/bpm-tapper"
      class="block p-6 bg-white/80 backdrop-blur-sm border border-teal-700/15 rounded-xl shadow-sm hover:border-teal-700/35 hover:shadow-md hover:-translate-y-0.5 transition-all duration-200"
    >
      <h2 class="text-lg font-bold text-slate-800 mb-1">BPM Tapper</h2>
      <p class="text-sm text-slate-500">ビートを叩いてBPMを計測するツール</p>
      <p class="text-teal-700 mt-3 text-sm" aria-hidden="true">→</p>
    </a>

    <a
      href="/hepburn-converter"
      class="block p-6 bg-white/80 backdrop-blur-sm border border-teal-700/15 rounded-xl shadow-sm hover:border-teal-700/35 hover:shadow-md hover:-translate-y-0.5 transition-all duration-200"
    >
      <h2 class="text-lg font-bold text-slate-800 mb-1">ヘボン式変換</h2>
      <p class="text-sm text-slate-500">日本語（ひらがな・カタカナ）をヘボン式ローマ字に変換するツール</p>
      <p class="text-teal-700 mt-3 text-sm" aria-hidden="true">→</p>
    </a>
  </div>
</div>
```

- [ ] **Step 2: ビルドが通ることを確認する**

```bash
npm run build
```

Expected: エラーなし

- [ ] **Step 3: 開発サーバーで見た目を確認する**

`http://localhost:5173` で確認：
- h1「Utilities」がグラデーションテキスト
- h1 の下に「個人開発ツール集」のサブテキスト
- ツールカードが半透明 + ティール系の薄いボーダー
- ホバー時にカードが上に少し浮き上がり影が強くなる

- [ ] **Step 4: コミット**

```bash
git add src/routes/+page.svelte
git commit -m "style: ホームページをグラデーション見出し・半透明カードにリデザイン"
```

---

## Task 4: BPM Tapper アクセントカラー更新

**Files:**
- Modify: `src/routes/bpm-tapper/+page.svelte`

- [ ] **Step 1: TAP ボタンと box-shadow を teal グラデーションに変更する**

`bpm-tapper/+page.svelte` の `<style>` セクション内の `.tap-button` を変更する。

変更前:
```css
.tap-button {
  ...
  background-color: #0d6efd;
  ...
  box-shadow: 0 4px 20px rgba(13, 110, 253, 0.35);
  ...
}
```

変更後:
```css
.tap-button {
  ...
  background: linear-gradient(135deg, #0f766e, #0284c7);
  ...
  box-shadow: 0 4px 20px rgba(15, 118, 110, 0.35);
  ...
}
```

- [ ] **Step 2: リプルエフェクトの色を変更する**

同じく `<style>` 内の `.ripple` を変更する。

変更前:
```css
.ripple {
  ...
  background: rgba(13, 110, 253, 0.4);
  ...
}
```

変更後:
```css
.ripple {
  ...
  background: rgba(15, 118, 110, 0.4);
  ...
}
```

- [ ] **Step 3: `range-divider` の色を変更する**

同じく `<style>` 内の `.range-divider td` を変更する。

変更前:
```css
.range-divider td {
  ...
  background-color: #0d6efd;
  ...
}
```

変更後:
```css
.range-divider td {
  ...
  background-color: #0f766e;
  ...
}
```

- [ ] **Step 4: range input とグラフの SVG 色を変更する**

HTML テンプレートで以下2箇所を変更する。

**range input（`accent-blue-600` → `accent-teal-700`）:**

変更前:
```svelte
class="w-full accent-blue-600 disabled:opacity-40"
```

変更後:
```svelte
class="w-full accent-teal-700 disabled:opacity-40"
```

**SVG メイン折れ線（`stroke="#0d6efd"` → `stroke="#0f766e"`）:**

変更前:
```svelte
<polyline points={chartData.inPolyline} fill="none" stroke="#0d6efd" stroke-width="2.5" stroke-linejoin="round" stroke-linecap="round" />
```

変更後:
```svelte
<polyline points={chartData.inPolyline} fill="none" stroke="#0f766e" stroke-width="2.5" stroke-linejoin="round" stroke-linecap="round" />
```

- [ ] **Step 5: ビルドが通ることを確認する**

```bash
npm run build
```

Expected: エラーなし

- [ ] **Step 6: 開発サーバーで見た目を確認する**

`http://localhost:5173/bpm-tapper` で確認：
- TAP ボタンがティール → ブルーのグラデーション
- ボタンをタップするとリプルエフェクトがティール系の色
- BPM グラフのアクティブな折れ線がティール色
- スライダーのつまみがティール色

- [ ] **Step 7: コミット**

```bash
git add src/routes/bpm-tapper/+page.svelte
git commit -m "style: BPM Tapper のアクセントカラーを teal 系に統一"
```

---

## Task 5: ヘボン式変換 アクセントカラー更新

**Files:**
- Modify: `src/routes/hepburn-converter/+page.svelte`

- [ ] **Step 1: 変換ボタンのクラスを変更する（PC・スマホ両方）**

変換ボタンはファイル内に2箇所ある（PC 用と スマホ用）。**両方**を変更する。

変更前（2箇所とも）:
```svelte
class="px-5 py-3 bg-blue-600 text-white rounded-xl font-medium text-sm hover:bg-blue-700 disabled:opacity-50 disabled:cursor-not-allowed leading-tight text-center"
```

変更後（2箇所とも）:
```svelte
class="px-5 py-3 bg-gradient-to-r from-teal-700 to-sky-600 text-white rounded-xl font-medium text-sm hover:opacity-90 disabled:opacity-50 disabled:cursor-not-allowed leading-tight text-center transition-opacity"
```

- [ ] **Step 2: 設定パネル外枠のボーダーを変更する**

設定パネル全体のラッパー。

変更前:
```svelte
<div class="border border-gray-200 rounded-xl mb-6 overflow-hidden">
```

変更後:
```svelte
<div class="border border-teal-700/10 rounded-xl mb-6 overflow-hidden">
```

- [ ] **Step 3: プリセット連動設定ボックスの配色を変更する**

変更前:
```svelte
<div class="rounded-lg border border-blue-100 bg-blue-50 px-3 py-2.5 space-y-2.5">
```

変更後:
```svelte
<div class="rounded-lg border border-teal-100 bg-teal-50 px-3 py-2.5 space-y-2.5">
```

直下のセクション区切り線も変更する。

変更前:
```svelte
<hr class="border-blue-100" />
```

変更後:
```svelte
<hr class="border-teal-100" />
```

- [ ] **Step 4: 入力欄の focus リングを変更する（PC・スマホ両方）**

入力 textarea は2箇所ある。**両方**の `focus:ring-blue-300` を変更する。

変更前（2箇所とも）:
```svelte
class="... focus:ring-2 focus:ring-blue-300"
```

変更後（2箇所とも）:
```svelte
class="... focus:ring-2 focus:ring-teal-300"
```

- [ ] **Step 5: 設定変更警告メッセージの色を変更する（PC・スマホ両方）**

変更前（2箇所とも）:
```svelte
<span class="text-xs text-blue-600">設定変更済み — 変換ボタンで再変換</span>
```

変更後（2箇所とも）:
```svelte
<span class="text-xs text-teal-700">設定変更済み — 変換ボタンで再変換</span>
```

- [ ] **Step 6: ビルドが通ることを確認する**

```bash
npm run build
```

Expected: エラーなし

- [ ] **Step 7: 開発サーバーで見た目を確認する**

`http://localhost:5173/hepburn-converter` で確認：
- 「変換」ボタンがティール → ブルーのグラデーション
- 設定パネル外枠のボーダーが薄いティール系
- プリセット連動設定ボックスがティール系の薄い背景
- テキストエリアにフォーカスすると緑系の focus リング
- 「設定変更済み」メッセージがティール色

- [ ] **Step 8: テストが通ることを確認する**

```bash
npm test
```

Expected: PASS（ロジック変更なしのため既存テストは全通過）

- [ ] **Step 9: コミット**

```bash
git add src/routes/hepburn-converter/+page.svelte
git commit -m "style: ヘボン式変換のアクセントカラーを teal 系に統一"
```
