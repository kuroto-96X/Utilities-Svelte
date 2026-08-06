# 神託モチーフの六十四卦への変更・ペア/交互の神託対応 Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Shidasuの神託(oracle)のモチーフを「八卦」(8種固定)から「六十四卦」に変更し、新規役「ペア」・新規パターン「交互」を実際に神託として入手できるようにする(`ORACLE_POOL`に追加)。

**Architecture:** データファイル(`trigrams.ts`→`hexagrams.ts`、`shidasu.config.json`・`params.ts`の`oracles`セクション)を新しい10卦の名前・説明文に更新し(Task 1)、`ORACLE_POOL`にペア・交互を追加して型が揃うことで、以前YAGNI判断で追加していたフォールバック付きキャストを型安全な直接アクセスに戻す(Task 2)。

**Tech Stack:** SvelteKit, Svelte 5 runes, TypeScript, Vitest

---

### Task 1: 神託の名前データを六十四卦に更新する

**Files:**
- Create: `src/lib/game/shidasu/hexagrams.ts`
- Delete: `src/lib/game/shidasu/trigrams.ts`
- Modify: `src/lib/game/shidasu/params.ts`
- Modify: `src/lib/game/shidasu/shidasu.config.json`
- Modify: `src/routes/admin/shidasu-oracles/+page.svelte`

このタスクは主にデータの置き換えで、既存のロジック(`ORACLE_POOL`・`oracleName`/`oracleDesc`関数)には触れない。次のTask 2でロジック側を変更する。

- [ ] **Step 1: hexagrams.tsを新規作成する**

`src/lib/game/shidasu/hexagrams.ts`を新規作成し、以下の内容にする。

```ts
// 六十四卦(易経)のうち、神託(oracle)として使用中の10卦の参照データ。
// 管理画面の「名前」<select>の選択肢・読み方ラベル表示にのみ使う(秘儀のrunes.ts・
// 天啓のmansions.tsと同じ位置づけ)。六十四卦は全部で64卦あるが、今回使う10卦のみを
// データ化する(mansions.tsのような未使用分の温存はしない、将来追加時に別途拡張する)。
export interface HexagramEntry {
  kanji: string
  reading: string
}

export const HEXAGRAMS: HexagramEntry[] = [
  { kanji: '乾為天', reading: 'けんいてん' },
  { kanji: '兌為沢', reading: 'だいたく' },
  { kanji: '離為火', reading: 'りいか' },
  { kanji: '震為雷', reading: 'しんいらい' },
  { kanji: '巽為風', reading: 'そんいふう' },
  { kanji: '坎為水', reading: 'かんいすい' },
  { kanji: '艮為山', reading: 'ごんいさん' },
  { kanji: '坤為地', reading: 'こんいち' },
  { kanji: '沢山咸', reading: 'たくざんかん' },
  { kanji: '水火既済', reading: 'すいかきせい' },
]
```

- [ ] **Step 2: trigrams.tsを削除する**

`src/lib/game/shidasu/trigrams.ts`を削除する(内容が`hexagrams.ts`に置き換わり、他に参照箇所が無いため)。

```bash
rm src/lib/game/shidasu/trigrams.ts
```

- [ ] **Step 3: params.tsのoracles型定義にpair・alternatingを追加する**

`src/lib/game/shidasu/params.ts`216〜225行目の`oracles`型定義を以下のように変更する。

変更前:
```ts
  oracles: {
    completeRun: { name: string; desc: string }
    royalSet: { name: string; desc: string }
    flush: { name: string; desc: string }
    stair: { name: string; desc: string }
    color: { name: string; desc: string }
    suit: { name: string; desc: string }
    columnSweep: { name: string; desc: string }
    sameRank: { name: string; desc: string }
  }
```

変更後:
```ts
  oracles: {
    completeRun: { name: string; desc: string }
    royalSet: { name: string; desc: string }
    flush: { name: string; desc: string }
    stair: { name: string; desc: string }
    color: { name: string; desc: string }
    suit: { name: string; desc: string }
    columnSweep: { name: string; desc: string }
    sameRank: { name: string; desc: string }
    pair: { name: string; desc: string }
    alternating: { name: string; desc: string }
  }
```

- [ ] **Step 4: params.tsのDEFAULT_PARAMS.oraclesを更新する**

`src/lib/game/shidasu/params.ts`443〜452行目の`DEFAULT_PARAMS.oracles`を以下のように変更する。

変更前:
```ts
  oracles: {
    completeRun: { name: '乾', desc: 'コンプリートラン　レベル+1' },
    royalSet: { name: '兌', desc: 'ロイヤルセット　レベル+1' },
    flush: { name: '離', desc: 'フラッシュ　レベル+1' },
    stair: { name: '震', desc: '階段　レベル+1' },
    color: { name: '巽', desc: '同色　レベル+1' },
    suit: { name: '坎', desc: '同スート　レベル+1' },
    columnSweep: { name: '艮', desc: '列一掃　レベル+1' },
    sameRank: { name: '坤', desc: '同ランク　レベル+1' },
  },
```

変更後:
```ts
  oracles: {
    completeRun: { name: '乾為天', desc: 'コンプリートラン　レベル+1' },
    royalSet: { name: '兌為沢', desc: 'ロイヤルセット　レベル+1' },
    flush: { name: '離為火', desc: 'フラッシュ　レベル+1' },
    stair: { name: '震為雷', desc: '階段　レベル+1' },
    color: { name: '巽為風', desc: '同色　レベル+1' },
    suit: { name: '坎為水', desc: '同スート　レベル+1' },
    columnSweep: { name: '艮為山', desc: '列一掃　レベル+1' },
    sameRank: { name: '坤為地', desc: '同ランク　レベル+1' },
    pair: { name: '沢山咸', desc: 'ペア　レベル+1' },
    alternating: { name: '水火既済', desc: '交互　レベル+1' },
  },
```

- [ ] **Step 5: shidasu.config.jsonのoraclesセクションを更新する**

`src/lib/game/shidasu/shidasu.config.json`884〜917行目の`oracles`セクションを以下のように変更する。

変更前:
```json
  "oracles": {
    "completeRun": {
      "name": "乾",
      "desc": "コンプリートラン　レベル+1"
    },
    "royalSet": {
      "name": "兌",
      "desc": "ロイヤルセット　レベル+1"
    },
    "flush": {
      "name": "離",
      "desc": "フラッシュ　レベル+1"
    },
    "stair": {
      "name": "震",
      "desc": "階段　レベル+1"
    },
    "color": {
      "name": "巽",
      "desc": "同色　レベル+1"
    },
    "suit": {
      "name": "坎",
      "desc": "同スート　レベル+1"
    },
    "columnSweep": {
      "name": "艮",
      "desc": "列一掃　レベル+1"
    },
    "sameRank": {
      "name": "坤",
      "desc": "同ランク　レベル+1"
    }
  },
```

変更後:
```json
  "oracles": {
    "completeRun": {
      "name": "乾為天",
      "desc": "コンプリートラン　レベル+1"
    },
    "royalSet": {
      "name": "兌為沢",
      "desc": "ロイヤルセット　レベル+1"
    },
    "flush": {
      "name": "離為火",
      "desc": "フラッシュ　レベル+1"
    },
    "stair": {
      "name": "震為雷",
      "desc": "階段　レベル+1"
    },
    "color": {
      "name": "巽為風",
      "desc": "同色　レベル+1"
    },
    "suit": {
      "name": "坎為水",
      "desc": "同スート　レベル+1"
    },
    "columnSweep": {
      "name": "艮為山",
      "desc": "列一掃　レベル+1"
    },
    "sameRank": {
      "name": "坤為地",
      "desc": "同ランク　レベル+1"
    },
    "pair": {
      "name": "沢山咸",
      "desc": "ペア　レベル+1"
    },
    "alternating": {
      "name": "水火既済",
      "desc": "交互　レベル+1"
    }
  },
```

- [ ] **Step 6: admin/shidasu-oracles/+page.svelteのimportをHEXAGRAMSに切り替える**

`src/routes/admin/shidasu-oracles/+page.svelte`5行目のimportを以下のように変更する。

変更前:
```ts
  import { TRIGRAMS } from '$lib/game/shidasu/trigrams'
```

変更後:
```ts
  import { HEXAGRAMS } from '$lib/game/shidasu/hexagrams'
```

同ファイルの`{#each TRIGRAMS as trigram (trigram.kanji)}`ブロック(125〜127行目付近)を以下のように変更する。

変更前:
```svelte
                    {#each TRIGRAMS as trigram (trigram.kanji)}
                      <option value={trigram.kanji}>{trigram.kanji} {trigram.reading}</option>
                    {/each}
```

変更後:
```svelte
                    {#each HEXAGRAMS as hexagram (hexagram.kanji)}
                      <option value={hexagram.kanji}>{hexagram.kanji} {hexagram.reading}</option>
                    {/each}
```

実際の変更前コードは、事前に`grep -n "TRIGRAMS" src/routes/admin/shidasu-oracles/+page.svelte`で正確な行番号を再確認してから変更すること(計画書作成時点から多少ズレている可能性があるため、実物を確認して整合させる)。

- [ ] **Step 7: 型チェックを実行する**

Run: `npm run check`
Expected: この時点では`ORACLE_POOL`・`oracleEntry`関数(`oracles.ts`・`admin/shidasu-oracles/+page.svelte`)がまだ`pair`・`alternating`を含まない古いキャストのままのため、`params.oracles`型が変わったことによる型エラーは発生しない(既存のキャストがそのまま通る)。shidasu関連のエラーは0件のままであることを確認する

- [ ] **Step 8: 全体テストを実行する**

Run: `npx vitest run`
Expected: 全件PASS(卦名を直接検証する既存テストは無いため、影響を受けない)

- [ ] **Step 9: Commit**

```bash
git add src/lib/game/shidasu/hexagrams.ts src/lib/game/shidasu/trigrams.ts src/lib/game/shidasu/params.ts src/lib/game/shidasu/shidasu.config.json src/routes/admin/shidasu-oracles/+page.svelte
git commit -m "feat: 神託の名前データを八卦から六十四卦(10卦分)に更新"
```

`trigrams.ts`はStep 2で物理削除済みのため、`git add`がその削除を検知してステージングする(`git rm`は既に存在しないファイルに対しては使えないため、`git add`で統一する)。

---

### Task 2: ORACLE_POOLにペア・交互を追加し、型安全性を回復する

**Files:**
- Modify: `src/lib/game/shidasu/oracles.ts`
- Modify: `src/lib/game/shidasu/oracleActualEffects.ts`
- Modify: `src/routes/admin/shidasu-oracles/+page.svelte`
- Test: `src/lib/game/shidasu/oracles.test.ts`

**Files context:** Task 1が完了・コミット済みであることが前提。`params.oracles`型・`shidasu.config.json`・`DEFAULT_PARAMS`はすでに`pair`・`alternating`を含んでいる。

- [ ] **Step 1: 失敗するテストを書く**

`src/lib/game/shidasu/oracles.test.ts`の`describe('rollOracleOffer', ...)`ブロック内、既存の最初のテストの直後に以下を追加する。

```ts
  test('ORACLE_POOLは10種類(ペア・交互を含む)', () => {
    expect(ORACLE_POOL).toHaveLength(10)
    expect(ORACLE_POOL).toContain('pair')
    expect(ORACLE_POOL).toContain('alternating')
  })
```

- [ ] **Step 2: テストを実行して失敗を確認する**

Run: `npx vitest run src/lib/game/shidasu/oracles.test.ts -t "ORACLE_POOLは10種類"`
Expected: FAIL(`ORACLE_POOL`はまだ8種類のため)

- [ ] **Step 3: ORACLE_POOLにpair・alternatingを追加する**

`src/lib/game/shidasu/oracles.ts`6〜9行目を以下のように変更する。

変更前:
```ts
// rollOracleOfferは重み付けなしの完全均等抽選。8役すべてが対象(将来の追加余地なし)。
export const ORACLE_POOL: RoleName[] = [
  'completeRun', 'royalSet', 'flush', 'stair', 'color', 'suit', 'columnSweep', 'sameRank',
]
```

変更後:
```ts
// rollOracleOfferは重み付けなしの完全均等抽選。10役すべてが対象。
export const ORACLE_POOL: RoleName[] = [
  'completeRun', 'royalSet', 'flush', 'stair', 'color', 'suit', 'columnSweep', 'sameRank',
  'pair', 'alternating',
]
```

- [ ] **Step 4: テストを実行して成功を確認する**

Run: `npx vitest run src/lib/game/shidasu/oracles.test.ts -t "ORACLE_POOLは10種類"`
Expected: PASS

- [ ] **Step 5: oracleName・oracleDescのフォールバックキャストを型安全な直接アクセスに戻す**

`src/lib/game/shidasu/oracles.ts`11〜25行目を以下のように変更する。

変更前:
```ts
// params.oraclesはpair・alternatingを含まない(YAGNI判断、実装計画のTask 1参照)。
// RoleName型はpair・alternatingを含むため、インデックスアクセスは型エラーになる。
// ORACLE_POOLにpair・alternatingが含まれない限り実行時にこの分岐へは入らないが、
// 型安全のためPartialでキャストしフォールバックを用意する。
function oracleEntry(roleName: RoleName, params: ShidasuParams): { name: string; desc: string } | undefined {
  return (params.oracles as Partial<Record<RoleName, { name: string; desc: string }>>)[roleName]
}

export function oracleName(roleName: RoleName, params: ShidasuParams): string {
  return oracleEntry(roleName, params)?.name ?? roleName
}

export function oracleDesc(roleName: RoleName, params: ShidasuParams): string {
  return oracleEntry(roleName, params)?.desc ?? ''
}
```

変更後:
```ts
export function oracleName(roleName: RoleName, params: ShidasuParams): string {
  return params.oracles[roleName].name
}

export function oracleDesc(roleName: RoleName, params: ShidasuParams): string {
  return params.oracles[roleName].desc
}
```

- [ ] **Step 6: defaultOracleLevelsの周辺コメントを確認する**

`src/lib/game/shidasu/oracles.ts`の`defaultOracleLevels`関数(既存のまま変更不要、`pair: 1, alternating: 1`は前回の実装で既に追加済み)。この関数はそのまま変更しない。

- [ ] **Step 7: oracleActualEffects.tsのコメントを更新する**

`src/lib/game/shidasu/oracleActualEffects.ts`の`pair`・`alternating`エントリを以下のように変更する。

変更前:
```ts
  pair: 'ペアのレベルを+1する。以後evaluateChainBonus(patterns.ts)のペアボーナス計算で、基礎点(pairBonusUnit)にこのレベルを乗算した額が加点される(明星・ソウィロ由来のroleBonusMultiplierとも併せて乗算される)。現時点ではORACLE_POOLに含まれないため、実際にこの神託を入手する手段は無い(将来の追加を見越した先行実装)',
  alternating: '交互のレベルを+1する。以後evaluateChainBonus(patterns.ts)の交互ボーナス計算で、基礎点(alternatingBonus)にこのレベルを乗算した額が加点される。現時点ではORACLE_POOLに含まれないため、実際にこの神託を入手する手段は無い(将来の追加を見越した先行実装)',
```

変更後:
```ts
  pair: 'ペアのレベルを+1する。以後evaluateChainBonus(patterns.ts)のペアボーナス計算で、基礎点(pairBonusUnit)にこのレベルを乗算した額が加点される(明星・ソウィロ由来のroleBonusMultiplierとも併せて乗算される)',
  alternating: '交互のレベルを+1する。以後evaluateChainBonus(patterns.ts)の交互ボーナス計算で、基礎点(alternatingBonus)にこのレベルを乗算した額が加点される',
```

- [ ] **Step 8: admin/shidasu-oracles/+page.svelteのoracleEntryキャストを更新する**

`src/routes/admin/shidasu-oracles/+page.svelte`22〜26行目を以下のように変更する。

変更前:
```ts
  function oracleEntry(roleName: RoleName): OracleEntry {
    // config.oracles(=ShidasuParams['oracles'])はpair・alternatingを含まない(YAGNI判断、
    // 実装計画のTask 1参照)。RoleName型はpair・alternatingを含むためRecordへキャストしてアクセスする。
    return (config!.oracles as unknown as Record<RoleName, OracleEntry>)[roleName]
  }
```

変更後:
```ts
  function oracleEntry(roleName: RoleName): OracleEntry {
    return config!.oracles[roleName] as unknown as OracleEntry
  }
```

- [ ] **Step 9: 全体テスト・型チェックを実行する**

Run: `npx vitest run`
Expected: 全件PASS

Run: `npm run check`
Expected: shidasu関連のエラー0件

- [ ] **Step 10: Commit**

```bash
git add src/lib/game/shidasu/oracles.ts src/lib/game/shidasu/oracles.test.ts src/lib/game/shidasu/oracleActualEffects.ts src/routes/admin/shidasu-oracles/+page.svelte
git commit -m "feat: ORACLE_POOLにペア・交互を追加し、神託として入手可能にする"
```

---

### Task 3: 統合確認

**Files:**
- Modify: `docs/shidasu/shidasu-roadmap.md`

- [ ] **Step 1: 全テストを実行する**

Run: `npx vitest run`
Expected: 全ファイルPASS

- [ ] **Step 2: ビルドを実行する**

Run: `npm run build`
Expected: ビルド成功

- [ ] **Step 3: 型チェックを実行する**

Run: `npm run check`
Expected: shidasu関連のエラー0件(他ツールの既存エラーは無関係のため無視してよい)

- [ ] **Step 4: 開発サーバーで目視確認する**

Run: `npm run dev`

確認項目:
- `/admin/shidasu-oracles`で、10行(乾為天〜水火既済)すべてが表示され、「名前」の`<select>`に10卦の選択肢が表示されることを確認する
- `/admin/shidasu-oracles`で「ペア」「交互」の行の「実際の効果(監査用)」列に、「現時点ではORACLE_POOLに含まれない」という古い注記が表示されていないことを確認する
- `/game/shidasu`または`/admin/shidasu-debug`で神託の福袋を購入し、オファーの中に「沢山咸」「水火既済」が出現しうることを確認する(10種類均等抽選のため、複数回試す必要がある場合がある)
- 神託「沢山咸」(ペア)・「水火既済」(交互)を実際に選択し、`RoleStatusPanel`のペア・交互のレベル表示が+1されることを確認する

- [ ] **Step 5: shidasu-roadmap.mdを更新する**

`docs/shidasu/shidasu-roadmap.md`14〜16行目の項目5「役の再検討」を以下のように変更する。

変更前:
```markdown
5. **役の再検討**
   役の種類の見直しを検討する。→神託も変更
   難易度別(簡単・中・難しい)の新規役・パターン候補12個を洗い出し済み(2026-08-06)。詳細は`docs/shidasu/shidasu-role-candidates.md`を参照。うちペア(役)・交互(パターン)の2個は実装完了(2026-08-06)。残り10個は実装対象の選定・実装は未着手。
   神託(oracle)の対象化(ORACLE_POOLへのペア・交互の追加)も未着手
```

変更後:
```markdown
5. **役の再検討**
   役の種類の見直しを検討する。→神託も変更
   難易度別(簡単・中・難しい)の新規役・パターン候補12個を洗い出し済み(2026-08-06)。詳細は`docs/shidasu/shidasu-role-candidates.md`を参照。うちペア(役)・交互(パターン)の2個は実装完了(2026-08-06)。残り10個は実装対象の選定・実装は未着手。
   神託(oracle)の対象化(ORACLE_POOLへのペア・交互の追加)も実装完了(2026-08-06)。モチーフを「八卦」(8種固定)から「六十四卦」(将来の拡張余地あり)に変更し、10役全ての卦名を再割り当てした。詳細は`docs/superpowers/specs/2026-08-06-shidasu-oracle-hexagrams-design.md`を参照
```

- [ ] **Step 6: Commit**

```bash
git add docs/shidasu/shidasu-roadmap.md
git commit -m "docs: shidasu-roadmap.mdに神託の六十四卦化・ペア/交互対応の実装完了を反映"
```
