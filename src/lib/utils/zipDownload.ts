import JSZip from 'jszip'
import type { ConvertResult } from './imageProcessor'

export async function downloadAllAsZip(results: ConvertResult[]): Promise<void> {
  const zip = new JSZip()
  for (const result of results) {
    zip.file(result.fileName, result.blob)
  }
  const zipBlob = await zip.generateAsync({ type: 'blob' })
  const url = URL.createObjectURL(zipBlob)
  const a = document.createElement('a')
  a.href = url
  a.download = 'converted-images.zip'
  a.click()
  URL.revokeObjectURL(url)
}
