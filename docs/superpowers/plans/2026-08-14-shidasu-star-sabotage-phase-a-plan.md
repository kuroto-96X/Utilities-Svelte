# 星の妨害行動 Phase A 実装プラン

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** 既に基盤が動いている星の妨害行動システムに、新規11個の効果(Phase A)を追加する。

**Architecture:** 既存の`SABOTAGE_POOL`・`triggerSabotage`・`activeSeal`の仕組みをそのまま再利用する。新規に必要なのは`activeSeal`への`comboCap`バリアント追加と、それに伴う`playCard`/`drawStock`へのクランプ処理のみ。それ以外の10個は既存パターン(没収・シャッフル・部分効果)をそのまま踏襲する。

**Tech Stack:** SvelteKit, TypeScript, Vitest

**設計書:** `docs/superpowers/specs/2026-08-14-shidasu-star-sabotage-phase-a-design.md`

---

## 全体の前提知識

- `src/lib/game/shidasu/types.ts`: `SabotageActionId`(11個実装済み)、`WaveState.activeSeal`(talisman/rite/revelationOrOracle/role/nullの5種)。
- `src/lib/game/shidasu/sabotage.ts`: `SABOTAGE_POOL`(11件)、`eligibleSabotageIds`、`rollSabotage`。
- `src/lib/game/shidasu/engine.ts`: `triggerSabotage`(11個のswitchケース実装済み、1190行目〜)、`resolveEffectiveItems`(1173行目)、`resolveSealedRoleEffect`(1182行目、`SealedRoleEffect`型は343行目)、`playCard`(369行目)、`drawStock`(718行目)、`applyPlayCard`(1837行目)、`applyDrawStock`(1852行目)、`applyStuckCheck`(1871行目)、`useRite`(1114行目、`applyRiteEffect`・`canUseRite`の使い方の参考)。
- 「山札の上」= 配列の**末尾**。`triggerSabotage`の既存11ケースが最も具体的な実装参考になる。
- テストは`src/lib/game/shidasu/engine.test.ts`の`describe('triggerSabotage', ...)`ブロック(4836行目に`runWithWave`ヘルパーがある)に追記していく。

---

### Task 1: 型定義の拡張(SabotageActionId 11個追加・activeSealにcomboCapバリアント追加)

**Files:**
- Modify: `src/lib/game/shidasu/types.ts`

- [ ] **Step 1: SabotageActionIdに11個追加する**

`src/lib/game/shidasu/types.ts`の`SabotageActionId`定義(8〜11行目)を変更:

```ts
// 妨害行動の識別子。22個実装済み(Phase A: 11個+Phase B先行実装分11個)。
// 詳細はdocs/shidasu/shidasu-star-sabotage-candidates.mdを参照。
export type SabotageActionId =
  | 'stockPurge' | 'columnReturn' | 'chainSettle' | 'comboBreather'
  | 'talismanSeal' | 'riteSeal' | 'revelationOracleSeal' | 'relicConfiscate'
  | 'tableauCardToDiscard' | 'currencyConfiscate' | 'roleSeal'
  | 'stockPurgeSmall' | 'stockShuffle' | 'tableauFullReturn' | 'tableauShuffle'
  | 'chainPartialDiscard' | 'chainShuffle' | 'comboReduce' | 'comboCap'
  | 'talismanConfiscate' | 'riteConfiscate' | 'riteForceActivate'
```

- [ ] **Step 2: WaveState.activeSealにcomboCapバリアントを追加する**

`WaveState`インターフェース内の`activeSeal`定義(286〜291行目)を変更:

```ts
  activeSeal:
    | { kind: 'talisman'; id: ItemId }
    | { kind: 'rite'; id: RiteId }
    | { kind: 'revelationOrOracle'; ref: HeldRevelationOrOracleRef }
    | { kind: 'role'; names: RoleName[] }
    | { kind: 'comboCap'; max: number }
    | null
```

- [ ] **Step 3: ビルド・型チェックが通ることを確認する**

Run: `npm run check`
Expected: `SABOTAGE_POOL`が`SabotageActionId`を網羅していないという型エラーが出る(Task 2で解消するため、ここでは想定通り)。`activeSeal`関連の新規エラーは出ないはず(`comboCap`はまだどこからも参照されていないため無害な型拡張)。

- [ ] **Step 4: コミット**

```bash
git add src/lib/game/shidasu/types.ts
git commit -m "feat: 星の妨害行動Phase A用にSabotageActionIdとactiveSeal(comboCap)を拡張"
```

---

### Task 2: SABOTAGE_POOLに11件追加

**Files:**
- Modify: `src/lib/game/shidasu/sabotage.ts`
- Modify: `src/lib/game/shidasu/sabotage.test.ts`

- [ ] **Step 1: 失敗するテストを更新する**

`src/lib/game/shidasu/sabotage.test.ts`の「11件」を検証しているテストを22件に変更する:

```ts
describe('SABOTAGE_POOL', () => {
  it('22件・ID重複無し・intervalTurnsが全て正の整数', () => {
    expect(SABOTAGE_POOL).toHaveLength(22)
    const ids = SABOTAGE_POOL.map(a => a.id)
    expect(new Set(ids).size).toBe(22)
    for (const action of SABOTAGE_POOL) {
      expect(Number.isInteger(action.intervalTurns)).toBe(true)
      expect(action.intervalTurns).toBeGreaterThan(0)
    }
  })
})
```

(既存の`eligibleSabotageIds`・`rollSabotage`のテストは変更不要。)

- [ ] **Step 2: テストを実行し失敗を確認する**

Run: `npx vitest run src/lib/game/shidasu/sabotage.test.ts`
Expected: FAIL(`SABOTAGE_POOL`がまだ11件のため)

- [ ] **Step 3: SABOTAGE_POOLに11件追加する**

`src/lib/game/shidasu/sabotage.ts`の`SABOTAGE_POOL`配列(14〜26行目)の末尾、`{ id: 'roleSeal', ... },`の直後に追加:

```ts
  { id: 'stockPurgeSmall', name: '少量放出', target: '山札', intervalTurns: 4, descTemplate: '山札の上から2枚を捨て札に置く' },
  { id: 'stockShuffle', name: '山札攪拌', target: '山札', intervalTurns: 5, descTemplate: '山札の順序をランダムに並び替える(枚数は変わらない)' },
  { id: 'tableauFullReturn', name: '総戻し', target: '場札', intervalTurns: 8, descTemplate: '場札全体を山札に戻し、シャッフル後同じ配分で再配布する' },
  { id: 'tableauShuffle', name: '総入れ替え', target: '場札', intervalTurns: 6, descTemplate: '場札の中身を列をまたいでランダムに再配置する(山札には触れない)' },
  { id: 'chainPartialDiscard', name: 'チェーン部分放棄', target: 'チェーン', intervalTurns: 5, descTemplate: 'チェーンの先頭(最古)から2枚を捨て札に送る(コンボはそのまま維持)' },
  { id: 'chainShuffle', name: 'チェーン入れ替え', target: 'チェーン', intervalTurns: 6, descTemplate: 'チェーンをシャッフルし、新しい末尾を基準カードにする' },
  { id: 'comboReduce', name: 'コンボ削減', target: 'コンボ', intervalTurns: 5, descTemplate: 'コンボ数を3減らす(0未満にはしない)' },
  { id: 'comboCap', name: 'コンボ頭打ち', target: 'コンボ', intervalTurns: 6, descTemplate: '発動時点のコンボ数を上限として、次の妨害発動まで増加を止める' },
  { id: 'talismanConfiscate', name: '護符没収', target: '護符', intervalTurns: 7, descTemplate: '所持護符を1つ選び、完全に失わせる' },
  { id: 'riteConfiscate', name: '秘儀没収', target: '秘儀', intervalTurns: 6, descTemplate: '所持秘儀を1つ選び、効果を発動させずに消費させる' },
  { id: 'riteForceActivate', name: '秘儀強制発動', target: '秘儀', intervalTurns: 6, descTemplate: '使用可能な秘儀を1つ選び、即座に効果を発動させて消費する' },
```

- [ ] **Step 4: テストを実行しパスすることを確認する**

Run: `npx vitest run src/lib/game/shidasu/sabotage.test.ts`
Expected: PASS

Run: `npm run check`
Expected: `SABOTAGE_POOL`側のエラーは解消。`triggerSabotage`のswitch文が新しい11個のIDを網羅していないという型エラーが出るはず(Task 3〜7で解消するため、ここでは想定通り)。

- [ ] **Step 5: コミット**

```bash
git add src/lib/game/shidasu/sabotage.ts src/lib/game/shidasu/sabotage.test.ts
git commit -m "feat: 星の妨害行動プールにPhase Aの11個を追加"
```

---

### Task 3: triggerSabotageに8個の単純な効果を追加

**Files:**
- Modify: `src/lib/game/shidasu/engine.ts`
- Test: `src/lib/game/shidasu/engine.test.ts`

対象: `stockPurgeSmall`・`stockShuffle`・`tableauFullReturn`・`tableauShuffle`・`chainPartialDiscard`・`comboReduce`・`talismanConfiscate`・`riteConfiscate`。いずれも既存の11ケース(`stockPurge`・`columnReturn`・`comboBreather`・`relicConfiscate`等)と同型のロジックで、新規のヘルパー関数は不要。

- [ ] **Step 1: 失敗するテストを書く**

`src/lib/game/shidasu/engine.test.ts`の`describe('triggerSabotage', ...)`ブロック内(既存の`it('roleSeal: ...', ...)`テストの直後)に追記(`runWithWave`は同ブロック内の既存ヘルパーをそのまま使う):

```ts
  it('stockPurgeSmall: 山札の上から2枚を捨て札に置く', () => {
    const run = runWithWave()
    const stockBefore = run.wave!.stock.length
    const next = triggerSabotage(DEFAULT_PARAMS, run, 'stockPurgeSmall', () => 0)
    expect(next.wave!.stock.length).toBe(stockBefore - 2)
    expect(next.wave!.discardPile.length).toBe(2)
  })

  it('stockShuffle: 山札の枚数は変わらない', () => {
    const run = runWithWave()
    const stockBefore = run.wave!.stock.length
    const next = triggerSabotage(DEFAULT_PARAMS, run, 'stockShuffle', () => 0)
    expect(next.wave!.stock.length).toBe(stockBefore)
  })

  it('tableauFullReturn: 場札の各列の枚数は変わらず、山札の総数(山札+場札)も変わらない', () => {
    const run = runWithWave()
    const colLengthsBefore = run.wave!.tableau.map(c => c.length)
    const totalBefore = run.wave!.stock.length + run.wave!.tableau.flat().length
    const next = triggerSabotage(DEFAULT_PARAMS, run, 'tableauFullReturn', () => 0)
    expect(next.wave!.tableau.map(c => c.length)).toEqual(colLengthsBefore)
    expect(next.wave!.stock.length + next.wave!.tableau.flat().length).toBe(totalBefore)
  })

  it('tableauShuffle: 場札の各列の枚数は変わらず、山札の枚数も変わらない', () => {
    const run = runWithWave()
    const colLengthsBefore = run.wave!.tableau.map(c => c.length)
    const stockBefore = run.wave!.stock.length
    const next = triggerSabotage(DEFAULT_PARAMS, run, 'tableauShuffle', () => 0)
    expect(next.wave!.tableau.map(c => c.length)).toEqual(colLengthsBefore)
    expect(next.wave!.stock.length).toBe(stockBefore)
  })

  it('chainPartialDiscard: チェーン先頭から2枚が捨て札に送られ、コンボは維持される', () => {
    const run = runWithWave({}, {
      combo: 3,
      chain: [
        { id: 1, deckId: 1, suit: '♠', rank: 1, wild: false },
        { id: 2, deckId: 2, suit: '♠', rank: 2, wild: false },
        { id: 3, deckId: 3, suit: '♠', rank: 3, wild: false },
      ],
      chainOrigin: ['draw', 'play', 'play'],
    })
    const next = triggerSabotage(DEFAULT_PARAMS, run, 'chainPartialDiscard', () => 0)
    expect(next.wave!.chain).toHaveLength(1)
    expect(next.wave!.chain[0].id).toBe(3)
    expect(next.wave!.discardPile).toHaveLength(2)
    expect(next.wave!.combo).toBe(3)
  })

  it('chainPartialDiscard: チェーンが1枚以下なら基準カードは残す(何も削れない)', () => {
    const run = runWithWave({}, { chain: [{ id: 1, deckId: 1, suit: '♠', rank: 1, wild: false }], chainOrigin: ['draw'] })
    const next = triggerSabotage(DEFAULT_PARAMS, run, 'chainPartialDiscard', () => 0)
    expect(next.wave!.chain).toHaveLength(1)
    expect(next.wave!.discardPile).toHaveLength(0)
  })

  it('comboReduce: コンボ数を3減らす(0未満にしない)', () => {
    const run = runWithWave({}, { combo: 5 })
    const next = triggerSabotage(DEFAULT_PARAMS, run, 'comboReduce', () => 0)
    expect(next.wave!.combo).toBe(2)
    const runLow = runWithWave({}, { combo: 1 })
    const nextLow = triggerSabotage(DEFAULT_PARAMS, runLow, 'comboReduce', () => 0)
    expect(nextLow.wave!.combo).toBe(0)
  })

  it('talismanConfiscate: 所持護符からランダムに1つ選び完全に失う', () => {
    const run = runWithWave({ items: ['bridge', 'grace'] })
    const next = triggerSabotage(DEFAULT_PARAMS, run, 'talismanConfiscate', () => 0)
    expect(next.items).toEqual(['grace'])
  })

  it('riteConfiscate: 所持秘儀からランダムに1つ選び効果無しで消費する', () => {
    const run = runWithWave({ rites: ['gebo', 'fehu'] })
    const next = triggerSabotage(DEFAULT_PARAMS, run, 'riteConfiscate', () => 0)
    expect(next.rites).toEqual(['fehu'])
  })
```

- [ ] **Step 2: テストを実行し失敗を確認する**

Run: `npx vitest run src/lib/game/shidasu/engine.test.ts -t "stockPurgeSmall|stockShuffle|tableauFullReturn|tableauShuffle|chainPartialDiscard|comboReduce|talismanConfiscate|riteConfiscate"`
Expected: FAIL(`triggerSabotage`のswitchに該当ケースが無い)

- [ ] **Step 3: triggerSabotageに8個のケースを追加する**

`src/lib/game/shidasu/engine.ts`の`triggerSabotage`関数内、`switch (id) { ... }`の`case 'roleSeal': { ... }`ブロック(既存の最後のケース)の直後に追加:

```ts
    case 'stockPurgeSmall': {
      const n = Math.min(2, wave.stock.length)
      const purged = wave.stock.slice(wave.stock.length - n)
      nextWave = { ...nextWave, stock: wave.stock.slice(0, wave.stock.length - n), discardPile: [...wave.discardPile, ...purged] }
      break
    }
    case 'stockShuffle': {
      const stock = [...wave.stock]
      shuffleInPlace(stock, rand)
      nextWave = { ...nextWave, stock }
      break
    }
    case 'tableauFullReturn': {
      const counts = wave.tableau.map(col => col.length)
      const pool = [...wave.stock, ...wave.tableau.flat()]
      shuffleInPlace(pool, rand)
      let cursor = 0
      const tableau = counts.map(n => {
        const slice = pool.slice(cursor, cursor + n)
        cursor += n
        return slice
      })
      nextWave = { ...nextWave, tableau, stock: pool.slice(cursor) }
      break
    }
    case 'tableauShuffle': {
      const counts = wave.tableau.map(col => col.length)
      const pool = wave.tableau.flat()
      shuffleInPlace(pool, rand)
      let cursor = 0
      const tableau = counts.map(n => {
        const slice = pool.slice(cursor, cursor + n)
        cursor += n
        return slice
      })
      nextWave = { ...nextWave, tableau }
      break
    }
    case 'chainPartialDiscard': {
      const removeCount = Math.min(2, Math.max(0, wave.chain.length - 1))
      const removed = wave.chain.slice(0, removeCount)
      nextWave = {
        ...nextWave,
        chain: wave.chain.slice(removeCount),
        chainOrigin: wave.chainOrigin.slice(removeCount),
        discardPile: [...wave.discardPile, ...removed],
      }
      break
    }
    case 'comboReduce': {
      nextWave = { ...nextWave, combo: Math.max(0, wave.combo - 3) }
      break
    }
    case 'talismanConfiscate': {
      if (run.items.length > 0) {
        const idx = Math.floor(rand() * run.items.length)
        nextRun = { ...nextRun, items: [...run.items.slice(0, idx), ...run.items.slice(idx + 1)] }
      }
      break
    }
    case 'riteConfiscate': {
      if (run.rites.length > 0) {
        const idx = Math.floor(rand() * run.rites.length)
        nextRun = { ...nextRun, rites: [...run.rites.slice(0, idx), ...run.rites.slice(idx + 1)] }
      }
      break
    }
```

- [ ] **Step 4: テストを実行しパスすることを確認する**

Run: `npx vitest run src/lib/game/shidasu/engine.test.ts -t "stockPurgeSmall|stockShuffle|tableauFullReturn|tableauShuffle|chainPartialDiscard|comboReduce|talismanConfiscate|riteConfiscate"`
Expected: PASS(9 tests)

Run: `npm run check`
Expected: まだ`chainShuffle`・`comboCap`・`riteForceActivate`の3ケースが未実装のため型エラーが残る(Task 4〜7で解消)

- [ ] **Step 5: コミット**

```bash
git add src/lib/game/shidasu/engine.ts src/lib/game/shidasu/engine.test.ts
git commit -m "feat: triggerSabotageに山札・場札・チェーン・コンボ・護符・秘儀の単純な妨害8個を追加"
```

---

### Task 4: chainShuffle実装

**Files:**
- Modify: `src/lib/game/shidasu/engine.ts`
- Test: `src/lib/game/shidasu/engine.test.ts`

- [ ] **Step 1: 失敗するテストを書く**

`src/lib/game/shidasu/engine.test.ts`冒頭の型import行(72行目、`import type { Card, WaveState, RunState, ItemId, ShopIndividualSlot, Star, StarRestriction, RoleName } from './types'`)に`ChainCardOrigin`を追加する:

```ts
import type { Card, WaveState, RunState, ItemId, ShopIndividualSlot, Star, StarRestriction, RoleName, ChainCardOrigin } from './types'
```

`describe('triggerSabotage', ...)`ブロック内に追記:

```ts
  it('chainShuffle: チェーンがシャッフルされ、新しい末尾が基準カードになる', () => {
    const chain: Card[] = [
      { id: 1, deckId: 1, suit: '♠', rank: 1, wild: false },
      { id: 2, deckId: 2, suit: '♥', rank: 2, wild: false },
      { id: 3, deckId: 3, suit: '♦', rank: 3, wild: false },
    ]
    const chainOrigin: ChainCardOrigin[] = ['draw', 'play', 'play']
    const run = runWithWave({}, { chain, chainOrigin, foundation: chain[2] })
    // randを固定値にし、shuffleInPlace(Fisher-Yates)で並びが反転するようにする
    let call = 0
    const rand = () => {
      const values = [0, 0, 0]
      return values[call++] ?? 0
    }
    const next = triggerSabotage(DEFAULT_PARAMS, run, 'chainShuffle', rand)
    expect(next.wave!.chain).toHaveLength(3)
    expect(next.wave!.chainOrigin).toHaveLength(3)
    // シャッフル後の末尾が新しい基準カードになっていること
    const newLast = next.wave!.chain[next.wave!.chain.length - 1]
    expect(next.wave!.foundation.id).toBe(newLast.id)
    // 3枚とも欠落・重複無く残っていること
    expect(next.wave!.chain.map(c => c.id).sort()).toEqual([1, 2, 3])
  })

  it('chainShuffle: チェーンが1枚だけなら基準カードは変わらない', () => {
    const chain: Card[] = [{ id: 1, deckId: 1, suit: '♠', rank: 1, wild: false }]
    const run = runWithWave({}, { chain, chainOrigin: ['draw'], foundation: chain[0] })
    const next = triggerSabotage(DEFAULT_PARAMS, run, 'chainShuffle', () => 0)
    expect(next.wave!.foundation.id).toBe(1)
  })
```

- [ ] **Step 2: テストを実行し失敗を確認する**

Run: `npx vitest run src/lib/game/shidasu/engine.test.ts -t "chainShuffle"`
Expected: FAIL(`triggerSabotage`に`chainShuffle`ケースが無い)

- [ ] **Step 3: chainShuffleケースを追加する**

`src/lib/game/shidasu/engine.ts`の`triggerSabotage`関数内、Task 3で追加した`case 'riteConfiscate': { ... }`の直後に追加:

```ts
    case 'chainShuffle': {
      const indices = wave.chain.map((_c, i) => i)
      shuffleInPlace(indices, rand)
      const chain = indices.map(i => wave.chain[i])
      const chainOrigin = indices.map(i => wave.chainOrigin[i])
      nextWave = { ...nextWave, chain, chainOrigin, foundation: chain[chain.length - 1] }
      break
    }
```

(`chain`と`chainOrigin`のインデックス対応を保ったまま同じ並び替えを適用するため、配列そのものではなくインデックス配列をシャッフルしてから両方に適用する。)

- [ ] **Step 4: テストを実行しパスすることを確認する**

Run: `npx vitest run src/lib/game/shidasu/engine.test.ts -t "chainShuffle"`
Expected: PASS(2 tests)

Run: `npm run check`
Expected: `comboCap`・`riteForceActivate`の2ケースのみ未実装で型エラーが残る

- [ ] **Step 5: コミット**

```bash
git add src/lib/game/shidasu/engine.ts src/lib/game/shidasu/engine.test.ts
git commit -m "feat: triggerSabotageにチェーン入れ替え(chainShuffle)を追加"
```

---

### Task 5: comboCap基盤の実装(playCard・drawStockへのクランプ処理統合)

**Files:**
- Modify: `src/lib/game/shidasu/engine.ts`
- Test: `src/lib/game/shidasu/engine.test.ts`

- [ ] **Step 1: 失敗するテストを書く**

`src/lib/game/shidasu/engine.test.ts`の`describe('triggerSabotage', ...)`ブロックとは別に、既存の`describe('妨害の発動トリガー統合(applyPlayCard)', ...)`ブロック(Task 7時代に作成済み)の末尾に追記:

```ts
  it('comboCap: activeSealがcomboCapのとき、playCardでコンボがcapを超えて増加しない', () => {
    let run = createInitialRun()
    const { wave } = startWave(DEFAULT_PARAMS, 0, 0, run.items, run.deckComposition, 1, 0, defaultOracleLevels())
    run = { ...run, phase: 'playing', wave: { ...wave, combo: 3, activeSeal: { kind: 'comboCap', max: 3 } } }
    const playableCol = run.wave!.tableau.findIndex(col => col.length > 0 && isPlayable('none', run.wave!, col[col.length - 1], []))
    if (playableCol === -1) return // 稀に無ければスキップ(deal構成による)
    const next = applyPlayCard(DEFAULT_PARAMS, run, playableCol, () => 0.5)
    expect(next.wave!.combo).toBeLessThanOrEqual(3)
  })
```

`src/lib/game/shidasu/engine.ts`のエクスポート関数を直接呼ぶ形の単体テストも`describe('triggerSabotage', ...)`ブロックの直前あたりに追加(`playCard`・`drawStock`が新しい`comboCap`引数を受け取れることを検証):

```ts
describe('comboCapのplayCard/drawStockへのクランプ', () => {
  it('playCard: comboCapを渡すと、コンボが上限でクランプされる', () => {
    const { wave } = startWave(DEFAULT_PARAMS, 0, 0, [], standardDeckComposition(), 1, 0, defaultOracleLevels())
    const seeded = { ...wave, combo: 3 }
    const playableCol = seeded.tableau.findIndex(col => col.length > 0 && isPlayable('none', seeded, col[col.length - 1], []))
    if (playableCol === -1) return
    const { wave: next } = playCard(DEFAULT_PARAMS, seeded, 'none', [], 1000000, playableCol, standardDeckComposition(), () => 0.5, null, undefined, { zeroRoles: [], oracleBaselineRole: null }, 3)
    expect(next.combo).toBeLessThanOrEqual(3)
  })

  it('playCard: comboCapがnullなら通常通り増加する', () => {
    const { wave } = startWave(DEFAULT_PARAMS, 0, 0, [], standardDeckComposition(), 1, 0, defaultOracleLevels())
    const seeded = { ...wave, combo: 3 }
    const playableCol = seeded.tableau.findIndex(col => col.length > 0 && isPlayable('none', seeded, col[col.length - 1], []))
    if (playableCol === -1) return
    const { wave: next } = playCard(DEFAULT_PARAMS, seeded, 'none', [], 1000000, playableCol, standardDeckComposition(), () => 0.5)
    expect(next.combo).toBe(4)
  })
})
```

- [ ] **Step 2: テストを実行し失敗を確認する**

Run: `npx vitest run src/lib/game/shidasu/engine.test.ts -t "comboCap"`
Expected: FAIL(`playCard`が12番目の引数`comboCap`を受け付けない、`applyPlayCard`が`activeSeal.kind === 'comboCap'`を見ていない)

- [ ] **Step 3: playCard・drawStockにcomboCap引数を追加し、クランプ処理を実装する**

`src/lib/game/shidasu/engine.ts`の`playCard`シグネチャ(369〜381行目)の末尾に引数を追加:

```ts
export function playCard(
  params: ShidasuParams,
  wave: WaveState,
  modifier: StageModifier,
  items: ItemId[],
  target: number,
  colIndex: number,
  deckComposition: DeckCard[],
  rand: () => number = Math.random,
  scoreLock: BossScoreLock = null,
  rowIndex?: number,
  sealedRoleEffect: SealedRoleEffect = { zeroRoles: [], oracleBaselineRole: null },
  comboCap: number | null = null
): { wave: WaveState; deckComposition: DeckCard[] } {
```

`playCard`内の`newCombo`計算(394行目)を変更:

```ts
  // 黄金: 通常のコンボ加算処理そのものを+1ではなく+2にする(他の護符には無干渉)
  // イサ(凍結)発動中は加算自体を行わない。コンボ頭打ち(妨害)発動中はcomboCapで上限クランプする
  const newCombo = Math.min(
    comboCap ?? Infinity,
    wave.comboFrozenThisWave ? wave.combo : wave.combo + (items.includes('golden') ? 2 : 1)
  )
```

`drawStock`シグネチャ(718〜728行目)の末尾に同じ引数を追加:

```ts
export function drawStock(
  params: ShidasuParams,
  wave: WaveState,
  items: ItemId[],
  target: number,
  deckComposition: DeckCard[],
  modifier: StageModifier = 'none',
  rand: () => number = Math.random,
  scoreLock: BossScoreLock = null,
  sealedRoleEffect: SealedRoleEffect = { zeroRoles: [], oracleBaselineRole: null },
  comboCap: number | null = null
): { wave: WaveState; deckComposition: DeckCard[] } {
```

`drawStock`内の`naiveCombo`初期値(753行目)を変更:

```ts
    let naiveCombo = Math.min(comboCap ?? Infinity, wave.combo + sincerityAdd)
```

`drawStock`内、naive分岐の`newCombo`計算(757行目)を変更:

```ts
      const newCombo = Math.min(
        comboCap ?? Infinity,
        wave.comboFrozenThisWave ? wave.combo : wave.combo + (items.includes('golden') ? 2 : 1)
      )
```

`drawStock`内、naive分岐末尾の`naiveCombo`再代入(819行目)を変更:

```ts
      naiveCombo = Math.min(comboCap ?? Infinity, newCombo + sincerityAdd)
```

- [ ] **Step 4: resolveComboCapヘルパーを追加し、applyPlayCard/applyDrawStock/applyStuckCheckへ統合する**

`src/lib/game/shidasu/engine.ts`の`resolveSealedRoleEffect`関数(1182〜1186行目)の直後に追加:

```ts
// wave.activeSealがcomboCap封印の場合、上限値を返す。それ以外はnull(上限無し)。
// applyPlayCard/applyDrawStock/applyStuckCheckからplayCard/drawStockへ渡す。
export function resolveComboCap(activeSeal: WaveState['activeSeal']): number | null {
  return activeSeal?.kind === 'comboCap' ? activeSeal.max : null
}
```

`applyPlayCard`関数(1837〜1850行目)を変更:

```ts
export function applyPlayCard(params: ShidasuParams, run: RunState, colIndex: number, rand: () => number = Math.random, rowIndex?: number): RunState {
  if (run.phase !== 'playing' || !run.wave) return run
  const target = waveTarget(params, run.stageIndex, run.waveIndex, run.stageStars)
  const modifier = stageModifierFor(params, run)
  const scoreLock = bossScoreLockFor(params, run)
  const effectiveItems = resolveEffectiveItems(run.items, run.wave.activeSeal)
  const sealedRoleEffect = resolveSealedRoleEffect(run.wave.activeSeal)
  const comboCap = resolveComboCap(run.wave.activeSeal)
  const { wave, deckComposition } = playCard(params, run.wave, modifier, effectiveItems, target, colIndex, run.deckComposition, rand, scoreLock, rowIndex, sealedRoleEffect, comboCap)
  let next: RunState = { ...run, wave, deckComposition }
  if (wave.pendingSabotageId && wave.sabotageTurnsRemaining <= 0) {
    next = triggerSabotage(params, next, wave.pendingSabotageId, rand)
  }
  return next
}
```

`applyDrawStock`関数(1852〜1865行目)を変更:

```ts
export function applyDrawStock(params: ShidasuParams, run: RunState, rand: () => number = Math.random): RunState {
  if (run.phase !== 'playing' || !run.wave) return run
  const target = waveTarget(params, run.stageIndex, run.waveIndex, run.stageStars)
  const modifier = stageModifierFor(params, run)
  const scoreLock = bossScoreLockFor(params, run)
  const effectiveItems = resolveEffectiveItems(run.items, run.wave.activeSeal)
  const sealedRoleEffect = resolveSealedRoleEffect(run.wave.activeSeal)
  const comboCap = resolveComboCap(run.wave.activeSeal)
  const { wave, deckComposition } = drawStock(params, run.wave, effectiveItems, target, run.deckComposition, modifier, rand, scoreLock, sealedRoleEffect, comboCap)
  let next: RunState = { ...run, wave, deckComposition }
  if (wave.pendingSabotageId && wave.sabotageTurnsRemaining <= 0) {
    next = triggerSabotage(params, next, wave.pendingSabotageId, rand)
  }
  return next
}
```

`applyStuckCheck`関数内、`if (resetWave.stock.length > 0) { ... }`ブロック(1898〜1909行目)を変更:

```ts
  if (resetWave.stock.length > 0) {
    const stageTarget = waveTarget(params, run.stageIndex, run.waveIndex, run.stageStars)
    const scoreLock = bossScoreLockFor(params, run)
    const effectiveItems = resolveEffectiveItems(run.items, resetWave.activeSeal)
    const sealedRoleEffect = resolveSealedRoleEffect(resetWave.activeSeal)
    const comboCap = resolveComboCap(resetWave.activeSeal)
    const drawResult = drawStock(params, resetWave, effectiveItems, stageTarget, run.deckComposition, modifier, rand, scoreLock, sealedRoleEffect, comboCap)
    let next: RunState = { ...run, wave: drawResult.wave, deckComposition: drawResult.deckComposition }
    if (drawResult.wave.pendingSabotageId && drawResult.wave.sabotageTurnsRemaining <= 0) {
      next = triggerSabotage(params, next, drawResult.wave.pendingSabotageId, rand)
    }
    return next
  }
```

- [ ] **Step 5: テストを実行しパスすることを確認する**

Run: `npx vitest run src/lib/game/shidasu/engine.test.ts -t "comboCap"`
Expected: PASS(3 tests)

Run: `npx vitest run src/lib/game/shidasu/engine.test.ts`
Expected: 既存テスト含め全てPASS(新しい引数はデフォルト値で補われるため既存呼び出しは変更不要のはず)

Run: `npm run check`
Expected: `comboCap`・`riteForceActivate`ケース自体はまだswitchに無いため、`triggerSabotage`の網羅性エラーは`riteForceActivate`分だけ残る(Task 6で`comboCap`のswitchケースを追加するまで、`comboCap`分のエラーも残る)

- [ ] **Step 6: コミット**

```bash
git add src/lib/game/shidasu/engine.ts src/lib/game/shidasu/engine.test.ts
git commit -m "feat: playCard/drawStockにcomboCapによるコンボ上限クランプを実装"
```

---

### Task 6: comboCapのtriggerSabotageケース追加

**Files:**
- Modify: `src/lib/game/shidasu/engine.ts`
- Test: `src/lib/game/shidasu/engine.test.ts`

- [ ] **Step 1: 失敗するテストを書く**

`describe('triggerSabotage', ...)`ブロック内に追記:

```ts
  it('comboCap: 発動時点のコンボ数を上限としてactiveSealに設定する', () => {
    const run = runWithWave({}, { combo: 4 })
    const next = triggerSabotage(DEFAULT_PARAMS, run, 'comboCap', () => 0)
    expect(next.wave!.activeSeal).toEqual({ kind: 'comboCap', max: 4 })
    expect(next.wave!.combo).toBe(4)
  })
```

- [ ] **Step 2: テストを実行し失敗を確認する**

Run: `npx vitest run src/lib/game/shidasu/engine.test.ts -t "comboCap: 発動時点"`
Expected: FAIL(`triggerSabotage`に`comboCap`ケースが無い)

- [ ] **Step 3: comboCapケースを追加する**

`src/lib/game/shidasu/engine.ts`の`triggerSabotage`関数内、Task 4で追加した`case 'chainShuffle': { ... }`の直後に追加:

```ts
    case 'comboCap': {
      nextWave = { ...nextWave, activeSeal: { kind: 'comboCap', max: wave.combo } }
      break
    }
```

- [ ] **Step 4: テストを実行しパスすることを確認する**

Run: `npx vitest run src/lib/game/shidasu/engine.test.ts -t "comboCap: 発動時点"`
Expected: PASS

Run: `npm run check`
Expected: `riteForceActivate`ケースのみ未実装で型エラーが残る

- [ ] **Step 5: コミット**

```bash
git add src/lib/game/shidasu/engine.ts src/lib/game/shidasu/engine.test.ts
git commit -m "feat: triggerSabotageにコンボ頭打ち(comboCap)を追加"
```

---

### Task 7: riteForceActivate実装

**Files:**
- Modify: `src/lib/game/shidasu/engine.ts`
- Test: `src/lib/game/shidasu/engine.test.ts`

- [ ] **Step 1: 失敗するテストを書く**

`describe('triggerSabotage', ...)`ブロック内に追記(`raidho`は「場札の非絵札・非ワイルドを山札と入れ替える」秘儀。既存の`riteEffects.test.ts`を参考に、盤面に対象カードがあれば必ず何か変化する秘儀として使う):

```ts
  it('riteForceActivate: 使用可能な秘儀からランダムに1つ選び即座に発動して消費する', () => {
    const run = runWithWave({ rites: ['raidho'] })
    // raidhoは場札に非絵札・非ワイルドがあれば常にcanUseRiteを満たす(dealされた標準デッキなら通常存在する)
    const next = triggerSabotage(DEFAULT_PARAMS, run, 'riteForceActivate', () => 0)
    expect(next.rites).toEqual([])
  })

  it('riteForceActivate: 使用可能な秘儀が無ければ何も起きない', () => {
    const run = runWithWave({ rites: [] })
    const next = triggerSabotage(DEFAULT_PARAMS, run, 'riteForceActivate', () => 0)
    expect(next.rites).toEqual([])
    expect(next.wave!.activeSeal).toBeNull()
  })
```

- [ ] **Step 2: テストを実行し失敗を確認する**

Run: `npx vitest run src/lib/game/shidasu/engine.test.ts -t "riteForceActivate"`
Expected: FAIL(`triggerSabotage`に`riteForceActivate`ケースが無い)

- [ ] **Step 3: riteForceActivateケースを追加する**

`src/lib/game/shidasu/engine.ts`の`triggerSabotage`関数内、Task 6で追加した`case 'comboCap': { ... }`の直後に追加:

```ts
    case 'riteForceActivate': {
      const usable = run.rites.filter(riteId => canUseRite(params, wave, riteId))
      if (usable.length > 0) {
        const target = usable[Math.floor(rand() * usable.length)]
        const activatedWave = applyRiteEffect(params, wave, target, rand)
        const idx = run.rites.indexOf(target)
        nextWave = { ...activatedWave, activeSeal: null }
        nextRun = { ...nextRun, rites: [...run.rites.slice(0, idx), ...run.rites.slice(idx + 1)] }
      }
      break
    }
```

(`applyRiteEffect`は既存の`useRite`実装(1114〜1126行目)と同じ関数。ここでは`useRite`と異なり果断・星霜の加算(`discretion`・`frost`)や`recentUsedRiteIds`の更新は行わない — 妨害由来の強制発動であり、プレイヤーの能動的な秘儀使用としては扱わないため、設計書の方針通り。`nextWave = { ...activatedWave, activeSeal: null }`としているのは、`activatedWave`が`wave`(まだ`activeSeal`がリセットされる前の元の状態)を素に`applyRiteEffect`が生成した新しいWaveStateであり、`nextWave`が既に持っていた`activeSeal: null`のリセットを上書きしてしまわないようにするため。)

- [ ] **Step 4: テストを実行しパスすることを確認する**

Run: `npx vitest run src/lib/game/shidasu/engine.test.ts -t "riteForceActivate"`
Expected: PASS(2 tests)

Run: `npx vitest run src/lib/game/shidasu/engine.test.ts`
Expected: 全てPASS

Run: `npm run check`
Expected: エラー無し(`triggerSabotage`のswitchが`SabotageActionId`22種全てを網羅した)

- [ ] **Step 5: コミット**

```bash
git add src/lib/game/shidasu/engine.ts src/lib/game/shidasu/engine.test.ts
git commit -m "feat: triggerSabotageに秘儀強制発動(riteForceActivate)を追加"
```

---

### Task 8: 最終確認・ドキュメント更新

**Files:**
- Modify: `docs/shidasu/shidasu-current-rules.md`
- Modify: `docs/shidasu/shidasu-roadmap.md`(必要なら)

- [ ] **Step 1: ビルド・型チェック・全テストを確認する**

Run: `npm run build`
Run: `npm run check`
Run: `npx vitest run`
Expected: 全てエラー無し・全テストPASS(このリポジトリにはshidasuと無関係な既存エラー約55件があるが、対象外)

- [ ] **Step 2: 開発サーバーで実際にプレイし、新規11個が発動することを確認する**

Run: `npm run dev`

`/admin/shidasu-debug`等を使い、護符・秘儀を所持した状態でWave3まで進め、少なくとも数回妨害を発生させて以下を確認する:
- 山札・場札・チェーン・コンボ系の新規妨害(少量放出・山札攪拌・総戻し・総入れ替え・チェーン部分放棄・チェーン入れ替え・コンボ削減・コンボ頭打ち)でゲーム状態が説明通り変化すること。特にコンボ頭打ちは、発動後にプレイを重ねてもコンボ表示が上限を超えないことを確認する。
- 護符没収・秘儀没収で対象が完全に失われ、所持表示からも消えること。
- 秘儀強制発動で、所持秘儀のいずれかが自動的に使用され(効果が場に反映され)、所持から消えることを確認する。

**注意**: 実プレイで狙った妨害を全て発生させるには運が絡み時間がかかることがある。目視確認は`wave.pendingSabotageId`・`sabotageTurnsRemaining`をブラウザのdevtoolsコンソール経由で強制指定するか、`triggerSabotage`を一時的に直接呼べるデバッグフックを仕込んで確認し、確認後に差分ゼロへ戻す方式でよい(過去タスクで実績のある方式)。

- [ ] **Step 3: ドキュメント更新**

`docs/shidasu/shidasu-current-rules.md`の「6.1 星の妨害行動」の効果一覧表に、新規11個の行を追加する(id・ターゲット・intervalTurns・効果を`SABOTAGE_POOL`の内容と一致させる)。表の直前や節内の文言に「11個実装済み」等の件数言及があれば、22個に更新する。

`docs/shidasu/shidasu-star-sabotage-candidates.md`の「レリック封印」の項目(捨て札→レリックのセクション、「- **レリック封印**: 所持レリックを1つランダムに選び、次の妨害発動まで効果を無効化する(付喪化状態は維持)」の行)の末尾に、次の一文を追記する: 「(2026-08-14、レリックの効果はゲームプレイに直接影響しないため一時封印しても体感できる変化が薄いという理由で不採用とした。詳細はdocs/superpowers/specs/2026-08-14-shidasu-star-sabotage-phase-a-design.mdを参照。)」

- [ ] **Step 4: 最終コミット**

```bash
git add docs/shidasu/shidasu-current-rules.md docs/shidasu/shidasu-star-sabotage-candidates.md
git commit -m "docs: 星の妨害行動Phase Aの実装完了をドキュメントに反映"
```

---

## スコープ外(このプランでは扱わない)

- Phase B(残り10個: 護符並び替え・天啓/神託没収・天啓/神託強制発動・付喪化解除・捨て札消去・捨て札埋没・報酬減少・通貨強制消費・役減衰・役偏重)の実装
- UIへの追加表示(既存の「次の妨害: {name}(あとNターン)」表示をそのまま使う)
- `intervalTurns`・効果の数値バランス調整
