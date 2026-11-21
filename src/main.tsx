import { StrictMode } from 'react'
import { createRoot } from 'react-dom/client'
import App from './App'
import ErrorBoundary from './components/ErrorBoundary'
import NoticeBar from './components/NoticeBar'
import { installTracking } from './lib/track'
import { getPref } from './lib/prefs'
import { isConfigured } from './lib/supabase'
import { PARTNER_PROGRAM_ENABLED } from './lib/features'
import { captureRefFromUrl, prepareInstall } from './lib/referral'
import './styles.css'

// Thème appliqué avant l'affichage : clair par défaut, pas de flash sombre au démarrage.
document.documentElement.dataset.theme = getPref('theme', 'light')

// Programme partenaire : si l'adresse contient ?ref=CODE, on garde le code (téléphone) et on prépare l'installation avec ce code.
if (PARTNER_PROGRAM_ENABLED) {
  const refCode = captureRefFromUrl()
  if (refCode) prepareInstall(refCode)
}

const root = document.getElementById('root') as HTMLElement
if (!isConfigured) {
  root.style.cssText = 'display:flex;align-items:center;justify-content:center;min-height:100dvh;padding:24px;text-align:center;font-family:Sora,system-ui,sans-serif'
  root.textContent = 'Configuration manquante : les clés Supabase (VITE_SUPABASE_URL et VITE_SUPABASE_ANON_KEY) ne sont pas renseignées.'
} else {
  createRoot(root).render(
    <StrictMode>
      <ErrorBoundary>
        <App />
        <NoticeBar />
      </ErrorBoundary>
    </StrictMode>
  )
}

// Erreurs non rattrapées (window.onerror, promesses rejetées) + envoi de la file de mesure.
installTracking()

// Rend le site installable sur l'écran d'accueil. Sans effet si le navigateur ne le permet pas.
if ('serviceWorker' in navigator && import.meta.env.PROD) {
  window.addEventListener('load', () => {
    navigator.serviceWorker
      .register('./sw.js')
      .then(() => navigator.serviceWorker.ready)
      .then((reg) => {
        // On confie au service worker la liste des fichiers déjà chargés : l'appli pourra s'ouvrir sans réseau.
        const urls = [location.origin + location.pathname, ...performance.getEntriesByType('resource').map((r) => r.name)].filter((u) => u.startsWith(location.origin))
        reg.active?.postMessage({ type: 'precache', urls })
      })
      .catch(() => { /* facultatif */ })
  })
}
