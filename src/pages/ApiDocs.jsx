import { useState, useEffect } from 'react'
import { useAuth } from '@/hooks/useAuth'
import { Link } from 'react-router-dom'
import { BookOpen, Key, Globe, Shield, Clock, Code, ChevronRight, Copy, Check, AlertTriangle, Zap, ArrowLeft, Hash, Webhook, Terminal } from 'lucide-react'

function CopyBtn({ text }) {
  const [ok, setOk] = useState(false)
  return <button onClick={() => { navigator.clipboard.writeText(text); setOk(true); setTimeout(() => setOk(false), 1500) }} className="p-1 rounded hover:bg-deep text-t3 hover:text-cyan transition">{ok ? <Check size={11} className="text-green" /> : <Copy size={11} />}</button>
}

const SECTIONS = [
  { id: 'auth', label: 'Authentication' },
  { id: 'endpoints', label: 'Endpoints' },
  { id: 'responses', label: 'Response Format' },
  { id: 'errors', label: 'Error Codes' },
  { id: 'pagination', label: 'Pagination' },
  { id: 'rate', label: 'Rate Limits' },
  { id: 'webhooks', label: 'Webhooks' },
  { id: 'sdks', label: 'SDKs' },
]

const ENDPOINTS = [
  { method: 'GET', path: '/v1/accounts', desc: 'List connected bank accounts', response: '{ "data": [{ "id": "acc_...", "name": "Operating", "institution": "JPMorgan Chase", "type": "checking", "balance": 4250000, "currency": "USD", "last_synced": "2026-03-16T..." }], "meta": { "total": 4 } }' },
  { method: 'GET', path: '/v1/accounts/:id', desc: 'Get single account details', response: '{ "data": { "id": "acc_...", "name": "Operating", "balance": 4250000, "transactions_count": 847 } }' },
  { method: 'GET', path: '/v1/transactions', desc: 'Query transactions with filters', params: 'account_id, category, start_date, end_date, min_amount, max_amount, cursor, limit', response: '{ "data": [{ "id": "tx_...", "date": "2026-03-15", "description": "Stripe Payout", "amount": -12500, "category": "revenue" }], "meta": { "total": 247, "cursor": "tx_abc..." } }' },
  { method: 'POST', path: '/v1/transactions', desc: 'Create a manual transaction', body: '{ "account_id": "acc_...", "amount": 1500, "description": "Wire Transfer", "date": "2026-03-16", "category": "transfer" }' },
  { method: 'GET', path: '/v1/cash-position', desc: 'Current cash position summary', response: '{ "data": { "total_balance": 14200000, "accounts": 4, "last_updated": "2026-03-16T...", "change_24h": 125000, "change_7d": 892000 } }' },
  { method: 'GET', path: '/v1/forecast', desc: 'Cash flow forecast & runway', response: '{ "data": { "runway_months": 18.4, "monthly_burn": 245000, "confidence": 0.94, "projections": [{ "date": "2026-03-23", "projected": 14050000, "upper": 14200000, "lower": 13900000 }] } }' },
  { method: 'GET', path: '/v1/balances/daily', desc: 'Historical daily balances', params: 'start_date, end_date, account_id', response: '{ "data": [{ "date": "2026-03-15", "balance": 14150000 }] }' },
  { method: 'GET', path: '/v1/entities', desc: 'List entities (subsidiaries)', response: '{ "data": [{ "id": "ent_...", "name": "Acme Corp", "accounts": 2, "balance": 8500000 }] }' },
  { method: 'GET', path: '/v1/fx/rates', desc: 'Current FX rates for watchlist', response: '{ "data": { "base": "USD", "rates": { "EUR": 0.9215, "GBP": 0.7891 }, "updated": "2026-03-16T..." } }' },
  { method: 'POST', path: '/v1/webhooks', desc: 'Register a webhook endpoint', body: '{ "url": "https://your-server.com/webhook", "events": ["transaction.created", "balance.updated", "forecast.generated"] }' },
  { method: 'DELETE', path: '/v1/webhooks/:id', desc: 'Remove a webhook', response: '{ "deleted": true }' },
]

const ERRORS = [
  { code: 400, name: 'Bad Request', desc: 'Invalid parameters or malformed JSON body' },
  { code: 401, name: 'Unauthorized', desc: 'Missing or invalid API key in Authorization header' },
  { code: 403, name: 'Forbidden', desc: 'Valid key but insufficient permissions (e.g. viewer role)' },
  { code: 404, name: 'Not Found', desc: 'Resource does not exist or belongs to another org' },
  { code: 409, name: 'Conflict', desc: 'Duplicate resource (e.g. webhook URL already registered)' },
  { code: 422, name: 'Unprocessable', desc: 'Valid JSON but failed business validation' },
  { code: 429, name: 'Rate Limited', desc: 'Too many requests. Retry after the Retry-After header value' },
  { code: 500, name: 'Server Error', desc: 'Unexpected error. Contact support with the request ID' },
]

const WEBHOOK_EVENTS = [
  { event: 'transaction.created', desc: 'New transaction synced or manually created' },
  { event: 'transaction.updated', desc: 'Transaction recategorized or amount changed' },
  { event: 'balance.updated', desc: 'Account balance changed after sync' },
  { event: 'forecast.generated', desc: 'New forecast model generated' },
  { event: 'alert.triggered', desc: 'FX or cash alert threshold exceeded' },
  { event: 'member.invited', desc: 'New team member invited' },
  { event: 'member.removed', desc: 'Team member removed or suspended' },
]

const MC = { GET: 'text-green', POST: 'text-cyan', PUT: 'text-amber', DELETE: 'text-red' }
const MB = { GET: 'bg-green/[0.06] border-green/[0.08]', POST: 'bg-cyan/[0.06] border-cyan/[0.08]', PUT: 'bg-amber/[0.06] border-amber/[0.08]', DELETE: 'bg-red/[0.06] border-red/[0.08]' }

export default function ApiDocs() {
  const [active, setActive] = useState('auth')
  const [expandedEp, setExpandedEp] = useState(null)

  useEffect(() => { document.title = 'API Documentation \u2014 Vaultline' }, [])

  return (
    <div className="max-w-[1100px] mx-auto">
      <div className="flex gap-6">
        {/* Sidebar nav */}
        <div className="w-[200px] shrink-0 sticky top-6 self-start">
          <Link to="/api" className="flex items-center gap-1.5 text-[12px] font-mono text-t3 hover:text-cyan transition mb-4">
            <ArrowLeft size={12} /> Back to API Keys
          </Link>
          <div className="space-y-0.5">
            {SECTIONS.map(s => (
              <button key={s.id} onClick={() => { setActive(s.id); document.getElementById(s.id)?.scrollIntoView({ behavior: 'smooth', block: 'start' }) }}
                className={`w-full text-left px-3 py-2 rounded-lg text-[12px] font-mono transition-all ${active === s.id ? 'bg-cyan/[0.06] text-cyan font-semibold' : 'text-t3 hover:text-t2 hover:bg-deep'}`}>
                {s.label}
              </button>
            ))}
          </div>
          <div className="mt-6 p-3 rounded-xl border border-border bg-deep">
            <p className="text-[10px] font-mono text-t3 uppercase tracking-wider mb-1">BASE URL</p>
            <code className="text-[11px] font-mono text-cyan terminal-data break-all">{import.meta.env.VITE_SUPABASE_URL}/functions/v1/api</code>
          </div>
        </div>

        {/* Main content */}
        <div className="flex-1 space-y-8 pb-16">
          {/* Header */}
          <div>
            <div className="flex items-center gap-3 mb-2">
              <span className="terminal-label">API DOCUMENTATION</span>
              <span className="text-[10px] font-mono text-green bg-green/[0.06] border border-green/[0.08] px-2 py-0.5 rounded">v1 STABLE</span>
            </div>
            <p className="text-[14px] text-t2">RESTful API for programmatic access to your Vaultline treasury data. JSON over HTTPS with Bearer token authentication.</p>
          </div>

          {/* Auth */}
          <section id="auth" className="glass-card rounded-2xl p-6">
            <h2 className="flex items-center gap-2 text-[16px] font-display font-bold mb-4"><Key size={16} className="text-cyan" /> Authentication</h2>
            <p className="text-[13px] text-t2 mb-4">All requests require a Bearer token in the Authorization header. Get your API key from the <Link to="/api" className="text-cyan hover:underline">API Access</Link> page.</p>
            <div className="terminal-inset p-4 rounded-xl">
              <div className="flex items-center justify-between mb-2"><span className="text-[10px] font-mono text-t3">HEADER</span><CopyBtn text='Authorization: Bearer vl_live_...' /></div>
              <code className="text-[13px] font-mono text-t1 terminal-data">Authorization: Bearer vl_live_xxxxxxxxxxxxxxxxxx</code>
            </div>
            <div className="mt-4 flex items-start gap-3 p-3.5 rounded-xl border border-amber/[0.1] bg-amber/[0.02]">
              <Shield size={14} className="text-amber shrink-0 mt-0.5" />
              <p className="text-[12px] text-t3">Production keys (<code className="text-amber">vl_live_</code>) access real data. Use sandbox keys (<code className="text-amber">vl_test_</code>) for development. Never expose keys in client-side code.</p>
            </div>
          </section>

          {/* Endpoints */}
          <section id="endpoints" className="glass-card rounded-2xl p-6">
            <h2 className="flex items-center gap-2 text-[16px] font-display font-bold mb-4"><Globe size={16} className="text-cyan" /> Endpoints</h2>
            <div className="rounded-xl border border-border overflow-hidden divide-y divide-border/30">
              {ENDPOINTS.map((ep, i) => (
                <div key={i}>
                  <button onClick={() => setExpandedEp(expandedEp === i ? null : i)} className="w-full flex items-center px-5 py-3.5 hover:bg-deep transition text-left group">
                    <span className={`px-2 py-0.5 rounded text-[10px] font-mono font-bold mr-4 w-14 text-center border ${MB[ep.method]} ${MC[ep.method]}`}>{ep.method}</span>
                    <code className="font-mono text-[13px] text-cyan font-semibold mr-4 min-w-[200px] terminal-data">{ep.path}</code>
                    <span className="text-[12px] text-t2 flex-1">{ep.desc}</span>
                    <ChevronRight size={12} className={`text-t3 transition-transform ${expandedEp === i ? 'rotate-90' : ''}`} />
                  </button>
                  {expandedEp === i && (
                    <div className="px-5 pb-4 space-y-3 border-t border-border/20 pt-3 bg-deep">
                      {ep.params && <div><p className="text-[10px] font-mono text-t3 uppercase mb-1">QUERY PARAMS</p><p className="text-[12px] font-mono text-t2">{ep.params}</p></div>}
                      {ep.body && <div><p className="text-[10px] font-mono text-t3 uppercase mb-1">REQUEST BODY</p><div className="terminal-inset p-3 rounded-lg"><pre className="text-[11px] font-mono text-t2 whitespace-pre-wrap">{ep.body}</pre></div></div>}
                      {ep.response && <div><div className="flex items-center justify-between"><p className="text-[10px] font-mono text-t3 uppercase mb-1">RESPONSE</p><CopyBtn text={ep.response} /></div><div className="terminal-inset p-3 rounded-lg"><pre className="text-[11px] font-mono text-t2 whitespace-pre-wrap">{ep.response}</pre></div></div>}
                    </div>
                  )}
                </div>
              ))}
            </div>
          </section>

          {/* Response Format */}
          <section id="responses" className="glass-card rounded-2xl p-6">
            <h2 className="flex items-center gap-2 text-[16px] font-display font-bold mb-4"><Code size={16} className="text-cyan" /> Response Format</h2>
            <p className="text-[13px] text-t2 mb-4">All responses return JSON with a consistent envelope. Successful responses use a <code className="text-cyan">data</code> key. Errors use an <code className="text-red">error</code> key.</p>
            <div className="grid grid-cols-2 gap-4">
              <div>
                <p className="text-[10px] font-mono text-green uppercase mb-2">SUCCESS (200)</p>
                <div className="terminal-inset p-4 rounded-xl"><pre className="text-[11px] font-mono text-t2 whitespace-pre-wrap">{'{\n  "data": { ... },\n  "meta": {\n    "total": 247,\n    "cursor": "tx_abc...",\n    "request_id": "req_..."\n  }\n}'}</pre></div>
              </div>
              <div>
                <p className="text-[10px] font-mono text-red uppercase mb-2">ERROR (4xx/5xx)</p>
                <div className="terminal-inset p-4 rounded-xl"><pre className="text-[11px] font-mono text-t2 whitespace-pre-wrap">{'{\n  "error": {\n    "code": "invalid_param",\n    "message": "start_date must\n      be before end_date",\n    "request_id": "req_..."\n  }\n}'}</pre></div>
              </div>
            </div>
          </section>

          {/* Errors */}
          <section id="errors" className="glass-card rounded-2xl p-6">
            <h2 className="flex items-center gap-2 text-[16px] font-display font-bold mb-4"><AlertTriangle size={16} className="text-amber" /> Error Codes</h2>
            <div className="rounded-xl border border-border overflow-hidden">
              <table className="w-full text-[12px]">
                <thead><tr className="terminal-inset"><th className="text-left px-4 py-2.5 font-mono text-t3 font-semibold">CODE</th><th className="text-left px-4 py-2.5 font-mono text-t3 font-semibold">NAME</th><th className="text-left px-4 py-2.5 font-mono text-t3 font-semibold">DESCRIPTION</th></tr></thead>
                <tbody>{ERRORS.map(e => (
                  <tr key={e.code} className="border-t border-border/20 hover:bg-deep transition">
                    <td className="px-4 py-2.5 font-mono font-bold terminal-data" style={{ color: e.code < 500 ? (e.code === 429 ? '#FBBF24' : '#FB7185') : '#EF4444' }}>{e.code}</td>
                    <td className="px-4 py-2.5 font-mono text-t1 font-semibold">{e.name}</td>
                    <td className="px-4 py-2.5 text-t2">{e.desc}</td>
                  </tr>
                ))}</tbody>
              </table>
            </div>
          </section>

          {/* Pagination */}
          <section id="pagination" className="glass-card rounded-2xl p-6">
            <h2 className="flex items-center gap-2 text-[16px] font-display font-bold mb-4"><Hash size={16} className="text-purple" /> Pagination</h2>
            <p className="text-[13px] text-t2 mb-4">List endpoints use cursor-based pagination. Pass <code className="text-cyan">limit</code> (max 100, default 25) and the returned <code className="text-cyan">cursor</code> for the next page.</p>
            <div className="terminal-inset p-4 rounded-xl">
              <pre className="text-[12px] font-mono text-t2">GET /v1/transactions?limit=50&cursor=tx_abc123...</pre>
            </div>
            <p className="text-[12px] text-t3 mt-3">When no more results exist, the <code className="text-t2">cursor</code> field in <code className="text-t2">meta</code> will be <code className="text-t2">null</code>.</p>
          </section>

          {/* Rate Limits */}
          <section id="rate" className="glass-card rounded-2xl p-6">
            <h2 className="flex items-center gap-2 text-[16px] font-display font-bold mb-4"><Zap size={16} className="text-amber" /> Rate Limits</h2>
            <div className="rounded-xl border border-border overflow-hidden">
              <table className="w-full text-[12px]">
                <thead><tr className="terminal-inset"><th className="text-left px-4 py-2.5 font-mono text-t3">PLAN</th><th className="text-left px-4 py-2.5 font-mono text-t3">LIMIT</th><th className="text-left px-4 py-2.5 font-mono text-t3">BURST</th><th className="text-left px-4 py-2.5 font-mono text-t3">DAILY</th></tr></thead>
                <tbody>
                  {[{ plan: 'Starter', limit: '100/min', burst: '20/sec', daily: '10K' }, { plan: 'Growth', limit: '1,000/min', burst: '50/sec', daily: '100K' }, { plan: 'Enterprise', limit: '5,000/min', burst: '200/sec', daily: 'Unlimited' }].map(r => (
                    <tr key={r.plan} className="border-t border-border/20 hover:bg-deep transition">
                      <td className="px-4 py-2.5 font-mono text-t1 font-semibold">{r.plan}</td>
                      <td className="px-4 py-2.5 font-mono text-cyan terminal-data">{r.limit}</td>
                      <td className="px-4 py-2.5 font-mono text-t2 terminal-data">{r.burst}</td>
                      <td className="px-4 py-2.5 font-mono text-t2 terminal-data">{r.daily}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
            <p className="text-[12px] text-t3 mt-3">Rate limit headers: <code className="text-t2">X-RateLimit-Limit</code>, <code className="text-t2">X-RateLimit-Remaining</code>, <code className="text-t2">Retry-After</code></p>
          </section>

          {/* Webhooks */}
          <section id="webhooks" className="glass-card rounded-2xl p-6">
            <h2 className="flex items-center gap-2 text-[16px] font-display font-bold mb-4"><Webhook size={16} className="text-green" /> Webhooks</h2>
            <p className="text-[13px] text-t2 mb-4">Receive real-time notifications via HTTPS POST to your registered endpoint. All payloads are signed with HMAC-SHA256 using your webhook secret.</p>
            <div className="rounded-xl border border-border overflow-hidden">
              <table className="w-full text-[12px]">
                <thead><tr className="terminal-inset"><th className="text-left px-4 py-2.5 font-mono text-t3">EVENT</th><th className="text-left px-4 py-2.5 font-mono text-t3">DESCRIPTION</th></tr></thead>
                <tbody>{WEBHOOK_EVENTS.map(e => (
                  <tr key={e.event} className="border-t border-border/20 hover:bg-deep transition">
                    <td className="px-4 py-2.5 font-mono text-cyan terminal-data font-semibold">{e.event}</td>
                    <td className="px-4 py-2.5 text-t2">{e.desc}</td>
                  </tr>
                ))}</tbody>
              </table>
            </div>
            <div className="mt-4"><p className="text-[10px] font-mono text-t3 uppercase mb-2">WEBHOOK HEADERS</p>
              <div className="terminal-inset p-4 rounded-xl mb-3"><pre className="text-[11px] font-mono text-t2 whitespace-pre-wrap">{'X-Vaultline-Event: transaction.created\nX-Vaultline-Signature: v1=a1b2c3...\nX-Vaultline-Timestamp: 1713024600\nX-Vaultline-Delivery: evt_abc123...'}</pre></div>
              <p className="text-[10px] font-mono text-t3 uppercase mb-2">WEBHOOK PAYLOAD</p>
              <div className="terminal-inset p-4 rounded-xl"><pre className="text-[11px] font-mono text-t2 whitespace-pre-wrap">{'{\n  "id": "evt_abc123def456...",\n  "type": "transaction.created",\n  "created": 1713024600,\n  "data": { ... },\n  "api_version": "v1"\n}'}</pre></div>
              <p className="text-[12px] text-t3 mt-3">Verify signatures with HMAC-SHA256: <code className="text-cyan">hmac(secret, timestamp + "." + payload)</code>. Retries on failure: 3 attempts at 1min, 5min, 15min. Endpoints paused after 10 consecutive failures.</p>
            </div>
          </section>

          {/* SDKs */}
          <section id="sdks" className="glass-card rounded-2xl p-6">
            <h2 className="flex items-center gap-2 text-[16px] font-display font-bold mb-4"><Terminal size={16} className="text-purple" /> SDKs & Libraries</h2>
            <div className="grid grid-cols-3 gap-3">
              {[
                { lang: 'Node.js', pkg: 'npm install @vaultline/sdk', color: 'green' },
                { lang: 'Python', pkg: 'pip install vaultline', color: 'cyan' },
                { lang: 'Ruby', pkg: 'gem install vaultline', color: 'red' },
              ].map(s => (
                <div key={s.lang} className="terminal-inset p-4 rounded-xl">
                  <p className="text-[11px] font-mono text-t3 uppercase mb-2">{s.lang}</p>
                  <div className="flex items-center gap-2">
                    <code className={`text-[12px] font-mono text-${s.color} terminal-data`}>{s.pkg}</code>
                    <CopyBtn text={s.pkg} />
                  </div>
                </div>
              ))}
            </div>
            <p className="text-[12px] text-t3 mt-3 font-mono">SDKs wrap the REST API with typed methods, automatic pagination, retry logic, and webhook signature verification.</p>
          </section>
        </div>
      </div>
    </div>
  )
}
