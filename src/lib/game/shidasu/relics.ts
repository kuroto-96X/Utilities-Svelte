// src/lib/game/shidasu/relics.ts
import type { RelicId, RunState, WaveState } from './types'
import type { ShidasuParams } from './params'

// レリックの抽選プール。第1弾13候補。
export const RELIC_POOL: RelicId[] = [
  'manekiNeko', 'fukuDaruma', 'kumade', 'juzu',
  'manekiHoteizo', 'hamaya', 'senbazuru', 'fukuzasa',
  'kaiunKokeshi', 'engiKozuchi', 'engiSuzu', 'senjafuda', 'soroban',
]

export function relicName(id: RelicId, params: ShidasuParams): string {
  return params.relics[id].name
}

function relicPlaceholderContext(id: RelicId, params: ShidasuParams): Record<string, number> {
  const entry = params.relics[id] as unknown as Record<string, unknown>
  const context: Record<string, number> = {}
  for (const [key, value] of Object.entries(entry)) {
    if (typeof value === 'number') context[key] = value
  }
  return context
}

export function relicDesc(id: RelicId, params: ShidasuParams): string {
  const entry = params.relics[id] as unknown as Record<string, unknown> & { desc: string }
  const context = relicPlaceholderContext(id, params)
  return entry.desc.replace(/\{(\w+)\}/g, (match, key) => (key in context ? String(context[key]) : match))
}

export function relicTsukumokaDesc(id: RelicId, params: ShidasuParams): string {
  const entry = params.relics[id] as unknown as Record<string, unknown> & { tsukumokaDesc: string }
  const context = relicPlaceholderContext(id, params)
  return entry.tsukumokaDesc.replace(/\{(\w+)\}/g, (match, key) => (key in context ? String(context[key]) : match))
}

// 招き猫所持時のショップ購入価格倍率。所持していなければ1(無変化)。
// 端数はMath.roundで各価格関数側が丸める(このヘルパー自体は丸めない)。
export function relicPriceMultiplier(params: ShidasuParams, run: RunState): number {
  const relic = run.relics.find(r => r.id === 'manekiNeko')
  if (!relic) return 1
  const percent = relic.tsukumoka ? params.relics.manekiNeko.tsukumokaDiscountPercent : params.relics.manekiNeko.discountPercent
  return (100 - percent) / 100
}

// 開運こけし所持時の売却価格倍率。所持していなければ1(無変化)。
export function relicSellBonusMultiplier(params: ShidasuParams, run: RunState): number {
  const relic = run.relics.find(r => r.id === 'kaiunKokeshi')
  if (!relic) return 1
  const percent = relic.tsukumoka ? params.relics.kaiunKokeshi.tsukumokaSellBonusPercent : params.relics.kaiunKokeshi.sellBonusPercent
  return (100 + percent) / 100
}

function relicBonus(run: RunState, id: RelicId, n: number, tsukumokaN: number): number {
  const relic = run.relics.find(r => r.id === id)
  if (!relic) return 0
  return relic.tsukumoka ? n + tsukumokaN : n
}

// 護符の所持上限。招き布袋像所持時はn(付喪化ならさらにtsukumokaN)を加算する。
export function itemMaxCapacity(params: ShidasuParams, run: RunState): number {
  const r = params.relics.manekiHoteizo
  return params.items.maxItems + relicBonus(run, 'manekiHoteizo', r.n, r.tsukumokaN)
}

// 秘儀の所持上限(基本値3)。破魔矢所持時はn(付喪化ならさらにtsukumokaN)を加算する。
export function riteMaxCapacity(params: ShidasuParams, run: RunState): number {
  const r = params.relics.hamaya
  return 3 + relicBonus(run, 'hamaya', r.n, r.tsukumokaN)
}

// 天啓・神託合算の所持上限(基本値2)。千羽鶴所持時はn(付喪化ならさらにtsukumokaN)を加算する。
export function revelationOracleMaxCapacity(params: ShidasuParams, run: RunState): number {
  const r = params.relics.senbazuru
  return 2 + relicBonus(run, 'senbazuru', r.n, r.tsukumokaN)
}

// 数珠所持時のWaveクリア追加報酬。floor(そのWaveでの最大コンボ数/5)×n(付喪化ならtsukumokaN)。
function juzuBonus(params: ShidasuParams, run: RunState, wave: WaveState): number {
  const relic = run.relics.find(r => r.id === 'juzu')
  if (!relic) return 0
  const n = relic.tsukumoka ? params.relics.juzu.tsukumokaN : params.relics.juzu.n
  return Math.floor(wave.maxComboThisWave / 5) * n
}

// 千社札所持時のWaveクリア追加報酬。floor(そのWaveで成立した役の種類数/2)×n(付喪化でn=2に強化)。
function senjafudaBonus(params: ShidasuParams, run: RunState, wave: WaveState): number {
  const relic = run.relics.find(r => r.id === 'senjafuda')
  if (!relic) return 0
  const roleTypeCount = Object.values(wave.roleOccurrenceCountThisWave).filter(count => (count ?? 0) > 0).length
  const n = relic.tsukumoka ? 2 : params.relics.senjafuda.n
  return Math.floor(roleTypeCount / 2) * n
}

// 算盤所持時のWaveクリア追加報酬。floor(((c-b-a)/(c-b))×n)(付喪化でn=10に強化)。
// a=クリア時点の山札残り枚数, b=場札の初期配布枚数, c=デッキ総枚数(除外カードを除く)。
function sorobanBonus(params: ShidasuParams, run: RunState, wave: WaveState): number {
  const relic = run.relics.find(r => r.id === 'soroban')
  if (!relic) return 0
  const a = wave.stock.length
  const b = wave.dealtRows * params.layout.cols
  const c = run.deckComposition.filter(card => !card.removed).length
  const denominator = c - b
  if (denominator <= 0) return 0
  const n = relic.tsukumoka ? 10 : params.relics.soroban.n
  return Math.floor(((c - b - a) / denominator) * n)
}

// Waveクリア時の追加報酬(数珠・千社札・算盤)。所持していないレリックの項は0として扱う。
// baseReward(星のreward)自体はこの関数の戻り値に含まない(呼び出し元resolveWaveEndで別途加算する)。
export function relicWaveEndBonus(params: ShidasuParams, run: RunState, wave: WaveState, _baseReward: number): number {
  return juzuBonus(params, run, wave) + senjafudaBonus(params, run, wave) + sorobanBonus(params, run, wave)
}

// バラ売り枠の総数(基本値3)。熊手所持でn、福笹(付喪化)所持でさらにn。
// 熊手・福笹は同時所持もありうるため両方の加算を合算する。
export function individualSlotCount(params: ShidasuParams, run: RunState): number {
  let count = 3
  const kumadeRelic = run.relics.find(r => r.id === 'kumade')
  if (kumadeRelic) count += params.relics.kumade.n
  const fukuzasaRelic = run.relics.find(r => r.id === 'fukuzasa')
  if (fukuzasaRelic?.tsukumoka) count += params.relics.fukuzasa.n
  return count
}

// 福袋枠の総数(基本値2)。福笹所持でn、熊手(付喪化)所持でさらにn。
export function packSlotCount(params: ShidasuParams, run: RunState): number {
  let count = 2
  const fukuzasaRelic = run.relics.find(r => r.id === 'fukuzasa')
  if (fukuzasaRelic) count += params.relics.fukuzasa.n
  const kumadeRelic = run.relics.find(r => r.id === 'kumade')
  if (kumadeRelic?.tsukumoka) count += params.relics.kumade.n
  return count
}

// 福袋の選択肢数(offerCount)への加算値。縁起小槌所持時n(付喪化ならさらにtsukumokaN)。
export function packOfferCountBonus(params: ShidasuParams, run: RunState): number {
  const r = params.relics.engiKozuchi
  return relicBonus(run, 'engiKozuchi', r.n, r.tsukumokaN)
}

// レリック専用枠の提示数(基本1枠)。縁起鈴所持時n(付喪化ならさらにtsukumokaN)を加算する。
export function relicSlotCount(params: ShidasuParams, run: RunState): number {
  const r = params.relics.engiSuzu
  return 1 + relicBonus(run, 'engiSuzu', r.n, r.tsukumokaN)
}

// ショップリロールコストの刻み幅。福だるま所持時、params.shop.rerollCostStepからnを減らす(0未満にはしない)。
export function relicRerollCostStep(params: ShidasuParams, run: RunState): number {
  const relic = run.relics.find(r => r.id === 'fukuDaruma')
  if (!relic) return params.shop.rerollCostStep
  return Math.max(0, params.shop.rerollCostStep - params.relics.fukuDaruma.n)
}

// 福だるま(付喪化)所持時、同一ショップ訪問中の最初の1回のリロールが無料になるか。
export function relicFirstRerollFree(run: RunState): boolean {
  const relic = run.relics.find(r => r.id === 'fukuDaruma')
  return relic?.tsukumoka ?? false
}
