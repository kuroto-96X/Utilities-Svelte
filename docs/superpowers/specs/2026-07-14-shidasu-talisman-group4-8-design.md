# Shidasu 護符候補一覧グループ4〜8の実装(全35個)

## 0. 背景・目的

`docs/shidasu-gofu-candidates.md`のグループ4〜8(合計35個)を実装する。グループ1〜3(18個、実装済み)で構築した`ITEM_EFFECTS`レジストリ・`applyItemEffects`パイプラインをそのまま使う。グループ4〜8はいずれも「新規の永続state追跡が不要」(朝露用の単純フラグ1個を除く)という共通点があり、グループ9以降(列選択連続性・ウェーブ内最大到達値などの複雑な累積stateが必要)より先に着手する。

## 1. アーキテクチャ拡張

### 1.1 `ItemEffectContext`の拡張

既存(グループ1〜3時点):
```ts
interface ItemEffectContext {
  card: Card
  previousFoundation: Card
  combo: number
  stockRemaining: number
}
```

以下を追加する:
```ts
interface ItemEffectContext {
  card: Card
  previousFoundation: Card
  combo: number
  stockRemaining: number
  chain: Card[]                  // 追加: 今回のカードを含むチェーン(chainIncludingThis)
  remainingTableauCount: number  // 追加: このプレイ後の場札総残数
  chainBonus: ChainBonusResult   // 追加: evaluateChainBonusの拡張後の戻り値そのもの
  isFirstPlayOfWave: boolean     // 追加: このプレイがウェーブで最初のプレイかどうか(プレイ前の値)
}
```

`playCard`内で`chainIncludingThis`・`remaining`(既存の全消し判定用変数を流用)・`chainResult`・`wave.firstPlayDone`(更新前の値)はいずれも既に計算済みか取得可能なため、コンテキスト構築時に渡すだけでよい。

### 1.2 `ChainBonusResult`の拡張(グループ6用)

現在:
```ts
interface ChainBonusResult {
  bonus: number
  parts: string[]
}
```

拡張後:
```ts
interface ChainBonusResult {
  bonus: number
  parts: string[]
  patternFired: boolean            // 同スート/同色/階段のいずれかが成立したか
  roleFired: { name: RoleName; usedWild: boolean }[]  // 成立した役ボーナスの一覧
}

type RoleName = 'flush' | 'royalSet' | 'sameRank' | 'completeRun' | 'columnSweep'
```

- `evaluateChainBonus`内で、`checkFlush`/`checkRoyalSet`/`checkCompleteRun`/同ランク判定それぞれについて、成立時に`roleFired`へ追記する。`usedWild`は「実カードだけでは成立条件を満たせず、ワイルドの穴埋めが必要だった場合」に`true`とする(例: `checkFlush`なら`missingSuits`(ワイルド適用前の不足スート数)が0より大きければワイルド起因)。
- `patternFired`は`suitHeld`または`colorHeld`が成立した場合(既存の`同スート`/`同色`パートが追加される条件と同一)、または階段ボーナスが成立した場合に`true`。
- 列一掃ボーナス(`columnSweep`)は`evaluateChainBonus`の外(`playCard`内の列一掃判定)で発生するため、`playCard`側で`chainResult.roleFired`に`{name: 'columnSweep', usedWild: false}`を後から追加してから`ItemEffectContext`に渡す。

### 1.3 `WaveState.firstPlayDone: boolean`の新規追加(朝露用)

- `createWave`で`false`初期化。
- `playCard`内で、コンテキスト構築時に**更新前の値**を`isFirstPlayOfWave`として渡した後、返り値の新しい`WaveState`では`firstPlayDone: true`にセットする(既に`true`なら変化なし)。

### 1.4 新規ヘルパー関数(輪廻・威光用)

```ts
// 階段のチェーンが13→1、または1→13の境界を跨いだか(ワイルドで橋渡しされた区間内の越境も検出する)
function stairUsesKALoop(chain: Card[]): boolean {
  const analysis = analyzeStair(chain)
  if (!analysis.held || analysis.dir === 0) return false
  const realPositions = chain.map((c, i) => ({ card: c, index: i })).filter(p => !p.card.wild)
  if (realPositions.length < 2) return true // 比較対象の実カードペアが無く矛盾しないため、都合よく成立とみなす
  for (let k = 1; k < realPositions.length; k++) {
    const prev = realPositions[k - 1]
    const curr = realPositions[k]
    const gap = curr.index - prev.index
    if (analysis.dir === 1 && prev.card.rank + gap > 13) return true
    if (analysis.dir === -1 && prev.card.rank - gap < 1) return true
  }
  return false
}
```

隣接する実カードペアの生rankを直接比較する方式ではなく、`analyzeStair`と同じ「gap分ステップして境界を跨ぐか」という算術判定にすることで、ワイルドで橋渡しされた区間内で境界を跨ぐケースも正しく検出する。

## 2. ワイルドの解釈方針(全項目共通)

`analyzeStair`/`analyzeSuitColor`/`checkFlush`等で既に採用されている「ワイルドは母数に含め、都合の良い値として読む」という方針を、グループ4〜8の全ての条件判定に一貫して適用する。

| パターン | 解釈 |
|---|---|
| スート/色の専有条件(深緑・宝石・真剣・聖杯・月光・陽光) | 矛盾する実カードが1枚も無ければ成立(全ワイルドでも成立) |
| 枚数カウント条件(王冠・青葉・硬貨・武器・献杯) | `実カードの該当枚数 + ワイルド枚数`をそのままカウントする |
| 赤黒同数条件(均衡・調和) | `\|実赤枚数 - 実黒枚数\| <= ワイルド枚数`なら、ワイルドの振り分けで同数にできるとみなし成立 |
| K/A遷移条件(循環) | `previousFoundation`・`card`それぞれについて「Kとみなせるか(本体 or ワイルド)」「Aとみなせるか(本体 or ワイルド)」を判定し、複合条件で成立とする |
| K↔Aループ条件(輪廻・威光) | 上記1.4の`stairUsesKALoop`で判定(ワイルド橋渡し区間の越境も検出) |
| 既存フラグ再利用(高潔・執念・覚悟) | `analyzeSuitColor`/`analyzeStair`が元々ワイルド都合解釈済みのため変更不要 |

## 3. 対象35護符の仕様

### グループ4(24個)

| 護符名 | id | チャンネル | 条件・数式 | 既定値 |
|---|---|---|---|---|
| 平穏 | `calm` | gained加算 | チェーン内にJQKが無い `v + n` | n=200 |
| 安寧 | `serenity` | gained倍算 | チェーン内にJQKが無い `v × x` | x=1.5 |
| 運命 | `destiny` | gained加算 | チェーン内がJQKのみ `v + n` | n=300 |
| 宿命 | `fate` | gained倍算 | チェーン内がJQKのみ `v × x` | x=2.0 |
| 安堵 | `relief` | gained加算 | **今回プレイした1枚**のランクが1〜10 `v + n`(※チェーン全体ではなく単体カード条件。平穏との違いを明確化するための設計判断) | n=100 |
| 深緑 | `verdantGreen` | gained倍算 | チェーンが♣専有 `v × x` | x=3 |
| 宝石 | `gem` | gained倍算 | チェーンが♦専有 `v × x` | x=3 |
| 真剣 | `resolve` | gained倍算 | チェーンが♠専有 `v × x` | x=3 |
| 聖杯 | `grail` | gained倍算 | チェーンが♥専有 `v × x` | x=3 |
| 月光 | `moonlight` | gained倍算 | チェーンが黒専有 `v × x` | x=1.5 |
| 陽光 | `sunlight` | gained倍算 | チェーンが赤専有 `v × x` | x=1.5 |
| 王冠 | `crown` | gained倍算 | `v × (1 + K枚数 × x)` | x=0.5 |
| 青葉 | `cloverLeaf` | gained加算 | `v + ♣枚数 × n` | n=50 |
| 硬貨 | `coin` | gained加算 | `v + ♦枚数 × n` | n=50 |
| 武器 | `blade` | gained加算 | `v + ♠枚数 × n` | n=50 |
| 献杯 | `chalice` | gained加算 | `v + ♥枚数 × n` | n=50 |
| 均衡 | `balance` | gained加算 | 赤黒同数(ワイルド調整可) `v + n` | n=200 |
| 調和 | `harmony` | gained倍算 | 赤黒同数(ワイルド調整可) `v × x` | x=1.5 |
| 高潔 | `nobility` | gained加算 | 同スートパターン成立 `v + n` | n=200 |
| 執念 | `tenacity` | gained倍算 | 同スートパターン成立 `v × (1 + チェーン長 × x)` | x=0.1 |
| 覚悟 | `determination` | gained倍算 | 階段成立 `v × (1 + 階段長 × x)` | x=0.1 |
| 循環 | `cycle` | gained倍算 | 直前→今回がK→AまたはA→K(ワイルド都合解釈) `v × x` | x=3 |
| 輪廻 | `reincarnation` | gained倍算 | コンプリートラン成立 かつ 階段成立 かつ K↔Aループ越え `v × x` | x=10 |
| 威光 | `majesty` | gained倍算 | コンプリートラン成立 かつ 階段成立 かつ 同スート専有 `v × x` | x=50 |

「JQKが無い/のみ」は`chain`内の実カードのみで判定する(ワイルドはJQK/非JQKどちらとも断定できないため、実カードが1枚も矛盾しなければ成立とする=平穏・安寧・運命・宿命は「矛盾する実カードが無いか」で判定)。

### グループ5(2個)

| 護符名 | id | チャンネル | 条件・数式 | 既定値 |
|---|---|---|---|---|
| 兆し | `omen` | gained倍算 | 場札残数≤m `v × x` | m=20, x=1.5 |
| 三日月 | `crescent` | gained倍算 | 場札残数≤m `v × x` | m=10, x=3 |

グループ2の四季風と同様、2つとも同一ロジックのテンプレート重複として実装する(パラメータのみ独立)。

### グループ6(5個)

| 護符名 | id | チャンネル | 条件・数式 | 既定値 |
|---|---|---|---|---|
| 恩寵 | `blessing` | gained倍算 | `roleFired.length > 0` `v × x` | x=1.5 |
| 集中 | `focus` | gained倍算 | `roleFired`に`sameRank`を含む `v × x` | x=3 |
| 瑠璃 | `lapis` | gained倍算 | `roleFired.length >= 2` `v × x` | x=2 |
| 翡翠 | `jade` | gained加算 | `roleFired`のいずれかで`usedWild === true` `v + n` | n=200 |
| 無心 | `emptyMind` | gained倍算 | `!patternFired && roleFired.length === 0` `v × x` | x=4 |

### グループ7(3個)

| 護符名 | id | チャンネル | 条件・数式 | 既定値 |
|---|---|---|---|---|
| 序章 | `prologue` | gained加算 | `combo === 1` `v + n` | n=500 |
| 幕間 | `interlude` | gained加算 | `combo % m === 0` `v + n` | m=5, n=1000 |
| 朝露 | `morningDew` | gained加算 | `isFirstPlayOfWave` `v + n` | n=5000 |

### グループ8(1個)

| 護符名 | id | チャンネル | 条件・数式 | 既定値 |
|---|---|---|---|---|
| 小雨 | `drizzle` | gained加算 | 無条件 `v + n` | n=50 |

## 4. 既存システムへの影響

- `ItemId`型に35個のidを追加(既存20個と合わせて計55種類)。
- `ITEM_POOL`に35個を追加する。
- `ITEM_NAMES`・`itemDesc`に35個分を追加する。
- `evaluateChainBonus`の戻り値型`ChainBonusResult`が拡張されるため、既存の呼び出し元(`playCard`・テスト)で新規フィールドを無視している箇所がないか確認する。
- `WaveState`に`firstPlayDone: boolean`フィールドを追加するため、`makeWave`テストヘルパー等、`WaveState`を直接組み立てている箇所への影響を確認する。

## 5. スコープ外

- 護符の並べ替えUI・レアリティ重み付き抽選(グループ1〜3から継続してスコープ外)
- グループ9以降(新規累積state追跡が必要な護符群)
- 均衡・調和における「ワイルドの具体的な赤/黒振り分け」のUI表示(判定結果のみ扱い、内訳表示への配分ラベル付けはしない)
- 数値バランス調整(既定値は仮置き。候補一覧の「要調整」注記があるもの(勇気等)と同様、実プレイでの調整は別スコープ)

## 6. 受け入れ基準

1. `ITEM_EFFECTS`に35個全ての効果が登録されており、`applyItemEffects`で正しいチャンネル・順序で適用される
2. スート/色専有系(深緑・宝石・真剣・聖杯・月光・陽光)は、対象外の実カードが1枚でも混ざると不成立になり、全ワイルドの場合は成立する
3. 枚数カウント系(王冠・青葉・硬貨・武器・献杯)はワイルドを枚数に含める
4. 均衡・調和は`|実赤-実黒| <= ワイルド数`で成立する
5. 循環はK/Aいずれかがワイルドの場合も都合よく成立する
6. 輪廻・威光は、K↔Aループがワイルドで橋渡しされた区間内で発生する場合も検出できる(`stairUsesKALoop`のテストで境界越えのケースを確認)
7. グループ6(恩寵・集中・瑠璃・翡翠・無心)は`roleFired`/`patternFired`を正しく参照し、列一掃も`roleFired`に含まれる
8. 朝露はウェーブの最初のプレイでのみ発動し、2枚目以降のプレイでは発動しない(山札めくりでは`firstPlayDone`が変化しないことも確認)
9. `npm run test`・`npm run build`が成功する
