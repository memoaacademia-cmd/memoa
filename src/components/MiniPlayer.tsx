import { useEffect } from 'react'
import { Icon } from './ui'
import { stopSpeaking, useVoice } from '../lib/speech'

/** Mini-lecteur visible sur tous les écrans de l'app tant qu'une lecture à voix haute est en cours. */
export default function MiniPlayer() {
  const voice = useVoice()

  useEffect(() => {
    // Quand l'étudiant quitte l'app (écran verrouillé, autre application), la lecture s'arrête proprement.
    const onHide = () => { if (document.visibilityState === 'hidden') stopSpeaking() }
    document.addEventListener('visibilitychange', onHide)
    return () => {
      document.removeEventListener('visibilitychange', onHide)
      stopSpeaking() // déconnexion : on ne laisse pas une voix continuer
    }
  }, [])

  if (!voice) return null
  return (
    <div className="no-print" role="status" style={{ position: 'fixed', left: '50%', transform: 'translateX(-50%)', bottom: 88, width: 'calc(100% - 24px)', maxWidth: 416, zIndex: 11, display: 'flex', alignItems: 'center', gap: 10, padding: '10px 12px', borderRadius: 16, background: 'var(--surface-2)', border: '1px solid var(--line-strong)', boxShadow: '0 6px 20px rgba(0,0,0,.25)' }}>
      <Icon name="headphones" size={22} color="var(--link)" />
      <span style={{ flex: 1, minWidth: 0 }}>
        <b>{voice.label}</b>
        {voice.sub && <span className="muted" style={{ display: 'block', whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>{voice.sub}</span>}
      </span>
      <button type="button" className="btn small" onClick={stopSpeaking}>Arrêter</button>
    </div>
  )
}
