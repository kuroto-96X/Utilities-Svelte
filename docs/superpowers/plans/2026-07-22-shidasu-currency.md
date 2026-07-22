# Shidasuゲーム内通貨基盤 Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** 星詠みソリティア -Shidasu- にラン単位のゲーム内通貨「星片(☆)」を追加し、初期所持数・Waveクリア獲得数・ボスボーナスを管理画面から編集できるようにする。通貨の消費(ショップ)は対象外。

**Architecture:** 既存の`ShidasuParams`設定駆動パターンに`currency`ブロックを追加し、`RunState.currency`というラン単位の状態として保持する。付与ロジックは`resolveWaveEnd`(Wave成功/失敗判定を行う唯一の箇所)に集約する。管理画面は既存の`/admin/shidasu-bosses`と同じboilerplateに倣った新規ページとして追加する。

**Tech Stack:** SvelteKit(Svelte 5 runes)、TypeScript、Vitest

---

## File Structure

- Modify: `src/lib/game/shidasu/params.ts` — `ShidasuParams`インターフェースと`DEFAULT_PARAMS`に`currency`ブロックを追加
- Modify: `src/lib/game/shidasu/shidasu.config.json` — 同じ`currency`ブロックを追加(ライブ設定)
- Modify: `src/lib/game/shidasu/types.ts` — `RunState`に`currency: number`フィールドを追加
- Modify: `src/lib/game/shidasu/engine.ts` — `resolveWaveEnd`に付与ロジックを追加、`beginRun`/`createInitialRun`を初期化
- Create: `src/routes/admin/shidasu-currency/+page.svelte` — 通貨パラメータ編集用の新規管理画面
- Modify: `src/routes/admin/+page.svelte` — 管理ページ一覧に新規ページへのリンクカードを追加
- Modify: `src/routes/game/shidasu/+page.svelte` — 常時表示HUD(`stageRow`スニペット)に`☆{run.currency}`を追加
- Modify: `src/lib/game/shidasu/engine.test.ts` — `resolveWaveEnd`/`beginRun`/`continueAfterGreatMisfortune`の通貨関連テストを追加

---

### Task 1: `params.ts`に`currency`設定を追加する

**Files:**
- Modify: `src/lib/game/shidasu/params.ts:52-54`(インターフェース)、`:241-243`(DEFAULT_PARAMS)

- [ ] **Step 1: `ShidasuParams`インターフェースに`currency`ブロックを追加**

`src/lib/game/shidasu/params.ts`の52行目、`items: { maxItems: number }`ブロックの直後に以下を挿入する(既存の52-54行目はそのまま残す):

```ts
  items: {
    maxItems: number
  }
  currency: {
    name: string
    symbol: string
    initialAmount: number
    waveClearAmount: number
    bossBonus: {
      shoukyou: number
      chuukyou: number
      taikyou: number
    }
  }
```

- [ ] **Step 2: `DEFAULT_PARAMS`に対応するデフォルト値を追加**

`src/lib/game/shidasu/params.ts`の241-243行目、`items: { maxItems: 5 }`ブロックの直後に以下を挿入する(既存の241-243行目はそのまま残す):

```ts
  items: {
    maxItems: 5,
  },
  currency: {
    name: '星片',
    symbol: '☆',
    initialAmount: 5,
    waveClearAmount: 5,
    bossBonus: { shoukyou: 5, chuukyou: 10, taikyou: 15 },
  },
```

- [ ] **Step 3: 型チェックを実行して確認**

Run: `npm run check`
Expected: `shidasu.config.json`に`currency`が無いためエラーが出る(`Property 'currency' is missing in type ... but required in type 'ShidasuParams'`のような内容)。これはTask 2で解消する想定通りのエラーなので、ここでは失敗を確認するだけでよい。

- [ ] **Step 4: コミット**

```bash
git add src/lib/game/shidasu/params.ts
git commit -m "feat: Shidasu通貨パラメータをShidasuParamsに追加"
```

---

### Task 2: `shidasu.config.json`に`currency`を追加する

**Files:**
- Modify: `src/lib/game/shidasu/shidasu.config.json:40-42`

- [ ] **Step 1: `items`ブロックの直後に`currency`を追加**

`src/lib/game/shidasu/shidasu.config.json`の40-42行目、`"items": { "maxItems": 5 }`ブロックの直後に以下を挿入する(既存の40-42行目はそのまま残し、42行目末尾のカンマもそのまま):

```json
  "items": {
    "maxItems": 5
  },
  "currency": {
    "name": "星片",
    "symbol": "☆",
    "initialAmount": 5,
    "waveClearAmount": 5,
    "bossBonus": { "shoukyou": 5, "chuukyou": 10, "taikyou": 15 }
  },
```

- [ ] **Step 2: 型チェックを実行して確認**

Run: `npm run check`
Expected: PASS(`ShidasuParams`関連のエラーが解消される)

- [ ] **Step 3: コミット**

```bash
git add src/lib/game/shidasu/shidasu.config.json
git commit -m "feat: Shidasu通貨パラメータのライブ設定を追加"
```

---

### Task 3: `RunState`に`currency`フィールドを追加する

**Files:**
- Modify: `src/lib/game/shidasu/types.ts:224`

- [ ] **Step 1: `RunState`インターフェースに`currency`を追加**

`src/lib/game/shidasu/types.ts`の223-224行目を以下のように変更する:

変更前:
```ts
  currentBossKind: BossKind | null
}
```

変更後:
```ts
  currentBossKind: BossKind | null
  // ラン単位で保持する通貨(星片)の所持数。continueChoiceを挟んでもリセットされず、
  // beginRun(新しいラン開始)のときのみ初期値に戻る
  currency: number
}
```

- [ ] **Step 2: 型チェックを実行して確認**

Run: `npm run check`
Expected: FAIL(`createInitialRun`/`beginRun`が`RunState`を返す箇所で`currency`が無いというエラー)。Task 4で解消される想定通りの失敗。

- [ ] **Step 3: コミット**

```bash
git add src/lib/game/shidasu/types.ts
git commit -m "feat: RunStateに通貨フィールドを追加"
```

---

### Task 4: `engine.ts`に通貨の初期化・付与ロジックを実装する

**Files:**
- Modify: `src/lib/game/shidasu/engine.ts`(`createInitialRun`、`beginRun`、`resolveWaveEnd`)

- [ ] **Step 1: `createInitialRun`に`currency: 0`を追加**

`src/lib/game/shidasu/engine.ts`内の`createInitialRun`関数を以下のように変更する:

変更前:
```ts
export function createInitialRun(): RunState {
  return {
    phase: 'title', stageIndex: 0, waveIndex: 0, items: [], offer: [], wave: null, pendingNewItem: null,
    deckComposition: standardDeckComposition(), rites: [], revelations: [], revelationOffer: [], extraTableauRows: 0,
    oracleLevels: defaultOracleLevels(), oracleOffer: [], currentGreatMisfortuneSuit: null, spreadId: 'fool',
    currentBossKind: null,
  }
}
```

変更後:
```ts
export function createInitialRun(): RunState {
  return {
    phase: 'title', stageIndex: 0, waveIndex: 0, items: [], offer: [], wave: null, pendingNewItem: null,
    deckComposition: standardDeckComposition(), rites: [], revelations: [], revelationOffer: [], extraTableauRows: 0,
    oracleLevels: defaultOracleLevels(), oracleOffer: [], currentGreatMisfortuneSuit: null, spreadId: 'fool',
    currentBossKind: null, currency: 0,
  }
}
```

- [ ] **Step 2: `beginRun`に`currency: params.currency.initialAmount`を追加**

`src/lib/game/shidasu/engine.ts`内の`beginRun`関数のreturn文を以下のように変更する:

変更前:
```ts
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
      extraTableauRows: initialExtraTableauRows,
      oracleLevels: defaultOracleLevels(),
      oracleOffer: [],
      currentGreatMisfortuneSuit: null,
      spreadId,
      currentBossKind: initialBossKind,
    }
```

変更後:
```ts
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
      extraTableauRows: initialExtraTableauRows,
      oracleLevels: defaultOracleLevels(),
      oracleOffer: [],
      currentGreatMisfortuneSuit: null,
      spreadId,
      currentBossKind: initialBossKind,
      currency: params.currency.initialAmount,
    }
```

- [ ] **Step 3: 型チェックを実行して確認**

Run: `npm run check`
Expected: PASS(`RunState`の必須フィールド不足エラーが解消される)

- [ ] **Step 4: `resolveWaveEnd`に付与ロジックを追加**

`src/lib/game/shidasu/engine.ts`内の`resolveWaveEnd`関数を以下のように変更する:

変更前:
```ts
export function resolveWaveEnd(params: ShidasuParams, run: RunState, rand: () => number = Math.random): RunState {
  const wave = run.wave
  if (!wave || wave.status !== 'ended') return run

  const target = waveTarget(params, run.stageIndex, run.waveIndex, run.spreadId)
  if (wave.score < target) {
    return { ...run, phase: 'gameOver' }
  }

  // 大凶(各サイクルの最終ウェーブ)クリア時のみ、護符等の選択を後回しにして続行確認を挟む。
  // それ以外(小凶・中凶のボスウェーブを含む通常のウェーブクリア)は、すべて同じitemSelectへ進む。
  if (isBossWave(params, run.waveIndex) && bossTierOf(run.stageIndex) === 2) {
    return { ...run, phase: 'continueChoice' }
  }
  return { ...run, phase: 'itemSelect', offer: rollItemOffer(run.items, rand), pendingNewItem: null }
}
```

変更後:
```ts
export function resolveWaveEnd(params: ShidasuParams, run: RunState, rand: () => number = Math.random): RunState {
  const wave = run.wave
  if (!wave || wave.status !== 'ended') return run

  const target = waveTarget(params, run.stageIndex, run.waveIndex, run.spreadId)
  if (wave.score < target) {
    return { ...run, phase: 'gameOver' }
  }

  const earned = params.currency.waveClearAmount
    + (isBossWave(params, run.waveIndex) ? params.currency.bossBonus[BOSS_TIER_KEYS[bossTierOf(run.stageIndex)]] : 0)
  const runWithCurrency = { ...run, currency: run.currency + earned }

  // 大凶(各サイクルの最終ウェーブ)クリア時のみ、護符等の選択を後回しにして続行確認を挟む。
  // それ以外(小凶・中凶のボスウェーブを含む通常のウェーブクリア)は、すべて同じitemSelectへ進む。
  if (isBossWave(params, run.waveIndex) && bossTierOf(run.stageIndex) === 2) {
    return { ...runWithCurrency, phase: 'continueChoice' }
  }
  return { ...runWithCurrency, phase: 'itemSelect', offer: rollItemOffer(run.items, rand), pendingNewItem: null }
}
```

- [ ] **Step 5: 型チェックを実行して確認**

Run: `npm run check`
Expected: PASS

- [ ] **Step 6: コミット**

```bash
git add src/lib/game/shidasu/engine.ts
git commit -m "feat: Wave成功時に通貨を付与するロジックを実装"
```

---

### Task 5: 通貨の付与・保持に関するテストを追加する

**Files:**
- Modify: `src/lib/game/shidasu/engine.test.ts:2097-2145`(`describe('resolveWaveEnd', ...)`ブロック内)、`:2252-2268`(`continueAfterGreatMisfortune`のテスト直後)

- [ ] **Step 1: `resolveWaveEnd`のdescribeブロックに通貨関連のテストを追加**

`src/lib/game/shidasu/engine.test.ts`の2144行目(`大凶クリアもcontinueChoiceになる`テストの閉じ`})`)と2145行目(`describe`ブロックの閉じ`})`)の間に、以下のテストを挿入する:

```ts

  test('beginRun直後、currencyは初期所持数になる', () => {
    const run = beginRun(DEFAULT_PARAMS, 1)
    expect(run.currency).toBe(DEFAULT_PARAMS.currency.initialAmount)
  })

  test('目標未達(gameOver)ではcurrencyは増えない', () => {
    const run = endedRun({}, 0)
    const next = resolveWaveEnd(DEFAULT_PARAMS, run)
    expect(next.currency).toBe(run.currency)
  })

  test('通常Wave(ボスWave以外)クリアでcurrencyがwaveClearAmount分増える', () => {
    const run = endedRun({ waveIndex: 0 }, waveTarget(DEFAULT_PARAMS, 0, 0))
    const next = resolveWaveEnd(DEFAULT_PARAMS, run, createRng(5))
    expect(next.currency).toBe(run.currency + DEFAULT_PARAMS.currency.waveClearAmount)
  })

  test('小凶ボスWave(stageIndex0の3ウェーブ目)クリアでwaveClearAmount+shoukyouボーナス分増える', () => {
    const run = endedRun({ waveIndex: 2, stageIndex: 0 }, waveTarget(DEFAULT_PARAMS, 0, 2))
    const next = resolveWaveEnd(DEFAULT_PARAMS, run, createRng(5))
    expect(next.currency).toBe(run.currency + DEFAULT_PARAMS.currency.waveClearAmount + DEFAULT_PARAMS.currency.bossBonus.shoukyou)
  })

  test('中凶ボスWave(stageIndex1の3ウェーブ目)クリアでwaveClearAmount+chuukyouボーナス分増える', () => {
    const run = endedRun({ waveIndex: 2, stageIndex: 1 }, waveTarget(DEFAULT_PARAMS, 1, 2))
    const next = resolveWaveEnd(DEFAULT_PARAMS, run, createRng(5))
    expect(next.currency).toBe(run.currency + DEFAULT_PARAMS.currency.waveClearAmount + DEFAULT_PARAMS.currency.bossBonus.chuukyou)
  })

  test('大凶ボスWave(stageIndex2の3ウェーブ目)クリアでwaveClearAmount+taikyouボーナス分増える', () => {
    const run = endedRun({ waveIndex: 2, stageIndex: 2 }, waveTarget(DEFAULT_PARAMS, 2, 2))
    const next = resolveWaveEnd(DEFAULT_PARAMS, run)
    expect(next.currency).toBe(run.currency + DEFAULT_PARAMS.currency.waveClearAmount + DEFAULT_PARAMS.currency.bossBonus.taikyou)
  })
```

- [ ] **Step 2: テストを実行して失敗を確認**

Run: `npx vitest run src/lib/game/shidasu/engine.test.ts -t "currency"`
Expected: すでにTask 1〜4で実装済みのため、この時点ではPASSしているはず。もし`bossBonus`のキー(`shoukyou`/`chuukyou`/`taikyou`)の参照ミスなどで失敗する場合は、テストコードとengine.tsの実装を照合して修正する。

- [ ] **Step 3: `continueAfterGreatMisfortune`のテスト直後に、通貨が保持されることを確認するテストを追加**

`src/lib/game/shidasu/engine.test.ts`の2268行目(`continueAfterGreatMisfortuneでitemSelectへ進む。所持護符・秘儀・天啓・神託レベルは維持される`テストの閉じ`})`)の直後に、以下のテストを挿入する:

```ts

  test('continueAfterGreatMisfortuneを経てもcurrencyは保持される(リセットされない)', () => {
    const run: RunState = {
      ...beginRun(DEFAULT_PARAMS, 1),
      phase: 'continueChoice',
      stageIndex: 2,
      waveIndex: 2,
      currency: 999,
    }
    const next = continueAfterGreatMisfortune(DEFAULT_PARAMS, run, createRng(1))
    expect(next.currency).toBe(999)
  })
```

- [ ] **Step 4: テストスイート全体を実行して確認**

Run: `npx vitest run src/lib/game/shidasu/engine.test.ts`
Expected: PASS(全テストが通る)

- [ ] **Step 5: コミット**

```bash
git add src/lib/game/shidasu/engine.test.ts
git commit -m "test: Shidasu通貨の付与・保持ロジックのテストを追加"
```

---

### Task 6: 通貨設定の管理画面を新規作成する

**Files:**
- Create: `src/routes/admin/shidasu-currency/+page.svelte`

- [ ] **Step 1: 新規ページを作成**

`src/routes/admin/shidasu-currency/+page.svelte`を以下の内容で新規作成する(`/admin/shidasu-bosses`のboilerplateパターンに倣い、テーブルではなくシンプルなフォーム形式にする):

```svelte
<script lang="ts">
  import { onMount, onDestroy } from 'svelte'
  import { DEFAULT_PARAMS, type ShidasuParams } from '$lib/game/shidasu/params'

  let config = $state<ShidasuParams | null>(null)
  let error = $state<string | null>(null)
  let flash = $state<string | null>(null)
  let flashTimer: ReturnType<typeof setTimeout> | null = null

  function showToast(message: string) {
    if (flashTimer) clearTimeout(flashTimer)
    flash = message
    flashTimer = setTimeout(() => { flash = null }, 2000)
  }

  let hasValidationError = $derived.by(() => {
    if (!config) return false
    if (!config.currency.name.trim()) return true
    if (!config.currency.symbol.trim()) return true
    if (!Number.isFinite(config.currency.initialAmount) || config.currency.initialAmount < 0) return true
    if (!Number.isFinite(config.currency.waveClearAmount) || config.currency.waveClearAmount < 0) return true
    if (!Number.isFinite(config.currency.bossBonus.shoukyou) || config.currency.bossBonus.shoukyou < 0) return true
    if (!Number.isFinite(config.currency.bossBonus.chuukyou) || config.currency.bossBonus.chuukyou < 0) return true
    if (!Number.isFinite(config.currency.bossBonus.taikyou) || config.currency.bossBonus.taikyou < 0) return true
    return false
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
  <title>Shidasu 通貨設定</title>
</svelte:head>

<div class="max-w-lg mx-auto px-4 py-8">
  <a href="/admin" class="text-xs text-slate-400 hover:text-teal-600 mb-4 inline-block">← 管理ページ一覧</a>

  <div class="flex items-center justify-between mb-6">
    <h1 class="text-2xl font-bold text-slate-800">星詠みソリティア -Shidasu- 通貨設定</h1>
    <div class="flex gap-2">
      <button onclick={() => loadConfig(true)} class="text-sm px-3 py-1.5 rounded-lg border border-slate-200 text-slate-600 hover:bg-slate-50 transition-colors">
        リロード
      </button>
      {#if hasValidationError}
        <p class="text-xs text-red-600 self-center">名称・記号が空、または数値項目が未入力・0未満です</p>
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
    <section class="bg-white border border-slate-200 rounded-xl p-4 space-y-4">
      <div class="grid grid-cols-2 gap-3">
        <label class="text-xs text-slate-500">
          名称
          <input type="text" bind:value={config.currency.name} class="mt-1 w-full border border-slate-200 rounded px-2 py-1 text-sm" />
        </label>
        <label class="text-xs text-slate-500">
          記号
          <input type="text" bind:value={config.currency.symbol} class="mt-1 w-full border border-slate-200 rounded px-2 py-1 text-sm" />
        </label>
      </div>

      <label class="block text-xs text-slate-500">
        ラン開始時の初期所持数
        <input type="number" step="1" bind:value={config.currency.initialAmount} class="mt-1 w-full border border-slate-200 rounded px-2 py-1 text-sm" />
      </label>

      <label class="block text-xs text-slate-500">
        Waveクリア時の獲得数(ボスWaveも含め毎回付与される基礎分)
        <input type="number" step="1" bind:value={config.currency.waveClearAmount} class="mt-1 w-full border border-slate-200 rounded px-2 py-1 text-sm" />
      </label>

      <div class="grid grid-cols-3 gap-3">
        <label class="text-xs text-slate-500">
          小凶ボスボーナス
          <input type="number" step="1" bind:value={config.currency.bossBonus.shoukyou} class="mt-1 w-full border border-slate-200 rounded px-2 py-1 text-sm" />
        </label>
        <label class="text-xs text-slate-500">
          中凶ボスボーナス
          <input type="number" step="1" bind:value={config.currency.bossBonus.chuukyou} class="mt-1 w-full border border-slate-200 rounded px-2 py-1 text-sm" />
        </label>
        <label class="text-xs text-slate-500">
          大凶ボスボーナス
          <input type="number" step="1" bind:value={config.currency.bossBonus.taikyou} class="mt-1 w-full border border-slate-200 rounded px-2 py-1 text-sm" />
        </label>
      </div>

      <p class="text-xs text-slate-400">
        ボスボーナスはWaveクリア時の獲得数に加算されます(例: 小凶ボスWaveクリア時の獲得数 = Waveクリア時の獲得数 + 小凶ボスボーナス)。
      </p>
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

- [ ] **Step 2: 型チェックを実行して確認**

Run: `npm run check`
Expected: PASS

- [ ] **Step 3: コミット**

```bash
git add src/routes/admin/shidasu-currency/+page.svelte
git commit -m "feat: Shidasu通貨設定の管理画面を追加"
```

---

### Task 7: 管理ページ一覧にリンクカードを追加する

**Files:**
- Modify: `src/routes/admin/+page.svelte:65-71`

- [ ] **Step 1: `/admin/shidasu-bosses`カードの直後に新規カードを追加**

`src/routes/admin/+page.svelte`の65-71行目(`/admin/shidasu-bosses`のリンクカード)の直後、72行目(`</div>`で`divide-y`コンテナを閉じる行)の直前に、以下を挿入する:

```svelte
    <a href="/admin/shidasu-currency" class="flex items-center gap-3 px-4 py-4 hover:bg-slate-50 transition-colors group">
      <div class="flex-1">
        <p class="text-sm font-semibold text-slate-700 group-hover:text-teal-700">星詠みソリティア -Shidasu- 通貨設定</p>
        <p class="text-xs text-slate-400 mt-0.5">通貨(星片)の名称・記号、初期所持数、Waveクリア獲得数、ボス階級別ボーナスの編集</p>
      </div>
      <span class="text-slate-300 group-hover:text-teal-600 transition-colors">→</span>
    </a>
```

- [ ] **Step 2: 型チェックを実行して確認**

Run: `npm run check`
Expected: PASS

- [ ] **Step 3: コミット**

```bash
git add src/routes/admin/+page.svelte
git commit -m "feat: 管理ページ一覧に通貨設定へのリンクを追加"
```

---

### Task 8: プレイ中の常時表示HUDに通貨を表示する

**Files:**
- Modify: `src/routes/game/shidasu/+page.svelte:220-234`

- [ ] **Step 1: `stageRow`スニペットに通貨表示を追加**

`src/routes/game/shidasu/+page.svelte`の220-228行目を以下のように変更する(スプレッド名・進捗ドットの右に通貨表示を追加する):

変更前:
```svelte
  <div class="flex items-center justify-between text-xs">
    <span class="flex items-center gap-2">
      <span class="text-emerald-200/90 font-bold">{params.spreads[run.spreadId].name}</span>
      <span class="flex gap-1">
        {#each [0, 1, 2] as w (w)}
          <span class="w-2 h-2 rounded-full {w < run.waveIndex ? 'bg-yellow-400' : w === run.waveIndex ? 'bg-yellow-400 animate-pulse' : 'bg-emerald-800'}"></span>
        {/each}
      </span>
    </span>
```

変更後:
```svelte
  <div class="flex items-center justify-between text-xs">
    <span class="flex items-center gap-2">
      <span class="text-emerald-200/90 font-bold">{params.spreads[run.spreadId].name}</span>
      <span class="flex gap-1">
        {#each [0, 1, 2] as w (w)}
          <span class="w-2 h-2 rounded-full {w < run.waveIndex ? 'bg-yellow-400' : w === run.waveIndex ? 'bg-yellow-400 animate-pulse' : 'bg-emerald-800'}"></span>
        {/each}
      </span>
      <span class="text-yellow-300 font-bold">{params.currency.symbol}{run.currency}</span>
    </span>
```

- [ ] **Step 2: 型チェックを実行して確認**

Run: `npm run check`
Expected: PASS

- [ ] **Step 3: 開発サーバーで表示を目視確認**

Run: `npm run dev`
`http://localhost:5173/game/shidasu` を開き、ゲーム開始後に画面上部のHUD(スプレッド名の隣)に`☆5`(初期所持数)が表示されていることを確認する。Waveをクリアして`☆`の数値が`waveClearAmount`分増えること、ボスWaveクリア時はさらにボーナス分増えることを確認する。

- [ ] **Step 4: コミット**

```bash
git add src/routes/game/shidasu/+page.svelte
git commit -m "feat: プレイ中の常時表示HUDに通貨(星片)を追加"
```

---

### Task 9: 最終確認

**Files:** なし(検証のみ)

- [ ] **Step 1: ビルドを実行**

Run: `npm run build`
Expected: エラーなく成功する

- [ ] **Step 2: 型チェックを実行**

Run: `npm run check`
Expected: エラーなく成功する

- [ ] **Step 3: テストスイート全体を実行**

Run: `npx vitest run src/lib/game/shidasu/engine.test.ts`
Expected: 全テストPASS

- [ ] **Step 4: 開発サーバーで管理画面を目視確認**

Run: `npm run dev`
`http://localhost:5173/admin` を開き、「星詠みソリティア -Shidasu- 通貨設定」カードが表示されていること、クリックして`/admin/shidasu-currency`に遷移できることを確認する。フォームの各項目を編集して保存し、リロード後も値が保持されていることを確認する。数値項目を空にすると保存ボタンが無効化されることを確認する。
