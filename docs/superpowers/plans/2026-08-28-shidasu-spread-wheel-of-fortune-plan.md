# 新規スプレッド「運命の輪」 Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** 新規スプレッド「運命の輪」(`wheelOfFortune`)を追加する。選択すると、初期デッキ52枚それぞれのランク・スートが完全ランダムに再抽選された状態でスタートする。

**Architecture:** `SpreadConfig`に`randomizeDeck: boolean`フィールドを新設する。`deck.ts`に`randomizedDeckComposition`ヘルパー関数を新設し、52枚それぞれのsuit・rankを独立にランダム抽選する。`beginRun`(`engine.ts`)が既存の変換チェーン(`deckMultiplier`→`excludedRanks`→`unifyBlackRedSuits`)に、`deckMultiplier`の直後・`excludedRanks`の前という位置でランダム化のステップを挿入する。`/admin/shidasu-spreads`にも編集用の列を追加する。

**Tech Stack:** TypeScript, SvelteKit, Vitest

---

### Task 1: `SpreadId`型・`SpreadConfig`型の拡張と`SPREAD_IDS`・`DEFAULT_PARAMS`・`shidasu.config.json`の更新

**Files:**
- Modify: `src/lib/game/shidasu/types.ts:24-59` (`SpreadId`型・`SpreadConfig`型)
- Modify: `src/lib/game/shidasu/params.ts:341-350` (`DEFAULT_PARAMS.spreads`)
- Modify: `src/lib/game/shidasu/params.ts:637` (`SPREAD_IDS`)
- Modify: `src/lib/game/shidasu/shidasu.config.json:109-222` (`spreads`)
- Test: `src/lib/game/shidasu/params.test.ts`

- [ ] **Step 1: 失敗するテストを書く**

`src/lib/game/shidasu/params.test.ts`の112行目(「emperorの名称は皇帝〜」テストの直後)に、以下のテストを追加する。挿入位置は「emperorの名称は皇帝」というテスト名で検索して特定すること(他タスクのコミットにより正確な行番号は前後する可能性がある)。

```ts
  test('fool/moon/pope/empress/magician/justice/lovers/emperorのrandomizeDeckはfalse', () => {
    const nonWheelOfFortuneIds = ['fool', 'moon', 'pope', 'empress', 'magician', 'justice', 'lovers', 'emperor'] as const
    nonWheelOfFortuneIds.forEach(id => {
      expect(DEFAULT_PARAMS.spreads[id].randomizeDeck).toBe(false)
    })
  })

  test('wheelOfFortuneの名称は運命の輪、randomizeDeckはtrue、他のフィールドはfoolと同じ', () => {
    expect(DEFAULT_PARAMS.spreads.wheelOfFortune.name).toBe('運命の輪')
    expect(DEFAULT_PARAMS.spreads.wheelOfFortune.randomizeDeck).toBe(true)
    expect(DEFAULT_PARAMS.spreads.wheelOfFortune.initialExtraTableauRows).toBe(DEFAULT_PARAMS.spreads.fool.initialExtraTableauRows)
    expect(DEFAULT_PARAMS.spreads.wheelOfFortune.deckMultiplier).toBe(1)
    expect(DEFAULT_PARAMS.spreads.wheelOfFortune.tableauRowMultiplier).toBe(1)
    expect(DEFAULT_PARAMS.spreads.wheelOfFortune.targetScoreMultiplier).toBe(1)
    expect(DEFAULT_PARAMS.spreads.wheelOfFortune.initialOracleLevel).toBe(DEFAULT_PARAMS.spreads.fool.initialOracleLevel)
    expect(DEFAULT_PARAMS.spreads.wheelOfFortune.bannedShopKinds).toEqual([])
    expect(DEFAULT_PARAMS.spreads.wheelOfFortune.initialCurrencyBonus).toBe(0)
    expect(DEFAULT_PARAMS.spreads.wheelOfFortune.initialItemCapacityBonus).toBe(0)
    expect(DEFAULT_PARAMS.spreads.wheelOfFortune.excludedRanks).toEqual([])
    expect(DEFAULT_PARAMS.spreads.wheelOfFortune.unifyBlackRedSuits).toBe(false)
  })
```

- [ ] **Step 2: テストが失敗することを確認する**

Run: `npm test -- params.test.ts`
Expected: FAIL — `DEFAULT_PARAMS.spreads.wheelOfFortune`が`undefined`、または`randomizeDeck`プロパティが存在しない

- [ ] **Step 3: `types.ts`の`SpreadId`型・`SpreadConfig`型を変更する**

`src/lib/game/shidasu/types.ts`の現在の内容(24-59行目):

```ts
// スプレッド: ラン開始時にプレイヤーが選ぶ固有ルールセット。大アルカナから命名する。
// fool(愚者)=特殊ルールなしの基本スプレッド、moon(月)=場札が常に1行少ない状態で始まる、
// pope(教皇)=神託の初期レベルが上がるが、ショップで神託が販売されない、
// empress(女帝)=初期所持金が多い状態で始まる、magician(魔術師)=護符所持スロットが多いが場札が少ない、
// justice(正義)=初期デッキから絵札(J・Q・K)が除外される、
// lovers(恋人)=初期デッキの黒スート(♠♣)・赤スート(♥♦)がそれぞれランダムに片方へ統一される、
// emperor(皇帝)=初期デッキ・場札・目標スコアが全て2倍になるが、護符所持スロットが1減る
export type SpreadId = 'fool' | 'moon' | 'pope' | 'empress' | 'magician' | 'justice' | 'lovers' | 'emperor'
// スプレッドごとの固有ルール設定。
export interface SpreadConfig {
  name: string
  desc: string
  // ウェーブ開始時の配布行数への初期オフセット(既存)。
  initialExtraTableauRows: number
  // 初期デッキ生成時、標準デッキ(52枚)を何組連結するか(既定1)。2ならデッキ枚数が2倍(104枚)になる。
  deckMultiplier: number
  // 場札の配布行数への倍率(既定1)。ラン開始時、
  // params.layout.rows * tableauRowMultiplier - params.layout.rows を
  // initialExtraTableauRowsに加算する形で反映する(基準行数の変更に自動追従するため)。
  tableauRowMultiplier: number
  // 目標スコア(waveTarget)への倍率(既定1)。
  targetScoreMultiplier: number
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

これを以下に変更する:

```ts
// スプレッド: ラン開始時にプレイヤーが選ぶ固有ルールセット。大アルカナから命名する。
// fool(愚者)=特殊ルールなしの基本スプレッド、moon(月)=場札が常に1行少ない状態で始まる、
// pope(教皇)=神託の初期レベルが上がるが、ショップで神託が販売されない、
// empress(女帝)=初期所持金が多い状態で始まる、magician(魔術師)=護符所持スロットが多いが場札が少ない、
// justice(正義)=初期デッキから絵札(J・Q・K)が除外される、
// lovers(恋人)=初期デッキの黒スート(♠♣)・赤スート(♥♦)がそれぞれランダムに片方へ統一される、
// emperor(皇帝)=初期デッキ・場札・目標スコアが全て2倍になるが、護符所持スロットが1減る、
// wheelOfFortune(運命の輪)=初期デッキ52枚それぞれのランク・スートが完全ランダムに再抽選される
export type SpreadId = 'fool' | 'moon' | 'pope' | 'empress' | 'magician' | 'justice' | 'lovers' | 'emperor' | 'wheelOfFortune'
// スプレッドごとの固有ルール設定。
export interface SpreadConfig {
  name: string
  desc: string
  // ウェーブ開始時の配布行数への初期オフセット(既存)。
  initialExtraTableauRows: number
  // 初期デッキ生成時、標準デッキ(52枚)を何組連結するか(既定1)。2ならデッキ枚数が2倍(104枚)になる。
  deckMultiplier: number
  // 場札の配布行数への倍率(既定1)。ラン開始時、
  // params.layout.rows * tableauRowMultiplier - params.layout.rows を
  // initialExtraTableauRowsに加算する形で反映する(基準行数の変更に自動追従するため)。
  tableauRowMultiplier: number
  // 目標スコア(waveTarget)への倍率(既定1)。
  targetScoreMultiplier: number
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
  // 初期デッキ生成時、52枚それぞれのsuit・rankを独立にランダム抽選するか(既定false)。
  // trueの場合、deckMultiplierによる複製結果を上書きする(52枚固定生成のため)。
  randomizeDeck: boolean
}
```

- [ ] **Step 4: `params.ts`の`DEFAULT_PARAMS.spreads`を変更する**

`src/lib/game/shidasu/params.ts`の現在の内容(341-350行目):

```ts
  spreads: {
    fool: { name: '愚者', desc: '特殊ルールなし', initialExtraTableauRows: 0, deckMultiplier: 1, tableauRowMultiplier: 1, targetScoreMultiplier: 1, initialOracleLevel: 1, bannedShopKinds: [], initialCurrencyBonus: 0, initialItemCapacityBonus: 0, excludedRanks: [], unifyBlackRedSuits: false },
    moon: { name: '月', desc: '場札が常に1行多い状態で始まる。Wave開始時に配られる場札の上半分(端数切捨て)の行は裏向きになる。', initialExtraTableauRows: 1, deckMultiplier: 1, tableauRowMultiplier: 1, targetScoreMultiplier: 1, initialOracleLevel: 1, bannedShopKinds: [], initialCurrencyBonus: 0, initialItemCapacityBonus: 0, excludedRanks: [], unifyBlackRedSuits: false },
    pope: { name: '教皇', desc: '神託の初期レベルが5になるが、ショップで神託が販売されない', initialExtraTableauRows: 0, deckMultiplier: 1, tableauRowMultiplier: 1, targetScoreMultiplier: 1, initialOracleLevel: 5, bannedShopKinds: ['oracle'], initialCurrencyBonus: 0, initialItemCapacityBonus: 0, excludedRanks: [], unifyBlackRedSuits: false },
    empress: { name: '女帝', desc: '初期所持金が10多い状態で始まる', initialExtraTableauRows: 0, deckMultiplier: 1, tableauRowMultiplier: 1, targetScoreMultiplier: 1, initialOracleLevel: 1, bannedShopKinds: [], initialCurrencyBonus: 10, initialItemCapacityBonus: 0, excludedRanks: [], unifyBlackRedSuits: false },
    magician: { name: '魔術師', desc: '護符の所持スロットが1多いが、場札は1行少ない状態で始まる', initialExtraTableauRows: -1, deckMultiplier: 1, tableauRowMultiplier: 1, targetScoreMultiplier: 1, initialOracleLevel: 1, bannedShopKinds: [], initialCurrencyBonus: 0, initialItemCapacityBonus: 1, excludedRanks: [], unifyBlackRedSuits: false },
    justice: { name: '正義', desc: '初期デッキから絵札(J・Q・K)が除外された状態で始まる', initialExtraTableauRows: 0, deckMultiplier: 1, tableauRowMultiplier: 1, targetScoreMultiplier: 1, initialOracleLevel: 1, bannedShopKinds: [], initialCurrencyBonus: 0, initialItemCapacityBonus: 0, excludedRanks: [11, 12, 13], unifyBlackRedSuits: false },
    lovers: { name: '恋人', desc: '初期デッキの黒スート(♠♣)・赤スート(♥♦)が、それぞれランダムにどちらか一方へ統一された状態で始まる', initialExtraTableauRows: 0, deckMultiplier: 1, tableauRowMultiplier: 1, targetScoreMultiplier: 1, initialOracleLevel: 1, bannedShopKinds: [], initialCurrencyBonus: 0, initialItemCapacityBonus: 0, excludedRanks: [], unifyBlackRedSuits: true },
    emperor: { name: '皇帝', desc: '初期デッキの枚数・場札の配布行数・目標スコアが全て2倍になるが、護符の所持スロットが1減った状態で始まる', initialExtraTableauRows: 0, deckMultiplier: 2, tableauRowMultiplier: 2, targetScoreMultiplier: 2, initialOracleLevel: 1, bannedShopKinds: [], initialCurrencyBonus: 0, initialItemCapacityBonus: -1, excludedRanks: [], unifyBlackRedSuits: false },
  },
```

これを以下に変更する:

```ts
  spreads: {
    fool: { name: '愚者', desc: '特殊ルールなし', initialExtraTableauRows: 0, deckMultiplier: 1, tableauRowMultiplier: 1, targetScoreMultiplier: 1, initialOracleLevel: 1, bannedShopKinds: [], initialCurrencyBonus: 0, initialItemCapacityBonus: 0, excludedRanks: [], unifyBlackRedSuits: false, randomizeDeck: false },
    moon: { name: '月', desc: '場札が常に1行多い状態で始まる。Wave開始時に配られる場札の上半分(端数切捨て)の行は裏向きになる。', initialExtraTableauRows: 1, deckMultiplier: 1, tableauRowMultiplier: 1, targetScoreMultiplier: 1, initialOracleLevel: 1, bannedShopKinds: [], initialCurrencyBonus: 0, initialItemCapacityBonus: 0, excludedRanks: [], unifyBlackRedSuits: false, randomizeDeck: false },
    pope: { name: '教皇', desc: '神託の初期レベルが5になるが、ショップで神託が販売されない', initialExtraTableauRows: 0, deckMultiplier: 1, tableauRowMultiplier: 1, targetScoreMultiplier: 1, initialOracleLevel: 5, bannedShopKinds: ['oracle'], initialCurrencyBonus: 0, initialItemCapacityBonus: 0, excludedRanks: [], unifyBlackRedSuits: false, randomizeDeck: false },
    empress: { name: '女帝', desc: '初期所持金が10多い状態で始まる', initialExtraTableauRows: 0, deckMultiplier: 1, tableauRowMultiplier: 1, targetScoreMultiplier: 1, initialOracleLevel: 1, bannedShopKinds: [], initialCurrencyBonus: 10, initialItemCapacityBonus: 0, excludedRanks: [], unifyBlackRedSuits: false, randomizeDeck: false },
    magician: { name: '魔術師', desc: '護符の所持スロットが1多いが、場札は1行少ない状態で始まる', initialExtraTableauRows: -1, deckMultiplier: 1, tableauRowMultiplier: 1, targetScoreMultiplier: 1, initialOracleLevel: 1, bannedShopKinds: [], initialCurrencyBonus: 0, initialItemCapacityBonus: 1, excludedRanks: [], unifyBlackRedSuits: false, randomizeDeck: false },
    justice: { name: '正義', desc: '初期デッキから絵札(J・Q・K)が除外された状態で始まる', initialExtraTableauRows: 0, deckMultiplier: 1, tableauRowMultiplier: 1, targetScoreMultiplier: 1, initialOracleLevel: 1, bannedShopKinds: [], initialCurrencyBonus: 0, initialItemCapacityBonus: 0, excludedRanks: [11, 12, 13], unifyBlackRedSuits: false, randomizeDeck: false },
    lovers: { name: '恋人', desc: '初期デッキの黒スート(♠♣)・赤スート(♥♦)が、それぞれランダムにどちらか一方へ統一された状態で始まる', initialExtraTableauRows: 0, deckMultiplier: 1, tableauRowMultiplier: 1, targetScoreMultiplier: 1, initialOracleLevel: 1, bannedShopKinds: [], initialCurrencyBonus: 0, initialItemCapacityBonus: 0, excludedRanks: [], unifyBlackRedSuits: true, randomizeDeck: false },
    emperor: { name: '皇帝', desc: '初期デッキの枚数・場札の配布行数・目標スコアが全て2倍になるが、護符の所持スロットが1減った状態で始まる', initialExtraTableauRows: 0, deckMultiplier: 2, tableauRowMultiplier: 2, targetScoreMultiplier: 2, initialOracleLevel: 1, bannedShopKinds: [], initialCurrencyBonus: 0, initialItemCapacityBonus: -1, excludedRanks: [], unifyBlackRedSuits: false, randomizeDeck: false },
    wheelOfFortune: { name: '運命の輪', desc: '初期デッキ52枚それぞれのランク・スートが完全ランダムに再抽選された状態で始まる', initialExtraTableauRows: 0, deckMultiplier: 1, tableauRowMultiplier: 1, targetScoreMultiplier: 1, initialOracleLevel: 1, bannedShopKinds: [], initialCurrencyBonus: 0, initialItemCapacityBonus: 0, excludedRanks: [], unifyBlackRedSuits: false, randomizeDeck: true },
  },
```

- [ ] **Step 5: `params.ts`の`SPREAD_IDS`を変更する**

`export const SPREAD_IDS`で検索して正確な位置を確認する(Step 4の変更により行番号は前後する可能性がある)。現在の内容:

```ts
export const SPREAD_IDS: SpreadId[] = ['fool', 'moon', 'pope', 'empress', 'magician', 'justice', 'lovers', 'emperor']
```

これを以下に変更する:

```ts
export const SPREAD_IDS: SpreadId[] = ['fool', 'moon', 'pope', 'empress', 'magician', 'justice', 'lovers', 'emperor', 'wheelOfFortune']
```

- [ ] **Step 6: `shidasu.config.json`の`spreads`を変更する**

`src/lib/game/shidasu/shidasu.config.json`の現在の内容(109-222行目):

```json
  "spreads": {
    "fool": {
      "name": "愚者",
      "desc": "特殊ルールなし",
      "initialExtraTableauRows": 0,
      "deckMultiplier": 1,
      "tableauRowMultiplier": 1,
      "targetScoreMultiplier": 1,
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
      "deckMultiplier": 1,
      "tableauRowMultiplier": 1,
      "targetScoreMultiplier": 1,
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
      "deckMultiplier": 1,
      "tableauRowMultiplier": 1,
      "targetScoreMultiplier": 1,
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
      "deckMultiplier": 1,
      "tableauRowMultiplier": 1,
      "targetScoreMultiplier": 1,
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
      "deckMultiplier": 1,
      "tableauRowMultiplier": 1,
      "targetScoreMultiplier": 1,
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
      "deckMultiplier": 1,
      "tableauRowMultiplier": 1,
      "targetScoreMultiplier": 1,
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
      "deckMultiplier": 1,
      "tableauRowMultiplier": 1,
      "targetScoreMultiplier": 1,
      "initialOracleLevel": 1,
      "bannedShopKinds": [],
      "initialCurrencyBonus": 0,
      "initialItemCapacityBonus": 0,
      "excludedRanks": [],
      "unifyBlackRedSuits": true
    },
    "emperor": {
      "name": "皇帝",
      "desc": "初期デッキの枚数・場札の配布行数・目標スコアが全て2倍になるが、護符の所持スロットが1減った状態で始まる",
      "initialExtraTableauRows": 0,
      "deckMultiplier": 2,
      "tableauRowMultiplier": 2,
      "targetScoreMultiplier": 2,
      "initialOracleLevel": 1,
      "bannedShopKinds": [],
      "initialCurrencyBonus": 0,
      "initialItemCapacityBonus": -1,
      "excludedRanks": [],
      "unifyBlackRedSuits": false
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
      "deckMultiplier": 1,
      "tableauRowMultiplier": 1,
      "targetScoreMultiplier": 1,
      "initialOracleLevel": 1,
      "bannedShopKinds": [],
      "initialCurrencyBonus": 0,
      "initialItemCapacityBonus": 0,
      "excludedRanks": [],
      "unifyBlackRedSuits": false,
      "randomizeDeck": false
    },
    "moon": {
      "name": "月",
      "desc": "場札が常に1行多い状態で始まる。Wave開始時に配られる場札の上半分(端数切捨て)の行は裏向きになる。",
      "initialExtraTableauRows": 1,
      "deckMultiplier": 1,
      "tableauRowMultiplier": 1,
      "targetScoreMultiplier": 1,
      "initialOracleLevel": 1,
      "bannedShopKinds": [],
      "initialCurrencyBonus": 0,
      "initialItemCapacityBonus": 0,
      "excludedRanks": [],
      "unifyBlackRedSuits": false,
      "randomizeDeck": false
    },
    "pope": {
      "name": "教皇",
      "desc": "神託の初期レベルが5になるが、ショップで神託が販売されない",
      "initialExtraTableauRows": 0,
      "deckMultiplier": 1,
      "tableauRowMultiplier": 1,
      "targetScoreMultiplier": 1,
      "initialOracleLevel": 5,
      "bannedShopKinds": ["oracle"],
      "initialCurrencyBonus": 0,
      "initialItemCapacityBonus": 0,
      "excludedRanks": [],
      "unifyBlackRedSuits": false,
      "randomizeDeck": false
    },
    "empress": {
      "name": "女帝",
      "desc": "初期所持金が10多い状態で始まる",
      "initialExtraTableauRows": 0,
      "deckMultiplier": 1,
      "tableauRowMultiplier": 1,
      "targetScoreMultiplier": 1,
      "initialOracleLevel": 1,
      "bannedShopKinds": [],
      "initialCurrencyBonus": 10,
      "initialItemCapacityBonus": 0,
      "excludedRanks": [],
      "unifyBlackRedSuits": false,
      "randomizeDeck": false
    },
    "magician": {
      "name": "魔術師",
      "desc": "護符の所持スロットが1多いが、場札は1行少ない状態で始まる",
      "initialExtraTableauRows": -1,
      "deckMultiplier": 1,
      "tableauRowMultiplier": 1,
      "targetScoreMultiplier": 1,
      "initialOracleLevel": 1,
      "bannedShopKinds": [],
      "initialCurrencyBonus": 0,
      "initialItemCapacityBonus": 1,
      "excludedRanks": [],
      "unifyBlackRedSuits": false,
      "randomizeDeck": false
    },
    "justice": {
      "name": "正義",
      "desc": "初期デッキから絵札(J・Q・K)が除外された状態で始まる",
      "initialExtraTableauRows": 0,
      "deckMultiplier": 1,
      "tableauRowMultiplier": 1,
      "targetScoreMultiplier": 1,
      "initialOracleLevel": 1,
      "bannedShopKinds": [],
      "initialCurrencyBonus": 0,
      "initialItemCapacityBonus": 0,
      "excludedRanks": [11, 12, 13],
      "unifyBlackRedSuits": false,
      "randomizeDeck": false
    },
    "lovers": {
      "name": "恋人",
      "desc": "初期デッキの黒スート(♠♣)・赤スート(♥♦)が、それぞれランダムにどちらか一方へ統一された状態で始まる",
      "initialExtraTableauRows": 0,
      "deckMultiplier": 1,
      "tableauRowMultiplier": 1,
      "targetScoreMultiplier": 1,
      "initialOracleLevel": 1,
      "bannedShopKinds": [],
      "initialCurrencyBonus": 0,
      "initialItemCapacityBonus": 0,
      "excludedRanks": [],
      "unifyBlackRedSuits": true,
      "randomizeDeck": false
    },
    "emperor": {
      "name": "皇帝",
      "desc": "初期デッキの枚数・場札の配布行数・目標スコアが全て2倍になるが、護符の所持スロットが1減った状態で始まる",
      "initialExtraTableauRows": 0,
      "deckMultiplier": 2,
      "tableauRowMultiplier": 2,
      "targetScoreMultiplier": 2,
      "initialOracleLevel": 1,
      "bannedShopKinds": [],
      "initialCurrencyBonus": 0,
      "initialItemCapacityBonus": -1,
      "excludedRanks": [],
      "unifyBlackRedSuits": false,
      "randomizeDeck": false
    },
    "wheelOfFortune": {
      "name": "運命の輪",
      "desc": "初期デッキ52枚それぞれのランク・スートが完全ランダムに再抽選された状態で始まる",
      "initialExtraTableauRows": 0,
      "deckMultiplier": 1,
      "tableauRowMultiplier": 1,
      "targetScoreMultiplier": 1,
      "initialOracleLevel": 1,
      "bannedShopKinds": [],
      "initialCurrencyBonus": 0,
      "initialItemCapacityBonus": 0,
      "excludedRanks": [],
      "unifyBlackRedSuits": false,
      "randomizeDeck": true
    }
  },
```

- [ ] **Step 7: テストが通ることを確認する**

Run: `npm test -- params.test.ts`
Expected: PASS(Step 1で追加した2件を含め全件)

- [ ] **Step 8: 型チェックを実行する**

Run: `npm run check`
Expected: `params.ts`・`types.ts`・`shidasu.config.json`・`params.test.ts`に起因する新規エラーなし。他のファイル(admin画面、`engine.ts`等)は後続タスクで修正するため、そちらのエラーは残る想定。それは無視して構わない

- [ ] **Step 9: コミット**

```bash
git add src/lib/game/shidasu/types.ts src/lib/game/shidasu/params.ts src/lib/game/shidasu/shidasu.config.json src/lib/game/shidasu/params.test.ts
git commit -m "$(cat <<'EOF'
feat: 新規スプレッド「運命の輪」を追加し、randomizeDeckフィールドを新設

Co-Authored-By: Claude Sonnet 5 <noreply@anthropic.com>
EOF
)"
```

---

### Task 2: ランダムデッキ生成ヘルパー関数の実装(`deck.ts`)

**Files:**
- Modify: `src/lib/game/shidasu/deck.ts:29-43` (`multipliedDeckComposition`の直後に新規関数を追加)
- Test: `src/lib/game/shidasu/deck.test.ts`

- [ ] **Step 1: 失敗するテストを書く**

`src/lib/game/shidasu/deck.test.ts`のimport文(2行目)を以下のように変更する(`randomizedDeckComposition`を追加):

現在の内容:

```ts
import { createDeck, createRng, rollOffer, shuffle, standardDeckComposition, addCardsToDeckComposition, unifyBlackRedSuits, multipliedDeckComposition } from './deck'
```

これを以下に変更する:

```ts
import { createDeck, createRng, rollOffer, shuffle, standardDeckComposition, addCardsToDeckComposition, unifyBlackRedSuits, multipliedDeckComposition, randomizedDeckComposition } from './deck'
```

ファイル末尾(258行目、`multipliedDeckComposition`の`describe`ブロックの直後)に、以下のテストを追加する。

```ts

describe('randomizedDeckComposition', () => {
  test('52枚生成される', () => {
    const result = randomizedDeckComposition(createRng(1))
    expect(result).toHaveLength(52)
  })

  test('deckIdは0〜51の重複しない連番になる', () => {
    const result = randomizedDeckComposition(createRng(1))
    const deckIds = result.map(c => c.deckId).sort((a, b) => a - b)
    expect(deckIds).toEqual(Array.from({ length: 52 }, (_, i) => i))
  })

  test('全カードがwild:false, removed:falseで生成される', () => {
    const result = randomizedDeckComposition(createRng(1))
    expect(result.every(c => c.wild === false && c.removed === false)).toBe(true)
  })

  test('同じシードのrandなら同じ結果になる(決定的)', () => {
    const a = randomizedDeckComposition(createRng(42))
    const b = randomizedDeckComposition(createRng(42))
    expect(a).toEqual(b)
  })

  test('rand()を104回(52枚×suit・rankの2回)消費する', () => {
    let callCount = 0
    const countingRand = () => {
      callCount++
      return Math.random()
    }
    randomizedDeckComposition(countingRand)
    expect(callCount).toBe(104)
  })

  test('生成される各カードのsuitは4種のいずれか、rankは1〜13の範囲に収まる', () => {
    const result = randomizedDeckComposition(createRng(1))
    const validSuits = ['♠', '♥', '♦', '♣']
    result.forEach(c => {
      expect(validSuits).toContain(c.suit)
      expect(c.rank).toBeGreaterThanOrEqual(1)
      expect(c.rank).toBeLessThanOrEqual(13)
    })
  })
})
```

- [ ] **Step 2: テストが失敗することを確認する**

Run: `npm test -- deck.test.ts -t "randomizedDeckComposition"`
Expected: FAIL — `randomizedDeckComposition`が`deck.ts`からエクスポートされていないため、importエラーまたは関数未定義エラーになる

- [ ] **Step 3: `deck.ts`に`randomizedDeckComposition`関数を実装する**

`src/lib/game/shidasu/deck.ts`の現在の内容(29-43行目):

```ts
// 標準デッキ(52枚)をmultiplier組連結したdeckCompositionを生成する。deckIdは重複しないよう
// 通し番号で振り直す(例: multiplier=2なら0〜103の104個)。multiplier=1のときは
// standardDeckComposition()と同じ結果になる。
export function multipliedDeckComposition(multiplier: number): DeckCard[] {
  const composition: DeckCard[] = []
  let deckId = 0
  for (let i = 0; i < multiplier; i++) {
    for (const suit of SUITS) {
      for (let rank = 1; rank <= 13; rank++) {
        composition.push({ deckId: deckId++, suit, rank: rank as Rank, wild: false, removed: false })
      }
    }
  }
  return composition
}
```

これを以下に変更する(直後に新規関数を追加):

```ts
// 標準デッキ(52枚)をmultiplier組連結したdeckCompositionを生成する。deckIdは重複しないよう
// 通し番号で振り直す(例: multiplier=2なら0〜103の104個)。multiplier=1のときは
// standardDeckComposition()と同じ結果になる。
export function multipliedDeckComposition(multiplier: number): DeckCard[] {
  const composition: DeckCard[] = []
  let deckId = 0
  for (let i = 0; i < multiplier; i++) {
    for (const suit of SUITS) {
      for (let rank = 1; rank <= 13; rank++) {
        composition.push({ deckId: deckId++, suit, rank: rank as Rank, wild: false, removed: false })
      }
    }
  }
  return composition
}

// 52枚それぞれのsuit・rankを独立にランダム抽選したdeckCompositionを生成する。
// 同じカード(同suit×同rank)が複数枚存在したり、特定のsuit・rankが1枚も
// 存在しなかったりする可能性がある。deckIdは0〜51の連番。
export function randomizedDeckComposition(rand: () => number): DeckCard[] {
  const composition: DeckCard[] = []
  for (let deckId = 0; deckId < 52; deckId++) {
    const suit = SUITS[Math.floor(rand() * SUITS.length)]
    const rank = (Math.floor(rand() * 13) + 1) as Rank
    composition.push({ deckId, suit, rank, wild: false, removed: false })
  }
  return composition
}
```

- [ ] **Step 4: テストが通ることを確認する**

Run: `npm test -- deck.test.ts`
Expected: 全件PASS(Step 1で追加した6件を含む)

- [ ] **Step 5: 型チェック・ビルドを実行する**

Run: `npm run check`
Expected: `deck.ts`・`deck.test.ts`に起因する新規エラーなし

Run: `npm run build`
Expected: 成功

- [ ] **Step 6: コミット**

```bash
git add src/lib/game/shidasu/deck.ts src/lib/game/shidasu/deck.test.ts
git commit -m "$(cat <<'EOF'
feat: 52枚のsuit・rankを独立ランダム抽選するrandomizedDeckComposition関数を実装

Co-Authored-By: Claude Sonnet 5 <noreply@anthropic.com>
EOF
)"
```

---

### Task 3: `beginRun`へのランダムデッキ生成の反映

**Files:**
- Modify: `src/lib/game/shidasu/engine.ts:4` (import文)
- Modify: `src/lib/game/shidasu/engine.ts:1034-1063` (`beginRun`関数)
- Test: `src/lib/game/shidasu/engine.test.ts`

- [ ] **Step 1: 失敗するテストを書く**

`src/lib/game/shidasu/engine.test.ts`を開き、「spreadIdを省略(fool)すると、deckCompositionは52枚のまま、extraTableauRowsは0のまま」というテスト名で検索してその位置を特定する(Task 1・2のコミットにより正確な行番号は前後する可能性がある)。このテストの直後、「waveTargetはflow.stageTargetBase・stageTargetMultiplierとstageStarsの倍率を参照する」テストの前に、以下のテストを追加する。

```ts
  test('spreadId=wheelOfFortuneでは、deckCompositionが52枚のまま生成される', () => {
    const run = beginRun(DEFAULT_PARAMS, 1, 'wheelOfFortune')
    expect(run.deckComposition).toHaveLength(52)
  })

  test('spreadId=wheelOfFortuneでは、deckCompositionの全カードがwild:false, removed:falseになる', () => {
    const run = beginRun(DEFAULT_PARAMS, 1, 'wheelOfFortune')
    expect(run.deckComposition.every(c => c.wild === false && c.removed === false)).toBe(true)
  })

  test('spreadId=wheelOfFortuneでも、同じseedなら同じdeckCompositionになる(決定的)', () => {
    const runA = beginRun(DEFAULT_PARAMS, 1, 'wheelOfFortune')
    const runB = beginRun(DEFAULT_PARAMS, 1, 'wheelOfFortune')
    expect(runA.deckComposition).toEqual(runB.deckComposition)
  })
```

- [ ] **Step 2: テストが失敗することを確認する**

Run: `npm test -- engine.test.ts -t "wheelOfFortune"`
Expected: FAIL — `beginRun`が`randomizeDeck`をまだ反映していないため、`wheelOfFortune`でも`fool`と同じ標準デッキ(4スート×13ランク固定)が生成される(1件目・2件目のテスト自体は52枚・wild:false/removed:falseという点では偶然パスする可能性があるが、少なくとも本来の目的である「ランダム化」が実装されていないため、後続タスクとの整合を取るためにまずは失敗確認のプロセスを踏む。もし1〜2件目が通ってしまっても3件目で決定性を検証しているため、実装後の差分確認を兼ねて先に進めてよい)

- [ ] **Step 3: `engine.ts`のimport文を変更する**

`src/lib/game/shidasu/engine.ts`の現在の内容(4行目):

```ts
import { createRng, shuffle, shuffleInPlace, standardDeckComposition, addCardsToDeckComposition, rollOffer, unifyBlackRedSuits, multipliedDeckComposition } from './deck'
```

これを以下に変更する:

```ts
import { createRng, shuffle, shuffleInPlace, standardDeckComposition, addCardsToDeckComposition, rollOffer, unifyBlackRedSuits, multipliedDeckComposition, randomizedDeckComposition } from './deck'
```

- [ ] **Step 4: `beginRun`関数を変更する**

`src/lib/game/shidasu/engine.ts`の現在の内容(1034-1063行目、`export function beginRun`で検索して正確な位置を確認すること):

```ts
export function beginRun(params: ShidasuParams, seed?: number, spreadId: SpreadId = 'fool'): RunState {
  const spreadConfig = params.spreads[spreadId]
  const extraRowsFromMultiplier = params.layout.rows * spreadConfig.tableauRowMultiplier - params.layout.rows
  const initialExtraTableauRows = spreadConfig.initialExtraTableauRows + extraRowsFromMultiplier
  const rand = createRng(seed ?? Math.floor(Math.random() * 999999) + 1)
  const initialStageStars = rollStageStars(params, rand)
  const oracleLevels = oracleLevelsWithUniformValue(spreadConfig.initialOracleLevel)
  const initialRun = createInitialRun()
  const baseDeckComposition = spreadConfig.deckMultiplier === 1
    ? initialRun.deckComposition
    : multipliedDeckComposition(spreadConfig.deckMultiplier)
  const deckCompositionAfterExclusion = spreadConfig.excludedRanks.length === 0
    ? baseDeckComposition
    : baseDeckComposition.map(c =>
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

これを以下に変更する:

```ts
export function beginRun(params: ShidasuParams, seed?: number, spreadId: SpreadId = 'fool'): RunState {
  const spreadConfig = params.spreads[spreadId]
  const extraRowsFromMultiplier = params.layout.rows * spreadConfig.tableauRowMultiplier - params.layout.rows
  const initialExtraTableauRows = spreadConfig.initialExtraTableauRows + extraRowsFromMultiplier
  const rand = createRng(seed ?? Math.floor(Math.random() * 999999) + 1)
  const initialStageStars = rollStageStars(params, rand)
  const oracleLevels = oracleLevelsWithUniformValue(spreadConfig.initialOracleLevel)
  const initialRun = createInitialRun()
  const baseDeckComposition = spreadConfig.deckMultiplier === 1
    ? initialRun.deckComposition
    : multipliedDeckComposition(spreadConfig.deckMultiplier)
  const deckCompositionAfterRandomize = spreadConfig.randomizeDeck
    ? randomizedDeckComposition(rand)
    : baseDeckComposition
  const deckCompositionAfterExclusion = spreadConfig.excludedRanks.length === 0
    ? deckCompositionAfterRandomize
    : deckCompositionAfterRandomize.map(c =>
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

Run: `npm test -- engine.test.ts -t "wheelOfFortune"`
Expected: PASS (3件とも)

Run: `npm test -- engine.test.ts`
Expected: 全件PASS(既存テストは`fool`/`moon`/`pope`/`empress`/`magician`/`justice`/`lovers`/`emperor`のいずれも`randomizeDeck: false`のため、`deckComposition`計算に影響がないことを確認)

- [ ] **Step 6: 型チェック・ビルドを実行する**

Run: `npm run check`
Expected: `engine.ts`・`engine.test.ts`に起因する新規エラーなし(admin画面のエラーは後続タスクの担当範囲なので無視してよい)

Run: `npm run build`
Expected: 成功

- [ ] **Step 7: コミット**

```bash
git add src/lib/game/shidasu/engine.ts src/lib/game/shidasu/engine.test.ts
git commit -m "$(cat <<'EOF'
feat: beginRunで運命の輪のrandomizeDeckを初期デッキに反映

Co-Authored-By: Claude Sonnet 5 <noreply@anthropic.com>
EOF
)"
```

---

### Task 4: 役判定への回帰確認と`/admin/shidasu-spreads`のUI更新・最終動作確認

**Files:**
- Modify: `src/routes/admin/shidasu-spreads/+page.svelte:154-155` (テーブルヘッダー)
- Modify: `src/routes/admin/shidasu-spreads/+page.svelte:218-220` (テーブル行)

このタスクは自動テストの対象外(admin画面はこのプロジェクトの既存方針として自動テストを書かない)。手を動かして直接修正し、ビルド・型チェック・ブラウザ確認で検証する。`randomizeDeck`は真偽値フィールドのため、`hasValidationError`への追加バリデーションは不要(常に有効な値になる、既存の`bannedShopKinds`・`excludedRanks`・`unifyBlackRedSuits`と同じ扱い)。

- [ ] **Step 1: テーブルヘッダーに「デッキランダム化」列を追加する**

`src/routes/admin/shidasu-spreads/+page.svelte`の現在の内容(142-156行目):

```svelte
            <tr class="bg-slate-50 text-slate-500">
              <th class="px-2 py-1.5 text-left" style="width:6rem;">id</th>
              <th class="px-2 py-1.5 text-left" style="width:6rem;">名称</th>
              <th class="px-2 py-1.5 text-left" style="width:16rem;">説明文</th>
              <th class="px-2 py-1.5 text-left" style="width:7rem;">初期行数オフセット</th>
              <th class="px-2 py-1.5 text-left" style="width:7rem;">デッキ枚数倍率</th>
              <th class="px-2 py-1.5 text-left" style="width:7rem;">場札行倍率</th>
              <th class="px-2 py-1.5 text-left" style="width:7rem;">目標スコア倍率</th>
              <th class="px-2 py-1.5 text-left" style="width:7rem;">神託初期レベル</th>
              <th class="px-2 py-1.5 text-left" style="width:7rem;">初期所持金オフセット</th>
              <th class="px-2 py-1.5 text-left" style="width:7rem;">護符所持スロットオフセット</th>
              <th class="px-2 py-1.5 text-left" style="width:12rem;">ショップ非販売種別</th>
              <th class="px-2 py-1.5 text-left" style="width:16rem;">除外ランク</th>
              <th class="px-2 py-1.5 text-left" style="width:7rem;">黒赤スート統一</th>
            </tr>
```

これを以下に変更する:

```svelte
            <tr class="bg-slate-50 text-slate-500">
              <th class="px-2 py-1.5 text-left" style="width:6rem;">id</th>
              <th class="px-2 py-1.5 text-left" style="width:6rem;">名称</th>
              <th class="px-2 py-1.5 text-left" style="width:16rem;">説明文</th>
              <th class="px-2 py-1.5 text-left" style="width:7rem;">初期行数オフセット</th>
              <th class="px-2 py-1.5 text-left" style="width:7rem;">デッキ枚数倍率</th>
              <th class="px-2 py-1.5 text-left" style="width:7rem;">場札行倍率</th>
              <th class="px-2 py-1.5 text-left" style="width:7rem;">目標スコア倍率</th>
              <th class="px-2 py-1.5 text-left" style="width:7rem;">神託初期レベル</th>
              <th class="px-2 py-1.5 text-left" style="width:7rem;">初期所持金オフセット</th>
              <th class="px-2 py-1.5 text-left" style="width:7rem;">護符所持スロットオフセット</th>
              <th class="px-2 py-1.5 text-left" style="width:12rem;">ショップ非販売種別</th>
              <th class="px-2 py-1.5 text-left" style="width:16rem;">除外ランク</th>
              <th class="px-2 py-1.5 text-left" style="width:7rem;">黒赤スート統一</th>
              <th class="px-2 py-1.5 text-left" style="width:7rem;">デッキランダム化</th>
            </tr>
```

- [ ] **Step 2: テーブル行にチェックボックスを追加する**

`src/routes/admin/shidasu-spreads/+page.svelte`の現在の内容(204-220行目):

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
                <td class="px-2 py-1.5 align-top">
                  <input type="checkbox" bind:checked={entry.randomizeDeck} />
                </td>
```

- [ ] **Step 3: 型チェック・ビルドを実行する**

Run: `npm run check`
Expected: shidasu関連の新規エラーなし(Task 1〜3で積み残っていた`admin/shidasu-spreads`関連の型エラーがこの時点で全て解消されるはず)

Run: `npm run build`
Expected: 成功

- [ ] **Step 4: 全テストスイートを実行する**

Run: `npm test`
Expected: 全ファイル・全テストPASS。特に`patterns.test.ts`(役判定関連のテストファイル)が全件PASSしていることを確認する。これにより、初期デッキが完全ランダム化された状況(同一カードの重複・特定ランク/スートの枯渇が起こりうる状況)でも、既存の役判定ロジックが壊れていないことを実際に担保する

- [ ] **Step 5: 開発サーバーでブラウザ動作確認する**

Run: `npm run dev`(ポートが競合する場合は自動的に別ポートが割り当てられる。実際に使われたポート番号を確認すること)

ブラウザで以下を確認する。

1. `/admin/shidasu-spreads`を開き、テーブルに「運命の輪」(id: `wheelOfFortune`)の行が表示されること。「デッキランダム化」列は運命の輪のみチェックが入っており、他は全て未チェックであること
2. `/game/shidasu`のスプレッド選択画面に「運命の輪」が表示され、説明文が正しく表示されていること
3. 「運命の輪」を選んでランを開始し、場札・山札のカードのランク・スートが標準デッキ(4スート×13ランクの規則的な並び)ではなく、明らかに不規則な分布になっていることを確認する(同じカードが複数見える、特定のスートに偏っている等)。複数回ランを開始し、毎回異なる分布になることも確認できるとなお良い
4. 「愚者」を選んでランを開始し、従来通り4スート×13ランクの標準デッキであること(回帰確認)
5. ゲームプレイ(カードを数枚プレイする)を行い、役判定(同ランク・同スート等)がエラーなく動作することを目視確認する

問題があれば修正し、Step 3〜4を再実行してから次に進む。

**重要**: 開発サーバーを停止する際は、`taskkill /F /IM node.exe`のような「全てのnode.exeプロセスを無条件に強制終了する」コマンドは絶対に使わないでください。このマシン上で動いている他のnode.jsプロセス(別プロジェクトの開発サーバー等)を巻き込んで終了させてしまう危険があります。必ず、あなたが今回起動した開発サーバーのプロセスIDを`netstat`等で特定してから、そのPIDだけを対象に`taskkill /F /PID <該当PIDのみ>`を実行するか、あるいはそのコマンドを実行したターミナル/バックグラウンドジョブ自体を終了させる方法を使ってください。

- [ ] **Step 6: `shidasu.config.json`が意図しない差分を持っていないか確認する**

ブラウザでのショップ操作等により`shidasu.config.json`が保存APIを通じて書き換わっていないか確認する。

Run: `git status`
Run: `git diff src/lib/game/shidasu/shidasu.config.json`

Task 1で行った変更以外の差分があれば(フォーマットの再整形等)、`git checkout -- src/lib/game/shidasu/shidasu.config.json`で復元してからTask 1の変更のみを再度適用する。差分がTask 1の内容と一致していることを確認できたら、このタスクは追加のコミットなしで完了(Task 1で既にコミット済みのため)。

- [ ] **Step 7: 開発サーバーを停止する**

動作確認が完了したら、Step 5に記載した安全な方法で`npm run dev`のプロセスを停止する。

- [ ] **Step 8: コミット**

```bash
git add src/routes/admin/shidasu-spreads/+page.svelte
git commit -m "$(cat <<'EOF'
feat: /admin/shidasu-spreadsにデッキランダム化列を追加

Co-Authored-By: Claude Sonnet 5 <noreply@anthropic.com>
EOF
)"
```

(Step 6で修正が発生した場合は、修正内容も同じコミットまたは追加のコミットに含める)
