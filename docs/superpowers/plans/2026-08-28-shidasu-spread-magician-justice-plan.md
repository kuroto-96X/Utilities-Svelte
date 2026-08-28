# 新規スプレッド「魔術師」・「正義」 Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** 新規スプレッド「魔術師」(`magician`、護符所持スロット+1・場札-1行)・「正義」(`justice`、初期デッキからJQK除外)を追加する。

**Architecture:** `SpreadConfig`に`initialItemCapacityBonus: number`・`excludedRanks: Rank[]`の2フィールドを新設する。魔術師の効果は`itemMaxCapacity`(`relics.ts`)にスプレッドボーナスを加算する形で実装し、正義の効果は`beginRun`(`engine.ts`)で初期デッキの該当ランクを`removed: true`にする形で実装する。`/admin/shidasu-spreads`にも編集用の列を追加する。

**Tech Stack:** TypeScript, SvelteKit, Vitest

---

### Task 1: `SpreadId`型・`SpreadConfig`型の拡張と`SPREAD_IDS`・`DEFAULT_PARAMS`・`shidasu.config.json`の更新

**Files:**
- Modify: `src/lib/game/shidasu/types.ts:24-43` (`SpreadId`型・`SpreadConfig`型)
- Modify: `src/lib/game/shidasu/params.ts:340-345` (`DEFAULT_PARAMS.spreads`)
- Modify: `src/lib/game/shidasu/params.ts:632` (`SPREAD_IDS`)
- Modify: `src/lib/game/shidasu/shidasu.config.json:109-150` (`spreads`)
- Test: `src/lib/game/shidasu/params.test.ts`

- [ ] **Step 1: 失敗するテストを書く**

`src/lib/game/shidasu/params.test.ts`の末尾(既存の`describe`ブロック内、直近に追加された女帝関連テストの直後)に、以下のテストを追加する。既存のテストファイルを開いて、女帝の`initialCurrencyBonus`をアサートしているテストブロックを探し、その直後に追記すること。

```ts
  test('fool/moon/pope/empressのinitialItemCapacityBonusは0、excludedRanksは空配列', () => {
    expect(DEFAULT_PARAMS.spreads.fool.initialItemCapacityBonus).toBe(0)
    expect(DEFAULT_PARAMS.spreads.fool.excludedRanks).toEqual([])
    expect(DEFAULT_PARAMS.spreads.moon.initialItemCapacityBonus).toBe(0)
    expect(DEFAULT_PARAMS.spreads.moon.excludedRanks).toEqual([])
    expect(DEFAULT_PARAMS.spreads.pope.initialItemCapacityBonus).toBe(0)
    expect(DEFAULT_PARAMS.spreads.pope.excludedRanks).toEqual([])
    expect(DEFAULT_PARAMS.spreads.empress.initialItemCapacityBonus).toBe(0)
    expect(DEFAULT_PARAMS.spreads.empress.excludedRanks).toEqual([])
  })

  test('magicianの名称は魔術師、initialItemCapacityBonusは1、initialExtraTableauRowsは-1', () => {
    expect(DEFAULT_PARAMS.spreads.magician.name).toBe('魔術師')
    expect(DEFAULT_PARAMS.spreads.magician.initialItemCapacityBonus).toBe(1)
    expect(DEFAULT_PARAMS.spreads.magician.initialExtraTableauRows).toBe(-1)
    expect(DEFAULT_PARAMS.spreads.magician.excludedRanks).toEqual([])
  })

  test('justiceの名称は正義、excludedRanksは[11, 12, 13]', () => {
    expect(DEFAULT_PARAMS.spreads.justice.name).toBe('正義')
    expect(DEFAULT_PARAMS.spreads.justice.excludedRanks).toEqual([11, 12, 13])
    expect(DEFAULT_PARAMS.spreads.justice.initialItemCapacityBonus).toBe(0)
    expect(DEFAULT_PARAMS.spreads.justice.initialExtraTableauRows).toBe(0)
  })
```

- [ ] **Step 2: テストが失敗することを確認する**

Run: `npm test -- params.test.ts`
Expected: FAIL — `DEFAULT_PARAMS.spreads.magician`/`.justice`が`undefined`、または`initialItemCapacityBonus`/`excludedRanks`プロパティが存在しない

- [ ] **Step 3: `types.ts`の`SpreadId`型・`SpreadConfig`型を変更する**

`src/lib/game/shidasu/types.ts`の現在の内容(24-43行目):

```ts
// スプレッド: ラン開始時にプレイヤーが選ぶ固有ルールセット。大アルカナから命名する。
// fool(愚者)=特殊ルールなしの基本スプレッド、moon(月)=場札が常に1行少ない状態で始まる、
// pope(教皇)=神託の初期レベルが上がるが、ショップで神託が販売されない、
// empress(女帝)=初期所持金が多い状態で始まる
export type SpreadId = 'fool' | 'moon' | 'pope' | 'empress'
// スプレッドごとの固有ルール設定。
export interface SpreadConfig {
  name: string
  desc: string
  // ウェーブ開始時の配布行数への初期オフセット(既存)。
  initialExtraTableauRows: number
  waveTargetBase: number
  waveTargetMultiplier: number
  // 神託(oracle)の初期レベル。ラン開始時、全10役一律にこの値でoracleLevelsを初期化する(既定1)。
  initialOracleLevel: number
  // ショップのバラ売り枠・福袋カタログの両方から除外する種別(既定は空配列=制限なし)。
  bannedShopKinds: ShopSlotKind[]
  // 初期所持金(currency.initialAmount)へのオフセット(既定0)。
  initialCurrencyBonus: number
}
```

これを以下に変更する:

```ts
// スプレッド: ラン開始時にプレイヤーが選ぶ固有ルールセット。大アルカナから命名する。
// fool(愚者)=特殊ルールなしの基本スプレッド、moon(月)=場札が常に1行少ない状態で始まる、
// pope(教皇)=神託の初期レベルが上がるが、ショップで神託が販売されない、
// empress(女帝)=初期所持金が多い状態で始まる、magician(魔術師)=護符所持スロットが多いが場札が少ない、
// justice(正義)=初期デッキから絵札(J・Q・K)が除外される
export type SpreadId = 'fool' | 'moon' | 'pope' | 'empress' | 'magician' | 'justice'
// スプレッドごとの固有ルール設定。
export interface SpreadConfig {
  name: string
  desc: string
  // ウェーブ開始時の配布行数への初期オフセット(既存)。
  initialExtraTableauRows: number
  waveTargetBase: number
  waveTargetMultiplier: number
  // 神託(oracle)の初期レベル。ラン開始時、全10役一律にこの値でoracleLevelsを初期化する(既定1)。
  initialOracleLevel: number
  // ショップのバラ売り枠・福袋カタログの両方から除外する種別(既定は空配列=制限なし)。
  bannedShopKinds: ShopSlotKind[]
  // 初期所持金(currency.initialAmount)へのオフセット(既定0)。
  initialCurrencyBonus: number
  // 護符の所持上限(itemMaxCapacity)へのオフセット(既定0)。
  initialItemCapacityBonus: number
  // 初期デッキ生成時に除外するランクの一覧(既定は空配列=除外なし)。
  excludedRanks: Rank[]
}
```

- [ ] **Step 4: `params.ts`の`DEFAULT_PARAMS.spreads`を変更する**

`src/lib/game/shidasu/params.ts`の現在の内容(340-345行目):

```ts
  spreads: {
    fool: { name: '愚者', desc: '特殊ルールなし', initialExtraTableauRows: 0, waveTargetBase: 2000, waveTargetMultiplier: 1.5, initialOracleLevel: 1, bannedShopKinds: [], initialCurrencyBonus: 0 },
    moon: { name: '月', desc: '場札が常に1行多い状態で始まる。Wave開始時に配られる場札の上半分(端数切捨て)の行は裏向きになる。', initialExtraTableauRows: 1, waveTargetBase: 2000, waveTargetMultiplier: 1.5, initialOracleLevel: 1, bannedShopKinds: [], initialCurrencyBonus: 0 },
    pope: { name: '教皇', desc: '神託の初期レベルが5になるが、ショップで神託が販売されない', initialExtraTableauRows: 0, waveTargetBase: 2000, waveTargetMultiplier: 1.5, initialOracleLevel: 5, bannedShopKinds: ['oracle'], initialCurrencyBonus: 0 },
    empress: { name: '女帝', desc: '初期所持金が10多い状態で始まる', initialExtraTableauRows: 0, waveTargetBase: 2000, waveTargetMultiplier: 1.5, initialOracleLevel: 1, bannedShopKinds: [], initialCurrencyBonus: 10 },
  },
```

これを以下に変更する:

```ts
  spreads: {
    fool: { name: '愚者', desc: '特殊ルールなし', initialExtraTableauRows: 0, waveTargetBase: 2000, waveTargetMultiplier: 1.5, initialOracleLevel: 1, bannedShopKinds: [], initialCurrencyBonus: 0, initialItemCapacityBonus: 0, excludedRanks: [] },
    moon: { name: '月', desc: '場札が常に1行多い状態で始まる。Wave開始時に配られる場札の上半分(端数切捨て)の行は裏向きになる。', initialExtraTableauRows: 1, waveTargetBase: 2000, waveTargetMultiplier: 1.5, initialOracleLevel: 1, bannedShopKinds: [], initialCurrencyBonus: 0, initialItemCapacityBonus: 0, excludedRanks: [] },
    pope: { name: '教皇', desc: '神託の初期レベルが5になるが、ショップで神託が販売されない', initialExtraTableauRows: 0, waveTargetBase: 2000, waveTargetMultiplier: 1.5, initialOracleLevel: 5, bannedShopKinds: ['oracle'], initialCurrencyBonus: 0, initialItemCapacityBonus: 0, excludedRanks: [] },
    empress: { name: '女帝', desc: '初期所持金が10多い状態で始まる', initialExtraTableauRows: 0, waveTargetBase: 2000, waveTargetMultiplier: 1.5, initialOracleLevel: 1, bannedShopKinds: [], initialCurrencyBonus: 10, initialItemCapacityBonus: 0, excludedRanks: [] },
    magician: { name: '魔術師', desc: '護符の所持スロットが1多いが、場札は1行少ない状態で始まる', initialExtraTableauRows: -1, waveTargetBase: 2000, waveTargetMultiplier: 1.5, initialOracleLevel: 1, bannedShopKinds: [], initialCurrencyBonus: 0, initialItemCapacityBonus: 1, excludedRanks: [] },
    justice: { name: '正義', desc: '初期デッキから絵札(J・Q・K)が除外された状態で始まる', initialExtraTableauRows: 0, waveTargetBase: 2000, waveTargetMultiplier: 1.5, initialOracleLevel: 1, bannedShopKinds: [], initialCurrencyBonus: 0, initialItemCapacityBonus: 0, excludedRanks: [11, 12, 13] },
  },
```

- [ ] **Step 5: `params.ts`の`SPREAD_IDS`を変更する**

`src/lib/game/shidasu/params.ts`の現在の内容(632行目):

```ts
export const SPREAD_IDS: SpreadId[] = ['fool', 'moon', 'pope', 'empress']
```

これを以下に変更する:

```ts
export const SPREAD_IDS: SpreadId[] = ['fool', 'moon', 'pope', 'empress', 'magician', 'justice']
```

- [ ] **Step 6: `shidasu.config.json`の`spreads`を変更する**

`src/lib/game/shidasu/shidasu.config.json`の現在の内容(109-150行目):

```json
  "spreads": {
    "fool": {
      "name": "愚者",
      "desc": "特殊ルールなし",
      "initialExtraTableauRows": 0,
      "waveTargetBase": 2000,
      "waveTargetMultiplier": 1.5,
      "initialOracleLevel": 1,
      "bannedShopKinds": [],
      "initialCurrencyBonus": 0
    },
    "moon": {
      "name": "月",
      "desc": "場札が常に1行多い状態で始まる。Wave開始時に配られる場札の上半分(端数切捨て)の行は裏向きになる。",
      "initialExtraTableauRows": 1,
      "waveTargetBase": 2000,
      "waveTargetMultiplier": 1.5,
      "initialOracleLevel": 1,
      "bannedShopKinds": [],
      "initialCurrencyBonus": 0
    },
    "pope": {
      "name": "教皇",
      "desc": "神託の初期レベルが5になるが、ショップで神託が販売されない",
      "initialExtraTableauRows": 0,
      "waveTargetBase": 2000,
      "waveTargetMultiplier": 1.5,
      "initialOracleLevel": 5,
      "bannedShopKinds": ["oracle"],
      "initialCurrencyBonus": 0
    },
    "empress": {
      "name": "女帝",
      "desc": "初期所持金が10多い状態で始まる",
      "initialExtraTableauRows": 0,
      "waveTargetBase": 2000,
      "waveTargetMultiplier": 1.5,
      "initialOracleLevel": 1,
      "bannedShopKinds": [],
      "initialCurrencyBonus": 10
    }
  },
```

これを以下に変更する:

```json
  "spreads": {
    "fool": {
      "name": "愚者",
      "desc": "特殊ルールなし",
      "initialExtraTableauRows": 0,
      "waveTargetBase": 2000,
      "waveTargetMultiplier": 1.5,
      "initialOracleLevel": 1,
      "bannedShopKinds": [],
      "initialCurrencyBonus": 0,
      "initialItemCapacityBonus": 0,
      "excludedRanks": []
    },
    "moon": {
      "name": "月",
      "desc": "場札が常に1行多い状態で始まる。Wave開始時に配られる場札の上半分(端数切捨て)の行は裏向きになる。",
      "initialExtraTableauRows": 1,
      "waveTargetBase": 2000,
      "waveTargetMultiplier": 1.5,
      "initialOracleLevel": 1,
      "bannedShopKinds": [],
      "initialCurrencyBonus": 0,
      "initialItemCapacityBonus": 0,
      "excludedRanks": []
    },
    "pope": {
      "name": "教皇",
      "desc": "神託の初期レベルが5になるが、ショップで神託が販売されない",
      "initialExtraTableauRows": 0,
      "waveTargetBase": 2000,
      "waveTargetMultiplier": 1.5,
      "initialOracleLevel": 5,
      "bannedShopKinds": ["oracle"],
      "initialCurrencyBonus": 0,
      "initialItemCapacityBonus": 0,
      "excludedRanks": []
    },
    "empress": {
      "name": "女帝",
      "desc": "初期所持金が10多い状態で始まる",
      "initialExtraTableauRows": 0,
      "waveTargetBase": 2000,
      "waveTargetMultiplier": 1.5,
      "initialOracleLevel": 1,
      "bannedShopKinds": [],
      "initialCurrencyBonus": 10,
      "initialItemCapacityBonus": 0,
      "excludedRanks": []
    },
    "magician": {
      "name": "魔術師",
      "desc": "護符の所持スロットが1多いが、場札は1行少ない状態で始まる",
      "initialExtraTableauRows": -1,
      "waveTargetBase": 2000,
      "waveTargetMultiplier": 1.5,
      "initialOracleLevel": 1,
      "bannedShopKinds": [],
      "initialCurrencyBonus": 0,
      "initialItemCapacityBonus": 1,
      "excludedRanks": []
    },
    "justice": {
      "name": "正義",
      "desc": "初期デッキから絵札(J・Q・K)が除外された状態で始まる",
      "initialExtraTableauRows": 0,
      "waveTargetBase": 2000,
      "waveTargetMultiplier": 1.5,
      "initialOracleLevel": 1,
      "bannedShopKinds": [],
      "initialCurrencyBonus": 0,
      "initialItemCapacityBonus": 0,
      "excludedRanks": [11, 12, 13]
    }
  },
```

- [ ] **Step 7: テストが通ることを確認する**

Run: `npm test -- params.test.ts`
Expected: PASS(Step 1で追加した3件を含め全件)

- [ ] **Step 8: 型チェックを実行する**

Run: `npm run check`
Expected: shidasu関連の新規エラーなし

- [ ] **Step 9: コミット**

```bash
git add src/lib/game/shidasu/types.ts src/lib/game/shidasu/params.ts src/lib/game/shidasu/shidasu.config.json src/lib/game/shidasu/params.test.ts
git commit -m "$(cat <<'EOF'
feat: 新規スプレッド「魔術師」「正義」を追加し、関連フィールドを新設

Co-Authored-By: Claude Sonnet 5 <noreply@anthropic.com>
EOF
)"
```

---

### Task 2: 魔術師の効果実装(`itemMaxCapacity`へのスプレッドボーナス反映)

**Files:**
- Modify: `src/lib/game/shidasu/relics.ts:60-64` (`itemMaxCapacity`関数)
- Modify: `src/lib/game/shidasu/relics.test.ts:88-100` (既存の`itemMaxCapacity`テスト、`spreadId`追加が必要)
- Test: `src/lib/game/shidasu/relics.test.ts`

**重要な前提**: `relics.test.ts`の既存テスト(89・93・97行目)は`const run = { relics: [] } as unknown as RunState`のように部分オブジェクトを型キャストして使っており、`spreadId`フィールドを持たない。`itemMaxCapacity`が`run.spreadId`を参照するよう変更すると、この3つの既存テストで`run.spreadId`が`undefined`になり、`params.spreads[undefined]`が`undefined`を返して`.initialItemCapacityBonus`アクセス時にランタイムエラーになる。このタスクでは、この3つの既存テストの`run`オブジェクトに`spreadId: 'fool'`を追加する修正も行う。

- [ ] **Step 1: 失敗するテストを書く**

`src/lib/game/shidasu/relics.test.ts`の既存の「所持上限ヘルパー」`describe`ブロック内、97-100行目(「itemMaxCapacity: 招き布袋像(付喪化)で+2」テストの直後)に、以下のテストを追加する。

```ts
  it('itemMaxCapacity: spreadId=magicianなら+1(招き布袋像なし)', () => {
    const run = { relics: [], spreadId: 'magician' } as unknown as RunState
    expect(itemMaxCapacity(DEFAULT_PARAMS, run)).toBe(DEFAULT_PARAMS.items.maxItems + 1)
  })
  it('itemMaxCapacity: spreadId=magician + 招き布袋像(未付喪化)で+2', () => {
    const run = { relics: [{ id: 'manekiHoteizo' as const, tsukumoka: false }], spreadId: 'magician' } as unknown as RunState
    expect(itemMaxCapacity(DEFAULT_PARAMS, run)).toBe(DEFAULT_PARAMS.items.maxItems + 2)
  })
  it('itemMaxCapacity: spreadId=foolなら+0(魔術師のボーナスなし)', () => {
    const run = { relics: [], spreadId: 'fool' } as unknown as RunState
    expect(itemMaxCapacity(DEFAULT_PARAMS, run)).toBe(DEFAULT_PARAMS.items.maxItems)
  })
```

- [ ] **Step 2: テストが失敗することを確認する**

Run: `npm test -- relics.test.ts -t "magician"`
Expected: FAIL — `itemMaxCapacity`がまだ`run.spreadId`を参照していないため、期待値(`maxItems + 1`等)と一致しない

- [ ] **Step 3: 既存3テストの`run`オブジェクトに`spreadId: 'fool'`を追加する**

`src/lib/game/shidasu/relics.test.ts`の現在の内容(88-100行目):

```ts
describe('所持上限ヘルパー', () => {
  it('itemMaxCapacity: 招き布袋像なしならparams.items.maxItemsそのまま', () => {
    const run = { relics: [] } as unknown as RunState
    expect(itemMaxCapacity(DEFAULT_PARAMS, run)).toBe(DEFAULT_PARAMS.items.maxItems)
  })
  it('itemMaxCapacity: 招き布袋像(未付喪化)で+1', () => {
    const run = { relics: [{ id: 'manekiHoteizo' as const, tsukumoka: false }] } as unknown as RunState
    expect(itemMaxCapacity(DEFAULT_PARAMS, run)).toBe(DEFAULT_PARAMS.items.maxItems + 1)
  })
  it('itemMaxCapacity: 招き布袋像(付喪化)で+2', () => {
    const run = { relics: [{ id: 'manekiHoteizo' as const, tsukumoka: true }] } as unknown as RunState
    expect(itemMaxCapacity(DEFAULT_PARAMS, run)).toBe(DEFAULT_PARAMS.items.maxItems + 2)
  })
```

これを以下に変更する:

```ts
describe('所持上限ヘルパー', () => {
  it('itemMaxCapacity: 招き布袋像なしならparams.items.maxItemsそのまま', () => {
    const run = { relics: [], spreadId: 'fool' } as unknown as RunState
    expect(itemMaxCapacity(DEFAULT_PARAMS, run)).toBe(DEFAULT_PARAMS.items.maxItems)
  })
  it('itemMaxCapacity: 招き布袋像(未付喪化)で+1', () => {
    const run = { relics: [{ id: 'manekiHoteizo' as const, tsukumoka: false }], spreadId: 'fool' } as unknown as RunState
    expect(itemMaxCapacity(DEFAULT_PARAMS, run)).toBe(DEFAULT_PARAMS.items.maxItems + 1)
  })
  it('itemMaxCapacity: 招き布袋像(付喪化)で+2', () => {
    const run = { relics: [{ id: 'manekiHoteizo' as const, tsukumoka: true }], spreadId: 'fool' } as unknown as RunState
    expect(itemMaxCapacity(DEFAULT_PARAMS, run)).toBe(DEFAULT_PARAMS.items.maxItems + 2)
  })
```

- [ ] **Step 4: `relics.ts`の`itemMaxCapacity`関数を変更する**

`src/lib/game/shidasu/relics.ts`の現在の内容(60-64行目):

```ts
// 護符の所持上限。招き布袋像所持時はn(付喪化ならさらにtsukumokaN)を加算する。
export function itemMaxCapacity(params: ShidasuParams, run: RunState): number {
  const r = params.relics.manekiHoteizo
  return params.items.maxItems + relicBonus(run, 'manekiHoteizo', r.n, r.tsukumokaN)
}
```

これを以下に変更する:

```ts
// 護符の所持上限。招き布袋像所持時はn(付喪化ならさらにtsukumokaN)を加算し、
// スプレッド由来のオフセット(魔術師は+1)も加算する。
export function itemMaxCapacity(params: ShidasuParams, run: RunState): number {
  const r = params.relics.manekiHoteizo
  const spreadBonus = params.spreads[run.spreadId].initialItemCapacityBonus
  return params.items.maxItems + spreadBonus + relicBonus(run, 'manekiHoteizo', r.n, r.tsukumokaN)
}
```

- [ ] **Step 5: テストが通ることを確認する**

Run: `npm test -- relics.test.ts`
Expected: 全件PASS(Step 1で追加した3件、Step 3で修正した3件を含む)

- [ ] **Step 6: 型チェック・ビルドを実行する**

Run: `npm run check`
Expected: shidasu関連の新規エラーなし

Run: `npm run build`
Expected: 成功

- [ ] **Step 7: コミット**

```bash
git add src/lib/game/shidasu/relics.ts src/lib/game/shidasu/relics.test.ts
git commit -m "$(cat <<'EOF'
feat: itemMaxCapacityに魔術師の護符所持スロットボーナスを反映

Co-Authored-By: Claude Sonnet 5 <noreply@anthropic.com>
EOF
)"
```

---

### Task 3: 正義の効果実装(`beginRun`での初期デッキ除外ランク反映)

**Files:**
- Modify: `src/lib/game/shidasu/engine.ts:1032-1047` (`beginRun`関数)
- Test: `src/lib/game/shidasu/engine.test.ts`

- [ ] **Step 1: 失敗するテストを書く**

`src/lib/game/shidasu/engine.test.ts`の`beginRun`関連の既存テスト群(2544-2547行目「spreadId=popeでは、oracleLevelsが全役5になる」テストの後、女帝関連テストが既にある場合はそのさらに後)に、以下のテストを追加する。ファイルを開いて`spreadId=empress`のテストを探し、その直後に追記すること。

```ts
  test('spreadId=justiceでは、deckCompositionのランク11・12・13が全てremoved:trueになる', () => {
    const run = beginRun(DEFAULT_PARAMS, 1, 'justice')
    const excludedCards = run.deckComposition.filter(c => [11, 12, 13].includes(c.rank))
    expect(excludedCards.length).toBeGreaterThan(0)
    excludedCards.forEach(c => expect(c.removed).toBe(true))
    const otherCards = run.deckComposition.filter(c => ![11, 12, 13].includes(c.rank))
    otherCards.forEach(c => expect(c.removed).toBe(false))
  })

  test('spreadIdを省略(fool)すると、deckCompositionは全カードremoved:falseのまま', () => {
    const run = beginRun(DEFAULT_PARAMS, 1)
    run.deckComposition.forEach(c => expect(c.removed).toBe(false))
  })
```

- [ ] **Step 2: テストが失敗することを確認する**

Run: `npm test -- engine.test.ts -t "justice"`
Expected: FAIL — `run.deckComposition`のランク11・12・13のカードが`removed: false`のまま(まだ`beginRun`が`excludedRanks`を反映していないため)

- [ ] **Step 3: `beginRun`関数を変更する**

`src/lib/game/shidasu/engine.ts`の現在の内容(1032-1047行目):

```ts
export function beginRun(params: ShidasuParams, seed?: number, spreadId: SpreadId = 'fool'): RunState {
  const spreadConfig = params.spreads[spreadId]
  const initialExtraTableauRows = spreadConfig.initialExtraTableauRows
  const rand = createRng(seed ?? Math.floor(Math.random() * 999999) + 1)
  const initialStageStars = rollStageStars(params, rand)
  const oracleLevels = oracleLevelsWithUniformValue(spreadConfig.initialOracleLevel)
  return {
    ...createInitialRun(),
    phase: 'shop',
    extraTableauRows: initialExtraTableauRows,
    spreadId,
    stageStars: initialStageStars,
    currency: params.currency.initialAmount + spreadConfig.initialCurrencyBonus,
    oracleLevels,
  }
}
```

これを以下に変更する:

```ts
export function beginRun(params: ShidasuParams, seed?: number, spreadId: SpreadId = 'fool'): RunState {
  const spreadConfig = params.spreads[spreadId]
  const initialExtraTableauRows = spreadConfig.initialExtraTableauRows
  const rand = createRng(seed ?? Math.floor(Math.random() * 999999) + 1)
  const initialStageStars = rollStageStars(params, rand)
  const oracleLevels = oracleLevelsWithUniformValue(spreadConfig.initialOracleLevel)
  const initialRun = createInitialRun()
  const deckComposition = spreadConfig.excludedRanks.length === 0
    ? initialRun.deckComposition
    : initialRun.deckComposition.map(c =>
        spreadConfig.excludedRanks.includes(c.rank) ? { ...c, removed: true } : c
      )
  return {
    ...initialRun,
    phase: 'shop',
    extraTableauRows: initialExtraTableauRows,
    spreadId,
    stageStars: initialStageStars,
    currency: params.currency.initialAmount + spreadConfig.initialCurrencyBonus,
    oracleLevels,
    deckComposition,
  }
}
```

- [ ] **Step 4: テストが通ることを確認する**

Run: `npm test -- engine.test.ts -t "justice"`
Expected: PASS (2件とも)

Run: `npm test -- engine.test.ts`
Expected: 全件PASS(既存テストは`fool`/`moon`/`pope`/`empress`/`magician`のいずれも`excludedRanks: []`のため、`deckComposition`計算に影響がないことを確認)

- [ ] **Step 5: 型チェック・ビルドを実行する**

Run: `npm run check`
Expected: shidasu関連の新規エラーなし

Run: `npm run build`
Expected: 成功

- [ ] **Step 6: コミット**

```bash
git add src/lib/game/shidasu/engine.ts src/lib/game/shidasu/engine.test.ts
git commit -m "$(cat <<'EOF'
feat: beginRunで正義のexcludedRanksを初期デッキに反映

Co-Authored-By: Claude Sonnet 5 <noreply@anthropic.com>
EOF
)"
```

---

### Task 4: `/admin/shidasu-spreads`にUI拡張し、最終動作確認する

**Files:**
- Modify: `src/routes/admin/shidasu-spreads/+page.svelte:11-18` (定数定義)
- Modify: `src/routes/admin/shidasu-spreads/+page.svelte:30-38` (トグルヘルパー)
- Modify: `src/routes/admin/shidasu-spreads/+page.svelte:40-53` (`hasValidationError`)
- Modify: `src/routes/admin/shidasu-spreads/+page.svelte:124-134` (テーブルヘッダー)
- Modify: `src/routes/admin/shidasu-spreads/+page.svelte:159-175` (テーブル行)

このタスクは自動テストの対象外(admin画面はこのプロジェクトの既存方針として自動テストを書かない)。手を動かして直接修正し、ビルド・型チェック・ブラウザ確認で検証する。

- [ ] **Step 1: ランク表示ラベルマップを追加する**

`src/routes/admin/shidasu-spreads/+page.svelte`の現在の内容(11-18行目):

```svelte
  const SHOP_SLOT_KIND_OPTIONS: ShopSlotKind[] = ['item', 'rite', 'revelation', 'oracle', 'cardSet']
  const SHOP_SLOT_KIND_LABELS: Record<ShopSlotKind, string> = {
    item: '護符',
    rite: '秘儀',
    revelation: '天啓',
    oracle: '神託',
    cardSet: 'トランプセット',
  }
```

これを以下に変更する(末尾に2定数を追加):

```svelte
  const SHOP_SLOT_KIND_OPTIONS: ShopSlotKind[] = ['item', 'rite', 'revelation', 'oracle', 'cardSet']
  const SHOP_SLOT_KIND_LABELS: Record<ShopSlotKind, string> = {
    item: '護符',
    rite: '秘儀',
    revelation: '天啓',
    oracle: '神託',
    cardSet: 'トランプセット',
  }

  const RANK_OPTIONS: number[] = [1, 2, 3, 4, 5, 6, 7, 8, 9, 10, 11, 12, 13]
  const RANK_LABELS: Record<number, string> = {
    1: 'A', 2: '2', 3: '3', 4: '4', 5: '5', 6: '6', 7: '7', 8: '8', 9: '9', 10: '10', 11: 'J', 12: 'Q', 13: 'K',
  }
```

- [ ] **Step 2: `excludedRanks`をトグルするヘルパー関数を追加する**

`src/routes/admin/shidasu-spreads/+page.svelte`の現在の内容(30-38行目):

```svelte
  // チェックボックスのON/OFFに応じて、対象種別をbannedShopKinds配列に追加/削除する。
  function toggleBannedShopKind(id: SpreadId, kind: ShopSlotKind, checked: boolean) {
    const entry = spreadEntry(id)
    if (checked) {
      if (!entry.bannedShopKinds.includes(kind)) entry.bannedShopKinds = [...entry.bannedShopKinds, kind]
    } else {
      entry.bannedShopKinds = entry.bannedShopKinds.filter(k => k !== kind)
    }
  }
```

これを以下に変更する(直後に新規関数を追加):

```svelte
  // チェックボックスのON/OFFに応じて、対象種別をbannedShopKinds配列に追加/削除する。
  function toggleBannedShopKind(id: SpreadId, kind: ShopSlotKind, checked: boolean) {
    const entry = spreadEntry(id)
    if (checked) {
      if (!entry.bannedShopKinds.includes(kind)) entry.bannedShopKinds = [...entry.bannedShopKinds, kind]
    } else {
      entry.bannedShopKinds = entry.bannedShopKinds.filter(k => k !== kind)
    }
  }

  // チェックボックスのON/OFFに応じて、対象ランクをexcludedRanks配列に追加/削除する。
  function toggleExcludedRank(id: SpreadId, rank: number, checked: boolean) {
    const entry = spreadEntry(id)
    if (checked) {
      if (!entry.excludedRanks.includes(rank)) entry.excludedRanks = [...entry.excludedRanks, rank]
    } else {
      entry.excludedRanks = entry.excludedRanks.filter(r => r !== rank)
    }
  }
```

- [ ] **Step 3: `hasValidationError`に`initialItemCapacityBonus`のチェックを追加する**

`src/routes/admin/shidasu-spreads/+page.svelte`の現在の内容(40-53行目):

```svelte
  let hasValidationError = $derived.by(() => {
    if (!config) return false
    return SPREAD_IDS.some(id => {
      const entry = spreadEntry(id)
      if (!entry.name.trim()) return true
      if (!entry.desc.trim()) return true
      if (!Number.isFinite(entry.initialExtraTableauRows)) return true
      if (!Number.isFinite(entry.waveTargetBase)) return true
      if (!Number.isFinite(entry.waveTargetMultiplier)) return true
      if (!Number.isFinite(entry.initialOracleLevel)) return true
      if (!Number.isFinite(entry.initialCurrencyBonus)) return true
      return false
    })
  })
```

これを以下に変更する:

```svelte
  let hasValidationError = $derived.by(() => {
    if (!config) return false
    return SPREAD_IDS.some(id => {
      const entry = spreadEntry(id)
      if (!entry.name.trim()) return true
      if (!entry.desc.trim()) return true
      if (!Number.isFinite(entry.initialExtraTableauRows)) return true
      if (!Number.isFinite(entry.waveTargetBase)) return true
      if (!Number.isFinite(entry.waveTargetMultiplier)) return true
      if (!Number.isFinite(entry.initialOracleLevel)) return true
      if (!Number.isFinite(entry.initialCurrencyBonus)) return true
      if (!Number.isFinite(entry.initialItemCapacityBonus)) return true
      return false
    })
  })
```

- [ ] **Step 4: テーブルヘッダーに列を2つ追加する**

`src/routes/admin/shidasu-spreads/+page.svelte`の現在の内容(124-134行目):

```svelte
            <tr class="bg-slate-50 text-slate-500">
              <th class="px-2 py-1.5 text-left" style="width:6rem;">id</th>
              <th class="px-2 py-1.5 text-left" style="width:6rem;">名称</th>
              <th class="px-2 py-1.5 text-left" style="width:16rem;">説明文</th>
              <th class="px-2 py-1.5 text-left" style="width:7rem;">初期行数オフセット</th>
              <th class="px-2 py-1.5 text-left" style="width:7rem;">目標スコア基礎値</th>
              <th class="px-2 py-1.5 text-left" style="width:7rem;">目標スコア倍率</th>
              <th class="px-2 py-1.5 text-left" style="width:7rem;">神託初期レベル</th>
              <th class="px-2 py-1.5 text-left" style="width:7rem;">初期所持金オフセット</th>
              <th class="px-2 py-1.5 text-left" style="width:12rem;">ショップ非販売種別</th>
            </tr>
```

これを以下に変更する:

```svelte
            <tr class="bg-slate-50 text-slate-500">
              <th class="px-2 py-1.5 text-left" style="width:6rem;">id</th>
              <th class="px-2 py-1.5 text-left" style="width:6rem;">名称</th>
              <th class="px-2 py-1.5 text-left" style="width:16rem;">説明文</th>
              <th class="px-2 py-1.5 text-left" style="width:7rem;">初期行数オフセット</th>
              <th class="px-2 py-1.5 text-left" style="width:7rem;">目標スコア基礎値</th>
              <th class="px-2 py-1.5 text-left" style="width:7rem;">目標スコア倍率</th>
              <th class="px-2 py-1.5 text-left" style="width:7rem;">神託初期レベル</th>
              <th class="px-2 py-1.5 text-left" style="width:7rem;">初期所持金オフセット</th>
              <th class="px-2 py-1.5 text-left" style="width:7rem;">護符所持スロットオフセット</th>
              <th class="px-2 py-1.5 text-left" style="width:12rem;">ショップ非販売種別</th>
              <th class="px-2 py-1.5 text-left" style="width:16rem;">除外ランク</th>
            </tr>
```

- [ ] **Step 5: テーブル行に入力欄を2つ追加する**

`src/routes/admin/shidasu-spreads/+page.svelte`の現在の内容(159-175行目):

```svelte
                <td class="px-2 py-1.5 align-top">
                  <input type="number" step="any" bind:value={entry.initialCurrencyBonus} class="w-full border border-slate-200 rounded px-1 py-0.5" />
                </td>
                <td class="px-2 py-1.5 align-top">
                  <div class="flex flex-col gap-0.5">
                    {#each SHOP_SLOT_KIND_OPTIONS as kind (kind)}
                      <label class="flex items-center gap-1 text-[11px] text-slate-600">
                        <input
                          type="checkbox"
                          checked={entry.bannedShopKinds.includes(kind)}
                          onchange={(e) => toggleBannedShopKind(id, kind, e.currentTarget.checked)}
                        />
                        {SHOP_SLOT_KIND_LABELS[kind]}
                      </label>
                    {/each}
                  </div>
                </td>
```

これを以下に変更する:

```svelte
                <td class="px-2 py-1.5 align-top">
                  <input type="number" step="any" bind:value={entry.initialCurrencyBonus} class="w-full border border-slate-200 rounded px-1 py-0.5" />
                </td>
                <td class="px-2 py-1.5 align-top">
                  <input type="number" step="any" bind:value={entry.initialItemCapacityBonus} class="w-full border border-slate-200 rounded px-1 py-0.5" />
                </td>
                <td class="px-2 py-1.5 align-top">
                  <div class="flex flex-col gap-0.5">
                    {#each SHOP_SLOT_KIND_OPTIONS as kind (kind)}
                      <label class="flex items-center gap-1 text-[11px] text-slate-600">
                        <input
                          type="checkbox"
                          checked={entry.bannedShopKinds.includes(kind)}
                          onchange={(e) => toggleBannedShopKind(id, kind, e.currentTarget.checked)}
                        />
                        {SHOP_SLOT_KIND_LABELS[kind]}
                      </label>
                    {/each}
                  </div>
                </td>
                <td class="px-2 py-1.5 align-top">
                  <div class="flex flex-wrap gap-x-2 gap-y-0.5">
                    {#each RANK_OPTIONS as rank (rank)}
                      <label class="flex items-center gap-1 text-[11px] text-slate-600">
                        <input
                          type="checkbox"
                          checked={entry.excludedRanks.includes(rank)}
                          onchange={(e) => toggleExcludedRank(id, rank, e.currentTarget.checked)}
                        />
                        {RANK_LABELS[rank]}
                      </label>
                    {/each}
                  </div>
                </td>
```

- [ ] **Step 6: 型チェック・ビルドを実行する**

Run: `npm run check`
Expected: shidasu関連の新規エラーなし

Run: `npm run build`
Expected: 成功

- [ ] **Step 7: 全テストスイートを実行する**

Run: `npm test`
Expected: 全ファイル・全テストPASS(Task 1〜3で追加したテストを含む)

- [ ] **Step 8: 開発サーバーでブラウザ動作確認する**

Run: `npm run dev`(ポートが競合する場合は自動的に別ポートが割り当てられる。実際に使われたポート番号を確認すること)

ブラウザで以下を確認する。

1. `/admin/shidasu-spreads`を開き、テーブルに「魔術師」(id: `magician`)・「正義」(id: `justice`)の行が表示されること。「護符所持スロットオフセット」列は魔術師のみ`1`、他は`0`であること。「除外ランク」列は正義のみJ・Q・Kにチェックが入っており、他は全て未チェックであること
2. `/game/shidasu`のスプレッド選択画面に「魔術師」「正義」が表示され、それぞれの説明文が正しく表示されていること
3. 「魔術師」を選んでランを開始し、護符の所持上限表示が愚者より1多いこと。場札の配布行数が愚者より1少ないこと
4. 「正義」を選んでランを開始し、Wave中にJ・Q・Kのカードが場札・山札のどこにも一切出現しないこと(数Wave分プレイして確認、または山札を通しで引き切って確認)
5. 「愚者」を選んでランを開始し、従来通りの挙動であること(回帰確認)

問題があれば修正し、Step 6〜7を再実行してから次に進む。

- [ ] **Step 9: `shidasu.config.json`が意図しない差分を持っていないか確認する**

ブラウザでのショップ操作等により`shidasu.config.json`が保存APIを通じて書き換わっていないか確認する。

Run: `git status`
Run: `git diff src/lib/game/shidasu/shidasu.config.json`

Task 1で行った変更以外の差分があれば(フォーマットの再整形等)、`git checkout -- src/lib/game/shidasu/shidasu.config.json`で復元してからTask 1の変更のみを再度適用する。差分がTask 1の内容と一致していることを確認できたら、このタスクは追加のコミットなしで完了(Task 1で既にコミット済みのため)。

- [ ] **Step 10: 開発サーバーを停止する**

動作確認が完了したら`npm run dev`のプロセスを停止する。

- [ ] **Step 11: コミット**

```bash
git add src/routes/admin/shidasu-spreads/+page.svelte
git commit -m "$(cat <<'EOF'
feat: /admin/shidasu-spreadsに護符所持スロットオフセット・除外ランク列を追加

Co-Authored-By: Claude Sonnet 5 <noreply@anthropic.com>
EOF
)"
```

(Step 9で修正が発生した場合は、修正内容も同じコミットまたは追加のコミットに含める)
