<script lang="ts">
  import { onMount, onDestroy } from 'svelte'
  import { site } from '$lib/site'

  type Config = {
    toolLabels: Record<string, string>
    toolDevStatus: Record<string, boolean>
    toolVisibility: Record<string, boolean>
  }

  const tools = site.tools as unknown as Array<{ href: string; label: string; category: string }>

  let config = $state<Config | null>(null)
  let error = $state<string | null>(null)
  let flash = $state<string | null>(null)
  let flashTimer: ReturnType<typeof setTimeout> | null = null

  function showToast(message: string) {
    if (flashTimer) clearTimeout(flashTimer)
    flash = message
    flashTimer = setTimeout(() => { flash = null }, 2000)
  }

  async function loadConfig(toast = false) {
    try {
      const res = await fetch('/api/admin/config')
      if (!res.ok) throw new Error(`HTTP ${res.status}`)
      const data = await res.json() as Config
      // 設定値がない場合はデフォルト値で初期化する
      for (const tool of tools) {
        if (data.toolLabels[tool.href] === undefined) {
          data.toolLabels[tool.href] = tool.label
        }
        if (data.toolDevStatus[tool.href] === undefined) {
          data.toolDevStatus[tool.href] = false
        }
      }
      config = data
      error = null
      if (toast) showToast('リロードしました')
    } catch {
      error = 'メニュー管理APIに接続できません。npm run dev で起動してください。'
    }
  }

  onMount(() => loadConfig())

  onDestroy(() => {
    if (flashTimer) clearTimeout(flashTimer)
  })

  function toggle(href: string) {
    if (!config) return
    config.toolVisibility[href] = !config.toolVisibility[href]
  }

  async function save() {
    if (!config) return
    // デフォルト値と同じラベルおよびfalseの開発中フラグは保存しない
    const defaultLabels = Object.fromEntries(tools.map(t => [t.href, t.label]))
    const toPost: Config = {
      toolLabels: Object.fromEntries(
        Object.entries(config.toolLabels).filter(([k, v]) => v.trim() !== '' && v !== defaultLabels[k])
      ),
      toolDevStatus: Object.fromEntries(
        Object.entries(config.toolDevStatus).filter(([, v]) => v === true)
      ),
      toolVisibility: config.toolVisibility,
    }
    try {
      const res = await fetch('/api/admin/config', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(toPost)
      })
      if (!res.ok) throw new Error(`HTTP ${res.status}`)
      showToast('保存しました')
    } catch {
      error = '保存に失敗しました'
    }
  }
</script>

<div class="max-w-lg mx-auto px-4 py-8">
  <div class="flex items-center justify-between mb-6">
    <h1 class="text-2xl font-bold text-slate-800">メニュー管理</h1>
    <div class="flex gap-2">
      <button
        onclick={() => loadConfig(true)}
        class="text-sm px-3 py-1.5 rounded-lg border border-slate-200 text-slate-600 hover:bg-slate-50 transition-colors"
      >
        リロード
      </button>
      <button
        onclick={save}
        class="text-sm px-3 py-1.5 rounded-lg bg-teal-600 text-white hover:bg-teal-700 transition-colors"
      >
        保存
      </button>
    </div>
  </div>

  {#if error}
    <div class="bg-red-50 border border-red-200 text-red-700 px-4 py-3 rounded-lg mb-4">
      {error}
    </div>
  {/if}

  {#if config}
    {#each site.categories as cat (cat.id)}
      {@const catTools = tools.filter(t => t.category === cat.id)}
      {#if catTools.length > 0}
        <div class="mb-6">
          <h2 class="text-xs font-bold uppercase tracking-wider text-slate-400 mb-2">{cat.label}</h2>
          <div class="border border-slate-200 rounded-lg divide-y divide-slate-100">
            {#each catTools as tool (tool.href)}
              <div class="px-4 py-2.5 hover:bg-slate-50">
                <a href={tool.href} target="_blank" class="text-xs text-slate-400 font-mono mb-1.5 hover:text-teal-600 hover:underline inline-block">{tool.href}</a>
                <div class="flex items-center gap-3">
                  <input
                    type="checkbox"
                    checked={config.toolVisibility[tool.href] ?? true}
                    onchange={() => toggle(tool.href)}
                    class="w-4 h-4 text-teal-600 rounded border-slate-300 shrink-0"
                  />
                  <input
                    type="text"
                    bind:value={config.toolLabels[tool.href]}
                    class="flex-1 text-sm text-slate-700 bg-transparent border-0 border-b border-transparent hover:border-slate-200 focus:border-teal-400 focus:outline-none py-0.5 min-w-0"
                  />
                  <label class="flex items-center gap-1 shrink-0">
                    <input
                      type="checkbox"
                      bind:checked={config.toolDevStatus[tool.href]}
                      class="w-3.5 h-3.5 text-amber-500 rounded border-slate-300"
                    />
                    <span class="text-xs text-slate-500">開発中</span>
                  </label>
                </div>
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

{#if flash}
  <div class="fixed bottom-6 right-6 bg-slate-800 text-white text-sm px-4 py-2.5 rounded-lg shadow-lg z-50">
    {flash}
  </div>
{/if}
