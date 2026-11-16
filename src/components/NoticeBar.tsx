import { useEffect, useState } from 'react'

/** Petite bande d'information qui s'efface seule. Écoute l'événement « memoa-notice » (ex. : recherche web non faite). */
export default function NoticeBar() {
  const [msg, setMsg] = useState('')
  useEffect(() => {
    let t: number | undefined
    const on = (e: Event) => {
      const d = (e as CustomEvent<string>).detail
      if (typeof d !== 'string' || !d) return
      setMsg(d)
      window.clearTimeout(t)
      t = window.setTimeout(() => setMsg(''), 7000)
    }
    window.addEventListener('memoa-notice', on)
    return () => { window.removeEventListener('memoa-notice', on); window.clearTimeout(t) }
  }, [])
  if (!msg) return null
  return <div className="notice-bar" role="status" onClick={() => setMsg('')}>{msg}</div>
}
