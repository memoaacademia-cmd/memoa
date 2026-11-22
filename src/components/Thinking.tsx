import { useEffect, useState } from 'react'
import { Icon } from './ui'
import './thinking.css'

/**
 * Attente animée de l'assistant : les étapes apparaissent l'une après l'autre (les précédentes se cochent),
 * l'étape en cours est suivie de trois points qui rebondissent.
 * Les étapes sont indicatives (le serveur répond en une seule fois) : elles rythment l'attente, elles ne mesurent pas l'avancement réel.
 */
export default function Thinking({ name, acting, web, attach }: { name: string; acting: boolean; web: boolean; attach: boolean }) {
  const steps = acting
    ? [`${name} s’en occupe…`, 'Je prépare ce que tu as demandé…', 'Je finalise…']
    : [
        attach ? 'Je lis ton document…' : 'Je lis ta question…',
        ...(web ? ['Je cherche sur le web…'] : []),
        'Je réfléchis à la meilleure réponse…',
        'Je rédige…',
      ]
  const [i, setI] = useState(0)
  const key = steps.join('|')
  useEffect(() => { setI(0) }, [key])
  useEffect(() => {
    // Chaque étape dure un peu plus longtemps que la précédente ; la dernière reste affichée jusqu'à la réponse.
    if (i >= steps.length - 1) return
    const t = window.setTimeout(() => setI((n) => n + 1), 1800 + i * 900)
    return () => window.clearTimeout(t)
  }, [i, steps.length])
  const shown = Math.min(i, steps.length - 1)

  return (
    <div className="as-ai think" role="status" aria-live="polite">
      {steps.slice(0, shown + 1).map((s, n) => {
        const done = n < shown
        return (
          <div key={n} className={'think-row' + (done ? ' done' : ' now')}>
            <span className="think-ico" aria-hidden="true">
              {done ? <Icon name="check" size={14} stroke={2.6} /> : <i className="think-pulse" />}
            </span>
            <span className="think-txt">{s}</span>
            {!done && <span className="think-dots" aria-hidden="true"><i /><i /><i /></span>}
          </div>
        )
      })}
    </div>
  )
}
