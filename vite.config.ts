import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'

// base './' : l'app peut être hébergée sur GitHub Pages (sous-dossier) ou à la racine.
export default defineConfig({
  plugins: [react()],
  base: './'
})
