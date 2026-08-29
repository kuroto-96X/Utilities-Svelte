# スコア計算パイプライン仕様(Web版実装トレース)

移植の正はコード。本書は `src/lib/game/shidasu/engine.ts` の `playCard`・`drawStock`・`isPlayable`・`isStuck`、および関連する
`scoreParts.ts`・`patterns.ts`・`itemEffects.ts`・`chainAttributeEffects.ts`・`cardComboEffects.ts`・`stateAndPatternEffects.ts`・
`clearBonusEffects.ts` の実際の呼び出し順序を、行番号付きでそのままトレースしたもの。要約ではなく実装の再現を目的とする。

対象コミット時点のファイル行数: `engine.ts` 2022行、`scoreParts.ts` 53行、`patterns.ts` 406行、`chainAttributeEffects.ts` 262行、
`cardComboEffects.ts` 134行、`stateAndPatternEffects.ts` 155行、`itemEffects.ts` 89行、`clearBonusEffects.ts` 25行、`deck.ts` 112行。

**注意**: `playCard`は`engine.ts:364`で定義されている(タスク指示にあった「1364行目付近」は誤り。実際は364行目)。

---

## 0. ScorePart の基本仕様(`scoreParts.ts`)

得点内訳は `ScorePart[]` という配列で構築され、後から `runningTotalsFromScoreParts` で再生できる。

```ts
interface ScorePart {
  label: string
  kind: 'add' | 'multiply' | 'lock'
  amount: number
  text: string
  cardIds?: number[]
  itemId?: ItemId
}
```

- `addPart(label, amount, cardIds?)` — 加算ステップ
- `multiplyPart(label, factor)` — 乗算ステップ
- `lockPart(label)` — それまでの合計を無条件に0にする特殊ステップ(ボス得点ロック専用)

`runningTotalsFromScoreParts`(`scoreParts.ts:37-47`)は配列を先頭から舐め、`add`は加算・`multiply`は乗算・`lock`は0リセットを
逐次適用して各ステップ後の仮合計を返す。**床関数(`Math.floor`)は最後の要素にのみ適用しない**(呼び出し側が
`finalScoreFromScoreParts`で最終値だけ丸める)。これは `playCard`/`drawStock` の実装(護符効果を順に適用し、最後にコンボ倍率・
マンナズ倍率等をかけて**1回だけ**床関数を適用する)と完全に一致するよう意図的に設計されている(`scoreParts.ts:32-36`のコメント)。
つまり **`Math.floor`は途中の各加算/乗算では一切呼ばれず、最終乗算チェーンの後に1回だけ呼ばれる**(例外は後述の全消しボーナス
`clearBonusAdd`と列一掃ボーナス`sweepGain`で、これらは加算項として合流する前に個別に`Math.floor`される。詳細は下記)。

---

## 1. `isPlayable`(`engine.ts:29-53`)

1枚のカードが今、場から取れるかどうかの判定。**上から順に評価され、最初に確定した条件で返る**。

1. **faceLock最優先**: `modifier === 'faceLock' && isFace(card) && wave.combo < 2` → `false`
   (絵札固定の星ではワイルド場札であっても、コンボ2未満なら絵札は拒否。ワイルド優先判定より前に評価される)
2. `card.wild || wave.foundation.wild` → `true`(自分がワイルド、または場札がワイルドなら常に取れる)
3. ランク差判定: `d = |card.rank - wave.foundation.rank|`
   `rankOk = d===1 || (d===12 && modifier!=='noLoop') || (wave.ehwazActiveThisWave && (d===2 || (d===11 && modifier!=='noLoop')))`
   - `d===12` はK⇔Aのループ隣接(`noLoop`星では無効)
   - `ehwazActiveThisWave`(秘儀エイワズ発動中)は隣接判定を2ランク先まで拡張する(`d===2`、および`noLoop`でなければ`d===11`のループも)
4. `!rankOk` → `false`
5. 誓約(`vow`)・契り(`pact`)によるチェーン最新実カードとの色/スート制約(チェーン最新の実カードが無ければ制約なし):
   - `vow`所持時: `cardColors`(紅蓮・漆黒の拡張込み)で赤/黒どちらも一致しなければ`false`
   - `pact`所持時: 自分がワイルドでなく、かつ最新実カードとスートが異なれば`false`
6. どの条件にも引っかからなければ `true`

`getPlayableRowsInColumn`(`engine.ts:57-70`)は、秘儀アルギズ発動中(`playFromAnywhereActiveThisWave`)は列内の全行を、
それ以外は一番上の1行のみを`isPlayable`で判定する。`getPlayableColumns`(`engine.ts:72-78`)は各列にそれが1つでもあれば
その列インデックスを集合に含める。

---

## 2. `playCard`(`engine.ts:364-736`)本体の計算順序

### 2.1 前提ガード(364-390)
以下のいずれかに該当すれば即座に無得点で返す(`{ wave, deckComposition, rewardTalismanTrigger: noTrigger, currencyGain: 0 }`):
`wave.status!=='playing'` → 列が空/存在しない → `rowIndex`指定がアルギズ非発動中に最上段以外 → カードが存在しない →
`isPlayable`が`false`。

### 2.2 コンボ数の先行更新(392-400)
```
newCombo = min(
  comboCap ?? Infinity,
  wave.comboFrozenThisWave ? wave.combo : wave.combo + (items.includes('golden') ? 2 : 1)
)
```
黄金(`golden`)所持で+2、イサ(凍結)発動中は加算なし。`comboCap`(妨害由来)はここでのみ`wave.combo`系をクランプし、
得点計算用の`effectiveCombo`(後述)には別途適用される。

### 2.3 基礎点の起点(401-408)
1. `base = params.scoring.basePoint`、`parts = [addPart('基礎点', base)]`
2. 鋼鉄(`mirror`)所持かつ`wave.pendingRoleEcho`があれば、前回プレイで予約された役ボーナスの遅延複製を無条件加算
   (`base += pendingRoleEcho.amount`、`parts.push(addPart('鋼鉄(役名)', amount))`)

### 2.4 チェーンボーナス(409-437) — `patterns.ts`呼び出し
1. `resolveBridgeAdjustedLengths`(架橋護符による階段/同スート同色の最小長緩和)→ `effectiveStairMinLen`, `effectiveSuitColorMinLen`
2. `roleBonusMultiplier(name)`クロージャを定義(明星`morningStar`のウェーブ内累積成立回数倍率 × ソウィロ発動中の役倍率)。
   **この時点では呼ばれず、後段の`evaluateChainBonus`と列一掃ボーナス計算の中で都度呼ばれる**。
3. `oracleLevel = makeOracleLevelResolver(wave, sealedRoleEffect)`(役封印/神託封印を反映したレベル解決関数)
4. `evaluateChainBonus(scoring, wave.chain, card, effectiveStairMinLen, roleBonusMultiplier, effectiveSuitColorMinLen, oracleLevel, items)`
   を呼び、`chainResult`を得る → `base += chainResult.bonus`、`parts.push(...chainResult.parts)`

#### `evaluateChainBonus`(`patterns.ts:239-385`)内部の判定順序
チェーンが空なら即`{bonus:0, parts:[], patternFired:false, patternFiredCount:0, roleFired:[]}`。以降は**この順**で判定・加点
(各加点は`Math.floor(単価 × oracleLevel × [roleBonusMultiplierを掛けるものは掛ける])`で個別に丸められ、`bonus`に加算される):

1. **同スート/同色**(`analyzeSuitColor`、`chainIncludingThis.length >= suitColorMinLen`が条件):
   同スート成立なら`suitBonus`、そうでなく同色成立なら`colorBonus`(排他、同時成立なし)。成立時`patternFired=true`, `patternFiredCount+=1`
2. **交互**(`analyzeAlternatingColor`、`alternatingMinLen`基準): 成立で`alternatingBonus`、`patternFired=true`, `patternFiredCount+=1`
3. **階段**(`analyzeStair`、`stairInfo.held && stairInfo.len>=stairMinLen`): `stairBonus`、`patternFired=true`, `patternFiredCount+=1`
4. **フラッシュ**(`checkFlush`、直近4枚): `flushBonus × roleBonusMultiplier('flush')`。`roleFired`に`{name:'flush', usedWild, amount}`を追加
5. **ロイヤル**(`checkRoyalSet`、直近3枚がJQK): `royalSetBonus × roleBonusMultiplier('royalSet')`。`roleFired`に追加
6. **同ランク**(`countSameRankBefore`/ワイルド自身は`countSameRankForWildPlay`): `sameRankBonusUnit × 枚数 × roleBonusMultiplier('sameRank')`。`roleFired`に追加
7. **コンプリートラン**(`checkCompleteRun`、13ランク到達): `completeRunBonus × roleBonusMultiplier('completeRun')`。
   **さらに同スート成立中なら**`completeRunSuitBonus`を追加加点(同じ`roleBonusMultiplier('completeRun')`を使う)。
   両者の合計を`roleFired`の`completeRun`の`amount`として1エントリにまとめる
8. **ペア**(`computePairCount`、チェーン全体のランク別2枚以上組数。マイルストーン方式で同一組数の再発火なし):
   `pairBonusUnit × 組数 × roleBonusMultiplier('pair')`。`roleFired`に追加

戻り値の`roleFired`は`{name, usedWild, amount}[]`(列一掃はこの時点では含まれず、`playCard`側で後から合流)。

### 2.5 列一掃ボーナス(439-460)
1. `chainIncludingThis = [...wave.chain, card]`
2. `newTableau`: プレイした行をその列から除去した新しい場札
3. `columnJustEmptied = newTableau[colIndex].length === 0`
4. `sweepQualifies`: 庇佑(`grace`)所持時は`streakStartLength <= rows - grace.m`、それ以外は`streakStartLength === rows`
   (かつ`columnJustEmptied`が前提)
5. 成立なら `sweepGain = Math.floor(scoring.columnSweepBonus × oracleLevel('columnSweep') × newColumnsEmptied × roleBonusMultiplier('columnSweep'))`
   を`base`に加算し、`parts.push(addPart('列一掃', sweepGain))`、`roleFired.push({name:'columnSweep', usedWild:false, amount:sweepGain})`
   (`newColumnsEmptied`はこのコンボ中の列一掃累計回数で、列一掃ボーナスは累計回数に比例して増える)

### 2.6 鋼鉄(mirror)の次回予約(462-484)
今回成立した`roleFired`のうち、まだこのコンボで遅延複製を予約していない役を1つだけ次のプレイへ予約する
(`newPendingRoleEcho`)。**この処理自体は今回のスコアには影響しない**(次回`playCard`の2.3節で消費される)。
優先順位は`roleFired`の出現順=フラッシュ→ロイヤル→同ランク→コンプリートラン→列一掃の判定順。

### 2.7 各種派生状態の算出(486-537)
スコア計算に使う値・次waveに引き継ぐ値をここでまとめて計算する(得点そのものへの寄与は次項以降で個別に説明):
- `remainingBeforeRevival`/`remaining`/`remainingBeforeThisPlay`(場札残数、全消し判定・各護符コンテキストに使用)
- `newSameColumnStreak`・`newMaxComboThisWave`・`newTotalColumnsEmptiedThisWave`・`newColumnSweepActiveThisWave`・
  `newRoleFiredThisChain`・`newFlushActiveThisCombo`
- `newBaseComboCount`(祝福`sanctify`: 役成立ごとに基礎コンボ数を永続+1)
- `newShootingStarN`(流星`shootingStar`: コンボが閾値`c`に到達した瞬間、`n`を永続加算。**このプレイの得点には未反映、次プレイから効く**)
- `newDedicationX`(献身`dedication`: フラッシュ成立のたび`n`加算、永続)
- `newDiligenceX`(勤勉`diligence`: 同ランク成立のたび`n`加算、永続)
- `newDivineProtectionX`(加護`divineProtection`: ロイヤル成立のたび`n`加算、永続)
- `effectiveCombo = applyProtectionEarthFloor(items, params, newCombo + newBaseComboCount)`
  — 庇護(`protection`: `effectiveCombo`が閾値`c`未満なら底上げ)・大地(`earth`: `+c`)を**所持順(`items`配列の並び順)**で適用
- `newRoleOccurrenceCountThisWave`(明星`morningStar`用、今回成立した役ごとに+1。**次回以降の`roleBonusMultiplier`に反映**、今回には未反映)

### 2.8 護符gainedチャンネル効果の適用(539-563) — `itemEffects.ts`経由
1. `itemEffectCtx: ItemEffectContext`を構築(`combo: effectiveCombo`、`chain: chainIncludingThis`、`remainingTableauCount: remaining`、
   `chainBonus: {...chainResult, roleFired}`(列一掃込みの最終`roleFired`)、`isPlayAction: true`、
   `playCountInChain: このチェーン内のplay起源手数+1` 等)
2. `itemResult = applyItemEffects('gained', base, items, itemEffectCtx, params)`
   — `base`(基礎点+チェーンボーナス+列一掃ボーナス+鋼鉄複製、まだ護符未適用の値)を初期値として、
   **`items`配列の先頭から順に**`gained`チャンネルの護符効果(`chainAttributeEffects.ts`・`cardComboEffects.ts`・`stateAndPatternEffects.ts`
   — 詳細は3節)を1つずつ適用し、`value`を書き換えていく(加算/乗算どちらも同じ`value`に対して逐次適用、`Math.floor`はしない)。
   水鏡(`waterMirror`)所持時は、直前(`i-1`番目)の護符の効果をこの時点の`value`に対してもう一度適用する
   (`itemEffects.ts:76-85`)
3. `parts.push(...itemResult.parts)`

### 2.9 報酬トリガー・通貨獲得(副系統、スコアに非混入)(565-579)
- `rewardTalismanTrigger = resolvePlayTriggeredRewardTalismans(...)`(方向性1系護符14種のトリガー判定。`applyPlayCard`側で
  `sellBonus`に反映、この関数の戻り値のスコア`gained`には一切影響しない)
- `currencyGainResult = resolvePlayTriggeredCurrencyGain(...)`(賞金・僥倖・祝儀。`currencyGain`として別途返る)

### 2.10 加算項の追加合流(581-597)
**乗算チェーンより前に、加算項として`Math.floor`前の値へpushする**(コメントで明示、`runningTotalsFromScoreParts`の逐次計算と
整合させるため):
1. `discretionAdd = items.includes('discretion') ? wave.discretionN : 0`(果断。非0なら`addPart('果断', ...)`)
2. `shootingStarGainedAdd = items.includes('shootingStar') ? wave.shootingStarN : 0`(流星の**現在の**永続値。非0なら`addPart('流星', ...)`)
3. **全消しボーナス**: `remainingBeforeRevival === 0`(このプレイで場札が0枚)なら
   - `rawClearBonus = scoring.clearBonus + wave.stock.length * scoring.clearBonusPerStock`
   - `clearBonusResult = applyItemEffects('clearBonus', rawClearBonus, items, itemEffectCtx, params)`
     (忍耐`patience`・浄化`purify`・節制`temperance`。`clearBonusEffects.ts`、3.4節)
   - `clearBonusAdd = Math.floor(clearBonusResult.value)` — **ここだけ他の加算項と独立して先に床関数を適用**
   - `parts.push(addPart('全消し基礎', clearBonus))`, `parts.push(addPart('全消し山札残数', stock.length*clearBonusPerStock))`,
     `parts.push(...clearBonusResult.parts)`

### 2.11 最終乗算チェーン(598-617)
以下を**この順**で計算し、それぞれ`!==1`のときのみ`parts.push(multiplyPart(...))`する(`ScorePart`には積まれるが、
実際の乗算はどの順でも交換法則により結果は同じ。ただし内訳表示の順序はこの順に固定される):

1. `multiplier = 1 + effectiveCombo * scoring.comboMultiplierStep`(コンボ倍率)
2. `mannazFactor = wave.mannazActiveThisWave ? 1 + mannazWeightSum(items, params) * rites.mannaz.x : 1`(マンナズ。所持護符のレア度重み合計 × x)
3. `dedicationFactor = items.includes('dedication') ? wave.dedicationX : 1`(献身の現在値)
4. `diligenceFactor = items.includes('diligence') ? wave.diligenceX : 1`(勤勉の現在値)
5. `divineProtectionFactor = items.includes('divineProtection') ? wave.divineProtectionX : 1`(加護の現在値)
6. `frostFactor = items.includes('frost') ? wave.frostX : 1`(星霜の現在値。天啓/神託/秘儀使用のたび加算、`applyDiscretionFrostBonus`で更新)
7. `echoFactor = items.includes('echo') ? wave.echoX : 1`(残響の現在値)
8. `arroganceFactor = items.includes('arrogance') && wave.stock.length === 0 ? talismans.arrogance.x : 1`(慢心。山札0枚時のみ)
9. `thurisazFactor = wave.nextPlayScoreMultiplier`(スリサズ秘儀による次回1手限定倍率。`next`構築時に`1`へリセットされる)

最終行:
```ts
gained = Math.floor(
  (itemResult.value + discretionAdd + shootingStarGainedAdd + clearBonusAdd)
  * multiplier * mannazFactor * dedicationFactor * diligenceFactor
  * divineProtectionFactor * frostFactor * echoFactor * arroganceFactor * thurisazFactor
)
```
**`Math.floor`はこの1箇所のみ**(全消しボーナスの`clearBonusAdd`自体の内部floorを除く)。

### 2.12 ボス得点ロック(618-622)
`scoreLock`が設定されており`isBossScoreLocked(scoreLock, effectiveCombo, card)`が真なら:
`parts.length = 0`(内訳を全消去)→ `parts.push(lockPart(bossScoreLockMessage(scoreLock)))` → `gained = 0`
(`isBossScoreLocked`の判定: `combo`種は`effectiveCombo <= maxCombo`、`suit`種は非ワイルドかつ該当スート、
`oddCombo`種は`effectiveCombo % 2 === 1`、`face`種は非ワイルドかつ絵札。`engine.ts:311-324`)

**このロックは`gained`確定後・`wave.score`加算前に適用されるため、常にその手の獲得点を完全に0にする**
(既存の`wave.score`自体は減らない)。

### 2.13 スコア確定・目標判定・全消し後処理(624-736)
1. `scoreAfterGained = wave.score + gained`
2. `targetReachedOnGained = scoreAfterGained >= target`(全消し判定より**先に**目標到達を確認する)
3. `next: WaveState`を構築(`tableau`更新、`foundation=card`、`combo=newCombo`、`chain`/`chainOrigin`追記、
   `score=newScore`、`lastGain={points:gained, parts}`、2.7節の各種派生状態を反映、`nextPlayScoreMultiplier:1`にリセット等)
4. **`targetReachedOnGained`が真なら即`status:'ended', endReason:'target'`で返す**(全消し分岐より優先、全消しボーナスは
   既に`gained`に合流済みなのでこの時点のスコアで確定)
5. そうでなく`isFullClear`(=`remainingBeforeRevival===0`)なら:
   a. `resetComboFields(next, params)`でコンボ状態をリセット(`waveReset.ts`。コンボリセットシールド発動中は状態維持、
      通常時はチェーンを捨て札へ送り`combo`を0またはナウジズ発動中は半減)
   b. 所持護符を順に見て、治癒(`healing`)なら`resolveHealingRestoration`(直前に列一掃した列へ捨て札から復活)、
      再生(`regeneration`)なら条件(場札0・未使用・山札>0)を満たせば捨て札から新しい場札を配り直し、
      `score -= floor(score * regeneration.p / 100)`
   c. 復活後もなお場札が残っていれば: 山札があれば`drawStock`を再帰的に呼んで継続、無ければそのまま`playing`で返す
   d. 復活後も場札が0のままなら`status:'ended', endReason:'fullClear'`
6. 上記いずれでもなく`newScore >= target`なら`status:'ended', endReason:'target'`
7. どれにも該当しなければ`next`を`status:'playing'`のまま返す

---

## 3. 護符gainedチャンネル効果の中身(`itemEffects.ts`が束ねる4ファイル)

`itemEffects.ts:52-57`で以下の順にオブジェクトスプレッドされ、`ITEM_EFFECTS`という1つの`Partial<Record<ItemId, ...>>`になる
(スプレッド順序自体はキー重複が無い限りJSでは意味を持たないが、ソース上の整理順として記載):
`CLEAR_BONUS_EFFECTS` → `CARD_COMBO_EFFECTS` → `CHAIN_ATTRIBUTE_EFFECTS` → `STATE_AND_PATTERN_EFFECTS`

`applyItemEffects`自体の適用順序は**`ITEM_EFFECTS`の定義順ではなく、呼び出し時に渡される`items: ItemId[]`(所持順)**で決まる
(`itemEffects.ts:68-86`のfor文)。同じ`channel`(`'gained'`または`'clearBonus'`)に属する護符だけが対象になる。

### 3.1 `chainAttributeEffects.ts`(チェーン全体の属性で判定、いずれも`channel:'gained'`)
チェーン中の全実カードが特定条件を満たすか(絵札なし=平穏/安寧、絵札のみ=運命/宿命、A〜10のみ=安堵、単一スート専有=深緑/宝石/
真剣/聖杯、単一色専有=月光/陽光、赤黒枚数バランス=均衡/調和 等)を判定し、加算または乗算する。高潔/執念/覚悟/威光/循環/輪廻は
`analyzeSuitColor`/`analyzeStair`/`stairUsesKALoop`(いずれも`patterns.ts`)を直接呼び直して判定する。

### 3.2 `cardComboEffects.ts`(今回のカード・直前の場札・現在コンボ数で判定、いずれも`channel:'gained'`)
今回のカードのスート(春風/夏風/秋風/冬風)、直前の場札との関係(友愛/雪解/宵闇/払暁)、今回カードがワイルドか(機知)、
現在の`combo`値(勇気=線形加算、暁/黄昏=閾値以下/以上で倍率、快活/良心=偶奇、朝霧=閾値未満/以上で逆数or倍率)、
誓約/契り/白銀は無条件倍率。

### 3.3 `stateAndPatternEffects.ts`(このプレイで確定した各種フラグ・カウンタで判定、いずれも`channel:'gained'`)
場札残数(兆し/三日月)、`chainBonus.roleFired`の有無・種類(恩寵/集中/瑠璃/翡翠/無心)、プレイ回数(序章/幕間/朝露/小雨)、
同一列連続プレイ数(微風/共鳴)、ウェーブ内累計(蒼穹/琥珀)、現在コンボ中のフラッシュ/列一掃発動有無(情熱/闘志)、
山札めくりでのコンボ継続回数(直感)、慈悲フラグ、山札残数に比例(刻限)。

### 3.4 `clearBonusEffects.ts`(全消しボーナスにのみ適用、いずれも`channel:'clearBonus'`)
忍耐(山札残数比例加算)・浄化(固定加算)・節制(山札残数比例倍率)。`playCard`2.10節の全消し分岐でのみ呼ばれる
(`drawStock`では全消しは発生しないため呼ばれない)。

---

## 4. `drawStock`(`engine.ts:738-899`)

山札から1枚めくる処理。**プレイ操作ではないため、新設計(方向性1)の護符トリガー・賞金/僥倖/祝儀の再判定は行わない**
(`playCard`から継続呼び出しされた場合は直前に計算済みの`rewardTalismanTrigger`/`currencyGain`をそのまま引き継ぐ)。

### 4.1 前提ガード(750-751)
`wave.status !== 'playing'` または `wave.stock.length === 0` → 無変化で返す。

### 4.2 めくり札とパターン継続判定(753-761)
1. `drawnCard = newStock.pop()`(山札末尾=次にめくられる位置)
2. `resolveBridgeAdjustedLengths`で緩和後の最小長を取得
3. `wouldContinue = wave.linked && chainContinuesPattern(scoring, wave.chain, drawnCard, effectiveStairMinLen, effectiveSuitColorMinLen, items)`
   — `chainContinuesPattern`(`patterns.ts:387-406`)は**得点計算をせず**bool判定のみ。判定順:
   同スート/同色(長さ条件クリア時)→ 階段(`dir!==0`かつ長さ条件)→ 交互。いずれか成立で`true`
4. `benevolenceFires = !wouldContinue && items.includes('benevolence') && !wave.benevolenceUsedThisCombo`(慈善による1回限りの救済)
5. `patternContinues = wouldContinue || benevolenceFires`

### 4.3 分岐A: パターン継続時(763-860)
1. `sincerityAdd = wouldContinue && items.includes('sincerity') ? sincerity.n : 0`(誠実。**`benevolenceFires`のみでは発火しない**、
   実際のパターン継続=`wouldContinue`だけを対象とする)
2. `naiveCombo`のデフォルトは`min(comboCap, wave.combo + sincerityAdd)`(スコア計算はまだ行わない)
3. **素朴(`naive`)所持 かつ `wouldContinue`の場合のみ**、`playCard`とほぼ同型の得点計算を行う(以下、`playCard`との差分を明記):
   - `newCombo`計算(黄金+2/凍結)、`base=basePoint`、`parts=[addPart('基礎点',base)]`
   - `evaluateChainBonus`を呼ぶが**`roleBonusMultiplier`を渡さない(`undefined`→デフォルトの`()=>1`)**
     — コメントで明示: 明星/ソウィロによる役倍率はこのパスを通らない仕様
   - **列一掃ボーナスの計算が存在しない**(山札めくりでは場札列は変化しないため列一掃は起こり得ない)
   - `effectiveCombo = applyProtectionEarthFloor(items, params, newCombo + sincerityAdd + wave.baseComboCount)`
   - `itemEffectCtx`は`isPlayAction:false`、`playCountInChain`は`+1`せず現在のプレイ回数そのまま(序章/幕間の閾値判定用)
   - `applyItemEffects('gained', base, items, naiveCtx, params)` → `parts.push`
   - 乗算チェーンは**`multiplier`(コンボ倍率)と`mannazFactor`の2つのみ**(`playCard`にある献身/勤勉/加護/星霜/残響/慢心/
     スリサズの7倍率は一切適用されない、明確な非対称)
   - `naiveGained = Math.floor(itemResult.value * multiplier * mannazFactor)`
   - ボス得点ロック判定は`playCard`と同じ関数`isBossScoreLocked`で行う(該当すれば`naiveGained=0`)
4. `naive`非所持(または`wouldContinue`が偽で`benevolenceFires`のみで継続)の場合、`naiveGained=0`・`naiveParts=[]`のまま
   (スコア変化なしでチェーンだけ継続)
5. `continueWave`を構築: `foundation=drawnCard`、`combo=naiveCombo`、`chain`/`chainOrigin`(origin:`'draw'`)追記、
   `score = wave.score + naiveGained`、`lastGain = naiveParts.length>0 ? {points:naiveGained, parts:naiveParts} : null`、
   `lastDrawEffect = drawnCard.wild ? 'wild' : 'pattern'`。約束(`promise`)所持時は山札を`arrangeNextCardForContinuation`で並べ替え
6. `continueWave.score >= target`なら即`ended/target`、それ以外はそのまま返す

### 4.4 分岐B: パターン非継続(リセット)時(862-898)
1. `hasPlayableColumns`: `drawnCard`を仮の`foundation`、`combo:0`にした`wave`で`getPlayableColumns`を評価(絵札固定星の判定基準を
   正しく効かせるため`combo:0`を明示)
2. `silenceFires = !hasPlayableColumns && items.includes('silence')`。成立時、`drawnCard`をワイルド化したものを`card`とし、
   `deckComposition`側も`convertCardToWildByDeckId`で永続的にワイルド化する
3. `composureAdd`(沈着: 取れる場札が無ければ`baseComboCount`永続+n)、`clarityAdd`(冷静: そのチェーンで役不成立なら永続+n)、
   `echoAdd`(残響: リセット前コンボ数×n、`echoX`に永続加算)を計算
4. `resetWave = resetComboFields(wave, params, card, 'draw')` をベースに、山札(約束反映)・`baseComboCount`・`echoX`を更新。
   `score`は**変化しない**(`scoreAfterStockEmpty`=リセット前のスコアそのまま。このパスでは得点計算自体が発生しない)
5. 念のための防御チェックとして`resetWave.score >= target`なら`ended/target`(通常到達しない)
6. 治癒(`healing`)所持時は`resolveHealingRestoration`を適用
7. `resetWave`を返す

---

## 5. `isStuck`(`engine.ts:1015-1024`)

**この順**で評価:
1. `remainingCount(wave.tableau) === 0` → `false`(場札が無いのは全消し完了状態であり手詰まりではない)
2. `wave.stock.length > 0` → `false`(まだ山札を引ける)
3. `getPlayableColumns(modifier, wave).size > 0` → `false`(取れる場札がまだある)
4. `rites.includes('dagaz') && wave.discardPile.length > 0` → `false`(秘儀ダガズで山札を復活できる)
5. どれにも該当しなければ `true`(手詰まり)

---

## 6. 上位オーケストレーション層(`engine.ts:1927-2011`)

### `resolvePlayContext`(1927-1935)
`playCard`/`drawStock`を呼ぶ前に毎回計算される共通コンテキスト:
`target = waveTarget(...)`、`scoreLock = bossScoreLockFor(...)`、
`effectiveItems = resolveEffectiveItems(run.items, wave.activeSeal)`(封印中の護符個体を除外したID配列)、
`sealedRoleEffect = resolveSealedRoleEffect(wave.activeSeal)`、`comboCap = resolveComboCap(wave.activeSeal)`。

### `applyPlayCard`(1945-1952)
`phase==='playing' && wave`を確認 → `stageModifierFor` → `resolvePlayContext` → `playCard(...)`呼び出し →
`applyRewardTalismanTrigger`で対象護符全個体の`sellBonus`を加算 → `resolveActionSabotage`
(`wave.pendingSabotageId`があり`sabotageTurnsRemaining<=0`なら`triggerSabotage`を即時適用)。

### `applyDrawStock`(1965-1971)
同様の流れだが`drawStock(...)`を呼ぶのみ。**報酬トリガー護符の判定は行わない**(4節冒頭の注記どおり)。

### `applyStuckCheck`(1977-2011)
`isStuck`が偽なら何もしない。真なら`resetComboFields`後、不屈(`resilience`)未使用なら捨て札の約半数を山札へ復活させ
スコアの一定割合を消費、治癒(`healing`)があれば`resolveHealingRestoration`。山札が復活すれば`drawStock`を1回実行して継続、
できなければ`markStuck`で`status:'ended', endReason:'stuck'`。

---

## 7. 参照した補助関数一覧(定義位置)

| 関数 | 位置 | 役割 |
|---|---|---|
| `isBossScoreLocked` | `engine.ts:311-324` | ボス得点ロック種別ごとの無得点化条件判定 |
| `bossScoreLockMessage` | `engine.ts:330-332` | ロック時の内訳表示メッセージ |
| `resolveBridgeAdjustedLengths` | `engine.ts:334-338` | 架橋護符による最小長緩和 |
| `makeOracleLevelResolver` | `engine.ts:340-348` | 役封印/神託封印を反映した神託レベル解決 |
| `applyProtectionEarthFloor` | `engine.ts:352-362` | 庇護・大地の`effectiveCombo`底上げ(所持順) |
| `mannazWeightSum` | `engine.ts:87-89` | マンナズ用レア度重み合計(C=1/U=2/R=4) |
| `resetComboFields` | `waveReset.ts:9-66` | コンボリセット共通処理(シールド・イサ・ナウジズを考慮) |
| `resolveHealingRestoration` | `engine.ts:264-293` | 治癒による列一掃列の復活 |
| `applyItemEffects` | `itemEffects.ts:59-88` | 護符効果の逐次適用(水鏡の左隣再適用を含む) |
