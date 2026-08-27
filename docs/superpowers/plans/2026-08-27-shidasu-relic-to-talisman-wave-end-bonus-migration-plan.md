# Wave終了時報酬レリック3件の護符化 Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** レリック「数珠(juzu)」「千社札(senjafuda)」「算盤(soroban)」を削除し、同等の効果を持つ護符「活気(vigor)」「瑞祝(zuishuku)」「市況(marketTrend)」を新設することで、「Wave終了時報酬はレリックではなく護符が担う」というすみわけに統一する。

**Architecture:** レリック側は型定義・`RELIC_POOL`・`params.ts`・`shidasu.config.json`・`relics.ts`の3ボーナス関数・テストから機械的に削除する(過去の「暗雲」護符削除と同じパターン)。護符側は既存の方向性2実装(決算・還元・報奨・褒賞・恩賞)と同じ`resolveWaveEnd`内トリガーパターンで3件を新規追加し、効果は`currency`(星片)への加算とする。付喪化(2段階強度)の概念は護符側には存在しないため捨て、付喪化後の強化値をそのまま単一強度として採用する。

**Tech Stack:** TypeScript, Vitest, SvelteKit (`src/lib/game/shidasu/`配下の純粋関数群への追加・削除)

---

## 前提知識(既存コードの構造)

- `RelicId`型(`types.ts:141-144`)、`RELIC_POOL`(`relics.ts:6-10`、13件)。
- `params.ts`の`ShidasuParams.relics`型定義(`params.ts:274-288`)・`DEFAULT_PARAMS.relics`(`params.ts:578-592`)。
- `relics.ts`の`juzuBonus`/`senjafudaBonus`/`sorobanBonus`関数(`relics.ts:78-107`)と、それらを合算する`relicWaveEndBonus`(`relics.ts:109-113`)。呼び出し元は`engine.ts`の`resolveWaveEnd`(`engine.ts:1047`、`const earned = baseEarned + relicWaveEndBonus(params, run, wave, baseEarned)`)。
- `resolveWaveEnd`関数の現在の完全な構造(`engine.ts:1034-1102`)。決算(`settlement`)→還元(`refund`)→報奨(`bonus`)/褒賞(`commendation`)/恩賞(`favor`)の順で`items`/`rites`/`revelations`/`oracles`・`currency`を組み立てるパイプラインになっている。新規3件はこのパイプラインの末尾(恩賞の直後、`runWithCurrency`構築の直前)に追加する。
- `ItemId`型(`types.ts`)・`params.ts`の`talismans`型定義・`DEFAULT_PARAMS.talismans`(`params.ts:477-508`に方向性1・2の32件が並ぶ)。
- `ITEM_POOL`(`items.ts:8-47`、130件)・`ITEM_GROUPS`(`itemGroups.ts`、方向性1が「グループ23」、方向性2が「グループ24」)・`ITEM_ACTUAL_EFFECTS`(`itemActualEffects.ts`)。
- Admin画面(`/admin/shidasu-talismans`・`/admin/shidasu-relics`)は`ITEM_GROUPS`/`RELIC_POOL`をそのまま参照して自動描画されるため、コード変更不要。
- `engine.test.ts`の`endedRun`ヘルパー(`engine.test.ts:2625-2633`、`beginRun`→`startWave`→`status: 'ended', endReason: 'target'`で組み立てる)。`wave`の内部フィールド(`maxComboThisWave`等)を追加でカスタムする場合は、`endedRun`の戻り値に対して`{ ...run, wave: { ...run.wave!, フィールド: 値 } }`という形で上書きする(決算のテスト`engine.test.ts:2766-2788`が実例)。
- 削除の前例: コミット`8c81754`(「暗雲」護符の削除)が、型定義・プール・params・config.json・グルーピング・テスト件数を一貫して更新する標準パターン。

## Task 1: レリック3件(数珠・千社札・算盤)の削除

**Files:**
- Modify: `src/lib/game/shidasu/types.ts` (`RelicId`型)
- Modify: `src/lib/game/shidasu/relics.ts` (`RELIC_POOL`、`juzuBonus`/`senjafudaBonus`/`sorobanBonus`/`relicWaveEndBonus`)
- Modify: `src/lib/game/shidasu/params.ts` (`relics`型定義・`DEFAULT_PARAMS.relics`)
- Modify: `src/lib/game/shidasu/shidasu.config.json`
- Test: `src/lib/game/shidasu/relics.test.ts`

- [ ] **Step 1: 削除対象を確認する失敗テストを書く(件数アサーションの先出し更新)**

`relics.test.ts:57`付近の既存テストを確認し、以下のように更新する(TDDとしては「削除後の期待値を先に書いて失敗させる」形になる):

```ts
  it('10候補すべてがRELIC_POOLに含まれる(placeholderは除去済み)', () => {
    for (const id of expectedIds) {
      expect(RELIC_POOL).toContain(id)
    }
    expect(RELIC_POOL).toHaveLength(10)
  })
```

`relics.test.ts:45-50`の`expectedIds`配列から`'juzu'`・`'senjafuda'`・`'soroban'`を削除する:

```ts
describe('RELIC_POOL(第1弾13候補のうち10候補、Wave終了時報酬3種は護符へ移行)', () => {
  const expectedIds = [
    'manekiNeko', 'fukuDaruma', 'kumade',
    'manekiHoteizo', 'hamaya', 'senbazuru', 'fukuzasa',
    'kaiunKokeshi', 'engiKozuchi', 'engiSuzu',
  ] as const
```

`describe`ブロックの見出し(`relics.test.ts:45`)も上記の通り更新する。

- [ ] **Step 2: テストを実行し失敗を確認**

Run: `npm run test -- relics.test.ts`
Expected: FAIL(`RELIC_POOL`はまだ13件で`toHaveLength(10)`に一致しない、`juzu`/`senjafuda`/`soroban`もまだ含まれる)

- [ ] **Step 3: relics.test.tsの数珠・千社札・算盤関連テストを削除**

以下の3箇所を削除する:

1. `relics.test.ts:30-42`の「千社札・算盤のtsukumokaDescは基礎値プレースホルダーを含まない」テスト(コメント含む、`test('千社札・算盤のtsukumokaDescは...`ブロック全体)を削除。

2. `relics.test.ts:136-174`の`describe('relicWaveEndBonus', ...)`ブロック内、以下のテストケースを削除:
   - `it('数珠(未付喪化): floor(maxComboThisWave/5)*1', ...)`
   - `it('数珠(付喪化): floor(maxComboThisWave/5)*2', ...)`
   - `it('千社札(未付喪化): floor(成立役の種類数/2)*1', ...)`
   - `it('千社札(付喪化): n=2に強化', ...)`
   - `it('算盤(未付喪化): floor(((c-b-a)/(c-b))*5)', ...)`

   Step 5で`relicWaveEndBonus`関数自体を削除するため、`describe('relicWaveEndBonus', ...)`ブロック全体(`it('レリック無しなら0', ...)`を含む、`relics.test.ts:136-139`も含めて)を削除する。テストファイル先頭のimport文(`import { ... relicWaveEndBonus, ... } from './relics'`)からも`relicWaveEndBonus`を除去する。

- [ ] **Step 4: types.tsのRelicId型から3件削除**

`types.ts:141-144`を変更:

```ts
export type RelicId =
  | 'manekiNeko' | 'fukuDaruma' | 'kumade'
  | 'manekiHoteizo' | 'hamaya' | 'senbazuru' | 'fukuzasa'
  | 'kaiunKokeshi' | 'engiKozuchi' | 'engiSuzu'
```

`types.ts:140`のコメント「第1弾13候補(仮称)」も「第1弾13候補のうち10候補(仮称、Wave終了時報酬3種は護符へ移行)」のように更新する。

- [ ] **Step 5: relics.tsからRELIC_POOL・3つのボーナス関数・relicWaveEndBonus関数を削除**

`relics.ts:6-10`を変更:

```ts
// レリックの抽選プール。第1弾13候補のうち10候補(Wave終了時報酬3種=数珠・千社札・算盤は護符へ移行済み)。
export const RELIC_POOL: RelicId[] = [
  'manekiNeko', 'fukuDaruma', 'kumade',
  'manekiHoteizo', 'hamaya', 'senbazuru', 'fukuzasa',
  'kaiunKokeshi', 'engiKozuchi', 'engiSuzu',
]
```

`relics.ts:78-107`の`juzuBonus`/`senjafudaBonus`/`sorobanBonus`関数(3関数まるごと)を削除する。

`relics.ts:109-113`の`relicWaveEndBonus`関数を完全に削除する(該当するレリックが無くなったため、YAGNI原則に従い関数自体を削除する。将来Wave終了時報酬を持つレリックが復活する場合は、その時点で必要な関数を新規に書けばよい)。

`relics.ts`の`WaveState`型のimportが、この関数の削除によって不要になっていないか確認する(他の関数が`WaveState`を使っていなければimportを削除する)。

`engine.ts:1047`の呼び出し元を変更:

```ts
  const earned = baseEarned
```

(`const earned = baseEarned + relicWaveEndBonus(params, run, wave, baseEarned)`から`relicWaveEndBonus`呼び出し部分を削除する。)

`engine.ts`の`relicWaveEndBonus`のimportも削除する(`import { ... relicWaveEndBonus, ... } from './relics'`のような箇所を`grep`で探し、該当箇所からこの識別子を除去する)。

- [ ] **Step 6: params.tsのrelics型定義・DEFAULT_PARAMSから3件削除**

`params.ts:274-288`の`relics`型定義から以下の3行を削除:

```ts
    juzu: { name: string; desc: string; tsukumokaDesc: string; price: number; n: number; tsukumokaN: number }
```
```ts
    senjafuda: { name: string; desc: string; tsukumokaDesc: string; price: number; n: number }
```
```ts
    soroban: { name: string; desc: string; tsukumokaDesc: string; price: number; n: number }
```

`params.ts:578-592`の`DEFAULT_PARAMS.relics`から以下の3行を削除:

```ts
    juzu: { name: '数珠', desc: 'Waveクリア時、そのWaveでの最大コンボ数に応じて追加報酬(floor(最大コンボ数/5)×{n})を得る', tsukumokaDesc: 'Waveクリア時、そのWaveでの最大コンボ数に応じて追加報酬(floor(最大コンボ数/5)×{tsukumokaN})を得る', price: 20, n: 1, tsukumokaN: 2 },
```
```ts
    senjafuda: { name: '千社札', desc: 'Waveクリア時、そのWaveで成立した役の種類数に応じて追加報酬(floor(役の種類数/2)×{n})を得る', tsukumokaDesc: 'Waveクリア時、そのWaveで成立した役の種類数に応じて追加報酬(floor(役の種類数/2)×2)を得る(付喪化によりn=2に強化)', price: 20, n: 1 },
```
```ts
    soroban: { name: '算盤', desc: 'Waveクリア時、山札の消費割合に応じて追加報酬(floor(((c-b-a)/(c-b))×{n})、a=残り山札枚数,b=初期配布枚数,c=デッキ総枚数)を得る', tsukumokaDesc: 'Waveクリア時、山札の消費割合に応じて追加報酬(floor(((c-b-a)/(c-b))×10)、a=残り山札枚数,b=初期配布枚数,c=デッキ総枚数)を得る(付喪化によりn=10に強化)', price: 20, n: 5 },
```

- [ ] **Step 7: shidasu.config.jsonから3件削除**

`shidasu.config.json`の`relics`セクションから、`juzu`・`senjafuda`・`soroban`の3エントリを削除する(Step 6で削除したものと同じ内容がJSON形式で存在するはず)。

- [ ] **Step 8: テストを実行し成功を確認**

Run: `npm run test -- relics.test.ts`
Expected: PASS

- [ ] **Step 9: ビルド・型チェック**

Run: `npm run build`
Run: `npm run check`

型エラーが出た場合、`RelicId`型を直接参照している他のテストファイル(`shop.test.ts`・`engine.test.ts`等)に`juzu`/`senjafuda`/`soroban`のリテラルが残っていないか`grep`で確認し、あれば削除・置換する。

- [ ] **Step 10: コミット**

```bash
git add src/lib/game/shidasu/types.ts src/lib/game/shidasu/relics.ts src/lib/game/shidasu/params.ts src/lib/game/shidasu/shidasu.config.json src/lib/game/shidasu/relics.test.ts
git commit -m "feat: Wave終了時報酬レリック3件(数珠・千社札・算盤)を削除"
```

---

## Task 2: 護符3件(活気・瑞祝・市況)のparams定義を追加

**Files:**
- Modify: `src/lib/game/shidasu/types.ts` (`ItemId`型)
- Modify: `src/lib/game/shidasu/params.ts`
- Modify: `src/lib/game/shidasu/shidasu.config.json`
- Test: `src/lib/game/shidasu/params.test.ts`

- [ ] **Step 1: 失敗するテストを書く**

`params.test.ts`に追記(方向性1・2の「N護符がtalismansに定義されている」テストの隣に配置):

```ts
test('Wave終了時報酬護符3件(活気・瑞祝・市況)がtalismansに定義されている', () => {
  const ids = ['vigor', 'zuishuku', 'marketTrend'] as const
  for (const id of ids) {
    expect(DEFAULT_PARAMS.talismans[id]).toBeDefined()
    expect(typeof DEFAULT_PARAMS.talismans[id].name).toBe('string')
  }
})
```

- [ ] **Step 2: テストを実行し失敗を確認**

Run: `npm run test -- params.test.ts`
Expected: FAIL

- [ ] **Step 3: types.tsのItemIdユニオン型に3件追加**

`types.ts`の`ItemId`ユニオン型末尾(方向性2で追加した8件のさらに末尾、`| 'refund' | 'bonus' | 'commendation' | 'favor'`の直後)に追加:

```ts
  | 'vigor' | 'zuishuku' | 'marketTrend'
```

- [ ] **Step 4: params.tsのtalismans型定義に3件追加**

`params.ts`の`talismans`型定義末尾(`favor: { name: string; n: number; a: number; rarity: Rarity; desc: string }`の直後)に追加:

```ts
    vigor: { name: string; n: number; rarity: Rarity; desc: string }
    zuishuku: { name: string; n: number; rarity: Rarity; desc: string }
    marketTrend: { name: string; n: number; rarity: Rarity; desc: string }
```

- [ ] **Step 5: DEFAULT_PARAMS.talismansに3件のデフォルト値を追加**

`params.ts`の`DEFAULT_PARAMS.talismans`オブジェクト末尾(`favor: { name: '恩賞', n: 2, a: 1, rarity: 'R', desc: '...' },`の直後)に追加:

```ts
    vigor: { name: '活気', n: 2, rarity: 'U', desc: 'ウェーブ終了時、そのウェーブでの最大コンボ数に応じて星片に加算する(floor(最大コンボ数/5)×{n})' },
    zuishuku: { name: '瑞祝', n: 2, rarity: 'U', desc: 'ウェーブ終了時、そのウェーブで成立した役の種類数に応じて星片に加算する(floor(役の種類数/2)×{n})' },
    marketTrend: { name: '市況', n: 10, rarity: 'U', desc: 'ウェーブ終了時、山札の消費割合に応じて星片に加算する(floor(((c-b-a)/(c-b))×{n})、a=残り山札枚数,b=初期配布枚数,c=デッキ総枚数)' },
```

(元のレリック「数珠」「千社札」「算盤」の付喪化後の強化値をそのまま単一強度として採用: 活気n=2、瑞祝n=2、市況n=10。)

- [ ] **Step 6: shidasu.config.jsonに同内容を追加**

`shidasu.config.json`の`talismans`オブジェクトに、Step 5と全く同じキー・値をJSON形式で追加する。

- [ ] **Step 7: テストを実行し成功を確認**

Run: `npm run test -- params.test.ts`
Expected: PASS

- [ ] **Step 8: ビルド・型チェック**

Run: `npm run build`
Run: `npm run check`

- [ ] **Step 9: コミット**

```bash
git add src/lib/game/shidasu/types.ts src/lib/game/shidasu/params.ts src/lib/game/shidasu/shidasu.config.json src/lib/game/shidasu/params.test.ts
git commit -m "feat: Wave終了時報酬護符3件(活気・瑞祝・市況)のparams定義を追加"
```

---

## Task 3: ITEM_POOL・ITEM_GROUPS・ITEM_ACTUAL_EFFECTSへの登録

**Files:**
- Modify: `src/lib/game/shidasu/items.ts`
- Modify: `src/lib/game/shidasu/itemGroups.ts`
- Modify: `src/lib/game/shidasu/itemActualEffects.ts`
- Test: `src/lib/game/shidasu/itemGroups.test.ts`, `src/lib/game/shidasu/items.test.ts`

- [ ] **Step 1: 失敗するテストを追加**

`itemGroups.test.ts`に追記(方向性1・2の網羅性テストの隣に配置):

```ts
test('Wave終了時報酬護符3件(活気・瑞祝・市況)がITEM_POOL・ITEM_GROUPSの両方に含まれる', () => {
  const ids = ['vigor', 'zuishuku', 'marketTrend']
  const groupedIds = ITEM_GROUPS.flatMap(g => g.ids)
  for (const id of ids) {
    expect(ITEM_POOL).toContain(id)
    expect(groupedIds).toContain(id)
  }
})
```

`items.test.ts:42`の既存の件数アサーションを更新する(`ITEM_POOL`が130件→133件になる):

```ts
    expect(ITEM_POOL).toHaveLength(133)
```

テスト名に件数(`130種類の...`のような)が含まれている場合は、テスト名も`133種類の...`に更新すること。

- [ ] **Step 2: テストを実行し失敗を確認**

Run: `npm run test -- itemGroups.test.ts items.test.ts`
Expected: FAIL

- [ ] **Step 3: ITEM_POOLに3件追加**

`items.ts:45-46`(`'dividend', 'prizeMoney', 'windfall', 'celebration',`・`'refund', 'bonus', 'commendation', 'favor',`)の直後に追加:

```ts
  'vigor', 'zuishuku', 'marketTrend',
```

- [ ] **Step 4: ITEM_GROUPSに新規グループを追加**

`itemGroups.ts`の`ITEM_GROUPS`配列末尾(「グループ24: 星片獲得(方向性2)」の直後)に追加:

```ts
  { label: 'グループ25: Wave終了時報酬(レリックから移行)', ids: ['vigor', 'zuishuku', 'marketTrend'] },
```

- [ ] **Step 5: ITEM_ACTUAL_EFFECTSに3件追加**

`itemActualEffects.ts`の`ITEM_ACTUAL_EFFECTS`オブジェクト末尾(`favor: 'ウェーブ終了時、所持するfavorインスタンスごとに...',`の直後)に追加:

```ts
  // グループ25: Wave終了時報酬(レリックから移行)
  vigor: 'ウェーブ終了時、そのウェーブのwave.maxComboThisWaveに応じてfloor(maxComboThisWave/5)×nを星片に加算する',
  zuishuku: 'ウェーブ終了時、そのウェーブのwave.roleOccurrenceCountThisWaveから成立した役の種類数を数え、floor(役の種類数/2)×nを星片に加算する',
  marketTrend: 'ウェーブ終了時、山札消化率(a=wave.stock.length, b=wave.dealtRows×params.layout.cols, c=run.deckComposition中の現存枚数)からfloor(((c-b-a)/(c-b))×n)を星片に加算する(c-b<=0の場合は0)',
```

- [ ] **Step 6: テストを実行し成功を確認**

Run: `npm run test -- itemGroups.test.ts items.test.ts`
Expected: PASS

- [ ] **Step 7: ビルド・型チェック**

Run: `npm run build`
Run: `npm run check`

- [ ] **Step 8: コミット**

```bash
git add src/lib/game/shidasu/items.ts src/lib/game/shidasu/itemGroups.ts src/lib/game/shidasu/itemActualEffects.ts src/lib/game/shidasu/itemGroups.test.ts src/lib/game/shidasu/items.test.ts
git commit -m "feat: Wave終了時報酬護符3件をITEM_POOL/ITEM_GROUPS/ITEM_ACTUAL_EFFECTSへ登録"
```

---

## Task 4: resolveWaveEndへのトリガー実装(活気・瑞祝・市況)

**Files:**
- Modify: `src/lib/game/shidasu/engine.ts` (`resolveWaveEnd`)
- Test: `src/lib/game/shidasu/engine.test.ts`

- [ ] **Step 1: 失敗するテストを書く**

`engine.test.ts`に追記(「恩賞(favor)」describeブロックの直後に配置。`endedRun`ヘルパー・`waveTarget`・`beginRun`・`createRng`は既存importに含まれている前提):

```ts
describe('活気(vigor)', () => {
  test('ウェーブクリア時、そのウェーブの最大コンボ数に応じて星片が加算される', () => {
    const run = endedRun(
      { items: [{ instanceId: 1, id: 'vigor' }], currency: 0, nextInstanceId: 2 },
      waveTarget(DEFAULT_PARAMS, 0, 0, beginRun(DEFAULT_PARAMS, 1).stageStars),
    )
    const runWithCombo = { ...run, wave: { ...run.wave!, maxComboThisWave: 12 } }
    const runWithoutVigor = { ...runWithCombo, items: [] }
    const result = resolveWaveEnd(DEFAULT_PARAMS, runWithCombo, createRng(1))
    const resultWithoutVigor = resolveWaveEnd(DEFAULT_PARAMS, runWithoutVigor, createRng(1))
    // floor(12/5) = 2, * n(=2) = 4
    expect(result.currency - resultWithoutVigor.currency).toBe(Math.floor(12 / 5) * DEFAULT_PARAMS.talismans.vigor.n)
  })
})

describe('瑞祝(zuishuku)', () => {
  test('ウェーブクリア時、そのウェーブで成立した役の種類数に応じて星片が加算される', () => {
    const run = endedRun(
      { items: [{ instanceId: 1, id: 'zuishuku' }], currency: 0, nextInstanceId: 2 },
      waveTarget(DEFAULT_PARAMS, 0, 0, beginRun(DEFAULT_PARAMS, 1).stageStars),
    )
    const runWithRoles = { ...run, wave: { ...run.wave!, roleOccurrenceCountThisWave: { flush: 3, pair: 1, stair: 2 } } }
    const runWithoutZuishuku = { ...runWithRoles, items: [] }
    const result = resolveWaveEnd(DEFAULT_PARAMS, runWithRoles, createRng(1))
    const resultWithoutZuishuku = resolveWaveEnd(DEFAULT_PARAMS, runWithoutZuishuku, createRng(1))
    // 3種類, floor(3/2) = 1, * n(=2) = 2
    expect(result.currency - resultWithoutZuishuku.currency).toBe(Math.floor(3 / 2) * DEFAULT_PARAMS.talismans.zuishuku.n)
  })
})

describe('市況(marketTrend)', () => {
  test('ウェーブクリア時、山札消化率に応じて星片が加算される', () => {
    const base = beginRun(DEFAULT_PARAMS, 1)
    const deckComposition = new Array(52).fill(0).map((_, i) => ({ deckId: i, suit: '♠' as const, rank: 1 as const, wild: false, removed: false }))
    const run = endedRun(
      { items: [{ instanceId: 1, id: 'marketTrend' }], currency: 0, nextInstanceId: 2, deckComposition },
      waveTarget(DEFAULT_PARAMS, 0, 0, base.stageStars),
    )
    // b = dealtRows(5) * layout.cols(7) = 35, c = 52, a(stock残り) = 5
    const runWithStock = { ...run, wave: { ...run.wave!, dealtRows: 5, stock: new Array(5).fill(run.wave!.stock[0]) } }
    const runWithoutMarketTrend = { ...runWithStock, items: [] }
    const result = resolveWaveEnd(DEFAULT_PARAMS, runWithStock, createRng(1))
    const resultWithoutMarketTrend = resolveWaveEnd(DEFAULT_PARAMS, runWithoutMarketTrend, createRng(1))
    // ((52-35-5)/(52-35)) * 10 = (12/17)*10 = 7.05... -> floor = 7
    expect(result.currency - resultWithoutMarketTrend.currency).toBe(7)
  })

  test('山札消化率の分母が0以下なら加算されない', () => {
    const base = beginRun(DEFAULT_PARAMS, 1)
    const deckComposition = new Array(30).fill(0).map((_, i) => ({ deckId: i, suit: '♠' as const, rank: 1 as const, wild: false, removed: false }))
    const run = endedRun(
      { items: [{ instanceId: 1, id: 'marketTrend' }], currency: 0, nextInstanceId: 2, deckComposition },
      waveTarget(DEFAULT_PARAMS, 0, 0, base.stageStars),
    )
    // b = dealtRows(5) * layout.cols(7) = 35, c = 30 → denominator = c - b = -5 <= 0
    const runWithStock = { ...run, wave: { ...run.wave!, dealtRows: 5 } }
    const result = resolveWaveEnd(DEFAULT_PARAMS, runWithStock, createRng(1))
    const runWithoutMarketTrend = { ...runWithStock, items: [] }
    const resultWithoutMarketTrend = resolveWaveEnd(DEFAULT_PARAMS, runWithoutMarketTrend, createRng(1))
    expect(result.currency - resultWithoutMarketTrend.currency).toBe(0)
  })
})
```

**注記:** `runWithStock`のセットアップで`deckComposition`を30枚にすると`startWave`(`endedRun`内部で呼ばれる)がその範囲内でしか場札・山札を配れないため、`dealtRows`等の実際の配布結果がテストの想定と食い違う可能性がある。実装時に実際の`startWave`の挙動を確認し、必要であれば「分母が0以下になる」状況を人為的に作れる別の方法(例えば`endedRun`後に`wave`のフィールドを直接上書きして`dealtRows`や`deckComposition`の実効値を調整する)に置き換えてよい。テストの意図(山札消化率の分母が0以下のケースで安全に0を返す)さえ満たせば、具体的なテストコードの細部は実装時の状況に応じて調整してよい(方向性1・2のプランでも同様の裁量を認めている)。

- [ ] **Step 2: テストを実行し失敗を確認**

Run: `npm run test -- engine.test.ts -t "活気|瑞祝|市況"`
Expected: FAIL

- [ ] **Step 3: resolveWaveEndに活気・瑞祝・市況の判定を追加**

`resolveWaveEnd`関数内、恩賞(favor)の判定コード(`favorEarned`・`isStageClearing`・`itemsAfterFavor`を計算している箇所)の直後、`runWithCurrency`オブジェクト構築部より前に追加:

```ts
  // 活気: ウェーブクリア時、そのウェーブでの最大コンボ数に応じて星片にfloor(maxComboThisWave/5)×nを加算する。
  const vigorHeld = run.items.some(h => h.id === 'vigor')
  const vigorEarned = vigorHeld ? Math.floor(wave.maxComboThisWave / 5) * params.talismans.vigor.n : 0

  // 瑞祝: ウェーブクリア時、そのウェーブで成立した役の種類数に応じて星片にfloor(役の種類数/2)×nを加算する。
  const zuishukuHeld = run.items.some(h => h.id === 'zuishuku')
  const zuishukuRoleTypeCount = Object.values(wave.roleOccurrenceCountThisWave).filter(count => (count ?? 0) > 0).length
  const zuishukuEarned = zuishukuHeld ? Math.floor(zuishukuRoleTypeCount / 2) * params.talismans.zuishuku.n : 0

  // 市況: ウェーブクリア時、山札消化率に応じて星片にfloor(((c-b-a)/(c-b))×n)を加算する。
  // a=残り山札枚数, b=場札の初期配布枚数, c=デッキ総枚数(除外カードを除く)。分母が0以下なら0。
  const marketTrendHeld = run.items.some(h => h.id === 'marketTrend')
  const marketTrendEarned = (() => {
    if (!marketTrendHeld) return 0
    const a = wave.stock.length
    const b = wave.dealtRows * params.layout.cols
    const c = run.deckComposition.filter(card => !card.removed).length
    const denominator = c - b
    if (denominator <= 0) return 0
    return Math.floor(((c - b - a) / denominator) * params.talismans.marketTrend.n)
  })()
```

続けて`runWithCurrency`オブジェクト構築部を変更し、`currency`の計算式に3変数を合算する:

```ts
  const runWithCurrency = {
    ...run,
    currency: run.currency + earned + bonusEarned + commendationEarned + favorEarned + vigorEarned + zuishukuEarned + marketTrendEarned,
    items: itemsAfterFavor,
    rites: ritesAfterRefund,
    revelations: revelationsAfterRefund,
    oracles: oraclesAfterRefund,
    dedicationX: wave.dedicationX,
    diligenceX: wave.diligenceX,
    divineProtectionX: wave.divineProtectionX,
    discretionN: wave.discretionN,
    frostX: wave.frostX,
    echoX: wave.echoX,
    shootingStarN: wave.shootingStarN,
  }
```

(既存の`currency: run.currency + earned + bonusEarned + commendationEarned + favorEarned,`という行に`+ vigorEarned + zuishukuEarned + marketTrendEarned`を追記する形。`items`/`rites`/`revelations`/`oracles`は活気・瑞祝・市況のいずれも変更しないため、既存の`itemsAfterFavor`等をそのまま使う。)

- [ ] **Step 4: テストを実行し成功を確認**

Run: `npm run test -- engine.test.ts -t "活気|瑞祝|市況"`
Expected: PASS

- [ ] **Step 5: 全体テストスイート・ビルド・型チェック**

Run: `npm run test`
Run: `npm run build`
Run: `npm run check`

- [ ] **Step 6: コミット**

```bash
git add src/lib/game/shidasu/engine.ts src/lib/game/shidasu/engine.test.ts
git commit -m "feat: Wave終了時報酬護符3件(活気・瑞祝・市況)のトリガーをresolveWaveEndに実装"
```

---

## Task 5: 最終チェック — 統合確認とドキュメント更新

**Files:**
- Read: `src/lib/game/shidasu/engine.ts`
- Modify: `docs/shidasu/shidasu-reward-talismans-candidates.md`
- Modify: `docs/shidasu/done/shidasu-relic-candidates.md`

- [ ] **Step 1: レリック削除・護符追加が両方完了していることをチェックリストで確認**

| 項目 | 確認内容 |
|---|---|
| RelicId型 | `juzu`/`senjafuda`/`soroban`が存在しないこと |
| RELIC_POOL | 10件であること |
| relicWaveEndBonus | 関数自体が削除され、`engine.ts`の`resolveWaveEnd`から呼び出されていないこと(`earned = baseEarned`になっていること) |
| ItemId型 | `vigor`/`zuishuku`/`marketTrend`が存在すること |
| ITEM_POOL | 133件であること |
| resolveWaveEnd | 活気・瑞祝・市況の3件がcurrency加算に反映されていること |

実際にコードを読んで確認する。1件でも漏れがあれば報告し(新規実装は行わず)、BLOCKEDステータスとする。

- [ ] **Step 2: デバッグパネル・admin画面の反映確認**

`npm run dev`(バックグラウンド起動)。
1. `/admin/shidasu-relics`にアクセスし(またはAPIレスポンスで確認)、レリック一覧が10件になっていること、数珠・千社札・算盤が表示されないことを確認する。
2. `/admin/shidasu-talismans`にアクセスし、「グループ25: Wave終了時報酬(レリックから移行)」が表示され、活気・瑞祝・市況の3件が含まれることを確認する。
3. 確認後、開発サーバーを停止する。

- [ ] **Step 3: docs/shidasu/shidasu-reward-talismans-candidates.mdを更新**

冒頭の実装状況サマリー(「合計32件を実装完了」の行)を更新し、活気・瑞祝・市況の3件が追加されたこと、レリック(数珠・千社札・算盤)からの移行であることを明記する。「方向性非依存の効果候補」セクションの末尾、または新規セクションとして以下のような内容を追記する:

```markdown
### レリックからの移行(2026-08-27)

護符とレリックのすみわけを「レリック=Wave終了時報酬、護符=売値または即時報酬」に統一する方針に伴い、Wave終了時報酬を持っていたレリック3件(数珠・千社札・算盤)を削除し、同等の効果を護符として実装した。付喪化(2段階強度)の概念は護符には存在しないため、付喪化後の強化値を単一強度として採用した。

| 元のレリック名 | 新しい護符名 | ItemId | n | rarity |
|---|---|---|---|---|
| 数珠 | 活気 | `vigor` | 2 | U |
| 千社札 | 瑞祝 | `zuishuku` | 2 | U |
| 算盤 | 市況 | `marketTrend` | 10 | U |

詳細は`docs/superpowers/specs/2026-08-27-shidasu-relic-to-talisman-wave-end-bonus-migration-design.md`を参照。
```

- [ ] **Step 4: docs/shidasu/done/shidasu-relic-candidates.mdを更新**

`docs/shidasu/done/shidasu-relic-candidates.md`を読み、数珠・千社札・算盤の記載箇所を見つけて、削除され護符へ移行した旨を追記する(具体的な追記文言は、実際のファイル構成を確認した上でその文書のスタイルに合わせて記述すること)。

- [ ] **Step 5: 問題があれば修正、無ければ完了報告**

ビルドエラー・型エラーがあれば修正してから完了とする。Task 1〜4で実装したロジック自体に重大なバグが見つかった場合は、修正を試みず詳細を報告してBLOCKEDまたはDONE_WITH_CONCERNSステータスとすること。

- [ ] **Step 6: 最終コミット**

```bash
git add docs/shidasu/shidasu-reward-talismans-candidates.md docs/shidasu/done/shidasu-relic-candidates.md
git commit -m "docs: レリック3件から護符3件への移行内容をドキュメントに反映"
```

---

## 自己レビュー用メモ(実装完了後にplan作成者が確認する事項)

- **spec coverage:** 設計docの「変更内容」1〜4節全てがTask 1〜5でカバーされている。付喪化を捨て単一強度にする方針(Task 2 Step 5のコメント)、currency加算方式(Task 4)、ドキュメント更新(Task 5)いずれも反映済み。
- **placeholder scan:** 全タスクに具体的なコード・テストコードを記載済み。Task 4 Step 1の「市況」テストのみ、`startWave`の実際の挙動次第でテストセットアップの微調整が必要になる可能性を明記しているが、これは方向性1・2のプランでも採用された裁量の許容であり、実装すべき内容自体は明確(山札消化率の分母が0以下のケースを検証する)。
- **type consistency:** `HeldItem`の既存フィールド(`instanceId`/`id`/`sellBonus`/`randomTarget`/`rewardBonus`)は今回変更しない。`params.talismans.vigor/zuishuku/marketTrend`のフィールド名(`n`)は全タスクで一貫させている。`relicWaveEndBonus`関数はYAGNI原則に従い完全に削除し、`resolveWaveEnd`側の呼び出し箇所(`engine.ts:1047`、`const earned = baseEarned + relicWaveEndBonus(...)`)も`const earned = baseEarned`に書き換える(Task 1 Step 5で対応、Task 5 Step 1のチェックリストでも確認)。
