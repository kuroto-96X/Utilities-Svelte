# 妨害行動アニメーション(talismanShuffle) Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** 妨害行動`talismanShuffle`(護符並び替え)に、所持護符バッジ全てが同時にフラッシュ+シェイクする発動演出を追加する。これで妨害行動32個すべてに発動演出が揃う。

**Architecture:** `PlayArea.svelte`に新規`talismanShuffleFlashActive`という単純なboolean $stateを追加し、`lastSabotage.id === 'talismanShuffle'`の検知のみで発動する(対象が常に「全護符」固定のため、既存の`sealFlashTarget`のような対象識別情報は不要)。`onTalismanShuffleFlashChange`コールバックpropsで`PlayArea`外(本編`+page.svelte`・デバッグ画面)へ値を伝える。既存の`shidasu-seal-flash`CSSをそのまま複数バッジに同時適用する。デバッグ画面には本編にある`talismanHidden`の常設表示(斜めストライプ・「？？？」表示)自体が無いため、今回合わせて追加する。

**Tech Stack:** SvelteKit, Svelte 5 runes (`$state`, `$effect.pre`), TypeScript

参照設計: `docs/superpowers/specs/2026-08-21-shidasu-sabotage-talisman-shuffle-animation-design.md`

---

### Task 1: PlayArea.svelteにtalismanShuffleFlashActive状態と検知ロジックを追加する

**Files:**
- Modify: `src/routes/game/shidasu/PlayArea.svelte`

- [ ] **Step 1: 新規stateを追加**

`src/routes/game/shidasu/PlayArea.svelte`内で`sealFlashTarget`・`sealFlashActive`の宣言箇所を探す:

```bash
grep -n "let sealFlashTarget = \$state\|let sealFlashActive = \$state" src/routes/game/shidasu/PlayArea.svelte
```

`let sealFlashActive = $state(false)`という行が見つかる。この行の直後に、以下を追加する:

```ts

  // 妨害行動「talismanShuffle」(護符並び替え)発動時、所持護符バッジ全てが同時に
  // フラッシュ+シェイクする演出用。対象は常に「全護符」固定のため、sealFlashTarget
  // のような対象識別情報は持たず、boolean一つのみで表現する。既存の封印系5種
  // (talismanSeal等)とは別の仕組み(単一対象へのsealFlashTarget)なので独立させている。
  let talismanShuffleFlashActive = $state(false)
```

- [ ] **Step 2: `startTalismanShuffleFlashAnimation`関数を追加**

`startSealFlashAnimation`関数の完全な終わりを確認する:

```bash
grep -n "function startSealFlashAnimation" -A 12 src/routes/game/shidasu/PlayArea.svelte
```

以下のような実装が見つかる(既存、変更不要):

```ts
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

この関数の直後に、以下の新規関数を追加する:

```ts

  // 妨害行動「talismanShuffle」(護符並び替え)発動時、全護符バッジのフラッシュ+シェイクを
  // 起動する。startSealFlashAnimationと同じ500ms持続だが、対象を持たないため
  // 引数無しで呼び出せる。
  function startTalismanShuffleFlashAnimation() {
    talismanShuffleFlashActive = true
    onTalismanShuffleFlashChange?.(true)
    const timer = setTimeout(() => {
      talismanShuffleFlashActive = false
      onTalismanShuffleFlashChange?.(false)
    }, 500)
    dealTimers.push(timer)
  }
```

- [ ] **Step 3: `$effect.pre`の`lastSabotage`検知ブロックに分岐を追加**

現在の検知ブロックの末尾を確認する:

```bash
grep -n "let previousSabotageSeq" -A 40 src/routes/game/shidasu/PlayArea.svelte
```

末尾が以下のようになっているはずである(直前の実装で`chainShuffle`分岐まで実装済み):

```ts
    } else if (current.id === 'tableauShuffle') {
      startTableauShuffleAnimation()
    } else if (current.id === 'chainShuffle') {
      startChainShuffleAnimation()
    }
  })
```

これを以下に置き換える(既存の分岐はすべてそのまま残し、末尾に新しい`else if`を追加する形):

```ts
    } else if (current.id === 'tableauShuffle') {
      startTableauShuffleAnimation()
    } else if (current.id === 'chainShuffle') {
      startChainShuffleAnimation()
    } else if (current.id === 'talismanShuffle') {
      startTalismanShuffleFlashAnimation()
    }
  })
```

**注意:** 実際のファイルの現在の内容が上記の想定と異なる場合(既存の分岐の並び順や内容が違う場合)は、既存の分岐をすべてそのまま維持しつつ、末尾に新しい`else if`ブロックを追加する形で対応すること。既存の分岐を削除・変更しないことが重要。

- [ ] **Step 4: `onTalismanShuffleFlashChange`コールバックpropsを追加**

props定義の分割代入部分を探す:

```bash
grep -n "onNumericPopupChange," src/routes/game/shidasu/PlayArea.svelte
```

現在:

```ts
    onScoreRevealDone, waveKey, onCleanupDone, onSealFlashChange, onConfiscateFadingChange, onPressPulseChange, onNumericPopupChange,
    onScorePartHighlight,
```

これを以下に置き換える:

```ts
    onScoreRevealDone, waveKey, onCleanupDone, onSealFlashChange, onConfiscateFadingChange, onPressPulseChange, onNumericPopupChange, onTalismanShuffleFlashChange,
    onScorePartHighlight,
```

型定義部分の`onNumericPopupChange?: (target: NumericChangeTarget | null) => void`という行を探す:

```bash
grep -n "onNumericPopupChange?:" src/routes/game/shidasu/PlayArea.svelte
```

この行の直後に、以下を追加する:

```ts
    onTalismanShuffleFlashChange?: (active: boolean) => void
```

- [ ] **Step 5: 型チェックとビルドを実行**

Run: `npm run check`
Run: `npm run build`
Expected: どちらもエラーなし(shidasu以外の既知の無関係な既存エラーは無視してよい)

- [ ] **Step 6: コミット**

```bash
git add src/routes/game/shidasu/PlayArea.svelte
git commit -m "feat: PlayAreaに護符並び替え(talismanShuffle)のフラッシュ演出状態と検知ロジックを追加する"
```

---

### Task 2: 本編(+page.svelte)のitemBadgesに発動演出を適用する

**Files:**
- Modify: `src/routes/game/shidasu/+page.svelte`

- [ ] **Step 1: `talismanShuffleFlashActive`用のstateを追加**

`sealFlashTarget`の宣言箇所を探す:

```bash
grep -n "let sealFlashTarget = \$state" src/routes/game/shidasu/+page.svelte
```

現在:

```ts
  // PlayArea側で発動検知したsealFlashTarget(封印系妨害行動のフラッシュ演出対象)を
  // 受け取って保持する。itemBadges(護符バッジ)・RoleStatusPanel(役ステータス)は
  // PlayAreaの外側にあるため、コールバックprops経由で値を受け渡す。
  let sealFlashTarget = $state<SealFlashTarget | null>(null)
```

この直後に、以下を追加する:

```ts

  // PlayArea側で発動検知したtalismanShuffleFlashActive(護符並び替え妨害行動の
  // 全護符バッジ一斉フラッシュ演出フラグ)を受け取って保持する。itemBadgesは
  // PlayAreaの外側にあるため、コールバックprops経由で値を受け渡す。
  let talismanShuffleFlashActive = $state(false)
```

- [ ] **Step 2: `<PlayArea>`呼び出しに`onTalismanShuffleFlashChange`を追加**

本編用の`<PlayArea>`呼び出し(`onNumericPopupChange={(target) => { numericPopupTarget = target }}`を含む行)を探す:

```bash
grep -n "onNumericPopupChange={" src/routes/game/shidasu/+page.svelte
```

この行の直後に、以下を追加する:

```svelte
    onTalismanShuffleFlashChange={(active) => { talismanShuffleFlashActive = active }}
```

**注意:** 天啓プレビュー用の`<PlayArea>`呼び出し(`disableRites={true}`を渡している方)には追加しないこと。数値変化系・封印系などの妨害行動と同様、`talismanShuffle`も`playing`フェーズ中のみ発動するため。

- [ ] **Step 3: `itemBadges`スニペットに発動演出を適用**

`itemBadges`スニペットの現在の内容を確認する:

```bash
grep -n "snippet itemBadges" -A 18 src/routes/game/shidasu/+page.svelte
```

現在:

```svelte
{#snippet itemBadges()}
  {@const talismanFading = confiscateFadingTarget?.kind === 'talisman' ? confiscateFadingTarget : undefined}
  {@const displayedItemIds = [...new Set(talismanFading ? [...run.items.slice(0, Math.min(talismanFading.idx, run.items.length)), talismanFading.id, ...run.items.slice(Math.min(talismanFading.idx, run.items.length))] : run.items)]}
  <div class="flex-1 flex flex-col gap-1 items-end">
    <div class="flex flex-wrap gap-1 justify-end">
      {#each displayedItemIds as id (id)}
        {@const n = run.items.filter(x => x === id).length}
        {@const talismanHidden = wave?.activeSeal?.kind === 'talismanHidden'}
        {@const talismanSealed = wave?.activeSeal?.kind === 'talisman' && wave.activeSeal.id === id}
        {@const talismanFlashing = sealFlashTarget?.kind === 'talisman' && sealFlashTarget.id === id}
        {@const talismanConfiscateFading = talismanFading?.id === id && n === 0}
        <span
          class="text-xs rounded px-1.5 py-0.5 {highlightedItemId === id ? 'ring-2 ring-yellow-400' : ''} {talismanConfiscateFading ? 'shidasu-confiscate-fade' : ''} {talismanFlashing ? 'shidasu-seal-flash' : ''} {talismanHidden || talismanSealed ? 'border' : 'bg-emerald-900 text-yellow-200/90 border border-yellow-600/40'}"
          style={talismanHidden || talismanSealed ? 'background:#1c1917; color:#78350f; border-color: rgba(217,119,6,0.5); background-image: repeating-linear-gradient(45deg,transparent,transparent 5px,rgba(217,119,6,0.35) 5px,rgba(217,119,6,0.35) 6px);' : ''}
          title={talismanHidden ? '護符並び替え: 次の妨害発動まで内容が見えない' : talismanSealed ? '護符封印: 次の妨害発動まで効果が無効' : itemDesc(id, params)}
        >
          {talismanHidden ? '？？？' : itemName(id, params)}{n > 1 ? `×${n}` : ''}
        </span>
      {/each}
    </div>
```

`{@const talismanFlashing = ...}`の行の直後に、以下を追加する:

```ts
        {@const talismanShuffleFlashing = talismanShuffleFlashActive && talismanHidden}
```

`class`属性内の`{talismanFlashing ? 'shidasu-seal-flash' : ''}`の直後に`{talismanShuffleFlashing ? 'shidasu-seal-flash' : ''}`を追加する。

つまり、上記ブロック全体を以下に置き換える:

```svelte
{#snippet itemBadges()}
  {@const talismanFading = confiscateFadingTarget?.kind === 'talisman' ? confiscateFadingTarget : undefined}
  {@const displayedItemIds = [...new Set(talismanFading ? [...run.items.slice(0, Math.min(talismanFading.idx, run.items.length)), talismanFading.id, ...run.items.slice(Math.min(talismanFading.idx, run.items.length))] : run.items)]}
  <div class="flex-1 flex flex-col gap-1 items-end">
    <div class="flex flex-wrap gap-1 justify-end">
      {#each displayedItemIds as id (id)}
        {@const n = run.items.filter(x => x === id).length}
        {@const talismanHidden = wave?.activeSeal?.kind === 'talismanHidden'}
        {@const talismanSealed = wave?.activeSeal?.kind === 'talisman' && wave.activeSeal.id === id}
        {@const talismanFlashing = sealFlashTarget?.kind === 'talisman' && sealFlashTarget.id === id}
        {@const talismanShuffleFlashing = talismanShuffleFlashActive && talismanHidden}
        {@const talismanConfiscateFading = talismanFading?.id === id && n === 0}
        <span
          class="text-xs rounded px-1.5 py-0.5 {highlightedItemId === id ? 'ring-2 ring-yellow-400' : ''} {talismanConfiscateFading ? 'shidasu-confiscate-fade' : ''} {talismanFlashing ? 'shidasu-seal-flash' : ''} {talismanShuffleFlashing ? 'shidasu-seal-flash' : ''} {talismanHidden || talismanSealed ? 'border' : 'bg-emerald-900 text-yellow-200/90 border border-yellow-600/40'}"
          style={talismanHidden || talismanSealed ? 'background:#1c1917; color:#78350f; border-color: rgba(217,119,6,0.5); background-image: repeating-linear-gradient(45deg,transparent,transparent 5px,rgba(217,119,6,0.35) 5px,rgba(217,119,6,0.35) 6px);' : ''}
          title={talismanHidden ? '護符並び替え: 次の妨害発動まで内容が見えない' : talismanSealed ? '護符封印: 次の妨害発動まで効果が無効' : itemDesc(id, params)}
        >
          {talismanHidden ? '？？？' : itemName(id, params)}{n > 1 ? `×${n}` : ''}
        </span>
      {/each}
    </div>
```

続き(`{#if oracles.length > 0 || ...}`以降)は変更しない。

- [ ] **Step 4: 型チェックとビルドを実行**

Run: `npm run check`
Run: `npm run build`
Expected: どちらもエラーなし

- [ ] **Step 5: コミット**

```bash
git add src/routes/game/shidasu/+page.svelte
git commit -m "feat: 護符バッジに護符並び替え(talismanShuffle)のフラッシュ演出を適用する"
```

---

### Task 3: デバッグ画面にtalismanHidden常設表示と発動演出を追加する

**Files:**
- Modify: `src/routes/admin/shidasu-debug/+page.svelte`

**背景:** デバッグ画面の`itemBadges`スニペットには、本編にある`talismanHidden`の常設表示(斜めストライプ・「？？？」表示)自体が実装されていない(`talismanSealed`のみ対応済み)。今回、この既存ギャップと発動演出の両方を実装する。

- [ ] **Step 1: 現在のコードを確認する**

```bash
grep -n "let sealFlashTarget\|snippet itemBadges" -A 20 src/routes/admin/shidasu-debug/+page.svelte
```

`itemBadges`スニペットの現在の内容を確認する:

```bash
grep -n "snippet itemBadges" -A 18 src/routes/admin/shidasu-debug/+page.svelte
```

現在は以下のようになっているはずである:

```svelte
{#snippet itemBadges()}
  {@const talismanFading = confiscateFadingTarget?.kind === 'talisman' ? confiscateFadingTarget : undefined}
  {@const displayedItemIds = [...new Set(talismanFading ? [...items.slice(0, Math.min(talismanFading.idx, items.length)), talismanFading.id, ...items.slice(Math.min(talismanFading.idx, items.length))] : items)]}
  <div class="flex-1 flex flex-col gap-1 items-end">
    <div class="flex flex-wrap gap-1 justify-end">
      {#each displayedItemIds as id (id)}
        {@const n = items.filter(x => x === id).length}
        {@const talismanSealed = wave.activeSeal?.kind === 'talisman' && wave.activeSeal.id === id}
        {@const talismanFlashing = sealFlashTarget?.kind === 'talisman' && sealFlashTarget.id === id}
        {@const talismanConfiscateFading = talismanFading?.id === id && n === 0}
        <span
          class="text-xs rounded px-1.5 py-0.5 {highlightedItemId === id ? 'ring-2 ring-yellow-400' : ''} {talismanConfiscateFading ? 'shidasu-confiscate-fade' : ''} {talismanFlashing ? 'shidasu-seal-flash' : ''} {talismanSealed ? 'border' : 'bg-emerald-900 text-yellow-200/90 border border-yellow-600/40'}"
          style={talismanSealed ? 'background:#1c1917; color:#78350f; border-color: rgba(217,119,6,0.5); background-image: repeating-linear-gradient(45deg,transparent,transparent 5px,rgba(217,119,6,0.35) 5px,rgba(217,119,6,0.35) 6px);' : ''}
          title={talismanSealed ? '護符封印: 次の妨害発動まで効果が無効' : itemDesc(id, params)}
        >
          {itemName(id, params)}{n > 1 ? `×${n}` : ''}
        </span>
      {/each}
    </div>
```

- [ ] **Step 2: `itemBadges`スニペットに`talismanHidden`常設表示+発動演出を追加**

上記ブロック全体を、本編`+page.svelte`と同じ内容(`talismanHidden`判定・「？？？」表示・`talismanShuffleFlashing`判定を追加)に置き換える。デバッグ画面は`run.items`ではなく`items`という変数名を使っている点に注意して、以下に置き換える:

```svelte
{#snippet itemBadges()}
  {@const talismanFading = confiscateFadingTarget?.kind === 'talisman' ? confiscateFadingTarget : undefined}
  {@const displayedItemIds = [...new Set(talismanFading ? [...items.slice(0, Math.min(talismanFading.idx, items.length)), talismanFading.id, ...items.slice(Math.min(talismanFading.idx, items.length))] : items)]}
  <div class="flex-1 flex flex-col gap-1 items-end">
    <div class="flex flex-wrap gap-1 justify-end">
      {#each displayedItemIds as id (id)}
        {@const n = items.filter(x => x === id).length}
        {@const talismanHidden = wave.activeSeal?.kind === 'talismanHidden'}
        {@const talismanSealed = wave.activeSeal?.kind === 'talisman' && wave.activeSeal.id === id}
        {@const talismanFlashing = sealFlashTarget?.kind === 'talisman' && sealFlashTarget.id === id}
        {@const talismanShuffleFlashing = talismanShuffleFlashActive && talismanHidden}
        {@const talismanConfiscateFading = talismanFading?.id === id && n === 0}
        <span
          class="text-xs rounded px-1.5 py-0.5 {highlightedItemId === id ? 'ring-2 ring-yellow-400' : ''} {talismanConfiscateFading ? 'shidasu-confiscate-fade' : ''} {talismanFlashing ? 'shidasu-seal-flash' : ''} {talismanShuffleFlashing ? 'shidasu-seal-flash' : ''} {talismanHidden || talismanSealed ? 'border' : 'bg-emerald-900 text-yellow-200/90 border border-yellow-600/40'}"
          style={talismanHidden || talismanSealed ? 'background:#1c1917; color:#78350f; border-color: rgba(217,119,6,0.5); background-image: repeating-linear-gradient(45deg,transparent,transparent 5px,rgba(217,119,6,0.35) 5px,rgba(217,119,6,0.35) 6px);' : ''}
          title={talismanHidden ? '護符並び替え: 次の妨害発動まで内容が見えない' : talismanSealed ? '護符封印: 次の妨害発動まで効果が無効' : itemDesc(id, params)}
        >
          {talismanHidden ? '？？？' : itemName(id, params)}{n > 1 ? `×${n}` : ''}
        </span>
      {/each}
    </div>
```

続き(`{#if oracles.length > 0 || ...}`以降)は変更しない。

- [ ] **Step 3: `talismanShuffleFlashActive`用のstateを追加**

`let sealFlashTarget = $state`の宣言箇所を探す:

```bash
grep -n "let sealFlashTarget = \$state" src/routes/admin/shidasu-debug/+page.svelte
```

この行の直後に、以下を追加する:

```ts

  let talismanShuffleFlashActive = $state(false)
```

- [ ] **Step 4: `<PlayArea>`呼び出しに`onTalismanShuffleFlashChange`を追加**

`onSealFlashChange={(target) => { sealFlashTarget = target }}`を含む行を探す:

```bash
grep -n "onSealFlashChange=" src/routes/admin/shidasu-debug/+page.svelte
```

この行の直後に、以下を追加する:

```svelte
          onTalismanShuffleFlashChange={(active) => { talismanShuffleFlashActive = active }}
```

- [ ] **Step 5: 型チェックとビルドを実行**

Run: `npm run check`
Run: `npm run build`
Expected: どちらもエラーなし

- [ ] **Step 6: コミット**

```bash
git add src/routes/admin/shidasu-debug/+page.svelte
git commit -m "feat: デバッグ画面にtalismanHidden常設表示と護符並び替えのフラッシュ演出を追加する"
```

---

### Task 4: デバッグ画面での動作確認

**Files:** なし(コード変更を伴わない確認タスク)

- [ ] **Step 1: 開発サーバーを起動**

Run: `npm run dev`

- [ ] **Step 2: `/admin/shidasu-debug`で「護符並び替え」を発動して確認する**

ブラウザで`http://localhost:5173/admin/shidasu-debug`(実際のポート番号は起動時の出力を確認する)を開き、以下を確認する(Playwrightのadhocスクリプトを使う場合は`.superpowers/`配下に作成し、確認後に削除する):

- デバッグパネルの護符所持チェックリストで、複数の護符を所持させる。
- 「星の妨害行動を直接発動(デバッグ用)」の「護符並び替え」ボタンをクリックする。
- 発動直後、所持護符バッジ全てが同時にフラッシュ+シェイクすることを確認する。
- 500ms後、フラッシュが収まり、護符バッジが斜めストライプ背景+「？？？」表示に切り替わっていることを確認する。
- 再度何らかの妨害行動を発動する(封印解除、次の妨害行動発動)と、護符バッジの表示が元に戻ることを確認する。
- コンソールエラーが出ていないことを確認する。

- [ ] **Step 3: 本編画面(`/game/shidasu`)でも同様に確認する**

実際のゲームプレイ中に護符を複数所持した状態を作るのは手間がかかるため、目視確認はデバッグ画面を主とし、本編側はコードレビュー(Task 2のspec準拠レビュー)で正確性を担保する。可能であれば、本編プレイ中に「護符並び替え」が発動するタイミングで演出が正しく表示されることも確認する。

- [ ] **Step 4: 型チェック・ビルド・既存テストの最終確認**

Run: `npm run check`
Run: `npm run build`
Run: `npm test`
Expected: いずれもエラーなし
