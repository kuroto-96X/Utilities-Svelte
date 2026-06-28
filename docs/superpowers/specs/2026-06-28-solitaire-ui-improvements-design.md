# Solitaire UI改善 — 設計ドキュメント

**日付**: 2026-06-28
**ブランチ**: feat
**対象ファイル**: `src/routes/game/solitaire/+page.svelte`（メイン）

---

## 概要

初版ソリティアUIに対して、カードビジュアルの整理・操作性向上・バグ修正・スコア永続化を行う。変更はUIレイヤー（`+page.svelte`）に集中し、エンジン（`engine.ts`）の変更は不要。

---

## セクション 1: カードビジュアル

### カード比率の統一

全カードを `width: 64px / height: 98px`（比率 1:1.531、指定の1:1.534に近似）に統一する。
現在はTailwind `w-16 h-24`（64×96px）を使用しており、高さを2px調整するだけ。
Tailwindの任意値 `h-[98px]` を使用。

### 裏面デザイン（C案: ダークネイビー グリッド）

黒地(#0f172a)に青紫系の格子線を `repeating-linear-gradient` 2方向で描画。
縁に薄い青紫の枠線を追加してカード感を強調。

```css
background: #0f172a;
border: 1px solid rgba(99, 102, 241, 0.5);
/* 内側の格子 */
background-image:
  repeating-linear-gradient(0deg, transparent, transparent 7px, rgba(99,102,241,0.25) 7px, rgba(99,102,241,0.25) 8px),
  repeating-linear-gradient(90deg, transparent, transparent 7px, rgba(99,102,241,0.25) 7px, rgba(99,102,241,0.25) 8px);
```

### 山札の積み重ね表示

stock が空でないとき、残り枚数に応じて裏面カードを重ねて表示：
- 21枚以上: 3枚重ね（各2px offset）
- 11〜20枚: 2枚重ね（各2px offset）
- 1〜10枚: 1枚
- 0枚: 「↺」アイコン（リサイクル操作）

実装: `Math.min(3, Math.ceil(state.stock.length / 10))` で重ね枚数を計算し、絶対配置でオフセット。

---

## セクション 2: 操作・インタラクション

### 選択中カードの見た目（A案: 青い太枠＋リング）

選択されたカード（複数枚の場合は移動対象全て）に以下を適用：
- `ring-2 ring-blue-400 ring-offset-1`（青い太枠）
- `-translate-y-1`（1px上にシフトして「持ち上げた感」を演出）

現在の黄色い細枠（`border-yellow-400`）は廃止。

### ドラッグ操作（Pointer Events）

クリック操作（選択→移動先クリック）は引き続き機能。ドラッグを追加操作方法として実装。

**開始判定**: `onpointerdown` でカード情報を記録。ポインターが5px以上移動したらドラッグ開始。5px未満でポインターアップ → クリックとして処理。

**ドラッグ中**:
- `element.setPointerCapture(pointerId)` でキャプチャ
- 掴んだカード以下の表向きカード全枚数が「ゴースト」としてカーソルに追従
- ゴーストは半透明（opacity 0.85）、fixed配置でカーソルの少し上に表示
- 元の位置のカードは opacity 0.4 で半透明表示（どこから動かしたか分かるように）

**ドロップ先プレビュー**:
ドラッグ中、有効な移動先の上をホバーしたとき点線枠（`border-dashed border-2 border-blue-400`）でハイライト。
- `document.elementsFromPoint(x, y)` で下にある要素を検出
- data属性（`data-pile`, `data-index`）でpile/indexを特定
- `moveCards` でチェックして合法手なら点線表示

**ドロップ**:
- 有効な移動先: 移動実行
- 無効な場所: ゴーストが元位置に戻るアニメーション（`transition: transform 0.15s`）

### ダブルクリック → Foundation自動移動

表向きカード（tableau・waste・foundation）をダブルクリック → foundationへの合法手があれば自動移動。
- `ondblclick` イベントを各カードに追加
- `getHints(state).find(h => h.from.pile === pile && h.from.index === index && h.to.pile === 'foundation')` で対象手を検索
- 見つかれば `moveCards` を実行

---

## セクション 3: ヒントのバグ修正

### 修正1: hintIndex のズレ

**問題**: `handleHint()` 内でhints設定前にインデックスをインクリメントするため、初回クリックでhint[0]がスキップされる。

**修正**:
```typescript
function handleHint() {
  if (showHints && hints.length > 0) {
    hintIndex = (hintIndex + 1) % hints.length
    return
  }
  const h = getHints(state)
  if (h.length === 0) return
  hints = h
  showHints = true
  hintIndex = 0  // 常に0から開始
}
```

### 修正2: タブローのハイライト対象カード

**問題**: `col.findIndex(c => c.faceUp)` で常に「最初の表向きカード」を強調するため、移動対象と一致しないケースがある。

**修正**: 現在のヒントの `count` を使い、実際に移動するカード群（上からcount枚）全てにハイライトを適用。

```typescript
// テンプレート内
{@const hint = (showHints && hints.length > 0) ? hints[hintIndex % hints.length] : null}
// タブローカードのハイライト条件:
const isHintHighlighted = hint?.from.pile === 'tableau'
  && hint?.from.index === colIdx
  && cardIdx >= col.length - hint.count
```

### 修正3: Foundation のヒント未対応

**問題**: foundationボタンにhintのハイライト判定が存在しない。

**修正**: foundationボタンに以下を追加：
```svelte
class:ring-2={hint?.from.pile === 'foundation' && hint?.from.index === i}
class:ring-yellow-400={hint?.from.pile === 'foundation' && hint?.from.index === i}
```

---

## セクション 4: TOP10スコア

### データ構造

```typescript
interface ScoreEntry {
  score: number
  elapsed: number   // クリアタイム（秒）
  drawMode: 1 | 3
  date: string      // ISO 8601 (例: "2026-06-28")
}
// localStorageキー: 'solitaire-top10'
// 値: ScoreEntry[] (最大10件、score降順)
```

### 保存タイミング

ゲームクリア時（`isVictory` が true になった瞬間）に自動登録：
1. localStorageから既存エントリを読み込む
2. 新エントリを追加
3. スコア降順ソート（同点の場合はタイム昇順）、上位10件のみ保持
4. localStorageに保存
5. 勝利モーダルに順位を表示（例:「🏆 3位入り！」）

### 常時表示

ゲームエリアの下にランキングテーブルを常時表示：

```
┌─────────────────────────────────┐
│ 🏆 TOP 10                       │
├───┬───────┬────────┬──────┬─────┤
│ # │ Score │  Time  │ Draw │ 日付 │
├───┼───────┼────────┼──────┼─────┤
│ 1 │ 340pt │ 05:12  │  1枚 │ 6/28│
│ 2 │ 280pt │ 08:30  │  3枚 │ 6/27│
│ ...                              │
└─────────────────────────────────┘
```

エントリがない場合は「まだ記録がありません」を表示。

---

## 変更ファイル

| ファイル | 変更内容 |
|---------|---------|
| `src/routes/game/solitaire/+page.svelte` | 全変更（UI・インタラクション・TOP10） |

エンジン（`engine.ts`・`types.ts`）の変更は不要。

---

## スコープ外

- タッチデバイス専用最適化（基本的なPointer Eventsはタッチも動く）
- カードフリップアニメーション
- ドラッグ中の物理的な慣性アニメーション
