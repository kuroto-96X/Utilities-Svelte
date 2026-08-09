# 天啓 Phase A(カード変換・場札操作系8個)実装設計

## 背景

`docs/shidasu/shidasu-revelation-candidates.md`で検討した天啓候補33個のうち採用15個を、実装しやすさで2フェーズに分割した(2026-08-09)。

- **Phase A(本ドキュメント)**: カード変換・場札操作系8個。既存の`convertColumnToSuit`等のパターンを拡張すれば実装できる、リスクの低いグループ
- **Phase B(別セッション)**: 即時報酬獲得系7個。使用履歴の追跡や、他カテゴリ(護符・秘儀・神託)の所持枠操作という新規基盤が必要なグループ

対象は候補No.2・4・5・8・9・25・28・31の8個。

## 新規インフラ: `DeckCard.removed`

候補8「全列トップ廃棄」は、初めて「デッキから永久にカードを取り除く」効果になる。素朴に`deckComposition`配列から要素を削除(`splice`/`filter`)すると、新規カード追加時の採番ロジックが壊れる。

現在、`deckComposition`への新規カード追加は以下3箇所で「配列の現在の長さ」を新しい`deckId`として採番している(コメントで「エントリが削除されることは無いため長さは単調増加でid衝突しない」ことを前提にしている)。

- `deck.ts:32`(`addCardsToDeckComposition`、トランプセット福袋用)
- `engine.ts:143`(永劫アイテムの新規ワイルド追加)
- `revelationEffects.ts:73`(`addWildToColumnTop`、危(aya)天啓用)

配列を縮めるとこの前提が崩れ、新規追加時に既存カードと同じ`deckId`が採番される(衝突する)リスクがある。

**対策**: `DeckCard`に`removed: boolean`を追加する。「廃棄」は要素を削除せず`removed: true`をセットするだけにする。配列の長さは変化しないため、上記3箇所の採番ロジックはそのまま安全に動く。

### 変更箇所

- `types.ts`: `DeckCard`に`removed: boolean`を追加
- `deck.ts`: `standardDeckComposition()`・`addCardsToDeckComposition()`が生成する全エントリに`removed: false`を設定
- `engine.ts:143`(永劫の新規エントリ)・`revelationEffects.ts:73`(`addWildToColumnTop`の新規エントリ)にも`removed: false`を追加
- `engine.ts`の`startWave`(149行目付近、`shuffle(composition.map(...))`): シャッフル前に`composition.filter(c => !c.removed)`で除外してからCard化する
- `engine.ts`の剛毅(fortitude)計算(166行目付近、`composition.length`を使用): 同様に`removed`を除いた枚数を使う

## 天啓候補ごとの実装方針

未使用宿(16個)のうち8個を割り当てる。既存12宿のRevelationId(`kaku`等)や、同じ16宿内での読みの重複(例: 昴と房が同じ「ぼう」)を避け、重複の無い読みを持つ8宿を選んだ。残り8宿(昴・参・鬼・柳・星・張・翼・軫)はPhase B用に温存する。

### No.2 隣列連鎖変換 → 室(しつ、id: `shitsu`)

対象選択: 列を1つ選ぶ(`revelationNeedsTarget`に追加)。

選択列の各カード(配列インデックス`i`ごと)を、1つ左の列の同じインデックス`i`のカードのランク+1(13→1のA⇔Kループ)に変換する。左端の列を選んだ場合、参照先は右端の列にする。

- 選択列側がワイルドの位置`i`はスキップ(変換しない)
- 参照列側(左列)がワイルドの位置`i`もスキップ(参照ランクが無意味なため)
- 参照列の方が短い場合、はみ出した位置(`i >= 参照列の長さ`)は変換しない
- `wave.tableau`と`deckComposition`の両方を書き換える(既存の`convertColumnToRandomRank`と同じdeckId対応の書き方)

```
関数シグネチャ案: convertColumnChainFromLeft(wave, deckComposition, colIndex) => { wave, deckComposition }
```

### No.4 4色循環変換 → 壁(へき、id: `heki`)

対象選択: なし(場札全体)。

`♠→♥→♣→♦→♠`の対応表(`{ '♠': '♥', '♥': '♣', '♣': '♦', '♦': '♠' }`)を1つ作り、場札全体の非ワイルドカードを「変換前のスート」を基準に1回だけ引いて変換する(逐次適用しないためカスケードが起きない)。既存の`convertTableauSuit`とは違い、1回のパスで4スート同時に変換する新規関数が必要。

### No.5 階段整列 → 奎(けい、id: `kei`)

対象選択: なし(場札全体)。

空でない列を左から順に走査する。最初に見つかった空でない列の一番上のカードのランクを起点(`base`)とし、`i`番目(0始まり、空列を除いた順番)の空でない列の一番上のカードを`base + i`(A⇔Kループ)に変換する。

- 空の列はカウントしない(スキップして番号を進めない)
- 一番上がワイルドの列は変換しない(ただし列としての順番はカウントする)

### No.8 全列トップ廃棄 → 婁(ろう、id: `rou`)

対象選択: なし(場札全体)。

各列の一番上のカード(ワイルドを含む)を「廃棄」する。空の列はスキップする。

- `wave.tableau`から対象カードを取り除く(該当列の末尾要素をpop)
- `deckComposition`側は該当`deckId`のエントリを`removed: true`にする(削除ではなくフラグ)

### No.9 極値ワイルド化 → 胃(い、id: `i`)

対象選択: なし(場札全体)。

場札の非ワイルド実カードから最大ランクと最小ランクを求める。

1. 最大ランクの該当カードが複数あればランダムに1枚選ぶ(target1)
2. 最小ランクの該当カード(target1を除く)からランダムに1枚選ぶ(target2)。候補が無ければtarget1のみ変換
3. target1・target2を`wild: true`に変換(既存の`convertCardToWildByDeckId`と同様、スート・ランクの値は保持したまま`wild`フラグのみ立てる)。`wave.tableau`・`deckComposition`の両方を更新

### No.25 雷光 → 畢(ひつ、id: `hitsu`)

対象選択: 列を1つ選ぶ(`revelationNeedsTarget`に追加)。

秘儀「雷光(raidho)」(`riteEffects.ts`の`applyRaidho`)と同じアルゴリズムを流用する: 選択列の先頭カードのランクを起点に、使用ごとにランダムな方向(昇順/降順)で階段状に再配置する。秘儀版との違いは、`deckComposition`側にも書き込んで効果を永続化する点(秘儀は`wave`のみ書き換えるため次ウェーブで元に戻る)。

### No.28 対話 → 觜(し、id: `shi`)

対象選択: なし(チェーン末尾を自動対象)。

秘儀「対話(perthro)」(`riteEffects.ts`の`applyPerthro`)と同じ効果: `wave.chain`の末尾1枚を`wild: true`に変換し、`foundation`も更新する。チェーンが空の場合は何もしない(既存秘儀と同じ安全なno-op)。秘儀版との違いは`deckComposition`側も書き換えて永続化する点。

### No.31 賜物 → 井(せい、id: `sei`)

対象選択: なし(場札全体からランダム)。

秘儀「賜物(ansuz)」(`riteEffects.ts`の`applyAnsuz`)と同じ方式で、場札の非ワイルド実カードからランダムに`n`枚選んでワイルド化する。天啓版は永続効果(デッキの実カードが減る)になるため、秘儀版のn=3より小さいn=1で実装する(`params.revelations.sei.n = 1`)。`revelationNeedsTarget`には追加しない(列選択不要、場札全体からランダム抽選)。

## 実装対象ファイル

- `types.ts`: `RevelationId`に8個追加(`shitsu`,`heki`,`kei`,`rou`,`i`,`hitsu`,`shi`,`sei`)、`DeckCard.removed: boolean`追加
- `revelations.ts`: `REVELATION_POOL`に8個追加
- `revelationEffects.ts`: 新規変換関数8個の追加、`revelationNeedsTarget`に`shitsu`・`hitsu`を追加、`canUseRevelation`は追加条件なし(全候補とも対象が無ければ安全にno-op)
- `params.ts`: `ShidasuParams['revelations']`の型に8エントリ追加(`sei`のみ`n: number`を持つ)
- `shidasu.config.json`: `revelations`に8エントリ追加(name=宿の漢字、desc)
- `deck.ts`: `standardDeckComposition`・`addCardsToDeckComposition`の生成エントリに`removed: false`を追加
- `engine.ts`: `startWave`のシャッフル前フィルタ追加、剛毅計算の修正、永劫の新規エントリに`removed: false`追加
- 各種テスト: `revelationEffects.test.ts`に新規関数8個分のユニットテスト、`deck.test.ts`・`engine.test.ts`に`removed`フラグ関連のテストを追加

## テスト方針

既存の`revelationEffects.test.ts`のパターン(各変換関数について、対象カードが正しく変換されること・`deckComposition`が同期されること・ワイルド/対象外カードが変換されないことを確認)を踏襲する。「廃棄」については、`removed: true`になったカードが次ウェーブの配布(`startWave`)で二度と出現しないことを確認するテストを追加する。

## スコープ外(Phase B)

即時報酬獲得系7個(候補13・15・16・17・18・19・23)は別セッションでbrainstormingする。使用履歴追跡(直前に使った天啓/秘儀の記録)、護符・天啓・秘儀・神託の所持枠を横断的に操作する仕組みが新規基盤として必要。
