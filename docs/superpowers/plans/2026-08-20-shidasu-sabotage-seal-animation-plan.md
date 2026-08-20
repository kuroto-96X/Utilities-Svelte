# 妨害行動アニメーション(グループA: 封印系) Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** 封印系の妨害行動5個(`talismanSeal`・`riteSeal`・`revelationOracleSeal`・`roleSeal`・`comboCap`)に発動演出(フラッシュ+シェイク)を実装し、常設表示が無かった`talismanSeal`・`comboCap`に常設表示を新設する。

**Architecture:** `PlayArea.svelte`に`sealFlashTarget`という単一の`$state`を持たせ、`wave.lastSabotage`の変化を検知してこれをセットする。`PlayArea`内の要素(秘儀ボタン・天啓ボタン・コンボ表示)はこの`$state`を直接参照する。`PlayArea`外(`+page.svelte`側)の要素(護符バッジ・役ステータスパネル)は、新規コールバックprops`onSealFlashChange`経由で値を受け取り、`+page.svelte`側の`$state`に反映してから子コンポーネントへ渡す。

**Tech Stack:** SvelteKit, Svelte 5 runes (`$state`, `$effect.pre`), TypeScript, Vitest

参照設計: `docs/superpowers/specs/2026-08-20-shidasu-sabotage-seal-animation-design.md`

---

### Task 1: 共通CSS(フラッシュ+シェイク)ファイルの新規作成

**Files:**
- Create: `src/routes/game/shidasu/sabotageAnimations.css`
- Modify: `src/routes/game/shidasu/PlayArea.svelte:15`(importの直後)

- [ ] **Step 1: CSSファイルを作成**

`src/routes/game/shidasu/sabotageAnimations.css`を新規作成する:

```css
/* 妨害行動「封印系」発動時、対象UI要素(護符バッジ・秘儀/天啓ボタン・役ステータス行・
   コンボ表示)に適用するフラッシュ+シェイク演出。クラス名・keyframes名とも
   shidasu-接頭辞を付け、他ページ(Solitaire等)のグローバルCSSとの衝突を避ける。 */
@keyframes shidasu-seal-flash {
  0% { transform: translateX(0); filter: brightness(1); }
  15% { transform: translateX(-4px); filter: brightness(2.2); }
  30% { transform: translateX(4px); }
  45% { transform: translateX(-3px); }
  60% { transform: translateX(3px); }
  100% { transform: translateX(0); filter: brightness(1); }
}

.shidasu-seal-flash {
  animation: shidasu-seal-flash 0.5s ease-out;
}
```

- [ ] **Step 2: PlayArea.svelteでimportする**

`src/routes/game/shidasu/PlayArea.svelte`の15行目(`import { CARD_BACK_STYLE } from './cardBackStyle'`)の直後に追加する:

```ts
  import './sabotageAnimations.css'
```

- [ ] **Step 3: 型チェックとビルドを実行**

Run: `npm run check`
Run: `npm run build`
Expected: どちらもエラーなし(CSSファイル追加のみなので、既存の挙動に影響しない)

- [ ] **Step 4: コミット**

```bash
git add src/routes/game/shidasu/sabotageAnimations.css src/routes/game/shidasu/PlayArea.svelte
git commit -m "feat: 妨害行動封印系のフラッシュ+シェイク演出用CSSを追加する"
```

---

### Task 2: PlayArea.svelteにsealFlashTarget状態と検知ロジックを追加する

**Files:**
- Modify: `src/routes/game/shidasu/PlayArea.svelte:5`(型import)
- Modify: `src/routes/game/shidasu/PlayArea.svelte:361`(`stockShuffleActive`宣言の直後、状態追加)
- Modify: `src/routes/game/shidasu/PlayArea.svelte:389`(`anyAnimationActive`)
- Modify: `src/routes/game/shidasu/PlayArea.svelte:439-449`(`$effect.pre`、`lastSabotage`検知ブロック)
- Modify: `src/routes/game/shidasu/PlayArea.svelte`(props定義、`onSealFlashChange`追加)

- [ ] **Step 1: 型importに`RoleName`を追加**

`src/routes/game/shidasu/PlayArea.svelte`の5行目:

```ts
  import type { WaveState, StageModifier, ItemId, RiteId, RevelationId, RelicId, Card, PlayCardResult, ScoreGain } from '$lib/game/shidasu/types'
```

を以下に置き換える:

```ts
  import type { WaveState, StageModifier, ItemId, RiteId, RevelationId, RelicId, Card, PlayCardResult, ScoreGain, RoleName } from '$lib/game/shidasu/types'
```

- [ ] **Step 2: `sealFlashTarget`型・状態・トリガー関数を追加**

`src/routes/game/shidasu/PlayArea.svelte`361行目(`let stockShuffleActive = $state(false)`)の直後、`startStockShuffleAnimation`関数の直前に以下を追加する:

```ts

  // 妨害行動「封印系」(talismanSeal・riteSeal・revelationOracleSeal・roleSeal・comboCap)
  // 発動時のフラッシュ+シェイク演出用。wave.activeSealのうち、今回の対象5種類
  // (talismanHidden・roleBiasは対象外)。activeSeal自体の型をそのまま再利用し、
  // 型の重複定義を避ける。+page.svelte側からも同じ型をimportして使うため、exportする。
  export type SealFlashTarget = Exclude<WaveState['activeSeal'], { kind: 'talismanHidden' } | { kind: 'roleBias'; buffed: RoleName[]; nerfed: RoleName[]; multiplier: number } | null>

  let sealFlashTarget = $state<SealFlashTarget | null>(null)
  let sealFlashActive = $state(false)

  // sealFlashActiveは関数の先頭で同期的にtrueへ切り替える(CLAUDE.mdの「移動アニメーション
  // 実装時の注意」・discardPurgeActive/stockShuffleActiveと同じ原則)。500ms後に演出を終了し、
  // sealFlashTargetをnullへ戻す(対象要素は以後、常設表示側の判定に切り替わる)。
  function startSealFlashAnimation(target: SealFlashTarget) {
    sealFlashActive = true
    sealFlashTarget = target
    onSealFlashChange?.(target)
    const timer = setTimeout(() => {
      sealFlashActive = false
      sealFlashTarget = null
      onSealFlashChange?.(null)
    }, 500)
    dealTimers.push(timer)
  }
```

`export type`(型のみのexport)は、コンポーネントのprops化とは扱いが異なる。他ファイルから`import type { SealFlashTarget } from './PlayArea.svelte'`という形で純粋に型だけをimportできる(`export const`/`export let`のような値のexportとは違い、propsとして扱われない)。このプロジェクトでは初めての用法だが、Svelte公式でサポートされている標準的な型エクスポート方法。Task 5で`+page.svelte`側からこの型をimportする。

- [ ] **Step 3: `anyAnimationActive`に`sealFlashActive`を含める**

389行目の`anyAnimationActive`定義:

```ts
  let anyAnimationActive = $derived(playingAnimation !== null || scoreReveal !== null || cleanupAnimation !== null || chainResetAnimation !== null || dealAnimationActive || sabotageRedistributeAnimation !== null || sabotageAnimatingColumns.size > 0 || flippingCards.length > 0 || discardPurgeActive || stockShuffleActive)
```

を以下に置き換える:

```ts
  let anyAnimationActive = $derived(playingAnimation !== null || scoreReveal !== null || cleanupAnimation !== null || chainResetAnimation !== null || dealAnimationActive || sabotageRedistributeAnimation !== null || sabotageAnimatingColumns.size > 0 || flippingCards.length > 0 || discardPurgeActive || stockShuffleActive || sealFlashActive)
```

- [ ] **Step 4: `$effect.pre`で封印系5種の発動を検知する**

439-449行目の既存ブロック:

```ts
  let previousSabotageSeq = wave.lastSabotage?.seq ?? 0
  $effect.pre(() => {
    const current = wave.lastSabotage
    if (!current || current.seq === previousSabotageSeq) return
    previousSabotageSeq = current.seq
    if ((current.id === 'tableauFullReturn' || current.id === 'columnReturn') && current.affectedCols) {
      startSabotageRedistributeAnimation(current.affectedCols)
    } else if ((current.id === 'stockPurge' || current.id === 'stockPurgeSmall') && current.purgedToDiscardCount) {
      startStockPurgeAnimation(current.purgedToDiscardCount)
    }
  })
```

を以下に置き換える(既存の2つの分岐はそのまま残し、3つ目の`else if`を追加する):

```ts
  let previousSabotageSeq = wave.lastSabotage?.seq ?? 0
  $effect.pre(() => {
    const current = wave.lastSabotage
    if (!current || current.seq === previousSabotageSeq) return
    previousSabotageSeq = current.seq
    if ((current.id === 'tableauFullReturn' || current.id === 'columnReturn') && current.affectedCols) {
      startSabotageRedistributeAnimation(current.affectedCols)
    } else if ((current.id === 'stockPurge' || current.id === 'stockPurgeSmall') && current.purgedToDiscardCount) {
      startStockPurgeAnimation(current.purgedToDiscardCount)
    } else if (current.id === 'talismanSeal' || current.id === 'riteSeal' || current.id === 'revelationOracleSeal' || current.id === 'roleSeal' || current.id === 'comboCap') {
      if (wave.activeSeal && wave.activeSeal.kind !== 'talismanHidden' && wave.activeSeal.kind !== 'roleBias') {
        startSealFlashAnimation(wave.activeSeal)
      }
    }
  })
```

`current.id`がこの5種類のいずれかであれば、`applySabotageEffect`の実装上`wave.activeSeal`は必ず対応する`kind`(`talisman`/`rite`/`revelationOrOracle`/`role`/`comboCap`のいずれか)になる。`kind !== 'talismanHidden' && kind !== 'roleBias'`のガードは、TypeScriptの型を`SealFlashTarget`へ絞り込むためのものであり、実行時にこの2つのkindになることは無い(`talismanHidden`は`talismanShuffle`専用、`roleBias`は`roleBias`という別の妨害行動専用)。

- [ ] **Step 5: `onSealFlashChange`コールバックpropsを追加**

`src/routes/game/shidasu/PlayArea.svelte`のprops定義(`let { ... }: { ... } = $props()`)を探す。`onCleanupDone`が定義されている行(分割代入部分・型定義部分の両方)を確認し、その隣に追加する。まず現在の分割代入部分を確認する:

```bash
grep -n "onScoreRevealDone, waveKey, onCleanupDone," src/routes/game/shidasu/PlayArea.svelte
```

この行(28行目付近)を以下に置き換える:

```ts
    onScoreRevealDone, waveKey, onCleanupDone, onSealFlashChange,
```

型定義部分(`onCleanupDone?: () => void`、55行目付近)の直後に追加する:

```ts
    onSealFlashChange?: (target: SealFlashTarget | null) => void
```

**注意:** `SealFlashTarget`型はStep 2で`export type`として定義したため、同一ファイル内であれば定義位置に関わらず参照できる(TypeScriptの型エイリアスは巻き上げられ、実行順序に依存しない)。Step 2で追加した型定義が361行目付近(props定義より後)にあっても、props型注釈から問題なく参照できる。

- [ ] **Step 6: 型チェックを実行**

Run: `npm run check`
Expected: エラーなし

- [ ] **Step 7: コミット**

```bash
git add src/routes/game/shidasu/PlayArea.svelte
git commit -m "feat: PlayAreaに封印系妨害行動のフラッシュ演出状態と検知ロジックを追加する"
```

---

### Task 3: 秘儀ボタン・天啓ボタンにフラッシュ演出を適用する

**Files:**
- Modify: `src/routes/game/shidasu/PlayArea.svelte`(秘儀ボタンブロック、`{#if rites.length > 0}`)
- Modify: `src/routes/game/shidasu/PlayArea.svelte`(天啓ボタンブロック、`{#if revelations.length > 0}`)

- [ ] **Step 1: 秘儀ボタンにフラッシュクラスを適用**

`src/routes/game/shidasu/PlayArea.svelte`の秘儀ボタンブロック:

```svelte
{#if rites.length > 0}
  <div class="px-4 pb-4 flex items-center gap-2">
    {#each rites as riteId, i (i)}
      {@const usable = canUseRite(params, wave, riteId) && !anyAnimationActive && !disableRites}
      <button
        type="button"
        onclick={() => onUseRite?.(riteId)}
        disabled={!usable}
        title={riteDesc(riteId, params)}
        style="font-family: 'ShidasuRunic', sans-serif;"
        class="w-10 h-10 rounded-lg border-2 flex items-center justify-center text-xl font-black transition-transform active:scale-95 {usable ? 'bg-fuchsia-900 border-fuchsia-500 text-fuchsia-100 hover:bg-fuchsia-800' : 'bg-slate-800 border-slate-700 text-slate-600 cursor-not-allowed'}"
      >{params.rites[riteId].name}</button>
    {/each}
  </div>
{/if}
```

を以下に置き換える(`{@const flashing}`の追加と、`class`属性に`{flashing ? 'shidasu-seal-flash' : ''}`を追加):

```svelte
{#if rites.length > 0}
  <div class="px-4 pb-4 flex items-center gap-2">
    {#each rites as riteId, i (i)}
      {@const usable = canUseRite(params, wave, riteId) && !anyAnimationActive && !disableRites}
      {@const flashing = sealFlashTarget?.kind === 'rite' && sealFlashTarget.id === riteId}
      <button
        type="button"
        onclick={() => onUseRite?.(riteId)}
        disabled={!usable}
        title={riteDesc(riteId, params)}
        style="font-family: 'ShidasuRunic', sans-serif;"
        class="w-10 h-10 rounded-lg border-2 flex items-center justify-center text-xl font-black transition-transform active:scale-95 {flashing ? 'shidasu-seal-flash' : ''} {usable ? 'bg-fuchsia-900 border-fuchsia-500 text-fuchsia-100 hover:bg-fuchsia-800' : 'bg-slate-800 border-slate-700 text-slate-600 cursor-not-allowed'}"
      >{params.rites[riteId].name}</button>
    {/each}
  </div>
{/if}
```

- [ ] **Step 2: 天啓ボタンにフラッシュクラスを適用**

`src/routes/game/shidasu/PlayArea.svelte`の天啓ボタンブロック:

```svelte
{#if revelations.length > 0}
  <div class="px-4 pb-4 flex items-center gap-2">
    {#each revelations as revelationId, i (i)}
      {@const usable = canUseRevelation(params, wave, revelationId, relics) && !anyAnimationActive}
      <button
        type="button"
        onclick={() => onUseRevelationClick?.(revelationId)}
        disabled={!usable}
        title={revelationDesc(revelationId, params)}
        class="w-10 h-10 rounded-lg border-2 flex items-center justify-center text-lg font-black transition-transform active:scale-95 {usable ? 'bg-indigo-900 border-indigo-500 text-indigo-100 hover:bg-indigo-800' : 'bg-slate-800 border-slate-700 text-slate-600 cursor-not-allowed'}"
      >{params.revelations[revelationId].name}</button>
    {/each}
  </div>
{/if}
```

を以下に置き換える:

```svelte
{#if revelations.length > 0}
  <div class="px-4 pb-4 flex items-center gap-2">
    {#each revelations as revelationId, i (i)}
      {@const usable = canUseRevelation(params, wave, revelationId, relics) && !anyAnimationActive}
      {@const flashing = sealFlashTarget?.kind === 'revelationOrOracle' && sealFlashTarget.ref.kind === 'revelation' && sealFlashTarget.ref.id === revelationId}
      <button
        type="button"
        onclick={() => onUseRevelationClick?.(revelationId)}
        disabled={!usable}
        title={revelationDesc(revelationId, params)}
        class="w-10 h-10 rounded-lg border-2 flex items-center justify-center text-lg font-black transition-transform active:scale-95 {flashing ? 'shidasu-seal-flash' : ''} {usable ? 'bg-indigo-900 border-indigo-500 text-indigo-100 hover:bg-indigo-800' : 'bg-slate-800 border-slate-700 text-slate-600 cursor-not-allowed'}"
      >{params.revelations[revelationId].name}</button>
    {/each}
  </div>
{/if}
```

- [ ] **Step 3: 型チェックとビルドを実行**

Run: `npm run check`
Run: `npm run build`
Expected: どちらもエラーなし

- [ ] **Step 4: コミット**

```bash
git add src/routes/game/shidasu/PlayArea.svelte
git commit -m "feat: 秘儀・天啓ボタンに封印発動時のフラッシュ演出を適用する"
```

---

### Task 4: comboCapの常設表示(分数形式)とフラッシュ演出を実装する

**Files:**
- Modify: `src/routes/game/shidasu/PlayArea.svelte:1170-1174`(コンボ表示)

- [ ] **Step 1: コンボ表示にcomboCap常設表示とフラッシュを追加**

`src/routes/game/shidasu/PlayArea.svelte`のコンボ表示ブロック:

```svelte
      <div class="text-right transition-transform origin-bottom-right {comboScale[displayComboTier]}">
        <div class="text-xs text-emerald-300/70 tracking-widest">COMBO</div>
        <div class="text-3xl font-black italic tabular-nums leading-none {comboColor[displayComboTier]}">
          {wave.combo}{#if wave.baseComboCount > 0}<span class="text-lg not-italic ml-1 text-emerald-300/80">+{wave.baseComboCount}</span>{/if}
        </div>
      </div>
```

を以下に置き換える:

```svelte
      <div class="text-right transition-transform origin-bottom-right {comboScale[displayComboTier]}">
        <div class="text-xs text-emerald-300/70 tracking-widest">COMBO</div>
        {@const comboCapMax = wave.activeSeal?.kind === 'comboCap' ? wave.activeSeal.max : null}
        {@const comboCapFlashing = sealFlashTarget?.kind === 'comboCap'}
        <div class="text-3xl font-black italic tabular-nums leading-none {comboCapFlashing ? 'shidasu-seal-flash' : ''} {comboCapMax !== null ? 'text-rose-400' : comboColor[displayComboTier]}">
          {wave.combo}{#if wave.baseComboCount > 0}<span class="text-lg not-italic ml-1 text-emerald-300/80">+{wave.baseComboCount}</span>{/if}{#if comboCapMax !== null}<span class="text-lg not-italic ml-1 text-rose-300">/{comboCapMax}</span>{/if}
        </div>
      </div>
```

`comboCapMax !== null`の間は上限中であることを示す赤系の色(`text-rose-400`)を、通常のtier別色(`comboColor[displayComboTier]`)より優先する。上限が外れれば(`activeSeal`が`comboCap`でなくなれば)通常表示に戻る。

- [ ] **Step 2: 型チェックとビルドを実行**

Run: `npm run check`
Run: `npm run build`
Expected: どちらもエラーなし

- [ ] **Step 3: コミット**

```bash
git add src/routes/game/shidasu/PlayArea.svelte
git commit -m "feat: コンボ頭打ち中の分数表示とフラッシュ演出を実装する"
```

---

### Task 5: +page.svelteでsealFlashTargetを受け取り、護符バッジに反映する

**Files:**
- Modify: `src/routes/game/shidasu/+page.svelte`(状態宣言、`sealedRoleEffect`宣言の付近)
- Modify: `src/routes/game/shidasu/+page.svelte:540-554`(`itemBadges`スニペット)
- Modify: `src/routes/game/shidasu/+page.svelte`(`<PlayArea>`呼び出し、684行目付近)

**注意:** このタスクを開始する前に、Task 2〜4の変更(コミット済み)により`+page.svelte`684行目付近の`<PlayArea>`呼び出しや`itemBadges`スニペットの正確な行番号がズレている可能性がある。以下のコマンドで実際の行番号を確認してから作業すること:

```bash
grep -n "let sealedRoleEffect\|{#snippet itemBadges()}\|headerExtra={stageRow} extraFooter={itemBadges}" src/routes/game/shidasu/+page.svelte
```

- [ ] **Step 1: `sealFlashTarget`用の`$state`を追加**

`src/routes/game/shidasu/+page.svelte`の冒頭、`PlayArea`のimport文(`import PlayArea from './PlayArea.svelte'`のような行)を探す:

```bash
grep -n "import PlayArea from" src/routes/game/shidasu/+page.svelte
```

その行の直後に、Task 2でPlayArea.svelteからexportした`SealFlashTarget`型をimportする行を追加する(型の重複定義を避けるため、`+page.svelte`側では独自に型を書かずPlayAreaからimportする):

```ts
  import type { SealFlashTarget } from './PlayArea.svelte'
```

続けて、`let sealedRoleEffect = $derived(resolveSealedRoleEffect(wave?.activeSeal ?? null))`の行の直後に追加する:

```ts

  // PlayArea側で発動検知したsealFlashTarget(封印系妨害行動のフラッシュ演出対象)を
  // 受け取って保持する。itemBadges(護符バッジ)・RoleStatusPanel(役ステータス)は
  // PlayAreaの外側にあるため、コールバックprops経由で値を受け渡す。
  let sealFlashTarget = $state<SealFlashTarget | null>(null)
```

- [ ] **Step 2: `<PlayArea>`呼び出しに`onSealFlashChange`を渡す**

`src/routes/game/shidasu/+page.svelte`の本編用`<PlayArea>`呼び出し(`headerExtra={stageRow} extraFooter={itemBadges}`を含む行の周辺、天啓プレビュー用ではない方)に、以下のpropsを追加する:

```svelte
    onSealFlashChange={(target) => { sealFlashTarget = target }}
```

**注意:** 天啓プレビュー用の`<PlayArea>`呼び出し(`disableRites={true}`を渡している方)には追加不要。封印系妨害行動は`playing`フェーズ中のみ発動し、天啓プレビュー中には発動しないため。

- [ ] **Step 3: `itemBadges`スニペットに`talismanSealed`表示を追加**

`src/routes/game/shidasu/+page.svelte`の`itemBadges`スニペット内、護符バッジ部分:

```svelte
      {#each [...new Set(run.items)] as id (id)}
        {@const n = run.items.filter(x => x === id).length}
        {@const talismanHidden = wave?.activeSeal?.kind === 'talismanHidden'}
        <span
          class="text-xs rounded px-1.5 py-0.5 {highlightedItemId === id ? 'ring-2 ring-yellow-400' : ''} {talismanHidden ? 'border' : 'bg-emerald-900 text-yellow-200/90 border border-yellow-600/40'}"
          style={talismanHidden ? 'background:#1c1917; color:#78350f; border-color: rgba(217,119,6,0.5); background-image: repeating-linear-gradient(45deg,transparent,transparent 5px,rgba(217,119,6,0.35) 5px,rgba(217,119,6,0.35) 6px);' : ''}
          title={talismanHidden ? '護符並び替え: 次の妨害発動まで内容が見えない' : itemDesc(id, params)}
        >
          {talismanHidden ? '？？？' : itemName(id, params)}{n > 1 ? `×${n}` : ''}
        </span>
      {/each}
```

を以下に置き換える(`talismanSealed`判定の追加、対象バッジへのストライプ適用とフラッシュクラス適用):

```svelte
      {#each [...new Set(run.items)] as id (id)}
        {@const n = run.items.filter(x => x === id).length}
        {@const talismanHidden = wave?.activeSeal?.kind === 'talismanHidden'}
        {@const talismanSealed = wave?.activeSeal?.kind === 'talisman' && wave.activeSeal.id === id}
        {@const talismanFlashing = sealFlashTarget?.kind === 'talisman' && sealFlashTarget.id === id}
        <span
          class="text-xs rounded px-1.5 py-0.5 {highlightedItemId === id ? 'ring-2 ring-yellow-400' : ''} {talismanFlashing ? 'shidasu-seal-flash' : ''} {talismanHidden || talismanSealed ? 'border' : 'bg-emerald-900 text-yellow-200/90 border border-yellow-600/40'}"
          style={talismanHidden || talismanSealed ? 'background:#1c1917; color:#78350f; border-color: rgba(217,119,6,0.5); background-image: repeating-linear-gradient(45deg,transparent,transparent 5px,rgba(217,119,6,0.35) 5px,rgba(217,119,6,0.35) 6px);' : ''}
          title={talismanHidden ? '護符並び替え: 次の妨害発動まで内容が見えない' : talismanSealed ? '護符封印: 次の妨害発動まで効果が無効' : itemDesc(id, params)}
        >
          {talismanHidden ? '？？？' : itemName(id, params)}{n > 1 ? `×${n}` : ''}
        </span>
      {/each}
```

`talismanHidden`は名前を「？？？」に隠す(既存仕様)が、`talismanSealed`は名前を隠さず背景のみストライプにする(design doc記載の通り)。`activeSeal`は同時に1つしか存在しないため、`talismanHidden`と`talismanSealed`が同時にtrueになることはない。

`shidasu-seal-flash`クラスは`PlayArea.svelte`で`import './sabotageAnimations.css'`しているグローバル(非scoped)CSSのため、`+page.svelte`側でも同じクラス名で参照できる(`PlayArea`が同じページにマウントされている限り、CSSはバンドルに含まれる)。

- [ ] **Step 4: 型チェックとビルドを実行**

Run: `npm run check`
Run: `npm run build`
Expected: どちらもエラーなし

- [ ] **Step 5: コミット**

```bash
git add src/routes/game/shidasu/+page.svelte
git commit -m "feat: 護符封印の常設表示(斜めストライプ)とフラッシュ演出を実装する"
```

---

### Task 6: RoleStatusPanelに役封印・神託封印のフラッシュ演出を追加する

**Files:**
- Modify: `src/routes/game/shidasu/RoleStatusPanel.svelte`
- Modify: `src/routes/game/shidasu/+page.svelte`(`<RoleStatusPanel>`呼び出し)

`RoleStatusPanel.svelte`は既に`sealedRoleEffect`経由で対象役を赤字表示にする常設表示を持っている(`effectiveLevel`関数、`sealed`変数)。この常設表示はTask変更不要。今回追加するのはフラッシュ演出のみ。

- [ ] **Step 1: `RoleStatusPanel.svelte`に`flashingRoles` propsを追加**

`src/routes/game/shidasu/RoleStatusPanel.svelte`の現在の内容:

```svelte
<script lang="ts">
  import type { ShidasuParams } from '$lib/game/shidasu/params'
  import type { RoleName } from '$lib/game/shidasu/types'
  import type { SealedRoleEffect } from '$lib/game/shidasu/engine'
  import { ROLE_LIST, roleBasePoint } from '$lib/game/shidasu/roles'

  let { params, oracleLevels, sealedRoleEffect = { zeroRoles: [], oracleBaselineRole: null } }: {
    params: ShidasuParams
    oracleLevels: Record<RoleName, number>
    sealedRoleEffect?: SealedRoleEffect
  } = $props()

  // 妨害「役封印」「天啓封印(対象がoracleの場合)」中は、run.oracleLevelsそのものは
  // 書き換わらないまま実際のスコアリングだけが変化する。表示が実態と食い違わないよう、
  // ここでも同じ実効レベルを算出して使う(実際の適用ロジックはengine.tsのresolveSealedRoleEffect)。
  function effectiveLevel(roleName: RoleName, storedLevel: number): number {
    if (sealedRoleEffect.zeroRoles.includes(roleName)) return 0
    if (sealedRoleEffect.oracleBaselineRole === roleName) return 1
    const mult = sealedRoleEffect.multipliers?.[roleName]
    return mult !== undefined ? storedLevel * mult : storedLevel
  }
</script>

<div class="px-4 pb-4">
  <div class="bg-emerald-900/50 border border-emerald-800 rounded-lg p-3 space-y-1.5">
    <div class="text-xs font-bold text-emerald-300/70 tracking-widest mb-1">役ステータス</div>
    {#each ROLE_LIST as role (role.name)}
      {@const storedLevel = oracleLevels[role.name]}
      {@const level = effectiveLevel(role.name, storedLevel)}
      {@const score = roleBasePoint(params, role.name) * level}
      {@const sealed = level !== storedLevel}
      <div class="flex items-center justify-between text-xs gap-2">
        <div class="flex items-center gap-1.5 min-w-0">
          <span class="font-black text-amber-50 shrink-0">{role.label}</span>
          <span class="text-emerald-300/60 truncate">{role.desc}</span>
        </div>
        <div class="shrink-0 text-right">
          <span class="font-bold {sealed ? 'text-rose-400' : 'text-yellow-300'}">Lv.{level}</span>
          <span class="ml-1 {sealed ? 'text-rose-300' : 'text-emerald-100/80'}">{score}点</span>
        </div>
      </div>
    {/each}
  </div>
</div>
```

これを以下に置き換える(`flashingRoles` propsの追加と、対象行への`shidasu-seal-flash`クラス適用):

```svelte
<script lang="ts">
  import type { ShidasuParams } from '$lib/game/shidasu/params'
  import type { RoleName } from '$lib/game/shidasu/types'
  import type { SealedRoleEffect } from '$lib/game/shidasu/engine'
  import { ROLE_LIST, roleBasePoint } from '$lib/game/shidasu/roles'

  let { params, oracleLevels, sealedRoleEffect = { zeroRoles: [], oracleBaselineRole: null }, flashingRoles = [] }: {
    params: ShidasuParams
    oracleLevels: Record<RoleName, number>
    sealedRoleEffect?: SealedRoleEffect
    flashingRoles?: RoleName[]
  } = $props()

  // 妨害「役封印」「天啓封印(対象がoracleの場合)」中は、run.oracleLevelsそのものは
  // 書き換わらないまま実際のスコアリングだけが変化する。表示が実態と食い違わないよう、
  // ここでも同じ実効レベルを算出して使う(実際の適用ロジックはengine.tsのresolveSealedRoleEffect)。
  function effectiveLevel(roleName: RoleName, storedLevel: number): number {
    if (sealedRoleEffect.zeroRoles.includes(roleName)) return 0
    if (sealedRoleEffect.oracleBaselineRole === roleName) return 1
    const mult = sealedRoleEffect.multipliers?.[roleName]
    return mult !== undefined ? storedLevel * mult : storedLevel
  }
</script>

<div class="px-4 pb-4">
  <div class="bg-emerald-900/50 border border-emerald-800 rounded-lg p-3 space-y-1.5">
    <div class="text-xs font-bold text-emerald-300/70 tracking-widest mb-1">役ステータス</div>
    {#each ROLE_LIST as role (role.name)}
      {@const storedLevel = oracleLevels[role.name]}
      {@const level = effectiveLevel(role.name, storedLevel)}
      {@const score = roleBasePoint(params, role.name) * level}
      {@const sealed = level !== storedLevel}
      {@const flashing = flashingRoles.includes(role.name)}
      <div class="flex items-center justify-between text-xs gap-2 {flashing ? 'shidasu-seal-flash' : ''}">
        <div class="flex items-center gap-1.5 min-w-0">
          <span class="font-black text-amber-50 shrink-0">{role.label}</span>
          <span class="text-emerald-300/60 truncate">{role.desc}</span>
        </div>
        <div class="shrink-0 text-right">
          <span class="font-bold {sealed ? 'text-rose-400' : 'text-yellow-300'}">Lv.{level}</span>
          <span class="ml-1 {sealed ? 'text-rose-300' : 'text-emerald-100/80'}">{score}点</span>
        </div>
      </div>
    {/each}
  </div>
</div>
```

`shidasu-seal-flash`クラスは`PlayArea.svelte`でimportしているグローバルCSSのため、`RoleStatusPanel.svelte`側で改めてimportする必要はない(同一ページにPlayAreaがマウントされていれば適用される)。

- [ ] **Step 2: `+page.svelte`で`flashingRoles`を算出して渡す**

`src/routes/game/shidasu/+page.svelte`の`<RoleStatusPanel {params} oracleLevels={run.oracleLevels} {sealedRoleEffect} />`の行を探す:

```bash
grep -n "<RoleStatusPanel" src/routes/game/shidasu/+page.svelte
```

見つかった行の直前に、`flashingRoles`を算出する`$derived`を追加する:

```ts
  let flashingRoles = $derived.by((): RoleName[] => {
    if (sealFlashTarget?.kind === 'role') return sealFlashTarget.names
    if (sealFlashTarget?.kind === 'revelationOrOracle' && sealFlashTarget.ref.kind === 'oracle') return [sealFlashTarget.ref.id]
    return []
  })
```

`<RoleStatusPanel>`呼び出しを以下に置き換える:

```svelte
  <RoleStatusPanel {params} oracleLevels={run.oracleLevels} {sealedRoleEffect} {flashingRoles} />
```

- [ ] **Step 3: 型チェックとビルドを実行**

Run: `npm run check`
Run: `npm run build`
Expected: どちらもエラーなし

- [ ] **Step 4: コミット**

```bash
git add src/routes/game/shidasu/RoleStatusPanel.svelte src/routes/game/shidasu/+page.svelte
git commit -m "feat: 役ステータスパネルに役封印・神託封印のフラッシュ演出を追加する"
```

---

### Task 7: デバッグ画面での動作確認

**Files:** なし(コード変更を伴わない確認タスク)

- [ ] **Step 1: 開発サーバーを起動**

Run: `npm run dev`

- [ ] **Step 2: `/admin/shidasu-debug`で各封印系妨害行動を発動して目視確認する**

ブラウザで`http://localhost:5173/admin/shidasu-debug`を開き、以下を確認する(Playwrightのadhocスクリプトを使う場合は`.superpowers/`配下に作成し、確認後に削除する):

- **talismanSeal**(護符封印): 護符を2つ以上所持した状態で発動ボタンを押す。対象護符バッジがフラッシュ+シェイクしてから、斜めストライプ背景(名前は表示されたまま)に切り替わることを確認する
- **riteSeal**(秘儀封印): 秘儀を所持した状態で発動する。対象秘儀ボタンがフラッシュ+シェイクしてからグレーアウトすることを確認する
- **revelationOracleSeal**(天啓/神託封印・天啓が選ばれた場合): 天啓を所持した状態で発動する(複数回試行し天啓が対象になるケースを確認する)。対象天啓ボタンがフラッシュ+シェイクしてからグレーアウトすることを確認する
- **revelationOracleSeal**(天啓/神託封印・神託が選ばれた場合): 神託を所持した状態で発動する。役ステータスパネルの対象行がフラッシュ+シェイクしてから赤字表示に切り替わることを確認する
- **roleSeal**(役封印): 発動する。役ステータスパネルの対象2行がフラッシュ+シェイクしてから赤字表示に切り替わることを確認する
- **comboCap**(コンボ頭打ち): コンボを重ねた状態で発動する。コンボ表示がフラッシュ+シェイクしてから「現在値/上限値」の分数表示・赤系の色に切り替わることを確認する
- 各演出中(約500ms)は他の操作(カードプレイ・山札引き・秘儀/天啓使用)がブロックされ、完了後は正常に操作できることを確認する
- 封印解除後(次の妨害発動タイミング)、常設表示が元の通常表示に戻ることを確認する

- [ ] **Step 3: 型チェック・ビルド・既存テストの最終確認**

Run: `npm run check`
Run: `npm run build`
Run: `npm test -- engine.test.ts`
Expected: いずれもエラーなし
