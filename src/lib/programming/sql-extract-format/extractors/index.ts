import type { SourceLanguage } from '../types'
import type { LanguageExtractor } from './types'
import { csharpExtractor } from './csharp'

export const extractors: Partial<Record<SourceLanguage, LanguageExtractor>> = {
  csharp: csharpExtractor,
}

export const ALL_LANGUAGE_OPTIONS: { value: SourceLanguage; label: string; supported: boolean }[] = [
  { value: 'csharp',     label: 'C#',                      supported: true },
  { value: 'java',       label: 'Java',                    supported: false },
  { value: 'python',     label: 'Python',                  supported: false },
  { value: 'javascript', label: 'JavaScript / TypeScript', supported: false },
  { value: 'vb',         label: 'VB.NET',                  supported: false },
]
