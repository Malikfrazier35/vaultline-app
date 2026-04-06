import { useState, useEffect, useCallback } from 'react'

const LIGHT_VARS = {
  // ── Cool professional backgrounds ──
  '--color-void': '#FAFBFC',
  '--color-deep': '#F1F5F9',
  '--color-surface': '#FFFFFF',
  '--color-card': '#FFFFFF',
  '--color-elevated': '#F8FAFC',
  '--color-border': 'rgba(15, 23, 42, 0.08)',
  '--color-border-hover': 'rgba(15, 23, 42, 0.16)',
  '--color-border-cyan': 'rgba(14, 165, 180, 0.22)',
  // ── Text: cool slate tones ──
  '--color-t1': '#0F172A',
  '--color-t2': '#475569',
  '--color-t3': '#94A3B8',
  '--color-t4': '#CBD5E1',
  // ── Accent colors ──
  '--color-cyan': '#0891B2',
  '--color-cyan-bright': '#06B6D4',
  '--color-cyan-glow': 'rgba(8, 145, 178, 0.06)',
  '--color-green': '#16A34A',
  '--color-green-soft': 'rgba(22, 163, 74, 0.06)',
  '--color-red': '#DC2626',
  '--color-red-soft': 'rgba(220, 38, 38, 0.05)',
  '--color-amber': '#D97706',
  '--color-amber-soft': 'rgba(217, 119, 6, 0.06)',
  '--color-purple': '#7C3AED',
  '--color-purple-soft': 'rgba(124, 58, 237, 0.05)',
  // ── Glass system ──
  '--glass-bg': 'rgba(255, 255, 255, 0.8)',
  '--glass-border': 'rgba(15, 23, 42, 0.06)',
  '--glass-highlight': 'rgba(255, 255, 255, 0.9)',
  '--glass-shadow': '0 1px 3px rgba(15, 23, 42, 0.04), 0 0 0 1px rgba(15, 23, 42, 0.04)',
  // ── Glass input ──
  '--glass-input-bg': 'rgba(241, 245, 249, 0.6)',
  '--glass-input-border': 'rgba(15, 23, 42, 0.08)',
  '--glass-input-shadow': 'inset 0 1px 2px rgba(15, 23, 42, 0.03)',
  // ── Terminal system ──
  '--terminal-status-bg': 'rgba(248, 250, 252, 0.95)',
  '--terminal-status-border': 'rgba(8, 145, 178, 0.1)',
  '--terminal-inset-bg': 'rgba(241, 245, 249, 0.7)',
  '--terminal-inset-border': 'rgba(15, 23, 42, 0.06)',
  '--terminal-inset-shadow': 'inset 0 1px 2px rgba(15, 23, 42, 0.03)',
  '--terminal-label-bg': 'rgba(8, 145, 178, 0.05)',
  '--terminal-label-border': 'rgba(8, 145, 178, 0.12)',
  '--terminal-scanline-color': 'rgba(15, 23, 42, 0.008)',
  '--terminal-grid-color': 'rgba(8, 145, 178, 0.03)',
  '--terminal-live-color': '#16A34A',
  '--terminal-live-glow': 'rgba(22, 163, 74, 0.4)',
  '--noise-opacity': '0',
  // ── Light-mode gradients (cool) ──
  '--warm-gradient-sidebar': 'linear-gradient(180deg, #F8FAFC 0%, #F1F5F9 50%, #E2E8F0 100%)',
  '--warm-gradient-header': 'linear-gradient(135deg, rgba(8,145,178,0.03) 0%, rgba(99,102,241,0.02) 100%)',
  '--warm-gradient-kpi': 'linear-gradient(135deg, rgba(8,145,178,0.04) 0%, rgba(124,58,237,0.03) 100%)',
  '--warm-accent-line': 'linear-gradient(90deg, #0891B2, #6366F1)',
  '--warm-card-shadow': '0 1px 3px rgba(15, 23, 42, 0.04)',
  '--warm-sidebar-active': 'rgba(8, 145, 178, 0.06)',
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
    if (typeof window === 'undefined') return 'light'
    return localStorage.getItem('vaultline-theme') || 'light'
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
