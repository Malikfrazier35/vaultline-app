import { useState, useEffect } from 'react'
import { SkeletonPage } from '@/components/Skeleton'
import BankLogo from '@/components/BankLogo'
import { useTreasury } from '@/hooks/useTreasury'
import { useAuth } from '@/hooks/useAuth'
import { usePlaid } from '@/hooks/usePlaid'
import { supabase } from '@/lib/supabase'
import { useToast } from '@/components/Toast'
import { Plus, AlertCircle, RefreshCw, Link2, ArrowRight, Check, Trash2, Loader2, Crown } from 'lucide-react'
import { Link } from 'react-router-dom'

export default function BankConnections() {
  const { bankConnections, accounts, loading, refetch } = useTreasury()
  const { org } = useAuth()
  const { openPlaidLink, syncing, linking, error: plaidError } = usePlaid({ onSuccess: () => { refetch(); toast.success('Bank connected successfully') } })
  const toast = useToast()
  const [qbConnection, setQbConnection] = useState(null)
  const [qbSyncing, setQbSyncing] = useState(false)
  const [qbConnecting, setQbConnecting] = useState(false)
  const [removing, setRemoving] = useState(null)

  // Unified connectors (Xero, NetSuite, Sage)
  const [acctConnections, setAcctConnections] = useState({})
  const [acctConnecting, setAcctConnecting] = useState(null)
  const [acctSyncing, setAcctSyncing] = useState(null)

  const maxConns = org?.max_bank_connections || 25

  useEffect(() => { document.title = 'Bank Connections — Vaultline' }, [])
  useEffect(() => { loadQB(); loadAcctConnections() }, [])

  async function loadQB() {
    try {
      const { data } = await supabase.from('qb_connections').select('*').order('created_at', { ascending: false }).limit(1).single()
      if (data) setQbConnection(data)
    } catch {}
  }

  async function loadAcctConnections() {
    try {
      const { data } = await supabase.from('accounting_connections').select('*').order('created_at', { ascending: false })
      const map = {}
      for (const c of data || []) { map[c.provider] = c }
      setAcctConnections(map)
    } catch {}
  }

  async function connectQuickBooks() {
    setQbConnecting(true)
    try {
      const { data, error } = await supabase.functions.invoke('qb-auth')
      if (error) throw new Error(error.message)
      if (data?.error) throw new Error(data.error)
      if (data?.auth_url) window.location.href = data.auth_url
      else { toast.error('QuickBooks integration not configured yet', 'Coming Soon'); setQbConnecting(false) }
    } catch (err) { console.error('QB connect error:', err); toast.error(err.message || 'QuickBooks not available', 'Connection failed'); setQbConnecting(false) }
  }

  async function syncQuickBooks() {
    setQbSyncing(true)
    try {
      await supabase.functions.invoke('qb-sync')
      loadQB(); refetch()
    } catch (err) { console.error('QB sync error:', err); toast.error(err.message, 'QuickBooks sync failed') }
    finally { setQbSyncing(false) }
  }

  async function connectAccounting(provider) {
    setAcctConnecting(provider)
    try {
      const { data, error } = await supabase.functions.invoke('acct-auth', { body: { provider } })
      if (error) throw new Error(error.message)
      if (data?.error) throw new Error(data.error)
      if (data?.auth_url) window.location.href = data.auth_url
      else { toast.error(`${provider} integration not configured yet`, 'Coming Soon'); setAcctConnecting(null) }
    } catch (err) { console.error(err); toast.error(err.message || 'Not available', 'Connection failed'); setAcctConnecting(null) }
  }

  async function syncAccounting(provider) {
    setAcctSyncing(provider)
    try {
      await supabase.functions.invoke('acct-sync', { body: { provider } })
      loadAcctConnections(); refetch()
    } catch (err) { console.error(err); toast.error(err.message, 'Sync failed') }
    finally { setAcctSyncing(null) }
  }

  async function removeConnection(bankId, type) {
    if (!confirm('Remove this connection? This will delete the connection and all associated accounts and transactions.')) return
    setRemoving(bankId)
    try {
      // Delete transactions for accounts under this bank connection
      const { data: accts } = await supabase.from('accounts').select('id').eq('bank_connection_id', bankId)
      if (accts?.length) {
        const ids = accts.map(a => a.id)
        await supabase.from('transactions').delete().in('account_id', ids)
        await supabase.from('daily_balances').delete().in('account_id', ids)
      }
      // Delete accounts
      await supabase.from('accounts').delete().eq('bank_connection_id', bankId)
      // Delete the bank connection itself
      await supabase.from('bank_connections').delete().eq('id', bankId)

      // If it's a QB connection, also delete qb_connections record
      if (type === 'qb') {
        await supabase.from('qb_connections').delete().eq('org_id', org.id)
        setQbConnection(null)
      }

      refetch()
    } catch (err) { console.error('Remove error:', err); toast.error(err.message, 'Failed to remove connection') }
    finally { setRemoving(null) }
  }

  async function removeAcctConnection(provider) {
    if (!confirm(`Disconnect ${provider}? This will remove the connection and all synced data.`)) return
    setRemoving(provider)
    try {
      const conn = acctConnections[provider]
      if (conn) {
        await supabase.from('accounting_connections').delete().eq('id', conn.id)
      }
      // Find and remove the bank connection + data for this provider
      const connName = `${provider.charAt(0).toUpperCase() + provider.slice(1)}:`
      const { data: bankConns } = await supabase.from('bank_connections').select('id').eq('org_id', org.id).like('institution_name', `${connName}%`)
      for (const bc of bankConns || []) {
        const { data: accts } = await supabase.from('accounts').select('id').eq('bank_connection_id', bc.id)
        if (accts?.length) {
          await supabase.from('transactions').delete().in('account_id', accts.map(a => a.id))
          await supabase.from('daily_balances').delete().in('account_id', accts.map(a => a.id))
        }
        await supabase.from('accounts').delete().eq('bank_connection_id', bc.id)
        await supabase.from('bank_connections').delete().eq('id', bc.id)
      }
      loadAcctConnections(); refetch(); toast.success('Connection removed')
    } catch (err) { console.error(err); toast.error(err.message, 'Failed to remove connection') }
    finally { setRemoving(null) }
  }

  if (loading) {
    return <div className="flex items-center justify-center h-64"><div className="w-8 h-8 border-2 border-cyan border-t-transparent rounded-full animate-spin" /></div>
  }

  const plaidConns = bankConnections.filter(b => !b.institution_name?.startsWith('QuickBooks:') && !b.institution_name?.startsWith('Manual') && !b.institution_name?.startsWith('Xero:') && !b.institution_name?.startsWith('NetSuite:') && !b.institution_name?.startsWith('Sage:'))
  const manualConns = bankConnections.filter(b => b.institution_name?.startsWith('Manual'))
  const qbBankConns = bankConnections.filter(b => b.institution_name?.startsWith('QuickBooks:'))

  const CONNECTORS = [
    { id: 'xero', name: 'Xero', color: '#13B5EA', desc: 'Sync bank accounts, invoices, bills from Xero' },
    { id: 'netsuite', name: 'NetSuite', color: '#1B3D6D', desc: 'Enterprise ERP sync — GL, AP, AR, bank data' },
    { id: 'sage', name: 'Sage', color: '#00DC00', desc: 'Sage Business Cloud — bank accounts, invoices' },
  ]

  return (
    <div className="space-y-6">
      {/* Usage bar */}
      <div className="glass-card rounded-[14px] p-5 terminal-scanlines relative flex items-center justify-between">
        <div>
          <p className="text-sm font-medium text-t1">{bankConnections.length} of {maxConns} connections used</p>
          <p className="text-xs text-t3 mt-1">Connect banks via Plaid, or sync from accounting software</p>
        </div>
        <div className="w-48 h-2 bg-deep rounded-full overflow-hidden">
          <div className="h-full bg-cyan rounded-full transition-all" style={{ width: `${Math.min((bankConnections.length / maxConns) * 100, 100)}%` }} />
        </div>
      </div>

      {/* ═══ Plaid Direct Bank Connections ═══ */}
      <div>
        <div className="flex items-center justify-between mb-3">
          <div className="flex items-center gap-2"><span className="terminal-label">
            <div className="w-6 h-6 rounded-md bg-cyan-glow flex items-center justify-center"><Link2 size={14} className="text-cyan" /></div>
            Direct Bank Connections (Plaid)
          </span></div>
          {bankConnections.length >= maxConns ? (
            <Link to="/billing"
              className="flex items-center gap-1.5 px-4 py-2 rounded-[10px] bg-amber/[0.08] border border-amber/[0.12] text-amber text-[13px] font-semibold hover:bg-amber/[0.12] transition-all">
              <Crown size={14} /> {bankConnections.length}/{maxConns} — Upgrade for More
            </Link>
          ) : (
            <button onClick={openPlaidLink} disabled={linking}
              className="flex items-center gap-1.5 px-4 py-2 rounded-[10px] bg-gradient-to-r from-cyan to-sky-400 text-void text-[13px] font-semibold hover:-translate-y-px active:scale-[0.98] transition-all disabled:opacity-50">
              <Plus size={14} /> {linking ? 'Opening...' : `Add Bank (${bankConnections.length}/${maxConns})`}
            </button>
          )}
        </div>

        {plaidError && (
          <div className="flex items-center justify-between bg-red-soft text-red text-[13px] rounded-xl px-4 py-2.5 mb-3">
            <div className="flex items-center gap-2"><AlertCircle size={14} /> {plaidError}</div>
            <button onClick={() => { /* clear via re-render */ window.location.reload() }} className="text-[11px] font-mono hover:underline">Dismiss</button>
          </div>
        )}

        {plaidConns.length > 0 ? (
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
            {plaidConns.map((bank) => {
              const bankAccounts = accounts.filter((a) => a.bank_connection_id === bank.id)
              return (
                <div key={bank.id} className="glass-card rounded-[14px] p-4 flex items-center gap-3 hover:border-border-cyan transition group">
                  <BankLogo
                    name={bank.institution_name}
                    color={bank.institution_color}
                    size={40}
                    className="shrink-0"
                  />
                  <div className="flex-1 min-w-0">
                    <p className="text-[14px] font-semibold text-t1 truncate">{bank.institution_name}</p>
                    <p className="text-[13px] text-t3 font-mono">{bankAccounts.length} acct{bankAccounts.length !== 1 ? 's' : ''} {bank.last_synced_at && `· ${timeSince(bank.last_synced_at)}`}</p>
                  </div>
                  <button onClick={() => removeConnection(bank.id, 'plaid')} disabled={removing === bank.id}
                    className="opacity-0 group-hover:opacity-100 p-1.5 rounded-lg hover:bg-red-soft text-t3 hover:text-red transition-all disabled:opacity-50">
                    {removing === bank.id ? <Loader2 size={14} className="animate-spin" /> : <Trash2 size={14} />}
                  </button>
                </div>
              )
            })}
          </div>
        ) : (
          <div className="border border-dashed border-border rounded-[14px] p-8 text-center">
            <p className="text-[14px] text-t2 mb-3">No banks connected via Plaid yet</p>
            <button onClick={openPlaidLink} disabled={linking}
              className="px-5 py-2 rounded-[10px] bg-gradient-to-r from-cyan to-sky-400 text-void text-[13px] font-semibold hover:-translate-y-px active:scale-[0.98] transition-all disabled:opacity-50">
              {linking ? 'Opening Plaid...' : 'Connect Your First Bank'}
            </button>
          </div>
        )}
      </div>

      {/* ═══ QuickBooks ═══ */}
      <div>
        <div className="flex items-center justify-between mb-3">
          <div className="flex items-center gap-2"><span className="terminal-label">
            <div className="w-6 h-6 rounded-md flex items-center justify-center bg-green/[0.08]">
              <Link2 size={14} className="text-green" />
            </div>
            QuickBooks Online
          </span></div>
          <div className="flex items-center gap-2">
            {qbConnection?.status === 'connected' && (
              <>
                <button onClick={syncQuickBooks} disabled={qbSyncing}
                  className="flex items-center gap-1.5 px-3 py-1.5 rounded-[10px] border border-border text-[13px] font-semibold text-t2 hover:border-border-hover active:border-border-hover transition disabled:opacity-50">
                  <RefreshCw size={13} className={qbSyncing ? 'animate-spin' : ''} /> {qbSyncing ? 'Syncing...' : 'Sync'}
                </button>
                <button onClick={() => { if (qbBankConns[0]) removeConnection(qbBankConns[0].id, 'qb') }}
                  disabled={removing !== null}
                  className="flex items-center gap-1.5 px-3 py-1.5 rounded-[10px] border border-border text-[13px] font-semibold text-t3 hover:text-red hover:border-red transition disabled:opacity-50">
                  <Trash2 size={13} /> Remove
                </button>
              </>
            )}
            {(!qbConnection || qbConnection.status !== 'connected') && (
              <button onClick={connectQuickBooks} disabled={qbConnecting}
                className="flex items-center gap-1.5 px-4 py-2 rounded-[10px] bg-gradient-to-r from-cyan to-sky-400 text-void text-[13px] font-semibold hover:-translate-y-px active:scale-[0.98] transition-all disabled:opacity-50">
                <Link2 size={14} /> {qbConnecting ? 'Connecting...' : 'Connect'}
              </button>
            )}
          </div>
        </div>

        {qbConnection?.status === 'connected' ? (
          <div className="glass-card rounded-[14px] p-4 border-green/[0.15] flex items-center gap-3">
            <div className="w-10 h-10 rounded-xl flex items-center justify-center bg-green/[0.08]">
              <Check size={18} className="text-green" />
            </div>
            <div className="flex-1">
              <p className="text-[14px] font-semibold text-t1">{qbConnection.company_name || 'QuickBooks Company'}</p>
              <p className="text-[13px] text-t3 font-mono">
                Connected · {accounts.filter(a => qbBankConns.some(b => b.id === a.bank_connection_id)).length} accounts synced
                {qbConnection.last_synced_at && ` · ${timeSince(qbConnection.last_synced_at)}`}
              </p>
            </div>
            <span className="px-2.5 py-0.5 rounded text-[12px] font-mono font-semibold bg-green-soft text-green">Connected</span>
          </div>
        ) : (
          <div className="border border-dashed border-border rounded-[14px] p-6 text-center">
            <p className="text-[14px] text-t2 mb-1">Sync invoices, bills, and bank transactions from QuickBooks</p>
            <p className="text-[13px] text-t3 font-mono">OAuth 2.0 — your credentials never touch our servers</p>
          </div>
        )}
      </div>

      {/* ═══ Xero / NetSuite / Sage ═══ */}
      {CONNECTORS.map((c) => {
        const conn = acctConnections[c.id]
        const isConnected = conn?.status === 'connected'
        const providerBankConns = bankConnections.filter(b => b.institution_name?.startsWith(`${c.name}:`))

        return (
          <div key={c.id}>
            <div className="flex items-center justify-between mb-3">
              <div className="flex items-center gap-2"><span className="terminal-label">
                <div className="w-6 h-6 rounded-md flex items-center justify-center" style={{ backgroundColor: `${c.color}12` }}>
                  <Link2 size={14} style={{ color: c.color }} />
                </div>
                {c.name}
              </span></div>
              <div className="flex items-center gap-2">
                {isConnected && (
                  <>
                    <button onClick={() => syncAccounting(c.id)} disabled={acctSyncing === c.id}
                      className="flex items-center gap-1.5 px-3 py-1.5 rounded-[10px] border border-border text-[13px] font-semibold text-t2 hover:border-border-hover active:border-border-hover transition disabled:opacity-50">
                      <RefreshCw size={13} className={acctSyncing === c.id ? 'animate-spin' : ''} /> {acctSyncing === c.id ? 'Syncing...' : 'Sync'}
                    </button>
                    <button onClick={() => removeAcctConnection(c.id)} disabled={removing !== null}
                      className="flex items-center gap-1.5 px-3 py-1.5 rounded-[10px] border border-border text-[13px] font-semibold text-t3 hover:text-red hover:border-red transition disabled:opacity-50">
                      <Trash2 size={13} /> Remove
                    </button>
                  </>
                )}
                {!isConnected && (
                  <button onClick={() => connectAccounting(c.id)} disabled={acctConnecting === c.id}
                    className="flex items-center gap-1.5 px-4 py-2 rounded-[10px] bg-gradient-to-r from-cyan to-sky-400 text-void text-[13px] font-semibold hover:-translate-y-px active:scale-[0.98] transition-all disabled:opacity-50">
                    <Link2 size={14} /> {acctConnecting === c.id ? 'Connecting...' : 'Connect'}
                  </button>
                )}
              </div>
            </div>

            {isConnected ? (
              <div className="glass-card rounded-[14px] p-4 border-green/[0.15] flex items-center gap-3">
                <div className="w-10 h-10 rounded-xl flex items-center justify-center" style={{ backgroundColor: `${c.color}12` }}>
                  <Check size={18} style={{ color: c.color }} />
                </div>
                <div className="flex-1">
                  <p className="text-[14px] font-semibold text-t1">{conn.company_name || c.name}</p>
                  <p className="text-[13px] text-t3 font-mono">
                    Connected · {accounts.filter(a => providerBankConns.some(b => b.id === a.bank_connection_id)).length} accounts synced
                    {conn.last_synced_at && ` · ${timeSince(conn.last_synced_at)}`}
                  </p>
                </div>
                <span className="px-2.5 py-0.5 rounded text-[12px] font-mono font-semibold bg-green-soft text-green">Connected</span>
              </div>
            ) : (
              <div className="border border-dashed border-border rounded-[14px] p-6 text-center">
                <p className="text-[14px] text-t2 mb-1">{c.desc}</p>
                <p className="text-[13px] text-t3 font-mono">OAuth 2.0 secure connection</p>
              </div>
            )}
          </div>
        )
      })}

      {/* ═══ Manual Connections ═══ */}
      {manualConns.length > 0 && (
        <div>
          <div className="flex items-center gap-2 mb-3">
            <div className="w-6 h-6 rounded-md bg-purple-soft flex items-center justify-center"><Plus size={14} className="text-purple" /></div>
            <span className="terminal-label">MANUAL ACCOUNTS</span>
          </div>
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
            {manualConns.map((bank) => {
              const bankAccounts = accounts.filter((a) => a.bank_connection_id === bank.id)
              return (
                <div key={bank.id} className="glass-card rounded-[14px] p-4 flex items-center gap-3 group">
                  <div className="w-10 h-10 rounded-xl bg-purple-soft flex items-center justify-center text-[13px] font-bold text-purple">MA</div>
                  <div className="flex-1 min-w-0">
                    <p className="text-[14px] font-semibold text-t1 truncate">{bankAccounts[0]?.name || 'Manual Account'}</p>
                    <p className="text-[13px] text-t3 font-mono">{bankAccounts.length} acct{bankAccounts.length !== 1 ? 's' : ''}</p>
                  </div>
                  <button onClick={() => removeConnection(bank.id, 'manual')} disabled={removing === bank.id}
                    className="opacity-0 group-hover:opacity-100 p-1.5 rounded-lg hover:bg-red-soft text-t3 hover:text-red transition-all disabled:opacity-50">
                    {removing === bank.id ? <Loader2 size={14} className="animate-spin" /> : <Trash2 size={14} />}
                  </button>
                </div>
              )
            })}
          </div>
        </div>
      )}
      {/* Platform status */}
      <div className="terminal-status flex items-center justify-between px-5 py-2 rounded-lg">
        <div className="flex items-center gap-4 text-t3">
          <span className="terminal-live">PLAID</span>
          <span>BANKS: <span className="text-t2">{bankConnections.length}</span></span>
          <span>ACCOUNTS: <span className="text-t2">{accounts.length}</span></span>
        </div>
        <div className="flex items-center gap-4 text-t3">
          <span>LIMIT: <span className="text-cyan">{maxConns}</span></span>
          <span>USED: <span className="text-t2">{bankConnections.length}/{maxConns}</span></span>
        </div>
      </div>
    </div>
  )
}

function timeSince(dateStr) {
  const secs = Math.floor((Date.now() - new Date(dateStr).getTime()) / 1000)
  if (secs < 60) return 'just now'
  if (secs < 3600) return `${Math.floor(secs / 60)}m ago`
  if (secs < 86400) return `${Math.floor(secs / 3600)}h ago`
  return `${Math.floor(secs / 86400)}d ago`
}
