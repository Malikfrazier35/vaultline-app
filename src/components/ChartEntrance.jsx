import { useState, useEffect, useRef } from 'react'

/**
 * ChartEntrance — wraps a chart in a slide-up fade-in animation on mount.
 * Also handles the "hover at bottom" concept — chart container has a subtle
 * floating shadow at the bottom edge to anchor it visually.
 *
 * Usage:
 *   <ChartEntrance height={260}>
 *     <ResponsiveContainer width="100%" height="100%">
 *       <ComposedChart data={data}>...</ComposedChart>
 *     </ResponsiveContainer>
 *   </ChartEntrance>
 */
export default function ChartEntrance({
  children,
  height = 260,
  delay = 100,
  className = '',
}) {
  const [visible, setVisible] = useState(false)
  const ref = useRef(null)

  useEffect(() => {
    const timer = setTimeout(() => setVisible(true), delay)
    return () => clearTimeout(timer)
  }, [delay])

  return (
    <div
      ref={ref}
      className={`relative ${className}`}
      style={{
        height,
        overflow: 'hidden',
      }}
    >
      {/* Chart content with entrance animation */}
      <div
        style={{
          height: '100%',
          opacity: visible ? 1 : 0,
          transform: visible ? 'translateY(0)' : 'translateY(16px)',
          transition: 'opacity 0.6s ease-out, transform 0.6s ease-out',
        }}
      >
        {children}
      </div>

      {/* Bottom anchor shadow — subtle gradient fade */}
      <div
        style={{
          position: 'absolute',
          bottom: 0,
          left: 0,
          right: 0,
          height: 24,
          background: 'linear-gradient(to top, var(--color-card) 0%, transparent 100%)',
          pointerEvents: 'none',
          opacity: 0.4,
        }}
      />
    </div>
  )
}
