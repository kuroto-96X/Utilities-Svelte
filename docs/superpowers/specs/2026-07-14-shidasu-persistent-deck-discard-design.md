# Shidasu 永続デッキ構成+ウェーブ内捨て札の実装(基盤サブプロジェクト)

## 0. 背景・目的

`docs/shidasu-gofu-candidates.md`のグループ9〜16(24個)を実装しようとしたところ、グループ13の永劫・豊穣・静寂(「ウェーブ後も引き継がれる」効果)と不屈(「捨て札からの山札復活」)が、現状のコードには存在しない2つの仕組みを前提にしていることが分かった。

- **ラン単位で持続するデッキ構成**: 現状`startWave`はウェーブごとに標準52枚デッキを新規生成しており、ウェーブを跨いだ変化を保持する手段が無い
- **ウェーブ内の捨て札(discard pile)**: コンボリセット時にチェーンの札がどこにも記録されず消えており、「捨て札から山札を復活させる」不屈が実装できない

このサブプロジェクトは、この2つの基盤を作り、それに依存する4個の護符(永劫・豊穣・静寂・不屈)を実装する。残り20個(グループ9・10・11・12・14・15・16、および資源操作系の約束・暗雲・再生)は別の実装サイクルで扱う。

## 1. アーキテクチャ

### 1.1 `DeckCard`型と`RunState.deckComposition`

```ts
// types.ts
export interface DeckCard {
  suit: Suit
  rank: Rank
  wild: boolean
}

export interface RunState {
  // ...既存
  deckComposition: DeckCard[]  // ラン全体で持続するデッキの中身(idは持たない。ウェーブ開始のたびに新しいidを振って配る)
}
```

- `id`を持たないのは、ウェーブごとにシャッフル・配布されるカードの実体(`Card`)は毎回新規に生成し直すため。「今デッキに何のカード(スート・ランク・ワイルドか否か)が何枚あるか」という構成だけを持続させる
- どのカードが変換されたかの履歴(元は何のカードだったか等)は持たない。護符の効果は`deckComposition`配列を直接書き換えるだけでよい

### 1.2 `deck.ts`に構成生成関数を追加

```ts
export function standardDeckComposition(): DeckCard[] {
  const composition: DeckCard[] = []
  for (const suit of SUITS) {
    for (let rank = 1; rank <= 13; rank++) {
      composition.push({ suit, rank: rank as Rank, wild: false })
    }
  }
  return composition
}
```

既存の`createDeck`(id付きの`Card[]`を返す、`deck.test.ts`から直接参照される)は変更しない。

### 1.3 `startWave`のシグネチャ変更

現在:
```ts
export function startWave(
  params: ShidasuParams,
  _stageIndex: number,
  _waveIndex: number,
  _items: ItemId[],
  seed?: number
): WaveState
```

変更後:
```ts
export function startWave(
  params: ShidasuParams,
  _stageIndex: number,
  _waveIndex: number,
  items: ItemId[],
  deckComposition: DeckCard[],
  seed?: number
): { wave: WaveState; deckComposition: DeckCard[] }
```

処理の流れ:
1. `items.includes('eternity')`なら、`deckComposition`にワイルドの`DeckCard`を1つ`push`した新配列を作る(デッキが1枚増える)
2. `items.includes('abundance')`なら、非ワイルドの要素をランダムに1つ選び`wild: true`に書き換えた新配列を作る(デッキ内で1枚がワイルドに変わる)
3. (1)(2)を反映した最終的な構成に、`nextId()`で新しいidを振って`Card[]`を生成し、シャッフルして通常通り場札・山札に配る
4. 戻り値の`wave`は`discardPile: []`で初期化する(1.4節)
5. 戻り値の`deckComposition`には、(1)(2)で更新された構成を返す(呼び出し元がこれを`RunState.deckComposition`に反映する)

永劫・豊穣は「ウェーブ開始時」に毎回(そのウェーブでも該当護符を所持していれば)発動するため、複数ウェーブ保持し続ける限り毎回蓄積する。一度増えた分は、後で該当護符を手放しても減らない。

### 1.4 `WaveState.discardPile`(ウェーブ内限定の捨て札)

```ts
export interface WaveState {
  // ...既存
  discardPile: Card[]
}
```

- `startWave`で`[]`初期化
- `drawStock`のコンボリセット分岐(パターン継続でなかった場合)で、リセット前の`wave.chain`を丸ごと`discardPile`に追加してからチェーンを再スタートする
- ウェーブを跨いで持続しない(次のウェーブの`startWave`で再び空になる)

### 1.5 `startWave`呼び出し箇所への影響

`beginRun`・`pickItem`・`confirmItemSwap`・`skipItemSelect`・`advanceStage`の5箇所全てで、戻り値が`{wave, deckComposition}`のペアになったことに合わせて、`RunState`の`wave`と`deckComposition`の両方を更新するよう書き換える。`createInitialRun`(タイトル画面用の初期状態)にも`deckComposition: standardDeckComposition()`を設定する。

## 2. 対象4護符の仕様

これら4個は、これまでの護符と異なり`ITEM_EFFECTS`レジストリ(採点パイプライン)には登録しない。既存の`bridge`/`grace`と同様、`items.includes(...)`によって該当箇所の処理を直接分岐させるルール系の護符として扱う。`ITEM_NAMES`・`itemDesc`には通常通り登録する。

| 護符名 | id | 効果 | 実装箇所 |
|---|---|---|---|
| 永劫 | `eternity` | ウェーブ開始時、`deckComposition`にワイルドを1枚追加(引き継ぎ) | `startWave` |
| 豊穣 | `abundance` | ウェーブ開始時、`deckComposition`の非ワイルド1枚をランダムにワイルドへ変換(引き継ぎ) | `startWave` |
| 静寂 | `silence` | `drawStock`のリセット時、取れる場札が無かったら、めくった札を今ウェーブ内で即ワイルド化し、`deckComposition`の非ワイルド1枚もランダムにワイルドへ変換(引き継ぎ) | `drawStock` |
| 不屈 | `resilience` | 手詰まり判定時、`discardPile`が1枚以上あれば現在スコアの`p`%を消費し、`discardPile`の半数(端数切り上げ、最低1枚)をランダムに`stock`へ戻す | `applyStuckCheck` |

`resilience`のみ数値パラメータを持つ: `talismans.resilience: { p: number }`(既定値: 仮に30)。永劫・豊穣・静寂は無条件の固定効果のため`talismans`エントリ不要。

### 2.1 静寂の詳細

`drawStock`のリセット分岐において、「取れる場札が無い」(`getPlayableColumns(...).size === 0`、リセット後のfoundation=めくった札を基準に判定)場合のみ発動する。

- 今ウェーブでの即時効果: リセットして新しいfoundation/chainになる、めくった札自体の`wild`を`true`にする(この一枚は以後このウェーブ中ずっとワイルドとして扱われる)
- 永続効果: `deckComposition`の別の(ランダムな)非ワイルド1枚をワイルドに変換する。「めくった特定の1枚を次ウェーブ以降も追跡する」のではなく、他の護符と同じ「デッキ全体のワイルド比率が1枚分増える」という近似で扱う

### 2.2 不屈の詳細

`applyStuckCheck`の処理順序を以下に変更する:

1. `isStuck(modifier, wave)`が`false`なら何もしない(現状通り)
2. `true`の場合、`items.includes('resilience')`かつ`wave.discardPile.length > 0`なら:
   - `reviveCount = Math.max(1, Math.ceil(wave.discardPile.length / 2))`
   - `discardPile`からランダムに`reviveCount`枚を選んで`stock`の末尾に追加し、`discardPile`から取り除く
   - `score`から`Math.floor(score * params.talismans.resilience.p / 100)`を減算する
   - この時点で`stock.length > 0`になるため、`isStuck`は次の判定で自動的に`false`を返すようになる(再帰的に呼び直す必要はなく、この復活処理を挟んだ後は`markStuck`を呼ばずそのまま返す)
3. 復活条件を満たさない場合は、現状通り`markStuck(wave)`を返す

`applyStuckCheck`に`rand: () => number = Math.random`引数を追加し、ランダム選択のテスト容易性を確保する(既存の`rollItemOffer`と同じパターン)。

## 3. 既存システムへの影響

- `types.ts`: `DeckCard`型の新規追加、`RunState.deckComposition`・`WaveState.discardPile`フィールド追加
- `deck.ts`: `standardDeckComposition()`追加(既存の`createDeck`は変更なし)
- `engine.ts`:
  - `startWave`のシグネチャ・戻り値変更(呼び出し元5箇所すべて要修正)
  - `drawStock`のリセット分岐に捨て札への追加処理、静寂の即時ワイルド化処理を追加
  - `applyStuckCheck`に不屈の復活処理を追加、`rand`引数を追加
  - `ItemId`に`eternity`・`abundance`・`silence`・`resilience`を追加
  - `ITEM_NAMES`・`itemDesc`に4個分追加(`ITEM_EFFECTS`には追加しない)
  - `ITEM_POOL`に4個追加
- `params.ts`・`shidasu.config.json`: `talismans.resilience: { p: number }`を追加(他3個はパラメータ不要)
- `engine.test.ts`: `startWave`を直接呼んでいる既存テスト(159〜189行目付近)が新シグネチャに合わせて修正が必要

## 4. スコープ外

- グループ9・10・11・12・14・15・16の残り20個(今回の4個以外)
- 資源操作系の残り3個(約束・暗雲・再生) — 山札の直接操作は必要だが、永続デッキ構成には依存しないため、次サイクルで扱う
- `deckComposition`の変化を目に見える形でUI表示すること(現時点では内部状態のみ)
- 静寂で変換された「特定の1枚」を正確に追跡する精密なモデル(既存のワイルド解釈方針と同じ「都合よい近似」で扱う)

## 5. 受け入れ基準

1. `beginRun`で標準52枚から開始し、ウェーブを重ねても`deckComposition`が正しく持続する
2. 永劫を所持した状態でウェーブを開始するたび、次ウェーブの山札構成に使われる`deckComposition`の枚数が1つ増える
3. 豊穣を所持した状態でウェーブを開始するたび、`deckComposition`内の非ワイルド枚数が1つ減り、ワイルド枚数が1つ増える(合計枚数は変わらない)
4. 静寂は、取れる場札がない状態でのリセット時のみ発動し、めくった札がそのウェーブ内で即ワイルドとして振る舞う
5. `drawStock`のリセットのたびに、直前のチェーンの札が`discardPile`に追加される(ウェーブを跨ぐと空にリセットされる)
6. 不屈を所持し、手詰まり(山札0・取れる場札なし)かつ`discardPile`が1枚以上ある場合、スコアが`p`%減算され、`discardPile`の約半数が`stock`に戻り、手詰まり状態が解消される
7. 不屈を所持していても`discardPile`が空なら、通常通り手詰まりとして扱われる
8. `npm run test`・`npm run build`が成功する
