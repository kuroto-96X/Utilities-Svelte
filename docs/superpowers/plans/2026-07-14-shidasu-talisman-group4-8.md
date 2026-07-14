# Shidasu 護符候補一覧グループ4〜8の実装(全35個) Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** `docs/shidasu-gofu-candidates.md`のグループ4〜8(35個の護符)を、既存の`ITEM_EFFECTS`レジストリに登録して実プレイで機能させる。

**Architecture:** グループ1〜3で構築した「護符効果レジストリ」パターン(`ItemEffectContext` + `ITEM_EFFECTS` + `applyItemEffects`)をそのまま使う。今回はチェーン全体・場札残数・役ボーナス成立状況・ウェーブ内初回プレイフラグを判定に使うため`ItemEffectContext`を拡張し、`evaluateChainBonus`の戻り値(`ChainBonusResult`)に「どの役ボーナス/パターンボーナスが成立したか」を構造化して追加する。ワイルドは既存の`analyzeStair`/`analyzeSuitColor`と同じ「都合の良い値として読む」方針に統一する。

**Tech Stack:** TypeScript, SvelteKit, Vitest。対象ファイルは`src/lib/game/shidasu/{types,params,engine}.ts`・`src/lib/game/shidasu/shidasu.config.json`・`src/lib/game/shidasu/engine.test.ts`・`src/routes/admin/shidasu/+page.svelte`。

---

## 前提知識(実装者向け)

- 護符効果は`ItemId`ごとに`ITEM_EFFECTS`(`src/lib/game/shidasu/engine.ts`)に登録された純粋関数`(value, ctx, params) => {value, part}`で表現する。`applyItemEffects(channel, baseValue, items, ctx, params)`が所持順(`items`配列の順)に`reduce`適用する。
- `channel: 'gained'`は`playCard`内で`gained = floor(base * multiplier)`算出直後に適用される。今回追加する35個は全て`gained`チャンネル。
- 数値パラメータは`ShidasuParams.talismans`(`src/lib/game/shidasu/params.ts`)に格納し、`DEFAULT_PARAMS`と`src/lib/game/shidasu/shidasu.config.json`の両方に同じ値を追加する(`loadParams()`は`shidasu.config.json`を読むため、片方だけ更新すると実行時に値がずれる)。
- ワイルドの解釈方針(既存の`analyzeStair`/`analyzeSuitColor`と同じ):スート/色専有条件は「矛盾する実カードが無ければ成立」、枚数カウント条件は「実枚数+ワイルド枚数」、赤黒同数条件は「`|実赤-実黒| <= ワイルド枚数`」。
- 詳細仕様は`docs/superpowers/specs/2026-07-14-shidasu-talisman-group4-8-design.md`を参照(本プランはこのspecの実装計画)。

---

### Task 1: データモデル拡張(ItemId・talismans設定・WaveState.firstPlayDone)

**Files:**
- Modify: `src/lib/game/shidasu/types.ts`(`ItemId`型、`WaveState`インターフェース)
- Modify: `src/lib/game/shidasu/params.ts`(`ShidasuParams.talismans`型、`DEFAULT_PARAMS.talismans`)
- Modify: `src/lib/game/shidasu/shidasu.config.json`(`talismans`)
- Modify: `src/lib/game/shidasu/engine.ts`(`startWave`)
- Modify: `src/lib/game/shidasu/engine.test.ts`(`makeWave`ヘルパー、新規テスト)

- [ ] **Step 1: 失敗するテストを書く(DEFAULT_PARAMS.talismansに35個分のキーが揃っているか)**

`src/lib/game/shidasu/engine.test.ts`の`describe('ITEM_POOL / ITEM_NAMES / itemDesc', ...)`ブロックの直前(838行目付近、`describe('createInitialRun / beginRun'`より前)に以下を追加する:

```ts
describe('DEFAULT_PARAMS.talismans (グループ4〜8)', () => {
  test('35個分の既定値が正しく設定されている', () => {
    expect(DEFAULT_PARAMS.talismans.calm.n).toBe(200)
    expect(DEFAULT_PARAMS.talismans.serenity.x).toBe(1.5)
    expect(DEFAULT_PARAMS.talismans.destiny.n).toBe(300)
    expect(DEFAULT_PARAMS.talismans.fate.x).toBe(2.0)
    expect(DEFAULT_PARAMS.talismans.relief.n).toBe(100)
    expect(DEFAULT_PARAMS.talismans.verdantGreen.x).toBe(3)
    expect(DEFAULT_PARAMS.talismans.gem.x).toBe(3)
    expect(DEFAULT_PARAMS.talismans.resolve.x).toBe(3)
    expect(DEFAULT_PARAMS.talismans.grail.x).toBe(3)
    expect(DEFAULT_PARAMS.talismans.moonlight.x).toBe(1.5)
    expect(DEFAULT_PARAMS.talismans.sunlight.x).toBe(1.5)
    expect(DEFAULT_PARAMS.talismans.crown.x).toBe(0.5)
    expect(DEFAULT_PARAMS.talismans.cloverLeaf.n).toBe(50)
    expect(DEFAULT_PARAMS.talismans.coin.n).toBe(50)
    expect(DEFAULT_PARAMS.talismans.blade.n).toBe(50)
    expect(DEFAULT_PARAMS.talismans.chalice.n).toBe(50)
    expect(DEFAULT_PARAMS.talismans.balance.n).toBe(200)
    expect(DEFAULT_PARAMS.talismans.harmony.x).toBe(1.5)
    expect(DEFAULT_PARAMS.talismans.nobility.n).toBe(200)
    expect(DEFAULT_PARAMS.talismans.tenacity.x).toBe(0.1)
    expect(DEFAULT_PARAMS.talismans.determination.x).toBe(0.1)
    expect(DEFAULT_PARAMS.talismans.cycle.x).toBe(3)
    expect(DEFAULT_PARAMS.talismans.reincarnation.x).toBe(10)
    expect(DEFAULT_PARAMS.talismans.majesty.x).toBe(50)
    expect(DEFAULT_PARAMS.talismans.omen.m).toBe(20)
    expect(DEFAULT_PARAMS.talismans.omen.x).toBe(1.5)
    expect(DEFAULT_PARAMS.talismans.crescent.m).toBe(10)
    expect(DEFAULT_PARAMS.talismans.crescent.x).toBe(3)
    expect(DEFAULT_PARAMS.talismans.blessing.x).toBe(1.5)
    expect(DEFAULT_PARAMS.talismans.focus.x).toBe(3)
    expect(DEFAULT_PARAMS.talismans.lapis.x).toBe(2)
    expect(DEFAULT_PARAMS.talismans.jade.n).toBe(200)
    expect(DEFAULT_PARAMS.talismans.emptyMind.x).toBe(4)
    expect(DEFAULT_PARAMS.talismans.prologue.n).toBe(500)
    expect(DEFAULT_PARAMS.talismans.interlude.m).toBe(5)
    expect(DEFAULT_PARAMS.talismans.interlude.n).toBe(1000)
    expect(DEFAULT_PARAMS.talismans.morningDew.n).toBe(5000)
    expect(DEFAULT_PARAMS.talismans.drizzle.n).toBe(50)
  })
})
```

- [ ] **Step 2: テストを実行して失敗を確認**

Run: `npm run test -- engine.test.ts`
Expected: FAIL(TypeScriptの型エラー、または`DEFAULT_PARAMS.talismans.calm`が`undefined`)

- [ ] **Step 3: `ItemId`型に35個のidを追加**

`src/lib/game/shidasu/types.ts`の`ItemId`型定義を以下に置き換える:

```ts
export type ItemId =
  | 'bridge' | 'grace'
  | 'patience' | 'purify' | 'temperance'
  | 'springBreeze' | 'summerBreeze' | 'autumnBreeze' | 'winterBreeze'
  | 'kinship' | 'thaw' | 'dusk' | 'dawn' | 'wit'
  | 'courage' | 'daybreak' | 'twilight' | 'cheerful' | 'conscience' | 'morningMist'
  | 'calm' | 'serenity' | 'destiny' | 'fate' | 'relief'
  | 'verdantGreen' | 'gem' | 'resolve' | 'grail' | 'moonlight' | 'sunlight'
  | 'crown' | 'cloverLeaf' | 'coin' | 'blade' | 'chalice' | 'balance' | 'harmony'
  | 'nobility' | 'tenacity' | 'determination' | 'cycle' | 'reincarnation' | 'majesty'
  | 'omen' | 'crescent'
  | 'blessing' | 'focus' | 'lapis' | 'jade' | 'emptyMind'
  | 'prologue' | 'interlude' | 'morningDew'
  | 'drizzle'
```

- [ ] **Step 4: `WaveState`に`firstPlayDone`フィールドを追加**

`src/lib/game/shidasu/types.ts`の`WaveState`インターフェース内、`lastGain: ScoreGain | null`の直後に追加:

```ts
export interface WaveState {
  tableau: Card[][]
  stock: Card[]
  foundation: Card
  score: number
  combo: number
  chain: Card[]
  chainOrigin: ChainCardOrigin[]
  linked: boolean
  columnsEmptiedThisCombo: number
  comboStreakColumnLengths: number[]
  lastDrawEffect: DrawEffect
  status: WaveStatus
  endReason: WaveEndReason
  lastGain: ScoreGain | null
  // ウェーブ開始後、一度でも場札をプレイしたか(朝露の護符の判定に使用。山札めくりでは変化しない)
  firstPlayDone: boolean
}
```

- [ ] **Step 5: `ShidasuParams.talismans`型に35個分を追加**

`src/lib/game/shidasu/params.ts`の`ShidasuParams`インターフェース内、`talismans`オブジェクトの`morningMist: { c: number; x: number }`の直後に追加:

```ts
    morningMist: { c: number; x: number }
    calm: { n: number }
    serenity: { x: number }
    destiny: { n: number }
    fate: { x: number }
    relief: { n: number }
    verdantGreen: { x: number }
    gem: { x: number }
    resolve: { x: number }
    grail: { x: number }
    moonlight: { x: number }
    sunlight: { x: number }
    crown: { x: number }
    cloverLeaf: { n: number }
    coin: { n: number }
    blade: { n: number }
    chalice: { n: number }
    balance: { n: number }
    harmony: { x: number }
    nobility: { n: number }
    tenacity: { x: number }
    determination: { x: number }
    cycle: { x: number }
    reincarnation: { x: number }
    majesty: { x: number }
    omen: { m: number; x: number }
    crescent: { m: number; x: number }
    blessing: { x: number }
    focus: { x: number }
    lapis: { x: number }
    jade: { n: number }
    emptyMind: { x: number }
    prologue: { n: number }
    interlude: { m: number; n: number }
    morningDew: { n: number }
    drizzle: { n: number }
```

- [ ] **Step 6: `DEFAULT_PARAMS.talismans`に35個分の既定値を追加**

`src/lib/game/shidasu/params.ts`の`DEFAULT_PARAMS.talismans`オブジェクト内、`morningMist: { c: 5, x: 3 },`の直後に追加:

```ts
    morningMist: { c: 5, x: 3 },
    calm: { n: 200 },
    serenity: { x: 1.5 },
    destiny: { n: 300 },
    fate: { x: 2.0 },
    relief: { n: 100 },
    verdantGreen: { x: 3 },
    gem: { x: 3 },
    resolve: { x: 3 },
    grail: { x: 3 },
    moonlight: { x: 1.5 },
    sunlight: { x: 1.5 },
    crown: { x: 0.5 },
    cloverLeaf: { n: 50 },
    coin: { n: 50 },
    blade: { n: 50 },
    chalice: { n: 50 },
    balance: { n: 200 },
    harmony: { x: 1.5 },
    nobility: { n: 200 },
    tenacity: { x: 0.1 },
    determination: { x: 0.1 },
    cycle: { x: 3 },
    reincarnation: { x: 10 },
    majesty: { x: 50 },
    omen: { m: 20, x: 1.5 },
    crescent: { m: 10, x: 3 },
    blessing: { x: 1.5 },
    focus: { x: 3 },
    lapis: { x: 2 },
    jade: { n: 200 },
    emptyMind: { x: 4 },
    prologue: { n: 500 },
    interlude: { m: 5, n: 1000 },
    morningDew: { n: 5000 },
    drizzle: { n: 50 },
```

- [ ] **Step 7: `shidasu.config.json`にも同じ35個分を追加**

`src/lib/game/shidasu/shidasu.config.json`の`talismans`オブジェクト内、`"morningMist": { "c": 5, "x": 3 }`を以下に置き換える(直後にカンマと35個分を追加):

```json
    "morningMist": { "c": 5, "x": 3 },
    "calm": { "n": 200 },
    "serenity": { "x": 1.5 },
    "destiny": { "n": 300 },
    "fate": { "x": 2.0 },
    "relief": { "n": 100 },
    "verdantGreen": { "x": 3 },
    "gem": { "x": 3 },
    "resolve": { "x": 3 },
    "grail": { "x": 3 },
    "moonlight": { "x": 1.5 },
    "sunlight": { "x": 1.5 },
    "crown": { "x": 0.5 },
    "cloverLeaf": { "n": 50 },
    "coin": { "n": 50 },
    "blade": { "n": 50 },
    "chalice": { "n": 50 },
    "balance": { "n": 200 },
    "harmony": { "x": 1.5 },
    "nobility": { "n": 200 },
    "tenacity": { "x": 0.1 },
    "determination": { "x": 0.1 },
    "cycle": { "x": 3 },
    "reincarnation": { "x": 10 },
    "majesty": { "x": 50 },
    "omen": { "m": 20, "x": 1.5 },
    "crescent": { "m": 10, "x": 3 },
    "blessing": { "x": 1.5 },
    "focus": { "x": 3 },
    "lapis": { "x": 2 },
    "jade": { "n": 200 },
    "emptyMind": { "x": 4 },
    "prologue": { "n": 500 },
    "interlude": { "m": 5, "n": 1000 },
    "morningDew": { "n": 5000 },
    "drizzle": { "n": 50 }
```

- [ ] **Step 8: `startWave`で`firstPlayDone: false`を初期化**

`src/lib/game/shidasu/engine.ts`の`startWave`関数の戻り値オブジェクト内、`lastGain: null,`の直後に追加:

```ts
    lastGain: null,
    firstPlayDone: false,
```

- [ ] **Step 9: `makeWave`テストヘルパーにも`firstPlayDone: false`を追加**

`src/lib/game/shidasu/engine.test.ts`の`makeWave`関数(76行目付近)内、`lastGain: null,`の直後に追加:

```ts
    lastGain: null,
    firstPlayDone: false,
```

- [ ] **Step 10: テストを実行して成功を確認**

Run: `npm run test -- engine.test.ts`
Expected: PASS(`DEFAULT_PARAMS.talismans (グループ4〜8)`のテストが通る。既存テストも全てPASSのままであること)

Run: `npm run build`
Expected: 型エラーなく成功(この時点では`ITEM_EFFECTS`に35個の効果は未登録なので、`ItemId`は増えたが`ITEM_POOL`未追加のため実プレイには現れない)

- [ ] **Step 11: コミット**

```bash
git add src/lib/game/shidasu/types.ts src/lib/game/shidasu/params.ts src/lib/game/shidasu/shidasu.config.json src/lib/game/shidasu/engine.ts src/lib/game/shidasu/engine.test.ts
git commit -m "$(cat <<'EOF'
feat: Shidasu護符グループ4〜8のデータモデル(ItemId・talismans設定・firstPlayDone)を追加

グループ4〜8(35個)の護符idとパラメータの型・既定値を追加した。
WaveStateに朝露判定用のfirstPlayDoneフラグも追加。
ITEM_EFFECTSへの効果登録は後続タスクで行う。
EOF
)"
```

---

### Task 2: 護符効果基盤の拡張(ItemEffectContext・ChainBonusResult・evaluateChainBonus・stairUsesKALoop)

**Files:**
- Modify: `src/lib/game/shidasu/engine.ts`
- Modify: `src/lib/game/shidasu/engine.test.ts`

- [ ] **Step 1: 失敗するテストを書く(stairUsesKALoopの境界越え判定)**

`src/lib/game/shidasu/engine.test.ts`の`describe('chainContinuesPattern', ...)`ブロックの直後(450行目付近)に以下を追加する:

```ts
describe('stairUsesKALoop', () => {
  test('実カード同士が隣接してK→A(13→1)を跨ぐ場合はtrue', () => {
    const chain = [card(1, '♠', 12), card(2, '♠', 13), card(3, '♠', 1), card(4, '♠', 2)]
    expect(stairUsesKALoop(chain)).toBe(true)
  })

  test('ワイルドで橋渡しされた区間の内側でK→Aを跨ぐ場合もtrue', () => {
    const chain = [card(1, '♠', 12), card(2, '★', 0, true), card(3, '★', 0, true), card(4, '♠', 2)]
    expect(stairUsesKALoop(chain)).toBe(true)
  })

  test('境界を跨がない階段はfalse', () => {
    const chain = [card(1, '♠', 3), card(2, '♠', 4), card(3, '♠', 5)]
    expect(stairUsesKALoop(chain)).toBe(false)
  })

  test('階段が成立していなければfalse', () => {
    const chain = [card(1, '♠', 3), card(2, '♠', 9)]
    expect(stairUsesKALoop(chain)).toBe(false)
  })

  test('実カードが2枚未満なら比較対象が無く都合よくtrueとみなす', () => {
    expect(stairUsesKALoop([card(1, '★', 0, true), card(2, '★', 0, true)])).toBe(true)
  })
})

describe('evaluateChainBonus (patternFired/roleFired)', () => {
  const scoring = DEFAULT_PARAMS.scoring

  test('同スートパターン成立時はpatternFired=trueになる', () => {
    const result = evaluateChainBonus(scoring, [card(1, '♠', 3), card(2, '♠', 5)], card(3, '♠', 9))
    expect(result.patternFired).toBe(true)
    expect(result.roleFired).toEqual([])
  })

  test('フラッシュ成立時、実カードだけで4スート揃っていればusedWild=false', () => {
    const chainBefore = [card(1, '♠', 1), card(2, '♥', 2), card(3, '♦', 3)]
    const result = evaluateChainBonus(scoring, chainBefore, card(4, '♣', 4))
    const flush = result.roleFired.find(r => r.name === 'flush')
    expect(flush?.usedWild).toBe(false)
  })

  test('フラッシュ成立時、ワイルドで穴埋めしていればusedWild=true', () => {
    const chainBefore = [card(1, '♠', 1), card(2, '★', 0, true), card(3, '♦', 3)]
    const result = evaluateChainBonus(scoring, chainBefore, card(4, '♣', 4))
    const flush = result.roleFired.find(r => r.name === 'flush')
    expect(flush?.usedWild).toBe(true)
  })

  test('役もパターンも成立しなければpatternFired=false・roleFired=[]', () => {
    const result = evaluateChainBonus(scoring, [card(1, '♠', 2)], card(2, '♥', 9))
    expect(result.patternFired).toBe(false)
    expect(result.roleFired).toEqual([])
  })
})
```

- [ ] **Step 2: テストを実行して失敗を確認**

Run: `npm run test -- engine.test.ts`
Expected: FAIL(`stairUsesKALoop`が存在しない、`evaluateChainBonus`の戻り値に`patternFired`/`roleFired`が無い)

- [ ] **Step 3: `RoleName`型と`ChainBonusResult`を拡張**

`src/lib/game/shidasu/engine.ts`の現在の`ChainBonusResult`定義(691〜694行目)を以下に置き換える:

```ts
export type RoleName = 'flush' | 'royalSet' | 'sameRank' | 'completeRun' | 'columnSweep'

export interface ChainBonusResult {
  bonus: number
  parts: string[]
  patternFired: boolean
  roleFired: { name: RoleName; usedWild: boolean }[]
}
```

- [ ] **Step 4: `evaluateChainBonus`を書き換え、patternFired/roleFiredを追跡**

`src/lib/game/shidasu/engine.ts`の`evaluateChainBonus`関数全体を以下に置き換える:

```ts
export function evaluateChainBonus(
  scoring: ShidasuParams['scoring'],
  chainBefore: Card[],
  card: Card,
  stairMinLen: number = scoring.stairMinLen
): ChainBonusResult {
  if (chainBefore.length === 0) {
    return { bonus: 0, parts: [], patternFired: false, roleFired: [] }
  }

  let bonus = 0
  const parts: string[] = []
  let patternFired = false
  const roleFired: { name: RoleName; usedWild: boolean }[] = []

  const chainIncludingThis = [...chainBefore, card]

  const { suitHeld, colorHeld } = analyzeSuitColor(chainIncludingThis)
  if (chainIncludingThis.length >= scoring.suitColorMinLen) {
    if (suitHeld) {
      bonus += scoring.suitBonus
      parts.push(`同スート+${scoring.suitBonus}`)
      patternFired = true
    } else if (colorHeld) {
      bonus += scoring.colorBonus
      parts.push(`同色+${scoring.colorBonus}`)
      patternFired = true
    }
  }

  const stairInfo = analyzeStair(chainIncludingThis)
  if (stairInfo.held && stairInfo.len >= stairMinLen) {
    bonus += scoring.stairBonus
    parts.push(`階段${stairInfo.len} +${scoring.stairBonus}`)
    patternFired = true
  }

  if (checkFlush(chainIncludingThis)) {
    bonus += scoring.flushBonus
    parts.push(`フラッシュ+${scoring.flushBonus}`)
    const last4 = chainIncludingThis.slice(-4)
    const realSuits = new Set(last4.filter(c => !c.wild).map(c => c.suit))
    const flushUsedWild = ALL_SUITS_REAL.some(s => !realSuits.has(s))
    roleFired.push({ name: 'flush', usedWild: flushUsedWild })
  }

  if (checkRoyalSet(chainIncludingThis)) {
    bonus += scoring.royalSetBonus
    parts.push(`ロイヤル+${scoring.royalSetBonus}`)
    const last3 = chainIncludingThis.slice(-3)
    const realRanks = new Set(last3.filter(c => !c.wild).map(c => c.rank))
    const requiredRanks: Card['rank'][] = [11, 12, 13]
    const royalSetUsedWild = requiredRanks.some(r => !realRanks.has(r))
    roleFired.push({ name: 'royalSet', usedWild: royalSetUsedWild })
  }

  const sameRankCount = card.wild ? countSameRankForWildPlay(chainBefore) : countSameRankBefore(chainBefore, card.rank)
  if (sameRankCount > 0) {
    const sameRankGain = scoring.sameRankBonusUnit * sameRankCount
    bonus += sameRankGain
    parts.push(`同ランク+${sameRankGain}`)
    const sameRankUsedWild = card.wild || chainBefore.some(c => c.wild)
    roleFired.push({ name: 'sameRank', usedWild: sameRankUsedWild })
  }

  if (checkCompleteRun(chainBefore, chainIncludingThis)) {
    bonus += scoring.completeRunBonus
    parts.push(`コンプリートラン+${scoring.completeRunBonus}`)
    const distinctRealNow = new Set(chainIncludingThis.filter(c => !c.wild).map(c => c.rank)).size
    const wildCountNow = chainIncludingThis.filter(c => c.wild).length
    const completeRunUsedWild = distinctRealNow < 13 && wildCountNow > 0
    roleFired.push({ name: 'completeRun', usedWild: completeRunUsedWild })
    if (suitHeld) {
      bonus += scoring.completeRunSuitBonus
      parts.push(`コンプリートラン(同スート)+${scoring.completeRunSuitBonus}`)
    }
  }

  return { bonus, parts, patternFired, roleFired }
}
```

- [ ] **Step 5: `stairUsesKALoop`ヘルパーを追加**

`src/lib/game/shidasu/engine.ts`の`analyzeStair`関数の直後(636行目、`const ALL_SUITS_REAL`の直前)に追加:

```ts
// 階段のチェーンが13→1、または1→13の境界を跨いだか(ワイルドで橋渡しされた区間内の越境も検出する)
export function stairUsesKALoop(chain: Card[]): boolean {
  const analysis = analyzeStair(chain)
  if (!analysis.held || analysis.dir === 0) return false
  const realPositions = chain.map((c, i) => ({ card: c, index: i })).filter(p => !p.card.wild)
  if (realPositions.length < 2) return true
  for (let k = 1; k < realPositions.length; k++) {
    const prev = realPositions[k - 1]
    const curr = realPositions[k]
    const gap = curr.index - prev.index
    if (analysis.dir === 1 && prev.card.rank + gap > 13) return true
    if (analysis.dir === -1 && prev.card.rank - gap < 1) return true
  }
  return false
}
```

- [ ] **Step 6: `ItemEffectContext`を拡張**

`src/lib/game/shidasu/engine.ts`の現在の`ItemEffectContext`定義(220〜225行目)を以下に置き換える:

```ts
export interface ItemEffectContext {
  card: Card
  previousFoundation: Card
  combo: number
  stockRemaining: number
  chain: Card[]
  remainingTableauCount: number
  chainBonus: ChainBonusResult
  isFirstPlayOfWave: boolean
  effectiveStairMinLen: number
}
```

- [ ] **Step 7: 既存の`applyItemEffects`テスト用`ctx()`ヘルパーを新フィールド込みに更新**

`src/lib/game/shidasu/engine.test.ts`の`describe('applyItemEffects', ...)`ブロック内の`ctx()`関数を以下に置き換える(グループ1〜3のテストが新フィールドを使わなくても動くよう、デフォルト値を補うだけの変更):

```ts
    function ctx(overrides: Partial<ItemEffectContext> = {}): ItemEffectContext {
      return {
        card: card(1, '♠', 5),
        previousFoundation: card(2, '♣', 4),
        combo: 1,
        stockRemaining: 0,
        chain: [card(2, '♣', 4), card(1, '♠', 5)],
        remainingTableauCount: 10,
        chainBonus: { bonus: 0, parts: [], patternFired: false, roleFired: [] },
        isFirstPlayOfWave: false,
        effectiveStairMinLen: params.scoring.stairMinLen,
        ...overrides,
      }
    }
```

このファイル冒頭のimport文に`ItemEffectContext`が無ければ追加する(`import { ..., type ItemEffectContext } from './engine'`のように、既存の`import`文に型を追加する)。

- [ ] **Step 8: テストを実行して成功を確認**

Run: `npm run test -- engine.test.ts`
Expected: PASS(全テスト)

Run: `npm run build`
Expected: 型エラーなく成功

- [ ] **Step 9: コミット**

```bash
git add src/lib/game/shidasu/engine.ts src/lib/game/shidasu/engine.test.ts
git commit -m "$(cat <<'EOF'
feat: Shidasu護符効果基盤にchain/roleFired/patternFiredを追加

ItemEffectContextにchain・remainingTableauCount・chainBonus・
isFirstPlayOfWave・effectiveStairMinLenを追加し、evaluateChainBonusが
成立した役ボーナス/パターンボーナスを構造化して返すよう拡張した。
K↔Aループ判定用のstairUsesKALoopヘルパーも追加。
EOF
)"
```

---

### Task 3: playCardへの組み込み(コンテキスト構築・firstPlayDone更新)

**Files:**
- Modify: `src/lib/game/shidasu/engine.ts`
- Modify: `src/lib/game/shidasu/engine.test.ts`

- [ ] **Step 1: 失敗するテストを書く(lastGainのpartsではなく、朝露判定用のfirstPlayDoneが更新されることを確認)**

`src/lib/game/shidasu/engine.test.ts`の`describe('playCard', ...)`ブロック内、`test('カードを取るとlastDrawEffectがクリアされる', ...)`の直後に追加:

```ts
  test('プレイするとfirstPlayDoneがtrueになる(ウェーブ開始直後はfalse)', () => {
    const wave = baseWave({ tableau: [[card(9, '♠', 1), card(1, '♣', 6)], [card(2, '♦', 2)]] })
    expect(wave.firstPlayDone).toBe(false)
    const next = playCard(DEFAULT_PARAMS, wave, 'none', [], 1000000, 0)
    expect(next.firstPlayDone).toBe(true)
  })
```

- [ ] **Step 2: テストを実行して失敗を確認**

Run: `npm run test -- engine.test.ts`
Expected: FAIL(`next.firstPlayDone`が`undefined`。`baseWave`のデフォルトは`makeWave`経由で`firstPlayDone: false`になっているはずなので、1つ目の`expect`はTask1の時点で既にPASSしているはずだが、2つ目の`expect`が失敗する)

- [ ] **Step 3: `playCard`内の変数計算順序を並べ替え、`chainIncludingThis`と`remaining`を早期に計算**

`src/lib/game/shidasu/engine.ts`の`playCard`関数を以下に置き換える(既存の97〜167行目相当):

```ts
export function playCard(
  params: ShidasuParams,
  wave: WaveState,
  modifier: StageModifier,
  items: ItemId[],
  target: number,
  colIndex: number
): WaveState {
  if (wave.status !== 'playing') return wave
  const col = wave.tableau[colIndex]
  const card = col?.[col.length - 1]
  if (!card) return wave
  if (!isPlayable(modifier, wave, card)) return wave

  const newCombo = wave.combo + 1
  let base = params.scoring.basePoint
  const parts = [`基礎点+${base}`]

  const effectiveStairMinLen = items.includes('bridge') ? params.items.stairRelaxedMinLen : params.scoring.stairMinLen
  const chainResult = evaluateChainBonus(params.scoring, wave.chain, card, effectiveStairMinLen)
  base += chainResult.bonus
  parts.push(...chainResult.parts)

  const chainIncludingThis = [...wave.chain, card]

  const newTableau = wave.tableau.map((c, i) => (i === colIndex ? c.slice(0, -1) : c))
  const columnJustEmptied = newTableau[colIndex].length === 0
  const streakStartLength = wave.comboStreakColumnLengths[colIndex]
  const rows = params.layout.rows
  const sweepQualifies = columnJustEmptied && (
    items.includes('grace')
      ? streakStartLength <= rows - params.items.columnSweepRelaxCards
      : streakStartLength === rows
  )
  const newColumnsEmptied = sweepQualifies ? wave.columnsEmptiedThisCombo + 1 : wave.columnsEmptiedThisCombo
  const roleFired = [...chainResult.roleFired]
  if (sweepQualifies) {
    const sweepGain = params.scoring.columnSweepBonus * newColumnsEmptied
    base += sweepGain
    parts.push(`列一掃+${sweepGain}`)
    roleFired.push({ name: 'columnSweep', usedWild: false })
  }

  const remaining = remainingCount(newTableau)

  const itemEffectCtx: ItemEffectContext = {
    card,
    previousFoundation: wave.foundation,
    combo: newCombo,
    stockRemaining: wave.stock.length,
    chain: chainIncludingThis,
    remainingTableauCount: remaining,
    chainBonus: { ...chainResult, roleFired },
    isFirstPlayOfWave: !wave.firstPlayDone,
    effectiveStairMinLen,
  }

  const comboMultiplierStep = params.scoring.comboMultiplierStep
  const multiplier = 1 + (newCombo - 1) * comboMultiplierStep
  if (multiplier !== 1) parts.push(`コンボ倍率×${fmtMultiplier(multiplier)}`)
  const rawGained = Math.floor(base * multiplier)
  const itemResult = applyItemEffects('gained', rawGained, items, itemEffectCtx, params)
  parts.push(...itemResult.parts)
  const gained = Math.floor(itemResult.value)

  const newScore = wave.score + gained

  const next: WaveState = {
    ...wave,
    tableau: newTableau,
    foundation: card,
    combo: newCombo,
    chain: [...wave.chain, card],
    chainOrigin: [...wave.chainOrigin, 'play'],
    linked: true,
    columnsEmptiedThisCombo: newColumnsEmptied,
    // コンボが継続する間はこのスナップショットを維持する。列の残り枚数が変化しても、
    // 次にdrawStockでコンボがリセットされるまでは更新しない。
    comboStreakColumnLengths: wave.comboStreakColumnLengths,
    lastDrawEffect: null,
    score: newScore,
    lastGain: { points: gained, parts },
    status: 'playing',
    endReason: null,
    firstPlayDone: true,
  }

  if (remaining === 0) {
    const rawClearBonus = params.scoring.clearBonus + wave.stock.length * params.scoring.clearBonusPerStock
    const clearBonus = Math.floor(applyItemEffects('clearBonus', rawClearBonus, items, itemEffectCtx, params).value)
    return { ...next, score: newScore + clearBonus, status: 'ended', endReason: 'fullClear' }
  }

  if (newScore >= target) {
    return { ...next, status: 'ended', endReason: 'target' }
  }

  return next
}
```

- [ ] **Step 4: テストを実行して成功を確認**

Run: `npm run test -- engine.test.ts`
Expected: PASS(全テスト。既存の`lastGain.parts`関連テストも、`parts`の構築順序自体は変えていないので影響を受けない)

Run: `npm run build`
Expected: 型エラーなく成功

- [ ] **Step 5: コミット**

```bash
git add src/lib/game/shidasu/engine.ts src/lib/game/shidasu/engine.test.ts
git commit -m "$(cat <<'EOF'
feat: playCardでchain/remainingTableauCount/chainBonus/firstPlayDoneを配線

ItemEffectContextの新フィールドをplayCard内で構築し、
プレイ後にWaveState.firstPlayDoneをtrueにするよう変更した。
グループ4〜8の護符効果は次タスク以降でITEM_EFFECTSに登録する。
EOF
)"
```

---

### Task 4: グループ4-a 絵札条件系(平穏・安寧・運命・宿命・安堵、5個)

**Files:**
- Modify: `src/lib/game/shidasu/engine.ts`(`ITEM_EFFECTS`、`ITEM_NAMES`、`itemDesc`)
- Modify: `src/lib/game/shidasu/engine.test.ts`

- [ ] **Step 1: 失敗するテストを書く**

`src/lib/game/shidasu/engine.test.ts`の末尾(ファイル最後、既存の`describe('chainContinuesPattern', ...)`ブロックより後)に追加:

```ts
describe('applyItemEffects (グループ4-a: 絵札条件系)', () => {
  const params = DEFAULT_PARAMS
  function ctx(overrides: Partial<ItemEffectContext> = {}): ItemEffectContext {
    return {
      card: card(1, '♠', 5),
      previousFoundation: card(2, '♣', 4),
      combo: 1,
      stockRemaining: 0,
      chain: [card(2, '♣', 4), card(1, '♠', 5)],
      remainingTableauCount: 10,
      chainBonus: { bonus: 0, parts: [], patternFired: false, roleFired: [] },
      isFirstPlayOfWave: false,
      effectiveStairMinLen: params.scoring.stairMinLen,
      ...overrides,
    }
  }

  test('平穏: チェーンにJQKが無ければ加算、絵札が混ざれば不発動', () => {
    const fired = applyItemEffects('gained', 100, ['calm'], ctx({ chain: [card(1, '♠', 5), card(2, '♦', 8)] }), params)
    expect(fired.value).toBe(100 + params.talismans.calm.n)
    const notFired = applyItemEffects('gained', 100, ['calm'], ctx({ chain: [card(1, '♠', 5), card(2, '♦', 12)] }), params)
    expect(notFired.value).toBe(100)
  })

  test('安寧: チェーンにJQKが無ければ倍算', () => {
    const result = applyItemEffects('gained', 100, ['serenity'], ctx({ chain: [card(1, '♠', 5), card(2, '♦', 8)] }), params)
    expect(result.value).toBe(100 * params.talismans.serenity.x)
  })

  test('運命: チェーンがJQKのみなら加算、非絵札が混ざれば不発動', () => {
    const fired = applyItemEffects('gained', 100, ['destiny'], ctx({ chain: [card(1, '♠', 11), card(2, '♦', 13)] }), params)
    expect(fired.value).toBe(100 + params.talismans.destiny.n)
    const notFired = applyItemEffects('gained', 100, ['destiny'], ctx({ chain: [card(1, '♠', 11), card(2, '♦', 5)] }), params)
    expect(notFired.value).toBe(100)
  })

  test('宿命: チェーンがJQKのみなら倍算', () => {
    const result = applyItemEffects('gained', 100, ['fate'], ctx({ chain: [card(1, '♠', 11), card(2, '♦', 13)] }), params)
    expect(result.value).toBe(100 * params.talismans.fate.x)
  })

  test('安堵: 取得したカードのランクが1〜10なら加算、ワイルドなら都合よく発動、絵札なら不発動', () => {
    const numberCard = applyItemEffects('gained', 100, ['relief'], ctx({ card: card(1, '♠', 7) }), params)
    expect(numberCard.value).toBe(100 + params.talismans.relief.n)
    const wildCard = applyItemEffects('gained', 100, ['relief'], ctx({ card: card(1, '★', 0, true) }), params)
    expect(wildCard.value).toBe(100 + params.talismans.relief.n)
    const faceCard = applyItemEffects('gained', 100, ['relief'], ctx({ card: card(1, '♠', 12) }), params)
    expect(faceCard.value).toBe(100)
  })
})
```

- [ ] **Step 2: テストを実行して失敗を確認**

Run: `npm run test -- engine.test.ts`
Expected: FAIL(`calm`等が`ITEM_EFFECTS`に未登録のため、効果が適用されず`value`が`100`のまま)

- [ ] **Step 3: `chainHasNoFace`/`chainIsFaceOnly`ヘルパーと5個の効果を`ITEM_EFFECTS`に追加**

`src/lib/game/shidasu/engine.ts`の`ITEM_EFFECTS`定義の直前(234行目、`const ITEM_EFFECTS: ...`の直前)に追加:

```ts
function chainHasNoFace(chain: Card[]): boolean {
  return chain.every(c => c.wild || !isFace(c))
}
function chainIsFaceOnly(chain: Card[]): boolean {
  return chain.every(c => c.wild || isFace(c))
}
```

`ITEM_EFFECTS`オブジェクト内、`morningMist`エントリの直後(356行目、閉じ`}`の直前)に追加:

```ts
  calm: {
    channel: 'gained',
    effect: (v, ctx, p) =>
      chainHasNoFace(ctx.chain) ? { value: v + p.talismans.calm.n, part: `平穏+${p.talismans.calm.n}` } : { value: v, part: null },
  },
  serenity: {
    channel: 'gained',
    effect: (v, ctx, p) => {
      if (!chainHasNoFace(ctx.chain)) return { value: v, part: null }
      const factor = p.talismans.serenity.x
      return { value: v * factor, part: `安寧×${fmtMultiplier(factor)}` }
    },
  },
  destiny: {
    channel: 'gained',
    effect: (v, ctx, p) =>
      chainIsFaceOnly(ctx.chain) ? { value: v + p.talismans.destiny.n, part: `運命+${p.talismans.destiny.n}` } : { value: v, part: null },
  },
  fate: {
    channel: 'gained',
    effect: (v, ctx, p) => {
      if (!chainIsFaceOnly(ctx.chain)) return { value: v, part: null }
      const factor = p.talismans.fate.x
      return { value: v * factor, part: `宿命×${fmtMultiplier(factor)}` }
    },
  },
  relief: {
    channel: 'gained',
    effect: (v, ctx, p) =>
      ctx.card.wild || (ctx.card.rank >= 1 && ctx.card.rank <= 10)
        ? { value: v + p.talismans.relief.n, part: `安堵+${p.talismans.relief.n}` }
        : { value: v, part: null },
  },
```

- [ ] **Step 4: `ITEM_NAMES`に5個分を追加**

`src/lib/game/shidasu/engine.ts`の`ITEM_NAMES`オブジェクト内、`morningMist: '朝霧の護符',`の直後に追加:

```ts
  morningMist: '朝霧の護符',
  calm: '平穏の護符',
  serenity: '安寧の護符',
  destiny: '運命の護符',
  fate: '宿命の護符',
  relief: '安堵の護符',
```

- [ ] **Step 5: `itemDesc`に5個分を追加**

`src/lib/game/shidasu/engine.ts`の`itemDesc`関数内、`case 'morningMist': ...`の直後に追加:

```ts
    case 'calm': return `コンボ内にJQKが無いとき、${params.talismans.calm.n}点加算`
    case 'serenity': return `コンボ内にJQKが無いとき、獲得点を${params.talismans.serenity.x}倍`
    case 'destiny': return `コンボ内がJQKのみのとき、${params.talismans.destiny.n}点加算`
    case 'fate': return `コンボ内がJQKのみのとき、獲得点を${params.talismans.fate.x}倍`
    case 'relief': return `取得したカード1枚のランクが1〜10のとき、${params.talismans.relief.n}点加算`
```

- [ ] **Step 6: テストを実行して成功を確認**

Run: `npm run test -- engine.test.ts`
Expected: PASS

- [ ] **Step 7: コミット**

```bash
git add src/lib/game/shidasu/engine.ts src/lib/game/shidasu/engine.test.ts
git commit -m "$(cat <<'EOF'
feat: Shidasu護符に平穏・安寧・運命・宿命・安堵(グループ4-a)を追加
EOF
)"
```

---

### Task 5: グループ4-b スート/色専有系(深緑・宝石・真剣・聖杯・月光・陽光、6個)

**Files:**
- Modify: `src/lib/game/shidasu/engine.ts`
- Modify: `src/lib/game/shidasu/engine.test.ts`

- [ ] **Step 1: 失敗するテストを書く**

`src/lib/game/shidasu/engine.test.ts`の末尾に追加:

```ts
describe('applyItemEffects (グループ4-b: スート/色専有系)', () => {
  const params = DEFAULT_PARAMS
  function ctx(overrides: Partial<ItemEffectContext> = {}): ItemEffectContext {
    return {
      card: card(1, '♠', 5),
      previousFoundation: card(2, '♣', 4),
      combo: 1,
      stockRemaining: 0,
      chain: [card(2, '♣', 4), card(1, '♠', 5)],
      remainingTableauCount: 10,
      chainBonus: { bonus: 0, parts: [], patternFired: false, roleFired: [] },
      isFirstPlayOfWave: false,
      effectiveStairMinLen: params.scoring.stairMinLen,
      ...overrides,
    }
  }

  test('深緑: ♣専有チェーンで倍算、他スートが混ざれば不発動、全ワイルドでも都合よく発動', () => {
    const pure = applyItemEffects('gained', 100, ['verdantGreen'], ctx({ chain: [card(1, '♣', 3), card(2, '♣', 5)] }), params)
    expect(pure.value).toBe(100 * params.talismans.verdantGreen.x)
    const mixed = applyItemEffects('gained', 100, ['verdantGreen'], ctx({ chain: [card(1, '♣', 3), card(2, '♦', 5)] }), params)
    expect(mixed.value).toBe(100)
    const allWild = applyItemEffects('gained', 100, ['verdantGreen'], ctx({ chain: [card(1, '★', 0, true), card(2, '★', 0, true)] }), params)
    expect(allWild.value).toBe(100 * params.talismans.verdantGreen.x)
  })

  test('宝石: ♦専有チェーンで倍算', () => {
    const result = applyItemEffects('gained', 100, ['gem'], ctx({ chain: [card(1, '♦', 3), card(2, '♦', 5)] }), params)
    expect(result.value).toBe(100 * params.talismans.gem.x)
  })

  test('真剣: ♠専有チェーンで倍算', () => {
    const result = applyItemEffects('gained', 100, ['resolve'], ctx({ chain: [card(1, '♠', 3), card(2, '♠', 5)] }), params)
    expect(result.value).toBe(100 * params.talismans.resolve.x)
  })

  test('聖杯: ♥専有チェーンで倍算', () => {
    const result = applyItemEffects('gained', 100, ['grail'], ctx({ chain: [card(1, '♥', 3), card(2, '♥', 5)] }), params)
    expect(result.value).toBe(100 * params.talismans.grail.x)
  })

  test('月光: 黒専有チェーンで倍算、赤が混ざれば不発動', () => {
    const pure = applyItemEffects('gained', 100, ['moonlight'], ctx({ chain: [card(1, '♠', 3), card(2, '♣', 5)] }), params)
    expect(pure.value).toBe(100 * params.talismans.moonlight.x)
    const mixed = applyItemEffects('gained', 100, ['moonlight'], ctx({ chain: [card(1, '♠', 3), card(2, '♥', 5)] }), params)
    expect(mixed.value).toBe(100)
  })

  test('陽光: 赤専有チェーンで倍算', () => {
    const result = applyItemEffects('gained', 100, ['sunlight'], ctx({ chain: [card(1, '♥', 3), card(2, '♦', 5)] }), params)
    expect(result.value).toBe(100 * params.talismans.sunlight.x)
  })
})
```

- [ ] **Step 2: テストを実行して失敗を確認**

Run: `npm run test -- engine.test.ts`
Expected: FAIL

- [ ] **Step 3: `chainSuitExclusive`/`chainColorExclusive`ヘルパーと6個の効果を追加**

`src/lib/game/shidasu/engine.ts`の`chainIsFaceOnly`関数の直後に追加:

```ts
function chainSuitExclusive(chain: Card[], suit: Suit): boolean {
  return chain.every(c => c.wild || c.suit === suit)
}
function chainColorExclusive(chain: Card[], red: boolean): boolean {
  return chain.every(c => c.wild || isRed(c) === red)
}
```

`ITEM_EFFECTS`オブジェクト内、`relief`エントリの直後に追加:

```ts
  verdantGreen: {
    channel: 'gained',
    effect: (v, ctx, p) => {
      if (!chainSuitExclusive(ctx.chain, '♣')) return { value: v, part: null }
      const factor = p.talismans.verdantGreen.x
      return { value: v * factor, part: `深緑×${fmtMultiplier(factor)}` }
    },
  },
  gem: {
    channel: 'gained',
    effect: (v, ctx, p) => {
      if (!chainSuitExclusive(ctx.chain, '♦')) return { value: v, part: null }
      const factor = p.talismans.gem.x
      return { value: v * factor, part: `宝石×${fmtMultiplier(factor)}` }
    },
  },
  resolve: {
    channel: 'gained',
    effect: (v, ctx, p) => {
      if (!chainSuitExclusive(ctx.chain, '♠')) return { value: v, part: null }
      const factor = p.talismans.resolve.x
      return { value: v * factor, part: `真剣×${fmtMultiplier(factor)}` }
    },
  },
  grail: {
    channel: 'gained',
    effect: (v, ctx, p) => {
      if (!chainSuitExclusive(ctx.chain, '♥')) return { value: v, part: null }
      const factor = p.talismans.grail.x
      return { value: v * factor, part: `聖杯×${fmtMultiplier(factor)}` }
    },
  },
  moonlight: {
    channel: 'gained',
    effect: (v, ctx, p) => {
      if (!chainColorExclusive(ctx.chain, false)) return { value: v, part: null }
      const factor = p.talismans.moonlight.x
      return { value: v * factor, part: `月光×${fmtMultiplier(factor)}` }
    },
  },
  sunlight: {
    channel: 'gained',
    effect: (v, ctx, p) => {
      if (!chainColorExclusive(ctx.chain, true)) return { value: v, part: null }
      const factor = p.talismans.sunlight.x
      return { value: v * factor, part: `陽光×${fmtMultiplier(factor)}` }
    },
  },
```

- [ ] **Step 4: `ITEM_NAMES`に6個分を追加**

`relief: '安堵の護符',`の直後に追加:

```ts
  verdantGreen: '深緑の護符',
  gem: '宝石の護符',
  resolve: '真剣の護符',
  grail: '聖杯の護符',
  moonlight: '月光の護符',
  sunlight: '陽光の護符',
```

- [ ] **Step 5: `itemDesc`に6個分を追加**

`case 'relief': ...`の直後に追加:

```ts
    case 'verdantGreen': return `コンボがクラブ(♣)専有のとき、獲得点を${params.talismans.verdantGreen.x}倍`
    case 'gem': return `コンボがダイヤ(♦)専有のとき、獲得点を${params.talismans.gem.x}倍`
    case 'resolve': return `コンボがスペード(♠)専有のとき、獲得点を${params.talismans.resolve.x}倍`
    case 'grail': return `コンボがハート(♥)専有のとき、獲得点を${params.talismans.grail.x}倍`
    case 'moonlight': return `コンボが黒専有のとき、獲得点を${params.talismans.moonlight.x}倍`
    case 'sunlight': return `コンボが赤専有のとき、獲得点を${params.talismans.sunlight.x}倍`
```

- [ ] **Step 6: テストを実行して成功を確認**

Run: `npm run test -- engine.test.ts`
Expected: PASS

- [ ] **Step 7: コミット**

```bash
git add src/lib/game/shidasu/engine.ts src/lib/game/shidasu/engine.test.ts
git commit -m "$(cat <<'EOF'
feat: Shidasu護符に深緑・宝石・真剣・聖杯・月光・陽光(グループ4-b)を追加
EOF
)"
```

---

### Task 6: グループ4-c 枚数カウント系(王冠・青葉・硬貨・武器・献杯・均衡・調和、7個)

**Files:**
- Modify: `src/lib/game/shidasu/engine.ts`
- Modify: `src/lib/game/shidasu/engine.test.ts`

- [ ] **Step 1: 失敗するテストを書く**

`src/lib/game/shidasu/engine.test.ts`の末尾に追加:

```ts
describe('applyItemEffects (グループ4-c: 枚数カウント系)', () => {
  const params = DEFAULT_PARAMS
  function ctx(overrides: Partial<ItemEffectContext> = {}): ItemEffectContext {
    return {
      card: card(1, '♠', 5),
      previousFoundation: card(2, '♣', 4),
      combo: 1,
      stockRemaining: 0,
      chain: [card(2, '♣', 4), card(1, '♠', 5)],
      remainingTableauCount: 10,
      chainBonus: { bonus: 0, parts: [], patternFired: false, roleFired: [] },
      isFirstPlayOfWave: false,
      effectiveStairMinLen: params.scoring.stairMinLen,
      ...overrides,
    }
  }

  test('王冠: チェーン内のK枚数(ワイルド込み)×xで倍算、K無しなら不発動', () => {
    const chain = [card(1, '♠', 13), card(2, '♦', 13), card(3, '★', 0, true)]
    const result = applyItemEffects('gained', 100, ['crown'], ctx({ chain }), params)
    expect(result.value).toBe(100 * (1 + 3 * params.talismans.crown.x))
    const noKing = applyItemEffects('gained', 100, ['crown'], ctx({ chain: [card(1, '♠', 5)] }), params)
    expect(noKing.value).toBe(100)
  })

  test('青葉: チェーン内の♣枚数(ワイルド込み)×nで加算', () => {
    const chain = [card(1, '♣', 3), card(2, '♣', 5), card(3, '★', 0, true)]
    const result = applyItemEffects('gained', 100, ['cloverLeaf'], ctx({ chain }), params)
    expect(result.value).toBe(100 + 3 * params.talismans.cloverLeaf.n)
  })

  test('硬貨: チェーン内の♦枚数×nで加算', () => {
    const chain = [card(1, '♦', 3), card(2, '♦', 5)]
    const result = applyItemEffects('gained', 100, ['coin'], ctx({ chain }), params)
    expect(result.value).toBe(100 + 2 * params.talismans.coin.n)
  })

  test('武器: チェーン内の♠枚数×nで加算', () => {
    const chain = [card(1, '♠', 3), card(2, '♠', 5)]
    const result = applyItemEffects('gained', 100, ['blade'], ctx({ chain }), params)
    expect(result.value).toBe(100 + 2 * params.talismans.blade.n)
  })

  test('献杯: チェーン内の♥枚数×nで加算', () => {
    const chain = [card(1, '♥', 3), card(2, '♥', 5)]
    const result = applyItemEffects('gained', 100, ['chalice'], ctx({ chain }), params)
    expect(result.value).toBe(100 + 2 * params.talismans.chalice.n)
  })

  test('均衡: 赤黒枚数が同数(ワイルドで調整可)なら加算', () => {
    const balanced = applyItemEffects('gained', 100, ['balance'], ctx({ chain: [card(1, '♠', 3), card(2, '♥', 5)] }), params)
    expect(balanced.value).toBe(100 + params.talismans.balance.n)
    const adjustedByWild = applyItemEffects('gained', 100, ['balance'], ctx({ chain: [card(1, '♠', 3), card(2, '♥', 4), card(3, '♠', 5), card(4, '★', 0, true)] }), params)
    expect(adjustedByWild.value).toBe(100 + params.talismans.balance.n)
    const unbalanced = applyItemEffects('gained', 100, ['balance'], ctx({ chain: [card(1, '♠', 3), card(2, '♠', 4), card(3, '♥', 5)] }), params)
    expect(unbalanced.value).toBe(100)
  })

  test('調和: 赤黒枚数が同数なら倍算', () => {
    const result = applyItemEffects('gained', 100, ['harmony'], ctx({ chain: [card(1, '♠', 3), card(2, '♥', 5)] }), params)
    expect(result.value).toBe(100 * params.talismans.harmony.x)
  })
})
```

- [ ] **Step 2: テストを実行して失敗を確認**

Run: `npm run test -- engine.test.ts`
Expected: FAIL

- [ ] **Step 3: `countSuitInChain`/`countRankInChain`/`redBlackBalanced`ヘルパーと7個の効果を追加**

`src/lib/game/shidasu/engine.ts`の`chainColorExclusive`関数の直後に追加:

```ts
function countSuitInChain(chain: Card[], suit: Suit): number {
  const real = chain.filter(c => !c.wild && c.suit === suit).length
  const wild = chain.filter(c => c.wild).length
  return real + wild
}
function countRankInChain(chain: Card[], rank: Card['rank']): number {
  const real = chain.filter(c => !c.wild && c.rank === rank).length
  const wild = chain.filter(c => c.wild).length
  return real + wild
}
function redBlackBalanced(chain: Card[]): boolean {
  const realRed = chain.filter(c => !c.wild && isRed(c)).length
  const realBlack = chain.filter(c => !c.wild && !isRed(c)).length
  const wildCount = chain.filter(c => c.wild).length
  return Math.abs(realRed - realBlack) <= wildCount
}
```

`ITEM_EFFECTS`オブジェクト内、`sunlight`エントリの直後に追加:

```ts
  crown: {
    channel: 'gained',
    effect: (v, ctx, p) => {
      const count = countRankInChain(ctx.chain, 13)
      if (count === 0) return { value: v, part: null }
      const factor = 1 + count * p.talismans.crown.x
      return { value: v * factor, part: `王冠×${fmtMultiplier(factor)}` }
    },
  },
  cloverLeaf: {
    channel: 'gained',
    effect: (v, ctx, p) => {
      const count = countSuitInChain(ctx.chain, '♣')
      if (count === 0) return { value: v, part: null }
      const add = count * p.talismans.cloverLeaf.n
      return { value: v + add, part: `青葉+${add}` }
    },
  },
  coin: {
    channel: 'gained',
    effect: (v, ctx, p) => {
      const count = countSuitInChain(ctx.chain, '♦')
      if (count === 0) return { value: v, part: null }
      const add = count * p.talismans.coin.n
      return { value: v + add, part: `硬貨+${add}` }
    },
  },
  blade: {
    channel: 'gained',
    effect: (v, ctx, p) => {
      const count = countSuitInChain(ctx.chain, '♠')
      if (count === 0) return { value: v, part: null }
      const add = count * p.talismans.blade.n
      return { value: v + add, part: `武器+${add}` }
    },
  },
  chalice: {
    channel: 'gained',
    effect: (v, ctx, p) => {
      const count = countSuitInChain(ctx.chain, '♥')
      if (count === 0) return { value: v, part: null }
      const add = count * p.talismans.chalice.n
      return { value: v + add, part: `献杯+${add}` }
    },
  },
  balance: {
    channel: 'gained',
    effect: (v, ctx, p) =>
      redBlackBalanced(ctx.chain) ? { value: v + p.talismans.balance.n, part: `均衡+${p.talismans.balance.n}` } : { value: v, part: null },
  },
  harmony: {
    channel: 'gained',
    effect: (v, ctx, p) => {
      if (!redBlackBalanced(ctx.chain)) return { value: v, part: null }
      const factor = p.talismans.harmony.x
      return { value: v * factor, part: `調和×${fmtMultiplier(factor)}` }
    },
  },
```

- [ ] **Step 4: `ITEM_NAMES`に7個分を追加**

`sunlight: '陽光の護符',`の直後に追加:

```ts
  crown: '王冠の護符',
  cloverLeaf: '青葉の護符',
  coin: '硬貨の護符',
  blade: '武器の護符',
  chalice: '献杯の護符',
  balance: '均衡の護符',
  harmony: '調和の護符',
```

- [ ] **Step 5: `itemDesc`に7個分を追加**

`case 'sunlight': ...`の直後に追加:

```ts
    case 'crown': return `コンボ内のK枚数×${params.talismans.crown.x}分、獲得点を倍加`
    case 'cloverLeaf': return `コンボ内のクラブ(♣)枚数×${params.talismans.cloverLeaf.n}点を加算`
    case 'coin': return `コンボ内のダイヤ(♦)枚数×${params.talismans.coin.n}点を加算`
    case 'blade': return `コンボ内のスペード(♠)枚数×${params.talismans.blade.n}点を加算`
    case 'chalice': return `コンボ内のハート(♥)枚数×${params.talismans.chalice.n}点を加算`
    case 'balance': return `コンボ内の赤黒枚数が同数のとき、${params.talismans.balance.n}点加算`
    case 'harmony': return `コンボ内の赤黒枚数が同数のとき、獲得点を${params.talismans.harmony.x}倍`
```

- [ ] **Step 6: テストを実行して成功を確認**

Run: `npm run test -- engine.test.ts`
Expected: PASS

- [ ] **Step 7: コミット**

```bash
git add src/lib/game/shidasu/engine.ts src/lib/game/shidasu/engine.test.ts
git commit -m "$(cat <<'EOF'
feat: Shidasu護符に王冠・青葉・硬貨・武器・献杯・均衡・調和(グループ4-c)を追加
EOF
)"
```

---

### Task 7: グループ4-d 既存フラグ再利用・KAループ系(高潔・執念・覚悟・循環・輪廻・威光、6個)

**Files:**
- Modify: `src/lib/game/shidasu/engine.ts`
- Modify: `src/lib/game/shidasu/engine.test.ts`

- [ ] **Step 1: 失敗するテストを書く**

`src/lib/game/shidasu/engine.test.ts`の末尾に追加:

```ts
describe('applyItemEffects (グループ4-d: 既存フラグ再利用・KAループ系)', () => {
  const params = DEFAULT_PARAMS
  function ctx(overrides: Partial<ItemEffectContext> = {}): ItemEffectContext {
    return {
      card: card(1, '♠', 5),
      previousFoundation: card(2, '♣', 4),
      combo: 1,
      stockRemaining: 0,
      chain: [card(2, '♣', 4), card(1, '♠', 5)],
      remainingTableauCount: 10,
      chainBonus: { bonus: 0, parts: [], patternFired: false, roleFired: [] },
      isFirstPlayOfWave: false,
      effectiveStairMinLen: params.scoring.stairMinLen,
      ...overrides,
    }
  }

  test('高潔: 同スートパターン成立時(3枚以上・同スート)に加算', () => {
    const chain = [card(1, '♠', 3), card(2, '♠', 5), card(3, '♠', 9)]
    const fired = applyItemEffects('gained', 100, ['nobility'], ctx({ chain }), params)
    expect(fired.value).toBe(100 + params.talismans.nobility.n)
    const tooShort = applyItemEffects('gained', 100, ['nobility'], ctx({ chain: chain.slice(0, 2) }), params)
    expect(tooShort.value).toBe(100)
  })

  test('執念: 同スートパターン成立時、チェーン長×xで倍算', () => {
    const chain = [card(1, '♠', 3), card(2, '♠', 5), card(3, '♠', 9)]
    const result = applyItemEffects('gained', 100, ['tenacity'], ctx({ chain }), params)
    expect(result.value).toBe(100 * (1 + chain.length * params.talismans.tenacity.x))
  })

  test('覚悟: 階段成立時(effectiveStairMinLen以上)、階段長×xで倍算', () => {
    const chain = [card(1, '♠', 3), card(2, '♦', 4), card(3, '♥', 5), card(4, '♣', 6), card(5, '♠', 7)]
    const result = applyItemEffects('gained', 100, ['determination'], ctx({ chain, effectiveStairMinLen: 5 }), params)
    expect(result.value).toBe(100 * (1 + 5 * params.talismans.determination.x))
  })

  test('循環: K→A、A→Kの遷移で倍算し、ワイルドが絡む場合も都合よく成立する', () => {
    const kToA = applyItemEffects('gained', 100, ['cycle'], ctx({ previousFoundation: card(1, '♠', 13), card: card(2, '♦', 1) }), params)
    expect(kToA.value).toBe(100 * params.talismans.cycle.x)
    const wildAsA = applyItemEffects('gained', 100, ['cycle'], ctx({ previousFoundation: card(1, '♠', 13), card: card(2, '★', 0, true) }), params)
    expect(wildAsA.value).toBe(100 * params.talismans.cycle.x)
    const notFired = applyItemEffects('gained', 100, ['cycle'], ctx({ previousFoundation: card(1, '♠', 7), card: card(2, '♦', 8) }), params)
    expect(notFired.value).toBe(100)
  })

  const kaLoopChain: Card[] = [8, 9, 10, 11, 12, 13, 1, 2, 3, 4, 5, 6, 7].map((r, i) => card(i + 1, '♠', r as Card['rank']))
  const completeRunRoleFired = { bonus: 0, parts: [], patternFired: false, roleFired: [{ name: 'completeRun' as const, usedWild: false }] }

  test('輪廻: コンプリートラン成立かつ階段成立かつK↔Aループを跨ぐ場合に倍算', () => {
    const fired = applyItemEffects('gained', 100, ['reincarnation'], ctx({ chain: kaLoopChain, chainBonus: completeRunRoleFired }), params)
    expect(fired.value).toBe(100 * params.talismans.reincarnation.x)
    const noLoopChain = [1, 2, 3, 4, 5, 6, 7, 8, 9, 10, 11, 12, 13].map((r, i) => card(i + 1, '♠', r as Card['rank']))
    const notFired = applyItemEffects('gained', 100, ['reincarnation'], ctx({ chain: noLoopChain, chainBonus: completeRunRoleFired }), params)
    expect(notFired.value).toBe(100)
  })

  test('威光: コンプリートラン成立かつ階段成立かつ同スート専有の場合に倍算', () => {
    const fired = applyItemEffects('gained', 100, ['majesty'], ctx({ chain: kaLoopChain, chainBonus: completeRunRoleFired }), params)
    expect(fired.value).toBe(100 * params.talismans.majesty.x)
    const mixedSuitChain = kaLoopChain.map((c, i) => (i === 0 ? { ...c, suit: '♦' as const } : c))
    const notFired = applyItemEffects('gained', 100, ['majesty'], ctx({ chain: mixedSuitChain, chainBonus: completeRunRoleFired }), params)
    expect(notFired.value).toBe(100)
  })
})
```

- [ ] **Step 2: テストを実行して失敗を確認**

Run: `npm run test -- engine.test.ts`
Expected: FAIL

- [ ] **Step 3: 6個の効果を`ITEM_EFFECTS`に追加**

`src/lib/game/shidasu/engine.ts`の`ITEM_EFFECTS`オブジェクト内、`harmony`エントリの直後に追加:

```ts
  nobility: {
    channel: 'gained',
    effect: (v, ctx, p) => {
      const { suitHeld } = analyzeSuitColor(ctx.chain)
      if (ctx.chain.length < p.scoring.suitColorMinLen || !suitHeld) return { value: v, part: null }
      return { value: v + p.talismans.nobility.n, part: `高潔+${p.talismans.nobility.n}` }
    },
  },
  tenacity: {
    channel: 'gained',
    effect: (v, ctx, p) => {
      const { suitHeld } = analyzeSuitColor(ctx.chain)
      if (ctx.chain.length < p.scoring.suitColorMinLen || !suitHeld) return { value: v, part: null }
      const factor = 1 + ctx.chain.length * p.talismans.tenacity.x
      return { value: v * factor, part: `執念×${fmtMultiplier(factor)}` }
    },
  },
  determination: {
    channel: 'gained',
    effect: (v, ctx, p) => {
      const stairInfo = analyzeStair(ctx.chain)
      if (!stairInfo.held || stairInfo.dir === 0 || stairInfo.len < ctx.effectiveStairMinLen) return { value: v, part: null }
      const factor = 1 + stairInfo.len * p.talismans.determination.x
      return { value: v * factor, part: `覚悟×${fmtMultiplier(factor)}` }
    },
  },
  cycle: {
    channel: 'gained',
    effect: (v, ctx, p) => {
      const matches = (c: Card, rank: Card['rank']) => c.wild || c.rank === rank
      const kToA = matches(ctx.previousFoundation, 13) && matches(ctx.card, 1)
      const aToK = matches(ctx.previousFoundation, 1) && matches(ctx.card, 13)
      if (!kToA && !aToK) return { value: v, part: null }
      const factor = p.talismans.cycle.x
      return { value: v * factor, part: `循環×${fmtMultiplier(factor)}` }
    },
  },
  reincarnation: {
    channel: 'gained',
    effect: (v, ctx, p) => {
      const stairInfo = analyzeStair(ctx.chain)
      const completeRunFired = ctx.chainBonus.roleFired.some(r => r.name === 'completeRun')
      if (!completeRunFired || !stairInfo.held || stairInfo.dir === 0 || !stairUsesKALoop(ctx.chain)) return { value: v, part: null }
      const factor = p.talismans.reincarnation.x
      return { value: v * factor, part: `輪廻×${fmtMultiplier(factor)}` }
    },
  },
  majesty: {
    channel: 'gained',
    effect: (v, ctx, p) => {
      const stairInfo = analyzeStair(ctx.chain)
      const { suitHeld } = analyzeSuitColor(ctx.chain)
      const completeRunFired = ctx.chainBonus.roleFired.some(r => r.name === 'completeRun')
      if (!completeRunFired || !stairInfo.held || stairInfo.dir === 0 || !suitHeld) return { value: v, part: null }
      const factor = p.talismans.majesty.x
      return { value: v * factor, part: `威光×${fmtMultiplier(factor)}` }
    },
  },
```

- [ ] **Step 4: `ITEM_NAMES`に6個分を追加**

`harmony: '調和の護符',`の直後に追加:

```ts
  nobility: '高潔の護符',
  tenacity: '執念の護符',
  determination: '覚悟の護符',
  cycle: '循環の護符',
  reincarnation: '輪廻の護符',
  majesty: '威光の護符',
```

- [ ] **Step 5: `itemDesc`に6個分を追加**

`case 'harmony': ...`の直後に追加:

```ts
    case 'nobility': return `同スートパターン成立時、${params.talismans.nobility.n}点加算`
    case 'tenacity': return `同スートパターン成立時、コンボ内枚数×${params.talismans.tenacity.x}分、獲得点を倍加`
    case 'determination': return `階段成立時、階段の長さ×${params.talismans.determination.x}分、獲得点を倍加`
    case 'cycle': return `KからA、またはAからKを取ったとき、獲得点を${params.talismans.cycle.x}倍`
    case 'reincarnation': return `コンプリートラン(全ランク階段)にK↔Aループが含まれるとき、獲得点を${params.talismans.reincarnation.x}倍`
    case 'majesty': return `同スートかつ全ランク階段を達成したとき、獲得点を${params.talismans.majesty.x}倍`
```

- [ ] **Step 6: テストを実行して成功を確認**

Run: `npm run test -- engine.test.ts`
Expected: PASS

- [ ] **Step 7: コミット**

```bash
git add src/lib/game/shidasu/engine.ts src/lib/game/shidasu/engine.test.ts
git commit -m "$(cat <<'EOF'
feat: Shidasu護符に高潔・執念・覚悟・循環・輪廻・威光(グループ4-d)を追加

これでグループ4(24個)の実装が完了。
EOF
)"
```

---

### Task 8: グループ5(兆し・三日月、2個)

**Files:**
- Modify: `src/lib/game/shidasu/engine.ts`
- Modify: `src/lib/game/shidasu/engine.test.ts`

- [ ] **Step 1: 失敗するテストを書く**

`src/lib/game/shidasu/engine.test.ts`の末尾に追加:

```ts
describe('applyItemEffects (グループ5: 場札残数系)', () => {
  const params = DEFAULT_PARAMS
  function ctx(overrides: Partial<ItemEffectContext> = {}): ItemEffectContext {
    return {
      card: card(1, '♠', 5),
      previousFoundation: card(2, '♣', 4),
      combo: 1,
      stockRemaining: 0,
      chain: [card(2, '♣', 4), card(1, '♠', 5)],
      remainingTableauCount: 10,
      chainBonus: { bonus: 0, parts: [], patternFired: false, roleFired: [] },
      isFirstPlayOfWave: false,
      effectiveStairMinLen: params.scoring.stairMinLen,
      ...overrides,
    }
  }

  test('兆し: 場札残数がm以下なら倍算、超えていれば不発動', () => {
    const fired = applyItemEffects('gained', 100, ['omen'], ctx({ remainingTableauCount: params.talismans.omen.m }), params)
    expect(fired.value).toBe(100 * params.talismans.omen.x)
    const notFired = applyItemEffects('gained', 100, ['omen'], ctx({ remainingTableauCount: params.talismans.omen.m + 1 }), params)
    expect(notFired.value).toBe(100)
  })

  test('三日月: 場札残数がm以下なら倍算', () => {
    const result = applyItemEffects('gained', 100, ['crescent'], ctx({ remainingTableauCount: params.talismans.crescent.m }), params)
    expect(result.value).toBe(100 * params.talismans.crescent.x)
  })
})
```

- [ ] **Step 2: テストを実行して失敗を確認**

Run: `npm run test -- engine.test.ts`
Expected: FAIL

- [ ] **Step 3: 2個の効果を`ITEM_EFFECTS`に追加**

`majesty`エントリの直後に追加:

```ts
  omen: {
    channel: 'gained',
    effect: (v, ctx, p) => {
      if (ctx.remainingTableauCount > p.talismans.omen.m) return { value: v, part: null }
      const factor = p.talismans.omen.x
      return { value: v * factor, part: `兆し×${fmtMultiplier(factor)}` }
    },
  },
  crescent: {
    channel: 'gained',
    effect: (v, ctx, p) => {
      if (ctx.remainingTableauCount > p.talismans.crescent.m) return { value: v, part: null }
      const factor = p.talismans.crescent.x
      return { value: v * factor, part: `三日月×${fmtMultiplier(factor)}` }
    },
  },
```

- [ ] **Step 4: `ITEM_NAMES`に2個分を追加**

`majesty: '威光の護符',`の直後に追加:

```ts
  omen: '兆しの護符',
  crescent: '三日月の護符',
```

- [ ] **Step 5: `itemDesc`に2個分を追加**

`case 'majesty': ...`の直後に追加:

```ts
    case 'omen': return `場札の残り枚数が${params.talismans.omen.m}枚以下のとき、獲得点を${params.talismans.omen.x}倍`
    case 'crescent': return `場札の残り枚数が${params.talismans.crescent.m}枚以下のとき、獲得点を${params.talismans.crescent.x}倍`
```

- [ ] **Step 6: テストを実行して成功を確認**

Run: `npm run test -- engine.test.ts`
Expected: PASS

- [ ] **Step 7: コミット**

```bash
git add src/lib/game/shidasu/engine.ts src/lib/game/shidasu/engine.test.ts
git commit -m "$(cat <<'EOF'
feat: Shidasu護符に兆し・三日月(グループ5)を追加
EOF
)"
```

---

### Task 9: グループ6(恩寵・集中・瑠璃・翡翠・無心、5個)

**Files:**
- Modify: `src/lib/game/shidasu/engine.ts`
- Modify: `src/lib/game/shidasu/engine.test.ts`

- [ ] **Step 1: 失敗するテストを書く**

`src/lib/game/shidasu/engine.test.ts`の末尾に追加:

```ts
describe('applyItemEffects (グループ6: 役・パターン成立状況系)', () => {
  const params = DEFAULT_PARAMS
  function ctx(overrides: Partial<ItemEffectContext> = {}): ItemEffectContext {
    return {
      card: card(1, '♠', 5),
      previousFoundation: card(2, '♣', 4),
      combo: 1,
      stockRemaining: 0,
      chain: [card(2, '♣', 4), card(1, '♠', 5)],
      remainingTableauCount: 10,
      chainBonus: { bonus: 0, parts: [], patternFired: false, roleFired: [] },
      isFirstPlayOfWave: false,
      effectiveStairMinLen: params.scoring.stairMinLen,
      ...overrides,
    }
  }

  test('恩寵: いずれかの役ボーナスが成立していれば倍算', () => {
    const chainBonus = { bonus: 0, parts: [], patternFired: false, roleFired: [{ name: 'flush' as const, usedWild: false }] }
    const fired = applyItemEffects('gained', 100, ['blessing'], ctx({ chainBonus }), params)
    expect(fired.value).toBe(100 * params.talismans.blessing.x)
    const notFired = applyItemEffects('gained', 100, ['blessing'], ctx(), params)
    expect(notFired.value).toBe(100)
  })

  test('集中: 同ランクによる役が含まれていれば倍算', () => {
    const chainBonus = { bonus: 0, parts: [], patternFired: false, roleFired: [{ name: 'sameRank' as const, usedWild: false }] }
    const fired = applyItemEffects('gained', 100, ['focus'], ctx({ chainBonus }), params)
    expect(fired.value).toBe(100 * params.talismans.focus.x)
    const otherRole = { bonus: 0, parts: [], patternFired: false, roleFired: [{ name: 'flush' as const, usedWild: false }] }
    const notFired = applyItemEffects('gained', 100, ['focus'], ctx({ chainBonus: otherRole }), params)
    expect(notFired.value).toBe(100)
  })

  test('瑠璃: 役ボーナスが2種類以上同時発生していれば倍算', () => {
    const chainBonus = {
      bonus: 0, parts: [], patternFired: false,
      roleFired: [{ name: 'flush' as const, usedWild: false }, { name: 'sameRank' as const, usedWild: false }],
    }
    const fired = applyItemEffects('gained', 100, ['lapis'], ctx({ chainBonus }), params)
    expect(fired.value).toBe(100 * params.talismans.lapis.x)
    const singleRole = { bonus: 0, parts: [], patternFired: false, roleFired: [{ name: 'flush' as const, usedWild: false }] }
    const notFired = applyItemEffects('gained', 100, ['lapis'], ctx({ chainBonus: singleRole }), params)
    expect(notFired.value).toBe(100)
  })

  test('翡翠: 役の成立にワイルドが使われていれば加算', () => {
    const chainBonus = { bonus: 0, parts: [], patternFired: false, roleFired: [{ name: 'flush' as const, usedWild: true }] }
    const fired = applyItemEffects('gained', 100, ['jade'], ctx({ chainBonus }), params)
    expect(fired.value).toBe(100 + params.talismans.jade.n)
    const withoutWild = { bonus: 0, parts: [], patternFired: false, roleFired: [{ name: 'flush' as const, usedWild: false }] }
    const notFired = applyItemEffects('gained', 100, ['jade'], ctx({ chainBonus: withoutWild }), params)
    expect(notFired.value).toBe(100)
  })

  test('無心: 役もパターンも無ければ倍算', () => {
    const fired = applyItemEffects('gained', 100, ['emptyMind'], ctx(), params)
    expect(fired.value).toBe(100 * params.talismans.emptyMind.x)
    const withPattern = { bonus: 0, parts: [], patternFired: true, roleFired: [] }
    const notFired = applyItemEffects('gained', 100, ['emptyMind'], ctx({ chainBonus: withPattern }), params)
    expect(notFired.value).toBe(100)
  })
})
```

- [ ] **Step 2: テストを実行して失敗を確認**

Run: `npm run test -- engine.test.ts`
Expected: FAIL

- [ ] **Step 3: 5個の効果を`ITEM_EFFECTS`に追加**

`crescent`エントリの直後に追加:

```ts
  blessing: {
    channel: 'gained',
    effect: (v, ctx, p) => {
      if (ctx.chainBonus.roleFired.length === 0) return { value: v, part: null }
      const factor = p.talismans.blessing.x
      return { value: v * factor, part: `恩寵×${fmtMultiplier(factor)}` }
    },
  },
  focus: {
    channel: 'gained',
    effect: (v, ctx, p) => {
      if (!ctx.chainBonus.roleFired.some(r => r.name === 'sameRank')) return { value: v, part: null }
      const factor = p.talismans.focus.x
      return { value: v * factor, part: `集中×${fmtMultiplier(factor)}` }
    },
  },
  lapis: {
    channel: 'gained',
    effect: (v, ctx, p) => {
      if (ctx.chainBonus.roleFired.length < 2) return { value: v, part: null }
      const factor = p.talismans.lapis.x
      return { value: v * factor, part: `瑠璃×${fmtMultiplier(factor)}` }
    },
  },
  jade: {
    channel: 'gained',
    effect: (v, ctx, p) =>
      ctx.chainBonus.roleFired.some(r => r.usedWild)
        ? { value: v + p.talismans.jade.n, part: `翡翠+${p.talismans.jade.n}` }
        : { value: v, part: null },
  },
  emptyMind: {
    channel: 'gained',
    effect: (v, ctx, p) => {
      if (ctx.chainBonus.patternFired || ctx.chainBonus.roleFired.length > 0) return { value: v, part: null }
      const factor = p.talismans.emptyMind.x
      return { value: v * factor, part: `無心×${fmtMultiplier(factor)}` }
    },
  },
```

- [ ] **Step 4: `ITEM_NAMES`に5個分を追加**

`crescent: '三日月の護符',`の直後に追加:

```ts
  blessing: '恩寵の護符',
  focus: '集中の護符',
  lapis: '瑠璃の護符',
  jade: '翡翠の護符',
  emptyMind: '無心の護符',
```

- [ ] **Step 5: `itemDesc`に5個分を追加**

`case 'crescent': ...`の直後に追加:

```ts
    case 'blessing': return `役が成立したとき、獲得点を${params.talismans.blessing.x}倍`
    case 'focus': return `同ランクの役が含まれるとき、獲得点を${params.talismans.focus.x}倍`
    case 'lapis': return `2種類以上の役ボーナスが同時に発生したとき、獲得点を${params.talismans.lapis.x}倍`
    case 'jade': return `役の成立にワイルドが使われたとき、${params.talismans.jade.n}点加算`
    case 'emptyMind': return `役・パターンがどちらも無いとき、獲得点を${params.talismans.emptyMind.x}倍`
```

- [ ] **Step 6: テストを実行して成功を確認**

Run: `npm run test -- engine.test.ts`
Expected: PASS

- [ ] **Step 7: コミット**

```bash
git add src/lib/game/shidasu/engine.ts src/lib/game/shidasu/engine.test.ts
git commit -m "$(cat <<'EOF'
feat: Shidasu護符に恩寵・集中・瑠璃・翡翠・無心(グループ6)を追加
EOF
)"
```

---

### Task 10: グループ7(序章・幕間・朝露、3個)

**Files:**
- Modify: `src/lib/game/shidasu/engine.ts`
- Modify: `src/lib/game/shidasu/engine.test.ts`

- [ ] **Step 1: 失敗するテストを書く**

`src/lib/game/shidasu/engine.test.ts`の末尾に追加:

```ts
describe('applyItemEffects (グループ7: コンボ内位置系)', () => {
  const params = DEFAULT_PARAMS
  function ctx(overrides: Partial<ItemEffectContext> = {}): ItemEffectContext {
    return {
      card: card(1, '♠', 5),
      previousFoundation: card(2, '♣', 4),
      combo: 1,
      stockRemaining: 0,
      chain: [card(2, '♣', 4), card(1, '♠', 5)],
      remainingTableauCount: 10,
      chainBonus: { bonus: 0, parts: [], patternFired: false, roleFired: [] },
      isFirstPlayOfWave: false,
      effectiveStairMinLen: params.scoring.stairMinLen,
      ...overrides,
    }
  }

  test('序章: コンボ1枚目のみ加算', () => {
    const fired = applyItemEffects('gained', 100, ['prologue'], ctx({ combo: 1 }), params)
    expect(fired.value).toBe(100 + params.talismans.prologue.n)
    const notFired = applyItemEffects('gained', 100, ['prologue'], ctx({ combo: 2 }), params)
    expect(notFired.value).toBe(100)
  })

  test('幕間: コンボがm枚目に達するたび加算', () => {
    const m = params.talismans.interlude.m
    const fired = applyItemEffects('gained', 100, ['interlude'], ctx({ combo: m * 2 }), params)
    expect(fired.value).toBe(100 + params.talismans.interlude.n)
    const notFired = applyItemEffects('gained', 100, ['interlude'], ctx({ combo: m + 1 }), params)
    expect(notFired.value).toBe(100)
  })

  test('朝露: ウェーブで最初にプレイしたカードのみ加算', () => {
    const fired = applyItemEffects('gained', 100, ['morningDew'], ctx({ isFirstPlayOfWave: true }), params)
    expect(fired.value).toBe(100 + params.talismans.morningDew.n)
    const notFired = applyItemEffects('gained', 100, ['morningDew'], ctx({ isFirstPlayOfWave: false }), params)
    expect(notFired.value).toBe(100)
  })
})
```

- [ ] **Step 2: テストを実行して失敗を確認**

Run: `npm run test -- engine.test.ts`
Expected: FAIL

- [ ] **Step 3: 3個の効果を`ITEM_EFFECTS`に追加**

`emptyMind`エントリの直後に追加:

```ts
  prologue: {
    channel: 'gained',
    effect: (v, ctx, p) =>
      ctx.combo === 1 ? { value: v + p.talismans.prologue.n, part: `序章+${p.talismans.prologue.n}` } : { value: v, part: null },
  },
  interlude: {
    channel: 'gained',
    effect: (v, ctx, p) =>
      ctx.combo % p.talismans.interlude.m === 0
        ? { value: v + p.talismans.interlude.n, part: `幕間+${p.talismans.interlude.n}` }
        : { value: v, part: null },
  },
  morningDew: {
    channel: 'gained',
    effect: (v, ctx, p) =>
      ctx.isFirstPlayOfWave ? { value: v + p.talismans.morningDew.n, part: `朝露+${p.talismans.morningDew.n}` } : { value: v, part: null },
  },
```

- [ ] **Step 4: `ITEM_NAMES`に3個分を追加**

`emptyMind: '無心の護符',`の直後に追加:

```ts
  prologue: '序章の護符',
  interlude: '幕間の護符',
  morningDew: '朝露の護符',
```

- [ ] **Step 5: `itemDesc`に3個分を追加**

`case 'emptyMind': ...`の直後に追加:

```ts
    case 'prologue': return `コンボ1枚目のとき、${params.talismans.prologue.n}点加算`
    case 'interlude': return `コンボが${params.talismans.interlude.m}枚目に達するたび、${params.talismans.interlude.n}点加算`
    case 'morningDew': return `ウェーブで最初にプレイしたカードのとき、${params.talismans.morningDew.n}点加算`
```

- [ ] **Step 6: テストを実行して成功を確認**

Run: `npm run test -- engine.test.ts`
Expected: PASS

- [ ] **Step 7: コミット**

```bash
git add src/lib/game/shidasu/engine.ts src/lib/game/shidasu/engine.test.ts
git commit -m "$(cat <<'EOF'
feat: Shidasu護符に序章・幕間・朝露(グループ7)を追加
EOF
)"
```

---

### Task 11: グループ8(小雨、1個)

**Files:**
- Modify: `src/lib/game/shidasu/engine.ts`
- Modify: `src/lib/game/shidasu/engine.test.ts`

- [ ] **Step 1: 失敗するテストを書く**

`src/lib/game/shidasu/engine.test.ts`の末尾に追加:

```ts
describe('applyItemEffects (グループ8: 無条件固定加算)', () => {
  const params = DEFAULT_PARAMS
  function ctx(overrides: Partial<ItemEffectContext> = {}): ItemEffectContext {
    return {
      card: card(1, '♠', 5),
      previousFoundation: card(2, '♣', 4),
      combo: 1,
      stockRemaining: 0,
      chain: [card(2, '♣', 4), card(1, '♠', 5)],
      remainingTableauCount: 10,
      chainBonus: { bonus: 0, parts: [], patternFired: false, roleFired: [] },
      isFirstPlayOfWave: false,
      effectiveStairMinLen: params.scoring.stairMinLen,
      ...overrides,
    }
  }

  test('小雨: 常にn点加算', () => {
    const result = applyItemEffects('gained', 100, ['drizzle'], ctx(), params)
    expect(result.value).toBe(100 + params.talismans.drizzle.n)
  })
})
```

- [ ] **Step 2: テストを実行して失敗を確認**

Run: `npm run test -- engine.test.ts`
Expected: FAIL

- [ ] **Step 3: 効果を`ITEM_EFFECTS`に追加**

`morningDew`エントリの直後に追加:

```ts
  drizzle: {
    channel: 'gained',
    effect: (v, _ctx, p) => ({ value: v + p.talismans.drizzle.n, part: `小雨+${p.talismans.drizzle.n}` }),
  },
```

- [ ] **Step 4: `ITEM_NAMES`に1個分を追加**

`morningDew: '朝露の護符',`の直後に追加:

```ts
  drizzle: '小雨の護符',
```

- [ ] **Step 5: `itemDesc`に1個分を追加**

`case 'morningDew': ...`の直後に追加:

```ts
    case 'drizzle': return `場札を取るたび、${params.talismans.drizzle.n}点加算`
```

- [ ] **Step 6: テストを実行して成功を確認**

Run: `npm run test -- engine.test.ts`
Expected: PASS(グループ4〜8の35個全てが`ITEM_EFFECTS`に揃った状態)

- [ ] **Step 7: コミット**

```bash
git add src/lib/game/shidasu/engine.ts src/lib/game/shidasu/engine.test.ts
git commit -m "$(cat <<'EOF'
feat: Shidasu護符に小雨(グループ8)を追加

これでグループ4〜8(35個)全ての護符効果登録が完了。
EOF
)"
```

---

### Task 12: ITEM_POOLの拡張とrollItemOffer関連テストの更新

**Files:**
- Modify: `src/lib/game/shidasu/engine.ts`(`ITEM_POOL`)
- Modify: `src/lib/game/shidasu/engine.test.ts`

- [ ] **Step 1: 失敗するテストを更新する**

`src/lib/game/shidasu/engine.test.ts`の`describe('ITEM_POOL / ITEM_NAMES / itemDesc', ...)`ブロック内、以下の箇所を書き換える:

既存(824〜829行目付近):
```ts
describe('ITEM_POOL / ITEM_NAMES / itemDesc', () => {
  test('20種類のアイテムが定義されている', () => {
    expect(ITEM_POOL).toHaveLength(20)
    expect(new Set(ITEM_POOL).size).toBe(20) // 重複なし
    ITEM_POOL.forEach(id => expect(ITEM_NAMES[id]).toBeTruthy())
  })
```

置き換え後:
```ts
describe('ITEM_POOL / ITEM_NAMES / itemDesc', () => {
  test('55種類のアイテムが定義されている', () => {
    expect(ITEM_POOL).toHaveLength(55)
    expect(new Set(ITEM_POOL).size).toBe(55) // 重複なし
    ITEM_POOL.forEach(id => expect(ITEM_NAMES[id]).toBeTruthy())
  })
```

続けて、既存の`test('新規追加した18個の護符も名前と説明文を持つ', ...)`の直後に以下を追加する:

```ts
  test('新規追加した35個(グループ4〜8)の護符も名前と説明文を持つ', () => {
    const newIds: ItemId[] = [
      'calm', 'serenity', 'destiny', 'fate', 'relief',
      'verdantGreen', 'gem', 'resolve', 'grail', 'moonlight', 'sunlight',
      'crown', 'cloverLeaf', 'coin', 'blade', 'chalice', 'balance', 'harmony',
      'nobility', 'tenacity', 'determination', 'cycle', 'reincarnation', 'majesty',
      'omen', 'crescent',
      'blessing', 'focus', 'lapis', 'jade', 'emptyMind',
      'prologue', 'interlude', 'morningDew',
      'drizzle',
    ]
    expect(newIds).toHaveLength(35)
    newIds.forEach(id => {
      expect(ITEM_NAMES[id]).toBeTruthy()
      expect(itemDesc(id, DEFAULT_PARAMS)).toBeTruthy()
    })
  })
```

- [ ] **Step 2: テストを実行して失敗を確認**

Run: `npm run test -- engine.test.ts`
Expected: FAIL(`ITEM_POOL`の長さが20のままのため)

- [ ] **Step 3: `ITEM_POOL`に35個を追加**

`src/lib/game/shidasu/engine.ts`の`ITEM_POOL`定義を以下に置き換える:

```ts
export const ITEM_POOL: ItemId[] = [
  'bridge', 'grace',
  'patience', 'purify', 'temperance',
  'springBreeze', 'summerBreeze', 'autumnBreeze', 'winterBreeze',
  'kinship', 'thaw', 'dusk', 'dawn', 'wit',
  'courage', 'daybreak', 'twilight', 'cheerful', 'conscience', 'morningMist',
  'calm', 'serenity', 'destiny', 'fate', 'relief',
  'verdantGreen', 'gem', 'resolve', 'grail', 'moonlight', 'sunlight',
  'crown', 'cloverLeaf', 'coin', 'blade', 'chalice', 'balance', 'harmony',
  'nobility', 'tenacity', 'determination', 'cycle', 'reincarnation', 'majesty',
  'omen', 'crescent',
  'blessing', 'focus', 'lapis', 'jade', 'emptyMind',
  'prologue', 'interlude', 'morningDew',
  'drizzle',
]
```

- [ ] **Step 4: テストを実行して成功を確認**

Run: `npm run test -- engine.test.ts`
Expected: PASS

- [ ] **Step 5: コミット**

```bash
git add src/lib/game/shidasu/engine.ts src/lib/game/shidasu/engine.test.ts
git commit -m "$(cat <<'EOF'
feat: ITEM_POOLにグループ4〜8の35個を追加(全55種類に)
EOF
)"
```

---

### Task 13: 管理画面(admin)に護符パラメータ入力欄を追加

**Files:**
- Modify: `src/routes/admin/shidasu/+page.svelte`

- [ ] **Step 1: 「護符パラメータ(グループ1〜3)」セクションの直後に新セクションを追加**

`src/routes/admin/shidasu/+page.svelte`の、`護符パラメータ(グループ1〜3)`の`</section>`(418行目付近、`フロー・UI`セクションの直前)の直後に、以下の新セクションを追加する:

```svelte
      <section class="bg-white border border-slate-200 rounded-xl p-4">
        <h2 class="font-semibold text-slate-700 text-sm mb-3">護符パラメータ(グループ4〜8)</h2>
        <div class="grid grid-cols-2 gap-3">
          <label class="text-xs text-slate-500">
            平穏: JQKなし加算(calm.n)
            <input type="number" min="0" step="1" bind:value={config.talismans.calm.n} class="mt-1 w-full border border-slate-200 rounded px-2 py-1 text-sm" />
          </label>
          <label class="text-xs text-slate-500">
            安寧: JQKなし倍率(serenity.x)
            <input type="number" min="0" step="0.1" bind:value={config.talismans.serenity.x} class="mt-1 w-full border border-slate-200 rounded px-2 py-1 text-sm" />
          </label>
          <label class="text-xs text-slate-500">
            運命: JQKのみ加算(destiny.n)
            <input type="number" min="0" step="1" bind:value={config.talismans.destiny.n} class="mt-1 w-full border border-slate-200 rounded px-2 py-1 text-sm" />
          </label>
          <label class="text-xs text-slate-500">
            宿命: JQKのみ倍率(fate.x)
            <input type="number" min="0" step="0.1" bind:value={config.talismans.fate.x} class="mt-1 w-full border border-slate-200 rounded px-2 py-1 text-sm" />
          </label>
          <label class="text-xs text-slate-500">
            安堵: 数札取得時加算(relief.n)
            <input type="number" min="0" step="1" bind:value={config.talismans.relief.n} class="mt-1 w-full border border-slate-200 rounded px-2 py-1 text-sm" />
          </label>
          <label class="text-xs text-slate-500">
            深緑: ♣専有倍率(verdantGreen.x)
            <input type="number" min="0" step="0.1" bind:value={config.talismans.verdantGreen.x} class="mt-1 w-full border border-slate-200 rounded px-2 py-1 text-sm" />
          </label>
          <label class="text-xs text-slate-500">
            宝石: ♦専有倍率(gem.x)
            <input type="number" min="0" step="0.1" bind:value={config.talismans.gem.x} class="mt-1 w-full border border-slate-200 rounded px-2 py-1 text-sm" />
          </label>
          <label class="text-xs text-slate-500">
            真剣: ♠専有倍率(resolve.x)
            <input type="number" min="0" step="0.1" bind:value={config.talismans.resolve.x} class="mt-1 w-full border border-slate-200 rounded px-2 py-1 text-sm" />
          </label>
          <label class="text-xs text-slate-500">
            聖杯: ♥専有倍率(grail.x)
            <input type="number" min="0" step="0.1" bind:value={config.talismans.grail.x} class="mt-1 w-full border border-slate-200 rounded px-2 py-1 text-sm" />
          </label>
          <label class="text-xs text-slate-500">
            月光: 黒専有倍率(moonlight.x)
            <input type="number" min="0" step="0.1" bind:value={config.talismans.moonlight.x} class="mt-1 w-full border border-slate-200 rounded px-2 py-1 text-sm" />
          </label>
          <label class="text-xs text-slate-500">
            陽光: 赤専有倍率(sunlight.x)
            <input type="number" min="0" step="0.1" bind:value={config.talismans.sunlight.x} class="mt-1 w-full border border-slate-200 rounded px-2 py-1 text-sm" />
          </label>
          <label class="text-xs text-slate-500">
            王冠: K枚数倍率(crown.x)
            <input type="number" min="0" step="0.01" bind:value={config.talismans.crown.x} class="mt-1 w-full border border-slate-200 rounded px-2 py-1 text-sm" />
          </label>
          <label class="text-xs text-slate-500">
            青葉: ♣枚数あたり加算(cloverLeaf.n)
            <input type="number" min="0" step="1" bind:value={config.talismans.cloverLeaf.n} class="mt-1 w-full border border-slate-200 rounded px-2 py-1 text-sm" />
          </label>
          <label class="text-xs text-slate-500">
            硬貨: ♦枚数あたり加算(coin.n)
            <input type="number" min="0" step="1" bind:value={config.talismans.coin.n} class="mt-1 w-full border border-slate-200 rounded px-2 py-1 text-sm" />
          </label>
          <label class="text-xs text-slate-500">
            武器: ♠枚数あたり加算(blade.n)
            <input type="number" min="0" step="1" bind:value={config.talismans.blade.n} class="mt-1 w-full border border-slate-200 rounded px-2 py-1 text-sm" />
          </label>
          <label class="text-xs text-slate-500">
            献杯: ♥枚数あたり加算(chalice.n)
            <input type="number" min="0" step="1" bind:value={config.talismans.chalice.n} class="mt-1 w-full border border-slate-200 rounded px-2 py-1 text-sm" />
          </label>
          <label class="text-xs text-slate-500">
            均衡: 赤黒同数加算(balance.n)
            <input type="number" min="0" step="1" bind:value={config.talismans.balance.n} class="mt-1 w-full border border-slate-200 rounded px-2 py-1 text-sm" />
          </label>
          <label class="text-xs text-slate-500">
            調和: 赤黒同数倍率(harmony.x)
            <input type="number" min="0" step="0.1" bind:value={config.talismans.harmony.x} class="mt-1 w-full border border-slate-200 rounded px-2 py-1 text-sm" />
          </label>
          <label class="text-xs text-slate-500">
            高潔: 同スートパターン加算(nobility.n)
            <input type="number" min="0" step="1" bind:value={config.talismans.nobility.n} class="mt-1 w-full border border-slate-200 rounded px-2 py-1 text-sm" />
          </label>
          <label class="text-xs text-slate-500">
            執念: 同スートパターン倍率(tenacity.x)
            <input type="number" min="0" step="0.01" bind:value={config.talismans.tenacity.x} class="mt-1 w-full border border-slate-200 rounded px-2 py-1 text-sm" />
          </label>
          <label class="text-xs text-slate-500">
            覚悟: 階段倍率(determination.x)
            <input type="number" min="0" step="0.01" bind:value={config.talismans.determination.x} class="mt-1 w-full border border-slate-200 rounded px-2 py-1 text-sm" />
          </label>
          <label class="text-xs text-slate-500">
            循環: K↔A遷移倍率(cycle.x)
            <input type="number" min="0" step="0.1" bind:value={config.talismans.cycle.x} class="mt-1 w-full border border-slate-200 rounded px-2 py-1 text-sm" />
          </label>
          <label class="text-xs text-slate-500">
            輪廻: K↔Aループ倍率(reincarnation.x)
            <input type="number" min="0" step="0.1" bind:value={config.talismans.reincarnation.x} class="mt-1 w-full border border-slate-200 rounded px-2 py-1 text-sm" />
          </label>
          <label class="text-xs text-slate-500">
            威光: 同スート全ランク階段倍率(majesty.x)
            <input type="number" min="0" step="0.1" bind:value={config.talismans.majesty.x} class="mt-1 w-full border border-slate-200 rounded px-2 py-1 text-sm" />
          </label>
          <label class="text-xs text-slate-500">
            兆し: 場札残数閾値(omen.m)
            <input type="number" min="0" step="1" bind:value={config.talismans.omen.m} class="mt-1 w-full border border-slate-200 rounded px-2 py-1 text-sm" />
          </label>
          <label class="text-xs text-slate-500">
            兆し: 倍率(omen.x)
            <input type="number" min="0" step="0.1" bind:value={config.talismans.omen.x} class="mt-1 w-full border border-slate-200 rounded px-2 py-1 text-sm" />
          </label>
          <label class="text-xs text-slate-500">
            三日月: 場札残数閾値(crescent.m)
            <input type="number" min="0" step="1" bind:value={config.talismans.crescent.m} class="mt-1 w-full border border-slate-200 rounded px-2 py-1 text-sm" />
          </label>
          <label class="text-xs text-slate-500">
            三日月: 倍率(crescent.x)
            <input type="number" min="0" step="0.1" bind:value={config.talismans.crescent.x} class="mt-1 w-full border border-slate-200 rounded px-2 py-1 text-sm" />
          </label>
          <label class="text-xs text-slate-500">
            恩寵: 役成立倍率(blessing.x)
            <input type="number" min="0" step="0.1" bind:value={config.talismans.blessing.x} class="mt-1 w-full border border-slate-200 rounded px-2 py-1 text-sm" />
          </label>
          <label class="text-xs text-slate-500">
            集中: 同ランク役倍率(focus.x)
            <input type="number" min="0" step="0.1" bind:value={config.talismans.focus.x} class="mt-1 w-full border border-slate-200 rounded px-2 py-1 text-sm" />
          </label>
          <label class="text-xs text-slate-500">
            瑠璃: 役2種類以上同時倍率(lapis.x)
            <input type="number" min="0" step="0.1" bind:value={config.talismans.lapis.x} class="mt-1 w-full border border-slate-200 rounded px-2 py-1 text-sm" />
          </label>
          <label class="text-xs text-slate-500">
            翡翠: ワイルド起因役加算(jade.n)
            <input type="number" min="0" step="1" bind:value={config.talismans.jade.n} class="mt-1 w-full border border-slate-200 rounded px-2 py-1 text-sm" />
          </label>
          <label class="text-xs text-slate-500">
            無心: 役・パターン無し倍率(emptyMind.x)
            <input type="number" min="0" step="0.1" bind:value={config.talismans.emptyMind.x} class="mt-1 w-full border border-slate-200 rounded px-2 py-1 text-sm" />
          </label>
          <label class="text-xs text-slate-500">
            序章: コンボ1枚目加算(prologue.n)
            <input type="number" min="0" step="1" bind:value={config.talismans.prologue.n} class="mt-1 w-full border border-slate-200 rounded px-2 py-1 text-sm" />
          </label>
          <label class="text-xs text-slate-500">
            幕間: 発動間隔(interlude.m)
            <input type="number" min="1" step="1" bind:value={config.talismans.interlude.m} class="mt-1 w-full border border-slate-200 rounded px-2 py-1 text-sm" />
          </label>
          <label class="text-xs text-slate-500">
            幕間: 加算量(interlude.n)
            <input type="number" min="0" step="1" bind:value={config.talismans.interlude.n} class="mt-1 w-full border border-slate-200 rounded px-2 py-1 text-sm" />
          </label>
          <label class="text-xs text-slate-500">
            朝露: ウェーブ最初のプレイ加算(morningDew.n)
            <input type="number" min="0" step="1" bind:value={config.talismans.morningDew.n} class="mt-1 w-full border border-slate-200 rounded px-2 py-1 text-sm" />
          </label>
          <label class="text-xs text-slate-500">
            小雨: 無条件加算(drizzle.n)
            <input type="number" min="0" step="1" bind:value={config.talismans.drizzle.n} class="mt-1 w-full border border-slate-200 rounded px-2 py-1 text-sm" />
          </label>
        </div>
      </section>
```

- [ ] **Step 2: ビルドが通ることを確認**

Run: `npm run build`
Expected: 型エラーなく成功

- [ ] **Step 3: 開発サーバーで表示を確認**

Run: `npm run dev`

ブラウザで`http://localhost:5173/admin/shidasu`を開き、「護符パラメータ(グループ4〜8)」セクションが表示され、既定値(平穏=200等)が入力欄に反映されていることを目視確認する。

- [ ] **Step 4: コミット**

```bash
git add src/routes/admin/shidasu/+page.svelte
git commit -m "$(cat <<'EOF'
feat: 管理画面にShidasu護符グループ4〜8のパラメータ入力欄を追加
EOF
)"
```

---

### Task 14: 最終検証とドキュメント更新

**Files:**
- Modify: `docs/shidasu-gofu-candidates.md`
- Test: 全体テストスイート・ビルド・ブラウザ動作確認

- [ ] **Step 1: 全体テストスイートを実行**

Run: `npm run test`
Expected: 全テストPASS(グループ1〜3を含む既存テストも壊れていないこと)

- [ ] **Step 2: ビルドを実行**

Run: `npm run build`
Expected: 成功

- [ ] **Step 3: `docs/shidasu-gofu-candidates.md`のグループ4〜8見出しに実装済みマークを追加**

`docs/shidasu-gofu-candidates.md`内、以下5箇所の見出しをそれぞれ書き換える:

```
### グループ4: チェーン全体(コンボ中の全カード)の属性で判定する取得時加算/倍算(24個)
```
→
```
### グループ4: チェーン全体(コンボ中の全カード)の属性で判定する取得時加算/倍算(24個)【実装済み: 2026-07-14】
```

```
### グループ5: 場札・山札の残り枚数で判定する取得時倍算(2個)
```
→
```
### グループ5: 場札・山札の残り枚数で判定する取得時倍算(2個)【実装済み: 2026-07-14】
```

```
### グループ6: 役・パターン成立状況(既存フラグ)に依存する加算/倍算(5個)
```
→
```
### グループ6: 役・パターン成立状況(既存フラグ)に依存する加算/倍算(5個)【実装済み: 2026-07-14】
```

```
### グループ7: コンボ内の位置(1枚目/m枚目/ウェーブ最初)で判定する取得時加算(3個)
```
→
```
### グループ7: コンボ内の位置(1枚目/m枚目/ウェーブ最初)で判定する取得時加算(3個)【実装済み: 2026-07-14】
```

```
### グループ8: 無条件固定加算(1個)
```
→
```
### グループ8: 無条件固定加算(1個)【実装済み: 2026-07-14】
```

- [ ] **Step 4: 開発サーバーでブラウザ動作確認**

Run: `npm run dev`

`http://localhost:5173/game/shidasu`を開き、新規追加した護符が実際にウェーブクリア時の選択肢として出現しうること(`rollItemOffer`がプール55個から抽選すること)を確認する。デバッグパネル等で特定の護符を所持した状態を作れる場合は、代表的に1〜2個(例: 小雨・平穏)を所持させてプレイし、`lastGain.parts`にその護符の内訳が表示されることを目視確認する。

- [ ] **Step 5: コミット**

```bash
git add docs/shidasu-gofu-candidates.md
git commit -m "$(cat <<'EOF'
docs: Shidasu護符候補一覧のグループ4〜8に実装済みマークを追加
EOF
)"
```

---

## 完了条件(specの受け入れ基準との対応)

1. `ITEM_EFFECTS`に35個全ての効果が登録されており、正しいチャンネル・順序で適用される → Task 4〜11
2. スート/色専有系はワイルドを都合よく解釈する → Task 5
3. 枚数カウント系はワイルドを枚数に含める → Task 6
4. 均衡・調和は`|実赤-実黒| <= ワイルド数`で成立する → Task 6
5. 循環はK/Aいずれかがワイルドの場合も都合よく成立する → Task 7
6. 輪廻・威光はワイルドで橋渡しされた区間内のK↔Aループ越えも検出できる → Task 2, 7
7. グループ6は`roleFired`/`patternFired`を正しく参照し、列一掃も`roleFired`に含まれる → Task 2, 3, 9
8. 朝露はウェーブの最初のプレイでのみ発動する → Task 1, 3, 10
9. `npm run test`・`npm run build`が成功する → Task 14
