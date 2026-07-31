# bossTiers・bosses非推奨フィールドの削除 Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** 星パラメータ管理画面の本格UI化完了に伴い、旧BossKind仕様の残骸(`bossTiers`・`bosses`・`BossKind`・`BossTierKey`)を削除する。

**Architecture:** 型定義→データ定義→テストコード→UIコンポーネントの順に、依存の少ない箇所から段階的に削除していく。`engine.ts`本体は既に`star.name`ベースに移行済みで無関係のため変更不要。

**Tech Stack:** SvelteKit, Svelte 5 runes, TypeScript, Vitest

---

## 前提知識(実装者が押さえておくべき既存コード)

**`types.ts`の削除対象(1-16行目):**
```ts
// ボスウェーブの制約候補。挙動(kind)そのものはコードに紐づく固定値で、
// どの階級(小凶/中凶/大凶)に属するかはparams.bosses[kind].tierとして管理画面から変更できる。
// noLoop/faceLock=小凶向け(isPlayableの可否制約)、lowCombo/oddCombo=中凶向け、suit/face=大凶向け(得点ロック)
// という想定だが、実際にどの階級で抽選されるかはtierの値のみが決める。
// 非推奨: Star型(下記)への移行に伴い廃止予定。StarRestriction.kindが同等の役割を持つ。
// 移行完了後(次回以降のセッションでUI・管理画面の置き換えが終わったら)削除すること。
export type BossKind = 'noLoop' | 'faceLock' | 'lowCombo' | 'oddCombo' | 'suit' | 'face'
export type BossTierKey = 'shoukyou' | 'chuukyou' | 'taikyou'
```

**`params.ts`の削除対象(型定義、42-62行目):**
```ts
  // 非推奨: starsフィールド(上記)への移行に伴い廃止予定。移行完了後(UI・管理画面の
  // 置き換えが終わったら)削除すること。
  // ボス階級ごとの設定。stageIndex % 3 (0=小凶,1=中凶,2=大凶)でインデックスする代わりに、
  // 読みやすさのため名前付きキーで持つ(shoukyou=小凶,chuukyou=中凶,taikyou=大凶)
  bossTiers: {
    shoukyou: { name: string }
    chuukyou: { name: string }
    taikyou: { name: string }
  }
  // 非推奨: starsフィールド(上記)への移行に伴い廃止予定。移行完了後(UI・管理画面の
  // 置き換えが終わったら)削除すること。
  // ボス制約の候補プール。どの階級(tier)に属するかは管理画面から変更できる。
  // 挙動そのもの(kindごとの実際のロジック)はengine.tsに固定で紐づく。
  bosses: {
    noLoop: { name: string; tier: BossTierKey; desc: string }
    faceLock: { name: string; tier: BossTierKey; desc: string }
    lowCombo: { name: string; tier: BossTierKey; desc: string; maxCombo: number }
    oddCombo: { name: string; tier: BossTierKey; desc: string }
    suit: { name: string; tier: BossTierKey; desc: string }
    face: { name: string; tier: BossTierKey; desc: string }
  }
```

**`params.ts`の削除対象(DEFAULT_PARAMSデータ、285-297行目):**
```ts
  bossTiers: {
    shoukyou: { name: '小凶' },
    chuukyou: { name: '中凶' },
    taikyou: { name: '大凶' },
  },
  bosses: {
    noLoop: { name: '頑迷', tier: 'shoukyou', desc: 'A⇔Kループ禁止' },
    faceLock: { name: '偽善', tier: 'shoukyou', desc: '絵札はコンボ2以上でのみ取れる' },
    lowCombo: { name: '憤慨', tier: 'chuukyou', desc: '{maxCombo}コンボ以下で無得点', maxCombo: 2 },
    oddCombo: { name: '口論', tier: 'chuukyou', desc: 'コンボが奇数のとき無得点' },
    suit: { name: '裏切り', tier: 'taikyou', desc: '特定のスートで無得点' },
    face: { name: '詐欺', tier: 'taikyou', desc: '絵札(J・Q・K)で無得点' },
  },
```

**`shidasu.config.json`の削除対象(23-66行目):**
```json
  "bossTiers": {
    "shoukyou": { "name": "小凶" },
    "chuukyou": { "name": "中凶" },
    "taikyou": { "name": "大凶" }
  },
  "bosses": {
    "noLoop": { "name": "頑迷", "tier": "shoukyou", "desc": "A⇔Kループ禁止" },
    "faceLock": { "name": "偽善", "tier": "shoukyou", "desc": "絵札はコンボ2以上でのみ取れる" },
    "lowCombo": { "name": "憤慨", "tier": "chuukyou", "desc": "{maxCombo}コンボ以下で無得点", "maxCombo": 2 },
    "oddCombo": { "name": "口論", "tier": "chuukyou", "desc": "コンボが奇数のとき無得点" },
    "suit": { "name": "裏切り", "tier": "taikyou", "desc": "特定のスートで無得点" },
    "face": { "name": "詐欺", "tier": "taikyou", "desc": "絵札(J・Q・K)で無得点" }
  },
```

**`engine.test.ts`で`DEFAULT_PARAMS.bossTiers`を参照している12箇所(行番号は目安、実装時に`grep -n "bossTiers" src/lib/game/shidasu/engine.test.ts`で正確な位置を確認すること):** 419, 1278, 1289, 1300, 1310, 1319, 1341, 1352, 1364, 1374, 1383, 3196行目。いずれも`tierLabel: DEFAULT_PARAMS.bossTiers.chuukyou.name`または`tierLabel: DEFAULT_PARAMS.bossTiers.taikyou.name`という形。`tierLabel`は`ScoreLock`型(`engine.ts`)の表示用文字列フィールドで、テストのアサーション対象にはなっていない。

**`BossTiersSection.svelte`全文:**
```svelte
<script lang="ts">
  import type { ShidasuParams } from '$lib/game/shidasu/params'

  let { config }: { config: ShidasuParams } = $props()
</script>

<section class="bg-white border border-slate-200 rounded-xl p-4">
  <h2 class="font-semibold text-slate-700 text-sm mb-3">ボス</h2>
  <div class="grid grid-cols-3 gap-3">
    <label class="text-xs text-slate-500">
      小凶の名前
      <input type="text" bind:value={config.bossTiers.shoukyou.name} class="mt-1 w-full border border-slate-200 rounded px-2 py-1 text-sm" />
    </label>
    <label class="text-xs text-slate-500">
      中凶の名前
      <input type="text" bind:value={config.bossTiers.chuukyou.name} class="mt-1 w-full border border-slate-200 rounded px-2 py-1 text-sm" />
    </label>
    <label class="text-xs text-slate-500">
      大凶の名前
      <input type="text" bind:value={config.bossTiers.taikyou.name} class="mt-1 w-full border border-slate-200 rounded px-2 py-1 text-sm" />
    </label>
  </div>
  <p class="text-xs text-slate-400 mt-3">
    各階級のボス制約候補(名前・パラメータ・説明文・階級の割り当て)は
    <a href="/admin/shidasu-bosses" class="text-teal-600 hover:underline">ボス候補パラメータ設定ページ</a>
    で編集します。
  </p>
</section>
```

**`admin/shidasu/+page.svelte`のBossTiersSection関連箇所:**
- import文(8行目付近): `import BossTiersSection from './BossTiersSection.svelte'`
- 呼び出し(121行目付近): `<BossTiersSection {config} />`(`LayoutSection`・`ScoringSection`・`RoleBonusSection`の後、`SpreadsSection`の前)

**`JsonPanel.svelte`の`isValidShidasuParams`関数全文(14-47行目):**
```ts
  function isValidShidasuParams(value: unknown): value is ShidasuParams {
    if (typeof value !== 'object' || value === null) return false
    const v = value as Record<string, unknown>
    const bossTiers = v.bossTiers as Record<string, unknown> | undefined
    const shoukyou = bossTiers?.shoukyou as Record<string, unknown> | undefined
    const chuukyou = bossTiers?.chuukyou as Record<string, unknown> | undefined
    const taikyou = bossTiers?.taikyou as Record<string, unknown> | undefined
    const spreads = v.spreads as Record<string, unknown> | undefined
    const fool = spreads?.fool as Record<string, unknown> | undefined
    const moon = spreads?.moon as Record<string, unknown> | undefined
    return (
      typeof v.layout === 'object' && v.layout !== null &&
      typeof v.scoring === 'object' && v.scoring !== null &&
      typeof v.bossTiers === 'object' && v.bossTiers !== null &&
      typeof shoukyou?.name === 'string' &&
      typeof chuukyou?.name === 'string' &&
      typeof taikyou?.name === 'string' &&
      typeof v.spreads === 'object' && v.spreads !== null &&
      typeof fool?.name === 'string' &&
      typeof fool?.desc === 'string' &&
      typeof fool?.initialExtraTableauRows === 'number' &&
      typeof fool?.waveTargetBase === 'number' &&
      typeof fool?.waveTargetMultiplier === 'number' &&
      typeof moon?.name === 'string' &&
      typeof moon?.desc === 'string' &&
      typeof moon?.initialExtraTableauRows === 'number' &&
      typeof moon?.waveTargetBase === 'number' &&
      typeof moon?.waveTargetMultiplier === 'number' &&
      typeof v.items === 'object' && v.items !== null &&
      typeof v.flow === 'object' && v.flow !== null &&
      typeof v.ui === 'object' && v.ui !== null &&
      typeof v.talismans === 'object' && v.talismans !== null
    )
  }

  function applyJson() {
    try {
      const parsed = JSON.parse(jsonText)
      if (!isValidShidasuParams(parsed)) {
        jsonError = '必須項目(layout/scoring/bossTiers/spreads/items/flow/ui)が不足しています'
        return
      }
      onApply(parsed)
      jsonError = null
    } catch {
      jsonError = 'JSONの形式が正しくありません'
    }
```

---

### Task 1: `types.ts`から`BossKind`・`BossTierKey`型を削除

**Files:**
- Modify: `src/lib/game/shidasu/types.ts:9-16`

- [ ] **Step 1: 対象コメント・型定義を削除する**

`src/lib/game/shidasu/types.ts`の以下のブロックを削除する:

```ts
// ボスウェーブの制約候補。挙動(kind)そのものはコードに紐づく固定値で、
// どの階級(小凶/中凶/大凶)に属するかはparams.bosses[kind].tierとして管理画面から変更できる。
// noLoop/faceLock=小凶向け(isPlayableの可否制約)、lowCombo/oddCombo=中凶向け、suit/face=大凶向け(得点ロック)
// という想定だが、実際にどの階級で抽選されるかはtierの値のみが決める。
// 非推奨: Star型(下記)への移行に伴い廃止予定。StarRestriction.kindが同等の役割を持つ。
// 移行完了後(次回以降のセッションでUI・管理画面の置き換えが終わったら)削除すること。
export type BossKind = 'noLoop' | 'faceLock' | 'lowCombo' | 'oddCombo' | 'suit' | 'face'
export type BossTierKey = 'shoukyou' | 'chuukyou' | 'taikyou'
```

削除後、直前の`SpreadId`定義の次の行が、直後の「Wave単位の新概念「星」が持つ制限ルール。」というコメント(`StarRestriction`型定義の直前)に自然につながるようにする。

- [ ] **Step 2: `npm run build`を実行し、`BossTierKey`未定義によるエラー箇所を確認**

Run: `npm run build`
Expected: `params.ts`で`BossTierKey`が見つからないという型エラーが出る(Task 2で解消する)。

- [ ] **Step 3: コミット**

```bash
git add src/lib/game/shidasu/types.ts
git commit -m "feat: BossKind・BossTierKey型を削除"
```

---

### Task 2: `params.ts`から`bossTiers`・`bosses`フィールドを削除

**Files:**
- Modify: `src/lib/game/shidasu/params.ts:3`(import文)
- Modify: `src/lib/game/shidasu/params.ts:42-62`(型定義)
- Modify: `src/lib/game/shidasu/params.ts:285-297`(DEFAULT_PARAMSデータ)

- [ ] **Step 1: import文から`BossTierKey`を除く**

`src/lib/game/shidasu/params.ts`の以下の行:

```ts
import type { Rarity, BossTierKey } from './types'
```

を以下に変更する:

```ts
import type { Rarity } from './types'
```

- [ ] **Step 2: `ShidasuParams`型定義から`bossTiers`・`bosses`を削除する**

「前提知識」セクションに記載した型定義ブロック(42-62行目)を削除する。削除後、`stars`フィールドの定義の直後が、直後の「スプレッド(ラン開始時に選ぶ固有ルールセット)ごとの設定。」というコメント(`spreads`フィールド定義の直前)に自然につながるようにする。

- [ ] **Step 3: `DEFAULT_PARAMS`から`bossTiers`・`bosses`データを削除する**

「前提知識」セクションに記載したデータブロック(285-297行目)を削除する。削除後、`stars`配列の閉じ括弧`]`の直後が、直後の`spreads: {`定義に自然につながるようにする。

- [ ] **Step 4: `npm run build`・`npm run check`を実行**

Run: `npm run build`
Run: `npm run check`
Expected: `params.ts`自体の型エラーは解消。`shidasu.config.json`(型の構造不一致)・`engine.test.ts`・`BossTiersSection.svelte`・`JsonPanel.svelte`起因のエラーはまだ残っている想定(後続タスクで解消)。

- [ ] **Step 5: コミット**

```bash
git add src/lib/game/shidasu/params.ts
git commit -m "feat: params.tsからbossTiers・bossesフィールドを削除"
```

---

### Task 3: `shidasu.config.json`から`bossTiers`・`bosses`データを削除

**Files:**
- Modify: `src/lib/game/shidasu/shidasu.config.json:23-66`

- [ ] **Step 1: 対象JSONブロックを削除する**

「前提知識」セクションに記載したJSONブロック(23-66行目)を削除する。削除後、`scoring`オブジェクトの閉じ括弧`}`の直後のカンマに続けて、直後の`"stars": [`定義に自然につながるようにする(JSON構文として有効なカンマ位置になるよう注意すること)。

- [ ] **Step 2: `npm run build`・`npm run check`を実行**

Run: `npm run build`
Run: `npm run check`
Expected: `shidasu.config.json`起因のエラーは解消。`engine.test.ts`・`BossTiersSection.svelte`・`JsonPanel.svelte`起因のエラーはまだ残っている想定。

- [ ] **Step 3: コミット**

```bash
git add src/lib/game/shidasu/shidasu.config.json
git commit -m "feat: shidasu.config.jsonからbossTiers・bossesデータを削除"
```

---

### Task 4: `engine.test.ts`の`tierLabel`参照を固定文字列に置き換え

**Files:**
- Modify: `src/lib/game/shidasu/engine.test.ts`(12箇所)

- [ ] **Step 1: 全ての`DEFAULT_PARAMS.bossTiers.xxx.name`参照を固定文字列に置き換える**

`src/lib/game/shidasu/engine.test.ts`内で`grep -n "bossTiers" src/lib/game/shidasu/engine.test.ts`を実行し、該当する全箇所(12箇所、`DEFAULT_PARAMS.bossTiers.chuukyou.name`または`DEFAULT_PARAMS.bossTiers.taikyou.name`)を、以下のように固定文字列`'test-tier'`に置き換える。

変更前の例:
```ts
const { wave: next } = drawStock(DEFAULT_PARAMS, wave, ['naive'], 1000000, standardDeckComposition(), 'none', Math.random, { kind: 'combo', maxCombo: 3, tierLabel: DEFAULT_PARAMS.bossTiers.chuukyou.name })
```

変更後の例:
```ts
const { wave: next } = drawStock(DEFAULT_PARAMS, wave, ['naive'], 1000000, standardDeckComposition(), 'none', Math.random, { kind: 'combo', maxCombo: 3, tierLabel: 'test-tier' })
```

`DEFAULT_PARAMS.bossTiers.chuukyou.name`・`DEFAULT_PARAMS.bossTiers.taikyou.name`のいずれも、同じ固定文字列`'test-tier'`に置き換えてよい(`tierLabel`はテストのアサーション対象になっていないため、値の違いに意味はない)。

- [ ] **Step 2: `npx vitest run src/lib/game/shidasu/engine.test.ts`を実行**

Run: `npx vitest run src/lib/game/shidasu/engine.test.ts`
Expected: 全件PASS(`tierLabel`の値変更はアサーション対象でないため、既存テストの結果に影響しない)

- [ ] **Step 3: `npm run build`・`npm run check`を実行**

Run: `npm run build`
Run: `npm run check`
Expected: `engine.test.ts`起因のエラーは解消。`BossTiersSection.svelte`・`JsonPanel.svelte`起因のエラーはまだ残っている想定。

- [ ] **Step 4: コミット**

```bash
git add src/lib/game/shidasu/engine.test.ts
git commit -m "test: engine.test.tsのtierLabel参照をDEFAULT_PARAMS非依存の固定文字列に置き換え"
```

---

### Task 5: `BossTiersSection.svelte`を削除し呼び出し元から取り除く

**Files:**
- Delete: `src/routes/admin/shidasu/BossTiersSection.svelte`
- Modify: `src/routes/admin/shidasu/+page.svelte`

- [ ] **Step 1: `admin/shidasu/+page.svelte`からimport文を削除する**

`src/routes/admin/shidasu/+page.svelte`内の以下の行を削除する:

```ts
import BossTiersSection from './BossTiersSection.svelte'
```

- [ ] **Step 2: `admin/shidasu/+page.svelte`からコンポーネント呼び出しを削除する**

以下の行を削除する:

```svelte
      <BossTiersSection {config} />

```

(前後の空行の扱いは、`RoleBonusSection`と`SpreadsSection`の間が1つの空行区切りになるよう整える。)

- [ ] **Step 3: `BossTiersSection.svelte`ファイルを削除する**

```bash
rm src/routes/admin/shidasu/BossTiersSection.svelte
```

- [ ] **Step 4: `npm run build`・`npm run check`を実行**

Run: `npm run build`
Run: `npm run check`
Expected: `BossTiersSection.svelte`・`admin/shidasu/+page.svelte`起因のエラーは解消。`JsonPanel.svelte`起因のエラーはまだ残っている想定。

- [ ] **Step 5: コミット**

```bash
git add -A src/routes/admin/shidasu/
git commit -m "feat: BossTiersSectionを削除しadmin/shidasu画面から取り除く"
```

---

### Task 6: `JsonPanel.svelte`の`bossTiers`バリデーションを削除

**Files:**
- Modify: `src/routes/admin/shidasu/JsonPanel.svelte:14-53`

- [ ] **Step 1: `isValidShidasuParams`関数から`bossTiers`関連のチェックを削除する**

`src/routes/admin/shidasu/JsonPanel.svelte`の`isValidShidasuParams`関数を以下に変更する:

```ts
  function isValidShidasuParams(value: unknown): value is ShidasuParams {
    if (typeof value !== 'object' || value === null) return false
    const v = value as Record<string, unknown>
    const spreads = v.spreads as Record<string, unknown> | undefined
    const fool = spreads?.fool as Record<string, unknown> | undefined
    const moon = spreads?.moon as Record<string, unknown> | undefined
    return (
      typeof v.layout === 'object' && v.layout !== null &&
      typeof v.scoring === 'object' && v.scoring !== null &&
      typeof v.spreads === 'object' && v.spreads !== null &&
      typeof fool?.name === 'string' &&
      typeof fool?.desc === 'string' &&
      typeof fool?.initialExtraTableauRows === 'number' &&
      typeof fool?.waveTargetBase === 'number' &&
      typeof fool?.waveTargetMultiplier === 'number' &&
      typeof moon?.name === 'string' &&
      typeof moon?.desc === 'string' &&
      typeof moon?.initialExtraTableauRows === 'number' &&
      typeof moon?.waveTargetBase === 'number' &&
      typeof moon?.waveTargetMultiplier === 'number' &&
      typeof v.items === 'object' && v.items !== null &&
      typeof v.flow === 'object' && v.flow !== null &&
      typeof v.ui === 'object' && v.ui !== null &&
      typeof v.talismans === 'object' && v.talismans !== null
    )
  }
```

- [ ] **Step 2: エラーメッセージ文言から`bossTiers`を除く**

以下の行:

```ts
        jsonError = '必須項目(layout/scoring/bossTiers/spreads/items/flow/ui)が不足しています'
```

を以下に変更する:

```ts
        jsonError = '必須項目(layout/scoring/spreads/items/flow/ui)が不足しています'
```

- [ ] **Step 3: `npm run build`・`npm run check`を実行**

Run: `npm run build`
Run: `npm run check`
Expected: shidasu関連のエラーが全て解消していること。

- [ ] **Step 4: コミット**

```bash
git add src/routes/admin/shidasu/JsonPanel.svelte
git commit -m "feat: JsonPanelのbossTiersバリデーションを削除"
```

---

### Task 7: 統合確認

**Files:** なし(確認のみ)

- [ ] **Step 1: 全ファイルで`bossTiers`・`bosses`・`BossKind`・`BossTierKey`が残っていないことを確認する**

Run: `grep -rn "bossTiers\|BossTierKey\|BossKind" src/`
Expected: 出力なし(空)。ただし`src/lib/game/shidasu/bosses.ts`(ファイル名)・`src/routes/admin/shidasu-bosses/`(ディレクトリ名)・`sinDaughters.ts`内のコメント言及は今回の削除対象外なので、これらへのヒットは無視してよい(`bossTiers`・`BossTierKey`・`BossKind`という完全な単語での一致がないことを確認する)。

- [ ] **Step 2: 自動テスト全件実行**

Run: `npx vitest run`
Expected: 全件PASS

- [ ] **Step 3: ビルド・型チェック**

Run: `npm run build`
Run: `npm run check`
Expected: shidasu関連のエラーなし

- [ ] **Step 4: 開発サーバーを起動しブラウザで確認する**

Run: `npm run dev`

以下を目視確認する:
1. `/admin/shidasu`を開き、「ボス」セクションが表示されなくなっていること。レイアウト・スコアリング・役ボーナス・スプレッド・アイテム・フロー/UIの各セクションが正常に表示・編集・保存できること
2. `/admin/shidasu`のJSON直接編集パネル(存在する場合)を開き、現在の設定(`bossTiers`を含まない)が正しく読み込まれ、編集・適用できること
3. `/admin/shidasu-bosses`(星パラメータ設定)が引き続き正常に動作すること(前回セッションの本格化内容に影響がないこと)
4. `/game/shidasu`でラン開始からWave3(制限ルールのある星)クリアまで一通りプレイし、制限ルールの説明表示・スコアロジックが正常に機能すること

- [ ] **Step 5: 問題があれば修正し、Step 1からやり直す**
