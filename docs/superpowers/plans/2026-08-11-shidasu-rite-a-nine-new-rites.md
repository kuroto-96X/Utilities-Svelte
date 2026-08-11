# 秘儀A候補9種の新規実装 Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** 削除済みの秘儀9枠(raidho/wunjo/othala/perthro/tiwaz/laguz/ansuz/kenaz/thurisaz)に、`docs/shidasu/shidasu-rite-redesign-candidates.md`セクションAから設計した新しい効果を実装し、秘儀を24種に復帰させる。

**Architecture:** 既存の秘儀システム(`RiteId`型・`RITE_POOL`・`riteEffects.ts`の純粋関数群・`params.ts`/`shidasu.config.json`のパラメータ定義)にそのまま乗せる形で9種を追加する。8種は既存の`WaveState`フィールドのみで実装でき、1種(thurisaz)だけ新規フィールド`nextPlayScoreMultiplier`と`engine.ts`の`playCard`スコア計算チェーンへの統合が必要。

**Tech Stack:** TypeScript、Vitest。既存パターン(純粋関数+スイッチディスパッチ+パラメータ駆動desc)をそのまま踏襲する。

**参照spec:** `docs/superpowers/specs/2026-08-11-shidasu-rite-a-nine-new-rites-design.md`

---

## Task 1: 型・プール・パラメータの復元とスタブ配線

このタスクでは9種の型定義・パラメータ・スイッチ配線をすべて復元し、各効果本体は「何もしないスタブ(`return wave`)」にしておく。これによりビルド・型チェックが常にグリーンな状態を保ちながら、Task2以降で1種ずつスタブを実際の実装に差し替えていける。

**Files:**
- Modify: `src/lib/game/shidasu/types.ts`
- Modify: `src/lib/game/shidasu/rites.ts`
- Modify: `src/lib/game/shidasu/riteEffects.ts`
- Modify: `src/lib/game/shidasu/riteActualEffects.ts`
- Modify: `src/lib/game/shidasu/params.ts`
- Modify: `src/lib/game/shidasu/shidasu.config.json`
- Modify: `src/lib/game/shidasu/riteEffects.test.ts`
- Modify: `src/lib/game/shidasu/engine.test.ts`
- Modify: `src/lib/game/shidasu/rites.test.ts`

- [ ] **Step 1: `RiteId`型に9種を復元し、`WaveState`に新規フィールドを追加する**

`src/lib/game/shidasu/types.ts`で以下を置き換える:

```ts
// 変更前
// 秘儀(Rite): プレイ中に能動的に使用する消費アイテム。エルダー・フサルク(北欧ルーン文字)
// 全24種中、カード変換系9種は天啓側へ転用のうえ削除し、15種に効果を実装済み(2026-08-11)。
export type RiteId =
  | 'jera'
  | 'uruz' | 'ingwaz'
  | 'gebo' | 'fehu' | 'dagaz'
  | 'algiz'
  | 'eihwaz'
  | 'hagalaz'
  | 'nauthiz' | 'isa'
  | 'sowilo'
  | 'berkano'
  | 'mannaz'
  | 'ehwaz'
```

```ts
// 変更後
// 秘儀(Rite): プレイ中に能動的に使用する消費アイテム。エルダー・フサルク(北欧ルーン文字)
// 全24種に効果を実装済み。2026-08-11に一度削除した9種(raidho/wunjo/othala/perthro/tiwaz/laguz/
// ansuz/kenaz/thurisaz)は、docs/shidasu/shidasu-rite-redesign-candidates.mdセクションAの
// 内容で新しい効果を割り当てて復元した(元の効果とは別物)。
export type RiteId =
  | 'raidho' | 'jera' | 'wunjo' | 'othala' | 'perthro'
  | 'uruz' | 'ingwaz'
  | 'gebo' | 'fehu' | 'dagaz'
  | 'algiz' | 'tiwaz' | 'laguz'
  | 'eihwaz' | 'ansuz' | 'kenaz' | 'thurisaz'
  | 'hagalaz'
  | 'nauthiz' | 'isa'
  | 'sowilo'
  | 'berkano'
  | 'mannaz'
  | 'ehwaz'
```

同じファイルの`WaveState`インターフェースで、`ehwazActiveThisWave: boolean`の直後(oracleLevelsコメントの前)に以下を追加する:

```ts
// 変更前
  // エワズ用: そのウェーブが終わるまで、場札の許容ランク差を2まで拡張するか
  ehwazActiveThisWave: boolean
  // 神託用: 各役のレベル(ラン全体で持続)。useOracleでプレイ中いつでも加算されうるため、
```

```ts
// 変更後
  // エワズ用: そのウェーブが終わるまで、場札の許容ランク差を2まで拡張するか
  ehwazActiveThisWave: boolean
  // スリサズ用: 直後の1回のカードプレイ(playCardのみ、drawStockの素朴分岐は対象外)の得点計算に
  // 追加で乗算する倍率。既定1(無効)。そのプレイが完了した時点で無条件に1へリセットされる
  nextPlayScoreMultiplier: number
  // 神託用: 各役のレベル(ラン全体で持続)。useOracleでプレイ中いつでも加算されうるため、
```

- [ ] **Step 2: `RITE_POOL`に9種を復元する**

`src/lib/game/shidasu/rites.ts`で以下を置き換える:

```ts
// 変更前
// rollRiteは重み付けなしの完全均等抽選。エルダー・フサルク24種中15種が対象(カード変換系9種は天啓へ転用のうえ削除済み)。
export const RITE_POOL: RiteId[] = [
  'jera',
  'uruz', 'ingwaz',
  'gebo', 'fehu', 'dagaz',
  'algiz',
  'eihwaz',
  'hagalaz', 'nauthiz', 'isa', 'sowilo', 'berkano', 'mannaz', 'ehwaz',
]
```

```ts
// 変更後
// rollRiteは重み付けなしの完全均等抽選。エルダー・フサルク全24種が対象。
export const RITE_POOL: RiteId[] = [
  'raidho', 'jera', 'wunjo', 'othala', 'perthro',
  'uruz', 'ingwaz',
  'gebo', 'fehu', 'dagaz',
  'algiz', 'tiwaz', 'laguz',
  'eihwaz', 'ansuz', 'kenaz', 'thurisaz',
  'hagalaz', 'nauthiz', 'isa', 'sowilo', 'berkano', 'mannaz', 'ehwaz',
]
```

- [ ] **Step 3: `riteEffects.ts`に9種のスタブ関数と`import`を追加する**

`src/lib/game/shidasu/riteEffects.ts`冒頭のimportを置き換える:

```ts
// 変更前
import type { Card, Rank, WaveState, RiteId } from './types'
import type { ShidasuParams } from './params'
import { shuffleInPlace } from './deck'
```

```ts
// 変更後
import type { Card, Rank, Suit, WaveState, RiteId } from './types'
import type { ShidasuParams } from './params'
import { shuffleInPlace } from './deck'
import { isFace } from './patterns'
```

`function pickRandom`の直後(`function applyJera`の前)に、9種のスタブ関数を追加する:

```ts
function applyRaidho(wave: WaveState, rand: () => number): WaveState {
  return wave
}

function applyWunjo(wave: WaveState, rand: () => number): WaveState {
  return wave
}

function applyOthala(wave: WaveState, rand: () => number): WaveState {
  return wave
}

function applyPerthro(wave: WaveState): WaveState {
  return wave
}

function applyTiwaz(wave: WaveState): WaveState {
  return wave
}

function applyLaguz(wave: WaveState, rand: () => number): WaveState {
  return wave
}

function applyAnsuz(wave: WaveState): WaveState {
  return wave
}

function applyKenaz(wave: WaveState, rand: () => number): WaveState {
  return wave
}

function applyThurisaz(wave: WaveState, x: number): WaveState {
  return wave
}

```

`applyRiteEffect`のswitch文を置き換える(9ケースを追加):

```ts
// 変更前
export function applyRiteEffect(params: ShidasuParams, wave: WaveState, riteId: RiteId, rand: () => number): WaveState {
  switch (riteId) {
    case 'jera':
      return applyJera(wave, rand)
    case 'uruz':
```

```ts
// 変更後
export function applyRiteEffect(params: ShidasuParams, wave: WaveState, riteId: RiteId, rand: () => number): WaveState {
  switch (riteId) {
    case 'raidho':
      return applyRaidho(wave, rand)
    case 'jera':
      return applyJera(wave, rand)
    case 'wunjo':
      return applyWunjo(wave, rand)
    case 'othala':
      return applyOthala(wave, rand)
    case 'perthro':
      return applyPerthro(wave)
    case 'uruz':
```

続けて、`case 'algiz': return applyAlgiz(wave)`の直後(`case 'eihwaz':`の前)に以下を追加する:

```ts
    case 'tiwaz':
      return applyTiwaz(wave)
    case 'laguz':
      return applyLaguz(wave, rand)
```

続けて、`case 'eihwaz': return applyEihwaz(wave, params.rites.eihwaz.n)`の直後(`case 'hagalaz':`の前)に以下を追加する:

```ts
    case 'ansuz':
      return applyAnsuz(wave)
    case 'kenaz':
      return applyKenaz(wave, rand)
    case 'thurisaz':
      return applyThurisaz(wave, params.rites.thurisaz.x)
```

- [ ] **Step 4: ビルドと型チェックが通ることを確認する**

Run: `npm run build && npm run check`
Expected: エラーなし(既存の無関係なエラー(solitaire/kuromoji/THREE)以外は出ない)

- [ ] **Step 5: `riteActualEffects.ts`に9エントリを復元する**

`src/lib/game/shidasu/riteActualEffects.ts`を以下に置き換える:

```ts
export const RITE_ACTUAL_EFFECTS: Record<RiteId, string> = {
  raidho: '場札内の非ワイルド・非絵札(J/Q/K以外)カードの位置一覧を記録し、それらのカードを山札と合流させてシャッフルしたうえで、同じ位置に配り直す(絵札・ワイルドは移動しない。あぶれた分は新しい山札になる)',
  jera: '場札の各列を、列ごとにランダムな方向(昇順/降順)でランク順にソートする(空の列は対象外。ワイルドを含む全カードが対象)',
  wunjo: '場札の全カードを捨て札に合流させてシャッフルし、各列の現在の枚数を維持したまま先頭から配り直す(あぶれた分は新しい捨て札になる。山札は変更しない)',
  othala: '山札内で残り枚数が最も多いランク(同数なら候補からランダム)を選び、そのランクの山札カードをすべて場札に合流させる。場札全体をシャッフルし、列数を変えずに列インデックスのラウンドロビンで配り直す(山札に対象ランクが無ければ何もしない)',
  perthro: '各列について、現在の枚数がdealtRows未満の分だけ山札の上から補充する(山札が不足すれば補充できる分だけ補充する)',
  uruz: '現在のコンボ数に+nし、ウェーブ内最大コンボ数もそれに追従して更新する(イサのcomboFrozenThisWave中は変化しない)',
  ingwaz: '基礎コンボ数に+nする(現在のコンボ数自体は変えない)',
  gebo: '捨て札をシャッフルし、場札の列数ぶんを各列の一番上に1枚ずつ配置する(捨て札が列数未満なら何もしない)',
  fehu: '山札の上から場札の列数ぶんを取り出し、各列の一番上に1枚ずつ配置する(山札の残りが列数以下なら何もしない)',
  dagaz: '山札と捨て札をすべて合わせてシャッフルし、新しい山札にする(捨て札は空になる)',
  algiz: 'そのウェーブが終わるまでplayFromAnywhereActiveThisWaveをtrueにする。各列で一番上のカードだけでなく列内の全カードがプレイ対象になる(isPlayable判定自体は変わらず、個々のカードのランク差等で可否が決まる)',
  tiwaz: '場札の全列について、配列の並び順を反転させる(一番上と一番下が入れ替わる)',
  laguz: '場札の中でcol.length===0の列をランダムに1つ選び、山札の上からdealtRows枚まで補充する(0枚の列が無ければ何もしない)',
  eihwaz: 'コンボリセット防止残り回数(comboResetShieldRemaining)に+nする',
  ansuz: 'チェーンの全カードをdiscardPileへ送り、山札から1枚drawしてchain・foundationを差し替える。combo・maxComboThisWave・baseComboCountは変更しない(山札が空なら何もしない)',
  kenaz: '場札と山札を合流させ、スートごとに枚数を集計してグループ化し、枚数の多いスート順(スート内はシャッフル)に並べた配り札の列を作る。各列の現在の枚数を維持したまま先頭から配り直す(あぶれた分は新しい山札になる)',
  thurisaz: 'nextPlayScoreMultiplierをxにする。直後のplayCard1回のみ、gained計算に追加でx倍する乗算ファクターとして作用し、そのプレイの完了時にnextPlayScoreMultiplierは1にリセットされる',
  hagalaz: '場札の全カードと山札の残りを合流させシャッフルし、各列の現在の枚数を維持したまま先頭から配り直す(余りは新しい山札にする。foundation・chain・comboは変更しない)',
  nauthiz: 'nauthizActiveThisWaveをtrueにする。以後resetComboFieldsの通常リセットで、comboFrozenThisWaveがfalseの場合に限り、combo再開値をfloor(リセット直前のcombo/2)にする(baseComboCountは参照しない)',
  isa: 'comboFrozenThisWaveをtrueにする。以後resetComboFieldsの通常リセット・playCardのコンボ加算・drawStockの素朴(naive)分岐のコンボ加算を全て無効化し、wave.comboを変化させない(ナウジズより優先)',
  sowilo: 'sowiloActiveThisWaveをtrueにする(sowiloBoostedRoleはnullのまま)。以後playCard内のroleBonusMultiplierで、sowiloBoostedRoleが未確定なら最初に成立した役をその場でx倍しつつ記憶し、確定済みならその役が成立するたび常にx倍する(drawStockの素朴(naive)分岐には明星と同様に適用されない)',
  berkano: '現在のコンボ数をfloor(combo×x)にする(uruzの乗算版)。maxComboThisWaveも追従更新する(イサのcomboFrozenThisWave中は変化しない)',
  mannaz: 'mannazActiveThisWaveをtrueにする。以後playCard・drawStockの素朴(naive)分岐の得点計算で、コンボ倍率と併せて1+(所持護符のレア度重み合計(C=1/U=2/R=4))×xの係数をgainedに掛ける',
  ehwaz: 'ehwazActiveThisWaveをtrueにする。以後isPlayableで、既存のd===1/d===12(ループ)に加えd===2/d===11(ループ、noLoop時は不可)も許可する。analyzeStair(階段パターン判定)には一切影響しない',
}
```

- [ ] **Step 6: `params.ts`の型定義とデフォルト値に9種を復元する**

`src/lib/game/shidasu/params.ts`の`rites`型定義を置き換える:

```ts
// 変更前
  rites: {
    jera: { name: string; desc: string }
    uruz: { name: string; n: number; desc: string }
```

```ts
// 変更後
  rites: {
    raidho: { name: string; desc: string }
    jera: { name: string; desc: string }
    wunjo: { name: string; desc: string }
    othala: { name: string; desc: string }
    perthro: { name: string; desc: string }
    uruz: { name: string; n: number; desc: string }
```

続けて`algiz: { name: string; desc: string }`の直後(`eihwaz: { name: string; n: number; desc: string }`の前)に以下を追加する:

```ts
    tiwaz: { name: string; desc: string }
    laguz: { name: string; desc: string }
```

続けて`eihwaz: { name: string; n: number; desc: string }`の直後(`hagalaz: { name: string; desc: string }`の前)に以下を追加する:

```ts
    ansuz: { name: string; desc: string }
    kenaz: { name: string; desc: string }
    thurisaz: { name: string; x: number; desc: string }
```

同じファイルの`DEFAULT_PARAMS.rites`オブジェクトリテラルを置き換える:

```ts
// 変更前
  rites: {
    jera: { name: 'ᛃ', desc: '場札の各列をそれぞれソートする(列ごとに昇順/降順はランダム)' },
    uruz: { name: 'ᚢ', n: 3, desc: '現在のコンボ数に+{n}する' },
```

```ts
// 変更後
  rites: {
    raidho: { name: 'ᚱ', desc: '場札の絵札とワイルドはそのままに、非絵札を山札に戻してシャッフルし、元の位置に配り直す' },
    jera: { name: 'ᛃ', desc: '場札の各列をそれぞれソートする(列ごとに昇順/降順はランダム)' },
    wunjo: { name: 'ᚹ', desc: '場札の全カードを捨て札に合流させてシャッフルし、各列の枚数を維持したまま配り直す(山札は変更しない)' },
    othala: { name: 'ᛟ', desc: '山札で一番多く残っているランクのカードをすべて場札に加え、場札全体をシャッフルして配り直す' },
    perthro: { name: 'ᛈ', desc: '各列を、ウェーブ開始時の枚数になるまで山札から補充する(不足している列が無ければ使用不可)' },
    uruz: { name: 'ᚢ', n: 3, desc: '現在のコンボ数に+{n}する' },
```

続けて`algiz: { name: 'ᛉ', desc: '...' }`の直後(`eihwaz: { name: 'ᛇ', n: 3, ... }`の前)に以下を追加する:

```ts
    tiwaz: { name: 'ᛏ', desc: '場札の全列の並び順を上下逆にする' },
    laguz: { name: 'ᛚ', desc: '0枚になっている列を1つ選び、ウェーブ開始時の枚数になるまで山札から補充する(0枚の列が無ければ使用不可)' },
```

続けて`eihwaz: { name: 'ᛇ', n: 3, desc: 'コンボリセットを{n}回防ぐ' },`の直後(`hagalaz: { name: 'ᚺ', ... }`の前)に以下を追加する:

```ts
    ansuz: { name: 'ᚨ', desc: 'チェーンを捨て札に送り、山札から1枚めくって新しいチェーンにする(コンボ数は変わらない)' },
    kenaz: { name: 'ᚲ', desc: '場札を山札に合流させ、多いスート順にまとめて配り直す(残りは新しい山札になる)' },
    thurisaz: { name: 'ᚦ', x: 1.5, desc: '次に出すカード1枚の獲得点に×{x}する' },
```

- [ ] **Step 7: `shidasu.config.json`に9キーを復元する**

`src/lib/game/shidasu/shidasu.config.json`の`"rites"`オブジェクトを置き換える(`params.ts`のDEFAULT_PARAMS.ritesと同じ内容・同じ並び順、JSON形式):

```json
// 変更前
  "rites": {
    "jera": {
      "name": "ᛃ",
      "desc": "場札の各列をそれぞれソートする(列ごとに昇順/降順はランダム)"
    },
    "uruz": {
```

```json
// 変更後
  "rites": {
    "raidho": {
      "name": "ᚱ",
      "desc": "場札の絵札とワイルドはそのままに、非絵札を山札に戻してシャッフルし、元の位置に配り直す"
    },
    "jera": {
      "name": "ᛃ",
      "desc": "場札の各列をそれぞれソートする(列ごとに昇順/降順はランダム)"
    },
    "wunjo": {
      "name": "ᚹ",
      "desc": "場札の全カードを捨て札に合流させてシャッフルし、各列の枚数を維持したまま配り直す(山札は変更しない)"
    },
    "othala": {
      "name": "ᛟ",
      "desc": "山札で一番多く残っているランクのカードをすべて場札に加え、場札全体をシャッフルして配り直す"
    },
    "perthro": {
      "name": "ᛈ",
      "desc": "各列を、ウェーブ開始時の枚数になるまで山札から補充する(不足している列が無ければ使用不可)"
    },
    "uruz": {
```

続けて、`"algiz": { ... }`の直後(`"eihwaz": { ... }`の前)に以下を追加する:

```json
    "tiwaz": {
      "name": "ᛏ",
      "desc": "場札の全列の並び順を上下逆にする"
    },
    "laguz": {
      "name": "ᛚ",
      "desc": "0枚になっている列を1つ選び、ウェーブ開始時の枚数になるまで山札から補充する(0枚の列が無ければ使用不可)"
    },
```

続けて、`"eihwaz": { "name": "ᛇ", "n": 3, "desc": "コンボリセットを{n}回防ぐ" },`の直後(`"hagalaz": { ... }`の前)に以下を追加する:

```json
    "ansuz": {
      "name": "ᚨ",
      "desc": "チェーンを捨て札に送り、山札から1枚めくって新しいチェーンにする(コンボ数は変わらない)"
    },
    "kenaz": {
      "name": "ᚲ",
      "desc": "場札を山札に合流させ、多いスート順にまとめて配り直す(残りは新しい山札になる)"
    },
    "thurisaz": {
      "name": "ᚦ",
      "x": 1.5,
      "desc": "次に出すカード1枚の獲得点に×{x}する"
    },
```

- [ ] **Step 8: テストヘルパーに新規フィールドを追加する**

`src/lib/game/shidasu/riteEffects.test.ts`の`baseWave`関数内、`ehwazActiveThisWave: false,`の直後に追加する:

```ts
// 変更前
    ehwazActiveThisWave: false,
    oracleLevels: defaultOracleLevels(),
    ...overrides,
  }
}
```

```ts
// 変更後
    ehwazActiveThisWave: false,
    nextPlayScoreMultiplier: 1,
    oracleLevels: defaultOracleLevels(),
    ...overrides,
  }
}
```

`src/lib/game/shidasu/engine.test.ts`の`makeWave`関数内、同様に`ehwazActiveThisWave: false,`の直後に追加する:

```ts
// 変更前
    ehwazActiveThisWave: false,
    oracleLevels: defaultOracleLevels(),
    ...overrides,
  }
}
```

```ts
// 変更後
    ehwazActiveThisWave: false,
    nextPlayScoreMultiplier: 1,
    oracleLevels: defaultOracleLevels(),
    ...overrides,
  }
}
```

- [ ] **Step 9: `engine.ts`の`startWave`にも新規フィールドの初期値を追加する**

`src/lib/game/shidasu/engine.ts`の`startWave`関数内、`ehwazActiveThisWave: false,`の直後に追加する:

```ts
// 変更前
    mannazActiveThisWave: false,
    ehwazActiveThisWave: false,
    oracleLevels,
  }
```

```ts
// 変更後
    mannazActiveThisWave: false,
    ehwazActiveThisWave: false,
    nextPlayScoreMultiplier: 1,
    oracleLevels,
  }
```

- [ ] **Step 10: `rites.test.ts`のコメントをプール24種に合わせて更新する**

`src/lib/game/shidasu/rites.test.ts`を置き換える:

```ts
// 変更前
    test('デフォルトで3件返す(プールは15種あるため重複なし)', () => {
```

```ts
// 変更後
    test('デフォルトで3件返す(プールは24種あるため重複なし)', () => {
```

- [ ] **Step 11: 全テスト・ビルド・型チェックを実行して確認する**

Run: `npx vitest run && npm run build && npm run check`
Expected: 全テストパス。ビルド成功。型チェックはshidasu関連のエラー無し(9種はまだスタブなので新規テストは無い)

- [ ] **Step 12: コミットする**

```bash
git add src/lib/game/shidasu/types.ts src/lib/game/shidasu/rites.ts src/lib/game/shidasu/riteEffects.ts src/lib/game/shidasu/riteActualEffects.ts src/lib/game/shidasu/params.ts src/lib/game/shidasu/shidasu.config.json src/lib/game/shidasu/riteEffects.test.ts src/lib/game/shidasu/engine.test.ts src/lib/game/shidasu/rites.test.ts src/lib/game/shidasu/engine.ts
git commit -m "feat: 秘儀9種の型・パラメータ・スタブ配線を復元し秘儀を24種にする"
```

---

## Task 2: raidho(非絵札リシャッフル)を実装する

**Files:**
- Modify: `src/lib/game/shidasu/riteEffects.ts`
- Test: `src/lib/game/shidasu/riteEffects.test.ts`

- [ ] **Step 1: 失敗するテストを書く**

`src/lib/game/shidasu/riteEffects.test.ts`の`describe('riteEffects', () => {`の直後(最初のテストの前)に追加する:

```ts
  test('ライドー: 絵札とワイルドはそのままに、非絵札だけ山札と入れ替えて配り直す', () => {
    const wave = baseWave({
      tableau: [[card(1, '♠', 11), card(2, '♦', 5, true), card(3, '♣', 5)]],
      stock: [card(10, '♥', 7), card(11, '♥', 8)],
    })
    const next = applyRiteEffect(DEFAULT_PARAMS, wave, 'raidho', createRng(1))
    expect(next.tableau[0][0]).toEqual(wave.tableau[0][0])
    expect(next.tableau[0][1]).toEqual(wave.tableau[0][1])
    expect(next.tableau[0]).toHaveLength(3)
    expect(next.stock).toHaveLength(2)
    const allIds = [...next.tableau.flat(), ...next.stock].map(c => c.id).sort((a, b) => a - b)
    expect(allIds).toEqual([1, 2, 3, 10, 11])
  })

  test('ライドー: 非絵札が場に無ければ何もしない', () => {
    const wave = baseWave({
      tableau: [[card(1, '♠', 11), card(2, '♦', 5, true)]],
      stock: [card(10, '♥', 7)],
    })
    const next = applyRiteEffect(DEFAULT_PARAMS, wave, 'raidho', createRng(1))
    expect(next).toEqual(wave)
  })

```

- [ ] **Step 2: テストが失敗することを確認する**

Run: `npx vitest run src/lib/game/shidasu/riteEffects.test.ts -t "ライドー"`
Expected: FAIL(現状のスタブは`return wave`なので、1件目のテストが失敗する)

- [ ] **Step 3: `applyRaidho`を実装する**

`src/lib/game/shidasu/riteEffects.ts`のスタブを置き換える:

```ts
// 変更前
function applyRaidho(wave: WaveState, rand: () => number): WaveState {
  return wave
}
```

```ts
// 変更後
function applyRaidho(wave: WaveState, rand: () => number): WaveState {
  const positions: { ci: number; ri: number }[] = []
  wave.tableau.forEach((col, ci) => col.forEach((c, ri) => {
    if (!c.wild && !isFace(c)) positions.push({ ci, ri })
  }))
  if (positions.length === 0) return wave
  const picked = positions.map(p => wave.tableau[p.ci][p.ri])
  const pool = [...wave.stock, ...picked]
  shuffleInPlace(pool, rand)
  const refill = pool.slice(0, positions.length)
  const stock = pool.slice(positions.length)
  const tableau = wave.tableau.map(col => [...col])
  positions.forEach((p, i) => { tableau[p.ci][p.ri] = refill[i] })
  return { ...wave, tableau, stock }
}
```

- [ ] **Step 4: テストが通ることを確認する**

Run: `npx vitest run src/lib/game/shidasu/riteEffects.test.ts -t "ライドー"`
Expected: PASS(2件とも)

- [ ] **Step 5: コミットする**

```bash
git add src/lib/game/shidasu/riteEffects.ts src/lib/game/shidasu/riteEffects.test.ts
git commit -m "feat: 秘儀raidho(非絵札リシャッフル)を実装"
```

---

## Task 3: wunjo(捨て札リサイクル配り直し)を実装する

**Files:**
- Modify: `src/lib/game/shidasu/riteEffects.ts`
- Test: `src/lib/game/shidasu/riteEffects.test.ts`

- [ ] **Step 1: 失敗するテストを書く**

`src/lib/game/shidasu/riteEffects.test.ts`の「ライドー」の2テストの直後に追加する:

```ts
  test('ウンヨー: 場札を捨て札に合流→シャッフル→各列の元の枚数を維持して配り直す(山札は不変)', () => {
    const wave = baseWave({
      tableau: [[card(1, '♠', 5), card(2, '♦', 9)], [card(3, '♣', 2)]],
      discardPile: [card(10, '♥', 4), card(11, '♥', 7)],
      stock: [card(20, '♠', 3)],
    })
    const next = applyRiteEffect(DEFAULT_PARAMS, wave, 'wunjo', createRng(1))
    expect(next.tableau[0]).toHaveLength(2)
    expect(next.tableau[1]).toHaveLength(1)
    expect(next.stock).toEqual(wave.stock)
    const allIds = [...next.tableau.flat(), ...next.discardPile].map(c => c.id).sort((a, b) => a - b)
    expect(allIds).toEqual([1, 2, 3, 10, 11])
  })

```

- [ ] **Step 2: テストが失敗することを確認する**

Run: `npx vitest run src/lib/game/shidasu/riteEffects.test.ts -t "ウンヨー"`
Expected: FAIL

- [ ] **Step 3: `applyWunjo`を実装する**

`src/lib/game/shidasu/riteEffects.ts`のスタブを置き換える:

```ts
// 変更前
function applyWunjo(wave: WaveState, rand: () => number): WaveState {
  return wave
}
```

```ts
// 変更後
function applyWunjo(wave: WaveState, rand: () => number): WaveState {
  const pool = [...wave.tableau.flat(), ...wave.discardPile]
  shuffleInPlace(pool, rand)
  let cursor = 0
  const tableau = wave.tableau.map(col => {
    const take = col.length
    const newCol = pool.slice(cursor, cursor + take)
    cursor += take
    return newCol
  })
  const discardPile = pool.slice(cursor)
  return { ...wave, tableau, discardPile }
}
```

- [ ] **Step 4: テストが通ることを確認する**

Run: `npx vitest run src/lib/game/shidasu/riteEffects.test.ts -t "ウンヨー"`
Expected: PASS

- [ ] **Step 5: コミットする**

```bash
git add src/lib/game/shidasu/riteEffects.ts src/lib/game/shidasu/riteEffects.test.ts
git commit -m "feat: 秘儀wunjo(捨て札リサイクル配り直し)を実装"
```

---

## Task 4: othala(特定ランク合流シャッフル)を実装する

**Files:**
- Modify: `src/lib/game/shidasu/riteEffects.ts`
- Test: `src/lib/game/shidasu/riteEffects.test.ts`

- [ ] **Step 1: 失敗するテストを書く**

`src/lib/game/shidasu/riteEffects.test.ts`の「ウンヨー」テストの直後に追加する:

```ts
  test('オセラ: 山札で最多のランクを場札に合流し、列数を変えずラウンドロビンで配り直す', () => {
    const wave = baseWave({
      tableau: [[card(1, '♠', 5)], [card(2, '♦', 5)]],
      stock: [card(10, '♥', 7), card(11, '♣', 7), card(12, '♠', 7), card(13, '♦', 3)],
    })
    const next = applyRiteEffect(DEFAULT_PARAMS, wave, 'othala', createRng(1))
    expect(next.stock).toHaveLength(1)
    expect(next.stock[0].id).toBe(13)
    expect(next.tableau).toHaveLength(2)
    const tableauIds = next.tableau.flat().map(c => c.id).sort((a, b) => a - b)
    expect(tableauIds).toEqual([1, 2, 10, 11, 12])
  })

  test('オセラ: 山札が空なら何もしない', () => {
    const wave = baseWave({ tableau: [[card(1, '♠', 5)]], stock: [] })
    const next = applyRiteEffect(DEFAULT_PARAMS, wave, 'othala', createRng(1))
    expect(next).toEqual(wave)
  })

```

- [ ] **Step 2: テストが失敗することを確認する**

Run: `npx vitest run src/lib/game/shidasu/riteEffects.test.ts -t "オセラ"`
Expected: FAIL

- [ ] **Step 3: `applyOthala`を実装する**

`src/lib/game/shidasu/riteEffects.ts`のスタブを置き換える:

```ts
// 変更前
function applyOthala(wave: WaveState, rand: () => number): WaveState {
  return wave
}
```

```ts
// 変更後
function applyOthala(wave: WaveState, rand: () => number): WaveState {
  const rankCounts = new Map<Rank, number>()
  wave.stock.forEach(c => rankCounts.set(c.rank, (rankCounts.get(c.rank) ?? 0) + 1))
  if (rankCounts.size === 0) return wave
  const maxCount = Math.max(...rankCounts.values())
  const candidates = [...rankCounts.entries()].filter(([, count]) => count === maxCount).map(([rank]) => rank)
  const targetRank = pickRandom(candidates, rand)
  const drawn = wave.stock.filter(c => c.rank === targetRank)
  const stock = wave.stock.filter(c => c.rank !== targetRank)
  const cols = wave.tableau.length
  const pool = [...wave.tableau.flat(), ...drawn]
  shuffleInPlace(pool, rand)
  const tableau: Card[][] = Array.from({ length: cols }, () => [])
  pool.forEach((c, i) => { tableau[i % cols].push(c) })
  return { ...wave, tableau, stock }
}
```

- [ ] **Step 4: テストが通ることを確認する**

Run: `npx vitest run src/lib/game/shidasu/riteEffects.test.ts -t "オセラ"`
Expected: PASS

- [ ] **Step 5: コミットする**

```bash
git add src/lib/game/shidasu/riteEffects.ts src/lib/game/shidasu/riteEffects.test.ts
git commit -m "feat: 秘儀othala(特定ランク合流シャッフル)を実装"
```

---

## Task 5: perthro(初期深度まで補充)を実装する

**Files:**
- Modify: `src/lib/game/shidasu/riteEffects.ts`
- Test: `src/lib/game/shidasu/riteEffects.test.ts`

- [ ] **Step 1: 失敗するテストを書く**

`src/lib/game/shidasu/riteEffects.test.ts`の「オセラ」の2テストの直後に追加する:

```ts
  test('ペルスロ: 各列をdealtRowsまで山札から補充する', () => {
    const wave = baseWave({
      dealtRows: 3,
      tableau: [[card(1, '♠', 5)], [card(2, '♦', 5), card(3, '♣', 5)]],
      stock: [card(10, '♥', 1), card(11, '♥', 2), card(12, '♥', 3)],
    })
    expect(canUseRite(DEFAULT_PARAMS, wave, 'perthro')).toBe(true)
    const next = applyRiteEffect(DEFAULT_PARAMS, wave, 'perthro', createRng(1))
    expect(next.tableau[0]).toHaveLength(3)
    expect(next.tableau[1]).toHaveLength(3)
    expect(next.stock).toHaveLength(0)
  })

  test('ペルスロ: 不足している列が無ければ使用不可', () => {
    const wave = baseWave({
      dealtRows: 1,
      tableau: [[card(1, '♠', 5)], [card(2, '♦', 5)]],
    })
    expect(canUseRite(DEFAULT_PARAMS, wave, 'perthro')).toBe(false)
  })

```

- [ ] **Step 2: テストが失敗することを確認する**

Run: `npx vitest run src/lib/game/shidasu/riteEffects.test.ts -t "ペルスロ"`
Expected: FAIL(`canUseRite`が`perthro`ケースを持たないためdefault trueとなり2件目が失敗、1件目も補充されず失敗)

- [ ] **Step 3: `applyPerthro`と`canUseRite`を実装する**

`src/lib/game/shidasu/riteEffects.ts`のスタブを置き換える:

```ts
// 変更前
function applyPerthro(wave: WaveState): WaveState {
  return wave
}
```

```ts
// 変更後
function applyPerthro(wave: WaveState): WaveState {
  const stock = [...wave.stock]
  const tableau = wave.tableau.map(col => {
    const need = Math.max(0, wave.dealtRows - col.length)
    const picked: Card[] = []
    for (let i = 0; i < need && stock.length > 0; i++) picked.push(stock.pop() as Card)
    return [...col, ...picked]
  })
  return { ...wave, tableau, stock }
}
```

`canUseRite`関数を置き換える:

```ts
// 変更前
export function canUseRite(_params: ShidasuParams, wave: WaveState, riteId: RiteId): boolean {
  const cols = wave.tableau.length
  switch (riteId) {
    case 'gebo':
      return wave.discardPile.length >= cols
    case 'fehu':
      return wave.stock.length > cols
    default:
      return true
  }
}
```

```ts
// 変更後
export function canUseRite(_params: ShidasuParams, wave: WaveState, riteId: RiteId): boolean {
  const cols = wave.tableau.length
  switch (riteId) {
    case 'gebo':
      return wave.discardPile.length >= cols
    case 'fehu':
      return wave.stock.length > cols
    case 'perthro':
      return wave.tableau.some(col => col.length < wave.dealtRows)
    default:
      return true
  }
}
```

- [ ] **Step 4: テストが通ることを確認する**

Run: `npx vitest run src/lib/game/shidasu/riteEffects.test.ts -t "ペルスロ"`
Expected: PASS

- [ ] **Step 5: コミットする**

```bash
git add src/lib/game/shidasu/riteEffects.ts src/lib/game/shidasu/riteEffects.test.ts
git commit -m "feat: 秘儀perthro(初期深度まで補充)を実装"
```

---

## Task 6: tiwaz(全列反転)を実装する

**Files:**
- Modify: `src/lib/game/shidasu/riteEffects.ts`
- Test: `src/lib/game/shidasu/riteEffects.test.ts`

- [ ] **Step 1: 失敗するテストを書く**

`src/lib/game/shidasu/riteEffects.test.ts`の「ペルスロ」の2テストの直後に追加する:

```ts
  test('ティワズ: 場札の全列が反転する', () => {
    const wave = baseWave({
      tableau: [[card(1, '♠', 5), card(2, '♦', 9), card(3, '♣', 2)], [card(4, '♥', 1)]],
    })
    const next = applyRiteEffect(DEFAULT_PARAMS, wave, 'tiwaz', createRng(1))
    expect(next.tableau[0].map(c => c.id)).toEqual([3, 2, 1])
    expect(next.tableau[1].map(c => c.id)).toEqual([4])
  })

```

- [ ] **Step 2: テストが失敗することを確認する**

Run: `npx vitest run src/lib/game/shidasu/riteEffects.test.ts -t "ティワズ"`
Expected: FAIL

- [ ] **Step 3: `applyTiwaz`を実装する**

`src/lib/game/shidasu/riteEffects.ts`のスタブを置き換える:

```ts
// 変更前
function applyTiwaz(wave: WaveState): WaveState {
  return wave
}
```

```ts
// 変更後
function applyTiwaz(wave: WaveState): WaveState {
  const tableau = wave.tableau.map(col => [...col].reverse())
  return { ...wave, tableau }
}
```

- [ ] **Step 4: テストが通ることを確認する**

Run: `npx vitest run src/lib/game/shidasu/riteEffects.test.ts -t "ティワズ"`
Expected: PASS

- [ ] **Step 5: コミットする**

```bash
git add src/lib/game/shidasu/riteEffects.ts src/lib/game/shidasu/riteEffects.test.ts
git commit -m "feat: 秘儀tiwaz(全列反転)を実装"
```

---

## Task 7: laguz(空列復活)を実装する

**Files:**
- Modify: `src/lib/game/shidasu/riteEffects.ts`
- Test: `src/lib/game/shidasu/riteEffects.test.ts`

- [ ] **Step 1: 失敗するテストを書く**

`src/lib/game/shidasu/riteEffects.test.ts`の「ティワズ」テストの直後に追加する:

```ts
  test('ラグズ: 0枚の列をランダムに1つ選びdealtRowsまで補充する', () => {
    const wave = baseWave({
      dealtRows: 2,
      tableau: [[], [card(1, '♠', 5)]],
      stock: [card(10, '♥', 1), card(11, '♥', 2)],
    })
    expect(canUseRite(DEFAULT_PARAMS, wave, 'laguz')).toBe(true)
    const next = applyRiteEffect(DEFAULT_PARAMS, wave, 'laguz', createRng(1))
    expect(next.tableau[0]).toHaveLength(2)
    expect(next.tableau[1]).toEqual(wave.tableau[1])
    expect(next.stock).toHaveLength(0)
  })

  test('ラグズ: 0枚の列が無ければ使用不可', () => {
    const wave = baseWave({
      tableau: [[card(1, '♠', 5)], [card(2, '♦', 5)]],
    })
    expect(canUseRite(DEFAULT_PARAMS, wave, 'laguz')).toBe(false)
  })

```

- [ ] **Step 2: テストが失敗することを確認する**

Run: `npx vitest run src/lib/game/shidasu/riteEffects.test.ts -t "ラグズ"`
Expected: FAIL

- [ ] **Step 3: `applyLaguz`と`canUseRite`を実装する**

`src/lib/game/shidasu/riteEffects.ts`のスタブを置き換える:

```ts
// 変更前
function applyLaguz(wave: WaveState, rand: () => number): WaveState {
  return wave
}
```

```ts
// 変更後
function applyLaguz(wave: WaveState, rand: () => number): WaveState {
  const emptyCols = wave.tableau.map((_, i) => i).filter(i => wave.tableau[i].length === 0)
  if (emptyCols.length === 0) return wave
  const ci = pickRandom(emptyCols, rand)
  const stock = [...wave.stock]
  const picked: Card[] = []
  for (let i = 0; i < wave.dealtRows && stock.length > 0; i++) picked.push(stock.pop() as Card)
  const tableau = wave.tableau.map((col, i) => (i === ci ? picked : col))
  return { ...wave, tableau, stock }
}
```

`canUseRite`関数の`case 'perthro':`の直後に追加する:

```ts
// 変更前
    case 'perthro':
      return wave.tableau.some(col => col.length < wave.dealtRows)
    default:
```

```ts
// 変更後
    case 'perthro':
      return wave.tableau.some(col => col.length < wave.dealtRows)
    case 'laguz':
      return wave.tableau.some(col => col.length === 0)
    default:
```

- [ ] **Step 4: テストが通ることを確認する**

Run: `npx vitest run src/lib/game/shidasu/riteEffects.test.ts -t "ラグズ"`
Expected: PASS

- [ ] **Step 5: コミットする**

```bash
git add src/lib/game/shidasu/riteEffects.ts src/lib/game/shidasu/riteEffects.test.ts
git commit -m "feat: 秘儀laguz(空列復活)を実装"
```

---

## Task 8: ansuz(チェーンリフレッシュ)を実装する

**Files:**
- Modify: `src/lib/game/shidasu/riteEffects.ts`
- Test: `src/lib/game/shidasu/riteEffects.test.ts`

- [ ] **Step 1: 失敗するテストを書く**

`src/lib/game/shidasu/riteEffects.test.ts`の「ラグズ」の2テストの直後に追加する:

```ts
  test('アンスズ: チェーンを捨て札に送り、山札から1枚引いて新チェーンにする(コンボは不変)', () => {
    const wave = baseWave({
      chain: [card(1, '♠', 5), card(2, '♦', 9)],
      foundation: card(2, '♦', 9),
      stock: [card(10, '♥', 1), card(11, '♥', 2)],
      combo: 5,
      maxComboThisWave: 5,
      baseComboCount: 2,
    })
    const next = applyRiteEffect(DEFAULT_PARAMS, wave, 'ansuz', createRng(1))
    expect(next.chain).toHaveLength(1)
    expect(next.chain[0].id).toBe(11)
    expect(next.foundation.id).toBe(11)
    expect(next.stock).toHaveLength(1)
    expect(next.stock[0].id).toBe(10)
    expect(next.discardPile.map(c => c.id).sort((a, b) => a - b)).toEqual([1, 2])
    expect(next.combo).toBe(5)
    expect(next.maxComboThisWave).toBe(5)
    expect(next.baseComboCount).toBe(2)
  })

  test('アンスズ: 山札が空なら何もしない', () => {
    const wave = baseWave({ chain: [card(1, '♠', 5)], stock: [] })
    const next = applyRiteEffect(DEFAULT_PARAMS, wave, 'ansuz', createRng(1))
    expect(next).toEqual(wave)
  })

```

- [ ] **Step 2: テストが失敗することを確認する**

Run: `npx vitest run src/lib/game/shidasu/riteEffects.test.ts -t "アンスズ"`
Expected: FAIL

- [ ] **Step 3: `applyAnsuz`を実装する**

`src/lib/game/shidasu/riteEffects.ts`のスタブを置き換える:

```ts
// 変更前
function applyAnsuz(wave: WaveState): WaveState {
  return wave
}
```

```ts
// 変更後
function applyAnsuz(wave: WaveState): WaveState {
  if (wave.stock.length === 0) return wave
  const stock = [...wave.stock]
  const drawn = stock.pop() as Card
  return {
    ...wave,
    stock,
    chain: [drawn],
    chainOrigin: ['draw'],
    foundation: drawn,
    linked: false,
    discardPile: [...wave.discardPile, ...wave.chain],
    columnsEmptiedThisCombo: 0,
    comboStreakColumnLengths: wave.tableau.map(col => col.length),
    drawContinueCountThisChain: 0,
    flushActiveThisCombo: false,
    sameColumnStreak: 0,
    lastPlayedColumn: null,
  }
}
```

- [ ] **Step 4: テストが通ることを確認する**

Run: `npx vitest run src/lib/game/shidasu/riteEffects.test.ts -t "アンスズ"`
Expected: PASS

- [ ] **Step 5: コミットする**

```bash
git add src/lib/game/shidasu/riteEffects.ts src/lib/game/shidasu/riteEffects.test.ts
git commit -m "feat: 秘儀ansuz(チェーンリフレッシュ)を実装"
```

---

## Task 9: kenaz(スート頻度配り直し)を実装する

**Files:**
- Modify: `src/lib/game/shidasu/riteEffects.ts`
- Test: `src/lib/game/shidasu/riteEffects.test.ts`

- [ ] **Step 1: 失敗するテストを書く**

`src/lib/game/shidasu/riteEffects.test.ts`の「アンスズ」の2テストの直後に追加する:

```ts
  test('ケナズ: 場札を山札に合流し、多いスート順に並べて元の各列の枚数を維持して配り直す', () => {
    const wave = baseWave({
      tableau: [[card(1, '♠', 5)], [card(2, '♦', 5)]],
      stock: [card(10, '♠', 1), card(11, '♠', 2), card(12, '♦', 3)],
    })
    const next = applyRiteEffect(DEFAULT_PARAMS, wave, 'kenaz', createRng(1))
    expect(next.tableau[0]).toHaveLength(1)
    expect(next.tableau[1]).toHaveLength(1)
    const allIds = [...next.tableau.flat(), ...next.stock].map(c => c.id).sort((a, b) => a - b)
    expect(allIds).toEqual([1, 2, 10, 11, 12])
  })

```

- [ ] **Step 2: テストが失敗することを確認する**

Run: `npx vitest run src/lib/game/shidasu/riteEffects.test.ts -t "ケナズ"`
Expected: FAIL

- [ ] **Step 3: `applyKenaz`を実装する**

`src/lib/game/shidasu/riteEffects.ts`のスタブを置き換える:

```ts
// 変更前
function applyKenaz(wave: WaveState, rand: () => number): WaveState {
  return wave
}
```

```ts
// 変更後
function applyKenaz(wave: WaveState, rand: () => number): WaveState {
  const pool = [...wave.stock, ...wave.tableau.flat()]
  const suits: Suit[] = ['♠', '♥', '♦', '♣', '★']
  const groups = new Map<Suit, Card[]>(suits.map(s => [s, []]))
  pool.forEach(c => groups.get(c.suit)!.push(c))
  const ordered = suits
    .filter(s => groups.get(s)!.length > 0)
    .sort((a, b) => groups.get(b)!.length - groups.get(a)!.length)
  const dealSequence: Card[] = []
  ordered.forEach(s => {
    const group = [...groups.get(s)!]
    shuffleInPlace(group, rand)
    dealSequence.push(...group)
  })
  let cursor = 0
  const tableau = wave.tableau.map(col => {
    const take = col.length
    const newCol = dealSequence.slice(cursor, cursor + take)
    cursor += take
    return newCol
  })
  const stock = dealSequence.slice(cursor)
  return { ...wave, tableau, stock }
}
```

- [ ] **Step 4: テストが通ることを確認する**

Run: `npx vitest run src/lib/game/shidasu/riteEffects.test.ts -t "ケナズ"`
Expected: PASS

- [ ] **Step 5: コミットする**

```bash
git add src/lib/game/shidasu/riteEffects.ts src/lib/game/shidasu/riteEffects.test.ts
git commit -m "feat: 秘儀kenaz(スート頻度配り直し)を実装"
```

---

## Task 10: thurisaz(次回プレイ得点x倍)を実装し`playCard`と統合する

**Files:**
- Modify: `src/lib/game/shidasu/riteEffects.ts`
- Modify: `src/lib/game/shidasu/engine.ts`
- Test: `src/lib/game/shidasu/riteEffects.test.ts`
- Test: `src/lib/game/shidasu/engine.test.ts`

- [ ] **Step 1: 秘儀使用時のフラグセットのテストを書く**

`src/lib/game/shidasu/riteEffects.test.ts`の「ケナズ」テストの直後に追加する:

```ts
  test('スリサズ: nextPlayScoreMultiplierがxになる', () => {
    const wave = baseWave()
    const next = applyRiteEffect(DEFAULT_PARAMS, wave, 'thurisaz', createRng(1))
    expect(next.nextPlayScoreMultiplier).toBe(DEFAULT_PARAMS.rites.thurisaz.x)
  })

```

- [ ] **Step 2: テストが失敗することを確認する**

Run: `npx vitest run src/lib/game/shidasu/riteEffects.test.ts -t "スリサズ"`
Expected: FAIL

- [ ] **Step 3: `applyThurisaz`を実装する**

`src/lib/game/shidasu/riteEffects.ts`のスタブを置き換える:

```ts
// 変更前
function applyThurisaz(wave: WaveState, x: number): WaveState {
  return wave
}
```

```ts
// 変更後
function applyThurisaz(wave: WaveState, x: number): WaveState {
  return { ...wave, nextPlayScoreMultiplier: x }
}
```

- [ ] **Step 4: テストが通ることを確認する**

Run: `npx vitest run src/lib/game/shidasu/riteEffects.test.ts -t "スリサズ"`
Expected: PASS

- [ ] **Step 5: `playCard`統合の失敗するテストを書く**

`src/lib/game/shidasu/engine.test.ts`の`describe('playCard', ...)`ブロック内、「マンナズが無効なら得点は通常通り」テストの近く(同じdescribeブロック内であればどこでも可)に追加する:

```ts
  test('スリサズ: nextPlayScoreMultiplierが1でなければ得点に乗算され、プレイ後は1にリセットされる', () => {
    const wave = baseWave({
      tableau: [[card(9, '♠', 1), card(1, '♣', 6)], [card(2, '♦', 2)]],
      nextPlayScoreMultiplier: 1.5,
    })
    const { wave: next } = playCard(DEFAULT_PARAMS, wave, 'none', [], 1000000, 0, standardDeckComposition())
    const comboMultiplier = 1 + 1 * scoring.comboMultiplierStep
    expect(next.score).toBe(Math.floor(scoring.basePoint * comboMultiplier * 1.5))
    expect(next.nextPlayScoreMultiplier).toBe(1)
  })

  test('スリサズ未発動時(nextPlayScoreMultiplierが既定1)は得点に影響しない', () => {
    const wave = baseWave({ tableau: [[card(9, '♠', 1), card(1, '♣', 6)], [card(2, '♦', 2)]] })
    const { wave: next } = playCard(DEFAULT_PARAMS, wave, 'none', [], 1000000, 0, standardDeckComposition())
    const comboMultiplier = 1 + 1 * scoring.comboMultiplierStep
    expect(next.score).toBe(Math.floor(scoring.basePoint * comboMultiplier))
  })

```

- [ ] **Step 6: テストが失敗することを確認する**

Run: `npx vitest run src/lib/game/shidasu/engine.test.ts -t "スリサズ"`
Expected: FAIL(1件目: 得点に1.5倍が乗算されない。2件目は現状でもPASSする可能性があるが、1件目は必ず失敗する)

- [ ] **Step 7: `playCard`の得点乗算チェーンに`thurisazFactor`を追加する**

`src/lib/game/shidasu/engine.ts`の`playCard`関数内、乗算チェーンを置き換える:

```ts
// 変更前
  const arroganceFactor = items.includes('arrogance') && wave.stock.length === 0 ? params.talismans.arrogance.x : 1
  if (arroganceFactor !== 1) parts.push(multiplyPart('慢心', arroganceFactor))
  let gained = Math.floor((itemResult.value + discretionAdd + shootingStarGainedAdd + clearBonusAdd) * multiplier * mannazFactor * dedicationFactor * diligenceFactor * divineProtectionFactor * frostFactor * echoFactor * arroganceFactor)
```

```ts
// 変更後
  const arroganceFactor = items.includes('arrogance') && wave.stock.length === 0 ? params.talismans.arrogance.x : 1
  if (arroganceFactor !== 1) parts.push(multiplyPart('慢心', arroganceFactor))
  const thurisazFactor = wave.nextPlayScoreMultiplier
  if (thurisazFactor !== 1) parts.push(multiplyPart('スリサズ', thurisazFactor))
  let gained = Math.floor((itemResult.value + discretionAdd + shootingStarGainedAdd + clearBonusAdd) * multiplier * mannazFactor * dedicationFactor * diligenceFactor * divineProtectionFactor * frostFactor * echoFactor * arroganceFactor * thurisazFactor)
```

続けて、同じ`playCard`関数内の戻り値`next: WaveState`オブジェクトリテラル(`...wave`スプレッドで始まり`sowiloBoostedRole`で終わる箇所)の末尾に`nextPlayScoreMultiplier: 1`を追加する(消費型のため、このプレイの結果として無条件にリセットする):

```ts
// 変更前
    sameRankEchoUsedThisCombo: newSameRankEchoUsedThisCombo,
    sweptColumnsThisCombo: newSweptColumnsThisCombo,
    sowiloBoostedRole: wave.sowiloBoostedRole ?? sowiloCommittedThisPlay,
  }
```

```ts
// 変更後
    sameRankEchoUsedThisCombo: newSameRankEchoUsedThisCombo,
    sweptColumnsThisCombo: newSweptColumnsThisCombo,
    sowiloBoostedRole: wave.sowiloBoostedRole ?? sowiloCommittedThisPlay,
    nextPlayScoreMultiplier: 1,
  }
```

- [ ] **Step 8: テストが通ることを確認する**

Run: `npx vitest run src/lib/game/shidasu/engine.test.ts -t "スリサズ"`
Expected: PASS(2件とも)

- [ ] **Step 9: コミットする**

```bash
git add src/lib/game/shidasu/riteEffects.ts src/lib/game/shidasu/engine.ts src/lib/game/shidasu/riteEffects.test.ts src/lib/game/shidasu/engine.test.ts
git commit -m "feat: 秘儀thurisaz(次回プレイ得点x倍)を実装しplayCardと統合"
```

---

## Task 11: ドキュメントを更新する

**Files:**
- Modify: `docs/shidasu/shidasu-rite-redesign-candidates.md`
- Modify: `docs/shidasu/shidasu-current-rules.md`
- Modify: `docs/shidasu/shidasu-roadmap.md`

- [ ] **Step 1: `shidasu-rite-redesign-candidates.md`のセクションAに実装完了の記録を追記する**

`docs/shidasu/shidasu-rite-redesign-candidates.md`の以下の行:

```
(候補24「オファー拡張」は不採用としたが、秘儀候補ではなくロードマップ項目6「レリックの実装」の候補として別途扱う)
```

の直後に、以下を追加する:

```markdown

### 結果(2026-08-11、秘儀として実装完了)

ブレインストーミングを通じて10候補の内容を1つずつ確認・改訂し、候補1「列ランク統一変換」を不採用、残り9個を秘儀として実装した。旧削除枠(raidho/wunjo/othala/perthro/tiwaz/laguz/ansuz/kenaz/thurisaz)のグリフ・RiteIdを再利用し、秘儀は24種に復帰した。効果内容は元の秘儀(削除済み)とは完全な別物。

| 候補 | 割り当て先(RiteId) | 最終的な効果 |
|---|---|---|
| 列ランク統一変換 | (不採用) | - |
| 絵札/数字札交換→非絵札リシャッフル | raidho(ᚱ) | 絵札とワイルドは残し、非絵札のみ山札と合流→シャッフル→元の位置に配り直す |
| 山札積み直し→捨て札リサイクル配り直し | wunjo(ᚹ) | 場札全体を捨て札に合流→シャッフル→各列の元の枚数を維持して配り直す(山札は不変) |
| 同ランク統一→特定ランク合流シャッフル | othala(ᛟ) | 山札で最多のランクを場札に合流→場札全体をシャッフルし列数固定でラウンドロビン配り直し |
| 列入れ替え→初期深度まで補充 | perthro(ᛈ) | 各列の不足分をdealtRowsまで山札から補充(不足列が無ければ使用不可) |
| 列逆順→全列反転 | tiwaz(ᛏ) | 場札の全列を上下反転 |
| 場札列数拡張→空列復活 | laguz(ᛚ) | 0枚の列をランダムに1つ選びdealtRowsまで山札から補充(0枚列が無ければ使用不可) |
| チェーン保持配り直し→チェーンリフレッシュ | ansuz(ᚨ) | チェーン全カードを捨て札送り、山札から1枚引いて新チェーンに(コンボ不変) |
| 犠牲シャッフル増量→スート頻度配り直し | kenaz(ᚲ) | 場札全カードを山札合流、スート別に多い順で配り直す |
| 目標軽減→次回プレイ得点x倍 | thurisaz(ᚦ) | 次の1回のカードプレイの得点にx倍(既定1.5倍)を追加乗算、1回消費 |

詳細設計は`docs/superpowers/specs/2026-08-11-shidasu-rite-a-nine-new-rites-design.md`を参照。
```

- [ ] **Step 2: セクションBの重複記述を「復元済み」に更新する**

`docs/shidasu/shidasu-rite-redesign-candidates.md`のセクションBの以下の行:

```
空いた9つのグリフは、将来秘儀を追加する際にモチーフ拡張なしでそのまま再利用できる。完全削除された6個(天啓側にも存在しないもの)の効果内容は、将来の秘儀追加時の材料として以下に残す。
```

を以下に置き換える:

```
空いた9つのグリフは、2026-08-11にセクションAの内容で全て再利用され、秘儀は24種に復帰した(詳細はA節参照)。完全削除された6個(元wunjo・othala・tiwaz・laguz・kenaz・thurisaz、天啓側にも存在しないもの)の**元の**効果内容は、参考として以下に残す(現在のwunjo/othala/tiwaz/laguz/kenazは全く別の新しい効果に置き換わっている)。
```

- [ ] **Step 3: セクションCのタイトルと本文を24種に更新する**

`docs/shidasu/shidasu-rite-redesign-candidates.md`のセクションC冒頭:

```
## C. 現在実装済みの秘儀15種(全一覧、2026-08-11時点)

`RiteId`型・`RITE_POOL`(`src/lib/game/shidasu/rites.ts`)に定義されている実装済み秘儀15種(エルダー・フサルク24種中、Bのカード変換系9種を削除した残り)の全量一覧。グルーピングは`RITE_POOL`内の並び順(実装上のカテゴリ分け)に準拠。効果列は`riteActualEffects.ts`の技術的な効果記述(開発者向けground truth)に基づく。読みは`src/lib/game/shidasu/runes.ts`のカタカナ表記に統一。
```

を以下に置き換える:

```
## C. 現在実装済みの秘儀24種(全一覧、2026-08-11時点)

`RiteId`型・`RITE_POOL`(`src/lib/game/shidasu/rites.ts`)に定義されている実装済み秘儀24種(エルダー・フサルク全24種)の全量一覧。うち9種(raidho/wunjo/othala/perthro/tiwaz/laguz/ansuz/kenaz/thurisaz)は2026-08-11にA節の内容で新しい効果として復元されたもの。グルーピングは`RITE_POOL`内の並び順(実装上のカテゴリ分け)に準拠。効果列は`riteActualEffects.ts`の技術的な効果記述(開発者向けground truth)に基づく。読みは`src/lib/game/shidasu/runes.ts`のカタカナ表記に統一。
```

`docs/shidasu/shidasu-rite-redesign-candidates.md`のセクションC本体(`### 場札ソート系(1個)`から末尾の「削除された9種...」の行まで)を、以下の「変更前」全体から「変更後」全体へ置き換える。9種を各カテゴリの末尾に統合し、「場札ソート系」は「カード操作・並べ替え系」に改名する:

```markdown
[変更前(セクションC本体、以下の内容と完全に一致する部分)]
### 場札ソート系(1個)

| ルーン(読み) | RiteId | 効果概要 |
|---|---|---|
| イェラ | jera | 場札の各列を、列ごとにランダムな方向でランク順にソートする |

### コンボ操作系(2個)

| ルーン(読み) | RiteId | 効果概要 |
|---|---|---|
| ウルズ | uruz | 現在のコンボ数に+nし、ウェーブ内最大コンボ数も追従更新する |
| イングズ | ingwaz | 基礎コンボ数に+nする(現在のコンボ数自体は変えない) |

### カード供給・山札操作系(3個)

| ルーン(読み) | RiteId | 効果概要 |
|---|---|---|
| ゲボ | gebo | 捨て札をシャッフルし、場札の列数ぶんを各列の一番上に配置する |
| フェフ | fehu | 山札の上から場札の列数ぶんを各列の一番上に配置する |
| ダガズ | dagaz | 山札と捨て札をすべて合わせてシャッフルし、新しい山札にする |

### チェーン操作系(1個)

| ルーン(読み) | RiteId | 効果概要 |
|---|---|---|
| アルギズ | algiz | そのウェーブが終わるまで列内の全カードをプレイ対象にする(playFromAnywhere) |

### コンボリセット防止系(1個)

| ルーン(読み) | RiteId | 効果概要 |
|---|---|---|
| エイワズ | eihwaz | コンボリセット防止残り回数に+nする |

### コンボ・得点フラグ系(7個)

| ルーン(読み) | RiteId | 効果概要 |
|---|---|---|
| ハガラズ | hagalaz | 場札全体と山札の残りを合流・シャッフルし、各列の枚数を維持したまま配り直す |
| ナウジズ | nauthiz | 以後のコンボリセット時、再開値をリセット直前のコンボの半分(floor)にする |
| イサ | isa | 以後そのウェーブ中、コンボ数を一切変化させなくする(ナウジズより優先) |
| ソウィロ | sowilo | 最初に成立した役を記憶し、以後その役が成立するたび得点をx倍にする |
| ベルカナ | berkano | 現在のコンボ数をfloor(コンボ×x)にする(ウルズの乗算版) |
| マンナズ | mannaz | 以後の得点計算に、所持護符のレア度重み合計に応じた加算係数を掛ける |
| エワズ | ehwaz | 以後そのウェーブ中、階段判定の許容差にd=±2(ループ)も追加する |

削除された9種(旧raidho・perthro・ansuz・wunjo・othala・tiwaz・laguz・kenaz・thurisaz)の詳細はBを参照。
```

```markdown
[変更後]
### カード操作・並べ替え系(6個)

| ルーン(読み) | RiteId | 効果概要 |
|---|---|---|
| ライドー | raidho | 場札の絵札とワイルドはそのままに、非絵札を山札に戻してシャッフルし、元の位置に配り直す |
| イェラ | jera | 場札の各列を、列ごとにランダムな方向でランク順にソートする |
| ウンヨー | wunjo | 場札全体を捨て札に合流させてシャッフルし、各列の元の枚数を維持して配り直す(山札は不変) |
| オセラ | othala | 山札で最も多く残っているランクを場札に合流させ、場札全体をシャッフルして配り直す |
| ティワズ | tiwaz | 場札の全列の並び順を上下逆にする |
| ケナズ | kenaz | 場札を山札に合流させ、多いスート順にまとめて配り直す |

### コンボ操作系(2個)

| ルーン(読み) | RiteId | 効果概要 |
|---|---|---|
| ウルズ | uruz | 現在のコンボ数に+nし、ウェーブ内最大コンボ数も追従更新する |
| イングズ | ingwaz | 基礎コンボ数に+nする(現在のコンボ数自体は変えない) |

### カード供給・山札操作系(5個)

| ルーン(読み) | RiteId | 効果概要 |
|---|---|---|
| ゲボ | gebo | 捨て札をシャッフルし、場札の列数ぶんを各列の一番上に配置する |
| フェフ | fehu | 山札の上から場札の列数ぶんを各列の一番上に配置する |
| ダガズ | dagaz | 山札と捨て札をすべて合わせてシャッフルし、新しい山札にする |
| ペルスロ | perthro | 各列を、ウェーブ開始時の枚数になるまで山札から補充する(不足列が無ければ使用不可) |
| ラグズ | laguz | 0枚になっている列をランダムに1つ選び、ウェーブ開始時の枚数になるまで山札から補充する(0枚列が無ければ使用不可) |

### チェーン操作系(2個)

| ルーン(読み) | RiteId | 効果概要 |
|---|---|---|
| アルギズ | algiz | そのウェーブが終わるまで列内の全カードをプレイ対象にする(playFromAnywhere) |
| アンスズ | ansuz | チェーンを捨て札に送り、山札から1枚めくって新しいチェーンにする(コンボ数は不変) |

### コンボリセット防止系(1個)

| ルーン(読み) | RiteId | 効果概要 |
|---|---|---|
| エイワズ | eihwaz | コンボリセット防止残り回数に+nする |

### コンボ・得点フラグ系(8個)

| ルーン(読み) | RiteId | 効果概要 |
|---|---|---|
| ハガラズ | hagalaz | 場札全体と山札の残りを合流・シャッフルし、各列の枚数を維持したまま配り直す |
| ナウジズ | nauthiz | 以後のコンボリセット時、再開値をリセット直前のコンボの半分(floor)にする |
| イサ | isa | 以後そのウェーブ中、コンボ数を一切変化させなくする(ナウジズより優先) |
| ソウィロ | sowilo | 最初に成立した役を記憶し、以後その役が成立するたび得点をx倍にする |
| ベルカナ | berkano | 現在のコンボ数をfloor(コンボ×x)にする(ウルズの乗算版) |
| マンナズ | mannaz | 以後の得点計算に、所持護符のレア度重み合計に応じた加算係数を掛ける |
| エワズ | ehwaz | 以後そのウェーブ中、階段判定の許容差にd=±2(ループ)も追加する |
| スリサズ | thurisaz | 次の1回のカードプレイの得点計算にx倍を追加乗算する(1回消費) |
```

- [ ] **Step 4: `shidasu-current-rules.md`の7.2節を24種に戻す**

`docs/shidasu/shidasu-current-rules.md`の以下の行:

```
- モチーフは北欧ルーン文字(エルダー・フサルク)。24種中**15種**実装済み(`RITE_POOL`)。カード変換系9種は天啓へ転用のうえ2026-08-11に削除済み(詳細は`docs/shidasu/shidasu-rite-redesign-candidates.md`を参照)。
- ウェーブを跨いで永続所持(所持上限**3**)。プレイ中に能動的に使用する消費アイテムで、`useRite`で1個消費して即時効果を発動する。一部(ゲボ・フェフ)は使用条件(山札・捨て札の枚数)がある。
```

を以下に置き換える:

```
- モチーフは北欧ルーン文字(エルダー・フサルク)。全**24種**実装済み(`RITE_POOL`)。2026-08-11に一度削除したカード変換系9種は、同日中に別の効果として再設計・復元された(詳細は`docs/shidasu/shidasu-rite-redesign-candidates.md`を参照)。
- ウェーブを跨いで永続所持(所持上限**3**)。プレイ中に能動的に使用する消費アイテムで、`useRite`で1個消費して即時効果を発動する。一部(ゲボ・フェフ、ペルスロ・ラグズ)は使用条件(山札・捨て札の枚数、不足列・空列の有無)がある。
```

- [ ] **Step 5: `shidasu-roadmap.md`の項目2を更新する**

`docs/shidasu/shidasu-roadmap.md`の項目2全体:

```
2. **秘儀の追加の検討**
   2026-08-09、天啓候補審査(項目3)の過程で「天啓=カード変換系、秘儀=それ以外」という将来方針が決まり、既存秘儀のうちカード変換系9個(`RiteId`型・`RITE_POOL`とも24種完備していたうちの9個)を2026-08-11に秘儀の実装から削除した(3個は天啓側に転用済み、6個は完全削除)。現在は24種中15種が実装済みで、空いた9枠(ᚱ・ᚹ・ᛟ・ᛈ・ᛏ・ᛚ・ᚨ・ᚲ・ᚦ)にモチーフ拡張なしで新しい秘儀を追加できる。候補材料は`docs/shidasu/shidasu-rite-redesign-candidates.md`(不採用天啓候補10個、削除済み6個の効果内容)を参照
```

を以下に置き換える:

```
2. **秘儀の追加の検討**
   2026-08-09、天啓候補審査(項目3)の過程で「天啓=カード変換系、秘儀=それ以外」という将来方針が決まり、既存秘儀のうちカード変換系9個を2026-08-11に秘儀の実装から一度削除した(3個は天啓側に転用済み、6個は完全削除)。同日中に、削除で空いた9枠に`docs/shidasu/shidasu-rite-redesign-candidates.md`セクションA(天啓候補審査で不採用となった10候補)の内容で新しい効果を設計・実装し、秘儀は全24種に復帰した。本項目は完了とする。
```

- [ ] **Step 6: ドキュメントの変更をビルド不要のまま確認し、コミットする**

```bash
git add docs/shidasu/shidasu-rite-redesign-candidates.md docs/shidasu/shidasu-current-rules.md docs/shidasu/shidasu-roadmap.md
git commit -m "docs: 秘儀9種の再実装完了を各ドキュメントに反映"
```

---

## Task 12: 最終検証

**Files:** なし(検証のみ)

- [ ] **Step 1: 全テストスイートを実行する**

Run: `npx vitest run`
Expected: 全テストパス(既存+今回追加した約20件の新規テスト)

- [ ] **Step 2: ビルドを実行する**

Run: `npm run build`
Expected: ビルド成功

- [ ] **Step 3: 型チェックを実行する**

Run: `npm run check`
Expected: shidasu関連のエラー無し(既存の無関係なエラー(solitaire/kuromoji/THREE)のみ残存)

- [ ] **Step 4: 開発サーバーで`/admin/shidasu-debug`と`/game/shidasu`が正常に読み込めることを確認する**

Run: `npm run dev`(バックグラウンド起動)
続けて `curl -s -L http://localhost:5173/admin/shidasu-debug -o /dev/null -w "%{http_code}\n"` と `curl -s -L http://localhost:5173/game/shidasu -o /dev/null -w "%{http_code}\n"` を実行
Expected: どちらも200

- [ ] **Step 5: RITE_POOLが24種であることを最終確認する**

Run: `npx vitest run src/lib/game/shidasu/rites.test.ts src/lib/game/shidasu/riteEffects.test.ts`
Expected: 全テストパス
