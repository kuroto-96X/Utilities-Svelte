# Shidasu 護符候補一覧グループ9〜16の実装(残り20個)

## 0. 背景・目的

`docs/shidasu-gofu-candidates.md`のグループ9〜16(合計24個)のうち、永続デッキ基盤に依存していた4個(永劫・豊穣・静寂・不屈)は`docs/superpowers/specs/2026-07-14-shidasu-persistent-deck-discard-design.md`のサブプロジェクトで実装済み。本specは残り20個(グループ9・10・11・12の全部、グループ13の残り3個、グループ14・15・16)を対象とする。

## 1. アーキテクチャ拡張

### 1.1 `WaveState`への新規フィールド追加

```ts
export interface WaveState {
  // ...既存(discardPile等)
  lastPlayedColumn: number | null      // 微風・共鳴用: 直前にプレイした列番号
  sameColumnStreak: number             // 微風・共鳴用: 同一列連続回数(1回目は1、以後連続でインクリメント)
  maxComboThisWave: number             // 琥珀用: ウェーブ内で過去に到達した最大コンボ数
  totalColumnsEmptiedThisWave: number  // 蒼穹用: ウェーブ内で列一掃が発生した累計回数
  roleFiredThisChain: boolean          // 冷静用: 現在のチェーン中に一度でも役ボーナスが成立したか
  drawContinueCountThisChain: number   // 直感用: 現在のチェーン中に山札めくりでコンボ継続した回数(プレイを挟んでも加算され続け、コンボ/チェーンのリセットでのみ0に戻る)
  flushActiveThisCombo: boolean        // 情熱用: 現在のコンボ中にフラッシュが成立したか
  columnSweepActiveThisWave: boolean   // 闘志用: このウェーブ中に列一掃が一度でも発生したか
  benevolenceUsedThisCombo: boolean    // 博愛用: 現在のコンボで無効化を既に使ったか
}
```

いずれも`startWave`で初期化(`null`/`0`/`false`)し、`playCard`・`drawStock`の中で更新する。`sameColumnStreak`/`roleFiredThisChain`/`drawContinueCountThisChain`/`flushActiveThisCombo`/`benevolenceUsedThisCombo`はコンボリセット(`drawStock`の非継続分岐)で再初期化する。`maxComboThisWave`/`totalColumnsEmptiedThisWave`/`columnSweepActiveThisWave`はウェーブ全体で持続する。`drawContinueCountThisChain`は`drawStock`のパターン継続分岐でのみ+1され、`playCard`(通常のプレイ)では変化しない(プレイを挟んでも値は保持される)。

### 1.2 `ITEM_EFFECTS`に直接点チャンネルを追加

```ts
type Channel = 'gained' | 'clearBonus' | 'resetDirect' | 'stockEmptyDirect' | 'comboMilestoneDirect' | 'drawContinueDirect'
```

- `resetDirect`: `drawStock`でコンボリセットが発生した瞬間に発火(沈着・冷静・残響)。加点は`score`に直接加算し、コンボ倍率の影響を受けない。
- `stockEmptyDirect`: `drawStock`で山札の残り枚数が0になった瞬間に発火(慢心)。
- `comboMilestoneDirect`: `playCard`でコンボ数がちょうど`c`に到達した瞬間に発火(流星)。1ウェーブ中に複数回到達すれば複数回発動しうる。
- `drawContinueDirect`: `drawStock`でパターン継続めくりが成立した瞬間に発火(誠実)。

各チャンネル用に既存の`ItemEffectContext`とは別の軽量なコンテキスト型を用意する:

```ts
interface DirectEffectContext {
  comboBeforeReset: number       // resetDirect用: リセット前のコンボ数(残響が使用)
  hasPlayableColumns: boolean    // resetDirect用: リセット後に取れる場札があるか(沈着が使用)
  roleFiredThisChain: boolean    // resetDirect用: リセットされるチェーンで役が成立していたか(冷静が使用)
  remainingTableauCount: number  // stockEmptyDirect用: 場札の残り枚数(慢心が使用)
  combo: number                  // comboMilestoneDirect用: 到達したコンボ数
  colorHeld: boolean             // drawContinueDirect用: 同色パターンで継続したか(誠実が使用、同スートでは発動しない)
}
```

`applyItemEffects`と同型の`applyDirectEffects(channel, items, ctx, params)`関数を新設し、加点合計を`score`に直接足し込む(`gained`のような`multiplier`は経由しない)。

### 1.3 素朴・直感: 山札めくりの得点ルール変更

`items.includes('naive')`かつパターン継続めくりが成立した場合、`drawStock`内で`playCard`と同じ得点計算(基礎点・チェーンボーナス・護符効果・コンボ加算)を適用する。既存の「めくりは得点0・コンボ据え置き」という基本ルールに対する唯一の例外として、コードコメントで明記する。

直感(`intuition`)は、この`naive`が有効な得点計算パス内でのみ`drawContinueCountThisChain`を参照する倍率護符として実装する(`naive`を持たない場合、山札めくりの得点計算自体が発生しないため実質無効)。`drawContinueCountThisChain`は「現在のチェーン中に山札めくりでコンボ継続した回数」を表す累計カウンタで、`drawStock`のパターン継続分岐が発火するたびに+1される。連続しためくりだけでなく、間にプレイを挟んでも値は保持されたまま加算され続け、コンボ/チェーンがリセットされた時のみ0に戻る。

### 1.4 約束: 山札の並べ替え

`items.includes('promise')`の場合、山札を構築・更新するたび(`startWave`の配布直後、および`drawStock`の各分岐の直後)に、山札の末尾(次にめくられる位置)を「今のチェーンが継続できるカード」に並べ替える後処理を挟む。`stock`配列を先頭から走査し、`chainContinuesPattern`を満たす最初のカードを見つけて末尾と交換する。継続可能な候補が無ければ何もしない。

### 1.5 暗雲: 場札の追加配布

`startWave`で`items.includes('darkClouds')`の場合、各列に配る枚数を`rows`から`rows + params.talismans.darkClouds.r`に変更する。

### 1.6 博愛: コンボリセットの無効化

`drawStock`の非継続分岐(本来リセットする箇所)で、`items.includes('benevolence') && !wave.benevolenceUsedThisCombo`の場合、リセットせずパターン継続と同じ扱いにする(得点は発生しない。既存の「パターン継続時は得点0」という仕様と同じ)。`benevolenceUsedThisCombo`を`true`にする。この無効化を使った場合、実際にリセットされるまで再度は使えない。

### 1.7 治癒・再生: 捨て札からの復活

**治癒**: `playCard`で列一掃ボーナスが成立した(`sweepQualifies`)場合、`items.includes('healing')`かつ`wave.discardPile`が1枚以上あれば、`discardPile`から最大`rows`枚をランダムに引き、空になった列へ戻す(積む)。`discardPile`の残り枚数がそれ未満なら、あるだけ戻す。

**再生**: `playCard`で全消し(`remaining === 0`)が成立した場合、`items.includes('regeneration')`かつ`wave.discardPile`が1枚以上あれば、現在のスコアの`p`%を消費し、`discardPile`から最大`cols × rows`枚をランダムに引いて各列に`rows`枚を上限に再配布する。この復活によって場札が1枚でも戻れば、ウェーブは**終了させず**`status: 'playing'`のまま続行する(全消しボーナス自体は通常通り加算する)。`discardPile`が空の場合は、復活は起こらず通常通り全消し終了になる。

### 1.8 導き: UI表示のみ

`wave.stock[wave.stock.length - 1]`が既に「次にめくられるカード」を表しているため、新規のゲームロジックは不要。`items.includes('guidance')`の場合にゲーム画面側でこの値を表示するだけのUI変更で完結する。

## 2. 対象20護符の仕様

### グループ9(2個)

| 護符名 | id | チャンネル | 条件・数式 | 既定値 |
|---|---|---|---|---|
| 微風 | `gentleBreeze` | gained加算 | `sameColumnStreak >= 2`のとき `v + sameColumnStreak × n` | n=100 |
| 共鳴 | `resonance` | gained倍算 | `sameColumnStreak >= 2`のとき `v × (1 + sameColumnStreak × x)` | x=0.3 |

### グループ10(2個)

| 護符名 | id | チャンネル | 条件・数式 | 既定値 |
|---|---|---|---|---|
| 蒼穹 | `azureSky` | gained倍算 | `v × (1 + totalColumnsEmptiedThisWave × x)` | x=0.3 |
| 琥珀 | `amber` | gained倍算 | `v × (1 + maxComboThisWave × x)` | x=0.1 |

### グループ11(5個)

| 護符名 | id | チャンネル | 条件・数式 | 既定値 |
|---|---|---|---|---|
| 沈着 | `composure` | resetDirect | `!hasPlayableColumns`のとき `+n` | n=500 |
| 冷静 | `clarity` | resetDirect | `!roleFiredThisChain`のとき `+n` | n=500 |
| 慢心 | `arrogance` | stockEmptyDirect | `+remainingTableauCount × x` | x=50 |
| 残響 | `echo` | resetDirect | `+comboBeforeReset × n` | n=200 |
| 流星 | `shootingStar` | comboMilestoneDirect | `combo === c`のとき `+n` | c=10, n=1000 |

### グループ12(3個)

| 護符名 | id | チャンネル | 条件・数式 | 既定値 |
|---|---|---|---|---|
| 素朴 | `naive` | ルール変更 | パターン継続めくりを通常プレイと同じ得点計算にする | パラメータ無し |
| 直感 | `intuition` | gained倍算 | (`naive`有効時のみ意味を持つ)`drawContinueCountThisChain > 0`のとき `v × (1 + drawContinueCountThisChain × x)` | x=0.3 |
| 誠実 | `sincerity` | drawContinueDirect | `colorHeld`のとき `+n` | n=300 |

### グループ13残り(3個)

| 護符名 | id | チャンネル | 条件・数式 | 既定値 |
|---|---|---|---|---|
| 約束 | `promise` | ルール変更 | 山札の次のカードを継続可能なカードに並べ替える | パラメータ無し |
| 暗雲 | `darkClouds` | ルール変更 | ウェーブ開始時、各列の配布枚数を`rows + r`にする | r=1 |
| 再生 | `regeneration` | ルール変更 | 全消し時、スコアの`p`%を消費し捨て札から場札を復活(復活すればウェーブ継続) | p=50 |

### グループ14(2個)

| 護符名 | id | チャンネル | 条件・数式 | 既定値 |
|---|---|---|---|---|
| 博愛 | `benevolence` | ルール変更 | コンボごとに1回、リセットを無効化(継続扱い) | パラメータ無し |
| 治癒 | `healing` | ルール変更 | 列一掃時、捨て札から最大rows枚を空いた列へ戻す | パラメータ無し |

### グループ15(1個)

| 護符名 | id | 既定値 |
|---|---|---|
| 導き | `guidance` | パラメータ無し(UI表示のみ) |

### グループ16(2個)

| 護符名 | id | チャンネル | 条件・数式 | 既定値 |
|---|---|---|---|---|
| 情熱 | `passion` | gained倍算 | `flushActiveThisCombo`のとき `v × x` | x=1.5 |
| 闘志 | `fightingSpirit` | gained倍算 | `columnSweepActiveThisWave`のとき `v × x` | x=1.3 |

## 3. 既存システムへの影響

- `ItemId`に20個のidを追加(既存59個と合わせて計79種類)。
- `ITEM_POOL`・`ITEM_NAMES`・`itemDesc`に20個追加。
- `WaveState`に9個の新規フィールドを追加(1.1節)。`startWave`・`makeWave`テストヘルパーの初期化が必要。
- `ITEM_EFFECTS`のチャンネル型に4種類追加、`applyDirectEffects`関数を新設。
- `playCard`に以下の配線を追加: `sameColumnStreak`/`roleFiredThisChain`/`flushActiveThisCombo`の更新、`comboMilestoneDirect`の発火、列一掃時の`totalColumnsEmptiedThisWave`更新・治癒の復活処理、全消し時の再生の復活処理(ウェーブ終了判定への影響を含む)。
- `drawStock`に以下の配線を追加: リセット時の`resetDirect`発火・`maxComboThisWave`更新・博愛の無効化判定、パターン継続時の`drawContinueDirect`発火・`drawContinueCountThisChain`更新、山札切れ時の`stockEmptyDirect`発火、素朴によるめくり得点計算の分岐、約束による山札並べ替え。
- `startWave`に暗雲の配布枚数変更、約束の初期並べ替えを追加。
- ゲーム画面(`+page.svelte`)に導きのUI表示(次の山札カードの表示)を追加。

## 4. スコープ外

- グループ17以降(コアパラメータ書き換え・判定ロジック変更・デメリット付き護符など)
- 治癒・再生の復活で、捨て札が「元は同じ列にあったカードか」等の厳密な出自追跡(不屈と同じく、枚数ベースの近似で扱う)
- 数値バランス調整(既定値は仮置き)

## 5. 受け入れ基準

1. 微風・共鳴は同一列を連続でプレイした2回目以降のみ発動し、連続回数が増えるほど加点/倍率が上がる
2. 蒼穹・琥珀はウェーブ内の累積値(列一掃数・最大コンボ数)に応じて倍算する
3. 沈着・冷静・残響・流星・慢心・誠実がそれぞれ意図したイベント(リセット/コンボ到達/山札切れ/パターン継続めくり)で直接点として加算される
4. 素朴を持つと山札めくりのパターン継続時にも通常プレイと同じ得点計算が行われ、直感はその中でのみ倍率として機能する
5. 約束を持つと、山札の次のカードが継続可能なカードに(可能な限り)並べ替えられている
6. 暗雲を持つとウェーブ開始時の場札が`rows + r`枚配られる
7. 博愛はコンボごとに1回だけリセットを無効化する
8. 治癒は列一掃時に捨て札から列を復活させ、再生は全消し時に捨て札から場札を復活させてウェーブを継続させる(捨て札が無ければ通常通り)
9. 導きを持つと山札の次のカードがUIに表示される
10. 情熱・闘志はそれぞれのフラグが立っている間、倍算が適用される
11. `npm run test`・`npm run build`が成功する
