# 全消しボーナスのgained計算統合 Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** 全消しボーナスを、独立した別枠(`lastBonusGains`)ではなく、そのプレイの通常の獲得点計算(`gained`)の内訳の一部として統合し、コンボ倍率・献身・勤勉・加護・星霜・残響・慢心などの乗算系護符の恩恵を受けられるようにする。

**Architecture:** `playCard`内で全消し判定(場札が0枚になったか)は既にgained計算より前に確定しているため、全消し成立時のみ`clearBonus`チャンネル(忍耐・浄化・節制の護符)の計算結果を、果断・流星の永続加算値と同じ位置(乗算チェーンの直前)に合流させる。これにより`lastBonusGains`(`BonusGain`型)が全消し以外の全ての箇所で既に空配列であることを踏まえ、統合完了後にこの型・フィールドを完全に削除する。

**Tech Stack:** TypeScript, SvelteKit, Vitest

---

### Task 1: gained計算への全消しボーナス統合

**Files:**
- Modify: `src/lib/game/shidasu/engine.ts`
- Modify: `src/lib/game/shidasu/engine.test.ts`

- [ ] **Step 1: 失敗するテストを書く**

`src/lib/game/shidasu/engine.test.ts`内、以下の既存テストを探す:

```ts
  test('場札が0枚になったら全消しボーナス(clearBonus+残り山札×clearBonusPerStock)が加算されendReason=fullClear', () => {
    const wave = baseWave({
      tableau: [[card(1, '♣', 6)]],
      stock: [card(9, '♠', 1), card(10, '♠', 2)],
      comboStreakColumnLengths: [DEFAULT_PARAMS.layout.rows],
    })
    const { wave: next } = playCard(DEFAULT_PARAMS, wave, 'none', [], 100000000, 0, standardDeckComposition())
    expect(next.tableau.reduce((n, c) => n + c.length, 0)).toBe(0)
    expect(next.status).toBe('ended')
    expect(next.endReason).toBe('fullClear')
    const expectedClearBonus = scoring.clearBonus + 2 * scoring.clearBonusPerStock
    expect(next.score).toBe(Math.floor((scoring.basePoint + scoring.columnSweepBonus * 1) * 1.1) + expectedClearBonus)
  })
```

以下に置き換える(全消しボーナスにもコンボ倍率がかかる新仕様に合わせて期待値を変更):

```ts
  test('場札が0枚になったら全消しボーナス(clearBonus+残り山札×clearBonusPerStock)がgained計算に統合され、コンボ倍率もかかった上でendReason=fullClear', () => {
    const wave = baseWave({
      tableau: [[card(1, '♣', 6)]],
      stock: [card(9, '♠', 1), card(10, '♠', 2)],
      comboStreakColumnLengths: [DEFAULT_PARAMS.layout.rows],
    })
    const { wave: next } = playCard(DEFAULT_PARAMS, wave, 'none', [], 100000000, 0, standardDeckComposition())
    expect(next.tableau.reduce((n, c) => n + c.length, 0)).toBe(0)
    expect(next.status).toBe('ended')
    expect(next.endReason).toBe('fullClear')
    const expectedClearBonus = scoring.clearBonus + 2 * scoring.clearBonusPerStock
    const expectedScore = Math.floor((scoring.basePoint + scoring.columnSweepBonus * 1 + expectedClearBonus) * 1.1)
    expect(next.score).toBe(expectedScore)
  })
```

続けて、以下の既存テストを探す:

```ts
  test('全消し時、lastBonusGainsに全消しボーナスが別枠で入る(lastGainはプレイ得点のみ)', () => {
    const wave = baseWave({
      tableau: [[card(1, '♣', 6)]],
      stock: [card(9, '♠', 1), card(10, '♠', 2)],
      comboStreakColumnLengths: [DEFAULT_PARAMS.layout.rows],
    })
    const { wave: next } = playCard(DEFAULT_PARAMS, wave, 'none', [], 100000000, 0, standardDeckComposition())
    const expectedClearBonus = scoring.clearBonus + 2 * scoring.clearBonusPerStock
    const expectedPlayGain = Math.floor((scoring.basePoint + scoring.columnSweepBonus * 1) * 1.1)
    expect(next.lastGain?.points).toBe(expectedPlayGain)
    expect(next.lastGain?.parts.map(p => p.text)).not.toContain(`全消しボーナス+${expectedClearBonus}`)
    expect(next.lastBonusGains).toHaveLength(1)
    expect(next.lastBonusGains[0].label).toBe('全消しボーナス')
    expect(next.lastBonusGains[0].points).toBe(expectedClearBonus)
    expect(next.lastBonusGains[0].parts.map(p => p.text)).toContain(`基礎+${scoring.clearBonus}`)
    expect(next.lastBonusGains[0].parts.map(p => p.text)).toContain(`山札残数+${2 * scoring.clearBonusPerStock}`)
    expect(next.score).toBe(expectedPlayGain + expectedClearBonus)
  })
```

以下に置き換える(`lastBonusGains`という別枠ではなく`lastGain`に統合される新仕様の検証。`lastBonusGains`自体はTask 2で型ごと削除するため、このテストではまだ参照しない):

```ts
  test('全消し時、全消しボーナスがlastGain.partsに統合され、コンボ倍率込みの1つの獲得点として扱われる', () => {
    const wave = baseWave({
      tableau: [[card(1, '♣', 6)]],
      stock: [card(9, '♠', 1), card(10, '♠', 2)],
      comboStreakColumnLengths: [DEFAULT_PARAMS.layout.rows],
    })
    const { wave: next } = playCard(DEFAULT_PARAMS, wave, 'none', [], 100000000, 0, standardDeckComposition())
    const expectedClearBonus = scoring.clearBonus + 2 * scoring.clearBonusPerStock
    const expectedScore = Math.floor((scoring.basePoint + scoring.columnSweepBonus * 1 + expectedClearBonus) * 1.1)
    expect(next.lastGain?.points).toBe(expectedScore)
    expect(next.lastGain?.parts.map(p => p.text)).toContain(`全消し基礎+${scoring.clearBonus}`)
    expect(next.lastGain?.parts.map(p => p.text)).toContain(`全消し山札残数+${2 * scoring.clearBonusPerStock}`)
    expect(next.score).toBe(expectedScore)
  })
```

続けて、以下の既存テストを探す:

```ts
  test('clearBonusチャンネルの護符(purify)は全消し時のみclearBonusに加算される', () => {
    const wave = baseWave({
      tableau: [[card(1, '♣', 6)]],
      stock: [card(9, '♠', 1), card(10, '♠', 2)],
      comboStreakColumnLengths: [DEFAULT_PARAMS.layout.rows],
    })
    const { wave: next } = playCard(DEFAULT_PARAMS, wave, 'none', ['purify'], 100000000, 0, standardDeckComposition())
    expect(next.endReason).toBe('fullClear')
    const expectedClearBonus = scoring.clearBonus + 2 * scoring.clearBonusPerStock + DEFAULT_PARAMS.talismans.purify.n
    expect(next.score).toBe(Math.floor((scoring.basePoint + scoring.columnSweepBonus * 1) * 1.1) + expectedClearBonus)
  })
```

以下に置き換える:

```ts
  test('clearBonusチャンネルの護符(purify)は全消し時のみgained計算内の全消しボーナスに加算され、コンボ倍率もかかる', () => {
    const wave = baseWave({
      tableau: [[card(1, '♣', 6)]],
      stock: [card(9, '♠', 1), card(10, '♠', 2)],
      comboStreakColumnLengths: [DEFAULT_PARAMS.layout.rows],
    })
    const { wave: next } = playCard(DEFAULT_PARAMS, wave, 'none', ['purify'], 100000000, 0, standardDeckComposition())
    expect(next.endReason).toBe('fullClear')
    const expectedClearBonus = scoring.clearBonus + 2 * scoring.clearBonusPerStock + DEFAULT_PARAMS.talismans.purify.n
    const expectedScore = Math.floor((scoring.basePoint + scoring.columnSweepBonus * 1 + expectedClearBonus) * 1.1)
    expect(next.score).toBe(expectedScore)
  })
```

続けて、上記のテストの直後に以下の新規テストを2つ追加する:

```ts
  test('全消しボーナスにもコンボ倍率がかかる(基礎点等と同じ乗算チェーンの内側にある)', () => {
    const wave = baseWave({
      foundation: card(0, '♠', 5),
      combo: 4, // このプレイでnewCombo=5、effectiveCombo=5、コンボ倍率=1+5*0.1=1.5
      tableau: [[card(1, '♣', 6)]],
      stock: [card(9, '♠', 1)],
      comboStreakColumnLengths: [DEFAULT_PARAMS.layout.rows],
    })
    const { wave: next } = playCard(DEFAULT_PARAMS, wave, 'none', [], 100000000, 0, standardDeckComposition())
    expect(next.endReason).toBe('fullClear')
    const expectedClearBonus = scoring.clearBonus + 1 * scoring.clearBonusPerStock
    const multiplier = 1 + 5 * scoring.comboMultiplierStep
    const expectedScore = Math.floor((scoring.basePoint + scoring.columnSweepBonus * 1 + expectedClearBonus) * multiplier)
    expect(next.score).toBe(expectedScore)
  })

  test('ボス得点ロック成立時、全消しボーナスも含めてgainedが0になる', () => {
    const wave = baseWave({
      foundation: card(0, '♠', 5),
      combo: 1, // このプレイでnewCombo=2、effectiveCombo=2
      tableau: [[card(1, '♣', 6)]],
      stock: [card(9, '♠', 1)],
      comboStreakColumnLengths: [DEFAULT_PARAMS.layout.rows],
    })
    const { wave: next } = playCard(DEFAULT_PARAMS, wave, 'none', [], 100000000, 0, standardDeckComposition(), Math.random, { kind: 'combo', maxCombo: 2, tierLabel: 'test-tier' })
    expect(next.endReason).toBe('fullClear')
    expect(next.lastGain?.points).toBe(0)
    expect(next.score).toBe(wave.score)
  })
```

- [ ] **Step 2: テストを実行して失敗することを確認する**

Run: `npx vitest run src/lib/game/shidasu/engine.test.ts -t "全消し"`

Expected: FAIL(旧実装のまま、全消しボーナスがコンボ倍率を受けずlastBonusGains経由で加算されている)

- [ ] **Step 3: `playCard`のgained計算に全消しボーナスを統合する**

`src/lib/game/shidasu/engine.ts`内、以下の既存コード(`playCard`関数内)を探す:

```ts
  const itemResult = applyItemEffects('gained', base, items, itemEffectCtx, params)
  parts.push(...itemResult.parts)

  const discretionAdd = items.includes('discretion') ? wave.discretionN : 0
  if (discretionAdd !== 0) parts.push(addPart('果断', discretionAdd))
  const shootingStarGainedAdd = items.includes('shootingStar') ? wave.shootingStarN : 0
  if (shootingStarGainedAdd !== 0) parts.push(addPart('流星', shootingStarGainedAdd))
  const comboMultiplierStep = params.scoring.comboMultiplierStep
  const multiplier = 1 + effectiveCombo * comboMultiplierStep
  if (multiplier !== 1) parts.push(multiplyPart('コンボ倍率', multiplier))
  const mannazFactor = wave.mannazActiveThisWave ? 1 + mannazWeightSum(items, params) * params.rites.mannaz.x : 1
  if (mannazFactor !== 1) parts.push(multiplyPart('マンナズ', mannazFactor))
  const dedicationFactor = items.includes('dedication') ? wave.dedicationX : 1
  if (dedicationFactor !== 1) parts.push(multiplyPart('献身', dedicationFactor))
  const diligenceFactor = items.includes('diligence') ? wave.diligenceX : 1
  if (diligenceFactor !== 1) parts.push(multiplyPart('勤勉', diligenceFactor))
  const divineProtectionFactor = items.includes('divineProtection') ? wave.divineProtectionX : 1
  if (divineProtectionFactor !== 1) parts.push(multiplyPart('加護', divineProtectionFactor))
  const frostFactor = items.includes('frost') ? wave.frostX : 1
  if (frostFactor !== 1) parts.push(multiplyPart('星霜', frostFactor))
  const echoFactor = items.includes('echo') ? wave.echoX : 1
  if (echoFactor !== 1) parts.push(multiplyPart('残響', echoFactor))
  const arroganceFactor = items.includes('arrogance') && wave.stock.length === 0 ? params.talismans.arrogance.x : 1
  if (arroganceFactor !== 1) parts.push(multiplyPart('慢心', arroganceFactor))
  let gained = Math.floor((itemResult.value + discretionAdd + shootingStarGainedAdd) * multiplier * mannazFactor * dedicationFactor * diligenceFactor * divineProtectionFactor * frostFactor * echoFactor * arroganceFactor)
  if (scoreLock && isBossScoreLocked(scoreLock, effectiveCombo, card)) {
    parts.length = 0
    parts.push(lockPart(bossScoreLockMessage(scoreLock)))
    gained = 0
  }
```

以下に置き換える:

```ts
  const itemResult = applyItemEffects('gained', base, items, itemEffectCtx, params)
  parts.push(...itemResult.parts)

  const discretionAdd = items.includes('discretion') ? wave.discretionN : 0
  if (discretionAdd !== 0) parts.push(addPart('果断', discretionAdd))
  const shootingStarGainedAdd = items.includes('shootingStar') ? wave.shootingStarN : 0
  if (shootingStarGainedAdd !== 0) parts.push(addPart('流星', shootingStarGainedAdd))
  // 全消しボーナス: 場札が0枚になった場合のみ、基礎値にclearBonusチャンネルの護符効果
  // (忍耐・浄化・節制)を適用した上で、通常のgained計算に加算項として合流させる。
  // 加算項は乗算項より前にpushすること(runningTotalsFromScorePartsの逐次計算と整合させるため)。
  const isFullClear = remainingBeforeRevival === 0
  let clearBonusAdd = 0
  if (isFullClear) {
    const rawClearBonus = params.scoring.clearBonus + wave.stock.length * params.scoring.clearBonusPerStock
    const clearBonusResult = applyItemEffects('clearBonus', rawClearBonus, items, itemEffectCtx, params)
    clearBonusAdd = Math.floor(clearBonusResult.value)
    parts.push(addPart('全消し基礎', params.scoring.clearBonus))
    parts.push(addPart('全消し山札残数', wave.stock.length * params.scoring.clearBonusPerStock))
    parts.push(...clearBonusResult.parts)
  }
  const comboMultiplierStep = params.scoring.comboMultiplierStep
  const multiplier = 1 + effectiveCombo * comboMultiplierStep
  if (multiplier !== 1) parts.push(multiplyPart('コンボ倍率', multiplier))
  const mannazFactor = wave.mannazActiveThisWave ? 1 + mannazWeightSum(items, params) * params.rites.mannaz.x : 1
  if (mannazFactor !== 1) parts.push(multiplyPart('マンナズ', mannazFactor))
  const dedicationFactor = items.includes('dedication') ? wave.dedicationX : 1
  if (dedicationFactor !== 1) parts.push(multiplyPart('献身', dedicationFactor))
  const diligenceFactor = items.includes('diligence') ? wave.diligenceX : 1
  if (diligenceFactor !== 1) parts.push(multiplyPart('勤勉', diligenceFactor))
  const divineProtectionFactor = items.includes('divineProtection') ? wave.divineProtectionX : 1
  if (divineProtectionFactor !== 1) parts.push(multiplyPart('加護', divineProtectionFactor))
  const frostFactor = items.includes('frost') ? wave.frostX : 1
  if (frostFactor !== 1) parts.push(multiplyPart('星霜', frostFactor))
  const echoFactor = items.includes('echo') ? wave.echoX : 1
  if (echoFactor !== 1) parts.push(multiplyPart('残響', echoFactor))
  const arroganceFactor = items.includes('arrogance') && wave.stock.length === 0 ? params.talismans.arrogance.x : 1
  if (arroganceFactor !== 1) parts.push(multiplyPart('慢心', arroganceFactor))
  let gained = Math.floor((itemResult.value + discretionAdd + shootingStarGainedAdd + clearBonusAdd) * multiplier * mannazFactor * dedicationFactor * diligenceFactor * divineProtectionFactor * frostFactor * echoFactor * arroganceFactor)
  if (scoreLock && isBossScoreLocked(scoreLock, effectiveCombo, card)) {
    parts.length = 0
    parts.push(lockPart(bossScoreLockMessage(scoreLock)))
    gained = 0
  }
```

- [ ] **Step 4: 全消し後処理フローを簡素化する**

`src/lib/game/shidasu/engine.ts`内、以下の既存コード(`playCard`関数内、gained確定後の後処理)を探す:

```ts
  // gained確定時点で目標達成なら、全消し判定を行わず即座に終了する。
  if (targetReachedOnGained) {
    return { wave: { ...next, status: 'ended', endReason: 'target' }, deckComposition }
  }

  if (remainingBeforeRevival === 0) {
    const rawClearBonus = params.scoring.clearBonus + wave.stock.length * params.scoring.clearBonusPerStock
    const clearBonusResult = applyItemEffects('clearBonus', rawClearBonus, items, itemEffectCtx, params)
    const clearBonus = Math.floor(clearBonusResult.value)
    const scoreAfterClear = newScore + clearBonus
    const clearBonusGain: BonusGain = {
      label: '全消しボーナス',
      points: clearBonus,
      parts: [
        addPart('基礎', params.scoring.clearBonus),
        addPart('山札残数', wave.stock.length * params.scoring.clearBonusPerStock),
        ...clearBonusResult.parts,
      ],
    }
    const bonusGainsWithClear = [...bonusGains, clearBonusGain]
    const waveAfterClearBonus: WaveState = { ...next, score: scoreAfterClear, lastBonusGains: bonusGainsWithClear }

    if (scoreAfterClear >= target) {
      return { wave: { ...waveAfterClearBonus, status: 'ended', endReason: 'target' }, deckComposition }
    }

    let resetWave = resetComboFields(waveAfterClearBonus, params)

    for (const id of items) {
      if (id === 'healing') {
        resetWave = resolveHealingRestoration(resetWave, waveAfterClearBonus.sweptColumnsThisCombo, rand)
      } else if (
        id === 'regeneration' &&
        remainingCount(resetWave.tableau) === 0 &&
        !resetWave.regenerationUsedThisWave &&
        resetWave.stock.length > 0
      ) {
        const cost = Math.floor(resetWave.score * params.talismans.regeneration.p / 100)
        const pool = [...resetWave.discardPile]
        shuffleInPlace(pool, rand)
        const reviveTotal = Math.min(params.layout.cols * rows, pool.length)
        let cursor = 0
        const revivedTableau: Card[][] = []
        for (let c = 0; c < params.layout.cols; c++) {
          const take = Math.min(rows, reviveTotal - cursor)
          revivedTableau.push(take > 0 ? pool.slice(cursor, cursor + take) : [])
          cursor += Math.max(take, 0)
        }
        resetWave = {
          ...resetWave,
          tableau: revivedTableau,
          discardPile: pool.slice(reviveTotal),
          comboStreakColumnLengths: revivedTableau.map(col => col.length),
          score: resetWave.score - cost,
          regenerationUsedThisWave: true,
        }
      }
    }

    if (remainingCount(resetWave.tableau) > 0) {
      if (resetWave.stock.length > 0) {
        return drawStock(params, resetWave, items, target, deckComposition, modifier, rand)
      }
      return { wave: resetWave, deckComposition }
    }

    return { wave: { ...resetWave, status: 'ended', endReason: 'fullClear' }, deckComposition }
  }

  if (newScore >= target) {
    return { wave: { ...next, status: 'ended', endReason: 'target' }, deckComposition }
  }

  return { wave: next, deckComposition }
}
```

以下に置き換える(全消しボーナスは既にgained計算に統合済みのため、clearBonus加算・二段階target判定・中間オブジェクト構築を削除し、`isFullClear`フラグで後処理のみ分岐する):

```ts
  // gained確定時点(全消しボーナス込み)で目標達成なら即座に終了する。
  if (targetReachedOnGained) {
    return { wave: { ...next, status: 'ended', endReason: 'target' }, deckComposition }
  }

  if (isFullClear) {
    let resetWave = resetComboFields(next, params)

    for (const id of items) {
      if (id === 'healing') {
        resetWave = resolveHealingRestoration(resetWave, next.sweptColumnsThisCombo, rand)
      } else if (
        id === 'regeneration' &&
        remainingCount(resetWave.tableau) === 0 &&
        !resetWave.regenerationUsedThisWave &&
        resetWave.stock.length > 0
      ) {
        const cost = Math.floor(resetWave.score * params.talismans.regeneration.p / 100)
        const pool = [...resetWave.discardPile]
        shuffleInPlace(pool, rand)
        const reviveTotal = Math.min(params.layout.cols * rows, pool.length)
        let cursor = 0
        const revivedTableau: Card[][] = []
        for (let c = 0; c < params.layout.cols; c++) {
          const take = Math.min(rows, reviveTotal - cursor)
          revivedTableau.push(take > 0 ? pool.slice(cursor, cursor + take) : [])
          cursor += Math.max(take, 0)
        }
        resetWave = {
          ...resetWave,
          tableau: revivedTableau,
          discardPile: pool.slice(reviveTotal),
          comboStreakColumnLengths: revivedTableau.map(col => col.length),
          score: resetWave.score - cost,
          regenerationUsedThisWave: true,
        }
      }
    }

    if (remainingCount(resetWave.tableau) > 0) {
      if (resetWave.stock.length > 0) {
        return drawStock(params, resetWave, items, target, deckComposition, modifier, rand)
      }
      return { wave: resetWave, deckComposition }
    }

    return { wave: { ...resetWave, status: 'ended', endReason: 'fullClear' }, deckComposition }
  }

  if (newScore >= target) {
    return { wave: { ...next, status: 'ended', endReason: 'target' }, deckComposition }
  }

  return { wave: next, deckComposition }
}
```

- [ ] **Step 5: テストを実行してパスすることを確認する**

Run: `npx vitest run src/lib/game/shidasu/engine.test.ts -t "全消し"`

Expected: PASS

- [ ] **Step 6: 全体テストスイートを実行し、他のテストを壊していないか確認する**

Run: `npx vitest run src/lib/game/shidasu/engine.test.ts`

Expected: 型エラーが出ていれば、`bonusGains`変数がまだ`lastBonusGains: bonusGains`として`next`構築部分に残っているため型は壊れていないはず(Task 2で削除)。全消し関連以外のテストは全てPASS。全消し関連で新たに崩れたテストがあれば、コンボ倍率が全消しボーナスにもかかるようになった影響として、期待値を本タスクの方針に沿って更新する。

- [ ] **Step 7: コミット**

```bash
git add src/lib/game/shidasu/engine.ts src/lib/game/shidasu/engine.test.ts
git commit -m "feat: 全消しボーナスをgained計算に統合しコンボ倍率等の恩恵を受けるようにする"
```

---

### Task 2: `lastBonusGains`(`BonusGain`型)の完全削除

**Files:**
- Modify: `src/lib/game/shidasu/types.ts`
- Modify: `src/lib/game/shidasu/engine.ts`
- Modify: `src/lib/game/shidasu/engine.test.ts`
- Modify: `src/lib/game/shidasu/revelationEffects.test.ts`
- Modify: `src/lib/game/shidasu/riteEffects.test.ts`
- Modify: `src/routes/game/shidasu/+page.svelte`
- Modify: `src/routes/game/shidasu/PlayArea.svelte`
- Modify: `src/routes/game/shidasu/DebugPanel.svelte`
- Modify: `src/routes/admin/shidasu-debug/+page.svelte`

Task 1完了時点で、`lastBonusGains`は`WaveState`の全ての構築箇所で以下のいずれかになっている: (a) 全消し以外の箇所では常に空配列、(b) 全消し箇所では`bonusGains`(Task 1で追加した全消しボーナスはgainedに統合済みのため、この変数自体は空配列のまま残っている)。つまりTask 1完了時点で`lastBonusGains`に実質的な値が入ることは無くなっている。本タスクでは、この不要になった型・フィールド・UI参照を一式削除する。

- [ ] **Step 1: `types.ts`から`BonusGain`型・関連フィールドを削除する**

`src/lib/game/shidasu/types.ts`内、以下の既存コードを探す:

```ts
// 全消しボーナス・護符による直接加算など、通常のプレイ得点(ScoreGain/lastGain)とは
// 別枠でログ表示する得点イベント。labelでイベント種別を表す。
export interface BonusGain {
  label: string
  points: number
  parts: ScorePart[]
}

// PlayArea.svelteのonPlayCardが、プレイ結果(得点内訳アニメーションに必要な情報)を
// 呼び出し元へ同期的に返すための型。applyPlayCardが常に同期関数であることを前提にしている。
export interface PlayCardResult {
  lastGain: ScoreGain | null
  lastBonusGains: BonusGain[]
}
```

以下に置き換える:

```ts
// PlayArea.svelteのonPlayCardが、プレイ結果(得点内訳アニメーションに必要な情報)を
// 呼び出し元へ同期的に返すための型。applyPlayCardが常に同期関数であることを前提にしている。
export interface PlayCardResult {
  lastGain: ScoreGain | null
}
```

同ファイル内、`WaveState`インターフェース内の以下の既存コードを探す:

```ts
  lastGain: ScoreGain | null
  // このアクションで発生した、lastGainとは別枠の得点(全消しボーナス・護符の直接加算)。
  // 何も発生しなければ空配列。
  lastBonusGains: BonusGain[]
```

以下に置き換える:

```ts
  lastGain: ScoreGain | null
```

- [ ] **Step 2: `engine.ts`から`bonusGains`関連コードを削除する**

`src/lib/game/shidasu/engine.ts`内、`playCard`関数内の以下の既存コードを探す:

```ts
  const bonusGains: BonusGain[] = []

  const next: WaveState = {
```

以下に置き換える(`bonusGains`の宣言行を削除):

```ts
  const next: WaveState = {
```

同関数内、`next`オブジェクト構築部分にある以下の既存コードを探す:

```ts
    lastBonusGains: bonusGains,
    sweptColumnsThisCombo: newSweptColumnsThisCombo,
```

以下に置き換える(`lastBonusGains`行を削除):

```ts
    sweptColumnsThisCombo: newSweptColumnsThisCombo,
```

`drawStock`関数内、以下の既存コードを探す:

```ts
    const patternContinueBonusGains: BonusGain[] = []
```

この行を削除する。

同関数内、`continueWave`オブジェクト構築部分にある以下の既存コードを探す:

```ts
      flushActiveThisCombo: naiveFlushActiveThisCombo,
      lastBonusGains: patternContinueBonusGains,
    }
```

以下に置き換える:

```ts
      flushActiveThisCombo: naiveFlushActiveThisCombo,
    }
```

`drawStock`関数内、以下の既存コードを探す:

```ts
  const resetBonusGains: BonusGain[] = []

  let resetWave: WaveState = {
```

以下に置き換える(`resetBonusGains`の宣言行を削除):

```ts
  let resetWave: WaveState = {
```

同関数内、`resetWave`オブジェクト構築部分にある以下の既存コードを探す:

```ts
    lastGain: null,
    score: scoreAfterStockEmpty,
    lastBonusGains: resetBonusGains,
    baseComboCount: wave.baseComboCount + composureAdd + clarityAdd,
```

以下に置き換える:

```ts
    lastGain: null,
    score: scoreAfterStockEmpty,
    baseComboCount: wave.baseComboCount + composureAdd + clarityAdd,
```

型チェックを実行し(`npm run check`)、`BonusGain`という識別子がまだ`engine.ts`内でimportされている、または他に参照されていないか確認する(既に全ての使用箇所を削除済みのはずだが、import文に`BonusGain`が残っていれば削除する)。

- [ ] **Step 3: テストファイル内の`lastBonusGains: []`初期化を削除する**

`src/lib/game/shidasu/engine.test.ts`内、`makeWave`ヘルパー関数(または`baseWave`が内部で使う共通ヘルパー)の中にある以下の既存コードを探す:

```ts
    lastBonusGains: [],
```

この行を削除する。

`src/lib/game/shidasu/revelationEffects.test.ts`内、同様の以下の既存コードを探す:

```ts
    lastBonusGains: [],
```

この行を削除する。

`src/lib/game/shidasu/riteEffects.test.ts`内、同様の以下の既存コードを探す:

```ts
    lastBonusGains: [],
```

この行を削除する。

- [ ] **Step 4: `+page.svelte`の`handlePlayCard`を修正する**

`src/routes/game/shidasu/+page.svelte`内、以下の既存コードを探す:

```ts
  function handlePlayCard(colIndex: number, rowIndex: number): PlayCardResult | void {
    if (run.phase !== 'playing' || run.wave?.status !== 'playing') return
    run = applyPlayCard(params, run, colIndex, undefined, rowIndex)
    return { lastGain: run.wave?.lastGain ?? null, lastBonusGains: run.wave?.lastBonusGains ?? [] }
  }
```

以下に置き換える:

```ts
  function handlePlayCard(colIndex: number, rowIndex: number): PlayCardResult | void {
    if (run.phase !== 'playing' || run.wave?.status !== 'playing') return
    run = applyPlayCard(params, run, colIndex, undefined, rowIndex)
    return { lastGain: run.wave?.lastGain ?? null }
  }
```

- [ ] **Step 5: `PlayArea.svelte`の`startScoreReveal`とその呼び出し箇所を修正する**

`src/routes/game/shidasu/PlayArea.svelte`の先頭付近、以下の既存importを探す:

```ts
  import type { WaveState, StageModifier, ItemId, RiteId, RevelationId, Card, PlayCardResult, ScoreGain, BonusGain } from '$lib/game/shidasu/types'
```

以下に置き換える(`BonusGain`を削除):

```ts
  import type { WaveState, StageModifier, ItemId, RiteId, RevelationId, Card, PlayCardResult, ScoreGain } from '$lib/game/shidasu/types'
```

同ファイル内、以下の既存コードを探す:

```ts
  function startScoreReveal(lastGain: ScoreGain | null, lastBonusGains: BonusGain[]) {
    const allParts = [...(lastGain?.parts ?? []), ...lastBonusGains.flatMap(g => g.parts)]
    if (allParts.length === 0) {
      displayedScore = wave.score
      onScoreRevealDone?.()
      if (wave.status === 'ended' && wave.endReason === 'target') startCleanupAnimation()
      return
    }
    const runningTotals = runningTotalsFromScoreParts(allParts)
    const totalGain = (lastGain?.points ?? 0) + lastBonusGains.reduce((sum, g) => sum + g.points, 0)
    clearTimeout(scoreRevealTimer)
```

以下に置き換える:

```ts
  function startScoreReveal(lastGain: ScoreGain | null) {
    const allParts = lastGain?.parts ?? []
    if (allParts.length === 0) {
      displayedScore = wave.score
      onScoreRevealDone?.()
      if (wave.status === 'ended' && wave.endReason === 'target') startCleanupAnimation()
      return
    }
    const runningTotals = runningTotalsFromScoreParts(allParts)
    const totalGain = lastGain?.points ?? 0
    clearTimeout(scoreRevealTimer)
```

同ファイル内、以下の既存コードを探す:

```ts
      const result = onPlayCard(colIndex, rowIndex)
      if (result) startScoreReveal(result.lastGain, result.lastBonusGains)
```

以下に置き換える:

```ts
      const result = onPlayCard(colIndex, rowIndex)
      if (result) startScoreReveal(result.lastGain)
```

同ファイル内、以下の既存コードを探す:

```svelte
  {:else if wave.lastGain || wave.lastBonusGains.length > 0}
    {@const totalPoints = (wave.lastGain?.points ?? 0) + wave.lastBonusGains.reduce((sum, g) => sum + g.points, 0)}
    {@const allParts = [...(wave.lastGain?.parts ?? []), ...wave.lastBonusGains.flatMap(g => g.parts)]}
```

以下に置き換える:

```svelte
  {:else if wave.lastGain}
    {@const totalPoints = wave.lastGain?.points ?? 0}
    {@const allParts = wave.lastGain?.parts ?? []}
```

- [ ] **Step 6: `DebugPanel.svelte`の`lastBonusGains`参照を削除する**

`src/routes/game/shidasu/DebugPanel.svelte`内、以下の既存コードを探す:

```ts
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
```

以下に置き換える:

```ts
  $effect(() => {
    const gain = wave.lastGain
    const combo = wave.combo
    const newEntries: GainLogEntry[] = []
    if (gain) newEntries.push({ combo, label: '', points: gain.points, parts: partsToText(gain.parts) })
    // gainLogの読み取り(スプレッド)をuntrackで囲まないと、この$effect自身が
    // gainLogの変化に依存してしまい、書き込むたびに自分自身を再実行する無限ループになる
    if (newEntries.length > 0) {
      gainLog = [...newEntries, ...untrack(() => gainLog)].slice(0, 20)
    }
  })
```

- [ ] **Step 7: `admin/shidasu-debug/+page.svelte`の`lastBonusGains: []`を削除する**

`src/routes/admin/shidasu-debug/+page.svelte`内、以下の既存コードを探す:

```ts
      wave = { ...wave, stock: wave.stock.map((c, i) => (i === idx ? newCard : c)), lastGain: null, lastBonusGains: [] }
```

以下に置き換える:

```ts
      wave = { ...wave, stock: wave.stock.map((c, i) => (i === idx ? newCard : c)), lastGain: null }
```

同ファイル内、以下の既存コードを探す:

```ts
      wave = {
        ...wave,
        tableau: wave.tableau.map((c, ci) => (ci === col ? c.map((cc, ri) => (ri === row ? newCard : cc)) : c)),
        lastGain: null,
        lastBonusGains: [],
      }
```

以下に置き換える:

```ts
      wave = {
        ...wave,
        tableau: wave.tableau.map((c, ci) => (ci === col ? c.map((cc, ri) => (ri === row ? newCard : cc)) : c)),
        lastGain: null,
      }
```

同ファイル内、以下の既存コードを探す(`unifySuit`関数):

```ts
    wave = {
      ...wave,
      tableau: wave.tableau.map(col => col.map(c => (c.wild ? c : { ...c, suit }))),
      lastGain: null,
      lastBonusGains: [],
    }
```

以下に置き換える:

```ts
    wave = {
      ...wave,
      tableau: wave.tableau.map(col => col.map(c => (c.wild ? c : { ...c, suit }))),
      lastGain: null,
    }
```

同ファイル内、以下の既存コードを探す(`stairifyTableau`関数):

```ts
    wave = {
      ...wave,
      tableau: wave.tableau.map((col, ci) => col.map((c, ri) => ({ ...c, rank: newRanks.get(`${ci}-${ri}`) as Rank }))),
      lastGain: null,
      lastBonusGains: [],
    }
```

以下に置き換える:

```ts
    wave = {
      ...wave,
      tableau: wave.tableau.map((col, ci) => col.map((c, ri) => ({ ...c, rank: newRanks.get(`${ci}-${ri}`) as Rank }))),
      lastGain: null,
    }
```

同ファイル内、以下の既存コードを探す(`handleUndo`関数):

```ts
  function handleUndo() {
    if (!lastSnapshot) return
    wave = { ...lastSnapshot, lastGain: null, lastBonusGains: [] }
```

以下に置き換える:

```ts
  function handleUndo() {
    if (!lastSnapshot) return
    wave = { ...lastSnapshot, lastGain: null }
```

- [ ] **Step 8: 型チェックと全体テストを実行する**

Run: `npm run check && npx vitest run src/lib/game/shidasu`

Expected: 両方PASS。`BonusGain`・`lastBonusGains`への参照が残っていれば型エラーになるため、エラーが出た箇所を全て確認し、該当ファイルの参照を削除する。

- [ ] **Step 9: リポジトリ全体で`lastBonusGains`・`BonusGain`への参照が残っていないことを確認する**

Run: `grep -rn "lastBonusGains\|BonusGain" src/`

Expected: 出力なし(全て削除済み)

- [ ] **Step 10: コミット**

```bash
git add src/lib/game/shidasu/types.ts src/lib/game/shidasu/engine.ts src/lib/game/shidasu/engine.test.ts src/lib/game/shidasu/revelationEffects.test.ts src/lib/game/shidasu/riteEffects.test.ts src/routes/game/shidasu/+page.svelte src/routes/game/shidasu/PlayArea.svelte src/routes/game/shidasu/DebugPanel.svelte src/routes/admin/shidasu-debug/+page.svelte
git commit -m "refactor: 全消しボーナスのgained統合に伴いlastBonusGains(BonusGain型)を完全削除"
```

---

## 全タスク完了後の確認

- [ ] `npm run build`を実行し、ビルドが通ることを確認する
- [ ] `npm run check`を実行し、型エラーが無いことを確認する
- [ ] `npx vitest run`でリポジトリ全体のテストスイートを実行し、全てPASSすることを確認する
- [ ] `npm run dev`で開発サーバーを起動し、`/admin/shidasu-debug`から場札を1枚残しにして全消しを発生させ、得点内訳アニメーションで全消しボーナスが通常の獲得点(gained)の内訳の一部として、コンボ倍率がかかった状態で表示されることを目視確認する
- [ ] 忍耐・浄化・節制の護符を所持した状態でも同様に確認する
