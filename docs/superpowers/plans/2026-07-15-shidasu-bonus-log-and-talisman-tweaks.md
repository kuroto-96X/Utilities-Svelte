# Shidasu 獲得点ログ拡張・架橋/寛容効果変更・デバッグサンドボックス機能追加 Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** 全消しボーナス・護符による直接加算を獲得点ログに別枠表示し、架橋・寛容の護符効果を「-m枚緩和」方式に変更し、`/admin/shidasu-debug`にスート統一・階段化・護符一括チェックのボタンを追加する。

**Architecture:** 通常のプレイ得点(`WaveState.lastGain`、型は変更しない)とは別に、新フィールド`WaveState.lastBonusGains: BonusGain[]`を追加し、全消しボーナス・護符の直接加算(コンボリセット時/山札切れ時/コンボ到達時/パターン継続時の4チャンネル)をそこに積む。既存の`lastGain`関連テスト・呼び出し元は型変更なしでそのまま動作する。架橋・寛容は`items.*`の共有パラメータから`talismans.bridge.m`/`talismans.grace.m`という護符固有パラメータへ移行する。

**Tech Stack:** SvelteKit + Svelte 5 runes、TypeScript、Vitest。

---

## 前提知識(実装前に把握しておくこと)

- `WaveState.lastGain: ScoreGain | null`(`types.ts`)は**型を変更しない**。既存の15件超のテスト・3箇所のUI表示コードはそのまま動作する。
- 新設する`BonusGain`型・`lastBonusGains: BonusGain[]`フィールドが、全消しボーナスと護符の直接加算を別枠で保持する。「別枠」なので`lastGain`と混ぜない。
- `applyDirectEffects(channel, items, ctx, params): number`(`engine.ts:1190`)は現在、発動額の合計だけを返す。`applyItemEffects`と同様に`{ value: number; parts: string[] }`を返すよう拡張する。
- 直接加算(`DIRECT_EFFECTS`, `engine.ts:1163`)の対象護符は6つ、4チャンネルに分かれる: `resetDirect`(沈着・冷静・残響)・`stockEmptyDirect`(慢心)・`comboMilestoneDirect`(流星)・`drawContinueDirect`(誠実)。
- `playCard`が全消し成立時に返す`lastGain`へ全消しボーナスをマージする実装(コミット`50c48cf`)は、今回`lastBonusGains`への分離に置き換える(`lastGain`は本来のプレイ得点のみに戻す)。
- 架橋の護符は現在`items.stairRelaxedMinLen`(固定値)を階段成立枚数の代わりに使う(`engine.ts:163,418`)。これを`talismans.scoring.stairMinLen - talismans.bridge.m`という相対計算に変更し、さらに同スート・同色の成立枚数(`scoring.suitColorMinLen`)にも同じ`m`を適用する。
- 寛容の護符は現在`items.columnSweepRelaxCards`(共有パラメータ)を使う(`engine.ts:182`)。これを`talismans.grace.m`(護符固有パラメータ)に置き換えるだけで、計算式自体(`rows - m`以下なら成立)は変えない。
- `evaluateChainBonus`・`chainContinuesPattern`(`engine.ts:1653,1743`)は既に`stairMinLen`のオーバーライド引数を持つ。同じパターンで`suitColorMinLen`のオーバーライド引数を追加する。
- `/admin/shidasu-debug`はドラッグ&ドロップでカードを入れ替える独立サンドボックス(`src/routes/admin/shidasu-debug/`)。`tableau: Card[][]`の各列は配列の**末尾**が「一番手前(取得対象)」。
- `npm run check`(型チェック)は`npm run build`では検出されないため、各タスクで必ず実行する。

---

## ファイル構成

- `src/lib/game/shidasu/types.ts`(修正): `BonusGain`型・`WaveState.lastBonusGains`追加
- `src/lib/game/shidasu/engine.ts`(修正): 本feature の中心。多数の関数を修正
- `src/lib/game/shidasu/params.ts`(修正): `talismans.bridge`/`talismans.grace`に`m`追加、`items.stairRelaxedMinLen`/`items.columnSweepRelaxCards`削除
- `src/lib/game/shidasu/shidasu.config.json`(修正): 同上
- `src/lib/game/shidasu/engine.test.ts`(修正): 新規テスト追加、テストヘルパーに`lastBonusGains: []`追加
- `src/routes/game/shidasu/DebugPanel.svelte`(修正): ログ表示を`lastBonusGains`対応に拡張
- `src/routes/game/shidasu/+page.svelte`(修正): 得点ポップアップを`lastBonusGains`対応に拡張
- `src/routes/admin/shidasu/+page.svelte`(修正): 「アイテム」セクションから2項目削除
- `src/routes/admin/shidasu-debug/+page.svelte`(修正): `lastBonusGains: []`リセット追加、スート統一・階段化ボタン追加
- `src/routes/admin/shidasu-debug/CardPalette.svelte`(修正): スート統一ボタン追加
- `src/routes/admin/shidasu-debug/ItemChecklist.svelte`(修正): 全チェック/全解除ボタン追加

---

### Task 1: `BonusGain`型・`lastBonusGains`フィールドを追加する

**Files:**
- Modify: `src/lib/game/shidasu/types.ts`
- Modify: `src/lib/game/shidasu/engine.ts`(`startWave`)
- Modify: `src/lib/game/shidasu/engine.test.ts`(`makeWave`ヘルパー)

- [ ] **Step 1: 型を追加する**

`src/lib/game/shidasu/types.ts`の

```ts
export interface ScoreGain {
  points: number
  parts: string[]
}
```

の直後に、以下を追加する。

```ts

// 全消しボーナス・護符による直接加算など、通常のプレイ得点(ScoreGain/lastGain)とは
// 別枠でログ表示する得点イベント。labelでイベント種別を表す。
export interface BonusGain {
  label: string
  points: number
  parts: string[]
}
```

`WaveState`インターフェース内、`lastGain: ScoreGain | null`の直後に以下を追加する。

```ts
  // このアクションで発生した、lastGainとは別枠の得点(全消しボーナス・護符の直接加算)。
  // 何も発生しなければ空配列。
  lastBonusGains: BonusGain[]
```

- [ ] **Step 2: `startWave`の初期状態に追加する**

`src/lib/game/shidasu/engine.ts`の`startWave`内、`WaveState`オブジェクトリテラルの`lastGain: null,`の直後に以下を追加する。

```ts
    lastBonusGains: [],
```

- [ ] **Step 3: テストヘルパーに追加する**

`src/lib/game/shidasu/engine.test.ts`の`makeWave`関数内、`lastGain: null,`の直後に以下を追加する。

```ts
    lastBonusGains: [],
```

- [ ] **Step 4: 型チェック**

Run: `npm run check`
Expected: `WaveState`を構成する既存の全箇所(`engine.ts`の`next`オブジェクト、`drawStock`の2つの返り値、テストの他のヘルパー等)で`lastBonusGains`が不足しているというエラーが出る。これは想定通り(Step 5-6で全て埋める)。

- [ ] **Step 5: `playCard`の`next`オブジェクトに追加する**

`src/lib/game/shidasu/engine.ts`の`playCard`内、`next`オブジェクトリテラルの最後のフィールド`sameRankEchoUsedThisCombo: newSameRankEchoUsedThisCombo,`の直後に以下を追加する。

```ts
    lastBonusGains: [],
```

- [ ] **Step 6: `drawStock`の2つの返り値に追加する**

`src/lib/game/shidasu/engine.ts`の`drawStock`内、1つ目の返り値(`patternContinues`分岐、`flushActiveThisCombo: naiveFlushActiveThisCombo,`の直後)と、2つ目の返り値(リセット分岐、`mercyActiveNextCombo: wave.combo <= params.talismans.mercy.c,`の直後)の両方に、それぞれ以下を追加する。

```ts
        lastBonusGains: [],
```

- [ ] **Step 7: 型チェック・テストを実行して成功を確認する**

Run: `npm run check && npm run test`
Expected: どちらもエラーなく成功(既存690テスト全て成功、新規テストはまだ無い)

- [ ] **Step 8: コミット**

```bash
git add src/lib/game/shidasu/types.ts src/lib/game/shidasu/engine.ts src/lib/game/shidasu/engine.test.ts
git commit -m "$(cat <<'EOF'
feat: 全消しボーナス等を表示するための別枠フィールドlastBonusGainsを追加

通常のプレイ得点(lastGain)とは型を変えず、全消しボーナス・護符の
直接加算を別枠で表示するためのWaveState.lastBonusGainsフィールドを
追加した。この時点ではまだ何も積まれない(空配列のみ)。
EOF
)"
```

---

### Task 2: `applyDirectEffects`をparts追跡対応に拡張する

**Files:**
- Modify: `src/lib/game/shidasu/engine.ts`
- Test: `src/lib/game/shidasu/engine.test.ts`

- [ ] **Step 1: 失敗するテストを書く**

`src/lib/game/shidasu/engine.test.ts`の末尾(ファイル最終行の直前)に以下を追加する。

```ts

describe('applyDirectEffects', () => {
  test('発動した護符の内訳(parts)を護符名付きで返す', () => {
    const ctx: DirectEffectContext = {
      comboBeforeReset: 3,
      hasPlayableColumns: false,
      roleFiredThisChain: false,
      remainingTableauCount: 0,
      combo: 0,
      colorHeld: false,
    }
    const result = applyDirectEffects('resetDirect', ['composure'], ctx, DEFAULT_PARAMS)
    expect(result.value).toBe(DEFAULT_PARAMS.talismans.composure.n)
    expect(result.parts).toContain(`沈着+${DEFAULT_PARAMS.talismans.composure.n}`)
  })

  test('発動しなかった護符はpartsに含まれない', () => {
    const ctx: DirectEffectContext = {
      comboBeforeReset: 3,
      hasPlayableColumns: true, // composureは不発火条件
      roleFiredThisChain: true, // clarityは不発火条件
      remainingTableauCount: 0,
      combo: 0,
      colorHeld: false,
    }
    const result = applyDirectEffects('resetDirect', ['composure', 'clarity'], ctx, DEFAULT_PARAMS)
    expect(result.value).toBe(0)
    expect(result.parts).toEqual([])
  })

  test('該当チャンネルの護符を複数所持していれば両方partsに含まれる', () => {
    const ctx: DirectEffectContext = {
      comboBeforeReset: 2,
      hasPlayableColumns: false,
      roleFiredThisChain: false,
      remainingTableauCount: 0,
      combo: 0,
      colorHeld: false,
    }
    const result = applyDirectEffects('resetDirect', ['composure', 'clarity'], ctx, DEFAULT_PARAMS)
    expect(result.value).toBe(DEFAULT_PARAMS.talismans.composure.n + DEFAULT_PARAMS.talismans.clarity.n)
    expect(result.parts).toContain(`沈着+${DEFAULT_PARAMS.talismans.composure.n}`)
    expect(result.parts).toContain(`冷静+${DEFAULT_PARAMS.talismans.clarity.n}`)
  })
})
```

`DirectEffectContext`のimportが無ければ、`engine.test.ts`冒頭のimport文に追加する(既に他の型と一緒にimportされている場合は不要)。

- [ ] **Step 2: テストを実行して失敗を確認する**

Run: `npx vitest run engine.test -t "applyDirectEffects"`
Expected: FAIL(`result.parts`が`undefined`、`applyDirectEffects`は現状`number`を返すため`.value`/`.parts`アクセスが失敗する)

- [ ] **Step 3: `applyDirectEffects`を実装する**

`src/lib/game/shidasu/engine.ts`の

```ts
export function applyDirectEffects(
  channel: DirectChannel,
  items: ItemId[],
  ctx: DirectEffectContext,
  params: ShidasuParams
): number {
  return items.reduce((total, id) => {
    const entry = DIRECT_EFFECTS[id]
    if (!entry || entry.channel !== channel) return total
    return total + entry.effect(ctx, params)
  }, 0)
}
```

を、以下に置き換える。

```ts
export function applyDirectEffects(
  channel: DirectChannel,
  items: ItemId[],
  ctx: DirectEffectContext,
  params: ShidasuParams
): { value: number; parts: string[] } {
  const parts: string[] = []
  const value = items.reduce((total, id) => {
    const entry = DIRECT_EFFECTS[id]
    if (!entry || entry.channel !== channel) return total
    const amount = entry.effect(ctx, params)
    if (amount !== 0) parts.push(`${itemName(id, params)}+${amount}`)
    return total + amount
  }, 0)
  return { value, parts }
}
```

- [ ] **Step 4: 呼び出し元4箇所を`.value`を使うよう修正する(暫定、partsはまだ使わない)**

`src/lib/game/shidasu/engine.ts`内、以下4箇所を修正する。

`playCard`内(1箇所):

```ts
  gained += applyDirectEffects('comboMilestoneDirect', items, milestoneCtx, params)
```

を、以下に置き換える。

```ts
  const milestoneResult = applyDirectEffects('comboMilestoneDirect', items, milestoneCtx, params)
  gained += milestoneResult.value
```

`drawStock`内(3箇所):

```ts
    scoreAfterStockEmpty += applyDirectEffects('stockEmptyDirect', items, stockEmptyCtx, params)
```

を、以下に置き換える。

```ts
    const stockEmptyResult = applyDirectEffects('stockEmptyDirect', items, stockEmptyCtx, params)
    scoreAfterStockEmpty += stockEmptyResult.value
```

```ts
    const directGain = wouldContinue ? applyDirectEffects('drawContinueDirect', items, drawContinueCtx, params) : 0
```

を、以下に置き換える。

```ts
    const drawContinueResult = wouldContinue
      ? applyDirectEffects('drawContinueDirect', items, drawContinueCtx, params)
      : { value: 0, parts: [] }
    const directGain = drawContinueResult.value
```

```ts
  const resetDirectGain = applyDirectEffects('resetDirect', items, resetCtx, params)
```

を、以下に置き換える。

```ts
  const resetResult = applyDirectEffects('resetDirect', items, resetCtx, params)
  const resetDirectGain = resetResult.value
```

`stockEmptyResult`は`if (newStock.length === 0) { ... }`ブロックの外(関数スコープ)で参照できるよう、ブロック直前で`let stockEmptyResult: { value: number; parts: string[] } = { value: 0, parts: [] }`と宣言してから、ブロック内で代入する形にする。具体的には、`drawStock`内の

```ts
  let scoreAfterStockEmpty = wave.score
  if (newStock.length === 0) {
    const stockEmptyCtx: DirectEffectContext = {
      comboBeforeReset: 0,
      hasPlayableColumns: true,
      roleFiredThisChain: false,
      remainingTableauCount: remainingCount(wave.tableau),
      combo: wave.combo,
      colorHeld: false,
    }
    const stockEmptyResult = applyDirectEffects('stockEmptyDirect', items, stockEmptyCtx, params)
    scoreAfterStockEmpty += stockEmptyResult.value
  }
```

を、以下に置き換える。

```ts
  let scoreAfterStockEmpty = wave.score
  let stockEmptyResult: { value: number; parts: string[] } = { value: 0, parts: [] }
  if (newStock.length === 0) {
    const stockEmptyCtx: DirectEffectContext = {
      comboBeforeReset: 0,
      hasPlayableColumns: true,
      roleFiredThisChain: false,
      remainingTableauCount: remainingCount(wave.tableau),
      combo: wave.combo,
      colorHeld: false,
    }
    stockEmptyResult = applyDirectEffects('stockEmptyDirect', items, stockEmptyCtx, params)
    scoreAfterStockEmpty += stockEmptyResult.value
  }
```

- [ ] **Step 5: テストを実行して成功を確認する**

Run: `npm run test`
Expected: 全テスト成功(applyDirectEffectsの新規3件を含む)

- [ ] **Step 6: 型チェック・ビルド**

Run: `npm run check && npm run build`
Expected: どちらもエラーなく成功

- [ ] **Step 7: コミット**

```bash
git add src/lib/game/shidasu/engine.ts src/lib/game/shidasu/engine.test.ts
git commit -m "$(cat <<'EOF'
refactor: applyDirectEffectsが発動護符の内訳(parts)も返すよう拡張

applyItemEffectsと同様に、発動した護符ごとの内訳文字列を追跡できる
ようにした。呼び出し元は暫定的に.valueのみ使用し、partsは次タスクで
lastBonusGainsへの反映に使う。
EOF
)"
```

---

### Task 3: `playCard`で全消しボーナス・流星(comboMilestoneDirect)を`lastBonusGains`に積む

**Files:**
- Modify: `src/lib/game/shidasu/engine.ts`
- Modify: `src/lib/game/shidasu/engine.test.ts`

- [ ] **Step 1: 失敗するテストを書く**

`src/lib/game/shidasu/engine.test.ts`内、Task 1で確認した既存テスト`'全消し時、lastGainに全消しボーナスの内訳が含まれる'`(`describe('playCard', ...)`ブロック内)を、以下に置き換える(このテストは今回の設計変更でlastGainではなくlastBonusGainsを見るテストに変わる)。

```ts
  test('全消し時、lastBonusGainsに全消しボーナスが別枠で入る(lastGainはプレイ得点のみ)', () => {
    const wave = baseWave({
      tableau: [[card(1, '♣', 6)]],
      stock: [card(9, '♠', 1), card(10, '♠', 2)],
      comboStreakColumnLengths: [DEFAULT_PARAMS.layout.rows],
    })
    const next = playCard(DEFAULT_PARAMS, wave, 'none', [], 100000000, 0)
    const expectedClearBonus = scoring.clearBonus + 2 * scoring.clearBonusPerStock
    const expectedPlayGain = scoring.basePoint + scoring.columnSweepBonus * 1
    expect(next.lastGain?.points).toBe(expectedPlayGain)
    expect(next.lastGain?.parts).not.toContain(`全消しボーナス+${expectedClearBonus}`)
    expect(next.lastBonusGains).toHaveLength(1)
    expect(next.lastBonusGains[0].label).toBe('全消しボーナス')
    expect(next.lastBonusGains[0].points).toBe(expectedClearBonus)
    expect(next.lastBonusGains[0].parts).toContain(`基礎+${scoring.clearBonus}`)
    expect(next.lastBonusGains[0].parts).toContain(`山札残数+${2 * scoring.clearBonusPerStock}`)
    expect(next.score).toBe(expectedPlayGain + expectedClearBonus)
  })

  test('流星の護符でコンボが到達値になった瞬間、lastBonusGainsに直接加算が別枠で入る', () => {
    const items: ItemId[] = ['shootingStar']
    const wave = baseWave({
      combo: DEFAULT_PARAMS.talismans.shootingStar.c - 1,
      chain: [card(20, '♥', 3), card(21, '♦', 4)],
    })
    const next = playCard(DEFAULT_PARAMS, wave, 'none', items, 100000000, 0)
    expect(next.combo).toBe(DEFAULT_PARAMS.talismans.shootingStar.c)
    expect(next.lastBonusGains).toHaveLength(1)
    expect(next.lastBonusGains[0].label).toBe('護符による直接加算')
    expect(next.lastBonusGains[0].points).toBe(DEFAULT_PARAMS.talismans.shootingStar.n)
    expect(next.lastBonusGains[0].parts).toContain(`流星+${DEFAULT_PARAMS.talismans.shootingStar.n}`)
  })
```

- [ ] **Step 2: テストを実行して失敗を確認する**

Run: `npx vitest run engine.test -t "全消し時、lastBonusGainsに全消しボーナスが別枠で入る"`
Run: `npx vitest run engine.test -t "流星の護符でコンボが到達値になった瞬間"`
Expected: 両方ともFAIL(`lastBonusGains`が空配列のまま)

- [ ] **Step 3: `playCard`を実装する**

`src/lib/game/shidasu/engine.ts`の`playCard`内、以下の箇所

```ts
  const milestoneResult = applyDirectEffects('comboMilestoneDirect', items, milestoneCtx, params)
  gained += milestoneResult.value

  const newScore = wave.score + gained

  const next: WaveState = {
```

を、以下に置き換える。

```ts
  const milestoneResult = applyDirectEffects('comboMilestoneDirect', items, milestoneCtx, params)
  gained += milestoneResult.value

  const newScore = wave.score + gained

  const bonusGains: BonusGain[] = []
  if (milestoneResult.parts.length > 0) {
    bonusGains.push({ label: '護符による直接加算', points: milestoneResult.value, parts: milestoneResult.parts })
  }

  const next: WaveState = {
```

同じ`playCard`内、`next`オブジェクトリテラルに追加した`lastBonusGains: [],`(Task 1 Step 5で追加済み)を、以下に置き換える。

```ts
    lastBonusGains: bonusGains,
```

続けて、全消し分岐

```ts
  if (remainingBeforeRevival === 0) {
    const rawClearBonus = params.scoring.clearBonus + wave.stock.length * params.scoring.clearBonusPerStock
    const clearBonus = Math.floor(applyItemEffects('clearBonus', rawClearBonus, items, itemEffectCtx, params).value)
    const scoreAfterClear = newScore + clearBonus
    const lastGainWithClearBonus = { points: gained + clearBonus, parts: [...parts, `全消しボーナス+${clearBonus}`] }

    if (regenerationRevivedNow) {
      // 再配布そのものは上で(治癒より先に)実行済み。ここではコスト計算とスコア反映のみ行う。
      const cost = Math.floor(scoreAfterClear * params.talismans.regeneration.p / 100)
      return { ...next, score: scoreAfterClear - cost, lastGain: lastGainWithClearBonus, status: 'playing', endReason: null }
    }

    if (remaining === 0) {
      // 治癒・再生いずれも介入しなかった(通常の全消し)
      return { ...next, score: scoreAfterClear, lastGain: lastGainWithClearBonus, status: 'ended', endReason: 'fullClear' }
    }
    // 治癒が介入して場が復活した場合は全消しにならず、全消しボーナスも付与しない。
    // 通常のプレイ続行として下のフローへ進む。
  }
```

を、以下に置き換える。

```ts
  if (remainingBeforeRevival === 0) {
    const rawClearBonus = params.scoring.clearBonus + wave.stock.length * params.scoring.clearBonusPerStock
    const clearBonusResult = applyItemEffects('clearBonus', rawClearBonus, items, itemEffectCtx, params)
    const clearBonus = Math.floor(clearBonusResult.value)
    const scoreAfterClear = newScore + clearBonus
    const clearBonusGain: BonusGain = {
      label: '全消しボーナス',
      points: clearBonus,
      parts: [
        `基礎+${params.scoring.clearBonus}`,
        `山札残数+${wave.stock.length * params.scoring.clearBonusPerStock}`,
        ...clearBonusResult.parts,
      ],
    }
    const bonusGainsWithClear = [...bonusGains, clearBonusGain]

    if (regenerationRevivedNow) {
      // 再配布そのものは上で(治癒より先に)実行済み。ここではコスト計算とスコア反映のみ行う。
      const cost = Math.floor(scoreAfterClear * params.talismans.regeneration.p / 100)
      return { ...next, score: scoreAfterClear - cost, lastBonusGains: bonusGainsWithClear, status: 'playing', endReason: null }
    }

    if (remaining === 0) {
      // 治癒・再生いずれも介入しなかった(通常の全消し)
      return { ...next, score: scoreAfterClear, lastBonusGains: bonusGainsWithClear, status: 'ended', endReason: 'fullClear' }
    }
    // 治癒が介入して場が復活した場合は全消しにならず、全消しボーナスも付与しない。
    // 通常のプレイ続行として下のフローへ進む。
  }
```

最後に、`engine.ts`冒頭のimport文

```ts
import type { Card, StageModifier, WaveState, ItemId, WaveEndReason, RunState, Suit, Rank, DeckCard, RoleName } from './types'
```

を、以下に置き換える。

```ts
import type { Card, StageModifier, WaveState, ItemId, WaveEndReason, RunState, Suit, Rank, DeckCard, RoleName, BonusGain } from './types'
```

- [ ] **Step 4: テストを実行して成功を確認する**

Run: `npm run test`
Expected: 全テスト成功

- [ ] **Step 5: 型チェック・ビルド**

Run: `npm run check && npm run build`
Expected: どちらもエラーなく成功

- [ ] **Step 6: コミット**

```bash
git add src/lib/game/shidasu/engine.ts src/lib/game/shidasu/engine.test.ts
git commit -m "$(cat <<'EOF'
feat: playCardで全消しボーナス・流星の直接加算をlastBonusGainsに分離

コミット50c48cfで暫定的にlastGainへマージしていた全消しボーナスを、
新設のlastBonusGains(内訳付き)へ分離した。lastGainは本来のプレイ
得点のみを表すようになる。あわせて流星(comboMilestoneDirect)の
直接加算もlastBonusGainsに反映されるようにした。
EOF
)"
```

---

### Task 4: `drawStock`で慢心・沈着/冷静/残響・誠実を`lastBonusGains`に積む

**Files:**
- Modify: `src/lib/game/shidasu/engine.ts`
- Modify: `src/lib/game/shidasu/engine.test.ts`

- [ ] **Step 1: 失敗するテストを書く**

`src/lib/game/shidasu/engine.test.ts`の`describe('drawStock', ...)`ブロック内(無ければファイル内で`drawStock`をテストしている`describe`ブロックを探して追加する)に、以下を追加する。

```ts
  test('慢心の護符: 山札が尽きた瞬間、lastBonusGainsに直接加算が別枠で入る', () => {
    const items: ItemId[] = ['arrogance']
    const wave = makeWave({
      foundation: card(0, '♠', 5),
      tableau: [[card(1, '♣', 6)], [card(2, '♦', 2)]],
      stock: [card(9, '♠', 9)],
      chain: [card(0, '♠', 5)],
      linked: false,
    })
    const { wave: next } = drawStock(DEFAULT_PARAMS, wave, items, standardDeckComposition(), 'none')
    const remainingTableau = 2
    const expected = remainingTableau * DEFAULT_PARAMS.talismans.arrogance.x
    expect(next.lastBonusGains.some(g => g.label === '護符による直接加算' && g.parts.includes(`慢心+${expected}`))).toBe(true)
  })

  test('沈着・冷静の護符: コンボリセット時、lastBonusGainsに直接加算がまとめて別枠で入る', () => {
    const items: ItemId[] = ['composure', 'clarity']
    const wave = makeWave({
      foundation: card(0, '♠', 5),
      // 新しいfoundationになるdrawnCard(rank9)との差が1でも12でもないため、
      // drawStockのリセット分岐でhasPlayableColumns=falseになる(沈着の発火条件)
      tableau: [[card(1, '♣', 6)]],
      stock: [card(9, '♠', 9)],
      chain: [card(0, '♠', 5)],
      linked: false,
      roleFiredThisChain: false,
    })
    const { wave: next } = drawStock(DEFAULT_PARAMS, wave, items, standardDeckComposition(), 'none')
    const entry = next.lastBonusGains.find(g => g.label === '護符による直接加算')
    expect(entry).toBeDefined()
    expect(entry?.parts).toContain(`沈着+${DEFAULT_PARAMS.talismans.composure.n}`)
    expect(entry?.parts).toContain(`冷静+${DEFAULT_PARAMS.talismans.clarity.n}`)
  })

  test('誠実の護符: 山札めくりで同色(同スートではない)パターン継続した時、lastBonusGainsに直接加算が別枠で入る', () => {
    const items: ItemId[] = ['sincerity']
    // sincerityはctx.colorHeld(=colorHeld && !suitHeld、つまり「同色だが同スートではない」)でのみ
    // 発火する。チェーンを赤2スート(♥・♦)混在にして、同スートは崩しつつ同色は保つ。
    const wave = makeWave({
      foundation: card(0, '♥', 3),
      tableau: [[card(1, '♣', 6)], [card(2, '♦', 2)]],
      stock: [card(9, '♦', 7)],
      chain: [card(20, '♥', 3), card(21, '♦', 9), card(22, '♥', 2)],
      linked: true,
    })
    const { wave: next } = drawStock(DEFAULT_PARAMS, wave, items, standardDeckComposition(), 'none')
    expect(next.lastDrawEffect).toBe('pattern')
    expect(next.lastBonusGains.some(g => g.label === '護符による直接加算' && g.parts.includes(`誠実+${DEFAULT_PARAMS.talismans.sincerity.n}`))).toBe(true)
  })
```

`standardDeckComposition`のimportが無ければ、`engine.test.ts`冒頭のimportに`import { standardDeckComposition } from './deck'`を追加する(既にimport済みの場合は不要)。

- [ ] **Step 2: テストを実行して失敗を確認する**

Run: `npx vitest run engine.test -t "慢心の護符"`
Run: `npx vitest run engine.test -t "沈着・冷静の護符"`
Run: `npx vitest run engine.test -t "誠実の護符"`
Expected: 3件ともFAIL(`lastBonusGains`が空配列のまま)

- [ ] **Step 3: `drawStock`を実装する**

`src/lib/game/shidasu/engine.ts`の`drawStock`内、`patternContinues`分岐の返り値

```ts
    return {
      wave: {
        ...wave,
        stock: items.includes('promise') ? arrangeNextCardForContinuation(params.scoring, newStock, [...wave.chain, drawnCard], effectiveStairMinLen) : newStock,
        foundation: drawnCard,
        combo: naiveCombo,
        chain: [...wave.chain, drawnCard],
        chainOrigin: [...wave.chainOrigin, 'draw'],
        linked: true,
        lastDrawEffect: drawnCard.wild ? 'wild' : 'pattern',
        lastGain: naiveGained > 0 ? { points: naiveGained, parts: naiveParts } : null,
        score: scoreAfterStockEmpty + directGain + naiveGained,
        drawContinueCountThisChain: newDrawContinueCount,
        benevolenceUsedThisCombo: benevolenceFires ? true : wave.benevolenceUsedThisCombo,
        maxComboThisWave: Math.max(wave.maxComboThisWave, naiveCombo),
        roleFiredThisChain: naiveRoleFiredThisChain,
        flushActiveThisCombo: naiveFlushActiveThisCombo,
        lastBonusGains: [],
      },
      deckComposition,
    }
```

を、以下に置き換える。

```ts
    const patternContinueBonusGains: BonusGain[] = []
    if (stockEmptyResult.parts.length > 0) {
      patternContinueBonusGains.push({ label: '護符による直接加算', points: stockEmptyResult.value, parts: stockEmptyResult.parts })
    }
    if (drawContinueResult.parts.length > 0) {
      patternContinueBonusGains.push({ label: '護符による直接加算', points: drawContinueResult.value, parts: drawContinueResult.parts })
    }

    return {
      wave: {
        ...wave,
        stock: items.includes('promise') ? arrangeNextCardForContinuation(params.scoring, newStock, [...wave.chain, drawnCard], effectiveStairMinLen) : newStock,
        foundation: drawnCard,
        combo: naiveCombo,
        chain: [...wave.chain, drawnCard],
        chainOrigin: [...wave.chainOrigin, 'draw'],
        linked: true,
        lastDrawEffect: drawnCard.wild ? 'wild' : 'pattern',
        lastGain: naiveGained > 0 ? { points: naiveGained, parts: naiveParts } : null,
        score: scoreAfterStockEmpty + directGain + naiveGained,
        drawContinueCountThisChain: newDrawContinueCount,
        benevolenceUsedThisCombo: benevolenceFires ? true : wave.benevolenceUsedThisCombo,
        maxComboThisWave: Math.max(wave.maxComboThisWave, naiveCombo),
        roleFiredThisChain: naiveRoleFiredThisChain,
        flushActiveThisCombo: naiveFlushActiveThisCombo,
        lastBonusGains: patternContinueBonusGains,
      },
      deckComposition,
    }
```

続けて、リセット分岐の返り値

```ts
  const resetResult = applyDirectEffects('resetDirect', items, resetCtx, params)
  const resetDirectGain = resetResult.value

  return {
    wave: {
      ...wave,
      stock: items.includes('promise') ? arrangeNextCardForContinuation(params.scoring, newStock, [card], effectiveStairMinLen) : newStock,
      foundation: card,
      combo: items.includes('sanctify') ? wave.baseComboCount : 0,
      chain: [card],
      chainOrigin: ['draw'],
      linked: false,
      columnsEmptiedThisCombo: 0,
      comboStreakColumnLengths: wave.tableau.map(col => col.length),
      lastDrawEffect: null,
      lastGain: null,
      discardPile: [...wave.discardPile, ...wave.chain],
      score: scoreAfterStockEmpty + resetDirectGain,
      roleFiredThisChain: false,
      drawContinueCountThisChain: 0,
      flushActiveThisCombo: false,
      sameColumnStreak: 0,
      lastPlayedColumn: null,
      benevolenceUsedThisCombo: false,
      roleEchoUsedThisCombo: {},
      sameRankEchoUsedThisCombo: [],
      pendingRoleEcho: null,
      mercyActiveNextCombo: wave.combo <= params.talismans.mercy.c,
      lastBonusGains: [],
    },
    deckComposition: newDeckComposition,
  }
}
```

を、以下に置き換える。

```ts
  const resetResult = applyDirectEffects('resetDirect', items, resetCtx, params)
  const resetDirectGain = resetResult.value

  const resetBonusGains: BonusGain[] = []
  if (stockEmptyResult.parts.length > 0) {
    resetBonusGains.push({ label: '護符による直接加算', points: stockEmptyResult.value, parts: stockEmptyResult.parts })
  }
  if (resetResult.parts.length > 0) {
    resetBonusGains.push({ label: '護符による直接加算', points: resetDirectGain, parts: resetResult.parts })
  }

  return {
    wave: {
      ...wave,
      stock: items.includes('promise') ? arrangeNextCardForContinuation(params.scoring, newStock, [card], effectiveStairMinLen) : newStock,
      foundation: card,
      combo: items.includes('sanctify') ? wave.baseComboCount : 0,
      chain: [card],
      chainOrigin: ['draw'],
      linked: false,
      columnsEmptiedThisCombo: 0,
      comboStreakColumnLengths: wave.tableau.map(col => col.length),
      lastDrawEffect: null,
      lastGain: null,
      discardPile: [...wave.discardPile, ...wave.chain],
      score: scoreAfterStockEmpty + resetDirectGain,
      roleFiredThisChain: false,
      drawContinueCountThisChain: 0,
      flushActiveThisCombo: false,
      sameColumnStreak: 0,
      lastPlayedColumn: null,
      benevolenceUsedThisCombo: false,
      roleEchoUsedThisCombo: {},
      sameRankEchoUsedThisCombo: [],
      pendingRoleEcho: null,
      mercyActiveNextCombo: wave.combo <= params.talismans.mercy.c,
      lastBonusGains: resetBonusGains,
    },
    deckComposition: newDeckComposition,
  }
}
```

- [ ] **Step 4: テストを実行して成功を確認する**

Run: `npm run test`
Expected: 全テスト成功

- [ ] **Step 5: 型チェック・ビルド**

Run: `npm run check && npm run build`
Expected: どちらもエラーなく成功

- [ ] **Step 6: コミット**

```bash
git add src/lib/game/shidasu/engine.ts src/lib/game/shidasu/engine.test.ts
git commit -m "$(cat <<'EOF'
feat: drawStockで慢心・沈着・冷静・残響・誠実の直接加算をlastBonusGainsに反映

山札切れ時(慢心)・コンボリセット時(沈着・冷静・残響)・パターン継続時
(誠実)の護符による直接加算を、いずれもlastBonusGains配列へ内訳付きで
積むようにした。
EOF
)"
```

---

### Task 5: `DebugPanel.svelte`と`/game/shidasu`の表示を`lastBonusGains`対応にする

**Files:**
- Modify: `src/routes/game/shidasu/DebugPanel.svelte`
- Modify: `src/routes/game/shidasu/+page.svelte`

- [ ] **Step 1: `DebugPanel.svelte`のログ集計・表示を拡張する**

`src/routes/game/shidasu/DebugPanel.svelte`の

```svelte
<script lang="ts">
  import { untrack } from 'svelte'
  import { analyzeSuitColor, analyzeStair, isRed, rankLabel } from '$lib/game/shidasu/engine'
  import type { WaveState, Suit, Rank, ScoreGain } from '$lib/game/shidasu/types'

  let { wave, onForceDraw }: {
    wave: WaveState
    onForceDraw: (suit: Suit, rank: Rank, wild: boolean) => void
  } = $props()

  let gainLog = $state<{ combo: number; gain: ScoreGain }[]>([])

  $effect(() => {
    const gain = wave.lastGain
    const combo = wave.combo
    // gainLogの読み取り(スプレッド)をuntrackで囲まないと、この$effect自身が
    // gainLogの変化に依存してしまい、書き込むたびに自分自身を再実行する無限ループになる
    if (gain) {
      gainLog = [{ combo, gain }, ...untrack(() => gainLog)].slice(0, 20)
    }
  })
```

を、以下に置き換える。

```svelte
<script lang="ts">
  import { untrack } from 'svelte'
  import { analyzeSuitColor, analyzeStair, isRed, rankLabel } from '$lib/game/shidasu/engine'
  import type { WaveState, Suit, Rank } from '$lib/game/shidasu/types'

  let { wave, onForceDraw }: {
    wave: WaveState
    onForceDraw: (suit: Suit, rank: Rank, wild: boolean) => void
  } = $props()

  interface GainLogEntry {
    combo: number
    label: string
    points: number
    parts: string[]
  }

  let gainLog = $state<GainLogEntry[]>([])

  $effect(() => {
    const gain = wave.lastGain
    const bonusGains = wave.lastBonusGains
    const combo = wave.combo
    const newEntries: GainLogEntry[] = []
    if (gain) newEntries.push({ combo, label: '', points: gain.points, parts: gain.parts })
    for (const b of bonusGains) newEntries.push({ combo, label: b.label, points: b.points, parts: b.parts })
    // gainLogの読み取り(スプレッド)をuntrackで囲まないと、この$effect自身が
    // gainLogの変化に依存してしまい、書き込むたびに自分自身を再実行する無限ループになる
    if (newEntries.length > 0) {
      gainLog = [...newEntries, ...untrack(() => gainLog)].slice(0, 20)
    }
  })
```

同じファイルの

```svelte
      {#each gainLog as entry, i (i)}
        <div class="font-mono">×{entry.combo}: +{entry.gain.points} {entry.gain.parts.join(' ')}</div>
      {/each}
```

を、以下に置き換える。

```svelte
      {#each gainLog as entry, i (i)}
        <div class="font-mono">×{entry.combo}: {#if entry.label}<span class="text-fuchsia-300">[{entry.label}]</span> {/if}+{entry.points} {entry.parts.join(' ')}</div>
      {/each}
```

- [ ] **Step 2: `/game/shidasu`の得点ポップアップを拡張する**

`src/routes/game/shidasu/+page.svelte`の

```svelte
    {#if displayWave.lastGain}
      <div class="text-right text-sm h-5">
        <span class="text-yellow-300 font-black">+{displayWave.lastGain.points}</span>
        {#if displayWave.lastGain.parts.length > 0}
          <span class="text-emerald-200 text-xs ml-2">{displayWave.lastGain.parts.join(' ')}</span>
        {/if}
      </div>
    {:else}
      <div class="h-5"></div>
    {/if}
```

を、以下に置き換える。

```svelte
    {#if displayWave.lastGain || displayWave.lastBonusGains.length > 0}
      {@const totalPoints = (displayWave.lastGain?.points ?? 0) + displayWave.lastBonusGains.reduce((sum, g) => sum + g.points, 0)}
      {@const allParts = [...(displayWave.lastGain?.parts ?? []), ...displayWave.lastBonusGains.flatMap(g => g.parts)]}
      <div class="text-right text-sm h-5">
        <span class="text-yellow-300 font-black">+{totalPoints}</span>
        {#if allParts.length > 0}
          <span class="text-emerald-200 text-xs ml-2">{allParts.join(' ')}</span>
        {/if}
      </div>
    {:else}
      <div class="h-5"></div>
    {/if}
```

- [ ] **Step 3: ビルド・型チェック**

Run: `npm run build && npm run check`
Expected: どちらもエラーなく成功

- [ ] **Step 4: ブラウザで確認**

Run: `npm run dev` → `/game/shidasu`で「はじめる」→ 数手プレイし、右下の得点表示が引き続き正しく表示されることを確認する。開発者コンソールでエラーが出ていないことを確認する。

- [ ] **Step 5: コミット**

```bash
git add src/routes/game/shidasu/DebugPanel.svelte src/routes/game/shidasu/+page.svelte
git commit -m "$(cat <<'EOF'
feat: 獲得点ログ・得点ポップアップをlastBonusGains対応にする

DebugPanel.svelte(実プレイ・デバッグサンドボックス共有)の獲得点ログが、
全消しボーナスや護符の直接加算を[ラベル]付きの別エントリとして表示
するようにした。/game/shidasuの得点ポップアップの合計値・内訳表示にも
lastBonusGainsを合算するようにした。
EOF
)"
```

---

### Task 6: `/admin/shidasu-debug`のカード入れ替え・護符切り替えで`lastBonusGains`もクリアする

**Files:**
- Modify: `src/routes/admin/shidasu-debug/+page.svelte`

- [ ] **Step 1: 3箇所の`lastGain: null`の隣に`lastBonusGains: []`を追加する**

`src/routes/admin/shidasu-debug/+page.svelte`内、以下3箇所をそれぞれ修正する。

```ts
      wave = { ...wave, stock: wave.stock.map((c, i) => (i === idx ? newCard : c)), lastGain: null }
```

を、以下に置き換える。

```ts
      wave = { ...wave, stock: wave.stock.map((c, i) => (i === idx ? newCard : c)), lastGain: null, lastBonusGains: [] }
```

```ts
      wave = {
        ...wave,
        tableau: wave.tableau.map((c, ci) => (ci === col ? c.map((cc, ri) => (ri === row ? newCard : cc)) : c)),
        lastGain: null,
      }
```

を、以下に置き換える(`applySwap`内の1箇所)。

```ts
      wave = {
        ...wave,
        tableau: wave.tableau.map((c, ci) => (ci === col ? c.map((cc, ri) => (ri === row ? newCard : cc)) : c)),
        lastGain: null,
        lastBonusGains: [],
      }
```

```ts
      wave = { ...wave, stock: wave.stock.map((c, i) => (i === idx ? swap.previousCard : c)), lastGain: null }
```

を、以下に置き換える(`handleUndo`内)。

```ts
      wave = { ...wave, stock: wave.stock.map((c, i) => (i === idx ? swap.previousCard : c)), lastGain: null, lastBonusGains: [] }
```

```ts
      wave = {
        ...wave,
        tableau: wave.tableau.map((c, ci) => (ci === col ? c.map((cc, ri) => (ri === row ? swap.previousCard : cc)) : c)),
        lastGain: null,
      }
```

を、以下に置き換える(`handleUndo`内のもう1箇所)。

```ts
      wave = {
        ...wave,
        tableau: wave.tableau.map((c, ci) => (ci === col ? c.map((cc, ri) => (ri === row ? swap.previousCard : cc)) : c)),
        lastGain: null,
        lastBonusGains: [],
      }
```

- [ ] **Step 2: ビルド・型チェック**

Run: `npm run build && npm run check`
Expected: どちらもエラーなく成功

- [ ] **Step 3: コミット**

```bash
git add src/routes/admin/shidasu-debug/+page.svelte
git commit -m "$(cat <<'EOF'
fix: デバッグサンドボックスのカード入れ替え時にlastBonusGainsもクリアする
EOF
)"
```

---

### Task 7: `evaluateChainBonus`・`chainContinuesPattern`に`suitColorMinLen`オーバーライド引数を追加する

**Files:**
- Modify: `src/lib/game/shidasu/engine.ts`
- Modify: `src/lib/game/shidasu/engine.test.ts`

- [ ] **Step 1: 失敗するテストを書く**

`src/lib/game/shidasu/engine.test.ts`の`describe('evaluateChainBonus', ...)`ブロック内(無ければ`evaluateChainBonus`をテストしている`describe`を探す)に、以下を追加する。

```ts
  test('suitColorMinLenを指定すると、その枚数で同スートボーナスが成立する', () => {
    // 実カード2枚(同スート)のみ。既定のsuitColorMinLen(3)では不成立だが、2を渡すと成立する。
    const chainBefore = [card(20, '♠', 3)]
    const result = evaluateChainBonus(DEFAULT_PARAMS.scoring, chainBefore, card(21, '♠', 4), undefined, undefined, 2)
    expect(result.parts).toContain(`同スート+${DEFAULT_PARAMS.scoring.suitBonus}`)
  })
```

`src/lib/game/shidasu/engine.test.ts`の`describe('chainContinuesPattern', ...)`ブロック内(無ければ`chainContinuesPattern`をテストしている`describe`を探す)に、以下を追加する。

```ts
  test('suitColorMinLenを指定すると、その枚数で同スート継続と判定される', () => {
    const chain = [card(20, '♠', 3)]
    expect(chainContinuesPattern(DEFAULT_PARAMS.scoring, chain, card(21, '♠', 4), DEFAULT_PARAMS.scoring.stairMinLen, 2)).toBe(true)
    expect(chainContinuesPattern(DEFAULT_PARAMS.scoring, chain, card(21, '♠', 4), DEFAULT_PARAMS.scoring.stairMinLen, 3)).toBe(false)
  })
```

- [ ] **Step 2: テストを実行して失敗を確認する**

Run: `npx vitest run engine.test -t "suitColorMinLen"`
Expected: FAIL(TypeScriptの型エラー、または既定の`scoring.suitColorMinLen`(3)のまま計算されて不成立になる)

- [ ] **Step 3: `evaluateChainBonus`を実装する**

`src/lib/game/shidasu/engine.ts`の

```ts
export function evaluateChainBonus(
  scoring: ShidasuParams['scoring'],
  chainBefore: Card[],
  card: Card,
  stairMinLen: number = scoring.stairMinLen,
  roleBonusMultiplier: (name: RoleName) => number = () => 1
): ChainBonusResult {
```

を、以下に置き換える。

```ts
export function evaluateChainBonus(
  scoring: ShidasuParams['scoring'],
  chainBefore: Card[],
  card: Card,
  stairMinLen: number = scoring.stairMinLen,
  roleBonusMultiplier: (name: RoleName) => number = () => 1,
  suitColorMinLen: number = scoring.suitColorMinLen
): ChainBonusResult {
```

同じ関数内の

```ts
  if (chainIncludingThis.length >= scoring.suitColorMinLen) {
```

を、以下に置き換える。

```ts
  if (chainIncludingThis.length >= suitColorMinLen) {
```

- [ ] **Step 4: `chainContinuesPattern`を実装する**

`src/lib/game/shidasu/engine.ts`の

```ts
export function chainContinuesPattern(
  scoring: ShidasuParams['scoring'],
  chain: Card[],
  card: Card,
  stairMinLen: number = scoring.stairMinLen
): boolean {
  const chainIncludingThis = [...chain, card]

  const { suitHeld, colorHeld } = analyzeSuitColor(chainIncludingThis)
  if (chainIncludingThis.length >= scoring.suitColorMinLen && (suitHeld || colorHeld)) return true
```

を、以下に置き換える。

```ts
export function chainContinuesPattern(
  scoring: ShidasuParams['scoring'],
  chain: Card[],
  card: Card,
  stairMinLen: number = scoring.stairMinLen,
  suitColorMinLen: number = scoring.suitColorMinLen
): boolean {
  const chainIncludingThis = [...chain, card]

  const { suitHeld, colorHeld } = analyzeSuitColor(chainIncludingThis)
  if (chainIncludingThis.length >= suitColorMinLen && (suitHeld || colorHeld)) return true
```

- [ ] **Step 5: `arrangeNextCardForContinuation`にも`suitColorMinLen`を通す**

`src/lib/game/shidasu/engine.ts`の

```ts
function arrangeNextCardForContinuation(scoring: ShidasuParams['scoring'], stock: Card[], chain: Card[], stairMinLen: number): Card[] {
  if (stock.length === 0) return stock
  const lastIndex = stock.length - 1
  for (let i = 0; i <= lastIndex; i++) {
    if (chainContinuesPattern(scoring, chain, stock[i], stairMinLen)) {
```

を、以下に置き換える。

```ts
function arrangeNextCardForContinuation(scoring: ShidasuParams['scoring'], stock: Card[], chain: Card[], stairMinLen: number, suitColorMinLen: number = scoring.suitColorMinLen): Card[] {
  if (stock.length === 0) return stock
  const lastIndex = stock.length - 1
  for (let i = 0; i <= lastIndex; i++) {
    if (chainContinuesPattern(scoring, chain, stock[i], stairMinLen, suitColorMinLen)) {
```

(`suitColorMinLen`にデフォルト値`scoring.suitColorMinLen`を与えたことで、既存の呼び出し元(`startWave`・`playCard`・`drawStock`内の`arrangeNextCardForContinuation`呼び出し)は今回変更しなくても既定値のまま動作する。Task 8で架橋対応する際に、必要な呼び出し元だけ明示的に渡すよう更新する。)

- [ ] **Step 6: テストを実行して成功を確認する**

Run: `npm run test`
Expected: 全テスト成功

- [ ] **Step 7: 型チェック・ビルド**

Run: `npm run check && npm run build`
Expected: どちらもエラーなく成功

- [ ] **Step 8: コミット**

```bash
git add src/lib/game/shidasu/engine.ts src/lib/game/shidasu/engine.test.ts
git commit -m "$(cat <<'EOF'
refactor: evaluateChainBonus/chainContinuesPatternにsuitColorMinLenの
オーバーライド引数を追加

stairMinLenと同じパターンで、同スート・同色ボーナスの成立に必要な
枚数もオーバーライドできるようにした。デフォルトはscoring.
suitColorMinLenのため既存呼び出し元の挙動は変わらない。次タスクで
架橋の護符がこの引数を使う。
EOF
)"
```

---

### Task 8: `ItemEffectContext`に`effectiveSuitColorMinLen`を追加し、高潔・執念に適用する

**Files:**
- Modify: `src/lib/game/shidasu/engine.ts`
- Modify: `src/lib/game/shidasu/engine.test.ts`

- [ ] **Step 1: 失敗するテストを書く**

`src/lib/game/shidasu/engine.test.ts`の`describe('playCard', ...)`ブロック内に、以下を追加する。

```ts
  test('高潔の護符: effectiveSuitColorMinLen経由で同スート判定される(将来架橋対応の土台)', () => {
    // ctx.effectiveSuitColorMinLenが正しく渡っていることを、既定値(3枚)でのみ確認する回帰テスト。
    const items: ItemId[] = ['nobility']
    const wave = baseWave({
      foundation: card(0, '♠', 5),
      chain: [card(20, '♠', 3), card(21, '♠', 4)],
      tableau: [[card(1, '♠', 6)], [card(2, '♦', 2)]],
    })
    const next = playCard(DEFAULT_PARAMS, wave, 'none', items, 1000000, 0)
    expect(next.lastGain?.parts).toContain(`高潔+${DEFAULT_PARAMS.talismans.nobility.n}`)
  })
```

- [ ] **Step 2: テストを実行して現状パスすることを確認する(回帰確認用、まだ失敗しなくてよい)**

Run: `npx vitest run engine.test -t "高潔の護符"`
Expected: PASS(既存ロジックのままでも成立する。これはStep 3以降でリファクタリングしても壊れないことを保証する回帰テスト)

- [ ] **Step 3: `ItemEffectContext`に`effectiveSuitColorMinLen`を追加する**

`src/lib/game/shidasu/engine.ts`の`ItemEffectContext`インターフェース内、`effectiveStairMinLen: number`の行の直後に以下を追加する。

```ts
  // 護符(架橋等)による緩和を反映した、現在有効な同スート・同色成立の最小枚数
  effectiveSuitColorMinLen: number
```

- [ ] **Step 4: `playCard`・`drawStock`の`ItemEffectContext`構築箇所に値を渡す**

`src/lib/game/shidasu/engine.ts`の`playCard`内、`effectiveStairMinLen`の計算行

```ts
  const effectiveStairMinLen = items.includes('bridge') ? params.items.stairRelaxedMinLen : params.scoring.stairMinLen
```

の直後に以下を追加する。

```ts
  const effectiveSuitColorMinLen = params.scoring.suitColorMinLen
```

(この時点では架橋の反映はまだ行わない。Task 9で`items.includes('bridge') ? ... : ...`の形に変更する。)

同じ`playCard`内の`itemEffectCtx`オブジェクトリテラル、`effectiveStairMinLen,`の行の直後に以下を追加する。

```ts
    effectiveSuitColorMinLen,
```

`drawStock`内、`naiveCtx`オブジェクトリテラルにも同様に、`effectiveStairMinLen,`の直後に以下を追加する。

```ts
        effectiveSuitColorMinLen: params.scoring.suitColorMinLen,
```

- [ ] **Step 5: 高潔・執念の効果を`ctx.effectiveSuitColorMinLen`経由に変更する**

`src/lib/game/shidasu/engine.ts`の

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
```

を、以下に置き換える。

```ts
  nobility: {
    channel: 'gained',
    effect: (v, ctx, p) => {
      const { suitHeld } = analyzeSuitColor(ctx.chain)
      if (ctx.chain.length < ctx.effectiveSuitColorMinLen || !suitHeld) return { value: v, part: null }
      return { value: v + p.talismans.nobility.n, part: `高潔+${p.talismans.nobility.n}` }
    },
  },
  tenacity: {
    channel: 'gained',
    effect: (v, ctx, p) => {
      const { suitHeld } = analyzeSuitColor(ctx.chain)
      if (ctx.chain.length < ctx.effectiveSuitColorMinLen || !suitHeld) return { value: v, part: null }
      const factor = 1 + ctx.chain.length * p.talismans.tenacity.x
      return { value: v * factor, part: `執念×${fmtMultiplier(factor)}` }
    },
  },
```

- [ ] **Step 6: テストを実行して成功を確認する**

Run: `npm run test`
Expected: 全テスト成功(Step 2で確認したテストも引き続きPASS)

- [ ] **Step 7: 型チェック・ビルド**

Run: `npm run check && npm run build`
Expected: どちらもエラーなく成功

- [ ] **Step 8: コミット**

```bash
git add src/lib/game/shidasu/engine.ts src/lib/game/shidasu/engine.test.ts
git commit -m "$(cat <<'EOF'
refactor: 高潔・執念がctx.effectiveSuitColorMinLen経由で判定するよう変更

ItemEffectContextにeffectiveSuitColorMinLenを追加し、これまで
scoring.suitColorMinLenを直接参照していた高潔・執念の判定をctx経由に
統一した。この時点ではeffectiveSuitColorMinLenは常にscoring.
suitColorMinLenと同じ値(架橋未対応)。次タスクで架橋の護符を反映する。
EOF
)"
```

---

### Task 9: 架橋の護符に`m`パラメータを追加し、階段+同スート/同色の両方に適用する

**Files:**
- Modify: `src/lib/game/shidasu/params.ts`
- Modify: `src/lib/game/shidasu/shidasu.config.json`
- Modify: `src/lib/game/shidasu/engine.ts`
- Modify: `src/lib/game/shidasu/engine.test.ts`

- [ ] **Step 1: `talismans.bridge`に`m`を追加する**

`src/lib/game/shidasu/params.ts`の型定義内

```ts
    bridge: { name: string }
```

を、以下に置き換える。

```ts
    bridge: { name: string; m: number }
```

同ファイルの`DEFAULT_PARAMS.talismans`内

```ts
    bridge: { name: '架橋' },
```

を、以下に置き換える(既定値2。既存の`items.stairRelaxedMinLen`(3) = `scoring.stairMinLen`(5) - 2 と同じ結果になる値)。

```ts
    bridge: { name: '架橋', m: 2 },
```

`src/lib/game/shidasu/shidasu.config.json`の

```json
    "bridge": { "name": "架橋" },
```

を、以下に置き換える。

```json
    "bridge": { "name": "架橋", "m": 2 },
```

- [ ] **Step 2: 失敗するテストを書く**

`src/lib/game/shidasu/engine.test.ts`の`describe('playCard', ...)`ブロック内に、以下を追加する。

```ts
  test('架橋の護符: 階段成立に必要な枚数がm枚緩和される(既定m=2で5→3)', () => {
    const items: ItemId[] = ['bridge']
    // チェーン[3,4]に5を継ぎ足して3枚の階段(3,4,5)にする。foundationをrank6にすることで
    // rank5のカード(foundationとの差1)が取得可能になる。既定のstairMinLen(5)では
    // 3枚では不成立だが、架橋によりm=2緩和され3枚で成立するはず。
    const wave = baseWave({
      foundation: card(0, '♠', 6),
      chain: [card(20, '♣', 3), card(21, '♦', 4)],
      tableau: [[card(1, '♥', 5)], [card(2, '♦', 2)]],
    })
    const next = playCard(DEFAULT_PARAMS, wave, 'none', items, 1000000, 0)
    expect(next.lastGain?.parts.some(p => p.startsWith('階段'))).toBe(true)
  })

  test('架橋の護符: 同スート成立に必要な枚数もm枚緩和される(既定m=2で3→1)', () => {
    const items: ItemId[] = ['bridge']
    // evaluateChainBonusはchainBefore(プレイ前のチェーン)が空だと即bonus=0を返すため、
    // チェーンには既に1枚(基準カードと同スート)を入れておく。このプレイでchainIncludingThis
    // が2枚になり、effectiveSuitColorMinLen(3-2=1)なら2>=1で成立、既定値(3)なら2>=3で不成立。
    const wave = baseWave({
      foundation: card(0, '♠', 5),
      chain: [card(0, '♠', 5)],
      tableau: [[card(1, '♠', 6)], [card(2, '♦', 2)]],
    })
    const next = playCard(DEFAULT_PARAMS, wave, 'none', items, 1000000, 0)
    expect(next.lastGain?.parts).toContain(`同スート+${DEFAULT_PARAMS.scoring.suitBonus}`)
  })
```

- [ ] **Step 3: テストを実行して失敗を確認する**

Run: `npx vitest run engine.test -t "架橋の護符"`
Expected: 2件ともFAIL(型エラー、または`items.stairRelaxedMinLen`のままでsuitColorMinLenが緩和されない)

- [ ] **Step 4: `playCard`・`drawStock`・`startWave`の`effectiveStairMinLen`/`effectiveSuitColorMinLen`計算を修正する**

`src/lib/game/shidasu/engine.ts`の`playCard`内

```ts
  const effectiveStairMinLen = items.includes('bridge') ? params.items.stairRelaxedMinLen : params.scoring.stairMinLen
  const effectiveSuitColorMinLen = params.scoring.suitColorMinLen
```

を、以下に置き換える。

```ts
  const effectiveStairMinLen = items.includes('bridge') ? params.scoring.stairMinLen - params.talismans.bridge.m : params.scoring.stairMinLen
  const effectiveSuitColorMinLen = items.includes('bridge') ? params.scoring.suitColorMinLen - params.talismans.bridge.m : params.scoring.suitColorMinLen
```

同じ`playCard`内、`evaluateChainBonus`の呼び出し

```ts
  const chainResult = evaluateChainBonus(params.scoring, wave.chain, card, effectiveStairMinLen, roleBonusMultiplier)
```

を、以下に置き換える。

```ts
  const chainResult = evaluateChainBonus(params.scoring, wave.chain, card, effectiveStairMinLen, roleBonusMultiplier, effectiveSuitColorMinLen)
```

`drawStock`内の対応する2箇所

```ts
  const effectiveStairMinLen = items.includes('bridge') ? params.items.stairRelaxedMinLen : params.scoring.stairMinLen
```

(`drawStock`内に1箇所のみ存在)を、以下に置き換える。

```ts
  const effectiveStairMinLen = items.includes('bridge') ? params.scoring.stairMinLen - params.talismans.bridge.m : params.scoring.stairMinLen
  const effectiveSuitColorMinLen = items.includes('bridge') ? params.scoring.suitColorMinLen - params.talismans.bridge.m : params.scoring.suitColorMinLen
```

`drawStock`内、`wouldContinue`の判定

```ts
  const wouldContinue = wave.linked && chainContinuesPattern(params.scoring, wave.chain, drawnCard, effectiveStairMinLen)
```

を、以下に置き換える。

```ts
  const wouldContinue = wave.linked && chainContinuesPattern(params.scoring, wave.chain, drawnCard, effectiveStairMinLen, effectiveSuitColorMinLen)
```

`drawStock`内、`naive`分岐の`evaluateChainBonus`呼び出し

```ts
      const chainResult = evaluateChainBonus(params.scoring, wave.chain, drawnCard, effectiveStairMinLen)
```

を、以下に置き換える。

```ts
      const chainResult = evaluateChainBonus(params.scoring, wave.chain, drawnCard, effectiveStairMinLen, undefined, effectiveSuitColorMinLen)
```

`drawStock`内、`naiveCtx`オブジェクトリテラルの

```ts
        effectiveSuitColorMinLen: params.scoring.suitColorMinLen,
```

を、以下に置き換える。

```ts
        effectiveSuitColorMinLen,
```

`drawStock`内、2箇所ある`arrangeNextCardForContinuation`呼び出し

```ts
        stock: items.includes('promise') ? arrangeNextCardForContinuation(params.scoring, newStock, [...wave.chain, drawnCard], effectiveStairMinLen) : newStock,
```

```ts
      stock: items.includes('promise') ? arrangeNextCardForContinuation(params.scoring, newStock, [card], effectiveStairMinLen) : newStock,
```

を、それぞれ以下に置き換える。

```ts
        stock: items.includes('promise') ? arrangeNextCardForContinuation(params.scoring, newStock, [...wave.chain, drawnCard], effectiveStairMinLen, effectiveSuitColorMinLen) : newStock,
```

```ts
      stock: items.includes('promise') ? arrangeNextCardForContinuation(params.scoring, newStock, [card], effectiveStairMinLen, effectiveSuitColorMinLen) : newStock,
```

`startWave`内の

```ts
  const stockAfterDeal = items.includes('promise')
    ? arrangeNextCardForContinuation(params.scoring, deck, [foundation], params.scoring.stairMinLen)
    : deck
```

を、以下に置き換える。

```ts
  const effectiveStairMinLenAtDeal = items.includes('bridge') ? params.scoring.stairMinLen - params.talismans.bridge.m : params.scoring.stairMinLen
  const effectiveSuitColorMinLenAtDeal = items.includes('bridge') ? params.scoring.suitColorMinLen - params.talismans.bridge.m : params.scoring.suitColorMinLen
  const stockAfterDeal = items.includes('promise')
    ? arrangeNextCardForContinuation(params.scoring, deck, [foundation], effectiveStairMinLenAtDeal, effectiveSuitColorMinLenAtDeal)
    : deck
```

- [ ] **Step 5: `itemDesc`の架橋の説明文を更新する**

`src/lib/game/shidasu/engine.ts`の

```ts
    case 'bridge': return `階段成立に必要な最小連続枚数を${params.scoring.stairMinLen}→${params.items.stairRelaxedMinLen}枚に緩和`
```

を、以下に置き換える。

```ts
    case 'bridge': return `階段・同スート・同色の成立に必要な枚数を${params.talismans.bridge.m}枚緩和(階段${params.scoring.stairMinLen}→${params.scoring.stairMinLen - params.talismans.bridge.m}枚、同スート・同色${params.scoring.suitColorMinLen}→${params.scoring.suitColorMinLen - params.talismans.bridge.m}枚)`
```

- [ ] **Step 6: テストを実行して成功を確認する**

Run: `npm run test`
Expected: 全テスト成功

- [ ] **Step 7: 型チェック・ビルド**

Run: `npm run check && npm run build`
Expected: どちらもエラーなく成功

- [ ] **Step 8: ブラウザで確認**

Run: `npm run dev` → `/admin/shidasu-talismans`を開き、「初期実装」グループの「架橋」行にパラメータ`m`の入力欄が表示され、説明文プレビューが新しい文言になっていることを確認する。

- [ ] **Step 9: コミット**

```bash
git add src/lib/game/shidasu/params.ts src/lib/game/shidasu/shidasu.config.json src/lib/game/shidasu/engine.ts src/lib/game/shidasu/engine.test.ts
git commit -m "$(cat <<'EOF'
feat: 架橋の護符をmパラメータによる相対緩和方式に変更

効果を「階段成立に必要な枚数を-m枚する」に変更し、talismans.bridge.m
パラメータを追加(既定値2、従来のitems.stairRelaxedMinLen=3と同じ
結果)。あわせて同スート・同色の成立枚数(suitColorMinLen)にも同じmを
適用するようにした。
EOF
)"
```

---

### Task 10: 寛容の護符に`m`パラメータを追加する

**Files:**
- Modify: `src/lib/game/shidasu/params.ts`
- Modify: `src/lib/game/shidasu/shidasu.config.json`
- Modify: `src/lib/game/shidasu/engine.ts`
- Modify: `src/lib/game/shidasu/engine.test.ts`

- [ ] **Step 1: `talismans.grace`に`m`を追加する**

`src/lib/game/shidasu/params.ts`の型定義内

```ts
    grace: { name: string }
```

を、以下に置き換える。

```ts
    grace: { name: string; m: number }
```

同ファイルの`DEFAULT_PARAMS.talismans`内

```ts
    grace: { name: '寛容' },
```

を、以下に置き換える(既定値2、従来の`items.columnSweepRelaxCards`と同じ値)。

```ts
    grace: { name: '寛容', m: 2 },
```

`src/lib/game/shidasu/shidasu.config.json`の

```json
    "grace": { "name": "寛容" },
```

を、以下に置き換える。

```json
    "grace": { "name": "寛容", "m": 2 },
```

- [ ] **Step 2: 失敗するテストを書く**

`src/lib/game/shidasu/engine.test.ts`の`describe('playCard', ...)`ブロック内に、以下を追加する(既存の寛容関連テストで`items.columnSweepRelaxCards`を参照しているものがあれば、そのテストの期待値算出部分も`DEFAULT_PARAMS.talismans.grace.m`に合わせて更新する必要がある。まずは新規テストを追加する)。

```ts
  test('寛容の護符: 列一掃ボーナスに必要な枚数がtalismans.grace.m枚緩和される', () => {
    const items: ItemId[] = ['grace']
    const relaxedLen = DEFAULT_PARAMS.layout.rows - DEFAULT_PARAMS.talismans.grace.m
    const wave = baseWave({
      foundation: card(0, '♠', 6),
      tableau: [[card(1, '♣', 7)]],
      comboStreakColumnLengths: [relaxedLen],
    })
    const next = playCard(DEFAULT_PARAMS, wave, 'none', items, 1000000, 0)
    expect(next.lastGain?.parts.some(p => p.startsWith('列一掃'))).toBe(true)
  })
```

- [ ] **Step 3: テストを実行して失敗を確認する**

Run: `npx vitest run engine.test -t "寛容の護符"`
Expected: FAIL(型エラー、または`items.columnSweepRelaxCards`のまま計算される)

- [ ] **Step 4: `playCard`の寛容判定を`talismans.grace.m`経由に変更する**

`src/lib/game/shidasu/engine.ts`の

```ts
  const sweepQualifies = columnJustEmptied && (
    items.includes('grace')
      ? streakStartLength <= rows - params.items.columnSweepRelaxCards
      : streakStartLength === rows
  )
```

を、以下に置き換える。

```ts
  const sweepQualifies = columnJustEmptied && (
    items.includes('grace')
      ? streakStartLength <= rows - params.talismans.grace.m
      : streakStartLength === rows
  )
```

- [ ] **Step 5: `itemDesc`の寛容の説明文を更新する**

`src/lib/game/shidasu/engine.ts`の

```ts
    case 'grace': {
      const relaxed = params.layout.rows - params.items.columnSweepRelaxCards
      return `列一掃ボーナスの条件を「列の全${params.layout.rows}枚を1コンボで空に」→「残り${relaxed}枚から1コンボで空に」に緩和`
    }
```

を、以下に置き換える。

```ts
    case 'grace': {
      const relaxed = params.layout.rows - params.talismans.grace.m
      return `列一掃ボーナスに必要な枚数を${params.talismans.grace.m}枚緩和(列の全${params.layout.rows}枚を1コンボで空に→残り${relaxed}枚から1コンボで空に)`
    }
```

- [ ] **Step 6: テストを実行して成功を確認する**

Run: `npm run test`
Expected: 全テスト成功

- [ ] **Step 7: 型チェック・ビルド**

Run: `npm run check && npm run build`
Expected: どちらもエラーなく成功

- [ ] **Step 8: コミット**

```bash
git add src/lib/game/shidasu/params.ts src/lib/game/shidasu/shidasu.config.json src/lib/game/shidasu/engine.ts src/lib/game/shidasu/engine.test.ts
git commit -m "$(cat <<'EOF'
feat: 寛容の護符をtalismans.grace.mパラメータに移行

items.columnSweepRelaxCards(共有パラメータ)からtalismans.grace.m
(護符固有パラメータ)へ移行した。計算式・既定値(2)は変更なし。
EOF
)"
```

---

### Task 11: `items.stairRelaxedMinLen`・`items.columnSweepRelaxCards`を廃止する

**Files:**
- Modify: `src/lib/game/shidasu/params.ts`
- Modify: `src/lib/game/shidasu/shidasu.config.json`
- Modify: `src/routes/admin/shidasu/+page.svelte`

- [ ] **Step 1: 型・デフォルト値から削除する**

`src/lib/game/shidasu/params.ts`の

```ts
  items: {
    stairRelaxedMinLen: number
    columnSweepRelaxCards: number
    maxItems: number
  }
```

を、以下に置き換える。

```ts
  items: {
    maxItems: number
  }
```

同ファイルの`DEFAULT_PARAMS`内

```ts
  items: {
    stairRelaxedMinLen: 3,
    columnSweepRelaxCards: 2,
    maxItems: 5,
  },
```

を、以下に置き換える。

```ts
  items: {
    maxItems: 5,
  },
```

`src/lib/game/shidasu/shidasu.config.json`の

```json
  "items": {
    "stairRelaxedMinLen": 3,
    "columnSweepRelaxCards": 2,
    "maxItems": 5
  },
```

を、以下に置き換える。

```json
  "items": {
    "maxItems": 5
  },
```

- [ ] **Step 2: `/admin/shidasu`の「アイテム」セクションから該当2項目を削除する**

`src/routes/admin/shidasu/+page.svelte`の

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

を、以下に置き換える。

```svelte
      <section class="bg-white border border-slate-200 rounded-xl p-4">
        <h2 class="font-semibold text-slate-700 text-sm mb-3">アイテム</h2>
        <div class="grid grid-cols-2 gap-3">
          <label class="text-xs text-slate-500">
            護符の所持上限枚数(maxItems)
            <input type="number" min="1" step="1" bind:value={config.items.maxItems} class="mt-1 w-full border border-slate-200 rounded px-2 py-1 text-sm" />
          </label>
        </div>
      </section>
```

- [ ] **Step 3: バリデーション関数から該当チェックを削除する**

`src/routes/admin/shidasu/+page.svelte`の`hasValidationError`内から、`items.stairRelaxedMinLen`・`items.columnSweepRelaxCards`を参照している行があれば削除する(現状は`maxItems`のみのチェックであれば変更不要。念のため`grep -n "stairRelaxedMinLen\|columnSweepRelaxCards" src/routes/admin/shidasu/+page.svelte`で確認し、見つかった行を削除する)。

- [ ] **Step 4: 型チェック・ビルド**

Run: `npm run check && npm run build`
Expected: どちらもエラーなく成功(`params.items.stairRelaxedMinLen`等への参照が他に残っていれば型エラーになるので、`grep -rn "items.stairRelaxedMinLen\|items.columnSweepRelaxCards" src/`で確認し、残っていれば全て修正する)

- [ ] **Step 5: テスト実行**

Run: `npm run test`
Expected: 全テスト成功

- [ ] **Step 6: ブラウザで確認**

Run: `npm run dev` → `/admin/shidasu`を開き、「アイテム」セクションに所持上限枚数のみが表示されることを確認する。

- [ ] **Step 7: コミット**

```bash
git add src/lib/game/shidasu/params.ts src/lib/game/shidasu/shidasu.config.json src/routes/admin/shidasu/+page.svelte
git commit -m "$(cat <<'EOF'
refactor: items.stairRelaxedMinLen/columnSweepRelaxCardsを廃止

架橋・寛容がそれぞれtalismans.bridge.m/talismans.grace.mに移行した
ため、共有パラメータ側の古いフィールドを削除した。
EOF
)"
```

---

### Task 12: デバッグサンドボックスのカードパレットにスート統一ボタンを追加する

**Files:**
- Modify: `src/routes/admin/shidasu-debug/CardPalette.svelte`
- Modify: `src/routes/admin/shidasu-debug/+page.svelte`

- [ ] **Step 1: `CardPalette.svelte`にボタンを追加する**

`src/routes/admin/shidasu-debug/CardPalette.svelte`の

```svelte
<script lang="ts">
  import type { Snippet } from 'svelte'
  import type { Card, Suit, Rank } from '$lib/game/shidasu/types'

  let { cardFace, onCardPointerDown }: {
    cardFace: Snippet<[card: Card, covered: boolean]>
    onCardPointerDown: (source: { suit: Suit; rank: Rank; wild: boolean }, e: PointerEvent) => void
  } = $props()

  const REAL_SUITS: Suit[] = ['♠', '♥', '♦', '♣']
  const RANKS: Rank[] = [1, 2, 3, 4, 5, 6, 7, 8, 9, 10, 11, 12, 13]
</script>

<div class="space-y-2">
  <h2 class="text-sm font-bold text-slate-700">カードパレット(ドラッグして場札・山札に入れ替え)</h2>
```

を、以下に置き換える。

```svelte
<script lang="ts">
  import type { Snippet } from 'svelte'
  import type { Card, Suit, Rank } from '$lib/game/shidasu/types'

  let { cardFace, onCardPointerDown, onUnifySuit }: {
    cardFace: Snippet<[card: Card, covered: boolean]>
    onCardPointerDown: (source: { suit: Suit; rank: Rank; wild: boolean }, e: PointerEvent) => void
    onUnifySuit: (suit: Suit) => void
  } = $props()

  const REAL_SUITS: Suit[] = ['♠', '♥', '♦', '♣']
  const RANKS: Rank[] = [1, 2, 3, 4, 5, 6, 7, 8, 9, 10, 11, 12, 13]
</script>

<div class="space-y-2">
  <h2 class="text-sm font-bold text-slate-700">カードパレット(ドラッグして場札・山札に入れ替え)</h2>
  <div class="flex items-center gap-1.5">
    <span class="text-xs text-slate-500">場札を全て:</span>
    {#each REAL_SUITS as suit (suit)}
      <button
        type="button"
        onclick={() => onUnifySuit(suit)}
        class="w-8 h-8 rounded border border-slate-300 bg-white text-lg leading-none hover:bg-slate-50 {suit === '♥' || suit === '♦' ? 'text-red-600' : 'text-slate-900'}"
      >{suit}</button>
    {/each}
    <span class="text-xs text-slate-400">に統一(ランクは維持)</span>
  </div>
```

- [ ] **Step 2: `+page.svelte`に`onUnifySuit`ハンドラを追加する**

`src/routes/admin/shidasu-debug/+page.svelte`の`applySwap`関数の直後に、以下を追加する。

```ts
  function unifySuit(suit: Suit) {
    wave = {
      ...wave,
      tableau: wave.tableau.map(col => col.map(c => (c.wild ? c : { ...c, suit }))),
      lastGain: null,
      lastBonusGains: [],
    }
    lastSwap = null
  }
```

同ファイルの

```svelte
      <CardPalette {cardFace} onCardPointerDown={onPaletteCardPointerDown} />
```

を、以下に置き換える。

```svelte
      <CardPalette {cardFace} onCardPointerDown={onPaletteCardPointerDown} onUnifySuit={unifySuit} />
```

- [ ] **Step 3: ビルド・型チェック**

Run: `npm run build && npm run check`
Expected: どちらもエラーなく成功

- [ ] **Step 4: ブラウザで確認**

Run: `npm run dev` → `/admin/shidasu-debug`を開き、カードパレット上部の♠♥♦♣ボタンを押すと、場札の全カード(ワイルドを除く)のスートが一括で変わること、ランクは変わらないことを確認する。

- [ ] **Step 5: コミット**

```bash
git add src/routes/admin/shidasu-debug/CardPalette.svelte src/routes/admin/shidasu-debug/+page.svelte
git commit -m "$(cat <<'EOF'
feat: デバッグサンドボックスに場札を特定スートへ統一するボタンを追加

カードパレット上部に♠♥♦♣の4ボタンを追加し、押すと場札の全カード
(ワイルドを除く)のスートを一括変更できるようにした。ランクは維持する。
EOF
)"
```

---

### Task 13: デバッグサンドボックスに場札を階段にするボタンを追加する

**Files:**
- Modify: `src/routes/admin/shidasu-debug/+page.svelte`

- [ ] **Step 1: 階段化ロジックとボタンを追加する**

`src/routes/admin/shidasu-debug/+page.svelte`の`unifySuit`関数の直後に、以下を追加する。

```ts
  function stairifyTableau() {
    if (wave.tableau.length === 0 || wave.tableau[0].length === 0) return
    // 列優先: 列0を手前(末尾)→奥(先頭)、次に列1を手前→奥…の順に走査する
    const order: { ci: number; ri: number }[] = []
    wave.tableau.forEach((col, ci) => {
      for (let ri = col.length - 1; ri >= 0; ri--) order.push({ ci, ri })
    })
    const baseRank = wave.tableau[0][wave.tableau[0].length - 1].rank
    const newRanks = new Map<string, Rank>()
    order.forEach(({ ci, ri }, i) => {
      const rank = (((baseRank - 1 + i) % 13) + 1) as Rank
      newRanks.set(`${ci}-${ri}`, rank)
    })
    wave = {
      ...wave,
      tableau: wave.tableau.map((col, ci) => col.map((c, ri) => ({ ...c, rank: newRanks.get(`${ci}-${ri}`) as Rank }))),
      lastGain: null,
      lastBonusGains: [],
    }
    lastSwap = null
  }
```

同ファイルのヘッダー部分、

```svelte
    <div class="flex items-center gap-2">
      <button type="button" onclick={handleUndo} disabled={!lastSwap} class="px-3 py-1.5 rounded text-sm font-bold {lastSwap ? 'bg-amber-500 text-white' : 'bg-slate-200 text-slate-400'}">元に戻す</button>
      <button type="button" onclick={newWave} class="px-3 py-1.5 rounded bg-teal-600 text-white text-sm font-bold">新しいウェーブ</button>
    </div>
```

を、以下に置き換える。

```svelte
    <div class="flex items-center gap-2">
      <button type="button" onclick={stairifyTableau} class="px-3 py-1.5 rounded bg-indigo-600 text-white text-sm font-bold">場札を階段にする</button>
      <button type="button" onclick={handleUndo} disabled={!lastSwap} class="px-3 py-1.5 rounded text-sm font-bold {lastSwap ? 'bg-amber-500 text-white' : 'bg-slate-200 text-slate-400'}">元に戻す</button>
      <button type="button" onclick={newWave} class="px-3 py-1.5 rounded bg-teal-600 text-white text-sm font-bold">新しいウェーブ</button>
    </div>
```

- [ ] **Step 2: ビルド・型チェック**

Run: `npm run build && npm run check`
Expected: どちらもエラーなく成功

- [ ] **Step 3: ブラウザで確認**

Run: `npm run dev` → `/admin/shidasu-debug`を開き、「場札を階段にする」ボタンを押す。列0の一番手前のカードのランクを基準に、列0を手前から奥へ、続いて列1を手前から奥へ…の順で+1ずつ増えていくこと(13の次はAに戻ること)、スート・ワイルド判定は変わらないことを確認する。

- [ ] **Step 4: コミット**

```bash
git add src/routes/admin/shidasu-debug/+page.svelte
git commit -m "$(cat <<'EOF'
feat: デバッグサンドボックスに場札を階段にするボタンを追加

列0の一番手前のカードのランクを基準に、列優先(各列を手前から奥へ、
列0から順に)でランクを+1ずつ割り当てる(13の次はAに戻る)。スート・
ワイルド判定は変更しない。
EOF
)"
```

---

### Task 14: 護符チェックリストに全チェック/全解除ボタンを追加する

**Files:**
- Modify: `src/routes/admin/shidasu-debug/ItemChecklist.svelte`
- Modify: `src/routes/admin/shidasu-debug/+page.svelte`

- [ ] **Step 1: `ItemChecklist.svelte`にボタンを追加する**

`src/routes/admin/shidasu-debug/ItemChecklist.svelte`の

```svelte
<script lang="ts">
  import { itemName, itemDesc } from '$lib/game/shidasu/engine'
  import { loadParams } from '$lib/game/shidasu/params'
  import type { ItemId } from '$lib/game/shidasu/types'
  import { ITEM_GROUPS } from '$lib/game/shidasu/itemGroups'

  let { items, onToggle }: {
    items: ItemId[]
    onToggle: (id: ItemId, checked: boolean) => void
  } = $props()

  const params = loadParams()
</script>

<div class="space-y-3 max-h-[70vh] overflow-y-auto pr-1">
  <h2 class="text-sm font-bold text-slate-700 sticky top-0 bg-slate-50">護符({items.length}/87)</h2>
```

を、以下に置き換える。

```svelte
<script lang="ts">
  import { itemName, itemDesc } from '$lib/game/shidasu/engine'
  import { loadParams } from '$lib/game/shidasu/params'
  import type { ItemId } from '$lib/game/shidasu/types'
  import { ITEM_GROUPS } from '$lib/game/shidasu/itemGroups'

  let { items, onToggle, onSetAll }: {
    items: ItemId[]
    onToggle: (id: ItemId, checked: boolean) => void
    onSetAll: (checked: boolean) => void
  } = $props()

  const params = loadParams()
</script>

<div class="space-y-3 max-h-[70vh] overflow-y-auto pr-1">
  <div class="sticky top-0 bg-slate-50 space-y-1">
    <h2 class="text-sm font-bold text-slate-700">護符({items.length}/87)</h2>
    <div class="flex gap-2">
      <button type="button" onclick={() => onSetAll(true)} class="text-xs px-2 py-1 rounded border border-slate-300 bg-white hover:bg-slate-100">全てチェック</button>
      <button type="button" onclick={() => onSetAll(false)} class="text-xs px-2 py-1 rounded border border-slate-300 bg-white hover:bg-slate-100">全て解除</button>
    </div>
  </div>
```

- [ ] **Step 2: `+page.svelte`に`onSetAll`ハンドラを追加する**

`src/routes/admin/shidasu-debug/+page.svelte`の`handleToggleItem`関数の直後に、以下を追加する。

```ts
  function handleSetAllItems(checked: boolean) {
    items = checked ? [...ITEM_POOL] : []
    lastSwap = null
  }
```

`ITEM_POOL`のimportが無いため、同ファイル冒頭のimport文

```ts
  import { startWave, playCard, drawStock, forceStockTop, getPlayableColumns, isRed, rankLabel } from '$lib/game/shidasu/engine'
```

を、以下に置き換える。

```ts
  import { startWave, playCard, drawStock, forceStockTop, getPlayableColumns, isRed, rankLabel, ITEM_POOL } from '$lib/game/shidasu/engine'
```

同ファイルの

```svelte
      <ItemChecklist {items} onToggle={handleToggleItem} />
```

を、以下に置き換える。

```svelte
      <ItemChecklist {items} onToggle={handleToggleItem} onSetAll={handleSetAllItems} />
```

- [ ] **Step 3: ビルド・型チェック**

Run: `npm run build && npm run check`
Expected: どちらもエラーなく成功

- [ ] **Step 4: ブラウザで確認**

Run: `npm run dev` → `/admin/shidasu-debug`を開き、「全てチェック」を押すと87護符全てが所持状態(87/87)になること、「全て解除」を押すと0/87に戻ることを確認する。

- [ ] **Step 5: コミット**

```bash
git add src/routes/admin/shidasu-debug/ItemChecklist.svelte src/routes/admin/shidasu-debug/+page.svelte
git commit -m "$(cat <<'EOF'
feat: デバッグサンドボックスの護符チェックリストに全チェック/全解除ボタンを追加
EOF
)"
```

---

### Task 15: 最終確認

**Files:** なし(検証のみ)

- [ ] **Step 1: テスト全体を実行する**

Run: `npm run test`
Expected: 全テスト成功

- [ ] **Step 2: ビルド・型チェック**

Run: `npm run build && npm run check`
Expected: どちらもエラーなく成功。`grep -rn "items.stairRelaxedMinLen\|items.columnSweepRelaxCards\|ITEM_NAMES" src/`が0件であることも確認する。

- [ ] **Step 3: ブラウザで受け入れ確認する**

Run: `npm run dev` → 以下を順に確認する。

1. `/game/shidasu`で「はじめる」→ 数手プレイし、得点ポップアップ・護符選択画面の説明文(架橋・寛容)が正しく表示され、コンソールエラーが無いこと
2. `/admin/shidasu-debug`で「全消し」が起きる状況を作り(カードパレットで場札を1枚だけ残すなど)、内部状態パネルの獲得点ログに「全消しボーナス」が[ラベル]付きで別エントリとして表示されること
3. `/admin/shidasu-debug`で沈着・慢心などの直接加算系護符をチェックし、該当条件でログに[護符による直接加算]エントリが表示されること
4. `/admin/shidasu-debug`のカードパレットでスート統一ボタン・場札を階段にするボタン・護符全チェック/解除ボタンがそれぞれ意図通り動作すること
5. `/admin/shidasu-talismans`で架橋・寛容の行にそれぞれ`m`パラメータの入力欄が表示され、編集すると説明文プレビューが更新されること
6. `/admin/shidasu`の「アイテム」セクションに所持上限枚数のみが表示されること

- [ ] **Step 4: 完了報告**

問題があれば修正してから完了とする。新規コミットは不要(Task 1〜14で既にコミット済み)。

---

## 自己レビュー結果

- **spec カバレッジ:** A(ログ基盤)→ Task 1-2、B(全消し内訳)→ Task 3、C(護符の直接加算)→ Task 3-4、D(架橋)→ Task 7-9、E(寛容)→ Task 10、F(admin/shidasu整理)→ Task 11、G(スート統一)→ Task 12、H(階段化)→ Task 13、I(全チェック/解除)→ Task 14。全項目に対応するタスクあり。
- **プレースホルダースキャン:** 「TBD」「後で実装」等の記述なし。全コード変更箇所を具体的なold/new textで記載した。
- **型・シグネチャ整合性:** `BonusGain`型・`lastBonusGains`フィールドはTask 1で定義し、以降全タスクで同じ形で使用している。`applyDirectEffects`の戻り値型`{value, parts}`はTask 2で定義し、Task 3-4の呼び出し元と一致している。`evaluateChainBonus`/`chainContinuesPattern`/`arrangeNextCardForContinuation`の`suitColorMinLen`引数はTask 7で追加し、Task 9の架橋対応で実際に架橋固有の値を渡すよう更新している(引数の位置・デフォルト値が一貫している)。`talismans.bridge.m`/`talismans.grace.m`はTask 9-10で追加し、Task 11の`items.*`削除より前に完了させる順序になっている(依存関係が正しい)。
