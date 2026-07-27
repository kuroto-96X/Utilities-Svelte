// 次にチェーンへ追加される1枚のカードが、チェーン置き場のどの行・列に配置されるかを計算する。
// プレイでチェーンに追加されるカードのchainOriginは常に'play'であり、
// PlayArea.svelteの描画ルール(top: origin==='draw' ? 20 : 0)によりtopは常に0になる。
export interface ChainSlotPosition {
  row: number
  col: number
  left: number
  top: number
}

export function nextChainSlotPosition(
  currentChainLength: number,
  chainCardOffsetX: number,
  chainCardsPerRow: number,
): ChainSlotPosition {
  const row = Math.floor(currentChainLength / chainCardsPerRow)
  const col = currentChainLength % chainCardsPerRow
  return { row, col, left: col * chainCardOffsetX, top: 0 }
}
