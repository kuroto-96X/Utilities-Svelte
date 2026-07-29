# 星パラメータ管理画面の本格UI化 Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** 星パラメータ管理画面(`admin/shidasu-bosses`)を、ヘッダークリックソート・説明文テンプレート編集(プレビュー付き)・行単位バリデーション表示を備えた本格的なUIに引き上げる。

**Architecture:** `params.stars`に`descTemplate`フィールドを追加し、`Star`型・`toStarRestriction`・ゲーム画面側`starRestrictionDetail`をテンプレート展開方式に統一する。管理画面はソート・バリデーション表示・デフォルト値変更・Wave3一括更新ボタンを追加する。

**Tech Stack:** SvelteKit, Svelte 5 runes, TypeScript, Vitest

---

## 前提知識(実装者が押さえておくべき既存コード)

**`Star`型(`src/lib/game/shidasu/types.ts:32-40`):**
```ts
export interface Star {
  id: string
  name: string
  waveSlot: 1 | 2 | 3
  targetMultiplier: number
  reward: number
  restriction: StarRestriction
  sabotage: null
}
```

**`params.ts`の`stars`型定義(`src/lib/game/shidasu/params.ts:29-37`):**
```ts
stars: {
  id: string
  name: string
  waveSlot: 1 | 2 | 3
  targetMultiplier: number
  reward: number
  restrictionKind: 'none' | 'noLoop' | 'faceLock' | 'lowCombo' | 'oddCombo' | 'suit' | 'face'
  maxCombo?: number
}[]
```

**`toStarRestriction`(`src/lib/game/shidasu/engine.ts:927-939`):**
```ts
function toStarRestriction(entry: ShidasuParams['stars'][number], rand: () => number): StarRestriction {
  switch (entry.restrictionKind) {
    case 'none': return null
    case 'noLoop': return { kind: 'noLoop' }
    case 'faceLock': return { kind: 'faceLock' }
    case 'lowCombo': return { kind: 'lowCombo', maxCombo: entry.maxCombo ?? 2 }
    case 'oddCombo': return { kind: 'oddCombo' }
    case 'suit': return { kind: 'suit', suit: GREAT_MISFORTUNE_SUITS[Math.floor(rand() * GREAT_MISFORTUNE_SUITS.length)] }
    case 'face': return { kind: 'face' }
  }
}
```

**`rollStarForSlot`(`src/lib/game/shidasu/engine.ts:944-961`)、星選出時に`Star`を組み立てる箇所:**
```ts
function rollStarForSlot(params: ShidasuParams, waveSlot: 1 | 2 | 3, rand: () => number, excludeId?: string): Star {
  const allCandidates = params.stars.filter(s => s.waveSlot === waveSlot)
  if (allCandidates.length === 0) {
    return { id: `fallback-${waveSlot}`, name: '名もなき星', waveSlot, targetMultiplier: 1, reward: 0, restriction: null, sabotage: null }
  }
  const candidates = excludeId && allCandidates.length > 1 ? allCandidates.filter(s => s.id !== excludeId) : allCandidates
  const entry = candidates[Math.floor(rand() * candidates.length)]
  return {
    id: entry.id,
    name: entry.name,
    waveSlot: entry.waveSlot,
    targetMultiplier: entry.targetMultiplier,
    reward: entry.reward,
    restriction: toStarRestriction(entry, rand),
    sabotage: null,
  }
}
```

**ゲーム画面側`starRestrictionDetail`(`src/routes/game/shidasu/+page.svelte:36-46`):**
```ts
function starRestrictionDetail(star: Star): string {
  if (!star.restriction) return ''
  switch (star.restriction.kind) {
    case 'suit': return `${star.restriction.suit}で無得点`
    case 'noLoop': return 'A⇔Kループ禁止'
    case 'faceLock': return '絵札はコンボ2以上でのみ取得可'
    case 'lowCombo': return `${star.restriction.maxCombo}コンボ以下で無得点`
    case 'oddCombo': return 'コンボが奇数のとき無得点'
    case 'face': return '絵札(J・Q・K)で無得点'
  }
}
```

**`revelations.ts`のテンプレート展開パターン(`src/lib/game/shidasu/revelations.ts:19-26`)、今回踏襲するパターン:**
```ts
export function revelationDesc(id: RevelationId, params: ShidasuParams): string {
  const entry = params.revelations[id] as unknown as Record<string, unknown> & { desc: string }
  const context: Record<string, number> = { rows: params.layout.rows, cols: params.layout.cols }
  for (const [key, value] of Object.entries(entry)) {
    if (typeof value === 'number') context[key] = value
  }
  return entry.desc.replace(/\{(\w+)\}/g, (match, key) => (key in context ? String(context[key]) : match))
}
```

**現在の`shidasu.config.json`の`stars`全8件(`src/lib/game/shidasu/shidasu.config.json:67-76`)と、`params.ts`の`DEFAULT_PARAMS.stars`(`src/lib/game/shidasu/params.ts:271-280`)は同一内容:**
```json
{ "id": "ordinary-moon", "name": "普通の衛星", "waveSlot": 1, "targetMultiplier": 1.0, "reward": 20, "restrictionKind": "none" },
{ "id": "slightly-bigger-moon", "name": "少し大きな衛星", "waveSlot": 2, "targetMultiplier": 1.3, "reward": 25, "restrictionKind": "none" },
{ "id": "closed-loop-planet", "name": "循環の閉じた荒廃惑星", "waveSlot": 3, "targetMultiplier": 1.6, "reward": 35, "restrictionKind": "noLoop" },
{ "id": "sealed-noble-planet", "name": "高貴なる封印の惑星", "waveSlot": 3, "targetMultiplier": 1.6, "reward": 35, "restrictionKind": "faceLock" },
{ "id": "harsh-planet", "name": "弱き者を拒む峻厳な惑星", "waveSlot": 3, "targetMultiplier": 1.6, "reward": 35, "restrictionKind": "lowCombo", "maxCombo": 2 },
{ "id": "twisted-odd-planet", "name": "奇数を忌む歪んだ惑星", "waveSlot": 3, "targetMultiplier": 1.6, "reward": 35, "restrictionKind": "oddCombo" },
{ "id": "exiling-color-planet", "name": "排斥の色殺す惑星", "waveSlot": 3, "targetMultiplier": 1.6, "reward": 35, "restrictionKind": "suit" },
{ "id": "regicide-planet", "name": "王侯を打ち滅ぼす惑星", "waveSlot": 3, "targetMultiplier": 1.6, "reward": 35, "restrictionKind": "face" }
```

Wave3(`waveSlot: 3`)は`closed-loop-planet`〜`regicide-planet`の6件。今回の移行でこの6件の`targetMultiplier`を`1.6`→`2`、`reward`を`35`→`5`に変更する。

**現在の`bossActualEffects.ts`全文(`src/lib/game/shidasu/bossActualEffects.ts`):**
```ts
export const STAR_RESTRICTION_ACTUAL_EFFECTS: Record<'noLoop' | 'faceLock' | 'lowCombo' | 'oddCombo' | 'suit' | 'face', string> = {
  noLoop: 'stageModifierForがStageModifier "noLoop" を返し、isPlayableでランク差12(A⇔Kループ)の接続を禁止する(取得可否そのものを制限、得点には無関係)',
  faceLock: 'stageModifierForがStageModifier "faceLock" を返し、isPlayableでコンボ数が2未満のとき絵札(J・Q・K、ランク11以上)の取得を禁止する(ワイルドの場札はfaceLock判定より先に優先評価される)',
  lowCombo: 'bossScoreLockForが{kind:"combo", maxCombo:star.restriction.maxCombo}を返し、playCard/drawStockでeffectiveCombo(庇護・大地等の護符補正込みの実効コンボ数)がmaxCombo以下のとき獲得点(gained/naiveGained)を0にする。コンボ数自体(wave.combo)は通常通り進行する',
  oddCombo: 'bossScoreLockForが{kind:"oddCombo"}を返し、playCard/drawStockでeffectiveComboが奇数のとき獲得点を0にする。コンボ数自体は通常通り進行する',
  suit: '星が選出される瞬間(rollStarForSlot内のtoStarRestriction)にスートを1つ確定しstar.restriction.suitに保持する。bossScoreLockForが{kind:"suit", suit}を返し、playCard/drawStockで非ワイルドかつそのスートのカードを取ると獲得点を0にする(ワイルドは対象外)',
  face: 'bossScoreLockForが{kind:"face"}を返し、playCard/drawStockで非ワイルドかつisFace(ランク11以上)のカードを取ると獲得点を0にする(ワイルドは対象外)',
}
```

**現在の`admin/shidasu-bosses/+page.svelte`全文**は既に読み込み済みの前提とする(実装時に`Read`すること)。バリデーション(`hasValidationError`)・`addStar`・`removeStar`・`loadConfig`・`save`関数がある。テーブルは`config.stars`をそのまま`{#each}`している。

---

### Task 1: `Star`型・`params.ts`のstars型に`descTemplate`を追加

**Files:**
- Modify: `src/lib/game/shidasu/types.ts:32-40`(`Star`インターフェース)
- Modify: `src/lib/game/shidasu/params.ts:29-37`(`stars`型定義)

- [ ] **Step 1: `Star`型に`descTemplate`を追加する**

`src/lib/game/shidasu/types.ts`の`Star`インターフェースを以下に変更する:

```ts
export interface Star {
  id: string
  name: string
  waveSlot: 1 | 2 | 3
  targetMultiplier: number
  reward: number
  restriction: StarRestriction
  sabotage: null
  // 制限ルールのプレイヤー向け説明文テンプレート。{maxCombo}等のプレースホルダーを
  // 含む場合があり、starRestrictionDetail(+page.svelte)で展開して表示する。
  // restrictionがnullの星ではdescTemplateも空文字になる。
  descTemplate: string
}
```

- [ ] **Step 2: `params.ts`の`stars`型に`descTemplate`を追加する**

`src/lib/game/shidasu/params.ts`の`stars`型定義を以下に変更する:

```ts
stars: {
  id: string
  name: string
  waveSlot: 1 | 2 | 3
  targetMultiplier: number
  reward: number
  restrictionKind: 'none' | 'noLoop' | 'faceLock' | 'lowCombo' | 'oddCombo' | 'suit' | 'face'
  maxCombo?: number
  // restrictionKindに対応するプレイヤー向け説明文テンプレート。{maxCombo}のような
  // プレースホルダーを含められる({(\w+)}パターンで展開、revelationDescと同じ方式)。
  // restrictionKind==='none'のときは空文字にする。
  descTemplate: string
}[]
```

- [ ] **Step 3: `npm run build`を実行し、`descTemplate`未設定によるエラー箇所を洗い出す**

Run: `npm run build`
Expected: `DEFAULT_PARAMS.stars`の各要素、`shidasu.config.json`を読み込む箇所、`rollStarForSlot`での`Star`組み立て箇所などで型エラーが出る。これらはTask 2以降で解消する。この時点ではエラーが出ることを確認するだけでよい。

- [ ] **Step 4: コミット**

```bash
git add src/lib/game/shidasu/types.ts src/lib/game/shidasu/params.ts
git commit -m "feat: Star型・params.stars型にdescTemplateフィールドを追加"
```

---

### Task 2: `DEFAULT_PARAMS.stars`と`shidasu.config.json`にdescTemplateを追加、Wave3の値を更新

**Files:**
- Modify: `src/lib/game/shidasu/params.ts:271-280`(`DEFAULT_PARAMS.stars`)
- Modify: `src/lib/game/shidasu/shidasu.config.json:67-76`(`stars`配列)

- [ ] **Step 1: `DEFAULT_PARAMS.stars`を更新する**

`src/lib/game/shidasu/params.ts`の該当箇所を以下に置き換える(Wave3の6件は`targetMultiplier: 1.6`→`2`、`reward: 35`→`5`に変更、全件に`descTemplate`を追加):

```ts
  stars: [
    { id: 'ordinary-moon', name: '普通の衛星', waveSlot: 1, targetMultiplier: 1.0, reward: 20, restrictionKind: 'none', descTemplate: '' },
    { id: 'slightly-bigger-moon', name: '少し大きな衛星', waveSlot: 2, targetMultiplier: 1.3, reward: 25, restrictionKind: 'none', descTemplate: '' },
    { id: 'closed-loop-planet', name: '循環の閉じた荒廃惑星', waveSlot: 3, targetMultiplier: 2, reward: 5, restrictionKind: 'noLoop', descTemplate: 'A⇔Kループ禁止' },
    { id: 'sealed-noble-planet', name: '高貴なる封印の惑星', waveSlot: 3, targetMultiplier: 2, reward: 5, restrictionKind: 'faceLock', descTemplate: '絵札はコンボ2以上でのみ取得可' },
    { id: 'harsh-planet', name: '弱き者を拒む峻厳な惑星', waveSlot: 3, targetMultiplier: 2, reward: 5, restrictionKind: 'lowCombo', maxCombo: 2, descTemplate: '{maxCombo}コンボ以下で無得点' },
    { id: 'twisted-odd-planet', name: '奇数を忌む歪んだ惑星', waveSlot: 3, targetMultiplier: 2, reward: 5, restrictionKind: 'oddCombo', descTemplate: 'コンボが奇数のとき無得点' },
    { id: 'exiling-color-planet', name: '排斥の色殺す惑星', waveSlot: 3, targetMultiplier: 2, reward: 5, restrictionKind: 'suit', descTemplate: '{suit}で無得点' },
    { id: 'regicide-planet', name: '王侯を打ち滅ぼす惑星', waveSlot: 3, targetMultiplier: 2, reward: 5, restrictionKind: 'face', descTemplate: '絵札(J・Q・K)で無得点' },
  ],
```

- [ ] **Step 2: `shidasu.config.json`を更新する**

`src/lib/game/shidasu/shidasu.config.json`の`stars`配列(67-76行目)を以下に置き換える:

```json
  "stars": [
    { "id": "ordinary-moon", "name": "普通の衛星", "waveSlot": 1, "targetMultiplier": 1.0, "reward": 20, "restrictionKind": "none", "descTemplate": "" },
    { "id": "slightly-bigger-moon", "name": "少し大きな衛星", "waveSlot": 2, "targetMultiplier": 1.3, "reward": 25, "restrictionKind": "none", "descTemplate": "" },
    { "id": "closed-loop-planet", "name": "循環の閉じた荒廃惑星", "waveSlot": 3, "targetMultiplier": 2, "reward": 5, "restrictionKind": "noLoop", "descTemplate": "A⇔Kループ禁止" },
    { "id": "sealed-noble-planet", "name": "高貴なる封印の惑星", "waveSlot": 3, "targetMultiplier": 2, "reward": 5, "restrictionKind": "faceLock", "descTemplate": "絵札はコンボ2以上でのみ取得可" },
    { "id": "harsh-planet", "name": "弱き者を拒む峻厳な惑星", "waveSlot": 3, "targetMultiplier": 2, "reward": 5, "restrictionKind": "lowCombo", "maxCombo": 2, "descTemplate": "{maxCombo}コンボ以下で無得点" },
    { "id": "twisted-odd-planet", "name": "奇数を忌む歪んだ惑星", "waveSlot": 3, "targetMultiplier": 2, "reward": 5, "restrictionKind": "oddCombo", "descTemplate": "コンボが奇数のとき無得点" },
    { "id": "exiling-color-planet", "name": "排斥の色殺す惑星", "waveSlot": 3, "targetMultiplier": 2, "reward": 5, "restrictionKind": "suit", "descTemplate": "{suit}で無得点" },
    { "id": "regicide-planet", "name": "王侯を打ち滅ぼす惑星", "waveSlot": 3, "targetMultiplier": 2, "reward": 5, "restrictionKind": "face", "descTemplate": "絵札(J・Q・K)で無得点" }
  ],
```

- [ ] **Step 3: `npm run build`・`npm run check`を実行し、descTemplate未設定によるエラーが解消されたことを確認**

Run: `npm run build`
Run: `npm run check`
Expected: `DEFAULT_PARAMS.stars`・`shidasu.config.json`起因のエラーは解消。`rollStarForSlot`(engine.ts)・管理画面(+page.svelte)側のエラーはまだ残っている想定(Task 3・4で解消)。

- [ ] **Step 4: コミット**

```bash
git add src/lib/game/shidasu/params.ts src/lib/game/shidasu/shidasu.config.json
git commit -m "feat: DEFAULT_PARAMS・config.jsonにdescTemplateを追加しWave3の倍率・報酬を更新"
```

---

### Task 3: `rollStarForSlot`で`descTemplate`をコピーする

**Files:**
- Modify: `src/lib/game/shidasu/engine.ts:944-961`(`rollStarForSlot`)
- Test: `src/lib/game/shidasu/engine.test.ts`

- [ ] **Step 1: `rollStarForSlot`のテストを確認・追加する**

`engine.test.ts`内で`rollStarForSlot`を直接テストしている箇所があれば確認する(非exportのため`rollStageStars`や`beginRun`経由でテストされているはず)。`grep -n "descTemplate" src/lib/game/shidasu/engine.test.ts`で既存のテストに影響がないか確認したうえで、以下のテストを追加する(`describe('startRevelationPreview'` ブロックの直前など、`Star`関連のテストが集まっている箇所に追加):

```ts
describe('rollStageStars(beginRun経由)', () => {
  test('選出されたstar.descTemplateはparams.stars側のdescTemplateと一致する', () => {
    const run = beginRun(DEFAULT_PARAMS, 1)
    for (const star of run.stageStars) {
      const sourceEntry = DEFAULT_PARAMS.stars.find(s => s.id === star.id)
      expect(sourceEntry).toBeDefined()
      expect(star.descTemplate).toBe(sourceEntry!.descTemplate)
    }
  })
})
```

- [ ] **Step 2: テストを実行し失敗することを確認**

Run: `npx vitest run src/lib/game/shidasu/engine.test.ts -t "rollStageStars"`
Expected: FAIL(`star.descTemplate`が`undefined`のため)

- [ ] **Step 3: `rollStarForSlot`を修正する**

`src/lib/game/shidasu/engine.ts`の`rollStarForSlot`関数を以下に変更する:

```ts
function rollStarForSlot(params: ShidasuParams, waveSlot: 1 | 2 | 3, rand: () => number, excludeId?: string): Star {
  const allCandidates = params.stars.filter(s => s.waveSlot === waveSlot)
  if (allCandidates.length === 0) {
    return { id: `fallback-${waveSlot}`, name: '名もなき星', waveSlot, targetMultiplier: 1, reward: 0, restriction: null, sabotage: null, descTemplate: '' }
  }
  const candidates = excludeId && allCandidates.length > 1 ? allCandidates.filter(s => s.id !== excludeId) : allCandidates
  const entry = candidates[Math.floor(rand() * candidates.length)]
  return {
    id: entry.id,
    name: entry.name,
    waveSlot: entry.waveSlot,
    targetMultiplier: entry.targetMultiplier,
    reward: entry.reward,
    restriction: toStarRestriction(entry, rand),
    sabotage: null,
    descTemplate: entry.descTemplate,
  }
}
```

- [ ] **Step 4: テストを実行しPASSすることを確認**

Run: `npx vitest run src/lib/game/shidasu/engine.test.ts`
Expected: 全件PASS

- [ ] **Step 5: `npm run build`・`npm run check`を実行**

Run: `npm run build`
Run: `npm run check`
Expected: `rollStarForSlot`起因のエラーは解消。`+page.svelte`(ゲーム画面・管理画面)側のエラーはまだ残っている想定(Task 4・5で解消)。

- [ ] **Step 6: コミット**

```bash
git add src/lib/game/shidasu/engine.ts src/lib/game/shidasu/engine.test.ts
git commit -m "feat: rollStarForSlotでdescTemplateをコピーするよう修正"
```

---

### Task 4: ゲーム画面の`starRestrictionDetail`をテンプレート展開方式に変更

**Files:**
- Modify: `src/routes/game/shidasu/+page.svelte:36-46`(`starRestrictionDetail`関数)

- [ ] **Step 1: `starRestrictionDetail`を変更する**

`src/routes/game/shidasu/+page.svelte`の`starRestrictionDetail`関数を以下に置き換える:

```ts
  // 星のrestrictionから、プレイヤー向けの効果説明文(1行)を返す。制限なしの場合は空文字。
  // descTemplateのプレースホルダー({maxCombo}等)は、restriction内の数値・文字列フィールドで
  // 展開する(revelations.tsのrevelationDescと同じ.replace(/\{(\w+)\}/g, ...)方式)。
  function starRestrictionDetail(star: Star): string {
    if (!star.restriction || !star.descTemplate) return ''
    const context: Record<string, string> = {}
    for (const [key, value] of Object.entries(star.restriction)) {
      if (key === 'kind') continue
      if (typeof value === 'number' || typeof value === 'string') context[key] = String(value)
    }
    return star.descTemplate.replace(/\{(\w+)\}/g, (match, key) => (key in context ? context[key] : match))
  }
```

- [ ] **Step 2: `npm run build`・`npm run check`を実行**

Run: `npm run build`
Run: `npm run check`
Expected: `+page.svelte`(ゲーム画面)起因のエラーは解消。管理画面(`admin/shidasu-bosses/+page.svelte`)側のエラーはまだ残っている想定(Task 5で解消)。

- [ ] **Step 3: コミット**

```bash
git add src/routes/game/shidasu/+page.svelte
git commit -m "feat: ゲーム画面のstarRestrictionDetailをdescTemplate展開方式に変更"
```

---

### Task 5: `bossActualEffects.ts`の文言を自然文の要約に書き換える

**Files:**
- Modify: `src/lib/game/shidasu/bossActualEffects.ts`

- [ ] **Step 1: `STAR_RESTRICTION_ACTUAL_EFFECTS`の全文言を書き換える**

`src/lib/game/shidasu/bossActualEffects.ts`を以下に置き換える(関数名・変数名を使わない自然文の要約):

```ts
// src/lib/game/shidasu/bossActualEffects.ts

// 各制限ルール種別の実際の挙動を、開発者向けに要約したもの(監査用)。
// params.stars内のrestrictionKindと対応する。実装(engine.ts)を正として記述する。
export const STAR_RESTRICTION_ACTUAL_EFFECTS: Record<'noLoop' | 'faceLock' | 'lowCombo' | 'oddCombo' | 'suit' | 'face', string> = {
  noLoop: 'A⇔Kのループ接続でのカード取得自体を禁止する(得点への影響はない)',
  faceLock: 'コンボ数が2未満のとき絵札(J・Q・K)の取得自体を禁止する(ワイルドの場札はこの制限より先に取得可能と判定される)',
  lowCombo: '実効コンボ数(護符補正込み)が指定コンボ数以下のとき、そのプレイの獲得点を0にする(コンボ数自体は通常通り進行する)',
  oddCombo: '実効コンボ数(護符補正込み)が奇数のとき、そのプレイの獲得点を0にする(コンボ数自体は通常通り進行する)',
  suit: '星が選出された時点でスートを1つランダムに確定し、以後そのスートの非ワイルドカードを取ると獲得点を0にする(ワイルドは対象外)',
  face: '非ワイルドの絵札(J・Q・K)を取ると獲得点を0にする(ワイルドは対象外)',
}
```

- [ ] **Step 2: `npm run build`を実行**

Run: `npm run build`
Expected: 成功(この変更は文言のみで型に影響しない)

- [ ] **Step 3: コミット**

```bash
git add src/lib/game/shidasu/bossActualEffects.ts
git commit -m "docs: 星制限ルールの実際の効果説明を自然文の要約に書き換え"
```

---

### Task 6: 管理画面にdescTemplate編集欄・プレビュー列を追加

**Files:**
- Modify: `src/routes/admin/shidasu-bosses/+page.svelte`

- [ ] **Step 1: プレビュー展開関数を追加する**

`src/routes/admin/shidasu-bosses/+page.svelte`のスクリプト冒頭付近(既存の`RESTRICTION_OPTIONS`定義の直後)に以下を追加する:

```ts
  // 管理画面用のdescTemplateプレビュー展開。suitは実行時ランダム抽選のため
  // 固定のプレースホルダー文字列で表示する(実際のスートは表示しない)。
  function previewDescTemplate(star: ShidasuParams['stars'][number]): string {
    if (!star.descTemplate) return ''
    const context: Record<string, string> = {}
    if (star.restrictionKind === 'lowCombo') context.maxCombo = String(star.maxCombo ?? 2)
    if (star.restrictionKind === 'suit') context.suit = '(抽選)'
    return star.descTemplate.replace(/\{(\w+)\}/g, (match, key) => (key in context ? context[key] : match))
  }
```

- [ ] **Step 2: `addStar`関数のデフォルト値を変更する**

既存の`addStar`関数を以下に変更する(`targetMultiplier`・`reward`のデフォルト値変更、`descTemplate`初期値追加):

```ts
  function addStar() {
    if (!config) return
    config.stars.push({
      id: `star-${crypto.randomUUID()}`,
      name: '',
      waveSlot: 1,
      targetMultiplier: 2,
      reward: 5,
      restrictionKind: 'none',
      descTemplate: '',
    })
  }
```

- [ ] **Step 3: テーブルヘッダーに「説明文テンプレート」「プレビュー」列を追加する**

既存のテーブルヘッダー(`<thead>`内)を以下に置き換える(「実際の効果(監査用)」列の直前に2列追加):

```svelte
            <tr class="bg-slate-50 text-slate-500">
              <th class="px-2 py-1.5 text-left" style="width:5rem;">Wave</th>
              <th class="px-2 py-1.5 text-left" style="width:9rem;">名前</th>
              <th class="px-2 py-1.5 text-left" style="width:6rem;">倍率</th>
              <th class="px-2 py-1.5 text-left" style="width:6rem;">報酬</th>
              <th class="px-2 py-1.5 text-left" style="width:8rem;">制限種別</th>
              <th class="px-2 py-1.5 text-left" style="width:6rem;">maxCombo</th>
              <th class="px-2 py-1.5 text-left" style="width:12rem;">説明文テンプレート</th>
              <th class="px-2 py-1.5 text-left" style="width:10rem;">プレビュー</th>
              <th class="px-2 py-1.5 text-left" style="width:16rem;">実際の効果(監査用)</th>
              <th class="px-2 py-1.5 text-left" style="width:3rem;"></th>
            </tr>
```

- [ ] **Step 4: テーブル行に説明文テンプレート編集欄・プレビュー表示を追加する**

既存の`<tbody>`内、maxCombo列(`{#if star.restrictionKind === 'lowCombo'}`のセル)の直後、「実際の効果(監査用)」列の直前に以下を追加する:

```svelte
                <td class="px-2 py-1.5 align-top">
                  <input type="text" bind:value={star.descTemplate} class="w-full border border-slate-200 rounded px-1.5 py-0.5" />
                </td>
                <td class="px-2 py-1.5 align-top text-slate-500">
                  {previewDescTemplate(star) || '-'}
                </td>
```

- [ ] **Step 5: `npm run build`・`npm run check`を実行**

Run: `npm run build`
Run: `npm run check`
Expected: 管理画面起因のエラーは解消。この時点でTask 1〜6分のエラーが全て解消され、shidasu関連のエラーはなくなっているはず。

- [ ] **Step 6: コミット**

```bash
git add src/routes/admin/shidasu-bosses/+page.svelte
git commit -m "feat: 管理画面に説明文テンプレート編集欄・プレビュー列を追加、デフォルト値を変更"
```

---

### Task 7: 管理画面にヘッダークリックソートを追加

**Files:**
- Modify: `src/routes/admin/shidasu-bosses/+page.svelte`

- [ ] **Step 1: ソート状態のstateとソート済み配列の`$derived`を追加する**

スクリプト内、`RESTRICTION_OPTIONS`定義の直後に以下を追加する:

```ts
  type SortColumn = 'waveSlot' | 'name' | 'targetMultiplier' | 'reward' | 'restrictionKind'
  let sortColumn = $state<SortColumn | null>(null)
  let sortDirection = $state<'asc' | 'desc'>('asc')

  function toggleSort(column: SortColumn) {
    if (sortColumn === column) {
      sortDirection = sortDirection === 'asc' ? 'desc' : 'asc'
    } else {
      sortColumn = column
      sortDirection = 'asc'
    }
  }

  // 表示専用の並び替え済み配列。config.stars自体の順序は変更しない(保存時の
  // 意図しない差分を避けるため)。
  let sortedStars = $derived.by(() => {
    if (!config) return []
    if (!sortColumn) return config.stars
    const column = sortColumn
    const direction = sortDirection
    return [...config.stars].sort((a, b) => {
      const av = a[column]
      const bv = b[column]
      const cmp = typeof av === 'number' && typeof bv === 'number' ? av - bv : String(av).localeCompare(String(bv))
      return direction === 'asc' ? cmp : -cmp
    })
  })
```

- [ ] **Step 2: テーブルヘッダーをクリック可能にする**

Task 6で追加したヘッダー(`<thead>`内)を以下に置き換える(ソート対象列に`onclick`とインジケータを追加):

```svelte
            <tr class="bg-slate-50 text-slate-500">
              <th class="px-2 py-1.5 text-left cursor-pointer select-none" style="width:5rem;" onclick={() => toggleSort('waveSlot')}>
                Wave{sortColumn === 'waveSlot' ? (sortDirection === 'asc' ? ' ▲' : ' ▼') : ''}
              </th>
              <th class="px-2 py-1.5 text-left cursor-pointer select-none" style="width:9rem;" onclick={() => toggleSort('name')}>
                名前{sortColumn === 'name' ? (sortDirection === 'asc' ? ' ▲' : ' ▼') : ''}
              </th>
              <th class="px-2 py-1.5 text-left cursor-pointer select-none" style="width:6rem;" onclick={() => toggleSort('targetMultiplier')}>
                倍率{sortColumn === 'targetMultiplier' ? (sortDirection === 'asc' ? ' ▲' : ' ▼') : ''}
              </th>
              <th class="px-2 py-1.5 text-left cursor-pointer select-none" style="width:6rem;" onclick={() => toggleSort('reward')}>
                報酬{sortColumn === 'reward' ? (sortDirection === 'asc' ? ' ▲' : ' ▼') : ''}
              </th>
              <th class="px-2 py-1.5 text-left cursor-pointer select-none" style="width:8rem;" onclick={() => toggleSort('restrictionKind')}>
                制限種別{sortColumn === 'restrictionKind' ? (sortDirection === 'asc' ? ' ▲' : ' ▼') : ''}
              </th>
              <th class="px-2 py-1.5 text-left" style="width:6rem;">maxCombo</th>
              <th class="px-2 py-1.5 text-left" style="width:12rem;">説明文テンプレート</th>
              <th class="px-2 py-1.5 text-left" style="width:10rem;">プレビュー</th>
              <th class="px-2 py-1.5 text-left" style="width:16rem;">実際の効果(監査用)</th>
              <th class="px-2 py-1.5 text-left" style="width:3rem;"></th>
            </tr>
```

- [ ] **Step 3: `{#each}`の参照元を`config.stars`から`sortedStars`に変更する**

`<tbody>`内の`{#each config.stars as star, i (star.id)}`を`{#each sortedStars as star, i (star.id)}`に変更する。

- [ ] **Step 4: `npm run build`・`npm run check`を実行**

Run: `npm run build`
Run: `npm run check`
Expected: エラーなし

- [ ] **Step 5: コミット**

```bash
git add src/routes/admin/shidasu-bosses/+page.svelte
git commit -m "feat: 管理画面にヘッダークリックソートを追加"
```

---

### Task 8: 行単位バリデーション表示とWave3一括更新ボタンを追加

**Files:**
- Modify: `src/routes/admin/shidasu-bosses/+page.svelte`

- [ ] **Step 1: セル単位のバリデーション判定関数を追加する**

スクリプト内、`hasValidationError`の`$derived.by`の直後に以下を追加する:

```ts
  function starNameInvalid(star: ShidasuParams['stars'][number]): boolean {
    return !star.name.trim()
  }
  function starMaxComboInvalid(star: ShidasuParams['stars'][number]): boolean {
    return star.restrictionKind === 'lowCombo' && !Number.isFinite(star.maxCombo)
  }
```

- [ ] **Step 2: 名前・maxComboの入力欄に赤枠クラスを条件付与する**

テーブル内の名前入力欄:

```svelte
                <td class="px-2 py-1.5 align-top">
                  <input type="text" bind:value={star.name} list="sin-daughter-names" class="w-full border rounded px-1.5 py-0.5 {starNameInvalid(star) ? 'border-red-400' : 'border-slate-200'}" />
                </td>
```

maxCombo入力欄:

```svelte
                <td class="px-2 py-1.5 align-top">
                  {#if star.restrictionKind === 'lowCombo'}
                    <input type="number" step="1" bind:value={star.maxCombo} class="w-full border rounded px-1.5 py-0.5 {starMaxComboInvalid(star) ? 'border-red-400' : 'border-slate-200'}" />
                  {:else}
                    <span class="text-slate-300">-</span>
                  {/if}
                </td>
```

- [ ] **Step 3: Wave3一括更新関数を追加する**

`addStar`関数の直後に以下を追加する:

```ts
  // Wave3(waveSlot 3)の全星のtargetMultiplier・rewardを一律2・5に上書きする。
  // 他のフィールド(名前・制限種別等)は変更しない。ローカルconfig stateの書き換えのみで、
  // 保存ボタンを押すまでAPIへは反映されない。
  function updateWave3Defaults() {
    if (!config) return
    for (const star of config.stars) {
      if (star.waveSlot === 3) {
        star.targetMultiplier = 2
        star.reward = 5
      }
    }
    showToast('Wave3の倍率・報酬を更新しました(保存ボタンで確定してください)')
  }
```

- [ ] **Step 4: ボタンをUIに追加する**

既存の「+ 星を追加」ボタン(`addStar`を呼ぶボタン)の直後に以下を追加する:

```svelte
      <button
        onclick={updateWave3Defaults}
        class="mt-3 ml-2 text-sm px-3 py-1.5 rounded-lg border border-slate-200 text-slate-600 hover:bg-slate-50 transition-colors"
      >
        Wave3の倍率・報酬を一括更新(倍率2・報酬5)
      </button>
```

- [ ] **Step 5: `npm run build`・`npm run check`を実行**

Run: `npm run build`
Run: `npm run check`
Expected: エラーなし

- [ ] **Step 6: コミット**

```bash
git add src/routes/admin/shidasu-bosses/+page.svelte
git commit -m "feat: 管理画面に行単位バリデーション表示とWave3一括更新ボタンを追加"
```

---

### Task 9: 統合確認

**Files:** なし(確認のみ)

- [ ] **Step 1: 自動テスト全件実行**

Run: `npx vitest run`
Expected: 全件PASS

- [ ] **Step 2: ビルド・型チェック**

Run: `npm run build`
Run: `npm run check`
Expected: shidasu関連のエラーなし

- [ ] **Step 3: 開発サーバーを起動しブラウザで確認**

Run: `npm run dev`

以下を目視確認する:
1. `/admin/shidasu-bosses`を開き、8件の星が表示される
2. 「Wave」「名前」「倍率」「報酬」「制限種別」のヘッダーをクリックすると、その列で並び替わる(同じ列を再クリックで昇順⇔降順が切り替わる)
3. 各行に「説明文テンプレート」入力欄と「プレビュー」列があり、テンプレートを編集するとプレビューがリアルタイムで更新される
4. 名前を空にすると入力欄が赤枠になる、`lowCombo`のmaxComboを空にすると赤枠になる
5. 「+ 星を追加」で新規追加した星の倍率が2、報酬が5になっている
6. 「Wave3の倍率・報酬を一括更新」ボタンを押すと、Wave3の全星(6件)の倍率が2、報酬が5になる(保存前はトースト通知のみで、リロードすると元に戻る。保存後は永続化される)
7. `/game/shidasu`でラン開始し、Wave3(制限ルールのある星)に到達した際、ステージ画面・プレイ画面の制限説明文が正しく表示される(例: 「A⇔Kループ禁止」「{maxCombo}コンボ以下で無得点」が実際の数値に展開されて表示される)

- [ ] **Step 4: 問題があれば修正し、Step 1からやり直す**
