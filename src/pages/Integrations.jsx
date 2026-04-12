import { useState, useEffect, useCallback } from 'react'
import { useAuth } from '@/hooks/useAuth'
import { useTreasury } from '@/hooks/useTreasury'
import { supabase } from '@/lib/supabase'
import { safeInvoke } from '@/lib/safeInvoke'
import { useToast } from '@/components/Toast'
import { Link } from 'react-router-dom'
import {
  Plug, Check, ExternalLink, ArrowRight, Loader2, CheckCircle2,
  X, AlertTriangle, RefreshCw, Search
} from 'lucide-react'

const STATUS_STYLE = {
  live: { bg: 'bg-green/[0.08]', text: 'text-green', dot: 'bg-green', label: 'Live' },
  connected: { bg: 'bg-green/[0.08]', text: 'text-green', dot: 'bg-green', label: 'Connected' },
  available: { bg: 'bg-cyan/[0.08]', text: 'text-cyan', dot: 'bg-cyan', label: 'Available' },
  coming_soon: { bg: 'bg-purple/[0.06]', text: 'text-purple', dot: 'bg-purple', label: 'Coming soon' },
  error: { bg: 'bg-red/[0.06]', text: 'text-red', dot: 'bg-red', label: 'Error' },
  disconnected: { bg: 'bg-amber/[0.06]', text: 'text-amber', dot: 'bg-amber', label: 'Disconnected' },
}

const CATEGORY_LABELS = {
  banking: 'Banking', accounting: 'Accounting', erp: 'ERP systems', payroll: 'Payroll',
  payments: 'Payments', corporate_cards: 'Corporate cards', communication: 'Communication',
  file_import: 'File import',
}

export default function Integrations() {
  const { org } = useAuth()
  const { bankConnections } = useTreasury()
  const toast = useToast()
  const [registry, setRegistry] = useState([])
  const [connections, setConnections] = useState([])
  const [loading, setLoading] = useState(true)
  const [expandedId, setExpandedId] = useState(null)
  const [connecting, setConnecting] = useState(null)
  const [search, setSearch] = useState('')
  const [filterCat, setFilterCat] = useState('')
  const [slackUrl, setSlackUrl] = useState('')
  const [slackChannel, setSlackChannel] = useState('')

  useEffect(() => { document.title = 'Integrations \u2014 Vaultline' }, [])

  const load = useCallback(async () => {
    setLoading(true)
    const [regRes, connRes, notifRes] = await Promise.all([
      supabase.from('connector_registry').select('*').order('sort_order'),
      org?.id ? supabase.from('connections').select('*').eq('org_id', org.id) : { data: [] },
      org?.id ? supabase.from('notification_settings').select('slack_enabled, slack_webhook_url, slack_channel').eq('org_id', org.id).single() : { data: null },
    ])
    setRegistry(regRes.data || [])
    setConnections(connRes.data || [])
    if (notifRes.data) {
      setSlackUrl(notifRes.data.slack_webhook_url || '')
      setSlackChannel(notifRes.data.slack_channel || '')
    }
    setLoading(false)
  }, [org?.id])

  useEffect(() => { load() }, [load])

  // Merge live status from bank_connections for plaid
  function getStatus(connector) {
    if (connector.id === 'plaid') {
      const connected = (bankConnections || []).filter(b => b.status === 'connected').length
      const errors = (bankConnections || []).filter(b => b.status === 'error').length
      if (connected > 0) return errors > 0 ? 'error' : 'connected'
      return connector.status
    }
    if (connector.id === 'slack_int') {
      return slackUrl ? 'connected' : connector.status
    }
    if (connector.id === 'stripe') return 'connected'
    if (connector.id === 'csv' || connector.id === 'manual') return 'live'
    const conn = connections.find(c => c.connector_id === connector.id)
    if (conn) return conn.status
    return connector.status
  }

  function getSubtext(connector) {
    if (connector.id === 'plaid') {
      const c = (bankConnections || []).filter(b => b.status === 'connected').length
      return c > 0 ? `${c} bank${c !== 1 ? 's' : ''} connected` : connector.description
    }
    if (connector.id === 'slack_int' && slackUrl) return `Connected to ${slackChannel || '#channel'}`
    if (connector.id === 'csv') return 'Drag and drop CSV files'
    if (connector.id === 'manual') return 'Enter transactions by hand'
    return connector.description
  }

  async function handleConnect(connector) {
    setConnecting(connector.id)
    if (connector.id === 'quickbooks') {
      const { data, error } = await safeInvoke('qb-auth', { action: 'start', redirect_uri: `${window.location.origin}/integrations` })
      if (data?.auth_url) { window.location.href = data.auth_url }
      else toast.error(data?.error || 'QuickBooks not configured')
    } else if (['xero', 'sage'].includes(connector.id)) {
      const { data } = await safeInvoke('acct-auth', { action: 'start', provider: connector.id, redirect_uri: `${window.location.origin}/integrations` })
      if (data?.auth_url) { window.location.href = data.auth_url }
      else toast.error(data?.error || `${connector.name} not configured`)
    } else {
      toast.info(`${connector.name} integration coming soon`)
    }
    setConnecting(null)
  }

  async function saveSlack() {
    if (!org?.id || !slackUrl.trim()) return
    setConnecting('slack_int')
    await supabase.from('notification_settings').upsert({
      org_id: org.id, slack_enabled: true,
      slack_webhook_url: slackUrl.trim(),
      slack_channel: slackChannel.trim() || '#treasury',
    }, { onConflict: 'org_id' })
    toast.success('Slack connected')
    setConnecting(null)
    load()
  }

  async function disconnectSlack() {
    if (!org?.id) return
    await supabase.from('notification_settings').upsert({
      org_id: org.id, slack_enabled: false, slack_webhook_url: '', slack_channel: '',
    }, { onConflict: 'org_id' })
    setSlackUrl(''); setSlackChannel('')
    toast.info('Slack disconnected')
    load()
  }

  // Group by category
  const categories = [...new Set(registry.map(r => r.category))]
  const filtered = registry.filter(r => {
    if (search && !r.name.toLowerCase().includes(search.toLowerCase()) && !r.description?.toLowerCase().includes(search.toLowerCase())) return false
    if (filterCat && r.category !== filterCat) return false
    return true
  })
  const grouped = categories.map(cat => ({
    category: cat,
    label: CATEGORY_LABELS[cat] || cat,
    items: filtered.filter(r => r.category === cat),
  })).filter(g => g.items.length > 0)

  const connectedCount = registry.filter(r => ['connected', 'live'].includes(getStatus(r))).length
  const availableCount = registry.filter(r => getStatus(r) === 'available').length
  const comingCount = registry.filter(r => getStatus(r) === 'coming_soon').length

  if (loading) return null

  return (
    <div className="max-w-[900px] mx-auto space-y-7">
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-3">
          <div className="w-11 h-11 rounded-xl bg-cyan/[0.1] flex items-center justify-center">
            <Plug size={20} className="text-cyan" />
          </div>
          <div>
            <span className="terminal-label">INTEGRATIONS</span>
            <p className="text-[13px] text-t2">{connectedCount} connected \u00b7 {availableCount} available \u00b7 {comingCount} coming</p>
          </div>
        </div>
      </div>

      {/* KPIs */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
        {[
          { label: 'Connected', value: connectedCount, color: 'green' },
          { label: 'Available', value: availableCount, color: 'cyan' },
          { label: 'Coming soon', value: comingCount, color: 'purple' },
        ].map(s => (
          <div key={s.label} className="glass-card rounded-xl p-4 text-center terminal-scanlines relative">
            <p className={`font-display text-[28px] font-extrabold text-${s.color}`}>{s.value}</p>
            <p className="text-[13px] text-t2 mt-1">{s.label}</p>
          </div>
        ))}
      </div>

      {/* Search + filter */}
      <div className="flex items-center gap-3">
        <div className="flex items-center gap-2 flex-1 glass-input rounded-xl px-3.5 py-2.5">
          <Search size={14} className="text-t3" />
          <input value={search} onChange={e => setSearch(e.target.value)} placeholder="Search connectors..."
            className="bg-transparent text-[13px] text-t1 outline-none flex-1 placeholder:text-t4" />
        </div>
        <select value={filterCat} onChange={e => setFilterCat(e.target.value)}
          className="glass-input rounded-xl px-3 py-2.5 text-[13px] text-t2 outline-none cursor-pointer">
          <option value="">All categories</option>
          {categories.map(c => <option key={c} value={c}>{CATEGORY_LABELS[c] || c}</option>)}
        </select>
      </div>

      {/* Connector grid */}
      {grouped.map(group => (
        <div key={group.category}>
          <span className="terminal-label mb-3 block">{group.label.toUpperCase()}</span>
          <div className="space-y-2.5">
            {group.items.map(connector => {
              const status = getStatus(connector)
              const st = STATUS_STYLE[status] || STATUS_STYLE.available
              const expanded = expandedId === connector.id

              return (
                <div key={connector.id} className="glass-card rounded-2xl overflow-hidden hover:border-border-hover transition-all">
                  <button onClick={() => setExpandedId(expanded ? null : connector.id)}
                    className="w-full flex items-center justify-between p-5 text-left">
                    <div className="flex items-center gap-4">
                      {connector.logo_url ? (
                        <img src={connector.logo_url} alt="" className="w-11 h-11 rounded-xl object-contain" />
                      ) : (
                        <div className="w-11 h-11 rounded-xl bg-cyan/[0.08] flex items-center justify-center text-cyan font-bold text-[14px]">
                          {connector.name.slice(0, 2).toUpperCase()}
                        </div>
                      )}
                      <div>
                        <h4 className="text-[15px] font-bold">{connector.name}</h4>
                        <p className="text-[13px] text-t2 mt-0.5">{getSubtext(connector)}</p>
                      </div>
                    </div>
                    <div className="flex items-center gap-3">
                      {connector.plan_required !== 'starter' && (
                        <span className={`text-[9px] font-mono font-bold px-1.5 py-0.5 rounded ${connector.plan_required === 'enterprise' ? 'text-amber bg-amber/[0.06]' : 'text-purple bg-purple/[0.06]'}`}>
                          {connector.plan_required.toUpperCase()}
                        </span>
                      )}
                      <span className={`inline-flex items-center gap-1.5 px-2.5 py-1 rounded-lg text-[12px] font-semibold ${st.bg} ${st.text}`}>
                        <span className={`w-[5px] h-[5px] rounded-full ${st.dot}`} />{st.label}
                      </span>
                      <ArrowRight size={14} className={`text-t3 transition-transform ${expanded ? 'rotate-90' : ''}`} />
                    </div>
                  </button>

                  {expanded && (
                    <div className="px-5 pb-5 pt-0 border-t border-border">
                      {/* Capabilities */}
                      {connector.sync_capabilities?.length > 0 && (
                        <div className="grid grid-cols-2 gap-2 mt-4">
                          {connector.sync_capabilities.map(cap => (
                            <div key={cap} className="flex items-center gap-2 text-[13px] text-t2">
                              <Check size={13} className={status === 'coming_soon' ? 'text-t3' : 'text-green'} />
                              {cap.replace(/_/g, ' ')}
                            </div>
                          ))}
                        </div>
                      )}

                      {/* Slack config */}
                      {connector.id === 'slack_int' && (
                        <div className="mt-4 pt-4 border-t border-border">
                          {slackUrl && status === 'connected' ? (
                            <div className="flex items-center justify-between">
                              <div className="flex items-center gap-2">
                                <CheckCircle2 size={14} className="text-green" />
                                <span className="text-[13px] text-green font-medium">Connected to {slackChannel || '#channel'}</span>
                              </div>
                              <button onClick={disconnectSlack} className="text-[12px] font-mono text-red hover:underline">Disconnect</button>
                            </div>
                          ) : (
                            <>
                              <p className="text-[13px] text-t2 font-semibold mb-2">Connect Slack</p>
                              <div className="space-y-2">
                                <input value={slackUrl} onChange={e => setSlackUrl(e.target.value)}
                                  placeholder="https://hooks.slack.com/services/..."
                                  className="w-full px-3.5 py-2.5 rounded-xl glass-input text-[13px] text-t1 outline-none placeholder:text-t3" />
                                <div className="flex gap-2">
                                  <input value={slackChannel} onChange={e => setSlackChannel(e.target.value)}
                                    placeholder="#treasury-alerts"
                                    className="flex-1 px-3.5 py-2.5 rounded-xl glass-input text-[13px] text-t1 outline-none placeholder:text-t3" />
                                  <button onClick={saveSlack} disabled={connecting === 'slack_int' || !slackUrl.trim()}
                                    className="px-5 py-2.5 rounded-xl bg-gradient-to-r from-cyan/90 to-cyan/70 text-void text-[13px] font-semibold hover:-translate-y-px active:scale-[0.98] transition-all disabled:opacity-50">
                                    {connecting === 'slack_int' ? <Loader2 size={14} className="animate-spin" /> : 'Connect'}
                                  </button>
                                </div>
                              </div>
                            </>
                          )}
                        </div>
                      )}

                      {/* Link to existing pages */}
                      {connector.id === 'plaid' && (
                        <div className="mt-4 pt-4 border-t border-border">
                          <Link to="/banks" className="flex items-center gap-2 text-[13px] text-cyan font-semibold hover:underline">
                            Manage bank connections <ArrowRight size={12} />
                          </Link>
                        </div>
                      )}
                      {connector.id === 'csv' && (
                        <div className="mt-4 pt-4 border-t border-border">
                          <Link to="/import" className="flex items-center gap-2 text-[13px] text-cyan font-semibold hover:underline">
                            Go to data import <ArrowRight size={12} />
                          </Link>
                        </div>
                      )}
                      {connector.id === 'manual' && (
                        <div className="mt-4 pt-4 border-t border-border">
                          <Link to="/import" className="flex items-center gap-2 text-[13px] text-cyan font-semibold hover:underline">
                            Manual entry <ArrowRight size={12} />
                          </Link>
                        </div>
                      )}

                      {/* OAuth connect button */}
                      {connector.auth_type === 'oauth' && connector.status === 'available' && connector.id !== 'slack_int' && (
                        <div className="mt-4 pt-4 border-t border-border">
                          <button onClick={() => handleConnect(connector)} disabled={connecting === connector.id}
                            className="flex items-center gap-2 px-5 py-2.5 rounded-xl bg-gradient-to-r from-cyan/90 to-cyan/70 text-void text-[13px] font-semibold hover:-translate-y-px active:scale-[0.98] transition-all disabled:opacity-50">
                            {connecting === connector.id ? <Loader2 size={14} className="animate-spin" /> : <ExternalLink size={14} />}
                            Connect {connector.name}
                          </button>
                        </div>
                      )}

                      {/* Coming soon */}
                      {connector.status === 'coming_soon' && (
                        <div className="mt-4 pt-4 border-t border-border">
                          <p className="text-[13px] text-t2">On our roadmap. Contact support@vaultline.app to express interest.</p>
                        </div>
                      )}

                      {/* Connected status */}
                      {status === 'connected' && !['plaid', 'slack_int', 'stripe', 'csv', 'manual'].includes(connector.id) && (
                        <div className="mt-4 pt-4 border-t border-border flex items-center gap-2">
                          <span className="w-2 h-2 rounded-full bg-green animate-pulse" />
                          <span className="text-[13px] text-green font-medium">Connected and syncing</span>
                        </div>
                      )}
                    </div>
                  )}
                </div>
              )
            })}
          </div>
        </div>
      ))}

      <div className="terminal-status flex items-center justify-between px-5 py-2 rounded-lg">
        <div className="flex items-center gap-3 text-t3">
          <span className="terminal-live">REGISTRY</span>
          <span>{registry.length} connectors</span>
        </div>
        <Link to="/settings" className="text-[11px] font-mono text-t3 hover:text-cyan transition">
          Alert thresholds {'\u2192'}
        </Link>
      </div>
    </div>
  )
}
