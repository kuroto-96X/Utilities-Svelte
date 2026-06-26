/**
 * 半角カナ（ﾊｰﾌｶﾅ）を全角カタカナに正規化する。
 * String.prototype.normalize('NFKC') を使用する。
 * 半角濁点・半濁点（ﾞ/ﾟ）が基字と分離している場合も結合される。
 */
export function normalize(input: string): string {
  return input.normalize('NFKC')
}
