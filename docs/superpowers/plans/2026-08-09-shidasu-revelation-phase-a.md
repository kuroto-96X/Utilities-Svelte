# 天啓 Phase A(カード変換・場札操作系8個) Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** `docs/shidasu/shidasu-revelation-candidates.md`で採用済みの天啓候補のうちPhase A対象8個(No.2・4・5・8・9・25・28・31)を、新規天啓として実装する。

**Architecture:** 既存の`revelationEffects.ts`の変換関数パターン(`wave.tableau`と`deckComposition`を同時に書き換える純粋関数)を拡張し、8個の新規変換関数を追加する。候補8「全列トップ廃棄」のために`DeckCard`へ`removed`フラグを新設し、`deckComposition`から要素を削除せず除外する仕組みを先に作る。各候補の実装タスクは、型・プール・パラメータ・設定・監査データ・効果ロジック・テストを1タスクにまとめて完結させる(`applyRevelationEffect`の`switch`は`RevelationId`のユニオン型に対する網羅性チェックを受けるため、型だけ先に追加してロジックを後回しにすると`npm run check`が壊れる状態が複数タスクにまたがってしまう。各タスク終了後に常に型チェックが通る状態を保つため)。

**Tech Stack:** TypeScript, Vitest, SvelteKit(既存Shidasuゲームエンジンの拡張のみ、UIコンポーネントの変更は無し)

**参照設計doc:** `docs/superpowers/specs/2026-08-09-shidasu-revelation-phase-a-design.md`

---

## 前提知識(実装者向け)

- `WaveState.tableau`は`Card[][]`。各列の配列は**末尾(`col[col.length - 1]`)が「現在プレイ可能な一番上のカード」**、先頭(`col[0]`)が一番下(最初に配られた)カード。
- `Card`と`DeckCard`は`deckId`で対応付けられる。`Card`はウェーブごとに使い捨ての`id`を持つが、`deckId`はラン全体で不変。
- 天啓の変換関数は「`wave.tableau`(今の盤面)」と「`deckComposition`(ラン全体で持続するデッキ組成)」の両方を同じ`deckId`で対応付けて書き換える。これにより次ウェーブ以降も変換結果が反映される。
- ランクは`1`(A)〜`13`(K)。A⇔Kループの「+1」は `rank === 13 ? 1 : rank + 1` で計算する。
- `applyRevelationEffect`の`switch`は`RevelationId`(ユニオン型)を分岐しており、TypeScriptは「全パスで値を返しているか」を確認する際にこの網羅性を考慮する。新しい`RevelationId`を型に追加したら、同じタスク内で対応する`case`も必ず追加すること(型だけ先に追加すると`npm run check`が失敗する)。
- 全てのタスクはリポジトリルート(`c:\Users\the-f\Documents\ClaudeProjects\Utilities-Svelte`)で実行する。テストは `npm test -- <ファイル名>` (vitest)で実行できる。

---

### Task 1: DeckCardに`removed`フィールドを追加する

候補8「全列トップ廃棄」で使う「廃棄」の土台。`deckComposition`から要素を削除すると、新規カード追加時の`deckId`採番(配列長を基準にする方式)が壊れるため、削除ではなく`removed: true`フラグで管理する。

**Files:**
- Modify: `src/lib/game/shidasu/types.ts`(`DeckCard`インターフェース)
- Modify: `src/lib/game/shidasu/deck.ts`(`standardDeckComposition`・`addCardsToDeckComposition`)
- Modify: `src/lib/game/shidasu/engine.ts`(永劫アイテムの新規エントリ、143行目付近)
- Modify: `src/lib/game/shidasu/revelationEffects.ts`(`addWildToColumnTop`の新規エントリ、74行目付近)
- Modify: `src/lib/game/shidasu/deck.test.ts`(既存のDeckCard生の配列リテラル)
- Modify: `src/lib/game/shidasu/engine.test.ts`(既存のDeckCard生の配列リテラルによる等値比較)
- Modify: `src/lib/game/shidasu/revelationEffects.test.ts`(`deckCard`テストヘルパー)

- [ ] **Step 1: 失敗するテストを書く(`standardDeckComposition`の全エントリが`removed: false`であること)**

`src/lib/game/shidasu/deck.test.ts`の`describe('standardDeckComposition', ...)`ブロック内に、既存の`test('52枚、全スート×全ランクを網羅し、全て非ワイルド', ...)`の直後に以下を追加する。`toEqual`で`removed`キーの有無ごと厳密比較することで、フィールド未追加の状態を確実に検出する(`.every(c => !c.removed)`のような書き方は、`removed`キーが無くても`undefined`が偽と評価されて誤ってパスしてしまうため使わない)。

```ts
  test('全エントリがremoved:falseで初期化される', () => {
    const composition = standardDeckComposition()
    expect(composition[0]).toEqual({ deckId: 0, suit: '♠', rank: 1, wild: false, removed: false })
  })
```

- [ ] **Step 2: テストが失敗することを確認する**

Run: `npm test -- deck.test.ts`
Expected: FAIL(実際の`composition[0]`には`removed`キーが無いため、`removed: false`を含む期待値との`toEqual`比較が一致せず失敗する)

- [ ] **Step 3: `DeckCard`に`removed`フィールドを追加する**

`src/lib/game/shidasu/types.ts`の`DeckCard`インターフェースを以下のように変更する。

```ts
// ラン全体で持続するデッキの中身(idを持たない。ウェーブ開始のたびに新しいidを振ってCardを生成する)。
// deckIdは生成時に一度だけ振られる永続的な識別子で、以後配列内での位置が変わらない限り不変。
export interface DeckCard {
  deckId: number
  suit: Suit
  rank: Rank
  wild: boolean
  // 廃棄された(デッキから永久に除外された)カードか。要素を削除するとdeckIdの採番ロジック
  // (配列長を基準に採番する箇所が複数ある)が壊れるため、削除ではなくフラグで管理する。
  removed: boolean
}
```

- [ ] **Step 4: `deck.ts`の生成関数に`removed: false`を追加する**

`src/lib/game/shidasu/deck.ts`の`standardDeckComposition`を以下のように変更する。

```ts
export function standardDeckComposition(): DeckCard[] {
  const composition: DeckCard[] = []
  let deckId = 0
  for (const suit of SUITS) {
    for (let rank = 1; rank <= 13; rank++) {
      composition.push({ deckId: deckId++, suit, rank: rank as Rank, wild: false, removed: false })
    }
  }
  return composition
}
```

同ファイルの`addCardsToDeckComposition`を以下のように変更する。

```ts
export function addCardsToDeckComposition(deckComposition: DeckCard[], cards: NewCardSpec[]): DeckCard[] {
  let nextDeckId = deckComposition.length
  const added: DeckCard[] = cards.map(c => ({ deckId: nextDeckId++, suit: c.suit, rank: c.rank, wild: c.wild, removed: false }))
  return [...deckComposition, ...added]
}
```

- [ ] **Step 5: `engine.ts`の永劫アイテムの新規エントリに`removed: false`を追加する**

`src/lib/game/shidasu/engine.ts`の以下の行を

```ts
    composition = [...composition, { deckId: composition.length, suit: '★', rank: 0 as Rank, wild: true }]
```

以下に変更する。

```ts
    composition = [...composition, { deckId: composition.length, suit: '★', rank: 0 as Rank, wild: true, removed: false }]
```

- [ ] **Step 6: `revelationEffects.ts`の`addWildToColumnTop`の新規エントリに`removed: false`を追加する**

`src/lib/game/shidasu/revelationEffects.ts`の以下の行を

```ts
  const newComposition: DeckCard[] = [...deckComposition, { deckId: newDeckId, suit: '★', rank: 0 as Rank, wild: true }]
```

以下に変更する。

```ts
  const newComposition: DeckCard[] = [...deckComposition, { deckId: newDeckId, suit: '★', rank: 0 as Rank, wild: true, removed: false }]
```

- [ ] **Step 7: 既存テストの生のDeckCardリテラルを`removed`対応に修正する**

`src/lib/game/shidasu/deck.test.ts`の`describe('addCardsToDeckComposition', ...)`内、`test('deckIdが既に飛び飛びの場合でも配列長を基準に採番する...')`の以下の部分を

```ts
    const composition = [
      { deckId: 0, suit: '♠' as const, rank: 1 as const, wild: false },
      { deckId: 5, suit: '♥' as const, rank: 2 as const, wild: false },
    ]
```

以下に変更する。

```ts
    const composition = [
      { deckId: 0, suit: '♠' as const, rank: 1 as const, wild: false, removed: false },
      { deckId: 5, suit: '♥' as const, rank: 2 as const, wild: false, removed: false },
    ]
```

`src/lib/game/shidasu/engine.test.ts`の以下の2箇所を

```ts
    expect(composition[47]).toEqual({ deckId: 47, suit: '♣', rank: 9, wild: false })
```

```ts
    expect(wildEntries).toEqual([{ deckId: 47, suit: '♣', rank: 9, wild: true }])
```

それぞれ以下に変更する。

```ts
    expect(composition[47]).toEqual({ deckId: 47, suit: '♣', rank: 9, wild: false, removed: false })
```

```ts
    expect(wildEntries).toEqual([{ deckId: 47, suit: '♣', rank: 9, wild: true, removed: false }])
```

- [ ] **Step 8: `revelationEffects.test.ts`の`deckCard`テストヘルパーを`removed`対応にする**

`src/lib/game/shidasu/revelationEffects.test.ts`の以下の関数を

```ts
function deckCard(deckId: number, suit: DeckCard['suit'], rank: DeckCard['rank'], wild = false): DeckCard {
  return { deckId, suit, rank, wild }
}
```

以下に変更する。

```ts
function deckCard(deckId: number, suit: DeckCard['suit'], rank: DeckCard['rank'], wild = false, removed = false): DeckCard {
  return { deckId, suit, rank, wild, removed }
}
```

- [ ] **Step 9: テストと型チェックを実行し、全て通ることを確認する**

Run: `npm test -- deck.test.ts engine.test.ts revelationEffects.test.ts`
Expected: PASS(全テストグリーン)

Run: `npm run check`
Expected: エラー無し

- [ ] **Step 10: コミット**

```bash
git add src/lib/game/shidasu/types.ts src/lib/game/shidasu/deck.ts src/lib/game/shidasu/engine.ts src/lib/game/shidasu/revelationEffects.ts src/lib/game/shidasu/deck.test.ts src/lib/game/shidasu/engine.test.ts src/lib/game/shidasu/revelationEffects.test.ts
git commit -m "feat: DeckCardにremovedフラグを追加(廃棄インフラの土台)"
```

---

### Task 2: `startWave`と剛毅計算を`removed`フラグに対応させる

Task 1で追加した`removed`フラグを実際に機能させる。`removed: true`のカードは次ウェーブの配布(`startWave`)で二度と出現しないようにする。

**Files:**
- Modify: `src/lib/game/shidasu/engine.ts`(`startWave`関数、149行目・166行目付近)
- Modify: `src/lib/game/shidasu/engine.test.ts`

- [ ] **Step 1: 失敗するテストを書く(removedカードが山札構築から除外される)**

`src/lib/game/shidasu/engine.test.ts`の`describe('永劫...')`ブロック(386〜404行目付近)の直後、`describe('剛毅(fortitude)...')`の直前に以下を追加する。

```ts
describe('removed:trueのdeckComposition要素はstartWaveの山札構築から除外される', () => {
  test('removedのカードは場札・山札・foundationのどこにも現れない', () => {
    const composition = standardDeckComposition().map((c, i) => (i === 0 ? { ...c, removed: true } : c))
    const { wave } = startWave(DEFAULT_PARAMS, 0, 0, [], composition, 1)
    const dealtDeckIds = [
      ...wave.tableau.flat().map(c => c.deckId),
      ...wave.stock.map(c => c.deckId),
      wave.foundation.deckId,
    ]
    expect(dealtDeckIds).not.toContain(composition[0].deckId)
    expect(dealtDeckIds).toHaveLength(51)
  })
})
```

- [ ] **Step 2: テストが失敗することを確認する**

Run: `npm test -- engine.test.ts -t "removedのカードは場札"`
Expected: FAIL(`dealtDeckIds`が52件になり、`removed`のカードも配られてしまう)

- [ ] **Step 3: `startWave`のシャッフル前フィルタを追加する**

`src/lib/game/shidasu/engine.ts`の以下の行を

```ts
  const deck = shuffle(composition.map(c => ({ id: nextId(), ...c })), rand)
```

以下に変更する。

```ts
  const deck = shuffle(composition.filter(c => !c.removed).map(c => ({ id: nextId(), ...c })), rand)
```

- [ ] **Step 4: テストが通ることを確認する**

Run: `npm test -- engine.test.ts -t "removedのカードは場札"`
Expected: PASS

- [ ] **Step 5: 剛毅(fortitude)のデッキ枚数カウントも`removed`を除外するテストを書く**

`describe('剛毅(fortitude)...')`ブロック内、既存の`test('剛毅を所持していなければ加算されない', ...)`の直後に以下を追加する。

```ts
  test('removedのカードはデッキ枚数カウントから除外される(実質29枚なら加算なし)', () => {
    const composition = standardDeckComposition().slice(0, 40).map((c, i) => (i < 11 ? { ...c, removed: true } : c))
    const { wave } = startWave(DEFAULT_PARAMS, 0, 0, ['fortitude'], composition, 1)
    expect(wave.baseComboCount).toBe(0)
  })
```

- [ ] **Step 6: テストが失敗することを確認する**

Run: `npm test -- engine.test.ts -t "removedのカードはデッキ枚数カウント"`
Expected: FAIL(`composition.length`が40のままカウントされ、`baseComboCount`が1になってしまう)

- [ ] **Step 7: 剛毅の計算を`removed`除外後の枚数に変更する**

`src/lib/game/shidasu/engine.ts`の以下の行を

```ts
  const fortitudeBaseCombo = items.includes('fortitude')
    ? Math.floor(composition.length / params.talismans.fortitude.n)
    : 0
```

以下に変更する。

```ts
  const fortitudeBaseCombo = items.includes('fortitude')
    ? Math.floor(composition.filter(c => !c.removed).length / params.talismans.fortitude.n)
    : 0
```

- [ ] **Step 8: 全テストが通ることを確認する**

Run: `npm test -- engine.test.ts`
Expected: PASS(全テストグリーン)

- [ ] **Step 9: コミット**

```bash
git add src/lib/game/shidasu/engine.ts src/lib/game/shidasu/engine.test.ts
git commit -m "feat: startWave・剛毅計算をremovedフラグに対応させる"
```

---

## Task 3〜10共通の進め方

以降のTask 3〜10は、天啓1個ずつを次の順序で実装する。

1. `RevelationId`(types.ts)にIDを1個追加
2. `REVELATION_POOL`(revelations.ts)にIDを1個追加
3. `ShidasuParams['revelations']`の型(params.ts)にエントリを1個追加
4. `DEFAULT_PARAMS.revelations`(params.ts)にエントリを1個追加
5. `shidasu.config.json`の`revelations`にエントリを1個追加
6. `REVELATION_ACTUAL_EFFECTS`(revelationActualEffects.ts)にエントリを1個追加
7. 失敗するテストを書く
8. `revelationEffects.ts`に効果関数を実装し、`applyRevelationEffect`の`switch`にcaseを追加(対象選択が必要な候補は`revelationNeedsTarget`にも追加)
9. テストが通ることを確認
10. `npm run check`でエラー無しを確認
11. コミット

これは、型だけ先に追加してロジックを後回しにすると`applyRevelationEffect`の`switch`の網羅性チェックで`npm run check`が失敗するため(前提知識を参照)。

---

### Task 3: 候補No.2「隣列連鎖変換」(室・shitsu)を実装する

**Files:**
- Modify: `src/lib/game/shidasu/types.ts`(`RevelationId`)
- Modify: `src/lib/game/shidasu/revelations.ts`(`REVELATION_POOL`)
- Modify: `src/lib/game/shidasu/params.ts`(型・`DEFAULT_PARAMS`)
- Modify: `src/lib/game/shidasu/shidasu.config.json`
- Modify: `src/lib/game/shidasu/revelationActualEffects.ts`
- Modify: `src/lib/game/shidasu/revelationEffects.ts`
- Modify: `src/lib/game/shidasu/revelationEffects.test.ts`

- [ ] **Step 1: `RevelationId`に`shitsu`を追加する**

`src/lib/game/shidasu/types.ts`の`RevelationId`を以下のように変更する。

```ts
export type RevelationId =
  | 'kaku' | 'kou' | 'tei' | 'bou'
  | 'shin' | 'bi' | 'ki' | 'to'
  | 'gyu' | 'jo'
  | 'kyo'
  | 'aya'
  | 'shitsu'
```

- [ ] **Step 2: `REVELATION_POOL`に`shitsu`を追加する**

`src/lib/game/shidasu/revelations.ts`の`REVELATION_POOL`を以下のように変更する。

```ts
export const REVELATION_POOL: RevelationId[] = [
  'kaku', 'kou', 'tei', 'bou',
  'shin', 'bi', 'ki', 'to',
  'gyu', 'jo',
  'kyo',
  'aya',
  'shitsu',
]
```

- [ ] **Step 3: `ShidasuParams['revelations']`の型に`shitsu`を追加する**

`src/lib/game/shidasu/params.ts`の`revelations`型ブロック(`aya: { name: string; desc: string }`の直後)に以下を追加する。

```ts
    shitsu: { name: string; desc: string }
```

- [ ] **Step 4: `DEFAULT_PARAMS.revelations`に`shitsu`を追加する**

`src/lib/game/shidasu/params.ts`の`DEFAULT_PARAMS`内、`revelations`ブロックの`aya: { name: '危', desc: '...' },`の直後に以下を追加する。

```ts
    shitsu: { name: '室', desc: '場札から選んだ1列の各カードを、1つ左の列の同じ位置のカードのランク+1に変換する(左列がワイルドの位置・左列の枚数が足りない位置は対象外)。左端の列を選んだ場合は右端の列を参照する' },
```

- [ ] **Step 5: `shidasu.config.json`の`revelations`に`shitsu`を追加する**

`src/lib/game/shidasu/shidasu.config.json`の`"revelations"`オブジェクト内、`"aya": { "name": "危", "desc": "..." }`の直後に以下を追加する(直前の`aya`エントリの末尾に`,`を追加するのを忘れないこと)。

```json
    "shitsu": {
      "name": "室",
      "desc": "場札から選んだ1列の各カードを、1つ左の列の同じ位置のカードのランク+1に変換する(左列がワイルドの位置・左列の枚数が足りない位置は対象外)。左端の列を選んだ場合は右端の列を参照する"
    }
```

- [ ] **Step 6: `REVELATION_ACTUAL_EFFECTS`(監査用)に`shitsu`を追加する**

`src/lib/game/shidasu/revelationActualEffects.ts`の`aya: '...'`の直後に以下を追加する。

```ts
  shitsu: '選んだ列の各カード(位置iごと)を、1つ左の列の同じ位置iのカードのランク+1(A⇔Kループ)に変換し、deckCompositionの対応する枠も同じランクに書き換える。左列がワイルドの位置・左列の方が短く対応する位置が無い場合はスキップ。選択列自身がワイルドの位置もスキップ。列0(左端)を選んだ場合の参照列は最終列',
```

- [ ] **Step 7: 失敗するテストを書く**

`src/lib/game/shidasu/revelationEffects.test.ts`の`describe('revelationEffects', ...)`ブロック内、最後の`test('revelationNeedsTarget: ...')`の直前に以下を追加する。

```ts
  test('室: 選んだ列の各カードが1つ左の列の同じ位置のランク+1に変換され、deckCompositionにも反映される', () => {
    const wave = baseWave({
      tableau: [
        [card(1, '♠', 5), card(2, '♠', 13)],
        [card(3, '♥', 1), card(4, '♥', 2, true)],
      ],
    })
    const deckComposition: DeckCard[] = [
      deckCard(1, '♠', 5), deckCard(2, '♠', 13), deckCard(3, '♥', 1), deckCard(4, '♥', 2, true),
    ]
    const result = applyRevelationEffect(DEFAULT_PARAMS, wave, deckComposition, 'shitsu', 1, createRng(1))
    expect(result.wave.tableau[1][0].rank).toBe(6) // 左列位置0(rank5)+1
    expect(result.wave.tableau[1][1].wild).toBe(true) // 選択列側がワイルドならスキップ
    expect(result.wave.tableau[1][1].rank).toBe(2) // 変換されず元のまま
    expect(result.deckComposition.find(c => c.deckId === 3)?.rank).toBe(6)
  })

  test('室: 左端の列を選んだ場合は右端の列を参照する(A⇔Kループ)', () => {
    const wave = baseWave({
      tableau: [
        [card(1, '♠', 5)],
        [card(2, '♥', 1)],
        [card(3, '♦', 13)],
      ],
    })
    const deckComposition: DeckCard[] = [deckCard(1, '♠', 5), deckCard(2, '♥', 1), deckCard(3, '♦', 13)]
    const result = applyRevelationEffect(DEFAULT_PARAMS, wave, deckComposition, 'shitsu', 0, createRng(1))
    expect(result.wave.tableau[0][0].rank).toBe(1) // 右端列(rank13)+1 = ループで1
  })

  test('室: 参照列の方が短い場合、はみ出した位置は変換されない', () => {
    const wave = baseWave({
      tableau: [
        [card(1, '♠', 5)],
        [card(2, '♥', 1), card(3, '♥', 2)],
      ],
    })
    const deckComposition: DeckCard[] = [deckCard(1, '♠', 5), deckCard(2, '♥', 1), deckCard(3, '♥', 2)]
    const result = applyRevelationEffect(DEFAULT_PARAMS, wave, deckComposition, 'shitsu', 1, createRng(1))
    expect(result.wave.tableau[1][0].rank).toBe(6) // 位置0は左列(rank5)+1
    expect(result.wave.tableau[1][1].rank).toBe(2) // 位置1は左列に対応するカードが無いため変換されない
  })
```

またファイル末尾の`revelationNeedsTarget`テストに以下の行を追加する。

```ts
    expect(revelationNeedsTarget('shitsu')).toBe(true)
```

- [ ] **Step 8: テストが失敗することを確認する**

Run: `npm test -- revelationEffects.test.ts -t "室"`
Expected: FAIL(`'shitsu'`は`applyRevelationEffect`の`switch`にまだ対応するcaseが無く、`default`も無いため関数が`undefined`を返す。vitestはesbuildで型チェックせず実行するため、テスト実行時に`result.wave`へのアクセスで`TypeError: Cannot read properties of undefined`となって失敗する)

- [ ] **Step 9: `convertColumnChainFromLeft`関数を実装する**

`src/lib/game/shidasu/revelationEffects.ts`の`canUseRevelation`エクスポート関数の直前(`addWildToColumnTop`関数の直後)に以下を追加する。

```ts
// 選択列の各位置iのカードを、1つ左の列の同じ位置iのカードのランク+1(A⇔Kループ)に変換する。
// 左端の列を選んだ場合は右端の列を参照する。参照列側がワイルド・存在しない位置(参照列の方が短い場合)はスキップする。
function convertColumnChainFromLeft(wave: WaveState, deckComposition: DeckCard[], colIndex: number): { wave: WaveState; deckComposition: DeckCard[] } {
  const col = wave.tableau[colIndex]
  if (!col) return { wave, deckComposition }
  const cols = wave.tableau.length
  const refIndex = colIndex === 0 ? cols - 1 : colIndex - 1
  const refCol = wave.tableau[refIndex]
  const rankByDeckId = new Map<number, Rank>()
  const newCol = col.map((cardEl, i) => {
    if (cardEl.wild) return cardEl
    const refCard = refCol?.[i]
    if (!refCard || refCard.wild) return cardEl
    const newRank = (refCard.rank === 13 ? 1 : refCard.rank + 1) as Rank
    rankByDeckId.set(cardEl.deckId, newRank)
    return { ...cardEl, rank: newRank }
  })
  const tableau = wave.tableau.map((c, i) => (i === colIndex ? newCol : c))
  const newComposition = deckComposition.map(entry => (rankByDeckId.has(entry.deckId) ? { ...entry, rank: rankByDeckId.get(entry.deckId) as Rank } : entry))
  return { wave: { ...wave, tableau }, deckComposition: newComposition }
}
```

`revelationNeedsTarget`関数の`case 'aya':`の直後に以下を追加する(`case 'aya':`と`case 'shitsu':`が連続して`return true`の直前に並ぶ形にする)。

```ts
    case 'shitsu':
```

`applyRevelationEffect`関数の`switch`内、`case 'aya':`のcaseの直後に以下を追加する。

```ts
    case 'shitsu':
      return targetCol === null ? { wave, deckComposition } : convertColumnChainFromLeft(wave, deckComposition, targetCol)
```

- [ ] **Step 10: テストが通ることを確認する**

Run: `npm test -- revelationEffects.test.ts`
Expected: PASS(全テストグリーン)

- [ ] **Step 11: 型チェックを実行する**

Run: `npm run check`
Expected: エラー無し

- [ ] **Step 12: コミット**

```bash
git add src/lib/game/shidasu/types.ts src/lib/game/shidasu/revelations.ts src/lib/game/shidasu/params.ts src/lib/game/shidasu/shidasu.config.json src/lib/game/shidasu/revelationActualEffects.ts src/lib/game/shidasu/revelationEffects.ts src/lib/game/shidasu/revelationEffects.test.ts
git commit -m "feat: 天啓「室」(隣列連鎖変換)を実装"
```

---

### Task 4: 候補No.4「4色循環変換」(壁・heki)を実装する

**Files:**
- Modify: `src/lib/game/shidasu/types.ts`(`RevelationId`)
- Modify: `src/lib/game/shidasu/revelations.ts`(`REVELATION_POOL`)
- Modify: `src/lib/game/shidasu/params.ts`(型・`DEFAULT_PARAMS`)
- Modify: `src/lib/game/shidasu/shidasu.config.json`
- Modify: `src/lib/game/shidasu/revelationActualEffects.ts`
- Modify: `src/lib/game/shidasu/revelationEffects.ts`
- Modify: `src/lib/game/shidasu/revelationEffects.test.ts`

- [ ] **Step 1: `RevelationId`に`heki`を追加する**

`src/lib/game/shidasu/types.ts`の`RevelationId`の`| 'shitsu'`の直後に以下を追加する。

```ts
  | 'heki'
```

- [ ] **Step 2: `REVELATION_POOL`に`heki`を追加する**

`src/lib/game/shidasu/revelations.ts`の`REVELATION_POOL`の`'shitsu',`の直後に以下を追加する。

```ts
  'heki',
```

- [ ] **Step 3: `ShidasuParams['revelations']`の型に`heki`を追加する**

`src/lib/game/shidasu/params.ts`の`revelations`型ブロック、`shitsu: { name: string; desc: string }`の直後に以下を追加する。

```ts
    heki: { name: string; desc: string }
```

- [ ] **Step 4: `DEFAULT_PARAMS.revelations`に`heki`を追加する**

`src/lib/game/shidasu/params.ts`の`DEFAULT_PARAMS`内、`shitsu: { name: '室', desc: '...' },`の直後に以下を追加する。

```ts
    heki: { name: '壁', desc: '場札全体で♠→♥→♣→♦→♠の順にスートを循環変換する(ワイルドは対象外)' },
```

- [ ] **Step 5: `shidasu.config.json`の`revelations`に`heki`を追加する**

`src/lib/game/shidasu/shidasu.config.json`の`"shitsu": { ... }`の直後に以下を追加する(`shitsu`エントリの末尾に`,`を追加するのを忘れないこと)。

```json
    "heki": {
      "name": "壁",
      "desc": "場札全体で♠→♥→♣→♦→♠の順にスートを循環変換する(ワイルドは対象外)"
    }
```

- [ ] **Step 6: `REVELATION_ACTUAL_EFFECTS`に`heki`を追加する**

`src/lib/game/shidasu/revelationActualEffects.ts`の`shitsu: '...',`の直後に以下を追加する。

```ts
  heki: '場札全体の非ワイルドカードを、変換前のスート基準の対応表(♠→♥、♥→♣、♣→♦、♦→♠)で1回だけ変換し、deckCompositionの対応する枠も書き換える(ワイルドは対象外、逐次適用ではないためカスケードしない)',
```

- [ ] **Step 7: 失敗するテストを書く**

`revelationEffects.test.ts`に以下を追加する(Task 3で追加したテスト群の直後)。

```ts
  test('壁: 場札全体で♠→♥→♣→♦→♠と循環変換され、deckCompositionにも反映される(カスケードしない)', () => {
    const wave = baseWave({
      tableau: [[card(1, '♠', 3), card(2, '♥', 4), card(3, '♣', 5), card(4, '♦', 6), card(5, '♠', 7, true)]],
    })
    const deckComposition: DeckCard[] = [
      deckCard(1, '♠', 3), deckCard(2, '♥', 4), deckCard(3, '♣', 5), deckCard(4, '♦', 6), deckCard(5, '♠', 7, true),
    ]
    const result = applyRevelationEffect(DEFAULT_PARAMS, wave, deckComposition, 'heki', null, createRng(1))
    expect(result.wave.tableau[0].map(c => c.suit)).toEqual(['♥', '♣', '♦', '♠', '♠'])
    expect(result.wave.tableau[0][4].wild).toBe(true) // ワイルドは対象外
    expect(result.deckComposition.find(c => c.deckId === 1)?.suit).toBe('♥')
    expect(result.deckComposition.find(c => c.deckId === 4)?.suit).toBe('♠')
    expect(result.deckComposition.find(c => c.deckId === 5)?.suit).toBe('♠') // ワイルドのエントリは変更しない
  })
```

- [ ] **Step 8: テストが失敗することを確認する**

Run: `npm test -- revelationEffects.test.ts -t "壁"`
Expected: FAIL(`'heki'`未対応)

- [ ] **Step 9: `convertTableauSuitCycle`関数を実装する**

`revelationEffects.ts`の`convertColumnChainFromLeft`関数の直後に以下を追加する。

```ts
const SUIT_CYCLE: Record<Suit, Suit> = { '♠': '♥', '♥': '♣', '♣': '♦', '♦': '♠', '★': '★' }

// 場札全体で♠→♥→♣→♦→♠の順にスートを循環変換する。変換前のスートを基準に対応表を1回だけ引くため、
// 逐次適用によるカスケード(例: ♠→♥に変換した直後のカードがさらに♥→♣に変換される)は起きない。
function convertTableauSuitCycle(wave: WaveState, deckComposition: DeckCard[]): { wave: WaveState; deckComposition: DeckCard[] } {
  const suitByDeckId = new Map<number, Suit>()
  const tableau = wave.tableau.map(col => col.map(cardEl => {
    if (cardEl.wild) return cardEl
    const newSuit = SUIT_CYCLE[cardEl.suit]
    suitByDeckId.set(cardEl.deckId, newSuit)
    return { ...cardEl, suit: newSuit }
  }))
  const newComposition = deckComposition.map(entry => (suitByDeckId.has(entry.deckId) ? { ...entry, suit: suitByDeckId.get(entry.deckId) as Suit } : entry))
  return { wave: { ...wave, tableau }, deckComposition: newComposition }
}
```

`applyRevelationEffect`の`switch`内、`case 'shitsu':`のcaseの直後に以下を追加する。

```ts
    case 'heki':
      return convertTableauSuitCycle(wave, deckComposition)
```

- [ ] **Step 10: テストが通ることを確認する**

Run: `npm test -- revelationEffects.test.ts`
Expected: PASS

- [ ] **Step 11: 型チェックを実行する**

Run: `npm run check`
Expected: エラー無し

- [ ] **Step 12: コミット**

```bash
git add src/lib/game/shidasu/types.ts src/lib/game/shidasu/revelations.ts src/lib/game/shidasu/params.ts src/lib/game/shidasu/shidasu.config.json src/lib/game/shidasu/revelationActualEffects.ts src/lib/game/shidasu/revelationEffects.ts src/lib/game/shidasu/revelationEffects.test.ts
git commit -m "feat: 天啓「壁」(4色循環変換)を実装"
```

---

### Task 5: 候補No.5「階段整列」(奎・kei)を実装する

**Files:**
- Modify: `src/lib/game/shidasu/types.ts`(`RevelationId`)
- Modify: `src/lib/game/shidasu/revelations.ts`(`REVELATION_POOL`)
- Modify: `src/lib/game/shidasu/params.ts`(型・`DEFAULT_PARAMS`)
- Modify: `src/lib/game/shidasu/shidasu.config.json`
- Modify: `src/lib/game/shidasu/revelationActualEffects.ts`
- Modify: `src/lib/game/shidasu/revelationEffects.ts`
- Modify: `src/lib/game/shidasu/revelationEffects.test.ts`

- [ ] **Step 1: `RevelationId`に`kei`を追加する**

`src/lib/game/shidasu/types.ts`の`RevelationId`の`| 'heki'`の直後に以下を追加する。

```ts
  | 'kei'
```

- [ ] **Step 2: `REVELATION_POOL`に`kei`を追加する**

`src/lib/game/shidasu/revelations.ts`の`REVELATION_POOL`の`'heki',`の直後に以下を追加する。

```ts
  'kei',
```

- [ ] **Step 3: `ShidasuParams['revelations']`の型に`kei`を追加する**

`src/lib/game/shidasu/params.ts`の`revelations`型ブロック、`heki: { name: string; desc: string }`の直後に以下を追加する。

```ts
    kei: { name: string; desc: string }
```

- [ ] **Step 4: `DEFAULT_PARAMS.revelations`に`kei`を追加する**

`src/lib/game/shidasu/params.ts`の`DEFAULT_PARAMS`内、`heki: { name: '壁', desc: '...' },`の直後に以下を追加する。

```ts
    kei: { name: '奎', desc: '空でない列を左から順に、一番左の列の一番上のカードのランクを起点とした階段状のランクに、各列の一番上のカードを変換する(空の列は無視。ワイルドは対象外)' },
```

- [ ] **Step 5: `shidasu.config.json`の`revelations`に`kei`を追加する**

`src/lib/game/shidasu/shidasu.config.json`の`"heki": { ... }`の直後に以下を追加する(`heki`エントリの末尾に`,`を追加するのを忘れないこと)。

```json
    "kei": {
      "name": "奎",
      "desc": "空でない列を左から順に、一番左の列の一番上のカードのランクを起点とした階段状のランクに、各列の一番上のカードを変換する(空の列は無視。ワイルドは対象外)"
    }
```

- [ ] **Step 6: `REVELATION_ACTUAL_EFFECTS`に`kei`を追加する**

`src/lib/game/shidasu/revelationActualEffects.ts`の`heki: '...',`の直後に以下を追加する。

```ts
  kei: '空でない列を左から順に走査し、最初の列の一番上のカードのランクを起点に、i番目の列の一番上のカードをbase+i(A⇔Kループ)に変換する。deckCompositionの対応する枠も書き換える(空列はカウントしない、ワイルドの列はスキップするが順番はカウントする)',
```

- [ ] **Step 7: 失敗するテストを書く**

```ts
  test('奎: 空でない列を左から順に、先頭列の一番上のランクを起点とした階段状に各列の一番上が変換される(空列は無視)', () => {
    const wave = baseWave({
      tableau: [
        [card(1, '♠', 5), card(2, '♠', 6)], // 一番上(末尾)はrank6
        [], // 空列は無視される
        [card(3, '♥', 9)], // 一番上
        [card(4, '♦', 1, true)], // ワイルドは変換しない
      ],
    })
    const deckComposition: DeckCard[] = [
      deckCard(1, '♠', 5), deckCard(2, '♠', 6), deckCard(3, '♥', 9), deckCard(4, '♦', 1, true),
    ]
    const result = applyRevelationEffect(DEFAULT_PARAMS, wave, deckComposition, 'kei', null, createRng(1))
    expect(result.wave.tableau[0][1].rank).toBe(6) // 起点(base)はそのまま
    expect(result.wave.tableau[2][0].rank).toBe(7) // 2番目の空でない列 → base+1
    expect(result.wave.tableau[3][0].wild).toBe(true)
    expect(result.wave.tableau[3][0].rank).toBe(1) // ワイルドは変換されない
    expect(result.deckComposition.find(c => c.deckId === 3)?.rank).toBe(7)
  })
```

- [ ] **Step 8: テストが失敗することを確認する**

Run: `npm test -- revelationEffects.test.ts -t "奎"`
Expected: FAIL(`'kei'`未対応)

- [ ] **Step 9: `stairAlignTopCards`関数を実装する**

`revelationEffects.ts`の`convertTableauSuitCycle`関数の直後に以下を追加する。

```ts
// 空でない列を左から順に走査し、最初の列の一番上(末尾)のカードのランクを起点に、i番目(空列を除いた順番)の
// 空でない列の一番上のカードをbase+i(A⇔Kループ)に変換する。空の列は無視(カウントしない)。
// 一番上がワイルドの列は変換しない(ただし順番はカウントする)。
function stairAlignTopCards(wave: WaveState, deckComposition: DeckCard[]): { wave: WaveState; deckComposition: DeckCard[] } {
  const nonEmptyCols = wave.tableau.map((_, i) => i).filter(i => wave.tableau[i].length > 0)
  if (nonEmptyCols.length === 0) return { wave, deckComposition }
  const baseCol = wave.tableau[nonEmptyCols[0]]
  const baseRank = baseCol[baseCol.length - 1].rank
  const rankByDeckId = new Map<number, Rank>()
  const tableau = wave.tableau.map((col, ci) => {
    const order = nonEmptyCols.indexOf(ci)
    if (order === -1) return col
    const topCard = col[col.length - 1]
    if (topCard.wild) return col
    const newRank = (((baseRank - 1 + order) % 13) + 1) as Rank
    rankByDeckId.set(topCard.deckId, newRank)
    return [...col.slice(0, -1), { ...topCard, rank: newRank }]
  })
  const newComposition = deckComposition.map(entry => (rankByDeckId.has(entry.deckId) ? { ...entry, rank: rankByDeckId.get(entry.deckId) as Rank } : entry))
  return { wave: { ...wave, tableau }, deckComposition: newComposition }
}
```

`applyRevelationEffect`の`switch`内、`case 'heki':`のcaseの直後に以下を追加する。

```ts
    case 'kei':
      return stairAlignTopCards(wave, deckComposition)
```

- [ ] **Step 10: テストが通ることを確認する**

Run: `npm test -- revelationEffects.test.ts`
Expected: PASS

- [ ] **Step 11: 型チェックを実行する**

Run: `npm run check`
Expected: エラー無し

- [ ] **Step 12: コミット**

```bash
git add src/lib/game/shidasu/types.ts src/lib/game/shidasu/revelations.ts src/lib/game/shidasu/params.ts src/lib/game/shidasu/shidasu.config.json src/lib/game/shidasu/revelationActualEffects.ts src/lib/game/shidasu/revelationEffects.ts src/lib/game/shidasu/revelationEffects.test.ts
git commit -m "feat: 天啓「奎」(階段整列)を実装"
```

---

### Task 6: 候補No.8「全列トップ廃棄」(婁・rou)を実装する

**Files:**
- Modify: `src/lib/game/shidasu/types.ts`(`RevelationId`)
- Modify: `src/lib/game/shidasu/revelations.ts`(`REVELATION_POOL`)
- Modify: `src/lib/game/shidasu/params.ts`(型・`DEFAULT_PARAMS`)
- Modify: `src/lib/game/shidasu/shidasu.config.json`
- Modify: `src/lib/game/shidasu/revelationActualEffects.ts`
- Modify: `src/lib/game/shidasu/revelationEffects.ts`
- Modify: `src/lib/game/shidasu/revelationEffects.test.ts`

- [ ] **Step 1: `RevelationId`に`rou`を追加する**

`src/lib/game/shidasu/types.ts`の`RevelationId`の`| 'kei'`の直後に以下を追加する。

```ts
  | 'rou'
```

- [ ] **Step 2: `REVELATION_POOL`に`rou`を追加する**

`src/lib/game/shidasu/revelations.ts`の`REVELATION_POOL`の`'kei',`の直後に以下を追加する。

```ts
  'rou',
```

- [ ] **Step 3: `ShidasuParams['revelations']`の型に`rou`を追加する**

`src/lib/game/shidasu/params.ts`の`revelations`型ブロック、`kei: { name: string; desc: string }`の直後に以下を追加する。

```ts
    rou: { name: string; desc: string }
```

- [ ] **Step 4: `DEFAULT_PARAMS.revelations`に`rou`を追加する**

`src/lib/game/shidasu/params.ts`の`DEFAULT_PARAMS`内、`kei: { name: '奎', desc: '...' },`の直後に以下を追加する。

```ts
    rou: { name: '婁', desc: '場札の全ての列の一番上のカードを廃棄する(デッキから永久に取り除く。ワイルドも対象)' },
```

- [ ] **Step 5: `shidasu.config.json`の`revelations`に`rou`を追加する**

`src/lib/game/shidasu/shidasu.config.json`の`"kei": { ... }`の直後に以下を追加する(`kei`エントリの末尾に`,`を追加するのを忘れないこと)。

```json
    "rou": {
      "name": "婁",
      "desc": "場札の全ての列の一番上のカードを廃棄する(デッキから永久に取り除く。ワイルドも対象)"
    }
```

- [ ] **Step 6: `REVELATION_ACTUAL_EFFECTS`に`rou`を追加する**

`src/lib/game/shidasu/revelationActualEffects.ts`の`kei: '...',`の直後に以下を追加する。

```ts
  rou: '場札の全ての列の一番上のカード(ワイルド含む)をwave.tableauから取り除き、deckCompositionの対応する枠をremoved:trueにする(配列からは削除しない。空の列はスキップ)',
```

- [ ] **Step 7: 失敗するテストを書く**

```ts
  test('婁: 場札の全ての列の一番上のカード(ワイルド含む)が廃棄され、wave.tableauから取り除かれdeckCompositionがremoved:trueになる', () => {
    const wave = baseWave({
      tableau: [
        [card(1, '♠', 5), card(2, '♠', 6)],
        [],
        [card(3, '♥', 9, true)],
      ],
    })
    const deckComposition: DeckCard[] = [
      deckCard(1, '♠', 5), deckCard(2, '♠', 6), deckCard(3, '♥', 9, true),
    ]
    const result = applyRevelationEffect(DEFAULT_PARAMS, wave, deckComposition, 'rou', null, createRng(1))
    expect(result.wave.tableau[0]).toEqual([card(1, '♠', 5)]) // 一番上(rank6)が廃棄され1枚だけ残る
    expect(result.wave.tableau[1]).toEqual([]) // 空列はそのまま
    expect(result.wave.tableau[2]).toEqual([]) // ワイルドも廃棄される
    expect(result.deckComposition.find(c => c.deckId === 2)?.removed).toBe(true)
    expect(result.deckComposition.find(c => c.deckId === 3)?.removed).toBe(true)
    expect(result.deckComposition.find(c => c.deckId === 1)?.removed).toBe(false)
    expect(result.deckComposition).toHaveLength(3) // 削除ではなくフラグなので要素数は変わらない
  })
```

- [ ] **Step 8: テストが失敗することを確認する**

Run: `npm test -- revelationEffects.test.ts -t "婁"`
Expected: FAIL(`'rou'`未対応)

- [ ] **Step 9: `discardColumnTops`関数を実装する**

`revelationEffects.ts`の`stairAlignTopCards`関数の直後に以下を追加する。

```ts
// 場札の全ての列の一番上(末尾)のカード(ワイルド含む)を廃棄する。deckComposition側は削除せず
// removed:trueにする(deckIdの採番が配列長基準のため、削除すると新規カード追加時に衝突しうる)。
function discardColumnTops(wave: WaveState, deckComposition: DeckCard[]): { wave: WaveState; deckComposition: DeckCard[] } {
  const discardedDeckIds = new Set<number>()
  const tableau = wave.tableau.map(col => {
    if (col.length === 0) return col
    discardedDeckIds.add(col[col.length - 1].deckId)
    return col.slice(0, -1)
  })
  const newComposition = deckComposition.map(entry => (discardedDeckIds.has(entry.deckId) ? { ...entry, removed: true } : entry))
  return { wave: { ...wave, tableau }, deckComposition: newComposition }
}
```

`applyRevelationEffect`の`switch`内、`case 'kei':`のcaseの直後に以下を追加する。

```ts
    case 'rou':
      return discardColumnTops(wave, deckComposition)
```

- [ ] **Step 10: テストが通ることを確認する**

Run: `npm test -- revelationEffects.test.ts`
Expected: PASS

- [ ] **Step 11: 型チェックを実行する**

Run: `npm run check`
Expected: エラー無し

- [ ] **Step 12: コミット**

```bash
git add src/lib/game/shidasu/types.ts src/lib/game/shidasu/revelations.ts src/lib/game/shidasu/params.ts src/lib/game/shidasu/shidasu.config.json src/lib/game/shidasu/revelationActualEffects.ts src/lib/game/shidasu/revelationEffects.ts src/lib/game/shidasu/revelationEffects.test.ts
git commit -m "feat: 天啓「婁」(全列トップ廃棄)を実装"
```

---

### Task 7: 候補No.9「極値ワイルド化」(胃・i)を実装する

**Files:**
- Modify: `src/lib/game/shidasu/types.ts`(`RevelationId`)
- Modify: `src/lib/game/shidasu/revelations.ts`(`REVELATION_POOL`)
- Modify: `src/lib/game/shidasu/params.ts`(型・`DEFAULT_PARAMS`)
- Modify: `src/lib/game/shidasu/shidasu.config.json`
- Modify: `src/lib/game/shidasu/revelationActualEffects.ts`
- Modify: `src/lib/game/shidasu/revelationEffects.ts`
- Modify: `src/lib/game/shidasu/revelationEffects.test.ts`

- [ ] **Step 1: `RevelationId`に`i`を追加する**

`src/lib/game/shidasu/types.ts`の`RevelationId`の`| 'rou'`の直後に以下を追加する。

```ts
  | 'i'
```

- [ ] **Step 2: `REVELATION_POOL`に`i`を追加する**

`src/lib/game/shidasu/revelations.ts`の`REVELATION_POOL`の`'rou',`の直後に以下を追加する。

```ts
  'i',
```

- [ ] **Step 3: `ShidasuParams['revelations']`の型に`i`を追加する**

`src/lib/game/shidasu/params.ts`の`revelations`型ブロック、`rou: { name: string; desc: string }`の直後に以下を追加する。

```ts
    i: { name: string; desc: string }
```

- [ ] **Step 4: `DEFAULT_PARAMS.revelations`に`i`を追加する**

`src/lib/game/shidasu/params.ts`の`DEFAULT_PARAMS`内、`rou: { name: '婁', desc: '...' },`の直後に以下を追加する。

```ts
    i: { name: '胃', desc: '場札の中からランクが最大のカードと最小のカードをそれぞれ1枚(該当が複数あればランダムに1枚)選んでワイルド化する' },
```

- [ ] **Step 5: `shidasu.config.json`の`revelations`に`i`を追加する**

`src/lib/game/shidasu/shidasu.config.json`の`"rou": { ... }`の直後に以下を追加する(`rou`エントリの末尾に`,`を追加するのを忘れないこと)。

```json
    "i": {
      "name": "胃",
      "desc": "場札の中からランクが最大のカードと最小のカードをそれぞれ1枚(該当が複数あればランダムに1枚)選んでワイルド化する"
    }
```

- [ ] **Step 6: `REVELATION_ACTUAL_EFFECTS`に`i`を追加する**

`src/lib/game/shidasu/revelationActualEffects.ts`の`rou: '...',`の直後に以下を追加する。

```ts
  i: '場札の非ワイルド実カードから最大ランク・最小ランクを求め、それぞれ該当カード(複数あればランダムに1枚)をwild:trueに変換する。wave.tableau・deckComposition双方を更新する',
```

- [ ] **Step 7: 失敗するテストを書く**

```ts
  test('胃: 場札の最大ランクと最小ランクのカードがそれぞれ1枚ずつワイルド化される', () => {
    const wave = baseWave({
      tableau: [[card(1, '♠', 3), card(2, '♥', 13), card(3, '♦', 1)]],
    })
    const deckComposition: DeckCard[] = [deckCard(1, '♠', 3), deckCard(2, '♥', 13), deckCard(3, '♦', 1)]
    const result = applyRevelationEffect(DEFAULT_PARAMS, wave, deckComposition, 'i', null, createRng(1))
    const wildCards = result.wave.tableau[0].filter(c => c.wild)
    expect(wildCards.map(c => c.rank).sort()).toEqual([1, 13])
    expect(result.wave.tableau[0].find(c => c.rank === 3)?.wild).toBe(false) // 中間ランクは対象外
    const wildDeckIds = result.deckComposition.filter(c => c.wild).map(c => c.deckId).sort()
    expect(wildDeckIds).toEqual([2, 3])
  })

  test('胃: 実カードが1枚しかない場合は1枚だけワイルド化される(最大=最小)', () => {
    const wave = baseWave({ tableau: [[card(1, '♠', 7)]] })
    const deckComposition: DeckCard[] = [deckCard(1, '♠', 7)]
    const result = applyRevelationEffect(DEFAULT_PARAMS, wave, deckComposition, 'i', null, createRng(1))
    expect(result.wave.tableau[0].filter(c => c.wild)).toHaveLength(1)
  })

  test('胃: 最大ランクの該当が複数ある場合はランダムに1枚だけ選ばれる', () => {
    const wave = baseWave({ tableau: [[card(1, '♠', 13), card(2, '♥', 13), card(3, '♦', 1)]] })
    const deckComposition: DeckCard[] = [deckCard(1, '♠', 13), deckCard(2, '♥', 13), deckCard(3, '♦', 1)]
    const result = applyRevelationEffect(DEFAULT_PARAMS, wave, deckComposition, 'i', null, createRng(1))
    const wildCards = result.wave.tableau[0].filter(c => c.wild)
    expect(wildCards).toHaveLength(2) // 最大ランク側1枚+最小ランク側1枚
    expect(wildCards.some(c => c.rank === 1)).toBe(true)
  })
```

- [ ] **Step 8: テストが失敗することを確認する**

Run: `npm test -- revelationEffects.test.ts -t "胃"`
Expected: FAIL(`'i'`未対応)

- [ ] **Step 9: `wildifyExtremeRanks`関数を実装する**

`revelationEffects.ts`の`discardColumnTops`関数の直後に以下を追加する。

```ts
// 場札の非ワイルド実カードから最大ランク・最小ランクをそれぞれ1枚(該当が複数あればランダムに1枚)選んでワイルド化する。
function wildifyExtremeRanks(wave: WaveState, deckComposition: DeckCard[], rand: () => number): { wave: WaveState; deckComposition: DeckCard[] } {
  const realCards = wave.tableau.flat().filter(c => !c.wild)
  if (realCards.length === 0) return { wave, deckComposition }
  const maxRank = Math.max(...realCards.map(c => c.rank))
  const minRank = Math.min(...realCards.map(c => c.rank))
  const maxCandidates = realCards.filter(c => c.rank === maxRank)
  const target1 = pickRandom(maxCandidates, rand)
  const minCandidates = realCards.filter(c => c.rank === minRank && c.deckId !== target1.deckId)
  const target2 = minCandidates.length > 0 ? pickRandom(minCandidates, rand) : null
  const targetDeckIds = new Set([target1.deckId, ...(target2 ? [target2.deckId] : [])])
  const tableau = wave.tableau.map(col => col.map(cardEl => (targetDeckIds.has(cardEl.deckId) ? { ...cardEl, wild: true } : cardEl)))
  const newComposition = deckComposition.map(entry => (targetDeckIds.has(entry.deckId) ? { ...entry, wild: true } : entry))
  return { wave: { ...wave, tableau }, deckComposition: newComposition }
}
```

`applyRevelationEffect`の`switch`内、`case 'rou':`のcaseの直後に以下を追加する。

```ts
    case 'i':
      return wildifyExtremeRanks(wave, deckComposition, rand)
```

- [ ] **Step 10: テストが通ることを確認する**

Run: `npm test -- revelationEffects.test.ts`
Expected: PASS

- [ ] **Step 11: 型チェックを実行する**

Run: `npm run check`
Expected: エラー無し

- [ ] **Step 12: コミット**

```bash
git add src/lib/game/shidasu/types.ts src/lib/game/shidasu/revelations.ts src/lib/game/shidasu/params.ts src/lib/game/shidasu/shidasu.config.json src/lib/game/shidasu/revelationActualEffects.ts src/lib/game/shidasu/revelationEffects.ts src/lib/game/shidasu/revelationEffects.test.ts
git commit -m "feat: 天啓「胃」(極値ワイルド化)を実装"
```

---

### Task 8: 候補No.25「雷光」(畢・hitsu)を実装する

**Files:**
- Modify: `src/lib/game/shidasu/types.ts`(`RevelationId`)
- Modify: `src/lib/game/shidasu/revelations.ts`(`REVELATION_POOL`)
- Modify: `src/lib/game/shidasu/params.ts`(型・`DEFAULT_PARAMS`)
- Modify: `src/lib/game/shidasu/shidasu.config.json`
- Modify: `src/lib/game/shidasu/revelationActualEffects.ts`
- Modify: `src/lib/game/shidasu/revelationEffects.ts`
- Modify: `src/lib/game/shidasu/revelationEffects.test.ts`

- [ ] **Step 1: `RevelationId`に`hitsu`を追加する**

`src/lib/game/shidasu/types.ts`の`RevelationId`の`| 'i'`の直後に以下を追加する。

```ts
  | 'hitsu'
```

- [ ] **Step 2: `REVELATION_POOL`に`hitsu`を追加する**

`src/lib/game/shidasu/revelations.ts`の`REVELATION_POOL`の`'i',`の直後に以下を追加する。

```ts
  'hitsu',
```

- [ ] **Step 3: `ShidasuParams['revelations']`の型に`hitsu`を追加する**

`src/lib/game/shidasu/params.ts`の`revelations`型ブロック、`i: { name: string; desc: string }`の直後に以下を追加する。

```ts
    hitsu: { name: string; desc: string }
```

- [ ] **Step 4: `DEFAULT_PARAMS.revelations`に`hitsu`を追加する**

`src/lib/game/shidasu/params.ts`の`DEFAULT_PARAMS`内、`i: { name: '胃', desc: '...' },`の直後に以下を追加する。

```ts
    hitsu: { name: '畢', desc: '場札から選んだ1列を、先頭のカードを起点とした階段状のランクに再配置する(昇順・降順はランダム)' },
```

- [ ] **Step 5: `shidasu.config.json`の`revelations`に`hitsu`を追加する**

`src/lib/game/shidasu/shidasu.config.json`の`"i": { ... }`の直後に以下を追加する(`i`エントリの末尾に`,`を追加するのを忘れないこと)。

```json
    "hitsu": {
      "name": "畢",
      "desc": "場札から選んだ1列を、先頭のカードを起点とした階段状のランクに再配置する(昇順・降順はランダム)"
    }
```

- [ ] **Step 6: `REVELATION_ACTUAL_EFFECTS`に`hitsu`を追加する**

`src/lib/game/shidasu/revelationActualEffects.ts`の`i: '...',`の直後に以下を追加する。

```ts
  hitsu: '選んだ列の先頭カードのランクを起点に、使用ごとにランダムな方向(昇順/降順)で階段状のランク(A⇔Kループ)へ再配置する(秘儀「雷光」と同じアルゴリズム)。deckCompositionの対応する枠も書き換える(秘儀版と異なり永続化される)',
```

- [ ] **Step 7: 失敗するテストを書く**

```ts
  test('畢: 選んだ列が先頭カード起点の階段状ランクに再配置され、deckCompositionにも反映される', () => {
    const wave = baseWave({ tableau: [[card(1, '♠', 5), card(2, '♥', 6), card(3, '♦', 7)]] })
    const deckComposition: DeckCard[] = [deckCard(1, '♠', 5), deckCard(2, '♥', 6), deckCard(3, '♦', 7)]
    const result = applyRevelationEffect(DEFAULT_PARAMS, wave, deckComposition, 'hitsu', 0, createRng(1))
    const ranks = result.wave.tableau[0].map(c => c.rank)
    expect(ranks[0]).toBe(5) // 起点は先頭カードのランク
    const ascending = ranks[1] === 6
    const descending = ranks[1] === 4
    expect(ascending || descending).toBe(true)
    expect(ranks[2]).toBe(ascending ? 7 : 3)
    expect(result.deckComposition.find(c => c.deckId === 1)?.rank).toBe(5)
  })

  test('畢: targetColがnullなら何もしない', () => {
    const wave = baseWave({ tableau: [[card(1, '♠', 5)]] })
    const deckComposition: DeckCard[] = [deckCard(1, '♠', 5)]
    const result = applyRevelationEffect(DEFAULT_PARAMS, wave, deckComposition, 'hitsu', null, createRng(1))
    expect(result.wave).toBe(wave)
    expect(result.deckComposition).toBe(deckComposition)
  })
```

またファイル末尾の`revelationNeedsTarget`テストに以下の行を追加する。

```ts
    expect(revelationNeedsTarget('hitsu')).toBe(true)
```

- [ ] **Step 8: テストが失敗することを確認する**

Run: `npm test -- revelationEffects.test.ts -t "畢"`
Expected: FAIL(`'hitsu'`未対応)

- [ ] **Step 9: `convertColumnToStair`関数を実装する**

`revelationEffects.ts`の`wildifyExtremeRanks`関数の直後に以下を追加する。

```ts
// 選んだ列を、先頭カードのランクを起点に階段状のランク(A⇔Kループ)へ再配置する。方向(昇順/降順)は使用ごとにランダム。
// 秘儀「雷光(raidho)」と同じアルゴリズムだが、deckCompositionにも書き込んで効果を永続化する点が異なる。
function convertColumnToStair(wave: WaveState, deckComposition: DeckCard[], colIndex: number, rand: () => number): { wave: WaveState; deckComposition: DeckCard[] } {
  const col = wave.tableau[colIndex]
  if (!col || col.length === 0) return { wave, deckComposition }
  const baseRank = col[0].rank
  const dir = rand() < 0.5 ? 1 : -1
  const rankByDeckId = new Map<number, Rank>()
  const newCol = col.map((cardEl, i) => {
    const newRank = (((baseRank - 1 + dir * i) % 13 + 13) % 13 + 1) as Rank
    rankByDeckId.set(cardEl.deckId, newRank)
    return { ...cardEl, rank: newRank }
  })
  const tableau = wave.tableau.map((c, i) => (i === colIndex ? newCol : c))
  const newComposition = deckComposition.map(entry => (rankByDeckId.has(entry.deckId) ? { ...entry, rank: rankByDeckId.get(entry.deckId) as Rank } : entry))
  return { wave: { ...wave, tableau }, deckComposition: newComposition }
}
```

`revelationNeedsTarget`関数内、`case 'shitsu':`の直後に以下を追加する。

```ts
    case 'hitsu':
```

`applyRevelationEffect`の`switch`内、`case 'i':`のcaseの直後に以下を追加する。

```ts
    case 'hitsu':
      return targetCol === null ? { wave, deckComposition } : convertColumnToStair(wave, deckComposition, targetCol, rand)
```

- [ ] **Step 10: テストが通ることを確認する**

Run: `npm test -- revelationEffects.test.ts`
Expected: PASS

- [ ] **Step 11: 型チェックを実行する**

Run: `npm run check`
Expected: エラー無し

- [ ] **Step 12: コミット**

```bash
git add src/lib/game/shidasu/types.ts src/lib/game/shidasu/revelations.ts src/lib/game/shidasu/params.ts src/lib/game/shidasu/shidasu.config.json src/lib/game/shidasu/revelationActualEffects.ts src/lib/game/shidasu/revelationEffects.ts src/lib/game/shidasu/revelationEffects.test.ts
git commit -m "feat: 天啓「畢」(雷光)を実装"
```

---

### Task 9: 候補No.28「対話」(觜・shi)を実装する

**Files:**
- Modify: `src/lib/game/shidasu/types.ts`(`RevelationId`)
- Modify: `src/lib/game/shidasu/revelations.ts`(`REVELATION_POOL`)
- Modify: `src/lib/game/shidasu/params.ts`(型・`DEFAULT_PARAMS`)
- Modify: `src/lib/game/shidasu/shidasu.config.json`
- Modify: `src/lib/game/shidasu/revelationActualEffects.ts`
- Modify: `src/lib/game/shidasu/revelationEffects.ts`
- Modify: `src/lib/game/shidasu/revelationEffects.test.ts`

- [ ] **Step 1: `RevelationId`に`shi`を追加する**

`src/lib/game/shidasu/types.ts`の`RevelationId`の`| 'hitsu'`の直後に以下を追加する。

```ts
  | 'shi'
```

- [ ] **Step 2: `REVELATION_POOL`に`shi`を追加する**

`src/lib/game/shidasu/revelations.ts`の`REVELATION_POOL`の`'hitsu',`の直後に以下を追加する。

```ts
  'shi',
```

- [ ] **Step 3: `ShidasuParams['revelations']`の型に`shi`を追加する**

`src/lib/game/shidasu/params.ts`の`revelations`型ブロック、`hitsu: { name: string; desc: string }`の直後に以下を追加する。

```ts
    shi: { name: string; desc: string }
```

- [ ] **Step 4: `DEFAULT_PARAMS.revelations`に`shi`を追加する**

`src/lib/game/shidasu/params.ts`の`DEFAULT_PARAMS`内、`hitsu: { name: '畢', desc: '...' },`の直後に以下を追加する。

```ts
    shi: { name: '觜', desc: '現在のチェーンの一番上のカードをワイルド化する' },
```

- [ ] **Step 5: `shidasu.config.json`の`revelations`に`shi`を追加する**

`src/lib/game/shidasu/shidasu.config.json`の`"hitsu": { ... }`の直後に以下を追加する(`hitsu`エントリの末尾に`,`を追加するのを忘れないこと)。

```json
    "shi": {
      "name": "觜",
      "desc": "現在のチェーンの一番上のカードをワイルド化する"
    }
```

- [ ] **Step 6: `REVELATION_ACTUAL_EFFECTS`に`shi`を追加する**

`src/lib/game/shidasu/revelationActualEffects.ts`の`hitsu: '...',`の直後に以下を追加する。

```ts
  shi: 'wave.chainの末尾1枚をwild:trueに変換し、foundationも更新する(秘儀「対話」と同じ効果)。deckCompositionの対応する枠も書き換える(秘儀版と異なり永続化される)。チェーンが空の場合は何もしない',
```

- [ ] **Step 7: 失敗するテストを書く**

```ts
  test('觜: チェーン末尾1枚がワイルド化され、foundationも更新され、deckCompositionにも反映される', () => {
    const wave = baseWave({ chain: [card(1, '♠', 5), card(2, '♥', 6)], foundation: card(2, '♥', 6) })
    const deckComposition: DeckCard[] = [deckCard(1, '♠', 5), deckCard(2, '♥', 6)]
    const result = applyRevelationEffect(DEFAULT_PARAMS, wave, deckComposition, 'shi', null, createRng(1))
    expect(result.wave.chain[1].wild).toBe(true)
    expect(result.wave.chain[0].wild).toBe(false)
    expect(result.wave.foundation.wild).toBe(true)
    expect(result.deckComposition.find(c => c.deckId === 2)?.wild).toBe(true)
    expect(result.deckComposition.find(c => c.deckId === 1)?.wild).toBe(false)
  })

  test('觜: チェーンが空なら何もしない', () => {
    const wave = baseWave({ chain: [] })
    const deckComposition: DeckCard[] = []
    const result = applyRevelationEffect(DEFAULT_PARAMS, wave, deckComposition, 'shi', null, createRng(1))
    expect(result.wave).toBe(wave)
    expect(result.deckComposition).toBe(deckComposition)
  })
```

- [ ] **Step 8: テストが失敗することを確認する**

Run: `npm test -- revelationEffects.test.ts -t "觜"`
Expected: FAIL(`'shi'`未対応)

- [ ] **Step 9: `wildifyChainTop`関数を実装する**

`revelationEffects.ts`の`convertColumnToStair`関数の直後に以下を追加する。

```ts
// チェーンの末尾1枚をワイルド化する。秘儀「対話(perthro)」と同じ効果だが、deckCompositionにも
// 書き込んで永続化する点が異なる。チェーンが空の場合は何もしない。
function wildifyChainTop(wave: WaveState, deckComposition: DeckCard[]): { wave: WaveState; deckComposition: DeckCard[] } {
  if (wave.chain.length === 0) return { wave, deckComposition }
  const chain = [...wave.chain]
  const target = chain[chain.length - 1]
  chain[chain.length - 1] = { ...target, wild: true }
  const newComposition = deckComposition.map(entry => (entry.deckId === target.deckId && !entry.wild ? { ...entry, wild: true } : entry))
  return { wave: { ...wave, chain, foundation: chain[chain.length - 1] }, deckComposition: newComposition }
}
```

`applyRevelationEffect`の`switch`内、`case 'hitsu':`のcaseの直後に以下を追加する。

```ts
    case 'shi':
      return wildifyChainTop(wave, deckComposition)
```

- [ ] **Step 10: テストが通ることを確認する**

Run: `npm test -- revelationEffects.test.ts`
Expected: PASS

- [ ] **Step 11: 型チェックを実行する**

Run: `npm run check`
Expected: エラー無し

- [ ] **Step 12: コミット**

```bash
git add src/lib/game/shidasu/types.ts src/lib/game/shidasu/revelations.ts src/lib/game/shidasu/params.ts src/lib/game/shidasu/shidasu.config.json src/lib/game/shidasu/revelationActualEffects.ts src/lib/game/shidasu/revelationEffects.ts src/lib/game/shidasu/revelationEffects.test.ts
git commit -m "feat: 天啓「觜」(対話)を実装"
```

---

### Task 10: 候補No.31「賜物」(井・sei)を実装する

**Files:**
- Modify: `src/lib/game/shidasu/types.ts`(`RevelationId`)
- Modify: `src/lib/game/shidasu/revelations.ts`(`REVELATION_POOL`)
- Modify: `src/lib/game/shidasu/params.ts`(型・`DEFAULT_PARAMS`)
- Modify: `src/lib/game/shidasu/shidasu.config.json`
- Modify: `src/lib/game/shidasu/revelationActualEffects.ts`
- Modify: `src/lib/game/shidasu/revelationEffects.ts`
- Modify: `src/lib/game/shidasu/revelationEffects.test.ts`

- [ ] **Step 1: `RevelationId`に`sei`を追加する**

`src/lib/game/shidasu/types.ts`の`RevelationId`の`| 'shi'`の直後に以下を追加する。

```ts
  | 'sei'
```

- [ ] **Step 2: `REVELATION_POOL`に`sei`を追加する**

`src/lib/game/shidasu/revelations.ts`の`REVELATION_POOL`の`'shi',`の直後に以下を追加する。

```ts
  'sei',
```

- [ ] **Step 3: `ShidasuParams['revelations']`の型に`sei`を追加する**

`src/lib/game/shidasu/params.ts`の`revelations`型ブロック、`shi: { name: string; desc: string }`の直後に以下を追加する。

```ts
    sei: { name: string; n: number; desc: string }
```

- [ ] **Step 4: `DEFAULT_PARAMS.revelations`に`sei`を追加する**

`src/lib/game/shidasu/params.ts`の`DEFAULT_PARAMS`内、`shi: { name: '觜', desc: '...' },`の直後に以下を追加する。

```ts
    sei: { name: '井', n: 1, desc: '場札の中からランダムに{n}枚選んでワイルド化する' },
```

- [ ] **Step 5: `shidasu.config.json`の`revelations`に`sei`を追加する**

`src/lib/game/shidasu/shidasu.config.json`の`"shi": { ... }`の直後に以下を追加する(`shi`エントリの末尾に`,`を追加するのを忘れないこと)。

```json
    "sei": {
      "name": "井",
      "n": 1,
      "desc": "場札の中からランダムに{n}枚選んでワイルド化する"
    }
```

- [ ] **Step 6: `REVELATION_ACTUAL_EFFECTS`に`sei`を追加する**

`src/lib/game/shidasu/revelationActualEffects.ts`の`shi: '...',`の直後に以下を追加する。

```ts
  sei: '場札の非ワイルド実カードからランダムにn枚選んでwild:trueに変換する(秘儀「賜物」と同じ方式)。wave.tableau・deckComposition双方を更新する(秘儀版と異なり永続化される)',
```

- [ ] **Step 7: 失敗するテストを書く**

```ts
  test('井: 場札の非ワイルド実カードから1枚(n=1)がランダムでワイルド化され、deckCompositionにも反映される', () => {
    const wave = baseWave({ tableau: [[card(1, '♠', 5), card(2, '♥', 6, true)], [card(3, '♦', 7)]] })
    const deckComposition: DeckCard[] = [deckCard(1, '♠', 5), deckCard(2, '♥', 6, true), deckCard(3, '♦', 7)]
    const result = applyRevelationEffect(DEFAULT_PARAMS, wave, deckComposition, 'sei', null, createRng(1))
    const wildCount = result.wave.tableau.flat().filter(c => c.wild).length
    expect(wildCount).toBe(2) // 元から居た1枚(deckId2) + 新たに変換された1枚
    const newlyWildDeckIds = result.deckComposition.filter(c => c.wild).map(c => c.deckId)
    expect(newlyWildDeckIds).toContain(2)
    expect(newlyWildDeckIds).toHaveLength(2)
  })

  test('井: 非ワイルド実カードが無ければ何も変換されない', () => {
    const wave = baseWave({ tableau: [[card(1, '♠', 5, true)]] })
    const deckComposition: DeckCard[] = [deckCard(1, '♠', 5, true)]
    const result = applyRevelationEffect(DEFAULT_PARAMS, wave, deckComposition, 'sei', null, createRng(1))
    expect(result.wave.tableau[0][0].wild).toBe(true)
    expect(result.deckComposition[0].wild).toBe(true)
  })
```

- [ ] **Step 8: テストが失敗することを確認する**

Run: `npm test -- revelationEffects.test.ts -t "井"`
Expected: FAIL(`'sei'`未対応)

- [ ] **Step 9: `wildifyRandomTableauCards`関数を実装する**

`revelationEffects.ts`冒頭のimport文を以下のように変更する(`shuffleInPlace`を追加する)。

```ts
import type { Card, DeckCard, Rank, Suit, WaveState, RevelationId } from './types'
import type { ShidasuParams } from './params'
import { shuffleInPlace } from './deck'
```

`wildifyChainTop`関数の直後に以下を追加する。

```ts
// 場札の非ワイルド実カードからランダムにn枚選んでワイルド化する。秘儀「賜物(ansuz)」と同じ方式
// (盤面上の位置(列・行)を2次元でランダム抽選する)だが、deckCompositionにも書き込んで永続化する点が異なる。
function wildifyRandomTableauCards(wave: WaveState, deckComposition: DeckCard[], n: number, rand: () => number): { wave: WaveState; deckComposition: DeckCard[] } {
  const positions: { ci: number; ri: number }[] = []
  wave.tableau.forEach((col, ci) => col.forEach((c, ri) => { if (!c.wild) positions.push({ ci, ri }) }))
  shuffleInPlace(positions, rand)
  const picked = positions.slice(0, n)
  const targetKeys = new Set(picked.map(p => `${p.ci}-${p.ri}`))
  const targetDeckIds = new Set(picked.map(p => wave.tableau[p.ci][p.ri].deckId))
  const tableau = wave.tableau.map((col, ci) => col.map((c, ri) => (targetKeys.has(`${ci}-${ri}`) ? { ...c, wild: true } : c)))
  const newComposition = deckComposition.map(entry => (targetDeckIds.has(entry.deckId) ? { ...entry, wild: true } : entry))
  return { wave: { ...wave, tableau }, deckComposition: newComposition }
}
```

`applyRevelationEffect`の`switch`内、`case 'shi':`のcaseの直後に以下を追加する。

```ts
    case 'sei':
      return wildifyRandomTableauCards(wave, deckComposition, params.revelations.sei.n, rand)
```

- [ ] **Step 10: テストが通ることを確認する**

Run: `npm test -- revelationEffects.test.ts`
Expected: PASS(全テストグリーン)

- [ ] **Step 11: 型チェックを実行する**

Run: `npm run check`
Expected: エラー無し

- [ ] **Step 12: コミット**

```bash
git add src/lib/game/shidasu/types.ts src/lib/game/shidasu/revelations.ts src/lib/game/shidasu/params.ts src/lib/game/shidasu/shidasu.config.json src/lib/game/shidasu/revelationActualEffects.ts src/lib/game/shidasu/revelationEffects.ts src/lib/game/shidasu/revelationEffects.test.ts
git commit -m "feat: 天啓「井」(賜物)を実装"
```

---

### Task 11: 最終確認

**Files:** なし(検証のみ)

- [ ] **Step 1: `revelations.test.ts`の古くなったコメントを修正する**

`src/lib/game/shidasu/revelations.test.ts`の以下の行を

```ts
  test('プール(12種)を超えるcountを指定してもプール全件までしか返らない', () => {
```

以下に変更する(プールが12種から20種に増えたため。アサーション自体は`REVELATION_POOL.length`を動的参照しているため変更不要)。

```ts
  test('プール(20種)を超えるcountを指定してもプール全件までしか返らない', () => {
```

- [ ] **Step 2: 全テストスイートを実行する**

Run: `npm test`
Expected: 全テストグリーン(Phase A関連の新規テストに加え、既存の全テストも壊れていないこと)

- [ ] **Step 3: 型チェックを実行する**

Run: `npm run check`
Expected: エラー無し

- [ ] **Step 4: ビルドを実行する**

Run: `npm run build`
Expected: ビルド成功

- [ ] **Step 5: 開発サーバーで動作確認する**

Run: `npm run dev`

以下をブラウザで確認する。

- `http://localhost:5173/admin/shidasu-revelations` を開き、表の最下部に新規8行(室・壁・奎・婁・胃・畢・觜・井)が追加され、名前ドロップダウン・説明文プレビュー・監査用の実際の効果列が正しく表示されること
- `http://localhost:5173/admin/shidasu-debug` などデバッグ画面から新規天啓8個をそれぞれ実際に使用し、場札・チェーンが設計通りに変化すること(特に候補8「婁」使用後、廃棄したカードが次ウェーブ以降二度と出現しないこと)

- [ ] **Step 6: コミット**

```bash
git add src/lib/game/shidasu/revelations.test.ts
git commit -m "test: revelations.test.tsのプール件数コメントを更新"
```
