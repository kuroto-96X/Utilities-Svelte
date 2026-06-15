# 設計書: NISA積立シミュレーター

**日付:** 2026-06-15  
**ルート:** `/nisa-accumulation-simulator`  
**関連ツール:** `/nisa-simple-calculator`（①NISA年率計算、逆パターン）

---

## 概要

毎月または毎年の積立投資額・投資期間・想定年利を入力すると、最終評価額・累計投資額・損益額・損益率を計算し、資産推移をSVGグラフで表示するWebツール。フロントエンドのみで完結。

---

## ファイル構成

```
src/
  lib/
    nisa-accumulation-simulator.ts   ← 計算ロジック（libに分離）
  routes/
    nisa-accumulation-simulator/
      +page.svelte                   ← UI
src/lib/site.ts                      ← ツール登録追加
```

---

## 計算ロジック (`src/lib/nisa-accumulation-simulator.ts`)

### エクスポート

```ts
type Frequency = 'monthly' | 'yearly'

type ChartPoint = { year: number; invested: number; value: number }

type SimResult = {
  finalValue: number
  totalInvested: number
  profit: number
  profitRate: number
  chartData: ChartPoint[]
}

function simulate(
  amount: number,
  years: number,
  annualRate: number,
  frequency: Frequency
): SimResult
```

### 計算手順

1. **期数算出:** `periodsPerYear = 12 (monthly) | 1 (yearly)`, `n = years * periodsPerYear`
2. **期間レート:** `rPeriod = (1 + annualRate/100)^(1/periodsPerYear) - 1`
3. **将来価値関数:**
   - `n === 0` → 0
   - `|rPeriod| < 1e-9` → `amount * n`（年利0%時の0除算ガード）
   - それ以外 → `amount * ((1+rPeriod)^n - 1) / rPeriod`
4. **最終結果:** `finalValue = fv(n)`, `totalInvested = amount * n`, `profit = finalValue - totalInvested`, `profitRate = totalInvested > 0 ? (profit / totalInvested) * 100 : 0`
5. **グラフデータ:** `y = 0..years` の1年刻みで `fv(y * periodsPerYear)` と `amount * y * periodsPerYear` を収集

### エッジケース

| 条件 | 処理 |
|---|---|
| `amount <= 0` または未入力 | 全結果を0、chartDataも全ゼロ |
| `annualRate = 0` | `rPeriod ≈ 0` → 線形計算にフォールバック |
| `totalInvested = 0` | `profitRate = 0`（0除算回避） |

---

## UI (`src/routes/nisa-accumulation-simulator/+page.svelte`)

### 状態管理

```ts
let frequency = $state<Frequency>('monthly')
let amountStr = $state('30000')
let years = $state(20)
let annualRate = $state(5.0)

const result = $derived.by(() =>
  simulate(parseFloat(amountStr) || 0, years, annualRate, frequency)
)
```

### レイアウト（縦積み、`max-w-lg mx-auto`）

**カード①: 入力**
- 頻度トグル（毎月 / 毎年）— 既存NISAツールと同一スタイル
- 投資額テキスト入力 — ラベルは `frequency` に応じて「毎月の投資額（円）」/「毎年の投資額（円）」に動的切り替え
- 投資期間スライダー（1〜40、step 1、デフォルト20）
- 想定年利スライダー（0〜15、step 0.5、デフォルト5.0）

**カード②: 計算結果（2×2グリッド）**

| 左 | 右 |
|---|---|
| 最終評価額（teal-50背景、teal-700文字） | 累計投資額（slate-50背景） |
| 損益額（slate-50背景） | 損益率（slate-50背景） |

数値フォーマット: `Math.round()` + `toLocaleString()` で3桁区切り。損益額・損益率はマイナス時も符号付きでそのまま表示。

**カード③: 資産推移グラフ**
- 凡例（評価額＝緑実線、累計投資額＝グレー破線）
- SVGグラフ（`viewBox="0 0 300 160"`, `width="100%"`）
- 免責文（`text-xs text-slate-400`）

---

## SVGグラフ仕様

### 座標変換

```
paddingLeft=32, paddingRight=8, paddingTop=8, paddingBottom=20
svgW=300, svgH=160
plotW = svgW - paddingLeft - paddingRight
plotH = svgH - paddingTop - paddingBottom

maxValue = max(最終評価額, 1)  // 0除算防止

xOf(year)  = paddingLeft + (year / years) * plotW
yOf(value) = paddingTop + (1 - value / maxValue) * plotH
```

### パス生成

評価額は2つのパスで描画（単一パスだと閉じた輪郭の下辺にもストロークが出るため分離）:

- **評価額エリア（塗り）:** `M x0,yBottom L x0,y0 ... xN,yN L xN,yBottom Z`  
  `fill="#1D9E75" fill-opacity="0.15" stroke="none"`
- **評価額ライン（線）:** `M x0,y0 L x1,y1 ... xN,yN`  
  `stroke="#0F6E56" stroke-width="1.5" fill="none"`
- **累計投資額破線:** `M x0,y0 L ... xN,yN`  
  `stroke="#888780" stroke-width="1.5" stroke-dasharray="4 2" fill="none"`

### 軸ラベル

- 左下: `0年`
- 右下: `{years}年`
- 左上: `{Math.round(maxValue/10000).toLocaleString()}万円`

---

## site.ts 追加エントリ

```ts
{
  href: "/nisa-accumulation-simulator",
  label: "NISA積立シミュレーター(開発中)",
  description: "毎月・毎年の積立投資の将来評価額と資産推移をシミュレーションするツール",
  visible: true,
}
```

---

## 免責文

```
※想定年利は一定と仮定したシミュレーションです。実際の運用成果は市場の変動により
異なります。将来の運用成果を示すものではありません。
```
