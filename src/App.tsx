import { useEffect, useState } from 'react'
import { HashRouter, Navigate, Outlet, Route, Routes, useLocation } from 'react-router-dom'
import { Brand, NavBar, Spinner } from './components/ui'
import MiniPlayer from './components/MiniPlayer'
import { TourProvider } from './components/Tour'
import { DraftWatcher } from './components/Drafts'
import { Confirmation, ForgotPassword, GoogleNext, Login, NewPassword, Signup } from './pages/Auth'
import Onboarding, { Adoption, PhotoStep } from './pages/Onboarding'
import { NotifStep, TrialStep } from './pages/Welcome'
import Home from './pages/Home'
import Install from './pages/Install'
import { Backpack, CourseDetail, NewCourse, TpAssistant } from './pages/Courses'
import Library from './pages/Library'
import Assistant from './pages/Assistant'
import { Me, Premium, Settings } from './pages/Me'
import { About, Feedback, Help, Privacy, Terms } from './pages/Info'
import Tours from './pages/Tours'
import { AuthProvider, useAuth } from './lib/auth'
import { OutboxSync } from './components/OfflineSave'
import { isConfigured } from './lib/supabase'
import { usePref } from './lib/prefs'

/** Bandeau discret : le réseau coupe, l'étudiant reste connecté et tout se remet à jour au retour. */
function ConnectionBanner() {
  const [online, setOnline] = useState(() => (typeof navigator === 'undefined' ? true : navigator.onLine))
  const [back, setBack] = useState(false)
  useEffect(() => {
    let t: number | undefined
    const off = () => { setOnline(false); setBack(false) }
    const on = () => {
      setOnline(true)
      setBack(true)
      window.clearTimeout(t)
      t = window.setTimeout(() => setBack(false), 2500)
    }
    window.addEventListener('offline', off)
    window.addEventListener('online', on)
    return () => {
      window.removeEventListener('offline', off)
      window.removeEventListener('online', on)
      window.clearTimeout(t)
    }
  }, [])
  if (online && !back) return null
  return (
    <div
      role="status"
      className="no-print"
      style={{ position: 'fixed', top: 0, left: 0, right: 0, zIndex: 30, textAlign: 'center', padding: '6px 12px', paddingTop: 'calc(6px + env(safe-area-inset-top, 0px))', fontSize: 13, fontWeight: 600, background: online ? 'var(--btn)' : '#3a4a45', color: online ? 'var(--btn-text)' : '#ffffff' }}
    >
      {online ? 'De retour en ligne' : 'Hors connexion'}
    </div>
  )
}

function ConnectionScreen({ onRetry }: { onRetry: () => void }) {
  return (
    <main className="page" style={{ justifyContent: 'center', textAlign: 'center', alignItems: 'center' }}>
      <Brand size={44} />
      <h1 className="h1">Pas de connexion</h1>
      <p className="lead">Memoa n’arrive pas à joindre le serveur. Tu restes connecté : réessaie dès que le réseau revient.</p>
      <button type="button" className="btn" onClick={onRetry}>Réessayer</button>
    </main>
  )
}

function Guard({ need }: { need: 'public' | 'auth' | 'onboarded' }) {
  const { user, profile, loading, recovery, loadFailed, refresh } = useAuth()
  const loc = useLocation()
  if (loading) return <div className="shell"><Spinner /></div>
  // Réseau coupé au démarrage et aucun profil gardé en mémoire : on attend le retour au lieu d'envoyer vers la connexion.
  if (user && !profile && loadFailed) return <div className="shell"><ConnectionScreen onRetry={() => void refresh()} /></div>
  // Arrivée par le lien « mot de passe oublié » : on ne laisse rien d'autre tant que le nouveau mot de passe n'est pas choisi.
  if (recovery && user) return <Navigate to="/nouveau-mot-de-passe" replace />

  if (need === 'public') {
    if (user && !user.needsPassword && loc.pathname !== '/google-suite' && profile?.memo_animal) return <Navigate to="/" replace />
    return <div className="shell"><Outlet /></div>
  }
  if (!user) return <Navigate to="/connexion" replace />
  // Compte créé via Google : mot de passe + téléphone d'abord.
  if (user.needsPassword) return <Navigate to="/google-suite" replace />
  if (need === 'auth') return <div className="shell app"><Outlet /></div>
  if (!profile || !profile.university) return <Navigate to="/inscription" replace />
  if (!profile.memo_animal) return <Navigate to="/adoption" replace />
  return (
    <div className="shell app">
      {!isConfigured && <div className="demo-banner" role="note">Mode démo : tes données restent dans ce navigateur.</div>}
      <DraftWatcher />
      <OutboxSync />
      <TourProvider>
        <Outlet />
        <MiniPlayer />
        <NavBar />
      </TourProvider>
    </div>
  )
}

function ConfirmationRoute() {
  const loc = useLocation()
  return <Confirmation email={(loc.state as { email?: string } | null)?.email ?? ''} />
}

function Theme() {
  const [theme] = usePref('theme', 'light')
  useEffect(() => {
    document.documentElement.dataset.theme = theme
  }, [theme])
  return null
}

export default function App() {
  return (
    <AuthProvider>
      <Theme />
      <ConnectionBanner />
      <HashRouter>
        <Routes>
          <Route element={<Guard need="public" />}>
            <Route path="/connexion" element={<Login />} />
            <Route path="/creer-un-compte" element={<Signup />} />
            <Route path="/google-suite" element={<GoogleNext />} />
            <Route path="/mot-de-passe-oublie" element={<ForgotPassword />} />
            <Route path="/confirmation" element={<ConfirmationRoute />} />
          </Route>
          <Route path="/installer" element={<div className="shell"><Install /></div>} />
          <Route path="/nouveau-mot-de-passe" element={<div className="shell"><NewPassword /></div>} />
          <Route element={<Guard need="auth" />}>
            <Route path="/inscription" element={<Onboarding />} />
            <Route path="/adoption" element={<Adoption />} />
            <Route path="/photo" element={<PhotoStep />} />
            <Route path="/bienvenue" element={<Navigate to="/inscription" replace />} />
            <Route path="/presentation" element={<Navigate to="/essai" replace />} />
            <Route path="/essai" element={<TrialStep />} />
            <Route path="/notifications-etape" element={<NotifStep />} />
          </Route>
          <Route element={<Guard need="onboarded" />}>
            <Route path="/" element={<Home />} />
            <Route path="/cours" element={<NewCourse />} />
            <Route path="/sac" element={<Backpack />} />
            <Route path="/sac/:id" element={<CourseDetail />} />
            <Route path="/tp/:id" element={<TpAssistant />} />
            <Route path="/librairie" element={<Library />} />
            <Route path="/assistant" element={<Assistant />} />
            <Route path="/moi" element={<Me />} />
            <Route path="/parametres" element={<Settings />} />
            <Route path="/premium" element={<Premium />} />
            <Route path="/visites" element={<Tours />} />
            <Route path="/aide" element={<Help />} />
            <Route path="/signaler" element={<Feedback mode="report" />} />
            <Route path="/avis" element={<Feedback mode="rating" />} />
            <Route path="/confidentialite" element={<Privacy />} />
            <Route path="/conditions" element={<Terms />} />
            <Route path="/a-propos" element={<About />} />
          </Route>
          <Route path="*" element={<Navigate to="/" replace />} />
        </Routes>
      </HashRouter>
    </AuthProvider>
  )
}
