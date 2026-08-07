# 全消しボーナスのgained計算統合 設計

## 背景・目的

現在、全消しボーナス(場札が0枚になった時に加算される`clearBonus + 残り山札枚数 × clearBonusPerStock`)は、`playCard`内の通常のgained計算(基礎点・チェーンボーナス・護符効果・コンボ倍率等)とは独立した「別枠」(`lastBonusGains: BonusGain[]`)として、コンボ倍率・献身/勤勉/加護/星霜/残響/慢心などの乗算系護符の恩恵を一切受けずに加算されている。

これは、直接点護符6個(沈着・冷静・残響・慢心・流星・誠実)を「直接点ではない別効果」に再設計した際と同じ問題意識で、プレイが進み乗算系護符が育つほど、全消しボーナスの存在感が相対的に薄くなっていく(インフレに追随できない)。全消しボーナス自体を、そのプレイの獲得点計算(gained)の内訳の一部として統合し、コンボ倍率等の恩恵を受けられるようにする。

## 変更内容

### 1. gained計算への統合

全消し判定(`remainingBeforeRevival === 0`、場札を取った結果0枚になったか)は、現状の実装でもgained計算(コンボ倍率等の乗算チェーン)より前の時点(`playCard`内、`newTableau`確定直後)で既に判明している。この情報を活用し、全消し成立時は以下をgained計算本体に組み込む:

- `clearBonus`チャンネル(忍耐・浄化・節制の護符がそのまま介入)で`rawClearBonus = params.scoring.clearBonus + wave.stock.length × params.scoring.clearBonusPerStock`への加算・倍算を計算する
- その結果を、果断(discretionAdd)・流星(shootingStarGainedAdd)と同じ位置(所持護符の`gained`チャンネル適用後、コンボ倍率等の最終乗算チェーンの直前)に加算項として合流させる
- `parts`配列にも、基礎点・チェーンボーナス等と同様に「全消しボーナス」パーツ(基礎・山札残数・護符効果の内訳を含む)を追加し、`lastGain`に統合する

`clearBonus`チャンネル自体(`applyItemEffects('clearBonus', ...)`、忍耐・浄化・節制の実装)は変更しない。全消しボーナスの基礎値に対する加算・倍算という役割のまま、呼び出しタイミングと結果の合流先だけが変わる。

### 2. ボス得点ロックとの関係

星の妨害効果によるボス得点ロック(`isBossScoreLocked`)が成立している場合、現状は通常のプレイ得点(`gained`)のみが0になり、全消しボーナスは別枠だったため影響を受けずに加算されていた。統合後は、全消しボーナスも「そのプレイの獲得点」の一部として扱われるため、ロック成立時は全消しボーナスも含めて`gained`全体が0になる。これは意図した仕様変更であり、実装上も自然な帰結になる(ロック判定は全消しボーナスを含めた`parts`確定後に行われる)。

### 3. 目標到達判定の一本化

現状は「gained確定時点でのtarget判定(全消し判定より前)」→「全消し判定・clearBonus加算」→「clearBonus込みのスコアでの再target判定」という二段階の判定がある。統合後は全消しボーナスがgained確定の一部になるため、目標到達判定は「全消しボーナス込みの最終gained確定後」の一段階に統合される。中間オブジェクト(`waveAfterClearBonus`)の構築や二段階目のtarget判定は不要になる。

### 4. `lastBonusGains`(`BonusGain`型)の完全削除

`lastBonusGains`は全消しボーナス以外の全ての箇所(沈着・冷静・残響・慢心・流星・誠実の再設計後の`resetBonusGains`・`patternContinueBonusGains`)で常に空配列になっている。全消しボーナスをgainedに統合すると、`lastBonusGains`に実質的な値が入る箇所がゼロになるため、型・フィールドごと完全に削除する。

削除対象:

- `src/lib/game/shidasu/types.ts`: `WaveState.lastBonusGains`フィールド、`BonusGain`型定義
- `src/lib/game/shidasu/engine.ts`: `bonusGains`・`resetBonusGains`・`patternContinueBonusGains`・`bonusGainsWithClear`・`waveAfterClearBonus`等の関連コード一式
- `src/routes/game/shidasu/PlayArea.svelte`: `startScoreReveal(lastGain, lastBonusGains)`のシグネチャを`startScoreReveal(lastGain)`に簡素化し、`lastBonusGains`の結合ロジック(`allParts`・`totalGain`計算)を`lastGain`単体の参照に置き換える
- `src/routes/game/shidasu/+page.svelte`・`src/routes/game/shidasu/DebugPanel.svelte`・`src/routes/admin/shidasu-debug/+page.svelte`: `lastBonusGains`への参照箇所を確認し、削除・置き換える

## 実装方針(`engine.ts`の`playCard`関数)

現状のコード構造(546〜696行目付近)を、以下の順序に組み替える:

1. `itemResult = applyItemEffects('gained', base, items, itemEffectCtx, params)`確定(現状通り)
2. 全消し成立時(`remainingBeforeRevival === 0`)のみ、`clearBonus`チャンネル計算を行い、`clearBonusAdd`(数値)と全消しボーナスの`parts`を得る。不成立時は`clearBonusAdd = 0`、`parts`への追加なし
3. `discretionAdd`・`shootingStarGainedAdd`の直後に`clearBonusAdd`を合流させ、`parts`に「全消しボーナス」の内訳(基礎・山札残数・護符効果)を追加する(乗算チェーンより前の位置を厳守。既存の「加算項は乗算項より前にpushする」というルールに従う)
4. 最終乗算チェーン適用、`Math.floor`
5. ボス得点ロック判定(現状通り、全消しボーナスを含めた`parts`・`gained`が対象になる)
6. `scoreAfterGained`・目標到達判定(`targetReachedOnGained`)を、この時点の一度だけ行う
7. `next`(`WaveState`)構築時、`lastBonusGains`フィールドは削除済みのため設定不要
8. 全消し成立時(`remainingBeforeRevival === 0`)は、`next`構築後に現状通り`resetComboFields`でコンボリセット→治癒(healing)・再生(regeneration)の護符処理→残り場札の有無に応じて`drawStock`再帰継続 or `fullClear`終了、という後処理フローをそのまま維持する(ただし`clearBonus`加算・`waveAfterClearBonus`構築・二段階target判定は既にステップ2〜6で完了しているため削除する)

## テスト方針

- `engine.test.ts`内の既存の全消しボーナステスト(「場札が0枚になったら全消しボーナスが加算されendReason=fullClear」「全消し時、lastBonusGainsに全消しボーナスが別枠で入る」等)を、`lastGain.parts`に全消しボーナスが含まれ、`lastGain.points`にコンボ倍率等が反映された値になることを検証するテストに書き換える
- clearBonusチャンネル護符(忍耐・浄化・節制)のテストを、新しい統合後の計算結果で検証し直す
- コンボ倍率・献身等の乗算護符と全消しボーナスを組み合わせた場合に、乗算が正しくかかることを検証する新規テストを追加する
- ボス得点ロック成立時、全消しボーナスも含めて`gained`が0になることを検証する新規テストを追加する
- 「列を単一にすると全消しボーナスが別枠で加算されscoreの比較が崩れるため、ダミー列を残して全消しにならないようにする」という趣旨のコメントが複数箇所(ボス得点ロック関連テスト等)にあるが、これらは全消しボーナスが「別枠」だったことに起因する回避策だったため、統合後は全消しが起きても`lastGain.points`ベースの比較で問題なく検証できるようになる可能性がある。ただし今回のタスクでは、これら既存テストの前提(ダミー列で全消しを回避する構成)自体は変更せず、コメントが不要になった場合のみ削除する程度の最小限の追従に留める(大規模なテスト構成の見直しは対象外)
- `PlayArea.svelte`の`startScoreReveal`のシグネチャ変更に伴うテスト(存在すれば)を確認・更新する

## 除外・非対象

- `clearBonus`チャンネル自体(`applyItemEffects`の仕組み、忍耐・浄化・節制の効果内容)は変更しない
- 治癒・再生の護符処理ロジック自体は変更しない(全消し成立後の後処理という位置づけは維持)
- 全消しボーナスの基礎値(`clearBonus`・`clearBonusPerStock`のデフォルト数値)は変更しない
- 「列を単一にして全消しボーナスの影響を避ける」という既存テストの構成自体の大規模な見直しは対象外(コメント文言の追従のみ)
