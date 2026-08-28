# 新規スプレッド「力」(スート別ランダムワイルド化) 実装設計

## 背景・目的

`docs/shidasu/shidasu-spread-candidates.md`の「具体的なルール候補一覧」の候補G(「初期デッキの各スートから1枚ずつランダムにワイルドに変換して開始する」)を、新規スプレッド「力」(`strength`)として実装する。既存の`fool`(愚者)・`moon`(月)・`pope`(教皇)・`empress`(女帝)・`magician`(魔術師)・`justice`(正義)・`lovers`(恋人)・`emperor`(皇帝)・`wheelOfFortune`(運命の輪)に続く10種類目のスプレッドになる。

初期デッキの4スート(♠♥♦♣)それぞれから、ワイルド化されていない・除外されていないカードを1枚ずつランダムに選び、`wild: true`に変換した状態でランを開始する(最大4枚がワイルド化される)。

## 変更内容

### 1. `SpreadId`型に`'strength'`を追加

対象: `src/lib/game/shidasu/types.ts`

```ts
export type SpreadId = 'fool' | 'moon' | 'pope' | 'empress' | 'magician' | 'justice' | 'lovers' | 'emperor' | 'wheelOfFortune' | 'strength'
```

コメントに`strength(力)=初期デッキの各スートから1枚ずつランダムにワイルドへ変換された状態で始まる`旨を追記する。

### 2. `SpreadConfig`型に`randomizeWildPerSuit: boolean`フィールドを追加

対象: `src/lib/game/shidasu/types.ts`

```ts
export interface SpreadConfig {
  // (既存フィールドは変更なし)
  randomizeDeck: boolean
  // 初期デッキ生成時、4スート(♠♥♦♣)それぞれから、ワイルドでも除外済みでもないカードを
  // 1枚ずつランダムに選びワイルドへ変換するか(既定false)。対象候補が0枚のスートはスキップする。
  randomizeWildPerSuit: boolean
}
```

既存の`deckMultiplier`・`excludedRanks`・`unifyBlackRedSuits`・`randomizeDeck`とは独立したフィールドとして扱う。

### 3. `engine.ts`にスート別ランダムワイルド化ヘルパー関数を新設

対象: `src/lib/game/shidasu/engine.ts`

既存の`convertRandomCardToWild`(92-97行目、デッキ全体からランダム1枚を選んでワイルド化するヘルパー、護符「豊穣」が使用)の直後に、スート単位版を追加する。

```ts
// デッキ構成のうち、4スート(♠♥♦♣)それぞれから非ワイルド・非除外の1枚をランダムに選び
// ワイルドへ変換した新しい配列を返す。候補が無いスートはスキップする(スプレッド「力」が使用)。
function convertOneCardPerSuitToWild(composition: DeckCard[], rand: () => number): DeckCard[] {
  let result = composition
  for (const suit of (['♠', '♥', '♦', '♣'] as Suit[])) {
    const candidates = result.map((c, i) => i).filter(i => result[i].suit === suit && !result[i].wild && !result[i].removed)
    if (candidates.length === 0) continue
    const target = candidates[Math.floor(rand() * candidates.length)]
    result = result.map((c, i) => (i === target ? { ...c, wild: true } : c))
  }
  return result
}
```

`Suit`型は`types.ts`から既にimport済みの想定(未importならimportを追加する)。

### 4. `beginRun`への反映

対象: `src/lib/game/shidasu/engine.ts`

既存の変換チェーン(`deckMultiplier` → `randomizeDeck` → `excludedRanks` → `unifyBlackRedSuits`)の最後に、ワイルド化のステップを追加する。

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
const deckCompositionAfterUnify = spreadConfig.unifyBlackRedSuits
  ? unifyBlackRedSuits(deckCompositionAfterExclusion, rand)
  : deckCompositionAfterExclusion
const deckComposition = spreadConfig.randomizeWildPerSuit
  ? convertOneCardPerSuitToWild(deckCompositionAfterUnify, rand)
  : deckCompositionAfterUnify
```

最終段階(`unifyBlackRedSuits`適用後)に実行することで、黒赤スート統一後の実際のスート構成に対して正しくワイルド化できる(将来`unifyBlackRedSuits`と`randomizeWildPerSuit`を併用するスプレッドを作る場合でも、統一後のスートを基準に1枚ずつ選ばれる)。

既存の`rand`(`createRng(seed ...)`で生成済み)をそのまま流用する。新たな乱数系列は作らない。

`strength`スプレッド自体は`deckMultiplier: 1`・`randomizeDeck: false`・`excludedRanks: []`・`unifyBlackRedSuits: false`で実装するため、実際には`deckCompositionAfterUnify`は常に標準52枚デッキ(4スート×13ランク)になり、各スートから確実に1枚ずつ、合計4枚がワイルド化される。

### 5. `DEFAULT_PARAMS.spreads`・`shidasu.config.json`への追記

- 既存9スプレッドに`randomizeWildPerSuit: false`を追加
- 新規`strength`: `randomizeWildPerSuit: true`、他は`fool`と同じ(`deckMultiplier: 1`・`tableauRowMultiplier: 1`・`targetScoreMultiplier: 1`・`excludedRanks: []`・`unifyBlackRedSuits: false`・`randomizeDeck: false`等)

### 6. `SPREAD_IDS`に`'strength'`を追記

対象: `src/lib/game/shidasu/params.ts`

### 7. `/admin/shidasu-spreads`のUI拡張

対象: `src/routes/admin/shidasu-spreads/+page.svelte`

「デッキランダム化」列の右に「スート別ワイルド化」列(チェックボックス1個、`bind:checked={entry.randomizeWildPerSuit}`)を追加する。`hasValidationError`には追加バリデーション不要(真偽値のため常に有効な値)。

## 役判定・既存ロジックへの影響(調査済み・安全性の根拠)

`convertOneCardPerSuitToWild`は既存の`convertRandomCardToWild`(護符「豊穣」で実戦投入済み)とほぼ同じ形の変換で、対象範囲をスート単位に絞っているだけの差分。ワイルドカードは既存の役判定ロジック内で「任意のランク・スートとして扱われるカード」として扱われる既存の仕組みがあり(護符「永劫」・「豊穣」・「静寂」で実績あり)、新規のワイルド関連ロジックは追加しない。

`wheelOfFortune`(運命の輪)との将来的な併用時、ランダム化後のスート構成に対して`convertOneCardPerSuitToWild`が動作するため、特定スートが0枚(完全ランダム化で偶然出現しなかった場合)ならそのスートはスキップされ、最大4枚未満のワイルド化になる。これは意図した仕様(候補が無ければスキップ)であり、新規の救済ロジックは追加しない。ただし今回`strength`自体は`randomizeDeck: false`で実装するため、通常のプレイでは常に4枚ワイルド化される。

## テスト方針

- `src/lib/game/shidasu/params.test.ts`: `strength`の`randomizeWildPerSuit`が`true`であること、他9スプレッドが`false`であることを確認するテストを追加する
- `src/lib/game/shidasu/engine.test.ts`:
  - `convertOneCardPerSuitToWild`関数単体、または`beginRun(params, seed, 'strength')`経由で、`run.deckComposition`のうち`wild: true`のカードがちょうど4枚(4スート分)存在し、各スートから1枚ずつであることを確認する
  - 他スプレッド(`fool`等)では`randomizeWildPerSuit: false`のため、`wild: true`のカードが存在しない(標準デッキのまま)ことを確認する(回帰確認)
- 既存の役判定関連テスト(`patterns.test.ts`等)が全てPASSすることを確認する(回帰確認、ロジック自体は変更しないため影響なしのはず)

## スコープ外

- `randomizeWildPerSuit`と`randomizeDeck`(運命の輪)を同時に有効化した場合の挙動検証(今回は`strength`が`randomizeDeck: false`前提で実装するため、組み合わせは考慮しない)
- 役判定ロジック自体の変更(現状のロジックをそのまま使う)
- ワイルド化対象カードをプレイヤーが選べるようにする、といった追加のインタラクティブ要素(今回はラン開始時の完全ランダム選出のみ)
