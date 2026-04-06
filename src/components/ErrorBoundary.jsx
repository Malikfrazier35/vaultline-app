import { Component } from 'react'

export class SectionBoundary extends Component {
  constructor(props) { super(props); this.state = { hasError: false } }
  static getDerivedStateFromError() { return { hasError: true } }
  componentDidCatch(error) { console.warn(`[Vaultline] ${this.props.name || 'Section'}: ${error?.message}`) }
  render() {
    if (this.state.hasError) return null
    return this.props.children
  }
}

export default class ErrorBoundary extends Component {
  constructor(props) { super(props); this.state = { hasError: false } }
  static getDerivedStateFromError() { return { hasError: true } }
  componentDidCatch(error) { console.error('[Vaultline] Page error:', error?.message) }
  render() {
    if (!this.state.hasError) return this.props.children
    return (
      <div style={{ minHeight: '100vh', display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', background: 'var(--color-void, #0C1222)', color: 'var(--color-t1, #F1F5F9)', fontFamily: 'system-ui, sans-serif', padding: '24px' }}>
        <h1 style={{ fontSize: 22, fontWeight: 800, marginBottom: 8 }}>This page hit a snag</h1>
        <p style={{ fontSize: 14, color: 'var(--color-t3, #94A3B8)', marginBottom: 28, textAlign: 'center', maxWidth: 440 }}>Your data is safe. A quick refresh should fix it.</p>
        <div style={{ display: 'flex', gap: 12 }}>
          <button onClick={() => window.location.reload()} style={{ padding: '12px 28px', borderRadius: 12, background: 'linear-gradient(to right, rgba(34,211,238,0.9), rgba(34,211,238,0.7))', color: '#0C1222', fontSize: 14, fontWeight: 700, border: 'none', cursor: 'pointer' }}>Refresh Page</button>
          <a href="/dashboard" style={{ padding: '12px 28px', borderRadius: 12, color: 'var(--color-t3)', fontSize: 14, fontWeight: 600, border: '1px solid rgba(100,116,139,0.15)', textDecoration: 'none', display: 'inline-flex', alignItems: 'center' }}>Go to Dashboard</a>
        </div>
      </div>
    )
  }
}
