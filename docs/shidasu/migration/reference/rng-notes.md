# 乱数(PRNG)の扱いに関する論点整理(結論はフェーズ2で決定)

**本ファイルの目的は論点の洗い出しのみ。C#の`System.Random`への置き換え可否・決定論的互換の要否についての結論はここでは出さない。**

---

## 1. `createRng`の実装(`deck.ts:79-87`)

```ts
export function createRng(seed: number): () => number {
  let s = seed >>> 0
  return () => {
    s = (s + 0x6D2B79F5) >>> 0
    let t = Math.imul(s ^ (s >>> 15), 1 | s)
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t
    return ((t ^ (t >>> 14)) >>> 0) / 0x100000000
  }
}
```

- いわゆる **mulberry32** アルゴリズム。32bit符号なし整数の内部状態`s`を種として、呼び出しごとに`0x6D2B79F5`を加算し、
  2回のxorshift的な混合(`Math.imul`によるビット演算)を経て`[0,1)`の浮動小数を返す。
- `seed`は`number`型。`>>> 0`で符号なし32bit整数に丸められる(小数や32bitを超える値を渡した場合の挙動はJS側のビット演算に依存)。
- 呼び出し元は`createRng(seed)`で1つの`() => number`関数(クロージャ)を得て、以降はその関数を呼ぶたびに数列の次の値が返る、
  という**ステートフルなジェネレータ**として扱う。同じ`seed`から生成した関数を同じ回数・同じ順序で呼べば、常に同じ数列が
  再現される(=決定論的)。
- `deck.ts`にはこの他、`shuffleInPlace`(Fisher-Yatesシャッフル)・`rollOffer`(N件無作為抽出)・`shuffle`・`generateSeed`
  (`Math.floor(Math.random()*999999)+1`で新規シード生成)がある。これらは全て`rand: () => number = Math.random`という
  **関数注入パターン**を取り、`createRng`で作った関数を渡せば決定論的に、省略すれば`Math.random`で非決定論的に動く。

---

## 2. Web版でのRNG使用箇所一覧

### 2.1 `rand`を自前で生成する箇所(`createRng(seed)`を直接呼ぶ関数)

| 関数 | 位置 | seedの出所 | 用途 |
|---|---|---|---|
| `beginRun` | `engine.ts:1047-1082` | 引数`seed?`(省略時`Math.floor(Math.random()*999999)+1`) | `rollStageStars`(星3枠抽選)、スプレッド設定による`randomizedDeckComposition`・`unifyBlackRedSuits`・`convertOneCardPerSuitToWild`(デッキ構成のランダム加工) |
| `startWave` | `engine.ts:136-258` | 引数`seed?`(省略時同上のフォールバック) | 護符「永劫」のワイルド1枚追加後の`convertRandomCardToWild`(豊穣護符)、デッキシャッフル(`shuffle`)、`rollSabotage`(星の妨害抽選) |
| `finishShop` | `engine.ts:1267-1278` | 引数`seed?`(省略時同上)。`baseSeed`として保持し、`rerollRandomTargets`用に**`createRng(baseSeed + 1)`という別系列**を追加生成した上で、`startWave`へは`baseSeed`をそのまま渡す(`startWave`内部でさらに`createRng(baseSeed)`される) | 賞金(`prizeMoney`)・祝儀(`celebration`)の`randomTarget`再抽選(系列を分離、コメントで意図的な分離と明記) → `startWave`呼び出し |

**重要**: `beginRun`/`startWave`は**seedを受け取ってその場でクロージャを作るだけ**で、`RunState`/`WaveState`のどちらの型
定義にも`seed`を保持するフィールドは存在しない(`types.ts`にseed関連フィールドなし)。一度使ったシードは状態に残らず、
次にランダム性が必要になった箇所(次のWave開始・次のショップ確定等)では**毎回新規に`Math.random()`ベースのシードが
生成される**(呼び出し元のUIが明示的に`seed`を渡さない限り)。

### 2.2 `rand`を引数として受け取る(内部で生成しない)関数

これらは呼び出し元から渡された`rand`をそのまま消費する。デフォルト値は基本すべて`Math.random`。

| 関数 | 位置 | 用途 |
|---|---|---|
| `playCard` | `engine.ts:364-736` | `resolvePlayTriggeredCurrencyGain`(賞金/僥倖/祝儀のランダム成立)、全消し時の`resolveHealingRestoration`・`regeneration`用シャッフル |
| `drawStock` | `engine.ts:738-899` | リセット時の`resolveHealingRestoration` |
| `resolveWaveEnd` | `engine.ts:1084-1164` | `enterShop`へ透過 |
| `enterShop` | `engine.ts:1218-1237` | `nextStageStars`(新ステージ突入時のみ`rollStageStars`)、`rollShop`(護符/秘儀/天啓/神託の個別枠・福袋枠・レリック枠抽選) |
| `useRite` | `engine.ts:1199-1213` | `applyRiteEffect`(乱数を使う秘儀効果、例: ダガズのシャッフル等) |
| `triggerSabotage` | `engine.ts:1314-` | 妨害発動時のランダム処理 |
| `rerollStageStars` | `engine.ts:1357-` | 星のリロール抽選(`rollStarForSlot`) |
| `rerollShop` | `engine.ts:1381-` | ショップ商品の再抽選(`rollShop`) |
| `buyIndividualRevelationUse` / `pickPackRevelationUse` / `buyPack` | 各所 | 天啓効果内のランダム対象選定など |
| `applyStuckCheck` | `engine.ts:1977-2011` | 不屈(`resilience`)の捨て札シャッフル、`drawStock`への継続 |
| `continueAfterGreatMisfortune` | `engine.ts:1909-` | `enterShop`へ透過 |

### 2.3 各種`roll*`関数(いずれも`rand: () => number = Math.random`を引数注入で受け取る)

| 関数 | 位置 | 用途 |
|---|---|---|
| `rollOffer` | `deck.ts:98-102` | 汎用N件無作為抽出(福袋・バラ売り等の共通ヘルパー) |
| `rollItemOffer` | `items.ts:64` | 護符オファー抽選 |
| `rollRiteOffer` / `rollRite` | `rites.ts:38` / `rites.ts:31` | 秘儀オファー抽選 |
| `rollRevelationOffer` | `revelations.ts:47` | 天啓オファー抽選 |
| `rollOracleOffer` | `oracles.ts:22` | 神託オファー抽選 |
| `rollCardSetOffer` | `cardSets.ts:214` | カードセットオファー抽選 |
| `rollSabotage` | `sabotage.ts:38` | 星の妨害内容抽選(`startWave`から呼ばれる) |
| `rollShop` | `shop.ts:64` | 上記個別枠(`rollIndividualSlot`)・福袋枠(`rollPackSlots`)・レリック枠(`rollRelicSlots`)をまとめて1つの`rand`系列で順番に消費 |

`rollShop`は内部で`rollIndividualSlot`→`rollPackSlots`→`rollRelicSlots`の順に**同じ`rand`インスタンスを使い回して逐次消費**する
(`shop.ts:64-69`)。呼び出し順が1つでもズレると、以降のシャッフル結果が全てズレる=**呼び出し順序に強く依存する設計**。

---

## 3. Web版UIでの実際の乱数運用(重要な前提)

`src/routes/game/shidasu/+page.svelte`を確認したところ:

- `beginRun(params, undefined, spreadId)` — **`seed`は常に`undefined`**。呼び出しは1箇所のみ
- `finishShop(params, run)` — **`seed`は常に省略**。呼び出しは1箇所のみ
- `applyPlayCard(params, run, colIndex, undefined, rowIndex)` — **`rand`は`undefined`(=`Math.random`にフォールバック)**
- `applyDrawStock`・`useRite`・`rerollStageStars`・`rerollShop`・`buyPack`・`pickPackRevelationUse`・
  `buyIndividualRevelationUse`・`continueAfterGreatMisfortune` — いずれも`rand`引数を渡していない(全て`Math.random`)

さらに`RunState`/`WaveState`の型(`types.ts`)にも、UIコンポーネント(`+page.svelte`他)にも、**シード値を保持・表示・入力する
フィールドやUIは一切存在しない**(`seed`という文字列で全文検索しても一致なし)。

つまり現状のWeb版は:
- **デッキ構成の初期ランダム化・シャッフル・妨害抽選(`startWave`/`beginRun`内)だけ**が`createRng`(mulberry32)による
  決定論的な数列を使っているが、その`seed`自体は毎回`Math.random()`から生成される使い捨てで、後から再現する手段がない
- **それ以外のほぼ全てのランダム性(プレイ中の護符効果、ショップの商品抽選、秘儀/天啓の効果、妨害発動等)は
  `Math.random`直呼びで、`createRng`の系列にすら乗っていない**
- `createRng`が実際に主目的として使われているのは**ユニットテスト側**(`*.test.ts`群、例: `cardSets.test.ts`で
  `createRng(1)`や`createRng(seed)`を使い、同じseedなら同じ結果になることをアサートする)であり、
  **プレイヤー向けのリプレイ機能やシード共有機能(Balatroのような「シードを教え合う」文化)は現状実装されていない**

---

## 4. Godot移植にあたっての論点(結論は次フェーズ)

以下は判断材料の列挙であり、本ファイル内では方針を決めない。

### 4.1 「決定論的互換」が何を指すかの粒度
- (a) **mulberry32のビット単位互換**(同じseed・同じ呼び出し順なら、Web版とGodot版で1ビット単位まで同じ乱数列になる)
- (b) **ゲームロジック単位の決定論のみ**(Godot内で同じseedなら常に同じ結果になればよく、Web版と同一である必要はない)
- (c) **決定論性そのものを要求しない**(現状のWeb版同様、都度`Math.random`相当でよい)
上記3.の実態(UIからseedを渡していない・大半が`Math.random`直呼び)を踏まえると、現状の挙動を厳密に再現する対象は
「デッキシャッフル等ごく一部の経路」に限られる可能性がある。

### 4.2 C#の標準RNG(`System.Random`)の特性
- .NETの`System.Random`は(.NETのバージョンにより実装アルゴリズムが異なるが)mulberry32とはビット単位で異なる数列になる
  (要調査: 使用する.NET/Godotのバージョンで具体的なアルゴリズムを確認する必要がある)
- コンストラクタに`Seed`を渡すことで種を設定でき、同一seed・同一呼び出し順なら再現可能という性質自体はmulberry32と同様に持つ

### 4.3 「呼び出し順序への依存」がテスト資産に与える影響
- 既存のユニットテスト(`engine.test.ts`はじめ10ファイル)は`createRng(seed)`で生成した数列を前提に期待値をアサートしている
  可能性が高い。Godot側でテストを新規に書き直すのか、Web版の期待値をそのまま移植するのかで、mulberry32互換の要否が変わる
- 一部の関数(`rollShop`等)は複数のroll系関数が**同じrandインスタンスを順番に消費する**設計のため、Godot側で処理順序を
  1つでも変えると結果が変わる。ロジックを1:1移植する場合はこの呼び出し順序も含めて厳密に踏襲する必要がある

### 4.4 シード運用機能を新規に追加するかどうか
- 現状Web版にはシード共有・リプレイ機能が無い(3節参照)。Godot版で新規に「シード指定プレイ」「詰み調査用の固定シード」
  といった機能を追加するかどうかは移植方針とは別の企画判断になる
- 追加する場合、`RunState`相当の型にseedを保持するフィールドを新設する必要がある(Web版には存在しない)

### 4.5 `beginRun`と`startWave`のseed分離設計の扱い
- `finishShop`が`baseSeed`と`baseSeed+1`で意図的に系列を分離している設計(2.1節、コメントに明記された意図: 
  「randomTargetの抽選結果とシャッフル結果が数学的に相関しないようにする」)は、Godot側でも同種の配慮
  (系列分離 or 完全に独立したRNGインスタンス)が要るかどうかの検討対象になる

### 4.6 テスト容易性としての「関数注入パターン」自体は踏襲価値が高い
- `rand: () => number = Math.random`という関数注入パターン自体(具体的なアルゴリズムの選定とは独立した設計)は、
  C#でも`Func<double>`等のデリゲートによる引数注入で再現可能であり、単体テストの決定論的実行という観点では有用性が高い
  (これはアルゴリズム互換の話とは別軸の論点)

---

## 5. 参照ファイル

- `src/lib/game/shidasu/deck.ts`(`createRng`, `shuffleInPlace`, `rollOffer`, `shuffle`, `generateSeed`)
- `src/lib/game/shidasu/engine.ts`(`beginRun`, `startWave`, `finishShop`, `enterShop`, `playCard`, `drawStock`ほか乱数使用箇所全般)
- `src/lib/game/shidasu/shop.ts`(`rollShop`, `rollIndividualSlot`, `rollPackSlots`, `rollRelicSlots`)
- `src/lib/game/shidasu/items.ts` / `rites.ts` / `revelations.ts` / `oracles.ts` / `cardSets.ts` / `sabotage.ts`(各`roll*`)
- `src/routes/game/shidasu/+page.svelte`(実際の呼び出し箇所、seed/rand未指定の実態)
- `src/lib/game/shidasu/*.test.ts`(`createRng`の実際の用途=テストの決定論的実行)
