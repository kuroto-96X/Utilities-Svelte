# 護符「暗雲」・天啓「虚」削除 Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** 護符「暗雲」(`darkClouds`)と天啓「虚」(`kyo`)を削除する。どちらも`extraTableauRows`(場札の配布行数増加)のみを効果とする単機能アイテムで機能重複しているため。

**Architecture:** 型定義・データ・実装ロジック・テスト・監査用ドキュメントの5層それぞれから該当IDへの参照を除去する、既存パターンに沿った機械的な削除。新規効果の割り当ては行わない(単純削除のみ)。

**Tech Stack:** SvelteKit, TypeScript, Vitest

---

## File Structure

- `src/lib/game/shidasu/types.ts` — `ItemId`/`RevelationId`ユニオン型から該当リテラルを除去
- `src/lib/game/shidasu/items.ts` — `ITEM_POOL`から`darkClouds`を除去
- `src/lib/game/shidasu/itemGroups.ts` — グループ13の一覧から`darkClouds`を除去
- `src/lib/game/shidasu/itemActualEffects.ts` — `darkClouds`の監査用エントリを削除
- `src/lib/game/shidasu/revelations.ts` — `REVELATION_POOL`から`kyo`を除去
- `src/lib/game/shidasu/revelationActualEffects.ts` — `kyo`の監査用エントリを削除
- `src/lib/game/shidasu/params.ts` — `talismans.darkClouds`・`revelations.kyo`の型定義・`DEFAULT_PARAMS`エントリを削除
- `src/lib/game/shidasu/shidasu.config.json` — 対応するJSON側のエントリを削除
- `src/lib/game/shidasu/revelationEffects.ts` — `canUseRevelation`・`applyRevelationEffect`の`case 'kyo':`、および使われなくなる`expandTableauRows`関数を削除
- `src/lib/game/shidasu/engine.ts` — `startWave`の`rows`計算式、および`extraTableauRows`計算3箇所を簡略化
- `src/lib/game/shidasu/engine.test.ts` — 暗雲関連テストを削除・調整
- `src/lib/game/shidasu/items.test.ts` — 件数アサーションを更新
- `src/lib/game/shidasu/revelationEffects.test.ts` — 虚関連テストを削除
- `docs/shidasu/shidasu-roadmap.md` — 件数記述の修正、完了済み履歴への追記
- `docs/shidasu/shidasu-current-rules.md` — 件数記述の修正

---

### Task 1: 護符「暗雲」を削除する

**Files:**
- Modify: `src/lib/game/shidasu/types.ts:57`
- Modify: `src/lib/game/shidasu/items.ts:27`
- Modify: `src/lib/game/shidasu/itemGroups.ts:23`
- Modify: `src/lib/game/shidasu/itemActualEffects.ts:108`
- Modify: `src/lib/game/shidasu/params.ts:145`, `params.ts:414`
- Modify: `src/lib/game/shidasu/shidasu.config.json`(`darkClouds`エントリ、`"talismans"`ブロック内)
- Modify: `src/lib/game/shidasu/engine.ts:152`
- Test: `src/lib/game/shidasu/engine.test.ts`(731-745行目付近、2448行目付近、4242-4251行目付近)
- Test: `src/lib/game/shidasu/items.test.ts:41-59`

- [ ] **Step 1: 既存テストを確認し、削除・調整対象を洗い出す**

`src/lib/game/shidasu/engine.test.ts`で`darkClouds`を検索し、以下3件のテストを確認する:

1. 「暗雲の護符所持時: 配布行数が増えていても、その行数分を1コンボで空にすれば列一掃ボーナスが成立する(バグ回帰テスト)」(731行目付近):
```ts
  test('暗雲の護符所持時: 配布行数が増えていても、その行数分を1コンボで空にすれば列一掃ボーナスが成立する(バグ回帰テスト)', () => {
    const items: ItemId[] = ['darkClouds']
    const dealtRows = DEFAULT_PARAMS.layout.rows + DEFAULT_PARAMS.talismans.darkClouds.r
    const wave = baseWave({
      tableau: [[card(1, '♣', 6)], [card(2, '♦', 9)]],
      comboStreakColumnLengths: [dealtRows, 1],
      dealtRows,
    })
    const { wave: next } = playCard(DEFAULT_PARAMS, wave, 'none', items, 1000000, 0, standardDeckComposition())
    expect(next.columnsEmptiedThisCombo).toBe(1)
    expect(next.lastGain?.parts.map(p => p.text)).toContain(`列一掃+${scoring.columnSweepBonus}`)
  })
```

2. `DEFAULT_PARAMS.talismans.darkClouds.r`を検証する1行(2448行目付近、周辺は他の護符のパラメータ値を並べて検証している大きな1つの`test`ブロック)。

3. 「暗雲: ウェーブ開始時、場札がrows+r枚配られる」と「暗雲を持たなければ通常通りrows枚」の2件(4242-4251行目付近):
```ts
  test('暗雲: ウェーブ開始時、場札がrows+r枚配られる', () => {
    const { wave } = startWave(DEFAULT_PARAMS, 0, 0, ['darkClouds'], standardDeckComposition(), 1)
    const expectedRows = DEFAULT_PARAMS.layout.rows + DEFAULT_PARAMS.talismans.darkClouds.r
    wave.tableau.forEach(col => expect(col).toHaveLength(expectedRows))
  })

  test('暗雲を持たなければ通常通りrows枚', () => {
    const { wave } = startWave(DEFAULT_PARAMS, 0, 0, [], standardDeckComposition(), 1)
    wave.tableau.forEach(col => expect(col).toHaveLength(DEFAULT_PARAMS.layout.rows))
  })
```

`engine.test.ts`内で`startWave`が護符無しで呼ばれ、配布行数が`params.layout.rows`と一致することを検証している**他のテスト**が存在するか検索する(例: `describe('startWave'`ブロック内の基本ケース)。

- [ ] **Step 2: `types.ts`から`darkClouds`を除去**

`src/lib/game/shidasu/types.ts:57`の`ItemId`ユニオン型定義:

```ts
  | 'promise' | 'darkClouds' | 'regeneration'
```

を以下に置き換える:

```ts
  | 'promise' | 'regeneration'
```

- [ ] **Step 3: `items.ts`の`ITEM_POOL`から除去**

`src/lib/game/shidasu/items.ts:27`付近、`ITEM_POOL`配列内の

```ts
  'promise', 'darkClouds', 'regeneration',
```

を以下に置き換える:

```ts
  'promise', 'regeneration',
```

- [ ] **Step 4: `itemGroups.ts`のグループ13から除去**

`src/lib/game/shidasu/itemGroups.ts:23`:

```ts
  { label: 'グループ13: 資源操作(残り)', ids: ['promise', 'darkClouds', 'regeneration'] },
```

を以下に置き換える:

```ts
  { label: 'グループ13: 資源操作(残り)', ids: ['promise', 'regeneration'] },
```

- [ ] **Step 5: `itemActualEffects.ts`のエントリを削除**

`src/lib/game/shidasu/itemActualEffects.ts:108`の

```ts
  darkClouds: 'ウェーブ開始時、場札の配布行数をrows+rにする(列数は不変)',
```

の行を削除する。

- [ ] **Step 6: `params.ts`の型定義・DEFAULT_PARAMSから削除**

`src/lib/game/shidasu/params.ts:145`の

```ts
    darkClouds: { name: string; r: number; rarity: Rarity; desc: string }
```

の行を削除する。

`src/lib/game/shidasu/params.ts:414`の

```ts
    darkClouds: { name: '暗雲', r: 1, rarity: 'U', desc: 'ウェーブ開始時、場札が{r}行多く配られる' },
```

の行を削除する。

- [ ] **Step 7: `shidasu.config.json`から削除**

`src/lib/game/shidasu/shidasu.config.json`内、`"talismans"`ブロック内の`"darkClouds"`エントリ(前後に`{ "name": "暗雲", "r": 1, "rarity": "U", "desc": "..." }`という内容を持つJSONオブジェクト)を削除する。前後のカンマの整合性に注意する。

- [ ] **Step 8: `engine.ts`の`startWave`内`rows`計算を簡略化**

`src/lib/game/shidasu/engine.ts:152`の

```ts
  const rows = params.layout.rows + (items.includes('darkClouds') ? params.talismans.darkClouds.r : 0) + extraTableauRows
```

を以下に置き換える:

```ts
  const rows = params.layout.rows + extraTableauRows
```

- [ ] **Step 9: 型チェック**

Run: `npm run check`
Expected: `darkClouds`を参照している残存箇所(テストファイル含む)がエラーとして検出される。次のステップで解消する。

- [ ] **Step 10: `engine.test.ts`のテストを削除・調整**

Step 1で確認した3箇所を以下の通り処理する:

1. 「暗雲の護符所持時: ...(バグ回帰テスト)」テスト全体を削除する。

2. `DEFAULT_PARAMS.talismans.darkClouds.r`を検証している1行を削除する(周囲の他のexpect文はそのまま残す)。

3. 「暗雲: ウェーブ開始時、場札がrows+r枚配られる」テストを削除する。「暗雲を持たなければ通常通りrows枚」テストは、Step 1で確認した「他のテストで同等のbaseline(護符無しでの配布行数=`params.layout.rows`)が検証されているか」に応じて次のいずれかを行う:
   - 既に他のテストでカバーされていれば、このテストも削除する。
   - カバーされていなければ、テスト名を「護符無しなら通常通りrows枚」に変更し、内容はそのまま残す:
```ts
  test('護符無しなら通常通りrows枚', () => {
    const { wave } = startWave(DEFAULT_PARAMS, 0, 0, [], standardDeckComposition(), 1)
    wave.tableau.forEach(col => expect(col).toHaveLength(DEFAULT_PARAMS.layout.rows))
  })
```

- [ ] **Step 11: `items.test.ts`の件数アサーションを更新**

`src/lib/game/shidasu/items.test.ts:41-45`の

```ts
  test('99種類のアイテムが定義されている', () => {
    expect(ITEM_POOL).toHaveLength(99)
    expect(new Set(ITEM_POOL).size).toBe(99) // 重複なし
    ITEM_POOL.forEach(id => expect(itemName(id, DEFAULT_PARAMS)).toBeTruthy())
  })
```

を以下に置き換える:

```ts
  test('98種類のアイテムが定義されている', () => {
    expect(ITEM_POOL).toHaveLength(98)
    expect(new Set(ITEM_POOL).size).toBe(98) // 重複なし
    ITEM_POOL.forEach(id => expect(itemName(id, DEFAULT_PARAMS)).toBeTruthy())
  })
```

`src/lib/game/shidasu/items.test.ts:47-58`付近の

```ts
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
```

を以下に置き換える:

```ts
  test('グループ9〜16の残り19個も名前と説明文を持つ', () => {
    const newIds: ItemId[] = [
      'gentleBreeze', 'resonance',
      'azureSky', 'amber',
      'composure', 'clarity', 'arrogance', 'echo', 'shootingStar',
      'naive', 'intuition', 'sincerity',
      'promise', 'regeneration',
      'benevolence', 'healing',
      'guidance',
      'passion', 'fightingSpirit',
    ]
    expect(newIds).toHaveLength(19)
```

- [ ] **Step 12: テストを実行して成功を確認**

Run: `npm run test -- items.test.ts engine.test.ts`
Expected: PASS

- [ ] **Step 13: 型チェック**

Run: `npm run check`
Expected: PASS(shidasu関連のエラーが解消していること)

- [ ] **Step 14: コミット**

```bash
git add src/lib/game/shidasu/types.ts src/lib/game/shidasu/items.ts src/lib/game/shidasu/itemGroups.ts src/lib/game/shidasu/itemActualEffects.ts src/lib/game/shidasu/params.ts src/lib/game/shidasu/shidasu.config.json src/lib/game/shidasu/engine.ts src/lib/game/shidasu/engine.test.ts src/lib/game/shidasu/items.test.ts
git commit -m "feat: 護符「暗雲」を削除(天啓「虚」と機能重複のため)"
```

---

### Task 2: 天啓「虚」を削除する

**Files:**
- Modify: `src/lib/game/shidasu/types.ts:93`
- Modify: `src/lib/game/shidasu/revelations.ts:11`
- Modify: `src/lib/game/shidasu/revelationActualEffects.ts:17`
- Modify: `src/lib/game/shidasu/params.ts:210`, `params.ts:479`
- Modify: `src/lib/game/shidasu/shidasu.config.json`(`kyo`エントリ、`"revelations"`ブロック内)
- Modify: `src/lib/game/shidasu/revelationEffects.ts`(`canUseRevelation`・`applyRevelationEffect`の`case 'kyo':`、`expandTableauRows`関数)
- Modify: `src/lib/game/shidasu/engine.ts`(3箇所)
- Test: `src/lib/game/shidasu/revelationEffects.test.ts`(127-154行目付近、430行目付近)

- [ ] **Step 1: `types.ts`から`kyo`を除去**

`src/lib/game/shidasu/types.ts:93`の`RevelationId`ユニオン型定義内、

```ts
  | 'kyo'
```

の行を削除する(前後の`|`区切り記法を保つため、直前・直後の行と自然につながるようにする。実際のファイル内容を確認して調整すること)。

- [ ] **Step 2: `revelations.ts`の`REVELATION_POOL`から除去**

`src/lib/game/shidasu/revelations.ts:11`付近、`REVELATION_POOL`配列内の

```ts
  'kyo',
```

の行を削除する。

- [ ] **Step 3: `revelationActualEffects.ts`のエントリを削除**

`src/lib/game/shidasu/revelationActualEffects.ts:17`の

```ts
  kyo: '山札の上からn行(列数×n枚)を各列の末尾に配る(deckCompositionは変更せず、山札の並べ替えのみ)。使用条件(canUseRevelation)は山札が列数×n枚以上であること。engine.ts側でrun.extraTableauRowsにもnを恒久的に加算し、以後のウェーブ開始時の配布行数(startWave)にも反映する',
```

の行を削除する。

- [ ] **Step 4: `params.ts`の型定義・DEFAULT_PARAMSから削除**

`src/lib/game/shidasu/params.ts:210`の

```ts
    kyo: { name: string; n: number; desc: string }
```

の行を削除する。

`src/lib/game/shidasu/params.ts:479`の

```ts
    kyo: { name: '虚', n: 1, desc: '場札に{n}行追加する(山札の上から配る)。以後のウェーブ開始時の配布行数も恒久的に{n}増える' },
```

の行を削除する。

- [ ] **Step 5: `shidasu.config.json`から削除**

`src/lib/game/shidasu/shidasu.config.json`内、`"revelations"`ブロック内の`"kyo"`エントリを削除する。前後のカンマの整合性に注意する。

- [ ] **Step 6: `revelationEffects.ts`から`kyo`のケースと`expandTableauRows`を削除**

`src/lib/game/shidasu/revelationEffects.ts:219-227`の`canUseRevelation`関数:

```ts
export function canUseRevelation(params: ShidasuParams, wave: WaveState, revelationId: RevelationId): boolean {
  switch (revelationId) {
    case 'kyo':
      return wave.stock.length >= wave.tableau.length * params.revelations.kyo.n
    default:
      return true
  }
}
```

を以下に置き換える:

```ts
export function canUseRevelation(_params: ShidasuParams, _wave: WaveState, _revelationId: RevelationId): boolean {
  return true
}
```

`applyRevelationEffect`関数内、278-279行目付近の

```ts
    case 'kyo':
      return { wave: expandTableauRows(wave, params.revelations.kyo.n), deckComposition }
```

の2行を削除する。

`expandTableauRows`関数(43-54行目付近、`kyo`のケース以外から呼ばれていないことをStep 1で確認済み)を関数定義ごと削除する:

```ts
// 山札の上からn行(列数×n枚)を各列の末尾に1枚ずつ配る(フェフ秘儀のn行版)。deckCompositionは変更しない
// (山札の中身を並べ替えるだけのため)。
function expandTableauRows(wave: WaveState, n: number): WaveState {
  ...
}
```

(この関数の正確な行範囲は実際のファイルを確認して特定すること。関数末尾の閉じ括弧までを削除する。)

- [ ] **Step 7: `engine.ts`の`extraTableauRows`計算3箇所を簡略化**

`src/lib/game/shidasu/engine.ts`内、以下の同一パターンが3箇所存在する(`buyIndividualRevelationUse`・`pickPackRevelationUse`・秘儀天啓神託使用本体の各関数内):

```ts
  const extraTableauRows = revelationId === 'kyo' ? run.extraTableauRows + params.revelations.kyo.n : run.extraTableauRows
```

3箇所とも以下に置き換える:

```ts
  const extraTableauRows = run.extraTableauRows
```

`Grep`で`revelationId === 'kyo'`を検索し、3箇所すべてを機械的に置き換えること。

- [ ] **Step 8: 型チェック**

Run: `npm run check`
Expected: `kyo`を参照している残存箇所(テストファイル含む)がエラーとして検出される。次のステップで解消する。

- [ ] **Step 9: `revelationEffects.test.ts`のテストを削除**

`src/lib/game/shidasu/revelationEffects.test.ts:127-141`の

```ts
  test('虚: 山札の上からn行(列数×n枚)を各列の末尾に配る', () => {
    const wave = baseWave({
      tableau: [[card(1, '♠', 1)], [card(2, '♠', 2)]],
      stock: [card(10, '♦', 9), card(11, '♦', 8), card(12, '♦', 7), card(13, '♦', 6)],
    })
    const deckComposition: DeckCard[] = []
    const result = applyRevelationEffect(DEFAULT_PARAMS, wave, deckComposition, 'kyo', null, createRng(1))
    // n=1(既定)、列数2なので2枚配られ、山札は2枚残る
    expect(result.wave.tableau[0]).toHaveLength(2)
    expect(result.wave.tableau[1]).toHaveLength(2)
    expect(result.wave.stock).toHaveLength(2)
    // 山札の一番上(末尾)から順に配られる
    expect(result.wave.tableau[0][1]).toEqual(card(13, '♦', 6))
    expect(result.wave.tableau[1][1]).toEqual(card(12, '♦', 7))
  })
```

と、続く143-154行目の

```ts
  test('虚: 使用条件は山札が(列数×n)枚以上であること', () => {
    const wave = baseWave({
      tableau: [[card(1, '♠', 1)], [card(2, '♠', 2)]],
      stock: [card(10, '♦', 9)],
    })
    expect(canUseRevelation(DEFAULT_PARAMS, wave, 'kyo')).toBe(false)
    const wave2 = baseWave({
      tableau: [[card(1, '♠', 1)], [card(2, '♠', 2)]],
      stock: [card(10, '♦', 9), card(11, '♦', 8)],
    })
    expect(canUseRevelation(DEFAULT_PARAMS, wave2, 'kyo')).toBe(true)
  })
```

の2件のテストを削除する。

`src/lib/game/shidasu/revelationEffects.test.ts:422-431`付近の`revelationNeedsTarget`一覧検証テスト:

```ts
  test('revelationNeedsTarget: 列選択が必要な種類とそうでない種類を正しく区別する', () => {
    expect(revelationNeedsTarget('kaku')).toBe(true)
    expect(revelationNeedsTarget('gyu')).toBe(true)
    expect(revelationNeedsTarget('jo')).toBe(true)
    expect(revelationNeedsTarget('aya')).toBe(true)
    expect(revelationNeedsTarget('shitsu')).toBe(true)
    expect(revelationNeedsTarget('hitsu')).toBe(true)
    expect(revelationNeedsTarget('shin')).toBe(false)
    expect(revelationNeedsTarget('kyo')).toBe(false)
  })
```

内の`expect(revelationNeedsTarget('kyo')).toBe(false)`の1行のみを削除する(テスト自体は残す)。

- [ ] **Step 10: `canUseRevelation`のテストがあれば確認・削除**

`src/lib/game/shidasu/revelationEffects.test.ts`内で`describe('canUseRevelation'`を検索し、`kyo`以外の天啓についても`canUseRevelation`の挙動を検証しているテストがあるか確認する。Step 6で`canUseRevelation`は常に`true`を返す関数に簡略化したため、`kyo`以外のケースを検証していたテストが無ければ影響はない。もし`kyo`のケースのみを前提にしたテスト構造(例: `describe`ブロックが`kyo`専用になっている等)があれば、Step 9で削除した2テストと合わせて整理する。

- [ ] **Step 11: テストを実行して成功を確認**

Run: `npm run test -- revelationEffects.test.ts`
Expected: PASS

- [ ] **Step 12: 型チェック**

Run: `npm run check`
Expected: PASS(shidasu関連のエラーが解消していること)

- [ ] **Step 13: 全体テスト実行**

Run: `npm run test`
Expected: PASS(全テストグリーン)

- [ ] **Step 14: コミット**

```bash
git add src/lib/game/shidasu/types.ts src/lib/game/shidasu/revelations.ts src/lib/game/shidasu/revelationActualEffects.ts src/lib/game/shidasu/params.ts src/lib/game/shidasu/shidasu.config.json src/lib/game/shidasu/revelationEffects.ts src/lib/game/shidasu/engine.ts src/lib/game/shidasu/revelationEffects.test.ts
git commit -m "feat: 天啓「虚」を削除(護符「暗雲」と機能重複のため)"
```

---

### Task 3: ドキュメント更新と最終確認

**Files:**
- Modify: `docs/shidasu/shidasu-roadmap.md`
- Modify: `docs/shidasu/shidasu-current-rules.md`

- [ ] **Step 1: `shidasu-roadmap.md`項目1の件数記述を修正**

`docs/shidasu/shidasu-roadmap.md`の項目1「護符の効果の検討」内、

```
   合計で１５０枚になるようにする(現状100枚、残り50枚を新規検討)。
```

を以下に置き換える:

```
   合計で１５０枚になるようにする(現状98枚、残り52枚を新規検討)。
```

- [ ] **Step 2: `shidasu-roadmap.md`項目2の件数記述を修正**

項目2「天啓の追加の検討」内、

```
   モチーフの二十八宿は28宿中27宿が実装済み(Phase A: カード変換・場札操作系8個、Phase B: 即時報酬獲得系7個を追加実装完了)。残り1宿(鬼)は`mansions.ts`に温存済み。新規天啓の効果候補24個を洗い出し、2026-08-09に1つずつ採用・不採用・修正を判断済み(詳細は`docs/shidasu/done/shidasu-revelation-candidates.md`を参照)。
```

を以下に置き換える:

```
   モチーフの二十八宿は28宿中26宿が実装済み(Phase A: カード変換・場札操作系8個、Phase B: 即時報酬獲得系7個を追加実装完了。うち1宿(虚)は後日、護符「暗雲」との機能重複により削除)。残り2宿(鬼・虚)は`mansions.ts`に温存済み。新規天啓の効果候補24個を洗い出し、2026-08-09に1つずつ採用・不採用・修正を判断済み(詳細は`docs/shidasu/done/shidasu-revelation-candidates.md`を参照)。
```

- [ ] **Step 3: `shidasu-roadmap.md`項目5の記述を更新**

項目5「レリックの追加の検討」内、`docs/shidasu/shidasu-roadmap.md`の実際の現在の内容を確認したうえで、以下2点を反映する:

1. 「今後の検討課題」の中に、暗雲・虚の削除が完了し独楽のレリック化検討が再開可能になった旨を追記する。既存の項目(付喪化トリガー天啓の実装、報酬系レリックの反転条件検討、オファー拡張の候補メモ)と並列する形の箇条書きとして追加する。

2. 項目3への相互参照の中に「項目5「レリックの実装」」という旧タイトルの記述が残っていないか確認し、残っていれば「項目5「レリックの追加の検討」」に訂正する(`Grep`で`項目5「レリックの実装」`を検索して特定すること)。

- [ ] **Step 4: `shidasu-roadmap.md`の完了済み履歴に新規エントリを追加**

`docs/shidasu/shidasu-roadmap.md`の「完了済み(履歴)」セクション末尾に以下を追加する:

```
- **護符「暗雲」・天啓「虚」の削除**: レリック候補検討(2026-08-12)で、レリック候補「独楽」(Wave開始時、場札に配る行数を+nする)が既存の護符「暗雲」・天啓「虚」と同じ`extraTableauRows`の仕組みを使っており機能重複することが判明し、保留していた。2026-08-13、`extraTableauRows`のみを効果とする単機能アイテムであるこの2つを削除した(新規効果の割り当ては行わず単純削除)。護符は98種、天啓は28宿中26宿に更新。独楽のレリック化検討は別セッションで再開する。
```

- [ ] **Step 5: `shidasu-current-rules.md`の件数記述を修正**

`docs/shidasu/shidasu-current-rules.md`の7.1護符セクション内、

```
- 自由命名。現在**99種**実装済み(`ITEM_POOL`)。抽選はレアリティを考慮しない完全均等抽選。
```

を以下に置き換える:

```
- 自由命名。現在**98種**実装済み(`ITEM_POOL`)。抽選はレアリティを考慮しない完全均等抽選。
```

7.3天啓セクション内、

```
- モチーフは二十八宿。全28宿中**27宿**が効果実装済み(`REVELATION_POOL`)。残り1宿(鬼)は`mansions.ts`に見た目候補として温存されている(未定)。
```

を以下に置き換える:

```
- モチーフは二十八宿。全28宿中**26宿**が効果実装済み(`REVELATION_POOL`)。残り2宿(鬼・虚)は`mansions.ts`に見た目候補として温存されている(未定)。
```

- [ ] **Step 6: 全体ビルド・型チェック・テストの最終確認**

Run: `npm run build`
Expected: PASS

Run: `npm run check`
Expected: PASS

Run: `npm run test`
Expected: PASS(全テストグリーン)

- [ ] **Step 7: 開発サーバーでの目視確認**

Run: `npm run dev`

`http://localhost:5173/game/shidasu`でラン開始からショップ突入まで数回プレイし、以下を確認する:
- 護符の福袋・バラ売りに「暗雲」が一切出現しない
- 天啓の福袋・バラ売りに「虚」が一切出現しない
- `/admin/shidasu-talismans`・`/admin/shidasu-revelations`の一覧に暗雲・虚の行が存在しない

確認後、開発サーバーのプロセスを終了すること。

- [ ] **Step 8: コミット**

```bash
git add docs/shidasu/shidasu-roadmap.md docs/shidasu/shidasu-current-rules.md
git commit -m "docs: 護符「暗雲」・天啓「虚」削除をroadmap・現行ルールへ反映"
```

---

## Self-Review メモ(執筆時点で実施済み)

- **spec網羅性:** specの「変更内容」節にある全項目(暗雲削除の8箇所、虚削除の8箇所、ドキュメント更新6箇所)がTask1〜3のいずれかに対応していることを確認した。specの「テスト」節(build/check/test実行、目視確認)はTask3 Step6-7に対応。
- **プレースホルダー無し確認:** 全ステップに実コード・実コマンドを記載した。ただしTask1 Step10・Task2 Step10は「他のテストでカバーされているか確認したうえで判断する」という手順を含む(既存のテストファイルを実際に読んで判断する必要がある箇所であり、プレースホルダーではなく実装者への具体的な確認手順)。
- **型の一貫性:** `darkClouds`/`kyo`という同一のID文字列をTask1・Task2それぞれの全ステップで一貫して使用。`extraTableauRows`という変数名もspec・plan全体で統一。
- **依存関係:** Task1(暗雲)とTask2(虚)は完全に独立したファイル群を触るため、どちらを先に実施しても問題ない。Task3(ドキュメント)はTask1・Task2の完了後(件数が確定してから)実施する。
