import { useState, useEffect } from 'react'
import { SkeletonPage } from '@/components/Skeleton'
import { useAuth } from '@/hooks/useAuth'
import { useTreasury } from '@/hooks/useTreasury'
import {
  Plug, MessageSquare, Webhook, Building2, FileSpreadsheet, Link2, Check, ExternalLink,
  Mail, Bell, Globe, Shield, Zap, ArrowRight
} from 'lucide-react'

const INTEGRATIONS = [
  {
    category: 'Communication',
    items: [
      { id: 'slack', name: 'Slack', desc: 'Push treasury alerts & daily summaries to Slack channels', icon: MessageSquare, color: '#E01E5A',
        status: 'available', features: ['Low balance alerts', 'Large transaction notifications', 'Daily cash position summary', 'Forecast deviation warnings'] },
      { id: 'email', name: 'Email Alerts', desc: 'Automated email notifications for treasury events', icon: Mail, color: '#22D3EE',
        status: 'active', features: ['All alert types', 'Weekly treasury digest', 'Custom recipient lists', 'HTML-formatted reports'] },
      { id: 'webhooks', name: 'Webhooks', desc: 'Send real-time events to your own endpoints', icon: Webhook, color: '#818CF8',
        status: 'available', features: ['Transaction events', 'Balance changes', 'Forecast updates', 'Custom headers & auth'] },
    ]
  },
  {
    category: 'Accounting & ERP',
    items: [
      { id: 'quickbooks', name: 'QuickBooks Online', desc: 'Sync accounts, invoices, bills, and payments', icon: FileSpreadsheet, color: '#2CA01C',
        status: 'connected', features: ['Account sync', 'Invoice tracking', 'Bill payments', 'Purchase orders'] },
      { id: 'xero', name: 'Xero', desc: 'Two-way sync with Xero accounting data', icon: FileSpreadsheet, color: '#13B5EA',
        status: 'connected', features: ['Bank feeds', 'Invoice reconciliation', 'Contact sync', 'Journal entries'] },
      { id: 'sage', name: 'Sage Intacct', desc: 'Enterprise accounting integration', icon: FileSpreadsheet, color: '#00DC82',
        status: 'available', features: ['GL sync', 'AP/AR management', 'Multi-entity consolidation', 'Custom dimensions'] },
      { id: 'netsuite', name: 'NetSuite', desc: 'Oracle NetSuite ERP integration', icon: Building2, color: '#1B3D6F',
        status: 'coming_soon', features: ['Real-time GL data', 'Subsidiary management', 'Custom record types', 'SuiteQL queries'] },
    ]
  },
  {
    category: 'Banking & Payments',
    items: [
      { id: 'plaid', name: 'Plaid', desc: 'Connect bank accounts for real-time transaction data', icon: Link2, color: '#0A85EA',
        status: 'connected', features: ['Real-time balances', 'Transaction history', 'Account verification', 'Investment accounts'] },
      { id: 'stripe_int', name: 'Stripe', desc: 'Sync payment data and revenue metrics', icon: Zap, color: '#635BFF',
        status: 'active', features: ['Payment intents', 'Subscription revenue', 'Refund tracking', 'Payout reconciliation'] },
    ]
  },
  {
    category: 'Security & Compliance',
    items: [
      { id: 'sso_saml', name: 'SSO / SAML', desc: 'Single sign-on via your identity provider', icon: Shield, color: '#F59E0B',
        status: 'coming_soon', features: ['Okta', 'Azure AD', 'OneLogin', 'Google Workspace'] },
      { id: 'apple_auth', name: 'Apple Sign-In', desc: 'Authenticate with Apple ID', icon: Globe, color: '#000000',
        status: 'active', features: ['OAuth 2.0', 'Private email relay', 'Cross-platform'] },
    ]
  },
]

const STATUS_STYLE = {
  connected: { bg: 'bg-green/[0.08]', text: 'text-green', label: 'Connected', dot: 'bg-green' },
  active: { bg: 'bg-cyan/[0.08]', text: 'text-cyan', label: 'Active', dot: 'bg-cyan' },
  available: { bg: 'bg-amber/[0.06]', text: 'text-amber', label: 'Available', dot: 'bg-amber' },
  coming_soon: { bg: 'bg-purple/[0.06]', text: 'text-purple', label: 'Beta', dot: 'bg-purple' },
}

export default function Integrations() {
  const { org } = useAuth()
  const { bankConnections } = useTreasury()
  const [expandedId, setExpandedId] = useState(null)
  const [toast, setToast] = useState(null)
  const [slackUrl, setSlackUrl] = useState('')
  const [webhookUrl, setWebhookUrl] = useState('')

  useEffect(() => { document.title = 'Integrations — Vaultline' }, [])

  const connectedCount = INTEGRATIONS.flatMap(c => c.items).filter(i => i.status === 'connected' || i.status === 'active').length
  const availableCount = INTEGRATIONS.flatMap(c => c.items).filter(i => i.status === 'available').length

  return (
    <div className="max-w-[900px] mx-auto space-y-7">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-3">
          <div className="w-11 h-11 rounded-xl bg-cyan/[0.1] flex items-center justify-center">
            <Plug size={20} className="text-cyan" />
          </div>
          <div>
            <span className="terminal-label">INTEGRATIONS</span>
            <p className="text-[13px] text-t2">{connectedCount} active · {availableCount} available</p>
          </div>
        </div>
      </div>

      {/* Summary */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
        {[
          { label: 'Connected', value: connectedCount, color: 'green' },
          { label: 'Available', value: availableCount, color: 'amber' },
          { label: 'Beta', value: INTEGRATIONS.flatMap(c => c.items).filter(i => i.status === 'coming_soon').length, color: 'purple' },
        ].map(s => (
          <div key={s.label} className={`glass-card rounded-xl p-4 text-center terminal-scanlines relative`}>
            <p className={`font-display text-[28px] font-extrabold text-${s.color}`}>{s.value}</p>
            <p className="text-[13px] text-t2 mt-1">{s.label}</p>
          </div>
        ))}
      </div>

      {/* Integration categories */}
      {INTEGRATIONS.map(category => (
        <div key={category.category}>
          <span className="terminal-label mb-3 block">{category.category.toUpperCase()}</span>
          <div className="space-y-2.5">
            {category.items.map(int => {
              const st = STATUS_STYLE[int.status]
              const expanded = expandedId === int.id
              return (
                <div key={int.id} className="glass-card rounded-2xl overflow-hidden hover:border-border-hover active:border-border-hover transition-all">
                  <button onClick={() => setExpandedId(expanded ? null : int.id)}
                    className="w-full flex items-center justify-between p-5 text-left">
                    <div className="flex items-center gap-4">
                      <div className="w-11 h-11 rounded-xl flex items-center justify-center text-white shrink-0" style={{ background: int.color }}>
                        <int.icon size={20} />
                      </div>
                      <div>
                        <h4 className="text-[15px] font-bold">{int.name}</h4>
                        <p className="text-[13px] text-t2 mt-0.5">{int.desc}</p>
                      </div>
                    </div>
                    <div className="flex items-center gap-3">
                      <span className={`inline-flex items-center gap-1.5 px-2.5 py-1 rounded-lg text-[12px] font-semibold ${st.bg} ${st.text}`}>
                        <span className={`w-[5px] h-[5px] rounded-full ${st.dot}`} />
                        {st.label}
                      </span>
                      <ArrowRight size={14} className={`text-t3 transition-transform ${expanded ? 'rotate-90' : ''}`} />
                    </div>
                  </button>

                  {expanded && (
                    <div className="px-5 pb-5 pt-0 border-t border-border">
                      <div className="grid grid-cols-2 gap-2 mt-4">
                        {int.features.map(f => (
                          <div key={f} className="flex items-center gap-2 text-[13px] text-t2">
                            <Check size={13} className={int.status === 'coming_soon' ? 'text-t3' : 'text-green'} /> {f}
                          </div>
                        ))}
                      </div>

                      {/* Slack config */}
                      {int.id === 'slack' && (
                        <div className="mt-4 pt-4 border-t border-border">
                          <p className="text-[13px] text-t2 font-semibold mb-2">Slack Webhook URL</p>
                          <div className="flex gap-2">
                            <input value={slackUrl} onChange={e => setSlackUrl(e.target.value)}
                              placeholder="https://hooks.slack.com/services/..." 
                              className="flex-1 px-3.5 py-2.5 rounded-xl glass-input text-[13px] text-t1 outline-none focus:border-cyan/40 placeholder:text-t3" />
                            <button onClick={() => { setToast(`${int.name} — configure in Settings > Integrations, or contact support@vaultline.app`); setTimeout(() => setToast(null), 4000) }}
                              className="px-4 py-2.5 rounded-xl bg-gradient-to-r from-cyan/90 to-cyan/70 text-void text-[13px] font-mono font-semibold hover:-translate-y-px active:scale-[0.98] transition-all">
                              CONNECT
                            </button>
                          </div>
                          <p className="text-[12px] text-t3 mt-2">Create an incoming webhook in your Slack workspace → paste the URL here</p>
                        </div>
                      )}

                      {/* Webhook config */}
                      {int.id === 'webhooks' && (
                        <div className="mt-4 pt-4 border-t border-border">
                          <p className="text-[13px] text-t2 font-semibold mb-2">Webhook Endpoint</p>
                          <div className="flex gap-2">
                            <input value={webhookUrl} onChange={e => setWebhookUrl(e.target.value)}
                              placeholder="https://your-app.com/webhooks/vaultline"
                              className="flex-1 px-3.5 py-2.5 rounded-xl glass-input text-[13px] text-t1 outline-none focus:border-cyan/40 placeholder:text-t3" />
                            <button className="px-4 py-2.5 rounded-xl bg-cyan text-void text-[13px] font-semibold hover:-translate-y-px active:scale-[0.98] transition-all">
                              Register
                            </button>
                          </div>
                          <p className="text-[12px] text-t3 mt-2">We'll send POST requests with JSON payloads for each event type</p>
                        </div>
                      )}

                      {int.status === 'connected' && (
                        <div className="mt-4 pt-4 border-t border-border flex items-center gap-2">
                          <span className="w-2 h-2 rounded-full bg-green animate-pulse" />
                          <span className="text-[13px] text-green font-medium">Connected and syncing</span>
                        </div>
                      )}

                      {int.status === 'coming_soon' && (
                        <div className="mt-4 pt-4 border-t border-border">
                          <p className="text-[13px] text-t2">This integration is on our roadmap. Contact support to express interest.</p>
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
      {toast && (
        <div className="fixed bottom-6 right-6 z-50 glass-card rounded-xl px-5 py-3 shadow-[0_8px_32px_rgba(0,0,0,0.3)] border-cyan/[0.15] max-w-sm">
          <p className="text-[13px] text-t2 font-mono">{toast}</p>
        </div>
      )}
    </div>
  )
}
