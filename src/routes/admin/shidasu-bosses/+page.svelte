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

  // 管理画面用のdescTemplateプレビュー展開。suitは実行時ランダム抽選のため
  // 固定のプレースホルダー文字列で表示する(実際のスートは表示しない)。
  function previewDescTemplate(star: ShidasuParams['stars'][number]): string {
    if (!star.descTemplate) return ''
    const context: Record<string, string> = {}
    if (star.restrictionKind === 'lowCombo') context.maxCombo = String(star.maxCombo ?? 2)
    if (star.restrictionKind === 'suit') context.suit = '(抽選)'
    return star.descTemplate.replace(/\{(\w+)\}/g, (match, key) => (key in context ? context[key] : match))
  }

  type SortColumn = 'waveSlot' | 'name' | 'targetMultiplier' | 'reward' | 'restrictionKind'
  let sortColumn = $state<SortColumn | null>(null)
  let sortDirection = $state<'asc' | 'desc'>('asc')

  function toggleSort(column: SortColumn) {
    if (sortColumn === column) {
      sortDirection = sortDirection === 'asc' ? 'desc' : 'asc'
    } else {
      sortColumn = column
      sortDirection = 'asc'
    }
  }

  // 表示専用の並び替え済み配列。config.stars自体の順序は変更しない(保存時の
  // 意図しない差分を避けるため)。
  let sortedStars = $derived.by(() => {
    if (!config) return []
    if (!sortColumn) return config.stars
    const column = sortColumn
    const direction = sortDirection
    return [...config.stars].sort((a, b) => {
      const av = a[column]
      const bv = b[column]
      const cmp = typeof av === 'number' && typeof bv === 'number' ? av - bv : String(av).localeCompare(String(bv))
      return direction === 'asc' ? cmp : -cmp
    })
  })

  let slotCounts = $derived.by(() => {
    if (!config) return { 1: 0, 2: 0, 3: 0 }
    return {
      1: starsInSlot(config, 1).length,
      2: starsInSlot(config, 2).length,
      3: starsInSlot(config, 3).length,
    }
  })

  function starNameInvalid(star: ShidasuParams['stars'][number]): boolean {
    return !star.name.trim()
  }
  function starMaxComboInvalid(star: ShidasuParams['stars'][number]): boolean {
    return star.restrictionKind === 'lowCombo' && !Number.isFinite(star.maxCombo)
  }

  let hasValidationError = $derived.by(() => {
    if (!config) return false
    if (slotCounts[1] === 0 || slotCounts[2] === 0 || slotCounts[3] === 0) return true
    return config.stars.some(star => starNameInvalid(star) || starMaxComboInvalid(star))
  })

  function addStar() {
    if (!config) return
    config.stars.push({
      id: `star-${crypto.randomUUID()}`,
      name: '',
      waveSlot: 3,
      targetMultiplier: 2,
      reward: 5,
      restrictionKind: 'none',
      descTemplate: '',
    })
  }

  function removeStar(id: string) {
    if (!config) return
    config.stars = config.stars.filter(star => star.id !== id)
  }

  // Wave3(waveSlot 3)の全星のtargetMultiplier・rewardを一律2・5に上書きする。
  // 他のフィールド(名前・制限種別等)は変更しない。ローカルconfig stateの書き換えのみで、
  // 保存ボタンを押すまでAPIへは反映されない。
  function updateWave3Defaults() {
    if (!config) return
    for (const star of config.stars) {
      if (star.waveSlot === 3) {
        star.targetMultiplier = 2
        star.reward = 5
      }
    }
    showToast('Wave3の倍率・報酬を更新しました(保存ボタンで確定してください)')
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

<div class="max-w-none mx-auto px-4 py-8">
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
              <th class="px-2 py-1.5 text-left cursor-pointer select-none" style="width:5rem;" onclick={() => toggleSort('waveSlot')}>
                Wave{sortColumn === 'waveSlot' ? (sortDirection === 'asc' ? ' ▲' : ' ▼') : ''}
              </th>
              <th class="px-2 py-1.5 text-left cursor-pointer select-none" style="width:24rem;" onclick={() => toggleSort('name')}>
                名前{sortColumn === 'name' ? (sortDirection === 'asc' ? ' ▲' : ' ▼') : ''}
              </th>
              <th class="px-2 py-1.5 text-left cursor-pointer select-none" style="width:6rem;" onclick={() => toggleSort('targetMultiplier')}>
                倍率{sortColumn === 'targetMultiplier' ? (sortDirection === 'asc' ? ' ▲' : ' ▼') : ''}
              </th>
              <th class="px-2 py-1.5 text-left cursor-pointer select-none" style="width:6rem;" onclick={() => toggleSort('reward')}>
                報酬{sortColumn === 'reward' ? (sortDirection === 'asc' ? ' ▲' : ' ▼') : ''}
              </th>
              <th class="px-2 py-1.5 text-left cursor-pointer select-none" style="width:12rem;" onclick={() => toggleSort('restrictionKind')}>
                制限種別{sortColumn === 'restrictionKind' ? (sortDirection === 'asc' ? ' ▲' : ' ▼') : ''}
              </th>
              <th class="px-2 py-1.5 text-left" style="width:6rem;">maxCombo</th>
              <th class="px-2 py-1.5 text-left" style="width:36rem;">説明文テンプレート</th>
              <th class="px-2 py-1.5 text-left" style="width:36rem;">プレビュー</th>
              <th class="px-2 py-1.5 text-left" style="width:36rem;">実際の効果(監査用)</th>
              <th class="px-2 py-1.5 text-left" style="width:3rem;"></th>
            </tr>
          </thead>
          <tbody class="divide-y divide-slate-100">
            {#each sortedStars as star, i (star.id)}
              <tr>
                <td class="px-2 py-1.5 align-top">
                  <select bind:value={star.waveSlot} class="w-full border border-slate-200 rounded px-1.5 py-0.5">
                    {#each WAVE_SLOTS as slot (slot)}
                      <option value={slot}>{slot}</option>
                    {/each}
                  </select>
                </td>
                <td class="px-2 py-1.5 align-top">
                  <input type="text" bind:value={star.name} list="sin-daughter-names" class="w-full border rounded px-1.5 py-0.5 {starNameInvalid(star) ? 'border-red-400' : 'border-slate-200'}" />
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
                    <input type="number" step="1" bind:value={star.maxCombo} class="w-full border rounded px-1.5 py-0.5 {starMaxComboInvalid(star) ? 'border-red-400' : 'border-slate-200'}" />
                  {:else}
                    <span class="text-slate-300">-</span>
                  {/if}
                </td>
                <td class="px-2 py-1.5 align-top h-px">
                  <textarea bind:value={star.descTemplate} class="w-full h-full min-h-[2rem] border border-slate-200 rounded px-1.5 py-0.5 resize-none"></textarea>
                </td>
                <td class="px-2 py-1.5 align-top text-slate-500">
                  {previewDescTemplate(star) || '-'}
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
      <button
        onclick={updateWave3Defaults}
        class="mt-3 ml-2 text-sm px-3 py-1.5 rounded-lg border border-slate-200 text-slate-600 hover:bg-slate-50 transition-colors"
      >
        Wave3の倍率・報酬を一括更新(倍率2・報酬5)
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
