# 新規スプレッド「力」(スート別ランダムワイルド化) Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** 「星詠みソリティア -Shidasu-」に新規スプレッド「力」(`strength`)を追加する。ラン開始時、初期デッキの4スート(♠♥♦♣)それぞれから、ワイルド化されていない・除外されていないカードを1枚ずつランダムに選び、`wild: true`に変換した状態でランを開始する(最大4枚がワイルド化される)。

**Architecture:** 既存の`SpreadConfig`型に`randomizeWildPerSuit: boolean`フィールドを新設し、`beginRun`(`engine.ts`)内の既存デッキ変換チェーン(`deckMultiplier` → `randomizeDeck` → `excludedRanks` → `unifyBlackRedSuits`)の最後に、スート別ワイルド化のステップを追加する。ワイルド化処理自体は既存の`convertRandomCardToWild`(護符「豊穣」が使用)と同型の新規関数`convertOneCardPerSuitToWild`を`engine.ts`に実装する。

**Tech Stack:** SvelteKit, Svelte 5 runes, TypeScript, Vitest

---

### Task 1: `SpreadId`型・`SpreadConfig`型の拡張と`SPREAD_IDS`・`DEFAULT_PARAMS`・`shidasu.config.json`の更新

**Files:**
- Modify: `src/lib/game/shidasu/types.ts:24-63` (`SpreadId`型・`SpreadConfig`型)
- Modify: `src/lib/game/shidasu/params.ts:341-351` (`DEFAULT_PARAMS.spreads`)
- Modify: `src/lib/game/shidasu/params.ts:638` (`SPREAD_IDS`)
- Modify: `src/lib/game/shidasu/shidasu.config.json:109-244` (`spreads`)
- Test: `src/lib/game/shidasu/params.test.ts`

- [ ] **Step 1: 失敗するテストを書く**

`src/lib/game/shidasu/params.test.ts`の134行目(「wheelOfFortuneの名称は運命の輪〜」テストの直後)に、以下のテストを追加する。挿入位置は「wheelOfFortuneの名称は運命の輪」というテスト名で検索して特定すること(他タスクのコミットにより正確な行番号は前後する可能性がある)。

```ts
  test('fool/moon/pope/empress/magician/justice/lovers/emperor/wheelOfFortuneのrandomizeWildPerSuitはfalse', () => {
    const nonStrengthIds = ['fool', 'moon', 'pope', 'empress', 'magician', 'justice', 'lovers', 'emperor', 'wheelOfFortune'] as const
    nonStrengthIds.forEach(id => {
      expect(DEFAULT_PARAMS.spreads[id].randomizeWildPerSuit).toBe(false)
    })
  })

  test('strengthの名称は力、randomizeWildPerSuitはtrue、他のフィールドはfoolと同じ', () => {
    expect(DEFAULT_PARAMS.spreads.strength.name).toBe('力')
    expect(DEFAULT_PARAMS.spreads.strength.randomizeWildPerSuit).toBe(true)
    expect(DEFAULT_PARAMS.spreads.strength.initialExtraTableauRows).toBe(DEFAULT_PARAMS.spreads.fool.initialExtraTableauRows)
    expect(DEFAULT_PARAMS.spreads.strength.deckMultiplier).toBe(1)
    expect(DEFAULT_PARAMS.spreads.strength.tableauRowMultiplier).toBe(1)
    expect(DEFAULT_PARAMS.spreads.strength.targetScoreMultiplier).toBe(1)
    expect(DEFAULT_PARAMS.spreads.strength.initialOracleLevel).toBe(DEFAULT_PARAMS.spreads.fool.initialOracleLevel)
    expect(DEFAULT_PARAMS.spreads.strength.bannedShopKinds).toEqual([])
    expect(DEFAULT_PARAMS.spreads.strength.initialCurrencyBonus).toBe(0)
    expect(DEFAULT_PARAMS.spreads.strength.initialItemCapacityBonus).toBe(0)
    expect(DEFAULT_PARAMS.spreads.strength.excludedRanks).toEqual([])
    expect(DEFAULT_PARAMS.spreads.strength.unifyBlackRedSuits).toBe(false)
    expect(DEFAULT_PARAMS.spreads.strength.randomizeDeck).toBe(false)
  })
```

- [ ] **Step 2: テストが失敗することを確認する**

Run: `npm test -- params.test.ts`
Expected: FAIL — `DEFAULT_PARAMS.spreads.strength`が`undefined`、または`randomizeWildPerSuit`プロパティが存在しない

- [ ] **Step 3: `types.ts`の`SpreadId`型・`SpreadConfig`型を変更する**

`src/lib/game/shidasu/types.ts`の現在の内容(24-63行目):

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

これを以下に変更する:

```ts
// スプレッド: ラン開始時にプレイヤーが選ぶ固有ルールセット。大アルカナから命名する。
// fool(愚者)=特殊ルールなしの基本スプレッド、moon(月)=場札が常に1行少ない状態で始まる、
// pope(教皇)=神託の初期レベルが上がるが、ショップで神託が販売されない、
// empress(女帝)=初期所持金が多い状態で始まる、magician(魔術師)=護符所持スロットが多いが場札が少ない、
// justice(正義)=初期デッキから絵札(J・Q・K)が除外される、
// lovers(恋人)=初期デッキの黒スート(♠♣)・赤スート(♥♦)がそれぞれランダムに片方へ統一される、
// emperor(皇帝)=初期デッキ・場札・目標スコアが全て2倍になるが、護符所持スロットが1減る、
// wheelOfFortune(運命の輪)=初期デッキ52枚それぞれのランク・スートが完全ランダムに再抽選される、
// strength(力)=初期デッキの各スートから1枚ずつランダムにワイルドへ変換された状態で始まる
export type SpreadId = 'fool' | 'moon' | 'pope' | 'empress' | 'magician' | 'justice' | 'lovers' | 'emperor' | 'wheelOfFortune' | 'strength'
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
  // 初期デッキ生成時、4スート(♠♥♦♣)それぞれから、ワイルドでも除外済みでもないカードを
  // 1枚ずつランダムに選びワイルドへ変換するか(既定false)。対象候補が0枚のスートはスキップする。
  randomizeWildPerSuit: boolean
}
```

- [ ] **Step 4: `params.ts`の`DEFAULT_PARAMS.spreads`を変更する**

`src/lib/game/shidasu/params.ts`の現在の内容(341-351行目):

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

これを以下に変更する:

```ts
  spreads: {
    fool: { name: '愚者', desc: '特殊ルールなし', initialExtraTableauRows: 0, deckMultiplier: 1, tableauRowMultiplier: 1, targetScoreMultiplier: 1, initialOracleLevel: 1, bannedShopKinds: [], initialCurrencyBonus: 0, initialItemCapacityBonus: 0, excludedRanks: [], unifyBlackRedSuits: false, randomizeDeck: false, randomizeWildPerSuit: false },
    moon: { name: '月', desc: '場札が常に1行多い状態で始まる。Wave開始時に配られる場札の上半分(端数切捨て)の行は裏向きになる。', initialExtraTableauRows: 1, deckMultiplier: 1, tableauRowMultiplier: 1, targetScoreMultiplier: 1, initialOracleLevel: 1, bannedShopKinds: [], initialCurrencyBonus: 0, initialItemCapacityBonus: 0, excludedRanks: [], unifyBlackRedSuits: false, randomizeDeck: false, randomizeWildPerSuit: false },
    pope: { name: '教皇', desc: '神託の初期レベルが5になるが、ショップで神託が販売されない', initialExtraTableauRows: 0, deckMultiplier: 1, tableauRowMultiplier: 1, targetScoreMultiplier: 1, initialOracleLevel: 5, bannedShopKinds: ['oracle'], initialCurrencyBonus: 0, initialItemCapacityBonus: 0, excludedRanks: [], unifyBlackRedSuits: false, randomizeDeck: false, randomizeWildPerSuit: false },
    empress: { name: '女帝', desc: '初期所持金が10多い状態で始まる', initialExtraTableauRows: 0, deckMultiplier: 1, tableauRowMultiplier: 1, targetScoreMultiplier: 1, initialOracleLevel: 1, bannedShopKinds: [], initialCurrencyBonus: 10, initialItemCapacityBonus: 0, excludedRanks: [], unifyBlackRedSuits: false, randomizeDeck: false, randomizeWildPerSuit: false },
    magician: { name: '魔術師', desc: '護符の所持スロットが1多いが、場札は1行少ない状態で始まる', initialExtraTableauRows: -1, deckMultiplier: 1, tableauRowMultiplier: 1, targetScoreMultiplier: 1, initialOracleLevel: 1, bannedShopKinds: [], initialCurrencyBonus: 0, initialItemCapacityBonus: 1, excludedRanks: [], unifyBlackRedSuits: false, randomizeDeck: false, randomizeWildPerSuit: false },
    justice: { name: '正義', desc: '初期デッキから絵札(J・Q・K)が除外された状態で始まる', initialExtraTableauRows: 0, deckMultiplier: 1, tableauRowMultiplier: 1, targetScoreMultiplier: 1, initialOracleLevel: 1, bannedShopKinds: [], initialCurrencyBonus: 0, initialItemCapacityBonus: 0, excludedRanks: [11, 12, 13], unifyBlackRedSuits: false, randomizeDeck: false, randomizeWildPerSuit: false },
    lovers: { name: '恋人', desc: '初期デッキの黒スート(♠♣)・赤スート(♥♦)が、それぞれランダムにどちらか一方へ統一された状態で始まる', initialExtraTableauRows: 0, deckMultiplier: 1, tableauRowMultiplier: 1, targetScoreMultiplier: 1, initialOracleLevel: 1, bannedShopKinds: [], initialCurrencyBonus: 0, initialItemCapacityBonus: 0, excludedRanks: [], unifyBlackRedSuits: true, randomizeDeck: false, randomizeWildPerSuit: false },
    emperor: { name: '皇帝', desc: '初期デッキの枚数・場札の配布行数・目標スコアが全て2倍になるが、護符の所持スロットが1減った状態で始まる', initialExtraTableauRows: 0, deckMultiplier: 2, tableauRowMultiplier: 2, targetScoreMultiplier: 2, initialOracleLevel: 1, bannedShopKinds: [], initialCurrencyBonus: 0, initialItemCapacityBonus: -1, excludedRanks: [], unifyBlackRedSuits: false, randomizeDeck: false, randomizeWildPerSuit: false },
    wheelOfFortune: { name: '運命の輪', desc: '初期デッキ52枚それぞれのランク・スートが完全ランダムに再抽選された状態で始まる', initialExtraTableauRows: 0, deckMultiplier: 1, tableauRowMultiplier: 1, targetScoreMultiplier: 1, initialOracleLevel: 1, bannedShopKinds: [], initialCurrencyBonus: 0, initialItemCapacityBonus: 0, excludedRanks: [], unifyBlackRedSuits: false, randomizeDeck: true, randomizeWildPerSuit: false },
    strength: { name: '力', desc: '初期デッキの各スート(♠♥♦♣)から1枚ずつランダムに選ばれたカードがワイルドに変換された状態で始まる', initialExtraTableauRows: 0, deckMultiplier: 1, tableauRowMultiplier: 1, targetScoreMultiplier: 1, initialOracleLevel: 1, bannedShopKinds: [], initialCurrencyBonus: 0, initialItemCapacityBonus: 0, excludedRanks: [], unifyBlackRedSuits: false, randomizeDeck: false, randomizeWildPerSuit: true },
  },
```

- [ ] **Step 5: `params.ts`の`SPREAD_IDS`を変更する**

`export const SPREAD_IDS`で検索して正確な位置を確認する(Step 4の変更により行番号は前後する可能性がある)。現在の内容:

```ts
export const SPREAD_IDS: SpreadId[] = ['fool', 'moon', 'pope', 'empress', 'magician', 'justice', 'lovers', 'emperor', 'wheelOfFortune']
```

これを以下に変更する:

```ts
export const SPREAD_IDS: SpreadId[] = ['fool', 'moon', 'pope', 'empress', 'magician', 'justice', 'lovers', 'emperor', 'wheelOfFortune', 'strength']
```

- [ ] **Step 6: `shidasu.config.json`の`spreads`を変更する**

`src/lib/game/shidasu/shidasu.config.json`の`spreads`オブジェクト内、既存9スプレッド(`fool`/`moon`/`pope`/`empress`/`magician`/`justice`/`lovers`/`emperor`/`wheelOfFortune`)それぞれに`"randomizeWildPerSuit": false`を追加する(各エントリの`"randomizeDeck"`行の直後に追加する)。例えば`fool`エントリは:

```json
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
      "randomizeDeck": false,
      "randomizeWildPerSuit": false
    },
```

同様のパターンで`moon`・`pope`・`empress`・`magician`・`justice`・`lovers`・`emperor`・`wheelOfFortune`の各エントリにも`"randomizeWildPerSuit": false`を追加する。

`wheelOfFortune`エントリ(230-244行目付近、`spreads`オブジェクトの最後のエントリ)の現在の内容:

```json
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
```

これを以下に変更し(`randomizeWildPerSuit`追加、末尾に`,`を追加)、直後に新規`strength`エントリを追加する:

```json
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
      "randomizeDeck": true,
      "randomizeWildPerSuit": false
    },
    "strength": {
      "name": "力",
      "desc": "初期デッキの各スート(♠♥♦♣)から1枚ずつランダムに選ばれたカードがワイルドに変換された状態で始まる",
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
      "randomizeDeck": false,
      "randomizeWildPerSuit": true
    }
```

(`spreads`オブジェクトを閉じる`}`の直前が`wheelOfFortune`エントリだった箇所なので、`strength`エントリが新たに最後のエントリになる。`spreads`全体を閉じる`},`はそのまま維持すること)

- [ ] **Step 7: JSON構文を検証する**

Run: `node -e "JSON.parse(require('fs').readFileSync('src/lib/game/shidasu/shidasu.config.json', 'utf-8')); console.log('OK')"`
Expected: `OK`が出力される(構文エラーがあれば例外で落ちる)

- [ ] **Step 8: テストが通ることを確認する**

Run: `npm test -- params.test.ts`
Expected: PASS(Step 1で追加した2件を含め全件)

- [ ] **Step 9: 型チェックを実行する**

Run: `npm run check`
Expected: `params.ts`・`types.ts`・`shidasu.config.json`・`params.test.ts`に起因する新規エラーなし。他のファイル(admin画面、`engine.ts`等)は後続タスクで修正するため、そちらのエラーは残る想定。それは無視して構わない

- [ ] **Step 10: コミット**

```bash
git add src/lib/game/shidasu/types.ts src/lib/game/shidasu/params.ts src/lib/game/shidasu/shidasu.config.json src/lib/game/shidasu/params.test.ts
git commit -m "$(cat <<'EOF'
feat: 新規スプレッド「力」を追加し、randomizeWildPerSuitフィールドを新設

Co-Authored-By: Claude Sonnet 5 <noreply@anthropic.com>
EOF
)"
```

---

### Task 2: スート別ランダムワイルド化ヘルパー関数の実装と`beginRun`への反映

**Files:**
- Modify: `src/lib/game/shidasu/engine.ts:92-97` (`convertRandomCardToWild`の直後に新規関数を追加)
- Modify: `src/lib/game/shidasu/engine.ts:1034-1055` (`beginRun`内の変換チェーン)
- Test: `src/lib/game/shidasu/engine.test.ts`

Task 1で`SpreadConfig`に`randomizeWildPerSuit: boolean`が追加済み、`strength`スプレッドが`DEFAULT_PARAMS.spreads`・`SPREAD_IDS`に登録済みであることを前提とする。

- [ ] **Step 1: 失敗するテストを書く**

`src/lib/game/shidasu/engine.test.ts`の2624行目(「spreadId=fool(wheelOfFortune以外)では、従来通り標準デッキ〜」テストの直後)に、以下のテストを追加する。挿入位置は「spreadId=fool(wheelOfFortune以外)では、従来通り標準デッキ」というテスト名で検索して特定すること(Task 1のコミットにより正確な行番号は前後する可能性がある)。

```ts
  test('spreadId=strengthでbeginRunすると、4スート(♠♥♦♣)それぞれから1枚ずつ、合計4枚がwild: trueになる', () => {
    const run = beginRun(DEFAULT_PARAMS, 1, 'strength')
    const wildCards = run.deckComposition.filter(c => c.wild)
    expect(wildCards).toHaveLength(4)
    const wildSuits = new Set(wildCards.map(c => c.suit))
    expect(wildSuits).toEqual(new Set(['♠', '♥', '♦', '♣']))
  })

  test('spreadId=strength以外(fool)では、wild: trueのカードが存在しない', () => {
    const run = beginRun(DEFAULT_PARAMS, 1, 'fool')
    const wildCards = run.deckComposition.filter(c => c.wild)
    expect(wildCards).toHaveLength(0)
  })
```

- [ ] **Step 2: テストが失敗することを確認する**

Run: `npm test -- engine.test.ts`
Expected: FAIL — `strength`スプレッドで`beginRun`しても`wild: true`のカードが1枚も生成されない(現状は`randomizeWildPerSuit`フィールドを無視しているため)

- [ ] **Step 3: `engine.ts`にスート別ワイルド化ヘルパー関数を実装する**

`convertRandomCardToWild`関数(92-97行目)の直後に、以下を追加する:

```ts
// デッキ構成のうち、4スート(♠♥♦♣)それぞれから非ワイルド・非除外の1枚をランダムに選び
// ワイルドへ変換した新しい配列を返す。候補が無いスートはスキップする(スプレッド「力」が使用)。
function convertOneCardPerSuitToWild(composition: DeckCard[], rand: () => number): DeckCard[] {
  let result = composition
  for (const suit of (['♠', '♥', '♦', '♣'] as Suit[])) {
    const candidates = result.map((c, i) => i).filter(i => result[i].suit === suit && !result[i].wild && !result[i].removed)
    if (candidates.length === 0) continue
    const target = candidates[Math.floor(rand() * candidates.length)]
    result = result.map((c, i) => (i === target ? { ...c, wild: true } : c))
  }
  return result
}
```

`Suit`型は既にファイル冒頭のimport文(2行目)に含まれているため、追加のimportは不要。

- [ ] **Step 4: `beginRun`内の変換チェーンを変更する**

`beginRun`関数内の変換チェーン(現在1042-1055行目)の現在の内容:

```ts
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
```

これを以下に変更する(最終行の変数名を`deckCompositionAfterUnify`に変更し、その後に`randomizeWildPerSuit`のステップを追加、最終的な`deckComposition`を新しいステップの結果にする):

```ts
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
  const deckCompositionAfterUnify = spreadConfig.unifyBlackRedSuits
    ? unifyBlackRedSuits(deckCompositionAfterExclusion, rand)
    : deckCompositionAfterExclusion
  const deckComposition = spreadConfig.randomizeWildPerSuit
    ? convertOneCardPerSuitToWild(deckCompositionAfterUnify, rand)
    : deckCompositionAfterUnify
```

`rand`は既存の`createRng(seed ...)`をそのまま流用する(新たな乱数系列は作らない)。

- [ ] **Step 5: テストが通ることを確認する**

Run: `npm test -- engine.test.ts`
Expected: PASS(既存テスト全件+新規2件)

- [ ] **Step 6: 役判定関連の回帰テストを確認する**

Run: `npm test -- patterns.test.ts`
Expected: PASS(役判定ロジック自体は変更していないため、全件既存通りPASSするはず)

- [ ] **Step 7: 全体テストを実行する**

Run: `npm test`
Expected: 全件PASS(既存+新規)。もし無関係な既存の失敗がある場合はその旨を報告に含めること

- [ ] **Step 8: 型チェックを実行する**

Run: `npm run check`
Expected: `engine.ts`・`engine.test.ts`に起因する新規エラーなし。admin画面(`/admin/shidasu-spreads/+page.svelte`)は次のTask 3で別の担当者が修正するため、そちらに起因するエラー・警告は無視して構わない

- [ ] **Step 9: コミット**

```bash
git add src/lib/game/shidasu/engine.ts src/lib/game/shidasu/engine.test.ts
git commit -m "$(cat <<'EOF'
feat: beginRunでrandomizeWildPerSuitスプレッドのスート別ランダムワイルド化を反映

Co-Authored-By: Claude Sonnet 5 <noreply@anthropic.com>
EOF
)"
```

---

### Task 3: `/admin/shidasu-spreads`のUI拡張と最終動作確認

**Files:**
- Modify: `src/routes/admin/shidasu-spreads/+page.svelte:142-224`

Task 1・Task 2完了済み、全テストPASS済みであることを前提とする。

- [ ] **Step 1: 役判定への回帰確認(再確認)**

Run: `npm test -- patterns.test.ts`
Expected: PASS

Run: `npm test`
Expected: 全件PASS

- [ ] **Step 2: `/admin/shidasu-spreads`のUI拡張**

`src/routes/admin/shidasu-spreads/+page.svelte`のテーブルヘッダー(`<thead>`内、142-157行目)の現在の内容:

```svelte
        <table class="w-full text-xs border border-slate-200 rounded-lg overflow-hidden">
          <thead>
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
          </thead>
```

これを以下に変更する(「デッキランダム化」列の直後に「スート別ワイルド化」列を追加):

```svelte
        <table class="w-full text-xs border border-slate-200 rounded-lg overflow-hidden">
          <thead>
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
              <th class="px-2 py-1.5 text-left" style="width:7rem;">スート別ワイルド化</th>
            </tr>
          </thead>
```

テーブル行(`<tbody>`内、各`<tr>`)の現在の内容(219-225行目付近):

```svelte
                <td class="px-2 py-1.5 align-top">
                  <input type="checkbox" bind:checked={entry.unifyBlackRedSuits} />
                </td>
                <td class="px-2 py-1.5 align-top">
                  <input type="checkbox" bind:checked={entry.randomizeDeck} />
                </td>
              </tr>
```

これを以下に変更する(「デッキランダム化」チェックボックスの直後に「スート別ワイルド化」チェックボックスを追加):

```svelte
                <td class="px-2 py-1.5 align-top">
                  <input type="checkbox" bind:checked={entry.unifyBlackRedSuits} />
                </td>
                <td class="px-2 py-1.5 align-top">
                  <input type="checkbox" bind:checked={entry.randomizeDeck} />
                </td>
                <td class="px-2 py-1.5 align-top">
                  <input type="checkbox" bind:checked={entry.randomizeWildPerSuit} />
                </td>
              </tr>
```

`hasValidationError`(`$derived.by`)には追加のバリデーションは不要(`randomizeWildPerSuit`は真偽値のため常に有効な値)。

- [ ] **Step 3: 型チェックを実行する**

Run: `npm run check`
Expected: `shidasu`関連(`+page.svelte`含む)に起因する新規エラー・警告なし。他の無関係な既存エラー(`solitaire`・`hepburn-converter`・`vector3-visualizer`等)は無視して構わない

- [ ] **Step 4: ビルドを実行する**

Run: `npm run build`
Expected: ビルド成功

- [ ] **Step 5: 開発サーバーで動作確認する**

`npm run dev`で開発サーバーを起動し、以下を確認する:
- `/api/admin/shidasu-config`のレスポンスで`strength`のみ`randomizeWildPerSuit: true`、他9スプレッド(`fool`/`moon`/`pope`/`empress`/`magician`/`justice`/`lovers`/`emperor`/`wheelOfFortune`)は全て`false`になっていること(`curl`で確認可)
- `/admin/shidasu-spreads`の`+page.svelte`のコードを読み、テーブルヘッダー・テーブル行の両方に「スート別ワイルド化」列が正しく追加されていること(既存の`unifyBlackRedSuits`・`randomizeDeck`列と同じ`bind:checked`パターンになっていること)を確認する
- ブラウザでの目視確認が可能であれば、`/admin/shidasu-spreads`にアクセスして`strength`(力)の行のチェックボックスがON、他がOFFになっていることを確認する

**開発サーバーの停止方法(重要)**: 確認が終わったら、`netstat -ano | findstr :5173`(または実際に使われたポート)でPIDを特定し、`taskkill /F /PID <該当PID>`でそのプロセスのみを停止すること。**絶対に`taskkill /F /IM node.exe`のような全nodeプロセスを巻き込むコマンドを使わないこと**(過去のタスクでこれによりシステム上の無関係なnodeプロセスまで巻き込んで停止させてしまった事故があるため、厳守すること)。

- [ ] **Step 6: コミット**

```bash
git add src/routes/admin/shidasu-spreads/+page.svelte
git commit -m "$(cat <<'EOF'
feat: /admin/shidasu-spreadsに「力」のスート別ワイルド化列を追加

Co-Authored-By: Claude Sonnet 5 <noreply@anthropic.com>
EOF
)"
```
