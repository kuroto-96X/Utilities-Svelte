# 裏向き挙動(データ・表示)実装 設計

> 対象: 星の妨害行動「総戻し」「一列戻し」「捨て札埋没」で場札・捨て札に配られるカードを実際に裏向き表示にする。あわせて護符の妨害行動「護符並び替え」の情報非開示表現を、現状のテキストのみの「？？？」表示から専用の裏面デザインへ差し替える。今回はデータモデルと表示の実装のみを対象とし、裏向き化に伴う演出(フリップアニメーション等)は次回セッションで扱う。

## 背景・目的

`docs/shidasu/shidasu-star-sabotage-candidates.md`にある「総戻し」「一列戻し」「捨て札埋没」の3つの妨害行動は、候補段階から「裏向きで再配布する」という説明文を持っていたが、実装(`sabotageEffects.ts`)はいずれも見た目上は表向きのままカードをシャッフル・再配布するだけで、実際に裏向き表示になる機能は無かった(先のセッションで確認済み)。今回、この差分を解消し、実際に裏向き表示を実装する。

あわせて、護符の妨害行動「護符並び替え」(`talismanShuffle`)がすでに持っている情報非開示の仕組み(`activeSeal: { kind: 'talismanHidden' }`により、HUDの護符バッジ名を「？？？」というテキストに差し替える)を、トランプの裏向き表示と統一感のある専用の裏面デザインに差し替える。あわせて、現状HUDバッジにしか適用されていない`talismanHidden`判定を、ショップ画面の護符並べ替えUI(現状は常に実名表示されている非対称箇所)にも適用する。

## 方針(スコープ)

### 今回実装する

- **カード裏向き**: `総戻し`(`tableauFullReturn`)・`一列戻し`(`columnReturn`)・`捨て札埋没`(`discardBury`)の3妨害行動で配られるカードを、実際に裏向き(色・ランク・スート非表示)で表示する。
- **護符裏面デザイン**: `護符並び替え`(`talismanShuffle`)発動中の護符バッジ表示を、テキストのみの「？？？」から専用の裏面デザイン(アンバー系斜めストライプ柄)に差し替える。HUD・ショップ画面の両方に適用する。

### 今回実装しない(次回以降)

- 裏向き化・表向き化(革霧)に伴うアニメーション(フリップ演出、山札への収束演出、裏向き配布演出)。今回は発動直後に即座に新しい盤面(一部裏向き)を再描画する。
- `捨て札消去`(`discardErase`)等、「裏向き」という表現を持たない他の妨害行動への拡張。
- 秘儀・天啓・神託・レリックへの情報非開示表現の拡張(現状`talismanHidden`は護符専用のまま)。

## 技術設計

### A. カードの裏向き

**データモデル**(`src/lib/game/shidasu/types.ts`): `Card`型に`faceUp?: boolean`を追加する。未設定(`undefined`)は表向き扱いとする(既存の全カード生成箇所は変更不要)。

```ts
export interface Card {
  id: number
  deckId: number
  suit: Suit
  rank: Rank
  wild: boolean
  faceUp?: boolean
}
```

`DeckCard`(ラン全体で持続するデッキ構成、`removed`フラグのみ持つ)には追加しない。裏向きはウェーブ内の一時的な状態であり、既存の設計方針(一時状態は`Card`側、永続状態は`DeckCard`側)と整合する。

**妨害行動側の変更**(`src/lib/game/shidasu/sabotageEffects.ts`):

- `applyTableauFullReturn`(総戻し)・`applyColumnReturn`(一列戻し): シャッフル後、**場札(tableau)へ配られるカードにのみ**`faceUp: false`を設定する。山札(stock)行きの余りカードは個別描画されないため`faceUp`を変更する必要はない。
- `applyDiscardBury`(捨て札埋没): シャッフル後、**捨て札(discardPile)へ配られるカードにのみ**`faceUp: false`を設定する。山札行きの余りは同様に変更不要。

**表示ルール(表示側で計算し、エンジン側の状態は書き換えない)**: `PlayArea.svelte`側で、実際にどのカードを裏向き表示するかを都度計算する。

- 場札の各列: その列の末尾(一番上、`ri === col.length - 1`。既存の`isTop`定数がこの判定に対応)であれば`card.faceUp`の値に関わらず常に表向き。末尾でなく`card.faceUp === false`のカードのみ裏向き表示にする。
- 捨て札の先頭表示(`displayedDiscardTop`): `card.faceUp === false`なら常に裏向き(場札と異なり「先頭だから表向き」という例外は設けない)。

この判定を表示側に持たせ、エンジン側で「新しく列の一番上になったカードの`faceUp`をtrueに書き換える」処理を実装しない設計とする。理由: `tiwaz`(列反転)・`kenaz`(スート別再配布)など、場札の並び順を変更する秘儀・妨害行動は他にも多数存在し、それらが発動するたびに「新しい一番上」を検出して`faceUp`を書き換える処理を全箇所に仕込むのは現実的ではない。表示側で「配列の末尾かどうか」を毎回判定すれば、後から他の効果が場札を並べ替えても自動的に正しい見た目になる(一番上は常に表向き、という不変条件が表示計算だけで保証される)。

副次的な帰結として、`捨て札埋没`で裏向きになったカードが、後から他の秘儀・天啓(例: `gebo`が捨て札から場札へ配る等)によって場札へ移動した場合、そのカードの`faceUp: false`はそのまま引き継がれ、場札の表示ルール(列の末尾なら表向き)がそのまま適用される。これは実装上の特別扱いを必要としない自然な帰結であり、意図的な仕様とする。

**カード裏面デザイン**(`src/routes/game/shidasu/CardFace.svelte`): Solitaire(`src/routes/game/solitaire/+page.svelte`)の`CARD_BACK_STYLE`(紺地`#0f172a`+半透明インディゴ`rgba(99,102,241,0.25)`の格子柄)をそのまま移植する。

`CardFace`に新規prop`faceUp: boolean`(デフォルト`true`)を追加する。`faceUp === false`の場合、`card.wild`分岐より前で裏面を描画して処理を終える(wild/通常の区別も含め、裏向き中は一切の情報を見せない)。

```svelte
let { card, covered, faceUp = true, items = [] }: { card: Card; covered: boolean; faceUp?: boolean; items?: ItemId[] } = $props()

const CARD_BACK_STYLE =
  'background:#0f172a;' +
  'background-image:' +
  'repeating-linear-gradient(0deg,transparent,transparent 7px,rgba(99,102,241,0.25) 7px,rgba(99,102,241,0.25) 8px),' +
  'repeating-linear-gradient(90deg,transparent,transparent 7px,rgba(99,102,241,0.25) 7px,rgba(99,102,241,0.25) 8px);'
```

```svelte
{#if !faceUp}
  <div class="w-full rounded-lg border border-indigo-500/50" style="aspect-ratio: 2 / 3; {CARD_BACK_STYLE}"></div>
{:else if card.wild}
  ...(既存のまま)
{:else}
  ...(既存のまま)
{/if}
```

既存の`covered`prop(現状どこからも`true`で呼ばれておらず、中央のピップだけを隠す別の意味を持つ)はそのまま残し、今回は変更しない。

**呼び出し元の変更**(`src/routes/game/shidasu/PlayArea.svelte`):

- 場札の2箇所(選択可能な列トップ用ボタン内・選択不可時、既存の`isTop`定数を使う): `faceUp={card.faceUp !== false || isTop}`
- 捨て札先頭(`displayedDiscardTop`): `faceUp={displayedDiscardTop.faceUp !== false}`
- それ以外の呼び出し箇所(チェーン札・プレイ/片付け/配布アニメーション中のカード)は、今回の3妨害行動が対象にしない配列(chain)か、常に表向きの状況(アニメーション)のため、`faceUp`を明示的に指定せずデフォルト値(`true`)のままとする。
- 例外: 護符「導き」による山札の次カードプレビュー(974行目付近)は、山札の中身を先読みできる護符効果であり、裏向き状態の影響を受けずに常に表向きでプレビューを見せる(`faceUp={true}`を明示するか、デフォルトのまま変更しない)。プレビュー対象のカードがたまたま`faceUp: false`を持っていても、この護符の効果自体は正常に機能させる。

**スコア計算への影響**: 一切なし。`playCard`・`isPlayable`・パターン判定(`patterns.ts`)等のロジックは常に`card.suit`/`card.rank`/`card.wild`を直接参照するため、`faceUp`は完全に表示専用のフラグであり、参照される箇所は`CardFace.svelte`とその呼び出し元のみ。

### B. 護符の裏面デザイン

**対象**(`src/routes/game/shidasu/+page.svelte`): `talismanShuffle`のデータモデル(`activeSeal: { kind: 'talismanHidden' }`)は変更しない。表示のみ変更する。

**適用箇所**: 現状`talismanHidden`判定を持つHUDの護符バッジ(`itemBadges`スニペット)に加え、現状この判定が無く常に実名表示されているショップ画面の護符並べ替えUI(ドラッグ&ドロップ用の一覧)にも同じ判定を追加する。

**裏面デザイン**: ビジュアルコンパニオンで確定した、アンバー系(琥珀色)の斜めストライプ柄。既存のバッジサイズ・角丸・パディング(`text-xs rounded px-1.5 py-0.5`)は維持し、背景色・枠線色・背景の縞模様のみ専用スタイルに差し替える。表示テキストは既存の「？？？」(所持数がある場合の`×n`表記も含む)をそのまま維持する。

```
background: #1c1917;
background-image: repeating-linear-gradient(45deg,transparent,transparent 5px,rgba(217,119,6,0.35) 5px,rgba(217,119,6,0.35) 6px);
border-color: rgba(217,119,6,0.5);
color: #78350f;
```

ツールチップ(`title`属性)は現状の「護符並び替え: 次の妨害発動まで内容が見えない」という説明文をそのまま維持する(護符自体の効果・売値等の情報は見せず、隠れている理由のみ示す)。

ショップ画面の護符並べ替えUIには、名前表示に加えて売却ボタン(`売({itemSellPrice(params, run, itemId)})`のように実際の売値を数値表示している)がある。`talismanHidden`中はこの売値の数値表示も隠す(`売(？)`のようなプレースホルダーに差し替える)。売却操作自体(クリックで実際に売れること)は機能を維持する(効果は発揮する、という方針を売却にも適用し、見えるのは金額の数字だけを隠す)。

## テスト

- **カード裏向き**: `sabotageEffects.ts`の`applyTableauFullReturn`・`applyColumnReturn`・`applyDiscardBury`が、対象カードに正しく`faceUp: false`を設定していることをエンジンレベルのテストで確認する(山札行きの余りカードには`faceUp`を変更していないことも確認する)。既存のこれら3妨害行動のテストがあれば、無修正のまま引き続きグリーンであることも確認する(妨害の効果自体=どの配列にどのカードが入るかは変更していないため)。
- **表示ロジック**: `PlayArea.svelte`・`CardFace.svelte`はSvelteコンポーネントであり、このプロジェクトにはコンポーネントレベルの自動テストが無い(shidasu関連のテストは全て`src/lib/game/shidasu/*.test.ts`のエンジンロジックのみ)。`npm run dev`でブラウザから、以下を目視確認する:
  - 総戻し・一列戻しが発動した直後、各列の一番上だけ表向き、それ以外が裏向き(紺地格子柄)で表示されること
  - 裏向きのカードをプレイして列の一番上が入れ替わった際、新しい一番上のカードが正しく表向きで表示されること(既存の`isTop`計算が引き続き正しく機能することの確認)
  - 捨て札埋没が発動した直後、捨て札の先頭表示が裏向きになること
  - 護符並び替え発動中、HUDの護符バッジとショップ画面の護符一覧の両方が新しい裏面デザインで表示され、ホバー時に説明文(封印中メッセージ)が出ること
  - 護符「導き」所持時、山札の次カードプレビューが裏向き状態の影響を受けず正常に見えること
- `npm run build`・`npm run check`が通ることを確認する。

## スコープ外

- フリップアニメーション・山札への収束アニメーション・裏向き配布アニメーション(次回セッション)
- `捨て札消去`等、他の妨害行動への裏向き表現の拡張
- 秘儀・天啓・神託・レリックへの情報非開示表現の拡張
- 既存の`CardFace.svelte`の`covered`prop(現状デッドコード)の整理・削除
