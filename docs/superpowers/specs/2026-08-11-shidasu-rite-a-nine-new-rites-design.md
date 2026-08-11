# 秘儀A候補9種の新規実装 設計書

> 対象: `docs/shidasu/shidasu-rite-redesign-candidates.md` セクションA(天啓候補審査で不採用となった10候補)を秘儀として実装する。

## 背景・目的

2026-08-11、秘儀のカード変換系9種(raidho/perthro/ansuz/wunjo/othala/tiwaz/laguz/kenaz/thurisaz)を実装から削除し、秘儀は24種中15種になった。空いた9つのルーングリフ(ᚱ・ᚹ・ᛟ・ᛈ・ᛏ・ᛚ・ᚨ・ᚲ・ᚦ)と対応する9つのRiteId文字列(raidho/wunjo/othala/perthro/tiwaz/laguz/ansuz/kenaz/thurisaz)を、`shidasu-rite-redesign-candidates.md`セクションA(天啓候補として不採用になった10候補、秘儀候補への転用素材)の内容で埋め、秘儀を再び24種にする。

セクションAの10候補は、ブレインストーミングを通じて内容を1つずつ確認・改訂し、うち1個(元候補1「列ランク統一変換」)を不採用とし、残り9個を採用した。旧RiteIdの文字列・グリフは再利用するが、効果内容は元の秘儀(削除済み)とは完全に別物になる。

## 設計方針

- **対象選択はすべてランダム化する**: 既存の残存15種の秘儀はいずれも対象選択UIを持たず、ランダム選択または場札・チェーン全体を対象にする。今回追加する9種もこの慣習に合わせ、「選んだ列」という表現は「ランダムな列」に統一する。`useRite`のシグネチャ変更(対象選択パラメータの追加)は行わない。
- **カード変換(スート・ランク・ワイルド変換)は行わない**: 2026-08-09に確定した「天啓=カード変換系、秘儀=それ以外」の役割分担を維持する。9種はいずれもカードの移動・並べ替え・シャッフル・補充など、値を変換しない効果のみで構成する。
- **新規WaveStateフィールドは最小限に留める**: 9種のうち8種は既存フィールド(`tableau`/`stock`/`discardPile`/`chain`/`dealtRows`など)の操作のみで実装できる。唯一thurisaz(次回プレイ得点x倍)だけ新規フィールド`nextPlayScoreMultiplier`が必要。

## 実装する9種の効果仕様

いずれも`src/lib/game/shidasu/riteEffects.ts`の`applyRiteEffect`から呼ばれる純粋関数として実装する(既存15種と同じパターン)。

### raidho(ᚱ ライドー): 非絵札リシャッフル

場札の絵札(J/Q/K)とワイルドはその場に残し、非絵札のみを山札と合流させてシャッフルし、元あった位置(列・段)に配り直す。あぶれた分は新しい山札になる。

- 対象判定は`isFace`(rank>=11)を使う。ワイルドは`!c.wild`で除外(絵札・非絵札どちらの判定にも含めない)。
- 実装は「非絵札の位置一覧を記録→該当カードを山札と合流してシャッフル→同じ位置に配り直す」という手順。

### wunjo(ᚹ ウンヨー): 捨て札リサイクル配り直し

場札の全カードを一旦捨て札に合流させてシャッフルし、各列の元の枚数を維持したまま場札に配り直す(あぶれた分は新しい捨て札になる。山札は一切変更しない)。

- 既存のhagalaz(場札+山札を合流→配り直す)と同じアルゴリズムだが、合流先が「山札」ではなく「捨て札」になる版。

### othala(ᛟ オセラ): 特定ランク合流シャッフル

山札内で最も残り枚数が多いランク(同数なら候補からランダム)を1つ選び、そのランクの山札カードをすべて場札に合流させる。場札の全カード(合流分含む)をシャッフルし、列数は変えずに列をまたいでラウンドロビンで配り直す。

- ラウンドロビン: シャッフル後のカード列を`pool[i]`としたとき、列 `i % cols` に順番に積んでいく。
- 山札に対象ランクのカードが0枚の場合は何もしない(no-op)。

### perthro(ᛈ ペルスロ): 初期深度まで補充

各列について、現在の枚数がウェーブ開始時の配り枚数(`dealtRows`)を下回っている分だけ、山札の上から補充する。山札が足りなければ補充できるだけ補充する。

- `canUseRite`: 1列以上`col.length < wave.dealtRows`を満たす列がある場合のみ使用可。

### tiwaz(ᛏ ティワズ): 全列反転

場札のすべての列について、カードの並び順を上下逆にする(各列の一番上と一番下が入れ替わる)。

### laguz(ᛚ ラグズ): 空列復活

場札の中でカードが0枚になっている列をランダムに1つ選び、その列に山札から初期配置の枚数(`dealtRows`)まで補充する。

- `canUseRite`: 1列以上`col.length === 0`を満たす列がある場合のみ使用可。

### ansuz(ᚨ アンスズ): チェーンリフレッシュ

チェーンの全カードを捨て札に送り、山札から1枚をめくって新しいチェーン(1枚)にする。コンボ数(現在値・最大値・基礎値)は一切変更しない。山札が空の場合は何もしない(no-op)。

- `engine.ts`内の`resetComboFields`(コンボリセット時の共通フィールド初期化、`engine.ts:230`)が同種の「新しいチェーンを開始する」処理を持つが、モジュール非公開かつコンボもリセットしてしまうため直接は使えない。`riteEffects.ts`側で、コンボ関連(`combo`/`maxComboThisWave`/`baseComboCount`/`comboFrozenThisWave`)を除いた同等のフィールド(`chain: [drawn]`・`chainOrigin: ['draw']`・`linked: false`・`columnsEmptiedThisCombo: 0`・`comboStreakColumnLengths`・`discardPile`(旧chain全体を追加)・`drawContinueCountThisChain: 0`・`flushActiveThisCombo: false`・`sameColumnStreak: 0`・`lastPlayedColumn: null`)を独自に初期化する。
- `foundation`は`Card`型でnull非許容のため、山札が空の場合は新しいfoundationを作れない。この場合は効果全体をno-opにする(`wave.stock.length === 0`なら`wave`をそのまま返す)。

### kenaz(ᚲ ケナズ): スート頻度配り直し

場札の全カードを山札に合流させ、合流後のカードをスート別に集計し、枚数が多いスートから順に(スートごとに内部シャッフルしたうえで)並べた配り札の列を作る。この配り札の列から、元の各列の枚数を維持したまま場札に配り直す(スートの多い順に埋まっていく)。配りきれず余ったカードは新しい山札としてあらためてシャッフルする。

- スート集計はワイルドの`suit: '★'`も1つの区分として扱う(変換は行わないため問題ない)。

### thurisaz(ᚦ スリサズ): 次回プレイ得点x倍

そのウェーブの次回1回のカードプレイの得点計算に×x(既定値1.5)を追加で乗算する。1回のプレイで消費され、以後は元に戻る。

- `WaveState`に`nextPlayScoreMultiplier: number`(既定1)を追加。
- `applyRiteEffect`のthurisazケース内で`{ ...wave, nextPlayScoreMultiplier: params.rites.thurisaz.x }`を返す(isa/sowiloなど他のフラグ系秘儀と同じく、`engine.ts`側に専用分岐を作らず`riteEffects.ts`内で完結させる)。
- `engine.ts`の`playCard`内、既存の乗算チェーン(`multiplier × mannazFactor × dedicationFactor × diligenceFactor × divineProtectionFactor × frostFactor × echoFactor × arroganceFactor`、`engine.ts:583`付近)に`thurisazFactor`(`wave.nextPlayScoreMultiplier`の値、1でなければ得点内訳に「スリサズ」として表示)を追加する。
- `playCard`の戻り値`next: WaveState`で、`nextPlayScoreMultiplier`を無条件に1へリセットする(消費型)。
- `drawStock`の素朴分岐には適用しない(「カードプレイ時」に限定されるため)。

## 使用条件(canUseRite)まとめ

| RiteId | 条件 |
|---|---|
| perthro | 1列以上、現在枚数が`dealtRows`未満 |
| laguz | 1列以上、現在枚数が0 |
| 上記以外7種 | 常に使用可(既存の大半の秘儀と同様。対象が無ければ効果側でno-op) |

## 変更ファイル一覧

- `src/lib/game/shidasu/types.ts`: `RiteId`型に9種を復元(24種)。`WaveState`に`nextPlayScoreMultiplier: number`を追加
- `src/lib/game/shidasu/rites.ts`: `RITE_POOL`に9種を復元(24種)
- `src/lib/game/shidasu/riteEffects.ts`: 9種分の`apply*`関数を新規実装。`canUseRite`にperthro/laguzの条件分岐を追加。`applyRiteEffect`のswitchに9ケース追加
- `src/lib/game/shidasu/riteActualEffects.ts`: 9エントリを新しい効果内容で追加
- `src/lib/game/shidasu/params.ts`: `rites`型定義・`DEFAULT_PARAMS.rites`に9キーを復元(グリフは同じ、descは新効果に合わせて刷新。thurisazのみ`x: number`フィールドを持つ)
- `src/lib/game/shidasu/shidasu.config.json`: 同様に9キーを復元
- `src/lib/game/shidasu/engine.ts`: `startWave`で`nextPlayScoreMultiplier: 1`を初期値に設定。`playCard`の乗算チェーンに`thurisazFactor`を追加し、プレイ後に1へリセット
- テスト: `riteEffects.test.ts`(9種分の新規テスト)、`rites.test.ts`(プール24種に応じたコメント更新)、`engine.test.ts`(thurisazの得点乗算・リセットの統合テスト、perthro/laguzの使用条件テスト)
- ドキュメント: `docs/shidasu/shidasu-rite-redesign-candidates.md`(セクションAに実装完了の記録を追記、候補1不採用の記録)、`docs/shidasu/shidasu-current-rules.md`(7.2節を「24種中15種」→「全24種」に戻す)、`docs/shidasu/shidasu-roadmap.md`(項目2を「空き枠を9種使い切り24種に復帰」に更新)

## テスト方針

既存15種の`riteEffects.test.ts`と同じ形式で、9種それぞれについて最低1ケース(効果の基本動作)を追加する。perthro・laguzは使用条件(`canUseRite`)のtrue/false双方を検証する。thurisazは`playCard`との統合テスト(乗算が効くこと・1回消費後にリセットされること)を`engine.test.ts`に追加する。

## スコープ外

- 秘儀への対象選択UI(列を選ぶ操作)の追加は行わない(既存の慣習通りランダム選択に統一したため)。
- 場札の列数を恒久的/一時的に増やす機能は実装しない(元候補7は「空列復活」に全面差し替え済み)。
- `drawStock`側の得点計算(素朴分岐)へのthurisaz適用は行わない。
