# Wave開始時の配布アニメーション Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** 新Wave開始時、山札の位置から場札の各マス目へカードが1枚ずつ時間差で飛んでいく配布アニメーションを表示する。

**Architecture:** `PlayArea.svelte`に、`waveKey`の変化を検知する専用処理と、複数カードが同時に飛んでいる状態を管理する`dealAnimation`という新しいアニメーション状態を追加する。既存の`cleanupAnimation`/`chainResetAnimation`のワープ対策(2段`requestAnimationFrame`)パターンを踏襲しつつ、「1箇所から複数マス目へ時間差で拡散する」という今回特有の構造のため専用ロジックとして実装する。着地済みのマス目だけ実際の場札表示に切り替える`dealtCells`という追跡用`Set`を持つ。

**Tech Stack:** SvelteKit / Svelte 5 runes / TypeScript。既存パターンの流用のみで新規ライブラリなし。

---

## 前提知識(既存コードの構造)

- `src/routes/game/shidasu/PlayArea.svelte`が唯一の変更対象ファイル。`src/lib/game/shidasu/engine.ts`は変更しない。`startWave`(`engine.ts:108`)は既に同期的に全カードが配られた`WaveState`を返す構造であり、これは変更しない。
- `waveKey`が変化したことを検知する既存の`$effect`(`PlayArea.svelte:129-136`)がある。これは`displayedScore`のリセットなどを行っている。新しい配布アニメーション用のトリガーはこれとは別の新しい`$effect`として追加する(この既存`$effect`を直接拡張すると責務が混ざるため)。
- 場札は`wave.tableau: Card[][]`(列の配列、各列はカードの配列)。描画は`PlayArea.svelte:780-821`の`{#each wave.tableau as col, ci (ci)}` → `{#each col as card, ri (card.id)}`という二重ループ。各マス目の`<div>`には`data-drop-col={ci}` `data-drop-row={ri}`という属性が既についている(`PlayArea.svelte:791-792`)。
- 山札ボタンは`stockButtonEl`(`PlayArea.svelte:838`、`bind:this`済み)。この要素の`getBoundingClientRect()`を配布アニメーションの移動元座標として使う。
- 既存の`cleanupAnimation`・`chainResetAnimation`は「複数枚→1箇所」という集約型だが、今回は「1箇所→複数マス目」という拡散型のため、`runGatherAndMoveAnimation`(`PlayArea.svelte:192-256`)とは別の専用関数として実装する。
- ワープ対策の鉄則(このコードベース全体で徹底されているパターン): `transitionMs:0`で位置を固定した直後、`transitionMs`付きで実際の移動を始める際は必ず2段の`requestAnimationFrame`を挟む。1段だけだと同一フレーム内でスタイル変更がバッチ処理され、transitionが発生しない(ワープする)ブラウザがある。
- 操作ロック条件は4箇所に分散している: 場札カードボタンの`disabled`(`PlayArea.svelte:799`)とハイライト条件式(`PlayArea.svelte:801`)、山札めくりボタンの`disabled`(`PlayArea.svelte:836`)、秘儀ボタンの`usable`(`PlayArea.svelte:887`)、天啓ボタンの`usable`(`PlayArea.svelte:903`)。いずれも`playingAnimation !== null || scoreReveal !== null || cleanupAnimation !== null || chainResetAnimation !== null`という論理和パターンになっている。
- `CardFace`コンポーネントは`covered`propを受け取るが、コードベース全体で実質的に`covered={false}`(表向き)のみが使われている(唯一の例外は場札プレイ中の一瞬の特殊処理、`PlayArea.svelte:806`の`covered={!isExposedByAnimation}`)。配布アニメーションでも`covered={false}`のみを使う。
- `onDestroy`(`PlayArea.svelte:74-80`)で既存の全タイマーをクリアしている。新しいタイマーもここに追加する。

---

### Task 1: 配布アニメーションの型・state・定数を追加

**Files:**
- Modify: `src/routes/game/shidasu/PlayArea.svelte`

- [ ] **Step 1: 型定義を追加**

`ChainResetAnimation`インターフェース定義(`PlayArea.svelte:169-175`)の直後に、以下を追加する:

```ts
  // 配布アニメーション中、1枚のカードが山札から場札のマス目へ飛んでいく状態。
  interface DealingCard {
    card: Card
    colIndex: number
    rowIndex: number
    left: number
    top: number
    transitionMs: number
  }
```

- [ ] **Step 2: `$state`変数と定数を追加**

`chainResetTimer: ReturnType<typeof setTimeout> | undefined`の宣言(`PlayArea.svelte:265`)の直後に追加する:

```ts
  let dealingCards = $state<DealingCard[]>([])
  // 着地済み(実表示に切り替え済み)のマス目を"col-row"形式の文字列で追跡する。
  // 配布アニメーション進行中は、このSetに含まれないマス目を非表示にする。
  let dealtCells = $state<Set<string>>(new Set())
  let dealAnimationActive = $derived(dealingCards.length > 0)
  let dealTimers: ReturnType<typeof setTimeout>[] = []
  let previousDealWaveKey = waveKey

  const DEAL_INTERVAL_MS = 30
  const DEAL_MOVE_MS = 150
```

設計意図: `dealAnimationActive`を`$derived`にしているのは、「配布アニメーションが実行中かどうか」を他の操作ロック条件式と同じ書き味(`xxxAnimation !== null`に近い形)で参照できるようにするため。`dealingCards`が空配列になった時点で自動的に`false`になる。

- [ ] **Step 3: `onDestroy`に`dealTimers`のクリアを追加**

既存の`onDestroy`ブロック(`PlayArea.svelte:74-80`)を変更する。変更前:

```ts
  onDestroy(() => {
    clearTimeout(animationTimer1)
    clearTimeout(animationTimer2)
    clearTimeout(scoreRevealTimer)
    clearTimeout(cleanupTimer)
    clearTimeout(chainResetTimer)
  })
```

変更後:

```ts
  onDestroy(() => {
    clearTimeout(animationTimer1)
    clearTimeout(animationTimer2)
    clearTimeout(scoreRevealTimer)
    clearTimeout(cleanupTimer)
    clearTimeout(chainResetTimer)
    dealTimers.forEach(clearTimeout)
  })
```

- [ ] **Step 4: ビルドで壊れていないことを確認**

Run: `npm run build`
Expected: 成功(エラーなし)。この時点では`dealingCards`等はまだ使用されていない未使用変数の警告が出る可能性があるが、後続タスクで使用するため問題ない。

- [ ] **Step 5: コミット**

```bash
git add src/routes/game/shidasu/PlayArea.svelte
git commit -m "feat: 配布アニメーション用の型・state・定数を追加"
```

---

### Task 2: 配布アニメーションのトリガーと開始ロジックを実装

**Files:**
- Modify: `src/routes/game/shidasu/PlayArea.svelte`

- [ ] **Step 1: トリガー用の`$effect`を追加**

既存の`waveKey`監視`$effect`(`PlayArea.svelte:129-136`)の直後に、新しい`$effect`を追加する:

```ts
  $effect(() => {
    if (waveKey === undefined || waveKey === previousDealWaveKey) return
    previousDealWaveKey = waveKey
    startDealAnimation()
  })
```

設計意図: 既存の`waveKey`監視`$effect`(`displayedScore`等をリセットするもの)とは別に、配布アニメーション専用の`previousDealWaveKey`で追跡する。これは`chainResetAnimation`実装時に「同じ`previousXxxKey`を複数の`$effect`で共有すると、Svelteのeffect実行順序により片方が更新した後でもう片方が古い値のまま判定してしまう」というバグを踏んだ教訓(`previousChainWaveKey`という専用変数を導入した経緯、`PlayArea.svelte:272`付近のコメント参照)を踏まえたもの。

- [ ] **Step 2: 配布順序を生成し、時間差でカードを発射する`startDealAnimation`関数を実装**

`startChainResetAnimation`関数(`PlayArea.svelte:343`付近)の直前に、以下の関数を追加する:

```ts
  // 新Wave開始時、山札の位置から場札の各マス目へカードを配るアニメーションを開始する。
  // 配布順序はrow=0を全列左→右に1枚ずつ、次にrow=1を全列左→右…という順(spec通り)。
  function startDealAnimation() {
    dealTimers.forEach(clearTimeout)
    dealTimers = []
    dealingCards = []
    dealtCells = new Set()

    if (!stockButtonEl) return
    const fromRect = stockButtonEl.getBoundingClientRect()
    const fromLeft = fromRect.left + fromRect.width / 2
    const fromTop = fromRect.top + fromRect.height / 2

    const maxRows = Math.max(0, ...wave.tableau.map(col => col.length))
    const order: { card: Card; colIndex: number; rowIndex: number }[] = []
    for (let ri = 0; ri < maxRows; ri++) {
      for (let ci = 0; ci < wave.tableau.length; ci++) {
        const card = wave.tableau[ci][ri]
        if (card) order.push({ card, colIndex: ci, rowIndex: ri })
      }
    }

    order.forEach((entry, index) => {
      const timer = setTimeout(() => {
        dealOneCard(entry, fromLeft, fromTop)
      }, index * DEAL_INTERVAL_MS)
      dealTimers.push(timer)
    })
  }

  // 1枚のカードを山札の位置からマス目の位置へ移動させ、着地したらdealtCellsに登録して
  // 実表示へ切り替える。複数枚が時間差で同時並行するため、dealingCardsは配列で管理する。
  function dealOneCard(entry: { card: Card; colIndex: number; rowIndex: number }, fromLeft: number, fromTop: number) {
    if (!tableauEl) return
    const targetEl = tableauEl.querySelector<HTMLElement>(`[data-drop-col="${entry.colIndex}"][data-drop-row="${entry.rowIndex}"]`)
    if (!targetEl) return
    const targetRect = targetEl.getBoundingClientRect()
    const targetLeft = targetRect.left + targetRect.width / 2
    const targetTop = targetRect.top + targetRect.height / 2

    dealingCards = [
      ...dealingCards,
      { card: entry.card, colIndex: entry.colIndex, rowIndex: entry.rowIndex, left: fromLeft, top: fromTop, transitionMs: 0 },
    ]

    requestAnimationFrame(() => {
      requestAnimationFrame(() => {
        dealingCards = dealingCards.map(d =>
          d.colIndex === entry.colIndex && d.rowIndex === entry.rowIndex
            ? { ...d, left: targetLeft, top: targetTop, transitionMs: DEAL_MOVE_MS }
            : d
        )
      })
    })

    const timer = setTimeout(() => {
      dealtCells = new Set([...dealtCells, `${entry.colIndex}-${entry.rowIndex}`])
      dealingCards = dealingCards.filter(d => !(d.colIndex === entry.colIndex && d.rowIndex === entry.rowIndex))
    }, DEAL_MOVE_MS)
    dealTimers.push(timer)
  }
```

設計意図: `order`配列は`row=0`を全列左から右へ、次に`row=1`を全列左から右へ…という順に構築される(spec通り)。列によって枚数が異なる場合(将来の拡張)でも`wave.tableau[ci][ri]`が`undefined`になるだけで安全にスキップされる。`dealTimers`配列に全タイマーを蓄積しているのは、`onDestroy`で確実にクリアするため。

- [ ] **Step 3: ビルドで壊れていないことを確認**

Run: `npm run build`
Expected: 成功(エラーなし)

- [ ] **Step 4: コミット**

```bash
git add src/routes/game/shidasu/PlayArea.svelte
git commit -m "feat: Wave開始時の配布アニメーション開始ロジックを実装"
```

---

### Task 3: 場札表示の切り替え・操作ロック・オーバーレイ描画を追加

**Files:**
- Modify: `src/routes/game/shidasu/PlayArea.svelte`

- [ ] **Step 1: 場札マス目の表示条件に「未着地なら非表示」を追加**

場札カードの`<div>`(`PlayArea.svelte:788-793`付近)の`isCleaningUpThisColumn`の`{@const}`定義の直後に、新しい`{@const}`を追加し、`invisible`判定に組み込む。

変更前(`PlayArea.svelte:782-793`):

```svelte
        {#each col as card, ri (card.id)}
          {@const isTop = ri === col.length - 1}
          {@const isExposedByAnimation = playingAnimation !== null && playingAnimation.colIndex === ci && ri === col.length - 2}
          {@const isSelectable = columnTargetMode ? isTop : (isTop || wave.playFromAnywhereActiveThisWave)}
          {@const isAnimatingThisCard = playingAnimation?.colIndex === ci && playingAnimation?.rowIndex === ri}
          {@const isCleaningUpThisColumn = (cleanupAnimation?.kind === 'column' && cleanupAnimation.columnIndex === ci) || cleanedUpColumns.has(ci)}
          <div
            class="absolute left-0 right-0 {dropTarget && dropTarget !== 'stockTop' && dropTarget.col === ci && dropTarget.row === ri ? 'ring-4 ring-sky-400 rounded-lg' : ''} {isAnimatingThisCard || isCleaningUpThisColumn ? 'invisible' : ''}"
            style="top:{ri * 18}px; z-index:{ri};"
            data-drop-col={ci}
            data-drop-row={ri}
          >
```

変更後:

```svelte
        {#each col as card, ri (card.id)}
          {@const isTop = ri === col.length - 1}
          {@const isExposedByAnimation = playingAnimation !== null && playingAnimation.colIndex === ci && ri === col.length - 2}
          {@const isSelectable = columnTargetMode ? isTop : (isTop || wave.playFromAnywhereActiveThisWave)}
          {@const isAnimatingThisCard = playingAnimation?.colIndex === ci && playingAnimation?.rowIndex === ri}
          {@const isCleaningUpThisColumn = (cleanupAnimation?.kind === 'column' && cleanupAnimation.columnIndex === ci) || cleanedUpColumns.has(ci)}
          {@const isNotYetDealt = dealAnimationActive && !dealtCells.has(`${ci}-${ri}`)}
          <div
            class="absolute left-0 right-0 {dropTarget && dropTarget !== 'stockTop' && dropTarget.col === ci && dropTarget.row === ri ? 'ring-4 ring-sky-400 rounded-lg' : ''} {isAnimatingThisCard || isCleaningUpThisColumn || isNotYetDealt ? 'invisible' : ''}"
            style="top:{ri * 18}px; z-index:{ri};"
            data-drop-col={ci}
            data-drop-row={ri}
          >
```

設計意図: `dealAnimationActive`が`false`(配布アニメーション未実行、つまり通常プレイ中)のときは`isNotYetDealt`が常に`false`になるため、既存の場札表示に一切影響しない。配布アニメーション実行中のみ、まだ`dealtCells`に登録されていないマス目が隠れる。

- [ ] **Step 2: 場札カードボタンの操作ロック条件に追加**

`PlayArea.svelte:799`の`disabled`属性:

変更前:
```svelte
                disabled={playingAnimation !== null || scoreReveal !== null || cleanupAnimation !== null || chainResetAnimation !== null}
```

変更後:
```svelte
                disabled={playingAnimation !== null || scoreReveal !== null || cleanupAnimation !== null || chainResetAnimation !== null || dealAnimationActive}
```

`PlayArea.svelte:801`のハイライト条件式:

変更前:
```svelte
                class="block w-full text-left {columnTargetMode ? (isTargetable ? 'ring-2 ring-fuchsia-400 shadow-lg -translate-y-0.5' : '') : (isCardPlayable && playingAnimation === null && scoreReveal === null && cleanupAnimation === null && chainResetAnimation === null ? 'ring-2 ring-yellow-300 shadow-lg -translate-y-0.5' : '')} transition-transform disabled:cursor-not-allowed"
```

変更後:
```svelte
                class="block w-full text-left {columnTargetMode ? (isTargetable ? 'ring-2 ring-fuchsia-400 shadow-lg -translate-y-0.5' : '') : (isCardPlayable && playingAnimation === null && scoreReveal === null && cleanupAnimation === null && chainResetAnimation === null && !dealAnimationActive ? 'ring-2 ring-yellow-300 shadow-lg -translate-y-0.5' : '')} transition-transform disabled:cursor-not-allowed"
```

- [ ] **Step 3: 山札めくりボタンの操作ロック条件に追加**

`PlayArea.svelte:836`:

変更前:
```svelte
      disabled={wave.stock.length === 0 || !allowDraw || playingAnimation !== null || scoreReveal !== null || cleanupAnimation !== null || chainResetAnimation !== null}
```

変更後:
```svelte
      disabled={wave.stock.length === 0 || !allowDraw || playingAnimation !== null || scoreReveal !== null || cleanupAnimation !== null || chainResetAnimation !== null || dealAnimationActive}
```

- [ ] **Step 4: 秘儀ボタンの操作ロック条件に追加**

`PlayArea.svelte:887`:

変更前:
```svelte
      {@const usable = canUseRite(params, wave, riteId) && playingAnimation === null && scoreReveal === null && cleanupAnimation === null && chainResetAnimation === null}
```

変更後:
```svelte
      {@const usable = canUseRite(params, wave, riteId) && playingAnimation === null && scoreReveal === null && cleanupAnimation === null && chainResetAnimation === null && !dealAnimationActive}
```

- [ ] **Step 5: 天啓ボタンの操作ロック条件に追加**

`PlayArea.svelte:903`:

変更前:
```svelte
      {@const usable = canUseRevelation(params, wave, revelationId) && playingAnimation === null && scoreReveal === null && cleanupAnimation === null && chainResetAnimation === null}
```

変更後:
```svelte
      {@const usable = canUseRevelation(params, wave, revelationId) && playingAnimation === null && scoreReveal === null && cleanupAnimation === null && chainResetAnimation === null && !dealAnimationActive}
```

- [ ] **Step 6: オーバーレイ描画を追加**

`chainResetAnimation`のオーバーレイ(`PlayArea.svelte:958-967`)の直後に、配布アニメーション用のオーバーレイを追加する:

```svelte
{#each dealingCards as dealingCard (`${dealingCard.colIndex}-${dealingCard.rowIndex}`)}
  <div
    class="fixed pointer-events-none z-[100] ease-out"
    style="left:{dealingCard.left}px; top:{dealingCard.top}px; width:64px; transform: translate(-50%, -50%); transition-property: left, top; transition-duration:{dealingCard.transitionMs}ms;"
  >
    <CardFace card={dealingCard.card} covered={false} />
  </div>
{/each}
```

設計意図: `dealingCards`は複数枚が同時並行するため、`{#if}`ではなく`{#each}`でループする。keyには`colIndex-rowIndex`を使う(同じマス目が二重に飛ぶことはないため、カードIDでなくてもユニーク性が保たれる)。

- [ ] **Step 7: ビルドと型チェックを確認**

Run: `npm run build && npm run check`
Expected: 両方成功、`PlayArea.svelte`に関するエラーなし(既存の他ファイルの警告・エラーは無視して構わない)

- [ ] **Step 8: コミット**

```bash
git add src/routes/game/shidasu/PlayArea.svelte
git commit -m "feat: 配布アニメーション中の場札表示切り替え・操作ロック・オーバーレイを追加"
```

---

### Task 4: 動作確認

**Files:** なし(確認のみ)

- [ ] **Step 1: ビルド・型チェック・自動テストを実行**

Run: `npm run build`
Expected: 成功

Run: `npm run check`
Expected: shidasu関連エラー0件

Run: `npx vitest run src/lib/game/shidasu`
Expected: 全件PASS(`engine.ts`は変更していないため、既存テストの結果は変化しないはず)

- [ ] **Step 2: ブラウザで実地確認**

Run: `npm run dev`

`http://localhost:5173/game/shidasu` を開き、以下を確認する:

1. ゲーム開始直後の最初のWaveで、配布アニメーションが再生されるか確認する(山札の位置から各マス目へカードが順番に飛んでいく見た目になっているか)
2. 配布順序が「row=0を全列左→右、次にrow=1を全列左→右…」という順になっているか確認する
3. 配布アニメーション中、場札・山札・秘儀・天啓のボタンが操作不能になっているか確認する
4. 配布アニメーション完了後、通常通りプレイできるか確認する
5. Waveクリア後、次のWaveへ遷移した際にも配布アニメーションが再生されるか確認する
6. 既存の片付けアニメーション・チェーンリセットアニメーションが引き続き正常に動作するか確認する(このタスクでの変更が影響していないか)

ビルドエラー・型エラー・画面の崩れがあれば、完了報告前に修正する。
