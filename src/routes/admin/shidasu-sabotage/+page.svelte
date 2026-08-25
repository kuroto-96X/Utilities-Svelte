<script lang="ts">
  import { onMount, onDestroy } from 'svelte'
  import { DEFAULT_PARAMS, type ShidasuParams } from '$lib/game/shidasu/params'
  import { SABOTAGE_POOL } from '$lib/game/shidasu/sabotage'
  import type { SabotageActionId } from '$lib/game/shidasu/types'

  let config = $state<ShidasuParams | null>(null)
  let error = $state<string | null>(null)
  let flash = $state<string | null>(null)
  let flashTimer: ReturnType<typeof setTimeout> | null = null

  function showToast(message: string) {
    if (flashTimer) clearTimeout(flashTimer)
    flash = message
    flashTimer = setTimeout(() => { flash = null }, 2000)
  }

  function sabotageEntry(id: SabotageActionId) {
    return config!.sabotageActions[id]
  }

  let hasValidationError = $derived.by(() => {
    if (!config) return false
    return SABOTAGE_POOL.some(id => {
      const entry = sabotageEntry(id)
      if (!entry.name.trim()) return true
      if (!entry.descTemplate.trim()) return true
      if (!Number.isInteger(entry.intervalTurns) || entry.intervalTurns <= 0) return true
      return false
    })
  })

  async function loadConfig(toast = false) {
    try {
      const res = await fetch('/api/admin/shidasu-config')
      if (!res.ok) throw new Error(`HTTP ${res.status}`)
      config = await res.json() as ShidasuParams
      error = null
      if (toast) showToast('リロードしました')
    } catch {
      error = 'Shidasu設定APIに接続できません。npm run dev で起動してください。'
      if (!config) config = JSON.parse(JSON.stringify(DEFAULT_PARAMS))
    }
  }

  async function save() {
    if (!config) return
    try {
      const res = await fetch('/api/admin/shidasu-config', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(config),
      })
      if (!res.ok) throw new Error(`HTTP ${res.status}`)
      showToast('保存しました(反映には再ビルド・再デプロイが必要です)')
    } catch {
      error = '保存に失敗しました'
    }
  }

  onMount(() => loadConfig())
  onDestroy(() => {
    if (flashTimer) clearTimeout(flashTimer)
  })
</script>

<svelte:head>
  <title>Shidasu 妨害行動設定</title>
</svelte:head>

<div class="max-w-6xl mx-auto px-4 py-8">
  <a href="/admin" class="text-xs text-slate-400 hover:text-teal-600 mb-4 inline-block">← 管理ページ一覧</a>

  <div class="flex items-center justify-between mb-6">
    <h1 class="text-2xl font-bold text-slate-800">星詠みソリティア -Shidasu- 妨害行動設定</h1>
    <div class="flex gap-2">
      <button onclick={() => loadConfig(true)} class="text-sm px-3 py-1.5 rounded-lg border border-slate-200 text-slate-600 hover:bg-slate-50 transition-colors">
        リロード
      </button>
      {#if hasValidationError}
        <p class="text-xs text-red-600 self-center">名前・説明文が未入力、または発動間隔ターン数が不正な項目があります</p>
      {/if}
      <button
        onclick={save}
        disabled={hasValidationError || !config}
        class="text-sm px-3 py-1.5 rounded-lg bg-teal-600 text-white hover:bg-teal-700 transition-colors disabled:opacity-40 disabled:cursor-not-allowed"
      >
        保存
      </button>
    </div>
  </div>

  {#if error}
    <div class="bg-red-50 border border-red-200 text-red-700 px-4 py-3 rounded-lg mb-4 text-sm">{error}</div>
  {/if}

  {#if config}
    <section class="bg-white border border-slate-200 rounded-xl p-4">
      <div class="overflow-x-auto">
        <table class="w-full text-xs border border-slate-200 rounded-lg overflow-hidden">
          <thead>
            <tr class="bg-slate-50 text-slate-500">
              <th class="px-2 py-1.5 text-left" style="width:10rem;">id</th>
              <th class="px-2 py-1.5 text-left" style="width:8rem;">表示名</th>
              <th class="px-2 py-1.5 text-left" style="width:6rem;">対象カテゴリ</th>
              <th class="px-2 py-1.5 text-left" style="width:6rem;">発動間隔(ターン)</th>
              <th class="px-2 py-1.5 text-left" style="width:24rem;">効果説明文</th>
            </tr>
          </thead>
          <tbody class="divide-y divide-slate-100">
            {#each SABOTAGE_POOL as id (id)}
              {@const entry = sabotageEntry(id)}
              <tr>
                <td class="px-2 py-1.5 align-top text-slate-400 font-mono">{id}</td>
                <td class="px-2 py-1.5 align-top">
                  <input type="text" bind:value={entry.name} class="w-full border border-slate-200 rounded px-1.5 py-0.5" />
                </td>
                <td class="px-2 py-1.5 align-top text-slate-500">{entry.target}</td>
                <td class="px-2 py-1.5 align-top">
                  <input type="number" step="1" min="1" bind:value={entry.intervalTurns} class="w-full border border-slate-200 rounded px-1 py-0.5" />
                </td>
                <td class="px-2 py-1.5 align-top">
                  <textarea bind:value={entry.descTemplate} rows="2" class="w-full border border-slate-200 rounded px-1.5 py-0.5 font-mono text-[11px] resize-y"></textarea>
                </td>
              </tr>
            {/each}
          </tbody>
        </table>
      </div>
    </section>
  {:else if !error}
    <p class="text-slate-500 text-sm">読み込み中...</p>
  {/if}
</div>

{#if flash}
  <div class="fixed bottom-6 right-6 bg-slate-800 text-white text-sm px-4 py-2.5 rounded-lg shadow-lg z-50">
    {flash}
  </div>
{/if}
