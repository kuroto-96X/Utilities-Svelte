# Culmen→Shidasu 内部コード全面リネーム Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Culmenの内部コード(フォルダ名・型名・設定ファイル名・URL)を、新しいタイトル「星詠みソリティア -Shidasu-」に合わせて`culmen`→`shidasu`に全面リネームする。

**Architecture:** `git mv`によるフォルダ・ファイルのリネームと、識別子(`CulmenParams`等)・importパス・URL文字列の一括置換を、ビルドが常に通る状態を保ちながら段階的に行う。lib層(Task 1)→ゲームルート(Task 2)→adminルート(Task 3)→ドキュメント(Task 4)の順で進める。このゲームはまだ`master`にマージされておらず本番未公開のため、URL変更によるSEO・既存ブックマークへの影響はない。

**Tech Stack:** SvelteKit(Svelte 5) / TypeScript / Vitest / Vite

---

## 事前確認

- [ ] **Step 1: 作業ブランチを確認する**

```bash
git branch --show-current
```

Expected: `feat`(または `feat-*`)。

---

### Task 1: libフォルダのリネームと型名・設定ファイル名の変更

**Files:**
- Rename: `src/lib/game/culmen/` → `src/lib/game/shidasu/`(フォルダごと)
- Rename: `src/lib/game/shidasu/culmen.config.json` → `src/lib/game/shidasu/shidasu.config.json`
- Modify: `src/lib/game/shidasu/types.ts`
- Modify: `src/lib/game/shidasu/params.ts`
- Modify: `src/lib/game/shidasu/params.test.ts`
- Modify: `src/lib/game/shidasu/engine.ts`
- Modify: `src/lib/game/shidasu/engine.test.ts`
- Modify: `vite.config.ts`
- Modify: `src/routes/game/culmen/+page.svelte`(importパスのみ。フォルダ自体のリネームはTask 2)
- Modify: `src/routes/game/culmen/DebugPanel.svelte`(importパスのみ。フォルダ自体のリネームはTask 2)
- Modify: `src/routes/admin/culmen/+page.svelte`(importパス・型名・API呼び出しURL。フォルダ自体のリネームはTask 3)

- [ ] **Step 1: フォルダとファイルをリネームする**

```bash
git mv src/lib/game/culmen src/lib/game/shidasu
git mv src/lib/game/shidasu/culmen.config.json src/lib/game/shidasu/shidasu.config.json
```

- [ ] **Step 2: `types.ts`のヘッダーコメントを更新する**

`src/lib/game/shidasu/types.ts`の1行目:
```ts
// src/lib/game/culmen/types.ts
```
を
```ts
// src/lib/game/shidasu/types.ts
```
に置き換える。

- [ ] **Step 3: `params.ts`を更新する**

`src/lib/game/shidasu/params.ts`の1〜2行目:
```ts
// src/lib/game/culmen/params.ts
import culmenConfigJson from './culmen.config.json'
```
を
```ts
// src/lib/game/shidasu/params.ts
import shidasuConfigJson from './shidasu.config.json'
```
に置き換える。

続けて、同ファイル内の`CulmenParams`という識別子をすべて`ShidasuParams`に置き換える(`export interface CulmenParams {`・`export const DEFAULT_PARAMS: CulmenParams = {`・`export function loadParams(): CulmenParams {`の3箇所)。あわせて`return culmenConfigJson as CulmenParams`を`return shidasuConfigJson as ShidasuParams`に置き換える。

Run(置換後、他に取りこぼしがないか確認):
```bash
grep -n "CulmenParams\|culmenConfigJson" src/lib/game/shidasu/params.ts
```
Expected: 一致なし(何も出力されない)

- [ ] **Step 4: `engine.ts`を更新する**

`src/lib/game/shidasu/engine.ts`の1行目:
```ts
// src/lib/game/culmen/engine.ts
```
を
```ts
// src/lib/game/shidasu/engine.ts
```
に置き換える。

続けて、同ファイル内の`CulmenParams`という識別子をすべて`ShidasuParams`に置き換える(`import type { CulmenParams } from './params'`を含め、関数シグネチャの引数型・`CulmenParams['scoring']`のようなインデックス型アクセスも含め、ファイル内の全出現箇所が対象)。

Run(置換後の確認):
```bash
grep -n "CulmenParams" src/lib/game/shidasu/engine.ts
```
Expected: 一致なし(何も出力されない)

Run(`ShidasuParams`に正しく置き換わったことの確認):
```bash
grep -c "ShidasuParams" src/lib/game/shidasu/engine.ts
```
Expected: `15`(importの1箇所 + 関数シグネチャ等13箇所 + `CulmenParams['scoring']`アクセスの2箇所、のように元の`CulmenParams`出現数と同じ件数になる。実際の件数は元ファイルの`CulmenParams`出現数と一致していればよい)

- [ ] **Step 5: `engine.test.ts`のヘッダーコメントを更新する**

`src/lib/game/shidasu/engine.test.ts`の1行目:
```ts
// src/lib/game/culmen/engine.test.ts
```
を
```ts
// src/lib/game/shidasu/engine.test.ts
```
に置き換える。

- [ ] **Step 6: `params.test.ts`を更新する**

`src/lib/game/shidasu/params.test.ts`の3行目:
```ts
import culmenConfigJson from './culmen.config.json'
```
を
```ts
import shidasuConfigJson from './shidasu.config.json'
```
に置き換える。

48〜49行目:
```ts
  test('culmen.config.json の内容をそのまま返す', () => {
    expect(loadParams()).toEqual(culmenConfigJson)
```
を
```ts
  test('shidasu.config.json の内容をそのまま返す', () => {
    expect(loadParams()).toEqual(shidasuConfigJson)
```
に置き換える。

- [ ] **Step 7: `vite.config.ts`を更新する**

35〜36行目のコメント:
```ts
// admin配下の各設定ページが使う「JSONファイルをGET/POSTで読み書きするだけ」のdevサーバーAPIを生成する共通ファクトリ。
// site.config.json / anim.config.json / culmen.config.json はいずれもこの形で提供する。
```
を
```ts
// admin配下の各設定ページが使う「JSONファイルをGET/POSTで読み書きするだけ」のdevサーバーAPIを生成する共通ファクトリ。
// site.config.json / anim.config.json / shidasu.config.json はいずれもこの形で提供する。
```
に置き換える。

83〜85行目:
```ts
function culmenConfigApiPlugin(): Plugin {
  return jsonFileApiPlugin('culmen-config-api', '/api/admin/culmen-config', 'src/lib/game/culmen/culmen.config.json')
}
```
を
```ts
function shidasuConfigApiPlugin(): Plugin {
  return jsonFileApiPlugin('shidasu-config-api', '/api/admin/shidasu-config', 'src/lib/game/shidasu/shidasu.config.json')
}
```
に置き換える。

88行目:
```ts
  plugins: [sveltekit(), kuromojiDictRawPlugin(), adminApiPlugin(), animConfigApiPlugin(), culmenConfigApiPlugin()],
```
を
```ts
  plugins: [sveltekit(), kuromojiDictRawPlugin(), adminApiPlugin(), animConfigApiPlugin(), shidasuConfigApiPlugin()],
```
に置き換える。

95行目:
```ts
      ignored: ['**/site.config.json', '**/anim.config.json', '**/culmen.config.json']
```
を
```ts
      ignored: ['**/site.config.json', '**/anim.config.json', '**/shidasu.config.json']
```
に置き換える。

- [ ] **Step 8: `src/routes/game/culmen/+page.svelte`のimportパスを更新する**

3・8・9行目付近の以下3箇所:
```ts
  import { loadParams } from '$lib/game/culmen/params'
```
```ts
  } from '$lib/game/culmen/engine'
```
```ts
  import type { RunState, Card, ItemId, StageModifier, WaveState, Suit, Rank } from '$lib/game/culmen/types'
```
を、それぞれ`$lib/game/culmen/`→`$lib/game/shidasu/`に置き換える(`params`・`engine`・`types`という末尾のファイル名部分は変更しない)。

- [ ] **Step 9: `src/routes/game/culmen/DebugPanel.svelte`のimportパスを更新する**

3・4行目:
```ts
  import { analyzeSuitColor, analyzeStair, isRed, rankLabel } from '$lib/game/culmen/engine'
  import type { WaveState, Suit, Rank, ScoreGain } from '$lib/game/culmen/types'
```
を
```ts
  import { analyzeSuitColor, analyzeStair, isRed, rankLabel } from '$lib/game/shidasu/engine'
  import type { WaveState, Suit, Rank, ScoreGain } from '$lib/game/shidasu/types'
```
に置き換える。

- [ ] **Step 10: `src/routes/admin/culmen/+page.svelte`を更新する**

3行目:
```ts
  import { DEFAULT_PARAMS, type CulmenParams } from '$lib/game/culmen/params'
```
を
```ts
  import { DEFAULT_PARAMS, type ShidasuParams } from '$lib/game/shidasu/params'
```
に置き換える。

続けて、同ファイル内の`CulmenParams`という識別子をすべて`ShidasuParams`に置き換える(`$state<CulmenParams | null>(null)`・`await res.json() as CulmenParams`・`function isValidCulmenParams(value: unknown): value is CulmenParams`・`isValidCulmenParams(parsed)`という呼び出し・`setScoring<K extends keyof CulmenParams['scoring']>`・`config.scoring[key] = value as CulmenParams['scoring'][K]`・`setItems<K extends keyof CulmenParams['items']>`・`config.items[key] = value as CulmenParams['items'][K]`)。

Run(置換後の確認):
```bash
grep -n "CulmenParams" src/routes/admin/culmen/+page.svelte
```
Expected: 一致なし(何も出力されない)

39行目:
```ts
      const res = await fetch('/api/admin/culmen-config')
```
を
```ts
      const res = await fetch('/api/admin/shidasu-config')
```
に置き換える。

45行目:
```ts
      error = 'Culmen設定APIに接続できません。npm run dev で起動してください。'
```
を
```ts
      error = 'Shidasu設定APIに接続できません。npm run dev で起動してください。'
```
に置き換える。

53行目:
```ts
      const res = await fetch('/api/admin/culmen-config', {
```
を
```ts
      const res = await fetch('/api/admin/shidasu-config', {
```
に置き換える。

- [ ] **Step 11: 型チェックとテストを実行する**

Run: `npm run check`
Expected: `culmen`・`Culmen`関連のエラーなし(既存の無関係なエラーのみ残る)

Run: `npm run test`
Expected: 全ファイルPASS

- [ ] **Step 12: 「culmen」という文字列(小文字)が残っていないことを確認する**

Run: `grep -rli "culmen" src/ vite.config.ts`
Expected: 一致なし(何も出力されない)

- [ ] **Step 13: コミット**

```bash
git add -A
git commit -m "feat: Culmenのlib層をshidasuにリネーム(フォルダ・型名・設定ファイル名)"
```

## Context

このタスク完了時点では、`src/routes/game/culmen/`・`src/routes/admin/culmen/`のフォルダ自体はまだリネームされていない(URLは`/game/culmen`・`/admin/culmen`のまま)。ただしフォルダの中身(import文・型名・API呼び出しURL)はすべて新しい`shidasu`表記に揃っているため、アプリ全体は一貫して動作する(`vite.config.ts`のAPIルートも`/api/admin/shidasu-config`に揃えたため、admin/culmenページの保存機能も正しく動く)。フォルダ自体のリネーム(URL変更)はTask 2・3で行う。

---

### Task 2: ゲームルートのフォルダリネーム

**Files:**
- Rename: `src/routes/game/culmen/` → `src/routes/game/shidasu/`(フォルダごと。`+page.svelte`・`DebugPanel.svelte`を含む)
- Modify: `src/lib/site.ts`

- [ ] **Step 1: フォルダをリネームする**

```bash
git mv src/routes/game/culmen src/routes/game/shidasu
```

- [ ] **Step 2: `src/lib/site.ts`のhrefを更新する**

```ts
      href: "/game/culmen",
```
を
```ts
      href: "/game/shidasu",
```
に置き換える。

- [ ] **Step 3: `src/lib/site.config.json`のキーを更新する**

`toolDevStatus`内の
```json
    "/game/culmen": true
```
を
```json
    "/game/shidasu": true
```
に、`toolVisibility`内の
```json
    "/game/culmen": true
```
を
```json
    "/game/shidasu": true
```
にそれぞれ置き換える(2箇所とも)。

- [ ] **Step 4: 型チェックとテストを実行する**

Run: `npm run check`
Expected: `culmen`・`Culmen`関連のエラーなし

Run: `npm run test`
Expected: 全ファイルPASS

- [ ] **Step 5: 開発サーバーで動作確認する**

Run: `npm run dev`(既に起動中でなければ)

ブラウザで以下を確認する:
- `/game/shidasu`にアクセスすると正常にゲームが表示される
- `/game/culmen`(旧URL)にアクセスすると404になる(SvelteKitがフォルダ構成に基づいてルーティングするため、リネーム後は自動的に旧URLが無効になる。今回はリダイレクト設定を追加しないため、これが正しい挙動)
- サイト共通ナビゲーションのゲームカテゴリのリンクが`/game/shidasu`を指している
- コンソールエラーが出ていない

- [ ] **Step 6: コミット**

```bash
git add -A
git commit -m "feat: Culmenのゲームルートをshidasuにリネーム(/game/culmen→/game/shidasu)"
```

---

### Task 3: adminルートのフォルダリネーム

**Files:**
- Rename: `src/routes/admin/culmen/` → `src/routes/admin/shidasu/`(フォルダごと)
- Modify: `src/routes/admin/+page.svelte`

- [ ] **Step 1: フォルダをリネームする**

```bash
git mv src/routes/admin/culmen src/routes/admin/shidasu
```

- [ ] **Step 2: `src/routes/admin/+page.svelte`のhrefを更新する**

```svelte
    <a href="/admin/culmen" class="flex items-center gap-3 px-4 py-4 hover:bg-slate-50 transition-colors group">
```
を
```svelte
    <a href="/admin/shidasu" class="flex items-center gap-3 px-4 py-4 hover:bg-slate-50 transition-colors group">
```
に置き換える。

- [ ] **Step 3: 型チェックとテストを実行する**

Run: `npm run check`
Expected: `culmen`・`Culmen`関連のエラーなし

Run: `npm run test`
Expected: 全ファイルPASS

- [ ] **Step 4: 開発サーバーで動作確認する**

Run: `npm run dev`(既に起動中でなければ)

ブラウザで以下を確認する:
- `/admin/shidasu`にアクセスすると設定画面が正常に表示される
- 設定値を変更して保存すると、`src/lib/game/shidasu/shidasu.config.json`に正しく保存される
- `/admin`の一覧ページのリンクが`/admin/shidasu`を指している
- コンソールエラーが出ていない

- [ ] **Step 5: コミット**

```bash
git add -A
git commit -m "feat: Culmenのadminルートをshidasuにリネーム(/admin/culmen→/admin/shidasu)"
```

---

### Task 4: ロードマップドキュメントのリネーム

**Files:**
- Rename: `docs/culmen-roadmap.md` → `docs/shidasu-roadmap.md`

- [ ] **Step 1: ファイルをリネームする**

```bash
git mv docs/culmen-roadmap.md docs/shidasu-roadmap.md
```

- [ ] **Step 2: タイトル行を更新する**

`docs/shidasu-roadmap.md`の1行目:
```md
# 登頂ソリティア -Culmen- 今後の改善計画
```
を
```md
# 星詠みソリティア -Shidasu- 今後の改善計画
```
に置き換える。

- [ ] **Step 3: コミット**

```bash
git add -A
git commit -m "docs: culmen-roadmap.mdをshidasu-roadmap.mdにリネーム"
```

## Context

`docs/superpowers/specs/`・`docs/superpowers/plans/`配下の過去の設計書・実装計画書は、当時の意思決定の記録として`culmen`表記のまま残す(リネーム対象外)。

---

### Task 5: 最終検証

**Files:** なし(検証のみ)

- [ ] **Step 1: 全テストを実行する**

Run: `npm run test`
Expected: 全ファイルPASS

- [ ] **Step 2: 型チェック・Lintを実行する**

Run: `npm run check`
Expected: `culmen`・`Culmen`関連のエラーなし

- [ ] **Step 3: 本番ビルドを実行する**

Run: `npm run build`
Expected: ビルド成功

- [ ] **Step 4: 「culmen」という文字列が`src/`・`vite.config.ts`に残っていないことを最終確認する**

Run: `grep -rli "culmen" src/ vite.config.ts`
Expected: 一致なし(何も出力されない)

- [ ] **Step 5: 開発サーバーで受け入れ基準を一通り確認する**

Run: `npm run dev`

- `/game/shidasu`でゲームが正常にプレイできる(場札プレイ・山札引き・アイテム選択まで一通り)
- `/admin/shidasu`で設定の閲覧・変更・保存ができる
- `/admin`一覧・サイト共通ナビからそれぞれ正しいリンクで遷移できる
- 既存アイテム名(紅の目利き等)・スコア計算・チェーン表示など、ゲームロジック自体は一切変化していない
- コンソールエラーが出ていない

- [ ] **Step 6: 最終コミット(検証中に見つかった不具合を修正した場合のみ)**

```bash
git add -A
git commit -m "fix: culmen→shidasuリネームの最終検証で見つかった不具合を修正"
```

---

## 自己レビュー結果

- **範囲網羅性**: lib層(フォルダ・型名・設定ファイル名・vite.config.ts)→Task 1、ゲームルート(フォルダ・site.ts・site.config.json)→Task 2、adminルート(フォルダ・admin/+page.svelteのリンク)→Task 3、ドキュメント→Task 4、最終検証→Task 5、で全て対応済み。過去の設計書・計画書(`docs/superpowers/`配下)は意図的にリネーム対象外としている。
- **プレースホルダー**: なし。全ステップに置換前後の実際の文字列・コマンドを記載。
- **型・識別子の一貫性**: `CulmenParams`→`ShidasuParams`という識別子名の変更が、`params.ts`(定義)→`engine.ts`(使用)→`admin/culmen/+page.svelte`(使用)の全箇所で一貫していることを確認済み。`culmenConfigJson`→`shidasuConfigJson`という変数名も`params.ts`と`params.test.ts`の両方で一致させている。APIルート`/api/admin/shidasu-config`は`vite.config.ts`(Task 1)と`admin/culmen/+page.svelte`のfetch呼び出し(Task 1)の両方で同時に更新しており、ズレが生じないようにしている。
- **段階的な動作保証**: 各タスク完了時点で`npm run test`・`npm run check`・`npm run build`が通り、実際にブラウザで動作確認できる状態を保つよう順序を設計した(Task 1でlib層とそれを参照する全ファイルのimport・URLを先に揃え、Task 2・3でフォルダ自体の物理的なリネーム=URL変更のみを行う)。
