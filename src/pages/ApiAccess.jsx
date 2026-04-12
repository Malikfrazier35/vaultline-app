import { useState, useEffect, useCallback } from 'react'
import { useAuth } from '@/hooks/useAuth'
import { supabase } from '@/lib/supabase'
import { useToast } from '@/components/Toast'
import { Key, Copy, Eye, EyeOff, Check, Shield, Clock, BarChart3, Code, Zap, BookOpen, RefreshCw, Terminal, AlertTriangle, Globe, Lock, RotateCw, Trash2, Plus } from 'lucide-react'
import { Link } from 'react-router-dom'

const API_BASE = `${import.meta.env.VITE_SUPABASE_URL}/functions/v1/api`

function generateKey(prefix = 'vl_live') {
  const chars = 'ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789'
  let key = prefix + '_'
  for (let i = 0; i < 32; i++) key += chars.charAt(Math.floor(Math.random() * chars.length))
  return key
}

async function sha256(input) {
  const data = new TextEncoder().encode(input)
  const hash = await crypto.subtle.digest('SHA-256', data)
  return Array.from(new Uint8Array(hash)).map(b => b.toString(16).padStart(2, '0')).join('')
}

export default function ApiAccess() {
  const { org, profile } = useAuth()
  const toast = useToast()
  const [copied, setCopied] = useState(null)
  const [activeTab, setActiveTab] = useState('keys')
  const [keys, setKeys] = useState([])
  const [loadingKeys, setLoadingKeys] = useState(true)
  const [creating, setCreating] = useState(false)
  const [newKeyName, setNewKeyName] = useState('')
  const [justCreatedKey, setJustCreatedKey] = useState(null)
  const [usage, setUsage] = useState({ today: 0, month: 0, avgLatency: null })

  useEffect(() => { document.title = 'API Access \u2014 Vaultline' }, [])

  const loadKeys = useCallback(async () => {
    if (!org?.id) return
    const { data } = await supabase.from('api_keys').select('*').eq('org_id', org.id).order('created_at', { ascending: false })
    setKeys(data || [])
    setLoadingKeys(false)
  }, [org?.id])

  const loadUsage = useCallback(async () => {
    if (!org?.id) return
    const todayStart = new Date(); todayStart.setHours(0, 0, 0, 0)
    const monthStart = new Date(); monthStart.setDate(1); monthStart.setHours(0, 0, 0, 0)
    const [todayRes, monthRes, latencyRes] = await Promise.all([
      supabase.from('api_usage').select('id', { count: 'exact', head: true }).eq('org_id', org.id).gte('created_at', todayStart.toISOString()),
      supabase.from('api_usage').select('id', { count: 'exact', head: true }).eq('org_id', org.id).gte('created_at', monthStart.toISOString()),
      supabase.from('api_usage').select('latency_ms').eq('org_id', org.id).gte('created_at', todayStart.toISOString()).limit(100),
    ])
    const latencies = (latencyRes.data || []).map(r => r.latency_ms).filter(Boolean)
    const avg = latencies.length > 0 ? Math.round(latencies.reduce((a, b) => a + b, 0) / latencies.length) : null
    setUsage({ today: todayRes.count || 0, month: monthRes.count || 0, avgLatency: avg })
  }, [org?.id])

  useEffect(() => { loadKeys(); loadUsage() }, [loadKeys, loadUsage])

  async function createKey() {
    if (!newKeyName.trim()) { toast.error('Enter a key name'); return }
    setCreating(true)
    try {
      const fullKey = generateKey('vl_live')
      const keyHash = await sha256(fullKey)
      const { error } = await supabase.from('api_keys').insert({
        org_id: org.id, name: newKeyName.trim(),
        key_prefix: fullKey.slice(0, 12), key_suffix: fullKey.slice(-4),
        key_hash: keyHash, scopes: ['read:accounts', 'read:transactions', 'read:forecast'],
        environment: 'production', created_by: profile?.id,
      })
      if (error) { toast.error('Failed to create key'); console.error(error) }
      else { setJustCreatedKey(fullKey); toast.success("API key created \u2014 copy it now, it won't be shown again"); setNewKeyName(''); loadKeys() }
    } catch (e) { toast.error('Key creation failed') }
    setCreating(false)
  }

  async function revokeKey(keyId) {
    if (!confirm('Revoke this API key? This cannot be undone.')) return
    await supabase.from('api_keys').update({ revoked_at: new Date().toISOString() }).eq('id', keyId)
    toast.success('Key revoked'); setJustCreatedKey(null); loadKeys()
  }

  function copyKey(key, label) { navigator.clipboard.writeText(key); setCopied(label); setTimeout(() => setCopied(null), 2000) }

  const activeKeys = keys.filter(k => !k.revoked_at)
  const revokedKeys = keys.filter(k => k.revoked_at)

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

  const methodColors = { GET: 'bg-green/[0.08] text-green border-green/[0.1]', POST: 'bg-cyan/[0.08] text-cyan border-cyan/[0.1]', DELETE: 'bg-red/[0.08] text-red border-red/[0.1]' }

  const TABS = [{ id: 'keys', label: 'API Keys', icon: Key }, { id: 'reference', label: 'Reference', icon: BookOpen }, { id: 'quickstart', label: 'Quick Start', icon: Terminal }]

  return (
    <div className="max-w-[920px] mx-auto space-y-6">
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-3">
          <span className="terminal-label">API ACCESS</span>
          <span className="text-[12px] font-mono text-t3">REST / JSON / Bearer Auth</span>
        </div>
        <div className="flex items-center gap-2">
          <span className="text-[11px] font-mono text-t3 bg-deep px-2.5 py-1 rounded border border-border">v1</span>
          <Link to="/docs" className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg border border-border text-[12px] font-mono text-t3 hover:text-cyan hover:border-cyan/[0.15] transition-all"><BookOpen size={12} /> Full Docs</Link>
        </div>
      </div>

      <div className="grid grid-cols-2 lg:grid-cols-4 gap-3">
        {[
          { icon: Zap, label: 'TODAY', value: usage.today.toLocaleString(), color: 'cyan' },
          { icon: BarChart3, label: 'THIS MONTH', value: usage.month.toLocaleString(), color: 'purple' },
          { icon: Clock, label: 'AVG LATENCY', value: usage.avgLatency ? `${usage.avgLatency}ms` : '\u2014', color: 'green' },
          { icon: Shield, label: 'ACTIVE KEYS', value: String(activeKeys.length), color: 'amber' },
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

      <div className="glass-card rounded-2xl overflow-hidden terminal-scanlines relative">
        <div className="relative z-[2]">
          <div className="flex items-center gap-0 border-b border-border">
            {TABS.map(t => (
              <button key={t.id} onClick={() => setActiveTab(t.id)} className={`relative flex items-center gap-2 px-5 py-3.5 text-[13px] font-mono font-medium transition-colors flex-1 justify-center ${activeTab === t.id ? 'text-cyan' : 'text-t3 hover:text-t2'}`}>
                <t.icon size={14} /> {t.label}
                {activeTab === t.id && <div className="absolute bottom-0 left-4 right-4 h-[2px] bg-cyan rounded-t glow-xs" />}
              </button>
            ))}
          </div>

          <div className="p-6">
            {activeTab === 'keys' && (
              <div className="space-y-4">
                <div className="terminal-inset p-4 flex items-center justify-between">
                  <div className="flex items-center gap-2"><Globe size={13} className="text-cyan" /><span className="text-[12px] font-mono text-t3">BASE URL</span></div>
                  <div className="flex items-center gap-2">
                    <code className="font-mono text-[12px] text-cyan font-semibold terminal-data">{API_BASE}</code>
                    <button onClick={() => copyKey(API_BASE, 'url')} className="p-1.5 rounded-lg border border-border hover:border-cyan/[0.15] text-t3 hover:text-cyan transition">
                      {copied === 'url' ? <Check size={12} className="text-green" /> : <Copy size={12} />}
                    </button>
                  </div>
                </div>

                {justCreatedKey && (
                  <div className="terminal-inset p-4 border-green/[0.2] bg-green/[0.02]">
                    <div className="flex items-center gap-2 mb-2"><AlertTriangle size={14} className="text-amber" /><span className="text-[13px] font-mono font-semibold text-amber">Copy your key now — it won't be shown again</span></div>
                    <div className="flex items-center gap-2">
                      <code className="flex-1 bg-deep px-3.5 py-2.5 rounded-lg font-mono text-[13px] text-green terminal-data select-all border border-border">{justCreatedKey}</code>
                      <button onClick={() => copyKey(justCreatedKey, 'new')} className="p-2.5 rounded-lg border border-border hover:border-green/[0.15] text-t3 hover:text-green transition">
                        {copied === 'new' ? <Check size={14} className="text-green" /> : <Copy size={14} />}
                      </button>
                    </div>
                  </div>
                )}

                <div className="terminal-inset p-4">
                  <span className="text-[11px] font-mono text-t3 uppercase tracking-wider block mb-3">CREATE NEW KEY</span>
                  <div className="flex items-center gap-2">
                    <input value={newKeyName} onChange={e => setNewKeyName(e.target.value)} placeholder="Key name (e.g. Production Backend)"
                      className="flex-1 bg-deep px-3.5 py-2.5 rounded-lg font-mono text-[13px] text-t1 border border-border outline-none placeholder:text-t3 focus:border-cyan/[0.3]"
                      onKeyDown={e => e.key === 'Enter' && createKey()} />
                    <button onClick={createKey} disabled={creating}
                      className="flex items-center gap-1.5 px-4 py-2.5 rounded-lg bg-gradient-to-r from-cyan/90 to-cyan/70 text-void text-[12px] font-mono font-semibold hover:-translate-y-px active:scale-[0.98] transition-all disabled:opacity-50">
                      {creating ? 'Creating...' : <><Plus size={12} /> Generate</>}
                    </button>
                  </div>
                </div>

                {activeKeys.length > 0 && (
                  <div className="space-y-2">
                    <span className="text-[11px] font-mono text-t3 uppercase tracking-wider">ACTIVE KEYS</span>
                    {activeKeys.map(k => (
                      <div key={k.id} className="terminal-inset p-4 flex items-center justify-between">
                        <div className="flex items-center gap-3">
                          <span className="w-2 h-2 rounded-full bg-green" />
                          <div>
                            <span className="text-[13px] font-mono font-semibold text-t1">{k.name}</span>
                            <div className="flex items-center gap-2 text-[10px] font-mono text-t3 mt-0.5">
                              <span>{k.key_prefix}...{k.key_suffix}</span>
                              <span>·</span><span>{k.environment}</span>
                              <span>·</span><span>Created {new Date(k.created_at).toLocaleDateString()}</span>
                              {k.last_used_at && <><span>·</span><span>Last used {new Date(k.last_used_at).toLocaleDateString()}</span></>}
                            </div>
                          </div>
                        </div>
                        <button onClick={() => revokeKey(k.id)} className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-[11px] font-mono text-red/70 border border-red/[0.1] hover:border-red/[0.3] hover:text-red transition"><Trash2 size={11} /> Revoke</button>
                      </div>
                    ))}
                  </div>
                )}

                {revokedKeys.length > 0 && (
                  <div className="space-y-2">
                    <span className="text-[11px] font-mono text-t3 uppercase tracking-wider">REVOKED</span>
                    {revokedKeys.map(k => (
                      <div key={k.id} className="terminal-inset p-3 opacity-50 flex items-center gap-3">
                        <span className="w-2 h-2 rounded-full bg-red" />
                        <span className="text-[12px] font-mono text-t3 line-through">{k.name}</span>
                        <span className="text-[10px] font-mono text-t4">{k.key_prefix}...{k.key_suffix}</span>
                        <span className="text-[10px] font-mono text-red">Revoked {new Date(k.revoked_at).toLocaleDateString()}</span>
                      </div>
                    ))}
                  </div>
                )}

                <div className="flex items-start gap-3 p-4 rounded-xl border border-amber/[0.1] bg-amber/[0.02]">
                  <Lock size={14} className="text-amber shrink-0 mt-0.5" />
                  <div>
                    <p className="text-[13px] font-semibold">Keep keys secure</p>
                    <p className="text-[12px] text-t3">Never expose production keys in client-side code. Use server-to-server calls only. Revoke immediately if compromised. Keys are SHA-256 hashed — we never store the plaintext.</p>
                  </div>
                </div>
              </div>
            )}

            {activeTab === 'reference' && (
              <div className="space-y-4">
                <div className="rounded-xl border border-border overflow-hidden">
                  <div className="divide-y divide-border/20">
                    {endpoints.map(ep => (
                      <div key={ep.method + ep.path} className="flex items-center px-5 py-3.5 hover:bg-deep active:bg-deep transition group">
                        <span className={`px-2 py-0.5 rounded-md text-[11px] font-mono font-bold mr-4 w-14 text-center border ${methodColors[ep.method] || ''}`}>{ep.method}</span>
                        <code className="font-mono text-[13px] text-cyan font-semibold mr-4 min-w-[200px] terminal-data">{ep.path}</code>
                        <span className="text-[13px] text-t2 flex-1">{ep.desc}</span>
                        <Copy size={12} className="text-t3 opacity-0 group-hover:opacity-100 cursor-pointer hover:text-cyan transition" onClick={() => copyKey(`${API_BASE}${ep.path}`, ep.path)} />
                      </div>
                    ))}
                  </div>
                </div>
                <div className="flex items-center gap-4 text-[12px] font-mono text-t3">
                  <span>Auth: <span className="text-cyan">Bearer token</span></span>
                  <span>Format: <span className="text-t2">JSON</span></span>
                  <span>Rate: <span className="text-amber">1,000 req/min</span></span>
                  <span>Pagination: <span className="text-t2">offset-based</span></span>
                </div>
              </div>
            )}

            {activeTab === 'quickstart' && (
              <div className="space-y-5">
                <div>
                  <span className="terminal-label mb-3">CURL</span>
                  <div className="terminal-inset p-5 mt-2 overflow-x-auto">
                    <pre className="text-[13px] font-mono leading-[1.8]">
                      <span className="text-purple">curl</span>{' '}<span className="text-cyan">{API_BASE}/v1/cash-position</span>{'\n'}
                      {'  '}<span className="text-amber">-H</span> <span className="text-green">"Authorization: Bearer vl_live_..."</span>{'\n'}
                      {'  '}<span className="text-amber">-H</span> <span className="text-green">"Content-Type: application/json"</span>
                    </pre>
                  </div>
                </div>
                <div>
                  <span className="terminal-label mb-3">NODE.JS</span>
                  <div className="terminal-inset p-5 mt-2 overflow-x-auto">
                    <pre className="text-[13px] font-mono leading-[1.8]">
                      <span className="text-purple">const</span> res = <span className="text-purple">await</span> <span className="text-cyan">fetch</span>(<span className="text-green">'{API_BASE}/v1/cash-position'</span>, {'{\n'}
                      {'  '}headers: {'{ '}<span className="text-green">'Authorization'</span>: <span className="text-green">{"`Bearer ${API_KEY}`"}</span>{' }\n'}
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
                      {'  '}<span className="text-green">"{API_BASE}/v1/cash-position"</span>,{'\n'}
                      {'  '}headers={'{'}<span className="text-green">"Authorization"</span>: <span className="text-green">f"Bearer {'{'}API_KEY{'}'}"</span>{'}'}{'\n'}
                      ){'\n'}
                      data = resp.<span className="text-cyan">json</span>()
                    </pre>
                  </div>
                </div>
                <div>
                  <span className="terminal-label mb-3">EXAMPLE RESPONSE</span>
                  <div className="terminal-inset p-5 mt-2 overflow-x-auto">
                    <pre className="text-[13px] font-mono leading-[1.8] text-t2">{`{
  "total_balance": 1284500.00,
  "total_available": 1180320.00,
  "account_count": 4,
  "currency": "USD",
  "by_type": { "checking": 842300, "savings": 442200 },
  "as_of": "2026-04-12T15:30:00Z",
  "_meta": { "latency_ms": 45, "api_version": "v1" }
}`}</pre>
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
            <span className="text-t3">GATEWAY: <span className="text-green">OPERATIONAL</span></span>
          </div>
        </div>
      </div>
    </div>
  )
}
