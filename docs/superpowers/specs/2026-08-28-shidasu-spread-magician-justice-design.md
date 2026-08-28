# 新規スプレッド「魔術師」・「正義」実装設計

## 背景・目的

`docs/shidasu/shidasu-spread-candidates.md`の「具体的なルール候補一覧」の候補B(「護符の所持スロット+N、場札-N行(初期値N=1)」)・候補C(「初期デッキからJQK(11・12・13)を除外してスタート」)を、それぞれ新規スプレッド「魔術師」(`magician`)・「正義」(`justice`)として実装する。既存の`fool`(愚者)・`moon`(月)・`pope`(教皇)・`empress`(女帝)に続く5・6種類目のスプレッドになる。

## 変更内容

### 1. `SpreadId`型に`'magician'`・`'justice'`を追加

対象: `src/lib/game/shidasu/types.ts`

```ts
export type SpreadId = 'fool' | 'moon' | 'pope' | 'empress' | 'magician' | 'justice'
```

コメントにも各スプレッドの効果概要を追記する。

### 2. `SpreadConfig`型に2フィールドを追加

対象: `src/lib/game/shidasu/types.ts`

```ts
export interface SpreadConfig {
  // (既存フィールドは変更なし)
  // 護符の所持上限(itemMaxCapacity)へのオフセット(既定0)。
  initialItemCapacityBonus: number
  // 初期デッキ生成時に除外するランクの一覧(既定は空配列=除外なし)。
  excludedRanks: Rank[]
}
```

### 3. 魔術師: `itemMaxCapacity`(`relics.ts`)にスプレッドボーナスを反映

対象: `src/lib/game/shidasu/relics.ts`

```ts
export function itemMaxCapacity(params: ShidasuParams, run: RunState): number {
  const r = params.relics.manekiHoteizo
  const spreadBonus = params.spreads[run.spreadId].initialItemCapacityBonus
  return params.items.maxItems + spreadBonus + relicBonus(run, 'manekiHoteizo', r.n, r.tsukumokaN)
}
```

`itemMaxCapacity`は既に`params`・`run`の両方を受け取っているため、呼び出し元(`engine.ts`内3箇所)のシグネチャ変更は不要。

### 4. 正義: `beginRun`(`engine.ts`)で`excludedRanks`を初期デッキに反映

対象: `src/lib/game/shidasu/engine.ts`

`beginRun`内で、`spreadConfig.excludedRanks`に含まれるランクのカードを`deckComposition`から`removed: true`にする処理を追加し、戻り値の`deckComposition`をこの結果で上書きする。

```ts
export function beginRun(params: ShidasuParams, seed?: number, spreadId: SpreadId = 'fool'): RunState {
  const spreadConfig = params.spreads[spreadId]
  const initialExtraTableauRows = spreadConfig.initialExtraTableauRows
  const rand = createRng(seed ?? Math.floor(Math.random() * 999999) + 1)
  const initialStageStars = rollStageStars(params, rand)
  const oracleLevels = oracleLevelsWithUniformValue(spreadConfig.initialOracleLevel)
  const initialRun = createInitialRun()
  const deckComposition = spreadConfig.excludedRanks.length === 0
    ? initialRun.deckComposition
    : initialRun.deckComposition.map(c =>
        spreadConfig.excludedRanks.includes(c.rank) ? { ...c, removed: true } : c
      )
  return {
    ...initialRun,
    phase: 'shop',
    extraTableauRows: initialExtraTableauRows,
    spreadId,
    stageStars: initialStageStars,
    currency: params.currency.initialAmount + spreadConfig.initialCurrencyBonus,
    oracleLevels,
    deckComposition,
  }
}
```

### 5. `DEFAULT_PARAMS.spreads`・`shidasu.config.json`への追記

- 既存4スプレッド(fool/moon/pope/empress)に`initialItemCapacityBonus: 0`・`excludedRanks: []`を追加
- 新規`magician`: `initialExtraTableauRows: -1`(場札-1行)、`initialItemCapacityBonus: 1`(護符+1)、他は`fool`と同じ
- 新規`justice`: `excludedRanks: [11, 12, 13]`(J・Q・K除外)、他は`fool`と同じ

### 6. `SPREAD_IDS`に`'magician'`・`'justice'`を追記

対象: `src/lib/game/shidasu/params.ts`

### 7. `/admin/shidasu-spreads`のUI拡張

対象: `src/routes/admin/shidasu-spreads/+page.svelte`

- 「初期所持金オフセット」列の右に「護符所持スロットオフセット」列(`number`入力)を追加
- 「ショップ非販売種別」列の右に「除外ランク」列(A・2〜10・J・Q・Kの13個のチェックボックス)を追加。既存の`bannedShopKinds`用チェックボックス(`toggleBannedShopKind`)と同型の`toggleExcludedRank`ヘルパーを新設する
- `hasValidationError`には`excludedRanks`はチェックボックスUIのため追加バリデーション不要(既存の`bannedShopKinds`と同じ扱い)。`initialItemCapacityBonus`には`Number.isFinite`チェックを追加する

## テスト方針

- `src/lib/game/shidasu/params.test.ts`: `magician`の`initialItemCapacityBonus`が`1`・`initialExtraTableauRows`が`-1`であること、`justice`の`excludedRanks`が`[11, 12, 13]`であること、他4スプレッド(fool/moon/pope/empress)の`initialItemCapacityBonus`が`0`・`excludedRanks`が`[]`であることを確認するテストを追加する
- `src/lib/game/shidasu/relics.test.ts`: `itemMaxCapacity(params, run)`が`run.spreadId`に応じてボーナスを反映することを確認する(`spreadId: 'magician'`のrunで`params.items.maxItems + 1`になること、`spreadId: 'fool'`では`params.items.maxItems`のままであること)
- `src/lib/game/shidasu/engine.test.ts`: `beginRun(params, seed, 'justice')`のとき、返された`run.deckComposition`のうちランク11・12・13の全カードが`removed: true`になっていること、それ以外のランクは`removed: false`のままであることを確認する。`beginRun(params, seed, 'fool')`(または他スプレッド)では全カードが`removed: false`のままであることも確認する(回帰確認)
- 実装完了後、プロジェクトCLAUDE.mdの完了前チェック(`npm run build`・`npm run check`・`npm run dev`でのブラウザ動作確認)で最終確認する。`npm run dev`では、「魔術師」を選んでランを開始し護符の所持上限表示が+1されていること・場札が1行少ないこと、「正義」を選んでランを開始しショップ等でJ・Q・Kのカードが一切出現しないことを確認する

## スコープ外

- 候補D・E・Fの実装
- `excludedRanks`をショップ抽選・レリック抽選など、初期デッキ生成以外のシステムから参照する仕組み(今回は`beginRun`での初期デッキ生成時の一括除外のみ)
- `itemMaxCapacity`以外の所持上限(`riteMaxCapacity`・`revelationOracleMaxCapacity`)へのスプレッドボーナス適用
