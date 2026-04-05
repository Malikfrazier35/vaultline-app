export function fmtCurrency(n) {
  const abs = Math.abs(n || 0)
  if (abs >= 1e6) return `$${(abs / 1e6).toFixed(2)}M`
  if (abs >= 1e5) return `$${(abs / 1e3).toFixed(0)}K`
  if (abs >= 1e3) return `$${(abs / 1e3).toFixed(1)}K`
  return `$${abs.toFixed(0)}`
}

export function ChartTooltip({ active, payload, label, isDark, formatLabel }) {
  if (!active || !payload?.length) return null

  const bg = isDark ? 'rgba(8,16,32,0.95)' : '#FFFFFF'
  const border = isDark ? '1px solid rgba(34,211,238,0.1)' : '1px solid rgba(15,23,42,0.08)'
  const textPrimary = isDark ? '#EEF2F7' : '#0F172A'
  const textSecondary = isDark ? '#3B5575' : '#94A3B8'

  return (
    <div style={{
      background: bg, border, borderRadius: 14, padding: '14px 18px',
      boxShadow: isDark
        ? '0 16px 64px rgba(0,0,0,0.7), 0 0 1px rgba(34,211,238,0.12), inset 0 1px 0 rgba(255,255,255,0.02)'
        : '0 8px 32px rgba(15,23,42,0.12), 0 0 0 1px rgba(15,23,42,0.05)',
      minWidth: 180, backdropFilter: 'blur(16px)', WebkitBackdropFilter: 'blur(16px)',
      animation: 'kpiFlash 0.15s ease-out',
    }}>
      <p style={{ fontSize: 9, color: textSecondary, marginBottom: 10, fontWeight: 700, letterSpacing: '0.1em', textTransform: 'uppercase', fontFamily: "'JetBrains Mono', monospace" }}>
        {formatLabel ? formatLabel(label) : label}
      </p>
      {payload.filter(p => p.value != null && p.name !== 'Upper Band' && p.name !== 'Lower Band').map((entry, i) => {
        const isPositive = entry.value >= 0
        return (
          <div key={i} style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 24, marginBottom: i < payload.length - 1 ? 7 : 0 }}>
            <span style={{ display: 'flex', alignItems: 'center', gap: 8, fontSize: 11, color: textSecondary, fontWeight: 500 }}>
              <span style={{
                width: 8, height: 8, borderRadius: 3, background: entry.color, display: 'inline-block',
                boxShadow: `0 0 8px ${entry.color}50`,
              }} />
              {entry.name}
            </span>
            <span style={{
              fontSize: 13, fontWeight: 800, fontFamily: "'JetBrains Mono', monospace",
              letterSpacing: '-0.03em',
              color: entry.name === 'Net Flow' || entry.name === 'Net Trend'
                ? (isPositive ? (isDark ? '#34D399' : '#059669') : (isDark ? '#FB7185' : '#E11D48'))
                : textPrimary,
            }}>
              {typeof entry.value === 'number' ? fmtCurrency(entry.value) : entry.value}
            </span>
          </div>
        )
      })}
    </div>
  )
}

export function ChartLegend({ items }) {
  return (
    <div className="flex items-center gap-5 mt-4 px-1">
      {items.map((item, i) => (
        <div key={i} className="flex items-center gap-2 text-[12px] text-t3 font-medium">
          {item.type === 'line' ? (
            <div className="w-5 h-0.5 rounded-full" style={{ background: item.color, boxShadow: `0 0 4px ${item.color}40`, ...(item.dashed ? { borderTop: `2px dashed ${item.color}`, height: 0, background: 'none' } : {}) }} />
          ) : item.type === 'bar' ? (
            <div className="w-3 h-3 rounded-sm" style={{ background: item.color, boxShadow: `0 0 4px ${item.color}30` }} />
          ) : (
            <div className="w-3 h-3 rounded-sm" style={{ background: item.color, opacity: 0.4 }} />
          )}
          {item.label}
        </div>
      ))}
    </div>
  )
}

// Empty state for charts with no data
export function EmptyChart({ label, sub }) {
  return (
    <div className="flex flex-col items-center justify-center h-full text-center">
      <div className="w-12 h-12 rounded-xl bg-cyan/[0.04] border border-cyan/[0.06] flex items-center justify-center mb-3">
        <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" className="text-t3">
          <path d="M3 3v18h18" /><path d="M7 14l4-4 4 4 5-5" />
        </svg>
      </div>
      <p className="text-[13px] text-t2 font-medium mb-1">{label || 'No data yet'}</p>
      {sub && <p className="text-[11px] text-t3 font-mono">{sub}</p>}
    </div>
  )
}
