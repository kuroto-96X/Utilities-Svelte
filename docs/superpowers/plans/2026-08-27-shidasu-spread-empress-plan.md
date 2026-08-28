# 新規スプレッド「女帝」(初期所持金+N) Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** 新規スプレッド「女帝」(`empress`)を追加し、選択すると初期所持金が10多い状態でランを開始できるようにする。

**Architecture:** `SpreadId`型に`'empress'`を追加し、`SpreadConfig`に`initialCurrencyBonus: number`フィールドを新設する。`beginRun`(`engine.ts`)がラン開始時の`currency`にこのオフセットを加算する。`/admin/shidasu-spreads`にも編集用の列を追加する。

**Tech Stack:** TypeScript, SvelteKit, Vitest

---

### Task 1: `SpreadId`型・`SpreadConfig`型の拡張と`SPREAD_IDS`・`DEFAULT_PARAMS`・`shidasu.config.json`の更新

**Files:**
- Modify: `src/lib/game/shidasu/types.ts:24-40` (`SpreadId`型・`SpreadConfig`型)
- Modify: `src/lib/game/shidasu/params.ts:340-343` (`DEFAULT_PARAMS.spreads`)
- Modify: `src/lib/game/shidasu/params.ts:631` (`SPREAD_IDS`)
- Modify: `src/lib/game/shidasu/shidasu.config.json:109-137` (`spreads`)
- Test: `src/lib/game/shidasu/params.test.ts`

- [ ] **Step 1: 失敗するテストを書く**

`src/lib/game/shidasu/params.test.ts`の44-49行目「fool/moonのinitialOracleLevelは1、bannedShopKindsは空配列」テストの直後に、以下のテストを追加する。

```ts
  test('fool/moon/popeのinitialCurrencyBonusは0、empressは10', () => {
    expect(DEFAULT_PARAMS.spreads.fool.initialCurrencyBonus).toBe(0)
    expect(DEFAULT_PARAMS.spreads.moon.initialCurrencyBonus).toBe(0)
    expect(DEFAULT_PARAMS.spreads.pope.initialCurrencyBonus).toBe(0)
    expect(DEFAULT_PARAMS.spreads.empress.initialCurrencyBonus).toBe(10)
  })

  test('empressの名称は女帝、初期行数オフセット・目標スコア・神託初期レベルは愚者と同じ', () => {
    expect(DEFAULT_PARAMS.spreads.empress.name).toBe('女帝')
    expect(DEFAULT_PARAMS.spreads.empress.initialExtraTableauRows).toBe(DEFAULT_PARAMS.spreads.fool.initialExtraTableauRows)
    expect(DEFAULT_PARAMS.spreads.empress.waveTargetBase).toBe(DEFAULT_PARAMS.spreads.fool.waveTargetBase)
    expect(DEFAULT_PARAMS.spreads.empress.waveTargetMultiplier).toBe(DEFAULT_PARAMS.spreads.fool.waveTargetMultiplier)
    expect(DEFAULT_PARAMS.spreads.empress.initialOracleLevel).toBe(DEFAULT_PARAMS.spreads.fool.initialOracleLevel)
    expect(DEFAULT_PARAMS.spreads.empress.bannedShopKinds).toEqual([])
  })
```

- [ ] **Step 2: テストが失敗することを確認する**

Run: `npm test -- params.test.ts`
Expected: FAIL — `DEFAULT_PARAMS.spreads.empress`が`undefined`、または`initialCurrencyBonus`プロパティが存在しない

- [ ] **Step 3: `types.ts`の`SpreadId`型・`SpreadConfig`型を変更する**

`src/lib/game/shidasu/types.ts`の現在の内容(24-40行目):

```ts
// スプレッド: ラン開始時にプレイヤーが選ぶ固有ルールセット。大アルカナから命名する。
// fool(愚者)=特殊ルールなしの基本スプレッド、moon(月)=場札が常に1行少ない状態で始まる、
// pope(教皇)=神託の初期レベルが上がるが、ショップで神託が販売されない
export type SpreadId = 'fool' | 'moon' | 'pope'
// スプレッドごとの固有ルール設定。
export interface SpreadConfig {
  name: string
  desc: string
  // ウェーブ開始時の配布行数への初期オフセット(既存)。
  initialExtraTableauRows: number
  waveTargetBase: number
  waveTargetMultiplier: number
  // 神託(oracle)の初期レベル。ラン開始時、全10役一律にこの値でoracleLevelsを初期化する(既定1)。
  initialOracleLevel: number
  // ショップのバラ売り枠・福袋カタログの両方から除外する種別(既定は空配列=制限なし)。
  bannedShopKinds: ShopSlotKind[]
}
```

これを以下に変更する:

```ts
// スプレッド: ラン開始時にプレイヤーが選ぶ固有ルールセット。大アルカナから命名する。
// fool(愚者)=特殊ルールなしの基本スプレッド、moon(月)=場札が常に1行少ない状態で始まる、
// pope(教皇)=神託の初期レベルが上がるが、ショップで神託が販売されない、
// empress(女帝)=初期所持金が多い状態で始まる
export type SpreadId = 'fool' | 'moon' | 'pope' | 'empress'
// スプレッドごとの固有ルール設定。
export interface SpreadConfig {
  name: string
  desc: string
  // ウェーブ開始時の配布行数への初期オフセット(既存)。
  initialExtraTableauRows: number
  waveTargetBase: number
  waveTargetMultiplier: number
  // 神託(oracle)の初期レベル。ラン開始時、全10役一律にこの値でoracleLevelsを初期化する(既定1)。
  initialOracleLevel: number
  // ショップのバラ売り枠・福袋カタログの両方から除外する種別(既定は空配列=制限なし)。
  bannedShopKinds: ShopSlotKind[]
  // 初期所持金(currency.initialAmount)へのオフセット(既定0)。
  initialCurrencyBonus: number
}
```

- [ ] **Step 4: `params.ts`の`DEFAULT_PARAMS.spreads`を変更する**

`src/lib/game/shidasu/params.ts`の現在の内容(340-344行目):

```ts
  spreads: {
    fool: { name: '愚者', desc: '特殊ルールなし', initialExtraTableauRows: 0, waveTargetBase: 2000, waveTargetMultiplier: 1.5, initialOracleLevel: 1, bannedShopKinds: [] },
    moon: { name: '月', desc: '場札が常に1行多い状態で始まる。Wave開始時に配られる場札の上半分(端数切捨て)の行は裏向きになる。', initialExtraTableauRows: 1, waveTargetBase: 2000, waveTargetMultiplier: 1.5, initialOracleLevel: 1, bannedShopKinds: [] },
    pope: { name: '教皇', desc: '神託の初期レベルが5になるが、ショップで神託が販売されない', initialExtraTableauRows: 0, waveTargetBase: 2000, waveTargetMultiplier: 1.5, initialOracleLevel: 5, bannedShopKinds: ['oracle'] },
  },
```

これを以下に変更する:

```ts
  spreads: {
    fool: { name: '愚者', desc: '特殊ルールなし', initialExtraTableauRows: 0, waveTargetBase: 2000, waveTargetMultiplier: 1.5, initialOracleLevel: 1, bannedShopKinds: [], initialCurrencyBonus: 0 },
    moon: { name: '月', desc: '場札が常に1行多い状態で始まる。Wave開始時に配られる場札の上半分(端数切捨て)の行は裏向きになる。', initialExtraTableauRows: 1, waveTargetBase: 2000, waveTargetMultiplier: 1.5, initialOracleLevel: 1, bannedShopKinds: [], initialCurrencyBonus: 0 },
    pope: { name: '教皇', desc: '神託の初期レベルが5になるが、ショップで神託が販売されない', initialExtraTableauRows: 0, waveTargetBase: 2000, waveTargetMultiplier: 1.5, initialOracleLevel: 5, bannedShopKinds: ['oracle'], initialCurrencyBonus: 0 },
    empress: { name: '女帝', desc: '初期所持金が10多い状態で始まる', initialExtraTableauRows: 0, waveTargetBase: 2000, waveTargetMultiplier: 1.5, initialOracleLevel: 1, bannedShopKinds: [], initialCurrencyBonus: 10 },
  },
```

- [ ] **Step 5: `params.ts`の`SPREAD_IDS`を変更する**

`src/lib/game/shidasu/params.ts`の現在の内容(631行目):

```ts
export const SPREAD_IDS: SpreadId[] = ['fool', 'moon', 'pope']
```

これを以下に変更する:

```ts
export const SPREAD_IDS: SpreadId[] = ['fool', 'moon', 'pope', 'empress']
```

- [ ] **Step 6: `shidasu.config.json`の`spreads`を変更する**

`src/lib/game/shidasu/shidasu.config.json`の現在の内容(109-137行目):

```json
  "spreads": {
    "fool": {
      "name": "愚者",
      "desc": "特殊ルールなし",
      "initialExtraTableauRows": 0,
      "waveTargetBase": 2000,
      "waveTargetMultiplier": 1.5,
      "initialOracleLevel": 1,
      "bannedShopKinds": []
    },
    "moon": {
      "name": "月",
      "desc": "場札が常に1行多い状態で始まる。Wave開始時に配られる場札の上半分(端数切捨て)の行は裏向きになる。",
      "initialExtraTableauRows": 1,
      "waveTargetBase": 2000,
      "waveTargetMultiplier": 1.5,
      "initialOracleLevel": 1,
      "bannedShopKinds": []
    },
    "pope": {
      "name": "教皇",
      "desc": "神託の初期レベルが5になるが、ショップで神託が販売されない",
      "initialExtraTableauRows": 0,
      "waveTargetBase": 2000,
      "waveTargetMultiplier": 1.5,
      "initialOracleLevel": 5,
      "bannedShopKinds": ["oracle"]
    }
  },
```

これを以下に変更する:

```json
  "spreads": {
    "fool": {
      "name": "愚者",
      "desc": "特殊ルールなし",
      "initialExtraTableauRows": 0,
      "waveTargetBase": 2000,
      "waveTargetMultiplier": 1.5,
      "initialOracleLevel": 1,
      "bannedShopKinds": [],
      "initialCurrencyBonus": 0
    },
    "moon": {
      "name": "月",
      "desc": "場札が常に1行多い状態で始まる。Wave開始時に配られる場札の上半分(端数切捨て)の行は裏向きになる。",
      "initialExtraTableauRows": 1,
      "waveTargetBase": 2000,
      "waveTargetMultiplier": 1.5,
      "initialOracleLevel": 1,
      "bannedShopKinds": [],
      "initialCurrencyBonus": 0
    },
    "pope": {
      "name": "教皇",
      "desc": "神託の初期レベルが5になるが、ショップで神託が販売されない",
      "initialExtraTableauRows": 0,
      "waveTargetBase": 2000,
      "waveTargetMultiplier": 1.5,
      "initialOracleLevel": 5,
      "bannedShopKinds": ["oracle"],
      "initialCurrencyBonus": 0
    },
    "empress": {
      "name": "女帝",
      "desc": "初期所持金が10多い状態で始まる",
      "initialExtraTableauRows": 0,
      "waveTargetBase": 2000,
      "waveTargetMultiplier": 1.5,
      "initialOracleLevel": 1,
      "bannedShopKinds": [],
      "initialCurrencyBonus": 10
    }
  },
```

- [ ] **Step 7: テストが通ることを確認する**

Run: `npm test -- params.test.ts`
Expected: PASS(Step 1で追加した2件を含め全件)

- [ ] **Step 8: 型チェックを実行する**

Run: `npm run check`
Expected: shidasu関連の新規エラーなし。この時点では`beginRun`・admin画面がまだ`initialCurrencyBonus`を参照していないため型エラーは出ないはずだが、`SpreadConfig`型を実装しているオブジェクトリテラルが全て新フィールドを持っているかの構造チェックが働く

- [ ] **Step 9: コミット**

```bash
git add src/lib/game/shidasu/types.ts src/lib/game/shidasu/params.ts src/lib/game/shidasu/shidasu.config.json src/lib/game/shidasu/params.test.ts
git commit -m "$(cat <<'EOF'
feat: 新規スプレッド「女帝」を追加し、initialCurrencyBonusフィールドを新設

Co-Authored-By: Claude Sonnet 5 <noreply@anthropic.com>
EOF
)"
```

---

### Task 2: `beginRun`への反映とテスト追加

**Files:**
- Modify: `src/lib/game/shidasu/engine.ts:1032-1047` (`beginRun`関数)
- Test: `src/lib/game/shidasu/engine.test.ts`

- [ ] **Step 1: 失敗するテストを書く**

`src/lib/game/shidasu/engine.test.ts`の2544-2547行目「spreadId=popeでは、oracleLevelsが全役5になる」テストの直後に、以下のテストを追加する。

```ts
  test('spreadId=empressでは、currencyがinitialAmount+10になる', () => {
    const run = beginRun(DEFAULT_PARAMS, 1, 'empress')
    expect(run.currency).toBe(DEFAULT_PARAMS.currency.initialAmount + 10)
  })

  test('spreadIdを省略(fool)すると、currencyはinitialAmountのまま', () => {
    const run = beginRun(DEFAULT_PARAMS, 1)
    expect(run.currency).toBe(DEFAULT_PARAMS.currency.initialAmount)
  })
```

- [ ] **Step 2: テストが失敗することを確認する**

Run: `npm test -- engine.test.ts -t "empress"`
Expected: FAIL — `run.currency`が`DEFAULT_PARAMS.currency.initialAmount + 10`ではなく`DEFAULT_PARAMS.currency.initialAmount`のまま(まだ`beginRun`が`initialCurrencyBonus`を反映していないため)

- [ ] **Step 3: `beginRun`関数を変更する**

`src/lib/game/shidasu/engine.ts`の現在の内容(1032-1047行目):

```ts
export function beginRun(params: ShidasuParams, seed?: number, spreadId: SpreadId = 'fool'): RunState {
  const spreadConfig = params.spreads[spreadId]
  const initialExtraTableauRows = spreadConfig.initialExtraTableauRows
  const rand = createRng(seed ?? Math.floor(Math.random() * 999999) + 1)
  const initialStageStars = rollStageStars(params, rand)
  const oracleLevels = oracleLevelsWithUniformValue(spreadConfig.initialOracleLevel)
  return {
    ...createInitialRun(),
    phase: 'shop',
    extraTableauRows: initialExtraTableauRows,
    spreadId,
    stageStars: initialStageStars,
    currency: params.currency.initialAmount,
    oracleLevels,
  }
}
```

これを以下に変更する:

```ts
export function beginRun(params: ShidasuParams, seed?: number, spreadId: SpreadId = 'fool'): RunState {
  const spreadConfig = params.spreads[spreadId]
  const initialExtraTableauRows = spreadConfig.initialExtraTableauRows
  const rand = createRng(seed ?? Math.floor(Math.random() * 999999) + 1)
  const initialStageStars = rollStageStars(params, rand)
  const oracleLevels = oracleLevelsWithUniformValue(spreadConfig.initialOracleLevel)
  return {
    ...createInitialRun(),
    phase: 'shop',
    extraTableauRows: initialExtraTableauRows,
    spreadId,
    stageStars: initialStageStars,
    currency: params.currency.initialAmount + spreadConfig.initialCurrencyBonus,
    oracleLevels,
  }
}
```

- [ ] **Step 4: テストが通ることを確認する**

Run: `npm test -- engine.test.ts -t "empress"`
Expected: PASS (2件とも)

Run: `npm test -- engine.test.ts`
Expected: 全件PASS(既存テストは`fool`/`moon`/`pope`のいずれも`initialCurrencyBonus: 0`のため、`currency`計算に影響がないことを確認)

- [ ] **Step 5: 型チェック・ビルドを実行する**

Run: `npm run check`
Expected: shidasu関連の新規エラーなし

Run: `npm run build`
Expected: 成功

- [ ] **Step 6: コミット**

```bash
git add src/lib/game/shidasu/engine.ts src/lib/game/shidasu/engine.test.ts
git commit -m "$(cat <<'EOF'
feat: beginRunでinitialCurrencyBonusを初期所持金に反映

Co-Authored-By: Claude Sonnet 5 <noreply@anthropic.com>
EOF
)"
```

---

### Task 3: `/admin/shidasu-spreads`に「初期所持金オフセット」列を追加し、最終動作確認する

**Files:**
- Modify: `src/routes/admin/shidasu-spreads/+page.svelte:40-52` (`hasValidationError`)
- Modify: `src/routes/admin/shidasu-spreads/+page.svelte:118-176` (テーブルUI)

このタスクは自動テストの対象外(admin画面はこのプロジェクトの既存方針として自動テストを書かない)。手を動かして直接修正し、ビルド・型チェック・ブラウザ確認で検証する。

- [ ] **Step 1: `hasValidationError`にバリデーション条件を追加する**

`src/routes/admin/shidasu-spreads/+page.svelte`の現在の内容(40-52行目):

```ts
  let hasValidationError = $derived.by(() => {
    if (!config) return false
    return SPREAD_IDS.some(id => {
      const entry = spreadEntry(id)
      if (!entry.name.trim()) return true
      if (!entry.desc.trim()) return true
      if (!Number.isFinite(entry.initialExtraTableauRows)) return true
      if (!Number.isFinite(entry.waveTargetBase)) return true
      if (!Number.isFinite(entry.waveTargetMultiplier)) return true
      if (!Number.isFinite(entry.initialOracleLevel)) return true
      return false
    })
  })
```

これを以下に変更する:

```ts
  let hasValidationError = $derived.by(() => {
    if (!config) return false
    return SPREAD_IDS.some(id => {
      const entry = spreadEntry(id)
      if (!entry.name.trim()) return true
      if (!entry.desc.trim()) return true
      if (!Number.isFinite(entry.initialExtraTableauRows)) return true
      if (!Number.isFinite(entry.waveTargetBase)) return true
      if (!Number.isFinite(entry.waveTargetMultiplier)) return true
      if (!Number.isFinite(entry.initialOracleLevel)) return true
      if (!Number.isFinite(entry.initialCurrencyBonus)) return true
      return false
    })
  })
```

- [ ] **Step 2: テーブルヘッダーに列を追加する**

`src/routes/admin/shidasu-spreads/+page.svelte`の現在の内容(122-132行目):

```svelte
            <tr class="bg-slate-50 text-slate-500">
              <th class="px-2 py-1.5 text-left" style="width:6rem;">id</th>
              <th class="px-2 py-1.5 text-left" style="width:6rem;">名称</th>
              <th class="px-2 py-1.5 text-left" style="width:16rem;">説明文</th>
              <th class="px-2 py-1.5 text-left" style="width:7rem;">初期行数オフセット</th>
              <th class="px-2 py-1.5 text-left" style="width:7rem;">目標スコア基礎値</th>
              <th class="px-2 py-1.5 text-left" style="width:7rem;">目標スコア倍率</th>
              <th class="px-2 py-1.5 text-left" style="width:7rem;">神託初期レベル</th>
              <th class="px-2 py-1.5 text-left" style="width:12rem;">ショップ非販売種別</th>
            </tr>
```

これを以下に変更する:

```svelte
            <tr class="bg-slate-50 text-slate-500">
              <th class="px-2 py-1.5 text-left" style="width:6rem;">id</th>
              <th class="px-2 py-1.5 text-left" style="width:6rem;">名称</th>
              <th class="px-2 py-1.5 text-left" style="width:16rem;">説明文</th>
              <th class="px-2 py-1.5 text-left" style="width:7rem;">初期行数オフセット</th>
              <th class="px-2 py-1.5 text-left" style="width:7rem;">目標スコア基礎値</th>
              <th class="px-2 py-1.5 text-left" style="width:7rem;">目標スコア倍率</th>
              <th class="px-2 py-1.5 text-left" style="width:7rem;">神託初期レベル</th>
              <th class="px-2 py-1.5 text-left" style="width:7rem;">初期所持金オフセット</th>
              <th class="px-2 py-1.5 text-left" style="width:12rem;">ショップ非販売種別</th>
            </tr>
```

- [ ] **Step 3: テーブル行に入力欄を追加する**

`src/routes/admin/shidasu-spreads/+page.svelte`の現在の内容(154-157行目、神託初期レベルの`<td>`):

```svelte
                <td class="px-2 py-1.5 align-top">
                  <input type="number" step="any" bind:value={entry.initialOracleLevel} class="w-full border border-slate-200 rounded px-1 py-0.5" />
                </td>
```

この直後(158行目、ショップ非販売種別の`<td>`の直前)に、以下を挿入する:

```svelte
                <td class="px-2 py-1.5 align-top">
                  <input type="number" step="any" bind:value={entry.initialCurrencyBonus} class="w-full border border-slate-200 rounded px-1 py-0.5" />
                </td>
```

- [ ] **Step 4: 型チェック・ビルドを実行する**

Run: `npm run check`
Expected: shidasu関連の新規エラーなし

Run: `npm run build`
Expected: 成功

- [ ] **Step 5: 全テストスイートを実行する**

Run: `npm test`
Expected: 全ファイル・全テストPASS(Task 1・2で追加したテストを含む)

- [ ] **Step 6: 開発サーバーでブラウザ動作確認する**

Run: `npm run dev`(ポートが競合する場合は自動的に別ポートが割り当てられる。実際に使われたポート番号を確認すること)

ブラウザで以下を確認する。

1. `/admin/shidasu-spreads`を開き、テーブルに「女帝」の行(id: `empress`)が表示され、「初期所持金オフセット」列に`10`が入力されていること。愚者・月・教皇の行では同列が`0`になっていること
2. `/game/shidasu`のスプレッド選択画面に「女帝」が表示され、説明文が「初期所持金が10多い状態で始まる」になっていること
3. 「女帝」を選んでランを開始し、ショップ画面の所持金表示が愚者を選んだ場合より10多いこと(愚者は`DEFAULT_PARAMS.currency.initialAmount`の値、女帝はその値+10)
4. 「愚者」を選んでランを開始し、従来通りの所持金であること(回帰確認)

問題があれば修正し、Step 4〜5を再実行してから次に進む。

- [ ] **Step 7: `shidasu.config.json`が意図しない差分を持っていないか確認する**

ブラウザでのショップ操作等により`shidasu.config.json`が保存APIを通じて書き換わっていないか確認する。

Run: `git status`
Run: `git diff src/lib/game/shidasu/shidasu.config.json`

Task 1で行った変更以外の差分があれば(フォーマットの再整形等)、`git checkout -- src/lib/game/shidasu/shidasu.config.json`で復元してからTask 1の変更のみを再度適用する。差分がTask 1の内容と一致していることを確認できたら、このタスクは追加のコミットなしで完了(Task 1で既にコミット済みのため)。

- [ ] **Step 8: 開発サーバーを停止する**

動作確認が完了したら`npm run dev`のプロセスを停止する。

- [ ] **Step 9: コミット**

```bash
git add src/routes/admin/shidasu-spreads/+page.svelte
git commit -m "$(cat <<'EOF'
feat: /admin/shidasu-spreadsに初期所持金オフセット列を追加

Co-Authored-By: Claude Sonnet 5 <noreply@anthropic.com>
EOF
)"
```

(Step 7で修正が発生した場合は、修正内容も同じコミットまたは追加のコミットに含める)
