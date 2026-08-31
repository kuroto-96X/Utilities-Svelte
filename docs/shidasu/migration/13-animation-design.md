# フェーズ13(第1弾): アニメーション共通パターン設計

対象: Godot版(`Shidasu-Godot/Game/`)のアニメーション・演出基盤。本ドキュメントは
フェーズ13の中でも「個々の演出を実装する前に、まず共通パターンを設計する」という
最重要事項に対応する第1弾の成果物であり、後続の別エージェントがカード裏返し・
妨害演出4種を実装する際にそのまま従うべき規約を定める。

関連資料:
- `docs/shidasu/migration/reference/playarea-tech-debt.md`(Web版の技術的負債16箇所の棚卸し)
- `docs/shidasu/migration/prompts/phase13-animation-redesign.md`(フェーズ13全体の指示書)
- `Shidasu-Godot/docs/adr/0003-logic-ui-separation.md`(ロジック/UI分離方針・シグナル設計方針)

実装済みファイル(共通パターン本体、`Shidasu-Godot/Game/Scripts/Animation/`):
- `AnimationActivityTracker.cs`
- `DisplaySync.cs`
- `CardMotionController.cs`

適用例(`Shidasu-Godot/Game/Scripts/Phases/PlayingPhase.cs`): チェーンリセット演出
(`DetectAndStartChainResetAnimation`/`StartChainResetAnimation`)。

---

## 1. Web版の問題点(なぜ個別対策の積み重ねだったか)

`playarea-tech-debt.md`に詳細があるが、要点は以下の通り。

Shidasuのゲームロジック(`wave: WaveState`)は、カードプレイ・妨害行動・秘儀/天啓の
使用結果を**同期的に即座に**データへ反映する。一方、その変化を画面上で「移動する」
「消える」ように見せる演出は数百msの非同期処理になる。この「実データの更新」と
「画面に反映してよいタイミング」の時間差を埋めるため、Web版(`PlayArea.svelte`)は
演出のたびに個別に次の2点セットを手書きしていた。

1. **表示専用の`$state`スナップショット変数**(例: `displayedScore`・`displayedDiscardTop`)
2. **ガードフラグ**(例: `chainAreaHiddenForRedistribute`・`discardPurgeActive`)。
   常設UI側の描画条件や、実データへの追従処理(`$effect`)に割り込んで一時停止させる。

この積み重ねの結果、以下の技術的負債が生じていた(`playarea-tech-debt.md`に列挙された
16箇所より抜粋)。

- **`anyAnimationActive`という15項目のOR式**を、新しい演出を追加するたびに手動で
  書き足す必要があった(実装漏れのリスク)。
- **同じ「関数先頭で同期的にフラグを立てる」実装イディオムが、(A)表示の先出し防止と
  (B)操作の二重発火防止という異なる目的に流用されており**、区別しにくい
  (`stockShuffleActive`は前者目的なのに`anyAnimationActive`に算入、
  `chainShuffleActive`は同じ目的なのに算入されていない、という非対称性がコメントを
  読まないと分からない)。
- **完了時同期処理がバラバラの箇所に分散**しており(`finishScoreReveal`内・
  `startDiscardFlipReveal`内・`startStockPurgeAnimation`内…)、新しい演出を書く担当者が
  同期漏れを起こしやすい。

Godot版でこの構造をそのまま量産しないために、以下の共通パターンを設計した。

## 2. 共通パターンの設計

### 柱(a): アニメーション実行中フラグの管理を1箇所に集約する → `AnimationActivityTracker`

`Game/Scripts/Animation/AnimationActivityTracker.cs`。

Web版`anyAnimationActive`(手書きOR式)の後継。個々の演出は「開始時に一意な
トークン文字列を`Begin(token)`で登録」「完了時に`End(token)`で解除」するだけでよく、
この式自体を演出追加のたびにメンテナンスする必要がない。

```csharp
public sealed class AnimationActivityTracker
{
    public bool IsActive => activeTokens.Count > 0;
    public void Begin(string token);
    public void End(string token);
    public bool Contains(string token);
    public void Clear(); // Wave境界のリセット等に使う
}
```

- `IsActive`を操作の二重発火防止(入力ブロック)に使う。`PlayingPhase`では
  `HandlePlayCardPressed`/`HandleDrawStockPressed`/`RedrawStock`(山札ボタンの
  Disabled判定)で参照している。
- Web版で混同されていた「(A)表示の先出し防止目的」と「(B)二重操作防止目的」は、
  本クラスでは区別しない(単純な多重集合カウンタ)。目的別に分離が必要になった場合は、
  呼び出し側でトークンにプレフィックスを付けるか、目的ごとに別インスタンスを持つこと。
  現時点(カード移動演出のみ)ではこの区別は不要と判断し、シンプルさを優先した。

### 柱(b): アニメーション完了時に表示を実データに同期する処理を1箇所に集約する → `DisplaySync<T>`

`Game/Scripts/Animation/DisplaySync.cs`。

Web版`displayedScore`・`displayedDiscardTop`等、16箇所すべてに共通する構造
(表示専用スナップショット+ガードフラグ+完了時同期)を、ジェネリック型引数`T`で
一般化したクラス。

```csharp
public sealed class DisplaySync<T>
{
    public T Displayed { get; }       // 常設UIが参照すべき値
    public bool IsAnimating { get; }  // 演出実行中かどうか(ガードフラグ相当)

    public void BeginAnimation();          // 演出開始の宣言(実データ更新と同じ同期パスの中で呼ぶ)
    public void Complete(T latestValue);   // 演出完了時に表示を最新実データへ同期する
    public void SyncIfIdle(T latestValue); // 演出非実行中に限り実データへ追従(Wave境界リセット等)
    public void ForceSet(T value);         // 初期化・テスト用
}
```

対応関係:

| Web版 | Godot版 |
|---|---|
| `displayedScore` / `displayedDiscardTop` | `DisplaySync<T>.Displayed` |
| `chainAreaHiddenForRedistribute` / `discardPurgeActive` | `DisplaySync<T>.IsAnimating` |
| 各`startXxxAnimation`関数の先頭で同期的に`xxxActive = true` | `DisplaySync<T>.BeginAnimation()` |
| `finishScoreReveal`等での`displayedXxx = wave.xxx`明示代入 | `DisplaySync<T>.Complete(latestValue)` |
| waveKey変化時`$effect`での`displayedXxx = wave.xxx`リセット | `DisplaySync<T>.Complete(...)`(Wave境界時、`PlayingPhase.Refresh`内で呼ぶ) |

**`BeginAnimation()`は必ず、実データを更新する処理と同じ同期的なコードパスの中、
非同期処理(Tween開始やコールバック登録)より前に呼ぶこと。** これがWeb版の
`discardPurgeActive`が踏んだ罠(「実データは更新済みだが表示同期の宣言がまだ」という
一瞬の隙間)を作らないための最重要規約である。`PlayingPhase.AfterAction`では、
`ScoringPipeline.PlayCard`/`DrawStock`の呼び出し・`run`フィールドへの再代入が終わった
直後、`RedrawAll()`を呼ぶより**前**に演出検知・起動処理(`DetectAndStartChainResetAnimation`)
を行っている。この順序を変えないこと。

### 柱(c): 新しい演出を追加する際に再利用できる汎用性 → `CardMotionController`

`Game/Scripts/Animation/CardMotionController.cs`。

Web版`runGatherAndMoveAnimation`(276〜340行目)のGodot版。「複数枚のカードを
1点にまとめてから(gather)、移動先へ移動させる(move)」という2フェーズ構成を
Tweenで再現する。

```csharp
public sealed partial class CardMotionController : Node
{
    public void PlayGatherAndMove(
        IReadOnlyList<CardMotionItem> items,
        Vector2 gatherPoint,
        Func<Vector2> moveTarget,
        CardMotionOptions options,
        Action? onGatherComplete = null,
        Action? onComplete = null);

    public static Vector2 CenterOf(Control node); // ノード中心座標のヘルパー
}
```

- `items`が1件のみの場合はgatherフェーズを省略し直接moveへ進む(Web版と同じ仕様:
  1枚だけをまとめても視覚的な意味がないため)。
- 複数枚は`Tween.SetParallel(true)`で同時に補間し、gatherの`Tween.Finished`シグナルを
  受けてmoveフェーズを開始する(コールバックチェーン)。
- **Web版の2重`requestAnimationFrame`ハックは一切不要**。これはbrowserの
  スタイル変更バッチ処理を回避するためのWeb特有の対策であり、Godotの`Tween`は
  ノードのプロパティ(`global_position`)を直接補間するため、そもそも該当する問題が
  存在しない。
- **Web版の「move開始後もgatherCards配列を空にせず代表カード1件を残す」という
  配列操作トリックも不要**。Godotでは実際のノード参照(`Control`)をそのまま
  Tweenに渡し続けるため、DOM再マウント相当の問題(Godotでは起こらない)を
  回避する目的の細工が要らない。
- 本クラス自体は「今アニメーション中かどうか」の判定も「表示専用スナップショット」の
  管理も一切行わない、**単なるTween実行ヘルパー**である。それらは呼び出し側が
  `AnimationActivityTracker`/`DisplaySync<T>`を使って行う(責務の分離)。

## 3. 3点セットの組み合わせ方(新しい演出を追加する際の実装手順)

新しい演出(カード裏返し・妨害4種)を追加する担当者は、以下の手順を踏襲すること。
`PlayingPhase.StartChainResetAnimation`が実装例である。

1. **検知**: `Shidasu.Core`はGodotのSignal機構に依存できない(ADR0003)ため、UI層
   (`PlayingPhase`等)が「ロジック層の呼び出し前後の状態を比較する」か「戻り値に
   載っている確定情報を見る」ことでイベント発生を検知する。既存の実装パターンは
   ADR0003・`PlayingPhase.cs`冒頭コメントに集約されている。
   - 妨害発動: `wave.LastSabotageInfo.Seq`の増加
   - コンボリセット: `wave.Combo`が正の値から0への変化
   - チェーンリセット: 呼び出し前後の`wave.Chain`比較(単純延長かどうかの先頭一致判定。
     `DetectAndStartChainResetAnimation`参照)
   - 役成立: `PlayCardResult`/`DrawStockResult.RoleFired`(戻り値の確定情報)
2. **開始(同期的に)**: 検知した直後、他の処理(`RedrawAll()`呼び出し等)より前に
   以下を同期的に呼ぶ。
   - `activityTracker.Begin(token)` (`token`は演出種別ごとに一意な文字列。多重起動を
     許したい場合は`$"{kind}:{Guid.NewGuid()}"`のように動的トークンにする)
   - 関与する`DisplaySync<T>`インスタンスすべての`BeginAnimation()`
3. **演出実行**: `CardMotionController.PlayGatherAndMove`(カード移動の場合)、または
   `Tween`/`AnimationPlayer`を直接使う(裏返し・妨害演出の場合。本ドキュメント末尾の
   「4. 後続演出への引き継ぎ」参照)。演出対象のノードは、常設UI(実データ描画用の
   コンテナ)から実ノードを取り回すのではなく、**演出専用の一時ノードを
   オーバーレイ層(`AnimationOverlay`)に生成して動かす**こと(理由は後述)。
4. **完了時(コールバック内)**:
   - 一時ノードを`QueueFree()`
   - 関与する`DisplaySync<T>`すべての`Complete(latestValue)`(`latestValue`は
     このタイミングでの最新実データ)
   - `activityTracker.End(token)`
   - `RedrawAll()`(常設UIを`DisplaySync.Displayed`経由で再描画。既にComplete済みなので
     最新の内容が表示される)

### なぜ「演出専用の一時ノード」を使うのか(実ノードを直接動かさない理由)

`PlayingPhase`の`RedrawTableau`/`RedrawChain`/`RedrawDiscard`は、呼ばれるたびに
子ノードを全部`QueueFree()`して作り直す設計になっている(Godot版UI層の既存の
描画方式、フェーズ12から踏襲)。この「毎回作り直す」設計と、「演出中のノードを
数百ms保持し続けて動かす」という要求は相性が悪い。実ノードをそのまま
`Reparent`して動かそうとすると、演出の途中で`RedrawAll()`が呼ばれた場合に
対象ノードが消えてしまうリスクがある。

そのため、演出開始時点で画面に見えているカードの座標・見た目(`Card`データ)だけを
コピーした**一時的なCardFace**を`AnimationOverlay`層に生成し、それをTweenで動かす。
これはWeb版が実際のDOM要素そのものではなく、`gatherCards`という座標付きの
カード情報の配列を演出専用のオーバーレイとして描画していたのと同じ考え方であり、
Web版から素直に引き継げる設計判断である。

`AnimationOverlay`は`PlayingPhase.tscn`のルート直下(`ScrollContainer`の兄弟)に
配置した全画面`Control`で、`mouse_filter = 2`(Ignore)によりクリックを透過する。
`Playing`ノードの最後の子として配置されているため、描画順で最前面に来る
(妨害演出等、他の演出を追加する場合もこのノードを再利用すること)。

## 4. 適用例: チェーンリセット演出の実装内容

`PlayingPhase.cs`に実装した最初の適用例。Web版`chainResetAnimation`
(`startChainResetAnimation`、1074〜1122行目付近)に相当する。

- **検知**: `DetectAndStartChainResetAnimation`。`AfterAction`内、`PlayCard`/`DrawStock`
  呼び出し・妨害ディスパッチ・Wave終了処理が終わった直後、`RedrawAll()`を呼ぶ前に
  実行する。直前のフレームで表示していたチェーン内容
  (`previousChainCardsForResetDetection`)と現在の`waveAfter.Chain`を比較し、
  「単純な延長ではない」変化(先頭からの並びが一致しない)を検知したら
  `resetCards`(消えたカード一覧)を算出する。Web版の`isExtension`判定ロジックを
  そのまま踏襲している。
- **表示専用スナップショット**: `discardTopDisplay`(`DisplaySync<Card?>`、Web版
  `displayedDiscardTop`相当)・`chainDisplay`(`DisplaySync<IReadOnlyList<Card>>`、
  Web版にはなかったがチェーン欄自体にも同じ問題が起こりうるため新設)。
  `RedrawDiscard`/`RedrawChain`はこれらの`Displayed`のみを参照し、
  `wave.DiscardPile`/`wave.Chain`を直接参照しない。
- **演出**: `StartChainResetAnimation`。`resetCards`に対応する現在画面上の
  CardFaceノード(`chainCardFaceById`、直近の`RedrawChain`で記録)から座標を取得し、
  一時CardFaceを`AnimationOverlay`に生成。`CardMotionController.PlayGatherAndMove`で
  チェーン置き場中心(gather)→捨て札置き場中心(move)の順に移動させる。
- **完了**: 一時ノードを破棄し、`chainDisplay.Complete(chainAfter)`・
  `discardTopDisplay.Complete(run.Wave?.DiscardPile.LastOrDefault())`・
  `activityTracker.End("chainReset")`の後`RedrawAll()`。

### 目視確認(godot_console、ヘッドレスログベース)で検証した内容

一時的な自動プレイスクリプト(`--headless`実行、Godotエディタで確認後に削除済み)で
タイトル→スタート→山札/場札を自動連打させ、以下をログで直接検証した(確認後、
検証専用ログ・スクリプトは削除済み)。

- `BeginAnimation()`直後(mid-flight時点)、`discardTopDisplay.Displayed`は
  演出開始前の値のまま固定されている一方、同時刻の`run.Wave.DiscardPile`
  (実データ)は既に演出後の内容に更新済みであることを確認した
  (先出しが起きていないことの直接証拠)。
- gather対象1枚(gatherフェーズ省略)・2枚・3枚・5枚・6枚の各ケースがいずれも
  発生し、`Complete()`呼び出し後に`discardTopDisplay.Displayed`/
  `chainDisplay.Displayed`が正しく最新実データへ切り替わることを確認した。
- 演出完了後`activityTracker.IsActive`が`False`に戻り、次の操作(山札めくり・
  場札プレイ)が正常にブロック解除されることを確認した。
- 役成立シグナル・コンボリセットシグナル・Wave終了によるショップ遷移と共存しても
  問題が起きないことを確認した。

## 5. 後続演出(カード裏返し・妨害4種)を実装する際の規約

後続の別エージェントは、以下を踏襲すること。

### 5.1 踏襲すべき3点セットの構造(再掲)

新しい演出を追加するたびに、**必ず**次の3つを組み合わせること。単独の`Tween`を
直接演出対象の常設ノードに仕込む(=Web版のような場当たり的な個別対策)のは禁止。

1. `activityTracker.Begin(token)` / `End(token)` — 演出実行中フラグ
2. 演出対象データごとの`DisplaySync<T>`インスタンス — 表示専用スナップショット
3. `Tween`/`AnimationPlayer` (+ カード移動の場合は`CardMotionController`) — 実際の補間

### 5.2 検知のタイミング・シグナル名の規約

`PlayingPhase`のシグナル(フェーズ12で定義済み、`Shidasu-Godot/Game/Scripts/Phases/PlayingPhase.cs`
36〜59行目)をトリガーに使う。各シグナルの発火箇所は`AfterAction`内であり、
**必ず`RedrawAll()`より前**に対応する演出の検知・起動処理を呼ぶこと
(チェーンリセットの`DetectAndStartChainResetAnimation`と同じ位置)。

| シグナル | 発火条件(UI層での検知方法) | 想定する演出 |
|---|---|---|
| `SabotageTriggered(sabotageId, seq)` | `wave.LastSabotageInfo.Seq`の増加 | 妨害演出4種(下記5.3) |
| `ComboReset(previousCombo)` | `wave.Combo`が正の値から0に変化 | (フェーズ13第1弾の対象外。将来必要になれば同じ3点セットで追加) |
| `RoleEstablished(roleName, amount, usedWild)` | `PlayCardResult`/`DrawStockResult.RoleFired`(戻り値) | (同上、対象外) |
| `StockShuffled(seq)` | `wave.LastStockShuffle.Seq`の増加 | 山札シャッフル演出(Web版`stockShuffleActive`相当。対象外) |
| (シグナル化していない検知) | `waveBefore.Chain`と`waveAfter.Chain`の比較 | チェーンリセット演出(実装済み、`DetectAndStartChainResetAnimation`参照) |

妨害演出4種は`SabotageTriggered`シグナルの`sabotageId`文字列(`SabotageActionId`の
`ToString()`)で分岐すること。Web版の分岐(`PlayArea.svelte`670〜709行目)対応表:

| `sabotageId` | Web版の演出 | 実装すべきAnimationPlayer/Tween |
|---|---|---|
| `talismanSeal`/`riteSeal`/`revelationOracleSeal`/`roleSeal`/`comboCap` | `shidasu-seal-flash` | 封印系: 明滅+シェイク |
| `talismanConfiscate`/`riteConfiscate`/`revelationOracleConfiscate`/`relicConfiscate` | `shidasu-confiscate-fade` | 没収系: 光ってから落下フェードアウト |
| `riteForceActivate`/`revelationOracleForceActivate` | `shidasu-press-pulse` | 強制発動系: 縮小→拡大→復帰+発光 |
| `comboBreather`/`comboReduce`/`currencyConfiscate`/`currencyDrain`/`roleLevelDecay`/`roleBias`/`tsukumokaRelease` | `shidasu-numeric-shake`+`shidasu-numeric-popup` | 数値変化系: シェイク+赤文字ポップアップ |

これらは対象UI要素(護符バッジ・秘儀/天啓ボタン・数値ラベル等)が「演出中に
実データから既に消えている/変化している」というWeb版9〜11番の負債パターンに
該当する。対象は`DisplaySync<T>`の`T`を対象データの型(例: `HeldItem?`、
`RoleName?`)にして保持し、`BeginAnimation()`時点のスナップショットを表示に使う設計
にすること(Web版の`confiscateFadingTarget`/`pressPulseTarget`/`numericPopupTarget`
相当)。

### 5.3 カード裏返し演出の実装方針

Web版`startFlipReveal`/`startDiscardFlipReveal`(3D風トランプ返し)は、Godotでは
`Tween`で`scale.x`を`1→0→1`と補間し、`scale.x`が0付近(不可視)になったタイミングで
`CardFace.Refresh(card, faceUp)`を呼んで中身を差し替える、という定石パターンで
置き換える。`Tween.TweenMethod`または`TweenCallback`を`0`到達タイミングに挟むことで、
`FLIP_HALF_MS`相当の「半分経過したら中身を差し替える」処理を実現できる。表示対象は
`DisplaySync<bool>`(faceUpの表示専用スナップショット)を使い、裏返り完了まで
実データの`Card.FaceUp`を先出ししないこと。

### 5.4 妨害演出4種の実装方針

すべて`AnimationPlayer`のアニメーションリソースとして実装すること(`Tween`でも
可だが、キーフレーム構成が固定されているためAnimationPlayerの方が素直、という
`phase13-animation-redesign.md`の指示を踏襲)。CSSの`animation-fill-mode: forwards`
相当(`shidasu-confiscate-fade`)は、AnimationPlayerのトラック終端値をそのまま
維持するか、アニメーション完了コールバックでノード状態(`Visible = false`等)を
明示的に確定させること。

いずれも完了シグナル(`AnimationPlayer.AnimationFinished`または`Tween.Finished`)を
使い、Web版のように「JS側のsetTimeout尺とCSS側のkeyframes尺を手打ちで一致させる」
(`playarea-tech-debt.md`末尾に指摘された脆弱ポイント)方式は取らないこと。
尺は1箇所(AnimationPlayerのリソースまたはTweenの`duration`引数)でのみ管理する。

## 6. 既知の制約・今後の検討事項

- `AnimationActivityTracker`は「表示の先出し防止」目的と「二重操作防止」目的を
  区別しない設計にした(2.柱(a)参照)。妨害演出4種の中には後者の目的を
  持たないもの(Web版で`anyAnimationActive`に含まれていない`talismanShuffleFlashActive`
  等)もあるため、そのような演出は`activityTracker.Begin`を呼ばず`DisplaySync`のみ
  使う、という判断も許容する(Web版の非対称性を機械的に踏襲する必要はないが、
  「なぜこの演出は操作をブロックしないのか」を実装コメントに明記すること)。
- `chainDisplay`/`discardTopDisplay`はWave境界(`PlayingPhase.Refresh`内の
  `isNewWave`判定)で`Complete()`によりリセットされる。今後追加する`DisplaySync<T>`も
  同様にWave境界でのリセットが必要かどうかを個別に検討すること(全てが必要とは
  限らない。例えば護符所持リストのような「Wave境界をまたいでも継続するデータ」は
  対象外)。

## 7. 第2弾: カード裏返し・妨害演出4種の実装内容

フェーズ13第2弾として、5節の規約に従いカード裏返し演出と妨害演出4種を実装した。
実装ファイル: `Game/Scripts/CardFace.cs`(裏返しTweenヘルパー追加)、
`Game/Scripts/Animation/SabotageEffectController.cs`(妨害演出4種、新規)、
`Game/Scripts/Phases/PlayingPhase.cs`(検知・統合)、`Game/Scripts/RoleStatusPanel.cs`
(役の行を外部から取得する`GetRoleRow`アクセサを追加)。

### 7.1 カード裏返し演出

`CardFace.PlayFlipReveal(Action onHalfway)`が`scale.x: 1→0→1`のTweenを組み立て、
半分経過時点(`scale.x=0`付近)で`onHalfway`コールバック(通常は`CardFace.Refresh`の
再呼び出し)を実行して中身を差し替える。尺は`CardFace.FlipHalfDurationSeconds`の
1箇所でのみ管理する。

**検知**: `PlayingPhase.DetectAndStartFlipRevealAnimation`。`AfterAction`内、
`RedrawAll()`より前に、前回スナップショット(`lastKnownTableauFaceUpById`/
`lastKnownDiscardTopFaceUp`)と現在の`wave.Tableau`/`wave.DiscardPile`を比較し、
「裏→表」に変わったカードを検知する。`Card.FaceUp`フィールド自体は一度`false`に
なったカードが再び`true`に戻ることはなく(不変のマーカー)、「表示上表向きかどうか」
は常に`card.FaceUp != false || isTop`で導出される値であるため、この導出値の変化を
見る必要がある(単純に`Card.FaceUp`だけを比較しても検知できない)。

**表示専用スナップショット**: `flippingCardIds`(`DisplaySync<IReadOnlySet<int>>`)。
演出中カードのId集合を保持し、`RedrawTableau`/`RedrawDiscard`はこの集合に含まれる
カードを実データの値に関わらず強制的に裏向き表示する(先出し防止)。`flippingCardIds`は
「実データそのもの」ではなくUI層が独自に算出する一時状態のため、`BeginAnimation()`の
前に`ForceSet(flippingSet)`で表示すべき値を確定させてから`BeginAnimation()`を呼ぶ、
という順序を取る(通常の`DisplaySync<T>`利用パターンである「実データの値をそのまま
表示専用スナップショットにする」ケースとは異なる派生的な使い方)。

**演出対象ノードの設計変更(実装中に発覚した問題と対応)**: 当初は「対象カードの実ノード
(`RedrawTableau`/`RedrawDiscard`が生成した`CardFace`)に直接`PlayFlipReveal`を仕込み、
次のRedrawAllまでは実ノードがQueueFreeされないためオーバーレイ不要」という設計を
試みたが、`AfterAction`終盤で必ず呼ばれる`RedrawAll()`が`RedrawTableau`内で対象ノードを
含む全カードノードを無条件に`QueueFree()`してしまうため、Tweenの対象ノードが
アニメーション実行中に消え、`Tween.Finished`が発火しない(演出が永久に完了しない)
不具合が生じた。godot_consoleでのヘッドレス検証で`Tween.StepFinished`/`Finished`が
一切発火しないことを確認して発覚した。そのため、チェーンリセット演出
(`StartChainResetAnimation`)と同じ「演出専用の一時ノードを`AnimationOverlay`に生成して
動かす」設計(3節)に統一した。`StartFlipRevealAnimation`は、`RedrawAll()`が呼ばれる前
(対象カードの実ノードがまだ演出前の見た目=裏向きのまま残っている時点)に一時`CardFace`を
複製してから`RedrawAll()`を呼び、複製した一時ノードに対して`PlayFlipReveal`を実行する。
完了時に一時ノードを`QueueFree()`し、`flippingCardIds.Complete()`+`activityTracker.End`+
`RedrawAll()`で実データの最新表示に切り替える。

### 7.2 妨害演出4種

`SabotageEffectController`(`Game/Scripts/Animation/SabotageEffectController.cs`)が
`Tween`ベースで4種の演出メソッド(`PlaySealFlash`/`PlayConfiscateFade`/`PlayPressPulse`/
`PlayNumericShakeAndPopup`)を提供する。設計ドキュメント5.4節は「AnimationPlayerが素直」
としつつ「Tweenでも可」としており、既存コード全体(`CardMotionController`含む)が
Tweenベースで統一されているため一貫性を優先しTweenを採用した。尺は
`SabotageEffectDurations`の定数群で1箇所管理する。

**検知・分岐**: `PlayingPhase.HandleSabotageTriggered`が`SabotageTriggered`シグナルを
購読し、`sabotageId`(`SabotageActionId.ToString()`、PascalCase)を5.2節の対応表通りに
4分岐する。Godotのシグナルは同期発火するため、本ハンドラは`AfterAction`内の
`EmitSignal(SignalName.SabotageTriggered, ...)`呼び出し時点、`RedrawAll()`より前に
実行される(検知タイミングの規約を満たす)。`LastSabotage`が既に`ConfiscatedTarget`/
`ForceActivatedTarget`/`NumericChangeTarget`という確定情報の判別共用体を持つため、
これをそのまま`DisplaySync<T>`の`T`として使い、対象が`null`(没収・強制発動の候補が
0件で空振りした場合)なら演出自体をスキップする(Web版の対応コードも同条件でガードしている)。

**対象ノードの解決とフォールバック**: 設計ドキュメントが指す「対象UI要素」(護符バッジ・
秘儀/天啓ボタン・レリックバッジ等)は本フェーズ時点の`PlayingPhase`にまだ実装されていない
(フェーズ12/14時点で未着手)。そのため、実在するノードが解決できる場合はそこに
(`RoleStatusPanel.GetRoleRow`で取得できる役の行、`comboLabel`/`scoreLabel`等)、
解決できない場合は`AnimationOverlay`中央に一時的なフォールバックノード
(`CreateFallbackTarget`/`CreateFallbackLabel`、テキストで対象を示す)を生成して演出する。
将来、護符バッジ等の常設UIが追加された場合は、この対象解決処理(`ResolveSealFlashTarget`
等)だけを差し替えれば済む設計にしている。

**操作ブロック方針(Web版`anyAnimationActive`との対応関係の精査)**: 実装中、Web版
`PlayArea.svelte`615行目の`anyAnimationActive`の実際の構成要素を確認したところ、
封印系(`sealFlashActive`)・没収系(`confiscateFadingActive`)は含まれるが、強制発動系
(`pressPulseActive`)・数値変化系(`numericPopupActive`)は含まれていないことが判明した。
これは6節が言う「非対称パターン」に該当するため、本実装もこれに合わせた
(`StartSealFlashAnimation`/`StartConfiscateFadeAnimation`は`activityTracker.Begin/End`を
呼びブロック対象、`StartPressPulseAnimation`/`StartNumericPopupAnimation`は呼ばずブロック
対象外)。当初は全4種を機械的に`activityTracker`へ登録していたが、Web版の実際の挙動を
確認して修正した。

**エフェクト素材の再利用**: フェーズ14で作成済みの`Game/Assets/Effects/`配下の
シェーダーを再利用した。封印系(`StartSealFlashAnimation`)は`WarningVignetteMaterial.tres`
(`intensity`パラメータ)、強制発動系(`StartPressPulseAnimation`)は`GlowMaterial.tres`
(`glow_strength`パラメータ)をそれぞれ`Duplicate()`(パラメータ競合防止、
14-visual-assets-guide.md「重要な注意」参照)して使う。`base_color`はColorRectの
`Color`プロパティと明示的に一致させる必要がある(同ドキュメントに記載の仕様)。

### 7.3 目視確認結果(godot_console)

一時的な検証用スクリプト(ヘッドレスログベース1本+通常起動スクリーンショット1本、
確認後に削除済み)で以下を検証した。

**カード裏返し演出**:
- `moon`スプレッドでRunを開始し、場札プレイを自動連打して裏向きカードが自然に露出する
  ケース、およびWaveStateを直接操作して人工的に裏向きカードを露出させたケースの両方で
  検証した。
- 検知直後(`RedrawAll()`より前)に`flippingCardIds.Displayed`へ対象カードIdが正しく
  反映されることを確認した。
- 演出中(mid-flight)、対象カードの表示(`CardFace.CurrentFaceUp`)が`false`(裏向き)の
  まま固定されている一方、同時刻の実データ(`wave.Tableau`から計算した表示上の値)は
  既に`true`(表向き)であることを確認した(先出しが起きていないことの直接証拠)。
- 演出完了後、表示が正しく表向きへ切り替わり、`activityTracker.IsActive`が`false`に
  戻って次の操作(場札プレイ・山札めくり)が正常にブロック解除されることを確認した。
- 上記「実ノード直接操作」設計で発生した「Tweenが完了しない」不具合を発見し、
  一時オーバーレイ方式への設計変更で解消したことも本検証で確認済み。

**妨害演出4種**:
- `SabotageDispatcher.TriggerSabotage`で4分類の代表ID(`TalismanSeal`/
  `TalismanConfiscate`/`RiteForceActivate`/`ComboReduce`)を直接発動させ、
  `HandleSabotageTriggered`が正しく分岐して対応する演出を再生することを確認した。
- 没収系・強制発動系は対象(護符・秘儀)を実際に所持させた状態と、所持していない
  (対象候補0件で空振りする)状態の両方で検証し、後者では演出がスキップされる
  (Web版と同じ仕様)ことを確認した。
- 封印系・没収系発動中は`activityTracker.IsActive=true`(操作ブロック)、
  強制発動系・数値変化系発動中は`false`のまま(ブロック対象外)であることを確認し、
  Web版`anyAnimationActive`の実際の構成と一致することを確認した。
- 通常起動でのスクリーンショット確認により、没収系のフォールバックラベル
  (「護符没収: SpringBreeze」等)が`AnimationOverlay`中央に正しく表示され、
  レイアウト崩れが無いことを確認した。

**共通**: `dotnet build`は0警告0エラー、`dotnet test`(`Shidasu.Core.Tests`)は
既存722件を維持したまま成功した(本フェーズは`Shidasu.Core`を変更していないため
件数・内容とも変化なし)。
