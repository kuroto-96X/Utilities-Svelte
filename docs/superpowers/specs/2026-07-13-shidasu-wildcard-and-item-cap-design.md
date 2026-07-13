# Shidasuのワイルドロジック刷新+護符所持上限・交換システム

## 0. 背景・目的

`docs/shidasu-current-rules.md`には、2026-07-13の会話で決定済みだが未実装の仕様が複数「⚠️ 未実装の変更点」として記録されている。本設計は、これらのギャップを解消し、ドキュメントと実装を一致させることを目的とする。あわせて、護符の所持上限(5枚)と、上限到達時の交換UIを新規実装する。

## 1. スコアリング・ワイルドロジックの変更

### 1.1 同スート/同色パターンボーナスの発動条件変更

- `evaluateChainBonus`内の同スート/同色判定に、「チェーン内の実カードが3枚以上」という条件を追加する。
- 新しい設定値`scoring.suitColorMinLen`(既定値`3`)を`ShidasuParams`・`shidasu.config.json`・管理画面に追加する。
- `analyzeSuitColor`自体は変更しない(既にワイルドを除外して実カードのみで`suitHeld`/`colorHeld`を判定する仕様のため)。呼び出し側(`evaluateChainBonus`)で`realIncludingThis.length >= suitColorMinLen`を追加条件として組み合わせる。

### 1.2 ★同スートボーナス(wildSuitBonus)の廃止

- `evaluateChainBonus`内の`if (prevIsWild) { ... } else { ... }`という分岐を削除し、`prevIsWild`に関わらず常に同スート/同色判定(1.1の3枚以上条件を含む)を実行する。
- `scoring.wildSuitBonus`を`ShidasuParams`・`DEFAULT_PARAMS`・`shidasu.config.json`・管理画面(`admin/shidasu/+page.svelte`)から削除する。
- `parts`配列に含まれていた`★同スート+100`という表示文言も無くなる(通常の`同スート+100`/`同色+50`、あるいは3枚未満で無し、のいずれかになる)。

### 1.3 同ランクボーナスへのワイルド算入

- `countSameRankBefore`の引数を`realCardsBefore: Card[]`から`chainBefore: Card[]`(ワイルドを含む)に変更する。
- 戻り値を「`chainBefore`内で指定ランクと一致する実カードの枚数」+「`chainBefore`内のワイルド枚数(ランク不問で全てカウント)」の合計にする。
- 呼び出し側(`evaluateChainBonus`)は`realBefore`ではなく`chainBefore`をそのまま渡すよう変更する。

### 1.4 パターン継続(`chainContinuesPattern`)の全面書き換え

現状の「めくる前のチェーンの状態から、新しい札単体の継続可否を判定する」実装を、「めくった後のチェーン全体に対して`analyzeSuitColor`/`analyzeStair`を直接実行し、パターンボーナスの成立条件を満たすかどうか」で判定する実装に置き換える。

```ts
export function chainContinuesPattern(
  scoring: ShidasuParams['scoring'],
  chain: Card[],
  card: Card,
  stairMinLen: number = scoring.stairMinLen
): boolean {
  const chainIncludingThis = [...chain, card]

  const { suitHeld, colorHeld } = analyzeSuitColor(chainIncludingThis)
  const realCount = chainIncludingThis.filter(c => !c.wild).length
  if (realCount >= scoring.suitColorMinLen && (suitHeld || colorHeld)) return true

  const stairInfo = analyzeStair(chainIncludingThis)
  if (stairInfo.held && stairInfo.dir !== 0 && stairInfo.len >= stairMinLen) return true

  return false
}
```

- 第4引数`stairMinLen`は、呼び出し元(`drawStock`)が「架橋の護符」所持時は`params.items.stairRelaxedMinLen`、未所持時は`params.scoring.stairMinLen`を渡す(`playCard`における`effectiveStairMinLen`と同じ計算)。
- この書き換えにより、「めくった札が新たに条件を満たす場合も継続扱いになる」「ワイルドを引いた場合も同じ条件で判定される(無条件継続ではなくなる)」という`shidasu-current-rules.md`4.6節の仕様が自然に満たされる(`analyzeSuitColor`/`analyzeStair`は共にワイルドを許容する既存実装のため)。
- `drawStock`のワイルド分岐(`if (card.wild) { ... 常にlinked:true ... }`)は削除し、ワイルドも通常の`chainContinuesPattern`判定を経由する1つの分岐に統合する。ただし`lastDrawEffect`は、ワイルドを引いた場合は`'wild'`、それ以外のパターン継続では`'pattern'`を設定する(判定ロジックは共通化しつつ、演出用のフラグ分けは維持する)。

### 1.5 影響を受けないもの(変更不要)

- `checkFlush`・`checkRoyalSet`・`checkCompleteRun`: 既にワイルドの穴埋めロジックが実装済みで、今回の方針と整合しているため変更しない。
- `analyzeStair`・`isPlayable`: 既にワイルドを「都合よく継続する/常に取得可能」として扱っており、変更不要。

## 2. 護符所持上限(5枚)+交換システム

### 2.1 データモデル

- `ShidasuParams.items.maxItems`(既定値`5`)を追加する。
- `RunState`に`pendingNewItem: ItemId | null`を追加する(交換待ちの新護符を一時保持する)。`createInitialRun`・`beginRun`では`null`で初期化する。

### 2.2 新規・変更するengine関数

- `pickItem(params, run, itemId, seed?)`:
  - `run.items.length < maxItems`の場合: 従来通り即座に護符を追加してウェーブを進める。
  - `run.items.length >= maxItems`の場合: ウェーブを進めず、`pendingNewItem: itemId`をセットするのみ(`phase`は`itemSelect`のまま、`offer`も維持)。
- `confirmItemSwap(params, run, oldItemId, seed?)`(新規): `run.pendingNewItem`が設定されている場合のみ動作。`oldItemId`を`items`から削除し、`pendingNewItem`を追加し、`pendingNewItem`を`null`に戻して次のウェーブへ進む(`pickItem`の即時反映パスと同じ後処理)。
- `cancelItemSwap(run)`(新規): `pendingNewItem`を`null`に戻すのみ。`phase`・`offer`は変更しない(最初の選択肢一覧に戻る)。
- `skipItemSelect(params, run, seed?)`(新規): `phase !== 'itemSelect'`なら何もしない。護符を追加せずにウェーブを進める(`pickItem`の即時反映パスから「護符追加」を除いたもの)。
- `resolveWaveEnd`: `itemSelect`フェーズに遷移する際、`pendingNewItem: null`を明示的にセットする(念のための初期化)。

### 2.3 UI(`+page.svelte`)

アイテム選択画面(`run.phase === 'itemSelect'`)を、`run.pendingNewItem`の有無で2ステップに分岐する:

- **ステップ1(`pendingNewItem === null`)**: 現状の護符オファー一覧(最大3件)に加え、「取得しない」ボタンを新設する(`skipItemSelect`を呼ぶ)。
- **ステップ2(`pendingNewItem !== null`)**: 現在所持している護符(最大5件)を一覧表示し、いずれかをクリックすると`confirmItemSwap`を呼ぶ。「戻る」ボタンを設置し、`cancelItemSwap`を呼んでステップ1に戻れるようにする。

`rollItemOffer`自体は変更しない(所持数が上限に達していてもオファー自体は通常通り表示し、交換するかどうかはプレイヤーが選ぶため)。

## 3. スコープ外

- 護符の並べ替えUI(`docs/shidasu-roadmap.md`項目6に記載済みの別課題)
- ワイルドカードを山札に供給する新規アイテムの実装(現状ワイルドの供給源が無いため、本設計の変更は全て「将来供給されたときに正しく機能する」先行実装のままとなる。1.1〜1.4の同スート/同色/同ランクの変更は、ワイルドを介さない通常プレイでも直接影響する。特に1.1(3枚以上条件)と1.4(階段の長さ閾値をパターン継続にも適用)は、ワイルドの有無に関わらず現在のプレイ感を変える点に注意)

## 4. 受け入れ基準

1. `evaluateChainBonus`で、実カード2枚の同スートチェーンに3枚目の同スートカードを追加すると、その時点で初めて`同スート+100`が加算される(2枚目では加算されない)
2. `wildSuitBonus`・`★同スート`という文言・値がコード上から完全に削除されている(`ItemId`同様、`grep`で残存ゼロを確認)
3. 同ランクボーナスの計算で、チェーン内にワイルドが含まれる場合、そのワイルドの枚数分がランクを問わず加算される(ユニットテストでワイルドを含むチェーンを構築して検証)
4. `chainContinuesPattern`が、めくった後のチェーンを基準に判定するようになっており、めくった札が新たに3枚以上/最小連続枚数以上を満たす場合も継続扱いになる
5. ワイルドを引いた場合、めくる前のチェーンでパターンボーナスが成立していなければコンボがリセットされる(現行の無条件継続から変更されている)
6. 護符を5枚所持している状態でウェーブをクリアすると、新護符を選んだ際に交換対象選択画面が表示され、選んだ護符と入れ替わる
7. 護符所持数が5枚未満の場合は、新護符選択時に即座に反映される(従来通り)
8. アイテム選択画面のどの状態でも「取得しない」ボタンでウェーブを進められる
9. `npm run test`・`npm run build`が成功する
