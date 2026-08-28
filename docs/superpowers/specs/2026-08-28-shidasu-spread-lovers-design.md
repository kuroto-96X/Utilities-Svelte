# 新規スプレッド「恋人」(黒赤スート片方統一) 実装設計

## 背景・目的

`docs/shidasu/shidasu-spread-candidates.md`の「具体的なルール候補一覧」の候補D(「初期デッキの♠と♣がどちらか片方に変換、♥と♦がどちらか片方に変換された状態でスタート」)を、新規スプレッド「恋人」(`lovers`)として実装する。既存の`fool`(愚者)・`moon`(月)・`pope`(教皇)・`empress`(女帝)・`magician`(魔術師)・`justice`(正義)に続く7種類目のスプレッドになる。

## 変更内容

### 1. `SpreadId`型に`'lovers'`を追加

対象: `src/lib/game/shidasu/types.ts`

```ts
export type SpreadId = 'fool' | 'moon' | 'pope' | 'empress' | 'magician' | 'justice' | 'lovers'
```

コメントに`lovers(恋人)=初期デッキの黒スート(♠♣)・赤スート(♥♦)がそれぞれランダムに片方へ統一される`旨を追記する。

### 2. `SpreadConfig`型に`unifyBlackRedSuits: boolean`フィールドを追加

対象: `src/lib/game/shidasu/types.ts`

```ts
export interface SpreadConfig {
  // (既存フィールドは変更なし)
  // 初期デッキ生成時、黒スート(♠♣)をどちらか一方へ、赤スート(♥♦)をどちらか一方へ
  // ランダムに統一するか(既定false)。統一先はラン開始のたびにランダムに決定される。
  unifyBlackRedSuits: boolean
}
```

### 3. `deck.ts`にスート統一ヘルパー関数を新設

対象: `src/lib/game/shidasu/deck.ts`

```ts
// 黒スートペア(♠・♣)をどちらか一方へ、赤スートペア(♥・♦)をどちらか一方へ、
// それぞれランダムに統一する。統一先の決定にrandを2回消費する(黒→赤の順)。
// ★(ワイルド専用スート)のカードはそのまま素通しする。
export function unifyBlackRedSuits(composition: DeckCard[], rand: () => number): DeckCard[] {
  const blackTarget: Suit = rand() < 0.5 ? '♠' : '♣'
  const redTarget: Suit = rand() < 0.5 ? '♥' : '♦'
  return composition.map(c => {
    if (c.suit === '♠' || c.suit === '♣') return { ...c, suit: blackTarget }
    if (c.suit === '♥' || c.suit === '♦') return { ...c, suit: redTarget }
    return c
  })
}
```

### 4. `beginRun`(`engine.ts`)で`unifyBlackRedSuits`を反映

対象: `src/lib/game/shidasu/engine.ts`

既存の`excludedRanks`反映処理(候補C「正義」実装時に追加済み)の直後に、`unifyBlackRedSuits`の反映を追加する。

```ts
export function beginRun(params: ShidasuParams, seed?: number, spreadId: SpreadId = 'fool'): RunState {
  const spreadConfig = params.spreads[spreadId]
  const initialExtraTableauRows = spreadConfig.initialExtraTableauRows
  const rand = createRng(seed ?? Math.floor(Math.random() * 999999) + 1)
  const initialStageStars = rollStageStars(params, rand)
  const oracleLevels = oracleLevelsWithUniformValue(spreadConfig.initialOracleLevel)
  const initialRun = createInitialRun()
  const deckCompositionAfterExclusion = spreadConfig.excludedRanks.length === 0
    ? initialRun.deckComposition
    : initialRun.deckComposition.map(c =>
        spreadConfig.excludedRanks.includes(c.rank) ? { ...c, removed: true } : c
      )
  const deckComposition = spreadConfig.unifyBlackRedSuits
    ? unifyBlackRedSuits(deckCompositionAfterExclusion, rand)
    : deckCompositionAfterExclusion
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

既存の`rand`(`rollStageStars`にも使われている、`createRng(seed ...)`で生成済みの乱数)をそのまま流用する。新たな乱数系列は作らない。

### 5. `DEFAULT_PARAMS.spreads`・`shidasu.config.json`への追記

- 既存6スプレッド(fool/moon/pope/empress/magician/justice)に`unifyBlackRedSuits: false`を追加
- 新規`lovers`: `unifyBlackRedSuits: true`、他は`fool`と同じ(`excludedRanks: []`・`initialItemCapacityBonus: 0`等)

### 6. `SPREAD_IDS`に`'lovers'`を追記

対象: `src/lib/game/shidasu/params.ts`

### 7. `/admin/shidasu-spreads`のUI拡張

対象: `src/routes/admin/shidasu-spreads/+page.svelte`

「除外ランク」列の右に「黒赤スート統一」列(チェックボックス1個、`bind:checked={entry.unifyBlackRedSuits}`)を追加する。`hasValidationError`には追加バリデーション不要(真偽値のため常に有効な値)。

## テスト方針

- `src/lib/game/shidasu/params.test.ts`: `lovers`の`unifyBlackRedSuits`が`true`であること、他6スプレッド(fool/moon/pope/empress/magician/justice)が`false`であることを確認するテストを追加する
- `src/lib/game/shidasu/deck.test.ts`: `unifyBlackRedSuits`関数単体のテストを追加する
  - シードを固定した`rand`(または決定的な`rand`のモック)で、変換後のデッキに♠と♣が混在しないこと(いずれか一方のみになっていること)、♥と♦も同様に混在しないことを確認する
  - 変換前後でカードの総枚数・各ランクの枚数構成が変わらないこと(スートを書き換えるだけで、`removed`や`rank`は変化しないこと)を確認する
  - `rand`が常に`0`を返す場合と常に`1`未満の別の固定値を返す場合の両方をテストし、黒スート統一先・赤スート統一先がそれぞれ`rand()`の返り値に応じて`♠`/`♣`・`♥`/`♦`のいずれかに正しく決まることを確認する(決定的な動作の検証)
- `src/lib/game/shidasu/engine.test.ts`: `beginRun(params, seed, 'lovers')`のとき、`run.deckComposition`の全カードのスートが♠か♣のどちらか一方、または♥か♦のどちらか一方に統一されていることを確認する。他スプレッド(`fool`等)では従来通り4スート混在のままであることも確認する(回帰確認)。候補C(`justice`)の`excludedRanks`と`lovers`の`unifyBlackRedSuits`が同時に有効なスプレッドは今回存在しないため、両方が同時に効く場合のテストは追加しない

## スコープ外

- 候補E・Fの実装
- `unifyBlackRedSuits`以外の汎用的なスート変換パターン(将来別のペア分けを行うスプレッドを作る場合は、そのとき別途フィールドを検討する)
- `excludedRanks`(正義)と`unifyBlackRedSuits`(恋人)を同一スプレッドで併用する場合の挙動検証(今回はどちらか一方のみを持つスプレッドとして実装するため)
