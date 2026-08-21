# プレイ中画面での護符並べ替え 設計

## 背景・目的

護符の並べ替え機能は、ショップ画面(`docs/superpowers/specs/2026-07-31-shidasu-item-reorder-design.md`)にのみ実装されている。「加算・倍算型の護符が複数ある場合、適用順はプレイヤーの護符の並べ方に依存する(左から順に適用)」という仕様上、プレイ中に並び順を調整したい場面があるが、現状プレイ中画面(`PlayArea`の`extraFooter`として渡す`itemBadges`スニペット)は表示専用で、並べ替え操作ができない。

本設計では、プレイ中画面の護符バッジにも、ショップ画面と同じドラッグ&ドロップによる並べ替えを追加する。

## 表示形式の変更

現在のプレイ中画面の`itemBadges`は、同名護符をグループ化して「護符名×n」という1種類1バッジの表示形式になっている(ショップ画面は元から1個1バッジ)。並べ替えの単位を明確にするため、プレイ中画面も**ショップ画面と同じ1個1バッジ表示に変更する**。同名護符が複数ある場合は同じ名前のバッジが複数個並ぶ形になる。所持護符が多い場合にバッジの表示領域が増える点は許容する(確認済み)。

## 既存演出との整合性

プレイ中画面には、ショップ画面には無い複数の護符関連演出がある。1個1バッジ化に伴う扱いを整理する。

- **封印中の表示(`talismanSealed`)・封印フラッシュ(`talismanFlashing`)**: `wave.activeSeal`の`{ kind: 'talisman'; id: ItemId }`は対象護符の`idx`(所持リスト内の位置)を持たず、`id`(名前)のみで対象を特定する。そのため同名護符を複数所持している場合、「どの1個が封印されているか」をデータ上区別できない。この制約は既存の×nまとめ表示でも実質的に同じ挙動だったため、**今回は変更せず、同名護符すべてに封印スタイル・フラッシュ演出を適用する**現状の判定ロジック(`id`一致)をそのまま維持する。将来的に`activeSeal`へ`idx`を追加する改善は別スコープとする。
- **没収フェード(`talismanConfiscateFading`)**: `confiscatedTarget`は`{ kind: 'talisman'; id: ItemId; idx: number }`と`idx`を持つため、1個1バッジ化により、むしろ対象の1個だけを正確にフェードさせられるようになる(現状の×nまとめ表示では、対象の1個が消えても表示上の個数が減るだけで、フェードするバッジ自体は種類単位だった)。
- **並び替え一斉フラッシュ(`talismanShuffleFlashActive`)**: 対象は常に「全護符」なので、1個1バッジ化の影響を受けない。全バッジに同時適用する既存ロジックをそのまま維持する。
- **裏向き表示(`talismanHidden`)**: 全護符が対象のため影響なし。「？？？」表示・斜めストライプ背景を各バッジに適用する。

## ドラッグ&ドロップの実装

既存のショップ画面のドラッグロジック(`handleItemPointerDown`・`handleItemPointerMove`・`handleItemPointerUp`、`draggingItemIndex`・`dragPointerX`・`dragPointerY`という`$state`)をそのまま再利用する。これらは`+page.svelte`のトップレベルスコープに既に定義されており、`itemBadges`スニペットも同じファイル内にあるため、追加のprops受け渡しなしでそのまま呼び出せる。

`itemBadges`スニペット内の各護符バッジに、ショップ画面と同じ`data-item-index`属性・`onpointerdown`/`onpointermove`/`onpointerup`/`onpointercancel`ハンドラを追加する。

### アニメーション中のブロック

プレイ中画面には`anyAnimationActive`という、他の演出(カードプレイ・得点表示・妨害演出など)進行中は操作を無効化する既存の仕組みがある。護符バッジの並べ替えドラッグも、`anyAnimationActive`がtrueの間は無効化する。`handleItemPointerDown`(ドラッグ開始)の先頭で`anyAnimationActive`を見て即座にreturnするガードを追加する形にする(`pointer-events: none`によるCSSレベルの無効化は、視覚的なフィードバック=カーソル形状の変化などが失われるため採用しない)。

`anyAnimationActive`は`PlayArea.svelte`内部の`$derived`(`let anyAnimationActive = $derived(...)`)であり、コールバックpropsやexportを持たないため`+page.svelte`側からは直接参照できない。`itemBadges`は`PlayArea`に`extraFooter`という`Snippet`型のpropsとして渡され、`PlayArea`内部で`{@render extraFooter()}`という引数無しの形で呼び出されている。この呼び出しを`Snippet<[boolean]>`型に変更し、`{@render extraFooter(anyAnimationActive)}`のように`anyAnimationActive`の値を引数として渡す設計にする。`+page.svelte`側は`{#snippet itemBadges(anyAnimationActive: boolean)}`という形でこの値を受け取る。この方式は新規のコールバックprops・`$state`を追加せずに済み、既存の`onSealFlashChange`等のパターン(値の変化のたびにコールバックを呼びstateへ保持する)よりシンプル。

### `displayedItemIds`の扱い

現在の`itemBadges`は、没収フェード演出のために`run.items`へ一時的にフェード対象を挿入した`displayedItemIds`という配列(`new Set`で重複除去)を作っている。1個1バッジ化に伴い、重複除去(`new Set`)は不要になる(そもそも同名護符を個別バッジとして扱うため)。挿入ロジック自体(`slice`/`splice`でidx位置にフェード対象を差し込む)はそのまま維持し、`{#each displayedItems as item, i (i)}`という位置ベースのkeyでループする形に変更する。

## テスト方針

- 既存の`reorderItems`関数(`engine.ts`)は変更しないため、新規のロジックテストは不要。
- デバッグ画面またはブラウザでの目視確認:
  - プレイ中画面で護符バッジをドラッグし、他のバッジの位置まで動かすと順序が入れ替わること。
  - 並べ替え後、ショップ画面に遷移しても同じ順序が維持されていること(`run.items`が唯一の情報源のため、自動的に一致するはず)。
  - 同名護符を複数所持した状態で、封印・没収・並び替え・裏向きの各演出が意図通りに(封印は同名全部、没収はidx指定の1個だけ、並び替えは全部、裏向きは全部)適用されること。
  - `anyAnimationActive`中(例: カードプレイ演出中)は護符バッジのドラッグが開始できないこと。

## スコープ外

- 秘儀・天啓・神託の並べ替え(既存のショップ画面設計と同様、効果が適用順に依存しないため対象外)。
- `activeSeal`への`idx`追加による封印対象の個体特定精度向上(将来検討、今回は対象外)。
