# PlayArea.svelteアニメーション中判定共通化リファクタ 実装プラン

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** `src/routes/game/shidasu/PlayArea.svelte`にある「いずれかのアニメーションが進行中か」の判定論理式(5箇所で重複)を、単一の`$derived`変数`anyAnimationActive`に集約する。

**Architecture:** 既存の5つのアニメーション状態変数(`playingAnimation`・`scoreReveal`・`cleanupAnimation`・`chainResetAnimation`・`dealAnimationActive`)が全て宣言済みになる位置に`$derived`変数を1つ追加し、5箇所のインライン論理式(通常形・否定形)をこの変数の参照に置き換える。`PlayArea.svelte`単体で完結し、他コンポーネントへの影響は無い。純粋なリファクタであり挙動は一切変更しない。

**Tech Stack:** SvelteKit, Svelte 5, TypeScript

**設計書:** `docs/superpowers/specs/2026-08-15-shidasu-playarea-animation-flag-refactor-design.md`

---

## Task 1: `anyAnimationActive`の追加と5箇所の置き換え

**Files:**
- Modify: `src/routes/game/shidasu/PlayArea.svelte`

- [ ] **Step 1: `anyAnimationActive`を`$derived`変数として追加する**

`src/routes/game/shidasu/PlayArea.svelte`内、以下の行(`grep -n "let dealAnimationActive = \$derived"`で位置を特定できる):

```ts
  let dealAnimationActive = $derived(dealingCards.length > 0)
```

を以下に置き換える(直後に`anyAnimationActive`を追加する):

```ts
  let dealAnimationActive = $derived(dealingCards.length > 0)
  // いずれかのアニメーション(カードプレイ・得点演出・清算・チェーンリセット・配布)が進行中かどうか。
  // 進行中は操作(カードプレイ・山札引き・秘儀/天啓使用)を無効化する。
  let anyAnimationActive = $derived(playingAnimation !== null || scoreReveal !== null || cleanupAnimation !== null || chainResetAnimation !== null || dealAnimationActive)
```

- [ ] **Step 2: カード枠の`disabled`属性・ハイライト表示条件を置き換える**

続けて同ファイル内、以下の行(`grep -n "disabled={playingAnimation !== null || scoreReveal !== null"`で位置を特定できる。1箇所目):

```svelte
                disabled={playingAnimation !== null || scoreReveal !== null || cleanupAnimation !== null || chainResetAnimation !== null || dealAnimationActive}
                onclick={() => (columnTargetMode ? (isTargetable && onTargetColumn?.(ci)) : (isCardPlayable && startPlayCardAnimation(ci, ri, card)))}
                class="block w-full text-left {columnTargetMode ? (isTargetable ? 'ring-2 ring-fuchsia-400 shadow-lg -translate-y-0.5' : '') : (isCardPlayable && playingAnimation === null && scoreReveal === null && cleanupAnimation === null && chainResetAnimation === null && !dealAnimationActive ? 'ring-2 ring-yellow-300 shadow-lg -translate-y-0.5' : '')} transition-transform disabled:cursor-not-allowed"
```

を以下に置き換える:

```svelte
                disabled={anyAnimationActive}
                onclick={() => (columnTargetMode ? (isTargetable && onTargetColumn?.(ci)) : (isCardPlayable && startPlayCardAnimation(ci, ri, card)))}
                class="block w-full text-left {columnTargetMode ? (isTargetable ? 'ring-2 ring-fuchsia-400 shadow-lg -translate-y-0.5' : '') : (isCardPlayable && !anyAnimationActive ? 'ring-2 ring-yellow-300 shadow-lg -translate-y-0.5' : '')} transition-transform disabled:cursor-not-allowed"
```

- [ ] **Step 3: 山札引きボタンの`disabled`属性を置き換える**

続けて同ファイル内、以下の行(`grep -n "disabled={wave.stock.length === 0"`で位置を特定できる):

```svelte
      disabled={wave.stock.length === 0 || !allowDraw || playingAnimation !== null || scoreReveal !== null || cleanupAnimation !== null || chainResetAnimation !== null || dealAnimationActive}
```

を以下に置き換える:

```svelte
      disabled={wave.stock.length === 0 || !allowDraw || anyAnimationActive}
```

- [ ] **Step 4: 秘儀・天啓の使用可否判定を置き換える**

続けて同ファイル内、以下の2行(`grep -n "{@const usable = canUseRite\|{@const usable = canUseRevelation"`で両方の位置を特定できる):

```svelte
      {@const usable = canUseRite(params, wave, riteId) && playingAnimation === null && scoreReveal === null && cleanupAnimation === null && chainResetAnimation === null && !dealAnimationActive}
```

を以下に置き換える:

```svelte
      {@const usable = canUseRite(params, wave, riteId) && !anyAnimationActive}
```

続けて、以下の行:

```svelte
      {@const usable = canUseRevelation(params, wave, revelationId, relics) && playingAnimation === null && scoreReveal === null && cleanupAnimation === null && chainResetAnimation === null && !dealAnimationActive}
```

を以下に置き換える:

```svelte
      {@const usable = canUseRevelation(params, wave, revelationId, relics) && !anyAnimationActive}
```

- [ ] **Step 5: 型チェックを実行する**

Run: `npm run check`
Expected: エラー無し

- [ ] **Step 6: ビルドを実行する**

Run: `npm run build`
Expected: 成功

- [ ] **Step 7: フルテストスイートを実行する**

Run: `npx vitest run`
Expected: 全件PASS(`PlayArea.svelte`はUIコンポーネントで直接のユニットテストは無いが、他の既存テストに影響が無いことを確認する)

- [ ] **Step 8: 開発サーバーで目視確認する**

Run: `npm run dev`(既にポート5173で稼働中ならこのステップはスキップしてよい)

`http://localhost:5173/game/shidasu`でプレイを進め、以下を確認する:
- カードプレイ中(飛んでいくアニメーション中)は、カード枠・山札引きボタン・秘儀/天啓ボタンが無効化され、アニメーション終了後に再度有効化される
- 山札引き演出中も同様に無効化・再有効化される
- Waveクリア後の清算演出中も同様
- チェーンリセット時の演出中も同様
- Wave開始時の配布演出中も同様

ブラウザ操作が困難な環境であれば、型チェック・ビルドの成功で代替してよい。

- [ ] **Step 9: コミット**

```bash
git add src/routes/game/shidasu/PlayArea.svelte
git commit -m "refactor: PlayArea.svelteのアニメーション中判定をanyAnimationActiveに集約する"
```

---

## 最終確認

- [ ] `npm run build`を実行し、ビルドが通ることを確認する
- [ ] `npm run check`を実行し、型エラーが無いことを確認する
- [ ] `npx vitest run`を実行し、全テストがPASSすることを確認する
- [ ] `npm run dev`でブラウザから一通りのアニメーション(カードプレイ・山札引き・清算・チェーンリセット・配布)中の操作無効化を確認する
- [ ] `docs/shidasu/shidasu-roadmap.md`に今回のリファクタ完了を反映する
