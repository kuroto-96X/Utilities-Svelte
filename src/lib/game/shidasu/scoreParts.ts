// 得点内訳の1ステップを表す構造化データ。kind='add'は加算量、kind='multiply'は倍率をamountに持つ。
// kind='lock'は特殊ステップで、それまでの仮合計に関わらず以降の合計を0にする(ボス得点ロック用)。
// textは従来通りの表示用文字列(例: "基礎点+10")で、既存のテスト・非対応箇所での表示に使う。
export interface ScorePart {
  label: string
  kind: 'add' | 'multiply' | 'lock'
  amount: number
  text: string
  cardIds?: number[] // ハイライト対象カードのCard.id一覧。対象カードが無いパーツ(基礎点・護符効果等)では省略する
}

// 護符の内訳表示用に倍率を丸めて整形する(浮動小数の誤差で末尾が長くなるのを防ぐ)
export function fmtMultiplier(n: number): string {
  return String(Math.round(n * 100) / 100)
}

export function addPart(label: string, amount: number, cardIds?: number[]): ScorePart {
  return { label, kind: 'add', amount, text: `${label}+${amount}`, cardIds }
}

export function multiplyPart(label: string, factor: number): ScorePart {
  return { label, kind: 'multiply', amount: factor, text: `${label}×${fmtMultiplier(factor)}` }
}

export function lockPart(label: string): ScorePart {
  return { label, kind: 'lock', amount: 0, text: label }
}

// ScorePartを先頭から順に適用し、各ステップ後の仮合計を返す。addは加算、multiplyは乗算(浮動小数のまま
// 保持し、床関数は最後の要素にのみ適用しない=呼び出し側が最終値にfinalScoreFromScorePartsで丸める)、
// lockは合計を0にする。engine.tsのapplyPlayCardが実際に行っている計算(護符効果を順に適用し、最後に
// コンボ倍率・マンナズ倍率をかけて1回だけ床関数を適用する)と同じ順序・同じ数値を構造化データとして
// 再生するため、両者の結果は常に一致する。
export function runningTotalsFromScoreParts(parts: ScorePart[]): number[] {
  const totals: number[] = []
  let running = 0
  for (const part of parts) {
    if (part.kind === 'add') running += part.amount
    else if (part.kind === 'multiply') running *= part.amount
    else running = 0
    totals.push(running)
  }
  return totals
}

// 最終的な仮合計(床関数を適用した整数)を返す。partsが空の場合は0を返す。
export function finalScoreFromScoreParts(parts: ScorePart[]): number {
  const totals = runningTotalsFromScoreParts(parts)
  return totals.length > 0 ? Math.floor(totals[totals.length - 1]) : 0
}
