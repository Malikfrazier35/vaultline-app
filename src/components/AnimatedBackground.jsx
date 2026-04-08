import { useEffect, useRef, useCallback } from 'react'
import { useTheme } from '@/hooks/useTheme'

/**
 * AnimatedBackground — full-viewport animated canvas background.
 * 
 * Renders behind all page content via fixed positioning + z-index: 0.
 * Content sits above it naturally. The canvas covers header to footer
 * and stays fixed while the user scrolls — the page floats over it.
 *
 * Variants:
 *   "particles" — drifting data points with connection lines (landing, how-it-works)
 *   "contours"  — topographic elevation lines (security, assessment, benchmark)
 *   "dots"      — static fading dot grid (login, signup, auth pages)
 *   "none"      — renders nothing (default for product pages)
 *
 * Usage:
 *   <AnimatedBackground variant="particles" />
 *   Place at the top of the page component, before any content.
 */

const COLORS = {
  dark: { r: 34, g: 211, b: 238 },   // cyan
  light: { r: 8, g: 145, b: 178 },    // teal
}

const SECONDARY = {
  dark: { r: 129, g: 140, b: 248 },   // purple
  light: { r: 99, g: 102, b: 241 },
}

export default function AnimatedBackground({ variant = 'none' }) {
  const canvasRef = useRef(null)
  const frameRef = useRef(null)
  const stateRef = useRef(null)
  const { isDark } = useTheme()

  const prefersReducedMotion = typeof window !== 'undefined'
    && window.matchMedia?.('(prefers-reduced-motion: reduce)')?.matches

  const draw = useCallback(() => {
    if (variant === 'none') return

    const canvas = canvasRef.current
    if (!canvas) return
    const ctx = canvas.getContext('2d')
    const dpr = window.devicePixelRatio || 1
    const rect = canvas.getBoundingClientRect()
    const W = rect.width
    const H = rect.height

    if (canvas.width !== W * dpr || canvas.height !== H * dpr) {
      canvas.width = W * dpr
      canvas.height = H * dpr
      ctx.setTransform(dpr, 0, 0, dpr, 0, 0)
    }

    const col = isDark ? COLORS.dark : COLORS.light
    const sec = isDark ? SECONDARY.dark : SECONDARY.light
    const rgba = (c, a) => `rgba(${c.r},${c.g},${c.b},${a})`

    if (!stateRef.current || stateRef.current.variant !== variant) {
      stateRef.current = initState(variant, W, H)
    }
    const state = stateRef.current
    state.t += prefersReducedMotion ? 0 : 0.01

    ctx.clearRect(0, 0, W, H)

    if (variant === 'particles') drawParticles(ctx, state, W, H, col, sec, isDark, prefersReducedMotion)
    else if (variant === 'contours') drawContours(ctx, state, W, H, col, isDark)
    else if (variant === 'dots') drawDots(ctx, state, W, H, col, isDark)

    frameRef.current = requestAnimationFrame(draw)
  }, [variant, isDark, prefersReducedMotion])

  useEffect(() => {
    if (variant === 'none') return
    frameRef.current = requestAnimationFrame(draw)
    return () => {
      if (frameRef.current) cancelAnimationFrame(frameRef.current)
    }
  }, [draw, variant])

  if (variant === 'none') return null

  return (
    <canvas
      ref={canvasRef}
      aria-hidden="true"
      style={{
        position: 'fixed',
        inset: 0,
        width: '100%',
        height: '100%',
        zIndex: 0,
        pointerEvents: 'none',
      }}
    />
  )
}

// ═══════════════════════════════════════
// STATE INITIALIZATION
// ═══════════════════════════════════════

function initState(variant, W, H) {
  const state = { variant, t: 0 }

  if (variant === 'particles') {
    const count = Math.min(120, Math.floor((W * H) / 8000))
    state.particles = []
    for (let i = 0; i < count; i++) {
      state.particles.push({
        x: Math.random() * W,
        y: Math.random() * H,
        vx: (Math.random() - 0.5) * 0.25,
        vy: -0.08 - Math.random() * 0.35,
        r: 0.8 + Math.random() * 1.8,
        a: 0.15 + Math.random() * 0.35,
        phase: Math.random() * Math.PI * 2,
      })
    }
    // Ambient pulse rings
    state.pulses = []
    for (let i = 0; i < 5; i++) {
      state.pulses.push({
        x: 0.15 + Math.random() * 0.7,
        y: 0.15 + Math.random() * 0.7,
        phase: Math.random() * Math.PI * 2,
        freq: 0.3 + Math.random() * 0.5,
      })
    }
  }

  if (variant === 'dots') {
    state.spacing = 44
  }

  return state
}

// ═══════════════════════════════════════
// PARTICLE FIELD
// ═══════════════════════════════════════

function drawParticles(ctx, state, W, H, col, sec, isDark, frozen) {
  const { particles, pulses, t } = state
  const connectDist = Math.min(130, W * 0.12)

  // Move particles
  if (!frozen) {
    for (const p of particles) {
      p.x += p.vx + Math.sin(p.phase += 0.002) * 0.12
      p.y += p.vy
      if (p.y < -20) { p.y = H + 20; p.x = Math.random() * W }
      if (p.x < -20) p.x = W + 20
      if (p.x > W + 20) p.x = -20
    }
  }

  // Connection lines
  for (let i = 0; i < particles.length; i++) {
    for (let j = i + 1; j < particles.length; j++) {
      const dx = particles[i].x - particles[j].x
      const dy = particles[i].y - particles[j].y
      const d = Math.sqrt(dx * dx + dy * dy)
      if (d < connectDist) {
        const alpha = (1 - d / connectDist) * 0.1
        ctx.beginPath()
        ctx.moveTo(particles[i].x, particles[i].y)
        ctx.lineTo(particles[j].x, particles[j].y)
        ctx.strokeStyle = `rgba(${col.r},${col.g},${col.b},${alpha})`
        ctx.lineWidth = 0.4
        ctx.stroke()
      }
    }
  }

  // Draw particles
  for (const p of particles) {
    const distCenter = Math.sqrt((p.x - W / 2) ** 2 + (p.y - H / 2) ** 2)
    const maxDist = Math.sqrt((W / 2) ** 2 + (H / 2) ** 2)
    const fade = Math.max(0, 1 - (distCenter / maxDist) * 0.9)

    ctx.beginPath()
    ctx.arc(p.x, p.y, p.r, 0, Math.PI * 2)
    ctx.fillStyle = `rgba(${col.r},${col.g},${col.b},${p.a * fade})`
    ctx.fill()
  }

  // Ambient pulse rings
  for (const ring of pulses) {
    const pulse = Math.sin(t * ring.freq + ring.phase) * 0.5 + 0.5
    if (pulse > 0.6) {
      const radius = 4 + pulse * 30
      const alpha = (pulse - 0.6) * 0.15
      ctx.beginPath()
      ctx.arc(ring.x * W, ring.y * H, radius, 0, Math.PI * 2)
      ctx.strokeStyle = `rgba(${sec.r},${sec.g},${sec.b},${alpha})`
      ctx.lineWidth = 0.6
      ctx.stroke()
    }
  }

  // Radial energy wave
  const ripplePhase = (t * 0.3 % 5) / 5
  const rippleR = ripplePhase * Math.max(W, H) * 0.7
  const rippleA = Math.max(0, (1 - ripplePhase) * 0.06)
  if (rippleA > 0.001) {
    ctx.beginPath()
    ctx.arc(W / 2, H / 2, rippleR, 0, Math.PI * 2)
    ctx.strokeStyle = `rgba(${col.r},${col.g},${col.b},${rippleA})`
    ctx.lineWidth = 1
    ctx.stroke()
  }
}

// ═══════════════════════════════════════
// TOPOGRAPHIC CONTOURS
// ═══════════════════════════════════════

function drawContours(ctx, state, W, H, col, isDark) {
  const { t } = state
  const step = 14
  const levels = 12
  const maxDist = Math.sqrt((W / 2) ** 2 + (H / 2) ** 2)

  function noise(x, y) {
    return Math.sin(x * 0.008 + t * 0.3) * Math.cos(y * 0.006 + t * 0.2) * 0.5
      + Math.sin(x * 0.015 - t * 0.15) * Math.sin(y * 0.012 + t * 0.25) * 0.3
      + Math.cos(x * 0.004 + y * 0.005 + t * 0.1) * 0.2
  }

  for (let lv = 0; lv < levels; lv++) {
    const threshold = -0.6 + lv * (1.2 / levels)
    const alpha = 0.03 + (lv / levels) * (isDark ? 0.06 : 0.04)
    ctx.strokeStyle = `rgba(${col.r},${col.g},${col.b},${alpha})`
    ctx.lineWidth = 0.7
    ctx.beginPath()

    for (let x = 0; x < W; x += step) {
      for (let y = 0; y < H; y += step) {
        const v00 = noise(x, y) - threshold
        const v10 = noise(x + step, y) - threshold
        const v01 = noise(x, y + step) - threshold
        const v11 = noise(x + step, y + step) - threshold

        const cx = x + step / 2, cy = y + step / 2
        const dist = Math.sqrt((cx - W / 2) ** 2 + (cy - H / 2) ** 2)
        if (dist / maxDist > 0.92) continue

        let config = 0
        if (v00 > 0) config |= 1
        if (v10 > 0) config |= 2
        if (v11 > 0) config |= 4
        if (v01 > 0) config |= 8

        const lerp = (a, b, va, vb) => a + (b - a) * (0 - va) / (vb - va)
        const tp = lerp(x, x + step, v00, v10)
        const bt = lerp(x, x + step, v01, v11)
        const lt = lerp(y, y + step, v00, v01)
        const rt = lerp(y, y + step, v10, v11)

        if (config === 1 || config === 14) { ctx.moveTo(x, lt); ctx.lineTo(tp, y) }
        if (config === 2 || config === 13) { ctx.moveTo(tp, y); ctx.lineTo(x + step, rt) }
        if (config === 4 || config === 11) { ctx.moveTo(x + step, rt); ctx.lineTo(bt, y + step) }
        if (config === 8 || config === 7) { ctx.moveTo(bt, y + step); ctx.lineTo(x, lt) }
        if (config === 3 || config === 12) { ctx.moveTo(x, lt); ctx.lineTo(x + step, rt) }
        if (config === 6 || config === 9) { ctx.moveTo(tp, y); ctx.lineTo(bt, y + step) }
        if (config === 5) { ctx.moveTo(x, lt); ctx.lineTo(tp, y); ctx.moveTo(x + step, rt); ctx.lineTo(bt, y + step) }
        if (config === 10) { ctx.moveTo(tp, y); ctx.lineTo(x + step, rt); ctx.moveTo(bt, y + step); ctx.lineTo(x, lt) }
      }
    }
    ctx.stroke()
  }
}

// ═══════════════════════════════════════
// DOT GRID
// ═══════════════════════════════════════

function drawDots(ctx, state, W, H, col, isDark) {
  const { spacing, t } = state
  const maxDist = Math.sqrt((W / 2) ** 2 + (H / 2) ** 2)

  for (let x = spacing / 2; x < W; x += spacing) {
    for (let y = spacing / 2; y < H; y += spacing) {
      const dist = Math.sqrt((x - W / 2) ** 2 + (y - H / 2) ** 2)
      const fade = Math.max(0, 1 - (dist / maxDist) * 1.1)
      if (fade < 0.01) continue

      // Gentle wave through the grid
      const wave = 0.7 + 0.3 * Math.sin(x * 0.02 + y * 0.015 + t * 0.8)
      const baseAlpha = isDark ? 0.08 : 0.06
      const alpha = baseAlpha * fade * wave
      const radius = (isDark ? 1.2 : 1.0) * (0.8 + 0.2 * wave)

      ctx.beginPath()
      ctx.arc(x, y, radius, 0, Math.PI * 2)
      ctx.fillStyle = `rgba(${col.r},${col.g},${col.b},${alpha})`
      ctx.fill()
    }
  }
}
