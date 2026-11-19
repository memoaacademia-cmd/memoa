import { useEffect, useRef, useState } from 'react'
import { documentCover } from '../lib/doccover'

/** Image du document dans la Librairie : sa page de garde. Dessinée seulement quand elle arrive à l'écran. Sans fichier ou si le PDF est illisible : un petit repère avec le type. */
export default function DocCover({ filePath, type, title }: { filePath: string | null; type: string; title: string }) {
  const box = useRef<HTMLSpanElement>(null)
  const [src, setSrc] = useState<string | null>(null)
  const [failed, setFailed] = useState(false)

  useEffect(() => {
    if (!filePath) return
    const el = box.current
    if (!el) return
    let alive = true
    const start = () => documentCover(filePath).then((img) => { if (!alive) return; if (img) setSrc(img); else setFailed(true) })
    if (typeof IntersectionObserver === 'undefined') { void start(); return () => { alive = false } }
    const io = new IntersectionObserver((entries) => {
      if (entries.some((e) => e.isIntersecting)) { io.disconnect(); void start() }
    }, { rootMargin: '200px' })
    io.observe(el)
    return () => { alive = false; io.disconnect() }
  }, [filePath])

  if (!filePath || failed) return <span className="lib-type" aria-hidden="true">{(type || 'PDF').slice(0, 3).toUpperCase()}</span>
  return (
    <span ref={box} className="lib-cover" role="img" aria-label={`Page de garde de ${title}`}>
      {src && <img src={src} alt="" />}
    </span>
  )
}
