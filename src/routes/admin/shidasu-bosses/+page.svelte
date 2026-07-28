<script lang="ts">
  import { onMount, onDestroy } from 'svelte'
  import { DEFAULT_PARAMS, type ShidasuParams } from '$lib/game/shidasu/params'
  import { starsInSlot } from '$lib/game/shidasu/bosses'
  import { SIN_DAUGHTERS } from '$lib/game/shidasu/sinDaughters'
  import { STAR_RESTRICTION_ACTUAL_EFFECTS } from '$lib/game/shidasu/bossActualEffects'

  let config = $state<ShidasuParams | null>(null)
  let error = $state<string | null>(null)
  let flash = $state<string | null>(null)
  let flashTimer: ReturnType<typeof setTimeout> | null = null

  function showToast(message: string) {
    if (flashTimer) clearTimeout(flashTimer)
    flash = message
    flashTimer = setTimeout(() => { flash = null }, 2000)
  }

  const WAVE_SLOTS: (1 | 2 | 3)[] = [1, 2, 3]
  const RESTRICTION_OPTIONS: ShidasuParams['stars'][number]['restrictionKind'][] = [
    'none', 'noLoop', 'faceLock', 'lowCombo', 'oddCombo', 'suit', 'face',
  ]

  let slotCounts = $derived.by(() => {
    if (!config) return { 1: 0, 2: 0, 3: 0 }
    return {
      1: starsInSlot(config, 1).length,
      2: starsInSlot(config, 2).length,
      3: starsInSlot(config, 3).length,
    }
  })

  let hasValidationError = $derived.by(() => {
    if (!config) return false
    if (slotCounts[1] === 0 || slotCounts[2] === 0 || slotCounts[3] === 0) return true
    return config.stars.some(star => {
      if (!star.name.trim()) return true
      if (star.restrictionKind === 'lowCombo' && !Number.isFinite(star.maxCombo)) return true
      return false
    })
  })

  function addStar() {
    if (!config) return
    config.stars.push({
      id: `star-${crypto.randomUUID()}`,
      name: '',
      waveSlot: 1,
      targetMultiplier: 1,
      reward: 0,
      restrictionKind: 'none',
    })
  }

  function removeStar(id: string) {
    if (!config) return
    config.stars = config.stars.filter(star => star.id !== id)
  }

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
  <title>Shidasu 星パラメータ設定</title>
</svelte:head>

<div class="max-w-5xl mx-auto px-4 py-8">
  <a href="/admin" class="text-xs text-slate-400 hover:text-teal-600 mb-4 inline-block">← 管理ページ一覧</a>

  <div class="flex items-center justify-between mb-6">
    <h1 class="text-2xl font-bold text-slate-800">星詠みソリティア -Shidasu- 星パラメータ設定</h1>
    <div class="flex gap-2">
      <button onclick={() => loadConfig(true)} class="text-sm px-3 py-1.5 rounded-lg border border-slate-200 text-slate-600 hover:bg-slate-50 transition-colors">
        リロード
      </button>
      {#if hasValidationError}
        <p class="text-xs text-red-600 self-center">星名が空、lowCombo制限でmaxComboが未入力、またはいずれかのWaveスロットの星数が0件です</p>
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
    <div class="flex gap-4 mb-4 text-xs text-slate-500">
      <span class={slotCounts[1] === 0 ? 'text-red-600 font-bold' : ''}>Wave1: {slotCounts[1]}件</span>
      <span class={slotCounts[2] === 0 ? 'text-red-600 font-bold' : ''}>Wave2: {slotCounts[2]}件</span>
      <span class={slotCounts[3] === 0 ? 'text-red-600 font-bold' : ''}>Wave3: {slotCounts[3]}件</span>
    </div>

    <section class="bg-white border border-slate-200 rounded-xl p-4">
      <div class="overflow-x-auto">
        <table class="w-full text-xs border border-slate-200 rounded-lg overflow-hidden">
          <thead>
            <tr class="bg-slate-50 text-slate-500">
              <th class="px-2 py-1.5 text-left" style="width:5rem;">Wave</th>
              <th class="px-2 py-1.5 text-left" style="width:9rem;">名前</th>
              <th class="px-2 py-1.5 text-left" style="width:6rem;">倍率</th>
              <th class="px-2 py-1.5 text-left" style="width:6rem;">報酬</th>
              <th class="px-2 py-1.5 text-left" style="width:8rem;">制限種別</th>
              <th class="px-2 py-1.5 text-left" style="width:6rem;">maxCombo</th>
              <th class="px-2 py-1.5 text-left" style="width:16rem;">実際の効果(監査用)</th>
              <th class="px-2 py-1.5 text-left" style="width:3rem;"></th>
            </tr>
          </thead>
          <tbody class="divide-y divide-slate-100">
            {#each config.stars as star, i (star.id)}
              <tr>
                <td class="px-2 py-1.5 align-top">
                  <select bind:value={star.waveSlot} class="w-full border border-slate-200 rounded px-1.5 py-0.5">
                    {#each WAVE_SLOTS as slot (slot)}
                      <option value={slot}>{slot}</option>
                    {/each}
                  </select>
                </td>
                <td class="px-2 py-1.5 align-top">
                  <input type="text" bind:value={star.name} list="sin-daughter-names" class="w-full border border-slate-200 rounded px-1.5 py-0.5" />
                </td>
                <td class="px-2 py-1.5 align-top">
                  <input type="number" step="any" bind:value={star.targetMultiplier} class="w-full border border-slate-200 rounded px-1.5 py-0.5" />
                </td>
                <td class="px-2 py-1.5 align-top">
                  <input type="number" step="any" bind:value={star.reward} class="w-full border border-slate-200 rounded px-1.5 py-0.5" />
                </td>
                <td class="px-2 py-1.5 align-top">
                  <select bind:value={star.restrictionKind} class="w-full border border-slate-200 rounded px-1.5 py-0.5">
                    {#each RESTRICTION_OPTIONS as kind (kind)}
                      <option value={kind}>{kind}</option>
                    {/each}
                  </select>
                </td>
                <td class="px-2 py-1.5 align-top">
                  {#if star.restrictionKind === 'lowCombo'}
                    <input type="number" step="1" bind:value={star.maxCombo} class="w-full border border-slate-200 rounded px-1.5 py-0.5" />
                  {:else}
                    <span class="text-slate-300">-</span>
                  {/if}
                </td>
                <td class="px-2 py-1.5 align-top text-slate-500">
                  {star.restrictionKind === 'none' ? '-' : STAR_RESTRICTION_ACTUAL_EFFECTS[star.restrictionKind]}
                </td>
                <td class="px-2 py-1.5 align-top">
                  <button
                    onclick={() => removeStar(star.id)}
                    class="text-red-500 hover:text-red-700 text-[11px]"
                    aria-label={`星${i + 1}を削除`}
                  >
                    削除
                  </button>
                </td>
              </tr>
            {/each}
          </tbody>
        </table>
      </div>
      <button
        onclick={addStar}
        class="mt-3 text-sm px-3 py-1.5 rounded-lg border border-slate-200 text-slate-600 hover:bg-slate-50 transition-colors"
      >
        + 星を追加
      </button>
    </section>
  {:else if !error}
    <p class="text-slate-500 text-sm">読み込み中...</p>
  {/if}
</div>

<datalist id="sin-daughter-names">
  {#each SIN_DAUGHTERS as daughter (daughter.name)}
    <option value={daughter.name}>{daughter.name}({daughter.parentSin})</option>
  {/each}
</datalist>

{#if flash}
  <div class="fixed bottom-6 right-6 bg-slate-800 text-white text-sm px-4 py-2.5 rounded-lg shadow-lg z-50">
    {flash}
  </div>
{/if}
