# Shidasu デバッグ画面「秘儀実行パネル」追加 設計

## 0. 背景・目的

`/admin/shidasu-debug`は、護符の効果検証やカード配置の任意操作ができるデバッグサンドボックス画面である。直近で追加した秘儀(Rite)17種は、通常のプレイフローでは「護符取得後にランダムで1つ取得→最大3つ所持→使用で消費」という流れでしか発動できず、デバッグ時に特定の秘儀の効果を任意のタイミングで検証することができない。

そこで、このデバッグ画面に「秘儀実行パネル」を追加し、所持状態や使用条件を無視して、17種すべての秘儀を任意のタイミングで直接発動できるようにする。

## 1. 秘儀実行パネル

新規コンポーネント`src/routes/admin/shidasu-debug/RiteExecutePanel.svelte`を、既存の`ItemChecklist.svelte`(護符の一覧・チェックボックスUI)と同じスタイルパターンで作成する。

- `RITE_POOL`(17種)を一覧表示する
- 各行に、ルーングリフ(`ShidasuRunic`フォントで表示、`params.rites[id].name`)・効果説明文(`riteDesc(id, params)`)・「実行」ボタンを並べる
- 実行ボタンは**使用条件(`canUseRite`)を無視して常にクリック可能**にする。条件を満たさない場合、`applyRiteEffect`は盤面を変更せずそのまま返す(安全な無害化)ため、クラッシュや不整合は起きない
- 所持数の概念は無い(実行してもどこにも「消費」の記録は残らない。純粋にwaveへの直接操作)

配置は、既存の右サイド列(`CardPalette`・`ItemChecklist`が並ぶ360px列)に、`ItemChecklist`と並べて追加する。

## 2. 実行処理

`+page.svelte`に以下を追加する。

- `applyRiteEffect`(`riteEffects.ts`)をimportする
- `handleExecuteRite(riteId: RiteId)`関数を追加し、`applyRiteEffect(params, wave, riteId, Math.random)`の結果を`wave`に反映する
- `RiteExecutePanel`に`onExecute={handleExecuteRite}`を渡す

秘儀は`RunState.rites`(所持数管理)を経由せず、`wave`に対する直接操作として扱う。これは既存の`stairifyTableau`・`unifySuit`と同じ「デバッグ用の盤面直接操作」パターンに沿う。

## 3. Undo対応の拡張

現在、このページの`lastSnapshot`は`{ tableau: Card[][]; stock: Card[] } | null`という限定的な型で、`applySwap`・`unifySuit`・`stairifyTableau`の3箇所でtableau・stockのみを保存し、`handleUndo`もこの2フィールドのみを復元している(`lastGain`・`lastBonusGains`は明示的に`null`/`[]`にクリアされる)。

秘儀はチェーン・foundation・コンボ数・基礎コンボ数・コンボリセット防止残り回数など、tableau・stock以外の多くのフィールドも変化させるため、この限定的なスナップショットでは秘儀実行を正しくundoできない。

そこで、以下のようにUndo機構全体を拡張する。

- `lastSnapshot`の型を`WaveState | null`に変更する(wave全体を保存する)
- `applySwap`・`unifySuit`・`stairifyTableau`・新設する秘儀実行(`handleExecuteRite`)のすべてで、操作直前の`wave`全体を`lastSnapshot`に保存するよう統一する
- `handleUndo`は、`lastSnapshot`をそのまま`wave`に復元する形に単純化する(現状のような`lastGain`/`lastBonusGains`の明示的なクリアは行わず、スナップショット時点の値がそのまま復元される。これにより「操作直前の状態に戻す」という意味がより正確になる)

## 4. スコープ外

- `RunState`ベースの所持数管理(最大3・使用で消費)をこのデバッグ画面に持ち込むこと(このパネルは所持数を無視した直接実行のみを提供する)
- `canUseRite`によるボタンのdisabled制御(このパネルでは常にクリック可能にする)
- 秘儀の取得(護符取得後のランダム抽選)のデバッグ用シミュレーション

## 5. 受け入れ基準

1. `/admin/shidasu-debug`に秘儀実行パネルが追加され、17種すべての秘儀がルーングリフ・効果説明文・実行ボタンとともに一覧表示される
2. 実行ボタンをクリックすると、対応する秘儀の効果が即座に盤面(`wave`)に反映される。使用条件を満たさない場合はボタンを押しても盤面が変化しない(クラッシュしない)
3. 秘儀実行後に「元に戻す」ボタンを押すと、実行直前の盤面(tableau・stock以外のチェーン・コンボ数等も含む)に正しく復元される
4. 既存の`applySwap`(カードパレットからのドラッグ&ドロップ)・`unifySuit`・`stairifyTableau`のUndo挙動が、スナップショット拡張後も変わらず機能する
5. `npm run test`・`npm run check`・`npm run build`が成功する
