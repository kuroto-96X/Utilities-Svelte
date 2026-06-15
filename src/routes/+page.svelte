<script lang="ts">
  import { site } from '$lib/site'
</script>

<svelte:head>
  <title>{site.name}</title>
</svelte:head>

<div class="max-w-4xl mx-auto px-4 py-12">
  <h1 class="text-4xl font-extrabold tracking-tight bg-gradient-to-r from-teal-700 to-sky-600 bg-clip-text text-transparent mb-3">
    {site.name}
  </h1>
  <p class="text-sm text-slate-500 mb-10">{site.tagline}</p>

  <div class="grid grid-cols-1 sm:grid-cols-2 gap-4">
    {#each site.tools.filter(t => t.visible) as tool (tool.href)}
      <a
        href={tool.href}
        class="block p-6 bg-white border border-slate-200 rounded-xl shadow-sm hover:border-teal-700/40 hover:shadow-md hover:-translate-y-0.5 transition-all duration-200"
      >
        <h2 class="text-lg font-bold text-slate-800 mb-1">{tool.label}</h2>
        <p class="text-sm text-slate-500">{tool.description}</p>
        <p class="text-teal-700 mt-3 text-sm" aria-hidden="true">→</p>
      </a>
    {/each}
  </div>
</div>
