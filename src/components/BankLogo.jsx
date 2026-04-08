import { useState } from 'react'

/**
 * BankLogo — renders a bank's actual logo with fallback to initials.
 * 
 * Uses a domain map for major banks → Logo.dev for the icon.
 * Falls back to colored initials circle if logo fails to load.
 *
 * Usage:
 *   <BankLogo name="JPMorgan Chase" color="#005EB8" size={36} />
 *   <BankLogo name="Wells Fargo" institutionId="ins_4" size={32} />
 */

// Map of major bank names to their domains for logo lookup
const BANK_DOMAINS = {
  'jpmorgan chase': 'chase.com',
  'chase': 'chase.com',
  'bank of america': 'bankofamerica.com',
  'wells fargo': 'wellsfargo.com',
  'citibank': 'citigroup.com',
  'citi': 'citigroup.com',
  'capital one': 'capitalone.com',
  'us bank': 'usbank.com',
  'u.s. bank': 'usbank.com',
  'pnc': 'pnc.com',
  'truist': 'truist.com',
  'td bank': 'td.com',
  'fifth third': '53.com',
  'regions': 'regions.com',
  'citizens': 'citizensbank.com',
  'first citizens': 'firstcitizens.com',
  'first citizens (svb)': 'firstcitizens.com',
  'svb': 'svb.com',
  'silicon valley bank': 'svb.com',
  'mercury': 'mercury.com',
  'brex': 'brex.com',
  'relay': 'relayfi.com',
  'novo': 'novo.co',
  'bluevine': 'bluevine.com',
  'goldman sachs': 'goldmansachs.com',
  'morgan stanley': 'morganstanley.com',
  'charles schwab': 'schwab.com',
  'schwab': 'schwab.com',
  'fidelity': 'fidelity.com',
  'vanguard': 'vanguard.com',
  'american express': 'americanexpress.com',
  'amex': 'americanexpress.com',
  'discover': 'discover.com',
  'ally': 'ally.com',
  'synchrony': 'synchrony.com',
  'sofi': 'sofi.com',
  'chime': 'chime.com',
  'current': 'current.com',
  'ramp': 'ramp.com',
  'stripe': 'stripe.com',
  'paypal': 'paypal.com',
  'square': 'squareup.com',
  'hsbc': 'hsbc.com',
  'barclays': 'barclays.com',
  'deutsche bank': 'db.com',
  'bnp paribas': 'bnpparibas.com',
  'credit suisse': 'credit-suisse.com',
  'ubs': 'ubs.com',
}

function getDomain(name) {
  if (!name) return null
  const lower = name.toLowerCase().trim()
  // Direct match
  if (BANK_DOMAINS[lower]) return BANK_DOMAINS[lower]
  // Partial match — check if any key is contained in the name
  for (const [key, domain] of Object.entries(BANK_DOMAINS)) {
    if (lower.includes(key)) return domain
  }
  return null
}

function getInitials(name) {
  if (!name) return '??'
  const words = name.trim().split(/\s+/)
  if (words.length === 1) return words[0].slice(0, 2).toUpperCase()
  return (words[0][0] + words[1][0]).toUpperCase()
}

export default function BankLogo({ name, color, size = 36, className = '', status = null }) {
  const [imgFailed, setImgFailed] = useState(false)
  const domain = getDomain(name)
  const googleUrl = domain ? `https://www.google.com/s2/favicons?domain=${domain}&sz=128` : null
  const duckUrl = domain ? `https://icons.duckduckgo.com/ip3/${domain}.ico` : null
  const logoUrl = imgFailed === 'google' ? duckUrl : googleUrl

  const initials = getInitials(name)
  const bgColor = color || '#1565C0'

  // Status indicator styles
  const statusDot = status === 'connected' ? 'bg-green' : status === 'syncing' ? 'bg-cyan animate-pulse' : status === 'stale' ? 'bg-amber' : status === 'error' ? 'bg-red' : null
  const borderClass = status === 'connected' ? 'border-green/20' : status === 'syncing' ? 'border-cyan/20' : 'border-border'

  const wrapper = (children) => (
    <div className={`relative ${className}`} style={{ width: size, height: size }}>
      {children}
      {statusDot && (
        <span className={`absolute -bottom-0.5 -right-0.5 w-[9px] h-[9px] rounded-full ${statusDot} border-2 border-surface z-10`} />
      )}
    </div>
  )

  if (logoUrl && imgFailed !== 'all') {
    return wrapper(
      <div className={`rounded-xl overflow-hidden flex items-center justify-center bg-white border ${borderClass} w-full h-full transition-shadow`}>
        <img
          src={logoUrl}
          alt={name}
          className="w-full h-full object-contain p-1"
          onError={() => { if (imgFailed === false) setImgFailed('google'); else setImgFailed('all') }}
          loading="lazy"
        />
      </div>
    )
  }

  return wrapper(
    <div
      className={`rounded-xl flex items-center justify-center text-white font-bold border ${borderClass} w-full h-full transition-shadow`}
      style={{ background: bgColor, fontSize: Math.round(size * 0.35) }}
    >
      {initials}
    </div>
  )
}
