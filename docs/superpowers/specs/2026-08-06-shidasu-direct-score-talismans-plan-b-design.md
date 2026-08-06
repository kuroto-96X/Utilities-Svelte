# 直接点護符の再設計(案B採用) 設計

## 背景・目的

`docs/shidasu/shidasu-direct-score-talismans-redesign.md`で洗い出した、既存の直接点護符6個(沈着・冷静・残響・慢心・流星・誠実)の変更候補12案(各護符2案)のうち、全ての護符で「案B」(取得点化ではない別発想)を採用し、正式な実装設計としてまとめる。

「直接点」は`lastBonusGains`経由で即時加算される仕組みで、コンボ倍率・献身/勤勉/加護などの乗算系護符の恩恵を一切受けない。プレイが進み他の護符が育つほど、直接点護符の存在感が相対的に薄くなっていく(インフレに追随できない)という問題意識から、この再設計を行う。今回の実装により、`directEffects.ts`が扱う「直接点」という加点先の概念自体がゲームから無くなる。

## 新効果一覧

| 護符 | 現効果 | 新効果(案B) | 実装パターン |
|---|---|---|---|
| 沈着(composure) | コンボリセット時(取れる場札なし)、直接+500点 | コンボリセット時(取れる場札なし)、`baseComboCount`を永続+n | コンボ基礎値強化型(祝福と同型) |
| 冷静(clarity) | コンボリセット時(役なし)、直接+500点 | コンボリセット時(役なし)、`baseComboCount`を永続+n | コンボ基礎値強化型(祝福と同型) |
| 残響(echo) | コンボリセット時、リセット前コンボ数×n点を直接加算 | コンボリセット時(常時)、リセット前コンボ数に応じて永続倍率`echoX`が蓄積(以後`gained`に乗算) | 累積スケーリング型(星霜と同型、Run全体で永続) |
| 慢心(arrogance) | 山札切れ時、場札残数×x点を直接加算 | 通常のカードプレイ(`playCard`)の`gained`計算時、山札残り0枚なら`gained`をx倍 | 条件付き恒久倍率型(新規パターン) |
| 流星(shootingStar) | コンボc到達時、現在スコアのp%を直接加算 | コンボc到達のたび、永続加算`shootingStarN`が蓄積(以後`gained`に加算) | 累積スケーリング型(果断と同型、Run全体で永続) |
| 誠実(sincerity) | 同色パターン継続時、直接+n点 | パターン継続全般(同スート・同色・階段問わず)によりコンボが継続したとき、`wave.combo`に直接+n | 直接コンボ押し上げ型(新規、トリガー条件も同色限定から拡張) |

## パラメータ設計

| 護符 | レア度(変更なし) | 新パラメータ | 設計根拠 |
|---|---|---|---|
| 沈着 | C | `n=1` | 祝福(R、固定+1、パラメータ無し)より発動条件が限定的(取れる場札が無い場合のみ)。レア度Cで+1は妥当。将来の強化余地のためパラメータ化する |
| 冷静 | C | `n=1` | 沈着と同型の理由 |
| 残響 | U | `n=0.001`、初期`echoX=1` | 星霜(x=0.01固定増分)と異なり「リセット前コンボ数」というスケーリング変数がかかるため、桁を1/10程度に抑える(コンボ10で+0.01) |
| 慢心 | C | `x=1.5` | 蓄積ではなく条件成立時の固定倍率。山札切れ後の終盤フェーズを安定して底上げする |
| 流星 | R | `c=10`(維持)、初期`shootingStarN=50`、`n=50`(到達のたび+50) | 果断(C、初期10、+10)より上位のレア度Rなので、初期値・増分とも上位に設定する |
| 誠実 | C | `n=1` | `wave.combo`を直接+1押し上げる。トリガー頻度がパターン継続全般に拡張されるため、n=1で十分機能する |

いずれも実装時に微調整可能な初期値として設定する。ゲームバランスの最終調整は本設計の対象外。

## 実装方針

### 1. `directEffects.ts`一式の削除

新設計後、6護符すべてが直接点チャンネル(`resetDirect`・`stockEmptyDirect`・`comboMilestoneDirect`・`drawContinueDirect`)を使わなくなるため、以下を完全に削除する。

- `src/lib/game/shidasu/directEffects.ts`(ファイル自体を削除)
- `src/lib/game/shidasu/directEffects.test.ts`(ファイル自体を削除)
- `src/lib/game/shidasu/testHelpers.ts`の`directCtx`ヘルパーとその型import(`DirectEffectContext`)
- `src/lib/game/shidasu/engine.ts`内の`applyDirectEffects`呼び出し4箇所(`resetDirect`・`stockEmptyDirect`・`comboMilestoneDirect`・`drawContinueDirect`)、および各呼び出しに付随する`DirectEffectContext`オブジェクトの構築コード、`DirectEffectContext`のimport
- `engine.test.ts`内の、直接点護符(沈着・冷静・残響・慢心・流星・誠実)の**現行効果**を検証しているテストケース(新効果のテストに置き換える)

`stockEmptyDirect`・`comboMilestoneDirect`・`drawContinueDirect`チャンネル自体は本設計後に使用する護符が無くなるが、これらのチャンネルが担っていた「発火タイミングの判定ロジック」(`hasPlayableColumns`・`roleFiredThisChain`・`comboBeforeReset`・`wouldContinue`到達判定など)は、各護符の新実装が直接参照する形でengine.ts内に残る。

### 2. 沈着・冷静: `baseComboCount`強化型

engine.ts内、コンボリセット処理(`drawStock`内、`resetComboFields`呼び出し元)で、`resetDirect`チャンネルの代わりに以下を計算し、`resetWave`の`baseComboCount`に反映する。

```ts
const composureAdd = !hasPlayableColumns && items.includes('composure') ? params.talismans.composure.n : 0
const clarityAdd = !wave.roleFiredThisChain && items.includes('clarity') ? params.talismans.clarity.n : 0
```

`resetWave`構築時に`baseComboCount: wave.baseComboCount + composureAdd + clarityAdd`を設定する(祝福の`newBaseComboCount`計算と同じ形)。両方の条件が同時に成立する場合(取れる場札が無く、かつ役も一つも成立していない)は両方分加算される。

### 3. 残響: 累積スケーリング型(`echoX`)

`WaveState`・`RunState`双方に`echoX: number`を追加する(`dedicationX`・`frostX`と同じ「WaveState側に正本、startWaveでRunStateからコピー、resolveWaveEndでRunStateへ書き戻す」パターン)。`beginRun`で`echoX: 1`に初期化する。

コンボリセット処理で、リセット前コンボ数(`wave.combo`)を使って以下を計算し、`resetWave`に反映する。

```ts
const echoAdd = items.includes('echo') ? wave.combo * params.talismans.echo.n : 0
```

`resetWave`構築時に`echoX: wave.echoX + echoAdd`を設定する。以後`gained`計算の乗算チェーンに`frostFactor`と同様の形で`echoFactor = items.includes('echo') ? wave.echoX : 1`を加える。

### 4. 慢心: 条件付き恒久倍率型

`playCard`内の`gained`計算の乗算チェーン(`frostFactor`等が並ぶ箇所)に、以下を追加する。

```ts
const arroganceFactor = items.includes('arrogance') && newStock.length === 0 ? params.talismans.arrogance.x : 1
```

`newStock`は`playCard`内でその時点の山札残数を保持する変数(既存のスコープ変数を流用)。`naive`パス(`drawStock`内のパターン継続時のgained計算)には適用しない。

### 5. 流星: 累積スケーリング型(`shootingStarN`)

`WaveState`・`RunState`双方に`shootingStarN: number`を追加する(`discretionN`と同じ同期パターン)。`beginRun`で`shootingStarN: 50`(初期値)に初期化する。

コンボ到達判定箇所(現行の`milestoneCtx`構築箇所、`previousCombo < c <= newCombo`の判定)で、到達した場合に以下を計算し、`next`(プレイ後の`WaveState`)に反映する。

```ts
const shootingStarAdd = items.includes('shootingStar') && wave.combo < params.talismans.shootingStar.c && newCombo >= params.talismans.shootingStar.c
  ? params.talismans.shootingStar.n
  : 0
```

`next`構築時に`shootingStarN: wave.shootingStarN + shootingStarAdd`を設定する。以後`gained`計算に`discretionAdd`と同様の形で`shootingStarGainedAdd = items.includes('shootingStar') ? wave.shootingStarN : 0`を加算する(到達したそのプレイの`gained`には反映されず、次のプレイから効く。果断・星霜と同じ挙動)。

### 6. 誠実: 直接コンボ押し上げ型・トリガー拡張

`drawStock`内、パターン継続判定(`wouldContinue`)箇所で、現行の`colorHeld && !suitHeld`という同色限定の絞り込みを外し、`wouldContinue`が真であれば(同スート・同色・階段のいずれでも)誠実が発火するようにする。

```ts
const sincerityAdd = wouldContinue && items.includes('sincerity') ? params.talismans.sincerity.n : 0
```

`naiveCombo`・`continueWave.combo`の算出時に、この`sincerityAdd`を加算する。`naive`護符の有無に関わらず、パターン継続が成立すれば`wave.combo`自体が押し上げられる(`naive`が無い場合は得点計算パス自体が発生しないが、コンボの底上げは行われ、次にプレイするカードの`effectiveCombo`計算に反映される)。

## テスト方針

- `directEffects.test.ts`は削除する(対象コード自体が無くなるため)
- `engine.test.ts`内の各護符(沈着・冷静・残響・慢心・流星・誠実)の既存テストを、新効果の検証に書き換える
  - 沈着・冷静: リセット時に`baseComboCount`が+nされること、両方の条件が同時成立した場合に両方分加算されること
  - 残響: リセット前コンボ数に応じて`echoX`が加算されること、Wave失敗後も次Waveに`echoX`が引き継がれること(`resolveWaveEnd`経由)、`gained`計算に`echoX`が乗算されること
  - 慢心: `playCard`で山札残り0枚のとき`gained`がx倍されること、山札が1枚以上残っている場合は適用されないこと、`naive`パス(山札めくり時)には適用されないこと
  - 流星: コンボがcに到達した瞬間に`shootingStarN`が加算されること、到達した同じプレイの`gained`には反映されないこと、Run全体で永続すること
  - 誠実: 同スート・階段パターンの継続でも(同色に限らず)発火すること、`wave.combo`が直接+nされること、`naive`を持たない場合でも`combo`が押し上げられること
- `testHelpers.ts`の`directCtx`ヘルパーを削除する
- 型チェック(`npm run check`)でコンパイルエラーが解消されることを確認する

## 除外・非対象

- 各護符のレア度自体の見直しは対象外(現状のレア度を維持する)
- パラメータの最終的なゲームバランス調整(n・x・cの値の微調整)は本設計の対象外。ここで示す値は実装時の初期値であり、プレイテストを経て調整される想定
- 直接点護符6個以外の護符(献身・勤勉・加護・果断・星霜・祝福など、参照元として使う既存護符)への変更は対象外
