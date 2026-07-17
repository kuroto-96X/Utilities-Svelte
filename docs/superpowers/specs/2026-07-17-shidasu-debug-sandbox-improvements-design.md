# Shidasu デバッグサンドボックス改善 設計

## 0. 背景・目的

`/admin/shidasu-debug`(デバッグサンドボックス)を、実際のゲーム画面(`/game/shidasu`)と見た目・挙動の面でより一致させつつ、デバッグ操作の利便性を上げる。

対象は以下の5点。

1. 「場札を階段にする」「各スートに統一」ボタンを押した後も「元に戻す」が使えるようにする
2. 獲得ログのリセットボタンを追加する
3. デッキリセットボタンを追加する
4. 護符のチェック状況を`localStorage`に保持・復元する
5. デバッグ用の表示・右側エリアの操作を除き、プレイエリアを`/shidasu`と同じ内容にする

`/admin/shidasu-talismans`(護符パラメータ管理画面)側の改善(レア度編集・説明文テンプレート編集)は別スコープとし、本specには含めない。別途brainstormする。

## 1. 状態操作系

### 1.1 「元に戻す」の一般化

現状、`src/routes/admin/shidasu-debug/+page.svelte`の`lastSwap`は、カードパレットからのドラッグ&ドロップによる1枚スワップのみを記憶しており、`stairifyTableau()`・`unifySuit()`はどちらも`lastSwap = null`でクリアするだけで、それ自体を取り消す手段がない。

`lastSwap`を`lastSnapshot: { tableau: Card[][]; stock: Card[] } | null`に一般化する。

- `applySwap`・`stairifyTableau`・`unifySuit`は、実行前の`wave.tableau`/`wave.stock`を`lastSnapshot`に保存してから変更を適用する
- `handleUndo`は`lastSnapshot`の`tableau`/`stock`をそのまま`wave`に復元し(`lastGain`/`lastBonusGains`はクリア)、`lastSnapshot`をクリアする
- プレイ・山札めくり・アイテム切り替え・新しいウェーブなど、上記3操作以外のアクションは従来通り`lastSnapshot`をクリアする

つまり「直前の1操作(スワップ/階段化/スート統一のいずれか)のみ取り消し可能」という、現状の「元に戻す」ボタンの挙動(1段階のみ)を、対象操作を3種類に拡張した上でそのまま維持する。複数手の履歴は持たない。

### 1.2 獲得ログのリセット

`src/routes/game/shidasu/DebugPanel.svelte`(ゲーム本体・デバッグサンドボックス両方で共有されているコンポーネント)の「獲得点ログ(新しい順)」見出しの右にリセットボタンを追加し、内部state `gainLog`を空配列にする。

このコンポーネントは`import.meta.env.DEV`時のみ描画されるため、ゲーム本体側の画面にも同じボタンが出るが実際のプレイ・スコア計算には影響しない。

### 1.3 デッキリセット

デバッグページ上部の操作ボタン列(「場札を階段にする」「元に戻す」「新しいウェーブ」の並び)に「デッキリセット」ボタンを追加する。

- 押下時、`deckComposition = standardDeckComposition()`を実行する
- 現在プレイ中のウェーブ(`wave`、場札・山札の中身)自体は変更しない
- 永劫・豊穣・静寂などの永続系護符によって`deckComposition`に加えられた永続的な変化(ワイルド追加・ランダム変換など)を、標準構成に戻すことが主目的。次回「新しいウェーブ」を押した時点で、リセットされたデッキ構成から配られるようになる
- `wave.tableau`/`wave.stock`は変更しないため、`lastSnapshot`(1.1)はクリアしない(直前操作の「元に戻す」はデッキリセット後も引き続き有効)

### 1.4 護符チェック状態のlocalStorage永続化

`items`(チェック中の護符ID配列)の変更を`$effect`で`localStorage`に保存し、ページ読み込み時に復元する。

- キー: `shidasu-debug-items`
- 保存形式: `ItemId[]`をそのままJSON化
- 読み込み時は`try/catch`で囲み、パース失敗時・値が配列でない場合は空配列にフォールバックする
- `src/routes/game/solitaire/+page.svelte`の`localStorage`永続化(`$effect`での`setItem`・`try/catch`でSSR/prerenderのエラーを無視)と同じパターンに合わせる。このプロジェクトは全ページprerender構成のため、`localStorage`への素朴なトップレベルアクセスはビルド時にエラーになる

## 2. プレイエリア共通化(アーキテクチャ)

### 2.1 現状の問題

`/game/shidasu/+page.svelte`と`/admin/shidasu-debug/+page.svelte`は、カード描画(`cardFace`スニペット・`PIP_LAYOUTS`・`FACE_CHAR`)が完全に重複したコードを持っており、かつ場札グリッド・山札・チェーン表示のマークアップも別々に実装されている。デバッグサンドボックスは実際のゲーム画面よりも簡略化された見た目(スコア/コンボヘッダーなし、進捗バーなし、獲得点ポップアップなし)になっており、見た目の不一致がデバッグ時の再現性を下げている。

### 2.2 `CardFace.svelte`の抽出

`src/routes/game/shidasu/CardFace.svelte`を新規作成し、両ファイルに重複している`cardFace`スニペット(`PIP_LAYOUTS`・`FACE_CHAR`定数含む)を、`{ card: Card, covered: boolean }`をpropsに取る単一コンポーネントとして切り出す。

- `src/routes/admin/shidasu-debug/CardPalette.svelte`は現在`cardFace`をsnippet propとして受け取っているが、これをやめて`CardFace.svelte`を直接importして使う形に変更する(propsから`cardFace`を削除)
- デバッグページのドラッグ中ゴースト表示(`{@render cardFace(...)}`の部分)も同様に`<CardFace ... />`呼び出しに置き換える

### 2.3 `PlayArea.svelte`の抽出

`src/routes/game/shidasu/PlayArea.svelte`を新規作成し、`/shidasu/+page.svelte`の`playArea`スニペットのうち以下を切り出す。

**含める:**
- スコア/目標・コンボのヘッダー、進捗バー、獲得点ポップアップ(`lastGain`/`lastBonusGains`)
- 場札グリッド(プレイ可能列のハイライト含む)・「取れる札がない→山札をめくろう」ヒント
- 「✦ パターン継続! ✦」バナー
- 山札ボタン・(guidance護符所持時の)次の札表示・チェーン表示(`chainRows`)

**含めない(呼び出し元にそのまま残す):**
- ステージ名・ウェーブ進捗ドット・制約ラベルの行(`RunState`前提の情報で、デバッグサンドボックスには存在しない概念)
- 護符バッジ一覧(デバッグサンドボックスは右側の`ItemChecklist`で既に護符一覧を表示しているため、含めると表示が重複する)

護符バッジ一覧のような「呼び出し元固有の末尾コンテンツ」を許容するため、`PlayArea`は任意のsnippet prop `extraFooter?: Snippet`を受け取れるようにし、山札ボタン・チェーン表示と同じ行の末尾にレンダリングする。`/shidasu/+page.svelte`だけがここに護符バッジ一覧を渡す。

**Props:**

```ts
{
  wave: WaveState
  params: ShidasuParams
  modifier: StageModifier       // プレイ可能列判定用。デバッグ側は 'none' 固定
  target: number                 // 進捗バー用。デバッグ側は既存の TARGET = Number.MAX_SAFE_INTEGER をそのまま渡す
  items: ItemId[]                // guidance護符判定・extraFooter用
  onPlayCard: (colIndex: number) => void
  onDraw: () => void
  dropTarget?: { col: number; row: number } | 'stockTop' | null   // ドラッグ中のドロップ先ハイライト。デバッグ側のみ使用
  extraFooter?: Snippet          // 山札/チェーン行の末尾に追加するコンテンツ(/shidasuの護符バッジ一覧用)
}
```

デバッグサンドボックスの既存ドラッグ&ドロップ(カードパレットからのドラッグで、`data-drop-col`・`data-drop-row`・`data-drop-stock`属性を`document.elementsFromPoint`経由で検出する`updateDropTarget`)を壊さないよう、これらのdata属性・`dropTarget`に応じたハイライト(`ring-4 ring-sky-400`)は`PlayArea`側の場札グリッド・山札ボタンに常に描画する。`/shidasu`本体では`dropTarget`を渡さない(未使用の無害なdata属性が残るだけで、見た目・動作に影響しない)。

### 2.4 適用結果

- **`/shidasu/+page.svelte`**: `playArea`スニペットのうちステージ見出し行をそのまま残し、それ以降を`<PlayArea wave={displayWave} {params} modifier={stage.modifier} {target} items={run.items} onPlayCard={handlePlayCard} onDraw={handleDraw}>`呼び出しに置き換える。護符バッジ一覧は`extraFooter`snippetとして渡す。見た目・動作は変更しない(純粋なリファクタリング)。
- **デバッグサンドボックス(`/admin/shidasu-debug/+page.svelte`)**: 自前の場札グリッド・山札・チェーン描画コード(`cardFace`スニペット・`PIP_LAYOUTS`・`FACE_CHAR`含む)を削除し、`<PlayArea wave={wave} {params} modifier={'none'} target={TARGET} {items} onPlayCard={handlePlayCard} onDraw={handleDraw} {dropTarget} />`に置き換える。トップの操作ボタン列(階段化・元に戻す・新しいウェーブ・デッキリセット)・`DebugStatePanel`・`CardPalette`・`ItemChecklist`はそのまま残す。

## 3. スコープ外

- `/admin/shidasu-talismans`のレア度編集・説明文テンプレート編集(別specで扱う)
- 「元に戻す」の複数段階履歴化
- 護符バッジ一覧をデバッグサンドボックス側にも表示すること

## 4. 受け入れ基準

1. デバッグサンドボックスで「場札を階段にする」または「各スートに統一」を押した直後、「元に戻す」ボタンが有効になり、押すと操作前の場札に戻る
2. 上記1の後に別の操作(プレイ・山札めくり・アイテム切り替え・新しいウェーブ)を行うと、「元に戻す」は再び無効になる
3. デバッグサンドボックス・ゲーム本体のいずれの`DebugPanel`でも、獲得点ログのリセットボタンを押すとログが空になる
4. デバッグサンドボックスで「デッキリセット」を押すと、以後の「新しいウェーブ」で標準デッキ構成から配られる(永続系護符によるデッキ変化が解消される)
5. デバッグサンドボックスで護符をチェック/解除してページをリロードすると、チェック状態が保持されている
6. デバッグサンドボックスのプレイエリア(スコア/コンボヘッダー・進捗バー・獲得点ポップアップ・場札・山札・チェーン表示)が、`/shidasu`本体と同じ見た目・同じコンポーネントで描画される
7. デバッグサンドボックスのカードパレットからのドラッグ&ドロップ(場札・山札への差し替え)が、リファクタリング後も従来通り動作する
8. `/shidasu`本体の見た目・動作(スコア表示・場札プレイ・山札めくり・護符バッジ一覧など)が、リファクタリング前後で変化しない
9. `npm run test`・`npm run build`・`npm run check`が成功する
