import { useEffect, useState } from 'react'

// La photo de profil est une adresse distante : sans réseau elle ne s'affiche plus.
// On en garde une copie sur le téléphone (effacée à la déconnexion, comme les autres copies hors ligne : préfixe « memoa-offline: »).
const KEY = 'memoa-offline:avatar'

function read(url: string): string | null {
  try {
    const v = JSON.parse(localStorage.getItem(KEY) ?? 'null') as { url: string; data: string } | null
    return v && v.url === url ? v.data : null
  } catch { return null }
}

function toDataUrl(blob: Blob): Promise<string> {
  return new Promise((resolve, reject) => {
    const r = new FileReader()
    r.onload = () => resolve(String(r.result))
    r.onerror = () => reject(r.error)
    r.readAsDataURL(blob)
  })
}

/** Renvoie la photo à afficher : la copie locale si elle existe (donc aussi hors connexion), sinon l'adresse en ligne. */
export function useAvatar(url: string | null | undefined): string | null {
  const [src, setSrc] = useState<string | null>(() => (url ? read(url) ?? url : null))
  useEffect(() => {
    if (!url) { setSrc(null); return }
    const have = read(url)
    setSrc(have ?? url)
    if (have || !navigator.onLine) return
    let alive = true
    fetch(url)
      .then((r) => (r.ok ? r.blob() : Promise.reject(new Error('avatar'))))
      .then((b) => (b.size < 400_000 ? toDataUrl(b) : Promise.reject(new Error('trop lourde'))))
      .then((data) => {
        try { localStorage.setItem(KEY, JSON.stringify({ url, data })) } catch { /* stockage plein : on garde l'adresse en ligne */ }
        if (alive) setSrc(data)
      })
      .catch(() => { /* pas grave : l'adresse en ligne reste utilisée */ })
    return () => { alive = false }
  }, [url])
  return src
}
