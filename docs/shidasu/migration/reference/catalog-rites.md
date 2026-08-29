# 秘儀(Rite)カタログ

Shidasu → Godot移植プロジェクト フェーズ1(現状仕様の資料化)成果物。

- 件数: **24件**(`src/lib/game/shidasu/types.ts`の`RiteId`型ユニオンメンバー数、`rites.ts`の`RITE_POOL`要素数、`shidasu.config.json`の`rites`キー数のすべてで一致を確認済み)
- 秘儀はプレイ中に能動的に使用する消費アイテムで、**効果適用(`applyRiteEffect`)は`WaveState`のみを書き換える**(`deckComposition`は書き換えない)。
- 所持上限は基本3(レリック「破魔矢」所持時は拡張。`riteMaxCapacity`、`src/lib/game/shidasu/relics.ts`)。同じ種類を複数所持できる。
- 使用時の共通処理(`useRite`、`src/lib/game/shidasu/engine.ts`):
  1. `canUseRite`で使用可否を判定(下表の「使用条件」列を参照。個体が妨害「封印系」で`activeSeal.kind==='rite'`かつ`instanceId`一致の場合は常に使用不可)
  2. `applyRiteEffect`で対象秘儀の効果を`WaveState`に適用
  3. 護符「果断」「星霜」所持時、`WaveState.discretionN`/`frostX`にそれぞれ`params.talismans.discretion.n`/`params.talismans.frost.x`を加算(`applyDiscretionFrostBonus`。全秘儀共通の副作用であり、個別の秘儀効果ではない)
  4. `dagaz`のみ、山札シャッフル演出用に`WaveState.lastStockShuffle.seq`をインクリメント
  5. `RunState.rites`から使用した個体を除去し、`RunState.recentUsedRiteIds`(最新2件、天啓「参(karasu)」が参照)の先頭に追加
  6. 護符「両替」所持時、`RunState.items`中の両替インスタンスの`sellBonus`に`params.talismans.exchange.n`を加算(`applyExchangeBonus`。これも全秘儀共通の副作用)
- 抽選は`RITE_POOL`(24種)からの完全均等抽選(`rollRite`/`rollRiteOffer`)。重み付けなし、所持中の種類も除外しない。

以下、`RITE_POOL`(＝`rites.ts`)の掲載順に全24件を記載する。効果の自然文記述は`riteActualEffects.ts`の`RITE_ACTUAL_EFFECTS`(実装を正とする開発者向け監査コメント)と`riteEffects.ts`本体を突き合わせて記述している。

---

## 1. raidho(ᚱ)

- **ID**: `raidho`
- **名称**: `ᚱ`(`shidasu.config.json` `rites.raidho.name`)
- **効果**: 場札内の非ワイルド・非絵札(J/Q/K以外)カードの位置一覧を記録し、それらのカードを山札と合流させてシャッフルしたうえで、同じ位置に配り直す。絵札・ワイルドは移動しない。あぶれた分(山札に入りきらない分)は新しい山札になる。
- **使用条件**: `canUseRite`で「場札に非ワイルド・非絵札が1枚以上ある」ことが必要(`wave.tableau.some(col => col.some(c => !c.wild && !isFace(c)))`)。
- **関連パラメータ**: なし(数値パラメータを持たない。`shidasu.config.json`は`name`/`desc`のみ)
- **依存State**: `WaveState.tableau`(読み書き)、`WaveState.stock`(読み書き)
- 補足: 2026-08-11に一度削除され、後日別効果で復元された9種の1つ(削除前は現在の天啓「畢(hitsu)」と同じ階段変換効果だった)。

## 2. jera(ᛃ)

- **ID**: `jera`
- **名称**: `ᛃ`
- **効果**: 場札の各列を、列ごとに独立してランダムな方向(昇順/降順)でランク順にソートする。空の列は対象外。ワイルドを含む全カードが対象。
- **使用条件**: 常に使用可(`canUseRite`のdefaultケース)。
- **関連パラメータ**: なし
- **依存State**: `WaveState.tableau`(読み書き)

## 3. wunjo(ᚹ)

- **ID**: `wunjo`
- **名称**: `ᚹ`
- **効果**: 場札の全カードを捨て札(discardPile)に合流させてシャッフルし、各列の現在の枚数を維持したまま先頭から配り直す。あぶれた分は新しい捨て札になる。山札は変更しない。
- **使用条件**: 常に使用可。
- **関連パラメータ**: なし
- **依存State**: `WaveState.tableau`(読み書き)、`WaveState.discardPile`(読み書き)

## 4. othala(ᛟ)

- **ID**: `othala`
- **名称**: `ᛟ`
- **効果**: 山札内で残り枚数が最も多いランク(同数なら候補からランダムに1つ)を選び、そのランクの山札カードをすべて場札に合流させる。場札全体をシャッフルし、列数を変えずに列インデックスのラウンドロビンで配り直す。山札に対象ランクが無い(山札が空)なら何もしない。
- **使用条件**: `canUseRite`で「山札が1枚以上ある」ことが必要(`wave.stock.length > 0`)。
- **関連パラメータ**: なし
- **依存State**: `WaveState.tableau`(読み書き)、`WaveState.stock`(読み書き)
- 補足: 削除→復元済みの9種の1つ。

## 5. perthro(ᛈ)

- **ID**: `perthro`
- **名称**: `ᛈ`
- **効果**: 各列について、現在の枚数が`dealtRows`(そのウェーブの配布行数)未満の分だけ山札の上から補充する。山札が不足すれば補充できる分だけ補充する。
- **使用条件**: `canUseRite`で「山札が1枚以上あり、かつ`dealtRows`未満の列が1つ以上ある」ことが必要。
- **関連パラメータ**: なし
- **依存State**: `WaveState.tableau`(読み書き)、`WaveState.stock`(読み書き)、`WaveState.dealtRows`(読み取りのみ)
- 補足: 削除→復元済みの9種の1つ。

## 6. uruz(ᚢ)

- **ID**: `uruz`
- **名称**: `ᚢ`
- **効果**: 現在のコンボ数に`+n`し、ウェーブ内最大コンボ数(`maxComboThisWave`)もそれに追従して更新する。ただし秘儀「isa」による`comboFrozenThisWave`が有効な間は何も変化しない。
- **関連パラメータ**: `rites.uruz.n`(現在値3)
- **依存State**: `WaveState.combo`(読み書き)、`WaveState.maxComboThisWave`(読み書き)、`WaveState.comboFrozenThisWave`(読み取りのみ、ガード条件)

## 7. ingwaz(ᛜ)

- **ID**: `ingwaz`
- **名称**: `ᛜ`
- **効果**: 基礎コンボ数(`baseComboCount`)に`+n`する。現在のコンボ数(`combo`)自体は変えない。
- **関連パラメータ**: `rites.ingwaz.n`(現在値2)
- **依存State**: `WaveState.baseComboCount`(読み書き)

## 8. gebo(ᚷ)

- **ID**: `gebo`
- **名称**: `ᚷ`
- **効果**: 捨て札をシャッフルし、場札の列数ぶんを各列の一番上に1枚ずつ配置する。捨て札が列数未満なら何もしない(使用不可条件と一致)。
- **使用条件**: `canUseRite`で「捨て札の枚数が列数以上」であることが必要。
- **関連パラメータ**: なし
- **依存State**: `WaveState.discardPile`(読み書き)、`WaveState.tableau`(読み書き)

## 9. fehu(ᚠ)

- **ID**: `fehu`
- **名称**: `ᚠ`
- **効果**: 山札の上から場札の列数ぶんを取り出し、各列の一番上に1枚ずつ配置する。山札の残りが列数以下なら何もしない(使用不可条件と一致)。
- **使用条件**: `canUseRite`で「山札の枚数が列数より多い」ことが必要。
- **関連パラメータ**: なし
- **依存State**: `WaveState.stock`(読み書き)、`WaveState.tableau`(読み書き)

## 10. dagaz(ᛞ)

- **ID**: `dagaz`
- **名称**: `ᛞ`
- **効果**: 山札と捨て札をすべて合わせてシャッフルし、新しい山札にする。捨て札は空になる。使用後、`WaveState.lastStockShuffle.seq`がインクリメントされ、UI側(PlayArea.svelte)で山札の揺れ演出がトリガーされる(妨害行動`stockShuffle`と共通のトリガー)。
- **関連パラメータ**: なし
- **依存State**: `WaveState.stock`(読み書き)、`WaveState.discardPile`(読み書き)、`WaveState.lastStockShuffle`(書き込みのみ、`useRite`側で設定)

## 11. algiz(ᛉ)

- **ID**: `algiz`
- **名称**: `ᛉ`
- **効果**: そのウェーブが終わるまで`playFromAnywhereActiveThisWave`をtrueにする。以後、各列で一番上のカードだけでなく列内の全カードがプレイ対象になる(`isPlayable`判定自体=ランク差等の可否条件は変わらない。対象範囲が拡張されるだけ)。
- **関連パラメータ**: なし
- **依存State**: `WaveState.playFromAnywhereActiveThisWave`(書き込み)

## 12. tiwaz(ᛏ)

- **ID**: `tiwaz`
- **名称**: `ᛏ`
- **効果**: 場札の全列について、配列の並び順を反転させる(一番上と一番下が入れ替わる)。
- **関連パラメータ**: なし
- **依存State**: `WaveState.tableau`(読み書き)
- 補足: 削除→復元済みの9種の1つ(復元後の新効果)。

## 13. laguz(ᛚ)

- **ID**: `laguz`
- **名称**: `ᛚ`
- **効果**: 場札の中で`col.length === 0`の列をランダムに1つ選び、山札の上から`dealtRows`枚まで補充する。0枚の列が無ければ何もしない(使用不可条件と一致)。
- **使用条件**: `canUseRite`で「山札が1枚以上あり、かつ0枚の列が1つ以上ある」ことが必要。
- **関連パラメータ**: なし
- **依存State**: `WaveState.tableau`(読み書き)、`WaveState.stock`(読み書き)、`WaveState.dealtRows`(読み取りのみ)
- 補足: 削除→復元済みの9種の1つ(復元後の新効果)。

## 14. eihwaz(ᛇ)

- **ID**: `eihwaz`
- **名称**: `ᛇ`
- **効果**: コンボリセット防止残り回数(`comboResetShieldRemaining`)に`+n`する。この値が0より大きい間、通常のコンボリセット処理が防止される(1回消費するごとに減算するロジックはengine.ts側のリセット処理にある)。
- **関連パラメータ**: `rites.eihwaz.n`(現在値3)
- **依存State**: `WaveState.comboResetShieldRemaining`(読み書き)

## 15. ansuz(ᚨ)

- **ID**: `ansuz`
- **名称**: `ᚨ`
- **効果**: チェーンの全カードを`discardPile`へ送り、山札から1枚drawして`chain`・`foundation`を差し替える。あわせて`linked`をfalseに、`columnsEmptiedThisCombo`を0に、`comboStreakColumnLengths`を各列の現在枚数で再設定、`drawContinueCountThisChain`/`roleFiredThisChain`/`flushActiveThisCombo`/`sameColumnStreak`をリセットし`lastPlayedColumn`をnullにする。`combo`・`maxComboThisWave`・`baseComboCount`は変更しない。山札が空なら何もしない。
- **使用条件**: `canUseRite`で「山札が1枚以上ある」ことが必要。
- **関連パラメータ**: なし
- **依存State**: `WaveState.stock`(読み書き)、`WaveState.chain`/`chainOrigin`/`foundation`/`linked`/`discardPile`/`columnsEmptiedThisCombo`/`comboStreakColumnLengths`/`drawContinueCountThisChain`/`roleFiredThisChain`/`flushActiveThisCombo`/`sameColumnStreak`/`lastPlayedColumn`(いずれも書き込み)
- 補足: 削除→復元済みの9種の1つ(復元後の新効果。削除前は天啓「觜(shi)」と同じチェーン末尾ワイルド化効果だった)。

## 16. kenaz(ᚲ)

- **ID**: `kenaz`
- **名称**: `ᚲ`
- **効果**: 場札と山札を合流させ、スートごとに枚数を集計してグループ化し、枚数の多いスート順(スート内はシャッフル)に並べた配り札の列を作る。各列の現在の枚数を維持したまま先頭から配り直す。あぶれた分は新しい山札になる。
- **関連パラメータ**: なし
- **依存State**: `WaveState.tableau`(読み書き)、`WaveState.stock`(読み書き)
- 補足: 削除→復元済みの9種の1つ(復元後の新効果)。

## 17. thurisaz(ᚦ)

- **ID**: `thurisaz`
- **名称**: `ᚦ`
- **効果**: `nextPlayScoreMultiplier`を`x`にする。直後の`playCard`1回のみ、得点計算(gained)に追加で`x`倍する乗算ファクターとして作用し、そのプレイが完了した時点で`nextPlayScoreMultiplier`は無条件に1(無効値)へリセットされる。
- **関連パラメータ**: `rites.thurisaz.x`(現在値1.5)
- **依存State**: `WaveState.nextPlayScoreMultiplier`(読み書き)
- 補足: 削除→復元済みの9種の1つ(復元後の新効果)。

## 18. hagalaz(ᚺ)

- **ID**: `hagalaz`
- **名称**: `ᚺ`
- **効果**: 場札の全カードと山札の残りを合流させシャッフルし、各列の現在の枚数を維持したまま先頭から配り直す。余りは新しい山札にする。`foundation`・`chain`・`combo`は変更しない。
- **関連パラメータ**: なし
- **依存State**: `WaveState.tableau`(読み書き)、`WaveState.stock`(読み書き)

## 19. nauthiz(ᚾ)

- **ID**: `nauthiz`
- **名称**: `ᚾ`
- **効果**: `nauthizActiveThisWave`をtrueにする。以後、コンボリセット処理(`resetComboFields`の通常リセット)で`comboFrozenThisWave`がfalseの場合に限り、コンボ再開値を`floor(リセット直前のcombo / 2)`にする(`baseComboCount`は参照しない)。
- **関連パラメータ**: なし
- **依存State**: `WaveState.nauthizActiveThisWave`(書き込み)。効果発動時は`WaveState.combo`(コンボリセット処理側で読み取り・書き込み)、`WaveState.comboFrozenThisWave`(読み取り、ガード条件)

## 20. isa(ᛁ)

- **ID**: `isa`
- **名称**: `ᛁ`
- **効果**: `comboFrozenThisWave`をtrueにする。以後、コンボリセット処理の通常リセット・`playCard`のコンボ加算・`drawStock`の素朴(naive)分岐のコンボ加算をすべて無効化し、`wave.combo`を変化させない。秘儀「nauthiz」より優先される(isa有効時はnauthizの効果は発動しない)。
- **関連パラメータ**: なし
- **依存State**: `WaveState.comboFrozenThisWave`(書き込み)。以後`WaveState.combo`への書き込みを全経路で抑止する形で参照される。

## 21. sowilo(ᛋ)

- **ID**: `sowilo`
- **名称**: `ᛋ`
- **効果**: `sowiloActiveThisWave`をtrueにする(`sowiloBoostedRole`はnullのまま)。以後`playCard`内の役ボーナス倍率計算(roleBonusMultiplier)で、`sowiloBoostedRole`が未確定なら最初に成立した役をその場で`x`倍しつつ記憶し、確定済みならその役が成立するたび常に`x`倍する。`drawStock`の素朴(naive)分岐には(天啓「明星」と同様に)適用されない。
- **関連パラメータ**: `rites.sowilo.x`(現在値2)
- **依存State**: `WaveState.sowiloActiveThisWave`(書き込み)、`WaveState.sowiloBoostedRole`(発動後は`playCard`側が読み書き)

## 22. berkano(ᛒ)

- **ID**: `berkano`
- **名称**: `ᛒ`
- **効果**: 現在のコンボ数を`floor(combo × x)`にする(uruzの乗算版)。`maxComboThisWave`も追従更新する。秘儀「isa」による`comboFrozenThisWave`が有効な間は何も変化しない。
- **関連パラメータ**: `rites.berkano.x`(現在値2)
- **依存State**: `WaveState.combo`(読み書き)、`WaveState.maxComboThisWave`(読み書き)、`WaveState.comboFrozenThisWave`(読み取りのみ、ガード条件)

## 23. mannaz(ᛗ)

- **ID**: `mannaz`
- **名称**: `ᛗ`
- **効果**: `mannazActiveThisWave`をtrueにする。以後`playCard`・`drawStock`の素朴(naive)分岐の得点計算で、コンボ倍率と併せて「1 + (所持護符のレア度重み合計(コモン=1/アンコモン=2/レア=4)) × x」の係数を`gained`に掛ける。
- **関連パラメータ**: `rites.mannaz.x`(現在値0.1)
- **依存State**: `WaveState.mannazActiveThisWave`(書き込み)

## 24. ehwaz(ᛖ)

- **ID**: `ehwaz`
- **名称**: `ᛖ`
- **効果**: `ehwazActiveThisWave`をtrueにする。以後`isPlayable`判定で、既存の許容ランク差`d===1`/`d===12`(ループ)に加え、`d===2`/`d===11`(ループ、星のnoLoop制限がある場合は不可)も許可する。階段パターン判定(`analyzeStair`)には一切影響しない。
- **関連パラメータ**: なし
- **依存State**: `WaveState.ehwazActiveThisWave`(書き込み)

---

## 数値パラメータ一覧(`shidasu.config.json` `rites`セクション)

| ID | パラメータキー | 現在値 | 用途 |
|---|---|---|---|
| uruz | `n` | 3 | コンボ加算量 |
| ingwaz | `n` | 2 | 基礎コンボ加算量 |
| eihwaz | `n` | 3 | コンボリセット防止回数 |
| thurisaz | `x` | 1.5 | 次1プレイの得点乗数 |
| sowilo | `x` | 2 | 役ボーナス倍率 |
| berkano | `x` | 2 | コンボ乗数 |
| mannaz | `x` | 0.1 | 護符レア度重み合計への係数 |

上記以外の17種(raidho/jera/wunjo/othala/perthro/gebo/fehu/dagaz/algiz/tiwaz/laguz/ansuz/kenaz/hagalaz/nauthiz/isa/ehwaz)は数値パラメータを持たず、`name`/`desc`のみ。
