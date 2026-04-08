import { Component } from 'react'

const MAX_SECTION_RETRIES = 3
const AUTO_RETRY_DELAY = 1500

// ═══ SECTION-LEVEL — Auto-recovers silently, never blocks the user ═══
export class SectionBoundary extends Component {
  constructor(props) {
    super(props)
    this.state = { hasError: false, retryCount: 0 }
    this._retryTimer = null
  }

  static getDerivedStateFromError() {
    return { hasError: true }
  }

  componentDidCatch(error) {
    console.warn(`[Vaultline] ${this.props.name || 'Section'}: ${error?.message}`)
  }

  componentDidUpdate(_, prevState) {
    // Auto-retry silently after a delay
    if (this.state.hasError && !prevState.hasError && this.state.retryCount < MAX_SECTION_RETRIES) {
      this._retryTimer = setTimeout(() => {
        this.setState(prev => ({ hasError: false, retryCount: prev.retryCount + 1 }))
      }, AUTO_RETRY_DELAY)
    }
  }

  componentWillUnmount() {
    if (this._retryTimer) clearTimeout(this._retryTimer)
  }

  render() {
    if (this.state.hasError) {
      const { height = 'h-[200px]' } = this.props
      const exhausted = this.state.retryCount >= MAX_SECTION_RETRIES
      if (!exhausted) {
        // Show subtle loading state while auto-retrying
        return (
          <div className={`${height} flex items-center justify-center rounded-2xl`}>
            <div className="w-5 h-5 border-2 border-t3 border-t-cyan rounded-full animate-spin" />
          </div>
        )
      }
      // Only show manual retry after all auto-retries exhausted
      return (
        <div className={`${height} flex flex-col items-center justify-center rounded-2xl border border-border/30 bg-deep/50`}>
          <p className="text-[12px] text-t3 mb-3">Section unavailable</p>
          <button onClick={() => this.setState({ hasError: false, retryCount: 0 })} className="px-4 py-2 rounded-lg text-[11px] font-mono text-t3 border border-border hover:text-cyan hover:border-cyan/[0.15] transition-all">
            Retry
          </button>
        </div>
      )
    }
    return this.props.children
  }
}

// ═══ PAGE-LEVEL — Auto-retries once, then shows stable fallback ═══
export default class ErrorBoundary extends Component {
  constructor(props) {
    super(props)
    this.state = { hasError: false, retried: false }
    this._retryTimer = null
  }

  static getDerivedStateFromError() {
    return { hasError: true }
  }

  componentDidCatch(error) {
    console.error('[Vaultline] Page error:', error?.message)
  }

  componentDidUpdate(_, prevState) {
    // Auto-retry once after 2 seconds
    if (this.state.hasError && !prevState.hasError && !this.state.retried) {
      this._retryTimer = setTimeout(() => {
        this.setState({ hasError: false, retried: true })
      }, 2000)
    }
  }

  componentWillUnmount() {
    if (this._retryTimer) clearTimeout(this._retryTimer)
  }

  render() {
    if (!this.state.hasError) return this.props.children

    // If still auto-retrying, show skeleton
    if (!this.state.retried) {
      return (
        <div style={{ minHeight: '100vh', display: 'flex', alignItems: 'center', justifyContent: 'center', background: 'var(--color-void, #0C1222)' }}>
          <div style={{ width: 32, height: 32, border: '2px solid var(--color-t4, #475569)', borderTopColor: 'var(--color-cyan, #22D3EE)', borderRadius: '50%', animation: 'spin 1s linear infinite' }} />
        </div>
      )
    }

    return (
      <div style={{ minHeight: '100vh', display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', background: 'var(--color-void, #0C1222)', color: 'var(--color-t1, #F1F5F9)', fontFamily: 'system-ui, sans-serif', padding: '24px' }}>
        <div style={{ width: 56, height: 56, borderRadius: 16, background: 'rgba(34,211,238,0.06)', border: '1px solid rgba(34,211,238,0.1)', display: 'flex', alignItems: 'center', justifyContent: 'center', marginBottom: 20 }}>
          <svg width="26" height="26" viewBox="0 0 24 24" fill="none" stroke="#22D3EE" strokeWidth="2"><path d="M3 12a9 9 0 1018 0 9 9 0 00-18 0z"/><path d="M12 8v4"/><path d="M12 16h.01"/></svg>
        </div>
        <h1 style={{ fontSize: 22, fontWeight: 800, marginBottom: 8 }}>This page hit a snag</h1>
        <p style={{ fontSize: 14, color: 'var(--color-t3, #94A3B8)', marginBottom: 28, textAlign: 'center', maxWidth: 440 }}>
          Your data is safe and encrypted. A quick refresh should fix it.
        </p>
        <div style={{ display: 'flex', gap: 12, marginBottom: 32 }}>
          <button onClick={() => window.location.reload()} style={{ padding: '12px 28px', borderRadius: 12, background: 'linear-gradient(to right, rgba(34,211,238,0.9), rgba(34,211,238,0.7))', color: 'var(--color-void)', fontSize: 14, fontWeight: 700, border: 'none', cursor: 'pointer' }}>
            Refresh Page
          </button>
          <a href="/dashboard" style={{ padding: '12px 28px', borderRadius: 12, background: 'transparent', color: 'var(--color-t3, #94A3B8)', fontSize: 14, fontWeight: 600, border: '1px solid rgba(100,116,139,0.15)', cursor: 'pointer', textDecoration: 'none', display: 'inline-flex', alignItems: 'center' }}>
            Go to Dashboard
          </a>
        </div>
        <div style={{ display: 'flex', gap: 20, marginBottom: 40 }}>
          {[{l:'Dashboard',h:'/dashboard'},{l:'Cash Position',h:'/position'},{l:'Forecast',h:'/forecast'},{l:'Transactions',h:'/transactions'},{l:'Banks',h:'/banks'},{l:'Billing',h:'/billing'},{l:'Settings',h:'/settings'}].map(n => (
            <a key={n.h} href={n.h} style={{ fontSize: 13, color: 'rgba(34,211,238,0.6)', textDecoration: 'none' }}>{n.l}</a>
          ))}
        </div>
        <p style={{ fontSize: 11, color: 'rgba(100,116,139,0.5)', fontFamily: 'JetBrains Mono, monospace' }}>
          Need help? <a href="mailto:support@vaultline.app" style={{ color: 'rgba(34,211,238,0.5)' }}>support@vaultline.app</a>
        </p>
      </div>
    )
  }
}
