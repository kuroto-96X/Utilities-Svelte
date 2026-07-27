# 場札プレイ時のカードアニメーション Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** 通常プレイ画面(`PlayArea.svelte`)で場札のカードをプレイした際に、カードが上方向→チェーン置き場の右外側へワープ→左方向、の順で移動するアニメーションを追加し、アニメーション中は操作を一切受け付けないようにする。

**Architecture:** `PlayArea.svelte`にアニメーション用の状態(`playingAnimation`)とオーバーレイ要素を追加する。カードクリック時は即座に`onPlayCard`を呼ばず、まずクリックされたカード要素とチェーンの到達位置の座標を`getBoundingClientRect`で取得してアニメーションを開始する。アニメーション完了時に`onPlayCard`を呼び、`+page.svelte`側の`handlePlayCard`が従来通り`applyPlayCard`を実行する。アニメーション中は`PlayArea`内の全操作ボタンを`disabled`にする。

**Tech Stack:** SvelteKit / Svelte 5 runes(`$state`, `$derived`)、TypeScript、CSS transition、Vitest

---

## 事前情報(実装者向け)

- `run.shop`や福袋の中身選択画面は対象外。今回触るのは`PlayArea.svelte`と、それを呼び出す`src/routes/game/shidasu/+page.svelte`の通常プレイ画面部分(458-470行目付近の`<PlayArea>`呼び出し)のみ。
- `applyPlayCard`でチェーンに追加されるカードの`chainOrigin`は常に`'play'`(`src/lib/game/shidasu/engine.ts:543`)。既存のチェーン描画コード(`PlayArea.svelte:182`)では`entry.origin === 'draw' ? 20 : 0`でY方向オフセットしているが、プレイ由来は常に0pxなので、アニメーションの到達点Y座標もオフセット0として計算してよい。
- チェーンカードは`width:64px`固定(`PlayArea.svelte:182`)。`CardFace.svelte`自体は`w-full`なので、親要素の幅で見た目のサイズが決まる。アニメーション用オーバーレイも`width:64px`をコンテナに指定すること。
- チェーンの配置ルール: `chainRows = chunk(chainEntries, params.ui.chainCardsPerRow)`(10枚で改行)、各行内は`left: j * params.ui.chainCardOffsetX`(px)。次に追加される1枚の位置は、現在の`wave.chain.length`から求まる(`nextIndex = wave.chain.length`、`nextRow = Math.floor(nextIndex / chainCardsPerRow)`、`nextCol = nextIndex % chainCardsPerRow`)。
- `Card`型は`{ id: number, deckId: number, suit: Suit, rank: Rank, wild: boolean }`(`src/lib/game/shidasu/types.ts:66`)。
- 場札の各カードボタンは`PlayArea.svelte:113-132`にあり、`data-drop-col={ci}` `data-drop-row={ri}`属性を持つ。この属性を使ってクリックされたカードのDOM要素を取得する。
- `handlePlayCard`は`src/routes/game/shidasu/+page.svelte:108-112`。

```svelte
function handlePlayCard(colIndex: number, rowIndex: number) {
  if (run.phase !== 'playing' || run.wave?.status !== 'playing') return
  run = applyPlayCard(params, run, colIndex, undefined, rowIndex)
  afterAction()
}
```

- `PlayArea`呼び出し箇所は`+page.svelte:458-469`:

```svelte
{:else if wave}
  <PlayArea
    {wave} {params} modifier={currentModifier} {target} items={run.items}
    onPlayCard={handlePlayCard} onDraw={handleDraw}
    headerExtra={stageRow} extraFooter={itemBadges}
    rites={run.rites} onUseRite={handleUseRite}
    revelations={run.revelations} onUseRevelationClick={handleUseRevelationClick}
    columnTargetMode={pendingRevelationTarget !== null}
    canTargetColumn={canTargetRevelationColumn}
    onTargetColumn={handleTargetColumn}
    chainAreaExtra={pendingRevelationTarget ? revelationTargetPrompt : undefined}
  />
  <RoleStatusPanel {params} oracleLevels={run.oracleLevels} />
{/if}
```

---

### Task 1: PlayAreaにアニメーション状態と座標計算を追加する

**Files:**
- Modify: `src/routes/game/shidasu/PlayArea.svelte`
- Test: `src/routes/game/shidasu/PlayArea.animation.test.ts`(新規)

このタスクでは、アニメーションのロジック部分(状態管理・座標計算・タイマー制御)を先に作り、実際のオーバーレイ描画は Task 2 で追加する。まずロジックをテスト可能な形で切り出す。

- [ ] **Step 1: アニメーション座標計算の失敗するテストを書く**

`src/routes/game/shidasu/PlayArea.svelte`とは別に、座標計算ロジックを純粋関数として`src/lib/game/shidasu/chainLayout.ts`に切り出す。まずテストを書く。

```ts
// src/lib/game/shidasu/chainLayout.test.ts
import { describe, it, expect } from 'vitest'
import { nextChainSlotPosition } from './chainLayout'

describe('nextChainSlotPosition', () => {
  it('チェーンが空のとき、1行目の先頭(0,0)を返す', () => {
    const pos = nextChainSlotPosition(0, 30, 10)
    expect(pos).toEqual({ row: 0, col: 0, left: 0, top: 0 })
  })

  it('チェーンに3枚あるとき、4枚目の位置(row0, col3)を返す', () => {
    const pos = nextChainSlotPosition(3, 30, 10)
    expect(pos).toEqual({ row: 0, col: 3, left: 90, top: 0 })
  })

  it('1行の上限(chainCardsPerRow)に達したら次の行に折り返す', () => {
    const pos = nextChainSlotPosition(10, 30, 10)
    expect(pos).toEqual({ row: 1, col: 0, left: 0, top: 0 })
  })

  it('2行目の途中の位置を正しく計算する', () => {
    const pos = nextChainSlotPosition(12, 30, 10)
    expect(pos).toEqual({ row: 1, col: 2, left: 60, top: 0 })
  })
})
```

- [ ] **Step 2: テストを実行して失敗を確認する**

Run: `npx vitest run src/lib/game/shidasu/chainLayout.test.ts`
Expected: FAIL(`chainLayout.ts`が存在しない、または`nextChainSlotPosition`が未定義)

- [ ] **Step 3: 最小実装を書く**

```ts
// src/lib/game/shidasu/chainLayout.ts
// 次にチェーンへ追加される1枚のカードが、チェーン置き場のどの行・列に配置されるかを計算する。
// プレイでチェーンに追加されるカードのchainOriginは常に'play'であり、
// PlayArea.svelteの描画ルール(top: origin==='draw' ? 20 : 0)によりtopは常に0になる。
export interface ChainSlotPosition {
  row: number
  col: number
  left: number
  top: number
}

export function nextChainSlotPosition(
  currentChainLength: number,
  chainCardOffsetX: number,
  chainCardsPerRow: number,
): ChainSlotPosition {
  const row = Math.floor(currentChainLength / chainCardsPerRow)
  const col = currentChainLength % chainCardsPerRow
  return { row, col, left: col * chainCardOffsetX, top: 0 }
}
```

- [ ] **Step 4: テストを実行して成功を確認する**

Run: `npx vitest run src/lib/game/shidasu/chainLayout.test.ts`
Expected: PASS (4 tests)

- [ ] **Step 5: コミット**

```bash
git add src/lib/game/shidasu/chainLayout.ts src/lib/game/shidasu/chainLayout.test.ts
git commit -m "feat: チェーン配置位置を計算する純粋関数を追加"
```

---

### Task 2: PlayAreaにアニメーション状態(プレイ中フラグ・オーバーレイ)を実装する

**Files:**
- Modify: `src/routes/game/shidasu/PlayArea.svelte`

Task 1で作った`nextChainSlotPosition`を使い、`PlayArea.svelte`にアニメーション本体を実装する。このタスクはUIコンポーネントの変更であり、Svelteコンポーネントテストは書かず、Task 4のブラウザ手動確認で動作を確かめる方針とする(spec「テスト方針」参照)。

- [ ] **Step 1: propsとimportを追加する**

`src/routes/game/shidasu/PlayArea.svelte`の1-11行目のimport文を以下に変更する:

```svelte
<script lang="ts">
  import type { Snippet } from 'svelte'
  import { getPlayableColumns, isPlayable, remainingCount } from '$lib/game/shidasu/engine'
  import type { WaveState, StageModifier, ItemId, RiteId, RevelationId, Card } from '$lib/game/shidasu/types'
  import type { ShidasuParams } from '$lib/game/shidasu/params'
  import { canUseRite } from '$lib/game/shidasu/riteEffects'
  import { riteDesc } from '$lib/game/shidasu/rites'
  import { canUseRevelation } from '$lib/game/shidasu/revelationEffects'
  import { revelationDesc } from '$lib/game/shidasu/revelations'
  import { nextChainSlotPosition } from '$lib/game/shidasu/chainLayout'
  import CardFace from './CardFace.svelte'
  import SuitCountPanel from './SuitCountPanel.svelte'
```

13-44行目の`let { ... } = $props()`ブロックはそのままでよい(`onPlayCard`のシグネチャは変更しない。呼び出しタイミングだけをアニメーション経由にする)。

- [ ] **Step 2: アニメーション状態とDOM参照用の変数を追加する**

44行目`} = $props()`の直後、46行目の`function chunk`の前に以下を追加する:

```svelte
  let tableauEl: HTMLDivElement | undefined = $state()
  let chainAreaEl: HTMLDivElement | undefined = $state()

  interface PlayingAnimation {
    card: Card
    colIndex: number
    rowIndex: number
    phase: 'up' | 'warp' | 'left'
    left: number
    top: number
    transitionMs: number
  }

  let playingAnimation = $state<PlayingAnimation | null>(null)
```

- [ ] **Step 3: アニメーション開始関数を追加する**

同じ場所に続けて追加する。上方向へ移動(`'up'`)→画面外に出た直後にtransitionなしでチェーン右外側へワープ(`'warp'`)→左方向へ移動(`'left'`)、の3フェーズで状態を切り替える。`transitionMs: 0`のフェーズ切り替え直後に`requestAnimationFrame`を二重に挟むのは、ブラウザがスタイル変更を確実に描画に反映してから次のtransitionを開始するため(1回だけだと同一フレーム内でバッチ処理され、ワープにならずtransitionしてしまうブラウザがある):

```svelte
  const ANIMATION_UP_MS = 150
  const ANIMATION_LEFT_MS = 200

  function startPlayCardAnimation(colIndex: number, rowIndex: number, card: Card) {
    if (playingAnimation) return
    if (!tableauEl || !chainAreaEl) {
      onPlayCard(colIndex, rowIndex)
      return
    }
    const cardEl = tableauEl.querySelector<HTMLElement>(`[data-drop-col="${colIndex}"][data-drop-row="${rowIndex}"]`)
    if (!cardEl) {
      onPlayCard(colIndex, rowIndex)
      return
    }
    const cardRect = cardEl.getBoundingClientRect()
    const chainRect = chainAreaEl.getBoundingClientRect()
    const slot = nextChainSlotPosition(wave.chain.length, params.ui.chainCardOffsetX, params.ui.chainCardsPerRow)
    const targetLeft = chainRect.left + slot.left
    const targetTop = chainRect.top + slot.top
    const warpLeft = chainRect.right + 200

    playingAnimation = {
      card, colIndex, rowIndex,
      phase: 'up',
      left: cardRect.left, top: -100,
      transitionMs: ANIMATION_UP_MS,
    }

    setTimeout(() => {
      if (!playingAnimation) return
      playingAnimation = { ...playingAnimation, phase: 'warp', left: warpLeft, top: targetTop, transitionMs: 0 }
      requestAnimationFrame(() => {
        requestAnimationFrame(() => {
          if (!playingAnimation) return
          playingAnimation = { ...playingAnimation, phase: 'left', left: targetLeft, top: targetTop, transitionMs: ANIMATION_LEFT_MS }
        })
      })
    }, ANIMATION_UP_MS)

    setTimeout(() => {
      playingAnimation = null
      onPlayCard(colIndex, rowIndex)
    }, ANIMATION_UP_MS + ANIMATION_LEFT_MS)
  }
```

- [ ] **Step 4: 場札のカードボタンを`bind:this`でラップし、クリック時にアニメーションを開始する**

108-133行目の場札描画ブロックを以下に変更する(`<div class="grid gap-1" ...>`に`bind:this={tableauEl}`を追加し、クリック処理を`startPlayCardAnimation`経由に変更、アニメーション中のカードは非表示にする):

```svelte
  <div bind:this={tableauEl} class="grid gap-1" style="grid-template-columns: repeat({params.layout.cols}, minmax(0, 1fr));">
    {#each wave.tableau as col, ci (ci)}
      <div class="relative" style="min-height: 10.5rem;">
        {#each col as card, ri (card.id)}
          {@const isTop = ri === col.length - 1}
          {@const isSelectable = columnTargetMode ? isTop : (isTop || wave.playFromAnywhereActiveThisWave)}
          {@const isAnimatingThisCard = playingAnimation?.colIndex === ci && playingAnimation?.rowIndex === ri}
          <div
            class="absolute left-0 right-0 {dropTarget && dropTarget !== 'stockTop' && dropTarget.col === ci && dropTarget.row === ri ? 'ring-4 ring-sky-400 rounded-lg' : ''} {isAnimatingThisCard ? 'invisible' : ''}"
            style="top:{ri * 18}px; z-index:{ri};"
            data-drop-col={ci}
            data-drop-row={ri}
          >
            {#if isSelectable}
              {@const isTargetable = columnTargetMode && canTargetColumn(ci)}
              {@const isCardPlayable = !columnTargetMode && isPlayable(modifier, wave, card)}
              <button
                type="button"
                disabled={playingAnimation !== null}
                onclick={() => (columnTargetMode ? (isTargetable && onTargetColumn?.(ci)) : startPlayCardAnimation(ci, ri, card))}
                class="w-full text-left {columnTargetMode ? (isTargetable ? 'ring-2 ring-fuchsia-400 shadow-lg -translate-y-0.5' : '') : (isCardPlayable ? 'ring-2 ring-yellow-300 shadow-lg -translate-y-0.5' : '')} transition-transform disabled:cursor-not-allowed"
              >
                <CardFace {card} covered={false} />
              </button>
            {:else}
              <CardFace {card} covered={true} />
            {/if}
          </div>
        {/each}
        {#if col.length === 0 && columnTargetMode}
          {@const isTargetable = canTargetColumn(ci)}
          <button
            type="button"
            onclick={() => isTargetable && onTargetColumn?.(ci)}
            aria-label="空の列{ci + 1}"
            class="absolute left-0 right-0 top-0 w-full rounded-lg border-2 border-dashed {isTargetable ? 'border-fuchsia-400' : 'border-transparent'}"
            style="aspect-ratio: 2 / 3;"
          ></button>
        {/if}
      </div>
    {/each}
  </div>
```

- [ ] **Step 5: 山札めくりボタンと秘儀・天啓ボタンをアニメーション中disabledにする**

154-165行目の山札めくりボタンの`disabled`条件を変更する:

```svelte
  <button
    type="button"
    onclick={onDraw}
    disabled={wave.stock.length === 0 || !allowDraw || playingAnimation !== null}
    data-drop-stock
    style="aspect-ratio: 2 / 3; margin-top:20px;"
    class="w-16 shrink-0 rounded-lg border-2 flex flex-col items-center justify-center font-black active:scale-95 transition-transform {dropTarget === 'stockTop' ? 'ring-4 ring-sky-400' : ''} {wave.stock.length > 0 ? 'bg-emerald-700 border-emerald-500 text-amber-50' : 'bg-emerald-900 border-emerald-800 text-emerald-700'}"
  >
    <div class="text-xs">山札</div>
    <div class="text-lg tabular-nums">{wave.stock.length}</div>
  </button>
```

196-210行目の秘儀ボタンの`disabled`条件を変更する:

```svelte
{#if rites.length > 0}
  <div class="px-4 pb-4 flex items-center gap-2">
    {#each rites as riteId, i (i)}
      {@const usable = canUseRite(params, wave, riteId) && playingAnimation === null}
      <button
        type="button"
        onclick={() => onUseRite?.(riteId)}
        disabled={!usable}
        title={riteDesc(riteId, params)}
        style="font-family: 'ShidasuRunic', sans-serif;"
        class="w-10 h-10 rounded-lg border-2 flex items-center justify-center text-xl font-black transition-transform active:scale-95 {usable ? 'bg-fuchsia-900 border-fuchsia-500 text-fuchsia-100 hover:bg-fuchsia-800' : 'bg-slate-800 border-slate-700 text-slate-600 cursor-not-allowed'}"
      >{params.rites[riteId].name}</button>
    {/each}
  </div>
{/if}
```

212-225行目の天啓ボタンの`disabled`条件を変更する:

```svelte
{#if revelations.length > 0}
  <div class="px-4 pb-4 flex items-center gap-2">
    {#each revelations as revelationId, i (i)}
      {@const usable = canUseRevelation(params, wave, revelationId) && playingAnimation === null}
      <button
        type="button"
        onclick={() => onUseRevelationClick?.(revelationId)}
        disabled={!usable}
        title={revelationDesc(revelationId, params)}
        class="w-10 h-10 rounded-lg border-2 flex items-center justify-center text-lg font-black transition-transform active:scale-95 {usable ? 'bg-indigo-900 border-indigo-500 text-indigo-100 hover:bg-indigo-800' : 'bg-slate-800 border-slate-700 text-slate-600 cursor-not-allowed'}"
      >{params.revelations[revelationId].name}</button>
    {/each}
  </div>
{/if}
```

- [ ] **Step 6: チェーンエリアに`bind:this`を追加する**

173行目の`<div class="overflow-x-auto min-w-0">`を以下に変更する:

```svelte
  <div bind:this={chainAreaEl} class="overflow-x-auto min-w-0">
```

- [ ] **Step 7: アニメーション用オーバーレイを追加する**

ファイル末尾(226行目、天啓ブロックの`{/if}`の直後)に以下を追加する:

```svelte
{#if playingAnimation}
  <div
    class="fixed pointer-events-none z-[100] ease-out"
    style="left:{playingAnimation.left}px; top:{playingAnimation.top}px; width:64px; transition-property:left,top; transition-duration:{playingAnimation.transitionMs}ms;"
  >
    <CardFace card={playingAnimation.card} covered={false} />
  </div>
{/if}
```

- [ ] **Step 8: 型チェックを実行する**

Run: `npm run check`
Expected: `PlayArea.svelte`に関するエラーが0件(既存の無関係な警告・他ファイルのエラーは無視してよい)

- [ ] **Step 9: コミット**

```bash
git add src/routes/game/shidasu/PlayArea.svelte
git commit -m "feat: 場札プレイ時にチェーンへ移動するアニメーションを追加"
```

---

### Task 3: 既存のシグネチャ整合性を確認する

**Files:**
- Read only: `src/routes/game/shidasu/+page.svelte`

このタスクはコード変更を伴わない。Task 2で`onPlayCard`のシグネチャ(`(colIndex: number, rowIndex: number) => void`)を変えていないため、`+page.svelte`側の`handlePlayCard`・`<PlayArea onPlayCard={handlePlayCard} ...>`は変更不要であることを確認するだけ。

- [ ] **Step 1: `+page.svelte`の`PlayArea`呼び出しとpropsの型が変わっていないことを確認する**

Run: `npm run check`
Expected: `src/routes/game/shidasu/+page.svelte`に関するエラーが0件

- [ ] **Step 2: 確認結果に問題があれば、このタスク内でPlayAreaのprops定義(Task 2 Step 1)を見直す。問題なければ次のタスクへ**

変更不要な場合はコミット不要。

---

### Task 4: ビルド・型チェック・ブラウザでの動作確認

**Files:** なし(検証のみ)

- [ ] **Step 1: 全体ビルドを実行する**

Run: `npm run build`
Expected: `✓ built` で成功終了

- [ ] **Step 2: 型チェックを実行する**

Run: `npm run check`
Expected: shidasuディレクトリ関連のエラー0件(他ツールの既存エラー・警告は無視)

- [ ] **Step 3: 全体のユニットテストを実行する**

Run: `npx vitest run src/lib/game/shidasu`
Expected: 既存テストと合わせて全件PASS(Task 1で追加した`chainLayout.test.ts`含む)

- [ ] **Step 4: devサーバーを起動しブラウザで確認する**

Run: `npm run dev`

`http://localhost:5173/game/shidasu` を開き、以下を確認する:
- 場札のカードをクリックすると、カードが上方向に画面外まで移動する
- 直後にチェーン置き場の右側画面外へワープし、そこから左方向に移動してチェーンの正しい位置(既存カードの右隣)に収まる
- アニメーション中(約350ms)は他の場札カード・山札めくりボタン・秘儀ボタン・天啓ボタンがクリックできない(disabled表示になっている)こと
- アニメーション完了後、スコア・コンボ・チェーン表示が通常通り更新されること
- 複数回連続でプレイしても位置がずれず、正しい位置に積み上がっていくこと

- [ ] **Step 5: 問題があれば修正し、再度Step 1-4を実行する。問題なければ完了**

---

## Self-Review メモ(実装者は読み飛ばしてよい)

- spec要件「上方向に速度xで移動」「画面外に出たら右側画面外へ移動」「左方向に速度xで移動」「チェーン位置到達でアニメ終了」「アニメ中は他操作不可」は Task 2 の Step 3/4/5/7 でカバーしている。
- spec「バラ売り・福袋の中身選択画面は対象外」は、Task 2 が`PlayArea.svelte`のみを変更し、福袋選択UI(`+page.svelte`内の別ブロック)には触れないことで担保している。
- spec「アニメ完了後にapplyPlayCard実行」は Task 2 Step 3 の`setTimeout`内で`onPlayCard(colIndex, rowIndex)`を呼ぶタイミングで担保している(`+page.svelte`側の`handlePlayCard`は変更不要)。
