# チェーンリセット時の捨て札移動アニメーション Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** チェーンリセット(コンボ途切れ)が発生した瞬間、旧チェーンのカード(次チェーンに引き継がれる1枚を除く)が1山にまとまってから捨て札の位置へ移動するアニメーションを表示する。

**Architecture:** `PlayArea.svelte`に、`wave.chain.length`の減少を検知する`$effect`と、リセット直前のチェーン内容を保持するローカル`$state`(`previousChainSnapshot`)を追加する。減少を検知したら、既存の`cleanupAnimation`と全く同じ座標計算パターン(`getBoundingClientRect` + 2段`requestAnimationFrame`によるワープ対策)を使う新しいアニメーション状態`chainResetAnimation`を起動する。gatherフェーズでは各カードの現在描画位置を取得する必要があるため、チェーンカードの各`div`に`data-chain-card-id`属性を追加してDOM特定を可能にする。

**Tech Stack:** SvelteKit / Svelte 5 runes / TypeScript。既存パターンの流用のみで新規ライブラリなし。

---

## 前提知識(既存コードの構造)

- `src/routes/game/shidasu/PlayArea.svelte`が唯一の変更対象ファイル。`src/lib/game/shidasu/engine.ts`は変更しない。
- チェーンリセットは`engine.ts`の`resetComboFields`(呼び出し元は`playCard`等)で発生する。リセット後、`wave.chain`は`[newFoundation]`(1枚のみ)になり、旧チェーンから`newFoundation`を除いた残り(`chainToDiscard`)が`wave.discardPile`の末尾に追加される。
- `PlayArea.svelte`はpropとして`wave: WaveState`を受け取るだけで、`resetComboFields`が呼ばれたことを直接知らない。そのため、`wave.chain.length`が前回描画時より短くなったことを`$effect`で検知する。
- 参考にする既存パターンは`cleanupAnimation`(`PlayArea.svelte:139-307`)。gather→moveの2フェーズ、`CLEANUP_GATHER_MS`(37ms)・`CLEANUP_MOVE_MS`(50ms)という既存定数をそのまま流用する(スペックで指定済み)。
- 捨て札の常設UI要素は`discardPileEl`(`PlayArea.svelte:660`付近)としてすでに存在し、`bind:this`済み。移動先の座標はこの要素の`getBoundingClientRect()`を使う。
- チェーンカードは`chainEntries`(`PlayArea.svelte:517`、`wave.chain`から`{card, origin}`の配列を作る`$derived`)を`chainRows`(`chunk`関数で行分割)に分けてループ描画している(672-689行目)。各カードの`div`(680行目)には現在DOM特定用の属性が無いため、`data-chain-card-id={entry.card.id}`を追加する必要がある。
- `waveKey`の変化(新Wave開始)を検知する既存の`$effect`(`PlayArea.svelte:122-129`)と同様の除外パターンを踏襲し、新Wave開始時の`chain`初期化(`[newFoundation]`単体ではなく空→複数枚に増えるケースなど)を誤検知しないようにする。

---

### Task 1: チェーンカードDOM要素にID属性を追加

**Files:**
- Modify: `src/routes/game/shidasu/PlayArea.svelte:676-687`

- [ ] **Step 1: チェーンカードの`div`に`data-chain-card-id`属性を追加**

676〜687行目の`{#each chainRows as row, ri (ri)}`ブロック内、各カードの`div`(680行目)に属性を追加する。変更前:

```svelte
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
```

変更後:

```svelte
      {#each chainRows as row, ri (ri)}
        <div class="relative" style="height:116px; width:{64 + (row.length - 1) * params.ui.chainCardOffsetX}px;">
          {#each row as entry, j (entry.card.id)}
            <div
              class="absolute"
              data-chain-card-id={entry.card.id}
              style="left:{j * params.ui.chainCardOffsetX}px; top:{entry.origin === 'draw' ? 20 : 0}px; z-index:{j + 1}; width:64px;"
            >
              <CardFace card={entry.card} covered={false} />
            </div>
          {/each}
        </div>
      {/each}
```

- [ ] **Step 2: ビルドで壊れていないことを確認**

Run: `npm run build`
Expected: 成功(エラーなし)

- [ ] **Step 3: コミット**

```bash
git add src/routes/game/shidasu/PlayArea.svelte
git commit -m "tweak: チェーンカードDOM要素にdata-chain-card-id属性を追加"
```

---

### Task 2: チェーンリセット検知とアニメーション状態の実装

**Files:**
- Modify: `src/routes/game/shidasu/PlayArea.svelte`

このタスクでは、チェーンリセットを検知してカードを捨て札位置へ集めて移動させる一連のロジックを実装する。`cleanupAnimation`(139〜307行目)の実装パターンをほぼそのまま踏襲する。

- [ ] **Step 1: 型定義と`$state`を追加**

`PlayArea.svelte`の`CleanupAnimation`インターフェース定義(150〜159行目)の直後、`let cleanupAnimation = $state<CleanupAnimation | null>(null)`(161行目)より前に、以下を追加する:

```ts
  interface ChainResetCardPosition {
    card: Card
    left: number
    top: number
  }

  interface ChainResetAnimation {
    phase: 'gather' | 'move'
    left: number
    top: number
    transitionMs: number
    gatherCards: ChainResetCardPosition[]
  }
```

- [ ] **Step 2: `$state`変数とタイマー変数を追加**

166行目`let cleanupTimer: ReturnType<typeof setTimeout> | undefined`の直後に追加:

```ts
  let chainResetAnimation = $state<ChainResetAnimation | null>(null)
  let chainResetTimer: ReturnType<typeof setTimeout> | undefined
  let previousChainIds: number[] = wave.chain.map(c => c.id)
```

- [ ] **Step 3: `onDestroy`に`chainResetTimer`のクリアを追加**

74〜79行目の`onDestroy`ブロックを変更する。変更前:

```ts
  onDestroy(() => {
    clearTimeout(animationTimer1)
    clearTimeout(animationTimer2)
    clearTimeout(scoreRevealTimer)
    clearTimeout(cleanupTimer)
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
  })
```

- [ ] **Step 4: トリガー検知用の`$effect`を追加**

既存の`waveKey`監視`$effect`(122〜129行目)の直後に、新しい`$effect`を追加する:

```ts
  $effect(() => {
    const currentChainIds = wave.chain.map(c => c.id)
    if (waveKey !== previousWaveKey) {
      previousChainIds = currentChainIds
      return
    }
    const resetCards = previousChainIds.length > currentChainIds.length
      ? wave.chain.length > 0
        ? previousChainIds.filter(id => id !== wave.chain[wave.chain.length - 1].id)
        : previousChainIds
      : []
    previousChainIds = currentChainIds
    if (resetCards.length === 0) return
    startChainResetAnimation(resetCards)
  })
```

このコードの設計意図: `previousWaveKey`は既存の`waveKey`監視`$effect`側で更新されるため、この`$effect`内では「今回の描画で`waveKey`が変わった=新Wave境界」かどうかだけを判定し、境界ならスナップショットだけ更新してアニメーションはスキップする。`resetCards`は「前回のchainに含まれていたが、今回のchainの末尾カード(=newFoundation、次チェーンに引き継がれる1枚)ではないID」の集合。チェーンが単調増加している通常プレイ中は`previousChainIds.length > currentChainIds.length`が偽になるため`resetCards`は空になる。

- [ ] **Step 5: アニメーション開始・進行関数を実装**

`startChainResetAnimation`と補助関数を追加する。挿入位置は`processNextCleanupItem`関数(187〜195行目)の直後、`startCleanupItem`関数(197行目)より前:

```ts
  // チェーンリセット発生時、旧チェーンのカード(次チェーンに引き継がれる1枚を除く)を
  // 1山にまとめてから捨て札の位置へ移動させるアニメーションを開始する。
  // resetCardIdsはリセット直前のwave.chainのうち、次チェーンへ引き継がれなかったカードのID一覧。
  function startChainResetAnimation(resetCardIds: number[]) {
    if (!chainAreaEl || !discardPileEl) return
    const cardEntries = resetCardIds
      .map(id => {
        const cardEl = chainAreaEl?.querySelector<HTMLElement>(`[data-chain-card-id="${id}"]`)
        return cardEl ? { id, el: cardEl } : null
      })
      .filter((entry): entry is { id: number; el: HTMLElement } => entry !== null)
    if (cardEntries.length === 0) return

    const cards = wave.discardPile.slice(-resetCardIds.length).filter(c => resetCardIds.includes(c.id))
    if (cards.length !== cardEntries.length) return

    const gatherLeft = cardEntries[0].el.getBoundingClientRect().left + cardEntries[0].el.getBoundingClientRect().width / 2
    const gatherTop = cardEntries[0].el.getBoundingClientRect().top + cardEntries[0].el.getBoundingClientRect().height / 2

    const gatherCards: ChainResetCardPosition[] = cardEntries.map(entry => {
      const rect = entry.el.getBoundingClientRect()
      const card = cards.find(c => c.id === entry.id)
      return {
        card: card as Card,
        left: rect.left + rect.width / 2,
        top: rect.top + rect.height / 2,
      }
    })

    chainResetAnimation = {
      phase: 'gather',
      left: gatherLeft,
      top: gatherTop,
      transitionMs: 0,
      gatherCards,
    }

    requestAnimationFrame(() => {
      requestAnimationFrame(() => {
        if (!chainResetAnimation) return
        chainResetAnimation = {
          ...chainResetAnimation,
          gatherCards: chainResetAnimation.gatherCards.map(c => ({ ...c, left: gatherLeft, top: gatherTop })),
          transitionMs: CLEANUP_GATHER_MS,
        }
        chainResetTimer = setTimeout(() => {
          if (!chainResetAnimation || !discardPileEl) return
          // move フェーズでも gatherCards に代表カード(先頭カード)を1件だけ残す。
          // 全カードを個別に残すと捨て札位置への収束が視覚的にごちゃつくため、
          // 1山になった後は代表カード1枚の移動として表現する。
          const representativeCard = chainResetAnimation.gatherCards[0]?.card
          chainResetAnimation = {
            ...chainResetAnimation,
            phase: 'move',
            left: gatherLeft,
            top: gatherTop,
            transitionMs: 0,
            gatherCards: representativeCard ? [{ card: representativeCard, left: gatherLeft, top: gatherTop }] : [],
          }
          const toRect = discardPileEl.getBoundingClientRect()
          requestAnimationFrame(() => {
            requestAnimationFrame(() => {
              if (!chainResetAnimation) return
              chainResetAnimation = {
                ...chainResetAnimation,
                gatherCards: chainResetAnimation.gatherCards.map(c => ({
                  ...c,
                  left: toRect.left + toRect.width / 2,
                  top: toRect.top + toRect.height / 2,
                })),
                transitionMs: CLEANUP_MOVE_MS,
              }
            })
          })
          chainResetTimer = setTimeout(() => {
            chainResetAnimation = null
          }, CLEANUP_MOVE_MS)
        }, CLEANUP_GATHER_MS)
      })
    })
  }
```

このコードの設計意図: `cards`の取得に`wave.discardPile.slice(-resetCardIds.length)`を使っているのは、`$effect`発火時点で`wave.discardPile`は既にリセット後の内容(旧チェーンのカードが末尾に追加済み)になっているため。件数とID集合が一致しない場合(想定外の状態)は安全側に倒してアニメーションをスキップする。

moveフェーズでは`gatherCards`を代表カード1枚だけの配列にしている。これはTask 3で追加するオーバーレイ描画を`gatherCards`配列のループだけで完結させ、`phase`による分岐を不要にするための設計。

- [ ] **Step 6: ビルドと型チェックを確認**

Run: `npm run build && npm run check`
Expected: 両方成功、shidasu関連のエラーなし

- [ ] **Step 7: コミット**

```bash
git add src/routes/game/shidasu/PlayArea.svelte
git commit -m "feat: チェーンリセット時に捨て札へ移動するアニメーションを追加"
```

---

### Task 3: 操作ロックとオーバーレイ描画の追加

**Files:**
- Modify: `src/routes/game/shidasu/PlayArea.svelte`

- [ ] **Step 1: 場札カードボタンの操作ロック条件に追加**

613行目、場札カードボタンの`disabled`属性:

変更前:
```svelte
                disabled={playingAnimation !== null || scoreReveal !== null || cleanupAnimation !== null}
```

変更後:
```svelte
                disabled={playingAnimation !== null || scoreReveal !== null || cleanupAnimation !== null || chainResetAnimation !== null}
```

同じ行内、ハイライト表示の条件式(615行目)にある`cleanupAnimation === null`の並びにも`&& chainResetAnimation === null`を追加する。変更前:

```svelte
                class="block w-full text-left {columnTargetMode ? (isTargetable ? 'ring-2 ring-fuchsia-400 shadow-lg -translate-y-0.5' : '') : (isCardPlayable && playingAnimation === null && scoreReveal === null && cleanupAnimation === null ? 'ring-2 ring-yellow-300 shadow-lg -translate-y-0.5' : '')} transition-transform disabled:cursor-not-allowed"
```

変更後:
```svelte
                class="block w-full text-left {columnTargetMode ? (isTargetable ? 'ring-2 ring-fuchsia-400 shadow-lg -translate-y-0.5' : '') : (isCardPlayable && playingAnimation === null && scoreReveal === null && cleanupAnimation === null && chainResetAnimation === null ? 'ring-2 ring-yellow-300 shadow-lg -translate-y-0.5' : '')} transition-transform disabled:cursor-not-allowed"
```

- [ ] **Step 2: 山札めくりボタンの操作ロック条件に追加**

650行目:

変更前:
```svelte
      disabled={wave.stock.length === 0 || !allowDraw || playingAnimation !== null || scoreReveal !== null || cleanupAnimation !== null}
```

変更後:
```svelte
      disabled={wave.stock.length === 0 || !allowDraw || playingAnimation !== null || scoreReveal !== null || cleanupAnimation !== null || chainResetAnimation !== null}
```

- [ ] **Step 3: 秘儀ボタンの操作ロック条件に追加**

698行目:

変更前:
```svelte
      {@const usable = canUseRite(params, wave, riteId) && playingAnimation === null && scoreReveal === null && cleanupAnimation === null}
```

変更後:
```svelte
      {@const usable = canUseRite(params, wave, riteId) && playingAnimation === null && scoreReveal === null && cleanupAnimation === null && chainResetAnimation === null}
```

- [ ] **Step 4: 天啓ボタンの操作ロック条件に追加**

714行目:

変更前:
```svelte
      {@const usable = canUseRevelation(params, wave, revelationId) && playingAnimation === null && scoreReveal === null && cleanupAnimation === null}
```

変更後:
```svelte
      {@const usable = canUseRevelation(params, wave, revelationId) && playingAnimation === null && scoreReveal === null && cleanupAnimation === null && chainResetAnimation === null}
```

- [ ] **Step 5: 捨て札常設UIの表示条件を修正**

`discardPileEl`は`chainResetAnimation`のmoveフェーズの移動先座標として使われる(Task 2 Step 5で`discardPileEl.getBoundingClientRect()`を呼ぶ)。もし`{#if}`で要素自体をアンマウントする形にすると`discardPileEl`が`undefined`に戻ってしまうため、要素は常時マウントしたまま中身(`CardFace`)の見た目だけを`invisible`にする形にする。

659〜663行目を以下に置き換える:

```svelte
    {#if wave.discardPile.length > 0}
      <div bind:this={discardPileEl} class="w-16 {cleanupAnimation?.kind === 'discard' || chainResetAnimation !== null ? 'invisible' : ''}">
        <CardFace card={wave.discardPile[wave.discardPile.length - 1]} covered={false} />
      </div>
    {/if}
```

これにより`discardPileEl`は`wave.discardPile.length > 0`である限り常時マウントされ、`chainResetAnimation`実行中は見た目だけ隠れる。チェーンリセット直後は必ず`wave.discardPile.length > 0`(リセットで最低1枚追加される)なので、Task 2 Step 5で`discardPileEl.getBoundingClientRect()`を呼ぶ時点で要素は存在する。

- [ ] **Step 6: オーバーレイ描画を追加**

`cleanupAnimation`のオーバーレイ(749〜767行目)の直後に、`chainResetAnimation`用のオーバーレイを追加する。Task 2 Step 5の実装により、`chainResetAnimation`は`gather`フェーズ・`move`フェーズのいずれでも`gatherCards`に最低1件のカードを保持するため、`phase`による分岐は不要で、`gatherCards`配列のループだけで両フェーズを表現できる:

```svelte
{#if chainResetAnimation}
  {#each chainResetAnimation.gatherCards as gatherCard (gatherCard.card.id)}
    <div
      class="fixed pointer-events-none z-[100] ease-out"
      style="left:{gatherCard.left}px; top:{gatherCard.top}px; width:64px; transform: translate(-50%, -50%); transition-property: left, top; transition-duration:{chainResetAnimation.transitionMs}ms;"
    >
      <CardFace card={gatherCard.card} covered={false} />
    </div>
  {/each}
{/if}
```

- [ ] **Step 7: ビルドと型チェックを確認**

Run: `npm run build && npm run check`
Expected: 両方成功、shidasu関連のエラーなし

- [ ] **Step 8: コミット**

```bash
git add src/routes/game/shidasu/PlayArea.svelte
git commit -m "feat: チェーンリセットアニメーション中の操作ロックとオーバーレイ表示を追加"
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

1. 通常プレイでチェーンにカードを複数枚積んだ状態から、コンボが途切れる操作(手詰まり寸前で無関係な列をプレイする、など既存のコンボリセット条件を発生させる)を行う
2. チェーンのカード(引き継がれる1枚を除く)が、リセット直前のチェーン先頭位置に集まってから、捨て札の位置へ移動する見た目になっているか確認する
3. アニメーション中、場札・山札・秘儀・天啓のボタンが操作不能になっているか確認する
4. アニメーション完了後、捨て札の表示が正しく更新されているか確認する
5. Waveクリア後の片付けアニメーション(前回実装済み)が引き続き正常に動作するか確認する(このタスクでの変更が影響していないか)
6. 新Wave開始時、場札・チェーンが正常に表示されるか確認する(前回セッションで見つかった回帰バグが再発していないか)

ビルドエラー・型エラー・画面の崩れがあれば、完了報告前に修正する。

---

## 次のセクション

このセクション(チェーンリセット時の捨て札移動アニメーション)の実装・レビュー・pushが完了したら、続けて「Wave開始時の配布アニメーション」のセクションに着手する。brainstorming→spec→plan→実装のサイクルを個別に回す。
