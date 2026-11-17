import type { ReactNode } from 'react'

/** Affiche le texte de l'IA proprement : **gras** devient du vrai gras, # titres, listes à puces et listes numérotées sans symboles bruts. */
function inline(text: string, key: string): ReactNode[] {
  // *italique* et _italique_ isolés sont retirés (jamais d'astérisque visible) ; seul **gras** est mis en forme.
  const clean = text.replace(/(^|[^*])\*(?!\*)([^*\n]+)\*(?!\*)/g, '$1$2').replace(/`/g, '')
  return clean.split(/(\*\*[^*]+\*\*)/g).filter(Boolean).map((part, i) =>
    part.startsWith('**') && part.endsWith('**') && part.length > 4
      ? <strong key={key + i}>{part.slice(2, -2)}</strong>
      : <span key={key + i}>{part.replace(/\*\*/g, '')}</span>
  )
}

export default function RichText({ text }: { text: string }) {
  const lines = text.replace(/\r/g, '').split('\n')
  return (
    <>
      {lines.map((raw, i) => {
        const t = raw.trim()
        if (!t) return <div key={i} style={{ height: 8 }} />
        if (/^[-_*=~]{3,}$/.test(t)) return null
        const h = /^(#{1,6})\s+(.*)$/.exec(t)
        if (h) {
          const big = h[1].length === 1
          return <div key={i} style={{ fontWeight: 700, marginTop: i === 0 ? 0 : 10, fontSize: big ? '1.18em' : '1.05em', lineHeight: 1.35 }}>{inline(h[2], 'h' + i)}</div>
        }
        const b = /^[-*•·]\s+(.*)$/.exec(t)
        if (b) return <div key={i} style={{ paddingLeft: 18, textIndent: -14 }}>• {inline(b[1], 'b' + i)}</div>
        const n = /^(\d+[.)])\s+(.*)$/.exec(t)
        if (n) return <div key={i} style={{ paddingLeft: 22, textIndent: -20 }}>{n[1]} {inline(n[2], 'n' + i)}</div>
        // Ligne entièrement en gras : c'est un titre.
        const solo = /^\*\*([^*]+)\*\*:?$/.exec(t)
        if (solo) return <div key={i} style={{ fontWeight: 700, marginTop: 6 }}>{solo[1]}</div>
        return <div key={i}>{inline(t, 'p' + i)}</div>
      })}
    </>
  )
}
