# Culmenのタイトル表示変更 Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** 画面に表示されている「登頂ソリティア -Culmen-」という文字列を、新しい世界観に合わせた「星詠みソリティア -Shidasu-」に置き換える。

**Architecture:** 4つのファイルに埋め込まれた表示用文字列を置き換えるだけの変更。URL(`/game/culmen`)・フォルダ構成・型名(`CulmenParams`等)・変数名は一切変更しない。エンジン(`engine.ts`)・アイテムの個別名や効果も変更しない。

**Tech Stack:** SvelteKit(Svelte 5) / TypeScript

**Spec:** `docs/superpowers/specs/2026-07-09-culmen-theme-and-item-motif-design.md`

---

## 事前確認

- [ ] **Step 1: 作業ブランチを確認する**

```bash
git branch --show-current
```

Expected: `feat`(または `feat-*`)。

---

### Task 1: タイトル表示文字列を置き換える

**Files:**
- Modify: `src/lib/site.ts`
- Modify: `src/routes/admin/+page.svelte`
- Modify: `src/routes/admin/culmen/+page.svelte`
- Modify: `src/routes/game/culmen/+page.svelte`

- [ ] **Step 1: 現在の該当箇所を確認する**

以下4箇所に、変更対象の文字列があることを確認する:

`src/lib/site.ts:114`
```ts
      label: "登頂ソリティア -Culmen-",
```

`src/routes/admin/+page.svelte:25`
```svelte
        <p class="text-sm font-semibold text-slate-700 group-hover:text-teal-700">登頂ソリティア -Culmen- 設定</p>
```

`src/routes/admin/culmen/+page.svelte:154`
```svelte
    <h1 class="text-2xl font-bold text-slate-800">登頂ソリティア -Culmen- 設定</h1>
```

`src/routes/game/culmen/+page.svelte:316`
```svelte
      <h1 class="text-4xl font-black text-amber-50">登頂ソリティア -Culmen-</h1>
```

- [ ] **Step 2: `src/lib/site.ts`を変更する**

```ts
      label: "登頂ソリティア -Culmen-",
```
を
```ts
      label: "星詠みソリティア -Shidasu-",
```
に置き換える。

- [ ] **Step 3: `src/routes/admin/+page.svelte`を変更する**

```svelte
        <p class="text-sm font-semibold text-slate-700 group-hover:text-teal-700">登頂ソリティア -Culmen- 設定</p>
```
を
```svelte
        <p class="text-sm font-semibold text-slate-700 group-hover:text-teal-700">星詠みソリティア -Shidasu- 設定</p>
```
に置き換える。

- [ ] **Step 4: `src/routes/admin/culmen/+page.svelte`を変更する**

```svelte
    <h1 class="text-2xl font-bold text-slate-800">登頂ソリティア -Culmen- 設定</h1>
```
を
```svelte
    <h1 class="text-2xl font-bold text-slate-800">星詠みソリティア -Shidasu- 設定</h1>
```
に置き換える。

- [ ] **Step 5: `src/routes/game/culmen/+page.svelte`を変更する**

```svelte
      <h1 class="text-4xl font-black text-amber-50">登頂ソリティア -Culmen-</h1>
```
を
```svelte
      <h1 class="text-4xl font-black text-amber-50">星詠みソリティア -Shidasu-</h1>
```
に置き換える。

- [ ] **Step 6: 「登頂ソリティア」という文字列が他に残っていないことを確認する**

Run: `grep -rn "登頂ソリティア" src/`
Expected: 一致なし(何も出力されない)

- [ ] **Step 7: Lintと型チェックを実行する**

Run: `npx eslint src/lib/site.ts src/routes/admin/ src/routes/game/culmen/`
Expected: エラーなし

Run: `npm run check`
Expected: culmen関連のエラーなし

- [ ] **Step 8: 全体テストスイートを実行する**

Run: `npm run test`
Expected: 全ファイルPASS(表示文字列のみの変更のため、既存テストへの影響はないはず)

- [ ] **Step 9: 開発サーバーで動作確認する**

Run: `npm run dev`(既に起動中でなければ)

ブラウザで以下を確認する:
- サイトの共通ナビゲーション(ゲームカテゴリ)に「星詠みソリティア -Shidasu-」が表示されている
- `/admin`の一覧ページに「星詠みソリティア -Shidasu- 設定」のリンクカードが表示されている
- `/admin/culmen`の見出しが「星詠みソリティア -Shidasu- 設定」になっている
- `/game/culmen`のタイトル画面の見出しが「星詠みソリティア -Shidasu-」になっている
- ゲームを実際にプレイし、アイテム名(紅の目利き等)・効果・URL(`/game/culmen`)が変更前と変わっていないことを確認する
- コンソールエラーが出ていない

- [ ] **Step 10: コミット**

```bash
git add src/lib/site.ts src/routes/admin/+page.svelte src/routes/admin/culmen/+page.svelte src/routes/game/culmen/+page.svelte
git commit -m "feat: Culmenの表示タイトルを「星詠みソリティア -Shidasu-」に変更"
```

---

### Task 2: 最終検証

**Files:** なし(検証のみ)

- [ ] **Step 1: 全テストを実行する**

Run: `npm run test`
Expected: 全ファイルPASS

- [ ] **Step 2: 型チェック・Lintを実行する**

Run: `npm run check && npx eslint src/lib/site.ts src/routes/admin/ src/routes/game/culmen/`
Expected: culmen関連のエラーなし

- [ ] **Step 3: 本番ビルドを実行する**

Run: `npm run build`
Expected: ビルド成功

- [ ] **Step 4: 受け入れ基準を一通り確認する**

`docs/superpowers/specs/2026-07-09-culmen-theme-and-item-motif-design.md`の「5. 受け入れ基準」を上から順に確認する:
1. 設計書に世界観・タイトル・アイテム4種類の呼称/英語名/モチーフ/個数が明記されている(spec文書自体で完了済み)
2. `/game/culmen`のタイトル画面に「星詠みソリティア -Shidasu-」が表示される(Task 1 Step 9で確認済み)
3. `/admin/culmen`の見出しに「星詠みソリティア -Shidasu-」が表示される(Task 1 Step 9で確認済み)
4. `/admin`の一覧ページのリンクカードに「星詠みソリティア -Shidasu-」が表示される(Task 1 Step 9で確認済み)
5. サイト共通ナビゲーションに「星詠みソリティア -Shidasu-」が表示される(Task 1 Step 9で確認済み)
6. URL(`/game/culmen`)・フォルダ構成・型名は変更されていない(Task 1では該当箇所を一切変更していないため自明。`git diff`で変更ファイルが4つの表示専用ファイルのみであることを再確認する)
7. 既存の7個のアイテムの個別名・効果は変更されていない(`src/lib/game/culmen/engine.ts`のITEM_NAMES/itemDescを本プランでは一切変更していないため自明。`git status`で`engine.ts`が変更対象に含まれていないことを確認する)
8. `npm run test`・`npm run build`が成功する(Step 1・3で確認済み)

- [ ] **Step 5: 最終コミット(検証中に見つかった不具合を修正した場合のみ)**

```bash
git add -A
git commit -m "fix: タイトル変更の最終検証で見つかった不具合を修正"
```

---

## 自己レビュー結果

- **スペック網羅性**: 2節(タイトル)→Task 1、2.1節(変更対象4箇所)→Task 1の各Step、4節(スコープ外の明示)→Task 1では対象外ファイルに一切触れないことで担保、5節(受け入れ基準)→Task 2、で対応済み。3節(アイテム種類の呼称・モチーフ)は設計書(spec文書)自体がドキュメントとしての成果物であり、コード変更を伴わないため、実装タスクは不要(spec文書はすでに書いてコミット済み)。
- **プレースホルダー**: なし。全タスクに実際の置き換え前後の文字列を記載。
- **型・関数名の一貫性**: 該当なし(型・関数の変更を伴わない、純粋な表示文字列の置き換えのみ)。
