export type LongVowel = 'omit' | 'macron' | 'double'
export type Nasal = 'mn' | 'n'
export type Separator = 'none' | 'apostrophe' | 'hyphen'
export type Width = 'half' | 'full'
export type CaseMode = 'lower' | 'upper' | 'pascal'
export type Preset = 'passport' | 'railway' | 'road' | 'custom'

export type HepburnSettings = {
  preset: Preset
  longVowel: LongVowel
  nasal: Nasal
  separator: Separator
  width: Width
  caseMode: CaseMode
  pascalSpaces: boolean
}

export const DEFAULT_SETTINGS: HepburnSettings = {
  preset: 'passport',
  longVowel: 'omit',
  nasal: 'mn',
  separator: 'none',
  width: 'half',
  caseMode: 'pascal',
  pascalSpaces: false
}

type PresetValues = Pick<HepburnSettings, 'longVowel' | 'nasal' | 'separator'>

export const PRESET_VALUES: Record<Exclude<Preset, 'custom'>, PresetValues> = {
  passport: { longVowel: 'omit',   nasal: 'mn', separator: 'none'   },
  railway:  { longVowel: 'macron', nasal: 'mn', separator: 'hyphen' },
  road:     { longVowel: 'omit',   nasal: 'n',  separator: 'none'   }
}

const STORAGE_KEY = 'hepburn-settings'

export function loadSettings(): HepburnSettings {
  try {
    const raw = localStorage.getItem(STORAGE_KEY)
    if (!raw) return { ...DEFAULT_SETTINGS }
    return { ...DEFAULT_SETTINGS, ...JSON.parse(raw) }
  } catch {
    return { ...DEFAULT_SETTINGS }
  }
}

export function saveSettings(settings: HepburnSettings): void {
  try {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(settings))
  } catch {
    // LocalStorage が使えない環境では無視
  }
}

// プリセット値に含まれるキーのみプリセットを 'custom' に変更する
const PRESET_AFFECTED_KEYS = new Set<keyof HepburnSettings>(['longVowel', 'nasal', 'separator'])

/**
 * 個別設定変更時にプリセットを 'custom' に更新し、変更後の設定を返す。
 * caseMode / pascalSpaces はプリセット非連動のため preset を変更しない。
 */
export function applyIndividualChange<K extends keyof HepburnSettings>(
  settings: HepburnSettings,
  key: K,
  value: HepburnSettings[K]
): HepburnSettings {
  const preset = PRESET_AFFECTED_KEYS.has(key) ? 'custom' : settings.preset
  return { ...settings, [key]: value, preset }
}

/**
 * プリセット選択時に対応する個別設定値を一括上書きして返す。
 */
export function applyPreset(settings: HepburnSettings, preset: Preset): HepburnSettings {
  if (preset === 'custom') return { ...settings, preset: 'custom' }
  return { ...settings, ...PRESET_VALUES[preset], preset }
}
