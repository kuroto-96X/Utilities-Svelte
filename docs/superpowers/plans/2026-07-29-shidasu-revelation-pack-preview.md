# 天啓福袋プレビューの詳細フロー拡張 Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** 天啓福袋のプレビュー画面で、手持ちの秘儀・天啓を使用できるようにし、福袋選択終了時に片付けアニメーションを経由してからプレビューを閉じるようにする。

**Architecture:** 既存の「`run.wave`を一時的にプレビューへすり替えて既存の適用関数を呼び、`wave`以外の変更のみ本番`run`へ反映する」パターンをそのまま踏襲する。プレビュー用`PlayArea`に既存の`rites`/`revelations`propsを追加するだけでUIは流用でき、`+page.svelte`側のハンドラ追加・修正のみで完結する。

**Tech Stack:** SvelteKit, Svelte 5 runes, TypeScript

---

## 前提知識(実装者が押さえておくべき既存コード)

対象ファイルは `src/routes/game/shidasu/+page.svelte` のみ。以下は現状の該当箇所(行番号は目安、実装時に検索して正確な位置を確認すること)。

**`revelationPreviewWave`関連の既存state・関数**(325-374行目付近):
```ts
let pendingRevelationTarget = $state<
  | { revelationId: RevelationId; source: 'individual'; slotIndex: number }
  | { revelationId: RevelationId; source: 'pack' }
  | { revelationId: RevelationId; source: 'held' }
  | null
>(null)

let revelationPreviewWave = $state<WaveState | null>(null)
let revelationPreviewSeq = 0
let revelationPreviewWaveKey = $state('')

function beginRevelationPreview() {
  revelationPreviewWave = startRevelationPreview(params, run)
  revelationPreviewWaveKey = `revelation-preview-${++revelationPreviewSeq}`
}
```

**`syncRevelationPreviewWithPhase`(現状、即座にnullにする実装)**(268-272行目付近):
```ts
function syncRevelationPreviewWithPhase() {
  if (run.phase !== 'revelationSelect') {
    revelationPreviewWave = null
  }
}
```

**`handleUseRevelationClick`(現状、常に新規プレビュー生成する実装)**(356-366行目付近):
```ts
function handleUseRevelationClick(revelationId: RevelationId) {
  if (revelationNeedsTarget(revelationId)) {
    pendingRevelationTarget = { revelationId, source: 'held' }
    if (SHOP_FLOW_PHASES.includes(run.phase)) {
      beginRevelationPreview()
    }
    return
  }
  run = useRevelation(params, run, revelationId, null)
  if (run.phase === 'playing') afterAction()
}
```

**`handleTargetColumn`のプレビュー分岐(参考実装、そのまま流用するパターン)**(376-413行目付近):
```ts
function handleTargetColumn(colIndex: number) {
  if (!pendingRevelationTarget) return
  const target = pendingRevelationTarget
  pendingRevelationTarget = null

  if (revelationPreviewWave) {
    const runForPreview = { ...run, wave: revelationPreviewWave }
    let resultRun: RunState
    if (target.source === 'individual') {
      resultRun = buyIndividualRevelationUse(params, runForPreview, target.slotIndex, colIndex)
    } else if (target.source === 'pack') {
      resultRun = pickPackRevelationUse(params, runForPreview, target.revelationId, colIndex)
    } else {
      resultRun = useRevelation(params, runForPreview, target.revelationId, colIndex)
    }
    const previewResultWave = resultRun.wave
    run = { ...resultRun, wave: run.wave }
    revelationPreviewWave = previewResultWave
      ? { ...previewResultWave, status: 'ended', endReason: 'previewDismissed' }
      : null
    return
  }
  // ...(以下、通常のプレイ中のケース、変更不要)
}
```

**プレビュー用`PlayArea`描画ブロック(現状、`rites`/`revelations`propsなし)**(583-610行目付近):
```svelte
{#if revelationPreviewWave}
  <div class="fixed inset-0 z-50 bg-emerald-950 overflow-y-auto">
    <div class="w-full mx-auto" style="max-width:480px;">
      {#if pendingRevelationTarget}
        <div class="px-4 pt-3 pb-1 text-xs bg-indigo-950/80 border-b border-indigo-500/40">
          <div class="font-black text-yellow-300">{revelationName(pendingRevelationTarget.revelationId, params)}</div>
          <div class="text-emerald-100/80 mt-0.5">{revelationDesc(pendingRevelationTarget.revelationId, params)}</div>
        </div>
      {/if}
      <PlayArea
        wave={revelationPreviewWave} {params} modifier={currentModifier} target={0} items={run.items}
        onPlayCard={() => {}} onDraw={() => {}}
        showScoreAndCombo={false} allowDraw={false}
        onCleanupDone={handleRevelationPreviewCleanupDone}
        waveKey={revelationPreviewWaveKey}
        headerExtra={stageRow}
        columnTargetMode={true}
        canTargetColumn={canTargetRevelationColumn}
        onTargetColumn={handleTargetColumn}
        chainAreaExtra={revelationSelectExtra}
      />
    </div>
  </div>
{/if}
```

`PlayArea`コンポーネント(`src/routes/game/shidasu/PlayArea.svelte`)は`rites`/`onUseRite`/`revelations`/`onUseRevelationClick`propsを渡せば、内部で自動的に所持秘儀・天啓のボタン一覧を表示する仕組みが既にある(本番`PlayArea`、565-579行目付近で使用中)。`PlayArea.svelte`自体の変更は不要。

`useRite`(`src/lib/game/shidasu/engine.ts`)のシグネチャ: `useRite(params: ShidasuParams, run: RunState, riteId: RiteId, rand?: () => number): RunState`。`run.phase`がショップ系フェーズかつ`run.wave.status === 'playing'`のときのみ動作し、`{ ...run, wave, rites }`を返す(`wave`は効果適用後のWaveState)。

---

### Task 1: `syncRevelationPreviewWithPhase`を片付けアニメ経由に変更

**Files:**
- Modify: `src/routes/game/shidasu/+page.svelte`(`syncRevelationPreviewWithPhase`関数)

- [ ] **Step 1: 現状の実装を確認する**

`grep -n "function syncRevelationPreviewWithPhase" src/routes/game/shidasu/+page.svelte` で該当箇所を特定し、現状が「前提知識」セクションに記載した実装と一致していることを確認する。

- [ ] **Step 2: 実装を変更する**

```ts
// revelationSelectフェーズを離れた(=福袋での天啓選択が完了しshopへ戻った)場合、
// handleBuyPackで開始したプレビューに片付けアニメーションを発火させる。完了後は
// handleRevelationPreviewCleanupDone経由でnullになる(handleTargetColumnでの
// コラム確定時と同じ経路)。まだrevelationSelectのまま(複数選択の途中)、または
// 既にended状態(片付けアニメ発火済み)なら何もしない。
function syncRevelationPreviewWithPhase() {
  if (run.phase !== 'revelationSelect' && revelationPreviewWave && revelationPreviewWave.status !== 'ended') {
    revelationPreviewWave = { ...revelationPreviewWave, status: 'ended', endReason: 'previewDismissed' }
  }
}
```

- [ ] **Step 3: ビルド・型チェックを実行する**

Run: `npm run build`
Run: `npm run check`
Expected: shidasu関連のエラーなし(既存の`state_referenced_locally`警告のみは許容)

- [ ] **Step 4: 既存の自動テストを実行し、影響がないことを確認する**

Run: `npx vitest run`
Expected: 全件PASS(このタスクは`+page.svelte`のみの変更で`engine.ts`のロジックには触れていないため、既存テストへの影響はない)

- [ ] **Step 5: コミット**

```bash
git add src/routes/game/shidasu/+page.svelte
git commit -m "feat: 福袋選択終了時に片付けアニメーションを経由してプレビューを破棄"
```

---

### Task 2: 秘儀のプレビュー内使用ハンドラを追加

**Files:**
- Modify: `src/routes/game/shidasu/+page.svelte`

- [ ] **Step 1: `handleUseRiteInPreview`を追加する**

`handleUseRite`関数(162-165行目付近)の直後に追加する:

```ts
// 天啓プレビュー表示中、所持秘儀を使用した際に呼ぶ。run.waveを一時的にプレビューへ
// すり替えてuseRiteを適用し、結果のwaveをプレビューへ反映する(秘儀は即時適用でコラム
// 選択が無いため、片付けアニメーションは発火させない)。本番runにはwave以外の変更
// (秘儀の所持数減少)のみ反映する。revelationPreviewWaveがnullの間は何もしない。
function handleUseRiteInPreview(riteId: RiteId) {
  if (!revelationPreviewWave) return
  const runForPreview = { ...run, wave: revelationPreviewWave }
  const resultRun = useRite(params, runForPreview, riteId)
  const previewResultWave = resultRun.wave
  run = { ...resultRun, wave: run.wave }
  if (previewResultWave) {
    revelationPreviewWave = previewResultWave
  }
}
```

(`useRite`は既に`+page.svelte`のimport文に含まれているはず。含まれていなければ`$lib/game/shidasu/engine`からのimportに追加する。)

- [ ] **Step 2: ビルド・型チェックを実行する**

Run: `npm run build`
Run: `npm run check`
Expected: shidasu関連のエラーなし

- [ ] **Step 3: コミット**

```bash
git add src/routes/game/shidasu/+page.svelte
git commit -m "feat: 天啓プレビュー中に所持秘儀を使用できるようにする"
```

(この時点ではまだUIに秘儀ボタンが表示されていないため、動作確認はTask 4で行う。)

---

### Task 3: `handleUseRevelationClick`をプレビュー既存時は再生成しないよう修正

**Files:**
- Modify: `src/routes/game/shidasu/+page.svelte`

- [ ] **Step 1: 現状の実装を確認する**

`grep -n "function handleUseRevelationClick" src/routes/game/shidasu/+page.svelte` で該当箇所を特定し、「前提知識」セクションの記載と一致することを確認する。

- [ ] **Step 2: 実装を変更する**

```ts
function handleUseRevelationClick(revelationId: RevelationId) {
  if (revelationNeedsTarget(revelationId)) {
    pendingRevelationTarget = { revelationId, source: 'held' }
    // 既にプレビュー表示中(天啓福袋選択中)なら再生成しない。再生成すると場札が
    // 意図せず再シャッフルされ、ユーザーに見せていた盤面と食い違ってしまう
    // (福袋の「使用」ボタンで踏んだのと同種の問題)。
    if (SHOP_FLOW_PHASES.includes(run.phase) && !revelationPreviewWave) {
      beginRevelationPreview()
    }
    return
  }
  if (revelationPreviewWave) {
    // プレビュー表示中の即時適用天啓(コラム選択不要)は、プレビュー盤面に対して
    // 適用する。片付けアニメーションは発火させない(秘儀の即時使用と同様)。
    const runForPreview = { ...run, wave: revelationPreviewWave }
    const resultRun = useRevelation(params, runForPreview, revelationId, null)
    const previewResultWave = resultRun.wave
    run = { ...resultRun, wave: run.wave }
    if (previewResultWave) {
      revelationPreviewWave = previewResultWave
    }
    return
  }
  run = useRevelation(params, run, revelationId, null)
  if (run.phase === 'playing') afterAction()
}
```

- [ ] **Step 3: ビルド・型チェックを実行する**

Run: `npm run build`
Run: `npm run check`
Expected: shidasu関連のエラーなし

- [ ] **Step 4: コミット**

```bash
git add src/routes/game/shidasu/+page.svelte
git commit -m "feat: 天啓プレビュー中の保有天啓使用が既存プレビューを再生成しないよう修正"
```

---

### Task 4: プレビュー用PlayAreaに秘儀・天啓の使用UIを追加

**Files:**
- Modify: `src/routes/game/shidasu/+page.svelte`

- [ ] **Step 1: プレビュー用`PlayArea`呼び出しに`rites`/`onUseRite`/`revelations`/`onUseRevelationClick`を追加する**

「前提知識」セクションに記載したプレビュー用`PlayArea`ブロック(583-610行目付近)を以下のように変更する:

```svelte
{#if revelationPreviewWave}
  <div class="fixed inset-0 z-50 bg-emerald-950 overflow-y-auto">
    <div class="w-full mx-auto" style="max-width:480px;">
      {#if pendingRevelationTarget}
        <div class="px-4 pt-3 pb-1 text-xs bg-indigo-950/80 border-b border-indigo-500/40">
          <div class="font-black text-yellow-300">{revelationName(pendingRevelationTarget.revelationId, params)}</div>
          <div class="text-emerald-100/80 mt-0.5">{revelationDesc(pendingRevelationTarget.revelationId, params)}</div>
        </div>
      {/if}
      <PlayArea
        wave={revelationPreviewWave} {params} modifier={currentModifier} target={0} items={run.items}
        onPlayCard={() => {}} onDraw={() => {}}
        showScoreAndCombo={false} allowDraw={false}
        onCleanupDone={handleRevelationPreviewCleanupDone}
        waveKey={revelationPreviewWaveKey}
        headerExtra={stageRow}
        rites={run.rites} onUseRite={handleUseRiteInPreview}
        revelations={run.revelations} onUseRevelationClick={handleUseRevelationClick}
        columnTargetMode={true}
        canTargetColumn={canTargetRevelationColumn}
        onTargetColumn={handleTargetColumn}
        chainAreaExtra={revelationSelectExtra}
      />
    </div>
  </div>
{/if}
```

(変更点は`rites={run.rites} onUseRite={handleUseRiteInPreview}` `revelations={run.revelations} onUseRevelationClick={handleUseRevelationClick}`の追加のみ。)

- [ ] **Step 2: ビルド・型チェックを実行する**

Run: `npm run build`
Run: `npm run check`
Expected: shidasu関連のエラーなし

- [ ] **Step 3: 既存の自動テストを実行する**

Run: `npx vitest run`
Expected: 全件PASS

- [ ] **Step 4: コミット**

```bash
git add src/routes/game/shidasu/+page.svelte
git commit -m "feat: 天啓プレビュー画面に所持秘儀・天啓の使用ボタンを表示"
```

---

### Task 5: ブラウザでの動作確認

**Files:** なし(確認のみ)

- [ ] **Step 1: 開発サーバーを起動する**

Run: `npm run dev`

- [ ] **Step 2: 以下のシナリオを目視確認する**

1. ショップで天啓福袋(複数選択できるもの)を購入し、プレビュー盤面が表示される
2. プレビュー盤面の下部に所持秘儀・天啓のボタンが表示されている(所持していない場合は事前に護符/秘儀/天啓を入手してから確認する)
3. 所持秘儀のボタンを押すと、即座にプレビュー盤面に効果が反映される(片付けアニメーションは発火しない、場札の配置は変わらず内容だけ変化する)
4. 所持天啓(コラム選択不要なもの、例: しん・び・き・と)のボタンを押すと、即座にプレビュー盤面に反映される
5. 所持天啓(コラム選択必要なもの、例: 甲・乙・丁・戊)のボタンを押すと、同じプレビュー盤面のままコラム選択待ちになり(場札が再シャッフルされない)、列を選ぶと効果が適用される
6. 福袋の候補一覧から天啓を選び(「使用」または「温存」)、選択可能数が0になり自動的に選択が終了すると、片付けアニメーションが再生されてからショップ画面に戻る
7. 福袋の候補一覧が残っている状態で「選択を終える」ボタンを押すと、片付けアニメーションが再生されてからショップ画面に戻る
8. プレイ中(`playing`フェーズ)に保有天啓を使用する既存の動作に影響が出ていないこと

- [ ] **Step 3: 問題があれば修正し、Step 1から再確認する**
