# 妨害行動アニメーション(グループD: カード移動系) 設計

## 背景・目的

Shidasuの星の妨害行動32個すべてに専用アニメーションを設定する取り組みの一環。グループA(封印系)・B(没収系)・C(強制発動系)・E(数値変化系)は実装済み。本設計は最後に残ったグループD「カード移動系」7個を対象とする。

対象: `chainSettle`(強制清算)・`chainPartialDiscard`(チェーン部分放棄)・`discardErase`(捨て札消去)・`discardBury`(捨て札埋没)・`tableauCardToDiscard`(一枚没収)・`tableauShuffle`(総入れ替え)・`chainShuffle`(チェーン入れ替え)。

いずれも既存の「総戻し/一列戻し」(場札→山札→再配布)、「大量放出/少量放出」(山札→捨て札、個別移動)、「山札攪拌」(その場でシェイク)と同系統(カードが物理的に移動する、または全体が揺れる)だが、対象エリアの組み合わせが異なるため、既存演出パターンを流用・拡張する形で実装する。

## 対応方針の全体像

| 妨害行動 | 内容 | 対応方針 |
|---|---|---|
| chainSettle(強制清算) | チェーン全体→捨て札、山札から1枚めくり新チェーン | 既存の「チェーンリセット検知」(`startChainResetAnimation`)をそのまま流用 |
| chainPartialDiscard(部分放棄) | チェーン先頭2枚→捨て札 | 既存の「チェーンリセット検知」を対象カード判定の修正込みで流用 |
| discardErase(捨て札消去) | 捨て札+チェーン→シャッフル→新チェーン/新捨て札 | 新規: 収束→再配布(総戻し型)、集約先=チェーンエリア |
| discardBury(捨て札埋没) | 山札+捨て札→シャッフル→新捨て札(裏向き) | 新規: 収束→再配布(総戻し型)、集約先=捨て札位置 |
| tableauCardToDiscard(一枚没収) | 場札から1枚→捨て札 | 既存の個別移動(`startStockPurgeAnimation`)を起点=場札マス目に変えて流用 |
| tableauShuffle(総入れ替え) | 場札を列またぎで再配置(山札は経由しない) | 新規: 場札全体が裏向きシェイク→新配置でカードごとにフリップ/据え置き |
| chainShuffle(入れ替え) | チェーン内の並びをシャッフル(枚数不変) | 既存の「山札攪拌」と同型、チェーンエリア全体がその場でシェイク |

## 技術設計A: chainSettle・chainPartialDiscardの既存検知ロジック修正

### 現状の実装と問題

`PlayArea.svelte`の`startChainResetAnimation`は、`lastSabotage`のような明示的シグナルを使わず、`wave.chain`配列の変化を`$effect.pre`で推測して検知する(通常のプレイ・山札捲りによるチェーンリセットと共用するため、`triggerSabotage`とは独立した検知経路になっている)。

```ts
const isExtension = currentChainCards.length === previousChainCards.length + 1
  && previousChainCards.every((card, i) => card.id === currentChainCards[i].id)
const resetCards = isExtension
  ? []
  : currentChainCards.length > 0
    ? previousChainCards.filter(card => card.id !== currentChainCards[currentChainCards.length - 1].id)
    : previousChainCards
```

`chainSettle`はチェーン全体が新しい1枚(`drawn`)に置き換わるため、`isExtension`は`false`になり`resetCards`は正しく「消えた旧チェーン全体」になる。既存ロジックのままで問題なく動作する。

一方`chainPartialDiscard`(チェーン先頭2枚のみ除去、残りは維持)では、`resetCards`の判定が「現在のチェーンの末尾カードidと不一致のものを全部消えた扱いにする」ため、**現在のチェーンにまだ残っているカードまで誤って`resetCards`に含まれてしまう**。

例: `previousChainCards = [A, B, C, D]`(先頭A、末尾D)で先頭2枚(A, B)が除去され`currentChainCards = [C, D]`になった場合、現在のロジックでは`resetCards = previousChainCards.filter(card => card.id !== D.id)` = `[A, B, C]`となり、まだ場に残っているはずの`C`まで「捨て札へ消えるカード」として誤ってアニメーション対象になる。

### 修正

`resetCards`の判定を「現在のチェーンに含まれないカードのみ」に変更する:

```ts
const resetCards = isExtension
  ? []
  : previousChainCards.filter(card => !currentChainCards.some(c => c.id === card.id))
```

`currentChainCards.length > 0`による分岐(データ構造上チェーンが空になるケースの特別扱い)は不要になる。`currentChainCards`が空配列であっても`.some`は常に`false`を返すため、`previousChainCards`全体が正しく`resetCards`になる。

この修正により、通常のプレイ・山札捲りによるリセット(`resetComboFields`経由、既存の全消し・手詰まりリサイクル含む)への影響が無いことを確認する必要がある。通常リセットは`newFoundation`が新規カードであり、`currentChainCards`は常に`[newFoundation]`の1枚のみのため、旧チェーンの全カードが`currentChainCards`に含まれることは無く、修正前後で`resetCards`の計算結果は変わらない。

## 技術設計B: discardErase・discardBuryの収束→再配布アニメーション

### SabotageResultへの新規フィールド追加

`src/lib/game/shidasu/sabotageEffects.ts`の`SabotageResult`に以下を追加する:

```ts
// 今回「discardErase(捨て札消去)」「discardBury(捨て札埋没)」で2エリアを
// まとめてシャッフル・再分配したことを明示的に伝える。対象エリアの組み合わせに
// よって収束元・再配布先が異なるため、kindで区別する。
redistributedAreas?:
  | { kind: 'chainAndDiscard' } // discardErase: 捨て札+チェーン→新チェーン+新捨て札
  | { kind: 'stockAndDiscard' } // discardBury: 山札+捨て札→新捨て札(裏向き)+新山札
```

`applyDiscardErase`・`applyDiscardBury`はそれぞれ対応する`kind`を返り値に追加する。

### PlayArea.svelte側の検知・アニメーション

`$effect.pre`の`lastSabotage`検知ブロックに新しい`else if`分岐を追加する:

```ts
} else if (current.id === 'discardErase' || current.id === 'discardBury') {
  if (current.redistributedAreas) {
    startDiscardRedistributeAnimation(current.redistributedAreas)
  }
}
```

`startDiscardRedistributeAnimation`は、既存の`startSabotageRedistributeAnimation`(総戻し/一列戻し)と同じ2段階構成(収束→再配布)の新規関数として実装する:

1. **収束フェーズ**: `redistributedAreas.kind`に応じて収束元のカード位置を集める。
   - `chainAndDiscard`: `wave.chain`の各カードは`chainAreaEl`から、`wave.discardPile`の各カードは`discardPileEl`(捨て札は1点のみ表示のため、実際に集めるのは捨て札の見た目上の位置)から座標を取得する。
   - `stockAndDiscard`: `wave.stock`は個別カード表示を持たないため、収束アニメーションの起点は`stockButtonEl`固定(捨て札側のカードのみ実際に位置から収束させる)。
   - 収束先の集約ポイントは、`discardErase`は`chainAreaEl`の中心、`discardBury`は`discardPileEl`の中心とする。
2. **再配布フェーズ**: 集約ポイントから1枚ずつ、`DEAL_INTERVAL_MS`間隔で再配布先へ飛ばす(`startStockPurgeAnimation`と同様の個別移動+着地パターン)。
   - `discardErase`: 新チェーン分(`chainCount`枚)を`chainAreaEl`へ、残りを`discardPileEl`へ。
   - `discardBury`: 新捨て札分(`n`枚)を`discardPileEl`へ(常に`faceUp: false`で着地、フリップ演出は発生しない)、残りは`stockButtonEl`位置へ(山札は個別表示を持たないため、最後の1枚が届いた時点でアニメーションを終える)。

### 常設UI要素の先出し防止(CLAUDE.md「移動アニメーション実装時の注意」を適用)

`wave.chain`・`wave.discardPile`・`wave.stock`は`triggerSabotage`実行時点で既に再分配後の内容に更新済みのため、既存の`displayedDiscardTop`(捨て札の表示専用スナップショット)パターンと同様、チェーンエリアの表示にも「アニメーション実行中は実データを直接参照しない」対応が必要かどうかを実装時に確認する。既存の`chainAreaEl`の`invisible`制御(`cleanupAnimation?.kind === 'chain' || chainCleanedUp || chainResetAnimation !== null || dealAnimationActive`)と同じパターンで、新規アニメーション実行中フラグを追加してチェーンエリアを非表示にする方向で対応する。

## 技術設計C: tableauCardToDiscardの個別移動(起点変更)

### SabotageResultへの新規フィールド追加

```ts
// 今回「tableauCardToDiscard(一枚没収)」で場札から取り除かれたカードの位置。
// 個別移動アニメーションの起点(該当マス目)を特定するために使う。
tableauCardRemoved?: { colIndex: number; rowIndex: number; card: Card }
```

`applyTableauCardToDiscard`は、取り除く前の`pick.ci`・`pick.ri`・`card`を返り値に追加する。

### PlayArea.svelte側の検知・アニメーション

```ts
} else if (current.id === 'tableauCardToDiscard') {
  if (current.tableauCardRemoved) {
    startTableauCardToDiscardAnimation(current.tableauCardRemoved)
  }
}
```

`startTableauCardToDiscardAnimation`は、既存の`startStockPurgeAnimation`をベースに、起点を`stockButtonEl`固定ではなく`tableauEl.querySelector('[data-drop-col="${colIndex}"][data-drop-row="${rowIndex}"]')`から取得する形に書き換えた新規関数とする。1枚のみの移動のため`DEAL_INTERVAL_MS`間隔の分岐は不要。移動先の捨て札での表示は、対象カードの`faceUp`(常に`true`、場札のカードは表向きのため)を見てフリップ演出を行う(実質、常にフリップ演出になる)。

移動元の場札マス目は、既存の場札描画ロジック上、該当カード除去後の空きマスをどう扱うか(詰める/空けたままにするか)を実装時に既存の場札詰め処理(カードプレイ時の挙動)と同じにする。

## 技術設計D: tableauShuffleの全カード裏向きシェイク→めくり直し

### 演出内容

場札は既存データ構造上「裏向き」という状態を個別カードが持てる(`Card.faceUp`)ため、`tableauShuffle`発動時は以下の流れにする:

1. 場札の全マス目にある全カードが、演出上一斉に裏向き表示へ切り替わり、短く左右にシェイクする(CSSクラスは`shidasu-numeric-shake`とは別に、場札カード用の新規クラスとして定義する。既存の`shidasu-seal-flash`・`shidasu-numeric-shake`と同じ`sabotageAnimations.css`にまとめる)。
2. シェイク終了と同時に、新しい配置(シャッフル後の`wave.tableau`)へ切り替わる。この際、各カードは自身の`card.faceUp`を見て、`true`ならフリップ演出(裏→表)、`false`なら位置移動のみで裏向きのまま据え置く(既存の`startStockPurgeAnimation`と同じ「最後の1枚のfaceUpを見て分岐する」考え方を、対象マス目すべてに適用する)。

このデータ上「裏向き」という状態を持たないカードも演出上一時的に裏向き表示にする点は、CLAUDE.mdに記載の「場札・捨て札系の一部候補は『裏向きで再配布』という表現を使っている。データ構造自体には裏向き状態は無いが、プレイヤー体感としての表現」という既存の考え方(候補一覧ドキュメント参照)と整合する。

### SabotageResultへの新規フィールドは不要

`tableauShuffle`は常に場札全体が対象であり、対象を特定するための追加情報は不要。既存の`lastSabotage.id === 'tableauShuffle'`の判定のみでアニメーションを開始できる。

```ts
} else if (current.id === 'tableauShuffle') {
  startTableauShuffleAnimation()
}
```

`startTableauShuffleAnimation`は新規関数。場札の全マス目を対象に、まず「裏向き+シェイク」用の一時フラグ(`tableauShuffleActive`)を同期的に`true`にし、CSS遷移でシェイクを表示、一定時間後に新しい`wave.tableau`の内容へ実データが既に切り替わっている状態を反映する形で表示を更新する。

## 技術設計E: chainShuffleのチェーンエリアシェイク

### 演出内容

既存の「山札攪拌」(`startStockShuffleAnimation`)と全く同じパターンを、対象を`chainAreaEl`に変えて適用する。個々のカード位置は動かさず、チェーンエリア全体が短く左右にシェイクするだけ。シェイク終了と同時に新しい並び(新`foundation`)へパッと切り替わる。

### SabotageResultへの新規フィールドは不要

`tableauShuffle`と同様、対象は常にチェーン全体であり追加情報は不要。

```ts
} else if (current.id === 'chainShuffle') {
  startChainShuffleAnimation()
}
```

`startChainShuffleAnimation`は`startStockShuffleAnimation`とほぼ同型の新規関数(対象要素と`xxxActive`フラグ名のみ異なる)。

## テスト方針

- エンジンレベル: `applyDiscardErase`・`applyDiscardBury`が正しい`redistributedAreas`を返すこと、`applyTableauCardToDiscard`が正しい`tableauCardRemoved`(位置・カード)を返すこと、`applyChainPartialDiscard`発動後の`wave.chain`が期待通り(先頭2枚除去、残りは順序維持)であることをテストする。
- `PlayArea.svelte`内の`resetCards`計算(技術設計A)はコンポーネント内のプライベートなロジックであり、このプロジェクトはコンポーネント単体のロジックを直接ユニットテストする方針を取っていない(既存の`PlayArea.svelte`にも専用テストファイルが無い)。そのため専用テストは追加せず、目視確認(下記デバッグ画面確認)でカバーする。ただし修正のロジック自体(`previousChainCards.filter(card => !currentChainCards.some(c => c.id === card.id))`)は単純な配列演算のため、実装時にコード上のコメントで具体例(本設計の技術設計Aに記載したシミュレーション)を残し、レビュー時に検証しやすくする。
- デバッグ画面(`/admin/shidasu-debug`)で7つ全ての妨害行動を目視確認する。デバッグ画面には通貨・レリック所持の制約(グループEで既知)はあるが、チェーン・場札・捨て札・山札は表示・操作可能なため、7個すべて目視確認できる見込み。

## スコープ外

- `rewardReduce`(報酬減少): 既にスコープ外として確定済み(常設表示が無いため)。
- グループA〜Eで既に実装済みの妨害行動には手を加えない。
