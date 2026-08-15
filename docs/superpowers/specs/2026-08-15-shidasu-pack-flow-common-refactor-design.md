# 福袋pick/confirm/cancel/closeフロー共通化リファクタ 設計

> 対象: `src/lib/game/shidasu/engine.ts`と`src/routes/game/shidasu/+page.svelte`にある、福袋(護符item・秘儀rite・天啓revelation・神託oracle・カードセットcardSet)5カテゴリ分の`pickPack*`/`confirmPack*Swap`/`cancelPack*Swap`/`closePack*Select`関数群に見られる機械的な重複を、安全な範囲で共通化する。純粋なリファクタであり、ゲームの挙動は一切変更しない。

## 背景・目的

`engine.ts`は1811行まで肥大化しており、`src/lib/game/shidasu/`配下で突出して大きい(次点のparams.tsは532行)。肥大化の主因は、福袋開封のpick/confirm/cancel/closeフローが5ジャンル分ほぼ同型で横に並んでいることにある。`src/routes/game/shidasu/+page.svelte`(1208行)も、これらをそのまま呼ぶだけの1行ハンドラが5ジャンル分並んでおり、同じ構造的重複を抱えている。

過去には逆方向のリファクタ(`triggerSabotage`・`applyRiteEffect`・`applyRevelationEffect`のswitch文を個別関数+Recordディスパッチへ分解)が実施されている(`docs/superpowers/specs/2026-08-14-shidasu-sabotage-effects-refactor-design.md`)。今回は「個別関数・ハンドラが並びすぎている」重複を解消する方向で、既存のリファクタとは別の切り口になる。

## 方針(スコープ)

5カテゴリを調査した結果、複雑さにばらつきがあることが分かった。

- item・rite: 単一の所持配列、単純なスワップ
- revelation・oracle: 天啓と神託は所持上限(`revelationOracleMaxCapacity`)を共有しており、スワップ時に相手側カテゴリの配列を操作する必要がある(`confirmPackRevelationSwap`が`target.kind === 'oracle'`のケースで`run.oracles`を操作するなど)。加えて「即時使用(use)」「温存(hold)」の2モードがある
- cardSet: スワップ自体が存在しない(選択即確定、所持枠の概念が無い)

このため、5カテゴリを1つの汎用関数に完全統合する(容量チェック・スワップ相手解決まで含めて統一する)アプローチは、複雑な設定オブジェクトを新たに生む割に見通しが良くならないと判断し不採用とした。代わりに、**5カテゴリすべてで完全に同一構造になっている末尾処理(オファー配列からの除去+残数管理+shop遷移、および選択放棄時のリセット処理)だけを共通ヘルパーに切り出す**。容量チェック・スワップ相手の解決・use/holdの2モードなど、カテゴリごとに本質的に異なるロジックは今まで通り個別関数に残す。

`+page.svelte`側は、`run = xxxFn(...)`だけの1行ハンドラをファクトリ関数経由の生成に置き換える。天啓関連ハンドラの一部(`syncRevelationPreviewWithPhase()`の追加呼び出しや列選択判定を伴うもの)は個別ロジックを持つため対象外とする。

## 技術設計

### `engine.ts`: `resolvePackOfferPick`共通ヘルパー

現状、5つの`resolvePackXxxPick`内部関数がある。比較すると2つの流儀が混在している。

- item(`resolvePackItemPick`)・rite(`resolvePackRitePick`): 所持配列の更新(`newItems`/`newRites`)を引数で受け取り、関数内で`{ ...run, items: newItems, ... }`のように書き込む
- revelation(`resolvePackRevelationPick`)・oracle(`resolvePackOraclePick`): 所持配列の更新は呼び出し元が`run`へ事前にマージしてから渡す(例: `resolvePackRevelationPick({ ...run, revelations: [...run.revelations, revelationId] }, revelationId)`)。関数自体はオファー配列と`offerPickRemaining`だけを見る

統一後はrevelation/oracle方式(所持側の更新はこのヘルパーの関心事にしない)に揃える。これにより、このヘルパーは「オファー配列から該当エントリを除去し、`offerPickRemaining`をデクリメントし、0以下になれば`phase: 'shop'`へ戻す」という一点にだけ責任を持つ。

```ts
// 福袋の残り選択が1件確定した後の共通処理。オファー配列からmatchesに一致する最初の1件を除去し、
// offerPickRemainingをデクリメントし、0以下になればphase: 'shop'へ戻る。
// 所持側の更新(rites/items/revelations/oracles等)は呼び出し元がrunへ事前にマージしてから渡すこと
// (このヘルパー自身は所持側には一切関知しない)。
// オファー配列・pendingフィールドの参照はRunStateの動的キーアクセスになるため、戻り値をRunStateに
// キャストしている(呼び出し元は5箇所の固定パターンに限定されるため、型安全性は呼び出し側のテストで担保する)。
function resolvePackOfferPick<T>(
  run: RunState,
  offerField: 'offer' | 'riteOffer' | 'revelationOffer' | 'oracleOffer' | 'cardSetOffer',
  pendingField: 'pendingNewItem' | 'pendingNewRite' | 'pendingNewRevelation' | 'pendingNewOracle' | null,
  offer: T[],
  matches: (entry: T) => boolean
): RunState {
  const idx = offer.findIndex(matches)
  const newOffer = idx === -1 ? offer : [...offer.slice(0, idx), ...offer.slice(idx + 1)]
  const offerPickRemaining = run.offerPickRemaining - 1
  const pendingUpdate = pendingField ? { [pendingField]: null } : {}
  if (offerPickRemaining <= 0) {
    return { ...run, ...pendingUpdate, phase: 'shop', [offerField]: [], offerPickRemaining: 0 } as RunState
  }
  return { ...run, ...pendingUpdate, [offerField]: newOffer, offerPickRemaining } as RunState
}
```

呼び出し例(rite、所持配列の更新を事前マージする形に変更する):

```ts
export function pickPackRite(params: ShidasuParams, run: RunState, riteId: RiteId): RunState {
  if (run.phase !== 'riteSelect' || !run.riteOffer.includes(riteId)) return run
  if (run.rites.length >= riteMaxCapacity(params, run)) {
    return { ...run, pendingNewRite: riteId }
  }
  return resolvePackOfferPick({ ...run, rites: [...run.rites, riteId] }, 'riteOffer', 'pendingNewRite', run.riteOffer, id => id === riteId)
}
```

cardSetは比較がid一致ではなく`genreId`フィールド一致になる点も、`matches`コールバックで自然に吸収できる(`offer.findIndex(o => o.genreId === pickedGenreId)`)。

### `engine.ts`: `closePackOfferSelect`共通ヘルパー

現状4つある`closePackXxxSelect`(item/rite/revelation/oracle、いずれもフィールド名が違うだけで構造は同一)を統合する。cardSetは`pendingXxx`フィールードを持たないため、`pendingField`は省略可能にする。

```ts
// 福袋の残りの選択を放棄してshopへ戻る共通処理。
function closePackOfferSelect(
  run: RunState,
  offerField: 'offer' | 'riteOffer' | 'revelationOffer' | 'oracleOffer' | 'cardSetOffer',
  pendingField: 'pendingNewItem' | 'pendingNewRite' | 'pendingNewRevelation' | 'pendingNewOracle' | null
): RunState {
  const pendingUpdate = pendingField ? { [pendingField]: null } : {}
  return { ...run, ...pendingUpdate, phase: 'shop', [offerField]: [], offerPickRemaining: 0 } as RunState
}
```

呼び出し例:

```ts
export function closePackRiteSelect(run: RunState): RunState {
  if (run.phase !== 'riteSelect') return run
  return closePackOfferSelect(run, 'riteOffer', 'pendingNewRite')
}

export function closePackCardSetSelect(run: RunState): RunState {
  if (run.phase !== 'cardSetSelect') return run
  return closePackOfferSelect(run, 'cardSetOffer', null)
}
```

いずれの`pickPackXxx`/`confirmPackXxxSwap`/`cancelPackXxxSwap`/`closePackXxxSelect`エクスポート関数も、シグネチャ・フェーズガード・容量チェック・スワップ解決ロジックはそのまま残す。変わるのは末尾の共通処理呼び出しだけであり、この変更はすべて`engine.ts`内部で完結する(公開APIのシグネチャは一切変わらないため、`+page.svelte`側の呼び出しは無修正で動く)。

### `+page.svelte`: `bindRunAction`系ファクトリ

`+page.svelte`のハンドラのうち、`run = xxxFn(run, arg)`または`run = xxxFn(params, run, arg)`だけで完結するもの(追加の副作用呼び出しが無いもの)をファクトリ経由の生成に置き換える。

```ts
function bindRunAction<TArg>(fn: (run: RunState, arg: TArg) => RunState): (arg: TArg) => void {
  return (arg: TArg) => { run = fn(run, arg) }
}
function bindRunActionNoArg(fn: (run: RunState) => RunState): () => void {
  return () => { run = fn(run) }
}
function bindParamsRunAction<TArg>(fn: (params: ShidasuParams, run: RunState, arg: TArg) => RunState): (arg: TArg) => void {
  return (arg: TArg) => { run = fn(params, run, arg) }
}
```

対象(調査の結果、16ハンドラが該当する):

- item: `handlePickPackItem`(`bindParamsRunAction`)・`handleConfirmPackItemSwap`(`bindRunAction`)・`handleCancelPackItemSwap`(`bindRunActionNoArg`)・`handleClosePackItemSelect`(`bindRunActionNoArg`)
- rite: 同様の4つ
- cardSet: `handlePickPackCardSet`(`bindRunAction`)・`handleClosePackCardSetSelect`(`bindRunActionNoArg`)
- oracle: `handlePickPackOracleUse`(`bindRunAction`)・`handlePickPackOracleHold`(`bindParamsRunAction`)・`handleConfirmPackOracleSwap`(`bindRunAction`)・`handleCancelPackOracleSwap`(`bindRunActionNoArg`)・`handleClosePackOracleSelect`(`bindRunActionNoArg`)
- revelation: `handleCancelPackRevelationSwap`のみ(`bindRunActionNoArg`)。他の4つ(`handlePickPackRevelationUse`・`handlePickPackRevelationHold`・`handleConfirmPackRevelationSwap`・`handleClosePackRevelationSelect`)は`syncRevelationPreviewWithPhase()`の追加呼び出しや列選択判定を伴うため、個別関数のまま残す

Svelte 5のリアクティビティ上の注意点: `bindRunAction`はコンポーネントの`<script>`ブロック内で定義し、コンポーネントインスタンスの`run`(`$state`)をクロージャで参照する。ファクトリが返す関数はコンポーネントの外に持ち出さない(現状の設計でも全ハンドラが同じ`<script>`ブロック内にあるため、この制約は既存コードと同じ)。

## テスト

- `engine.ts`側は純粋なリファクタのため、既存の`engine.test.ts`内の`pickPack*`/`confirmPack*Swap`/`cancelPack*Swap`/`closePack*Select`関連テスト(5カテゴリ分)を無修正のまま実行し、全てグリーンであることを確認する。これが本リファクタの主たる正しさの根拠になる。
- 新規ヘルパー(`resolvePackOfferPick`・`closePackOfferSelect`)自体への直接のユニットテスト追加はスコープ外とする(YAGNI、既存の`pickPackXxx`等の経由テストで十分な回帰保証がある。これは`sabotageEffects.ts`のリファクタ時の方針と同じ)。
- `+page.svelte`側の変更は型チェック(`npm run check`)で検証する。UIの目視確認として、ショップで各福袋(護符・秘儀・天啓・神託・カードセット)を開封し、選択・スワップ・キャンセル・閉じるの一連の操作が壊れていないことを確認する。

## スコープ外

- 5カテゴリの`pickPack*`/`confirmPack*Swap`/`cancelPack*Swap`自体(容量チェック・スワップ相手の解決・use/hold分岐)の統合。カテゴリごとの違いが本質的であるため今回は対象としない
- `engine.ts`のショップ関連(`buyIndividualXxx`等)・売却系(`sellXxx`)など、福袋以外の重複調査
- `+page.svelte`の天啓関連ハンドラ(`syncRevelationPreviewWithPhase()`を伴うもの)のリファクタ
- 挙動・UIの変更(本リファクタは純粋なリファクタであり、ゲームの挙動は一切変更しない)
