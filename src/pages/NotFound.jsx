import { Link } from 'react-router-dom'
import { useEffect } from 'react'
import { ArrowLeft, Home, Search } from 'lucide-react'
import ThemeToggle from '@/components/ThemeToggle'

export default function NotFound() {
  useEffect(() => { document.title = '404 \u2014 Vaultline' }, [])

  return (
    <div className="min-h-screen flex flex-col items-center justify-center bg-void px-6 relative">
      <div className="fixed top-5 right-5 z-50"><ThemeToggle /></div>
      <div className="absolute top-[-300px] right-[-200px] w-[800px] h-[800px] bg-[radial-gradient(circle,rgba(34,211,238,0.04)_0%,transparent_60%)] pointer-events-none" />

      <div className="relative z-10 text-center max-w-md">
        <div className="w-16 h-16 rounded-2xl bg-cyan/[0.06] border border-cyan/[0.1] flex items-center justify-center mx-auto mb-6">
          <Search size={28} className="text-cyan" />
        </div>
        <p className="text-[72px] font-mono font-black text-cyan/20 leading-none mb-2 terminal-data">404</p>
        <h1 className="font-display text-[24px] font-extrabold tracking-tight mb-3">Page Not Found</h1>
        <p className="text-[14px] text-t3 mb-8">The page you're looking for doesn't exist or has been moved. Check the URL or head back to your dashboard.</p>
        <div className="flex items-center justify-center gap-3">
          <Link to="/dashboard" className="flex items-center gap-2 px-5 py-2.5 rounded-xl bg-gradient-to-r from-cyan/90 to-cyan/70 text-void text-[14px] font-semibold shadow-[0_2px_12px_rgba(34,211,238,0.2)] hover:-translate-y-px active:scale-[0.98] transition-all">
            <Home size={15} /> Dashboard
          </Link>
          <Link to="/" className="flex items-center gap-2 px-5 py-2.5 rounded-xl border border-border text-[14px] text-t2 font-semibold hover:border-border-hover hover:text-t1 transition-all">
            <ArrowLeft size={15} /> Home
          </Link>
        </div>
        <p className="text-[12px] text-t3 mt-8 font-mono">VAULTLINE \u2014 TREASURY MANAGEMENT</p>
      </div>
    </div>
  )
}
