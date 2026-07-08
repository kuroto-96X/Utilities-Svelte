# Culmen チェーン表示のアクションバー統合 Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Culmenのチェーン専用表示行と単独の場札(foundation)表示を廃止し、山札ボタンの右に、実際のカードと同じサイズのチェーン全体を重ねて表示する(13枚で次の行に折り返す)。

**Architecture:** `+page.svelte`のみを変更する純粋なUI変更。`wave.chain`/`wave.chainOrigin`をそのまま使い、表示側で13件ずつのチャンクに分割して「行」を作る。各カードは既存の`cardFace`スニペットをそのまま再利用し、横32px・縦(draw:20px/play:0px)のオフセットで重ねる。エンジン(`engine.ts`・`types.ts`)は一切変更しない。

**Tech Stack:** SvelteKit(Svelte 5 runes) / TypeScript / Tailwind CSS

**Spec:** `docs/superpowers/specs/2026-07-08-culmen-chain-fan-actionbar-design.md`

---

## 事前確認

- [ ] **Step 1: 作業ブランチを確認する**

```bash
git branch --show-current
```

Expected: `feat`(または `feat-*`)。

---

### Task 1: チェーン表示をアクションバーに統合する

**Files:**
- Modify: `src/routes/game/culmen/+page.svelte`

- [ ] **Step 1: 現在の該当箇所を確認する**

`src/routes/game/culmen/+page.svelte`の`playArea`スニペット内、以下の既存ブロック(249〜278行目付近)を確認する:

```svelte
  <div class="px-4 overflow-x-auto" style="min-height: 2.6rem;">
    <div class="relative" style="height:40px; width:{24 + (displayWave.chain.length - 1) * 10}px;">
      {#each displayWave.chain as c, i (c.id)}
        {@const isLastUnlinked = !displayWave.linked && i === displayWave.chain.length - 1}
        <div
          class="absolute rounded border text-center font-black leading-none flex flex-col items-center justify-center"
          style="left:{i * 10}px; top:{displayWave.chainOrigin[i] === 'draw' ? 6 : 0}px; z-index:{i + 1}; width:24px; height:34px; font-size:11px; background:{c.wild ? '#EDE4FF' : '#FBF7EC'}; color:{c.wild ? '#6D28D9' : isRed(c) ? '#C7402D' : '#15181D'}; border-color:{c.wild ? '#A78BFA' : '#B8AE98'}; opacity:{isLastUnlinked ? 0.55 : 1}; box-shadow:1px 0 3px rgba(0,0,0,.35);"
        >
          <div>{rankLabel(c)}</div>
          <div style="font-size:9px;">{c.suit}</div>
        </div>
      {/each}
    </div>
  </div>

  <div class="px-4 text-center text-yellow-300 text-xs font-black animate-pulse mb-1 {displayWave.lastDrawEffect === 'pattern' ? '' : 'invisible'}">✦ パターン継続! ✦</div>

  <div class="px-4 pb-5 pt-2 flex items-center gap-4">
    <button
      onclick={handleDraw}
      disabled={displayWave.stock.length === 0}
      style="aspect-ratio: 2 / 3;"
      class="w-16 rounded-lg border-2 flex flex-col items-center justify-center font-black active:scale-95 transition-transform {displayWave.stock.length > 0 ? 'bg-emerald-700 border-emerald-500 text-amber-50' : 'bg-emerald-900 border-emerald-800 text-emerald-700'}"
    >
      <div class="text-xs">山札</div>
      <div class="text-lg tabular-nums">{displayWave.stock.length}</div>
    </button>
    <div class="w-16">
      {@render cardFace(displayWave.foundation, false)}
    </div>
    <div class="flex-1 flex flex-wrap gap-1 justify-end">
      {#if displayWave.shieldLeft > 0}
        <span class="text-xs bg-sky-900 text-sky-200 border border-sky-600 rounded px-1.5 py-0.5">盾×{displayWave.shieldLeft}</span>
      {/if}
      {#each [...new Set(run.items)] as id (id)}
        {@const n = run.items.filter(x => x === id).length}
        <span class="text-xs bg-emerald-900 text-yellow-200/90 border border-yellow-600/40 rounded px-1.5 py-0.5">
          {ITEM_NAMES[id]}{n > 1 ? `×${n}` : ''}
        </span>
      {/each}
    </div>
  </div>
```

- [ ] **Step 2: `chunk`ヘルパー関数を追加する**

`<script>`セクション内、`FACE_CHAR`定数の直後(28行目付近)に追加する:

```ts
  function chunk<T>(arr: T[], size: number): T[][] {
    const result: T[][] = []
    for (let i = 0; i < arr.length; i += size) {
      result.push(arr.slice(i, i + size))
    }
    return result
  }
```

- [ ] **Step 3: ブロック全体を置き換える**

Step 1で確認した既存ブロック全体を、以下に置き換える(チェーン専用行・単独の場札表示を削除し、山札ボタンの右にチェーン全体を実カードサイズで重ねて表示する):

```svelte
  <div class="px-4 text-center text-yellow-300 text-xs font-black animate-pulse mb-1 {displayWave.lastDrawEffect === 'pattern' ? '' : 'invisible'}">✦ パターン継続! ✦</div>

  <div class="px-4 pb-5 pt-2 flex items-start gap-4">
    <button
      onclick={handleDraw}
      disabled={displayWave.stock.length === 0}
      style="aspect-ratio: 2 / 3; margin-top:20px;"
      class="w-16 rounded-lg border-2 flex flex-col items-center justify-center font-black active:scale-95 transition-transform {displayWave.stock.length > 0 ? 'bg-emerald-700 border-emerald-500 text-amber-50' : 'bg-emerald-900 border-emerald-800 text-emerald-700'}"
    >
      <div class="text-xs">山札</div>
      <div class="text-lg tabular-nums">{displayWave.stock.length}</div>
    </button>
    {@const chainEntries = displayWave.chain.map((c, i) => ({ card: c, origin: displayWave.chainOrigin[i], globalIndex: i }))}
    {@const chainRows = chunk(chainEntries, 13)}
    <div class="overflow-x-auto">
      {#each chainRows as row, ri (ri)}
        <div class="relative" style="height:116px; width:{64 + (row.length - 1) * 32}px;">
          {#each row as entry, j (entry.card.id)}
            {@const isLastUnlinked = !displayWave.linked && entry.globalIndex === displayWave.chain.length - 1}
            <div
              class="absolute"
              style="left:{j * 32}px; top:{entry.origin === 'draw' ? 20 : 0}px; z-index:{j + 1}; width:64px; opacity:{isLastUnlinked ? 0.55 : 1};"
            >
              {@render cardFace(entry.card, false)}
            </div>
          {/each}
        </div>
      {/each}
    </div>
    <div class="flex-1 flex flex-wrap gap-1 justify-end">
      {#if displayWave.shieldLeft > 0}
        <span class="text-xs bg-sky-900 text-sky-200 border border-sky-600 rounded px-1.5 py-0.5">盾×{displayWave.shieldLeft}</span>
      {/if}
      {#each [...new Set(run.items)] as id (id)}
        {@const n = run.items.filter(x => x === id).length}
        <span class="text-xs bg-emerald-900 text-yellow-200/90 border border-yellow-600/40 rounded px-1.5 py-0.5">
          {ITEM_NAMES[id]}{n > 1 ? `×${n}` : ''}
        </span>
      {/each}
    </div>
  </div>
```

(変更点: `flex items-center gap-4` を `flex items-start gap-4` に変更、山札ボタンに`margin-top:20px`を追加、単独の場札`cardFace`表示を`chainRows`によるチェーン全体の重ね表示に置き換え。「パターン継続」の行・アイテムバッジ部分は変更なし)

- [ ] **Step 4: Lintと型チェックを実行する**

Run: `npx eslint src/routes/game/culmen/`
Expected: エラーなし

Run: `npm run check`
Expected: culmen関連のエラーなし

- [ ] **Step 5: 全体テストスイートを実行する**

Run: `npm run test`
Expected: 全ファイルPASS(このタスクはエンジンを一切変更しないため、既存のテストは全てそのままPASSするはず)

- [ ] **Step 6: 開発サーバーで動作確認する**

Run: `npm run dev`(既に起動中でなければ)

ブラウザで`/game/culmen`を開き、以下を確認する:
- プレイエリア下部に、以前あったチェーン専用の表示行(小さいチップ状のカード)がもう存在しない
- 山札ボタンの右に、実際のカードと同じ見た目・サイズのカードが表示され、それが現在の場札を兼ねている(単独の場札ボックスは無い)
- 山札ボタンの上端が、山札由来(draw)のカードの上端と揃っている
- 場から連続してプレイすると、各カードが横32pxずつ右にずれて重なり、場からのプレイは少し上、山札由来は少し下がった位置に来る
- 13枚を超えてチェーンが伸びた場合、14枚目以降が次の行に折り返して表示され、上下の行のカードが重ならない(DebugPanelの強制引き機能や実際のプレイを繰り返して確認する)
- コンソールエラーが出ていない

- [ ] **Step 7: コミット**

```bash
git add src/routes/game/culmen/+page.svelte
git commit -m "feat: Culmenのチェーン表示をアクションバーに統合し実カードサイズの重ね表示にする"
```

---

### Task 2: 最終検証

**Files:** なし(検証のみ)

- [ ] **Step 1: 全テストを実行する**

Run: `npm run test`
Expected: 全ファイルPASS

- [ ] **Step 2: 型チェック・Lintを実行する**

Run: `npm run check && npx eslint src/routes/game/culmen/`
Expected: culmen関連のエラーなし

- [ ] **Step 3: 本番ビルドを実行する**

Run: `npm run build`
Expected: ビルド成功

- [ ] **Step 4: 開発サーバーで受け入れ基準を一通り確認する**

Run: `npm run dev`

`docs/superpowers/specs/2026-07-08-culmen-chain-fan-actionbar-design.md`の「4. 受け入れ基準」を上から順に確認する:
1. チェーン専用の表示行が存在しない
2. 単独の場札表示ボックスが存在せず、チェーンの一番手前の札が現在の場札を表す
3. 山札ボタンの右から、実カードサイズのチェーンが横32px・縦(draw:20px/play:0px)の重ねで表示される
4. 山札ボタンの縦位置が、draw起点のカードと揃っている
5. 13枚を超えると14枚目以降が次の行に折り返す
6. 折り返した行同士が視覚的に重ならない
7. `npm run test`・`npm run build`が成功する(Step 1・3で確認済み)

特に5・6は、DebugPanel(開発時のみ表示)の「山札の次を強制指定」機能を繰り返し使い、14枚以上チェーンを伸ばして確認するとよい。

- [ ] **Step 5: 最終コミット(検証中に見つかった不具合を修正した場合のみ)**

```bash
git add -A
git commit -m "fix: チェーンのアクションバー統合の最終検証で見つかった不具合を修正"
```

---

## 自己レビュー結果

- **スペック網羅性**: 1節(スコープ、専用行・単独場札の削除)→Task 1、2.1〜2.2節(見た目・サイズ・横オフセット32px)→Task 1、2.3節(縦オフセット20px・山札ボタンの位置合わせ)→Task 1、2.4節(13枚固定・折り返し・行の高さ116px)→Task 1、3節(データはそのまま利用)→Task 1のContext、4節(受け入れ基準)→Task 2、で対応済み。
- **プレースホルダー**: なし。全タスクに実コードを記載。
- **型・関数名の一貫性**: `chunk<T>(arr, size)`ヘルパーの定義(Task 1 Step 2)とその呼び出し(Task 1 Step 3)で型・引数が一致していることを確認済み。`chainEntries`(`card`/`origin`/`globalIndex`を持つオブジェクト配列)の構造が、`chainRows`の`{#each}`内での`entry.card`/`entry.origin`/`entry.globalIndex`の参照と一致していることを確認済み。既存の`cardFace`スニペット・`isRed`・`rankLabel`は変更せずそのまま再利用している。
