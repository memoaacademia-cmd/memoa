import { useEffect } from 'react'
import { useLocation } from 'react-router-dom'
import { Icon, PillButton } from './ui'
import { pauseSpeaking, stopSpeaking, togglePause, useVoice } from '../lib/speech'

/** Mini-lecteur visible sur tous les écrans de l'app tant qu'une lecture à voix haute est en cours. */
export default function MiniPlayer() {
  const voice = useVoice()
  const loc = useLocation()

  useEffect(() => {
    // Quand l'étudiant quitte l'app (écran verrouillé, autre application), la lecture se met en pause : il la reprend en revenant.
    const onHide = () => { if (document.visibilityState === 'hidden') pauseSpeaking() }
    document.addEventListener('visibilitychange', onHide)
    return () => {
      document.removeEventListener('visibilitychange', onHide)
      stopSpeaking() // déconnexion : on ne laisse pas une voix continuer
    }
  }, [])

  if (!voice) return null
  // Sur l'Assistant, la barre de saisie occupe le bas : le lecteur se place au-dessus.
  return (
    <div className={'mini no-print' + (loc.pathname === '/assistant' ? ' high' : '')} role="status">
      <Icon name="headphones" size={24} color="var(--link)" />
      <span className="body">
        <b>{voice.paused ? 'En pause' : voice.label}</b>
        {voice.sub && <span>{voice.sub}</span>}
      </span>
      <button type="button" className="mini-pause" onClick={togglePause} aria-label={voice.paused ? 'Reprendre la lecture' : 'Mettre la lecture en pause'}>
        <Icon name={voice.paused ? 'play' : 'pause'} size={20} color="var(--link)" />
      </button>
      <PillButton size="sm" onClick={stopSpeaking}>Arrêter</PillButton>
    </div>
  )
}
