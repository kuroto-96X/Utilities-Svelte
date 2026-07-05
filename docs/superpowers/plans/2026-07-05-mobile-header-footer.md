# ヘッダー・フッター スマホ表示最適化 実装プラン

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** スマホ幅で崩れている上部ナビ・下部フッターを、専用レイアウトに切り替えて画面内に収める。切り替えの基準幅は、表示中カテゴリーの組み合わせからビルド時に自動計算する。

**Architecture:** 変更は `src/routes/+layout.svelte` に集約する。切り替え判定用の必要幅計算は `src/lib/navWidth.ts` に純粋関数として切り出し、`+layout.svelte` はその結果を `<style>` タグとして `<svelte:head>` に埋め込む（JSによる実行時DOM計測は行わない）。PC/タブレット版と スマホ版の両方のマークアップを常にDOMに出力し、CSSの `display:none` のみで表示を切り替える（JS分岐なし・SSR/prerenderとの不整合なし）。

**Tech Stack:** SvelteKit 5、Svelte 5 runes、TypeScript、Tailwind CSS v3、Vitest

---

## ファイル構成

| ファイル | 変更内容 |
|---|---|
| `src/lib/navWidth.ts` | 新規作成。表示中カテゴリーラベルの配列から、ナビが収まるのに必要な最小幅(px)を計算する純粋関数 |
| `src/lib/navWidth.test.ts` | 新規作成。上記関数のユニットテスト |
| `src/routes/+layout.svelte` | ブレークポイントCSSの埋め込み、モバイル用ヘッダー（ロゴ＋現在ページ名＋ハンバーガー＋アコーディオンメニュー）追加、下部ツールバーのスマホ非表示化、フッターのスマホ2段組み追加 |
| `CLAUDE.md` | カテゴリー変更時のブレークポイント定数再計測に関する規約を追記 |

---

## Task 1: ナビ必要幅の計算ロジック（TDD）

**Files:**
- Create: `src/lib/navWidth.ts`
- Test: `src/lib/navWidth.test.ts`

- [ ] **Step 1: 失敗するテストを書く**

`src/lib/navWidth.test.ts` を作成する：

```ts
import { describe, it, expect } from 'vitest'
import { calculateRequiredNavWidthPx } from './navWidth'

describe('calculateRequiredNavWidthPx', () => {
  it('カテゴリーが0件でもロゴ分の基準幅を返す', () => {
    expect(calculateRequiredNavWidthPx([])).toBe(32 + 130 + 24)
  })

  it('カテゴリーが増えるほど必要幅が増える', () => {
    const oneCategory = calculateRequiredNavWidthPx(['楽曲制作'])
    const twoCategories = calculateRequiredNavWidthPx(['楽曲制作', 'プログラミング'])
    expect(twoCategories).toBeGreaterThan(oneCategory)
  })

  it('ラベルの文字数が多いほど必要幅が増える', () => {
    const short = calculateRequiredNavWidthPx(['画像'])
    const long = calculateRequiredNavWidthPx(['プログラミング'])
    expect(long).toBeGreaterThan(short)
  })

  it('実際の5カテゴリー全表示時の必要幅を計算できる', () => {
    const labels = ['楽曲制作', 'プログラミング', '画像', '投資', 'ゲーム']
    // 32(nav padding) + 130(logo) + 24(safety) + 各ボタン(文字数*15 + 16 + 4)の合計
    // 楽曲制作(4): 60+16+4=80 / プログラミング(7): 105+16+4=125
    // 画像(2): 30+16+4=50 / 投資(2): 50 / ゲーム(3): 45+16+4=65
    expect(calculateRequiredNavWidthPx(labels)).toBe(32 + 130 + 24 + 80 + 125 + 50 + 50 + 65)
  })
})
```

- [ ] **Step 2: テストを実行して失敗を確認する**

Run: `npx vitest run src/lib/navWidth.test.ts`
Expected: FAIL（`./navWidth` が存在せずモジュール解決エラー）

- [ ] **Step 3: 実装する**

`src/lib/navWidth.ts` を作成する：

```ts
// text-sm(14px) の日本語1文字あたりの概算表示幅（実測ベース、フォント変更時は要再計測）
const CHAR_WIDTH_PX = 15
// カテゴリーボタンの左右padding (Tailwind px-2 = 8px * 2)
const BUTTON_PADDING_PX = 16
// nav の gap-1（ボタン間の間隔）
const BUTTON_GAP_PX = 4
// ロゴ「96X's Tools」(font-extrabold text-lg) + mr-4 の実測幅
const LOGO_WIDTH_PX = 130
// nav コンテナの px-4（左右合計）
const NAV_PADDING_PX = 32
// 実測誤差を吸収するための余裕
const SAFETY_MARGIN_PX = 24

/**
 * 表示中カテゴリーのラベル一覧から、上部ナビ（ロゴ＋カテゴリーボタン横並び）が
 * 折り返しなしで収まるために必要な最小幅(px)を計算する。
 * サイト名・カテゴリー構成が変わらない限り、この値はビルド時に一意に決まる。
 */
export function calculateRequiredNavWidthPx(categoryLabels: string[]): number {
  const buttonsWidth = categoryLabels.reduce(
    (sum, label) => sum + label.length * CHAR_WIDTH_PX + BUTTON_PADDING_PX + BUTTON_GAP_PX,
    0
  )
  return NAV_PADDING_PX + LOGO_WIDTH_PX + buttonsWidth + SAFETY_MARGIN_PX
}
```

- [ ] **Step 4: テストを実行して成功を確認する**

Run: `npx vitest run src/lib/navWidth.test.ts`
Expected: PASS（4件とも成功）

- [ ] **Step 5: コミットする**

```bash
git add src/lib/navWidth.ts src/lib/navWidth.test.ts
git commit -m "feat: ナビ必要幅を計算するnavWidth関数を追加"
```

---

## Task 2: ブレークポイントCSSを埋め込む

**Files:**
- Modify: `src/routes/+layout.svelte`

- [ ] **Step 1: navWidth関数をimportし、必要幅を計算する**

`src/routes/+layout.svelte` の import 群（1〜7行目）に追加する：

```svelte
<script lang="ts">
  import '../app.css'
  import siteIcon from '$lib/assets/site_icon.png'
  import authorIcon from '$lib/assets/96x_icon.png'
  import { page } from '$app/state'
  import { site } from '$lib/site'
  import siteConfig from '$lib/site.config.json'
  import { calculateRequiredNavWidthPx } from '$lib/navWidth'
```

- [ ] **Step 2: `visibleCategories` の定義の直後に、必要幅を計算する `$derived` を追加する**

現在の28〜31行目（`visibleCategories` の定義）の直後に追加する：

```svelte
  // visible:true のツールが1件以上あるカテゴリーのみ表示
  const visibleCategories = site.categories.filter(cat =>
    (site.tools as unknown as Array<{ href: string; category: string }>)
      .some(t => t.category === cat.id && isVisible(t.href))
  )

  // スマホ表示に切り替える基準幅（表示中カテゴリーの組み合わせから自動計算）
  let breakpointPx = $derived(
    calculateRequiredNavWidthPx(visibleCategories.map(c => c.label))
  )
```

- [ ] **Step 3: `<svelte:head>` にブレークポイントCSSを埋め込む**

現在の72〜77行目を以下に置換する：

```svelte
<svelte:head>
  <link rel="icon" href={siteIcon} />
  {#if isNoIndex}
    <meta name="robots" content="noindex" />
  {/if}
  {@html `<style>
    @media not all and (min-width: ${breakpointPx}px) {
      .rt-desktop-only { display: none !important; }
    }
    @media (min-width: ${breakpointPx}px) {
      .rt-mobile-only { display: none !important; }
    }
  </style>`}
</svelte:head>
```

- [ ] **Step 4: ビルドを確認する**

```bash
npm run build
```
Expected: エラーなし（まだ `rt-desktop-only` / `rt-mobile-only` を使う要素はないため、見た目の変化はなし）

- [ ] **Step 5: コミットする**

```bash
git add src/routes/+layout.svelte
git commit -m "feat: ナビ必要幅から算出したブレークポイントCSSを埋め込む"
```

---

## Task 3: モバイル用ヘッダー（ロゴ＋現在ページ名＋ハンバーガー＋アコーディオンメニュー）

**Files:**
- Modify: `src/routes/+layout.svelte`

- [ ] **Step 1: 現在ページのツール情報を取得する `$derived` と、メニュー開閉用の state を追加する**

`isNoIndex` の定義（55〜60行目）の直後、`openCategory` の定義の前に追加する：

```svelte
  // 現在ページに対応するツール情報（サブページは prefix マッチで親ツールを採用）
  let currentPageTool = $derived(
    routeId !== null
      ? (site.tools as unknown as Array<{ href: string; label: string }>)
          .find(t => routeId === t.href || routeId!.startsWith(`${t.href}/`)) ?? null
      : null
  )

  // 開いているドロップダウンのカテゴリー id（PC版）
  let openCategory = $state<string | null>(null)

  // モバイル版メニューの開閉状態
  let mobileMenuOpen = $state(false)
  // モバイル版メニュー内で開いているカテゴリーid一覧（複数同時展開可）
  let openMobileCategories = $state<Set<string>>(new Set())

  // 現在ページのカテゴリーは初期状態で展開しておく
  $effect(() => {
    if (activeCategory !== null && !openMobileCategories.has(activeCategory)) {
      openMobileCategories = new Set([...openMobileCategories, activeCategory])
    }
  })

  function toggleMobileCategory(id: string) {
    const next = new Set(openMobileCategories)
    if (next.has(id)) next.delete(id)
    else next.add(id)
    openMobileCategories = next
  }
```

- [ ] **Step 2: 外側クリックでモバイルメニューも閉じるようにする**

現在70行目を置換する：

```svelte
<!-- 変更前 -->
<svelte:window onclick={() => { openCategory = null }} />

<!-- 変更後 -->
<svelte:window onclick={() => { openCategory = null; mobileMenuOpen = false }} />
```

- [ ] **Step 3: 既存デスクトップ用navに `rt-desktop-only` を付与する**

現在の81行目を置換する：

```svelte
<!-- 変更前 -->
    <nav class="max-w-4xl mx-auto px-4 py-2.5 flex items-center gap-1">

<!-- 変更後 -->
    <nav class="rt-desktop-only max-w-4xl mx-auto px-4 py-2.5 flex items-center gap-1">
```

- [ ] **Step 4: `</nav>` と `</header>` の間にモバイル用ヘッダーを追加する**

現在の145〜146行目（`</nav>` の直後、`</header>` の直前）に追加する：

```svelte
    </nav>

    <div class="rt-mobile-only flex items-center gap-2 max-w-4xl mx-auto px-4 py-2.5 relative">
      <a
        href="/"
        class="font-extrabold text-lg tracking-tight bg-gradient-to-r from-teal-700 to-sky-600 bg-clip-text text-transparent shrink-0"
      >
        {site.name}
      </a>
      <button
        type="button"
        onclick={(e) => { e.stopPropagation(); mobileMenuOpen = !mobileMenuOpen }}
        aria-haspopup="true"
        aria-expanded={mobileMenuOpen}
        aria-label="メニューを開く"
        class="flex-1 flex items-center justify-between gap-2 min-w-0 text-left"
      >
        {#if currentPageTool}
          <span class="text-sm font-semibold text-slate-700 truncate">
            {getLabel(currentPageTool.href, currentPageTool.label)}
          </span>
        {:else}
          <span></span>
        {/if}
        <svg
          xmlns="http://www.w3.org/2000/svg"
          viewBox="0 0 24 24"
          fill="none"
          stroke="currentColor"
          stroke-width="2"
          class="w-5 h-5 text-slate-500 shrink-0"
        >
          <path stroke-linecap="round" stroke-linejoin="round" d="M4 6h16M4 12h16M4 18h16" />
        </svg>
      </button>

      {#if mobileMenuOpen}
        <div
          class="absolute top-full left-0 right-0 mt-1.5 mx-4 bg-white border border-slate-200 rounded-xl shadow-lg py-1.5 z-20 max-h-[70vh] overflow-y-auto"
          role="menu"
          tabindex="-1"
          use:focusFirst
          onclick={(e) => e.stopPropagation()}
          onkeydown={(e) => { if (e.key === 'Escape') { mobileMenuOpen = false; e.stopPropagation() } }}
        >
          {#each visibleCategories as cat (cat.id)}
            {@const isCatOpen = openMobileCategories.has(cat.id)}
            {@const catTools = (site.tools as unknown as Array<{ href: string; label: string; category: string }>).filter(t => t.category === cat.id && isVisible(t.href))}
            <div class="border-b border-slate-100 last:border-b-0">
              <button
                type="button"
                onclick={() => toggleMobileCategory(cat.id)}
                aria-expanded={isCatOpen}
                class="w-full flex items-center justify-between px-3 py-2 text-sm font-semibold text-slate-600"
              >
                {cat.label}
                <span class="text-slate-400 text-xs">{isCatOpen ? '▾' : '▸'}</span>
              </button>
              {#if isCatOpen}
                <div class="pb-1.5">
                  {#each catTools as tool (tool.href)}
                    {@const isCurrent = routeId === tool.href}
                    <a
                      role="menuitem"
                      href={tool.href}
                      onclick={() => { mobileMenuOpen = false }}
                      class="flex items-center gap-2 px-5 py-1.5 text-sm transition-colors"
                      class:text-teal-700={isCurrent}
                      class:font-semibold={isCurrent}
                      class:bg-teal-50={isCurrent}
                      class:text-slate-600={!isCurrent}
                    >
                      <span class="w-1.5 h-1.5 rounded-full shrink-0" class:bg-teal-700={isCurrent}></span>
                      {getLabel(tool.href, tool.label)}
                    </a>
                  {/each}
                </div>
              {/if}
            </div>
          {/each}
        </div>
      {/if}
    </div>
  </header>
```

- [ ] **Step 5: ビルドを確認する**

```bash
npm run build
```
Expected: エラーなし

- [ ] **Step 6: 開発サーバーで目視確認する**

```bash
npm run dev
```
`http://localhost:5173` をブラウザの開発者ツールでスマホ幅（例: 375px）に切り替えて確認する：

- ロゴ＋現在ページ名（トップページでは非表示）＋ハンバーガーアイコンが1行に収まっている
- ハンバーガーをタップするとカテゴリーのアコーディオンメニューが開く
- 現在ページのカテゴリーが初期状態で展開されている
- ツールをタップするとページ遷移し、メニューが閉じる
- メニュー外をタップすると閉じる
- ブラウザ幅を計算されたブレークポイント付近まで広げると、PC版ナビ（カテゴリーボタン横並び）に切り替わる

期待通りに動作しない場合は、このステップで修正してから次に進む。

- [ ] **Step 7: コミットする**

```bash
git add src/routes/+layout.svelte
git commit -m "feat: スマホ用ヘッダー(ロゴ+現在ページ名+ハンバーガーメニュー)を追加"
```

---

## Task 4: 下部ツール一覧バーをスマホで非表示にする

**Files:**
- Modify: `src/routes/+layout.svelte`

- [ ] **Step 1: `rt-desktop-only` を付与する**

現在の164行目を置換する：

```svelte
<!-- 変更前 -->
    <div class="border-t border-slate-200 bg-white sm:flex-shrink-0">

<!-- 変更後 -->
    <div class="rt-desktop-only border-t border-slate-200 bg-white sm:flex-shrink-0">
```

- [ ] **Step 2: ビルドを確認する**

```bash
npm run build
```
Expected: エラーなし

- [ ] **Step 3: 開発サーバーで目視確認する**

```bash
npm run dev
```
スマホ幅で、画面下部のツール一覧ピルバーが表示されないこと、PC幅では従来通り表示されることを確認する。

- [ ] **Step 4: コミットする**

```bash
git add src/routes/+layout.svelte
git commit -m "fix: 下部ツール一覧バーをスマホ表示では非表示にする"
```

---

## Task 5: フッターをスマホで2段組みにする

**Files:**
- Modify: `src/routes/+layout.svelte`

- [ ] **Step 1: 既存フッターに `rt-desktop-only` を付与し、スマホ版フッターを追加する**

現在の191〜209行目を以下に置換する：

```svelte
<!-- 変更前 -->
  <footer class="border-t border-slate-200 bg-white">
    <div class="max-w-4xl mx-auto px-4 py-3 flex items-center gap-3">
      <img
        src={authorIcon}
        alt={site.author.name}
        class="w-8 h-8 rounded-full object-cover shrink-0"
      />
      <span class="text-sm font-bold text-slate-800 shrink-0">{site.author.name}</span>
      <span class="text-xs text-slate-500 truncate">{site.author.bio}</span>
      <div class="flex items-center gap-3 shrink-0 ml-auto">
        <a href={site.author.links.x} target="_blank" rel="noopener noreferrer"
          class="text-xs text-sky-600 hover:underline">{site.author.handle}</a>
        <a href={site.author.links.booth} target="_blank" rel="noopener noreferrer"
          class="text-xs text-slate-500 hover:text-slate-700 hover:underline">BOOTH</a>
        <a href={site.author.links.youtube} target="_blank" rel="noopener noreferrer"
          class="text-xs text-slate-500 hover:text-slate-700 hover:underline">YouTube</a>
      </div>
    </div>
  </footer>

<!-- 変更後 -->
  <footer class="border-t border-slate-200 bg-white">
    <div class="rt-desktop-only max-w-4xl mx-auto px-4 py-3 flex items-center gap-3">
      <img
        src={authorIcon}
        alt={site.author.name}
        class="w-8 h-8 rounded-full object-cover shrink-0"
      />
      <span class="text-sm font-bold text-slate-800 shrink-0">{site.author.name}</span>
      <span class="text-xs text-slate-500 truncate">{site.author.bio}</span>
      <div class="flex items-center gap-3 shrink-0 ml-auto">
        <a href={site.author.links.x} target="_blank" rel="noopener noreferrer"
          class="text-xs text-sky-600 hover:underline">{site.author.handle}</a>
        <a href={site.author.links.booth} target="_blank" rel="noopener noreferrer"
          class="text-xs text-slate-500 hover:text-slate-700 hover:underline">BOOTH</a>
        <a href={site.author.links.youtube} target="_blank" rel="noopener noreferrer"
          class="text-xs text-slate-500 hover:text-slate-700 hover:underline">YouTube</a>
      </div>
    </div>

    <div class="rt-mobile-only flex flex-col gap-1.5 max-w-4xl mx-auto px-4 py-3">
      <div class="flex items-center gap-3">
        <img
          src={authorIcon}
          alt={site.author.name}
          class="w-8 h-8 rounded-full object-cover shrink-0"
        />
        <span class="text-sm font-bold text-slate-800 shrink-0">{site.author.name}</span>
        <div class="flex items-center gap-3 shrink-0 ml-auto">
          <a href={site.author.links.x} target="_blank" rel="noopener noreferrer"
            class="text-xs text-sky-600 hover:underline">{site.author.handle}</a>
          <a href={site.author.links.booth} target="_blank" rel="noopener noreferrer"
            class="text-xs text-slate-500 hover:text-slate-700 hover:underline">BOOTH</a>
          <a href={site.author.links.youtube} target="_blank" rel="noopener noreferrer"
            class="text-xs text-slate-500 hover:text-slate-700 hover:underline">YouTube</a>
        </div>
      </div>
      <p class="text-xs text-slate-500">{site.author.bio}</p>
    </div>
  </footer>
```

- [ ] **Step 2: ビルドを確認する**

```bash
npm run build
```
Expected: エラーなし

- [ ] **Step 3: 開発サーバーで目視確認する**

```bash
npm run dev
```
スマホ幅で、1行目にアイコン＋名前＋SNSリンク、2行目にbio全文が折り返し表示されること。PC幅では従来通り1行レイアウトのままであることを確認する。

- [ ] **Step 4: コミットする**

```bash
git add src/routes/+layout.svelte
git commit -m "feat: フッターをスマホ表示では2段組みにする"
```

---

## Task 6: CLAUDE.mdに規約を追記する

**Files:**
- Modify: `CLAUDE.md`

- [ ] **Step 1: 「新しいツール（ページ）の追加」セクションの前に新セクションを追加する**

`CLAUDE.md` の `## 新しいツール（ページ）の追加` の直前に以下を追加する：

```markdown
## カテゴリー構成の変更

`src/lib/site.ts` の `categories` 配列にカテゴリーを追加・削除・ラベル変更した場合、`src/lib/navWidth.ts` 内の定数（`CHAR_WIDTH_PX`・`LOGO_WIDTH_PX` など）がナビの実測幅とズレていないか確認する。

ズレが疑われる場合は、`npm run dev` で実際のスマホ・PC切り替わり幅をブラウザの開発者ツールで確認し、`src/lib/navWidth.ts` の定数を調整する。

なお、`/admin/menu` でのツール表示/非表示切り替え（カテゴリーが減る方向のみ）は、次回ビルド時に必要幅が自動的に再計算されるため、この対応は不要。

## 新しいツール（ページ）の追加
```

- [ ] **Step 2: コミットする**

```bash
git add CLAUDE.md
git commit -m "docs: カテゴリー構成変更時のブレークポイント再計測の規約を追記"
```

---

## Task 7: 最終確認

- [ ] **Step 1: 全体ビルドを確認する**

```bash
npm run build
```
Expected: エラーなし

- [ ] **Step 2: 開発サーバーで最終動作確認する**

```bash
npm run dev
```

以下をブラウザで確認する：

- スマホ幅（375px）: ヘッダー1行収まり・ハンバーガーメニュー動作・下部ピルバー非表示・フッター2段組み
- 計算されたブレークポイント付近: PC版⇔スマホ版が正しく切り替わる（崩れがない）
- PC幅（1024px以上）: 従来のレイアウトと見た目が変わっていない
- 任意のツールページ（例: `/music/bpm-tapper`）とトップページ（`/`）の両方でヘッダー表示を確認する

ビルドエラーや画面の崩れがあれば、ここで修正してから完了とする。
