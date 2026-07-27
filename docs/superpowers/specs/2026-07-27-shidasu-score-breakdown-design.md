# 場札プレイ時の得点内訳表示・アニメーション設計

## 背景・目的

星詠みソリティア「Shidasu」の通常プレイ画面(`PlayArea.svelte`)で、場札をプレイした際の得点は現在「+合計点数 内訳を空白区切りで一行表示」という静的な表示のみで、基礎点・パターン(同スート/同色/階段)・役(フラッシュ/ロイヤル/同ランク/コンプリートラン/列一掃)・護符効果・コンボ倍率がどのように積み上がって最終得点になったのか、プレイヤーが一目で追いにくい。

各要素を順番に強調表示しながら、その時点の仮合計点数も見せることで、得点の成り立ちを分かりやすく演出する。

## スコープ

- 対象は場札プレイ(`applyPlayCard`)による得点のみ。山札めくり(`applyDrawStock`、素朴の抵筆・パターン継続ボーナスなど)は対象外で、従来通りの表示のまま変更しない
- バラ売り・福袋の中身選択画面、ショップは対象外
- `wave.lastGain`(通常の得点計算)と`wave.lastBonusGains`(コンボ到達等の護符による直接加算)の両方が、このプレイ由来であれば同じ一連の演出の中で扱う

## データモデルの変更

現在、得点内訳は`parts: string[]`という単純な文字列配列(例: `"基礎点+10"`, `"コンボ倍率×1.5"`)で保持されており、各要素が加算か乗算か、その時点の仮合計がいくつかという構造化情報を持たない。

これを以下の型に置き換える:

```ts
export interface ScorePart {
  label: string
  kind: 'add' | 'multiply' | 'lock'
  amount: number // kind='add'なら加算量、kind='multiply'なら倍率。kind='lock'では無視(常に0)
  text: string // 従来通りの表示用文字列(例: "基礎点+10")。テスト・非対応箇所での後方互換表示に使う
}
```

`kind: 'lock'`は、ボスの得点ロック(特定条件で得点を0にする)が発動した際に使う。それまでの仮合計に関わらず、以降の合計を0にする特殊ステップとして扱う。

### 変更対象ファイル

- `src/lib/game/shidasu/types.ts`: `ScoreGain.parts`、`BonusGain.parts`の型を`string[]`から`ScorePart[]`に変更
- `src/lib/game/shidasu/patterns.ts`: `evaluateChainBonus`内の各`parts.push(...)`を構造化オブジェクトに変更(いずれも`kind: 'add'`、金額は既存コードで計算済みの値をそのまま使う)
- `src/lib/game/shidasu/itemEffects.ts`: `ItemEffect`の戻り値型`{ value: number; part: string | null }`を`{ value: number; part: ScorePart | null }`に変更
- `src/lib/game/shidasu/cardComboEffects.ts`, `chainAttributeEffects.ts`, `stateAndPatternEffects.ts`, `clearBonusEffects.ts`: 各護符効果定義の`part: '...'`を構造化オブジェクトに変更。加算(`v + N`)は`kind: 'add'`、乗算(`v * X`)は`kind: 'multiply'`(いずれも既存コードで計算済みの数値をそのまま使うだけの機械的な変更)
- `src/lib/game/shidasu/directEffects.ts`: `applyDirectEffects`の`parts: string[]`を`ScorePart[]`に変更(すべて`kind: 'add'`)
- `src/lib/game/shidasu/engine.ts`: `applyPlayCard`内の`parts`配列の構築を構造化オブジェクトに変更。基礎点・水鏡・列一掃を`kind: 'add'`、コンボ倍率・マンナズ倍率を`kind: 'multiply'`、ボス得点ロック発動時を`kind: 'lock'`として追加する

## 仮合計の計算(正確性の保証)

`ScorePart[]`を先頭から順に適用し、各ステップ後の仮合計を返す関数を新規ユーティリティ`src/lib/game/shidasu/scoreParts.ts`に用意する:

```ts
export function runningTotalsFromScoreParts(parts: ScorePart[]): number[]
```

適用順序: `kind: 'add'`は加算、`kind: 'multiply'`は乗算(浮動小数点のまま保持し、床関数は最後の1回のみ)、`kind: 'lock'`は合計を0にする。最終ステップの結果に`Math.floor`を適用した値が、実際に付与された得点(`lastGain.points`)と完全に一致することを保証する。これは`engine.ts`の`applyPlayCard`が実際に行っている計算(各護符効果を順に適用し、最後にコンボ倍率・マンナズ倍率をかけて1回だけ床関数を適用する)と全く同じ順序・同じ数値を構造化データとして記録しているだけなので、計算ロジックを重複実装するわけではない。

この一致を保証するテストを`scoreParts.test.ts`に追加し、既存の`engine.test.ts`の主要な得点計算シナリオ(パターン成立、役成立、複数護符併用、コンボ倍率適用、ボス得点ロックなど)についても、`runningTotalsFromScoreParts(lastGain.parts)`の最終値が`lastGain.points`と一致することを確認するテストを追加する。

## UIアニメーションフロー

3フェーズで構成する。開始タイミングは、直前に実装済みの「カードが場札からチェーンへ移動するアニメーション」の完了後(`onPlayCard`が実行され、`wave.lastGain`が更新された)を合図にする。

### フェーズ1: 得点内訳の順番表示

`wave.lastGain.parts`→`wave.lastBonusGains`の各`parts`を結合した順番で、1パーツあたり280ms固定でハイライト表示し、同時にその時点の仮合計点数(`runningTotalsFromScoreParts`で計算)を表示する。

パーツの合計数が1つだけ(基礎点のみの地味なプレイ)の場合は、この順番表示をスキップし、即座に最終パーツの状態を表示する。

### フェーズ2: 最終加点数の表示

全パーツの表示が完了したら、「+合計加点数」を大きく強調表示する(既存の`+{totalPoints}`表示を流用・強化)。

### フェーズ3: SCOREへの飛び込みアニメ

「+合計加点数」の表示要素が、まず上方向に1.5倍のサイズへ拡大しながら移動し、続いてSCORE表示位置(画面上部の`SCORE / TARGET`)へ向かって元のサイズに戻りながら移動する。到達した瞬間に、画面上部のSCORE数字が新しい値に更新される。このフェーズはパーツ数に関わらず(地味なプレイでも)毎回実行する。

### SCORE数字の遅延表示

`wave.score`はエンジン側で既に加点後の値になっているため、`PlayArea.svelte`内にローカルな表示用スコアstateを持ち、フェーズ3の飛び込みアニメが完了するまでは旧スコアを表示し続け、完了した時点で`wave.score`に切り替える。これは直前のカード移動アニメで採用した「実データの確定と見た目の更新タイミングを分離する」パターンと同じ考え方。

### 操作ロック

得点内訳アニメーション全体(フェーズ1〜3)が完了するまで、直前のカード移動アニメと同様に、場札のクリック・山札めくり・秘儀・天啓の使用をすべて`disabled`にする。カード移動アニメの完了時点で解除されていたロックを、得点内訳アニメーションの開始とともに再度かけ、そのアニメーションが完了して初めて解除する。

## テスト移行方針

`ScorePart`型への変更により、既存の6ファイル・約70箇所の`.parts`を文字列配列として比較しているテストアサーションが型エラーになる。これらは`.parts`を`.parts.map(p => p.text)`に置き換える形で機械的に移行し、期待値の文字列自体は変更しない(表示文言は変えないため)。

## 除外・非対象

- 山札めくり(`applyDrawStock`)経由の得点表示(`素朴`の抵筆、パターン継続ボーナスなど)は、`ScorePart`型への移行(データ構造の変更)は行うが、UI側は従来通りの静的表示のまま変更しない(`part.text`を結合して表示する形に変えるのみ)
- ショップ・福袋中身選択画面は対象外
