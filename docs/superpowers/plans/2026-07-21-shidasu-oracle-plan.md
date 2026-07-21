# Shidasu 神託(Oracle)実装 Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** `docs/superpowers/specs/2026-07-21-shidasu-oracle-design.md`に基づき、アイテム種類④神託(Oracle、八卦モチーフ)を8種(現在実装済みの8役全てに1:1対応)実装し、ウェーブクリア時の専用選択画面(即時使用・所持概念なし)と、役レベルによる永続的な得点強化・常時表示エリアを追加する。

**Architecture:** 天啓・秘儀と同じ「型追加→パラメータ登録→ロジック追加→engine.ts組み込み→UI」パターンを踏襲しつつ、神託固有の単純化点を活かす: (1)所持概念が無く、選択画面での即時使用のみ(専用の`useOracle`的関数やインベントリ管理は不要)、(2)場札・デッキに一切作用しないため、天啓のようなプレビューウェーブ・`PlayArea`流用は不要で、護符選択と同じシンプルな全画面モーダルで完結する、(3)効果は`RunState.oracleLevels`(役ごとのレベル)を+1するだけで、実際の得点計算は既存の`evaluateChainBonus`(patterns.ts)・列一掃加点(engine.ts)にレベル乗算を追加するだけで完結する。

**Tech Stack:** TypeScript, Svelte 5, Vitest

---

### Task 1: 型定義・パラメータ登録・参照データ・oracles.ts

**Files:**
- Modify: `src/lib/game/shidasu/types.ts`
- Modify: `src/lib/game/shidasu/params.ts`
- Modify: `src/lib/game/shidasu/shidasu.config.json`
- Create: `src/lib/game/shidasu/trigrams.ts`
- Create: `src/lib/game/shidasu/roles.ts`
- Create: `src/lib/game/shidasu/oracles.ts`
- Test: `src/lib/game/shidasu/engine.test.ts`(型追従のみ)
- Test: `src/lib/game/shidasu/riteEffects.test.ts`(型追従のみ)
- Test: `src/lib/game/shidasu/revelationEffects.test.ts`(型追従のみ)

- [ ] **Step 1: `RoleName`型を8種に拡張する**

`src/lib/game/shidasu/types.ts`の6行目:

```ts
export type RoleName = 'flush' | 'royalSet' | 'sameRank' | 'completeRun' | 'columnSweep'
```

を以下に置き換える:

```ts
export type RoleName = 'flush' | 'royalSet' | 'sameRank' | 'completeRun' | 'columnSweep' | 'suit' | 'color' | 'stair'
```

- [ ] **Step 2: `RunPhase`に`'oracleSelect'`を追加する**

`src/lib/game/shidasu/types.ts`の174行目:

```ts
export type RunPhase = 'title' | 'playing' | 'itemSelect' | 'revelationSelect' | 'stageClear' | 'allClear' | 'gameOver'
```

を以下に置き換える:

```ts
export type RunPhase = 'title' | 'playing' | 'itemSelect' | 'revelationSelect' | 'oracleSelect' | 'stageClear' | 'allClear' | 'gameOver'
```

- [ ] **Step 3: `WaveState`に`oracleLevels`を追加する**

`WaveState`インターフェースの末尾(`ehwazActiveThisWave: boolean`の直後、171行目付近)に追加:

```ts
  // 神託用: ウェーブ開始時点の各役のレベル(ラン全体で持続。ウェーブ中は不変)。
  // 得点計算時、各役の基礎点にこのレベルを乗算する(patterns.ts・engine.ts参照)
  oracleLevels: Record<RoleName, number>
```

- [ ] **Step 4: `RunState`に`oracleLevels`・`oracleOffer`を追加する**

`RunState`インターフェースの末尾(`extraTableauRows: number`の直後、193行目付近)に追加:

```ts
  // 各役の現在レベル(初期値1、上限なし)。ラン全体で持続する(神託選択画面で+1される)
  oracleLevels: Record<RoleName, number>
  // 神託選択画面('oracleSelect'フェーズ)で提示中のオファー(3択)。それ以外のフェーズでは空配列
  oracleOffer: RoleName[]
```

- [ ] **Step 5: `trigrams.ts`を新規作成する**

`src/lib/game/shidasu/trigrams.ts`を新規作成:

```ts
// 八卦(易における8つの基本図像)全8卦の参照データ。管理画面の「名前」<select>の
// 選択肢・読み方ラベル表示にのみ使う(秘儀のrunes.ts・天啓のmansions.tsと同じ位置づけ。
// 神託は8卦が現在実装済みの8役と1:1で対応するため、天啓のような「未使用分の温存」は無い)。
export interface TrigramEntry {
  kanji: string
  reading: string
}

export const TRIGRAMS: TrigramEntry[] = [
  { kanji: '乾', reading: 'けん' },
  { kanji: '兌', reading: 'だ' },
  { kanji: '離', reading: 'り' },
  { kanji: '震', reading: 'しん' },
  { kanji: '巽', reading: 'そん' },
  { kanji: '坎', reading: 'かん' },
  { kanji: '艮', reading: 'ごん' },
  { kanji: '坤', reading: 'こん' },
]
```

- [ ] **Step 6: `roles.ts`を新規作成する**

`src/lib/game/shidasu/roles.ts`を新規作成:

```ts
// src/lib/game/shidasu/roles.ts
import type { RoleName } from './types'
import type { ShidasuParams } from './params'

// 常時表示エリア(RoleStatusPanel)向けの、8役それぞれの表示名・発動条件の説明文。
// 神託自体の名前・説明文(params.oracles、8卦の個別名)とは別物で、こちらは役そのものの
// 固定の説明(docs/shidasu/shidasu-current-rules.md 4.2節の内容に対応)。
export interface RoleEntry {
  name: RoleName
  label: string
  desc: string
}

export const ROLE_LIST: RoleEntry[] = [
  { name: 'suit', label: '同スート', desc: 'チェーンが3枚以上かつ全て同じスート' },
  { name: 'color', label: '同色', desc: '同スート不成立、かつチェーンが3枚以上かつ全て同じ色' },
  { name: 'stair', label: '階段', desc: 'チェーンが同方向に連続し、最小連続枚数以上' },
  { name: 'flush', label: 'フラッシュ', desc: '直近4枚で♠♥♦♣が全て揃う' },
  { name: 'royalSet', label: 'ロイヤルセット', desc: '直近3枚でJ・Q・Kが揃う' },
  { name: 'sameRank', label: '同ランク', desc: 'チェーン内に同じランクが複数出現' },
  { name: 'completeRun', label: 'コンプリートラン', desc: '13ランクが出揃った瞬間(同スートなら追加ボーナスも)' },
  { name: 'columnSweep', label: '列一掃', desc: '場札の列を最後の1枚まで取り切る' },
]

// 役の基礎点(神託レベルを乗算する前の値)をparams.scoringから引く。
export function roleBasePoint(params: ShidasuParams, roleName: RoleName): number {
  switch (roleName) {
    case 'suit': return params.scoring.suitBonus
    case 'color': return params.scoring.colorBonus
    case 'stair': return params.scoring.stairBonus
    case 'flush': return params.scoring.flushBonus
    case 'royalSet': return params.scoring.royalSetBonus
    case 'sameRank': return params.scoring.sameRankBonusUnit
    case 'completeRun': return params.scoring.completeRunBonus
    case 'columnSweep': return params.scoring.columnSweepBonus
  }
}
```

- [ ] **Step 7: `params.ts`に`oracles`セクションを追加する**

`ShidasuParams`インターフェースの`revelations: {...}`ブロックの直後(163行目付近、`flow: {`の直前)に追加:

```ts
  oracles: {
    completeRun: { name: string; desc: string }
    royalSet: { name: string; desc: string }
    flush: { name: string; desc: string }
    stair: { name: string; desc: string }
    color: { name: string; desc: string }
    suit: { name: string; desc: string }
    columnSweep: { name: string; desc: string }
    sameRank: { name: string; desc: string }
  }
```

`DEFAULT_PARAMS.revelations`ブロックの直後(330行目付近、`aya`エントリの後の`},`の直後、`flow: { wavesPerStage: 3, ... }`の直前)に追加:

```ts
  oracles: {
    completeRun: { name: '乾', desc: '使用すると「コンプリートラン」の得点が永続的に上昇する(レベル+1)' },
    royalSet: { name: '兌', desc: '使用すると「ロイヤルセット」の得点が永続的に上昇する(レベル+1)' },
    flush: { name: '離', desc: '使用すると「フラッシュ」の得点が永続的に上昇する(レベル+1)' },
    stair: { name: '震', desc: '使用すると「階段」の得点が永続的に上昇する(レベル+1)' },
    color: { name: '巽', desc: '使用すると「同色」の得点が永続的に上昇する(レベル+1)' },
    suit: { name: '坎', desc: '使用すると「同スート」の得点が永続的に上昇する(レベル+1)' },
    columnSweep: { name: '艮', desc: '使用すると「列一掃」の得点が永続的に上昇する(レベル+1)' },
    sameRank: { name: '坤', desc: '使用すると「同ランク」の得点が永続的に上昇する(レベル+1)' },
  },
```

- [ ] **Step 8: `shidasu.config.json`に`oracles`セクションを追加する**

`src/lib/game/shidasu/shidasu.config.json`の`"revelations"`セクションの閉じ`},`の直後(`"flow"`セクションの直前、731行目付近)に追加:

```json
  "oracles": {
    "completeRun": { "name": "乾", "desc": "使用すると「コンプリートラン」の得点が永続的に上昇する(レベル+1)" },
    "royalSet": { "name": "兌", "desc": "使用すると「ロイヤルセット」の得点が永続的に上昇する(レベル+1)" },
    "flush": { "name": "離", "desc": "使用すると「フラッシュ」の得点が永続的に上昇する(レベル+1)" },
    "stair": { "name": "震", "desc": "使用すると「階段」の得点が永続的に上昇する(レベル+1)" },
    "color": { "name": "巽", "desc": "使用すると「同色」の得点が永続的に上昇する(レベル+1)" },
    "suit": { "name": "坎", "desc": "使用すると「同スート」の得点が永続的に上昇する(レベル+1)" },
    "columnSweep": { "name": "艮", "desc": "使用すると「列一掃」の得点が永続的に上昇する(レベル+1)" },
    "sameRank": { "name": "坤", "desc": "使用すると「同ランク」の得点が永続的に上昇する(レベル+1)" }
  },
```

**注意:** 既存ファイルはオブジェクトの各フィールドを1行ずつ改行するスタイル(revelationsセクション参照)だが、上記は`params.ts`のTS側と1行対応にして問題ない(既存の`talismans`セクションも1行スタイルの箇所がある)。挿入位置さえ正しければどちらの整形でもよい。

- [ ] **Step 9: `oracles.ts`を新規作成する**

`src/lib/game/shidasu/oracles.ts`を新規作成:

```ts
// src/lib/game/shidasu/oracles.ts
import type { RoleName } from './types'
import type { ShidasuParams } from './params'
import { shuffleInPlace } from './deck'

// rollOracleOfferは重み付けなしの完全均等抽選。8役すべてが対象(将来の追加余地なし)。
export const ORACLE_POOL: RoleName[] = [
  'completeRun', 'royalSet', 'flush', 'stair', 'color', 'suit', 'columnSweep', 'sameRank',
]

export function oracleName(roleName: RoleName, params: ShidasuParams): string {
  return params.oracles[roleName].name
}

export function oracleDesc(roleName: RoleName, params: ShidasuParams): string {
  return params.oracles[roleName].desc
}

// 神託プールから均等ランダムに3つ選ぶ(天啓のrollRevelationOfferと同じ方式。重複除外は無いが、
// 8種類中3つをシャッフルして先頭から取るため、1回のオファー内で同じ役が重複することはない)。
export function rollOracleOffer(rand: () => number = Math.random): RoleName[] {
  const pool = [...ORACLE_POOL]
  shuffleInPlace(pool, rand)
  return pool.slice(0, 3)
}

// 各役のレベルの初期値(全て1)。startWave・createInitialRun・beginRunの既定値として使う。
export function defaultOracleLevels(): Record<RoleName, number> {
  return {
    flush: 1, royalSet: 1, sameRank: 1, completeRun: 1, columnSweep: 1,
    suit: 1, color: 1, stair: 1,
  }
}
```

- [ ] **Step 10: 既存の`WaveState`リテラルに`oracleLevels`を追加する(3箇所)**

`src/lib/game/shidasu/engine.test.ts`の`makeWave`関数(57行目付近)、`ehwazActiveThisWave: false,`の直後(101行目付近):

```ts
    mannazActiveThisWave: false,
    ehwazActiveThisWave: false,
    ...overrides,
  }
```

を以下に置き換える(`defaultOracleLevels`のimportを追加した上で):

```ts
    mannazActiveThisWave: false,
    ehwazActiveThisWave: false,
    oracleLevels: defaultOracleLevels(),
    ...overrides,
  }
```

`engine.test.ts`のimport群(1-37行目付近)に`defaultOracleLevels`を追加する。既存のimport文(31行目付近):

```ts
} from './engine'
import { ITEM_POOL } from './items'
import { isFace, chainContinuesPattern } from './patterns'
import type { Card, WaveState, RunState, ItemId } from './types'
import { DEFAULT_PARAMS } from './params'
import { createRng, standardDeckComposition } from './deck'
import { card } from './testHelpers'
```

を以下に置き換える:

```ts
} from './engine'
import { ITEM_POOL } from './items'
import { isFace, chainContinuesPattern } from './patterns'
import type { Card, WaveState, RunState, ItemId } from './types'
import { DEFAULT_PARAMS } from './params'
import { createRng, standardDeckComposition } from './deck'
import { card } from './testHelpers'
import { defaultOracleLevels } from './oracles'
```

同様に`src/lib/game/shidasu/riteEffects.test.ts`の`baseWave`関数(11行目付近)、`ehwazActiveThisWave: false,`の直後(55行目付近)にも`oracleLevels: defaultOracleLevels(),`を追加し、import群(1-5行目付近)に`import { defaultOracleLevels } from './oracles'`を追加する。

同様に`src/lib/game/shidasu/revelationEffects.test.ts`の`baseWave`関数(15行目付近)、`ehwazActiveThisWave: false,`の直後(59行目付近)にも`oracleLevels: defaultOracleLevels(),`を追加し、import群(1-5行目付近)に`import { defaultOracleLevels } from './oracles'`を追加する。

- [ ] **Step 11: 既存の`RunState`リテラル(6箇所)に`oracleLevels`・`oracleOffer`を追加する**

`src/lib/game/shidasu/engine.test.ts`内、`describe('applyStuckCheck', ...)`ブロック内の以下の完全な文字列(6箇所、全て同一):

```ts
      revelations: [], revelationOffer: [], extraTableauRows: 0,
```

を`replace_all`で以下に一括置換する:

```ts
      revelations: [], revelationOffer: [], extraTableauRows: 0,
      oracleLevels: defaultOracleLevels(), oracleOffer: [],
```

- [ ] **Step 12: 型チェックを実行し、想定内のエラーのみであることを確認する**

Run: `npm run check`
Expected: `engine.ts`内の`startWave`が返す`WaveState`リテラルに`oracleLevels`が無いことによる型エラー、および`createInitialRun`・`beginRun`が返す`RunState`リテラルに`oracleLevels`・`oracleOffer`が無いことによる型エラーが出ることを許容する(いずれもTask 3で解消する)。それ以外(`trigrams.ts`・`roles.ts`・`oracles.ts`・`engine.test.ts`・`riteEffects.test.ts`・`revelationEffects.test.ts`・`params.ts`・`shidasu.config.json`関連)にエラーが無いことを確認する。

- [ ] **Step 13: コミット**

```bash
git add src/lib/game/shidasu/types.ts src/lib/game/shidasu/params.ts src/lib/game/shidasu/shidasu.config.json src/lib/game/shidasu/trigrams.ts src/lib/game/shidasu/roles.ts src/lib/game/shidasu/oracles.ts src/lib/game/shidasu/engine.test.ts src/lib/game/shidasu/riteEffects.test.ts src/lib/game/shidasu/revelationEffects.test.ts
git commit -m "feat: 神託の型定義・パラメータ・八卦/役参照データを追加"
```

---

### Task 2: `patterns.ts` — 神託レベルの得点計算への統合

**Files:**
- Modify: `src/lib/game/shidasu/patterns.ts`
- Test: `src/lib/game/shidasu/patterns.test.ts`

- [ ] **Step 1: 失敗するテストを書く**

`src/lib/game/shidasu/patterns.test.ts`の末尾に、新しい`describe`ブロックを追加する:

```ts
describe('evaluateChainBonus: 神託レベル(oracleLevel)による得点上昇', () => {
  const scoring = DEFAULT_PARAMS.scoring

  test('同スートボーナスにレベルが乗算される', () => {
    const chainBefore = [card(1, '♠', 3), card(2, '♠', 4)]
    const oracleLevel = (name: RoleName) => (name === 'suit' ? 3 : 1)
    const result = evaluateChainBonus(scoring, chainBefore, card(3, '♠', 5), undefined, undefined, undefined, oracleLevel)
    expect(result.bonus).toBe(scoring.suitBonus * 3)
  })

  test('同色ボーナスにレベルが乗算される', () => {
    const chainBefore = [card(1, '♠', 3), card(2, '♣', 4)]
    const oracleLevel = (name: RoleName) => (name === 'color' ? 2 : 1)
    const result = evaluateChainBonus(scoring, chainBefore, card(3, '♠', 6), undefined, undefined, undefined, oracleLevel)
    expect(result.bonus).toBe(scoring.colorBonus * 2)
  })

  test('階段ボーナスにレベルが乗算される', () => {
    const chainBefore = [card(1, '♠', 1), card(2, '♥', 2), card(3, '♦', 3), card(4, '♣', 4)]
    const oracleLevel = (name: RoleName) => (name === 'stair' ? 4 : 1)
    const result = evaluateChainBonus(scoring, chainBefore, card(5, '♠', 5), undefined, undefined, undefined, oracleLevel)
    expect(result.bonus).toBe(scoring.stairBonus * 4)
  })

  test('フラッシュボーナスにレベルが乗算され、既存のroleBonusMultiplierとも併用できる', () => {
    const chainBefore = [card(1, '♠', 2), card(2, '♥', 3), card(3, '♦', 4)]
    const oracleLevel = (name: RoleName) => (name === 'flush' ? 2 : 1)
    const roleBonusMultiplier = (name: RoleName) => (name === 'flush' ? 1.5 : 1)
    const result = evaluateChainBonus(scoring, chainBefore, card(4, '♣', 5), undefined, roleBonusMultiplier, undefined, oracleLevel)
    const flushEntry = result.roleFired.find(r => r.name === 'flush')
    expect(flushEntry?.amount).toBe(Math.floor(scoring.flushBonus * 2 * 1.5))
  })

  test('コンプリートラン・コンプリートラン(同スート)は同じcompleteRunレベルを参照する', () => {
    const chainBefore: Card[] = []
    for (let rank = 1 as Card['rank']; rank <= 12; rank = (rank + 1) as Card['rank']) {
      chainBefore.push(card(rank, '♠', rank))
    }
    const oracleLevel = (name: RoleName) => (name === 'completeRun' ? 2 : 1)
    const result = evaluateChainBonus(scoring, chainBefore, card(13, '♠', 13), undefined, undefined, undefined, oracleLevel)
    const completeRunEntry = result.roleFired.find(r => r.name === 'completeRun')
    expect(completeRunEntry?.amount).toBe(Math.floor(scoring.completeRunBonus * 2) + Math.floor(scoring.completeRunSuitBonus * 2))
  })

  test('同ランクボーナスにレベルが乗算される', () => {
    const chainBefore = [card(1, '♠', 5), card(2, '♥', 5)]
    const oracleLevel = (name: RoleName) => (name === 'sameRank' ? 3 : 1)
    const result = evaluateChainBonus(scoring, chainBefore, card(3, '♦', 5), undefined, undefined, undefined, oracleLevel)
    const sameRankEntry = result.roleFired.find(r => r.name === 'sameRank')
    expect(sameRankEntry?.amount).toBe(Math.floor(scoring.sameRankBonusUnit * 2 * 3))
  })

  test('oracleLevelを省略すると全役レベル1として扱われ、既存の挙動と一致する', () => {
    const chainBefore = [card(1, '♠', 3), card(2, '♠', 4)]
    const withDefault = evaluateChainBonus(scoring, chainBefore, card(3, '♠', 5))
    const withExplicitOne = evaluateChainBonus(scoring, chainBefore, card(3, '♠', 5), undefined, undefined, undefined, () => 1)
    expect(withDefault.bonus).toBe(withExplicitOne.bonus)
    expect(withDefault.bonus).toBe(scoring.suitBonus)
  })
})
```

- [ ] **Step 2: テストを実行し失敗を確認する**

Run: `npm run test -- patterns`
Expected: FAIL(`evaluateChainBonus`が7番目の引数`oracleLevel`を受け取らず、レベル乗算も行われていないため、上記テストの多くが失敗する)

- [ ] **Step 3: `evaluateChainBonus`にレベル乗算を実装する**

`src/lib/game/shidasu/patterns.ts`の`evaluateChainBonus`関数(162-254行目付近)全体:

```ts
export function evaluateChainBonus(
  scoring: ShidasuParams['scoring'],
  chainBefore: Card[],
  card: Card,
  stairMinLen: number = scoring.stairMinLen,
  roleBonusMultiplier: (name: RoleName) => number = () => 1,
  suitColorMinLen: number = scoring.suitColorMinLen
): ChainBonusResult {
  if (chainBefore.length === 0) {
    return { bonus: 0, parts: [], patternFired: false, patternFiredCount: 0, roleFired: [] }
  }

  let bonus = 0
  const parts: string[] = []
  let patternFired = false
  let patternFiredCount = 0
  const roleFired: { name: RoleName; usedWild: boolean; amount: number }[] = []

  const chainIncludingThis = [...chainBefore, card]

  const { suitHeld, colorHeld } = analyzeSuitColor(chainIncludingThis)
  if (chainIncludingThis.length >= suitColorMinLen) {
    if (suitHeld) {
      bonus += scoring.suitBonus
      parts.push(`同スート+${scoring.suitBonus}`)
      patternFired = true
      patternFiredCount += 1
    } else if (colorHeld) {
      bonus += scoring.colorBonus
      parts.push(`同色+${scoring.colorBonus}`)
      patternFired = true
      patternFiredCount += 1
    }
  }

  const stairInfo = analyzeStair(chainIncludingThis)
  if (stairInfo.held && stairInfo.len >= stairMinLen) {
    bonus += scoring.stairBonus
    parts.push(`階段${stairInfo.len} +${scoring.stairBonus}`)
    patternFired = true
    patternFiredCount += 1
  }

  if (checkFlush(chainIncludingThis)) {
    const flushGain = Math.floor(scoring.flushBonus * roleBonusMultiplier('flush'))
    bonus += flushGain
    parts.push(`フラッシュ+${flushGain}`)
    const last4 = chainIncludingThis.slice(-4)
    const realSuits = new Set(last4.filter(c => !c.wild).map(c => c.suit))
    const flushUsedWild = ALL_SUITS_REAL.some(s => !realSuits.has(s))
    roleFired.push({ name: 'flush', usedWild: flushUsedWild, amount: flushGain })
  }

  if (checkRoyalSet(chainIncludingThis)) {
    const royalSetGain = Math.floor(scoring.royalSetBonus * roleBonusMultiplier('royalSet'))
    bonus += royalSetGain
    parts.push(`ロイヤル+${royalSetGain}`)
    const last3 = chainIncludingThis.slice(-3)
    const realRanks = new Set(last3.filter(c => !c.wild).map(c => c.rank))
    const requiredRanks: Card['rank'][] = [11, 12, 13]
    const royalSetUsedWild = requiredRanks.some(r => !realRanks.has(r))
    roleFired.push({ name: 'royalSet', usedWild: royalSetUsedWild, amount: royalSetGain })
  }

  const sameRankCount = card.wild ? countSameRankForWildPlay(chainBefore) : countSameRankBefore(chainBefore, card.rank)
  if (sameRankCount > 0) {
    const sameRankGain = Math.floor(scoring.sameRankBonusUnit * sameRankCount * roleBonusMultiplier('sameRank'))
    bonus += sameRankGain
    parts.push(`同ランク+${sameRankGain}`)
    const sameRankUsedWild = card.wild || chainBefore.some(c => c.wild)
    roleFired.push({ name: 'sameRank', usedWild: sameRankUsedWild, amount: sameRankGain })
  }

  if (checkCompleteRun(chainBefore, chainIncludingThis)) {
    const completeRunGain = Math.floor(scoring.completeRunBonus * roleBonusMultiplier('completeRun'))
    bonus += completeRunGain
    parts.push(`コンプリートラン+${completeRunGain}`)
    const distinctRealNow = new Set(chainIncludingThis.filter(c => !c.wild).map(c => c.rank)).size
    const wildCountNow = chainIncludingThis.filter(c => c.wild).length
    const completeRunUsedWild = distinctRealNow < 13 && wildCountNow > 0
    // completeRunのみ、同スート追加ボーナスの有無を確定させてからroleFiredにpushする
    // (他の役は単一の加点のみだが、completeRunは同スート追加分も合算してamountに含めるため)。
    let completeRunTotalGain = completeRunGain
    if (suitHeld) {
      const completeRunSuitGain = Math.floor(scoring.completeRunSuitBonus * roleBonusMultiplier('completeRun'))
      bonus += completeRunSuitGain
      parts.push(`コンプリートラン(同スート)+${completeRunSuitGain}`)
      completeRunTotalGain += completeRunSuitGain
    }
    roleFired.push({ name: 'completeRun', usedWild: completeRunUsedWild, amount: completeRunTotalGain })
  }

  return { bonus, parts, patternFired, patternFiredCount, roleFired }
}
```

を以下に置き換える(**末尾に新しい省略可能引数`oracleLevel`を追加し、8つの役全ての計算に乗算を挿入する**):

```ts
export function evaluateChainBonus(
  scoring: ShidasuParams['scoring'],
  chainBefore: Card[],
  card: Card,
  stairMinLen: number = scoring.stairMinLen,
  roleBonusMultiplier: (name: RoleName) => number = () => 1,
  suitColorMinLen: number = scoring.suitColorMinLen,
  oracleLevel: (name: RoleName) => number = () => 1
): ChainBonusResult {
  if (chainBefore.length === 0) {
    return { bonus: 0, parts: [], patternFired: false, patternFiredCount: 0, roleFired: [] }
  }

  let bonus = 0
  const parts: string[] = []
  let patternFired = false
  let patternFiredCount = 0
  const roleFired: { name: RoleName; usedWild: boolean; amount: number }[] = []

  const chainIncludingThis = [...chainBefore, card]

  const { suitHeld, colorHeld } = analyzeSuitColor(chainIncludingThis)
  if (chainIncludingThis.length >= suitColorMinLen) {
    if (suitHeld) {
      const suitGain = Math.floor(scoring.suitBonus * oracleLevel('suit'))
      bonus += suitGain
      parts.push(`同スート+${suitGain}`)
      patternFired = true
      patternFiredCount += 1
    } else if (colorHeld) {
      const colorGain = Math.floor(scoring.colorBonus * oracleLevel('color'))
      bonus += colorGain
      parts.push(`同色+${colorGain}`)
      patternFired = true
      patternFiredCount += 1
    }
  }

  const stairInfo = analyzeStair(chainIncludingThis)
  if (stairInfo.held && stairInfo.len >= stairMinLen) {
    const stairGain = Math.floor(scoring.stairBonus * oracleLevel('stair'))
    bonus += stairGain
    parts.push(`階段${stairInfo.len} +${stairGain}`)
    patternFired = true
    patternFiredCount += 1
  }

  if (checkFlush(chainIncludingThis)) {
    const flushGain = Math.floor(scoring.flushBonus * oracleLevel('flush') * roleBonusMultiplier('flush'))
    bonus += flushGain
    parts.push(`フラッシュ+${flushGain}`)
    const last4 = chainIncludingThis.slice(-4)
    const realSuits = new Set(last4.filter(c => !c.wild).map(c => c.suit))
    const flushUsedWild = ALL_SUITS_REAL.some(s => !realSuits.has(s))
    roleFired.push({ name: 'flush', usedWild: flushUsedWild, amount: flushGain })
  }

  if (checkRoyalSet(chainIncludingThis)) {
    const royalSetGain = Math.floor(scoring.royalSetBonus * oracleLevel('royalSet') * roleBonusMultiplier('royalSet'))
    bonus += royalSetGain
    parts.push(`ロイヤル+${royalSetGain}`)
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
    parts.push(`同ランク+${sameRankGain}`)
    const sameRankUsedWild = card.wild || chainBefore.some(c => c.wild)
    roleFired.push({ name: 'sameRank', usedWild: sameRankUsedWild, amount: sameRankGain })
  }

  if (checkCompleteRun(chainBefore, chainIncludingThis)) {
    const completeRunGain = Math.floor(scoring.completeRunBonus * oracleLevel('completeRun') * roleBonusMultiplier('completeRun'))
    bonus += completeRunGain
    parts.push(`コンプリートラン+${completeRunGain}`)
    const distinctRealNow = new Set(chainIncludingThis.filter(c => !c.wild).map(c => c.rank)).size
    const wildCountNow = chainIncludingThis.filter(c => c.wild).length
    const completeRunUsedWild = distinctRealNow < 13 && wildCountNow > 0
    // completeRunのみ、同スート追加ボーナスの有無を確定させてからroleFiredにpushする
    // (他の役は単一の加点のみだが、completeRunは同スート追加分も合算してamountに含めるため)。
    let completeRunTotalGain = completeRunGain
    if (suitHeld) {
      const completeRunSuitGain = Math.floor(scoring.completeRunSuitBonus * oracleLevel('completeRun') * roleBonusMultiplier('completeRun'))
      bonus += completeRunSuitGain
      parts.push(`コンプリートラン(同スート)+${completeRunSuitGain}`)
      completeRunTotalGain += completeRunSuitGain
    }
    roleFired.push({ name: 'completeRun', usedWild: completeRunUsedWild, amount: completeRunTotalGain })
  }

  return { bonus, parts, patternFired, patternFiredCount, roleFired }
}
```

- [ ] **Step 4: テストを実行し成功を確認する**

Run: `npm run test -- patterns`
Expected: PASS

- [ ] **Step 5: 型チェック・全体テストを実行する**

Run: `npm run check`
Run: `npm run test`
Expected: `patterns.ts`・`patterns.test.ts`にエラーが無いこと。全体テストはTask 1と同様、`engine.ts`側の型エラー(Task 3で解消)以外は成功すること

- [ ] **Step 6: コミット**

```bash
git add src/lib/game/shidasu/patterns.ts src/lib/game/shidasu/patterns.test.ts
git commit -m "feat: evaluateChainBonusに神託レベル(oracleLevel)による得点乗算を追加"
```

---

### Task 3: `engine.ts` — 神託選択フェーズと状態遷移・得点計算への組み込み

**Files:**
- Modify: `src/lib/game/shidasu/engine.ts`
- Test: `src/lib/game/shidasu/engine.test.ts`

- [ ] **Step 1: importを追加する**

`src/lib/game/shidasu/engine.ts`のimport群(1-12行目、現在の内容):

```ts
import type { Card, StageModifier, WaveState, ItemId, WaveEndReason, RunState, Suit, Rank, DeckCard, RoleName, BonusGain, ChainCardOrigin, RiteId, Rarity, RevelationId } from './types'
import type { ShidasuParams } from './params'
import { createRng, shuffle, shuffleInPlace, standardDeckComposition } from './deck'
import { isFace, chainContinuesPattern, evaluateChainBonus, analyzeSuitColor, countSameRankBefore, countSameRankForWildPlay, fmtMultiplier } from './patterns'
import { rollItemOffer } from './items'
import { applyDirectEffects, type DirectEffectContext } from './directEffects'
import { applyItemEffects, type ItemEffectContext } from './itemEffects'
import { applyRiteEffect, canUseRite } from './riteEffects'
import { rollRite } from './rites'
import { rollRevelationOffer } from './revelations'
import { applyRevelationEffect, canUseRevelation } from './revelationEffects'
```

を以下に置き換える(末尾に1行追加):

```ts
import type { Card, StageModifier, WaveState, ItemId, WaveEndReason, RunState, Suit, Rank, DeckCard, RoleName, BonusGain, ChainCardOrigin, RiteId, Rarity, RevelationId } from './types'
import type { ShidasuParams } from './params'
import { createRng, shuffle, shuffleInPlace, standardDeckComposition } from './deck'
import { isFace, chainContinuesPattern, evaluateChainBonus, analyzeSuitColor, countSameRankBefore, countSameRankForWildPlay, fmtMultiplier } from './patterns'
import { rollItemOffer } from './items'
import { applyDirectEffects, type DirectEffectContext } from './directEffects'
import { applyItemEffects, type ItemEffectContext } from './itemEffects'
import { applyRiteEffect, canUseRite } from './riteEffects'
import { rollRite } from './rites'
import { rollRevelationOffer } from './revelations'
import { applyRevelationEffect, canUseRevelation } from './revelationEffects'
import { rollOracleOffer, defaultOracleLevels } from './oracles'
```

- [ ] **Step 2: `startWave`に`oracleLevels`引数を追加する**

`startWave`関数シグネチャ(91-99行目、現在の内容):

```ts
export function startWave(
  params: ShidasuParams,
  _stageIndex: number,
  _waveIndex: number,
  items: ItemId[],
  deckComposition: DeckCard[],
  seed?: number,
  extraTableauRows: number = 0
): { wave: WaveState; deckComposition: DeckCard[] } {
```

を以下に置き換える(**末尾に新しい省略可能引数を追加する。既存の呼び出し箇所・テストは無変更のまま動作し続ける**):

```ts
export function startWave(
  params: ShidasuParams,
  _stageIndex: number,
  _waveIndex: number,
  items: ItemId[],
  deckComposition: DeckCard[],
  seed?: number,
  extraTableauRows: number = 0,
  oracleLevels: Record<RoleName, number> = defaultOracleLevels()
): { wave: WaveState; deckComposition: DeckCard[] } {
```

同関数内で構築される`WaveState`リテラル(128-172行目、現在の内容の末尾付近):

```ts
    mannazActiveThisWave: false,
    ehwazActiveThisWave: false,
  }

  return { wave, deckComposition: composition }
```

を以下に置き換える:

```ts
    mannazActiveThisWave: false,
    ehwazActiveThisWave: false,
    oracleLevels,
  }

  return { wave, deckComposition: composition }
```

- [ ] **Step 3: `playCard`の得点計算に`oracleLevel`を組み込む**

`playCard`関数内、`roleBonusMultiplier`定義の直後(309-325行目付近、現在の内容):

```ts
  let sowiloCommittedThisPlay: RoleName | null = null
  const roleBonusMultiplier = (name: RoleName): number => {
    let factor = 1
    if (items.includes('morningStar')) {
      const count = wave.roleOccurrenceCountThisWave[name] ?? 0
      factor *= 1 + count * params.talismans.morningStar.x
    }
    if (wave.sowiloActiveThisWave) {
      if (wave.sowiloBoostedRole === name || sowiloCommittedThisPlay === name) {
        factor *= params.rites.sowilo.x
      } else if (wave.sowiloBoostedRole === null && sowiloCommittedThisPlay === null) {
        sowiloCommittedThisPlay = name
        factor *= params.rites.sowilo.x
      }
    }
    return factor
  }
  const chainResult = evaluateChainBonus(params.scoring, wave.chain, card, effectiveStairMinLen, roleBonusMultiplier, effectiveSuitColorMinLen)
```

を以下に置き換える:

```ts
  let sowiloCommittedThisPlay: RoleName | null = null
  const roleBonusMultiplier = (name: RoleName): number => {
    let factor = 1
    if (items.includes('morningStar')) {
      const count = wave.roleOccurrenceCountThisWave[name] ?? 0
      factor *= 1 + count * params.talismans.morningStar.x
    }
    if (wave.sowiloActiveThisWave) {
      if (wave.sowiloBoostedRole === name || sowiloCommittedThisPlay === name) {
        factor *= params.rites.sowilo.x
      } else if (wave.sowiloBoostedRole === null && sowiloCommittedThisPlay === null) {
        sowiloCommittedThisPlay = name
        factor *= params.rites.sowilo.x
      }
    }
    return factor
  }
  // 神託: 役ごとの現在レベルをそのまま基礎点の乗数として渡す(ウェーブ開始時点で固定済み)
  const oracleLevel = (name: RoleName): number => wave.oracleLevels[name] ?? 1
  const chainResult = evaluateChainBonus(params.scoring, wave.chain, card, effectiveStairMinLen, roleBonusMultiplier, effectiveSuitColorMinLen, oracleLevel)
```

`playCard`関数内、列一掃加点(346行目付近、現在の内容):

```ts
    const sweepGain = Math.floor(params.scoring.columnSweepBonus * newColumnsEmptied * roleBonusMultiplier('columnSweep'))
```

を以下に置き換える:

```ts
    const sweepGain = Math.floor(params.scoring.columnSweepBonus * oracleLevel('columnSweep') * newColumnsEmptied * roleBonusMultiplier('columnSweep'))
```

- [ ] **Step 4: `drawStock`の素朴(naive)分岐にも`oracleLevel`を組み込む**

`drawStock`関数内、誠実(naive)分岐(669-673行目付近、現在の内容):

```ts
    if (wouldContinue && items.includes('naive')) {
      const newCombo = wave.comboFrozenThisWave ? wave.combo : wave.combo + (items.includes('golden') ? 2 : 1)
      let base = params.scoring.basePoint
      const parts = [`基礎点+${base}`]
      const chainResult = evaluateChainBonus(params.scoring, wave.chain, drawnCard, effectiveStairMinLen, undefined, effectiveSuitColorMinLen)
```

を以下に置き換える:

```ts
    if (wouldContinue && items.includes('naive')) {
      const newCombo = wave.comboFrozenThisWave ? wave.combo : wave.combo + (items.includes('golden') ? 2 : 1)
      let base = params.scoring.basePoint
      const parts = [`基礎点+${base}`]
      // 神託: このパスは明星・ソウィロによる役倍率(roleBonusMultiplier)を通さない既存方針を維持しつつ、
      // 神託レベルは永続的な基礎点の一部として引き続き適用する
      const oracleLevel = (name: RoleName): number => wave.oracleLevels[name] ?? 1
      const chainResult = evaluateChainBonus(params.scoring, wave.chain, drawnCard, effectiveStairMinLen, undefined, effectiveSuitColorMinLen, oracleLevel)
```

- [ ] **Step 5: `createInitialRun`・`beginRun`に新フィールドを追加する**

`createInitialRun`関数(821-826行目、現在の内容):

```ts
export function createInitialRun(): RunState {
  return {
    phase: 'title', stageIndex: 0, waveIndex: 0, items: [], offer: [], wave: null, pendingNewItem: null,
    deckComposition: standardDeckComposition(), rites: [], revelations: [], revelationOffer: [], extraTableauRows: 0,
  }
}
```

を以下に置き換える:

```ts
export function createInitialRun(): RunState {
  return {
    phase: 'title', stageIndex: 0, waveIndex: 0, items: [], offer: [], wave: null, pendingNewItem: null,
    deckComposition: standardDeckComposition(), rites: [], revelations: [], revelationOffer: [], extraTableauRows: 0,
    oracleLevels: defaultOracleLevels(), oracleOffer: [],
  }
}
```

`beginRun`関数(828-844行目、現在の内容):

```ts
export function beginRun(params: ShidasuParams, seed?: number): RunState {
  const { wave, deckComposition } = startWave(params, 0, 0, [], standardDeckComposition(), seed, 0)
  return {
    phase: 'playing',
    stageIndex: 0,
    waveIndex: 0,
    items: [],
    offer: [],
    wave,
    pendingNewItem: null,
    deckComposition,
    rites: [],
    revelations: [],
    revelationOffer: [],
    extraTableauRows: 0,
  }
}
```

を以下に置き換える:

```ts
export function beginRun(params: ShidasuParams, seed?: number): RunState {
  const { wave, deckComposition } = startWave(params, 0, 0, [], standardDeckComposition(), seed, 0, defaultOracleLevels())
  return {
    phase: 'playing',
    stageIndex: 0,
    waveIndex: 0,
    items: [],
    offer: [],
    wave,
    pendingNewItem: null,
    deckComposition,
    rites: [],
    revelations: [],
    revelationOffer: [],
    extraTableauRows: 0,
    oracleLevels: defaultOracleLevels(),
    oracleOffer: [],
  }
}
```

- [ ] **Step 6: `enterRevelationSelect`・`advanceStage`の`startWave`呼び出しに`oracleLevels`を渡す**

`enterRevelationSelect`関数内の`startWave`呼び出し(889行目付近、現在の内容):

```ts
  const { wave, deckComposition } = startWave(params, run.stageIndex, newWaveIndex, newItems, run.deckComposition, seed, run.extraTableauRows)
```

を以下に置き換える:

```ts
  const { wave, deckComposition } = startWave(params, run.stageIndex, newWaveIndex, newItems, run.deckComposition, seed, run.extraTableauRows, run.oracleLevels)
```

`advanceStage`関数内の`startWave`呼び出し(1004行目付近、現在の内容):

```ts
  const { wave, deckComposition } = startWave(params, newStageIndex, 0, run.items, run.deckComposition, seed, run.extraTableauRows)
```

を以下に置き換える:

```ts
  const { wave, deckComposition } = startWave(params, newStageIndex, 0, run.items, run.deckComposition, seed, run.extraTableauRows, run.oracleLevels)
```

- [ ] **Step 7: `finishRevelationSelect`を`oracleSelect`フェーズへ遷移するよう変更する**

`finishRevelationSelect`関数(906-915行目、現在の内容):

```ts
function finishRevelationSelect(params: ShidasuParams, run: RunState, seed?: number): RunState {
  const { wave, deckComposition } = startWave(params, run.stageIndex, run.waveIndex, run.items, run.deckComposition, seed, run.extraTableauRows)
  return {
    ...run,
    phase: 'playing',
    wave,
    deckComposition,
    revelationOffer: [],
  }
}
```

を以下に置き換える(**シグネチャ末尾に`rand`引数を追加し、遷移先を`'oracleSelect'`に変更、天啓の実ウェーブ配布に`run.oracleLevels`を渡し、神託オファーをセットする**):

```ts
function finishRevelationSelect(params: ShidasuParams, run: RunState, seed?: number, rand: () => number = Math.random): RunState {
  const { wave, deckComposition } = startWave(params, run.stageIndex, run.waveIndex, run.items, run.deckComposition, seed, run.extraTableauRows, run.oracleLevels)
  return {
    ...run,
    phase: 'oracleSelect',
    wave,
    deckComposition,
    revelationOffer: [],
    oracleOffer: rollOracleOffer(rand),
  }
}
```

- [ ] **Step 8: `useRevelationFromOffer`・`pickRevelationFromOffer`・`skipRevelationSelect`から`rand`を渡すようにする**

`useRevelationFromOffer`関数(969-983行目、現在の内容):

```ts
export function useRevelationFromOffer(
  params: ShidasuParams,
  run: RunState,
  revelationId: RevelationId,
  targetCol: number | null,
  seed?: number,
  rand: () => number = Math.random
): RunState {
  if (run.phase !== 'revelationSelect' || !run.wave) return run
  if (!run.revelationOffer.includes(revelationId)) return run
  if (!canUseRevelation(params, run.wave, revelationId)) return run
  const { wave, deckComposition } = applyRevelationEffect(params, run.wave, run.deckComposition, revelationId, targetCol, rand)
  const extraTableauRows = revelationId === 'kyo' ? run.extraTableauRows + params.revelations.kyo.n : run.extraTableauRows
  return finishRevelationSelect(params, { ...run, deckComposition, extraTableauRows }, seed)
}
```

を以下に置き換える(末尾の`finishRevelationSelect`呼び出しに`rand`を追加):

```ts
export function useRevelationFromOffer(
  params: ShidasuParams,
  run: RunState,
  revelationId: RevelationId,
  targetCol: number | null,
  seed?: number,
  rand: () => number = Math.random
): RunState {
  if (run.phase !== 'revelationSelect' || !run.wave) return run
  if (!run.revelationOffer.includes(revelationId)) return run
  if (!canUseRevelation(params, run.wave, revelationId)) return run
  const { wave, deckComposition } = applyRevelationEffect(params, run.wave, run.deckComposition, revelationId, targetCol, rand)
  const extraTableauRows = revelationId === 'kyo' ? run.extraTableauRows + params.revelations.kyo.n : run.extraTableauRows
  return finishRevelationSelect(params, { ...run, deckComposition, extraTableauRows }, seed, rand)
}
```

`pickRevelationFromOffer`関数(987-993行目、現在の内容):

```ts
export function pickRevelationFromOffer(params: ShidasuParams, run: RunState, revelationId: RevelationId, seed?: number): RunState {
  if (run.phase !== 'revelationSelect') return run
  if (!run.revelationOffer.includes(revelationId)) return run
  if (run.revelations.length >= 2) return run
  const revelations = [...run.revelations, revelationId]
  return finishRevelationSelect(params, { ...run, revelations }, seed)
}
```

を以下に置き換える(**シグネチャ末尾に`rand`引数を追加する**):

```ts
export function pickRevelationFromOffer(params: ShidasuParams, run: RunState, revelationId: RevelationId, seed?: number, rand: () => number = Math.random): RunState {
  if (run.phase !== 'revelationSelect') return run
  if (!run.revelationOffer.includes(revelationId)) return run
  if (run.revelations.length >= 2) return run
  const revelations = [...run.revelations, revelationId]
  return finishRevelationSelect(params, { ...run, revelations }, seed, rand)
}
```

`skipRevelationSelect`関数(996-999行目、現在の内容):

```ts
export function skipRevelationSelect(params: ShidasuParams, run: RunState, seed?: number): RunState {
  if (run.phase !== 'revelationSelect') return run
  return finishRevelationSelect(params, run, seed)
}
```

を以下に置き換える(**シグネチャ末尾に`rand`引数を追加する**):

```ts
export function skipRevelationSelect(params: ShidasuParams, run: RunState, seed?: number, rand: () => number = Math.random): RunState {
  if (run.phase !== 'revelationSelect') return run
  return finishRevelationSelect(params, run, seed, rand)
}
```

- [ ] **Step 9: 神託選択画面用の新規関数を追加する**

`skipRevelationSelect`関数の直後(Step 8で変更した箇所のすぐ後)に追加:

```ts
// 神託選択画面のオファーから1つ選ぶと、対応する役のレベルが+1され、即座にplayingへ遷移する。
// 天啓と異なり所持・ウェーブ再配布の概念は無く、実ウェーブは変更しない。paramsに依存する処理が
// 無いため(useRevelationFromOffer等と異なりparamsを使う効果適用が無い)、引数に含めない。
export function pickOracleFromOffer(run: RunState, roleName: RoleName): RunState {
  if (run.phase !== 'oracleSelect') return run
  if (!run.oracleOffer.includes(roleName)) return run
  const oracleLevels = { ...run.oracleLevels, [roleName]: run.oracleLevels[roleName] + 1 }
  return { ...run, phase: 'playing', oracleLevels, oracleOffer: [] }
}

// 神託を選ばずに神託選択画面を終了する。
export function skipOracleSelect(run: RunState): RunState {
  if (run.phase !== 'oracleSelect') return run
  return { ...run, phase: 'playing', oracleOffer: [] }
}
```

- [ ] **Step 10: 既存テストのフェーズ遷移先を修正する**

`finishRevelationSelect`の遷移先が`'playing'`から`'oracleSelect'`に変わったことで、既存の`useRevelationFromOffer`/`pickRevelationFromOffer`/`skipRevelationSelect`関連テストのうち、遷移後のフェーズを`'playing'`とアサートしているものが失敗するようになる。`src/lib/game/shidasu/engine.test.ts`内で以下の文字列を検索し、該当する`describe('天啓選択フェーズ', ...)`ブロック内のテストを確認する:

```ts
  test('useRevelationFromOffer: 対象選択不要な天啓(心)を使用すると、実際のウェーブが配られplayingへ遷移する。所持には加わらない', () => {
    const run = beginRun(DEFAULT_PARAMS, 1)
    const revSelectRun: RunState = { ...run, phase: 'revelationSelect', revelationOffer: ['shin', 'kou', 'tei'] }
    const next = useRevelationFromOffer(DEFAULT_PARAMS, revSelectRun, 'shin', null, 3)
    expect(next.phase).toBe('playing')
    expect(next.revelations).toEqual([])
    expect(next.revelationOffer).toEqual([])
  })
```

を以下に置き換える:

```ts
  test('useRevelationFromOffer: 対象選択不要な天啓(心)を使用すると、実際のウェーブが配られoracleSelectへ遷移する。所持には加わらない', () => {
    const run = beginRun(DEFAULT_PARAMS, 1)
    const revSelectRun: RunState = { ...run, phase: 'revelationSelect', revelationOffer: ['shin', 'kou', 'tei'] }
    const next = useRevelationFromOffer(DEFAULT_PARAMS, revSelectRun, 'shin', null, 3)
    expect(next.phase).toBe('oracleSelect')
    expect(next.revelations).toEqual([])
    expect(next.revelationOffer).toEqual([])
  })
```

同様に、以下の3テストも`expect(next.phase).toBe('playing')`となっている箇所を`expect(next.phase).toBe('oracleSelect')`に変更する:

```ts
  test('pickRevelationFromOffer: オファーから獲得すると所持に加わり、revelationSelectを終了してplayingへ遷移する', () => {
    const run = beginRun(DEFAULT_PARAMS, 1)
    const revSelectRun: RunState = { ...run, phase: 'revelationSelect', revelationOffer: ['shin', 'kou', 'tei'] }
    const next = pickRevelationFromOffer(DEFAULT_PARAMS, revSelectRun, 'shin', 3)
    expect(next.phase).toBe('playing')
    expect(next.revelations).toEqual(['shin'])
  })
```

を以下に置き換える(テスト名・アサーション両方):

```ts
  test('pickRevelationFromOffer: オファーから獲得すると所持に加わり、revelationSelectを終了してoracleSelectへ遷移する', () => {
    const run = beginRun(DEFAULT_PARAMS, 1)
    const revSelectRun: RunState = { ...run, phase: 'revelationSelect', revelationOffer: ['shin', 'kou', 'tei'] }
    const next = pickRevelationFromOffer(DEFAULT_PARAMS, revSelectRun, 'shin', 3)
    expect(next.phase).toBe('oracleSelect')
    expect(next.revelations).toEqual(['shin'])
  })
```

```ts
  test('skipRevelationSelect: 何も選ばず終了すると、実際のウェーブが配られplayingへ遷移する', () => {
    const run = beginRun(DEFAULT_PARAMS, 1)
    const revSelectRun: RunState = { ...run, phase: 'revelationSelect', revelationOffer: ['shin', 'kou', 'tei'] }
    const next = skipRevelationSelect(DEFAULT_PARAMS, revSelectRun, 3)
    expect(next.phase).toBe('playing')
  })
```

を以下に置き換える:

```ts
  test('skipRevelationSelect: 何も選ばず終了すると、実際のウェーブが配られoracleSelectへ遷移する', () => {
    const run = beginRun(DEFAULT_PARAMS, 1)
    const revSelectRun: RunState = { ...run, phase: 'revelationSelect', revelationOffer: ['shin', 'kou', 'tei'] }
    const next = skipRevelationSelect(DEFAULT_PARAMS, revSelectRun, 3)
    expect(next.phase).toBe('oracleSelect')
  })
```

`describe('pickItem / advanceStage / restartRun', ...)`および`describe('護符所持上限・交換', ...)`ブロック内で、`pickItem`/`confirmItemSwap`/`skipItemSelect`解決後のフェーズを検証しているテストは、既に`'revelationSelect'`を期待する形になっている(前回のTask 3で修正済み)ため、今回**変更不要**である。これらは`enterRevelationSelect`の遷移先であり、`finishRevelationSelect`の遷移先変更とは無関係のため影響を受けない。

- [ ] **Step 11: 失敗するテストを書く(神託選択フェーズ)**

`src/lib/game/shidasu/engine.test.ts`の末尾に、新しい`describe`ブロックを追加する:

```ts
describe('神託選択フェーズ', () => {
  test('天啓選択画面を終了すると、oracleSelectフェーズへ遷移しoracleOfferが3件セットされる', () => {
    const run = beginRun(DEFAULT_PARAMS, 1)
    const revSelectRun: RunState = { ...run, phase: 'revelationSelect', revelationOffer: ['shin', 'kou', 'tei'] }
    const next = skipRevelationSelect(DEFAULT_PARAMS, revSelectRun, 3, createRng(1))
    expect(next.phase).toBe('oracleSelect')
    expect(next.oracleOffer).toHaveLength(3)
    expect(next.wave).not.toBeNull()
  })

  test('pickOracleFromOffer: オファーから選ぶと対応する役のレベルが+1され、即座にplayingへ遷移する', () => {
    const run = beginRun(DEFAULT_PARAMS, 1)
    const oracleSelectRun: RunState = { ...run, phase: 'oracleSelect', oracleOffer: ['suit', 'color', 'stair'] }
    const next = pickOracleFromOffer(oracleSelectRun, 'suit')
    expect(next.phase).toBe('playing')
    expect(next.oracleLevels.suit).toBe(2)
    expect(next.oracleLevels.color).toBe(1)
    expect(next.oracleOffer).toEqual([])
  })

  test('pickOracleFromOffer: オファーに含まれない役は無視される', () => {
    const run = beginRun(DEFAULT_PARAMS, 1)
    const oracleSelectRun: RunState = { ...run, phase: 'oracleSelect', oracleOffer: ['suit', 'color', 'stair'] }
    const next = pickOracleFromOffer(oracleSelectRun, 'flush')
    expect(next).toBe(oracleSelectRun)
  })

  test('pickOracleFromOffer: 同じ役を複数回選ぶとレベルが積み上がる', () => {
    const run = beginRun(DEFAULT_PARAMS, 1)
    const oracleSelectRun: RunState = { ...run, phase: 'oracleSelect', oracleOffer: ['suit', 'color', 'stair'], oracleLevels: { ...run.oracleLevels, suit: 3 } }
    const next = pickOracleFromOffer(oracleSelectRun, 'suit')
    expect(next.oracleLevels.suit).toBe(4)
  })

  test('skipOracleSelect: 何も選ばず終了すると、レベルを変えずplayingへ遷移する', () => {
    const run = beginRun(DEFAULT_PARAMS, 1)
    const oracleSelectRun: RunState = { ...run, phase: 'oracleSelect', oracleOffer: ['suit', 'color', 'stair'] }
    const next = skipOracleSelect(oracleSelectRun)
    expect(next.phase).toBe('playing')
    expect(next.oracleLevels).toEqual(run.oracleLevels)
  })

  test('神託のレベルは新しいウェーブに引き継がれ、得点計算に反映される', () => {
    const run = beginRun(DEFAULT_PARAMS, 1)
    const oracleSelectRun: RunState = { ...run, phase: 'oracleSelect', oracleOffer: ['suit', 'color', 'stair'] }
    const afterPick = pickOracleFromOffer(oracleSelectRun, 'suit')
    expect(afterPick.oracleLevels.suit).toBe(2)
    const { wave } = startWave(DEFAULT_PARAMS, 0, 1, afterPick.items, afterPick.deckComposition, 5, afterPick.extraTableauRows, afterPick.oracleLevels)
    expect(wave.oracleLevels.suit).toBe(2)
  })
})
```

- [ ] **Step 12: テストを実行し失敗を確認する**

Run: `npm run test -- engine`
Expected: FAIL(`pickOracleFromOffer`等が未定義、`oracleSelect`フェーズが未対応)

- [ ] **Step 13: テストを実行し成功を確認する**

Step 1〜10の実装後、再実行する。

Run: `npm run test -- engine`
Expected: PASS

- [ ] **Step 14: 型チェック・全体テストを実行する**

Run: `npm run check`
Run: `npm run test`
Expected: いずれもエラー無し・全件PASS(Task 1で許容していた型エラーもこの時点で解消していること)

- [ ] **Step 15: コミット**

```bash
git add src/lib/game/shidasu/engine.ts src/lib/game/shidasu/engine.test.ts
git commit -m "feat: 神託選択フェーズ(oracleSelect)と得点計算への組み込みをengine.tsに追加"
```

---

### Task 4: UI — `RoleStatusPanel.svelte`・神託選択画面

**Files:**
- Create: `src/routes/game/shidasu/RoleStatusPanel.svelte`
- Modify: `src/routes/game/shidasu/+page.svelte`

- [ ] **Step 1: `RoleStatusPanel.svelte`を新規作成する**

`src/routes/game/shidasu/RoleStatusPanel.svelte`を新規作成:

```svelte
<script lang="ts">
  import type { ShidasuParams } from '$lib/game/shidasu/params'
  import type { RoleName } from '$lib/game/shidasu/types'
  import { ROLE_LIST, roleBasePoint } from '$lib/game/shidasu/roles'

  let { params, oracleLevels }: {
    params: ShidasuParams
    oracleLevels: Record<RoleName, number>
  } = $props()
</script>

<div class="px-4 pb-4">
  <div class="bg-emerald-900/50 border border-emerald-800 rounded-lg p-3 space-y-1.5">
    <div class="text-xs font-bold text-emerald-300/70 tracking-widest mb-1">役ステータス</div>
    {#each ROLE_LIST as role (role.name)}
      {@const level = oracleLevels[role.name]}
      {@const score = roleBasePoint(params, role.name) * level}
      <div class="flex items-center justify-between text-xs gap-2">
        <div class="flex items-center gap-1.5 min-w-0">
          <span class="font-black text-amber-50 shrink-0">{role.label}</span>
          <span class="text-emerald-300/60 truncate">{role.desc}</span>
        </div>
        <div class="shrink-0 text-right">
          <span class="text-yellow-300 font-bold">Lv.{level}</span>
          <span class="text-emerald-100/80 ml-1">{score}点</span>
        </div>
      </div>
    {/each}
  </div>
</div>
```

- [ ] **Step 2: `+page.svelte`にimportを追加する**

`src/routes/game/shidasu/+page.svelte`のimport群(1-16行目、現在の内容):

```ts
  import { onDestroy } from 'svelte'
  import { loadParams } from '$lib/game/shidasu/params'
  import {
    createInitialRun, beginRun, applyPlayCard, applyDrawStock, applyStuckCheck,
    resolveWaveEnd, pickItem, confirmItemSwap, cancelItemSwap, skipItemSelect,
    advanceStage, restartRun, startWave, forceStockTop, useRite,
    useRevelation, useRevelationFromOffer, pickRevelationFromOffer, skipRevelationSelect,
  } from '$lib/game/shidasu/engine'
  import { itemDesc, itemName } from '$lib/game/shidasu/items'
  import { revelationDesc, revelationName } from '$lib/game/shidasu/revelations'
  import { revelationNeedsTarget } from '$lib/game/shidasu/revelationEffects'
  import { standardDeckComposition } from '$lib/game/shidasu/deck'
  import type { RunState, ItemId, StageModifier, Suit, Rank, RiteId, RevelationId } from '$lib/game/shidasu/types'
  import DebugPanel from './DebugPanel.svelte'
  import PlayArea from './PlayArea.svelte'
```

を以下に置き換える:

```ts
  import { onDestroy } from 'svelte'
  import { loadParams } from '$lib/game/shidasu/params'
  import {
    createInitialRun, beginRun, applyPlayCard, applyDrawStock, applyStuckCheck,
    resolveWaveEnd, pickItem, confirmItemSwap, cancelItemSwap, skipItemSelect,
    advanceStage, restartRun, startWave, forceStockTop, useRite,
    useRevelation, useRevelationFromOffer, pickRevelationFromOffer, skipRevelationSelect,
    pickOracleFromOffer, skipOracleSelect,
  } from '$lib/game/shidasu/engine'
  import { itemDesc, itemName } from '$lib/game/shidasu/items'
  import { revelationDesc, revelationName } from '$lib/game/shidasu/revelations'
  import { revelationNeedsTarget } from '$lib/game/shidasu/revelationEffects'
  import { oracleName, oracleDesc } from '$lib/game/shidasu/oracles'
  import { standardDeckComposition } from '$lib/game/shidasu/deck'
  import type { RunState, ItemId, StageModifier, Suit, Rank, RiteId, RevelationId, RoleName } from '$lib/game/shidasu/types'
  import DebugPanel from './DebugPanel.svelte'
  import PlayArea from './PlayArea.svelte'
  import RoleStatusPanel from './RoleStatusPanel.svelte'
```

- [ ] **Step 3: 神託選択用のハンドラを追加する**

`canTargetRevelationColumn`関数の直後(script末尾、182-186行目付近、現在の内容):

```ts
  function canTargetRevelationColumn(colIndex: number): boolean {
    if (!wave || !pendingRevelationTarget) return false
    if (pendingRevelationTarget.revelationId === 'aya') return true
    return wave.tableau[colIndex].length > 0
  }
```

の直後に追加:

```ts

  function handlePickOracle(roleName: RoleName) {
    run = pickOracleFromOffer(run, roleName)
    afterAction()
  }

  function handleSkipOracleSelect() {
    run = skipOracleSelect(run)
    afterAction()
  }
```

- [ ] **Step 4: `PlayArea`の下に役ステータスを常時表示する**

既存の描画箇所(通常プレイ分岐、298-309行目付近、現在の内容):

```svelte
{:else if wave}
  <PlayArea {wave} {params} modifier={stage.modifier} {target} items={run.items} onPlayCard={handlePlayCard} onDraw={handleDraw} headerExtra={stageRow} extraFooter={itemBadges} rites={run.rites} onUseRite={handleUseRite} revelations={run.revelations} onUseRevelationClick={handleUseRevelationClick} columnTargetMode={pendingRevelationTarget !== null} canTargetColumn={canTargetRevelationColumn} onTargetColumn={handleTargetColumn} chainAreaExtra={pendingRevelationTarget ? revelationTargetPrompt : undefined} />
{/if}
```

を以下に置き換える(`<PlayArea>`呼び出しは無変更、直後に`<RoleStatusPanel>`を追加):

```svelte
{:else if wave}
  <PlayArea {wave} {params} modifier={stage.modifier} {target} items={run.items} onPlayCard={handlePlayCard} onDraw={handleDraw} headerExtra={stageRow} extraFooter={itemBadges} rites={run.rites} onUseRite={handleUseRite} revelations={run.revelations} onUseRevelationClick={handleUseRevelationClick} columnTargetMode={pendingRevelationTarget !== null} canTargetColumn={canTargetRevelationColumn} onTargetColumn={handleTargetColumn} chainAreaExtra={pendingRevelationTarget ? revelationTargetPrompt : undefined} />
  <RoleStatusPanel {params} oracleLevels={run.oracleLevels} />
{/if}
```

**注意:** `+page.svelte`の該当箇所は前回セッションのTask 5修正(`e91a274`)により1行に連結された形になっている可能性がある。実際のファイルを読み、`{:else if wave}`で始まり`<PlayArea .../>`を描画している(`revelationSelect`分岐ではない方の)ブロックを特定し、その`<PlayArea .../>`タグの直後に`<RoleStatusPanel {params} oracleLevels={run.oracleLevels} />`を1行追加すること。`{:else if wave && run.phase === 'revelationSelect'}`分岐(取得画面用)には追加しない。

- [ ] **Step 5: 神託選択画面のモーダルを追加する**

`{#if run.phase === 'itemSelect'} ... {:else if run.phase === 'stageClear'}`のif-chain(312行目付近から始まる、現在の内容の一部):

```svelte
{#if run.phase === 'itemSelect'}
  <div class="fixed inset-0 z-50 bg-emerald-950/90 backdrop-blur-sm flex items-center justify-center p-6">
    ...(護符選択画面、既存のまま)...
  </div>
{:else if run.phase === 'stageClear'}
```

の`{:else if run.phase === 'stageClear'}`の直前に、新しい`{:else if run.phase === 'oracleSelect'}`ブロックを挿入する:

```svelte
{:else if run.phase === 'oracleSelect'}
  <div class="fixed inset-0 z-50 bg-emerald-950/90 backdrop-blur-sm flex items-center justify-center p-6">
    <div class="w-full max-w-sm flex flex-col items-center text-center">
      <div class="text-yellow-300 text-xs tracking-widest mb-1">ORACLE</div>
      <div class="text-emerald-100/70 text-sm mb-4">神託を1つ選ぶ</div>
      <div class="flex flex-col gap-3 w-full">
        {#each run.oracleOffer as roleName (roleName)}
          <button
            onclick={() => handlePickOracle(roleName)}
            class="text-left bg-emerald-900/80 border border-yellow-500/40 rounded-xl px-4 py-3 active:scale-[0.98] transition-transform"
          >
            <div class="font-black text-yellow-300">{oracleName(roleName, params)}</div>
            <div class="text-xs text-emerald-100/80 mt-0.5">{oracleDesc(roleName, params)}</div>
          </button>
        {/each}
        <button
          onclick={handleSkipOracleSelect}
          class="text-center text-emerald-200/70 border border-emerald-700/60 rounded-xl px-4 py-2 active:scale-[0.98] transition-transform"
        >
          選ばない
        </button>
      </div>
    </div>
  </div>
{:else if run.phase === 'stageClear'}
```

**注意:** `{:else if run.phase === 'stageClear'}`という行自体は元からある行であり、削除・重複させず、その直前に上記ブロック(`{:else if run.phase === 'oracleSelect'} ... </div>`まで)を挿入するだけでよい。

- [ ] **Step 6: 型チェックを実行する**

Run: `npm run check`
Expected: `+page.svelte`・`RoleStatusPanel.svelte`にエラーが無いこと

- [ ] **Step 7: コミット**

```bash
git add src/routes/game/shidasu/RoleStatusPanel.svelte src/routes/game/shidasu/+page.svelte
git commit -m "feat: 神託選択画面と役ステータス常時表示エリアを追加"
```

---

### Task 5: 管理画面 `/admin/shidasu-oracles`

**Files:**
- Create: `src/routes/admin/shidasu-oracles/+page.svelte`
- Modify: `src/routes/admin/+page.svelte`

- [ ] **Step 1: 管理画面を新規作成する**

`src/routes/admin/shidasu-oracles/+page.svelte`を新規作成:

```svelte
<script lang="ts">
  import { onMount, onDestroy } from 'svelte'
  import { DEFAULT_PARAMS, type ShidasuParams } from '$lib/game/shidasu/params'
  import { oracleDesc, ORACLE_POOL } from '$lib/game/shidasu/oracles'
  import { TRIGRAMS } from '$lib/game/shidasu/trigrams'
  import type { RoleName } from '$lib/game/shidasu/types'

  let config = $state<ShidasuParams | null>(null)
  let error = $state<string | null>(null)
  let flash = $state<string | null>(null)
  let flashTimer: ReturnType<typeof setTimeout> | null = null

  function showToast(message: string) {
    if (flashTimer) clearTimeout(flashTimer)
    flash = message
    flashTimer = setTimeout(() => { flash = null }, 2000)
  }

  type OracleEntry = { name: string; desc: string } & Record<string, number | string>

  function oracleEntry(roleName: RoleName): OracleEntry {
    return config!.oracles[roleName] as unknown as OracleEntry
  }

  function oracleParamKeys(roleName: RoleName): string[] {
    return Object.keys(oracleEntry(roleName)).filter(key => key !== 'name' && key !== 'desc')
  }

  let hasValidationError = $derived.by(() => {
    if (!config) return false
    return ORACLE_POOL.some(roleName => {
      const entry = oracleEntry(roleName)
      if (!entry.name.trim()) return true
      if (!entry.desc.trim()) return true
      return oracleParamKeys(roleName).some(key => !Number.isFinite(entry[key] as number))
    })
  })

  async function loadConfig(toast = false) {
    try {
      const res = await fetch('/api/admin/shidasu-config')
      if (!res.ok) throw new Error(`HTTP ${res.status}`)
      config = await res.json() as ShidasuParams
      error = null
      if (toast) showToast('リロードしました')
    } catch {
      error = 'Shidasu設定APIに接続できません。npm run dev で起動してください。'
      if (!config) config = JSON.parse(JSON.stringify(DEFAULT_PARAMS))
    }
  }

  async function save() {
    if (!config) return
    try {
      const res = await fetch('/api/admin/shidasu-config', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(config),
      })
      if (!res.ok) throw new Error(`HTTP ${res.status}`)
      showToast('保存しました(反映には再ビルド・再デプロイが必要です)')
    } catch {
      error = '保存に失敗しました'
    }
  }

  onMount(() => loadConfig())
  onDestroy(() => {
    if (flashTimer) clearTimeout(flashTimer)
  })
</script>

<svelte:head>
  <title>Shidasu 神託パラメータ設定</title>
</svelte:head>

<div class="max-w-5xl mx-auto px-4 py-8">
  <a href="/admin" class="text-xs text-slate-400 hover:text-teal-600 mb-4 inline-block">← 管理ページ一覧</a>

  <div class="flex items-center justify-between mb-6">
    <h1 class="text-2xl font-bold text-slate-800">星詠みソリティア -Shidasu- 神託パラメータ設定</h1>
    <div class="flex gap-2">
      <button onclick={() => loadConfig(true)} class="text-sm px-3 py-1.5 rounded-lg border border-slate-200 text-slate-600 hover:bg-slate-50 transition-colors">
        リロード
      </button>
      {#if hasValidationError}
        <p class="text-xs text-red-600 self-center">神託名・説明文テンプレートが空、またはパラメータが未入力の項目があります</p>
      {/if}
      <button
        onclick={save}
        disabled={hasValidationError || !config}
        class="text-sm px-3 py-1.5 rounded-lg bg-teal-600 text-white hover:bg-teal-700 transition-colors disabled:opacity-40 disabled:cursor-not-allowed"
      >
        保存
      </button>
    </div>
  </div>

  {#if error}
    <div class="bg-red-50 border border-red-200 text-red-700 px-4 py-3 rounded-lg mb-4 text-sm">{error}</div>
  {/if}

  {#if config}
    <section class="bg-white border border-slate-200 rounded-xl p-4">
      <div class="overflow-x-auto">
        <table class="w-full text-xs border border-slate-200 rounded-lg overflow-hidden">
          <thead>
            <tr class="bg-slate-50 text-slate-500">
              <th class="px-2 py-1.5 text-left" style="width:9rem;">名前</th>
              <th class="px-2 py-1.5 text-left" style="width:11rem;">パラメータ</th>
              <th class="px-2 py-1.5 text-left" style="width:20rem;">説明文テンプレート</th>
              <th class="px-2 py-1.5 text-left" style="width:20rem;">プレビュー</th>
            </tr>
          </thead>
          <tbody class="divide-y divide-slate-100">
            {#each ORACLE_POOL as roleName (roleName)}
              {@const entry = oracleEntry(roleName)}
              <tr>
                <td class="px-2 py-1.5 align-top">
                  <select bind:value={entry.name} class="w-full border border-slate-200 rounded px-1.5 py-0.5">
                    {#each TRIGRAMS as trigram (trigram.kanji)}
                      <option value={trigram.kanji}>{trigram.kanji} {trigram.reading}</option>
                    {/each}
                  </select>
                </td>
                <td class="px-2 py-1.5 align-top">
                  <div class="flex flex-wrap gap-1.5">
                    {#each oracleParamKeys(roleName) as key (key)}
                      <label class="flex items-center gap-1 text-[11px] text-slate-500">
                        {key}
                        <input type="number" step="any" bind:value={entry[key]} class="w-16 border border-slate-200 rounded px-1 py-0.5" />
                      </label>
                    {/each}
                    {#if oracleParamKeys(roleName).length === 0}
                      <span class="text-slate-300">-</span>
                    {/if}
                  </div>
                </td>
                <td class="px-2 py-1.5 align-top">
                  <textarea
                    bind:value={entry.desc}
                    rows="3"
                    class="w-full border border-slate-200 rounded px-1.5 py-0.5 font-mono text-[11px] resize-y"
                  ></textarea>
                </td>
                <td class="px-2 py-1.5 align-top text-slate-500">{oracleDesc(roleName, config)}</td>
              </tr>
            {/each}
          </tbody>
        </table>
      </div>
    </section>
  {:else if !error}
    <p class="text-slate-500 text-sm">読み込み中...</p>
  {/if}
</div>

{#if flash}
  <div class="fixed bottom-6 right-6 bg-slate-800 text-white text-sm px-4 py-2.5 rounded-lg shadow-lg z-50">
    {flash}
  </div>
{/if}
```

- [ ] **Step 2: 管理ページ一覧にリンクを追加する**

`src/routes/admin/+page.svelte`の天啓パラメータ設定リンクの直後(51-57行目付近、既存の`<a href="/admin/shidasu-revelations">...</a>`ブロックの直後)に追加:

```svelte
    <a href="/admin/shidasu-oracles" class="flex items-center gap-3 px-4 py-4 hover:bg-slate-50 transition-colors group">
      <div class="flex-1">
        <p class="text-sm font-semibold text-slate-700 group-hover:text-teal-700">星詠みソリティア -Shidasu- 神託パラメータ設定</p>
        <p class="text-xs text-slate-400 mt-0.5">神託ごとの名前(八卦)・説明文テンプレート・プレビューを1行ずつ編集</p>
      </div>
      <span class="text-slate-300 group-hover:text-teal-600 transition-colors">→</span>
    </a>
```

- [ ] **Step 3: 型チェック・ビルドを実行する**

Run: `npm run check`
Run: `npm run build`
Expected: いずれも成功

- [ ] **Step 4: コミット**

```bash
git add src/routes/admin/shidasu-oracles/+page.svelte src/routes/admin/+page.svelte
git commit -m "feat: 神託パラメータ設定画面(/admin/shidasu-oracles)を追加"
```

---

### Task 6: 最終確認・ブラウザ動作確認

**Files:** (テスト・動作確認のみ、コード変更なし)

- [ ] **Step 1: 全体テスト・型チェック・ビルドを実行する**

Run: `npm run test`
Expected: 全件PASS

Run: `npm run check`
Expected: shidasu関連ファイルにエラー無し

Run: `npm run build`
Expected: 成功

- [ ] **Step 2: `npm run dev`でブラウザ動作確認する**

`npm run dev`で開発サーバーを起動し、`/game/shidasu`を開いて以下を確認する:

1. ゲームを開始し、1ウェーブ目をクリアする
2. 護符選択→天啓選択の後、神託選択画面(ORACLE)に遷移することを確認する
3. 3択のいずれかを選ぶと、画面が閉じて次のウェーブが始まることを確認する
4. 通常のプレイ画面で、プレイエリアの下に「役ステータス」エリアが表示され、8役全ての現在レベル・現在の得点・説明が表示されていることを確認する
5. 手順3で選んだ神託に対応する役のレベルが2になっており、得点欄が基礎点の2倍になっていることを確認する(例: 坎(同スート)を選んだ場合、レベル2・200点と表示される)
6. 実際にその役を成立させるプレイを行い(例: 同スートなら同じスートを3枚以上連続で取る)、通常より高い得点が加算されることを確認する
7. 次のウェーブクリアで「選ばない」を選ぶと、レベルが変わらないまま次のウェーブに進むことを確認する
8. コンソールエラーが出ていないことを確認する

- [ ] **Step 3: `/admin/shidasu-oracles`の動作確認**

`/admin/shidasu-oracles`を開き、8件の神託が表示され、名前の`<select>`が8卦から選べること、説明文編集・プレビューが機能することを確認する。

- [ ] **Step 4: 問題があれば修正し、再度Step 1〜3を実行する**

- [ ] **Step 5: 最終コミット(修正があった場合のみ)**

```bash
git add -A
git commit -m "fix: 神託機能のブラウザ動作確認で見つかった問題を修正"
```
