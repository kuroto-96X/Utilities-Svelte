# フェーズ8: 神託(Oracle)・レリック(Relic)・ショップ/福袋システムの移植

> このプロンプトは、Shidasu(Balatro風トランプソリティア型ローグライク)をGodot(GDScript)へ移植し、Steam向けPCゲームとして販売するプロジェクトの一部です。Godotプロジェクトは元のWebリポジトリ(Utilities-Svelte)とは別管理ですが、VSCodeのマルチルートワークスペースにより両方のファイルを参照できます。
>
> 着手前に必ず読むこと:
> - `Utilities-Svelte/docs/shidasu/migration/01-work-plan.md`(全体計画)
> - フェーズ6の成果物(`nestEgg`(儲蓄)の扱い。本フェーズの`sellItem`で初めて配線される)
> - フェーズ7の成果物(`useRite`/`useRevelation`の`applyExchangeBonus`呼び出しパターン。`useOracle`でも同じヘルパーを再利用する)

## 目的

神託(Oracle)・レリック(Relic)・ショップ/福袋/トランプセットという、ラン全体の経済・強化システムをまとめて実装する。

## 前提・依存

- フェーズ6(護符)・フェーズ7(秘儀・天啓、`applyExchangeBonus`/`applyDiscretionFrostBonus`ヘルパー)が完了していること。

## 作業内容

### 1. 神託(Oracle)の移植

神託は秘儀・天啓と異なり、**効果が単一パターンに統一されている**(全10種共通の仕組み。差は「どの役のレベルが上がるか」だけ)。

- `ORACLE_POOL`(10役: `completeRun`/`royalSet`/`flush`/`stair`/`color`/`suit`/`columnSweep`/`sameRank`/`pair`/`alternating`。`RoleName`型・フェーズ5の`evaluateChainBonus`が扱う10役と完全に一致する)
- `rollOracleOffer`(均等抽選)、`defaultOracleLevels`(全役レベル1で初期化)、`oracleLevelsWithUniformValue`(スプレッド固有の初期レベル設定に使う)
- `useOracle`: 所持中の神託を1つ消費し、対応する役の`run.oracleLevels[roleName]`を+1する。**`run.wave.oracleLevels`も同時に同期すること**(得点計算はフェーズ5で移植済みの`wave.oracleLevels`を参照するため、同期を怠ると効果が次のウェーブまで反映されない不具合になる)。ここでも**`applyDiscretionFrostBonus`・`applyExchangeBonus`をフェーズ7と同じヘルパーで呼び出す**こと
- 神託のレベルがどこで参照されるかは`oracleActualEffects.ts`(`ORACLE_ACTUAL_EFFECTS`)に一覧があるので、フェーズ5の`evaluateChainBonus`/`playCard`の該当箇所(各役のボーナス計算に`oracleLevel(name)`を乗算している部分)と整合していることを再確認すること(神託自体は本フェーズだが、参照元はフェーズ5にある)

### 2. レリック(Relic)の移植

レリックは護符と異なり、**プレイ中に消費されない永続的なメタ強化アイテム**(所持数上限なし、ただし重複所持不可、個体ごとに「付喪化」状態を持つ)。

- `RELIC_POOL`(10種: `manekiNeko`/`fukuDaruma`/`kumade`/`manekiHoteizo`/`hamaya`/`senbazuru`/`fukuzasa`/`kaiunKokeshi`/`engiKozuchi`/`engiSuzu`)
- `relicPriceMultiplier`(招き猫: ショップ購入価格の割引率)、`relicSellBonusMultiplier`(開運こけし: 売却価格の上昇率)
- 所持上限系ヘルパー: `itemMaxCapacity`(護符上限、招き布袋像+スプレッド由来ボーナス)、`riteMaxCapacity`(秘儀上限、破魔矢)、`revelationOracleMaxCapacity`(天啓+神託合算上限、千羽鶴)
- ショップ枠数系ヘルパー: `individualSlotCount`(バラ売り枠、熊手+福笹付喪化)、`packSlotCount`(福袋枠、福笹+熊手付喪化)、`packOfferCountBonus`(福袋選択肢数、縁起小槌)、`relicSlotCount`(レリック専用枠、縁起鈴)
- リロールコスト系: `relicRerollCostStep`(福だるま、下限0)、`relicFirstRerollFree`(福だるま付喪化、初回無料)
- `buyRelic`: レリック専用枠から購入。通貨不足・売り切れ・shop以外のフェーズなら何もしない。付喪化は`false`で初期化(進化条件・トリガーは本フェーズのスコープ外〈`kyo`天啓による付喪化トリガーはフェーズ7で実装済みのはず〉)
- **「付喪化」した状態でのレリック効果の数値差分**(`tsukumokaDiscountPercent`/`tsukumokaN`等)は`relicBonus`ヘルパー(`relic.tsukumoka`のtrue/falseで加算量を切り替える共通パターン)にまとめて実装すること。10種それぞれに個別のif文を書くのではなく、`relicBonus(run, id, n, tsukumokaN)`のような共通関数を経由させる設計を踏襲する

### 3. ショップシステムの移植

- `rollShop`: バラ売り枠(`rollIndividualSlot`)・福袋枠(`rollPackSlots`)・レリック枠(`rollRelicSlots`)の3種類を一括抽選する
  - バラ売り枠は`item`/`rite`/`revelation`/`oracle`の4種別から均等抽選する。**護符のみ**「所持中」「同一ショップ内の他バラ売り枠で既に出た護符」を除外する(秘儀・天啓・神託は重複が仕様上許容されるため除外しない)
  - スプレッド固有の`bannedShopKinds`(禁止される取引種別。例: 教皇スプレッドは神託を禁止)を考慮すること。全種別が禁止されると抽選候補が空になるため、そのケースのフォールバック(元コードには存在しないが将来のスプレッド追加に備えたコメントが残っている)も踏襲する
  - 福袋枠は`params.shop.packCatalog`をシャッフルして`packSlotCount`件選ぶ。選定時点の価格・提示数をスナップショットとして保存する(招き猫割引・縁起小槌ボーナスは抽選時点の値で固定し、後から所持レリックが変わっても再計算しない)
- 価格計算: `itemBuyPrice`/`itemSellPrice`、`riteBuyPrice`/`riteSellPrice`、`revelationBuyPrice`/`revelationSellPrice`、`oracleBuyPrice`/`oracleSellPrice`、`relicBuyPrice`。**これらは全て共通ヘルパー`categoryPrice(params, run, priceConfig, direction)`を経由する**(direction='buy'なら招き猫割引、'sell'なら開運こけしボーナスを適用してから四捨五入)。5カテゴリ分を個別実装し直すのではなく、この共通ヘルパー1つに集約すること
- `cardSets.ts`(トランプセット福袋)の移植:
  - 23種類のジャンル(`CardSetGenreId`。階段3/5/7枚、同ランク2/3/4枚、絵札セット、同スート3/5/7枚、ロイヤルセット、フラッシュセット、コンプリートラン(同スート/スートランダム)、ペア2/3組、赤黒バランス4/6/8枚(ランダム/固定)、ワイルドカード)それぞれの具体的なカード生成関数(`generateStairSet`等)を移植する
  - `CARD_SET_GENRE_WEIGHTS`(重み付け。ワイルドカードは1枚だが例外的に1/6の重み)と`weightedSampleGenres`(重み付き非復元抽選、ルーレット選択を逐次適用)を移植する
  - `rollCardSetOffer`: 開封時にジャンル抽選+カード内容確定を同時に行う
- ショップ購入・売却系の共通ヘルパーの移植:
  - `buyIndividualHold<TId>`: バラ売り枠(護符/秘儀/天啓/神託)の「温存」(所持に加える)購入の共通実装。上限判定(`atCapacity`)・通貨不足判定・所持配列への追加・`nextInstanceId`採番を1つの関数に集約する。GDScriptではジェネリクスが無いため、`Variant`型のIDと配列を受け取る設計、またはDictionary経由の実装に読み替えること
  - `buyPack`: 福袋購入。購入したジャンルに応じて対応する中身選択フェーズ(`itemSelect`/`riteSelect`/`revelationSelect`/`oracleSelect`/`cardSetSelect`)へ遷移し、`offerPickRemaining`をセットする
  - `resolvePackOfferPick`: 福袋の中身を1つ選び終えた後の共通処理(オファー配列から該当1件を除去、残り選択数をデクリメント、0になったら`shop`フェーズへ戻る)。**所持側(items/rites/revelations/oracles)への追加は呼び出し元が事前に行い、この関数自体は所持側に一切関知しない**という役割分担を踏襲すること
  - `sellFromArray<T>`: 護符/秘儀/天啓/神託の売却共通実装(`playing`/`shop`フェーズでのみ有効、対象個体を`instanceId`で特定、通貨加算)。`sellItem`は儲蓄(`nestEgg`)の特殊処理(**売却された護符自身以外の全`nestEgg`個体の`sellBonus`にnを加算。ここが本フェーズで初めて配線される護符効果**)を`sellFromArray`呼び出し後に追加する。`sellRite`/`sellRevelation`/`sellOracle`は`sellFromArray`をそのまま使うだけでよい
  - `buyIndividualItem`/`buyIndividualRite`/`buyIndividualRevelationHold`/`buyIndividualOracleHold`/`buyIndividualRevelationUse`/`buyIndividualOracleUse`: バラ売り各種の購入エントリポイント(`buyIndividualHold`を呼ぶだけの薄いラッパー。神託即使用・天啓即使用のみ`useOracle`/`applyRevelationEffect`を直接呼ぶ個別実装になっている点に注意)
  - `pickPackOracleUse`/`pickPackOracleHold`/`confirmPackOracleSwap`/`cancelPackOracleSwap`/`closePackOracleSelect`/`pickPackCardSet`/`closePackCardSetSelect`等、各福袋の中身選択フェーズの操作関数群
  - `reorderItems`/`moveArrayItem<T>`: 護符の所持順並べ替え(フェーズ6の効果適用順序に直結する)

## 参照すべき既存ファイル(Utilities-Svelte内)

- `src/lib/game/shidasu/oracles.ts`(39行) — `ORACLE_POOL`・`rollOracleOffer`・`defaultOracleLevels`・`oracleLevelsWithUniformValue`
- `src/lib/game/shidasu/oracleActualEffects.ts`(19行) — 10神託が参照するスコア計算箇所の一覧
- `src/lib/game/shidasu/relics.ts`(124行) — レリック10種のロジック全体(価格・上限・付喪化ボーナス計算ヘルパー)
- `src/lib/game/shidasu/shop.ts`(110行) — `rollShop`・価格計算(`categoryPrice`含む)
- `src/lib/game/shidasu/cardSets.ts`(216行) — トランプセット福袋23ジャンルの生成ロジック・重み付き抽選
- `src/lib/game/shidasu/engine.ts`
  - `useOracle`(1834行目〜)
  - `buyRelic`(1432行目〜)、`buyIndividualHold`(1393行目〜)、`buyIndividualItem`/`buyIndividualRite`(1412行目〜1428行目)、`buyIndividualRevelationUse`/`buyIndividualRevelationHold`/`buyIndividualOracleUse`/`buyIndividualOracleHold`(1447行目〜1496行目)
  - `buyPack`(1500行目〜)、`resolvePackOfferPick`(1520行目〜)
  - `sellFromArray`(1867行目〜)、`sellItem`(1878行目〜)、`sellRite`/`sellRevelation`/`sellOracle`(1889行目〜1904行目)
  - `pickPackOracleUse`/`pickPackOracleHold`/`confirmPackOracleSwap`/`cancelPackOracleSwap`/`closePackOracleSelect`/`pickPackCardSet`/`closePackCardSetSelect`(1771行目〜1828行目)
  - `moveArrayItem`/`reorderItems`(1850行目〜1860行目)
  - `enterShop`(1218行目〜)・`finishShop`(1267行目〜。ショップ退出時、賞金・祝儀のランダム対象を`rerollRandomTargets`で個体ごと再抽選する処理を含む。フェーズ4の`startWave`呼び出しと絡むので、フェーズ4の成果物と整合させること)

## 成果物・保存先

- Godotプロジェクト側(フェーズ2で決定したフォルダ構成)に、神託・レリック・ショップ/福袋/トランプセットシステム一式のGDScript実装
- ショップに入店→バラ売り購入・福袋購入・レリック購入・売却・並べ替え・退店、という一連の操作をUIなし(コンソール/テスト)で通しで行える動作確認記録

## 完了条件

- [ ] 神託10種が共通ロジック1つ(`useOracle`)で実装され、`run.oracleLevels`と`wave.oracleLevels`が同期している
- [ ] レリック10種の価格・上限・付喪化ボーナスが共通ヘルパー(`relicBonus`等)経由で実装され、10種分の個別if文の羅列になっていない
- [ ] ショップの5カテゴリ(護符/秘儀/天啓/神託/カードセット)の価格計算が`categoryPrice`共通ヘルパー1つに集約されている
- [ ] バラ売り枠での護符重複除外(護符のみ)・秘儀/天啓/神託の重複許容が仕様通りになっている
- [ ] トランプセット福袋23ジャンルすべてが実装され、重み付き非復元抽選が正しく機能する
- [ ] `sellItem`で`nestEgg`(儲蓄)のsellBonus加算(フェーズ6で保留にしていたもの)が動作する
- [ ] `useOracle`で`applyDiscretionFrostBonus`・`applyExchangeBonus`(フェーズ7で実装したヘルパーの再利用)が動作する
- [ ] `npm run build`相当のGodot側健全性チェックが通る

## 注意点

- **5カテゴリ分を個別に実装し直すのではなく、共通化済みのヘルパー関数として移植すること**。特に価格計算(`categoryPrice`)・購入(`buyIndividualHold`)・売却(`sellFromArray`)・福袋の中身選択後処理(`resolvePackOfferPick`)は、Web版がまさに「5カテゴリで重複コードを書かない」ことを狙って設計した箇所なので、Godot移植でも同じ抽象化を維持すること。個別カテゴリごとに似たような関数を5つ書いてしまうと、後続フェーズ(バランス調整等)で修正漏れが起きやすくなる。
- `resolvePackOfferPick`は「所持側の更新は呼び出し元が事前に行う」という役割分担になっている。この境界を破って`resolvePackOfferPick`自体に所持側の更新ロジックを混ぜ込むと、5カテゴリの呼び出し元それぞれで扱うデータ型が異なる(ItemId/RiteId/RevelationId/RoleName/CardSetGenreId)ことと矛盾し、抽象化が崩れるので注意すること。
- ショップ関連のRNG消費順序(福袋開封時のジャンル抽選→カード内容確定、ショップ入店時の`rollShop`内での抽選順序等)は、固定シードでの再現性(テスト・リプレイ)に影響するため、`engine.ts`・`shop.ts`・`cardSets.ts`の呼び出し順序を変えないこと。
