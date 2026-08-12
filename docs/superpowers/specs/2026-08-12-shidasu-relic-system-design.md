# レリックシステムの実装 設計書

> 対象: `docs/shidasu/shidasu-roadmap.md` 項目5「レリックの実装」。護符・秘儀・天啓・神託に続く5つ目のアイテム種別「レリック」の**仕組み**(データ構造・ショップ連携・表示UI)を設計する。個別レリックの効果・名前・価格の具体的な値、および付喪化のトリガーとなる天啓の中身は本設計のスコープ外(別セッションで検討)。

## 背景・目的

`shidasu-roadmap.md`項目5より、レリックは「ショップ販売価格の減少、ショップ商品提示数の増加、リロールコストの減少、秘儀・天啓・神託の所持上限増加など、ランを通して効果があり、護符の守備範囲外(ゲームプレイに直接かかわる部分以外)で有利になる効果を持つアイテム」と定義されている。見た目のイメージは運勢が上がるような置物・インテリア・郷土玩具のような物体。

## 方針

- **モチーフ**: 置物・郷土玩具・縁起物。個別の名前・効果は本設計では扱わず、システムが固まった後に別途候補出しする(護符100個・秘儀A候補10個と同じ進め方)。
- **進化の呼称は「付喪化(つくもか)」**とする。長く使われた道具・置物に魂が宿るという日本の伝承(付喪神)に由来し、モチーフと世界観が一致する。
- **所持数に上限を設けない**。護符(上限`items.maxItems`)・秘儀(上限3)・天啓+神託(合算上限2)とは異なる。
- **重複所持不可**。同じレリックを2個以上持つことはできない。
- **売却不可**。ショップに売却ボタンを表示しない。
- **レアリティ区分は設けない**。護符のC/U/Rのような段階は無く、秘儀・天啓・神託と同様に価格は種類によらず一律。

## データ構造

### 型定義(`src/lib/game/shidasu/types.ts`)

`RelicId`型を新設する(既存の`ItemId`・`RiteId`と同じ、文字列リテラルの合併型)。個別の値(仮称)は別セッションで決める。

`RunState`に以下のフィールドを追加する:

```ts
// 所持中のレリック。重複無し(同じidは1つまで)。付喪化状態は個体ごとに持つ
relics: { id: RelicId; tsukumoka: boolean }[]
```

`items: ItemId[]`・`rites: RiteId[]`のような「IDの配列」ではなく「オブジェクトの配列」にする。これはレリックが本アイテム種別群の中で初めて個体ごとの可変状態(付喪化フラグ)を持つため。将来的に付喪化以外の個体差が増えても拡張しやすい。

### プール(`src/lib/game/shidasu/relics.ts`、新規作成)

既存の`rites.ts`(`RITE_POOL`)・`revelations.ts`(`REVELATION_POOL`)と同じ形で、`RELIC_POOL: RelicId[]`を定義する。

### パラメータ(`src/lib/game/shidasu/params.ts`)

```ts
relics: Record<RelicId, { name: string; desc: string; tsukumokaDesc: string; price: number }>
```

- `name`: 表示名。付喪化しても変えない(効果のみ上方修正される)。
- `desc`: 未付喪化時の効果説明文。
- `tsukumokaDesc`: 付喪化後の効果説明文。
- `price`: 購入価格(一律、`sell`は無し=売却不可のため)。

## 所持・付喪化

- 所持数に上限を設けない。ショップでの購入以外の入手経路(福袋など)は本設計では設けない。
- 同じ`RelicId`を複数所持することはできない。
- `tsukumoka: boolean`は個体(所持レリック1件)ごとに持つ。初期値`false`。
- 付喪化のトリガー: 将来実装する天啓が、所持レリックの中からプレイヤーが選んだ1つを付喪化させる(ランダムでも一括でもなく、選択式)。この天啓自体の設計・実装は本設計のスコープ外。今回は`tsukumoka`フラグを持つデータ構造のみ用意し、フラグを立てる手段(天啓)は未実装のまま残す。

## ショップ連携

### `ShopState`(`types.ts`)への追加

```ts
export interface ShopState {
  individual: ShopIndividualSlot[]
  packs: ShopPackSlot[]
  relic: { id: RelicId; sold: boolean } | null
}
```

既存のバラ売り3枠(護符・秘儀・天啓・神託から均等抽選)・福袋2枠とは別の、専用の4枠目として扱う。

### 抽選ロジック(`src/lib/game/shidasu/shop.ts`)

`rollShop`実行のたびに、未所持のレリック(`RELIC_POOL`から現在の`run.relics`に含まれる`id`を除いたもの)からランダムに1つ選び`relic`にセットする。候補が1つも無ければ(全種所持済み)`relic: null`とし、ショップ画面では枠自体を非表示にする。

### 価格・購入

- 秘儀・天啓・神託と同様の`buyPrice`関数を1つ用意する(`relicBuyPrice(params, id)`)。`sellPrice`相当の関数は作らない(売却不可のため)。
- 購入処理は単品購入のみ。既存の`buyIndividualRite`等と同様の1つの購入関数(`buyRelic`)を`engine.ts`に追加し、購入時に`run.relics`へ`{ id, tsukumoka: false }`を追加、`shop.relic.sold`を`true`にする。
- 福袋経由でのレリック入手は無し(`ShopSlotKind`に`'relic'`は追加しない。既存のバラ売り3枠・福袋の抽選対象には含めない)。

## 表示UI

### バッジ表示

`src/routes/game/shidasu/+page.svelte`内、既存の護符(`bg-emerald-900`)・天啓(`bg-indigo-900`)・神託(`bg-purple-900`)バッジが並ぶ常設表示エリア(`run.items`・`run.revelations`・`run.oracles`をそれぞれ`{#each}`している箇所)に、`run.relics`をループする同パターンのバッジを追加する。ショップ画面(同ファイル内のショップフェーズ表示、または将来分離される場合はショップコンポーネント)にも同様に所持レリック一覧を表示する。色は被らない新色として`bg-amber-900 text-amber-200/90 border border-amber-600/40`(琥珀色系、置物・縁起物のイメージに合わせる)を使う。

- `title`属性でマウスオーバー時に効果説明文を表示する(既存の`itemDesc`/`revelationDesc`/`oracleDesc`と同じパターン)。`tsukumoka`が`true`なら`tsukumokaDesc`、`false`なら`desc`を表示する。
- 付喪化済みのレリックは、バッジに★マークを付けて未付喪化のものと視覚的に区別する。

## スコープ外(本設計では扱わない)

- 付喪化のトリガーとなる天啓の具体的な効果・名前・実装
- 個別レリックの効果・名前(仮称)・価格の具体的な値の洗い出し(次のブレインストーミングセッションで護符・秘儀と同様に候補出しする)
- レリックの画像(AI生成画像の導入)。今回はテキストバッジ表示のみ

## 変更ファイル一覧(想定)

- `src/lib/game/shidasu/types.ts`: `RelicId`型、`RunState.relics`、`ShopState.relic`を追加
- `src/lib/game/shidasu/relics.ts`(新規): `RELIC_POOL`
- `src/lib/game/shidasu/params.ts`: `relics`型定義・`DEFAULT_PARAMS.relics`(動作確認用の仮エントリ`placeholder`のみ)を追加
- `src/lib/game/shidasu/shidasu.config.json`: `"relics": { "placeholder": {...} }`を追加
- `src/lib/game/shidasu/shop.ts`: `rollShop`にレリック枠の抽選ロジックを追加、`relicBuyPrice`を追加
- `src/lib/game/shidasu/engine.ts`: `buyRelic`を追加
- `src/routes/game/shidasu/+page.svelte`: 所持レリックバッジ表示、ショップ画面のレリック専用枠の表示・購入ボタンを追加

## 動作確認用の仮レリック

個別レリックの候補出しは別セッションだが、`RELIC_POOL`が空だとショップのレリック枠が常に非表示になり、購入・バッジ表示・ツールチップ・付喪化フラグの一連の動作を確認できない。そのため、動作確認専用の仮レリックを1つだけ入れて実装する。

- `RelicId`型: `'placeholder'`(1メンバーのみ。個別候補確定時にこの1個を含めて置き換える)
- `RELIC_POOL`: `['placeholder']`
- `params.relics.placeholder`: `{ name: '仮の置物', desc: '(動作確認用の仮レリック。効果なし)', tsukumokaDesc: '(動作確認用の仮レリック・付喪化状態。効果なし)', price: 10 }`

このエントリはゲームプレイに実効果を持たない、システム配線の動作確認専用のダミーであることをコード上のコメントで明記する。個別レリックの候補出しセッションで実際の内容に差し替える。
