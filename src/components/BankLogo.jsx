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

export default function BankLogo({ name, color, size = 36, className = '' }) {
  const [imgFailed, setImgFailed] = useState(false)
  const domain = getDomain(name)
  // Use Google's high-res favicon service (no auth needed)
  const logoUrl = domain ? `https://www.google.com/s2/favicons?domain=${domain}&sz=128` : null

  const initials = getInitials(name)
  const bgColor = color || '#1565C0'

  // If we have a domain and image hasn't failed, try the logo
  if (logoUrl && !imgFailed) {
    return (
      <div
        className={`rounded-xl overflow-hidden flex items-center justify-center bg-white border border-border ${className}`}
        style={{ width: size, height: size }}
      >
        <img
          src={logoUrl}
          alt={name}
          className="w-full h-full object-contain p-1"
          onError={() => setImgFailed(true)}
          loading="lazy"
        />
      </div>
    )
  }

  // Fallback — colored circle with initials
  return (
    <div
      className={`rounded-xl flex items-center justify-center text-white font-bold ${className}`}
      style={{
        width: size,
        height: size,
        background: bgColor,
        fontSize: Math.round(size * 0.35),
      }}
    >
      {initials}
    </div>
  )
}
