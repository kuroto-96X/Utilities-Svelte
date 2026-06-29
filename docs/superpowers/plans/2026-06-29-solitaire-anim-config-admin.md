# ソリティア アニメーション設定 Admin ページ 実装プラン

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** `/admin/anim-config` ページでソリティアのアニメーションパラメータをスライダー・テキストボックスで調整し JSON ファイルに保存できるようにする。ゲームページは JSON を import して各アニメーション関数に適用する。

**Architecture:** スキーマ駆動の UI 自動生成。`anim.config.json`（値）と `anim.config.schema.ts`（型・メタ情報・デフォルト値）を分離し、admin ページはスキーマを走査して入力欄を生成する。Vite dev ミドルウェアプラグインで GET/POST API を提供。slamDrop アニメーションは CSS @keyframes から WAAPI に移行してパラメータを動的制御する。

**Tech Stack:** SvelteKit + Svelte 5 runes (`$state`, `$derived`)、Tailwind CSS v3、Web Animations API (WAAPI)、Vite configureServer ミドルウェア

---

## ファイルマップ

| ファイル | 操作 |
|---------|------|
| `src/lib/game/solitaire/anim.config.json` | 新規作成 |
| `src/lib/game/solitaire/anim.config.schema.ts` | 新規作成 |
| `src/routes/admin/anim-config/+page.svelte` | 新規作成 |
| `vite.config.ts` | 変更（プラグイン追加・watch.ignored 更新） |
| `src/routes/game/solitaire/+page.svelte` | 変更（config 適用・slamDrop WAAPI 化） |

---

## Task 1: 設定ファイルとスキーマファイルの作成

**Files:**
- Create: `src/lib/game/solitaire/anim.config.json`
- Create: `src/lib/game/solitaire/anim.config.schema.ts`

- [ ] **Step 1: anim.config.json を作成する**

`src/lib/game/solitaire/anim.config.json` を以下の内容で作成する。

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

- [ ] **Step 2: anim.config.schema.ts を作成する**

`src/lib/game/solitaire/anim.config.schema.ts` を以下の内容で作成する。

```ts
export type NumberField = {
  type: 'number'
  label: string
  min: number
  max: number
  step: number
  unit?: string
}

export type ArrayField = {
  type: 'array'
  label: string
  columns: Record<string, NumberField>
}

export type FieldSchema = NumberField | ArrayField

export type SectionSchema = {
  label: string
  fields: Record<string, FieldSchema>
}

export type AnimConfigSchema = Record<string, SectionSchema>

export type AnimConfig = {
  slamDrop: {
    durationMs: number
    peakAt: number
    landAt: number
    peakScale: number
    peakRotateDeg: number
    peakLiftPx: number
    landScale: number
    landRotateDeg: number
  }
  screenShake: {
    durationMs: number
    frames: Array<{ x: number; y: number; rotateDeg: number }>
  }
  impactBounce: {
    minDistPx: number
    maxDistPx: number
    delayFactor: number
    singleMaxScale: number
    tableauMaxScale: number
    tableauDurationMinMs: number
    tableauDurationRangeMs: number
  }
  sparkle: {
    count: number
    radiusPx: number
    durationMs: number
  }
  scoreDelta: {
    durationMs: number
  }
}

export const DEFAULT_ANIM_CONFIG: AnimConfig = {
  slamDrop: {
    durationMs: 480,
    peakAt: 0.38,
    landAt: 0.84,
    peakScale: 1.85,
    peakRotateDeg: -10,
    peakLiftPx: -60,
    landScale: 1.06,
    landRotateDeg: -1,
  },
  screenShake: {
    durationMs: 400,
    frames: [
      { x: -7, y: -4, rotateDeg: -0.4 },
      { x:  7, y:  5, rotateDeg:  0.4 },
      { x: -5, y: -3, rotateDeg: -0.3 },
      { x:  6, y:  4, rotateDeg:  0.3 },
      { x: -3, y: -2, rotateDeg:  0 },
      { x:  3, y:  2, rotateDeg:  0 },
      { x: -1, y: -1, rotateDeg:  0 },
    ],
  },
  impactBounce: {
    minDistPx: 40,
    maxDistPx: 460,
    delayFactor: 0.55,
    singleMaxScale: 0.18,
    tableauMaxScale: 0.22,
    tableauDurationMinMs: 280,
    tableauDurationRangeMs: 260,
  },
  sparkle: {
    count: 14,
    radiusPx: 90,
    durationMs: 780,
  },
  scoreDelta: {
    durationMs: 1100,
  },
}

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
    },
  },
  screenShake: {
    label: '画面シェイク',
    fields: {
      durationMs: { type: 'number', label: '総時間', min: 100, max: 1000, step: 10, unit: 'ms' },
      frames: {
        type: 'array',
        label: 'フレーム列',
        columns: {
          x:         { type: 'number', label: 'X',   min: -30, max: 30, step: 0.5, unit: 'px' },
          y:         { type: 'number', label: 'Y',   min: -30, max: 30, step: 0.5, unit: 'px' },
          rotateDeg: { type: 'number', label: '回転', min: -3,  max: 3,  step: 0.1, unit: '°' },
        },
      },
    },
  },
  impactBounce: {
    label: '衝撃バウンス',
    fields: {
      minDistPx:              { type: 'number', label: '最小距離',             min: 0,   max: 200,  step: 5,    unit: 'px' },
      maxDistPx:              { type: 'number', label: '最大距離',             min: 100, max: 1000, step: 10,   unit: 'px' },
      delayFactor:            { type: 'number', label: '遅延係数',             min: 0,   max: 2,    step: 0.05, unit: 'ms/px' },
      singleMaxScale:         { type: 'number', label: '単体最大スケール',     min: 0,   max: 0.5,  step: 0.01 },
      tableauMaxScale:        { type: 'number', label: 'タブロー最大スケール', min: 0,   max: 0.5,  step: 0.01 },
      tableauDurationMinMs:   { type: 'number', label: '奥カード時間',         min: 50,  max: 500,  step: 10,   unit: 'ms' },
      tableauDurationRangeMs: { type: 'number', label: '時間レンジ',           min: 0,   max: 500,  step: 10,   unit: 'ms' },
    },
  },
  sparkle: {
    label: 'スパークル',
    fields: {
      count:      { type: 'number', label: '発射数',  min: 1,   max: 40,   step: 1 },
      radiusPx:   { type: 'number', label: '広がり',  min: 20,  max: 300,  step: 5,  unit: 'px' },
      durationMs: { type: 'number', label: '時間',    min: 100, max: 2000, step: 10, unit: 'ms' },
    },
  },
  scoreDelta: {
    label: 'スコア差分',
    fields: {
      durationMs: { type: 'number', label: '時間', min: 200, max: 3000, step: 50, unit: 'ms' },
    },
  },
}
```

- [ ] **Step 3: ビルドが通ることを確認する**

```bash
npm run build
```

期待: エラーなし。

- [ ] **Step 4: コミット**

```bash
git add src/lib/game/solitaire/anim.config.json src/lib/game/solitaire/anim.config.schema.ts
git commit -m "feat: ソリティアアニメーション設定ファイルとスキーマを追加"
```

---

## Task 2: Vite プラグイン追加

**Files:**
- Modify: `vite.config.ts`

- [ ] **Step 1: animConfigApiPlugin 関数を追加する**

`vite.config.ts` を開く。`adminApiPlugin` 関数の直後（`export default defineConfig` の前）に以下を追加する。

```ts
function animConfigApiPlugin(): Plugin {
  return {
    name: 'anim-config-api',
    enforce: 'pre',
    configureServer(server) {
      const configPath = path.resolve('src/lib/game/solitaire/anim.config.json')
      server.middlewares.use('/api/admin/anim-config', (req, res) => {
        if (req.method === 'GET') {
          try {
            res.setHeader('Content-Type', 'application/json')
            res.end(readFileSync(configPath, 'utf-8'))
          } catch {
            res.statusCode = 500
            res.end('error reading config')
          }
        } else if (req.method === 'POST') {
          let body = ''
          req.on('data', (chunk: Buffer) => { body += chunk.toString() })
          req.on('end', () => {
            try {
              const parsed = JSON.parse(body)
              writeFileSync(configPath, JSON.stringify(parsed, null, 2) + '\n')
              res.statusCode = 200
              res.end('ok')
            } catch {
              res.statusCode = 400
              res.end('invalid JSON')
            }
          })
        } else {
          res.statusCode = 405
          res.end('method not allowed')
        }
      })
    }
  }
}
```

- [ ] **Step 2: プラグインを plugins 配列に追加し、watch.ignored を更新する**

`export default defineConfig` ブロックを以下のように変更する（`animConfigApiPlugin()` を追加し、`ignored` に `anim.config.json` を追加）。

```ts
export default defineConfig({
  plugins: [sveltekit(), kuromojiDictRawPlugin(), adminApiPlugin(), animConfigApiPlugin()],
  build: {
    outDir: 'dist'
  },
  server: {
    watch: {
      // 保存APIで書き換えるたびにHMRが発火してコンポーネントが再マウントされるのを防ぐ
      ignored: ['**/site.config.json', '**/anim.config.json']
    }
  },
  resolve: {
    alias: {
      kuromoji: path.resolve('node_modules/kuromoji/build/kuromoji.js')
    }
  },
  optimizeDeps: {
    include: ['kuromoji']
  }
});
```

- [ ] **Step 3: dev サーバーを起動して API を確認する**

```bash
npm run dev
```

別ターミナルで以下を実行（または curl が使えない場合はブラウザで `http://localhost:5173/api/admin/anim-config` を開く）：

```bash
curl http://localhost:5173/api/admin/anim-config
```

期待: `anim.config.json` の内容が JSON で返ってくる。

- [ ] **Step 4: コミット**

```bash
git add vite.config.ts
git commit -m "feat: アニメーション設定用Viteプラグインを追加"
```

---

## Task 3: ゲームページへの config 適用と slamDrop WAAPI 化

このタスクは `src/routes/game/solitaire/+page.svelte` の1ファイルのみを変更する。変更点は5箇所。

**Files:**
- Modify: `src/routes/game/solitaire/+page.svelte`

### Step 1: config を import する

- [ ] **Step 1: script 先頭の import 群に追加する**

ファイル先頭の `import` 行群（`import { onMount, tick } from 'svelte'` などがある箇所）の末尾に以下を追加する。

```ts
import defaultAnimConfigJson from '$lib/game/solitaire/anim.config.json'
import type { AnimConfig } from '$lib/game/solitaire/anim.config.schema'
const cfg = defaultAnimConfigJson as AnimConfig
```

### Step 2: triggerScreenShake を config 参照に変更する

- [ ] **Step 2: triggerScreenShake 関数を書き換える**

現在の `triggerScreenShake` 関数（`gameEl.animate([...` 部分）を以下に置き換える。

```ts
  function triggerScreenShake() {
    if (!gameEl) return
    const c = cfg.screenShake
    const keyframes: Keyframe[] = [
      { transform: 'translate(0,0) rotate(0deg)' },
      ...c.frames.map(f => ({ transform: `translate(${f.x}px,${f.y}px) rotate(${f.rotateDeg}deg)` })),
      { transform: 'translate(0,0) rotate(0deg)' },
    ]
    gameEl.animate(keyframes, { duration: c.durationMs, easing: 'ease-out', fill: 'none' })
  }
```

### Step 3: triggerImpactBounce を config 参照に変更する

- [ ] **Step 3: triggerImpactBounce 関数を書き換える**

現在の `triggerImpactBounce` 関数全体を以下に置き換える。

```ts
  function triggerImpactBounce(cx: number, cy: number) {
    const c = cfg.impactBounce

    // 組み札・捨て札: 単体でスケールバウンス（手前に浮く）
    const singleEls: Element[] = [...document.querySelectorAll('[data-pile="foundation"]')]
    const wasteEl = document.querySelector('[data-waste]')
    if (wasteEl) singleEls.push(wasteEl)

    singleEls.forEach(el => {
      const r = el.getBoundingClientRect()
      const dist = Math.hypot(r.left + r.width / 2 - cx, r.top + r.height / 2 - cy)
      if (dist < c.minDistPx || dist > c.maxDistPx) return
      const factor = 1 - dist / c.maxDistPx
      const maxScale = +(factor * c.singleMaxScale).toFixed(3)
      if (maxScale < 0.01) return
      el.animate([
        { transform: 'scale(1)' },
        { transform: `scale(${(1 + maxScale).toFixed(3)})` },
        { transform: `scale(${(1 + maxScale * 0.1).toFixed(3)})` },
        { transform: 'scale(1)' },
      ], { duration: 400, delay: Math.round(dist * c.delayFactor), easing: 'ease-out', fill: 'none' })
    })

    // タブロー: カードごとに深さ依存のスケールバウンス
    document.querySelectorAll('[data-pile="tableau"]').forEach(colEl => {
      const colR = colEl.getBoundingClientRect()
      const dist = Math.hypot(colR.left + colR.width / 2 - cx, colR.top + colR.height / 2 - cy)
      if (dist < c.minDistPx || dist > c.maxDistPx) return
      const colFactor = 1 - dist / c.maxDistPx
      const baseDelay = Math.round(dist * c.delayFactor)

      const cardEls = colEl.querySelectorAll('[data-card-idx]')
      const total = cardEls.length
      if (total === 0) return

      cardEls.forEach(cardEl => {
        const cardIdx = parseInt((cardEl as HTMLElement).dataset.cardIdx ?? '0')
        const depthFactor = (cardIdx + 1) / total
        const maxScale = +(colFactor * depthFactor * c.tableauMaxScale).toFixed(3)
        if (maxScale < 0.01) return
        const duration = c.tableauDurationMinMs + Math.round(depthFactor * c.tableauDurationRangeMs)

        cardEl.animate([
          { transform: 'scale(1)' },
          { transform: `scale(${(1 + maxScale).toFixed(3)})` },
          { transform: `scale(${(1 + maxScale * 0.08).toFixed(3)})` },
          { transform: 'scale(1)' },
        ], { duration, delay: baseDelay, easing: 'ease-out', fill: 'none', composite: 'add' })
      })
    })
  }
```

### Step 4: slamDrop を CSS @keyframes から WAAPI に移行する

この変更は3箇所に分かれる。

- [ ] **Step 4a: performSlamDrop 関数内の playing 以降を書き換える**

`performSlamDrop` 内の以下のブロック:
```ts
    slamAnim = { ...slamAnim!, playing: true }

    // アニメーション84%地点(着地) = 403ms
    await new Promise<void>(r => setTimeout(r, 403))
```

を以下に置き換える:
```ts
    slamAnim = { ...slamAnim!, playing: true }
    await new Promise<void>(r => requestAnimationFrame(() => r()))

    const ghostEl = document.getElementById('slam-ghost')
    if (ghostEl) {
      const sc = cfg.slamDrop
      const tx = slamAnim!.toX - slamAnim!.fromX
      const ty = slamAnim!.toY - slamAnim!.fromY
      ghostEl.animate([
        { transform: 'translate(0,0) scale(1) rotate(0deg)',                                                                                                                     offset: 0 },
        { transform: `translate(${tx*0.02}px,${ty*0.02}px) scale(${sc.peakScale}) rotate(${sc.peakRotateDeg}deg) translateY(${sc.peakLiftPx}px)`,                               offset: sc.peakAt },
        { transform: `translate(${tx*0.99}px,${ty*0.99}px) scale(${sc.landScale}) rotate(${sc.landRotateDeg}deg)`,                                                              offset: sc.landAt },
        { transform: `translate(${tx}px,${ty}px) scale(1) rotate(0deg)`,                                                                                                        offset: 1 },
      ], { duration: sc.durationMs, easing: 'linear', fill: 'forwards' })
    }

    // 着地タイミング: durationMs * landAt
    await new Promise<void>(r => setTimeout(r, Math.round(cfg.slamDrop.durationMs * cfg.slamDrop.landAt)))
```

また、その直後の「アニメーション完了まで待機」の `setTimeout` を以下に変更する:
```ts
    // アニメーション完了まで待機 (残り時間 = duration * (1 - landAt))
    await new Promise<void>(r => setTimeout(r, Math.round(cfg.slamDrop.durationMs * (1 - cfg.slamDrop.landAt)) + 10))
```

- [ ] **Step 4b: スラムゴースト要素に id を追加する**

テンプレート内の以下の行:
```svelte
  {#if slamAnim}
    {@const tx = slamAnim.toX - slamAnim.fromX}
    {@const ty = slamAnim.toY - slamAnim.fromY}
    <div
      class="pointer-events-none fixed z-[300]"
      class:slam-drop={slamAnim.playing}
      style="left:{slamAnim.fromX}px; top:{slamAnim.fromY}px; --tx:{tx}px; --ty:{ty}px; filter: drop-shadow(0 16px 32px rgba(0,0,0,0.7)) drop-shadow(0 0 12px rgba(251,191,36,0.5));"
    >
```

を以下に置き換える（`id="slam-ghost"` を追加し、`class:slam-drop`・`--tx`・`--ty` を削除）:
```svelte
  {#if slamAnim}
    <div
      id="slam-ghost"
      class="pointer-events-none fixed z-[300]"
      style="left:{slamAnim.fromX}px; top:{slamAnim.fromY}px; filter: drop-shadow(0 16px 32px rgba(0,0,0,0.7)) drop-shadow(0 0 12px rgba(251,191,36,0.5));"
    >
```

- [ ] **Step 4c: CSS の @keyframes slamDrop と .slam-drop クラスを削除する**

`<style>` ブロック内の以下をまるごと削除する:
```css
@keyframes slamDrop {
  0%   { transform: translate(0, 0) scale(1) rotate(0deg); animation-timing-function: cubic-bezier(0.2, 0, 0.4, 1); }
  38%  { transform: translate(calc(var(--tx)*0.02), calc(var(--ty)*0.02)) scale(1.85) rotate(-10deg) translateY(-60px); animation-timing-function: cubic-bezier(0.8, 0, 1, 1); }
  84%  { transform: translate(calc(var(--tx)*0.99), calc(var(--ty)*0.99)) scale(1.06) rotate(-1deg); animation-timing-function: ease-out; }
  100% { transform: translate(var(--tx), var(--ty)) scale(1) rotate(0deg); }
}
.slam-drop {
  animation: slamDrop 480ms linear forwards;
}
```

### Step 5: triggerSparkles と scoreDelta を config 参照に変更する

- [ ] **Step 5a: triggerSparkles 関数を書き換える**

現在の `triggerSparkles` 関数を以下に置き換える。

```ts
  function triggerSparkles(cx: number, cy: number) {
    const { count, radiusPx, durationMs } = cfg.sparkle
    const batch: Sparkle[] = []
    for (let i = 0; i < count; i++) {
      const angle = (i / count) * Math.PI * 2 + (Math.random() - 0.5) * 0.4
      const dist  = radiusPx * (0.5 + Math.random() * 0.5)
      batch.push({
        id:    _effectId++,
        x:     cx, y: cy,
        dx:    Math.cos(angle) * dist,
        dy:    Math.sin(angle) * dist,
        color: SPARK_COLORS[Math.floor(Math.random() * SPARK_COLORS.length)],
        size:  10 + Math.random() * 11,
        delay: Math.floor(Math.random() * 80),
        char:  SPARK_CHARS[Math.floor(Math.random() * SPARK_CHARS.length)],
      })
    }
    sparkles = [...sparkles, ...batch]
    const ids = new Set(batch.map(s => s.id))
    setTimeout(() => { sparkles = sparkles.filter(s => !ids.has(s.id)) }, durationMs + 200)
  }
```

- [ ] **Step 5b: triggerScoreDisplayEffect の cleanup タイマーを config 参照に変更する**

```ts
  function triggerScoreDisplayEffect(delta: number) {
    if (delta === 0) return
    const el = document.querySelector('[data-score-display]')
    if (!el) return
    const rect = el.getBoundingClientRect()
    const id = _effectId++
    scoreDeltas = [...scoreDeltas, { id, delta, x: rect.left + rect.width / 2, y: rect.top }]
    setTimeout(() => { scoreDeltas = scoreDeltas.filter(s => s.id !== id) }, cfg.scoreDelta.durationMs)
  }
```

- [ ] **Step 5c: triggerScoreEffects の floatScores cleanup タイマーを config 参照に変更する**

```ts
  function triggerScoreEffects(delta: number, destEl: Element | null) {
    if (delta <= 0 || !destEl) return
    const rect = destEl.getBoundingClientRect()
    const fid = _effectId++
    floatScores = [...floatScores, { id: fid, delta, x: rect.left + rect.width / 2, y: rect.top + 10 }]
    setTimeout(() => { floatScores = floatScores.filter(f => f.id !== fid) }, cfg.scoreDelta.durationMs)
    const gid = _effectId++
    glowEffects = [...glowEffects, { id: gid, x: rect.left, y: rect.top, w: rect.width, h: rect.height }]
    setTimeout(() => { glowEffects = glowEffects.filter(g => g.id !== gid) }, 650)
    triggerSparkles(rect.left + rect.width / 2, rect.top + rect.height / 2)
  }
```

- [ ] **Step 5d: sparkle-particle と score-delta の CSS アニメーション時間を inline style 経由にする**

テンプレート内の sparkle span を以下に変更する（`animation-duration` を追加）:
```svelte
{#each sparkles as s (s.id)}
  <span class="sparkle-particle" style="left:{s.x}px; top:{s.y}px; --dx:{s.dx}px; --dy:{s.dy}px; color:{s.color}; font-size:{s.size}px; animation-delay:{s.delay}ms; animation-duration:{cfg.sparkle.durationMs}ms;">{s.char}</span>
{/each}
```

scoreDeltas の div を以下に変更する（`animation-duration` を追加）:
```svelte
{#each scoreDeltas as sd (sd.id)}
  <div class="score-delta {sd.delta > 0 ? 'score-delta-pos' : 'score-delta-neg'}" style="left:{sd.x}px; top:{sd.y}px; animation-duration:{cfg.scoreDelta.durationMs}ms;">{sd.delta > 0 ? '+' : ''}{sd.delta}</div>
{/each}
```

floatScores の div を以下に変更する（`animation-duration` を追加）:
```svelte
{#each floatScores as fs (fs.id)}
  <div class="float-score" style="left:{fs.x}px; top:{fs.y}px; animation-duration:{cfg.scoreDelta.durationMs}ms;">+{fs.delta}</div>
{/each}
```

CSS の `@keyframes sparkleShoot` の `animation` 行から時間指定を変数に変更する:
```css
.sparkle-particle {
  position: fixed;
  pointer-events: none;
  z-index: 700;
  line-height: 1;
  animation: sparkleShoot 780ms ease-out forwards;
  text-shadow: 0 0 8px currentColor, 0 0 16px currentColor;
}
```
（inline style の `animation-duration` が CSS の `animation` 宣言の時間を上書きするため、CSS 側は任意の値でよい）

### Step 6: ビルドと動作確認

- [ ] **Step 6: ビルドして動作確認する**

```bash
npm run build
npm run dev
```

`http://localhost:5173/game/solitaire` を開き、ドラッグ&ドロップでスラムアニメーションが以前と同様に動作することを確認する。

- [ ] **Step 7: コミット**

```bash
git add src/routes/game/solitaire/+page.svelte
git commit -m "feat: ソリティアアニメーション関数にconfig値を適用、slamDropをWAAPI化"
```

---

## Task 4: Admin ページ UI の作成

**Files:**
- Create: `src/routes/admin/anim-config/+page.svelte`

- [ ] **Step 1: ファイルを作成する**

`src/routes/admin/anim-config/+page.svelte` を以下の内容で作成する。

```svelte
<script lang="ts">
  import { onMount, onDestroy } from 'svelte'
  import { animConfigSchema, DEFAULT_ANIM_CONFIG } from '$lib/game/solitaire/anim.config.schema'
  import type { AnimConfig, ArrayField } from '$lib/game/solitaire/anim.config.schema'

  // ---- 定数（スパークルプレビュー用） ----
  const SPARK_COLORS = ['#fbbf24','#fde68a','#f59e0b','#ffffff','#fb7185','#67e8f9','#c4b5fd','#86efac']
  const SPARK_CHARS  = ['✦','✧','✶','★','✺','✸']

  // ---- 状態 ----
  let config = $state<AnimConfig>(structuredClone(DEFAULT_ANIM_CONFIG))
  let error = $state<string | null>(null)
  let flash = $state<string | null>(null)
  let flashTimer: ReturnType<typeof setTimeout> | null = null
  let openSections = $state<Record<string, boolean>>(
    Object.fromEntries(Object.keys(animConfigSchema).map(k => [k, true]))
  )

  // プレビュー用 state
  let previewEl: HTMLElement | null = null
  let previewSourceEl: HTMLElement | null = null
  let previewDestEl: HTMLElement | null = null
  interface PreviewSparkle { id: number; x: number; y: number; dx: number; dy: number; color: string; size: number; delay: number; char: string }
  let previewSparkles = $state<PreviewSparkle[]>([])
  interface PreviewScoreDelta { id: number; x: number; y: number }
  let previewScoreDeltas = $state<PreviewScoreDelta[]>([])
  let _pid = 0

  // ---- バリデーション ----
  let validationErrors = $derived(validateConfig(config))

  function validateConfig(c: AnimConfig): string[] {
    const errs: string[] = []
    for (const [sectionKey, section] of Object.entries(animConfigSchema)) {
      for (const [fieldKey, field] of Object.entries(section.fields)) {
        if (field.type === 'array') {
          const rows = (c as Record<string, Record<string, unknown[]>>)[sectionKey][fieldKey] as Record<string, number>[]
          rows.forEach((row, i) => {
            for (const [colKey, col] of Object.entries(field.columns)) {
              const v = row[colKey]
              if (v < col.min || v > col.max) {
                errs.push(`${section.label} > ${field.label} 行${i + 1} ${col.label}: ${v} は ${col.min}〜${col.max} の範囲外`)
              }
            }
          })
        }
      }
    }
    return errs
  }

  // ---- API ----
  function showToast(msg: string) {
    if (flashTimer) clearTimeout(flashTimer)
    flash = msg
    flashTimer = setTimeout(() => { flash = null }, 2000)
  }

  async function loadConfig(toast = false) {
    try {
      const res = await fetch('/api/admin/anim-config')
      if (!res.ok) throw new Error(`HTTP ${res.status}`)
      config = await res.json() as AnimConfig
      error = null
      if (toast) showToast('リロードしました')
    } catch {
      error = 'アニメーション設定 API に接続できません。npm run dev で起動してください。'
    }
  }

  async function save() {
    if (validationErrors.length > 0) return
    try {
      const res = await fetch('/api/admin/anim-config', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(config),
      })
      if (!res.ok) throw new Error(`HTTP ${res.status}`)
      showToast('保存しました（ゲームページをリロードして反映）')
    } catch {
      error = '保存に失敗しました'
    }
  }

  function resetToDefault() {
    config = structuredClone(DEFAULT_ANIM_CONFIG)
  }

  onMount(() => loadConfig())
  onDestroy(() => { if (flashTimer) clearTimeout(flashTimer) })

  // ---- ヘルパー: config の nested な値を取得・設定 ----
  function getVal(sectionKey: string, fieldKey: string): number {
    return (config as Record<string, Record<string, number>>)[sectionKey][fieldKey]
  }

  function setVal(sectionKey: string, fieldKey: string, val: number) {
    ;(config as Record<string, Record<string, number>>)[sectionKey][fieldKey] = val
  }

  function getArr(sectionKey: string, fieldKey: string): Record<string, number>[] {
    return (config as Record<string, Record<string, Record<string, number>[]>>)[sectionKey][fieldKey]
  }

  function setArrCell(sectionKey: string, fieldKey: string, rowIdx: number, colKey: string, val: number) {
    ;(config as Record<string, Record<string, Record<string, number>[]>>)[sectionKey][fieldKey][rowIdx][colKey] = val
  }

  function addArrRow(sectionKey: string, fieldKey: string, field: ArrayField) {
    const newRow = Object.fromEntries(Object.keys(field.columns).map(k => [k, 0]))
    ;(config as Record<string, Record<string, Record<string, number>[]>>)[sectionKey][fieldKey] = [
      ...getArr(sectionKey, fieldKey),
      newRow,
    ]
  }

  function removeArrRow(sectionKey: string, fieldKey: string, rowIdx: number) {
    const arr = getArr(sectionKey, fieldKey)
    arr.splice(rowIdx, 1)
    ;(config as Record<string, Record<string, Record<string, number>[]>>)[sectionKey][fieldKey] = [...arr]
  }

  // ---- プレビュー関数 ----
  function previewSlamDrop() {
    if (!previewSourceEl || !previewDestEl) return
    const srcRect = previewSourceEl.getBoundingClientRect()
    const dstRect = previewDestEl.getBoundingClientRect()
    const tx = dstRect.left - srcRect.left
    const ty = dstRect.top - srcRect.top
    const sc = config.slamDrop

    const ghost = document.createElement('div')
    ghost.style.cssText = `position:fixed; left:${srcRect.left}px; top:${srcRect.top}px; width:64px; height:98px; background:#1e3a5f; border:1px solid #94a3b8; border-radius:8px; z-index:300; pointer-events:none; display:flex; align-items:center; justify-content:center; color:#fff; font-size:1.5rem; filter:drop-shadow(0 8px 16px rgba(0,0,0,0.5));`
    ghost.textContent = '🂡'
    document.body.appendChild(ghost)

    ghost.animate([
      { transform: 'translate(0,0) scale(1) rotate(0deg)',                                                                                         offset: 0 },
      { transform: `translate(${tx*0.02}px,${ty*0.02}px) scale(${sc.peakScale}) rotate(${sc.peakRotateDeg}deg) translateY(${sc.peakLiftPx}px)`,    offset: sc.peakAt },
      { transform: `translate(${tx*0.99}px,${ty*0.99}px) scale(${sc.landScale}) rotate(${sc.landRotateDeg}deg)`,                                   offset: sc.landAt },
      { transform: `translate(${tx}px,${ty}px) scale(1) rotate(0deg)`,                                                                             offset: 1 },
    ], { duration: sc.durationMs, easing: 'linear', fill: 'none' })

    setTimeout(() => ghost.remove(), sc.durationMs + 100)
  }

  function previewScreenShake() {
    if (!previewEl) return
    const c = config.screenShake
    const keyframes: Keyframe[] = [
      { transform: 'translate(0,0) rotate(0deg)' },
      ...c.frames.map(f => ({ transform: `translate(${f.x}px,${f.y}px) rotate(${f.rotateDeg}deg)` })),
      { transform: 'translate(0,0) rotate(0deg)' },
    ]
    previewEl.animate(keyframes, { duration: c.durationMs, easing: 'ease-out', fill: 'none' })
  }

  function previewImpactBounce() {
    if (!previewEl) return
    const c = config.impactBounce
    const cards = previewEl.querySelectorAll('[data-preview-card]')
    const total = cards.length
    cards.forEach((card, i) => {
      const depthFactor = (i + 1) / total
      const maxScale = depthFactor * c.tableauMaxScale
      const duration = c.tableauDurationMinMs + Math.round(depthFactor * c.tableauDurationRangeMs)
      card.animate([
        { transform: 'scale(1)' },
        { transform: `scale(${(1 + maxScale).toFixed(3)})` },
        { transform: `scale(${(1 + maxScale * 0.08).toFixed(3)})` },
        { transform: 'scale(1)' },
      ], { duration, easing: 'ease-out', fill: 'none', composite: 'add' })
    })
  }

  function previewSparkle() {
    if (!previewEl) return
    const c = config.sparkle
    const rect = previewEl.getBoundingClientRect()
    const cx = rect.left + rect.width / 2
    const cy = rect.top + rect.height / 2
    const batch: PreviewSparkle[] = Array.from({ length: c.count }, (_, i) => {
      const angle = (i / c.count) * Math.PI * 2 + (Math.random() - 0.5) * 0.4
      const dist  = c.radiusPx * (0.5 + Math.random() * 0.5)
      return {
        id:    _pid++,
        x: cx, y: cy,
        dx: Math.cos(angle) * dist,
        dy: Math.sin(angle) * dist,
        color: SPARK_COLORS[Math.floor(Math.random() * SPARK_COLORS.length)],
        size:  10 + Math.random() * 11,
        delay: Math.floor(Math.random() * 80),
        char:  SPARK_CHARS[Math.floor(Math.random() * SPARK_CHARS.length)],
      }
    })
    previewSparkles = [...previewSparkles, ...batch]
    const ids = new Set(batch.map(s => s.id))
    setTimeout(() => { previewSparkles = previewSparkles.filter(s => !ids.has(s.id)) }, c.durationMs + 200)
  }

  function previewScoreDelta() {
    if (!previewEl) return
    const rect = previewEl.getBoundingClientRect()
    const id = _pid++
    previewScoreDeltas = [...previewScoreDeltas, {
      id,
      x: rect.left + rect.width / 2,
      y: rect.top + 40,
    }]
    setTimeout(() => { previewScoreDeltas = previewScoreDeltas.filter(s => s.id !== id) }, config.scoreDelta.durationMs + 200)
  }
</script>

<div class="max-w-5xl mx-auto px-4 py-8">
  <!-- ヘッダー -->
  <div class="flex items-center justify-between mb-6">
    <div>
      <h1 class="text-2xl font-bold text-slate-800">アニメーション設定</h1>
      <a href="/admin" class="text-xs text-slate-400 hover:text-teal-600">← メニュー管理</a>
    </div>
    <div class="flex gap-2">
      <button
        onclick={() => loadConfig(true)}
        class="text-sm px-3 py-1.5 rounded-lg border border-slate-200 text-slate-600 hover:bg-slate-50 transition-colors"
      >
        リロード
      </button>
      <button
        onclick={save}
        disabled={validationErrors.length > 0}
        class="text-sm px-3 py-1.5 rounded-lg bg-teal-600 text-white hover:bg-teal-700 transition-colors disabled:opacity-40 disabled:cursor-not-allowed"
      >
        保存
      </button>
    </div>
  </div>

  {#if error}
    <div class="bg-red-50 border border-red-200 text-red-700 px-4 py-3 rounded-lg mb-4 text-sm">
      {error}
    </div>
  {/if}

  {#if validationErrors.length > 0}
    <div class="bg-amber-50 border border-amber-200 text-amber-700 px-4 py-3 rounded-lg mb-4 text-sm">
      <div class="font-semibold mb-1">入力値エラー（保存不可）</div>
      {#each validationErrors as e}
        <div>・{e}</div>
      {/each}
    </div>
  {/if}

  <!-- 2カラム: 設定パネル | プレビュー -->
  <div class="flex gap-6 items-start">
    <!-- 左: 設定パネル -->
    <div class="flex-1 min-w-0 space-y-3">
      {#each Object.entries(animConfigSchema) as [sectionKey, section]}
        {@const isOpen = openSections[sectionKey] ?? true}
        <div class="border border-slate-200 rounded-lg overflow-hidden">
          <button
            onclick={() => { openSections[sectionKey] = !isOpen }}
            class="w-full flex items-center justify-between px-4 py-3 bg-slate-50 hover:bg-slate-100 text-left"
          >
            <span class="font-semibold text-slate-700 text-sm">{section.label}</span>
            <span class="text-slate-400 text-xs">{isOpen ? '▾' : '▸'}</span>
          </button>

          {#if isOpen}
            <div class="px-4 py-3 space-y-3">
              {#each Object.entries(section.fields) as [fieldKey, field]}
                {#if field.type === 'number'}
                  {@const val = getVal(sectionKey, fieldKey)}
                  <div class="flex items-center gap-3">
                    <label class="w-36 text-sm text-slate-600 shrink-0">{field.label}</label>
                    <input
                      type="range"
                      min={field.min} max={field.max} step={field.step}
                      value={val}
                      oninput={(e) => setVal(sectionKey, fieldKey, +e.currentTarget.value)}
                      class="flex-1 accent-teal-600"
                    />
                    <input
                      type="number"
                      min={field.min} max={field.max} step={field.step}
                      value={val}
                      oninput={(e) => setVal(sectionKey, fieldKey, +e.currentTarget.value)}
                      class="w-20 text-right text-sm border border-slate-200 rounded px-2 py-0.5 focus:outline-none focus:border-teal-400"
                    />
                    {#if field.unit}
                      <span class="text-xs text-slate-400 w-10 shrink-0">{field.unit}</span>
                    {:else}
                      <span class="w-10 shrink-0"></span>
                    {/if}
                  </div>
                {:else if field.type === 'array'}
                  <div>
                    <div class="text-sm font-medium text-slate-600 mb-1">{field.label}</div>
                    <table class="text-xs border border-slate-200 rounded overflow-hidden w-full">
                      <thead class="bg-slate-50">
                        <tr>
                          {#each Object.entries(field.columns) as [, col]}
                            <th class="px-2 py-1 text-slate-500 font-medium text-left">
                              {col.label}{#if col.unit}<span class="text-slate-400 font-normal"> ({col.unit})</span>{/if}
                            </th>
                          {/each}
                          <th class="w-6"></th>
                        </tr>
                      </thead>
                      <tbody>
                        {#each getArr(sectionKey, fieldKey) as row, rowIdx}
                          <tr class="border-t border-slate-100">
                            {#each Object.entries(field.columns) as [colKey, col]}
                              <td class="px-1 py-0.5">
                                <input
                                  type="number"
                                  min={col.min} max={col.max} step={col.step}
                                  value={row[colKey]}
                                  oninput={(e) => setArrCell(sectionKey, fieldKey, rowIdx, colKey, +e.currentTarget.value)}
                                  class="w-full text-right border border-slate-100 rounded px-1 py-0.5 focus:outline-none focus:border-teal-400 bg-transparent"
                                />
                              </td>
                            {/each}
                            <td class="px-1 text-center">
                              <button
                                onclick={() => removeArrRow(sectionKey, fieldKey, rowIdx)}
                                class="text-red-300 hover:text-red-500 text-base leading-none"
                              >×</button>
                            </td>
                          </tr>
                        {/each}
                      </tbody>
                    </table>
                    <button
                      onclick={() => addArrRow(sectionKey, fieldKey, field as ArrayField)}
                      class="mt-1 text-xs text-teal-600 hover:text-teal-800"
                    >+ 行追加</button>
                  </div>
                {/if}
              {/each}
            </div>
          {/if}
        </div>
      {/each}

      <button
        onclick={resetToDefault}
        class="text-sm text-slate-400 hover:text-slate-600 underline"
      >デフォルトに戻す</button>
    </div>

    <!-- 右: プレビュー -->
    <div class="w-72 shrink-0">
      <div class="sticky top-6">
        <div class="text-xs font-bold uppercase tracking-wider text-slate-400 mb-2">プレビュー</div>

        <!-- プレビューエリア -->
        <div
          bind:this={previewEl}
          class="border border-slate-200 rounded-xl bg-slate-800 relative overflow-hidden"
          style="height: 180px;"
        >
          <!-- slamDrop 用: ソース -->
          <div
            bind:this={previewSourceEl}
            data-preview-card
            class="absolute w-16 rounded-lg border border-slate-500 bg-indigo-900 flex items-center justify-center text-white text-xl"
            style="left:16px; top:20px; height:98px;"
          >♠A</div>

          <!-- slamDrop 用: デスティネーション -->
          <div
            bind:this={previewDestEl}
            class="absolute w-16 rounded-lg border-2 border-dashed border-slate-500 rounded-lg"
            style="right:16px; top:20px; height:98px;"
          ></div>

          <!-- ImpactBounce 用の追加カード -->
          <div data-preview-card class="absolute w-10 rounded border border-slate-500 bg-slate-700 flex items-center justify-center text-white text-xs" style="left:90px; top:30px; height:64px;">♥3</div>
          <div data-preview-card class="absolute w-10 rounded border border-slate-500 bg-slate-700 flex items-center justify-center text-white text-xs" style="left:140px; top:50px; height:64px;">♦7</div>
          <div data-preview-card class="absolute w-10 rounded border border-slate-500 bg-slate-700 flex items-center justify-center text-white text-xs" style="left:190px; top:35px; height:64px;">♣K</div>
        </div>

        <!-- プレビューボタン群 -->
        <div class="mt-3 space-y-1.5">
          {#each [
            { label: '▶ SlamDrop',     fn: previewSlamDrop },
            { label: '▶ ScreenShake',  fn: previewScreenShake },
            { label: '▶ ImpactBounce', fn: previewImpactBounce },
            { label: '▶ Sparkle',      fn: previewSparkle },
            { label: '▶ ScoreDelta',   fn: previewScoreDelta },
          ] as btn}
            <button
              onclick={btn.fn}
              class="w-full text-left text-sm px-3 py-1.5 rounded-lg border border-slate-200 hover:bg-slate-50 text-slate-700 transition-colors font-mono"
            >{btn.label}</button>
          {/each}
        </div>

        <p class="text-xs text-slate-400 mt-3">保存前でもプレビュー可能。ゲームへの反映はページをリロード。</p>
      </div>
    </div>
  </div>
</div>

<!-- プレビュー用 sparkle・scoreDelta（fixed で body 直下） -->
{#each previewSparkles as s (s.id)}
  <span
    class="pointer-events-none fixed z-[700] leading-none"
    style="left:{s.x}px; top:{s.y}px; --dx:{s.dx}px; --dy:{s.dy}px; color:{s.color}; font-size:{s.size}px; animation-delay:{s.delay}ms; animation-duration:{config.sparkle.durationMs}ms; animation: sparkleShoot {config.sparkle.durationMs}ms ease-out forwards; animation-delay:{s.delay}ms; text-shadow:0 0 8px currentColor, 0 0 16px currentColor;"
  >{s.char}</span>
{/each}

{#each previewScoreDeltas as sd (sd.id)}
  <div
    class="pointer-events-none fixed z-[600] font-extrabold text-sm text-emerald-400 whitespace-nowrap"
    style="left:{sd.x}px; top:{sd.y}px; transform: translateX(-50%); animation: floatUp {config.scoreDelta.durationMs}ms ease-out forwards; text-shadow: 0 0 8px rgba(52,211,153,0.8);"
  >+100</div>
{/each}

{#if flash}
  <div class="fixed bottom-6 right-6 bg-slate-800 text-white text-sm px-4 py-2.5 rounded-lg shadow-lg z-50">
    {flash}
  </div>
{/if}

<style>
@keyframes sparkleShoot {
  0%   { transform: translate(-50%, -50%) translate(0px, 0px) scale(1.5) rotate(0deg); opacity: 1; }
  65%  { opacity: 1; }
  100% { transform: translate(-50%, -50%) translate(var(--dx), var(--dy)) scale(0.1) rotate(300deg); opacity: 0; }
}
@keyframes floatUp {
  0%   { opacity: 1; transform: translateX(-50%) translateY(0) scale(1.3); }
  20%  { opacity: 1; transform: translateX(-50%) translateY(-12px) scale(1); }
  100% { opacity: 0; transform: translateX(-50%) translateY(-55px) scale(0.85); }
}
</style>
```

- [ ] **Step 2: ビルドが通ることを確認する**

```bash
npm run build
```

期待: エラーなし。

- [ ] **Step 3: dev サーバーで動作確認する**

```bash
npm run dev
```

`http://localhost:5173/admin/anim-config` を開き、以下を確認する：
- 各セクション（スラム投下・画面シェイク・衝撃バウンス・スパークル・スコア差分）が表示される
- スライダーを動かすと数値ボックスが連動して変化する
- 数値ボックスを編集するとスライダーが連動する
- 「画面シェイク」セクションのフレーム列テーブルで行追加・削除ができる
- ▶ SlamDrop ボタンを押すとプレビューエリアのカードがアニメーションする
- ▶ ScreenShake ボタンを押すとプレビューエリアが揺れる
- ▶ ImpactBounce ボタンを押すとプレビューエリアのカードが膨らむ
- ▶ Sparkle ボタンを押すとキラキラが発射される
- ▶ ScoreDelta ボタンを押すと +100 が上に流れる
- 「保存」ボタン押下後 → `/game/solitaire` を手動リロードしてアニメーションが変わることを確認

- [ ] **Step 4: コミット**

```bash
git add src/routes/admin/anim-config/+page.svelte
git commit -m "feat: ソリティアアニメーション設定adminページを追加"
```

---

## 自己レビュー

### 1. スペックカバレッジ

| 仕様要件 | 対応タスク |
|---------|-----------|
| anim.config.json の作成 | Task 1 |
| anim.config.schema.ts（型・メタ・デフォルト値） | Task 1 |
| Vite プラグイン（GET/POST /api/admin/anim-config） | Task 2 |
| watch.ignored に追加 | Task 2 |
| ゲームページで config import | Task 3 Step 1 |
| slamDrop CSS → WAAPI 変換 | Task 3 Step 4 |
| triggerScreenShake config 参照 | Task 3 Step 2 |
| triggerImpactBounce config 参照 | Task 3 Step 3 |
| triggerSparkles config 参照 | Task 3 Step 5 |
| scoreDelta / floatScore タイマー config 参照 | Task 3 Step 5 |
| admin UI: スキーマ駆動の number フィールド（スライダー + 数値入力） | Task 4 |
| admin UI: array フィールド（テーブル、行追加・削除） | Task 4 |
| admin UI: セクション折りたたみ | Task 4 |
| admin UI: デフォルトに戻す | Task 4 |
| admin UI: API load/save | Task 4 |
| admin UI: バリデーション（範囲外で保存無効） | Task 4 |
| プレビュー: SlamDrop | Task 4 |
| プレビュー: ScreenShake | Task 4 |
| プレビュー: ImpactBounce | Task 4 |
| プレビュー: Sparkle | Task 4 |
| プレビュー: ScoreDelta | Task 4 |
| dev 専用（本番は API エラー表示） | Task 4（エラーハンドリングで対応） |

### 2. 型の一貫性

- `AnimConfig` 型は Task 1 で定義し、Task 3・Task 4 で使用 ✓
- `animConfigSchema` の key（`slamDrop`, `screenShake`, ...）は `AnimConfig` の key と一致 ✓
- `DEFAULT_ANIM_CONFIG` の値は `anim.config.json` と同一 ✓
- `cfg.slamDrop.durationMs` 等のアクセスパターンは全タスクで統一 ✓
