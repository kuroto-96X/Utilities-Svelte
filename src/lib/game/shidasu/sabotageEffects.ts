// src/lib/game/shidasu/sabotageEffects.ts
import type { SabotageActionId, WaveState, RunState, Card, HeldRevelationOrOracleRef, RiteId, RevelationId, RelicId, RoleName } from './types'
import type { ShidasuParams } from './params'
import { shuffleInPlace, rollOffer } from './deck'
import { ORACLE_POOL } from './oracles'
import { canUseRite } from './riteEffects'
import { canUseRevelation, revelationNeedsTarget } from './revelationEffects'
import { resetComboFields } from './waveReset'

export interface SabotageContext {
  params: ShidasuParams
  run: RunState
  wave: WaveState
  rand: () => number
  // riteForceActivate・revelationOracleForceActivate用。engine.tsに定義されているが、
  // sabotageEffects.tsからengine.tsを直接importすると循環importになるため、
  // 呼び出し元(triggerSabotage)から値として注入する。
  useRite: (params: ShidasuParams, run: RunState, riteId: RiteId, rand?: () => number) => RunState
  useRevelation: (
    params: ShidasuParams, run: RunState, revelationId: RevelationId,
    targetCol: number | null, rand?: () => number, targetRelicId?: RelicId | null
  ) => RunState
  useOracle: (params: ShidasuParams, run: RunState, roleName: RoleName) => RunState
}

// wave・runへの差分(部分更新)。両方ともoptional(片方だけ、あるいはどちらも変更しない場合はキー自体を省略する)
export interface SabotageResult {
  wave?: Partial<WaveState>
  run?: Partial<RunState>
}

function applyStockPurge({ wave }: SabotageContext): SabotageResult {
  const n = Math.min(5, wave.stock.length)
  const purged = wave.stock.slice(wave.stock.length - n)
  return { wave: { stock: wave.stock.slice(0, wave.stock.length - n), discardPile: [...wave.discardPile, ...purged] } }
}

function applyColumnReturn({ wave, rand }: SabotageContext): SabotageResult {
  const colIndex = Math.floor(rand() * wave.tableau.length)
  const col = wave.tableau[colIndex]
  const pool = [...wave.stock, ...col]
  shuffleInPlace(pool, rand)
  const newCol = pool.slice(0, col.length)
  const newStock = pool.slice(col.length)
  const tableau = wave.tableau.map((c, i) => (i === colIndex ? newCol : c))
  return { wave: { tableau, stock: newStock } }
}

// chainSettle: 既存のtriggerSabotageは`nextWave`(activeSeal既にnullリセット済み)を起点に
// resetComboFieldsを呼んでいたが、この関数は`wave`(リセット前、活性のactiveSealを保持している
// 可能性がある)を受け取る。resetComboFieldsは`...wave`をスプレッドするため、そのままだと古い
// activeSealが結果へ紛れ込む。明示的に`activeSeal: null`で上書きすることで、triggerSabotage側の
// ベース(resetWave)に依存せず、この関数単体で正しい結果を返せるようにする。
function applyChainSettle({ params, wave, rand }: SabotageContext): SabotageResult {
  if (wave.stock.length === 0) {
    return { wave: { ...resetComboFields(wave, params), activeSeal: null } }
  }
  const stock = [...wave.stock]
  const drawn = stock.pop() as Card
  return { wave: { ...resetComboFields(wave, params, drawn, 'draw'), activeSeal: null, stock } }
}

function applyComboBreather(_ctx: SabotageContext): SabotageResult {
  return { wave: { combo: 0 } }
}

function applyTalismanSeal({ run, rand }: SabotageContext): SabotageResult {
  if (run.items.length === 0) return {}
  const target = run.items[Math.floor(rand() * run.items.length)]
  return { wave: { activeSeal: { kind: 'talisman', id: target } } }
}

function applyRiteSeal({ run, rand }: SabotageContext): SabotageResult {
  if (run.rites.length === 0) return {}
  const target = run.rites[Math.floor(rand() * run.rites.length)]
  return { wave: { activeSeal: { kind: 'rite', id: target } } }
}

function applyRevelationOracleSeal({ run, rand }: SabotageContext): SabotageResult {
  const pool: HeldRevelationOrOracleRef[] = [
    ...run.revelations.map(refId => ({ kind: 'revelation' as const, id: refId })),
    ...run.oracles.map(refId => ({ kind: 'oracle' as const, id: refId })),
  ]
  if (pool.length === 0) return {}
  const ref = pool[Math.floor(rand() * pool.length)]
  return { wave: { activeSeal: { kind: 'revelationOrOracle', ref } } }
}

function applyRelicConfiscate({ run, rand }: SabotageContext): SabotageResult {
  if (run.relics.length === 0) return {}
  const idx = Math.floor(rand() * run.relics.length)
  return { run: { relics: [...run.relics.slice(0, idx), ...run.relics.slice(idx + 1)] } }
}

function applyTableauCardToDiscard({ wave, rand }: SabotageContext): SabotageResult {
  const positions: { ci: number; ri: number }[] = []
  wave.tableau.forEach((col, ci) => col.forEach((_c, ri) => positions.push({ ci, ri })))
  if (positions.length === 0) return {}
  const pick = positions[Math.floor(rand() * positions.length)]
  const card = wave.tableau[pick.ci][pick.ri]
  const tableau = wave.tableau.map((col, ci) => (ci === pick.ci ? [...col.slice(0, pick.ri), ...col.slice(pick.ri + 1)] : col))
  return { wave: { tableau, discardPile: [...wave.discardPile, card] } }
}

function applyCurrencyConfiscate({ run }: SabotageContext): SabotageResult {
  return { run: { currency: Math.max(0, run.currency - 5) } }
}

function applyRoleSeal({ rand }: SabotageContext): SabotageResult {
  const names = rollOffer(ORACLE_POOL, 2, rand)
  return { wave: { activeSeal: { kind: 'role', names } } }
}

function applyStockPurgeSmall({ wave }: SabotageContext): SabotageResult {
  const n = Math.min(2, wave.stock.length)
  const purged = wave.stock.slice(wave.stock.length - n)
  return { wave: { stock: wave.stock.slice(0, wave.stock.length - n), discardPile: [...wave.discardPile, ...purged] } }
}

function applyStockShuffle({ wave, rand }: SabotageContext): SabotageResult {
  const stock = [...wave.stock]
  shuffleInPlace(stock, rand)
  return { wave: { stock } }
}

function applyTableauFullReturn({ wave, rand }: SabotageContext): SabotageResult {
  const counts = wave.tableau.map(col => col.length)
  const pool = [...wave.stock, ...wave.tableau.flat()]
  shuffleInPlace(pool, rand)
  let cursor = 0
  const tableau = counts.map(n => {
    const slice = pool.slice(cursor, cursor + n)
    cursor += n
    return slice
  })
  return { wave: { tableau, stock: pool.slice(cursor) } }
}

function applyTableauShuffle({ wave, rand }: SabotageContext): SabotageResult {
  const counts = wave.tableau.map(col => col.length)
  const pool = wave.tableau.flat()
  shuffleInPlace(pool, rand)
  let cursor = 0
  const tableau = counts.map(n => {
    const slice = pool.slice(cursor, cursor + n)
    cursor += n
    return slice
  })
  return { wave: { tableau } }
}

function applyChainPartialDiscard({ wave }: SabotageContext): SabotageResult {
  const removeCount = Math.min(2, Math.max(0, wave.chain.length - 1))
  const removed = wave.chain.slice(0, removeCount)
  return {
    wave: {
      chain: wave.chain.slice(removeCount),
      chainOrigin: wave.chainOrigin.slice(removeCount),
      discardPile: [...wave.discardPile, ...removed],
    },
  }
}

function applyComboReduce({ wave }: SabotageContext): SabotageResult {
  return { wave: { combo: Math.max(0, wave.combo - 3) } }
}

function applyTalismanConfiscate({ run, rand }: SabotageContext): SabotageResult {
  if (run.items.length === 0) return {}
  const idx = Math.floor(rand() * run.items.length)
  return { run: { items: [...run.items.slice(0, idx), ...run.items.slice(idx + 1)] } }
}

function applyRiteConfiscate({ run, rand }: SabotageContext): SabotageResult {
  if (run.rites.length === 0) return {}
  const idx = Math.floor(rand() * run.rites.length)
  return { run: { rites: [...run.rites.slice(0, idx), ...run.rites.slice(idx + 1)] } }
}

function applyChainShuffle({ wave, rand }: SabotageContext): SabotageResult {
  const indices = wave.chain.map((_c, i) => i)
  shuffleInPlace(indices, rand)
  const chain = indices.map(i => wave.chain[i])
  const chainOrigin = indices.map(i => wave.chainOrigin[i])
  return { wave: { chain, chainOrigin, foundation: chain[chain.length - 1] } }
}

function applyComboCap({ wave }: SabotageContext): SabotageResult {
  return { wave: { activeSeal: { kind: 'comboCap', max: wave.combo } } }
}

// useRiteが返す完全なRunStateには変更後のwaveも含まれる(果断・星霜の加算・recentUsedRiteIds
// の更新も含めて、通常の秘儀使用と全く同じ処理をそのまま適用する)。useRiteはwave.activeSealを
// 引き継いだままの`wave`をベースに効果を適用するため、返ってきたwaveのactiveSealを明示的に
// nullで上書きする(riteForceActivateは常に封印を残さない、既存のtriggerSabotage全体の設計と同じ理由)。
// runにはused(useRiteが返す完全なRunState)をそのまま渡す。used.waveはtriggerSabotage側の
// 合成処理で最終的にnextWaveに上書きされるため無害。
function applyRiteForceActivate({ params, run, wave, rand, useRite }: SabotageContext): SabotageResult {
  const usable = run.rites.filter(riteId => canUseRite(params, wave, riteId))
  if (usable.length === 0) return {}
  const target = usable[Math.floor(rand() * usable.length)]
  const used = useRite(params, run, target, rand)
  return { wave: { ...used.wave!, activeSeal: null }, run: used }
}

function applyTalismanShuffle({ run, rand }: SabotageContext): SabotageResult {
  const items = [...run.items]
  shuffleInPlace(items, rand)
  return { run: { items }, wave: { activeSeal: { kind: 'talismanHidden' } } }
}

function applyRevelationOracleConfiscate({ run, rand }: SabotageContext): SabotageResult {
  const pool: HeldRevelationOrOracleRef[] = [
    ...run.revelations.map(id => ({ kind: 'revelation' as const, id })),
    ...run.oracles.map(id => ({ kind: 'oracle' as const, id })),
  ]
  if (pool.length === 0) return {}
  const ref = pool[Math.floor(rand() * pool.length)]
  if (ref.kind === 'revelation') {
    const idx = run.revelations.indexOf(ref.id)
    return { run: { revelations: [...run.revelations.slice(0, idx), ...run.revelations.slice(idx + 1)] } }
  }
  // 神託を没収してもoracleLevelsは変更しない: run.oraclesに温存中の神託はまだuseOracleで
  // 消費していないためoracleLevelsに未反映であり、没収してもそこに減らすべき実績が無い
  const idx = run.oracles.indexOf(ref.id)
  return { run: { oracles: [...run.oracles.slice(0, idx), ...run.oracles.slice(idx + 1)] } }
}

// useRevelation/useOracleが返す完全なRunStateをそのままrunへ渡す(applyRiteForceActivateと同じ理由:
// grantRevelationReward等が天啓の種類によって動的に返す報酬フィールドを個別に列挙せずに済む)。
function applyRevelationOracleForceActivate({ params, run, wave, rand, useRevelation, useOracle }: SabotageContext): SabotageResult {
  const usableRevelations = run.revelations.filter(id => canUseRevelation(params, wave, id, run.relics))
  // useOracleはuseRite/useRevelationと違いwave.statusを見ないため、ここで明示的にガードする。
  // (triggerSabotageはwave.status==='ended'になった直後にも呼ばれうる。天啓側はuseRevelation内部の
  // ガードで自然にno-opになるが、神託側だけ無条件に消費されてしまうと非対称な挙動になるため)
  const usableOracles = wave.status === 'playing' ? run.oracles : []
  const pool: HeldRevelationOrOracleRef[] = [
    ...usableRevelations.map(id => ({ kind: 'revelation' as const, id })),
    ...usableOracles.map(id => ({ kind: 'oracle' as const, id })),
  ]
  if (pool.length === 0) return {}
  const ref = pool[Math.floor(rand() * pool.length)]
  if (ref.kind === 'oracle') {
    const used = useOracle(params, run, ref.id)
    return { wave: { ...used.wave!, activeSeal: null }, run: used }
  }
  const targetCol = revelationNeedsTarget(ref.id) ? Math.floor(rand() * wave.tableau.length) : null
  const used = useRevelation(params, run, ref.id, targetCol, rand)
  return { wave: { ...used.wave!, activeSeal: null }, run: used }
}

function applyTsukumokaRelease({ run, rand }: SabotageContext): SabotageResult {
  const tsukumokaRelics = run.relics.filter(r => r.tsukumoka)
  if (tsukumokaRelics.length === 0) return {}
  const target = tsukumokaRelics[Math.floor(rand() * tsukumokaRelics.length)]
  const relics = run.relics.map(r => (r.id === target.id ? { ...r, tsukumoka: false } : r))
  return { run: { relics } }
}

function applyDiscardErase({ wave, rand }: SabotageContext): SabotageResult {
  const chainCount = wave.chain.length
  const pool = [...wave.discardPile, ...wave.chain]
  shuffleInPlace(pool, rand)
  const chain = pool.slice(0, chainCount)
  const discardPile = pool.slice(chainCount)
  const chainOrigin = chain.map(() => 'draw' as const)
  return { wave: { chain, chainOrigin, discardPile, foundation: chain[chain.length - 1] } }
}

function applyDiscardBury({ wave, rand }: SabotageContext): SabotageResult {
  const n = wave.discardPile.length
  const pool = [...wave.stock, ...wave.discardPile]
  shuffleInPlace(pool, rand)
  const discardPile = pool.slice(0, n)
  const stock = pool.slice(n)
  return { wave: { stock, discardPile } }
}

function applyRewardReduce({ run }: SabotageContext): SabotageResult {
  return { run: { rewardPenalty: run.rewardPenalty + 2 } }
}

const SABOTAGE_HANDLERS: Record<SabotageActionId, (ctx: SabotageContext) => SabotageResult> = {
  stockPurge: applyStockPurge,
  columnReturn: applyColumnReturn,
  chainSettle: applyChainSettle,
  comboBreather: applyComboBreather,
  talismanSeal: applyTalismanSeal,
  riteSeal: applyRiteSeal,
  revelationOracleSeal: applyRevelationOracleSeal,
  relicConfiscate: applyRelicConfiscate,
  tableauCardToDiscard: applyTableauCardToDiscard,
  currencyConfiscate: applyCurrencyConfiscate,
  roleSeal: applyRoleSeal,
  stockPurgeSmall: applyStockPurgeSmall,
  stockShuffle: applyStockShuffle,
  tableauFullReturn: applyTableauFullReturn,
  tableauShuffle: applyTableauShuffle,
  chainPartialDiscard: applyChainPartialDiscard,
  chainShuffle: applyChainShuffle,
  comboReduce: applyComboReduce,
  comboCap: applyComboCap,
  talismanConfiscate: applyTalismanConfiscate,
  riteConfiscate: applyRiteConfiscate,
  riteForceActivate: applyRiteForceActivate,
  talismanShuffle: applyTalismanShuffle,
  revelationOracleConfiscate: applyRevelationOracleConfiscate,
  revelationOracleForceActivate: applyRevelationOracleForceActivate,
  tsukumokaRelease: applyTsukumokaRelease,
  discardErase: applyDiscardErase,
  discardBury: applyDiscardBury,
  rewardReduce: applyRewardReduce,
}

export function applySabotageEffect(id: SabotageActionId, ctx: SabotageContext): SabotageResult {
  return SABOTAGE_HANDLERS[id](ctx)
}
