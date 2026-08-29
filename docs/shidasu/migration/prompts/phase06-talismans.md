# フェーズ6: 護符(Talisman)の効果移植

> このプロンプトは、Shidasu(Balatro風トランプソリティア型ローグライク)をGodot(C#)へ移植し、Steam向けPCゲームとして販売するプロジェクトの一部です。Godotプロジェクトは元のWebリポジトリ(Utilities-Svelte)とは別管理ですが、VSCodeのマルチルートワークスペースにより両方のファイルを参照できます。
>
> 着手前に必ず読むこと:
> - `Utilities-Svelte/docs/shidasu/migration/01-work-plan.md`(全体計画)
> - フェーズ5の成果物(`playCard`/`drawStock`の`Shidasu.Core`側C#実装。特に本フェーズで差し替える3つのスタブ関数の現在の位置とシグネチャ)
> - `Utilities-Svelte/src/lib/game/shidasu/itemActualEffects.ts`(護符の実装ロジック監査用一覧。**本フェーズの実質的な作業チェックリスト**)

## 目的

最大のコンテンツボリュームである護符の効果を実装する。

## 重要: 件数について(要再確認)

`01-work-plan.md`には「護符99種」と記載されているが、**2026-08-29時点で`Utilities-Svelte/src/lib/game/shidasu/types.ts`の`ItemId`型・`items.ts`の`ITEM_POOL`・`itemActualEffects.ts`の`ITEM_ACTUAL_EFFECTS`を実際に数えたところ、いずれも133件だった**。`01-work-plan.md`作成後にゲーム側で護符が追加され続けた結果、記載が古くなっていると考えられる(フェーズ1の資料化フェーズでも同様の「既存docsが実装より古い」現象が確認されている)。

着手時は必ず以下を再カウントし、実装対象の正確な件数・IDリストを確定させること。

```
- src/lib/game/shidasu/types.ts の `ItemId` 型(union型のメンバー数)
- src/lib/game/shidasu/items.ts の `ITEM_POOL` 配列の要素数
- src/lib/game/shidasu/itemActualEffects.ts の `ITEM_ACTUAL_EFFECTS` オブジェクトのキー数
```

この3つは本来常に一致するはずである(型システム上`Record<ItemId, string>`なので`ITEM_ACTUAL_EFFECTS`は自動的に網羅性チェックされる)。もし数が食い違っていたら、`types.ts`側が最新の正である可能性が高いので、そちらを正としてよい。以降の本プロンプトでは検証時点の件数「133」を前提に記述するが、実数が異なっていたら本プロンプトの個数表記より実際のソースを優先すること。

## 前提・依存

- フェーズ5が完了していること。特に以下3つのスタブ関数が存在し、正しい位置から呼ばれていることを確認してから着手する。
  1. `apply_item_effects(channel, value, items, ctx, params)` — `playCard`から`gained`/`clearBonus`の2チャンネルで、`drawStock`の素朴(naive)分岐から`gained`チャンネルで、計3箇所から呼ばれる
  2. `resolve_play_triggered_reward_talismans(...)`
  3. `resolve_play_triggered_currency_gain(...)`

## 護符の実装場所は1種類ではない — まず全体構造を把握する

Web版の護符は、**単一の巨大switch文ではなく、効果の性質ごとに複数のモジュール・複数の呼び出し起点に分散している**。移植時も同じ構造(効果の性質ごとにファイル/セクションを分ける)を踏襲すること。実際の分布は以下の通り(件数はitemActualEffects.tsの分類コメントに基づく。○番は元コード内のグループ番号で、飛び番・重複番号(グループ18が2箇所に出現する等)は元コードのコメント上のtypoなので気にしなくてよい)。

### A. 汎用効果テーブル(`apply_item_effects`の実体) — 4ファイル、計65種

`ItemId`をキーに`{ channel: 'gained' | 'clearBonus', effect: (value, ctx, params) => { value, part } }`を持つ`Partial<Record<ItemId, ...>>`を4つ定義し、`itemEffects.ts`相当の集約関数でマージして使う。**所持順(`items`配列の並び順)に左から順に適用する**設計を維持すること(ショップで並べ替え可能にするための前提)。

- `clearBonusEffects.ts`相当(3種、channel='clearBonus'): `patience`(忍耐)・`purify`(浄化)・`temperance`(節制)
- `cardComboEffects.ts`相当(18種、channel='gained'): `springBreeze`(春風)・`summerBreeze`(夏風)・`autumnBreeze`(秋風)・`winterBreeze`(冬風)・`kinship`(友愛)・`thaw`(雪解)・`dusk`(宵闇)・`dawn`(払暁)・`wit`(機知)・`courage`(勇気)・`daybreak`(暁)・`twilight`(黄昏)・`cheerful`(快活)・`conscience`(良心)・`morningMist`(朝霧)・`vow`(誓約)・`pact`(契り)・`silver`(白銀)
- `chainAttributeEffects.ts`相当(24種、channel='gained'): `calm`(平穏)・`serenity`(安寧)・`destiny`(運命)・`fate`(宿命)・`relief`(安堵)・`verdantGreen`(深緑)・`gem`(宝石)・`resolve`(真剣)・`grail`(聖杯)・`moonlight`(月光)・`sunlight`(陽光)・`crown`(王冠)・`cloverLeaf`(青葉)・`coin`(硬貨)・`blade`(武器)・`chalice`(献杯)・`balance`(均衡)・`harmony`(調和)・`nobility`(高潔)・`tenacity`(執念)・`determination`(覚悟)・`cycle`(循環)・`reincarnation`(輪廻)・`majesty`(威光)
- `stateAndPatternEffects.ts`相当(20種、channel='gained'): `omen`(兆し)・`crescent`(三日月)・`blessing`(恩寵)・`focus`(集中)・`lapis`(瑠璃)・`jade`(翡翠)・`emptyMind`(無心)・`prologue`(序章)・`interlude`(幕間)・`morningDew`(朝露)・`drizzle`(小雨)・`gentleBreeze`(微風)・`resonance`(共鳴)・`azureSky`(蒼穹)・`amber`(琥珀)・`passion`(情熱)・`fightingSpirit`(闘志)・`intuition`(直感)・`mercy`(慈悲)・`deadline`(刻限)

さらに、集約関数(`apply_item_effects`本体)自体に**水鏡(`waterMirror`)の特殊ロジック**を実装する: 所持リストを左から順に処理する際、対象の護符が`waterMirror`だった場合、その1つ左隣(`i-1`番目)の護符の効果を、その時点の値に対してもう一度追加適用する(自分が先頭なら何もしない)。`waterMirror`自体は上記4テーブルのどこにも独自エントリを持たない。

### B. プレイ即時トリガー系(方向性1・方向性2) — `rewardTalismanEffects.ts`相当、計24種

`resolve_play_triggered_reward_talismans`(21種、売値ボーナス=`sellBonus`への即時加算)と`resolve_play_triggered_currency_gain`(3種、星片=currencyへの即時加算)の2関数として実装する。

- 売値ボーナス系21種: `koban`(小判)・`senryo`(千両)・`manryo`(万両)・`harvest`(豊作)・`hiddenTreasure`(隠し財宝)・`greatestTreasure`(至宝)・`heirloom`(家宝)・`treasury`(蔵)・`boom`(特需)・`abundantFunds`(潤沢)・`savings`(貯蓄)・`bigCatch`(大漁)・`grains`(五穀)・`liveliness`(活況)・`prosperity`(繁盛)・`heavenlyBlessing`(天佑)・`mizuho`(瑞穂)・`bountifulYear`(豊年)・`profit`(利益)・`bounty`(褒賞)・`perk`(役得)
- 星片(currency)即時加算系3種: `prizeMoney`(賞金。`HeldItem.randomTarget`にランク値、ウェーブ開始のたび個体ごと再抽選)・`windfall`(僥倖。絵札プレイ時にp%抽選)・`celebration`(祝儀。`HeldItem.randomTarget`に役名、ウェーブ開始のたび個体ごと再抽選)

`PlayTriggerContext`/`CurrencyGainTriggerContext`の各フィールド(`comboBefore`/`comboAfter`/`remainingTableauCountBefore`/`remainingTableauCountAfter`/`roleFired`/`sweepQualifies`/`sameColumnStreak`等)は`playCard`側で正しい値を渡す必要がある。フェーズ5でスタブ化した呼び出し箇所に、実際の値渡しがそのまま残っているはずなので、関数の中身だけを差し替えればよい。

### C. Wave開始時トリガー系 — 3種(`start_wave`相当関数内)

`eternity`(永劫: デッキ構成の末尾にワイルド1枚追加)・`abundance`(豊穣: 非ワイルド1枚をランダムにワイルド変換)・`fortitude`(不屈: 開始時の山札+場札合計枚数がn枚ごとにベースコンボ数+1)。いずれもフェーズ4で移植した`start_wave`相当関数の中に実装する(フェーズ4では「効果は未実装のスタブでよい」とされていたため、本フェーズで埋める)。フェーズ4の成果物を開き、該当箇所がどのようなスタブになっているか確認してから実装すること。

### D. Wave終了時トリガー系 — 8種(`resolve_wave_end`相当関数内)

`settlement`(決算)・`refund`(還元)・`bonus`(報奨)・`commendation`(褒賞)・`favor`(恩賞)・`vigor`(活気)・`zuishuku`(瑞祝)・`marketTrend`(市況、`computeMarketTrendEarned`相当のヘルパーを伴う)。これらも`resolveWaveEnd`(`engine.ts` 1084行目〜)の「遷移部分」以外の箇所に実装されており、フェーズ4では遷移部分のみ移植された想定なので、フェーズ4の成果物を確認した上で本フェーズで埋める。

### E. 将来フェーズで配線されるため、本フェーズでは実装しない(または直接効果を持たない)護符

以下は本フェーズの対象から明示的に除外する。理由をコメントとして残しておくこと。

- **フェーズ5で既に完全実装済み**(重複実装しないこと): `bridge`(架橋)・`grace`(慈悲)・`golden`(黄金)・`sanctify`(祝福)・`mirror`(鋼鉄)・`shootingStar`(流星)・`dedication`(献身)・`diligence`(勤勉)・`divineProtection`(加護)・`echo`(残響)・`arrogance`(慢心)・`silence`(静寂)・`composure`(沈着)・`clarity`(冷静)・`benevolence`(博愛)・`naive`(素朴、構造のみ。中身の数値はA節が実装されて初めて正しくなる)・`promise`(約束)・`regeneration`(再生)・`healing`(治癒)・`protection`(庇護)・`earth`(大地)・`morningStar`(明星)
- **独自の加点/乗算を持たない**(他機能への影響のみ): `crimson`(紅蓮)・`jetBlack`(漆黒) — `cardColors`(フェーズ5で移植済み)の解釈を変えるだけ。`vow`(誓約)・`pact`(契り) — `isPlayable`の制約部分はフェーズ5で実装済み、乗算効果部分は本フェーズA節の`cardComboEffects`相当に含まれる(そちらは実装対象)
- **加算値を読む部分はフェーズ5済み、増加させる部分はフェーズ7/8の担当**: `discretion`(果断)・`frost`(星霜) — `wave.discretionN`/`wave.frostX`をプレイ時に加算/乗算する部分はフェーズ5で完成済み。これらの値自体を秘儀・天啓・神託の使用時に増加させる`apply_discretion_frost_bonus`相当の処理は、`useRite`/`useRevelation`(フェーズ7)・`useOracle`(フェーズ8)で実装される
- **UI表示専用、スコア非関与**: `guidance`(導き) — 次にめくられるカードの表示のみ。フェーズ12(UI実装②)の担当
- **トリガー元となる関数がまだ存在しないため、本フェーズでは実装しない**(該当フェーズで直接実装すること。本フェーズで前もって空のヘルパーを用意する必要もない): `exchange`(両替、`useRite`/`useRevelation`/`useOracle`使用時にトリガー→フェーズ7/8)・`nestEgg`(儲蓄、`sellItem`での護符売却時にトリガー→フェーズ8)・`dividend`(配当、`triggerSabotage`での妨害発動時にトリガー→フェーズ9)

## 作業内容(推奨パス分割)

ボリュームが大きいため、以下の単位で複数パスに分けて実装してよい。各パスの対象IDは上記A〜Dの分類と対応している。

- **パス1**: A節のうち`clearBonusEffects`相当(3種)+`cardComboEffects`相当(18種) = 21種
- **パス2**: A節のうち`chainAttributeEffects`相当(24種)
- **パス3**: A節のうち`stateAndPatternEffects`相当(20種)+集約関数(`apply_item_effects`本体)+水鏡(`waterMirror`)の左隣再適用ロジック+フェーズ5のスタブ3箇所のうち1箇所目をこの実装に差し替え
- **パス4**: B節(`rewardTalismanEffects`相当、24種)+フェーズ5のスタブ3箇所のうち残り2箇所をこの実装に差し替え
- **パス5**: C節(Wave開始時3種)+D節(Wave終了時8種)

各パス完了時に、そのパスで実装した護符だけを所持した状態でのミニ動作確認(該当護符の効果が発火することの確認)を行うこと。全パス完了後に、133種(または再カウントした実数)すべてを1つずつ所持させてスコアが変化することを確認する統合テストを行う。

## 参照すべき既存ファイル(Utilities-Svelte内)

- `src/lib/game/shidasu/itemActualEffects.ts` — 全護符の実装ロジック要約(監査用)。**本フェーズの実装対象を1件も漏らさないためのマスターチェックリストとして使う**。各エントリの説明文を読み、対応する実装ファイル(下記)を確認しながら1件ずつ潰していくこと
- `src/lib/game/shidasu/itemEffects.ts` — `ItemEffectContext`型・`applyItemEffects`集約関数(水鏡ロジック込み)
- `src/lib/game/shidasu/clearBonusEffects.ts`(26行)・`cardComboEffects.ts`(134行)・`chainAttributeEffects.ts`(262行)・`stateAndPatternEffects.ts`(155行) — A節の実装
- `src/lib/game/shidasu/rewardTalismanEffects.ts` — B節の実装(`resolvePlayTriggeredRewardTalismans`/`resolvePlayTriggeredCurrencyGain`)
- `src/lib/game/shidasu/items.ts` — `ITEM_POOL`(ショップ抽選プール)、`itemName`/`itemDesc`(プレースホルダー置換方式の説明文生成)
- `src/lib/game/shidasu/engine.ts`
  - `startWave`(136行目〜。C節の3種を探す)
  - `resolveWaveEnd`(1084行目〜。D節の8種と`computeMarketTrendEarned`(1168行目)を探す)
  - `mannazWeightSum`(87行目、A節ではないがレア度重み計算の参考)

## 成果物・保存先

- `Shidasu.Core`側(フェーズ2で決定したプロジェクト構成)に、上記A〜Dに対応する護符効果のC#実装一式
- 133種(または再カウントした実数)すべての護符について、1種ずつ所持させて効果が発火することを確認した動作確認記録

## 完了条件

- [ ] `itemActualEffects.ts`の全エントリを実際に数え、`types.ts`の`ItemId`型・`items.ts`の`ITEM_POOL`と件数が一致することを確認した
- [ ] A節65種(または再カウント後の対応件数)すべてが4つのテーブル相当に実装され、`apply_item_effects`集約関数(水鏡ロジック込み)がフェーズ5のスタブと差し替わっている
- [ ] B節24種すべてが実装され、フェーズ5の残り2つのスタブと差し替わっている
- [ ] C節3種(Wave開始時)・D節8種(Wave終了時)が実装されている
- [ ] E節で除外した護符について、重複実装していないこと・将来フェーズへの引き継ぎコメントが残っていることを確認した
- [ ] 護符の所持順(並べ替え)を変えると、A節の加算・乗算適用順序が変わることを確認した
- [ ] `npm run build`相当のGodot側健全性チェックが通る

## 注意点

- **効果適用順序(所持順=並べ替え可能)を維持する設計にすること**。A節のテーブルは「左から順に1つずつ適用し、その都度`value`を更新していく」実装でなければならない(全部の効果値を独立に計算してから合算する実装は誤り。乗算系護符の順序でスコアが変わるため)。
- 各護符の数値パラメータ(`n`/`x`/`c`/`m`/`p`/`a`/`l`等)は`params.talismans.<id>.<key>`(JSONローダー、フェーズ3で移植済み)から読む。本プロンプトやitemActualEffects.tsには具体的な数値は書かれていない(意図的に一般化されている)ので、実際の数値は`shidasu.config.json`(またはフェーズ3で変換した型付きデータ)を確認すること。
- `HeldItem`(個体管理)の`sellBonus`/`randomTarget`/`rewardBonus`フィールドは護符の個体ごとに独立して持つ値。同名護符を複数所持した場合、これらは個体ごとに別々の値になりうる(`instanceId`ベースの設計)。B節・D節の一部護符(`favor`等)を実装する際に必ず考慮すること。
