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
