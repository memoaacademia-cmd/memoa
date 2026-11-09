import { useEffect, useRef, useState } from 'react'
import { Icon } from './ui'
import { canDictate, startDictation, type Dictation } from '../lib/speech'

/** Bouton micro : le texte dicté est envoyé à onText (le navigateur du téléphone fait la dictée, sans coût serveur). */
export default function DictateButton({ onText, label = 'Dicter' }: { onText: (t: string) => void; label?: string }) {
  const [on, setOn] = useState(false)
  const [msg, setMsg] = useState('')
  const d = useRef<Dictation | null>(null)
  useEffect(() => () => { d.current?.stop() }, [])
  if (!canDictate()) return null

  function toggle() {
    if (on) { d.current?.stop(); return }
    setMsg('')
    const r = startDictation(onText, (err) => {
      setOn(false)
      if (err === 'not-allowed' || err === 'service-not-allowed') setMsg('Le micro est bloqué. Autorise-le dans les réglages du navigateur, puis réessaie.')
    })
    if (!r) { setMsg("La dictée n'est pas disponible sur ce navigateur. Essaie avec Chrome."); return }
    d.current = r
    setOn(true)
  }

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 6, alignItems: 'flex-start' }}>
      <button type="button" className={'btn small ' + (on ? 'amber' : 'ghost')} onClick={toggle}>
        <Icon name="mic" size={18} /> {on ? 'J’écoute… touche pour arrêter' : label}
      </button>
      {msg && <span className="muted" role="alert">{msg}</span>}
    </div>
  )
}
