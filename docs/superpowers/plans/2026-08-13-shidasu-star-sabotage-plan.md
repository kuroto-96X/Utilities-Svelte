# 星の妨害行動 実装プラン

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** waveSlot3の星に、一定ターンごとに能動的にゲーム状態を崩す「妨害行動」の仕組み全体を実装し、11個の妨害行動(山札・場札・チェーン・コンボ・護符・秘儀・天啓神託・レリック・捨て札・資産・役ステータスの各1個)を先行実装する。

**Architecture:** `WaveState`に次に発動する妨害のID・残りターン数・封印状態を持たせ、`playCard`/`drawStock`(純粋関数)でターンカウントダウンのみ行い、`applyPlayCard`/`applyDrawStock`(RunState層)で実際の効果適用(`triggerSabotage`)を行う。既存の天啓Phase B(即時報酬獲得系)と同じ「WaveState層は素通し、RunState層が実処理」というパターンを踏襲する。

**Tech Stack:** SvelteKit, TypeScript, Vitest

**設計書:** `docs/superpowers/specs/2026-08-13-shidasu-star-sabotage-design.md`

---

## 全体の前提知識

- `src/lib/game/shidasu/types.ts`: 型定義。`Star.sabotage`は現状`null`固定。
- `src/lib/game/shidasu/engine.ts`: ゲームロジック本体。`playCard`/`drawStock`はWaveState層の純粋関数、`applyPlayCard`/`applyDrawStock`はRunState層のラッパー。
- `src/lib/game/shidasu/params.ts`: `ShidasuParams`型と`DEFAULT_PARAMS`(テスト・admin用フォールバック値)。
- `src/lib/game/shidasu/shidasu.config.json`: 実行時に読み込まれる実際の設定値(starsの実データはこちらが正)。
- 「山札の上」= 配列の**末尾**(`wave.stock.pop()`で1枚引く実装のため)。
- テストは`src/lib/game/shidasu/engine.test.ts`に追記していく。既存テストは`createInitialRun()`ヘルパーや`startWave(DEFAULT_PARAMS, 0, 0, [], standardDeckComposition(), seed, ...)`の形で書かれている。

---

### Task 1: 型定義の追加(SabotageActionId・StarSabotage・WaveStateフィールド・Star.sabotage型変更)

**Files:**
- Modify: `src/lib/game/shidasu/types.ts`
- Modify: `src/lib/game/shidasu/engine.ts:929,941`(`sabotage: null`を更新)、`startWave`の`wave`オブジェクトリテラル(170行目付近)
- Modify: `src/lib/game/shidasu/engine.test.ts`(`sabotage: null`を全て更新、`makeWave`ヘルパー)
- Modify: `src/lib/game/shidasu/riteEffects.test.ts`(`baseWave`ヘルパー)
- Modify: `src/lib/game/shidasu/revelationEffects.test.ts`(`baseWave`ヘルパー)

- [ ] **Step 1: types.tsに型を追加する**

`src/lib/game/shidasu/types.ts`の`export type StageModifier = ...`の直後(5行目の後)に追加:

```ts
// 妨害行動の識別子。11個実装済み(各操作対象1個ずつ)。
// 詳細はdocs/shidasu/shidasu-star-sabotage-candidates.mdを参照。
export type SabotageActionId =
  | 'stockPurge' | 'columnReturn' | 'chainSettle' | 'comboBreather'
  | 'talismanSeal' | 'riteSeal' | 'revelationOracleSeal' | 'relicConfiscate'
  | 'tableauCardToDiscard' | 'currencyConfiscate' | 'roleSeal'

// Star.sabotageの型。noneが既存デフォルト、allはSABOTAGE_POOL全件が対象
// (将来候補が増えても自動的に対象へ加わる)、someは個別指定(将来の拡張用、現状未使用)。
export type StarSabotage =
  | { kind: 'none' }
  | { kind: 'all' }
  | { kind: 'some'; ids: SabotageActionId[] }
```

`Star`インターフェース内の`sabotage: null`を次のように変更する(既存の`export interface Star { ... }`定義内、23〜35行目付近):

```ts
export interface Star {
  id: string
  name: string
  waveSlot: 1 | 2 | 3
  targetMultiplier: number
  reward: number
  restriction: StarRestriction
  sabotage: StarSabotage
  descTemplate: string
}
```

- [ ] **Step 2: WaveStateに妨害行動用フィールドを追加する**

`export interface WaveState { ... }`定義の末尾(`oracleLevels: Record<RoleName, number>`の直後、266行目付近)に追加:

```ts
  // 妨害行動用: 次に発動する妨害の種別(星がsabotage: {kind:'none'}、または候補0件ならnull)
  pendingSabotageId: SabotageActionId | null
  // 妨害行動用: 発動までの残りターン数(pendingSabotageIdがnullの間は0のまま)
  sabotageTurnsRemaining: number
  // 妨害行動「封印系」用: 現在封印中の対象(無ければnull)。triggerSabotageが新しい妨害を
  // 発動させる直前に必ずnullへリセットしてから、今回の効果がseal系ならここに設定し直す。
  // 妨害の発動サイクルは常に1つしか同時に走らないため、封印状態も常に最大1件しか存在しない。
  activeSeal:
    | { kind: 'talisman'; id: ItemId }
    | { kind: 'rite'; id: RiteId }
    | { kind: 'revelationOrOracle'; ref: HeldRevelationOrOracleRef }
    | { kind: 'role'; names: RoleName[] }
    | null
```

- [ ] **Step 3: 既存の`sabotage: null`を全て更新する**

`src/lib/game/shidasu/engine.ts`の2箇所(929行目・941行目)で`sabotage: null`を`sabotage: { kind: 'none' }`に置き換える。

`src/lib/game/shidasu/engine.test.ts`内の`sabotage: null`(2498, 2499, 2500, 2618, 2695, 2703, 2716, 2729, 2752行目、計9箇所)を全て`sabotage: { kind: 'none' }`に置き換える(`replace_all`で一括置換してよい)。

- [ ] **Step 4: WaveStateを直接リテラルで組み立てている箇所に新規フィールドを追加する**

`src/lib/game/shidasu/engine.ts`の`startWave`関数内、`const wave: WaveState = { ... }`オブジェクトリテラル(170〜264行目付近)の末尾、`oracleLevels,`の直後に追加:

```ts
    oracleLevels,
    pendingSabotageId: null,
    sabotageTurnsRemaining: 0,
    activeSeal: null,
  }
```

(この時点では固定値で埋めるだけでよい。Task 4で`pendingSabotageId`・`sabotageTurnsRemaining`を実際の抽選結果に差し替える。)

`src/lib/game/shidasu/engine.test.ts`の`makeWave`関数(99〜155行目)内、`oracleLevels: defaultOracleLevels(),`の直後に追加:

```ts
    oracleLevels: defaultOracleLevels(),
    pendingSabotageId: null,
    sabotageTurnsRemaining: 0,
    activeSeal: null,
    ...overrides,
  }
}
```

`src/lib/game/shidasu/riteEffects.test.ts`の`baseWave`関数(12〜68行目)内、`oracleLevels: defaultOracleLevels(),`の直後に同様に追加:

```ts
    oracleLevels: defaultOracleLevels(),
    pendingSabotageId: null,
    sabotageTurnsRemaining: 0,
    activeSeal: null,
    ...overrides,
  }
}
```

`src/lib/game/shidasu/revelationEffects.test.ts`の`baseWave`関数(同様の形)にも同じ3行を`oracleLevels: defaultOracleLevels(),`の直後に追加する。

- [ ] **Step 5: ビルド・型チェックが通ることを確認する**

Run: `npm run check`
Expected: エラー無し

Run: `npx vitest run`
Expected: 全てPASS(既存テストの挙動は変えていないため)

- [ ] **Step 6: コミット**

```bash
git add src/lib/game/shidasu/types.ts src/lib/game/shidasu/engine.ts src/lib/game/shidasu/engine.test.ts src/lib/game/shidasu/riteEffects.test.ts src/lib/game/shidasu/revelationEffects.test.ts
git commit -m "feat: 星の妨害行動用の型定義を追加"
```

---

### Task 2: sabotage.ts新規作成(SABOTAGE_POOL・抽選ロジック)

**Files:**
- Create: `src/lib/game/shidasu/sabotage.ts`
- Test: `src/lib/game/shidasu/sabotage.test.ts`

- [ ] **Step 1: 失敗するテストを書く**

`src/lib/game/shidasu/sabotage.test.ts`を新規作成:

```ts
import { describe, it, expect } from 'vitest'
import { SABOTAGE_POOL, eligibleSabotageIds, rollSabotage } from './sabotage'

describe('SABOTAGE_POOL', () => {
  it('11件・ID重複無し・intervalTurnsが全て正の整数', () => {
    expect(SABOTAGE_POOL).toHaveLength(11)
    const ids = SABOTAGE_POOL.map(a => a.id)
    expect(new Set(ids).size).toBe(11)
    for (const action of SABOTAGE_POOL) {
      expect(Number.isInteger(action.intervalTurns)).toBe(true)
      expect(action.intervalTurns).toBeGreaterThan(0)
    }
  })
})

describe('eligibleSabotageIds', () => {
  it('noneは空配列', () => {
    expect(eligibleSabotageIds({ kind: 'none' })).toEqual([])
  })
  it('allはSABOTAGE_POOL全件のID', () => {
    expect(eligibleSabotageIds({ kind: 'all' })).toEqual(SABOTAGE_POOL.map(a => a.id))
  })
  it('someは指定したIDのみ', () => {
    expect(eligibleSabotageIds({ kind: 'some', ids: ['stockPurge', 'comboBreather'] })).toEqual(['stockPurge', 'comboBreather'])
  })
})

describe('rollSabotage', () => {
  it('noneはpendingSabotageId: null, sabotageTurnsRemaining: 0', () => {
    const result = rollSabotage({ kind: 'none' }, () => 0)
    expect(result).toEqual({ pendingSabotageId: null, sabotageTurnsRemaining: 0 })
  })
  it('allは候補の中から1つ選び、対応するintervalTurnsを設定する', () => {
    const result = rollSabotage({ kind: 'all' }, () => 0)
    const expectedId = SABOTAGE_POOL[0].id
    expect(result.pendingSabotageId).toBe(expectedId)
    expect(result.sabotageTurnsRemaining).toBe(SABOTAGE_POOL[0].intervalTurns)
  })
})
```

- [ ] **Step 2: テストを実行し失敗を確認する**

Run: `npx vitest run src/lib/game/shidasu/sabotage.test.ts`
Expected: FAIL(`./sabotage`モジュールが存在しない)

- [ ] **Step 3: sabotage.tsを実装する**

`src/lib/game/shidasu/sabotage.ts`を新規作成:

```ts
// src/lib/game/shidasu/sabotage.ts
import type { SabotageActionId, StarSabotage } from './types'

export interface SabotageActionDef {
  id: SabotageActionId
  name: string
  target: string
  intervalTurns: number
  descTemplate: string
}

// 妨害行動プール。11件(各操作対象1個ずつ)。詳細はdocs/shidasu/shidasu-star-sabotage-candidates.mdを参照。
// intervalTurnsは初期値の目安(効果が強い・永続的なものほど長め)。数値調整はこの配列を直接編集する。
export const SABOTAGE_POOL: SabotageActionDef[] = [
  { id: 'stockPurge', name: '大量放出', target: '山札', intervalTurns: 6, descTemplate: '山札の上から5枚を捨て札に置く' },
  { id: 'columnReturn', name: '一列戻し', target: '場札', intervalTurns: 6, descTemplate: 'ランダムな1列を山札に戻し、シャッフル後同じ列に裏向きで再配布する' },
  { id: 'chainSettle', name: '強制清算', target: 'チェーン', intervalTurns: 8, descTemplate: 'チェーンを全て捨て札に送り、山札から1枚めくって新しいチェーンにする。コンボも0にする' },
  { id: 'comboBreather', name: '強制小休止', target: 'コンボ', intervalTurns: 5, descTemplate: 'チェーンはそのまま、コンボ数だけ0にする' },
  { id: 'talismanSeal', name: '護符封印', target: '護符', intervalTurns: 5, descTemplate: '所持護符を1つ選び、次の妨害発動まで効果を無効化する' },
  { id: 'riteSeal', name: '秘儀封印', target: '秘儀', intervalTurns: 5, descTemplate: '所持秘儀を1つ選び、次の妨害発動まで使用を禁止する' },
  { id: 'revelationOracleSeal', name: '天啓・神託封印', target: '天啓・神託', intervalTurns: 5, descTemplate: '天啓または神託を1つ選び、次の妨害発動まで使用禁止にする' },
  { id: 'relicConfiscate', name: 'レリック没収', target: 'レリック', intervalTurns: 7, descTemplate: '所持レリックを1つ選び、完全に失わせる' },
  { id: 'tableauCardToDiscard', name: '一枚没収', target: '捨て札', intervalTurns: 4, descTemplate: '場札からランダムに1枚選び捨て札に送る' },
  { id: 'currencyConfiscate', name: '通貨没収', target: '資産(星片)', intervalTurns: 6, descTemplate: '所持する星片を5減らす' },
  { id: 'roleSeal', name: '役封印', target: '役ステータス', intervalTurns: 6, descTemplate: 'ランダムな2役を選び、次の妨害発動までそれらのボーナスを無効化する' },
]

export function eligibleSabotageIds(sabotage: StarSabotage): SabotageActionId[] {
  switch (sabotage.kind) {
    case 'none': return []
    case 'all': return SABOTAGE_POOL.map(a => a.id)
    case 'some': return sabotage.ids
  }
}

export function rollSabotage(sabotage: StarSabotage, rand: () => number): { pendingSabotageId: SabotageActionId | null; sabotageTurnsRemaining: number } {
  const ids = eligibleSabotageIds(sabotage)
  if (ids.length === 0) return { pendingSabotageId: null, sabotageTurnsRemaining: 0 }
  const id = ids[Math.floor(rand() * ids.length)]
  const def = SABOTAGE_POOL.find(a => a.id === id)!
  return { pendingSabotageId: id, sabotageTurnsRemaining: def.intervalTurns }
}
```

- [ ] **Step 4: テストを実行しパスすることを確認する**

Run: `npx vitest run src/lib/game/shidasu/sabotage.test.ts`
Expected: PASS(5 tests)

- [ ] **Step 5: コミット**

```bash
git add src/lib/game/shidasu/sabotage.ts src/lib/game/shidasu/sabotage.test.ts
git commit -m "feat: 妨害行動プール(SABOTAGE_POOL)と抽選ロジックを追加"
```

---

### Task 3: 星データにsabotageKindを追加し、既存6種をall対象にする

**Files:**
- Modify: `src/lib/game/shidasu/params.ts`
- Modify: `src/lib/game/shidasu/shidasu.config.json`
- Modify: `src/lib/game/shidasu/engine.ts`(`rollStarForSlot`・`toStarRestriction`周辺)
- Test: `src/lib/game/shidasu/engine.test.ts`

- [ ] **Step 1: 失敗するテストを書く**

`src/lib/game/shidasu/engine.test.ts`の末尾に追記:

```ts
describe('星のsabotage割り当て', () => {
  it('waveSlot3の星は全てsabotage: {kind: "all"}を持つ', () => {
    const stars = DEFAULT_PARAMS.stars.filter(s => s.waveSlot === 3)
    expect(stars.length).toBeGreaterThan(0)
    for (const entry of stars) {
      expect(entry.sabotageKind).toBe('all')
    }
  })
  it('waveSlot1・2の星はsabotage: {kind: "none"}を持つ', () => {
    const stars = DEFAULT_PARAMS.stars.filter(s => s.waveSlot !== 3)
    expect(stars.length).toBeGreaterThan(0)
    for (const entry of stars) {
      expect(entry.sabotageKind).toBe('none')
    }
  })
})
```

- [ ] **Step 2: テストを実行し失敗を確認する**

Run: `npx vitest run src/lib/game/shidasu/engine.test.ts -t "星のsabotage割り当て"`
Expected: FAIL(`sabotageKind`プロパティが`DEFAULT_PARAMS.stars`のエントリに存在しない)

- [ ] **Step 3: ShidasuParamsの型にsabotageKindを追加する**

`src/lib/game/shidasu/params.ts`の`stars: { ... }[]`定義(30〜44行目付近)を変更:

```ts
  stars: {
    id: string
    name: string
    waveSlot: 1 | 2 | 3
    targetMultiplier: number
    reward: number
    restrictionKind: 'none' | 'noLoop' | 'faceLock' | 'lowCombo' | 'oddCombo' | 'suit' | 'face'
    maxCombo?: number
    descTemplate: string
    // 妨害行動の割り当て種別。noneは妨害無し、allはSABOTAGE_POOL全件が対象になる。
    // 現状'some'相当の個別指定はサポートしない(将来拡張用にengine.ts側の型は対応済み)。
    sabotageKind: 'none' | 'all'
  }[]
```

- [ ] **Step 4: DEFAULT_PARAMS.starsにsabotageKindを追加する**

`src/lib/game/shidasu/params.ts`の`stars: [ ... ]`配列(295〜304行目付近)を変更:

```ts
  stars: [
    { id: 'ordinary-moon', name: '普通の衛星', waveSlot: 1, targetMultiplier: 1, reward: 3, restrictionKind: 'none', descTemplate: '', sabotageKind: 'none' },
    { id: 'slightly-bigger-moon', name: '少し大きな衛星', waveSlot: 2, targetMultiplier: 1.5, reward: 4, restrictionKind: 'none', descTemplate: '', sabotageKind: 'none' },
    { id: 'closed-loop-planet', name: '循環の閉じた荒廃惑星', waveSlot: 3, targetMultiplier: 2, reward: 5, restrictionKind: 'noLoop', descTemplate: 'A⇔Kループ禁止', sabotageKind: 'all' },
    { id: 'sealed-noble-planet', name: '高貴なる封印の惑星', waveSlot: 3, targetMultiplier: 2, reward: 5, restrictionKind: 'faceLock', descTemplate: '絵札はコンボ2以上でのみ取得可', sabotageKind: 'all' },
    { id: 'harsh-planet', name: '弱き者を拒む峻厳な惑星', waveSlot: 3, targetMultiplier: 2, reward: 5, restrictionKind: 'lowCombo', maxCombo: 2, descTemplate: '{maxCombo}コンボ以下で無得点', sabotageKind: 'all' },
    { id: 'twisted-odd-planet', name: '奇数を忌む歪んだ惑星', waveSlot: 3, targetMultiplier: 2, reward: 5, restrictionKind: 'oddCombo', descTemplate: 'コンボが奇数のとき無得点', sabotageKind: 'all' },
    { id: 'exiling-color-planet', name: '排斥の色殺す惑星', waveSlot: 3, targetMultiplier: 2, reward: 5, restrictionKind: 'suit', descTemplate: '{suit}で無得点', sabotageKind: 'all' },
    { id: 'regicide-planet', name: '王侯を打ち滅ぼす惑星', waveSlot: 3, targetMultiplier: 2, reward: 5, restrictionKind: 'face', descTemplate: '絵札(J・Q・K)で無得点', sabotageKind: 'all' },
  ],
```

- [ ] **Step 5: shidasu.config.jsonにも同様に追加する**

`src/lib/game/shidasu/shidasu.config.json`の`"stars": [ ... ]`(26〜100行目)の各エントリに`"sabotageKind"`を追加する。`"ordinary-moon"`・`"slightly-bigger-moon"`は`"sabotageKind": "none"`、`"closed-loop-planet"`・`"sealed-noble-planet"`・`"harsh-planet"`・`"twisted-odd-planet"`・`"exiling-color-planet"`・`"regicide-planet"`は`"sabotageKind": "all"`を、各エントリの`"descTemplate"`の直後に追加する。例(`ordinary-moon`):

```json
    {
      "id": "ordinary-moon",
      "name": "普通の衛星",
      "waveSlot": 1,
      "targetMultiplier": 1,
      "reward": 3,
      "restrictionKind": "none",
      "descTemplate": "",
      "sabotageKind": "none"
    },
```

同様に残り7件も`descTemplate`の後に`"sabotageKind": "none"`(waveSlot1・2)または`"sabotageKind": "all"`(waveSlot3の6件)を追加する。

- [ ] **Step 6: テストを実行しパスすることを確認する**

Run: `npx vitest run src/lib/game/shidasu/engine.test.ts -t "星のsabotage割り当て"`
Expected: PASS(2 tests)

- [ ] **Step 7: rollStarForSlot・フォールバック星でsabotageを変換する**

`src/lib/game/shidasu/engine.ts`の`rollStarForSlot`関数(926〜944行目)を変更:

```ts
function rollStarForSlot(params: ShidasuParams, waveSlot: 1 | 2 | 3, rand: () => number, excludeId?: string): Star {
  const allCandidates = params.stars.filter(s => s.waveSlot === waveSlot)
  if (allCandidates.length === 0) {
    return { id: `fallback-${waveSlot}`, name: '名もなき星', waveSlot, targetMultiplier: 1, reward: 0, restriction: null, sabotage: { kind: 'none' }, descTemplate: '' }
  }
  const candidates = excludeId && allCandidates.length > 1 ? allCandidates.filter(s => s.id !== excludeId) : allCandidates
  const entry = candidates[Math.floor(rand() * candidates.length)]
  return {
    id: entry.id,
    name: entry.name,
    waveSlot: entry.waveSlot,
    targetMultiplier: entry.targetMultiplier,
    reward: entry.reward,
    restriction: toStarRestriction(entry, rand),
    sabotage: entry.sabotageKind === 'all' ? { kind: 'all' } : { kind: 'none' },
    descTemplate: entry.descTemplate,
  }
}
```

- [ ] **Step 8: テストを実行し全体が通ることを確認する**

Run: `npx vitest run src/lib/game/shidasu/engine.test.ts`
Expected: PASS(既存テスト含め全て通る)

Run: `npm run check`
Expected: エラー無し(Task 1で発生していたWaveState関連のエラーはまだ残っている想定。Task 4で解消する)

- [ ] **Step 9: コミット**

```bash
git add src/lib/game/shidasu/params.ts src/lib/game/shidasu/shidasu.config.json src/lib/game/shidasu/engine.ts src/lib/game/shidasu/engine.test.ts
git commit -m "feat: waveSlot3の星6種に妨害行動(sabotageKind: all)を割り当て"
```

---

### Task 4: startWaveでの初期妨害抽選

**Files:**
- Modify: `src/lib/game/shidasu/engine.ts`(`startWave`・`finishShop`)
- Test: `src/lib/game/shidasu/engine.test.ts`

- [ ] **Step 1: 失敗するテストを書く**

`src/lib/game/shidasu/engine.test.ts`の末尾に追記:

```ts
describe('startWaveの妨害初期抽選', () => {
  it('sabotage: {kind: "all"}を渡すとpendingSabotageIdが設定される', () => {
    const { wave } = startWave(DEFAULT_PARAMS, 0, 0, [], standardDeckComposition(), 1, 0, defaultOracleLevels(), 1, 1, 1, 10, 1, 1, 50, { kind: 'all' })
    expect(wave.pendingSabotageId).not.toBeNull()
    expect(wave.sabotageTurnsRemaining).toBeGreaterThan(0)
  })
  it('sabotage省略時(デフォルト)はpendingSabotageIdがnull', () => {
    const { wave } = startWave(DEFAULT_PARAMS, 0, 0, [], standardDeckComposition(), 1, 0, defaultOracleLevels())
    expect(wave.pendingSabotageId).toBeNull()
    expect(wave.sabotageTurnsRemaining).toBe(0)
    expect(wave.activeSeal).toBeNull()
  })
})
```

- [ ] **Step 2: テストを実行し失敗を確認する**

Run: `npx vitest run src/lib/game/shidasu/engine.test.ts -t "startWaveの妨害初期抽選"`
Expected: FAIL(`startWave`が11番目の引数`sabotage`を受け付けない、または`wave.pendingSabotageId`が`undefined`)

- [ ] **Step 3: startWaveにsabotage引数を追加する**

`src/lib/game/shidasu/engine.ts`冒頭のimportに`SABOTAGE_POOL`は不要(直接使うのは`rollSabotage`のみ)。`import { rollOffer... } from './deck'`の下あたりに追加:

```ts
import { rollSabotage } from './sabotage'
```

`startWave`関数のシグネチャ(119〜135行目)の末尾に引数を追加:

```ts
export function startWave(
  params: ShidasuParams,
  _stageIndex: number,
  _waveIndex: number,
  items: ItemId[],
  deckComposition: DeckCard[],
  seed?: number,
  extraTableauRows: number = 0,
  oracleLevels: Record<RoleName, number> = defaultOracleLevels(),
  dedicationX: number = 1,
  diligenceX: number = 1,
  divineProtectionX: number = 1,
  discretionN: number = 10,
  frostX: number = 1,
  echoX: number = 1,
  shootingStarN: number = 50,
  sabotage: StarSabotage = { kind: 'none' }
): { wave: WaveState; deckComposition: DeckCard[] } {
```

`StarSabotage`を型importに追加(2行目の`import type { ... } from './types'`に`StarSabotage`を追加)。

`startWave`内の`const wave: WaveState = { ... }`オブジェクトリテラル(170行目付近)の末尾、`oracleLevels`の直後に追加:

```ts
    oracleLevels,
    ...rollSabotage(sabotage, rand),
    activeSeal: null,
  }
```

(`rollSabotage`は`{ pendingSabotageId, sabotageTurnsRemaining }`を返すため、スプレッドで両方まとめて設定できる。)

- [ ] **Step 4: finishShopから星のsabotageを渡す**

`src/lib/game/shidasu/engine.ts`の`finishShop`関数(1140〜1144行目)を変更:

```ts
export function finishShop(params: ShidasuParams, run: RunState, seed?: number): RunState {
  if (run.phase !== 'shop') return run
  const star = run.stageStars[run.waveIndex]
  const { wave, deckComposition } = startWave(params, run.stageIndex, run.waveIndex, run.items, run.deckComposition, seed, run.extraTableauRows, run.oracleLevels, run.dedicationX, run.diligenceX, run.divineProtectionX, run.discretionN, run.frostX, run.echoX, run.shootingStarN, star?.sabotage ?? { kind: 'none' })
  return { ...run, phase: 'playing', wave, waveGeneration: run.waveGeneration + 1, deckComposition, shop: null }
}
```

- [ ] **Step 5: テストを実行しパスすることを確認する**

Run: `npx vitest run src/lib/game/shidasu/engine.test.ts -t "startWaveの妨害初期抽選"`
Expected: PASS(2 tests)

Run: `npm run check`
Expected: エラー無し

- [ ] **Step 6: コミット**

```bash
git add src/lib/game/shidasu/engine.ts src/lib/game/shidasu/engine.test.ts
git commit -m "feat: startWaveで星のsabotage設定から初期の妨害を抽選する"
```

---

### Task 5: ターンカウントダウンと役封印の反映(playCard・drawStock)

**Files:**
- Modify: `src/lib/game/shidasu/engine.ts`(`playCard`・`drawStock`)
- Test: `src/lib/game/shidasu/engine.test.ts`

- [ ] **Step 1: 失敗するテストを書く**

`src/lib/game/shidasu/engine.test.ts`の末尾に追記:

```ts
describe('妨害のターンカウントダウン', () => {
  function waveWithPendingSabotage(overrides: Partial<WaveState> = {}): WaveState {
    const { wave } = startWave(DEFAULT_PARAMS, 0, 0, [], standardDeckComposition(), 1, 0, defaultOracleLevels())
    return { ...wave, pendingSabotageId: 'stockPurge', sabotageTurnsRemaining: 3, ...overrides }
  }

  it('playCardで有効なプレイをするとsabotageTurnsRemainingが1減る', () => {
    const wave = waveWithPendingSabotage()
    const playableCol = wave.tableau.findIndex(col => col.length > 0 && isPlayable('none', wave, col[col.length - 1], []))
    const { wave: next } = playCard(DEFAULT_PARAMS, wave, 'none', [], 100000, playableCol, standardDeckComposition(), () => 0.5)
    expect(next.sabotageTurnsRemaining).toBe(2)
  })

  it('playCardが不正なプレイ(空列)で早期returnした場合はカウントダウンしない', () => {
    const wave = waveWithPendingSabotage()
    const emptyCol = wave.tableau.findIndex(col => col.length === 0)
    if (emptyCol === -1) return // 稀に空列が無ければスキップ(deal構成による)
    const { wave: next } = playCard(DEFAULT_PARAMS, wave, 'none', [], 100000, emptyCol, standardDeckComposition(), () => 0.5)
    expect(next.sabotageTurnsRemaining).toBe(3)
  })

  it('pendingSabotageIdがnullならカウントダウンしない(sabotageTurnsRemainingは0のまま)', () => {
    const wave = waveWithPendingSabotage({ pendingSabotageId: null, sabotageTurnsRemaining: 0 })
    const playableCol = wave.tableau.findIndex(col => col.length > 0 && isPlayable('none', wave, col[col.length - 1], []))
    const { wave: next } = playCard(DEFAULT_PARAMS, wave, 'none', [], 100000, playableCol, standardDeckComposition(), () => 0.5)
    expect(next.sabotageTurnsRemaining).toBe(0)
  })
})

describe('役封印のoracleLevelへの反映(playCard)', () => {
  it('sealedRoleEffect.zeroRolesに含まれる役はボーナスが0になる', () => {
    const { wave: baseWave } = startWave(DEFAULT_PARAMS, 0, 0, [], standardDeckComposition(), 1)
    // 直近3枚がJ・Q・Kになるようチェーンを人工的に組み立て、ロイヤルセットを発火させる
    const chain: Card[] = [
      { id: 901, suit: '♠', rank: 11, wild: false },
      { id: 902, suit: '♥', rank: 12, wild: false },
    ]
    const wave: WaveState = { ...baseWave, chain, chainOrigin: ['draw', 'draw'], linked: true, foundation: chain[1] }
    const kingCard: Card = { id: 903, suit: '♦', rank: 13, wild: false }
    const tableau = wave.tableau.map((col, i) => (i === 0 ? [...col, kingCard] : col))
    const waveWithKing = { ...wave, tableau }

    const withoutSeal = playCard(DEFAULT_PARAMS, waveWithKing, 'none', [], 1000000, 0, standardDeckComposition(), () => 0.5)
    const withSeal = playCard(DEFAULT_PARAMS, waveWithKing, 'none', [], 1000000, 0, standardDeckComposition(), () => 0.5, null, undefined, { zeroRoles: ['royalSet'], oracleBaselineRole: null })

    expect(withoutSeal.wave.score).toBeGreaterThan(withSeal.wave.score)
  })
})
```

(このテストはロイヤルセット役の発火条件に依存する。既存の`engine.test.ts`内にロイヤルセットを発火させるテストが既にあるはずなので、その組み立て方と揃っているか確認し、必要ならそちらのカード構成を流用すること。)

- [ ] **Step 2: テストを実行し失敗を確認する**

Run: `npx vitest run src/lib/game/shidasu/engine.test.ts -t "妨害のターンカウントダウン"`
Run: `npx vitest run src/lib/game/shidasu/engine.test.ts -t "役封印のoracleLevelへの反映"`
Expected: FAIL(`sabotageTurnsRemaining`が変化しない、`playCard`が7番目の引数を受け付けない)

- [ ] **Step 3: playCardにsealedRoleEffect引数を追加し、oracleLevelとカウントダウンを実装する**

`src/lib/game/shidasu/engine.ts`の`playCard`シグネチャ(360〜371行目)を変更:

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
  sealedRoleEffect: { zeroRoles: RoleName[]; oracleBaselineRole: RoleName | null } = { zeroRoles: [], oracleBaselineRole: null }
): { wave: WaveState; deckComposition: DeckCard[] } {
```

`playCard`内の`oracleLevel`定義(417行目)を変更:

```ts
  // 神託: 役ごとの現在レベルをそのまま基礎点の乗数として渡す(ウェーブ開始時点で固定済み)。
  // 役封印中はzeroRolesに含まれる役を0倍、天啓・神託封印でオラクルが選ばれた場合は
  // oracleBaselineRoleに一致する役だけレベル1相当(封印前の水準)に戻す。
  const oracleLevel = (name: RoleName): number => {
    if (sealedRoleEffect.zeroRoles.includes(name)) return 0
    if (sealedRoleEffect.oracleBaselineRole === name) return 1
    return wave.oracleLevels[name] ?? 1
  }
```

`playCard`内の`next: WaveState = { ...wave, ... }`オブジェクト(602〜643行目)に、`nextPlayScoreMultiplier: 1,`の直前に追加:

```ts
    sabotageTurnsRemaining: wave.pendingSabotageId ? Math.max(0, wave.sabotageTurnsRemaining - 1) : wave.sabotageTurnsRemaining,
```

- [ ] **Step 4: drawStockにも同様の変更を加える**

`src/lib/game/shidasu/engine.ts`の`drawStock`シグネチャ(701〜710行目)を変更:

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
  sealedRoleEffect: { zeroRoles: RoleName[]; oracleBaselineRole: RoleName | null } = { zeroRoles: [], oracleBaselineRole: null }
): { wave: WaveState; deckComposition: DeckCard[] } {
```

`drawStock`内のnaive分岐にある`oracleLevel`定義(744行目)を、playCardと同じロジックに変更:

```ts
      const oracleLevel = (name: RoleName): number => {
        if (sealedRoleEffect.zeroRoles.includes(name)) return 0
        if (sealedRoleEffect.oracleBaselineRole === name) return 1
        return wave.oracleLevels[name] ?? 1
      }
```

`continueWave: WaveState = { ... }`オブジェクト(800〜816行目)に、`flushActiveThisCombo: naiveFlushActiveThisCombo,`の直後に追加:

```ts
      sabotageTurnsRemaining: wave.pendingSabotageId ? Math.max(0, wave.sabotageTurnsRemaining - 1) : wave.sabotageTurnsRemaining,
```

(`resetWave`側、パターン非継続でリセットする分岐(840行目付近)には**追加しない**。この分岐は「ターン」の定義に該当しないため。)

- [ ] **Step 5: テストを実行しパスすることを確認する**

Run: `npx vitest run src/lib/game/shidasu/engine.test.ts -t "妨害のターンカウントダウン"`
Run: `npx vitest run src/lib/game/shidasu/engine.test.ts -t "役封印のoracleLevelへの反映"`
Expected: PASS(4 tests)

Run: `npx vitest run src/lib/game/shidasu/engine.test.ts`
Expected: 既存テスト含め全てPASS(`playCard`/`drawStock`の呼び出し元で新しい引数がデフォルト値で補われるため、既存呼び出しは変更不要のはず)

Run: `npm run check`
Expected: エラー無し

- [ ] **Step 6: コミット**

```bash
git add src/lib/game/shidasu/engine.ts src/lib/game/shidasu/engine.test.ts
git commit -m "feat: playCard/drawStockで妨害のターンカウントダウンと役封印を実装"
```

---

### Task 6: triggerSabotage実装(11個の効果)

**Files:**
- Modify: `src/lib/game/shidasu/engine.ts`
- Test: `src/lib/game/shidasu/engine.test.ts`

- [ ] **Step 1: 失敗するテストを書く**

`src/lib/game/shidasu/engine.test.ts`の末尾に追記(`createTestRunWithWave`は既存のヘルパーがあればそれを使う。無ければ以下のように組み立てる):

```ts
describe('triggerSabotage', () => {
  function runWithWave(overrides: Partial<RunState> = {}, waveOverrides: Partial<WaveState> = {}): RunState {
    const run = createInitialRun()
    const { wave } = startWave(DEFAULT_PARAMS, 0, 0, run.items, run.deckComposition, 1, 0, defaultOracleLevels())
    return { ...run, phase: 'playing', wave: { ...wave, ...waveOverrides }, ...overrides }
  }

  it('stockPurge: 山札の上から5枚を捨て札に置く', () => {
    const run = runWithWave()
    const stockBefore = run.wave!.stock.length
    const next = triggerSabotage(DEFAULT_PARAMS, run, 'stockPurge', () => 0)
    expect(next.wave!.stock.length).toBe(stockBefore - 5)
    expect(next.wave!.discardPile.length).toBe(5)
  })

  it('columnReturn: 選んだ列が山札に戻りシャッフルされ、同じ枚数で再配布される', () => {
    const run = runWithWave()
    const colIndex = 0
    const colLenBefore = run.wave!.tableau[colIndex].length
    const stockBefore = run.wave!.stock.length
    const next = triggerSabotage(DEFAULT_PARAMS, run, 'columnReturn', () => 0)
    expect(next.wave!.tableau[colIndex].length).toBe(colLenBefore)
    expect(next.wave!.stock.length).toBe(stockBefore)
  })

  it('chainSettle: チェーンが捨て札に送られ、コンボが0になる', () => {
    const run = runWithWave({}, { combo: 3, chain: [{ id: 1, suit: '♠', rank: 1, wild: false }, { id: 2, suit: '♠', rank: 2, wild: false }] })
    const next = triggerSabotage(DEFAULT_PARAMS, run, 'chainSettle', () => 0)
    expect(next.wave!.combo).toBe(0)
    expect(next.wave!.chain.length).toBe(1)
  })

  it('comboBreather: チェーンはそのまま、コンボだけ0になる', () => {
    const run = runWithWave({}, { combo: 5, chain: [{ id: 1, suit: '♠', rank: 1, wild: false }, { id: 2, suit: '♠', rank: 2, wild: false }] })
    const chainBefore = run.wave!.chain
    const next = triggerSabotage(DEFAULT_PARAMS, run, 'comboBreather', () => 0)
    expect(next.wave!.combo).toBe(0)
    expect(next.wave!.chain).toBe(chainBefore)
  })

  it('talismanSeal: 所持護符からランダムに1つ選びactiveSealに設定する', () => {
    const run = runWithWave({ items: ['bridge', 'grace'] })
    const next = triggerSabotage(DEFAULT_PARAMS, run, 'talismanSeal', () => 0)
    expect(next.wave!.activeSeal).toEqual({ kind: 'talisman', id: 'bridge' })
  })

  it('talismanSeal: 護符を所持していなければactiveSealはnullのまま', () => {
    const run = runWithWave({ items: [] })
    const next = triggerSabotage(DEFAULT_PARAMS, run, 'talismanSeal', () => 0)
    expect(next.wave!.activeSeal).toBeNull()
  })

  it('riteSeal: 所持秘儀からランダムに1つ選びactiveSealに設定する', () => {
    const run = runWithWave({ rites: ['gebo', 'fehu'] })
    const next = triggerSabotage(DEFAULT_PARAMS, run, 'riteSeal', () => 0)
    expect(next.wave!.activeSeal).toEqual({ kind: 'rite', id: 'gebo' })
  })

  it('revelationOracleSeal: 天啓・神託の合算プールからランダムに1つ選ぶ', () => {
    const run = runWithWave({ revelations: ['kaku'], oracles: [] })
    const next = triggerSabotage(DEFAULT_PARAMS, run, 'revelationOracleSeal', () => 0)
    expect(next.wave!.activeSeal).toEqual({ kind: 'revelationOrOracle', ref: { kind: 'revelation', id: 'kaku' } })
  })

  it('relicConfiscate: 所持レリックからランダムに1つ選び完全に失う', () => {
    const run = runWithWave({ relics: [{ id: 'manekiNeko', tsukumoka: false }, { id: 'juzu', tsukumoka: false }] })
    const next = triggerSabotage(DEFAULT_PARAMS, run, 'relicConfiscate', () => 0)
    expect(next.relics).toEqual([{ id: 'juzu', tsukumoka: false }])
  })

  it('tableauCardToDiscard: 場札から1枚選び捨て札に送る', () => {
    const run = runWithWave()
    const remainingBefore = run.wave!.tableau.flat().length
    const next = triggerSabotage(DEFAULT_PARAMS, run, 'tableauCardToDiscard', () => 0)
    expect(next.wave!.tableau.flat().length).toBe(remainingBefore - 1)
    expect(next.wave!.discardPile.length).toBe(1)
  })

  it('currencyConfiscate: 所持通貨を5減らす(0未満にはしない)', () => {
    const run = runWithWave({ currency: 3 })
    const next = triggerSabotage(DEFAULT_PARAMS, run, 'currencyConfiscate', () => 0)
    expect(next.currency).toBe(0)
  })

  it('roleSeal: ランダムな2役をactiveSealに設定する', () => {
    const run = runWithWave()
    const next = triggerSabotage(DEFAULT_PARAMS, run, 'roleSeal', () => 0)
    expect(next.wave!.activeSeal?.kind).toBe('role')
    expect((next.wave!.activeSeal as { kind: 'role'; names: RoleName[] }).names).toHaveLength(2)
  })

  it('効果適用後、次の妨害が再抽選される(星がsabotage: allの場合)', () => {
    const star: Star = { id: 'test-star', name: 'テスト星', waveSlot: 3, targetMultiplier: 1, reward: 0, restriction: null, sabotage: { kind: 'all' }, descTemplate: '' }
    const run = runWithWave({ stageStars: [star, star, star] })
    const next = triggerSabotage(DEFAULT_PARAMS, run, 'comboBreather', () => 0)
    expect(next.wave!.pendingSabotageId).not.toBeNull()
    expect(next.wave!.sabotageTurnsRemaining).toBeGreaterThan(0)
  })

  it('効果適用後、activeSealは一旦nullにリセットされてから今回の効果が反映される', () => {
    const run = runWithWave({ items: ['bridge'] }, { activeSeal: { kind: 'rite', id: 'gebo' } })
    const next = triggerSabotage(DEFAULT_PARAMS, run, 'talismanSeal', () => 0)
    expect(next.wave!.activeSeal).toEqual({ kind: 'talisman', id: 'bridge' })
  })
})
```

- [ ] **Step 2: テストを実行し失敗を確認する**

Run: `npx vitest run src/lib/game/shidasu/engine.test.ts -t "triggerSabotage"`
Expected: FAIL(`triggerSabotage`が存在しない)

- [ ] **Step 3: triggerSabotageを実装する**

`src/lib/game/shidasu/engine.ts`の`finishShop`関数の直後あたりに追加:

```ts
// 妨害行動を1つ発動させ、効果を適用した上で次の妨害を再抽選する。
// applyPlayCard/applyDrawStock(RunState層)から、wave.sabotageTurnsRemainingが0になった時点で呼ばれる。
export function triggerSabotage(params: ShidasuParams, run: RunState, id: SabotageActionId, rand: () => number = Math.random): RunState {
  if (!run.wave) return run
  const wave = run.wave
  let nextWave: WaveState = { ...wave, activeSeal: null }
  let nextRun: RunState = run

  switch (id) {
    case 'stockPurge': {
      const n = Math.min(5, wave.stock.length)
      const purged = wave.stock.slice(wave.stock.length - n)
      nextWave = { ...nextWave, stock: wave.stock.slice(0, wave.stock.length - n), discardPile: [...wave.discardPile, ...purged] }
      break
    }
    case 'columnReturn': {
      const colIndex = Math.floor(rand() * wave.tableau.length)
      const col = wave.tableau[colIndex]
      const pool = [...wave.stock, ...col]
      shuffleInPlace(pool, rand)
      const newCol = pool.slice(0, col.length)
      const newStock = pool.slice(col.length)
      const tableau = wave.tableau.map((c, i) => (i === colIndex ? newCol : c))
      nextWave = { ...nextWave, tableau, stock: newStock }
      break
    }
    case 'chainSettle': {
      if (wave.stock.length === 0) {
        nextWave = resetComboFields(nextWave, params)
      } else {
        const stock = [...wave.stock]
        const drawn = stock.pop() as Card
        nextWave = { ...resetComboFields(nextWave, params, drawn, 'draw'), stock }
      }
      break
    }
    case 'comboBreather': {
      nextWave = { ...nextWave, combo: 0 }
      break
    }
    case 'talismanSeal': {
      if (run.items.length > 0) {
        const target = run.items[Math.floor(rand() * run.items.length)]
        nextWave = { ...nextWave, activeSeal: { kind: 'talisman', id: target } }
      }
      break
    }
    case 'riteSeal': {
      if (run.rites.length > 0) {
        const target = run.rites[Math.floor(rand() * run.rites.length)]
        nextWave = { ...nextWave, activeSeal: { kind: 'rite', id: target } }
      }
      break
    }
    case 'revelationOracleSeal': {
      const pool: HeldRevelationOrOracleRef[] = [
        ...run.revelations.map(refId => ({ kind: 'revelation' as const, id: refId })),
        ...run.oracles.map(refId => ({ kind: 'oracle' as const, id: refId })),
      ]
      if (pool.length > 0) {
        const ref = pool[Math.floor(rand() * pool.length)]
        nextWave = { ...nextWave, activeSeal: { kind: 'revelationOrOracle', ref } }
      }
      break
    }
    case 'relicConfiscate': {
      if (run.relics.length > 0) {
        const idx = Math.floor(rand() * run.relics.length)
        nextRun = { ...nextRun, relics: [...run.relics.slice(0, idx), ...run.relics.slice(idx + 1)] }
      }
      break
    }
    case 'tableauCardToDiscard': {
      const positions: { ci: number; ri: number }[] = []
      wave.tableau.forEach((col, ci) => col.forEach((_c, ri) => positions.push({ ci, ri })))
      if (positions.length > 0) {
        const pick = positions[Math.floor(rand() * positions.length)]
        const card = wave.tableau[pick.ci][pick.ri]
        const tableau = wave.tableau.map((col, ci) => (ci === pick.ci ? [...col.slice(0, pick.ri), ...col.slice(pick.ri + 1)] : col))
        nextWave = { ...nextWave, tableau, discardPile: [...wave.discardPile, card] }
      }
      break
    }
    case 'currencyConfiscate': {
      nextRun = { ...nextRun, currency: Math.max(0, run.currency - 5) }
      break
    }
    case 'roleSeal': {
      const names = rollOffer(ORACLE_POOL, 2, rand)
      nextWave = { ...nextWave, activeSeal: { kind: 'role', names } }
      break
    }
  }

  const star = nextRun.stageStars[nextRun.waveIndex]
  const rolled = rollSabotage(star?.sabotage ?? { kind: 'none' }, rand)
  return { ...nextRun, wave: { ...nextWave, pendingSabotageId: rolled.pendingSabotageId, sabotageTurnsRemaining: rolled.sabotageTurnsRemaining } }
}
```

`SabotageActionId`を型importに追加する(2行目)。

- [ ] **Step 4: テストを実行しパスすることを確認する**

Run: `npx vitest run src/lib/game/shidasu/engine.test.ts -t "triggerSabotage"`
Expected: PASS(14 tests)

Run: `npx vitest run src/lib/game/shidasu/engine.test.ts`
Expected: 全てPASS

Run: `npm run check`
Expected: エラー無し

- [ ] **Step 5: コミット**

```bash
git add src/lib/game/shidasu/engine.ts src/lib/game/shidasu/engine.test.ts
git commit -m "feat: triggerSabotageで11個の妨害行動の効果を実装"
```

---

### Task 7: applyPlayCard/applyDrawStock/applyStuckCheckへの統合(封印フィルタ・発動トリガー)

**Files:**
- Modify: `src/lib/game/shidasu/engine.ts`
- Test: `src/lib/game/shidasu/engine.test.ts`

- [ ] **Step 1: 失敗するテストを書く**

`src/lib/game/shidasu/engine.test.ts`の末尾に追記:

```ts
describe('妨害の発動トリガー統合(applyPlayCard)', () => {
  it('sabotageTurnsRemainingが1の状態でapplyPlayCardすると効果が発動し、次の妨害が再抽選される', () => {
    const star: Star = { id: 'test-star', name: 'テスト星', waveSlot: 3, targetMultiplier: 1, reward: 0, restriction: null, sabotage: { kind: 'all' }, descTemplate: '' }
    let run = createInitialRun()
    const { wave } = startWave(DEFAULT_PARAMS, 0, 0, run.items, run.deckComposition, 1, 0, defaultOracleLevels())
    run = { ...run, phase: 'playing', stageStars: [star, star, star], wave: { ...wave, pendingSabotageId: 'comboBreather', sabotageTurnsRemaining: 1, combo: 5 } }
    const playableCol = run.wave!.tableau.findIndex(col => col.length > 0 && isPlayable('none', run.wave!, col[col.length - 1], []))
    const next = applyPlayCard(DEFAULT_PARAMS, run, playableCol, () => 0.5)
    // comboBreatherが発動していればcomboは0になっているはず(このプレイ自体のコンボ加算より後に発動)
    expect(next.wave!.pendingSabotageId).not.toBeNull()
  })

  it('護符封印中は封印された護符の効果が適用されない(effectiveItemsから除外される)', () => {
    let run = createInitialRun()
    const { wave } = startWave(DEFAULT_PARAMS, 0, 0, ['golden'], run.deckComposition, 1, 0, defaultOracleLevels())
    run = { ...run, phase: 'playing', items: ['golden'], wave: { ...wave, activeSeal: { kind: 'talisman', id: 'golden' } } }
    const playableCol = run.wave!.tableau.findIndex(col => col.length > 0 && isPlayable('none', run.wave!, col[col.length - 1], []))
    const next = applyPlayCard(DEFAULT_PARAMS, run, playableCol, () => 0.5)
    // golden(黄金)は通常コンボ+2のところ、封印中は+1のまま(通常の護符無し挙動と同じ)になるはず
    expect(next.wave!.combo).toBe(1)
  })
})
```

(2つ目のテストは`golden`護符の効果が「コンボ加算を+1ではなく+2にする」ことを前提にしている。`playCard`内の`items.includes('golden') ? 2 : 1`の分岐と対応している。)

- [ ] **Step 2: テストを実行し失敗を確認する**

Run: `npx vitest run src/lib/game/shidasu/engine.test.ts -t "妨害の発動トリガー統合"`
Expected: FAIL(封印が反映されず`combo`が2になる、またはトリガーが呼ばれていない)

- [ ] **Step 3: ヘルパー関数を追加する**

`src/lib/game/shidasu/engine.ts`の`triggerSabotage`関数の直前に追加:

```ts
// wave.activeSealがtalisman封印の場合、そのIDをitemsから除外した実効リストを返す。
// playCard/drawStockへ渡すitemsをこれに差し替えることで、所持表示(run.items)自体は
// 変更せずに効果だけを無視させる。
function resolveEffectiveItems(items: ItemId[], activeSeal: WaveState['activeSeal']): ItemId[] {
  if (activeSeal?.kind === 'talisman') return items.filter(id => id !== activeSeal.id)
  return items
}

// wave.activeSealから、playCard/drawStockに渡すsealedRoleEffectを導出する。
// role封印は該当役のボーナスを0倍に、revelationOrOracle封印でoracleが選ばれていれば
// 該当役のレベル効果だけを1倍(封印前の基準値)に戻す。
function resolveSealedRoleEffect(activeSeal: WaveState['activeSeal']): { zeroRoles: RoleName[]; oracleBaselineRole: RoleName | null } {
  if (activeSeal?.kind === 'role') return { zeroRoles: activeSeal.names, oracleBaselineRole: null }
  if (activeSeal?.kind === 'revelationOrOracle' && activeSeal.ref.kind === 'oracle') return { zeroRoles: [], oracleBaselineRole: activeSeal.ref.id }
  return { zeroRoles: [], oracleBaselineRole: null }
}
```

- [ ] **Step 4: applyPlayCard/applyDrawStockを更新する**

`src/lib/game/shidasu/engine.ts`の`applyPlayCard`(1696〜1703行目)を変更:

```ts
export function applyPlayCard(params: ShidasuParams, run: RunState, colIndex: number, rand: () => number = Math.random, rowIndex?: number): RunState {
  if (run.phase !== 'playing' || !run.wave) return run
  const target = waveTarget(params, run.stageIndex, run.waveIndex, run.stageStars)
  const modifier = stageModifierFor(params, run)
  const scoreLock = bossScoreLockFor(params, run)
  const effectiveItems = resolveEffectiveItems(run.items, run.wave.activeSeal)
  const sealedRoleEffect = resolveSealedRoleEffect(run.wave.activeSeal)
  const { wave, deckComposition } = playCard(params, run.wave, modifier, effectiveItems, target, colIndex, run.deckComposition, rand, scoreLock, rowIndex, sealedRoleEffect)
  let next: RunState = { ...run, wave, deckComposition }
  if (wave.pendingSabotageId && wave.sabotageTurnsRemaining <= 0) {
    next = triggerSabotage(params, next, wave.pendingSabotageId, rand)
  }
  return next
}
```

`applyDrawStock`(1705〜1712行目)を変更:

```ts
export function applyDrawStock(params: ShidasuParams, run: RunState, rand: () => number = Math.random): RunState {
  if (run.phase !== 'playing' || !run.wave) return run
  const target = waveTarget(params, run.stageIndex, run.waveIndex, run.stageStars)
  const modifier = stageModifierFor(params, run)
  const scoreLock = bossScoreLockFor(params, run)
  const effectiveItems = resolveEffectiveItems(run.items, run.wave.activeSeal)
  const sealedRoleEffect = resolveSealedRoleEffect(run.wave.activeSeal)
  const { wave, deckComposition } = drawStock(params, run.wave, effectiveItems, target, run.deckComposition, modifier, rand, scoreLock, sealedRoleEffect)
  let next: RunState = { ...run, wave, deckComposition }
  if (wave.pendingSabotageId && wave.sabotageTurnsRemaining <= 0) {
    next = triggerSabotage(params, next, wave.pendingSabotageId, rand)
  }
  return next
}
```

`applyStuckCheck`内、`drawStock`を呼んでいる箇所(1748行目付近)も同様にeffectiveItemsへ差し替え、呼び出し直後にトリガーチェックを追加する:

```ts
  if (resetWave.stock.length > 0) {
    const stageTarget = waveTarget(params, run.stageIndex, run.waveIndex, run.stageStars)
    const scoreLock = bossScoreLockFor(params, run)
    const effectiveItems = resolveEffectiveItems(run.items, resetWave.activeSeal)
    const sealedRoleEffect = resolveSealedRoleEffect(resetWave.activeSeal)
    const drawResult = drawStock(params, resetWave, effectiveItems, stageTarget, run.deckComposition, modifier, rand, scoreLock, sealedRoleEffect)
    let next: RunState = { ...run, wave: drawResult.wave, deckComposition: drawResult.deckComposition }
    if (drawResult.wave.pendingSabotageId && drawResult.wave.sabotageTurnsRemaining <= 0) {
      next = triggerSabotage(params, next, drawResult.wave.pendingSabotageId, rand)
    }
    return next
  }
```

- [ ] **Step 5: テストを実行しパスすることを確認する**

Run: `npx vitest run src/lib/game/shidasu/engine.test.ts -t "妨害の発動トリガー統合"`
Expected: PASS(2 tests)

Run: `npx vitest run src/lib/game/shidasu/engine.test.ts`
Expected: 全てPASS

Run: `npm run check`
Expected: エラー無し

- [ ] **Step 6: コミット**

```bash
git add src/lib/game/shidasu/engine.ts src/lib/game/shidasu/engine.test.ts
git commit -m "feat: applyPlayCard/applyDrawStock/applyStuckCheckに妨害の封印フィルタと発動トリガーを統合"
```

---

### Task 8: canUseRite/canUseRevelationへの封印ガード追加

**Files:**
- Modify: `src/lib/game/shidasu/riteEffects.ts`
- Modify: `src/lib/game/shidasu/revelationEffects.ts`
- Test: `src/lib/game/shidasu/riteEffects.test.ts`
- Test: `src/lib/game/shidasu/revelationEffects.test.ts`

- [ ] **Step 1: 失敗するテストを書く**

`src/lib/game/shidasu/riteEffects.test.ts`に追記(ファイル内の既存`describe('canUseRite', ...)`ブロックの末尾、または無ければ新規に追加):

```ts
describe('canUseRite: 封印中の秘儀は使用不可', () => {
  it('activeSealがriteでidが一致する場合、他の条件を満たしていてもfalse', () => {
    const wave = { ...baseWave, stock: standardDeckComposition().length > 100 ? [] : [], activeSeal: { kind: 'rite' as const, id: 'ansuz' as const } }
    expect(canUseRite(DEFAULT_PARAMS, { ...wave, stock: [{ id: 1, suit: '♠', rank: 1, wild: false }] }, 'ansuz')).toBe(false)
  })
})
```

(`baseWave`は既存テストで使っているWaveStateのひな形を流用する。既存の`riteEffects.test.ts`冒頭でどのようなヘルパー・初期WaveStateを使っているか確認し、それに`activeSeal`フィールドを追加した形で組み立てること。)

`src/lib/game/shidasu/revelationEffects.test.ts`に追記:

```ts
describe('canUseRevelation: 封印中の天啓・神託は使用不可', () => {
  it('activeSealがrevelationOrOracleでrevelationのidが一致する場合、false', () => {
    const sealedWave = { ...baseWave, activeSeal: { kind: 'revelationOrOracle' as const, ref: { kind: 'revelation' as const, id: 'kaku' as const } } }
    expect(canUseRevelation(DEFAULT_PARAMS, sealedWave, 'kaku', [])).toBe(false)
  })
  it('封印対象と異なるidなら通常通り判定する', () => {
    const sealedWave = { ...baseWave, activeSeal: { kind: 'revelationOrOracle' as const, ref: { kind: 'revelation' as const, id: 'kaku' as const } } }
    expect(canUseRevelation(DEFAULT_PARAMS, sealedWave, 'kou', [])).toBe(true)
  })
})
```

(`baseWave`は同ファイル内の既存ヘルパー・初期WaveStateを流用する。)

- [ ] **Step 2: テストを実行し失敗を確認する**

Run: `npx vitest run src/lib/game/shidasu/riteEffects.test.ts -t "封印中の秘儀"`
Run: `npx vitest run src/lib/game/shidasu/revelationEffects.test.ts -t "封印中の天啓"`
Expected: FAIL(封印を見ていないため`true`が返る)

- [ ] **Step 3: canUseRiteに封印判定を追加する**

`src/lib/game/shidasu/riteEffects.ts`の`canUseRite`関数(231行目)冒頭に追加:

```ts
export function canUseRite(_params: ShidasuParams, wave: WaveState, riteId: RiteId): boolean {
  if (wave.activeSeal?.kind === 'rite' && wave.activeSeal.id === riteId) return false
  const cols = wave.tableau.length
  switch (riteId) {
```

- [ ] **Step 4: canUseRevelationに封印判定を追加する**

`src/lib/game/shidasu/revelationEffects.ts`の`canUseRevelation`関数(207〜221行目)を変更(`_wave`を`wave`にリネームして使用する):

```ts
export function canUseRevelation(
  _params: ShidasuParams,
  wave: WaveState,
  revelationId: RevelationId,
  relics: { id: RelicId; tsukumoka: boolean }[] = []
): boolean {
  if (wave.activeSeal?.kind === 'revelationOrOracle' && wave.activeSeal.ref.kind === 'revelation' && wave.activeSeal.ref.id === revelationId) return false
  if (revelationId === 'kyo') {
    return relics.some(r => !r.tsukumoka)
  }
  if (revelationId === 'oni') {
    const ownedIds = new Set(relics.map(r => r.id))
    return RELIC_POOL.some(id => !ownedIds.has(id))
  }
  return true
}
```

- [ ] **Step 5: テストを実行しパスすることを確認する**

Run: `npx vitest run src/lib/game/shidasu/riteEffects.test.ts`
Run: `npx vitest run src/lib/game/shidasu/revelationEffects.test.ts`
Expected: 全てPASS

Run: `npm run check`
Run: `npx vitest run`
Expected: エラー無し・全テストPASS

- [ ] **Step 6: コミット**

```bash
git add src/lib/game/shidasu/riteEffects.ts src/lib/game/shidasu/revelationEffects.ts src/lib/game/shidasu/riteEffects.test.ts src/lib/game/shidasu/revelationEffects.test.ts
git commit -m "feat: canUseRite/canUseRevelationに妨害の封印判定を追加"
```

---

### Task 9: UI表示(次の妨害・残りターン数)

**Files:**
- Modify: `src/routes/game/shidasu/+page.svelte`

- [ ] **Step 1: 妨害表示用のヘルパー関数を追加する**

`src/routes/game/shidasu/+page.svelte`の`starRestrictionDetail`関数の直後(45行目付近)に追加:

```ts
import { SABOTAGE_POOL } from '$lib/game/shidasu/sabotage'
```

(ファイル冒頭の他のimportと合わせて追加する。)

`starRestrictionDetail`関数の直後に追加:

```ts
// 次に発動する妨害の名前+残りターン数を1行で返す。妨害が無い(pendingSabotageIdがnull)場合は空文字。
function sabotageDetail(wave: WaveState | null): string {
  if (!wave || !wave.pendingSabotageId) return ''
  const action = SABOTAGE_POOL.find(a => a.id === wave.pendingSabotageId)
  if (!action) return ''
  return `次の妨害: ${action.name}(あと${wave.sabotageTurnsRemaining}ターン)`
}
```

- [ ] **Step 2: 星情報表示に妨害行を追加する**

`src/routes/game/shidasu/+page.svelte`の1151行目(`<div class="text-[11px] text-slate-500 mt-0.5">{starRestrictionDetail(star) || '制限なし'}</div>`)の直後に追加:

```svelte
                {#if isNext && sabotageDetail(run.wave)}
                  <div class="text-[11px] text-slate-500 mt-0.5">{sabotageDetail(run.wave)}</div>
                {/if}
```

(`isNext`は既存の`{#each run.stageStars as star, i (star.id)}`ブロック内で定義済みの変数。現在プレイ中のWave=`isNext`の星のときだけ`run.wave`の妨害状態を表示する。)

- [ ] **Step 3: 開発サーバーで目視確認する**

Run: `npm run dev`

`/game/shidasu`を開き、`/admin/shidasu-bosses`(または`/admin/shidasu-debug`)でWave3(waveSlot3)まで進める。星情報カードに「次の妨害: ○○(あとNターン)」の行が表示されること、プレイを重ねるとターン数が減っていくこと、0になった時点で場の状態が変化し(効果が発動し)、表示が新しい妨害に切り替わることを確認する。

- [ ] **Step 4: コミット**

```bash
git add src/routes/game/shidasu/+page.svelte
git commit -m "feat: 星の妨害行動をプレイ画面に表示"
```

---

### Task 10: 最終確認

**Files:** なし(確認のみ)

- [ ] **Step 1: ビルドが通ることを確認する**

Run: `npm run build`
Expected: エラー無し

- [ ] **Step 2: 型チェックが通ることを確認する**

Run: `npm run check`
Expected: エラー無し

- [ ] **Step 3: 全テストが通ることを確認する**

Run: `npx vitest run`
Expected: 全てPASS

- [ ] **Step 4: 開発サーバーで実際にプレイし、11個の妨害行動が全て発動することを確認する**

Run: `npm run dev`

`/admin/shidasu-debug`(または直接ラン)を使い、護符・秘儀・天啓・神託・レリック・通貨を一通り所持した状態でWave3まで進め、少なくとも数回妨害を発生させて以下を確認する:
- 山札・場札・チェーン・コンボ系の妨害でゲーム状態(枚数・並び)が説明通り変化すること
- 護符・秘儀・天啓/神託・レリック系の妨害で、対象が無効化/喪失し、UIの所持表示にも反映されること(護符・秘儀・天啓は使用ボタンが封印中disabledになる、レリックはバッジが消える)
- 通貨没収で所持通貨が減ること
- 役封印で該当役のボーナスが一時的に入らなくなること

**注意**: 実プレイで狙った妨害を全て発生させるには運が絡み時間がかかることがある(過去の天啓「虚」実装時の実績を参照)。目視確認は`+page.svelte`の`run`初期化部分を一時的に`triggerSabotage`を直接呼べる状態に差し替えるか、`wave.pendingSabotageId`・`sabotageTurnsRemaining`をデバッグパネルから強制指定できるようにして確認し、確認後に差分ゼロへ戻す方式でもよい。

- [ ] **Step 5: ドキュメント更新**

`docs/shidasu/shidasu-current-rules.md`の「6. ステージ制約・手詰まり判定」または新規節に、妨害行動の概要(発動サイクル・ターン定義・封印の仕組み)を追記する。`docs/shidasu/shidasu-roadmap.md`項目3「星の妨害行動の検討」を完了済み(履歴)へ移動する(項目2を履歴へ移動した際と同じパターンで、番号付きリストから削除し履歴セクション末尾に追記、残り項目の番号を振り直す)。

- [ ] **Step 6: 最終コミット**

```bash
git add docs/shidasu/shidasu-current-rules.md docs/shidasu/shidasu-roadmap.md
git commit -m "docs: 星の妨害行動の実装完了をドキュメントに反映"
```

---

## スコープ外(このプランでは扱わない)

- 候補一覧の残り22個(各ターゲットの2〜3番目の候補)の実装
- waveSlot3以外の星への妨害行動の追加、新規の星の追加
- intervalTurns・効果の数値バランス調整
- `SABOTAGE_POOL`・星の`sabotageKind`の管理画面(`/admin/shidasu-bosses`等)への編集UI追加
- 封印中の護符・秘儀・天啓の個別バッジに「封印中」であることを視覚的に示す専用UI(ボタンのdisabled化・使用不可自体はTask 7・8で実現するが、バッジの見た目変更は対象外)
- `useRite`・`useOracle`内の`run.items`参照箇所(果断・星霜の加算判定など)への封印フィルタ適用。Task 7で`applyPlayCard`/`applyDrawStock`/`applyStuckCheck`の3経路のみ対応する
