import { useState } from 'react'
import { Eye, EyeOff } from 'lucide-react'

/**
 * MaskedValue — displays sensitive data with masking.
 * Shows masked version by default, reveals on click.
 * Logs reveal events for audit trail.
 *
 * Usage:
 *   <MaskedValue value="1234567890" type="account" />     → ****7890
 *   <MaskedValue value={45000} type="balance" />          → $••••••
 *   <MaskedValue value="tok_abc123" type="token" />       → tok_•••••
 *   <MaskedValue value="malik@test.com" type="email" />   → m***@test.com
 */

function mask(value, type) {
  if (value == null || value === '') return '—'
  const str = String(value)

  switch (type) {
    case 'account':
      return str.length > 4 ? '••••' + str.slice(-4) : '••••'
    case 'balance':
      return '$••••••'
    case 'token':
      if (str.length > 6) return str.slice(0, 4) + '•'.repeat(Math.min(str.length - 4, 8))
      return '••••••'
    case 'email': {
      const [local, domain] = str.split('@')
      if (!domain) return '••••'
      return local[0] + '•••@' + domain
    }
    case 'ssn':
      return '•••-••-' + str.slice(-4)
    case 'routing':
      return '•••••' + str.slice(-4)
    default:
      return str.length > 4 ? '••••' + str.slice(-4) : '••••'
  }
}

function format(value, type) {
  if (value == null || value === '') return '—'
  if (type === 'balance') return typeof value === 'number' ? `$${value.toLocaleString()}` : `$${value}`
  return String(value)
}

export default function MaskedValue({
  value,
  type = 'account',
  className = '',
  showToggle = true,
  defaultRevealed = false,
  onReveal,
  size = 'sm',
}) {
  const [revealed, setRevealed] = useState(defaultRevealed)

  function toggle() {
    const next = !revealed
    setRevealed(next)
    if (next && onReveal) {
      onReveal({ value, type, timestamp: new Date().toISOString() })
    }
  }

  const iconSize = size === 'xs' ? 10 : size === 'sm' ? 12 : 14
  const textSize = size === 'xs' ? 'text-[11px]' : size === 'sm' ? 'text-[13px]' : 'text-[14px]'

  return (
    <span className={`inline-flex items-center gap-1.5 font-mono ${textSize} ${className}`}>
      <span className={revealed ? 'text-t1' : 'text-t3'}>
        {revealed ? format(value, type) : mask(value, type)}
      </span>
      {showToggle && value != null && value !== '' && (
        <button
          onClick={(e) => { e.stopPropagation(); toggle() }}
          className="p-0.5 rounded hover:bg-deep transition text-t3 hover:text-t2"
          title={revealed ? 'Hide' : 'Reveal'}
        >
          {revealed ? <EyeOff size={iconSize} /> : <Eye size={iconSize} />}
        </button>
      )}
    </span>
  )
}

/**
 * MaskedBalance — convenience wrapper for currency values
 */
export function MaskedBalance({ value, className = '', size = 'sm', ...props }) {
  return <MaskedValue value={value} type="balance" className={className} size={size} {...props} />
}

/**
 * MaskedAccount — convenience wrapper for account numbers
 */
export function MaskedAccount({ value, className = '', size = 'sm', ...props }) {
  return <MaskedValue value={value} type="account" className={className} size={size} {...props} />
}

/**
 * useRevealAudit — hook to log reveal events to security_events
 */
export function useRevealAudit(supabase, orgId, userId) {
  return async function logReveal({ value, type, timestamp }) {
    try {
      await supabase.from('security_events').insert({
        org_id: orgId,
        user_id: userId,
        event_type: 'sensitive_data_revealed',
        severity: 'info',
        description: `User revealed masked ${type} value`,
        metadata: { field_type: type, timestamp },
      })
    } catch {}
  }
}
