import { useRef, useState, type FormEvent } from 'react'
import { Link, useNavigate, useSearchParams } from 'react-router-dom'
import { Brand, ErrorBox, MemoAvatar, Steps, useAction } from '../components/ui'
import { ANIMALS } from '../data/animals'
import { CATALOGUE, OTHER_DEP, OTHER_FAC, OTHER_UNIV, PROMOTIONS, VACATIONS } from '../data/academic'
import { saveProfile, uploadAvatar } from '../lib/api'
import { useAuth } from '../lib/auth'
import { composeFullName, initialsOf, titleCase } from '../lib/names'
import type { Profile } from '../lib/types'

/** Retrouve la valeur à afficher dans la liste : la valeur connue, sinon « Autre » + texte libre. */
function initial(p: Profile | null) {
  const univKnown = p && CATALOGUE[p.university]
  const facKnown = univKnown && CATALOGUE[p!.university][p!.faculty]
  const depKnown = facKnown && CATALOGUE[p!.university][p!.faculty].includes(p!.department)
  return {
    last: p?.last_name ?? '',
    post: p?.post_name ?? '',
    first: p?.first_name ?? '',
    univ: !p?.university ? Object.keys(CATALOGUE)[0] : univKnown ? p.university : OTHER_UNIV,
    univTxt: p?.university && !univKnown ? p.university : '',
    fac: !p?.faculty ? '' : facKnown ? p.faculty : OTHER_FAC,
    facTxt: p?.faculty && !facKnown ? p.faculty : '',
    dep: !p?.department ? '' : depKnown ? p.department : OTHER_DEP,
    depTxt: p?.department && !depKnown ? p.department : '',
    promo: p?.promotion ?? 'L1',
    vac: p?.vacation ?? ''
  }
}

export default function Onboarding() {
  const nav = useNavigate()
  const [params] = useSearchParams()
  const editing = params.get('edit') === '1'
  const { user, profile, refresh } = useAuth()
  const { busy, error, setError, run } = useAction()
  const [f, setF] = useState(() => initial(profile))
  const set = (patch: Partial<typeof f>) => setF((x) => ({ ...x, ...patch }))

  const univAutre = f.univ === OTHER_UNIV
  const facs = univAutre ? [] : Object.keys(CATALOGUE[f.univ] ?? {})
  const facAutre = univAutre || f.fac === OTHER_FAC
  const deps = facAutre ? [] : CATALOGUE[f.univ]?.[f.fac] ?? []
  const depAutre = facAutre || f.dep === OTHER_DEP

  function onUniv(v: string) {
    if (v === OTHER_UNIV) set({ univ: v, fac: OTHER_FAC, dep: OTHER_DEP })
    else set({ univ: v, fac: '', dep: '' })
  }
  function onFac(v: string) {
    if (v === OTHER_FAC) set({ fac: v, dep: OTHER_DEP })
    else set({ fac: v, dep: '' })
  }

  async function submit(e: FormEvent) {
    e.preventDefault()
    if (!user) return
    const university = (univAutre ? f.univTxt : f.univ).trim()
    const faculty = (facAutre ? f.facTxt : f.fac).trim()
    const department = (depAutre ? f.depTxt : f.dep).trim()
    const last = titleCase(f.last)
    const post = titleCase(f.post)
    const first = titleCase(f.first)
    if (last.length < 2) return setError('Écris ton nom (2 lettres minimum).')
    if (first.length < 2) return setError('Écris ton prénom (2 lettres minimum).')
    if (!university) return setError("Écris le nom de ton université.")
    if (!faculty) return setError(facAutre ? 'Écris le nom de ta faculté.' : 'Choisis ta faculté.')
    if (!department) return setError(depAutre ? 'Écris le nom de ton département.' : 'Choisis ton département.')
    const ok = await run(async () => {
      await saveProfile(user.id, {
        full_name: composeFullName(last, post, first),
        last_name: last, post_name: post, first_name: first,
        phone: profile?.phone ?? user.phone,
        university, faculty, department,
        promotion: f.promo, vacation: f.vac
      })
      await refresh()
      return true
    })
    if (ok) nav(editing || profile?.memo_animal ? '/moi' : '/adoption', { replace: true })
  }

  return (
    <main className="page auth">
      <div style={{ display: 'flex', flexDirection: 'column', gap: 14, paddingTop: 8 }}>
        {!editing && <Steps n={2} />}
        <Brand size={44} />
      </div>
      <div style={{ display: 'flex', flexDirection: 'column', gap: 6, textAlign: 'center' }}>
        <h1 className="h1 big">{editing ? 'Modifiez vos informations' : 'Présentez-vous'}</h1>
        <p className="lead">Memoa adapte tes cours et ta Librairie à ton parcours.</p>
      </div>
      <form onSubmit={submit} style={{ display: 'flex', flexDirection: 'column', gap: 12 }} noValidate>
        <div className="field">
          <label htmlFor="nom">Nom</label>
          <input id="nom" className="input" autoComplete="family-name" placeholder="ex. Kasongo" value={f.last} onChange={(e) => set({ last: e.target.value })} />
        </div>
        <div className="field">
          <label htmlFor="postnom">Post-nom</label>
          <input id="postnom" className="input" autoComplete="additional-name" placeholder="ex. Mutombo" value={f.post} onChange={(e) => set({ post: e.target.value })} />
        </div>
        <div className="field">
          <label htmlFor="prenom">Prénom</label>
          <input id="prenom" className="input" autoComplete="given-name" placeholder="ex. Jean" value={f.first} onChange={(e) => set({ first: e.target.value })} />
        </div>

        <div className="field">
          <label htmlFor="univ">Université</label>
          <select id="univ" className="select" value={f.univ} onChange={(e) => onUniv(e.target.value)}>
            {Object.keys(CATALOGUE).map((u) => <option key={u} value={u}>{u}</option>)}
            <option value={OTHER_UNIV}>{OTHER_UNIV}</option>
          </select>
          {univAutre && <input className="input" aria-label="Nom de ton université" placeholder="Écris le nom de ton université" value={f.univTxt} onChange={(e) => set({ univTxt: e.target.value })} />}
        </div>

        <div className="field">
          <label htmlFor="fac">Faculté</label>
          {!univAutre && (
            <select id="fac" className="select" value={f.fac} onChange={(e) => onFac(e.target.value)}>
              <option value="" disabled>Choisis ta faculté</option>
              {facs.map((x) => <option key={x} value={x}>{x}</option>)}
              <option value={OTHER_FAC}>{OTHER_FAC}</option>
            </select>
          )}
          {facAutre && <input id={univAutre ? 'fac' : undefined} className="input" aria-label="Nom de ta faculté" placeholder="Écris le nom de ta faculté" value={f.facTxt} onChange={(e) => set({ facTxt: e.target.value })} />}
        </div>

        <div className="field">
          <label htmlFor="dep">Département</label>
          {!facAutre && (
            <select id="dep" className="select" value={f.dep} onChange={(e) => set({ dep: e.target.value })}>
              <option value="" disabled>Choisis ton département</option>
              {deps.map((x) => <option key={x} value={x}>{x}</option>)}
              <option value={OTHER_DEP}>{OTHER_DEP}</option>
            </select>
          )}
          {depAutre && <input id={facAutre ? 'dep' : undefined} className="input" aria-label="Nom de ton département" placeholder="Écris le nom de ton département" value={f.depTxt} onChange={(e) => set({ depTxt: e.target.value })} />}
        </div>

        <div className="row">
          <div className="field">
            <label htmlFor="promo">Promotion</label>
            <select id="promo" className="select" value={f.promo} onChange={(e) => set({ promo: e.target.value })}>
              {PROMOTIONS.map((p) => <option key={p}>{p}</option>)}
            </select>
          </div>
          <div className="field">
            <label htmlFor="vac">Vacation (facultatif)</label>
            <select id="vac" className="select" value={f.vac} onChange={(e) => set({ vac: e.target.value })}>
              <option value="">Je ne précise pas</option>
              {VACATIONS.map((v) => <option key={v}>{v}</option>)}
            </select>
          </div>
        </div>

        <ErrorBox message={error} />
        <button className="btn primary-light" type="submit" disabled={busy}>{busy ? 'Enregistrement…' : editing ? 'Enregistrer' : 'Continuer'}</button>
        <span className="muted" style={{ textAlign: 'center' }}>Tu pourras tout modifier plus tard, et ajouter une photo, dans Moi.</span>
      </form>
    </main>
  )
}

/* Adoption d'un Memo : choisir un animal, puis lui donner un nom. */
export function Adoption() {
  const nav = useNavigate()
  const [params] = useSearchParams()
  const changing = params.get('change') === '1'
  const { user, profile, refresh } = useAuth()
  const { busy, error, setError, run } = useAction()
  const [animal, setAnimal] = useState<string | null>(changing ? null : profile?.memo_animal ?? null)
  const [name, setName] = useState(profile?.memo_name ?? '')
  const chosen = ANIMALS.find((a) => a.id === animal)

  async function adopt() {
    if (!user || !animal) return
    const n = name.trim()
    if (n.length < 2) return setError('Donne un nom à ton Memo (2 lettres minimum).')
    if (n.length > 20) return setError('Ce nom est trop long (20 lettres maximum).')
    const ok = await run(async () => {
      await saveProfile(user.id, { memo_animal: animal, memo_name: n })
      await refresh()
      return true
    })
    if (ok) nav(changing ? '/moi' : '/photo', { replace: true })
  }

  if (!chosen) {
    return (
      <main className="page" style={{ paddingBottom: 28 }}>
        <span className="label-mono">{changing ? 'Mon Memo' : 'Étape 2 sur 3'}</span>
        <h1 className="h1 big">{changing ? 'Change de Memo' : 'Adopte ton Memo'}</h1>
        <p className="lead">Il t'accompagne dans tes révisions. Choisis l'animal qui te ressemble.</p>
        {changing && <Link to="/moi" className="link">Annuler</Link>}
        <div className="grid2">
          {ANIMALS.map((a) => (
            <button key={a.id} type="button" className="tile" style={{ alignItems: 'center', justifyContent: 'center', gap: 8, minHeight: 150 }} onClick={() => setAnimal(a.id)} aria-label={`Choisir ${a.name}`}>
              <MemoAvatar animal={a.id} size={84} />
              <span className="h2">{a.name}</span>
            </button>
          ))}
        </div>
      </main>
    )
  }

  return (
    <main className="page" style={{ paddingBottom: 28, alignItems: 'center', textAlign: 'center' }}>
      <MemoAvatar animal={chosen.id} size={160} />
      <h1 className="h1 big">Comment s'appelle-t-il ?</h1>
      <p className="lead">Ton {chosen.name.toLowerCase()} t'attend. Donne-lui un nom.</p>
      <div className="field" style={{ width: '100%', textAlign: 'left' }}>
        <label htmlFor="memo-nom">Nom de ton Memo</label>
        <input id="memo-nom" className="input" maxLength={20} placeholder="Ex. Mbote" value={name} onChange={(e) => setName(e.target.value)} />
      </div>
      <div className="chips" style={{ justifyContent: 'center', flexWrap: 'wrap' }}>
        {['Mbote', 'Zola', 'Memo'].map((s) => <button key={s} type="button" className="pill" onClick={() => setName(s)}>{s}</button>)}
      </div>
      <ErrorBox message={error} />
      <button className="btn" type="button" onClick={adopt} disabled={busy} style={{ marginTop: 'auto' }}>
        {busy ? 'Un instant…' : `C'est parti${name.trim() ? ', ' + name.trim() : ''}`}
      </button>
      <button className="link" type="button" onClick={() => setAnimal(null)}>Choisir un autre animal</button>
    </main>
  )
}

/* Étape 3, facultative : une photo de profil. « Passer » mène directement à l'accueil. */
export function PhotoStep() {
  const nav = useNavigate()
  const { user, profile, refresh } = useAuth()
  const { busy, error, run } = useAction()
  const file = useRef<HTMLInputElement>(null)
  const [preview, setPreview] = useState<string | null>(null)

  async function pick(f: File | undefined) {
    if (!f || !user) return
    const ok = await run(async () => {
      const url = await uploadAvatar(user.id, f)
      await saveProfile(user.id, { avatar_url: url })
      await refresh()
      return url
    })
    if (ok) setPreview(ok)
  }

  const shown = preview ?? profile?.avatar_url ?? null

  return (
    <main className="page" style={{ paddingBottom: 28, alignItems: 'center', textAlign: 'center' }}>
      <span className="label-mono">Facultatif</span>
      <h1 className="h1 big">Ajoute ta photo</h1>
      <p className="lead">Pour que Memoa soit à ton image. Tu peux aussi le faire plus tard, dans Moi.</p>
      <button type="button" className="icon-btn" style={{ width: 160, height: 160, borderRadius: '50%', overflow: 'hidden', padding: 0 }} onClick={() => file.current?.click()} disabled={busy} aria-label="Choisir une photo de profil">
        {shown ? <img src={shown} alt="" style={{ width: '100%', height: '100%', objectFit: 'cover' }} /> : <span className="h1 big">{initialsOf(profile)}</span>}
      </button>
      <input ref={file} type="file" accept="image/*" hidden onChange={(e) => { void pick(e.target.files?.[0]); e.target.value = '' }} />
      <ErrorBox message={error} />
      <div style={{ marginTop: 'auto', width: '100%', display: 'flex', flexDirection: 'column', gap: 10 }}>
        {shown ? (
          <>
            <button className="btn" type="button" onClick={() => nav('/presentation', { replace: true })} disabled={busy}>Continuer</button>
            <button className="link" type="button" onClick={() => file.current?.click()} disabled={busy}>Choisir une autre photo</button>
          </>
        ) : (
          <>
            <button className="btn" type="button" onClick={() => file.current?.click()} disabled={busy}>{busy ? 'Un instant…' : 'Choisir une photo'}</button>
            <button className="link" type="button" onClick={() => nav('/presentation', { replace: true })} disabled={busy}>Passer</button>
          </>
        )}
      </div>
    </main>
  )
}
