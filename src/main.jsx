import React from 'react'
import ReactDOM from 'react-dom/client'
import App from './App'
import ErrorBoundary from '@/components/ErrorBoundary'
import { ToastProvider } from '@/components/Toast'
import { Analytics } from '@vercel/analytics/react'
import '@/styles/globals.css'

// ═══ GLOBAL ERROR HANDLERS ═══

// Catch unhandled promise rejections (edge function failures, network errors)
window.addEventListener('unhandledrejection', (event) => {
  event.preventDefault()
  console.warn('[Vaultline] Caught unhandled rejection:', event.reason?.message || event.reason)
})

// Chunk load failure recovery — when Vercel deploys a new version, old chunk hashes become invalid
// This auto-reloads once to fetch the new chunks (prevents white screen on hard refresh after deploy)
let chunkRetried = false
window.addEventListener('error', (event) => {
  const msg = event.message || ''
  if (
    (msg.includes('Loading chunk') ||
     msg.includes('Failed to fetch dynamically imported module') ||
     msg.includes('Importing a module script failed') ||
     msg.includes('error loading dynamically imported module'))
    && !chunkRetried
  ) {
    chunkRetried = true
    event.preventDefault()
    console.warn('[Vaultline] Chunk load failed — reloading to fetch updated assets')
    // Clear module cache and reload
    if ('caches' in window) {
      caches.keys().then(names => names.forEach(name => caches.delete(name)))
    }
    window.location.reload()
  }
})

// Prevent ResizeObserver loop errors from crashing the app (common in charts/dashboards)
const origError = console.error
console.error = (...args) => {
  if (typeof args[0] === 'string' && args[0].includes('ResizeObserver')) return
  origError.apply(console, args)
}

ReactDOM.createRoot(document.getElementById('root')).render(
  <React.StrictMode>
    <ErrorBoundary>
      <ToastProvider>
        <App />
      </ToastProvider>
    </ErrorBoundary>
    <Analytics />
  </React.StrictMode>
)
