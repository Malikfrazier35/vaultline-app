/**
 * chartConfig.js — Shared chart visual standards for all Vaultline pages.
 * 
 * Import and spread into Recharts components:
 *   import { barProps, lineProps, areaProps, pieProps, axisProps } from '@/lib/chartConfig'
 *   <Bar {...barProps.inflows} dataKey="inflows" />
 *   <Line {...lineProps.primary} dataKey="net" />
 *   <Area {...areaProps.primary} dataKey="balance" />
 */

// ── BAR PROPS ──
// Rounded tops, staggered animation, strong fills
export const barProps = {
  inflows: {
    radius: [6, 6, 2, 2],
    animationBegin: 200,
    animationDuration: 800,
    animationEasing: 'ease-out',
  },
  outflows: {
    radius: [6, 6, 2, 2],
    animationBegin: 350,
    animationDuration: 800,
    animationEasing: 'ease-out',
  },
  // Generic bar — for single-series charts
  default: {
    radius: [6, 6, 2, 2],
    animationBegin: 200,
    animationDuration: 800,
    animationEasing: 'ease-out',
  },
  // Stacked bars — tighter radius for middle segments
  stacked: {
    radius: [4, 4, 0, 0],
    animationBegin: 200,
    animationDuration: 800,
    animationEasing: 'ease-out',
  },
}

// ── LINE PROPS ──
// Smooth curves, delayed after bars, proper active dots
export const lineProps = {
  primary: {
    type: 'monotone',
    strokeWidth: 2.5,
    dot: false,
    animationBegin: 600,
    animationDuration: 1000,
    animationEasing: 'ease-out',
    connectNulls: true,
  },
  secondary: {
    type: 'monotone',
    strokeWidth: 2,
    dot: false,
    animationBegin: 700,
    animationDuration: 1000,
    animationEasing: 'ease-out',
    connectNulls: true,
  },
  dashed: {
    type: 'monotone',
    strokeWidth: 2,
    strokeDasharray: '4 3',
    dot: false,
    animationBegin: 800,
    animationDuration: 1000,
    animationEasing: 'ease-out',
    connectNulls: true,
  },
  forecast: {
    type: 'monotone',
    strokeWidth: 2,
    strokeDasharray: '6 4',
    dot: false,
    animationBegin: 900,
    animationDuration: 1200,
    animationEasing: 'ease-out',
    connectNulls: true,
  },
}

// ── AREA PROPS ──
// Gradient fills fading to transparent
export const areaProps = {
  primary: {
    type: 'monotone',
    strokeWidth: 2,
    animationBegin: 300,
    animationDuration: 1000,
    animationEasing: 'ease-out',
    connectNulls: true,
    fillOpacity: 1,
  },
  band: {
    type: 'monotone',
    strokeWidth: 0,
    animationBegin: 400,
    animationDuration: 1000,
    animationEasing: 'ease-out',
    fillOpacity: 0.15,
  },
}

// ── PIE PROPS ──
// Animated segment growth
export const pieProps = {
  default: {
    animationBegin: 200,
    animationDuration: 1000,
    animationEasing: 'ease-out',
    startAngle: 90,
    endAngle: -270,
    innerRadius: '55%',
    outerRadius: '85%',
    paddingAngle: 2,
    strokeWidth: 0,
  },
  donut: {
    animationBegin: 200,
    animationDuration: 1000,
    animationEasing: 'ease-out',
    startAngle: 90,
    endAngle: -270,
    innerRadius: '60%',
    outerRadius: '82%',
    paddingAngle: 3,
    strokeWidth: 0,
  },
  full: {
    animationBegin: 200,
    animationDuration: 1000,
    animationEasing: 'ease-out',
    startAngle: 90,
    endAngle: -270,
    innerRadius: 0,
    outerRadius: '85%',
    paddingAngle: 1,
    strokeWidth: 0,
  },
}

// ── AXIS PROPS ──
// Consistent tick styling
export const axisProps = {
  x: {
    axisLine: false,
    tickLine: false,
    tick: { fontSize: 10, fontFamily: "'JetBrains Mono', monospace", fontWeight: 500 },
  },
  y: {
    axisLine: false,
    tickLine: false,
    tick: { fontSize: 10, fontFamily: "'JetBrains Mono', monospace", fontWeight: 500 },
    width: 60,
  },
}

// ── GRADIENT DEFS ──
// Reusable SVG gradient definitions for charts
export function ChartGradients({ isDark }) {
  return (
    <defs>
      <linearGradient id="gradInflow" x1="0" y1="0" x2="0" y2="1">
        <stop offset="0%" stopColor={isDark ? '#34D399' : '#059669'} stopOpacity={0.9} />
        <stop offset="100%" stopColor={isDark ? '#34D399' : '#059669'} stopOpacity={0.6} />
      </linearGradient>
      <linearGradient id="gradOutflow" x1="0" y1="0" x2="0" y2="1">
        <stop offset="0%" stopColor={isDark ? '#FB7185' : '#DC2626'} stopOpacity={0.8} />
        <stop offset="100%" stopColor={isDark ? '#FB7185' : '#DC2626'} stopOpacity={0.5} />
      </linearGradient>
      <linearGradient id="gradArea" x1="0" y1="0" x2="0" y2="1">
        <stop offset="0%" stopColor={isDark ? '#22D3EE' : '#0891B2'} stopOpacity={0.3} />
        <stop offset="100%" stopColor={isDark ? '#22D3EE' : '#0891B2'} stopOpacity={0.02} />
      </linearGradient>
      <linearGradient id="gradAreaGreen" x1="0" y1="0" x2="0" y2="1">
        <stop offset="0%" stopColor={isDark ? '#34D399' : '#059669'} stopOpacity={0.25} />
        <stop offset="100%" stopColor={isDark ? '#34D399' : '#059669'} stopOpacity={0.02} />
      </linearGradient>
      <linearGradient id="gradAreaPurple" x1="0" y1="0" x2="0" y2="1">
        <stop offset="0%" stopColor={isDark ? '#818CF8' : '#6366F1'} stopOpacity={0.2} />
        <stop offset="100%" stopColor={isDark ? '#818CF8' : '#6366F1'} stopOpacity={0.02} />
      </linearGradient>
      <linearGradient id="gradBand" x1="0" y1="0" x2="0" y2="1">
        <stop offset="0%" stopColor={isDark ? '#22D3EE' : '#0891B2'} stopOpacity={0.1} />
        <stop offset="100%" stopColor={isDark ? '#22D3EE' : '#0891B2'} stopOpacity={0.03} />
      </linearGradient>
    </defs>
  )
}

// ── ACTIVE DOT ──
// Pulsing dot for the active/hovered point
export function getActiveDot(color, isDark) {
  return {
    r: 6,
    strokeWidth: 2.5,
    stroke: isDark ? '#0C1323' : '#FFFFFF',
    fill: color,
    filter: `drop-shadow(0 0 4px ${color}80)`,
  }
}

// ── LAST POINT DOT ──
// Persistent dot on the most recent data point
export function getLastDot(color, isDark) {
  return {
    r: 4,
    fill: color,
    stroke: isDark ? '#0C1323' : '#FFFFFF',
    strokeWidth: 2,
  }
}
