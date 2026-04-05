import { useState, useEffect, useCallback, createContext, useContext } from 'react'
import { CheckCircle2, AlertTriangle, X, Info, XCircle } from 'lucide-react'

const ToastContext = createContext(null)

const ICONS = {
  success: CheckCircle2,
  error: XCircle,
  warning: AlertTriangle,
  info: Info,
}

const COLORS = {
  success: { bg: 'bg-green/[0.06]', border: 'border-green/[0.15]', icon: 'text-green', bar: 'bg-green' },
  error: { bg: 'bg-red/[0.06]', border: 'border-red/[0.15]', icon: 'text-red', bar: 'bg-red' },
  warning: { bg: 'bg-amber/[0.06]', border: 'border-amber/[0.15]', icon: 'text-amber', bar: 'bg-amber' },
  info: { bg: 'bg-cyan/[0.06]', border: 'border-cyan/[0.15]', icon: 'text-cyan', bar: 'bg-cyan' },
}

let toastId = 0

function Toast({ id, type = 'info', title, message, duration = 4000, onDismiss }) {
  const [exiting, setExiting] = useState(false)
  const [progress, setProgress] = useState(100)
  const Icon = ICONS[type] || ICONS.info
  const c = COLORS[type] || COLORS.info

  useEffect(() => {
    if (duration <= 0) return
    const start = Date.now()
    const tick = setInterval(() => {
      const elapsed = Date.now() - start
      const remaining = Math.max(0, 100 - (elapsed / duration) * 100)
      setProgress(remaining)
      if (remaining <= 0) { clearInterval(tick); dismiss() }
    }, 50)
    return () => clearInterval(tick)
  }, [duration])

  function dismiss() {
    setExiting(true)
    setTimeout(() => onDismiss(id), 250)
  }

  return (
    <div
      className={`relative w-80 rounded-xl border backdrop-blur-xl shadow-lg overflow-hidden transition-all duration-250 ${c.bg} ${c.border} ${
        exiting ? 'opacity-0 translate-x-8 scale-95' : 'opacity-100 translate-x-0 scale-100'
      }`}
      style={{ animation: exiting ? 'none' : 'slideInRight 0.3s ease-out' }}
    >
      <div className="flex items-start gap-3 p-3.5">
        <div className={`mt-0.5 flex-shrink-0 ${c.icon}`}>
          <Icon size={16} />
        </div>
        <div className="flex-1 min-w-0">
          {title && <p className="text-[13px] font-semibold text-t1 leading-tight">{title}</p>}
          {message && <p className={`text-[12px] text-t3 leading-relaxed ${title ? 'mt-0.5' : ''}`}>{message}</p>}
        </div>
        <button onClick={dismiss} className="flex-shrink-0 p-0.5 rounded hover:bg-deep text-t4 hover:text-t2 transition-colors">
          <X size={12} />
        </button>
      </div>
      {duration > 0 && (
        <div className="h-[2px] bg-border/20">
          <div className={`h-full ${c.bar} transition-all duration-100 ease-linear`} style={{ width: `${progress}%` }} />
        </div>
      )}
    </div>
  )
}

export function ToastProvider({ children }) {
  const [toasts, setToasts] = useState([])

  const addToast = useCallback((opts) => {
    const id = ++toastId
    const toast = typeof opts === 'string' ? { id, type: 'info', message: opts } : { id, ...opts }
    setToasts(prev => [...prev, toast].slice(-5)) // max 5 visible
    return id
  }, [])

  const dismiss = useCallback((id) => {
    setToasts(prev => prev.filter(t => t.id !== id))
  }, [])

  const toast = useCallback((message, type = 'info') => addToast({ type, message }), [addToast])
  toast.success = (message, title) => addToast({ type: 'success', message, title })
  toast.error = (message, title) => addToast({ type: 'error', message, title })
  toast.warning = (message, title) => addToast({ type: 'warning', message, title })
  toast.info = (message, title) => addToast({ type: 'info', message, title })

  return (
    <ToastContext.Provider value={toast}>
      {children}
      {/* Toast container */}
      <div className="fixed top-4 right-4 z-[9999] flex flex-col gap-2.5 pointer-events-none">
        {toasts.map(t => (
          <div key={t.id} className="pointer-events-auto">
            <Toast {...t} onDismiss={dismiss} />
          </div>
        ))}
      </div>
    </ToastContext.Provider>
  )
}

export function useToast() {
  const ctx = useContext(ToastContext)
  if (!ctx) throw new Error('useToast must be used within ToastProvider')
  return ctx
}
