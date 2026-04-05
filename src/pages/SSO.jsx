import { useState, useEffect } from 'react'
import { useAuth } from '@/hooks/useAuth'
import {
  Shield, Key, Building2, Check, AlertTriangle, ExternalLink, Copy, RefreshCw,
  Lock, Users, Globe, ChevronRight, Fingerprint, Settings, Zap, Monitor, Smartphone,
  ShieldCheck, ShieldAlert, Clock, Eye
} from 'lucide-react'

/* Provider icons — 2-letter monogram on brand color instead of emoji */
const PROVIDERS = [
  { id: 'okta', name: 'Okta', initials: 'OK', color: '#00297A', desc: 'Okta Workforce Identity', protocols: ['SAML 2.0', 'OIDC'] },
  { id: 'azure', name: 'Azure AD', initials: 'AZ', color: '#0078D4', desc: 'Microsoft Entra ID', protocols: ['SAML 2.0', 'OIDC'] },
  { id: 'onelogin', name: 'OneLogin', initials: 'OL', color: '#24292F', desc: 'OneLogin by OneIdentity', protocols: ['SAML 2.0'] },
  { id: 'google', name: 'Google Workspace', initials: 'GW', color: '#4285F4', desc: 'Google Cloud Identity', protocols: ['SAML 2.0', 'OIDC'] },
  { id: 'jumpcloud', name: 'JumpCloud', initials: 'JC', color: '#53B84C', desc: 'JumpCloud Directory', protocols: ['SAML 2.0'] },
  { id: 'custom', name: 'Custom SAML', initials: 'SP', color: '#506680', desc: 'Any SAML 2.0 provider', protocols: ['SAML 2.0'] },
]

const MFA_METHODS = [
  { id: 'totp', name: 'Authenticator App', desc: 'Google Authenticator, Authy, 1Password', icon: Fingerprint, enabled: true },
  { id: 'sms', name: 'SMS Verification', desc: 'One-time code via text message', icon: Smartphone, enabled: false },
  { id: 'email', name: 'Email OTP', desc: 'One-time code sent to email', icon: Globe, enabled: true },
  { id: 'hardware', name: 'Hardware Key', desc: 'YubiKey, Titan Security Key (FIDO2)', icon: Key, enabled: false },
]

export default function SSO() {
  const { org, profile, enrollMFA, verifyMFA, unenrollMFA, listMFAFactors, signInWithSSO, logAuditEvent, isAdmin } = useAuth()
  const [activeTab, setActiveTab] = useState('sso')
  const [selectedProvider, setSelectedProvider] = useState(null)
  const [configStep, setConfigStep] = useState(0)
  const [copied, setCopied] = useState(null)
  const [ssoEnabled, setSsoEnabled] = useState(false)
  const [enforceSSO, setEnforceSSO] = useState(false)
  const [mfaFactors, setMfaFactors] = useState([])
  const [mfaEnrolling, setMfaEnrolling] = useState(false)
  const [mfaQR, setMfaQR] = useState(null)
  const [mfaSecret, setMfaSecret] = useState(null)
  const [mfaFactorId, setMfaFactorId] = useState(null)
  const [mfaCode, setMfaCode] = useState('')
  const [mfaError, setMfaError] = useState(null)
  const [mfaLoading, setMfaLoading] = useState(false)
  const [toast, setToast] = useState(null)

  useEffect(() => { document.title = 'SSO & Security \u2014 Vaultline' }, [])

  // Load MFA factors on mount and when tab changes
  useEffect(() => {
    if (activeTab === 'mfa') loadMFAFactors()
  }, [activeTab])

  async function loadMFAFactors() {
    const { data } = await listMFAFactors()
    if (data) setMfaFactors(data.totp || [])
  }

  async function handleEnrollMFA() {
    setMfaEnrolling(true); setMfaError(null)
    const { data, error } = await enrollMFA()
    if (error) { setMfaError(error.message); setMfaEnrolling(false); return }
    setMfaQR(data.totp.qr_code)
    setMfaSecret(data.totp.secret)
    setMfaFactorId(data.id)
  }

  async function handleVerifyMFA() {
    if (mfaCode.length !== 6) return
    setMfaLoading(true); setMfaError(null)
    const { error } = await verifyMFA(mfaFactorId, mfaCode)
    if (error) { setMfaError(error.message); setMfaLoading(false); return }
    setMfaEnrolling(false); setMfaQR(null); setMfaSecret(null); setMfaCode('')
    setMfaLoading(false)
    await loadMFAFactors()
    setToast('MFA enrolled successfully'); setTimeout(() => setToast(null), 3000)
  }

  async function handleUnenrollMFA(factorId) {
    const { error } = await unenrollMFA(factorId)
    if (error) { setToast('Failed to unenroll: ' + error.message) }
    else { setToast('MFA factor removed'); await loadMFAFactors() }
    setTimeout(() => setToast(null), 3000)
  }

  async function handleTestSSO() {
    const domain = org?.slug || org?.name?.toLowerCase().replace(/\s+/g, '-')
    if (!domain) { setToast('Organization domain required'); setTimeout(() => setToast(null), 3000); return }
    const { data, error } = await signInWithSSO(domain)
    if (error) { setToast('SSO test failed: ' + error.message); setTimeout(() => setToast(null), 4000) }
    else if (data?.url) { window.location.href = data.url }
  }

  const entityId = `https://www.vaultline.app/auth/saml/${org?.id || 'org'}`
  const acsUrl = `https://cosbviiihkxjdqcpksgv.supabase.co/auth/v1/sso/saml/acs`
  const metadataUrl = `https://cosbviiihkxjdqcpksgv.supabase.co/auth/v1/sso/saml/metadata`

  function copy(text, label) {
    navigator.clipboard.writeText(text)
    setCopied(label)
    setTimeout(() => setCopied(null), 2000)
  }

  const TABS = [
    { id: 'sso', label: 'Single Sign-On', icon: Shield, count: ssoEnabled ? 1 : 0 },
    { id: 'mfa', label: 'Multi-Factor Auth', icon: Fingerprint, count: MFA_METHODS.filter(m => m.enabled).length },
    { id: 'policies', label: 'Security Policies', icon: Lock, count: 6 },
    { id: 'sessions', label: 'Active Sessions', icon: Monitor, count: 2 },
  ]

  return (
    <div className="max-w-[920px] mx-auto space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-3">
          <div className="w-11 h-11 rounded-xl bg-amber/[0.08] border border-amber/[0.1] flex items-center justify-center">
            <ShieldCheck size={20} className="text-amber" />
          </div>
          <div>
            <span className="terminal-label">SSO & SECURITY</span>
            <p className="text-[12px] text-t3 font-mono">Enterprise identity & access controls</p>
          </div>
        </div>
        {/* Security score */}
        <div className="flex items-center gap-3 px-4 py-2.5 rounded-xl glass-card">
          <div className="w-8 h-8 rounded-lg bg-green/[0.08] flex items-center justify-center">
            <ShieldCheck size={15} className="text-green" />
          </div>
          <div>
            <p className="text-[11px] text-t3 font-mono uppercase tracking-wider">Security Score</p>
            <p className="font-mono text-[18px] font-black text-green terminal-data">82/100</p>
          </div>
        </div>
      </div>

      {/* Tabs — terminal style */}
      <div className="glass-card rounded-xl overflow-hidden terminal-scanlines relative">
        <div className="relative z-[2]"><div className="flex items-center gap-0 border-b border-border">
          {TABS.map(t => (
            <button key={t.id} onClick={() => setActiveTab(t.id)}
              className={`relative flex items-center gap-2 px-5 py-3.5 text-[13px] font-mono font-medium transition-colors flex-1 justify-center ${
                activeTab === t.id ? 'text-cyan' : 'text-t3 hover:text-t2 active:text-t2'
              }`}>
              <t.icon size={14} strokeWidth={activeTab === t.id ? 2.2 : 1.8} />
              {t.label}
              {t.count > 0 && (
                <span className={`text-[10px] px-1.5 py-0.5 rounded-md font-mono font-bold ${
                  activeTab === t.id ? 'bg-cyan/[0.08] text-cyan' : 'bg-deep text-t3'
                }`}>{t.count}</span>
              )}
              {activeTab === t.id && <div className="absolute bottom-0 left-4 right-4 h-[2px] bg-cyan rounded-t shadow-[0_0_6px_rgba(34,211,238,0.3)]" />}
            </button>
          ))}
        </div>

        <div className="p-6">
          {/* SSO TAB */}
          {activeTab === 'sso' && (
            <div className="space-y-5">
              {/* Status card */}
              <div className={`rounded-xl p-5 border ${ssoEnabled ? 'bg-green/[0.02] border-green/[0.12]' : 'bg-deep border-border'}`}>
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-4">
                    <div className={`w-12 h-12 rounded-xl flex items-center justify-center ${ssoEnabled ? 'bg-green/[0.08]' : 'bg-amber/[0.06]'}`}>
                      {ssoEnabled ? <ShieldCheck size={22} className="text-green" /> : <ShieldAlert size={22} className="text-amber" />}
                    </div>
                    <div>
                      <h3 className="text-[15px] font-bold">{ssoEnabled ? 'SSO Active' : 'SSO Not Configured'}</h3>
                      <p className="text-[13px] text-t3 mt-0.5">{ssoEnabled ? 'Authenticating via identity provider' : 'Set up single sign-on for your organization'}</p>
                    </div>
                  </div>
                  {isAdmin && (
                    <button onClick={() => setSsoEnabled(!ssoEnabled)}
                      className={`relative w-12 h-6 rounded-full transition-colors ${ssoEnabled ? 'bg-green' : 'bg-border'}`}>
                      <span className={`absolute top-1 w-4 h-4 rounded-full bg-white shadow-sm transition-transform ${ssoEnabled ? 'left-7' : 'left-1'}`} />
                    </button>
                  )}
                </div>
              </div>

              {/* Enforce SSO */}
              {ssoEnabled && (
                <div className="rounded-xl p-4 border border-amber/[0.12] bg-amber/[0.02] flex items-center justify-between">
                  <div className="flex items-center gap-3">
                    <AlertTriangle size={16} className="text-amber shrink-0" />
                    <div>
                      <p className="text-[13px] font-semibold">Enforce SSO for all members</p>
                      <p className="text-[12px] text-t3">Password login disabled. Only SSO allowed.</p>
                    </div>
                  </div>
                  <button onClick={() => setEnforceSSO(!enforceSSO)}
                    className={`relative w-11 h-6 rounded-full transition-colors ${enforceSSO ? 'bg-amber' : 'bg-border'}`}>
                    <span className={`absolute top-1 w-4 h-4 rounded-full bg-white shadow-sm transition-transform ${enforceSSO ? 'left-6' : 'left-1'}`} />
                  </button>
                </div>
              )}

              {/* SP Details */}
              <div className="rounded-xl border border-border p-5">
                <div className="flex items-center gap-2 mb-4">
                  <span className="terminal-label">SP CONFIG</span>
                </div>
                <div className="space-y-3">
                  {[
                    { label: 'Entity ID (Issuer)', value: entityId },
                    { label: 'ACS URL (Reply URL)', value: acsUrl },
                    { label: 'Metadata URL', value: metadataUrl },
                  ].map(f => (
                    <div key={f.label}>
                      <label className="text-[11px] text-t3 font-mono font-semibold uppercase tracking-wider block mb-1">{f.label}</label>
                      <div className="flex items-center gap-2">
                        <code className="flex-1 glass-input px-3.5 py-2.5 rounded-lg font-mono text-[12px] text-t2 truncate">{f.value}</code>
                        <button onClick={() => copy(f.value, f.label)}
                          className="p-2.5 rounded-lg border border-border hover:border-cyan/20 text-t3 hover:text-cyan active:text-cyan transition shrink-0">
                          {copied === f.label ? <Check size={14} className="text-green" /> : <Copy size={14} />}
                        </button>
                      </div>
                    </div>
                  ))}
                </div>
              </div>

              {/* Provider grid */}
              <div>
                <div className="flex items-center gap-2 mb-3">
                  <span className="terminal-label">IdP PROVIDERS</span>
                  <span className="text-[11px] font-mono text-t3">{PROVIDERS.length} supported</span>
                </div>
                <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-3">
                  {PROVIDERS.map(p => (
                    <button key={p.id} onClick={() => { setSelectedProvider(p.id === selectedProvider ? null : p.id); setConfigStep(1) }}
                      className={`flex items-center gap-3 p-4 rounded-xl border text-left transition-all hover:-translate-y-px active:scale-[0.98] ${
                        selectedProvider === p.id
                          ? 'border-cyan/[0.2] bg-cyan/[0.03] shadow-[0_0_12px_rgba(34,211,238,0.04)]'
                          : 'border-border hover:border-border-hover'
                      }`}>
                      <div className="w-10 h-10 rounded-xl flex items-center justify-center text-[12px] font-extrabold text-white shrink-0"
                        style={{ background: p.color }}>
                        {p.initials}
                      </div>
                      <div className="min-w-0">
                        <p className="text-[13px] font-semibold text-t1">{p.name}</p>
                        <p className="text-[11px] text-t3 truncate">{p.desc}</p>
                        <div className="flex items-center gap-1 mt-1">
                          {p.protocols.map(pr => (
                            <span key={pr} className="text-[9px] font-mono font-bold px-1.5 py-0.5 rounded bg-deep text-t3">{pr}</span>
                          ))}
                        </div>
                      </div>
                    </button>
                  ))}
                </div>
              </div>

              {/* Config wizard */}
              {selectedProvider && (
                <div className="rounded-xl border border-border p-5">
                  <div className="flex items-center gap-2 mb-4">
                    <span className="terminal-label">SETUP WIZARD</span>
                    <span className="text-[11px] font-mono text-t3">Step {configStep}/5</span>
                  </div>
                  <div className="space-y-2">
                    {[
                      { step: 1, title: 'Create SAML App', desc: `Create a new SAML application in ${PROVIDERS.find(p => p.id === selectedProvider)?.name}` },
                      { step: 2, title: 'Configure SP Details', desc: 'Paste Entity ID and ACS URL into the application settings' },
                      { step: 3, title: 'Upload IdP Metadata', desc: 'Download and paste the IdP metadata XML URL' },
                      { step: 4, title: 'Attribute Mapping', desc: 'Map email, first_name, last_name to directory schema' },
                      { step: 5, title: 'Test Connection', desc: 'Run a test login to verify the SAML flow' },
                    ].map(s => (
                      <div key={s.step} className={`flex items-start gap-3 p-3 rounded-lg transition ${s.step <= configStep ? 'bg-deep' : ''}`}>
                        <div className={`w-7 h-7 rounded-lg flex items-center justify-center text-[12px] font-mono font-bold shrink-0 ${
                          s.step < configStep ? 'bg-green/[0.08] text-green' : s.step === configStep ? 'bg-cyan/[0.08] text-cyan' : 'bg-deep text-t3 border border-border'
                        }`}>
                          {s.step < configStep ? <Check size={12} /> : s.step}
                        </div>
                        <div>
                          <p className="text-[13px] font-semibold text-t1">{s.title}</p>
                          <p className="text-[12px] text-t3">{s.desc}</p>
                        </div>
                      </div>
                    ))}
                  </div>
                  <div className="mt-4 pt-4 border-t border-border">
                    <label className="text-[11px] text-t3 font-mono font-semibold uppercase tracking-wider block mb-1.5">IdP Metadata URL</label>
                    <div className="flex gap-2">
                      <input placeholder="https://your-idp.com/app/.../sso/saml/metadata"
                        className="flex-1 glass-input px-3.5 py-2.5 rounded-lg text-[13px] text-t1 outline-none focus:border-cyan/40 placeholder:text-t3" />
                      <button onClick={() => setConfigStep(Math.min(5, configStep + 1))}
                        className="px-4 py-2.5 rounded-lg bg-gradient-to-r from-cyan/90 to-cyan/70 text-void text-[13px] font-semibold hover:-translate-y-px active:scale-[0.98] transition-all">
                        {configStep < 5 ? 'Next Step' : 'Save Configuration'}
                      </button>
                    </div>
                    {configStep >= 5 ? (
                      <button onClick={handleTestSSO}
                        className="mt-3 w-full py-2.5 rounded-lg border border-cyan/[0.15] text-cyan text-[13px] font-mono font-semibold hover:bg-cyan/[0.04] active:scale-[0.98] transition-all flex items-center justify-center gap-2">
                        <ShieldCheck size={14} />{' '}Test SSO Connection
                      </button>
                    ) : null}
                    </div>
                  </div>
              )}
            </div>
          )}

          {/* MFA TAB */}
          {activeTab === 'mfa' && (
            <div className="space-y-5">
              <div className="flex items-center gap-2 mb-1">
                <span className="terminal-label">TOTP AUTHENTICATOR</span>
                <span className="text-[11px] font-mono text-t3">{mfaFactors.filter(f => f.status === 'verified').length} enrolled</span>
              </div>

              {/* Enrolled factors */}
              {mfaFactors.filter(f => f.status === 'verified').map(f => (
                <div key={f.id} className="flex items-center justify-between p-4 rounded-xl border border-green/[0.1] bg-green/[0.01]">
                  <div className="flex items-center gap-3">
                    <div className="w-10 h-10 rounded-xl flex items-center justify-center bg-green/[0.06] text-green"><Fingerprint size={18} /></div>
                    <div>
                      <p className="text-[14px] font-semibold text-t1">{f.friendly_name || 'Authenticator App'}</p>
                      <p className="text-[12px] text-t3 font-mono">Enrolled {new Date(f.created_at).toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' })}</p>
                    </div>
                  </div>
                  <div className="flex items-center gap-2.5">
                    <span className="px-2 py-0.5 rounded-md text-[11px] font-mono font-bold bg-green/[0.06] text-green">ACTIVE</span>
                    {isAdmin && <button onClick={() => handleUnenrollMFA(f.id)} className="text-[12px] text-red/70 hover:text-red font-mono font-semibold px-2 py-1 rounded-lg hover:bg-red/[0.04] transition">Remove</button>}
                  </div>
                </div>
              ))}

              {/* Enrollment flow */}
              {mfaEnrolling && mfaQR ? (
                <div className="glass-card rounded-xl p-5 space-y-4">
                  <p className="text-[14px] font-semibold">Scan this QR code with your authenticator app</p>
                  <div className="flex items-start gap-5">
                    <img src={mfaQR} alt="MFA QR Code" className="w-[160px] h-[160px] rounded-lg border border-border" />
                    <div className="flex-1 space-y-3">
                      <div>
                        <label className="text-[11px] text-t3 font-mono uppercase tracking-wider block mb-1">Manual Entry Key</label>
                        <code className="block glass-input px-3 py-2 rounded-lg text-[12px] font-mono text-t2 break-all">{mfaSecret}</code>
                      </div>
                      <div>
                        <label className="text-[11px] text-t3 font-mono uppercase tracking-wider block mb-1">Verification Code</label>
                        <div className="flex gap-2">
                          <input value={mfaCode} onChange={e => setMfaCode(e.target.value.replace(/\D/g, '').slice(0, 6))}
                            placeholder="000000" maxLength={6}
                            className="flex-1 glass-input px-3.5 py-2.5 rounded-lg text-[16px] font-mono text-t1 text-center tracking-[0.3em] outline-none focus:border-cyan/40" />
                          <button onClick={handleVerifyMFA} disabled={mfaCode.length !== 6 || mfaLoading}
                            className="px-4 py-2.5 rounded-lg bg-gradient-to-r from-cyan/90 to-cyan/70 text-void text-[13px] font-semibold hover:-translate-y-px active:scale-[0.98] transition-all disabled:opacity-50">
                            {mfaLoading ? 'Verifying...' : 'Verify'}
                          </button>
                        </div>
                      </div>
                      {mfaError && <p className="text-[12px] text-red font-mono">{mfaError}</p>}
                    </div>
                  </div>
                  <button onClick={() => { setMfaEnrolling(false); setMfaQR(null); setMfaSecret(null); setMfaCode('') }}
                    className="text-[12px] text-t3 hover:text-t1 font-mono transition">Cancel enrollment</button>
                </div>
              ) : !mfaFactors.some(f => f.status === 'verified') && (
                <button onClick={handleEnrollMFA}
                  className="w-full py-3.5 rounded-xl border border-cyan/[0.15] text-cyan text-[13px] font-mono font-semibold hover:bg-cyan/[0.04] active:scale-[0.98] transition-all flex items-center justify-center gap-2">
                  <Fingerprint size={15} /> Enroll Authenticator App
                </button>
              )}

              <div className="rounded-xl p-4 border border-amber/[0.1] bg-amber/[0.02] flex items-start gap-3">
                <ShieldAlert size={15} className="text-amber shrink-0 mt-0.5" />
                <div>
                  <p className="text-[13px] font-semibold">Require MFA for all members</p>
                  <p className="text-[12px] text-t3">When enabled, members must enroll MFA within 7 days or lose access.</p>
                </div>
              </div>
            </div>
          )}

          {/* POLICIES TAB */}
          {activeTab === 'policies' && (
            <div className="space-y-5">
              <div className="flex items-center gap-2 mb-1">
                <span className="terminal-label">SECURITY POLICIES</span>
              </div>
              <div className="space-y-0 rounded-xl border border-border overflow-hidden">
                {[
                  { label: 'Password Minimum Length', value: '8 characters', icon: Key },
                  { label: 'Password Complexity', value: 'Upper + number required', icon: Lock },
                  { label: 'Session Timeout', value: '30 min idle', icon: Clock },
                  { label: 'Max Login Attempts', value: '5 before lockout', icon: ShieldAlert },
                  { label: 'IP Allowlist', value: 'All IPs allowed', icon: Globe },
                  { label: 'Data Export Controls', value: 'Admins & Owners only', icon: Eye },
                ].map((p, i) => (
                  <div key={p.label} className={`flex items-center justify-between px-5 py-4 hover:bg-deep active:bg-deep transition ${i < 5 ? 'border-b border-border' : ''}`}>
                    <div className="flex items-center gap-3">
                      <div className="w-8 h-8 rounded-lg bg-deep flex items-center justify-center text-t3">
                        <p.icon size={14} />
                      </div>
                      <p className="text-[14px] font-medium text-t1">{p.label}</p>
                    </div>
                    <div className="flex items-center gap-3">
                      <span className="text-[13px] text-t2 font-mono font-semibold terminal-data">{p.value}</span>
                      <button className="text-[12px] text-cyan font-semibold px-2.5 py-1 rounded-lg hover:bg-cyan/[0.06] active:bg-cyan/[0.06] transition">Edit</button>
                    </div>
                  </div>
                ))}
              </div>
            </div>
          )}

          {/* SESSIONS TAB */}
          {activeTab === 'sessions' && (
            <div className="space-y-5">
              <div className="flex items-center justify-between mb-1">
                <div className="flex items-center gap-2">
                  <span className="terminal-label">ACTIVE SESSIONS</span>
                  <span className="text-[11px] font-mono text-t3">2 devices</span>
                </div>
                <button className="text-[12px] text-red font-semibold px-3 py-1.5 rounded-lg border border-red/[0.1] hover:bg-red/[0.04] active:bg-red/[0.04] transition">Revoke All</button>
              </div>
              <div className="space-y-3">
                {[
                  { device: 'Chrome', os: 'macOS', ip: '73.xxx.xxx.42', location: 'Waterbury, CT', lastActive: 'Now', current: true, icon: Monitor },
                  { device: 'Safari', os: 'iOS', ip: '73.xxx.xxx.42', location: 'Waterbury, CT', lastActive: '2h ago', current: false, icon: Smartphone },
                ].map((s, i) => (
                  <div key={i} className={`flex items-center justify-between p-4 rounded-xl border transition ${
                    s.current ? 'border-green/[0.1] bg-green/[0.01]' : 'border-border'
                  }`}>
                    <div className="flex items-center gap-3">
                      <div className={`w-10 h-10 rounded-xl flex items-center justify-center ${
                        s.current ? 'bg-green/[0.06]' : 'bg-deep'
                      }`}>
                        <s.icon size={16} className={s.current ? 'text-green' : 'text-t3'} />
                      </div>
                      <div>
                        <div className="flex items-center gap-2">
                          <p className="text-[14px] font-semibold text-t1">{s.device} <span className="text-t3 font-normal">{s.os}</span></p>
                          {s.current && <span className="text-[10px] font-mono font-bold text-green bg-green/[0.06] px-1.5 py-0.5 rounded">CURRENT</span>}
                        </div>
                        <p className="text-[11px] text-t3 font-mono terminal-data">{s.ip} / {s.location}</p>
                      </div>
                    </div>
                    <div className="flex items-center gap-3">
                      <span className="text-[12px] text-t3 font-mono">{s.lastActive}</span>
                      {!s.current && (
                        <button className="text-[12px] text-red font-semibold px-2.5 py-1.5 rounded-lg border border-red/[0.1] hover:bg-red/[0.04] active:bg-red/[0.04] transition">Revoke</button>
                      )}
                    </div>
                  </div>
                ))}
              </div>
            </div>
          )}
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
