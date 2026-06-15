<script lang="ts">
  import '../app.css'
  import siteIcon from '$lib/assets/site_icon.png'
  import authorIcon from '$lib/assets/96x_icon.png'
  import { page } from '$app/state'
  import { site } from '$lib/site'

  let { children } = $props()
  let routeId = $derived(page.route.id)
</script>

<svelte:head>
  <link rel="icon" href={siteIcon} />
</svelte:head>

<div class="gradient-bg flex flex-col">
  <header class="sticky top-0 z-10 border-b border-slate-200 bg-white shadow-sm">
    <nav class="max-w-4xl mx-auto px-4 py-2.5 flex items-center gap-6">
      <a
        href="/"
        class="font-extrabold text-lg tracking-tight mr-2 bg-gradient-to-r from-teal-700 to-sky-600 bg-clip-text text-transparent"
      >
        {site.name}
      </a>
      {#each site.tools.filter(t => t.visible) as tool (tool.href)}
        {@const active = routeId === tool.href}
        <a
          href={tool.href}
          class="text-sm font-medium transition-colors border-b-2 pb-0.5"
          class:text-teal-700={active}
          class:font-semibold={active}
          class:border-teal-700={active}
          class:text-slate-500={!active}
          class:border-transparent={!active}
        >
          {tool.label}
        </a>
      {/each}
    </nav>
  </header>

  <main class="flex-1">
    {@render children()}
  </main>

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
