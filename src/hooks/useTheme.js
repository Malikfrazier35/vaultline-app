import { useState, useEffect, useCallback } from 'react'

const LIGHT_VARS = {
  // ── Warm backgrounds: cream/sand instead of cold slate ──
  '--color-void': '#FFFBF5',         // warm cream
  '--color-deep': '#FFF7ED',         // soft peach-white
  '--color-surface': '#FFFFFF',
  '--color-card': '#FFFFFF',
  '--color-elevated': '#FFFCF8',
  '--color-border': 'rgba(180, 140, 100, 0.12)',        // warm sand
  '--color-border-hover': 'rgba(180, 140, 100, 0.22)',
  '--color-border-cyan': 'rgba(14, 165, 180, 0.22)',
  // ── Text: warm ink tones ──
  '--color-t1': '#1C1410',           // warm near-black
  '--color-t2': '#5C4E42',           // warm brown-gray
  '--color-t3': '#8B7E72',           // warm stone
  '--color-t4': '#B5A89C',           // warm muted
  // ── Accent colors: vivid but warm-shifted ──
  '--color-cyan': '#0E9AAA',         // warm teal
  '--color-cyan-bright': '#14B8C8',
  '--color-cyan-glow': 'rgba(14, 154, 170, 0.08)',
  '--color-green': '#16A34A',
  '--color-green-soft': 'rgba(22, 163, 74, 0.07)',
  '--color-red': '#E11D48',
  '--color-red-soft': 'rgba(225, 29, 72, 0.06)',
  '--color-amber': '#D97706',
  '--color-amber-soft': 'rgba(217, 119, 6, 0.07)',
  '--color-purple': '#7C3AED',
  '--color-purple-soft': 'rgba(124, 58, 237, 0.06)',
  // ── Warm glass system ──
  '--glass-bg': 'rgba(255, 252, 248, 0.75)',
  '--glass-border': 'rgba(180, 140, 100, 0.10)',
  '--glass-highlight': 'rgba(255, 255, 255, 0.8)',
  '--glass-shadow': '0 8px 32px rgba(120, 80, 30, 0.06), 0 0 0 1px rgba(180, 140, 100, 0.06)',
  // ── Warm glass input ──
  '--glass-input-bg': 'rgba(255, 247, 237, 0.6)',
  '--glass-input-border': 'rgba(180, 140, 100, 0.12)',
  '--glass-input-shadow': 'inset 0 1px 2px rgba(120, 80, 30, 0.04), inset 0 0 0 1px rgba(180, 140, 100, 0.04)',
  // ── Warm terminal ──
  '--terminal-status-bg': 'rgba(255, 247, 237, 0.9)',
  '--terminal-status-border': 'rgba(14, 154, 170, 0.12)',
  '--terminal-inset-bg': 'rgba(255, 247, 237, 0.7)',
  '--terminal-inset-border': 'rgba(180, 140, 100, 0.08)',
  '--terminal-inset-shadow': 'inset 0 1px 3px rgba(120, 80, 30, 0.04), inset 0 0 0 1px rgba(180, 140, 100, 0.03)',
  '--terminal-label-bg': 'rgba(14, 154, 170, 0.06)',
  '--terminal-label-border': 'rgba(14, 154, 170, 0.15)',
  '--terminal-scanline-color': 'rgba(120, 80, 30, 0.012)',
  '--terminal-grid-color': 'rgba(14, 154, 170, 0.03)',
  '--terminal-live-color': '#16A34A',
  '--terminal-live-glow': 'rgba(22, 163, 74, 0.4)',
  '--noise-opacity': '0',
  // ── Warm-mode exclusive: splash gradients ──
  '--warm-gradient-sidebar': 'linear-gradient(180deg, #FFF7ED 0%, #FFF1E3 50%, #FDE8D0 100%)',
  '--warm-gradient-header': 'linear-gradient(135deg, rgba(14,154,170,0.04) 0%, rgba(217,119,6,0.04) 50%, rgba(225,29,72,0.02) 100%)',
  '--warm-gradient-kpi': 'linear-gradient(135deg, rgba(14,154,170,0.06) 0%, rgba(124,58,237,0.04) 100%)',
  '--warm-accent-line': 'linear-gradient(90deg, #0E9AAA, #D97706, #E11D48)',
  '--warm-card-shadow': '0 4px 20px rgba(180, 140, 100, 0.08)',
  '--warm-sidebar-active': 'rgba(14, 154, 170, 0.08)',
}

const DARK_VARS = {
  '--color-void': '#030711',
  '--color-deep': '#070D19',
  '--color-surface': '#0B1120',
  '--color-card': '#0C1323',
  '--color-elevated': '#141E30',
  '--color-border': 'rgba(30, 48, 80, 0.4)',
  '--color-border-hover': 'rgba(30, 48, 80, 0.7)',
  '--color-border-cyan': 'rgba(34, 211, 238, 0.25)',
  '--color-t1': '#F1F5F9',
  '--color-t2': '#94A3B8',
  '--color-t3': '#64748B',
  '--color-t4': '#475569',
  '--color-cyan': '#22D3EE',
  '--color-cyan-bright': '#67E8F9',
  '--color-cyan-glow': 'rgba(34, 211, 238, 0.12)',
  '--color-green': '#34D399',
  '--color-green-soft': 'rgba(52, 211, 153, 0.1)',
  '--color-red': '#FB7185',
  '--color-red-soft': 'rgba(251, 113, 133, 0.08)',
  '--color-amber': '#FBBF24',
  '--color-amber-soft': 'rgba(251, 191, 36, 0.08)',
  '--color-purple': '#818CF8',
  '--color-purple-soft': 'rgba(129, 140, 248, 0.1)',
  // Glass system — dark
  '--glass-bg': 'rgba(12, 19, 35, 0.65)',
  '--glass-border': 'rgba(255, 255, 255, 0.06)',
  '--glass-highlight': 'rgba(255, 255, 255, 0.04)',
  '--glass-shadow': '0 8px 32px rgba(0,0,0,0.25), 0 0 0 1px rgba(255,255,255,0.03)',
  // Glass input — dark
  '--glass-input-bg': 'rgba(7, 13, 25, 0.4)',
  '--glass-input-border': 'rgba(30, 48, 80, 0.35)',
  '--glass-input-shadow': 'inset 0 1px 3px rgba(0,0,0,0.15), inset 0 0 0 1px rgba(255,255,255,0.02)',
  // Terminal system — dark
  '--terminal-status-bg': 'rgba(3, 7, 17, 0.7)',
  '--terminal-status-border': 'rgba(34, 211, 238, 0.06)',
  '--terminal-inset-bg': 'rgba(3, 7, 17, 0.4)',
  '--terminal-inset-border': 'rgba(30, 48, 80, 0.25)',
  '--terminal-inset-shadow': 'inset 0 2px 6px rgba(0, 0, 0, 0.3), inset 0 0 0 1px rgba(255, 255, 255, 0.02)',
  '--terminal-label-bg': 'rgba(34, 211, 238, 0.04)',
  '--terminal-label-border': 'rgba(34, 211, 238, 0.08)',
  '--terminal-scanline-color': 'rgba(0, 0, 0, 0.03)',
  '--terminal-grid-color': 'rgba(34, 211, 238, 0.02)',
  '--terminal-live-color': '#34D399',
  '--terminal-live-glow': 'rgba(52, 211, 153, 0.5)',
  '--noise-opacity': '0.018',
  // Warm-mode vars (disabled in dark)
  '--warm-gradient-sidebar': 'none',
  '--warm-gradient-header': 'none',
  '--warm-gradient-kpi': 'none',
  '--warm-accent-line': 'transparent',
  '--warm-card-shadow': 'none',
  '--warm-sidebar-active': 'rgba(34, 211, 238, 0.06)',
}

function applyTheme(theme) {
  const vars = theme === 'light' ? LIGHT_VARS : DARK_VARS
  const root = document.documentElement
  Object.entries(vars).forEach(([key, val]) => {
    root.style.setProperty(key, val)
  })
}

export function useTheme() {
  const [theme, setThemeState] = useState(() => {
    if (typeof window === 'undefined') return 'dark'
    return localStorage.getItem('vaultline-theme') || 'dark'
  })

  useEffect(() => {
    applyTheme(theme)
    localStorage.setItem('vaultline-theme', theme)
  }, [theme])

  const toggleTheme = useCallback(() => {
    setThemeState((prev) => (prev === 'dark' ? 'light' : 'dark'))
  }, [])

  const setTheme = useCallback((t) => {
    setThemeState(t)
  }, [])

  return { theme, toggleTheme, setTheme, isDark: theme === 'dark' }
}
