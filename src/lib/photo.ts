// Re-encode every photo through a canvas: shrinks it and strips EXIF
// (including embedded GPS) before it is stored or uploaded.

export const PHOTO_LONG_EDGE = 1600
export const PHOTO_QUALITY = 0.75
const THUMB_EDGE = 320

export interface CompressedPhoto {
  blob: Blob
  thumb: Blob
  width: number
  height: number
  bytes: number
  original_bytes: number
}

function encode(img: HTMLImageElement, edge: number, quality: number) {
  const scale = Math.min(1, edge / Math.max(img.naturalWidth, img.naturalHeight))
  const w = Math.round(img.naturalWidth * scale)
  const h = Math.round(img.naturalHeight * scale)
  const canvas = Object.assign(document.createElement('canvas'), { width: w, height: h })
  canvas.getContext('2d')!.drawImage(img, 0, 0, w, h)
  return new Promise<{ blob: Blob; width: number; height: number }>((resolve, reject) =>
    canvas.toBlob((blob) => (blob ? resolve({ blob, width: w, height: h }) : reject(new Error('encode failed'))), 'image/jpeg', quality),
  )
}

export async function compressPhoto(file: Blob, edge = PHOTO_LONG_EDGE, quality = PHOTO_QUALITY): Promise<CompressedPhoto> {
  // <img> applies EXIF rotation by default in current browsers; the canvas
  // re-encode then drops all metadata.
  const url = URL.createObjectURL(file)
  try {
    const img = new Image()
    img.src = url
    await img.decode()
    const full = await encode(img, edge, quality)
    const thumb = await encode(img, THUMB_EDGE, 0.7)
    return { blob: full.blob, thumb: thumb.blob, width: full.width, height: full.height, bytes: full.blob.size, original_bytes: file.size }
  } finally {
    URL.revokeObjectURL(url)
  }
}
