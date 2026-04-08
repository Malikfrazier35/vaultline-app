import { useState, useEffect, useRef, useCallback } from 'react'
import { useAuth } from '@/hooks/useAuth'
import { supabase } from '@/lib/supabase'
import { safeInvoke } from '@/lib/safeInvoke'
import { useNavigate } from 'react-router-dom'
import { useToast } from '@/components/Toast'
import {
  Building2, User, Bell, Shield, Palette, Globe, MapPin, Phone,
  Mail, Briefcase, Camera, Check, X, ChevronRight, Save,
  AlertTriangle, Trash2, Database, Users, CreditCard, Clock, ArrowRight, AlertCircle,
  Download, Lock, FileText, Sparkles, Loader2
} from 'lucide-react'

const INDUSTRIES = [
  'Technology', 'Financial Services', 'Healthcare', 'Manufacturing', 'Retail & E-commerce',
  'Real Estate', 'Energy & Utilities', 'Professional Services', 'Media & Entertainment',
  'Education', 'Transportation & Logistics', 'Agriculture', 'Construction', 'Hospitality', 'Other'
]
const SIZES = ['1-10', '11-50', '51-200', '201-500', '501-1000', '1000+']
const TIMEZONES = [
  'America/New_York', 'America/Chicago', 'America/Denver', 'America/Los_Angeles',
  'America/Phoenix', 'America/Anchorage', 'Pacific/Honolulu', 'America/Toronto',
  'America/Vancouver', 'Europe/London', 'Europe/Paris', 'Europe/Berlin',
  'Asia/Tokyo', 'Asia/Shanghai', 'Asia/Singapore', 'Australia/Sydney'
]
const CURRENCIES = ['USD', 'EUR', 'GBP', 'CAD', 'AUD', 'JPY', 'CHF']
const MONTHS = ['January', 'February', 'March', 'April', 'May', 'June', 'July', 'August', 'September', 'October', 'November', 'December']
const DEPARTMENTS = ['Executive', 'Finance', 'Treasury', 'Accounting', 'Operations', 'Engineering', 'Sales', 'Marketing', 'HR', 'Legal', 'Other']
const COLORS = ['#22D3EE', '#818CF8', '#34D399', '#FB7185', '#FBBF24', '#F472B6', '#A78BFA', '#38BDF8', '#4ADE80', '#E879F9']

export default function Settings() {
  const { profile, org, user, refetch, logAuditEvent } = useAuth()
  const toast = useToast()
  const [tab, setTab] = useState('company')
  const [saving, setSaving] = useState(false)
  const [saved, setSaved] = useState(false)
  const [brandDomain, setBrandDomain] = useState(org?.domain || '')
  const [enriching, setEnriching] = useState(false)
  const [orgData, setOrgData] = useState({})
  const [profileData, setProfileData] = useState({})
  const [autoSaveStatus, setAutoSaveStatus] = useState(null) // null | 'saving' | 'saved' | 'error'
  const autoSaveTimer = useRef(null)
  const orgDataRef = useRef({})
  const navigate = useNavigate()
  const isOwnerOrAdmin = profile?.role === 'owner' || profile?.role === 'admin'

  // Close account offboarding state
  const [closeStep, setCloseStep] = useState(null) // null | 'preview' | 'survey' | 'confirm' | 'done'
  const [closePreview, setClosePreview] = useState(null)
  const [closeLoading, setCloseLoading] = useState(false)
  const [closeError, setCloseError] = useState(null)
  const [exitReason, setExitReason] = useState('')
  const [exitFeedback, setExitFeedback] = useState('')
  const [confirmText, setConfirmText] = useState('')
  const [closeResult, setCloseResult] = useState(null)

  // Notification settings (from notification_settings table)
  const [notifSettings, setNotifSettings] = useState({
    low_cash_alerts: true, low_cash_threshold: 100000,
    daily_position_email: true, daily_email_time: '08:00',
    large_transaction_alerts: true, large_transaction_threshold: 50000,
    forecast_deviation_alerts: false, forecast_deviation_pct: 10,
    slack_enabled: false, slack_webhook_url: '', slack_channel: '',
  })

  useEffect(() => { document.title = 'Settings — Vaultline' }, [])

  // Load notification settings
  useEffect(() => {
    if (!org?.id) return
    supabase.from('notification_settings').select('*').eq('org_id', org.id).single().then(({ data }) => {
      if (data) setNotifSettings(prev => ({ ...prev, ...data }))
    })
  }, [org?.id])

  // Load full org and profile data
  useEffect(() => {
    if (org) { setOrgData({ ...org }); orgDataRef.current = { ...org } }
    if (profile) setProfileData({ ...profile })
  }, [org, profile])

  // ═══ AUTO-SAVE: debounced save 2 seconds after user stops typing ═══
  const autoSaveOrg = useCallback(() => {
    if (!org?.id || !isOwnerOrAdmin) return
    if (autoSaveTimer.current) clearTimeout(autoSaveTimer.current)
    setAutoSaveStatus('saving')
    autoSaveTimer.current = setTimeout(async () => {
      const { error } = await supabase.from('organizations').update({
        name: orgDataRef.current.name,
        industry: orgDataRef.current.industry,
        company_size: orgDataRef.current.company_size,
        website: orgDataRef.current.website,
        phone: orgDataRef.current.phone,
        timezone: orgDataRef.current.timezone,
        address_line1: orgDataRef.current.address_line1,
        address_line2: orgDataRef.current.address_line2,
        city: orgDataRef.current.city,
        state: orgDataRef.current.state,
        zip: orgDataRef.current.zip,
        country: orgDataRef.current.country,
        brand_color: orgDataRef.current.brand_color,
        default_currency: orgDataRef.current.default_currency,
        fiscal_year_start_month: orgDataRef.current.fiscal_year_start_month,
      }).eq('id', org.id)
      if (!error) {
        setAutoSaveStatus('saved')
        refetch?.()
        setTimeout(() => setAutoSaveStatus(null), 3000)
      } else {
        setAutoSaveStatus('error')
      }
    }, 2000)
  }, [org?.id, isOwnerOrAdmin, refetch])

  // Wrapper: update state + ref + trigger auto-save
  function updateOrg(field, value) {
    setOrgData(prev => {
      const next = { ...prev, [field]: value }
      orgDataRef.current = next
      return next
    })
    autoSaveOrg()
  }

  // ═══ AUTO-SAVE: notifications ═══
  const notifTimerRef = useRef(null)
  const notifRef = useRef(notifSettings)
  const [notifAutoStatus, setNotifAutoStatus] = useState(null)

  function updateNotif(updates) {
    setNotifSettings(prev => {
      const next = { ...prev, ...updates }
      notifRef.current = next
      return next
    })
    if (notifTimerRef.current) clearTimeout(notifTimerRef.current)
    setNotifAutoStatus('saving')
    notifTimerRef.current = setTimeout(async () => {
      if (!org?.id) return
      const { error } = await supabase.from('notification_settings').upsert({
        org_id: org.id, ...notifRef.current,
      }, { onConflict: 'org_id' })
      setNotifAutoStatus(error ? 'error' : 'saved')
      setTimeout(() => setNotifAutoStatus(null), 3000)
    }, 2000)
  }

  async function saveOrg() {
    setSaving(true)
    const { error } = await supabase.from('organizations').update({
      name: orgData.name,
      industry: orgData.industry,
      company_size: orgData.company_size,
      website: orgData.website,
      phone: orgData.phone,
      timezone: orgData.timezone,
      address_line1: orgData.address_line1,
      address_line2: orgData.address_line2,
      city: orgData.city,
      state: orgData.state,
      zip: orgData.zip,
      country: orgData.country,
      brand_color: orgData.brand_color,
      default_currency: orgData.default_currency,
      fiscal_year_start_month: orgData.fiscal_year_start_month,
    }).eq('id', org.id)
    setSaving(false)
    if (!error) { setSaved(true); setTimeout(() => setSaved(false), 2000); refetch?.(); toast.success('Company settings saved') }
    else toast.error(error.message, 'Save failed')
  }

  async function saveProfile() {
    setSaving(true)
    const { error } = await supabase.from('profiles').update({
      full_name: profileData.full_name,
      title: profileData.title,
      department: profileData.department,
      phone: profileData.phone,
      timezone: profileData.timezone,
    }).eq('id', profile?.id)
    setSaving(false)
    if (!error) { setSaved(true); setTimeout(() => setSaved(false), 2000); refetch?.(); toast.success('Profile updated') }
    else toast.error(error.message, 'Save failed')
  }

  async function saveNotifSettings() {
    setSaving(true)
    const { error } = await supabase.from('notification_settings').upsert({
      org_id: org.id,
      low_cash_alerts: notifSettings.low_cash_alerts,
      low_cash_threshold: notifSettings.low_cash_threshold,
      daily_position_email: notifSettings.daily_position_email,
      daily_email_time: notifSettings.daily_email_time,
      large_transaction_alerts: notifSettings.large_transaction_alerts,
      large_transaction_threshold: notifSettings.large_transaction_threshold,
      forecast_deviation_alerts: notifSettings.forecast_deviation_alerts,
      forecast_deviation_pct: notifSettings.forecast_deviation_pct,
      slack_enabled: notifSettings.slack_enabled,
      slack_webhook_url: notifSettings.slack_webhook_url,
      slack_channel: notifSettings.slack_channel,
    }, { onConflict: 'org_id' })
    setSaving(false)
    if (!error) { setSaved(true); setTimeout(() => setSaved(false), 2000); toast.success('Notification settings saved') }
    else toast.error(error.message, 'Save failed')
  }

  const TABS = [
    { id: 'company', label: 'Company Profile', icon: Building2 },
    { id: 'personal', label: 'My Profile', icon: User },
    { id: 'branding', label: 'Branding', icon: Palette },
    { id: 'notifications', label: 'Notifications', icon: Bell },
    { id: 'privacy', label: 'Privacy & Data', icon: Lock },
    ...(profile?.role === 'owner' ? [{ id: 'account', label: 'Account', icon: AlertTriangle, danger: true }] : []),
  ]

  // ═══ CLOSE ACCOUNT PIPELINE ═══
  async function startCloseAccount() {
    setCloseStep('preview')
    setCloseLoading(true)
    setCloseError(null)
    try {
      const { data: { session } } = await supabase.auth.getSession()
      const res = await fetch(`${import.meta.env.VITE_SUPABASE_URL || 'https://cosbviiihkxjdqcpksgv.supabase.co'}/functions/v1/account-close`, {
        method: 'POST',
        headers: { 'Authorization': `Bearer ${session.access_token}`, 'Content-Type': 'application/json' },
        body: JSON.stringify({ action: 'preview' }),
      })
      const data = await res.json()
      if (!res.ok) throw new Error(data.error || 'Failed to load preview')
      setClosePreview(data)
    } catch (e) {
      setCloseError(e.message)
    } finally {
      setCloseLoading(false)
    }
  }

  async function confirmCloseAccount() {
    setCloseLoading(true)
    setCloseError(null)
    try {
      const { data: { session } } = await supabase.auth.getSession()
      const res = await fetch(`${import.meta.env.VITE_SUPABASE_URL || 'https://cosbviiihkxjdqcpksgv.supabase.co'}/functions/v1/account-close`, {
        method: 'POST',
        headers: { 'Authorization': `Bearer ${session.access_token}`, 'Content-Type': 'application/json' },
        body: JSON.stringify({ action: 'confirm', reason: exitReason, feedback: exitFeedback }),
      })
      const data = await res.json()
      if (!res.ok) throw new Error(data.error || 'Failed to close account')
      setCloseResult(data)
      setCloseStep('done')
    } catch (e) {
      setCloseError(e.message)
    } finally {
      setCloseLoading(false)
    }
  }

  function resetCloseFlow() {
    setCloseStep(null); setClosePreview(null); setCloseError(null)
    setExitReason(''); setExitFeedback(''); setConfirmText(''); setCloseResult(null)
  }


  return (
    <div className="max-w-[960px] mx-auto">
      {/* Tabs */}
      <div className="flex items-center gap-1 mb-8 border-b border-border pb-0">
        {TABS.map(t => (
          <button key={t.id} onClick={() => setTab(t.id)}
            className={`flex items-center gap-2 px-4 py-3 text-[14px] font-medium border-b-2 transition font-mono ${
              tab === t.id ? (t.danger ? 'border-red text-red' : 'border-cyan text-cyan') : `border-transparent ${t.danger ? 'text-red/50 hover:text-red' : 'text-t3 hover:text-t1'}`
            }`}>
            <t.icon size={15} /> {t.label}
          </button>
        ))}
      </div>

      {/* ═══ COMPANY PROFILE ═══ */}
      {tab === 'company' && (
        <div className="space-y-6">
          {/* Auto-save indicator */}
          {autoSaveStatus && (
            <div className={`flex items-center gap-2 text-[12px] font-mono px-3 py-1.5 rounded-lg w-fit count-enter ${
              autoSaveStatus === 'saving' ? 'bg-amber/10 text-amber' :
              autoSaveStatus === 'saved' ? 'bg-green/10 text-green' : 'bg-red/10 text-red'
            }`}>
              {autoSaveStatus === 'saving' && <><span className="w-3 h-3 border-2 border-amber border-t-transparent rounded-full animate-spin" /> Auto-saving...</>}
              {autoSaveStatus === 'saved' && <><Check size={12} /> All changes saved</>}
              {autoSaveStatus === 'error' && <><AlertCircle size={12} /> Save failed — try again</>}
            </div>
          )}

          <SectionCard title="Company Information" sub="Basic details about your organization">
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-5">
              <Field label="Company Name" value={orgData.name} onChange={v => updateOrg('name', v)} placeholder="Acme Corporation" disabled={!isOwnerOrAdmin} />
              <SelectField label="Industry" value={orgData.industry} onChange={v => updateOrg('industry', v)} options={INDUSTRIES} placeholder="Select industry" disabled={!isOwnerOrAdmin} />
              <SelectField label="Company Size" value={orgData.company_size} onChange={v => updateOrg('company_size', v)} options={SIZES} placeholder="Select size" disabled={!isOwnerOrAdmin} />
              <Field label="Website" value={orgData.website} onChange={v => updateOrg('website', v)} placeholder="https://acmecorp.com" disabled={!isOwnerOrAdmin} />
              <Field label="Phone" value={orgData.phone} onChange={v => updateOrg('phone', v)} placeholder="+1 (555) 000-0000" disabled={!isOwnerOrAdmin} />
              <SelectField label="Timezone" value={orgData.timezone} onChange={v => updateOrg('timezone', v)} options={TIMEZONES} disabled={!isOwnerOrAdmin} />
            </div>
          </SectionCard>

          <SectionCard title="Address" sub="Company headquarters or mailing address">
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-5">
              <div className="sm:col-span-2"><Field label="Address Line 1" value={orgData.address_line1} onChange={v => updateOrg('address_line1', v)} placeholder="123 Main Street" disabled={!isOwnerOrAdmin} /></div>
              <div className="sm:col-span-2"><Field label="Address Line 2" value={orgData.address_line2} onChange={v => updateOrg('address_line2', v)} placeholder="Suite 400" disabled={!isOwnerOrAdmin} /></div>
              <Field label="City" value={orgData.city} onChange={v => updateOrg('city', v)} placeholder="San Francisco" disabled={!isOwnerOrAdmin} />
              <Field label="State / Province" value={orgData.state} onChange={v => updateOrg('state', v)} placeholder="California" disabled={!isOwnerOrAdmin} />
              <Field label="ZIP / Postal Code" value={orgData.zip} onChange={v => updateOrg('zip', v)} placeholder="94105" disabled={!isOwnerOrAdmin} />
              <Field label="Country" value={orgData.country} onChange={v => updateOrg('country', v)} placeholder="United States" disabled={!isOwnerOrAdmin} />
            </div>
          </SectionCard>

          <SectionCard title="Financial Settings" sub="Configure currency and fiscal year">
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-5">
              <SelectField label="Default Currency" value={orgData.default_currency} onChange={v => updateOrg('default_currency', v)} options={CURRENCIES} disabled={!isOwnerOrAdmin} />
              <SelectField label="Fiscal Year Starts" value={orgData.fiscal_year_start_month?.toString()} onChange={v => updateOrg('fiscal_year_start_month', parseInt(v))} options={MONTHS.map((m, i) => ({ label: m, value: (i + 1).toString() }))} disabled={!isOwnerOrAdmin} />
            </div>
          </SectionCard>

          <SectionCard title="Brand Identity" sub="Auto-enrich your dashboard with company branding">
            <div className="space-y-4">
              <div className="flex items-center gap-4">
                {org?.logo_url ? (
                  <img src={org.logo_url} alt={org.name} className="w-14 h-14 rounded-xl object-contain bg-white border border-border shadow-sm" />
                ) : (
                  <div className="w-14 h-14 rounded-xl bg-deep border border-border flex items-center justify-center">
                    <Building2 size={20} className="text-t3" />
                  </div>
                )}
                <div className="flex-1">
                  <p className="text-[13px] font-semibold text-t1">{org?.domain ? `${org.domain}` : 'No domain set'}</p>
                  <p className="text-[11px] text-t3 mt-0.5">
                    {org?.brand_enriched_at ? `Enriched ${new Date(org.brand_enriched_at).toLocaleDateString()}` : 'Enter your company domain to auto-pull logo and brand colors'}
                  </p>
                  {org?.domain_verified && <span className="inline-flex items-center gap-1 text-[10px] font-mono font-semibold text-green mt-1"><Check size={10} /> Domain verified</span>}
                </div>
                {org?.brand_color && (
                  <div className="flex items-center gap-2">
                    <div className="w-8 h-8 rounded-lg border border-border shadow-sm" style={{ background: org.brand_color }} />
                    <span className="text-[11px] font-mono text-t3">{org.brand_color}</span>
                  </div>
                )}
              </div>

              <div className="flex items-center gap-3">
                <input
                  type="text"
                  value={brandDomain}
                  onChange={e => setBrandDomain(e.target.value)}
                  placeholder="acmecorp.com"
                  className="flex-1 bg-deep border border-border rounded-xl px-4 py-2.5 text-[13px] text-t1 font-mono placeholder:text-t4 focus:border-cyan focus:outline-none transition"
                  disabled={!isOwnerOrAdmin}
                />
                <button
                  onClick={async () => {
                    if (!brandDomain.trim()) return
                    setEnriching(true)
                    try {
                      const { data } = await safeInvoke('brand-enrich', { action: 'enrich', domain: brandDomain.trim(), org_id: org?.id, user_id: user?.id })
                      if (data?.error) { toast.error(data.error); return }
                      if (data?.success) {
                        toast.success(`Brand enriched: ${data.company_name || data.domain}`)
                        refetch?.()
                      }
                    } catch (err) { toast.error('Enrichment failed') }
                    finally { setEnriching(false) }
                  }}
                  disabled={!isOwnerOrAdmin || enriching || !brandDomain.trim()}
                  className="px-5 py-2.5 rounded-xl bg-cyan/[0.08] border border-cyan/20 text-[13px] font-semibold text-cyan hover:bg-cyan/[0.15] transition shrink-0 flex items-center gap-2 disabled:opacity-50"
                >
                  {enriching ? <><Loader2 size={13} className="animate-spin" /> Enriching...</> : <><Sparkles size={13} /> Enrich</>}
                </button>
              </div>

              {org?.domain && !org?.domain_verified && (
                <div className="terminal-inset rounded-xl p-4">
                  <p className="text-[12px] text-t2 font-medium mb-1">Verify domain ownership (optional)</p>
                  <p className="text-[11px] text-t3 mb-2">Add a DNS TXT record to prove you own this domain. This prevents impersonation.</p>
                  <button
                    onClick={async () => {
                      const { data } = await safeInvoke('brand-enrich', { action: 'verify_domain', domain: org.domain, org_id: org?.id, user_id: user?.id })
                      if (data?.verified) { toast.success('Domain verified!'); refetch?.() }
                      else if (data?.verification_code) { toast.info(`Add TXT record: ${data.verification_code}`); alert(`Add this TXT record to your DNS:\n\n${data.verification_code}\n\nThen click verify again.`) }
                    }}
                    className="text-[11px] font-mono text-cyan hover:text-cyan/80 transition"
                  >Verify DNS →</button>
                </div>
              )}
            </div>
          </SectionCard>

          {isOwnerOrAdmin && (
            <div className="flex justify-end">
              <SaveButton saving={saving} saved={saved} onClick={saveOrg} />
            </div>
          )}
        </div>
      )}

      {/* ═══ PERSONAL PROFILE ═══ */}
      {tab === 'personal' && (
        <div className="space-y-6">
          {/* Avatar + name header */}
          <div className="glass-card rounded-2xl p-6 terminal-scanlines relative">
            <div className="flex items-center gap-5">
              <div className="relative group">
                <div className="w-20 h-20 rounded-2xl bg-gradient-to-br from-cyan/80 to-purple/80 flex items-center justify-center text-2xl font-bold text-white glow-md">
                  {profileData.full_name?.split(' ').map(n => n[0]).join('').toUpperCase().slice(0, 2) || '?'}
                </div>
              </div>
              <div className="flex-1">
                <h3 className="font-display text-[18px] font-bold">{profileData.full_name || 'Your Name'}</h3>
                <p className="text-[14px] text-t2 mt-0.5">{profileData.title || 'No title set'} {profileData.department ? `· ${profileData.department}` : ''}</p>
                <p className="text-[13px] text-t2 mt-1">{profileData.email} · {profile?.role}</p>
              </div>
              <div className="text-right">
                <span className="px-3 py-1 rounded-lg bg-cyan-glow text-cyan text-[13px] font-semibold uppercase">{profile?.role}</span>
              </div>
            </div>
          </div>

          <SectionCard title="Personal Information" sub="Your name and contact details">
            <div className="grid grid-cols-2 gap-5">
              <Field label="Full Name" value={profileData.full_name} onChange={v => setProfileData({ ...profileData, full_name: v })} />
              <Field label="Email" value={profileData.email} disabled note="Managed via authentication" />
              <Field label="Job Title" value={profileData.title} onChange={v => setProfileData({ ...profileData, title: v })} placeholder="e.g. VP of Finance" />
              <SelectField label="Department" value={profileData.department} onChange={v => setProfileData({ ...profileData, department: v })} options={DEPARTMENTS} placeholder="Select department" />
              <Field label="Phone" value={profileData.phone} onChange={v => setProfileData({ ...profileData, phone: v })} placeholder="+1 (555) 000-0000" />
              <SelectField label="Timezone" value={profileData.timezone} onChange={v => setProfileData({ ...profileData, timezone: v })} options={TIMEZONES} />
            </div>
          </SectionCard>

          <div className="flex justify-end">
            <SaveButton saving={saving} saved={saved} onClick={saveProfile} />
          </div>
        </div>
      )}

      {/* ═══ BRANDING ═══ */}
      {tab === 'branding' && (
        <div className="space-y-6">
          <SectionCard title="Brand Color" sub="Choose a primary accent color for your workspace">
            <div className="flex items-center gap-3 mb-4">
              {COLORS.map(c => (
                <button key={c} onClick={() => isOwnerOrAdmin && setOrgData({ ...orgData, brand_color: c })}
                  className={`w-10 h-10 rounded-xl transition-all ${orgData.brand_color === c ? 'ring-2 ring-offset-2 ring-offset-void scale-110' : 'hover:scale-105'}`}
                  style={{ background: c, ringColor: c }} />
              ))}
            </div>
            <div className="flex items-center gap-3">
              <span className="text-[13px] text-t2">Custom:</span>
              <input type="color" value={orgData.brand_color || '#22D3EE'}
                onChange={e => isOwnerOrAdmin && setOrgData({ ...orgData, brand_color: e.target.value })}
                className="w-10 h-10 rounded-xl border border-border cursor-pointer" />
              <span className="text-[14px] text-t2 tabular-nums">{orgData.brand_color || '#22D3EE'}</span>
            </div>
          </SectionCard>

          <SectionCard title="Logo" sub="Upload your company logo">
            <div className="border-2 border-dashed border-border rounded-2xl p-10 text-center">
              <div className="w-16 h-16 rounded-2xl bg-cyan/[0.06] flex items-center justify-center mx-auto mb-3">
                <Camera size={24} className="text-t3" />
              </div>
              <p className="text-[14px] text-t2 font-medium">Drag & drop or click to upload</p>
                  <p className="text-[12px] text-t3 mt-1">PNG, SVG, or JPG under 2MB</p>
              <p className="text-[13px] text-t2 mt-1">PNG, SVG, or JPG · Max 2MB · Recommended 512×512</p>
            </div>
          </SectionCard>

          <SectionCard title="Preview" sub="How your brand appears across the dashboard">
            <div className="terminal-inset p-5">
              <div className="flex items-center gap-3 mb-4">
                <div className="w-10 h-10 rounded-xl flex items-center justify-center text-[14px] font-bold text-white"
                  style={{ background: orgData.brand_color || '#22D3EE' }}>
                  {orgData.name?.slice(0, 2).toUpperCase() || 'VL'}
                </div>
                <div>
                  <p className="text-[15px] font-semibold">{orgData.name || 'Your Company'}</p>
                  <p className="text-[13px] text-t2">{orgData.industry || 'Industry'} · {orgData.company_size || 'Size'} employees</p>
                </div>
              </div>
              <div className="flex gap-2">
                <div className="px-4 py-2 rounded-lg text-[13px] font-semibold text-white" style={{ background: orgData.brand_color || '#22D3EE' }}>Primary Button</div>
                <div className="px-4 py-2 rounded-lg text-[13px] font-semibold border" style={{ borderColor: orgData.brand_color || '#22D3EE', color: orgData.brand_color || '#22D3EE' }}>Secondary</div>
              </div>
            </div>
          </SectionCard>

          {isOwnerOrAdmin && (
            <div className="flex justify-end">
              <SaveButton saving={saving} saved={saved} onClick={saveOrg} />
            </div>
          )}
        </div>
      )}

      {/* ═══ NOTIFICATIONS ═══ */}
      {tab === 'notifications' && (
        <div className="space-y-6">
          {notifAutoStatus && (
            <div className={`flex items-center gap-2 text-[12px] font-mono px-3 py-1.5 rounded-lg w-fit count-enter ${
              notifAutoStatus === 'saving' ? 'bg-amber/10 text-amber' :
              notifAutoStatus === 'saved' ? 'bg-green/10 text-green' : 'bg-red/10 text-red'
            }`}>
              {notifAutoStatus === 'saving' && <><span className="w-3 h-3 border-2 border-amber border-t-transparent rounded-full animate-spin" /> Auto-saving...</>}
              {notifAutoStatus === 'saved' && <><Check size={12} /> Alert settings saved</>}
              {notifAutoStatus === 'error' && <><AlertCircle size={12} /> Save failed</>}
            </div>
          )}

          <SectionCard title="Delivery Channels" sub="Choose how you receive alerts">
            <div className="space-y-4">
              <Toggle label="Email Notifications" sub="Receive treasury alerts, sync status, and team updates via email"
                value={notifSettings.daily_position_email}
                onChange={v => updateNotif({ daily_position_email: v })} />
              <Toggle label="Slack Notifications" sub="Push treasury alerts to a Slack channel"
                value={notifSettings.slack_enabled}
                onChange={v => updateNotif({ slack_enabled: v })} />
              {notifSettings.slack_enabled && (
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 ml-8 p-4 rounded-xl terminal-inset">
                  <div>
                    <label className="text-[11px] font-mono text-t3 uppercase tracking-wider mb-1.5 block">Webhook URL</label>
                    <input value={notifSettings.slack_webhook_url || ''} onChange={e => updateNotif({ slack_webhook_url: e.target.value })}
                      placeholder="https://hooks.slack.com/services/..."
                      className="w-full px-3.5 py-2.5 rounded-xl glass-input text-t1 text-[13px] outline-none focus:border-cyan/40 transition placeholder:text-t3 font-mono" />
                  </div>
                  <div>
                    <label className="text-[11px] font-mono text-t3 uppercase tracking-wider mb-1.5 block">Channel</label>
                    <input value={notifSettings.slack_channel || ''} onChange={e => updateNotif({ slack_channel: e.target.value })}
                      placeholder="#treasury-alerts"
                      className="w-full px-3.5 py-2.5 rounded-xl glass-input text-t1 text-[13px] outline-none focus:border-cyan/40 transition placeholder:text-t3 font-mono" />
                  </div>
                </div>
              )}
            </div>
          </SectionCard>

          <SectionCard title="Alert Rules" sub="Configure which events trigger notifications and their thresholds">
            <div className="space-y-5">
              <div className="flex items-start justify-between gap-4 flex-wrap sm:flex-nowrap">
                <div className="flex-1 min-w-[200px]">
                  <Toggle label="Low Balance Alert" sub="Notify when any account drops below threshold"
                    value={notifSettings.low_cash_alerts}
                    onChange={v => updateNotif({ low_cash_alerts: v })} />
                </div>
                {notifSettings.low_cash_alerts && (
                  <div className="flex items-center gap-2 shrink-0 mt-2">
                    <span className="text-[11px] font-mono text-t3">$</span>
                    <input type="number" value={notifSettings.low_cash_threshold} onChange={e => updateNotif({ low_cash_threshold: parseFloat(e.target.value) || 0 })}
                      className="w-32 px-3 py-2 rounded-lg glass-input text-t1 text-[13px] font-mono outline-none focus:border-cyan/40 transition text-right" />
                  </div>
                )}
              </div>

              <div className="flex items-start justify-between gap-4 flex-wrap sm:flex-nowrap">
                <div className="flex-1 min-w-[200px]">
                  <Toggle label="Large Transaction Alert" sub="Notify on transactions above threshold"
                    value={notifSettings.large_transaction_alerts}
                    onChange={v => updateNotif({ large_transaction_alerts: v })} />
                </div>
                {notifSettings.large_transaction_alerts && (
                  <div className="flex items-center gap-2 shrink-0 mt-2">
                    <span className="text-[11px] font-mono text-t3">$</span>
                    <input type="number" value={notifSettings.large_transaction_threshold} onChange={e => updateNotif({ large_transaction_threshold: parseFloat(e.target.value) || 0 })}
                      className="w-32 px-3 py-2 rounded-lg glass-input text-t1 text-[13px] font-mono outline-none focus:border-cyan/40 transition text-right" />
                  </div>
                )}
              </div>

              <div className="flex items-start justify-between gap-4 flex-wrap sm:flex-nowrap">
                <div className="flex-1 min-w-[200px]">
                  <Toggle label="Forecast Deviation Alert" sub="Alert when actual cash deviates from forecast"
                    value={notifSettings.forecast_deviation_alerts}
                    onChange={v => updateNotif({ forecast_deviation_alerts: v })} />
                </div>
                {notifSettings.forecast_deviation_alerts && (
                  <div className="flex items-center gap-2 shrink-0 mt-2">
                    <input type="number" value={notifSettings.forecast_deviation_pct} onChange={e => updateNotif({ forecast_deviation_pct: parseFloat(e.target.value) || 0 })}
                      className="w-20 px-3 py-2 rounded-lg glass-input text-t1 text-[13px] font-mono outline-none focus:border-cyan/40 transition text-right" />
                    <span className="text-[11px] font-mono text-t3">%</span>
                  </div>
                )}
              </div>

              <div className="pt-3 border-t border-border">
                <label className="text-[11px] font-mono text-t3 uppercase tracking-wider mb-1.5 block">Daily Position Email Time</label>
                <div className="flex items-center gap-3">
                  <input type="time" value={notifSettings.daily_email_time || '08:00'} onChange={e => updateNotif({ daily_email_time: e.target.value })}
                    className="w-36 px-3.5 py-2.5 rounded-xl glass-input text-t1 text-[13px] font-mono outline-none focus:border-cyan/40 transition" />
                  <span className="text-[12px] text-t3">Your local timezone ({orgData.timezone || 'UTC'})</span>
                </div>
              </div>
            </div>
          </SectionCard>
        </div>
      )}

      {/* ═══ PRIVACY & DATA (GDPR/CCPA) ═══ */}
      {tab === 'privacy' && (
        <div className="space-y-6">
          <SectionCard title="Data Subject Rights" sub="GDPR Article 15-17 / CCPA Section 1798.100-105">
            <div className="space-y-4">
              <div className="terminal-inset rounded-xl p-5 flex items-center justify-between">
                <div>
                  <p className="text-[14px] font-semibold text-t1 flex items-center gap-2"><Download size={15} className="text-cyan" /> Export My Data</p>
                  <p className="text-[12px] text-t3 mt-1">Download a copy of all your personal and organizational data as JSON. Includes profile, transactions, audit logs, and settings.</p>
                </div>
                <button
                  onClick={async () => {
                    // 1. Rate limit check via security-ops
                    try {
                      const { data: check } = await safeInvoke('security-ops', { action: 'export_check' })
                      if (check && !check.allowed) {
                        toast.error(check.reason, 'Export blocked')
                        return
                      }
                    } catch {}

                    // 2. Re-authenticate before export
                    const pw = prompt('Re-enter your password to confirm data export:')
                    if (!pw) return
                    const { error: authErr } = await supabase.auth.signInWithPassword({ email: profile?.email || user?.email, password: pw })
                    if (authErr) { toast.error('Incorrect password. Export denied.'); return }

                    toast.info('Generating export...')
                    try {
                      const tables = ['profiles', 'accounts', 'transactions', 'bank_connections', 'cash_position', 'daily_balances', 'forecasts', 'audit_log', 'notifications']
                      const exportData = {
                        exported_at: new Date().toISOString(),
                        user_id: user.id,
                        org_id: org?.id,
                        watermark: `Exported by ${profile?.full_name || user?.email} on ${new Date().toISOString()} — Vaultline Confidential`,
                      }
                      for (const t of tables) {
                        const { data } = await supabase.from(t).select('*').eq(t === 'profiles' ? 'id' : 'org_id', t === 'profiles' ? user.id : org?.id).limit(10000)
                        // Mask sensitive fields in export
                        exportData[t] = (data || []).map(row => {
                          const masked = { ...row }
                          if (masked.account_number) masked.account_number = '****' + String(masked.account_number).slice(-4)
                          if (masked.routing_number) masked.routing_number = '****' + String(masked.routing_number).slice(-4)
                          if (masked.access_token) masked.access_token = '[REDACTED]'
                          if (masked.item_id) masked.item_id = '[REDACTED]'
                          return masked
                        })
                      }
                      const blob = new Blob([JSON.stringify(exportData, null, 2)], { type: 'application/json' })
                      const url = URL.createObjectURL(blob)
                      const a = document.createElement('a'); a.href = url; a.download = `vaultline-data-export-${new Date().toISOString().slice(0, 10)}.json`; a.click()
                      URL.revokeObjectURL(url)
                      toast.success('Data exported')
                      await logAuditEvent('data_export', 'privacy', null, { tables: tables.length, format: 'json', ip: navigator.userAgent?.slice(0, 100) })
                    } catch (err) { toast.error(err.message, 'Export failed') }
                  }}
                  className="px-5 py-2.5 rounded-xl bg-cyan/[0.08] border border-cyan/20 text-[13px] font-semibold text-cyan hover:bg-cyan/[0.15] transition shrink-0"
                >Export Data</button>
              </div>

              <div className="terminal-inset rounded-xl p-5 flex items-center justify-between">
                <div>
                  <p className="text-[14px] font-semibold text-t1 flex items-center gap-2"><FileText size={15} className="text-purple" /> Audit Log Export</p>
                  <p className="text-[12px] text-t3 mt-1">Download your complete audit trail as CSV for compliance review or external audit submission.</p>
                </div>
                <button
                  onClick={async () => {
                    toast.info('Exporting audit log...')
                    try {
                      const { data } = await supabase.from('audit_log').select('*').eq('org_id', org?.id).order('created_at', { ascending: false }).limit(50000)
                      if (!data?.length) { toast.info('No audit logs found'); return }
                      const headers = ['created_at', 'user_id', 'action', 'resource_type', 'resource_id', 'details']
                      const csv = [headers.join(','), ...data.map(r => headers.map(h => JSON.stringify(r[h] ?? '')).join(','))].join('\n')
                      const blob = new Blob([csv], { type: 'text/csv' })
                      const url = URL.createObjectURL(blob)
                      const a = document.createElement('a'); a.href = url; a.download = `vaultline-audit-log-${new Date().toISOString().slice(0, 10)}.csv`; a.click()
                      URL.revokeObjectURL(url)
                      toast.success(`${data.length} audit records exported`)
                      await logAuditEvent('audit_log_export', 'compliance', null, { records: data.length })
                    } catch (err) { toast.error(err.message, 'Export failed') }
                  }}
                  className="px-5 py-2.5 rounded-xl bg-purple/[0.08] border border-purple/20 text-[13px] font-semibold text-purple hover:bg-purple/[0.15] transition shrink-0"
                >Export CSV</button>
              </div>

              <div className="terminal-inset rounded-xl p-5 flex items-center justify-between border-red/[0.12]">
                <div>
                  <p className="text-[14px] font-semibold text-t1 flex items-center gap-2"><Trash2 size={15} className="text-red" /> Request Data Deletion</p>
                  <p className="text-[12px] text-t3 mt-1">Request permanent deletion of all your data. This closes your account and cannot be undone. Processed within 30 days per GDPR Article 17.</p>
                </div>
                <button
                  onClick={() => setTab('account')}
                  className="px-5 py-2.5 rounded-xl bg-red/[0.06] border border-red/20 text-[13px] font-semibold text-red hover:bg-red/[0.12] transition shrink-0"
                >{profile?.role === 'owner' ? 'Go to Account' : 'Contact Owner'}</button>
              </div>
            </div>
          </SectionCard>

          <SectionCard title="Data Retention" sub="How long your data is stored">
            <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
              {[
                { label: 'Transaction Data', period: 'Active subscription + 90 days', icon: CreditCard },
                { label: 'Audit Logs', period: '365 days (immutable)', icon: FileText },
                { label: 'Security Events', period: '180 days', icon: Shield },
                { label: 'Account Data', period: '30 days after deletion request', icon: Database },
              ].map(r => (
                <div key={r.label} className="terminal-inset rounded-xl p-4 flex items-center gap-3">
                  <r.icon size={16} className="text-t3 shrink-0" />
                  <div>
                    <p className="text-[13px] font-semibold text-t1">{r.label}</p>
                    <p className="text-[11px] text-t3 font-mono">{r.period}</p>
                  </div>
                </div>
              ))}
            </div>
          </SectionCard>

          <SectionCard title="Data Processing" sub="Third-party services that process your data">
            <div className="space-y-2">
              {[
                { name: 'Supabase', purpose: 'Database, authentication, edge functions', region: 'us-east-1 (AWS)' },
                { name: 'Stripe', purpose: 'Payment processing', region: 'US' },
                { name: 'Plaid', purpose: 'Bank account linking and transaction sync', region: 'US' },
                { name: 'Vercel', purpose: 'Application hosting and CDN', region: 'Global edge' },
              ].map(s => (
                <div key={s.name} className="terminal-inset rounded-xl p-3.5 flex items-center justify-between">
                  <div>
                    <p className="text-[13px] font-semibold text-t1">{s.name}</p>
                    <p className="text-[11px] text-t3">{s.purpose}</p>
                  </div>
                  <span className="text-[10px] font-mono text-t3 bg-void/50 px-2 py-1 rounded">{s.region}</span>
                </div>
              ))}
            </div>
          </SectionCard>
        </div>
      )}

      {/* ═══ ACCOUNT / DANGER ZONE ═══ */}
      {tab === 'account' && profile?.role === 'owner' && (
        <div className="space-y-6">
          {/* Plan summary */}
          <SectionCard title="Current Plan" sub="Your active subscription details">
            <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
              <div className="glass-card rounded-xl p-5">
                <p className="text-[10px] font-mono text-t3 uppercase tracking-wider mb-2">Plan</p>
                <p className="text-[20px] font-display font-bold text-cyan">{org?.plan?.toUpperCase() || 'STARTER'}</p>
              </div>
              <div className="glass-card rounded-xl p-5">
                <p className="text-[10px] font-mono text-t3 uppercase tracking-wider mb-2">Status</p>
                <div className="flex items-center gap-2">
                  <span className={`w-2.5 h-2.5 rounded-full ${org?.plan_status === 'active' ? 'bg-green live-dot' : org?.plan_status === 'trialing' ? 'bg-cyan live-dot' : 'bg-amber'}`} />
                  <p className={`text-[20px] font-display font-bold ${org?.plan_status === 'active' ? 'text-green' : org?.plan_status === 'trialing' ? 'text-cyan' : 'text-amber'}`}>{org?.plan_status?.toUpperCase() || 'UNKNOWN'}</p>
                </div>
              </div>
              <div className="glass-card rounded-xl p-5">
                <p className="text-[10px] font-mono text-t3 uppercase tracking-wider mb-2">{org?.plan_status === 'trialing' ? 'Trial Ends' : 'Member Since'}</p>
                <p className="text-[20px] font-display font-bold text-t1">{org?.trial_ends_at && org?.plan_status === 'trialing' ? new Date(org.trial_ends_at).toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' }) : org?.created_at ? new Date(org.created_at).toLocaleDateString('en-US', { month: 'short', year: 'numeric' }) : 'N/A'}</p>
              </div>
            </div>
            <div className="mt-4 flex items-center gap-3">
              <a href="/billing" className="px-4 py-2 rounded-xl bg-gradient-to-r from-cyan/90 to-cyan/70 text-void text-[13px] font-semibold hover:-translate-y-px active:scale-[0.98] transition-all flex items-center gap-2">
                <CreditCard size={14} /> Manage Billing
              </a>
              <span className="text-[12px] text-t3">14-day free trial · No credit card required</span>
            </div>
          </SectionCard>

          {/* Danger zone */}
          <div className="rounded-2xl border-2 border-red/20 bg-red/[0.02] p-6">
            <div className="flex items-center gap-3 mb-2">
              <div className="w-10 h-10 rounded-xl bg-red/[0.08] flex items-center justify-center"><AlertTriangle size={18} className="text-red" /></div>
              <div><h3 className="text-[16px] font-bold text-red">Danger Zone</h3><p className="text-[13px] text-t2">Irreversible actions that affect your entire organization</p></div>
            </div>

            {!closeStep && (
              <div className="mt-5 pt-5 border-t border-red/10">
                <div className="flex items-center justify-between">
                  <div><p className="text-[14px] font-semibold">Close this account</p><p className="text-[13px] text-t3">Cancel subscription, disconnect banks, deactivate team. Data retained 30 days.</p></div>
                  <button onClick={startCloseAccount} className="px-4 py-2 rounded-xl border-2 border-red/20 text-[13px] font-semibold text-red hover:bg-red/[0.06] hover:border-red/30 transition-all">Close Account</button>
                </div>
              </div>
            )}

            {/* STEP 1: PREVIEW */}
            {closeStep === 'preview' && (
              <div className="mt-5 pt-5 border-t border-red/10 space-y-4">
                {closeLoading ? (
                  <div className="flex items-center justify-center py-8"><div className="w-6 h-6 border-2 border-red border-t-transparent rounded-full animate-spin" /></div>
                ) : closeError ? (
                  <div className="text-[14px] text-red">{closeError} <button onClick={resetCloseFlow} className="underline ml-2">Go back</button></div>
                ) : closePreview && (<>
                  <h4 className="text-[15px] font-bold text-red">What happens when you close your account</h4>
                  <div className="grid grid-cols-3 gap-3">
                    <div className="terminal-inset p-3 rounded-xl"><Database size={14} className="text-t3 mb-1" /><p className="text-[11px] font-mono text-t3">TRANSACTIONS</p><p className="text-[18px] font-mono font-bold text-t1">{closePreview.data_summary.transactions.toLocaleString()}</p></div>
                    <div className="terminal-inset p-3 rounded-xl"><CreditCard size={14} className="text-t3 mb-1" /><p className="text-[11px] font-mono text-t3">BANKS</p><p className="text-[18px] font-mono font-bold text-t1">{closePreview.data_summary.bank_connections}</p></div>
                    <div className="terminal-inset p-3 rounded-xl"><Users size={14} className="text-t3 mb-1" /><p className="text-[11px] font-mono text-t3">MEMBERS</p><p className="text-[18px] font-mono font-bold text-t1">{closePreview.data_summary.team_members}</p></div>
                  </div>
                  <div className="space-y-2 text-[13px]">
                    <div className="flex items-start gap-2"><X size={14} className="text-red mt-0.5 shrink-0" /><span>Stripe subscription <b>immediately canceled</b></span></div>
                    <div className="flex items-start gap-2"><X size={14} className="text-red mt-0.5 shrink-0" /><span>All bank connections <b>disconnected</b></span></div>
                    <div className="flex items-start gap-2"><X size={14} className="text-red mt-0.5 shrink-0" /><span>All team members <b>deactivated</b></span></div>
                    <div className="flex items-start gap-2"><Clock size={14} className="text-amber mt-0.5 shrink-0" /><span>{closePreview.data_retention}</span></div>
                  </div>
                  <div className="rounded-xl p-4" style={{ background: closePreview.refund_eligible ? 'rgba(52,211,153,0.04)' : 'rgba(148,163,184,0.04)', border: `1px solid ${closePreview.refund_eligible ? 'rgba(52,211,153,0.12)' : 'rgba(148,163,184,0.08)'}` }}>
                    <p className="text-[12px] font-mono font-bold uppercase tracking-wider mb-1" style={{ color: closePreview.refund_eligible ? '#34D399' : '#94A3B8' }}>{closePreview.refund_eligible ? 'REFUND ELIGIBLE' : 'REFUND STATUS'}</p>
                    <p className="text-[14px]">{closePreview.refund_reason}</p>
                  </div>
                  <div className="flex items-center gap-3 pt-2">
                    <button onClick={() => setCloseStep('survey')} className="px-5 py-2.5 rounded-xl bg-red/[0.08] border border-red/20 text-[13px] font-semibold text-red hover:bg-red/[0.12] transition-all flex items-center gap-2">Continue <ArrowRight size={14} /></button>
                    <button onClick={resetCloseFlow} className="px-5 py-2.5 rounded-xl border border-border text-[13px] font-semibold text-t2 hover:text-t1 transition">Cancel</button>
                  </div>
                </>)}
              </div>
            )}

            {/* STEP 2: EXIT SURVEY */}
            {closeStep === 'survey' && (
              <div className="mt-5 pt-5 border-t border-red/10 space-y-4">
                <h4 className="text-[15px] font-bold">Before you go — help us improve</h4>
                <p className="text-[13px] text-t3">Your feedback directly influences our roadmap. Optional but appreciated.</p>
                <div>
                  <label className="text-[13px] text-t2 font-semibold uppercase tracking-[0.08em] mb-1.5 block">REASON FOR LEAVING</label>
                  <select value={exitReason} onChange={e => setExitReason(e.target.value)} className="w-full px-3.5 py-2.5 rounded-xl glass-input text-[14px] font-mono text-t1 outline-none transition focus:border-cyan/40">
                    <option value="">Select a reason (optional)</option>
                    <option value="too_expensive">Too expensive for our budget</option>
                    <option value="missing_features">Missing features we need</option>
                    <option value="switched_competitor">Switching to a competitor</option>
                    <option value="company_closed">Company is shutting down</option>
                    <option value="not_enough_use">Not using it enough</option>
                    <option value="too_complex">Product is too complex</option>
                    <option value="poor_support">Support was poor</option>
                    <option value="data_concerns">Data security concerns</option>
                    <option value="temporary">Taking a temporary break</option>
                    <option value="other">Other</option>
                  </select>
                </div>
                <div>
                  <label className="text-[13px] text-t2 font-semibold uppercase tracking-[0.08em] mb-1.5 block">ADDITIONAL FEEDBACK</label>
                  <textarea value={exitFeedback} onChange={e => setExitFeedback(e.target.value)} placeholder="What could we have done better? (optional)" rows={3} className="w-full px-3.5 py-2.5 rounded-xl glass-input text-[14px] text-t1 outline-none transition focus:border-cyan/40 resize-none" />
                </div>
                <div className="flex items-center gap-3 pt-2">
                  <button onClick={() => setCloseStep('confirm')} className="px-5 py-2.5 rounded-xl bg-red/[0.08] border border-red/20 text-[13px] font-semibold text-red hover:bg-red/[0.12] transition-all flex items-center gap-2">Continue to Confirmation <ArrowRight size={14} /></button>
                  <button onClick={() => setCloseStep('preview')} className="px-5 py-2.5 rounded-xl border border-border text-[13px] font-semibold text-t2 hover:text-t1 transition">Back</button>
                </div>
              </div>
            )}

            {/* STEP 3: TYPE TO CONFIRM */}
            {closeStep === 'confirm' && (
              <div className="mt-5 pt-5 border-t border-red/10 space-y-4">
                <h4 className="text-[15px] font-bold text-red">This action is permanent</h4>
                <p className="text-[13px] text-t2">Type <span className="font-mono font-bold text-red bg-red/[0.06] px-1.5 py-0.5 rounded">close {org?.name?.toLowerCase?.() || 'my account'}</span> to confirm.</p>
                <input type="text" value={confirmText} onChange={e => setConfirmText(e.target.value)} placeholder={`close ${org?.name?.toLowerCase?.() || 'my account'}`}
                  className="w-full px-3.5 py-2.5 rounded-xl glass-input text-[14px] font-mono text-t1 outline-none transition focus:border-red/40 focus:ring-1 focus:ring-red/20" />
                {closeError && <p className="text-[13px] text-red">{closeError}</p>}
                <div className="flex items-center gap-3 pt-2">
                  <button onClick={confirmCloseAccount} disabled={confirmText !== `close ${org?.name?.toLowerCase?.() || 'my account'}` || closeLoading}
                    className="px-5 py-2.5 rounded-xl bg-red text-white text-[13px] font-semibold hover:bg-red/90 transition-all flex items-center gap-2 disabled:opacity-30 disabled:cursor-not-allowed">
                    {closeLoading ? <div className="w-4 h-4 border-2 border-white border-t-transparent rounded-full animate-spin" /> : <Trash2 size={14} />}
                    Close Account Permanently
                  </button>
                  <button onClick={() => setCloseStep('survey')} className="px-5 py-2.5 rounded-xl border border-border text-[13px] font-semibold text-t2 hover:text-t1 transition">Back</button>
                </div>
              </div>
            )}

            {/* STEP 4: DONE */}
            {closeStep === 'done' && (
              <div className="mt-5 pt-5 border-t border-red/10 text-center py-8">
                <div className="w-16 h-16 rounded-2xl bg-green/[0.08] flex items-center justify-center mx-auto mb-4"><Check size={28} className="text-green" /></div>
                <h4 className="text-[18px] font-bold mb-2">Account closed</h4>
                <p className="text-[14px] text-t2 max-w-md mx-auto mb-4">Your subscription has been canceled and your team deactivated. Data retained for 30 days.</p>
                {closeResult?.refund_issued && (
                  <div className="inline-flex items-center gap-2 px-4 py-2 rounded-xl bg-green/[0.06] border border-green/[0.1] text-[14px] font-mono mb-4">
                    <CreditCard size={14} className="text-green" /><span>Refund of <b className="text-green">{closeResult.refund_amount}</b> issued</span>
                  </div>
                )}
                <div><button onClick={() => { supabase.auth.signOut(); navigate('/') }} className="px-6 py-3 rounded-xl border border-border text-[14px] font-semibold text-t2 hover:text-t1 transition">Sign Out & Return Home</button></div>
              </div>
            )}
          </div>
        </div>
      )}
    </div>
  )
}

/* ═══ Shared Components ═══ */
function SectionCard({ title, sub, children }) {
  return (
    <div className="glass-card rounded-2xl p-6 terminal-scanlines relative hover:border-border-hover active:border-border-hover transition-colors">
      <div className="mb-5">
        <span className="terminal-label">{title.toUpperCase()}</span>
        {sub && <p className="text-[13px] text-t2 mt-1">{sub}</p>}
      </div>
      {children}
    </div>
  )
}

function Field({ label, value, onChange, placeholder, disabled, note }) {
  return (
    <div>
      <label className="text-[13px] text-t2 font-semibold uppercase tracking-[0.08em] mb-1.5 block">{label}</label>
      <input
        type="text"
        value={value || ''}
        onChange={e => onChange?.(e.target.value)}
        placeholder={placeholder}
        disabled={disabled}
        className={`w-full px-3.5 py-2.5 rounded-xl glass-input text-[14px] font-mono text-t1 outline-none transition
          focus:border-cyan/40 focus:ring-1 focus:ring-cyan/20
          placeholder:text-t3
          ${disabled ? 'opacity-50 cursor-not-allowed' : 'hover:border-border-hover'}`}
      />
      {note && <p className="text-[12px] text-t3 mt-1">{note}</p>}
    </div>
  )
}

function SelectField({ label, value, onChange, options, placeholder, disabled }) {
  const optionList = typeof options[0] === 'string' ? options.map(o => ({ label: o, value: o })) : options
  return (
    <div>
      <label className="text-[13px] text-t2 font-semibold uppercase tracking-[0.08em] mb-1.5 block">{label}</label>
      <select
        value={value || ''}
        onChange={e => onChange?.(e.target.value)}
        disabled={disabled}
        className={`w-full px-3.5 py-2.5 rounded-xl glass-input text-[14px] font-mono text-t1 outline-none transition cursor-pointer
          focus:border-cyan/40 focus:ring-1 focus:ring-cyan/20
          ${disabled ? 'opacity-50 cursor-not-allowed' : 'hover:border-border-hover'}`}>
        {placeholder && <option value="">{placeholder}</option>}
        {optionList.map(o => <option key={o.value} value={o.value}>{o.label}</option>)}
      </select>
    </div>
  )
}

function Toggle({ label, sub, value, onChange, disabled }) {
  return (
    <div className="flex items-center justify-between py-2">
      <div><p className="text-[14px] font-medium">{label}</p><p className="text-[13px] text-t2">{sub}</p></div>
      <button onClick={() => !disabled && onChange?.(!value)} disabled={disabled}
        className={`relative w-11 h-6 rounded-full transition-colors ${disabled ? 'opacity-40 cursor-not-allowed' : 'cursor-pointer'} ${value ? 'bg-cyan' : 'bg-border'}`}>
        <span className={`absolute top-1 w-4 h-4 rounded-full bg-white shadow-sm transition-transform ${value ? 'left-6' : 'left-1'}`} />
      </button>
    </div>
  )
}

function SaveButton({ saving, saved, onClick }) {
  return (
    <button onClick={onClick} disabled={saving}
      className="flex items-center gap-2 px-5 py-2.5 rounded-xl bg-gradient-to-r from-cyan/90 to-cyan/70 text-void text-[14px] font-semibold glow-sm hover:glow-md hover:-translate-y-px active:scale-[0.98] active:translate-y-0 transition-all disabled:opacity-50">
      {saving ? <div className="w-4 h-4 border-2 border-void border-t-transparent rounded-full animate-spin" /> :
        saved ? <><Check size={15} /> Saved</> : <><Save size={15} /> Save Changes</>}
    </button>
  )
}
