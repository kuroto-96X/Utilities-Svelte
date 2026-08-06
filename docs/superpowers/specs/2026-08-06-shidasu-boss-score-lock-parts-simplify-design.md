# 惑星ロック時の得点内訳を単一パーツ化する設計

## 背景・目的

Shidasu(`src/lib/game/shidasu/engine.ts`)には、惑星(コード上は「ボス」、`BossScoreLock`型)による無得点化ルールがある。特定条件(コンボ数以下・特定スート・奇数コンボ・絵札)を満たすプレイは獲得点が強制的に0になる。

現状、この無得点化が発動しても、`playCard`・`drawStock`(素朴の護符所持時のパターン継続再現パス)が構築する`parts`配列には、基礎点・パターン/役ボーナス・護符効果・コンボ倍率などそれまでに積んだ全パーツがそのまま残り、末尾に惑星ロックのパーツ(`lockPart(...)`、表示例: 「test-tier: 獲得点0」)が追加されるだけになっている。

得点内訳アニメーション(フェーズ1: 各`ScorePart`を1つずつ中央表示する演出)では、無得点のプレイでも本来関係の無い基礎点やパターンボーナスのパーツが順番に表示されてしまい、プレイヤーに「結局いくら入ったのか」が分かりにくい。惑星ロックが成立した場合は、惑星ロックのパーツ1件のみを最初に(かつ唯一のパーツとして)表示するようにする。

## スコープ

- 対象: `playCard`関数(`src/lib/game/shidasu/engine.ts`)内の`scoreLock`判定箇所、および`drawStock`関数内、素朴の護符所持時のパターン継続再現パスにある同種の`scoreLock`判定箇所
- 対象外: `lastBonusGains`(コンボ到達時の護符による直接加算、全消しボーナス)。これらは`lastGain`とは別の配列・別のロジックで管理されており、今回の変更の影響を受けない(惑星ロックはgained=0のプレイに対する制約であり、bonusGains自体の発生条件には関与しない)

## 変更内容

`playCard`関数内、`scoreLock`成立を判定して`gained`を0にする箇所を以下のように変更する。

変更前:
```ts
if (scoreLock && isBossScoreLocked(scoreLock, effectiveCombo, card)) {
  parts.push(lockPart(bossScoreLockMessage(scoreLock)))
  gained = 0
}
```

変更後:
```ts
if (scoreLock && isBossScoreLocked(scoreLock, effectiveCombo, card)) {
  parts.length = 0
  parts.push(lockPart(bossScoreLockMessage(scoreLock)))
  gained = 0
}
```

`drawStock`関数内、素朴の護符所持時のパターン継続再現パスにある同種の判定箇所も同様に変更する。

変更前:
```ts
naiveGained = Math.floor(itemResult.value * multiplier * mannazFactor)
if (scoreLock && isBossScoreLocked(scoreLock, effectiveCombo, drawnCard)) {
  parts.push(lockPart(bossScoreLockMessage(scoreLock)))
  naiveGained = 0
}
```

変更後:
```ts
naiveGained = Math.floor(itemResult.value * multiplier * mannazFactor)
if (scoreLock && isBossScoreLocked(scoreLock, effectiveCombo, drawnCard)) {
  parts.length = 0
  parts.push(lockPart(bossScoreLockMessage(scoreLock)))
  naiveGained = 0
}
```

`gained`(`naiveGained`)自体の計算(`itemResult.value`・`multiplier`等の算出)は、この判定より前に既に完了しているコードなので変更しない。計算結果は`parts`から削除されるだけで、最終的な`gained`は0に上書きされるため実害はない。

## UIアニメーションへの影響

得点内訳アニメーション(`PlayArea.svelte`のフェーズ1)は`wave.lastGain.parts`をそのまま順番表示する既存の仕組みのため、UI側の変更は不要。`parts`が`[lockPart(...)]`という1件のみの配列になった時点で、自動的に「惑星ロックパーツのみが最初かつ唯一のパーツとして表示される」という挙動になる。

`runningTotalsFromScoreParts`(`scoreParts.ts`)は`kind: 'lock'`のパーツに対して`running = 0`を返す既存の実装のため、変更不要でそのまま動作する。

## テスト方針

`src/lib/game/shidasu/engine.test.ts`の既存`describe('playCard: BossScoreLock(ボス制約による得点0)', ...)`ブロック(1432行目付近)に、`next.lastGain?.parts`が`lockPart`1件のみになることを確認するテストを追加する。既存テストは`lastGain.points`のみを検証しており`.parts`の中身までは見ていないため、既存テストへの影響はない。

`drawStock`側(素朴+scoreLockのテスト、3487行目付近の`describe`ブロック)にも同様に、`.parts`が1件のみになることを確認するテストを追加する。

## 除外・非対象

- `lastBonusGains`(コンボ到達時の護符による直接加算・全消しボーナス)は対象外、現状のまま
- 惑星ロックの判定ロジック自体(`isBossScoreLocked`・`bossScoreLockFor`)は変更しない
