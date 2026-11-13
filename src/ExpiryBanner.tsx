import { useEffect, useState } from 'react'
import { Link, useLocation } from 'react-router-dom'
import { Icon } from './ui'
import { getSubscription } from '../lib/api'
import { useAuth } from '../lib/auth'
import { getPref, setPref } from '../lib/prefs'
import { EXPIRY_TEXT, expiryTier, type ExpiryTier } from '../lib/subscription'

/** Bandeau « ton abonnement expire » pour ceux qui n'ont pas activé les notifications. Un appui mène à Premium. */
export default function ExpiryBanner() {
  const { user } = useAuth()
  const loc = useLocation()
  const [info, setInfo] = useState<{ key: string; tier: ExpiryTier } | null>(null)
  const [hidden, setHidden] = useState(false)

  useEffect(() => {
    if (!user) return
    let alive = true
    void getSubscription(user.id).then((s) => {
      if (!alive || !s) return
      const tier = expiryTier(s.expires_at)
      if (tier) setInfo({ key: `${s.expires_at}|${tier}`, tier })
    }).catch(() => { /* hors connexion : pas de bandeau */ })
    return () => { alive = false }
  }, [user])

  if (!info || hidden || loc.pathname === '/premium' || getPref('expiry-dismissed', '') === info.key) return null
  return (
    <div className="expiry-banner no-print" role="status">
      <Link to="/premium" className="eb-text"><Icon name="bolt" size={18} />{EXPIRY_TEXT[info.tier]}</Link>
      <button type="button" className="eb-x" aria-label="Fermer ce rappel" onClick={() => { setPref('expiry-dismissed', info.key); setHidden(true) }}><Icon name="close" size={18} /></button>
    </div>
  )
}
