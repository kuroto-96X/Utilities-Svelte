export interface PixelCrop {
  x: number
  y: number
  width: number
  height: number
}

export function buildDownloadFileName(presetId: string): string {
  return `${presetId}.png`
}

export async function cropToBlob(
  imageFile: File,
  pixelCrop: PixelCrop,
  outputWidth: number,
  outputHeight: number
): Promise<Blob> {
  const src = URL.createObjectURL(imageFile)
  try {
    const image = await loadImage(src)
    const canvas = document.createElement('canvas')
    canvas.width = outputWidth
    canvas.height = outputHeight
    const ctx = canvas.getContext('2d')!
    ctx.drawImage(
      image,
      pixelCrop.x,
      pixelCrop.y,
      pixelCrop.width,
      pixelCrop.height,
      0,
      0,
      outputWidth,
      outputHeight
    )
    return await new Promise<Blob>((resolve, reject) => {
      canvas.toBlob((blob) => {
        if (blob) resolve(blob)
        else reject(new Error('canvas.toBlob が null を返しました'))
      }, 'image/png')
    })
  } finally {
    URL.revokeObjectURL(src)
  }
}

function loadImage(src: string): Promise<HTMLImageElement> {
  return new Promise((resolve, reject) => {
    const img = new Image()
    img.onload = () => resolve(img)
    img.onerror = reject
    img.src = src
  })
}
