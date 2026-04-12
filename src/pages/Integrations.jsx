import { useState, useEffect, useCallback } from 'react'
import { SkeletonPage } from '@/components/Skeleton'
import { useAuth } from '@/hooks/useAuth'
import { useTreasury } from '@/hooks/useTreasury'
import { supabase } from '@/lib/supabase'
import { safeInvoke } from '@/lib/safeInvoke'
import { useToast } from '@/components/Toast'
import { Link } from 'react-router-dom'
import {
  Plug, MessageSquare, Webhook, Building2, FileSpreadsheet, Link2, Check, ExternalLink,
  Mail, Bell, Globe, Shield, Zap, ArrowRight, Loader2, X, CheckCircle2, AlertTriangle
} from 'lucide-react'

const STATUS_STYLE = {
  connected: { bg: 'bg-green/[0.08]', text: 'text-green', label: 'Connected', dot: 'bg-green' },
  active: { bg: 'bg-cyan/[0.08]', text: 'text-cyan', label: 'Active', dot: 'bg-cyan' },
  available: { bg: 'bg-amber/[0.06]', text: 'text-amber', label: 'Available', dot: 'bg-amber' },
  coming_soon: { bg: 'bg-purple/[0.06]', text: 'text-purple', label: 'Coming Soon', dot: 'bg-purple' },
  error: { bg: 'bg-red/[0.06]', text: 'text-red', label: 'Error', dot: 'bg-red' },
}

export default function Integrations() {
  const { org } = useAuth()
  const { bankConnections } = useTreasury()
  const toast = useToast()
  const [expandedId, setExpandedId] = useState(null)
  const [slackUrl, setSlackUrl] = useState('')
  const [slackChannel, setSlackChannel] = useState('')
  const [webhookUrl, setWebhookUrl] = useState('')
  const [saving, setSaving] = useState(null)
  const [notifSettings, setNotifSettings] = useState(null)

  useEffect(() => { document.title = 'Integrations \u2014 Vaultline' }, [])

  // Load real notification settings for Slack status
  useEffect(() => {
    if (!org?.id) return
    supabase.from('notification_settings').select('slack_enabled, slack_webhook_url, slack_channel')
      .eq('org_id', org.id).single().then(({ data }) => {
        if (data) {
          setNotifSettings(data)
          setSlackUrl(data.slack_webhook_url || '')
          setSlackChannel(data.slack_channel || '')
        }
      })
  }, [org?.id])

  // Derive real statuses
  const plaidConnected = (bankConnections || []).filter(b => b.status === 'connected').length
  const plaidErrors = (bankConnections || []).filter(b => b.status === 'error').length
  const slackConnected = notifSettings?.slack_enabled && notifSettings?.slack_webhook_url

  const INTEGRATIONS = [
    {
      category: 'Banking & Payments',
      items: [
        { id: 'plaid', name: 'Plaid', desc: `${plaidConnected} bank${plaidConnected !== 1 ? 's' : ''} connected${plaidErrors ? ` \u00b7 ${plaidErrors} error` : ''}`, icon: Link2, color: '#0A85EA',
          status: plaidConnected > 0 ? (plaidErrors > 0 ? 'error' : 'connected') : 'available',
          features: ['Real-time balances', 'Transaction history', 'Account verification', '12,000+ institutions'],
          link: '/banks' },
        { id: 'stripe_int', name: 'Stripe', desc: 'Subscription billing and payment processing', icon: Zap, color: '#635BFF',
          status: 'active', features: ['Subscription management', 'Payment processing', 'Customer Portal', 'Webhook events'] },
      ]
    },
    {
      category: 'Accounting & ERP',
      items: [
        { id: 'quickbooks', name: 'QuickBooks Online', desc: 'Sync accounts, invoices, bills, and payments', icon: FileSpreadsheet, color: '#2CA01C',
          status: 'available', features: ['Account sync', 'Invoice tracking', 'Bill payments', 'Purchase orders'],
          connect: 'qb-auth' },
        { id: 'xero', name: 'Xero', desc: 'Two-way sync with Xero accounting data', icon: FileSpreadsheet, color: '#13B5EA',
          status: 'available', features: ['Bank feeds', 'Invoice reconciliation', 'Contact sync', 'Journal entries'],
          connect: 'acct-auth' },
        { id: 'sage', name: 'Sage Intacct', desc: 'Enterprise accounting integration', icon: FileSpreadsheet, color: '#00DC82',
          status: 'coming_soon', features: ['GL sync', 'AP/AR management', 'Multi-entity consolidation', 'Custom dimensions'] },
        { id: 'netsuite', name: 'NetSuite', desc: 'Oracle NetSuite ERP integration', icon: Building2, color: '#1B3D6F',
          status: 'coming_soon', features: ['Real-time GL data', 'Subsidiary management', 'Custom record types', 'SuiteQL queries'] },
      ]
    },
    {
      category: 'Communication',
      items: [
        { id: 'slack', name: 'Slack', desc: slackConnected ? `Connected to ${notifSettings.slack_channel || 'channel'}` : 'Push treasury alerts to Slack channels', icon: MessageSquare, color: '#E01E5A',
          status: slackConnected ? 'connected' : 'available',
          features: ['Low balance alerts', 'Large transaction notifications', 'Daily cash position summary', 'Forecast deviation warnings'] },
        { id: 'email', name: 'Email Alerts', desc: 'Automated email notifications via Resend', icon: Mail, color: '#22D3EE',
          status: 'active', features: ['All alert types', 'Branded HTML templates', 'Custom thresholds', 'Configure in Settings'],
          link: '/settings' },
        { id: 'webhooks', name: 'Webhooks', desc: 'Send real-time events to your own endpoints', icon: Webhook, color: '#818CF8',
          status: 'available', features: ['HMAC-SHA256 signed', 'Transaction events', 'Balance changes', '3 retry attempts'],
          link: '/api' },
      ]
    },
    {
      category: 'Security & Compliance',
      items: [
        { id: 'sso_saml', name: 'SSO / SAML', desc: 'Single sign-on via your identity provider', icon: Shield, color: '#F59E0B',
          status: 'coming_soon', features: ['Okta', 'Azure AD', 'OneLogin', 'Google Workspace'] },
      ]
    },
  ]

  async function saveSlack() {
    if (!org?.id || !slackUrl.trim()) return
    setSaving('slack')
    const { error } = await supabase.from('notification_settings').upsert({
      org_id: org.id,
      slack_enabled: true,
      slack_webhook_url: slackUrl.trim(),
      slack_channel: slackChannel.trim() || '#treasury',
    }, { onConflict: 'org_id' })
    if (error) { toast.error(error.message); setSaving(null); return }
    setNotifSettings({ slack_enabled: true, slack_webhook_url: slackUrl.trim(), slack_channel: slackChannel.trim() || '#treasury' })
    toast.success('Slack connected')
    setSaving(null)
  }

  async function disconnectSlack() {
    if (!org?.id) return
    setSaving('slack')
    await supabase.from('notification_settings').upsert({
      org_id: org.id, slack_enabled: false, slack_webhook_url: '', slack_channel: '',
    }, { onConflict: 'org_id' })
    setNotifSettings({ slack_enabled: false, slack_webhook_url: '', slack_channel: '' })
    setSlackUrl(''); setSlackChannel('')
    toast.info('Slack disconnected')
    setSaving(null)
  }

  async function connectAccounting(id) {
    setSaving(id)
    if (id === 'quickbooks') {
      const { data, error } = await safeInvoke('qb-auth', { action: 'start', redirect_uri: `${window.location.origin}/integrations` })
      if (data?.auth_url) { window.location.href = data.auth_url }
      else { toast.error('QuickBooks OAuth not configured \u2014 set QB_CLIENT_ID and QB_CLIENT_SECRET in Supabase secrets') }
    } else if (id === 'xero') {
      const { data, error } = await safeInvoke('acct-auth', { action: 'start', provider: 'xero', redirect_uri: `${window.location.origin}/integrations` })
      if (data?.auth_url) { window.location.href = data.auth_url }
      else { toast.error('Xero OAuth not configured \u2014 set XERO_CLIENT_ID and XERO_CLIENT_SECRET in Supabase secrets') }
    }
    setSaving(null)
  }

  const allItems = INTEGRATIONS.flatMap(c => c.items)
  const connectedCount = allItems.filter(i => i.status === 'connected' || i.status === 'active').length
  const availableCount = allItems.filter(i => i.status === 'available').length

  return (
    <div className="max-w-[900px] mx-auto space-y-7">
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-3">
          <div className="w-11 h-11 rounded-xl bg-cyan/[0.1] flex items-center justify-center">
            <Plug size={20} className="text-cyan" />
          </div>
          <div>
            <span className="terminal-label">INTEGRATIONS</span>
            <p className="text-[13px] text-t2">{connectedCount} active \u00b7 {availableCount} available</p>
          </div>
        </div>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
        {[
          { label: 'Connected', value: connectedCount, color: 'green' },
          { label: 'Available', value: availableCount, color: 'amber' },
          { label: 'Coming soon', value: allItems.filter(i => i.status === 'coming_soon').length, color: 'purple' },
        ].map(s => (
          <div key={s.label} className="glass-card rounded-xl p-4 text-center terminal-scanlines relative">
            <p className={`font-display text-[28px] font-extrabold text-${s.color}`}>{s.value}</p>
            <p className="text-[13px] text-t2 mt-1">{s.label}</p>
          </div>
        ))}
      </div>

      {INTEGRATIONS.map(category => (
        <div key={category.category}>
          <span className="terminal-label mb-3 block">{category.category.toUpperCase()}</span>
          <div className="space-y-2.5">
            {category.items.map(int => {
              const st = STATUS_STYLE[int.status]
              const expanded = expandedId === int.id
              return (
                <div key={int.id} className="glass-card rounded-2xl overflow-hidden hover:border-border-hover transition-all">
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
                        <span className={`w-[5px] h-[5px] rounded-full ${st.dot}`} />{st.label}
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
                          {slackConnected ? (
                            <div className="flex items-center justify-between">
                              <div className="flex items-center gap-2">
                                <CheckCircle2 size={14} className="text-green" />
                                <span className="text-[13px] text-green font-medium">Connected to {notifSettings.slack_channel}</span>
                              </div>
                              <button onClick={disconnectSlack} disabled={saving === 'slack'}
                                className="text-[12px] font-mono text-red hover:underline">Disconnect</button>
                            </div>
                          ) : (
                            <>
                              <p className="text-[13px] text-t2 font-semibold mb-2">Connect Slack</p>
                              <div className="space-y-2">
                                <input value={slackUrl} onChange={e => setSlackUrl(e.target.value)}
                                  placeholder="https://hooks.slack.com/services/..."
                                  className="w-full px-3.5 py-2.5 rounded-xl glass-input text-[13px] text-t1 outline-none focus:border-cyan/40 placeholder:text-t3" />
                                <div className="flex gap-2">
                                  <input value={slackChannel} onChange={e => setSlackChannel(e.target.value)}
                                    placeholder="#treasury-alerts"
                                    className="flex-1 px-3.5 py-2.5 rounded-xl glass-input text-[13px] text-t1 outline-none focus:border-cyan/40 placeholder:text-t3" />
                                  <button onClick={saveSlack} disabled={saving === 'slack' || !slackUrl.trim()}
                                    className="px-5 py-2.5 rounded-xl bg-gradient-to-r from-cyan/90 to-cyan/70 text-void text-[13px] font-semibold hover:-translate-y-px active:scale-[0.98] transition-all disabled:opacity-50">
                                    {saving === 'slack' ? <Loader2 size={14} className="animate-spin" /> : 'Connect'}
                                  </button>
                                </div>
                              </div>
                              <p className="text-[12px] text-t3 mt-2">Create an incoming webhook in Slack \u2192 paste the URL above</p>
                            </>
                          )}
                        </div>
                      )}

                      {/* Accounting connect */}
                      {int.connect && (
                        <div className="mt-4 pt-4 border-t border-border">
                          <button onClick={() => connectAccounting(int.id)} disabled={saving === int.id}
                            className="flex items-center gap-2 px-5 py-2.5 rounded-xl bg-gradient-to-r from-cyan/90 to-cyan/70 text-void text-[13px] font-semibold hover:-translate-y-px active:scale-[0.98] transition-all disabled:opacity-50">
                            {saving === int.id ? <Loader2 size={14} className="animate-spin" /> : <ExternalLink size={14} />}
                            Connect {int.name}
                          </button>
                        </div>
                      )}

                      {/* Link to other page */}
                      {int.link && (
                        <div className="mt-4 pt-4 border-t border-border">
                          <Link to={int.link} className="flex items-center gap-2 text-[13px] text-cyan font-semibold hover:underline">
                            {int.id === 'plaid' ? 'Manage bank connections' : int.id === 'email' ? 'Configure in Settings' : int.id === 'webhooks' ? 'Manage via API' : 'View'} <ArrowRight size={12} />
                          </Link>
                        </div>
                      )}

                      {int.status === 'connected' && !int.link && (
                        <div className="mt-4 pt-4 border-t border-border flex items-center gap-2">
                          <span className="w-2 h-2 rounded-full bg-green animate-pulse" />
                          <span className="text-[13px] text-green font-medium">Connected and syncing</span>
                        </div>
                      )}

                      {int.status === 'coming_soon' && (
                        <div className="mt-4 pt-4 border-t border-border">
                          <p className="text-[13px] text-t2">On our roadmap. Contact support@vaultline.app to express interest.</p>
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
          <span className="terminal-live">LIVE</span>
          <span>BANKS: <span className="text-cyan">{plaidConnected}</span></span>
          <span>SLACK: <span className={slackConnected ? 'text-green' : 'text-t3'}>{slackConnected ? 'ON' : 'OFF'}</span></span>
        </div>
        <Link to="/settings" className="text-[11px] font-mono text-t3 hover:text-cyan transition">
          Alert thresholds {'\u2192'}
        </Link>
      </div>
    </div>
  )
}
