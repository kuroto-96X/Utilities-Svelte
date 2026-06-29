# ソリティア アニメーション設定 Admin ページ 実装設計

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** ソリティアのアニメーションパラメータを `/admin/anim-config` ページ上でスライダー・テキストボックスから調整し、JSON ファイルに保存できるようにする。

**Architecture:** スキーマ駆動の UI 自動生成。`anim.config.json`（値）と `anim.config.schema.ts`（メタ情報）を分離し、admin ページはスキーマを読んで入力欄を自動生成する。既存の `adminApiPlugin`（vite.config.ts）と同じパターンで Vite dev サーバーミドルウェアを追加し、ファイルの読み書きを行う。ゲームページは JSON を TypeScript `import` でバンドル時に取り込み、本番でも動作する。

**Tech Stack:** SvelteKit + Svelte 5 runes、Tailwind CSS v3、Web Animations API（WAAPI）、Vite dev ミドルウェアプラグイン

---

## ファイル構成

| パス | 操作 | 役割 |
|------|------|------|
| `src/lib/game/solitaire/anim.config.json` | 新規作成 | アニメーションパラメータの実体（git 管理、本番にバンドル） |
| `src/lib/game/solitaire/anim.config.schema.ts` | 新規作成 | 各フィールドのラベル・min/max/step/unit/type 定義 |
| `src/routes/admin/anim-config/+page.svelte` | 新規作成 | スキーマ駆動の設定 UI + アニメーションプレビュー |
| `vite.config.ts` | 変更 | `animConfigApiPlugin` を追加（GET/POST `/api/admin/anim-config`） |
| `src/routes/game/solitaire/+page.svelte` | 変更 | ① `import defaultConfig from '...'` で JSON 読み込み ② `slamDrop` CSS → WAAPI 変換 ③ 全アニメーション関数で config 値を参照 |

---

## anim.config.json の構造

```json
{
  "slamDrop": {
    "durationMs": 480,
    "peakAt": 0.38,
    "landAt": 0.84,
    "peakScale": 1.85,
    "peakRotateDeg": -10,
    "peakLiftPx": -60,
    "landScale": 1.06,
    "landRotateDeg": -1
  },
  "screenShake": {
    "durationMs": 400,
    "frames": [
      { "x": -7, "y": -4, "rotateDeg": -0.4 },
      { "x":  7, "y":  5, "rotateDeg":  0.4 },
      { "x": -5, "y": -3, "rotateDeg": -0.3 },
      { "x":  6, "y":  4, "rotateDeg":  0.3 },
      { "x": -3, "y": -2, "rotateDeg":  0 },
      { "x":  3, "y":  2, "rotateDeg":  0 },
      { "x": -1, "y": -1, "rotateDeg":  0 }
    ]
  },
  "impactBounce": {
    "minDistPx": 40,
    "maxDistPx": 460,
    "delayFactor": 0.55,
    "singleMaxScale": 0.18,
    "tableauMaxScale": 0.22,
    "tableauDurationMinMs": 280,
    "tableauDurationRangeMs": 260
  },
  "sparkle": {
    "count": 14,
    "radiusPx": 90,
    "durationMs": 780
  },
  "scoreDelta": {
    "durationMs": 1100
  }
}
```

---

## anim.config.schema.ts の構造

フィールド型は2種類：

```ts
type NumberField = {
  type: 'number'
  label: string
  min: number
  max: number
  step: number
  unit?: string
}

type ArrayField = {
  type: 'array'
  label: string
  columns: Record<string, NumberField>
}

type FieldSchema = NumberField | ArrayField

type SectionSchema = {
  label: string
  fields: Record<string, FieldSchema>
}

export type AnimConfigSchema = Record<string, SectionSchema>
```

スキーマファイルには、スキーマ定義に加えて **`DEFAULT_ANIM_CONFIG`** 定数を export する。これが「デフォルトに戻す」の戻し先となる。`anim.config.json` の初期値はこの定数と同一にする。

スキーマ定義例：

```ts
export const animConfigSchema: AnimConfigSchema = {
  slamDrop: {
    label: 'スラム投下',
    fields: {
      durationMs:    { type: 'number', label: '総時間',           min: 100,  max: 2000, step: 10,   unit: 'ms' },
      peakAt:        { type: 'number', label: 'ピーク位置 (0-1)', min: 0.05, max: 0.95, step: 0.01 },
      landAt:        { type: 'number', label: '着地位置 (0-1)',   min: 0.05, max: 0.99, step: 0.01 },
      peakScale:     { type: 'number', label: 'ピーク倍率',       min: 1.0,  max: 3.0,  step: 0.05 },
      peakRotateDeg: { type: 'number', label: 'ピーク回転',       min: -45,  max: 45,   step: 1,    unit: '°' },
      peakLiftPx:    { type: 'number', label: '浮き上がり量',     min: -200, max: 0,    step: 5,    unit: 'px' },
      landScale:     { type: 'number', label: '着地倍率',         min: 1.0,  max: 1.5,  step: 0.01 },
      landRotateDeg: { type: 'number', label: '着地回転',         min: -10,  max: 10,   step: 0.5,  unit: '°' },
    }
  },
  screenShake: {
    label: '画面シェイク',
    fields: {
      durationMs: { type: 'number', label: '総時間', min: 100, max: 1000, step: 10, unit: 'ms' },
      frames: {
        type: 'array',
        label: 'フレーム列',
        columns: {
          x:         { type: 'number', label: 'X',  min: -30, max: 30, step: 0.5, unit: 'px' },
          y:         { type: 'number', label: 'Y',  min: -30, max: 30, step: 0.5, unit: 'px' },
          rotateDeg: { type: 'number', label: '回転', min: -3, max: 3,  step: 0.1, unit: '°' },
        }
      }
    }
  },
  impactBounce: {
    label: '衝撃バウンス',
    fields: {
      minDistPx:            { type: 'number', label: '最小距離',           min: 0,    max: 200,  step: 5,    unit: 'px' },
      maxDistPx:            { type: 'number', label: '最大距離',           min: 100,  max: 1000, step: 10,   unit: 'px' },
      delayFactor:          { type: 'number', label: '遅延係数',           min: 0,    max: 2,    step: 0.05, unit: 'ms/px' },
      singleMaxScale:       { type: 'number', label: '単体最大スケール',   min: 0,    max: 0.5,  step: 0.01 },
      tableauMaxScale:      { type: 'number', label: 'タブロー最大スケール', min: 0,  max: 0.5,  step: 0.01 },
      tableauDurationMinMs: { type: 'number', label: '奥カード時間',       min: 50,   max: 500,  step: 10,   unit: 'ms' },
      tableauDurationRangeMs: { type: 'number', label: '時間レンジ',       min: 0,    max: 500,  step: 10,   unit: 'ms' },
    }
  },
  sparkle: {
    label: 'スパークル',
    fields: {
      count:     { type: 'number', label: '発射数',  min: 1,  max: 40,   step: 1 },
      radiusPx:  { type: 'number', label: '広がり', min: 20, max: 300,  step: 5,  unit: 'px' },
      durationMs:{ type: 'number', label: '時間',   min: 100, max: 2000, step: 10, unit: 'ms' },
    }
  },
  scoreDelta: {
    label: 'スコア差分',
    fields: {
      durationMs: { type: 'number', label: '時間', min: 200, max: 3000, step: 50, unit: 'ms' },
    }
  },
}
```

---

## Vite プラグイン（vite.config.ts）

既存の `adminApiPlugin` に倣い `animConfigApiPlugin` を追加する。

```ts
function animConfigApiPlugin(): Plugin {
  return {
    name: 'anim-config-api',
    enforce: 'pre',
    configureServer(server) {
      const configPath = path.resolve('src/lib/game/solitaire/anim.config.json')
      server.middlewares.use('/api/admin/anim-config', (req, res) => {
        if (req.method === 'GET') {
          res.setHeader('Content-Type', 'application/json')
          res.end(readFileSync(configPath, 'utf-8'))
        } else if (req.method === 'POST') {
          let body = ''
          req.on('data', (chunk: Buffer) => { body += chunk.toString() })
          req.on('end', () => {
            try {
              JSON.parse(body) // バリデーション
              writeFileSync(configPath, JSON.stringify(JSON.parse(body), null, 2) + '\n')
              res.statusCode = 200; res.end('ok')
            } catch {
              res.statusCode = 400; res.end('invalid JSON')
            }
          })
        } else {
          res.statusCode = 405; res.end('method not allowed')
        }
      })
    }
  }
}
```

`server.watch.ignored` に `anim.config.json` を追加し、保存時に HMR が連続発火しないようにする。

---

## admin ページ UI（`/admin/anim-config`）

### レイアウト

```
┌─────────────────────────────────────────────────────────────┐
│ アニメーション設定                         [リロード][保存] │
├────────────────────────────┬────────────────────────────────┤
│ 設定パネル（左）            │ プレビュー（右）               │
│                             │                                │
│ ▾ スラム投下                │  ┌──────────────────────────┐ │
│   総時間  [====●====] 480ms │  │  [♠A]          [　]     │ │
│   ピーク位置 [=●===] 0.38  │  │                            │ │
│   ...                       │  └──────────────────────────┘ │
│                             │  ▶ SlamDrop                    │
│ ▾ 画面シェイク              │  ▶ ScreenShake                 │
│   総時間  [====●] 400ms     │  ▶ ImpactBounce                │
│   フレーム列:               │  ▶ Sparkle                     │
│   ┌──┬──┬──┐               │  ▶ ScoreDelta (+100)           │
│   │X │Y │回転│              │                                │
│   │-7│-4│-0.4│              │                                │
│   │...│  │   │              │                                │
│   └──┴──┴──┘               │                                │
│   [行追加][行削除]          │                                │
│                             │                                │
│ [デフォルトに戻す]          │                                │
└────────────────────────────┴────────────────────────────────┘
```

### UI の動的生成ルール

スキーマを走査して以下のルールで入力欄を生成する：

- `type: 'number'` → スライダー（`<input type="range">`）＋数値ボックス（`<input type="number">`）を横並び。両者は連動。右端に unit 表示。
- `type: 'array'` → 各行に列分の数値ボックスを並べたテーブル。「行追加」「行削除」ボタン付き。
- セクションは折りたたみ可能（`▾`/`▸` トグル）。デフォルト展開。

### プレビューの動作

- ▶ ボタンを押したとき、**現在の画面上の値**（保存前でも OK）でアニメーションを再生する。
- ゲームページとは切り離されたダミーカード要素で動かす。
- SlamDrop: プレビュー枠内の左カードが右の着地先へ飛ぶ。WAAPI を直接呼ぶ。
- ScreenShake: プレビュー枠全体に `element.animate()` を適用。
- ImpactBounce: ダミーカード複数枚を scale バウンスさせる。
- Sparkle: プレビュー中央から発動（既存の `triggerScoreEffects` ロジックを関数として切り出して再利用）。
- ScoreDelta: プレビュー中央に `+100` をフロートアップ。

### エラー処理

- 保存 API が 404 / 接続失敗 → 「npm run dev で起動してください」エラー表示（既存 admin と同様）。
- array フィールドのバリデーション：各数値が min/max 範囲内か確認し、範囲外の場合は保存ボタンを無効化してエラーメッセージを表示。

---

## ゲームページの変更（`+page.svelte`）

### 1. config の読み込み

```ts
import defaultAnimConfig from '$lib/game/solitaire/anim.config.json'
// ビルド時バンドル → 本番でも有効
// dev で手動リロードすれば最新の JSON が取り込まれる
```

### 2. slamDrop: CSS @keyframes → WAAPI 変換

CSS の `@keyframes slamDrop` と `.slam-drop` クラスを削除する。スラムゴースト要素（`{#if slamAnim}` ブロックのルート div）に `id="slam-ghost"` を追加し、`performSlamDrop` 関数内で直接 WAAPI を呼ぶ：

```ts
const cfg = defaultAnimConfig.slamDrop
const ghostEl = document.getElementById('slam-ghost') as HTMLElement
ghostEl.animate([
  { transform: 'translate(0,0) scale(1) rotate(0deg)', offset: 0 },
  { transform: `translate(${tx*0.02}px,${ty*0.02}px) scale(${cfg.peakScale}) rotate(${cfg.peakRotateDeg}deg) translateY(${cfg.peakLiftPx}px)`,
    offset: cfg.peakAt },
  { transform: `translate(${tx*0.99}px,${ty*0.99}px) scale(${cfg.landScale}) rotate(${cfg.landRotateDeg}deg)`,
    offset: cfg.landAt },
  { transform: `translate(${tx}px,${ty}px) scale(1) rotate(0deg)`, offset: 1 },
], {
  duration: cfg.durationMs,
  easing: 'linear',
  fill: 'forwards',
})
```

着地タイミング（`performSlamDrop` 内の `setTimeout`）も `cfg.durationMs * cfg.landAt` で計算する。

### 3. その他のアニメーション関数

`triggerScreenShake`、`triggerImpactBounce`、`triggerScoreEffects`（スパークル）、スコアデルタ CSS の各ハードコード値を `defaultAnimConfig.<section>.<field>` に置き換える。

---

## 非機能要件

- admin ページは dev サーバーでのみ使用。本番でアクセスすると API エラーが表示されるが、ゲームは動作する（バンドルされた JSON で動く）。
- `anim.config.json` の変更はゲームページを手動リロードして反映する。
- 新パラメータ追加時はスキーマに1エントリ足すだけで UI が自動的に増える。
