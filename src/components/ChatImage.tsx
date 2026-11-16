import { useEffect, useState } from 'react'
import { imageUrl } from '../lib/api'
import { Icon } from './ui'

const cache = new Map<string, string>()

/** Image créée par Memo, affichée dans le chat, avec un bouton pour la télécharger. Sans connexion, un message clair remplace l'image. */
export default function ChatImage({ path }: { path: string }) {
  const [url, setUrl] = useState<string | null>(cache.get(path) ?? null)
  const [failed, setFailed] = useState(false)
  const [busy, setBusy] = useState(false)

  useEffect(() => {
    if (url) return
    let live = true
    imageUrl(path).then((u) => { cache.set(path, u); if (live) setUrl(u) }).catch(() => { if (live) setFailed(true) })
    return () => { live = false }
  }, [path, url])

  async function download() {
    setBusy(true)
    try {
      const a = document.createElement('a')
      a.href = await imageUrl(path, 'memoa-image' + (/\.(png|jpe?g|webp)$/i.exec(path)?.[0] ?? '.png'))
      a.rel = 'noopener'
      document.body.appendChild(a)
      a.click()
      a.remove()
    } catch {
      setFailed(true)
    } finally {
      setBusy(false)
    }
  }

  if (failed) return <p className="muted" role="status">Cette image n’est pas disponible pour l’instant (connexion nécessaire). Reconnecte-toi puis rouvre la conversation.</p>
  if (!url) return <p className="muted" role="status">Chargement de l’image…</p>
  return (
    <figure className="chat-img">
      <img src={url} alt="Image créée par Memo" loading="lazy" onError={() => { cache.delete(path); setUrl(null); setFailed(true) }} />
      <button type="button" className="pill-btn sm" onClick={() => void download()} disabled={busy}><Icon name="download" size={16} /> Télécharger l’image</button>
    </figure>
  )
}
