# Shidasu 護符候補一覧グループ17の実装(8個)

## 0. 背景・目的

`docs/shidasu-gofu-candidates.md`のグループ17〜19(合計16個)は、これまで実装してきたグループ9〜16よりもさらに複雑な部類(コンボ数・基礎点など計算式の内側を書き換える「内部干渉」型が中心)であり、1回のspec/planサイクルで扱うには大きすぎると判断した。本specはそのうちグループ17(8個: 祝福・座護・大地・黄金・明星・慈悲・水鏡・刻限)のみを対象とする。グループ18(判定ロジック変更系)・グループ19(デメリット付き)は別途のサブプロジェクトとして後日扱う。

## 1. アーキテクチャ

### 1.1 一時comboパイプライン(座護・大地・黄金)

`playCard`でコンボを加算する際、以下の順で処理する:

1. **実コンボ加算**: 通常は`wave.combo + 1`。黄金を所持していれば`wave.combo + 2`(「コンボするたびコンボ数+1する」を、黄金無しの場合の+1に対する追加+1として実装する)。この値が`wave.combo`として永続化され、UI表示・`faceLock`判定など既存の全ての判定に使われる。
2. **一時combo算出**: 実コンボ加算後の値を初期値とし、`items`配列の並び順で座護・大地を順に適用する。
   - 座護: 一時combo `< c` なら一時comboを`c`にする。
   - 大地: 一時comboに`c`を無条件で加算する。
   - 所持順によって結果が変わる(例: 大地→座護の順で所持していると、大地の加算で一時comboが座護の閾値以上になり座護が不発化することがある)。これは意図した挙動。
3. 一時comboを、以後のスコア倍率計算(`comboMultiplierStep`によるコンボ倍率)と`ItemEffectContext.combo`(他の護符が読む「現在のコンボ数」)の両方に使う。`wave.combo`自体は一時comboの影響を受けない。

`drawStock`の素朴(naive)パスでも同様に、実コンボ加算(`wave.combo + 1`、黄金があれば+2)→一時combo算出→スコア計算、という同じ手順を踏む。

黄金は実コンボ加算のステップにのみ作用し、一時comboパイプラインや他の護符の効果には一切干渉しない。

### 1.2 新規WaveStateフィールド

```ts
export interface WaveState {
  // ...既存フィールド
  baseComboCount: number                              // 祝福用: 役成立のたび+1、コンボリセット時の復帰先
  roleEchoUsedThisCombo: Partial<Record<RoleName, boolean>>  // 水鏡用: 役の種類ごとに今コンボで遅延複製を使ったか(sameRank以外)
  sameRankEchoUsedThisCombo: number[]                  // 水鏡用: sameRankは枚数段階(sameRankCountの値)ごとに使用済みかを記録する配列/Set相当
  pendingRoleEcho: { name: RoleName; sameRankCount?: number } | null  // 水鏡用: 次の1プレイで上乗せ予定の役
  roleOccurrenceCountThisWave: Partial<Record<RoleName, number>>  // 明星用: 役の種類ごとのウェーブ内累積成立回数
  mercyActiveNextCombo: boolean                        // 慈悲用: 次のコンボの間、倍率xを適用中か
}
```

初期化(`startWave`): `baseComboCount: 0`, `roleEchoUsedThisCombo: {}`, `sameRankEchoUsedThisCombo: []`, `pendingRoleEcho: null`, `roleOccurrenceCountThisWave: {}`, `mercyActiveNextCombo: false`。

コンボリセット時(`drawStock`の非継続分岐)の扱い:
- `roleEchoUsedThisCombo`・`sameRankEchoUsedThisCombo`: `{}`/`[]`にクリア(役ごとの「今コンボで使ったか」はコンボ単位)。
- `pendingRoleEcho`: リセット時点で未消費なら破棄してnullに戻す(次のコンボへ持ち越さない)。
- `mercyActiveNextCombo`: リセット直前の`wave.combo`が`慈悲.c`以下なら、リセット後に`true`にする(=次のコンボで発動)。そうでなければ`false`にする(実装は「リセットされる瞬間のコンボ数」を見て判定する)。
- `baseComboCount`・`roleOccurrenceCountThisWave`: ウェーブ単位のため、コンボリセットでは変化しない(ウェーブ開始時のみ0/{}に戻す)。

## 2. 対象8護符の仕様

| 護符名 | id | チャンネル/機構 | 条件・数式 | 既定値 |
|---|---|---|---|---|
| 祝福 | `sanctify` | ルール変更 | 役成立(`roleFired.length > 0`、列一掃ボーナスも含む)のたび`baseComboCount += 1`。コンボリセット時、`wave.combo`を0ではなく`baseComboCount`にする | パラメータ無し |
| 座護 | `protection` | 一時combo変更 | 一時combo `< c` のとき、一時comboを`c`にする | c=3 |
| 大地 | `earth` | 一時combo変更 | 一時comboに`c`を無条件加算 | c=2 |
| 黄金 | `golden` | ルール変更 | 実コンボ加算を+1ではなく+2にする(通常のコンボ加算処理にのみ作用、他護符に無干渉) | パラメータ無し |
| 明星 | `morningStar` | gained倍算(役ボーナス部分のみ) | 役ボーナス`bonus`部分について、`roleOccurrenceCountThisWave[役名]`(今回成立分を含まない、これまでの累積)を使い`bonus × (1 + count × x)`に置き換える | x=0.2 |
| 慈悲 | `mercy` | gained倍算(持続) | コンボ`≤ c`でリセットされたら次のコンボの間`mercyActiveNextCombo=true`。trueの間、獲得点を`x`倍 | c=3, x=1.5 |
| 水鏡 | `mirror` | ルール変更 | 役Xが成立し、コンボ内でXの遅延複製が未使用なら、次の1プレイでXの役ボーナスを無条件で上乗せする。役の種類ごと(同ランクは枚数段階ごと)にコンボ内1回のみ | パラメータ無し |
| 刻限 | `deadline` | gained加算 | カードプレイ時、山札の残り枚数(`stockRemaining`)× `n`点を加算(通常のgainedチャンネル、コンボ倍率の影響を受ける) | n=10 |

## 3. 各護符の詳細設計

### 3.1 祝福(sanctify)

`playCard`で役が成立した(`roleFired.length > 0`)場合、`newBaseComboCount = wave.baseComboCount + 1`とし、`next.baseComboCount`に反映する。同時に、この時点の一時comboにも+1する(スコア計算・以後のコンボ判定にも今回の成立分を即座に反映するため)。

`drawStock`の非継続(リセット)分岐で、`items.includes('sanctify')`なら`combo: wave.baseComboCount`(祝福を持たなければ従来通り`combo: 0`)。

### 3.2 座護(protection)・大地(earth)

一時comboの算出は、`playCard`内でコンボ加算した直後、スコア計算(`ItemEffectContext`構築・倍率計算)より前に行う。

```ts
let effectiveCombo = newCombo // 実コンボ加算後の値(黄金適用済み)
for (const id of items) {
  if (id === 'protection' && effectiveCombo < params.talismans.protection.c) {
    effectiveCombo = params.talismans.protection.c
  } else if (id === 'earth') {
    effectiveCombo += params.talismans.earth.c
  }
}
```

以後、`ItemEffectContext.combo`・コンボ倍率計算(`1 + (effectiveCombo - 1) * comboMultiplierStep`)は`newCombo`ではなく`effectiveCombo`を使う。`wave.combo`(永続化される値)は`newCombo`のまま(黄金の影響のみ)。

`drawStock`の素朴パスでも同様の`effectiveCombo`算出をコピーする(既存の素朴実装が`playCard`と同型の計算をdrawStock内に複製している構造を踏襲)。

### 3.3 黄金(golden)

`playCard`・`drawStock`(素朴パス)の両方で、コンボ加算部分`wave.combo + 1`を`wave.combo + (items.includes('golden') ? 2 : 1)`に変更する。

### 3.4 明星(morningStar)

`evaluateChainBonus`が返す`roleFired`配列の各エントリについて、そのエントリが加算した基礎ボーナス額(`columnSweepBonus`・`sameRankBonusUnit`ベースの額・フラッシュ/ロイヤルセット/コンプリートランの固定ボーナス額)を特定し、`roleOccurrenceCountThisWave[名前]`(未成立なら0)を使って`額 × (1 + count × x)`に置き換えた差分を、通常のgained計算の`base`に反映する。

実装方針: `evaluateChainBonus`自体は変更せず、`playCard`側で「明星を所持している場合、`chainResult.roleFired`の各エントリに対応する基礎ボーナス額を`roleOccurrenceCountThisWave`で追加増額する」処理を、`base`計算に加える形にする(役ごとの基礎額をこの時点で個別に再算出する必要があるため、`evaluateChainBonus`の内部で使っている定数計算をplayCard側からも参照できるようにする)。

`roleOccurrenceCountThisWave`の更新: `playCard`で`roleFired`に含まれる各役名について、次のプレイ以降に反映されるよう`+1`する(今回成立分の倍率計算には使わない、次回以降の分から反映)。

### 3.5 慈悲(mercy)

`drawStock`のリセット分岐で、リセット直前の`wave.combo`(一時comboではなく実コンボ)が`params.talismans.mercy.c`以下なら`mercyActiveNextCombo: true`を設定し、そうでなければ`false`にリセットする。

`playCard`のgained計算で、`wave.mercyActiveNextCombo`が`true`なら獲得点(`gained`)全体を`x`倍する。このフラグ自体はコンボがリセットされるまで(次のコンボ全体で)trueのまま維持され、次にリセットが起きたタイミングで再判定される。

### 3.6 水鏡(mirror)

`playCard`で役が成立した場合、成立した各役について:
- `roleEchoUsedThisCombo[役名]`(sameRank以外)または`sameRankEchoUsedThisCombo`(sameRankの場合、成立したsameRankCountの値がこの配列に含まれるか)が未使用なら、`pendingRoleEcho`にその役情報をセットし、使用済みとして記録する。
- 既に同コンボ内で使用済みなら何もしない(複数の役が同時に成立した場合は、まだ未使用の役を優先的に1つだけ`pendingRoleEcho`にセットする。複数役が同時に「まだ未使用」であった場合の優先順位は、`roleFired`配列の出現順とする)。

次のプレイの`playCard`冒頭で、`wave.pendingRoleEcho`が非nullなら、対応する役の基礎ボーナス額を無条件で`base`に加算し(実際にその役が今回成立したかは問わない)、`pendingRoleEcho`をnullに戻す。

### 3.7 刻限(deadline)

`playCard`のgained計算で、`base`に`wave.stock.length × params.talismans.deadline.n`を加算する(基礎点・チェーンボーナスと同様にコンボ倍率の影響を受ける通常のgained加算)。

## 4. 既存システムへの影響

- `ItemId`に8個追加(`sanctify`, `protection`, `earth`, `golden`, `morningStar`, `mercy`, `mirror`, `deadline`)。
- `WaveState`に6個の新規フィールドを追加(1.2節)。`startWave`・`makeWave`テストヘルパーの初期化が必要。
- `ItemEffectContext.combo`の意味が変わる(実コンボではなく一時combo)。既存のgained計算に影響するため、`playCard`・`drawStock`(素朴パス)双方の書き換えが必要。
- `evaluateChainBonus`または`playCard`側に、役ごとの基礎ボーナス額を個別に取得する仕組みが必要(明星・水鏡の両方が必要とする)。
- `ITEM_POOL`・`ITEM_NAMES`・`itemDesc`に8個追加。
- 管理画面(`admin/shidasu`)にグループ17のパラメータ入力欄を追加。

## 5. スコープ外

- グループ18(判定ロジック自体を変える内部干渉)・グループ19(デメリット付き)は別サブプロジェクト。
- 数値バランス調整(既定値は仮置き)。
- 明星・水鏡が同時に役ボーナスへ干渉するケース(明星の倍率適用後の額を水鏡が複製するか、複製額にも明星の倍率がかかるか)の厳密な相互作用は、実装時に自然な適用順(明星の倍率計算を経た後の額を水鏡が複製する)とし、詳細なテストケースを実装フェーズで詰める。

## 6. 受け入れ基準

1. 座護・大地は所持順で一時comboに順に作用し、大地→座護の順で座護が不発化するケースがテストで再現できる
2. 黄金を持つとコンボが+2ずつ進み、他の護符の効果には影響しない
3. 祝福は役成立のたび基礎コンボ数が増え、コンボリセット時にその値から再開する
4. 明星は役の種類ごとのウェーブ内累積成立回数に応じて、その役の基礎ボーナス額が倍率適用される
5. 慈悲はコンボ数c以下でのリセット後、次のコンボの間だけ倍率xが適用される
6. 水鏡は役の種類ごと(同ランクは枚数段階ごと)にコンボ内1回だけ、次のプレイへ役ボーナスを遅延複製する
7. 刻限は山札残り枚数に応じてプレイ時に加算される(コンボ倍率の影響を受ける)
8. `npm run test`・`npm run build`が成功する
