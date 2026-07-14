<script lang="ts">
  import { onMount, onDestroy } from 'svelte'
  import { DEFAULT_PARAMS, type ShidasuParams } from '$lib/game/shidasu/params'

  let config = $state<ShidasuParams | null>(null)
  let error = $state<string | null>(null)
  let flash = $state<string | null>(null)
  let flashTimer: ReturnType<typeof setTimeout> | null = null
  let jsonText = $state('')
  let jsonError = $state<string | null>(null)

  function showToast(message: string) {
    if (flashTimer) clearTimeout(flashTimer)
    flash = message
    flashTimer = setTimeout(() => { flash = null }, 2000)
  }

  let hasValidationError = $derived.by(() => {
    if (!config) return false
    if (config.stages.length < 1) return true
    for (const stage of config.stages) {
      if (stage.targets.some(t => !Number.isFinite(t) || t < 0)) return true
    }
    // 場札(cols×rows)配布後にfoundation用の1枚が残らないと山札が尽きてゲームが起動できない
    if (config.layout.cols < 1 || config.layout.rows < 1) return true
    if (config.layout.cols * config.layout.rows > 51) return true
    if (!Number.isFinite(config.ui.chainCardsPerRow) || config.ui.chainCardsPerRow < 1) return true
    if (!Number.isFinite(config.ui.chainCardOffsetX) || config.ui.chainCardOffsetX < 0) return true
    if (!Number.isFinite(config.items.stairRelaxedMinLen) || config.items.stairRelaxedMinLen < 1) return true
    if (!Number.isFinite(config.items.columnSweepRelaxCards) || config.items.columnSweepRelaxCards < 0) return true
    if (!Number.isFinite(config.items.maxItems) || config.items.maxItems < 1) return true
    if (!Number.isFinite(config.scoring.suitColorMinLen) || config.scoring.suitColorMinLen < 1) return true
    if (!Number.isFinite(config.talismans.morningMist.x) || config.talismans.morningMist.x <= 0) return true
    return false
  })

  let targetsNotAscending = $derived.by(() => {
    if (!config) return false
    return config.stages.some(s => !(s.targets[0] < s.targets[1] && s.targets[1] < s.targets[2]))
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

  function resetToDefault() {
    if (!confirm('既定値に戻しますか?')) return
    config = JSON.parse(JSON.stringify(DEFAULT_PARAMS))
  }

  function addStage() {
    if (!config) return
    config.stages.push({ name: `STAGE ${config.stages.length + 1}`, modifier: 'none', targets: [100, 200, 300] })
  }

  function removeStage(index: number) {
    if (!config) return
    if (config.stages.length <= 1) return
    config.stages.splice(index, 1)
  }

  function openJsonPanel() {
    if (!config) return
    jsonText = JSON.stringify(config, null, 2)
    jsonError = null
  }

  function isValidShidasuParams(value: unknown): value is ShidasuParams {
    if (typeof value !== 'object' || value === null) return false
    const v = value as Record<string, unknown>
    return (
      typeof v.layout === 'object' && v.layout !== null &&
      typeof v.scoring === 'object' && v.scoring !== null &&
      Array.isArray(v.stages) && v.stages.length >= 1 &&
      typeof v.items === 'object' && v.items !== null &&
      typeof v.flow === 'object' && v.flow !== null &&
      typeof v.ui === 'object' && v.ui !== null &&
      typeof v.talismans === 'object' && v.talismans !== null
    )
  }

  function applyJson() {
    try {
      const parsed = JSON.parse(jsonText)
      if (!isValidShidasuParams(parsed)) {
        jsonError = '必須項目(layout/scoring/stages/items/flow/ui)が不足しています'
        return
      }
      config = parsed
      jsonError = null
      showToast('JSONを適用しました')
    } catch {
      jsonError = 'JSONの形式が正しくありません'
    }
  }

  function setScoring<K extends keyof ShidasuParams['scoring']>(key: K, value: number) {
    if (!config) return
    config.scoring[key] = value as ShidasuParams['scoring'][K]
  }

  function setTarget(stageIndex: number, targetIndex: 0 | 1 | 2, value: number) {
    if (!config) return
    config.stages[stageIndex].targets[targetIndex] = value
  }

  onMount(() => loadConfig())
  onDestroy(() => {
    if (flashTimer) clearTimeout(flashTimer)
  })
</script>

{#snippet scaledNumberInput(value: number, onChange: (v: number) => void)}
  <div class="mt-1 flex items-center gap-1">
    <input
      type="number"
      min="0"
      step="1"
      value={value / 10}
      oninput={(e) => onChange(Number((e.target as HTMLInputElement).value) * 10)}
      class="w-full border border-slate-200 rounded px-2 py-1 text-sm"
    />
    <span class="text-slate-400 font-mono text-sm select-none" title="点数系パラメータは常に10の倍数">0</span>
  </div>
{/snippet}

<div class="max-w-3xl mx-auto px-4 py-8">
  <a href="/admin" class="text-xs text-slate-400 hover:text-teal-600 mb-4 inline-block">← 管理ページ一覧</a>

  <div class="flex items-center justify-between mb-6">
    <h1 class="text-2xl font-bold text-slate-800">星詠みソリティア -Shidasu- 設定</h1>
    <div class="flex gap-2">
      <button onclick={() => loadConfig(true)} class="text-sm px-3 py-1.5 rounded-lg border border-slate-200 text-slate-600 hover:bg-slate-50 transition-colors">
        リロード
      </button>
      {#if hasValidationError}
        <p class="text-xs text-red-600 self-center">入力値が不正です</p>
      {:else if targetsNotAscending}
        <p class="text-xs text-amber-600 self-center">目標スコアが昇順ではありません</p>
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
    <div class="space-y-6">
      <section class="bg-white border border-slate-200 rounded-xl p-4">
        <h2 class="font-semibold text-slate-700 text-sm mb-3">レイアウト</h2>
        <div class="grid grid-cols-2 gap-3">
          <label class="text-xs text-slate-500">
            列数(cols)
            <input type="number" min="1" step="1" bind:value={config.layout.cols} class="mt-1 w-full border border-slate-200 rounded px-2 py-1 text-sm" />
          </label>
          <label class="text-xs text-slate-500">
            段数(rows)
            <input type="number" min="1" step="1" bind:value={config.layout.rows} class="mt-1 w-full border border-slate-200 rounded px-2 py-1 text-sm" />
          </label>
        </div>
      </section>

      <section class="bg-white border border-slate-200 rounded-xl p-4">
        <h2 class="font-semibold text-slate-700 text-sm mb-3">スコアリング</h2>
        <div class="grid grid-cols-2 gap-3">
          <label class="text-xs text-slate-500">
            基礎点(basePoint)
            {@render scaledNumberInput(config.scoring.basePoint, v => setScoring('basePoint', v))}
          </label>
          <label class="text-xs text-slate-500">
            同スートボーナス(suitBonus)
            {@render scaledNumberInput(config.scoring.suitBonus, v => setScoring('suitBonus', v))}
          </label>
          <label class="text-xs text-slate-500">
            同色ボーナス(colorBonus)
            {@render scaledNumberInput(config.scoring.colorBonus, v => setScoring('colorBonus', v))}
          </label>
          <label class="text-xs text-slate-500">
            同スート/同色の成立に必要な実カード枚数(suitColorMinLen)
            <input type="number" min="1" step="1" bind:value={config.scoring.suitColorMinLen} class="mt-1 w-full border border-slate-200 rounded px-2 py-1 text-sm" />
          </label>
          <label class="text-xs text-slate-500">
            階段ボーナス(stairBonus)
            {@render scaledNumberInput(config.scoring.stairBonus, v => setScoring('stairBonus', v))}
          </label>
          <label class="text-xs text-slate-500">
            階段成立枚数(stairMinLen)
            <input type="number" min="2" step="1" bind:value={config.scoring.stairMinLen} class="mt-1 w-full border border-slate-200 rounded px-2 py-1 text-sm" />
          </label>
          <label class="text-xs text-slate-500">
            全消しボーナス(clearBonus)
            {@render scaledNumberInput(config.scoring.clearBonus, v => setScoring('clearBonus', v))}
          </label>
          <label class="text-xs text-slate-500">
            全消し・残り山札1枚あたり(clearBonusPerStock)
            {@render scaledNumberInput(config.scoring.clearBonusPerStock, v => setScoring('clearBonusPerStock', v))}
          </label>
          <label class="text-xs text-slate-500">
            コンボ倍率のstep幅(comboMultiplierStep)
            <input type="number" min="0" step="0.1" bind:value={config.scoring.comboMultiplierStep} class="mt-1 w-full border border-slate-200 rounded px-2 py-1 text-sm" />
          </label>
        </div>
      </section>

      <section class="bg-white border border-slate-200 rounded-xl p-4">
        <h2 class="font-semibold text-slate-700 text-sm mb-3">役ボーナス</h2>
        <div class="grid grid-cols-2 gap-3">
          <label class="text-xs text-slate-500">
            スートコンプリート(flushBonus)
            {@render scaledNumberInput(config.scoring.flushBonus, v => setScoring('flushBonus', v))}
          </label>
          <label class="text-xs text-slate-500">
            ロイヤルセット(royalSetBonus)
            {@render scaledNumberInput(config.scoring.royalSetBonus, v => setScoring('royalSetBonus', v))}
          </label>
          <label class="text-xs text-slate-500">
            同ランク単位(sameRankBonusUnit)
            {@render scaledNumberInput(config.scoring.sameRankBonusUnit, v => setScoring('sameRankBonusUnit', v))}
          </label>
          <label class="text-xs text-slate-500">
            コンプリートラン(completeRunBonus)
            {@render scaledNumberInput(config.scoring.completeRunBonus, v => setScoring('completeRunBonus', v))}
          </label>
          <label class="text-xs text-slate-500">
            コンプリートラン・同スート加点(completeRunSuitBonus)
            {@render scaledNumberInput(config.scoring.completeRunSuitBonus, v => setScoring('completeRunSuitBonus', v))}
          </label>
          <label class="text-xs text-slate-500">
            列一掃(columnSweepBonus)
            {@render scaledNumberInput(config.scoring.columnSweepBonus, v => setScoring('columnSweepBonus', v))}
          </label>
        </div>
      </section>

      <section class="bg-white border border-slate-200 rounded-xl p-4">
        <div class="flex items-center justify-between mb-3">
          <h2 class="font-semibold text-slate-700 text-sm">ステージ</h2>
          <button onclick={addStage} class="text-xs px-2.5 py-1 rounded border border-dashed border-slate-300 text-slate-500 hover:border-teal-400 hover:text-teal-600">+ ステージ追加</button>
        </div>
        <div class="overflow-x-auto">
          <table class="w-full text-xs border border-slate-200 rounded-lg overflow-hidden">
            <thead>
              <tr class="bg-slate-50 text-slate-500">
                <th class="px-2 py-1.5 text-left">名前</th>
                <th class="px-2 py-1.5 text-left">modifier</th>
                <th class="px-2 py-1.5 text-center">target1</th>
                <th class="px-2 py-1.5 text-center">target2</th>
                <th class="px-2 py-1.5 text-center">target3</th>
                <th class="px-2 py-1.5 w-8"></th>
              </tr>
            </thead>
            <tbody class="divide-y divide-slate-100">
              {#each config.stages as stage, si (si)}
                <tr>
                  <td class="px-2 py-1">
                    <input type="text" bind:value={stage.name} class="w-full border border-slate-200 rounded px-1.5 py-0.5" />
                  </td>
                  <td class="px-2 py-1">
                    <select bind:value={stage.modifier} class="w-full border border-slate-200 rounded px-1.5 py-0.5">
                      <option value="none">none</option>
                      <option value="noLoop">noLoop</option>
                      <option value="faceLock">faceLock</option>
                    </select>
                  </td>
                  {#each [0, 1, 2] as ti (ti)}
                    <td class="px-1 py-1">
                      {@render scaledNumberInput(stage.targets[ti], v => setTarget(si, ti as 0 | 1 | 2, v))}
                    </td>
                  {/each}
                  <td class="px-1 py-1 text-center">
                    <button onclick={() => removeStage(si)} disabled={config.stages.length <= 1} class="text-slate-400 hover:text-red-500 disabled:opacity-30 px-1">×</button>
                  </td>
                </tr>
              {/each}
            </tbody>
          </table>
        </div>
      </section>

      <section class="bg-white border border-slate-200 rounded-xl p-4">
        <h2 class="font-semibold text-slate-700 text-sm mb-3">アイテム</h2>
        <div class="grid grid-cols-2 gap-3">
          <label class="text-xs text-slate-500">
            架橋の護符: 階段成立に必要な枚数(stairRelaxedMinLen)
            <input type="number" min="1" step="1" bind:value={config.items.stairRelaxedMinLen} class="mt-1 w-full border border-slate-200 rounded px-2 py-1 text-sm" />
          </label>
          <label class="text-xs text-slate-500">
            寛容の護符: 列一掃緩和の猶予枚数(columnSweepRelaxCards)
            <input type="number" min="0" step="1" bind:value={config.items.columnSweepRelaxCards} class="mt-1 w-full border border-slate-200 rounded px-2 py-1 text-sm" />
          </label>
          <label class="text-xs text-slate-500">
            護符の所持上限枚数(maxItems)
            <input type="number" min="1" step="1" bind:value={config.items.maxItems} class="mt-1 w-full border border-slate-200 rounded px-2 py-1 text-sm" />
          </label>
        </div>
      </section>

      <section class="bg-white border border-slate-200 rounded-xl p-4">
        <h2 class="font-semibold text-slate-700 text-sm mb-3">護符パラメータ(グループ1〜3)</h2>
        <div class="grid grid-cols-2 gap-3">
          <label class="text-xs text-slate-500">
            忍耐: 残り山札数倍率(patience.x)
            <input type="number" min="0" step="1" bind:value={config.talismans.patience.x} class="mt-1 w-full border border-slate-200 rounded px-2 py-1 text-sm" />
          </label>
          <label class="text-xs text-slate-500">
            浄化: 全消しボーナス加算(purify.n)
            <input type="number" min="0" step="1" bind:value={config.talismans.purify.n} class="mt-1 w-full border border-slate-200 rounded px-2 py-1 text-sm" />
          </label>
          <label class="text-xs text-slate-500">
            節制: 残り山札数倍率(temperance.x)
            <input type="number" min="0" step="0.01" bind:value={config.talismans.temperance.x} class="mt-1 w-full border border-slate-200 rounded px-2 py-1 text-sm" />
          </label>
          <label class="text-xs text-slate-500">
            春風: ♣取得時加算(springBreeze.n)
            <input type="number" min="0" step="1" bind:value={config.talismans.springBreeze.n} class="mt-1 w-full border border-slate-200 rounded px-2 py-1 text-sm" />
          </label>
          <label class="text-xs text-slate-500">
            夏風: ♦取得時加算(summerBreeze.n)
            <input type="number" min="0" step="1" bind:value={config.talismans.summerBreeze.n} class="mt-1 w-full border border-slate-200 rounded px-2 py-1 text-sm" />
          </label>
          <label class="text-xs text-slate-500">
            秋風: ♥取得時加算(autumnBreeze.n)
            <input type="number" min="0" step="1" bind:value={config.talismans.autumnBreeze.n} class="mt-1 w-full border border-slate-200 rounded px-2 py-1 text-sm" />
          </label>
          <label class="text-xs text-slate-500">
            冬風: ♠取得時加算(winterBreeze.n)
            <input type="number" min="0" step="1" bind:value={config.talismans.winterBreeze.n} class="mt-1 w-full border border-slate-200 rounded px-2 py-1 text-sm" />
          </label>
          <label class="text-xs text-slate-500">
            友愛: 他スート→♥切替時加算(kinship.n)
            <input type="number" min="0" step="1" bind:value={config.talismans.kinship.n} class="mt-1 w-full border border-slate-200 rounded px-2 py-1 text-sm" />
          </label>
          <label class="text-xs text-slate-500">
            雪解: ♠→他スート切替時加算(thaw.n)
            <input type="number" min="0" step="1" bind:value={config.talismans.thaw.n} class="mt-1 w-full border border-slate-200 rounded px-2 py-1 text-sm" />
          </label>
          <label class="text-xs text-slate-500">
            宵闇: 赤→黒切替時加算(dusk.n)
            <input type="number" min="0" step="1" bind:value={config.talismans.dusk.n} class="mt-1 w-full border border-slate-200 rounded px-2 py-1 text-sm" />
          </label>
          <label class="text-xs text-slate-500">
            払暁: 黒→赤切替時加算(dawn.n)
            <input type="number" min="0" step="1" bind:value={config.talismans.dawn.n} class="mt-1 w-full border border-slate-200 rounded px-2 py-1 text-sm" />
          </label>
          <label class="text-xs text-slate-500">
            機知: ワイルド取得時加算(wit.n)
            <input type="number" min="0" step="1" bind:value={config.talismans.wit.n} class="mt-1 w-full border border-slate-200 rounded px-2 py-1 text-sm" />
          </label>
          <label class="text-xs text-slate-500">
            勇気: コンボ数倍率(courage.x)
            <input type="number" min="0" step="0.01" bind:value={config.talismans.courage.x} class="mt-1 w-full border border-slate-200 rounded px-2 py-1 text-sm" />
          </label>
          <label class="text-xs text-slate-500">
            暁: 閾値(daybreak.c)
            <input type="number" min="0" step="1" bind:value={config.talismans.daybreak.c} class="mt-1 w-full border border-slate-200 rounded px-2 py-1 text-sm" />
          </label>
          <label class="text-xs text-slate-500">
            暁: 倍率(daybreak.x)
            <input type="number" min="0" step="0.1" bind:value={config.talismans.daybreak.x} class="mt-1 w-full border border-slate-200 rounded px-2 py-1 text-sm" />
          </label>
          <label class="text-xs text-slate-500">
            黄昏: 閾値(twilight.c)
            <input type="number" min="0" step="1" bind:value={config.talismans.twilight.c} class="mt-1 w-full border border-slate-200 rounded px-2 py-1 text-sm" />
          </label>
          <label class="text-xs text-slate-500">
            黄昏: 倍率(twilight.x)
            <input type="number" min="0" step="0.1" bind:value={config.talismans.twilight.x} class="mt-1 w-full border border-slate-200 rounded px-2 py-1 text-sm" />
          </label>
          <label class="text-xs text-slate-500">
            快活: コンボ偶数時加算(cheerful.n)
            <input type="number" min="0" step="1" bind:value={config.talismans.cheerful.n} class="mt-1 w-full border border-slate-200 rounded px-2 py-1 text-sm" />
          </label>
          <label class="text-xs text-slate-500">
            良心: コンボ奇数時加算(conscience.n)
            <input type="number" min="0" step="1" bind:value={config.talismans.conscience.n} class="mt-1 w-full border border-slate-200 rounded px-2 py-1 text-sm" />
          </label>
          <label class="text-xs text-slate-500">
            朝霧: 閾値(morningMist.c)
            <input type="number" min="0" step="1" bind:value={config.talismans.morningMist.c} class="mt-1 w-full border border-slate-200 rounded px-2 py-1 text-sm" />
          </label>
          <label class="text-xs text-slate-500">
            朝霧: 倍率(morningMist.x)
            <input type="number" min="0.01" step="0.1" bind:value={config.talismans.morningMist.x} class="mt-1 w-full border border-slate-200 rounded px-2 py-1 text-sm" />
          </label>
        </div>
      </section>

      <section class="bg-white border border-slate-200 rounded-xl p-4">
        <h2 class="font-semibold text-slate-700 text-sm mb-3">護符パラメータ(グループ4〜8)</h2>
        <div class="grid grid-cols-2 gap-3">
          <label class="text-xs text-slate-500">
            平穏: JQKなし加算(calm.n)
            <input type="number" min="0" step="1" bind:value={config.talismans.calm.n} class="mt-1 w-full border border-slate-200 rounded px-2 py-1 text-sm" />
          </label>
          <label class="text-xs text-slate-500">
            安寧: JQKなし倍率(serenity.x)
            <input type="number" min="0" step="0.1" bind:value={config.talismans.serenity.x} class="mt-1 w-full border border-slate-200 rounded px-2 py-1 text-sm" />
          </label>
          <label class="text-xs text-slate-500">
            運命: JQKのみ加算(destiny.n)
            <input type="number" min="0" step="1" bind:value={config.talismans.destiny.n} class="mt-1 w-full border border-slate-200 rounded px-2 py-1 text-sm" />
          </label>
          <label class="text-xs text-slate-500">
            宿命: JQKのみ倍率(fate.x)
            <input type="number" min="0" step="0.1" bind:value={config.talismans.fate.x} class="mt-1 w-full border border-slate-200 rounded px-2 py-1 text-sm" />
          </label>
          <label class="text-xs text-slate-500">
            安堵: 数札取得時加算(relief.n)
            <input type="number" min="0" step="1" bind:value={config.talismans.relief.n} class="mt-1 w-full border border-slate-200 rounded px-2 py-1 text-sm" />
          </label>
          <label class="text-xs text-slate-500">
            深緑: ♣専有倍率(verdantGreen.x)
            <input type="number" min="0" step="0.1" bind:value={config.talismans.verdantGreen.x} class="mt-1 w-full border border-slate-200 rounded px-2 py-1 text-sm" />
          </label>
          <label class="text-xs text-slate-500">
            宝石: ♦専有倍率(gem.x)
            <input type="number" min="0" step="0.1" bind:value={config.talismans.gem.x} class="mt-1 w-full border border-slate-200 rounded px-2 py-1 text-sm" />
          </label>
          <label class="text-xs text-slate-500">
            真剣: ♠専有倍率(resolve.x)
            <input type="number" min="0" step="0.1" bind:value={config.talismans.resolve.x} class="mt-1 w-full border border-slate-200 rounded px-2 py-1 text-sm" />
          </label>
          <label class="text-xs text-slate-500">
            聖杯: ♥専有倍率(grail.x)
            <input type="number" min="0" step="0.1" bind:value={config.talismans.grail.x} class="mt-1 w-full border border-slate-200 rounded px-2 py-1 text-sm" />
          </label>
          <label class="text-xs text-slate-500">
            月光: 黒専有倍率(moonlight.x)
            <input type="number" min="0" step="0.1" bind:value={config.talismans.moonlight.x} class="mt-1 w-full border border-slate-200 rounded px-2 py-1 text-sm" />
          </label>
          <label class="text-xs text-slate-500">
            陽光: 赤専有倍率(sunlight.x)
            <input type="number" min="0" step="0.1" bind:value={config.talismans.sunlight.x} class="mt-1 w-full border border-slate-200 rounded px-2 py-1 text-sm" />
          </label>
          <label class="text-xs text-slate-500">
            王冠: K枚数倍率(crown.x)
            <input type="number" min="0" step="0.01" bind:value={config.talismans.crown.x} class="mt-1 w-full border border-slate-200 rounded px-2 py-1 text-sm" />
          </label>
          <label class="text-xs text-slate-500">
            青葉: ♣枚数あたり加算(cloverLeaf.n)
            <input type="number" min="0" step="1" bind:value={config.talismans.cloverLeaf.n} class="mt-1 w-full border border-slate-200 rounded px-2 py-1 text-sm" />
          </label>
          <label class="text-xs text-slate-500">
            硬貨: ♦枚数あたり加算(coin.n)
            <input type="number" min="0" step="1" bind:value={config.talismans.coin.n} class="mt-1 w-full border border-slate-200 rounded px-2 py-1 text-sm" />
          </label>
          <label class="text-xs text-slate-500">
            武器: ♠枚数あたり加算(blade.n)
            <input type="number" min="0" step="1" bind:value={config.talismans.blade.n} class="mt-1 w-full border border-slate-200 rounded px-2 py-1 text-sm" />
          </label>
          <label class="text-xs text-slate-500">
            献杯: ♥枚数あたり加算(chalice.n)
            <input type="number" min="0" step="1" bind:value={config.talismans.chalice.n} class="mt-1 w-full border border-slate-200 rounded px-2 py-1 text-sm" />
          </label>
          <label class="text-xs text-slate-500">
            均衡: 赤黒同数加算(balance.n)
            <input type="number" min="0" step="1" bind:value={config.talismans.balance.n} class="mt-1 w-full border border-slate-200 rounded px-2 py-1 text-sm" />
          </label>
          <label class="text-xs text-slate-500">
            調和: 赤黒同数倍率(harmony.x)
            <input type="number" min="0" step="0.1" bind:value={config.talismans.harmony.x} class="mt-1 w-full border border-slate-200 rounded px-2 py-1 text-sm" />
          </label>
          <label class="text-xs text-slate-500">
            高潔: 同スートパターン加算(nobility.n)
            <input type="number" min="0" step="1" bind:value={config.talismans.nobility.n} class="mt-1 w-full border border-slate-200 rounded px-2 py-1 text-sm" />
          </label>
          <label class="text-xs text-slate-500">
            執念: 同スートパターン倍率(tenacity.x)
            <input type="number" min="0" step="0.01" bind:value={config.talismans.tenacity.x} class="mt-1 w-full border border-slate-200 rounded px-2 py-1 text-sm" />
          </label>
          <label class="text-xs text-slate-500">
            覚悟: 階段倍率(determination.x)
            <input type="number" min="0" step="0.01" bind:value={config.talismans.determination.x} class="mt-1 w-full border border-slate-200 rounded px-2 py-1 text-sm" />
          </label>
          <label class="text-xs text-slate-500">
            循環: K↔A遷移倍率(cycle.x)
            <input type="number" min="0" step="0.1" bind:value={config.talismans.cycle.x} class="mt-1 w-full border border-slate-200 rounded px-2 py-1 text-sm" />
          </label>
          <label class="text-xs text-slate-500">
            輪廻: K↔Aループ倍率(reincarnation.x)
            <input type="number" min="0" step="0.1" bind:value={config.talismans.reincarnation.x} class="mt-1 w-full border border-slate-200 rounded px-2 py-1 text-sm" />
          </label>
          <label class="text-xs text-slate-500">
            威光: 同スート全ランク階段倍率(majesty.x)
            <input type="number" min="0" step="0.1" bind:value={config.talismans.majesty.x} class="mt-1 w-full border border-slate-200 rounded px-2 py-1 text-sm" />
          </label>
          <label class="text-xs text-slate-500">
            兆し: 場札残数閾値(omen.m)
            <input type="number" min="0" step="1" bind:value={config.talismans.omen.m} class="mt-1 w-full border border-slate-200 rounded px-2 py-1 text-sm" />
          </label>
          <label class="text-xs text-slate-500">
            兆し: 倍率(omen.x)
            <input type="number" min="0" step="0.1" bind:value={config.talismans.omen.x} class="mt-1 w-full border border-slate-200 rounded px-2 py-1 text-sm" />
          </label>
          <label class="text-xs text-slate-500">
            三日月: 場札残数閾値(crescent.m)
            <input type="number" min="0" step="1" bind:value={config.talismans.crescent.m} class="mt-1 w-full border border-slate-200 rounded px-2 py-1 text-sm" />
          </label>
          <label class="text-xs text-slate-500">
            三日月: 倍率(crescent.x)
            <input type="number" min="0" step="0.1" bind:value={config.talismans.crescent.x} class="mt-1 w-full border border-slate-200 rounded px-2 py-1 text-sm" />
          </label>
          <label class="text-xs text-slate-500">
            恩寵: 役成立倍率(blessing.x)
            <input type="number" min="0" step="0.1" bind:value={config.talismans.blessing.x} class="mt-1 w-full border border-slate-200 rounded px-2 py-1 text-sm" />
          </label>
          <label class="text-xs text-slate-500">
            集中: 同ランク役倍率(focus.x)
            <input type="number" min="0" step="0.1" bind:value={config.talismans.focus.x} class="mt-1 w-full border border-slate-200 rounded px-2 py-1 text-sm" />
          </label>
          <label class="text-xs text-slate-500">
            瑠璃: 役2種類以上同時倍率(lapis.x)
            <input type="number" min="0" step="0.1" bind:value={config.talismans.lapis.x} class="mt-1 w-full border border-slate-200 rounded px-2 py-1 text-sm" />
          </label>
          <label class="text-xs text-slate-500">
            翡翠: ワイルド起因役加算(jade.n)
            <input type="number" min="0" step="1" bind:value={config.talismans.jade.n} class="mt-1 w-full border border-slate-200 rounded px-2 py-1 text-sm" />
          </label>
          <label class="text-xs text-slate-500">
            無心: 役・パターン無し倍率(emptyMind.x)
            <input type="number" min="0" step="0.1" bind:value={config.talismans.emptyMind.x} class="mt-1 w-full border border-slate-200 rounded px-2 py-1 text-sm" />
          </label>
          <label class="text-xs text-slate-500">
            序章: コンボ1枚目加算(prologue.n)
            <input type="number" min="0" step="1" bind:value={config.talismans.prologue.n} class="mt-1 w-full border border-slate-200 rounded px-2 py-1 text-sm" />
          </label>
          <label class="text-xs text-slate-500">
            幕間: 発動間隔(interlude.m)
            <input type="number" min="1" step="1" bind:value={config.talismans.interlude.m} class="mt-1 w-full border border-slate-200 rounded px-2 py-1 text-sm" />
          </label>
          <label class="text-xs text-slate-500">
            幕間: 加算量(interlude.n)
            <input type="number" min="0" step="1" bind:value={config.talismans.interlude.n} class="mt-1 w-full border border-slate-200 rounded px-2 py-1 text-sm" />
          </label>
          <label class="text-xs text-slate-500">
            朝露: ウェーブ最初のプレイ加算(morningDew.n)
            <input type="number" min="0" step="1" bind:value={config.talismans.morningDew.n} class="mt-1 w-full border border-slate-200 rounded px-2 py-1 text-sm" />
          </label>
          <label class="text-xs text-slate-500">
            小雨: 無条件加算(drizzle.n)
            <input type="number" min="0" step="1" bind:value={config.talismans.drizzle.n} class="mt-1 w-full border border-slate-200 rounded px-2 py-1 text-sm" />
          </label>
        </div>
      </section>

      <section class="bg-white border border-slate-200 rounded-xl p-4">
        <h2 class="font-semibold text-slate-700 text-sm mb-3">護符パラメータ(永続デッキ系)</h2>
        <div class="grid grid-cols-2 gap-3">
          <label class="text-xs text-slate-500">
            不屈: 手詰まり復活時のスコア消費率%(resilience.p)
            <input type="number" min="0" max="100" step="1" bind:value={config.talismans.resilience.p} class="mt-1 w-full border border-slate-200 rounded px-2 py-1 text-sm" />
          </label>
        </div>
      </section>

      <section class="bg-white border border-slate-200 rounded-xl p-4">
        <h2 class="font-semibold text-slate-700 text-sm mb-3">護符パラメータ(グループ9〜16)</h2>
        <div class="grid grid-cols-2 gap-3">
          <label class="text-xs text-slate-500">
            微風: 連続回数あたり加算(gentleBreeze.n)
            <input type="number" min="0" step="1" bind:value={config.talismans.gentleBreeze.n} class="mt-1 w-full border border-slate-200 rounded px-2 py-1 text-sm" />
          </label>
          <label class="text-xs text-slate-500">
            共鳴: 連続回数あたり倍率(resonance.x)
            <input type="number" min="0" step="0.1" bind:value={config.talismans.resonance.x} class="mt-1 w-full border border-slate-200 rounded px-2 py-1 text-sm" />
          </label>
          <label class="text-xs text-slate-500">
            蒼穹: 列一掃累計あたり倍率(azureSky.x)
            <input type="number" min="0" step="0.1" bind:value={config.talismans.azureSky.x} class="mt-1 w-full border border-slate-200 rounded px-2 py-1 text-sm" />
          </label>
          <label class="text-xs text-slate-500">
            琥珀: 最大コンボあたり倍率(amber.x)
            <input type="number" min="0" step="0.01" bind:value={config.talismans.amber.x} class="mt-1 w-full border border-slate-200 rounded px-2 py-1 text-sm" />
          </label>
          <label class="text-xs text-slate-500">
            沈着: リセット時直接加算(composure.n)
            <input type="number" min="0" step="1" bind:value={config.talismans.composure.n} class="mt-1 w-full border border-slate-200 rounded px-2 py-1 text-sm" />
          </label>
          <label class="text-xs text-slate-500">
            冷静: リセット時直接加算(clarity.n)
            <input type="number" min="0" step="1" bind:value={config.talismans.clarity.n} class="mt-1 w-full border border-slate-200 rounded px-2 py-1 text-sm" />
          </label>
          <label class="text-xs text-slate-500">
            慢心: 場札残数あたり直接加算(arrogance.x)
            <input type="number" min="0" step="1" bind:value={config.talismans.arrogance.x} class="mt-1 w-full border border-slate-200 rounded px-2 py-1 text-sm" />
          </label>
          <label class="text-xs text-slate-500">
            残響: コンボ数あたり直接加算(echo.n)
            <input type="number" min="0" step="1" bind:value={config.talismans.echo.n} class="mt-1 w-full border border-slate-200 rounded px-2 py-1 text-sm" />
          </label>
          <label class="text-xs text-slate-500">
            流星: 到達コンボ数の閾値(shootingStar.c)
            <input type="number" min="1" step="1" bind:value={config.talismans.shootingStar.c} class="mt-1 w-full border border-slate-200 rounded px-2 py-1 text-sm" />
          </label>
          <label class="text-xs text-slate-500">
            流星: 直接加算(shootingStar.n)
            <input type="number" min="0" step="1" bind:value={config.talismans.shootingStar.n} class="mt-1 w-full border border-slate-200 rounded px-2 py-1 text-sm" />
          </label>
          <label class="text-xs text-slate-500">
            直感: 継続回数あたり倍率(intuition.x)
            <input type="number" min="0" step="0.1" bind:value={config.talismans.intuition.x} class="mt-1 w-full border border-slate-200 rounded px-2 py-1 text-sm" />
          </label>
          <label class="text-xs text-slate-500">
            誠実: 直接加算(sincerity.n)
            <input type="number" min="0" step="1" bind:value={config.talismans.sincerity.n} class="mt-1 w-full border border-slate-200 rounded px-2 py-1 text-sm" />
          </label>
          <label class="text-xs text-slate-500">
            暗雲: 追加配布行数(darkClouds.r)
            <input type="number" min="0" step="1" bind:value={config.talismans.darkClouds.r} class="mt-1 w-full border border-slate-200 rounded px-2 py-1 text-sm" />
          </label>
          <label class="text-xs text-slate-500">
            再生: スコア消費率%(regeneration.p)
            <input type="number" min="0" max="100" step="1" bind:value={config.talismans.regeneration.p} class="mt-1 w-full border border-slate-200 rounded px-2 py-1 text-sm" />
          </label>
          <label class="text-xs text-slate-500">
            情熱: フラッシュ成立中倍率(passion.x)
            <input type="number" min="0" step="0.1" bind:value={config.talismans.passion.x} class="mt-1 w-full border border-slate-200 rounded px-2 py-1 text-sm" />
          </label>
          <label class="text-xs text-slate-500">
            闘志: 列一掃発生中倍率(fightingSpirit.x)
            <input type="number" min="0" step="0.1" bind:value={config.talismans.fightingSpirit.x} class="mt-1 w-full border border-slate-200 rounded px-2 py-1 text-sm" />
          </label>
        </div>
      </section>

      <section class="bg-white border border-slate-200 rounded-xl p-4">
        <h2 class="font-semibold text-slate-700 text-sm mb-3">フロー・UI</h2>
        <div class="grid grid-cols-2 gap-3">
          <label class="text-xs text-slate-500">
            1ステージのウェーブ数(wavesPerStage)
            <input type="number" min="1" step="1" bind:value={config.flow.wavesPerStage} class="mt-1 w-full border border-slate-200 rounded px-2 py-1 text-sm" />
          </label>
          <label class="text-xs text-slate-500">
            クリア演出待ち(clearDelayMs)
            <input type="number" min="0" step="10" bind:value={config.flow.clearDelayMs} class="mt-1 w-full border border-slate-200 rounded px-2 py-1 text-sm" />
          </label>
          {#each [0, 1, 2] as ti (ti)}
            <label class="text-xs text-slate-500">
              comboTierThresholds[{ti}]
              <input type="number" min="0" step="1" bind:value={config.ui.comboTierThresholds[ti]} class="mt-1 w-full border border-slate-200 rounded px-2 py-1 text-sm" />
            </label>
          {/each}
          <label class="text-xs text-slate-500">
            チェーン表示: 横にずらす幅(chainCardOffsetX)
            <input type="number" min="0" step="1" bind:value={config.ui.chainCardOffsetX} class="mt-1 w-full border border-slate-200 rounded px-2 py-1 text-sm" />
          </label>
          <label class="text-xs text-slate-500">
            チェーン表示: 1行に表示する枚数(chainCardsPerRow)
            <input type="number" min="1" step="1" bind:value={config.ui.chainCardsPerRow} class="mt-1 w-full border border-slate-200 rounded px-2 py-1 text-sm" />
          </label>
        </div>
      </section>

      <section class="bg-white border border-slate-200 rounded-xl p-4">
        <div class="flex items-center justify-between mb-3">
          <h2 class="font-semibold text-slate-700 text-sm">JSON入出力</h2>
          <button onclick={openJsonPanel} class="text-xs px-2.5 py-1 rounded border border-slate-200 text-slate-500 hover:border-teal-400 hover:text-teal-600">現在値を表示</button>
        </div>
        <textarea bind:value={jsonText} rows="10" class="w-full border border-slate-200 rounded px-2 py-1.5 text-xs font-mono"></textarea>
        {#if jsonError}
          <p class="text-xs text-red-600 mt-1">{jsonError}</p>
        {/if}
        <button onclick={applyJson} class="mt-2 text-xs px-3 py-1 rounded bg-slate-700 text-white hover:bg-slate-800">貼り付けを適用</button>
      </section>

      <div class="flex justify-end">
        <button onclick={resetToDefault} class="text-xs px-3 py-1 rounded border border-slate-200 text-slate-400 hover:border-amber-400 hover:text-amber-600 transition-colors">
          デフォルトに戻す
        </button>
      </div>
    </div>
  {:else if !error}
    <p class="text-slate-500 text-sm">読み込み中...</p>
  {/if}
</div>

{#if flash}
  <div class="fixed bottom-6 right-6 bg-slate-800 text-white text-sm px-4 py-2.5 rounded-lg shadow-lg z-50">
    {flash}
  </div>
{/if}
