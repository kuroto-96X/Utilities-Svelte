# トランプセット福袋の実装 設計

## 背景・目的

`docs/shidasu/shidasu-card-set-pack-candidates.md`で洗い出した「トランプセットの福袋」候補11ジャンルを、内容を再検討・確定した上で実装する。福袋を開けると複数のセットジャンル(階段セット・同ランクセットなど)がランダムに提示され、選んだ1つのカード群が`RunState.deckComposition`に恒久的に追加される。

## セットジャンル一覧(23種類)

候補一覧の11ジャンルを再検討した結果、枚数バリエーションを独立したジャンルとして分割し、1ジャンル(レインボー・ステアセット)を対応する役が実装予定に無いため除外し、最終的に23種類とする。

| # | 識別子(`CardSetGenreId`) | 名前 | 枚数 | 内容 |
|---|---|---|---|---|
| 1 | `stair3` | 階段セット(3枚) | 3 | 連続ランク3枚、スートは各カード個別ランダム |
| 2 | `stair5` | 階段セット(5枚) | 5 | 同上、5枚 |
| 3 | `stair7` | 階段セット(7枚) | 7 | 同上、7枚 |
| 4 | `sameRank2` | 同ランクセット(2枚) | 2 | 同一ランク、スートは重複無くランダムに2つ選択 |
| 5 | `sameRank3` | 同ランクセット(3枚) | 3 | 同上、3つ |
| 6 | `sameRank4` | 同ランクセット(4枚) | 4 | 同上、4つ(4スート全部) |
| 7 | `faceCards` | 絵札セット | 3 | J・Q・K各1枚、スートは各カード個別ランダム |
| 8 | `sameSuit3` | 同スートセット(3枚) | 3 | 同一スート、ランクは重複無くランダムに3つ選択 |
| 9 | `sameSuit5` | 同スートセット(5枚) | 5 | 同上、5つ |
| 10 | `sameSuit7` | 同スートセット(7枚) | 7 | 同上、7つ |
| 11 | `royal` | ロイヤルセット | 3 | 同一スートのJ・Q・K(スートをランダムに1つ決定して統一) |
| 12 | `flush` | フラッシュセット | 4 | 4スート1枚ずつ、ランクは各カード個別ランダム |
| 13 | `completeRunSameSuit` | コンプリートランセット(同スート) | 13 | 1スート(ランダムに1つ決定)の全13ランク |
| 14 | `completeRunRandomSuit` | コンプリートランセット(スートランダム) | 13 | 全13ランク、スートは各カード個別ランダム |
| 15 | `pair2` | ペアセット(2組) | 4 | 異なる2ランクの2枚組×2組、各組の2枚は異なるスートに個別ランダム |
| 16 | `pair3` | ペアセット(3組) | 6 | 同上、3組 |
| 17 | `redBlack4Random` | 赤黒バランスセット(4枚・スート個別ランダム) | 4 | 赤2枚(♥♦から個別ランダム)・黒2枚(♠♣から個別ランダム)、ランクは各カード個別ランダム |
| 18 | `redBlack4Fixed` | 赤黒バランスセット(4枚・スート統一) | 4 | 赤2枚は♥/♦のどちらか1つに統一、黒2枚は♠/♣のどちらか1つに統一(それぞれランダムに決定)、ランクは各カード個別ランダム |
| 19 | `redBlack6Random` | 赤黒バランスセット(6枚・スート個別ランダム) | 6 | 赤3枚・黒3枚、スート個別ランダム |
| 20 | `redBlack6Fixed` | 赤黒バランスセット(6枚・スート統一) | 6 | 赤3枚・黒3枚、赤黒それぞれスート統一 |
| 21 | `redBlack8Random` | 赤黒バランスセット(8枚・スート個別ランダム) | 8 | 赤4枚・黒4枚、スート個別ランダム |
| 22 | `redBlack8Fixed` | 赤黒バランスセット(8枚・スート統一) | 8 | 赤4枚・黒4枚、赤黒それぞれスート統一 |
| 23 | `wildCard` | ワイルドカード | 1 | ワイルド1枚固定 |

いずれのジャンルも、セット内でのカードの重複([スート, ランク]の組み合わせ)は避ける(赤黒バランスセットの赤3枚・黒3枚のように、赤同士・黒同士で重複するかどうかは各ジャンルの生成ロジックによる。既存デッキや他の福袋で追加済みのカードとの重複は許容する、`shidasu-card-set-pack-candidates.md`の既存方針を踏襲)。

## 全体アーキテクチャ

- 新しい`packKind: 'cardSet'`を追加する。既存の護符/秘儀/天啓/神託福袋と同じ`offerCount: 3 | 5 | 7`・`pickCount: 1 | 2`のパターン(3-1・5-1・7-2の3パターン)を`PACK_DEFINITIONS`に追加する
- カードセットは**福袋限定**。バラ売り(`ShopIndividualSlot`、`SHOP_SLOT_KINDS`)の対象には含めない
- 福袋を開けると、後述の「セットジャンルプール」から重み付き抽選で`offerCount`個のジャンルが選ばれ、各ジャンルの具体的なカード内容(スート・ランク)もその場で確定する(既存の天啓・神託と同じ「オファーは開封時に一度だけ抽選される」設計方針を踏襲)
- 選んだセットのカードは、選択した瞬間に`RunState.deckComposition`へ即座に追加される。天啓の「即使用」パターンと同様、**所持枠・スワップ処理は不要**(護符・秘儀・天啓/神託合算枠のような上限が存在しないため)
- 新規フェーズ`'cardSetSelect'`を追加する

## 抽選確率・価格

- **福袋自体の価格**: 既存の`packPrice`テーブル(`shidasu.config.json`の`shop.packPrice`)と同じ形式で`cardSet`エントリを追加する(3-1・5-1・7-2それぞれに価格を設定、既存の護符福袋等と同じ価格帯を初期値として流用)。`/admin/shidasu-currency`ページで編集可能にする(既存の`shop.packPrice`編集UIをそのまま利用できる想定)
- **ジャンルの出現しやすさ**: 福袋を開けた際にどのジャンルが提示されるかは、**重み付き非復元抽選**(枚数が少ないジャンルほど出現しやすい)で決める。重み = `1 / 枚数`。ただしワイルドカード(1枚)は例外的に6枚相当として`1/6`を割り当てる
- 出た後の購入コストは福袋自体の価格のみで、ジャンルごとの個別価格は無い(強いジャンルほど出にくいことで価値が調整される)

## 技術要素

### 型定義(`types.ts`)

```ts
export type CardSetGenreId =
  | 'stair3' | 'stair5' | 'stair7'
  | 'sameRank2' | 'sameRank3' | 'sameRank4'
  | 'faceCards'
  | 'sameSuit3' | 'sameSuit5' | 'sameSuit7'
  | 'royal'
  | 'flush'
  | 'completeRunSameSuit' | 'completeRunRandomSuit'
  | 'pair2' | 'pair3'
  | 'redBlack4Random' | 'redBlack4Fixed' | 'redBlack6Random' | 'redBlack6Fixed' | 'redBlack8Random' | 'redBlack8Fixed'
  | 'wildCard'

// 福袋を開けた瞬間に確定する、1オファー分の中身(ジャンルIDと具体的なカード内容)。
// cardsはこの時点ではdeckIdを持たない(deckIdは実際に選択が確定しdeckCompositionへ
// 追加する瞬間に採番する。福袋を開けてから選ぶまでの間に他の処理でdeckCompositionの
// 長さが変わる可能性を考慮し、確定時点で採番することで常に一意性を保証する)。
export interface CardSetOffer {
  genreId: CardSetGenreId
  cards: { suit: Suit; rank: Rank; wild: boolean }[]
}
```

`ShopSlotKind`に`'cardSet'`を追加する:

```ts
export type ShopSlotKind = 'item' | 'rite' | 'revelation' | 'oracle' | 'cardSet'
```

`RunPhase`に`'cardSetSelect'`を追加する:

```ts
export type RunPhase = 'title' | 'playing' | 'shop' | 'itemSelect' | 'riteSelect' | 'revelationSelect' | 'oracleSelect' | 'cardSetSelect' | 'continueChoice' | 'allClear' | 'gameOver'
```

`RunState`に以下を追加する:

```ts
  // カードセット福袋の福袋('cardSetSelect'フェーズ)で提示中のオファー。それ以外のフェーズでは空配列
  cardSetOffer: CardSetOffer[]
```

### `deckComposition`への一括追加(新規関数、`deck.ts`)

現状`deckComposition`に新しいカードを追加する処理が存在しないため、新規関数を追加する。`deckId`は既存の採番方式(天啓のワイルド供給処理と同じ、現在の配列長から連番で振る)を踏襲する。

```ts
// deckCompositionに複数枚のカードを一括追加する。deckIdは既存の最大値の続きから連番で振る。
export function addCardsToDeckComposition(deckComposition: DeckCard[], cards: { suit: Suit; rank: Rank; wild: boolean }[]): DeckCard[] {
  let nextDeckId = deckComposition.length
  const added: DeckCard[] = cards.map(c => ({ deckId: nextDeckId++, suit: c.suit, rank: c.rank, wild: c.wild }))
  return [...deckComposition, ...added]
}
```

### セットジャンルの重み・抽選(新規モジュール、`cardSets.ts`)

各ジャンルの重み(`1 / 枚数`、ワイルドのみ`1/6`)をテーブルで持つ:

```ts
const CARD_SET_GENRE_WEIGHTS: Record<CardSetGenreId, number> = {
  stair3: 1 / 3, stair5: 1 / 5, stair7: 1 / 7,
  sameRank2: 1 / 2, sameRank3: 1 / 3, sameRank4: 1 / 4,
  faceCards: 1 / 3,
  sameSuit3: 1 / 3, sameSuit5: 1 / 5, sameSuit7: 1 / 7,
  royal: 1 / 3,
  flush: 1 / 4,
  completeRunSameSuit: 1 / 13, completeRunRandomSuit: 1 / 13,
  pair2: 1 / 4, pair3: 1 / 6,
  redBlack4Random: 1 / 4, redBlack4Fixed: 1 / 4,
  redBlack6Random: 1 / 6, redBlack6Fixed: 1 / 6,
  redBlack8Random: 1 / 8, redBlack8Fixed: 1 / 8,
  wildCard: 1 / 6,
}
```

重み付き非復元抽選(選ばれた候補は次の抽選対象から除外し、残りの重みで再正規化して繰り返す)で`count`個のジャンルを選び、それぞれのカード内容を生成する:

```ts
function weightedSampleGenres(count: number, rand: () => number): CardSetGenreId[] {
  const remaining = (Object.keys(CARD_SET_GENRE_WEIGHTS) as CardSetGenreId[]).map(id => ({ id, weight: CARD_SET_GENRE_WEIGHTS[id] }))
  const result: CardSetGenreId[] = []
  for (let i = 0; i < count && remaining.length > 0; i++) {
    const totalWeight = remaining.reduce((sum, r) => sum + r.weight, 0)
    let roll = rand() * totalWeight
    let idx = remaining.length - 1
    for (let j = 0; j < remaining.length; j++) {
      roll -= remaining[j].weight
      if (roll <= 0) { idx = j; break }
    }
    result.push(remaining[idx].id)
    remaining.splice(idx, 1)
  }
  return result
}

export function rollCardSetOffer(rand: () => number = Math.random, count: number): CardSetOffer[] {
  return weightedSampleGenres(count, rand).map(genreId => ({ genreId, cards: generateCardSet(genreId, rand) }))
}
```

### ジャンルごとのカード生成ロジック

`generateCardSet(genreId, rand)`は`{ suit: Suit; rank: Rank; wild: boolean }[]`を返す。各ジャンルの生成方針:

- **階段セット(N枚)**: 開始ランクをランダムに1つ決定(A⇔Kループを跨いでよい)、そこからN枚連続するランクを生成。各カードのスートは個別にランダム
- **同ランクセット(N枚)**: ランクをランダムに1つ決定。4スートから重複無くN個を選択
- **絵札セット**: ランクはJ・Q・K固定。各カードのスートは個別にランダム
- **同スートセット(N枚)**: スートをランダムに1つ決定。13ランクから重複無くN個を選択
- **ロイヤルセット**: ランクはJ・Q・K固定。スートをランダムに1つ決定して3枚とも統一
- **フラッシュセット**: 4スート固定(各1枚)。ランクは各カード個別にランダム
- **コンプリートランセット(同スート)**: スートをランダムに1つ決定。A〜K全13ランク
- **コンプリートランセット(スートランダム)**: A〜K全13ランク。各カードのスートは個別にランダム
- **ペアセット(N組)**: 13ランクから重複無くN個を選択、各ランクにつき2枚(計2N枚)。各組の2枚は異なるスートになるよう個別にランダム
- **赤黒バランスセット(N枚・スート個別ランダム)**: 赤N/2枚(♥♦から個別にランダム)・黒N/2枚(♠♣から個別にランダム)。ランクは各カード個別にランダム
- **赤黒バランスセット(N枚・スート統一)**: 赤N/2枚は♥/♦のどちらか1つにランダムに統一、黒N/2枚は♠/♣のどちらか1つにランダムに統一。ランクは各カード個別にランダム
- **ワイルドカード**: `wild: true`固定1枚(スート・ランク概念なし)

### 選択・確定フロー(`engine.ts`)

`buyPack`に`packKind === 'cardSet'`の分岐を追加する:

```ts
  if (slot.packKind === 'cardSet') return { ...base, phase: 'cardSetSelect', cardSetOffer: rollCardSetOffer(rand, slot.offerCount) }
```

天啓の「即使用」パターン(`pickPackRevelationUse`/`resolvePackRevelationPick`)を参考に、所持枠・スワップが不要な分シンプルな選択確定関数を新設する:

```ts
function resolvePackCardSetPick(run: RunState, pickedGenreId: CardSetGenreId): RunState {
  const idx = run.cardSetOffer.findIndex(o => o.genreId === pickedGenreId)
  const cardSetOffer = idx === -1 ? run.cardSetOffer : [...run.cardSetOffer.slice(0, idx), ...run.cardSetOffer.slice(idx + 1)]
  const offerPickRemaining = run.offerPickRemaining - 1
  if (offerPickRemaining <= 0) {
    return { ...run, phase: 'shop', cardSetOffer: [], offerPickRemaining: 0 }
  }
  return { ...run, cardSetOffer, offerPickRemaining }
}

// カードセットの福袋(cardSetSelect)から1つ選び、そのカードをdeckCompositionへ即座に追加する。
// deckIdはこの時点のdeckComposition長を基準に採番する(addCardsToDeckComposition、deck.ts参照)。
export function pickPackCardSet(run: RunState, genreId: CardSetGenreId): RunState {
  if (run.phase !== 'cardSetSelect') return run
  const offer = run.cardSetOffer.find(o => o.genreId === genreId)
  if (!offer) return run
  const deckComposition = addCardsToDeckComposition(run.deckComposition, offer.cards)
  return resolvePackCardSetPick({ ...run, deckComposition }, genreId)
}

// 残りの選択を放棄してshopへ戻る。
export function closePackCardSetSelect(run: RunState): RunState {
  if (run.phase !== 'cardSetSelect') return run
  return { ...run, phase: 'shop', cardSetOffer: [], offerPickRemaining: 0 }
}
```

### UI(`+page.svelte`・新規コンポーネント)

- 既存の`itemSelect`等と同様、`cardSetSelect`フェーズ用の選択画面コンポーネントを新設する
- 各オファーは「ジャンル名 + 確定済みカード一覧(スート・ランクを小さく並べて表示)」の形で表示する。既存のカード表示コンポーネント(場札・チェーン表示等で使っているもの)を流用する
- 選択・スキップ操作は既存の`pickPackItem`/`closePackItemSelect`等と同じUXパターン(ボタン押下でstore経由の関数呼び出し)を踏襲する

## テスト方針

- `cardSets.ts`の各ジャンル生成関数について、それぞれ「正しい枚数が生成される」「セット内でカードが重複しない(該当するジャンルのみ)」「スート・ランクの制約(同一スート、同一ランク、連続ランク等)を満たす」ことを検証する単体テストを書く
- `weightedSampleGenres`について、重みに応じた出現頻度になること(統計的な検証、または決定的な`rand`スタブで特定の抽選結果を検証)、`count`個が重複無く選ばれることを検証する
- `engine.ts`の`buyPack`/`pickPackCardSet`/`closePackCardSetSelect`について、フェーズ遷移・`deckComposition`への追加・`offerPickRemaining`の減算・複数ピック時の残りオファー確定を検証する既存パターン(`pickPackRevelationUse`等のテスト)に準じたテストを書く
- `addCardsToDeckComposition`(または同等の`deckId`採番処理)が既存の`deckComposition`と重複しない`deckId`を振ることを検証する

## 除外・非対象

- **レインボー・ステアセット**: 対応する新規役「レインボー・ストレート」(`docs/shidasu/shidasu-role-candidates.md`)は実装予定が無いため、今回の実装対象から除外する
- カードセットのバラ売り(`ShopIndividualSlot`扱い)・売却は対象外。福袋経由の恒久追加のみ
- 「セットの中身を選ぶ」UI(スート等を自分で選択する)は対象外。ジャンルを選んだ後の具体的なカード内容は完全ランダムのまま
- デッキから既存カードを除去・変換する効果は対象外。トランプセット福袋は「追加専用」の仕組み
