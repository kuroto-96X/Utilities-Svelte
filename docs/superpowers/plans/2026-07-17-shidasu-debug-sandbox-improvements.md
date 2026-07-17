# Shidasu デバッグサンドボックス改善 Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** `/admin/shidasu-debug`デバッグサンドボックスの操作性を改善し(元に戻すの対象拡大・ログリセット・デッキリセット・護符チェックのlocalStorage永続化)、プレイエリアの見た目・動作を`/game/shidasu`本体と共通コンポーネント化して一致させる。

**Architecture:** `src/routes/game/shidasu/`配下に新規`CardFace.svelte`(カード1枚の描画)・`PlayArea.svelte`(スコア/コンボヘッダー・場札・山札・チェーン表示一式)の2つの共有コンポーネントを切り出し、`/game/shidasu/+page.svelte`と`/admin/shidasu-debug/+page.svelte`の両方から使う。切り出し後、デバッグサンドボックス側の状態操作(元に戻す一般化・ログリセット・デッキリセット・localStorage永続化)を追加する。

**Tech Stack:** SvelteKit(Svelte 5 runes)、TypeScript。UIのみの変更が中心で、このプロジェクトのテストスイート(vitest)はshidasuのゲームロジック(`engine.ts`等)のみを対象としSvelteコンポーネントは対象外のため、検証は`npm run check`・`npm run build`・`npm run dev`でのブラウザ確認で行う。

---

## 前提知識(実装前に把握しておくこと)

- `src/routes/game/shidasu/+page.svelte`と`src/routes/admin/shidasu-debug/+page.svelte`は、カード描画(`cardFace`スニペット・`PIP_LAYOUTS`・`FACE_CHAR`)が完全に重複したコードを持っている。これを`CardFace.svelte`として1箇所に切り出す。
- `src/routes/admin/shidasu-debug/DebugStatePanel.svelte`が既に`import DebugPanel from '../../game/shidasu/DebugPanel.svelte'`という形で、`admin/shidasu-debug`から`game/shidasu`配下のコンポーネントをクロスルートでimportする前例がある。新規コンポーネントも同じ配置(`src/routes/game/shidasu/`配下)・同じ相対パス規則(`../../game/shidasu/XXX.svelte`)に従う。
- Svelte 5のsnippet propsは、コンポーネントタグの子要素として`{#snippet name()}...{/snippet}`を書くと自動的に同名propへバインドされる(暗黙バインド)。また、トップレベルで定義した`{#snippet name()}...{/snippet}`は通常の値としてprops経由で複数箇所に渡すこともできる(`<Foo bar={name} />`)。本プランではこの後者の形を使う箇所がある。
- `npm run build`(esbuild)は型チェックをしないため、型エラーは`npm run check`(svelte-check)でのみ検出される。UIコンポーネントを大きく書き換えるタスクでは特に`npm run check`を省略しないこと。
- このプロジェクトは全ページprerender構成(adapter-static)のため、`localStorage`へのトップレベルアクセスはビルド時にエラーになる。`try/catch`で囲むこと(`src/routes/game/solitaire/+page.svelte`の`$effect`内`localStorage.setItem(...)`パターンを踏襲する)。

---

## ファイル構成

- `src/routes/game/shidasu/CardFace.svelte`(新規): カード1枚の描画(ワイルド/通常、ピップ配置、絵札記号)。`{ card: Card, covered: boolean }`をpropsに取る。
- `src/routes/game/shidasu/PlayArea.svelte`(新規): スコア/コンボヘッダー・進捗バー・獲得点ポップアップ・場札グリッド・山札・チェーン表示。`/game/shidasu`と`/admin/shidasu-debug`の両方から使う。
- `src/routes/game/shidasu/+page.svelte`(修正): `PlayArea`を使うようリファクタリング。
- `src/routes/game/shidasu/DebugPanel.svelte`(修正): 獲得点ログのリセットボタンを追加。
- `src/routes/admin/shidasu-debug/+page.svelte`(修正): `PlayArea`・`CardFace`を使うようリファクタリング。元に戻すの一般化・デッキリセット・localStorage永続化を追加。
- `src/routes/admin/shidasu-debug/CardPalette.svelte`(修正): `cardFace`snippet propの代わりに`CardFace.svelte`を直接使う。

---

### Task 1: `CardFace.svelte`を新規作成する

**Files:**
- Create: `src/routes/game/shidasu/CardFace.svelte`

- [ ] **Step 1: `CardFace.svelte`を作成する**

`src/routes/game/shidasu/+page.svelte`の`cardFace`スニペット(および`PIP_LAYOUTS`・`FACE_CHAR`定数)を元に、以下の内容で新規ファイルを作成する。

```svelte
<script lang="ts">
  import { rankLabel, isRed } from '$lib/game/shidasu/engine'
  import type { Card } from '$lib/game/shidasu/types'

  let { card, covered }: { card: Card; covered: boolean } = $props()

  const PIP_LAYOUTS: Record<number, [number, number, boolean][]> = {
    1:  [[50, 50, false]],
    2:  [[50, 18, false], [50, 82, true]],
    3:  [[50, 14, false], [50, 50, false], [50, 86, true]],
    4:  [[25, 18, false], [75, 18, false], [25, 82, true], [75, 82, true]],
    5:  [[25, 18, false], [75, 18, false], [50, 50, false], [25, 82, true], [75, 82, true]],
    6:  [[25, 15, false], [75, 15, false], [25, 50, false], [75, 50, false], [25, 85, true], [75, 85, true]],
    7:  [[25, 13, false], [75, 13, false], [50, 30, false], [25, 52, false], [75, 52, false], [25, 85, true], [75, 85, true]],
    8:  [[25, 11, false], [75, 11, false], [50, 28, false], [25, 50, false], [75, 50, false], [50, 72, true], [25, 89, true], [75, 89, true]],
    9:  [[25, 9, false], [75, 9, false], [25, 35, false], [75, 35, false], [50, 50, false], [25, 65, true], [75, 65, true], [25, 91, true], [75, 91, true]],
    10: [[25, 9, false], [75, 9, false], [50, 26, false], [25, 37, false], [75, 37, false], [25, 63, true], [75, 63, true], [50, 74, true], [25, 91, true], [75, 91, true]],
  }
  const FACE_CHAR: Record<number, string> = { 11: '♞', 12: '♛', 13: '♚' }
</script>

{#if card.wild}
  <div
    class="relative w-full rounded-lg border p-1 flex flex-col items-start overflow-hidden select-none"
    style="aspect-ratio: 2 / 3; background:#EDE4FF; border-color:#A78BFA; color:#6D28D9;"
  >
    <div class="flex items-center gap-0.5 leading-none">
      <span class="text-sm font-bold leading-none">{rankLabel(card)}</span>
    </div>
    {#if !covered}
      <div class="w-full flex-1 flex items-center justify-center">
        <span class="leading-none" style="font-size:26px;">{rankLabel(card)}</span>
      </div>
      <div class="rotate-180 self-end flex items-center gap-0.5 leading-none">
        <span class="text-sm font-bold leading-none">{rankLabel(card)}</span>
      </div>
    {/if}
  </div>
{:else}
  {@const colorClass = isRed(card) ? 'text-red-600' : 'text-slate-900'}
  <div
    class="relative w-full rounded-lg border border-indigo-500/50 p-1 flex flex-col items-start overflow-hidden bg-white select-none"
    style="aspect-ratio: 2 / 3;"
  >
    <div class="flex items-center gap-0.5 leading-none {colorClass}">
      <span class="text-sm font-bold leading-none">{rankLabel(card)}</span>
      <span class="text-xs leading-none">{card.suit}</span>
    </div>
    {#if !covered}
      {#if card.rank <= 10}
        <div class="w-full flex-1 relative {colorClass}">
          {#each (PIP_LAYOUTS[card.rank] ?? []) as [x, y, rot], i (i)}
            <span
              class="absolute leading-none select-none"
              style="left:{x}%; top:{y}%; transform:translate(-50%,-50%){rot ? ' rotate(180deg)' : ''}; font-size:{card.rank === 1 ? 18 : card.rank <= 4 ? 11 : card.rank <= 7 ? 10 : 9}px;"
            >{card.suit}</span>
          {/each}
        </div>
      {:else}
        <div class="w-full flex-1 flex items-center justify-center {colorClass}">
          <span class="leading-none" style="font-size:26px;">{FACE_CHAR[card.rank]}</span>
        </div>
      {/if}
      <div class="rotate-180 self-end flex items-center gap-0.5 leading-none {colorClass}">
        <span class="text-sm font-bold leading-none">{rankLabel(card)}</span>
        <span class="text-xs leading-none">{card.suit}</span>
      </div>
    {/if}
  </div>
{/if}
```

- [ ] **Step 2: 型チェック・ビルド**

Run: `npm run check && npm run build`
Expected: どちらもエラーなく成功(既存ファイルは未変更のため、既存の無関係なエラー数から変化がないことを確認する)

- [ ] **Step 3: コミット**

```bash
git add src/routes/game/shidasu/CardFace.svelte
git commit -m "$(cat <<'EOF'
feat: shidasuのカード描画をCardFace.svelteとして切り出し

/game/shidasuと/admin/shidasu-debugで重複していたカード1枚描画
(cardFaceスニペット・PIP_LAYOUTS・FACE_CHAR)を単一コンポーネント
として切り出した。この時点ではまだどこからも使われていない。
EOF
)"
```

---

### Task 2: `CardPalette.svelte`が`CardFace.svelte`を使うように変更する

**Files:**
- Modify: `src/routes/admin/shidasu-debug/CardPalette.svelte`
- Modify: `src/routes/admin/shidasu-debug/+page.svelte`

- [ ] **Step 1: `CardPalette.svelte`を変更する**

`src/routes/admin/shidasu-debug/CardPalette.svelte`の

```svelte
<script lang="ts">
  import type { Snippet } from 'svelte'
  import type { Card, Suit, Rank } from '$lib/game/shidasu/types'

  let { cardFace, onCardPointerDown, onUnifySuit }: {
    cardFace: Snippet<[card: Card, covered: boolean]>
    onCardPointerDown: (source: { suit: Suit; rank: Rank; wild: boolean }, e: PointerEvent) => void
    onUnifySuit: (suit: Suit) => void
  } = $props()

  const REAL_SUITS: Suit[] = ['♠', '♥', '♦', '♣']
  const RANKS: Rank[] = [1, 2, 3, 4, 5, 6, 7, 8, 9, 10, 11, 12, 13]
</script>
```

を、以下に置き換える。

```svelte
<script lang="ts">
  import type { Suit, Rank } from '$lib/game/shidasu/types'
  import CardFace from '../../game/shidasu/CardFace.svelte'

  let { onCardPointerDown, onUnifySuit }: {
    onCardPointerDown: (source: { suit: Suit; rank: Rank; wild: boolean }, e: PointerEvent) => void
    onUnifySuit: (suit: Suit) => void
  } = $props()

  const REAL_SUITS: Suit[] = ['♠', '♥', '♦', '♣']
  const RANKS: Rank[] = [1, 2, 3, 4, 5, 6, 7, 8, 9, 10, 11, 12, 13]
</script>
```

同ファイルの

```svelte
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
```

を、以下に置き換える。

```svelte
  <div class="grid gap-1" style="grid-template-columns: repeat(13, minmax(0, 1fr));">
    {#each REAL_SUITS as suit (suit)}
      {#each RANKS as rank (rank)}
        <div
          role="button"
          tabindex="0"
          onpointerdown={(e) => onCardPointerDown({ suit, rank, wild: false }, e)}
          class="cursor-grab active:cursor-grabbing touch-none"
        >
          <CardFace card={{ id: -1, suit, rank, wild: false }} covered={false} />
        </div>
      {/each}
    {/each}
    <div
      role="button"
      tabindex="0"
      onpointerdown={(e) => onCardPointerDown({ suit: '★', rank: 0, wild: true }, e)}
      class="cursor-grab active:cursor-grabbing touch-none"
    >
      <CardFace card={{ id: -1, suit: '★', rank: 0, wild: true }} covered={false} />
    </div>
  </div>
```

- [ ] **Step 2: `+page.svelte`の呼び出し箇所を変更する**

`src/routes/admin/shidasu-debug/+page.svelte`の

```svelte
      <CardPalette {cardFace} onCardPointerDown={onPaletteCardPointerDown} onUnifySuit={unifySuit} />
```

を、以下に置き換える。

```svelte
      <CardPalette onCardPointerDown={onPaletteCardPointerDown} onUnifySuit={unifySuit} />
```

- [ ] **Step 3: 型チェック・ビルド**

Run: `npm run check && npm run build`
Expected: どちらもエラーなく成功

- [ ] **Step 4: ブラウザで確認する**

`npm run dev`で起動し、`/admin/shidasu-debug`を開き、右側のカードパレットのカード表示が崩れていないこと、カードをドラッグして場札・山札に差し替えられることを確認する。

- [ ] **Step 5: コミット**

```bash
git add src/routes/admin/shidasu-debug/CardPalette.svelte src/routes/admin/shidasu-debug/+page.svelte
git commit -m "$(cat <<'EOF'
refactor: CardPaletteがCardFace.svelteを直接使うように変更

cardFaceをsnippet propとして受け渡す形をやめ、CardFace.svelteを
直接importする形にした。見た目・動作の変更はない。
EOF
)"
```

---

### Task 3: `PlayArea.svelte`を新規作成する

**Files:**
- Create: `src/routes/game/shidasu/PlayArea.svelte`

- [ ] **Step 1: `PlayArea.svelte`を作成する**

`src/routes/game/shidasu/+page.svelte`の`playArea`スニペットのうち、ステージ見出し行(スニペット冒頭の`stage.name`・ウェーブドット・`modifierLabel`の行)と末尾の護符バッジ一覧を除いた部分を元に、以下の内容で新規ファイルを作成する。

呼び出し元固有のコンテンツ(ステージ見出し行・護符バッジ一覧)は、それぞれ`headerExtra`・`extraFooter`という任意のsnippet propとして受け取れるようにする。デバッグサンドボックスのドラッグ&ドロップ用に`data-drop-col`・`data-drop-row`・`data-drop-stock`属性と、任意の`dropTarget`propによるハイライトも追加する。

```svelte
<script lang="ts">
  import type { Snippet } from 'svelte'
  import { getPlayableColumns, remainingCount } from '$lib/game/shidasu/engine'
  import type { WaveState, ShidasuParams, StageModifier, ItemId } from '$lib/game/shidasu/types'
  import CardFace from './CardFace.svelte'

  let {
    wave, params, modifier, target, items, onPlayCard, onDraw, dropTarget = null, headerExtra, extraFooter,
  }: {
    wave: WaveState
    params: ShidasuParams
    modifier: StageModifier
    target: number
    items: ItemId[]
    onPlayCard: (colIndex: number) => void
    onDraw: () => void
    dropTarget?: { col: number; row: number } | 'stockTop' | null
    headerExtra?: Snippet
    extraFooter?: Snippet
  } = $props()

  function chunk<T>(arr: T[], size: number): T[][] {
    const result: T[][] = []
    for (let i = 0; i < arr.length; i += size) {
      result.push(arr.slice(i, i + size))
    }
    return result
  }

  const comboColor = ['text-emerald-100', 'text-yellow-300', 'text-orange-400', 'text-rose-400']
  const comboScale = ['scale-100', 'scale-105', 'scale-110', 'scale-125']

  let playableCols = $derived(getPlayableColumns(modifier, wave))
  let remainingCards = $derived(remainingCount(wave.tableau))
  let displayComboTier = $derived.by(() => {
    const [t1, t2, t3] = params.ui.comboTierThresholds
    return wave.combo >= t3 ? 3 : wave.combo >= t2 ? 2 : wave.combo >= t1 ? 1 : 0
  })
  let chainEntries = $derived(wave.chain.map((c, i) => ({ card: c, origin: wave.chainOrigin[i] })))
  let chainRows = $derived(chunk(chainEntries, params.ui.chainCardsPerRow))
</script>

<div class="px-4 pt-3">
  {#if headerExtra}
    {@render headerExtra()}
  {/if}
  <div class="mt-2 flex items-end justify-between">
    <div>
      <div class="text-xs text-emerald-300/70 tracking-widest">SCORE / TARGET</div>
      <div class="text-xl font-black text-amber-50 tabular-nums">
        {wave.score} <span class="text-sm text-emerald-300/70">/ {target}</span>
      </div>
    </div>
    <div class="text-right transition-transform origin-bottom-right {comboScale[displayComboTier]}">
      <div class="text-xs text-emerald-300/70 tracking-widest">COMBO</div>
      <div class="text-3xl font-black italic tabular-nums leading-none {comboColor[displayComboTier]}">×{wave.combo}</div>
    </div>
  </div>
  <div class="mt-1 h-1.5 rounded-full bg-emerald-900 overflow-hidden">
    <div class="h-full bg-gradient-to-r from-yellow-500 to-yellow-300 transition-all duration-300" style="width:{Math.min(100, (wave.score / target) * 100)}%"></div>
  </div>
  {#if wave.lastGain || wave.lastBonusGains.length > 0}
    {@const totalPoints = (wave.lastGain?.points ?? 0) + wave.lastBonusGains.reduce((sum, g) => sum + g.points, 0)}
    {@const allParts = [...(wave.lastGain?.parts ?? []), ...wave.lastBonusGains.flatMap(g => g.parts)]}
    <div class="text-right text-sm h-5">
      <span class="text-yellow-300 font-black">+{totalPoints}</span>
      {#if allParts.length > 0}
        <span class="text-emerald-200 text-xs ml-2">{allParts.join(' ')}</span>
      {/if}
    </div>
  {:else}
    <div class="h-5"></div>
  {/if}
</div>

<div class="px-3 pt-1">
  <div class="grid gap-1" style="grid-template-columns: repeat({params.layout.cols}, minmax(0, 1fr));">
    {#each wave.tableau as col, ci (ci)}
      <div class="relative" style="min-height: 10.5rem;">
        {#each col as card, ri (card.id)}
          {@const isTop = ri === col.length - 1}
          <div
            class="absolute left-0 right-0 {dropTarget && dropTarget !== 'stockTop' && dropTarget.col === ci && dropTarget.row === ri ? 'ring-4 ring-sky-400 rounded-lg' : ''}"
            style="top:{ri * 18}px; z-index:{ri};"
            data-drop-col={ci}
            data-drop-row={ri}
          >
            {#if isTop}
              <button
                type="button"
                onclick={() => onPlayCard(ci)}
                class="w-full text-left {playableCols.has(ci) ? 'ring-2 ring-yellow-300 shadow-lg -translate-y-0.5' : ''} transition-transform"
              >
                <CardFace {card} covered={false} />
              </button>
            {:else}
              <CardFace {card} covered={true} />
            {/if}
          </div>
        {/each}
      </div>
    {/each}
  </div>
  <div
    class="text-center text-emerald-300/80 text-xs mt-16 animate-pulse {playableCols.size === 0 && wave.stock.length > 0 && remainingCards > 0 ? '' : 'invisible'}"
  >取れる札がない → 山札をめくろう</div>
</div>

<div class="px-4 text-center text-yellow-300 text-xs font-black animate-pulse mb-1 {wave.lastDrawEffect === 'pattern' ? '' : 'invisible'}">✦ パターン継続! ✦</div>

<div class="px-4 pb-5 pt-2 flex items-start gap-4">
  <button
    type="button"
    onclick={onDraw}
    disabled={wave.stock.length === 0}
    data-drop-stock
    style="aspect-ratio: 2 / 3; margin-top:20px;"
    class="w-16 shrink-0 rounded-lg border-2 flex flex-col items-center justify-center font-black active:scale-95 transition-transform {dropTarget === 'stockTop' ? 'ring-4 ring-sky-400' : ''} {wave.stock.length > 0 ? 'bg-emerald-700 border-emerald-500 text-amber-50' : 'bg-emerald-900 border-emerald-800 text-emerald-700'}"
  >
    <div class="text-xs">山札</div>
    <div class="text-lg tabular-nums">{wave.stock.length}</div>
  </button>
  {#if items.includes('guidance') && wave.stock.length > 0}
    {@const nextCard = wave.stock[wave.stock.length - 1]}
    <div class="flex flex-col items-center justify-center" style="margin-top:20px;">
      <div class="text-[10px] text-emerald-300/70 mb-1">次の札</div>
      <CardFace card={nextCard} covered={false} />
    </div>
  {/if}
  <div class="overflow-x-auto min-w-0">
    {#each chainRows as row, ri (ri)}
      <div class="relative" style="height:116px; width:{64 + (row.length - 1) * params.ui.chainCardOffsetX}px;">
        {#each row as entry, j (entry.card.id)}
          <div
            class="absolute"
            style="left:{j * params.ui.chainCardOffsetX}px; top:{entry.origin === 'draw' ? 20 : 0}px; z-index:{j + 1}; width:64px;"
          >
            <CardFace card={entry.card} covered={false} />
          </div>
        {/each}
      </div>
    {/each}
  </div>
  {#if extraFooter}
    {@render extraFooter()}
  {/if}
</div>
```

- [ ] **Step 2: 型チェック・ビルド**

Run: `npm run check && npm run build`
Expected: どちらもエラーなく成功(この時点ではまだどこからも使われていないため、新規未使用エラーは出ない)

- [ ] **Step 3: コミット**

```bash
git add src/routes/game/shidasu/PlayArea.svelte
git commit -m "$(cat <<'EOF'
feat: shidasuのプレイエリアをPlayArea.svelteとして切り出し

/game/shidasuのplayAreaスニペットから、スコア/コンボヘッダー・
場札グリッド・山札・チェーン表示を共有コンポーネントとして切り出した。
ステージ見出し・護符バッジ一覧は呼び出し元固有のためheaderExtra・
extraFooterのsnippet propとして差し込めるようにした。この時点では
まだどこからも使われていない。
EOF
)"
```

---

### Task 4: `/game/shidasu/+page.svelte`が`PlayArea`を使うように変更する

**Files:**
- Modify: `src/routes/game/shidasu/+page.svelte`(全体を書き換える)

- [ ] **Step 1: `+page.svelte`を書き換える**

`src/routes/game/shidasu/+page.svelte`の内容全体を、以下に置き換える。

```svelte
<script lang="ts">
  import { onDestroy } from 'svelte'
  import { loadParams } from '$lib/game/shidasu/params'
  import {
    createInitialRun, beginRun, applyPlayCard, applyDrawStock, applyStuckCheck,
    resolveWaveEnd, pickItem, confirmItemSwap, cancelItemSwap, skipItemSelect,
    advanceStage, restartRun, startWave, forceStockTop,
    itemDesc, itemName,
  } from '$lib/game/shidasu/engine'
  import { standardDeckComposition } from '$lib/game/shidasu/deck'
  import type { RunState, ItemId, StageModifier, Suit, Rank } from '$lib/game/shidasu/types'
  import DebugPanel from './DebugPanel.svelte'
  import PlayArea from './PlayArea.svelte'

  const params = loadParams()

  // タイトル画面の高さをプレイ画面に揃えるための計測専用ダミーウェーブ(実際のゲームには使わない)
  const measurementWave = startWave(params, 0, 0, [], standardDeckComposition(), 1).wave
  let measuredPlayHeight = $state(0)

  let run = $state<RunState>(createInitialRun())
  // ウェーブ終了系のタイマーは常にこの1本にまとめ、次の予約前に必ず前の分をキャンセルする
  // (手詰まりチェックと目標達成遅延を別々のタイマーで管理すると、片方が発火しないまま
  //  もう片方も発火してresolveWaveEndが二重に走り、アイテム選択肢が無言ですり替わるため)
  let pendingTimer: ReturnType<typeof setTimeout> | null = null

  function clearPendingTimer() {
    if (pendingTimer) clearTimeout(pendingTimer)
    pendingTimer = null
  }

  onDestroy(clearPendingTimer)

  let stage = $derived(params.stages[run.stageIndex])
  let target = $derived(stage.targets[run.waveIndex])
  let wave = $derived(run.wave)

  function modifierLabel(modifier: StageModifier): string {
    if (modifier === 'noLoop') return 'A-Kループ禁止'
    if (modifier === 'faceLock') return '絵札はコンボ2以上でのみ取れる'
    return '制約なし'
  }

  function scheduleStuckCheck() {
    clearPendingTimer()
    pendingTimer = setTimeout(() => {
      pendingTimer = null
      const checked = applyStuckCheck(params, run)
      // 不屈の護符による復活はstatusが'playing'のまま(手詰まりだけ解消される)ため、
      // ここは必ず無条件でrunへ反映すること。「status==='ended'の時だけ反映」に戻すと、
      // 復活結果(捨て札→山札・スコア消費)が画面に一切反映されず実質操作不能になる。
      run = checked
      if (checked.wave?.status === 'ended') {
        run = resolveWaveEnd(params, checked)
      }
    }, 600)
  }

  function afterAction() {
    clearPendingTimer()
    if (run.wave?.status === 'ended') {
      const delay = run.wave.endReason === 'target' ? params.flow.clearDelayMs : 0
      pendingTimer = setTimeout(() => {
        pendingTimer = null
        run = resolveWaveEnd(params, run)
      }, delay)
      return
    }
    scheduleStuckCheck()
  }

  function startGame() {
    run = beginRun(params)
    afterAction()
  }

  function handlePlayCard(colIndex: number) {
    if (run.phase !== 'playing' || run.wave?.status !== 'playing') return
    run = applyPlayCard(params, run, colIndex)
    afterAction()
  }

  function handleDraw() {
    if (run.phase !== 'playing' || run.wave?.status !== 'playing') return
    run = applyDrawStock(params, run)
    afterAction()
  }

  function handlePickItem(id: ItemId) {
    run = pickItem(params, run, id)
    if (run.phase === 'itemSelect') return // 上限到達時: 交換対象選択待ちのため、まだウェーブは進んでいない
    afterAction()
  }

  function handleSkipItem() {
    run = skipItemSelect(params, run)
    afterAction()
  }

  function handleConfirmSwap(oldItemId: ItemId) {
    run = confirmItemSwap(params, run, oldItemId)
    afterAction()
  }

  function handleCancelSwap() {
    run = cancelItemSwap(run)
  }

  function handleAdvanceStage() {
    run = advanceStage(params, run)
    afterAction()
  }

  function handleRestart() {
    run = restartRun(params)
    afterAction()
  }

  function handleForceDraw(suit: Suit, rank: Rank, wild: boolean) {
    if (!run.wave) return
    run = { ...run, wave: forceStockTop(run.wave, suit, rank, wild) }
    handleDraw()
  }
</script>

{#snippet stageRow()}
  <div class="flex items-center justify-between text-xs">
    <div class="flex items-center gap-2">
      <span class="font-black text-amber-50">{stage.name}</span>
      <span class="flex gap-1">
        {#each [0, 1, 2] as w (w)}
          <span class="w-2 h-2 rounded-full {w < run.waveIndex ? 'bg-yellow-400' : w === run.waveIndex ? 'bg-yellow-400 animate-pulse' : 'bg-emerald-800'}"></span>
        {/each}
      </span>
    </div>
    <span class="text-emerald-300/80">{modifierLabel(stage.modifier)}</span>
  </div>
{/snippet}

{#snippet itemBadges()}
  <div class="flex-1 flex flex-wrap gap-1 justify-end">
    {#each [...new Set(run.items)] as id (id)}
      {@const n = run.items.filter(x => x === id).length}
      <span class="text-xs bg-emerald-900 text-yellow-200/90 border border-yellow-600/40 rounded px-1.5 py-0.5">
        {itemName(id, params)}{n > 1 ? `×${n}` : ''}
      </span>
    {/each}
  </div>
{/snippet}

<div
  class="w-full flex flex-col bg-emerald-950 text-amber-50 mx-auto"
  style="user-select:none; max-width:480px; position:relative;"
>

{#if run.phase === 'title'}
  <!-- プレイ画面と同じ高さになるよう、画面外に隠して1度描画し実測する -->
  <div
    style="position:absolute; top:0; left:0; width:100%; visibility:hidden; pointer-events:none; z-index:-1;"
    aria-hidden="true"
    bind:offsetHeight={measuredPlayHeight}
  >
    <PlayArea wave={measurementWave} {params} modifier={stage.modifier} {target} items={run.items} onPlayCard={handlePlayCard} onDraw={handleDraw} headerExtra={stageRow} extraFooter={itemBadges} />
  </div>
  <div class="flex flex-col items-center justify-center gap-6 text-center px-6" style="min-height:{measuredPlayHeight}px;">
    <div>
      <div class="text-xs tracking-widest text-emerald-300/70 mb-2">SOLITAIRE ROGUE</div>
      <h1 class="text-4xl font-black text-amber-50">星詠みソリティア -Shidasu-</h1>
      <p class="text-emerald-100/70 text-sm mt-3 leading-relaxed">
        ランクの±1を連鎖で取ってスコアを稼ぐ<br />
        同スート・同色(3枚以上)・階段(同方向<br />
        5枚以上)でボーナスが乗る。場札を<br />
        全消しすると大きく加点され、3ウェーブ<br />
        突破でステージクリア。
      </p>
    </div>
    <button
      onclick={startGame}
      class="px-10 py-3 rounded-full bg-yellow-400 text-emerald-950 font-black text-lg active:scale-95 transition-transform"
    >
      はじめる
    </button>
  </div>

{:else if wave}
  <PlayArea {wave} {params} modifier={stage.modifier} {target} items={run.items} onPlayCard={handlePlayCard} onDraw={handleDraw} headerExtra={stageRow} extraFooter={itemBadges} />
{/if}

{#if run.phase === 'itemSelect'}
  <div class="fixed inset-0 z-50 bg-emerald-950/90 backdrop-blur-sm flex items-center justify-center p-6">
    <div class="w-full max-w-sm flex flex-col items-center text-center">
      <div class="text-yellow-300 text-xs tracking-widest mb-1">WAVE {run.waveIndex + 1} CLEAR</div>
      <div class="text-2xl font-black text-amber-50 mb-4">{run.wave?.score ?? 0} 点</div>
      {#if run.pendingNewItem === null}
        <div class="text-emerald-100/70 text-sm mb-4">アイテムを1つ選ぶ</div>
        <div class="flex flex-col gap-3 w-full">
          {#each run.offer as id (id)}
            <button
              onclick={() => handlePickItem(id)}
              class="text-left bg-emerald-900/80 border border-yellow-500/40 rounded-xl px-4 py-3 active:scale-[0.98] transition-transform"
            >
              <div class="font-black text-yellow-300">{itemName(id, params)}</div>
              <div class="text-xs text-emerald-100/80 mt-0.5">{itemDesc(id, params)}</div>
            </button>
          {/each}
          <button
            onclick={handleSkipItem}
            class="text-center text-emerald-200/70 border border-emerald-700/60 rounded-xl px-4 py-2 active:scale-[0.98] transition-transform"
          >
            取得しない
          </button>
        </div>
      {:else}
        <div class="text-emerald-100/70 text-sm mb-4">護符は最大{params.items.maxItems}個まで。入れ替える護符を選ぶ</div>
        <div class="flex flex-col gap-3 w-full">
          {#each run.items as id, i (i)}
            <button
              onclick={() => handleConfirmSwap(id)}
              class="text-left bg-emerald-900/80 border border-yellow-500/40 rounded-xl px-4 py-3 active:scale-[0.98] transition-transform"
            >
              <div class="font-black text-yellow-300">{itemName(id, params)}</div>
              <div class="text-xs text-emerald-100/80 mt-0.5">{itemDesc(id, params)}</div>
            </button>
          {/each}
          <button
            onclick={handleCancelSwap}
            class="text-center text-emerald-200/70 border border-emerald-700/60 rounded-xl px-4 py-2 active:scale-[0.98] transition-transform"
          >
            戻る
          </button>
        </div>
      {/if}
    </div>
  </div>
{:else if run.phase === 'stageClear'}
  <div class="fixed inset-0 z-50 bg-emerald-950/90 backdrop-blur-sm flex items-center justify-center p-6">
    <div class="w-full max-w-sm flex flex-col items-center text-center">
      <div class="text-yellow-300 text-xs tracking-widest mb-2">STAGE CLEAR</div>
      <div class="text-3xl font-black text-amber-50 mb-4">{stage.name} 突破!</div>
      <div class="bg-emerald-900/80 border border-emerald-500/40 rounded-xl px-4 py-3 mb-5 text-sm">
        <div class="text-emerald-300/80 text-xs mb-1">次のステージの制約</div>
        <div class="font-bold text-amber-50">{modifierLabel(params.stages[run.stageIndex + 1].modifier)}</div>
      </div>
      <button onclick={handleAdvanceStage} class="px-10 py-3 rounded-full bg-yellow-400 text-emerald-950 font-black active:scale-95 transition-transform">
        次のステージへ
      </button>
    </div>
  </div>
{:else if run.phase === 'allClear'}
  <div class="fixed inset-0 z-50 bg-emerald-950/90 backdrop-blur-sm flex items-center justify-center p-6">
    <div class="w-full max-w-sm flex flex-col items-center text-center">
      <div class="text-3xl font-black text-yellow-300 mb-2">全ステージクリア!</div>
      <div class="text-emerald-100/80 text-sm mb-6">全ての山を制覇した</div>
      <button onclick={handleRestart} class="px-10 py-3 rounded-full bg-yellow-400 text-emerald-950 font-black active:scale-95">
        もう一度
      </button>
    </div>
  </div>
{:else if run.phase === 'gameOver'}
  <div class="fixed inset-0 z-50 bg-emerald-950/90 backdrop-blur-sm flex items-center justify-center p-6">
    <div class="w-full max-w-sm flex flex-col items-center text-center">
      <div class="text-rose-400 text-xs tracking-widest mb-2">GAME OVER</div>
      <div class="text-2xl font-black text-amber-50 mb-1">{run.wave?.score ?? 0} / {target}</div>
      <div class="text-emerald-100/70 text-sm mb-6">目標スコアに届かなかった</div>
      <button onclick={handleRestart} class="px-10 py-3 rounded-full bg-yellow-400 text-emerald-950 font-black active:scale-95">
        最初から
      </button>
    </div>
  </div>
{/if}

</div>

{#if import.meta.env.DEV && wave}
  <div class="w-full mx-auto" style="max-width:480px;">
    <DebugPanel {wave} onForceDraw={handleForceDraw} />
  </div>
{/if}
```

- [ ] **Step 2: 型チェック・ビルド**

Run: `npm run check && npm run build`
Expected: どちらもエラーなく成功

- [ ] **Step 3: ブラウザで確認する**

`npm run dev`で起動し、`/game/shidasu`を開き、以下を確認する。

- タイトル画面の高さが崩れていない(プレイ画面と同じ高さになっている)
- 「はじめる」を押してプレイ画面に遷移でき、スコア/コンボ/進捗バー・場札・山札・チェーン・護符バッジ一覧の見た目がリファクタリング前と変わっていない
- 場札をクリックしてプレイできる、山札をクリックしてめくれる
- 護符を1つ以上所持した状態でプレイし、獲得点ポップアップが表示される

- [ ] **Step 4: コミット**

```bash
git add src/routes/game/shidasu/+page.svelte
git commit -m "$(cat <<'EOF'
refactor: /game/shidasuがPlayArea.svelteを使うように変更

playAreaスニペットをPlayArea.svelteコンポーネント呼び出しに置き換えた。
ステージ見出し行・護符バッジ一覧はheaderExtra・extraFooter snippetとして
渡す。見た目・動作の変更はない。
EOF
)"
```

---

### Task 5: デバッグサンドボックスが`PlayArea`・`CardFace`を使うように変更する

**Files:**
- Modify: `src/routes/admin/shidasu-debug/+page.svelte`(全体を書き換える)

- [ ] **Step 1: `+page.svelte`を書き換える**

`src/routes/admin/shidasu-debug/+page.svelte`の内容全体を、以下に置き換える。自前の場札グリッド・山札・チェーン描画コード(`cardFace`スニペット・`PIP_LAYOUTS`・`FACE_CHAR`含む)を削除し、`PlayArea`・`CardFace`を使う。トップの操作ボタン列・`DebugStatePanel`・`CardPalette`・`ItemChecklist`はそのまま残す。「元に戻す」の一般化・デッキリセット・localStorage永続化は次タスク以降で追加するため、この時点では`lastSwap`のロジック自体は変更しない(呼び出し方のみ変更)。

```svelte
<script lang="ts">
  import { onMount } from 'svelte'
  import { loadParams } from '$lib/game/shidasu/params'
  import { startWave, playCard, drawStock, forceStockTop, ITEM_POOL } from '$lib/game/shidasu/engine'
  import { standardDeckComposition } from '$lib/game/shidasu/deck'
  import type { WaveState, Card, ItemId, DeckCard, Suit, Rank } from '$lib/game/shidasu/types'
  import ItemChecklist from './ItemChecklist.svelte'
  import DebugStatePanel from './DebugStatePanel.svelte'
  import CardPalette from './CardPalette.svelte'
  import CardFace from '../../game/shidasu/CardFace.svelte'
  import PlayArea from '../../game/shidasu/PlayArea.svelte'

  const params = loadParams()
  const TARGET = Number.MAX_SAFE_INTEGER

  let items = $state<ItemId[]>([])
  let deckComposition = $state<DeckCard[]>(standardDeckComposition())
  let wave = $state<WaveState>(startWave(params, 0, 0, items, deckComposition).wave)
  let lastSwap = $state<{ location: { col: number; row: number } | 'stockTop'; previousCard: Card } | null>(null)

  interface DragState {
    source: { suit: Suit; rank: Rank; wild: boolean }
    startX: number
    startY: number
    currentX: number
    currentY: number
    isDragging: boolean
    pointerId: number
  }
  let dragState = $state<DragState | null>(null)
  let dropTarget = $state<{ col: number; row: number } | 'stockTop' | null>(null)

  function newWave() {
    const result = startWave(params, 0, 0, items, deckComposition)
    wave = result.wave
    deckComposition = result.deckComposition
    lastSwap = null
  }

  function handlePlayCard(colIndex: number) {
    wave = playCard(params, wave, 'none', items, TARGET, colIndex)
    lastSwap = null
  }

  function handleDraw() {
    const result = drawStock(params, wave, items, deckComposition, 'none')
    wave = result.wave
    deckComposition = result.deckComposition
    lastSwap = null
  }

  function handleToggleItem(id: ItemId, checked: boolean) {
    if (checked) {
      if (!items.includes(id)) items = [...items, id]
    } else {
      items = items.filter(x => x !== id)
    }
    lastSwap = null
  }

  function handleSetAllItems(checked: boolean) {
    items = checked ? [...ITEM_POOL] : []
    lastSwap = null
  }

  function handleForceDraw(suit: Suit, rank: Rank, wild: boolean) {
    wave = forceStockTop(wave, suit, rank, wild)
    const result = drawStock(params, wave, items, deckComposition, 'none')
    wave = result.wave
    deckComposition = result.deckComposition
    lastSwap = null
  }

  function onPaletteCardPointerDown(source: { suit: Suit; rank: Rank; wild: boolean }, e: PointerEvent) {
    e.preventDefault()
    dragState = {
      source,
      startX: e.clientX,
      startY: e.clientY,
      currentX: e.clientX,
      currentY: e.clientY,
      isDragging: false,
      pointerId: e.pointerId,
    }
  }

  function updateDropTarget(x: number, y: number) {
    const els = document.elementsFromPoint(x, y)
    for (const el of els) {
      const colEl = (el as HTMLElement).closest?.('[data-drop-col]') as HTMLElement | null
      if (colEl) {
        dropTarget = { col: Number(colEl.dataset.dropCol), row: Number(colEl.dataset.dropRow) }
        return
      }
      const stockEl = (el as HTMLElement).closest?.('[data-drop-stock]') as HTMLElement | null
      if (stockEl) {
        dropTarget = 'stockTop'
        return
      }
    }
    dropTarget = null
  }

  function applySwap(target: { col: number; row: number } | 'stockTop', source: { suit: Suit; rank: Rank; wild: boolean }) {
    if (target === 'stockTop') {
      if (wave.stock.length === 0) return
      const idx = wave.stock.length - 1
      const previousCard = wave.stock[idx]
      const newCard: Card = { id: previousCard.id, suit: source.suit, rank: source.rank, wild: source.wild }
      wave = { ...wave, stock: wave.stock.map((c, i) => (i === idx ? newCard : c)), lastGain: null, lastBonusGains: [] }
      lastSwap = { location: 'stockTop', previousCard }
    } else {
      const { col, row } = target
      const column = wave.tableau[col]
      if (!column?.[row]) return
      const previousCard = column[row]
      const newCard: Card = { id: previousCard.id, suit: source.suit, rank: source.rank, wild: source.wild }
      wave = {
        ...wave,
        tableau: wave.tableau.map((c, ci) => (ci === col ? c.map((cc, ri) => (ri === row ? newCard : cc)) : c)),
        lastGain: null,
        lastBonusGains: [],
      }
      lastSwap = { location: { col, row }, previousCard }
    }
  }

  function unifySuit(suit: Suit) {
    wave = {
      ...wave,
      tableau: wave.tableau.map(col => col.map(c => (c.wild ? c : { ...c, suit }))),
      lastGain: null,
      lastBonusGains: [],
    }
    lastSwap = null
  }

  function stairifyTableau() {
    if (wave.tableau.length === 0 || wave.tableau[0].length === 0) return
    // 列優先: 列0を手前(末尾)→奥(先頭)、次に列1を手前→奥…の順に走査する
    const order: { ci: number; ri: number }[] = []
    wave.tableau.forEach((col, ci) => {
      for (let ri = col.length - 1; ri >= 0; ri--) order.push({ ci, ri })
    })
    const baseRank = wave.tableau[0][wave.tableau[0].length - 1].rank
    const newRanks = new Map<string, Rank>()
    order.forEach(({ ci, ri }, i) => {
      const rank = (((baseRank - 1 + i) % 13) + 1) as Rank
      newRanks.set(`${ci}-${ri}`, rank)
    })
    wave = {
      ...wave,
      tableau: wave.tableau.map((col, ci) => col.map((c, ri) => ({ ...c, rank: newRanks.get(`${ci}-${ri}`) as Rank }))),
      lastGain: null,
      lastBonusGains: [],
    }
    lastSwap = null
  }

  function handleUndo() {
    if (!lastSwap) return
    const swap = lastSwap
    if (swap.location === 'stockTop') {
      const idx = wave.stock.length - 1
      wave = { ...wave, stock: wave.stock.map((c, i) => (i === idx ? swap.previousCard : c)), lastGain: null, lastBonusGains: [] }
    } else {
      const { col, row } = swap.location
      wave = {
        ...wave,
        tableau: wave.tableau.map((c, ci) => (ci === col ? c.map((cc, ri) => (ri === row ? swap.previousCard : cc)) : c)),
        lastGain: null,
        lastBonusGains: [],
      }
    }
    lastSwap = null
  }

  onMount(() => {
    function onPointerMove(e: PointerEvent) {
      if (!dragState || e.pointerId !== dragState.pointerId) return
      const dx = e.clientX - dragState.startX
      const dy = e.clientY - dragState.startY
      const isDragging = dragState.isDragging || Math.sqrt(dx * dx + dy * dy) > 5
      dragState = { ...dragState, currentX: e.clientX, currentY: e.clientY, isDragging }
      if (isDragging) updateDropTarget(e.clientX, e.clientY)
    }
    function onPointerUp(e: PointerEvent) {
      if (!dragState || e.pointerId !== dragState.pointerId) return
      if (dragState.isDragging && dropTarget) {
        applySwap(dropTarget, dragState.source)
      }
      dragState = null
      dropTarget = null
    }
    window.addEventListener('pointermove', onPointerMove)
    window.addEventListener('pointerup', onPointerUp)
    return () => {
      window.removeEventListener('pointermove', onPointerMove)
      window.removeEventListener('pointerup', onPointerUp)
    }
  })
</script>

<svelte:head>
  <title>Shidasu デバッグサンドボックス</title>
</svelte:head>

<div class="min-h-screen bg-slate-50 px-4 py-4">
  <div class="flex items-center justify-between mb-3">
    <h1 class="text-lg font-bold text-slate-800">Shidasu デバッグサンドボックス</h1>
    <div class="flex items-center gap-2">
      <button type="button" onclick={stairifyTableau} class="px-3 py-1.5 rounded bg-indigo-600 text-white text-sm font-bold">場札を階段にする</button>
      <button type="button" onclick={handleUndo} disabled={!lastSwap} class="px-3 py-1.5 rounded text-sm font-bold {lastSwap ? 'bg-amber-500 text-white' : 'bg-slate-200 text-slate-400'}">元に戻す</button>
      <button type="button" onclick={newWave} class="px-3 py-1.5 rounded bg-teal-600 text-white text-sm font-bold">新しいウェーブ</button>
    </div>
  </div>

  <div class="grid gap-4 items-start" style="grid-template-columns: 1fr 360px;">
    <div class="bg-emerald-950 rounded-lg p-3">
      <PlayArea {wave} {params} modifier={'none'} target={TARGET} {items} onPlayCard={handlePlayCard} onDraw={handleDraw} {dropTarget} />
      <div class="mt-4">
        <DebugStatePanel {wave} {items} onForceDraw={handleForceDraw} />
      </div>
    </div>
    <div class="space-y-4">
      <CardPalette onCardPointerDown={onPaletteCardPointerDown} onUnifySuit={unifySuit} />
      <ItemChecklist {items} onToggle={handleToggleItem} onSetAll={handleSetAllItems} />
    </div>
  </div>

  {#if dragState?.isDragging}
    <div class="fixed pointer-events-none z-50" style="left:{dragState.currentX - 32}px; top:{dragState.currentY - 48}px; width:64px;">
      <CardFace card={{ id: -1, suit: dragState.source.suit, rank: dragState.source.rank, wild: dragState.source.wild }} covered={false} />
    </div>
  {/if}
</div>
```

- [ ] **Step 2: 型チェック・ビルド**

Run: `npm run check && npm run build`
Expected: どちらもエラーなく成功

- [ ] **Step 3: ブラウザで確認する(重要なチェックポイント)**

`npm run dev`で起動し、`/admin/shidasu-debug`を開き、以下を確認する。

- プレイエリアが`/game/shidasu`と同じ見た目(スコア/コンボヘッダー・進捗バー・場札・山札・チェーン)になっている
- 場札をクリックしてプレイできる、山札をクリックしてめくれる
- カードパレットからカードをドラッグして場札・山札に差し替えられる(ドラッグ中のゴースト表示・ドロップ先のハイライトが機能する)
- 「場札を階段にする」「各スートに統一」ボタンが機能する
- 「元に戻す」ボタンが、カードスワップ後は有効になり、押すと元に戻る(階段化・スート統一後の「元に戻す」対応は次タスクで実装するため、この時点ではまだ機能しなくてよい)

- [ ] **Step 4: コミット**

```bash
git add src/routes/admin/shidasu-debug/+page.svelte
git commit -m "$(cat <<'EOF'
refactor: デバッグサンドボックスがPlayArea.svelte・CardFace.svelteを
使うように変更

自前の場札グリッド・山札・チェーン描画コードを削除し、/game/shidasuと
共通のPlayArea.svelte・CardFace.svelteを使うようにした。ドラッグ&
ドロップ用のdata属性・dropTargetハイライトはPlayArea側に統合済み。
EOF
)"
```

---

### Task 6: 「元に戻す」を階段化・スート統一にも対応させる

**Files:**
- Modify: `src/routes/admin/shidasu-debug/+page.svelte`

- [ ] **Step 1: `lastSwap`を`lastSnapshot`に一般化する**

`src/routes/admin/shidasu-debug/+page.svelte`の

```svelte
  let lastSwap = $state<{ location: { col: number; row: number } | 'stockTop'; previousCard: Card } | null>(null)
```

を、以下に置き換える。

```svelte
  let lastSnapshot = $state<{ tableau: Card[][]; stock: Card[] } | null>(null)
```

同ファイル内の以下5箇所の`lastSwap = null`を`lastSnapshot = null`に置き換える(`newWave`・`handlePlayCard`・`handleDraw`・`handleToggleItem`・`handleSetAllItems`・`handleForceDraw`の各関数内。`handleToggleItem`・`handleSetAllItems`は元々`lastSwap = null`が末尾に1回ずつあるので忘れず含める)。

```bash
sed -i 's/lastSwap = null/lastSnapshot = null/g' src/routes/admin/shidasu-debug/+page.svelte
```

(このコマンドは`applySwap`・`unifySuit`・`stairifyTableau`・`handleUndo`内の`lastSwap`関連コードには一致しない。それらはStep 2〜4で個別に書き換える。)

- [ ] **Step 2: `applySwap`を変更する**

```svelte
  function applySwap(target: { col: number; row: number } | 'stockTop', source: { suit: Suit; rank: Rank; wild: boolean }) {
    if (target === 'stockTop') {
      if (wave.stock.length === 0) return
      const idx = wave.stock.length - 1
      const previousCard = wave.stock[idx]
      const newCard: Card = { id: previousCard.id, suit: source.suit, rank: source.rank, wild: source.wild }
      wave = { ...wave, stock: wave.stock.map((c, i) => (i === idx ? newCard : c)), lastGain: null, lastBonusGains: [] }
      lastSwap = { location: 'stockTop', previousCard }
    } else {
      const { col, row } = target
      const column = wave.tableau[col]
      if (!column?.[row]) return
      const previousCard = column[row]
      const newCard: Card = { id: previousCard.id, suit: source.suit, rank: source.rank, wild: source.wild }
      wave = {
        ...wave,
        tableau: wave.tableau.map((c, ci) => (ci === col ? c.map((cc, ri) => (ri === row ? newCard : cc)) : c)),
        lastGain: null,
        lastBonusGains: [],
      }
      lastSwap = { location: { col, row }, previousCard }
    }
  }
```

を、以下に置き換える。

```svelte
  function applySwap(target: { col: number; row: number } | 'stockTop', source: { suit: Suit; rank: Rank; wild: boolean }) {
    if (target === 'stockTop') {
      if (wave.stock.length === 0) return
      const idx = wave.stock.length - 1
      const newCard: Card = { id: wave.stock[idx].id, suit: source.suit, rank: source.rank, wild: source.wild }
      lastSnapshot = { tableau: wave.tableau, stock: wave.stock }
      wave = { ...wave, stock: wave.stock.map((c, i) => (i === idx ? newCard : c)), lastGain: null, lastBonusGains: [] }
    } else {
      const { col, row } = target
      const column = wave.tableau[col]
      if (!column?.[row]) return
      const newCard: Card = { id: column[row].id, suit: source.suit, rank: source.rank, wild: source.wild }
      lastSnapshot = { tableau: wave.tableau, stock: wave.stock }
      wave = {
        ...wave,
        tableau: wave.tableau.map((c, ci) => (ci === col ? c.map((cc, ri) => (ri === row ? newCard : cc)) : c)),
        lastGain: null,
        lastBonusGains: [],
      }
    }
  }
```

- [ ] **Step 3: `unifySuit`・`stairifyTableau`を変更する**

```svelte
  function unifySuit(suit: Suit) {
    wave = {
      ...wave,
      tableau: wave.tableau.map(col => col.map(c => (c.wild ? c : { ...c, suit }))),
      lastGain: null,
      lastBonusGains: [],
    }
    lastSnapshot = null
  }
```

を、以下に置き換える。

```svelte
  function unifySuit(suit: Suit) {
    lastSnapshot = { tableau: wave.tableau, stock: wave.stock }
    wave = {
      ...wave,
      tableau: wave.tableau.map(col => col.map(c => (c.wild ? c : { ...c, suit }))),
      lastGain: null,
      lastBonusGains: [],
    }
  }
```

```svelte
  function stairifyTableau() {
    if (wave.tableau.length === 0 || wave.tableau[0].length === 0) return
    // 列優先: 列0を手前(末尾)→奥(先頭)、次に列1を手前→奥…の順に走査する
    const order: { ci: number; ri: number }[] = []
    wave.tableau.forEach((col, ci) => {
      for (let ri = col.length - 1; ri >= 0; ri--) order.push({ ci, ri })
    })
    const baseRank = wave.tableau[0][wave.tableau[0].length - 1].rank
    const newRanks = new Map<string, Rank>()
    order.forEach(({ ci, ri }, i) => {
      const rank = (((baseRank - 1 + i) % 13) + 1) as Rank
      newRanks.set(`${ci}-${ri}`, rank)
    })
    wave = {
      ...wave,
      tableau: wave.tableau.map((col, ci) => col.map((c, ri) => ({ ...c, rank: newRanks.get(`${ci}-${ri}`) as Rank }))),
      lastGain: null,
      lastBonusGains: [],
    }
    lastSnapshot = null
  }
```

を、以下に置き換える。

```svelte
  function stairifyTableau() {
    if (wave.tableau.length === 0 || wave.tableau[0].length === 0) return
    // 列優先: 列0を手前(末尾)→奥(先頭)、次に列1を手前→奥…の順に走査する
    const order: { ci: number; ri: number }[] = []
    wave.tableau.forEach((col, ci) => {
      for (let ri = col.length - 1; ri >= 0; ri--) order.push({ ci, ri })
    })
    const baseRank = wave.tableau[0][wave.tableau[0].length - 1].rank
    const newRanks = new Map<string, Rank>()
    order.forEach(({ ci, ri }, i) => {
      const rank = (((baseRank - 1 + i) % 13) + 1) as Rank
      newRanks.set(`${ci}-${ri}`, rank)
    })
    lastSnapshot = { tableau: wave.tableau, stock: wave.stock }
    wave = {
      ...wave,
      tableau: wave.tableau.map((col, ci) => col.map((c, ri) => ({ ...c, rank: newRanks.get(`${ci}-${ri}`) as Rank }))),
      lastGain: null,
      lastBonusGains: [],
    }
  }
```

- [ ] **Step 4: `handleUndo`を変更する**

```svelte
  function handleUndo() {
    if (!lastSwap) return
    const swap = lastSwap
    if (swap.location === 'stockTop') {
      const idx = wave.stock.length - 1
      wave = { ...wave, stock: wave.stock.map((c, i) => (i === idx ? swap.previousCard : c)), lastGain: null, lastBonusGains: [] }
    } else {
      const { col, row } = swap.location
      wave = {
        ...wave,
        tableau: wave.tableau.map((c, ci) => (ci === col ? c.map((cc, ri) => (ri === row ? swap.previousCard : cc)) : c)),
        lastGain: null,
        lastBonusGains: [],
      }
    }
    lastSnapshot = null
  }
```

を、以下に置き換える。

```svelte
  function handleUndo() {
    if (!lastSnapshot) return
    wave = { ...wave, tableau: lastSnapshot.tableau, stock: lastSnapshot.stock, lastGain: null, lastBonusGains: [] }
    lastSnapshot = null
  }
```

- [ ] **Step 5: ボタンの参照箇所を変更する**

```svelte
      <button type="button" onclick={handleUndo} disabled={!lastSwap} class="px-3 py-1.5 rounded text-sm font-bold {lastSwap ? 'bg-amber-500 text-white' : 'bg-slate-200 text-slate-400'}">元に戻す</button>
```

を、以下に置き換える。

```svelte
      <button type="button" onclick={handleUndo} disabled={!lastSnapshot} class="px-3 py-1.5 rounded text-sm font-bold {lastSnapshot ? 'bg-amber-500 text-white' : 'bg-slate-200 text-slate-400'}">元に戻す</button>
```

- [ ] **Step 6: 型チェック・ビルド**

Run: `npm run check && npm run build`
Expected: どちらもエラーなく成功。`grep -n "lastSwap" src/routes/admin/shidasu-debug/+page.svelte`が0件であることを確認する。

- [ ] **Step 7: ブラウザで確認する**

`npm run dev`で起動し、`/admin/shidasu-debug`を開き、以下を確認する。

- 「場札を階段にする」を押した直後、「元に戻す」が有効になり、押すと階段化前の場札に戻る
- 「各スートに統一」ボタンのいずれかを押した直後、「元に戻す」が有効になり、押すとスート統一前の場札に戻る
- カードパレットからのドラッグスワップの直後も、従来通り「元に戻す」が機能する
- 上記いずれかの後にプレイ・山札めくり・アイテム切り替え・新しいウェーブを行うと、「元に戻す」が再び無効になる

- [ ] **Step 8: コミット**

```bash
git add src/routes/admin/shidasu-debug/+page.svelte
git commit -m "$(cat <<'EOF'
feat: デバッグサンドボックスの元に戻すを階段化・スート統一にも対応

lastSwap(スワップ1件のみ記憶)をlastSnapshot(直前操作前のtableau・
stockのスナップショット)に一般化し、「場札を階段にする」「各スートに
統一」ボタンの後も「元に戻す」で操作前の状態に戻せるようにした。
複数手の履歴は持たず、直前1操作のみ取り消し可能という既存の挙動は
維持している。
EOF
)"
```

---

### Task 7: 獲得ログのリセットボタンを追加する

**Files:**
- Modify: `src/routes/game/shidasu/DebugPanel.svelte`

- [ ] **Step 1: リセットボタンを追加する**

`src/routes/game/shidasu/DebugPanel.svelte`の

```svelte
  <section>
    <div class="font-bold text-slate-300 mb-1">獲得点ログ(新しい順)</div>
    <div class="max-h-24 overflow-y-auto space-y-0.5">
```

を、以下に置き換える。

```svelte
  <section>
    <div class="flex items-center justify-between mb-1">
      <div class="font-bold text-slate-300">獲得点ログ(新しい順)</div>
      <button type="button" onclick={() => (gainLog = [])} class="text-[10px] px-1.5 py-0.5 rounded border border-slate-600 text-slate-300 hover:bg-slate-800">リセット</button>
    </div>
    <div class="max-h-24 overflow-y-auto space-y-0.5">
```

- [ ] **Step 2: 型チェック・ビルド**

Run: `npm run check && npm run build`
Expected: どちらもエラーなく成功

- [ ] **Step 3: ブラウザで確認する**

`npm run dev`で起動し、`/admin/shidasu-debug`で何度かプレイして獲得点ログにエントリが溜まった状態で「リセット」ボタンを押し、ログが空になることを確認する。`/game/shidasu`側のデバッグパネルにも同じボタンが出ていることを確認する(実プレイのスコア計算には影響しないことも確認する)。

- [ ] **Step 4: コミット**

```bash
git add src/routes/game/shidasu/DebugPanel.svelte
git commit -m "$(cat <<'EOF'
feat: 獲得点ログにリセットボタンを追加

DebugPanel.svelte(ゲーム本体・デバッグサンドボックス共有)の
獲得点ログ見出しにリセットボタンを追加した。
EOF
)"
```

---

### Task 8: デッキリセットボタンを追加する

**Files:**
- Modify: `src/routes/admin/shidasu-debug/+page.svelte`

- [ ] **Step 1: `resetDeck`関数を追加する**

`src/routes/admin/shidasu-debug/+page.svelte`の

```svelte
  function newWave() {
    const result = startWave(params, 0, 0, items, deckComposition)
    wave = result.wave
    deckComposition = result.deckComposition
    lastSnapshot = null
  }
```

の直後に、以下を追加する。

```svelte

  function resetDeck() {
    deckComposition = standardDeckComposition()
  }
```

- [ ] **Step 2: ボタンを追加する**

```svelte
      <button type="button" onclick={newWave} class="px-3 py-1.5 rounded bg-teal-600 text-white text-sm font-bold">新しいウェーブ</button>
```

を、以下に置き換える。

```svelte
      <button type="button" onclick={newWave} class="px-3 py-1.5 rounded bg-teal-600 text-white text-sm font-bold">新しいウェーブ</button>
      <button type="button" onclick={resetDeck} class="px-3 py-1.5 rounded bg-rose-600 text-white text-sm font-bold">デッキリセット</button>
```

- [ ] **Step 3: 型チェック・ビルド**

Run: `npm run check && npm run build`
Expected: どちらもエラーなく成功

- [ ] **Step 4: ブラウザで確認する**

`npm run dev`で起動し、`/admin/shidasu-debug`で永劫・豊穣・静寂などの永続系護符をチェックした状態でプレイ・山札めくりを何度か行い(デッキ構成に永続的な変化が起きることを期待)、「デッキリセット」を押した後に「新しいウェーブ」を押すと標準デッキ構成から配られることを確認する。「デッキリセット」自体は現在のウェーブ(場札・山札)を変更しないことも確認する。

- [ ] **Step 5: コミット**

```bash
git add src/routes/admin/shidasu-debug/+page.svelte
git commit -m "$(cat <<'EOF'
feat: デバッグサンドボックスにデッキリセットボタンを追加

永劫・豊穣・静寂などの永続系護符によるdeckCompositionの永続的な
変化を、標準デッキ構成(standardDeckComposition)に戻すボタンを
追加した。現在プレイ中のウェーブ自体は変更しない。
EOF
)"
```

---

### Task 9: 護符のチェック状況をlocalStorageに保持・復元する

**Files:**
- Modify: `src/routes/admin/shidasu-debug/+page.svelte`

- [ ] **Step 1: 永続化用の関数と初期化・保存処理を追加する**

`src/routes/admin/shidasu-debug/+page.svelte`の

```svelte
  const params = loadParams()
  const TARGET = Number.MAX_SAFE_INTEGER

  let items = $state<ItemId[]>([])
```

を、以下に置き換える。

```svelte
  const params = loadParams()
  const TARGET = Number.MAX_SAFE_INTEGER
  const ITEMS_STORAGE_KEY = 'shidasu-debug-items'

  function loadSavedItems(): ItemId[] {
    try {
      const saved = localStorage.getItem(ITEMS_STORAGE_KEY)
      if (!saved) return []
      const parsed = JSON.parse(saved)
      return Array.isArray(parsed) ? (parsed as ItemId[]) : []
    } catch {
      return []
    }
  }

  let items = $state<ItemId[]>(loadSavedItems())
```

- [ ] **Step 2: `items`変更時の保存処理を追加する**

`src/routes/admin/shidasu-debug/+page.svelte`の`onMount(() => { ... })`ブロックの直前に、以下を追加する。

```svelte

  $effect(() => {
    try { localStorage.setItem(ITEMS_STORAGE_KEY, JSON.stringify(items)) } catch {}
  })
```

- [ ] **Step 3: 型チェック・ビルド**

Run: `npm run check && npm run build`
Expected: どちらもエラーなく成功(このプロジェクトは全ページprerender構成のため、`localStorage`アクセスを`try/catch`で囲んでいないとビルド時にエラーになる点に注意。`npm run build`が通ることで、prerender時に例外が起きていないことを確認する)

- [ ] **Step 4: ブラウザで確認する**

`npm run dev`で起動し、`/admin/shidasu-debug`でいくつか護符をチェックしてからページをリロードし、チェック状態が復元されることを確認する。ブラウザの開発者ツールでlocalStorageの`shidasu-debug-items`キーに値が保存されていることも確認する。

- [ ] **Step 5: コミット**

```bash
git add src/routes/admin/shidasu-debug/+page.svelte
git commit -m "$(cat <<'EOF'
feat: デバッグサンドボックスの護符チェック状況をlocalStorageに保持

itemsの変更をlocalStorage(キー: shidasu-debug-items)に保存し、
ページ読み込み時に復元するようにした。/game/solitaireの永続化
パターン(try/catchでSSR/prerender時のエラーを無視)に合わせた。
EOF
)"
```

---

### Task 10: 最終確認

**Files:** なし(検証のみ)

- [ ] **Step 1: テスト・型チェック・ビルド**

Run: `npm run test && npm run check && npm run build`
Expected: `npm run test`は全テスト成功(このタスクではゲームロジックを変更していないため、既存のテスト件数から変化しない)。`npm run check`・`npm run build`はどちらもエラーなく成功。

- [ ] **Step 2: ブラウザで受け入れ基準を確認する**

`npm run dev`で起動し、`docs/superpowers/specs/2026-07-17-shidasu-debug-sandbox-improvements-design.md`の受け入れ基準9項目を順に確認する。

1. `/admin/shidasu-debug`で「場札を階段にする」または「各スートに統一」を押した直後、「元に戻す」が有効になり、押すと操作前の場札に戻る
2. 上記1の後に別の操作(プレイ・山札めくり・アイテム切り替え・新しいウェーブ)を行うと、「元に戻す」は再び無効になる
3. `/admin/shidasu-debug`・`/game/shidasu`いずれの`DebugPanel`でも、獲得点ログのリセットボタンを押すとログが空になる
4. `/admin/shidasu-debug`で「デッキリセット」を押すと、以後の「新しいウェーブ」で標準デッキ構成から配られる
5. `/admin/shidasu-debug`で護符をチェック/解除してページをリロードすると、チェック状態が保持されている
6. `/admin/shidasu-debug`のプレイエリアが`/game/shidasu`と同じ見た目・同じコンポーネントで描画される
7. `/admin/shidasu-debug`のカードパレットからのドラッグ&ドロップが従来通り動作する
8. `/game/shidasu`の見た目・動作がリファクタリング前後で変化していない
9. `npm run test`・`npm run build`・`npm run check`が成功する(Step 1で確認済み)

- [ ] **Step 3: 完了報告**

問題があれば修正してから完了とする。新規コミットは不要(Task 1〜9で既にコミット済み)。

---

## 自己レビュー結果

- **spec カバレッジ:** spec 1.1(元に戻す一般化)→ Task 6、1.2(ログリセット)→ Task 7、1.3(デッキリセット)→ Task 8、1.4(localStorage永続化)→ Task 9、2.2(CardFace抽出)→ Task 1-2、2.3-2.4(PlayArea抽出・適用)→ Task 3-5。全項目に対応するタスクあり。受け入れ基準9項目は全てTask 10のブラウザ確認手順に列挙済み。
- **プレースホルダースキャン:** 「TBD」「後で実装」等の記述なし。全コード変更箇所を具体的なold/new textまたは全文置き換えで記載した。
- **型・シグネチャ整合性:** `PlayArea`のprops(`wave`・`params`・`modifier`・`target`・`items`・`onPlayCard`・`onDraw`・`dropTarget`・`headerExtra`・`extraFooter`)はTask 3で定義後、Task 4(`/game/shidasu`)・Task 5(デバッグサンドボックス)双方で一貫して同じprops名で呼び出している。`lastSnapshot`の型(`{ tableau: Card[][]; stock: Card[] } | null`)はTask 6内で定義・使用ともに一貫している。`CardFace`のprops(`card`・`covered`)もTask 1定義後、Task 2・3・5で一貫して使用している。
