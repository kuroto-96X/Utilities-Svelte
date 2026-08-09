# 天啓 Phase B(即時報酬獲得系7個)実装設計

## 背景

`docs/shidasu/shidasu-revelation-candidates.md`で検討した天啓候補のうち採用15個を、実装しやすさで2フェーズに分割した(2026-08-09)。

- **Phase A(実装済み)**: カード変換・場札操作系8個。`wave`(場札)・`deckComposition`(デッキ構成)を書き換える効果で、既存の`convertColumnToSuit`等のパターンを拡張して実装した。
- **Phase B(本ドキュメント)**: 即時報酬獲得系7個。使用すると星片・護符・天啓・秘儀・神託のいずれかを即座に獲得する効果。

対象は候補No.13・15・16・17・18・19・23の7個。

## アーキテクチャ: RunStateレベルの特別ケース

Phase Aの8個は`wave`・`deckComposition`を書き換える効果だったため`revelationEffects.ts`の`applyRevelationEffect`に実装した。Phase Bの7個は**RunStateレベル**(通貨・護符・天啓・秘儀・神託の所持リスト)を操作する効果で、`wave`/`deckComposition`には一切触れない。

そのため実装場所を分ける。

- `applyRevelationEffect`(`revelationEffects.ts`)側の該当7ケースは全て**no-op**として追加する(`{ wave, deckComposition }`をそのまま返すだけ)。`revelationNeedsTarget`にも追加しない(列選択不要)。
- 実際の付与ロジックは`engine.ts`の`useRevelation`関数に特別ケースとして追加する。これは既存の「虚(kyo)」が`extraTableauRows`を`useRevelation`側で加算しているのと同じ位置づけ(`applyRevelationEffect`の外側、`useRevelation`本体での後処理)。

`canUseRevelation`(`wave`のみを受け取る現行シグネチャ)は変更しない。Phase Bの7個は全て「常に使用可能(所持枠が空いていなければ0個獲得になるだけ)」という仕様にするため、`wave`状態に基づく使用可否判定が不要だからである。

## 新規state: 使用履歴の追跡

候補16(天啓回帰)・候補23(秘儀回帰)は「直前に使用した天啓/秘儀を獲得する」効果のため、`RunState`に2つのフィールドを新設する。

```ts
// 直前に使用した天啓のID(天啓回帰が参照する)。使用履歴が無ければnull。
// 天啓回帰自身を使った場合はこのフィールドを更新しない(履歴に残さない)。これにより
// 天啓回帰が自分自身を再取得する自己参照ループが構造的に発生しない。
lastUsedRevelationId: RevelationId | null
// 直近に使用した秘儀のID、新しい順で最大2件(秘儀回帰が参照する)。
recentUsedRiteIds: RiteId[]
```

- `useRevelation`の末尾: 今回使った天啓が「星(hotori、候補16)」自身であれば`lastUsedRevelationId`を更新しない(直前の値をそのまま維持する)。それ以外の天啓を使った場合は`lastUsedRevelationId: revelationId`で上書きする。
- `useRite`の末尾: `recentUsedRiteIds: [riteId, ...run.recentUsedRiteIds].slice(0, 2)`のように先頭に追加し2件までに切り詰める。候補23(秘儀回帰)自身は天啓(`RevelationId`)であり、`recentUsedRiteIds`は秘儀(`RiteId`)のみを格納する配列のため、型が異なり自己参照は構造的に起こらない(特別な除外処理は不要)。

## 候補ごとの設計

宿の割り当ては、残り8宿(昴・参・鬼・柳・星・張・翼・軫)のうち7つを使う。既存ID・Phase A分との読み(音)の衝突(昴=ぼう、星=せい、鬼=き、参/軫=しん)を避けるため、二十八宿の和名(日本古来の星名)から短縮IDを作る。鬼のみ未使用のまま温存する。

| No | 宿 | id | 読み由来 |
|---|---|---|---|
| 13 | 昴 | `subaru` | 和名「すばるぼし」 |
| 15 | 柳 | `ryuu` | 音読みそのまま |
| 16 | 星 | `hotori` | 和名「ほとおりぼし」を短縮 |
| 17 | 張 | `chou` | 音読みそのまま |
| 18 | 翼 | `yoku` | 音読みそのまま |
| 19 | 軫 | `mitsu` | 和名「みつかけぼし」を短縮 |
| 23 | 参 | `karasu` | 和名「からすきぼし」を短縮 |

### No.13 護符獲得 → 昴(subaru)

護符(`ItemId`)を1つ、`ITEM_POOL`から**所持中の護符を除外して**均等ランダム抽選し、`run.items`に追加する。既存のショップのバラ売り抽選(`rollIndividualSlot`)と同じ「護符は重複所持不可」ルールに合わせる。

`run.items.length >= params.items.maxItems`(所持上限、既定5)なら何も獲得しない(使用は常に可能、消費されるだけ)。

### No.15 星片倍化 → 柳(ryuu)

`currency: run.currency * 2`。

### No.16 天啓回帰 → 星(hotori)

`run.lastUsedRevelationId`を読み、`null`でなければその天啓IDを`run.revelations`に追加する。ただし追加は上限判定を満たす場合のみ(下記「上限判定のタイミング」参照)。`lastUsedRevelationId`が`null`(使用履歴が無い、または直前の使用が全て天啓回帰自身だった)場合は何も獲得しない。

### No.17 神託獲得 → 張(chou)

`ORACLE_POOL`から`rollOffer`(既存のショップオファー抽選と同じ、重複無し均等抽選ヘルパー)で2つ抽選し、`run.oracles`に追加する。実際に追加できる件数は下記「上限判定のタイミング」で決まる残り枠数まで(0〜2個。2つ抽選した結果を先頭から順に枠が埋まるまで追加する)。

### No.18 天啓連続獲得 → 翼(yoku)

`REVELATION_POOL`から`rollOffer`で2つ抽選し、`run.revelations`に追加する。実際に追加できる件数は下記「上限判定のタイミング」で決まる残り枠数まで(0〜2個。2つ抽選した結果を先頭から順に枠が埋まるまで追加する)。

### No.19 護符換金 → 軫(mitsu)

`run.items`の各護符について`itemSellPrice(params, id)`(既存関数、レアリティ別売値テーブル参照)を合計し、`run.currency`に加算する。

### No.23 秘儀回帰 → 参(karasu)

`run.recentUsedRiteIds`(最大2件)を先頭から順に、下記の残り枠数まで`run.rites`に追加する。

### 上限判定のタイミング(候補16・17・18・23共通)

候補16・17・18は天啓・神託合算上限2(天啓と神託が所持枠を共有する既存仕様)、候補23は秘儀上限3という既存の所持上限に対して、**使用中の天啓自身を`run.revelations`から削除した後の状態**で残り枠数を判定する。これにより、例えば天啓・神託合算枚数が2/2の状態で候補17・18を使っても、使用分の1枚が消費されて空くため最低1件は獲得できる。

具体的には、`useRevelation`内で既存の「使用した天啓を`revelations`配列から取り除く」処理(`const revelations = [...run.revelations.slice(0, idx), ...run.revelations.slice(idx + 1)]`)を先に行ってから、候補16・17・18の付与ロジックで`revelations.length + run.oracles.length`(削除後の値)を参照する。候補23(秘儀)も同様に、`useRevelation`内で秘儀の上限判定を行う際は`run.rites.length`(候補23自体は天啓であり`rites`配列には影響しないため、削除処理は不要)をそのまま使う。

## 技術対象ファイル(見込み)

- `types.ts`: `RevelationId`に7個追加(`subaru`,`ryuu`,`hotori`,`chou`,`yoku`,`mitsu`,`karasu`)、`RunState`に`lastUsedRevelationId`・`recentUsedRiteIds`を追加
- `revelations.ts`: `REVELATION_POOL`に7個追加
- `revelationEffects.ts`: `applyRevelationEffect`のswitchに7個のno-opケースを追加(`revelationNeedsTarget`には追加しない)
- `params.ts`・`shidasu.config.json`: `revelations`に7エントリ追加(name/desc)
- `revelationActualEffects.ts`: 監査用の実効果説明を7個追加
- `engine.ts`: `useRevelation`に候補13・15・16・17・18・19・23の付与ロジックを追加、`useRite`に`recentUsedRiteIds`の更新を追加、`beginRun`等の`RunState`初期化箇所に`lastUsedRevelationId: null`・`recentUsedRiteIds: []`を追加

## テスト方針

`engine.test.ts`に`useRevelation`・`useRite`のテストとして、各候補ごとに以下を検証する。

- 通常時に正しく付与されること(護符・天啓・秘儀・神託の追加、`currency`の変化)
- 所持上限到達時に0件(または部分件数)しか付与されないこと(使用自体は成功し天啓は消費される)
- 候補13は所持中の護符が抽選対象から除外されること
- 候補16は使用履歴が無い場合に何も付与されないこと、天啓回帰自身を連続使用しても自己参照が起きないこと(履歴が更新されないことを直接検証する)
- 候補17・18・23は「使用中の天啓自身の削除」により空き枠が1つ生まれ、上限ぴったりの状態でも最低1件は獲得できること

## スコープ外

秘儀・護符側からの新規効果追加(ロードマップ項目1・2)は対象外。`docs/shidasu/shidasu-rite-redesign-candidates.md`にまとめた秘儀再編候補の着手も別セッション。
