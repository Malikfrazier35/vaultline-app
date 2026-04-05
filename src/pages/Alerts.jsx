import { useState, useEffect, useMemo } from 'react'
import { SkeletonPage } from '@/components/Skeleton'
import { useTreasury } from '@/hooks/useTreasury'
import { useAuth } from '@/hooks/useAuth'
import { supabase } from '@/lib/supabase'
import {
  Bell, AlertTriangle, TrendingDown, TrendingUp, CreditCard, ArrowDownRight,
  DollarSign, Check, Clock, Filter, RefreshCw, ChevronRight, Zap, Shield
} from 'lucide-react'

function fmt(n) {
  const abs = Math.abs(n || 0)
  if (abs >= 1e6) return '$' + (abs / 1e6).toFixed(2) + 'M'
  if (abs >= 1e3) return '$' + (abs / 1e3).toFixed(1) + 'K'
  return '$' + abs.toFixed(0)
}

export default function Alerts() {
  const { accounts, transactions, cashPosition, forecast, bankConnections, loading } = useTreasury()
  const { org } = useAuth()
  const [filter, setFilter] = useState('all')
  const [dismissed, setDismissed] = useState(new Set())
  const [toast, setToast] = useState(null)

  useEffect(() => { document.title = 'Alerts — Vaultline' }, [])

  const totalCash = cashPosition?.total_balance || 0
  const monthlyBurn = forecast?.monthly_burn || 0
  const runway = forecast?.runway_months || 0

  // Generate smart alerts from real data
  const alerts = useMemo(() => {
    if (loading) return []
    const list = []
    const now = new Date()

    // Low balance alerts
    ;(accounts || []).forEach(acct => {
      if (acct.current_balance < 10000 && acct.current_balance > 0) {
        list.push({ id: `low-${acct.id}`, type: 'critical', icon: AlertTriangle, color: 'red',
          title: `Low balance: ${acct.bank_connections?.institution_name || acct.name}`,
          message: `Account balance is ${fmt(acct.current_balance)} — below the $10K threshold.`,
          time: now, category: 'balance' })
      }
    })

    // Runway alert
    if (runway > 0 && runway < 6) {
      list.push({ id: 'runway-low', type: 'critical', icon: TrendingDown, color: 'red',
        title: 'Cash runway below 6 months',
        message: `At current burn rate of ${fmt(monthlyBurn)}/mo, runway is ${runway.toFixed(1)} months. Consider reducing spend or raising capital.`,
        time: now, category: 'forecast' })
    } else if (runway >= 6 && runway < 12) {
      list.push({ id: 'runway-watch', type: 'warning', icon: Clock, color: 'amber',
        title: 'Cash runway under 12 months',
        message: `Runway is ${runway.toFixed(1)} months at ${fmt(monthlyBurn)}/mo burn. Monitor closely.`,
        time: now, category: 'forecast' })
    }

    // Large transactions (>$50K)
    const recentTx = transactions.filter(t => new Date(t.date) >= new Date(now.getTime() - 7 * 86400000))
    recentTx.forEach(tx => {
      if (Math.abs(tx.amount) > 50000) {
        list.push({ id: `large-${tx.id}`, type: tx.amount < 0 ? 'info' : 'warning', icon: tx.amount < 0 ? TrendingUp : ArrowDownRight,
          color: tx.amount < 0 ? 'green' : 'amber',
          title: `Large ${tx.amount < 0 ? 'inflow' : 'outflow'}: ${fmt(Math.abs(tx.amount))}`,
          message: `${tx.description} on ${new Date(tx.date).toLocaleDateString('en-US', { month: 'short', day: 'numeric' })}`,
          time: new Date(tx.date), category: 'transaction' })
      }
    })

    // Disconnected banks
    bankConnections?.forEach(b => {
      if (b.status === 'error' || b.status === 'disconnected') {
        list.push({ id: `bank-${b.id}`, type: 'warning', icon: CreditCard, color: 'amber',
          title: `Bank connection issue: ${b.institution_name}`,
          message: b.error_message || 'Connection needs to be re-authenticated.',
          time: now, category: 'connection' })
      }
    })

    // Stale sync (>24h)
    bankConnections?.forEach(b => {
      if (b.status === 'connected' && b.last_synced_at) {
        const lastSync = new Date(b.last_synced_at)
        if (now.getTime() - lastSync.getTime() > 24 * 3600000) {
          list.push({ id: `stale-${b.id}`, type: 'info', icon: RefreshCw, color: 'cyan',
            title: `Sync overdue: ${b.institution_name}`,
            message: `Last synced ${lastSync.toLocaleDateString()}. Click Sync Now to refresh.`,
            time: lastSync, category: 'connection' })
        }
      }
    })

    // Cash flow positive/negative
    const thirtyDayTx = transactions.filter(t => new Date(t.date) >= new Date(now.getTime() - 30 * 86400000))
    const inflows = thirtyDayTx.filter(t => t.amount < 0).reduce((s, t) => s + Math.abs(t.amount), 0)
    const outflows = thirtyDayTx.filter(t => t.amount > 0).reduce((s, t) => s + t.amount, 0)
    if (outflows > inflows && inflows > 0) {
      list.push({ id: 'cashflow-neg', type: 'warning', icon: TrendingDown, color: 'amber',
        title: 'Negative cash flow this month',
        message: `Outflows (${fmt(outflows)}) exceed inflows (${fmt(inflows)}) by ${fmt(outflows - inflows)}.`,
        time: now, category: 'forecast' })
    }

    // Healthy position
    if (list.filter(a => a.type === 'critical').length === 0 && totalCash > 0) {
      list.push({ id: 'healthy', type: 'success', icon: Shield, color: 'green',
        title: 'Treasury position is healthy',
        message: `${fmt(totalCash)} total cash across ${accounts.length} account${accounts.length !== 1 ? 's' : ''}. No critical alerts.`,
        time: now, category: 'balance' })
    }

    return list.sort((a, b) => {
      const priority = { critical: 0, warning: 1, info: 2, success: 3 }
      return (priority[a.type] || 9) - (priority[b.type] || 9)
    })
  }, [accounts, transactions, cashPosition, forecast, bankConnections, loading])

  if (loading) return <SkeletonPage />

  const filtered = filter === 'all' ? alerts : alerts.filter(a => a.category === filter)
  const visible = filtered.filter(a => !dismissed.has(a.id))

  const criticalCount = alerts.filter(a => a.type === 'critical').length
  const warningCount = alerts.filter(a => a.type === 'warning').length

  const typeColors = {
    critical: { bg: 'bg-red/[0.06]', border: 'border-red/[0.15]', badge: 'bg-red/[0.1] text-red' },
    warning: { bg: 'bg-amber/[0.06]', border: 'border-amber/[0.12]', badge: 'bg-amber/[0.1] text-amber' },
    info: { bg: 'bg-cyan/[0.04]', border: 'border-cyan/[0.1]', badge: 'bg-cyan/[0.1] text-cyan' },
    success: { bg: 'bg-green/[0.04]', border: 'border-green/[0.1]', badge: 'bg-green/[0.1] text-green' },
  }

  return (
    <div className="max-w-[860px] mx-auto space-y-7">
      {/* Summary bar */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
        <div className="glass-card rounded-2xl p-4 text-center">
          <p className="font-display text-[28px] font-extrabold text-t1">{alerts.length}</p>
          <p className="text-[13px] text-t2 mt-1">Total Alerts</p>
        </div>
        <div className="glass-card border-red/[0.12] rounded-2xl p-4 text-center">
          <p className="font-display text-[28px] font-extrabold text-red">{criticalCount}</p>
          <p className="text-[13px] text-t2 mt-1">Critical</p>
        </div>
        <div className="glass-card border-amber/[0.12] rounded-2xl p-4 text-center">
          <p className="font-display text-[28px] font-extrabold text-amber">{warningCount}</p>
          <p className="text-[13px] text-t2 mt-1">Warnings</p>
        </div>
        <div className="glass-card border-green/[0.12] rounded-2xl p-4 text-center">
          <p className="font-display text-[28px] font-extrabold text-green">{alerts.filter(a => a.type === 'success').length}</p>
          <p className="text-[13px] text-t2 mt-1">Healthy</p>
        </div>
      </div>

      {/* Filter tabs */}
      <div className="flex items-center gap-1 border-b border-border pb-0">
        {[
          { id: 'all', label: 'All' },
          { id: 'balance', label: 'Balance' },
          { id: 'transaction', label: 'Transactions' },
          { id: 'forecast', label: 'Forecast' },
          { id: 'connection', label: 'Connections' },
        ].map(t => (
          <button key={t.id} onClick={() => setFilter(t.id)}
            className={`px-4 py-3 text-[13px] font-medium border-b-2 transition ${
              filter === t.id ? 'border-cyan text-cyan' : 'border-transparent text-t3 hover:text-t1'
            }`}>
            {t.label}
          </button>
        ))}
      </div>

      {/* Alert list */}
      <div className="space-y-3">
        {visible.map(alert => {
          const tc = typeColors[alert.type]
          return (
            <div key={alert.id} className={`${tc.bg} border ${tc.border} rounded-2xl p-5 flex items-start gap-4 hover:shadow-[0_0_24px_rgba(0,0,0,0.05)] transition-all group`}>
              <div className={`w-10 h-10 rounded-xl flex items-center justify-center shrink-0 ${tc.badge}`}>
                <alert.icon size={18} />
              </div>
              <div className="flex-1 min-w-0">
                <div className="flex items-center gap-2 mb-1">
                  <h4 className="text-[14px] font-bold text-t1">{alert.title}</h4>
                  <span className={`px-2 py-0.5 rounded-md text-[11px] font-mono font-bold uppercase tracking-wider ${tc.badge}`}>
                    {alert.type}
                  </span>
                </div>
                <p className="text-[13px] text-t2 leading-relaxed">{alert.message}</p>
              </div>
              <button onClick={() => { setDismissed(new Set([...dismissed, alert.id])); setToast('Alert dismissed'); setTimeout(() => setToast(null), 2000) }}
                className="opacity-0 group-hover:opacity-100 p-1.5 rounded-lg hover:bg-deep text-t3 hover:text-t2 transition shrink-0">
                <Check size={14} />
              </button>
            </div>
          )
        })}
        {visible.length === 0 && (
          <div className="text-center py-16">
            <div className="w-14 h-14 rounded-2xl bg-green/[0.06] flex items-center justify-center mx-auto mb-3">
              <Check size={24} className="text-green" />
            </div>
            <p className="text-[15px] font-bold terminal-data text-t1">All clear</p>
            <p className="text-[13px] text-t2 mt-1">No active alerts in this category</p>
          </div>
        )}
      </div>

      {/* Alert rules */}
      <div className="glass-card rounded-2xl p-6 terminal-scanlines relative">
        <div className="flex items-center gap-2.5 mb-5">
          <Zap size={16} className="text-cyan" />
          <span className="terminal-label">ALERT RULES</span>
        </div>
        <div className="space-y-3">
          {[
            { name: 'Low Balance', trigger: 'Account drops below $10,000', status: 'active' },
            { name: 'Large Transaction', trigger: 'Single transaction exceeds $50,000', status: 'active' },
            { name: 'Runway Warning', trigger: 'Cash runway falls below 12 months', status: 'active' },
            { name: 'Sync Failure', trigger: 'Bank connection fails to sync for 24h', status: 'active' },
            { name: 'Negative Cash Flow', trigger: 'Monthly outflows exceed inflows', status: 'active' },
            { name: 'FX Rate Alert', trigger: 'Currency exchange rate moves >2%', status: 'coming_soon' },
            { name: 'Slack Notifications', trigger: 'Push critical alerts to Slack channel', status: 'coming_soon' },
          ].map(rule => (
            <div key={rule.name} className="flex items-center justify-between py-2.5 border-b border-border last:border-0">
              <div>
                <p className="text-[14px] font-medium text-t1">{rule.name}</p>
                <p className="text-[13px] text-t2">{rule.trigger}</p>
              </div>
              <span className={`px-2.5 py-1 rounded-lg text-[12px] font-mono font-semibold ${
                rule.status === 'active' ? 'bg-green/[0.08] text-green' : 'bg-border/30 text-t3'
              }`}>
                {rule.status === 'active' ? 'Active' : 'Inactive'}
              </span>
            </div>
          ))}
        </div>
      </div>
      {toast && (
        <div className="fixed bottom-6 right-6 z-50 glass-card rounded-xl px-5 py-3 shadow-[0_8px_32px_rgba(0,0,0,0.3)] border-green/[0.15] animate-[slideUp_0.3s_ease-out]">
          <p className="text-[13px] text-green font-mono">{toast}</p>
        </div>
      )}
    </div>
  )
}
