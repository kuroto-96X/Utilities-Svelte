# Shidasu 護符候補一覧グループ17(8個)の実装 Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** `docs/shidasu-gofu-candidates.md`のグループ17(祝福・庇護・大地・黄金・明星・慈悲・水鏡・刻限、8個)を実装する。

**Architecture:** `playCard`に「一時combo(庇護・大地・黄金・祝福が所持順で加工する計算用コンボ)」パイプラインと「役ボーナスの倍率適用(明星)」「役ボーナスの遅延複製(水鏡)」を追加する。`evaluateChainBonus`に役ボーナスへの倍率コールバックと、各役の実際の加点額(`amount`)を`roleFired`に追加する。慈悲・刻限は既存の`ITEM_EFFECTS`(gained チャンネル)にそのまま追加できる。

**Tech Stack:** TypeScript, Vitest。対象ファイルは`src/lib/game/shidasu/{types,params,engine}.ts`・`src/lib/game/shidasu/shidasu.config.json`・`src/lib/game/shidasu/engine.test.ts`・`src/routes/admin/shidasu/+page.svelte`。

---

## 前提知識(実装者向け)

- 詳細仕様は`docs/superpowers/specs/2026-07-15-shidasu-talisman-group17-design.md`を参照(本プランはこのspecの実装計画)。
- **スコープの明示的な限定**: spec本文はグループ17全体の設計方針を示しているが、`drawStock`の素朴(naive)パス(パターン継続めくり時の得点計算)への各護符の反映は、spec 1.1節で明示的に約束されている**黄金・庇護・大地の一時comboパイプラインのみ**とする。祝福・明星・水鏡・慈悲・刻限は本プランでは`playCard`(通常のカードプレイ)のみを対象とし、素朴パスへの反映はスコープ外とする(将来の別タスクで検討)。
- `RoleName`型は現在`engine.ts`内でのみ定義されている。`WaveState`(types.ts)がこの型を参照する必要があるため、Task 1で`types.ts`へ移設する。
- `evaluateChainBonus`の戻り値`ChainBonusResult.roleFired`配列の要素型に`amount: number`を追加する(Task 2)。これにより、`engine.test.ts`内で`roleFired: [{ name: 'flush' as const, usedWild: false }]`のように手動でオブジェクトリテラルを組み立てているテストが型エラーになるため、該当箇所すべてに`amount: 0`(値は検証対象外なので任意)を追加する必要がある。Task 2で対応する。
- 「一時combo(`effectiveCombo`)」は`playCard`内でのみ計算されるローカル変数であり、`wave.combo`(永続化されコンボ表示・faceLock判定に使う値)には影響しない。`ItemEffectContext.combo`と、コンボ倍率計算(`1 + (combo - 1) * comboMultiplierStep`)にのみ使う。`DirectEffectContext`(流星の`comboMilestoneDirect`等)は実コンボ(`newCombo`)のままとし、一時comboの影響を受けない(スコープ外の決定)。

---

### Task 1: データモデル拡張(RoleName移設・ItemId8個・WaveState6フィールド・talismansパラメータ・ITEM_NAMES・itemDesc)

**Files:**
- Modify: `src/lib/game/shidasu/types.ts`
- Modify: `src/lib/game/shidasu/engine.ts`(import文・`RoleName`定義削除・`startWave`)
- Modify: `src/lib/game/shidasu/params.ts`
- Modify: `src/lib/game/shidasu/shidasu.config.json`
- Modify: `src/lib/game/shidasu/engine.test.ts`(`makeWave`ヘルパー、新規テスト)

- [ ] **Step 1: 失敗するテストを書く**

`src/lib/game/shidasu/engine.test.ts`の`describe('DEFAULT_PARAMS.talismans (グループ9〜16)', ...)`ブロックの直後に追加:

```ts
describe('DEFAULT_PARAMS.talismans (グループ17)', () => {
  test('既定値が正しく設定されている', () => {
    expect(DEFAULT_PARAMS.talismans.protection.c).toBe(3)
    expect(DEFAULT_PARAMS.talismans.earth.c).toBe(2)
    expect(DEFAULT_PARAMS.talismans.morningStar.x).toBe(0.2)
    expect(DEFAULT_PARAMS.talismans.mercy.c).toBe(3)
    expect(DEFAULT_PARAMS.talismans.mercy.x).toBe(1.5)
    expect(DEFAULT_PARAMS.talismans.deadline.n).toBe(10)
  })
})
```

- [ ] **Step 2: テストを実行して失敗を確認**

Run: `npm run test -- engine.test.ts`
Expected: FAIL(`DEFAULT_PARAMS.talismans.protection`等が`undefined`)

- [ ] **Step 3: `types.ts`に`RoleName`を移設し、`ItemId`8個・`WaveState`6フィールドを追加**

`src/lib/game/shidasu/types.ts`の`StageModifier`型定義の直後に追加:

```ts
export type RoleName = 'flush' | 'royalSet' | 'sameRank' | 'completeRun' | 'columnSweep'
```

`ItemId`型定義の末尾(`| 'passion' | 'fightingSpirit'`の直後)に追加:

```ts
  | 'sanctify' | 'protection' | 'earth' | 'golden'
  | 'morningStar' | 'mercy' | 'mirror' | 'deadline'
```

`WaveState`インターフェース内、`benevolenceUsedThisCombo: boolean`の直後に追加:

```ts
  // 祝福用: 役成立のたび+1、コンボリセット時にwave.comboの復帰先になる(ウェーブ単位)
  baseComboCount: number
  // 水鏡用: 役の種類ごと(sameRank以外)に、今コンボで遅延複製をスケジュール済みか
  roleEchoUsedThisCombo: Partial<Record<RoleName, boolean>>
  // 水鏡用: sameRankは枚数段階(sameRankCountの値)ごとに使用済みかを記録する
  sameRankEchoUsedThisCombo: number[]
  // 水鏡用: 次の1プレイで上乗せ予定の役ボーナス(未予約ならnull)
  pendingRoleEcho: { name: RoleName; amount: number } | null
  // 明星用: 役の種類ごとのウェーブ内累積成立回数(今回成立分は含まない)
  roleOccurrenceCountThisWave: Partial<Record<RoleName, number>>
  // 慈悲用: 次のコンボの間、倍率xを適用中か
  mercyActiveNextCombo: boolean
```

- [ ] **Step 4: `engine.ts`から`RoleName`のローカル定義を削除し、`types.ts`からimportする**

`src/lib/game/shidasu/engine.ts`の先頭のimport文:

```ts
import type { Card, StageModifier, WaveState, ItemId, WaveEndReason, RunState, Suit, Rank, DeckCard } from './types'
```

を以下に置き換える:

```ts
import type { Card, StageModifier, WaveState, ItemId, WaveEndReason, RunState, Suit, Rank, DeckCard, RoleName } from './types'
```

`engine.ts`内の以下の行(`export type RoleName = 'flush' | 'royalSet' | 'sameRank' | 'completeRun' | 'columnSweep'`、`ChainBonusResult`インターフェース定義の直前にある)を検索し、削除する。

**注意**: `RoleName`という語で検索すると`ChainBonusResult`インターフェース内の`roleFired: { name: RoleName; usedWild: boolean }[]`という使用箇所もヒットするが、そちらは削除しない(型としての利用箇所であり、定義行のみを削除する)。

- [ ] **Step 5: `startWave`に6フィールドの初期化を追加**

`src/lib/game/shidasu/engine.ts`の`startWave`関数内、`wave`オブジェクトの`benevolenceUsedThisCombo: false,`の直後に追加:

```ts
    baseComboCount: 0,
    roleEchoUsedThisCombo: {},
    sameRankEchoUsedThisCombo: [],
    pendingRoleEcho: null,
    roleOccurrenceCountThisWave: {},
    mercyActiveNextCombo: false,
```

- [ ] **Step 6: `makeWave`テストヘルパーに同じ初期値を追加**

`src/lib/game/shidasu/engine.test.ts`の`makeWave`関数内、`benevolenceUsedThisCombo: false,`の直後に追加:

```ts
    baseComboCount: 0,
    roleEchoUsedThisCombo: {},
    sameRankEchoUsedThisCombo: [],
    pendingRoleEcho: null,
    roleOccurrenceCountThisWave: {},
    mercyActiveNextCombo: false,
```

- [ ] **Step 7: `params.ts`・`shidasu.config.json`にtalismansパラメータを追加**

`src/lib/game/shidasu/params.ts`の`ShidasuParams.talismans`型内、`fightingSpirit: { x: number }`の直後に追加:

```ts
    sanctify: Record<string, never>
    protection: { c: number }
    earth: { c: number }
    golden: Record<string, never>
    morningStar: { x: number }
    mercy: { c: number; x: number }
    mirror: Record<string, never>
    deadline: { n: number }
```

`DEFAULT_PARAMS.talismans`内、`fightingSpirit: { x: 1.3 },`の直後に追加:

```ts
    sanctify: {},
    protection: { c: 3 },
    earth: { c: 2 },
    golden: {},
    morningStar: { x: 0.2 },
    mercy: { c: 3, x: 1.5 },
    mirror: {},
    deadline: { n: 10 },
```

`src/lib/game/shidasu/shidasu.config.json`の`talismans`オブジェクト内、`"fightingSpirit": { "x": 1.3 }`を以下に置き換える:

```json
    "fightingSpirit": { "x": 1.3 },
    "sanctify": {},
    "protection": { "c": 3 },
    "earth": { "c": 2 },
    "golden": {},
    "morningStar": { "x": 0.2 },
    "mercy": { "c": 3, "x": 1.5 },
    "mirror": {},
    "deadline": { "n": 10 }
```

- [ ] **Step 8: `ITEM_NAMES`・`itemDesc`に8個分を追加**

`src/lib/game/shidasu/engine.ts`の`ITEM_NAMES`オブジェクト内、`fightingSpirit: '闘志の護符',`の直後に追加:

```ts
  sanctify: '祝福の護符',
  protection: '庇護の護符',
  earth: '大地の護符',
  golden: '黄金の護符',
  morningStar: '明星の護符',
  mercy: '慈悲の護符',
  mirror: '水鏡の護符',
  deadline: '刻限の護符',
```

`itemDesc`関数内、`case 'fightingSpirit': ...`の直後に追加:

```ts
    case 'sanctify': return `役を揃えるたび基礎コンボ数+1。コンボリセット時、0ではなく基礎コンボ数から再開する`
    case 'protection': return `コンボ数(計算用)が${params.talismans.protection.c}未満のとき、${params.talismans.protection.c}として計算する`
    case 'earth': return `コンボ数(計算用)に常に${params.talismans.earth.c}を加算する`
    case 'golden': return `コンボが1回進むたびに、通常の+1ではなく+2進む`
    case 'morningStar': return `役ボーナスの額を、その役のウェーブ内累積成立回数×${params.talismans.morningStar.x}分だけ倍加`
    case 'mercy': return `コンボ数が${params.talismans.mercy.c}以下でリセットされたとき、次のコンボの間、獲得点を${params.talismans.mercy.x}倍`
    case 'mirror': return `役が成立するたび(コンボ中1回、同ランクは枚数ごとに1回)、次のプレイで同じ役ボーナスを追加でもう一度加算する`
    case 'deadline': return `カードを取るたび、山札の残り枚数×${params.talismans.deadline.n}点加算`
```

- [ ] **Step 9: テストを実行して成功を確認**

Run: `npm run test -- engine.test.ts`
Expected: PASS

Run: `npm run build`
Expected: 成功(この時点では`ITEM_EFFECTS`等に8個の効果は未登録なので抽選プールにも未反映。これは意図通り)

- [ ] **Step 10: コミット**

```bash
git add src/lib/game/shidasu/types.ts src/lib/game/shidasu/engine.ts src/lib/game/shidasu/params.ts src/lib/game/shidasu/shidasu.config.json src/lib/game/shidasu/engine.test.ts
git commit -m "$(cat <<'EOF'
feat: Shidasu護符グループ17のデータモデル(WaveState新規state・ItemId・talismans設定)を追加

祝福・庇護・大地・黄金・明星・慈悲・水鏡・刻限の8個の護符idと
パラメータ、WaveStateへの6個の新規stateフィールドを追加した。
RoleName型はWaveStateから参照できるようtypes.tsへ移設した。
実際のゲームロジックへの配線は後続タスクで行う。
EOF
)"
```

---

### Task 2: evaluateChainBonusの拡張(役ボーナス倍率・実加点額の露出)とItemEffectContext拡張

**Files:**
- Modify: `src/lib/game/shidasu/engine.ts`
- Modify: `src/lib/game/shidasu/engine.test.ts`

- [ ] **Step 1: 失敗するテストを書く**

`src/lib/game/shidasu/engine.test.ts`の`describe('chainContinuesPattern', ...)`ブロックの直前(`evaluateChainBonus`関連のテストブロックがあるはずなので、そのブロックの末尾、閉じ`})`の直前)に追加。まず該当ブロックを`grep -n "describe('evaluateChainBonus'"`で検索して特定すること。そのブロック内の末尾に追加:

```ts
  test('roleFiredの各要素は実際の加点額(amount)を持つ', () => {
    const chainBefore = [card(1, '♥', 9), card(2, '♦', 10), card(3, '♣', 11)]
    const result = evaluateChainBonus(DEFAULT_PARAMS.scoring, chainBefore, card(4, '♠', 12))
    const flushEntry = result.roleFired.find(r => r.name === 'flush')
    expect(flushEntry).toBeDefined()
    expect(flushEntry?.amount).toBe(DEFAULT_PARAMS.scoring.flushBonus)
  })

  test('roleBonusMultiplierを渡すと役ボーナスの額に倍率がかかる(パターンボーナスには影響しない)', () => {
    const chainBefore = [card(1, '♥', 9), card(2, '♦', 10), card(3, '♣', 11)]
    const multiplier = (name: RoleName) => (name === 'flush' ? 2 : 1)
    const result = evaluateChainBonus(DEFAULT_PARAMS.scoring, chainBefore, card(4, '♠', 12), DEFAULT_PARAMS.scoring.stairMinLen, multiplier)
    const flushEntry = result.roleFired.find(r => r.name === 'flush')
    expect(flushEntry?.amount).toBe(DEFAULT_PARAMS.scoring.flushBonus * 2)
    expect(result.bonus).toBe(DEFAULT_PARAMS.scoring.flushBonus * 2)
  })

  test('roleBonusMultiplierを省略すると常に等倍(既存挙動と同じ)', () => {
    const chainBefore = [card(1, '♣', 5), card(2, '♣', 6)]
    const withoutMultiplier = evaluateChainBonus(DEFAULT_PARAMS.scoring, chainBefore, card(3, '♣', 5))
    const withIdentityMultiplier = evaluateChainBonus(DEFAULT_PARAMS.scoring, chainBefore, card(3, '♣', 5), DEFAULT_PARAMS.scoring.stairMinLen, () => 1)
    expect(withoutMultiplier).toEqual(withIdentityMultiplier)
  })
```

`RoleName`型を`engine.test.ts`でも使うため、`./types`からのimportに追加する必要がある。`RoleName`はTask 1で`types.ts`へ移設され、`engine.ts`は`import type`で内部利用するのみで再エクスポートしていないため、`engine.test.ts`側は`./engine`ではなく`./types`から直接importする。`src/lib/game/shidasu/engine.test.ts`の以下の行:

```ts
import type { Card, WaveState, RunState, ItemId } from './types'
```

を以下に置き換える:

```ts
import type { Card, WaveState, RunState, ItemId, RoleName } from './types'
```

- [ ] **Step 2: テストを実行して失敗を確認**

Run: `npm run test -- engine.test.ts`
Expected: FAIL(`roleFired`の要素に`amount`が無い、`roleBonusMultiplier`引数が存在しない)

このタイミングで、型エラーとして「`roleFired: [{ name: 'flush' as const, usedWild: false }]`のようなオブジェクトリテラルに`amount`が無い」というエラーも複数箇所で出るはずである(Step 3実装後に対応、Step 4で修正)。

- [ ] **Step 3: `ChainBonusResult`と`evaluateChainBonus`を拡張**

`src/lib/game/shidasu/engine.ts`の`ChainBonusResult`インターフェース:

```ts
export interface ChainBonusResult {
  bonus: number
  parts: string[]
  // 同スート/同色/階段のいずれかの「パターンボーナス」が成立したか
  patternFired: boolean
  // 成立した「役ボーナス」の一覧。usedWildの意味はrole名によって異なる:
  // flush/royalSet/completeRunは「実カードだけでは成立せずワイルドの穴埋めが必須だったか」(必要性ベース)。
  // sameRankは同ランクボーナスの加点量自体がワイルド枚数を無条件に含むため、
  // 「チェーンにワイルドが1枚でも存在すれば常にtrue」(寄与ベース)になる。
  roleFired: { name: RoleName; usedWild: boolean }[]
}
```

を以下に置き換える:

```ts
export interface ChainBonusResult {
  bonus: number
  parts: string[]
  // 同スート/同色/階段のいずれかの「パターンボーナス」が成立したか
  patternFired: boolean
  // 成立した「役ボーナス」の一覧。usedWildの意味はrole名によって異なる:
  // flush/royalSet/completeRunは「実カードだけでは成立せずワイルドの穴埋めが必須だったか」(必要性ベース)。
  // sameRankは同ランクボーナスの加点量自体がワイルド枚数を無条件に含むため、
  // 「チェーンにワイルドが1枚でも存在すれば常にtrue」(寄与ベース)になる。
  // amountはこの役が実際に加算した点数(roleBonusMultiplier適用後、completeRunは同スート追加分を含む)。
  // 明星(倍率適用)・水鏡(遅延複製)が参照する。
  roleFired: { name: RoleName; usedWild: boolean; amount: number }[]
}
```

`evaluateChainBonus`関数全体:

```ts
export function evaluateChainBonus(
  scoring: ShidasuParams['scoring'],
  chainBefore: Card[],
  card: Card,
  stairMinLen: number = scoring.stairMinLen
): ChainBonusResult {
  if (chainBefore.length === 0) {
    return { bonus: 0, parts: [], patternFired: false, roleFired: [] }
  }

  let bonus = 0
  const parts: string[] = []
  let patternFired = false
  const roleFired: { name: RoleName; usedWild: boolean }[] = []

  const chainIncludingThis = [...chainBefore, card]

  const { suitHeld, colorHeld } = analyzeSuitColor(chainIncludingThis)
  if (chainIncludingThis.length >= scoring.suitColorMinLen) {
    if (suitHeld) {
      bonus += scoring.suitBonus
      parts.push(`同スート+${scoring.suitBonus}`)
      patternFired = true
    } else if (colorHeld) {
      bonus += scoring.colorBonus
      parts.push(`同色+${scoring.colorBonus}`)
      patternFired = true
    }
  }

  const stairInfo = analyzeStair(chainIncludingThis)
  if (stairInfo.held && stairInfo.len >= stairMinLen) {
    bonus += scoring.stairBonus
    parts.push(`階段${stairInfo.len} +${scoring.stairBonus}`)
    patternFired = true
  }

  if (checkFlush(chainIncludingThis)) {
    bonus += scoring.flushBonus
    parts.push(`フラッシュ+${scoring.flushBonus}`)
    const last4 = chainIncludingThis.slice(-4)
    const realSuits = new Set(last4.filter(c => !c.wild).map(c => c.suit))
    const flushUsedWild = ALL_SUITS_REAL.some(s => !realSuits.has(s))
    roleFired.push({ name: 'flush', usedWild: flushUsedWild })
  }

  if (checkRoyalSet(chainIncludingThis)) {
    bonus += scoring.royalSetBonus
    parts.push(`ロイヤル+${scoring.royalSetBonus}`)
    const last3 = chainIncludingThis.slice(-3)
    const realRanks = new Set(last3.filter(c => !c.wild).map(c => c.rank))
    const requiredRanks: Card['rank'][] = [11, 12, 13]
    const royalSetUsedWild = requiredRanks.some(r => !realRanks.has(r))
    roleFired.push({ name: 'royalSet', usedWild: royalSetUsedWild })
  }

  const sameRankCount = card.wild ? countSameRankForWildPlay(chainBefore) : countSameRankBefore(chainBefore, card.rank)
  if (sameRankCount > 0) {
    const sameRankGain = scoring.sameRankBonusUnit * sameRankCount
    bonus += sameRankGain
    parts.push(`同ランク+${sameRankGain}`)
    const sameRankUsedWild = card.wild || chainBefore.some(c => c.wild)
    roleFired.push({ name: 'sameRank', usedWild: sameRankUsedWild })
  }

  if (checkCompleteRun(chainBefore, chainIncludingThis)) {
    bonus += scoring.completeRunBonus
    parts.push(`コンプリートラン+${scoring.completeRunBonus}`)
    const distinctRealNow = new Set(chainIncludingThis.filter(c => !c.wild).map(c => c.rank)).size
    const wildCountNow = chainIncludingThis.filter(c => c.wild).length
    const completeRunUsedWild = distinctRealNow < 13 && wildCountNow > 0
    roleFired.push({ name: 'completeRun', usedWild: completeRunUsedWild })
    if (suitHeld) {
      bonus += scoring.completeRunSuitBonus
      parts.push(`コンプリートラン(同スート)+${scoring.completeRunSuitBonus}`)
    }
  }

  return { bonus, parts, patternFired, roleFired }
}
```

を以下に置き換える:

```ts
export function evaluateChainBonus(
  scoring: ShidasuParams['scoring'],
  chainBefore: Card[],
  card: Card,
  stairMinLen: number = scoring.stairMinLen,
  roleBonusMultiplier: (name: RoleName) => number = () => 1
): ChainBonusResult {
  if (chainBefore.length === 0) {
    return { bonus: 0, parts: [], patternFired: false, roleFired: [] }
  }

  let bonus = 0
  const parts: string[] = []
  let patternFired = false
  const roleFired: { name: RoleName; usedWild: boolean; amount: number }[] = []

  const chainIncludingThis = [...chainBefore, card]

  const { suitHeld, colorHeld } = analyzeSuitColor(chainIncludingThis)
  if (chainIncludingThis.length >= scoring.suitColorMinLen) {
    if (suitHeld) {
      bonus += scoring.suitBonus
      parts.push(`同スート+${scoring.suitBonus}`)
      patternFired = true
    } else if (colorHeld) {
      bonus += scoring.colorBonus
      parts.push(`同色+${scoring.colorBonus}`)
      patternFired = true
    }
  }

  const stairInfo = analyzeStair(chainIncludingThis)
  if (stairInfo.held && stairInfo.len >= stairMinLen) {
    bonus += scoring.stairBonus
    parts.push(`階段${stairInfo.len} +${scoring.stairBonus}`)
    patternFired = true
  }

  if (checkFlush(chainIncludingThis)) {
    const flushGain = Math.floor(scoring.flushBonus * roleBonusMultiplier('flush'))
    bonus += flushGain
    parts.push(`フラッシュ+${flushGain}`)
    const last4 = chainIncludingThis.slice(-4)
    const realSuits = new Set(last4.filter(c => !c.wild).map(c => c.suit))
    const flushUsedWild = ALL_SUITS_REAL.some(s => !realSuits.has(s))
    roleFired.push({ name: 'flush', usedWild: flushUsedWild, amount: flushGain })
  }

  if (checkRoyalSet(chainIncludingThis)) {
    const royalSetGain = Math.floor(scoring.royalSetBonus * roleBonusMultiplier('royalSet'))
    bonus += royalSetGain
    parts.push(`ロイヤル+${royalSetGain}`)
    const last3 = chainIncludingThis.slice(-3)
    const realRanks = new Set(last3.filter(c => !c.wild).map(c => c.rank))
    const requiredRanks: Card['rank'][] = [11, 12, 13]
    const royalSetUsedWild = requiredRanks.some(r => !realRanks.has(r))
    roleFired.push({ name: 'royalSet', usedWild: royalSetUsedWild, amount: royalSetGain })
  }

  const sameRankCount = card.wild ? countSameRankForWildPlay(chainBefore) : countSameRankBefore(chainBefore, card.rank)
  if (sameRankCount > 0) {
    const sameRankGain = Math.floor(scoring.sameRankBonusUnit * sameRankCount * roleBonusMultiplier('sameRank'))
    bonus += sameRankGain
    parts.push(`同ランク+${sameRankGain}`)
    const sameRankUsedWild = card.wild || chainBefore.some(c => c.wild)
    roleFired.push({ name: 'sameRank', usedWild: sameRankUsedWild, amount: sameRankGain })
  }

  if (checkCompleteRun(chainBefore, chainIncludingThis)) {
    const completeRunGain = Math.floor(scoring.completeRunBonus * roleBonusMultiplier('completeRun'))
    bonus += completeRunGain
    parts.push(`コンプリートラン+${completeRunGain}`)
    const distinctRealNow = new Set(chainIncludingThis.filter(c => !c.wild).map(c => c.rank)).size
    const wildCountNow = chainIncludingThis.filter(c => c.wild).length
    const completeRunUsedWild = distinctRealNow < 13 && wildCountNow > 0
    let completeRunTotalGain = completeRunGain
    if (suitHeld) {
      const completeRunSuitGain = Math.floor(scoring.completeRunSuitBonus * roleBonusMultiplier('completeRun'))
      bonus += completeRunSuitGain
      parts.push(`コンプリートラン(同スート)+${completeRunSuitGain}`)
      completeRunTotalGain += completeRunSuitGain
    }
    roleFired.push({ name: 'completeRun', usedWild: completeRunUsedWild, amount: completeRunTotalGain })
  }

  return { bonus, parts, patternFired, roleFired }
}
```

(`completeRun`のみ、同スート追加ボーナスの有無で`roleFired.push`する行の位置が末尾に移動している。`amount`に同スート追加分を含めるための変更であり、`bonus`・`parts`への加算順序自体は変えていない。)

- [ ] **Step 4: 型エラーになる既存テストの手動オブジェクトリテラルに`amount`を追加**

`src/lib/game/shidasu/engine.test.ts`内で`grep -n "name: '.*' as const, usedWild:"`を実行し、ヒットした全箇所(8行前後)の`{ name: 'xxx' as const, usedWild: yyy }`という形のオブジェクトリテラルに`, amount: 0`を追加する(例: `{ name: 'flush' as const, usedWild: false }` → `{ name: 'flush' as const, usedWild: false, amount: 0 }`)。これらのテストは`.name`・`.usedWild`のみを検証しており`amount`の値は無関係なので、`0`で問題ない。

- [ ] **Step 5: `ItemEffectContext`に`mercyActiveNextCombo`を追加**

`src/lib/game/shidasu/engine.ts`の`ItemEffectContext`インターフェース内、`drawContinueCountThisChain: number`の直後に追加:

```ts
  // 慈悲用: 次のコンボの間、倍率xを適用中か
  mercyActiveNextCombo: boolean
```

- [ ] **Step 6: `engine.test.ts`内の全`ctx()`ヘルパーに`mercyActiveNextCombo`のデフォルト値を追加**

`grep -n "function ctx(overrides"`で全箇所(13箇所)を検索し、`drawContinueCountThisChain: 0,`の直後に以下を追加する:

```ts
        mercyActiveNextCombo: false,
```

- [ ] **Step 7: テストを実行して成功を確認**

Run: `npm run test -- engine.test.ts`
Expected: PASS

Run: `npm run build`
Expected: 成功

- [ ] **Step 8: コミット**

```bash
git add src/lib/game/shidasu/engine.ts src/lib/game/shidasu/engine.test.ts
git commit -m "$(cat <<'EOF'
feat: evaluateChainBonusに役ボーナス倍率コールバックとamountを追加

roleFiredの各要素に実際の加点額(amount)を持たせ、オプションの
roleBonusMultiplierコールバックで役ボーナスの額を個別に倍率適用
できるようにした(明星・水鏡の実装基盤)。デフォルトは等倍のため
既存の呼び出し箇所には影響しない。ItemEffectContextに
mercyActiveNextCombo(慈悲用)も追加した。
EOF
)"
```

---

### Task 3: 黄金(コンボ加算を+1ではなく+2にする)

**Files:**
- Modify: `src/lib/game/shidasu/engine.ts`
- Modify: `src/lib/game/shidasu/engine.test.ts`

- [ ] **Step 1: 失敗するテストを書く**

`src/lib/game/shidasu/engine.test.ts`の`describe('playCard', ...)`ブロックの末尾に追加:

```ts
  test('黄金: コンボが+1ではなく+2進む', () => {
    const wave = baseWave({ combo: 3, tableau: [[card(9, '♠', 1), card(1, '♣', 6)], [card(2, '♦', 2)]] })
    const next = playCard(DEFAULT_PARAMS, wave, 'none', ['golden'], 1000000, 0)
    expect(next.combo).toBe(5)
  })

  test('黄金を持たなければ通常通りコンボは+1', () => {
    const wave = baseWave({ combo: 3, tableau: [[card(9, '♠', 1), card(1, '♣', 6)], [card(2, '♦', 2)]] })
    const next = playCard(DEFAULT_PARAMS, wave, 'none', [], 1000000, 0)
    expect(next.combo).toBe(4)
  })
```

`src/lib/game/shidasu/engine.test.ts`の`describe('drawStock (素朴の得点ルール変更)', ...)`ブロックの末尾に追加:

```ts
  test('黄金: 素朴パスでもコンボが+2進む', () => {
    const wave = makeWave({
      stock: [card(1, '♠', 9)],
      combo: 2,
      chain: [card(2, '♠', 4), card(3, '♠', 5)],
      linked: true,
      score: 0,
    })
    const { wave: next } = drawStock(DEFAULT_PARAMS, wave, ['naive', 'golden'], standardDeckComposition())
    expect(next.combo).toBe(4)
  })
```

- [ ] **Step 2: テストを実行して失敗を確認**

Run: `npm run test -- engine.test.ts`
Expected: FAIL

- [ ] **Step 3: `playCard`・`drawStock`のコンボ加算部分を修正**

`src/lib/game/shidasu/engine.ts`の`playCard`関数内の以下の行:

```ts
  const newCombo = wave.combo + 1
```

を以下に置き換える:

```ts
  // 黄金: 通常のコンボ加算処理そのものを+1ではなく+2にする(他の護符には無干渉)
  const newCombo = wave.combo + (items.includes('golden') ? 2 : 1)
```

`drawStock`関数内の素朴パスにある以下の行:

```ts
      const newCombo = wave.combo + 1
```

を以下に置き換える:

```ts
      const newCombo = wave.combo + (items.includes('golden') ? 2 : 1)
```

- [ ] **Step 4: テストを実行して成功を確認**

Run: `npm run test -- engine.test.ts`
Expected: PASS

Run: `npm run build`
Expected: 成功

- [ ] **Step 5: コミット**

```bash
git add src/lib/game/shidasu/engine.ts src/lib/game/shidasu/engine.test.ts
git commit -m "$(cat <<'EOF'
feat: Shidasu護符に黄金を追加

通常のコンボ加算処理(playCard・drawStockの素朴パス)を+1ではなく
+2にする。コンボ倍率計算や他の護符には一切干渉しない。
EOF
)"
```

---

### Task 4: 庇護・大地(一時comboパイプライン)

**Files:**
- Modify: `src/lib/game/shidasu/engine.ts`
- Modify: `src/lib/game/shidasu/engine.test.ts`

- [ ] **Step 1: 失敗するテストを書く**

`src/lib/game/shidasu/engine.test.ts`の`describe('playCard', ...)`ブロックの末尾に追加:

```ts
  test('庇護: コンボ数(計算用)がc未満ならcとして計算される', () => {
    const wave = baseWave({ combo: 0, tableau: [[card(9, '♠', 1), card(1, '♣', 6)], [card(2, '♦', 2)]] })
    // combo=0でプレイするとnewCombo=1。庇護c=3未満なので一時comboは3として計算される。
    const withProtection = playCard(DEFAULT_PARAMS, wave, 'none', ['protection'], 1000000, 0)
    const without = playCard(DEFAULT_PARAMS, wave, 'none', [], 1000000, 0)
    expect(withProtection.score).toBeGreaterThan(without.score)
  })

  test('大地: コンボ数(計算用)に常にcが加算される', () => {
    const wave = baseWave({ combo: 5, tableau: [[card(9, '♠', 1), card(1, '♣', 6)], [card(2, '♦', 2)]] })
    const withEarth = playCard(DEFAULT_PARAMS, wave, 'none', ['earth'], 1000000, 0)
    const without = playCard(DEFAULT_PARAMS, wave, 'none', [], 1000000, 0)
    expect(withEarth.score).toBeGreaterThan(without.score)
    // wave.combo自体(実コンボ)は一時comboの影響を受けない
    expect(withEarth.combo).toBe(without.combo)
  })

  test('庇護・大地は所持順で一時comboに適用され、大地→庇護の順だと庇護が不発化しうる', () => {
    // combo=0でプレイ: newCombo=1。大地(c=2)が先に+2して一時combo=3。
    // 庇護(c=3)は「3 < 3」が偽なので不発化(3のまま)。
    const wave = baseWave({ combo: 0, tableau: [[card(9, '♠', 1), card(1, '♣', 6)], [card(2, '♦', 2)]] })
    const earthThenProtection = playCard(DEFAULT_PARAMS, wave, 'none', ['earth', 'protection'], 1000000, 0)
    // 庇護→大地の順なら: newCombo=1→庇護でc=3に底上げ→大地で+2して5になる。より高スコアになるはず。
    const protectionThenEarth = playCard(DEFAULT_PARAMS, wave, 'none', ['protection', 'earth'], 1000000, 0)
    expect(protectionThenEarth.score).toBeGreaterThan(earthThenProtection.score)
  })
```

- [ ] **Step 2: テストを実行して失敗を確認**

Run: `npm run test -- engine.test.ts`
Expected: FAIL

- [ ] **Step 3: `playCard`に一時comboパイプラインを追加**

`src/lib/game/shidasu/engine.ts`の`playCard`関数内、以下の行(Task 2完了後の状態):

```ts
  const itemEffectCtx: ItemEffectContext = {
    card,
    previousFoundation: wave.foundation,
    combo: newCombo,
```

の直前に、以下のブロックを追加する:

```ts
  // 庇護・大地: 所持順(itemsの並び順)で一時comboに順に適用する。wave.combo(実コンボ)自体は変化しない。
  let effectiveCombo = newCombo
  for (const id of items) {
    if (id === 'protection' && effectiveCombo < params.talismans.protection.c) {
      effectiveCombo = params.talismans.protection.c
    } else if (id === 'earth') {
      effectiveCombo += params.talismans.earth.c
    }
  }

```

続けて、直後の`itemEffectCtx`オブジェクト内の`combo: newCombo,`を`combo: effectiveCombo,`に置き換える。

さらに、その少し下にある以下の行:

```ts
  const comboMultiplierStep = params.scoring.comboMultiplierStep
  const multiplier = 1 + (newCombo - 1) * comboMultiplierStep
```

を以下に置き換える:

```ts
  const comboMultiplierStep = params.scoring.comboMultiplierStep
  const multiplier = 1 + (effectiveCombo - 1) * comboMultiplierStep
```

**注意**: `milestoneCtx`(流星用の`DirectEffectContext`)の`combo: newCombo`はそのまま変更しない(流星は実コンボ基準のまま、というスコープ外の決定による)。

- [ ] **Step 4: `drawStock`の素朴パスにも同じ一時comboパイプラインを追加**

`src/lib/game/shidasu/engine.ts`の`drawStock`関数内、素朴パスの以下の行:

```ts
      const naiveCtx: ItemEffectContext = {
        card: drawnCard,
        previousFoundation: wave.foundation,
        combo: newCombo,
```

の直前に、以下のブロックを追加する:

```ts
      let effectiveCombo = newCombo
      for (const id of items) {
        if (id === 'protection' && effectiveCombo < params.talismans.protection.c) {
          effectiveCombo = params.talismans.protection.c
        } else if (id === 'earth') {
          effectiveCombo += params.talismans.earth.c
        }
      }

```

続けて、直後の`naiveCtx`オブジェクト内の`combo: newCombo,`を`combo: effectiveCombo,`に置き換える。

さらに、その少し下にある以下の行:

```ts
      const comboMultiplierStep = params.scoring.comboMultiplierStep
      const multiplier = 1 + (newCombo - 1) * comboMultiplierStep
```

を以下に置き換える:

```ts
      const comboMultiplierStep = params.scoring.comboMultiplierStep
      const multiplier = 1 + (effectiveCombo - 1) * comboMultiplierStep
```

- [ ] **Step 5: テストを実行して成功を確認**

Run: `npm run test -- engine.test.ts`
Expected: PASS

Run: `npm run build`
Expected: 成功

- [ ] **Step 6: コミット**

```bash
git add src/lib/game/shidasu/engine.ts src/lib/game/shidasu/engine.test.ts
git commit -m "$(cat <<'EOF'
feat: Shidasu護符に庇護・大地を追加

playCard・drawStockの素朴パスに、所持順で解決する一時combo
パイプラインを追加した。庇護はコンボ数(計算用)の下駄、大地は
常時加算。wave.combo自体(UI表示・faceLock判定用)には影響しない。
EOF
)"
```

---

### Task 5: 祝福(基礎コンボ数)

**Files:**
- Modify: `src/lib/game/shidasu/engine.ts`
- Modify: `src/lib/game/shidasu/engine.test.ts`

- [ ] **Step 1: 失敗するテストを書く**

`src/lib/game/shidasu/engine.test.ts`の`describe('playCard', ...)`ブロックの末尾に追加:

```ts
  test('祝福: 役が成立するとbaseComboCountが+1され、一時comboにも反映される', () => {
    // フラッシュ成立(4スート)する組み合わせでプレイする
    const wave = baseWave({
      foundation: card(0, '♠', 5),
      chain: [card(20, '♥', 3), card(21, '♦', 4), card(22, '♠', 5)],
      tableau: [[card(1, '♣', 6)], [card(2, '♦', 2)]],
      baseComboCount: 0,
    })
    const next = playCard(DEFAULT_PARAMS, wave, 'none', ['sanctify'], 1000000, 0)
    expect(next.baseComboCount).toBe(1)
  })

  test('祝福: 役が成立しなければbaseComboCountは変化しない', () => {
    const wave = baseWave({
      tableau: [[card(9, '♠', 1), card(1, '♣', 6)], [card(2, '♦', 2)]],
      baseComboCount: 2,
    })
    const next = playCard(DEFAULT_PARAMS, wave, 'none', ['sanctify'], 1000000, 0)
    expect(next.baseComboCount).toBe(2)
  })
```

`src/lib/game/shidasu/engine.test.ts`の`describe('drawStock', ...)`ブロックの末尾に追加:

```ts
  test('祝福: コンボリセット時、wave.comboは0ではなくbaseComboCountになる', () => {
    const wave = makeWave({
      stock: [card(1, '♣', 9)],
      tableau: [[card(2, '♣', 8)]],
      chain: [card(3, '♥', 5)],
      linked: true,
      baseComboCount: 4,
    })
    const { wave: next } = drawStock(DEFAULT_PARAMS, wave, ['sanctify'], standardDeckComposition())
    expect(next.combo).toBe(4)
  })

  test('祝福を持たなければコンボリセット時は通常通り0になる', () => {
    const wave = makeWave({
      stock: [card(1, '♣', 9)],
      tableau: [[card(2, '♣', 8)]],
      chain: [card(3, '♥', 5)],
      linked: true,
      baseComboCount: 4,
    })
    const { wave: next } = drawStock(DEFAULT_PARAMS, wave, [], standardDeckComposition())
    expect(next.combo).toBe(0)
  })
```

- [ ] **Step 2: テストを実行して失敗を確認**

Run: `npm run test -- engine.test.ts`
Expected: FAIL

- [ ] **Step 3: `playCard`に祝福のbaseComboCount更新を追加**

`src/lib/game/shidasu/engine.ts`の`playCard`関数内、Task 4で追加した一時comboパイプラインのブロック:

```ts
  let effectiveCombo = newCombo
  for (const id of items) {
    if (id === 'protection' && effectiveCombo < params.talismans.protection.c) {
      effectiveCombo = params.talismans.protection.c
    } else if (id === 'earth') {
      effectiveCombo += params.talismans.earth.c
    }
  }
```

を以下に置き換える(`sanctify`の分岐を追加):

```ts
  let effectiveCombo = newCombo
  for (const id of items) {
    if (id === 'protection' && effectiveCombo < params.talismans.protection.c) {
      effectiveCombo = params.talismans.protection.c
    } else if (id === 'earth') {
      effectiveCombo += params.talismans.earth.c
    } else if (id === 'sanctify' && roleFired.length > 0) {
      effectiveCombo += 1
    }
  }
  const newBaseComboCount = items.includes('sanctify') && roleFired.length > 0 ? wave.baseComboCount + 1 : wave.baseComboCount
```

続けて、`next: WaveState`オブジェクト定義内、`columnSweepActiveThisWave: newColumnSweepActiveThisWave,`の直後に追加:

```ts
    baseComboCount: newBaseComboCount,
```

- [ ] **Step 4: `drawStock`のリセット分岐に祝福の復帰処理を追加**

`src/lib/game/shidasu/engine.ts`の`drawStock`関数内、リセット分岐の戻り値オブジェクトにある以下の行:

```ts
      combo: 0,
```

を以下に置き換える:

```ts
      combo: items.includes('sanctify') ? wave.baseComboCount : 0,
```

同じリセット分岐の戻り値オブジェクトに、以下のフィールドも追加する(`benevolenceUsedThisCombo: false,`の直後):

```ts
      roleEchoUsedThisCombo: {},
      sameRankEchoUsedThisCombo: [],
      pendingRoleEcho: null,
      mercyActiveNextCombo: wave.combo <= params.talismans.mercy.c,
```

**注意**: `baseComboCount`・`roleOccurrenceCountThisWave`はウェーブ単位のフィールドなので、このリセット分岐では変更しない(`...wave`のスプレッドでそのまま引き継がれる)。`mercyActiveNextCombo`は慈悲(Task 8)用だが、`items.includes('mercy')`に関わらず常に計算しても無害なので、この時点でまとめて追加してよい(このフィールドを読むのは慈悲自身のITEM_EFFECTSエントリのみで、慈悲を持たない場合は単に未使用の値になるだけ)。

- [ ] **Step 5: テストを実行して成功を確認**

Run: `npm run test -- engine.test.ts`
Expected: PASS

Run: `npm run build`
Expected: 成功

- [ ] **Step 6: コミット**

```bash
git add src/lib/game/shidasu/engine.ts src/lib/game/shidasu/engine.test.ts
git commit -m "$(cat <<'EOF'
feat: Shidasu護符に祝福を追加

役成立のたびbaseComboCountを+1し、一時comboにも即座に反映する。
コンボリセット時、wave.comboは0ではなくbaseComboCountから再開する。
あわせてdrawStockのリセット分岐に水鏡・慈悲用フィールドの
初期化も追加した(Task 7・8の前倒し配線)。
EOF
)"
```

---

### Task 6: 明星(役ボーナスの倍率適用)

**Files:**
- Modify: `src/lib/game/shidasu/engine.ts`
- Modify: `src/lib/game/shidasu/engine.test.ts`

- [ ] **Step 1: 失敗するテストを書く**

`src/lib/game/shidasu/engine.test.ts`の`describe('playCard', ...)`ブロックの末尾に追加:

```ts
  test('明星: 役の種類ごとのウェーブ内累積成立回数に応じて役ボーナスが倍加する', () => {
    // フラッシュが成立する組み合わせ(4スート)
    const wave = baseWave({
      foundation: card(0, '♠', 5),
      chain: [card(20, '♥', 3), card(21, '♦', 4), card(22, '♠', 5)],
      tableau: [[card(1, '♣', 6)], [card(2, '♦', 2)]],
      roleOccurrenceCountThisWave: { flush: 3 },
    })
    const withMorningStar = playCard(DEFAULT_PARAMS, wave, 'none', ['morningStar'], 1000000, 0)
    const without = playCard(DEFAULT_PARAMS, wave, 'none', [], 1000000, 0)
    expect(withMorningStar.score).toBeGreaterThan(without.score)
  })

  test('明星: 役が成立するとroleOccurrenceCountThisWaveが+1される(今回分は倍率計算に使わない)', () => {
    const wave = baseWave({
      foundation: card(0, '♠', 5),
      chain: [card(20, '♥', 3), card(21, '♦', 4), card(22, '♠', 5)],
      tableau: [[card(1, '♣', 6)], [card(2, '♦', 2)]],
      roleOccurrenceCountThisWave: { flush: 1 },
    })
    const next = playCard(DEFAULT_PARAMS, wave, 'none', ['morningStar'], 1000000, 0)
    expect(next.roleOccurrenceCountThisWave.flush).toBe(2)
  })
```

- [ ] **Step 2: テストを実行して失敗を確認**

Run: `npm run test -- engine.test.ts`
Expected: FAIL

- [ ] **Step 3: `playCard`に明星のroleBonusMultiplierとroleOccurrenceCountThisWave更新を追加**

`src/lib/game/shidasu/engine.ts`の`playCard`関数内、以下の行:

```ts
  const effectiveStairMinLen = items.includes('bridge') ? params.items.stairRelaxedMinLen : params.scoring.stairMinLen
  const chainResult = evaluateChainBonus(params.scoring, wave.chain, card, effectiveStairMinLen)
  base += chainResult.bonus
  parts.push(...chainResult.parts)
```

を以下に置き換える:

```ts
  const effectiveStairMinLen = items.includes('bridge') ? params.items.stairRelaxedMinLen : params.scoring.stairMinLen
  // 明星: 役の種類ごとのウェーブ内累積成立回数(今回成立分は含まない)に応じて役ボーナス額を倍率適用する
  const roleBonusMultiplier = (name: RoleName): number => {
    if (!items.includes('morningStar')) return 1
    const count = wave.roleOccurrenceCountThisWave[name] ?? 0
    return 1 + count * params.talismans.morningStar.x
  }
  const chainResult = evaluateChainBonus(params.scoring, wave.chain, card, effectiveStairMinLen, roleBonusMultiplier)
  base += chainResult.bonus
  parts.push(...chainResult.parts)
```

続けて、列一掃ボーナスの計算箇所である以下の行:

```ts
  if (sweepQualifies) {
    const sweepGain = params.scoring.columnSweepBonus * newColumnsEmptied
    base += sweepGain
    parts.push(`列一掃+${sweepGain}`)
    roleFired.push({ name: 'columnSweep', usedWild: false })
  }
```

を以下に置き換える(列一掃も役ボーナスの一種として明星の倍率対象に含める):

```ts
  if (sweepQualifies) {
    const sweepGain = Math.floor(params.scoring.columnSweepBonus * newColumnsEmptied * roleBonusMultiplier('columnSweep'))
    base += sweepGain
    parts.push(`列一掃+${sweepGain}`)
    roleFired.push({ name: 'columnSweep', usedWild: false, amount: sweepGain })
  }
```

- [ ] **Step 4: `roleOccurrenceCountThisWave`の更新を追加**

同じ`playCard`関数内、Task 5で追加した以下のブロックの直後:

```ts
  const newBaseComboCount = items.includes('sanctify') && roleFired.length > 0 ? wave.baseComboCount + 1 : wave.baseComboCount
```

に続けて追加:

```ts
  // 明星: 今回成立した役の種類ごとに、ウェーブ内累積成立回数を+1する(今回分は次回以降に反映)
  let newRoleOccurrenceCountThisWave = wave.roleOccurrenceCountThisWave
  if (roleFired.length > 0) {
    newRoleOccurrenceCountThisWave = { ...wave.roleOccurrenceCountThisWave }
    for (const fired of roleFired) {
      newRoleOccurrenceCountThisWave[fired.name] = (newRoleOccurrenceCountThisWave[fired.name] ?? 0) + 1
    }
  }
```

続けて、`next: WaveState`オブジェクト定義内、Task 5で追加した`baseComboCount: newBaseComboCount,`の直後に追加:

```ts
    roleOccurrenceCountThisWave: newRoleOccurrenceCountThisWave,
```

**注意**: `roleOccurrenceCountThisWave`の更新は明星を所持しているかどうかに関わらず常に行う(将来、明星以外の護符がこの値を参照する可能性を考慮し、また明星を後から拾った場合にも過去の成立回数の記録として自然に機能するため)。

- [ ] **Step 5: テストを実行して成功を確認**

Run: `npm run test -- engine.test.ts`
Expected: PASS

Run: `npm run build`
Expected: 成功

- [ ] **Step 6: コミット**

```bash
git add src/lib/game/shidasu/engine.ts src/lib/game/shidasu/engine.test.ts
git commit -m "$(cat <<'EOF'
feat: Shidasu護符に明星を追加

役の種類ごとのウェーブ内累積成立回数に応じて、役ボーナスの額を
倍率適用するroleBonusMultiplierをplayCardに配線した。
roleOccurrenceCountThisWaveは明星の所持有無に関わらず常に更新する。
EOF
)"
```

---

### Task 7: 水鏡(役ボーナスの遅延複製)

**Files:**
- Modify: `src/lib/game/shidasu/engine.ts`
- Modify: `src/lib/game/shidasu/engine.test.ts`

- [ ] **Step 1: 失敗するテストを書く**

`src/lib/game/shidasu/engine.test.ts`の`describe('playCard', ...)`ブロックの末尾に追加:

```ts
  test('水鏡: 役が成立すると次のプレイへ同じ役ボーナスの複製が予約される', () => {
    const wave = baseWave({
      foundation: card(0, '♠', 5),
      chain: [card(20, '♥', 3), card(21, '♦', 4), card(22, '♠', 5)],
      tableau: [[card(1, '♣', 6)], [card(2, '♦', 2)]],
    })
    const next = playCard(DEFAULT_PARAMS, wave, 'none', ['mirror'], 1000000, 0)
    expect(next.pendingRoleEcho).not.toBeNull()
    expect(next.pendingRoleEcho?.name).toBe('flush')
    expect(next.roleEchoUsedThisCombo.flush).toBe(true)
  })

  test('水鏡: 予約された複製は次のプレイで無条件に上乗せされる', () => {
    const wave = baseWave({
      tableau: [[card(9, '♠', 1), card(1, '♣', 6)], [card(2, '♦', 2)]],
      pendingRoleEcho: { name: 'flush', amount: 999 },
    })
    const next = playCard(DEFAULT_PARAMS, wave, 'none', ['mirror'], 1000000, 0)
    expect(next.score).toBeGreaterThanOrEqual(999)
    expect(next.pendingRoleEcho).toBeNull()
  })

  test('水鏡: 同じ役はコンボ中1回しか予約されない', () => {
    const wave = baseWave({
      foundation: card(0, '♠', 5),
      chain: [card(20, '♥', 3), card(21, '♦', 4), card(22, '♠', 5)],
      tableau: [[card(1, '♣', 6)], [card(2, '♦', 2)]],
      roleEchoUsedThisCombo: { flush: true },
    })
    const next = playCard(DEFAULT_PARAMS, wave, 'none', ['mirror'], 1000000, 0)
    expect(next.pendingRoleEcho).toBeNull()
  })
```

- [ ] **Step 2: テストを実行して失敗を確認**

Run: `npm run test -- engine.test.ts`
Expected: FAIL

- [ ] **Step 3: `playCard`に水鏡の遅延複製の適用と予約処理を追加**

`src/lib/game/shidasu/engine.ts`の`playCard`関数内、以下の行:

```ts
  const newCombo = wave.combo + (items.includes('golden') ? 2 : 1)
  let base = params.scoring.basePoint
  const parts = [`基礎点+${base}`]
```

を以下に置き換える(水鏡の複製上乗せを追加):

```ts
  const newCombo = wave.combo + (items.includes('golden') ? 2 : 1)
  let base = params.scoring.basePoint
  const parts = [`基礎点+${base}`]

  // 水鏡: 前のプレイで予約された役ボーナスの遅延複製を無条件で上乗せする
  if (items.includes('mirror') && wave.pendingRoleEcho) {
    base += wave.pendingRoleEcho.amount
    parts.push(`水鏡(${wave.pendingRoleEcho.name})+${wave.pendingRoleEcho.amount}`)
  }
```

続けて、列一掃ボーナスの`roleFired`確定直後(Task 6で編集した`roleFired.push({ name: 'columnSweep', ... })`を含むブロックの直後)に、以下のブロックを追加する:

```ts

  // 水鏡: 今回成立した役のうち、まだ今コンボで遅延複製を予約していないものを1つだけ、次のプレイへ予約する。
  // 優先順位はroleFiredの出現順(flush→royalSet→sameRank→completeRun→columnSweepの判定順)。
  let newPendingRoleEcho: WaveState['pendingRoleEcho'] = null
  let newRoleEchoUsedThisCombo = wave.roleEchoUsedThisCombo
  let newSameRankEchoUsedThisCombo = wave.sameRankEchoUsedThisCombo
  if (items.includes('mirror')) {
    for (const fired of roleFired) {
      if (fired.name === 'sameRank') {
        // sameRankは枚数段階(sameRankCount)ごとに個別カウントする必要があるため、
        // evaluateChainBonus内部と同じ関数で再計算する(既存のエクスポート済みヘルパーを再利用)。
        const sameRankCount = card.wild ? countSameRankForWildPlay(wave.chain) : countSameRankBefore(wave.chain, card.rank)
        if (!wave.sameRankEchoUsedThisCombo.includes(sameRankCount)) {
          newPendingRoleEcho = { name: 'sameRank', amount: fired.amount }
          newSameRankEchoUsedThisCombo = [...wave.sameRankEchoUsedThisCombo, sameRankCount]
          break
        }
      } else if (!wave.roleEchoUsedThisCombo[fired.name]) {
        newPendingRoleEcho = { name: fired.name, amount: fired.amount }
        newRoleEchoUsedThisCombo = { ...wave.roleEchoUsedThisCombo, [fired.name]: true }
        break
      }
    }
  }
```

続けて、`next: WaveState`オブジェクト定義内、Task 6で追加した`roleOccurrenceCountThisWave: newRoleOccurrenceCountThisWave,`の直後に追加:

```ts
    pendingRoleEcho: newPendingRoleEcho,
    roleEchoUsedThisCombo: newRoleEchoUsedThisCombo,
    sameRankEchoUsedThisCombo: newSameRankEchoUsedThisCombo,
```

- [ ] **Step 4: テストを実行して成功を確認**

Run: `npm run test -- engine.test.ts`
Expected: PASS

Run: `npm run build`
Expected: 成功

- [ ] **Step 5: コミット**

```bash
git add src/lib/game/shidasu/engine.ts src/lib/game/shidasu/engine.test.ts
git commit -m "$(cat <<'EOF'
feat: Shidasu護符に水鏡を追加

役が成立するたび(コンボ中1回、同ランクは枚数段階ごとに1回)、
次のプレイへ同じ役ボーナスの複製を予約するpendingRoleEchoを
playCardに配線した。予約された複製は次のプレイで無条件に上乗せ
される。
EOF
)"
```

---

### Task 8: 慈悲(gained倍算、持続)

**Files:**
- Modify: `src/lib/game/shidasu/engine.ts`
- Modify: `src/lib/game/shidasu/engine.test.ts`

- [ ] **Step 1: 失敗するテストを書く**

`src/lib/game/shidasu/engine.test.ts`の`describe('applyItemEffects (グループ16: 持続効果)', ...)`ブロックの末尾(閉じ`})`の直前)に追加:

```ts

  test('慈悲: mercyActiveNextComboが立っていれば倍算', () => {
    const fired = applyItemEffects('gained', 100, ['mercy'], ctx({ mercyActiveNextCombo: true }), params)
    expect(fired.value).toBe(100 * params.talismans.mercy.x)
    const notFired = applyItemEffects('gained', 100, ['mercy'], ctx({ mercyActiveNextCombo: false }), params)
    expect(notFired.value).toBe(100)
  })
```

(この`describe`ブロックの`ctx()`ヘルパーはTask 2 Step 6で既に`mercyActiveNextCombo: false`のデフォルト値を持つように更新済みのため、そのまま`ctx({ mercyActiveNextCombo: true })`で上書きできる。)

`src/lib/game/shidasu/engine.test.ts`の`describe('drawStock', ...)`ブロックの末尾に追加:

```ts
  test('慈悲: コンボ数がc以下でリセットされるとmercyActiveNextComboがtrueになる', () => {
    const wave = makeWave({
      stock: [card(1, '♣', 9)],
      chain: [card(3, '♥', 5)],
      linked: true,
      combo: DEFAULT_PARAMS.talismans.mercy.c,
    })
    const { wave: next } = drawStock(DEFAULT_PARAMS, wave, ['mercy'], standardDeckComposition())
    expect(next.mercyActiveNextCombo).toBe(true)
  })

  test('慈悲: コンボ数がcより大きい状態でリセットされるとmercyActiveNextComboはfalseになる', () => {
    const wave = makeWave({
      stock: [card(1, '♣', 9)],
      chain: [card(3, '♥', 5)],
      linked: true,
      combo: DEFAULT_PARAMS.talismans.mercy.c + 5,
      mercyActiveNextCombo: true,
    })
    const { wave: next } = drawStock(DEFAULT_PARAMS, wave, ['mercy'], standardDeckComposition())
    expect(next.mercyActiveNextCombo).toBe(false)
  })
```

- [ ] **Step 2: テストを実行して失敗を確認**

Run: `npm run test -- engine.test.ts`
Expected: FAIL(`mercy`が`ITEM_EFFECTS`に未登録。`mercyActiveNextCombo`のリセット処理はTask 5で既に実装済みのため、drawStockのテストはこの時点で既にPASSしているはず)

- [ ] **Step 3: `ITEM_EFFECTS`に慈悲を追加**

`src/lib/game/shidasu/engine.ts`の`ITEM_EFFECTS`オブジェクト内、`intuition`エントリの直後に追加:

```ts
  mercy: {
    channel: 'gained',
    effect: (v, ctx, p) =>
      ctx.mercyActiveNextCombo
        ? { value: v * p.talismans.mercy.x, part: `慈悲×${fmtMultiplier(p.talismans.mercy.x)}` }
        : { value: v, part: null },
  },
```

- [ ] **Step 4: テストを実行して成功を確認**

Run: `npm run test -- engine.test.ts`
Expected: PASS

Run: `npm run build`
Expected: 成功

- [ ] **Step 5: コミット**

```bash
git add src/lib/game/shidasu/engine.ts src/lib/game/shidasu/engine.test.ts
git commit -m "$(cat <<'EOF'
feat: Shidasu護符に慈悲を追加

コンボ数がc以下でリセットされた場合、次のコンボの間、獲得点を
x倍にする。mercyActiveNextComboのリセット処理自体はTask 5で
先行配線済みだったため、本タスクはITEM_EFFECTSへの登録のみ。
EOF
)"
```

---

### Task 9: 刻限(gained加算)

**Files:**
- Modify: `src/lib/game/shidasu/engine.ts`
- Modify: `src/lib/game/shidasu/engine.test.ts`

- [ ] **Step 1: 失敗するテストを書く**

`src/lib/game/shidasu/engine.test.ts`の`describe('applyItemEffects (グループ12: 直感)', ...)`ブロックの直後に追加:

```ts
describe('applyItemEffects (グループ17: 刻限)', () => {
  const params = DEFAULT_PARAMS
  function ctx(overrides: Partial<ItemEffectContext> = {}): ItemEffectContext {
    return {
      card: card(1, '♠', 5),
      previousFoundation: card(2, '♣', 4),
      combo: 1,
      stockRemaining: 0,
      chain: [card(2, '♣', 4), card(1, '♠', 5)],
      remainingTableauCount: 10,
      chainBonus: { bonus: 0, parts: [], patternFired: false, roleFired: [] },
      isFirstPlayOfWave: false,
      effectiveStairMinLen: params.scoring.stairMinLen,
      sameColumnStreak: 1,
      totalColumnsEmptiedThisWave: 0,
      maxComboThisWave: 1,
      flushActiveThisCombo: false,
      columnSweepActiveThisWave: false,
      drawContinueCountThisChain: 0,
      mercyActiveNextCombo: false,
      ...overrides,
    }
  }

  test('刻限: 山札残り枚数×nを加算', () => {
    const notFired = applyItemEffects('gained', 100, ['deadline'], ctx({ stockRemaining: 0 }), params)
    expect(notFired.value).toBe(100)
    const fired = applyItemEffects('gained', 100, ['deadline'], ctx({ stockRemaining: 5 }), params)
    expect(fired.value).toBe(100 + 5 * params.talismans.deadline.n)
  })
})
```

- [ ] **Step 2: テストを実行して失敗を確認**

Run: `npm run test -- engine.test.ts`
Expected: FAIL

- [ ] **Step 3: `ITEM_EFFECTS`に刻限を追加**

`src/lib/game/shidasu/engine.ts`の`ITEM_EFFECTS`オブジェクト内、Task 8で追加した`mercy`エントリの直後に追加:

```ts
  deadline: {
    channel: 'gained',
    effect: (v, ctx, p) => {
      if (ctx.stockRemaining === 0) return { value: v, part: null }
      const add = ctx.stockRemaining * p.talismans.deadline.n
      return { value: v + add, part: `刻限+${add}` }
    },
  },
```

- [ ] **Step 4: テストを実行して成功を確認**

Run: `npm run test -- engine.test.ts`
Expected: PASS

Run: `npm run build`
Expected: 成功

- [ ] **Step 5: コミット**

```bash
git add src/lib/game/shidasu/engine.ts src/lib/game/shidasu/engine.test.ts
git commit -m "$(cat <<'EOF'
feat: Shidasu護符に刻限を追加

カードを取るたび、山札の残り枚数×n点を加算する(通常のgained
チャンネル、コンボ倍率の影響を受ける)。
EOF
)"
```

---

### Task 10: ITEM_POOLの拡張とテスト更新

**Files:**
- Modify: `src/lib/game/shidasu/engine.ts`
- Modify: `src/lib/game/shidasu/engine.test.ts`

- [ ] **Step 1: 失敗するテストを更新・追加する**

`src/lib/game/shidasu/engine.test.ts`の`describe('ITEM_POOL / ITEM_NAMES / itemDesc', ...)`ブロック内、以下の箇所を書き換える:

既存:
```ts
  test('79種類のアイテムが定義されている', () => {
    expect(ITEM_POOL).toHaveLength(79)
    expect(new Set(ITEM_POOL).size).toBe(79) // 重複なし
    ITEM_POOL.forEach(id => expect(ITEM_NAMES[id]).toBeTruthy())
  })
```

置き換え後:
```ts
  test('87種類のアイテムが定義されている', () => {
    expect(ITEM_POOL).toHaveLength(87)
    expect(new Set(ITEM_POOL).size).toBe(87) // 重複なし
    ITEM_POOL.forEach(id => expect(ITEM_NAMES[id]).toBeTruthy())
  })
```

同ブロック内の末尾に追加:

```ts
  test('グループ17の8個も名前と説明文を持つ', () => {
    const newIds: ItemId[] = [
      'sanctify', 'protection', 'earth', 'golden',
      'morningStar', 'mercy', 'mirror', 'deadline',
    ]
    expect(newIds).toHaveLength(8)
    newIds.forEach(id => {
      expect(ITEM_NAMES[id]).toBeTruthy()
      expect(itemDesc(id, DEFAULT_PARAMS)).toBeTruthy()
    })
  })
```

- [ ] **Step 2: テストを実行して失敗を確認**

Run: `npm run test -- engine.test.ts`
Expected: FAIL

- [ ] **Step 3: `ITEM_POOL`に8個追加**

`src/lib/game/shidasu/engine.ts`の`ITEM_POOL`定義の末尾(`'passion', 'fightingSpirit',`の直後、閉じ`]`の直前)に追加:

```ts
  'sanctify', 'protection', 'earth', 'golden',
  'morningStar', 'mercy', 'mirror', 'deadline',
```

- [ ] **Step 4: テストを実行して成功を確認**

Run: `npm run test -- engine.test.ts`
Expected: PASS

Run: `npm run build`
Expected: 成功

- [ ] **Step 5: コミット**

```bash
git add src/lib/game/shidasu/engine.ts src/lib/game/shidasu/engine.test.ts
git commit -m "$(cat <<'EOF'
feat: ITEM_POOLにグループ17の8個を追加(全87種類に)
EOF
)"
```

---

### Task 11: 管理画面パラメータ入力欄

**Files:**
- Modify: `src/routes/admin/shidasu/+page.svelte`

- [ ] **Step 1: 実際のファイルを読み、既存の「護符パラメータ(グループ9〜16)」セクションの位置を確認する**

`grep -n "護符パラメータ(グループ9〜16)\|フロー・UI" src/routes/admin/shidasu/+page.svelte`を実行し、「護符パラメータ(グループ9〜16)」セクションの`</section>`と、その直後の「フロー・UI」セクションの開始位置を特定する。

- [ ] **Step 2: グループ17のパラメータ入力欄を追加**

「護符パラメータ(グループ9〜16)」セクションの`</section>`の直後、「フロー・UI」セクションの直前に、以下の新セクションを追加する:

```svelte
      <section class="bg-white border border-slate-200 rounded-xl p-4">
        <h2 class="font-semibold text-slate-700 text-sm mb-3">護符パラメータ(グループ17)</h2>
        <div class="grid grid-cols-2 gap-3">
          <label class="text-xs text-slate-500">
            庇護: コンボ数(計算用)の下駄(protection.c)
            <input type="number" min="1" step="1" bind:value={config.talismans.protection.c} class="mt-1 w-full border border-slate-200 rounded px-2 py-1 text-sm" />
          </label>
          <label class="text-xs text-slate-500">
            大地: コンボ数(計算用)への常時加算(earth.c)
            <input type="number" min="0" step="1" bind:value={config.talismans.earth.c} class="mt-1 w-full border border-slate-200 rounded px-2 py-1 text-sm" />
          </label>
          <label class="text-xs text-slate-500">
            明星: 役成立回数あたり倍率(morningStar.x)
            <input type="number" min="0" step="0.05" bind:value={config.talismans.morningStar.x} class="mt-1 w-full border border-slate-200 rounded px-2 py-1 text-sm" />
          </label>
          <label class="text-xs text-slate-500">
            慈悲: 救済対象のコンボ数上限(mercy.c)
            <input type="number" min="0" step="1" bind:value={config.talismans.mercy.c} class="mt-1 w-full border border-slate-200 rounded px-2 py-1 text-sm" />
          </label>
          <label class="text-xs text-slate-500">
            慈悲: 次のコンボの倍率(mercy.x)
            <input type="number" min="0" step="0.1" bind:value={config.talismans.mercy.x} class="mt-1 w-full border border-slate-200 rounded px-2 py-1 text-sm" />
          </label>
          <label class="text-xs text-slate-500">
            刻限: 山札残数あたり加算(deadline.n)
            <input type="number" min="0" step="1" bind:value={config.talismans.deadline.n} class="mt-1 w-full border border-slate-200 rounded px-2 py-1 text-sm" />
          </label>
        </div>
      </section>
```

祝福・黄金・水鏡はパラメータを持たない(`Record<string, never>`型)ため入力欄は不要。既存の「護符パラメータ(グループ9〜16)」セクション等と同じHTML構造・Tailwindクラス・`config.talismans.xxx`という束縛パターンを踏襲すること(実際のファイルを読んで確認する)。

- [ ] **Step 3: ビルドが通ることを確認**

Run: `npm run build`
Expected: 型エラーなく成功

- [ ] **Step 4: 開発サーバーで表示を確認**

以下の手順で確認する:
1. `netstat -ano | grep ":5173"`で既存の`npm run dev`プロセスが残っていないか確認し、あれば終了させる
2. `npm run dev`をバックグラウンドで起動
3. Playwright等で`http://localhost:5173/admin/shidasu`にアクセスし、「護符パラメータ(グループ17)」セクションが表示されることを確認する。一時スクリプトはスクラッチパッドディレクトリに作成し、確認後は削除する
4. 確認後、`npm run dev`のプロセスを終了させる

- [ ] **Step 5: コミット**

```bash
git add src/routes/admin/shidasu/+page.svelte
git commit -m "$(cat <<'EOF'
feat: 管理画面にグループ17護符のパラメータ入力欄を追加
EOF
)"
```

---

### Task 12: 最終検証とドキュメント更新

**Files:**
- Modify: `docs/shidasu-gofu-candidates.md`
- Test: 全体テストスイート・ビルド・ブラウザ動作確認

- [ ] **Step 1: 全体テストスイートを実行**

Run: `npm run test`
Expected: 全テストPASS

- [ ] **Step 2: ビルドと型チェックを実行**

Run: `npm run build`
Expected: 成功

Run: `npm run check`
Expected: shidasu関連の型エラーが0件であることを確認する(他の無関係なファイルの既存エラーは無視してよい)

- [ ] **Step 3: `docs/shidasu-gofu-candidates.md`にグループ17の実装済みマークを追加**

`### グループ17: コアパラメータ書き換え・持ち越し系の内部干渉(8個)`という見出しの末尾に`【実装済み: 2026-07-15】`(今日の日付)を追記する。既存の見出し文言・個数表記は変更せず、末尾に追記するだけにすること。グループ18・グループ19はスコープ外のため変更しない。

- [ ] **Step 4: 開発サーバーでブラウザ動作確認**

以下の手順で確認する:
1. 既存の`npm run dev`プロセスが残っていないか確認し、あれば終了させる
2. `npm run dev`をバックグラウンドで起動
3. Playwrightで`http://localhost:5173/game/shidasu`にアクセスし、「はじめる」でゲームを開始し、通常のプレイフロー(カードのプレイ・山札めくりを複数回)がエラー無く動作することを確認する。コンソールエラーが発生していないことも確認する
4. `http://localhost:5173/admin/shidasu`にもアクセスし、ページ全体がエラーなく表示されることを確認する
5. 確認後、`npm run dev`のプロセスを終了させる

- [ ] **Step 5: コミット**

```bash
git add docs/shidasu-gofu-candidates.md
git commit -m "$(cat <<'EOF'
docs: Shidasu護符候補一覧のグループ17に実装済みマークを追加
EOF
)"
```

---

## 完了条件(specの受け入れ基準との対応)

1. 庇護・大地は所持順で一時comboに順に作用し、大地→庇護の順で庇護が不発化するケースがテストで再現できる → Task 4
2. 黄金を持つとコンボが+2ずつ進み、他の護符の効果には影響しない → Task 3
3. 祝福は役成立のたび基礎コンボ数が増え、コンボリセット時にその値から再開する → Task 5
4. 明星は役の種類ごとのウェーブ内累積成立回数に応じて、その役の基礎ボーナス額が倍率適用される → Task 6
5. 慈悲はコンボ数c以下でのリセット後、次のコンボの間だけ倍率xが適用される → Task 8
6. 水鏡は役の種類ごと(同ランクは枚数段階ごと)にコンボ内1回だけ、次のプレイへ役ボーナスを遅延複製する → Task 7
7. 刻限は山札残り枚数に応じてプレイ時に加算される(コンボ倍率の影響を受ける) → Task 9
8. `npm run test`・`npm run build`が成功する → Task 12
