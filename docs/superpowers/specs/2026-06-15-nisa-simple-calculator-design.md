# NISA年率計算（簡易版）設計書

**日付:** 2026-06-15
**ルート:** `/nisa-simple-calculator`
**ステータス:** 設計承認済み

---

## 概要

NISA口座の「現在の評価額」「損益率」から運用年率（年率換算リターン）を逆算するWebツール。
Modified Dietz法による近似計算を使用。フロントエンドのみで完結。モバイル優先レイアウト。

---

## ファイル構成

```
src/routes/nisa-simple-calculator/
  +page.svelte          ← 新規作成（全ロジック + UI）

src/lib/site.ts         ← ツール登録追加
```

### site.ts 追加内容

```ts
{
  href: "/nisa-simple-calculator",
  label: "NISA年率計算(開発中)",
  description: "NISAの損益率から運用年率を逆算するツール",
  visible: true,
}
```

---

## 状態管理

Svelte 5 runes（`$state` / `$derived`）で実装。サーバーサイド通信なし。

### `$state` 変数

| 変数 | 型 | デフォルト | 説明 |
|---|---|---|---|
| `startMonth` | `string` | `''` | 投資開始年月（"2022-01" 形式） |
| `frequency` | `'monthly' \| 'yearly'` | `'monthly'` | 投資頻度 |
| `currentValue` | `number \| ''` | `''` | 現在の評価額（円） |
| `profitRate` | `number \| ''` | `''` | 現在の損益率（%） |
| `referenceRate` | `number` | `6.0` | 参考年率（%）、スライダーで変更 |

### `$derived` — 計算結果

3種類の状態を返す：

```ts
type CalcResult =
  | null                        // 未入力あり → 計算結果・予測カードを非表示
  | { error: string }           // 入力完了だが無効（損益率 ≤ -100%など）→ エラーメッセージ表示
  | {                           // 正常計算結果
      annualReturn: number      // 年率換算リターン（%）
      yearsInvested: number     // 運用期間（年）
      totalInvested: number     // 累計投資額（円）
      perPeriodAmount: number   // 1回あたり投資額（円）
      futures: {
        years5: { own: number; ref: number }
        years10: { own: number; ref: number }
        years20: { own: number; ref: number }
        nisaMax:
          | { reachedAlready: true; currentValue: number }
          | { reachedAlready: false; yearsToMax: number; own: number; ref: number; veryLong: boolean }
      }
    }
```

- `null` → 計算結果カード・予測カードともに非表示
- `{ error }` → 計算結果カードにエラーメッセージ表示、予測カード非表示
- 正常結果 → 両カード表示

---

## 計算ロジック（仕様書6ステップ）

### Step 1: 投資期数 N

```
periodsPerYear = 毎月 → 12, 毎年 → 1
N = 毎月 → (現在年 - 開始年) * 12 + (現在月 - 開始月)
  = 毎年 → 現在年 - 開始年
N = max(N, 1)
```

### Step 2: 累計投資額・1回あたり投資額

```
totalInvested = currentValue / (1 + profitRate / 100)
perPeriod = totalInvested / N
```

### Step 3: Modified Dietz 法による期間リターン R

```
R = (profitRate / 100) * (2N / (N + 1))
```

### Step 4: 年率換算リターン r

```
T = N / periodsPerYear   // 年数
r = (1 + R)^(1/T) - 1
```

### Step 5: 将来評価額（years年後）

```
M = years * periodsPerYear
rPeriod = (1 + rateAnnual)^(1/periodsPerYear) - 1

if |rPeriod| < 1e-10:
  futureValue = currentValue + perPeriod * M
else:
  futureValue = currentValue * (1 + rPeriod)^M
             + perPeriod * (((1 + rPeriod)^M - 1) / rPeriod)
```

### Step 6: NISA満額到達予測

```
NISA_MAX = 18_000_000
remaining = NISA_MAX - totalInvested

if remaining <= 0:
  reachedAlready = true
  → テーブルの満額行に「満額達成済み」と表示し、追加投資なしの現在評価額をそのまま示す
  → 将来成長は計算せず、currentValue を表示（追加投資の恩恵はすでにない状態）
else:
  periodsToMax = remaining / perPeriod
  yearsToMax = periodsToMax / periodsPerYear
  nisaMaxValue = Step5 の式（years = yearsToMax）
```

---

## UI レイアウト（上から順）

### ① 入力カード

- 投資開始年月（`<input type="month">`）
- 投資頻度トグル（毎月 / 毎年）— 選択中を強調（`bg-teal-700 text-white`）
- 評価額 + 損益率を横2列（`grid grid-cols-2`）

### ② 計算結果カード

- エラー時: 「入力値を確認してください」メッセージ
- 正常時: 2×2グリッド
  - 年率換算リターン（`toFixed(1)`%）
  - 運用期間（`toFixed(1)`年）
  - 累計投資額（`toLocaleString()`円）
  - 1回あたり投資額（`toLocaleString()`円）
- 入力未完了時: カードを非表示

### ③ 将来予測カード

- 参考年率スライダー（0〜15、step 0.5、現在値をラベル表示）
- 将来予測テーブル（万円表示 = `Math.round(円 / 10000)`）

| 行 | ご自身の年率 | 参考年率 |
|---|---|---|
| 5年後 | — | — |
| 10年後 | — | — |
| 20年後 | — | — |
| NISA満額到達時 or 満額達成済み | — | — |

- 免責文（小テキスト）

---

## エッジケース処理

| 条件 | 対処 |
|---|---|
| 未入力あり | `result = null`、計算結果カード・予測カード非表示 |
| `profitRate <= -100` | `error = "入力値を確認してください"` を表示 |
| `N = 0`（開始月=今月）| `N = max(N, 1)` に補正（仕様どおり） |
| 累計投資額 ≥ 1800万 | 満額行 → 「満額達成済み」表示、現在の評価額を表示 |
| `rPeriod ≈ 0`（年率0%）| 将来評価額 = `currentValue + perPeriod * M` |
| 満額到達まで50年超 | 「参考値」注記を強調（テーブル内に小テキスト） |

---

## スタイル方針

- 既存ツールと統一: Tailwind CSS、白カード（`bg-white rounded-xl shadow-sm`）
- コンテナ: `max-w-lg mx-auto px-4 py-6 space-y-4`
- モバイル優先（〜400px 基準）、横スクロール禁止

---

## 免責文（将来予測カード下部）

```
※年率は損益率と投資期間から近似計算した参考値です。投資額が一定でない場合や
不定期な投資の場合、実際の年率とは異なります。
※参考年率は想定値であり、将来の運用成果を示すものではありません。
※NISA生涯投資枠1,800万円（2024年からの新NISA制度）を基準にしています。
制度内容は変更される可能性があります。
```
