# 妨害行動一覧のadmin編集画面 設計

## 背景・目的

妨害行動(`SabotageActionId`、32種類)の定義は現在`src/lib/game/shidasu/sabotage.ts`の`SABOTAGE_POOL: SabotageActionDef[]`にTypeScriptの配列としてハードコードされており、`name`(表示名)・`intervalTurns`(発動間隔ターン数)・`descTemplate`(効果説明文)を変更するにはソースコードを直接編集する必要がある。護符・秘儀・天啓・神託・レリックなど他のゲームエンティティは既に`params.ts`/`shidasu.config.json`側で管理され、`/admin/shidasu-xxx`画面から編集・保存できるようになっているが、妨害行動だけこの仕組みの対象外になっている。

本設計では、妨害行動の`name`・`intervalTurns`・`descTemplate`を既存の他エンティティと同じ管理方式(固定idプール+`params.ts`側の可変フィールド)に揃え、`/admin/shidasu-sabotage`という新規admin画面から編集できるようにする。**星ごとにどの妨害行動を発動させるか(`StarSabotage`の`none`/`all`/`some`割り当て)の編集はスコープ外**とする(既存の`none`/`all`の2値のみで変更しない)。

## データ移行

### 型定義の変更

`src/lib/game/shidasu/sabotage.ts`の現在の定義:

```ts
export interface SabotageActionDef {
  id: SabotageActionId
  name: string
  target: string
  intervalTurns: number
  descTemplate: string
}
export const SABOTAGE_POOL: SabotageActionDef[] = [
  { id: 'stockPurge', name: '大量放出', target: '山札', intervalTurns: 6, descTemplate: '...' },
  ...(32件)
]
```

を、他エンティティ(`RELIC_POOL: RelicId[]`など)と同じ「固定idの配列のみ」に変更する:

```ts
export const SABOTAGE_POOL: SabotageActionId[] = [
  'stockPurge', 'columnReturn', 'chainSettle', ...(既存32件のid、順序維持)
]
```

`target`(対象カテゴリ、例:「山札」「護符」)は編集対象にしないが、他の3フィールドと合わせて`params.ts`側に移す(理由は下記「編集対象フィールド」参照)。

### `params.ts`への追加

`ShidasuParams`インターフェースに以下を追加する:

```ts
sabotageActions: Record<SabotageActionId, { name: string; target: string; intervalTurns: number; descTemplate: string }>
```

`DEFAULT_PARAMS.sabotageActions`に、現在`SABOTAGE_POOL`が持っている32件の実値(`name`・`target`・`intervalTurns`・`descTemplate`)をそのまま移植する(値そのものは変更しない、移行のみ)。

### `shidasu.config.json`

`DEFAULT_PARAMS.sabotageActions`と同じ形で`"sabotageActions": { "stockPurge": { "name": "大量放出", "target": "山札", "intervalTurns": 6, "descTemplate": "..." }, ... }`セクションが追加される。既存の保存フロー(`/api/admin/shidasu-config`のGET/POST、`vite.config.ts`の`jsonFileApiPlugin`)がそのまま`sabotageActions`キーも含めて読み書きするため、API側の変更は不要。

### 編集対象フィールド

admin画面での編集対象は以下の3つ:

- `name`(表示名)
- `intervalTurns`(発動間隔ターン数)
- `descTemplate`(効果説明文)

`target`(対象カテゴリ、「山札」「護符」など)は**読み取り専用**として画面に表示するが、編集不可にする。`target`も`params.sabotageActions[id]`側に含める理由は、データを`sabotage.ts`(idのみ)と`params.ts`(全フィールド)の2箇所に分割せず、`RELIC_POOL`+`params.relics`と同じ「idプール+全フィールドをparamsで持つ」形に統一するため(読み取り専用フィールドをpoolとparamsに分割する方が構造として複雑になる)。

`id`(`SabotageActionId`)自体は既存のUnion型のままで、admin画面・params.ts側どちらでも編集不可・固定表示。

### `sabotage.ts`のロジック関数への影響

```ts
export function eligibleSabotageIds(sabotage: StarSabotage): SabotageActionId[] {
  switch (sabotage.kind) {
    case 'none': return []
    case 'all': return SABOTAGE_POOL.map(a => a.id)  // → SABOTAGE_POOL自体がSabotageActionId[]になるため `return SABOTAGE_POOL`
    case 'some': return sabotage.ids
  }
}

export function rollSabotage(sabotage: StarSabotage, rand: () => number): { pendingSabotageId: SabotageActionId | null; sabotageTurnsRemaining: number } {
  const ids = eligibleSabotageIds(sabotage)
  if (ids.length === 0) return { pendingSabotageId: null, sabotageTurnsRemaining: 0 }
  const id = ids[Math.floor(rand() * ids.length)]
  const def = SABOTAGE_POOL.find(a => a.id === id)!  // → intervalTurnsをparams経由で読む必要があるため、この関数はparams引数が必要になる
  return { pendingSabotageId: id, sabotageTurnsRemaining: def.intervalTurns }
}
```

`rollSabotage`は`intervalTurns`を`params.sabotageActions[id].intervalTurns`から読むため、シグネチャを`rollSabotage(params: ShidasuParams, sabotage: StarSabotage, rand: () => number)`に変更する(`params`を第一引数に追加)。`eligibleSabotageIds`は`id`の列挙のみで`intervalTurns`等を使わないため、シグネチャ変更は不要。

`sabotage.ts`に、レリックの`relicName(id, params)`/`relicDesc(id, params)`と同じパターンのヘルパー関数を追加する:

```ts
export function sabotageActionName(id: SabotageActionId, params: ShidasuParams): string {
  return params.sabotageActions[id].name
}
export function sabotageActionDesc(id: SabotageActionId, params: ShidasuParams): string {
  return params.sabotageActions[id].descTemplate
}
```

### 呼び出し元への影響

- `src/lib/game/shidasu/engine.ts`の`triggerSabotage`内で`rollSabotage(...)`を呼んでいる箇所(`rollSabotage(star?.sabotage ?? { kind: 'none' }, rand)`)は、既に`params`を引数に持っているため`rollSabotage(params, star?.sabotage ?? { kind: 'none' }, rand)`に変更するだけで済む。
- `src/routes/game/shidasu/+page.svelte`の`sabotageDetail(wave)`関数(`SABOTAGE_POOL.find(a => a.id === wave.pendingSabotageId)`で`action.name`を取得している箇所)は、`sabotageActionName(wave.pendingSabotageId, params)`を使う形に変更する(`params`は既にこのファイルのモジュールスコープに存在する)。
- `src/routes/admin/shidasu-debug/+page.svelte`の妨害行動デバッグボタン一覧(`{#each SABOTAGE_POOL as def (def.id)}` → `{def.name}`)は、`{#each SABOTAGE_POOL as id (id)}` → `{sabotageActionName(id, params)}`に変更する(`params`は既にこのファイルに存在する)。
- テスト(`sabotage.test.ts`・`sabotageEffects.test.ts`)は、`SABOTAGE_POOL`から`intervalTurns`等を直接参照している箇所を`DEFAULT_PARAMS.sabotageActions[id]`経由に変更し、`rollSabotage`呼び出しに`DEFAULT_PARAMS`を追加する。

## admin画面

`src/routes/admin/shidasu-sabotage/+page.svelte`を新規作成する。既存の`shidasu-relics/+page.svelte`と同じ実装パターンを踏襲する:

- `config = $state<ShidasuParams | null>(null)`、マウント時に`fetch('/api/admin/shidasu-config')`でGETし`config`にセット(失敗時は`DEFAULT_PARAMS`のディープコピーにフォールバックしエラー表示)
- `SABOTAGE_POOL`(`SabotageActionId[]`)を`{#each SABOTAGE_POOL as id (id)}`でループし、1行1妨害行動のテーブルを描画。列構成:
  - id(固定表示、編集不可)
  - name(テキスト入力、`bind:value={config.sabotageActions[id].name}`)
  - target(読み取り専用テキスト表示)
  - intervalTurns(数値入力、`bind:value={config.sabotageActions[id].intervalTurns}`)
  - descTemplate(テキスト入力、`bind:value={config.sabotageActions[id].descTemplate}`)
- バリデーション: `$derived.by`で全32件を走査し、`name`・`descTemplate`が空文字でないこと、`intervalTurns`が`Number.isInteger`かつ`> 0`であることをチェックし、`hasValidationError`を算出。保存ボタンは`disabled={hasValidationError || !config}`
- 保存ボタン押下で`/api/admin/shidasu-config`へPOST(`JSON.stringify(config)`)、成功時は既存パターンと同じトースト「保存しました(反映には再ビルド・再デプロイが必要です)」を表示
- `src/routes/admin/+page.svelte`のトップページに、他のshidasu系リンクカードと同じ形式でこのページへのリンクカードを1つ追加する

## テスト方針

- `sabotage.test.ts`: `SABOTAGE_POOL`が`SabotageActionId[]`(32件、重複無し)であることの検証に更新。`rollSabotage`呼び出しに`DEFAULT_PARAMS`を追加し、`intervalTurns`の期待値を`DEFAULT_PARAMS.sabotageActions[id].intervalTurns`から取得する形に変更。
- `sabotageEffects.test.ts`: `SABOTAGE_POOL`を全件ループする箇所は`SabotageActionId[]`化に伴い`for (const id of SABOTAGE_POOL)`のように変更(既存ロジック自体は変更不要)。
- admin画面自体の新規ユニットテストは追加しない(既存の`shidasu-relics`等のadmin画面にも専用テストが無く、プロジェクトの既存慣習と一致させる)。
- 既存の妨害行動32件の実際の挙動(発動間隔・説明文の内容)は移行前後で完全に一致すること(値のコピーのみ、変更なし)を確認する。

## スコープ外

- 星(`Star`)ごとの妨害行動割り当て(`StarSabotage`の`none`/`all`/`some`)の編集画面(現状の`none`/`all`のみのまま変更しない)。
- `StarSabotage`の`some`(個別ID指定)バリアントの実装(現状未実装のまま)。
- 妨害行動の新規追加・削除(既存32件の固定idはそのまま、`SabotageActionId`Union型・`SABOTAGE_POOL`の項目数は変更しない)。
- `target`(対象カテゴリ)フィールドの編集(読み取り専用のまま)。
