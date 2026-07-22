<script lang="ts">
  import { onMount, onDestroy } from 'svelte'
  import { DEFAULT_PARAMS, type ShidasuParams } from '$lib/game/shidasu/params'
  import { bossDesc, bossesInTier, BOSS_KINDS } from '$lib/game/shidasu/bosses'
  import { SIN_DAUGHTERS } from '$lib/game/shidasu/sinDaughters'
  import { BOSS_ACTUAL_EFFECTS } from '$lib/game/shidasu/bossActualEffects'
  import type { BossKind, BossTierKey } from '$lib/game/shidasu/types'

  let config = $state<ShidasuParams | null>(null)
  let error = $state<string | null>(null)
  let flash = $state<string | null>(null)
  let flashTimer: ReturnType<typeof setTimeout> | null = null

  function showToast(message: string) {
    if (flashTimer) clearTimeout(flashTimer)
    flash = message
    flashTimer = setTimeout(() => { flash = null }, 2000)
  }

  const TIER_LABELS: Record<BossTierKey, string> = { shoukyou: '小凶', chuukyou: '中凶', taikyou: '大凶' }
  const TIER_OPTIONS: BossTierKey[] = ['shoukyou', 'chuukyou', 'taikyou']

  type BossEntry = { name: string; tier: BossTierKey; desc: string } & Record<string, number | string>

  function bossEntry(kind: BossKind): BossEntry {
    return config!.bosses[kind] as unknown as BossEntry
  }

  function bossParamKeys(kind: BossKind): string[] {
    return Object.keys(bossEntry(kind)).filter(key => key !== 'name' && key !== 'desc' && key !== 'tier')
  }

  let tierCounts = $derived.by(() => {
    if (!config) return { shoukyou: 0, chuukyou: 0, taikyou: 0 }
    return {
      shoukyou: bossesInTier(config, 'shoukyou').length,
      chuukyou: bossesInTier(config, 'chuukyou').length,
      taikyou: bossesInTier(config, 'taikyou').length,
    }
  })

  let hasValidationError = $derived.by(() => {
    if (!config) return false
    if (tierCounts.shoukyou === 0 || tierCounts.chuukyou === 0 || tierCounts.taikyou === 0) return true
    return BOSS_KINDS.some(kind => {
      const entry = bossEntry(kind)
      if (!entry.name.trim()) return true
      if (!entry.desc.trim()) return true
      return bossParamKeys(kind).some(key => !Number.isFinite(entry[key] as number))
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
  <title>Shidasu ボス候補パラメータ設定</title>
</svelte:head>

<div class="max-w-5xl mx-auto px-4 py-8">
  <a href="/admin" class="text-xs text-slate-400 hover:text-teal-600 mb-4 inline-block">← 管理ページ一覧</a>

  <div class="flex items-center justify-between mb-6">
    <h1 class="text-2xl font-bold text-slate-800">星詠みソリティア -Shidasu- ボス候補パラメータ設定</h1>
    <div class="flex gap-2">
      <button onclick={() => loadConfig(true)} class="text-sm px-3 py-1.5 rounded-lg border border-slate-200 text-slate-600 hover:bg-slate-50 transition-colors">
        リロード
      </button>
      {#if hasValidationError}
        <p class="text-xs text-red-600 self-center">ボス名・説明文が空、パラメータが未入力、またはいずれかの階級の候補数が0件です</p>
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
      <span class={tierCounts.shoukyou === 0 ? 'text-red-600 font-bold' : ''}>小凶: {tierCounts.shoukyou}件</span>
      <span class={tierCounts.chuukyou === 0 ? 'text-red-600 font-bold' : ''}>中凶: {tierCounts.chuukyou}件</span>
      <span class={tierCounts.taikyou === 0 ? 'text-red-600 font-bold' : ''}>大凶: {tierCounts.taikyou}件</span>
    </div>

    <section class="bg-white border border-slate-200 rounded-xl p-4">
      <div class="overflow-x-auto">
        <table class="w-full text-xs border border-slate-200 rounded-lg overflow-hidden">
          <thead>
            <tr class="bg-slate-50 text-slate-500">
              <th class="px-2 py-1.5 text-left" style="width:6rem;">階級</th>
              <th class="px-2 py-1.5 text-left" style="width:9rem;">名前</th>
              <th class="px-2 py-1.5 text-left" style="width:9rem;">パラメータ</th>
              <th class="px-2 py-1.5 text-left" style="width:14rem;">説明文テンプレート</th>
              <th class="px-2 py-1.5 text-left" style="width:14rem;">プレビュー</th>
              <th class="px-2 py-1.5 text-left" style="width:20rem;">実際の効果(監査用)</th>
            </tr>
          </thead>
          <tbody class="divide-y divide-slate-100">
            {#each BOSS_KINDS as kind (kind)}
              {@const entry = bossEntry(kind)}
              <tr>
                <td class="px-2 py-1.5 align-top">
                  <select bind:value={entry.tier} class="w-full border border-slate-200 rounded px-1.5 py-0.5">
                    {#each TIER_OPTIONS as tierKey (tierKey)}
                      <option value={tierKey}>{TIER_LABELS[tierKey]}</option>
                    {/each}
                  </select>
                </td>
                <td class="px-2 py-1.5 align-top">
                  <select bind:value={entry.name} class="w-full border border-slate-200 rounded px-1.5 py-0.5">
                    {#each SIN_DAUGHTERS as daughter (daughter.name)}
                      <option value={daughter.name}>{daughter.name}({daughter.parentSin})</option>
                    {/each}
                  </select>
                </td>
                <td class="px-2 py-1.5 align-top">
                  <div class="flex flex-wrap gap-1.5">
                    {#each bossParamKeys(kind) as key (key)}
                      <label class="flex items-center gap-1 text-[11px] text-slate-500">
                        {key}
                        <input type="number" step="any" bind:value={entry[key]} class="w-16 border border-slate-200 rounded px-1 py-0.5" />
                      </label>
                    {/each}
                    {#if bossParamKeys(kind).length === 0}
                      <span class="text-slate-300">-</span>
                    {/if}
                  </div>
                </td>
                <td class="px-2 py-1.5 align-top">
                  <textarea
                    bind:value={entry.desc}
                    rows="3"
                    class="w-full border border-slate-200 rounded px-1.5 py-0.5 font-mono text-[11px] resize-y"
                  ></textarea>
                </td>
                <td class="px-2 py-1.5 align-top text-slate-500">{bossDesc(kind, config)}</td>
                <td class="px-2 py-1.5 align-top text-slate-500">{BOSS_ACTUAL_EFFECTS[kind]}</td>
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
