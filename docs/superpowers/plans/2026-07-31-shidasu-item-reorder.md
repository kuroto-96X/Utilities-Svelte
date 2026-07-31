# 護符の並べ替えUI Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** ショップ画面から所持護符をドラッグ&ドロップで並べ替えられるようにし、プレイ中の常設バッジ表示にもその順序を反映させる。

**Architecture:** `engine.ts`に純粋関数`reorderItems`を追加し、`+page.svelte`のショップ画面にpointerイベントベースの自前ドラッグ&ドロップUIを実装する。「所持品」セクションを護符専用セクションとその他(秘儀・天啓・神託)セクションに分離する。

**Tech Stack:** SvelteKit, Svelte 5 runes, TypeScript, Vitest

---

### Task 1: engine.tsにreorderItems関数を追加

**Files:**
- Modify: `src/lib/game/shidasu/engine.ts:1469-1470`(`sellItem`の直前に挿入)
- Test: `src/lib/game/shidasu/engine.test.ts`

- [ ] **Step 1: 失敗するテストを書く**

`src/lib/game/shidasu/engine.test.ts`の`describe('sellItem / sellRite / sellRevelation / sellOracle(所持品売却)', ...)`ブロックの直前(3020行目の手前)に、以下のテストブロックを追加する。

```ts
describe('reorderItems(所持護符の並べ替え)', () => {
  test('fromIndexの要素をtoIndexへ移動し、残りの要素の相対順序は保たれる', () => {
    const run: RunState = { ...createInitialRun(), items: ['bridge', 'grace', 'eternity'] }
    const result = reorderItems(run, 0, 2)
    expect(result.items).toEqual(['grace', 'eternity', 'bridge'])
  })

  test('末尾の要素を先頭へ移動できる', () => {
    const run: RunState = { ...createInitialRun(), items: ['bridge', 'grace', 'eternity'] }
    const result = reorderItems(run, 2, 0)
    expect(result.items).toEqual(['eternity', 'bridge', 'grace'])
  })

  test('fromIndexとtoIndexが同じ場合、itemsの内容は変化しない', () => {
    const run: RunState = { ...createInitialRun(), items: ['bridge', 'grace'] }
    const result = reorderItems(run, 1, 1)
    expect(result.items).toEqual(['bridge', 'grace'])
  })
})
```

ファイル冒頭のimport文(`engine.ts`からの named import一覧)に`reorderItems`を追加する。

- [ ] **Step 2: テストを実行して失敗を確認する**

Run: `npx vitest run src/lib/game/shidasu/engine.test.ts -t "reorderItems"`
Expected: FAIL(`reorderItems`が`engine.ts`からexportされていないため、importエラーまたは`is not a function`エラーになる)

- [ ] **Step 3: engine.tsにreorderItemsを実装する**

`src/lib/game/shidasu/engine.ts`の`sellItem`関数(1470行目)の直前に、以下の関数を追加する。

```ts
// 所持護符の並び順をfromIndexからtoIndexへ移動する。加算・倍算型護符の適用順(左から順に適用)を
// プレイヤーが調整できるようにするためのショップ画面向けの並べ替え操作。
export function reorderItems(run: RunState, fromIndex: number, toIndex: number): RunState {
  if (fromIndex === toIndex) return run
  const items = [...run.items]
  const [moved] = items.splice(fromIndex, 1)
  items.splice(toIndex, 0, moved)
  return { ...run, items }
}

```

- [ ] **Step 4: テストを実行して成功を確認する**

Run: `npx vitest run src/lib/game/shidasu/engine.test.ts -t "reorderItems"`
Expected: PASS(3件とも)

- [ ] **Step 5: Commit**

```bash
git add src/lib/game/shidasu/engine.ts src/lib/game/shidasu/engine.test.ts
git commit -m "feat: engine.tsに所持護符の並べ替え関数reorderItemsを追加"
```

---

### Task 2: ショップ画面の所持品セクションを護符とその他に分離する

**Files:**
- Modify: `src/routes/game/shidasu/+page.svelte:752-770`

- [ ] **Step 1: 所持品セクションを分離する**

`src/routes/game/shidasu/+page.svelte`の752-770行目、現在は以下のように護符・秘儀・天啓・神託が1つの「所持品(売却可)」セクションに混在している。

変更前:
```svelte
      <div class="space-y-2">
        <p class="text-xs text-slate-500">所持品(売却可)</p>
        <div class="flex flex-wrap gap-1">
          {#each run.items as itemId}
            <button onclick={() => handleSellItem(itemId)} class="text-xs text-slate-800 px-2 py-1 rounded border border-slate-200 hover:bg-slate-50">{itemName(itemId, params)} 売({itemSellPrice(params, itemId)})</button>
          {/each}
          {#each run.rites as riteId}
            <button onclick={() => handleUseRite(riteId)} class="text-xs text-slate-800 px-2 py-1 rounded border border-slate-200 hover:bg-slate-50">{riteName(riteId, params)} 使用</button>
            <button onclick={() => handleSellRite(riteId)} class="text-xs text-slate-800 px-2 py-1 rounded border border-slate-200 hover:bg-slate-50">{riteName(riteId, params)} 売({riteSellPrice(params)})</button>
          {/each}
          {#each run.revelations as revelationId}
            <button onclick={() => handleUseRevelationClick(revelationId)} class="text-xs text-slate-800 px-2 py-1 rounded border border-slate-200 hover:bg-slate-50">{revelationName(revelationId, params)} 使用</button>
            <button onclick={() => handleSellRevelation(revelationId)} class="text-xs text-slate-800 px-2 py-1 rounded border border-slate-200 hover:bg-slate-50">{revelationName(revelationId, params)} 売({revelationSellPrice(params)})</button>
          {/each}
          {#each run.oracles as roleName}
            <button onclick={() => handleSellOracle(roleName)} class="text-xs text-slate-800 px-2 py-1 rounded border border-slate-200 hover:bg-slate-50">{oracleName(roleName, params)} 売({oracleSellPrice(params)})</button>
          {/each}
        </div>
      </div>
```

変更後(護符セクションを分離し、`data-item-index`属性をドラッグ判定用に付与する。この時点ではまだドラッグ処理は実装しない、Task 3で追加する):
```svelte
      <div class="space-y-2">
        <p class="text-xs text-slate-500">所持護符(ドラッグで並べ替え・売却可)</p>
        <div class="flex flex-wrap gap-1">
          {#each run.items as itemId, i (i)}
            <div
              data-item-index={i}
              class="flex items-center gap-1 text-xs text-slate-800 px-2 py-1 rounded border border-slate-200 bg-white cursor-grab select-none"
            >
              <span>{itemName(itemId, params)}</span>
              <button onclick={() => handleSellItem(itemId)} class="text-slate-400 hover:text-slate-700">売({itemSellPrice(params, itemId)})</button>
            </div>
          {/each}
        </div>
      </div>

      <div class="space-y-2">
        <p class="text-xs text-slate-500">その他の所持品(売却可)</p>
        <div class="flex flex-wrap gap-1">
          {#each run.rites as riteId}
            <button onclick={() => handleUseRite(riteId)} class="text-xs text-slate-800 px-2 py-1 rounded border border-slate-200 hover:bg-slate-50">{riteName(riteId, params)} 使用</button>
            <button onclick={() => handleSellRite(riteId)} class="text-xs text-slate-800 px-2 py-1 rounded border border-slate-200 hover:bg-slate-50">{riteName(riteId, params)} 売({riteSellPrice(params)})</button>
          {/each}
          {#each run.revelations as revelationId}
            <button onclick={() => handleUseRevelationClick(revelationId)} class="text-xs text-slate-800 px-2 py-1 rounded border border-slate-200 hover:bg-slate-50">{revelationName(revelationId, params)} 使用</button>
            <button onclick={() => handleSellRevelation(revelationId)} class="text-xs text-slate-800 px-2 py-1 rounded border border-slate-200 hover:bg-slate-50">{revelationName(revelationId, params)} 売({revelationSellPrice(params)})</button>
          {/each}
          {#each run.oracles as roleName}
            <button onclick={() => handleSellOracle(roleName)} class="text-xs text-slate-800 px-2 py-1 rounded border border-slate-200 hover:bg-slate-50">{oracleName(roleName, params)} 売({oracleSellPrice(params)})</button>
          {/each}
        </div>
      </div>
```

- [ ] **Step 2: ビルド・型チェックを実行する**

Run: `npm run check`
Expected: この変更に起因するエラーが出ないこと(`itemId`が使われなくなったことによる未使用変数警告が出る場合は、`{#each run.items as itemId, i (i)}`の`itemId`は`itemName`・`itemSellPrice`・`handleSellItem`の引数として使われているため問題ない)

- [ ] **Step 3: Commit**

```bash
git add src/routes/game/shidasu/+page.svelte
git commit -m "feat: ショップ画面の所持品セクションを護符とその他に分離"
```

---

### Task 3: 護符バッジにpointerイベントによるドラッグ&ドロップを実装する

**Files:**
- Modify: `src/routes/game/shidasu/+page.svelte`(script部分にドラッグ状態・ハンドラを追加、Task 2で作った護符セクションのマークアップにイベントを追加)

- [ ] **Step 1: import文にreorderItemsを追加する**

`src/routes/game/shidasu/+page.svelte`の4-17行目のimport文、`useOracle, sellItem, sellRite, sellRevelation, sellOracle,`の行に`reorderItems`を追加する。

変更前(16行目):
```ts
    useOracle, sellItem, sellRite, sellRevelation, sellOracle,
```

変更後:
```ts
    useOracle, sellItem, sellRite, sellRevelation, sellOracle, reorderItems,
```

- [ ] **Step 2: ドラッグ状態の変数とハンドラ関数を追加する**

`handleSellItem`関数(327-329行目)の直前に、以下のドラッグ処理用コードを追加する。

```ts
  let draggingItemIndex = $state<number | null>(null)
  let dragPointerX = $state(0)
  let dragPointerY = $state(0)

  function handleItemPointerDown(index: number, e: PointerEvent) {
    draggingItemIndex = index
    dragPointerX = e.clientX
    dragPointerY = e.clientY
    ;(e.currentTarget as HTMLElement).setPointerCapture(e.pointerId)
  }

  function handleItemPointerMove(e: PointerEvent) {
    if (draggingItemIndex === null) return
    dragPointerX = e.clientX
    dragPointerY = e.clientY

    const el = document.elementFromPoint(e.clientX, e.clientY)?.closest<HTMLElement>('[data-item-index]')
    if (!el) return
    const targetIndex = Number(el.dataset.itemIndex)
    if (Number.isNaN(targetIndex) || targetIndex === draggingItemIndex) return

    run = reorderItems(run, draggingItemIndex, targetIndex)
    draggingItemIndex = targetIndex
  }

  function handleItemPointerUp() {
    draggingItemIndex = null
  }

```

- [ ] **Step 3: 護符バッジのマークアップにイベントを追加する**

Task 2で作成した「所持護符」セクションのマークアップを以下のように変更する。

変更前:
```svelte
          {#each run.items as itemId, i (i)}
            <div
              data-item-index={i}
              class="flex items-center gap-1 text-xs text-slate-800 px-2 py-1 rounded border border-slate-200 bg-white cursor-grab select-none"
            >
              <span>{itemName(itemId, params)}</span>
              <button onclick={() => handleSellItem(itemId)} class="text-slate-400 hover:text-slate-700">売({itemSellPrice(params, itemId)})</button>
            </div>
          {/each}
```

変更後:
```svelte
          {#each run.items as itemId, i (i)}
            <div
              data-item-index={i}
              onpointerdown={(e) => handleItemPointerDown(i, e)}
              onpointermove={handleItemPointerMove}
              onpointerup={handleItemPointerUp}
              onpointercancel={handleItemPointerUp}
              class="flex items-center gap-1 text-xs text-slate-800 px-2 py-1 rounded border touch-none select-none {draggingItemIndex === i ? 'border-teal-500 bg-teal-50 shadow-md' : 'border-slate-200 bg-white cursor-grab'}"
            >
              <span>{itemName(itemId, params)}</span>
              <button onclick={() => handleSellItem(itemId)} class="text-slate-400 hover:text-slate-700">売({itemSellPrice(params, itemId)})</button>
            </div>
          {/each}
```

`touch-none`はTailwindのユーティリティクラスで、スマホでのタッチ操作時にブラウザ標準のスクロール・ズームジェスチャーとドラッグ操作が競合しないようにする(`touch-action: none`)。

- [ ] **Step 4: ビルド・型チェックを実行する**

Run: `npm run check`
Expected: この変更に起因するエラーが出ないこと

- [ ] **Step 5: Commit**

```bash
git add src/routes/game/shidasu/+page.svelte
git commit -m "feat: ショップ画面の所持護符にpointerイベントでドラッグ&ドロップ並べ替えを実装"
```

---

### Task 4: 統合確認

**Files:** なし(確認のみ)

- [ ] **Step 1: 全テストを実行する**

Run: `npx vitest run`
Expected: 全ファイルPASS

- [ ] **Step 2: ビルドを実行する**

Run: `npm run build`
Expected: ビルド成功

- [ ] **Step 3: 型チェックを実行する**

Run: `npm run check`
Expected: shidasu関連のエラー0件(他ツールの既存エラーは無関係のため無視してよい)

- [ ] **Step 4: 開発サーバーでブラウザ確認する**

Run: `npm run dev`
確認項目:
- `/game/shidasu`でランを開始し、護符を2個以上所持した状態でショップ画面に到達する
- ショップ画面の「所持護符」セクションで、護符バッジをドラッグして他の護符バッジの位置まで動かすと、その場で順序が入れ替わること
- 並べ替え後、ショップを抜けてプレイ中画面に戻ると、画面上部の常設護符バッジ表示の順序も並べ替え後の順序になっていること
- 「その他の所持品」セクション(秘儀・天啓・神託がある場合)は従来通り、ドラッグできず売却・使用ボタンのみが機能すること
- ブラウザの開発者ツールでタッチエミュレーション(デバイスツールバー)を有効にし、タッチ操作でも同様に並べ替えができること

---
