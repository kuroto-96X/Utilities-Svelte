# 新規スプレッド「恋人」(黒赤スート片方統一) Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** 新規スプレッド「恋人」(`lovers`)を追加する。選択すると、初期デッキの黒スート(♠・♣)がラン開始時にランダムに片方へ統一され、赤スート(♥・♦)も同様にランダムに片方へ統一された状態でスタートする。

**Architecture:** `SpreadConfig`に`unifyBlackRedSuits: boolean`フィールドを新設する。`deck.ts`に`unifyBlackRedSuits`ヘルパー関数を新設し、スートの黒赤ペアをランダムに一方へ統一する処理を実装する。`beginRun`(`engine.ts`)がこのヘルパーを呼び出し、既存の`rand`(乱数)を消費して初期デッキに反映する。`/admin/shidasu-spreads`にも編集用の列を追加する。

**Tech Stack:** TypeScript, SvelteKit, Vitest

---

### Task 1: `SpreadId`型・`SpreadConfig`型の拡張と`SPREAD_IDS`・`DEFAULT_PARAMS`・`shidasu.config.json`の更新

**Files:**
- Modify: `src/lib/game/shidasu/types.ts:24-48` (`SpreadId`型・`SpreadConfig`型)
- Modify: `src/lib/game/shidasu/params.ts:340-347` (`DEFAULT_PARAMS.spreads`)
- Modify: `src/lib/game/shidasu/params.ts:634` (`SPREAD_IDS`)
- Modify: `src/lib/game/shidasu/shidasu.config.json:109-182` (`spreads`)
- Test: `src/lib/game/shidasu/params.test.ts`

- [ ] **Step 1: 失敗するテストを書く**

`src/lib/game/shidasu/params.test.ts`を開き、`justice`の`excludedRanks`をアサートしているテストブロックを探し、その直後に以下のテストを追加する。

```ts
  test('fool/moon/pope/empress/magician/justiceのunifyBlackRedSuitsはfalse', () => {
    expect(DEFAULT_PARAMS.spreads.fool.unifyBlackRedSuits).toBe(false)
    expect(DEFAULT_PARAMS.spreads.moon.unifyBlackRedSuits).toBe(false)
    expect(DEFAULT_PARAMS.spreads.pope.unifyBlackRedSuits).toBe(false)
    expect(DEFAULT_PARAMS.spreads.empress.unifyBlackRedSuits).toBe(false)
    expect(DEFAULT_PARAMS.spreads.magician.unifyBlackRedSuits).toBe(false)
    expect(DEFAULT_PARAMS.spreads.justice.unifyBlackRedSuits).toBe(false)
  })

  test('loversの名称は恋人、unifyBlackRedSuitsはtrue、他のフィールドはfoolと同じ', () => {
    expect(DEFAULT_PARAMS.spreads.lovers.name).toBe('恋人')
    expect(DEFAULT_PARAMS.spreads.lovers.unifyBlackRedSuits).toBe(true)
    expect(DEFAULT_PARAMS.spreads.lovers.initialExtraTableauRows).toBe(DEFAULT_PARAMS.spreads.fool.initialExtraTableauRows)
    expect(DEFAULT_PARAMS.spreads.lovers.waveTargetBase).toBe(DEFAULT_PARAMS.spreads.fool.waveTargetBase)
    expect(DEFAULT_PARAMS.spreads.lovers.waveTargetMultiplier).toBe(DEFAULT_PARAMS.spreads.fool.waveTargetMultiplier)
    expect(DEFAULT_PARAMS.spreads.lovers.initialOracleLevel).toBe(DEFAULT_PARAMS.spreads.fool.initialOracleLevel)
    expect(DEFAULT_PARAMS.spreads.lovers.bannedShopKinds).toEqual([])
    expect(DEFAULT_PARAMS.spreads.lovers.initialCurrencyBonus).toBe(0)
    expect(DEFAULT_PARAMS.spreads.lovers.initialItemCapacityBonus).toBe(0)
    expect(DEFAULT_PARAMS.spreads.lovers.excludedRanks).toEqual([])
  })
```

- [ ] **Step 2: テストが失敗することを確認する**

Run: `npm test -- params.test.ts`
Expected: FAIL — `DEFAULT_PARAMS.spreads.lovers`が`undefined`、または`unifyBlackRedSuits`プロパティが存在しない

- [ ] **Step 3: `types.ts`の`SpreadId`型・`SpreadConfig`型を変更する**

`src/lib/game/shidasu/types.ts`の現在の内容(24-48行目):

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

これを以下に変更する:

```ts
// スプレッド: ラン開始時にプレイヤーが選ぶ固有ルールセット。大アルカナから命名する。
// fool(愚者)=特殊ルールなしの基本スプレッド、moon(月)=場札が常に1行少ない状態で始まる、
// pope(教皇)=神託の初期レベルが上がるが、ショップで神託が販売されない、
// empress(女帝)=初期所持金が多い状態で始まる、magician(魔術師)=護符所持スロットが多いが場札が少ない、
// justice(正義)=初期デッキから絵札(J・Q・K)が除外される、
// lovers(恋人)=初期デッキの黒スート(♠♣)・赤スート(♥♦)がそれぞれランダムに片方へ統一される
export type SpreadId = 'fool' | 'moon' | 'pope' | 'empress' | 'magician' | 'justice' | 'lovers'
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
  // 初期デッキ生成時、黒スート(♠♣)をどちらか一方へ、赤スート(♥♦)をどちらか一方へ
  // ランダムに統一するか(既定false)。統一先はラン開始のたびにランダムに決定される。
  unifyBlackRedSuits: boolean
}
```

- [ ] **Step 4: `params.ts`の`DEFAULT_PARAMS.spreads`を変更する**

`src/lib/game/shidasu/params.ts`の現在の内容(340-347行目):

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

これを以下に変更する:

```ts
  spreads: {
    fool: { name: '愚者', desc: '特殊ルールなし', initialExtraTableauRows: 0, waveTargetBase: 2000, waveTargetMultiplier: 1.5, initialOracleLevel: 1, bannedShopKinds: [], initialCurrencyBonus: 0, initialItemCapacityBonus: 0, excludedRanks: [], unifyBlackRedSuits: false },
    moon: { name: '月', desc: '場札が常に1行多い状態で始まる。Wave開始時に配られる場札の上半分(端数切捨て)の行は裏向きになる。', initialExtraTableauRows: 1, waveTargetBase: 2000, waveTargetMultiplier: 1.5, initialOracleLevel: 1, bannedShopKinds: [], initialCurrencyBonus: 0, initialItemCapacityBonus: 0, excludedRanks: [], unifyBlackRedSuits: false },
    pope: { name: '教皇', desc: '神託の初期レベルが5になるが、ショップで神託が販売されない', initialExtraTableauRows: 0, waveTargetBase: 2000, waveTargetMultiplier: 1.5, initialOracleLevel: 5, bannedShopKinds: ['oracle'], initialCurrencyBonus: 0, initialItemCapacityBonus: 0, excludedRanks: [], unifyBlackRedSuits: false },
    empress: { name: '女帝', desc: '初期所持金が10多い状態で始まる', initialExtraTableauRows: 0, waveTargetBase: 2000, waveTargetMultiplier: 1.5, initialOracleLevel: 1, bannedShopKinds: [], initialCurrencyBonus: 10, initialItemCapacityBonus: 0, excludedRanks: [], unifyBlackRedSuits: false },
    magician: { name: '魔術師', desc: '護符の所持スロットが1多いが、場札は1行少ない状態で始まる', initialExtraTableauRows: -1, waveTargetBase: 2000, waveTargetMultiplier: 1.5, initialOracleLevel: 1, bannedShopKinds: [], initialCurrencyBonus: 0, initialItemCapacityBonus: 1, excludedRanks: [], unifyBlackRedSuits: false },
    justice: { name: '正義', desc: '初期デッキから絵札(J・Q・K)が除外された状態で始まる', initialExtraTableauRows: 0, waveTargetBase: 2000, waveTargetMultiplier: 1.5, initialOracleLevel: 1, bannedShopKinds: [], initialCurrencyBonus: 0, initialItemCapacityBonus: 0, excludedRanks: [11, 12, 13], unifyBlackRedSuits: false },
    lovers: { name: '恋人', desc: '初期デッキの黒スート(♠♣)・赤スート(♥♦)が、それぞれランダムにどちらか一方へ統一された状態で始まる', initialExtraTableauRows: 0, waveTargetBase: 2000, waveTargetMultiplier: 1.5, initialOracleLevel: 1, bannedShopKinds: [], initialCurrencyBonus: 0, initialItemCapacityBonus: 0, excludedRanks: [], unifyBlackRedSuits: true },
  },
```

- [ ] **Step 5: `params.ts`の`SPREAD_IDS`を変更する**

`src/lib/game/shidasu/params.ts`の現在の内容(634行目):

```ts
export const SPREAD_IDS: SpreadId[] = ['fool', 'moon', 'pope', 'empress', 'magician', 'justice']
```

これを以下に変更する:

```ts
export const SPREAD_IDS: SpreadId[] = ['fool', 'moon', 'pope', 'empress', 'magician', 'justice', 'lovers']
```

- [ ] **Step 6: `shidasu.config.json`の`spreads`を変更する**

`src/lib/game/shidasu/shidasu.config.json`の現在の内容(109-182行目):

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
      "excludedRanks": [],
      "unifyBlackRedSuits": false
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
      "excludedRanks": [],
      "unifyBlackRedSuits": false
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
      "excludedRanks": [],
      "unifyBlackRedSuits": false
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
      "excludedRanks": [],
      "unifyBlackRedSuits": false
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
      "excludedRanks": [],
      "unifyBlackRedSuits": false
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
      "excludedRanks": [11, 12, 13],
      "unifyBlackRedSuits": false
    },
    "lovers": {
      "name": "恋人",
      "desc": "初期デッキの黒スート(♠♣)・赤スート(♥♦)が、それぞれランダムにどちらか一方へ統一された状態で始まる",
      "initialExtraTableauRows": 0,
      "waveTargetBase": 2000,
      "waveTargetMultiplier": 1.5,
      "initialOracleLevel": 1,
      "bannedShopKinds": [],
      "initialCurrencyBonus": 0,
      "initialItemCapacityBonus": 0,
      "excludedRanks": [],
      "unifyBlackRedSuits": true
    }
  },
```

- [ ] **Step 7: テストが通ることを確認する**

Run: `npm test -- params.test.ts`
Expected: PASS(Step 1で追加した2件を含め全件)

- [ ] **Step 8: 型チェックを実行する**

Run: `npm run check`
Expected: shidasu関連の新規エラーなし

- [ ] **Step 9: コミット**

```bash
git add src/lib/game/shidasu/types.ts src/lib/game/shidasu/params.ts src/lib/game/shidasu/shidasu.config.json src/lib/game/shidasu/params.test.ts
git commit -m "$(cat <<'EOF'
feat: 新規スプレッド「恋人」を追加し、unifyBlackRedSuitsフィールドを新設

Co-Authored-By: Claude Sonnet 5 <noreply@anthropic.com>
EOF
)"
```

---

### Task 2: スート統一ヘルパー関数の実装(`deck.ts`)

**Files:**
- Modify: `src/lib/game/shidasu/deck.ts:29-36` (`addCardsToDeckComposition`の直後に新規関数を追加)
- Test: `src/lib/game/shidasu/deck.test.ts`

- [ ] **Step 1: 失敗するテストを書く**

`src/lib/game/shidasu/deck.test.ts`のimport文を以下のように変更する(`unifyBlackRedSuits`を追加):

現在の内容(2行目):

```ts
import { createDeck, createRng, rollOffer, shuffle, standardDeckComposition, addCardsToDeckComposition } from './deck'
```

これを以下に変更する:

```ts
import { createDeck, createRng, rollOffer, shuffle, standardDeckComposition, addCardsToDeckComposition, unifyBlackRedSuits } from './deck'
```

ファイル末尾(176行目、`addCardsToDeckComposition`の`describe`ブロックの直後)に、以下のテストを追加する。

```ts
describe('unifyBlackRedSuits', () => {
  test('rand()が常に0未満0.5以上を返さない(常に0を返す)場合、黒スートは全て♠、赤スートは全て♥になる', () => {
    const composition = standardDeckComposition()
    const alwaysZero = () => 0
    const result = unifyBlackRedSuits(composition, alwaysZero)
    const blackCards = result.filter(c => c.suit === '♠' || c.suit === '♣')
    const redCards = result.filter(c => c.suit === '♥' || c.suit === '♦')
    expect(blackCards.every(c => c.suit === '♠')).toBe(true)
    expect(redCards.every(c => c.suit === '♥')).toBe(true)
  })

  test('rand()が常に0.5以上を返す場合、黒スートは全て♣、赤スートは全て♦になる', () => {
    const composition = standardDeckComposition()
    const alwaysHalf = () => 0.5
    const result = unifyBlackRedSuits(composition, alwaysHalf)
    const blackCards = result.filter(c => c.suit === '♠' || c.suit === '♣')
    const redCards = result.filter(c => c.suit === '♥' || c.suit === '♦')
    expect(blackCards.every(c => c.suit === '♣')).toBe(true)
    expect(redCards.every(c => c.suit === '♦')).toBe(true)
  })

  test('変換後、スートは♠か♣のどちらか一方、♥か♦のどちらか一方のみになる(混在しない)', () => {
    const composition = standardDeckComposition()
    const result = unifyBlackRedSuits(composition, createRng(1))
    const distinctBlackSuits = new Set(result.filter(c => c.suit === '♠' || c.suit === '♣').map(c => c.suit))
    const distinctRedSuits = new Set(result.filter(c => c.suit === '♥' || c.suit === '♦').map(c => c.suit))
    expect(distinctBlackSuits.size).toBe(1)
    expect(distinctRedSuits.size).toBe(1)
  })

  test('カードの総枚数・各ランクの枚数構成は変わらない(rankやremovedは書き換えない)', () => {
    const composition = standardDeckComposition()
    const result = unifyBlackRedSuits(composition, createRng(1))
    expect(result).toHaveLength(composition.length)
    const originalRanks = composition.map(c => c.rank).sort((a, b) => a - b)
    const resultRanks = result.map(c => c.rank).sort((a, b) => a - b)
    expect(resultRanks).toEqual(originalRanks)
    expect(result.every(c => c.removed === false)).toBe(true)
  })

  test('元のdeckCompositionを書き換えない(イミュータブル)', () => {
    const composition = standardDeckComposition()
    const copy = composition.map(c => ({ ...c }))
    unifyBlackRedSuits(composition, createRng(1))
    expect(composition).toEqual(copy)
  })
})
```

- [ ] **Step 2: テストが失敗することを確認する**

Run: `npm test -- deck.test.ts -t "unifyBlackRedSuits"`
Expected: FAIL — `unifyBlackRedSuits`が`deck.ts`からエクスポートされていないため、importエラーまたは関数未定義エラーになる

- [ ] **Step 3: `deck.ts`に`unifyBlackRedSuits`関数を実装する**

`src/lib/game/shidasu/deck.ts`の現在の内容(29-36行目):

```ts
// deckCompositionに複数枚のカードを一括追加する。deckIdは既存の配列長を基準に連番で振る
// (天啓のワイルド供給処理revelationEffects.tsのnewDeckIdと同じ採番方式)。
export function addCardsToDeckComposition(deckComposition: DeckCard[], cards: NewCardSpec[]): DeckCard[] {
  let nextDeckId = deckComposition.length
  const added: DeckCard[] = cards.map(c => ({ deckId: nextDeckId++, suit: c.suit, rank: c.rank, wild: c.wild, removed: false }))
  return [...deckComposition, ...added]
}
```

これを以下に変更する(直後に新規関数を追加):

```ts
// deckCompositionに複数枚のカードを一括追加する。deckIdは既存の配列長を基準に連番で振る
// (天啓のワイルド供給処理revelationEffects.tsのnewDeckIdと同じ採番方式)。
export function addCardsToDeckComposition(deckComposition: DeckCard[], cards: NewCardSpec[]): DeckCard[] {
  let nextDeckId = deckComposition.length
  const added: DeckCard[] = cards.map(c => ({ deckId: nextDeckId++, suit: c.suit, rank: c.rank, wild: c.wild, removed: false }))
  return [...deckComposition, ...added]
}

// 黒スートペア(♠・♣)をどちらか一方へ、赤スートペア(♥・♦)をどちらか一方へ、
// それぞれランダムに統一する。統一先の決定にrandを2回消費する(黒→赤の順)。
// ★(ワイルド専用スート)のカードはそのまま素通しする。
export function unifyBlackRedSuits(composition: DeckCard[], rand: () => number): DeckCard[] {
  const blackTarget: Suit = rand() < 0.5 ? '♠' : '♣'
  const redTarget: Suit = rand() < 0.5 ? '♥' : '♦'
  return composition.map(c => {
    if (c.suit === '♠' || c.suit === '♣') return { ...c, suit: blackTarget }
    if (c.suit === '♥' || c.suit === '♦') return { ...c, suit: redTarget }
    return c
  })
}
```

- [ ] **Step 4: テストが通ることを確認する**

Run: `npm test -- deck.test.ts`
Expected: 全件PASS(Step 1で追加した5件を含む)

- [ ] **Step 5: 型チェック・ビルドを実行する**

Run: `npm run check`
Expected: shidasu関連の新規エラーなし

Run: `npm run build`
Expected: 成功

- [ ] **Step 6: コミット**

```bash
git add src/lib/game/shidasu/deck.ts src/lib/game/shidasu/deck.test.ts
git commit -m "$(cat <<'EOF'
feat: 黒赤スート片方統一ヘルパー関数unifyBlackRedSuitsを実装

Co-Authored-By: Claude Sonnet 5 <noreply@anthropic.com>
EOF
)"
```

---

### Task 3: `beginRun`への反映とテスト追加

**Files:**
- Modify: `src/lib/game/shidasu/engine.ts:4` (import文)
- Modify: `src/lib/game/shidasu/engine.ts:1032-1054` (`beginRun`関数)
- Test: `src/lib/game/shidasu/engine.test.ts`

- [ ] **Step 1: 失敗するテストを書く**

`src/lib/game/shidasu/engine.test.ts`の2568-2571行目(「spreadIdを省略(fool)すると、deckCompositionは全カードremoved:falseのまま」テストの直後、`waveTarget`テストの前)に、以下のテストを追加する。

```ts
  test('spreadId=loversでは、deckCompositionの黒スート(♠♣)が片方のみ、赤スート(♥♦)が片方のみになる', () => {
    const run = beginRun(DEFAULT_PARAMS, 1, 'lovers')
    const distinctBlackSuits = new Set(run.deckComposition.filter(c => c.suit === '♠' || c.suit === '♣').map(c => c.suit))
    const distinctRedSuits = new Set(run.deckComposition.filter(c => c.suit === '♥' || c.suit === '♦').map(c => c.suit))
    expect(distinctBlackSuits.size).toBe(1)
    expect(distinctRedSuits.size).toBe(1)
  })

  test('spreadIdを省略(fool)すると、deckCompositionは4スート混在のまま', () => {
    const run = beginRun(DEFAULT_PARAMS, 1)
    const distinctSuits = new Set(run.deckComposition.map(c => c.suit))
    expect(distinctSuits.size).toBe(4)
  })
```

- [ ] **Step 2: テストが失敗することを確認する**

Run: `npm test -- engine.test.ts -t "lovers"`
Expected: FAIL — `run.deckComposition`が4スート混在のまま(まだ`beginRun`が`unifyBlackRedSuits`を反映していないため)

- [ ] **Step 3: `engine.ts`のimport文を変更する**

`src/lib/game/shidasu/engine.ts`の現在の内容(4行目):

```ts
import { createRng, shuffle, shuffleInPlace, standardDeckComposition, addCardsToDeckComposition, rollOffer } from './deck'
```

これを以下に変更する:

```ts
import { createRng, shuffle, shuffleInPlace, standardDeckComposition, addCardsToDeckComposition, rollOffer, unifyBlackRedSuits } from './deck'
```

- [ ] **Step 4: `beginRun`関数を変更する**

`src/lib/game/shidasu/engine.ts`の現在の内容(1032-1054行目):

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

これを以下に変更する:

```ts
export function beginRun(params: ShidasuParams, seed?: number, spreadId: SpreadId = 'fool'): RunState {
  const spreadConfig = params.spreads[spreadId]
  const initialExtraTableauRows = spreadConfig.initialExtraTableauRows
  const rand = createRng(seed ?? Math.floor(Math.random() * 999999) + 1)
  const initialStageStars = rollStageStars(params, rand)
  const oracleLevels = oracleLevelsWithUniformValue(spreadConfig.initialOracleLevel)
  const initialRun = createInitialRun()
  const deckCompositionAfterExclusion = spreadConfig.excludedRanks.length === 0
    ? initialRun.deckComposition
    : initialRun.deckComposition.map(c =>
        spreadConfig.excludedRanks.includes(c.rank) ? { ...c, removed: true } : c
      )
  const deckComposition = spreadConfig.unifyBlackRedSuits
    ? unifyBlackRedSuits(deckCompositionAfterExclusion, rand)
    : deckCompositionAfterExclusion
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

- [ ] **Step 5: テストが通ることを確認する**

Run: `npm test -- engine.test.ts -t "lovers"`
Expected: PASS (2件とも)

Run: `npm test -- engine.test.ts`
Expected: 全件PASS(既存テストは`fool`/`moon`/`pope`/`empress`/`magician`/`justice`のいずれも`unifyBlackRedSuits: false`のため、`deckComposition`計算に影響がないことを確認)

- [ ] **Step 6: 型チェック・ビルドを実行する**

Run: `npm run check`
Expected: shidasu関連の新規エラーなし

Run: `npm run build`
Expected: 成功

- [ ] **Step 7: コミット**

```bash
git add src/lib/game/shidasu/engine.ts src/lib/game/shidasu/engine.test.ts
git commit -m "$(cat <<'EOF'
feat: beginRunで恋人のunifyBlackRedSuitsを初期デッキに反映

Co-Authored-By: Claude Sonnet 5 <noreply@anthropic.com>
EOF
)"
```

---

### Task 4: `/admin/shidasu-spreads`にUI拡張し、最終動作確認する

**Files:**
- Modify: `src/routes/admin/shidasu-spreads/+page.svelte:141-153` (テーブルヘッダー)
- Modify: `src/routes/admin/shidasu-spreads/+page.svelte:198-211` (テーブル行)

このタスクは自動テストの対象外(admin画面はこのプロジェクトの既存方針として自動テストを書かない)。手を動かして直接修正し、ビルド・型チェック・ブラウザ確認で検証する。

`unifyBlackRedSuits`は真偽値フィールドのため、`hasValidationError`への追加バリデーションは不要(常に有効な値になる、既存の`bannedShopKinds`・`excludedRanks`と同じ扱い)。

- [ ] **Step 1: テーブルヘッダーに「黒赤スート統一」列を追加する**

`src/routes/admin/shidasu-spreads/+page.svelte`の現在の内容(141-153行目):

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
              <th class="px-2 py-1.5 text-left" style="width:7rem;">黒赤スート統一</th>
            </tr>
```

- [ ] **Step 2: テーブル行にチェックボックスを追加する**

`src/routes/admin/shidasu-spreads/+page.svelte`の現在の内容(198-211行目):

```svelte
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

これを以下に変更する:

```svelte
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
                <td class="px-2 py-1.5 align-top">
                  <input type="checkbox" bind:checked={entry.unifyBlackRedSuits} />
                </td>
```

- [ ] **Step 3: 型チェック・ビルドを実行する**

Run: `npm run check`
Expected: shidasu関連の新規エラーなし

Run: `npm run build`
Expected: 成功

- [ ] **Step 4: 全テストスイートを実行する**

Run: `npm test`
Expected: 全ファイル・全テストPASS(Task 1〜3で追加したテストを含む)

- [ ] **Step 5: 開発サーバーでブラウザ動作確認する**

Run: `npm run dev`(ポートが競合する場合は自動的に別ポートが割り当てられる。実際に使われたポート番号を確認すること)

ブラウザで以下を確認する。

1. `/admin/shidasu-spreads`を開き、テーブルに「恋人」(id: `lovers`)の行が表示されること。「黒赤スート統一」列は恋人のみチェックが入っており、他は全て未チェックであること
2. `/game/shidasu`のスプレッド選択画面に「恋人」が表示され、説明文が正しく表示されていること
3. 「恋人」を選んでランを開始し、Wave中に黒スートが♠・♣どちらか一方のみ、赤スートが♥・♦どちらか一方のみになっていることを確認する(場札・山札のカードを見て、黒スートの絵柄が統一されていること・赤スートの絵柄が統一されていることを目視、または複数回ランを開始して統一先が毎回変わりうることも確認できるとなお良い)
4. 「愚者」を選んでランを開始し、従来通り4スートが混在していること(回帰確認)

問題があれば修正し、Step 3〜4を再実行してから次に進む。

- [ ] **Step 6: `shidasu.config.json`が意図しない差分を持っていないか確認する**

ブラウザでのショップ操作等により`shidasu.config.json`が保存APIを通じて書き換わっていないか確認する。

Run: `git status`
Run: `git diff src/lib/game/shidasu/shidasu.config.json`

Task 1で行った変更以外の差分があれば(フォーマットの再整形等)、`git checkout -- src/lib/game/shidasu/shidasu.config.json`で復元してからTask 1の変更のみを再度適用する。差分がTask 1の内容と一致していることを確認できたら、このタスクは追加のコミットなしで完了(Task 1で既にコミット済みのため)。

- [ ] **Step 7: 開発サーバーを停止する**

動作確認が完了したら`npm run dev`のプロセスを停止する。

- [ ] **Step 8: コミット**

```bash
git add src/routes/admin/shidasu-spreads/+page.svelte
git commit -m "$(cat <<'EOF'
feat: /admin/shidasu-spreadsに黒赤スート統一列を追加

Co-Authored-By: Claude Sonnet 5 <noreply@anthropic.com>
EOF
)"
```

(Step 6で修正が発生した場合は、修正内容も同じコミットまたは追加のコミットに含める)
