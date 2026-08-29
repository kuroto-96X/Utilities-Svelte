# 護符(Talisman)カタログ

Shidasu → Godot移植プロジェクト フェーズ1(現状仕様の資料化)成果物。

- 件数: **133件**(`src/lib/game/shidasu/types.ts`の`ItemId`型ユニオンメンバー数、`items.ts`の`ITEM_POOL`要素数、`shidasu.config.json`の`talismans`キー数のすべてで一致を確認済み。3者の集合差分・重複も無し)
- 当初計画では「99種」とされていたが、その後のコンテンツ追加により133種まで増えている(本カタログはこの133件全件を個別記載する)。
- 抽選は`ITEM_POOL`(133種、`items.ts`)からの完全均等抽選(`rollItemOffer`)。重み付けなし(`docs/shidasu/done/shidasu-gofu-candidates.md`のC/U/Rレアリティ区分は検討用の分類で、抽選確率には反映されていない)。所持中の種類は`ITEM_POOL`から除外される。
- 所持上限は基本5(`items.maxItems`。レリック「招き布袋像」所持時は拡張)。同じ種類を複数所持できる(献身・勤勉・加護・果断・星霜・小判等の累積系は個体ではなくラン全体で1つの永続値を共有する設計)。
- 効果の実装は用途別に4ファイルへ分割され、`itemEffects.ts`の`ITEM_EFFECTS`が`{ ...CLEAR_BONUS_EFFECTS, ...CARD_COMBO_EFFECTS, ...CHAIN_ATTRIBUTE_EFFECTS, ...STATE_AND_PATTERN_EFFECTS }`としてマージする。
  - `clearBonusEffects.ts`: 全消しボーナス系(channel: `clearBonus`) — patience/purify/temperanceの3種のみ。
  - `cardComboEffects.ts`: プレイしたカード単体の属性・現在コンボ数に応じたスコア加算/倍算。
  - `chainAttributeEffects.ts`: チェーン全体の属性(スート専有・色専有・階段・役成立)に応じたスコア加算/倍算。
  - `stateAndPatternEffects.ts`: `WaveState`の各種カウンタ・そのプレイのrole/pattern成立結果に応じたスコア加算/倍算。
  - 上記4ファイルに該当しない護符(永続デッキ操作・コンボ数書き換え・売値加算・星片加算など)は`engine.ts`内に個別実装され、`itemActualEffects.ts`の`ITEM_ACTUAL_EFFECTS`(実装を正とする開発者向け監査コメント、133件全件を網羅)に自然文で要約されている。本カタログの「効果」記述は`ITEM_ACTUAL_EFFECTS`の記述を基に、実装コード(各effectsファイル・`engine.ts`・`rewardTalismanEffects.ts`)と突き合わせて作成した。
  - Wave終了時に売値へ加算する「方向性1」14種・Wave中/終了時に星片へ加算する「方向性2」9種は`rewardTalismanEffects.ts`の`resolvePlayTriggeredRewardTalismans`/`resolvePlayTriggeredCurrencyGain`、および`engine.ts`の`resolveWaveEnd`に実装がある。
- 水鏡(`waterMirror`)は全護符共通の特殊機構: `applyItemEffects`実行中、自分の左隣(所持順で1つ前)の護符の`gained`/`clearBonus`効果を、その時点の値に対して追加でもう一度発動させる(自分が先頭なら何も起きない)。
- 護符の効果チャンネルは`gained`(通常プレイ・山札めくり時の獲得点計算)と`clearBonus`(全消しボーナス計算)の2種類。上記のプールに属さない永続効果(デッキ書き換え・コンボ数書き換え・売値/星片加算)は、この2チャンネルの外側で`engine.ts`が個別に処理する。

以下、`ITEM_POOL`(＝`items.ts`)の掲載順に全133件を記載する。

---

## 1. bridge(架橋)

- **ID**: `bridge`
- **名称**: `架橋`(`shidasu.config.json` `talismans.bridge.name`)
- **効果**: 常時、階段パターン・同スート/同色パターンの成立に必要な最小連続枚数を`m`枚少なくする(`resolveBridgeAdjustedLengths`が`effectiveStairMinLen = scoring.stairMinLen - m`、`effectiveSuitColorMinLen = scoring.suitColorMinLen - m`を算出し、`ItemEffectContext`経由で各護符・役判定へ渡す)。
- **関連パラメータ**: `talismans.bridge.m`(現在値1)
- **依存State**: `RunState.items`(所持判定のみ)を読み取る。`WaveState`への直接の読み書きは無く、算出結果はその場でスコア計算・役判定に使われるのみ。

## 2. grace(寛容)

- **ID**: `grace`
- **名称**: `寛容`
- **効果**: 列がちょうど空になった瞬間の列一掃判定(`sweepQualifies`)について、通常は「そのコンボ開始時点の列の枚数(`comboStreakColumnLengths[colIndex]`)が配布行数(`dealtRows`)ちょうど」でなければ成立しないところを、`grace`所持時は「配布行数-`m`以下」でも成立させる。
- **関連パラメータ**: `talismans.grace.m`(現在値2)
- **依存State**: `WaveState.comboStreakColumnLengths`・`WaveState.dealtRows`・`WaveState.tableau`を読み取る。判定結果は`WaveState.columnsEmptiedThisCombo`・`sweptColumnsThisCombo`・`totalColumnsEmptiedThisWave`・`columnSweepActiveThisWave`の更新に間接的に影響する。

## 3. patience(忍耐)

- **ID**: `patience`
- **名称**: `忍耐`
- **効果**: 全消しボーナスに、山札残り枚数×`x`を加算する。
- **関連パラメータ**: `talismans.patience.x`(現在値500)
- **依存State**: `WaveState.stock`(残り枚数)を読み取る。書き込みは共通処理経由で`WaveState.score`。

## 4. purify(浄化)

- **ID**: `purify`
- **名称**: `浄化`
- **効果**: 全消しボーナスに固定値`n`を無条件で加算する。
- **関連パラメータ**: `talismans.purify.n`(現在値10000)
- **依存State**: 依存する状態値は無し(固定加算)。書き込みは共通処理経由で`WaveState.score`。

## 5. temperance(節制)

- **ID**: `temperance`
- **名称**: `節制`
- **効果**: 全消しボーナスを`(1 + 山札残り枚数 × x)`倍にする。
- **関連パラメータ**: `talismans.temperance.x`(現在値0.1)
- **依存State**: `WaveState.stock`(残り枚数)を読み取る。

## 6. springBreeze(春風)

- **ID**: `springBreeze`
- **名称**: `春風`
- **効果**: 取得したカードが♣のとき、獲得点に`n`を加算する。
- **関連パラメータ**: `talismans.springBreeze.n`(現在値100)
- **依存State**: プレイされたカード(直後に`WaveState.foundation`となる)のスートを読み取る。

## 7. summerBreeze(夏風)

- **ID**: `summerBreeze`
- **名称**: `夏風`
- **効果**: 取得したカードが♦のとき、獲得点に`n`を加算する。
- **関連パラメータ**: `talismans.summerBreeze.n`(現在値100)
- **依存State**: プレイされたカードのスートを読み取る。

## 8. autumnBreeze(秋風)

- **ID**: `autumnBreeze`
- **名称**: `秋風`
- **効果**: 取得したカードが♥のとき、獲得点に`n`を加算する。
- **関連パラメータ**: `talismans.autumnBreeze.n`(現在値100)
- **依存State**: プレイされたカードのスートを読み取る。

## 9. winterBreeze(冬風)

- **ID**: `winterBreeze`
- **名称**: `冬風`
- **効果**: 取得したカードが♠のとき、獲得点に`n`を加算する。
- **関連パラメータ**: `talismans.winterBreeze.n`(現在値100)
- **依存State**: プレイされたカードのスートを読み取る。

## 10. kinship(友愛)

- **ID**: `kinship`
- **名称**: `友愛`
- **効果**: 直前の場札(`previousFoundation`)が♥以外で、今回取得したカードが♥のとき、獲得点に`n`を加算する。
- **関連パラメータ**: `talismans.kinship.n`(現在値200)
- **依存State**: `WaveState.foundation`(直前の場札)とプレイされたカードのスートを読み取る。

## 11. thaw(雪解)

- **ID**: `thaw`
- **名称**: `雪解`
- **効果**: 直前の場札が♠で、今回取得したカードが♠以外のとき、獲得点に`n`を加算する。
- **関連パラメータ**: `talismans.thaw.n`(現在値200)
- **依存State**: `WaveState.foundation`とプレイされたカードのスートを読み取る。

## 12. dusk(宵闇)

- **ID**: `dusk`
- **名称**: `宵闇`
- **効果**: 直前の場札が赤(♥/♦)を含み、今回取得したカードが黒(♠/♣)を含むとき、獲得点に`n`を加算する(`cardColors`経由の判定のため、紅蓮/漆黒所持時は黒札→黒札の連続でも成立しうる)。
- **関連パラメータ**: `talismans.dusk.n`(現在値100)
- **依存State**: `WaveState.foundation`、プレイされたカード、`RunState.items`(紅蓮/漆黒による色拡張判定)を読み取る。

## 13. dawn(払暁)

- **ID**: `dawn`
- **名称**: `払暁`
- **効果**: 直前の場札が黒を含み、今回取得したカードが赤を含むとき、獲得点に`n`を加算する。
- **関連パラメータ**: `talismans.dawn.n`(現在値100)
- **依存State**: `WaveState.foundation`、プレイされたカード、`RunState.items`(紅蓮/漆黒判定)を読み取る。

## 14. wit(機知)

- **ID**: `wit`
- **名称**: `機知`
- **効果**: 取得したカードがワイルドのとき、獲得点に`n`を加算する。
- **関連パラメータ**: `talismans.wit.n`(現在値200)
- **依存State**: プレイされたカードの`wild`フラグを読み取る。

## 15. courage(勇気)

- **ID**: `courage`
- **名称**: `勇気`
- **効果**: 獲得点を常時`(1 + コンボ数 × x)`倍にする。
- **関連パラメータ**: `talismans.courage.x`(現在値0.1)
- **依存State**: `WaveState.combo`(effectiveCombo)を読み取る。

## 16. daybreak(暁)

- **ID**: `daybreak`
- **名称**: `暁`
- **効果**: コンボ数が`c`以下のとき、獲得点を`x`倍にする。
- **関連パラメータ**: `talismans.daybreak.c`(現在値3)、`talismans.daybreak.x`(現在値2)
- **依存State**: `WaveState.combo`を読み取る。

## 17. twilight(黄昏)

- **ID**: `twilight`
- **名称**: `黄昏`
- **効果**: コンボ数が`c`以上のとき、獲得点を`x`倍にする。
- **関連パラメータ**: `talismans.twilight.c`(現在値10)、`talismans.twilight.x`(現在値5)
- **依存State**: `WaveState.combo`を読み取る。

## 18. cheerful(快活)

- **ID**: `cheerful`
- **名称**: `快活`
- **効果**: コンボ数が偶数のとき、獲得点に`n`を加算する。
- **関連パラメータ**: `talismans.cheerful.n`(現在値100)
- **依存State**: `WaveState.combo`を読み取る。

## 19. conscience(良心)

- **ID**: `conscience`
- **名称**: `良心`
- **効果**: コンボ数が奇数のとき、獲得点に`n`を加算する。
- **関連パラメータ**: `talismans.conscience.n`(現在値100)
- **依存State**: `WaveState.combo`を読み取る。

## 20. morningMist(朝霧)

- **ID**: `morningMist`
- **名称**: `朝霧`
- **効果**: 常時、コンボ数が`c`未満なら獲得点を`1/x`倍、`c`以上なら`x`倍にする。
- **関連パラメータ**: `talismans.morningMist.c`(現在値6)、`talismans.morningMist.x`(現在値4)
- **依存State**: `WaveState.combo`を読み取る。

## 21. calm(平穏)

- **ID**: `calm`
- **名称**: `平穏`
- **効果**: チェーン全体に絵札(J/Q/K)の実カードが1枚も含まれなければ(ワイルドは無視)、獲得点に`n`を加算する。
- **関連パラメータ**: `talismans.calm.n`(現在値200)
- **依存State**: `WaveState.chain`を読み取る。

## 22. serenity(安寧)

- **ID**: `serenity`
- **名称**: `安寧`
- **効果**: calmと同一条件(チェーンに絵札の実カードが無い)のとき、獲得点を`x`倍にする。
- **関連パラメータ**: `talismans.serenity.x`(現在値1.5)
- **依存State**: `WaveState.chain`を読み取る。

## 23. destiny(運命)

- **ID**: `destiny`
- **名称**: `運命`
- **効果**: チェーン全体の実カードが全て絵札(J/Q/K)なら、獲得点に`n`を加算する。
- **関連パラメータ**: `talismans.destiny.n`(現在値400)
- **依存State**: `WaveState.chain`を読み取る。

## 24. fate(宿命)

- **ID**: `fate`
- **名称**: `宿命`
- **効果**: destinyと同一条件(チェーンが絵札のみ)のとき、獲得点を`x`倍にする。
- **関連パラメータ**: `talismans.fate.x`(現在値2)
- **依存State**: `WaveState.chain`を読み取る。

## 25. relief(安堵)

- **ID**: `relief`
- **名称**: `安堵`
- **効果**: 今回プレイした1枚がワイルド、またはランク1〜10のいずれかなら、獲得点に`n`を加算する。
- **関連パラメータ**: `talismans.relief.n`(現在値100)
- **依存State**: プレイされたカード(ワイルド判定・ランク)を読み取る。

## 26. verdantGreen(深緑)

- **ID**: `verdantGreen`
- **名称**: `深緑`
- **効果**: チェーン全体の実カードが♣専有なら、獲得点を`x`倍にする。
- **関連パラメータ**: `talismans.verdantGreen.x`(現在値3)
- **依存State**: `WaveState.chain`を読み取る。

## 27. gem(宝石)

- **ID**: `gem`
- **名称**: `宝石`
- **効果**: チェーン全体の実カードが♦専有なら、獲得点を`x`倍にする。
- **関連パラメータ**: `talismans.gem.x`(現在値3)
- **依存State**: `WaveState.chain`を読み取る。

## 28. resolve(真剣)

- **ID**: `resolve`
- **名称**: `真剣`
- **効果**: チェーン全体の実カードが♠専有なら、獲得点を`x`倍にする。
- **関連パラメータ**: `talismans.resolve.x`(現在値3)
- **依存State**: `WaveState.chain`を読み取る。

## 29. grail(聖杯)

- **ID**: `grail`
- **名称**: `聖杯`
- **効果**: チェーン全体の実カードが♥専有なら、獲得点を`x`倍にする。
- **関連パラメータ**: `talismans.grail.x`(現在値3)
- **依存State**: `WaveState.chain`を読み取る。

## 30. moonlight(月光)

- **ID**: `moonlight`
- **名称**: `月光`
- **効果**: チェーン全体の実カードが黒(♠/♣、`cardColors`基準)専有なら、獲得点を`x`倍にする。
- **関連パラメータ**: `talismans.moonlight.x`(現在値1.5)
- **依存State**: `WaveState.chain`、`RunState.items`(紅蓮/漆黒判定)を読み取る。

## 31. sunlight(陽光)

- **ID**: `sunlight`
- **名称**: `陽光`
- **効果**: チェーン全体の実カードが赤(♥/♦)専有なら、獲得点を`x`倍にする。
- **関連パラメータ**: `talismans.sunlight.x`(現在値1.5)
- **依存State**: `WaveState.chain`、`RunState.items`(紅蓮/漆黒判定)を読み取る。

## 32. crown(王冠)

- **ID**: `crown`
- **名称**: `王冠`
- **効果**: チェーン内のK実枚数+ワイルド枚数の合計`count`(0より大きい場合)に対し、獲得点を`(1 + count × x)`倍にする。
- **関連パラメータ**: `talismans.crown.x`(現在値0.5)
- **依存State**: `WaveState.chain`を読み取る。

## 33. cloverLeaf(青葉)

- **ID**: `cloverLeaf`
- **名称**: `青葉`
- **効果**: チェーン内の♣実枚数+ワイルド枚数の合計`count`(0より大きい場合)に、`count × n`を加算する。
- **関連パラメータ**: `talismans.cloverLeaf.n`(現在値50)
- **依存State**: `WaveState.chain`を読み取る。

## 34. coin(硬貨)

- **ID**: `coin`
- **名称**: `硬貨`
- **効果**: チェーン内の♦実枚数+ワイルド枚数の合計`count`に、`count × n`を加算する。
- **関連パラメータ**: `talismans.coin.n`(現在値50)
- **依存State**: `WaveState.chain`を読み取る。

## 35. blade(武器)

- **ID**: `blade`
- **名称**: `武器`
- **効果**: チェーン内の♠実枚数+ワイルド枚数の合計`count`に、`count × n`を加算する。
- **関連パラメータ**: `talismans.blade.n`(現在値50)
- **依存State**: `WaveState.chain`を読み取る。

## 36. chalice(献杯)

- **ID**: `chalice`
- **名称**: `献杯`
- **効果**: チェーン内の♥実枚数+ワイルド枚数の合計`count`に、`count × n`を加算する。
- **関連パラメータ**: `talismans.chalice.n`(現在値50)
- **依存State**: `WaveState.chain`を読み取る。

## 37. balance(均衡)

- **ID**: `balance`
- **名称**: `均衡`
- **効果**: チェーン内の赤黒差(紅蓮/漆黒で両色を持つカード・ワイルドを柔軟枠として)をワイルド等で埋めて同数にできるとき、獲得点に`n`を加算する。
- **関連パラメータ**: `talismans.balance.n`(現在値200)
- **依存State**: `WaveState.chain`、`RunState.items`(紅蓮/漆黒判定)を読み取る。

## 38. harmony(調和)

- **ID**: `harmony`
- **名称**: `調和`
- **効果**: balanceと同一条件(赤黒同数化可能)のとき、獲得点を`x`倍にする。
- **関連パラメータ**: `talismans.harmony.x`(現在値1.5)
- **依存State**: `WaveState.chain`、`RunState.items`を読み取る。

## 39. nobility(高潔)

- **ID**: `nobility`
- **名称**: `高潔`
- **効果**: チェーン全体が同一スート専有(`analyzeSuitColor`の`suitHeld`)、かつチェーン長が`effectiveSuitColorMinLen`(bridge補正込み)以上のとき、獲得点に`n`を加算する。
- **関連パラメータ**: `talismans.nobility.n`(現在値200)
- **依存State**: `WaveState.chain`を読み取る(判定にbridge由来のeffectiveSuitColorMinLenも使用)。

## 40. tenacity(執念)

- **ID**: `tenacity`
- **名称**: `執念`
- **効果**: nobilityと同一条件のとき、獲得点を`(1 + チェーン長 × x)`倍にする。
- **関連パラメータ**: `talismans.tenacity.x`(現在値0.1)
- **依存State**: `WaveState.chain`を読み取る。

## 41. determination(覚悟)

- **ID**: `determination`
- **名称**: `覚悟`
- **効果**: チェーン全体が方向の定まった階段(`analyzeStair`の`held && dir !== 0`、長さ`effectiveStairMinLen`以上)のとき、獲得点を`(1 + 階段長 × x)`倍にする。
- **関連パラメータ**: `talismans.determination.x`(現在値0.1)
- **依存State**: `WaveState.chain`を読み取る(bridge由来のeffectiveStairMinLenも使用)。

## 42. cycle(循環)

- **ID**: `cycle`
- **名称**: `循環`
- **効果**: 直前の場札と今回のカードの組がK→AまたはA→K(ワイルドは万能扱い)のとき、獲得点を`x`倍にする。
- **関連パラメータ**: `talismans.cycle.x`(現在値3)
- **依存State**: `WaveState.foundation`、プレイされたカードを読み取る。

## 43. reincarnation(輪廻)

- **ID**: `reincarnation`
- **名称**: `輪廻`
- **効果**: このプレイでコンプリートランが成立し、かつ階段がK→A/A→Kの境界(ループ)を跨いでいるとき、獲得点を`x`倍にする。
- **関連パラメータ**: `talismans.reincarnation.x`(現在値10)
- **依存State**: `WaveState.chain`、そのプレイのrole成立結果(`chainBonus.roleFired`、都度算出でWaveStateの永続フィールドではない)を読み取る。

## 44. majesty(威光)

- **ID**: `majesty`
- **名称**: `威光`
- **効果**: このプレイでコンプリートランが成立し、かつ階段成立、かつチェーン全体が同一スート専有のとき、獲得点を`x`倍にする。
- **関連パラメータ**: `talismans.majesty.x`(現在値50)
- **依存State**: `WaveState.chain`、そのプレイのrole成立結果を読み取る。

## 45. omen(兆し)

- **ID**: `omen`
- **名称**: `兆し`
- **効果**: このプレイ後の場札残り枚数が`m`以下のとき、獲得点を`x`倍にする。
- **関連パラメータ**: `talismans.omen.m`(現在値20)、`talismans.omen.x`(現在値1.5)
- **依存State**: `WaveState.tableau`(残数)を読み取る。

## 46. crescent(三日月)

- **ID**: `crescent`
- **名称**: `三日月`
- **効果**: omenと同一条件(場札残りが`m`以下)のとき、獲得点を`x`倍にする(omenとは独立のパラメータで多重適用される)。
- **関連パラメータ**: `talismans.crescent.m`(現在値10)、`talismans.crescent.x`(現在値4)
- **依存State**: `WaveState.tableau`(残数)を読み取る。

## 47. blessing(恩寵)

- **ID**: `blessing`
- **名称**: `恩寵`
- **効果**: このプレイで役ボーナス(列一掃含む)が1つでも成立したとき、獲得点を`x`倍にする。
- **関連パラメータ**: `talismans.blessing.x`(現在値1.5)
- **依存State**: そのプレイの`chainBonus.roleFired`(都度算出)を読み取る。

## 48. focus(集中)

- **ID**: `focus`
- **名称**: `集中`
- **効果**: このプレイで同ランクの役(sameRank)が成立したとき、獲得点を`x`倍にする。
- **関連パラメータ**: `talismans.focus.x`(現在値3)
- **依存State**: そのプレイの`chainBonus.roleFired`を読み取る。

## 49. lapis(瑠璃)

- **ID**: `lapis`
- **名称**: `瑠璃`
- **効果**: このプレイで成立した役ボーナス数+パターンボーナス数(`roleFired.length + patternFiredCount`)の合計が2以上のとき、獲得点を`x`倍にする。
- **関連パラメータ**: `talismans.lapis.x`(現在値2)
- **依存State**: そのプレイの`chainBonus`(roleFired/patternFiredCount、都度算出)を読み取る。

## 50. jade(翡翠)

- **ID**: `jade`
- **名称**: `翡翠`
- **効果**: このプレイで成立した役のいずれかがワイルド使用によるもの(`roleFired.some(r => r.usedWild)`)だったとき、獲得点に`n`を加算する。
- **関連パラメータ**: `talismans.jade.n`(現在値200)
- **依存State**: そのプレイの`chainBonus.roleFired`を読み取る。

## 51. emptyMind(無心)

- **ID**: `emptyMind`
- **名称**: `無心`
- **効果**: このプレイで役もパターンボーナスも一切成立しなかったとき、獲得点を`x`倍にする。
- **関連パラメータ**: `talismans.emptyMind.x`(現在値4)
- **依存State**: そのプレイの`chainBonus`(patternFired/roleFired)を読み取る。

## 52. prologue(序章)

- **ID**: `prologue`
- **名称**: `序章`
- **効果**: 通常プレイ(山札めくりではない)でチェーン内1枚目のプレイのとき、獲得点に`n`を加算する。
- **関連パラメータ**: `talismans.prologue.n`(現在値500)
- **依存State**: `WaveState.chainOrigin`(プレイ回数のカウントに使用)を読み取る。

## 53. interlude(幕間)

- **ID**: `interlude`
- **名称**: `幕間`
- **効果**: 通常プレイでチェーン内ちょうど`m`枚目のプレイのとき、獲得点に`n`を加算する。
- **関連パラメータ**: `talismans.interlude.m`(現在値5)、`talismans.interlude.n`(現在値1000)
- **依存State**: `WaveState.chainOrigin`を読み取る。

## 54. morningDew(朝露)

- **ID**: `morningDew`
- **名称**: `朝露`
- **効果**: ウェーブ開始後まだ一度もプレイしていない状態での最初のプレイのとき、獲得点に`n`を加算する(山札めくりでは`firstPlayDone`は変化しない)。
- **関連パラメータ**: `talismans.morningDew.n`(現在値5000)
- **依存State**: `WaveState.firstPlayDone`を読み取る。

## 55. drizzle(小雨)

- **ID**: `drizzle`
- **名称**: `小雨`
- **効果**: 常に無条件で獲得点に`n`を加算する。
- **関連パラメータ**: `talismans.drizzle.n`(現在値50)
- **依存State**: 依存する状態値は無し(固定加算)。

## 56. eternity(永劫)

- **ID**: `eternity`
- **名称**: `永劫`
- **効果**: ウェーブ開始時、デッキ構成の末尾にワイルドカードを1枚追加する(以降のウェーブにも引き継がれる永続的な変更)。
- **関連パラメータ**: なし(数値パラメータを持たない)
- **依存State**: `RunState.deckComposition`を書き込む(startWave内)。

## 57. abundance(豊穣)

- **ID**: `abundance`
- **名称**: `豊穣`
- **効果**: ウェーブ開始時、デッキ構成の非ワイルドカードを1枚ランダムに選びワイルドへ変換する(永続的な変更)。
- **関連パラメータ**: なし
- **依存State**: `RunState.deckComposition`を読み書きする(startWave内)。

## 58. silence(静寂)

- **ID**: `silence`
- **名称**: `静寂`
- **効果**: 山札からめくったカードでプレイ可能な列が無いとき、そのカードをワイルドとして扱って使用し、さらにデッキ構成中の同じ`deckId`のカードもワイルドへ変換し、加えて別の1枚もランダムにワイルドへ変換する。
- **関連パラメータ**: なし
- **依存State**: `WaveState.stock`(めくったカード)・`WaveState.tableau`(プレイ可否判定)を読み取り、`RunState.deckComposition`を書き込む。

## 59. resilience(不屈)

- **ID**: `resilience`
- **名称**: `不屈`
- **効果**: 手詰まり(コンボリセット後にプレイ可能な列が無い)時、そのウェーブ中まだ未使用かつ捨て札が1枚以上あれば、スコアの`p`%を消費して捨て札の半数(端数切り捨て)を山札へ戻し、その後山札を1枚めくる。ウェーブ中1回のみ発動する。
- **関連パラメータ**: `talismans.resilience.p`(現在値30)
- **依存State**: `WaveState.discardPile`・`WaveState.stock`・`WaveState.score`・`WaveState.resilienceUsedThisWave`を読み書きする。

## 60. gentleBreeze(微風)

- **ID**: `gentleBreeze`
- **名称**: `微風`
- **効果**: 同じ列を連続でプレイした回数(`sameColumnStreak`)が2回目以降のとき、獲得点に`sameColumnStreak × n`を加算する。
- **関連パラメータ**: `talismans.gentleBreeze.n`(現在値300)
- **依存State**: `WaveState.sameColumnStreak`(`lastPlayedColumn`から都度算出)を読み取る。

## 61. resonance(共鳴)

- **ID**: `resonance`
- **名称**: `共鳴`
- **効果**: gentleBreezeと同一条件(`sameColumnStreak`が2以上)のとき、獲得点を`(1 + sameColumnStreak × x)`倍にする。
- **関連パラメータ**: `talismans.resonance.x`(現在値1)
- **依存State**: `WaveState.sameColumnStreak`を読み取る。

## 62. azureSky(蒼穹)

- **ID**: `azureSky`
- **名称**: `蒼穹`
- **効果**: ウェーブ内の列一掃累計回数(`totalColumnsEmptiedThisWave`)が1以上のとき、獲得点を`(1 + 累計回数 × x)`倍にする。
- **関連パラメータ**: `talismans.azureSky.x`(現在値0.5)
- **依存State**: `WaveState.totalColumnsEmptiedThisWave`を読み取る。

## 63. amber(琥珀)

- **ID**: `amber`
- **名称**: `琥珀`
- **効果**: ウェーブ内最大到達コンボ数(`maxComboThisWave`)が1以上のとき、獲得点を`(1 + 最大コンボ数 × x)`倍にする。
- **関連パラメータ**: `talismans.amber.x`(現在値0.1)
- **依存State**: `WaveState.maxComboThisWave`を読み取る。

## 64. composure(沈着)

- **ID**: `composure`
- **名称**: `沈着`
- **効果**: `drawStock`の通常コンボリセット時、リセット後にプレイ可能な列が無ければ、`baseComboCount`に永続で`n`を加算する。
- **関連パラメータ**: `talismans.composure.n`(現在値1)
- **依存State**: `WaveState.tableau`(プレイ可否判定)を読み取り、`WaveState.baseComboCount`を書き込む。

## 65. clarity(冷静)

- **ID**: `clarity`
- **名称**: `冷静`
- **効果**: `drawStock`の通常コンボリセット時、そのチェーン中に役が一度も成立していなければ(`roleFiredThisChain`が`false`)、`baseComboCount`に永続で`n`を加算する。
- **関連パラメータ**: `talismans.clarity.n`(現在値1)
- **依存State**: `WaveState.roleFiredThisChain`を読み取り、`WaveState.baseComboCount`を書き込む。

## 66. arrogance(慢心)

- **ID**: `arrogance`
- **名称**: `慢心`
- **効果**: `playCard`の獲得点計算時、山札が0枚なら獲得点を`x`倍にする。
- **関連パラメータ**: `talismans.arrogance.x`(現在値1.5)
- **依存State**: `WaveState.stock`(0枚判定)を読み取る。

## 67. echo(残響)

- **ID**: `echo`
- **名称**: `残響`
- **効果**: `drawStock`の通常コンボリセット時(全消し・手詰まりによるリセットは対象外)、リセット前のコンボ数×`n`を永続倍率`echoX`として蓄積し、以後の獲得点計算に乗算し続ける。
- **関連パラメータ**: `talismans.echo.n`(現在値0.001)
- **依存State**: リセット前の`WaveState.combo`を読み取り、`WaveState.echoX`を読み書き(`RunState.echoX`へ書き戻し)する。

## 68. shootingStar(流星)

- **ID**: `shootingStar`
- **名称**: `流星`
- **効果**: コンボ数が初めて`c`以上に達するたび、永続加算`shootingStarN`に`n`を蓄積し、以後の獲得点に加算し続ける(到達した同じプレイの獲得点には反映されない)。
- **関連パラメータ**: `talismans.shootingStar.c`(現在値10)、`talismans.shootingStar.n`(現在値50)
- **依存State**: `WaveState.combo`(到達判定)を読み取り、`WaveState.shootingStarN`を読み書き(`RunState.shootingStarN`へ書き戻し)する。

## 69. naive(素朴)

- **ID**: `naive`
- **名称**: `素朴`
- **効果**: 山札めくりでパターンが実際に継続する場合、通常プレイとほぼ同じ得点計算(基礎点・チェーンボーナス・コンボ加算・護符効果)を実行する。未所持時は継続してもスコア計算されない。鋼鉄の予約消費/予約加算・明星の役ボーナス倍率・祝福の`baseComboCount`更新はこの計算には反映されない。
- **関連パラメータ**: なし
- **依存State**: `WaveState.combo`・`WaveState.chain`・`WaveState.drawContinueCountThisChain`等`drawStock`内の状態一式を読み取り、`WaveState.score`を書き込む。

## 70. intuition(直感)

- **ID**: `intuition`
- **名称**: `直感`
- **効果**: 現在のチェーン中に山札めくりでパターン継続した回数(`drawContinueCountThisChain`)に応じ、獲得点を`(1 + 回数 × x)`倍にする(素朴の所持有無とは独立に発動条件を持つ)。
- **関連パラメータ**: `talismans.intuition.x`(現在値0.3)
- **依存State**: `WaveState.drawContinueCountThisChain`を読み取る。

## 71. sincerity(誠実)

- **ID**: `sincerity`
- **名称**: `誠実`
- **効果**: 山札めくりでパターンが実際に継続する場合(同スート・同色・階段いずれか、博愛による救済継続を除く)、`WaveState.combo`に直接`n`を加算する(素朴の有無に関わらず適用され、次のプレイのeffectiveComboに反映される)。
- **関連パラメータ**: `talismans.sincerity.n`(現在値1)
- **依存State**: `WaveState.combo`を読み書きする。

## 72. promise(約束)

- **ID**: `promise`
- **名称**: `約束`
- **効果**: 山札の中から、次にめくった際に今のコンボを継続できる最初のカードを探し、めくり位置(末尾)へ入れ替える。ウェーブ開始時・パターン継続直後・`drawStock`の通常コンボリセット直後の3箇所のみで実行され、全消し・手詰まりによるリセット後は対象外。
- **関連パラメータ**: なし
- **依存State**: `WaveState.stock`・`WaveState.chain`を読み書きする。

## 73. regeneration(再生)

- **ID**: `regeneration`
- **名称**: `再生`
- **効果**: 全消し時、コンボリセット後に山札が1枚以上ありウェーブ中未使用なら、スコアの`p`%を消費して捨て札から場札を全復活させ、その後山札を1枚めくる。ウェーブ中1回のみ発動する。
- **関連パラメータ**: `talismans.regeneration.p`(現在値50)
- **依存State**: `WaveState.discardPile`・`WaveState.tableau`・`WaveState.score`・`WaveState.regenerationUsedThisWave`を読み書きする。

## 74. benevolence(博愛)

- **ID**: `benevolence`
- **名称**: `博愛`
- **効果**: 山札めくりでパターンが継続しない場合、そのコンボ中まだ未使用なら、コンボリセットを行わずチェーン・コンボ状態を維持したまま継続扱いにする(コンボごとに1回のみ)。
- **関連パラメータ**: なし
- **依存State**: `WaveState.benevolenceUsedThisCombo`を読み書きし、`WaveState.chain`・`WaveState.combo`のリセットを抑止する。

## 75. healing(治癒)

- **ID**: `healing`
- **名称**: `治癒`
- **効果**: コンボリセット時(通常・全消し・手詰まりいずれも)、そのコンボ中に列一掃した列を、コンボ開始時点の枚数を上限として捨て札から復活させる。
- **関連パラメータ**: なし
- **依存State**: `WaveState.sweptColumnsThisCombo`・`WaveState.discardPile`を読み取り、`WaveState.tableau`・`WaveState.discardPile`を書き込む。

## 76. guidance(導き)

- **ID**: `guidance`
- **名称**: `導き`
- **効果**: 山札が1枚以上あるとき、次にめくられるカードを画面に表示する(スコア・挙動への影響はない情報表示のみ)。
- **関連パラメータ**: なし
- **依存State**: `WaveState.stock`(先頭)を読み取るのみ(書き込みなし)。

## 77. passion(情熱)

- **ID**: `passion`
- **名称**: `情熱`
- **効果**: 現在のコンボ中に一度でもフラッシュが成立していれば(`flushActiveThisCombo`)、獲得点を`x`倍にする。
- **関連パラメータ**: `talismans.passion.x`(現在値1.5)
- **依存State**: `WaveState.flushActiveThisCombo`を読み取る。

## 78. fightingSpirit(闘志)

- **ID**: `fightingSpirit`
- **名称**: `闘志`
- **効果**: このウェーブ中に一度でも列一掃が発生していれば(`columnSweepActiveThisWave`)、獲得点を`x`倍にする。
- **関連パラメータ**: `talismans.fightingSpirit.x`(現在値1.3)
- **依存State**: `WaveState.columnSweepActiveThisWave`を読み取る。

## 79. sanctify(祝福)

- **ID**: `sanctify`
- **名称**: `祝福`
- **効果**: 通常プレイで役が成立するたび、`baseComboCount`を永続的に+1する(素朴による山札めくり継続時は対象外)。`baseComboCount`はコンボリセット処理では参照されず、得点計算時の実効コンボ(effectiveCombo)に常に加算される別枠の値。
- **関連パラメータ**: なし
- **依存State**: そのプレイのrole成立結果(`roleFired`)を読み取り、`WaveState.baseComboCount`を書き込む。

## 80. protection(庇護)

- **ID**: `protection`
- **名称**: `庇護`
- **効果**: 得点計算用の実効コンボが`c`未満なら、`c`まで引き上げる(実際のコンボ数自体は変えない)。
- **関連パラメータ**: `talismans.protection.c`(現在値3)
- **依存State**: `WaveState.combo`を読み取る(書き込みは行わず、effectiveComboの算出のみに影響)。

## 81. earth(大地)

- **ID**: `earth`
- **名称**: `大地`
- **効果**: 得点計算用の実効コンボに常に`c`を加算する(実際のコンボ数自体は変えない)。
- **関連パラメータ**: `talismans.earth.c`(現在値2)
- **依存State**: `WaveState.combo`を読み取る。

## 82. golden(黄金)

- **ID**: `golden`
- **名称**: `黄金`
- **効果**: コンボが進む際、通常の+1ではなく+2進む。
- **関連パラメータ**: なし
- **依存State**: `WaveState.combo`を読み書きする(増分ロジックに影響)。

## 83. morningStar(明星)

- **ID**: `morningStar`
- **名称**: `明星`
- **効果**: 各役ボーナス(列一掃含む)の加点額を、その役がウェーブ中に過去成立した回数(`roleOccurrenceCountThisWave[name]`)に応じて`(1 + 過去回数 × x)`倍にする。
- **関連パラメータ**: `talismans.morningStar.x`(現在値0.2)
- **依存State**: `WaveState.roleOccurrenceCountThisWave`を読み書きする(今回分は次回以降に反映)。

## 84. mercy(慈悲)

- **ID**: `mercy`
- **名称**: `慈悲`
- **効果**: コンボリセット直前のコンボ数が`c`以下なら次のコンボを有効化し、そのコンボ中の獲得点を`x`倍にする。
- **関連パラメータ**: `talismans.mercy.c`(現在値3)、`talismans.mercy.x`(現在値2)
- **依存State**: リセット直前の`WaveState.combo`を読み取り、`WaveState.mercyActiveNextCombo`を読み書きする。

## 85. mirror(鋼鉄)

- **ID**: `mirror`
- **名称**: `鋼鉄`
- **効果**: チェーン中、初めて成立した役ボーナスのうち未予約の1つを次のプレイ用に予約し、次のプレイの基礎点へ無条件加算する(同一役タイプにつき1コンボ1回。異なる役タイプならコンボ内で複数回予約されうる)。
- **関連パラメータ**: なし
- **依存State**: `WaveState.roleEchoUsedThisCombo`・`WaveState.sameRankEchoUsedThisCombo`・`WaveState.pendingRoleEcho`を読み書きする。

## 86. deadline(刻限)

- **ID**: `deadline`
- **名称**: `刻限`
- **効果**: 山札残り枚数(0のときは無効)×`n`を獲得点に加算する。
- **関連パラメータ**: `talismans.deadline.n`(現在値50)
- **依存State**: `WaveState.stock`(残り枚数)を読み取る。

## 87. dedication(献身)

- **ID**: `dedication`
- **名称**: `献身`
- **効果**: 累積倍率`dedicationX`を1から開始し、この護符を所持してからフラッシュが成立するたび永続的に`dedicationX += n`する。獲得点には常に`dedicationX`を乗算する。
- **関連パラメータ**: `talismans.dedication.n`(現在値0.01)
- **依存State**: そのプレイのrole成立結果(flush)を読み取り、`WaveState.dedicationX`を読み書き(`RunState.dedicationX`へ書き戻し)する。

## 88. diligence(勤勉)

- **ID**: `diligence`
- **名称**: `勤勉`
- **効果**: 累積倍率`diligenceX`を1から開始し、同ランクの役が成立するたび永続的に`diligenceX += n`する。獲得点には常に`diligenceX`を乗算する。
- **関連パラメータ**: `talismans.diligence.n`(現在値0.01)
- **依存State**: そのプレイのrole成立結果(sameRank)を読み取り、`WaveState.diligenceX`を読み書き(`RunState.diligenceX`へ書き戻し)する。

## 89. divineProtection(加護)

- **ID**: `divineProtection`
- **名称**: `加護`
- **効果**: 累積倍率`divineProtectionX`を1から開始し、ロイヤルセットが成立するたび永続的に`divineProtectionX += n`する。獲得点には常に`divineProtectionX`を乗算する。
- **関連パラメータ**: `talismans.divineProtection.n`(現在値0.01)
- **依存State**: そのプレイのrole成立結果(royalSet)を読み取り、`WaveState.divineProtectionX`を読み書き(`RunState.divineProtectionX`へ書き戻し)する。

## 90. fortitude(剛毅)

- **ID**: `fortitude`
- **名称**: `剛毅`
- **効果**: Wave開始時、その時点の山札+場札の合計枚数(`deckComposition`の現存枚数)が`n`枚ごとに`baseComboCount`を+1する(`Math.floor(合計枚数 / n)`)。
- **関連パラメータ**: `talismans.fortitude.n`(現在値30)
- **依存State**: `RunState.deckComposition`(startWave時点)を読み取り、`WaveState.baseComboCount`の初期値を書き込む。

## 91. waterMirror(水鏡)

- **ID**: `waterMirror`
- **名称**: `水鏡`
- **効果**: 護符の並び順(`RunState.items`配列)で自分の左隣(添字-1)にある護符の`gained`/`clearBonus`効果を、その時点の値に対して追加でもう一度適用する(自分が先頭の場合は何も起きない)。
- **関連パラメータ**: なし
- **依存State**: `RunState.items`(並び順)を読み取る。左隣護符が参照するWaveState/RunStateフィールドにも間接的に依存する。

## 92. vow(誓約)

- **ID**: `vow`
- **名称**: `誓約`
- **効果**: 獲得点に常に`x`倍算する。対となる制約として、`isPlayable`(`engine.ts`)がコンボ内の直近実カードと異なる色のカードの取得を禁止する。
- **関連パラメータ**: `talismans.vow.x`(現在値2)
- **依存State**: 倍算自体は状態非依存(常時適用)。対の制約は`WaveState.chain`(直近実カードの色)を読み取る。

## 93. pact(契り)

- **ID**: `pact`
- **名称**: `契り`
- **効果**: 獲得点に常に`x`倍算する。対となる制約として、`isPlayable`がコンボ内の直近実カードと異なるスートのカードの取得を禁止する。
- **関連パラメータ**: `talismans.pact.x`(現在値3)
- **依存State**: 倍算自体は状態非依存。対の制約は`WaveState.chain`(直近実カードのスート)を読み取る。

## 94. crimson(紅蓮)

- **ID**: `crimson`
- **名称**: `紅蓮`
- **効果**: 直接のスコア加算/倍算は持たない。`cardColors`関数を通じて全ての札が赤(red)を含むものとして扱われ、色判定系の護符・`isPlayable`の色制約・秘儀ヴンヨー/ラグズの赤黒判定に影響する。
- **関連パラメータ**: なし
- **依存State**: `RunState.items`(所持判定、`cardColors`へ渡される)を読み取る。`WaveState`への直接の読み書きは無い。

## 95. jetBlack(漆黒)

- **ID**: `jetBlack`
- **名称**: `漆黒`
- **効果**: 直接のスコア加算/倍算は持たない。`cardColors`を通じて全ての札が黒(black)を含むものとして扱われ、色判定系の護符・`isPlayable`の色制約・秘儀ヴンヨー/ラグズの赤黒判定に影響する。
- **関連パラメータ**: なし
- **依存State**: `RunState.items`を読み取る。`WaveState`への直接の読み書きは無い。

## 96. silver(白銀)

- **ID**: `silver`
- **名称**: `白銀`
- **効果**: 獲得点に常に`x`倍算する。表示側(`CardFace.svelte`)では全ての札の色とスートを非表示にする変更と対になるが、点数計算・`isPlayable`・コンボ継続判定には引き続き実際の色とスートが使われる。
- **関連パラメータ**: `talismans.silver.x`(現在値1.5)
- **依存State**: 倍算自体は状態非依存(常時適用)。

## 97. discretion(果断)

- **ID**: `discretion`
- **名称**: `果断`
- **効果**: 加算値`n`(内部フィールド名は`discretionN`)を10から開始し、この護符を所持してから天啓・神託・秘儀のいずれかを使用するたび永続的に`discretionN += n`する。`playCard`の獲得点計算時に`discretionN`分を加算する。
- **関連パラメータ**: `talismans.discretion.n`(現在値10)
- **依存State**: `WaveState.discretionN`を読み書き(`RunState.discretionN`へ書き戻し)する。

## 98. frost(星霜)

- **ID**: `frost`
- **名称**: `星霜`
- **効果**: 倍率`x`(内部フィールド名は`frostX`)を1から開始し、この護符を所持してから天啓・神託・秘儀のいずれかを使用するたび永続的に`frostX += x`する。`playCard`の獲得点計算時に`frostX`を乗算する。
- **関連パラメータ**: `talismans.frost.x`(現在値0.01)
- **依存State**: `WaveState.frostX`を読み書き(`RunState.frostX`へ書き戻し)する。

## 99. exchange(両替)

- **ID**: `exchange`
- **名称**: `両替`
- **効果**: 秘儀・天啓・神託のいずれかを使用した直後、この護符自身のインスタンスの`sellBonus`に`n`を加算する。
- **関連パラメータ**: `talismans.exchange.n`(現在値2)
- **依存State**: `RunState.items`中の自分自身の`HeldItem.sellBonus`を書き込む。

## 100. koban(小判)

- **ID**: `koban`
- **名称**: `小判`
- **効果**: コンボ数が`c`未満から`c`以上へ変化した瞬間(エッジトリガー)、この護符自身の`sellBonus`に`n`を加算する。
- **関連パラメータ**: `talismans.koban.c`(現在値3)、`talismans.koban.n`(現在値1)
- **依存State**: `WaveState.combo`(プレイ前後の値)を読み取り、`RunState.items`中の自分自身の`sellBonus`を書き込む。

## 101. senryo(千両)

- **ID**: `senryo`
- **名称**: `千両`
- **効果**: コンボ数が`c`未満から`c`以上へ変化した瞬間(エッジトリガー)、この護符自身の`sellBonus`に`n`を加算する。
- **関連パラメータ**: `talismans.senryo.c`(現在値6)、`talismans.senryo.n`(現在値3)
- **依存State**: `WaveState.combo`を読み取り、自分自身の`sellBonus`を書き込む。

## 102. manryo(万両)

- **ID**: `manryo`
- **名称**: `万両`
- **効果**: コンボ数が`c`未満から`c`以上へ変化した瞬間(エッジトリガー)、この護符自身の`sellBonus`に`n`を加算する。
- **関連パラメータ**: `talismans.manryo.c`(現在値10)、`talismans.manryo.n`(現在値4)
- **依存State**: `WaveState.combo`を読み取り、自分自身の`sellBonus`を書き込む。

## 103. harvest(豊作)

- **ID**: `harvest`
- **名称**: `豊作`
- **効果**: 全消し(`remainingTableauCount === 0`)を達成するたび、この護符自身の`sellBonus`に`n`を加算する。
- **関連パラメータ**: `talismans.harvest.n`(現在値5)
- **依存State**: `WaveState.tableau`(残数0判定)を読み取り、自分自身の`sellBonus`を書き込む。

## 104. settlement(決算)

- **ID**: `settlement`
- **名称**: `決算`
- **効果**: カードプレイ`c`回以下でウェーブをクリアするたび、この護符自身の`sellBonus`に`n`を加算する。
- **関連パラメータ**: `talismans.settlement.c`(現在値15)、`talismans.settlement.n`(現在値5)
- **依存State**: `WaveState.playCountThisWave`を読み取り、自分自身の`sellBonus`を書き込む。

## 105. hiddenTreasure(秘宝)

- **ID**: `hiddenTreasure`
- **名称**: `秘宝`
- **効果**: ♠のAをプレイするたび、この護符自身の`sellBonus`に`n`を加算する。
- **関連パラメータ**: `talismans.hiddenTreasure.n`(現在値5)
- **依存State**: プレイされたカード(スート・ランク)を読み取り、自分自身の`sellBonus`を書き込む。

## 106. greatestTreasure(至宝)

- **ID**: `greatestTreasure`
- **名称**: `至宝`
- **効果**: ♥のKをプレイするたび、この護符自身の`sellBonus`に`n`を加算する。
- **関連パラメータ**: `talismans.greatestTreasure.n`(現在値5)
- **依存State**: プレイされたカードを読み取り、自分自身の`sellBonus`を書き込む。

## 107. heirloom(家宝)

- **ID**: `heirloom`
- **名称**: `家宝`
- **効果**: ♦のJをプレイするたび、この護符自身の`sellBonus`に`n`を加算する。
- **関連パラメータ**: `talismans.heirloom.n`(現在値5)
- **依存State**: プレイされたカードを読み取り、自分自身の`sellBonus`を書き込む。

## 108. treasury(宝庫)

- **ID**: `treasury`
- **名称**: `宝庫`
- **効果**: ♣のQをプレイするたび、この護符自身の`sellBonus`に`n`を加算する。
- **関連パラメータ**: `talismans.treasury.n`(現在値5)
- **依存State**: プレイされたカードを読み取り、自分自身の`sellBonus`を書き込む。

## 109. boom(好況)

- **ID**: `boom`
- **名称**: `好況`
- **効果**: そのプレイでroleFiredにflushが含まれるとき、この護符自身の`sellBonus`に`n`を加算する。
- **関連パラメータ**: `talismans.boom.n`(現在値2)
- **依存State**: そのプレイのrole成立結果を読み取り、自分自身の`sellBonus`を書き込む。

## 110. abundantFunds(潤沢)

- **ID**: `abundantFunds`
- **名称**: `潤沢`
- **効果**: 場札の残り枚数が`m`超から`m`以下へ変化した瞬間(エッジトリガー)、この護符自身の`sellBonus`に`n`を加算する。
- **関連パラメータ**: `talismans.abundantFunds.m`(現在値10)、`talismans.abundantFunds.n`(現在値5)
- **依存State**: `WaveState.tableau`(残数のプレイ前後の値)を読み取り、自分自身の`sellBonus`を書き込む。

## 111. savings(蓄財)

- **ID**: `savings`
- **名称**: `蓄財`
- **効果**: 同じ列を連続でプレイした場合(2回目以降)、この護符自身の`sellBonus`に`(連続回数-1) × n`を加算する。
- **関連パラメータ**: `talismans.savings.n`(現在値1)
- **依存State**: `WaveState.sameColumnStreak`を読み取り、自分自身の`sellBonus`を書き込む。

## 112. bigCatch(大漁)

- **ID**: `bigCatch`
- **名称**: `大漁`
- **効果**: そのプレイで列一掃(`sweepQualifies`)が成立したとき、この護符自身の`sellBonus`に`n`を加算する。
- **関連パラメータ**: `talismans.bigCatch.n`(現在値3)
- **依存State**: そのプレイの`sweepQualifies`(都度算出)を読み取り、自分自身の`sellBonus`を書き込む。

## 113. grains(五穀)

- **ID**: `grains`
- **名称**: `五穀`
- **効果**: 取得したカードがワイルドのとき、この護符自身の`sellBonus`に`n`を加算する。
- **関連パラメータ**: `talismans.grains.n`(現在値2)
- **依存State**: プレイされたカードの`wild`フラグを読み取り、自分自身の`sellBonus`を書き込む。

## 114. liveliness(活況)

- **ID**: `liveliness`
- **名称**: `活況`
- **効果**: `analyzeSuitColor`が`suitHeld=true`を返し、かつチェーン長(実カード枚数)が`m`以上のとき、この護符自身の`sellBonus`に`n`を加算する。
- **関連パラメータ**: `talismans.liveliness.m`(現在値6)、`talismans.liveliness.n`(現在値3)
- **依存State**: `WaveState.chain`を読み取り、自分自身の`sellBonus`を書き込む。

## 115. prosperity(盛況)

- **ID**: `prosperity`
- **名称**: `盛況`
- **効果**: `analyzeSuitColor`が`colorHeld=true`を返し、かつチェーン長が`m`以上のとき、この護符自身の`sellBonus`に`n`を加算する。
- **関連パラメータ**: `talismans.prosperity.m`(現在値6)、`talismans.prosperity.n`(現在値3)
- **依存State**: `WaveState.chain`を読み取り、自分自身の`sellBonus`を書き込む。

## 116. heavenlyBlessing(天恵)

- **ID**: `heavenlyBlessing`
- **名称**: `天恵`
- **効果**: `analyzeStair`が階段成立(`held && dir !== 0`)を返し、かつ`stairInfo.len`が`m`以上のとき、この護符自身の`sellBonus`に`n`を加算する。
- **関連パラメータ**: `talismans.heavenlyBlessing.m`(現在値6)、`talismans.heavenlyBlessing.n`(現在値4)
- **依存State**: `WaveState.chain`を読み取り、自分自身の`sellBonus`を書き込む。

## 117. mizuho(瑞穂)

- **ID**: `mizuho`
- **名称**: `瑞穂`
- **効果**: `analyzeAlternatingColor`に`minLen = m`を渡して`held=true`が返るとき、この護符自身の`sellBonus`に`n`を加算する(紅蓮/漆黒による色拡張は考慮しない)。
- **関連パラメータ**: `talismans.mizuho.m`(現在値6)、`talismans.mizuho.n`(現在値4)
- **依存State**: `WaveState.chain`を読み取り、自分自身の`sellBonus`を書き込む。

## 118. bountifulYear(豊年)

- **ID**: `bountifulYear`
- **名称**: `豊年`
- **効果**: そのプレイでroleFiredにロイヤルセット(royalSet)が含まれるとき、この護符自身の`sellBonus`に`n`を加算する。
- **関連パラメータ**: `talismans.bountifulYear.n`(現在値2)
- **依存State**: そのプレイのrole成立結果を読み取り、自分自身の`sellBonus`を書き込む。

## 119. profit(利得)

- **ID**: `profit`
- **名称**: `利得`
- **効果**: そのプレイでroleFiredに同ランク(sameRank)が含まれるとき、この護符自身の`sellBonus`に`n`を加算する。
- **関連パラメータ**: `talismans.profit.n`(現在値2)
- **依存State**: そのプレイのrole成立結果を読み取り、自分自身の`sellBonus`を書き込む。

## 120. bounty(収穫)

- **ID**: `bounty`
- **名称**: `収穫`
- **効果**: そのプレイでroleFiredにコンプリートラン(completeRun)が含まれるとき、この護符自身の`sellBonus`に`n`を加算する。
- **関連パラメータ**: `talismans.bounty.n`(現在値10)
- **依存State**: そのプレイのrole成立結果を読み取り、自分自身の`sellBonus`を書き込む。

## 121. perk(役得)

- **ID**: `perk`
- **名称**: `役得`
- **効果**: そのプレイでroleFiredにペア(pair)が含まれるとき、この護符自身の`sellBonus`に`n`を加算する。
- **関連パラメータ**: `talismans.perk.n`(現在値2)
- **依存State**: そのプレイのrole成立結果を読み取り、自分自身の`sellBonus`を書き込む。

## 122. nestEgg(儲蓄)

- **ID**: `nestEgg`
- **名称**: `儲蓄`
- **効果**: 他の護符が売却されるたび、この護符自身の`sellBonus`に`n`を加算する(自分自身が売却対象の場合は加算しない)。
- **関連パラメータ**: `talismans.nestEgg.n`(現在値2)
- **依存State**: 他護符の売却イベント(`RunState.items`の変化)を読み取り、自分自身の`sellBonus`を書き込む。

## 123. dividend(配当)

- **ID**: `dividend`
- **名称**: `配当`
- **効果**: 星の妨害行動(`triggerSabotage`)が発動するたび、星片(currency)に`n`を加算する。
- **関連パラメータ**: `talismans.dividend.n`(現在値5)
- **依存State**: `WaveState.pendingSabotageId`/`lastSabotage`(妨害発動イベント)を読み取り、`RunState.currency`を書き込む。

## 124. prizeMoney(賞金)

- **ID**: `prizeMoney`
- **名称**: `賞金`
- **効果**: プレイしたカードのランクが`randomTarget`(ウェーブ開始時にインスタンスごと再抽選)と一致するとき、星片に`n`を加算する。
- **関連パラメータ**: `talismans.prizeMoney.n`(現在値2)
- **依存State**: `HeldItem.randomTarget`とプレイされたカードのランクを読み取り、`RunState.currency`を書き込む。

## 125. windfall(僥倖)

- **ID**: `windfall`
- **名称**: `僥倖`
- **効果**: J・Q・Kのいずれかをプレイしたとき、`p`%の確率で星片に`n`を加算する。
- **関連パラメータ**: `talismans.windfall.p`(現在値25)、`talismans.windfall.n`(現在値2)
- **依存State**: プレイされたカード(絵札判定)を読み取り、`RunState.currency`を書き込む。

## 126. celebration(祝儀)

- **ID**: `celebration`
- **名称**: `祝儀`
- **効果**: そのプレイでroleFiredに`randomTarget`(ウェーブ開始時にインスタンスごと再抽選される役)が含まれるとき、星片に`n`を加算する。
- **関連パラメータ**: `talismans.celebration.n`(現在値2)
- **依存State**: `HeldItem.randomTarget`とそのプレイのrole成立結果を読み取り、`RunState.currency`を書き込む。

## 127. refund(還元)

- **ID**: `refund`
- **名称**: `還元`
- **効果**: ウェーブ終了時、所持している護符・秘儀・天啓・神託すべて(refund自身を含む)の`sellBonus`に`n`を加算する。
- **関連パラメータ**: `talismans.refund.n`(現在値1)
- **依存State**: `RunState.items`/`rites`/`revelations`/`oracles`の全個体の`sellBonus`を書き込む(ウェーブ終了処理内)。

## 128. bonus(報奨)

- **ID**: `bonus`
- **名称**: `報奨`
- **効果**: ウェーブ終了時、無条件で星片に`n`を加算する。
- **関連パラメータ**: `talismans.bonus.n`(現在値3)
- **依存State**: `RunState.currency`を書き込む(ウェーブ終了処理内)。

## 129. commendation(褒賞)

- **ID**: `commendation`
- **名称**: `褒賞`
- **効果**: ウェーブ終了時、デッキにあるランク`l`のカード1枚につき星片に`n`を加算する。
- **関連パラメータ**: `talismans.commendation.l`(現在値7)、`talismans.commendation.n`(現在値1)
- **依存State**: `RunState.deckComposition`(ランク`l`の現存枚数)を読み取り、`RunState.currency`を書き込む。

## 130. favor(恩賞)

- **ID**: `favor`
- **名称**: `恩賞`
- **効果**: ウェーブ終了時、所持する`favor`インスタンスごとに`rewardBonus`の現在値を星片に加算する。ステージクリア(isBossWave)時は`rewardBonus`に`a`を加算して蓄積する(取得時は`n`で初期化)。
- **関連パラメータ**: `talismans.favor.n`(現在値2)、`talismans.favor.a`(現在値1)
- **依存State**: `HeldItem.rewardBonus`を読み書きし、`RunState.currency`を書き込む。

## 131. vigor(活気)

- **ID**: `vigor`
- **名称**: `活気`
- **効果**: ウェーブ終了時、そのウェーブでの最大コンボ数に応じて`floor(maxComboThisWave / 5) × n`を星片に加算する。
- **関連パラメータ**: `talismans.vigor.n`(現在値2)
- **依存State**: `WaveState.maxComboThisWave`を読み取り、`RunState.currency`を書き込む。

## 132. zuishuku(瑞祝)

- **ID**: `zuishuku`
- **名称**: `瑞祝`
- **効果**: ウェーブ終了時、そのウェーブで成立した役の種類数(`roleOccurrenceCountThisWave`のうち1回以上成立した種類数)に応じて`floor(役の種類数 / 2) × n`を星片に加算する。
- **関連パラメータ**: `talismans.zuishuku.n`(現在値2)
- **依存State**: `WaveState.roleOccurrenceCountThisWave`を読み取り、`RunState.currency`を書き込む。

## 133. marketTrend(市況)

- **ID**: `marketTrend`
- **名称**: `市況`
- **効果**: ウェーブ終了時、山札消費割合に応じて`floor(((c-b-a)/(c-b)) × n)`を星片に加算する(`a`=残り山札枚数、`b`=初期配布枚数、`c`=デッキ総枚数(現存分)。`c-b <= 0`の場合は0)。
- **関連パラメータ**: `talismans.marketTrend.n`(現在値10)
- **依存State**: `WaveState.stock`・`WaveState.dealtRows`・`RunState.deckComposition`を読み取り、`RunState.currency`を書き込む。
