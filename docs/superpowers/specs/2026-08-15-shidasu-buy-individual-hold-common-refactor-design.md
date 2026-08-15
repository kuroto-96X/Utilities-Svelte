# バラ売り購入(buyIndividual)系共通化リファクタ 設計

> 対象: `src/lib/game/shidasu/engine.ts`のバラ売り購入4関数(`buyIndividualItem`/`buyIndividualRite`/`buyIndividualRevelationHold`/`buyIndividualOracleHold`)にある機械的な重複を、安全な範囲で共通化する。純粋なリファクタであり、ゲームの挙動は一切変更しない。

## 背景・目的

これまでのセッションで2回、`engine.ts`・`shop.ts`・`+page.svelte`にあった重複を共通ヘルパーに切り出すリファクタを実施した。

1. 福袋(item/rite/revelation/oracle/cardSet)のpick/confirm/cancel/close処理の共通化(`docs/superpowers/specs/2026-08-15-shidasu-pack-flow-common-refactor-design.md`)
2. 売却系4関数・価格関数6個・buy/sellハンドラ10個の共通化(`docs/superpowers/specs/2026-08-15-shidasu-sell-price-handler-common-refactor-design.md`)

2回目のセッションで、`engine.ts`のショップ購入(バラ売り、`buyIndividualXxx`)7関数は「カテゴリごとに非対称で共通化困難」として見送っていたが、今回改めて7関数を1つずつ精査した結果、以下の2グループに分かれることが分かった。

- **グループA(完全に同型、4関数)**: `buyIndividualItem`・`buyIndividualRite`・`buyIndividualRevelationHold`・`buyIndividualOracleHold`。制御フローが1行単位でほぼ完全一致しており、kind文字列・容量チェック式・価格関数・格納先フィールド名の4パラメータだけが異なる
- **グループB(本質的に非対称、3関数)**: `buyRelic`(別配列・別オブジェクト形状)・`buyIndividualRevelationUse`(wave即時適用の副作用)・`buyIndividualOracleUse`(oracleLevels/wave同期の副作用)

今回はグループAの4関数のみを対象とする。グループBは前回同様、無理に共通化すると分岐だらけになり可読性が落ちるため見送る。

## 方針(スコープ)

グループA4関数の「容量チェック→価格取得→通貨チェック→枠をsold化→対象配列へ追加して返す」という末尾処理を共通ヘルパーへ切り出す。フェーズ・shop存在ガード、枠の存在・売り切れ・kind一致チェックはカテゴリごとにそのまま残す(kind文字列自体がカテゴリを表す情報であり、これを消すとかえって読みにくくなるため)。

容量チェックの式には非対称性がある(item/riteは自分の所持配列の長さ、revelation/oracleは天啓・神託の合算所持数)。この違いは、呼び出し元で判定結果(真偽値)を計算してヘルパーに渡すことで吸収する(`sellFromArray`の`price`引数と同じ設計方針: ヘルパー自身はカテゴリ固有の計算式を知らず、渡された値をそのまま使うだけにする)。

## 技術設計

### `engine.ts`: `buyIndividualHold`共通ヘルパー

現状の4関数(`buyIndividualItem`を例に示す):

```ts
export function buyIndividualItem(params: ShidasuParams, run: RunState, slotIndex: number): RunState {
  if (run.phase !== 'shop' || !run.shop) return run
  const slot = run.shop.individual[slotIndex]
  if (!slot || slot.sold || slot.kind !== 'item') return run
  const itemId = slot.id as ItemId
  if (run.items.length >= itemMaxCapacity(params, run)) return run
  const price = itemBuyPrice(params, run, itemId)
  if (run.currency < price) return run
  const individual = run.shop.individual.map((s, i) => (i === slotIndex ? { ...s, sold: true } : s))
  return { ...run, currency: run.currency - price, items: [...run.items, itemId], shop: { ...run.shop, individual } }
}
```

以下の共通ヘルパーへ切り出す:

```ts
// バラ売り枠を1つ購入し、対象配列へ追加する共通処理。容量超過・通貨不足ならno-op(スワップは発生しない)。
// 呼び出し元は既にフェーズ・shop存在・枠のkind一致を確認済みの前提(このヘルパーはその後の
// 容量判定〜確定処理だけを担当する)。フィールドの動的キーアクセスのため戻り値をRunStateに
// キャストしている(福袋pick系・売却系リファクタのresolvePackOfferPick/sellFromArrayと同じ理由・同じパターン)。
function buyIndividualHold<T>(
  run: RunState,
  shop: ShopState,
  slotIndex: number,
  arrayField: 'items' | 'rites' | 'revelations' | 'oracles',
  arr: T[],
  value: T,
  atCapacity: boolean,
  price: number
): RunState {
  if (atCapacity) return run
  if (run.currency < price) return run
  const individual = shop.individual.map((s, i) => (i === slotIndex ? { ...s, sold: true } : s))
  return { ...run, currency: run.currency - price, [arrayField]: [...arr, value], shop: { ...shop, individual } } as RunState
}
```

呼び出し側(`buyIndividualItem`):

```ts
export function buyIndividualItem(params: ShidasuParams, run: RunState, slotIndex: number): RunState {
  if (run.phase !== 'shop' || !run.shop) return run
  const slot = run.shop.individual[slotIndex]
  if (!slot || slot.sold || slot.kind !== 'item') return run
  const itemId = slot.id as ItemId
  return buyIndividualHold(run, run.shop, slotIndex, 'items', run.items, itemId, run.items.length >= itemMaxCapacity(params, run), itemBuyPrice(params, run, itemId))
}
```

`buyIndividualRite`・`buyIndividualRevelationHold`・`buyIndividualOracleHold`も同様の形にする。`revelationHold`・`oracleHold`は`atCapacity`に`run.revelations.length + run.oracles.length >= revelationOracleMaxCapacity(params, run)`という天啓・神託合算の式を渡す(既存の非対称性をそのまま維持する)。

**技術的な注意点**: `price`引数(`itemBuyPrice`等)は呼び出し元で先に評価されるため、`atCapacity`が真の場合でも価格計算自体は必ず実行されるようになる。既存の`sellFromArray`と同じ理由で、価格関数は副作用の無い純粋な算術関数であるため結果には一切影響しない。

## テスト

- 純粋なリファクタのため、既存の`engine.test.ts`内の`buyIndividualItem`/`buyIndividualRite`/`buyIndividualRevelationHold`/`buyIndividualOracleHold`関連テストを無修正のまま実行し、全てグリーンであることを確認する。これが本リファクタの正しさの根拠になる。
- 新規ヘルパー(`buyIndividualHold`)自体への直接のユニットテスト追加はスコープ外とする(YAGNI、既存の経由テストで十分な回帰保証がある。福袋pick系・売却系リファクタと同じ方針)。

## スコープ外

- `buyRelic`・`buyIndividualRevelationUse`・`buyIndividualOracleUse`(グループB)の共通化。対象配列の型・副作用の有無が本質的に異なるため対象外
- `buyPack`(phase遷移主体の別パターン、既存で対象外判定済み)
- `+page.svelte`側の変更。今回の4関数は公開APIのシグネチャを変更しないため、対応するハンドラ(既に前回リファクタで`bindParamsRunAction`化済み)は無修正で動く
- 挙動・UIの変更(本リファクタは純粋なリファクタであり、ゲームの挙動は一切変更しない)
