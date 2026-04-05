import { useState, useEffect } from 'react'
import { useSEO } from '@/hooks/useSEO'
import { useTheme } from '@/hooks/useTheme'
import { Link } from 'react-router-dom'
import {
  Shield, Lock, Eye, Server, Key, FileCheck, Users, Globe, CheckCircle2, ArrowRight,
  Fingerprint, ShieldCheck, Database, Layers, AlertTriangle, RefreshCw, Zap, Cpu
} from 'lucide-react'

/* ═══ GLASSMORPHIC SECURITY PAGE — Inspired by Cyto/DataGuard landing patterns ═══
   Dark gradient backgrounds, frosted glass cards, glow orbs, shield iconography,
   radial gradient accents, mono-spaced data readouts, dot-grid textures.
   Behind /security route — linked from Landing nav + footer.
═══════════════════════════════════════════════════════════════════════════════════ */

const LAYERS = [
  { icon: Lock, title: 'AES-256 Encryption', desc: 'All data encrypted at rest and in transit. AWS-managed key rotation with zero-knowledge architecture.', status: 'ACTIVE', color: '#22D3EE' },
  { icon: Layers, title: 'Row-Level Isolation', desc: 'Every query is scoped to your organization. No tenant can access another tenant\'s data — enforced at the database layer.', status: 'ENFORCED', color: '#34D399' },
  { icon: Fingerprint, title: 'SSO & MFA', desc: 'SAML 2.0 single sign-on support planned for Okta, Azure AD, Google Workspace. TOTP-based multi-factor authentication via Supabase Auth.', status: 'MFA ACTIVE', color: '#A78BFA' },
  { icon: Eye, title: 'Immutable Audit Trail', desc: 'Every login, data access, permission change, and export is logged with timestamps, user IDs, and IP addresses.', status: 'LOGGING', color: '#FBBF24' },
  { icon: Server, title: 'Infrastructure', desc: 'Hosted on AWS (SOC 2 Type II certified provider). HSTS preload, CSP headers, DNS prefetch control enforced.', status: 'HARDENED', color: '#FB7185' },
  { icon: Key, title: 'API Security', desc: 'Scoped API keys with granular permissions. Rate limiting, IP allowlisting, and JWT-based session management.', status: 'SECURED', color: '#38BDF8' },
]

const COMPLIANCE = [
  { framework: 'SOC 2 Type II', status: 'In Progress', desc: 'Architecture designed to SOC 2 Trust Service Criteria. Formal audit engagement not yet started.', progress: 40 },
  { framework: 'GDPR', status: 'Designed For', desc: 'Data residency controls, right-to-deletion workflows, DPA available on request.', progress: 85 },
  { framework: 'CCPA', status: 'Designed For', desc: 'Consumer data rights honoring, opt-out mechanisms, privacy policy aligned.', progress: 85 },
  { framework: 'PCI DSS', status: 'Delegated', desc: 'Payment processing handled by Stripe (PCI Level 1). No card data touches our servers.', progress: 100 },
]

const HEADERS = [
  { header: 'Strict-Transport-Security', value: 'max-age=63072000; includeSubDomains; preload' },
  { header: 'Content-Security-Policy', value: 'default-src \'self\'; connect-src supabase, stripe, plaid' },
  { header: 'X-Frame-Options', value: 'DENY' },
  { header: 'X-Content-Type-Options', value: 'nosniff' },
  { header: 'Referrer-Policy', value: 'strict-origin-when-cross-origin' },
  { header: 'Permissions-Policy', value: 'camera=(), microphone=(), geolocation=()' },
]

export default function SecurityPage() {
  const { isDark } = useTheme()
  const [activeLayer, setActiveLayer] = useState(0)

  useSEO({ title: 'Security 2014 Trust Center', description: 'Vaultline security: SOC 2 ready, AES-256 encryption, bank-grade infrastructure. See our security practices, certifications, and compliance posture.', canonical: '/security' })

  // Auto-cycle through layers
  useEffect(() => {
    const t = setInterval(() => setActiveLayer(p => (p + 1) % LAYERS.length), 4000)
    return () => clearInterval(t)
  }, [])

  return (
    <div className="min-h-screen" style={{ background: isDark ? '#050A18' : '#F8FAFC' }}>

      {/* ═══ HERO — Cyto/DataGuard glassmorphic pattern ═══ */}
      <div className="relative overflow-hidden" style={{ background: isDark ? 'linear-gradient(160deg, #050A18 0%, #0A1628 30%, #0F1D3A 60%, #0A1628 100%)' : 'linear-gradient(160deg, #F8FAFC 0%, #EFF6FF 30%, #DBEAFE 60%, #EFF6FF 100%)' }}>
        {/* Animated glow orbs */}
        <div className="absolute top-[20%] left-[15%] w-[400px] h-[400px] rounded-full opacity-[0.06]" style={{ background: 'radial-gradient(circle, #22D3EE 0%, transparent 60%)', animation: 'pulse 6s ease-in-out infinite' }} />
        <div className="absolute top-[40%] right-[10%] w-[300px] h-[300px] rounded-full opacity-[0.04]" style={{ background: 'radial-gradient(circle, #A78BFA 0%, transparent 60%)', animation: 'pulse 8s ease-in-out infinite 2s' }} />
        <div className="absolute bottom-[10%] left-[40%] w-[350px] h-[350px] rounded-full opacity-[0.05]" style={{ background: 'radial-gradient(circle, #34D399 0%, transparent 60%)', animation: 'pulse 7s ease-in-out infinite 4s' }} />

        {/* Dot-grid texture */}
        <div className="absolute top-8 right-12 grid grid-cols-6 gap-2.5 opacity-[0.06]">
          {[...Array(36)].map((_, i) => <div key={i} className="w-1 h-1 rounded-full" style={{ background: isDark ? '#22D3EE' : '#0891B2' }} />)}
        </div>

        <div className="max-w-[1100px] mx-auto px-8 pt-20 pb-16 relative z-[2]">
          {/* Nav back */}
          <Link to="/" className="inline-flex items-center gap-2 text-[12px] font-mono text-t3 hover:text-cyan transition mb-8">
            ← Back to Vaultline
          </Link>

          <div className="flex items-center gap-3 mb-6">
            <div className="w-14 h-14 rounded-2xl flex items-center justify-center" style={{ background: isDark ? 'rgba(34,211,238,0.08)' : 'rgba(8,145,178,0.06)', border: isDark ? '1px solid rgba(34,211,238,0.15)' : '1px solid rgba(8,145,178,0.1)', boxShadow: isDark ? '0 0 40px rgba(34,211,238,0.08)' : 'none' }}>
              <Shield size={28} className="text-cyan" />
            </div>
            <div>
              <span className="text-[10px] font-mono font-bold uppercase tracking-[0.2em]" style={{ color: isDark ? '#67E8F9' : '#0891B2' }}>TRUST CENTER</span>
              <h1 className="font-display text-[42px] font-black tracking-tight leading-[1.05]" style={{ color: isDark ? '#F1F5F9' : '#0F172A' }}>
                Security at Vaultline
              </h1>
            </div>
          </div>

          <p className="text-[17px] leading-relaxed max-w-[600px] mb-8" style={{ color: isDark ? 'rgba(148,163,184,0.8)' : 'rgba(51,65,85,0.8)' }}>
            Your treasury data is the most sensitive information your company holds. We built every layer of Vaultline with that understanding.
          </p>

          {/* Live security status strip — glassmorphic */}
          <div className="inline-flex items-center gap-6 px-6 py-3 rounded-2xl" style={{ background: isDark ? 'rgba(255,255,255,0.03)' : 'rgba(0,0,0,0.02)', border: isDark ? '1px solid rgba(255,255,255,0.06)' : '1px solid rgba(0,0,0,0.06)', backdropFilter: 'blur(12px)' }}>
            {[
              { label: 'ENCRYPTION', value: 'AES-256', color: '#22D3EE' },
              { label: 'RLS', value: 'ENFORCED', color: '#34D399' },
              { label: 'HSTS', value: '2YR PRELOAD', color: '#A78BFA' },
              { label: 'UPTIME', value: '99.95%', color: '#FBBF24' },
            ].map(s => (
              <div key={s.label} className="text-center">
                <p className="text-[9px] font-mono font-bold uppercase tracking-[0.15em]" style={{ color: isDark ? 'rgba(148,163,184,0.5)' : 'rgba(71,85,105,0.5)' }}>{s.label}</p>
                <p className="text-[14px] font-mono font-black" style={{ color: s.color }}>{s.value}</p>
              </div>
            ))}
          </div>
        </div>
      </div>

      <div className="max-w-[1100px] mx-auto px-8 py-12 space-y-16">

        {/* ═══ SECURITY LAYERS — Interactive selector + detail panel ═══ */}
        <div>
          <span className="text-[10px] font-mono font-bold uppercase tracking-[0.15em]" style={{ color: isDark ? '#67E8F9' : '#0891B2' }}>DEFENSE IN DEPTH</span>
          <h2 className="font-display text-[28px] font-extrabold tracking-tight mt-1 mb-6" style={{ color: isDark ? '#F1F5F9' : '#0F172A' }}>Six layers protecting your data</h2>

          <div className="grid grid-cols-[280px_1fr] gap-4">
            {/* Layer selector */}
            <div className="flex flex-col gap-1.5">
              {LAYERS.map((layer, i) => (
                <button key={i} onClick={() => setActiveLayer(i)}
                  className="flex items-center gap-3 px-4 py-3 rounded-xl text-left transition-all"
                  style={{
                    background: activeLayer === i ? (isDark ? 'rgba(255,255,255,0.04)' : 'rgba(0,0,0,0.03)') : 'transparent',
                    border: activeLayer === i ? `1px solid ${layer.color}25` : '1px solid transparent',
                  }}>
                  <div className="w-8 h-8 rounded-lg flex items-center justify-center shrink-0" style={{ background: `${layer.color}10` }}>
                    <layer.icon size={14} style={{ color: layer.color }} />
                  </div>
                  <div>
                    <p className="text-[12px] font-semibold" style={{ color: activeLayer === i ? (isDark ? '#F1F5F9' : '#0F172A') : (isDark ? '#94A3B8' : '#64748B') }}>{layer.title}</p>
                    <p className="text-[9px] font-mono font-bold" style={{ color: layer.color, opacity: activeLayer === i ? 1 : 0.4 }}>{layer.status}</p>
                  </div>
                </button>
              ))}
            </div>

            {/* Detail panel — glassmorphic */}
            <div className="rounded-2xl p-8 relative overflow-hidden" style={{ background: isDark ? 'rgba(255,255,255,0.02)' : 'rgba(0,0,0,0.015)', border: isDark ? '1px solid rgba(255,255,255,0.05)' : '1px solid rgba(0,0,0,0.06)', backdropFilter: 'blur(8px)' }}>
              <div className="absolute -top-12 -right-12 w-[200px] h-[200px] rounded-full opacity-[0.06]" style={{ background: `radial-gradient(circle, ${LAYERS[activeLayer].color} 0%, transparent 60%)` }} />
              <div className="relative z-[2]">
                <div className="flex items-center gap-3 mb-4">
                  <div className="w-12 h-12 rounded-xl flex items-center justify-center" style={{ background: `${LAYERS[activeLayer].color}12`, border: `1px solid ${LAYERS[activeLayer].color}20`, boxShadow: isDark ? `0 0 30px ${LAYERS[activeLayer].color}10` : 'none' }}>
                    {(() => { const Icon = LAYERS[activeLayer].icon; return <Icon size={22} style={{ color: LAYERS[activeLayer].color }} /> })()}
                  </div>
                  <div>
                    <h3 className="text-[20px] font-extrabold" style={{ color: isDark ? '#F1F5F9' : '#0F172A' }}>{LAYERS[activeLayer].title}</h3>
                    <span className="text-[10px] font-mono font-bold px-2 py-0.5 rounded" style={{ background: `${LAYERS[activeLayer].color}12`, color: LAYERS[activeLayer].color }}>{LAYERS[activeLayer].status}</span>
                  </div>
                </div>
                <p className="text-[14px] leading-relaxed" style={{ color: isDark ? 'rgba(148,163,184,0.8)' : 'rgba(51,65,85,0.7)' }}>
                  {LAYERS[activeLayer].desc}
                </p>
              </div>
            </div>
          </div>
        </div>

        {/* ═══ HTTP HEADERS — Terminal readout ═══ */}
        <div>
          <span className="text-[10px] font-mono font-bold uppercase tracking-[0.15em]" style={{ color: isDark ? '#67E8F9' : '#0891B2' }}>HTTP SECURITY HEADERS</span>
          <h2 className="font-display text-[28px] font-extrabold tracking-tight mt-1 mb-6" style={{ color: isDark ? '#F1F5F9' : '#0F172A' }}>Every response is hardened</h2>

          <div className="rounded-2xl overflow-hidden" style={{ background: isDark ? '#0A0F1E' : '#1E293B', border: isDark ? '1px solid rgba(34,211,238,0.08)' : '1px solid rgba(30,41,59,0.3)' }}>
            <div className="flex items-center gap-2 px-4 py-2" style={{ background: isDark ? 'rgba(255,255,255,0.02)' : 'rgba(255,255,255,0.05)', borderBottom: '1px solid rgba(255,255,255,0.04)' }}>
              <div className="w-2.5 h-2.5 rounded-full bg-red-400/60" />
              <div className="w-2.5 h-2.5 rounded-full bg-amber-400/60" />
              <div className="w-2.5 h-2.5 rounded-full bg-green-400/60" />
              <span className="text-[10px] font-mono text-[#64748B] ml-2">vaultline.app — response headers</span>
            </div>
            <div className="p-5 space-y-1.5">
              {HEADERS.map((h, i) => (
                <div key={i} className="flex gap-2 text-[12px] font-mono">
                  <span style={{ color: '#22D3EE' }}>{h.header}:</span>
                  <span style={{ color: '#94A3B8' }}>{h.value}</span>
                </div>
              ))}
            </div>
          </div>
        </div>

        {/* ═══ COMPLIANCE FRAMEWORKS — Progress bars ═══ */}
        <div>
          <span className="text-[10px] font-mono font-bold uppercase tracking-[0.15em]" style={{ color: isDark ? '#67E8F9' : '#0891B2' }}>COMPLIANCE</span>
          <h2 className="font-display text-[28px] font-extrabold tracking-tight mt-1 mb-6" style={{ color: isDark ? '#F1F5F9' : '#0F172A' }}>Framework coverage</h2>

          <div className="grid grid-cols-2 gap-4">
            {COMPLIANCE.map((c, i) => (
              <div key={i} className="rounded-2xl p-5" style={{ background: isDark ? 'rgba(255,255,255,0.02)' : 'rgba(0,0,0,0.015)', border: isDark ? '1px solid rgba(255,255,255,0.05)' : '1px solid rgba(0,0,0,0.06)' }}>
                <div className="flex items-center justify-between mb-2">
                  <h3 className="text-[15px] font-bold" style={{ color: isDark ? '#F1F5F9' : '#0F172A' }}>{c.framework}</h3>
                  <span className="text-[10px] font-mono font-bold px-2 py-0.5 rounded" style={{ background: c.progress === 100 ? 'rgba(52,211,153,0.1)' : 'rgba(251,191,36,0.1)', color: c.progress === 100 ? '#34D399' : '#FBBF24' }}>{c.status}</span>
                </div>
                <p className="text-[12px] mb-3" style={{ color: isDark ? 'rgba(148,163,184,0.6)' : 'rgba(71,85,105,0.6)' }}>{c.desc}</p>
                <div className="h-2 rounded-full overflow-hidden" style={{ background: isDark ? 'rgba(255,255,255,0.04)' : 'rgba(0,0,0,0.04)' }}>
                  <div className="h-full rounded-full transition-all duration-700" style={{ width: `${c.progress}%`, background: c.progress === 100 ? 'linear-gradient(90deg, #34D399, #22D3EE)' : 'linear-gradient(90deg, #FBBF24, #F59E0B)' }} />
                </div>
              </div>
            ))}
          </div>
        </div>

        {/* ═══ CTA ═══ */}
        <div className="text-center py-8">
          <h2 className="font-display text-[24px] font-extrabold mb-3" style={{ color: isDark ? '#F1F5F9' : '#0F172A' }}>Questions about our security posture?</h2>
          <p className="text-[14px] mb-6" style={{ color: isDark ? 'rgba(148,163,184,0.6)' : 'rgba(71,85,105,0.6)' }}>Request our security questionnaire, penetration test results, or architecture documentation.</p>
          <div className="flex items-center justify-center gap-4">
            <a href="mailto:security@vaultline.app?subject=Security Inquiry" className="px-6 py-3 rounded-xl text-[14px] font-semibold transition-all hover:-translate-y-px" style={{ background: isDark ? '#22D3EE' : '#0891B2', color: isDark ? '#050A18' : '#fff' }}>
              Contact Security Team
            </a>
            <Link to="/signup" className="px-6 py-3 rounded-xl text-[14px] font-semibold border transition-all hover:-translate-y-px" style={{ borderColor: isDark ? 'rgba(34,211,238,0.2)' : 'rgba(8,145,178,0.15)', color: isDark ? '#67E8F9' : '#0891B2' }}>
              Get Started →
            </Link>
          </div>
        </div>
      </div>

      <style>{`@keyframes pulse { 0%, 100% { opacity: 0.04; transform: scale(1); } 50% { opacity: 0.08; transform: scale(1.05); } }`}</style>
    </div>
  )
}
