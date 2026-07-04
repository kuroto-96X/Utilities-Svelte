export type NumberField = {
  type: 'number'
  label: string
  min: number
  max: number
  step: number
  unit?: string
}

export type ArrayField = {
  type: 'array'
  label: string
  columns: Record<string, NumberField>
}

export type FieldSchema = NumberField | ArrayField

export type SectionSchema = {
  label: string
  fields: Record<string, FieldSchema>
  flat?: true  // サイズタブなし、configのトップレベルに直接読み書き
}

export type AnimConfigSchema = Record<string, SectionSchema>

export type AnimConfig = {
  slamDrop: {
    durationMs: number
    peakAt: number
    landAt: number
    peakScale: number
    peakRotateDeg: number
    peakLiftPx: number
    landScale: number
    landRotateDeg: number
  }
  screenShake: {
    durationMs: number
    frames: Array<{ x: number; y: number; rotateDeg: number }>
  }
  impactBounce: {
    minDistPx: number
    maxDistPx: number
    delayFactor: number
    singleMaxScale: number
    tableauMaxScale: number
    tableauDurationMinMs: number
    tableauDurationRangeMs: number
  }
  sparkle: {
    count: number
    radiusPx: number
    durationMs: number
  }
  scoreDelta: {
    durationMs: number
  }
  finale: {
    spinDurationMs: number
    spinPeakScale: number
    spinRotations: number
    holdDurationMs: number
    shakeAmplify: number
    shakeCount: number
    shakeIntervalMs: number
  }
}

export const DEFAULT_ANIM_CONFIG: AnimConfig = {
  slamDrop: {
    durationMs: 480,
    peakAt: 0.38,
    landAt: 0.84,
    peakScale: 1.85,
    peakRotateDeg: -10,
    peakLiftPx: -60,
    landScale: 1.06,
    landRotateDeg: -1,
  },
  screenShake: {
    durationMs: 400,
    frames: [
      { x: -7, y: -4, rotateDeg: -0.4 },
      { x:  7, y:  5, rotateDeg:  0.4 },
      { x: -5, y: -3, rotateDeg: -0.3 },
      { x:  6, y:  4, rotateDeg:  0.3 },
      { x: -3, y: -2, rotateDeg:  0 },
      { x:  3, y:  2, rotateDeg:  0 },
      { x: -1, y: -1, rotateDeg:  0 },
    ],
  },
  impactBounce: {
    minDistPx: 40,
    maxDistPx: 460,
    delayFactor: 0.55,
    singleMaxScale: 0.18,
    tableauMaxScale: 0.22,
    tableauDurationMinMs: 280,
    tableauDurationRangeMs: 260,
  },
  sparkle: {
    count: 14,
    radiusPx: 90,
    durationMs: 780,
  },
  scoreDelta: {
    durationMs: 1100,
  },
  finale: {
    spinDurationMs: 600,
    spinPeakScale: 2.0,
    spinRotations: 1,
    holdDurationMs: 50,
    shakeAmplify: 1.5,
    shakeCount: 1,
    shakeIntervalMs: 0,
  },
}

export type AnimSize = 'large' | 'medium' | 'small'

export type ConfettiConfig = {
  burstCount: number
  snowRate: number
}

export type AnimConfigFile = {
  slamDrop:     Record<AnimSize, AnimConfig['slamDrop']>
  screenShake:  Record<AnimSize, AnimConfig['screenShake']>
  impactBounce: Record<AnimSize, AnimConfig['impactBounce']>
  sparkle:      Record<AnimSize, AnimConfig['sparkle']>
  scoreDelta:   Record<AnimSize, AnimConfig['scoreDelta']>
  finale:       Record<AnimSize, AnimConfig['finale']>
  confetti:     ConfettiConfig
}

export const DEFAULT_ANIM_CONFIG_FILE: AnimConfigFile = {
  slamDrop: {
    large:  { durationMs: 600, peakAt: 0.38, landAt: 0.84, peakScale: 2.2,  peakRotateDeg: -15, peakLiftPx: -80, landScale: 1.10, landRotateDeg: -2.0 },
    medium: { ...DEFAULT_ANIM_CONFIG.slamDrop },
    small:  { durationMs: 300, peakAt: 0.38, landAt: 0.84, peakScale: 1.40, peakRotateDeg:  -5, peakLiftPx: -30, landScale: 1.02, landRotateDeg: -0.5 },
  },
  screenShake: {
    large: {
      durationMs: 500,
      frames: [
        { x: -10, y: -6, rotateDeg: -0.6 }, { x: 10, y: 8, rotateDeg: 0.6 },
        { x: -8,  y: -5, rotateDeg: -0.5 }, { x: 9,  y: 6, rotateDeg: 0.5 },
        { x: -5,  y: -3, rotateDeg: 0 },    { x: 5,  y: 3, rotateDeg: 0 },
        { x: -2,  y: -2, rotateDeg: 0 },
      ],
    },
    medium: { ...DEFAULT_ANIM_CONFIG.screenShake },
    small: {
      durationMs: 250,
      frames: [
        { x: -4, y: -2, rotateDeg: -0.2 },  { x: 4,  y: 3, rotateDeg: 0.2 },
        { x: -3, y: -2, rotateDeg: -0.15 }, { x: 3,  y: 2, rotateDeg: 0.15 },
        { x: -1, y: -1, rotateDeg: 0 },     { x: 1,  y: 1, rotateDeg: 0 },
        { x: 0,  y: 0,  rotateDeg: 0 },
      ],
    },
  },
  impactBounce: {
    large:  { minDistPx: 30,  maxDistPx: 500, delayFactor: 0.55, singleMaxScale: 0.28, tableauMaxScale: 0.35, tableauDurationMinMs: 320, tableauDurationRangeMs: 320 },
    medium: { ...DEFAULT_ANIM_CONFIG.impactBounce },
    small:  { minDistPx: 50,  maxDistPx: 400, delayFactor: 0.55, singleMaxScale: 0.10, tableauMaxScale: 0.14, tableauDurationMinMs: 220, tableauDurationRangeMs: 180 },
  },
  sparkle: {
    large:  { count: 24, radiusPx: 130, durationMs: 950 },
    medium: { ...DEFAULT_ANIM_CONFIG.sparkle },
    small:  { count: 7,  radiusPx: 55,  durationMs: 550 },
  },
  scoreDelta: {
    large:  { durationMs: 1400 },
    medium: { ...DEFAULT_ANIM_CONFIG.scoreDelta },
    small:  { durationMs: 750 },
  },
  finale: {
    large:  { spinDurationMs: 825, spinPeakScale: 2.5, spinRotations: 2, holdDurationMs: 75, shakeAmplify: 2.5, shakeCount: 2, shakeIntervalMs: 80 },
    medium: { ...DEFAULT_ANIM_CONFIG.finale },
    small:  { spinDurationMs: 400, spinPeakScale: 1.6, spinRotations: 1, holdDurationMs: 30, shakeAmplify: 1.0, shakeCount: 1, shakeIntervalMs: 0 },
  },
  confetti: {
    burstCount: 40,
    snowRate: 2,
  },
}

export const animConfigSchema: AnimConfigSchema = {
  slamDrop: {
    label: 'スラム投下',
    fields: {
      durationMs:    { type: 'number', label: '総時間',           min: 100,  max: 2000, step: 10,   unit: 'ms' },
      peakAt:        { type: 'number', label: 'ピーク位置 (0-1)', min: 0.05, max: 0.95, step: 0.01 },
      landAt:        { type: 'number', label: '着地位置 (0-1)',   min: 0.05, max: 0.99, step: 0.01 },
      peakScale:     { type: 'number', label: 'ピーク倍率',       min: 1.0,  max: 3.0,  step: 0.05 },
      peakRotateDeg: { type: 'number', label: 'ピーク回転',       min: -45,  max: 45,   step: 1,    unit: '°' },
      peakLiftPx:    { type: 'number', label: '浮き上がり量',     min: -200, max: 0,    step: 5,    unit: 'px' },
      landScale:     { type: 'number', label: '着地倍率',         min: 1.0,  max: 1.5,  step: 0.01 },
      landRotateDeg: { type: 'number', label: '着地回転',         min: -10,  max: 10,   step: 0.5,  unit: '°' },
    },
  },
  screenShake: {
    label: '画面シェイク',
    fields: {
      durationMs: { type: 'number', label: '総時間', min: 100, max: 1000, step: 10, unit: 'ms' },
      frames: {
        type: 'array',
        label: 'フレーム列',
        columns: {
          x:         { type: 'number', label: 'X',   min: -30, max: 30, step: 0.5, unit: 'px' },
          y:         { type: 'number', label: 'Y',   min: -30, max: 30, step: 0.5, unit: 'px' },
          rotateDeg: { type: 'number', label: '回転', min: -3,  max: 3,  step: 0.1, unit: '°' },
        },
      },
    },
  },
  impactBounce: {
    label: '衝撃バウンス',
    fields: {
      minDistPx:              { type: 'number', label: '最小距離',             min: 0,   max: 200,  step: 5,    unit: 'px' },
      maxDistPx:              { type: 'number', label: '最大距離',             min: 100, max: 1000, step: 10,   unit: 'px' },
      delayFactor:            { type: 'number', label: '遅延係数',             min: 0,   max: 2,    step: 0.05, unit: 'ms/px' },
      singleMaxScale:         { type: 'number', label: '単体最大スケール',     min: 0,   max: 0.5,  step: 0.01 },
      tableauMaxScale:        { type: 'number', label: 'タブロー最大スケール', min: 0,   max: 0.5,  step: 0.01 },
      tableauDurationMinMs:   { type: 'number', label: '奥カード時間',         min: 50,  max: 500,  step: 10,   unit: 'ms' },
      tableauDurationRangeMs: { type: 'number', label: '時間レンジ',           min: 0,   max: 500,  step: 10,   unit: 'ms' },
    },
  },
  sparkle: {
    label: 'スパークル',
    fields: {
      count:      { type: 'number', label: '発射数',  min: 1,   max: 40,   step: 1 },
      radiusPx:   { type: 'number', label: '広がり',  min: 20,  max: 300,  step: 5,  unit: 'px' },
      durationMs: { type: 'number', label: '時間',    min: 100, max: 2000, step: 10, unit: 'ms' },
    },
  },
  scoreDelta: {
    label: 'スコア差分',
    fields: {
      durationMs: { type: 'number', label: '時間', min: 200, max: 3000, step: 50, unit: 'ms' },
    },
  },
  finale: {
    label: 'フィナーレ（最終カード）',
    fields: {
      spinDurationMs:  { type: 'number', label: 'スピン時間',       min: 100, max: 2000, step: 25,  unit: 'ms' },
      spinPeakScale:   { type: 'number', label: 'スピン最大倍率',   min: 1.0, max: 4.0,  step: 0.1 },
      spinRotations:   { type: 'number', label: '回転数',           min: 1,   max: 5,    step: 1 },
      holdDurationMs:  { type: 'number', label: '停止時間',         min: 0,   max: 500,  step: 25,  unit: 'ms' },
      shakeAmplify:    { type: 'number', label: 'シェイク強度倍率', min: 0.5, max: 5.0,  step: 0.1 },
      shakeCount:      { type: 'number', label: 'シェイク回数',     min: 1,   max: 5,    step: 1 },
      shakeIntervalMs: { type: 'number', label: 'シェイク間隔',     min: 0,   max: 500,  step: 10,  unit: 'ms' },
    },
  },
  confetti: {
    label: '紙吹雪',
    flat: true,
    fields: {
      burstCount: { type: 'number', label: 'バースト粒子数',            min: 0, max: 200, step: 5 },
      snowRate:   { type: 'number', label: '降雪レート（粒/フレーム）', min: 0, max: 20,  step: 1 },
    },
  },
}
