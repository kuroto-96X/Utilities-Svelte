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

export function relicDesc(id: RelicId, params: ShidasuParams): string {
  return params.relics[id].desc
}

export function relicTsukumokaDesc(id: RelicId, params: ShidasuParams): string {
  return params.relics[id].tsukumokaDesc
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

// Waveクリア時の追加報酬(数珠・千社札・算盤)。所持していないレリックの項は0として扱う。
// baseReward(星のreward)自体はこの関数の戻り値に含まない(呼び出し元resolveWaveEndで別途加算する)。
export function relicWaveEndBonus(params: ShidasuParams, run: RunState, wave: WaveState, _baseReward: number): number {
  let bonus = 0

  const juzuRelic = run.relics.find(r => r.id === 'juzu')
  if (juzuRelic) {
    const n = juzuRelic.tsukumoka ? params.relics.juzu.tsukumokaN : params.relics.juzu.n
    bonus += Math.floor(wave.maxComboThisWave / 5) * n
  }

  const senjafudaRelic = run.relics.find(r => r.id === 'senjafuda')
  if (senjafudaRelic) {
    const roleTypeCount = Object.values(wave.roleOccurrenceCountThisWave).filter(count => (count ?? 0) > 0).length
    const n = senjafudaRelic.tsukumoka ? 2 : params.relics.senjafuda.n
    bonus += Math.floor(roleTypeCount / 2) * n
  }

  const sorobanRelic = run.relics.find(r => r.id === 'soroban')
  if (sorobanRelic) {
    const a = wave.stock.length
    const b = wave.dealtRows * params.layout.cols
    const c = run.deckComposition.filter(card => !card.removed).length
    const denominator = c - b
    if (denominator > 0) {
      const n = sorobanRelic.tsukumoka ? 10 : params.relics.soroban.n
      bonus += Math.floor(((c - b - a) / denominator) * n)
    }
  }

  return bonus
}
