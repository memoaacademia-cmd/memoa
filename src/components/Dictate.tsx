import { useEffect, useRef, useState } from 'react'
import { Icon } from './ui'
import { canDictate, dictationMessage, startDictation, type Dictation } from '../lib/speech'

/** Bouton micro : le texte dicté est envoyé à onText (la voix est enregistrée puis transcrite, gratuit ; sinon dictée du téléphone). */
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
      const m = dictationMessage(err)
      if (m) setMsg(m)
    }, (busy) => setMsg(busy ? 'Transcription de ta voix…' : ''))
    if (!r) { setMsg("La dictée n'est pas disponible sur ce navigateur. Essaie avec Chrome."); return }
    d.current = r
    setOn(true)
  }

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 6, alignItems: 'flex-start' }}>
      <button type="button" className={'ed-chip ed-mic' + (on ? ' on' : '')} onClick={toggle} aria-pressed={on} aria-label={on ? 'Arrêter la dictée' : label}>
        <Icon name="mic" size={20} />
      </button>
      {msg && <span className="muted" role="alert">{msg}</span>}
    </div>
  )
}
