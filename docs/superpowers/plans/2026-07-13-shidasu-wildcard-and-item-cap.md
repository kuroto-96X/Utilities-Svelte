# Shidasuワイルドロジック刷新+護符所持上限・交換システム Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** `docs/superpowers/specs/2026-07-13-shidasu-wildcard-and-item-cap-design.md`で承認された設計を実装し、`docs/shidasu-current-rules.md`に記録されている「⚠️ 未実装の変更点」を全て解消する。あわせて護符所持上限(5枚)と交換UIを新規実装する。

**Architecture:** 純粋関数群(`src/lib/game/shidasu/engine.ts`)の既存ロジックを段階的に置き換える。スコアリング/ワイルド判定(`evaluateChainBonus`・`countSameRankBefore`・`chainContinuesPattern`・`drawStock`)を先に直し、その後データモデル(`RunState.pendingNewItem`・`ShidasuParams.items.maxItems`)と新規engine関数(`confirmItemSwap`・`cancelItemSwap`・`skipItemSelect`)を追加、最後にUI(管理画面・ゲーム画面)を追従させる。

**Tech Stack:** SvelteKit + Svelte 5 runes、TypeScript、Vitest。

---

## 前提知識(実装者向け)

- `src/lib/game/shidasu/engine.ts`が全ロジックの本体。`evaluateChainBonus`はカードをプレイしたときの加点計算、`chainContinuesPattern`/`drawStock`は山札をめくったときにコンボを維持するかどうかの判定。
- `analyzeSuitColor(chain)`・`analyzeStair(chain)`は共に「ワイルドを除外して実カードだけで判定する」ヘルパーで、**変更不要**(既にワイルド対応済み)。
- `evaluateChainBonus`は既に`stairMinLen`という第4引数(既定値`scoring.stairMinLen`)を持っている。今回`chainContinuesPattern`にも同じパターンの第4引数を追加する。
- テストは`src/lib/game/shidasu/engine.test.ts`(既存974行)と`src/lib/game/shidasu/params.test.ts`に集約されている。`function card(id, suit, rank, wild=false): Card`というヘルパーが定義済み。
- 各タスックの最後に`npm run test`(Vitest)を実行し、全テストが通ることを確認してからコミットする。

---

### Task 1: 同スート/同色パターンボーナスの3枚以上条件化 + wildSuitBonus廃止

**Files:**
- Modify: `src/lib/game/shidasu/params.ts:5-77`
- Modify: `src/lib/game/shidasu/shidasu.config.json:3-19`
- Modify: `src/lib/game/shidasu/params.test.ts:19-37`
- Modify: `src/lib/game/shidasu/engine.ts:440-505`(`evaluateChainBonus`)
- Modify: `src/routes/admin/shidasu/+page.svelte:18-32,191-231`
- Test: `src/lib/game/shidasu/engine.test.ts:868-886`

- [ ] **Step 1: テストを更新する(RED)**

`src/lib/game/shidasu/engine.test.ts`の868〜886行目(`同スートが継続していればsuitBonusが付く`〜`ワイルド直後はwildSuitBonusのみ`の3テスト)を、以下に置き換える:

```ts
  test('実カード2枚(3枚未満)ではまだ同スートボーナスは付かない', () => {
    const chainBefore = [card(1, '♠', 5)]
    const result = evaluateChainBonus(scoring, chainBefore, card(2, '♠', 6))
    expect(result.parts.some(p => p.startsWith('同スート'))).toBe(false)
  })

  test('実カード3枚以上になった瞬間から同スートボーナスが付く', () => {
    const chainBefore = [card(1, '♠', 5), card(2, '♠', 6)]
    const result = evaluateChainBonus(scoring, chainBefore, card(3, '♠', 7))
    expect(result.bonus).toBe(scoring.suitBonus)
    expect(result.parts).toEqual([`同スート+${scoring.suitBonus}`])
  })

  test('コンボ中に一度スートが崩れたら、以降同スートが来てもsuitBonusは付かない', () => {
    const chainBefore = [card(1, '♠', 5), card(2, '♥', 6), card(3, '♠', 7)] // 1枚目→2枚目でスート崩壊済み、3枚目は直前(2枚目...)
    const result = evaluateChainBonus(scoring, chainBefore, card(4, '♠', 8))
    expect(result.parts.some(p => p.startsWith('同スート'))).toBe(false)
  })
```

(`ワイルド直後はwildSuitBonusのみ`テストは完全に削除する。`wildSuitBonus`自体を廃止するため。)

- [ ] **Step 2: テストが失敗する(コンパイルエラーになる)ことを確認**

Run: `npm run test -- engine.test.ts`
Expected: 型エラーまたは実行時エラー(`scoring.wildSuitBonus`はまだ存在するがテストは削除済みなので、この時点ではまだ全テストPASSしているはず。次のStepで実装側を変更した後に一旦壊れるのが正しい流れ)。

実際には、このStepでは変更後もまだ既存の`evaluateChainBonus`実装(3枚未満条件なし)が残っているため、「実カード2枚ではまだ付かない」テストが**FAIL**する(現行コードは2枚目から付与するため)。これを確認する:

Expected: `実カード2枚(3枚未満)ではまだ同スートボーナスは付かない` が FAIL

- [ ] **Step 3: params.ts・shidasu.config.json・engine.ts・admin画面を実装する**

`src/lib/game/shidasu/params.ts`の`scoring`インターフェース(12〜26行目)を編集し、`wildSuitBonus`を削除して`suitColorMinLen`を追加する:

```ts
  scoring: {
    basePoint: number
    suitBonus: number
    colorBonus: number
    suitColorMinLen: number
    stairBonus: number
    stairMinLen: number
    clearBonus: number
    clearBonusPerStock: number
    comboMultiplierStep: number
    flushBonus: number
    royalSetBonus: number
    sameRankBonusUnit: number
    completeRunBonus: number
    completeRunSuitBonus: number
    columnSweepBonus: number
  }
```

同ファイルの`DEFAULT_PARAMS.scoring`(49〜65行目)も対応させる:

```ts
  scoring: {
    basePoint: 100,
    suitBonus: 100,
    colorBonus: 50,
    suitColorMinLen: 3,
    stairBonus: 150,
    stairMinLen: 5,
    clearBonus: 2000,
    clearBonusPerStock: 50,
    comboMultiplierStep: 0.1,
    flushBonus: 300,
    royalSetBonus: 400,
    sameRankBonusUnit: 100,
    completeRunBonus: 1000,
    completeRunSuitBonus: 1000,
    columnSweepBonus: 150,
  },
```

`src/lib/game/shidasu/shidasu.config.json`も同様に編集する:

```json
  "scoring": {
    "basePoint": 100,
    "suitBonus": 100,
    "colorBonus": 50,
    "suitColorMinLen": 3,
    "stairBonus": 150,
    "stairMinLen": 5,
    "clearBonus": 2000,
    "clearBonusPerStock": 50,
    "comboMultiplierStep": 0.1,
    "flushBonus": 300,
    "royalSetBonus": 400,
    "sameRankBonusUnit": 100,
    "completeRunBonus": 1000,
    "completeRunSuitBonus": 1000,
    "columnSweepBonus": 150
  },
```

`src/lib/game/shidasu/params.test.ts`の19〜37行目の`点数系パラメータは10の倍数になっている`テストから、`expect(s.wildSuitBonus % 10).toBe(0)`の行を削除する。

`src/lib/game/shidasu/engine.ts`の`evaluateChainBonus`(440〜505行目)を編集し、`prevIsWild`分岐を削除して常に3枚以上条件付きの同スート/同色判定を行うようにする:

```ts
export function evaluateChainBonus(
  scoring: ShidasuParams['scoring'],
  chainBefore: Card[],
  card: Card,
  stairMinLen: number = scoring.stairMinLen
): ChainBonusResult {
  if (chainBefore.length === 0) {
    return { bonus: 0, parts: [] }
  }

  let bonus = 0
  const parts: string[] = []

  const realBefore = chainBefore.filter(c => !c.wild)
  const chainIncludingThis = [...chainBefore, card]
  const realIncludingThis = [...realBefore, card]

  const { suitHeld, colorHeld } = analyzeSuitColor(chainIncludingThis)
  if (realIncludingThis.length >= scoring.suitColorMinLen) {
    if (suitHeld) {
      bonus += scoring.suitBonus
      parts.push(`同スート+${scoring.suitBonus}`)
    } else if (colorHeld) {
      bonus += scoring.colorBonus
      parts.push(`同色+${scoring.colorBonus}`)
    }
  }

  const stairInfo = analyzeStair(chainIncludingThis)
  if (stairInfo.held && stairInfo.len >= stairMinLen) {
    bonus += scoring.stairBonus
    parts.push(`階段${stairInfo.len} +${scoring.stairBonus}`)
  }

  if (checkFlush(chainIncludingThis)) {
    bonus += scoring.flushBonus
    parts.push(`フラッシュ+${scoring.flushBonus}`)
  }

  if (checkRoyalSet(chainIncludingThis)) {
    bonus += scoring.royalSetBonus
    parts.push(`ロイヤル+${scoring.royalSetBonus}`)
  }

  const sameRankCount = countSameRankBefore(realBefore, card.rank)
  if (sameRankCount > 0) {
    const sameRankGain = scoring.sameRankBonusUnit * sameRankCount
    bonus += sameRankGain
    parts.push(`同ランク+${sameRankGain}`)
  }

  if (checkCompleteRun(chainBefore, chainIncludingThis)) {
    bonus += scoring.completeRunBonus
    parts.push(`コンプリートラン+${scoring.completeRunBonus}`)
    if (analyzeSuitColor(realIncludingThis).suitHeld) {
      bonus += scoring.completeRunSuitBonus
      parts.push(`コンプリートラン(同スート)+${scoring.completeRunSuitBonus}`)
    }
  }

  return { bonus, parts }
}
```

(`countSameRankBefore(realBefore, card.rank)`の呼び出しはTask 2でチェーン全体を渡すよう変更する。このTaskではまだ触らない。)

`src/routes/admin/shidasu/+page.svelte`を編集する。まず`hasValidationError`(18〜32行目)に検証を追加する(`items.columnSweepRelaxCards`の行の直後):

```ts
    if (!Number.isFinite(config.items.columnSweepRelaxCards) || config.items.columnSweepRelaxCards < 0) return true
    if (!Number.isFinite(config.scoring.suitColorMinLen) || config.scoring.suitColorMinLen < 1) return true
    return false
```

次に「スコアリング」セクション(206〜217行目)の`同色ボーナス`入力の直後に`suitColorMinLen`入力を追加し、`ワイルド直後ボーナス(wildSuitBonus)`のブロックを削除する:

```svelte
          <label class="text-xs text-slate-500">
            同色ボーナス(colorBonus)
            {@render scaledNumberInput(config.scoring.colorBonus, v => setScoring('colorBonus', v))}
          </label>
          <label class="text-xs text-slate-500">
            同スート/同色の成立に必要な実カード枚数(suitColorMinLen)
            <input type="number" min="1" step="1" bind:value={config.scoring.suitColorMinLen} class="mt-1 w-full border border-slate-200 rounded px-2 py-1 text-sm" />
          </label>
          <label class="text-xs text-slate-500">
            階段ボーナス(stairBonus)
            {@render scaledNumberInput(config.scoring.stairBonus, v => setScoring('stairBonus', v))}
          </label>
          <label class="text-xs text-slate-500">
            階段成立枚数(stairMinLen)
            <input type="number" min="2" step="1" bind:value={config.scoring.stairMinLen} class="mt-1 w-full border border-slate-200 rounded px-2 py-1 text-sm" />
          </label>
          <label class="text-xs text-slate-500">
            全消しボーナス(clearBonus)
            {@render scaledNumberInput(config.scoring.clearBonus, v => setScoring('clearBonus', v))}
          </label>
```

(`ワイルド直後ボーナス(wildSuitBonus)`の`<label>`ブロック全体を削除する。)

- [ ] **Step 4: テストを実行して全て通ることを確認**

Run: `npm run test -- engine.test.ts params.test.ts`
Expected: PASS(全テスト)

Run: `npm run check`
Expected: 型エラーなし

- [ ] **Step 5: コミット**

```bash
git add src/lib/game/shidasu/params.ts src/lib/game/shidasu/shidasu.config.json src/lib/game/shidasu/params.test.ts src/lib/game/shidasu/engine.ts src/lib/game/shidasu/engine.test.ts src/routes/admin/shidasu/+page.svelte
git commit -m "$(cat <<'EOF'
feat: Shidasuの同スート/同色ボーナスに実カード3枚以上の条件を追加し★同スートボーナスを廃止
EOF
)"
```

---

### Task 2: 同ランクボーナスへのワイルド算入

**Files:**
- Modify: `src/lib/game/shidasu/engine.ts:420-422,488`(`countSameRankBefore`と呼び出し元)
- Test: `src/lib/game/shidasu/engine.test.ts:815-824,919-923`

- [ ] **Step 1: テストを更新する(RED)**

`src/lib/game/shidasu/engine.test.ts`の815〜824行目の`describe('countSameRankBefore', ...)`ブロックを以下に置き換える:

```ts
describe('countSameRankBefore', () => {
  test('同ランクが無ければ0', () => {
    expect(countSameRankBefore([card(1, '♠', 5), card(2, '♥', 6)], 7)).toBe(0)
  })

  test('同ランクの実カードが3枚あれば3を返す', () => {
    const cards = [card(1, '♠', 5), card(2, '♥', 5), card(3, '♦', 5)]
    expect(countSameRankBefore(cards, 5)).toBe(3)
  })

  test('ワイルドはランクを問わず加算される', () => {
    const cards = [card(1, '♠', 5), card(2, '♥', 5), card(3, '★', 0, true)]
    expect(countSameRankBefore(cards, 5)).toBe(3) // 実カード2枚+ワイルド1枚
  })

  test('指定ランクと無関係な実カードが混ざっていても、ワイルドの枚数分は必ず加算される', () => {
    const cards = [card(1, '♠', 9), card(2, '★', 0, true), card(3, '★', 0, true)]
    expect(countSameRankBefore(cards, 5)).toBe(2) // 実カード0枚(9はランク不一致)+ワイルド2枚
  })
})
```

続けて、`describe('evaluateChainBonus', ...)`ブロック内(919〜923行目、`同ランクが既に2枚あれば sameRankBonusUnit×2 が付く`テストの直後)に、ワイルド込みのテストを追加する:

```ts
  test('チェーン内にワイルドが含まれる場合、同ランクボーナスにワイルドの枚数分も加算される', () => {
    const chainBefore = [card(1, '♠', 5), card(2, '★', 0, true)]
    const result = evaluateChainBonus(scoring, chainBefore, card(3, '♥', 5))
    // 実カード1枚(5)+ワイルド1枚 = 2枚扱い
    expect(result.parts).toContain(`同ランク+${scoring.sameRankBonusUnit * 2}`)
  })
```

- [ ] **Step 2: テストが失敗することを確認**

Run: `npm run test -- engine.test.ts`
Expected: `ワイルドはランクを問わず加算される`・`指定ランクと無関係な実カードが混ざっていても...`・`チェーン内にワイルドが含まれる場合...`の3テストがFAIL(現行実装は実カードのみをカウントするため)

- [ ] **Step 3: countSameRankBeforeを実装する**

`src/lib/game/shidasu/engine.ts`の`countSameRankBefore`(420〜422行目)を編集する:

```ts
export function countSameRankBefore(chainBefore: Card[], rank: Card['rank']): number {
  const realMatches = chainBefore.filter(c => !c.wild && c.rank === rank).length
  const wildCount = chainBefore.filter(c => c.wild).length
  return realMatches + wildCount
}
```

同ファイル488行目、`evaluateChainBonus`内の呼び出し元を`realBefore`から`chainBefore`に変更する:

```ts
  const sameRankCount = countSameRankBefore(chainBefore, card.rank)
```

- [ ] **Step 4: テストを実行して全て通ることを確認**

Run: `npm run test -- engine.test.ts`
Expected: PASS(全テスト)

- [ ] **Step 5: コミット**

```bash
git add src/lib/game/shidasu/engine.ts src/lib/game/shidasu/engine.test.ts
git commit -m "$(cat <<'EOF'
feat: Shidasuの同ランクボーナスにチェーン内のワイルド枚数を算入する
EOF
)"
```

---

### Task 3: chainContinuesPatternの全面書き換え + drawStockへの統合

**Files:**
- Modify: `src/lib/game/shidasu/engine.ts:157-205,507-538`(`drawStock`・`chainContinuesPattern`)
- Test: `src/lib/game/shidasu/engine.test.ts:359-480`(`chainContinuesPattern`・`drawStock`の各describe)

- [ ] **Step 1: テストを更新する(RED)**

`src/lib/game/shidasu/engine.test.ts`の359〜388行目、`describe('chainContinuesPattern', ...)`ブロック全体を以下に置き換える:

```ts
describe('chainContinuesPattern', () => {
  test('チェーンが空なら継続不可', () => {
    expect(chainContinuesPattern(DEFAULT_PARAMS.scoring, [], card(1, '♠', 5))).toBe(false)
  })

  test('実カード3枚未満では同スートが揃っていても継続不可', () => {
    const chain = [card(1, '♠', 5)]
    expect(chainContinuesPattern(DEFAULT_PARAMS.scoring, chain, card(2, '♠', 6))).toBe(false)
  })

  test('捲った札を含めて実カード3枚以上・同スートが揃えば継続', () => {
    const chain = [card(1, '♠', 5), card(2, '♠', 6)]
    expect(chainContinuesPattern(DEFAULT_PARAMS.scoring, chain, card(3, '♠', 9))).toBe(true)
  })

  test('同スートが成立中でも、捲った札が違うスート・違う色なら継続不可', () => {
    const chain = [card(1, '♠', 5), card(2, '♠', 6)]
    expect(chainContinuesPattern(DEFAULT_PARAMS.scoring, chain, card(3, '♥', 9))).toBe(false)
  })

  test('階段が成立中で、捲った札が同方向を継続し長さがstairMinLen以上になれば継続', () => {
    const chain = [card(1, '♠', 5), card(2, '♣', 6)] // dir=+1, len=2
    expect(chainContinuesPattern(DEFAULT_PARAMS.scoring, chain, card(3, '♦', 7), 3)).toBe(true)
  })

  test('階段の長さがstairMinLen未満なら継続不可', () => {
    const chain = [card(1, '♠', 5), card(2, '♣', 6)] // dir=+1, len=2
    expect(chainContinuesPattern(DEFAULT_PARAMS.scoring, chain, card(3, '♦', 7))).toBe(false) // 既定のstairMinLen(5)未満
  })

  test('全ての条件が既に崩れていれば継続不可', () => {
    const chain = [card(1, '♠', 5), card(2, '♥', 8)] // スートも色も階段も不成立
    expect(chainContinuesPattern(DEFAULT_PARAMS.scoring, chain, card(3, '♣', 2))).toBe(false)
  })
})
```

続けて、390〜480行目の`describe('drawStock', ...)`ブロックのうち、419〜454行目(`ワイルドがめくれた場合`・`パターンに合う札ならアイテム無しで特殊継続しlastDrawEffectはpattern`の2テスト)を、以下に置き換える:

```ts
  test('ワイルドがめくれた場合(継続中のパターンが無い): コンボがリセットされ、ワイルド1枚が新しい起点になる', () => {
    const wave = makeWave({
      stock: [card(1, '★', 0, true)],
      combo: 3,
      chain: [card(2, '♣', 5)], // 実カード1枚のみ、パターン不成立
      chainOrigin: ['play'],
      linked: true,
      comboStreakColumnLengths: [4, 2],
    })
    const next = drawStock(DEFAULT_PARAMS, wave, [])
    expect(next.combo).toBe(0)
    expect(next.chain).toEqual([card(1, '★', 0, true)])
    expect(next.chainOrigin).toEqual(['draw'])
    expect(next.linked).toBe(false)
    expect(next.lastDrawEffect).toBeNull()
  })

  test('ワイルドがめくれた場合(継続中のパターンがある): コンボが継続し、lastDrawEffectはwild', () => {
    const wave = makeWave({
      stock: [card(1, '★', 0, true)],
      combo: 3,
      chain: [card(2, '♠', 5), card(3, '♠', 6), card(4, '♠', 7)], // 実カード3枚・同スート継続中
      chainOrigin: ['play', 'play', 'play'],
      linked: true,
      comboStreakColumnLengths: [4, 2],
    })
    const next = drawStock(DEFAULT_PARAMS, wave, [])
    expect(next.combo).toBe(3)
    expect(next.chain).toEqual([card(2, '♠', 5), card(3, '♠', 6), card(4, '♠', 7), card(1, '★', 0, true)])
    expect(next.chainOrigin).toEqual(['play', 'play', 'play', 'draw'])
    expect(next.linked).toBe(true)
    expect(next.lastDrawEffect).toBe('wild')
    expect(next.comboStreakColumnLengths).toEqual([4, 2])
  })

  test('パターンに合う札ならアイテム無しで特殊継続しlastDrawEffectはpattern', () => {
    const wave = makeWave({
      stock: [card(1, '♠', 9)], // 同スート継続(捲った後で実カード3枚)
      combo: 2,
      chain: [card(2, '♠', 4), card(3, '♠', 5)],
      chainOrigin: ['play', 'play'],
      linked: true,
      comboStreakColumnLengths: [3, 2],
    })
    const next = drawStock(DEFAULT_PARAMS, wave, [])
    expect(next.combo).toBe(2)
    expect(next.chain).toEqual([card(2, '♠', 4), card(3, '♠', 5), card(1, '♠', 9)])
    expect(next.chainOrigin).toEqual(['play', 'play', 'draw'])
    expect(next.linked).toBe(true)
    expect(next.lastDrawEffect).toBe('pattern')
    expect(next.score).toBe(wave.score) // 得点は付かない
    expect(next.comboStreakColumnLengths).toEqual([3, 2])
  })

  test('架橋の護符所持時は、山札めくりの階段パターン継続判定にもstairRelaxedMinLenが使われる', () => {
    const wave = makeWave({
      stock: [card(1, '♦', 7)], // 階段継続: 5→6→7(長さ3)
      combo: 2,
      chain: [card(2, '♠', 5), card(3, '♣', 6)], // dir=+1, len=2
      chainOrigin: ['play', 'play'],
      linked: true,
    })
    const next = drawStock(DEFAULT_PARAMS, wave, ['bridge']) // stairRelaxedMinLen=3
    expect(next.combo).toBe(2)
    expect(next.lastDrawEffect).toBe('pattern')
    expect(next.chain).toEqual([card(2, '♠', 5), card(3, '♣', 6), card(1, '♦', 7)])
  })

  test('架橋の護符を持っていなければ、同じ階段(長さ3)ではdrawStockのパターン継続は成立しない(既定stairMinLen(5)未満)', () => {
    const wave = makeWave({
      stock: [card(1, '♦', 7)],
      combo: 2,
      chain: [card(2, '♠', 5), card(3, '♣', 6)],
      chainOrigin: ['play', 'play'],
      linked: true,
    })
    const next = drawStock(DEFAULT_PARAMS, wave, [])
    expect(next.combo).toBe(0) // リセットされる
    expect(next.lastDrawEffect).toBeNull()
  })
```

- [ ] **Step 2: テストが失敗することを確認**

Run: `npm run test -- engine.test.ts`
Expected: `chainContinuesPattern`の階段長さ系テストと、`drawStock`の全ての新規/更新テストがFAIL(現行実装は長さ判定を持たず、ワイルドは常に無条件継続するため)

- [ ] **Step 3: chainContinuesPatternとdrawStockを実装する**

`src/lib/game/shidasu/engine.ts`の`chainContinuesPattern`(507〜538行目)を丸ごと置き換える:

```ts
export function chainContinuesPattern(
  scoring: ShidasuParams['scoring'],
  chain: Card[],
  card: Card,
  stairMinLen: number = scoring.stairMinLen
): boolean {
  const chainIncludingThis = [...chain, card]

  const { suitHeld, colorHeld } = analyzeSuitColor(chainIncludingThis)
  const realCount = chainIncludingThis.filter(c => !c.wild).length
  if (realCount >= scoring.suitColorMinLen && (suitHeld || colorHeld)) return true

  const stairInfo = analyzeStair(chainIncludingThis)
  if (stairInfo.held && stairInfo.dir !== 0 && stairInfo.len >= stairMinLen) return true

  return false
}
```

同ファイルの`drawStock`(157〜205行目)を丸ごと置き換える(第3引数を`_items`から`items`に変更し、ワイルド専用分岐を削除して1つの分岐に統合する):

```ts
export function drawStock(params: ShidasuParams, wave: WaveState, items: ItemId[]): WaveState {
  if (wave.status !== 'playing') return wave
  if (wave.stock.length === 0) return wave

  const newStock = [...wave.stock]
  const card = newStock.pop() as Card

  const effectiveStairMinLen = items.includes('bridge') ? params.items.stairRelaxedMinLen : params.scoring.stairMinLen
  const patternContinues = wave.linked && chainContinuesPattern(params.scoring, wave.chain, card, effectiveStairMinLen)

  if (patternContinues) {
    return {
      ...wave,
      stock: newStock,
      foundation: card,
      chain: [...wave.chain, card],
      chainOrigin: [...wave.chainOrigin, 'draw'],
      linked: true,
      lastDrawEffect: card.wild ? 'wild' : 'pattern',
      lastGain: null,
    }
  }

  return {
    ...wave,
    stock: newStock,
    foundation: card,
    combo: 0,
    chain: [card],
    chainOrigin: ['draw'],
    linked: false,
    columnsEmptiedThisCombo: 0,
    comboStreakColumnLengths: wave.tableau.map(col => col.length),
    lastDrawEffect: null,
    lastGain: null,
  }
}
```

- [ ] **Step 4: テストを実行して全て通ることを確認**

Run: `npm run test -- engine.test.ts`
Expected: PASS(全テスト)

Run: `npm run check`
Expected: 型エラーなし

- [ ] **Step 5: コミット**

```bash
git add src/lib/game/shidasu/engine.ts src/lib/game/shidasu/engine.test.ts
git commit -m "$(cat <<'EOF'
feat: Shidasuのパターン継続判定をめくった後のチェーン基準に書き換え、ワイルドの無条件継続を廃止
EOF
)"
```

---

### Task 4: 護符所持上限(maxItems)+ pendingNewItemの追加(データモデル)

**Files:**
- Modify: `src/lib/game/shidasu/types.ts:45-52`
- Modify: `src/lib/game/shidasu/params.ts:32-35,71-74`
- Modify: `src/lib/game/shidasu/shidasu.config.json:25-28`
- Modify: `src/lib/game/shidasu/engine.ts:247-260,277`(`createInitialRun`・`beginRun`・`resolveWaveEnd`)
- Test: `src/lib/game/shidasu/engine.test.ts:561-577`(`createInitialRun / beginRun`)

- [ ] **Step 1: テストを更新する(RED)**

`src/lib/game/shidasu/engine.test.ts`の561〜577行目、`describe('createInitialRun / beginRun', ...)`ブロックに`pendingNewItem`の検証を追加する:

```ts
describe('createInitialRun / beginRun', () => {
  test('createInitialRunはtitleフェーズでwave=null、pendingNewItemはnull', () => {
    const run = createInitialRun()
    expect(run.phase).toBe('title')
    expect(run.wave).toBeNull()
    expect(run.items).toEqual([])
    expect(run.pendingNewItem).toBeNull()
  })

  test('beginRunはplayingフェーズでステージ0・ウェーブ0から始まる、pendingNewItemはnull', () => {
    const run = beginRun(DEFAULT_PARAMS, 1)
    expect(run.phase).toBe('playing')
    expect(run.stageIndex).toBe(0)
    expect(run.waveIndex).toBe(0)
    expect(run.wave).not.toBeNull()
    expect(run.pendingNewItem).toBeNull()
  })
})
```

- [ ] **Step 2: テストが失敗することを確認**

Run: `npm run test -- engine.test.ts`
Expected: 2テストともFAIL(現行の`RunState`型に`pendingNewItem`フィールドが無いため`undefined`になり`toBeNull()`が失敗する)

- [ ] **Step 3: types.ts・params.ts・shidasu.config.json・engine.tsを実装する**

`src/lib/game/shidasu/types.ts`の`ItemId`宣言(5行目)はそのまま。`RunState`インターフェース(45〜52行目)に`pendingNewItem`を追加する:

```ts
export interface RunState {
  phase: RunPhase
  stageIndex: number
  waveIndex: number
  items: ItemId[]
  offer: ItemId[]
  wave: WaveState | null
  pendingNewItem: ItemId | null
}
```

`src/lib/game/shidasu/params.ts`の`items`インターフェース(32〜35行目)に`maxItems`を追加する:

```ts
  items: {
    stairRelaxedMinLen: number
    columnSweepRelaxCards: number
    maxItems: number
  }
```

`DEFAULT_PARAMS.items`(71〜74行目)も対応させる:

```ts
  items: {
    stairRelaxedMinLen: 3,
    columnSweepRelaxCards: 2,
    maxItems: 5,
  },
```

`src/lib/game/shidasu/shidasu.config.json`の`items`(25〜28行目)も対応させる:

```json
  "items": {
    "stairRelaxedMinLen": 3,
    "columnSweepRelaxCards": 2,
    "maxItems": 5
  },
```

`src/lib/game/shidasu/engine.ts`の`createInitialRun`(247〜249行目)を編集する:

```ts
export function createInitialRun(): RunState {
  return { phase: 'title', stageIndex: 0, waveIndex: 0, items: [], offer: [], wave: null, pendingNewItem: null }
}
```

`beginRun`(251〜260行目)を編集する:

```ts
export function beginRun(params: ShidasuParams, seed?: number): RunState {
  return {
    phase: 'playing',
    stageIndex: 0,
    waveIndex: 0,
    items: [],
    offer: [],
    wave: startWave(params, 0, 0, [], seed),
    pendingNewItem: null,
  }
}
```

`resolveWaveEnd`(262〜278行目)の`itemSelect`遷移部分(277行目)を編集し、`pendingNewItem`を明示的にリセットする:

```ts
  return { ...run, phase: 'itemSelect', offer: rollItemOffer(run.items, rand), pendingNewItem: null }
```

- [ ] **Step 4: テストを実行して全て通ることを確認**

Run: `npm run test`
Expected: PASS(全テスト)

Run: `npm run check`
Expected: 型エラーなし

- [ ] **Step 5: コミット**

```bash
git add src/lib/game/shidasu/types.ts src/lib/game/shidasu/params.ts src/lib/game/shidasu/shidasu.config.json src/lib/game/shidasu/engine.ts src/lib/game/shidasu/engine.test.ts
git commit -m "$(cat <<'EOF'
feat: Shidasuに護符所持上限(maxItems)とRunState.pendingNewItemを追加
EOF
)"
```

---

### Task 5: 護符交換のengine関数実装(pickItem分岐・confirmItemSwap・cancelItemSwap・skipItemSelect)

**Files:**
- Modify: `src/lib/game/shidasu/engine.ts:280-292`(`pickItem`)、末尾に3関数追加
- Test: `src/lib/game/shidasu/engine.test.ts:1-40`(import追加)、`616-640`付近に新規describe追加

- [ ] **Step 1: テストを書く(RED)**

`src/lib/game/shidasu/engine.test.ts`のimport文(3〜37行目)に以下を追加する(`pickItem,`の行の直後):

```ts
  pickItem,
  confirmItemSwap,
  cancelItemSwap,
  skipItemSelect,
```

`describe('pickItem / advanceStage / restartRun', ...)`ブロック(616〜640行目)の直後に、新しいdescribeブロックを追加する:

```ts
describe('護符所持上限・交換(maxItems / confirmItemSwap / cancelItemSwap / skipItemSelect)', () => {
  function fullItemsRun(overrides: Partial<RunState> = {}): RunState {
    return {
      ...beginRun(DEFAULT_PARAMS, 1),
      phase: 'itemSelect',
      // maxItems(5)ちょうどの所持状態を作るための検証用フィクスチャ。
      // 実プレイでは護符プールが2種類しか無いため実際にこの状態には到達しないが、
      // pickItem/confirmItemSwapの上限判定・入れ替えロジック自体は所持数のみで動くため検証できる。
      items: ['bridge', 'grace', 'bridge', 'grace', 'bridge'],
      offer: ['grace'],
      pendingNewItem: null,
      ...overrides,
    }
  }

  test('所持数がmaxItems未満ならpickItemで即座に反映される(従来通り)', () => {
    const run: RunState = { ...beginRun(DEFAULT_PARAMS, 1), phase: 'itemSelect', items: ['bridge'], offer: ['grace'] }
    const next = pickItem(DEFAULT_PARAMS, run, 'grace', 2)
    expect(next.phase).toBe('playing')
    expect(next.items).toEqual(['bridge', 'grace'])
    expect(next.pendingNewItem).toBeNull()
  })

  test('所持数がmaxItems以上ならpickItemはウェーブを進めずpendingNewItemをセットするのみ', () => {
    const run = fullItemsRun()
    const next = pickItem(DEFAULT_PARAMS, run, 'grace', 2)
    expect(next.phase).toBe('itemSelect')
    expect(next.items).toEqual(run.items)
    expect(next.offer).toEqual(run.offer)
    expect(next.pendingNewItem).toBe('grace')
    expect(next.waveIndex).toBe(run.waveIndex)
  })

  test('confirmItemSwapで指定した護符が1つ入れ替わり次ウェーブへ進む', () => {
    const run = fullItemsRun({ pendingNewItem: 'grace' })
    // run.items = ['bridge', 'grace', 'bridge', 'grace', 'bridge'] (先頭のbridgeが入れ替え対象)
    const next = confirmItemSwap(DEFAULT_PARAMS, run, 'bridge', 3)
    expect(next.phase).toBe('playing')
    expect(next.items).toEqual(['grace', 'bridge', 'grace', 'bridge', 'grace'])
    expect(next.pendingNewItem).toBeNull()
    expect(next.waveIndex).toBe(run.waveIndex + 1)
  })

  test('pendingNewItemが無い状態でconfirmItemSwapを呼んでも何も起きない', () => {
    const run = fullItemsRun({ pendingNewItem: null })
    const next = confirmItemSwap(DEFAULT_PARAMS, run, 'bridge', 3)
    expect(next).toBe(run)
  })

  test('cancelItemSwapでpendingNewItemがnullに戻り、フェーズ・オファー・所持アイテムは変わらない', () => {
    const run = fullItemsRun({ pendingNewItem: 'grace' })
    const next = cancelItemSwap(run)
    expect(next.pendingNewItem).toBeNull()
    expect(next.phase).toBe('itemSelect')
    expect(next.offer).toEqual(run.offer)
    expect(next.items).toEqual(run.items)
  })

  test('skipItemSelectは護符を追加せずウェーブを進める', () => {
    const run: RunState = { ...beginRun(DEFAULT_PARAMS, 1), phase: 'itemSelect', items: ['bridge'], offer: ['grace'] }
    const next = skipItemSelect(DEFAULT_PARAMS, run, 2)
    expect(next.phase).toBe('playing')
    expect(next.items).toEqual(['bridge'])
    expect(next.waveIndex).toBe(run.waveIndex + 1)
    expect(next.pendingNewItem).toBeNull()
  })

  test('phaseがitemSelect以外ならconfirmItemSwap/cancelItemSwap/skipItemSelectは何もしない', () => {
    const run: RunState = { ...beginRun(DEFAULT_PARAMS, 1), phase: 'playing' }
    expect(confirmItemSwap(DEFAULT_PARAMS, run, 'bridge')).toBe(run)
    expect(cancelItemSwap(run)).toBe(run)
    expect(skipItemSelect(DEFAULT_PARAMS, run)).toBe(run)
  })
})
```

- [ ] **Step 2: テストが失敗することを確認**

Run: `npm run test -- engine.test.ts`
Expected: `confirmItemSwap`/`cancelItemSwap`/`skipItemSelect`が未定義のためTypeScriptエラー、および所持上限分岐が無いため`pickItem`関連テストがFAIL

- [ ] **Step 3: pickItemを修正し、3つの新規関数を実装する**

`src/lib/game/shidasu/engine.ts`の`pickItem`(280〜292行目)を編集する:

```ts
export function pickItem(params: ShidasuParams, run: RunState, itemId: ItemId, seed?: number): RunState {
  if (run.phase !== 'itemSelect') return run
  if (run.items.length >= params.items.maxItems) {
    return { ...run, pendingNewItem: itemId }
  }
  const newItems = [...run.items, itemId]
  const newWaveIndex = run.waveIndex + 1
  return {
    ...run,
    phase: 'playing',
    items: newItems,
    waveIndex: newWaveIndex,
    offer: [],
    pendingNewItem: null,
    wave: startWave(params, run.stageIndex, newWaveIndex, newItems, seed),
  }
}

export function confirmItemSwap(params: ShidasuParams, run: RunState, oldItemId: ItemId, seed?: number): RunState {
  if (run.phase !== 'itemSelect' || run.pendingNewItem === null) return run
  const idx = run.items.indexOf(oldItemId)
  const remaining = idx === -1 ? [...run.items] : [...run.items.slice(0, idx), ...run.items.slice(idx + 1)]
  const newItems = [...remaining, run.pendingNewItem]
  const newWaveIndex = run.waveIndex + 1
  return {
    ...run,
    phase: 'playing',
    items: newItems,
    waveIndex: newWaveIndex,
    offer: [],
    pendingNewItem: null,
    wave: startWave(params, run.stageIndex, newWaveIndex, newItems, seed),
  }
}

export function cancelItemSwap(run: RunState): RunState {
  if (run.phase !== 'itemSelect') return run
  return { ...run, pendingNewItem: null }
}

export function skipItemSelect(params: ShidasuParams, run: RunState, seed?: number): RunState {
  if (run.phase !== 'itemSelect') return run
  const newWaveIndex = run.waveIndex + 1
  return {
    ...run,
    phase: 'playing',
    waveIndex: newWaveIndex,
    offer: [],
    pendingNewItem: null,
    wave: startWave(params, run.stageIndex, newWaveIndex, run.items, seed),
  }
}
```

配置場所: 既存の`pickItem`の直後、`advanceStage`の直前に挿入する。

- [ ] **Step 4: テストを実行して全て通ることを確認**

Run: `npm run test`
Expected: PASS(全テスト)

Run: `npm run check`
Expected: 型エラーなし

- [ ] **Step 5: コミット**

```bash
git add src/lib/game/shidasu/engine.ts src/lib/game/shidasu/engine.test.ts
git commit -m "$(cat <<'EOF'
feat: Shidasuに護符所持上限到達時の交換フロー(confirmItemSwap/cancelItemSwap/skipItemSelect)を実装
EOF
)"
```

---

### Task 6: 管理画面(admin)にmaxItems入力を追加

**Files:**
- Modify: `src/routes/admin/shidasu/+page.svelte:18-32,308-320`

- [ ] **Step 1: 検証ロジックと入力欄を追加する**

このタスクはUIのみの変更でユニットテストは無い(既存のVitestスイートはAPI/DOM層を対象にしていないため)。`hasValidationError`(18〜32行目、Task 1で`suitColorMinLen`チェックを追加済み)の末尾付近に`maxItems`の検証を追加する:

```ts
    if (!Number.isFinite(config.items.stairRelaxedMinLen) || config.items.stairRelaxedMinLen < 1) return true
    if (!Number.isFinite(config.items.columnSweepRelaxCards) || config.items.columnSweepRelaxCards < 0) return true
    if (!Number.isFinite(config.items.maxItems) || config.items.maxItems < 1) return true
    if (!Number.isFinite(config.scoring.suitColorMinLen) || config.scoring.suitColorMinLen < 1) return true
    return false
```

「アイテム」セクション(308〜320行目)に`maxItems`入力を追加する:

```svelte
      <section class="bg-white border border-slate-200 rounded-xl p-4">
        <h2 class="font-semibold text-slate-700 text-sm mb-3">アイテム</h2>
        <div class="grid grid-cols-2 gap-3">
          <label class="text-xs text-slate-500">
            架橋の護符: 階段成立に必要な枚数(stairRelaxedMinLen)
            <input type="number" min="1" step="1" bind:value={config.items.stairRelaxedMinLen} class="mt-1 w-full border border-slate-200 rounded px-2 py-1 text-sm" />
          </label>
          <label class="text-xs text-slate-500">
            寛容の護符: 列一掃緩和の猶予枚数(columnSweepRelaxCards)
            <input type="number" min="0" step="1" bind:value={config.items.columnSweepRelaxCards} class="mt-1 w-full border border-slate-200 rounded px-2 py-1 text-sm" />
          </label>
          <label class="text-xs text-slate-500">
            護符の所持上限枚数(maxItems)
            <input type="number" min="1" step="1" bind:value={config.items.maxItems} class="mt-1 w-full border border-slate-200 rounded px-2 py-1 text-sm" />
          </label>
        </div>
      </section>
```

- [ ] **Step 2: 型チェックとビルドを確認**

Run: `npm run check`
Expected: 型エラーなし

Run: `npm run build`
Expected: ビルド成功

- [ ] **Step 3: コミット**

```bash
git add src/routes/admin/shidasu/+page.svelte
git commit -m "$(cat <<'EOF'
feat: Shidasu管理画面に護符所持上限(maxItems)の入力欄を追加
EOF
)"
```

---

### Task 7: ゲーム画面(+page.svelte)の2ステップitemSelect UI実装

**Files:**
- Modify: `src/routes/game/shidasu/+page.svelte:4-8,108-111,314-320,334-352`

- [ ] **Step 1: importとハンドラーを追加・修正する**

`src/routes/game/shidasu/+page.svelte`のimport文(4〜8行目)を編集する:

```svelte
  import {
    createInitialRun, beginRun, applyPlayCard, applyDrawStock, applyStuckCheck,
    resolveWaveEnd, pickItem, confirmItemSwap, cancelItemSwap, skipItemSelect,
    advanceStage, restartRun, startWave, forceStockTop,
    getPlayableColumns, remainingCount, rankLabel, isRed, itemDesc, ITEM_NAMES,
  } from '$lib/game/shidasu/engine'
```

`handlePickItem`(108〜111行目)を編集する。護符所持上限に達している場合、`pickItem`は`phase`を`itemSelect`のまま返す(交換選択待ち)ため、その場合は`afterAction()`を呼ばない(まだウェーブが進んでいないため、手詰まりチェックや`resolveWaveEnd`の再実行を誘発してはいけない):

```svelte
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
```

（配置場所: 既存の`handlePickItem`をそのまま編集し、その直後に3つの新規ハンドラーを追加する。）

- [ ] **Step 2: itemSelectのUIブロックを2ステップ化する**

334〜352行目の`{#if run.phase === 'itemSelect'}`ブロックを以下に置き換える:

```svelte
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
              <div class="font-black text-yellow-300">{ITEM_NAMES[id]}</div>
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
              <div class="font-black text-yellow-300">{ITEM_NAMES[id]}</div>
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
```

- [ ] **Step 3: タイトル画面のチュートリアル文言を、同スート/同色の3枚以上条件に合わせて更新する**

314〜320行目を編集する:

```svelte
      <p class="text-emerald-100/70 text-sm mt-3 leading-relaxed">
        ランクの±1を連鎖で取ってスコアを稼ぐ<br />
        同スート・同色(3枚以上)・階段(同方向<br />
        5枚以上)でボーナスが乗る。場札を<br />
        全消しすると大きく加点され、3ウェーブ<br />
        突破でステージクリア。
      </p>
```

- [ ] **Step 4: 型チェックとビルドを確認**

Run: `npm run check`
Expected: 型エラーなし

Run: `npm run build`
Expected: ビルド成功

- [ ] **Step 5: コミット**

```bash
git add src/routes/game/shidasu/+page.svelte
git commit -m "$(cat <<'EOF'
feat: Shidasuのアイテム選択画面に「取得しない」ボタンと護符交換の2ステップUIを追加
EOF
)"
```

---

### Task 8: 最終検証とドキュメント更新

**Files:**
- Verify: `npm run test`・`npm run check`・`npm run build`
- Verify: ブラウザでの動作確認(`/game/shidasu`・`/admin/shidasu`)
- Modify: `docs/shidasu-current-rules.md`
- Modify: `docs/shidasu-roadmap.md`

- [ ] **Step 1: 自動テスト・型チェック・ビルドを実行**

```bash
npm run test
npm run check
npm run build
```

Expected: 全て成功。失敗があれば修正してから次に進む。

- [ ] **Step 2: `npm run dev`を起動し、`/game/shidasu`で通常プレイを確認**

- 場札を3枚連続で同スートプレイしたとき、3枚目で初めて画面上に「同スート+100」の加点表示が出る(2枚目までは出ない)ことを確認する。
- 階段(5枚未満)ではボーナスが付かず、5枚以上でボーナスが付くことを確認する(既存動作、回帰していないことの確認)。
- タイトル画面の説明文が「同スート・同色(3枚以上)・階段(同方向5枚以上)」に更新されていることを確認する。

- [ ] **Step 3: 護符所持上限+交換UIを検証する(一時的にmaxItemsを下げて確認)**

現状の護符プール(`bridge`・`grace`の2種類)では`maxItems`(既定5)に実プレイで到達できないため、検証用に一時的に`shidasu.config.json`の`items.maxItems`を`1`に変更する:

```bash
# 一時的な変更(検証用、後で元に戻す)
```

`src/lib/game/shidasu/shidasu.config.json`の`"maxItems": 5`を`"maxItems": 1`に変更し、`npm run dev`を再起動する。ブラウザで:

1. ウェーブ1クリア後、護符を1つ選ぶ(即座に反映され、通常通りプレイ再開することを確認)。
2. ウェーブ2クリア後、護符選択肢のいずれかをクリックする → 所持数(1)が上限(1)に達しているため、「入れ替える護符を選ぶ」画面に切り替わることを確認する。
3. 「戻る」ボタンを押すと最初の選択肢一覧に戻ることを確認する。
4. 再度護符を選び、今度は所持護符(1個)をクリックして交換を確定する → 護符が入れ替わり、次のウェーブが正常に始まることを確認する。
5. 「取得しない」ボタンでも次のウェーブに進めることを確認する(ステップ1・ステップ2どちらの画面でも試す)。

確認後、`shidasu.config.json`の`"maxItems": 1`を`"maxItems": 5`に戻す:

```bash
git diff src/lib/game/shidasu/shidasu.config.json
```

Expected: 差分が無い(既定値5に戻っている)ことを確認する。

- [ ] **Step 4: `/admin/shidasu`でUIを確認**

- 「スコアリング」セクションに`ワイルド直後ボーナス(wildSuitBonus)`の入力欄が存在せず、`同スート/同色の成立に必要な実カード枚数(suitColorMinLen)`の入力欄が存在することを確認する。
- 「アイテム」セクションに`護符の所持上限枚数(maxItems)`の入力欄が存在することを確認する。
- `suitColorMinLen`や`maxItems`に`0`など不正な値を入れると保存ボタンが無効化される(`入力値が不正です`と表示される)ことを確認する。

- [ ] **Step 5: コード全体から`wildSuitBonus`・`★同スート`の残存を確認する**

```bash
grep -rn "wildSuitBonus\|★同スート" src/
```

Expected: 何もヒットしない(`docs/`配下の過去のspec/planドキュメントは履歴のため対象外)。

- [ ] **Step 6: `docs/shidasu-current-rules.md`を更新し、解消された「⚠️ 未実装」を反映する**

74〜78行目の以下のブロックを削除する:

```
**⚠️ 未実装の変更点(2026-07-13決定)**: 以下は新しく決定されたルールで、現状の実装にはまだ反映されていない。
- 同スート・同色パターンボーナスの「チェーン内の実カードが3枚以上」という条件(現行コードでは2枚目から適用される)。
- 「ワイルドはすべてのカード(ランク・スート)の代役となるだけで、それ以外の特別ルールは設定しない」という原則の採用に伴い、**★同スートボーナス(wildSuitBonus)は廃止**する。現行コードでは、チェーン直前がワイルドの場合に同スート/同色ボーナスの代わりに固定の★同スートボーナスが加算されるが、新ルールではこの特別扱いを無くし、ワイルドを挟んでいても通常の同スート/同色ボーナスがそのまま継続する形にする(`analyzeSuitColor`は元々ワイルドを除外して実カードのみで判定しているため、この統一によって挙動が変わるのは「ワイルド直後の1枚」の扱いのみ)。
- 同ランクボーナスの判定(`countSameRankBefore`)は、現行コードでは実カードのみをカウントしているが、新ルールではチェーン内のワイルドも(ランクを問わず)カウントに含める。
実装は別途着手する。
```

116行目の以下のブロックを削除する:

```
**⚠️ 未実装の変更点(2026-07-13決定)**: 上記のパターン継続ルールは新しく決定されたもので、現状の実装(`chainContinuesPattern`・`drawStock`)にはまだ反映されていない。現行コードでは、階段は方向確定さえしていれば長さを問わず継続扱いになり、ワイルドを引いた場合は成立中のパターンを問わず常に無条件でコンボを維持する。実装は別途着手する。
```

120行目(4.7節)の以下の文を:

```
既存のロジックはおおむねこの原則に沿っている(`isPlayable`はワイルドを常に取得可能にする=どのランクにも成り代われるため、`analyzeStair`はワイルドを挟んでも方向継続を妨げない、`checkFlush`/`checkRoyalSet`/`checkCompleteRun`はワイルドを不足分の穴埋めとして扱う)が、★同スートボーナスと同ランクボーナスの実カード限定カウントは、この原則に合わせて4.2節の通り見直しが決定されている(★同スートボーナスの廃止、同ランクボーナスへのワイルド算入)。
```

以下に置き換える:

```
既存のロジックは全てこの原則に沿っている(`isPlayable`はワイルドを常に取得可能にする=どのランクにも成り代われるため、`analyzeStair`はワイルドを挟んでも方向継続を妨げない、`checkFlush`/`checkRoyalSet`/`checkCompleteRun`はワイルドを不足分の穴埋めとして扱う、`countSameRankBefore`はワイルドをランク不問でカウントする)。かつて存在した★同スートボーナスの特別扱いも、この原則に合わせて廃止済み。
```

124行目(4.8節見出し)の`### 4.8 ワイルドのランク・スートの扱い方(2026-07-13決定・未実装)`を、以下に置き換える:

```
### 4.8 ワイルドのランク・スートの扱い方(2026-07-13決定)
```

158行目(8節、護符所持上限の説明)を:

```
- **護符は最大5枚まで保持できる**(所持数の上限)。ただし現状のエンジン(`pickItem`/`rollItemOffer`)にはこの上限を強制するチェックはまだ実装されておらず、護符プールも2個しか無いため上限に到達すること自体が現状は起こらない。上限到達時の挙動(オファー自体が出なくなるのか、入れ替えが発生するのか等)は`docs/shidasu-roadmap.md`項目2の残タスク(アイテム所持数の上限・入れ替え機能)として今後実装する。
```

以下に置き換える:

```
- **護符は最大5枚まで保持できる**(`items.maxItems`)。所持数が上限に達している状態で新しい護符を選ぶと、アイテム選択画面が「入れ替える護符を選ぶ」ステップに切り替わり、選んだ護符と入れ替わる(`confirmItemSwap`)。この2ステップのどちらの画面でも「取得しない」/「戻る」ボタンで護符を増やさずに次のウェーブへ進める(`skipItemSelect`/`cancelItemSwap`)。ただし現状の護符プールは2個しか無いため、実プレイで上限(5枚)に到達すること自体は起こらない(将来護符が追加された際に機能する)。
```

168〜193行目の「9. 現在のデフォルト数値一覧」の表を編集する。178行目の`| scoring.wildSuitBonus | 100 (★同スートボーナス廃止決定により、実装時に削除予定) |`の行を削除し、`scoring.colorBonus`の行の直後に`scoring.suitColorMinLen`の行を追加、`items.columnSweepRelaxCards`の行の直後に`items.maxItems`の行を追加する:

```
| scoring.basePoint | 100 |
| scoring.suitBonus | 100 |
| scoring.colorBonus | 50 |
| scoring.suitColorMinLen | 3 |
| scoring.stairBonus | 150 |
| scoring.stairMinLen | 5 |
| scoring.clearBonus | 2000 |
| scoring.clearBonusPerStock | 50 |
| scoring.comboMultiplierStep | 0.1 |
| scoring.flushBonus | 300 |
| scoring.royalSetBonus | 400 |
| scoring.sameRankBonusUnit | 100 |
| scoring.completeRunBonus | 1000 |
| scoring.completeRunSuitBonus | 1000 |
| scoring.columnSweepBonus | 150 |
| items.stairRelaxedMinLen(架橋の護符) | 3 |
| items.columnSweepRelaxCards(寛容の護符) | 2 |
| items.maxItems | 5 |
| flow.wavesPerStage | 3 |
| flow.clearDelayMs | 450(目標達成時の演出待ち。全消し・手詰まりは即遷移) |
```

- [ ] **Step 7: `docs/shidasu-roadmap.md`項目2から解消済みの残タスクを削除する**

項目2の残タスク文から「アイテム所持数の上限・入れ替え機能、」の部分を削除する:

変更前:
```
残タスク: 役ボーナス軸のうち同スート・同色・同ランクの緩和/強化アイテム、コンボ軸・全消し軸・詰み救済軸の新規アイテム、「ワンパン軸」(少ない枚数で高得点)という新軸の検討、アイテム所持数の上限・入れ替え機能、ワイルドカードを山札に供給する新規アイテム(現状ワイルドの供給源が無いため、フラッシュ/ロイヤルセット/コンプリートランのワイルド穴埋めルールは実装済みだが未発動)。
```

変更後:
```
残タスク: 役ボーナス軸のうち同スート・同色・同ランクの緩和/強化アイテム、コンボ軸・全消し軸・詰み救済軸の新規アイテム、「ワンパン軸」(少ない枚数で高得点)という新軸の検討、ワイルドカードを山札に供給する新規アイテム(現状ワイルドの供給源が無いため、フラッシュ/ロイヤルセット/コンプリートランのワイルド穴埋めルールは実装済みだが未発動)。護符所持上限(5枚)+入れ替えUIは2026-07-13に実装済み(詳細: `docs/superpowers/specs/2026-07-13-shidasu-wildcard-and-item-cap-design.md`)。
```

- [ ] **Step 8: コミット**

```bash
git add docs/shidasu-current-rules.md docs/shidasu-roadmap.md
git commit -m "$(cat <<'EOF'
docs: Shidasuのワイルドロジック刷新+護符所持上限機能の実装完了に伴いドキュメントを更新
EOF
)"
```

---

## 完了条件(設計書の受け入れ基準との対応)

1. `evaluateChainBonus`の3枚目トリガー → Task 1 Step 1のテスト
2. `wildSuitBonus`/`★同スート`の完全削除 → Task 1 + Task 8 Step 5(grep確認)
3. 同ランクボーナスへのワイルド算入 → Task 2
4. `chainContinuesPattern`のめくった後チェーン基準判定 → Task 3
5. ワイルド draw のパターン未成立時リセット → Task 3
6. 護符5枚時の交換UI → Task 4, 5, 7 + Task 8 Step 3(ブラウザ確認)
7. 5枚未満は即座反映 → Task 5
8. 「取得しない」ボタン → Task 7
9. `npm run test`・`npm run build`成功 → 各タスクのStep 4 + Task 8 Step 1
