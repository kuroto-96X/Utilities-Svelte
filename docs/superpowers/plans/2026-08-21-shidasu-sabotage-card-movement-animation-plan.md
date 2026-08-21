# 妨害行動アニメーション(グループD: カード移動系) Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** カード移動系の妨害行動7個(`chainSettle`・`chainPartialDiscard`・`discardErase`・`discardBury`・`tableauCardToDiscard`・`tableauShuffle`・`chainShuffle`)に発動演出を実装する。

**Architecture:** `chainSettle`・`chainPartialDiscard`は既存のチェーンリセット検知ロジック(`wave.chain`変化の推測検知)を修正して流用する。`discardErase`・`discardBury`・`tableauCardToDiscard`は`SabotageResult`に新規フィールドを追加し、明示的シグナルとして対象を伝える(グループA〜Eで確立した「明示的シグナル、推測しない」原則)。`tableauShuffle`・`chainShuffle`は対象が常に固定(場札全体・チェーン全体)なので追加シグナル不要、`lastSabotage.id`の判定のみで発動する。

**Tech Stack:** SvelteKit, Svelte 5 runes (`$state`, `$derived`, `$effect.pre`), TypeScript, Vitest

参照設計: `docs/superpowers/specs/2026-08-21-shidasu-sabotage-card-movement-animation-design.md`

---

### Task 1: SabotageResult・WaveState.lastSabotageに新規フィールドを追加する

**Files:**
- Modify: `src/lib/game/shidasu/sabotageEffects.ts`(`SabotageResult`インターフェース)
- Modify: `src/lib/game/shidasu/types.ts`(`WaveState.lastSabotage`)
- Modify: `src/lib/game/shidasu/engine.ts`(`triggerSabotage`)

- [ ] **Step 1: `SabotageResult`に`tableauCardRemoved`・`redistributedAreas`を追加**

`src/lib/game/shidasu/sabotageEffects.ts`の`SabotageResult`インターフェースの末尾(`numericChangeTarget`フィールドの直後、閉じ`}`の直前)に以下を追加する:

```ts
  // 今回「tableauCardToDiscard(一枚没収)」で場札から取り除かれたカードの位置。
  // 個別移動アニメーション(PlayArea.svelte)の起点(該当マス目)を特定するために使う。
  tableauCardRemoved?: { colIndex: number; rowIndex: number; card: Card }
  // 今回「discardErase(捨て札消去)」「discardBury(捨て札埋没)」で2エリアをまとめて
  // シャッフル・再分配したことを明示的に伝える。対象エリアの組み合わせによって
  // 収束元・再配布先が異なるため、kindで区別する。
  redistributedAreas?:
    | { kind: 'chainAndDiscard' } // discardErase: 捨て札+チェーン→新チェーン+新捨て札
    | { kind: 'stockAndDiscard' } // discardBury: 山札+捨て札→新捨て札(裏向き)+新山札
```

修正後、`SabotageResult`インターフェース全体は以下のようになる(既存フィールドはそのまま):

```ts
export interface SabotageResult {
  wave?: Partial<WaveState>
  run?: Partial<RunState>
  affectedTableauCols?: number[]
  purgedToDiscardCount?: number
  confiscatedTarget?:
    | { kind: 'talisman'; id: ItemId; idx: number }
    | { kind: 'rite'; id: RiteId; idx: number }
    | { kind: 'revelationOrOracle'; ref: HeldRevelationOrOracleRef; idx: number }
    | { kind: 'relic'; id: RelicId; idx: number }
  forceActivatedTarget?:
    | { kind: 'rite'; id: RiteId }
    | { kind: 'revelationOrOracle'; ref: HeldRevelationOrOracleRef }
  numericChangeTarget?:
    | { kind: 'combo'; amount: number }
    | { kind: 'currency'; amount: number }
    | { kind: 'roleLevel'; names: RoleName[]; amount: number }
    | { kind: 'roleBias'; buffed: RoleName[]; nerfed: RoleName[] }
    | { kind: 'tsukumoka'; relicId: RelicId }
  tableauCardRemoved?: { colIndex: number; rowIndex: number; card: Card }
  redistributedAreas?:
    | { kind: 'chainAndDiscard' }
    | { kind: 'stockAndDiscard' }
}
```

- [ ] **Step 2: `WaveState.lastSabotage`に同じフィールドを追加**

`src/lib/game/shidasu/types.ts`の`lastSabotage?:`で始まる1行の型定義(`WaveState`インターフェース内、`numericChangeTarget`まで含む形になっている)の末尾(閉じ`}`の直前)に、以下を追加する:

```ts
tableauCardRemoved?: { colIndex: number; rowIndex: number; card: Card }; redistributedAreas?: { kind: 'chainAndDiscard' } | { kind: 'stockAndDiscard' }
```

（既存の1行スタイルに合わせて追記すること。`Card`型は同ファイル内で既にimportされている。）

- [ ] **Step 3: `triggerSabotage`が新規フィールドを`lastSabotage`へ含めるよう修正**

`src/lib/game/shidasu/engine.ts`の`triggerSabotage`関数内、`lastSabotage`の組み立て部分:

```ts
      lastSabotage: { id, seq: (wave.lastSabotage?.seq ?? 0) + 1, affectedCols: result.affectedTableauCols, purgedToDiscardCount: result.purgedToDiscardCount, confiscatedTarget: result.confiscatedTarget, forceActivatedTarget: result.forceActivatedTarget, numericChangeTarget: result.numericChangeTarget },
```

を以下に置き換える:

```ts
      lastSabotage: { id, seq: (wave.lastSabotage?.seq ?? 0) + 1, affectedCols: result.affectedTableauCols, purgedToDiscardCount: result.purgedToDiscardCount, confiscatedTarget: result.confiscatedTarget, forceActivatedTarget: result.forceActivatedTarget, numericChangeTarget: result.numericChangeTarget, tableauCardRemoved: result.tableauCardRemoved, redistributedAreas: result.redistributedAreas },
```

- [ ] **Step 4: 型チェックを実行**

Run: `npm run check`
Expected: `sabotageEffects.ts`・`types.ts`・`engine.ts`由来のエラーなし(型追加のみで既存コードはこれらの新規フィールドを参照していないため、他に影響しない)

- [ ] **Step 5: コミット**

```bash
git add src/lib/game/shidasu/sabotageEffects.ts src/lib/game/shidasu/types.ts src/lib/game/shidasu/engine.ts
git commit -m "feat: SabotageResultとWaveState.lastSabotageにtableauCardRemoved・redistributedAreasを追加する"
```

---

### Task 2: chainSettle・chainPartialDiscardの既存チェーンリセット検知ロジックを修正する

**Files:**
- Modify: `src/routes/game/shidasu/PlayArea.svelte`(`resetCards`計算)

**背景:** `PlayArea.svelte`の既存の`$effect.pre`(`startChainResetAnimation`呼び出し元)は、`lastSabotage`とは独立して`wave.chain`配列の変化を推測で検知している。現在の`resetCards`計算は「現在のチェーンの末尾カードidと不一致のものを全部消えた扱いにする」ため、`chainPartialDiscard`(先頭2枚のみ除去、残りは維持)発動時に、まだ場に残っているカードまで誤って「消えたカード」として扱ってしまう不具合がある。

例: `previousChainCards = [A, B, C, D]`で先頭2枚(A, B)が除去され`currentChainCards = [C, D]`になった場合、現在のロジックでは`resetCards = [A, B, C]`となり、まだ残っている`C`まで誤って含まれる。

- [ ] **Step 1: 現在のコードを確認する**

```bash
grep -n "let previousChainCards\|isExtension\|const resetCards" src/routes/game/shidasu/PlayArea.svelte
```

以下のような箇所が見つかるはずである(現状の完全なコード、既に確認済み):

```ts
    const isExtension = currentChainCards.length === previousChainCards.length + 1
      && previousChainCards.every((card, i) => card.id === currentChainCards[i].id)
    const resetCards = isExtension
      ? []
      : currentChainCards.length > 0
        ? previousChainCards.filter(card => card.id !== currentChainCards[currentChainCards.length - 1].id)
        : previousChainCards
```

- [ ] **Step 2: `resetCards`の計算を修正**

上記コードを以下に置き換える:

```ts
    const isExtension = currentChainCards.length === previousChainCards.length + 1
      && previousChainCards.every((card, i) => card.id === currentChainCards[i].id)
    // 「現在のチェーンに含まれないカード」のみをresetCards(=今回消えたカード)とする。
    // 修正前は「現在のチェーンの末尾カードidと不一致」で判定していたため、
    // chainPartialDiscard(先頭のみ除去、残りは維持)発動時に、まだ場に残っている
    // カードまで誤って「消えた」扱いになる不具合があった。例: previousChainCards=[A,B,C,D]で
    // 先頭2枚(A,B)が除去されcurrentChainCards=[C,D]になった場合、修正前は
    // resetCards=[A,B,C]（Cを誤検知）だったが、修正後はresetCards=[A,B]（正しい）になる。
    const resetCards = isExtension
      ? []
      : previousChainCards.filter(card => !currentChainCards.some(c => c.id === card.id))
```

- [ ] **Step 3: 型チェックとビルドを実行**

Run: `npm run check`
Run: `npm run build`
Expected: どちらもエラーなし

- [ ] **Step 4: 既存テストを実行**

Run: `npm test -- engine.test.ts`
Expected: 全件PASS(`PlayArea.svelte`はエンジンテスト対象外だが、`triggerSabotage`関連の既存テストに影響が無いことを確認する)

- [ ] **Step 5: コミット**

```bash
git add src/routes/game/shidasu/PlayArea.svelte
git commit -m "fix: チェーンリセット検知のresetCards計算を修正しchainPartialDiscardの誤検知を解消する"
```

---

### Task 3: discardErase・discardBury・tableauCardToDiscardの効果関数が新規フィールドを返すよう修正する

**Files:**
- Modify: `src/lib/game/shidasu/sabotageEffects.ts`(`applyDiscardErase`・`applyDiscardBury`・`applyTableauCardToDiscard`)
- Test: `src/lib/game/shidasu/engine.test.ts`

- [ ] **Step 1: 失敗するテストを書く**

`src/lib/game/shidasu/engine.test.ts`の`describe('triggerSabotage', ...)`ブロック内に以下のテストを追記する(既存の`runWithWave`ヘルパーを使う。挿入位置はブロック内であればどこでもよい):

```ts
  it('discardErase: lastSabotage.redistributedAreasにchainAndDiscardを設定する', () => {
    const run = runWithWave()
    const next = triggerSabotage(DEFAULT_PARAMS, run, 'discardErase', () => 0)
    expect(next.wave!.lastSabotage?.redistributedAreas).toEqual({ kind: 'chainAndDiscard' })
  })

  it('discardBury: lastSabotage.redistributedAreasにstockAndDiscardを設定する', () => {
    const run = runWithWave()
    const next = triggerSabotage(DEFAULT_PARAMS, run, 'discardBury', () => 0)
    expect(next.wave!.lastSabotage?.redistributedAreas).toEqual({ kind: 'stockAndDiscard' })
  })

  it('tableauCardToDiscard: lastSabotage.tableauCardRemovedに取り除かれたカードの位置を設定する', () => {
    const run = runWithWave()
    const next = triggerSabotage(DEFAULT_PARAMS, run, 'tableauCardToDiscard', () => 0)
    const removed = next.wave!.lastSabotage?.tableauCardRemoved
    expect(removed).toBeDefined()
    expect(typeof removed?.colIndex).toBe('number')
    expect(typeof removed?.rowIndex).toBe('number')
    expect(removed?.card).toBeDefined()
  })

  it('tableauCardToDiscard: 取り除かれたカードが実際にdiscardPileへ追加される', () => {
    const run = runWithWave()
    const next = triggerSabotage(DEFAULT_PARAMS, run, 'tableauCardToDiscard', () => 0)
    const removed = next.wave!.lastSabotage?.tableauCardRemoved
    expect(removed).toBeDefined()
    const lastDiscard = next.wave!.discardPile[next.wave!.discardPile.length - 1]
    expect(lastDiscard.id).toBe(removed?.card.id)
  })

  it('tableauCardToDiscard: 場札が全て空ならtableauCardRemovedは設定されない', () => {
    const run = runWithWave({}, { tableau: [[], [], [], [], [], [], []] })
    const next = triggerSabotage(DEFAULT_PARAMS, run, 'tableauCardToDiscard', () => 0)
    expect(next.wave!.lastSabotage?.tableauCardRemoved).toBeUndefined()
  })
```

**注意:** `runWithWave`の実際のシグネチャ(引数の順序・省略可能な引数の形)を既存コードから確認し、上記テストがそのシグネチャに合うよう調整すること。空の場札を作る際の`tableau`の実際の列数(`params.layout.cols`)を確認し、実際の列数に合わせて空配列の個数を調整すること。

- [ ] **Step 2: テストを実行して失敗を確認**

Run: `npm test -- engine.test.ts -t "redistributedAreas|tableauCardRemoved"`
Expected: FAIL(新規フィールドが`undefined`のまま)

- [ ] **Step 3: `applyDiscardErase`を修正**

`src/lib/game/shidasu/sabotageEffects.ts`の`applyDiscardErase`関数:

```ts
function applyDiscardErase({ wave, rand }: SabotageContext): SabotageResult {
  const chainCount = wave.chain.length
  const pool = [...wave.discardPile, ...wave.chain]
  shuffleInPlace(pool, rand)
  const chain = pool.slice(0, chainCount)
  const discardPile = pool.slice(chainCount)
  const chainOrigin = chain.map(() => 'draw' as const)
  return { wave: { chain, chainOrigin, discardPile, foundation: chain[chain.length - 1] } }
}
```

を以下に置き換える:

```ts
function applyDiscardErase({ wave, rand }: SabotageContext): SabotageResult {
  const chainCount = wave.chain.length
  const pool = [...wave.discardPile, ...wave.chain]
  shuffleInPlace(pool, rand)
  const chain = pool.slice(0, chainCount)
  const discardPile = pool.slice(chainCount)
  const chainOrigin = chain.map(() => 'draw' as const)
  return { wave: { chain, chainOrigin, discardPile, foundation: chain[chain.length - 1] }, redistributedAreas: { kind: 'chainAndDiscard' } }
}
```

- [ ] **Step 4: `applyDiscardBury`を修正**

`src/lib/game/shidasu/sabotageEffects.ts`の`applyDiscardBury`関数:

```ts
function applyDiscardBury({ wave, rand }: SabotageContext): SabotageResult {
  const n = wave.discardPile.length
  const pool = [...wave.stock, ...wave.discardPile]
  shuffleInPlace(pool, rand)
  const discardPile = pool.slice(0, n).map(c => ({ ...c, faceUp: false }))
  const stock = pool.slice(n)
  return { wave: { stock, discardPile } }
}
```

を以下に置き換える:

```ts
function applyDiscardBury({ wave, rand }: SabotageContext): SabotageResult {
  const n = wave.discardPile.length
  const pool = [...wave.stock, ...wave.discardPile]
  shuffleInPlace(pool, rand)
  const discardPile = pool.slice(0, n).map(c => ({ ...c, faceUp: false }))
  const stock = pool.slice(n)
  return { wave: { stock, discardPile }, redistributedAreas: { kind: 'stockAndDiscard' } }
}
```

- [ ] **Step 5: `applyTableauCardToDiscard`を修正**

`src/lib/game/shidasu/sabotageEffects.ts`の`applyTableauCardToDiscard`関数:

```ts
function applyTableauCardToDiscard({ wave, rand }: SabotageContext): SabotageResult {
  const positions: { ci: number; ri: number }[] = []
  wave.tableau.forEach((col, ci) => col.forEach((_c, ri) => positions.push({ ci, ri })))
  if (positions.length === 0) return {}
  const pick = positions[Math.floor(rand() * positions.length)]
  const card = wave.tableau[pick.ci][pick.ri]
  const tableau = wave.tableau.map((col, ci) => (ci === pick.ci ? [...col.slice(0, pick.ri), ...col.slice(pick.ri + 1)] : col))
  return { wave: { tableau, discardPile: [...wave.discardPile, card] } }
}
```

を以下に置き換える:

```ts
function applyTableauCardToDiscard({ wave, rand }: SabotageContext): SabotageResult {
  const positions: { ci: number; ri: number }[] = []
  wave.tableau.forEach((col, ci) => col.forEach((_c, ri) => positions.push({ ci, ri })))
  if (positions.length === 0) return {}
  const pick = positions[Math.floor(rand() * positions.length)]
  const card = wave.tableau[pick.ci][pick.ri]
  const tableau = wave.tableau.map((col, ci) => (ci === pick.ci ? [...col.slice(0, pick.ri), ...col.slice(pick.ri + 1)] : col))
  return { wave: { tableau, discardPile: [...wave.discardPile, card] }, tableauCardRemoved: { colIndex: pick.ci, rowIndex: pick.ri, card } }
}
```

- [ ] **Step 6: テストを実行して成功を確認**

Run: `npm test -- engine.test.ts -t "redistributedAreas|tableauCardRemoved|tableauCardToDiscard"`
Expected: PASS(全件)

- [ ] **Step 7: 型チェックとフルテストを実行**

Run: `npm run check`
Run: `npm test -- engine.test.ts`
Expected: どちらもエラーなし

- [ ] **Step 8: コミット**

```bash
git add src/lib/game/shidasu/sabotageEffects.ts src/lib/game/shidasu/engine.test.ts
git commit -m "feat: discardErase・discardBury・tableauCardToDiscardが新規シグナルを返すようにする"
```

---

### Task 4: tableauCardToDiscardの個別移動アニメーションを実装する

**Files:**
- Modify: `src/routes/game/shidasu/PlayArea.svelte`

**設計:** 既存の`startStockPurgeAnimation`(山札→捨て札の個別移動)をベースに、起点を`stockButtonEl`固定ではなく場札の該当マス目に変えた新規関数を実装する。1枚のみの移動のため`DEAL_INTERVAL_MS`間隔の分岐は不要。移動する場札のカードは常に`faceUp: true`扱い(場札のカードは表向き)のため、着地後は必ずフリップ演出を行う。

- [ ] **Step 1: 現在の`startStockPurgeAnimation`を確認する**

```bash
grep -n "function startStockPurgeAnimation" -A 40 src/routes/game/shidasu/PlayArea.svelte
```

以下のような実装が確認できる(既に確認済み、参考にする):

```ts
  function startStockPurgeAnimation(count: number) {
    if (count <= 0 || !stockButtonEl || !discardPileEl) return
    discardPurgeActive = true
    const fromRect = stockButtonEl.getBoundingClientRect()
    const fromLeft = fromRect.left + fromRect.width / 2
    const fromTop = fromRect.top + fromRect.height / 2
    const toRect = discardPileEl.getBoundingClientRect()
    const toLeft = toRect.left + toRect.width / 2
    const toTop = toRect.top + toRect.height / 2

    const purged = wave.discardPile.slice(wave.discardPile.length - count)

    purged.forEach((card, index) => {
      const timer = setTimeout(() => {
        discardPurgeCards = [...discardPurgeCards, { card, left: fromLeft, top: fromTop, transitionMs: 0 }]

        requestAnimationFrame(() => {
          requestAnimationFrame(() => {
            discardPurgeCards = discardPurgeCards.map(d => (d.card.id === card.id ? { ...d, left: toLeft, top: toTop, transitionMs: DEAL_MOVE_MS } : d))
          })
        })

        const landTimer = setTimeout(() => {
          discardPurgeCards = discardPurgeCards.filter(d => d.card.id !== card.id)
          if (index === purged.length - 1) {
            if (card.faceUp === false) {
              displayedDiscardTop = card
              discardPurgeActive = false
            } else {
              startDiscardFlipReveal(card)
            }
          }
        }, DEAL_MOVE_MS)
        dealTimers.push(landTimer)
      }, index * DEAL_INTERVAL_MS)
      dealTimers.push(timer)
    })
  }
```

- [ ] **Step 2: `startTableauCardToDiscardAnimation`を追加**

`startStockPurgeAnimation`関数の直後に、以下の新規関数を追加する:

```ts

  // 「一枚没収」(tableauCardToDiscard)発動時、場札の該当マス目から捨て札へ1枚を
  // 個別移動させる。startStockPurgeAnimationとほぼ同じ構造だが、起点が山札ボタン固定
  // ではなく場札の該当マス目である点、および常に1枚のみ(複数枚の時間差処理が不要)な
  // 点が異なる。場札のカードは常に表向き(faceUp: true)のため、着地後は必ず
  // フリップ演出(startDiscardFlipReveal)を行う。
  function startTableauCardToDiscardAnimation(removed: { colIndex: number; rowIndex: number; card: Card }) {
    if (!tableauEl || !discardPileEl) return
    const fromEl = tableauEl.querySelector<HTMLElement>(`[data-drop-col="${removed.colIndex}"][data-drop-row="${removed.rowIndex}"]`)
    if (!fromEl) return
    discardPurgeActive = true
    const fromRect = fromEl.getBoundingClientRect()
    const fromLeft = fromRect.left + fromRect.width / 2
    const fromTop = fromRect.top + fromRect.height / 2
    const toRect = discardPileEl.getBoundingClientRect()
    const toLeft = toRect.left + toRect.width / 2
    const toTop = toRect.top + toRect.height / 2

    const card = removed.card
    discardPurgeCards = [...discardPurgeCards, { card, left: fromLeft, top: fromTop, transitionMs: 0 }]

    requestAnimationFrame(() => {
      requestAnimationFrame(() => {
        discardPurgeCards = discardPurgeCards.map(d => (d.card.id === card.id ? { ...d, left: toLeft, top: toTop, transitionMs: DEAL_MOVE_MS } : d))
      })
    })

    const landTimer = setTimeout(() => {
      discardPurgeCards = discardPurgeCards.filter(d => d.card.id !== card.id)
      startDiscardFlipReveal(card)
    }, DEAL_MOVE_MS)
    dealTimers.push(landTimer)
  }
```

- [ ] **Step 3: `$effect.pre`の`lastSabotage`検知ブロックに分岐を追加**

`grep -n "let previousSabotageSeq" -A 27 src/routes/game/shidasu/PlayArea.svelte`で現在の検知ブロックを確認する(Task 1完了後もこのブロック自体はまだ変更していない状態のはず)。

既存の`numericChangeTarget`分岐(末尾の`else if`)の直後、ブロックを閉じる`})`の直前に、以下の新しい`else if`を追加する:

```ts
    } else if (current.id === 'tableauCardToDiscard') {
      if (current.tableauCardRemoved) {
        startTableauCardToDiscardAnimation(current.tableauCardRemoved)
      }
    }
```

つまり、既存の末尾部分:

```ts
    } else if (current.id === 'comboBreather' || current.id === 'comboReduce' || current.id === 'currencyConfiscate' || current.id === 'currencyDrain' || current.id === 'roleLevelDecay' || current.id === 'roleBias' || current.id === 'tsukumokaRelease') {
      if (current.numericChangeTarget) {
        startNumericPopupAnimation(current.numericChangeTarget)
      }
    }
  })
```

を以下に置き換える:

```ts
    } else if (current.id === 'comboBreather' || current.id === 'comboReduce' || current.id === 'currencyConfiscate' || current.id === 'currencyDrain' || current.id === 'roleLevelDecay' || current.id === 'roleBias' || current.id === 'tsukumokaRelease') {
      if (current.numericChangeTarget) {
        startNumericPopupAnimation(current.numericChangeTarget)
      }
    } else if (current.id === 'tableauCardToDiscard') {
      if (current.tableauCardRemoved) {
        startTableauCardToDiscardAnimation(current.tableauCardRemoved)
      }
    }
  })
```

- [ ] **Step 4: 型チェックとビルドを実行**

Run: `npm run check`
Run: `npm run build`
Expected: どちらもエラーなし

- [ ] **Step 5: コミット**

```bash
git add src/routes/game/shidasu/PlayArea.svelte
git commit -m "feat: 一枚没収(tableauCardToDiscard)の個別移動アニメーションを実装する"
```

---

### Task 5: discardErase・discardBuryの収束→再配布アニメーションを実装する

**Files:**
- Modify: `src/routes/game/shidasu/PlayArea.svelte`

**設計:** 新規の汎用アニメーション状態・関数を追加する。フェーズは既存の`runGatherAndMoveAnimation`(収束→1点への移動)をそのまま使い、`onComplete`で再配布フェーズ(1点から複数の終点へ順番に飛ばす)に引き継ぐ。再配布の終点は「収束と同じ集約先エリア(discardEraseなら新チェーン分、discardBuryなら新捨て札分)」と「別のエリア(discardEraseなら新捨て札分、discardBuryなら新山札分)」の2種類がある。

- [ ] **Step 1: 新規の状態・型を追加**

`chainResetAnimation`・`chainResetTimer`の宣言(`let chainResetAnimation = $state<ChainResetAnimation | null>(null)` / `let chainResetTimer: ReturnType<typeof setTimeout> | undefined`)の直後に、以下を追加する:

```ts

  // discardErase・discardBury発動時の「収束→再配布」演出用。ChainResetAnimationと
  // 同じgather/moveの2フェーズ構成をrunGatherAndMoveAnimationで共有する。
  let discardRedistributeAnimation = $state<ChainResetAnimation | null>(null)
  let discardRedistributeTimer: ReturnType<typeof setTimeout> | undefined

  // 収束完了後、1点から複数の終点(自分自身の位置+別エリア)へ順番に飛ばすカードの状態。
  // destinationで終点を区別する('primary'=集約先と同じエリアへ戻る分、'secondary'=別エリアへ
  // 移動する分)。
  interface DiscardRedistributeCard {
    card: Card
    left: number
    top: number
    transitionMs: number
    destination: 'primary' | 'secondary'
  }
  let discardRedistributeCards = $state<DiscardRedistributeCard[]>([])
```

- [ ] **Step 2: `startDiscardRedistributeAnimation`を追加**

`startChainResetAnimation`関数の直後(`startCleanupItem`関数の直前)に、以下の新規関数を追加する:

```ts

  // 「捨て札消去」(discardErase)・「捨て札埋没」(discardBury)発動時、対象2エリアの
  // 全カードを1点に集約してから、新しい内容(wave.chain/wave.discardPile/wave.stock)を
  // 元に再配布するアニメーションを開始する。
  //
  // discardErase(kind: 'chainAndDiscard'): 集約先=chainAreaEl中心。収束元は現在の
  //   wave.discardPile全カード(discardPileElから)+現在のwave.chain全カード
  //   (chainAreaElの各data-chain-card-idから)。再配布はwave.chainの枚数分を
  //   chainAreaElへ('primary')、残りをdiscardPileElへ('secondary')。
  // discardBury(kind: 'stockAndDiscard'): 集約先=discardPileEl中心。収束元は
  //   wave.discardPile全カード(discardPileElから)。wave.stockは個別カード表示を
  //   持たないため、収束元としてはstockButtonElの位置を使う(実際に集めるカード表示は
  //   discardPile分のみ)。再配布はwave.discardPileの枚数分をdiscardPileElへ
  //   ('primary'、常にfaceUp: falseで着地)、残りはstockButtonEl位置へ移動して消える
  //   ('secondary'、山札は個別表示が無いため到着後はフェードせず即座に消す)。
  function startDiscardRedistributeAnimation(areas: { kind: 'chainAndDiscard' } | { kind: 'stockAndDiscard' }) {
    if (!chainAreaEl || !discardPileEl || !stockButtonEl) return

    const gatherCards: GatherMoveCardPosition[] = []
    let representativeCard: Card | null = null

    if (areas.kind === 'chainAndDiscard') {
      wave.chain.forEach(card => {
        const el = chainAreaEl?.querySelector<HTMLElement>(`[data-chain-card-id="${card.id}"]`)
        if (!el) return
        const rect = el.getBoundingClientRect()
        gatherCards.push({ card, left: rect.left + rect.width / 2, top: rect.top + rect.height / 2 })
        representativeCard = card
      })
      const discardRect = discardPileEl.getBoundingClientRect()
      wave.discardPile.forEach(card => {
        gatherCards.push({ card, left: discardRect.left + discardRect.width / 2, top: discardRect.top + discardRect.height / 2 })
        representativeCard = representativeCard ?? card
      })
    } else {
      const discardRect = discardPileEl.getBoundingClientRect()
      wave.discardPile.forEach(card => {
        gatherCards.push({ card, left: discardRect.left + discardRect.width / 2, top: discardRect.top + discardRect.height / 2 })
        representativeCard = representativeCard ?? card
      })
    }
    if (gatherCards.length === 0 || !representativeCard) return

    const gatherTargetRect = areas.kind === 'chainAndDiscard' ? chainAreaEl.getBoundingClientRect() : discardPileEl.getBoundingClientRect()
    const gatherLeft = gatherTargetRect.left + gatherTargetRect.width / 2
    const gatherTop = gatherTargetRect.top + gatherTargetRect.height / 2

    discardRedistributeAnimation = {
      phase: 'gather',
      left: gatherLeft,
      top: gatherTop,
      transitionMs: 0,
      gatherCards,
    }

    runGatherAndMoveAnimation({
      getAnimation: () => discardRedistributeAnimation,
      setAnimation: next => { discardRedistributeAnimation = next },
      setTimer: timer => { discardRedistributeTimer = timer },
      gatherCards,
      representativeCard,
      gatherLeft,
      gatherTop,
      getMoveTarget: () => ({ left: gatherLeft, top: gatherTop }),
      gatherMs: CLEANUP_GATHER_MS,
      moveMs: CLEANUP_MOVE_MS,
      onComplete: () => startDiscardRedistributeDeal(areas, gatherLeft, gatherTop),
    })
  }

  // 収束完了後、集約ポイントから新しい内容(wave.chain/wave.discardPile)へ1枚ずつ
  // 再配布する。primaryは集約先と同じエリアへ(discardEraseならchainAreaEl、
  // discardBuryならdiscardPileEl)、secondaryは別エリアへ飛ばす。
  function startDiscardRedistributeDeal(areas: { kind: 'chainAndDiscard' } | { kind: 'stockAndDiscard' }, fromLeft: number, fromTop: number) {
    if (!chainAreaEl || !discardPileEl || !stockButtonEl) return

    const primaryCards = areas.kind === 'chainAndDiscard' ? wave.chain : wave.discardPile
    const secondaryCards = areas.kind === 'chainAndDiscard' ? wave.discardPile : []
    const primaryRect = areas.kind === 'chainAndDiscard' ? chainAreaEl.getBoundingClientRect() : discardPileEl.getBoundingClientRect()
    const primaryLeft = primaryRect.left + primaryRect.width / 2
    const primaryTop = primaryRect.top + primaryRect.height / 2
    const secondaryRect = areas.kind === 'chainAndDiscard' ? discardPileEl.getBoundingClientRect() : stockButtonEl.getBoundingClientRect()
    const secondaryLeft = secondaryRect.left + secondaryRect.width / 2
    const secondaryTop = secondaryRect.top + secondaryRect.height / 2

    const order: { card: Card; destination: 'primary' | 'secondary'; toLeft: number; toTop: number }[] = [
      ...primaryCards.map(card => ({ card, destination: 'primary' as const, toLeft: primaryLeft, toTop: primaryTop })),
      ...secondaryCards.map(card => ({ card, destination: 'secondary' as const, toLeft: secondaryLeft, toTop: secondaryTop })),
    ]

    if (order.length === 0) {
      chainAreaHiddenForRedistribute = false
      return
    }

    order.forEach((entry, index) => {
      const timer = setTimeout(() => {
        discardRedistributeCards = [...discardRedistributeCards, { card: entry.card, left: fromLeft, top: fromTop, transitionMs: 0, destination: entry.destination }]

        requestAnimationFrame(() => {
          requestAnimationFrame(() => {
            discardRedistributeCards = discardRedistributeCards.map(d => (d.card.id === entry.card.id ? { ...d, left: entry.toLeft, top: entry.toTop, transitionMs: DEAL_MOVE_MS } : d))
          })
        })

        const landTimer = setTimeout(() => {
          discardRedistributeCards = discardRedistributeCards.filter(d => d.card.id !== entry.card.id)
          if (index === order.length - 1) {
            chainAreaHiddenForRedistribute = false
          }
        }, DEAL_MOVE_MS)
        dealTimers.push(landTimer)
      }, index * DEAL_INTERVAL_MS)
      dealTimers.push(timer)
    })
  }
```

- [ ] **Step 3: チェーンエリアの先出し防止フラグを追加**

Step 1で追加した`discardRedistributeCards`の宣言の直後に、以下を追加する:

```ts

  // discardErase・discardBury発動中、チェーンエリアの常設表示(wave.chainを直接
  // 参照する描画)が再配布完了前の新しい内容を先出ししないようにする同期ガードフラグ
  // (CLAUDE.md「移動アニメーション実装時の注意」・chainResetAnimationと同じ原則)。
  let chainAreaHiddenForRedistribute = $state(false)
```

`startDiscardRedistributeAnimation`関数の先頭(`if (!chainAreaEl || !discardPileEl || !stockButtonEl) return`の直後)に以下を追加する:

```ts
    chainAreaHiddenForRedistribute = true
```

- [ ] **Step 4: `$effect.pre`の`lastSabotage`検知ブロックに分岐を追加**

Task 4で追加した`tableauCardToDiscard`分岐の直後に、以下の新しい`else if`を追加する:

```ts
    } else if (current.id === 'discardErase' || current.id === 'discardBury') {
      if (current.redistributedAreas) {
        startDiscardRedistributeAnimation(current.redistributedAreas)
      }
    }
```

つまり、Task 4で作った末尾部分:

```ts
    } else if (current.id === 'tableauCardToDiscard') {
      if (current.tableauCardRemoved) {
        startTableauCardToDiscardAnimation(current.tableauCardRemoved)
      }
    }
  })
```

を以下に置き換える:

```ts
    } else if (current.id === 'tableauCardToDiscard') {
      if (current.tableauCardRemoved) {
        startTableauCardToDiscardAnimation(current.tableauCardRemoved)
      }
    } else if (current.id === 'discardErase' || current.id === 'discardBury') {
      if (current.redistributedAreas) {
        startDiscardRedistributeAnimation(current.redistributedAreas)
      }
    }
  })
```

- [ ] **Step 5: チェーンエリアの表示に先出し防止フラグを反映**

チェーンエリアの`<div bind:this={chainAreaEl} ...>`要素を探す:

```bash
grep -n "bind:this={chainAreaEl}" src/routes/game/shidasu/PlayArea.svelte
```

現在:

```svelte
  <div bind:this={chainAreaEl} class="overflow-x-auto min-w-0 {cleanupAnimation?.kind === 'chain' || chainCleanedUp || chainResetAnimation !== null || dealAnimationActive ? 'invisible' : ''}">
```

を以下に置き換える:

```svelte
  <div bind:this={chainAreaEl} class="overflow-x-auto min-w-0 {cleanupAnimation?.kind === 'chain' || chainCleanedUp || chainResetAnimation !== null || dealAnimationActive || chainAreaHiddenForRedistribute ? 'invisible' : ''}">
```

- [ ] **Step 6: `anyAnimationActive`に`discardRedistributeAnimation`を含める**

`let anyAnimationActive = $derived(...)`の行を探す:

```bash
grep -n "let anyAnimationActive = \$derived" src/routes/game/shidasu/PlayArea.svelte
```

現在:

```ts
  let anyAnimationActive = $derived(playingAnimation !== null || scoreReveal !== null || cleanupAnimation !== null || chainResetAnimation !== null || dealAnimationActive || sabotageRedistributeAnimation !== null || sabotageAnimatingColumns.size > 0 || flippingCards.length > 0 || discardPurgeActive || stockShuffleActive || sealFlashActive || confiscateFadingActive)
```

を以下に置き換える:

```ts
  let anyAnimationActive = $derived(playingAnimation !== null || scoreReveal !== null || cleanupAnimation !== null || chainResetAnimation !== null || dealAnimationActive || sabotageRedistributeAnimation !== null || sabotageAnimatingColumns.size > 0 || flippingCards.length > 0 || discardPurgeActive || stockShuffleActive || sealFlashActive || confiscateFadingActive || discardRedistributeAnimation !== null || chainAreaHiddenForRedistribute)
```

- [ ] **Step 7: 収束・再配布アニメーションの描画を追加**

`chainResetAnimation`の描画部分を探す:

```bash
grep -n "{#if chainResetAnimation}" -A 10 src/routes/game/shidasu/PlayArea.svelte
```

現在(既に確認済み):

```svelte
{#if chainResetAnimation}
  {#each chainResetAnimation.gatherCards as gatherCard (gatherCard.card.id)}
    <div
      class="fixed pointer-events-none z-[100] ease-out"
      style="left:{gatherCard.left}px; top:{gatherCard.top}px; width:64px; transform: translate(-50%, -50%); transition-property: left, top; transition-duration:{chainResetAnimation.transitionMs}ms;"
    >
      <CardFace card={gatherCard.card} covered={false} faceUp={false} items={[]} />
    </div>
  {/each}
{/if}
```

このブロックの直後に、以下を追加する:

```svelte

{#if discardRedistributeAnimation}
  {#each discardRedistributeAnimation.gatherCards as gatherCard (gatherCard.card.id)}
    <div
      class="fixed pointer-events-none z-[100] ease-out"
      style="left:{gatherCard.left}px; top:{gatherCard.top}px; width:64px; transform: translate(-50%, -50%); transition-property: left, top; transition-duration:{discardRedistributeAnimation.transitionMs}ms;"
    >
      <CardFace card={gatherCard.card} covered={false} faceUp={false} items={[]} />
    </div>
  {/each}
{/if}

{#each discardRedistributeCards as moveCard (moveCard.card.id)}
  <div
    class="fixed pointer-events-none z-[100] ease-out"
    style="left:{moveCard.left}px; top:{moveCard.top}px; width:64px; transform: translate(-50%, -50%); transition-property: left, top; transition-duration:{moveCard.transitionMs}ms;"
  >
    <CardFace card={moveCard.card} covered={false} faceUp={false} items={[]} />
  </div>
{/each}
```

- [ ] **Step 8: 型チェックとビルドを実行**

Run: `npm run check`
Run: `npm run build`
Expected: どちらもエラーなし

- [ ] **Step 9: コミット**

```bash
git add src/routes/game/shidasu/PlayArea.svelte
git commit -m "feat: 捨て札消去・捨て札埋没の収束+再配布アニメーションを実装する"
```

---

### Task 6: tableauShuffleの全カード裏向きシェイク→めくり直しアニメーションを実装する

**Files:**
- Modify: `src/routes/game/shidasu/PlayArea.svelte`

**設計:** 場札の全マス目が一斉に裏向き表示+シェイクへ切り替わり、一定時間後に新しい配置(既にシャッフル済みのwave.tableau)を反映する。各カードのフリップ判定は「新しい位置がその列のトップかどうか」も加味する(`card.faceUp !== false || 新isTop`)。既存の場札描画は`faceUp={card.faceUp !== false || isTop}`という式(isTopは現在の描画時点での位置基準)を使っているため、演出用の一時状態が無ければ自然とこの式で判定される。つまり、シェイク終了後に実データ(既に新しい配置になっている`wave.tableau`)をそのまま描画に反映するだけで、フリップ判定は自動的に正しくなる。

- [ ] **Step 1: 新規の状態を追加**

`stockShuffleActive`の宣言(`let stockShuffleActive = $state(false)`)の直後に、以下を追加する:

```ts

  // 「総入れ替え」(tableauShuffle)発動時、場札全体が一瞬裏向き表示に切り替わり
  // シェイクする演出用フラグ。trueの間、場札の各カードはfaceUpを無視して強制的に
  // 裏向き表示にする(実データのwave.tableauはこの時点で既にシャッフル後の内容に
  // 更新済みのため、実データを直接参照すると新配置が先出しされてしまう。CLAUDE.mdの
  // 「移動アニメーション実装時の注意」に基づく同期ガードフラグ)。
  let tableauShuffleActive = $state(false)
```

- [ ] **Step 2: `startTableauShuffleAnimation`を追加**

`startStockShuffleAnimation`関数の直後に、以下の新規関数を追加する:

```ts

  // 「総入れ替え」(tableauShuffle)発動時、場札全体を一瞬裏向き+シェイク表示にしてから
  // 新しい配置(実データは既に更新済み)を反映する。startStockShuffleAnimationと同様の
  // 「回転で揺れる」動きではなく、CSS(shidasu-numeric-shakeの左右シェイク)を場札全体の
  // ラッパー要素に適用する。
  function startTableauShuffleAnimation() {
    tableauShuffleActive = true
    const timer = setTimeout(() => {
      tableauShuffleActive = false
    }, 400)
    dealTimers.push(timer)
  }
```

- [ ] **Step 3: `$effect.pre`の`lastSabotage`検知ブロックに分岐を追加**

Task 5で追加した`discardErase`/`discardBury`分岐の直後に、以下の新しい`else if`を追加する:

```ts
    } else if (current.id === 'tableauShuffle') {
      startTableauShuffleAnimation()
    }
```

つまり、Task 5で作った末尾部分:

```ts
    } else if (current.id === 'discardErase' || current.id === 'discardBury') {
      if (current.redistributedAreas) {
        startDiscardRedistributeAnimation(current.redistributedAreas)
      }
    }
  })
```

を以下に置き換える:

```ts
    } else if (current.id === 'discardErase' || current.id === 'discardBury') {
      if (current.redistributedAreas) {
        startDiscardRedistributeAnimation(current.redistributedAreas)
      }
    } else if (current.id === 'tableauShuffle') {
      startTableauShuffleAnimation()
    }
  })
```

- [ ] **Step 4: `anyAnimationActive`に`tableauShuffleActive`を含める**

`let anyAnimationActive = $derived(...)`の行(Task 5 Step 6で修正済み)を、以下に置き換える:

```ts
  let anyAnimationActive = $derived(playingAnimation !== null || scoreReveal !== null || cleanupAnimation !== null || chainResetAnimation !== null || dealAnimationActive || sabotageRedistributeAnimation !== null || sabotageAnimatingColumns.size > 0 || flippingCards.length > 0 || discardPurgeActive || stockShuffleActive || sealFlashActive || confiscateFadingActive || discardRedistributeAnimation !== null || chainAreaHiddenForRedistribute || tableauShuffleActive)
```

- [ ] **Step 5: 場札の描画にシェイク+裏向き表示を適用**

場札描画部分を探す:

```bash
grep -n "bind:this={tableauEl}" -A 30 src/routes/game/shidasu/PlayArea.svelte
```

現在の該当箇所(既に確認済み):

```svelte
  <div bind:this={tableauEl} class="grid gap-1" style="grid-template-columns: repeat({params.layout.cols}, minmax(0, 1fr));">
    {#each wave.tableau as col, ci (ci)}
      <div class="relative" style="min-height: 10.5rem;">
        {#each col as card, ri (card.id)}
          {@const isTop = ri === col.length - 1}
          {@const isSelectable = columnTargetMode ? isTop : (isTop || wave.playFromAnywhereActiveThisWave)}
          {@const isAnimatingThisCard = playingAnimation?.colIndex === ci && playingAnimation?.rowIndex === ri}
          {@const isCleaningUpThisColumn = (cleanupAnimation?.kind === 'column' && cleanupAnimation.columnIndex === ci) || cleanedUpColumns.has(ci)}
          {@const isNotYetDealt = dealAnimationActive && !dealtCells.has(`${ci}-${ri}`)}
          {@const isHiddenForSabotageRedistribute = sabotageAnimatingColumns.has(ci)}
          {@const flippingHere = flippingCards.find(f => f.colIndex === ci && f.rowIndex === ri)}
          <div
            class="absolute left-0 right-0 {dropTarget && dropTarget !== 'stockTop' && dropTarget.col === ci && dropTarget.row === ri ? 'ring-4 ring-sky-400 rounded-lg' : ''} {isAnimatingThisCard || isCleaningUpThisColumn || isNotYetDealt || isHiddenForSabotageRedistribute || flippingHere ? 'invisible' : ''}"
            style="top:{ri * 18}px; z-index:{ri};"
            data-drop-col={ci}
            data-drop-row={ri}
          >
            {#if isSelectable}
              {@const isTargetable = columnTargetMode && canTargetColumn(ci)}
              {@const isCardPlayable = !columnTargetMode && wave.status === 'playing' && isPlayable(modifier, wave, card, items)}
              <button
                type="button"
                disabled={anyAnimationActive}
                onclick={() => (columnTargetMode ? (isTargetable && onTargetColumn?.(ci)) : (isCardPlayable && startPlayCardAnimation(ci, ri, card)))}
                class="block w-full text-left {columnTargetMode ? (isTargetable ? 'ring-2 ring-fuchsia-400 shadow-lg -translate-y-0.5' : '') : (isCardPlayable && !anyAnimationActive ? 'ring-2 ring-yellow-300 shadow-lg -translate-y-0.5' : '')} transition-transform disabled:cursor-not-allowed"
              >
                <CardFace {card} covered={false} faceUp={card.faceUp !== false || isTop} {items} />
              </button>
            {:else}
              <CardFace {card} covered={false} faceUp={card.faceUp !== false || isTop} {items} />
            {/if}
          </div>
        {/each}
```

このうち、以下2箇所の`faceUp={card.faceUp !== false || isTop}`を`faceUp={!tableauShuffleActive && (card.faceUp !== false || isTop)}`に変更し、`tableauEl`の外側`<div>`に`tableauShuffleActive`時のシェイククラスを追加する。全体を以下に置き換える:

```svelte
  <div bind:this={tableauEl} class="grid gap-1 {tableauShuffleActive ? 'shidasu-numeric-shake' : ''}" style="grid-template-columns: repeat({params.layout.cols}, minmax(0, 1fr));">
    {#each wave.tableau as col, ci (ci)}
      <div class="relative" style="min-height: 10.5rem;">
        {#each col as card, ri (card.id)}
          {@const isTop = ri === col.length - 1}
          {@const isSelectable = columnTargetMode ? isTop : (isTop || wave.playFromAnywhereActiveThisWave)}
          {@const isAnimatingThisCard = playingAnimation?.colIndex === ci && playingAnimation?.rowIndex === ri}
          {@const isCleaningUpThisColumn = (cleanupAnimation?.kind === 'column' && cleanupAnimation.columnIndex === ci) || cleanedUpColumns.has(ci)}
          {@const isNotYetDealt = dealAnimationActive && !dealtCells.has(`${ci}-${ri}`)}
          {@const isHiddenForSabotageRedistribute = sabotageAnimatingColumns.has(ci)}
          {@const flippingHere = flippingCards.find(f => f.colIndex === ci && f.rowIndex === ri)}
          {@const displayFaceUp = !tableauShuffleActive && (card.faceUp !== false || isTop)}
          <div
            class="absolute left-0 right-0 {dropTarget && dropTarget !== 'stockTop' && dropTarget.col === ci && dropTarget.row === ri ? 'ring-4 ring-sky-400 rounded-lg' : ''} {isAnimatingThisCard || isCleaningUpThisColumn || isNotYetDealt || isHiddenForSabotageRedistribute || flippingHere ? 'invisible' : ''}"
            style="top:{ri * 18}px; z-index:{ri};"
            data-drop-col={ci}
            data-drop-row={ri}
          >
            {#if isSelectable}
              {@const isTargetable = columnTargetMode && canTargetColumn(ci)}
              {@const isCardPlayable = !columnTargetMode && wave.status === 'playing' && isPlayable(modifier, wave, card, items)}
              <button
                type="button"
                disabled={anyAnimationActive}
                onclick={() => (columnTargetMode ? (isTargetable && onTargetColumn?.(ci)) : (isCardPlayable && startPlayCardAnimation(ci, ri, card)))}
                class="block w-full text-left {columnTargetMode ? (isTargetable ? 'ring-2 ring-fuchsia-400 shadow-lg -translate-y-0.5' : '') : (isCardPlayable && !anyAnimationActive ? 'ring-2 ring-yellow-300 shadow-lg -translate-y-0.5' : '')} transition-transform disabled:cursor-not-allowed"
              >
                <CardFace {card} covered={false} faceUp={displayFaceUp} {items} />
              </button>
            {:else}
              <CardFace {card} covered={false} faceUp={displayFaceUp} {items} />
            {/if}
          </div>
        {/each}
```

**注意:** `tableauShuffleActive`がtrueの間は`wave.tableau`は既に新しい配置に更新済みだが、`displayFaceUp`が常に`false`を強制するため、位置の並び替え自体は見えつつ全カードが裏向きになる(=「新しい配置に切り替わったことは見えるが中身は見えない」というシェイク中の見た目になる)。400ms後に`tableauShuffleActive`が`false`に戻ると同時に、通常の`card.faceUp !== false || isTop`判定に戻り、新しいトップカードは自動的にフリップ済み(表向き)の状態で表示される。

- [ ] **Step 6: 型チェックとビルドを実行**

Run: `npm run check`
Run: `npm run build`
Expected: どちらもエラーなし

- [ ] **Step 7: コミット**

```bash
git add src/routes/game/shidasu/PlayArea.svelte
git commit -m "feat: 総入れ替え(tableauShuffle)の全カード裏向きシェイク演出を実装する"
```

---

### Task 7: chainShuffleのチェーンエリアシェイクを実装する

**Files:**
- Modify: `src/routes/game/shidasu/PlayArea.svelte`

**設計:** 既存の`startStockShuffleAnimation`(山札攪拌、山札ボタンの回転シェイク)と同じ考え方で、対象を`chainAreaEl`に変えた新規関数を実装する。個々のカード位置は動かさず、チェーンエリア全体が短く左右にシェイクするだけ。シェイク終了と同時に新しい並び(新foundation)へパッと切り替わる(先出し防止は不要。チェーン内の並び替えは見た目上の位置情報を持たない配列順序の変更のみで、シェイク中も裏向きにする必要は無いため)。

- [ ] **Step 1: 新規の状態を追加**

Task 6 Step 1で追加した`tableauShuffleActive`の宣言の直後に、以下を追加する:

```ts

  // 「チェーン入れ替え」(chainShuffle)発動時、チェーンエリア全体がその場でシェイクする
  // 演出用フラグ。山札攪拌(stockShuffleActive)と同じ「その場で軽く揺れるだけ」の
  // 軽量パターン。
  let chainShuffleActive = $state(false)
  let chainShuffleRotation = $state(0)
  let chainShuffleTransitionMs = $state(0)
```

- [ ] **Step 2: `startChainShuffleAnimation`を追加**

`startStockShuffleAnimation`関数の直後(Task 6で追加した`startTableauShuffleAnimation`の直前)に、以下の新規関数を追加する:

```ts

  // 「チェーン入れ替え」(chainShuffle)発動時、チェーンエリアが短く左右にシェイクする。
  // startStockShuffleAnimationと全く同じ回転パターンを対象要素だけ変えて適用する。
  function startChainShuffleAnimation() {
    chainShuffleActive = true
    const steps = [-8, 8, -5, 5, 0]
    steps.forEach((deg, i) => {
      const timer = setTimeout(() => {
        chainShuffleRotation = deg
        chainShuffleTransitionMs = 60
        if (i === steps.length - 1) {
          const doneTimer = setTimeout(() => {
            chainShuffleActive = false
          }, 60)
          dealTimers.push(doneTimer)
        }
      }, i * 60)
      dealTimers.push(timer)
    })
  }
```

- [ ] **Step 3: `$effect.pre`の`lastSabotage`検知ブロックに分岐を追加**

Task 6で追加した`tableauShuffle`分岐の直後に、以下の新しい`else if`を追加する:

```ts
    } else if (current.id === 'chainShuffle') {
      startChainShuffleAnimation()
    }
```

つまり、Task 6で作った末尾部分:

```ts
    } else if (current.id === 'tableauShuffle') {
      startTableauShuffleAnimation()
    }
  })
```

を以下に置き換える:

```ts
    } else if (current.id === 'tableauShuffle') {
      startTableauShuffleAnimation()
    } else if (current.id === 'chainShuffle') {
      startChainShuffleAnimation()
    }
  })
```

- [ ] **Step 4: `anyAnimationActive`に`chainShuffleActive`を含める**

`let anyAnimationActive = $derived(...)`の行(Task 6 Step 4で修正済み)を、以下に置き換える:

```ts
  let anyAnimationActive = $derived(playingAnimation !== null || scoreReveal !== null || cleanupAnimation !== null || chainResetAnimation !== null || dealAnimationActive || sabotageRedistributeAnimation !== null || sabotageAnimatingColumns.size > 0 || flippingCards.length > 0 || discardPurgeActive || stockShuffleActive || sealFlashActive || confiscateFadingActive || discardRedistributeAnimation !== null || chainAreaHiddenForRedistribute || tableauShuffleActive || chainShuffleActive)
```

- [ ] **Step 5: チェーンエリアの描画に回転スタイルを適用**

チェーンエリアの`<div bind:this={chainAreaEl} ...>`要素(Task 5 Step 5で`chainAreaHiddenForRedistribute`を追加済み)を、以下に置き換える:

```svelte
  <div bind:this={chainAreaEl} class="overflow-x-auto min-w-0 {cleanupAnimation?.kind === 'chain' || chainCleanedUp || chainResetAnimation !== null || dealAnimationActive || chainAreaHiddenForRedistribute ? 'invisible' : ''}" style="transform: rotate({chainShuffleRotation}deg); transition-property: transform; transition-duration:{chainShuffleTransitionMs}ms;">
```

- [ ] **Step 6: 型チェックとビルドを実行**

Run: `npm run check`
Run: `npm run build`
Expected: どちらもエラーなし

- [ ] **Step 7: コミット**

```bash
git add src/routes/game/shidasu/PlayArea.svelte
git commit -m "feat: チェーン入れ替え(chainShuffle)のシェイク演出を実装する"
```

---

### Task 8: デバッグ画面での動作確認

**Files:** なし(コード変更を伴わない確認タスク)

- [ ] **Step 1: 開発サーバーを起動**

Run: `npm run dev`

- [ ] **Step 2: `/admin/shidasu-debug`で7つ全ての妨害行動を発動して確認する**

ブラウザで`http://localhost:5173/admin/shidasu-debug`(実際のポート番号は起動時の出力を確認する)を開き、デバッグパネルの「星の妨害行動を直接発動(デバッグ用)」から以下を1つずつ発動して確認する(Playwrightのadhocスクリプトを使う場合は`.superpowers/`配下に作成し、確認後に削除する):

- **強制清算**(chainSettle): チェーンにカードが複数枚ある状態で発動し、チェーン全体が捨て札へ収束移動し、山札から1枚めくって新チェーンになることを確認する。
- **チェーン部分放棄**(chainPartialDiscard): チェーンにカードが3枚以上ある状態で発動し、先頭2枚だけが捨て札へ移動し、残りのカードが場に残ったままアニメーション対象にならないことを確認する(Task 2の修正が正しく機能しているかの主要な確認ポイント)。
- **捨て札消去**(discardErase): 捨て札・チェーンにカードがある状態で発動し、両エリアのカードがチェーンエリアへ収束してから、新チェーン・新捨て札へ再配布されることを確認する。
- **捨て札埋没**(discardBury): 山札・捨て札にカードがある状態で発動し、捨て札のカードが捨て札位置へ収束してから、新捨て札(裏向き)へ再配布されることを確認する。
- **一枚没収**(tableauCardToDiscard): 場札にカードがある状態で発動し、選ばれた1枚が場札の該当マス目から捨て札へ飛んでいくことを確認する。
- **総入れ替え**(tableauShuffle): 場札にカードがある状態で発動し、場札全体が一瞬裏向き+シェイクしてから新しい配置に切り替わり、各列のトップカードが正しく表向きで見えることを確認する。
- **チェーン入れ替え**(chainShuffle): チェーンにカードが複数枚ある状態で発動し、チェーンエリア全体が短くシェイクすることを確認する。
- 各演出中、他の操作(カードプレイ・山札引き等)がブロックされること(`anyAnimationActive`がtrueの間disabled)を確認する。
- コンソールエラーが出ていないことを確認する。

- [ ] **Step 3: 型チェック・ビルド・既存テストの最終確認**

Run: `npm run check`
Run: `npm run build`
Run: `npm test`
Expected: いずれもエラーなし
