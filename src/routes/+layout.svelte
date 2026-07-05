<script lang="ts">
  import '../app.css'
  import siteIcon from '$lib/assets/site_icon.png'
  import authorIcon from '$lib/assets/96x_icon.png'
  import { page } from '$app/state'
  import { site } from '$lib/site'
  import siteConfig from '$lib/site.config.json'
  import { calculateRequiredNavWidthPx } from '$lib/navWidth'

  const isVisible = (href: string): boolean =>
    (siteConfig.toolVisibility as Record<string, boolean>)[href] ?? true

  const getLabel = (href: string, defaultLabel: string): string => {
    const label = (siteConfig.toolLabels as Record<string, string>)[href] ?? defaultLabel
    const isDev = (siteConfig.toolDevStatus as Record<string, boolean>)[href] ?? false
    return isDev ? `${label}(開発中)` : label
  }

  let { children } = $props()
  let routeId = $derived(page.route.id)

  // 現在ページが属するカテゴリー id（ツールページ以外は null）
  let activeCategory = $derived(
    (site.tools as unknown as Array<{ href: string; category: string }>)
      .find(t => t.href === routeId)?.category ?? null
  )

  // visible:true のツールが1件以上あるカテゴリーのみ表示
  const visibleCategories = site.categories.filter(cat =>
    (site.tools as unknown as Array<{ href: string; category: string }>)
      .some(t => t.category === cat.id && isVisible(t.href))
  )

  // スマホ表示に切り替える基準幅（表示中カテゴリーの組み合わせから自動計算）
  let breakpointPx = $derived(
    calculateRequiredNavWidthPx(visibleCategories.map(c => c.label))
  )

  // 現在カテゴリーの visible ツール一覧（カテゴリーバー用）
  let activeCategoryTools = $derived(
    activeCategory !== null
      ? (site.tools as unknown as Array<{ href: string; label: string; category: string }>)
          .filter(t => t.category === activeCategory && isVisible(t.href))
      : []
  )

  // カテゴリーバーに表示するカテゴリーラベル
  let activeCategoryLabel = $derived(
    (site.categories as unknown as Array<{ id: string; label: string }>)
      .find(c => c.id === activeCategory)?.label ?? ''
  )

  // 現在ページが開発中かどうか
  let isDevPage = $derived(
    routeId !== null &&
    ((siteConfig.toolDevStatus as Record<string, boolean>)[routeId] ?? false)
  )

  // 現在ページがメニュー非表示（toolVisibility: false）なツールの配下かどうか
  // （image-tools配下のサブページなど、site.tools未登録の子ルートにも継承させる）
  let isNoIndex = $derived(
    routeId !== null &&
    (site.tools as unknown as Array<{ href: string }>).some(
      t => (routeId === t.href || routeId!.startsWith(`${t.href}/`)) && !isVisible(t.href)
    )
  )

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
  // 最後に自動展開したカテゴリー（ユーザーの手動トグルを妨げないためのガード）
  let lastAutoExpandedCategory = $state<string | null>(null)

  // 現在ページのカテゴリーは初期状態で展開しておく
  $effect(() => {
    if (activeCategory !== null && activeCategory !== lastAutoExpandedCategory) {
      openMobileCategories = new Set([...openMobileCategories, activeCategory])
      lastAutoExpandedCategory = activeCategory
    }
  })

  function toggleMobileCategory(id: string) {
    const next = new Set(openMobileCategories)
    if (next.has(id)) next.delete(id)
    else next.add(id)
    openMobileCategories = next
  }

  function focusFirst(node: HTMLElement) {
    node.querySelector<HTMLElement>('a')?.focus()
  }
</script>

<svelte:window onclick={() => { openCategory = null; mobileMenuOpen = false }} />

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

<div class="gradient-bg flex flex-col sm:h-screen sm:overflow-hidden">
  <header class="sticky top-0 z-10 border-b border-slate-200 bg-white shadow-sm sm:flex-shrink-0">
    <nav class="rt-desktop-only max-w-4xl mx-auto px-4 py-2.5 flex items-center gap-1">
      <a
        href="/"
        class="font-extrabold text-lg tracking-tight mr-4 bg-gradient-to-r from-teal-700 to-sky-600 bg-clip-text text-transparent"
      >
        {site.name}
      </a>
      {#each visibleCategories as cat (cat.id)}
        {@const isActive = cat.id === activeCategory}
        {@const isOpen = openCategory === cat.id}
        {@const catTools = (site.tools as unknown as Array<{ href: string; label: string; category: string }>).filter(t => t.category === cat.id && isVisible(t.href))}
        <div class="relative">
          <button
            type="button"
            onclick={(e) => { e.stopPropagation(); openCategory = isOpen ? null : cat.id }}
            aria-haspopup="true"
            aria-expanded={isOpen}
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
              role="menu"
              tabindex="-1"
              use:focusFirst
              onclick={(e) => e.stopPropagation()}
              onkeydown={(e) => { if (e.key === 'Escape') { openCategory = null; e.stopPropagation() } }}
            >
              <p class="px-3 pt-1 pb-1.5 text-[10px] font-bold uppercase tracking-wider text-slate-400">
                {cat.label}
              </p>
              {#each catTools as tool (tool.href)}
                {@const isCurrent = routeId === tool.href}
                <a
                  role="menuitem"
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
                  {getLabel(tool.href, tool.label)}
                </a>
              {/each}
            </div>
          {/if}
        </div>
      {/each}
    </nav>

    <nav class="rt-mobile-only flex items-center gap-2 max-w-4xl mx-auto px-4 py-2.5 relative" aria-label="メニュー">
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
    </nav>
  </header>

  {#if isDevPage}
    <div class="bg-red-50 border-b border-red-200">
      <div class="max-w-4xl mx-auto px-4 py-2 flex items-start gap-2">
        <span class="text-red-500 text-sm font-bold shrink-0 mt-px">⚠</span>
        <p class="text-red-700 text-sm">
          このツールは現在開発中のため、計算結果や変換結果が正確でない場合があります。実際の用途では必ず別の手段でご確認ください。
        </p>
      </div>
    </div>
  {/if}

  <main class="flex-1 sm:min-h-0 sm:overflow-y-auto">
    {@render children()}
  </main>

  {#if activeCategory !== null && activeCategoryTools.length >= 1}
    <div class="rt-desktop-only border-t border-slate-200 bg-white sm:flex-shrink-0">
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
            {getLabel(tool.href, tool.label)}
          </a>
        {/each}
      </div>
    </div>
  {/if}

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
</div>
