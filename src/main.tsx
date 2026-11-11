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
    navigator.serviceWorker.register('./sw.js').catch(() => { /* facultatif */ })
  })
}
