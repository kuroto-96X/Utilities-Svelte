# Shidasu 護符パラメータ設定ページ Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** 護符(87種類)の名前・数値パラメータ・効果説明文プレビューを、1護符=1行のテーブル形式で一元編集できる新しい設定ページ `/admin/shidasu-talismans` を作る。

**Architecture:** `ShidasuParams['talismans']` の各エントリに `name: string` を追加し、既存の `ITEM_NAMES`(コード内ハードコード)を `itemName(id, params)` 関数に置き換える。既存の `/admin/shidasu` から護符関連セクションを削除し、代わりに新ページへ集約する。グループ分けデータ(`itemGroups.ts`)は `src/routes/admin/shidasu-debug/` から `src/lib/game/shidasu/` に移動し、新ページとデバッグサンドボックスの両方から共有する。

**Tech Stack:** SvelteKit + Svelte 5 runes、TypeScript、Vitest。参照元スペック: `docs/superpowers/specs/2026-07-15-shidasu-talisman-params-page-design.md`

---

## 前提知識(実装前に把握しておくこと)

- `ShidasuParams['talismans']`(`src/lib/game/shidasu/params.ts`)は87種類の護符のうち82種類分のエントリを持つ(`bridge`・`grace`・`eternity`・`abundance`・`silence`の5種類は数値パラメータを持たないため未登録)。今回の変更でこの5種類も `{ name: string }` のみのエントリとして追加し、全87種類を管理する。
- `ITEM_NAMES: Record<ItemId, string>`(`src/lib/game/shidasu/engine.ts:1231`)は護符名のハードコードされたRecord。今回削除し、`itemDesc(id, params)` と同じ形の `itemName(id, params): string` に置き換える(`params.talismans[id].name` を返すだけ)。
- `itemDesc(id, params): string`(`engine.ts:1321`)は護符IDと現在のパラメータ値から効果説明文を動的生成する関数。**今回は一切変更しない**(新ページでは読み取り専用プレビューとして呼び出すだけ)。
- `ITEM_NAMES` の呼び出し箇所は4ファイル: `engine.ts`(定義のみ)、`src/routes/game/shidasu/+page.svelte`(3箇所)、`src/routes/admin/shidasu-debug/DebugStatePanel.svelte`(1箇所)、`src/routes/admin/shidasu-debug/ItemChecklist.svelte`(1箇所)、`src/lib/game/shidasu/engine.test.ts`(7箇所)。
- `src/routes/admin/shidasu-debug/itemGroups.ts` は87護符を19グループに分類したデータ(`ITEM_GROUPS: { label: string; ids: ItemId[] }[]`)。`itemGroups.test.ts` で `ITEM_POOL` との整合性をテスト済み。今回 `src/lib/game/shidasu/itemGroups.ts` に移動する。
- 設定の読み書きは既存の `/api/admin/shidasu-config` エンドポイント(`vite.config.ts` の `shidasuConfigApiPlugin`、GET/POSTで `src/lib/game/shidasu/shidasu.config.json` を読み書き)をそのまま使う。新しいAPIは作らない。
- `loadParams(): ShidasuParams` は `shidasu.config.json` を読み込むだけの関数(`params.ts`)。`DEFAULT_PARAMS` はコード内蔵の既定値(リセット用・APIに繋がらない場合のフォールバック用)。
- 数値パラメータ入力欄について、既存の `/admin/shidasu` ページはフィールドごとに異なる `step`(0.01・0.1・1など)を手動指定しているが、新ページでは全パラメータ入力に `step="any"` を使う(87項目×0〜2パラメータ分の個別step指定を避けるための意図的な簡略化。HTML側のstep制約はスピナー矢印の増減幅にのみ影響し、直接入力した値の保存を妨げない)。

---

## ファイル構成

- `src/lib/game/shidasu/params.ts`(修正): `talismans` 型・`DEFAULT_PARAMS.talismans` に `name` を追加、5護符分のエントリを新規追加
- `src/lib/game/shidasu/shidasu.config.json`(修正): 同上(実行時設定ファイル)
- `src/lib/game/shidasu/engine.ts`(修正): `ITEM_NAMES` 削除、`itemName(id, params)` 追加
- `src/lib/game/shidasu/engine.test.ts`(修正): `ITEM_NAMES` → `itemName` に置き換え
- `src/routes/game/shidasu/+page.svelte`(修正): `ITEM_NAMES` → `itemName(id, params)` に置き換え(3箇所)
- `src/routes/admin/shidasu-debug/DebugStatePanel.svelte`(修正): 同上(1箇所、`params` をローカルで用意する必要あり)
- `src/routes/admin/shidasu-debug/ItemChecklist.svelte`(修正): 同上(1箇所)
- `src/lib/game/shidasu/itemGroups.ts`(新規、`src/routes/admin/shidasu-debug/itemGroups.ts` から移動)
- `src/lib/game/shidasu/itemGroups.test.ts`(新規、同上から移動)
- `src/routes/admin/shidasu-debug/itemGroups.ts` / `itemGroups.test.ts`(削除)
- `src/routes/admin/shidasu-talismans/+page.svelte`(新規): 護符パラメータ設定ページ本体
- `src/routes/admin/+page.svelte`(修正): 新ページへのリンク追加
- `src/routes/admin/shidasu/+page.svelte`(修正): 護符関連6セクションを削除

---

### Task 1: `talismans` に `name` を追加し、`ITEM_NAMES` を `itemName(id, params)` に置き換える

**Files:**
- Modify: `src/lib/game/shidasu/params.ts`
- Modify: `src/lib/game/shidasu/shidasu.config.json`
- Modify: `src/lib/game/shidasu/engine.ts`
- Modify: `src/lib/game/shidasu/engine.test.ts`
- Modify: `src/routes/game/shidasu/+page.svelte`
- Modify: `src/routes/admin/shidasu-debug/DebugStatePanel.svelte`
- Modify: `src/routes/admin/shidasu-debug/ItemChecklist.svelte`

- [ ] **Step 1: 失敗するテストを書く(`itemName` がまだ存在しない)**

`src/lib/game/shidasu/engine.test.ts` の86行目にある

```ts
describe('ITEM_POOL / ITEM_NAMES / itemDesc', () => {
  test('87種類のアイテムが定義されている', () => {
    expect(ITEM_POOL).toHaveLength(87)
    expect(new Set(ITEM_POOL).size).toBe(87) // 重複なし
    ITEM_NAMES.forEach ではなく ITEM_POOL.forEach(id => expect(ITEM_NAMES[id]).toBeTruthy())
```

は実際には以下(1686〜1691行目)である。この `describe` ブロック全体(1686〜1768行目、末尾は `})`)を、`ITEM_NAMES[id]` を全て `itemName(id, DEFAULT_PARAMS)` に置き換えた内容にまるごと差し替える。

置き換え前(1686〜1768行目):

```ts
describe('ITEM_POOL / ITEM_NAMES / itemDesc', () => {
  test('87種類のアイテムが定義されている', () => {
    expect(ITEM_POOL).toHaveLength(87)
    expect(new Set(ITEM_POOL).size).toBe(87) // 重複なし
    ITEM_POOL.forEach(id => expect(ITEM_NAMES[id]).toBeTruthy())
  })

  test('グループ9〜16の残り20個も名前と説明文を持つ', () => {
    const newIds: ItemId[] = [
      'gentleBreeze', 'resonance',
      'azureSky', 'amber',
      'composure', 'clarity', 'arrogance', 'echo', 'shootingStar',
      'naive', 'intuition', 'sincerity',
      'promise', 'darkClouds', 'regeneration',
      'benevolence', 'healing',
      'guidance',
      'passion', 'fightingSpirit',
    ]
    expect(newIds).toHaveLength(20)
    newIds.forEach(id => {
      expect(ITEM_NAMES[id]).toBeTruthy()
      expect(itemDesc(id, DEFAULT_PARAMS)).toBeTruthy()
    })
  })

  test('グループ17の8個も名前と説明文を持つ', () => {
    const newIds: ItemId[] = [
      'sanctify', 'protection', 'earth', 'golden',
      'morningStar', 'mercy', 'mirror', 'deadline',
    ]
    expect(newIds).toHaveLength(8)
    newIds.forEach(id => {
      expect(ITEM_NAMES[id]).toBeTruthy()
      expect(itemDesc(id, DEFAULT_PARAMS)).toBeTruthy()
    })
  })

  test('itemDescはパラメータの数値を埋め込んだ説明文を返す', () => {
    expect(itemDesc('bridge', DEFAULT_PARAMS)).toContain(String(DEFAULT_PARAMS.scoring.stairMinLen))
    expect(itemDesc('bridge', DEFAULT_PARAMS)).toContain(String(DEFAULT_PARAMS.items.stairRelaxedMinLen))
    expect(itemDesc('grace', DEFAULT_PARAMS)).toContain(String(DEFAULT_PARAMS.layout.rows))
    expect(itemDesc('grace', DEFAULT_PARAMS)).toContain(String(DEFAULT_PARAMS.layout.rows - DEFAULT_PARAMS.items.columnSweepRelaxCards))
  })

  test('新規追加した18個の護符も名前と説明文を持つ', () => {
    const newIds: ItemId[] = [
      'patience', 'purify', 'temperance',
      'springBreeze', 'summerBreeze', 'autumnBreeze', 'winterBreeze',
      'kinship', 'thaw', 'dusk', 'dawn', 'wit',
      'courage', 'daybreak', 'twilight', 'cheerful', 'conscience', 'morningMist',
    ]
    newIds.forEach(id => {
      expect(ITEM_NAMES[id]).toBeTruthy()
      expect(itemDesc(id, DEFAULT_PARAMS)).toBeTruthy()
    })
  })

  test('新規追加した35個(グループ4〜8)の護符も名前と説明文を持つ', () => {
    const newIds: ItemId[] = [
      'calm', 'serenity', 'destiny', 'fate', 'relief',
      'verdantGreen', 'gem', 'resolve', 'grail', 'moonlight', 'sunlight',
      'crown', 'cloverLeaf', 'coin', 'blade', 'chalice', 'balance', 'harmony',
      'nobility', 'tenacity', 'determination', 'cycle', 'reincarnation', 'majesty',
      'omen', 'crescent',
      'blessing', 'focus', 'lapis', 'jade', 'emptyMind',
      'prologue', 'interlude', 'morningDew',
      'drizzle',
    ]
    expect(newIds).toHaveLength(35)
    newIds.forEach(id => {
      expect(ITEM_NAMES[id]).toBeTruthy()
      expect(itemDesc(id, DEFAULT_PARAMS)).toBeTruthy()
    })
  })

  test('永劫・豊穣・静寂・不屈も名前と説明文を持つ', () => {
    const newIds: ItemId[] = ['eternity', 'abundance', 'silence', 'resilience']
    newIds.forEach(id => {
      expect(ITEM_NAMES[id]).toBeTruthy()
      expect(itemDesc(id, DEFAULT_PARAMS)).toBeTruthy()
    })
  })
})
```

置き換え後:

```ts
describe('ITEM_POOL / itemName / itemDesc', () => {
  test('87種類のアイテムが定義されている', () => {
    expect(ITEM_POOL).toHaveLength(87)
    expect(new Set(ITEM_POOL).size).toBe(87) // 重複なし
    ITEM_POOL.forEach(id => expect(itemName(id, DEFAULT_PARAMS)).toBeTruthy())
  })

  test('グループ9〜16の残り20個も名前と説明文を持つ', () => {
    const newIds: ItemId[] = [
      'gentleBreeze', 'resonance',
      'azureSky', 'amber',
      'composure', 'clarity', 'arrogance', 'echo', 'shootingStar',
      'naive', 'intuition', 'sincerity',
      'promise', 'darkClouds', 'regeneration',
      'benevolence', 'healing',
      'guidance',
      'passion', 'fightingSpirit',
    ]
    expect(newIds).toHaveLength(20)
    newIds.forEach(id => {
      expect(itemName(id, DEFAULT_PARAMS)).toBeTruthy()
      expect(itemDesc(id, DEFAULT_PARAMS)).toBeTruthy()
    })
  })

  test('グループ17の8個も名前と説明文を持つ', () => {
    const newIds: ItemId[] = [
      'sanctify', 'protection', 'earth', 'golden',
      'morningStar', 'mercy', 'mirror', 'deadline',
    ]
    expect(newIds).toHaveLength(8)
    newIds.forEach(id => {
      expect(itemName(id, DEFAULT_PARAMS)).toBeTruthy()
      expect(itemDesc(id, DEFAULT_PARAMS)).toBeTruthy()
    })
  })

  test('itemDescはパラメータの数値を埋め込んだ説明文を返す', () => {
    expect(itemDesc('bridge', DEFAULT_PARAMS)).toContain(String(DEFAULT_PARAMS.scoring.stairMinLen))
    expect(itemDesc('bridge', DEFAULT_PARAMS)).toContain(String(DEFAULT_PARAMS.items.stairRelaxedMinLen))
    expect(itemDesc('grace', DEFAULT_PARAMS)).toContain(String(DEFAULT_PARAMS.layout.rows))
    expect(itemDesc('grace', DEFAULT_PARAMS)).toContain(String(DEFAULT_PARAMS.layout.rows - DEFAULT_PARAMS.items.columnSweepRelaxCards))
  })

  test('新規追加した18個の護符も名前と説明文を持つ', () => {
    const newIds: ItemId[] = [
      'patience', 'purify', 'temperance',
      'springBreeze', 'summerBreeze', 'autumnBreeze', 'winterBreeze',
      'kinship', 'thaw', 'dusk', 'dawn', 'wit',
      'courage', 'daybreak', 'twilight', 'cheerful', 'conscience', 'morningMist',
    ]
    newIds.forEach(id => {
      expect(itemName(id, DEFAULT_PARAMS)).toBeTruthy()
      expect(itemDesc(id, DEFAULT_PARAMS)).toBeTruthy()
    })
  })

  test('新規追加した35個(グループ4〜8)の護符も名前と説明文を持つ', () => {
    const newIds: ItemId[] = [
      'calm', 'serenity', 'destiny', 'fate', 'relief',
      'verdantGreen', 'gem', 'resolve', 'grail', 'moonlight', 'sunlight',
      'crown', 'cloverLeaf', 'coin', 'blade', 'chalice', 'balance', 'harmony',
      'nobility', 'tenacity', 'determination', 'cycle', 'reincarnation', 'majesty',
      'omen', 'crescent',
      'blessing', 'focus', 'lapis', 'jade', 'emptyMind',
      'prologue', 'interlude', 'morningDew',
      'drizzle',
    ]
    expect(newIds).toHaveLength(35)
    newIds.forEach(id => {
      expect(itemName(id, DEFAULT_PARAMS)).toBeTruthy()
      expect(itemDesc(id, DEFAULT_PARAMS)).toBeTruthy()
    })
  })

  test('永劫・豊穣・静寂・不屈も名前と説明文を持つ', () => {
    const newIds: ItemId[] = ['eternity', 'abundance', 'silence', 'resilience']
    newIds.forEach(id => {
      expect(itemName(id, DEFAULT_PARAMS)).toBeTruthy()
      expect(itemDesc(id, DEFAULT_PARAMS)).toBeTruthy()
    })
  })

  test('bridge・grace・eternity・abundance・silenceもtalismansにnameエントリを持つ', () => {
    const ids: ItemId[] = ['bridge', 'grace', 'eternity', 'abundance', 'silence']
    ids.forEach(id => {
      expect(DEFAULT_PARAMS.talismans[id].name).toBeTruthy()
    })
  })
})
```

また `engine.test.ts` の18行目 `ITEM_NAMES,` を `itemName,` に置き換える。

- [ ] **Step 2: テストを実行して失敗を確認する**

Run: `npm run test -- engine.test`
Expected: FAIL(`itemName` が存在しない、`DEFAULT_PARAMS.talismans.bridge` が存在しない、などの型・実行時エラー)

- [ ] **Step 3: `params.ts` の `talismans` 型に `name` を追加し、5護符分のエントリを新規追加する**

`src/lib/game/shidasu/params.ts` の `ShidasuParams` インターフェース内、37行目 `talismans: {` から120行目の閉じ `}` までの型定義ブロックを、以下に置き換える。

```ts
  talismans: {
    bridge: { name: string }
    grace: { name: string }
    patience: { name: string; x: number }
    purify: { name: string; n: number }
    temperance: { name: string; x: number }
    springBreeze: { name: string; n: number }
    summerBreeze: { name: string; n: number }
    autumnBreeze: { name: string; n: number }
    winterBreeze: { name: string; n: number }
    kinship: { name: string; n: number }
    thaw: { name: string; n: number }
    dusk: { name: string; n: number }
    dawn: { name: string; n: number }
    wit: { name: string; n: number }
    courage: { name: string; x: number }
    daybreak: { name: string; c: number; x: number }
    twilight: { name: string; c: number; x: number }
    cheerful: { name: string; n: number }
    conscience: { name: string; n: number }
    morningMist: { name: string; c: number; x: number }
    calm: { name: string; n: number }
    serenity: { name: string; x: number }
    destiny: { name: string; n: number }
    fate: { name: string; x: number }
    relief: { name: string; n: number }
    verdantGreen: { name: string; x: number }
    gem: { name: string; x: number }
    resolve: { name: string; x: number }
    grail: { name: string; x: number }
    moonlight: { name: string; x: number }
    sunlight: { name: string; x: number }
    crown: { name: string; x: number }
    cloverLeaf: { name: string; n: number }
    coin: { name: string; n: number }
    blade: { name: string; n: number }
    chalice: { name: string; n: number }
    balance: { name: string; n: number }
    harmony: { name: string; x: number }
    nobility: { name: string; n: number }
    tenacity: { name: string; x: number }
    determination: { name: string; x: number }
    cycle: { name: string; x: number }
    reincarnation: { name: string; x: number }
    majesty: { name: string; x: number }
    omen: { name: string; m: number; x: number }
    crescent: { name: string; m: number; x: number }
    blessing: { name: string; x: number }
    focus: { name: string; x: number }
    lapis: { name: string; x: number }
    jade: { name: string; n: number }
    emptyMind: { name: string; x: number }
    prologue: { name: string; n: number }
    interlude: { name: string; m: number; n: number }
    morningDew: { name: string; n: number }
    drizzle: { name: string; n: number }
    eternity: { name: string }
    abundance: { name: string }
    silence: { name: string }
    resilience: { name: string; p: number }
    gentleBreeze: { name: string; n: number }
    resonance: { name: string; x: number }
    azureSky: { name: string; x: number }
    amber: { name: string; x: number }
    composure: { name: string; n: number }
    clarity: { name: string; n: number }
    arrogance: { name: string; x: number }
    echo: { name: string; n: number }
    shootingStar: { name: string; c: number; n: number }
    naive: { name: string }
    intuition: { name: string; x: number }
    sincerity: { name: string; n: number }
    promise: { name: string }
    darkClouds: { name: string; r: number }
    regeneration: { name: string; p: number }
    benevolence: { name: string }
    healing: { name: string }
    guidance: { name: string }
    passion: { name: string; x: number }
    fightingSpirit: { name: string; x: number }
    sanctify: { name: string }
    protection: { name: string; c: number }
    earth: { name: string; c: number }
    golden: { name: string }
    morningStar: { name: string; x: number }
    mercy: { name: string; c: number; x: number }
    mirror: { name: string }
    deadline: { name: string; n: number }
  }
```

- [ ] **Step 4: `DEFAULT_PARAMS.talismans` に `name` を追加し、5護符分のエントリを新規追加する**

同じファイルの `DEFAULT_PARAMS.talismans` オブジェクト(161行目 `talismans: {` から244行目 `},` まで)を、以下に置き換える。

```ts
  talismans: {
    bridge: { name: '架橋' },
    grace: { name: '寛容' },
    patience: { name: '忍耐', x: 500 },
    purify: { name: '浄化', n: 10000 },
    temperance: { name: '節制', x: 0.1 },
    springBreeze: { name: '春風', n: 100 },
    summerBreeze: { name: '夏風', n: 100 },
    autumnBreeze: { name: '秋風', n: 100 },
    winterBreeze: { name: '冬風', n: 100 },
    kinship: { name: '友愛', n: 200 },
    thaw: { name: '雪解', n: 200 },
    dusk: { name: '宵闇', n: 100 },
    dawn: { name: '払暁', n: 100 },
    wit: { name: '機知', n: 200 },
    courage: { name: '勇気', x: 0.1 },
    daybreak: { name: '暁', c: 3, x: 2 },
    twilight: { name: '黄昏', c: 8, x: 2 },
    cheerful: { name: '快活', n: 50 },
    conscience: { name: '良心', n: 50 },
    morningMist: { name: '朝霧', c: 5, x: 3 },
    calm: { name: '平穏', n: 200 },
    serenity: { name: '安寧', x: 1.5 },
    destiny: { name: '運命', n: 300 },
    fate: { name: '宿命', x: 2.0 },
    relief: { name: '安堵', n: 100 },
    verdantGreen: { name: '深緑', x: 3 },
    gem: { name: '宝石', x: 3 },
    resolve: { name: '真剣', x: 3 },
    grail: { name: '聖杯', x: 3 },
    moonlight: { name: '月光', x: 1.5 },
    sunlight: { name: '陽光', x: 1.5 },
    crown: { name: '王冠', x: 0.5 },
    cloverLeaf: { name: '青葉', n: 50 },
    coin: { name: '硬貨', n: 50 },
    blade: { name: '武器', n: 50 },
    chalice: { name: '献杯', n: 50 },
    balance: { name: '均衡', n: 200 },
    harmony: { name: '調和', x: 1.5 },
    nobility: { name: '高潔', n: 200 },
    tenacity: { name: '執念', x: 0.1 },
    determination: { name: '覚悟', x: 0.1 },
    cycle: { name: '循環', x: 3 },
    reincarnation: { name: '輪廻', x: 10 },
    majesty: { name: '威光', x: 50 },
    omen: { name: '兆し', m: 20, x: 1.5 },
    crescent: { name: '三日月', m: 10, x: 3 },
    blessing: { name: '恩寵', x: 1.5 },
    focus: { name: '集中', x: 3 },
    lapis: { name: '瑠璃', x: 2 },
    jade: { name: '翡翠', n: 200 },
    emptyMind: { name: '無心', x: 4 },
    prologue: { name: '序章', n: 500 },
    interlude: { name: '幕間', m: 5, n: 1000 },
    morningDew: { name: '朝露', n: 5000 },
    drizzle: { name: '小雨', n: 50 },
    eternity: { name: '永劫' },
    abundance: { name: '豊穣' },
    silence: { name: '静寂' },
    resilience: { name: '不屈', p: 30 },
    gentleBreeze: { name: '微風', n: 100 },
    resonance: { name: '共鳴', x: 0.3 },
    azureSky: { name: '蒼穹', x: 0.3 },
    amber: { name: '琥珀', x: 0.1 },
    composure: { name: '沈着', n: 500 },
    clarity: { name: '冷静', n: 500 },
    arrogance: { name: '慢心', x: 50 },
    echo: { name: '残響', n: 200 },
    shootingStar: { name: '流星', c: 10, n: 1000 },
    naive: { name: '素朴' },
    intuition: { name: '直感', x: 0.3 },
    sincerity: { name: '誠実', n: 300 },
    promise: { name: '約束' },
    darkClouds: { name: '暗雲', r: 1 },
    regeneration: { name: '再生', p: 50 },
    benevolence: { name: '博愛' },
    healing: { name: '治癒' },
    guidance: { name: '導き' },
    passion: { name: '情熱', x: 1.5 },
    fightingSpirit: { name: '闘志', x: 1.3 },
    sanctify: { name: '祝福' },
    protection: { name: '庇護', c: 3 },
    earth: { name: '大地', c: 2 },
    golden: { name: '黄金' },
    morningStar: { name: '明星', x: 0.2 },
    mercy: { name: '慈悲', c: 3, x: 1.5 },
    mirror: { name: '水鏡' },
    deadline: { name: '刻限', n: 10 },
  },
```

- [ ] **Step 5: `shidasu.config.json` に `name` を追加し、5護符分のエントリを新規追加する**

`src/lib/game/shidasu/shidasu.config.json` の `"talismans": {` から始まるブロック(30行目 `"talismans": {` から113行目 `}` まで)を、以下に置き換える。

```json
  "talismans": {
    "bridge": { "name": "架橋" },
    "grace": { "name": "寛容" },
    "patience": { "name": "忍耐", "x": 500 },
    "purify": { "name": "浄化", "n": 10000 },
    "temperance": { "name": "節制", "x": 0.1 },
    "springBreeze": { "name": "春風", "n": 100 },
    "summerBreeze": { "name": "夏風", "n": 100 },
    "autumnBreeze": { "name": "秋風", "n": 100 },
    "winterBreeze": { "name": "冬風", "n": 100 },
    "kinship": { "name": "友愛", "n": 200 },
    "thaw": { "name": "雪解", "n": 200 },
    "dusk": { "name": "宵闇", "n": 100 },
    "dawn": { "name": "払暁", "n": 100 },
    "wit": { "name": "機知", "n": 200 },
    "courage": { "name": "勇気", "x": 0.1 },
    "daybreak": { "name": "暁", "c": 3, "x": 2 },
    "twilight": { "name": "黄昏", "c": 8, "x": 2 },
    "cheerful": { "name": "快活", "n": 50 },
    "conscience": { "name": "良心", "n": 50 },
    "morningMist": { "name": "朝霧", "c": 5, "x": 3 },
    "calm": { "name": "平穏", "n": 200 },
    "serenity": { "name": "安寧", "x": 1.5 },
    "destiny": { "name": "運命", "n": 300 },
    "fate": { "name": "宿命", "x": 2.0 },
    "relief": { "name": "安堵", "n": 100 },
    "verdantGreen": { "name": "深緑", "x": 3 },
    "gem": { "name": "宝石", "x": 3 },
    "resolve": { "name": "真剣", "x": 3 },
    "grail": { "name": "聖杯", "x": 3 },
    "moonlight": { "name": "月光", "x": 1.5 },
    "sunlight": { "name": "陽光", "x": 1.5 },
    "crown": { "name": "王冠", "x": 0.5 },
    "cloverLeaf": { "name": "青葉", "n": 50 },
    "coin": { "name": "硬貨", "n": 50 },
    "blade": { "name": "武器", "n": 50 },
    "chalice": { "name": "献杯", "n": 50 },
    "balance": { "name": "均衡", "n": 200 },
    "harmony": { "name": "調和", "x": 1.5 },
    "nobility": { "name": "高潔", "n": 200 },
    "tenacity": { "name": "執念", "x": 0.1 },
    "determination": { "name": "覚悟", "x": 0.1 },
    "cycle": { "name": "循環", "x": 3 },
    "reincarnation": { "name": "輪廻", "x": 10 },
    "majesty": { "name": "威光", "x": 50 },
    "omen": { "name": "兆し", "m": 20, "x": 1.5 },
    "crescent": { "name": "三日月", "m": 10, "x": 3 },
    "blessing": { "name": "恩寵", "x": 1.5 },
    "focus": { "name": "集中", "x": 3 },
    "lapis": { "name": "瑠璃", "x": 2 },
    "jade": { "name": "翡翠", "n": 200 },
    "emptyMind": { "name": "無心", "x": 4 },
    "prologue": { "name": "序章", "n": 500 },
    "interlude": { "name": "幕間", "m": 5, "n": 1000 },
    "morningDew": { "name": "朝露", "n": 5000 },
    "drizzle": { "name": "小雨", "n": 50 },
    "eternity": { "name": "永劫" },
    "abundance": { "name": "豊穣" },
    "silence": { "name": "静寂" },
    "resilience": { "name": "不屈", "p": 30 },
    "gentleBreeze": { "name": "微風", "n": 100 },
    "resonance": { "name": "共鳴", "x": 0.3 },
    "azureSky": { "name": "蒼穹", "x": 0.3 },
    "amber": { "name": "琥珀", "x": 0.1 },
    "composure": { "name": "沈着", "n": 500 },
    "clarity": { "name": "冷静", "n": 500 },
    "arrogance": { "name": "慢心", "x": 50 },
    "echo": { "name": "残響", "n": 200 },
    "shootingStar": { "name": "流星", "c": 10, "n": 1000 },
    "naive": { "name": "素朴" },
    "intuition": { "name": "直感", "x": 0.3 },
    "sincerity": { "name": "誠実", "n": 300 },
    "promise": { "name": "約束" },
    "darkClouds": { "name": "暗雲", "r": 1 },
    "regeneration": { "name": "再生", "p": 50 },
    "benevolence": { "name": "博愛" },
    "healing": { "name": "治癒" },
    "guidance": { "name": "導き" },
    "passion": { "name": "情熱", "x": 1.5 },
    "fightingSpirit": { "name": "闘志", "x": 1.3 },
    "sanctify": { "name": "祝福" },
    "protection": { "name": "庇護", "c": 3 },
    "earth": { "name": "大地", "c": 2 },
    "golden": { "name": "黄金" },
    "morningStar": { "name": "明星", "x": 0.2 },
    "mercy": { "name": "慈悲", "c": 3, "x": 1.5 },
    "mirror": { "name": "水鏡" },
    "deadline": { "name": "刻限", "n": 10 }
  },
```

- [ ] **Step 6: `engine.ts` の `ITEM_NAMES` を `itemName` に置き換える**

`src/lib/game/shidasu/engine.ts` の1231〜1319行目にある `export const ITEM_NAMES: Record<ItemId, string> = { ... }` ブロック全体を削除し、代わりに以下を挿入する。

```ts
export function itemName(id: ItemId, params: ShidasuParams): string {
  return params.talismans[id].name
}
```

(挿入位置はこれまで `ITEM_NAMES` があった場所と同じ、`itemDesc` 関数の直前でよい。)

- [ ] **Step 7: `game/shidasu/+page.svelte` の `ITEM_NAMES` を `itemName(id, params)` に置き換える**

`src/routes/game/shidasu/+page.svelte` の8行目

```ts
    getPlayableColumns, remainingCount, rankLabel, isRed, itemDesc, ITEM_NAMES,
```

を、以下に置き換える。

```ts
    getPlayableColumns, remainingCount, rankLabel, isRed, itemDesc, itemName,
```

317行目

```svelte
          {ITEM_NAMES[id]}{n > 1 ? `×${n}` : ''}
```

を、以下に置き換える。

```svelte
          {itemName(id, params)}{n > 1 ? `×${n}` : ''}
```

375行目と394行目(同一内容が2箇所ある)

```svelte
              <div class="font-black text-yellow-300">{ITEM_NAMES[id]}</div>
```

を、それぞれ以下に置き換える。

```svelte
              <div class="font-black text-yellow-300">{itemName(id, params)}</div>
```

- [ ] **Step 8: `DebugStatePanel.svelte` の `ITEM_NAMES` を `itemName(id, params)` に置き換える**

`src/routes/admin/shidasu-debug/DebugStatePanel.svelte` の現在の内容:

```svelte
<script lang="ts">
  import DebugPanel from '../../game/shidasu/DebugPanel.svelte'
  import { ITEM_NAMES } from '$lib/game/shidasu/engine'
  import type { WaveState, ItemId, Suit, Rank } from '$lib/game/shidasu/types'

  let { wave, items, onForceDraw }: {
    wave: WaveState
    items: ItemId[]
    onForceDraw: (suit: Suit, rank: Rank, wild: boolean) => void
  } = $props()
</script>
```

を、以下に置き換える(`itemName` に加え `loadParams` のimportと `params` 変数を追加する)。

```svelte
<script lang="ts">
  import DebugPanel from '../../game/shidasu/DebugPanel.svelte'
  import { itemName } from '$lib/game/shidasu/engine'
  import { loadParams } from '$lib/game/shidasu/params'
  import type { WaveState, ItemId, Suit, Rank } from '$lib/game/shidasu/types'

  let { wave, items, onForceDraw }: {
    wave: WaveState
    items: ItemId[]
    onForceDraw: (suit: Suit, rank: Rank, wild: boolean) => void
  } = $props()

  const params = loadParams()
</script>
```

同ファイルの

```svelte
        <span class="bg-slate-100 text-slate-700 rounded px-1.5 py-0.5">{ITEM_NAMES[id]}</span>
```

を、以下に置き換える。

```svelte
        <span class="bg-slate-100 text-slate-700 rounded px-1.5 py-0.5">{itemName(id, params)}</span>
```

- [ ] **Step 9: `ItemChecklist.svelte` の `ITEM_NAMES` を `itemName(id, params)` に置き換える**

`src/routes/admin/shidasu-debug/ItemChecklist.svelte` の2行目

```ts
  import { ITEM_NAMES, itemDesc } from '$lib/game/shidasu/engine'
```

を、以下に置き換える。

```ts
  import { itemName, itemDesc } from '$lib/game/shidasu/engine'
```

同ファイルの30行目

```svelte
              <span class="font-semibold text-slate-700">{ITEM_NAMES[id]}</span>
```

を、以下に置き換える。

```svelte
              <span class="font-semibold text-slate-700">{itemName(id, params)}</span>
```

- [ ] **Step 10: テストを実行して成功を確認する**

Run: `npm run test`
Expected: 全テスト成功(既存688件 + 今回追加した「bridge・grace・eternity・abundance・silenceもtalismansにnameエントリを持つ」1件)

- [ ] **Step 11: ビルド・型チェック**

Run: `npm run build && npm run check`
Expected: どちらもエラーなく成功

- [ ] **Step 12: ブラウザで確認**

Run: `npm run dev` → `/game/shidasu` で「はじめる」→ウェーブクリア後のアイテム選択画面で護符名・説明文が変わらず表示されることを確認。`/admin/shidasu-debug` でも護符名・所持護符名が変わらず表示されることを確認。

- [ ] **Step 13: コミット**

```bash
git add src/lib/game/shidasu/params.ts src/lib/game/shidasu/shidasu.config.json src/lib/game/shidasu/engine.ts src/lib/game/shidasu/engine.test.ts src/routes/game/shidasu/+page.svelte src/routes/admin/shidasu-debug/DebugStatePanel.svelte src/routes/admin/shidasu-debug/ItemChecklist.svelte
git commit -m "$(cat <<'EOF'
refactor: 護符名をtalismansパラメータに統合しITEM_NAMESを廃止

ITEM_NAMESのハードコードをやめ、talismans各エントリのnameフィールド
から取得するitemName(id, params)関数に置き換え。bridge・grace・
eternity・abundance・silenceの5護符もtalismansに新規登録し、
全87護符を一元管理できるようにした。
EOF
)"
```

---

### Task 2: `itemGroups.ts` を `src/lib/game/shidasu/` に移動して共有する

**Files:**
- Create: `src/lib/game/shidasu/itemGroups.ts`(`src/routes/admin/shidasu-debug/itemGroups.ts` の内容を移動)
- Create: `src/lib/game/shidasu/itemGroups.test.ts`(`src/routes/admin/shidasu-debug/itemGroups.test.ts` の内容を移動、importパス修正)
- Delete: `src/routes/admin/shidasu-debug/itemGroups.ts`
- Delete: `src/routes/admin/shidasu-debug/itemGroups.test.ts`
- Modify: `src/routes/admin/shidasu-debug/ItemChecklist.svelte`

- [ ] **Step 1: `src/lib/game/shidasu/itemGroups.ts` を作成する**

```ts
// src/lib/game/shidasu/itemGroups.ts
import type { ItemId } from './types'

export interface ItemGroup {
  label: string
  ids: ItemId[]
}

export const ITEM_GROUPS: ItemGroup[] = [
  { label: '初期実装', ids: ['bridge', 'grace'] },
  { label: 'グループ1: 全消しボーナス', ids: ['patience', 'purify', 'temperance'] },
  { label: 'グループ2: カード単体の属性', ids: ['springBreeze', 'summerBreeze', 'autumnBreeze', 'winterBreeze', 'kinship', 'thaw', 'dusk', 'dawn', 'wit'] },
  { label: 'グループ3: 現在のコンボ数判定', ids: ['courage', 'daybreak', 'twilight', 'cheerful', 'conscience', 'morningMist'] },
  { label: 'グループ4: チェーン全体の属性', ids: ['calm', 'serenity', 'destiny', 'fate', 'relief', 'verdantGreen', 'gem', 'resolve', 'grail', 'moonlight', 'sunlight', 'crown', 'cloverLeaf', 'coin', 'blade', 'chalice', 'balance', 'harmony', 'nobility', 'tenacity', 'determination', 'cycle', 'reincarnation', 'majesty'] },
  { label: 'グループ5: 場札・山札の残り枚数', ids: ['omen', 'crescent'] },
  { label: 'グループ6: 役・パターン成立状況', ids: ['blessing', 'focus', 'lapis', 'jade', 'emptyMind'] },
  { label: 'グループ7: コンボ内の位置', ids: ['prologue', 'interlude', 'morningDew'] },
  { label: 'グループ8: 無条件固定加算', ids: ['drizzle'] },
  { label: '永続デッキ・捨て札系', ids: ['eternity', 'abundance', 'silence', 'resilience'] },
  { label: 'グループ9: 列選択の連続性', ids: ['gentleBreeze', 'resonance'] },
  { label: 'グループ10: ウェーブ内累積state', ids: ['azureSky', 'amber'] },
  { label: 'グループ11: イベント発生時の直接点', ids: ['composure', 'clarity', 'arrogance', 'echo', 'shootingStar'] },
  { label: 'グループ12: 山札めくり関連', ids: ['naive', 'intuition', 'sincerity'] },
  { label: 'グループ13: 資源操作(残り)', ids: ['promise', 'darkClouds', 'regeneration'] },
  { label: 'グループ14: 保護・救済', ids: ['benevolence', 'healing'] },
  { label: 'グループ15: 情報表示', ids: ['guidance'] },
  { label: 'グループ16: 持続効果', ids: ['passion', 'fightingSpirit'] },
  { label: 'グループ17: コアパラメータ書き換え', ids: ['sanctify', 'protection', 'earth', 'golden', 'morningStar', 'mercy', 'mirror', 'deadline'] },
]
```

- [ ] **Step 2: `src/lib/game/shidasu/itemGroups.test.ts` を作成する**

```ts
import { describe, it, expect } from 'vitest'
import { ITEM_GROUPS } from './itemGroups'
import { ITEM_POOL } from './engine'

describe('ITEM_GROUPS', () => {
  it('ITEM_POOLの全種類を過不足なく分類している', () => {
    const flattened = ITEM_GROUPS.flatMap(g => g.ids)
    expect(new Set(flattened)).toEqual(new Set(ITEM_POOL))
  })

  it('同じ護符が複数グループに重複していない', () => {
    const flattened = ITEM_GROUPS.flatMap(g => g.ids)
    expect(flattened.length).toBe(new Set(flattened).size)
  })

  it('件数がITEM_POOLと一致する', () => {
    const flattened = ITEM_GROUPS.flatMap(g => g.ids)
    expect(flattened.length).toBe(ITEM_POOL.length)
  })
})
```

- [ ] **Step 3: 旧ファイルを削除する**

```bash
rm src/routes/admin/shidasu-debug/itemGroups.ts src/routes/admin/shidasu-debug/itemGroups.test.ts
```

- [ ] **Step 4: `ItemChecklist.svelte` のimportパスを更新する**

`src/routes/admin/shidasu-debug/ItemChecklist.svelte` の5行目

```ts
  import { ITEM_GROUPS } from './itemGroups'
```

を、以下に置き換える。

```ts
  import { ITEM_GROUPS } from '$lib/game/shidasu/itemGroups'
```

- [ ] **Step 5: テストを実行して成功を確認する**

Run: `npm run test`
Expected: 全テスト成功(移動した `itemGroups.test.ts` の3件を含む)

- [ ] **Step 6: ビルド・型チェック**

Run: `npm run build && npm run check`
Expected: どちらもエラーなく成功

- [ ] **Step 7: ブラウザで確認**

Run: `npm run dev` → `/admin/shidasu-debug` を開き、護符チェックリストが従来通り19グループ・87項目表示されることを確認

- [ ] **Step 8: コミット**

```bash
git add src/lib/game/shidasu/itemGroups.ts src/lib/game/shidasu/itemGroups.test.ts src/routes/admin/shidasu-debug/ItemChecklist.svelte
git add -u src/routes/admin/shidasu-debug/itemGroups.ts src/routes/admin/shidasu-debug/itemGroups.test.ts
git commit -m "$(cat <<'EOF'
refactor: 護符グルーピングデータをsrc/lib配下に移動し共有可能にする

src/routes/admin/shidasu-debug/itemGroups.tsをsrc/lib/game/shidasu/へ
移動。デバッグサンドボックスと今後追加する護符パラメータ設定ページの
両方から共通利用できるようにした。
EOF
)"
```

---

### Task 3: 護符パラメータ設定ページ `/admin/shidasu-talismans` を新規作成する

**Files:**
- Create: `src/routes/admin/shidasu-talismans/+page.svelte`
- Modify: `src/routes/admin/+page.svelte`

- [ ] **Step 1: ページを作成する**

```svelte
<script lang="ts">
  import { onMount, onDestroy } from 'svelte'
  import { DEFAULT_PARAMS, type ShidasuParams } from '$lib/game/shidasu/params'
  import { itemDesc } from '$lib/game/shidasu/engine'
  import { ITEM_GROUPS } from '$lib/game/shidasu/itemGroups'
  import type { ItemId } from '$lib/game/shidasu/types'

  let config = $state<ShidasuParams | null>(null)
  let error = $state<string | null>(null)
  let flash = $state<string | null>(null)
  let flashTimer: ReturnType<typeof setTimeout> | null = null

  function showToast(message: string) {
    if (flashTimer) clearTimeout(flashTimer)
    flash = message
    flashTimer = setTimeout(() => { flash = null }, 2000)
  }

  type TalismanEntry = { name: string } & Record<string, number>

  function talismanEntry(id: ItemId): TalismanEntry {
    return config!.talismans[id] as unknown as TalismanEntry
  }

  function talismanParamKeys(id: ItemId): string[] {
    return Object.keys(talismanEntry(id)).filter(key => key !== 'name')
  }

  let hasValidationError = $derived.by(() => {
    if (!config) return false
    return ITEM_GROUPS.some(group => group.ids.some(id => !talismanEntry(id).name.trim()))
  })

  async function loadConfig(toast = false) {
    try {
      const res = await fetch('/api/admin/shidasu-config')
      if (!res.ok) throw new Error(`HTTP ${res.status}`)
      config = await res.json() as ShidasuParams
      error = null
      if (toast) showToast('リロードしました')
    } catch {
      error = 'Shidasu設定APIに接続できません。npm run dev で起動してください。'
      if (!config) config = JSON.parse(JSON.stringify(DEFAULT_PARAMS))
    }
  }

  async function save() {
    if (!config) return
    try {
      const res = await fetch('/api/admin/shidasu-config', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(config),
      })
      if (!res.ok) throw new Error(`HTTP ${res.status}`)
      showToast('保存しました(反映には再ビルド・再デプロイが必要です)')
    } catch {
      error = '保存に失敗しました'
    }
  }

  onMount(() => loadConfig())
  onDestroy(() => {
    if (flashTimer) clearTimeout(flashTimer)
  })
</script>

<svelte:head>
  <title>Shidasu 護符パラメータ設定</title>
</svelte:head>

<div class="max-w-5xl mx-auto px-4 py-8">
  <a href="/admin" class="text-xs text-slate-400 hover:text-teal-600 mb-4 inline-block">← 管理ページ一覧</a>

  <div class="flex items-center justify-between mb-6">
    <h1 class="text-2xl font-bold text-slate-800">星詠みソリティア -Shidasu- 護符パラメータ設定</h1>
    <div class="flex gap-2">
      <button onclick={() => loadConfig(true)} class="text-sm px-3 py-1.5 rounded-lg border border-slate-200 text-slate-600 hover:bg-slate-50 transition-colors">
        リロード
      </button>
      {#if hasValidationError}
        <p class="text-xs text-red-600 self-center">護符名が空の項目があります</p>
      {/if}
      <button
        onclick={save}
        disabled={hasValidationError || !config}
        class="text-sm px-3 py-1.5 rounded-lg bg-teal-600 text-white hover:bg-teal-700 transition-colors disabled:opacity-40 disabled:cursor-not-allowed"
      >
        保存
      </button>
    </div>
  </div>

  {#if error}
    <div class="bg-red-50 border border-red-200 text-red-700 px-4 py-3 rounded-lg mb-4 text-sm">{error}</div>
  {/if}

  {#if config}
    <div class="space-y-6">
      {#each ITEM_GROUPS as group (group.label)}
        <section class="bg-white border border-slate-200 rounded-xl p-4">
          <h2 class="font-semibold text-slate-700 text-sm mb-3">{group.label}</h2>
          <div class="overflow-x-auto">
            <table class="w-full text-xs border border-slate-200 rounded-lg overflow-hidden">
              <thead>
                <tr class="bg-slate-50 text-slate-500">
                  <th class="px-2 py-1.5 text-left" style="width:9rem;">護符名</th>
                  <th class="px-2 py-1.5 text-left" style="width:11rem;">パラメータ</th>
                  <th class="px-2 py-1.5 text-left">説明文プレビュー</th>
                </tr>
              </thead>
              <tbody class="divide-y divide-slate-100">
                {#each group.ids as id (id)}
                  {@const entry = talismanEntry(id)}
                  <tr>
                    <td class="px-2 py-1.5 align-top">
                      <input type="text" bind:value={entry.name} class="w-full border border-slate-200 rounded px-1.5 py-0.5" />
                    </td>
                    <td class="px-2 py-1.5 align-top">
                      <div class="flex flex-wrap gap-1.5">
                        {#each talismanParamKeys(id) as key (key)}
                          <label class="flex items-center gap-1 text-[11px] text-slate-500">
                            {key}
                            <input type="number" step="any" bind:value={entry[key]} class="w-16 border border-slate-200 rounded px-1 py-0.5" />
                          </label>
                        {/each}
                        {#if talismanParamKeys(id).length === 0}
                          <span class="text-slate-300">-</span>
                        {/if}
                      </div>
                    </td>
                    <td class="px-2 py-1.5 align-top text-slate-500">{itemDesc(id, config)}</td>
                  </tr>
                {/each}
              </tbody>
            </table>
          </div>
        </section>
      {/each}
    </div>
  {:else if !error}
    <p class="text-slate-500 text-sm">読み込み中...</p>
  {/if}
</div>

{#if flash}
  <div class="fixed bottom-6 right-6 bg-slate-800 text-white text-sm px-4 py-2.5 rounded-lg shadow-lg z-50">
    {flash}
  </div>
{/if}
```

- [ ] **Step 2: `/admin` にリンクを追加する**

`src/routes/admin/+page.svelte` の `<a href="/admin/shidasu-debug" ...>` ブロックの直後(`</a>` の次の行、`</div>` の前)に、以下を追加する。

```svelte
    <a href="/admin/shidasu-talismans" class="flex items-center gap-3 px-4 py-4 hover:bg-slate-50 transition-colors group">
      <div class="flex-1">
        <p class="text-sm font-semibold text-slate-700 group-hover:text-teal-700">星詠みソリティア -Shidasu- 護符パラメータ設定</p>
        <p class="text-xs text-slate-400 mt-0.5">護符ごとの名前・数値パラメータ・効果説明文プレビューを1行ずつ編集</p>
      </div>
      <span class="text-slate-300 group-hover:text-teal-600 transition-colors">→</span>
    </a>
```

- [ ] **Step 3: ビルド・型チェック**

Run: `npm run build && npm run check`
Expected: どちらもエラーなく成功

- [ ] **Step 4: ブラウザで確認**

Run: `npm run dev` → `/admin/shidasu-talismans` を開き、19グループ・87行のテーブルが表示されることを確認する。

- 任意の護符名を書き換えると、同じ行の説明文プレビューが変わらないこと(説明文は数値パラメータ由来で名前を含まないものが大半)を確認しつつ、`bridge`(架橋)のようなパラメータを持つ護符の数値を書き換えると、同じ行の説明文プレビューが即座に更新されることを確認する
- 護符名を空にすると保存ボタンが無効化されることを確認する
- 保存後、リロードすると変更内容が保持されることを確認する

- [ ] **Step 5: コミット**

```bash
git add src/routes/admin/shidasu-talismans/+page.svelte src/routes/admin/+page.svelte
git commit -m "$(cat <<'EOF'
feat: Shidasu護符パラメータ設定ページを新規作成

87護符を19グループのテーブルで一覧表示し、護符名・数値パラメータを
1行ずつ編集できるようにした。効果説明文は読み取り専用プレビューとして
その場で表示する。
EOF
)"
```

---

### Task 4: `/admin/shidasu` から護符関連セクションを削除する

**Files:**
- Modify: `src/routes/admin/shidasu/+page.svelte`

- [ ] **Step 1: 護符パラメータ関連の6セクションを削除する**

`src/routes/admin/shidasu/+page.svelte` の以下6つの `<section>` ブロックを削除する(330行目の `<section class="bg-white border border-slate-200 rounded-xl p-4">` から始まる「護符パラメータ(グループ1〜3)」セクションの開始タグから、「護符パラメータ(グループ17)」セクションの終了 `</section>`(686行目)まで、連続する6セクションをまるごと削除する)。

削除対象は以下の見出しを持つセクション:
- `護符パラメータ(グループ1〜3)`
- `護符パラメータ(グループ4〜8)`
- `護符パラメータ(永続デッキ系)`
- `護符パラメータ(グループ9〜16)`
- `護符パラメータ(グループ17)`

具体的には、次の行

```svelte
      <section class="bg-white border border-slate-200 rounded-xl p-4">
        <h2 class="font-semibold text-slate-700 text-sm mb-3">護符パラメータ(グループ1〜3)</h2>
```

から、次の行

```svelte
      <section class="bg-white border border-slate-200 rounded-xl p-4">
        <h2 class="font-semibold text-slate-700 text-sm mb-3">フロー・UI</h2>
```

の直前(「護符パラメータ(グループ17)」セクションの閉じ `</section>`、およびその直後の空行まで)を全て削除する。「フロー・UI」セクション自体とそれ以降は残す。

- [ ] **Step 2: ページ見出しの下に護符設定ページへの導線を追加する**

削除した6セクションの代わりに、以下の案内を1行追加する。「アイテム」セクション(`<h2 ...>アイテム</h2>` を含むセクション)の直後、「フロー・UI」セクションの直前に挿入する。

```svelte
      <p class="text-xs text-slate-400 px-1">
        護符ごとの名前・パラメータ・説明文は
        <a href="/admin/shidasu-talismans" class="text-teal-600 hover:underline">護符パラメータ設定ページ</a>
        に移動しました。
      </p>
```

- [ ] **Step 3: ビルド・型チェック**

Run: `npm run build && npm run check`
Expected: どちらもエラーなく成功

- [ ] **Step 4: ブラウザで確認**

Run: `npm run dev` → `/admin/shidasu` を開き、レイアウト・スコアリング・役ボーナス・ステージ・アイテム・フロー/UI・JSON入出力の各セクションが従来通り表示され、護符パラメータ関連セクションが表示されないこと、案内文から新ページへのリンクが機能することを確認する。

- [ ] **Step 5: コミット**

```bash
git add src/routes/admin/shidasu/+page.svelte
git commit -m "$(cat <<'EOF'
refactor: /admin/shidasuから護符パラメータセクションを削除

護符パラメータ設定ページ(/admin/shidasu-talismans)に機能を集約した
ため、既存ページの護符関連6セクションを削除し、新ページへの案内リンク
に置き換えた。
EOF
)"
```

---

### Task 5: 最終確認

**Files:** なし(検証のみ)

- [ ] **Step 1: テスト全体を実行する**

Run: `npm run test`
Expected: 全テスト成功

- [ ] **Step 2: ビルド・型チェック**

Run: `npm run build && npm run check`
Expected: どちらもエラーなく成功

- [ ] **Step 3: ブラウザで受け入れ基準を確認する**

Run: `npm run dev` → 以下を順に確認する(`docs/superpowers/specs/2026-07-15-shidasu-talisman-params-page-design.md` 6節の受け入れ基準に対応)。

1. `/admin` から `/admin/shidasu-talismans` に遷移でき、87護符が19グループのテーブルで表示される
2. 護符名を編集すると同じ行の説明文プレビューが即座に更新される(名前を説明文に含む護符があれば反映を確認、無ければ名前欄自体が更新されることを確認)
3. パラメータ数値を編集すると同じ行の説明文プレビューが即座に更新される
4. 保存後リロードしても内容が保持される
5. `/admin/shidasu` から護符関連6セクションが削除され、他セクションは従来通り動作する
6. `/game/shidasu`(実プレイでアイテム選択画面まで到達)・`/admin/shidasu-debug` で護符名が正しく表示される(表示上の変化なし)
7. `npm run test`・`npm run build`・`npm run check` が成功する(Step 1・2で確認済み)

- [ ] **Step 4: 完了報告**

問題があれば修正してから完了とする。新規コミットは不要(Task 1〜4で既にコミット済み)。

---

## 自己レビュー結果

- **spec カバレッジ:** spec 1節(全体アーキテクチャ)→ Task 3、2節(データモデル)→ Task 1、3節(グループ共有)→ Task 2、4節(新ページのレイアウト)→ Task 3、5節(スコープ外: itemDesc編集は実装しない)→ 各タスクで一切触れていない、6節(受け入れ基準)→ Task 5 で全項目確認。すべて対応するタスクあり。
- **プレースホルダースキャン:** 「TBD」「後で実装」等の記述なし。全87護符分の型・デフォルト値・JSON値・グループ分けデータを省略なく記載した。
- **型・シグネチャ整合性:** `itemName(id: ItemId, params: ShidasuParams): string` のシグネチャは Task 1 で定義し、Task 3・既存呼び出し元(Task 1で更新)すべてで同じ形で呼び出している。`ITEM_GROUPS`/`ItemGroup` の型・エクスポート名は Task 2 で移動後も変更していない。`TalismanEntry` 型は Task 3 内で閉じており他ファイルに影響しない。
