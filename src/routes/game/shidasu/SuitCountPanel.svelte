<script lang="ts">
  import type { WaveState, Suit } from '$lib/game/shidasu/types'

  let { wave }: { wave: WaveState } = $props()

  const SUITS: Suit[] = ['♠', '♥', '♦', '♣']

  let counts = $derived.by(() => {
    const bySuit: Record<Suit, number> = { '♠': 0, '♥': 0, '♦': 0, '♣': 0, '★': 0 }
    let wild = 0
    for (const card of wave.tableau.flat()) {
      if (card.wild) {
        wild += 1
        continue
      }
      bySuit[card.suit] += 1
    }
    return { bySuit, wild }
  })
</script>

<div class="px-4 pb-2">
  <div class="bg-emerald-900/50 border border-emerald-800 rounded-lg p-2 flex items-center justify-around text-xs">
    {#each SUITS as suit (suit)}
      <span class="font-bold {suit === '♥' || suit === '♦' ? 'text-rose-300' : 'text-amber-50'}">{suit} {counts.bySuit[suit]}</span>
    {/each}
    <span class="font-bold text-purple-300">★ {counts.wild}</span>
  </div>
</div>
