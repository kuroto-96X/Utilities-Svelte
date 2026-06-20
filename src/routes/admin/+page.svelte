<script lang="ts">
  import { onMount, onDestroy } from 'svelte'
  import { site } from '$lib/site'

  type Config = {
    toolLabels: Record<string, string>
    toolVisibility: Record<string, boolean>
  }

  let config = $state<Config | null>(null)
  let error = $state<string | null>(null)
  let flash = $state<string | null>(null)
  let flashTimer: ReturnType<typeof setTimeout> | null = null

  onMount(async () => {
    try {
      const res = await fetch('/api/admin/config')
      if (!res.ok) throw new Error(`HTTP ${res.status}`)
      config = await res.json() as Config
    } catch {
      error = 'メニュー管理APIに接続できません。npm run dev で起動してください。'
    }
  })

  onDestroy(() => {
    if (flashTimer) clearTimeout(flashTimer)
  })

  async function save(): Promise<boolean> {
    if (!config) return false
    try {
      const res = await fetch('/api/admin/config', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(config)
      })
      if (!res.ok) throw new Error(`HTTP ${res.status}`)
      if (flashTimer) clearTimeout(flashTimer)
      flash = '保存しました'
      flashTimer = setTimeout(() => { flash = null }, 2000)
      return true
    } catch {
      error = '保存に失敗しました'
      return false
    }
  }

  async function toggle(href: string) {
    if (!config) return
    config.toolVisibility[href] = !config.toolVisibility[href]
    const ok = await save()
    if (!ok) config.toolVisibility[href] = !config.toolVisibility[href]
  }

  async function saveLabel(href: string, value: string) {
    if (!config) return
    const trimmed = value.trim()
    if (trimmed === '') {
      delete config.toolLabels[href]
    } else {
      config.toolLabels[href] = trimmed
    }
    await save()
  }
</script>

<div class="max-w-lg mx-auto px-4 py-8">
  <h1 class="text-2xl font-bold text-slate-800 mb-6">メニュー管理</h1>

  {#if error}
    <div class="bg-red-50 border border-red-200 text-red-700 px-4 py-3 rounded-lg mb-4">
      {error}
    </div>
  {/if}

  {#if flash}
    <div class="bg-teal-50 border border-teal-200 text-teal-700 px-4 py-3 rounded-lg mb-4">
      {flash}
    </div>
  {/if}

  {#if config}
    {#each site.categories as cat (cat.id)}
      {@const catTools = (site.tools as unknown as Array<{ href: string; label: string; category: string }>)
        .filter(t => t.category === cat.id)}
      {#if catTools.length > 0}
        <div class="mb-6">
          <h2 class="text-xs font-bold uppercase tracking-wider text-slate-400 mb-2">{cat.label}</h2>
          <div class="border border-slate-200 rounded-lg divide-y divide-slate-100">
            {#each catTools as tool (tool.href)}
              <div class="flex items-center gap-3 px-4 py-3 hover:bg-slate-50">
                <input
                  type="checkbox"
                  checked={config.toolVisibility[tool.href] ?? true}
                  onchange={() => toggle(tool.href)}
                  class="w-4 h-4 text-teal-600 rounded border-slate-300 shrink-0"
                />
                <input
                  type="text"
                  value={config.toolLabels[tool.href] ?? ''}
                  placeholder={tool.label}
                  onblur={(e) => saveLabel(tool.href, e.currentTarget.value)}
                  class="flex-1 text-sm text-slate-700 bg-transparent border-0 border-b border-transparent hover:border-slate-200 focus:border-teal-400 focus:outline-none py-0.5 min-w-0"
                />
                <span class="text-xs text-slate-400 shrink-0 font-mono">{tool.href}</span>
              </div>
            {/each}
          </div>
        </div>
      {/if}
    {/each}
  {:else if !error}
    <p class="text-slate-500 text-sm">読み込み中...</p>
  {/if}
</div>
