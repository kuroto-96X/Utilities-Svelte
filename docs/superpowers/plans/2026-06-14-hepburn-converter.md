# ヘボン式ローマ字変換ツール Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** ヘボン式ローマ字変換ツールページ (`/hepburn-converter`) を追加し、日本語（ひらがな・カタカナ・半角カナ）をヘボン式ローマ字に変換する。

**Architecture:** ロジック（normalizer, table, converter, settings）を `src/lib/hepburn/` に分離し、UIは `src/routes/hepburn-converter/+page.svelte` に集約する。形態素解析には budoux を使用。全ページ共通のナビゲーションを `+layout.svelte` に追加。

**Tech Stack:** SvelteKit 2, Svelte 5 (runes), TypeScript, Tailwind CSS 3, budoux, Vitest

---

## File Map

| ファイル | 操作 | 内容 |
|---|---|---|
| `package.json` | Modify | budoux, vitest を追加 |
| `vitest.config.ts` | Create | Vitest 設定 |
| `src/lib/hepburn/normalizer.ts` | Create | 半角カナ → 全角カナ正規化 |
| `src/lib/hepburn/normalizer.test.ts` | Create | normalizer テスト |
| `src/lib/hepburn/settings.ts` | Create | 型定義・デフォルト値・プリセット・LocalStorage |
| `src/lib/hepburn/table.ts` | Create | かな→ローマ字変換テーブル |
| `src/lib/hepburn/converter.ts` | Create | 変換ロジック本体 |
| `src/lib/hepburn/converter.test.ts` | Create | converter テスト |
| `src/routes/+layout.svelte` | Modify | ヘッダーナビ追加 |
| `src/routes/+page.svelte` | Modify | ツール一覧ランディングページ |
| `src/routes/hepburn-converter/+page.svelte` | Create | 変換ツール UI |

---

## Task 1: Install dependencies and set up Vitest

**Files:**
- Modify: `package.json`
- Create: `vitest.config.ts`

- [ ] **Step 1: Install budoux and vitest**

```bash
npm install budoux
npm install -D vitest
```

- [ ] **Step 2: Add test script to package.json**

In `package.json`, add `"test": "vitest run"` to the `scripts` section:

```json
"scripts": {
  "dev": "vite dev",
  "build": "vite build",
  "preview": "vite preview",
  "prepare": "svelte-kit sync || echo ''",
  "check": "svelte-kit sync && svelte-check --tsconfig ./tsconfig.json",
  "check:watch": "svelte-kit sync && svelte-check --tsconfig ./tsconfig.json --watch",
  "lint": "prettier --check . && eslint .",
  "format": "prettier --write .",
  "test": "vitest run"
}
```

- [ ] **Step 3: Create vitest.config.ts**

```ts
import { defineConfig } from 'vitest/config'

export default defineConfig({
  test: {
    include: ['src/**/*.test.ts'],
    environment: 'node'
  }
})
```

- [ ] **Step 4: Verify setup (no test files yet, just confirms vitest runs)**

```bash
npm test
```

Expected: `No test files found` または `0 tests passed` — ゼロファイルでも正常終了すれば OK

- [ ] **Step 5: Commit**

```bash
git add package.json package-lock.json vitest.config.ts
git commit -m "chore: budoux・Vitest をインストール"
```

---

## Task 2: normalizer.ts — 半角カナ正規化

**Files:**
- Create: `src/lib/hepburn/normalizer.ts`
- Create: `src/lib/hepburn/normalizer.test.ts`

- [ ] **Step 1: Write the failing test**

`src/lib/hepburn/normalizer.test.ts`:

```ts
import { describe, expect, test } from 'vitest'
import { normalize } from './normalizer'

describe('normalize', () => {
  test('半角カタカナを全角カタカナに変換する', () => {
    expect(normalize('ｱｲｳｴｵ')).toBe('アイウエオ')
  })

  test('半角濁点を結合して全角濁点付きカタカナにする', () => {
    expect(normalize('ｶﾞｷﾞｸﾞｹﾞｺﾞ')).toBe('ガギグゲゴ')
  })

  test('半角半濁点を結合して全角半濁点付きカタカナにする', () => {
    expect(normalize('ﾊﾟﾋﾟﾌﾟﾍﾟﾎﾟ')).toBe('パピプペポ')
  })

  test('全角ひらがなはそのまま', () => {
    expect(normalize('あいうえお')).toBe('あいうえお')
  })

  test('全角カタカナはそのまま', () => {
    expect(normalize('アイウエオ')).toBe('アイウエオ')
  })

  test('ASCII はそのまま', () => {
    expect(normalize('hello123')).toBe('hello123')
  })

  test('空文字はそのまま', () => {
    expect(normalize('')).toBe('')
  })
})
```

- [ ] **Step 2: テストが失敗することを確認**

```bash
npm test
```

Expected: `FAIL` with `Cannot find module './normalizer'`

- [ ] **Step 3: normalizer.ts を実装**

`src/lib/hepburn/normalizer.ts`:

```ts
/**
 * 半角カナ（ﾊｰﾌｶﾅ）を全角カタカナに正規化する。
 * String.prototype.normalize('NFKC') を使用する。
 * 半角濁点・半濁点（ﾞ/ﾟ）が基字と分離している場合も結合される。
 */
export function normalize(input: string): string {
  return input.normalize('NFKC')
}
```

- [ ] **Step 4: テストが通ることを確認**

```bash
npm test
```

Expected: `7 passed`

- [ ] **Step 5: Commit**

```bash
git add src/lib/hepburn/normalizer.ts src/lib/hepburn/normalizer.test.ts
git commit -m "feat: 半角カナ正規化モジュール (normalizer.ts)"
```

---

## Task 3: settings.ts — 型・デフォルト・プリセット・LocalStorage

**Files:**
- Create: `src/lib/hepburn/settings.ts`

- [ ] **Step 1: settings.ts を作成**

`src/lib/hepburn/settings.ts`:

```ts
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
  caseMode: 'lower',
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

/**
 * 個別設定変更時にプリセットを 'custom' に更新し、変更後の設定を返す。
 */
export function applyIndividualChange<K extends keyof HepburnSettings>(
  settings: HepburnSettings,
  key: K,
  value: HepburnSettings[K]
): HepburnSettings {
  return { ...settings, [key]: value, preset: 'custom' }
}

/**
 * プリセット選択時に対応する個別設定値を一括上書きして返す。
 */
export function applyPreset(settings: HepburnSettings, preset: Preset): HepburnSettings {
  if (preset === 'custom') return { ...settings, preset: 'custom' }
  return { ...settings, ...PRESET_VALUES[preset], preset }
}
```

- [ ] **Step 2: Commit**

```bash
git add src/lib/hepburn/settings.ts
git commit -m "feat: ヘボン式設定の型・デフォルト値・プリセット (settings.ts)"
```

---

## Task 4: table.ts — かな→ローマ字変換テーブル

**Files:**
- Create: `src/lib/hepburn/table.ts`

- [ ] **Step 1: table.ts を作成**

`src/lib/hepburn/table.ts`:

```ts
/**
 * ひらがなエントリー。2文字（複合拍）を先に定義し、1文字を後に定義することで
 * converter が2文字優先マッチできる。
 */
const HIRA_ENTRIES: [string, string][] = [
  // 複合拍（2文字）
  ['きゃ', 'kya'], ['きゅ', 'kyu'], ['きょ', 'kyo'],
  ['しゃ', 'sha'], ['しゅ', 'shu'], ['しょ', 'sho'],
  ['ちゃ', 'cha'], ['ちゅ', 'chu'], ['ちょ', 'cho'],
  ['にゃ', 'nya'], ['にゅ', 'nyu'], ['にょ', 'nyo'],
  ['ひゃ', 'hya'], ['ひゅ', 'hyu'], ['ひょ', 'hyo'],
  ['みゃ', 'mya'], ['みゅ', 'myu'], ['みょ', 'myo'],
  ['りゃ', 'rya'], ['りゅ', 'ryu'], ['りょ', 'ryo'],
  ['ぎゃ', 'gya'], ['ぎゅ', 'gyu'], ['ぎょ', 'gyo'],
  ['じゃ', 'ja'],  ['じゅ', 'ju'],  ['じょ', 'jo'],
  ['ぢゃ', 'ja'],  ['ぢゅ', 'ju'],  ['ぢょ', 'jo'],
  ['びゃ', 'bya'], ['びゅ', 'byu'], ['びょ', 'byo'],
  ['ぴゃ', 'pya'], ['ぴゅ', 'pyu'], ['ぴょ', 'pyo'],
  ['ふぁ', 'fa'],  ['ふぃ', 'fi'],  ['ふぇ', 'fe'],  ['ふぉ', 'fo'],
  ['てぃ', 'ti'],  ['でぃ', 'di'],  ['でゅ', 'dyu'],
  ['うぃ', 'wi'],  ['うぇ', 'we'],  ['うぁ', 'wa'],
  // 単拍（1文字）
  ['あ', 'a'],   ['い', 'i'],   ['う', 'u'],   ['え', 'e'],   ['お', 'o'],
  ['か', 'ka'],  ['き', 'ki'],  ['く', 'ku'],  ['け', 'ke'],  ['こ', 'ko'],
  ['さ', 'sa'],  ['し', 'shi'], ['す', 'su'],  ['せ', 'se'],  ['そ', 'so'],
  ['た', 'ta'],  ['ち', 'chi'], ['つ', 'tsu'], ['て', 'te'],  ['と', 'to'],
  ['な', 'na'],  ['に', 'ni'],  ['ぬ', 'nu'],  ['ね', 'ne'],  ['の', 'no'],
  ['は', 'ha'],  ['ひ', 'hi'],  ['ふ', 'fu'],  ['へ', 'he'],  ['ほ', 'ho'],
  ['ま', 'ma'],  ['み', 'mi'],  ['む', 'mu'],  ['め', 'me'],  ['も', 'mo'],
  ['や', 'ya'],  ['ゆ', 'yu'],  ['よ', 'yo'],
  ['ら', 'ra'],  ['り', 'ri'],  ['る', 'ru'],  ['れ', 're'],  ['ろ', 'ro'],
  ['わ', 'wa'],  ['ゐ', 'i'],   ['ゑ', 'e'],   ['を', 'o'],
  ['が', 'ga'],  ['ぎ', 'gi'],  ['ぐ', 'gu'],  ['げ', 'ge'],  ['ご', 'go'],
  ['ざ', 'za'],  ['じ', 'ji'],  ['ず', 'zu'],  ['ぜ', 'ze'],  ['ぞ', 'zo'],
  ['だ', 'da'],  ['ぢ', 'ji'],  ['づ', 'zu'],  ['で', 'de'],  ['ど', 'do'],
  ['ば', 'ba'],  ['び', 'bi'],  ['ぶ', 'bu'],  ['べ', 'be'],  ['ぼ', 'bo'],
  ['ぱ', 'pa'],  ['ぴ', 'pi'],  ['ぷ', 'pu'],  ['ぺ', 'pe'],  ['ぽ', 'po'],
]

/** ひらがなコードポイントにオフセットを加えてカタカナにする */
function toKatakana(s: string): string {
  return [...s].map(ch => {
    const code = ch.codePointAt(0)!
    // ひらがな範囲: U+3041–U+3096 → カタカナ: +0x60
    return code >= 0x3041 && code <= 0x3096
      ? String.fromCodePoint(code + 0x60)
      : ch
  }).join('')
}

const KATA_ENTRIES: [string, string][] = HIRA_ENTRIES.map(
  ([kana, romaji]) => [toKatakana(kana), romaji]
)

// カタカナ専用エントリー（ひらがな対応なし）
const KATA_ONLY_ENTRIES: [string, string][] = [
  ['ヴァ', 'va'], ['ヴィ', 'vi'], ['ヴェ', 've'], ['ヴォ', 'vo'],
  ['ヴ',  'vu'],
]

/**
 * かな（ひらがな・カタカナ）→ ローマ字のルックアップテーブル。
 * 2文字キーと1文字キーが混在する。converter は2文字を優先してマッチする。
 */
export const TABLE: Map<string, string> = new Map([
  ...HIRA_ENTRIES,
  ...KATA_ENTRIES,
  ...KATA_ONLY_ENTRIES,
])
```

- [ ] **Step 2: Commit**

```bash
git add src/lib/hepburn/table.ts
git commit -m "feat: かな→ローマ字変換テーブル (table.ts)"
```

---

## Task 5: converter.ts — 変換ロジック

**Files:**
- Create: `src/lib/hepburn/converter.ts`
- Create: `src/lib/hepburn/converter.test.ts`

- [ ] **Step 1: テストを書く**

`src/lib/hepburn/converter.test.ts`:

```ts
import { describe, expect, test } from 'vitest'
import { convert } from './converter'
import { DEFAULT_SETTINGS } from './settings'

// --- 基本変換 ---

describe('基本的なかな変換', () => {
  test('ひらがな母音', () => {
    expect(convert('あいうえお', DEFAULT_SETTINGS).output).toBe('aiueo')
  })

  test('基本子音行', () => {
    expect(convert('かさたなは', DEFAULT_SETTINGS).output).toBe('kasatanaha')
  })

  test('複合拍（2文字）', () => {
    expect(convert('きゃしゃちゃじゃ', DEFAULT_SETTINGS).output).toBe('kyashachaja')
  })

  test('カタカナ変換', () => {
    expect(convert('アイウエオ', DEFAULT_SETTINGS).output).toBe('aiueo')
  })

  test('ひらがなとカタカナが混在', () => {
    expect(convert('あアいイ', DEFAULT_SETTINGS).output).toBe('aiai')
  })
})

// --- っ/ッ ---

describe('促音（っ/ッ）', () => {
  test('っか → kka', () => {
    expect(convert('きって', DEFAULT_SETTINGS).output).toBe('kitte')
  })

  test('っし → sshi', () => {
    expect(convert('ざっし', DEFAULT_SETTINGS).output).toBe('zasshi')
  })

  test('っち → cchi', () => {
    expect(convert('まっち', DEFAULT_SETTINGS).output).toBe('macchi')
  })

  test('っつ → ttsu', () => {
    expect(convert('きっつ', DEFAULT_SETTINGS).output).toBe('kittsu')
  })
})

// --- ん/ン ---

describe('撥音（ん/ン）', () => {
  test('mn規則: b前はm', () => {
    expect(convert('しんぶん', DEFAULT_SETTINGS).output).toBe('shimbun')
  })

  test('mn規則: m前はm', () => {
    expect(convert('まんまる', DEFAULT_SETTINGS).output).toBe('mammaru')
  })

  test('mn規則: p前はm', () => {
    expect(convert('でんぱ', DEFAULT_SETTINGS).output).toBe('dempa')
  })

  test('mn規則: h前はn', () => {
    expect(convert('にほん', DEFAULT_SETTINGS).output).toBe('nihon')
  })

  test('常にn設定', () => {
    expect(convert('しんぶん', { ...DEFAULT_SETTINGS, nasal: 'n' }).output).toBe('shinbun')
  })

  test('アポストロフィ区切り: ん+母音', () => {
    expect(
      convert('きんえん', { ...DEFAULT_SETTINGS, separator: 'apostrophe' }).output
    ).toBe("kin'en")
  })

  test('ハイフン区切り: ん+母音', () => {
    expect(
      convert('きんえん', { ...DEFAULT_SETTINGS, separator: 'hyphen' }).output
    ).toBe('kin-en')
  })

  test('区切りなし（デフォルト）', () => {
    expect(convert('きんえん', DEFAULT_SETTINGS).output).toBe('kinen')
  })

  test('アポストロフィ区切り: ん+y', () => {
    expect(
      convert('しんよう', { ...DEFAULT_SETTINGS, separator: 'apostrophe' }).output
    ).toBe("shin'yo")
  })

  test('区切りなし: ん+y (パスポート式)', () => {
    expect(convert('しんよう', DEFAULT_SETTINGS).output).toBe('shinyo')
  })
})

// --- 長音 ---

describe('長音', () => {
  test('表記なし（パスポート）: おう → o', () => {
    expect(convert('とうきょう', DEFAULT_SETTINGS).output).toBe('tokyo')
  })

  test('マクロン: おう → ō', () => {
    expect(
      convert('とうきょう', { ...DEFAULT_SETTINGS, longVowel: 'macron' }).output
    ).toBe('tōkyō')
  })

  test('重ねる: おう → ou', () => {
    expect(
      convert('とうきょう', { ...DEFAULT_SETTINGS, longVowel: 'double' }).output
    ).toBe('toukyou')
  })

  test('表記なし: カタカナ長音符（ー）を省略', () => {
    expect(convert('ラーメン', DEFAULT_SETTINGS).output).toBe('ramen')
  })

  test('マクロン: カタカナ長音符（ー）', () => {
    expect(
      convert('ラーメン', { ...DEFAULT_SETTINGS, longVowel: 'macron' }).output
    ).toBe('rāmen')
  })

  test('重ねる: カタカナ長音符（ー）', () => {
    expect(
      convert('ラーメン', { ...DEFAULT_SETTINGS, longVowel: 'double' }).output
    ).toBe('raamen')
  })
})

// --- 文字の大小 ---

describe('大文字・小文字', () => {
  test('小文字（デフォルト）', () => {
    expect(convert('とうきょう', DEFAULT_SETTINGS).output).toBe('tokyo')
  })

  test('大文字', () => {
    expect(
      convert('とうきょう', { ...DEFAULT_SETTINGS, caseMode: 'upper' }).output
    ).toBe('TOKYO')
  })

  test('PascalCase: 先頭のみ大文字', () => {
    expect(
      convert('とうきょう', { ...DEFAULT_SETTINGS, caseMode: 'pascal' }).output
    ).toBe('Tokyo')
  })
})

// --- パススルー ---

describe('変換対象外文字', () => {
  test('漢字はそのまま出力', () => {
    expect(convert('東京', DEFAULT_SETTINGS).output).toBe('東京')
    expect(convert('東京', DEFAULT_SETTINGS).hasUntranslatableChars).toBe(false)
  })

  test('漢字+かな混在', () => {
    expect(convert('東京に行く', DEFAULT_SETTINGS).output).toBe('東京niiku')
  })

  test('数字はそのまま', () => {
    expect(convert('123', DEFAULT_SETTINGS).output).toBe('123')
  })

  test('ASCII英字はそのまま', () => {
    expect(convert('hello', DEFAULT_SETTINGS).output).toBe('hello')
  })

  test('絵文字はそのまま出力され hasUntranslatableChars が true', () => {
    const result = convert('😀', DEFAULT_SETTINGS)
    expect(result.output).toBe('😀')
    expect(result.hasUntranslatableChars).toBe(true)
  })

  test('改行はそのまま', () => {
    expect(convert('あ\nい', DEFAULT_SETTINGS).output).toBe('a\ni')
  })

  test('スペースはそのまま', () => {
    expect(convert('あ い', DEFAULT_SETTINGS).output).toBe('a i')
  })
})

// --- 出力文字幅 ---

describe('出力文字幅', () => {
  test('半角（デフォルト）', () => {
    expect(convert('あいう', DEFAULT_SETTINGS).output).toBe('aiu')
  })

  test('全角出力', () => {
    expect(
      convert('あいう', { ...DEFAULT_SETTINGS, width: 'full' }).output
    ).toBe('ａｉｕ')
  })
})

// --- サンプル文 ---

describe('サンプル文', () => {
  test('パスポート式: しんぶんはきんようびにとうきょうへいく', () => {
    expect(
      convert('しんぶんはきんようびにとうきょうへいく', DEFAULT_SETTINGS).output
    ).toBe('shimbunhakinyobinitokyo​heiku')
  })

  test('鉄道式: しんぶんはきんようびにとうきょうへいく', () => {
    expect(
      convert('しんぶんはきんようびにとうきょうへいく', {
        ...DEFAULT_SETTINGS,
        longVowel: 'macron',
        separator: 'hyphen'
      }).output
    ).toBe('shimbunhakin-yōbinitōkyōheiku')
  })
})
```

- [ ] **Step 2: テストが失敗することを確認**

```bash
npm test
```

Expected: `FAIL` with `Cannot find module './converter'`

- [ ] **Step 3: converter.ts を実装**

`src/lib/hepburn/converter.ts`:

```ts
import { normalize } from './normalizer'
import { TABLE } from './table'
import type { HepburnSettings } from './settings'

export type ConvertResult = {
  output: string
  hasUntranslatableChars: boolean
}

const VOWELS = new Set(['a', 'i', 'u', 'e', 'o'])
const LABIALS = new Set(['b', 'm', 'p'])

const MACRON_MAP: Record<string, string> = {
  a: 'ā', i: 'ī', u: 'ū', e: 'ē', o: 'ō',
  ā: 'ā', ī: 'ī', ū: 'ū', ē: 'ē', ō: 'ō'  // idempotent
}

const FULL_WIDTH_OFFSET = 0xFEE0

/** 出力文字列の末尾方向から最初の母音を見つけてマクロン版に置換する */
function applyMacronToLastVowel(s: string): string {
  for (let i = s.length - 1; i >= 0; i--) {
    const ch = s[i].toLowerCase()
    if (ch in MACRON_MAP) {
      const macron = MACRON_MAP[ch]
      return s.slice(0, i) + macron + s.slice(i + 1)
    }
  }
  return s
}

/** っ/ッ の次のかなのローマ字先頭子音を重ねる（例: shi → sshi, chi → cchi） */
function doubleFirstConsonant(romaji: string): string {
  if (!romaji) return ''
  const first = romaji[0].toLowerCase()
  if (VOWELS.has(first)) return romaji  // 母音から始まる場合は何もしない
  return romaji[0] + romaji
}

/** 指定インデックスのかな（複合拍優先）のローマ字を返す。テーブルにない場合は '' */
function getNextRomaji(src: string, idx: number): string {
  const ch = src[idx] ?? ''
  const next = src[idx + 1] ?? ''
  if (TABLE.has(ch + next)) return TABLE.get(ch + next)!
  if (TABLE.has(ch)) return TABLE.get(ch)!
  return ''
}

/** ローマ字文字列が母音または 'y' で始まるか */
function startsWithVowelOrY(s: string): boolean {
  if (!s) return false
  const first = s[0].toLowerCase()
  return VOWELS.has(first) || first === 'y'
}

/**
 * kana が直前の母音に対して長音延長かどうか。
 * う after o-vowel → long ō。それ以外は false。
 */
function isLongVowelExtension(kana: string, lastVowel: string): boolean {
  return (kana === 'う' || kana === 'ウ') && lastVowel === 'o'
}

/** ASCII 半角文字を全角に変換する */
function toFullWidth(s: string): string {
  return [...s].map(ch => {
    const code = ch.charCodeAt(0)
    if (code === 0x20) return '　'
    if (code >= 0x21 && code <= 0x7E) return String.fromCharCode(code + FULL_WIDTH_OFFSET)
    return ch
  }).join('')
}

/** 大文字・小文字変換を適用する */
function applyCaseMode(s: string, caseMode: HepburnSettings['caseMode']): string {
  switch (caseMode) {
    case 'lower': return s.toLowerCase()
    case 'upper': return s.toUpperCase()
    case 'pascal':
      // 自動変換モード（単語境界なし）: 先頭のみ大文字、残りは小文字
      return s.length === 0 ? '' : s[0].toUpperCase() + s.slice(1).toLowerCase()
  }
}

/**
 * 入力文字列をヘボン式ローマ字に変換する。
 * - ひらがな・カタカナ・半角カナ: テーブルで変換
 * - 漢字・数字・記号: そのまま出力
 * - 絵文字・特殊記号: そのまま出力し hasUntranslatableChars = true
 */
export function convert(
  input: string,
  settings: HepburnSettings
): ConvertResult {
  const src = normalize(input)
  let output = ''
  let hasUntranslatableChars = false
  let lastVowel = ''
  let i = 0

  while (i < src.length) {
    const ch = src[i]
    const next = src[i + 1] ?? ''

    // 2文字複合拍（きゃ, しゃ, etc.）
    if (TABLE.has(ch + next)) {
      const romaji = TABLE.get(ch + next)!
      output += romaji
      lastVowel = romaji[romaji.length - 1].toLowerCase()
      i += 2
      continue
    }

    // っ / ッ（促音: 次の子音を重ねる）
    if (ch === 'っ' || ch === 'ッ') {
      const nextRomaji = getNextRomaji(src, i + 1)
      output += doubleFirstConsonant(nextRomaji)
      // lastVowel は更新しない（促音は母音を含まない）
      i++
      continue
    }

    // ん / ン（撥音）
    if (ch === 'ん' || ch === 'ン') {
      const nextRomaji = getNextRomaji(src, i + 1)
      const firstOfNext = nextRomaji[0]?.toLowerCase() ?? ''
      const isLabial = LABIALS.has(firstOfNext)
      let nasal = (settings.nasal === 'mn' && isLabial) ? 'm' : 'n'
      if (settings.separator !== 'none' && startsWithVowelOrY(nextRomaji)) {
        nasal += settings.separator === 'apostrophe' ? "'" : '-'
      }
      output += nasal
      lastVowel = ''
      i++
      continue
    }

    // ー（長音符: 直前の母音を延長）
    if (ch === 'ー') {
      if (settings.longVowel === 'macron') {
        output = applyMacronToLastVowel(output)
      } else if (settings.longVowel === 'double' && lastVowel) {
        output += lastVowel
      }
      // 'omit': 何もしない
      i++
      continue
    }

    // 単拍かな（テーブルにある1文字）
    if (TABLE.has(ch)) {
      const romaji = TABLE.get(ch)!
      const thisVowel = romaji[romaji.length - 1].toLowerCase()

      if (isLongVowelExtension(ch, lastVowel)) {
        // 長音延長処理
        if (settings.longVowel === 'macron') {
          output = applyMacronToLastVowel(output)
        } else if (settings.longVowel === 'double') {
          output += romaji
          lastVowel = thisVowel
        }
        // 'omit': 何もしない（このかなを飛ばす）
      } else {
        output += romaji
        lastVowel = thisVowel
      }
      i++
      continue
    }

    // ASCII 英字（ヘボン式として正規化せずそのまま通す）
    if (/[a-zA-Z]/.test(ch)) {
      output += ch
      if (VOWELS.has(ch.toLowerCase())) lastVowel = ch.toLowerCase()
      i++
      continue
    }

    // 空白・改行
    if (/\s/.test(ch)) {
      output += ch
      lastVowel = ''
      i++
      continue
    }

    // 漢字（CJK 統合漢字: U+4E00–U+9FFF, 拡張 U+3400–U+4DBF）
    const codePoint = ch.codePointAt(0)!
    const isKanji = (codePoint >= 0x4E00 && codePoint <= 0x9FFF) ||
                    (codePoint >= 0x3400 && codePoint <= 0x4DBF)
    if (isKanji) {
      output += ch
      lastVowel = ''
      i += ch.length  // サロゲートペアに対応
      continue
    }

    // 数字
    if (/\d/.test(ch)) {
      output += ch
      lastVowel = ''
      i++
      continue
    }

    // 日本語句読点・記号（変換不可フラグを立てない）
    const isJaPunctuation = /[。、・〜～「」『』【】…‥〔〕〈〉《》、。，．・：；？！—～〜・ー（）]/.test(ch)
    const isAsciiPunctuation = /[!"#$%&'()*+,\-./:;<=>?@[\\\]^_`{|}~]/.test(ch)
    if (isJaPunctuation || isAsciiPunctuation) {
      output += ch
      lastVowel = ''
      i++
      continue
    }

    // それ以外（絵文字・特殊記号など）: そのまま出力し flagを立てる
    output += ch
    hasUntranslatableChars = true
    lastVowel = ''
    // codePointAt は surrogateを考慮: 絵文字は2コードユニット
    i += ch.length > 1 ? ch.length : (codePoint > 0xFFFF ? 2 : 1)
    continue
  }

  // 大文字・小文字変換
  output = applyCaseMode(output, settings.caseMode)

  // 全角変換
  if (settings.width === 'full') {
    output = toFullWidth(output)
  }

  return { output, hasUntranslatableChars }
}
```

- [ ] **Step 4: テストが通ることを確認**

```bash
npm test
```

Expected: すべてのテスト PASS。失敗する場合は出力を確認し、テーブルの定義またはロジックを修正する。

- [ ] **Step 5: Commit**

```bash
git add src/lib/hepburn/converter.ts src/lib/hepburn/converter.test.ts
git commit -m "feat: ヘボン式変換ロジック (converter.ts)"
```

---

## Task 6: ナビゲーション — layout + トップページ

**Files:**
- Modify: `src/routes/+layout.svelte`
- Modify: `src/routes/+page.svelte`

- [ ] **Step 1: +layout.svelte を更新（ヘッダーナビ追加）**

`src/routes/+layout.svelte`:

```svelte
<script lang="ts">
  import '../app.css'
  import favicon from '$lib/assets/favicon.svg'
  import { page } from '$app/stores'

  let { children } = $props()
</script>

<svelte:head>
  <link rel="icon" href="{favicon}" />
</svelte:head>

<div class="min-h-screen flex flex-col">
  <header class="border-b border-gray-200 bg-white sticky top-0 z-10">
    <nav class="max-w-4xl mx-auto px-4 py-2 flex items-center gap-6">
      <a href="/" class="font-bold text-gray-800 mr-2">Utilities</a>
      <a
        href="/bpm-tapper"
        class="text-sm font-medium transition-colors"
        class:text-blue-600={$page.url.pathname === '/bpm-tapper'}
        class:text-gray-500={$page.url.pathname !== '/bpm-tapper'}
      >
        BPM Tapper
      </a>
      <a
        href="/hepburn-converter"
        class="text-sm font-medium transition-colors"
        class:text-blue-600={$page.url.pathname === '/hepburn-converter'}
        class:text-gray-500={$page.url.pathname !== '/hepburn-converter'}
      >
        ヘボン式変換
      </a>
    </nav>
  </header>

  <main class="flex-1">
    {@render children()}
  </main>
</div>
```

- [ ] **Step 2: +page.svelte をツール一覧に作り直す**

`src/routes/+page.svelte`:

```svelte
<svelte:head>
  <title>Utilities</title>
</svelte:head>

<div class="max-w-4xl mx-auto px-4 py-12">
  <h1 class="text-3xl font-bold text-gray-800 mb-8">Utilities</h1>

  <div class="grid grid-cols-1 sm:grid-cols-2 gap-4">
    <a
      href="/bpm-tapper"
      class="block p-6 border border-gray-200 rounded-xl hover:border-blue-400 hover:shadow-sm transition-all"
    >
      <h2 class="text-lg font-semibold text-gray-800 mb-1">BPM Tapper</h2>
      <p class="text-sm text-gray-500">ビートを叩いてBPMを計測するツール</p>
    </a>

    <a
      href="/hepburn-converter"
      class="block p-6 border border-gray-200 rounded-xl hover:border-blue-400 hover:shadow-sm transition-all"
    >
      <h2 class="text-lg font-semibold text-gray-800 mb-1">ヘボン式変換</h2>
      <p class="text-sm text-gray-500">日本語（ひらがな・カタカナ）をヘボン式ローマ字に変換するツール</p>
    </a>
  </div>
</div>
```

- [ ] **Step 3: 動作確認**

```bash
npm run dev
```

- `http://localhost:5173/` → ツール一覧カードが2枚表示されること
- `/bpm-tapper` リンクをクリック → BPM Tapperが開くこと
- ナビバーの「BPM Tapper」が青くハイライトされること
- `/hepburn-converter` はまだ404（Task 7で追加）

- [ ] **Step 4: Commit**

```bash
git add src/routes/+layout.svelte src/routes/+page.svelte
git commit -m "feat: ヘッダーナビとツール一覧トップページを追加"
```

---

## Task 7: hepburn-converter/+page.svelte — 変換ツール UI

**Files:**
- Create: `src/routes/hepburn-converter/+page.svelte`

- [ ] **Step 1: ページファイルを作成**

`src/routes/hepburn-converter/+page.svelte`:

```svelte
<script lang="ts">
  import { onMount } from 'svelte'
  import { loadDefaultJapaneseParser } from 'budoux'
  import { convert } from '$lib/hepburn/converter'
  import {
    DEFAULT_SETTINGS,
    PRESET_VALUES,
    loadSettings,
    saveSettings,
    applyPreset,
    applyIndividualChange,
    type HepburnSettings,
    type Preset,
    type LongVowel,
    type Nasal,
    type Separator,
    type Width,
    type CaseMode
  } from '$lib/hepburn/settings'

  // --- 状態 ---
  let inputText = $state('')
  let outputText = $state('')
  let settings = $state<HepburnSettings>(DEFAULT_SETTINGS)
  let hasUntranslatableChars = $state(false)
  let settingsChangedWarning = $state(false)
  let copySuccess = $state(false)
  let isConverting = $state(false)
  let isComposing = $state(false)
  let isSettingsPanelOpen = $state(false)  // スマホ用アコーディオン

  // budoux パーサー
  type Parser = ReturnType<typeof loadDefaultJapaneseParser>
  let parser = $state<Parser | null>(null)
  let parserStatus = $state<'loading' | 'ready' | 'error'>('loading')

  // デバウンス用タイマー
  let autoConvertTimer: ReturnType<typeof setTimeout> | null = null
  let copyTimer: ReturnType<typeof setTimeout> | null = null

  // --- 定数 ---
  const CHAR_LIMIT = 10000
  const SAMPLE_TEXT = 'しんぶんはきんようびにとうきょうへいく'

  // --- 派生値 ---
  const charCount = $derived(inputText.length)
  const isOverLimit = $derived(charCount > CHAR_LIMIT)
  const sampleOutput = $derived(convert(SAMPLE_TEXT, settings).output)

  // --- 初期化 ---
  onMount(() => {
    // LocalStorage から設定を復元
    settings = loadSettings()

    // budoux パーサーを初期化（同期）
    try {
      parser = loadDefaultJapaneseParser()
      parserStatus = 'ready'
    } catch {
      parserStatus = 'error'
    }
  })

  // --- 変換処理 ---

  function autoConvert() {
    if (isOverLimit || !inputText) {
      outputText = ''
      hasUntranslatableChars = false
      return
    }
    const result = convert(inputText, settings)
    outputText = result.output
    hasUntranslatableChars = result.hasUntranslatableChars
    settingsChangedWarning = false
  }

  function scheduleAutoConvert() {
    if (autoConvertTimer !== null) clearTimeout(autoConvertTimer)
    autoConvertTimer = setTimeout(autoConvert, 300)
  }

  function handleInput() {
    if (!isComposing) scheduleAutoConvert()
  }

  function handleCompositionStart() {
    isComposing = true
  }

  function handleCompositionEnd() {
    isComposing = false
    autoConvert()
  }

  function handleButtonConvert() {
    if (!parser || parserStatus !== 'ready') return
    isConverting = true

    const segments = parser.parse(inputText)

    if (settings.caseMode === 'pascal') {
      const parts = segments.map(seg => {
        const r = convert(seg, { ...settings, caseMode: 'lower' })
        return {
          text: r.output.length > 0
            ? r.output[0].toUpperCase() + r.output.slice(1)
            : '',
          hasUntranslatable: r.hasUntranslatableChars
        }
      })
      hasUntranslatableChars = parts.some(p => p.hasUntranslatable)
      outputText = settings.pascalSpaces
        ? parts.map(p => p.text).join(' ')
        : parts.map(p => p.text).join('')
    } else {
      const parts = segments.map(seg => convert(seg, settings))
      hasUntranslatableChars = parts.some(p => p.hasUntranslatableChars)
      outputText = parts.map(p => p.output).join(' ')
    }

    settingsChangedWarning = false
    isConverting = false
  }

  function handleClear() {
    inputText = ''
    outputText = ''
    hasUntranslatableChars = false
    settingsChangedWarning = false
  }

  async function handleCopy() {
    if (!outputText) return
    try {
      await navigator.clipboard.writeText(outputText)
      copySuccess = true
      if (copyTimer !== null) clearTimeout(copyTimer)
      copyTimer = setTimeout(() => { copySuccess = false }, 2000)
    } catch {
      // クリップボード API が使えない場合は無視
    }
  }

  function handleRetryParser() {
    parserStatus = 'loading'
    try {
      parser = loadDefaultJapaneseParser()
      parserStatus = 'ready'
    } catch {
      parserStatus = 'error'
    }
  }

  // --- 設定変更ハンドラー ---

  function onPresetChange(e: Event) {
    const value = (e.target as HTMLSelectElement).value as Preset
    settings = applyPreset(settings, value)
    saveSettings(settings)
    onSettingsChanged()
  }

  function onLongVowelChange(e: Event) {
    const value = (e.target as HTMLSelectElement).value as LongVowel
    settings = applyIndividualChange(settings, 'longVowel', value)
    saveSettings(settings)
    onSettingsChanged()
  }

  function onNasalChange(e: Event) {
    const value = (e.target as HTMLSelectElement).value as Nasal
    settings = applyIndividualChange(settings, 'nasal', value)
    saveSettings(settings)
    onSettingsChanged()
  }

  function onSeparatorChange(e: Event) {
    const value = (e.target as HTMLSelectElement).value as Separator
    settings = applyIndividualChange(settings, 'separator', value)
    saveSettings(settings)
    onSettingsChanged()
  }

  function onWidthChange(e: Event) {
    const value = (e.target as HTMLSelectElement).value as Width
    settings = applyIndividualChange(settings, 'width', value)
    saveSettings(settings)
    onSettingsChanged()
  }

  function onCaseModeChange(e: Event) {
    const value = (e.target as HTMLSelectElement).value as CaseMode
    settings = applyIndividualChange(settings, 'caseMode', value)
    saveSettings(settings)
    onSettingsChanged()
  }

  function onPascalSpacesChange(e: Event) {
    const value = (e.target as HTMLInputElement).checked
    settings = applyIndividualChange(settings, 'pascalSpaces', value)
    saveSettings(settings)
    onSettingsChanged()
  }

  function onSettingsChanged() {
    if (inputText) {
      settingsChangedWarning = true
      // 設定変更時も自動変換を実行（ただし警告は表示したまま）
      autoConvert()
    }
  }
</script>

<svelte:head>
  <title>ヘボン式変換 — Utilities</title>
</svelte:head>

<div class="max-w-4xl mx-auto px-4 py-6">

  <!-- タイトル -->
  <h1 class="text-2xl font-bold text-gray-800 mb-3">ヘボン式ローマ字変換</h1>

  <!-- 説明文・注意文 -->
  <div class="text-sm text-gray-600 space-y-1 mb-5">
    <p>ひらがな・カタカナ・半角カナをヘボン式ローマ字に変換します。漢字はそのまま出力されます。</p>
    <p>入力中は自動で変換されます（単語の区切りなし）。「変換」ボタンを押すと、形態素解析を行って単語ごとに区切った結果に変換し直します。</p>
    <p class="text-amber-600">変換結果は誤りを含む場合があります。出力内容は必ずご自身でご確認ください。</p>
  </div>

  <!-- 設定パネル -->
  <div class="border border-gray-200 rounded-xl mb-6 overflow-hidden">
    <!-- スマホ: アコーディオンヘッダー -->
    <button
      type="button"
      class="w-full flex justify-between items-center px-4 py-3 bg-gray-50 text-sm font-medium text-gray-700 sm:hidden"
      onclick={() => { isSettingsPanelOpen = !isSettingsPanelOpen }}
    >
      ヘボン式ルール設定
      <span>{isSettingsPanelOpen ? '▲' : '▼'}</span>
    </button>

    <div class:hidden={!isSettingsPanelOpen} class="sm:block p-4 space-y-4">

      <!-- プリセット -->
      <div class="flex flex-wrap items-center gap-3">
        <label class="text-sm font-medium text-gray-700 w-28 shrink-0">プリセット</label>
        <select
          class="border border-gray-300 rounded-lg px-3 py-1.5 text-sm"
          value={settings.preset}
          onchange={onPresetChange}
        >
          <option value="passport">パスポート式（デフォルト）</option>
          <option value="railway">鉄道式</option>
          <option value="road">道路標識式</option>
          <option value="custom">カスタム</option>
        </select>
      </div>

      <hr class="border-gray-100" />

      <!-- 個別設定 -->
      <div class="grid grid-cols-1 sm:grid-cols-2 gap-3">

        <div class="flex items-center gap-2">
          <label class="text-sm text-gray-600 w-36 shrink-0">長音の表記</label>
          <select
            class="border border-gray-300 rounded-lg px-2 py-1 text-sm flex-1"
            value={settings.longVowel}
            onchange={onLongVowelChange}
          >
            <option value="omit">表記しない</option>
            <option value="macron">マクロン（ā, ī, ū, ē, ō）</option>
            <option value="double">母音を重ねる</option>
          </select>
        </div>

        <div class="flex items-center gap-2">
          <label class="text-sm text-gray-600 w-36 shrink-0">撥音「ん」</label>
          <select
            class="border border-gray-300 rounded-lg px-2 py-1 text-sm flex-1"
            value={settings.nasal}
            onchange={onNasalChange}
          >
            <option value="mn">b/m/p前はm、それ以外はn</option>
            <option value="n">常にn</option>
          </select>
        </div>

        <div class="flex items-center gap-2">
          <label class="text-sm text-gray-600 w-36 shrink-0">撥音＋母音・y続く場合</label>
          <select
            class="border border-gray-300 rounded-lg px-2 py-1 text-sm flex-1"
            value={settings.separator}
            onchange={onSeparatorChange}
          >
            <option value="none">何もしない</option>
            <option value="apostrophe">アポストロフィ（n'）</option>
            <option value="hyphen">ハイフン（n-）</option>
          </select>
        </div>

        <div class="flex items-center gap-2">
          <label class="text-sm text-gray-600 w-36 shrink-0">出力の文字幅</label>
          <select
            class="border border-gray-300 rounded-lg px-2 py-1 text-sm flex-1"
            value={settings.width}
            onchange={onWidthChange}
          >
            <option value="half">半角</option>
            <option value="full">全角</option>
          </select>
        </div>

        <div class="flex items-center gap-2">
          <label class="text-sm text-gray-600 w-36 shrink-0">アルファベット</label>
          <select
            class="border border-gray-300 rounded-lg px-2 py-1 text-sm flex-1"
            value={settings.caseMode}
            onchange={onCaseModeChange}
          >
            <option value="lower">小文字</option>
            <option value="upper">大文字</option>
            <option value="pascal">PascalCase</option>
          </select>
        </div>

        {#if settings.caseMode === 'pascal'}
          <div class="flex items-center gap-2">
            <label class="text-sm text-gray-600 w-36 shrink-0">PascalCase スペース</label>
            <label class="flex items-center gap-1.5 text-sm text-gray-600 cursor-pointer">
              <input
                type="checkbox"
                checked={settings.pascalSpaces}
                onchange={onPascalSpacesChange}
              />
              変換ボタン時にスペースを入れる
            </label>
          </div>
        {/if}

      </div>

      <!-- 変換例 -->
      <div class="bg-gray-50 rounded-lg px-4 py-3 text-sm text-gray-600">
        <span class="font-medium">変換例：</span>
        {SAMPLE_TEXT} → <span class="font-mono text-gray-800">{sampleOutput}</span>
      </div>
    </div>
  </div>

  <!-- PC: 入力 / ボタン / 出力 横並び -->
  <div class="hidden sm:grid grid-cols-[1fr_auto_1fr] gap-4 items-start">

    <!-- 入力欄 -->
    <div class="flex flex-col gap-2">
      <label class="text-sm font-medium text-gray-700">入力</label>
      <textarea
        class="w-full h-48 border border-gray-300 rounded-xl px-3 py-2 text-sm resize-y focus:outline-none focus:ring-2 focus:ring-blue-300"
        placeholder="ひらがな・カタカナ・半角カナを入力..."
        bind:value={inputText}
        oninput={handleInput}
        oncompositionstart={handleCompositionStart}
        oncompositionend={handleCompositionEnd}
      ></textarea>
      <div class="flex items-center justify-between text-xs text-gray-400">
        <span class:text-amber-500={isOverLimit}>{charCount.toLocaleString()}文字</span>
        <button
          type="button"
          class="px-3 py-1 border border-gray-300 rounded-lg hover:bg-gray-50 text-gray-600"
          onclick={handleClear}
        >クリア</button>
      </div>
      {#if isOverLimit}
        <p class="text-xs text-amber-600">文字数が多いため、自動変換を停止しました</p>
      {/if}
    </div>

    <!-- 変換ボタン -->
    <div class="flex flex-col items-center justify-center pt-8 gap-2">
      {#if parserStatus === 'error'}
        <p class="text-xs text-red-500 text-center mb-1">形態素解析の<br/>読み込みに<br/>失敗しました</p>
        <button
          type="button"
          class="px-4 py-2 bg-gray-100 border border-gray-300 rounded-lg text-sm text-gray-700 hover:bg-gray-200"
          onclick={handleRetryParser}
        >再試行</button>
      {:else}
        <button
          type="button"
          class="px-5 py-3 bg-blue-600 text-white rounded-xl font-medium text-sm hover:bg-blue-700 disabled:opacity-50 disabled:cursor-not-allowed leading-tight text-center"
          disabled={parserStatus !== 'ready' || isConverting}
          onclick={handleButtonConvert}
        >
          {#if parserStatus === 'loading'}
            準備中...
          {:else if isConverting}
            変換中...
          {:else}
            変換<br/><span class="text-xs font-normal opacity-80">（形態素解析）</span>
          {/if}
        </button>
      {/if}
    </div>

    <!-- 出力欄 -->
    <div class="flex flex-col gap-2">
      <label class="text-sm font-medium text-gray-700">出力</label>
      <textarea
        class="w-full h-48 border border-gray-200 rounded-xl px-3 py-2 text-sm bg-gray-50 resize-y focus:outline-none"
        readonly
        value={outputText}
      ></textarea>
      <div class="flex justify-end">
        <button
          type="button"
          class="px-3 py-1 border border-gray-300 rounded-lg text-sm hover:bg-gray-50 text-gray-600"
          onclick={handleCopy}
        >
          {copySuccess ? 'コピーしました ✓' : 'コピー'}
        </button>
      </div>
    </div>

  </div>

  <!-- スマホ: 縦並び -->
  <div class="sm:hidden flex flex-col gap-4">

    <!-- 入力欄 -->
    <div class="flex flex-col gap-2">
      <label class="text-sm font-medium text-gray-700">入力</label>
      <textarea
        class="w-full h-32 border border-gray-300 rounded-xl px-3 py-2 text-sm resize-none focus:outline-none focus:ring-2 focus:ring-blue-300"
        placeholder="ひらがな・カタカナ・半角カナを入力..."
        bind:value={inputText}
        oninput={handleInput}
        oncompositionstart={handleCompositionStart}
        oncompositionend={handleCompositionEnd}
      ></textarea>
      <div class="flex items-center justify-between text-xs text-gray-400">
        <span class:text-amber-500={isOverLimit}>{charCount.toLocaleString()}文字</span>
        <button
          type="button"
          class="px-3 py-1 border border-gray-300 rounded-lg hover:bg-gray-50 text-gray-600"
          onclick={handleClear}
        >クリア</button>
      </div>
      {#if isOverLimit}
        <p class="text-xs text-amber-600">文字数が多いため、自動変換を停止しました</p>
      {/if}
    </div>

    <!-- 変換ボタン -->
    <div class="flex justify-center">
      {#if parserStatus === 'error'}
        <div class="flex flex-col items-center gap-2">
          <p class="text-sm text-red-500">形態素解析の読み込みに失敗しました</p>
          <button
            type="button"
            class="px-4 py-2 bg-gray-100 border border-gray-300 rounded-lg text-sm text-gray-700 hover:bg-gray-200"
            onclick={handleRetryParser}
          >再試行</button>
        </div>
      {:else}
        <button
          type="button"
          class="px-8 py-3 bg-blue-600 text-white rounded-xl font-medium text-sm hover:bg-blue-700 disabled:opacity-50 disabled:cursor-not-allowed leading-tight text-center"
          disabled={parserStatus !== 'ready' || isConverting}
          onclick={handleButtonConvert}
        >
          {#if parserStatus === 'loading'}
            準備中...
          {:else if isConverting}
            変換中...
          {:else}
            変換<br/><span class="text-xs font-normal opacity-80">（形態素解析）</span>
          {/if}
        </button>
      {/if}
    </div>

    <!-- 出力欄 -->
    <div class="flex flex-col gap-2">
      <label class="text-sm font-medium text-gray-700">出力</label>
      <textarea
        class="w-full h-32 border border-gray-200 rounded-xl px-3 py-2 text-sm bg-gray-50 resize-none focus:outline-none"
        readonly
        value={outputText}
      ></textarea>
      <div class="flex justify-end">
        <button
          type="button"
          class="px-3 py-1 border border-gray-300 rounded-lg text-sm hover:bg-gray-50 text-gray-600"
          onclick={handleCopy}
        >
          {copySuccess ? 'コピーしました ✓' : 'コピー'}
        </button>
      </div>
    </div>

  </div>

  <!-- 警告メッセージエリア -->
  <div class="mt-4 space-y-2">
    {#if settingsChangedWarning}
      <p class="text-sm text-blue-600">
        設定が変更されました。変換ボタンを押して再変換してください。
      </p>
    {/if}
    {#if hasUntranslatableChars}
      <p class="text-sm text-amber-600">変換できない文字が含まれています</p>
    {/if}
  </div>

</div>
```

- [ ] **Step 2: ブラウザで動作確認**

```bash
npm run dev
```

以下を確認する：

**基本動作:**
- [ ] `http://localhost:5173/hepburn-converter` が開く
- [ ] 「あいうえお」を入力 → 「aiueo」が自動変換される
- [ ] 「東京」を入力 → 「東京」がそのまま出力される（漢字パス）
- [ ] 「ラーメン」を入力 → パスポート設定では「ramen」、マクロン設定では「rāmen」

**設定パネル:**
- [ ] プリセット「鉄道式」に変更 → サンプル変換例が変わる
- [ ] 設定変更後に入力があれば警告が表示される
- [ ] 変換ボタンを押したら警告が消える

**変換ボタン:**
- [ ] 「しんぶんはきんようびにとうきょうへいく」を入力し変換ボタン → 単語区切りスペースが入った結果が出る
- [ ] PascalCase + スペースあり → 各単語の先頭が大文字

**UI/UX:**
- [ ] コピーボタン → 「コピーしました ✓」に変わり2秒後に戻る
- [ ] クリアボタン → 入力・出力がリセットされる
- [ ] ナビの「ヘボン式変換」がハイライトされる

**スマホ（ブラウザ幅を狭める）:**
- [ ] 設定パネルがデフォルト折りたたみ状態
- [ ] 「ヘボン式ルール設定」ボタンで開閉できる
- [ ] 入力欄→変換ボタン→出力欄の縦並びレイアウト

**LocalStorage:**
- [ ] 設定を変更してページをリロード → 設定が保持される

- [ ] **Step 3: Commit**

```bash
git add src/routes/hepburn-converter/+page.svelte
git commit -m "feat: ヘボン式ローマ字変換ツールページを追加"
```

---

## Self-Review

### スペック対応チェック

| 仕様 | 対応タスク |
|---|---|
| ひらがな・カタカナ・半角カナ変換 | Task 2, 4, 5 |
| 漢字はそのまま | Task 5 |
| 既存ローマ字（ASCII）はそのまま | Task 5 |
| 変換不可文字をフラグ + 警告 | Task 5, 7 |
| プリセット（パスポート・鉄道・道路） | Task 3 |
| 個別設定5項目 | Task 3, 7 |
| 個別設定変更でカスタムに切替 | Task 3 |
| 設定パネル内サンプル変換例リアルタイム更新 | Task 7 |
| PascalCase スペース設定 | Task 3, 7 |
| 半角カナ正規化 | Task 2 |
| 自動変換: デバウンス（半角）| Task 7 |
| 自動変換: compositionend（全角）| Task 7 |
| 変換ボタン: budoux 形態素解析 | Task 7 |
| budoux: バックグラウンドロード | Task 7 |
| budoux: 準備中/完了/エラー状態 | Task 7 |
| 文字数カウンター | Task 7 |
| 10,000文字超で自動変換停止 + 警告 | Task 7 |
| クリアボタン | Task 7 |
| コピーボタン + フィードバック | Task 7 |
| 設定変更後の再変換警告 | Task 7 |
| LocalStorage で設定を保持 | Task 3, 7 |
| PC横並びレイアウト | Task 7 |
| スマホ縦並びレイアウト + アコーディオン | Task 7 |
| ローディング表示（変換中）| Task 7 |
| 全ページ共通ナビ | Task 6 |
| トップページ作り直し | Task 6 |

### プレースホルダーなし確認
すべてのタスクに実際のコードを含む。TBD/TODOなし。

### 型整合性確認
- `HepburnSettings` の型は Task 3 で定義し、Task 5・7 で使用
- `convert()` の戻り値 `ConvertResult` は Task 5 で定義
- `loadDefaultJapaneseParser()` の型は Task 7 でインラインで解決
- `applyPreset` / `applyIndividualChange` は Task 3 で定義し Task 7 で使用
