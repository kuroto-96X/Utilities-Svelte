# プレイ中画面での護符並べ替え Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** プレイ中画面(`PlayArea`の`extraFooter`として渡される`itemBadges`スニペット)の護符バッジを、ショップ画面と同じ「1個1バッジ+ドラッグ&ドロップで並べ替え可能」な表示に変更する。

**Architecture:** `PlayArea.svelte`の`extraFooter`propsの型を`Snippet<[boolean]>`に変更し、`anyAnimationActive`の値を引数として渡す(新規コールバックpropsは追加しない)。`+page.svelte`の`itemBadges`スニペットは、現在の「同名護符をグループ化して`×n`表示」を撤廃し、ショップ画面と同じ`{#each run.items as itemId, i (i)}`構造+`data-item-index`属性+既存のドラッグハンドラ(`handleItemPointerDown`等)を適用する。没収フェード演出の対象挿入には、既存の`withFadingId`ヘルパーへ統一する。

**Tech Stack:** SvelteKit, Svelte 5 runes (`$state`, `$derived`), TypeScript

参照設計: `docs/superpowers/specs/2026-08-21-shidasu-play-item-reorder-design.md`

---

### Task 1: PlayArea.svelteのextraFooterにanyAnimationActiveを渡す

**Files:**
- Modify: `src/routes/game/shidasu/PlayArea.svelte`

- [ ] **Step 1: `extraFooter`のprops型を`Snippet<[boolean]>`に変更**

`PlayArea.svelte`内でprops型定義を探す:

```bash
grep -n "extraFooter?: Snippet" src/routes/game/shidasu/PlayArea.svelte
```

現在:

```ts
    extraFooter?: Snippet
```

これを以下に置き換える:

```ts
    extraFooter?: Snippet<[boolean]>
```

- [ ] **Step 2: `extraFooter`の呼び出しに`anyAnimationActive`を渡す**

呼び出し箇所を探す:

```bash
grep -n "{#if extraFooter}" -A 3 src/routes/game/shidasu/PlayArea.svelte
```

現在:

```svelte
  {#if extraFooter}
    {@render extraFooter()}
  {/if}
```

これを以下に置き換える:

```svelte
  {#if extraFooter}
    {@render extraFooter(anyAnimationActive)}
  {/if}
```

- [ ] **Step 3: 型チェックを実行**

Run: `npm run check`
Expected: `extraFooter`の型不一致に関するエラーが出ることを確認する(`+page.svelte`側の`itemBadges`スニペットがまだ引数無しのままのため)。これはTask 2で解消する想定通りの一時的な状態。

- [ ] **Step 4: コミット**

```bash
git add src/routes/game/shidasu/PlayArea.svelte
git commit -m "feat: PlayAreaのextraFooterにanyAnimationActiveを引数として渡すようにする"
```

---

### Task 2: itemBadgesスニペットを1個1バッジ+ドラッグ可能に書き換える

**Files:**
- Modify: `src/routes/game/shidasu/+page.svelte`

**背景:** `itemBadges`スニペットは現在、`run.items`を`new Set`で重複除去し「護符名×n」という1種類1バッジの表示にしている。これをショップ画面と同じ「1個1バッジ」表示へ変更し、既存のドラッグハンドラ(`handleItemPointerDown`・`handleItemPointerMove`・`handleItemPointerUp`、`draggingItemIndex`という`$state`、すべて`+page.svelte`のトップレベルに既存)を適用する。

- [ ] **Step 1: 現在のコードを確認する**

```bash
grep -n "snippet itemBadges" -A 20 src/routes/game/shidasu/+page.svelte
```

現在の内容(既に確認済み):

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
          class="text-xs rounded px-1.5 py-0.5 {highlightedItemId === id ? 'ring-2 ring-yellow-400' : ''} {talismanConfiscateFading ? 'shidasu-confiscate-fade' : ''} {talismanFlashing || talismanShuffleFlashing ? 'shidasu-seal-flash' : ''} {talismanHidden || talismanSealed ? 'border' : 'bg-emerald-900 text-yellow-200/90 border border-yellow-600/40'}"
          style={talismanHidden || talismanSealed ? 'background:#1c1917; color:#78350f; border-color: rgba(217,119,6,0.5); background-image: repeating-linear-gradient(45deg,transparent,transparent 5px,rgba(217,119,6,0.35) 5px,rgba(217,119,6,0.35) 6px);' : ''}
          title={talismanHidden ? '護符並び替え: 次の妨害発動まで内容が見えない' : talismanSealed ? '護符封印: 次の妨害発動まで効果が無効' : itemDesc(id, params)}
        >
          {talismanHidden ? '？？？' : itemName(id, params)}{n > 1 ? `×${n}` : ''}
        </span>
      {/each}
    </div>
```

- [ ] **Step 2: `itemBadges`スニペットを1個1バッジ+ドラッグ可能な形に書き換える**

上記ブロック全体(`{#snippet itemBadges()}`から`{#each displayedItemIds as id (id)}...{/each}`を含む`</div>`の閉じタグの直前まで)を、以下に置き換える:

```svelte
{#snippet itemBadges(anyAnimationActive: boolean)}
  {@const talismanFading = confiscateFadingTarget?.kind === 'talisman' ? confiscateFadingTarget : undefined}
  {@const displayedItems = withFadingId(run.items, talismanFading?.id, talismanFading?.idx ?? 0)}
  <div class="flex-1 flex flex-col gap-1 items-end">
    <div class="flex flex-wrap gap-1 justify-end">
      {#each displayedItems as itemId, i (i)}
        {@const talismanHidden = wave?.activeSeal?.kind === 'talismanHidden'}
        {@const talismanSealed = wave?.activeSeal?.kind === 'talisman' && wave.activeSeal.id === itemId}
        {@const talismanFlashing = sealFlashTarget?.kind === 'talisman' && sealFlashTarget.id === itemId}
        {@const talismanShuffleFlashing = talismanShuffleFlashActive && talismanHidden}
        {@const talismanConfiscateFading = talismanFading !== undefined && i === talismanFading.idx}
        <span
          role="button"
          tabindex="0"
          data-item-index={i}
          onpointerdown={(e) => !anyAnimationActive && !talismanConfiscateFading && handleItemPointerDown(i, e)}
          onpointermove={handleItemPointerMove}
          onpointerup={handleItemPointerUp}
          onpointercancel={handleItemPointerUp}
          class="text-xs rounded px-1.5 py-0.5 touch-none select-none {anyAnimationActive || talismanConfiscateFading ? '' : 'cursor-grab'} {draggingItemIndex === i ? 'ring-2 ring-teal-400' : ''} {highlightedItemId === itemId ? 'ring-2 ring-yellow-400' : ''} {talismanConfiscateFading ? 'shidasu-confiscate-fade' : ''} {talismanFlashing || talismanShuffleFlashing ? 'shidasu-seal-flash' : ''} {talismanHidden || talismanSealed ? 'border' : 'bg-emerald-900 text-yellow-200/90 border border-yellow-600/40'}"
          style={talismanHidden || talismanSealed ? 'background:#1c1917; color:#78350f; border-color: rgba(217,119,6,0.5); background-image: repeating-linear-gradient(45deg,transparent,transparent 5px,rgba(217,119,6,0.35) 5px,rgba(217,119,6,0.35) 6px);' : ''}
          title={talismanHidden ? '護符並び替え: 次の妨害発動まで内容が見えない' : talismanSealed ? '護符封印: 次の妨害発動まで効果が無効' : itemDesc(itemId, params)}
        >
          {talismanHidden ? '？？？' : itemName(itemId, params)}
        </span>
      {/each}
    </div>
```

**変更点の説明:**
- `{#snippet itemBadges(anyAnimationActive: boolean)}`: Task 1で`extraFooter`が`Snippet<[boolean]>`になったことに合わせ、引数を受け取る。
- `displayedItemIds`(`new Set`で重複除去)を廃止し、既存の`withFadingId`ヘルパー(`PlayArea.svelte`の`<script module>`でexport済み、`+page.svelte`は既に`import { withFadingId } from './PlayArea.svelte'`している前提。importされていなければ追加すること)を使った`displayedItems`に置き換える。`n`(個数カウント)・`×${n}`表示は不要になるため削除。
- `{#each displayedItemIds as id (id)}`から`{#each displayedItems as itemId, i (i)}`へ変更(位置ベースのkeyに変更、変数名も`id`から`itemId`に統一してショップ画面側と合わせる)。
- `talismanConfiscateFading`の判定を`talismanFading?.id === id && n === 0`(個数ベース)から`talismanFading !== undefined && i === talismanFading.idx`(位置ベース、`displayedRevelations`等の既存パターンと同じ)に変更。
- 各バッジに`role="button"`・`tabindex="0"`・`data-item-index={i}`・4つのpointerイベントハンドラを追加。`onpointerdown`は`anyAnimationActive`中、および該当バッジがフェード中(`talismanConfiscateFading`、消えかけている没収対象)の場合はドラッグを開始しないようガードする。
- `class`属性に、ドラッグ中を示す`ring-2 ring-teal-400`(`draggingItemIndex === i`のとき)、ドラッグ可能を示す`cursor-grab`(`anyAnimationActive`でも`talismanConfiscateFading`でもないとき)を追加。

- [ ] **Step 3: `withFadingId`のimportを確認する**

```bash
grep -n "import.*withFadingId" src/routes/game/shidasu/+page.svelte
```

既に`import { withFadingId } from './PlayArea.svelte'`のような行があるはずである(グループB「没収系」実装時に導入済み)。無ければ、既存の`PlayArea.svelte`からのimport文に追加すること。

- [ ] **Step 4: 型チェックとビルドを実行**

Run: `npm run check`
Run: `npm run build`
Expected: どちらもエラーなし(shidasu以外の既知の無関係な既存エラーは無視してよい)。Task 1で発生していた`extraFooter`の型不一致エラーがここで解消されていることを確認する。

- [ ] **Step 5: コミット**

```bash
git add src/routes/game/shidasu/+page.svelte
git commit -m "feat: プレイ中画面の護符バッジを1個1バッジ表示にしドラッグで並べ替え可能にする"
```

---

### Task 3: 動作確認

**Files:** なし(コード変更を伴わない確認タスク)

- [ ] **Step 1: 開発サーバーを起動**

Run: `npm run dev`

- [ ] **Step 2: プレイ中画面で護符バッジの並べ替えを確認する**

ブラウザで`http://localhost:5173/game/shidasu`(実際のポート番号は起動時の出力を確認する)を開き、以下を確認する(Playwrightのadhocスクリプトを使う場合は`.superpowers/`配下に作成し、確認後に削除する):

- ゲームを開始し、ショップで護符を複数個(異なる種類を3つ以上)購入する。
- プレイ中画面(`itemBadges`が表示される場所、画面右下あたり)で、護符バッジが1個1バッジ形式で表示されていることを確認する(`×n`表示が無いこと)。
- 護符バッジをドラッグし、他のバッジの位置まで動かすと順序が入れ替わることを確認する。
- 並べ替え後、ショップ画面に遷移し、同じ順序で表示されていることを確認する(`run.items`が唯一の情報源のため)。
- カードプレイ中(`anyAnimationActive`がtrueの間、例えばカードをプレイした直後のアニメーション中)は、護符バッジのドラッグが開始できないことを確認する。
- コンソールエラーが出ていないことを確認する。

- [ ] **Step 3: 妨害行動発動時の演出との整合性を確認する**

デバッグ画面(`/admin/shidasu-debug`)で、複数護符を所持させた状態で以下の妨害行動を発動し、演出が正しく機能することを確認する:

- 「護符封印」(`talismanSeal`): 対象護符(名前が一致するもの全て)に斜めストライプ+フラッシュが適用されること。
- 「護符没収」(`talismanConfiscate`): 対象の1個だけが正確にフェードアウトすること(1個1バッジ化により、個数ベースだった判定が位置ベースになった影響を確認する)。
- 「護符並び替え」(`talismanShuffle`): 全護符バッジが同時にフラッシュ+シェイクし、以後「？？？」表示になること。

- [ ] **Step 4: 型チェック・ビルド・既存テストの最終確認**

Run: `npm run check`
Run: `npm run build`
Run: `npm test`
Expected: いずれもエラーなし
