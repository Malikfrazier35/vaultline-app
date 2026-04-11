import { useState, useEffect, useRef } from 'react'
import { useAuth } from '@/hooks/useAuth'
import { useTreasury } from '@/hooks/useTreasury'
import { supabase } from '@/lib/supabase'
import { SkeletonPage } from '@/components/Skeleton'
import {
  Upload, Plus, FileSpreadsheet, Check, AlertCircle,
  ArrowRight, Clock, Database, Link2
} from 'lucide-react'

const LIVE_CONNECTORS = [
  { id: 'xero', name: 'Xero', color: '#13B5EA', desc: 'Sync bank accounts, invoices, bills, and contacts from Xero automatically via OAuth 2.0.' },
  { id: 'netsuite', name: 'NetSuite', color: '#1B3D6D', desc: 'Enterprise ERP sync — pull GL accounts, invoices, vendor bills, and bank data from NetSuite.' },
  { id: 'sage', name: 'Sage', color: '#00DC00', desc: 'Connect Sage Business Cloud to sync bank accounts, sales invoices, and purchase invoices.' },
]

const CATEGORIES = [
  { value: '', label: 'Auto-detect' },
  { value: 'revenue', label: 'Revenue' },
  { value: 'payroll', label: 'Payroll' },
  { value: 'vendor', label: 'Vendor' },
  { value: 'saas', label: 'SaaS / Software' },
  { value: 'tax', label: 'Tax' },
  { value: 'transfer', label: 'Transfer' },
  { value: 'operations', label: 'Operations' },
  { value: 'other', label: 'Other' },
]

export default function DataImport() {
  const { profile } = useAuth()
  const { accounts, refetch } = useTreasury()
  const [tab, setTab] = useState('csv')
  const [csvData, setCsvData] = useState(null)
  const [csvFileName, setCsvFileName] = useState('')
  const [importing, setImporting] = useState(false)
  const [importResult, setImportResult] = useState(null)
  const [dragOver, setDragOver] = useState(false)
  const [imports, setImports] = useState([])
  const [pageLoading, setPageLoading] = useState(true)
  const fileRef = useRef(null)

  // Manual entry state
  const [manualForm, setManualForm] = useState({ date: new Date().toISOString().split('T')[0], description: '', amount: '', category: '', account_id: '' })
  const [manualSaving, setManualSaving] = useState(false)
  const [manualResult, setManualResult] = useState(null)

  // Manual account state
  const [acctForm, setAcctForm] = useState({ name: '', type: 'checking', balance: '', institution_name: '' })
  const [acctSaving, setAcctSaving] = useState(false)
  const [addAcctResult, setAddAcctResult] = useState(null)

  // QuickBooks state
  const [qbConnection, setQbConnection] = useState(null)
  const [qbConnecting, setQbConnecting] = useState(false)
  const [qbSyncing, setQbSyncing] = useState(false)
  const [qbResult, setQbResult] = useState(null)

  // Unified connector state (Xero, NetSuite, Sage)
  const [acctConnections, setAcctConnections] = useState({})
  const [acctConnecting, setAcctConnecting] = useState(null)
  const [acctSyncing, setAcctSyncing] = useState(null)
  const [acctResult, setAcctResult] = useState(null)

  useEffect(() => { document.title = 'Data Import — Vaultline' }, [])
  useEffect(() => { let stale = false; if (!stale) { Promise.all([loadImports(), loadQBConnection(), loadAcctConnections()]).finally(() => setPageLoading(false)); checkQBRedirect(); checkAcctRedirect() } return () => { stale = true } }, [])

  async function loadQBConnection() {
    const { data } = await supabase.from('qb_connections').select('*').order('created_at', { ascending: false }).limit(1).single()
    if (data) setQbConnection(data)
  }

  function checkQBRedirect() {
    const params = new URLSearchParams(window.location.search)
    if (params.get('qb_success')) {
      setQbResult({ success: true, company: params.get('company') })
      loadQBConnection()
      window.history.replaceState({}, '', '/import')
    }
    if (params.get('qb_error')) {
      setQbResult({ error: decodeURIComponent(params.get('qb_error')) })
      window.history.replaceState({}, '', '/import')
    }
  }

  async function connectQuickBooks() {
    setQbConnecting(true)
    setQbResult(null)
    try {
      const { data, error } = await supabase.functions.invoke('qb-auth')
      if (error) throw new Error(error.message)
      if (data?.error) throw new Error(data.error)
      if (data?.auth_url) window.location.href = data.auth_url
    } catch (err) {
      setQbResult({ error: err.message })
      setQbConnecting(false)
    }
  }

  async function syncQuickBooks() {
    setQbSyncing(true)
    setQbResult(null)
    try {
      const { data, error } = await supabase.functions.invoke('qb-sync')
      if (error) throw new Error(error.message)
      if (data?.error) throw new Error(data.error)
      setQbResult({ success: true, accounts: data.accounts, transactions: data.transactions })
      loadImports()
      loadQBConnection()
      refetch()
    } catch (err) {
      setQbResult({ error: err.message })
    } finally {
      setQbSyncing(false)
    }
  }

  async function loadAcctConnections() {
    const { data } = await supabase.from('accounting_connections').select('*').order('created_at', { ascending: false })
    const map = {}
    for (const c of data || []) { map[c.provider] = c }
    setAcctConnections(map)
  }

  function checkAcctRedirect() {
    const params = new URLSearchParams(window.location.search)
    if (params.get('acct_success')) {
      const provider = params.get('acct_success')
      setAcctResult({ success: true, provider, company: params.get('company') })
      loadAcctConnections()
      window.history.replaceState({}, '', '/import')
    }
    if (params.get('acct_error')) {
      setAcctResult({ error: decodeURIComponent(params.get('acct_error')) })
      window.history.replaceState({}, '', '/import')
    }
  }

  async function connectAccounting(provider) {
    setAcctConnecting(provider)
    setAcctResult(null)
    try {
      const { data, error } = await supabase.functions.invoke('acct-auth', { body: { provider } })
      if (error) throw new Error(error.message)
      if (data?.error) throw new Error(data.error)
      if (data?.auth_url) window.location.href = data.auth_url
    } catch (err) {
      setAcctResult({ error: err.message })
      setAcctConnecting(null)
    }
  }

  async function syncAccounting(provider) {
    setAcctSyncing(provider)
    setAcctResult(null)
    try {
      const { data, error } = await supabase.functions.invoke('acct-sync', { body: { provider } })
      if (error) throw new Error(error.message)
      if (data?.error) throw new Error(data.error)
      setAcctResult({ success: true, provider, accounts: data.accounts, transactions: data.transactions })
      loadImports()
      loadAcctConnections()
      refetch()
    } catch (err) {
      setAcctResult({ error: err.message })
    } finally {
      setAcctSyncing(null)
    }
  }

  async function loadImports() {
    const { data } = await supabase.from('data_imports').select('*').order('created_at', { ascending: false }).limit(10)
    setImports(data || [])
  }

  function parseCSV(text) {
    const lines = text.trim().split('\n')
    if (lines.length < 2) return null
    const headers = lines[0].split(',').map(h => h.trim().replace(/^["']|["']$/g, ''))
    const rows = []
    for (let i = 1; i < lines.length; i++) {
      const values = lines[i].split(',').map(v => v.trim().replace(/^["']|["']$/g, ''))
      if (values.length < 2) continue
      const row = {}
      headers.forEach((h, j) => { row[h] = values[j] || '' })
      rows.push(row)
    }
    return { headers, rows }
  }

  function handleFile(file) {
    if (!file) return
    setCsvFileName(file.name)
    const reader = new FileReader()
    reader.onload = (e) => {
      const parsed = parseCSV(e.target.result)
      setCsvData(parsed)
      setImportResult(null)
    }
    reader.readAsText(file)
  }

  function handleDrop(e) {
    e.preventDefault()
    setDragOver(false)
    const file = e.dataTransfer.files[0]
    if (file && (file.name.endsWith('.csv') || file.type === 'text/csv')) handleFile(file)
  }

  async function submitCSVImport() {
    if (!csvData?.rows?.length) return
    setImporting(true)
    setImportResult(null)

    try {
      const orgId = profile?.org_id
      if (!orgId) throw new Error('No organization found. Complete your profile first.')

      const txns = csvData.rows.map(row => ({
        org_id: orgId,
        date: row.date || row.Date || new Date().toISOString().split('T')[0],
        description: row.description || row.Description || row.memo || row.Memo || '',
        amount: parseFloat(row.amount || row.Amount || 0),
        category: row.category || row.Category || 'other',
        source: 'csv_import',
      })).filter(t => t.description && !isNaN(t.amount))

      const { error } = await supabase.from('transactions').insert(txns)
      if (error) throw new Error(error.message)

      // Log import
      await supabase.from('data_imports').insert({
        org_id: orgId,
        source: 'csv',
        file_name: csvFileName,
        total_rows: csvData.rows.length,
        imported_rows: txns.length,
        skipped_rows: csvData.rows.length - txns.length,
        status: 'completed',
      }).catch(() => {})

      setImportResult({ imported: txns.length, total: csvData.rows.length, skipped: csvData.rows.length - txns.length })
      loadImports()
      refetch()
    } catch (err) {
      setImportResult({ error: err.message })
    } finally {
      setImporting(false)
    }
  }

  async function submitManual(e) {
    e.preventDefault()
    setManualSaving(true)
    setManualResult(null)

    try {
      const orgId = profile?.org_id
      if (!orgId) throw new Error('No organization found. Complete your profile first.')

      const amt = parseFloat(manualForm.amount)
      const { error } = await supabase.from('transactions').insert({
        org_id: orgId,
        account_id: manualForm.account_id || null,
        date: manualForm.date,
        description: manualForm.description,
        amount: amt,
        category: manualForm.category || 'other',
        source: 'manual',
      })
      if (error) throw new Error(error.message)
      setManualResult({ success: true })
      setManualForm({ date: new Date().toISOString().split('T')[0], description: '', amount: '', category: '', account_id: '' })
      refetch()
    } catch (err) {
      setManualResult({ error: err.message })
    } finally {
      setManualSaving(false)
    }
  }

  async function submitAccount(e) {
    e.preventDefault()
    setAcctSaving(true)
    setAddAcctResult(null)

    try {
      const orgId = profile?.org_id
      if (!orgId) throw new Error('No organization found. Complete your profile first.')

      const { error } = await supabase.from('accounts').insert({
        org_id: orgId,
        name: acctForm.name,
        type: acctForm.type,
        institution_name: acctForm.institution_name || null,
        balance: parseFloat(acctForm.balance || '0'),
        currency: 'USD',
        source: 'manual',
      })
      if (error) throw new Error(error.message)
      setAddAcctResult({ success: true })
      setAcctForm({ name: '', type: 'checking', balance: '', institution_name: '' })
      refetch()
    } catch (err) {
      setAddAcctResult({ error: err.message })
    } finally {
      setAcctSaving(false)
    }
  }

  const tabs = [
    { id: 'csv', label: 'CSV Upload', icon: FileSpreadsheet },
    { id: 'manual', label: 'Manual Entry', icon: Plus },
    { id: 'account', label: 'Add Account', icon: Database },
    { id: 'connectors', label: 'Connectors', icon: Link2 },
  ]

  if (pageLoading) return <SkeletonPage />

  return (
    <div className="space-y-6">
      <div>
        <span className="terminal-label">DATA IMPORT</span>
        <p className="text-[14px] text-t2 mt-0.5">Upload transactions, add accounts manually, or connect accounting software</p>
      </div>

      {/* Tabs */}
      <div className="flex gap-1 terminal-inset rounded-[12px] p-1 w-fit">
        {tabs.map((t) => (
          <button key={t.id} onClick={() => setTab(t.id)}
            className={`flex items-center gap-2 px-4 py-2 rounded-[10px] text-[13px] font-mono font-medium transition ${tab === t.id ? 'bg-card text-cyan' : 'text-t3 hover:text-t2'}`}>
            <t.icon size={15} /> {t.label}
          </button>
        ))}
      </div>

      {/* CSV Upload */}
      {tab === 'csv' && (
        <div className="space-y-5">
          <div
            onDragOver={(e) => { e.preventDefault(); setDragOver(true) }}
            onDragLeave={() => setDragOver(false)}
            onDrop={handleDrop}
            onClick={() => fileRef.current?.click()}
            className={`border-2 border-dashed rounded-[16px] p-12 text-center cursor-pointer transition-all ${dragOver ? 'border-cyan bg-cyan-glow' : 'border-border hover:border-border-hover'}`}
          >
            <Upload size={36} className="mx-auto mb-3 text-t3" />
            <p className="text-[15px] font-semibold mb-1">Drop a CSV file here or click to browse</p>
            <p className="text-[13px] text-t2">Expected columns: date, description, amount (category optional)</p>
            <input ref={fileRef} type="file" accept=".csv" className="hidden" onChange={(e) => handleFile(e.target.files?.[0])} />
          </div>

          {csvData && (
            <div className="glass-card rounded-[14px] p-5 terminal-scanlines relative space-y-4">
              <div className="flex items-center justify-between">
                <div>
                  <p className="text-[15px] font-semibold">{csvFileName}</p>
                  <p className="text-[13px] text-t2">{csvData.rows.length} rows · Columns: {csvData.headers.join(', ')}</p>
                </div>
                <button onClick={submitCSVImport} disabled={importing}
                  className="px-5 py-2.5 rounded-[10px] bg-gradient-to-r from-cyan to-sky-400 text-void text-[14px] font-semibold hover:-translate-y-px active:scale-[0.98] transition-all disabled:opacity-50 flex items-center gap-2">
                  {importing ? 'Importing...' : <><Upload size={14} /> Import All Rows</>}
                </button>
              </div>

              {/* Preview */}
              <div className="overflow-x-auto rounded-[10px] border border-border">
                <table className="w-full text-[13px]">
                  <thead>
                    <tr className="terminal-inset">{csvData.headers.map(h => <th key={h} className="px-3 py-2 text-left text-t3 font-medium">{h}</th>)}</tr>
                  </thead>
                  <tbody>
                    {csvData.rows.slice(0, 5).map((row, i) => (
                      <tr key={i} className="border-t border-border">
                        {csvData.headers.map(h => <td key={h} className="px-3 py-2 text-t2">{row[h]}</td>)}
                      </tr>
                    ))}
                  </tbody>
                </table>
                {csvData.rows.length > 5 && <p className="text-[13px] text-t2 text-center py-2">+ {csvData.rows.length - 5} more rows</p>}
              </div>
            </div>
          )}

          {importResult && !importResult.error && (
            <div className="flex items-center gap-3 bg-green-soft text-green text-[14px] rounded-[12px] px-5 py-3">
              <Check size={18} /> Imported {importResult.imported} of {importResult.total} transactions. {importResult.skipped > 0 && `${importResult.skipped} skipped.`}
            </div>
          )}
          {importResult?.error && (
            <div className="flex items-center gap-3 bg-red-soft text-red text-[14px] rounded-[12px] px-5 py-3">
              <AlertCircle size={18} /> {importResult.error}
            </div>
          )}
        </div>
      )}

      {/* Manual Transaction */}
      {tab === 'manual' && (
        <div className="glass-card rounded-[14px] p-6 terminal-scanlines relative">
          <span className="terminal-label mb-2">ADD TRANSACTION</span>
          <p className="text-[13px] text-t2 mb-6">Manually record a transaction. Use negative amounts for inflows (revenue) and positive for outflows (expenses).</p>
          <form onSubmit={submitManual} className="grid grid-cols-1 sm:grid-cols-2 gap-5">
            <div>
              <label className="text-[12px] text-t3 font-mono uppercase tracking-wide mb-1.5 block">Date</label>
              <input type="date" value={manualForm.date} onChange={(e) => setManualForm({ ...manualForm, date: e.target.value })}
                className="w-full glass-input rounded-[10px] px-4 py-2.5 text-[14px] text-t1 outline-none focus:border-cyan/40 transition" required />
            </div>
            <div>
              <label className="text-[12px] text-t3 font-mono uppercase tracking-wide mb-1.5 block">Amount ($)</label>
              <input type="number" step="0.01" value={manualForm.amount} onChange={(e) => setManualForm({ ...manualForm, amount: e.target.value })}
                placeholder="-5000.00" className="w-full glass-input rounded-[10px] px-4 py-2.5 text-[14px] text-t1 outline-none focus:border-cyan/40 transition" required />
              <p className="text-[11px] text-t3 mt-1">Negative = inflow · Positive = outflow</p>
            </div>
            <div className="sm:col-span-2">
              <label className="text-[12px] text-t3 font-mono uppercase tracking-wide mb-1.5 block">Description</label>
              <input type="text" value={manualForm.description} onChange={(e) => setManualForm({ ...manualForm, description: e.target.value })}
                placeholder="Client Payment — Invoice #1042" className="w-full glass-input rounded-[10px] px-4 py-2.5 text-[14px] text-t1 outline-none focus:border-cyan/40 transition" required />
            </div>
            <div>
              <label className="text-[12px] text-t3 font-mono uppercase tracking-wide mb-1.5 block">Category</label>
              <select value={manualForm.category} onChange={(e) => setManualForm({ ...manualForm, category: e.target.value })}
                className="w-full glass-input rounded-[10px] px-4 py-2.5 text-[14px] text-t1 outline-none cursor-pointer focus:border-cyan/40 transition">
                {CATEGORIES.map(c => <option key={c.value} value={c.value}>{c.label}</option>)}
              </select>
            </div>
            <div>
              <label className="text-[12px] text-t3 font-mono uppercase tracking-wide mb-1.5 block">Account</label>
              <select value={manualForm.account_id} onChange={(e) => setManualForm({ ...manualForm, account_id: e.target.value })}
                className="w-full glass-input rounded-[10px] px-4 py-2.5 text-[14px] text-t1 outline-none cursor-pointer focus:border-cyan/40 transition">
                <option value="">Select account (optional)</option>
                {accounts.map(a => <option key={a.id} value={a.id}>{a.name}{a.institution_name ? ` — ${a.institution_name}` : ''}</option>)}
              </select>
            </div>
            <div className="sm:col-span-2 flex items-center gap-4 pt-2">
              <button type="submit" disabled={manualSaving}
                className="px-6 py-2.5 rounded-[10px] bg-gradient-to-r from-cyan to-sky-400 text-void text-[14px] font-semibold hover:-translate-y-px active:scale-[0.98] transition-all disabled:opacity-50 btn-press flex items-center gap-2">
                {manualSaving ? <><span className="w-4 h-4 border-2 border-void border-t-transparent rounded-full animate-spin" /> Saving...</> : <><Plus size={15} /> Add Transaction</>}
              </button>
              {manualResult?.success && <span className="text-green text-[13px] flex items-center gap-1.5 count-enter"><Check size={15} /> Transaction added successfully</span>}
              {manualResult?.error && <span className="text-red text-[13px] flex items-center gap-1.5"><AlertCircle size={15} /> {manualResult.error}</span>}
            </div>
          </form>
        </div>
      )}

      {/* Add Account */}
      {tab === 'account' && (
        <div className="glass-card rounded-[14px] p-6 terminal-scanlines relative">
          <span className="terminal-label mb-2">ADD ACCOUNT</span>
          <p className="text-[13px] text-t2 mb-6">Add a bank account, credit line, or investment account without connecting via Plaid.</p>
          <form onSubmit={submitAccount} className="grid grid-cols-1 sm:grid-cols-2 gap-5">
            <div>
              <label className="text-[12px] text-t3 font-mono uppercase tracking-wide mb-1.5 block">Account Name</label>
              <input type="text" value={acctForm.name} onChange={(e) => setAcctForm({ ...acctForm, name: e.target.value })}
                placeholder="Operating Account" className="w-full glass-input rounded-[10px] px-4 py-2.5 text-[14px] text-t1 outline-none focus:border-cyan/40 transition" required />
            </div>
            <div>
              <label className="text-[12px] text-t3 font-mono uppercase tracking-wide mb-1.5 block">Institution Name</label>
              <input type="text" value={acctForm.institution_name} onChange={(e) => setAcctForm({ ...acctForm, institution_name: e.target.value })}
                placeholder="JPMorgan Chase" className="w-full glass-input rounded-[10px] px-4 py-2.5 text-[14px] text-t1 outline-none focus:border-cyan/40 transition" />
            </div>
            <div>
              <label className="text-[12px] text-t3 font-mono uppercase tracking-wide mb-1.5 block">Account Type</label>
              <select value={acctForm.type} onChange={(e) => setAcctForm({ ...acctForm, type: e.target.value })}
                className="w-full glass-input rounded-[10px] px-4 py-2.5 text-[14px] text-t1 outline-none cursor-pointer focus:border-cyan/40 transition">
                <option value="checking">Checking</option>
                <option value="savings">Savings</option>
                <option value="credit">Credit</option>
                <option value="investment">Investment</option>
                <option value="loan">Loan</option>
                <option value="other">Other</option>
              </select>
            </div>
            <div>
              <label className="text-[12px] text-t3 font-mono uppercase tracking-wide mb-1.5 block">Current Balance ($)</label>
              <input type="number" step="0.01" value={acctForm.balance} onChange={(e) => setAcctForm({ ...acctForm, balance: e.target.value })}
                placeholder="250,000.00" className="w-full glass-input rounded-[10px] px-4 py-2.5 text-[14px] text-t1 outline-none focus:border-cyan/40 transition" />
            </div>
            <div className="sm:col-span-2 flex items-center gap-4 pt-2">
              <button type="submit" disabled={acctSaving}
                className="px-6 py-2.5 rounded-[10px] bg-gradient-to-r from-cyan to-sky-400 text-void text-[14px] font-semibold hover:-translate-y-px active:scale-[0.98] transition-all disabled:opacity-50 btn-press flex items-center gap-2">
                {acctSaving ? <><span className="w-4 h-4 border-2 border-void border-t-transparent rounded-full animate-spin" /> Creating...</> : <><Plus size={15} /> Create Account</>}
              </button>
              {addAcctResult?.success && <span className="text-green text-[13px] flex items-center gap-1.5 count-enter"><Check size={15} /> Account created successfully</span>}
              {addAcctResult?.error && <span className="text-red text-[13px] flex items-center gap-1.5"><AlertCircle size={15} /> {addAcctResult.error}</span>}
            </div>
          </form>

          {/* Existing accounts */}
          {accounts.length > 0 && (
            <div className="mt-8 pt-6 border-t border-border">
              <span className="terminal-label mb-3">YOUR ACCOUNTS ({accounts.length})</span>
              <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-3 mt-3">
                {accounts.map(acct => (
                  <div key={acct.id} className="glass-card rounded-xl p-4 flex items-center gap-3">
                    <div className="w-9 h-9 rounded-lg flex items-center justify-center text-[11px] font-bold text-white shrink-0"
                      style={{ background: 'linear-gradient(135deg, var(--color-cyan), var(--color-purple))' }}>
                      {(acct.institution_name || acct.name || '?').slice(0, 2).toUpperCase()}
                    </div>
                    <div className="min-w-0 flex-1">
                      <p className="text-[13px] font-semibold truncate">{acct.name}</p>
                      <p className="text-[11px] text-t3 font-mono">{acct.institution_name || acct.type} · ${(acct.balance || 0).toLocaleString()}</p>
                    </div>
                  </div>
                ))}
              </div>
            </div>
          )}
        </div>
      )}

      {/* Connectors */}
      {tab === 'connectors' && (
        <div className="space-y-5">
          <p className="text-[14px] text-t2">Connect your accounting software to automatically sync transactions, invoices, and account balances.</p>

          {/* QuickBooks — LIVE */}
          <div className={`border rounded-[14px] p-5 ${qbConnection?.status === 'connected' ? 'border-green' : 'border-border hover:border-border-hover'} transition`}>
            <div className="flex items-center justify-between mb-3">
              <div className="flex items-center gap-3">
                <div className="w-10 h-10 rounded-xl flex items-center justify-center bg-green/[0.08]">
                  <Link2 size={20} className="text-green" />
                </div>
                <div>
                  <p className="text-[15px] font-semibold">QuickBooks Online</p>
                  {qbConnection?.status === 'connected' ? (
                    <span className="text-[12px] text-green font-medium bg-green-soft px-2 py-0.5 rounded uppercase">Connected</span>
                  ) : (
                    <span className="text-[12px] text-cyan font-medium bg-cyan-glow px-2 py-0.5 rounded uppercase">Available</span>
                  )}
                </div>
              </div>
              {qbConnection?.status === 'connected' && qbConnection.company_name && (
                <span className="text-[13px] text-t2">{qbConnection.company_name}</span>
              )}
            </div>
            <p className="text-[13px] text-t2 leading-relaxed mb-4">
              {qbConnection?.status === 'connected'
                ? `Syncing invoices, bills, and bank transactions from ${qbConnection.company_name || 'QuickBooks'}. Last synced: ${qbConnection.last_synced_at ? new Date(qbConnection.last_synced_at).toLocaleString() : 'never'}`
                : 'Connect your QuickBooks Online account to sync invoices, bills, bank transactions, and account balances automatically via OAuth 2.0.'}
            </p>
            <div className="flex items-center gap-3">
              {qbConnection?.status === 'connected' ? (
                <button onClick={syncQuickBooks} disabled={qbSyncing}
                  className="px-5 py-2 rounded-[10px] bg-gradient-to-r from-cyan to-sky-400 text-void text-[13px] font-semibold hover:-translate-y-px active:scale-[0.98] transition-all disabled:opacity-50 flex items-center gap-2">
                  {qbSyncing ? 'Syncing...' : <><ArrowRight size={14} /> Sync Now</>}
                </button>
              ) : (
                <button onClick={connectQuickBooks} disabled={qbConnecting}
                  className="px-5 py-2 rounded-[10px] bg-gradient-to-r from-cyan to-sky-400 text-void text-[13px] font-semibold hover:-translate-y-px active:scale-[0.98] transition-all disabled:opacity-50 flex items-center gap-2">
                  {qbConnecting ? 'Connecting...' : <><Link2 size={14} /> Connect QuickBooks</>}
                </button>
              )}
            </div>
            {qbResult?.success && qbResult.accounts !== undefined && (
              <p className="text-green text-[13px] mt-3 flex items-center gap-1"><Check size={14} /> Synced {qbResult.accounts} accounts and {qbResult.transactions} transactions</p>
            )}
            {qbResult?.success && qbResult.company && (
              <p className="text-green text-[13px] mt-3 flex items-center gap-1"><Check size={14} /> Connected to {qbResult.company}</p>
            )}
            {qbResult?.error && (
              <p className="text-red text-[13px] mt-3 flex items-center gap-1"><AlertCircle size={14} /> {qbResult.error}</p>
            )}
          </div>

          {/* Live connectors — Xero, NetSuite, Sage */}
          {LIVE_CONNECTORS.map((c) => {
            const conn = acctConnections[c.id]
            const isConnected = conn?.status === 'connected'
            const isConnecting = acctConnecting === c.id
            const isSyncing = acctSyncing === c.id

            return (
              <div key={c.id} className={`border rounded-[14px] p-5 ${isConnected ? 'border-green' : 'border-border hover:border-border-hover'} transition`}>
                <div className="flex items-center justify-between mb-3">
                  <div className="flex items-center gap-3">
                    <div className="w-10 h-10 rounded-xl flex items-center justify-center" style={{ backgroundColor: `${c.color}12` }}>
                      <Link2 size={20} style={{ color: c.color }} />
                    </div>
                    <div>
                      <p className="text-[15px] font-semibold">{c.name}</p>
                      {isConnected ? (
                        <span className="text-[12px] text-green font-medium bg-green-soft px-2 py-0.5 rounded uppercase">Connected</span>
                      ) : (
                        <span className="text-[12px] text-cyan font-medium bg-cyan-glow px-2 py-0.5 rounded uppercase">Available</span>
                      )}
                    </div>
                  </div>
                  {isConnected && conn.company_name && (
                    <span className="text-[13px] text-t2">{conn.company_name}</span>
                  )}
                </div>
                <p className="text-[13px] text-t2 leading-relaxed mb-4">
                  {isConnected
                    ? `Connected to ${conn.company_name || c.name}. Last synced: ${conn.last_synced_at ? new Date(conn.last_synced_at).toLocaleString() : 'never'}`
                    : c.desc}
                </p>
                <div className="flex items-center gap-3">
                  {isConnected ? (
                    <button onClick={() => syncAccounting(c.id)} disabled={isSyncing}
                      className="px-5 py-2 rounded-[10px] bg-gradient-to-r from-cyan to-sky-400 text-void text-[13px] font-semibold hover:-translate-y-px active:scale-[0.98] transition-all disabled:opacity-50 flex items-center gap-2">
                      {isSyncing ? 'Syncing...' : <><ArrowRight size={14} /> Sync Now</>}
                    </button>
                  ) : (
                    <button onClick={() => connectAccounting(c.id)} disabled={isConnecting}
                      className="px-5 py-2 rounded-[10px] bg-gradient-to-r from-cyan to-sky-400 text-void text-[13px] font-semibold hover:-translate-y-px active:scale-[0.98] transition-all disabled:opacity-50 flex items-center gap-2">
                      {isConnecting ? 'Connecting...' : <><Link2 size={14} /> Connect {c.name}</>}
                    </button>
                  )}
                </div>
              </div>
            )
          })}

          {acctResult?.success && acctResult.accounts !== undefined && (
            <div className="flex items-center gap-3 bg-green-soft text-green text-[14px] rounded-[12px] px-5 py-3">
              <Check size={18} /> Synced {acctResult.accounts} accounts and {acctResult.transactions} transactions from {acctResult.provider}
            </div>
          )}
          {acctResult?.success && acctResult.company && !acctResult.accounts && (
            <div className="flex items-center gap-3 bg-green-soft text-green text-[14px] rounded-[12px] px-5 py-3">
              <Check size={18} /> Connected to {acctResult.company}
            </div>
          )}
          {acctResult?.error && (
            <div className="flex items-center gap-3 bg-red-soft text-red text-[14px] rounded-[12px] px-5 py-3">
              <AlertCircle size={18} /> {acctResult.error}
            </div>
          )}

          <div className="border border-border-cyan rounded-[14px] p-5 bg-cyan-glow">
            <p className="text-[14px] font-semibold text-cyan mb-1">Need a specific connector?</p>
            <p className="text-[13px] text-t2">We're building integrations based on customer demand. Use the Copilot to request a connector, or email integrations@vaultline.app.</p>
          </div>
        </div>
      )}

      {/* Import History */}
      {imports.length > 0 && (
        <div className="glass-card rounded-[14px] p-5 terminal-scanlines relative">
          <div className="flex items-center gap-2 mb-3">
            <Clock size={16} className="text-t3" />
            <span className="terminal-label">RECENT IMPORTS</span>
          </div>
          <div className="space-y-2">
            {imports.map((imp) => (
              <div key={imp.id} className="flex items-center justify-between py-2 px-3 rounded-[10px] bg-deep">
                <div className="flex items-center gap-3">
                  <FileSpreadsheet size={16} className="text-t3" />
                  <div>
                    <p className="text-[13px] font-medium">{imp.file_name || imp.source}</p>
                    <p className="text-[12px] text-t3">{new Date(imp.created_at).toLocaleString()} · {imp.rows_imported}/{imp.rows_total} rows</p>
                  </div>
                </div>
                <span className={`text-[12px] font-semibold px-2 py-0.5 rounded ${
                  imp.status === 'completed' ? 'bg-green-soft text-green' :
                  imp.status === 'partial' ? 'bg-amber-soft text-amber' :
                  imp.status === 'failed' ? 'bg-red-soft text-red' : 'bg-cyan-glow text-cyan'
                }`}>{imp.status}</span>
              </div>
            ))}
          </div>
        </div>
      )}
    </div>
  )
}
