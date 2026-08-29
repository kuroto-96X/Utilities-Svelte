# フェーズ3: コアデータモデル・パラメータ/コンテンツデータの移植

> このプロンプトは、Shidasu(Balatro風トランプソリティア型ローグライク)をGodot(C#)へ移植し、Steam向けPCゲームとして販売するプロジェクトの一部です。Godotプロジェクトは元のWebリポジトリ(Utilities-Svelte)とは別管理ですが、VSCodeのマルチルートワークスペースにより両方のファイルを参照できます。
>
> 着手前に必ず読むこと:
> - `Utilities-Svelte/docs/shidasu/migration/01-work-plan.md`(全体計画)
> - `Utilities-Svelte/docs/shidasu/migration/reference/godot-project-location.md`(フェーズ2成果物。Godotプロジェクトの実パスを確認する)
> - Godotプロジェクトの`docs/adr/`配下のADR一式(フェーズ2成果物。特に`0002-state-management.md`の`record`+`with`式規約、`0005-csharp-conventions.md`の命名・型付け・enum方針)
> - `Utilities-Svelte/docs/shidasu/migration/reference/catalog-talismans.md`・`catalog-rites.md`・`catalog-revelations.md`・`catalog-relics.md`・`catalog-roles-spreads.md`(フェーズ1成果物のコンテンツカタログ)

## 目的

Web版の型定義(`types.ts`)とゲームバランス数値(`shidasu.config.json`)を、フェーズ2で決めた規約に従って`Shidasu.Core`内のC#(Godot非依存のPure C#)で扱える形に移す。**このフェーズでは効果ロジック(護符99種等の実際の効果処理)は実装しない。** 型・enum・データ構造・JSONローダーというデータモデル部分のみが対象で、効果ロジックはフェーズ6〜9の担当。

## 前提・依存

- 依存フェーズ: フェーズ1(コンテンツカタログ)、フェーズ2(プロジェクト基盤・ADR)。フェーズ2のADR、特に「大きなUnion型(`ItemId`等)のC#での表現方針」「`record`+`with`式規約」に必ず従うこと。独自判断でこれらの方針を変えないこと(変えたい場合はADRの更新を先に行う)。
- 本フェーズで作成する型・データローダーはすべて`Shidasu.Core`プロジェクト内に実装し、`Godot.*`への依存を持ち込まないこと(JSONの読み込みには`System.Text.Json`等のGodot非依存のライブラリを使う)。
- 後続フェーズ(4〜9)は、本フェーズで定義した型・データローダーをそのまま使う前提で実装する。ここでの型名・enum名・データアクセス方法(例: `params.talismans[id].n`に相当するC#側の書き方)が後続フェーズの実装の土台になるため、命名の一貫性を重視すること。

## 作業内容(具体的な箇条書き)

1. **列挙型・値オブジェクトの定義**
   - `src/lib/game/shidasu/types.ts`の以下の型を、フェーズ2のADR方針に従ってC#の`enum`・`record`として定義する。
     - `Suit`(`'♠' | '♥' | '♦' | '♣' | '★'`、4行目)
     - `Rank`(`0〜13`の数値リテラルUnion、5行目)
     - `StageModifier`(`'none' | 'noLoop' | 'faceLock'`、6行目)
     - `SabotageActionId`(32種、7〜16行目)
     - `SpreadId`(10種、33行目)
     - `RoleName`(10種、96行目)
     - `ItemId`(護符99種、97〜136行目)
     - `RiteId`(秘儀24種、142〜154行目)
     - `RevelationId`(天啓28種、157〜179行目)
     - `RelicId`(レリック10種、183〜186行目)
     - `RunPhase`(`'title' | 'playing' | 'shop' | ...`、372行目)
     - `ShopSlotKind`・`CardSetGenreId`(374行目・386〜396行目)
   - `Card`(188〜203行目)・`DeckCard`(207〜215行目)・`ScoreGain`(217〜220行目)を、フェーズ2の`record`+`with`式規約に従う`record`(または`record struct`)として定義する(値ベースの等価性・非破壊コピーが必要になるため)。
   - `StarRestriction`(70〜77行目)・`StarSabotage`(19〜22行目)・`Star`(82〜94行目)のような判別共用体(discriminated union)は、TypeScriptでは`kind`フィールドで分岐するUnion型として表現されている。C#では`kind`を`enum`にしたプロパティを持つ`record`、またはC#の`record`継承(`abstract record`をベースにしたサブタイプ+パターンマッチング)として表現するか、フェーズ2のADRの方針に従って決定し、実装する。
2. **JSONローダーの実装**(`params.ts`の役割の再現)
   - `src/lib/game/shidasu/params.ts`の`ShidasuParams`インターフェースが、`shidasu.config.json`のスキーマそのものであることを確認する(2〜3行目、`import shidasuConfigJson from './shidasu.config.json'`)。
   - `shidasu.config.json`をそのまま読み込む(ファイルを`Shidasu.Core`側のデータフォルダ、またはGodotプロジェクト本体の`Assets/`配下にコピーし、`Shidasu.Core`から`System.Text.Json`(`JsonSerializer.Deserialize`)で読む)、C#の型付きデータクラス(`ShidasuParams`相当の`record`)に変換するローダーを実装する。`System.Text.Json`はGodotに依存しない.NET標準ライブラリであるため、`Shidasu.Core`のGodot非依存性を保ったまま実装できる。
   - 「メタデータ(名称・数値・説明文テンプレート)はJSON、効果ロジックはコード」という現状の分離をそのまま踏襲する。ローダーの責務はJSON→型付きクラスへの変換のみで、効果の意味づけ(例えば「護符Xのnフィールドが何に使われるか」)には関与しない。
   - `params.ts`の`ShidasuParams.talismans`のように、護符99種それぞれが個別の型を持つフィールド(`bridge: { name: string; m: number; rarity: Rarity; desc: string }`等、73〜120行目付近に一部抜粋あり、全体は646行)の構造をC#側でどう表現するか決定する(例えば護符ごとに個別のプロパティを持つ巨大な`record`にするか、`Dictionary<ItemId, TalismanParams>`のような辞書構造にするか)。件数が99種と多いため、後続フェーズでのアクセスのしやすさ(`params.Talismans[ItemId.Bridge].M`のような直感的なアクセス方法)を優先して設計すること。
   - `itemDesc`(`items.ts`54〜62行目)のような、説明文テンプレート内の`{n}`のようなプレースホルダーを実際のパラメータ値で置換するヘルパー関数(正規表現`/\{(\w+)\}/g`で該当キーを展開)も移植する。秘儀・天啓・レリックにも同様のヘルパー(`riteDesc`/`revelationDesc`/`relicDesc`)があるので、共通化できないか検討した上で実装する。
3. **コンテンツIDプール・メタデータ一覧の定義**
   - フェーズ1のコンテンツカタログを元に、各アイテムのID一覧を次のプール定数として定義する。
     - 護符: `src/lib/game/shidasu/items.ts`の`ITEM_POOL`(8〜48行目、99件)
     - 秘儀: `src/lib/game/shidasu/rites.ts`の`RITE_POOL`(7〜14行目、24件)
     - 天啓: `src/lib/game/shidasu/revelations.ts`の`REVELATION_POOL`(7〜29行目、28件)
     - レリック: `src/lib/game/shidasu/relics.ts`の`RELIC_POOL`(6〜10行目、10件)
     - 妨害: `src/lib/game/shidasu/sabotage.ts`の`SABOTAGE_POOL`(8〜17行目、32件)
     - 役: `src/lib/game/shidasu/roles.ts`の`ROLE_LIST`(14〜25行目、10件、`RoleEntry`型で`label`/`desc`も持つ)
   - これらのプールは、後続フェーズ(6〜9)がショップ抽選・報酬抽選のロジックを実装する際にそのまま使う。**この時点では抽選ロジック自体(`rollItemOffer`/`rollOffer`等)は実装しなくてよい**(フェーズ8で移植する)。ただしプール定数自体は本フェーズで定義しておくこと。

## 参照すべき既存ファイル(Utilities-Svelte内、パス明記、各ファイルで何を見るべきか)

- `src/lib/game/shidasu/types.ts`(551行): 移植対象の型定義そのもの。行番号の目安は上記「作業内容」に記載した通り。
- `src/lib/game/shidasu/params.ts`(646行): `ShidasuParams`インターフェース全体。5〜646行目にわたり、`layout`/`scoring`/`stars`/`spreads`/`items`/`currency`/`shop`/`talismans`(護符99種分、73行目〜)/`rites`/`revelations`/`relics`/`sabotageActions`の各セクション構造を確認する。
- `src/lib/game/shidasu/shidasu.config.json`(1732行): 実データ。JSONローダーの動作確認に使う実際の入力ファイル。
- `src/lib/game/shidasu/items.ts`(67行): `ITEM_POOL`定義、`itemName`/`itemDesc`(50〜62行目、プレースホルダー展開ロジック)。
- `src/lib/game/shidasu/rites.ts`(40行): `RITE_POOL`定義、`riteName`/`riteDesc`(16〜27行目)。
- `src/lib/game/shidasu/revelations.ts`(49行): `REVELATION_POOL`定義、`revelationName`/`revelationDesc`(31〜42行目)。
- `src/lib/game/shidasu/relics.ts`(124行): `RELIC_POOL`定義、`relicName`/`relicDesc`/`relicTsukumokaDesc`(12〜35行目)。付喪化(進化)状態の扱い(`{ id: RelicId; tsukumoka: boolean }`、`types.ts`493行目)も確認する。
- `src/lib/game/shidasu/sabotage.ts`(43行): `SABOTAGE_POOL`定義、`sabotageActionName`/`sabotageActionDesc`(20〜27行目)。
- `src/lib/game/shidasu/roles.ts`(41行): `ROLE_LIST`定義、`roleBasePoint`(28〜41行目、役ごとの基礎点を`params.scoring`から引くロジック。ロジック自体はフェーズ5の担当だが、`ROLE_LIST`のデータ構造自体は本フェーズで定義する)。
- `Utilities-Svelte/docs/shidasu/migration/reference/catalog-*.md`(フェーズ1成果物): 各カテゴリーの全件一覧。実装漏れが無いかの照合に使う。

## 成果物・保存先

Godotプロジェクト(`Utilities-Svelte/docs/shidasu/migration/reference/godot-project-location.md`に記載のパス)内の`Shidasu.Core`プロジェクト配下に作成する。

- `Shidasu.Core/Data/Enums.cs`(または方針に応じて複数ファイルに分割): `Suit`/`Rank`/`StageModifier`/`SabotageActionId`/`SpreadId`/`RoleName`/`ItemId`/`RiteId`/`RevelationId`/`RelicId`/`RunPhase`/`ShopSlotKind`/`CardSetGenreId`のenum定義一式
- `Shidasu.Core/Data/Card.cs`・`DeckCard.cs`・`ScoreGain.cs`等: `Card`/`DeckCard`/`ScoreGain`相当の`record`
- `Shidasu.Core/Data/Star.cs`等: `Star`/`StarRestriction`/`StarSabotage`相当の`record`
- `Shidasu.Core/Data/ParamsLoader.cs`: `shidasu.config.json`を`System.Text.Json`で読み込み型付きデータクラスへ変換するローダー
- `Shidasu.Core/Data/ShidasuParams.cs`(および護符・秘儀・天啓・レリック・妨害・星・スプレッドのパラメータ用サブクラス、ファイル分割は規約に従う): `ShidasuParams`相当のデータクラス一式
- `Shidasu.Core/Data/ItemPool.cs`・`RitePool.cs`・`RevelationPool.cs`・`RelicPool.cs`・`SabotagePool.cs`・`RoleList.cs`: 各コンテンツIDプール定数
- `shidasu.config.json`: Web版から複製したJSONデータファイル本体(`Shidasu.Core`のビルド出力に含める、またはGodotプロジェクト本体の`Assets/`配下に置き実行時に読み込むかは、フェーズ2のADR・実際のビルド構成に従って決定する)

## 完了条件(チェックリスト形式)

- [ ] `types.ts`に定義された主要な型・enumが全てC#側(`Shidasu.Core`)に定義されている(上記「作業内容1」のリストを1件ずつ確認)
- [ ] `shidasu.config.json`を実際に読み込み、型付きデータクラスへ変換するローダーが動作する(`Shidasu.Core.Tests`のxUnitテストからGodotを起動せずにエラーなく読み込めることを確認する)
- [ ] 護符99件・秘儀24件・天啓28件・レリック10件・妨害32件・役10件のプール定数が、それぞれ件数が一致する形で定義されている
- [ ] プレースホルダー展開ヘルパー(`{n}`等をパラメータ値に置換)が実装され、少なくとも1件の護符説明文で動作確認できている
- [ ] 護符99種分のパラメータ構造(`Talismans`)が、後続フェーズから`params.Talismans[ItemId.X].Field`に相当する形でアクセスできる設計になっている
- [ ] フェーズ2のADR(特に`record`+`with`式規約とenum方針)に沿った実装になっている(逸脱がある場合はADRを更新するか、本フェーズの実装を規約に合わせて修正する)
- [ ] 効果ロジック(護符・秘儀・天啓・妨害の実際の効果処理)は実装していない(スコープ外であることを確認する)
- [ ] 本フェーズで実装したコードが`Shidasu.Core`内に閉じており、`Godot.*`への依存(`using Godot;`)が含まれていないことを確認した

## 注意点

- 護符99種のような大きなUnion型・データ構造をenumや巨大な`record`として素朴に書き下すと可読性・保守性が落ちる可能性がある。フェーズ2のADRで方針が決まっているはずなので、まずそちらを確認し、無ければこのフェーズで補足のADR(または設計メモ)を残してから実装に入ること。
- 「メタデータはJSON、効果ロジックはコード」という分離は、後続フェーズ(バランス調整のたびにコードを触らずJSONだけ編集できるようにする)の生産性に直結する重要な設計判断なので、崩さないこと。
- JSONローダーの型変換で、TypeScript側の`Record<RoleName, number>`のような「キーが全役固定のオブジェクト」(`oracleLevels`等)に相当する構造をGodotでどう表現するかも、このフェーズで方針を決めておくとフェーズ4以降がスムーズになる(`Dictionary`か、役ごとに固定フィールドを持つクラスか)。
