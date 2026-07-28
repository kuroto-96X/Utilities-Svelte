# ステージ画面の新設 Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** ショップ画面の「次のWaveへ」を押した後に、そのステージの3Wave分(`stageStars`)を一覧表示し、Waveスキップ・リロール操作ができる「ステージ画面」を新設する。

**Architecture:** `engine.ts`に`skipWave`・`rerollStageStars`という2つの新しい純粋関数を追加する(既存の`buyIndividualItem`等と同じガード条件パターン)。`+page.svelte`に`showStageScreen`というローカルSvelte stateを追加し、ショップ画面の「次のWaveへ」ボタンの挙動を変更、ステージ画面という新しいオーバーレイUIブロックを追加する。

**Tech Stack:** SvelteKit / Svelte 5 runes / TypeScript / Vitest。既存パターンの流用のみで新規ライブラリなし。

---

## 前提知識(既存コードの構造)

- `src/lib/game/shidasu/engine.ts`: `rollStarForSlot(params, waveSlot, rand)`(非export、944行目付近)が既に存在し、指定した`waveSlot`(1|2|3)に属する`params.stars`候補群からランダムに1つ選び`Star`型に変換する関数。今回追加する`rerollStageStars`はこれをそのまま再利用できる。`finishShop`(1115行目付近、export済み)は変更しない。
- `src/lib/game/shidasu/params.ts`: `ShidasuParams.flow`インターフェース(233〜242行目付近)に`wavesPerStage`・`clearDelayMs`・`stageTargetBase`・`stageTargetMultiplier`・`stagesPerRun`が既にある。今回`rerollCost`を追加する。
- `src/lib/game/shidasu/shidasu.config.json`: `flow`エントリの実データ。`params.ts`と同様の追加が必要。
- `src/routes/game/shidasu/+page.svelte`: ショップ画面は497〜601行目付近の`{#if run.phase === 'shop' && run.shop && !pendingRevelationTarget}`ブロック。「次のWaveへ」ボタンは`handleFinishShop`(166行目付近)が呼ばれている箇所(`grep -n "次のWaveへ" src/routes/game/shidasu/+page.svelte`で位置を特定すること)。`upcomingBossInfo`(59〜72行目付近)に、`star.restriction`から説明文を作る`switch`ロジックが既にある。これを今回、共通関数として切り出しステージ画面のカードでも使う。
- 既存のガード条件パターン(`buyIndividualItem`等): `if (run.phase !== 'shop' || ...) return run`という形で、条件を満たさない場合は`run`をそのまま返す(何もしない)。

---

### Task 1: `params.ts`・JSONに`rerollCost`を追加

**Files:**
- Modify: `src/lib/game/shidasu/params.ts`
- Modify: `src/lib/game/shidasu/shidasu.config.json`

- [ ] **Step 1: `ShidasuParams.flow`に`rerollCost`を追加**

`params.ts`内、`flow`インターフェース定義(233〜242行目付近)の既存コード:

```ts
  flow: {
    wavesPerStage: number
    clearDelayMs: number
    // ステージ基準点。target(stageIndex, waveIndex) = flow.stageTargetBase × flow.stageTargetMultiplier^stageIndex
    // × stageStars[waveIndex].targetMultiplier で算出する。
    stageTargetBase: number
    stageTargetMultiplier: number
    // このステージ数をクリアするとラン全体のクリアとなり、続行確認(continueChoice)を挟む。
    stagesPerRun: number
  }
```

これを、以下のように変更する(既存フィールドは維持したまま追加):

```ts
  flow: {
    wavesPerStage: number
    clearDelayMs: number
    // ステージ基準点。target(stageIndex, waveIndex) = flow.stageTargetBase × flow.stageTargetMultiplier^stageIndex
    // × stageStars[waveIndex].targetMultiplier で算出する。
    stageTargetBase: number
    stageTargetMultiplier: number
    // このステージ数をクリアするとラン全体のクリアとなり、続行確認(continueChoice)を挟む。
    stagesPerRun: number
    // ステージ画面でWave3(waveSlot 3)の星をリロールする際に消費する固定コスト。
    rerollCost: number
  }
```

- [ ] **Step 2: `DEFAULT_PARAMS`と`shidasu.config.json`に実データを追加**

`params.ts`内の`DEFAULT_PARAMS`定数で、`flow: { wavesPerStage: 3, clearDelayMs: 450, stageTargetBase: 2000, stageTargetMultiplier: 1.8, stagesPerRun: 8 },`という行を見つけ(`grep -n "flow: {" src/lib/game/shidasu/params.ts`で確認)、以下のように変更する:

```ts
  flow: { wavesPerStage: 3, clearDelayMs: 450, stageTargetBase: 2000, stageTargetMultiplier: 1.8, stagesPerRun: 8, rerollCost: 30 },
```

`shidasu.config.json`内の`"flow": { "wavesPerStage": 3, "clearDelayMs": 450, "stageTargetBase": 2000, "stageTargetMultiplier": 1.8, "stagesPerRun": 8 },`という箇所(`grep -n '"flow"' src/lib/game/shidasu/shidasu.config.json`で確認)を、以下のように変更する:

```json
"flow": { "wavesPerStage": 3, "clearDelayMs": 450, "stageTargetBase": 2000, "stageTargetMultiplier": 1.8, "stagesPerRun": 8, "rerollCost": 30 },
```

(JSONの実際のフォーマット・インデントは既存のスタイルに合わせること。1行にまとまっていない場合は既存の複数行フォーマットを踏襲する)

- [ ] **Step 3: 型チェックを実行**

Run: `npm run check 2>&1 | grep -i "shidasu.config"`
Expected: エラーなし(`ShidasuParams.flow`と`shidasu.config.json`の`flow`が一致していることを確認)

- [ ] **Step 4: コミット**

```bash
git add src/lib/game/shidasu/params.ts src/lib/game/shidasu/shidasu.config.json
git commit -m "feat: paramsにリロールコスト(flow.rerollCost)を追加"
```

---

### Task 2: `engine.ts`に`skipWave`・`rerollStageStars`関数を実装

**Files:**
- Modify: `src/lib/game/shidasu/engine.ts`
- Test: `src/lib/game/shidasu/engine.test.ts`

- [ ] **Step 1: `skipWave`関数のテストを書く**

`engine.test.ts`内、既存の`describe('stageModifierFor / bossScoreLockFor', ...)`ブロックの直後(または末尾付近の適切な位置)に、新しい`describe`ブロックを追加する:

```ts
describe('skipWave', () => {
  test('waveIndexが0(waveSlot 1)のとき、waveIndexが1つ進む', () => {
    const run: RunState = { ...beginRun(DEFAULT_PARAMS, 1), phase: 'shop', waveIndex: 0 }
    const result = skipWave(run)
    expect(result.waveIndex).toBe(1)
    expect(result.phase).toBe('shop')
  })

  test('waveIndexが1(waveSlot 2)のとき、waveIndexが1つ進む', () => {
    const run: RunState = { ...beginRun(DEFAULT_PARAMS, 1), phase: 'shop', waveIndex: 1 }
    const result = skipWave(run)
    expect(result.waveIndex).toBe(2)
  })

  test('waveIndexが2(waveSlot 3)のとき、何も変化しない', () => {
    const run: RunState = { ...beginRun(DEFAULT_PARAMS, 1), phase: 'shop', waveIndex: 2 }
    const result = skipWave(run)
    expect(result.waveIndex).toBe(2)
    expect(result).toEqual(run)
  })

  test('phaseがshop以外のとき、何も変化しない', () => {
    const run: RunState = { ...beginRun(DEFAULT_PARAMS, 1), phase: 'playing', waveIndex: 0 }
    const result = skipWave(run)
    expect(result).toEqual(run)
  })

  test('waveのWaveStateには影響しない(生成・変更しない)', () => {
    const run: RunState = { ...beginRun(DEFAULT_PARAMS, 1), phase: 'shop', waveIndex: 0 }
    const result = skipWave(run)
    expect(result.wave).toBe(run.wave)
  })
})
```

- [ ] **Step 2: テストを実行し失敗を確認**

Run: `npx vitest run src/lib/game/shidasu/engine.test.ts -t skipWave`
Expected: FAIL(`skipWave`が未定義のため)

- [ ] **Step 3: `skipWave`関数を実装する**

`engine.ts`内、`finishShop`関数(1115行目付近)の直後に、以下の関数を追加する:

```ts
// ステージ画面のスキップボタンから呼ぶ。waveSlot 1・2(waveIndex 0・1)のときのみ、waveIndexを
// 1つ進める。WaveState(wave)は一切生成・変更せず、報酬も発生しない。waveSlot 3(waveIndex 2)や
// phaseがshop以外のときは何もせず、runをそのまま返す(UIでスキップボタン自体を出さないことと
// 合わせた二重の安全策)。
export function skipWave(run: RunState): RunState {
  if (run.phase !== 'shop') return run
  if (run.waveIndex >= 2) return run
  return { ...run, waveIndex: run.waveIndex + 1 }
}
```

- [ ] **Step 4: テストを実行し成功を確認**

Run: `npx vitest run src/lib/game/shidasu/engine.test.ts -t skipWave`
Expected: PASS(全5件)

- [ ] **Step 5: `rerollStageStars`関数のテストを書く**

同じ`engine.test.ts`ファイルに、以下の`describe`ブロックを追加する:

```ts
describe('rerollStageStars', () => {
  function shopRunAtWave3(currency: number): RunState {
    return { ...beginRun(DEFAULT_PARAMS, 1), phase: 'shop', waveIndex: 2, currency }
  }

  test('通貨がrerollCost以上のとき、通貨が減りstageStars[2]が再抽選される', () => {
    const run = shopRunAtWave3(100)
    const originalStar = run.stageStars[2]
    const result = rerollStageStars(DEFAULT_PARAMS, run, () => 0.9)
    expect(result.currency).toBe(100 - DEFAULT_PARAMS.flow.rerollCost)
    expect(result.stageStars[0]).toBe(run.stageStars[0])
    expect(result.stageStars[1]).toBe(run.stageStars[1])
    expect(result.stageStars[2]).not.toBe(originalStar)
  })

  test('通貨がrerollCost未満のとき、何も変化しない', () => {
    const run = shopRunAtWave3(DEFAULT_PARAMS.flow.rerollCost - 1)
    const result = rerollStageStars(DEFAULT_PARAMS, run, () => 0.9)
    expect(result).toEqual(run)
  })

  test('waveIndexが2(waveSlot 3)以外のとき、何も変化しない', () => {
    const run: RunState = { ...beginRun(DEFAULT_PARAMS, 1), phase: 'shop', waveIndex: 0, currency: 100 }
    const result = rerollStageStars(DEFAULT_PARAMS, run, () => 0.9)
    expect(result).toEqual(run)
  })

  test('phaseがshop以外のとき、何も変化しない', () => {
    const run: RunState = { ...beginRun(DEFAULT_PARAMS, 1), phase: 'playing', waveIndex: 2, currency: 100 }
    const result = rerollStageStars(DEFAULT_PARAMS, run, () => 0.9)
    expect(result).toEqual(run)
  })
})
```

- [ ] **Step 6: テストを実行し失敗を確認**

Run: `npx vitest run src/lib/game/shidasu/engine.test.ts -t rerollStageStars`
Expected: FAIL(`rerollStageStars`が未定義のため)

- [ ] **Step 7: `rerollStageStars`関数を実装する**

`engine.ts`内、`skipWave`関数の直後に、以下の関数を追加する:

```ts
// ステージ画面のリロールボタンから呼ぶ。waveSlot 3(waveIndex 2)かつ通貨がrerollCost以上のときのみ、
// 通貨からrerollCostを差し引きstageStars[2]をrollStarForSlotで再抽選する。それ以外の条件(waveSlot
// 1・2、通貨不足、phaseがshop以外)ではrunをそのまま返す。
export function rerollStageStars(params: ShidasuParams, run: RunState, rand: () => number = Math.random): RunState {
  if (run.phase !== 'shop') return run
  if (run.waveIndex !== 2) return run
  if (run.currency < params.flow.rerollCost) return run
  const newStar = rollStarForSlot(params, 3, rand)
  const stageStars = [...run.stageStars]
  stageStars[2] = newStar
  return { ...run, currency: run.currency - params.flow.rerollCost, stageStars }
}
```

- [ ] **Step 8: テストを実行し成功を確認**

Run: `npx vitest run src/lib/game/shidasu/engine.test.ts -t rerollStageStars`
Expected: PASS(全4件)

- [ ] **Step 9: 全体のビルド・型チェック・テストを確認**

Run: `npm run build`
Expected: 成功

Run: `npx vitest run src/lib/game/shidasu/engine.test.ts`
Expected: 全件PASS

- [ ] **Step 10: コミット**

```bash
git add src/lib/game/shidasu/engine.ts src/lib/game/shidasu/engine.test.ts
git commit -m "feat: engine.tsにskipWave・rerollStageStars関数を実装"
```

---

### Task 3: `+page.svelte`に星の制限説明文ヘルパーを切り出す

**Files:**
- Modify: `src/routes/game/shidasu/+page.svelte`

- [ ] **Step 1: `upcomingBossInfo`のswitchロジックを共通関数に切り出す**

`+page.svelte`内、`upcomingBossInfo`の`$derived.by`(59〜72行目付近)の既存コード:

```svelte
  // 現在Waveの星(制限ルール)の情報を返す。stageStarsが未確定(title等)の場合は空表示。
  // 表示の見直し(ステージ画面新設に伴うUI再設計)は別セッションで行う。
  let upcomingBossInfo = $derived.by(() => {
    const star = run.stageStars[run.waveIndex]
    if (!star || !star.restriction) return { label: '', detail: '' }
    switch (star.restriction.kind) {
      case 'suit': return { label: star.name, detail: `${star.restriction.suit}で無得点` }
      case 'noLoop': return { label: star.name, detail: 'A⇔Kループ禁止' }
      case 'faceLock': return { label: star.name, detail: '絵札はコンボ2以上でのみ取得可' }
      case 'lowCombo': return { label: star.name, detail: `${star.restriction.maxCombo}コンボ以下で無得点` }
      case 'oddCombo': return { label: star.name, detail: 'コンボが奇数のとき無得点' }
      case 'face': return { label: star.name, detail: '絵札(J・Q・K)で無得点' }
    }
  })
```

これを、以下のように変更する。まず`<script>`ブロックの先頭付近(import文の直後など、関数宣言をまとめて置ける位置)に、共通関数`starRestrictionDetail`を追加する:

```ts
  // 星のrestrictionから、プレイヤー向けの効果説明文(1行)を返す。制限なしの場合は空文字。
  function starRestrictionDetail(star: Star): string {
    if (!star.restriction) return ''
    switch (star.restriction.kind) {
      case 'suit': return `${star.restriction.suit}で無得点`
      case 'noLoop': return 'A⇔Kループ禁止'
      case 'faceLock': return '絵札はコンボ2以上でのみ取得可'
      case 'lowCombo': return `${star.restriction.maxCombo}コンボ以下で無得点`
      case 'oddCombo': return 'コンボが奇数のとき無得点'
      case 'face': return '絵札(J・Q・K)で無得点'
    }
  }
```

`Star`型のimportを、既存のtype importに追加する(`import type { RunState, ItemId, Suit, Rank, RiteId, RevelationId, RoleName, SpreadId, HeldRevelationOrOracleRef, ShopSlotKind, PlayCardResult } from '$lib/game/shidasu/types'`という行に`Star`を追加)。

次に、`upcomingBossInfo`を以下のように書き換える:

```svelte
  // 現在Waveの星(制限ルール)の情報を返す。stageStarsが未確定(title等)の場合は空表示。
  let upcomingBossInfo = $derived.by(() => {
    const star = run.stageStars[run.waveIndex]
    if (!star) return { label: '', detail: '' }
    return { label: star.name, detail: starRestrictionDetail(star) }
  })
```

- [ ] **Step 2: ビルド・型チェックを確認**

Run: `npm run build`
Expected: 成功

Run: `npm run check 2>&1 | grep -i "shidasu"`
Expected: `+page.svelte`に新規エラーなし

- [ ] **Step 3: コミット**

```bash
git add src/routes/game/shidasu/+page.svelte
git commit -m "refactor: 星の制限説明文ロジックをstarRestrictionDetail関数に切り出し"
```

---

### Task 4: `+page.svelte`にステージ画面表示制御とショップ画面の接続変更を実装

**Files:**
- Modify: `src/routes/game/shidasu/+page.svelte`

- [ ] **Step 1: `showStageScreen` stateを追加**

`+page.svelte`内、他の`$state`宣言がまとまっている箇所(`let config`等の付近、ファイル先頭の`<script>`ブロック内)に、以下を追加する:

```ts
  // ショップ画面の「次のWaveへ」を押した後、ステージ画面を表示するかどうかのフラグ。
  // run.phaseとは独立したUI制御用のローカルstate。
  let showStageScreen = $state(false)
```

- [ ] **Step 2: `run.phase`が`'shop'`になった瞬間に`showStageScreen`をリセットする`$effect`を追加**

`showStageScreen`宣言の直後に、以下を追加する:

```ts
  let previousPhaseForStageScreen = run.phase
  $effect(() => {
    if (run.phase === 'shop' && previousPhaseForStageScreen !== 'shop') {
      showStageScreen = false
    }
    previousPhaseForStageScreen = run.phase
  })
```

設計意図: Waveクリアの度に`run.phase`が新たに`'shop'`になる(既存の`enterShop`ロジック)。このタイミングで`showStageScreen`を`false`に戻すことで、次のショップ滞在時は必ずショップ画面から始まるようにする(前回セッションの得点内訳表示等で確立した`previousXxx`パターンを踏襲)。

- [ ] **Step 3: ショップ画面の表示条件に`!showStageScreen`を追加**

`+page.svelte`内、ショップ画面の`{#if}`(`grep -n "run.phase === 'shop' && run.shop" src/routes/game/shidasu/+page.svelte`で確認、497行目付近)の既存コード:

```svelte
{#if run.phase === 'shop' && run.shop && !pendingRevelationTarget}
```

これを以下に変更する:

```svelte
{#if run.phase === 'shop' && run.shop && !pendingRevelationTarget && !showStageScreen}
```

- [ ] **Step 4: 「次のWaveへ」ボタンの`onclick`を`showStageScreen = true`に変更する**

`+page.svelte`内、ショップ画面の「次のWaveへ」ボタン(`handleFinishShop`を呼んでいる箇所、`grep -n "handleFinishShop" src/routes/game/shidasu/+page.svelte`で確認)を探す。ボタンのテキストは「次のWaveへ」に類する文言のはず。

このボタンの`onclick`ハンドラを、`handleFinishShop`の呼び出しから、以下のように変更する:

```svelte
<button onclick={() => { showStageScreen = true }} class="...(既存のクラスをそのまま維持)...">
  次のWaveへ
</button>
```

`handleFinishShop`関数自体(166行目付近)は削除せず残す(Task 5でステージ画面の「Wave{N}へ進む」ボタンから呼ぶため)。

- [ ] **Step 5: ビルド・型チェックを確認**

Run: `npm run build`
Expected: 成功

- [ ] **Step 6: コミット**

```bash
git add src/routes/game/shidasu/+page.svelte
git commit -m "feat: ショップ画面の次のWaveへボタンをステージ画面表示トリガーに変更"
```

---

### Task 5: ステージ画面のUIを実装

**Files:**
- Modify: `src/routes/game/shidasu/+page.svelte`

- [ ] **Step 1: ステージ画面用のハンドラ関数を追加**

`+page.svelte`内、`handleFinishShop`関数(166行目付近)の直後に、以下の3つの関数を追加する:

```ts
  function handleSkipWave() {
    run = skipWave(run)
  }

  function handleRerollStageStars() {
    run = rerollStageStars(params, run)
  }

  function handleProceedToWave() {
    run = finishShop(params, run)
    showStageScreen = false
  }
```

`skipWave`・`rerollStageStars`のimportを、既存のimport文(`from '$lib/game/shidasu/engine'`の箇所)に追加する。

- [ ] **Step 2: ステージ画面のオーバーレイUIを追加**

`+page.svelte`内、ショップ画面の`{#if}`ブロックの終わり(`{/if}`、598〜601行目付近、ショップ画面ブロックの直後)の直後に、以下のブロックを追加する:

```svelte
{#if run.phase === 'shop' && run.shop && !pendingRevelationTarget && showStageScreen}
  {@const baseTarget = Math.floor(params.flow.stageTargetBase * params.flow.stageTargetMultiplier ** run.stageIndex)}
  <div class="fixed inset-0 z-50 bg-emerald-950/90 backdrop-blur-sm flex items-center justify-center p-6">
    <div class="bg-white rounded-2xl p-6 max-w-lg w-full max-h-[90vh] overflow-y-auto space-y-3">
      <div class="flex items-center justify-between">
        <h2 class="text-lg font-bold text-slate-800">ステージ {run.stageIndex + 1}</h2>
        <p class="text-sm text-teal-700 font-semibold">{params.currency.symbol}{run.currency}</p>
      </div>
      <p class="text-xs text-slate-400">ベース目標点数 {baseTarget}</p>

      <div class="space-y-2">
        {#each run.stageStars as star, i (star.id)}
          {@const isCleared = i < run.waveIndex}
          {@const isNext = i === run.waveIndex}
          {@const isFuture = i > run.waveIndex}
          {@const waveTargetValue = waveTarget(params, run.stageIndex, i, run.stageStars)}
          <div
            class="border-2 rounded-xl p-3 {isNext ? 'border-teal-500 bg-teal-50' : 'border-slate-200 bg-white'} {isCleared ? 'opacity-60' : ''}"
          >
            <div class="flex items-center justify-between">
              <div>
                <div class="text-[11px] {isNext ? 'text-teal-700 font-bold' : 'text-slate-400'}">
                  WAVE {i + 1}{#if isCleared}・クリア済み{:else if isNext && i === 2}・必須{:else if isNext}・NEXT{/if}
                </div>
                <div class="font-bold text-slate-800">{star.name}</div>
                <div class="text-[11px] text-slate-500 mt-0.5">{starRestrictionDetail(star) || '制限なし'}</div>
              </div>
              <div class="text-right text-[11px] text-slate-600">
                目標 {waveTargetValue}<br />報酬 +{star.reward}
              </div>
            </div>
            {#if isNext && i !== 2}
              <div class="flex gap-2 mt-2">
                <button onclick={handleSkipWave} class="flex-1 px-2 py-1 rounded bg-slate-100 text-slate-700 text-xs">スキップ</button>
              </div>
            {:else if isNext && i === 2}
              <div class="flex gap-2 mt-2">
                <button
                  onclick={handleRerollStageStars}
                  disabled={run.currency < params.flow.rerollCost}
                  class="flex-1 px-2 py-1 rounded bg-slate-100 text-slate-700 text-xs disabled:opacity-40 disabled:cursor-not-allowed"
                >
                  リロール({params.flow.rerollCost})
                </button>
              </div>
            {/if}
          </div>
        {/each}
      </div>

      <button onclick={handleProceedToWave} class="w-full px-4 py-2 rounded-lg bg-teal-600 text-white font-semibold">
        Wave{run.waveIndex + 1}へ進む
      </button>
    </div>
  </div>
{/if}
```

- [ ] **Step 3: ビルド・型チェックを確認**

Run: `npm run build`
Expected: 成功

Run: `npm run check 2>&1 | grep -i "shidasu"`
Expected: `+page.svelte`に新規エラーなし

- [ ] **Step 4: コミット**

```bash
git add src/routes/game/shidasu/+page.svelte
git commit -m "feat: ステージ画面のUI(Wave一覧・スキップ・リロール)を実装"
```

---

### Task 6: 動作確認

**Files:** なし(確認のみ)

- [ ] **Step 1: ビルド・型チェック・自動テストを実行**

Run: `npm run build`
Expected: 成功

Run: `npm run check 2>&1 | grep -i "shidasu"`
Expected: エラー0件(既存の警告は許容)

Run: `npx vitest run src/lib/game/shidasu`
Expected: 全件PASS

- [ ] **Step 2: ブラウザで実地確認**

Run: `npm run dev`

`http://localhost:5173/game/shidasu` を開き、以下を確認する:

1. ゲームを開始し、Wave1をクリアしてショップ画面に入る
2. ショップ画面で「次のWaveへ」を押すと、ステージ画面が表示されるか確認する(ショップ画面は消えること)
3. ステージ画面で、Wave1が「クリア済み」、Wave2が「NEXT」、Wave3が通常表示になっているか確認する
4. ヘッダーに「ステージ{N}」「所持通貨」「ベース目標点数」が表示されているか確認する
5. Wave2の行にスキップボタンがあることを確認し、押してみる。Wave2が「クリア済み」相当の表示になり、Wave3が「NEXT・必須」になるか確認する(報酬が加算されていないことも確認)
6. Wave3の行にリロールボタンがあることを確認し、押してみる。星の内容(名前・制限ルール)が変わるか、所持通貨が減るか確認する
7. 通貨がリロールコスト未満のとき、リロールボタンがdisabledになるか確認する(デバッグパネル等で通貨を調整できる場合)
8. 「Wave{N}へ進む」ボタンを押すと、実際にそのWaveが開始され通常のプレイ画面に遷移するか確認する
9. 次のステージ(3Wave消化後)に入ったとき、`stageStars`が新しく抽選され、ステージ画面がまた最初(Wave1がNEXT)から表示されるか確認する
10. 既存の配布アニメーション・片付けアニメーション・チェーンリセットアニメーションが引き続き正常に動作するか確認する(このタスクでの変更が影響していないか)

ビルドエラー・型エラー・画面の崩れがあれば、完了報告前に修正する。
