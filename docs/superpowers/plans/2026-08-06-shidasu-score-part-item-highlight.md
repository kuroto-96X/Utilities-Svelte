# 得点内訳パーツの対象護符ハイライト表示 Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Shidasuのカードプレイ時、得点内訳アニメーションで護符効果由来のパーツ(gained・clearBonus両チャンネル)が中央表示されている間、対応する護符バッジを黄色枠でハイライトする。

**Architecture:** `ScorePart`に任意フィールド`itemId?: ItemId`を追加し、`applyItemEffects`(`itemEffects.ts`)内で各護符効果を実行した結果の`part`に`itemId`を後付けする(個別の護符効果関数は変更しない)。`PlayArea.svelte`から新設のコールバックprop `onScorePartHighlight`経由で、現在中央表示中のパーツの`itemId`を親コンポーネント(`+page.svelte`・`admin/shidasu-debug/+page.svelte`)へ通知し、護符バッジUI側で`highlightedItemId`と一致する要素に黄色枠を適用する。

**Tech Stack:** SvelteKit, Svelte 5 runes, TypeScript, Vitest

---

### Task 1: ScorePartにitemIdフィールドを追加する

**Files:**
- Modify: `src/lib/game/shidasu/scoreParts.ts`

- [ ] **Step 1: ScorePart型にitemIdを追加する**

`src/lib/game/shidasu/scoreParts.ts`の先頭にimportを追加し、`ScorePart`インターフェースを変更する。

変更前:
```ts
// 得点内訳の1ステップを表す構造化データ。kind='add'は加算量、kind='multiply'は倍率をamountに持つ。
// kind='lock'は特殊ステップで、それまでの仮合計に関わらず以降の合計を0にする(ボス得点ロック用)。
// textは従来通りの表示用文字列(例: "基礎点+10")で、既存のテスト・非対応箇所での表示に使う。
export interface ScorePart {
  label: string
  kind: 'add' | 'multiply' | 'lock'
  amount: number
  text: string
  cardIds?: number[] // ハイライト対象カードのCard.id一覧。対象カードが無いパーツ(基礎点・護符効果等)では省略する
}
```

変更後:
```ts
import type { ItemId } from './types'

// 得点内訳の1ステップを表す構造化データ。kind='add'は加算量、kind='multiply'は倍率をamountに持つ。
// kind='lock'は特殊ステップで、それまでの仮合計に関わらず以降の合計を0にする(ボス得点ロック用)。
// textは従来通りの表示用文字列(例: "基礎点+10")で、既存のテスト・非対応箇所での表示に使う。
export interface ScorePart {
  label: string
  kind: 'add' | 'multiply' | 'lock'
  amount: number
  text: string
  cardIds?: number[] // ハイライト対象カードのCard.id一覧。対象カードが無いパーツ(基礎点・護符効果等)では省略する
  itemId?: ItemId // ハイライト対象護符のID。護符効果パーツ以外(基礎点・パターン/役パーツ等)では省略する
}
```

`addPart`・`multiplyPart`・`lockPart`は変更しない(`itemId`は`applyItemEffects`側で後付けするため、これらのヘルパー関数の引数には追加しない)。

- [ ] **Step 2: 型チェックを実行する**

Run: `npm run check`
Expected: shidasu関連のエラー0件(この時点ではまだ`itemId`を使うコードが無いため、型定義追加のみで既存コードへの影響は無い)

- [ ] **Step 3: 全体テストを実行する**

Run: `npx vitest run`
Expected: 全件PASS

- [ ] **Step 4: Commit**

```bash
git add src/lib/game/shidasu/scoreParts.ts
git commit -m "feat: ScorePartに対象護符ID(itemId)を追加"
```

---

### Task 2: applyItemEffectsでitemIdを付与する

**Files:**
- Modify: `src/lib/game/shidasu/itemEffects.ts`
- Test: `src/lib/game/shidasu/itemEffects.test.ts`

- [ ] **Step 1: 失敗するテストを書く**

`src/lib/game/shidasu/itemEffects.test.ts`の`describe('applyItemEffects', ...)`ブロック内、既存の最後のテスト(`'gainedチャンネルの護符はclearBonusチャンネル計算には適用されない'`)の直後に以下を追加する。

```ts
  test('護符効果パーツにはitemIdが付与される', () => {
    const result = applyItemEffects('clearBonus', 1000, ['purify', 'temperance'], ctx({ stockRemaining: 4 }), params)
    expect(result.parts.map(p => p.itemId)).toEqual(['purify', 'temperance'])
  })
```

同ファイルの`describe('水鏡(waterMirror): 左隣の護符の効果をもう一度発動させる', ...)`ブロック内、既存の最初のテスト(`'左隣が忍耐(全消しボーナスへの固定加算)の場合、忍耐の効果が2回分適用される'`)の直後に以下を追加する。

```ts
  test('水鏡のエコー分パーツのitemIdは水鏡自身(waterMirror)になる', () => {
    const result = applyItemEffects('clearBonus', 0, ['patience', 'waterMirror'], ctx({ stockRemaining: 5 }), params)
    expect(result.parts.map(p => p.itemId)).toEqual(['patience', 'waterMirror'])
  })
```

- [ ] **Step 2: テストを実行して失敗を確認する**

Run: `npx vitest run src/lib/game/shidasu/itemEffects.test.ts -t "itemId"`
Expected: FAIL(`part.itemId`が全て`undefined`のため、期待する配列と一致しない)

- [ ] **Step 3: applyItemEffects内でitemIdを付与する**

`src/lib/game/shidasu/itemEffects.ts`の`applyItemEffects`関数を以下のように変更する。

変更前:
```ts
export function applyItemEffects(
  channel: 'gained' | 'clearBonus',
  baseValue: number,
  items: ItemId[],
  ctx: ItemEffectContext,
  params: ShidasuParams
): { value: number; parts: ScorePart[] } {
  const parts: ScorePart[] = []
  let value = baseValue
  for (let i = 0; i < items.length; i++) {
    const id = items[i]
    const entry = ITEM_EFFECTS[id]
    if (entry && entry.channel === channel) {
      const result = entry.effect(value, ctx, params)
      if (result.part) parts.push(result.part)
      value = result.value
    }
    // 水鏡: 自分の左隣(i-1番目)の護符の効果を、追加でもう一度この時点の値に適用する
    if (id === 'waterMirror' && i > 0) {
      const leftId = items[i - 1]
      const leftEntry = ITEM_EFFECTS[leftId]
      if (leftEntry && leftEntry.channel === channel) {
        const echoResult = leftEntry.effect(value, ctx, params)
        if (echoResult.part) parts.push(echoResult.part)
        value = echoResult.value
      }
    }
  }
  return { value, parts }
}
```

変更後:
```ts
export function applyItemEffects(
  channel: 'gained' | 'clearBonus',
  baseValue: number,
  items: ItemId[],
  ctx: ItemEffectContext,
  params: ShidasuParams
): { value: number; parts: ScorePart[] } {
  const parts: ScorePart[] = []
  let value = baseValue
  for (let i = 0; i < items.length; i++) {
    const id = items[i]
    const entry = ITEM_EFFECTS[id]
    if (entry && entry.channel === channel) {
      const result = entry.effect(value, ctx, params)
      if (result.part) parts.push({ ...result.part, itemId: id })
      value = result.value
    }
    // 水鏡: 自分の左隣(i-1番目)の護符の効果を、追加でもう一度この時点の値に適用する
    if (id === 'waterMirror' && i > 0) {
      const leftId = items[i - 1]
      const leftEntry = ITEM_EFFECTS[leftId]
      if (leftEntry && leftEntry.channel === channel) {
        const echoResult = leftEntry.effect(value, ctx, params)
        if (echoResult.part) parts.push({ ...echoResult.part, itemId: id }) // idはwaterMirror自身
        value = echoResult.value
      }
    }
  }
  return { value, parts }
}
```

- [ ] **Step 4: テストを実行して成功を確認する**

Run: `npx vitest run src/lib/game/shidasu/itemEffects.test.ts`
Expected: PASS(全件)

- [ ] **Step 5: 全体テストを実行する**

Run: `npx vitest run`
Expected: 全件PASS

Run: `npm run check`
Expected: shidasu関連のエラー0件

- [ ] **Step 6: Commit**

```bash
git add src/lib/game/shidasu/itemEffects.ts src/lib/game/shidasu/itemEffects.test.ts
git commit -m "feat: applyItemEffectsで護符効果パーツに対象護符IDを付与"
```

---

### Task 3: PlayArea.svelteからハイライトを通知する

**Files:**
- Modify: `src/routes/game/shidasu/PlayArea.svelte`

- [ ] **Step 1: onScorePartHighlight propを追加する**

`src/routes/game/shidasu/PlayArea.svelte`1〜51行目、`let { ... } = $props()`のprops解体代入とその型定義を以下のように変更する。

変更前:
```ts
  let {
    wave, params, modifier, target, items, onPlayCard, onDraw, dropTarget = null, headerExtra, extraFooter,
    rites = [], onUseRite,
    revelations = [], onUseRevelationClick,
    showScoreAndCombo = true,
    allowDraw = true,
    columnTargetMode = false,
    canTargetColumn = () => true,
    onTargetColumn,
    chainAreaExtra,
    onScoreRevealDone, waveKey, onCleanupDone,
  }: {
    wave: WaveState
    params: ShidasuParams
    modifier: StageModifier
    target: number
    items: ItemId[]
    onPlayCard: (colIndex: number, rowIndex: number) => PlayCardResult | void
    onDraw: () => void
    dropTarget?: { col: number; row: number } | 'stockTop' | null
    headerExtra?: Snippet
    extraFooter?: Snippet
    rites?: RiteId[]
    onUseRite?: (riteId: RiteId) => void
    revelations?: RevelationId[]
    onUseRevelationClick?: (revelationId: RevelationId) => void
    showScoreAndCombo?: boolean
    allowDraw?: boolean
    columnTargetMode?: boolean
    canTargetColumn?: (colIndex: number) => boolean
    onTargetColumn?: (colIndex: number) => void
    chainAreaExtra?: Snippet
    onScoreRevealDone?: () => void
    waveKey?: string
    onCleanupDone?: () => void
  } = $props()
```

変更後:
```ts
  let {
    wave, params, modifier, target, items, onPlayCard, onDraw, dropTarget = null, headerExtra, extraFooter,
    rites = [], onUseRite,
    revelations = [], onUseRevelationClick,
    showScoreAndCombo = true,
    allowDraw = true,
    columnTargetMode = false,
    canTargetColumn = () => true,
    onTargetColumn,
    chainAreaExtra,
    onScoreRevealDone, waveKey, onCleanupDone,
    onScorePartHighlight,
  }: {
    wave: WaveState
    params: ShidasuParams
    modifier: StageModifier
    target: number
    items: ItemId[]
    onPlayCard: (colIndex: number, rowIndex: number) => PlayCardResult | void
    onDraw: () => void
    dropTarget?: { col: number; row: number } | 'stockTop' | null
    headerExtra?: Snippet
    extraFooter?: Snippet
    rites?: RiteId[]
    onUseRite?: (riteId: RiteId) => void
    revelations?: RevelationId[]
    onUseRevelationClick?: (revelationId: RevelationId) => void
    showScoreAndCombo?: boolean
    allowDraw?: boolean
    columnTargetMode?: boolean
    canTargetColumn?: (colIndex: number) => boolean
    onTargetColumn?: (colIndex: number) => void
    chainAreaExtra?: Snippet
    onScoreRevealDone?: () => void
    waveKey?: string
    onCleanupDone?: () => void
    onScorePartHighlight?: (itemId: ItemId | null) => void
  } = $props()
```

`ItemId`は既にこのファイルの5行目でimport済みのため、追加のimportは不要。

- [ ] **Step 2: startPartFlyInでハイライトを通知する**

`src/routes/game/shidasu/PlayArea.svelte`の`startPartFlyIn`関数(650行目付近)を以下のように変更する。

変更前:
```ts
  // index番目のパーツを、画面中央に拡大表示してから内訳行(breakdownRowEl)へ移動させる。
  function startPartFlyIn(index: number) {
    const part = scoreReveal?.parts[index]
    if (!scoreReveal || !part || !breakdownRowEl || !noPlayableHintEl) {
      if (scoreReveal) landPart(index)
      return
    }
    const hintRect = noPlayableHintEl.getBoundingClientRect()
    partFlyIn = {
      text: part.text,
      cardIds: part.cardIds ?? [],
      phase: 'center',
      left: hintRect.left + hintRect.width / 2,
      top: hintRect.top + hintRect.height / 2,
      scale: PART_FLYIN_SCALE,
      transitionMs: 0,
    }
```

変更後:
```ts
  // index番目のパーツを、画面中央に拡大表示してから内訳行(breakdownRowEl)へ移動させる。
  function startPartFlyIn(index: number) {
    const part = scoreReveal?.parts[index]
    if (!scoreReveal || !part || !breakdownRowEl || !noPlayableHintEl) {
      if (scoreReveal) landPart(index)
      return
    }
    onScorePartHighlight?.(part.itemId ?? null)
    const hintRect = noPlayableHintEl.getBoundingClientRect()
    partFlyIn = {
      text: part.text,
      cardIds: part.cardIds ?? [],
      phase: 'center',
      left: hintRect.left + hintRect.width / 2,
      top: hintRect.top + hintRect.height / 2,
      scale: PART_FLYIN_SCALE,
      transitionMs: 0,
    }
```

- [ ] **Step 3: landPartでハイライトを解除する**

`src/routes/game/shidasu/PlayArea.svelte`の`landPart`関数(684行目付近)を以下のように変更する。

変更前:
```ts
  // index番目のパーツを内訳行に確定表示し、合計値の強調(パルス)を行う。
  // 次のパーツがあれば続けてstartPartFlyInを呼び、無ければSCOREへの飛び込み演出へ進む。
  function landPart(index: number) {
    if (!scoreReveal) return
    partFlyIn = null
    scoreReveal = { ...scoreReveal, revealedCount: index + 1, totalScale: TOTAL_PULSE_SCALE, totalTransitionMs: 0 }
```

変更後:
```ts
  // index番目のパーツを内訳行に確定表示し、合計値の強調(パルス)を行う。
  // 次のパーツがあれば続けてstartPartFlyInを呼び、無ければSCOREへの飛び込み演出へ進む。
  function landPart(index: number) {
    if (!scoreReveal) return
    partFlyIn = null
    onScorePartHighlight?.(null)
    scoreReveal = { ...scoreReveal, revealedCount: index + 1, totalScale: TOTAL_PULSE_SCALE, totalTransitionMs: 0 }
```

次のパーツがあれば`landPart`の末尾で`startPartFlyIn(index + 1)`が呼ばれ、そのパーツの`itemId`で再度`onScorePartHighlight`が呼ばれて上書きされる。最後のパーツの場合は`null`のまま(`startScoreFly`が呼ばれる)ハイライトが解除された状態になる。

- [ ] **Step 4: 型チェックを実行する**

Run: `npm run check`
Expected: shidasu関連のエラー0件

- [ ] **Step 5: 全体テストを実行する**

Run: `npx vitest run`
Expected: 全件PASS

- [ ] **Step 6: Commit**

```bash
git add src/routes/game/shidasu/PlayArea.svelte
git commit -m "feat: PlayArea.svelteから得点内訳パーツの対象護符IDを通知するonScorePartHighlightを追加"
```

---

### Task 4: 護符バッジUIでハイライトを表示する

**Files:**
- Modify: `src/routes/game/shidasu/+page.svelte`
- Modify: `src/routes/admin/shidasu-debug/+page.svelte`

- [ ] **Step 1: +page.svelteにhighlightedItemId stateを追加する**

`src/routes/game/shidasu/+page.svelte`56行目、`let run = $state<RunState>(createInitialRun())`の直後に以下を追加する。

変更前:
```ts
  let run = $state<RunState>(createInitialRun())
```

変更後:
```ts
  let run = $state<RunState>(createInitialRun())
  let highlightedItemId = $state<ItemId | null>(null)
```

`ItemId`は既に28行目でimport済みのため、追加のimportは不要。

- [ ] **Step 2: itemBadges snippetでハイライトクラスを適用する**

`src/routes/game/shidasu/+page.svelte`の`itemBadges` snippet(529行目付近)を以下のように変更する。

変更前:
```svelte
{#snippet itemBadges()}
  <div class="flex-1 flex flex-col gap-1 items-end">
    <div class="flex flex-wrap gap-1 justify-end">
      {#each [...new Set(run.items)] as id (id)}
        {@const n = run.items.filter(x => x === id).length}
        <span class="text-xs bg-emerald-900 text-yellow-200/90 border border-yellow-600/40 rounded px-1.5 py-0.5" title={itemDesc(id, params)}>
          {itemName(id, params)}{n > 1 ? `×${n}` : ''}
        </span>
      {/each}
    </div>
```

変更後:
```svelte
{#snippet itemBadges()}
  <div class="flex-1 flex flex-col gap-1 items-end">
    <div class="flex flex-wrap gap-1 justify-end">
      {#each [...new Set(run.items)] as id (id)}
        {@const n = run.items.filter(x => x === id).length}
        <span class="text-xs bg-emerald-900 text-yellow-200/90 border border-yellow-600/40 rounded px-1.5 py-0.5 {highlightedItemId === id ? 'ring-2 ring-yellow-400' : ''}" title={itemDesc(id, params)}>
          {itemName(id, params)}{n > 1 ? `×${n}` : ''}
        </span>
      {/each}
    </div>
```

- [ ] **Step 3: PlayArea呼び出しにonScorePartHighlightを渡す**

`src/routes/game/shidasu/+page.svelte`653〜666行目、`{:else if wave}`ブロック内の`<PlayArea ...>`呼び出しを以下のように変更する。

変更前:
```svelte
{:else if wave}
  <PlayArea
    {wave} {params} modifier={currentModifier} {target} items={run.items}
    onPlayCard={handlePlayCard} onDraw={handleDraw}
    onScoreRevealDone={handleScoreRevealDone}
    onCleanupDone={handleCleanupDone}
    waveKey={`wave-${run.waveGeneration}`}
    headerExtra={stageRow} extraFooter={itemBadges}
    rites={run.rites} onUseRite={handleUseRite}
    revelations={run.revelations} onUseRevelationClick={handleUseRevelationClick}
    columnTargetMode={pendingRevelationTarget !== null}
    canTargetColumn={canTargetRevelationColumn}
    onTargetColumn={handleTargetColumn}
    chainAreaExtra={pendingRevelationTarget ? revelationTargetPrompt : undefined}
  />
```

変更後:
```svelte
{:else if wave}
  <PlayArea
    {wave} {params} modifier={currentModifier} {target} items={run.items}
    onPlayCard={handlePlayCard} onDraw={handleDraw}
    onScoreRevealDone={handleScoreRevealDone}
    onCleanupDone={handleCleanupDone}
    waveKey={`wave-${run.waveGeneration}`}
    headerExtra={stageRow} extraFooter={itemBadges}
    rites={run.rites} onUseRite={handleUseRite}
    revelations={run.revelations} onUseRevelationClick={handleUseRevelationClick}
    columnTargetMode={pendingRevelationTarget !== null}
    canTargetColumn={canTargetRevelationColumn}
    onTargetColumn={handleTargetColumn}
    chainAreaExtra={pendingRevelationTarget ? revelationTargetPrompt : undefined}
    onScorePartHighlight={id => (highlightedItemId = id)}
  />
```

タイトル画面計測用の`<PlayArea>`(625行目、`measurementWave`を使うもの)と、福袋プレビュー用の`<PlayArea>`(683行目、`revelationPreviewWave`を使うもの)は、いずれも実際のプレイ・得点内訳アニメーションが発生しない用途のため、`onScorePartHighlight`は追加しない。

- [ ] **Step 4: admin/shidasu-debug/+page.svelteにhighlightedItemId stateを追加する**

`src/routes/admin/shidasu-debug/+page.svelte`35行目、`let items = $state<ItemId[]>(loadSavedItems())`の直後に以下を追加する。

変更前:
```ts
  let items = $state<ItemId[]>(loadSavedItems())
```

変更後:
```ts
  let items = $state<ItemId[]>(loadSavedItems())
  let highlightedItemId = $state<ItemId | null>(null)
```

- [ ] **Step 5: shidasu-debugのitemBadges snippetとPlayArea呼び出しを変更する**

`src/routes/admin/shidasu-debug/+page.svelte`の`itemBadges` snippet(272行目付近)を以下のように変更する。

変更前:
```svelte
{#snippet itemBadges()}
  <div class="flex-1 flex flex-wrap gap-1 justify-end">
    {#each [...new Set(items)] as id (id)}
      {@const n = items.filter(x => x === id).length}
      <span class="text-xs bg-emerald-900 text-yellow-200/90 border border-yellow-600/40 rounded px-1.5 py-0.5" title={itemDesc(id, params)}>
        {itemName(id, params)}{n > 1 ? `×${n}` : ''}
      </span>
    {/each}
  </div>
{/snippet}
```

変更後:
```svelte
{#snippet itemBadges()}
  <div class="flex-1 flex flex-wrap gap-1 justify-end">
    {#each [...new Set(items)] as id (id)}
      {@const n = items.filter(x => x === id).length}
      <span class="text-xs bg-emerald-900 text-yellow-200/90 border border-yellow-600/40 rounded px-1.5 py-0.5 {highlightedItemId === id ? 'ring-2 ring-yellow-400' : ''}" title={itemDesc(id, params)}>
        {itemName(id, params)}{n > 1 ? `×${n}` : ''}
      </span>
    {/each}
  </div>
{/snippet}
```

同ファイルの`<PlayArea ...>`呼び出し(302行目付近)を以下のように変更する。

変更前:
```svelte
        <PlayArea
          {wave} {params} modifier={'none'} target={TARGET} {items} onPlayCard={handlePlayCard} onDraw={handleDraw} {dropTarget}
          extraFooter={itemBadges}
          columnTargetMode={pendingDebugRevelation !== null}
          canTargetColumn={canTargetDebugColumn}
          onTargetColumn={handleTargetDebugColumn}
        />
```

変更後:
```svelte
        <PlayArea
          {wave} {params} modifier={'none'} target={TARGET} {items} onPlayCard={handlePlayCard} onDraw={handleDraw} {dropTarget}
          extraFooter={itemBadges}
          columnTargetMode={pendingDebugRevelation !== null}
          canTargetColumn={canTargetDebugColumn}
          onTargetColumn={handleTargetDebugColumn}
          onScorePartHighlight={id => (highlightedItemId = id)}
        />
```

- [ ] **Step 6: 型チェック・ビルドを実行する**

Run: `npm run check`
Expected: shidasu関連のエラー0件

Run: `npm run build`
Expected: ビルド成功

- [ ] **Step 7: Commit**

```bash
git add src/routes/game/shidasu/+page.svelte src/routes/admin/shidasu-debug/+page.svelte
git commit -m "feat: 護符バッジUIで得点内訳パーツの対象護符を黄色枠でハイライト"
```

---

### Task 5: 統合確認

**Files:** なし(確認のみ)

- [ ] **Step 1: 全テストを実行する**

Run: `npx vitest run`
Expected: 全ファイルPASS

- [ ] **Step 2: ビルドを実行する**

Run: `npm run build`
Expected: ビルド成功

- [ ] **Step 3: 型チェックを実行する**

Run: `npm run check`
Expected: shidasu関連のエラー0件(他ツールの既存エラーは無関係のため無視してよい)

- [ ] **Step 4: 開発サーバーで目視確認する**

Run: `npm run dev`

確認項目:
- `/game/shidasu`で護符効果(例: 春風など、gainedチャンネルの加算護符)が発動するプレイを行い、得点内訳アニメーションのフェーズ1でそのパーツが中央表示されている間、対応する護符バッジが黄色枠でハイライトされることを確認する
- 全消し・列一掃を発生させ、clearBonusチャンネルの護符効果パーツでも同様にハイライトされることを確認する
- `/admin/shidasu-debug`で水鏡+他の護符を所持させ、水鏡のエコー分パーツが中央表示されている間、水鏡自身のバッジがハイライトされる(エコー元の護符ではない)ことを確認する
- パターン・役パーツ(既存実装)と護符効果パーツ(今回の実装)が同一プレイで両方発生する場合、カードのハイライトと護符バッジのハイライトが順番に切り替わり、同時に表示されないことを確認する
- 基礎点のみのプレイ(パーツ1件)では、既存仕様通り順番表示自体がスキップされ、ハイライトも発生しないことを確認する
