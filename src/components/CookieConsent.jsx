import { useState, useEffect } from 'react'
import { Link } from 'react-router-dom'
import { Shield, X } from 'lucide-react'

const CONSENT_KEY = 'vaultline-cookie-consent'

function getConsent() {
  try {
    const saved = localStorage.getItem(CONSENT_KEY)
    return saved ? JSON.parse(saved) : null
  } catch { return null }
}

function saveConsent(prefs) {
  const record = { ...prefs, timestamp: new Date().toISOString(), version: '1.0' }
  localStorage.setItem(CONSENT_KEY, JSON.stringify(record))
  return record
}

// Enable/disable tracking scripts based on consent
function applyConsent(prefs) {
  if (prefs.analytics) {
    // GA4 is already loaded via gtag.js in index.html
    // Enable data collection
    if (window.gtag) {
      window.gtag('consent', 'update', {
        analytics_storage: 'granted',
        ad_storage: prefs.advertising ? 'granted' : 'denied',
        ad_user_data: prefs.advertising ? 'granted' : 'denied',
        ad_personalization: prefs.advertising ? 'granted' : 'denied',
      })
    }
  } else {
    // Deny all tracking
    if (window.gtag) {
      window.gtag('consent', 'update', {
        analytics_storage: 'denied',
        ad_storage: 'denied',
        ad_user_data: 'denied',
        ad_personalization: 'denied',
      })
    }
  }
}

/**
 * CookieConsent — GDPR-compliant cookie banner.
 *
 * Shows on first visit. Blocks analytics/ads until consent.
 * Respects Global Privacy Control (GPC) signal.
 * Stores preference in localStorage + can sync to consent_records table.
 *
 * Place in App.jsx or Layout.jsx — renders as fixed bottom banner.
 */
export default function CookieConsent() {
  const [visible, setVisible] = useState(false)
  const [showDetails, setShowDetails] = useState(false)
  const [prefs, setPrefs] = useState({
    functional: true, // always on
    analytics: false,
    advertising: false,
  })

  useEffect(() => {
    const existing = getConsent()
    if (existing) {
      // Already consented — apply saved preferences silently
      applyConsent(existing)
      return
    }

    // Check for GPC signal — auto-reject non-essential
    if (navigator.globalPrivacyControl) {
      const gpcPrefs = { functional: true, analytics: false, advertising: false }
      saveConsent(gpcPrefs)
      applyConsent(gpcPrefs)
      return
    }

    // Default: deny all until explicit consent (GDPR requirement)
    if (window.gtag) {
      window.gtag('consent', 'default', {
        analytics_storage: 'denied',
        ad_storage: 'denied',
        ad_user_data: 'denied',
        ad_personalization: 'denied',
        wait_for_update: 500,
      })
    }

    // Show banner after short delay (avoid layout shift)
    const timer = setTimeout(() => setVisible(true), 1000)
    return () => clearTimeout(timer)
  }, [])

  function acceptAll() {
    const all = { functional: true, analytics: true, advertising: true }
    saveConsent(all)
    applyConsent(all)
    setVisible(false)
  }

  function rejectNonEssential() {
    const minimal = { functional: true, analytics: false, advertising: false }
    saveConsent(minimal)
    applyConsent(minimal)
    setVisible(false)
  }

  function saveCustom() {
    saveConsent(prefs)
    applyConsent(prefs)
    setVisible(false)
  }

  if (!visible) return null

  return (
    <div className="fixed bottom-0 left-0 right-0 z-[9999] p-4 animate-in fade-in slide-in-from-bottom-4">
      <div className="max-w-2xl mx-auto glass-card rounded-2xl border border-border shadow-[0_-4px_24px_rgba(0,0,0,0.1)] overflow-hidden">
        <div className="px-5 py-4">
          <div className="flex items-start gap-3">
            <div className="w-8 h-8 rounded-lg bg-cyan-glow flex items-center justify-center flex-shrink-0 mt-0.5">
              <Shield size={14} className="text-cyan" />
            </div>
            <div className="flex-1 min-w-0">
              <p className="text-[13px] font-semibold text-t1">We respect your privacy</p>
              <p className="text-[12px] text-t3 mt-1 leading-relaxed">
                We use cookies to improve your experience, analyze site traffic, and serve relevant ads.
                You can accept all, reject non-essential, or customize your preferences.
                {' '}<Link to="/legal" className="text-cyan hover:underline">Privacy policy</Link>
              </p>

              {/* Cookie category details */}
              {showDetails && (
                <div className="mt-3 space-y-2">
                  <label className="flex items-center gap-3 p-2.5 rounded-lg bg-deep">
                    <input type="checkbox" checked disabled className="w-4 h-4 rounded accent-cyan" />
                    <div className="flex-1">
                      <p className="text-[12px] font-medium text-t1">Functional</p>
                      <p className="text-[10px] text-t3">Required for the site to work. Cannot be disabled.</p>
                    </div>
                    <span className="text-[9px] font-mono text-t4 uppercase">Always on</span>
                  </label>
                  <label className="flex items-center gap-3 p-2.5 rounded-lg bg-deep cursor-pointer hover:bg-deep/80 transition">
                    <input type="checkbox" checked={prefs.analytics} onChange={e => setPrefs(p => ({ ...p, analytics: e.target.checked }))} className="w-4 h-4 rounded accent-cyan" />
                    <div className="flex-1">
                      <p className="text-[12px] font-medium text-t1">Analytics</p>
                      <p className="text-[10px] text-t3">Google Analytics — helps us understand how you use the site.</p>
                    </div>
                  </label>
                  <label className="flex items-center gap-3 p-2.5 rounded-lg bg-deep cursor-pointer hover:bg-deep/80 transition">
                    <input type="checkbox" checked={prefs.advertising} onChange={e => setPrefs(p => ({ ...p, advertising: e.target.checked }))} className="w-4 h-4 rounded accent-cyan" />
                    <div className="flex-1">
                      <p className="text-[12px] font-medium text-t1">Advertising</p>
                      <p className="text-[10px] text-t3">Google Ads — enables conversion tracking and remarketing.</p>
                    </div>
                  </label>
                </div>
              )}

              {/* Action buttons */}
              <div className="flex items-center gap-2 mt-3">
                <button onClick={acceptAll}
                  className="px-4 py-2 rounded-lg bg-cyan text-void text-[12px] font-semibold hover:bg-cyan-bright active:scale-[0.97] transition-all">
                  Accept all
                </button>
                <button onClick={rejectNonEssential}
                  className="px-4 py-2 rounded-lg border border-border text-[12px] font-semibold text-t2 hover:text-t1 hover:border-border-hover active:scale-[0.97] transition-all">
                  Reject non-essential
                </button>
                {!showDetails ? (
                  <button onClick={() => setShowDetails(true)}
                    className="px-4 py-2 rounded-lg text-[12px] text-t3 hover:text-t1 transition">
                    Customize
                  </button>
                ) : (
                  <button onClick={saveCustom}
                    className="px-4 py-2 rounded-lg border border-cyan/20 text-[12px] font-semibold text-cyan hover:bg-cyan-glow active:scale-[0.97] transition-all">
                    Save preferences
                  </button>
                )}
              </div>
            </div>
            <button onClick={rejectNonEssential} className="p-1 rounded-lg hover:bg-deep text-t4 hover:text-t2 transition flex-shrink-0" title="Close (rejects non-essential)">
              <X size={14} />
            </button>
          </div>
        </div>
      </div>
    </div>
  )
}

/**
 * Export consent check helper for other components
 */
export function hasAnalyticsConsent() {
  const consent = getConsent()
  return consent?.analytics === true
}

export function hasAdvertisingConsent() {
  const consent = getConsent()
  return consent?.advertising === true
}
