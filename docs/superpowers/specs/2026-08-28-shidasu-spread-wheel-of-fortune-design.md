# 新規スプレッド「運命の輪」(初期デッキ完全ランダム化) 実装設計

## 背景・目的

`docs/shidasu/shidasu-spread-candidates.md`の「具体的なルール候補一覧」の候補F(「初期デッキのすべてのランクとスートがランダムになる」)を、新規スプレッド「運命の輪」(`wheelOfFortune`)として実装する。既存の`fool`(愚者)・`moon`(月)・`pope`(教皇)・`empress`(女帝)・`magician`(魔術師)・`justice`(正義)・`lovers`(恋人)・`emperor`(皇帝)に続く9種類目のスプレッドになる。

初期デッキ52枚それぞれのランク・スートが、ラン開始時に完全ランダムに再抽選される。同じカード(同ランク×同スート)が複数枚存在したり、特定のランク・スートが1枚も存在しなかったりする、予測不可能なデッキでスタートする。

## 変更内容

### 1. `SpreadId`型に`'wheelOfFortune'`を追加

対象: `src/lib/game/shidasu/types.ts`

```ts
export type SpreadId = 'fool' | 'moon' | 'pope' | 'empress' | 'magician' | 'justice' | 'lovers' | 'emperor' | 'wheelOfFortune'
```

コメントに`wheelOfFortune(運命の輪)=初期デッキ52枚それぞれのランク・スートが完全ランダムに再抽選される`旨を追記する。

### 2. `SpreadConfig`型に`randomizeDeck: boolean`フィールドを追加

対象: `src/lib/game/shidasu/types.ts`

```ts
export interface SpreadConfig {
  // (既存フィールドは変更なし)
  // 初期デッキ生成時、52枚それぞれのsuit・rankを独立にランダム抽選するか(既定false)。
  // trueの場合、deckMultiplierによる複製結果を上書きする(52枚固定生成のため)。
  randomizeDeck: boolean
}
```

既存の`deckMultiplier`・`excludedRanks`・`unifyBlackRedSuits`とは独立したフィールドとして扱う。

### 3. `deck.ts`にランダムデッキ生成ヘルパー関数を新設

対象: `src/lib/game/shidasu/deck.ts`

```ts
// 52枚それぞれのsuit・rankを独立にランダム抽選したdeckCompositionを生成する。
// 同じカード(同suit×同rank)が複数枚存在したり、特定のsuit・rankが1枚も
// 存在しなかったりする可能性がある。deckIdは0〜51の連番。
export function randomizedDeckComposition(rand: () => number): DeckCard[] {
  const composition: DeckCard[] = []
  for (let deckId = 0; deckId < 52; deckId++) {
    const suit = SUITS[Math.floor(rand() * SUITS.length)]
    const rank = (Math.floor(rand() * 13) + 1) as Rank
    composition.push({ deckId, suit, rank, wild: false, removed: false })
  }
  return composition
}
```

### 4. `beginRun`(`engine.ts`)への反映

対象: `src/lib/game/shidasu/engine.ts`

既存の変換チェーン(`deckMultiplier`によるベースデッキ生成 → `excludedRanks`適用 → `unifyBlackRedSuits`適用)に、ランダム化のステップを`deckMultiplier`の直後・`excludedRanks`の前に挿入する。

```ts
const baseDeckComposition = spreadConfig.deckMultiplier === 1
  ? initialRun.deckComposition
  : multipliedDeckComposition(spreadConfig.deckMultiplier)
const deckCompositionAfterRandomize = spreadConfig.randomizeDeck
  ? randomizedDeckComposition(rand)
  : baseDeckComposition
const deckCompositionAfterExclusion = spreadConfig.excludedRanks.length === 0
  ? deckCompositionAfterRandomize
  : deckCompositionAfterRandomize.map(c =>
      spreadConfig.excludedRanks.includes(c.rank) ? { ...c, removed: true } : c
    )
const deckComposition = spreadConfig.unifyBlackRedSuits
  ? unifyBlackRedSuits(deckCompositionAfterExclusion, rand)
  : deckCompositionAfterExclusion
```

`randomizeDeck: true`のときは`deckMultiplier`による複製結果を完全に上書きする(常に52枚固定生成のため)。`wheelOfFortune`スプレッド自体は`deckMultiplier: 1`のまま実装し、複製とランダム化の同時使用は今回のスコープに含めない。

既存の`rand`(`createRng(seed ...)`で生成済み、`rollStageStars`にも使われている乱数)をそのまま流用する。新たな乱数系列は作らない。

### 5. `DEFAULT_PARAMS.spreads`・`shidasu.config.json`への追記

- 既存9スプレッド(fool/moon/pope/empress/magician/justice/lovers/emperor)に`randomizeDeck: false`を追加
- 新規`wheelOfFortune`: `randomizeDeck: true`、他は`fool`と同じ(`deckMultiplier: 1`・`tableauRowMultiplier: 1`・`targetScoreMultiplier: 1`・`excludedRanks: []`・`unifyBlackRedSuits: false`等)

### 6. `SPREAD_IDS`に`'wheelOfFortune'`を追記

対象: `src/lib/game/shidasu/params.ts`

### 7. `/admin/shidasu-spreads`のUI拡張

対象: `src/routes/admin/shidasu-spreads/+page.svelte`

「黒赤スート統一」列の右に「デッキランダム化」列(チェックボックス1個、`bind:checked={entry.randomizeDeck}`)を追加する。`hasValidationError`には追加バリデーション不要(真偽値のため常に有効な値)。

## 役判定への影響(調査済み・安全性の根拠)

既存の役判定ロジック(`patterns.ts`)はチェーン内カード同士の関係(同ランク・同スート・同色・階段等)で判定しており、デッキ全体の構成(4スート×13ランクの固定分布)には依存していない。これは既に皇帝スプレッド(デッキ2組・104枚、同一カードが複数枚存在する状態)の実装時に同様の観点で検証済みで、既存の全テストがPASSすることで安全性が担保されている。

基準カード(foundation)選出処理(`startWave`、`const foundation = deck.pop() as Card`)もシャッフル後の山札末尾を単純取得するだけで、ランク・スートを特定条件で選ぶロジックは無いため影響を受けない。

特定のランク・スートが完全ランダム化により枯渇するケースが起こりうる。この場合、`completeRun`(コンプリートラン、13ランク制覇の役)のような「全ランク揃える」役は、既存のワイルド救済ロジック(実カード+ワイルドの穴埋めで成立とみなす仕組み)に頼らざるを得なくなる可能性が高くなるが、これは既存ロジックが正しく処理する想定通りの挙動であり、意図した難易度上昇として扱う(新規のロジック変更は不要)。

## テスト方針

- `src/lib/game/shidasu/params.test.ts`: `wheelOfFortune`の`randomizeDeck`が`true`であること、他9スプレッド(fool/moon/pope/empress/magician/justice/lovers/emperor)が`false`であることを確認するテストを追加する
- `src/lib/game/shidasu/deck.test.ts`: `randomizedDeckComposition`関数単体のテストを追加する
  - 52枚生成されること、`deckId`が0〜51の連番であることを確認する
  - シードを固定した`rand`(`createRng`)で、同じシードなら同じ結果になる(決定的)ことを確認する
  - 全カードが`wild: false`・`removed: false`で生成されることを確認する
  - `rand`の消費回数が52回×2(suit・rank)=104回であることを、モック関数の呼び出し回数で確認する(境界値・実装の正確性チェック)
- `src/lib/game/shidasu/engine.test.ts`: `beginRun(params, seed, 'wheelOfFortune')`のとき、`run.deckComposition`が52枚生成されること、他スプレッド(`fool`等)では従来通り標準デッキが生成されることを確認する(回帰確認)
- 既存の役判定関連テスト(`patterns.test.ts`等)が全てPASSすることを確認する(回帰確認、ロジック自体は変更しないため影響なしのはず)

## スコープ外

- `randomizeDeck`と`deckMultiplier`(皇帝の2倍等)を同時に有効化した場合の挙動検証(今回は`wheelOfFortune`が`deckMultiplier: 1`前提で実装するため、組み合わせは考慮しない)
- 役判定ロジック自体の変更(現状のロジックをそのまま使う)
- 特定のランク・スートが極端に偏る、または完全に0枚になるケースへの追加の緩和策・救済ロジックの新設
