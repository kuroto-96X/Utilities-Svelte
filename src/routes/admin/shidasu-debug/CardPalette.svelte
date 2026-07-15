<script lang="ts">
  import type { Snippet } from 'svelte'
  import type { Card, Suit, Rank } from '$lib/game/shidasu/types'

  let { cardFace, onCardPointerDown }: {
    cardFace: Snippet<[card: Card, covered: boolean]>
    onCardPointerDown: (source: { suit: Suit; rank: Rank; wild: boolean }, e: PointerEvent) => void
  } = $props()

  const REAL_SUITS: Suit[] = ['♠', '♥', '♦', '♣']
  const RANKS: Rank[] = [1, 2, 3, 4, 5, 6, 7, 8, 9, 10, 11, 12, 13]
</script>

<div class="space-y-2">
  <h2 class="text-sm font-bold text-slate-700">カードパレット(ドラッグして場札・山札に入れ替え)</h2>
  <div class="grid gap-1" style="grid-template-columns: repeat(13, minmax(0, 1fr));">
    {#each REAL_SUITS as suit (suit)}
      {#each RANKS as rank (rank)}
        <div
          role="button"
          tabindex="0"
          onpointerdown={(e) => onCardPointerDown({ suit, rank, wild: false }, e)}
          class="cursor-grab active:cursor-grabbing touch-none"
        >
          {@render cardFace({ id: -1, suit, rank, wild: false }, false)}
        </div>
      {/each}
    {/each}
    <div
      role="button"
      tabindex="0"
      onpointerdown={(e) => onCardPointerDown({ suit: '★', rank: 0, wild: true }, e)}
      class="cursor-grab active:cursor-grabbing touch-none"
    >
      {@render cardFace({ id: -1, suit: '★', rank: 0, wild: true }, false)}
    </div>
  </div>
</div>
