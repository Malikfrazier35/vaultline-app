import { useAuth } from '@/hooks/useAuth'
import { usePlaid } from '@/hooks/usePlaid'
import { Database, ArrowRight, X } from 'lucide-react'
import { useState } from 'react'

export default function SampleDataBanner() {
  const { org } = useAuth()
  const { openPlaidLink, linking } = usePlaid()
  const [dismissed, setDismissed] = useState(false)

  // Only show when org has sample data and no real data
  if (!org || org.has_real_data || dismissed) return null

  return (
    <div className="mx-4 mb-4 flex items-center gap-3 px-4 py-3 rounded-xl border border-purple/[0.15] bg-purple/[0.04]">
      <Database size={16} className="text-purple shrink-0" />
      <p className="text-[13px] text-t2 flex-1">
        <span className="font-semibold text-purple">Viewing sample data.</span>{' '}
        Connect your bank to see your real treasury numbers.
      </p>
      <button
        onClick={openPlaidLink}
        disabled={linking}
        className="shrink-0 px-4 py-1.5 rounded-lg bg-gradient-to-r from-cyan to-purple text-white text-[12px] font-semibold hover:-translate-y-px transition-all"
      >
        {linking ? 'Connecting...' : <>Connect Bank <ArrowRight size={12} className="inline ml-1" /></>}
      </button>
      <button onClick={() => setDismissed(true)} className="text-t3 hover:text-t1 transition shrink-0">
        <X size={14} />
      </button>
    </div>
  )
}
