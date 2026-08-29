# フェーズ2: Godotプロジェクトの基盤構築

> このプロンプトは、Shidasu(Balatro風トランプソリティア型ローグライク)をGodot(C#)へ移植し、Steam向けPCゲームとして販売するプロジェクトの一部です。Godotプロジェクトは元のWebリポジトリ(Utilities-Svelte)とは別管理ですが、VSCodeのマルチルートワークスペースにより両方のファイルを参照できます。
>
> 着手前に必ず読むこと:
> - `Utilities-Svelte/docs/shidasu/migration/01-work-plan.md`(全体計画)
> - `Utilities-Svelte/docs/shidasu/migration/reference/`配下のフェーズ1成果物一式(特に`rng-notes.md`)

## 目的

プロジェクトのフォルダ構成・状態管理パターン・コーディング規約を決定し、以後の全フェーズ(3〜16)の土台を作る。**このフェーズで決めた規約は「アーキテクチャ決定記録(ADR)」として文書化し、後続フェーズは全てこのADRに従うこと。** ここでの決定を誤ると、以後の全フェーズで状態共有バグ(意図しない参照共有によるデータ破壊)が頻発するリスクが高い、プロジェクト全体で最も構造的に重要な工程である。

## 前提・依存

- 依存フェーズ: フェーズ1(資料化)。特に`rng-notes.md`(乱数使用箇所一覧)を読んでから乱数方針を決定すること。
- Godotプロジェクトは`Utilities-Svelte`とは完全に別管理の新規フォルダ・新規gitリポジトリとして作成する。配置場所は`Utilities-Svelte`と兄弟階層(例: `../Shidasu-Godot/`、実際の親フォルダはUtilities-Svelteの1つ上の階層)を既定候補とする。既に`.code-workspace`ファイルなどでGodotプロジェクトの配置場所がユーザーによって決められている形跡がないか確認し、あればそれに従う。無ければ`../Shidasu-Godot/`に新規作成してよい。
- **重要**: 実際に採用したGodotプロジェクトのパスを`Utilities-Svelte/docs/shidasu/migration/reference/godot-project-location.md`に記録すること。後続フェーズ(3・4以降)のプロンプトは「Godotプロジェクト」という抽象的な表現でしか場所を示せないため、このファイルが実際のパスの唯一の正になる。
- Godotエディタ本体のインストール・起動はユーザー側の作業(AI代行不可)。本フェーズでは`project.godot`等のファイル一式を作成するに留め、実際にGodotエディタで開いて動作確認する部分はユーザーに委ねてよい。

## 作業内容(具体的な箇条書き)

1. **ソリューション構成の新規作成**
   - 決定したパスに、以下3プロジェクトから成る.NETソリューション(`.sln`)を作成する。
     - **`Shidasu.Core`**: Godotに一切依存しないPure C#のクラスライブラリプロジェクト(`<TargetFramework>`はGodotプロジェクト本体と揃える。`Godot.*`名前空間への参照・パッケージ参照は一切追加しない)。ゲームルール・状態(`RunState`/`WaveState`)・スコア計算・全アイテム効果ロジックをここに実装する。
     - **Godotプロジェクト本体**(`project.godot`を含む、Godot 4系のC#対応プロジェクト): `Shidasu.Core`をプロジェクト参照し、Node/Controlベースのシーン・UI・入力処理・演出のみを担当する薄いアダプタ層とする。ゲームロジックをここに書き込まない。
     - **`Shidasu.Core.Tests`**: xUnitのテストプロジェクト。`Shidasu.Core`をプロジェクト参照し、Godotランタイムを起動せずロジック層のユニットテストを実行する。
   - **プロジェクト参照の向きは常に一方向(Godotプロジェクト本体→`Shidasu.Core`、`Shidasu.Core.Tests`→`Shidasu.Core`)に保つこと。** `Shidasu.Core`が逆にGodotプロジェクト本体や`Godot.*`アセンブリを参照することは決して無いようにする(この逆参照が発生するとPure C#という前提が崩れ、xUnitでのGodot非依存テストが不可能になる)。CI等で機械的に検知したい場合は、`Shidasu.Core.csproj`に`Godot.*`パッケージ参照が無いことを確認する、または`Shidasu.Core`配下のソースに`using Godot;`が出現しないことをgrep等で確認する運用をADRに明記する。
   - ローカルgitリポジトリを新規initし、`.gitignore`(Godot用の標準的な除外設定: `.godot/`、`*.import`等に加え、.NET用の`bin/`・`obj/`)を設定する。
   - VSCodeの`.code-workspace`ファイルを作成し、Godotプロジェクトフォルダ(ソリューション全体を含む)と`Utilities-Svelte`フォルダの両方をマルチルートとして登録する(既存の`docs/superpowers/specs`が追加ディレクトリとして見えているのと同じ仕組みを、GodotプロジェクトとUtilities-Svelte間で再現する)。
2. **フォルダ構成方針の決定**
   - `Shidasu.Core/`配下は`State/`(RunState/WaveState相当のrecordクラス)、`Core/`(進行・スコアリング等のロジック関数)、`Data/`(型定義・enum・コンテンツID・パラメータローダー)というnamespace/フォルダ構成を基本とする。
   - Godotプロジェクト本体側は`Scenes/`(シーン・ノード、UI層)、`Assets/`(画像・音声、フェーズ14・15で本格投入)という大枠を決定し、実際にフォルダを作成する。
   - フェーズ3・4が迷わず配置できるレベルまで、namespace名(例: `Shidasu.Core.State`、`Shidasu.Core.Data`)を含めて具体的に決める。
3. **状態管理パターンの移植方針決定(本フェーズの最重要事項)**
   - Web版の設計思想: `src/lib/game/shidasu/engine.ts`の全ての更新関数(`applyPlayCard`/`applyDrawStock`/`beginRun`/`finishShop`等)は、`RunState`/`WaveState`を引数に取り、スプレッド構文(`{ ...run, ... }`)で**新しいオブジェクトを組み立てて返す**イミュータブル設計になっている。呼び出し側(`src/routes/game/shidasu/+page.svelte`)は`let run = $state<RunState>(...)`という単一の状態変数を持ち、`run = applyPlayCard(params, run, colIndex, undefined, rowIndex)`のように**戻り値をまるごと再代入するだけ**で状態を更新する(88行目・251行目付近を参照)。
   - この設計はC#の`record class`と`with`式でそのまま再現できる。`RunState`・`WaveState`を`public record class`として定義し、Web版のスプレッド構文`{ ...run, phase: 'shop' }`に相当する更新は`run with { Phase = RunPhase.Shop }`のような非破壊コピーで書く。C#の`record`は既定でトップレベルの浅いコピーを行うため、ネストした参照型(`List<Card>`や`Card[][]`のような`WaveState.Tableau`相当のコレクション)を含むフィールドを更新する際は、そのコレクション自体も併せて新しいインスタンスとして組み立ててから`with`式に渡す必要がある(コレクションを書き換えずに使い回すと、TypeScript版のスプレッドが暗黙に頼っていた「常に新しい配列/オブジェクトを作る」という前提が崩れ、新旧状態間で同じリスト参照を共有してしまう)。
   - 対策として、「更新関数はコレクション型フィールドを書き換える際、必ず新しいコレクション(`ToList()`・`with`式のコレクション式`[..oldList, newItem]`等)を組み立ててから`with`式に渡す」という規約を定める。ネストした`record`(例: `WaveState`内の`Card`)自体は`record`の値ベースの等価性・イミュータブルなプロパティにより自然にディープ性が保たれるため、明示的なディープコピー用メソッドは不要になる(recordの`with`式が同等機能を標準提供するため)。
   - この規約をADRに明文化し、「コレクションを含む`record`をどう安全に`with`更新するか」の実装例(`List<Card>`への要素追加・削除を伴う`with`式のサンプルコード)を残す。
4. **ロジック層とUI層の分離方針決定**
   - `Shidasu.Core`配下は`Godot.*`に一切依存しないPure C#クラス(`record`・`class`・`static`ヘルパー)のみとし、Node/シーンツリーのライフサイクルに依存しないようにする。Web版のロジック層(`src/lib/game/shidasu/`配下、Svelte非依存の純粋関数型TypeScript)と同じ立ち位置にする。
   - Godotプロジェクト本体側のNode/Controlスクリプトは、`Shidasu.Core`の関数を呼び出して戻り値のステートを保持・描画するだけの薄いUI層とする(Web版の`+page.svelte`/`PlayArea.svelte`がロジック層の関数を呼んで返り値を`$state`に代入するだけ、という関係と対応させる)。
5. **乱数方針の決定**
   - フェーズ1の`rng-notes.md`(`createRng`のmulberry32型PRNGの使用箇所一覧)を踏まえ、**Web版との決定論的互換(同一seedで全く同じ結果になること)は不要**と結論づけ、通常時は`System.Random`への置き換えを採用する。
   - ただし、**シード指定によるリプレイ/テスト再現性(同一seedなら毎回同じ結果になること)は維持する**方針をADRに明記する。`System.Random`はseedを渡せば.NET実装内で再現性を持つが、テストの安定性(.NETバージョン間での`System.Random`アルゴリズム変更リスクを避ける、Web版の`createRng`と同系統の軽量PRNGで検証したい場合)のため、Web版の`createRng`(mulberry32)相当の軽量PRNGクラスを`Shidasu.Core`内に移植し、テストコードから利用できるようにする。Web版の`createRng(seed)`に相当する「シードから独立した乱数系列を作る」関数(Web版の`finishShop`が`createRng(baseSeed + 1)`のように意図的に系列を分離している箇所がある点に注意、`engine.ts`1274行目付近を参照)を、`System.Random`もしくは移植版mulberry32のどちらでどう再現するか方針を書く。
6. **C#コーディング規約の決定**
   - 命名規則(標準的なC#規約に準拠。publicメンバー・クラス名・メソッド名は`PascalCase`、privateフィールドは`camelCase`、必要に応じて`_`プレフィックスの可否を明記)、nullable参照型の扱い(`<Nullable>enable</Nullable>`を採用するか)、`enum`の使い方(TypeScriptの文字列リテラルUnion型、例えば`Suit`/`Rank`/`RoleName`/`SpreadId`等をC#の`enum`でどう表現するか、値と表示名のマッピングが必要な場合の方針)を決定する。
   - namespace構成(`Shidasu.Core`、`Shidasu.Core.State`、`Shidasu.Core.Data`等)もここで確定する。
   - この規約はフェーズ3で実際に型定義を移植する際に直接使われるため、`Suit`(`'♠' | '♥' | '♦' | '♣' | '★'`)や`ItemId`(99種の文字列リテラルUnion)のような大きなUnion型をC#でどう表現するか、具体例を1〜2個ADRに含めること(`ItemId`のような大規模なUnion型は`enum`とID⇔メタデータのDictionary参照の組み合わせが有力な選択肢になる)。

## 参照すべき既存ファイル(Utilities-Svelte内、パス明記、各ファイルで何を見るべきか)

- `src/lib/game/shidasu/types.ts`: `RunState`(468〜551行目)・`WaveState`(235〜370行目)の全体構造。フィールド数が多く、ネストした配列・オブジェクト(`tableau: Card[][]`、`activeSeal`の判別共用体、`items: HeldItem[]`等)がどこにあるかを把握し、C#の`record`に移した際にどのフィールドがコレクション型(`with`更新時に新しいコレクションを組み立てる必要がある箇所)かを洗い出す材料にする。
- `src/lib/game/shidasu/engine.ts`: 更新関数の呼び出しパターン。特に`beginRun`(1047行目)・`resolveWaveEnd`(1084行目)・`finishShop`(1267行目)を読み、「既存の`run`/`wave`をスプレッドで展開しつつ一部フィールドだけ上書きした新オブジェクトを返す」実装パターンを確認する。
- `src/routes/game/shidasu/+page.svelte`(88行目・197〜335行目付近): UI層が`run = <engineの更新関数の戻り値>`という形で単一の`$state`変数を丸ごと再代入しているパターン。Godot C#での再現方法(シグナル経由で親ノードに新ステートを渡す、あるいは単一の状態保持ノードが変数を再代入する、等)を検討する際の参考にする。
- `src/lib/game/shidasu/deck.ts`(79〜87行目): `createRng`(mulberry32型PRNG)の実装。`System.Random`との違い(アルゴリズム自体の一致は不要、シードからの再現性という性質のみ必要)を理解し、`Shidasu.Core`へ移植する軽量PRNGクラスの実装元にする。
- `Utilities-Svelte/docs/shidasu/migration/reference/rng-notes.md`(フェーズ1成果物): 乱数の使用箇所一覧。

## 成果物・保存先

- .NETソリューション一式(`.sln`、`Shidasu.Core`・Godotプロジェクト本体・`Shidasu.Core.Tests`の3プロジェクト、`.gitignore`、ローカルgitリポジトリ)。保存先: 新規作成したGodotプロジェクトフォルダ(例: `../Shidasu-Godot/`)。
- `.code-workspace`ファイル(Godotプロジェクトフォルダ直下、またはその親フォルダ)。
- 状態管理サンプル実装: `record`+`with`式パターンの最小サンプル(例: `RunState`/`WaveState`のごく簡略版、コレクション型フィールドを含む題材でのサンプルクラス)。保存先: `Shidasu.Core/State/`配下。
- アーキテクチャ決定記録(ADR)一式。保存先: Godotプロジェクトの`docs/adr/`配下に、決定事項ごとに分けて作成する。
  - `0001-project-structure.md`(ソリューション構成・フォルダ構成方針)
  - `0002-state-management.md`(状態管理パターン、`record`+`with`式規約)
  - `0003-logic-ui-separation.md`(ロジック層/UI層の分離方針、`Shidasu.Core`のGodot非依存性維持の注意点)
  - `0004-rng-policy.md`(乱数方針)
  - `0005-csharp-conventions.md`(命名・型付け・enum方針)
- `Utilities-Svelte/docs/shidasu/migration/reference/godot-project-location.md`(Utilities-Svelte側): 採用したGodotプロジェクトの実パスと、ADR一式へのパスを記録する橋渡し用メモ。

## 完了条件(チェックリスト形式)

- [ ] `.sln`と`Shidasu.Core`・Godotプロジェクト本体(`project.godot`含む)・`Shidasu.Core.Tests`の3プロジェクトが新規フォルダに作成され、ローカルgitリポジトリとして初期化されている
- [ ] `Shidasu.Core`が`Godot.*`を一切参照していない(csprojにGodotパッケージ参照が無く、ソース中に`using Godot;`が存在しない)ことを確認した
- [ ] `Shidasu.Core/State/`・`Core/`・`Data/`、Godotプロジェクト本体側`Scenes/`・`Assets/`の各フォルダが作成され、namespace構成も決まっている
- [ ] `.code-workspace`でGodotプロジェクトと`Utilities-Svelte`の両方がマルチルート登録されている
- [ ] `record`+`with`式規約とそのサンプル実装が作成され、コレクション型フィールドを含むステートでも新旧が独立して更新されることを確認できる形になっている
- [ ] ADR 0001〜0005がすべて`docs/adr/`配下に作成されている
- [ ] ADR 0003に、`Shidasu.Core`→Godotプロジェクト本体への逆参照を防ぐための注意点(プロジェクト参照の向きを一方向に保つ方法)が明記されている
- [ ] ADR 0004(乱数方針)に「決定論的互換は不要、通常時は`System.Random`を採用、ただしシード指定によるリプレイ/テスト再現性のためmulberry32相当の軽量PRNGを`Shidasu.Core`に移植する」という結論が明記されている
- [ ] ADR 0005に、大きなUnion型(`ItemId`等)のC#での表現方針の具体例が含まれている
- [ ] `Shidasu.Core.Tests`からxUnitテストが実行でき、Godotエディタを起動せずに`Shidasu.Core`のロジックを検証できることを確認した
- [ ] `Utilities-Svelte/docs/shidasu/migration/reference/godot-project-location.md`に実際のGodotプロジェクトパスが記録されている

## 注意点

- **最も構造的に作り直すべき部分であることを常に意識する。** Web版の「引数を取り新しいオブジェクトを返す」設計をC#へ移植する際、コレクション型フィールドを`with`式で扱う箇所を素朴に書くと、参照型の性質により意図せぬ書き換えが起きる。ここで妥協すると以降のフェーズすべてに影響する。
- **`Shidasu.Core`にGodot依存が紛れ込まないよう常に警戒すること。** 実装中に「ちょっとだけGodotの型(`Vector2`等)を使いたい」という誘惑が生じやすいが、それを許すとPure C#という前提が崩れ、xUnitでのGodot非依存テストが不可能になる。座標等が必要な場合もプリミティブ型(`float`のペア等)で表現し、Godot型への変換はアダプタ層(Godotプロジェクト本体側)で行う。
- ADRは「決定した」という結論だけでなく、「なぜその選択肢を採ったか」「他にどんな選択肢を検討したか」を簡潔に書くこと。後続フェーズの担当AIがADRだけを読んで疑問を持たずに実装を進められる詳しさが目標。
- Godotエディタでの実際の起動・動作確認はユーザー側の作業のため、本フェーズでは「エディタで開けば動くはずのファイル一式を用意する」ところまでで良い。動作確認自体をブロッカーにしない。
- リモートリポジトリ(GitHub等)の新規作成・pushは、実行前に必ずユーザーに確認すること(共有リソースを作る操作のため)。本フェーズはローカルgit initまでで良く、リモート作成は必須作業ではない。
