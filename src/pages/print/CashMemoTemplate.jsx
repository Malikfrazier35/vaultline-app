import { useEffect, useState } from 'react'
import { useParams } from 'react-router-dom'
import { supabase } from '@/lib/supabase'


/**
 * CashMemoTemplate — Daily Cash Position Memo (treasury-grade)
 *
 * Route: /print/cash-memo/:orgId/:date
 *
 * Used by:
 * 1. The /reports page → calls generate-report edge function → Puppeteer hits this URL
 * 2. Direct user navigation (preview before generating PDF)
 *
 * Design vocabulary follows treasury report norms:
 *  - Serif body (Source Serif Pro)
 *  - Tabular monospace for numbers
 *  - Parens for negatives — never minus signs
 *  - Hairline rules, double-rule on totals
 *  - Cover page with prepared-by + prepared-on
 *  - Page header repeats org name + period on every page
 */

const fmt = (n, opts = {}) => {
  if (n == null || isNaN(n)) return '—'
  const abs = Math.abs(n)
  const formatted = new Intl.NumberFormat('en-US', {
    style: 'currency',
    currency: 'USD',
    minimumFractionDigits: opts.dec ?? 0,
    maximumFractionDigits: opts.dec ?? 0,
  }).format(abs)
  return n < 0 ? `(${formatted})` : formatted
}

const fmtPct = (n) => n == null ? '—' : `${n >= 0 ? '+' : ''}${n.toFixed(1)}%`

const fmtDate = (d) => new Date(d).toLocaleDateString('en-US', {
  month: 'long', day: 'numeric', year: 'numeric'
})

export default function CashMemoTemplate() {
  const { orgId, date } = useParams()
  const reportDate = date || new Date().toISOString().slice(0, 10)
  
  const [data, setData] = useState(null)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState(null)

  useEffect(() => {
    let mounted = true
    async function load() {
      try {
        // ── ORG ──
        const { data: org, error: orgErr } = await supabase
          .from('organizations')
          .select('id, name, logo_url, report_primary_color, white_label_enabled')
          .eq('id', orgId)
          .single()
        if (orgErr) throw orgErr

        // ── ACCOUNTS (current snapshot) ──
        const { data: accounts } = await supabase
          .from('accounts')
          .select('id, name, type, current_balance, available_balance, currency, bank_connections(institution_name)')
          .eq('org_id', orgId)
          .eq('is_active', true)
          .order('current_balance', { ascending: false })

        // ── DAILY BALANCES (last 30 days for trend) ──
        const thirtyDaysAgo = new Date(reportDate)
        thirtyDaysAgo.setDate(thirtyDaysAgo.getDate() - 30)
        const { data: balances } = await supabase
          .from('daily_balances')
          .select('date, balance')
          .eq('org_id', orgId)
          .gte('date', thirtyDaysAgo.toISOString().slice(0, 10))
          .lte('date', reportDate)
          .order('date', { ascending: true })

        // ── TRANSACTIONS (last 5 business days, material only) ──
        const fiveDaysAgo = new Date(reportDate)
        fiveDaysAgo.setDate(fiveDaysAgo.getDate() - 5)
        const { data: txns } = await supabase
          .from('transactions')
          .select('id, date, amount, description, accounts(name)')
          .eq('org_id', orgId)
          .gte('date', fiveDaysAgo.toISOString().slice(0, 10))
          .lte('date', reportDate)
          .order('date', { ascending: false })
          .limit(50)

        // ── FORECAST (next 30 days) ──
        const { data: forecast } = await supabase
          .from('forecasts')
          .select('forecast_data, generated_at')
          .eq('org_id', orgId)
          .order('generated_at', { ascending: false })
          .limit(1)
          .maybeSingle()

        // ── PROFILE (for "prepared by") ──
        const { data: { user } } = await supabase.auth.getUser()
        const { data: profile } = await supabase
          .from('profiles')
          .select('full_name, email')
          .eq('id', user?.id)
          .maybeSingle()

        if (!mounted) return
        
        // Compute derived metrics
        const totalCash = (accounts || []).reduce((sum, a) => sum + (a.current_balance || 0), 0)
        const availableCash = (accounts || []).reduce((sum, a) => sum + (a.available_balance || a.current_balance || 0), 0)
        const operatingAccounts = (accounts || []).filter(a => a.type === 'checking' || a.type === 'operating')
        const operatingCash = operatingAccounts.reduce((sum, a) => sum + (a.current_balance || 0), 0)
        
        // Day-over-day change
        const dod = balances && balances.length >= 2
          ? balances[balances.length - 1].balance - balances[balances.length - 2].balance
          : 0
        
        // Week-over-week change
        const weekAgo = balances?.find(b => {
          const bd = new Date(b.date)
          const target = new Date(reportDate)
          target.setDate(target.getDate() - 7)
          return bd.toISOString().slice(0, 10) === target.toISOString().slice(0, 10)
        })
        const wow = weekAgo ? totalCash - weekAgo.balance : null
        const wowPct = weekAgo && weekAgo.balance ? (wow / weekAgo.balance) * 100 : null
        
        // Material movements (>$50K abs value)
        const materialTxns = (txns || []).filter(t => Math.abs(t.amount) > 50000).slice(0, 10)
        
        setData({
          org,
          accounts: accounts || [],
          balances: balances || [],
          forecast,
          preparedBy: profile?.full_name || profile?.email || 'Vaultline',
          preparedAt: new Date().toLocaleString('en-US', { 
            timeZone: 'America/New_York',
            dateStyle: 'medium',
            timeStyle: 'short'
          }),
          metrics: {
            totalCash,
            availableCash,
            operatingCash,
            dod,
            wow,
            wowPct,
          },
          materialTxns,
          accountCount: (accounts || []).length,
          bankCount: new Set((accounts || []).map(a => a.bank_connections?.institution_name).filter(Boolean)).size,
        })
        setLoading(false)
      } catch (e) {
        console.error('Cash memo load error:', e)
        setError(e.message)
        setLoading(false)
      }
    }
    load()
    return () => { mounted = false }
  }, [orgId, reportDate])

  if (loading) return <div className="p-12 font-serif">Loading report…</div>
  if (error) return <div className="p-12 font-serif text-red-700">Error: {error}</div>
  if (!data) return null

  const { org, accounts, metrics, materialTxns, preparedBy, preparedAt, bankCount } = data
  const isWhiteLabel = org.white_label_enabled
  const accentColor = org.report_primary_color || '#0A1F3D'

  return (
    <div className="cash-memo">
      {/* ────── PRINT-ONLY PAGE STYLES ────── */}
      <style>{`
        .cash-memo {
          font-family: 'Source Serif Pro', 'Charter', Georgia, 'Times New Roman', serif;
          color: #000;
          background: #fff;
          max-width: 7.5in;
          margin: 0 auto;
          padding: 0.6in 0.55in;
          font-size: 10pt;
          line-height: 1.45;
        }
        .cover-page {
          min-height: 9in;
          display: flex;
          flex-direction: column;
          page-break-after: always;
        }
        .cover-header {
          display: flex;
          justify-content: space-between;
          align-items: center;
          padding-bottom: 14pt;
          border-bottom: 0.75pt solid #000;
          margin-bottom: 60pt;
        }
        .org-name-cover {
          font-size: 11pt;
          font-weight: 700;
          letter-spacing: 0.02em;
          text-transform: uppercase;
        }
        .cover-title-block {
          flex: 1;
          display: flex;
          flex-direction: column;
          justify-content: center;
        }
        .cover-eyebrow {
          font-size: 10pt;
          color: #6b7280;
          letter-spacing: 0.06em;
          text-transform: uppercase;
          margin-bottom: 14pt;
        }
        .cover-title {
          font-size: 36pt;
          font-weight: 700;
          line-height: 1.05;
          letter-spacing: -0.01em;
          margin: 0 0 8pt 0;
        }
        .cover-period {
          font-size: 16pt;
          color: #374151;
          margin: 0;
        }
        .cover-meta {
          margin-top: auto;
          padding-top: 24pt;
          border-top: 0.5pt solid #d1d5db;
          font-size: 10pt;
          display: grid;
          grid-template-columns: 1fr 1fr;
          gap: 6pt 24pt;
        }
        .cover-meta dt {
          color: #6b7280;
          font-size: 9pt;
          text-transform: uppercase;
          letter-spacing: 0.04em;
        }
        .cover-meta dd {
          margin: 0 0 8pt 0;
          font-weight: 600;
        }
        .running-header {
          display: flex;
          justify-content: space-between;
          align-items: baseline;
          padding-bottom: 6pt;
          border-bottom: 0.5pt solid #d1d5db;
          margin-bottom: 14pt;
          font-size: 9pt;
          color: #6b7280;
        }
        .running-header strong {
          color: #000;
        }
        h2.section {
          font-size: 13pt;
          font-weight: 700;
          margin: 18pt 0 6pt 0;
          padding-bottom: 3pt;
          border-bottom: 0.5pt solid #000;
          break-after: avoid;
          letter-spacing: -0.005em;
        }
        h3.subsection {
          font-size: 10.5pt;
          font-weight: 700;
          margin: 10pt 0 3pt 0;
          break-after: avoid;
        }
        .kpi-grid {
          display: grid;
          grid-template-columns: 1fr 1fr 1fr 1fr;
          gap: 10pt;
          margin: 8pt 0 16pt 0;
        }
        .kpi {
          border: 0.5pt solid #d1d5db;
          padding: 10pt;
          break-inside: avoid;
        }
        .kpi-label {
          font-size: 8pt;
          color: #6b7280;
          text-transform: uppercase;
          letter-spacing: 0.06em;
          margin-bottom: 4pt;
        }
        .kpi-value {
          font-family: 'Geist Mono', 'IBM Plex Mono', monospace;
          font-feature-settings: 'tnum';
          font-size: 16pt;
          font-weight: 700;
          letter-spacing: -0.01em;
        }
        .kpi-delta {
          font-family: 'Geist Mono', monospace;
          font-size: 9pt;
          margin-top: 4pt;
          color: #374151;
        }
        table.report-table {
          width: 100%;
          border-collapse: collapse;
          margin: 6pt 0 12pt 0;
        }
        table.report-table th {
          font-weight: 600;
          font-size: 9pt;
          text-align: left;
          padding: 5pt 6pt;
          border-top: 0.75pt solid #000;
          border-bottom: 0.75pt solid #000;
          text-transform: uppercase;
          letter-spacing: 0.04em;
        }
        table.report-table th.num,
        table.report-table td.num {
          text-align: right;
          font-family: 'Geist Mono', monospace;
          font-feature-settings: 'tnum';
        }
        table.report-table td {
          padding: 4pt 6pt;
          font-size: 10pt;
          border-bottom: 0.25pt solid #e5e7eb;
        }
        table.report-table tr.total td {
          font-weight: 700;
          border-top: 0.5pt solid #000;
          border-bottom: 1.75pt double #000;
        }
        .commentary {
          font-size: 10pt;
          line-height: 1.55;
          margin: 6pt 0 14pt 0;
          color: #1f2937;
        }
        .footnotes {
          margin-top: 22pt;
          padding-top: 8pt;
          border-top: 0.25pt solid #d1d5db;
          font-size: 8pt;
          color: #6b7280;
          line-height: 1.4;
        }
        .footnotes p { margin: 0 0 3pt 0; }
        .doc-footer {
          margin-top: 28pt;
          padding-top: 8pt;
          border-top: 0.25pt solid #d1d5db;
          font-size: 8pt;
          color: #6b7280;
          display: flex;
          justify-content: space-between;
        }
        .vaultline-mark {
          display: inline-flex;
          align-items: center;
          gap: 4pt;
          font-weight: 600;
          color: #000;
        }
        @media print {
          .cash-memo { padding: 0; max-width: none; }
        }
      `}</style>

      {/* ──────────────────────── COVER PAGE ──────────────────────── */}
      <div className="cover-page">
        <div className="cover-header">
          <div className="org-name-cover">
            {org.logo_url ? (
              <img src={org.logo_url} alt={org.name} style={{ maxHeight: '40pt', maxWidth: '180pt' }} />
            ) : (
              org.name
            )}
          </div>
          {!isWhiteLabel && (
            <div className="vaultline-mark" style={{ fontSize: '10pt' }}>
              <svg width="10" height="10" viewBox="0 0 10 10" style={{display:"inline-block"}}><path d="M5 0 L10 5 L5 10 L0 5 Z" fill="currentColor"/></svg>
              <span>Vaultline</span>
            </div>
          )}
        </div>

        <div className="cover-title-block">
          <div className="cover-eyebrow">Treasury Report</div>
          <h1 className="cover-title">Daily Cash Position</h1>
          <p className="cover-period">{fmtDate(reportDate)}</p>
        </div>

        <dl className="cover-meta">
          <div>
            <dt>Prepared for</dt>
            <dd>{org.name}</dd>
          </div>
          <div>
            <dt>Prepared by</dt>
            <dd>{preparedBy}</dd>
          </div>
          <div>
            <dt>Generated</dt>
            <dd>{preparedAt} ET</dd>
          </div>
          <div>
            <dt>Coverage</dt>
            <dd>{accounts.length} accounts · {bankCount} {bankCount === 1 ? 'bank' : 'banks'}</dd>
          </div>
        </dl>
      </div>

      {/* ──────────────────────── EXECUTIVE SUMMARY ──────────────────────── */}
      <div className="running-header">
        <span><strong>{org.name}</strong> · Daily Cash Position</span>
        <span>{fmtDate(reportDate)}</span>
      </div>

      <h2 className="section">Executive Summary</h2>
      
      <div className="kpi-grid">
        <div className="kpi">
          <div className="kpi-label">Total Cash</div>
          <div className="kpi-value" style={{ color: accentColor }}>{fmt(metrics.totalCash)}</div>
          <div className="kpi-delta">
            {metrics.dod >= 0 ? '↑' : '↓'} {fmt(Math.abs(metrics.dod))} day-over-day
          </div>
        </div>
        <div className="kpi">
          <div className="kpi-label">Available</div>
          <div className="kpi-value">{fmt(metrics.availableCash)}</div>
          <div className="kpi-delta">
            {((metrics.availableCash / Math.max(metrics.totalCash, 1)) * 100).toFixed(0)}% of total
          </div>
        </div>
        <div className="kpi">
          <div className="kpi-label">Operating</div>
          <div className="kpi-value">{fmt(metrics.operatingCash)}</div>
          <div className="kpi-delta">
            {((metrics.operatingCash / Math.max(metrics.totalCash, 1)) * 100).toFixed(0)}% of total
          </div>
        </div>
        <div className="kpi">
          <div className="kpi-label">Week-over-week</div>
          <div className="kpi-value" style={{ fontSize: '14pt' }}>
            {metrics.wow != null ? fmt(metrics.wow) : '—'}
          </div>
          <div className="kpi-delta">
            {metrics.wowPct != null ? fmtPct(metrics.wowPct) : 'No prior data'}
          </div>
        </div>
      </div>

      <p className="commentary">
        As of {fmtDate(reportDate)}, the consolidated cash position stood at <strong>{fmt(metrics.totalCash)}</strong>{' '}
        across {accounts.length} accounts at {bankCount} institution{bankCount !== 1 ? 's' : ''}.
        {metrics.dod !== 0 && (
          <> The position {metrics.dod > 0 ? 'increased' : 'decreased'} by <strong>{fmt(Math.abs(metrics.dod))}</strong> from the prior business day.</>
        )}
        {metrics.wow != null && Math.abs(metrics.wowPct) > 1 && (
          <> Week-over-week, the position has {metrics.wow > 0 ? 'increased' : 'decreased'} by <strong>{fmtPct(metrics.wowPct)}</strong>.</>
        )}
      </p>

      {/* ──────────────────────── ACCOUNT BREAKDOWN ──────────────────────── */}
      <h2 className="section">Account Detail</h2>
      
      <table className="report-table">
        <thead>
          <tr>
            <th>Institution</th>
            <th>Account</th>
            <th>Type</th>
            <th className="num">Current Balance</th>
            <th className="num">Available</th>
            <th className="num">% of Total</th>
          </tr>
        </thead>
        <tbody>
          {accounts.map(a => (
            <tr key={a.id}>
              <td>{a.bank_connections?.institution_name || '—'}</td>
              <td>{a.name}</td>
              <td style={{ textTransform: 'capitalize' }}>{a.type}</td>
              <td className="num">{fmt(a.current_balance)}</td>
              <td className="num">{fmt(a.available_balance ?? a.current_balance)}</td>
              <td className="num">
                {((a.current_balance / Math.max(metrics.totalCash, 1)) * 100).toFixed(1)}%
              </td>
            </tr>
          ))}
          <tr className="total">
            <td colSpan={3}>Total</td>
            <td className="num">{fmt(metrics.totalCash)}</td>
            <td className="num">{fmt(metrics.availableCash)}</td>
            <td className="num">100.0%</td>
          </tr>
        </tbody>
      </table>

      {/* ──────────────────────── MATERIAL MOVEMENTS ──────────────────────── */}
      {materialTxns.length > 0 && (
        <>
          <h2 className="section">Material Movements (Last 5 Business Days)</h2>
          <p className="commentary" style={{ fontSize: '9pt', color: '#6b7280' }}>
            Transactions exceeding $50,000 in absolute value, sorted most recent first.
          </p>
          <table className="report-table">
            <thead>
              <tr>
                <th>Date</th>
                <th>Account</th>
                <th>Description</th>
                <th className="num">Amount</th>
              </tr>
            </thead>
            <tbody>
              {materialTxns.map(t => (
                <tr key={t.id}>
                  <td>{new Date(t.date).toLocaleDateString('en-US', { month: 'short', day: 'numeric' })}</td>
                  <td>{t.accounts?.name || '—'}</td>
                  <td>{t.description}</td>
                  <td className="num">{fmt(t.amount)}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </>
      )}

      {/* ──────────────────────── FOOTNOTES ──────────────────────── */}
      <div className="footnotes">
        <p>
          <strong>Notes.</strong> Balances reflect the most recent sync with each institution and may include pending transactions.
          Available balance is the institution-reported figure where provided; otherwise current balance is shown.
        </p>
        <p>
          Day-over-day comparison uses the prior business day's end-of-day balance. Week-over-week uses the balance from {' '}
          {(() => { const d = new Date(reportDate); d.setDate(d.getDate() - 7); return fmtDate(d) })()}.
        </p>
        <p>
          Material movements threshold: $50,000. Categorization and counterparty analysis available in the Vaultline application.
        </p>
      </div>

      <div className="doc-footer">
        <span>{org.name} · Daily Cash Position · {fmtDate(reportDate)}</span>
        {!isWhiteLabel && (
          <span className="vaultline-mark">
            Powered by Vaultline
          </span>
        )}
      </div>
    </div>
  )
}
