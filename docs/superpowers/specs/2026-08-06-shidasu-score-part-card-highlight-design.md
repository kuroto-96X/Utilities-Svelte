# 得点内訳パーツの対象カードハイライト表示 設計

## 背景・目的

Shidasu(`PlayArea.svelte`)のカードプレイ時、得点内訳アニメーション(フェーズ1: 各`ScorePart`を1つずつ中央表示してから内訳行へ飛び込む演出)では、「同スート+20」のようにパーツ名と加点額だけが表示され、どのカードがその役・パターンの成立に貢献したのかが画面上で分からない。

パターン(同スート・同色・階段)・役(フラッシュ・ロイヤル・同ランク・コンプリートラン)のパーツが中央表示されている間、対象となったチェーン内カードを黄色枠でハイライトし、得点の根拠を視覚的に示す。

## スコープ

- 対象パーツ: 同スート・同色・階段・フラッシュ・ロイヤル・同ランク・コンプリートラン(コンプリートランの同スート追加分を含む)の7種
- 対象外: 基礎点・護符効果によるパーツ(加算/倍算問わず)・コンボ倍率・マンナズ倍率・ボス得点ロック。これらは対象カードの概念が無い、または特定の1枚に紐付かないため従来通り枠なしで表示する
- 対象外: 山札めくり(`applyDrawStock`)経由の得点表示。既存specの通り、この経路はUIアニメーション自体が対象外
- 対象外: ショップ・福袋中身選択画面

## データモデルの変更

### `ScorePart`に対象カードID一覧を追加

`src/lib/game/shidasu/scoreParts.ts`の`ScorePart`に、任意フィールド`cardIds`を追加する。

```ts
export interface ScorePart {
  label: string
  kind: 'add' | 'multiply' | 'lock'
  amount: number
  text: string
  cardIds?: number[] // ハイライト対象カードのCard.id一覧。対象カードが無いパーツ(基礎点・護符効果等)では省略する
}
```

`addPart`に第3引数`cardIds?: number[]`を追加する(既存の52箇所の呼び出しは全て省略可能なので無変更のまま動作する)。

```ts
export function addPart(label: string, amount: number, cardIds?: number[]): ScorePart {
  return { label, kind: 'add', amount, text: `${label}+${amount}`, cardIds }
}
```

`multiplyPart`・`lockPart`は変更しない(対象パーツは全て加算型のため)。

### `evaluateChainBonus`での対象カード算出

`src/lib/game/shidasu/patterns.ts`の`evaluateChainBonus`内、各パーツ生成箇所で対象カードの`id`配列を算出し`addPart`に渡す。`chainIncludingThis = [...chainBefore, card]`という既存の変数をそのまま使う。

| パーツ | 対象カード範囲 |
|---|---|
| 同スート | `chainIncludingThis`全体 |
| 同色 | `chainIncludingThis`全体 |
| 階段N | `chainIncludingThis`全体(`analyzeStair`の`len`は常に`chainIncludingThis.length`と一致するため、末尾`stairInfo.len`枚=チェーン全体になる) |
| フラッシュ | `chainIncludingThis`の末尾4枚 |
| ロイヤル | `chainIncludingThis`の末尾3枚 |
| 同ランク | `chainBefore`のうち`c.rank === card.rank`(実カード)または`c.wild`(ワイルド)に該当するもの全部 + 今回の`card` |
| コンプリートラン | `chainIncludingThis`全体 |
| コンプリートラン(同スート) | `chainIncludingThis`全体(コンプリートラン本体と同じ範囲) |

カードIDはすべて`Card.id`(ウェーブごとに振り直される一時的な連番、`chain`配列内の実体と一致)を使う。

## UIアニメーションフロー

### ハイライトの発火・消灯タイミング

`PlayArea.svelte`のフェーズ1(`startPartFlyIn`)で、中央表示中の`partFlyIn`が対応する`ScorePart`(`scoreReveal.parts[index]`)が`cardIds`を持つ場合、そのidに該当するチェーン内カードへ黄色枠を適用する。対象パーツの中央表示中(`phase: 'center'`)から内訳行への移動完了(`landPart`呼び出し)まで枠を表示し続け、次のパーツに移る際に消灯する(同時に2パーツ分の枠が表示されることはない)。

実装は、現在ハイライト対象の`cardIds`を保持するローカル変数(例: `highlightedCardIds: Set<number>`)を`startPartFlyIn`/`landPart`で更新し、チェーン表示ループ(`chainEntries`を`{#each}`する箇所、既存の`data-chain-card-id`属性を持つ要素)で、この時点の`entry.card.id`が含まれていれば黄色枠のCSSクラスを付与する形にする。`CardFace.svelte`自体は変更せず、チェーン表示ループ内で`CardFace`を囲むラッパー要素にクラスを追加する。

### パーツ数1件(基礎点のみ)の場合

既存仕様通り順番表示自体をスキップするため、ハイライトも発生しない(基礎点はそもそも対象外パーツ)。

## テスト方針

- `scoreParts.ts`: `addPart`が`cardIds`引数を省略した場合`undefined`になり、渡した場合はそのまま`ScorePart.cardIds`に反映されることを確認する単体テストを追加
- `patterns.ts`の`evaluateChainBonus`: 既存の役・パターン成立テストに、対象パーツの`cardIds`が期待した`Card.id`集合と一致することを確認するアサーションを追加する(既存テストケースの拡張。新規シナリオは不要)
- UI側(`PlayArea.svelte`)のハイライト表示・消灯タイミングは、既存の得点内訳アニメーション同様、自動テストでは検証せず`npm run dev`でのブラウザ目視確認とする

## 除外・非対象

- 護符効果由来のパーツ(春風・友愛・宵闇など)へのハイライト拡張は本designの対象外(将来的に必要になれば別途design化する)
- 複数パーツが同一カードを対象にする場合(例: 同スートとフラッシュが同時に成立し、末尾4枚が両方に含まれる)の重複ハイライトは、パーツごとに独立して枠を切り替える現行方式でそのまま自然に処理される(同時表示ではなく順番表示のため、見た目上の重なりは発生しない)
