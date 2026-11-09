// Réduit une photo avant l'envoi : côté max 512 px, JPEG. Si quoi que ce soit échoue, on renvoie le fichier d'origine.
export async function shrinkImage(file: File, maxSide = 512, quality = 0.85): Promise<File> {
  try {
    let w = 0
    let h = 0
    let source: CanvasImageSource
    let cleanup = () => {}
    if (typeof createImageBitmap === 'function') {
      const bmp = await createImageBitmap(file, { imageOrientation: 'from-image' } as unknown as ImageBitmapOptions)
      w = bmp.width
      h = bmp.height
      source = bmp
      cleanup = () => bmp.close()
    } else {
      const url = URL.createObjectURL(file)
      const img = new Image()
      await new Promise<void>((ok, ko) => {
        img.onload = () => ok()
        img.onerror = () => ko(new Error('decode'))
        img.src = url
      })
      w = img.naturalWidth
      h = img.naturalHeight
      source = img
      cleanup = () => URL.revokeObjectURL(url)
    }
    if (!w || !h) return file
    const scale = Math.min(1, maxSide / Math.max(w, h))
    const cw = Math.max(1, Math.round(w * scale))
    const ch = Math.max(1, Math.round(h * scale))
    const canvas = document.createElement('canvas')
    canvas.width = cw
    canvas.height = ch
    const ctx = canvas.getContext('2d')
    if (!ctx) {
      cleanup()
      return file
    }
    ctx.fillStyle = '#ffffff'
    ctx.fillRect(0, 0, cw, ch)
    ctx.drawImage(source, 0, 0, cw, ch)
    cleanup()
    const blob = await new Promise<Blob | null>((res) => canvas.toBlob(res, 'image/jpeg', quality))
    if (!blob) return file
    return new File([blob], 'avatar.jpg', { type: 'image/jpeg' })
  } catch {
    return file
  }
}
