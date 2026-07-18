# Shidasu admin/shidasu ページ分割 Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** `src/routes/admin/shidasu/+page.svelte`(381行)を、セクションごとの子コンポーネント7つ+共通入力コンポーネント1つに分割し、`+page.svelte`本体をconfig読込・保存・バリデーション・トースト管理のみを持つシェルに縮小する。**挙動は一切変更しない、純粋なリファクタリング。**

**Architecture:** 各セクション(レイアウト・スコアリング・役ボーナス・ステージ・アイテム・フロー/UI・JSON入出力)を独立したコンポーネントに切り出し、`config: ShidasuParams`をpropとして渡して直接ミューテーションさせる(Svelte5の`$state`はディープリアクティブなプロキシのため、参照を渡せば子コンポーネント内の変更が親に伝播する)。`JsonPanel`のみ`config`を丸ごと差し替える必要があるため`onApply`コールバックpropを使う。点数系の入力欄(`/10`表示・`*10`書き込み変換)は`ScaledNumberInput.svelte`という共通コンポーネントに切り出す。

**Tech Stack:** SvelteKit, Svelte 5 (runes)

**この計画の性質について:** ロジックを一切変更しない「移動のみ」のリファクタリング。このページには自動テスト(`.test.ts`)が存在しないため、各タスクの検証は`npm run check`(型チェック)を基本とし、最終タスクでブラウザによる動作確認を行う。

---

## 事前準備: 対象ファイルの現状(このplan作成時点の`src/routes/admin/shidasu/+page.svelte`、382行)

```svelte
<script lang="ts">
  import { onMount, onDestroy } from 'svelte'
  import { DEFAULT_PARAMS, type ShidasuParams } from '$lib/game/shidasu/params'

  let config = $state<ShidasuParams | null>(null)
  let error = $state<string | null>(null)
  let flash = $state<string | null>(null)
  let flashTimer: ReturnType<typeof setTimeout> | null = null
  let jsonText = $state('')
  let jsonError = $state<string | null>(null)

  function showToast(message: string) {
    if (flashTimer) clearTimeout(flashTimer)
    flash = message
    flashTimer = setTimeout(() => { flash = null }, 2000)
  }

  let hasValidationError = $derived.by(() => {
    if (!config) return false
    if (config.stages.length < 1) return true
    for (const stage of config.stages) {
      if (stage.targets.some(t => !Number.isFinite(t) || t < 0)) return true
    }
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

  let targetsNotAscending = $derived.by(() => {
    if (!config) return false
    return config.stages.some(s => !(s.targets[0] < s.targets[1] && s.targets[1] < s.targets[2]))
  })

  async function loadConfig(toast = false) { /* ... */ }
  async function save() { /* ... */ }
  function resetToDefault() { /* ... */ }
  function addStage() { /* ... */ }
  function removeStage(index: number) { /* ... */ }
  function openJsonPanel() { /* ... */ }
  function isValidShidasuParams(value: unknown): value is ShidasuParams { /* ... */ }
  function applyJson() { /* ... */ }
  function setScoring<K extends keyof ShidasuParams['scoring']>(key: K, value: number) { /* ... */ }
  function setTarget(stageIndex: number, targetIndex: 0 | 1 | 2, value: number) { /* ... */ }

  onMount(() => loadConfig())
  onDestroy(() => { if (flashTimer) clearTimeout(flashTimer) })
</script>

{#snippet scaledNumberInput(value: number, onChange: (v: number) => void)}
  <!-- /10表示・*10書き込みの入力欄 -->
{/snippet}

<div class="max-w-3xl mx-auto px-4 py-8">
  <!-- ヘッダー・エラー表示・各セクション(レイアウト/スコアリング/役ボーナス/ステージ/アイテム/フロー・UI/JSON入出力)・リセットボタン・トースト -->
</div>
```

**重要:** 各タスクは直前のタスクの結果を前提に`+page.svelte`の内容が変わるため、必ず直前のタスク完了後の実際のファイル内容を`Read`ツールで確認してから作業すること。

---

### Task 1: `LayoutSection.svelte`の抽出

**Files:**
- Create: `src/routes/admin/shidasu/LayoutSection.svelte`
- Modify: `src/routes/admin/shidasu/+page.svelte`

- [ ] **Step 1: `LayoutSection.svelte`を新規作成する**

```svelte
<script lang="ts">
  import type { ShidasuParams } from '$lib/game/shidasu/params'

  let { config }: { config: ShidasuParams } = $props()
</script>

<section class="bg-white border border-slate-200 rounded-xl p-4">
  <h2 class="font-semibold text-slate-700 text-sm mb-3">レイアウト</h2>
  <div class="grid grid-cols-2 gap-3">
    <label class="text-xs text-slate-500">
      列数(cols)
      <input type="number" min="1" step="1" bind:value={config.layout.cols} class="mt-1 w-full border border-slate-200 rounded px-2 py-1 text-sm" />
    </label>
    <label class="text-xs text-slate-500">
      段数(rows)
      <input type="number" min="1" step="1" bind:value={config.layout.rows} class="mt-1 w-full border border-slate-200 rounded px-2 py-1 text-sm" />
    </label>
  </div>
</section>
```

- [ ] **Step 2: `+page.svelte`を更新する**

`Read`で現在の`+page.svelte`を確認し、`<script>`のimportに以下を追加する:

```ts
import LayoutSection from './LayoutSection.svelte'
```

マークアップ内の以下のセクション:

```svelte
      <section class="bg-white border border-slate-200 rounded-xl p-4">
        <h2 class="font-semibold text-slate-700 text-sm mb-3">レイアウト</h2>
        <div class="grid grid-cols-2 gap-3">
          <label class="text-xs text-slate-500">
            列数(cols)
            <input type="number" min="1" step="1" bind:value={config.layout.cols} class="mt-1 w-full border border-slate-200 rounded px-2 py-1 text-sm" />
          </label>
          <label class="text-xs text-slate-500">
            段数(rows)
            <input type="number" min="1" step="1" bind:value={config.layout.rows} class="mt-1 w-full border border-slate-200 rounded px-2 py-1 text-sm" />
          </label>
        </div>
      </section>
```

を

```svelte
      <LayoutSection {config} />
```

に置き換える。

- [ ] **Step 3: 型チェック**

```bash
npm run check
```

Expected: 型エラーなし。

- [ ] **Step 4: コミット**

現在のブランチは`feat`です。プロジェクトのCLAUDE.md規約により、`feat`ブランチではユーザーへの確認なしでコミットしてよい規約になっています。コミットメッセージは日本語で書いてください。

```bash
git add src/routes/admin/shidasu/LayoutSection.svelte src/routes/admin/shidasu/+page.svelte
git commit -m "refactor: admin/shidasuのレイアウトセクションをLayoutSection.svelteに分離"
```

---

### Task 2: `ItemsSection.svelte`の抽出

**Files:**
- Create: `src/routes/admin/shidasu/ItemsSection.svelte`
- Modify: `src/routes/admin/shidasu/+page.svelte`

- [ ] **Step 1: `ItemsSection.svelte`を新規作成する**

```svelte
<script lang="ts">
  import type { ShidasuParams } from '$lib/game/shidasu/params'

  let { config }: { config: ShidasuParams } = $props()
</script>

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

- [ ] **Step 2: `+page.svelte`を更新する**

`Read`で現在の`+page.svelte`を確認し、importに以下を追加する:

```ts
import ItemsSection from './ItemsSection.svelte'
```

マークアップ内のアイテムセクション全体(`<h2 class="font-semibold text-slate-700 text-sm mb-3">アイテム</h2>`を含む`<section>`)を

```svelte
      <ItemsSection {config} />
```

に置き換える。

- [ ] **Step 3: 型チェック**

```bash
npm run check
```

- [ ] **Step 4: コミット**

```bash
git add src/routes/admin/shidasu/ItemsSection.svelte src/routes/admin/shidasu/+page.svelte
git commit -m "refactor: admin/shidasuのアイテムセクションをItemsSection.svelteに分離"
```

---

### Task 3: `ScaledNumberInput.svelte` + `ScoringSection.svelte`の抽出

**Files:**
- Create: `src/routes/admin/shidasu/ScaledNumberInput.svelte`
- Create: `src/routes/admin/shidasu/ScoringSection.svelte`
- Modify: `src/routes/admin/shidasu/+page.svelte`

**背景:** 現行の`{#snippet scaledNumberInput(...)}`は、点数系パラメータ(常に10の倍数)を「表示は/10、書き込みは値*10」という変換込みで編集する入力欄。Scoring・RoleBonus・Stagesの3ファイルから使うため、ファイルをまたいで再利用できる通常コンポーネントに変換する。**このタスクでは`+page.svelte`側の`scaledNumberInput`スニペット定義はまだ削除しない**(RoleBonus・Stagesセクションがまだこのスニペットを使っているため。Task5で全ての利用箇所が置き換わった後にまとめて削除する)。

- [ ] **Step 1: `ScaledNumberInput.svelte`を新規作成する**

```svelte
<script lang="ts">
  let { value, onChange }: { value: number; onChange: (v: number) => void } = $props()
</script>

<div class="mt-1 flex items-center gap-1">
  <input
    type="number"
    min="0"
    step="1"
    value={value / 10}
    oninput={(e) => onChange(Number((e.target as HTMLInputElement).value) * 10)}
    class="w-full border border-slate-200 rounded px-2 py-1 text-sm"
  />
  <span class="text-slate-400 font-mono text-sm select-none" title="点数系パラメータは常に10の倍数">0</span>
</div>
```

- [ ] **Step 2: `ScoringSection.svelte`を新規作成する**

```svelte
<script lang="ts">
  import type { ShidasuParams } from '$lib/game/shidasu/params'
  import ScaledNumberInput from './ScaledNumberInput.svelte'

  let { config }: { config: ShidasuParams } = $props()
</script>

<section class="bg-white border border-slate-200 rounded-xl p-4">
  <h2 class="font-semibold text-slate-700 text-sm mb-3">スコアリング</h2>
  <div class="grid grid-cols-2 gap-3">
    <label class="text-xs text-slate-500">
      基礎点(basePoint)
      <ScaledNumberInput value={config.scoring.basePoint} onChange={(v) => (config.scoring.basePoint = v)} />
    </label>
    <label class="text-xs text-slate-500">
      同スートボーナス(suitBonus)
      <ScaledNumberInput value={config.scoring.suitBonus} onChange={(v) => (config.scoring.suitBonus = v)} />
    </label>
    <label class="text-xs text-slate-500">
      同色ボーナス(colorBonus)
      <ScaledNumberInput value={config.scoring.colorBonus} onChange={(v) => (config.scoring.colorBonus = v)} />
    </label>
    <label class="text-xs text-slate-500">
      同スート/同色の成立に必要な実カード枚数(suitColorMinLen)
      <input type="number" min="1" step="1" bind:value={config.scoring.suitColorMinLen} class="mt-1 w-full border border-slate-200 rounded px-2 py-1 text-sm" />
    </label>
    <label class="text-xs text-slate-500">
      階段ボーナス(stairBonus)
      <ScaledNumberInput value={config.scoring.stairBonus} onChange={(v) => (config.scoring.stairBonus = v)} />
    </label>
    <label class="text-xs text-slate-500">
      階段成立枚数(stairMinLen)
      <input type="number" min="2" step="1" bind:value={config.scoring.stairMinLen} class="mt-1 w-full border border-slate-200 rounded px-2 py-1 text-sm" />
    </label>
    <label class="text-xs text-slate-500">
      全消しボーナス(clearBonus)
      <ScaledNumberInput value={config.scoring.clearBonus} onChange={(v) => (config.scoring.clearBonus = v)} />
    </label>
    <label class="text-xs text-slate-500">
      全消し・残り山札1枚あたり(clearBonusPerStock)
      <ScaledNumberInput value={config.scoring.clearBonusPerStock} onChange={(v) => (config.scoring.clearBonusPerStock = v)} />
    </label>
    <label class="text-xs text-slate-500">
      コンボ倍率のstep幅(comboMultiplierStep)
      <input type="number" min="0" step="0.1" bind:value={config.scoring.comboMultiplierStep} class="mt-1 w-full border border-slate-200 rounded px-2 py-1 text-sm" />
    </label>
  </div>
</section>
```

(`ScaledNumberInput`の`onChange`は、元の`setScoring(key, value)`が`config.scoring[key] = value`をしていたのと同じ代入を、各呼び出し箇所で直接行う形にしている。挙動は同一。)

- [ ] **Step 3: `+page.svelte`を更新する**

importに以下を追加する:

```ts
import ScoringSection from './ScoringSection.svelte'
```

マークアップ内のスコアリングセクション全体(`<h2 class="font-semibold text-slate-700 text-sm mb-3">スコアリング</h2>`を含む`<section>`)を

```svelte
      <ScoringSection {config} />
```

に置き換える。

`setScoring`関数はまだ`+page.svelte`に残す(RoleBonusセクションがTask4で移行するまで使われているため)。実際には、置き換え後に`setScoring`の呼び出し元がスコアリングセクション由来のものだけであれば、この時点で未使用になっている可能性がある。`Read`で確認し、`setScoring`の呼び出し箇所が`+page.svelte`のマークアップに残っていなければ(RoleBonusセクションでの呼び出しが実質すべてなら)、そのまま残しておいてよい(Task4で最終的に不要になる)。

- [ ] **Step 4: 型チェック**

```bash
npm run check
```

- [ ] **Step 5: コミット**

```bash
git add src/routes/admin/shidasu/ScaledNumberInput.svelte src/routes/admin/shidasu/ScoringSection.svelte src/routes/admin/shidasu/+page.svelte
git commit -m "refactor: admin/shidasuのスコアリングセクションをScoringSection.svelteに分離し、ScaledNumberInputを共通コンポーネント化"
```

---

### Task 4: `RoleBonusSection.svelte`の抽出

**Files:**
- Create: `src/routes/admin/shidasu/RoleBonusSection.svelte`
- Modify: `src/routes/admin/shidasu/+page.svelte`

- [ ] **Step 1: `RoleBonusSection.svelte`を新規作成する**

```svelte
<script lang="ts">
  import type { ShidasuParams } from '$lib/game/shidasu/params'
  import ScaledNumberInput from './ScaledNumberInput.svelte'

  let { config }: { config: ShidasuParams } = $props()
</script>

<section class="bg-white border border-slate-200 rounded-xl p-4">
  <h2 class="font-semibold text-slate-700 text-sm mb-3">役ボーナス</h2>
  <div class="grid grid-cols-2 gap-3">
    <label class="text-xs text-slate-500">
      スートコンプリート(flushBonus)
      <ScaledNumberInput value={config.scoring.flushBonus} onChange={(v) => (config.scoring.flushBonus = v)} />
    </label>
    <label class="text-xs text-slate-500">
      ロイヤルセット(royalSetBonus)
      <ScaledNumberInput value={config.scoring.royalSetBonus} onChange={(v) => (config.scoring.royalSetBonus = v)} />
    </label>
    <label class="text-xs text-slate-500">
      同ランク単位(sameRankBonusUnit)
      <ScaledNumberInput value={config.scoring.sameRankBonusUnit} onChange={(v) => (config.scoring.sameRankBonusUnit = v)} />
    </label>
    <label class="text-xs text-slate-500">
      コンプリートラン(completeRunBonus)
      <ScaledNumberInput value={config.scoring.completeRunBonus} onChange={(v) => (config.scoring.completeRunBonus = v)} />
    </label>
    <label class="text-xs text-slate-500">
      コンプリートラン・同スート加点(completeRunSuitBonus)
      <ScaledNumberInput value={config.scoring.completeRunSuitBonus} onChange={(v) => (config.scoring.completeRunSuitBonus = v)} />
    </label>
    <label class="text-xs text-slate-500">
      列一掃(columnSweepBonus)
      <ScaledNumberInput value={config.scoring.columnSweepBonus} onChange={(v) => (config.scoring.columnSweepBonus = v)} />
    </label>
  </div>
</section>
```

- [ ] **Step 2: `+page.svelte`を更新する**

importに以下を追加する:

```ts
import RoleBonusSection from './RoleBonusSection.svelte'
```

マークアップ内の役ボーナスセクション全体(`<h2 class="font-semibold text-slate-700 text-sm mb-3">役ボーナス</h2>`を含む`<section>`)を

```svelte
      <RoleBonusSection {config} />
```

に置き換える。

この時点で`setScoring`関数の呼び出し箇所がマークアップから完全になくなっているはずなので、`+page.svelte`の`<script>`から`setScoring`関数定義を削除する(`Read`で確認し、他に呼び出し箇所が残っていないことを確認してから削除すること)。

- [ ] **Step 3: 型チェック**

```bash
npm run check
```

Expected: 型エラーなし。`setScoring`削除後に「未使用」等の警告が出ないことも確認する。

- [ ] **Step 4: コミット**

```bash
git add src/routes/admin/shidasu/RoleBonusSection.svelte src/routes/admin/shidasu/+page.svelte
git commit -m "refactor: admin/shidasuの役ボーナスセクションをRoleBonusSection.svelteに分離"
```

---

### Task 5: `StagesSection.svelte`の抽出

**Files:**
- Create: `src/routes/admin/shidasu/StagesSection.svelte`
- Modify: `src/routes/admin/shidasu/+page.svelte`

- [ ] **Step 1: `StagesSection.svelte`を新規作成する**

```svelte
<script lang="ts">
  import type { ShidasuParams } from '$lib/game/shidasu/params'
  import ScaledNumberInput from './ScaledNumberInput.svelte'

  let { config }: { config: ShidasuParams } = $props()

  function addStage() {
    config.stages.push({ name: `STAGE ${config.stages.length + 1}`, modifier: 'none', targets: [100, 200, 300] })
  }

  function removeStage(index: number) {
    if (config.stages.length <= 1) return
    config.stages.splice(index, 1)
  }
</script>

<section class="bg-white border border-slate-200 rounded-xl p-4">
  <div class="flex items-center justify-between mb-3">
    <h2 class="font-semibold text-slate-700 text-sm">ステージ</h2>
    <button onclick={addStage} class="text-xs px-2.5 py-1 rounded border border-dashed border-slate-300 text-slate-500 hover:border-teal-400 hover:text-teal-600">+ ステージ追加</button>
  </div>
  <div class="overflow-x-auto">
    <table class="w-full text-xs border border-slate-200 rounded-lg overflow-hidden">
      <thead>
        <tr class="bg-slate-50 text-slate-500">
          <th class="px-2 py-1.5 text-left">名前</th>
          <th class="px-2 py-1.5 text-left">modifier</th>
          <th class="px-2 py-1.5 text-center">target1</th>
          <th class="px-2 py-1.5 text-center">target2</th>
          <th class="px-2 py-1.5 text-center">target3</th>
          <th class="px-2 py-1.5 w-8"></th>
        </tr>
      </thead>
      <tbody class="divide-y divide-slate-100">
        {#each config.stages as stage, si (si)}
          <tr>
            <td class="px-2 py-1">
              <input type="text" bind:value={stage.name} class="w-full border border-slate-200 rounded px-1.5 py-0.5" />
            </td>
            <td class="px-2 py-1">
              <select bind:value={stage.modifier} class="w-full border border-slate-200 rounded px-1.5 py-0.5">
                <option value="none">none</option>
                <option value="noLoop">noLoop</option>
                <option value="faceLock">faceLock</option>
              </select>
            </td>
            {#each [0, 1, 2] as ti (ti)}
              <td class="px-1 py-1">
                <ScaledNumberInput value={stage.targets[ti]} onChange={(v) => (stage.targets[ti] = v)} />
              </td>
            {/each}
            <td class="px-1 py-1 text-center">
              <button onclick={() => removeStage(si)} disabled={config.stages.length <= 1} class="text-slate-400 hover:text-red-500 disabled:opacity-30 px-1">×</button>
            </td>
          </tr>
        {/each}
      </tbody>
    </table>
  </div>
</section>
```

(元の`setTarget(stageIndex, targetIndex, value)`は`config.stages[stageIndex].targets[targetIndex] = value`をしていた。`{#each config.stages as stage, si}`ループ内の`stage`は`config.stages[si]`への参照そのものなので、`stage.targets[ti] = v`は元と全く同じ代入になる。)

- [ ] **Step 2: `+page.svelte`を更新する**

importに以下を追加する:

```ts
import StagesSection from './StagesSection.svelte'
```

マークアップ内のステージセクション全体(`<h2 class="font-semibold text-slate-700 text-sm">ステージ</h2>`を含む`<section>`)を

```svelte
      <StagesSection {config} />
```

に置き換える。

`+page.svelte`の`<script>`から以下を削除する(すべて`StagesSection.svelte`に移動済みで、他に呼び出し箇所がないことを`Read`で確認してから削除すること):
- `addStage`関数
- `removeStage`関数
- `setTarget`関数

また、この時点で`{#snippet scaledNumberInput(...)}`の呼び出し箇所がマークアップから完全になくなっている(Scoring・RoleBonus・Stagesすべて`ScaledNumberInput`コンポーネントに置き換わった)はずなので、`+page.svelte`から`{#snippet scaledNumberInput(...)}...{/snippet}`定義全体を削除する。

- [ ] **Step 3: 型チェック**

```bash
npm run check
```

Expected: 型エラーなし。未使用関数・未使用スニペットの警告が出ないことを確認する。

- [ ] **Step 4: コミット**

```bash
git add src/routes/admin/shidasu/StagesSection.svelte src/routes/admin/shidasu/+page.svelte
git commit -m "refactor: admin/shidasuのステージセクションをStagesSection.svelteに分離し、未使用のscaledNumberInputスニペットを削除"
```

---

### Task 6: `FlowUiSection.svelte`の抽出

**Files:**
- Create: `src/routes/admin/shidasu/FlowUiSection.svelte`
- Modify: `src/routes/admin/shidasu/+page.svelte`

- [ ] **Step 1: `FlowUiSection.svelte`を新規作成する**

```svelte
<script lang="ts">
  import type { ShidasuParams } from '$lib/game/shidasu/params'

  let { config }: { config: ShidasuParams } = $props()
</script>

<section class="bg-white border border-slate-200 rounded-xl p-4">
  <h2 class="font-semibold text-slate-700 text-sm mb-3">フロー・UI</h2>
  <div class="grid grid-cols-2 gap-3">
    <label class="text-xs text-slate-500">
      1ステージのウェーブ数(wavesPerStage)
      <input type="number" min="1" step="1" bind:value={config.flow.wavesPerStage} class="mt-1 w-full border border-slate-200 rounded px-2 py-1 text-sm" />
    </label>
    <label class="text-xs text-slate-500">
      クリア演出待ち(clearDelayMs)
      <input type="number" min="0" step="10" bind:value={config.flow.clearDelayMs} class="mt-1 w-full border border-slate-200 rounded px-2 py-1 text-sm" />
    </label>
    {#each [0, 1, 2] as ti (ti)}
      <label class="text-xs text-slate-500">
        comboTierThresholds[{ti}]
        <input type="number" min="0" step="1" bind:value={config.ui.comboTierThresholds[ti]} class="mt-1 w-full border border-slate-200 rounded px-2 py-1 text-sm" />
      </label>
    {/each}
    <label class="text-xs text-slate-500">
      チェーン表示: 横にずらす幅(chainCardOffsetX)
      <input type="number" min="0" step="1" bind:value={config.ui.chainCardOffsetX} class="mt-1 w-full border border-slate-200 rounded px-2 py-1 text-sm" />
    </label>
    <label class="text-xs text-slate-500">
      チェーン表示: 1行に表示する枚数(chainCardsPerRow)
      <input type="number" min="1" step="1" bind:value={config.ui.chainCardsPerRow} class="mt-1 w-full border border-slate-200 rounded px-2 py-1 text-sm" />
    </label>
  </div>
</section>
```

- [ ] **Step 2: `+page.svelte`を更新する**

importに以下を追加する:

```ts
import FlowUiSection from './FlowUiSection.svelte'
```

マークアップ内のフロー・UIセクション全体(`<h2 class="font-semibold text-slate-700 text-sm mb-3">フロー・UI</h2>`を含む`<section>`)を

```svelte
      <FlowUiSection {config} />
```

に置き換える。

- [ ] **Step 3: 型チェック**

```bash
npm run check
```

- [ ] **Step 4: コミット**

```bash
git add src/routes/admin/shidasu/FlowUiSection.svelte src/routes/admin/shidasu/+page.svelte
git commit -m "refactor: admin/shidasuのフロー・UIセクションをFlowUiSection.svelteに分離"
```

---

### Task 7: `JsonPanel.svelte`の抽出

**Files:**
- Create: `src/routes/admin/shidasu/JsonPanel.svelte`
- Modify: `src/routes/admin/shidasu/+page.svelte`

**背景:** JSON貼り付け適用時は`config`オブジェクト自体を丸ごと差し替える必要がある(`config = parsed`という再代入)。単純にpropで`config`を渡すだけでは親の変数を再代入できないため、`onApply: (newConfig: ShidasuParams) => void`というコールバックpropを使う。`jsonText`/`jsonError`のstateはこのコンポーネント内に閉じ込める。

- [ ] **Step 1: `JsonPanel.svelte`を新規作成する**

```svelte
<script lang="ts">
  import type { ShidasuParams } from '$lib/game/shidasu/params'

  let { config, onApply }: { config: ShidasuParams; onApply: (newConfig: ShidasuParams) => void } = $props()

  let jsonText = $state('')
  let jsonError = $state<string | null>(null)

  function openJsonPanel() {
    jsonText = JSON.stringify(config, null, 2)
    jsonError = null
  }

  function isValidShidasuParams(value: unknown): value is ShidasuParams {
    if (typeof value !== 'object' || value === null) return false
    const v = value as Record<string, unknown>
    return (
      typeof v.layout === 'object' && v.layout !== null &&
      typeof v.scoring === 'object' && v.scoring !== null &&
      Array.isArray(v.stages) && v.stages.length >= 1 &&
      typeof v.items === 'object' && v.items !== null &&
      typeof v.flow === 'object' && v.flow !== null &&
      typeof v.ui === 'object' && v.ui !== null &&
      typeof v.talismans === 'object' && v.talismans !== null
    )
  }

  function applyJson() {
    try {
      const parsed = JSON.parse(jsonText)
      if (!isValidShidasuParams(parsed)) {
        jsonError = '必須項目(layout/scoring/stages/items/flow/ui)が不足しています'
        return
      }
      onApply(parsed)
      jsonError = null
    } catch {
      jsonError = 'JSONの形式が正しくありません'
    }
  }
</script>

<section class="bg-white border border-slate-200 rounded-xl p-4">
  <div class="flex items-center justify-between mb-3">
    <h2 class="font-semibold text-slate-700 text-sm">JSON入出力</h2>
    <button onclick={openJsonPanel} class="text-xs px-2.5 py-1 rounded border border-slate-200 text-slate-500 hover:border-teal-400 hover:text-teal-600">現在値を表示</button>
  </div>
  <textarea bind:value={jsonText} rows="10" class="w-full border border-slate-200 rounded px-2 py-1.5 text-xs font-mono"></textarea>
  {#if jsonError}
    <p class="text-xs text-red-600 mt-1">{jsonError}</p>
  {/if}
  <button onclick={applyJson} class="mt-2 text-xs px-3 py-1 rounded bg-slate-700 text-white hover:bg-slate-800">貼り付けを適用</button>
</section>
```

- [ ] **Step 2: `+page.svelte`を更新する**

importに以下を追加する:

```ts
import JsonPanel from './JsonPanel.svelte'
```

`<script>`に、`onApply`用のハンドラ関数を追加する(元の`applyJson`が`config = parsed`の後に`showToast('JSONを適用しました')`を呼んでいたのと同じ処理をここで行う):

```ts
function handleJsonApply(newConfig: ShidasuParams) {
  config = newConfig
  showToast('JSONを適用しました')
}
```

`+page.svelte`の`<script>`から以下を削除する(すべて`JsonPanel.svelte`に移動済みであることを`Read`で確認してから削除すること):
- `jsonText`・`jsonError`のstate宣言
- `openJsonPanel`関数
- `isValidShidasuParams`関数
- `applyJson`関数

マークアップ内のJSON入出力セクション全体(`<h2 class="font-semibold text-slate-700 text-sm">JSON入出力</h2>`を含む`<section>`)を

```svelte
      <JsonPanel {config} onApply={handleJsonApply} />
```

に置き換える。

- [ ] **Step 3: 型チェック**

```bash
npm run check
```

Expected: 型エラーなし。未使用state・未使用関数の警告が出ないことを確認する。

- [ ] **Step 4: コミット**

```bash
git add src/routes/admin/shidasu/JsonPanel.svelte src/routes/admin/shidasu/+page.svelte
git commit -m "refactor: admin/shidasuのJSON入出力セクションをJsonPanel.svelteに分離"
```

---

### Task 8: `+page.svelte`の最終整理・全体検証

**Files:**
- Modify: `src/routes/admin/shidasu/+page.svelte` (import整理のみ、ロジック変更なし)

- [ ] **Step 1: `+page.svelte`の残存内容を確認する**

`Read`で現在の`+page.svelte`を確認し、以下の構成のみになっていることを確認する:

**`<script>`内:**
- import: `onMount`/`onDestroy`(svelte)、`DEFAULT_PARAMS`・`ShidasuParams`型(params)、7つのセクションコンポーネント(`LayoutSection`・`ScoringSection`・`RoleBonusSection`・`StagesSection`・`ItemsSection`・`FlowUiSection`・`JsonPanel`)
- state: `config`・`error`・`flash`・`flashTimer`
- 関数: `showToast`・`hasValidationError`(derived)・`targetsNotAscending`(derived)・`loadConfig`・`save`・`resetToDefault`・`handleJsonApply`
- `onMount`/`onDestroy`

**マークアップ内:**
- 戻るリンク・ヘッダー(タイトル・リロード/保存ボタン・バリデーションメッセージ)
- エラー表示
- `{#if config}`ブロック内: `LayoutSection`・`ScoringSection`・`RoleBonusSection`・`StagesSection`・`ItemsSection`・護符設定ページへの案内文・`FlowUiSection`・`JsonPanel`・リセットボタン
- 読み込み中表示
- トースト表示

これ以外の宣言(移し忘れ)が残っていた場合、対応するセクションコンポーネントに移す。

- [ ] **Step 2: `+page.svelte`の行数を確認する**

```bash
wc -l src/routes/admin/shidasu/+page.svelte
```

Expected: 150行程度(381行から大幅に縮小)。

- [ ] **Step 3: 型チェック・ビルド**

```bash
npm run check
npm run build
```

Expected: すべて成功。`admin/shidasu`関連ファイルにエラー・警告がないこと。

- [ ] **Step 4: コミット(差分がある場合のみ)**

```bash
git add src/routes/admin/shidasu/+page.svelte
git commit -m "refactor: admin/shidasu +page.svelteの最終整理"
```

(Step1で修正すべき差分がなければ、このコミットは不要。)

---

### Task 9: ブラウザでの動作確認

**Files:** なし(確認のみ)

- [ ] **Step 1: 開発サーバーを起動する**

```bash
npm run dev
```

- [ ] **Step 2: `/admin/shidasu`を確認する**

ブラウザ(またはPlaywright)で開き、以下を確認する:
- 各セクション(レイアウト・スコアリング・役ボーナス・ステージ・アイテム・フロー/UI)の値を編集できること
- 「保存」を押すと保存され、「リロード」を押すと値が保持されていること
- 「ステージ追加」で新しいステージが増え、「×」ボタンで削除できること(ただし最後の1件は削除できないこと)
- 「JSON入出力」セクションで「現在値を表示」を押すと現在の設定がJSON表示され、テキストを編集して「貼り付けを適用」を押すと設定に反映されること
- 「デフォルトに戻す」で既定値に戻ること
- コンソールエラーが出ていないこと

- [ ] **Step 3: 開発サーバーを停止する**

動作確認が完了したら開発サーバーを終了する。

---

## Self-Review 結果

- **spec coverage:** spec section1(ファイル構成)→Task1-7、section2(propsの設計)→Task1-7全体で反映(config直接ミューテーション、JsonPanelのonApplyコールバック)、section3(検証方針)→Task1-9、受け入れ基準1-6→Task1-9でそれぞれ充足。
- **placeholder scan:** 全タスクで移動対象コードの完全な内容を記載済み。「元の◯◯セクションを移す」のような曖昧な指示ではなく、実際のマークアップ・ロジックを全文記載した。
- **type consistency:** `config: ShidasuParams`という共通propの型・名前は全セクションコンポーネントで一貫させた。`onApply: (newConfig: ShidasuParams) => void`という名前もJsonPanel側・+page.svelte側で一致させた。
