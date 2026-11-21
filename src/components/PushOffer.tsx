import { useEffect, useState } from 'react'
import { Icon } from './ui'
import { useAuth } from '../lib/auth'
import { canInvite, enablePush, needsInstallFirst, noteInvited, syncPush } from '../lib/push'

/** Après la toute première action IA réussie, une carte propose les notifications (« Le savais-tu » à 8 h, rappels de révision).
 *  Un seul bouton pour accepter ; « Plus tard » ferme. Les règles de fréquence sont celles de canInvite (jamais si déjà accepté ou refusé). */
export default function PushOffer() {
  const { user } = useAuth()
  const [open, setOpen] = useState(false)
  const [busy, setBusy] = useState(false)
  const [msg, setMsg] = useState<string | null>(null)

  // À chaque ouverture : répare en silence un abonnement aux notifications perdu (voir syncPush).
  useEffect(() => { if (user) void syncPush(user.id) }, [user])

  useEffect(() => {
    if (!user) return
    let timer: number | undefined
    const on = () => {
      if (localStorage.getItem('memoa-first-ai-offer') === '1') return
      try { localStorage.setItem('memoa-first-ai-offer', '1') } catch { /* tant pis : on ne la montre que cette fois */ }
      if (!canInvite()) return
      timer = window.setTimeout(() => { noteInvited(); setOpen(true) }, 1500)
    }
    window.addEventListener('memoa-ai-done', on)
    return () => { window.removeEventListener('memoa-ai-done', on); window.clearTimeout(timer) }
  }, [user])

  if (!open || !user) return null

  async function accept() {
    setBusy(true)
    const r = await enablePush(user!.id)
    setBusy(false)
    if (r.ok) setOpen(false)
    else setMsg(r.message)
  }

  return (
    <div className="no-print" role="dialog" aria-label="Activer les notifications" style={{ position: 'fixed', left: 12, right: 12, bottom: 'calc(84px + env(safe-area-inset-bottom, 0px))', zIndex: 40, display: 'flex', flexDirection: 'column', gap: 10, padding: 16, borderRadius: 20, background: 'var(--surface)', border: '1px solid var(--line-strong)', boxShadow: '0 8px 28px rgba(0,0,0,.22)' }}>
      <strong>Veux-tu un rappel chaque jour ?</strong>
      <span className="muted" style={{ fontSize: 14 }}>Un fait à découvrir à 8 h et les rappels de révision. Tu peux tout arrêter quand tu veux, dans Moi.</span>
      {needsInstallFirst() && <span className="muted" style={{ fontSize: 13 }}>Sur iPhone, ajoute d’abord Memoa à ton écran d’accueil.</span>}
      {msg && <div className="notice" role="alert">{msg}</div>}
      <div style={{ display: 'flex', gap: 8 }}>
        <button type="button" className="pill-btn" style={{ flex: 1 }} onClick={() => void accept()} disabled={busy}><Icon name="chat" size={18} />{busy ? 'Un instant…' : 'Activer les notifications'}</button>
        <button type="button" className="pill-btn ghost" onClick={() => setOpen(false)}>Plus tard</button>
      </div>
    </div>
  )
}
