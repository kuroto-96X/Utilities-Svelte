export type OutputFormat = 'image/jpeg' | 'image/png' | 'image/webp'

export interface ConvertOptions {
  format: OutputFormat
  quality: number        // 10–100; ignored for PNG
  width?: number         // target width in px; undefined = use source
  height?: number        // target height in px; undefined = use source
  keepAspectRatio: boolean
  noResize: boolean      // when true, skip resize entirely
}

export interface ConvertResult {
  blob: Blob
  objectUrl: string      // caller must revoke when done
  originalSize: number
  convertedSize: number
  reductionPercent: number
  fileName: string
  originalFile: File
}

const SUPPORTED_TYPES = ['image/jpeg', 'image/png', 'image/webp', 'image/gif']

const FORMAT_EXT: Record<OutputFormat, string> = {
  'image/jpeg': 'jpg',
  'image/png': 'png',
  'image/webp': 'webp',
}

export function isSupported(file: File): boolean {
  return SUPPORTED_TYPES.includes(file.type)
}

export function getOutputFileName(originalName: string, format: OutputFormat): string {
  const base = originalName.replace(/\.[^.]+$/, '')
  return `${base}.${FORMAT_EXT[format]}`
}

export function calcReduction(originalSize: number, convertedSize: number): number {
  return Math.round((1 - convertedSize / originalSize) * 100)
}

async function loadImage(file: File): Promise<HTMLImageElement> {
  const url = URL.createObjectURL(file)
  try {
    return await new Promise((resolve, reject) => {
      const img = new Image()
      img.onload = () => resolve(img)
      img.onerror = () => reject(new Error('画像の読み込みに失敗しました'))
      img.src = url
    })
  } finally {
    URL.revokeObjectURL(url)
  }
}

function calcDimensions(
  srcW: number,
  srcH: number,
  opts: ConvertOptions
): { w: number; h: number } {
  if (opts.noResize || (!opts.width && !opts.height)) {
    return { w: srcW, h: srcH }
  }
  if (!opts.keepAspectRatio) {
    return { w: opts.width ?? srcW, h: opts.height ?? srcH }
  }
  const ratio = srcW / srcH
  if (opts.width && !opts.height) {
    return { w: opts.width, h: Math.round(opts.width / ratio) }
  }
  if (opts.height && !opts.width) {
    return { w: Math.round(opts.height * ratio), h: opts.height }
  }
  // Both provided — fit by width
  return { w: opts.width!, h: Math.round(opts.width! / ratio) }
}

export async function convertImage(file: File, opts: ConvertOptions): Promise<ConvertResult> {
  if (!isSupported(file)) {
    throw new Error(`非対応の形式です: ${file.type || file.name}`)
  }

  const img = await loadImage(file)
  const { w, h } = calcDimensions(img.naturalWidth, img.naturalHeight, opts)

  const canvas = document.createElement('canvas')
  canvas.width = w
  canvas.height = h
  const ctx = canvas.getContext('2d')!
  ctx.drawImage(img, 0, 0, w, h)

  const quality = opts.format === 'image/png' ? undefined : opts.quality / 100

  const blob = await new Promise<Blob>((resolve, reject) => {
    canvas.toBlob(
      (b) => (b ? resolve(b) : reject(new Error('変換に失敗しました'))),
      opts.format,
      quality
    )
  })

  return {
    blob,
    objectUrl: URL.createObjectURL(blob),
    originalSize: file.size,
    convertedSize: blob.size,
    reductionPercent: calcReduction(file.size, blob.size),
    fileName: getOutputFileName(file.name, opts.format),
    originalFile: file,
  }
}
