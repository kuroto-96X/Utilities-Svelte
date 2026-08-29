# フェーズ2: Godotプロジェクトの基盤構築

> このプロンプトは、Shidasu(Balatro風トランプソリティア型ローグライク)をGodot(GDScript)へ移植し、Steam向けPCゲームとして販売するプロジェクトの一部です。Godotプロジェクトは元のWebリポジトリ(Utilities-Svelte)とは別管理ですが、VSCodeのマルチルートワークスペースにより両方のファイルを参照できます。
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

1. **Godotプロジェクトの新規作成**
   - 決定したパスに`project.godot`を含むGodotプロジェクト雛形を作成する(Godot 4系を想定)。
   - ローカルgitリポジトリを新規initし、`.gitignore`(Godot用の標準的な除外設定: `.godot/`、`*.import`等)を設定する。
   - VSCodeの`.code-workspace`ファイルを作成し、Godotプロジェクトフォルダと`Utilities-Svelte`フォルダの両方をマルチルートとして登録する(既存の`docs/superpowers/specs`が追加ディレクトリとして見えているのと同じ仕組みを、GodotプロジェクトとUtilities-Svelte間で再現する)。
2. **フォルダ構成方針の決定**
   - `logic/`(Node非依存の素のGDScriptクラス。ゲームロジック本体)、`scenes/`(シーン・ノード、UI層)、`data/`(JSONデータ・データローダー)、`assets/`(画像・音声、フェーズ14・15で本格投入)という大枠を決定し、実際にフォルダを作成する。
   - `logic/`配下のサブフォルダ構成(例: `logic/state/`(RunState/WaveState相当のステートクラス)、`logic/core/`(進行・スコアリング等のロジック関数)、`logic/data/`(型定義・コンテンツID))も、フェーズ3・4が迷わず配置できるレベルまで具体的に決める。
3. **状態管理パターンの移植方針決定(本フェーズの最重要事項)**
   - Web版の設計思想: `src/lib/game/shidasu/engine.ts`の全ての更新関数(`applyPlayCard`/`applyDrawStock`/`beginRun`/`finishShop`等)は、`RunState`/`WaveState`を引数に取り、スプレッド構文(`{ ...run, ... }`)で**新しいオブジェクトを組み立てて返す**イミュータブル設計になっている。呼び出し側(`src/routes/game/shidasu/+page.svelte`)は`let run = $state<RunState>(...)`という単一の状態変数を持ち、`run = applyPlayCard(params, run, colIndex, undefined, rowIndex)`のように**戻り値をまるごと再代入するだけ**で状態を更新する(88行目・251行目付近を参照)。
   - GDScriptの`RefCounted`/`Object`は参照型であり、TypeScriptのスプレッド構文に相当する「浅いコピー」を素朴に書くと、ネストしたオブジェクト(例: `WaveState`内の`tableau: Card[][]`のような配列や、`Card`のようなオブジェクトの配列)が新旧の状態間で同じインスタンスを指してしまい、片方を書き換えるともう片方も意図せず変化する事故が起きる。TypeScript版はプリミティブ配列・オブジェクトのスプレッドが常に新しい配列/オブジェクトを作る言語仕様に暗黙に依存しているため、この前提がGDScriptでは成立しない。
   - 対策として、`RefCounted`ベースのステートクラス(`RunState`・`WaveState`相当)に、**明示的なディープコピーを行う`duplicate_state()`メソッド**を持たせることを規約化する。「更新関数は引数のステートを直接書き換えず、必ず`duplicate_state()`したコピーに対して変更を加えてから返す」というルールを徹底し、Web版の「更新関数は必ず(新しい)コピーを返す」という設計思想自体は踏襲する。
   - この規約をADRに明文化し、`duplicate_state()`の実装例(`Card`のようなリーフ要素のコピー、`Array`のディープコピー、ネストしたステートクラスの再帰的コピーをどう書くか)をサンプルコードとして残す。
4. **ロジック層とUI層の分離方針決定**
   - `logic/`配下は`Node`を継承しない素のGDScriptクラス(`RefCounted`または`class_name`のみのクラス)とし、シーンツリー・ノードのライフサイクルに依存しないようにする。Web版のロジック層(`src/lib/game/shidasu/`配下、Svelte非依存の純粋関数型TypeScript)と同じ立ち位置にする。
   - `scenes/`配下のノードは、ロジック層の関数を呼び出して戻り値のステートを保持・描画するだけの薄いUI層とする(Web版の`+page.svelte`/`PlayArea.svelte`がロジック層の関数を呼んで返り値を`$state`に代入するだけ、という関係と対応させる)。
5. **乱数方針の決定**
   - フェーズ1の`rng-notes.md`(`createRng`のmulberry32型PRNGの使用箇所一覧)を踏まえ、**Web版との決定論的互換(同一seedで全く同じ結果になること)は不要**と結論づけ、Godot標準の`RandomNumberGenerator`への置き換えを採用する。
   - ただし、**シード指定によるリプレイ/テスト再現性(同一seedなら同一Godotバイナリ内で毎回同じ結果になること)は維持する**方針をADRに明記する。`RandomNumberGenerator.seed`プロパティを使い、Web版の`createRng(seed)`に相当する「シードから独立した乱数系列を作る」関数(Web版の`finishShop`が`createRng(baseSeed + 1)`のように意図的に系列を分離している箇所がある点に注意、`engine.ts`1274行目付近を参照)をGodot側でもどう再現するか方針を書く。
6. **GDScriptコーディング規約の決定**
   - 命名規則(`snake_case`変数・関数、`PascalCase`クラス名など、GDScript標準に準拠)、型付け方針(`static typing`を全面的に使うか、`Variant`をどこまで許容するか)、`enum`の使い方(TypeScriptの文字列リテラルUnion型、例えば`Suit`/`Rank`/`RoleName`/`SpreadId`等をGDScriptでどう表現するか、`enum`にするか文字列定数にするかの方針)を決定する。
   - この規約はフェーズ3で実際に型定義を移植する際に直接使われるため、`Suit`(`'♠' | '♥' | '♦' | '♣' | '★'`)や`ItemId`(99種の文字列リテラルUnion)のような大きなUnion型をGDScriptでどう表現するか、具体例を1〜2個ADRに含めること。

## 参照すべき既存ファイル(Utilities-Svelte内、パス明記、各ファイルで何を見るべきか)

- `src/lib/game/shidasu/types.ts`: `RunState`(468〜551行目)・`WaveState`(235〜370行目)の全体構造。フィールド数が多く、ネストした配列・オブジェクト(`tableau: Card[][]`、`activeSeal`の判別共用体、`items: HeldItem[]`等)がどこにあるかを把握し、ディープコピーが必要な箇所を洗い出す材料にする。
- `src/lib/game/shidasu/engine.ts`: 更新関数の呼び出しパターン。特に`beginRun`(1047行目)・`resolveWaveEnd`(1084行目)・`finishShop`(1267行目)を読み、「既存の`run`/`wave`をスプレッドで展開しつつ一部フィールドだけ上書きした新オブジェクトを返す」実装パターンを確認する。
- `src/routes/game/shidasu/+page.svelte`(88行目・197〜335行目付近): UI層が`run = <engineの更新関数の戻り値>`という形で単一の`$state`変数を丸ごと再代入しているパターン。GDScriptでの再現方法(シグナル経由で親ノードに新ステートを渡す、あるいは単一の状態保持ノードが変数を再代入する、等)を検討する際の参考にする。
- `src/lib/game/shidasu/deck.ts`(79〜87行目): `createRng`(mulberry32型PRNG)の実装。Godot標準RNGとの違い(アルゴリズム自体の一致は不要、シードからの再現性という性質のみ必要)を理解する。
- `Utilities-Svelte/docs/shidasu/migration/reference/rng-notes.md`(フェーズ1成果物): 乱数の使用箇所一覧。

## 成果物・保存先

- Godotプロジェクト雛形一式(`project.godot`、`logic/`/`scenes/`/`data/`/`assets/`フォルダ、`.gitignore`、ローカルgitリポジトリ)。保存先: 新規作成したGodotプロジェクトフォルダ(例: `../Shidasu-Godot/`)。
- `.code-workspace`ファイル(Godotプロジェクトフォルダ直下、またはその親フォルダ)。
- 状態管理サンプル実装: `duplicate_state()`パターンの最小サンプル(例: `RunState`/`WaveState`のごく簡略版、またはより単純な題材でのサンプルクラス)。保存先: Godotプロジェクトの`logic/state/`配下。
- アーキテクチャ決定記録(ADR)一式。保存先: Godotプロジェクトの`docs/adr/`配下に、決定事項ごとに分けて作成する。
  - `0001-project-structure.md`(フォルダ構成方針)
  - `0002-state-management.md`(状態管理パターン、`duplicate_state()`規約)
  - `0003-logic-ui-separation.md`(ロジック層/UI層の分離方針)
  - `0004-rng-policy.md`(乱数方針)
  - `0005-gdscript-conventions.md`(命名・型付け・enum方針)
- `Utilities-Svelte/docs/shidasu/migration/reference/godot-project-location.md`(Utilities-Svelte側): 採用したGodotプロジェクトの実パスと、ADR一式へのパスを記録する橋渡し用メモ。

## 完了条件(チェックリスト形式)

- [ ] Godotプロジェクト雛形(`project.godot`含む)が新規フォルダに作成され、ローカルgitリポジトリとして初期化されている
- [ ] `logic/`/`scenes/`/`data/`/`assets/`の各フォルダが作成され、`logic/`配下のサブフォルダ構成も決まっている
- [ ] `.code-workspace`でGodotプロジェクトと`Utilities-Svelte`の両方がマルチルート登録されている
- [ ] `duplicate_state()`規約とそのサンプル実装が作成され、ネストした配列・オブジェクトを含むステートでも新旧が独立してディープコピーされることを確認できる形になっている
- [ ] ADR 0001〜0005がすべて`docs/adr/`配下に作成されている
- [ ] ADR 0004(乱数方針)に「決定論的互換は不要、Godot標準RNGを採用、ただしシード指定によるリプレイ/テスト再現性は維持する」という結論が明記されている
- [ ] ADR 0005に、大きなUnion型(`ItemId`等)のGDScriptでの表現方針の具体例が含まれている
- [ ] `Utilities-Svelte/docs/shidasu/migration/reference/godot-project-location.md`に実際のGodotプロジェクトパスが記録されている

## 注意点

- **最も構造的に作り直すべき部分であることを常に意識する。** Web版の「引数を取り新しいオブジェクトを返す」設計をGDScriptへ字面通り移植すると、参照型の性質により意図せぬ書き換えが起きる。ここで妥協すると以降のフェーズすべてに影響する。
- ADRは「決定した」という結論だけでなく、「なぜその選択肢を採ったか」「他にどんな選択肢を検討したか」を簡潔に書くこと。後続フェーズの担当AIがADRだけを読んで疑問を持たずに実装を進められる詳しさが目標。
- Godotエディタでの実際の起動・動作確認はユーザー側の作業のため、本フェーズでは「エディタで開けば動くはずのファイル一式を用意する」ところまでで良い。動作確認自体をブロッカーにしない。
- リモートリポジトリ(GitHub等)の新規作成・pushは、実行前に必ずユーザーに確認すること(共有リソースを作る操作のため)。本フェーズはローカルgit initまでで良く、リモート作成は必須作業ではない。
