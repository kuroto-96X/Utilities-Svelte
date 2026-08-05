# 得点内訳パーツの対象カードハイライト表示 Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Shidasuのカードプレイ時、得点内訳アニメーションで同スート・同色・階段・フラッシュ・ロイヤル・同ランク・コンプリートランのパーツが中央表示されている間、対象となったチェーン内カードを黄色枠でハイライトする。

**Architecture:** `ScorePart`に任意フィールド`cardIds?: number[]`を追加し、`evaluateChainBonus`(`patterns.ts`)内の該当パーツ生成箇所で対象カードの`Card.id`配列を算出して渡す。`PlayArea.svelte`は現在中央表示中のパーツの`cardIds`をローカル状態として保持し、チェーン表示ループ内で該当する`Card.id`を持つ要素に黄色枠のCSSクラスを条件付き適用する。

**Tech Stack:** SvelteKit, Svelte 5 runes, TypeScript, Vitest

---

### Task 1: ScorePartにcardIdsフィールドを追加する

**Files:**
- Modify: `src/lib/game/shidasu/scoreParts.ts`
- Test: `src/lib/game/shidasu/scoreParts.test.ts`

- [ ] **Step 1: 失敗するテストを書く**

`src/lib/game/shidasu/scoreParts.test.ts`の`describe('addPart / multiplyPart / lockPart', ...)`ブロック内、既存の`'addPartはkind=addとtextを生成する'`テストの直後に以下を追加する。

```ts
  it('addPartはcardIdsを渡すとScorePart.cardIdsに反映する', () => {
    expect(addPart('同スート', 50, [1, 2, 3])).toEqual({ label: '同スート', kind: 'add', amount: 50, text: '同スート+50', cardIds: [1, 2, 3] })
  })

  it('addPartはcardIdsを省略するとcardIdsがundefinedになる', () => {
    expect(addPart('基礎点', 10).cardIds).toBeUndefined()
  })
```

- [ ] **Step 2: テストを実行して失敗を確認する**

Run: `npx vitest run src/lib/game/shidasu/scoreParts.test.ts -t "cardIds"`
Expected: FAIL(`addPart`が3引数目を受け付けず、`cardIds`が常に`undefined`になる。1件目のテストが`toEqual`の期待値と一致せず失敗する)

- [ ] **Step 3: ScorePart型とaddPartにcardIdsを追加する**

`src/lib/game/shidasu/scoreParts.ts`の`ScorePart`インターフェースを以下のように変更する。

変更前:
```ts
export interface ScorePart {
  label: string
  kind: 'add' | 'multiply' | 'lock'
  amount: number
  text: string
}
```

変更後:
```ts
export interface ScorePart {
  label: string
  kind: 'add' | 'multiply' | 'lock'
  amount: number
  text: string
  cardIds?: number[] // ハイライト対象カードのCard.id一覧。対象カードが無いパーツ(基礎点・護符効果等)では省略する
}
```

同ファイルの`addPart`関数を以下のように変更する。

変更前:
```ts
export function addPart(label: string, amount: number): ScorePart {
  return { label, kind: 'add', amount, text: `${label}+${amount}` }
}
```

変更後:
```ts
export function addPart(label: string, amount: number, cardIds?: number[]): ScorePart {
  return { label, kind: 'add', amount, text: `${label}+${amount}`, cardIds }
}
```

`multiplyPart`・`lockPart`は変更しない。

- [ ] **Step 4: テストを実行して成功を確認する**

Run: `npx vitest run src/lib/game/shidasu/scoreParts.test.ts`
Expected: PASS(全件。既存の`addPart('基礎点', 10)`を`{ label: '基礎点', kind: 'add', amount: 10, text: '基礎点+10' }`と比較するテストも、`cardIds`が`undefined`のため`toEqual`は引き続き一致しPASSする)

- [ ] **Step 5: 全体テストを実行する**

Run: `npx vitest run`
Expected: 全件PASS(`addPart`の第3引数はoptionalなので、既存の呼び出し箇所52箇所は無変更で動作する)

- [ ] **Step 6: Commit**

```bash
git add src/lib/game/shidasu/scoreParts.ts src/lib/game/shidasu/scoreParts.test.ts
git commit -m "feat: ScorePartに対象カードID(cardIds)を追加"
```

---

### Task 2: evaluateChainBonusで対象カードIDを算出する

**Files:**
- Modify: `src/lib/game/shidasu/patterns.ts`
- Test: `src/lib/game/shidasu/patterns.test.ts`

- [ ] **Step 1: 失敗するテストを書く**

`src/lib/game/shidasu/patterns.test.ts`の`describe('evaluateChainBonus', ...)`ブロック内(463行目付近)、既存の各テストの直後に以下の7テストを追加する(`describe`ブロックの末尾、`roleBonusMultiplierを渡すと...`テストの後ろに追加する)。

```ts
  test('同スートパーツのcardIdsはチェーン全体(chainIncludingThis)のidを持つ', () => {
    const chainBefore = [card(1, '♠', 5), card(2, '♠', 6)]
    const result = evaluateChainBonus(scoring, chainBefore, card(3, '♠', 7))
    const suitPart = result.parts.find(p => p.label === '同スート')
    expect(suitPart?.cardIds).toEqual([1, 2, 3])
  })

  test('同色パーツのcardIdsはチェーン全体のidを持つ', () => {
    const chainBefore = [card(1, '♠', 5), card(2, '♣', 6)]
    const result = evaluateChainBonus(scoring, chainBefore, card(3, '♠', 7))
    const colorPart = result.parts.find(p => p.label === '同色')
    expect(colorPart?.cardIds).toEqual([1, 2, 3])
  })

  test('階段パーツのcardIdsはチェーン全体のidを持つ', () => {
    const chainBefore = [card(1, '♠', 3), card(2, '♣', 4), card(3, '♦', 5), card(4, '♠', 6)]
    const result = evaluateChainBonus(scoring, chainBefore, card(5, '♣', 7))
    const stairPart = result.parts.find(p => p.label.startsWith('階段'))
    expect(stairPart?.cardIds).toEqual([1, 2, 3, 4, 5])
  })

  test('フラッシュパーツのcardIdsは直近4枚のidを持つ', () => {
    const chainBefore = [card(1, '♦', 3), card(2, '♠', 5), card(3, '♣', 9)]
    const result = evaluateChainBonus(scoring, chainBefore, card(4, '♥', 2))
    const flushPart = result.parts.find(p => p.label === 'フラッシュ')
    expect(flushPart?.cardIds).toEqual([1, 2, 3, 4])
  })

  test('フラッシュが5枚目のチェーンで成立しても直近4枚のみがcardIdsになる', () => {
    const chainBefore = [card(1, '♠', 1), card(2, '♦', 3), card(3, '♠', 5), card(4, '♣', 9)]
    const result = evaluateChainBonus(scoring, chainBefore, card(5, '♥', 2))
    const flushPart = result.parts.find(p => p.label === 'フラッシュ')
    expect(flushPart?.cardIds).toEqual([2, 3, 4, 5])
  })

  test('ロイヤルパーツのcardIdsは直近3枚のidを持つ', () => {
    const chainBefore = [card(1, '♠', 13), card(2, '♥', 11)]
    const result = evaluateChainBonus(scoring, chainBefore, card(3, '♦', 12))
    const royalPart = result.parts.find(p => p.label === 'ロイヤル')
    expect(royalPart?.cardIds).toEqual([1, 2, 3])
  })

  test('同ランクパーツのcardIdsは同ランクの実カード+今回のcardのidを持つ(順不同で比較)', () => {
    const chainBefore = [card(1, '♠', 5), card(2, '♥', 9), card(3, '♦', 5)]
    const result = evaluateChainBonus(scoring, chainBefore, card(4, '♣', 5))
    const sameRankPart = result.parts.find(p => p.label === '同ランク')
    expect(sameRankPart?.cardIds).toEqual(expect.arrayContaining([1, 3, 4]))
    expect(sameRankPart?.cardIds).toHaveLength(3)
  })

  test('同ランクパーツのcardIdsはワイルドを含む場合、ワイルドのidも含める', () => {
    const chainBefore = [card(1, '♠', 5), card(2, '★', 0, true)]
    const result = evaluateChainBonus(scoring, chainBefore, card(3, '♥', 5))
    const sameRankPart = result.parts.find(p => p.label === '同ランク')
    expect(sameRankPart?.cardIds).toEqual(expect.arrayContaining([1, 2, 3]))
    expect(sameRankPart?.cardIds).toHaveLength(3)
  })

  test('コンプリートランパーツのcardIdsはチェーン全体のidを持つ', () => {
    const chainBefore = Array.from({ length: 12 }, (_, i) => card(i + 1, i % 2 === 0 ? '♠' : '♥', (i + 1) as Card['rank']))
    const result = evaluateChainBonus(scoring, chainBefore, card(13, '♦', 13))
    const completeRunPart = result.parts.find(p => p.label === 'コンプリートラン')
    expect(completeRunPart?.cardIds).toHaveLength(13)
    expect(completeRunPart?.cardIds).toContain(13)
  })

  test('コンプリートラン(同スート)パーツのcardIdsもチェーン全体のidを持つ', () => {
    const chainBefore = Array.from({ length: 12 }, (_, i) => card(i + 1, '♠', (i + 1) as Card['rank']))
    const result = evaluateChainBonus(scoring, chainBefore, card(13, '♠', 13))
    const completeRunSuitPart = result.parts.find(p => p.label === 'コンプリートラン(同スート)')
    expect(completeRunSuitPart?.cardIds).toHaveLength(13)
  })
```

- [ ] **Step 2: テストを実行して失敗を確認する**

Run: `npx vitest run src/lib/game/shidasu/patterns.test.ts -t "cardIds"`
Expected: FAIL(すべてのパーツで`cardIds`が`undefined`のため、`toEqual`の期待値と一致しない)

- [ ] **Step 3: evaluateChainBonus内の各パーツ生成箇所に対象カードID算出を実装する**

`src/lib/game/shidasu/patterns.ts`の`evaluateChainBonus`関数を以下のように変更する。

変更前:
```ts
  const { suitHeld, colorHeld } = analyzeSuitColor(chainIncludingThis, items)
  if (chainIncludingThis.length >= suitColorMinLen) {
    if (suitHeld) {
      const suitGain = Math.floor(scoring.suitBonus * oracleLevel('suit'))
      bonus += suitGain
      parts.push(addPart('同スート', suitGain))
      patternFired = true
      patternFiredCount += 1
    } else if (colorHeld) {
      const colorGain = Math.floor(scoring.colorBonus * oracleLevel('color'))
      bonus += colorGain
      parts.push(addPart('同色', colorGain))
      patternFired = true
      patternFiredCount += 1
    }
  }

  const stairInfo = analyzeStair(chainIncludingThis)
  if (stairInfo.held && stairInfo.len >= stairMinLen) {
    const stairGain = Math.floor(scoring.stairBonus * oracleLevel('stair'))
    bonus += stairGain
    parts.push(addPart(`階段${stairInfo.len} `, stairGain))
    patternFired = true
    patternFiredCount += 1
  }

  if (checkFlush(chainIncludingThis)) {
    const flushGain = Math.floor(scoring.flushBonus * oracleLevel('flush') * roleBonusMultiplier('flush'))
    bonus += flushGain
    parts.push(addPart('フラッシュ', flushGain))
    const last4 = chainIncludingThis.slice(-4)
    const realSuits = new Set(last4.filter(c => !c.wild).map(c => c.suit))
    const flushUsedWild = ALL_SUITS_REAL.some(s => !realSuits.has(s))
    roleFired.push({ name: 'flush', usedWild: flushUsedWild, amount: flushGain })
  }

  if (checkRoyalSet(chainIncludingThis)) {
    const royalSetGain = Math.floor(scoring.royalSetBonus * oracleLevel('royalSet') * roleBonusMultiplier('royalSet'))
    bonus += royalSetGain
    parts.push(addPart('ロイヤル', royalSetGain))
    const last3 = chainIncludingThis.slice(-3)
    const realRanks = new Set(last3.filter(c => !c.wild).map(c => c.rank))
    const requiredRanks: Card['rank'][] = [11, 12, 13]
    const royalSetUsedWild = requiredRanks.some(r => !realRanks.has(r))
    roleFired.push({ name: 'royalSet', usedWild: royalSetUsedWild, amount: royalSetGain })
  }

  const sameRankCount = card.wild ? countSameRankForWildPlay(chainBefore) : countSameRankBefore(chainBefore, card.rank)
  if (sameRankCount > 0) {
    const sameRankGain = Math.floor(scoring.sameRankBonusUnit * sameRankCount * oracleLevel('sameRank') * roleBonusMultiplier('sameRank'))
    bonus += sameRankGain
    parts.push(addPart('同ランク', sameRankGain))
    const sameRankUsedWild = card.wild || chainBefore.some(c => c.wild)
    roleFired.push({ name: 'sameRank', usedWild: sameRankUsedWild, amount: sameRankGain })
  }

  if (checkCompleteRun(chainBefore, chainIncludingThis)) {
    const completeRunGain = Math.floor(scoring.completeRunBonus * oracleLevel('completeRun') * roleBonusMultiplier('completeRun'))
    bonus += completeRunGain
    parts.push(addPart('コンプリートラン', completeRunGain))
    const distinctRealNow = new Set(chainIncludingThis.filter(c => !c.wild).map(c => c.rank)).size
    const wildCountNow = chainIncludingThis.filter(c => c.wild).length
    const completeRunUsedWild = distinctRealNow < 13 && wildCountNow > 0
    // completeRunのみ、同スート追加ボーナスの有無を確定させてからroleFiredにpushする
    // (他の役は単一の加点のみだが、completeRunは同スート追加分も合算してamountに含めるため)。
    let completeRunTotalGain = completeRunGain
    if (suitHeld) {
      const completeRunSuitGain = Math.floor(scoring.completeRunSuitBonus * oracleLevel('completeRun') * roleBonusMultiplier('completeRun'))
      bonus += completeRunSuitGain
      parts.push(addPart('コンプリートラン(同スート)', completeRunSuitGain))
      completeRunTotalGain += completeRunSuitGain
    }
    roleFired.push({ name: 'completeRun', usedWild: completeRunUsedWild, amount: completeRunTotalGain })
  }

  return { bonus, parts, patternFired, patternFiredCount, roleFired }
}
```

変更後:
```ts
  const chainIncludingThisIds = chainIncludingThis.map(c => c.id)

  const { suitHeld, colorHeld } = analyzeSuitColor(chainIncludingThis, items)
  if (chainIncludingThis.length >= suitColorMinLen) {
    if (suitHeld) {
      const suitGain = Math.floor(scoring.suitBonus * oracleLevel('suit'))
      bonus += suitGain
      parts.push(addPart('同スート', suitGain, chainIncludingThisIds))
      patternFired = true
      patternFiredCount += 1
    } else if (colorHeld) {
      const colorGain = Math.floor(scoring.colorBonus * oracleLevel('color'))
      bonus += colorGain
      parts.push(addPart('同色', colorGain, chainIncludingThisIds))
      patternFired = true
      patternFiredCount += 1
    }
  }

  const stairInfo = analyzeStair(chainIncludingThis)
  if (stairInfo.held && stairInfo.len >= stairMinLen) {
    const stairGain = Math.floor(scoring.stairBonus * oracleLevel('stair'))
    bonus += stairGain
    parts.push(addPart(`階段${stairInfo.len} `, stairGain, chainIncludingThisIds))
    patternFired = true
    patternFiredCount += 1
  }

  if (checkFlush(chainIncludingThis)) {
    const flushGain = Math.floor(scoring.flushBonus * oracleLevel('flush') * roleBonusMultiplier('flush'))
    bonus += flushGain
    const last4 = chainIncludingThis.slice(-4)
    parts.push(addPart('フラッシュ', flushGain, last4.map(c => c.id)))
    const realSuits = new Set(last4.filter(c => !c.wild).map(c => c.suit))
    const flushUsedWild = ALL_SUITS_REAL.some(s => !realSuits.has(s))
    roleFired.push({ name: 'flush', usedWild: flushUsedWild, amount: flushGain })
  }

  if (checkRoyalSet(chainIncludingThis)) {
    const royalSetGain = Math.floor(scoring.royalSetBonus * oracleLevel('royalSet') * roleBonusMultiplier('royalSet'))
    bonus += royalSetGain
    const last3 = chainIncludingThis.slice(-3)
    parts.push(addPart('ロイヤル', royalSetGain, last3.map(c => c.id)))
    const realRanks = new Set(last3.filter(c => !c.wild).map(c => c.rank))
    const requiredRanks: Card['rank'][] = [11, 12, 13]
    const royalSetUsedWild = requiredRanks.some(r => !realRanks.has(r))
    roleFired.push({ name: 'royalSet', usedWild: royalSetUsedWild, amount: royalSetGain })
  }

  const sameRankCount = card.wild ? countSameRankForWildPlay(chainBefore) : countSameRankBefore(chainBefore, card.rank)
  if (sameRankCount > 0) {
    const sameRankGain = Math.floor(scoring.sameRankBonusUnit * sameRankCount * oracleLevel('sameRank') * roleBonusMultiplier('sameRank'))
    bonus += sameRankGain
    const sameRankCardIds = chainBefore.filter(c => c.wild || c.rank === card.rank).map(c => c.id).concat(card.id)
    parts.push(addPart('同ランク', sameRankGain, sameRankCardIds))
    const sameRankUsedWild = card.wild || chainBefore.some(c => c.wild)
    roleFired.push({ name: 'sameRank', usedWild: sameRankUsedWild, amount: sameRankGain })
  }

  if (checkCompleteRun(chainBefore, chainIncludingThis)) {
    const completeRunGain = Math.floor(scoring.completeRunBonus * oracleLevel('completeRun') * roleBonusMultiplier('completeRun'))
    bonus += completeRunGain
    parts.push(addPart('コンプリートラン', completeRunGain, chainIncludingThisIds))
    const distinctRealNow = new Set(chainIncludingThis.filter(c => !c.wild).map(c => c.rank)).size
    const wildCountNow = chainIncludingThis.filter(c => c.wild).length
    const completeRunUsedWild = distinctRealNow < 13 && wildCountNow > 0
    // completeRunのみ、同スート追加ボーナスの有無を確定させてからroleFiredにpushする
    // (他の役は単一の加点のみだが、completeRunは同スート追加分も合算してamountに含めるため)。
    let completeRunTotalGain = completeRunGain
    if (suitHeld) {
      const completeRunSuitGain = Math.floor(scoring.completeRunSuitBonus * oracleLevel('completeRun') * roleBonusMultiplier('completeRun'))
      bonus += completeRunSuitGain
      parts.push(addPart('コンプリートラン(同スート)', completeRunSuitGain, chainIncludingThisIds))
      completeRunTotalGain += completeRunSuitGain
    }
    roleFired.push({ name: 'completeRun', usedWild: completeRunUsedWild, amount: completeRunTotalGain })
  }

  return { bonus, parts, patternFired, patternFiredCount, roleFired }
}
```

- [ ] **Step 4: テストを実行して成功を確認する**

Run: `npx vitest run src/lib/game/shidasu/patterns.test.ts`
Expected: PASS(全件。既存テストは`.text`または`.parts`全体を比較しているものが多く、`cardIds`追加によって型・値が変わらないため影響を受けない)

- [ ] **Step 5: 全体テストを実行する**

Run: `npx vitest run`
Expected: 全件PASS

Run: `npm run check`
Expected: shidasu関連のエラー0件

- [ ] **Step 6: Commit**

```bash
git add src/lib/game/shidasu/patterns.ts src/lib/game/shidasu/patterns.test.ts
git commit -m "feat: evaluateChainBonusでパターン/役パーツの対象カードIDを算出"
```

---

### Task 3: PlayArea.svelteで対象カードの黄色枠ハイライトを実装する

**Files:**
- Modify: `src/routes/game/shidasu/PlayArea.svelte`

- [ ] **Step 1: PartFlyInStateにcardIdsを追加する**

`src/routes/game/shidasu/PlayArea.svelte`の`PartFlyInState`インターフェース(112行目付近)を以下のように変更する。

変更前:
```ts
  interface PartFlyInState {
    text: string
    phase: 'center' | 'toRow'
    left: number
    top: number
    scale: number
    transitionMs: number
  }
```

変更後:
```ts
  interface PartFlyInState {
    text: string
    cardIds: number[]
    phase: 'center' | 'toRow'
    left: number
    top: number
    scale: number
    transitionMs: number
  }
```

- [ ] **Step 2: startPartFlyInでcardIdsをpartFlyInに含める**

`src/routes/game/shidasu/PlayArea.svelte`の`startPartFlyIn`関数内、`partFlyIn = {`の代入部分(655行目付近)を以下のように変更する。

変更前:
```ts
    const hintRect = noPlayableHintEl.getBoundingClientRect()
    partFlyIn = {
      text: part.text,
      phase: 'center',
      left: hintRect.left + hintRect.width / 2,
      top: hintRect.top + hintRect.height / 2,
      scale: PART_FLYIN_SCALE,
      transitionMs: 0,
    }
```

変更後:
```ts
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

`toRow`フェーズへの遷移箇所(`partFlyIn = { ...partFlyIn, phase: 'toRow', ... }`)はスプレッド構文で`cardIds`を引き継ぐため変更不要。

- [ ] **Step 3: highlightedCardIds派生値を追加する**

`src/routes/game/shidasu/PlayArea.svelte`122行目、`let partFlyIn = $state<PartFlyInState | null>(null)`の直後に以下を追加する。

変更前:
```ts
  let scoreReveal = $state<ScoreRevealState | null>(null)
  let partFlyIn = $state<PartFlyInState | null>(null)
  let displayedScore = $state(wave.score)
```

変更後:
```ts
  let scoreReveal = $state<ScoreRevealState | null>(null)
  let partFlyIn = $state<PartFlyInState | null>(null)
  let highlightedCardIds = $derived(new Set(partFlyIn?.cardIds ?? []))
  let displayedScore = $state(wave.score)
```

- [ ] **Step 4: チェーン表示ループでハイライトクラスを適用する**

`src/routes/game/shidasu/PlayArea.svelte`のチェーン表示ループ(969〜980行目付近)を以下のように変更する。

変更前:
```svelte
      {#each chainRows as row, ri (ri)}
        <div class="relative" style="height:116px; width:{64 + (row.length - 1) * params.ui.chainCardOffsetX}px;">
          {#each row as entry, j (entry.card.id)}
            <div
              class="absolute"
              data-chain-card-id={entry.card.id}
              style="left:{j * params.ui.chainCardOffsetX}px; top:{entry.origin === 'draw' ? 20 : 0}px; z-index:{j + 1}; width:64px;"
            >
              <CardFace card={entry.card} covered={false} {items} />
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
              class="absolute rounded-lg {highlightedCardIds.has(entry.card.id) ? 'ring-4 ring-yellow-400' : ''}"
              data-chain-card-id={entry.card.id}
              style="left:{j * params.ui.chainCardOffsetX}px; top:{entry.origin === 'draw' ? 20 : 0}px; z-index:{j + 1}; width:64px;"
            >
              <CardFace card={entry.card} covered={false} {items} />
            </div>
          {/each}
        </div>
      {/each}
```

`ring-4 ring-yellow-400`はTailwind CSSのユーティリティクラスで、要素の周囲に4px幅の黄色い枠線(box-shadow相当)を描画する。`rounded-lg`はCardFace自体が既に角丸(`rounded-lg`)のため、枠線も角丸に合わせて追加する。

- [ ] **Step 5: 型チェック・ビルドを実行する**

Run: `npm run check`
Expected: shidasu関連のエラー0件

Run: `npm run build`
Expected: ビルド成功

- [ ] **Step 6: 開発サーバーでブラウザ確認する**

Run: `npm run dev`

確認項目:
- `/game/shidasu`で実際にプレイし、同スート・同色・階段・フラッシュ・ロイヤル・同ランク・コンプリートランのいずれかが成立するプレイを行う
- 得点内訳アニメーションのフェーズ1で、該当パーツが中央表示されている間、対象カードに黄色い枠が表示されることを確認する
- 次のパーツに切り替わったタイミングで、前のパーツの枠が消え、新しいパーツの対象カード(基礎点や護符効果パーツの場合は枠なし)に切り替わることを確認する
- 基礎点のみのプレイ(パーツ1件)では、順番表示自体がスキップされるため、枠が一瞬も表示されないことを確認する

- [ ] **Step 7: Commit**

```bash
git add src/routes/game/shidasu/PlayArea.svelte
git commit -m "feat: 得点内訳パーツ表示中に対象カードを黄色枠でハイライト"
```

---

### Task 4: 統合確認

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

- [ ] **Step 4: 開発サーバーで複数パターンを目視確認する**

Run: `npm run dev`

確認項目:
- 複数の役・パターンが同一プレイで同時成立するケース(例: 同スート+フラッシュが両方成立)で、各パーツの表示順に合わせてハイライト対象が正しく切り替わること
- ワイルドカードが絡む役(同ランク・階段の橋渡しなど)でも、ワイルドカード自体に枠が表示されること
- `/admin/shidasu-debug`から任意の状況を作り、コンプリートラン等の長いチェーンでもハイライトが正しく機能すること
