# フェーズ14: ビジュアルアセットガイド

フェーズ14(ビジュアルアセット制作・組み込み)の成果物ドキュメント。複数の担当(カードデザイン/カテゴリ別モチーフアイコン/背景・エフェクト素材)が並行して作業しており、それぞれ担当セクションに追記する。

---

## カードデザイン

担当範囲: トランプカード表面(全スート×全ランク+ワイルド)・裏面のベクター描画実装。

### レイアウトルール

Web版はCSS/Unicode文字のみの「ノーアセット」実装だったが、Godot版はプログラム的なベクター描画(`Control._Draw()`)で表現する。画像生成AIは不使用。全52通り+ワイルドに機械的に適用できる、シンプルな共通レイアウトを採用した(Web版のような枚数ごとのPip座標テーブルは不要と判断)。

- **カード基準サイズ**: 120×168(比率5:7)。`CardArtRenderer.CardWidth`/`CardArtRenderer.CardHeight`定数として定義。実際の描画は`Control.Size`を参照するため、コンテナ側で任意の表示サイズに拡縮しても比率を保てば破綻しない。
- **四隅のミニ表示**: 左上に「ランク文字(A/2〜10/J/Q/K)+スート記号」を小さく表示。右下には同内容を180度回転して表示(`DrawSetTransform`で座標系を回転させてから`DrawString`)。
- **中央表示**:
  - 数字札(A・2〜10): 中央にスート記号を1つ、大きく表示するのみ(Web版のようなPip枚数配置は行わない)。
  - 絵札(J/Q/K): 中央に角丸の装飾フレーム(枠線のみ)+ランクの文字(A/J/Q/K相当)を大きく表示し、上下に小さいスート記号を1つずつ添える。
  - ワイルド: 紫系統の配色(背景は薄紫のグラデーション風2段塗り、枠線・アクセントは濃い紫)+中央に五芒星のベクター図形(`DrawStarPolygon`)。四隅のミニ表示はランクを持たず「★」のみ。
- **配色**: ♠♣=黒(`BlackColor`)、♥♦=赤(`RedColor`)。TypeScript版`patterns.ts`の`isRed`ロジック(♥♦が赤)をそのまま踏襲。
- **裏面(共通1種)**: 濃紺系のグラデーション風背景+内側の縁取り+菱形(ダイヤ形)を格子状にタイル配置した幾何学模様、中央に小さい白い星を1つ配置。ゲーム全体で共通の1デザインのみ。

### スート記号のベクター描画

Unicode文字(♠♥♦♣)のフォント表示に頼らず、円弧・多角形の座標をコードで組み立てて描画している(判断の結果、時間対効果を考慮しつつベクター図形化を採用)。

- ハート: 左右2つの半円(円弧を16分割の折れ線近似)+下端の頂点を`DrawColoredPolygon`で1つのポリゴンとして合成。
- スペード: ハートを上下反転させた形+下部にステム(軸)の台形を追加。
- ダイヤ: 4頂点の菱形ポリゴン。
- クラブ: 3つの円(`DrawCircle`)+下部にステムの台形。
- 四隅のミニ表示・絵札の小スート表示も含め、全て同じ`DrawSuitGlyph`経由で描画されるため、スートごとの見た目は常に一貫する。

### 実装ファイル

- `Game/Scripts/CardArt/CardArtRenderer.cs`: カード1枚のベクター描画コンポーネント本体(`Control`継承)。`Configure(Suit, int rank, bool wild, bool faceUp)`で状態を設定し`QueueRedraw()`で再描画する。既存の`Game/Scripts/CardFace.cs`(フェーズ12実装、Unicode文字+PanelContainerの簡易表示)とは別クラスであり、`CardFace.cs`は一切編集していない。
- `Game/Scripts/CardArt/CardArtPreview.cs`: 動作確認用プレビューシーンのスクリプト。4スート×13ランクの表、ワイルド、裏面を並べて一覧表示する(表示倍率0.55倍、既定ウィンドウ内に収まるサイズ)。
- `Game/Scripts/CardArt/CardArtCloseupPreview.cs`: King of Hearts・Queen of Diamonds・ワイルド・裏面の4枚を2.2倍に拡大表示する、細部確認用の補助プレビュー。
- `Game/Scripts/CardArt/CardArtPreviewScreenshotRunner.cs`: 通常起動(ウィンドウあり)でプレビューシーンを実行し、描画安定後(0.5秒後)に`GetViewport().GetTexture().GetImage().SavePng()`でスクリーンショットを1枚保存して終了する検証用ランナー。`Game/Scripts/Backgrounds/PreviewScreenshotRunner.cs`(背景担当エージェントの実装)と同じパターンを踏襲。`[Export] FileName`で出力ファイル名を切り替え可能にし、一覧用・拡大用の2シーンで共用している。
- `Game/Scenes/_Preview/CardArtPreview.tscn` / `CardArtCloseupPreview.tscn`: 上記プレビュースクリプトをアタッチしたシーン(削除せず残置)。
- `Game/Scenes/_Preview/CardArtScreenshotRunner.tscn` / `CardArtCloseupScreenshotRunner.tscn`: `CardArtPreviewScreenshotRunner`+各プレビューシーンを組み合わせた実行用シーン。`godot_console res://Scenes/_Preview/CardArtScreenshotRunner.tscn`のようにGodotエディタ経由で直接実行すると、`Game/Scenes/_Preview/Screenshots/`配下に`card_art_all.png`/`card_art_closeup.png`としてスクリーンショットが保存される(`--headless`はGPUレンダリング結果を取得できないため、通常起動で実行する必要がある)。

### 今後の`CardFace.cs`への統合手順(想定、未実施)

本フェーズでは実ゲームへの組み込みは行わず、新規ファイルのみを作成した。将来的に統合する場合の想定手順:

1. `CardFace.cs`の`PanelContainer`構成(`StyleBoxFlat`+`HBoxContainer`+2つの`Label`)を、`CardArtRenderer`(`Control`)に差し替えるか、`CardFace`内部に`CardArtRenderer`を子ノードとして追加する形にするか方針を決める(既存の`Refresh(Card card, bool faceUp)`とのAPI互換性を保てるかがポイント)。
2. `CardArtRenderer.Configure`の引数(`Suit`, `int rank`, `bool wild`, `bool faceUp`)は`Card`レコードの`Suit`/`Rank`/`Wild`+呼び出し側の`faceUp`引数からそのままマッピング可能。
3. `CardFace.tscn`のノード構成を`CardArtRenderer`ベースに置き換える、またはCardArtRenderer用の新規`.tscn`(`CardArtFace.tscn`のような名前)を作り、`PlayingPhase.cs`等の呼び出し側で読み込むシーンパスを差し替える。
4. カードサイズ(現状`CardFace`は48×72、`CardArtRenderer`の基準は120×168)をどちらに合わせるか、実際の場札レイアウト(`PlayArea`相当のGodot実装)側の余白と合わせて再調整する。
5. 統合後、既存のプレイ画面の演出(フェーズ13の移動アニメーション等)が`CardFace`のノード構造に依存していないか確認する(依存している場合は演出コード側の追従修正が必要になる可能性がある)。

### 目視確認結果

`godot_console`で`CardArtScreenshotRunner.tscn`(一覧)・`CardArtCloseupScreenshotRunner.tscn`(拡大)を実行し、スクリーンショットで確認済み。52通り(4スート×13ランク)の表示に破綻や重なりがなく、スート記号(特にハート・スペードの曲線)が意図した形状で描画されていること、絵札(J/Q/K)の装飾フレームが崩れていないこと、ワイルドカードの星型と紫配色、裏面の菱形格子パターンがそれぞれ想定通り表示されていることを確認した。

確認の過程で以下2件の描画バグを発見し修正した。

1. **右下コーナーマークの座標ズレ**: `DrawStringRotated180`の呼び出し側で、非回転版のベースラインオフセット計算式(`textSize.Y * 0.8f`)を「回転後矩形の左上」算出に誤って混ぜてしまい、位置がずれていた。`anchor - textSize`で単純に矩形左上を算出する形に修正した。180度回転自体(`DrawSetTransform(pivot, Mathf.Pi, Vector2.One)`)は、L字型の非対称図形を使った検証用一時コードで正しく機能していることを確認済み(トランプの右下インデックス数字が天地逆に見えるのは伝統的なデザインとして正しい仕様であり、バグではない)。
2. **絵札(J/Q/K)中央の文字とスート記号の重なり**: フレーム高さ・文字サイズ・スート記号の配置オフセットのバランスが悪く、特にQueen of Diamondsで顕著に重なっていた。フレーム高さを0.52→0.56倍、文字サイズを34→28(基準スケール比)、スート記号のフレーム内オフセットを0.34→0.42倍に調整して解消した。
3. **`CardArtRenderer._Ready()`がプレビュー側の`CustomMinimumSize`指定を上書きする問題**: `_Ready()`で無条件に`CustomMinimumSize = (CardWidth, CardHeight)`を設定していたため、呼び出し側で先に拡大サイズを設定していても実行順序次第で上書きされていた。`CustomMinimumSize == Vector2.Zero`のときのみ既定値を設定するよう修正した。

---

## 背景・エフェクト素材

担当範囲: タイトル/プレイ/ショップ/結果(全クリア・ゲームオーバー)各画面の背景、およびフェーズ13(演出再設計)向けの「光る・散る・シェイク強調」エフェクト素材。画像生成AIは不使用、Godotのベクター描画(`Control._Draw()`)・`GradientTexture2D`・`canvas_item`シェーダーのみで構成する。

### 各画面の配色方針

全画面共通で「基調グラデーション(`GradientTexture2D`、上→下の線形)+占術モチーフのオーバーレイ(星座線・易経の卦・ルーン文字)」という2層構成。モチーフは護符(北欧ルーン)・天啓(二十八宿)・神託(六十四卦)・スプレッド(大アルカナ)というカテゴリ別モチーフを特定1つに絞らず、「星詠み」という世界観全体を横断的に薄く漂わせる目的で、星座(占星術全般)・卦(易経=神託)・ルーン(護符)の3意匠を横断配置している(二十八宿・大アルカナは他カテゴリのモチーフアイコン担当と守備範囲が重複するため背景では扱っていない)。

- **タイトル画面**: 最も装飾性を高くする。深い紺〜インディゴ→既存`TitlePhase.tscn`の背景色(`Color(0.023, 0.132, 0.101, 1)`)へ着地するグラデーション。金色(既存`SpreadNameLabel`の金色`(0.988, 0.827, 0.259)`と統一)の星座線46個+ルーン風グリフ6個+卦3個を高密度配置し、ゆっくり明滅させる(`Animate=true`)。
- **プレイ画面**: 場札・UIの視認性を最優先し、装飾密度を大きく落とす(星14個・ルーン2個・卦1個、アルファ値も低め)。既存背景色からほぼ動かさない極めて控えめな緑系グラデーションのみ。明滅アニメーションは`Animate=false`で止め、視線誘導を避ける。
- **ショップ画面**: タイトルとプレイの中間(星26個・ルーン4個・卦2個)。やや紫がかった配色(`(0.827, 0.694, 0.988)`系)で「商い」の雰囲気を出し、タイトルとは色相で区別できるようにした。
- **結果画面(全クリア)**: 祝祭的な明るい配色。暖色(琥珀〜金)のグラデーション+中心から放射状に伸びる16本の光条+満天の星(60個、金色系)+中心の光る円(祝福のコア)。
- **結果画面(ゲームオーバー)**: 落ち着いた/やや暗い配色。彩度を落とした藍〜灰のグラデーション、星は疎ら(12個)で動きも緩やか、中心に易経の坤(全陰、6爻すべて断線)を大きく薄く配置し「力尽きた」静けさを表現。

いずれも`Kind`(`BackgroundKind`列挙: `Title`/`Playing`/`Shop`/`ResultAllClear`/`ResultGameOver`)を切り替えるだけでプリセットが変わる設計。結果画面2種は配色ロジックが大きく異なるため`MysticBackground`とは別クラス(`ResultBackground`)に分離した。

### 実装ファイル

- `Game/Scripts/Backgrounds/BackgroundKind.cs`: 画面種別のenum。
- `Game/Scripts/Backgrounds/OccultMotifDrawer.cs`: 星座線・易経の卦(6爻、陽=実線/陰=断線)・ルーン風幾何グリフ(24バリエーション)を描く静的描画ヘルパー。ゲームロジックに非依存。
- `Game/Scripts/Backgrounds/MysticBackground.cs`: タイトル/プレイ/ショップ画面用の背景コンポーネント本体(`Control`)。`GradientTexture2D`を張った`TextureRect`(`gradientRect`)を子として持つ。
- `Game/Scripts/Backgrounds/MotifOverlay.cs`: `MysticBackground`の子として`gradientRect`の**後に**追加される、モチーフ描画専用の`Control`。分離理由は後述の「詰まった実装上の注意」を参照。
- `Game/Scripts/Backgrounds/ResultBackground.cs` / `ResultMotifOverlay.cs`: 結果画面(全クリア/ゲームオーバー)用。`MysticBackground`/`MotifOverlay`と同型の構成。`IsAllClear`で配色を切り替える。
- `Game/Scripts/Backgrounds/SparkleTextureGenerator.cs`: 十字型スパークル(光条+コア)をピクセル単位でラスタライズし`ImageTexture`として返す静的ヘルパー。`GradientTexture2D`だけでは表現できない「星型のきらめき」用。sizeごとに生成結果をキャッシュする。
- `Game/Scripts/Backgrounds/BackgroundEffectPreview.cs`: 検証用プレビューシーンのスクリプト(後述)。
- `Game/Scripts/Backgrounds/PreviewScreenshotRunner.cs`: プレビューシーンの各画面/エフェクトボタンを自動的に順番に押しながらスクリーンショットを連番保存し、最後にエンジンを終了する検証専用ランナー。カードデザイン担当の`CardArtPreviewScreenshotRunner.cs`と同じ「通常起動(ウィンドウあり)で`GetViewport().GetTexture().GetImage().SavePng()`する」パターンを踏襲。

### エフェクト素材(フェーズ13向け)

- **光る(Glow)**: `Game/Assets/Effects/Glow.gdshader`(`ShaderMaterial`化した既定値付きリソース: `GlowMaterial.tres`)。`glow_strength`(0〜1)をTween/AnimationPlayerでアニメーションさせると、中心から発光する。封印発動時・護符/秘儀/天啓/神託クリック時の`press-pulse`演出への組み込みを想定。
- **シェイク強調(WarningVignette)**: `Game/Assets/Effects/WarningVignette.gdshader`(`WarningVignetteMaterial.tres`)。`intensity`(0〜1)を0→1→0とアニメーションさせると画面端に赤いビネットが現れる。妨害(Sabotage)発動時の`seal-flash`演出(明滅側)と組み合わせ、シェイク(位置の揺れ)自体は呼び出し側でNodeの`position`を揺らして実装する想定(本エフェクトは「明滅」のみを担当)。
- **散る(Sparkle)**: `Game/Assets/Effects/SparkleBurst.tscn`(`GPUParticles2D`、`one_shot=true`、`ParticleStar.tres`をテクスチャに使用)。`Instantiate()`して対象位置に`GlobalPosition`を合わせ`Emitting=true`にするだけでワンショットのキラキラ演出が出る。`Game/Assets/Effects/ParticleDot.tres`(小粒の円形グロー)・`ParticleStar.tres`(4色ストップの光点グラデーション)は`GPUParticles2D.Texture`用の汎用テクスチャ。`SparkleTextureGenerator.GetSparkle()`(十字型スパークル、`ImageTexture`をコード生成)も同用途で使える代替。

**重要な注意(シェーダー利用時)**: `Glow.gdshader`/`WarningVignette.gdshader`はどちらも`base_color`という独自uniformで下地色を持たせている。`canvas_item`シェーダーで`fragment()`を独自定義すると、`ColorRect.color`プロパティの値は自動的には`COLOR`に反映されない(`fragment()`未定義時のみ有効なデフォルト挙動)ため、`ColorRect`に適用する場合は`base_color`をノードの`color`と同じ値に設定すること。また`GlowMaterial.tres`/`WarningVignetteMaterial.tres`は`ext_resource`経由で読み込むと同一インスタンスがプロジェクト内で共有されるため、複数ノードに同時適用してそれぞれ別パラメータでアニメーションさせたい場合は`(ShaderMaterial)material.Duplicate()`してから使うこと。

### 動作確認用プレビューシーン

- `Game/Scenes/_Preview/BackgroundEffectPreview.tscn`: 5画面(タイトル/プレイ/ショップ/全クリア/ゲームオーバー)をボタンで切り替え表示し、Glow/Shake/Sparkleエフェクトをその場で発火できる検証シーン。
- `Game/Scenes/_Preview/ScreenshotRunner.tscn`: 上記プレビューをインスタンス化し、全画面+全エフェクトボタンを自動的に順番に押しながら`Game/Scenes/_Preview/Screenshots/`配下に`title.png`/`playing.png`/`shop.png`/`result_allclear.png`/`result_gameover.png`/`effect_glow.png`/`effect_shake.png`/`effect_sparkle.png`を保存する。`godot_console --path . res://Scenes/_Preview/ScreenshotRunner.tscn`のように通常起動(ウィンドウあり)で実行する必要がある(`--headless`はGPUレンダリング結果を取得できない)。

### フェーズ13との連携方法

- 画面背景を実際のPhaseシーン(`TitlePhase.tscn`等)に組み込む際は、既存の`Background`(`ColorRect`)ノードを`MysticBackground`(または`ResultBackground`)に差し替えるか、`Background`ノードの直後に重ねて追加する形を想定。**本フェーズでは既存Phaseスクリプト・シーンへの組み込みは行っていない**(フェーズ13が並行してこれらのファイルを編集する可能性があるため、競合回避のスコープ外とした)。組み込みはフェーズ13または後続の統合フェーズで行うこと。
- エフェクト素材(Glow/WarningVignette/SparkleBurst)は演出のロジック(いつ発火するか)を一切持たない「見た目の部品」としてのみ提供している。フェーズ13の「共通化されたアニメーション完了シグナル待ちの仕組み」からTween経由でパラメータを操作する形で組み込むことを想定している。
- 妨害演出4種(`shidasu-seal-flash`/`shidasu-confiscate-fade`/`shidasu-press-pulse`/`shidasu-numeric-shake`)のうち、`WarningVignette`は`seal-flash`(明滅+シェイク)の明滅側、`Glow`は`press-pulse`(縮小→拡大→復帰+発光)の発光側にそのまま利用できる想定。`confiscate-fade`(光ってから落下フェードアウト)・`numeric-shake`+`popup`(数値変化ポップアップ)は本フェーズの守備範囲外(テキスト・座標アニメーションが主体のため、フェーズ13側のAnimationPlayer実装に委ねる)。

### 実装上の注意(詰まった箇所)

- **GodotのCanvasItem描画順**: `Control`が`_Draw()`で描いた内容は、そのノードの**子ノードより背面**に描画される(「親の`_Draw()`→子ノードの内容」の順)。当初`MysticBackground`自身に`_Draw()`でモチーフ描画を実装したところ、後から追加した不透明な`gradientRect`(`TextureRect`)の背面に完全に隠れ、星座線等が一切見えなくなるバグが実際に発生した。`_Draw()`が呼ばれていること自体はログで確認できたため、原因特定に時間を要した。対策として、モチーフ描画を`gradientRect`より**後に**追加する専用の子`Control`(`MotifOverlay`/`ResultMotifOverlay`)に分離し、確実に前面へ描画されるようにした。同様の「背景+オーバーレイ」構成を今後追加する場合は、オーバーレイ用の`_Draw()`は必ず下地ノードより後に追加した別ノードに実装すること。
- **`canvas_item`シェーダーとColorRectのcolor**: 前述の通り、`fragment()`を定義すると`ColorRect.color`は自動反映されない。`TEXTURE`は`ColorRect`では1x1の白テクスチャがデフォルトになるため、`texture(TEXTURE, UV)`の結果をそのまま下地として使うと常に白になる(発光強度0でも常に真っ白に見えるバグとして発生した)。`base_color` uniformで明示的に下地色を持たせることで解消した。

### 目視確認結果

`godot_console --path . res://Scenes/_Preview/ScreenshotRunner.tscn`(通常起動)でスクリーンショットを8枚取得し確認した。

- タイトル/ショップ画面: 星座線・易経の卦(横棒6段)・ルーン風グリフが金色/紫系でそれぞれ意図した密度・色で表示されていることを確認。
- プレイ画面: 装飾密度が大きく落ち、背景がほぼ既存の緑系単色に近い控えめな見た目になっていることを確認(視認性を妨げない)。
- 結果画面(全クリア): 中心からの暖色光条16本+満天の星+中心の光る円が表示され、祝祭的な印象になっていることを確認。
- 結果画面(ゲームオーバー): 藍〜灰の沈んだ配色+疎らな星+中心の坤(全陰の卦)が静かに表示されていることを確認。
- Glowエフェクト: ボタン押下でColorRect中心から金色の発光が広がることを確認。
- シェイク強調(WarningVignette)エフェクト: ボタン押下で画面端に赤いビネットが現れることを確認(位置シェイク自体もプレビュー側でTweenにより揺らし、あわせて目視確認)。
- Sparkleエフェクト: ボタン押下で画面中央に金色のパーティクルバーストが飛散し、時間経過で自動的に消えることを確認。

確認の過程で以下の問題を発見し修正した(詳細は上記「実装上の注意」参照)。

1. `MysticBackground`/`ResultBackground`自身の`_Draw()`で描いたモチーフが`gradientRect`の背面に隠れて非表示になっていた問題 → `MotifOverlay`/`ResultMotifOverlay`への分離で解消。
2. `Glow.gdshader`/`WarningVignette.gdshader`が`glow_strength`/`intensity`=0の初期状態で常に真っ白に表示されていた問題 → `base_color` uniformの追加で解消。

---

## カテゴリ別モチーフ

担当範囲: 護符/秘儀/天啓/神託/レリック/妨害/スプレッドの7カテゴリのアイコン・バッジのベクター描画実装、およびUI全体のビジュアルコンセプト(フォント・配色・Theme)。

### 実際のモチーフ対応の確認結果(想定との食い違いに関する重要な注記)

着手前の想定では「護符=北欧ルーンモチーフ」だったが、`catalog-talismans.md`(133件)を全件確認した結果、**護符に北欧要素は一切無く、和風・自然の縁起物/情景モチーフ**(四季の風・色彩・宝石・金運・天体・干支的表現)であることを確認した。一方、**秘儀(Rite)24種が実際にはエルダー・フサルク(北欧ルーン文字)全24種と1:1対応**しており(`shidasu.config.json`の`rites.*.name`がルーン文字そのもの、例: `raidho`→`ᚱ`)、こちらがルーンモチーフの正担当だった。この食い違いは元の指示文でも示唆されていた通りで、カタログ実データを正として以下の対応表を採用した。

| カテゴリ | コード上の単位 | 件数 | 実際のモチーフ | 対応関係 |
|---|---|---|---|---|
| 護符(Talisman) | `ItemId` | 133 | 和風・自然の縁起物/情景(風・宝石・金運・カード属性・コンボ・役・循環・護り) | 8基本図形グループ×3レア度の組み合わせ(1:1ではなくグループ化) |
| 秘儀(Rite) | `RiteId` | 24 | エルダー・フサルク(北欧ルーン文字) | 完全1:1(24種=24文字) |
| 天啓(Revelation) | `RevelationId` | 28 | 二十八宿(四象: 東方蒼龍/北方玄武/西方白虎/南方朱雀 各7宿) | 完全1:1(28種=28宿) |
| 神託(Oracle) | `RoleName`(10役) | 10 | 六十四卦(易経)から10卦を選定 | 10役への意匠割当(64卦全ては使わない) |
| レリック(Relic) | `RelicId` | 10 | 和風縁起物(招き猫・福だるま等、既に具体名で命名済み) | 完全1:1(10種=10意匠) |
| 妨害(Sabotage) | `SabotageActionId` | 32 | 障り・凶事(封印/没収/強制発動/山札操作等の9効果分類) | 9グループへの分類(1:1ではなくグループ化) |
| スプレッド(Spread) | `SpreadId` | 10 | 大アルカナ(タロット、既にタロット名で命名済み) | 完全1:1(10種=10カード) |

補足: 「神託」はカタログ上`Oracle`という専用ID型を持たず、`RoleName`(10役)いずれかのレベルを永続+1する消費アイテムという設計(`docs/shidasu/shidasu-glossary.md`参照)。そのためモチーフの割当単位は`RoleName`とした。

### 六十四卦→10役の割当根拠

各役の性質と卦の伝統的な意味づけを対応させた(64卦全件を機械的に割り振るのではなく、意味が通るものを厳選)。

| 役(RoleName) | 卦 | 選定理由 |
|---|---|---|
| Flush(フラッシュ) | 乾為天(全て陽) | 4スート制覇という最高位の完成形 |
| RoyalSet(ロイヤルセット) | 沢天夬 | 絵札3枚の格式高い成立=決断・勝ち抜け |
| SameRank(同ランク) | 地雷復(一陽来復) | 同じ数字が繰り返し出現する反復性 |
| CompleteRun(コンプリートラン) | 地天泰 | 天地交わり万物が満ちる=13ランク出揃う完成 |
| ColumnSweep(列一掃) | 山地剥 | 剥ぎ取る・削ぎ落とす=列を最後の1枚まで取り切る動作 |
| Suit(同スート) | 兌為沢 | 同質のものが連なる悦び |
| Color(同色) | 坤為地(全て陰) | 単色に染まる柔順・受容 |
| Stair(階段) | 水雷屯 | 陰陽が交互に積み重なり進み始める連続性 |
| Pair(ペア) | 火水未済 | 交わりが完成に至らず入れ替わり続く=組が更新され続ける様 |
| Alternating(交互) | 水火既済 | 陰陽が交互に整い完成する=赤黒交互 |

### 護符133種のグループ分け(効率的な意匠割当)

133種全てに完全ユニークな意匠を与えるのではなく、効果の性質(依存State・効果対象)から8つの基本図形グループに分類し、レア度(Common/Uncommon/Rare。旧`shidasu-gofu-candidates.md`のC/U/R区分を視覚バリエーションの根拠としてのみ流用、抽選確率とは無関係)で線幅・枠色を変えるバリエーション方式を採用した。

| グループ | 基本図形 | 対象効果の性質 | 件数 |
|---|---|---|---|
| Wind(風) | 渦巻き(2本の弧) | 四季の風・全消しボーナス等の環境効果的な性質 | 15 |
| Gem(宝石) | 六角形カット | スート/色専有ボーナス系 | 16 |
| Coin(金運) | 小判形の楕円 | sellBonus/currency加算系(方向性1・2) | 34 |
| Card(カード属性) | トランプの角形枠 | 特定ランク・絵札・ワイルド反応系 | 9 |
| Combo(コンボ) | 階段状の折れ線 | combo/baseComboCount操作系 | 19 |
| Chain(チェーン・役) | 連結する2つの輪 | 役ボーナス・パターン反応系 | 11 |
| Cycle(循環) | 円環(欠けた円) | 永続デッキ変換・ラン全体構造系 | 13 |
| Ward(護り) | 盾形 | 復活・封印緩和・特異な連動効果系 | 8 |

合計133件、過不足なく全ItemIdに割当済み(検証スクリプトで一致確認済み)。実装は`Game/Scripts/CategoryArt/TalismanMotif.cs`の`TalismanMotifs.Get(ItemId)`。

### 妨害32種のグループ分け

`catalog-sabotage.md`末尾の「効果分類まとめ」表をそのまま踏襲し、9グループに分類。護符・レリックが「福を招く」意匠であることと対比させ、「障り・凶事」トーンの意匠体系(鎖=封印、ひび割れ=没収、渦=強制発動、乱れた波線=山札/捨て札操作、崩れた格子=場札操作、ちぎれた鎖=チェーン操作、下向き矢印=コンボ操作、墨消しの斜線=通貨等への恒久マイナス、解けた結び目=付喪化解除)とした。

### 配色パレット

| 対象 | 色 | 用途 |
|---|---|---|
| 護符バッジ背景 | 生成り(和紙) RGB(0.96, 0.93, 0.86) | カテゴリ基調色 |
| 護符バッジ枠 | 朱 RGB(0.75, 0.20, 0.20) | カテゴリアクセント |
| 秘儀バッジ背景 | 濃紺(北欧の夜) RGB(0.16, 0.18, 0.30) | カテゴリ基調色 |
| 秘儀バッジ枠 | 氷青 RGB(0.65, 0.75, 0.95) | カテゴリアクセント |
| 天啓バッジ背景 | 星空紺 RGB(0.10, 0.12, 0.22) | カテゴリ基調色 |
| 天啓バッジ枠 | 星光 RGB(0.95, 0.85, 0.55) | カテゴリアクセント |
| 神託バッジ背景 | 象牙(易占の紙) RGB(0.93, 0.90, 0.80) | カテゴリ基調色 |
| 神託バッジ枠 | 焦茶(墨) RGB(0.35, 0.25, 0.15) | カテゴリアクセント |
| レリックバッジ背景 | 朱橙(縁起物) RGB(0.98, 0.90, 0.75) | カテゴリ基調色 |
| レリックバッジ枠 | 紅 RGB(0.80, 0.15, 0.15) | カテゴリアクセント |
| 妨害バッジ背景 | 墨黒 RGB(0.20, 0.16, 0.18) | カテゴリ基調色 |
| 妨害バッジ枠 | 血赤(警告) RGB(0.55, 0.15, 0.15) | カテゴリアクセント |
| スプレッドバッジ背景 | タロット紫 RGB(0.25, 0.10, 0.22) | カテゴリ基調色 |
| スプレッドバッジ枠 | 金 RGB(0.85, 0.70, 0.30) | カテゴリアクセント |
| レア度: Common | 墨鼠 RGB(0.55, 0.55, 0.58) | 護符の枠線・線幅1.5px |
| レア度: Uncommon | 縹(はなだ)色 RGB(0.30, 0.55, 0.75) | 護符の枠線・線幅2.0px |
| レア度: Rare | 金 RGB(0.85, 0.65, 0.20) | 護符の枠線・線幅2.5px |
| 四象: 東方蒼龍 | 青 RGB(0.25, 0.45, 0.80) | 天啓の星座線 |
| 四象: 北方玄武 | 黒 RGB(0.20, 0.20, 0.25) | 天啓の星座線 |
| 四象: 西方白虎 | 白銀 RGB(0.85, 0.85, 0.88) | 天啓の星座線 |
| 四象: 南方朱雀 | 朱 RGB(0.80, 0.25, 0.20) | 天啓の星座線 |

具体的な色定義は`Game/Scripts/CategoryArt/RarityStyle.cs`(`RarityStyle`静的クラス)に実装済み。

### フォント選定方針

- 日本語対応が必須のため、Godotの組み込みデフォルトフォントではなく明示的にフォントアセットを同梱する方針とした。
- 選定フォント: **Noto Sans JP(Variable Font版)**。SIL Open Font License 1.1でありゲームへの同梱・再配布が可能。可変フォント1ファイルで通常〜太字まで表現できるため、フォントウェイト違いを複数ファイルで持つ必要がない。
- 配置場所: `Game/Assets/Fonts/NotoSansJP-VF.ttf`(約9.5MB)。
- Theme経由での参照: `Game/Themes/ShidasuTheme.tres`が`FontVariation`経由でこのフォントを`default_font`として設定する。UI側は個別にフォントを指定せず、Themeのデフォルトフォントに任せることで全画面で統一されたフォントになる想定(既存の`CardFace.cs`等が个別に`Label`のフォントサイズだけ上書きしている箇所は、本フェーズでは変更していない)。
- 見出し等で異なるウェイトが必要な場合は、`FontVariation.VariationOpentypeOverride`または`Weight`調整で同一ファイルから太さ違いを作る想定(本フェーズでは基本ウェイトのみ実装、見出し用の太字バリエーションは未実装)。

### 実装ファイル

- `Game/Scripts/CategoryArt/MotifCategory.cs`: カテゴリ(7種)・護符レア度(3種)のenum定義。
- `Game/Scripts/CategoryArt/RuneMotif.cs`: 秘儀24種=エルダー・フサルクの字形データ(単位正方形内の折れ線ストローク)。
- `Game/Scripts/CategoryArt/LunarMansionMotif.cs`: 天啓28種=二十八宿の星座データ(星点+接続線、四象分類)。
- `Game/Scripts/CategoryArt/HexagramMotif.cs`: 神託(10役)=六十四卦から選定した10卦の爻データ(陽爻/陰爻)。
- `Game/Scripts/CategoryArt/TarotMotif.cs`: スプレッド10種=大アルカナのシンボル図形データ。
- `Game/Scripts/CategoryArt/TalismanMotif.cs`: 護符133種→8基本図形グループ×レア度の割当表(`TalismanMotifs.Get(ItemId)`)。
- `Game/Scripts/CategoryArt/RelicMotif.cs`: レリック10種の意匠データ。
- `Game/Scripts/CategoryArt/SabotageMotif.cs`: 妨害32種→9グループの分類データ。
- `Game/Scripts/CategoryArt/RarityStyle.cs`: レア度・カテゴリ・四象・妨害グループ・護符グループの配色パレット定義。
- `Game/Scripts/CategoryArt/CategoryArtIcon.cs`: 上記モチーフデータを受け取り`_Draw()`でベクター描画する共通Controlコンポーネント本体。`SetupTalisman(ItemId)`等のカテゴリ別Setupメソッドで表示内容を切り替える。
- `Game/Scripts/CategoryArt/CategoryArtPreview.cs` / `Game/Scenes/_Preview/CategoryArtPreview.tscn`: 動作確認用プレビューシーン。7カテゴリの代表アイコンを縦に並べて一覧表示する(護符・妨害は代表例抜粋、他は全件)。
- `Game/Themes/ShidasuTheme.tres`: 日本語フォント(Noto Sans JP)を`default_font`に設定した共通Themeリソース。
- `Game/Assets/Fonts/NotoSansJP-VF.ttf`: 同梱フォント本体(SIL OFL 1.1)。

いずれも新規ファイルのみで、既存のゲームプレイ用スクリプト(`Game/Scripts/Phases/*.cs`等)は一切編集していない(フェーズ13との競合回避)。

### 目視確認結果

`godot_console`で`Game/Scenes/_Preview/CategoryArtPreview.tscn`を実行し、スクロール位置をずらしながら複数枚のスクリーンショットを撮影して確認した(ディスプレイの実解像度でウィンドウ高がクランプされ1枚に収まらなかったため分割撮影する方式にした)。

- 護符: 8グループ×レア度の配色・線幅の違いが視認できる(Common=墨鼠の細線、Rare=金の太線)。
- 秘儀: エルダー・フサルク24種それぞれが判別可能な線画で表示され、Unicode文字表記(ᚱ等)とも対応が一致することを確認。
- 天啓: 二十八宿の星座パターンが四象(青=東方蒼龍、白銀=西方白虎、朱=南方朱雀等)で色分けされ、宿ごとに星点配置が異なることを確認。
- 神託: 六十四卦の陽爻(実線)・陰爻(中央で分断した線)が10卦それぞれ正しく描き分けられていることを確認。
- レリック: 招き猫・福だるま・熊手等、簡略化しつつも判別可能なシルエットで表示されることを確認。
- 妨害: 9グループの分類意匠(鎖・ひび割れ・渦・波線等)が視認でき、護符・レリックとはトーンが異なる(墨色・警告色主体の)配色になっていることを確認。
- スプレッド: 大アルカナ10種のシンボル(愚者=円、月=三日月、教皇=円+四角、運命の輪=車輪等)が判別可能な図形で表示されることを確認。

`dotnet build ShidasuGodot.slnx`は0警告0エラーで成功。
