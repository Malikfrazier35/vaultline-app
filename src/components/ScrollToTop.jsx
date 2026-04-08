import { useState, useEffect } from 'react'
import { ChevronUp } from 'lucide-react'

export default function ScrollToTop() {
  const [show, setShow] = useState(false)

  useEffect(() => {
    const el = document.querySelector('main') || window
    function onScroll() {
      const scrollY = el === window ? window.scrollY : el.scrollTop
      setShow(scrollY > 500)
    }
    el.addEventListener('scroll', onScroll, { passive: true })
    return () => el.removeEventListener('scroll', onScroll)
  }, [])

  if (!show) return null

  return (
    <button
      onClick={() => {
        const el = document.querySelector('main') || window
        el.scrollTo({ top: 0, behavior: 'smooth' })
      }}
      className="fixed bottom-20 right-6 z-40 w-10 h-10 rounded-xl bg-surface border border-border shadow-lg flex items-center justify-center text-t3 hover:text-t1 hover:border-border-hover transition-all hover:-translate-y-0.5 active:scale-95"
      title="Back to top"
    >
      <ChevronUp size={18} />
    </button>
  )
}
