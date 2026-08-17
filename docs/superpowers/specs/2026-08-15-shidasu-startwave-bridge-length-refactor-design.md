# startWave橋補正共通化リファクタ 設計

> 対象: `src/lib/game/shidasu/engine.ts`の`startWave`にある、橋の護符による長さ補正の計算(2行)を、既存の`resolveBridgeAdjustedLengths`ヘルパー(前回のリファクタで`playCard`・`drawStock`向けに追加済み)の呼び出しに置き換える。純粋なリファクタであり、ゲームの挙動は一切変更しない。

## 背景・目的

前回のリファクタ(`docs/superpowers/specs/2026-08-15-shidasu-scoring-helper-common-refactor-design.md`)で、`playCard`・`drawStock`にあった橋の護符による長さ補正計算を`resolveBridgeAdjustedLengths`ヘルパーに切り出した。そのレビュー中、`startWave`(Wave開始時の配布処理)内にも全く同じ計算(`effectiveStairMinLenAtDeal`/`effectiveSuitColorMinLenAtDeal`という変数名で、値は完全に同一のロジック)が残っていることが分かり、次回候補として記録していた。

## 方針(スコープ)

`startWave`内の該当2行を、既存の`resolveBridgeAdjustedLengths`(`engine.ts`内に定義済み、新規追加不要)の呼び出しに置き換える。関数宣言は巻き上げされるため、`startWave`が`resolveBridgeAdjustedLengths`より前方(ファイル内で上)に定義されていても問題なく呼び出せる。

## 技術設計

`src/lib/game/shidasu/engine.ts`の`startWave`関数内、以下の2行:

```ts
const effectiveStairMinLenAtDeal = items.includes('bridge') ? params.scoring.stairMinLen - params.talismans.bridge.m : params.scoring.stairMinLen
const effectiveSuitColorMinLenAtDeal = items.includes('bridge') ? params.scoring.suitColorMinLen - params.talismans.bridge.m : params.scoring.suitColorMinLen
```

を以下に置き換える。分割代入時にプロパティ名をリネームすることで、既存の変数名(`effectiveStairMinLenAtDeal`・`effectiveSuitColorMinLenAtDeal`)をそのまま維持し、後続コード(`arrangeNextCardForContinuation`呼び出し等)への影響をゼロにする:

```ts
const { effectiveStairMinLen: effectiveStairMinLenAtDeal, effectiveSuitColorMinLen: effectiveSuitColorMinLenAtDeal } = resolveBridgeAdjustedLengths(params, items)
```

新規ヘルパーの追加は無い。`engine.ts`単体、1関数のみの変更。

## テスト

- 純粋なリファクタのため、既存の`engine.test.ts`内の`startWave`・護符「橋」関連テストを無修正のまま実行し、全てグリーンであることを確認する。

## スコープ外

- `resolveBridgeAdjustedLengths`自体の変更(既存のまま再利用するのみ)
- `+page.svelte`の天啓プレビューパターンの共通化(引き続き見送り)
- 挙動・UIの変更(本リファクタは純粋なリファクタであり、ゲームの挙動は一切変更しない)
