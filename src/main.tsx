import { StrictMode } from 'react'
import { createRoot } from 'react-dom/client'
import App from './App'
import { getPref } from './lib/prefs'
import './styles.css'

// Thème appliqué avant l'affichage : clair par défaut, pas de flash sombre au démarrage.
document.documentElement.dataset.theme = getPref('theme', 'light')

createRoot(document.getElementById('root') as HTMLElement).render(
  <StrictMode>
    <App />
  </StrictMode>
)

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
