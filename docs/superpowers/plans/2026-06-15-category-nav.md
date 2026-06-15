# カテゴリーナビゲーション Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** ツールをカテゴリー分けし、ナビにドロップダウン・フッター直上にカテゴリーバーを追加する。

**Architecture:** `site.ts` に `categories` 配列と各ツールへの `category` フィールドを追加し、`+layout.svelte` でカテゴリーナビ／ドロップダウン／カテゴリーバーを実装、`+page.svelte` でカテゴリーグループ表示に切り替える。UI変更のみでロジックは単純なフィルタリング。

**Tech Stack:** SvelteKit 2、Svelte 5 runes（`$state`、`$derived`）、Tailwind CSS v3、TypeScript

---

## ファイル構成

| ファイル | 変更内容 |
|---|---|
| `src/lib/site.ts` | `categories` 配列追加、各ツールに `category` フィールド追加 |
| `src/routes/+layout.svelte` | カテゴリーナビ・ドロップダウン・カテゴリーバー実装 |
| `src/routes/+page.svelte` | カテゴリーグループ表示に変更 |

---

## Task 1: site.ts にカテゴリー定義を追加

**Files:**
- Modify: `src/lib/site.ts`

- [ ] **Step 1: `src/lib/site.ts` を以下の内容に置き換える**

```typescript
export const site = {
  name: "96X's Tools",
  tagline: "個人開発ツール集",
  author: {
    name: "96X",
    handle: "@96X_SBRB",
    bio: "ゲーム開発と楽曲制作の合間に、自分が欲しかった『ちょっとした道具』を作って置いています。",
    links: {
      x: "https://x.com/96X_SBRB",
      booth: "https://kogatagemmaipan.booth.pm/",
      youtube: "https://www.youtube.com/@96X%E3%81%93%E3%81%8C%E3%81%9F%E7%8E%84%E7%B1%B3%E3%83%91%E3%83%B3",
    },
  },
  categories: [
    { id: 'music',       label: '楽曲制作' },
    { id: 'programming', label: 'プログラミング' },
    { id: 'image',       label: '画像' },
    { id: 'investment',  label: '投資' },
  ],
  tools: [
    {
      href: "/bpm-tapper",
      label: "BPM Tapper",
      description: "タップしてBPMを計測するツール",
      visible: true,
      category: 'music',
    },
    {
      href: "/hepburn-converter",
      label: "ヘボン式変換",
      description: "日本語をヘボン式ローマ字に変換するツール",
      visible: true,
      category: 'programming',
    },
    {
      href: "/image-tools",
      label: "画像変換(開発中)",
      description: "画像の圧縮・リサイズ・形式変換ツール",
      visible: false,
      category: 'image',
    },
    {
      href: "/sns-image-resize",
      label: "SNS画像リサイズ(開発中)",
      description: "SNS各サービスの推奨サイズにワンクリックでリサイズ・クロップするツール",
      visible: true,
      category: 'image',
    },
    {
      href: "/id-photo",
      label: "証明写真(開発中)",
      description: "証明写真・履歴書用写真のサイズ調整とコンビニ印刷用シート作成ツール",
      visible: true,
      category: 'image',
    },
    {
      href: "/nisa-simple-calculator",
      label: "NISA年率計算(開発中)",
      description: "NISAの損益率から運用年率を逆算するツール",
      visible: true,
      category: 'investment',
    },
    {
      href: "/nisa-accumulation-simulator",
      label: "NISA積立シミュレーター(開発中)",
      description: "毎月・毎年の積立投資の将来評価額と資産推移をシミュレーションするツール",
      visible: true,
      category: 'investment',
    },
  ],
} as const
```

- [ ] **Step 2: ビルドが通ることを確認**

```bash
npm run build
```

Expected: `✔ done` （エラーなし）

- [ ] **Step 3: コミット**

```bash
git add src/lib/site.ts
git commit -m "feat: site.ts にカテゴリー定義とカテゴリーフィールドを追加"
```

---

## Task 2: +layout.svelte をカテゴリーナビに更新

**Files:**
- Modify: `src/routes/+layout.svelte`

現在の `+layout.svelte` は `site.tools` を直接ループしてツールリンクを並べている。これをカテゴリー単位のドロップダウンナビに置き換える。フッター直上にカテゴリーバーも追加する。

- [ ] **Step 1: `src/routes/+layout.svelte` を以下の内容に置き換える**

```svelte
<script lang="ts">
  import '../app.css'
  import siteIcon from '$lib/assets/site_icon.png'
  import authorIcon from '$lib/assets/96x_icon.png'
  import { page } from '$app/state'
  import { site } from '$lib/site'

  let { children } = $props()
  let routeId = $derived(page.route.id)

  // 現在ページが属するカテゴリー id（ツールページ以外は null）
  let activeCategory = $derived(
    (site.tools as unknown as Array<{ href: string; category: string }>)
      .find(t => t.href === routeId)?.category ?? null
  )

  // visible:true のツールが1件以上あるカテゴリーのみ表示
  const visibleCategories = site.categories.filter(cat =>
    (site.tools as unknown as Array<{ category: string; visible: boolean }>)
      .some(t => t.category === cat.id && t.visible)
  )

  // 現在カテゴリーの visible ツール一覧（カテゴリーバー用）
  let activeCategoryTools = $derived(
    activeCategory !== null
      ? (site.tools as unknown as Array<{ href: string; label: string; category: string; visible: boolean }>)
          .filter(t => t.category === activeCategory && t.visible)
      : []
  )

  // カテゴリーバーに表示するカテゴリーラベル
  let activeCategoryLabel = $derived(
    (site.categories as unknown as Array<{ id: string; label: string }>)
      .find(c => c.id === activeCategory)?.label ?? ''
  )

  // 開いているドロップダウンのカテゴリー id
  let openCategory = $state<string | null>(null)
</script>

<svelte:window onclick={() => { openCategory = null }} />

<svelte:head>
  <link rel="icon" href={siteIcon} />
</svelte:head>

<div class="gradient-bg flex flex-col">
  <header class="sticky top-0 z-10 border-b border-slate-200 bg-white shadow-sm">
    <nav class="max-w-4xl mx-auto px-4 py-2.5 flex items-center gap-1">
      <a
        href="/"
        class="font-extrabold text-lg tracking-tight mr-4 bg-gradient-to-r from-teal-700 to-sky-600 bg-clip-text text-transparent"
      >
        {site.name}
      </a>
      {#each visibleCategories as cat (cat.id)}
        {@const isActive = cat.id === activeCategory}
        {@const isOpen = openCategory === cat.id}
        {@const catTools = (site.tools as unknown as Array<{ href: string; label: string; category: string; visible: boolean }>).filter(t => t.category === cat.id && t.visible)}
        <div class="relative">
          <button
            type="button"
            onclick={(e) => { e.stopPropagation(); openCategory = isOpen ? null : cat.id }}
            class="text-sm font-medium px-2 py-1 rounded transition-colors border-b-2"
            class:text-teal-700={isActive}
            class:font-semibold={isActive}
            class:border-teal-700={isActive}
            class:text-slate-500={!isActive}
            class:border-transparent={!isActive}
            class:hover:text-slate-700={!isActive}
          >
            {cat.label}
          </button>

          {#if isOpen}
            <div
              class="absolute top-full left-0 mt-1.5 bg-white border border-slate-200 rounded-xl shadow-lg py-1.5 z-20 min-w-[160px]"
              onclick={(e) => e.stopPropagation()}
            >
              <p class="px-3 pt-1 pb-1.5 text-[10px] font-bold uppercase tracking-wider text-slate-400">
                {cat.label}
              </p>
              {#each catTools as tool (tool.href)}
                {@const isCurrent = routeId === tool.href}
                <a
                  href={tool.href}
                  onclick={() => { openCategory = null }}
                  class="flex items-center gap-2 px-3 py-1.5 text-sm transition-colors"
                  class:text-teal-700={isCurrent}
                  class:font-semibold={isCurrent}
                  class:bg-teal-50={isCurrent}
                  class:text-slate-600={!isCurrent}
                  class:hover:bg-slate-50={!isCurrent}
                >
                  <span
                    class="w-1.5 h-1.5 rounded-full shrink-0"
                    class:bg-teal-700={isCurrent}
                  ></span>
                  {tool.label}
                </a>
              {/each}
            </div>
          {/if}
        </div>
      {/each}
    </nav>
  </header>

  <main class="flex-1">
    {@render children()}
  </main>

  {#if activeCategory !== null && activeCategoryTools.length >= 2}
    <div class="border-t border-slate-200 bg-white">
      <div class="max-w-4xl mx-auto px-4 py-2 flex items-center gap-2 flex-wrap">
        <span class="text-xs font-semibold text-slate-400 shrink-0">
          {activeCategoryLabel}
        </span>
        <span class="text-slate-300 text-xs shrink-0">|</span>
        {#each activeCategoryTools as tool (tool.href)}
          {@const isCurrent = routeId === tool.href}
          <a
            href={tool.href}
            class="text-xs px-2.5 py-0.5 rounded-full border transition-colors"
            class:bg-teal-50={isCurrent}
            class:text-teal-700={isCurrent}
            class:border-teal-200={isCurrent}
            class:font-semibold={isCurrent}
            class:bg-white={!isCurrent}
            class:text-slate-500={!isCurrent}
            class:border-slate-200={!isCurrent}
            class:hover:border-slate-300={!isCurrent}
          >
            {tool.label}
          </a>
        {/each}
      </div>
    </div>
  {/if}

  <footer class="border-t border-slate-200 bg-white">
    <div class="max-w-4xl mx-auto px-4 py-5 flex items-start justify-between gap-6">
      <div class="flex items-start gap-3">
        <img
          src={authorIcon}
          alt={site.author.name}
          class="w-10 h-10 rounded-full object-cover shrink-0"
        />
        <div>
          <p class="text-sm font-bold text-slate-800">{site.author.name}</p>
          <p class="text-xs text-slate-500 mt-0.5 max-w-sm">{site.author.bio}</p>
          <div class="flex flex-wrap items-center gap-x-3 gap-y-1 mt-1.5">
            <a
              href={site.author.links.x}
              target="_blank"
              rel="noopener noreferrer"
              class="text-xs text-sky-600 hover:underline"
            >{site.author.handle}</a>
            <a
              href={site.author.links.booth}
              target="_blank"
              rel="noopener noreferrer"
              class="text-xs text-slate-500 hover:text-slate-700 hover:underline"
            >BOOTH</a>
            <a
              href={site.author.links.youtube}
              target="_blank"
              rel="noopener noreferrer"
              class="text-xs text-slate-500 hover:text-slate-700 hover:underline"
            >YouTube</a>
          </div>
        </div>
      </div>
      <p class="text-xs text-slate-400 shrink-0 mt-1">{site.tagline}</p>
    </div>
  </footer>
</div>
```

- [ ] **Step 2: ビルドが通ることを確認**

```bash
npm run build
```

Expected: `✔ done` （エラーなし）

- [ ] **Step 3: 動作確認**

`npm run dev` を起動し http://localhost:5173 を開く。

確認項目:
- [ ] ナビにカテゴリー名（楽曲制作・プログラミング・画像・投資）が表示される
- [ ] カテゴリー名をクリックするとドロップダウンが開き、該当ツールの一覧が出る
- [ ] 現在ページのツールがティール色＋ドットでハイライトされる
- [ ] ドロップダウン外をクリックすると閉じる
- [ ] ツールページを開いたときフッター直上にカテゴリーバーが1行で表示される
- [ ] カテゴリーバーで現在ページのピルがティール強調される
- [ ] トップページ（/）ではカテゴリーバーが表示されない

- [ ] **Step 4: コミット**

```bash
git add src/routes/+layout.svelte
git commit -m "feat: ナビをカテゴリードロップダウンに変更・フッター上カテゴリーバーを追加"
```

---

## Task 3: +page.svelte をカテゴリーグループ表示に変更

**Files:**
- Modify: `src/routes/+page.svelte`

現在は全ツールをフラットなグリッドで表示している。カテゴリーごとにグループ見出し付きで表示する。

- [ ] **Step 1: `src/routes/+page.svelte` を以下の内容に置き換える**

```svelte
<script lang="ts">
  import { site } from '$lib/site'

  const visibleCategories = site.categories.filter(cat =>
    (site.tools as unknown as Array<{ category: string; visible: boolean }>)
      .some(t => t.category === cat.id && t.visible)
  )
</script>

<svelte:head>
  <title>{site.name}</title>
</svelte:head>

<div class="max-w-4xl mx-auto px-4 py-12">
  <h1 class="text-4xl font-extrabold tracking-tight bg-gradient-to-r from-teal-700 to-sky-600 bg-clip-text text-transparent mb-3">
    {site.name}
  </h1>
  <p class="text-sm text-slate-500 mb-10">{site.tagline}</p>

  <div class="space-y-10">
    {#each visibleCategories as cat (cat.id)}
      {@const catTools = (site.tools as unknown as Array<{ href: string; label: string; description: string; category: string; visible: boolean }>).filter(t => t.category === cat.id && t.visible)}
      <div>
        <h2 class="text-xs font-bold uppercase tracking-wider text-slate-400 mb-3">
          {cat.label}
        </h2>
        <div class="grid grid-cols-1 sm:grid-cols-2 gap-4">
          {#each catTools as tool (tool.href)}
            <a
              href={tool.href}
              class="block p-6 bg-white border border-slate-200 rounded-xl shadow-sm hover:border-teal-700/40 hover:shadow-md hover:-translate-y-0.5 transition-all duration-200"
            >
              <h3 class="text-lg font-bold text-slate-800 mb-1">{tool.label}</h3>
              <p class="text-sm text-slate-500">{tool.description}</p>
              <p class="text-teal-700 mt-3 text-sm" aria-hidden="true">→</p>
            </a>
          {/each}
        </div>
      </div>
    {/each}
  </div>
</div>
```

- [ ] **Step 2: ビルドが通ることを確認**

```bash
npm run build
```

Expected: `✔ done` （エラーなし）

- [ ] **Step 3: 動作確認**

http://localhost:5173 のトップページを確認。

確認項目:
- [ ] ツールが「楽曲制作」「プログラミング」「画像」「投資」のグループ見出しつきで表示される
- [ ] `visible: false` のツール（画像変換）は表示されない
- [ ] visible なツールが0件のカテゴリーは表示されない

- [ ] **Step 4: コミット**

```bash
git add src/routes/+page.svelte
git commit -m "feat: トップページのツール一覧をカテゴリーグループ表示に変更"
```
