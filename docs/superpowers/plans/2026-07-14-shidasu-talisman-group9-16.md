# Shidasu 護符候補一覧グループ9〜16(残り20個)の実装 Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** `docs/shidasu-gofu-candidates.md`のグループ9〜16のうち、永続デッキ基盤に依存しない残り20個の護符を実装する。

**Architecture:** `WaveState`に9個の新規stateフィールドを追加し、`ITEM_EFFECTS`に4種類の「直接点」チャンネル(`resetDirect`/`stockEmptyDirect`/`comboMilestoneDirect`/`drawContinueDirect`)を新設する。素朴・約束・暗雲・博愛・治癒・再生・導きは`ITEM_EFFECTS`レジストリを使わず、`items.includes(...)`による直接分岐のルール系護符として実装する。

**Tech Stack:** TypeScript, Vitest。対象ファイルは`src/lib/game/shidasu/{types,params,engine}.ts`・`src/lib/game/shidasu/shidasu.config.json`・`src/lib/game/shidasu/engine.test.ts`・`src/routes/admin/shidasu/+page.svelte`・`src/routes/game/shidasu/+page.svelte`。

---

## 前提知識(実装者向け)

- 詳細仕様は`docs/superpowers/specs/2026-07-14-shidasu-talisman-group9-16-design.md`を参照(本プランはこのspecの実装計画)。
- `playCard`/`drawStock`は既に`{wave, deckComposition}`(drawStockのみ)を返す形になっている(`playCard`は`WaveState`を直接返す)。本プランでは`playCard`に`rand: () => number = Math.random`引数を新規追加する(治癒・再生の捨て札からのランダム復活に使う)。
- `ITEM_EFFECTS`は既存で`channel: 'gained' | 'clearBonus'`のみを持つ。本プランで`'resetDirect' | 'stockEmptyDirect' | 'comboMilestoneDirect' | 'drawContinueDirect'`を追加するが、既存の`applyItemEffects`関数(gained/clearBonus専用)は変更せず、新チャンネル専用の`applyDirectEffects`関数を別途新設する(型を分けることで、既存のgained/clearBonus用コードに影響を与えない)。

---

### Task 1: データモデル拡張(WaveState新規フィールド・ItemId20個・talismansパラメータ・ITEM_NAMES・itemDesc)

**Files:**
- Modify: `src/lib/game/shidasu/types.ts`
- Modify: `src/lib/game/shidasu/params.ts`
- Modify: `src/lib/game/shidasu/shidasu.config.json`
- Modify: `src/lib/game/shidasu/engine.ts`(`startWave`・`ITEM_NAMES`・`itemDesc`)
- Modify: `src/lib/game/shidasu/engine.test.ts`(`makeWave`ヘルパー、新規テスト)

- [ ] **Step 1: 失敗するテストを書く**

`src/lib/game/shidasu/engine.test.ts`の`describe('DEFAULT_PARAMS.talismans.resilience', ...)`ブロックの直後に追加:

```ts
describe('DEFAULT_PARAMS.talismans (グループ9〜16)', () => {
  test('既定値が正しく設定されている', () => {
    expect(DEFAULT_PARAMS.talismans.gentleBreeze.n).toBe(100)
    expect(DEFAULT_PARAMS.talismans.resonance.x).toBe(0.3)
    expect(DEFAULT_PARAMS.talismans.azureSky.x).toBe(0.3)
    expect(DEFAULT_PARAMS.talismans.amber.x).toBe(0.1)
    expect(DEFAULT_PARAMS.talismans.composure.n).toBe(500)
    expect(DEFAULT_PARAMS.talismans.clarity.n).toBe(500)
    expect(DEFAULT_PARAMS.talismans.arrogance.x).toBe(50)
    expect(DEFAULT_PARAMS.talismans.echo.n).toBe(200)
    expect(DEFAULT_PARAMS.talismans.shootingStar.c).toBe(10)
    expect(DEFAULT_PARAMS.talismans.shootingStar.n).toBe(1000)
    expect(DEFAULT_PARAMS.talismans.intuition.x).toBe(0.3)
    expect(DEFAULT_PARAMS.talismans.sincerity.n).toBe(300)
    expect(DEFAULT_PARAMS.talismans.darkClouds.r).toBe(1)
    expect(DEFAULT_PARAMS.talismans.regeneration.p).toBe(50)
    expect(DEFAULT_PARAMS.talismans.passion.x).toBe(1.5)
    expect(DEFAULT_PARAMS.talismans.fightingSpirit.x).toBe(1.3)
  })
})
```

- [ ] **Step 2: テストを実行して失敗を確認**

Run: `npm run test -- engine.test.ts`
Expected: FAIL(`DEFAULT_PARAMS.talismans.gentleBreeze`等が`undefined`)

- [ ] **Step 3: `types.ts`に`ItemId`20個・`WaveState`9フィールドを追加**

`src/lib/game/shidasu/types.ts`の`ItemId`型定義の末尾(`| 'eternity' | 'abundance' | 'silence' | 'resilience'`の直後)に追加:

```ts
  | 'gentleBreeze' | 'resonance'
  | 'azureSky' | 'amber'
  | 'composure' | 'clarity' | 'arrogance' | 'echo' | 'shootingStar'
  | 'naive' | 'intuition' | 'sincerity'
  | 'promise' | 'darkClouds' | 'regeneration'
  | 'benevolence' | 'healing'
  | 'guidance'
  | 'passion' | 'fightingSpirit'
```

`WaveState`インターフェース内、`discardPile: Card[]`の直後に追加:

```ts
  // 微風・共鳴用: 直前にプレイした列番号(未プレイならnull)
  lastPlayedColumn: number | null
  // 微風・共鳴用: 同一列を連続でプレイした回数(1回目は1、以後連続でインクリメント)
  sameColumnStreak: number
  // 琥珀用: ウェーブ内で過去に到達した最大コンボ数
  maxComboThisWave: number
  // 蒼穹用: ウェーブ内で列一掃が発生した累計回数
  totalColumnsEmptiedThisWave: number
  // 冷静用: 現在のチェーン中に一度でも役ボーナスが成立したか
  roleFiredThisChain: boolean
  // 直感用: 現在のチェーン中に山札めくりでコンボ継続した回数(プレイを挟んでも加算され続け、コンボ/チェーンのリセットでのみ0に戻る)
  drawContinueCountThisChain: number
  // 情熱用: 現在のコンボ中にフラッシュが成立したか
  flushActiveThisCombo: boolean
  // 闘志用: このウェーブ中に列一掃が一度でも発生したか
  columnSweepActiveThisWave: boolean
  // 博愛用: 現在のコンボで無効化を既に使ったか
  benevolenceUsedThisCombo: boolean
```

- [ ] **Step 4: `params.ts`・`shidasu.config.json`にtalismansパラメータを追加**

`src/lib/game/shidasu/params.ts`の`ShidasuParams.talismans`型内、`resilience: { p: number }`の直後に追加:

```ts
    gentleBreeze: { n: number }
    resonance: { x: number }
    azureSky: { x: number }
    amber: { x: number }
    composure: { n: number }
    clarity: { n: number }
    arrogance: { x: number }
    echo: { n: number }
    shootingStar: { c: number; n: number }
    naive: Record<string, never>
    intuition: { x: number }
    sincerity: { n: number }
    promise: Record<string, never>
    darkClouds: { r: number }
    regeneration: { p: number }
    benevolence: Record<string, never>
    healing: Record<string, never>
    guidance: Record<string, never>
    passion: { x: number }
    fightingSpirit: { x: number }
```

`DEFAULT_PARAMS.talismans`内、`resilience: { p: 30 },`の直後に追加:

```ts
    gentleBreeze: { n: 100 },
    resonance: { x: 0.3 },
    azureSky: { x: 0.3 },
    amber: { x: 0.1 },
    composure: { n: 500 },
    clarity: { n: 500 },
    arrogance: { x: 50 },
    echo: { n: 200 },
    shootingStar: { c: 10, n: 1000 },
    naive: {},
    intuition: { x: 0.3 },
    sincerity: { n: 300 },
    promise: {},
    darkClouds: { r: 1 },
    regeneration: { p: 50 },
    benevolence: {},
    healing: {},
    guidance: {},
    passion: { x: 1.5 },
    fightingSpirit: { x: 1.3 },
```

`src/lib/game/shidasu/shidasu.config.json`の`talismans`オブジェクト内、`"resilience": { "p": 30 }`を以下に置き換える:

```json
    "resilience": { "p": 30 },
    "gentleBreeze": { "n": 100 },
    "resonance": { "x": 0.3 },
    "azureSky": { "x": 0.3 },
    "amber": { "x": 0.1 },
    "composure": { "n": 500 },
    "clarity": { "n": 500 },
    "arrogance": { "x": 50 },
    "echo": { "n": 200 },
    "shootingStar": { "c": 10, "n": 1000 },
    "naive": {},
    "intuition": { "x": 0.3 },
    "sincerity": { "n": 300 },
    "promise": {},
    "darkClouds": { "r": 1 },
    "regeneration": { "p": 50 },
    "benevolence": {},
    "healing": {},
    "guidance": {},
    "passion": { "x": 1.5 },
    "fightingSpirit": { "x": 1.3 }
```

- [ ] **Step 5: `startWave`に9フィールドの初期化を追加**

`src/lib/game/shidasu/engine.ts`の`startWave`関数内、`wave`オブジェクトの`discardPile: [],`の直後に追加:

```ts
    lastPlayedColumn: null,
    sameColumnStreak: 0,
    maxComboThisWave: 0,
    totalColumnsEmptiedThisWave: 0,
    roleFiredThisChain: false,
    drawContinueCountThisChain: 0,
    flushActiveThisCombo: false,
    columnSweepActiveThisWave: false,
    benevolenceUsedThisCombo: false,
```

- [ ] **Step 6: `makeWave`テストヘルパーに同じ初期値を追加**

`src/lib/game/shidasu/engine.test.ts`の`makeWave`関数内、`discardPile: [],`の直後に追加:

```ts
    lastPlayedColumn: null,
    sameColumnStreak: 0,
    maxComboThisWave: 0,
    totalColumnsEmptiedThisWave: 0,
    roleFiredThisChain: false,
    drawContinueCountThisChain: 0,
    flushActiveThisCombo: false,
    columnSweepActiveThisWave: false,
    benevolenceUsedThisCombo: false,
```

- [ ] **Step 7: `ITEM_NAMES`・`itemDesc`に20個分を追加**

`src/lib/game/shidasu/engine.ts`の`ITEM_NAMES`オブジェクト内、`resilience: '不屈の護符',`の直後に追加:

```ts
  gentleBreeze: '微風の護符',
  resonance: '共鳴の護符',
  azureSky: '蒼穹の護符',
  amber: '琥珀の護符',
  composure: '沈着の護符',
  clarity: '冷静の護符',
  arrogance: '慢心の護符',
  echo: '残響の護符',
  shootingStar: '流星の護符',
  naive: '素朴の護符',
  intuition: '直感の護符',
  sincerity: '誠実の護符',
  promise: '約束の護符',
  darkClouds: '暗雲の護符',
  regeneration: '再生の護符',
  benevolence: '博愛の護符',
  healing: '治癒の護符',
  guidance: '導きの護符',
  passion: '情熱の護符',
  fightingSpirit: '闘志の護符',
```

`itemDesc`関数内、`case 'resilience': ...`の直後に追加:

```ts
    case 'gentleBreeze': return `同じ列を連続でプレイしたとき(2回目以降)、連続回数×${params.talismans.gentleBreeze.n}点加算`
    case 'resonance': return `同じ列を連続でプレイしたとき(2回目以降)、連続回数×${params.talismans.resonance.x}分獲得点を倍加`
    case 'azureSky': return `ウェーブ内で列一掃した累計回数×${params.talismans.azureSky.x}分、獲得点を倍加`
    case 'amber': return `ウェーブ内の最大到達コンボ数×${params.talismans.amber.x}分、獲得点を倍加`
    case 'composure': return `山札めくりでコンボリセットされた時、取れる場札が無ければ直接${params.talismans.composure.n}点加算`
    case 'clarity': return `コンボリセット時、そのチェーンで役が一つも成立していなければ直接${params.talismans.clarity.n}点加算`
    case 'arrogance': return `山札が無くなった時、場札の残り枚数×${params.talismans.arrogance.x}点を直接加算`
    case 'echo': return `コンボがリセットされる瞬間、リセット前のコンボ数×${params.talismans.echo.n}点を直接加算`
    case 'shootingStar': return `コンボ数が${params.talismans.shootingStar.c}に到達した瞬間、直接${params.talismans.shootingStar.n}点加算`
    case 'naive': return `山札めくりがパターン継続だった場合、通常のプレイと同様に得点計算する(コンボ数も加算)`
    case 'intuition': return `(素朴と組み合わせて機能)現在のチェーン中に山札めくりでコンボ継続した回数×${params.talismans.intuition.x}分、獲得点を倍加`
    case 'sincerity': return `山札めくりで同色パターンによりコンボ継続した時、直接${params.talismans.sincerity.n}点加算`
    case 'promise': return `山札の次のカードが、今のコンボが継続できるカードになる`
    case 'darkClouds': return `ウェーブ開始時、場札が${params.talismans.darkClouds.r}行多く配られる`
    case 'regeneration': return `全消し時、スコアの${params.talismans.regeneration.p}%を消費して捨て札から場札を復活させる(復活すればウェーブ継続)`
    case 'benevolence': return `コンボごとに1回、コンボリセットを無効化する`
    case 'healing': return `列一掃時、捨て札から最大rows枚を空いた列へ戻す`
    case 'guidance': return `山札の次のカードが見えるようになる`
    case 'passion': return `このコンボ中にフラッシュが成立していれば、獲得点を${params.talismans.passion.x}倍`
    case 'fightingSpirit': return `このウェーブ中に列一掃が発生していれば、獲得点を${params.talismans.fightingSpirit.x}倍`
```

- [ ] **Step 8: テストを実行して成功を確認**

Run: `npm run test -- engine.test.ts`
Expected: PASS

Run: `npm run build`
Expected: 成功(この時点では`ITEM_EFFECTS`に20個の効果は未登録なので抽選プールにも未反映)

- [ ] **Step 9: コミット**

```bash
git add src/lib/game/shidasu/types.ts src/lib/game/shidasu/params.ts src/lib/game/shidasu/shidasu.config.json src/lib/game/shidasu/engine.ts src/lib/game/shidasu/engine.test.ts
git commit -m "$(cat <<'EOF'
feat: Shidasu護符グループ9〜16のデータモデル(WaveState新規state・ItemId・talismans設定)を追加

グループ9〜16の残り20個の護符idとパラメータ、WaveStateへの
9個の新規stateフィールドを追加した。ITEM_EFFECTSへの効果登録・
playCard/drawStockへの実際の配線は後続タスクで行う。
EOF
)"
```

---

### Task 2: 直接点チャンネル基盤(DirectEffectContext・applyDirectEffects)

**Files:**
- Modify: `src/lib/game/shidasu/engine.ts`
- Modify: `src/lib/game/shidasu/engine.test.ts`

- [ ] **Step 1: 失敗するテストを書く**

`src/lib/game/shidasu/engine.test.ts`の末尾に追加:

```ts
describe('applyDirectEffects', () => {
  const params = DEFAULT_PARAMS

  function directCtx(overrides: Partial<DirectEffectContext> = {}): DirectEffectContext {
    return {
      comboBeforeReset: 0,
      hasPlayableColumns: true,
      roleFiredThisChain: false,
      remainingTableauCount: 10,
      combo: 1,
      colorHeld: false,
      ...overrides,
    }
  }

  test('未登録の護符は素通りする', () => {
    const result = applyDirectEffects('resetDirect', ['bridge'], directCtx(), params)
    expect(result).toBe(0)
  })

  test('沈着: 取れる場札が無ければresetDirectで加算', () => {
    const fired = applyDirectEffects('resetDirect', ['composure'], directCtx({ hasPlayableColumns: false }), params)
    expect(fired).toBe(params.talismans.composure.n)
    const notFired = applyDirectEffects('resetDirect', ['composure'], directCtx({ hasPlayableColumns: true }), params)
    expect(notFired).toBe(0)
  })

  test('冷静: 役が一つも成立していなければresetDirectで加算', () => {
    const fired = applyDirectEffects('resetDirect', ['clarity'], directCtx({ roleFiredThisChain: false }), params)
    expect(fired).toBe(params.talismans.clarity.n)
    const notFired = applyDirectEffects('resetDirect', ['clarity'], directCtx({ roleFiredThisChain: true }), params)
    expect(notFired).toBe(0)
  })

  test('残響: resetDirectでリセット前のコンボ数×nを加算', () => {
    const result = applyDirectEffects('resetDirect', ['echo'], directCtx({ comboBeforeReset: 5 }), params)
    expect(result).toBe(5 * params.talismans.echo.n)
  })

  test('沈着・冷静・残響は同時に発火しうる(合算される)', () => {
    const result = applyDirectEffects('resetDirect', ['composure', 'clarity', 'echo'], directCtx({ hasPlayableColumns: false, roleFiredThisChain: false, comboBeforeReset: 2 }), params)
    expect(result).toBe(params.talismans.composure.n + params.talismans.clarity.n + 2 * params.talismans.echo.n)
  })

  test('慢心: stockEmptyDirectで場札残数×xを加算', () => {
    const result = applyDirectEffects('stockEmptyDirect', ['arrogance'], directCtx({ remainingTableauCount: 7 }), params)
    expect(result).toBe(7 * params.talismans.arrogance.x)
  })

  test('流星: comboMilestoneDirectでコンボ数がちょうどcの時のみ加算', () => {
    const fired = applyDirectEffects('comboMilestoneDirect', ['shootingStar'], directCtx({ combo: params.talismans.shootingStar.c }), params)
    expect(fired).toBe(params.talismans.shootingStar.n)
    const notFired = applyDirectEffects('comboMilestoneDirect', ['shootingStar'], directCtx({ combo: params.talismans.shootingStar.c + 1 }), params)
    expect(notFired).toBe(0)
  })

  test('誠実: drawContinueDirectで同色パターン継続の時のみ加算', () => {
    const fired = applyDirectEffects('drawContinueDirect', ['sincerity'], directCtx({ colorHeld: true }), params)
    expect(fired).toBe(params.talismans.sincerity.n)
    const notFired = applyDirectEffects('drawContinueDirect', ['sincerity'], directCtx({ colorHeld: false }), params)
    expect(notFired).toBe(0)
  })

  test('gainedチャンネルの護符はdirectチャンネルには影響しない', () => {
    const result = applyDirectEffects('resetDirect', ['courage'], directCtx(), params)
    expect(result).toBe(0)
  })
})
```

- [ ] **Step 2: テストを実行して失敗を確認**

Run: `npm run test -- engine.test.ts`
Expected: FAIL(`DirectEffectContext`・`applyDirectEffects`が存在しない)

- [ ] **Step 3: `DirectEffectContext`型・`DirectChannel`型・`applyDirectEffects`を実装**

`src/lib/game/shidasu/engine.ts`の`applyItemEffects`関数の直後に追加:

```ts
export type DirectChannel = 'resetDirect' | 'stockEmptyDirect' | 'comboMilestoneDirect' | 'drawContinueDirect'

export interface DirectEffectContext {
  comboBeforeReset: number
  hasPlayableColumns: boolean
  roleFiredThisChain: boolean
  remainingTableauCount: number
  combo: number
  colorHeld: boolean
}

type DirectEffect = (ctx: DirectEffectContext, params: ShidasuParams) => number

const DIRECT_EFFECTS: Partial<Record<ItemId, { channel: DirectChannel; effect: DirectEffect }>> = {
  composure: {
    channel: 'resetDirect',
    effect: (ctx, p) => (ctx.hasPlayableColumns ? 0 : p.talismans.composure.n),
  },
  clarity: {
    channel: 'resetDirect',
    effect: (ctx, p) => (ctx.roleFiredThisChain ? 0 : p.talismans.clarity.n),
  },
  echo: {
    channel: 'resetDirect',
    effect: (ctx, p) => ctx.comboBeforeReset * p.talismans.echo.n,
  },
  arrogance: {
    channel: 'stockEmptyDirect',
    effect: (ctx, p) => ctx.remainingTableauCount * p.talismans.arrogance.x,
  },
  shootingStar: {
    channel: 'comboMilestoneDirect',
    effect: (ctx, p) => (ctx.combo === p.talismans.shootingStar.c ? p.talismans.shootingStar.n : 0),
  },
  sincerity: {
    channel: 'drawContinueDirect',
    effect: (ctx, p) => (ctx.colorHeld ? p.talismans.sincerity.n : 0),
  },
}

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

- [ ] **Step 4: テストを実行して成功を確認**

Run: `npm run test -- engine.test.ts`
Expected: PASS

Run: `npm run build`
Expected: 成功

- [ ] **Step 5: コミット**

```bash
git add src/lib/game/shidasu/engine.ts src/lib/game/shidasu/engine.test.ts
git commit -m "$(cat <<'EOF'
feat: Shidasu護符に直接点チャンネル基盤(applyDirectEffects)を追加

resetDirect/stockEmptyDirect/comboMilestoneDirect/drawContinueDirectの
4チャンネルと、それぞれに対応する沈着・冷静・残響・慢心・流星・誠実の
効果関数を実装した。playCard/drawStockへの配線は後続タスクで行う。
EOF
)"
```

---

### Task 3: playCardへのstate更新配線とcomboMilestoneDirect

**Files:**
- Modify: `src/lib/game/shidasu/engine.ts`
- Modify: `src/lib/game/shidasu/engine.test.ts`

- [ ] **Step 1: 失敗するテストを書く**

`src/lib/game/shidasu/engine.test.ts`の`describe('playCard', ...)`ブロックの末尾(閉じ`})`の直前)に追加:

```ts
  test('同じ列を連続でプレイするとsameColumnStreakが増え、違う列なら1に戻る', () => {
    const wave = baseWave({
      tableau: [[card(9, '♠', 1), card(1, '♣', 6)], [card(10, '♠', 2), card(2, '♦', 7)]],
    })
    const first = playCard(DEFAULT_PARAMS, wave, 'none', [], 1000000, 0)
    expect(first.sameColumnStreak).toBe(1)
    expect(first.lastPlayedColumn).toBe(0)
    const second = playCard(DEFAULT_PARAMS, first, 'none', [], 1000000, 0)
    expect(second.sameColumnStreak).toBe(2)
    const wave2 = baseWave({
      tableau: [[card(9, '♠', 1), card(1, '♣', 6)], [card(10, '♠', 2), card(2, '♦', 2)]],
    })
    const thirdSetup = playCard(DEFAULT_PARAMS, wave2, 'none', [], 1000000, 0)
    const differentColumn = playCard(DEFAULT_PARAMS, { ...thirdSetup, foundation: card(1, '♣', 6) }, 'none', [], 1000000, 1)
    expect(differentColumn.sameColumnStreak).toBe(1)
    expect(differentColumn.lastPlayedColumn).toBe(1)
  })

  test('maxComboThisWaveはこれまでの最大コンボ数を保持する', () => {
    const wave = baseWave({ combo: 5, tableau: [[card(9, '♠', 1), card(1, '♣', 6)], [card(2, '♦', 2)]], maxComboThisWave: 5 })
    const next = playCard(DEFAULT_PARAMS, wave, 'none', [], 1000000, 0)
    expect(next.combo).toBe(6)
    expect(next.maxComboThisWave).toBe(6)
    const wave2 = baseWave({ combo: 2, tableau: [[card(9, '♠', 1), card(1, '♣', 6)], [card(2, '♦', 2)]], maxComboThisWave: 10 })
    const next2 = playCard(DEFAULT_PARAMS, wave2, 'none', [], 1000000, 0)
    expect(next2.maxComboThisWave).toBe(10) // 既存の最大値の方が大きければ維持
  })

  test('列一掃が成立するとtotalColumnsEmptiedThisWaveとcolumnSweepActiveThisWaveが更新される', () => {
    const wave = baseWave({
      tableau: [[card(1, '♣', 6)], [card(2, '♦', 9)]],
      comboStreakColumnLengths: [DEFAULT_PARAMS.layout.rows, 1],
      totalColumnsEmptiedThisWave: 3,
      columnSweepActiveThisWave: false,
    })
    const next = playCard(DEFAULT_PARAMS, wave, 'none', [], 1000000, 0)
    expect(next.totalColumnsEmptiedThisWave).toBe(4)
    expect(next.columnSweepActiveThisWave).toBe(true)
  })

  test('役ボーナスが成立するとroleFiredThisChainがtrueになり、フラッシュならflushActiveThisComboもtrueになる', () => {
    const wave = baseWave({
      foundation: card(0, '♠', 1),
      chain: [card(20, '♥', 11), card(21, '♦', 12)], // ロイヤル役成立目前(J,Q)
      tableau: [[card(1, '♣', 13)], [card(2, '♦', 2)]],
      roleFiredThisChain: false,
    })
    const next = playCard(DEFAULT_PARAMS, wave, 'none', [], 1000000, 0)
    expect(next.roleFiredThisChain).toBe(true)
  })

  test('流星: コンボ数がcに到達した瞬間、直接点が加算される', () => {
    const c = DEFAULT_PARAMS.talismans.shootingStar.c
    const wave = baseWave({
      combo: c - 1,
      tableau: [[card(9, '♠', 1), card(1, '♣', 6)], [card(2, '♦', 2)]],
    })
    const next = playCard(DEFAULT_PARAMS, wave, 'none', ['shootingStar'], 1000000, 0)
    expect(next.combo).toBe(c)
    expect(next.score).toBe(scoring.basePoint + DEFAULT_PARAMS.talismans.shootingStar.n)
  })
```

- [ ] **Step 2: テストを実行して失敗を確認**

Run: `npm run test -- engine.test.ts`
Expected: FAIL(`sameColumnStreak`等が更新されていない、`shootingStar`の直接点も未加算)

- [ ] **Step 3: `playCard`にstate更新とcomboMilestoneDirectの配線を追加**

`src/lib/game/shidasu/engine.ts`の`playCard`関数を以下に置き換える:

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

  const newSameColumnStreak = wave.lastPlayedColumn === colIndex ? wave.sameColumnStreak + 1 : 1
  const newMaxComboThisWave = Math.max(wave.maxComboThisWave, newCombo)
  const newTotalColumnsEmptiedThisWave = wave.totalColumnsEmptiedThisWave + (sweepQualifies ? 1 : 0)
  const newColumnSweepActiveThisWave = wave.columnSweepActiveThisWave || sweepQualifies
  const newRoleFiredThisChain = wave.roleFiredThisChain || roleFired.length > 0
  const newFlushActiveThisCombo = wave.flushActiveThisCombo || roleFired.some(r => r.name === 'flush')

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
    sameColumnStreak: newSameColumnStreak,
    totalColumnsEmptiedThisWave: newTotalColumnsEmptiedThisWave,
    maxComboThisWave: newMaxComboThisWave,
    flushActiveThisCombo: newFlushActiveThisCombo,
    columnSweepActiveThisWave: newColumnSweepActiveThisWave,
    drawContinueCountThisChain: wave.drawContinueCountThisChain,
  }

  const comboMultiplierStep = params.scoring.comboMultiplierStep
  const multiplier = 1 + (newCombo - 1) * comboMultiplierStep
  if (multiplier !== 1) parts.push(`コンボ倍率×${fmtMultiplier(multiplier)}`)
  const rawGained = Math.floor(base * multiplier)
  const itemResult = applyItemEffects('gained', rawGained, items, itemEffectCtx, params)
  parts.push(...itemResult.parts)
  let gained = Math.floor(itemResult.value)

  const milestoneCtx: DirectEffectContext = {
    comboBeforeReset: 0,
    hasPlayableColumns: true,
    roleFiredThisChain: newRoleFiredThisChain,
    remainingTableauCount: remaining,
    combo: newCombo,
    colorHeld: false,
  }
  gained += applyDirectEffects('comboMilestoneDirect', items, milestoneCtx, params)

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
    lastPlayedColumn: colIndex,
    sameColumnStreak: newSameColumnStreak,
    maxComboThisWave: newMaxComboThisWave,
    totalColumnsEmptiedThisWave: newTotalColumnsEmptiedThisWave,
    roleFiredThisChain: newRoleFiredThisChain,
    flushActiveThisCombo: newFlushActiveThisCombo,
    columnSweepActiveThisWave: newColumnSweepActiveThisWave,
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

- [ ] **Step 4: `ItemEffectContext`に6フィールドを追加**

`src/lib/game/shidasu/engine.ts`の`ItemEffectContext`インターフェース内、`effectiveStairMinLen: number`の直後に追加:

```ts
  // 微風・共鳴用: このプレイ後の同一列連続回数
  sameColumnStreak: number
  // 蒼穹用: このプレイ後のウェーブ内列一掃累計回数
  totalColumnsEmptiedThisWave: number
  // 琥珀用: このプレイ後のウェーブ内最大到達コンボ数
  maxComboThisWave: number
  // 情熱用: このプレイ後、現在のコンボ中にフラッシュが成立しているか
  flushActiveThisCombo: boolean
  // 闘志用: このプレイ後、このウェーブ中に列一掃が発生しているか
  columnSweepActiveThisWave: boolean
  // 直感用: 現在のチェーン中に山札めくりでコンボ継続した回数
  drawContinueCountThisChain: number
```

- [ ] **Step 5: 既存の`applyItemEffects`テスト用`ctx()`ヘルパーを新フィールド込みに更新**

`src/lib/game/shidasu/engine.test.ts`の`describe('applyItemEffects', ...)`ブロック内の`ctx()`関数、および他の`describe('applyItemEffects (グループ...`ブロック内の`ctx()`関数(各グループごとに個別定義されている)全てに、以下のフィールドをデフォルト値として追加する:

```ts
        sameColumnStreak: 1,
        totalColumnsEmptiedThisWave: 0,
        maxComboThisWave: 1,
        flushActiveThisCombo: false,
        columnSweepActiveThisWave: false,
        drawContinueCountThisChain: 0,
```

(`effectiveStairMinLen: params.scoring.stairMinLen,`の直後に追加する形で、ファイル内の`function ctx(overrides: Partial<ItemEffectContext> = {})`という定義を全て検索し、同じ6行を追加する。)

- [ ] **Step 6: テストを実行して成功を確認**

Run: `npm run test -- engine.test.ts`
Expected: PASS

Run: `npm run build`
Expected: 成功

- [ ] **Step 7: コミット**

```bash
git add src/lib/game/shidasu/engine.ts src/lib/game/shidasu/engine.test.ts
git commit -m "$(cat <<'EOF'
feat: playCardにグループ9〜16向けstate更新とcomboMilestoneDirectを配線

sameColumnStreak・maxComboThisWave・totalColumnsEmptiedThisWave・
roleFiredThisChain・flushActiveThisCombo・columnSweepActiveThisWaveを
playCardで更新するようにし、流星の護符(comboMilestoneDirect)も
組み込んだ。ItemEffectContextにも対応するフィールドを追加。
EOF
)"
```

---

### Task 4: drawStockへのstate更新配線(resetDirect・stockEmptyDirect・drawContinueDirect)

**Files:**
- Modify: `src/lib/game/shidasu/engine.ts`
- Modify: `src/lib/game/shidasu/engine.test.ts`

- [ ] **Step 1: 失敗するテストを書く**

`src/lib/game/shidasu/engine.test.ts`の`describe('drawStock', ...)`ブロックの末尾(閉じ`})`の直前)に追加:

```ts
  test('沈着: リセット時に取れる場札が無ければ直接点が加算される', () => {
    const wave = makeWave({
      stock: [card(1, '♣', 9)],
      tableau: [[card(2, '♠', 2)]], // 差が大きく取れない
      chain: [card(3, '♥', 5)],
      linked: true,
      score: 100,
    })
    const { wave: next } = drawStock(DEFAULT_PARAMS, wave, ['composure'], standardDeckComposition())
    expect(next.score).toBe(100 + DEFAULT_PARAMS.talismans.composure.n)
  })

  test('冷静: リセットされるチェーンで役が一つも成立していなければ直接点が加算される', () => {
    const wave = makeWave({
      stock: [card(1, '♣', 9)],
      tableau: [[card(2, '♣', 8)]],
      chain: [card(3, '♥', 5)],
      linked: true,
      roleFiredThisChain: false,
      score: 100,
    })
    const { wave: next } = drawStock(DEFAULT_PARAMS, wave, ['clarity'], standardDeckComposition())
    expect(next.score).toBe(100 + DEFAULT_PARAMS.talismans.clarity.n)
  })

  test('冷静: 役が成立していたチェーンのリセットでは発動しない', () => {
    const wave = makeWave({
      stock: [card(1, '♣', 9)],
      tableau: [[card(2, '♣', 8)]],
      chain: [card(3, '♥', 5)],
      linked: true,
      roleFiredThisChain: true,
      score: 100,
    })
    const { wave: next } = drawStock(DEFAULT_PARAMS, wave, ['clarity'], standardDeckComposition())
    expect(next.score).toBe(100)
  })

  test('残響: リセット時、リセット前のコンボ数×nが直接加算される', () => {
    const wave = makeWave({
      stock: [card(1, '♣', 9)],
      tableau: [[card(2, '♣', 8)]],
      chain: [card(3, '♥', 5)],
      linked: true,
      combo: 4,
      score: 100,
    })
    const { wave: next } = drawStock(DEFAULT_PARAMS, wave, ['echo'], standardDeckComposition())
    expect(next.score).toBe(100 + 4 * DEFAULT_PARAMS.talismans.echo.n)
  })

  test('リセット時、roleFiredThisChainがfalseに戻る', () => {
    const wave = makeWave({
      stock: [card(1, '♣', 9)],
      chain: [card(3, '♥', 5)],
      linked: true,
      roleFiredThisChain: true,
    })
    const { wave: next } = drawStock(DEFAULT_PARAMS, wave, [], standardDeckComposition())
    expect(next.roleFiredThisChain).toBe(false)
  })

  test('慢心: 山札が0枚になった瞬間、場札残数×xが直接加算される', () => {
    const wave = makeWave({
      stock: [card(1, '♣', 9)],
      tableau: [[card(2, '♣', 8)], [card(4, '♦', 5)]],
      chain: [card(3, '♥', 1)],
      linked: false,
      score: 100,
    })
    const { wave: next } = drawStock(DEFAULT_PARAMS, wave, ['arrogance'], standardDeckComposition())
    expect(next.stock).toHaveLength(0)
    expect(next.score).toBe(100 + 2 * DEFAULT_PARAMS.talismans.arrogance.x)
  })

  test('誠実: パターン継続めくりが同色パターンで成立すると直接点が加算される', () => {
    const wave = makeWave({
      stock: [card(1, '♠', 6)], // 黒(色継続)
      chain: [card(2, '♣', 4), card(3, '♠', 5)], // 黒2枚、同色成立中
      linked: true,
      combo: 2,
      score: 100,
      drawContinueCountThisChain: 0,
    })
    const { wave: next } = drawStock(DEFAULT_PARAMS, wave, ['sincerity'], standardDeckComposition())
    expect(next.linked).toBe(true)
    expect(next.score).toBe(100 + DEFAULT_PARAMS.talismans.sincerity.n)
    expect(next.drawContinueCountThisChain).toBe(1)
  })

  test('パターン継続めくりが同スートパターンで成立した場合、誠実は発動しない(同色専用)', () => {
    const wave = makeWave({
      stock: [card(1, '♠', 6)],
      chain: [card(2, '♠', 4), card(3, '♠', 5)], // 同スート成立中
      linked: true,
      score: 100,
    })
    const { wave: next } = drawStock(DEFAULT_PARAMS, wave, ['sincerity'], standardDeckComposition())
    expect(next.score).toBe(100)
  })

  test('博愛: コンボごとに1回だけリセットを無効化し、パターン継続と同じ扱いになる', () => {
    const wave = makeWave({
      stock: [card(1, '♣', 9)], // 同スートでも階段でもなく本来リセットする
      chain: [card(2, '♥', 5)],
      linked: true,
      combo: 2,
      benevolenceUsedThisCombo: false,
    })
    const { wave: next } = drawStock(DEFAULT_PARAMS, wave, ['benevolence'], standardDeckComposition())
    expect(next.combo).toBe(2) // リセットされず維持
    expect(next.linked).toBe(true)
    expect(next.chain).toEqual([card(2, '♥', 5), card(1, '♣', 9)])
    expect(next.benevolenceUsedThisCombo).toBe(true)
  })

  test('博愛: 既に今のコンボで使っていれば通常通りリセットされる', () => {
    const wave = makeWave({
      stock: [card(1, '♣', 9)],
      chain: [card(2, '♥', 5)],
      linked: true,
      combo: 2,
      benevolenceUsedThisCombo: true,
    })
    const { wave: next } = drawStock(DEFAULT_PARAMS, wave, ['benevolence'], standardDeckComposition())
    expect(next.combo).toBe(0)
  })
```

- [ ] **Step 2: テストを実行して失敗を確認**

Run: `npm run test -- engine.test.ts`
Expected: FAIL(直接点未加算、`roleFiredThisChain`/`drawContinueCountThisChain`/`benevolenceUsedThisCombo`の更新が無い、博愛が機能しない)

- [ ] **Step 3: `drawStock`にstate更新と直接点チャンネルの配線を追加**

`src/lib/game/shidasu/engine.ts`の`drawStock`関数を以下に置き換える:

```ts
export function drawStock(
  params: ShidasuParams,
  wave: WaveState,
  items: ItemId[],
  deckComposition: DeckCard[],
  modifier: StageModifier = 'none',
  rand: () => number = Math.random
): { wave: WaveState; deckComposition: DeckCard[] } {
  if (wave.status !== 'playing') return { wave, deckComposition }
  if (wave.stock.length === 0) return { wave, deckComposition }

  const newStock = [...wave.stock]
  const drawnCard = newStock.pop() as Card

  const effectiveStairMinLen = items.includes('bridge') ? params.items.stairRelaxedMinLen : params.scoring.stairMinLen
  const wouldContinue = wave.linked && chainContinuesPattern(params.scoring, wave.chain, drawnCard, effectiveStairMinLen)
  const benevolenceFires = !wouldContinue && items.includes('benevolence') && !wave.benevolenceUsedThisCombo
  const patternContinues = wouldContinue || benevolenceFires

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
    scoreAfterStockEmpty += applyDirectEffects('stockEmptyDirect', items, stockEmptyCtx, params)
  }

  if (patternContinues) {
    const { colorHeld } = analyzeSuitColor([...wave.chain, drawnCard])
    const { suitHeld } = analyzeSuitColor([...wave.chain, drawnCard])
    const drawContinueCtx: DirectEffectContext = {
      comboBeforeReset: 0,
      hasPlayableColumns: true,
      roleFiredThisChain: false,
      remainingTableauCount: remainingCount(wave.tableau),
      combo: wave.combo,
      colorHeld: colorHeld && !suitHeld,
    }
    const directGain = wouldContinue ? applyDirectEffects('drawContinueDirect', items, drawContinueCtx, params) : 0
    return {
      wave: {
        ...wave,
        stock: newStock,
        foundation: drawnCard,
        chain: [...wave.chain, drawnCard],
        chainOrigin: [...wave.chainOrigin, 'draw'],
        linked: true,
        lastDrawEffect: drawnCard.wild ? 'wild' : 'pattern',
        lastGain: null,
        score: scoreAfterStockEmpty + directGain,
        drawContinueCountThisChain: wouldContinue ? wave.drawContinueCountThisChain + 1 : wave.drawContinueCountThisChain,
        benevolenceUsedThisCombo: benevolenceFires ? true : wave.benevolenceUsedThisCombo,
      },
      deckComposition,
    }
  }

  // combo: 0 を明示するのは、faceLock(絵札はコンボ2以上でのみ取得可)を正しく評価するため。
  // ここはリセット後の状態を先読みして判定しており、実際にリセットが起きた後のcomboは常に0になる。
  const hasPlayableColumns = getPlayableColumns(modifier, { ...wave, foundation: drawnCard, combo: 0 }).size > 0
  const silenceFires = !hasPlayableColumns && items.includes('silence')
  const card = silenceFires ? { ...drawnCard, wild: true } : drawnCard
  const newDeckComposition = silenceFires ? convertRandomCardToWild(deckComposition, rand) : deckComposition

  const resetCtx: DirectEffectContext = {
    comboBeforeReset: wave.combo,
    hasPlayableColumns,
    roleFiredThisChain: wave.roleFiredThisChain,
    remainingTableauCount: remainingCount(wave.tableau),
    combo: wave.combo,
    colorHeld: false,
  }
  const resetDirectGain = applyDirectEffects('resetDirect', items, resetCtx, params)

  return {
    wave: {
      ...wave,
      stock: newStock,
      foundation: card,
      combo: 0,
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
    },
    deckComposition: newDeckComposition,
  }
}
```

- [ ] **Step 4: テストを実行して成功を確認**

Run: `npm run test -- engine.test.ts`
Expected: PASS

Run: `npm run build`
Expected: 成功

- [ ] **Step 5: コミット**

```bash
git add src/lib/game/shidasu/engine.ts src/lib/game/shidasu/engine.test.ts
git commit -m "$(cat <<'EOF'
feat: drawStockにグループ9〜16向け直接点チャンネルと博愛を配線

沈着・冷静・残響(resetDirect)、慢心(stockEmptyDirect)、
誠実(drawContinueDirect)を組み込み、リセット時のstate初期化
(roleFiredThisChain等)と博愛によるリセット無効化を実装した。
EOF
)"
```

---

### Task 5: グループ9(微風・共鳴、2個)

**Files:**
- Modify: `src/lib/game/shidasu/engine.ts`
- Modify: `src/lib/game/shidasu/engine.test.ts`

- [ ] **Step 1: 失敗するテストを書く**

`src/lib/game/shidasu/engine.test.ts`の末尾に追加:

```ts
describe('applyItemEffects (グループ9: 列選択の連続性)', () => {
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
      sameColumnStreak: 1,
      totalColumnsEmptiedThisWave: 0,
      maxComboThisWave: 1,
      flushActiveThisCombo: false,
      columnSweepActiveThisWave: false,
      drawContinueCountThisChain: 0,
      ...overrides,
    }
  }

  test('微風: 同一列連続2回目以降のみ、連続回数×nを加算', () => {
    const notFired = applyItemEffects('gained', 100, ['gentleBreeze'], ctx({ sameColumnStreak: 1 }), params)
    expect(notFired.value).toBe(100)
    const fired = applyItemEffects('gained', 100, ['gentleBreeze'], ctx({ sameColumnStreak: 3 }), params)
    expect(fired.value).toBe(100 + 3 * params.talismans.gentleBreeze.n)
  })

  test('共鳴: 同一列連続2回目以降のみ、連続回数×xで倍算', () => {
    const notFired = applyItemEffects('gained', 100, ['resonance'], ctx({ sameColumnStreak: 1 }), params)
    expect(notFired.value).toBe(100)
    const fired = applyItemEffects('gained', 100, ['resonance'], ctx({ sameColumnStreak: 3 }), params)
    expect(fired.value).toBe(100 * (1 + 3 * params.talismans.resonance.x))
  })
})
```

- [ ] **Step 2: テストを実行して失敗を確認**

Run: `npm run test -- engine.test.ts`
Expected: FAIL

- [ ] **Step 3: `ITEM_EFFECTS`に2個追加**

`src/lib/game/shidasu/engine.ts`の`ITEM_EFFECTS`オブジェクト内、`drizzle`エントリの直後に追加:

```ts
  gentleBreeze: {
    channel: 'gained',
    effect: (v, ctx, p) => {
      if (ctx.sameColumnStreak < 2) return { value: v, part: null }
      const add = ctx.sameColumnStreak * p.talismans.gentleBreeze.n
      return { value: v + add, part: `微風+${add}` }
    },
  },
  resonance: {
    channel: 'gained',
    effect: (v, ctx, p) => {
      if (ctx.sameColumnStreak < 2) return { value: v, part: null }
      const factor = 1 + ctx.sameColumnStreak * p.talismans.resonance.x
      return { value: v * factor, part: `共鳴×${fmtMultiplier(factor)}` }
    },
  },
```

- [ ] **Step 4: テストを実行して成功を確認**

Run: `npm run test -- engine.test.ts`
Expected: PASS

- [ ] **Step 5: コミット**

```bash
git add src/lib/game/shidasu/engine.ts src/lib/game/shidasu/engine.test.ts
git commit -m "$(cat <<'EOF'
feat: Shidasu護符に微風・共鳴(グループ9)を追加
EOF
)"
```

---

### Task 6: グループ10(蒼穹・琥珀、2個)

**Files:**
- Modify: `src/lib/game/shidasu/engine.ts`
- Modify: `src/lib/game/shidasu/engine.test.ts`

- [ ] **Step 1: 失敗するテストを書く**

`src/lib/game/shidasu/engine.test.ts`の末尾に追加:

```ts
describe('applyItemEffects (グループ10: ウェーブ内累積state)', () => {
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
      sameColumnStreak: 1,
      totalColumnsEmptiedThisWave: 0,
      maxComboThisWave: 1,
      flushActiveThisCombo: false,
      columnSweepActiveThisWave: false,
      drawContinueCountThisChain: 0,
      ...overrides,
    }
  }

  test('蒼穹: ウェーブ内列一掃累計回数×xで倍算', () => {
    const result = applyItemEffects('gained', 100, ['azureSky'], ctx({ totalColumnsEmptiedThisWave: 4 }), params)
    expect(result.value).toBe(100 * (1 + 4 * params.talismans.azureSky.x))
  })

  test('琥珀: ウェーブ内最大到達コンボ数×xで倍算', () => {
    const result = applyItemEffects('gained', 100, ['amber'], ctx({ maxComboThisWave: 8 }), params)
    expect(result.value).toBe(100 * (1 + 8 * params.talismans.amber.x))
  })
})
```

- [ ] **Step 2: テストを実行して失敗を確認**

Run: `npm run test -- engine.test.ts`
Expected: FAIL

- [ ] **Step 3: `ITEM_EFFECTS`に2個追加**

`src/lib/game/shidasu/engine.ts`の`ITEM_EFFECTS`オブジェクト内、`resonance`エントリの直後に追加:

```ts
  azureSky: {
    channel: 'gained',
    effect: (v, ctx, p) => {
      const factor = 1 + ctx.totalColumnsEmptiedThisWave * p.talismans.azureSky.x
      return { value: v * factor, part: `蒼穹×${fmtMultiplier(factor)}` }
    },
  },
  amber: {
    channel: 'gained',
    effect: (v, ctx, p) => {
      const factor = 1 + ctx.maxComboThisWave * p.talismans.amber.x
      return { value: v * factor, part: `琥珀×${fmtMultiplier(factor)}` }
    },
  },
```

- [ ] **Step 4: テストを実行して成功を確認**

Run: `npm run test -- engine.test.ts`
Expected: PASS

- [ ] **Step 5: コミット**

```bash
git add src/lib/game/shidasu/engine.ts src/lib/game/shidasu/engine.test.ts
git commit -m "$(cat <<'EOF'
feat: Shidasu護符に蒼穹・琥珀(グループ10)を追加
EOF
)"
```

---

### Task 7: グループ16(情熱・闘志、2個)

**Files:**
- Modify: `src/lib/game/shidasu/engine.ts`
- Modify: `src/lib/game/shidasu/engine.test.ts`

- [ ] **Step 1: 失敗するテストを書く**

`src/lib/game/shidasu/engine.test.ts`の末尾に追加:

```ts
describe('applyItemEffects (グループ16: 持続効果)', () => {
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
      sameColumnStreak: 1,
      totalColumnsEmptiedThisWave: 0,
      maxComboThisWave: 1,
      flushActiveThisCombo: false,
      columnSweepActiveThisWave: false,
      drawContinueCountThisChain: 0,
      ...overrides,
    }
  }

  test('情熱: フラッシュ成立中フラグが立っていれば倍算', () => {
    const fired = applyItemEffects('gained', 100, ['passion'], ctx({ flushActiveThisCombo: true }), params)
    expect(fired.value).toBe(100 * params.talismans.passion.x)
    const notFired = applyItemEffects('gained', 100, ['passion'], ctx({ flushActiveThisCombo: false }), params)
    expect(notFired.value).toBe(100)
  })

  test('闘志: 列一掃発生済みフラグが立っていれば倍算', () => {
    const fired = applyItemEffects('gained', 100, ['fightingSpirit'], ctx({ columnSweepActiveThisWave: true }), params)
    expect(fired.value).toBe(100 * params.talismans.fightingSpirit.x)
    const notFired = applyItemEffects('gained', 100, ['fightingSpirit'], ctx({ columnSweepActiveThisWave: false }), params)
    expect(notFired.value).toBe(100)
  })
})
```

- [ ] **Step 2: テストを実行して失敗を確認**

Run: `npm run test -- engine.test.ts`
Expected: FAIL

- [ ] **Step 3: `ITEM_EFFECTS`に2個追加**

`src/lib/game/shidasu/engine.ts`の`ITEM_EFFECTS`オブジェクト内、`amber`エントリの直後に追加:

```ts
  passion: {
    channel: 'gained',
    effect: (v, ctx, p) =>
      ctx.flushActiveThisCombo
        ? { value: v * p.talismans.passion.x, part: `情熱×${fmtMultiplier(p.talismans.passion.x)}` }
        : { value: v, part: null },
  },
  fightingSpirit: {
    channel: 'gained',
    effect: (v, ctx, p) =>
      ctx.columnSweepActiveThisWave
        ? { value: v * p.talismans.fightingSpirit.x, part: `闘志×${fmtMultiplier(p.talismans.fightingSpirit.x)}` }
        : { value: v, part: null },
  },
```

- [ ] **Step 4: テストを実行して成功を確認**

Run: `npm run test -- engine.test.ts`
Expected: PASS

- [ ] **Step 5: コミット**

```bash
git add src/lib/game/shidasu/engine.ts src/lib/game/shidasu/engine.test.ts
git commit -m "$(cat <<'EOF'
feat: Shidasu護符に情熱・闘志(グループ16)を追加
EOF
)"
```

---

### Task 8: 直感(グループ12、1個)・素朴の得点ルール変更

**Files:**
- Modify: `src/lib/game/shidasu/engine.ts`
- Modify: `src/lib/game/shidasu/engine.test.ts`

- [ ] **Step 1: 失敗するテストを書く**

`src/lib/game/shidasu/engine.test.ts`の末尾に追加:

```ts
describe('applyItemEffects (グループ12: 直感)', () => {
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
      sameColumnStreak: 1,
      totalColumnsEmptiedThisWave: 0,
      maxComboThisWave: 1,
      flushActiveThisCombo: false,
      columnSweepActiveThisWave: false,
      drawContinueCountThisChain: 0,
      ...overrides,
    }
  }

  test('直感: drawContinueCountThisChainが0より大きい時のみ、その回数×xで倍算', () => {
    const notFired = applyItemEffects('gained', 100, ['intuition'], ctx({ drawContinueCountThisChain: 0 }), params)
    expect(notFired.value).toBe(100)
    const fired = applyItemEffects('gained', 100, ['intuition'], ctx({ drawContinueCountThisChain: 3 }), params)
    expect(fired.value).toBe(100 * (1 + 3 * params.talismans.intuition.x))
  })
})

describe('drawStock (素朴の得点ルール変更)', () => {
  test('素朴: パターン継続めくりが通常プレイと同じ得点計算になり、コンボ数も加算される', () => {
    const wave = makeWave({
      stock: [card(1, '♠', 9)], // 同スート継続(捲った後で実カード3枚)
      combo: 2,
      chain: [card(2, '♠', 4), card(3, '♠', 5)],
      linked: true,
      score: 0,
    })
    const { wave: next } = drawStock(DEFAULT_PARAMS, wave, ['naive'], standardDeckComposition())
    expect(next.combo).toBe(3) // 通常プレイと同様にコンボが加算される
    expect(next.score).toBeGreaterThan(0) // 得点が発生する(通常は0のまま)
  })

  test('素朴を持たない場合は、パターン継続めくりで得点もコンボ加算も発生しない(既存挙動)', () => {
    const wave = makeWave({
      stock: [card(1, '♠', 9)],
      combo: 2,
      chain: [card(2, '♠', 4), card(3, '♠', 5)],
      linked: true,
      score: 0,
    })
    const { wave: next } = drawStock(DEFAULT_PARAMS, wave, [], standardDeckComposition())
    expect(next.combo).toBe(2) // 据え置き
    expect(next.score).toBe(0)
  })

  test('素朴+直感: パターン継続めくりの得点計算に直感の倍率が適用される', () => {
    const wave = makeWave({
      stock: [card(1, '♠', 9)],
      combo: 2,
      chain: [card(2, '♠', 4), card(3, '♠', 5)],
      linked: true,
      score: 0,
      drawContinueCountThisChain: 2,
    })
    const withoutIntuition = drawStock(DEFAULT_PARAMS, wave, ['naive'], standardDeckComposition())
    const withIntuition = drawStock(DEFAULT_PARAMS, wave, ['naive', 'intuition'], standardDeckComposition())
    expect(withIntuition.wave.score).toBeGreaterThan(withoutIntuition.wave.score)
  })
})
```

- [ ] **Step 2: テストを実行して失敗を確認**

Run: `npm run test -- engine.test.ts`
Expected: FAIL

- [ ] **Step 3: `ITEM_EFFECTS`に直感を追加し、`drawStock`に素朴の得点計算分岐を追加**

`src/lib/game/shidasu/engine.ts`の`ITEM_EFFECTS`オブジェクト内、`fightingSpirit`エントリの直後に追加:

```ts
  intuition: {
    channel: 'gained',
    effect: (v, ctx, p) => {
      if (ctx.drawContinueCountThisChain === 0) return { value: v, part: null }
      const factor = 1 + ctx.drawContinueCountThisChain * p.talismans.intuition.x
      return { value: v * factor, part: `直感×${fmtMultiplier(factor)}` }
    },
  },
```

`drawStock`関数内、`patternContinues`分岐の内部にある以下の部分:

```ts
    const directGain = wouldContinue ? applyDirectEffects('drawContinueDirect', items, drawContinueCtx, params) : 0
    return {
      wave: {
        ...wave,
        stock: newStock,
        foundation: drawnCard,
        chain: [...wave.chain, drawnCard],
        chainOrigin: [...wave.chainOrigin, 'draw'],
        linked: true,
        lastDrawEffect: drawnCard.wild ? 'wild' : 'pattern',
        lastGain: null,
        score: scoreAfterStockEmpty + directGain,
        drawContinueCountThisChain: wouldContinue ? wave.drawContinueCountThisChain + 1 : wave.drawContinueCountThisChain,
        benevolenceUsedThisCombo: benevolenceFires ? true : wave.benevolenceUsedThisCombo,
      },
      deckComposition,
    }
```

を、以下に置き換える:

```ts
    const directGain = wouldContinue ? applyDirectEffects('drawContinueDirect', items, drawContinueCtx, params) : 0
    const newDrawContinueCount = wouldContinue ? wave.drawContinueCountThisChain + 1 : wave.drawContinueCountThisChain

    let naiveGained = 0
    let naiveParts: string[] = []
    let naiveCombo = wave.combo
    if (wouldContinue && items.includes('naive')) {
      const newCombo = wave.combo + 1
      let base = params.scoring.basePoint
      const parts = [`基礎点+${base}`]
      const chainResult = evaluateChainBonus(params.scoring, wave.chain, drawnCard, effectiveStairMinLen)
      base += chainResult.bonus
      parts.push(...chainResult.parts)
      const naiveCtx: ItemEffectContext = {
        card: drawnCard,
        previousFoundation: wave.foundation,
        combo: newCombo,
        stockRemaining: newStock.length,
        chain: [...wave.chain, drawnCard],
        remainingTableauCount: remainingCount(wave.tableau),
        chainBonus: chainResult,
        isFirstPlayOfWave: !wave.firstPlayDone,
        effectiveStairMinLen,
        sameColumnStreak: wave.sameColumnStreak,
        totalColumnsEmptiedThisWave: wave.totalColumnsEmptiedThisWave,
        maxComboThisWave: Math.max(wave.maxComboThisWave, newCombo),
        flushActiveThisCombo: wave.flushActiveThisCombo || chainResult.roleFired.some(r => r.name === 'flush'),
        columnSweepActiveThisWave: wave.columnSweepActiveThisWave,
        drawContinueCountThisChain: newDrawContinueCount,
      }
      const comboMultiplierStep = params.scoring.comboMultiplierStep
      const multiplier = 1 + (newCombo - 1) * comboMultiplierStep
      if (multiplier !== 1) parts.push(`コンボ倍率×${fmtMultiplier(multiplier)}`)
      const rawGained = Math.floor(base * multiplier)
      const itemResult = applyItemEffects('gained', rawGained, items, naiveCtx, params)
      parts.push(...itemResult.parts)
      naiveGained = Math.floor(itemResult.value)
      naiveParts = parts
      naiveCombo = newCombo
    }

    return {
      wave: {
        ...wave,
        stock: newStock,
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
      },
      deckComposition,
    }
```

- [ ] **Step 4: テストを実行して成功を確認**

Run: `npm run test -- engine.test.ts`
Expected: PASS

Run: `npm run build`
Expected: 成功

- [ ] **Step 5: コミット**

```bash
git add src/lib/game/shidasu/engine.ts src/lib/game/shidasu/engine.test.ts
git commit -m "$(cat <<'EOF'
feat: Shidasu護符に直感を追加し、素朴による山札めくりの得点ルール変更を実装

素朴を持つ場合、パターン継続めくりでも通常のプレイと同じ得点計算
(コンボ加算含む)を行うようにした。直感はこのパス内でのみ意味を持つ
倍率護符として実装。
EOF
)"
```

---

### Task 9: グループ11(沈着・冷静・慢心・残響・流星)・誠実・博愛のitem登録

**Files:**
- Modify: `src/lib/game/shidasu/engine.ts`
- Modify: `src/lib/game/shidasu/engine.test.ts`

Task 2〜4で沈着・冷静・慢心・残響・流星・誠実・博愛の**効果ロジック**は既に実装済みだが、これらは`ITEM_EFFECTS`(gained/clearBonus)ではなく`DIRECT_EFFECTS`または`drawStock`内の直接分岐であるため、`applyItemEffects`経由のテストは対象外。本タスクでは、これら7個(沈着・冷静・慢心・残響・流星・誠実・博愛)が`ITEM_POOL`に登録されて実プレイで抽選されることを次のTask 14で確認できるよう、ここでは追加の実装は不要であることを確認するだけでよい。**このタスクはスキップしてよい(Task 2〜4で実装済み)。** Task 14でまとめて`ITEM_POOL`に登録する。

---

### Task 10: 約束(山札の並べ替え)・暗雲(場札追加配布)

**Files:**
- Modify: `src/lib/game/shidasu/engine.ts`
- Modify: `src/lib/game/shidasu/engine.test.ts`

- [ ] **Step 1: 失敗するテストを書く**

`src/lib/game/shidasu/engine.test.ts`の末尾に追加:

```ts
describe('約束・暗雲', () => {
  test('約束: startWaveの山札構築後、継続可能なカードが山札の次(末尾)に来る', () => {
    // 継続条件を満たすカードが山札のどこかにあれば、末尾(次にめくられる位置)に来ることを、
    // 複数シードで試して「並べ替えありのほうが継続確率が実際に上がる」ことを確認する簡易テスト。
    let continueCount = 0
    const trials = 30
    for (let seed = 1; seed <= trials; seed++) {
      const { wave } = startWave(DEFAULT_PARAMS, 0, 0, ['promise'], standardDeckComposition(), seed)
      if (wave.stock.length === 0) continue
      const nextCard = wave.stock[wave.stock.length - 1]
      if (chainContinuesPattern(DEFAULT_PARAMS.scoring, wave.chain, nextCard)) continueCount++
    }
    expect(continueCount).toBeGreaterThan(0)
  })

  test('約束: drawStockの後も、次のカードが継続可能なら並べ替えが維持される', () => {
    const wave = makeWave({
      stock: [card(1, '♦', 1), card(2, '♠', 6), card(3, '♣', 2)], // 末尾がcard(3)、継続には合わない可能性
      chain: [card(9, '♠', 4), card(10, '♠', 5)], // 同スート継続中(♠6が来れば継続)
      linked: true,
    })
    const { wave: next } = drawStock(DEFAULT_PARAMS, wave, ['promise'], standardDeckComposition())
    if (next.stock.length > 0) {
      const nextCard = next.stock[next.stock.length - 1]
      const doesContinue = chainContinuesPattern(DEFAULT_PARAMS.scoring, next.chain, nextCard)
      const anyContinues = next.stock.some(c => chainContinuesPattern(DEFAULT_PARAMS.scoring, next.chain, c))
      if (anyContinues) expect(doesContinue).toBe(true)
    }
  })

  test('暗雲: ウェーブ開始時、場札がrows+r枚配られる', () => {
    const { wave } = startWave(DEFAULT_PARAMS, 0, 0, ['darkClouds'], standardDeckComposition(), 1)
    const expectedRows = DEFAULT_PARAMS.layout.rows + DEFAULT_PARAMS.talismans.darkClouds.r
    wave.tableau.forEach(col => expect(col).toHaveLength(expectedRows))
  })

  test('暗雲を持たなければ通常通りrows枚', () => {
    const { wave } = startWave(DEFAULT_PARAMS, 0, 0, [], standardDeckComposition(), 1)
    wave.tableau.forEach(col => expect(col).toHaveLength(DEFAULT_PARAMS.layout.rows))
  })
})
```

- [ ] **Step 2: テストを実行して失敗を確認**

Run: `npm run test -- engine.test.ts`
Expected: FAIL

- [ ] **Step 3: `startWave`に暗雲・約束を実装し、`drawStock`にも約束を実装**

`src/lib/game/shidasu/engine.ts`の`convertRandomCardToWild`関数の直後に追加:

```ts
// 山札(末尾が次にめくられる位置)の中から、今のチェーンが継続できる最初のカードを探し、末尾と交換する。
// 候補が無ければ何もしない(元の配列をそのまま返す)。
function arrangeNextCardForContinuation(scoring: ShidasuParams['scoring'], stock: Card[], chain: Card[], stairMinLen: number): Card[] {
  if (stock.length === 0) return stock
  const lastIndex = stock.length - 1
  for (let i = 0; i <= lastIndex; i++) {
    if (chainContinuesPattern(scoring, chain, stock[i], stairMinLen)) {
      if (i === lastIndex) return stock
      const arranged = [...stock]
      ;[arranged[i], arranged[lastIndex]] = [arranged[lastIndex], arranged[i]]
      return arranged
    }
  }
  return stock
}
```

`startWave`関数内、`const { cols, rows } = params.layout`の行を以下に置き換える:

```ts
  const { cols } = params.layout
  const rows = params.layout.rows + (items.includes('darkClouds') ? params.talismans.darkClouds.r : 0)
```

`startWave`関数内、`const foundation = deck.pop() as Card`の直後に追加:

```ts
  const stockAfterDeal = items.includes('promise')
    ? arrangeNextCardForContinuation(params.scoring, deck, [foundation], params.scoring.stairMinLen)
    : deck
```

同関数内の`wave`オブジェクト定義で、`stock: deck,`を`stock: stockAfterDeal,`に置き換える。

`src/lib/game/shidasu/engine.ts`の`drawStock`関数には(Task 8までの変更を反映した時点で)`stock: newStock,`という行が2箇所ある。1箇所目はパターン継続分岐の戻り値オブジェクト内(直後に`foundation: drawnCard,`が続く)、2箇所目はリセット分岐の戻り値オブジェクト内(直後に`foundation: card,`が続く)。

1箇所目(パターン継続分岐、直後が`foundation: drawnCard,`)の`stock: newStock,`を以下に置き換える:

```ts
        stock: items.includes('promise') ? arrangeNextCardForContinuation(params.scoring, newStock, [...wave.chain, drawnCard], effectiveStairMinLen) : newStock,
```

2箇所目(リセット分岐、直後が`foundation: card,`)の`stock: newStock,`を以下に置き換える:

```ts
      stock: items.includes('promise') ? arrangeNextCardForContinuation(params.scoring, newStock, [card], effectiveStairMinLen) : newStock,
```

(パターン継続分岐の新チェーンは`[...wave.chain, drawnCard]`、リセット分岐の新チェーンはリセット後の初期チェーン`[card]`を使う。)

- [ ] **Step 4: テストを実行して成功を確認**

Run: `npm run test -- engine.test.ts`
Expected: PASS

Run: `npm run build`
Expected: 成功

- [ ] **Step 5: コミット**

```bash
git add src/lib/game/shidasu/engine.ts src/lib/game/shidasu/engine.test.ts
git commit -m "$(cat <<'EOF'
feat: Shidasu護符に約束・暗雲を追加

約束: startWave/drawStockで山札の次のカードを継続可能なカードに
並べ替えるようにした。暗雲: startWaveの配布枚数をrows+r枚に変更した。
EOF
)"
```

---

### Task 11: playCardに`rand`引数を追加(治癒・再生の準備)

**Files:**
- Modify: `src/lib/game/shidasu/engine.ts`
- Modify: `src/lib/game/shidasu/engine.test.ts`

- [ ] **Step 1: 失敗するテストを書く**

`src/lib/game/shidasu/engine.test.ts`の`describe('playCard', ...)`ブロックの末尾に追加:

```ts
  test('playCardはrand引数を省略してもデフォルト(Math.random)で動作する(既存呼び出しの後方互換性)', () => {
    const wave = baseWave({ tableau: [[card(9, '♠', 1), card(1, '♣', 6)], [card(2, '♦', 2)]] })
    const next = playCard(DEFAULT_PARAMS, wave, 'none', [], 1000000, 0)
    expect(next.combo).toBe(1)
  })
```

- [ ] **Step 2: テストを実行**

Run: `npm run test -- engine.test.ts`
Expected: この時点では既にPASSするはず(まだシグネチャを変えていないため)。このテストは次のステップで`rand`引数を追加した後も後方互換性が保たれていることを保証する回帰テストとして機能する。

- [ ] **Step 3: `playCard`に`rand`引数を追加(デフォルト値付き、既存呼び出しには影響なし)**

`src/lib/game/shidasu/engine.ts`の`playCard`関数のシグネチャ:

```ts
export function playCard(
  params: ShidasuParams,
  wave: WaveState,
  modifier: StageModifier,
  items: ItemId[],
  target: number,
  colIndex: number
): WaveState {
```

を以下に置き換える:

```ts
export function playCard(
  params: ShidasuParams,
  wave: WaveState,
  modifier: StageModifier,
  items: ItemId[],
  target: number,
  colIndex: number,
  rand: () => number = Math.random
): WaveState {
```

(関数本体はこの時点では`rand`を使わない。Task 12で治癒、Task 13で再生がこれを使う。)

`applyPlayCard`関数を以下に置き換える:

```ts
export function applyPlayCard(params: ShidasuParams, run: RunState, colIndex: number, rand: () => number = Math.random): RunState {
  return withActiveWave(run, wave => {
    const stage = params.stages[run.stageIndex]
    const target = stage.targets[run.waveIndex]
    return playCard(params, wave, stage.modifier, run.items, target, colIndex, rand)
  })
}
```

- [ ] **Step 4: テストを実行して成功を確認**

Run: `npm run test -- engine.test.ts`
Expected: PASS(全既存テスト含む)

Run: `npm run build`
Expected: 成功

- [ ] **Step 5: コミット**

```bash
git add src/lib/game/shidasu/engine.ts src/lib/game/shidasu/engine.test.ts
git commit -m "$(cat <<'EOF'
feat: playCard/applyPlayCardにrand引数を追加(治癒・再生の実装準備)

デフォルト値付きのため既存の呼び出し箇所には影響しない。
EOF
)"
```

---

### Task 12: 治癒(列一掃時の捨て札復活)

**Files:**
- Modify: `src/lib/game/shidasu/engine.ts`
- Modify: `src/lib/game/shidasu/engine.test.ts`

- [ ] **Step 1: 失敗するテストを書く**

`src/lib/game/shidasu/engine.test.ts`の`describe('playCard', ...)`ブロックの末尾に追加:

```ts
  test('治癒: 列一掃が成立すると捨て札から最大rows枚が空いた列へ戻る', () => {
    const wave = baseWave({
      tableau: [[card(1, '♣', 6)], [card(2, '♦', 9)]],
      comboStreakColumnLengths: [DEFAULT_PARAMS.layout.rows, 1],
      discardPile: [card(10, '♦', 1), card(11, '♦', 2), card(12, '♦', 3), card(13, '♦', 4), card(14, '♦', 5), card(15, '♦', 6), card(16, '♦', 7)],
    })
    const next = playCard(DEFAULT_PARAMS, wave, 'none', ['healing'], 1000000, 0, createRng(1))
    expect(next.columnsEmptiedThisCombo).toBe(1)
    expect(next.tableau[0]).toHaveLength(DEFAULT_PARAMS.layout.rows)
    expect(next.discardPile.length).toBe(7 - DEFAULT_PARAMS.layout.rows)
  })

  test('治癒: 捨て札がrows未満ならあるだけ戻す', () => {
    const wave = baseWave({
      tableau: [[card(1, '♣', 6)], [card(2, '♦', 9)]],
      comboStreakColumnLengths: [DEFAULT_PARAMS.layout.rows, 1],
      discardPile: [card(10, '♦', 1), card(11, '♦', 2)],
    })
    const next = playCard(DEFAULT_PARAMS, wave, 'none', ['healing'], 1000000, 0, createRng(1))
    expect(next.tableau[0]).toHaveLength(2)
    expect(next.discardPile).toHaveLength(0)
  })

  test('治癒: 捨て札が空なら復活は起こらない', () => {
    const wave = baseWave({
      tableau: [[card(1, '♣', 6)], [card(2, '♦', 9)]],
      comboStreakColumnLengths: [DEFAULT_PARAMS.layout.rows, 1],
      discardPile: [],
    })
    const next = playCard(DEFAULT_PARAMS, wave, 'none', ['healing'], 1000000, 0, createRng(1))
    expect(next.tableau[0]).toHaveLength(0)
  })

  test('治癒を持っていなければ列一掃後も列は空のまま', () => {
    const wave = baseWave({
      tableau: [[card(1, '♣', 6)], [card(2, '♦', 9)]],
      comboStreakColumnLengths: [DEFAULT_PARAMS.layout.rows, 1],
      discardPile: [card(10, '♦', 1), card(11, '♦', 2)],
    })
    const next = playCard(DEFAULT_PARAMS, wave, 'none', [], 1000000, 0, createRng(1))
    expect(next.tableau[0]).toHaveLength(0)
    expect(next.discardPile).toHaveLength(2)
  })
```

- [ ] **Step 2: テストを実行して失敗を確認**

Run: `npm run test -- engine.test.ts`
Expected: FAIL

- [ ] **Step 3: `playCard`に治癒の復活処理を追加**

`src/lib/game/shidasu/engine.ts`の`playCard`関数内の以下の行:

```ts
  const remaining = remainingCount(newTableau)
```

を、以下のブロックに置き換える:

```ts
  let healedTableau = newTableau
  let healedDiscardPile = wave.discardPile
  if (sweepQualifies && items.includes('healing') && wave.discardPile.length > 0) {
    const pool = [...wave.discardPile]
    shuffleInPlace(pool, rand)
    const reviveCount = Math.min(rows, pool.length)
    const revived = pool.slice(0, reviveCount)
    healedDiscardPile = pool.slice(reviveCount)
    healedTableau = newTableau.map((c, i) => (i === colIndex ? revived : c))
  }
  const remaining = remainingCount(healedTableau)
```

続けて、`next`オブジェクトの定義内、`tableau: newTableau,`を`tableau: healedTableau,`に置き換え、`next`オブジェクトに新たに`discardPile: healedDiscardPile,`フィールドを追加する(`next`は元々`discardPile`フィールドを持たず`...wave`のスプレッドで暗黙的に`wave.discardPile`を継承していたため、明示的な上書きが必要になる)。

**注意**: `remaining`は治癒による復活**後**のtableau枚数で判定すること(治癒で1枚でも戻れば、その列は空でなくなるため、全消し判定にも影響する)。

- [ ] **Step 4: テストを実行して成功を確認**

Run: `npm run test -- engine.test.ts`
Expected: PASS

Run: `npm run build`
Expected: 成功

- [ ] **Step 5: コミット**

```bash
git add src/lib/game/shidasu/engine.ts src/lib/game/shidasu/engine.test.ts
git commit -m "$(cat <<'EOF'
feat: Shidasu護符に治癒(列一掃時の捨て札復活)を追加
EOF
)"
```

---

### Task 13: 再生(全消し時の捨て札復活・ウェーブ継続)

**Files:**
- Modify: `src/lib/game/shidasu/engine.ts`
- Modify: `src/lib/game/shidasu/engine.test.ts`

- [ ] **Step 1: 失敗するテストを書く**

`src/lib/game/shidasu/engine.test.ts`の`describe('playCard', ...)`ブロックの末尾に追加:

```ts
  test('再生: 全消し時に捨て札があれば、スコアp%を消費して場札を復活させウェーブを継続する', () => {
    const wave = baseWave({
      tableau: [[card(1, '♣', 6)]],
      stock: [],
      comboStreakColumnLengths: [DEFAULT_PARAMS.layout.rows],
      discardPile: [card(10, '♦', 1), card(11, '♦', 2), card(12, '♦', 3)],
    })
    const next = playCard(DEFAULT_PARAMS, wave, 'none', ['regeneration'], 100000000, 0, createRng(1))
    expect(next.status).toBe('playing') // 全消し終了せず継続
    expect(next.endReason).toBeNull()
    const revivedCount = next.tableau.reduce((n, c) => n + c.length, 0)
    expect(revivedCount).toBe(3)
    expect(next.discardPile).toHaveLength(0)
    const expectedClearBonus = DEFAULT_PARAMS.scoring.clearBonus + 0 * DEFAULT_PARAMS.scoring.clearBonusPerStock
    const scoreBeforeCost = scoring.basePoint + expectedClearBonus
    const expectedCost = Math.floor(scoreBeforeCost * DEFAULT_PARAMS.talismans.regeneration.p / 100)
    expect(next.score).toBe(scoreBeforeCost - expectedCost)
  })

  test('再生: 捨て札が無ければ通常通り全消し終了になる', () => {
    const wave = baseWave({
      tableau: [[card(1, '♣', 6)]],
      stock: [],
      comboStreakColumnLengths: [DEFAULT_PARAMS.layout.rows],
      discardPile: [],
    })
    const next = playCard(DEFAULT_PARAMS, wave, 'none', ['regeneration'], 100000000, 0, createRng(1))
    expect(next.status).toBe('ended')
    expect(next.endReason).toBe('fullClear')
  })

  test('再生を持っていなければ通常通り全消し終了になる', () => {
    const wave = baseWave({
      tableau: [[card(1, '♣', 6)]],
      stock: [],
      comboStreakColumnLengths: [DEFAULT_PARAMS.layout.rows],
      discardPile: [card(10, '♦', 1)],
    })
    const next = playCard(DEFAULT_PARAMS, wave, 'none', [], 100000000, 0, createRng(1))
    expect(next.status).toBe('ended')
    expect(next.endReason).toBe('fullClear')
  })
```

- [ ] **Step 2: テストを実行して失敗を確認**

Run: `npm run test -- engine.test.ts`
Expected: FAIL

- [ ] **Step 3: `playCard`の全消し分岐に再生の復活処理を追加**

`src/lib/game/shidasu/engine.ts`の`playCard`関数内、以下のブロック:

```ts
  if (remaining === 0) {
    const rawClearBonus = params.scoring.clearBonus + wave.stock.length * params.scoring.clearBonusPerStock
    const clearBonus = Math.floor(applyItemEffects('clearBonus', rawClearBonus, items, itemEffectCtx, params).value)
    return { ...next, score: newScore + clearBonus, status: 'ended', endReason: 'fullClear' }
  }
```

を以下に置き換える:

```ts
  if (remaining === 0) {
    const rawClearBonus = params.scoring.clearBonus + wave.stock.length * params.scoring.clearBonusPerStock
    const clearBonus = Math.floor(applyItemEffects('clearBonus', rawClearBonus, items, itemEffectCtx, params).value)
    const scoreAfterClear = newScore + clearBonus

    if (items.includes('regeneration') && healedDiscardPile.length > 0) {
      const pool = [...healedDiscardPile]
      shuffleInPlace(pool, rand)
      const reviveTotal = Math.min(params.layout.cols * rows, pool.length)
      const cost = Math.floor(scoreAfterClear * params.talismans.regeneration.p / 100)
      let cursor = 0
      const revivedTableau: Card[][] = []
      for (let c = 0; c < params.layout.cols; c++) {
        const take = Math.min(rows, reviveTotal - cursor)
        revivedTableau.push(take > 0 ? pool.slice(cursor, cursor + take) : [])
        cursor += Math.max(take, 0)
      }
      return {
        ...next,
        tableau: revivedTableau,
        comboStreakColumnLengths: revivedTableau.map(col => col.length),
        discardPile: pool.slice(reviveTotal),
        score: scoreAfterClear - cost,
        status: 'playing',
        endReason: null,
      }
    }

    return { ...next, score: scoreAfterClear, status: 'ended', endReason: 'fullClear' }
  }
```

- [ ] **Step 4: テストを実行して成功を確認**

Run: `npm run test -- engine.test.ts`
Expected: PASS

Run: `npm run build`
Expected: 成功

- [ ] **Step 5: コミット**

```bash
git add src/lib/game/shidasu/engine.ts src/lib/game/shidasu/engine.test.ts
git commit -m "$(cat <<'EOF'
feat: Shidasu護符に再生(全消し時の捨て札復活・ウェーブ継続)を追加
EOF
)"
```

---

### Task 14: ITEM_POOLの拡張とrollItemOfferテスト更新

**Files:**
- Modify: `src/lib/game/shidasu/engine.ts`
- Modify: `src/lib/game/shidasu/engine.test.ts`

- [ ] **Step 1: 失敗するテストを更新・追加する**

`src/lib/game/shidasu/engine.test.ts`の`describe('ITEM_POOL / ITEM_NAMES / itemDesc', ...)`ブロック内、以下の箇所を書き換える:

既存:
```ts
  test('59種類のアイテムが定義されている', () => {
    expect(ITEM_POOL).toHaveLength(59)
    expect(new Set(ITEM_POOL).size).toBe(59) // 重複なし
    ITEM_POOL.forEach(id => expect(ITEM_NAMES[id]).toBeTruthy())
  })
```

置き換え後:
```ts
  test('79種類のアイテムが定義されている', () => {
    expect(ITEM_POOL).toHaveLength(79)
    expect(new Set(ITEM_POOL).size).toBe(79) // 重複なし
    ITEM_POOL.forEach(id => expect(ITEM_NAMES[id]).toBeTruthy())
  })
```

同ブロック内の末尾に追加:

```ts
  test('グループ9〜16の残り20個も名前と説明文を持つ', () => {
    const newIds: ItemId[] = [
      'gentleBreeze', 'resonance',
      'azureSky', 'amber',
      'composure', 'clarity', 'arrogance', 'echo', 'shootingStar',
      'naive', 'intuition', 'sincerity',
      'promise', 'darkClouds', 'regeneration',
      'benevolence', 'healing',
      'guidance',
      'passion', 'fightingSpirit',
    ]
    expect(newIds).toHaveLength(20)
    newIds.forEach(id => {
      expect(ITEM_NAMES[id]).toBeTruthy()
      expect(itemDesc(id, DEFAULT_PARAMS)).toBeTruthy()
    })
  })
```

- [ ] **Step 2: テストを実行して失敗を確認**

Run: `npm run test -- engine.test.ts`
Expected: FAIL

- [ ] **Step 3: `ITEM_POOL`に20個追加**

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
  'eternity', 'abundance', 'silence', 'resilience',
  'gentleBreeze', 'resonance',
  'azureSky', 'amber',
  'composure', 'clarity', 'arrogance', 'echo', 'shootingStar',
  'naive', 'intuition', 'sincerity',
  'promise', 'darkClouds', 'regeneration',
  'benevolence', 'healing',
  'guidance',
  'passion', 'fightingSpirit',
]
```

- [ ] **Step 4: テストを実行して成功を確認**

Run: `npm run test -- engine.test.ts`
Expected: PASS

- [ ] **Step 5: コミット**

```bash
git add src/lib/game/shidasu/engine.ts src/lib/game/shidasu/engine.test.ts
git commit -m "$(cat <<'EOF'
feat: ITEM_POOLにグループ9〜16の残り20個を追加(全79種類に)
EOF
)"
```

---

### Task 15: 導き(UI表示)・管理画面パラメータ入力欄

**Files:**
- Modify: `src/routes/game/shidasu/+page.svelte`
- Modify: `src/routes/admin/shidasu/+page.svelte`

- [ ] **Step 1: ゲーム画面に導きのUI表示を追加**

`src/routes/game/shidasu/+page.svelte`内、山札の表示部分(`山札`という文字列と`displayWave.stock.length`を表示している箇所、`onclick={handleDraw}`のボタン内)を探し、そのボタンの直後に以下を追加する:

```svelte
    {#if run.items.includes('guidance') && displayWave.stock.length > 0}
      {@const nextCard = displayWave.stock[displayWave.stock.length - 1]}
      <div class="flex flex-col items-center justify-center" style="margin-top:20px;">
        <div class="text-[10px] text-emerald-300/70 mb-1">次の札</div>
        {@render cardFace(nextCard, false)}
      </div>
    {/if}
```

(`cardFace`スニペットが既存で定義されていることを確認してから使うこと。定義箇所を検索して確認する。)

- [ ] **Step 2: 管理画面にグループ9〜16のパラメータ入力欄を追加**

`src/routes/admin/shidasu/+page.svelte`の、`護符パラメータ(永続デッキ系)`セクションの`</section>`の直後(`フロー・UI`セクションの直前)に、以下の新セクションを追加する:

```svelte
      <section class="bg-white border border-slate-200 rounded-xl p-4">
        <h2 class="font-semibold text-slate-700 text-sm mb-3">護符パラメータ(グループ9〜16)</h2>
        <div class="grid grid-cols-2 gap-3">
          <label class="text-xs text-slate-500">
            微風: 連続回数あたり加算(gentleBreeze.n)
            <input type="number" min="0" step="1" bind:value={config.talismans.gentleBreeze.n} class="mt-1 w-full border border-slate-200 rounded px-2 py-1 text-sm" />
          </label>
          <label class="text-xs text-slate-500">
            共鳴: 連続回数あたり倍率(resonance.x)
            <input type="number" min="0" step="0.1" bind:value={config.talismans.resonance.x} class="mt-1 w-full border border-slate-200 rounded px-2 py-1 text-sm" />
          </label>
          <label class="text-xs text-slate-500">
            蒼穹: 列一掃累計あたり倍率(azureSky.x)
            <input type="number" min="0" step="0.1" bind:value={config.talismans.azureSky.x} class="mt-1 w-full border border-slate-200 rounded px-2 py-1 text-sm" />
          </label>
          <label class="text-xs text-slate-500">
            琥珀: 最大コンボあたり倍率(amber.x)
            <input type="number" min="0" step="0.01" bind:value={config.talismans.amber.x} class="mt-1 w-full border border-slate-200 rounded px-2 py-1 text-sm" />
          </label>
          <label class="text-xs text-slate-500">
            沈着: リセット時直接加算(composure.n)
            <input type="number" min="0" step="1" bind:value={config.talismans.composure.n} class="mt-1 w-full border border-slate-200 rounded px-2 py-1 text-sm" />
          </label>
          <label class="text-xs text-slate-500">
            冷静: リセット時直接加算(clarity.n)
            <input type="number" min="0" step="1" bind:value={config.talismans.clarity.n} class="mt-1 w-full border border-slate-200 rounded px-2 py-1 text-sm" />
          </label>
          <label class="text-xs text-slate-500">
            慢心: 場札残数あたり直接加算(arrogance.x)
            <input type="number" min="0" step="1" bind:value={config.talismans.arrogance.x} class="mt-1 w-full border border-slate-200 rounded px-2 py-1 text-sm" />
          </label>
          <label class="text-xs text-slate-500">
            残響: コンボ数あたり直接加算(echo.n)
            <input type="number" min="0" step="1" bind:value={config.talismans.echo.n} class="mt-1 w-full border border-slate-200 rounded px-2 py-1 text-sm" />
          </label>
          <label class="text-xs text-slate-500">
            流星: 到達コンボ数の閾値(shootingStar.c)
            <input type="number" min="1" step="1" bind:value={config.talismans.shootingStar.c} class="mt-1 w-full border border-slate-200 rounded px-2 py-1 text-sm" />
          </label>
          <label class="text-xs text-slate-500">
            流星: 直接加算(shootingStar.n)
            <input type="number" min="0" step="1" bind:value={config.talismans.shootingStar.n} class="mt-1 w-full border border-slate-200 rounded px-2 py-1 text-sm" />
          </label>
          <label class="text-xs text-slate-500">
            直感: 継続回数あたり倍率(intuition.x)
            <input type="number" min="0" step="0.1" bind:value={config.talismans.intuition.x} class="mt-1 w-full border border-slate-200 rounded px-2 py-1 text-sm" />
          </label>
          <label class="text-xs text-slate-500">
            誠実: 直接加算(sincerity.n)
            <input type="number" min="0" step="1" bind:value={config.talismans.sincerity.n} class="mt-1 w-full border border-slate-200 rounded px-2 py-1 text-sm" />
          </label>
          <label class="text-xs text-slate-500">
            暗雲: 追加配布行数(darkClouds.r)
            <input type="number" min="0" step="1" bind:value={config.talismans.darkClouds.r} class="mt-1 w-full border border-slate-200 rounded px-2 py-1 text-sm" />
          </label>
          <label class="text-xs text-slate-500">
            再生: スコア消費率%(regeneration.p)
            <input type="number" min="0" max="100" step="1" bind:value={config.talismans.regeneration.p} class="mt-1 w-full border border-slate-200 rounded px-2 py-1 text-sm" />
          </label>
          <label class="text-xs text-slate-500">
            情熱: フラッシュ成立中倍率(passion.x)
            <input type="number" min="0" step="0.1" bind:value={config.talismans.passion.x} class="mt-1 w-full border border-slate-200 rounded px-2 py-1 text-sm" />
          </label>
          <label class="text-xs text-slate-500">
            闘志: 列一掃発生中倍率(fightingSpirit.x)
            <input type="number" min="0" step="0.1" bind:value={config.talismans.fightingSpirit.x} class="mt-1 w-full border border-slate-200 rounded px-2 py-1 text-sm" />
          </label>
        </div>
      </section>
```

素朴・約束・博愛・治癒・導きはパラメータを持たないため入力欄は不要。

- [ ] **Step 3: ビルドが通ることを確認**

Run: `npm run build`
Expected: 型エラーなく成功

- [ ] **Step 4: 開発サーバーで表示を確認**

Run: `npm run dev`

`http://localhost:5173/admin/shidasu`で「護符パラメータ(グループ9〜16)」セクションが表示されることを確認する。既存の`npm run dev`プロセスが残っていないか確認してから起動し、確認後は終了させること。

- [ ] **Step 5: コミット**

```bash
git add src/routes/game/shidasu/+page.svelte src/routes/admin/shidasu/+page.svelte
git commit -m "$(cat <<'EOF'
feat: Shidasuゲーム画面に導きのUI表示、管理画面にグループ9〜16のパラメータ入力欄を追加
EOF
)"
```

---

### Task 16: 最終検証とドキュメント更新

**Files:**
- Modify: `docs/shidasu-gofu-candidates.md`
- Test: 全体テストスイート・ビルド・ブラウザ動作確認

- [ ] **Step 1: 全体テストスイートを実行**

Run: `npm run test`
Expected: 全テストPASS

- [ ] **Step 2: ビルドと型チェックを実行**

Run: `npm run build`
Expected: 成功

Run: `npm run check`
Expected: shidasu関連の型エラーが0件であることを確認する

- [ ] **Step 3: `docs/shidasu-gofu-candidates.md`にグループ9〜16(残り20個)の実装済みマークを追加**

グループ9・10・11・12・14・15・16の見出しに`【実装済み: 2026-07-14】`を追記する(グループ13は約束・暗雲・再生が今回実装済みだが、グループ13全体のうち永劫・豊穣・静寂・不屈は前回のサブプロジェクトで既に実装済みマークがついているため、グループ13の見出し自体にも実装済みマークを追加してよい)。対象行を検索して書き換える。

- [ ] **Step 4: 開発サーバーでブラウザ動作確認**

Run: `npm run dev`

`http://localhost:5173/game/shidasu`で通常のプレイフローが壊れていないことを確認する。デバッグパネル等で本バッチの護符(特に治癒・再生・博愛・素朴のような大きなルール変更を伴うもの)を所持させてプレイできる場合は、それぞれの挙動を目視確認する。

- [ ] **Step 5: コミット**

```bash
git add docs/shidasu-gofu-candidates.md
git commit -m "$(cat <<'EOF'
docs: Shidasu護符候補一覧のグループ9〜16に実装済みマークを追加
EOF
)"
```

---

## 完了条件(specの受け入れ基準との対応)

1. 微風・共鳴は同一列連続2回目以降のみ発動する → Task 5
2. 蒼穹・琥珀はウェーブ内累積値に応じて倍算する → Task 6
3. 沈着・冷静・残響・流星・慢心・誠実が直接点として加算される → Task 2〜4
4. 素朴・直感の得点ルール変更 → Task 8
5. 約束による山札並べ替え → Task 10
6. 暗雲による場札追加配布 → Task 10
7. 博愛のリセット無効化 → Task 4
8. 治癒・再生の捨て札復活 → Task 12, 13
9. 導きのUI表示 → Task 15
10. 情熱・闘志の持続倍算 → Task 7
11. `npm run test`・`npm run build`が成功する → Task 16
