export interface GridLayout {
  cols: number
  rows: number
  marginX: number
  marginY: number
  positions: Array<{ x: number; y: number }>
}

export function computeGridLayout(
  sheetWidthPx: number,
  sheetHeightPx: number,
  photoWidthPx: number,
  photoHeightPx: number,
  count: number
): GridLayout {
  const maxCols = Math.floor(sheetWidthPx / photoWidthPx)
  const maxRows = Math.floor(sheetHeightPx / photoHeightPx)
  const cols = Math.min(maxCols, count)
  const rows = Math.ceil(count / cols)

  if (rows > maxRows) {
    throw new Error(`${count}枚はシートに収まりません`)
  }

  const marginX = (sheetWidthPx - cols * photoWidthPx) / (cols + 1)
  const marginY = (sheetHeightPx - rows * photoHeightPx) / (rows + 1)

  const positions: Array<{ x: number; y: number }> = []
  for (let i = 0; i < count; i++) {
    const col = i % cols
    const row = Math.floor(i / cols)
    positions.push({
      x: marginX * (col + 1) + photoWidthPx * col,
      y: marginY * (row + 1) + photoHeightPx * row,
    })
  }

  return { cols, rows, marginX, marginY, positions }
}

export async function compositeSheet(
  photoBlobUrl: string,
  sheetWidthPx: number,
  sheetHeightPx: number,
  photoWidthPx: number,
  photoHeightPx: number,
  count: number
): Promise<Blob> {
  const layout = computeGridLayout(sheetWidthPx, sheetHeightPx, photoWidthPx, photoHeightPx, count)
  const img = await loadImage(photoBlobUrl)

  const canvas = document.createElement('canvas')
  canvas.width = sheetWidthPx
  canvas.height = sheetHeightPx
  const ctx = canvas.getContext('2d')!
  ctx.fillStyle = 'white'
  ctx.fillRect(0, 0, sheetWidthPx, sheetHeightPx)

  for (const { x, y } of layout.positions) {
    ctx.drawImage(img, x, y, photoWidthPx, photoHeightPx)
  }

  return new Promise<Blob>((resolve, reject) => {
    canvas.toBlob((blob) => {
      if (blob) resolve(blob)
      else reject(new Error('canvas.toBlob が null を返しました'))
    }, 'image/png')
  })
}

function loadImage(src: string): Promise<HTMLImageElement> {
  return new Promise((resolve, reject) => {
    const img = new Image()
    img.onload = () => resolve(img)
    img.onerror = reject
    img.src = src
  })
}
