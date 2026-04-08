import AnimatedBackground from "@/components/AnimatedBackground"
import { useState, useEffect } from 'react'
import { SkeletonPage } from '@/components/Skeleton'
import { useSEO } from '@/hooks/useSEO'
import { Link } from 'react-router-dom'
import { supabase } from '@/lib/supabase'
import { safeInvoke } from '@/lib/safeInvoke'
import ThemeToggle from '@/components/ThemeToggle'
import { Flame, ArrowRight, Loader2, DollarSign, TrendingDown, Calendar, Plus, X, Zap } from 'lucide-react'

function fmt(n) { const a = Math.abs(n||0); return a >= 1e6 ? `$${(a/1e6).toFixed(1)}M` : a >= 1e3 ? `$${(a/1e3).toFixed(0)}K` : `$${a.toFixed(0)}` }

export default function BurnSimulator() {
  const [cash, setCash] = useState(2000000)
  const [revenue, setRevenue] = useState(150000)
  const [expenses, setExpenses] = useState(200000)
  const [custom, setCustom] = useState([])
  const [results, setResults] = useState(null)
  const [loading, setLoading] = useState(false)
  const [email, setEmail] = useState('')
  const [step, setStep] = useState('input') // input | results

  useSEO({ title: 'Burn Rate Simulator 2014 Model Your Runway', description: 'Model cash runway scenarios with different revenue and expense assumptions. See exactly when you run out of cash and plan accordingly.', canonical: '/burn-simulator' })

  async function simulate() {
    setLoading(true)
    const scenarios = [
      { name: 'Base Case', revenue_change: 0, expense_change: 0 },
      { name: 'Revenue -20%', revenue_change: -0.2, expense_change: 0 },
      { name: 'Revenue -50%', revenue_change: -0.5, expense_change: 0 },
      { name: 'Expenses +20%', revenue_change: 0, expense_change: 0.2 },
      { name: 'Cut 30% costs', revenue_change: 0, expense_change: -0.3 },
      ...custom.map(c => ({ name: c.name, revenue_change: (c.revPct || 0) / 100, expense_change: (c.expPct || 0) / 100 })),
    ]
    const { data } = await safeInvoke('tools', {
      action: 'simulate_burn', current_cash: cash, monthly_revenue: revenue, monthly_expenses: expenses, scenarios,
    })
    if (email) {
      await safeInvoke('lead-capture', {
        action: 'capture', email, source: 'simulator', roi_inputs: { current_cash: cash, monthly_revenue: revenue, monthly_expenses: expenses }, page_url: window.location.href,
      })
    }
    setResults(data)
    setStep('results')
    setLoading(false)
  }

  function addCustom() { setCustom(p => [...p, { name: `Scenario ${p.length + 6}`, revPct: 0, expPct: 0 }]) }

  return (
    <div className="min-h-screen bg-void">
      <AnimatedBackground variant="contours" />
      <div className="fixed top-5 right-5 z-50"><ThemeToggle /></div>
      <div className="absolute w-[600px] h-[600px] top-[-200px] right-[-100px] bg-[radial-gradient(circle,rgba(251,191,36,0.04)_0%,transparent_60%)] pointer-events-none" />

      <nav className="relative z-10 flex items-center justify-between px-8 py-5 max-w-6xl mx-auto">
        <Link to="/" className="flex items-center gap-2">
          <img src="/logo.svg" alt="Vaultline" className="w-8 h-8 rounded-lg" />
          <span className="font-display text-lg font-extrabold">Vault<span className="bg-gradient-to-r from-cyan to-purple bg-clip-text text-transparent">line</span></span>
        </Link>
        <div className="flex items-center gap-3">
          <Link to="/roi" className="text-[13px] text-t2 hover:text-cyan transition">ROI Calculator</Link>
          <Link to="/signup" className="px-4 py-2 rounded-xl bg-gradient-to-r from-cyan/90 to-cyan/70 text-void text-[13px] font-semibold hover:-translate-y-px transition-all">Get Started</Link>
        </div>
      </nav>

      <div className="relative z-10 max-w-5xl mx-auto px-6 pb-20">
        <div className="text-center mb-10 pt-8">
          <span className="text-[11px] font-mono font-bold uppercase tracking-[0.15em] text-amber">BURN RATE SIMULATOR</span>
          <h1 className="font-display text-4xl font-black tracking-tight mt-3 mb-3">How long will your cash last?</h1>
          <p className="text-[16px] text-t3 max-w-2xl mx-auto">Model your runway under different revenue and expense scenarios. See exactly when cash runs out — and what levers to pull.</p>
        </div>

        {step === 'input' && (
          <div className="grid grid-cols-1 lg:grid-cols-5 gap-8">
            <div className="lg:col-span-3 glass-card rounded-2xl p-8 space-y-6">
              <h2 className="font-display text-lg font-bold flex items-center gap-2"><Flame size={18} className="text-amber" /> Your Numbers</h2>
              {[
                { id: 'cash', label: 'Current cash balance', value: cash, set: setCash, min: 50000, max: 50000000, step: 50000, icon: DollarSign },
                { id: 'rev', label: 'Monthly revenue', value: revenue, set: setRevenue, min: 0, max: 10000000, step: 10000, icon: TrendingDown },
                { id: 'exp', label: 'Monthly expenses', value: expenses, set: setExpenses, min: 10000, max: 10000000, step: 10000, icon: Calendar },
              ].map(s => {
                const pct = ((s.value - s.min) / (s.max - s.min)) * 100
                return (
                  <div key={s.id}>
                    <div className="flex items-center justify-between mb-1.5">
                      <div className="flex items-center gap-2"><s.icon size={13} className="text-t3" /><span className="text-[12px] text-t2">{s.label}</span></div>
                      <span className="font-mono text-[14px] font-bold text-amber terminal-data">{fmt(s.value)}</span>
                    </div>
                    <input type="range" min={s.min} max={s.max} step={s.step} value={s.value} onChange={e => s.set(parseFloat(e.target.value))}
                      className="w-full h-[4px] rounded-full appearance-none cursor-pointer"
                      style={{ background: `linear-gradient(to right, #FBBF24 ${pct}%, rgba(148,163,184,0.15) ${pct}%)` }} />
                  </div>
                )
              })}

              {/* Custom scenarios */}
              {custom.length > 0 && (
                <div className="space-y-3 pt-2 border-t border-border/20">
                  <span className="text-[11px] font-mono text-t3 uppercase tracking-wider">CUSTOM SCENARIOS</span>
                  {custom.map((c, i) => (
                    <div key={i} className="flex items-center gap-2">
                      <input value={c.name} onChange={e => { const n = [...custom]; n[i].name = e.target.value; setCustom(n) }}
                        className="flex-1 px-3 py-2 rounded-lg glass-input text-t1 text-[12px] outline-none" placeholder="Name" />
                      <div className="flex items-center gap-1">
                        <span className="text-[10px] text-t4">Rev</span>
                        <input type="number" value={c.revPct} onChange={e => { const n = [...custom]; n[i].revPct = parseFloat(e.target.value); setCustom(n) }}
                          className="w-16 px-2 py-2 rounded-lg glass-input text-t1 text-[11px] font-mono text-right outline-none" /><span className="text-[10px] text-t4">%</span>
                      </div>
                      <div className="flex items-center gap-1">
                        <span className="text-[10px] text-t4">Exp</span>
                        <input type="number" value={c.expPct} onChange={e => { const n = [...custom]; n[i].expPct = parseFloat(e.target.value); setCustom(n) }}
                          className="w-16 px-2 py-2 rounded-lg glass-input text-t1 text-[11px] font-mono text-right outline-none" /><span className="text-[10px] text-t4">%</span>
                      </div>
                      <button onClick={() => setCustom(p => p.filter((_, j) => j !== i))} className="p-1 text-t4 hover:text-red transition"><X size={12} /></button>
                    </div>
                  ))}
                </div>
              )}
              <button onClick={addCustom} className="text-[11px] text-t3 hover:text-amber transition flex items-center gap-1"><Plus size={11} /> Add custom scenario</button>

              <input value={email} onChange={e => setEmail(e.target.value)} type="email" placeholder="Email (optional — save your simulation)"
                className="w-full px-4 py-3 rounded-xl glass-input text-t1 text-[14px] outline-none focus:border-amber/40 transition placeholder:text-t3" />

              <button onClick={simulate} disabled={loading}
                className="w-full py-3.5 rounded-xl bg-gradient-to-r from-amber/90 to-amber/70 text-void font-semibold text-[15px] shadow-[0_2px_12px_rgba(251,191,36,0.2)] hover:-translate-y-px transition-all flex items-center justify-center gap-2 disabled:opacity-50">
                {loading ? <><Loader2 size={15} className="animate-spin" /> Simulating...</> : <><Flame size={15} /> Run Simulation</>}
              </button>
            </div>

            {/* Live preview */}
            <div className="lg:col-span-2 glass-card rounded-2xl p-6">
              <span className="text-[10px] font-mono text-t4 uppercase tracking-wider">QUICK PREVIEW</span>
              <div className="mt-3 space-y-4">
                <div>
                  <p className="text-[11px] text-t3">Monthly net</p>
                  <p className={`font-mono text-[24px] font-black terminal-data ${revenue - expenses >= 0 ? 'text-green' : 'text-red'}`}>{fmt(revenue - expenses)}</p>
                </div>
                <div>
                  <p className="text-[11px] text-t3">Base runway</p>
                  <p className="font-mono text-[24px] font-black text-amber terminal-data">
                    {revenue >= expenses ? '∞' : `${Math.round(cash / (expenses - revenue) * 10) / 10} mo`}
                  </p>
                </div>
                <div>
                  <p className="text-[11px] text-t3">Zero-cash date</p>
                  <p className="font-mono text-[16px] font-bold text-t1 terminal-data">
                    {revenue >= expenses ? 'Never (profitable)' : (() => { const d = new Date(); d.setMonth(d.getMonth() + Math.floor(cash / (expenses - revenue))); return d.toLocaleDateString('en-US', { month: 'short', year: 'numeric' }) })()}
                  </p>
                </div>
              </div>
            </div>
          </div>
        )}

        {step === 'results' && results && (
          <div className="space-y-6">
            <div className="glass-card rounded-2xl p-8 text-center border-amber/[0.12]">
              <span className="text-[11px] font-mono text-amber uppercase tracking-wider">BASE CASE RUNWAY</span>
              <p className="font-mono text-[52px] font-black text-t1 terminal-data mt-2">{results.base_runway >= 100 ? '∞' : results.base_runway}<span className="text-[20px] text-t3"> months</span></p>
            </div>

            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
              {(results.scenarios || []).map((s, i) => (
                <div key={i} className={`glass-card rounded-xl p-5 ${s.runway_months < 6 ? 'border-red/[0.15]' : s.runway_months < 12 ? 'border-amber/[0.1]' : ''}`}>
                  <h3 className="text-[13px] font-bold text-t1 mb-3">{s.name}</h3>
                  <div className="space-y-2">
                    <div className="flex justify-between text-[11px]"><span className="text-t3">Revenue</span><span className="font-mono text-t1">{fmt(s.monthly_revenue)}</span></div>
                    <div className="flex justify-between text-[11px]"><span className="text-t3">Expenses</span><span className="font-mono text-t1">{fmt(s.monthly_expenses)}</span></div>
                    <div className="flex justify-between text-[11px] border-t border-border/20 pt-1"><span className="text-t3">Net monthly</span><span className={`font-mono font-bold ${s.net_monthly >= 0 ? 'text-green' : 'text-red'}`}>{fmt(s.net_monthly)}</span></div>
                  </div>
                  <div className="mt-3 pt-3 border-t border-border/20 text-center">
                    <span className={`font-mono text-[22px] font-black terminal-data ${s.runway_months < 6 ? 'text-red' : s.runway_months < 12 ? 'text-amber' : 'text-green'}`}>
                      {s.runway_months >= 100 ? '∞' : s.runway_months} <span className="text-[12px] text-t3">months</span>
                    </span>
                  </div>
                </div>
              ))}
            </div>

            <div className="flex items-center justify-center gap-3">
              <button onClick={() => setStep('input')} className="px-5 py-2.5 rounded-xl border border-border text-[13px] text-t2 hover:border-border-hover transition">Edit & Re-simulate</button>
              <Link to="/signup" className="px-5 py-2.5 rounded-xl bg-gradient-to-r from-cyan/90 to-cyan/70 text-void font-semibold text-[13px] glow-sm hover:-translate-y-px transition-all flex items-center gap-2">
                Get Started <ArrowRight size={14} />
              </Link>
            </div>
          </div>
        )}
      </div>
    </div>
  )
}
