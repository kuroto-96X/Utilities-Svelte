# 裏向き挙動(データ・表示)実装 実装プラン

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** 星の妨害行動「総戻し」「一列戻し」「捨て札埋没」で配られるカードを実際に裏向き表示にし、「護符並び替え」の情報非開示表現をテキストのみの「？？？」から専用の裏面デザインへ差し替える。

**Architecture:** `Card`型に`faceUp?: boolean`を追加し、3つの妨害行動がシャッフル後のカードに設定する。表示側(`PlayArea.svelte`)は「場札の列の一番上は常に表向き、それ以外は`faceUp`に従う」という判定を都度計算し、エンジン側は`faceUp`を書き換えない。`CardFace.svelte`にSolitaire由来の裏面デザインを追加する。護符側は`talismanHidden`のデータモデルを変更せず、`+page.svelte`の表示(HUD・ショップ画面の護符一覧)のみ新しい裏面デザイン(アンバー系斜めストライプ)に差し替える。アニメーションは対象外(次回セッション)。

**Tech Stack:** SvelteKit, Svelte 5, TypeScript, Vitest

**設計書:** `docs/superpowers/specs/2026-08-18-shidasu-facedown-cards-items-design.md`

---

## Task 1: `Card`型に`faceUp`を追加し、3つの妨害行動でカードを裏向きにする

**Files:**
- Modify: `src/lib/game/shidasu/types.ts`
- Modify: `src/lib/game/shidasu/sabotageEffects.ts`
- Test: `src/lib/game/shidasu/engine.test.ts`

- [ ] **Step 1: `Card`型に`faceUp`フィールドを追加する**

`src/lib/game/shidasu/types.ts`内、以下のブロック(`grep -n "export interface Card {"`で位置を特定できる):

```ts
export interface Card {
  id: number
  // 由来のdeckComposition内での永続的な識別子(deckComposition[].deckIdをそのまま引き継ぐ)。
  // スート・ランクが変換されても不変。idはウェーブごとに振り直される一時的な連番なのに対し、
  // deckIdはラン全体で「同じデッキ枠」を指し続ける(静寂の護符が参照する)。
  deckId: number
  suit: Suit
  rank: Rank
  wild: boolean
}
```

を以下に置き換える:

```ts
export interface Card {
  id: number
  // 由来のdeckComposition内での永続的な識別子(deckComposition[].deckIdをそのまま引き継ぐ)。
  // スート・ランクが変換されても不変。idはウェーブごとに振り直される一時的な連番なのに対し、
  // deckIdはラン全体で「同じデッキ枠」を指し続ける(静寂の護符が参照する)。
  deckId: number
  suit: Suit
  rank: Rank
  wild: boolean
  // カードが表向きかどうか。undefinedは表向き扱い(既存の全カード生成箇所は変更不要)。
  // falseは「総戻し」「一列戻し」「捨て札埋没」の3妨害行動でのみ設定される。表示側
  // (PlayArea.svelte)が、場札の列の一番上かどうかを都度判定して裏向き表示を決める
  // ため、エンジン側でこの値をtrueへ書き戻す処理は存在しない。
  faceUp?: boolean
}
```

- [ ] **Step 2: `applyColumnReturn`(一列戻し)が再配布するカードに`faceUp: false`を設定する**

`src/lib/game/shidasu/sabotageEffects.ts`内、以下のブロック(`grep -n "function applyColumnReturn"`で位置を特定できる):

```ts
function applyColumnReturn({ wave, rand }: SabotageContext): SabotageResult {
  const colIndex = Math.floor(rand() * wave.tableau.length)
  const col = wave.tableau[colIndex]
  const pool = [...wave.stock, ...col]
  shuffleInPlace(pool, rand)
  const newCol = pool.slice(0, col.length)
  const newStock = pool.slice(col.length)
  const tableau = wave.tableau.map((c, i) => (i === colIndex ? newCol : c))
  return { wave: { tableau, stock: newStock } }
}
```

を以下に置き換える:

```ts
function applyColumnReturn({ wave, rand }: SabotageContext): SabotageResult {
  const colIndex = Math.floor(rand() * wave.tableau.length)
  const col = wave.tableau[colIndex]
  const pool = [...wave.stock, ...col]
  shuffleInPlace(pool, rand)
  const newCol = pool.slice(0, col.length).map(c => ({ ...c, faceUp: false }))
  const newStock = pool.slice(col.length)
  const tableau = wave.tableau.map((c, i) => (i === colIndex ? newCol : c))
  return { wave: { tableau, stock: newStock } }
}
```

- [ ] **Step 3: `applyTableauFullReturn`(総戻し)が再配布するカードに`faceUp: false`を設定する**

同ファイル内、以下のブロック(`grep -n "function applyTableauFullReturn"`で位置を特定できる):

```ts
function applyTableauFullReturn({ wave, rand }: SabotageContext): SabotageResult {
  const counts = wave.tableau.map(col => col.length)
  const pool = [...wave.stock, ...wave.tableau.flat()]
  shuffleInPlace(pool, rand)
  let cursor = 0
  const tableau = counts.map(n => {
    const slice = pool.slice(cursor, cursor + n)
    cursor += n
    return slice
  })
  return { wave: { tableau, stock: pool.slice(cursor) } }
}
```

を以下に置き換える:

```ts
function applyTableauFullReturn({ wave, rand }: SabotageContext): SabotageResult {
  const counts = wave.tableau.map(col => col.length)
  const pool = [...wave.stock, ...wave.tableau.flat()]
  shuffleInPlace(pool, rand)
  let cursor = 0
  const tableau = counts.map(n => {
    const slice = pool.slice(cursor, cursor + n).map(c => ({ ...c, faceUp: false }))
    cursor += n
    return slice
  })
  return { wave: { tableau, stock: pool.slice(cursor) } }
}
```

- [ ] **Step 4: `applyDiscardBury`(捨て札埋没)が再配布するカードに`faceUp: false`を設定する**

同ファイル内、以下のブロック(`grep -n "function applyDiscardBury"`で位置を特定できる):

```ts
function applyDiscardBury({ wave, rand }: SabotageContext): SabotageResult {
  const n = wave.discardPile.length
  const pool = [...wave.stock, ...wave.discardPile]
  shuffleInPlace(pool, rand)
  const discardPile = pool.slice(0, n)
  const stock = pool.slice(n)
  return { wave: { stock, discardPile } }
}
```

を以下に置き換える:

```ts
function applyDiscardBury({ wave, rand }: SabotageContext): SabotageResult {
  const n = wave.discardPile.length
  const pool = [...wave.stock, ...wave.discardPile]
  shuffleInPlace(pool, rand)
  const discardPile = pool.slice(0, n).map(c => ({ ...c, faceUp: false }))
  const stock = pool.slice(n)
  return { wave: { stock, discardPile } }
}
```

- [ ] **Step 5: `columnReturn`のテストに`faceUp`の検証を追加する**

`src/lib/game/shidasu/engine.test.ts`内、以下のテスト(`grep -n "columnReturn: 選んだ列が山札に戻り"`で位置を特定できる):

```ts
  it('columnReturn: 選んだ列が山札に戻りシャッフルされ、同じ枚数で再配布される', () => {
    const run = runWithWave()
    const colIndex = 0
    const colLenBefore = run.wave!.tableau[colIndex].length
    const stockBefore = run.wave!.stock.length
    const next = triggerSabotage(DEFAULT_PARAMS, run, 'columnReturn', () => 0)
    expect(next.wave!.tableau[colIndex].length).toBe(colLenBefore)
    expect(next.wave!.stock.length).toBe(stockBefore)
  })
```

を以下に置き換える:

```ts
  it('columnReturn: 選んだ列が山札に戻りシャッフルされ、同じ枚数で再配布される', () => {
    const run = runWithWave()
    const colIndex = 0
    const colLenBefore = run.wave!.tableau[colIndex].length
    const stockBefore = run.wave!.stock.length
    const next = triggerSabotage(DEFAULT_PARAMS, run, 'columnReturn', () => 0)
    expect(next.wave!.tableau[colIndex].length).toBe(colLenBefore)
    expect(next.wave!.stock.length).toBe(stockBefore)
  })

  it('columnReturn: 再配布された列のカードは全てfaceUp:falseになる(山札に戻る余りは変更しない)', () => {
    const run = runWithWave()
    const colIndex = 0
    const next = triggerSabotage(DEFAULT_PARAMS, run, 'columnReturn', () => 0)
    expect(next.wave!.tableau[colIndex].every(c => c.faceUp === false)).toBe(true)
    expect(next.wave!.stock.some(c => c.faceUp === false)).toBe(false)
  })
```

- [ ] **Step 6: `tableauFullReturn`のテストに`faceUp`の検証を追加する**

同ファイル内、以下のテスト(`grep -n "tableauFullReturn: 場札の各列の枚数は変わらず"`で位置を特定できる):

```ts
  it('tableauFullReturn: 場札の各列の枚数は変わらず、山札の総数(山札+場札)も変わらない', () => {
    const run = runWithWave()
    const colLengthsBefore = run.wave!.tableau.map(c => c.length)
    const totalBefore = run.wave!.stock.length + run.wave!.tableau.flat().length
    const next = triggerSabotage(DEFAULT_PARAMS, run, 'tableauFullReturn', () => 0)
    expect(next.wave!.tableau.map(c => c.length)).toEqual(colLengthsBefore)
    expect(next.wave!.stock.length + next.wave!.tableau.flat().length).toBe(totalBefore)
  })
```

を以下に置き換える:

```ts
  it('tableauFullReturn: 場札の各列の枚数は変わらず、山札の総数(山札+場札)も変わらない', () => {
    const run = runWithWave()
    const colLengthsBefore = run.wave!.tableau.map(c => c.length)
    const totalBefore = run.wave!.stock.length + run.wave!.tableau.flat().length
    const next = triggerSabotage(DEFAULT_PARAMS, run, 'tableauFullReturn', () => 0)
    expect(next.wave!.tableau.map(c => c.length)).toEqual(colLengthsBefore)
    expect(next.wave!.stock.length + next.wave!.tableau.flat().length).toBe(totalBefore)
  })

  it('tableauFullReturn: 場札に配られたカードは全てfaceUp:falseになる(山札に戻る余りは変更しない)', () => {
    const run = runWithWave()
    const next = triggerSabotage(DEFAULT_PARAMS, run, 'tableauFullReturn', () => 0)
    expect(next.wave!.tableau.flat().every(c => c.faceUp === false)).toBe(true)
    expect(next.wave!.stock.some(c => c.faceUp === false)).toBe(false)
  })
```

- [ ] **Step 7: `discardBury`のテストに`faceUp`の検証を追加する**

同ファイル内、以下のテスト(`grep -n "discardBury: 捨て札を山札に混ぜ込み"`で位置を特定できる):

```ts
  it('discardBury: 捨て札を山札に混ぜ込み、同じ枚数を山札から捨て札に移す(場札・チェーンは不変)', () => {
    const stock: Card[] = [
      { id: 1, deckId: 1, suit: '♠', rank: 1, wild: false },
      { id: 2, deckId: 2, suit: '♥', rank: 2, wild: false },
      { id: 3, deckId: 3, suit: '♦', rank: 3, wild: false },
    ]
    const discardPile: Card[] = [{ id: 4, deckId: 4, suit: '♣', rank: 4, wild: false }]
    const run = runWithWave({}, { stock, discardPile })
    const beforeTableau = run.wave!.tableau
    const beforeChain = run.wave!.chain
    const next = triggerSabotage(DEFAULT_PARAMS, run, 'discardBury', () => 0)
    expect(next.wave!.discardPile).toHaveLength(1)
    expect(next.wave!.stock).toHaveLength(3)
    const allIds = [...next.wave!.stock, ...next.wave!.discardPile].map(c => c.id).sort()
    expect(allIds).toEqual([1, 2, 3, 4])
```

の直後(このテストブロックの残りは変更しない)に、新しいテストを1件追加する:

```ts
  it('discardBury: 新しい捨て札は全てfaceUp:falseになる(山札に戻る側は変更しない)', () => {
    const stock: Card[] = [
      { id: 1, deckId: 1, suit: '♠', rank: 1, wild: false },
      { id: 2, deckId: 2, suit: '♥', rank: 2, wild: false },
      { id: 3, deckId: 3, suit: '♦', rank: 3, wild: false },
    ]
    const discardPile: Card[] = [{ id: 4, deckId: 4, suit: '♣', rank: 4, wild: false }]
    const run = runWithWave({}, { stock, discardPile })
    const next = triggerSabotage(DEFAULT_PARAMS, run, 'discardBury', () => 0)
    expect(next.wave!.discardPile.every(c => c.faceUp === false)).toBe(true)
    expect(next.wave!.stock.some(c => c.faceUp === false)).toBe(false)
  })
```

- [ ] **Step 8: 型チェックを実行する**

Run: `npm run check`
Expected: shidasu関連のエラー無し

- [ ] **Step 9: テストを実行する**

Run: `npx vitest run src/lib/game/shidasu/engine.test.ts`
Expected: 全件PASS(新規追加した3件のテストを含む)

- [ ] **Step 10: コミット**

```bash
git add src/lib/game/shidasu/types.ts src/lib/game/shidasu/sabotageEffects.ts src/lib/game/shidasu/engine.test.ts
git commit -m "feat: 総戻し・一列戻し・捨て札埋没で配られるカードにfaceUp:falseを設定する"
```

---

## Task 2: `CardFace.svelte`に裏面デザインを追加し、`PlayArea.svelte`から表示ルールを適用する

**Files:**
- Modify: `src/routes/game/shidasu/CardFace.svelte`
- Modify: `src/routes/game/shidasu/PlayArea.svelte`

- [ ] **Step 1: `CardFace.svelte`に`faceUp`propと裏面デザインを追加する**

`src/routes/game/shidasu/CardFace.svelte`の以下のブロック(1-6行目):

```svelte
<script lang="ts">
  import { rankLabel } from '$lib/game/shidasu/engine'
  import { isRed } from '$lib/game/shidasu/patterns'
  import type { Card, ItemId } from '$lib/game/shidasu/types'

  let { card, covered, items = [] }: { card: Card; covered: boolean; items?: ItemId[] } = $props()
```

を以下に置き換える:

```svelte
<script lang="ts">
  import { rankLabel } from '$lib/game/shidasu/engine'
  import { isRed } from '$lib/game/shidasu/patterns'
  import type { Card, ItemId } from '$lib/game/shidasu/types'

  let { card, covered, faceUp = true, items = [] }: { card: Card; covered: boolean; faceUp?: boolean; items?: ItemId[] } = $props()

  const CARD_BACK_STYLE =
    'background:#0f172a;' +
    'background-image:' +
    'repeating-linear-gradient(0deg,transparent,transparent 7px,rgba(99,102,241,0.25) 7px,rgba(99,102,241,0.25) 8px),' +
    'repeating-linear-gradient(90deg,transparent,transparent 7px,rgba(99,102,241,0.25) 7px,rgba(99,102,241,0.25) 8px);'
```

- [ ] **Step 2: テンプレートの先頭に裏向き分岐を追加する**

同ファイル内、以下のブロック(23-25行目):

```svelte
</script>

{#if card.wild}
```

を以下に置き換える:

```svelte
</script>

{#if !faceUp}
  <div class="w-full rounded-lg border border-indigo-500/50" style="aspect-ratio: 2 / 3; {CARD_BACK_STYLE}"></div>
{:else if card.wild}
```

- [ ] **Step 3: 場札の表示に`faceUp`を渡す(選択可能な列トップ用ボタン内)**

`src/routes/game/shidasu/PlayArea.svelte`内、以下の行(`grep -n "isCardPlayable && startPlayCardAnimation"`付近、920行目):

```svelte
                <CardFace {card} covered={false} {items} />
              </button>
            {:else}
              <CardFace {card} covered={false} {items} />
            {/if}
```

を以下に置き換える:

```svelte
                <CardFace {card} covered={false} faceUp={card.faceUp !== false || isTop} {items} />
              </button>
            {:else}
              <CardFace {card} covered={false} faceUp={card.faceUp !== false || isTop} {items} />
            {/if}
```

(`isTop`は同じ`{#each col as card, ri (card.id)}`ブロック内、900行目で既に`{@const isTop = ri === col.length - 1}`として定義済みの定数をそのまま使う。)

- [ ] **Step 4: 捨て札先頭の表示に`faceUp`を渡す**

同ファイル内、以下の行(`grep -n "displayedDiscardTop}"`付近、964行目):

```svelte
      {#if displayedDiscardTop}
        <CardFace card={displayedDiscardTop} covered={false} {items} />
      {:else}
```

を以下に置き換える:

```svelte
      {#if displayedDiscardTop}
        <CardFace card={displayedDiscardTop} covered={false} faceUp={displayedDiscardTop.faceUp !== false} {items} />
      {:else}
```

- [ ] **Step 5: 型チェックを実行する**

Run: `npm run check`
Expected: shidasu関連のエラー無し

- [ ] **Step 6: フルテストスイートを実行する**

Run: `npx vitest run`
Expected: 全件PASS(このタスクは`.svelte`ファイルのみを対象とし、エンジンロジックは変更していないため、既存テストは無修正のまま全てグリーンになるはず)

- [ ] **Step 7: ビルドを実行する**

Run: `npm run build`
Expected: 成功

- [ ] **Step 8: ブラウザで動作確認する**

Run: `npm run dev` → `http://localhost:5173/game/shidasu` を開く

`/admin/shidasu-debug`のデバッグ画面(存在すれば)、または通常プレイで星の妨害行動が「総戻し」「一列戻し」になるまで進め、以下を確認する:

- 発動直後、対象の場札の列で一番上のカードだけが表向き、それ以外が紺地格子柄の裏面で表示されること
- 裏向きのカードがある列で一番上のカードをプレイし、新しく一番上になったカードが正しく表向きで表示されること
- 「捨て札埋没」発動後、捨て札の先頭表示が裏向きになること
- 護符「導き」所持時、山札の次カードプレビューが裏向きの影響を受けず正常に表示されること(該当護符が無ければこの確認は省略してよい)

ブラウザ操作が困難な環境であれば、Step 5〜7(型チェック・テスト・ビルド)の成功で代替してよい。

- [ ] **Step 9: コミット**

```bash
git add src/routes/game/shidasu/CardFace.svelte src/routes/game/shidasu/PlayArea.svelte
git commit -m "feat: CardFace.svelteに裏面デザインを追加しPlayArea.svelteで裏向き表示を反映する"
```

---

## Task 3: 護符「護符並び替え」の裏面デザインをHUD・ショップ画面に適用する

**Files:**
- Modify: `src/routes/game/shidasu/+page.svelte`

- [ ] **Step 1: HUDの護符バッジを新しい裏面デザインに差し替える**

`src/routes/game/shidasu/+page.svelte`内、以下のブロック(`grep -n "talismanHidden = wave?.activeSeal"`で位置を特定できる):

```svelte
      {#each [...new Set(run.items)] as id (id)}
        {@const n = run.items.filter(x => x === id).length}
        {@const talismanHidden = wave?.activeSeal?.kind === 'talismanHidden'}
        <span class="text-xs bg-emerald-900 text-yellow-200/90 border border-yellow-600/40 rounded px-1.5 py-0.5 {highlightedItemId === id ? 'ring-2 ring-yellow-400' : ''}" title={talismanHidden ? '護符並び替え: 次の妨害発動まで内容が見えない' : itemDesc(id, params)}>
          {talismanHidden ? '？？？' : itemName(id, params)}{n > 1 ? `×${n}` : ''}
        </span>
      {/each}
```

を以下に置き換える:

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

- [ ] **Step 2: ショップ画面の護符並べ替えUIに`talismanHidden`判定を追加し、裏面デザインを適用する**

同ファイル内、以下のブロック(`grep -n "所持護符(ドラッグで並べ替え・売却可)"`で位置を特定できる):

```svelte
      <div class="space-y-2">
        <p class="text-xs text-slate-500">所持護符(ドラッグで並べ替え・売却可)</p>
        <div class="flex flex-wrap gap-1">
          {#each run.items as itemId, i (itemId)}
            <div
              role="button"
              tabindex="0"
              data-item-index={i}
              title={itemDesc(itemId, params)}
              onpointerdown={(e) => handleItemPointerDown(i, e)}
              onpointermove={handleItemPointerMove}
              onpointerup={handleItemPointerUp}
              onpointercancel={handleItemPointerUp}
              class="flex items-center gap-1 text-xs text-slate-800 px-2 py-1 rounded border touch-none select-none {draggingItemIndex === i ? 'border-teal-500 bg-teal-50 shadow-md' : 'border-slate-200 bg-white cursor-grab'}"
            >
              <span>{itemName(itemId, params)}</span>
              <button onpointerdown={(e) => e.stopPropagation()} onclick={() => handleSellItem(itemId)} class="text-slate-400 hover:text-slate-700">売({itemSellPrice(params, run, itemId)})</button>
            </div>
          {/each}
        </div>
      </div>
```

を以下に置き換える:

```svelte
      <div class="space-y-2">
        <p class="text-xs text-slate-500">所持護符(ドラッグで並べ替え・売却可)</p>
        <div class="flex flex-wrap gap-1">
          {#each run.items as itemId, i (itemId)}
            {@const talismanHidden = wave?.activeSeal?.kind === 'talismanHidden'}
            <div
              role="button"
              tabindex="0"
              data-item-index={i}
              title={talismanHidden ? '護符並び替え: 次の妨害発動まで内容が見えない' : itemDesc(itemId, params)}
              onpointerdown={(e) => handleItemPointerDown(i, e)}
              onpointermove={handleItemPointerMove}
              onpointerup={handleItemPointerUp}
              onpointercancel={handleItemPointerUp}
              class="flex items-center gap-1 text-xs px-2 py-1 rounded border touch-none select-none {talismanHidden ? '' : (draggingItemIndex === i ? 'border-teal-500 bg-teal-50 shadow-md text-slate-800' : 'border-slate-200 bg-white cursor-grab text-slate-800')}"
              style={talismanHidden ? 'background:#1c1917; color:#78350f; border-color: rgba(217,119,6,0.5); background-image: repeating-linear-gradient(45deg,transparent,transparent 5px,rgba(217,119,6,0.35) 5px,rgba(217,119,6,0.35) 6px);' : ''}
            >
              <span>{talismanHidden ? '？？？' : itemName(itemId, params)}</span>
              <button onpointerdown={(e) => e.stopPropagation()} onclick={() => handleSellItem(itemId)} class="{talismanHidden ? '' : 'text-slate-400 hover:text-slate-700'}">売({talismanHidden ? '？' : itemSellPrice(params, run, itemId)})</button>
            </div>
          {/each}
        </div>
      </div>
```

(売却ボタンは`talismanHidden`中も引き続きクリック可能で、実際の売値で売れる。表示上の金額のみ「？」に隠す。)

- [ ] **Step 3: 型チェックを実行する**

Run: `npm run check`
Expected: shidasu関連のエラー無し

- [ ] **Step 4: フルテストスイートを実行する**

Run: `npx vitest run`
Expected: 全件PASS

- [ ] **Step 5: ビルドを実行する**

Run: `npm run build`
Expected: 成功

- [ ] **Step 6: ブラウザで動作確認する**

Run: `npm run dev` → `http://localhost:5173/game/shidasu` を開く

星の妨害行動が「護符並び替え」になるまで進め(またはデバッグ画面で発動条件を再現し)、以下を確認する:

- HUDの護符バッジが、アンバー系斜めストライプ柄の裏面デザインで表示されること(「？？？」テキストは維持)
- ショップ画面の護符並べ替えUIも同様に裏面デザインで表示され、実際の並べ替え操作(ドラッグ)は引き続き機能すること
- 売却ボタンの金額表示が「？」になっており、クリックすると実際の売値で売却できること
- ホバー時のツールチップが「護符並び替え: 次の妨害発動まで内容が見えない」になっていること(HUD・ショップ画面両方)

ブラウザ操作が困難な環境であれば、Step 3〜5(型チェック・テスト・ビルド)の成功で代替してよい。

- [ ] **Step 7: コミット**

```bash
git add src/routes/game/shidasu/+page.svelte
git commit -m "feat: 護符並び替え中のバッジ表示をアンバー系裏面デザインに差し替える"
```

---

## 最終確認

全3タスク完了後:

- [ ] `npm run build`を実行し、ビルドが通ることを確認する
- [ ] `npm run check`を実行し、型エラーが無いことを確認する
- [ ] `npx vitest run`を実行し、全テストがPASSすることを確認する
- [ ] `npm run dev`でブラウザから、カードの裏向き表示・護符の裏面デザインの両方を一通り確認する(Task 2・Task 3のブラウザ確認項目を通しでもう一度確認する)
- [ ] `docs/shidasu/shidasu-roadmap.md`に今回の実装完了を反映する
