# スプレッド専用admin設定ページ Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** `/admin/shidasu-spreads`という新規ページを作成し、`ShidasuParams.spreads`(愚者・月・教皇の3種)を管理画面から編集できるようにする。

**Architecture:** `SPREAD_IDS`定数を`params.ts`に公開定数として新設し、ゲーム側(`src/routes/game/shidasu/+page.svelte`)のローカル定数をこれに置き換える。既存の`/admin/shidasu-sabotage`と同じ「単一テーブル型」admin画面パターンを踏襲し、`/api/admin/shidasu-config`(既存API、変更不要)を使って`shidasu.config.json`を読み書きする。最後に`/admin/+page.svelte`にリンクを追加する。

**Tech Stack:** TypeScript, SvelteKit (Svelte 5 runes), 既存の`/admin/shidasu-sabotage`パターンを流用

---

## 前提知識(既存コードの構造)

- `SpreadId`型・`SpreadConfig`インターフェース(`src/lib/game/shidasu/types.ts:26-40`):
  ```ts
  export type SpreadId = 'fool' | 'moon' | 'pope'
  export interface SpreadConfig {
    name: string
    desc: string
    initialExtraTableauRows: number
    waveTargetBase: number
    waveTargetMultiplier: number
    initialOracleLevel: number
    bannedShopKinds: ShopSlotKind[]
  }
  ```
- `ShopSlotKind`型(`types.ts`): `'item' | 'rite' | 'revelation' | 'oracle' | 'cardSet'`
- `ShidasuParams.spreads: Record<SpreadId, SpreadConfig>`(`params.ts:51`付近)
- `DEFAULT_PARAMS.spreads`の現在値(`params.ts:340-344`):
  ```ts
  spreads: {
    fool: { name: '愚者', desc: '特殊ルールなし', initialExtraTableauRows: 0, waveTargetBase: 2000, waveTargetMultiplier: 1.5, initialOracleLevel: 1, bannedShopKinds: [] },
    moon: { name: '月', desc: '場札は常に1行少ない状態で始まる', initialExtraTableauRows: -1, waveTargetBase: 2000, waveTargetMultiplier: 1.5, initialOracleLevel: 1, bannedShopKinds: [] },
    pope: { name: '教皇', desc: '神託の初期レベルが5になるが、ショップで神託が販売されない', initialExtraTableauRows: 0, waveTargetBase: 2000, waveTargetMultiplier: 1.5, initialOracleLevel: 5, bannedShopKinds: ['oracle'] },
  },
  ```
- `params.ts`のファイル末尾(`params.ts:625-634`付近):
  ```ts
    flow: { wavesPerStage: 3, clearDelayMs: 450, stageTargetBase: 2000, stageTargetMultiplier: 1.8, stagesPerRun: 8, rerollCost: 30 },
    ui: { comboTierThresholds: [3, 5, 8], chainCardOffsetX: 30, chainCardsPerRow: 10 },
  }

  export function loadParams(): ShidasuParams {
    // ui.comboTierThresholds(タプル型)とJSON側の推論型(number[])が構造的に一致しないため、
    // 単純な`as ShidasuParams`ではTS2352エラーになる。unknownを経由して型チェックを迂回する
    // (既存の relics.ts 等でも同様のパターンを使用)。
    return shidasuConfigJson as unknown as ShidasuParams
  }
  ```
  (`DEFAULT_PARAMS`オブジェクトリテラルの閉じ`}`の直後に`loadParams`関数が続く構造。`SPREAD_IDS`はこの間、`DEFAULT_PARAMS`の外側に追加する。)
- `src/routes/game/shidasu/+page.svelte:231`の現在のローカル定数: `const SPREAD_IDS: SpreadId[] = ['fool', 'moon', 'pope']`。同じ変数名がスクリプト内で使われている(`{#each SPREAD_IDS as spreadId (spreadId)}`、783行目付近)。
- `+page.svelte`のimport文(3行目): `import { loadParams } from '$lib/game/shidasu/params'` および`import type { ShidasuParams } from '$lib/game/shidasu/params'`。
- 既存admin画面の完全なテンプレート、`src/routes/admin/shidasu-sabotage/+page.svelte`(全141行、全文):
  ```svelte
  <script lang="ts">
    import { onMount, onDestroy } from 'svelte'
    import { DEFAULT_PARAMS, type ShidasuParams } from '$lib/game/shidasu/params'
    import { SABOTAGE_POOL } from '$lib/game/shidasu/sabotage'
    import type { SabotageActionId } from '$lib/game/shidasu/types'

    let config = $state<ShidasuParams | null>(null)
    let error = $state<string | null>(null)
    let flash = $state<string | null>(null)
    let flashTimer: ReturnType<typeof setTimeout> | null = null

    function showToast(message: string) {
      if (flashTimer) clearTimeout(flashTimer)
      flash = message
      flashTimer = setTimeout(() => { flash = null }, 2000)
    }

    function sabotageEntry(id: SabotageActionId) {
      return config!.sabotageActions[id]
    }

    let hasValidationError = $derived.by(() => {
      if (!config) return false
      return SABOTAGE_POOL.some(id => {
        const entry = sabotageEntry(id)
        if (!entry.name.trim()) return true
        if (!entry.descTemplate.trim()) return true
        if (!Number.isInteger(entry.intervalTurns) || entry.intervalTurns <= 0) return true
        return false
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
    <title>Shidasu 妨害行動設定</title>
  </svelte:head>

  <div class="max-w-6xl mx-auto px-4 py-8">
    <a href="/admin" class="text-xs text-slate-400 hover:text-teal-600 mb-4 inline-block">← 管理ページ一覧</a>

    <div class="flex items-center justify-between mb-6">
      <h1 class="text-2xl font-bold text-slate-800">星詠みソリティア -Shidasu- 妨害行動設定</h1>
      <div class="flex gap-2">
        <button onclick={() => loadConfig(true)} class="text-sm px-3 py-1.5 rounded-lg border border-slate-200 text-slate-600 hover:bg-slate-50 transition-colors">
          リロード
        </button>
        {#if hasValidationError}
          <p class="text-xs text-red-600 self-center">名前・説明文が未入力、または発動間隔ターン数が不正な項目があります</p>
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
                <th class="px-2 py-1.5 text-left" style="width:10rem;">id</th>
                <th class="px-2 py-1.5 text-left" style="width:8rem;">表示名</th>
                <th class="px-2 py-1.5 text-left" style="width:6rem;">対象カテゴリ</th>
                <th class="px-2 py-1.5 text-left" style="width:6rem;">発動間隔(ターン)</th>
                <th class="px-2 py-1.5 text-left" style="width:24rem;">効果説明文</th>
              </tr>
            </thead>
            <tbody class="divide-y divide-slate-100">
              {#each SABOTAGE_POOL as id (id)}
                {@const entry = sabotageEntry(id)}
                <tr>
                  <td class="px-2 py-1.5 align-top text-slate-400 font-mono">{id}</td>
                  <td class="px-2 py-1.5 align-top">
                    <input type="text" bind:value={entry.name} class="w-full border border-slate-200 rounded px-1.5 py-0.5" />
                  </td>
                  <td class="px-2 py-1.5 align-top text-slate-500">{entry.target}</td>
                  <td class="px-2 py-1.5 align-top">
                    <input type="number" step="1" min="1" bind:value={entry.intervalTurns} class="w-full border border-slate-200 rounded px-1 py-0.5" />
                  </td>
                  <td class="px-2 py-1.5 align-top">
                    <textarea bind:value={entry.descTemplate} rows="2" class="w-full border border-slate-200 rounded px-1.5 py-0.5 font-mono text-[11px] resize-y"></textarea>
                  </td>
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
- `/admin/+page.svelte`の末尾(`shidasu-sabotage`エントリの直前・直後、全体101行):既存の最後のエントリは93-99行目の`shidasu-sabotage`ブロックで、その直後(100行目`</div>`の直前)に新規エントリを追加する。

---

## Task 1: SPREAD_IDS定数をparams.tsに新設し、ゲーム側の重複を解消

**Files:**
- Modify: `src/lib/game/shidasu/params.ts`
- Modify: `src/routes/game/shidasu/+page.svelte`

- [ ] **Step 1: params.tsにSPREAD_IDSを追加**

`params.ts`の`DEFAULT_PARAMS`オブジェクトの閉じ`}`の直後(`export function loadParams()`の直前)に追加:

```ts

// スプレッドのID一覧。ゲーム側のスプレッド選択画面・admin側の設定ページの両方から参照する
// 単一の情報源。新規スプレッドを追加する際はここに追記すれば両画面に自動反映される。
export const SPREAD_IDS: SpreadId[] = ['fool', 'moon', 'pope']
```

(`SpreadId`型は`params.ts`の先頭で既に`import type { ... SpreadId, SpreadConfig } from './types'`としてimport済みのため、追加のimportは不要。)

- [ ] **Step 2: +page.svelteのローカル定数をparams.ts由来のものに置き換える**

`src/routes/game/shidasu/+page.svelte`の3行目付近、`import { loadParams } from '$lib/game/shidasu/params'`という行を以下に変更:

```ts
  import { loadParams, SPREAD_IDS } from '$lib/game/shidasu/params'
```

同ファイル231行目、`const SPREAD_IDS: SpreadId[] = ['fool', 'moon', 'pope']`という行を削除する(importした`SPREAD_IDS`をそのまま使うため、ローカル定数の再定義は不要)。

- [ ] **Step 3: ビルド・型チェック**

Run: `npm run build`
Run: `npm run check`

型エラーが出た場合、`+page.svelte`内で`SpreadId`型のimportが他の用途で必要か確認し(233行目の`function handleStartWithSpread(spreadId: SpreadId)`で型注釈として使われているため、`SpreadId`型のimport自体は削除しないこと)、`SPREAD_IDS`という識別子がimportとローカル定数削除後の両方で二重定義になっていないか確認する。

- [ ] **Step 4: 全体テストスイート**

Run: `npm run test`
Expected: 既存の全1422件がPASSしたまま変わらないこと(このタスクはロジック変更を伴わない定数の移動のみのため)。

- [ ] **Step 5: コミット**

```bash
git add src/lib/game/shidasu/params.ts src/routes/game/shidasu/+page.svelte
git commit -m "refactor: SPREAD_IDSをparams.tsの公開定数に切り出し、ゲーム側の重複定義を解消"
```

---

## Task 2: /admin/shidasu-spreadsページを新規作成

**Files:**
- Create: `src/routes/admin/shidasu-spreads/+page.svelte`

- [ ] **Step 1: ディレクトリの存在を確認**

Run: `ls src/routes/admin/shidasu-spreads 2>/dev/null || echo "not found"`

まだ存在しないディレクトリのはずなので、`+page.svelte`を新規作成する形になる(SvelteKitはファイルパスがそのままルーティングになるため、`src/routes/admin/shidasu-spreads/+page.svelte`を作成すれば`/admin/shidasu-spreads`でアクセス可能になる)。

- [ ] **Step 2: +page.svelteを新規作成**

`src/routes/admin/shidasu-spreads/+page.svelte`を以下の内容で作成する。既存の`shidasu-sabotage`のパターンを踏襲しつつ、`SPREAD_IDS`(Task 1で追加)をループ対象にし、7列(id・名称・説明文・初期行数オフセット・目標スコア基礎値・目標スコア倍率・神託初期レベル・ショップ非販売種別)を実装する:

```svelte
<script lang="ts">
  import { onMount, onDestroy } from 'svelte'
  import { DEFAULT_PARAMS, SPREAD_IDS, type ShidasuParams } from '$lib/game/shidasu/params'
  import type { SpreadId, ShopSlotKind } from '$lib/game/shidasu/types'

  let config = $state<ShidasuParams | null>(null)
  let error = $state<string | null>(null)
  let flash = $state<string | null>(null)
  let flashTimer: ReturnType<typeof setTimeout> | null = null

  const SHOP_SLOT_KIND_OPTIONS: ShopSlotKind[] = ['item', 'rite', 'revelation', 'oracle', 'cardSet']
  const SHOP_SLOT_KIND_LABELS: Record<ShopSlotKind, string> = {
    item: '護符',
    rite: '秘儀',
    revelation: '天啓',
    oracle: '神託',
    cardSet: 'トランプセット',
  }

  function showToast(message: string) {
    if (flashTimer) clearTimeout(flashTimer)
    flash = message
    flashTimer = setTimeout(() => { flash = null }, 2000)
  }

  function spreadEntry(id: SpreadId) {
    return config!.spreads[id]
  }

  // チェックボックスのON/OFFに応じて、対象種別をbannedShopKinds配列に追加/削除する。
  function toggleBannedShopKind(id: SpreadId, kind: ShopSlotKind, checked: boolean) {
    const entry = spreadEntry(id)
    if (checked) {
      if (!entry.bannedShopKinds.includes(kind)) entry.bannedShopKinds = [...entry.bannedShopKinds, kind]
    } else {
      entry.bannedShopKinds = entry.bannedShopKinds.filter(k => k !== kind)
    }
  }

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
      return false
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
  <title>Shidasu スプレッド設定</title>
</svelte:head>

<div class="max-w-6xl mx-auto px-4 py-8">
  <a href="/admin" class="text-xs text-slate-400 hover:text-teal-600 mb-4 inline-block">← 管理ページ一覧</a>

  <div class="flex items-center justify-between mb-6">
    <h1 class="text-2xl font-bold text-slate-800">星詠みソリティア -Shidasu- スプレッド設定</h1>
    <div class="flex gap-2">
      <button onclick={() => loadConfig(true)} class="text-sm px-3 py-1.5 rounded-lg border border-slate-200 text-slate-600 hover:bg-slate-50 transition-colors">
        リロード
      </button>
      {#if hasValidationError}
        <p class="text-xs text-red-600 self-center">名前・説明文が未入力、または数値パラメータが不正な項目があります</p>
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
              <th class="px-2 py-1.5 text-left" style="width:6rem;">id</th>
              <th class="px-2 py-1.5 text-left" style="width:6rem;">名称</th>
              <th class="px-2 py-1.5 text-left" style="width:16rem;">説明文</th>
              <th class="px-2 py-1.5 text-left" style="width:7rem;">初期行数オフセット</th>
              <th class="px-2 py-1.5 text-left" style="width:7rem;">目標スコア基礎値</th>
              <th class="px-2 py-1.5 text-left" style="width:7rem;">目標スコア倍率</th>
              <th class="px-2 py-1.5 text-left" style="width:7rem;">神託初期レベル</th>
              <th class="px-2 py-1.5 text-left" style="width:12rem;">ショップ非販売種別</th>
            </tr>
          </thead>
          <tbody class="divide-y divide-slate-100">
            {#each SPREAD_IDS as id (id)}
              {@const entry = spreadEntry(id)}
              <tr>
                <td class="px-2 py-1.5 align-top text-slate-400 font-mono">{id}</td>
                <td class="px-2 py-1.5 align-top">
                  <input type="text" bind:value={entry.name} class="w-full border border-slate-200 rounded px-1.5 py-0.5" />
                </td>
                <td class="px-2 py-1.5 align-top">
                  <textarea bind:value={entry.desc} rows="2" class="w-full border border-slate-200 rounded px-1.5 py-0.5 font-mono text-[11px] resize-y"></textarea>
                </td>
                <td class="px-2 py-1.5 align-top">
                  <input type="number" step="any" bind:value={entry.initialExtraTableauRows} class="w-full border border-slate-200 rounded px-1 py-0.5" />
                </td>
                <td class="px-2 py-1.5 align-top">
                  <input type="number" step="any" bind:value={entry.waveTargetBase} class="w-full border border-slate-200 rounded px-1 py-0.5" />
                </td>
                <td class="px-2 py-1.5 align-top">
                  <input type="number" step="any" bind:value={entry.waveTargetMultiplier} class="w-full border border-slate-200 rounded px-1 py-0.5" />
                </td>
                <td class="px-2 py-1.5 align-top">
                  <input type="number" step="any" bind:value={entry.initialOracleLevel} class="w-full border border-slate-200 rounded px-1 py-0.5" />
                </td>
                <td class="px-2 py-1.5 align-top">
                  <div class="flex flex-col gap-0.5">
                    {#each SHOP_SLOT_KIND_OPTIONS as kind (kind)}
                      <label class="flex items-center gap-1 text-[11px] text-slate-600">
                        <input
                          type="checkbox"
                          checked={entry.bannedShopKinds.includes(kind)}
                          onchange={(e) => toggleBannedShopKind(id, kind, e.currentTarget.checked)}
                        />
                        {SHOP_SLOT_KIND_LABELS[kind]}
                      </label>
                    {/each}
                  </div>
                </td>
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

**設計上の注記:** `bannedShopKinds`はプリミティブ値の`bind:value`では扱えない配列フィールドのため、`toggleBannedShopKind`という専用ハンドラで`checked`イベントを受けて配列を組み立て直す方式にしている(`entry.bannedShopKinds = [...]`という代入で`$state`のリアクティビティを発火させる。`push`/`filter`のin-place変更ではなく新しい配列を代入する点が重要)。

- [ ] **Step 3: ビルド・型チェック**

Run: `npm run build`
Run: `npm run check`

型エラーが出た場合、`e.currentTarget.checked`の型(`EventTarget`ではなく`HTMLInputElement`であることをSvelteが推論できているか)を確認する。もし型エラーになる場合は、`onchange={(e: Event & { currentTarget: HTMLInputElement }) => toggleBannedShopKind(id, kind, e.currentTarget.checked)}`のように型注釈を明示する。

- [ ] **Step 4: 全体テストスイート**

Run: `npm run test`
Expected: 既存の全件がPASSしたまま変わらないこと(admin画面には既存の自動テストが無いため、新規テストの追加も不要)。

- [ ] **Step 5: コミット**

```bash
git add src/routes/admin/shidasu-spreads/+page.svelte
git commit -m "feat: /admin/shidasu-spreadsページを新規作成"
```

---

## Task 3: /admin/+page.svelteへのリンク追加と最終動作確認

**Files:**
- Modify: `src/routes/admin/+page.svelte`

- [ ] **Step 1: リンクを追加**

`src/routes/admin/+page.svelte`内、既存の`shidasu-sabotage`エントリ(以下のブロック)の直後に新規エントリを追加する:

```svelte
    <a href="/admin/shidasu-sabotage" class="flex items-center gap-3 px-4 py-4 hover:bg-slate-50 transition-colors group">
      <div class="flex-1">
        <p class="text-sm font-semibold text-slate-700 group-hover:text-teal-700">星詠みソリティア -Shidasu- 妨害行動設定</p>
        <p class="text-xs text-slate-400 mt-0.5">妨害行動32種の表示名・発動間隔ターン数・効果説明文を1行ずつ編集</p>
      </div>
      <span class="text-slate-300 group-hover:text-teal-600 transition-colors">→</span>
    </a>
```

この直後(`</div>`の直前)に追加:

```svelte
    <a href="/admin/shidasu-spreads" class="flex items-center gap-3 px-4 py-4 hover:bg-slate-50 transition-colors group">
      <div class="flex-1">
        <p class="text-sm font-semibold text-slate-700 group-hover:text-teal-700">星詠みソリティア -Shidasu- スプレッド設定</p>
        <p class="text-xs text-slate-400 mt-0.5">fool・moon・popeの初期条件・目標スコア・ショップ制限を編集</p>
      </div>
      <span class="text-slate-300 group-hover:text-teal-600 transition-colors">→</span>
    </a>
```

- [ ] **Step 2: ビルド・型チェック**

Run: `npm run build`
Run: `npm run check`

- [ ] **Step 3: 全体テストスイート**

Run: `npm run test`
Expected: 既存の全件PASS。

- [ ] **Step 4: npm run devで実際に動作確認**

Run: `npm run dev`(バックグラウンド起動)

1. `/admin`にアクセスし、「星詠みソリティア -Shidasu- スプレッド設定」というリンクが末尾に表示されていることを確認する。
2. リンクをクリックして`/admin/shidasu-spreads`に遷移し、3行(fool・moon・pope)のテーブルが表示され、各行に名称・説明文・4つの数値フィールド・チェックボックス5個が表示されることを確認する。
3. `pope`行の`initialOracleLevel`を`5`から`7`に変更し、「保存」ボタンを押す。トースト通知(「保存しました」)が表示されることを確認する。
4. `/api/admin/shidasu-config`のJSONレスポンス(または再度`/admin/shidasu-spreads`をリロード)で、`spreads.pope.initialOracleLevel`が`7`に更新されていることを確認する。
5. 変更内容を`5`に戻して再度保存し、リポジトリの状態を元に戻す(`shidasu.config.json`が意図せず`7`のまま残らないようにする)。
6. `/game/shidasu`にアクセスし、スプレッド選択画面で「教皇」が引き続き選択肢として表示されることを確認する(Task 1のリファクタで壊れていないことの確認)。
7. 確認後、開発サーバーを停止する。

- [ ] **Step 5: 問題があれば修正、無ければ完了報告**

ビルドエラー・型エラー・画面崩れがあれば修正してから完了とする。

- [ ] **Step 6: 最終コミット**

```bash
git add src/routes/admin/+page.svelte
git commit -m "feat: 管理ページ一覧にスプレッド設定へのリンクを追加"
```

(Step 4での動作確認中に`shidasu.config.json`が変更されたままになっていないか、`git status`で確認すること。もし意図せず変更が残っていた場合は、Step 6のコミット対象に含めるか、`git checkout -- src/lib/game/shidasu/shidasu.config.json`で元に戻してからコミットすること。)

---

## 自己レビュー用メモ(実装完了後にplan作成者が確認する事項)

- **spec coverage:** 設計docの5節全てがTask 1〜3でカバーされている。「1. 新規ページ」はTask 2、「2. SPREAD_IDS共有化」はTask 1、「3. データの読み書き」は既存API流用のためTask 2内で対応(新規コード不要)、「4. バリデーション」はTask 2の`hasValidationError`、「5. リンク追加」はTask 3。
- **placeholder scan:** 全タスクに具体的なコード・テストコードを記載済み。Task 2 Step 3の型エラー対応は「エラーが出た場合」の条件分岐だが、代替コードも明記しており丸投げしていない。
- **type consistency:** `SPREAD_IDS: SpreadId[]`(Task 1で定義)は、Task 2・Task 3内で一貫して同じ名前・型で参照している。`SpreadConfig`のフィールド名(`name`/`desc`/`initialExtraTableauRows`/`waveTargetBase`/`waveTargetMultiplier`/`initialOracleLevel`/`bannedShopKinds`)はTask 2のテーブル実装で全て網羅し、フィールド名の表記ゆれが無いことを確認済み。`ShopSlotKind`の5値(`item`/`rite`/`revelation`/`oracle`/`cardSet`)もTask 2の`SHOP_SLOT_KIND_OPTIONS`・`SHOP_SLOT_KIND_LABELS`で一貫している。
