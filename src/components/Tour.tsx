import { createContext, useCallback, useContext, useEffect, useLayoutEffect, useMemo, useRef, useState, type ReactNode } from 'react'
import { createPortal } from 'react-dom'
import { useLocation, useNavigate } from 'react-router-dom'
import { useAuth } from '../lib/auth'
import { firstNameOf } from '../lib/names'
import { fillTour, loadProgress, readLocalProgress, saveProgress, tourById, tourForPath, type TourId, type TourProgress, type TourStatus, type TourStep } from '../lib/tours'
import { Icon, MemoAvatar } from './ui'

/* Visites guidées interactives.
 *  - <TourProvider> (monté dans l'espace connecté, voir App.tsx) lance la visite de la page à la première arrivée,
 *    garde la progression et expose useTours() (relancer une visite, tout réinitialiser).
 *  - L'élément expliqué est repéré par son attribut data-tour="…" ; s'il est absent, l'étape est sautée.
 *  - L'affichage : voile sombre, « projecteur » sur l'élément, bulle de Memo avec flèche, Suivant / Passer / Terminé. */

interface Active { id: TourId; steps: TourStep[]; index: number }

interface TourApi {
  progress: TourProgress
  /** Vrai quand la progression est connue (évite de relancer une visite déjà vue sur un autre téléphone). */
  ready: boolean
  /** Visite en cours, s'il y en a une. */
  active: TourId | null
  /** Efface la visite puis la relance : sur sa page (ou sur `to`). */
  restart: (id: TourId, to?: string) => void
  /** Efface toute la progression : chaque visite se relancera à la prochaine arrivée sur sa page. */
  resetAll: () => void
}

const Ctx = createContext<TourApi>({ progress: {}, ready: false, active: null, restart: () => {}, resetAll: () => {} })
export const useTours = () => useContext(Ctx)

const sleep = (ms: number) => new Promise<void>((r) => window.setTimeout(r, ms))
const targetsOf = (s: TourStep): string[] => (s.target === undefined ? [] : Array.isArray(s.target) ? s.target : [s.target])

/** Premier élément visible correspondant à l'étape, ou null. */
function findTarget(s: TourStep): HTMLElement | null {
  for (const t of targetsOf(s)) {
    const list = document.querySelectorAll<HTMLElement>(`[data-tour="${t}"]`)
    for (let i = 0; i < list.length; i++) {
      const r = list[i].getBoundingClientRect()
      if (r.width > 0 && r.height > 0) return list[i]
    }
  }
  return null
}

/** Attend (au plus `timeout` ms) que les éléments visés apparaissent, puis ne garde que les étapes réalisables. */
async function prepareSteps(steps: TourStep[], timeout = 1000): Promise<TourStep[]> {
  const t0 = Date.now()
  while (Date.now() - t0 < timeout && steps.some((s) => s.target !== undefined && !findTarget(s))) await sleep(100)
  return steps.filter((s) => s.target === undefined || findTarget(s))
}

export function TourProvider({ children }: { children: ReactNode }) {
  const { user, profile } = useAuth()
  const loc = useLocation()
  const nav = useNavigate()
  const uid = user?.id ?? ''
  const [progress, setProgress] = useState<TourProgress>({})
  const [ready, setReady] = useState(false)
  const [active, setActive] = useState<Active | null>(null)
  const [launch, setLaunch] = useState<TourId | null>(null)
  const [pending, setPending] = useState<TourId | null>(null)
  const progressRef = useRef<TourProgress>({})
  const pathRef = useRef(loc.pathname)
  pathRef.current = loc.pathname
  const tried = useRef<Set<string>>(new Set())

  // Progression : copie locale tout de suite, puis fusion avec celle du compte.
  useEffect(() => {
    if (!uid) return
    let alive = true
    setReady(false)
    const local = readLocalProgress(uid)
    progressRef.current = local
    setProgress(local)
    void loadProgress(uid)
      .then((p) => { if (alive) { progressRef.current = p; setProgress(p); setReady(true) } })
      .catch(() => { if (alive) setReady(true) })
    return () => { alive = false }
  }, [uid])

  const update = useCallback((fn: (p: TourProgress) => TourProgress) => {
    const next = fn(progressRef.current)
    progressRef.current = next
    setProgress(next)
    if (uid) saveProgress(uid, next)
  }, [uid])

  const finish = useCallback((id: TourId, status: TourStatus) => {
    setActive(null)
    update((p) => ({ ...p, [id]: status }))
  }, [update])

  const restart = useCallback((id: TourId, to?: string) => {
    update((p) => { const n = { ...p }; delete n[id]; return n })
    setActive(null)
    setPending(id)
    nav(to ?? tourById(id).route)
  }, [update, nav])

  const resetAll = useCallback(() => {
    setActive(null)
    setPending(null)
    tried.current.clear()
    update(() => ({}))
  }, [update])

  // Nouvelle page : on peut retenter le lancement automatique.
  useEffect(() => { tried.current.clear() }, [loc.pathname])

  // Lancement : automatique à la première arrivée sur la page, ou demandé (restart).
  useEffect(() => {
    if (!ready || active || launch) return
    const def = tourForPath(loc.pathname)
    if (!def) return
    const forced = pending === def.id
    if (!forced && (progress[def.id] || tried.current.has(def.id))) return
    const t = window.setTimeout(() => {
      tried.current.add(def.id)
      if (forced) setPending(null)
      setLaunch(def.id)
    }, forced ? 350 : 600)
    return () => window.clearTimeout(t)
  }, [ready, active, launch, loc.pathname, pending, progress])

  // Préparation : on attend les éléments, on garde les étapes réalisables, puis on affiche.
  useEffect(() => {
    if (!launch) return
    let alive = true
    const def = tourById(launch)
    void prepareSteps(def.steps).then((steps) => {
      if (!alive) return
      setLaunch(null)
      if (steps.length && def.match(pathRef.current)) setActive({ id: def.id, steps, index: 0 })
    })
    return () => { alive = false }
  }, [launch])

  // L'étudiant a changé de page (retour du navigateur…) : la visite se ferme sans être comptée comme vue.
  useEffect(() => {
    if (active && !tourById(active.id).match(loc.pathname)) setActive(null)
  }, [loc.pathname, active])

  const value = useMemo<TourApi>(() => ({ progress, ready, active: active?.id ?? null, restart, resetAll }), [progress, ready, active, restart, resetAll])
  const vars = { first: firstNameOf(profile) || 'toi', memo: profile?.memo_name || 'Memo' }

  return (
    <Ctx.Provider value={value}>
      {children}
      {active && typeof document !== 'undefined' && createPortal(
        <TourOverlay
          steps={active.steps}
          index={active.index}
          vars={vars}
          animal={profile?.memo_animal ?? null}
          onIndex={(i) => setActive((a) => (a ? { ...a, index: i } : a))}
          onFinish={(st) => finish(active.id, st)}
        />,
        document.body
      )}
    </Ctx.Provider>
  )
}

/* ------------------------------ Affichage ------------------------------ */

interface Box { top: number; left: number; width: number; height: number }

const MARGIN = 12
const GAP = 14
const PAD = 8
const clamp = (v: number, lo: number, hi: number) => Math.max(lo, Math.min(hi, v))

/** Position de la bulle et de sa flèche selon l'élément mis en évidence et la place disponible. */
function layout(rect: Box | null, w: number, h: number, bh: number) {
  const bw = Math.min(340, w - 2 * MARGIN)
  if (!rect) return { bw, left: (w - bw) / 2, top: Math.max(MARGIN, (h - bh) / 2), tail: null as null | { dir: 'up' | 'down'; left: number }, spot: null as Box | null }
  // Projecteur : l'élément avec un peu d'air, jamais plus grand que l'écran.
  const top = clamp(rect.top - PAD, 4, h - 8)
  const left = clamp(rect.left - PAD, 4, w - 8)
  const bottom = clamp(rect.top + rect.height + PAD, top + 8, h - 4)
  const right = clamp(rect.left + rect.width + PAD, left + 8, w - 4)
  const spot: Box = { top, left, width: right - left, height: bottom - top }
  const below = h - bottom - GAP - MARGIN
  const above = top - GAP - MARGIN
  const cx = left + spot.width / 2
  const bLeft = clamp(cx - bw / 2, MARGIN, w - bw - MARGIN)
  const tailLeft = clamp(cx - bLeft - 8, 22, bw - 38)
  if (below >= bh) return { bw, left: bLeft, top: bottom + GAP, tail: { dir: 'up' as const, left: tailLeft }, spot }
  if (above >= bh) return { bw, left: bLeft, top: top - GAP - bh, tail: { dir: 'down' as const, left: tailLeft }, spot }
  // Élément très grand : la bulle se pose sur le bord de l'écran le plus éloigné du centre de l'élément, sans flèche.
  const dockTop = top + spot.height / 2 > h / 2
  return { bw, left: bLeft, top: dockTop ? MARGIN : h - bh - MARGIN, tail: null, spot }
}

function TourOverlay({ steps, index, vars, animal, onIndex, onFinish }: {
  steps: TourStep[]
  index: number
  vars: { first: string; memo: string }
  animal: string | null
  onIndex: (i: number) => void
  onFinish: (s: TourStatus) => void
}) {
  const step = steps[index]
  const total = steps.length
  const last = index === total - 1
  const [rect, setRect] = useState<Box | null>(null)
  const [vp, setVp] = useState({ w: window.innerWidth, h: window.innerHeight })
  const [bh, setBh] = useState(200)
  const [moving, setMoving] = useState(true)
  const rootRef = useRef<HTMLDivElement>(null)
  const bubbleRef = useRef<HTMLDivElement>(null)
  const nextRef = useRef<HTMLButtonElement>(null)

  const next = () => (index + 1 < total ? onIndex(index + 1) : onFinish('done'))
  const prev = () => { if (index > 0) onIndex(index - 1) }
  const skip = () => onFinish('skipped')
  const latest = useRef({ next, prev, skip })
  latest.current = { next, prev, skip }

  // Suivi de l'élément : défilement jusqu'à lui, puis position relue à chaque image (défilement, rotation, mise en page qui bouge).
  useEffect(() => {
    let raf = 0
    let el: HTMLElement | null = null
    let scrolled = false
    let missingSince: number | null = null
    const reduce = typeof window.matchMedia === 'function' && window.matchMedia('(prefers-reduced-motion: reduce)').matches
    setMoving(true)
    const settle = window.setTimeout(() => setMoving(false), 450)
    const tick = () => {
      setVp((v) => (v.w === window.innerWidth && v.h === window.innerHeight ? v : { w: window.innerWidth, h: window.innerHeight }))
      if (step.target === undefined) {
        setRect(null)
      } else {
        if (!el || !el.isConnected) el = findTarget(step)
        if (!el) {
          // Élément disparu ou jamais apparu : on laisse une courte chance, puis on passe à la suite sans bloquer.
          const now = performance.now()
          if (missingSince === null) missingSince = now
          else if (now - missingSince > 700) { latest.current.next(); return }
          setRect(null)
        } else {
          missingSince = null
          if (!scrolled) { scrolled = true; el.scrollIntoView({ block: 'center', inline: 'nearest', behavior: reduce ? 'auto' : 'smooth' }) }
          const r = el.getBoundingClientRect()
          setRect((p) => (p && Math.abs(p.top - r.top) < 0.5 && Math.abs(p.left - r.left) < 0.5 && Math.abs(p.width - r.width) < 0.5 && Math.abs(p.height - r.height) < 0.5 ? p : { top: r.top, left: r.left, width: r.width, height: r.height }))
        }
      }
      raf = requestAnimationFrame(tick)
    }
    raf = requestAnimationFrame(tick)
    return () => { cancelAnimationFrame(raf); window.clearTimeout(settle) }
  }, [step])

  // Hauteur réelle de la bulle (le texte varie) pour la placer au bon endroit.
  useLayoutEffect(() => {
    const h = bubbleRef.current?.offsetHeight
    if (h && Math.abs(h - bh) > 1) setBh(h)
  })

  // Le fond ne défile pas pendant la visite ; focus sur « Suivant », puis retour au focus d'origine.
  useEffect(() => {
    const before = document.activeElement as HTMLElement | null
    const prevOverflow = document.body.style.overflow
    document.body.style.overflow = 'hidden'
    return () => {
      document.body.style.overflow = prevOverflow
      before?.focus?.({ preventScroll: true })
    }
  }, [])
  useEffect(() => { nextRef.current?.focus({ preventScroll: true }) }, [index])

  // Clavier : Échap = Passer, flèches = navigation, Tab reste dans la bulle.
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape') { e.preventDefault(); latest.current.skip() }
      else if (e.key === 'ArrowRight') { e.preventDefault(); latest.current.next() }
      else if (e.key === 'ArrowLeft') { e.preventDefault(); latest.current.prev() }
      else if (e.key === 'Tab') {
        const items = Array.from(bubbleRef.current?.querySelectorAll<HTMLElement>('button') ?? [])
        if (!items.length) return
        const i = items.indexOf(document.activeElement as HTMLElement)
        e.preventDefault()
        items[(i + (e.shiftKey ? -1 : 1) + items.length) % items.length].focus()
      }
    }
    window.addEventListener('keydown', onKey)
    return () => window.removeEventListener('keydown', onKey)
  }, [])

  const L = layout(rect, vp.w, vp.h, bh)
  const text = fillTour(step.text, vars)

  return (
    <div ref={rootRef} className="tour-root" role="dialog" aria-modal="true" aria-labelledby="tour-tag" aria-describedby="tour-text">
      <div className="tour-block" />
      {L.spot
        ? <div className={'tour-spot' + (moving ? ' moving' : '')} style={{ top: L.spot.top, left: L.spot.left, width: L.spot.width, height: L.spot.height }} />
        : <div className="tour-veil" />}
      <div ref={bubbleRef} className={'tour-bubble' + (moving ? ' moving' : '')} style={{ top: L.top, left: L.left, width: L.bw }}>
        {L.tail && <i className={'tour-tail ' + L.tail.dir} style={{ left: L.tail.left }} aria-hidden="true" />}
        <div className="tour-head">
          <span className="tour-av"><MemoAvatar animal={animal} size={34} /></span>
          <span className="tour-who">
            <b>{vars.memo}</b>
            <span id="tour-tag" className="tour-tag"><Icon name={step.icon} size={14} stroke={2} />{step.tag}</span>
          </span>
          <span className="tour-count" aria-label={`Étape ${index + 1} sur ${total}`}>{index + 1}/{total}</span>
        </div>
        <p id="tour-text" className="tour-text" aria-live="polite">{text}</p>
        <div className="tour-dots" aria-hidden="true">{steps.map((s, k) => <i key={s.tag + k} className={k === index ? 'on' : k < index ? 'past' : ''} />)}</div>
        <div className="tour-actions">
          {last ? <span /> : <button type="button" className="tour-skip" onClick={skip}>Passer</button>}
          <button ref={nextRef} type="button" className="tour-next" onClick={next}>{last ? 'Terminé' : 'Suivant'}</button>
        </div>
      </div>
    </div>
  )
}
