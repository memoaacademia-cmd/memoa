import { Component, type ErrorInfo, type ReactNode } from 'react'
import { reportError } from '../lib/track'

/** Dernier filet : si un écran plante, l'étudiant voit un message clair (pas une page blanche) et l'erreur part dans app_errors. */
export default class ErrorBoundary extends Component<{ children: ReactNode }, { failed: boolean }> {
  state = { failed: false }

  static getDerivedStateFromError() {
    return { failed: true }
  }

  componentDidCatch(error: Error, info: ErrorInfo) {
    reportError(error, `react:${(info.componentStack ?? '').split('\n')[1]?.trim().slice(0, 80) ?? ''}`)
  }

  render() {
    if (!this.state.failed) return this.props.children
    return (
      <main className="page" role="alert" style={{ justifyContent: 'center', textAlign: 'center', alignItems: 'center', minHeight: '100dvh', gap: 12, padding: 24 }}>
        <h1 className="h1">Oups, quelque chose s’est mal passé</h1>
        <p className="lead">Tes notes et tes cours sont en sécurité. Recharge Memoa pour continuer.</p>
        <button type="button" className="btn" onClick={() => window.location.reload()}>Recharger</button>
      </main>
    )
  }
}
