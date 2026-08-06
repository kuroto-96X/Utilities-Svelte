# 神託モチーフの六十四卦への変更・ペア/交互の神託対応 設計

## 背景・目的

Shidasuの神託(oracle)は現在「八卦」(乾兌離震巽坎艮坤の8つ)をモチーフにしており、実装済みの8役(同スート・同色・階段・フラッシュ・ロイヤル・同ランク・コンプリートラン・列一掃)と1:1で対応している。八卦は本質的に8要素固定の体系のため、先日追加した新規役「ペア」・新規パターン「交互」を神託の対象に加えようとすると、モチーフの構造上これ以上拡張できない。

そこで神託のモチーフを「六十四卦」(易経、八卦を2つ組み合わせた64卦)に変更する。八卦との連続性を保ちつつ、将来さらに役・パターンが追加された場合にも十分な余地を持つ体系である。

## 卦名の割り当て

10役(既存8つ+ペア・交互)に、以下の卦を割り当てる。既存8つは、六十四卦の中で「上下同じ卦が重なる」純卦(乾為天など)として割り当て、既存の一文字表記(乾・兌など)から四文字表記に変更する。

| 役・パターン | 卦名 | 読み |
|---|---|---|
| completeRun(コンプリートラン) | 乾為天 | けんいてん |
| royalSet(ロイヤル) | 兌為沢 | だいたく |
| flush(フラッシュ) | 離為火 | りいか |
| stair(階段) | 震為雷 | しんいらい |
| color(同色) | 巽為風 | そんいふう |
| suit(同スート) | 坎為水 | かんいすい |
| columnSweep(列一掃) | 艮為山 | ごんいさん |
| sameRank(同ランク) | 坤為地 | こんいち |
| pair(ペア、新規) | 沢山咸 | たくざんかん |
| alternating(交互、新規) | 水火既済 | すいかきせい |

## スコープ

- 六十四卦のうち今回使う10卦のみをデータ化する(天啓の`mansions.ts`のような「未使用分も含めて全部温存する」設計は採らない。理由: 二十八宿は元々28要素あり実装済み12種との差分が明確だが、六十四卦は64要素と規模が大きく、今回使わない54卦を先行して用意する優先度は低いと判断)
- ペア・交互を`ORACLE_POOL`(実際に神託として抽選・購入できる対象)に追加し、これまで「先行実装のみで入手手段が無い」状態だったものを実際にプレイで入手できるようにする
- 永続化(localStorage等)は現在使われていないため、既存セーブデータへの影響は考慮不要

## 実装内容

### 1. 名前データファイルの置き換え

`src/lib/game/shidasu/trigrams.ts`(八卦8つの管理画面用データ)を`src/lib/game/shidasu/hexagrams.ts`に置き換える。既存の`TrigramEntry`/`TRIGRAMS`を`HexagramEntry`/`HEXAGRAMS`に改名し、中身を上記10卦(名前・読み)に差し替える。

```ts
// 六十四卦(易経)のうち、神託(oracle)として使用中の10卦の参照データ。
// 管理画面の「名前」<select>の選択肢・読み方ラベル表示にのみ使う(秘儀のrunes.ts・
// 天啓のmansions.tsと同じ位置づけ)。六十四卦は全部で64卦あるが、今回使う10卦のみを
// データ化する(mansions.tsのような未使用分の温存はしない、将来追加時に別途拡張する)。
export interface HexagramEntry {
  kanji: string
  reading: string
}

export const HEXAGRAMS: HexagramEntry[] = [
  { kanji: '乾為天', reading: 'けんいてん' },
  { kanji: '兌為沢', reading: 'だいたく' },
  { kanji: '離為火', reading: 'りいか' },
  { kanji: '震為雷', reading: 'しんいらい' },
  { kanji: '巽為風', reading: 'そんいふう' },
  { kanji: '坎為水', reading: 'かんいすい' },
  { kanji: '艮為山', reading: 'ごんいさん' },
  { kanji: '坤為地', reading: 'こんいち' },
  { kanji: '沢山咸', reading: 'たくざんかん' },
  { kanji: '水火既済', reading: 'すいかきせい' },
]
```

`src/routes/admin/shidasu-oracles/+page.svelte`のimport・`{#each TRIGRAMS as trigram ...}`を、それぞれ`HEXAGRAMS`/`hexagram`に置き換える。

### 2. 神託の名前・説明文データを更新する

`src/lib/game/shidasu/shidasu.config.json`の`oracles`セクションを、既存8エントリの`name`を四文字表記に変更しつつ、`pair`・`alternating`の2エントリを新規追加する形に更新する。

```json
"oracles": {
  "completeRun": { "name": "乾為天", "desc": "コンプリートラン　レベル+1" },
  "royalSet": { "name": "兌為沢", "desc": "ロイヤルセット　レベル+1" },
  "flush": { "name": "離為火", "desc": "フラッシュ　レベル+1" },
  "stair": { "name": "震為雷", "desc": "階段　レベル+1" },
  "color": { "name": "巽為風", "desc": "同色　レベル+1" },
  "suit": { "name": "坎為水", "desc": "同スート　レベル+1" },
  "columnSweep": { "name": "艮為山", "desc": "列一掃　レベル+1" },
  "sameRank": { "name": "坤為地", "desc": "同ランク　レベル+1" },
  "pair": { "name": "沢山咸", "desc": "ペア　レベル+1" },
  "alternating": { "name": "水火既済", "desc": "交互　レベル+1" }
}
```

`src/lib/game/shidasu/params.ts`の`ShidasuParams['oracles']`型定義に、`pair: { name: string; desc: string }`・`alternating: { name: string; desc: string }`を追加する。

同ファイルには`loadParams()`が返す`shidasu.config.json`とは別に、テストコードから参照される`DEFAULT_PARAMS`という独立したハードコード値も存在する(443行目付近、`oracles: { completeRun: { name: '乾', desc: '...' }, ... }`)。前回のTask 1実装でも`scoring.pairBonusUnit`等を`shidasu.config.json`・`DEFAULT_PARAMS`の両方に追加した実績があるため、今回も`DEFAULT_PARAMS.oracles`を`shidasu.config.json`の`oracles`セクションと同じ内容(卦名変更+pair・alternating追加)に更新する。

### 3. ORACLE_POOLにペア・交互を追加する

`src/lib/game/shidasu/oracles.ts`の`ORACLE_POOL`配列に`'pair'`・`'alternating'`を追加する(8→10種類均等抽選)。

```ts
export const ORACLE_POOL: RoleName[] = [
  'completeRun', 'royalSet', 'flush', 'stair', 'color', 'suit', 'columnSweep', 'sameRank',
  'pair', 'alternating',
]
```

冒頭のコメント「rollOracleOfferは重み付けなしの完全均等抽選。8役すべてが対象(将来の追加余地なし)」を「10役すべてが対象」に更新する。

`params.oracles`型が`pair`・`alternating`を含むようになるため、以前(2026-08-06の実装計画Task 1)にYAGNI判断で追加した`oracleEntry`ヘルパー関数(`Partial<Record<...>>`キャスト+フォールバック)は不要になる。`oracleName`/`oracleDesc`を元の直接インデックスアクセスに戻し、型安全性を回復する。

変更前:
```ts
// params.oraclesはpair・alternatingを含まない(YAGNI判断、実装計画のTask 1参照)。
// RoleName型はpair・alternatingを含むため、インデックスアクセスは型エラーになる。
// ORACLE_POOLにpair・alternatingが含まれない限り実行時にこの分岐へは入らないが、
// 型安全のためPartialでキャストしフォールバックを用意する。
function oracleEntry(roleName: RoleName, params: ShidasuParams): { name: string; desc: string } | undefined {
  return (params.oracles as Partial<Record<RoleName, { name: string; desc: string }>>)[roleName]
}

export function oracleName(roleName: RoleName, params: ShidasuParams): string {
  return oracleEntry(roleName, params)?.name ?? roleName
}

export function oracleDesc(roleName: RoleName, params: ShidasuParams): string {
  return oracleEntry(roleName, params)?.desc ?? ''
}
```

変更後:
```ts
export function oracleName(roleName: RoleName, params: ShidasuParams): string {
  return params.oracles[roleName].name
}

export function oracleDesc(roleName: RoleName, params: ShidasuParams): string {
  return params.oracles[roleName].desc
}
```

### 4. admin/shidasu-oracles/+page.svelteのキャストも安全な形に戻す

`params.oracles`型が`pair`・`alternating`を含むことで、`oracleEntry`関数のキャストも不要になる。

変更前:
```ts
function oracleEntry(roleName: RoleName): OracleEntry {
  // config.oracles(=ShidasuParams['oracles'])はpair・alternatingを含まない(YAGNI判断、
  // 実装計画のTask 1参照)。RoleName型はpair・alternatingを含むためRecordへキャストしてアクセスする。
  return (config!.oracles as unknown as Record<RoleName, OracleEntry>)[roleName]
}
```

変更後:
```ts
function oracleEntry(roleName: RoleName): OracleEntry {
  return config!.oracles[roleName] as unknown as OracleEntry
}
```

(`OracleEntry`型自体が`Record<string, number | string>`とのインターセクション型で、`ShidasuParams['oracles'][roleName]`とは構造的に一致しないため、`as unknown as`によるキャスト自体は残す。今回変更するのは、pair・alternatingを含まない不完全な型からのキャストを止め、完全な型からの変換に戻す点のみ)

### 5. oracleActualEffects.tsのコメントを更新する

`src/lib/game/shidasu/oracleActualEffects.ts`の`pair`・`alternating`エントリから、「現時点ではORACLE_POOLに含まれないため、実際にこの神託を入手する手段は無い(将来の追加を見越した先行実装)」という記述を削除する(実態が変わるため)。

変更前:
```ts
pair: 'ペアのレベルを+1する。以後evaluateChainBonus(patterns.ts)のペアボーナス計算で、基礎点(pairBonusUnit)にこのレベルを乗算した額が加点される(明星・ソウィロ由来のroleBonusMultiplierとも併せて乗算される)。現時点ではORACLE_POOLに含まれないため、実際にこの神託を入手する手段は無い(将来の追加を見越した先行実装)',
alternating: '交互のレベルを+1する。以後evaluateChainBonus(patterns.ts)の交互ボーナス計算で、基礎点(alternatingBonus)にこのレベルを乗算した額が加点される。現時点ではORACLE_POOLに含まれないため、実際にこの神託を入手する手段は無い(将来の追加を見越した先行実装)',
```

変更後:
```ts
pair: 'ペアのレベルを+1する。以後evaluateChainBonus(patterns.ts)のペアボーナス計算で、基礎点(pairBonusUnit)にこのレベルを乗算した額が加点される(明星・ソウィロ由来のroleBonusMultiplierとも併せて乗算される)',
alternating: '交互のレベルを+1する。以後evaluateChainBonus(patterns.ts)の交互ボーナス計算で、基礎点(alternatingBonus)にこのレベルを乗算した額が加点される',
```

## テスト方針

- `oracles.ts`の`rollOracleOffer`テスト(`oracles.test.ts`)は、`ORACLE_POOL`が10種類になったことで既存の「countを指定すればその件数まで返す(神託は3-1/5-1パックのみ、5まで)」テストの前提(8種プール)には影響しないが、`ORACLE_POOL.length`を直接検証するテストがあれば更新する
- `oracleName`/`oracleDesc`関数の型安全性回復により、これらを直接検証する既存テストがあれば新しい卦名(乾為天など)に合わせて期待値を更新する
- 型チェック(`npm run check`)でコンパイルエラーが解消されることを確認する

## 除外・非対象

- 六十四卦のうち今回使わない54卦のデータ化は対象外(将来役・パターンが追加された際に個別対応する)
- 神託の価格・購入UIロジック自体(ショップの神託パック等)は変更不要。`ORACLE_POOL`が10種類になることで、既存の均等抽選ロジックがそのまま10種対応する設計になっている
- 秘儀・天啓のモチーフ(ルーン文字・二十八宿)は対象外、変更しない
