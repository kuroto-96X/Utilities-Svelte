# revelationEffects.ts applyRevelationEffect Record化リファクタ 設計

> 対象: `src/lib/game/shidasu/revelationEffects.ts`の`applyRevelationEffect`(28ケースのswitch文)を、`riteEffects.ts`の`applyRiteEffect`で直前に実施済みのRecord化リファクタと同じ方針で置き換える。個々の`convertXxx`・`wildifyXxx`等の実装は一切変更しない。純粋なリファクタであり挙動は一切変更しない。

## 背景・目的

直前のリファクタで`riteEffects.ts`の`applyRiteEffect`をswitch文から`Record<RiteId, RiteHandler>`ディスパッチへ置き換え、その際に次回候補として`revelationEffects.ts`の`applyRevelationEffect`を記録した。今回はそれを回収する。

`applyRevelationEffect`は`RevelationId`(28種)全てをカバーするswitch文で、内訳を精査すると以下の3グループに分かれる。

- **no-op重複が9ケース**(`kyo`・`subaru`・`ryuu`・`hotori`・`chou`・`yoku`・`mitsu`・`karasu`・`oni`): Phase B天啓(即時報酬獲得系)は`engine.ts`の`grantRevelationReward`側で処理するため、`applyRevelationEffect`では全て同一の`{ wave, deckComposition }`を返すだけの完全なリテラル重複になっている。
- **`targetCol === null`ガードの重複が9ケース**(`kaku`・`kou`・`tei`・`bou`・`gyu`・`jo`・`aya`・`shitsu`・`hitsu`): 列選択必須の天啓(`revelationNeedsTarget`が`true`を返す9種と完全一致)で、いずれも`targetCol === null ? { wave, deckComposition } : convertXxx(wave, deckComposition, targetCol, ...)`という同一形のガード文が繰り返されている。
- **ガード無しで直接呼ぶだけの10ケース**(`shin`・`bi`・`ki`・`to`・`heki`・`kei`・`rou`・`i`・`shi`・`sei`): 列選択が不要で、対応する`convertXxx`/`wildifyXxx`関数を直接呼ぶだけ。

`riteEffects.ts`のリファクタと同様、個々のヘルパー関数(`convertColumnToSuit`・`wildifyExtremeRanks`など)の実装は一切変更しない。ディスパッチ層のみをRecordに置き換え、no-opケースの完全一致リテラルは単一の共有ハンドラで解消する。

## 方針(スコープ)

`revelationEffects.ts`の`applyRevelationEffect`のみを対象とする。

`revelationNeedsTarget`(別のswitch、28ケース中9ケースのみ`true`を返し残りは`default: false`)は対象外のまま維持する。これは`riteEffects.ts`の`canUseRite`(24ケース中7ケースのみ条件あり、残りは`default: true`)と同じ理由——Record化すると28キー全てに明示的な`true`/`false`を書く必要があり、現状の`default`の方が簡潔なため。

`canUseRevelation`(`kyo`・`oni`のみ特別扱いする別関数)も同様の理由で対象外とする。

## 技術設計

`revelationEffects.ts`内、`applyRevelationEffect`関数の直前に、統一シグネチャの型エイリアス`RevelationHandler`・共有no-opハンドラ`noop`・`Record<RevelationId, RevelationHandler>`を追加する。

```ts
type RevelationHandler = (
  wave: WaveState,
  deckComposition: DeckCard[],
  targetCol: number | null,
  params: ShidasuParams,
  rand: () => number
) => { wave: WaveState; deckComposition: DeckCard[] }

const noop: RevelationHandler = (wave, deckComposition) => ({ wave, deckComposition })

const REVELATION_HANDLERS: Record<RevelationId, RevelationHandler> = {
  kaku: (wave, deckComposition, targetCol) =>
    targetCol === null ? { wave, deckComposition } : convertColumnToSuit(wave, deckComposition, targetCol, '♠'),
  kou: (wave, deckComposition, targetCol) =>
    targetCol === null ? { wave, deckComposition } : convertColumnToSuit(wave, deckComposition, targetCol, '♥'),
  tei: (wave, deckComposition, targetCol) =>
    targetCol === null ? { wave, deckComposition } : convertColumnToSuit(wave, deckComposition, targetCol, '♦'),
  bou: (wave, deckComposition, targetCol) =>
    targetCol === null ? { wave, deckComposition } : convertColumnToSuit(wave, deckComposition, targetCol, '♣'),
  shin: (wave, deckComposition) => convertTableauSuit(wave, deckComposition, '♠', '♥'),
  bi: (wave, deckComposition) => convertTableauSuit(wave, deckComposition, '♥', '♣'),
  ki: (wave, deckComposition) => convertTableauSuit(wave, deckComposition, '♣', '♦'),
  to: (wave, deckComposition) => convertTableauSuit(wave, deckComposition, '♦', '♠'),
  gyu: (wave, deckComposition, targetCol, _params, rand) =>
    targetCol === null ? { wave, deckComposition } : convertColumnToRandomRank(wave, deckComposition, targetCol, [1, 2, 3, 4, 5, 6, 7, 8, 9, 10], rand),
  jo: (wave, deckComposition, targetCol, _params, rand) =>
    targetCol === null ? { wave, deckComposition } : convertColumnToRandomRank(wave, deckComposition, targetCol, [11, 12, 13], rand),
  kyo: noop,
  aya: (wave, deckComposition, targetCol) =>
    targetCol === null ? { wave, deckComposition } : addWildToColumnTop(wave, deckComposition, targetCol),
  shitsu: (wave, deckComposition, targetCol) =>
    targetCol === null ? { wave, deckComposition } : convertColumnChainFromLeft(wave, deckComposition, targetCol),
  heki: (wave, deckComposition) => convertTableauSuitCycle(wave, deckComposition),
  kei: (wave, deckComposition) => stairAlignTopCards(wave, deckComposition),
  rou: (wave, deckComposition) => discardColumnTops(wave, deckComposition),
  i: (wave, deckComposition, _targetCol, _params, rand) => wildifyExtremeRanks(wave, deckComposition, rand),
  hitsu: (wave, deckComposition, targetCol, _params, rand) =>
    targetCol === null ? { wave, deckComposition } : convertColumnToStair(wave, deckComposition, targetCol, rand),
  shi: (wave, deckComposition) => wildifyChainTop(wave, deckComposition),
  sei: (wave, deckComposition, _targetCol, params, rand) => wildifyRandomTableauCards(wave, deckComposition, params.revelations.sei.n, rand),
  subaru: noop,
  ryuu: noop,
  hotori: noop,
  chou: noop,
  yoku: noop,
  mitsu: noop,
  karasu: noop,
  oni: noop,
}

export function applyRevelationEffect(
  params: ShidasuParams,
  wave: WaveState,
  deckComposition: DeckCard[],
  revelationId: RevelationId,
  targetCol: number | null,
  rand: () => number
): { wave: WaveState; deckComposition: DeckCard[] } {
  return REVELATION_HANDLERS[revelationId](wave, deckComposition, targetCol, params, rand)
}
```

`Record<RevelationId, RevelationHandler>`という型注釈により、`RevelationId`(28種)のいずれかのキーが欠けた場合にTypeScriptがコンパイルエラーを出す。これは`riteEffects.ts`のリファクタで得られたのと同じ利点をこのファイルにも適用する。

使わない引数(`_params`・`_targetCol`)にはアンダースコアプレフィックスを付ける。この命名規則は`riteEffects.ts`の`RITE_HANDLERS`で既に使われている慣例をそのまま踏襲する。

## テスト

- 純粋なディスパッチ層の置き換えのため、既存の`revelationEffects.test.ts`・`engine.test.ts`(天啓使用関連のテストを含む)を無修正のまま実行し、全てグリーンであることを確認する。これが本リファクタの正しさの根拠になる。
- 新規追加する`REVELATION_HANDLERS`自体への直接のユニットテスト追加はスコープ外とする(YAGNI、既存の経由テストで十分な回帰保証がある。これまでのリファクタと同じ方針)。

## スコープ外

- `revelationNeedsTarget`のswitch文(Record化するとむしろ冗長になるため見送り)
- `canUseRevelation`(`kyo`・`oni`のみ特別扱いする別関数、Record化の対象ではない)
- ゲームの挙動変更(本リファクタは純粋なリファクタであり一切の挙動変更を行わない)
