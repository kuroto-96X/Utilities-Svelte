# Solitaire Mobile Scale Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** ソリティアゲームをスマホ幅に合わせて縦横比を保ったまま自動縮小する。

**Architecture:** `transform: scale(ratio)` をゲームボードに1箇所適用し、`window.innerWidth` に応じたリアクティブなスケール変数で駆動する。`position: fixed` なゴースト要素・フライカードはスケール後の視覚座標を使いつつサイズのみ補正する。

**Tech Stack:** SvelteKit / Svelte 5 runes, Tailwind CSS, WAAPI

---

## 定数・計算方針

| 項目 | 値 |
|---|---|
| ゲームボードの自然幅 | `528px`（7列×64px + 6gap×8px + 内padding左右16px×2） |
| スケール計算 | `min(1, (min(window.innerWidth, 560) - 32) / 528)` |
| 適用開始幅 | 560px 未満（560-32=528 でちょうどスケール=1） |
| スケール下限 | なし（端末幅に完全フィット） |

---

## スケール変数

```ts
let scale = $state(1)

function updateScale() {
  const available = Math.min(window.innerWidth, 560) - 32
  scale = Math.min(1, available / 528)
}
```

`onMount` で初期化し、`resize` イベントを購読。アンマウント時に解除。

---

## ゲームボードへの適用

```svelte
<!-- 高さ補正ラッパー: transform はレイアウトフローに影響しないため手動補正 -->
<div style="height: {gameElHeight * scale}px; overflow: visible;">
  <div
    bind:this={gameEl}
    bind:offsetHeight={gameElHeight}
    style="transform: scale({scale}); transform-origin: top center;"
    class="bg-green-800 rounded-xl p-4 pb-10 select-none relative"
    ...
  >
    <!-- 既存の中身はそのまま -->
  </div>
</div>
```

`gameElHeight` は `let gameElHeight = $state(0)` で管理。`bind:offsetHeight` でゲームボードの自然高さを追跡し、ラッパーの高さに `* scale` を掛けて空白を消す。

---

## ゴースト要素（slamAnims）の対応

`position: fixed` で配置されるゴースト div は、`getBoundingClientRect()` がスケール後の視覚座標を返すため `fromX/toY` の補正は不要。サイズのみ調整する。

```svelte
{#each slamAnims as anim (anim.id)}
  <!-- 外側: 視覚サイズに合わせた寸法、WEBアニメーションのターゲット -->
  <div
    data-ghost-id={anim.id}
    class="pointer-events-none fixed z-[300]"
    style="
      left:{anim.fromX}px;
      top:{anim.fromY}px;
      width:{64 * scale}px;
      height:{((anim.cards.length - 1) * 28 + 98) * scale}px;
      filter: ...;
    "
  >
    <!-- 内側: 64×98px の自然サイズで描画し scale で縮小 -->
    <div style="
      transform: scale({scale});
      transform-origin: top left;
      width: 64px;
      height: {(anim.cards.length - 1) * 28 + 98}px;
    ">
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

WAAPI アニメーションは外側 div に適用され、`translate(tx, ty)` の値はビューポート座標系なので補正不要。

---

## フライカード（flyCard）の対応

```svelte
<div
  class="pointer-events-none fixed z-[500] overflow-hidden rounded-lg"
  style="
    left:{flyCard.moving ? flyCard.toX : flyCard.fromX}px;
    top:{flyCard.moving ? flyCard.toY : flyCard.fromY}px;
    width:{64 * scale}px;
    height:{98 * scale}px;
    transition: left {flyCard.duration}ms ..., top {flyCard.duration}ms ...;
  "
>
  <!-- 内側: 自然サイズで描画し scale 縮小 -->
  <div style="transform: scale({scale}); transform-origin: top left; width: 64px; height: 98px;">
    ...カード描画...
  </div>
</div>
```

---

## ドラッグゴースト（dragInfo）の対応

ドラッグゴーストは `gameEl` 内の `absolute` 要素のため、`gameEl` の `transform: scale` が自動適用される。変更不要。

---

## エフェクト座標の補正

カード中心オフセット（32px, 49px）はカードの自然サイズの半分。スケール後は視覚的中心が変わるため補正する。

対象箇所（`+page.svelte` 内）:
- `triggerImpactBounce(toX + 32, toY + 49)` → `triggerImpactBounce(toX + 32 * scale, toY + 49 * scale)`
- 該当箇所は `fireFinaleAnim` と `performSlamDrop` の landing 後処理

---

## 変更対象ファイル

| ファイル | 変更内容 |
|---|---|
| `src/routes/game/solitaire/+page.svelte` | scale変数追加、ゲームボードラッパー、ゴースト/フライカード対応、エフェクト座標補正 |

---

## 変更しないもの

- 設定行（`↺ 新ゲーム` / DRAW / seed）: ゲームエリア外のため自然にレスポンシブ
- 説明文: ゲームエリア外のため変更不要
- ゲームロジック・エンジン: 一切変更なし
- WAAPI アニメーション値: `getBoundingClientRect()` がスケール後座標を返すため補正不要
