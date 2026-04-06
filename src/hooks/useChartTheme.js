import { useTheme } from '@/hooks/useTheme'

export function useChartTheme() {
  const { isDark } = useTheme()

  return {
    // Grid — subtle scanlines
    grid: isDark ? 'rgba(34,211,238,0.04)' : 'rgba(15,23,42,0.06)',
    gridDash: '1 6',
    
    // Axis ticks — monospace terminal feel
    tick: isDark ? '#3B5575' : '#94A3B8',
    tickFont: { fontSize: 10, fontFamily: "'JetBrains Mono', monospace", fontWeight: 500 },
    
    // Tooltip
    tooltip: {
      background: isDark ? 'rgba(8,16,32,0.95)' : '#FFFFFF',
      border: isDark ? '1px solid rgba(34,211,238,0.1)' : '1px solid rgba(15,23,42,0.08)',
      borderRadius: 14,
      fontSize: 12,
      color: isDark ? '#EEF2F7' : '#0F172A',
      boxShadow: isDark
        ? '0 12px 48px rgba(0,0,0,0.6), 0 0 1px rgba(34,211,238,0.15), inset 0 1px 0 rgba(34,211,238,0.04)'
        : '0 8px 32px rgba(0,0,0,0.1), 0 0 0 1px rgba(15,23,42,0.06)',
    },

    // Bars — glass-like with inner glow
    bar: {
      inflows: isDark ? 'rgba(52,211,153,0.7)' : '#059669',
      inflowsHover: isDark ? 'rgba(52,211,153,0.9)' : '#047857',
      outflows: isDark ? 'rgba(251,113,133,0.5)' : '#DC2626',
      outflowsHover: isDark ? 'rgba(251,113,133,0.75)' : '#B91C1C',
    },

    // Lines — glowing strokes
    line: {
      primary: isDark ? '#22D3EE' : '#0891B2',
      secondary: isDark ? '#818CF8' : '#6366F1',
      green: isDark ? '#34D399' : '#059669',
      red: isDark ? '#FB7185' : '#E11D48',
      amber: isDark ? '#FBBF24' : '#D97706',
    },

    // Areas — deeper gradient fills
    area: {
      primary: isDark ? 'rgba(34,211,238,0.15)' : 'rgba(8,145,178,0.18)',
      secondary: isDark ? 'rgba(129,140,248,0.1)' : 'rgba(99,102,241,0.12)',
      band: isDark ? 'rgba(34,211,238,0.06)' : 'rgba(8,145,178,0.1)',
    },

    // Cursor — subtle vertical line on hover
    cursor: isDark ? 'rgba(34,211,238,0.1)' : 'rgba(8,145,178,0.08)',
    
    // Active dots — pulsing glow
    activeDot: (color) => ({
      r: 6,
      strokeWidth: 3,
      stroke: isDark ? '#0C1323' : '#FFFFFF',
      fill: color || (isDark ? '#22D3EE' : '#0891B2'),
      filter: `drop-shadow(0 0 6px ${color || (isDark ? '#22D3EE' : '#0891B2')}80)`,
    }),

    // Last-point dot — persistent pulsing indicator
    lastDot: (color) => ({
      r: 5,
      fill: color || (isDark ? '#22D3EE' : '#0891B2'),
      stroke: isDark ? '#0C1323' : '#FFFFFF',
      strokeWidth: 2.5,
      className: 'chart-live-dot',
    }),

    // Reference line
    refLine: isDark ? 'rgba(148,163,184,0.15)' : 'rgba(100,116,139,0.15)',
    refDash: '6 4',
    
    isDark,
  }
}
