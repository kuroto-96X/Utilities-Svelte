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
              role="none"
              onclick={(e) => e.stopPropagation()}
              onkeydown={(e) => e.stopPropagation()}
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
