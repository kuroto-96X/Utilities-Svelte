# 得点内訳パーツの対象護符ハイライト表示 設計

## 背景・目的

Shidasu(`PlayArea.svelte`)のカードプレイ時、得点内訳アニメーション(フェーズ1: 各`ScorePart`を1つずつ中央表示してから内訳行へ飛び込む演出)では、パーツ名と加点額のみが表示され、どの護符がその加点・倍算に貢献したのかが画面上で分からない。

既に実装済みの「パターン・役の対象カードを黄色枠でハイライトする」機能([2026-08-06-shidasu-score-part-card-highlight-design.md](./2026-08-06-shidasu-score-part-card-highlight-design.md))と対になる形で、護符効果由来のパーツが中央表示されている間、対応する護符バッジを黄色枠でハイライトする。

## スコープ

- 対象パーツ: `applyItemEffects`(`src/lib/game/shidasu/itemEffects.ts`)が生成する護符効果パーツすべて。`gained`チャンネル(通常の取得点への加算・倍算)・`clearBonus`チャンネル(列一掃・全消しボーナス)の両方
- 水鏡(`waterMirror`)によるエコー分パーツ(左隣の護符効果をもう一度発動させて得たパーツ)は、水鏡自身をハイライト対象とする(エコー元の護符ではない)
- 対象外: 基礎点・パターン/役パーツ(既に対応済み)・コンボ倍率・マンナズ倍率・ボス得点ロック
- 対象外: ショップ・福袋中身選択画面

## データモデルの変更

### `ScorePart`に対象護符IDを追加

`src/lib/game/shidasu/scoreParts.ts`の`ScorePart`に、任意フィールド`itemId`を追加する。

```ts
export interface ScorePart {
  label: string
  kind: 'add' | 'multiply' | 'lock'
  amount: number
  text: string
  cardIds?: number[] // ハイライト対象カードのCard.id一覧(パターン・役パーツ用)
  itemId?: ItemId // ハイライト対象護符のID(護符効果パーツ用)
}
```

`ScorePart`が`ItemId`型を参照するため、`scoreParts.ts`の先頭に`import type { ItemId } from './types'`を追加する。

### `applyItemEffects`でのitemId付与

`src/lib/game/shidasu/itemEffects.ts`の`applyItemEffects`関数内、各護符効果を実行した結果の`part`に`itemId`を後付けする。個別の護符効果関数(`cardComboEffects.ts`ほか52個の効果定義)は一切変更しない。

```ts
export function applyItemEffects(
  channel: 'gained' | 'clearBonus',
  baseValue: number,
  items: ItemId[],
  ctx: ItemEffectContext,
  params: ShidasuParams
): { value: number; parts: ScorePart[] } {
  const parts: ScorePart[] = []
  let value = baseValue
  for (let i = 0; i < items.length; i++) {
    const id = items[i]
    const entry = ITEM_EFFECTS[id]
    if (entry && entry.channel === channel) {
      const result = entry.effect(value, ctx, params)
      if (result.part) parts.push({ ...result.part, itemId: id })
      value = result.value
    }
    if (id === 'waterMirror' && i > 0) {
      const leftId = items[i - 1]
      const leftEntry = ITEM_EFFECTS[leftId]
      if (leftEntry && leftEntry.channel === channel) {
        const echoResult = leftEntry.effect(value, ctx, params)
        if (echoResult.part) parts.push({ ...echoResult.part, itemId: id }) // idはwaterMirror自身
        value = echoResult.value
      }
    }
  }
  return { value, parts }
}
```

水鏡のエコー分は`echoResult.part`に`itemId: id`(ループ変数の`id`、この時点で`'waterMirror'`)を付与するため、自然に水鏡自身が対象になる。

## UIアニメーションフロー

### PlayAreaから親コンポーネントへのハイライト通知

護符バッジUI(`itemBadges` snippet)は`PlayArea.svelte`の外(`+page.svelte`・`admin/shidasu-debug/+page.svelte`)に定義され、`extraFooter` propとして`PlayArea`に渡されている。得点内訳アニメーションの状態(`partFlyIn`)は`PlayArea.svelte`内部にあるため、両者をまたぐ通知が必要になる。

既存の`onScoreRevealDone`と同じコールバックpropsパターンを踏襲し、`PlayArea.svelte`に新しいoptional prop `onScorePartHighlight?: (itemId: ItemId | null) => void` を追加する。`startPartFlyIn`(パーツの中央表示開始)で`onScorePartHighlight?.(part.itemId ?? null)`を呼ぶ。`landPart`は毎回`partFlyIn = null`を代入してからハイライトを解除するため(次のパーツがあれば直後の`startPartFlyIn`が改めて呼ばれ、そのパーツの`itemId`で上書きされる)、`landPart`の冒頭で`onScorePartHighlight?.(null)`を呼べば、パーツが無い場合(最後のパーツ着地時)も含めて一律にハイライトが解除される。

呼び出し元(`src/routes/game/shidasu/+page.svelte`・`src/routes/admin/shidasu-debug/+page.svelte`)側で`highlightedItemId`という`$state<ItemId | null>`を持ち、`onScorePartHighlight={id => (highlightedItemId = id)}`として`PlayArea`に渡す。`itemBadges` snippetは同じファイル内で定義されているため、`highlightedItemId`をそのまま参照できる(追加の受け渡しは不要)。

### 護符バッジ側の表示

`itemBadges` snippet内、`{#each [...new Set(run.items)] as id (id)}`(または`shidasu-debug`側の`items`)のバッジ要素に、`highlightedItemId === id`の場合、黄色枠のCSSクラス(`ring-2 ring-yellow-400`。バッジ自体がカードより小さいため、カードハイライトの`ring-4`より細めにする)を条件付き適用する。

### 発火・消灯タイミング

カードハイライトと同じ方式: そのパーツが得点内訳アニメーションのフェーズ1で中央表示されている間(`partFlyIn`が該当パーツに対応する間)だけハイライトし、次のパーツに切り替わる際に消灯する(同時に2護符分のハイライトが表示されることはない)。

## テスト方針

- `scoreParts.ts`: 型定義の変更のみのため、追加の単体テストは不要(既存の`addPart`はitemIdを引数に取らないため変更なし)
- `itemEffects.ts`の`applyItemEffects`: 護符効果パーツの`itemId`が期待した`ItemId`と一致することを確認する単体テストを追加する。水鏡のエコー分パーツについても、`itemId`が`'waterMirror'`になることを確認するテストを追加する
- UI側(`PlayArea.svelte`・`+page.svelte`・`admin/shidasu-debug/+page.svelte`)のハイライト表示・消灯タイミングは、既存の得点内訳アニメーション同様、自動テストでは検証せず`npm run dev`でのブラウザ目視確認とする

## 除外・非対象

- パターン・役パーツと護符効果パーツが同一プレイで複数成立する場合、既存の順番表示(フェーズ1で1パーツずつ切り替え)の仕組みにより、カードハイライトと護符ハイライトが同時に表示されることは無い(パーツごとに独立して発火・消灯するため自然に排他になる)
- 護符効果パーツが2つ以上同じ護符に由来する場合(基本的には起こらない想定。1つの護符は1チャンネルにつき1回しか効果を発動しないため)の重複ハイライトは考慮しない
