import type { SourceLanguage, ExtractedCandidate } from '../types'

export interface LanguageExtractor {
  language: SourceLanguage
  extract(code: string): ExtractedCandidate[]
}
