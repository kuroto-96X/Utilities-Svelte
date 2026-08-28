# 新規スプレッド「皇帝」 Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** 新規スプレッド「皇帝」(`emperor`)を追加する。初期デッキが2組(104枚)、場札の配布行数が2倍、目標スコアが2倍になる一方、護符の所持スロットが1減る。

**Architecture:** `SpreadConfig`から未使用の死んだフィールド(`waveTargetBase`/`waveTargetMultiplier`)を削除し、代わりに`deckMultiplier`・`tableauRowMultiplier`・`targetScoreMultiplier`を追加する。`deck.ts`に標準デッキをN組連結するヘルパー関数を新設し、`beginRun`(`engine.ts`)がデッキ複製・場札行数の倍率換算を行う。`waveTarget`関数には`spreadId`引数を追加して目標スコアへの倍率を反映する。あわせて、既に`/admin/shidasu-spreads`に置き換わっている古い管理画面コンポーネント(`SpreadsSection.svelte`)を削除する。

**Tech Stack:** TypeScript, SvelteKit, Vitest

---

### Task 1: `SpreadConfig`型の整理(死んだフィールド削除・新規フィールド追加)と`emperor`スプレッドの追加

**Files:**
- Modify: `src/lib/game/shidasu/types.ts:24-52` (`SpreadId`型・`SpreadConfig`型)
- Modify: `src/lib/game/shidasu/params.ts:340-348` (`DEFAULT_PARAMS.spreads`)
- Modify: `src/lib/game/shidasu/params.ts:635` (`SPREAD_IDS`)
- Modify: `src/lib/game/shidasu/shidasu.config.json:109-201` (`spreads`)
- Test: `src/lib/game/shidasu/params.test.ts`

- [ ] **Step 1: 失敗するテストを書く**

`src/lib/game/shidasu/params.test.ts`の34-37行目(「月の目標スコア基礎値・倍率は愚者と全く同じ」テスト、`waveTargetBase`/`waveTargetMultiplier`のみを検証しているテスト)を削除する。

```ts
  test('月の目標スコア基礎値・倍率は愚者と全く同じ', () => {
    expect(DEFAULT_PARAMS.spreads.moon.waveTargetBase).toBe(DEFAULT_PARAMS.spreads.fool.waveTargetBase)
    expect(DEFAULT_PARAMS.spreads.moon.waveTargetMultiplier).toBe(DEFAULT_PARAMS.spreads.fool.waveTargetMultiplier)
  })

```

この5行(空行含む)をまるごと削除する。

58-65行目(「empressの名称は女帝、初期行数オフセット・目標スコア・神託初期レベルは愚者と同じ」テスト)の現在の内容:

```ts
  test('empressの名称は女帝、初期行数オフセット・目標スコア・神託初期レベルは愚者と同じ', () => {
    expect(DEFAULT_PARAMS.spreads.empress.name).toBe('女帝')
    expect(DEFAULT_PARAMS.spreads.empress.initialExtraTableauRows).toBe(DEFAULT_PARAMS.spreads.fool.initialExtraTableauRows)
    expect(DEFAULT_PARAMS.spreads.empress.waveTargetBase).toBe(DEFAULT_PARAMS.spreads.fool.waveTargetBase)
    expect(DEFAULT_PARAMS.spreads.empress.waveTargetMultiplier).toBe(DEFAULT_PARAMS.spreads.fool.waveTargetMultiplier)
    expect(DEFAULT_PARAMS.spreads.empress.initialOracleLevel).toBe(DEFAULT_PARAMS.spreads.fool.initialOracleLevel)
    expect(DEFAULT_PARAMS.spreads.empress.bannedShopKinds).toEqual([])
  })
```

これを以下に変更する(`waveTargetBase`/`waveTargetMultiplier`のアサーション2行を削除):

```ts
  test('empressの名称は女帝、初期行数オフセット・神託初期レベルは愚者と同じ', () => {
    expect(DEFAULT_PARAMS.spreads.empress.name).toBe('女帝')
    expect(DEFAULT_PARAMS.spreads.empress.initialExtraTableauRows).toBe(DEFAULT_PARAMS.spreads.fool.initialExtraTableauRows)
    expect(DEFAULT_PARAMS.spreads.empress.initialOracleLevel).toBe(DEFAULT_PARAMS.spreads.fool.initialOracleLevel)
    expect(DEFAULT_PARAMS.spreads.empress.bannedShopKinds).toEqual([])
  })
```

101-112行目(「loversの名称は恋人、unifyBlackRedSuitsはtrue、他のフィールドはfoolと同じ」テスト)の現在の内容:

```ts
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

これを以下に変更する(`waveTargetBase`/`waveTargetMultiplier`のアサーション2行を削除):

```ts
  test('loversの名称は恋人、unifyBlackRedSuitsはtrue、他のフィールドはfoolと同じ', () => {
    expect(DEFAULT_PARAMS.spreads.lovers.name).toBe('恋人')
    expect(DEFAULT_PARAMS.spreads.lovers.unifyBlackRedSuits).toBe(true)
    expect(DEFAULT_PARAMS.spreads.lovers.initialExtraTableauRows).toBe(DEFAULT_PARAMS.spreads.fool.initialExtraTableauRows)
    expect(DEFAULT_PARAMS.spreads.lovers.initialOracleLevel).toBe(DEFAULT_PARAMS.spreads.fool.initialOracleLevel)
    expect(DEFAULT_PARAMS.spreads.lovers.bannedShopKinds).toEqual([])
    expect(DEFAULT_PARAMS.spreads.lovers.initialCurrencyBonus).toBe(0)
    expect(DEFAULT_PARAMS.spreads.lovers.initialItemCapacityBonus).toBe(0)
    expect(DEFAULT_PARAMS.spreads.lovers.excludedRanks).toEqual([])
  })
```

上記の削除・修正が完了した後、「fool/moon/pope/empress/magician/justice/loversのunifyBlackRedSuitsはfalse」テストの直後(元々の92-99行目のテストの直後、削除により行番号がずれるので「unifyBlackRedSuitsはfalse」というテスト名で検索して特定すること)に、以下の新規テストを追加する。

```ts
  test('fool/moon/pope/empress/magician/justice/loversのdeckMultiplier・tableauRowMultiplier・targetScoreMultiplierは1', () => {
    const nonEmperorIds = ['fool', 'moon', 'pope', 'empress', 'magician', 'justice', 'lovers'] as const
    nonEmperorIds.forEach(id => {
      expect(DEFAULT_PARAMS.spreads[id].deckMultiplier).toBe(1)
      expect(DEFAULT_PARAMS.spreads[id].tableauRowMultiplier).toBe(1)
      expect(DEFAULT_PARAMS.spreads[id].targetScoreMultiplier).toBe(1)
    })
  })

  test('emperorの名称は皇帝、deckMultiplier・tableauRowMultiplier・targetScoreMultiplierは2、initialItemCapacityBonusは-1', () => {
    expect(DEFAULT_PARAMS.spreads.emperor.name).toBe('皇帝')
    expect(DEFAULT_PARAMS.spreads.emperor.deckMultiplier).toBe(2)
    expect(DEFAULT_PARAMS.spreads.emperor.tableauRowMultiplier).toBe(2)
    expect(DEFAULT_PARAMS.spreads.emperor.targetScoreMultiplier).toBe(2)
    expect(DEFAULT_PARAMS.spreads.emperor.initialItemCapacityBonus).toBe(-1)
    expect(DEFAULT_PARAMS.spreads.emperor.initialExtraTableauRows).toBe(0)
    expect(DEFAULT_PARAMS.spreads.emperor.excludedRanks).toEqual([])
    expect(DEFAULT_PARAMS.spreads.emperor.unifyBlackRedSuits).toBe(false)
  })
```

- [ ] **Step 2: テストが失敗することを確認する**

Run: `npm test -- params.test.ts`
Expected: FAIL — `DEFAULT_PARAMS.spreads.emperor`が`undefined`、または`deckMultiplier`/`tableauRowMultiplier`/`targetScoreMultiplier`プロパティが存在しない。また`waveTargetBase`/`waveTargetMultiplier`を参照するアサーションが残っていた場合は型エラーになる想定(Step 1で該当箇所は削除済みのはず)

- [ ] **Step 3: `types.ts`の`SpreadId`型・`SpreadConfig`型を変更する**

`src/lib/game/shidasu/types.ts`の現在の内容(24-52行目):

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

これを以下に変更する:

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

- [ ] **Step 4: `params.ts`の`DEFAULT_PARAMS.spreads`を変更する**

`src/lib/game/shidasu/params.ts`の現在の内容(340-348行目):

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

これを以下に変更する:

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

- [ ] **Step 5: `params.ts`の`SPREAD_IDS`を変更する**

`src/lib/game/shidasu/params.ts`の現在の内容(635行目、Step 4の変更により実際の行番号は前後する可能性があるため、`export const SPREAD_IDS`で検索して特定すること):

```ts
export const SPREAD_IDS: SpreadId[] = ['fool', 'moon', 'pope', 'empress', 'magician', 'justice', 'lovers']
```

これを以下に変更する:

```ts
export const SPREAD_IDS: SpreadId[] = ['fool', 'moon', 'pope', 'empress', 'magician', 'justice', 'lovers', 'emperor']
```

- [ ] **Step 6: `shidasu.config.json`の`spreads`を変更する**

`src/lib/game/shidasu/shidasu.config.json`の現在の内容(109-201行目):

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

- [ ] **Step 7: テストが通ることを確認する**

Run: `npm test -- params.test.ts`
Expected: PASS(Step 1で追加・修正した内容を含め全件)

- [ ] **Step 8: 型チェックを実行する**

Run: `npm run check`
Expected: shidasu関連の新規エラーなし。ただし`waveTargetBase`/`waveTargetMultiplier`を参照している他のファイル(admin画面等)はまだ修正していないため、この時点では型エラーが出る可能性がある。もし出た場合はTask 5・6で解消される想定なので、`params.ts`・`types.ts`・`shidasu.config.json`・`params.test.ts`に起因するエラーが無いことだけをこの時点で確認する

- [ ] **Step 9: コミット**

```bash
git add src/lib/game/shidasu/types.ts src/lib/game/shidasu/params.ts src/lib/game/shidasu/shidasu.config.json src/lib/game/shidasu/params.test.ts
git commit -m "$(cat <<'EOF'
feat: SpreadConfigの死んだフィールドを削除し、新規スプレッド「皇帝」を追加

Co-Authored-By: Claude Sonnet 5 <noreply@anthropic.com>
EOF
)"
```

---

### Task 2: デッキ複製ヘルパー関数の実装(`deck.ts`)

**Files:**
- Modify: `src/lib/game/shidasu/deck.ts:18-27` (`standardDeckComposition`の直後に新規関数を追加)
- Test: `src/lib/game/shidasu/deck.test.ts`

- [ ] **Step 1: 失敗するテストを書く**

`src/lib/game/shidasu/deck.test.ts`のimport文(2行目)を以下のように変更する(`multipliedDeckComposition`を追加):

現在の内容:

```ts
import { createDeck, createRng, rollOffer, shuffle, standardDeckComposition, addCardsToDeckComposition, unifyBlackRedSuits } from './deck'
```

これを以下に変更する:

```ts
import { createDeck, createRng, rollOffer, shuffle, standardDeckComposition, addCardsToDeckComposition, unifyBlackRedSuits, multipliedDeckComposition } from './deck'
```

ファイル末尾(223行目、`unifyBlackRedSuits`の`describe`ブロックの直後)に、以下のテストを追加する。

```ts

describe('multipliedDeckComposition', () => {
  test('multiplier=1のとき、standardDeckComposition()と同じ52枚になる', () => {
    const result = multipliedDeckComposition(1)
    expect(result).toHaveLength(52)
    const suits = ['♠', '♥', '♦', '♣'] as const
    suits.forEach(suit => {
      const cards = result.filter(c => c.suit === suit)
      expect(cards).toHaveLength(13)
    })
  })

  test('multiplier=2のとき、104枚になり各スート・ランクの組み合わせが2枚ずつ存在する', () => {
    const result = multipliedDeckComposition(2)
    expect(result).toHaveLength(104)
    const suits = ['♠', '♥', '♦', '♣'] as const
    suits.forEach(suit => {
      for (let rank = 1; rank <= 13; rank++) {
        const cards = result.filter(c => c.suit === suit && c.rank === rank)
        expect(cards).toHaveLength(2)
      }
    })
  })

  test('multiplier=2のとき、deckIdは0〜103の重複しない連番になる', () => {
    const result = multipliedDeckComposition(2)
    const deckIds = result.map(c => c.deckId).sort((a, b) => a - b)
    expect(deckIds).toEqual(Array.from({ length: 104 }, (_, i) => i))
  })

  test('全カードがwild:false, removed:falseで生成される', () => {
    const result = multipliedDeckComposition(2)
    expect(result.every(c => c.wild === false && c.removed === false)).toBe(true)
  })
})
```

- [ ] **Step 2: テストが失敗することを確認する**

Run: `npm test -- deck.test.ts -t "multipliedDeckComposition"`
Expected: FAIL — `multipliedDeckComposition`が`deck.ts`からエクスポートされていないため、importエラーまたは関数未定義エラーになる

- [ ] **Step 3: `deck.ts`に`multipliedDeckComposition`関数を実装する**

`src/lib/game/shidasu/deck.ts`の現在の内容(18-27行目):

```ts
export function standardDeckComposition(): DeckCard[] {
  const composition: DeckCard[] = []
  let deckId = 0
  for (const suit of SUITS) {
    for (let rank = 1; rank <= 13; rank++) {
      composition.push({ deckId: deckId++, suit, rank: rank as Rank, wild: false, removed: false })
    }
  }
  return composition
}
```

これを以下に変更する(直後に新規関数を追加):

```ts
export function standardDeckComposition(): DeckCard[] {
  const composition: DeckCard[] = []
  let deckId = 0
  for (const suit of SUITS) {
    for (let rank = 1; rank <= 13; rank++) {
      composition.push({ deckId: deckId++, suit, rank: rank as Rank, wild: false, removed: false })
    }
  }
  return composition
}

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

- [ ] **Step 4: テストが通ることを確認する**

Run: `npm test -- deck.test.ts`
Expected: 全件PASS(Step 1で追加した4件を含む)

- [ ] **Step 5: 型チェック・ビルドを実行する**

Run: `npm run check`
Expected: `deck.ts`・`deck.test.ts`に起因する新規エラーなし

Run: `npm run build`
Expected: 成功

- [ ] **Step 6: コミット**

```bash
git add src/lib/game/shidasu/deck.ts src/lib/game/shidasu/deck.test.ts
git commit -m "$(cat <<'EOF'
feat: 標準デッキをN組連結するmultipliedDeckComposition関数を実装

Co-Authored-By: Claude Sonnet 5 <noreply@anthropic.com>
EOF
)"
```

---

### Task 3: `beginRun`へのデッキ倍率・場札行倍率の反映

**Files:**
- Modify: `src/lib/game/shidasu/engine.ts:4` (import文)
- Modify: `src/lib/game/shidasu/engine.ts:1032-1057` (`beginRun`関数)
- Test: `src/lib/game/shidasu/engine.test.ts`

- [ ] **Step 1: 失敗するテストを書く**

`src/lib/game/shidasu/engine.test.ts`を開き、「spreadIdを省略(fool)すると、deckCompositionは4スート混在のまま」というテスト名で検索してその位置を特定する(Task 1のコミットにより正確な行番号は前後する可能性がある)。このテストの直後、「waveTargetはflow.stageTargetBase・stageTargetMultiplierとstageStarsの倍率を参照する」テストの前に、以下のテストを追加する。

```ts
  test('spreadId=emperorでは、deckCompositionが104枚(標準デッキ2組)になる', () => {
    const run = beginRun(DEFAULT_PARAMS, 1, 'emperor')
    expect(run.deckComposition).toHaveLength(104)
  })

  test('spreadId=emperorでは、extraTableauRowsが基準行数x2相当のオフセットになる', () => {
    const run = beginRun(DEFAULT_PARAMS, 1, 'emperor')
    const expectedExtraRows = DEFAULT_PARAMS.spreads.emperor.initialExtraTableauRows
      + (DEFAULT_PARAMS.layout.rows * DEFAULT_PARAMS.spreads.emperor.tableauRowMultiplier - DEFAULT_PARAMS.layout.rows)
    expect(run.extraTableauRows).toBe(expectedExtraRows)
    expect(run.extraTableauRows).toBe(5)
  })

  test('spreadIdを省略(fool)すると、deckCompositionは52枚のまま、extraTableauRowsは0のまま', () => {
    const run = beginRun(DEFAULT_PARAMS, 1)
    expect(run.deckComposition).toHaveLength(52)
    expect(run.extraTableauRows).toBe(0)
  })
```

- [ ] **Step 2: テストが失敗することを確認する**

Run: `npm test -- engine.test.ts -t "emperor"`
Expected: FAIL — `run.deckComposition`が52枚のまま、`run.extraTableauRows`が0のまま(まだ`beginRun`が`deckMultiplier`/`tableauRowMultiplier`を反映していないため)

- [ ] **Step 3: `engine.ts`のimport文を変更する**

`src/lib/game/shidasu/engine.ts`の現在の内容(4行目):

```ts
import { createRng, shuffle, shuffleInPlace, standardDeckComposition, addCardsToDeckComposition, rollOffer, unifyBlackRedSuits } from './deck'
```

これを以下に変更する:

```ts
import { createRng, shuffle, shuffleInPlace, standardDeckComposition, addCardsToDeckComposition, rollOffer, unifyBlackRedSuits, multipliedDeckComposition } from './deck'
```

- [ ] **Step 4: `beginRun`関数を変更する**

`src/lib/game/shidasu/engine.ts`の現在の内容(1032-1057行目):

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

- [ ] **Step 5: テストが通ることを確認する**

Run: `npm test -- engine.test.ts -t "emperor"`
Expected: PASS (3件とも)

Run: `npm test -- engine.test.ts`
Expected: 全件PASS(既存テストは`fool`/`moon`/`pope`/`empress`/`magician`/`justice`/`lovers`のいずれも`deckMultiplier: 1`・`tableauRowMultiplier: 1`のため、`deckComposition`・`extraTableauRows`の計算に影響がないことを確認)

- [ ] **Step 6: 型チェック・ビルドを実行する**

Run: `npm run check`
Expected: `engine.ts`・`engine.test.ts`に起因する新規エラーなし(Task 4未着手のため`waveTarget`関連のエラーは残る想定)

Run: `npm run build`
Expected: 成功

- [ ] **Step 7: コミット**

```bash
git add src/lib/game/shidasu/engine.ts src/lib/game/shidasu/engine.test.ts
git commit -m "$(cat <<'EOF'
feat: beginRunで皇帝のdeckMultiplier・tableauRowMultiplierを初期デッキ・場札に反映

Co-Authored-By: Claude Sonnet 5 <noreply@anthropic.com>
EOF
)"
```

---

### Task 4: `waveTarget`関数への`spreadId`引数追加と既存呼び出し全箇所の修正

**Files:**
- Modify: `src/lib/game/shidasu/engine.ts:921-927` (`waveTarget`関数)
- Modify: `src/lib/game/shidasu/engine.ts:1063` (`resolveWaveEnd`内の呼び出し)
- Modify: `src/lib/game/shidasu/engine.ts:1904` (`resolvePlayContext`内の呼び出し)
- Modify: `src/routes/game/shidasu/+page.svelte:116` (`target`の`$derived`計算)
- Modify: `src/routes/game/shidasu/+page.svelte:1240` (ステージ画面の`waveTargetValue`計算)
- Test: `src/lib/game/shidasu/engine.test.ts`

このタスクは既存の`waveTarget`呼び出しが多数(`engine.test.ts`内に27箇所)あるため、慎重に進める。

- [ ] **Step 1: 失敗するテストを書く**

`src/lib/game/shidasu/engine.test.ts`の2587-2600行目(「waveTargetはflow.stageTargetBase・stageTargetMultiplierとstageStarsの倍率を参照する」テスト)の現在の内容:

```ts
  test('waveTargetはflow.stageTargetBase・stageTargetMultiplierとstageStarsの倍率を参照する', () => {
    const custom = {
      ...DEFAULT_PARAMS,
      flow: { ...DEFAULT_PARAMS.flow, stageTargetBase: 1000, stageTargetMultiplier: 2 },
    }
    const stars: Star[] = [
      { id: 's1', name: 'star1', waveSlot: 1, targetMultiplier: 1, reward: 0, restriction: null, sabotage: { kind: 'none' }, descTemplate: '' },
      { id: 's2', name: 'star2', waveSlot: 2, targetMultiplier: 1.5, reward: 0, restriction: null, sabotage: { kind: 'none' }, descTemplate: '' },
      { id: 's3', name: 'star3', waveSlot: 3, targetMultiplier: 2, reward: 0, restriction: null, sabotage: { kind: 'none' }, descTemplate: '' },
    ]
    expect(waveTarget(custom, 0, 0, stars)).toBe(1000) // 1000 × 2^0 × 1
    expect(waveTarget(custom, 0, 1, stars)).toBe(1500) // 1000 × 2^0 × 1.5
    expect(waveTarget(custom, 1, 0, stars)).toBe(2000) // 1000 × 2^1 × 1
  })
```

これを以下に変更する(`spreadId`引数を追加し、皇帝スプレッドでの倍率適用も検証するアサーションを追加):

```ts
  test('waveTargetはflow.stageTargetBase・stageTargetMultiplierとstageStarsの倍率を参照する', () => {
    const custom = {
      ...DEFAULT_PARAMS,
      flow: { ...DEFAULT_PARAMS.flow, stageTargetBase: 1000, stageTargetMultiplier: 2 },
    }
    const stars: Star[] = [
      { id: 's1', name: 'star1', waveSlot: 1, targetMultiplier: 1, reward: 0, restriction: null, sabotage: { kind: 'none' }, descTemplate: '' },
      { id: 's2', name: 'star2', waveSlot: 2, targetMultiplier: 1.5, reward: 0, restriction: null, sabotage: { kind: 'none' }, descTemplate: '' },
      { id: 's3', name: 'star3', waveSlot: 3, targetMultiplier: 2, reward: 0, restriction: null, sabotage: { kind: 'none' }, descTemplate: '' },
    ]
    expect(waveTarget(custom, 0, 0, stars, 'fool')).toBe(1000) // 1000 × 2^0 × 1 × 1
    expect(waveTarget(custom, 0, 1, stars, 'fool')).toBe(1500) // 1000 × 2^0 × 1.5 × 1
    expect(waveTarget(custom, 1, 0, stars, 'fool')).toBe(2000) // 1000 × 2^1 × 1 × 1
  })

  test('waveTargetはspreadIdがemperorのとき、targetScoreMultiplier(2)がさらに乗算される', () => {
    const custom = {
      ...DEFAULT_PARAMS,
      flow: { ...DEFAULT_PARAMS.flow, stageTargetBase: 1000, stageTargetMultiplier: 2 },
    }
    const stars: Star[] = [
      { id: 's1', name: 'star1', waveSlot: 1, targetMultiplier: 1, reward: 0, restriction: null, sabotage: { kind: 'none' }, descTemplate: '' },
    ]
    expect(waveTarget(custom, 0, 0, stars, 'emperor')).toBe(2000) // 1000 × 2^0 × 1 × 2
  })
```

- [ ] **Step 2: テストが失敗することを確認する**

Run: `npm test -- engine.test.ts -t "waveTarget"`
Expected: FAIL — `waveTarget`がまだ`spreadId`引数を受け取らない(型エラー、または5番目の引数が無視されて`targetScoreMultiplier`が反映されない)

- [ ] **Step 3: `waveTarget`関数を変更する**

`src/lib/game/shidasu/engine.ts`の現在の内容(921-927行目):

```ts
// ステージ基準点に、現在Waveの星が持つ倍率をかけて目標スコアを算出する。
// target(stageIndex, waveIndex) = flow.stageTargetBase × flow.stageTargetMultiplier^stageIndex × star.targetMultiplier
export function waveTarget(params: ShidasuParams, stageIndex: number, waveIndex: number, stageStars: Star[]): number {
  const base = params.flow.stageTargetBase * params.flow.stageTargetMultiplier ** stageIndex
  const star = stageStars[waveIndex]
  return Math.floor(base * (star?.targetMultiplier ?? 1))
}
```

これを以下に変更する:

```ts
// ステージ基準点に、現在Waveの星が持つ倍率・スプレッド由来の倍率をかけて目標スコアを算出する。
// target(stageIndex, waveIndex) = flow.stageTargetBase × flow.stageTargetMultiplier^stageIndex
//   × star.targetMultiplier × spreads[spreadId].targetScoreMultiplier
export function waveTarget(params: ShidasuParams, stageIndex: number, waveIndex: number, stageStars: Star[], spreadId: SpreadId): number {
  const base = params.flow.stageTargetBase * params.flow.stageTargetMultiplier ** stageIndex
  const star = stageStars[waveIndex]
  const spreadMultiplier = params.spreads[spreadId].targetScoreMultiplier
  return Math.floor(base * (star?.targetMultiplier ?? 1) * spreadMultiplier)
}
```

- [ ] **Step 4: `resolveWaveEnd`内の呼び出しを変更する**

`src/lib/game/shidasu/engine.ts`の現在の内容(1063行目):

```ts
  const target = waveTarget(params, run.stageIndex, run.waveIndex, run.stageStars)
```

これを以下に変更する:

```ts
  const target = waveTarget(params, run.stageIndex, run.waveIndex, run.stageStars, run.spreadId)
```

- [ ] **Step 5: `resolvePlayContext`内の呼び出しを変更する**

`src/lib/game/shidasu/engine.ts`の現在の内容(1904行目):

```ts
    target: waveTarget(params, run.stageIndex, run.waveIndex, run.stageStars),
```

これを以下に変更する:

```ts
    target: waveTarget(params, run.stageIndex, run.waveIndex, run.stageStars, run.spreadId),
```

- [ ] **Step 6: `game/shidasu/+page.svelte`内の呼び出し2箇所を変更する**

`src/routes/game/shidasu/+page.svelte`の現在の内容(116行目):

```ts
  let target = $derived(waveTarget(params, run.stageIndex, run.waveIndex, run.stageStars))
```

これを以下に変更する:

```ts
  let target = $derived(waveTarget(params, run.stageIndex, run.waveIndex, run.stageStars, run.spreadId))
```

同ファイルの現在の内容(1240行目):

```svelte
          {@const waveTargetValue = waveTarget(params, run.stageIndex, i, run.stageStars)}
```

これを以下に変更する:

```svelte
          {@const waveTargetValue = waveTarget(params, run.stageIndex, i, run.stageStars, run.spreadId)}
```

- [ ] **Step 7: `engine.test.ts`内の既存`waveTarget`呼び出し(Step 1で修正済みの3箇所を除く)を全て修正する**

以下の一覧に従い、それぞれの箇所を修正する。全て`waveTarget`呼び出しの末尾に`'fool'`という文字列リテラルを第5引数として追加する(該当スプレッドが`fool`であることを前提にした既存テストのため)。

- 524行目: `score: waveTarget(DEFAULT_PARAMS, 0, 0, base.stageStars), status: 'ended', endReason: 'target' },` → `score: waveTarget(DEFAULT_PARAMS, 0, 0, base.stageStars, base.spreadId), status: 'ended', endReason: 'target' },`(519行目付近で`base = beginRun(DEFAULT_PARAMS, 1)`が定義されているため`base.spreadId`を使う)
- 2726行目: `waveTarget(DEFAULT_PARAMS, 0, 0, beginRun(DEFAULT_PARAMS, 1).stageStars)` → `waveTarget(DEFAULT_PARAMS, 0, 0, beginRun(DEFAULT_PARAMS, 1).stageStars, 'fool')`
- 2735行目: 同様に末尾へ`, 'fool'`を追加
- 2756-2757行目付近: `waveTarget(DEFAULT_PARAMS, finalStageIndex, DEFAULT_PARAMS.flow.wavesPerStage - 1, stageStars),` → `waveTarget(DEFAULT_PARAMS, finalStageIndex, DEFAULT_PARAMS.flow.wavesPerStage - 1, stageStars, 'fool'),`
- 2764行目: 末尾へ`, 'fool'`を追加
- 2783行目: `waveTarget(DEFAULT_PARAMS, 0, 0, [noRewardStar, noRewardStar, noRewardStar]),` → `waveTarget(DEFAULT_PARAMS, 0, 0, [noRewardStar, noRewardStar, noRewardStar], 'fool'),`
- 2792行目: `waveTarget(DEFAULT_PARAMS, 0, 2, stageStars))` → `waveTarget(DEFAULT_PARAMS, 0, 2, stageStars, 'fool'))`
- 2800行目: 同様に末尾へ`, 'fool'`を追加
- 2808行目: 同様に末尾へ`, 'fool'`を追加
- 2817行目: 末尾へ`, 'fool'`を追加
- 2828行目: 末尾へ`, 'fool'`を追加
- 2847行目: 末尾へ`, 'fool'`を追加
- 2860行目: 末尾へ`, 'fool'`を追加
- 2871行目: 末尾へ`, 'fool'`を追加
- 2875行目: 末尾へ`, 'fool'`を追加
- 2888行目: 末尾へ`, 'fool'`を追加
- 2892行目: 末尾へ`, 'fool'`を追加
- 2904行目: 末尾へ`, 'fool'`を追加
- 2908行目: 末尾へ`, 'fool'`を追加
- 2919行目: `waveTarget(DEFAULT_PARAMS, 0, bossWaveIndex, beginRun(DEFAULT_PARAMS, 1).stageStars),` → `waveTarget(DEFAULT_PARAMS, 0, bossWaveIndex, beginRun(DEFAULT_PARAMS, 1).stageStars, 'fool'),`
- 2931行目: 末尾へ`, 'fool'`を追加
- 2946行目: 末尾へ`, 'fool'`を追加
- 2963行目: `waveTarget(DEFAULT_PARAMS, 0, 0, base.stageStars),` → `waveTarget(DEFAULT_PARAMS, 0, 0, base.stageStars, base.spreadId),`(同一テスト内の`base = beginRun(DEFAULT_PARAMS, 1)`を使う)
- 2979行目: 同様に`base.spreadId`を使う形へ変更
- 3165行目: `score: waveTarget(DEFAULT_PARAMS, 0, 0, begun.stageStars), status: 'ended', endReason: 'target' } }` → `score: waveTarget(DEFAULT_PARAMS, 0, 0, begun.stageStars, begun.spreadId), status: 'ended', endReason: 'target' } }`(同一関数内の`begun = beginRun(DEFAULT_PARAMS, 1)`を使う)

**重要な注意**: 上記の行番号はTask 1〜3のコミットによりファイルが変更されているため、実際の行番号とずれている可能性が高い。作業前に必ず`grep -n "waveTarget(" src/lib/game/shidasu/engine.test.ts`を実行して現在の正確な行番号・件数を確認し、Step 1で既に修正した2箇所(旧2597-2599行目相当のテスト)を除く全ての`waveTarget(`呼び出しに`spreadId`引数(`'fool'`またはその行の直前で定義されている`RunState`変数の`.spreadId`)を追加すること。1箇所でも漏れると型エラーでテストスイート全体がビルド不可になる。

- [ ] **Step 8: テストが通ることを確認する**

Run: `npm test -- engine.test.ts -t "waveTarget"`
Expected: PASS (新規追加した2件を含む)

Run: `npm test -- engine.test.ts`
Expected: 全件PASS(型エラーが1つでも残っているとテストファイル全体が実行できないため、全件PASSすることでStep 7の修正漏れがないことを確認できる)

- [ ] **Step 9: 型チェック・ビルドを実行する**

Run: `npm run check`
Expected: `engine.ts`・`engine.test.ts`・`game/shidasu/+page.svelte`に起因する新規エラーなし

Run: `npm run build`
Expected: 成功

- [ ] **Step 10: 開発サーバーでの簡易動作確認**

Run: `npm run dev`(ポートが競合する場合は自動的に別ポートが割り当てられる)

ブラウザで`/game/shidasu`を開き、どれかのスプレッドでランを開始し、ステージ画面・Wave画面に目標スコアが表示されエラーが出ないことを確認する。確認できたら開発サーバーを停止する。

- [ ] **Step 11: コミット**

```bash
git add src/lib/game/shidasu/engine.ts src/lib/game/shidasu/engine.test.ts src/routes/game/shidasu/+page.svelte
git commit -m "$(cat <<'EOF'
feat: waveTargetにspreadId引数を追加し、皇帝のtargetScoreMultiplierを反映

Co-Authored-By: Claude Sonnet 5 <noreply@anthropic.com>
EOF
)"
```

---

### Task 5: 死んだ管理画面コンポーネント(`SpreadsSection.svelte`)の削除

**Files:**
- Delete: `src/routes/admin/shidasu/SpreadsSection.svelte`
- Modify: `src/routes/admin/shidasu/+page.svelte:1-40, 120` (import・使用箇所・バリデーション)
- Modify: `src/routes/admin/shidasu/JsonPanel.svelte:14-39` (JSON妥当性チェック)

このタスクは自動テストの対象外(admin画面はこのプロジェクトの既存方針として自動テストを書かない)。手を動かして直接修正し、ビルド・型チェック・ブラウザ確認で検証する。

- [ ] **Step 1: `SpreadsSection.svelte`を削除する**

```bash
git rm src/routes/admin/shidasu/SpreadsSection.svelte
```

- [ ] **Step 2: `/admin/shidasu/+page.svelte`からimportと使用箇所を削除する**

`src/routes/admin/shidasu/+page.svelte`の現在の内容(1-10行目):

```svelte
<script lang="ts">
  import { onMount, onDestroy } from 'svelte'
  import { DEFAULT_PARAMS, type ShidasuParams } from '$lib/game/shidasu/params'
  import LayoutSection from './LayoutSection.svelte'
  import ItemsSection from './ItemsSection.svelte'
  import ScoringSection from './ScoringSection.svelte'
  import RoleBonusSection from './RoleBonusSection.svelte'
  import SpreadsSection from './SpreadsSection.svelte'
  import FlowUiSection from './FlowUiSection.svelte'
  import JsonPanel from './JsonPanel.svelte'
```

これを以下に変更する(`SpreadsSection`のimportを削除):

```svelte
<script lang="ts">
  import { onMount, onDestroy } from 'svelte'
  import { DEFAULT_PARAMS, type ShidasuParams } from '$lib/game/shidasu/params'
  import LayoutSection from './LayoutSection.svelte'
  import ItemsSection from './ItemsSection.svelte'
  import ScoringSection from './ScoringSection.svelte'
  import RoleBonusSection from './RoleBonusSection.svelte'
  import FlowUiSection from './FlowUiSection.svelte'
  import JsonPanel from './JsonPanel.svelte'
```

- [ ] **Step 3: `hasValidationError`からfool/moonの`waveTargetBase`/`waveTargetMultiplier`チェックを削除する**

`src/routes/admin/shidasu/+page.svelte`の現在の内容(23-40行目):

```ts
  let hasValidationError = $derived.by(() => {
    if (!config) return false
    if (!Number.isFinite(config.spreads.fool.initialExtraTableauRows)) return true
    if (!Number.isFinite(config.spreads.fool.waveTargetBase) || config.spreads.fool.waveTargetBase <= 0) return true
    if (!Number.isFinite(config.spreads.fool.waveTargetMultiplier) || config.spreads.fool.waveTargetMultiplier <= 1) return true
    if (!Number.isFinite(config.spreads.moon.initialExtraTableauRows)) return true
    if (!Number.isFinite(config.spreads.moon.waveTargetBase) || config.spreads.moon.waveTargetBase <= 0) return true
    if (!Number.isFinite(config.spreads.moon.waveTargetMultiplier) || config.spreads.moon.waveTargetMultiplier <= 1) return true
    // 場札(cols×rows)配布後にfoundation用の1枚が残らないと山札が尽きてゲームが起動できない
    if (config.layout.cols < 1 || config.layout.rows < 1) return true
    if (config.layout.cols * config.layout.rows > 51) return true
    if (!Number.isFinite(config.ui.chainCardsPerRow) || config.ui.chainCardsPerRow < 1) return true
    if (!Number.isFinite(config.ui.chainCardOffsetX) || config.ui.chainCardOffsetX < 0) return true
    if (!Number.isFinite(config.items.maxItems) || config.items.maxItems < 1) return true
    if (!Number.isFinite(config.scoring.suitColorMinLen) || config.scoring.suitColorMinLen < 1) return true
    if (!Number.isFinite(config.talismans.morningMist.x) || config.talismans.morningMist.x <= 0) return true
    return false
  })
```

これを以下に変更する(fool/moonの`initialExtraTableauRows`・`waveTargetBase`・`waveTargetMultiplier`のチェック6行を削除):

```ts
  let hasValidationError = $derived.by(() => {
    if (!config) return false
    // 場札(cols×rows)配布後にfoundation用の1枚が残らないと山札が尽きてゲームが起動できない
    if (config.layout.cols < 1 || config.layout.rows < 1) return true
    if (config.layout.cols * config.layout.rows > 51) return true
    if (!Number.isFinite(config.ui.chainCardsPerRow) || config.ui.chainCardsPerRow < 1) return true
    if (!Number.isFinite(config.ui.chainCardOffsetX) || config.ui.chainCardOffsetX < 0) return true
    if (!Number.isFinite(config.items.maxItems) || config.items.maxItems < 1) return true
    if (!Number.isFinite(config.scoring.suitColorMinLen) || config.scoring.suitColorMinLen < 1) return true
    if (!Number.isFinite(config.talismans.morningMist.x) || config.talismans.morningMist.x <= 0) return true
    return false
  })
```

- [ ] **Step 4: `<SpreadsSection>`の使用箇所を削除する**

`src/routes/admin/shidasu/+page.svelte`の現在の内容(112-122行目):

```svelte
  {#if config}
    <div class="space-y-6">
      <LayoutSection {config} />

      <ScoringSection {config} />

      <RoleBonusSection {config} />

      <SpreadsSection {config} />

      <ItemsSection {config} />
```

これを以下に変更する(`<SpreadsSection {config} />`と直前の空行を削除):

```svelte
  {#if config}
    <div class="space-y-6">
      <LayoutSection {config} />

      <ScoringSection {config} />

      <RoleBonusSection {config} />

      <ItemsSection {config} />
```

- [ ] **Step 5: `JsonPanel.svelte`のJSON妥当性チェックからfool/moonの`waveTargetBase`/`waveTargetMultiplier`型チェックを削除する**

`src/routes/admin/shidasu/JsonPanel.svelte`の現在の内容(14-39行目):

```ts
  function isValidShidasuParams(value: unknown): value is ShidasuParams {
    if (typeof value !== 'object' || value === null) return false
    const v = value as Record<string, unknown>
    const spreads = v.spreads as Record<string, unknown> | undefined
    const fool = spreads?.fool as Record<string, unknown> | undefined
    const moon = spreads?.moon as Record<string, unknown> | undefined
    return (
      typeof v.layout === 'object' && v.layout !== null &&
      typeof v.scoring === 'object' && v.scoring !== null &&
      typeof v.spreads === 'object' && v.spreads !== null &&
      typeof fool?.name === 'string' &&
      typeof fool?.desc === 'string' &&
      typeof fool?.initialExtraTableauRows === 'number' &&
      typeof fool?.waveTargetBase === 'number' &&
      typeof fool?.waveTargetMultiplier === 'number' &&
      typeof moon?.name === 'string' &&
      typeof moon?.desc === 'string' &&
      typeof moon?.initialExtraTableauRows === 'number' &&
      typeof moon?.waveTargetBase === 'number' &&
      typeof moon?.waveTargetMultiplier === 'number' &&
      typeof v.items === 'object' && v.items !== null &&
      typeof v.flow === 'object' && v.flow !== null &&
      typeof v.ui === 'object' && v.ui !== null &&
      typeof v.talismans === 'object' && v.talismans !== null
    )
  }
```

これを以下に変更する(`waveTargetBase`/`waveTargetMultiplier`の型チェック4行を削除):

```ts
  function isValidShidasuParams(value: unknown): value is ShidasuParams {
    if (typeof value !== 'object' || value === null) return false
    const v = value as Record<string, unknown>
    const spreads = v.spreads as Record<string, unknown> | undefined
    const fool = spreads?.fool as Record<string, unknown> | undefined
    const moon = spreads?.moon as Record<string, unknown> | undefined
    return (
      typeof v.layout === 'object' && v.layout !== null &&
      typeof v.scoring === 'object' && v.scoring !== null &&
      typeof v.spreads === 'object' && v.spreads !== null &&
      typeof fool?.name === 'string' &&
      typeof fool?.desc === 'string' &&
      typeof fool?.initialExtraTableauRows === 'number' &&
      typeof moon?.name === 'string' &&
      typeof moon?.desc === 'string' &&
      typeof moon?.initialExtraTableauRows === 'number' &&
      typeof v.items === 'object' && v.items !== null &&
      typeof v.flow === 'object' && v.flow !== null &&
      typeof v.ui === 'object' && v.ui !== null &&
      typeof v.talismans === 'object' && v.talismans !== null
    )
  }
```

- [ ] **Step 6: 型チェック・ビルドを実行する**

Run: `npm run check`
Expected: shidasu関連の新規エラーなし(この時点で`SpreadsSection.svelte`削除・`waveTargetBase`/`waveTargetMultiplier`参照箇所の全削除が完了しているため、これまでのタスクで残っていた型エラーが解消されるはず)

Run: `npm run build`
Expected: 成功

- [ ] **Step 7: 全テストスイートを実行する**

Run: `npm test`
Expected: 全ファイル・全テストPASS

- [ ] **Step 8: 開発サーバーでブラウザ動作確認する**

Run: `npm run dev`

ブラウザで`/admin/shidasu`を開き、「スプレッド(ラン選択)」セクションが表示されなくなっていること、他のセクション(レイアウト・スコアリング・護符等)は引き続き正常に表示・編集できることを確認する。確認できたら開発サーバーを停止する。

- [ ] **Step 9: コミット**

```bash
git add -A src/routes/admin/shidasu/
git commit -m "$(cat <<'EOF'
refactor: /admin/shidasuから死んだSpreadsSectionを削除

Co-Authored-By: Claude Sonnet 5 <noreply@anthropic.com>
EOF
)"
```

---

### Task 6: `/admin/shidasu-spreads`のUI更新と最終動作確認

**Files:**
- Modify: `src/routes/admin/shidasu-spreads/+page.svelte:56-70` (`hasValidationError`)
- Modify: `src/routes/admin/shidasu-spreads/+page.svelte:141-154` (テーブルヘッダー)
- Modify: `src/routes/admin/shidasu-spreads/+page.svelte:167-175` (テーブル行)

このタスクは自動テストの対象外(admin画面はこのプロジェクトの既存方針として自動テストを書かない)。手を動かして直接修正し、ビルド・型チェック・ブラウザ確認で検証する。

- [ ] **Step 1: `hasValidationError`から`waveTargetBase`/`waveTargetMultiplier`のチェックを削除し、新規3フィールドのチェックを追加する**

`src/routes/admin/shidasu-spreads/+page.svelte`の現在の内容(56-70行目):

```ts
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

これを以下に変更する:

```ts
  let hasValidationError = $derived.by(() => {
    if (!config) return false
    return SPREAD_IDS.some(id => {
      const entry = spreadEntry(id)
      if (!entry.name.trim()) return true
      if (!entry.desc.trim()) return true
      if (!Number.isFinite(entry.initialExtraTableauRows)) return true
      if (!Number.isFinite(entry.deckMultiplier)) return true
      if (!Number.isFinite(entry.tableauRowMultiplier)) return true
      if (!Number.isFinite(entry.targetScoreMultiplier)) return true
      if (!Number.isFinite(entry.initialOracleLevel)) return true
      if (!Number.isFinite(entry.initialCurrencyBonus)) return true
      if (!Number.isFinite(entry.initialItemCapacityBonus)) return true
      return false
    })
  })
```

- [ ] **Step 2: テーブルヘッダーを変更する**

`src/routes/admin/shidasu-spreads/+page.svelte`の現在の内容(141-154行目):

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
            </tr>
```

- [ ] **Step 3: テーブル行の入力欄を変更する**

`src/routes/admin/shidasu-spreads/+page.svelte`の現在の内容(167-175行目):

```svelte
                <td class="px-2 py-1.5 align-top">
                  <input type="number" step="any" bind:value={entry.initialExtraTableauRows} class="w-full border border-slate-200 rounded px-1 py-0.5" />
                </td>
                <td class="px-2 py-1.5 align-top">
                  <input type="number" step="any" bind:value={entry.waveTargetBase} class="w-full border border-slate-200 rounded px-1 py-0.5" />
                </td>
                <td class="px-2 py-1.5 align-top">
                  <input type="number" step="any" bind:value={entry.waveTargetMultiplier} class="w-full border border-slate-200 rounded px-1 py-0.5" />
                </td>
```

これを以下に変更する:

```svelte
                <td class="px-2 py-1.5 align-top">
                  <input type="number" step="any" bind:value={entry.initialExtraTableauRows} class="w-full border border-slate-200 rounded px-1 py-0.5" />
                </td>
                <td class="px-2 py-1.5 align-top">
                  <input type="number" step="any" bind:value={entry.deckMultiplier} class="w-full border border-slate-200 rounded px-1 py-0.5" />
                </td>
                <td class="px-2 py-1.5 align-top">
                  <input type="number" step="any" bind:value={entry.tableauRowMultiplier} class="w-full border border-slate-200 rounded px-1 py-0.5" />
                </td>
                <td class="px-2 py-1.5 align-top">
                  <input type="number" step="any" bind:value={entry.targetScoreMultiplier} class="w-full border border-slate-200 rounded px-1 py-0.5" />
                </td>
```

- [ ] **Step 4: 型チェック・ビルドを実行する**

Run: `npm run check`
Expected: shidasu関連の新規エラーなし

Run: `npm run build`
Expected: 成功

- [ ] **Step 5: 全テストスイートを実行する**

Run: `npm test`
Expected: 全ファイル・全テストPASS

- [ ] **Step 6: 開発サーバーでブラウザ動作確認する**

Run: `npm run dev`(ポートが競合する場合は自動的に別ポートが割り当てられる。実際に使われたポート番号を確認すること)

ブラウザで以下を確認する。

1. `/admin/shidasu-spreads`を開き、テーブルに「皇帝」(id: `emperor`)の行が表示されること。「デッキ枚数倍率」「場札行倍率」「目標スコア倍率」列は皇帝のみ`2`、他は全て`1`であること。「護符所持スロットオフセット」列は皇帝のみ`-1`であること
2. `/game/shidasu`のスプレッド選択画面に「皇帝」が表示され、説明文が正しく表示されていること
3. 「皇帝」を選んでランを開始し、以下を確認する:
   - 山札カウンターの合計枚数が通常(52枚由来)の2倍程度になっていること(場札に配られた分も含めて104枚相当であることを、山札+場札のカード数を目視や合算で確認する)
   - 場札の配布行数が通常より多いこと(視覚的に行数が増えていることを確認)
   - ステージ画面・Wave画面の目標スコア表示が通常の2倍程度の値になっていること(例: 通常ステージ1 Wave1の目標が2000なら、皇帝では4000程度になっていること)
   - 護符の所持上限表示が愚者より1少ないこと
4. 「愚者」を選んでランを開始し、従来通りの挙動であること(回帰確認: デッキ52枚、通常の場札行数、通常の目標スコア)
5. `/admin/shidasu`を開き、「スプレッド(ラン選択)」セクションが表示されないこと、他のセクションは正常に動作すること(Task 5の回帰確認)

問題があれば修正し、Step 4〜5を再実行してから次に進む。

- [ ] **Step 7: `shidasu.config.json`が意図しない差分を持っていないか確認する**

ブラウザでのショップ操作等により`shidasu.config.json`が保存APIを通じて書き換わっていないか確認する。

Run: `git status`
Run: `git diff src/lib/game/shidasu/shidasu.config.json`

Task 1で行った変更以外の差分があれば(フォーマットの再整形等)、`git checkout -- src/lib/game/shidasu/shidasu.config.json`で復元してからTask 1の変更のみを再度適用する。差分がTask 1の内容と一致していることを確認できたら、このタスクは追加のコミットなしで完了(Task 1で既にコミット済みのため)。

- [ ] **Step 8: 開発サーバーを停止する**

動作確認が完了したら`npm run dev`のプロセスを停止する。

- [ ] **Step 9: コミット**

```bash
git add src/routes/admin/shidasu-spreads/+page.svelte
git commit -m "$(cat <<'EOF'
feat: /admin/shidasu-spreadsをデッキ枚数倍率・場札行倍率・目標スコア倍率列に更新

Co-Authored-By: Claude Sonnet 5 <noreply@anthropic.com>
EOF
)"
```

(Step 7で修正が発生した場合は、修正内容も同じコミットまたは追加のコミットに含める)
