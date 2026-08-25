import { describe, it, expect } from 'vitest'
import { applySabotageEffect } from './sabotageEffects'
import { SABOTAGE_POOL } from './sabotage'
import { createInitialRun, startWave, useRite, useRevelation, useOracle } from './engine'
import { DEFAULT_PARAMS } from './params'
import { defaultOracleLevels } from './oracles'

describe('applySabotageEffect', () => {
  it('SABOTAGE_POOL全件のidに対して、例外を投げずに結果を返す', () => {
    // createInitialRun/startWaveで実際に使われるのと同じ形の、正規のRunState/WaveStateを
    // 用意する(手組みのダミーオブジェクトだとchainSettleがresetComboFields内でparams.talismans
    // 等を参照して例外になるなど、フィールド不足による誤検出を招くため)。
    // 所持品は全て空スタートだが、対象0件のケースは各ハンドラが早期returnで{}を返す設計なので
    // 例外なく完走する(全件のディスパッチ経路が揃っているかを見るだけのテストで十分)。
    const run = createInitialRun()
    const { wave } = startWave(DEFAULT_PARAMS, 0, 0, run.items.map(h => h.id), run.deckComposition, 1, 0, defaultOracleLevels())
    for (const id of SABOTAGE_POOL) {
      expect(() =>
        applySabotageEffect(id, { params: DEFAULT_PARAMS, run, wave, rand: () => 0, useRite, useRevelation, useOracle })
      ).not.toThrow()
    }
  })
})
