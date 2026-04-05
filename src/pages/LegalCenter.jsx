import { useState, useEffect } from 'react'
import { useSEO } from '@/hooks/useSEO'
import { Link } from 'react-router-dom'
import { supabase } from '@/lib/supabase'
import { safeInvoke } from '@/lib/safeInvoke'
import ThemeToggle from '@/components/ThemeToggle'
import {
  Shield, Eye, Lock, FileText, Globe, Check, AlertTriangle,
  ChevronRight, Loader2, ArrowRight, Cookie, Scale,
  UserX, Download, Send, Clock, Building2, ExternalLink
} from 'lucide-react'

const REQUEST_TYPES = [
  { value: 'do_not_sell', label: 'Do Not Sell My Personal Information', desc: 'Opt out of any sale of your personal information to third parties.' },
  { value: 'do_not_share', label: 'Do Not Share My Personal Information', desc: 'Opt out of sharing your data for cross-context behavioral advertising.' },
  { value: 'opt_out_targeted_ads', label: 'Opt Out of Targeted Advertising', desc: 'Stop targeted ads based on your activity across services.' },
  { value: 'access', label: 'Access My Data', desc: 'Request a copy of all personal information we hold about you.' },
  { value: 'delete', label: 'Delete My Data', desc: 'Request deletion of your personal information from our systems.' },
  { value: 'correct', label: 'Correct My Data', desc: 'Request correction of inaccurate personal information.' },
  { value: 'portability', label: 'Data Portability', desc: 'Receive your data in a structured, machine-readable format.' },
]

const REGULATIONS = [
  { value: 'ccpa', label: 'CCPA/CPRA (California)', deadline: '45 days' },
  { value: 'gdpr', label: 'GDPR (European Union)', deadline: '30 days' },
  { value: 'vcdpa', label: 'VCDPA (Virginia)', deadline: '45 days' },
  { value: 'cpa', label: 'CPA (Colorado)', deadline: '45 days' },
  { value: 'ctdpa', label: 'CTDPA (Connecticut)', deadline: '45 days' },
  { value: 'pipeda', label: 'PIPEDA (Canada)', deadline: '30 days' },
  { value: 'lgpd', label: 'LGPD (Brazil)', deadline: '15 days' },
]

export default function LegalCenter() {
  const [tab, setTab] = useState('rights') // rights | dnsspi | cookies | subprocessors | documents
  const [loading, setLoading] = useState(false)
  // DNSSPI
  const [dnsspiEmail, setDnsspiEmail] = useState('')
  const [dnsspiStatus, setDnsspiStatus] = useState(null)
  const [dnsspiSubmitting, setDnsspiSubmitting] = useState(false)
  const [dnsspiResult, setDnsspiResult] = useState(null)
  // Privacy Request
  const [prEmail, setPrEmail] = useState('')
  const [prName, setPrName] = useState('')
  const [prType, setPrType] = useState('access')
  const [prRegulation, setPrRegulation] = useState('ccpa')
  const [prSubmitting, setPrSubmitting] = useState(false)
  const [prResult, setPrResult] = useState(null)
  // Cookie prefs
  const [cookiePrefs, setCookiePrefs] = useState({ functional: true, analytics: false, advertising: false, social_media: false })
  const [cookieSaving, setCookieSaving] = useState(false)
  const [cookieSaved, setCookieSaved] = useState(false)
  // GPC
  const [gpcDetected, setGpcDetected] = useState(false)
  // Subprocessors
  const [subprocessors, setSubprocessors] = useState([])
  // Legal docs
  const [legalDocs, setLegalDocs] = useState([])
  useSEO({ title: 'Legal & Privacy Center', description: 'Vaultline legal center: privacy policy, terms, cookie preferences, Do Not Sell or Share, subprocessor list, and privacy rights portal.', canonical: '/legal' })

  useEffect(() => {
    // title set by useSEO
    // Detect GPC
    if (navigator.globalPrivacyControl) setGpcDetected(true)
    // Load subprocessors
    safeInvoke('legal-ops', { action: 'list_subprocessors' }).then(({ data }) => setSubprocessors(data?.subprocessors || []))
    // Load legal docs
    safeInvoke('legal-ops', { action: 'list_legal_docs' }).then(({ data }) => setLegalDocs(data?.documents || []))
  }, [])

  async function checkDnsspi() {
    if (!dnsspiEmail) return
    setLoading(true)
    const { data } = await safeInvoke('legal-ops', { action: 'dnsspi_status', email: dnsspiEmail })
    setDnsspiStatus(data)
    setLoading(false)
  }

  async function submitDnsspi() {
    setDnsspiSubmitting(true)
    const { data } = await safeInvoke('legal-ops', {
      body: { action: 'dnsspi_opt_out', email: dnsspiEmail, method: gpcDetected ? 'gpc_signal' : 'web_form' },
    })
    setDnsspiResult(data)
    setDnsspiSubmitting(false)
  }

  async function submitPrivacyRequest(e) {
    e.preventDefault()
    setPrSubmitting(true)
    const { data } = await safeInvoke('legal-ops', {
      body: { action: 'submit_privacy_request', requester_email: prEmail, requester_name: prName, request_type: prType, regulation: prRegulation },
    })
    setPrResult(data)
    setPrSubmitting(false)
  }

  async function saveCookies() {
    setCookieSaving(true)
    await safeInvoke('legal-ops', {
      body: { action: 'save_cookie_prefs', visitor_id: `web_${Date.now()}`, ...cookiePrefs },
    })
    setCookieSaving(false)
    setCookieSaved(true)
    setTimeout(() => setCookieSaved(false), 3000)
  }

  return (
    <div className="min-h-screen bg-void">
      <div className="fixed top-5 right-5 z-50"><ThemeToggle /></div>
      <div className="absolute w-[800px] h-[800px] top-[-300px] left-[-200px] bg-[radial-gradient(circle,rgba(34,211,238,0.04)_0%,transparent_60%)] pointer-events-none" />

      <nav className="relative z-10 flex items-center justify-between px-8 py-5 max-w-5xl mx-auto">
        <Link to="/" className="flex items-center gap-2">
          <img src="/logo.svg" alt="Vaultline" className="w-8 h-8 rounded-lg" />
          <span className="font-display text-lg font-extrabold">Vault<span className="bg-gradient-to-r from-cyan to-purple bg-clip-text text-transparent">line</span></span>
        </Link>
        <div className="flex items-center gap-3 text-[13px]">
          <Link to="/privacy" className="text-t2 hover:text-t1 transition">Privacy Policy</Link>
          <Link to="/terms" className="text-t2 hover:text-t1 transition">Terms</Link>
        </div>
      </nav>

      <div className="relative z-10 max-w-5xl mx-auto px-6 pb-20">
        <div className="text-center mb-10 pt-6">
          <span className="text-[11px] font-mono font-bold uppercase tracking-[0.15em] text-cyan">LEGAL & PRIVACY CENTER</span>
          <h1 className="font-display text-3xl font-black tracking-tight mt-3 mb-3">Your Data, Your Rights</h1>
          <p className="text-[15px] text-t3 max-w-2xl mx-auto">Exercise your privacy rights, manage cookie preferences, opt out of data sales and sharing, and review our data practices — all in one place.</p>
          {gpcDetected && (
            <div className="inline-flex items-center gap-2 mt-4 px-4 py-2 rounded-xl bg-green/[0.06] border border-green/[0.1] text-green text-[12px] font-mono">
              <Shield size={14} /> Global Privacy Control detected — advertising and sharing auto-disabled
            </div>
          )}
        </div>

        {/* Tabs */}
        <div className="flex items-center gap-1 mb-8 border-b border-border/30 pb-px overflow-x-auto">
          {[
            { id: 'rights', label: 'Privacy Rights', icon: Scale },
            { id: 'dnsspi', label: 'Do Not Sell/Share', icon: UserX },
            { id: 'cookies', label: 'Cookie Preferences', icon: Cookie },
            { id: 'subprocessors', label: 'Subprocessors', icon: Building2 },
            { id: 'documents', label: 'Legal Documents', icon: FileText },
          ].map(t => {
            const Icon = t.icon
            return (
              <button key={t.id} onClick={() => setTab(t.id)}
                className={`px-4 py-2.5 text-[12px] font-semibold transition-all rounded-t-lg flex items-center gap-1.5 whitespace-nowrap ${
                  tab === t.id ? 'text-cyan border-b-2 border-cyan bg-cyan/[0.04]' : 'text-t3 hover:text-t1'
                }`}>
                <Icon size={13} /> {t.label}
              </button>
            )
          })}
        </div>

        {/* ═══ PRIVACY RIGHTS ═══ */}
        {tab === 'rights' && (
          <div className="max-w-2xl mx-auto space-y-6">
            {!prResult ? (
              <form onSubmit={submitPrivacyRequest} className="glass-card rounded-2xl p-8 space-y-5">
                <div className="text-center mb-4">
                  <Scale size={28} className="text-cyan mx-auto mb-3" />
                  <h2 className="font-display text-xl font-bold">Submit a Privacy Rights Request</h2>
                  <p className="text-[13px] text-t3 mt-2">Under CCPA, GDPR, and other privacy laws, you have the right to access, correct, delete, and port your personal data.</p>
                </div>

                <div className="grid grid-cols-2 gap-3">
                  <input value={prEmail} onChange={e => setPrEmail(e.target.value)} required type="email" placeholder="Your email address"
                    className="px-4 py-3 rounded-xl glass-input text-t1 text-[14px] outline-none focus:border-cyan/40 transition placeholder:text-t3" />
                  <input value={prName} onChange={e => setPrName(e.target.value)} placeholder="Full name (optional)"
                    className="px-4 py-3 rounded-xl glass-input text-t1 text-[14px] outline-none focus:border-cyan/40 transition placeholder:text-t3" />
                </div>

                <div>
                  <label className="text-[10px] font-mono text-t3 uppercase tracking-wider mb-2 block">What would you like to do?</label>
                  <div className="space-y-2">
                    {REQUEST_TYPES.map(rt => (
                      <button key={rt.value} type="button" onClick={() => setPrType(rt.value)}
                        className={`w-full text-left p-4 rounded-xl border transition-all ${
                          prType === rt.value ? 'bg-cyan/[0.04] border-cyan/[0.15]' : 'bg-deep/50 border-border/30 hover:border-border'
                        }`}>
                        <div className="flex items-center gap-3">
                          <div className={`w-4 h-4 rounded-full border-2 flex items-center justify-center ${prType === rt.value ? 'border-cyan bg-cyan' : 'border-border'}`}>
                            {prType === rt.value && <Check size={8} className="text-void" />}
                          </div>
                          <div>
                            <p className={`text-[13px] ${prType === rt.value ? 'text-cyan font-medium' : 'text-t1'}`}>{rt.label}</p>
                            <p className="text-[11px] text-t3">{rt.desc}</p>
                          </div>
                        </div>
                      </button>
                    ))}
                  </div>
                </div>

                <div>
                  <label className="text-[10px] font-mono text-t3 uppercase tracking-wider mb-2 block">Applicable regulation</label>
                  <select value={prRegulation} onChange={e => setPrRegulation(e.target.value)}
                    className="w-full px-4 py-3 rounded-xl glass-input text-t1 text-[13px] outline-none">
                    {REGULATIONS.map(r => <option key={r.value} value={r.value}>{r.label} (response within {r.deadline})</option>)}
                  </select>
                </div>

                <button type="submit" disabled={prSubmitting}
                  className="w-full py-3.5 rounded-xl bg-gradient-to-r from-cyan/90 to-cyan/70 text-void font-semibold text-[15px] shadow-[0_2px_12px_rgba(34,211,238,0.2)] hover:-translate-y-px transition-all disabled:opacity-50 flex items-center justify-center gap-2">
                  {prSubmitting ? <><Loader2 size={15} className="animate-spin" /> Submitting...</> : <><Send size={15} /> Submit Request</>}
                </button>

                <p className="text-[10px] text-t4 text-center">We will verify your identity before processing your request. This may take up to 48 hours.</p>
              </form>
            ) : (
              <div className="glass-card rounded-2xl p-8 text-center border-green/[0.12]">
                <Check size={32} className="text-green mx-auto mb-4" />
                <h2 className="font-display text-xl font-bold mb-2">Request Submitted</h2>
                <p className="text-[14px] text-t3 max-w-md mx-auto mb-4">{prResult.message}</p>
                <div className="flex items-center justify-center gap-2 text-[12px] font-mono text-t3">
                  <Clock size={12} /> Deadline: {prResult.due_date}
                </div>
                <button onClick={() => { setPrResult(null); setPrEmail(''); setPrName('') }}
                  className="mt-6 text-[12px] text-t3 hover:text-cyan transition">Submit another request</button>
              </div>
            )}
          </div>
        )}

        {/* ═══ DO NOT SELL OR SHARE ═══ */}
        {tab === 'dnsspi' && (
          <div className="max-w-2xl mx-auto space-y-6">
            <div className="glass-card rounded-2xl p-8">
              <div className="text-center mb-6">
                <UserX size={28} className="text-amber mx-auto mb-3" />
                <h2 className="font-display text-xl font-bold">Do Not Sell or Share My Personal Information</h2>
                <p className="text-[13px] text-t3 mt-2 max-w-lg mx-auto">
                  Under the California Consumer Privacy Act (CCPA/CPRA) and similar state laws, you have the right to opt out of the sale and sharing of your personal information.
                </p>
              </div>

              {!dnsspiResult ? (
                <div className="space-y-4">
                  <div className="p-4 rounded-xl bg-deep/50 border border-border/20">
                    <p className="text-[12px] text-t2 mb-3">When you opt out, Vaultline will:</p>
                    <div className="space-y-2">
                      {[
                        'Stop any sale of your personal information to third parties',
                        'Stop sharing your data for cross-context behavioral advertising',
                        'Disable targeted advertising based on your activity',
                        'Disable matched identifier communications',
                      ].map(item => (
                        <div key={item} className="flex items-start gap-2">
                          <Check size={12} className="text-green mt-0.5 flex-shrink-0" />
                          <span className="text-[12px] text-t2">{item}</span>
                        </div>
                      ))}
                    </div>
                    <p className="text-[11px] text-t4 mt-3">You will still receive essential service communications (billing, security alerts, etc.).</p>
                  </div>

                  <input value={dnsspiEmail} onChange={e => setDnsspiEmail(e.target.value)} type="email" placeholder="Enter your email address" required
                    className="w-full px-4 py-3 rounded-xl glass-input text-t1 text-[14px] outline-none focus:border-amber/40 transition placeholder:text-t3" />

                  <button onClick={submitDnsspi} disabled={dnsspiSubmitting || !dnsspiEmail}
                    className="w-full py-3.5 rounded-xl bg-gradient-to-r from-amber/90 to-amber/70 text-void font-semibold text-[15px] shadow-[0_2px_12px_rgba(251,191,36,0.2)] hover:-translate-y-px transition-all disabled:opacity-50 flex items-center justify-center gap-2">
                    {dnsspiSubmitting ? <><Loader2 size={15} className="animate-spin" /> Processing...</> : <><UserX size={15} /> Opt Out of Sale & Sharing</>}
                  </button>

                  <div className="text-center">
                    <a href="mailto:privacy@vaultline.app?subject=Do Not Sell Share" className="text-[11px] text-t3 hover:text-cyan transition">
                      Or email privacy@vaultline.app with subject "Do Not Sell Share"
                    </a>
                  </div>
                </div>
              ) : (
                <div className="p-6 rounded-xl bg-green/[0.03] border border-green/[0.1] text-center">
                  <Check size={28} className="text-green mx-auto mb-3" />
                  <h3 className="font-display text-lg font-bold mb-2">Opt-Out Confirmed</h3>
                  <p className="text-[13px] text-t3">{dnsspiResult.message}</p>
                  <button onClick={() => setDnsspiResult(null)} className="mt-4 text-[11px] text-t3 hover:text-cyan transition">Submit for another email</button>
                </div>
              )}
            </div>

            {/* GPC info */}
            <div className="glass-card rounded-xl p-5">
              <h3 className="text-[13px] font-bold text-t1 mb-2 flex items-center gap-2"><Globe size={14} className="text-cyan" /> Global Privacy Control (GPC)</h3>
              <p className="text-[12px] text-t3 mb-3">Vaultline recognizes and honors the Global Privacy Control signal. When we detect a GPC signal from your browser, we automatically opt you out of sale, sharing, and targeted advertising.</p>
              <div className="flex items-center gap-2">
                <span className={`text-[11px] font-mono font-bold px-2 py-1 rounded ${gpcDetected ? 'bg-green/[0.06] text-green' : 'bg-t3/[0.06] text-t3'}`}>
                  GPC Signal: {gpcDetected ? 'DETECTED ✓' : 'Not Detected'}
                </span>
              </div>
              <p className="text-[10px] text-t4 mt-2">Learn more at <a href="https://globalprivacycontrol.org" target="_blank" rel="noopener noreferrer" className="text-cyan hover:underline">globalprivacycontrol.org</a></p>
            </div>
          </div>
        )}

        {/* ═══ COOKIE PREFERENCES ═══ */}
        {tab === 'cookies' && (
          <div className="max-w-2xl mx-auto space-y-6">
            <div className="glass-card rounded-2xl p-8">
              <div className="text-center mb-6">
                <Cookie size={28} className="text-purple mx-auto mb-3" />
                <h2 className="font-display text-xl font-bold">Cookie Preferences</h2>
                <p className="text-[13px] text-t3 mt-2">Control which types of cookies Vaultline uses on your device.</p>
              </div>

              <div className="space-y-4">
                {[
                  { key: 'essential', label: 'Essential Cookies', desc: 'Required for the service to function. These cannot be disabled.', locked: true, value: true },
                  { key: 'functional', label: 'Functional Cookies', desc: 'Remember your preferences like theme, language, and sidebar state.', locked: false, value: cookiePrefs.functional },
                  { key: 'analytics', label: 'Analytics Cookies', desc: 'Help us understand how you use Vaultline to improve the experience.', locked: false, value: cookiePrefs.analytics },
                  { key: 'advertising', label: 'Advertising Cookies', desc: 'Used for marketing measurement. Not used for behavioral targeting.', locked: gpcDetected, value: gpcDetected ? false : cookiePrefs.advertising },
                  { key: 'social_media', label: 'Social Media Cookies', desc: 'Enable sharing features and social media integrations.', locked: gpcDetected, value: gpcDetected ? false : cookiePrefs.social_media },
                ].map(c => (
                  <div key={c.key} className="flex items-center justify-between p-4 rounded-xl bg-deep/50 border border-border/20">
                    <div className="flex-1">
                      <p className="text-[13px] font-medium text-t1">{c.label}</p>
                      <p className="text-[11px] text-t3 mt-0.5">{c.desc}</p>
                      {c.locked && c.key !== 'essential' && gpcDetected && (
                        <p className="text-[10px] text-green mt-1 flex items-center gap-1"><Shield size={9} /> Auto-disabled by GPC signal</p>
                      )}
                    </div>
                    <button
                      onClick={() => { if (!c.locked) setCookiePrefs(p => ({ ...p, [c.key]: !p[c.key] })) }}
                      disabled={c.locked}
                      className={`w-11 h-6 rounded-full relative transition-all ${c.value ? 'bg-cyan' : 'bg-border'} ${c.locked ? 'opacity-50 cursor-not-allowed' : 'cursor-pointer'}`}>
                      <span className={`absolute top-1 w-4 h-4 rounded-full bg-white shadow transition-all ${c.value ? 'left-6' : 'left-1'}`} />
                    </button>
                  </div>
                ))}
              </div>

              <div className="flex items-center justify-between mt-6">
                <button onClick={() => setCookiePrefs({ functional: false, analytics: false, advertising: false, social_media: false })}
                  className="text-[12px] text-t3 hover:text-red transition">Reject All Optional</button>
                <div className="flex items-center gap-3">
                  <button onClick={() => setCookiePrefs({ functional: true, analytics: true, advertising: !gpcDetected, social_media: !gpcDetected })}
                    className="text-[12px] text-t3 hover:text-cyan transition">Accept All</button>
                  <button onClick={saveCookies} disabled={cookieSaving}
                    className="px-5 py-2.5 rounded-xl bg-gradient-to-r from-cyan/90 to-cyan/70 text-void font-semibold text-[13px] shadow-[0_2px_12px_rgba(34,211,238,0.15)] hover:-translate-y-px transition-all disabled:opacity-50 flex items-center gap-2">
                    {cookieSaving ? <Loader2 size={13} className="animate-spin" /> : cookieSaved ? <Check size={13} /> : null}
                    {cookieSaved ? 'Saved' : 'Save Preferences'}
                  </button>
                </div>
              </div>
            </div>
          </div>
        )}

        {/* ═══ SUBPROCESSORS ═══ */}
        {tab === 'subprocessors' && (
          <div className="max-w-3xl mx-auto space-y-4">
            <div className="text-center mb-6">
              <Building2 size={28} className="text-cyan mx-auto mb-3" />
              <h2 className="font-display text-xl font-bold">Subprocessor List</h2>
              <p className="text-[13px] text-t3 mt-2">Third-party services that process data on behalf of Vaultline, per GDPR Article 28.</p>
            </div>
            {subprocessors.map(sp => (
              <div key={sp.name} className="glass-card rounded-xl p-5">
                <div className="flex items-start justify-between gap-4">
                  <div>
                    <h3 className="text-[14px] font-bold text-t1">{sp.name}</h3>
                    <p className="text-[12px] text-t3 mt-1">{sp.purpose}</p>
                    <div className="flex items-center gap-3 mt-2 text-[10px] font-mono text-t4">
                      <span><Globe size={9} className="inline" /> {sp.location}</span>
                      {sp.transfer_mechanism && <span>Transfer: {sp.transfer_mechanism}</span>}
                      {sp.data_categories?.length > 0 && <span>Data: {sp.data_categories.join(', ')}</span>}
                    </div>
                  </div>
                  <div className="flex flex-wrap gap-1.5">
                    {(sp.security_certifications || []).map(cert => (
                      <span key={cert} className="text-[8px] font-mono font-bold uppercase px-1.5 py-0.5 rounded bg-green/[0.06] text-green border border-green/[0.08]">{cert}</span>
                    ))}
                  </div>
                </div>
              </div>
            ))}
            {subprocessors.length === 0 && <div className="text-center py-12"><Loader2 size={20} className="animate-spin text-t3 mx-auto" /></div>}
            <p className="text-[10px] text-t4 text-center mt-6">To receive notification of changes to this list, contact <a href="mailto:privacy@vaultline.app" className="text-cyan hover:underline">privacy@vaultline.app</a>.</p>
          </div>
        )}

        {/* ═══ LEGAL DOCUMENTS ═══ */}
        {tab === 'documents' && (
          <div className="max-w-3xl mx-auto space-y-4">
            <div className="text-center mb-6">
              <FileText size={28} className="text-purple mx-auto mb-3" />
              <h2 className="font-display text-xl font-bold">Legal Documents</h2>
              <p className="text-[13px] text-t3 mt-2">Current versions of all Vaultline legal agreements and policies.</p>
            </div>

            {/* Static links to existing pages + dynamic docs */}
            {[
              { title: 'Terms of Service', slug: 'terms', path: '/terms', desc: 'Agreement governing your use of the Vaultline platform.' },
              { title: 'Privacy Policy', slug: 'privacy', path: '/privacy', desc: 'How we collect, use, protect, and share your personal information.' },
              { title: 'Security Overview', slug: 'security', path: '/security', desc: 'Our security architecture, certifications, and compliance posture.' },
              { title: 'Do Not Sell or Share', slug: 'dnsspi', path: null, desc: 'Opt out of the sale and sharing of your personal information.' },
            ].map(doc => (
              <Link key={doc.slug} to={doc.path || `/legal#${doc.slug}`}
                className="glass-card rounded-xl p-5 flex items-center justify-between group hover:border-border-hover transition-all block">
                <div>
                  <h3 className="text-[14px] font-bold text-t1">{doc.title}</h3>
                  <p className="text-[12px] text-t3 mt-0.5">{doc.desc}</p>
                </div>
                <ChevronRight size={16} className="text-t4 group-hover:text-cyan transition" />
              </Link>
            ))}

            {/* Dynamic docs from DB */}
            {legalDocs.filter(d => !['terms', 'privacy', 'security', 'dnsspi'].includes(d.slug)).map(doc => (
              <div key={doc.slug} className="glass-card rounded-xl p-5">
                <div className="flex items-start justify-between gap-4">
                  <div>
                    <h3 className="text-[14px] font-bold text-t1">{doc.title}</h3>
                    <div className="flex items-center gap-3 mt-1 text-[10px] font-mono text-t4">
                      <span>v{doc.version}</span>
                      <span>Effective: {new Date(doc.effective_date).toLocaleDateString('en-US', { month: 'long', day: 'numeric', year: 'numeric' })}</span>
                      {doc.jurisdiction?.length > 0 && <span>{doc.jurisdiction.join(', ')}</span>}
                    </div>
                    {doc.summary_of_changes && <p className="text-[11px] text-t3 mt-1">{doc.summary_of_changes}</p>}
                  </div>
                </div>
              </div>
            ))}

            <p className="text-[10px] text-t4 text-center mt-6">
              Questions about our legal agreements? Contact <a href="mailto:legal@vaultline.app" className="text-cyan hover:underline">legal@vaultline.app</a>
            </p>
          </div>
        )}
      </div>
    </div>
  )
}
