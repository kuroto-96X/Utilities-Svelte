# Shidasu 護符候補一覧グループ1〜3の実装(全18個)

## 0. 背景・目的

`docs/shidasu-gofu-candidates.md`のグループ1〜3(合計18個)を実装する。現状の護符システムは`bridge`・`grace`の2種類のみで、それぞれの効果はエンジン内(`playCard`/`drawStock`)に直接ハードコードされている。汎用的な「護符効果パイプライン」の仕組みが無いため、今回18個をまとめて実装するのを機に、この仕組みを新規構築する(残り80個も同じ枠組みで追加していける)。

## 1. アーキテクチャ: 護符効果レジストリ

各護符IDに対して、汎用インターフェースに沿った純粋関数を1つ登録する方式を採用する。

```ts
interface ItemEffectContext {
  card: Card              // 今回プレイしたカード
  previousFoundation: Card // プレイ前のfoundation(直前のカード)。wave.foundationを更新前に渡す
  combo: number            // 今回のプレイ後のコンボ数(newCombo)
  stockRemaining: number   // 全消し時の残り山札数(clearBonusチャンネルのみ使用、他はダミー値でよい)
}

type ItemEffect = (value: number, ctx: ItemEffectContext, params: ShidasuParams) => number

const ITEM_EFFECTS: Partial<Record<ItemId, { channel: 'gained' | 'clearBonus'; effect: ItemEffect }>>
```

- `applyItemEffects(channel, baseValue, items, ctx, params)`という関数が、`items`配列(=所持順=取得順)の順に、該当チャンネルの護符効果だけを`reduce`で適用する。
- `channel: 'gained'`の護符は`playCard`内で`gained = floor(base * multiplier)`を算出した**直後**に適用する。
- `channel: 'clearBonus'`の護符は全消し分岐(`clearBonus + stock.length * clearBonusPerStock`を算出した直後)に適用する。
- 「直前のカード」は`playCard`が受け取る`wave.foundation`(更新前の値)をそのまま`previousFoundation`として渡せばよく、新規stateの追加は不要。ウェーブ開始直後の1枚目にも、配布済みのfoundationと比較する形で自然に判定される。
- 適用順は「プレイヤーの護符の並べ方」ではなく「所持順(取得した順)」に固定する。並べ替えUI(`docs/shidasu-roadmap.md`項目6)は今回のスコープ外とする。
- 数値パラメータ(n/x/c)は`ShidasuParams`に新設する`talismans: Partial<Record<ItemId, {...}>>`に格納する。既存の`items.stairRelaxedMinLen`等(所持上限・階段/列一掃の緩和専用)とは別の名前空間とし、残り80個追加時もここに追記していく。

## 2. 対象18護符の仕様

| 護符名 | id | チャンネル | 条件・数式 | 既定値 |
|---|---|---|---|---|
| 忍耐 | `patience` | clearBonus加算 | `v + 残り山札数 × x` | x=500 |
| 浄化 | `purify` | clearBonus加算 | `v + n` | n=10000 |
| 節制 | `temperance` | clearBonus倍算 | `v × (1 + 残り山札数 × x)` | x=0.1 |
| 春風 | `springBreeze` | gained加算 | ♣を取得時 `v + n` | n=100 |
| 夏風 | `summerBreeze` | gained加算 | ♦を取得時 `v + n` | n=100 |
| 秋風 | `autumnBreeze` | gained加算 | ♥を取得時 `v + n` | n=100 |
| 冬風 | `winterBreeze` | gained加算 | ♠を取得時 `v + n` | n=100 |
| 友愛 | `kinship` | gained加算 | 直前が♥以外→今回♥ `v + n` | n=200 |
| 雪解 | `thaw` | gained加算 | 直前が♠→今回♠以外 `v + n` | n=200 |
| 宵闇 | `dusk` | gained加算 | 直前が赤→今回黒 `v + n` | n=100 |
| 払暁 | `dawn` | gained加算 | 直前が黒→今回赤 `v + n` | n=100 |
| 機知 | `wit` | gained加算 | 今回のカードがワイルド `v + n` | n=200 |
| 勇気 | `courage` | gained倍算 | `v × (1 + コンボ数 × x)` | x=0.1 |
| 暁 | `daybreak` | gained倍算 | コンボ数≤c `v × x` | c=3, x=2 |
| 黄昏 | `twilight` | gained倍算 | コンボ数≥c `v × x` | c=8, x=2 |
| 快活 | `cheerful` | gained加算 | コンボ数が偶数 `v + n` | n=50 |
| 良心 | `conscience` | gained加算 | コンボ数が奇数 `v + n` | n=50 |
| 朝霧 | `morningMist` | gained倍算 | コンボ数<c: `v÷x` / コンボ数≥c: `v×x` | c=5, x=3 |

「赤」「黒」の判定は既存の`isRed`関数を使う。「ワイルドを取得」は`card.wild`を見る。

## 3. 既存システムへの影響

- `ItemId`型を`'bridge' | 'grace'`から、上記18個のidを加えた計20種類に拡張する。
- `ITEM_POOL`に18個を追加する(既存2個と合わせて計20個)。
- `ITEM_NAMES`に18個分の日本語表示名を追加する。
- `itemDesc`関数に18個分の説明文生成を追加する(`params.talismans[id]`の値を埋め込む)。
- `rollItemOffer`のロジック自体(均等ランダム抽選、最大3件提示)は変更しない。候補一覧上のレアリティ(C/U/R)は今回使用しない(重み付き抽選機構は別スコープ)。
- `params.items.maxItems`(所持上限5枚)は既存のまま。プールが20個になることで、交換UI(`confirmItemSwap`等)が初めて実プレイで到達可能になる。

## 4. スコープ外

- 護符の並べ替えUI(適用順は所持順で固定)
- レアリティに応じた重み付き抽選
- グループ4以降の残り護符の実装

## 5. 受け入れ基準

1. `ITEM_EFFECTS`に18個全ての効果が登録されており、`applyItemEffects`で正しいチャンネル・順序で適用される
2. `playCard`で複数のgained系護符を所持している場合、所持順(`items`配列の順)に適用される
3. `patience`/`purify`/`temperance`は全消し時の`clearBonus`にのみ作用し、通常プレイの`gained`には影響しない
4. 色・スート切り替え系(友愛・雪解・宵闇・払暁)は、ウェーブ開始直後の1枚目のプレイでも`wave.foundation`との比較で正しく判定される
5. `ITEM_POOL`が20個になり、`rollItemOffer`が引き続き正しく動作する(所持していない護符のみ最大3件提示)
6. `npm run test`・`npm run build`が成功する
