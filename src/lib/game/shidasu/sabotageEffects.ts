// src/lib/game/shidasu/sabotageEffects.ts
import type { SabotageActionId, WaveState, RunState, Card, HeldRevelationOrOracleRef, RiteId, RevelationId, RelicId, RoleName, ItemId } from './types'
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
  useRite: (params: ShidasuParams, run: RunState, instanceId: number, riteId: RiteId, rand?: () => number) => RunState
  useRevelation: (
    params: ShidasuParams, run: RunState, instanceId: number, revelationId: RevelationId,
    targetCol: number | null, rand?: () => number, targetRelicId?: RelicId | null
  ) => RunState
  useOracle: (params: ShidasuParams, run: RunState, roleName: RoleName) => RunState
}

// wave・runへの差分(部分更新)。両方ともoptional(片方だけ、あるいはどちらも変更しない場合はキー自体を省略する)
export interface SabotageResult {
  wave?: Partial<WaveState>
  run?: Partial<RunState>
  // 今回のトリガーで実際に再配布された場札の列インデックス。裏向き配布アニメーション
  // (PlayArea.svelte)が対象列を特定するために使う。wave側のCard.faceUpフラグは
  // 過去の別トリガーで裏向きのまま残っているカードとも区別が付かないため、
  // 「今回触った列」を明示的にここで伝える。tableauFullReturn/columnReturn以外は未設定でよい。
  affectedTableauCols?: number[]
  // 今回「大量放出」「少量放出」で山札から捨て札へ移動した枚数。裏向き移動アニメーション
  // (PlayArea.svelte)が対象枚数を特定するために使う。stockPurge/stockPurgeSmall以外は未設定でよい。
  purgedToDiscardCount?: number
  // 今回「没収系」(talismanConfiscate/riteConfiscate/revelationOracleConfiscate/relicConfiscate)で
  // 完全に失われた対象。没収系は実データ(run.items等)を即座に削除するだけで、activeSealのような
  // 「現在の対象」を保持する仕組みを持たないため、ここで明示的に伝える。idxは配列内の位置
  // (同名の護符・秘儀・レリックを複数所持している場合の一意特定に必要)。
  confiscatedTarget?:
    | { kind: 'talisman'; id: ItemId; idx: number }
    | { kind: 'rite'; id: RiteId; idx: number }
    | { kind: 'revelationOrOracle'; ref: HeldRevelationOrOracleRef; idx: number }
    | { kind: 'relic'; id: RelicId; idx: number }
  // 今回「強制発動系」(riteForceActivate/revelationOracleForceActivate)で即座に使用された対象。
  // 通常のプレイヤークリックと同じ処理(useRite/useRevelation/useOracle)を経由するため、活性化した
  // 対象自体を保持する仕組みが無い。ここで明示的に伝える。
  forceActivatedTarget?:
    | { kind: 'rite'; instanceId: number; id: RiteId }
    | { kind: 'revelationOrOracle'; ref: HeldRevelationOrOracleRef }
  // 今回「数値変化系」(comboBreather/comboReduce/currencyConfiscate/currencyDrain/
  // roleLevelDecay/roleBias/tsukumokaRelease)で変化した対象と内容を明示的に伝える。
  // 上限クランプ(0未満にしないなど)により実際の変化量が固定値と一致しないケースが
  // あるため、各効果関数が実際の変化量を計算して返す。
  numericChangeTarget?:
    | { kind: 'combo'; amount: number }
    | { kind: 'currency'; amount: number }
    | { kind: 'roleLevel'; names: RoleName[]; amount: number }
    | { kind: 'roleBias'; buffed: RoleName[]; nerfed: RoleName[] }
    | { kind: 'tsukumoka'; relicId: RelicId }
  // 今回「tableauCardToDiscard(一枚没収)」で場札から取り除かれたカードの位置。
  // 個別移動アニメーション(PlayArea.svelte)の起点(該当マス目)を特定するために使う。
  tableauCardRemoved?: { colIndex: number; rowIndex: number; card: Card }
  // 今回「discardErase(捨て札消去)」「discardBury(捨て札埋没)」で2エリアをまとめて
  // シャッフル・再分配したことを明示的に伝える。対象エリアの組み合わせによって
  // 収束元・再配布先が異なるため、kindで区別する。
  redistributedAreas?:
    | { kind: 'chainAndDiscard' } // discardErase: 捨て札+チェーン→新チェーン+新捨て札
    | { kind: 'stockAndDiscard' } // discardBury: 山札+捨て札→新捨て札(裏向き)+新山札
}

function applyStockPurge({ wave }: SabotageContext): SabotageResult {
  const n = Math.min(5, wave.stock.length)
  const discardIsHidden = wave.discardPile[wave.discardPile.length - 1]?.faceUp === false
  const purged = wave.stock.slice(wave.stock.length - n).map(c => (discardIsHidden ? { ...c, faceUp: false } : c))
  return { wave: { stock: wave.stock.slice(0, wave.stock.length - n), discardPile: [...wave.discardPile, ...purged] }, purgedToDiscardCount: n }
}

function applyColumnReturn({ wave, rand }: SabotageContext): SabotageResult {
  const colIndex = Math.floor(rand() * wave.tableau.length)
  const col = wave.tableau[colIndex]
  const pool = [...wave.stock, ...col]
  shuffleInPlace(pool, rand)
  const newCol = pool.slice(0, col.length).map(c => ({ ...c, faceUp: false }))
  const newStock = pool.slice(col.length)
  const tableau = wave.tableau.map((c, i) => (i === colIndex ? newCol : c))
  return { wave: { tableau, stock: newStock }, affectedTableauCols: [colIndex] }
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

function applyComboBreather({ wave }: SabotageContext): SabotageResult {
  return { wave: { combo: 0 }, numericChangeTarget: { kind: 'combo', amount: wave.combo } }
}

function applyTalismanSeal({ run, rand }: SabotageContext): SabotageResult {
  if (run.items.length === 0) return {}
  const target = run.items[Math.floor(rand() * run.items.length)]
  return { wave: { activeSeal: { kind: 'talisman', instanceId: target.instanceId, id: target.id } } }
}

function applyRiteSeal({ run, rand }: SabotageContext): SabotageResult {
  if (run.rites.length === 0) return {}
  const target = run.rites[Math.floor(rand() * run.rites.length)]
  return { wave: { activeSeal: { kind: 'rite', instanceId: target.instanceId, id: target.id } } }
}

function applyRevelationOracleSeal({ run, rand }: SabotageContext): SabotageResult {
  const pool: HeldRevelationOrOracleRef[] = [
    ...run.revelations.map(h => ({ kind: 'revelation' as const, instanceId: h.instanceId, id: h.id })),
    ...run.oracles.map(h => ({ kind: 'oracle' as const, instanceId: h.instanceId, id: h.id })),
  ]
  if (pool.length === 0) return {}
  const ref = pool[Math.floor(rand() * pool.length)]
  return { wave: { activeSeal: { kind: 'revelationOrOracle', ref } } }
}

function applyRelicConfiscate({ run, rand }: SabotageContext): SabotageResult {
  if (run.relics.length === 0) return {}
  const idx = Math.floor(rand() * run.relics.length)
  const id = run.relics[idx].id
  return { run: { relics: [...run.relics.slice(0, idx), ...run.relics.slice(idx + 1)] }, confiscatedTarget: { kind: 'relic', id, idx } }
}

function applyTableauCardToDiscard({ wave, rand }: SabotageContext): SabotageResult {
  const positions: { ci: number; ri: number }[] = []
  wave.tableau.forEach((col, ci) => col.forEach((_c, ri) => positions.push({ ci, ri })))
  if (positions.length === 0) return {}
  const pick = positions[Math.floor(rand() * positions.length)]
  const card = wave.tableau[pick.ci][pick.ri]
  const tableau = wave.tableau.map((col, ci) => (ci === pick.ci ? [...col.slice(0, pick.ri), ...col.slice(pick.ri + 1)] : col))
  return { wave: { tableau, discardPile: [...wave.discardPile, card] }, tableauCardRemoved: { colIndex: pick.ci, rowIndex: pick.ri, card } }
}

function applyCurrencyConfiscate({ run }: SabotageContext): SabotageResult {
  const next = Math.max(0, run.currency - 5)
  return { run: { currency: next }, numericChangeTarget: { kind: 'currency', amount: run.currency - next } }
}

function applyRoleSeal({ rand }: SabotageContext): SabotageResult {
  const names = rollOffer(ORACLE_POOL, 2, rand)
  return { wave: { activeSeal: { kind: 'role', names } } }
}

function applyStockPurgeSmall({ wave }: SabotageContext): SabotageResult {
  const n = Math.min(2, wave.stock.length)
  const discardIsHidden = wave.discardPile[wave.discardPile.length - 1]?.faceUp === false
  const purged = wave.stock.slice(wave.stock.length - n).map(c => (discardIsHidden ? { ...c, faceUp: false } : c))
  return { wave: { stock: wave.stock.slice(0, wave.stock.length - n), discardPile: [...wave.discardPile, ...purged] }, purgedToDiscardCount: n }
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
    const slice = pool.slice(cursor, cursor + n).map(c => ({ ...c, faceUp: false }))
    cursor += n
    return slice
  })
  return { wave: { tableau, stock: pool.slice(cursor) }, affectedTableauCols: wave.tableau.map((_, i) => i) }
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
  const next = Math.max(0, wave.combo - 3)
  return { wave: { combo: next }, numericChangeTarget: { kind: 'combo', amount: wave.combo - next } }
}

function applyTalismanConfiscate({ run, rand }: SabotageContext): SabotageResult {
  if (run.items.length === 0) return {}
  const idx = Math.floor(rand() * run.items.length)
  const id = run.items[idx].id
  return { run: { items: [...run.items.slice(0, idx), ...run.items.slice(idx + 1)] }, confiscatedTarget: { kind: 'talisman', id, idx } }
}

function applyRiteConfiscate({ run, rand }: SabotageContext): SabotageResult {
  if (run.rites.length === 0) return {}
  const idx = Math.floor(rand() * run.rites.length)
  const id = run.rites[idx].id
  return { run: { rites: [...run.rites.slice(0, idx), ...run.rites.slice(idx + 1)] }, confiscatedTarget: { kind: 'rite', id, idx } }
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
  const usable = run.rites.filter(h => canUseRite(params, wave, h.instanceId, h.id))
  if (usable.length === 0) return {}
  const target = usable[Math.floor(rand() * usable.length)]
  const used = useRite(params, run, target.instanceId, target.id, rand)
  return { wave: { ...used.wave!, activeSeal: null }, run: used, forceActivatedTarget: { kind: 'rite', instanceId: target.instanceId, id: target.id } }
}

function applyTalismanShuffle({ run, rand }: SabotageContext): SabotageResult {
  const items = [...run.items]
  shuffleInPlace(items, rand)
  return { run: { items }, wave: { activeSeal: { kind: 'talismanHidden' } } }
}

function applyRevelationOracleConfiscate({ run, rand }: SabotageContext): SabotageResult {
  const pool: HeldRevelationOrOracleRef[] = [
    ...run.revelations.map(h => ({ kind: 'revelation' as const, instanceId: h.instanceId, id: h.id })),
    ...run.oracles.map(h => ({ kind: 'oracle' as const, instanceId: h.instanceId, id: h.id })),
  ]
  if (pool.length === 0) return {}
  // poolIdxをそのままidxの算出元にする(indexOfだと同名の天啓・神託を複数所持している場合、
  // 常に最初の要素の位置を指してしまい、実際に削除される要素の位置とズレるため)。
  const poolIdx = Math.floor(rand() * pool.length)
  const ref = pool[poolIdx]
  if (ref.kind === 'revelation') {
    const idx = poolIdx
    return {
      run: { revelations: [...run.revelations.slice(0, idx), ...run.revelations.slice(idx + 1)] },
      confiscatedTarget: { kind: 'revelationOrOracle', ref, idx },
    }
  }
  // 神託を没収してもoracleLevelsは変更しない: run.oraclesに温存中の神託はまだuseOracleで
  // 消費していないためoracleLevelsに未反映であり、没収してもそこに減らすべき実績が無い
  const idx = poolIdx - run.revelations.length
  return {
    run: { oracles: [...run.oracles.slice(0, idx), ...run.oracles.slice(idx + 1)] },
    confiscatedTarget: { kind: 'revelationOrOracle', ref, idx },
  }
}

// useRevelation/useOracleが返す完全なRunStateをそのままrunへ渡す(applyRiteForceActivateと同じ理由:
// grantRevelationReward等が天啓の種類によって動的に返す報酬フィールドを個別に列挙せずに済む)。
function applyRevelationOracleForceActivate({ params, run, wave, rand, useRevelation, useOracle }: SabotageContext): SabotageResult {
  const usableRevelations = run.revelations.filter(h => canUseRevelation(params, wave, h.instanceId, h.id, run.relics))
  // useOracleはuseRite/useRevelationと違いwave.statusを見ないため、ここで明示的にガードする。
  // (triggerSabotageはwave.status==='ended'になった直後にも呼ばれうる。天啓側はuseRevelation内部の
  // ガードで自然にno-opになるが、神託側だけ無条件に消費されてしまうと非対称な挙動になるため)
  const usableOracles = wave.status === 'playing' ? run.oracles : []
  const pool: HeldRevelationOrOracleRef[] = [
    ...usableRevelations.map(h => ({ kind: 'revelation' as const, instanceId: h.instanceId, id: h.id })),
    ...usableOracles.map(h => ({ kind: 'oracle' as const, instanceId: h.instanceId, id: h.id })),
  ]
  if (pool.length === 0) return {}
  const ref = pool[Math.floor(rand() * pool.length)]
  if (ref.kind === 'oracle') {
    const used = useOracle(params, run, ref.id)
    return { wave: { ...used.wave!, activeSeal: null }, run: used, forceActivatedTarget: { kind: 'revelationOrOracle', ref } }
  }
  const targetCol = revelationNeedsTarget(ref.id) ? Math.floor(rand() * wave.tableau.length) : null
  const used = useRevelation(params, run, ref.instanceId, ref.id, targetCol, rand)
  return { wave: { ...used.wave!, activeSeal: null }, run: used, forceActivatedTarget: { kind: 'revelationOrOracle', ref } }
}

function applyTsukumokaRelease({ run, rand }: SabotageContext): SabotageResult {
  const tsukumokaRelics = run.relics.filter(r => r.tsukumoka)
  if (tsukumokaRelics.length === 0) return {}
  const target = tsukumokaRelics[Math.floor(rand() * tsukumokaRelics.length)]
  const relics = run.relics.map(r => (r.id === target.id ? { ...r, tsukumoka: false } : r))
  return { run: { relics }, numericChangeTarget: { kind: 'tsukumoka', relicId: target.id } }
}

function applyDiscardErase({ wave, rand }: SabotageContext): SabotageResult {
  const chainCount = wave.chain.length
  const pool = [...wave.discardPile, ...wave.chain]
  shuffleInPlace(pool, rand)
  const chain = pool.slice(0, chainCount)
  const discardPile = pool.slice(chainCount)
  const chainOrigin = chain.map(() => 'draw' as const)
  return { wave: { chain, chainOrigin, discardPile, foundation: chain[chain.length - 1] }, redistributedAreas: { kind: 'chainAndDiscard' } }
}

function applyDiscardBury({ wave, rand }: SabotageContext): SabotageResult {
  const n = wave.discardPile.length
  const pool = [...wave.stock, ...wave.discardPile]
  shuffleInPlace(pool, rand)
  const discardPile = pool.slice(0, n).map(c => ({ ...c, faceUp: false }))
  const stock = pool.slice(n)
  return { wave: { stock, discardPile }, redistributedAreas: { kind: 'stockAndDiscard' } }
}

function applyRewardReduce({ run }: SabotageContext): SabotageResult {
  return { run: { rewardPenalty: run.rewardPenalty + 2 } }
}

function applyCurrencyDrain({ run }: SabotageContext): SabotageResult {
  const loss = Math.floor(run.currency * 0.2)
  const next = Math.max(0, run.currency - loss)
  return { run: { currency: next }, numericChangeTarget: { kind: 'currency', amount: run.currency - next } }
}

function applyRoleLevelDecay({ run, rand }: SabotageContext): SabotageResult {
  const names = rollOffer(ORACLE_POOL, 2, rand)
  const oracleLevels = { ...run.oracleLevels }
  for (const name of names) oracleLevels[name] = Math.max(1, oracleLevels[name] - 1)
  return { run: { oracleLevels }, wave: { oracleLevels }, numericChangeTarget: { kind: 'roleLevel', names, amount: 1 } }
}

function applyRoleBias({ rand }: SabotageContext): SabotageResult {
  const shuffled = [...ORACLE_POOL]
  shuffleInPlace(shuffled, rand)
  const half = Math.floor(shuffled.length / 2)
  const buffed = shuffled.slice(0, half)
  const nerfed = shuffled.slice(half)
  return { wave: { activeSeal: { kind: 'roleBias', buffed, nerfed, multiplier: 2 } }, numericChangeTarget: { kind: 'roleBias', buffed, nerfed } }
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
  currencyDrain: applyCurrencyDrain,
  roleLevelDecay: applyRoleLevelDecay,
  roleBias: applyRoleBias,
}

export function applySabotageEffect(id: SabotageActionId, ctx: SabotageContext): SabotageResult {
  return SABOTAGE_HANDLERS[id](ctx)
}
