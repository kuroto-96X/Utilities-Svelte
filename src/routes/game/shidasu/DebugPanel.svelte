<script lang="ts">
  import { untrack } from 'svelte'
  import { analyzeSuitColor, analyzeStair, isRed } from '$lib/game/shidasu/patterns'
  import { rankLabel } from '$lib/game/shidasu/engine'
  import type { WaveState, Suit, Rank } from '$lib/game/shidasu/types'

  let { wave, onForceDraw }: {
    wave: WaveState
    onForceDraw: (suit: Suit, rank: Rank, wild: boolean) => void
  } = $props()

  interface GainLogEntry {
    combo: number
    label: string
    points: number
    parts: string[]
  }

  const partsToText = (parts: { text: string }[]): string[] => parts.map(p => p.text)

  let gainLog = $state<GainLogEntry[]>([])

  $effect(() => {
    const gain = wave.lastGain
    const bonusGains = wave.lastBonusGains
    const combo = wave.combo
    const newEntries: GainLogEntry[] = []
    if (gain) newEntries.push({ combo, label: '', points: gain.points, parts: partsToText(gain.parts) })
    for (const b of bonusGains) newEntries.push({ combo, label: b.label, points: b.points, parts: partsToText(b.parts) })
    // gainLogの読み取り(スプレッド)をuntrackで囲まないと、この$effect自身が
    // gainLogの変化に依存してしまい、書き込むたびに自分自身を再実行する無限ループになる
    if (newEntries.length > 0) {
      gainLog = [...newEntries, ...untrack(() => gainLog)].slice(0, 20)
    }
  })

  const REAL_SUITS: Suit[] = ['♠', '♥', '♦', '♣']
  const RANKS: Rank[] = [1, 2, 3, 4, 5, 6, 7, 8, 9, 10, 11, 12, 13]

  let formSuit = $state<Suit>('♠')
  let formRank = $state<Rank>(1)
  let formWild = $state(false)

  function submitForceDraw() {
    if (formWild) {
      onForceDraw('★', 0, true)
    } else {
      onForceDraw(formSuit, formRank, false)
    }
  }

  let suitColor = $derived(analyzeSuitColor(wave.chain))
  let stairInfo = $derived(analyzeStair(wave.chain))
</script>

<div class="mt-2 px-3 py-3 border-t-4 border-fuchsia-500 bg-slate-900 text-slate-100 text-xs space-y-3">
  <div class="font-black text-fuchsia-400">🐛 DEBUG (dev only)</div>

  <section>
    <div class="font-bold text-slate-300 mb-1">内部状態</div>
    <div class="grid grid-cols-2 gap-x-3 gap-y-0.5 font-mono">
      <div>combo: {wave.combo}</div>
      <div>baseComboCount: {wave.baseComboCount}</div>
      <div class="col-span-2">comboStreakColumnLengths: {wave.comboStreakColumnLengths.join(',')}</div>
      <div>columnsEmptied: {wave.columnsEmptiedThisCombo}</div>
      <div>lastDrawEffect: {wave.lastDrawEffect ?? 'null'}</div>
      <div>suitHeld: {String(suitColor.suitHeld)}</div>
      <div>colorHeld: {String(suitColor.colorHeld)}</div>
      <div>stair.held: {String(stairInfo.held)}</div>
      <div>stair.dir/len: {stairInfo.dir}/{stairInfo.len}</div>
    </div>
    <div class="mt-1">
      <span class="text-slate-400">chain:</span>
      {#each wave.chain as c (c.id)}
        <span class="inline-block px-1 border border-slate-600 rounded ml-1 {c.wild ? 'text-fuchsia-300' : isRed(c) ? 'text-red-400' : 'text-slate-100'}">{rankLabel(c)}{c.suit}</span>
      {/each}
      {#if wave.chain.length === 0}<span class="text-slate-500">(空)</span>{/if}
    </div>
  </section>

  <section>
    <div class="flex items-center justify-between mb-1">
      <div class="font-bold text-slate-300">獲得点ログ(新しい順)</div>
      <button type="button" onclick={() => (gainLog = [])} class="text-[10px] px-1.5 py-0.5 rounded border border-slate-600 text-slate-300 hover:bg-slate-800">リセット</button>
    </div>
    <div class="max-h-24 overflow-y-auto space-y-0.5">
      {#each gainLog as entry, i (i)}
        <div class="font-mono">×{entry.combo}: {#if entry.label}<span class="text-fuchsia-300">[{entry.label}]</span> {/if}+{entry.points} {entry.parts.join(' ')}</div>
      {/each}
      {#if gainLog.length === 0}<div class="text-slate-500">(まだ得点なし)</div>{/if}
    </div>
  </section>

  <section>
    <div class="font-bold text-slate-300 mb-1">山札の次を強制指定</div>
    <div class="flex items-center gap-2 flex-wrap">
      <label class="flex items-center gap-1">
        <input type="checkbox" bind:checked={formWild} />
        ワイルド
      </label>
      <select bind:value={formSuit} disabled={formWild} class="bg-slate-800 border border-slate-600 rounded px-1 py-0.5">
        {#each REAL_SUITS as s (s)}
          <option value={s}>{s}</option>
        {/each}
      </select>
      <select bind:value={formRank} disabled={formWild} class="bg-slate-800 border border-slate-600 rounded px-1 py-0.5">
        {#each RANKS as r (r)}
          <option value={r}>{r}</option>
        {/each}
      </select>
      <button onclick={submitForceDraw} class="px-2 py-1 rounded bg-fuchsia-700 text-white">この札をセットして引く</button>
    </div>
  </section>
</div>
