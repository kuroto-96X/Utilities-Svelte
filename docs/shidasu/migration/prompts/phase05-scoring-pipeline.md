# フェーズ5: 役判定・スコアリングパイプラインの移植

> このプロンプトは、Shidasu(Balatro風トランプソリティア型ローグライク)をGodot(C#)へ移植し、Steam向けPCゲームとして販売するプロジェクトの一部です。ゲームロジックはGodotに一切依存しない`Shidasu.Core`(Pure C#クラスライブラリ)に実装し、Godotプロジェクト本体は`Shidasu.Core`をプロジェクト参照する薄いアダプタ層とします。Godotプロジェクトは元のWebリポジトリ(Utilities-Svelte)とは別管理ですが、VSCodeのマルチルートワークスペースにより両方のファイルを参照できます。
>
> 着手前に必ず読むこと:
> - `Utilities-Svelte/docs/shidasu/migration/01-work-plan.md`(全体計画)
> - フェーズ4の成果物(Run/Wave進行フローの`Shidasu.Core`実装。`RunState`/`WaveState`相当の`record class`、`StartWave`相当関数など)
> - フェーズ1の成果物のうち「スコア計算パイプライン仕様」に該当する資料(`docs/shidasu/migration/`直下に作成されているはずなので、ファイル名を確認して読むこと)

## 目的

プレイ1回あたりの獲得点計算パイプライン(役判定・パターンボーナス・コンボ倍率など)と、カード取得可否・手詰まり判定を移植する。護符(Talisman)の個別効果本体はフェーズ6で実装するため、本フェーズでは「護符効果を差し込むためのフック」を正しい位置・正しいシグネチャで用意した上で、中身はスタブ(無効果)にする。

## 前提・依存

- フェーズ4が完了していること(`WaveState`/`RunState`の`Shidasu.Core`版、`StartWave`相当関数、`RunPhase`状態機械が動作していること)。
- 本フェーズの時点では、プレイヤーはまだ護符・秘儀・天啓・神託を一切所持できない(所持リストは常に空)前提で実装・検証してよい。これらを所持できるようにするショップ等はフェーズ8以降の担当。

## 重要: 「スタブにする護符効果フック」は3箇所のみ

`engine.ts`の`playCard`/`drawStock`は、内部に非常に多くの`items.includes('護符ID')`という分岐を直接持っている(黄金・祝福・鋼鉄・流星・献身・勤勉・加護・果断・星霜・残響・慢心・静寂・沈着・冷静・博愛・素朴・約束・再生・治癒・庇護・大地・明星など多数)。これらは実際に読むと分かる通り、いずれも**単純な`items.includes(id)`判定+`WaveState`の既存フィールド操作**であり、汎用の護符効果テーブル(フェーズ6で実装)には依存していない。したがって、これらの分岐は**フェーズ5の時点で完全に実装してよい(スタブ不要)**。中途半端にスタブ化すると計算順序の骨格自体が壊れるので、必ず`engine.ts`の実際のコードをそのまま1:1で移植すること。

一方で、以下の3箇所だけは、フェーズ6で実装する99種超の護符効果テーブル(および方向性1/2の売値・星片系護符)に依存しているため、**関数として正しいシグネチャ・正しい呼び出し位置を用意した上で、中身だけを無効果スタブにする**こと。

1. `apply_item_effects(channel, value, items, ctx, params)` 相当の関数
   - `playCard`から2箇所(`gained`チャンネル・`clearBonus`チャンネル)、`drawStock`の素朴(naive)分岐から1箇所(`gained`チャンネル)、計3箇所で呼ばれる。
   - スタブの戻り値: `{ value: value, parts: [] }`(受け取った値をそのまま返し、内訳パーツは追加しない)。
   - フェーズ6で、`clearBonusEffects.ts`/`cardComboEffects.ts`/`chainAttributeEffects.ts`/`stateAndPatternEffects.ts`の4テーブル(計65種の護符)+水鏡の左隣効果再適用ロジックに差し替える。
2. `resolve_play_triggered_reward_talismans(...)` 相当の関数(方向性1: 売値ボーナス系21種)
   - スタブの戻り値: `{ triggeredIds: [], amounts: {} }`。
   - フェーズ6で`rewardTalismanEffects.ts`相当の実装に差し替える。
3. `resolve_play_triggered_currency_gain(...)` 相当の関数(方向性2のうちプレイ即時トリガー3種: 賞金・僥倖・祝儀)
   - スタブの戻り値: `{ totalGain: 0 }`。
   - フェーズ6で同じく`rewardTalismanEffects.ts`相当の実装に差し替える。

この3箇所以外は、フェーズ5の時点で最終形と同じロジックを書く。

## 作業内容

1. **`patterns.ts`の全関数を移植する**(役判定・パターン判定10種の基盤)
   - `isRed`, `cardColors`(紅蓮・漆黒による色拡張の解釈), `isFace`
   - `analyzeSuitColor`(同スート/同色判定), `analyzeAlternatingColor`(交互判定)
   - `stepRank`, `analyzeStair`(階段判定), `stairUsesKALoop`(K⇔Aループ跨ぎ判定)
   - `checkFlush`, `checkRoyalSet`, `countSameRankBefore`, `countSameRankForWildPlay`, `checkCompleteRun`
   - `computePairCount`(ペア役の組数計算。ワイルド1枚をどのランクに割り振るかの解釈に注意)
   - `evaluateChainBonus`(パターンボーナス+役ボーナスの一括判定。`ChainBonusResult`として`bonus`/`parts`/`patternFired`/`patternFiredCount`/`roleFired`を返す)
   - `chainContinuesPattern`(山札めくり時のパターン継続判定に使う軽量版)
   - 10役の名称と対応関数の対応(`RoleName`型と一致させる): `suit`(同スート)/`color`(同色)/`alternating`(交互)/`stair`(階段)/`flush`(フラッシュ)/`royalSet`(ロイヤルセット)/`sameRank`(同ランク)/`completeRun`(コンプリートラン、同スート追加ボーナス込み)/`pair`(ペア)/`columnSweep`(列一掃。これだけ`patterns.ts`ではなく`playCard`本体に実装されている)
2. **`scoreParts.ts`を移植する**
   - `ScorePart`構造体(`label`/`kind`('add'|'multiply'|'lock')/`amount`/`text`/`cardIds`/`itemId`)
   - `fmtMultiplier`, `addPart`, `multiplyPart`, `lockPart`
   - `runningTotalsFromScoreParts`, `finalScoreFromScoreParts`(加算は`+=`、乗算は`*=`、lockは合計を0にリセットしてから以降を積む、という逐次計算。得点内訳UIの検証や本フェーズの動作確認ログに使う)
3. **`isPlayable`/`getPlayableRowsInColumn`/`getPlayableColumns`を移植する**
   - `faceLock`修飾子(絵札はコンボ2以上でのみ取得可)、ワイルド無条件許可、ランク差判定(隣接=1、ループ=12だが`noLoop`修飾子時は不可、秘儀エフワズ発動中は`wave.ehwazActiveThisWave`フラグにより差2・11も許可)
   - 誓約(`vow`)・契り(`pact`)によるチェーン最新実カードとの色/スート一致制約(`items.includes('vow'|'pact')`の単純な判定なので、そのまま実装してよい。秘儀エフワズの`wave.ehwazActiveThisWave`同様、対応する護符/秘儀自体がまだ入手できなくても判定式自体は害がない)
   - `getPlayableRowsInColumn`のアルギズ(`wave.playFromAnywhereActiveThisWave`)分岐、`getPlayableColumns`
4. **`playCard`本体を計算順序ごと移植する**(骨格+フック、上記の3スタブ以外は完全実装)。実際の計算順序(`engine.ts`の該当行を参照):
   1. `isPlayable`チェック、行/列の妥当性チェック
   2. コンボ加算(`newCombo`。黄金所持で+2、イサ`comboFrozenThisWave`中は加算なし、`comboCap`があればクランプ)
   3. 基礎点(`basePoint`)を`parts`に積む
   4. 鋼鉄(`mirror`)の前回予約分(`pendingRoleEcho`)を無条件加算
   5. 架橋(`bridge`)による`effectiveStairMinLen`/`effectiveSuitColorMinLen`の緩和(`resolveBridgeAdjustedLengths`)
   6. 明星(`morningStar`)・ソウィロ(rite、`wave.sowiloActiveThisWave`)による`roleBonusMultiplier`クロージャの構築
   7. 神託レベル解決(`makeOracleLevelResolver`。役封印・オラクル基準値巻き戻しを考慮)
   8. `evaluateChainBonus`呼び出し→パターン/役ボーナスを`parts`に合流
   9. 列一掃判定(`sweepQualifies`。慈悲`grace`所持時は列開始時枚数の閾値が緩和)→列一掃ボーナスを加算し`roleFired`に追加
   10. 鋼鉄(`mirror`)の次プレイ予約更新(役の出現順で1つだけ予約、同ランクは枚数段階ごとに個別管理)
   11. 治癒・再生の解決はここでは行わず、場札除去のみ反映(復活処理はコンボリセット時に共通処理)
   12. 潤沢(`abundantFunds`)判定用の「プレイ前」場札残数を別途保持
   13. 各種ウェーブ内累積フィールド更新(`sameColumnStreak`/`maxComboThisWave`/`totalColumnsEmptiedThisWave`/`columnSweepActiveThisWave`/`roleFiredThisChain`/`flushActiveThisCombo`)
   14. 祝福(`sanctify`)によるベースコンボ数(`baseComboCount`)永続加算
   15. 流星(`shootingStar`)のしきい値到達検知と`shootingStarN`蓄積(到達した同じプレイには反映されない=次プレイから効く)
   16. 献身(`dedication`)/勤勉(`diligence`)/加護(`divineProtection`)の累積倍率(`dedicationX`等)更新
   17. 庇護(`protection`)・大地(`earth`)を所持順に適用した`effectiveCombo`計算(`applyProtectionEarthFloor`)
   18. 明星用のウェーブ内役成立回数カウント更新
   19. `ItemEffectContext`を組み立て、**フック1: `apply_item_effects('gained', base, items, ctx, params)`をスタブ呼び出し**→`parts`に合流
   20. **フック2: `resolve_play_triggered_reward_talismans(...)`をスタブ呼び出し**(戻り値は上位の呼び出し元に伝播させるだけで、本フェーズでは常に空)
   21. **フック3: `resolve_play_triggered_currency_gain(...)`をスタブ呼び出し**(常に0)
   22. 果断(`discretion`)加算・流星(`shootingStar`)加算(`wave.discretionN`/`wave.shootingStarN`をそのまま加算。これらの値自体は常に初期値のまま増加しない=フェーズ7/8で秘儀・天啓・神託使用時に増加させる`applyDiscretionFrostBonus`を実装するまでは変化しない。これは正しい挙動なのでフェーズ5では気にしなくてよい)
   23. 全消しボーナス(`isFullClear`判定→`clearBonus`+山札残数分→**フック1を`clearBonus`チャンネルで再度スタブ呼び出し**)。加算項は乗算項より前に`parts`へpushする(内訳の逐次計算と整合させるため)
   24. 乗算チェーン: コンボ倍率→マンナズ(`wave.mannazActiveThisWave`。所持護符のレア度重み合計は`mannazWeightSum`で計算、C=1/U=2/R=4)→献身→勤勉→加護→星霜(`frostX`)→残響(`echoX`)→慢心(`arrogance`、山札0枚時のみ)→スリサズ(rite、`wave.nextPlayScoreMultiplier`)
   25. `Math.floor`で最終値確定→ボス得点ロック判定(`scoreLock`)で上書き
   26. 目標スコア到達判定→全消し時のコンボリセット・治癒/再生解決・`drawStock`への自動連鎖→通常のWaveState更新
5. **`drawStock`を移植する**(山札からの自動継続処理)
   - パターン継続判定(`chainContinuesPattern`)、博愛(`benevolence`)による救済継続
   - 継続時: 誠実(`sincerity`)によるコンボ直接加算、素朴(`naive`)による簡易スコア計算(**この中でも上記フック1を`gained`チャンネルでスタブ呼び出しする**。素朴自体の構造はフェーズ5で完成させてよい)
   - 非継続時(リセット): 静寂(`silence`)によるワイルド化、沈着(`composure`)/冷静(`clarity`)によるベースコンボ数加算、残響(`echo`)のリセット時蓄積、約束(`promise`)による山札並べ替え(`arrangeNextCardForContinuation`。この関数自体は完結した資源操作なのでフェーズ5で完全実装する)、治癒(`healing`)による列復活(`resolveHealingRestoration`。これも完結しているのでフェーズ5で完全実装する)
6. **`isStuck`を移植する**
   - 場札0枚→手詰まりでない、山札残あり→手詰まりでない、`getPlayableColumns`が1つ以上あれば手詰まりでない
   - ダガズ(rite `dagaz`、まだ入手不可)所持時は捨て札があれば手詰まりでない、という分岐もそのまま実装する(rites配列が常に空の間は単に発火しないだけで害はない)
   - `markStuck`も併せて移植する
7. **動作確認**: 護符・秘儀・天啓を一切持たない状態で、固定シードのデッキに対してプレイ操作を連続実行し、`ScorePart`の内訳ログ(ラベル・加算/乗算種別・逐次合計)がフェーズ1のスコア計算パイプライン仕様と一致することを確認する。特に「基礎点→鋼鉄→パターンボーナス→役ボーナス→列一掃→(スタブのため無反応)→果断/流星→全消し系→乗算チェーン→floor」という並び順そのものを目視できるログを残すこと。

## 参照すべき既存ファイル(Utilities-Svelte内)

- `src/lib/game/shidasu/engine.ts`
  - `isPlayable`(29行目〜), `getPlayableRowsInColumn`/`getPlayableColumns`(57行目〜)
  - `playCard`(364行目〜736行目)— 計算順序の正本。1行ずつ突き合わせること
  - `drawStock`(738行目〜899行目)
  - `isStuck`(1015行目〜)、`markStuck`
  - ヘルパー: `resolveBridgeAdjustedLengths`(334行目)、`applyProtectionEarthFloor`(352行目)、`makeOracleLevelResolver`(340行目)、`mannazWeightSum`(87行目)、`resolveHealingRestoration`(264行目)、`arrangeNextCardForContinuation`(122行目)、`convertCardToWildByDeckId`(114行目)、`remainingCount`(80行目)
- `src/lib/game/shidasu/patterns.ts`(全体、406行)
- `src/lib/game/shidasu/scoreParts.ts`(全体、53行)
- `src/lib/game/shidasu/itemEffects.ts` — `ItemEffectContext`インターフェースの全フィールド定義を確認する(本フェーズでは実装しないが、`playCard`/`drawStock`側で正しく組み立てて渡す必要があるため必読)。`applyItemEffects`関数自体はフェーズ6の担当だが、シグネチャ`(channel, baseValue, items, ctx, params) => { value, parts }`はここで確定させる
- `src/lib/game/shidasu/chainAttributeEffects.ts`/`cardComboEffects.ts`/`stateAndPatternEffects.ts`/`clearBonusEffects.ts` — 本フェーズでは実装しないが、フック1(`applyItemEffects`)が最終的に何を呼び出すことになるかの参考として目を通しておくと、`ItemEffectContext`の各フィールドが何のために存在するか理解しやすい
- `src/lib/game/shidasu/rewardTalismanEffects.ts` — フック2・フック3の最終形(`PlayTriggerContext`/`CurrencyGainTriggerContext`/`RewardTalismanTriggerResult`/`CurrencyGainTriggerResult`の型定義を確認し、スタブのシグネチャに反映する)

## 成果物・保存先

- `Shidasu.Core`側(フェーズ2で決定したフォルダ構成、例: `Core/`配下、Godotの機能・クラスに依存しないこと)に、パターン判定・スコア内訳・プレイ/山札めくりパイプラインのC#実装
- 護符・秘儀・天啓を一切持たない状態でRunを通しプレイし、スコア計算の逐次ログが仕様と一致することを示す動作確認記録(テストコードまたはコンソール出力のスクリーンショット等)

## 完了条件

- [ ] `patterns.ts`の全関数が`Shidasu.Core`に移植され、10役の判定結果が既存テスト(`patterns.test.ts`)の主要ケースと一致する
- [ ] `scoreParts.ts`のScorePart構造体と集計関数が移植されている
- [ ] `isPlayable`/`getPlayableRowsInColumn`/`getPlayableColumns`が移植され、`faceLock`/`noLoop`/誓約/契りの制約が正しく機能する
- [ ] `playCard`が計算順序を1つも入れ替えずに移植され、フック1〜3の3箇所のみがスタブになっている(それ以外の護符関連分岐は完全実装済み)
- [ ] `drawStock`が移植され、パターン継続時・非継続時それぞれの分岐が正しく動作する
- [ ] `isStuck`/`markStuck`が移植されている
- [ ] 護符無し状態でのRun通しプレイで、スコア内訳ログの並び順・数値がフェーズ1仕様と一致する
- [ ] `npm run build`相当の`Shidasu.Core`健全性チェック(`dotnet build`が警告・エラー無しで通る)が通る

## 注意点

- **加点・乗算の順序が1つでもズレるとバランスが崩れる**。フェーズ1のコンテンツカタログ・スコア計算パイプライン仕様書と1対1で突き合わせながら実装すること。
- フック1〜3以外の護符関連分岐(黄金・祝福・鋼鉄・献身・勤勉・加護・果断・星霜・残響・慢心・静寂・沈着・冷静・博愛・素朴・約束・再生・治癒・庇護・大地・明星・架橋・慈悲・誓約・契り)は**フェーズ5で完全実装する**。フェーズ6の作業者がこれらを見て「まだ実装されていない」と誤解し重複実装しないよう、コード中にコメントで「フェーズ5で実装済み」であることを明記しておくとよい。
- `discretion`(果断)・`frost`(星霜)は、`playCard`内で値を読んで加算/乗算する部分はフェーズ5で完成するが、その値自体を増加させる`applyDiscretionFrostBonus`相当の処理は秘儀・天啓・神託の使用時(フェーズ7)およびショップでの神託使用時(フェーズ8)に実装される。フェーズ5時点では常に初期値(discretionN=10、frostX=1)のまま増加しないのが正しい状態。
