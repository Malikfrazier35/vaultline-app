import { useState, useEffect, useCallback } from 'react'
import { useAuth } from '@/hooks/useAuth'
import { supabase } from '@/lib/supabase'
import { useToast } from '@/components/Toast'
import { Key, Copy, Eye, EyeOff, Check, Shield, Clock, BarChart3, Code, Zap, BookOpen, RefreshCw, Terminal, AlertTriangle, Globe, Lock, RotateCw, Trash2, Plus } from 'lucide-react'
import { Link } from 'react-router-dom'

function generateKey(prefix = 'vl_live') {
  const chars = 'ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789'
  let key = prefix + '_'
  for (let i = 0; i < 32; i++) key += chars.charAt(Math.floor(Math.random() * chars.length))
  return key
}

export default function ApiAccess() {
  const { org, profile } = useAuth()
  const toast = useToast()
  const [showKey, setShowKey] = useState(null)
  const [copied, setCopied] = useState(null)
  const [activeTab, setActiveTab] = useState('keys')
  const [keys, setKeys] = useState([])
  const [loadingKeys, setLoadingKeys] = useState(true)
  const [creating, setCreating] = useState(false)
  const [newKeyName, setNewKeyName] = useState('')
  const [justCreatedKey, setJustCreatedKey] = useState(null)

  useEffect(() => { document.title = 'API Access \u2014 Vaultline' }, [])

  const loadKeys = useCallback(async () => {
    if (!org?.id) return
    const { data } = await supabase.from('api_keys').select('*').eq('org_id', org.id).order('created_at', { ascending: false })
    setKeys(data || [])
    setLoadingKeys(false)
  }, [org?.id])

  useEffect(() => { loadKeys() }, [loadKeys])

  async function createKey() {
    if (!newKeyName.trim()) { toast.error('Enter a key name'); return }
    setCreating(true)
    const fullKey = generateKey('vl_live')
    const keyPrefix = fullKey.slice(0, 12)
    const keySuffix = fullKey.slice(-4)
    const { error } = await supabase.from('api_keys').insert({
      org_id: org.id,
      name: newKeyName.trim(),
      key_prefix: keyPrefix,
      key_suffix: keySuffix,
      key_hash: btoa(fullKey),
      scopes: ['read:accounts', 'read:transactions', 'read:forecast'],
      created_by: profile?.id,
    })
    if (error) {
      toast.error('Failed to create key — table may not exist yet')
    } else {
      setJustCreatedKey(fullKey)
      toast.success('API key created — copy it now, it won\'t be shown again')
      setNewKeyName('')
      loadKeys()
    }
    setCreating(false)
  }

  async function revokeKey(keyId) {
    if (!confirm('Revoke this API key? This cannot be undone.')) return
    await supabase.from('api_keys').update({ revoked_at: new Date().toISOString() }).eq('id', keyId)
    toast.success('Key revoked')
    loadKeys()
  }

  // Fallback: if api_keys table doesn't exist, show legacy deterministic key
  const apiKey = `vl_live_${org?.id?.replace(/-/g, '').slice(0, 24) || 'xxxxxxxxxxxxxxxxxxxx'}`
  const sandboxKey = `vl_test_${org?.id?.replace(/-/g, '').slice(0, 24) || 'xxxxxxxxxxxxxxxxxxxx'}`

  function copyKey(key, label) {
    navigator.clipboard.writeText(key)
    setCopied(label)
    setTimeout(() => setCopied(null), 2000)
  }

  const endpoints = [
    { method: 'GET', path: '/v1/accounts', desc: 'List all connected bank accounts' },
    { method: 'GET', path: '/v1/transactions', desc: 'Query transactions with filters' },
    { method: 'GET', path: '/v1/cash-position', desc: 'Current cash position summary' },
    { method: 'GET', path: '/v1/forecast', desc: 'Cash flow forecast & runway' },
    { method: 'GET', path: '/v1/balances/daily', desc: 'Historical daily balances' },
    { method: 'POST', path: '/v1/transactions', desc: 'Create a manual transaction' },
    { method: 'POST', path: '/v1/webhooks', desc: 'Register a webhook endpoint' },
    { method: 'DELETE', path: '/v1/webhooks/:id', desc: 'Remove a webhook' },
    { method: 'GET', path: '/v1/entities', desc: 'List entities (subsidiaries)' },
    { method: 'GET', path: '/v1/fx/rates', desc: 'Current FX rates for watchlist' },
    { method: 'GET', path: '/v1/audit', desc: 'Audit log entries' },
  ]

  const methodColors = { GET: 'bg-green/[0.08] text-green border-green/[0.1]', POST: 'bg-cyan/[0.08] text-cyan border-cyan/[0.1]', PUT: 'bg-amber/[0.08] text-amber border-amber/[0.1]', DELETE: 'bg-red/[0.08] text-red border-red/[0.1]' }

  const TABS = [
    { id: 'keys', label: 'API Keys', icon: Key },
    { id: 'reference', label: 'Reference', icon: BookOpen },
    { id: 'quickstart', label: 'Quick Start', icon: Terminal },
  ]

  return (
    <div className="max-w-[920px] mx-auto space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-3">
          <span className="terminal-label">API ACCESS</span>
          <span className="text-[12px] font-mono text-t3">REST / JSON / Bearer Auth</span>
        </div>
        <div className="flex items-center gap-2">
          <span className="text-[11px] font-mono text-t3 bg-deep px-2.5 py-1 rounded border border-border">v1</span>
          <Link to="/docs"
            className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg border border-border text-[12px] font-mono text-t3 hover:text-cyan hover:border-cyan/[0.15] transition-all">
            <BookOpen size={12} /> Full Docs
          </Link>
        </div>
      </div>

      {/* Usage KPIs */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-3">
        {[
          { icon: Zap, label: 'TODAY', value: '0', color: 'cyan' },
          { icon: BarChart3, label: 'THIS MONTH', value: '0', color: 'purple' },
          { icon: Clock, label: 'AVG LATENCY', value: '\u2014', color: 'green' },
          { icon: Shield, label: 'RATE LIMIT', value: '1K/min', color: 'amber' },
        ].map(s => {
          const cm = { cyan: 'bg-cyan/[0.08] text-cyan', purple: 'bg-purple/[0.08] text-purple', green: 'bg-green/[0.08] text-green', amber: 'bg-amber/[0.08] text-amber' }
          return (
            <div key={s.label} className="glass-card rounded-xl p-4 terminal-scanlines relative">
              <div className="relative z-[2]">
                <div className="flex items-center justify-between mb-2">
                  <div className={`w-7 h-7 rounded-lg flex items-center justify-center ${cm[s.color]}`}><s.icon size={13} /></div>
                  <span className="text-[9px] font-mono text-t3 uppercase tracking-wider">{s.label}</span>
                </div>
                <p className="font-mono text-[20px] font-black text-t1 terminal-data">{s.value}</p>
              </div>
            </div>
          )
        })}
      </div>

      {/* Tabs */}
      <div className="glass-card rounded-2xl overflow-hidden terminal-scanlines relative">
        <div className="relative z-[2]">
          <div className="flex items-center gap-0 border-b border-border">
            {TABS.map(t => (
              <button key={t.id} onClick={() => setActiveTab(t.id)}
                className={`relative flex items-center gap-2 px-5 py-3.5 text-[13px] font-mono font-medium transition-colors flex-1 justify-center ${activeTab === t.id ? 'text-cyan' : 'text-t3 hover:text-t2'}`}>
                <t.icon size={14} /> {t.label}
                {activeTab === t.id && <div className="absolute bottom-0 left-4 right-4 h-[2px] bg-cyan rounded-t glow-xs" />}
              </button>
            ))}
          </div>

          <div className="p-6">
            {/* KEYS TAB */}
            {activeTab === 'keys' && (
              <div className="space-y-4">
                {/* Base URL */}
                <div className="terminal-inset p-4 flex items-center justify-between">
                  <div className="flex items-center gap-2">
                    <Globe size={13} className="text-cyan" />
                    <span className="text-[12px] font-mono text-t3">BASE URL</span>
                  </div>
                  <div className="flex items-center gap-2">
                    <code className="font-mono text-[14px] text-cyan font-semibold terminal-data">https://api.vaultline.app</code>
                    <button onClick={() => copyKey('https://api.vaultline.app', 'url')} className="p-1.5 rounded-lg border border-border hover:border-cyan/[0.15] text-t3 hover:text-cyan transition">
                      {copied === 'url' ? <Check size={12} className="text-green" /> : <Copy size={12} />}
                    </button>
                  </div>
                </div>

                {/* Production key */}
                <div className="terminal-inset p-4">
                  <div className="flex items-center justify-between mb-3">
                    <div className="flex items-center gap-2">
                      <span className="w-2 h-2 rounded-full bg-green" />
                      <span className="text-[13px] font-mono font-semibold text-t1">PRODUCTION KEY</span>
                    </div>
                    <span className="text-[11px] font-mono text-t3">Created {new Date().toLocaleDateString('en-US', { month: 'short', year: 'numeric' })}</span>
                  </div>
                  <div className="flex items-center gap-2">
                    <code className="flex-1 bg-deep px-3.5 py-2.5 rounded-lg font-mono text-[13px] text-t2 terminal-data select-all border border-border">
                      {showKey ? apiKey : apiKey.slice(0, 12) + '\u2022'.repeat(20)}
                    </code>
                    <button onClick={() => setShowKey(!showKey)} className="p-2.5 rounded-lg border border-border hover:border-border-hover text-t3 hover:text-t1 transition">
                      {showKey ? <EyeOff size={14} /> : <Eye size={14} />}
                    </button>
                    <button onClick={() => copyKey(apiKey, 'live')} className="p-2.5 rounded-lg border border-border hover:border-cyan/[0.15] text-t3 hover:text-cyan transition">
                      {copied === 'live' ? <Check size={14} className="text-green" /> : <Copy size={14} />}
                    </button>
                  </div>
                </div>

                {/* Sandbox key */}
                <div className="terminal-inset p-4">
                  <div className="flex items-center justify-between mb-3">
                    <div className="flex items-center gap-2">
                      <span className="w-2 h-2 rounded-full bg-amber" />
                      <span className="text-[13px] font-mono font-semibold text-t1">SANDBOX KEY</span>
                    </div>
                    <span className="text-[11px] font-mono font-bold text-amber bg-amber/[0.06] border border-amber/[0.1] px-2 py-0.5 rounded">TEST MODE</span>
                  </div>
                  <div className="flex items-center gap-2">
                    <code className="flex-1 bg-deep px-3.5 py-2.5 rounded-lg font-mono text-[13px] text-t2 terminal-data select-all border border-border">{sandboxKey}</code>
                    <button onClick={() => copyKey(sandboxKey, 'sandbox')} className="p-2.5 rounded-lg border border-border hover:border-cyan/[0.15] text-t3 hover:text-cyan transition">
                      {copied === 'sandbox' ? <Check size={14} className="text-green" /> : <Copy size={14} />}
                    </button>
                  </div>
                </div>

                {/* Key management */}
                <div className="flex items-center gap-3">
                  <button onClick={() => { toast.info('Key rotation coming soon'); }}
                    className="flex items-center gap-1.5 px-3.5 py-2 rounded-lg text-[12px] font-mono font-semibold transition-all border border-border text-t3 hover:text-amber hover:border-amber/[0.15]">
                    <RotateCw size={12} /> ROTATE KEY
                  </button>
                  <Link to="/docs" className="flex items-center gap-1.5 px-3.5 py-2 rounded-lg border border-border text-[12px] font-mono text-t3 hover:text-cyan hover:border-cyan/[0.15] transition-all">
                    <BookOpen size={12} /> VIEW FULL DOCS
                  </Link>
                </div>

                {/* Security notice */}
                <div className="flex items-start gap-3 p-4 rounded-xl border border-amber/[0.1] bg-amber/[0.02]">
                  <Lock size={14} className="text-amber shrink-0 mt-0.5" />
                  <div>
                    <p className="text-[13px] font-semibold">Keep keys secure</p>
                    <p className="text-[12px] text-t3">Never expose production keys in client-side code. Use server-to-server calls only. Rotate keys immediately if compromised.</p>
                  </div>
                </div>
              </div>
            )}

            {/* REFERENCE TAB */}
            {activeTab === 'reference' && (
              <div className="space-y-4">
                <div className="rounded-xl border border-border overflow-hidden">
                  <div className="divide-y divide-border/20">
                    {endpoints.map(ep => (
                      <div key={ep.method + ep.path} className="flex items-center px-5 py-3.5 hover:bg-deep active:bg-deep transition group">
                        <span className={`px-2 py-0.5 rounded-md text-[11px] font-mono font-bold mr-4 w-14 text-center border ${methodColors[ep.method]}`}>
                          {ep.method}
                        </span>
                        <code className="font-mono text-[13px] text-cyan font-semibold mr-4 min-w-[200px] terminal-data">{ep.path}</code>
                        <span className="text-[13px] text-t2 flex-1">{ep.desc}</span>
                        <Copy size={12} className="text-t3 opacity-0 group-hover:opacity-100 cursor-pointer hover:text-cyan transition" onClick={() => copyKey(ep.path, ep.path)} />
                      </div>
                    ))}
                  </div>
                </div>
                <div className="flex items-center gap-4 text-[12px] font-mono text-t3">
                  <span>Auth: <span className="text-cyan">Bearer token</span></span>
                  <span>Format: <span className="text-t2">JSON</span></span>
                  <span>Rate: <span className="text-amber">1,000 req/min</span></span>
                  <span>Pagination: <span className="text-t2">cursor-based</span></span>
                </div>
              </div>
            )}

            {/* QUICKSTART TAB */}
            {activeTab === 'quickstart' && (
              <div className="space-y-5">
                <div>
                  <span className="terminal-label mb-3">CURL</span>
                  <div className="terminal-inset p-5 mt-2 overflow-x-auto">
                    <pre className="text-[13px] font-mono leading-[1.8]">
                      <span className="text-purple">curl</span>{' '}<span className="text-cyan">https://api.vaultline.app/v1/cash-position</span>{'\n'}
                      {'  '}<span className="text-amber">-H</span> <span className="text-green">"Authorization: Bearer vl_live_..."</span>{'\n'}
                      {'  '}<span className="text-amber">-H</span> <span className="text-green">"Content-Type: application/json"</span>
                    </pre>
                  </div>
                </div>
                <div>
                  <span className="terminal-label mb-3">NODE.JS</span>
                  <div className="terminal-inset p-5 mt-2 overflow-x-auto">
                    <pre className="text-[13px] font-mono leading-[1.8]">
                      <span className="text-purple">const</span> res = <span className="text-purple">await</span> <span className="text-cyan">fetch</span>(<span className="text-green">'https://api.vaultline.app/v1/cash-position'</span>, {'{\n'}
                      {'  '}headers: {'{ '}<span className="text-green">'Authorization'</span>: <span className="text-green">`Bearer ${'${'}API_KEY{'}'}`</span>{' }\n'}
                      {'}'}){';\n'}
                      <span className="text-purple">const</span> data = <span className="text-purple">await</span> res.<span className="text-cyan">json</span>();
                    </pre>
                  </div>
                </div>
                <div>
                  <span className="terminal-label mb-3">PYTHON</span>
                  <div className="terminal-inset p-5 mt-2 overflow-x-auto">
                    <pre className="text-[13px] font-mono leading-[1.8]">
                      <span className="text-purple">import</span> requests{'\n\n'}
                      resp = requests.<span className="text-cyan">get</span>({'\n'}
                      {'  '}<span className="text-green">"https://api.vaultline.app/v1/cash-position"</span>,{'\n'}
                      {'  '}headers={'{'}<span className="text-green">"Authorization"</span>: <span className="text-green">f"Bearer {'${'}API_KEY{'}'}"</span>{'}'}{'\n'}
                      ){'\n'}
                      data = resp.<span className="text-cyan">json</span>()
                    </pre>
                  </div>
                </div>
              </div>
            )}
          </div>

          <div className="terminal-status flex items-center justify-between px-6 py-1.5">
            <div className="flex items-center gap-3 text-t3">
              <span className="terminal-live">ONLINE</span>
              <span>VERSION: <span className="text-cyan">v1</span></span>
            </div>
            <span className="text-t3">STATUS: <span className="text-green">OPERATIONAL</span></span>
          </div>
        </div>
      </div>
      {/* Toast */}
      {toast && (
        <div className="fixed bottom-6 right-6 z-50 glass-card rounded-xl px-5 py-3 shadow-[0_8px_32px_rgba(0,0,0,0.3)] border-cyan/[0.15] animate-[slideUp_0.3s_ease-out]">
          <p className="text-[13px] text-cyan font-mono">{toast}</p>
        </div>
      )}
    </div>
  )
}
