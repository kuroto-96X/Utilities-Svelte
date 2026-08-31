# フェーズ15: オーディオ実装

Web版(`Utilities-Svelte`)には音声演出が一切無いため、本フェーズはゼロからの新規設計・実装である(移植元は存在しない)。

発注元(ユーザー)確定方針:

- **SE(効果音)はコード合成で実装する**。実際の楽曲・高品質な効果音ファイルは用意できないため、Godot C#で`AudioStreamWav`に波形データ(サイン波/矩形波/三角波+ADSR風の簡易エンベロープ)をプログラム的に生成し、`AudioStreamPlayer`で再生する。
- **BGMは仮のまま進める**。実ファイルは用意せず、画面ごとの`AudioStreamPlayer`配置・クロスフェードの仕組み・音量バランスの配線までを整備する。プレースホルダーとして、波形合成ヘルパーで作ったごく簡単なループ可能な合成音(サイン波/三角波ドローン)を画面ごとに異なる音程で仮に鳴らしている。

実装ファイル(`Shidasu-Godot/Game/Scripts/Audio/`、全て新規):

- `ProceduralSoundGenerator.cs`: 波形合成の共通ヘルパー(サイン波/矩形波/三角波/ノイズ+ADSR風エンベロープ→`AudioStreamWav`)。BGM用のループ生成(`GenerateLoop`)も提供する。
- `SfxLibrary.cs`: 各SEの`SoundSpec`(周波数・尺・波形・エンベロープ)を定義し、`ProceduralSoundGenerator`でキャッシュ生成した`AudioStreamWav`群を保持する静的ライブラリ。
- `SfxPlayer.cs`: `AudioStreamPlayer`のプール(既定8ボイス)を持ち、SEの同時再生・優先度調停を行うノード。
- `BgmController.cs`: 画面ごとの`AudioStreamPlayer`を保持し、`SetScreen(BgmScreen)`でクロスフェードしながら切り替えるノード。
- `AudioBusManager.cs`: `AudioServer`にSFX/BGMバスを動的追加し、マスターボリューム調整用の薄いAPIを提供する。

紐付け先(既存ファイル、変更箇所のみ追記):

- `Game/Scripts/Game.cs`: `BgmController`を保持し、`ApplyPhase()`末尾で`run.Phase`→`BgmScreen`変換(`ResolveBgmScreen`)して`SetScreen`を呼ぶ。
- `Game/Scripts/Phases/PlayingPhase.cs`: `SfxPlayer`を保持し、カードプレイ・コンボ段階別・役成立・妨害4種・フリップの各SE再生を追加。
- `Game/Scripts/Phases/ShopPhase.cs`: `SfxPlayer`を保持し、購入・リロールのSE再生を追加。

---

## 1. SE設計

### 1.1 波形合成の共通基盤(`ProceduralSoundGenerator`)

`SoundSpec`(波形種別・周波数・尺・エンベロープ・音量・終端周波数)を受け取り、16bitモノラルPCMの`AudioStreamWav`を返す。個々のSEは波形生成コードを重複させず、`SfxLibrary`側でパラメータを1回だけ定義する。

- `WaveShape`: `Sine`(柔らかい)/`Square`(硬い)/`Triangle`(中間)/`Noise`。
- `Envelope`: Attack/Decay/Sustain/Releaseの簡易ADSR。`Percussive`(クリック・ポップ向け)・`Chime`(成立音向け)・`Flat`(BGMループ向け)の3プリセットを用意。
- `EndFrequencyHz`を指定すると、尺の間に周波数を線形補間する(役成立の上昇音、妨害没収系の下降音等に使用)。

### 1.2 各SEの一覧(`SfxLibrary`)

| SE | 発生タイミング | 波形 | 周波数 | 尺 | 備考 |
|---|---|---|---|---|---|
| `CardPlay` | 場札プレイ・山札めくり操作の瞬間 | Square | 520Hz | 0.07s | 短いクリック/ポップ音。両操作で共通 |
| `ComboStep[0..5]` | コンボが伸びた(増加した)瞬間 | Sine | 440Hz×2^(stage/12) | 0.12s | 半音刻みで段階が進むほど高音に。`ComboSfxStages.StageIndexForCombo`でコンボ数→段階(2コンボごとに1段階、最大6段階)を算出 |
| `RoleEstablished` | 役成立(通常) | Sine | 660→880Hz | 0.28s | 共通1種のチャイム音 |
| `RoleEstablishedWild` | 役成立(ワイルド使用時) | Sine | 880→1175Hz | 0.32s | 通常よりやや高く華やかなバリエーション。役の種類ごとの専用音は複雑になりすぎるため設けない |
| `SabotageSeal` | 妨害: 封印系 | Triangle | 110Hz | 0.45s | 低く重い音 |
| `SabotageConfiscate` | 妨害: 没収系 | Sine | 660→165Hz | 0.5s | 下降音 |
| `SabotageForcePulse` | 妨害: 強制発動系 | Square | 220Hz | 0.3s | 強めのパルス音(パーカッシブ) |
| `SabotageNumericWarning` | 妨害: 数値変化系 | Square | 330Hz | 0.15s | 短い警告音 |
| `ShopBuy` | ショップ購入(バラ売り/福袋/レリック共通) | Sine | 523→784Hz | 0.22s | 満足感のある上昇チャイム |
| `ShopReroll` | ショップリロール | Triangle | 392→494Hz | 0.14s | 購入音と差別化した軽いクリック |
| `CardFlip` | カード裏返り(裏→表の瞬間) | Sine | 740Hz | 0.09s | 高めの短いポップ |

役の種類ごとの専用音は設けず「共通1種+ワイルド時のバリエーション」に絞った。妨害4種はフェーズ13で確立した分類(封印系/没収系/強制発動系/数値変化系)にそのまま対応させている。

### 1.3 同時発生時の優先度方針

`SfxPlayer`は`AudioStreamPlayer`を8ボイスプールし、以下の方針で調停する(`SfxPriority`)。

1. 空いているプレイヤーがあれば常にそれを使う(通常プレイでは同時発生数が少なく、ほとんどのSEはそのまま重ねて再生される)。
2. プールが全て使用中の場合のみ優先度で調停する。新しい音の優先度が、現在再生中の音の中で最も低い優先度**以上**であれば、その最低優先度の再生を打ち切って新しい音を鳴らす。同一優先度が複数ある場合は最も古くから再生中のものを打ち切る(先着優先)。新しい音の優先度が既存の最低優先度より低ければ、再生自体をスキップする(鳴らさない)。

優先度の割り当て:

| 優先度 | 対象 | 理由 |
|---|---|---|
| `SfxPriority.SabotageBlocking`(最高) | 妨害: 封印系・没収系 | フェーズ13で「操作をブロックする演出」と判定された2種。ゲーム進行上の重要度が最も高く、確実に聞かせる必要がある |
| `SfxPriority.SabotageNonBlocking`(中) | 妨害: 強制発動系・数値変化系 | 非ブロック系。ブロック系ほどではないが通常SEより優先 |
| `SfxPriority.Normal`(最低) | カードプレイ・コンボ段階別・役成立・購入・リロール・フリップ | 頻繁に鳴る操作音。プール枯渇時は真っ先に打ち切られる対象とする |

この優先度分類は、フェーズ13で確立した「妨害4種のうち封印系・没収系のみ`activityTracker`に登録(操作ブロック対象)、強制発動系・数値変化系は登録しない」という区分(`13-animation-design.md` 7.2節)とそのまま対応させている。

---

## 2. BGM設計

### 2.1 画面種別(`BgmScreen`)とプレースホルダー音

| `BgmScreen` | 対応する`RunPhase` | プレースホルダー波形 |
|---|---|---|
| `Title` | `Title` | Sine 220Hz ループ |
| `Playing` | `Playing`, `ItemSelect`, `RiteSelect`, `RevelationSelect`, `OracleSelect`, `CardSetSelect` | Sine 330Hz ループ |
| `Shop` | `Shop`, `ContinueChoice` | Triangle 392Hz ループ |
| `ResultClear` | `AllClear` | Sine 440Hz ループ |
| `ResultGameOver` | `GameOver` | Triangle 196Hz ループ |

選択画面(アイテム選択等)はプレイ中BGMを継続する(頻繁に行き来する画面のため、遷移のたびにクロスフェードすると煩わしいという判断)。`ContinueChoice`はショップBGMの一部として扱う。結果画面は全クリア/ゲームオーバーでトーン(周波数・波形)を分けている。

`BgmController`は`BgmScreen`ごとに1つの`AudioStreamPlayer`を常設し、ノードを使い回す(同じ画面へ戻ってきた際に再生位置を維持するため)。`SetScreen`呼び出し時、現在の画面の音量を0dBへ、直前の画面の音量を-80dBへ0.8秒かけてクロスフェードする(`Tween.SetParallel(true)`+`Chain()`で直列区切り、フェード完了後に直前の`AudioStreamPlayer.Stop()`を呼ぶ)。

プレースホルダーの波形はループ境界のクリックノイズを避けるため、周波数×尺(0.4秒)が整数周期になる組み合わせを選んでいる。

### 2.2 実ファイル差し替え時の想定手順

1. `res://Assets/Audio/Bgm/`配下に画面ごとの音源ファイルを配置する(`title.ogg`, `playing.ogg`, `shop.ogg`, `resultClear.ogg`, `resultGameOver.ogg`。oggvorbis推奨、Godot標準のループタグ`LOOP_START`/`LOOP_END`に対応)。
2. `BgmController.BuildPlaceholderStream`の呼び出し箇所を`GD.Load<AudioStream>("res://Assets/Audio/Bgm/xxx.ogg")`に差し替える。
3. `AudioStreamPlayer`の構成(バス割り当て・クロスフェード処理)自体は変更不要。

---

## 3. `Game.cs`/`PlayingPhase.cs`/`ShopPhase.cs`への組み込み

### 3.1 BGM連携(`Game.cs`)

`Game._Ready()`で`BgmController`を`AddChild`し、`ApplyPhase()`の末尾で`ResolveBgmScreen(run.Phase)`の結果を`bgmController.SetScreen`へ渡す。`SetScreen`は同一画面への呼び出しを無視する(冪等)ため、`ApplyPhase`が同一フェーズ内の再描画で複数回呼ばれても問題ない。

### 3.2 SE連携(`PlayingPhase.cs`)

`CardMotionController`/`SabotageEffectController`と同じ「呼び出し側(`PlayingPhase`)が`AddChild`して保持する」パターンで`SfxPlayer`を保持する。

- **カードプレイ・山札めくり**: `HandlePlayCardPressed`/`HandleDrawStockPressed`の先頭(ガード節通過直後)で`CardPlay`を再生。
- **コンボ段階別**: `AfterAction`内、`waveAfter.Combo > comboBefore`の場合に`ComboSfxStages.StageIndexForCombo(waveAfter.Combo)`で段階を求め`ComboStep[stage]`を再生。コンボリセット時は鳴らさない。
- **役成立**: `AfterAction`内、既存の`RoleEstablished`シグナル発火ループの中で`fired.UsedWild`に応じ`RoleEstablished`/`RoleEstablishedWild`を再生。
- **妨害4種**: `StartSealFlashAnimation`/`StartConfiscateFadeAnimation`/`StartPressPulseAnimation`/`StartNumericPopupAnimation`の演出開始直後(`activityTracker.Begin`/`DisplaySync.BeginAnimation`と同じタイミング)にそれぞれ対応するSEを再生。既存の演出開始タイミング自体は変更していない。
- **フリップ**: `StartFlipRevealAnimation`内、各`CardFace.PlayFlipReveal`の`onHalfway`コールバック(裏返りの中間地点、`CardFace.Refresh`で表向きに差し替わる瞬間)で`CardFlip`を再生。

いずれもフェーズ13で確立済みのシグナル発火箇所・演出開始メソッド・完了コールバックに「乗る」形で追加しており、タイマー手打ちでの同期は行っていない。

### 3.3 SE連携(`ShopPhase.cs`)

同様に`SfxPlayer`を`AddChild`して保持する。

- **リロール**: `HandleRerollShopPressed`の先頭で`ShopReroll`を再生。
- **購入**: バラ売り・福袋・レリックの購入処理を共通化している`HandleBuySlot(Func<RunState> buyFn)`の先頭で`ShopBuy`を再生(購入経路を1箇所に集約しているため、SE追加も1箇所で済む)。

### 3.4 マスターボリューム設定(`AudioBusManager`)

`AudioServer`にコードから`SFX`/`BGM`バスを動的追加する(`EnsureBusesExist`、`SfxPlayer`/`BgmController`の`_Ready`から呼ばれるため呼び出し漏れの心配がない)。`project.godot`には`default_bus_layout.tres`が存在せず(Masterバスのみのデフォルト状態)、リソースファイル編集の代わりにコードから構成する方式にした。

初期音量: SFXバス -4dB(複数同時再生を想定しやや控えめ)、BGMバス -8dB(SFXの邪魔をしない程度)。`SetSfxVolumeDb`/`SetBgmVolumeDb`/`SetSfxMuted`/`SetBgmMuted`を用意しており、本格的なオプション画面(フェーズ16以降のスコープ)からはこれらのAPIを呼ぶだけでよい。

---

## 4. 動作確認結果(godot_console)

一時的な検証用スクリプト(`AudioVerifyRunner.cs`、Game.tscnをインスタンス化しタイトル→スタート→自動プレイを行うヘッドレスランナー。SabotageDispatcher.TriggerSabotageを直接呼んで妨害4種を人工的に発生させる処理・Wave強制終了処理を含む。確認後に削除済み)で以下を検証した。

- **BGMクロスフェード**: タイトル起動時に`(none) -> Title`、スタート後`Title -> Shop`(ステージ確認画面)、Waveへ進むボタンで`Shop -> Playing`、妨害検証後のWave強制終了で`Playing -> Shop`(クリア扱い)がそれぞれ正しく発火することを確認した。目標未達のままWaveを終了させた場合は`Playing -> ResultGameOver`へ遷移することも確認した(意図した仕様通り)。
- **カードプレイ**: 場札プレイ・山札めくりのたびに`CardPlay`(0.07秒)が再生されることを確認した。
- **コンボ段階別**: コンボが伸びるたびに`ComboStep`(0.12秒、段階に応じた周波数)が再生されることを確認した。
- **役成立**: `SameRank`役成立時に`RoleEstablished`(0.28秒)が再生されることを確認した。
- **妨害4種**: `SabotageDispatcher.TriggerSabotage`を直接呼び出し、以下を確認した。
  - 封印系(`TalismanSeal`): `seal_flash`演出+`SabotageSeal`(優先度`SabotageBlocking`、0.45秒)。
  - 没収系(`TalismanConfiscate`、検証用に護符を1つ付与して対象を確保): `confiscate_fade`演出+`SabotageConfiscate`(優先度`SabotageBlocking`、0.5秒)。
  - 数値変化系(`ComboReduce`): `numeric_popup`演出+`SabotageNumericWarning`(優先度`SabotageNonBlocking`、0.15秒)。
  - 強制発動系(`RiteForceActivate`)は検証環境に使用可能な秘儀がなく空振り(Web版と同じ仕様通りの正常動作)したため実再生ログは確認できなかったが、`HandleSabotageTriggered`内の分岐構造は封印系・数値変化系と完全に同一であり、コードレビューで妥当性を確認した。
- **ショップ購入**: Waveをクリア扱いで強制終了させショップ本体まで到達させ、購入操作で`ShopBuy`(0.22秒)が再生されることを確認した。リロールは検証時点の所持通貨不足でボタンがDisabledだったため直接の再生確認はできなかったが、`HandleBuySlot`と同一の実装パターン(ボタン押下→SE再生→ロジック実行)であり構造上の妥当性を確認した。
- **フリップ**: 実装(`StartFlipRevealAnimation`内`onHalfway`コールバックでの`CardFlip`再生)はフェーズ13で動作確認済みの`PlayFlipReveal`呼び出しにSE再生を追加しただけであり、コールバック発火タイミング自体は影響を受けない。

**共通**: `dotnet build`は0警告0エラー、`dotnet test`(`Shidasu.Core.Tests`)は既存722件を維持したまま成功した(本フェーズは`Shidasu.Core`を変更していないため件数・内容とも変化なし)。
