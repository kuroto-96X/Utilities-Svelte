// src/lib/game/shidasu/directEffects.test.ts
import { describe, test, expect } from 'vitest'
import { applyDirectEffects, type DirectEffectContext } from './directEffects'
import { DEFAULT_PARAMS } from './params'
import { directCtx } from './testHelpers'

describe('applyDirectEffects', () => {
  const params = DEFAULT_PARAMS

  test('未登録の護符は素通りする', () => {
    const result = applyDirectEffects('resetDirect', ['bridge'], directCtx(), params)
    expect(result.value).toBe(0)
  })

  test('沈着: 取れる場札が無ければresetDirectで加算', () => {
    const fired = applyDirectEffects('resetDirect', ['composure'], directCtx({ hasPlayableColumns: false }), params)
    expect(fired.value).toBe(params.talismans.composure.n)
    const notFired = applyDirectEffects('resetDirect', ['composure'], directCtx({ hasPlayableColumns: true }), params)
    expect(notFired.value).toBe(0)
  })

  test('冷静: 役が一つも成立していなければresetDirectで加算', () => {
    const fired = applyDirectEffects('resetDirect', ['clarity'], directCtx({ roleFiredThisChain: false }), params)
    expect(fired.value).toBe(params.talismans.clarity.n)
    const notFired = applyDirectEffects('resetDirect', ['clarity'], directCtx({ roleFiredThisChain: true }), params)
    expect(notFired.value).toBe(0)
  })

  test('残響: resetDirectでリセット前のコンボ数×nを加算', () => {
    const result = applyDirectEffects('resetDirect', ['echo'], directCtx({ comboBeforeReset: 5 }), params)
    expect(result.value).toBe(5 * params.talismans.echo.n)
  })

  test('沈着・冷静・残響は同時に発火しうる(合算される)', () => {
    const result = applyDirectEffects('resetDirect', ['composure', 'clarity', 'echo'], directCtx({ hasPlayableColumns: false, roleFiredThisChain: false, comboBeforeReset: 2 }), params)
    expect(result.value).toBe(params.talismans.composure.n + params.talismans.clarity.n + 2 * params.talismans.echo.n)
  })

  test('慢心: stockEmptyDirectで場札残数×xを加算', () => {
    const result = applyDirectEffects('stockEmptyDirect', ['arrogance'], directCtx({ remainingTableauCount: 7 }), params)
    expect(result.value).toBe(7 * params.talismans.arrogance.x)
  })

  test('流星: comboMilestoneDirectで閾値未満→以上に到達した時のみ、scoreAfterGainedのp%を加算', () => {
    const c = params.talismans.shootingStar.c
    const fired = applyDirectEffects(
      'comboMilestoneDirect',
      ['shootingStar'],
      directCtx({ previousCombo: c - 1, combo: c, scoreAfterGained: 2000 }),
      params
    )
    expect(fired.value).toBe(Math.floor(2000 * params.talismans.shootingStar.p / 100))
    // 既に閾値以上だった場合は再発動しない
    const notFiredAlreadyPast = applyDirectEffects(
      'comboMilestoneDirect',
      ['shootingStar'],
      directCtx({ previousCombo: c, combo: c + 1, scoreAfterGained: 2000 }),
      params
    )
    expect(notFiredAlreadyPast.value).toBe(0)
    // まだ閾値未満の場合は発動しない
    const notFiredBelow = applyDirectEffects(
      'comboMilestoneDirect',
      ['shootingStar'],
      directCtx({ previousCombo: c - 2, combo: c - 1, scoreAfterGained: 2000 }),
      params
    )
    expect(notFiredBelow.value).toBe(0)
  })

  test('誠実: drawContinueDirectで同色パターン継続の時のみ加算', () => {
    const fired = applyDirectEffects('drawContinueDirect', ['sincerity'], directCtx({ colorHeld: true }), params)
    expect(fired.value).toBe(params.talismans.sincerity.n)
    const notFired = applyDirectEffects('drawContinueDirect', ['sincerity'], directCtx({ colorHeld: false }), params)
    expect(notFired.value).toBe(0)
  })

  test('gainedチャンネルの護符はdirectチャンネルには影響しない', () => {
    const result = applyDirectEffects('resetDirect', ['courage'], directCtx(), params)
    expect(result.value).toBe(0)
  })

  test('directCtxはpreviousCombo・scoreAfterGainedを受け付ける(型の確認)', () => {
    const c = directCtx({ previousCombo: 5, scoreAfterGained: 1000 })
    expect(c.previousCombo).toBe(5)
    expect(c.scoreAfterGained).toBe(1000)
  })
})

describe('applyDirectEffects', () => {
  test('発動した護符の内訳(parts)を護符名付きで返す', () => {
    const ctx: DirectEffectContext = {
      comboBeforeReset: 3,
      hasPlayableColumns: false,
      roleFiredThisChain: false,
      remainingTableauCount: 0,
      combo: 0,
      colorHeld: false,
      previousCombo: 0,
      scoreAfterGained: 0,
    }
    const result = applyDirectEffects('resetDirect', ['composure'], ctx, DEFAULT_PARAMS)
    expect(result.value).toBe(DEFAULT_PARAMS.talismans.composure.n)
    expect(result.parts.map(p => p.text)).toContain(`沈着+${DEFAULT_PARAMS.talismans.composure.n}`)
  })

  test('発動しなかった護符はpartsに含まれない', () => {
    const ctx: DirectEffectContext = {
      comboBeforeReset: 3,
      hasPlayableColumns: true, // composureは不発火条件
      roleFiredThisChain: true, // clarityは不発火条件
      remainingTableauCount: 0,
      combo: 0,
      colorHeld: false,
      previousCombo: 0,
      scoreAfterGained: 0,
    }
    const result = applyDirectEffects('resetDirect', ['composure', 'clarity'], ctx, DEFAULT_PARAMS)
    expect(result.value).toBe(0)
    expect(result.parts).toEqual([])
  })

  test('該当チャンネルの護符を複数所持していれば両方partsに含まれる', () => {
    const ctx: DirectEffectContext = {
      comboBeforeReset: 2,
      hasPlayableColumns: false,
      roleFiredThisChain: false,
      remainingTableauCount: 0,
      combo: 0,
      colorHeld: false,
      previousCombo: 0,
      scoreAfterGained: 0,
    }
    const result = applyDirectEffects('resetDirect', ['composure', 'clarity'], ctx, DEFAULT_PARAMS)
    expect(result.value).toBe(DEFAULT_PARAMS.talismans.composure.n + DEFAULT_PARAMS.talismans.clarity.n)
    expect(result.parts.map(p => p.text)).toContain(`沈着+${DEFAULT_PARAMS.talismans.composure.n}`)
    expect(result.parts.map(p => p.text)).toContain(`冷静+${DEFAULT_PARAMS.talismans.clarity.n}`)
  })
})
