/**
 * Skeleton — Shimmer loading placeholders.
 * Usage:
 *   <Skeleton className="h-6 w-48" />
 *   <Skeleton variant="kpi" count={4} />
 *   <Skeleton variant="card" count={3} />
 *   <SkeletonPage />  — full page skeleton with KPIs + cards
 */

export function Skeleton({ className = '', variant, count = 1 }) {
  if (variant === 'kpi') {
    return (
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
        {Array.from({ length: count }).map((_, i) => (
          <div key={i} className="skeleton skeleton-kpi" style={{ animationDelay: `${i * 0.1}s` }} />
        ))}
      </div>
    )
  }

  if (variant === 'card') {
    return (
      <div className="space-y-3">
        {Array.from({ length: count }).map((_, i) => (
          <div key={i} className="skeleton skeleton-card" style={{ animationDelay: `${i * 0.1}s` }} />
        ))}
      </div>
    )
  }

  if (variant === 'table') {
    return (
      <div className="space-y-2">
        <div className="skeleton h-10 w-full rounded-lg" />
        {Array.from({ length: count }).map((_, i) => (
          <div key={i} className="skeleton h-12 w-full rounded-lg" style={{ animationDelay: `${i * 0.05}s` }} />
        ))}
      </div>
    )
  }

  if (variant === 'text') {
    return (
      <div className="space-y-2">
        {Array.from({ length: count }).map((_, i) => (
          <div key={i} className="skeleton skeleton-text" style={{ width: `${70 + Math.random() * 30}%`, animationDelay: `${i * 0.05}s` }} />
        ))}
      </div>
    )
  }

  return <div className={`skeleton ${className}`} />
}

/** Full page skeleton — drop-in replacement for loading spinners */
export function SkeletonPage() {
  return (
    <div className="space-y-6 page-enter">
      {/* Title area */}
      <div className="space-y-2">
        <div className="skeleton h-7 w-48 rounded-lg" />
        <div className="skeleton h-4 w-72 rounded" />
      </div>
      {/* KPIs */}
      <Skeleton variant="kpi" count={4} />
      {/* Tabs */}
      <div className="flex gap-2">
        {[1,2,3,4].map(i => <div key={i} className="skeleton h-9 w-20 rounded-lg" />)}
      </div>
      {/* Cards */}
      <Skeleton variant="card" count={3} />
    </div>
  )
}

export default Skeleton
