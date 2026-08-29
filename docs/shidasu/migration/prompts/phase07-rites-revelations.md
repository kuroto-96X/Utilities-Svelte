# フェーズ7: 秘儀(Rite)・天啓(Revelation)の効果移植

> このプロンプトは、Shidasu(Balatro風トランプソリティア型ローグライク)をGodot(GDScript)へ移植し、Steam向けPCゲームとして販売するプロジェクトの一部です。Godotプロジェクトは元のWebリポジトリ(Utilities-Svelte)とは別管理ですが、VSCodeのマルチルートワークスペースにより両方のファイルを参照できます。
>
> 着手前に必ず読むこと:
> - `Utilities-Svelte/docs/shidasu/migration/01-work-plan.md`(全体計画)
> - フェーズ5の成果物(`WaveState`のGDScript実装。特に秘儀・天啓が書き換える多数のフラグ・数値フィールド)
> - フェーズ6の成果物(`discretion`/`frost`/`exchange`の扱い。本フェーズで初めて実際に配線される)

## 目的

能動使用系アイテムである秘儀(Rite)24種・天啓(Revelation)28種の効果を実装する。

## 前提・依存

- フェーズ5・フェーズ6が完了していること。
- 秘儀・天啓はいずれも「所持リストから1つ選んで使用し、効果を適用してから所持から取り除く」という消費アイテムである。ショップでの購入・売却自体はフェーズ8の担当だが、**使用処理(`useRite`/`useRevelation`)自体は本フェーズの担当**。フェーズ8実装時に、ショップ画面のバラ売り天啓即使用等からも同じ使用処理を呼び出せるようにしておくこと。

## 秘儀と天啓の設計上の違い(移植時に必ず区別すること)

- **秘儀(Rite)**: 効果は`WaveState`のみを書き換える(山札・場札・捨て札の並べ替え、コンボ数・各種フラグの変更等)。`deckComposition`(ラン全体で持続するデッキ構成)には一切触れない。
- **天啓(Revelation)**: 効果は`WaveState`と`deckComposition`の**両方**を書き換えるものが多い(場札のスート/ランクを恒久的に変換する、ワイルド化する等)。したがって天啓の効果関数は`{ wave, deckComposition }`のペアを返すシグネチャにする必要がある(秘儀は`wave`のみを返せばよい)。
- 秘儀は全種即座に効果が完結するのに対し、天啓には「即座に盤面へ効果を及ぼす系」(スート/ランク変換等、対象列の選択(`targetCol`)が必要なものを含む)と「即座に別のリソース(護符・レリック・所持枠・通貨)を獲得する系」(Phase B系。`grantRevelationReward`相当)の2系統が混在する点が秘儀と異なる。

## 作業内容

### 1. 秘儀(Rite)24種の移植

- `RITE_POOL`(24種のID一覧)、`rollRite`/`rollRiteOffer`(均等抽選、既存所持を除外しない)を移植する
- `canUseRite`: 現在の盤面状態で使用可能かどうかの判定(UIのボタン無効化に使う)。捨て札/山札の残り枚数、対象カード有無などriteId別の個別条件があるので、`riteEffects.ts`の`canUseRite`をそのまま移植する。加えて、妨害「封印系」により対象秘儀(個体)が封印中の場合は使用不可にする分岐があるが、これはフェーズ9(妨害)の`activeSeal`機構に依存するため、**フェーズ7時点では`activeSeal`が常に存在しない前提で構わない(該当チェックのコードは書いておいてよいが、発火しなくても問題ない)**
- `RITE_HANDLERS`ディスパッチテーブル(riteId→ハンドラ関数)として24種を実装する。GDScriptでは`match`文または`Dictionary<String, Callable>`での実装を推奨する。各秘儀の実装ロジックは`riteActualEffects.ts`の`RITE_ACTUAL_EFFECTS`(監査用一覧)を1件ずつのチェックリストとして使い、`riteEffects.ts`の実装を1:1で移植する
- `useRite`(engine.ts側の呼び出し処理)を移植する。以下の処理順序を守ること:
  1. フェーズ・wave状態のガード(`playing`フェーズ、またはショップ系フェーズ`SHOP_FLOW_PHASES`内であること。かつ`wave.status === 'playing'`)
  2. `canUseRite`チェック
  3. `applyRiteEffect`で効果適用
  4. **`applyDiscretionFrostBonus`相当の処理をここで実装・呼び出す**(フェーズ6で「本フェーズで配線」と保留にしていたもの。所持護符に`discretion`があれば`wave.discretionN`にn加算、`frost`があれば`wave.frostX`にx加算)
  5. `dagaz`(ダガズ)使用時のみ、`lastStockShuffle`のシーケンス番号を+1する特別処理(UI側の山札シャッフル演出トリガー用)
  6. 所持リストから該当秘儀を1つ削除
  7. `recentUsedRiteIds`(直近使用した秘儀ID、最大2件・新しい順)を更新する(天啓「烏」(`karasu`)がこの履歴を参照して秘儀を返還する)
  8. **`applyExchangeBonus`相当の処理を実装・呼び出す**(フェーズ6で「本フェーズで実装」と保留にしていたもの。所持護符に`exchange`があれば、その全個体の`sellBonus`にnを加算する単純な処理。天啓側でも同じ処理を使うので、共通ヘルパーとして両方から呼べるようにしておく)

### 2. 天啓(Revelation)28種の移植

- `REVELATION_POOL`(28種)、`rollRevelationOffer`を移植する
- `canUseRevelation`: 京(`kyo`、対象レリックが未付喪化であること)・鬼(`oni`、未所持レリックが存在すること)以外は常にtrue。妨害封印系のチェックはフェーズ7時点では発火しなくてよい(秘儀と同様)
- `revelationNeedsTarget`: 列選択(`targetCol`)が必要な天啓かどうかを返すヘルパー(UIが列選択UIを出すかどうかの判定に使う。角/亢/氐/房等のスート変換系、牛/女のランク変換系など)
- `applyRevelationEffect`: 28種の効果本体。`{ wave, deckComposition }`のペアを返す。`revelationEffects.ts`の各ヘルパー関数(`convertColumnToSuit`/`convertTableauSuit`/`convertColumnToRandomRank`/`addWildToColumnTop`/`convertColumnChainFromLeft`等)は「場札を書き換えると同時に、対応する`deckComposition`エントリ(`deckId`で紐付け)も書き換える」という共通パターンを取っているので、その設計をそのまま踏襲すること。`nextWaveCardId`(新規カードの一時id採番)のようなヘルパーも忘れず移植する
- `grantRevelationReward`: 即時報酬獲得系9種(`kyo`/`subaru`/`oni`/`ryuu`/`hotori`/`chou`/`yoku`/`mitsu`/`karasu`)専用のswitch文。残り19種は`{}`(無報酬)を返すdefaultケースになる。`sharedRevelationSlotsRemaining`(天啓+神託の合算所持枠の残数)ヘルパーも併せて移植する
  - **自己参照ループ防止に特に注意**: `hotori`(昴、直前に使った天啓をもう一度付与する)は、`run.lastUsedRevelationId`を参照するが、**`hotori`自身を使用した場合は`lastUsedRevelationId`を更新しない**(更新すると次に`hotori`を使ったとき自分自身を無限に複製できてしまう)。この防御ロジックは`useRevelation`側(`lastUsedRevelationId = revelationId === 'hotori' ? run.lastUsedRevelationId : revelationId`)に実装されているので見落とさないこと
- `useRevelation`(engine.ts側の呼び出し処理)を移植する。処理順序:
  1. フェーズ・wave状態のガード(秘儀と同様)
  2. 所持チェック(`instanceId`一致)
  3. `canUseRevelation`チェック
  4. `applyRevelationEffect`で`wave`/`deckComposition`両方を更新
  5. **`applyDiscretionFrostBonus`呼び出し**(秘儀と共通のヘルパーを再利用)
  6. 所持リストから該当天啓を1つ削除した`run`を作り、それを`runAfterRemoval`として`grantRevelationReward`に渡す(**削除後の状態を渡すことが重要**。削除前の状態を渡すと上限判定等がズレる)
  7. `hotori`自己参照防止の`lastUsedRevelationId`更新
  8. **`applyExchangeBonus`呼び出し**。ここで順序に注意: `subaru`等の天啓報酬(`reward.items`、新規護符付与)を含めた最終的な`items`配列に対して`applyExchangeBonus`を適用する必要がある(先に`applyExchangeBonus`を適用してから`reward.items`で上書きすると、両替のボーナスが消えてしまうバグが実際にWeb版で発生した実績がある。`items = applyExchangeBonus(params, reward.items ?? run.items)`という順序を厳守する)

## 参照すべき既存ファイル(Utilities-Svelte内)

- `src/lib/game/shidasu/rites.ts`(40行) — `RITE_POOL`・`rollRite`・`rollRiteOffer`・`riteName`/`riteDesc`
- `src/lib/game/shidasu/riteActualEffects.ts`(31行) — 24種の実装ロジック監査用一覧(チェックリストとして使う)
- `src/lib/game/shidasu/riteEffects.ts`(277行) — `canUseRite`・`RITE_HANDLERS`・`applyRiteEffect`の実装本体
- `src/lib/game/shidasu/revelations.ts`(49行) — `REVELATION_POOL`・`rollRevelationOffer`・`revelationName`/`revelationDesc`
- `src/lib/game/shidasu/revelationActualEffects.ts`(35行) — 28種の実装ロジック監査用一覧
- `src/lib/game/shidasu/revelationEffects.ts`(309行) — `canUseRevelation`・`revelationNeedsTarget`・`applyRevelationEffect`・各種変換ヘルパー
- `src/lib/game/shidasu/engine.ts`
  - `useRite`(1199行目〜)
  - `useRevelation`(1741行目〜)
  - `grantRevelationReward`(1663行目〜)、`sharedRevelationSlotsRemaining`(1655行目)
  - `applyDiscretionFrostBonus`(1179行目)、`applyExchangeBonus`(1190行目)
  - `SHOP_FLOW_PHASES`(991行目、ショップ系フェーズでも秘儀・天啓が使える仕様)

## 成果物・保存先

- Godotプロジェクト側(フェーズ2で決定したフォルダ構成)に、秘儀24種・天啓28種の効果実装一式
- 各秘儀・天啓を1つずつ使用して効果が正しく発火することを確認した動作確認記録
- `hotori`(昴)の自己参照ループ防止、`kyo`(京)の未付喪化レリック存在チェック等、防御ロジックが機能することの確認記録

## 完了条件

- [ ] 秘儀24種すべてが`RITE_HANDLERS`相当のディスパッチで実装され、`riteActualEffects.ts`の全項目と1件ずつ突き合わせ済み
- [ ] 天啓28種すべてが実装され、`revelationActualEffects.ts`の全項目と1件ずつ突き合わせ済み
- [ ] 秘儀の効果は`WaveState`のみ、天啓の効果は`WaveState`+`deckComposition`の両方を更新する設計になっている
- [ ] `useRite`/`useRevelation`で`applyDiscretionFrostBonus`・`applyExchangeBonus`が正しい順序で呼ばれている(フェーズ6で保留にしていた`discretion`/`frost`/`exchange`護符が、本フェーズで実際に動き出すことを確認する)
- [ ] `hotori`使用時に`lastUsedRevelationId`が更新されないこと、`hotori`使用直後にもう一度`hotori`を使っても無限増殖しないことを確認した
- [ ] `useRevelation`内の`applyExchangeBonus`が`reward.items`適用後の配列に対して実行されている(適用順序バグの再発防止)
- [ ] `npm run build`相当のGodot側健全性チェックが通る

## 注意点

- 天啓・神託(神託はフェーズ8)は「いつでも使用可能」(プレイ中に加え、ショップ系フェーズでも使用可能)という仕様。UIの実装(フェーズ12)を見据え、`useRite`/`useRevelation`のガード条件(`SHOP_FLOW_PHASES`)は正確に移植すること。
- `grantRevelationReward`は「使用した天啓自身を`revelations`から取り除いた後の`run`状態(`runAfterRemoval`)」を受け取る設計になっている。取り除く前の状態を渡すと、所持枠の残数判定(`sharedRevelationSlotsRemaining`)がズレて上限バグの原因になるので、削除→報酬付与の順序を必ず守ること。
- 天啓の中には対象列(`targetCol`)を必要とするものと不要なものが混在する。`revelationNeedsTarget`の判定結果に応じてUI側(フェーズ12)が列選択を挟むかどうかを分岐する前提で、`applyRevelationEffect`のシグネチャに`targetCol: number | null`を含めておくこと。
