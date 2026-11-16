import { StrictMode } from 'react'
import { createRoot } from 'react-dom/client'
import App from './App'
import ErrorBoundary from './components/ErrorBoundary'
import NoticeBar from './components/NoticeBar'
import { installTracking } from './lib/track'
import { getPref } from './lib/prefs'
import './styles.css'

// Thème appliqué avant l'affichage : clair par défaut, pas de flash sombre au démarrage.
document.documentElement.dataset.theme = getPref('theme', 'light')

// Paiement dans une fenêtre intégrée : quand Chariow nous renvoie DANS la fenêtre, on n'affiche pas toute l'appli à l'intérieur,
// on prévient simplement l'appli parente (même origine) qui ferme la fenêtre et affiche « Activation en cours… ».
const framed = (() => { try { return window.self !== window.top } catch { return true } })()
if (framed && /[?&]paiement=retour/.test(window.location.search)) {
  try { window.parent.postMessage({ type: 'memoa-paiement-retour' }, window.location.origin) } catch { /* sans importance */ }
  const root = document.getElementById('root') as HTMLElement
  root.style.cssText = 'display:flex;align-items:center;justify-content:center;min-height:100dvh;padding:24px;text-align:center;font-family:Sora,system-ui,sans-serif;color:#0b1513'
  root.textContent = 'Paiement reçu. Activation de ton Premium en cours…'
} else {
  createRoot(document.getElementById('root') as HTMLElement).render(
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
