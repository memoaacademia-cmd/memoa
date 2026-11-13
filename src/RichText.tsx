import type { ReactNode } from 'react'

/** Affiche le texte de l'IA proprement : **gras** devient du vrai gras, # titres et listes sans symboles bruts. */
function inline(text: string, key: string): ReactNode[] {
  return text.split(/(\*\*[^*]+\*\*)/g).filter(Boolean).map((part, i) =>
    part.startsWith('**') && part.endsWith('**') && part.length > 4
      ? <strong key={key + i}>{part.slice(2, -2)}</strong>
      : <span key={key + i}>{part.replace(/\*\*/g, '').replace(/`/g, '')}</span>
  )
}

export default function RichText({ text }: { text: string }) {
  const lines = text.replace(/\r/g, '').split('\n')
  return (
    <>
      {lines.map((raw, i) => {
        const t = raw.trim()
        if (!t) return <div key={i} style={{ height: 8 }} />
        const h = /^#{1,4}\s+(.*)$/.exec(t)
        if (h) return <div key={i} style={{ fontWeight: 700, marginTop: 6 }}>{inline(h[1], 'h' + i)}</div>
        const b = /^[-*•]\s+(.*)$/.exec(t)
        if (b) return <div key={i} style={{ paddingLeft: 16, textIndent: -12 }}>• {inline(b[1], 'b' + i)}</div>
        return <div key={i}>{inline(t, 'p' + i)}</div>
      })}
    </>
  )
}
