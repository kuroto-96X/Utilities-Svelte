# Solitaire Mobile Scale Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** ソリティアゲームを `transform: scale()` でスマホ幅に自動フィットさせ、縦横比を完全に保ったまま縮小する。

**Architecture:** `scale` リアクティブ変数（`window.innerWidth` 駆動）をゲームボードの `transform: scale()` に適用。`position: fixed` 要素（ゴースト・フライカード・ドラッグ）はサイズのみ補正。高さ補正ラッパーでレイアウト崩れを防ぐ。

**Tech Stack:** SvelteKit / Svelte 5 runes, Tailwind CSS

---

## 変更対象ファイル

- `src/routes/game/solitaire/+page.svelte` のみ

---

## Task 1: スケール変数と resize リスナーを追加

**Files:**
- Modify: `src/routes/game/solitaire/+page.svelte`

現在の `gameEl` 宣言付近（line 127）に `scale` と `gameElHeight` を追加し、`onMount`（line 1041）に resize 対応を追加する。

- [ ] **Step 1: スクリプトに state 変数を追加する**

line 127 の `let gameEl` の直後に以下を追加:

```ts
  let gameEl: HTMLElement | null = null
  let scale = $state(1)
  let gameElHeight = $state(0)

  const GAME_NATURAL_WIDTH = 528 // 7×64px + 6×8px gap + 内padding 32px

  function updateScale() {
    const available = Math.min(window.innerWidth, 560) - 32
    scale = Math.min(1, available / GAME_NATURAL_WIDTH)
  }
```

- [ ] **Step 2: onMount に resize リスナーを追加する**

`onMount` の先頭（`function onPointerMove` の前）に以下を追加し、return の cleanup にも追加:

```ts
  onMount(() => {
    updateScale()
    window.addEventListener('resize', updateScale)

    function onPointerMove(e: PointerEvent) {
      // ... 既存コード ...
    }
    // ...
    return () => {
      stopTimer()
      autoCompleting = false
      window.removeEventListener('pointermove', onPointerMove)
      window.removeEventListener('pointerup', onPointerUp)
      window.removeEventListener('resize', updateScale)  // ← 追加
    }
  })
```

- [ ] **Step 3: ビルドが通ることを確認**

```bash
npm run build
```

Expected: `✓ built` でエラーなし

- [ ] **Step 4: コミット**

```bash
git add src/routes/game/solitaire/+page.svelte
git commit -m "feat: スマホ対応のscale変数とresizeリスナーを追加"
```

---

## Task 2: ゲームボードに scale transform を適用

**Files:**
- Modify: `src/routes/game/solitaire/+page.svelte` (line 1174付近)

`transform: scale` はレイアウトフローに影響しないため、ラッパー div で高さを手動補正する。

- [ ] **Step 1: ゲームボードをラッパー div で囲む**

現在:

```svelte
  <!-- ゲームエリア -->
  <div bind:this={gameEl} class="bg-green-800 rounded-xl p-4 pb-10 select-none relative" style="min-height: 520px;"
    class:pointer-events-none={isVictory(state)}>
```

変更後:

```svelte
  <!-- ゲームエリア -->
  <div style="height: {(gameElHeight || 520) * scale}px; overflow: visible;">
    <div
      bind:this={gameEl}
      bind:offsetHeight={gameElHeight}
      class="bg-green-800 rounded-xl p-4 pb-10 select-none relative"
      style="min-height: 520px; transform: scale({scale}); transform-origin: top center;"
      class:pointer-events-none={isVictory(state)}
    >
```

対応する `</div>` の閉じタグも1つ追加（ゲームエリアブロックの末尾）:

現在のゲームエリア末尾（`class:pointer-events-none` の div の閉じタグ）の直後:

```svelte
    </div>  <!-- ゲームエリア内 div の既存閉じタグ -->
  </div>    <!-- ← ラッパー div の閉じタグを追加 -->
```

- [ ] **Step 2: ブラウザで動作確認**

`npm run dev` を起動し `http://localhost:5173/game/solitaire` を開く。

- デスクトップ（560px以上）: スケールなし、見た目が変わらないこと
- ブラウザ幅を 375px に縮めると: ゲームボードが縮小し、はみ出しがないこと
- 下のスコア表示・設定行は通常サイズのままであること

- [ ] **Step 3: ビルドが通ることを確認**

```bash
npm run build
```

Expected: エラーなし

- [ ] **Step 4: コミット**

```bash
git add src/routes/game/solitaire/+page.svelte
git commit -m "feat: ゲームボードにtransform: scaleを適用してスマホ幅に自動縮小"
```

---

## Task 3: スラムアニメゴースト（slamAnims）のサイズ補正

**Files:**
- Modify: `src/routes/game/solitaire/+page.svelte` (line 1525付近)

`position: fixed` なゴースト div は `getBoundingClientRect()` がスケール後の視覚座標を返すため位置は正しい。サイズだけスケールに合わせる。

- [ ] **Step 1: ゴースト div を外側（サイズ）+ 内側（描画）の2層に変更する**

現在:

```svelte
  <!-- ドラッグゴースト -->
  {#each slamAnims as anim (anim.id)}
    <div
      data-ghost-id={anim.id}
      class="pointer-events-none fixed z-[300]"
      style="left:{anim.fromX}px; top:{anim.fromY}px; width:64px; height:{(anim.cards.length - 1) * 28 + 98}px; filter: drop-shadow(0 16px 32px rgba(0,0,0,0.7)) drop-shadow(0 0 12px rgba(251,191,36,0.5));"
    >
      {#each anim.cards as card, i (i)}
        <div class="absolute w-16 rounded-lg border border-slate-200 overflow-hidden"
          style="top:{i*28}px; height:98px;">
          {@render cardFace(card, true)}
        </div>
      {/each}
    </div>
  {/each}
```

変更後:

```svelte
  <!-- ドラッグゴースト -->
  {#each slamAnims as anim (anim.id)}
    {@const ghostNaturalH = (anim.cards.length - 1) * 28 + 98}
    <div
      data-ghost-id={anim.id}
      class="pointer-events-none fixed z-[300]"
      style="left:{anim.fromX}px; top:{anim.fromY}px; width:{64 * scale}px; height:{ghostNaturalH * scale}px; filter: drop-shadow(0 16px 32px rgba(0,0,0,0.7)) drop-shadow(0 0 12px rgba(251,191,36,0.5));"
    >
      <div style="transform: scale({scale}); transform-origin: top left; width: 64px; height: {ghostNaturalH}px;">
        {#each anim.cards as card, i (i)}
          <div class="absolute w-16 rounded-lg border border-slate-200 overflow-hidden"
            style="top:{i*28}px; height:98px;">
            {@render cardFace(card, true)}
          </div>
        {/each}
      </div>
    </div>
  {/each}
```

- [ ] **Step 2: 動作確認**

ブラウザで 375px 幅にしてカードをドラッグ→投下し、ゴーストカードが視覚的なカードと同サイズで表示されることを確認。

- [ ] **Step 3: ビルドが通ることを確認**

```bash
npm run build
```

Expected: エラーなし

- [ ] **Step 4: コミット**

```bash
git add src/routes/game/solitaire/+page.svelte
git commit -m "fix: スラムアニメゴーストをscaleに合わせてサイズ補正"
```

---

## Task 4: フライカード（flyCard）のサイズ補正

**Files:**
- Modify: `src/routes/game/solitaire/+page.svelte` (line 1500付近)

山札タップ時に飛ぶカードアニメも `position: fixed` のため同様に補正する。

- [ ] **Step 1: フライカードを外側（サイズ）+ 内側（描画）の2層に変更する**

現在:

```svelte
  <!-- フライングカード -->
  {#if flyCard}
    <div
      class="pointer-events-none fixed z-[500] w-16 h-[98px] overflow-hidden rounded-lg"
      style="left:{flyCard.moving ? flyCard.toX : flyCard.fromX}px; top:{flyCard.moving ? flyCard.toY : flyCard.fromY}px; transition: left {flyCard.duration}ms cubic-bezier(0.4,0,0.2,1), top {flyCard.duration}ms cubic-bezier(0.4,0,0.2,1);"
    >
      {#if flyCard.flip}
        <div
          class="absolute inset-0 rounded-lg border border-indigo-500/50"
          style="{CARD_BACK_STYLE} transition: transform {Math.round(flyCard.duration/2)}ms linear; transform: perspective(600px) rotateY({flyCard.moving ? 90 : 0}deg);"
        ></div>
        <div
          class="absolute inset-0"
          style="transition: transform {Math.round(flyCard.duration/2)}ms linear {Math.round(flyCard.duration/2)}ms; transform: perspective(600px) rotateY({flyCard.moving ? 0 : -90}deg);"
        >
          {@render cardFace(flyCard.card, true)}
        </div>
      {:else}
        <div class="absolute inset-0">
          {@render cardFace(flyCard.card, true)}
        </div>
      {/if}
    </div>
  {/if}
```

変更後:

```svelte
  <!-- フライングカード -->
  {#if flyCard}
    <div
      class="pointer-events-none fixed z-[500] overflow-hidden rounded-lg"
      style="left:{flyCard.moving ? flyCard.toX : flyCard.fromX}px; top:{flyCard.moving ? flyCard.toY : flyCard.fromY}px; width:{64 * scale}px; height:{98 * scale}px; transition: left {flyCard.duration}ms cubic-bezier(0.4,0,0.2,1), top {flyCard.duration}ms cubic-bezier(0.4,0,0.2,1);"
    >
      <div style="transform: scale({scale}); transform-origin: top left; width: 64px; height: 98px;">
        {#if flyCard.flip}
          <div
            class="absolute inset-0 rounded-lg border border-indigo-500/50"
            style="{CARD_BACK_STYLE} transition: transform {Math.round(flyCard.duration/2)}ms linear; transform: perspective(600px) rotateY({flyCard.moving ? 90 : 0}deg);"
          ></div>
          <div
            class="absolute inset-0"
            style="transition: transform {Math.round(flyCard.duration/2)}ms linear {Math.round(flyCard.duration/2)}ms; transform: perspective(600px) rotateY({flyCard.moving ? 0 : -90}deg);"
          >
            {@render cardFace(flyCard.card, true)}
          </div>
        {:else}
          <div class="absolute inset-0">
            {@render cardFace(flyCard.card, true)}
          </div>
        {/if}
      </div>
    </div>
  {/if}
```

- [ ] **Step 2: 動作確認**

375px 幅で山札をタップし、飛ぶカードが視覚的なカードと同サイズであることを確認。

- [ ] **Step 3: ビルドが通ることを確認**

```bash
npm run build
```

- [ ] **Step 4: コミット**

```bash
git add src/routes/game/solitaire/+page.svelte
git commit -m "fix: フライカードをscaleに合わせてサイズ補正"
```

---

## Task 5: ドラッグゴーストのサイズ・位置補正

**Files:**
- Modify: `src/routes/game/solitaire/+page.svelte` (line 1540付近)

ドラッグ中のゴーストもカード視覚サイズに合わせる。位置オフセット（`-32`, `-20`）もスケールに応じて調整する。

- [ ] **Step 1: ドラッグゴーストを外側（位置）+ 内側（描画）の2層に変更する**

現在:

```svelte
  {#if dragInfo?.isDragging}
    <div
      class="pointer-events-none fixed z-[200]"
      style="left:{dragInfo.currentX - 32}px; top:{dragInfo.currentY - 20}px;"
    >
      {#each getDragCards() as card, i (i)}
        <div
          class="absolute w-16 rounded-lg border border-slate-200 shadow-2xl overflow-hidden"
          style="top:{i * 28}px; height:{i === getDragCards().length - 1 ? 98 : 46}px; opacity:0.9;"
        >
          {@render cardFace(card, i === getDragCards().length - 1)}
        </div>
      {/each}
    </div>
  {/if}
```

変更後:

```svelte
  {#if dragInfo?.isDragging}
    {@const dragCards = getDragCards()}
    {@const dragNaturalH = (dragCards.length - 1) * 28 + 98}
    <div
      class="pointer-events-none fixed z-[200]"
      style="left:{dragInfo.currentX - 32 * scale}px; top:{dragInfo.currentY - 20 * scale}px; width:{64 * scale}px; height:{dragNaturalH * scale}px;"
    >
      <div style="transform: scale({scale}); transform-origin: top left; width: 64px; height: {dragNaturalH}px;">
        {#each dragCards as card, i (i)}
          <div
            class="absolute w-16 rounded-lg border border-slate-200 shadow-2xl overflow-hidden"
            style="top:{i * 28}px; height:{i === dragCards.length - 1 ? 98 : 46}px; opacity:0.9;"
          >
            {@render cardFace(card, i === dragCards.length - 1)}
          </div>
        {/each}
      </div>
    </div>
  {/if}
```

- [ ] **Step 2: 動作確認**

375px 幅でカードをドラッグし、ゴーストカードが指の位置に自然なオフセットで追従し視覚的なカードと同サイズであることを確認。

- [ ] **Step 3: ビルドが通ることを確認**

```bash
npm run build
```

- [ ] **Step 4: コミット**

```bash
git add src/routes/game/solitaire/+page.svelte
git commit -m "fix: ドラッグゴーストをscaleに合わせてサイズ・位置補正"
```

---

## Task 6: impactBounce の中心座標を補正

**Files:**
- Modify: `src/routes/game/solitaire/+page.svelte` (line 586, 646)

`triggerImpactBounce(toX + 32, toY + 49)` の `32`, `49` はカードの自然サイズの半分。スケール後は視覚的中心が変わるため補正する。

- [ ] **Step 1: 2箇所の triggerImpactBounce 呼び出しを修正する**

**line 586付近**（`performSlamDrop` 内の着地後処理）:

現在:
```ts
    triggerImpactBounce(toX + 32, toY + 49)
```

変更後:
```ts
    triggerImpactBounce(toX + 32 * scale, toY + 49 * scale)
```

**line 646付近**（`fireFinaleAnim` 内の着地後処理）:

現在:
```ts
    triggerImpactBounce(toX + 32, toY + 49)
```

変更後:
```ts
    triggerImpactBounce(toX + 32 * scale, toY + 49 * scale)
```

- [ ] **Step 2: 動作確認**

375px 幅でカードを組み札に投下し、衝撃波エフェクトがカードの中心から発生することを確認（ずれていないこと）。

- [ ] **Step 3: ビルドが通ることを確認**

```bash
npm run build
```

- [ ] **Step 4: コミット**

```bash
git add src/routes/game/solitaire/+page.svelte
git commit -m "fix: impactBounceの中心座標をscaleに合わせて補正"
```

---

## Task 7: 総合動作確認

**Files:** なし（確認のみ）

- [ ] **Step 1: デスクトップで回帰確認**

`http://localhost:5173/game/solitaire` を 600px 以上の幅で開き:
- ゲームが正常に表示される（scale = 1 で変化なし）
- カードのドラッグ・タップ・ダブルタップが動作する
- スラムアニメ・フライカード・衝撃波が正常

- [ ] **Step 2: スマホ幅（375px）で確認**

DevTools で 375px に設定し:
- ゲームボードが画面幅に収まる（はみ出しなし）
- 設定行（↺新ゲーム・DRAW・seed）は通常サイズのまま
- カードのタップ・ドラッグが動作する
- ACテストボタンでオートコンプリートが動作する
- フィナーレアニメーションが正常

- [ ] **Step 3: 360px でも確認**

DevTools で 360px に設定し、ゲームが収まることを確認。

- [ ] **Step 4: リサイズ確認**

ブラウザ幅を 350px ↔ 800px でドラッグしてリサイズし、リアルタイムに縮小・拡大が追従することを確認。
