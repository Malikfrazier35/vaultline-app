import { useState, useEffect, useCallback } from 'react'
import { useAuth } from '@/hooks/useAuth'
import { useTreasury } from '@/hooks/useTreasury'
import { supabase } from '@/lib/supabase'
import { useToast } from '@/components/Toast'
import { SkeletonPage } from '@/components/Skeleton'
import { Zap, CheckCircle2, Clock, AlertTriangle, Play, Pause, ArrowRight, RefreshCw, TrendingDown, Shield, Landmark, FileText, Bell } from 'lucide-react'

function timeAgo(d) {
  if (!d) return ''
  const diff = Date.now() - new Date(d).getTime()
  if (diff < 60000) return 'just now'
  if (diff < 3600000) return `${Math.floor(diff / 60000)}m ago`
  if (diff < 86400000) return `${Math.floor(diff / 3600000)}h ago`
  return new Date(d).toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: '2-digit' })
}

function fmtK(n) {
  const abs = Math.abs(n || 0)
  if (abs >= 1e6) return '$' + (abs / 1e6).toFixed(2) + 'M'
  if (abs >= 1e3) return '$' + (abs / 1e3).toFixed(1) + 'K'
  return '$' + abs.toFixed(0)
}

const STATUS_STYLES = {
  running:  { icon: RefreshCw, color: 'text-green', bg: 'bg-green/[0.06]', dot: 'bg-green animate-pulse' },
  completed: { icon: CheckCircle2, color: 'text-green', bg: 'bg-green/[0.06]', dot: 'bg-green' },
  pending:  { icon: Clock, color: 'text-amber', bg: 'bg-amber/[0.06]', dot: 'bg-amber' },
  failed:   { icon: AlertTriangle, color: 'text-red', bg: 'bg-red/[0.06]', dot: 'bg-red' },
  queued:   { icon: Pause, color: 'text-t3', bg: 'bg-deep', dot: 'bg-t4' },
}

export default function CopilotCenter() {
  const { org, profile } = useAuth()
  const { accounts, transactions, cashPosition, forecast, bankConnections, loading } = useTreasury()
  const toast = useToast()
  const [operations, setOperations] = useState([])
  const [commandInput, setCommandInput] = useState('')
  const [executing, setExecuting] = useState(false)

  useEffect(() => { document.title = 'Treasury Operations — Vaultline' }, [])

  // Build operations from real data
  useEffect(() => {
    if (loading) return
    const ops = []
    const now = new Date()
    const totalCash = cashPosition?.total_balance || 0

    // Bank sync status
    for (const bank of (bankConnections || [])) {
      const lastSync = bank.last_synced_at ? new Date(bank.last_synced_at) : null
      const stale = lastSync ? (now - lastSync) > 86400000 * 7 : true
      ops.push({
        id: `sync-${bank.institution_name}`,
        type: 'sync',
        title: `Sync ${bank.institution_name}`,
        status: stale ? 'pending' : 'completed',
        detail: lastSync ? `Last synced ${timeAgo(lastSync)}` : 'Never synced',
        timestamp: lastSync || now,
        icon: Landmark,
      })
    }

    // Untagged transactions
    const untagged = (transactions || []).filter(t => !t.category || t.category === 'other')
    if (untagged.length > 0) {
      ops.push({
        id: 'categorize',
        type: 'categorize',
        title: `Auto-categorize ${untagged.length} transactions`,
        status: 'pending',
        detail: `${untagged.length} transactions tagged as "other" or untagged`,
        timestamp: now,
        icon: FileText,
      })
    }

    // Concentration risk check
    if (accounts?.length > 1) {
      const topAccount = accounts[0]
      const topPct = totalCash > 0 ? ((topAccount?.current_balance || 0) / totalCash * 100) : 0
      if (topPct > 50) {
        ops.push({
          id: 'concentration',
          type: 'risk',
          title: `Concentration risk: ${topAccount?.bank_connections?.institution_name || 'top account'} at ${topPct.toFixed(0)}%`,
          status: 'pending',
          detail: `${fmtK(topAccount?.current_balance)} of ${fmtK(totalCash)} in one account. Recommend diversifying below 40%.`,
          timestamp: now,
          icon: Shield,
        })
      }
    }

    // Forecast freshness
    if (forecast?.generated_at) {
      const forecastAge = now - new Date(forecast.generated_at)
      if (forecastAge > 86400000 * 3) {
        ops.push({
          id: 'forecast',
          type: 'forecast',
          title: 'Regenerate forecast',
          status: 'queued',
          detail: `Current forecast is ${Math.floor(forecastAge / 86400000)} days old. Regenerate with latest data.`,
          timestamp: new Date(forecast.generated_at),
          icon: TrendingDown,
        })
      }
    }

    // Morning briefing (if before noon and not yet generated)
    const hour = now.getHours()
    if (hour < 12) {
      ops.push({
        id: 'briefing',
        type: 'briefing',
        title: 'Morning treasury briefing',
        status: 'completed',
        detail: `${fmtK(totalCash)} total cash. ${(bankConnections || []).length} banks connected. Runway: ${forecast?.runway_months ? forecast.runway_months.toFixed(1) + ' months' : 'N/A'}.`,
        timestamp: now,
        icon: Bell,
      })
    }

    // Sort: pending/running first, then completed
    ops.sort((a, b) => {
      const order = { running: 0, pending: 1, queued: 2, failed: 3, completed: 4 }
      return (order[a.status] || 5) - (order[b.status] || 5)
    })

    setOperations(ops)
  }, [loading, accounts, transactions, cashPosition, forecast, bankConnections])

  async function executeCommand(cmd) {
    if (!cmd.trim()) return
    setExecuting(true)
    setCommandInput('')
    toast.info(`Executing: ${cmd}`)

    // Route commands to copilot
    try {
      const { data: { session } } = await supabase.auth.getSession()
      const res = await fetch(
        `${import.meta.env.VITE_SUPABASE_URL}/functions/v1/copilot`,
        {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
            Authorization: `Bearer ${session.access_token}`,
            apikey: import.meta.env.VITE_SUPABASE_ANON_KEY,
          },
          body: JSON.stringify({ message: cmd, history: [], page_context: '/copilot' }),
        }
      )

      if (res.ok) {
        const reader = res.body.getReader()
        const decoder = new TextDecoder()
        let result = ''
        while (true) {
          const { done, value } = await reader.read()
          if (done) break
          const chunk = decoder.decode(value)
          for (const line of chunk.split('\n')) {
            if (line.startsWith('data: ') && line !== 'data: [DONE]') {
              try { const j = JSON.parse(line.slice(6)); if (j.type === 'content_block_delta') result += j.delta?.text || '' } catch {}
            }
          }
        }
        if (result) {
          setOperations(prev => [{
            id: `cmd-${Date.now()}`,
            type: 'command',
            title: cmd,
            status: 'completed',
            detail: result.slice(0, 300),
            timestamp: new Date(),
            icon: Zap,
          }, ...prev])
        }
      }
    } catch (err) {
      toast.error('Command failed')
    }
    setExecuting(false)
  }

  if (loading) return <SkeletonPage />

  const totalCash = cashPosition?.total_balance || 0
  const pending = operations.filter(o => ['pending', 'running', 'queued'].includes(o.status)).length
  const completed = operations.filter(o => o.status === 'completed').length

  return (
    <div className="max-w-6xl mx-auto px-6 py-8">
      {/* Header */}
      <div className="flex items-center justify-between mb-6">
        <div>
          <h1 className="text-[24px] font-display font-black tracking-tight text-t1">Treasury Operations</h1>
          <p className="text-[13px] text-t3 mt-1">Copilot-powered task execution and monitoring</p>
        </div>
        <div className="flex items-center gap-3">
          <div className="flex items-center gap-2 px-3 py-1.5 rounded-lg bg-green/[0.06] border border-green/[0.1] text-[12px] font-mono text-green">
            <span className="w-2 h-2 rounded-full bg-green animate-pulse" />
            Copilot active
          </div>
        </div>
      </div>

      {/* KPI strip */}
      <div className="grid grid-cols-4 gap-3 mb-6">
        <div className="glass-card rounded-xl p-4">
          <span className="text-[10px] font-mono uppercase tracking-wider text-t4">Total cash</span>
          <p className="text-[22px] font-mono font-black text-t1 mt-1 terminal-data">{fmtK(totalCash)}</p>
        </div>
        <div className="glass-card rounded-xl p-4">
          <span className="text-[10px] font-mono uppercase tracking-wider text-t4">Pending tasks</span>
          <p className="text-[22px] font-mono font-black text-amber mt-1">{pending}</p>
        </div>
        <div className="glass-card rounded-xl p-4">
          <span className="text-[10px] font-mono uppercase tracking-wider text-t4">Completed today</span>
          <p className="text-[22px] font-mono font-black text-green mt-1">{completed}</p>
        </div>
        <div className="glass-card rounded-xl p-4">
          <span className="text-[10px] font-mono uppercase tracking-wider text-t4">Runway</span>
          <p className="text-[22px] font-mono font-black text-t1 mt-1">{forecast?.runway_months ? forecast.runway_months.toFixed(1) + 'mo' : '—'}</p>
        </div>
      </div>

      {/* Main grid: operations + execution log */}
      <div className="grid grid-cols-[300px_1fr] gap-4">

        {/* Left: task queue */}
        <div className="glass-card rounded-2xl overflow-hidden">
          <div className="px-4 py-3 border-b border-border">
            <span className="text-[10px] font-mono font-bold uppercase tracking-[0.1em] text-t3">Operations queue</span>
          </div>
          <div className="max-h-[500px] overflow-y-auto">
            {operations.map(op => {
              const s = STATUS_STYLES[op.status] || STATUS_STYLES.queued
              const Icon = op.icon || s.icon
              return (
                <div key={op.id} className="flex items-center gap-3 px-4 py-3 border-b border-border hover:bg-deep transition">
                  <span className={`w-2 h-2 rounded-full flex-shrink-0 ${s.dot}`} />
                  <div className="flex-1 min-w-0">
                    <p className="text-[12px] font-medium text-t1 truncate">{op.title}</p>
                    <p className="text-[9px] font-mono text-t4 mt-0.5">{op.status} • {timeAgo(op.timestamp)}</p>
                  </div>
                </div>
              )
            })}
            {operations.length === 0 && (
              <div className="p-6 text-center text-[12px] text-t3">All clear — no pending operations</div>
            )}
          </div>

          {/* Command input */}
          <div className="p-3 border-t border-border">
            <div className="flex gap-2">
              <input
                value={commandInput}
                onChange={e => setCommandInput(e.target.value)}
                onKeyDown={e => e.key === 'Enter' && executeCommand(commandInput)}
                placeholder="Tell copilot what to do..."
                className="flex-1 bg-deep border border-border rounded-lg px-3 py-2 text-[12px] text-t1 placeholder:text-t4 focus:border-cyan/30 focus:outline-none"
                disabled={executing}
              />
              <button
                onClick={() => executeCommand(commandInput)}
                disabled={executing || !commandInput.trim()}
                className="px-3 py-2 rounded-lg bg-cyan/[0.08] text-cyan text-[11px] font-semibold border border-cyan/[0.1] hover:bg-cyan/[0.12] transition disabled:opacity-40"
              >
                <Play size={12} />
              </button>
            </div>
          </div>
        </div>

        {/* Right: execution log */}
        <div className="glass-card rounded-2xl overflow-hidden">
          <div className="px-4 py-3 border-b border-border">
            <span className="text-[10px] font-mono font-bold uppercase tracking-[0.1em] text-t3">Execution log</span>
          </div>
          <div className="max-h-[560px] overflow-y-auto p-4 space-y-3">
            {operations.map(op => {
              const s = STATUS_STYLES[op.status] || STATUS_STYLES.queued
              const Icon = op.icon || s.icon
              return (
                <div key={op.id} className="glass-card rounded-xl p-4 border border-border">
                  <div className="flex items-start gap-3">
                    <div className={`w-8 h-8 rounded-lg ${s.bg} flex items-center justify-center flex-shrink-0`}>
                      <Icon size={14} className={s.color} />
                    </div>
                    <div className="flex-1 min-w-0">
                      <div className="flex items-center justify-between">
                        <p className="text-[13px] font-semibold text-t1">{op.title}</p>
                        <span className="text-[9px] font-mono text-t4">{timeAgo(op.timestamp)}</span>
                      </div>
                      <p className="text-[12px] text-t3 mt-1 leading-relaxed">{op.detail}</p>
                      {op.status === 'pending' && (
                        <div className="flex gap-2 mt-3">
                          <button className="text-[10px] font-mono font-semibold px-3 py-1.5 rounded-lg bg-cyan/[0.06] text-cyan border border-cyan/[0.1] hover:bg-cyan/[0.1] transition">
                            Execute
                          </button>
                          <button className="text-[10px] font-mono font-semibold px-3 py-1.5 rounded-lg border border-border text-t3 hover:text-t1 transition">
                            Dismiss
                          </button>
                        </div>
                      )}
                    </div>
                  </div>
                </div>
              )
            })}
            {operations.length === 0 && (
              <div className="text-center py-12">
                <Zap size={24} className="text-t4 mx-auto mb-3" />
                <p className="text-[13px] text-t3">No operations today</p>
                <p className="text-[11px] text-t4 mt-1">Type a command below to get started</p>
              </div>
            )}
          </div>
        </div>
      </div>
    </div>
  )
}
