import { useEffect } from 'react'
import { HashRouter, Navigate, Outlet, Route, Routes, useLocation } from 'react-router-dom'
import { NavBar, Spinner } from './components/ui'
import { Confirmation, ForgotPassword, GoogleNext, Login, NewPassword, Signup } from './pages/Auth'
import Onboarding, { Adoption, PhotoStep } from './pages/Onboarding'
import Home from './pages/Home'
import { Backpack, CourseDetail, NewCourse, TpAssistant } from './pages/Courses'
import Library from './pages/Library'
import Assistant from './pages/Assistant'
import { Me, Premium, Settings } from './pages/Me'
import { About, Feedback, Help, Privacy, Terms } from './pages/Info'
import { AuthProvider, useAuth } from './lib/auth'
import { isConfigured } from './lib/supabase'
import { usePref } from './lib/prefs'

function Guard({ need }: { need: 'public' | 'auth' | 'onboarded' }) {
  const { user, profile, loading, recovery } = useAuth()
  const loc = useLocation()
  if (loading) return <div className="shell"><Spinner /></div>
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
      <Outlet />
      <NavBar />
    </div>
  )
}

function ConfirmationRoute() {
  const loc = useLocation()
  return <Confirmation email={(loc.state as { email?: string } | null)?.email ?? ''} />
}

function Theme() {
  const [theme] = usePref('theme', 'dark')
  useEffect(() => {
    document.documentElement.dataset.theme = theme
  }, [theme])
  return null
}

export default function App() {
  return (
    <AuthProvider>
      <Theme />
      <HashRouter>
        <Routes>
          <Route element={<Guard need="public" />}>
            <Route path="/connexion" element={<Login />} />
            <Route path="/creer-un-compte" element={<Signup />} />
            <Route path="/google-suite" element={<GoogleNext />} />
            <Route path="/mot-de-passe-oublie" element={<ForgotPassword />} />
            <Route path="/confirmation" element={<ConfirmationRoute />} />
          </Route>
          <Route path="/nouveau-mot-de-passe" element={<div className="shell"><NewPassword /></div>} />
          <Route element={<Guard need="auth" />}>
            <Route path="/inscription" element={<Onboarding />} />
            <Route path="/adoption" element={<Adoption />} />
            <Route path="/photo" element={<PhotoStep />} />
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
