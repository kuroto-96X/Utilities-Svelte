# タイトル画面のスプレッド選択UIをカルーセル形式に変更する Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** 「星詠みソリティア -Shidasu-」のタイトル画面で、全10スプレッドを縦一列のボタンで並べる現行UIを、1件ずつ表示して左右ボタンで切り替え・下部のスタートボタンで確定するカルーセル形式に変更する。

**Architecture:** `src/routes/game/shidasu/+page.svelte`のタイトル画面ブロック(`run.phase === 'title'`)のみを変更する。選択中インデックスをローカル`$state`で保持し、既存の`SPREAD_IDS`・`handleStartWithSpread`・`params.spreads`をそのまま活用する。切り替え時のフェード演出には`svelte/transition`の`fade`と`{#key}`ブロックを使う。

**Tech Stack:** SvelteKit, Svelte 5 runes, TypeScript

---

### Task 1: カルーセル状態管理関数の実装

**Files:**
- Modify: `src/routes/game/shidasu/+page.svelte:1-2` (import文に`fade`を追加)
- Modify: `src/routes/game/shidasu/+page.svelte:231-234` (`handleStartWithSpread`の直前に新規state・関数を追加)

このタスクにはロジック関数のみを追加する(UI変更はTask 2で行う)。このプロジェクトの`shidasu`配下にはUIコンポーネントの自動テストは無く(既存の`*.test.ts`は全てゲームロジック層が対象)、今回もタイトル画面のUI変更のみでロジック関数の複雑な分岐は無いため、このタスクはテストコードを新設せず、`npm run check`での型チェックと目視確認で検証する(設計docの「テスト方針」に準拠)。

- [ ] **Step 1: `svelte/transition`から`fade`をimportする**

`src/routes/game/shidasu/+page.svelte`の2行目、現在の内容:

```ts
  import { onDestroy } from 'svelte'
```

これを以下に変更する:

```ts
  import { onDestroy } from 'svelte'
  import { fade } from 'svelte/transition'
```

- [ ] **Step 2: 選択中インデックスのstateと切り替え関数を追加する**

`src/routes/game/shidasu/+page.svelte`の`handleStartWithSpread`関数(現在231-234行目)の直前に、以下を追加する:

```ts
  // タイトル画面のスプレッド選択カルーセルで現在表示中のSPREAD_IDSのインデックス(初期値0='fool'=愚者)。
  let selectedSpreadIndex = $state(0)

  function goToPrevSpread() {
    selectedSpreadIndex = (selectedSpreadIndex - 1 + SPREAD_IDS.length) % SPREAD_IDS.length
  }
  function goToNextSpread() {
    selectedSpreadIndex = (selectedSpreadIndex + 1) % SPREAD_IDS.length
  }

  function handleStartWithSpread(spreadId: SpreadId) {
    run = beginRun(params, undefined, spreadId)
    showStageScreen = true
  }
```

(`handleStartWithSpread`関数自体は変更しない。新規のstate宣言と2つの関数をその直前に挿入するだけ)

- [ ] **Step 3: 型チェックを実行する**

Run: `npm run check`
Expected: `+page.svelte`に起因する新規エラーなし。この時点では`selectedSpreadIndex`・`goToPrevSpread`・`goToNextSpread`はまだUIから参照されていないため、「未使用変数」の警告が出る可能性があるが、Task 2でUIから参照されるようになれば解消される。念のため警告内容を確認し、`+page.svelte`起因の警告であれば「Task 2で解消される想定」として問題視しなくてよい

- [ ] **Step 4: コミット**

```bash
git add src/routes/game/shidasu/+page.svelte
git commit -m "$(cat <<'EOF'
feat: タイトル画面のスプレッドカルーセル用state・切替関数を追加

Co-Authored-By: Claude Sonnet 5 <noreply@anthropic.com>
EOF
)"
```

---

### Task 2: タイトル画面UIをカルーセル形式に置き換える

**Files:**
- Modify: `src/routes/game/shidasu/+page.svelte:780-790` (スプレッド選択UIブロック全体を置き換える)

Task 1完了済み(`selectedSpreadIndex`・`goToPrevSpread`・`goToNextSpread`・`fade`のimportが追加済み)であることを前提とする。

- [ ] **Step 1: 現在のスプレッド選択UIブロックを確認する**

`src/routes/game/shidasu/+page.svelte`の現在の内容(780-790行目、Task 1の変更により行番号がずれている可能性があるため、`{#each SPREAD_IDS as spreadId (spreadId)}`という文字列で検索して正確な位置を特定すること):

```svelte
    <div class="flex flex-col gap-3 w-full max-w-xs">
      {#each SPREAD_IDS as spreadId (spreadId)}
        <button
          onclick={() => handleStartWithSpread(spreadId)}
          class="text-left bg-emerald-900/80 border border-yellow-500/40 rounded-xl px-4 py-3 active:scale-[0.98] transition-transform"
        >
          <div class="font-black text-yellow-300 text-lg">{params.spreads[spreadId].name}</div>
          <div class="text-xs text-emerald-100/80 mt-0.5">{params.spreads[spreadId].desc}</div>
        </button>
      {/each}
    </div>
```

- [ ] **Step 2: カルーセルUIに置き換える**

上記のブロックを、以下のカルーセルUIに置き換える:

```svelte
    <div class="flex flex-col gap-4 w-full max-w-xs">
      <div class="flex items-center gap-2">
        <button
          onclick={goToPrevSpread}
          aria-label="前のスプレッド"
          class="shrink-0 w-10 h-10 flex items-center justify-center text-2xl font-black text-yellow-300 bg-emerald-900/80 border border-yellow-500/40 rounded-full active:scale-95 transition-transform"
        >
          ◀
        </button>
        <div class="flex-1 min-w-0 bg-emerald-900/80 border border-yellow-500/40 rounded-xl px-4 py-3 text-left" style="min-height:5.5rem;">
          {#key selectedSpreadIndex}
            <div transition:fade={{ duration: 150 }}>
              <div class="font-black text-yellow-300 text-lg">{params.spreads[SPREAD_IDS[selectedSpreadIndex]].name}</div>
              <div class="text-xs text-emerald-100/80 mt-0.5">{params.spreads[SPREAD_IDS[selectedSpreadIndex]].desc}</div>
            </div>
          {/key}
        </div>
        <button
          onclick={goToNextSpread}
          aria-label="次のスプレッド"
          class="shrink-0 w-10 h-10 flex items-center justify-center text-2xl font-black text-yellow-300 bg-emerald-900/80 border border-yellow-500/40 rounded-full active:scale-95 transition-transform"
        >
          ▶
        </button>
      </div>
      <div class="flex justify-center gap-1.5">
        {#each SPREAD_IDS as spreadId, i (spreadId)}
          <span class="w-1.5 h-1.5 rounded-full {i === selectedSpreadIndex ? 'bg-yellow-300' : 'bg-emerald-100/30'}"></span>
        {/each}
      </div>
      <button
        onclick={() => handleStartWithSpread(SPREAD_IDS[selectedSpreadIndex])}
        class="bg-yellow-500 text-emerald-950 font-black text-lg rounded-xl px-4 py-3 active:scale-[0.98] transition-transform"
      >
        スタート
      </button>
    </div>
```

`min-height:5.5rem;`はスプレッド切り替え時に説明文の行数差でカード高さが変動し、下のドットインジケーター・スタートボタンの位置ががたつくのを防ぐための指定。実際にブラウザで確認して不足していれば、Step 3のブラウザ確認時に値を調整すること(全10スプレッドの説明文のうち最長のもの、`moon`(月)の説明文が収まる高さが目安)。

- [ ] **Step 3: 型チェックを実行する**

Run: `npm run check`
Expected: `+page.svelte`に起因する新規エラーなし。Task 1で追加した`selectedSpreadIndex`・`goToPrevSpread`・`goToNextSpread`の未使用警告が解消されていることを確認する

- [ ] **Step 4: ビルドを実行する**

Run: `npm run build`
Expected: ビルド成功

- [ ] **Step 5: 開発サーバーで動作確認する**

`npm run dev`で開発サーバーを起動し、`/game/shidasu`にアクセスして以下を確認する:

- タイトル画面の初期表示で、スプレッド名が「愚者」になっていること
- 「▶」ボタンを押すと次のスプレッド(「月」)に切り替わり、説明文もフェードで切り替わること
- 「▶」を9回押す(最後の`strength`「力」まで進める)と、さらに「▶」を押した際に最初の「愚者」に戻る(ループする)こと
- 「◀」ボタンを押すと前のスプレッドに戻ること。「愚者」の状態で「◀」を押すと最後の「力」に戻る(ループする)こと
- ドットインジケーターが10個表示され、選択中の位置のドットだけ色が変わっていること
- 任意のスプレッドを選んだ状態で「スタート」ボタンを押すと、そのスプレッドでランが開始されること(ショップ画面またはステージ開始画面に遷移し、画面内のスプレッド名表示(既存の`{params.spreads[run.spreadId].name}`表示箇所)が選択したスプレッド名と一致していること)
- ボタンタップだけでは(スタートボタンを押すまでは)ランが開始されないこと

**開発サーバーの停止方法(重要)**: 確認が終わったら、`netstat -ano | findstr :5173`(または実際に使われたポート、5173が使用中なら5174等になる)でPIDを特定し、`taskkill /F /PID <該当PID>`でそのプロセスのみを停止すること。**絶対に`taskkill /F /IM node.exe`のような全nodeプロセスを巻き込むコマンドを使わないこと**(過去のタスクでこれによりシステム上の無関係なnodeプロセスまで巻き込んで停止させてしまった事故があるため、厳守すること)。

- [ ] **Step 6: コミット**

```bash
git add src/routes/game/shidasu/+page.svelte
git commit -m "$(cat <<'EOF'
feat: タイトル画面のスプレッド選択UIをカルーセル形式に変更

Co-Authored-By: Claude Sonnet 5 <noreply@anthropic.com>
EOF
)"
```
