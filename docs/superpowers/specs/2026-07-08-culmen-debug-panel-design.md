# Culmen デバッグパネル設計

## 0. 背景・目的

先の再設計(`docs/superpowers/specs/2026-07-08-culmen-scoring-redesign-design.md`)で、コンボ倍率のstep化・パターンボーナスの一貫性判定・新しい役ボーナス(フラッシュ/ロイヤル/同ランク/コンプリートラン/列一掃)・山札めくり時のパターン継続など、多くのスコアリングルールが追加された。これらは通常のプレイでは発生条件が偶然に左右され(特にコンプリートランなど)、目視での動作確認が難しい。

本機能は、`/game/culmen`にローカル開発時のみ表示されるデバッグパネルを追加し、(1)現在の内部状態の可視化、(2)獲得点内訳のログ、(3)任意カードの強制引き、の3点を提供することで、これらのルールを開発者自身が素早く再現・確認できるようにする。

## 1. スコープ

- 対象: `src/routes/game/culmen/+page.svelte`、新規 `src/routes/game/culmen/DebugPanel.svelte`、`src/lib/game/culmen/engine.ts`(`forceStockTop`関数の追加のみ)
- 表示条件: `import.meta.env.DEV`(Viteのビルド時定数。`npm run dev`実行時のみ`true`、`npm run build`後の本番ビルドには分岐ごと含まれない)
- 表示形式: ゲーム画面(`playArea`)の下に常時表示(開閉トグルなし)
- 対象外:
  - サイト全体の「開発中」フラグ(`toolDevStatus`)とは無関係(本番でも`toolDevStatus`がtrueの間は既存の「開発中」バナーが出るが、本デバッグパネルは本番ビルドには一切含まれない)
  - タブロー(場札)への直接カード注入は対象外(要望は「山札の次の1枚」のみ)
  - ログの永続化(リロードでリセットされてよい)
  - `/admin/culmen`側の変更は無し

## 2. アーキテクチャ

`DebugPanel.svelte`を新規コンポーネントとして切り出し、`+page.svelte`から`{#if import.meta.env.DEV}`で条件付きレンダリングする。Vite/Rollupはビルド時に`import.meta.env.DEV`を`false`リテラルに置換し、本番ビルドでは到達不能なこの分岐(と未使用になった`DebugPanel`のimport)をツリーシェイクで除去する。これにより本番バンドルにデバッグ用コードが一切含まれないことをビルド時に保証できる。

```svelte
<!-- +page.svelte -->
{#if import.meta.env.DEV && wave}
  <DebugPanel {wave} onForceDraw={handleForceDraw} />
{/if}
```

エンジン(`engine.ts`)には副作用のない純粋関数`forceStockTop`を1つだけ追加する。それ以外の既存エンジン関数(`analyzeSuitColor`/`analyzeStair`/`drawStock`等)はそのまま再利用し、デバッグ専用の新しいゲームロジックは作らない。

## 3. コンポーネント: `DebugPanel.svelte`

**Props:**
- `wave: WaveState` — 現在のウェーブ状態(読み取り専用)
- `onForceDraw: (card: Card) => void` — 「引く」ボタン押下時に呼ばれるコールバック

**内部状態:**
- `gainLog: { combo: number; gain: ScoreGain }[]` — `$state`で保持。`$effect`で`wave.lastGain`の変化を監視し、`null`でない新しい値が来るたびに先頭に追記(件数は直近20件程度に切り詰める)
- フォーム入力用の`$state`(スート・ランク・ワイルドON/OFF)

**表示内容(3セクション):**

1. **内部状態**
   - `コンボ: {wave.combo}` / `シールド: {wave.shieldLeft}` / `列一掃カウント: {wave.columnsEmptiedThisCombo}` / `直前の引き効果: {wave.lastDrawEffect ?? 'なし'}`
   - `analyzeSuitColor(wave.chain)` の結果(`同スート保持中: true/false`、`同色保持中: true/false`)
   - `analyzeStair(wave.chain)` の結果(`階段保持中: true/false`、`方向: -1/0/1`、`長さ: N`)
   - チェーン内容(`wave.chain`をランク・スート・ワイルドの短縮表記で一覧表示)

2. **獲得点ログ**
   - `gainLog`を新しい順に一覧表示。各行は `コンボ×{combo}: +{gain.points} ({gain.parts.join(' ')})` の形式

3. **強制引きフォーム**
   - ワイルドON/OFFチェックボックス・スート選択(♠♥♦♣)・ランク選択(A~K)
   - ワイルドONの場合、スート・ランクの選択欄は無効化され、送信時は既存デッキと同じ規約(`suit:'★', rank:0, wild:true`)で固定してカードを組み立てる。ワイルドOFFの場合のみスート・ランクの選択値を使う(`wild:false`)
   - 「この札を山札の次にセットして引く」ボタン → `onForceDraw(card)`を呼ぶ

## 4. エンジン変更: `forceStockTop`

`src/lib/game/culmen/engine.ts`に追加する純粋関数:

```ts
let debugCardIdSeq = 900000

export function forceStockTop(wave: WaveState, suit: Suit, rank: Rank, wild: boolean): WaveState {
  const card: Card = { id: ++debugCardIdSeq, suit, rank, wild }
  const newStock = wave.stock.length === 0 ? [card] : [...wave.stock.slice(0, -1), card]
  return { ...wave, stock: newStock }
}
```

- id は既存デッキ(最大でも52+アイテムによる増量分程度)と衝突しないよう、90万番台から発番するモジュールレベルのカウンタを使う(既存の`nextId`パターンと同様の考え方だが、`startWave`とは独立したカウンタとして`engine.ts`モジュールスコープに持つ)。
- 山札が空の場合は新しく1枚だけの山札にする(引けば即座に山札が尽きる状態になるが、それ自体は既存の`drawStock`の空チェックで正しく扱われるため問題ない)。
- `+page.svelte`側の`handleForceDraw`は、`forceStockTop`で`run.wave`を書き換えた後、既存の`handleDraw()`をそのまま呼び出す(通常の引き処理をフルに通す)。

```ts
function handleForceDraw(suit: Suit, rank: Rank, wild: boolean) {
  if (!run.wave) return
  run = { ...run, wave: forceStockTop(run.wave, suit, rank, wild) }
  handleDraw()
}
```

## 5. テスト

- `forceStockTop`のユニットテストを`engine.test.ts`に追加(山札の最後尾が指定カードに置き換わること、山札が空でも1枚になること、他のWaveStateフィールドが変化しないこと)
- `DebugPanel.svelte`自体はUIコンポーネントのため、既存の`/admin/culmen`(Task 8)と同様に自動テストは追加せず、`npm run dev`上でのブラウザ目視確認とする

## 6. 受け入れ基準

1. `npm run build`後の`dist`配下に`DebugPanel`関連の文字列(コンポーネント名やUI文言)が含まれない(本番バンドルから除去されていることの確認)
2. `npm run dev`で`/game/culmen`を開くと、通常のプレイ画面の下にデバッグパネルが常時表示される
3. パネルの内部状態表示が、実際にカードをプレイ/山札を引く操作に追従してリアルタイムに変化する
4. 獲得点ログが、得点が発生するたびに新しい順で追記される
5. 強制引きフォームで指定した任意のスート・ランク・ワイルドのカードが、実際に次の山札めくりで出てきて、通常の引き処理(シールド/パターン継続/リセット)が正しく作動する
6. `forceStockTop`のユニットテストが通る
7. `npm run test`・`npm run build`が成功する
