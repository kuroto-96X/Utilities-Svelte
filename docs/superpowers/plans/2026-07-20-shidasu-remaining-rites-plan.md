# Shidasu 秘儀 残り7ルーン実装 Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** `docs/superpowers/specs/2026-07-20-shidasu-remaining-rites-design.md`に基づき、秘儀(Rite)の残り7ルーン(ハガラズ・ナウジズ・イサ・ソウィロ・ベルカナ・マンナズ・エワズ)に効果を実装し、`RiteId`を24種フルセットにする。

**Architecture:** 既存17種と同じパターン(`RiteId`追加→`params.rites`にエントリ追加→`riteEffects.ts`に`applyXxx`関数追加→`applyRiteEffect`のswitchに追加)を踏襲する。持続効果(ナウジズ・イサ・ソウィロ・マンナズ・エワズ)は`WaveState`にウェーブ限定の永続フラグを追加し、`engine.ts`の該当箇所(`isPlayable`・`resetComboFields`・`playCard`・`drawStock`)がそのフラグを読んで挙動を変える。即時効果(ハガラズ・ベルカナ)は既存の`raidho`/`uruz`と同じく`WaveState`を直接書き換えるだけで完結する。

**Tech Stack:** TypeScript, Vitest

---

### Task 1: ハガラズ(即時・場札山札合流シャッフル)

**Files:**
- Modify: `src/lib/game/shidasu/types.ts`
- Modify: `src/lib/game/shidasu/params.ts`
- Modify: `src/lib/game/shidasu/shidasu.config.json`
- Modify: `src/lib/game/shidasu/rites.ts`
- Modify: `src/lib/game/shidasu/riteActualEffects.ts`
- Modify: `src/lib/game/shidasu/riteEffects.ts`
- Test: `src/lib/game/shidasu/riteEffects.test.ts`

- [ ] **Step 1: `RiteId`に`hagalaz`を追加**

`src/lib/game/shidasu/types.ts`の36-41行目付近、`RiteId`の末尾を変更:

```ts
export type RiteId =
  | 'raidho' | 'jera' | 'wunjo' | 'othala' | 'perthro'
  | 'uruz' | 'ingwaz'
  | 'gebo' | 'fehu' | 'dagaz'
  | 'algiz' | 'tiwaz' | 'laguz'
  | 'eihwaz' | 'ansuz' | 'kenaz' | 'thurisaz'
  | 'hagalaz'
```

- [ ] **Step 2: `params.ts`の型定義とデフォルト値に`hagalaz`を追加**

`src/lib/game/shidasu/params.ts`の`rites: {...}`型定義ブロック(141行目付近、`thurisaz: { name: string; desc: string }`の直後)に追加:

```ts
    thurisaz: { name: string; desc: string }
    hagalaz: { name: string; desc: string }
```

`DEFAULT_PARAMS.rites`(287行目付近、`thurisaz: {...},`の直後)に追加:

```ts
    thurisaz: { name: 'ᚦ', desc: '場札のJ・Q・Kのカードを、ランダムにJ・Q・K以外のランクへ変換する(スートは維持)' },
    hagalaz: { name: 'ᚺ', desc: '場札と山札の残りを全て合流させ、シャッフルして配り直す' },
```

- [ ] **Step 3: `shidasu.config.json`に`hagalaz`エントリを追加**

`src/lib/game/shidasu/shidasu.config.json`の`"rites"`セクション末尾、`"thurisaz": {...}`の直後(648行目付近)にカンマを追加した上で挿入:

```json
    "thurisaz": {
      "name": "ᚦ",
      "desc": "場札のJ・Q・Kのカードを、ランダムにJ・Q・K以外のランクへ変換する(スートは維持)"
    },
    "hagalaz": {
      "name": "ᚺ",
      "desc": "場札と山札の残りを全て合流させ、シャッフルして配り直す"
    }
```

- [ ] **Step 4: `RITE_POOL`に`hagalaz`を追加**

`src/lib/game/shidasu/rites.ts`の`RITE_POOL`配列末尾を変更:

```ts
export const RITE_POOL: RiteId[] = [
  'raidho', 'jera', 'wunjo', 'othala', 'perthro',
  'uruz', 'ingwaz',
  'gebo', 'fehu', 'dagaz',
  'algiz', 'tiwaz', 'laguz',
  'eihwaz', 'ansuz', 'kenaz', 'thurisaz',
  'hagalaz',
]
```

- [ ] **Step 5: `RITE_ACTUAL_EFFECTS`に`hagalaz`を追加**

`src/lib/game/shidasu/riteActualEffects.ts`の`thurisaz`エントリの直後に追加:

```ts
  hagalaz: '場札の全カードと山札の残りを合流させシャッフルし、各列の現在の枚数を維持したまま先頭から配り直す(余りは新しい山札にする。foundation・chain・comboは変更しない)',
```

- [ ] **Step 6: 失敗するテストを書く**

`src/lib/game/shidasu/riteEffects.test.ts`の末尾(`})`の直前、`describe('riteEffects', ...)`ブロック内)に追加:

```ts
  test('ハガラズ: 場札と山札が合流・シャッフルされ、各列の枚数を維持したまま配り直される', () => {
    const wave = baseWave({
      tableau: [[card(1, '♠', 5), card(2, '♦', 9)], [card(3, '♣', 2)]],
      stock: [card(10, '♥', 4), card(11, '♥', 7), card(12, '♠', 1)],
    })
    const next = applyRiteEffect(DEFAULT_PARAMS, wave, 'hagalaz', createRng(1))
    expect(next.tableau[0]).toHaveLength(2)
    expect(next.tableau[1]).toHaveLength(1)
    expect(next.stock).toHaveLength(2)
    const allIds = [...next.tableau.flat(), ...next.stock].map(c => c.id).sort()
    expect(allIds).toEqual([1, 2, 3, 10, 11, 12])
    expect(next.foundation).toEqual(wave.foundation)
    expect(next.combo).toBe(wave.combo)
  })
```

- [ ] **Step 7: テストを実行し失敗を確認する**

Run: `npm run test -- riteEffects`
Expected: FAIL(`hagalaz`が`applyRiteEffect`のswitchに存在しないためコンパイルエラー、または`next`が`undefined`)

- [ ] **Step 8: `applyHagalaz`を実装する**

`src/lib/game/shidasu/riteEffects.ts`の`applyThurisaz`関数の直後に追加:

```ts
function applyHagalaz(wave: WaveState, rand: () => number): WaveState {
  const pool = [...wave.tableau.flat(), ...wave.stock]
  shuffleInPlace(pool, rand)
  let cursor = 0
  const tableau = wave.tableau.map(col => {
    const take = col.length
    const newCol = pool.slice(cursor, cursor + take)
    cursor += take
    return newCol
  })
  const stock = pool.slice(cursor)
  return { ...wave, tableau, stock }
}
```

`applyRiteEffect`のswitch文(`case 'thurisaz': return applyThurisaz(wave, rand)`の直後)に追加:

```ts
    case 'hagalaz':
      return applyHagalaz(wave, rand)
```

- [ ] **Step 9: テストを実行し成功を確認する**

Run: `npm run test -- riteEffects`
Expected: PASS

- [ ] **Step 10: コミット**

```bash
git add src/lib/game/shidasu/types.ts src/lib/game/shidasu/params.ts src/lib/game/shidasu/shidasu.config.json src/lib/game/shidasu/rites.ts src/lib/game/shidasu/riteActualEffects.ts src/lib/game/shidasu/riteEffects.ts src/lib/game/shidasu/riteEffects.test.ts
git commit -m "feat: 秘儀「ハガラズ」を追加(場札と山札を合流・シャッフルして配り直す)"
```

---

### Task 2: ナウジズ・イサ(持続・コンボリセット式の変更/凍結)

両者とも`resetComboFields`の同じ分岐に手を入れるため、1タスクにまとめる。

**Files:**
- Modify: `src/lib/game/shidasu/types.ts`
- Modify: `src/lib/game/shidasu/params.ts`
- Modify: `src/lib/game/shidasu/shidasu.config.json`
- Modify: `src/lib/game/shidasu/rites.ts`
- Modify: `src/lib/game/shidasu/riteActualEffects.ts`
- Modify: `src/lib/game/shidasu/riteEffects.ts`
- Modify: `src/lib/game/shidasu/engine.ts`
- Test: `src/lib/game/shidasu/riteEffects.test.ts`
- Test: `src/lib/game/shidasu/engine.test.ts`

- [ ] **Step 1: `RiteId`と`WaveState`に追加**

`src/lib/game/shidasu/types.ts`の`RiteId`(Task 1で追加した`hagalaz`の直後)を変更:

```ts
  | 'hagalaz'
  | 'nauthiz' | 'isa'
```

`WaveState`の`playFromAnywhereActiveThisWave: boolean`の直後に追加:

```ts
  // ナウジズ用: そのウェーブが終わるまで、コンボリセット時の再開式を変更するか
  nauthizActiveThisWave: boolean
  // イサ用: そのウェーブが終わるまで、コンボ数の変化を凍結するか
  comboFrozenThisWave: boolean
```

- [ ] **Step 2: `params.ts`の型定義とデフォルト値に追加**

型定義ブロック(`hagalaz: { name: string; desc: string }`の直後)に追加:

```ts
    hagalaz: { name: string; desc: string }
    nauthiz: { name: string; desc: string }
    isa: { name: string; desc: string }
```

`DEFAULT_PARAMS.rites`(`hagalaz: {...},`の直後)に追加:

```ts
    hagalaz: { name: 'ᚺ', desc: '場札と山札の残りを全て合流させ、シャッフルして配り直す' },
    nauthiz: { name: 'ᚾ', desc: 'そのウェーブが終わるまで、コンボリセット時の再開値を直前のコンボ数の半分程度(基礎コンボ数を除く)にする' },
    isa: { name: 'ᛁ', desc: 'そのウェーブが終わるまで、コンボ数を今の値のまま増減しなくする' },
```

- [ ] **Step 3: `shidasu.config.json`に追加**

`"hagalaz": {...}`の直後にカンマを追加した上で挿入:

```json
    "hagalaz": {
      "name": "ᚺ",
      "desc": "場札と山札の残りを全て合流させ、シャッフルして配り直す"
    },
    "nauthiz": {
      "name": "ᚾ",
      "desc": "そのウェーブが終わるまで、コンボリセット時の再開値を直前のコンボ数の半分程度(基礎コンボ数を除く)にする"
    },
    "isa": {
      "name": "ᛁ",
      "desc": "そのウェーブが終わるまで、コンボ数を今の値のまま増減しなくする"
    }
```

- [ ] **Step 4: `RITE_POOL`に追加**

```ts
export const RITE_POOL: RiteId[] = [
  'raidho', 'jera', 'wunjo', 'othala', 'perthro',
  'uruz', 'ingwaz',
  'gebo', 'fehu', 'dagaz',
  'algiz', 'tiwaz', 'laguz',
  'eihwaz', 'ansuz', 'kenaz', 'thurisaz',
  'hagalaz', 'nauthiz', 'isa',
]
```

- [ ] **Step 5: `RITE_ACTUAL_EFFECTS`に追加**

`hagalaz`エントリの直後に追加:

```ts
  nauthiz: 'nauthizActiveThisWaveをtrueにする。以後resetComboFieldsの通常リセットで、comboFrozenThisWaveがfalseの場合に限り、combo再開値をfloor((リセット直前のcombo-baseComboCount)/2)+baseComboCountにする',
  isa: 'comboFrozenThisWaveをtrueにする。以後resetComboFieldsの通常リセット・playCardのコンボ加算・drawStockの素朴(naive)分岐のコンボ加算を全て無効化し、wave.comboを変化させない(ナウジズより優先)',
```

- [ ] **Step 6: 失敗するテストを書く(riteEffects.test.ts)**

`describe('riteEffects', ...)`ブロック内の末尾に追加:

```ts
  test('ナウジズ: nauthizActiveThisWaveがtrueになる', () => {
    const wave = baseWave()
    const next = applyRiteEffect(DEFAULT_PARAMS, wave, 'nauthiz', createRng(1))
    expect(next.nauthizActiveThisWave).toBe(true)
  })

  test('イサ: comboFrozenThisWaveがtrueになる', () => {
    const wave = baseWave()
    const next = applyRiteEffect(DEFAULT_PARAMS, wave, 'isa', createRng(1))
    expect(next.comboFrozenThisWave).toBe(true)
  })
```

`src/lib/game/shidasu/riteEffects.test.ts`の`baseWave`関数(`playFromAnywhereActiveThisWave: false,`の直後)にも追加:

```ts
    playFromAnywhereActiveThisWave: false,
    nauthizActiveThisWave: false,
    comboFrozenThisWave: false,
```

- [ ] **Step 7: 失敗するテストを書く(engine.test.ts)**

`src/lib/game/shidasu/engine.test.ts`の`makeWave`関数(53行目付近、`playFromAnywhereActiveThisWave: false,`の直後)に追加:

```ts
    playFromAnywhereActiveThisWave: false,
    nauthizActiveThisWave: false,
    comboFrozenThisWave: false,
```

`describe('drawStock', ...)`ブロック内、`'祝福を持たなければコンボリセット時は通常通り0になる'`テストの直後に追加:

```ts
  test('ナウジズ: コンボリセット時、floor((直前コンボ-基礎コンボ)/2)+基礎コンボから再開する', () => {
    const wave = makeWave({
      stock: [card(1, '♣', 9)],
      tableau: [[card(2, '♣', 8)]],
      chain: [card(3, '♥', 5)],
      linked: true,
      combo: 7,
      baseComboCount: 1,
      nauthizActiveThisWave: true,
    })
    const { wave: next } = drawStock(DEFAULT_PARAMS, wave, [], 1000000, standardDeckComposition())
    expect(next.combo).toBe(4) // floor((7-1)/2)+1
  })

  test('イサ: comboFrozenThisWave中はコンボリセットが起きても値が変わらない', () => {
    const wave = makeWave({
      stock: [card(1, '♣', 9)],
      tableau: [[card(2, '♣', 8)]],
      chain: [card(3, '♥', 5)],
      linked: true,
      combo: 7,
      comboFrozenThisWave: true,
    })
    const { wave: next } = drawStock(DEFAULT_PARAMS, wave, [], 1000000, standardDeckComposition())
    expect(next.combo).toBe(7)
  })

  test('イサはナウジズより優先される(両方有効でも凍結が勝つ)', () => {
    const wave = makeWave({
      stock: [card(1, '♣', 9)],
      tableau: [[card(2, '♣', 8)]],
      chain: [card(3, '♥', 5)],
      linked: true,
      combo: 7,
      baseComboCount: 1,
      comboFrozenThisWave: true,
      nauthizActiveThisWave: true,
    })
    const { wave: next } = drawStock(DEFAULT_PARAMS, wave, [], 1000000, standardDeckComposition())
    expect(next.combo).toBe(7)
  })

  test('イサ: comboFrozenThisWave中は素朴パスでもコンボ数が変わらない', () => {
    const wave = makeWave({
      stock: [card(1, '♠', 9)],
      combo: 5,
      chain: [card(2, '♠', 4), card(3, '♠', 5)],
      linked: true,
      comboFrozenThisWave: true,
    })
    const { wave: next } = drawStock(DEFAULT_PARAMS, wave, ['naive'], 1000000, standardDeckComposition())
    expect(next.combo).toBe(5)
  })
```

`describe('playCard', ...)`ブロック内の末尾に追加:

```ts
  test('イサ: comboFrozenThisWave中はplayCardでもコンボ数が変わらない', () => {
    const wave = baseWave({ combo: 3, comboFrozenThisWave: true })
    const { wave: next } = playCard(DEFAULT_PARAMS, wave, 'none', [], 1000000, 0, standardDeckComposition())
    expect(next.combo).toBe(3)
  })
```

- [ ] **Step 8: テストを実行し失敗を確認する**

Run: `npm run test -- engine`
Run: `npm run test -- riteEffects`
Expected: FAIL(`applyRiteEffect`が`nauthiz`/`isa`を処理できない、`resetComboFields`等が新フィールドを無視して既存挙動のまま)

- [ ] **Step 9: `applyNauthiz`・`applyIsa`を実装する**

`src/lib/game/shidasu/riteEffects.ts`の`applyHagalaz`の直後に追加:

```ts
function applyNauthiz(wave: WaveState): WaveState {
  return { ...wave, nauthizActiveThisWave: true }
}

function applyIsa(wave: WaveState): WaveState {
  return { ...wave, comboFrozenThisWave: true }
}
```

`applyRiteEffect`のswitchに追加:

```ts
    case 'nauthiz':
      return applyNauthiz(wave)
    case 'isa':
      return applyIsa(wave)
```

- [ ] **Step 10: `engine.ts`の`resetComboFields`を変更する**

`src/lib/game/shidasu/engine.ts`の`resetComboFields`関数内、以下の箇所:

```ts
  // 新chainに引き継がれるカード(newFoundation)は捨て札へ重複して送らない。chain内の位置ではなく
  // IDの一致で除外するため、chain末尾が必ずfoundationと一致するという不変条件に依存しない。
  // 通常のdrawStockリセットではnewFoundationが新規に引いたカードでchainに含まれないため何も除去されず、
  // 全消し・手詰まりのリサイクル時のみ該当カードが除外される。
  const chainToDiscard = wave.chain.filter(c => c.id !== newFoundation.id)
  return {
    ...wave,
    foundation: newFoundation,
    combo: items.includes('sanctify') ? wave.baseComboCount : 0,
    chain: [newFoundation],
```

を、以下に置き換える:

```ts
  // 新chainに引き継がれるカード(newFoundation)は捨て札へ重複して送らない。chain内の位置ではなく
  // IDの一致で除外するため、chain末尾が必ずfoundationと一致するという不変条件に依存しない。
  // 通常のdrawStockリセットではnewFoundationが新規に引いたカードでchainに含まれないため何も除去されず、
  // 全消し・手詰まりのリサイクル時のみ該当カードが除外される。
  const chainToDiscard = wave.chain.filter(c => c.id !== newFoundation.id)
  // イサ(凍結)がナウジズより優先。凍結中はcomboを一切変更しない。
  const comboAfterReset = wave.comboFrozenThisWave
    ? wave.combo
    : wave.nauthizActiveThisWave
      ? Math.floor((wave.combo - wave.baseComboCount) / 2) + wave.baseComboCount
      : items.includes('sanctify') ? wave.baseComboCount : 0
  return {
    ...wave,
    foundation: newFoundation,
    combo: comboAfterReset,
    chain: [newFoundation],
```

- [ ] **Step 11: `playCard`のコンボ加算にイサの凍結ガードを追加する**

`playCard`関数内の以下の行:

```ts
  // 黄金: 通常のコンボ加算処理そのものを+1ではなく+2にする(他の護符には無干渉)
  const newCombo = wave.combo + (items.includes('golden') ? 2 : 1)
```

を以下に置き換える:

```ts
  // 黄金: 通常のコンボ加算処理そのものを+1ではなく+2にする(他の護符には無干渉)
  // イサ(凍結)発動中は加算自体を行わない
  const newCombo = wave.comboFrozenThisWave ? wave.combo : wave.combo + (items.includes('golden') ? 2 : 1)
```

- [ ] **Step 12: `drawStock`の素朴(naive)分岐のコンボ加算にもイサの凍結ガードを追加する**

`drawStock`関数内、`if (wouldContinue && items.includes('naive')) {`ブロック先頭の以下の行:

```ts
    if (wouldContinue && items.includes('naive')) {
      const newCombo = wave.combo + (items.includes('golden') ? 2 : 1)
```

を以下に置き換える:

```ts
    if (wouldContinue && items.includes('naive')) {
      const newCombo = wave.comboFrozenThisWave ? wave.combo : wave.combo + (items.includes('golden') ? 2 : 1)
```

- [ ] **Step 13: `startWave`の初期化に新フィールドを追加する**

`startWave`関数内、`playFromAnywhereActiveThisWave: false,`の直後に追加:

```ts
    playFromAnywhereActiveThisWave: false,
    nauthizActiveThisWave: false,
    comboFrozenThisWave: false,
```

- [ ] **Step 14: テストを実行し成功を確認する**

Run: `npm run test -- engine`
Run: `npm run test -- riteEffects`
Expected: PASS

- [ ] **Step 15: コミット**

```bash
git add src/lib/game/shidasu/types.ts src/lib/game/shidasu/params.ts src/lib/game/shidasu/shidasu.config.json src/lib/game/shidasu/rites.ts src/lib/game/shidasu/riteActualEffects.ts src/lib/game/shidasu/riteEffects.ts src/lib/game/shidasu/riteEffects.test.ts src/lib/game/shidasu/engine.ts src/lib/game/shidasu/engine.test.ts
git commit -m "feat: 秘儀「ナウジズ」「イサ」を追加(コンボリセット式の変更・凍結)"
```

---

### Task 3: ソウィロ(持続・次に成立した役をx倍)

**Files:**
- Modify: `src/lib/game/shidasu/types.ts`
- Modify: `src/lib/game/shidasu/params.ts`
- Modify: `src/lib/game/shidasu/shidasu.config.json`
- Modify: `src/lib/game/shidasu/rites.ts`
- Modify: `src/lib/game/shidasu/riteActualEffects.ts`
- Modify: `src/lib/game/shidasu/riteEffects.ts`
- Modify: `src/lib/game/shidasu/engine.ts`
- Test: `src/lib/game/shidasu/riteEffects.test.ts`
- Test: `src/lib/game/shidasu/engine.test.ts`

- [ ] **Step 1: `RiteId`と`WaveState`に追加**

`RiteId`(`| 'nauthiz' | 'isa'`の直後)に追加:

```ts
  | 'nauthiz' | 'isa'
  | 'sowilo'
```

`WaveState`の`comboFrozenThisWave: boolean`の直後に追加:

```ts
  // ソウィロ用: 発動済みか(役未確定の待機状態を含む)
  sowiloActiveThisWave: boolean
  // ソウィロ用: 倍率対象として確定した役(未確定ならnull)
  sowiloBoostedRole: RoleName | null
```

- [ ] **Step 2: `params.ts`の型定義とデフォルト値に追加**

型定義ブロック(`isa: { name: string; desc: string }`の直後)に追加:

```ts
    isa: { name: string; desc: string }
    sowilo: { name: string; x: number; desc: string }
```

`DEFAULT_PARAMS.rites`(`isa: {...},`の直後)に追加:

```ts
    isa: { name: 'ᛁ', desc: 'そのウェーブが終わるまで、コンボ数を今の値のまま増減しなくする' },
    sowilo: { name: 'ᛋ', x: 2, desc: '発動後に初めて成立した役の種類を記憶し、そのウェーブが終わるまでその役のボーナスを{x}倍にする' },
```

- [ ] **Step 3: `shidasu.config.json`に追加**

`"isa": {...}`の直後にカンマを追加した上で挿入:

```json
    "isa": {
      "name": "ᛁ",
      "desc": "そのウェーブが終わるまで、コンボ数を今の値のまま増減しなくする"
    },
    "sowilo": {
      "name": "ᛋ",
      "x": 2,
      "desc": "発動後に初めて成立した役の種類を記憶し、そのウェーブが終わるまでその役のボーナスを{x}倍にする"
    }
```

- [ ] **Step 4: `RITE_POOL`に追加**

`src/lib/game/shidasu/rites.ts`の`RITE_POOL`配列を以下に変更:

```ts
export const RITE_POOL: RiteId[] = [
  'raidho', 'jera', 'wunjo', 'othala', 'perthro',
  'uruz', 'ingwaz',
  'gebo', 'fehu', 'dagaz',
  'algiz', 'tiwaz', 'laguz',
  'eihwaz', 'ansuz', 'kenaz', 'thurisaz',
  'hagalaz', 'nauthiz', 'isa', 'sowilo',
]
```

- [ ] **Step 5: `RITE_ACTUAL_EFFECTS`に追加**

`isa`エントリの直後に追加:

```ts
  sowilo: 'sowiloActiveThisWaveをtrueにする(sowiloBoostedRoleはnullのまま)。以後playCard内のroleBonusMultiplierで、sowiloBoostedRoleが未確定なら最初に成立した役をその場でx倍しつつ記憶し、確定済みならその役が成立するたび常にx倍する(drawStockの素朴(naive)分岐には明星と同様に適用されない)',
```

- [ ] **Step 6: 失敗するテストを書く(riteEffects.test.ts)**

```ts
  test('ソウィロ: sowiloActiveThisWaveがtrueになりsowiloBoostedRoleはまだnull', () => {
    const wave = baseWave()
    const next = applyRiteEffect(DEFAULT_PARAMS, wave, 'sowilo', createRng(1))
    expect(next.sowiloActiveThisWave).toBe(true)
    expect(next.sowiloBoostedRole).toBeNull()
  })
```

`baseWave`関数(`comboFrozenThisWave: false,`の直後)に追加:

```ts
    comboFrozenThisWave: false,
    sowiloActiveThisWave: false,
    sowiloBoostedRole: null,
```

- [ ] **Step 7: 失敗するテストを書く(engine.test.ts)**

`makeWave`関数(`comboFrozenThisWave: false,`の直後)に追加:

```ts
    comboFrozenThisWave: false,
    sowiloActiveThisWave: false,
    sowiloBoostedRole: null,
```

`describe('playCard', ...)`ブロック内、`'roleOccurrenceCountThisWaveは明星を持たなくても役成立のたび更新される'`テストの直後に追加:

```ts
  test('ソウィロ: 発動後に初めて成立した役(このプレイ自体)がx倍になり、役の種類が記憶される', () => {
    const wave = baseWave({
      foundation: card(0, '♠', 5),
      chain: [card(20, '♥', 3), card(21, '♦', 4), card(22, '♠', 5)],
      tableau: [[card(1, '♣', 6)], [card(2, '♦', 2)]],
      sowiloActiveThisWave: true,
    })
    const { wave: withSowilo } = playCard(DEFAULT_PARAMS, wave, 'none', [], 1000000, 0, standardDeckComposition())
    const { wave: without } = playCard(DEFAULT_PARAMS, { ...wave, sowiloActiveThisWave: false }, 'none', [], 1000000, 0, standardDeckComposition())
    expect(withSowilo.score).toBeGreaterThan(without.score)
    expect(withSowilo.sowiloBoostedRole).toBe('flush')
  })

  test('ソウィロ: 一度確定した役は、次のプレイでも同じ役だけがx倍のまま維持される', () => {
    const wave = baseWave({
      foundation: card(0, '♠', 5),
      tableau: [[card(1, '♣', 9)], [card(2, '♦', 2)]],
      sowiloActiveThisWave: true,
      sowiloBoostedRole: 'flush',
    })
    const { wave: next } = playCard(DEFAULT_PARAMS, wave, 'none', [], 1000000, 0, standardDeckComposition())
    expect(next.sowiloBoostedRole).toBe('flush')
  })
```

- [ ] **Step 8: テストを実行し失敗を確認する**

Run: `npm run test -- engine`
Run: `npm run test -- riteEffects`
Expected: FAIL(`sowilo`が未処理、`roleBonusMultiplier`がソウィロを考慮しない)

- [ ] **Step 9: `applySowilo`を実装する**

`src/lib/game/shidasu/riteEffects.ts`の`applyIsa`の直後に追加:

```ts
function applySowilo(wave: WaveState): WaveState {
  return { ...wave, sowiloActiveThisWave: true }
}
```

`applyRiteEffect`のswitchに追加:

```ts
    case 'sowilo':
      return applySowilo(wave)
```

- [ ] **Step 10: `engine.ts`の`playCard`で`roleBonusMultiplier`を拡張する**

`playCard`関数内の以下の箇所:

```ts
  // 明星: 役の種類ごとのウェーブ内累積成立回数(今回成立分は含まない)に応じて役ボーナス額を倍率適用する
  const roleBonusMultiplier = (name: RoleName): number => {
    if (!items.includes('morningStar')) return 1
    const count = wave.roleOccurrenceCountThisWave[name] ?? 0
    return 1 + count * params.talismans.morningStar.x
  }
```

を以下に置き換える:

```ts
  // 明星: 役の種類ごとのウェーブ内累積成立回数(今回成立分は含まない)に応じて役ボーナス額を倍率適用する
  // ソウィロ: 発動後に初めて成立が確定した役をこのプレイ内で記憶し(sowiloCommittedThisPlay)、
  // その役をx倍にする。以後のプレイではsowiloBoostedRoleが確定済みのため同じ役だけがx倍になる。
  let sowiloCommittedThisPlay: RoleName | null = null
  const roleBonusMultiplier = (name: RoleName): number => {
    let factor = 1
    if (items.includes('morningStar')) {
      const count = wave.roleOccurrenceCountThisWave[name] ?? 0
      factor *= 1 + count * params.talismans.morningStar.x
    }
    if (wave.sowiloActiveThisWave) {
      if (wave.sowiloBoostedRole === name) {
        factor *= params.rites.sowilo.x
      } else if (wave.sowiloBoostedRole === null && sowiloCommittedThisPlay === null) {
        sowiloCommittedThisPlay = name
        factor *= params.rites.sowilo.x
      }
    }
    return factor
  }
```

- [ ] **Step 11: `next`(プレイ後の`WaveState`)に`sowiloBoostedRole`の更新を追加する**

`playCard`関数内、プレイ後の`next: WaveState`オブジェクトの`sweptColumnsThisCombo: newSweptColumnsThisCombo,`の直後に追加:

```ts
    sweptColumnsThisCombo: newSweptColumnsThisCombo,
    sowiloBoostedRole: wave.sowiloBoostedRole ?? sowiloCommittedThisPlay,
```

- [ ] **Step 12: `startWave`の初期化に新フィールドを追加する**

`startWave`関数内、Task 2で追加済みの`comboFrozenThisWave: false,`の直後に追加:

```ts
    sowiloActiveThisWave: false,
    sowiloBoostedRole: null,
```

- [ ] **Step 13: テストを実行し成功を確認する**

Run: `npm run test -- engine`
Run: `npm run test -- riteEffects`
Expected: PASS

- [ ] **Step 14: コミット**

```bash
git add src/lib/game/shidasu/types.ts src/lib/game/shidasu/params.ts src/lib/game/shidasu/shidasu.config.json src/lib/game/shidasu/rites.ts src/lib/game/shidasu/riteActualEffects.ts src/lib/game/shidasu/riteEffects.ts src/lib/game/shidasu/riteEffects.test.ts src/lib/game/shidasu/engine.ts src/lib/game/shidasu/engine.test.ts
git commit -m "feat: 秘儀「ソウィロ」を追加(発動後に初めて成立した役をx倍)"
```

---

### Task 4: ベルカナ(即時・コンボ数をx倍)

**Files:**
- Modify: `src/lib/game/shidasu/types.ts`
- Modify: `src/lib/game/shidasu/params.ts`
- Modify: `src/lib/game/shidasu/shidasu.config.json`
- Modify: `src/lib/game/shidasu/rites.ts`
- Modify: `src/lib/game/shidasu/riteActualEffects.ts`
- Modify: `src/lib/game/shidasu/riteEffects.ts`
- Test: `src/lib/game/shidasu/riteEffects.test.ts`

- [ ] **Step 1: `RiteId`に追加**

```ts
  | 'sowilo'
  | 'berkano'
```

- [ ] **Step 2: `params.ts`の型定義とデフォルト値に追加**

型定義ブロック(`sowilo: { name: string; x: number; desc: string }`の直後)に追加:

```ts
    sowilo: { name: string; x: number; desc: string }
    berkano: { name: string; x: number; desc: string }
```

`DEFAULT_PARAMS.rites`(`sowilo: {...},`の直後)に追加:

```ts
    sowilo: { name: 'ᛋ', x: 2, desc: '発動後に初めて成立した役の種類を記憶し、そのウェーブが終わるまでその役のボーナスを{x}倍にする' },
    berkano: { name: 'ᛒ', x: 2, desc: '現在のコンボ数を{x}倍にする(端数切り捨て)' },
```

- [ ] **Step 3: `shidasu.config.json`に追加**

`"sowilo": {...}`の直後にカンマを追加した上で挿入:

```json
    "sowilo": {
      "name": "ᛋ",
      "x": 2,
      "desc": "発動後に初めて成立した役の種類を記憶し、そのウェーブが終わるまでその役のボーナスを{x}倍にする"
    },
    "berkano": {
      "name": "ᛒ",
      "x": 2,
      "desc": "現在のコンボ数を{x}倍にする(端数切り捨て)"
    }
```

- [ ] **Step 4: `RITE_POOL`に追加**

`src/lib/game/shidasu/rites.ts`の`RITE_POOL`配列を以下に変更:

```ts
export const RITE_POOL: RiteId[] = [
  'raidho', 'jera', 'wunjo', 'othala', 'perthro',
  'uruz', 'ingwaz',
  'gebo', 'fehu', 'dagaz',
  'algiz', 'tiwaz', 'laguz',
  'eihwaz', 'ansuz', 'kenaz', 'thurisaz',
  'hagalaz', 'nauthiz', 'isa', 'sowilo', 'berkano',
]
```

- [ ] **Step 5: `RITE_ACTUAL_EFFECTS`に追加**

`sowilo`エントリの直後に追加:

```ts
  berkano: '現在のコンボ数をfloor(combo×x)にする(uruzの乗算版)。maxComboThisWaveも追従更新する',
```

- [ ] **Step 6: 失敗するテストを書く**

```ts
  test('ベルカナ: 現在のコンボ数がx倍になる(切り捨て)', () => {
    const wave = baseWave({ combo: 5, maxComboThisWave: 5 })
    const next = applyRiteEffect(DEFAULT_PARAMS, wave, 'berkano', createRng(1))
    expect(next.combo).toBe(Math.floor(5 * DEFAULT_PARAMS.rites.berkano.x))
    expect(next.maxComboThisWave).toBe(next.combo)
  })
```

- [ ] **Step 7: テストを実行し失敗を確認する**

Run: `npm run test -- riteEffects`
Expected: FAIL(`berkano`が`applyRiteEffect`のswitchに存在しない)

- [ ] **Step 8: `applyBerkano`を実装する**

`src/lib/game/shidasu/riteEffects.ts`の`applySowilo`の直後に追加:

```ts
function applyBerkano(wave: WaveState, x: number): WaveState {
  const combo = Math.floor(wave.combo * x)
  return { ...wave, combo, maxComboThisWave: Math.max(wave.maxComboThisWave, combo) }
}
```

`applyRiteEffect`のswitchに追加:

```ts
    case 'berkano':
      return applyBerkano(wave, params.rites.berkano.x)
```

- [ ] **Step 9: テストを実行し成功を確認する**

Run: `npm run test -- riteEffects`
Expected: PASS

- [ ] **Step 10: コミット**

```bash
git add src/lib/game/shidasu/types.ts src/lib/game/shidasu/params.ts src/lib/game/shidasu/shidasu.config.json src/lib/game/shidasu/rites.ts src/lib/game/shidasu/riteActualEffects.ts src/lib/game/shidasu/riteEffects.ts src/lib/game/shidasu/riteEffects.test.ts
git commit -m "feat: 秘儀「ベルカナ」を追加(現在のコンボ数をx倍)"
```

---

### Task 5: マンナズ(持続・護符レア度重みによる得点倍算)

**Files:**
- Modify: `src/lib/game/shidasu/types.ts`
- Modify: `src/lib/game/shidasu/params.ts`
- Modify: `src/lib/game/shidasu/shidasu.config.json`
- Modify: `src/lib/game/shidasu/rites.ts`
- Modify: `src/lib/game/shidasu/riteActualEffects.ts`
- Modify: `src/lib/game/shidasu/riteEffects.ts`
- Modify: `src/lib/game/shidasu/engine.ts`
- Test: `src/lib/game/shidasu/riteEffects.test.ts`
- Test: `src/lib/game/shidasu/engine.test.ts`

- [ ] **Step 1: `RiteId`と`WaveState`に追加**

```ts
  | 'berkano'
  | 'mannaz'
```

`WaveState`の`sowiloBoostedRole: RoleName | null`の直後に追加:

```ts
  // マンナズ用: そのウェーブが終わるまで、得点計算に護符レア度倍率を掛けるか
  mannazActiveThisWave: boolean
```

- [ ] **Step 2: `params.ts`の型定義とデフォルト値に追加**

型定義ブロック(`berkano: { name: string; x: number; desc: string }`の直後)に追加:

```ts
    berkano: { name: string; x: number; desc: string }
    mannaz: { name: string; x: number; desc: string }
```

`DEFAULT_PARAMS.rites`(`berkano: {...},`の直後)に追加:

```ts
    berkano: { name: 'ᛒ', x: 2, desc: '現在のコンボ数を{x}倍にする(端数切り捨て)' },
    mannaz: { name: 'ᛗ', x: 0.1, desc: 'そのウェーブが終わるまで、得点計算時に所持護符のレア度重み(コモン=1、アンコモン=2、レア=4)の合計×{x}を1に加えた係数を掛ける' },
```

- [ ] **Step 3: `shidasu.config.json`に追加**

`"berkano": {...}`の直後にカンマを追加した上で挿入:

```json
    "berkano": {
      "name": "ᛒ",
      "x": 2,
      "desc": "現在のコンボ数を{x}倍にする(端数切り捨て)"
    },
    "mannaz": {
      "name": "ᛗ",
      "x": 0.1,
      "desc": "そのウェーブが終わるまで、得点計算時に所持護符のレア度重み(コモン=1、アンコモン=2、レア=4)の合計×{x}を1に加えた係数を掛ける"
    }
```

- [ ] **Step 4: `RITE_POOL`に追加**

`src/lib/game/shidasu/rites.ts`の`RITE_POOL`配列を以下に変更:

```ts
export const RITE_POOL: RiteId[] = [
  'raidho', 'jera', 'wunjo', 'othala', 'perthro',
  'uruz', 'ingwaz',
  'gebo', 'fehu', 'dagaz',
  'algiz', 'tiwaz', 'laguz',
  'eihwaz', 'ansuz', 'kenaz', 'thurisaz',
  'hagalaz', 'nauthiz', 'isa', 'sowilo', 'berkano', 'mannaz',
]
```

- [ ] **Step 5: `RITE_ACTUAL_EFFECTS`に追加**

`berkano`エントリの直後に追加:

```ts
  mannaz: 'mannazActiveThisWaveをtrueにする。以後playCard・drawStockの素朴(naive)分岐の得点計算で、コンボ倍率と併せて1+(所持護符のレア度重み合計(C=1/U=2/R=4))×xの係数をgainedに掛ける',
```

- [ ] **Step 6: 失敗するテストを書く(riteEffects.test.ts)**

```ts
  test('マンナズ: mannazActiveThisWaveがtrueになる', () => {
    const wave = baseWave()
    const next = applyRiteEffect(DEFAULT_PARAMS, wave, 'mannaz', createRng(1))
    expect(next.mannazActiveThisWave).toBe(true)
  })
```

`baseWave`関数(`sowiloBoostedRole: null,`の直後)に追加:

```ts
    sowiloBoostedRole: null,
    mannazActiveThisWave: false,
```

- [ ] **Step 7: 失敗するテストを書く(engine.test.ts)**

`makeWave`関数(`sowiloBoostedRole: null,`の直後)に追加:

```ts
    sowiloBoostedRole: null,
    mannazActiveThisWave: false,
```

`describe('playCard', ...)`ブロック内の末尾に追加:

```ts
  test('マンナズ: 所持護符のレア度重み合計に応じて得点が倍算される', () => {
    const wave = baseWave({
      foundation: card(0, '♠', 5),
      tableau: [[card(9, '♠', 1), card(1, '♣', 6)], [card(2, '♦', 2)]],
      mannazActiveThisWave: true,
    })
    const items: ItemId[] = ['bridge']
    const { wave: next } = playCard(DEFAULT_PARAMS, wave, 'none', items, 1000000, 0, standardDeckComposition())
    const weight: Record<'C' | 'U' | 'R', number> = { C: 1, U: 2, R: 4 }
    const weightSum = items.reduce((sum, id) => sum + weight[DEFAULT_PARAMS.talismans[id].rarity], 0)
    const expectedFactor = 1 + weightSum * DEFAULT_PARAMS.rites.mannaz.x
    expect(next.score).toBe(Math.floor(scoring.basePoint * expectedFactor))
  })

  test('マンナズが無効なら得点は通常通り(倍算されない)', () => {
    const wave = baseWave({
      foundation: card(0, '♠', 5),
      tableau: [[card(9, '♠', 1), card(1, '♣', 6)], [card(2, '♦', 2)]],
    })
    const { wave: next } = playCard(DEFAULT_PARAMS, wave, 'none', ['bridge'], 1000000, 0, standardDeckComposition())
    expect(next.score).toBe(scoring.basePoint)
  })
```

- [ ] **Step 8: テストを実行し失敗を確認する**

Run: `npm run test -- engine`
Run: `npm run test -- riteEffects`
Expected: FAIL(`mannaz`が未処理、得点計算にマンナズ係数が反映されない)

- [ ] **Step 9: `applyMannaz`を実装する**

`src/lib/game/shidasu/riteEffects.ts`の`applyBerkano`の直後に追加:

```ts
function applyMannaz(wave: WaveState): WaveState {
  return { ...wave, mannazActiveThisWave: true }
}
```

`applyRiteEffect`のswitchに追加:

```ts
    case 'mannaz':
      return applyMannaz(wave)
```

- [ ] **Step 10: `engine.ts`に`mannazWeightSum`ヘルパーを追加する**

`import type { Card, StageModifier, WaveState, ItemId, WaveEndReason, RunState, Suit, Rank, DeckCard, RoleName, BonusGain, ChainCardOrigin, RiteId } from './types'`を以下に変更:

```ts
import type { Card, StageModifier, WaveState, ItemId, WaveEndReason, RunState, Suit, Rank, DeckCard, RoleName, BonusGain, ChainCardOrigin, RiteId, Rarity } from './types'
```

`convertRandomCardToWild`関数の直前に追加:

```ts
const MANNAZ_RARITY_WEIGHT: Record<Rarity, number> = { C: 1, U: 2, R: 4 }

// マンナズ用: 所持護符それぞれのレア度重み(コモン=1、アンコモン=2、レア=4)の合計を求める
function mannazWeightSum(items: ItemId[], params: ShidasuParams): number {
  return items.reduce((sum, id) => sum + MANNAZ_RARITY_WEIGHT[params.talismans[id].rarity], 0)
}
```

- [ ] **Step 11: `playCard`の得点計算にマンナズ係数を追加する**

`playCard`関数内の以下の箇所:

```ts
  const comboMultiplierStep = params.scoring.comboMultiplierStep
  const multiplier = 1 + (effectiveCombo - 1) * comboMultiplierStep
  if (multiplier !== 1) parts.push(`コンボ倍率×${fmtMultiplier(multiplier)}`)
  let gained = Math.floor(itemResult.value * multiplier)
```

を以下に置き換える:

```ts
  const comboMultiplierStep = params.scoring.comboMultiplierStep
  const multiplier = 1 + (effectiveCombo - 1) * comboMultiplierStep
  if (multiplier !== 1) parts.push(`コンボ倍率×${fmtMultiplier(multiplier)}`)
  const mannazFactor = wave.mannazActiveThisWave ? 1 + mannazWeightSum(items, params) * params.rites.mannaz.x : 1
  if (mannazFactor !== 1) parts.push(`マンナズ×${fmtMultiplier(mannazFactor)}`)
  let gained = Math.floor(itemResult.value * multiplier * mannazFactor)
```

- [ ] **Step 12: `drawStock`の素朴(naive)分岐にもマンナズ係数を追加する**

`drawStock`関数内の以下の箇所:

```ts
      const comboMultiplierStep = params.scoring.comboMultiplierStep
      const multiplier = 1 + (effectiveCombo - 1) * comboMultiplierStep
      if (multiplier !== 1) parts.push(`コンボ倍率×${fmtMultiplier(multiplier)}`)
      naiveGained = Math.floor(itemResult.value * multiplier)
```

を以下に置き換える:

```ts
      const comboMultiplierStep = params.scoring.comboMultiplierStep
      const multiplier = 1 + (effectiveCombo - 1) * comboMultiplierStep
      if (multiplier !== 1) parts.push(`コンボ倍率×${fmtMultiplier(multiplier)}`)
      const mannazFactor = wave.mannazActiveThisWave ? 1 + mannazWeightSum(items, params) * params.rites.mannaz.x : 1
      if (mannazFactor !== 1) parts.push(`マンナズ×${fmtMultiplier(mannazFactor)}`)
      naiveGained = Math.floor(itemResult.value * multiplier * mannazFactor)
```

- [ ] **Step 13: `startWave`の初期化に新フィールドを追加する**

`startWave`関数内、Task 3で追加済みの`sowiloBoostedRole: null,`の直後に追加:

```ts
    mannazActiveThisWave: false,
```

- [ ] **Step 14: テストを実行し成功を確認する**

Run: `npm run test -- engine`
Run: `npm run test -- riteEffects`
Expected: PASS

- [ ] **Step 15: コミット**

```bash
git add src/lib/game/shidasu/types.ts src/lib/game/shidasu/params.ts src/lib/game/shidasu/shidasu.config.json src/lib/game/shidasu/rites.ts src/lib/game/shidasu/riteActualEffects.ts src/lib/game/shidasu/riteEffects.ts src/lib/game/shidasu/riteEffects.test.ts src/lib/game/shidasu/engine.ts src/lib/game/shidasu/engine.test.ts
git commit -m "feat: 秘儀「マンナズ」を追加(所持護符のレア度重みによる得点倍算)"
```

---

### Task 6: エワズ(持続・許容ランク差を2まで拡張)

**Files:**
- Modify: `src/lib/game/shidasu/types.ts`
- Modify: `src/lib/game/shidasu/params.ts`
- Modify: `src/lib/game/shidasu/shidasu.config.json`
- Modify: `src/lib/game/shidasu/rites.ts`
- Modify: `src/lib/game/shidasu/riteActualEffects.ts`
- Modify: `src/lib/game/shidasu/riteEffects.ts`
- Modify: `src/lib/game/shidasu/engine.ts`
- Test: `src/lib/game/shidasu/riteEffects.test.ts`
- Test: `src/lib/game/shidasu/engine.test.ts`

- [ ] **Step 1: `RiteId`と`WaveState`に追加**

```ts
  | 'mannaz'
  | 'ehwaz'
```

`WaveState`の`mannazActiveThisWave: boolean`の直後に追加:

```ts
  // エワズ用: そのウェーブが終わるまで、場札の許容ランク差を2まで拡張するか
  ehwazActiveThisWave: boolean
```

- [ ] **Step 2: `params.ts`の型定義とデフォルト値に追加**

型定義ブロック(`mannaz: { name: string; x: number; desc: string }`の直後)に追加:

```ts
    mannaz: { name: string; x: number; desc: string }
    ehwaz: { name: string; desc: string }
```

`DEFAULT_PARAMS.rites`(`mannaz: {...},`の直後)に追加:

```ts
    mannaz: { name: 'ᛗ', x: 0.1, desc: 'そのウェーブが終わるまで、得点計算時に所持護符のレア度重み(コモン=1、アンコモン=2、レア=4)の合計×{x}を1に加えた係数を掛ける' },
    ehwaz: { name: 'ᛖ', desc: 'そのウェーブが終わるまで、場札の許容ランク差を2差まで拡張する(ループを跨ぐK→2、Q→Aなども対象)' },
```

- [ ] **Step 3: `shidasu.config.json`に追加**

`"mannaz": {...}`の直後にカンマを追加した上で挿入:

```json
    "mannaz": {
      "name": "ᛗ",
      "x": 0.1,
      "desc": "そのウェーブが終わるまで、得点計算時に所持護符のレア度重み(コモン=1、アンコモン=2、レア=4)の合計×{x}を1に加えた係数を掛ける"
    },
    "ehwaz": {
      "name": "ᛖ",
      "desc": "そのウェーブが終わるまで、場札の許容ランク差を2差まで拡張する(ループを跨ぐK→2、Q→Aなども対象)"
    }
```

- [ ] **Step 4: `RITE_POOL`に追加(24種フルセットになる)**

```ts
export const RITE_POOL: RiteId[] = [
  'raidho', 'jera', 'wunjo', 'othala', 'perthro',
  'uruz', 'ingwaz',
  'gebo', 'fehu', 'dagaz',
  'algiz', 'tiwaz', 'laguz',
  'eihwaz', 'ansuz', 'kenaz', 'thurisaz',
  'hagalaz', 'nauthiz', 'isa', 'sowilo', 'berkano', 'mannaz', 'ehwaz',
]
```

- [ ] **Step 5: `RITE_ACTUAL_EFFECTS`に追加**

`mannaz`エントリの直後に追加:

```ts
  ehwaz: 'ehwazActiveThisWaveをtrueにする。以後isPlayableで、既存のd===1/d===12(ループ)に加えd===2/d===11(ループ、noLoop時は不可)も許可する。analyzeStair(階段パターン判定)には一切影響しない',
```

- [ ] **Step 6: 失敗するテストを書く(riteEffects.test.ts)**

```ts
  test('エワズ: ehwazActiveThisWaveがtrueになる', () => {
    const wave = baseWave()
    const next = applyRiteEffect(DEFAULT_PARAMS, wave, 'ehwaz', createRng(1))
    expect(next.ehwazActiveThisWave).toBe(true)
  })
```

`baseWave`関数(`mannazActiveThisWave: false,`の直後)に追加:

```ts
    mannazActiveThisWave: false,
    ehwazActiveThisWave: false,
```

- [ ] **Step 7: 失敗するテストを書く(engine.test.ts)**

`makeWave`関数(`mannazActiveThisWave: false,`の直後)に追加:

```ts
    mannazActiveThisWave: false,
    ehwazActiveThisWave: false,
```

`describe('isPlayable', ...)`ブロック内の末尾に追加:

```ts
  test('エワズ有効時はランク差2も取れる(ループ含む)', () => {
    const wave = makeWave({ foundation: card(1, '♠', 5), ehwazActiveThisWave: true })
    expect(isPlayable('none', wave, card(2, '♣', 7))).toBe(true)
    expect(isPlayable('none', wave, card(3, '♣', 3))).toBe(true)
  })

  test('エワズ有効時、ランク差2でのループ越え(K→2、Q→Aなど)はnoLoop中だけ取れない', () => {
    const wave = makeWave({ foundation: card(1, '♠', 13), ehwazActiveThisWave: true })
    expect(isPlayable('none', wave, card(2, '♣', 2))).toBe(true)
    expect(isPlayable('noLoop', wave, card(2, '♣', 2))).toBe(false)
  })

  test('エワズが無効ならランク差2は通常通り取れない', () => {
    const wave = makeWave({ foundation: card(1, '♠', 5) })
    expect(isPlayable('none', wave, card(2, '♣', 7))).toBe(false)
  })

  test('エワズが有効でも、階段パターンの継続判定はランク差1のみを認識する(ランク差2は継続しない)', () => {
    const chain = [card(1, '♠', 1), card(2, '♥', 2), card(3, '♣', 3), card(4, '♦', 4)]
    const result = chainContinuesPattern(DEFAULT_PARAMS.scoring, chain, card(5, '♠', 6))
    expect(result).toBe(false)
  })
```

- [ ] **Step 8: テストを実行し失敗を確認する**

Run: `npm run test -- engine`
Run: `npm run test -- riteEffects`
Expected: FAIL(`ehwaz`が未処理、`isPlayable`がランク差2を許可しない)

- [ ] **Step 9: `applyEhwaz`を実装する**

`src/lib/game/shidasu/riteEffects.ts`の`applyMannaz`の直後に追加:

```ts
function applyEhwaz(wave: WaveState): WaveState {
  return { ...wave, ehwazActiveThisWave: true }
}
```

`applyRiteEffect`のswitchに追加:

```ts
    case 'ehwaz':
      return applyEhwaz(wave)
```

- [ ] **Step 10: `engine.ts`の`isPlayable`を変更する**

```ts
export function isPlayable(modifier: StageModifier, wave: WaveState, card: Card): boolean {
  // アルギズ発動中は、そのウェーブが終わるまであらゆる場札がプレイ可能になる(最優先で判定)
  if (wave.playFromAnywhereActiveThisWave) return true
  // faceLockはワイルド(場札含む)より優先して評価する: ワイルド場札でも絵札はコンボ不足なら拒否する
  if (modifier === 'faceLock' && isFace(card) && wave.combo < 2) return false
  if (card.wild || wave.foundation.wild) return true
  const d = Math.abs(card.rank - wave.foundation.rank)
  if (d === 1) return true
  if (d === 12 && modifier !== 'noLoop') return true
  return false
}
```

を以下に置き換える:

```ts
export function isPlayable(modifier: StageModifier, wave: WaveState, card: Card): boolean {
  // アルギズ発動中は、そのウェーブが終わるまであらゆる場札がプレイ可能になる(最優先で判定)
  if (wave.playFromAnywhereActiveThisWave) return true
  // faceLockはワイルド(場札含む)より優先して評価する: ワイルド場札でも絵札はコンボ不足なら拒否する
  if (modifier === 'faceLock' && isFace(card) && wave.combo < 2) return false
  if (card.wild || wave.foundation.wild) return true
  const d = Math.abs(card.rank - wave.foundation.rank)
  if (d === 1) return true
  if (d === 12 && modifier !== 'noLoop') return true
  // エワズ発動中は、そのウェーブが終わるまでランク差2(ループ越え含む)も許可する。
  // 階段パターン判定(analyzeStair)には一切影響しない。
  if (wave.ehwazActiveThisWave) {
    if (d === 2) return true
    if (d === 11 && modifier !== 'noLoop') return true
  }
  return false
}
```

- [ ] **Step 11: `startWave`の初期化に新フィールドを追加する**

`startWave`関数内、Task 5で追加済みの`mannazActiveThisWave: false,`の直後に追加:

```ts
    ehwazActiveThisWave: false,
```

- [ ] **Step 12: テストを実行し成功を確認する**

Run: `npm run test -- engine`
Run: `npm run test -- riteEffects`
Expected: PASS

- [ ] **Step 13: コミット**

```bash
git add src/lib/game/shidasu/types.ts src/lib/game/shidasu/params.ts src/lib/game/shidasu/shidasu.config.json src/lib/game/shidasu/rites.ts src/lib/game/shidasu/riteActualEffects.ts src/lib/game/shidasu/riteEffects.ts src/lib/game/shidasu/riteEffects.test.ts src/lib/game/shidasu/engine.ts src/lib/game/shidasu/engine.test.ts
git commit -m "feat: 秘儀「エワズ」を追加(許容ランク差を2まで拡張、階段判定には影響しない)"
```

---

### Task 7: 最終確認・候補ドキュメント更新

**Files:**
- Modify: `docs/shidasu/shidasu-higi-candidates.md`
- Modify: `src/lib/game/shidasu/engine.test.ts`(startWave初期化の網羅テスト追加)

- [ ] **Step 1: `startWave`の初期状態テストに新フィールドの検証を追加する**

`describe('startWave', ...)`ブロック内、`'初期状態: チェーンにfoundationが1枚(由来はdraw)、スコア0、コンボ0、列一掃0、演出フラグnull、捨て札は空'`テストの直後に追加:

```ts
  test('秘儀由来の持続フラグは全てウェーブ開始時に初期化される', () => {
    const { wave } = startWave(DEFAULT_PARAMS, 0, 0, [], standardDeckComposition(), 1)
    expect(wave.comboResetShieldRemaining).toBe(0)
    expect(wave.playFromAnywhereActiveThisWave).toBe(false)
    expect(wave.nauthizActiveThisWave).toBe(false)
    expect(wave.comboFrozenThisWave).toBe(false)
    expect(wave.sowiloActiveThisWave).toBe(false)
    expect(wave.sowiloBoostedRole).toBeNull()
    expect(wave.mannazActiveThisWave).toBe(false)
    expect(wave.ehwazActiveThisWave).toBe(false)
  })
```

- [ ] **Step 2: テストを実行し成功を確認する**

Run: `npm run test -- engine`
Expected: PASS

- [ ] **Step 3: `docs/shidasu/shidasu-higi-candidates.md`を実装内容に合わせて更新する**

エワズの行を以下に置き換える(階段判定には影響しないことを明記):

```md
| エワズ(Ehwaz) | そのウェーブが終わるまで、場札の許容ランク差を2差まで拡張する(ループを跨ぐK→2、Q→Aなども対象)。階段パターン判定には影響しない(ランク差2のプレイは階段を継続させない) | ウェーブ中ずっと | 初期案(場札全体の入れ替え・山札との交換系)は「弱い」「もっと強力に」と複数回の却下を経て、最終的にランク差ルール自体の緩和案に変更された。当初は階段判定も緩和する案だったが、実装設計時にワイルド絡みの複雑さを避けるため階段判定には手を入れない方針に変更した |
```

ベルカナの行を以下に置き換える:

```md
| ベルカナ(Berkano) | 現在のコンボ数を`x`倍にする(端数切り捨て) | 即時 | 当初案「発動時点のコンボ数×xを直接点として加算」から、既存のuruz(コンボ+n)と同じ設計に揃えるため「コンボ数自体を×x倍にする」に変更した |
```

マンナズの行を以下に置き換える:

```md
| マンナズ(Mannaz) | 所持している護符それぞれのレア度に応じた重み(コモン=1、アンコモン=2、レア=4)を合計した値 × `x` を1に加えた係数を、得点計算時に倍算する | ウェーブ中ずっと | 初期案「常に最大到達コンボ数(maxComboThisWave)で計算」は、イサのコンボ凍結案の完全な上位互換になってしまうため却下。所持護符のレア度という別軸に変更した。当初案「役成立ごとに加算」から、既存の護符(琥珀・蒼穹)と同じ「1+値×x」の乗算パターンに揃えるため変更した |
```

末尾の「実装時の留意点(参考メモ)」セクションを以下に置き換える:

```md
## 実装内容(2026-07-20実装)

`docs/superpowers/specs/2026-07-20-shidasu-remaining-rites-design.md`の設計に基づき実装済み。詳細は同ドキュメントおよび`src/lib/game/shidasu/riteEffects.ts`を参照。
```

- [ ] **Step 4: 全体の最終確認**

Run: `npm run test`
Expected: 全テストPASS

Run: `npm run check`
Expected: 型エラー0件

Run: `npm run build`
Expected: ビルド成功

- [ ] **Step 5: コミット**

```bash
git add docs/shidasu/shidasu-higi-candidates.md src/lib/game/shidasu/engine.test.ts
git commit -m "docs: 秘儀候補ドキュメントを実装内容に合わせて更新し、初期化の網羅テストを追加"
```

- [ ] **Step 6: `npm run dev`でブラウザ動作確認**

`npm run dev`で開発サーバーを起動し、`/admin/shidasu-rites`を開いて24種(既存17種+今回の7種)が表示されることを確認する。`/admin/shidasu-debug`の秘儀実行パネルから、追加した7種(ハガラズ・ナウジズ・イサ・ソウィロ・ベルカナ・マンナズ・エワズ)を実際に発動し、盤面・コンボ数・得点に想定通りの変化が起きることを目視確認する。
