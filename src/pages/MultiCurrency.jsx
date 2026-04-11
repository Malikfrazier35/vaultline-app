import { useState, useEffect, useMemo } from 'react'
import { SkeletonPage } from '@/components/Skeleton'
import { useTreasury } from '@/hooks/useTreasury'
import { useAuth } from '@/hooks/useAuth'
import { supabase } from '@/lib/supabase'
import { AreaChart, Area, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer, ReferenceLine } from 'recharts'
import { ChartTooltip } from '@/components/ChartTooltip'
import { useChartTheme } from '@/hooks/useChartTheme'
import { useToast } from '@/components/Toast'
import { useTheme } from '@/hooks/useTheme'
import { Globe, ArrowUpRight, ArrowDownRight, Bell, Clock, RefreshCw, Wifi, WifiOff, Plus, X, Calculator, Activity, Loader2, TrendingUp } from 'lucide-react'

const ALL_CURRENCIES = {
  EUR:{name:'Euro',symbol:'\u20AC'},GBP:{name:'British Pound',symbol:'\u00A3'},CAD:{name:'Canadian Dollar',symbol:'C$'},JPY:{name:'Japanese Yen',symbol:'\u00A5'},
  CHF:{name:'Swiss Franc',symbol:'Fr'},AUD:{name:'Australian Dollar',symbol:'A$'},NZD:{name:'New Zealand Dollar',symbol:'NZ$'},SEK:{name:'Swedish Krona',symbol:'kr'},
  NOK:{name:'Norwegian Krone',symbol:'kr'},DKK:{name:'Danish Krone',symbol:'kr'},SGD:{name:'Singapore Dollar',symbol:'S$'},HKD:{name:'Hong Kong Dollar',symbol:'HK$'},
  KRW:{name:'South Korean Won',symbol:'\u20A9'},MXN:{name:'Mexican Peso',symbol:'MX$'},BRL:{name:'Brazilian Real',symbol:'R$'},INR:{name:'Indian Rupee',symbol:'\u20B9'},
  ZAR:{name:'South African Rand',symbol:'R'},PLN:{name:'Polish Zloty',symbol:'z\u0142'},CZK:{name:'Czech Koruna',symbol:'K\u010D'},HUF:{name:'Hungarian Forint',symbol:'Ft'},
  TRY:{name:'Turkish Lira',symbol:'\u20BA'},CNY:{name:'Chinese Yuan',symbol:'\u00A5'},THB:{name:'Thai Baht',symbol:'\u0E3F'},MYR:{name:'Malaysian Ringgit',symbol:'RM'},
}

const PALETTE = {EUR:'#818CF8',GBP:'#F472B6',CAD:'#FBBF24',JPY:'#FB7185',CHF:'#94A3B8',AUD:'#22D3EE',NZD:'#34D399',SEK:'#A78BFA',NOK:'#06B6D4',DKK:'#FB923C',SGD:'#F472B6',HKD:'#E879F9',KRW:'#38BDF8',MXN:'#4ADE80',BRL:'#FDE047',INR:'#FB7185',ZAR:'#FACC15',PLN:'#C084FC',CZK:'#67E8F9',HUF:'#FDA4AF',TRY:'#F87171',CNY:'#EF4444',THB:'#A3E635',MYR:'#2DD4BF'}
const DEFAULT_PAIRS = ['EUR','GBP','CAD','JPY','CHF','AUD']

function fmt(n) { const a=Math.abs(n||0); return a>=1e6?(a/1e6).toFixed(2)+'M':a>=1e3?(a/1e3).toFixed(1)+'K':a.toFixed(0) }

export default function MultiCurrency() {
  const { cashPosition } = useTreasury()
  const { org, isAdmin } = useAuth()
  const ct = useChartTheme()
  const { isDark } = useTheme()
  const [watchlist, setWatchlist] = useState(DEFAULT_PAIRS)
  const [selectedCurrency, setSelectedCurrency] = useState('EUR')
  const [alertThreshold, setAlertThreshold] = useState(2)
  const [time, setTime] = useState(new Date())
  const [fxData, setFxData] = useState(null)
  const [fxLoading, setFxLoading] = useState(true)
  const [fxError, setFxError] = useState(null)
  const [lastFetch, setLastFetch] = useState(null)
  const [showAddModal, setShowAddModal] = useState(false)
  const [convertAmount, setConvertAmount] = useState(10000)
  const toast = useToast()

  useEffect(() => { document.title = 'Multi-Currency \u2014 Vaultline' }, [])
  useEffect(() => { const t = setInterval(() => setTime(new Date()), 1000); return () => clearInterval(t) }, [])

  // Load watchlist from DB
  useEffect(() => {
    if (!org?.id) return
    supabase.from('fx_watchlist').select('currency_code, is_active, alert_threshold').eq('org_id', org.id).eq('is_active', true)
      .then(({ data }) => {
        if (data?.length > 0) {
          setWatchlist(data.map(d => d.currency_code))
          const th = data[0]?.alert_threshold; if (th) setAlertThreshold(th)
        }
      })
  }, [org?.id])

  async function fetchFX() {
    setFxLoading(true); setFxError(null)
    try {
      const { data, error } = await supabase.functions.invoke('fx-rates', { body: { symbols: watchlist.join(','), days: 30 } })
      if (error) throw error; if (data?.error) throw new Error(data.error)
      setFxData(data); setLastFetch(new Date())
    } catch (err) { setFxError(err.message || 'Failed to fetch') } finally { setFxLoading(false) }
  }

  useEffect(() => { if (watchlist.length > 0) fetchFX() }, [watchlist.join(',')])
  useEffect(() => { const t = setInterval(fetchFX, 300000); return () => clearInterval(t) }, [watchlist.join(',')])

  async function addCurrency(code) {
    if (watchlist.includes(code)) return
    const newList = [...watchlist, code]; setWatchlist(newList)
    if (org?.id) {
      await supabase.from('fx_watchlist').upsert({ org_id: org.id, currency_code: code, is_active: true }, { onConflict: 'org_id,currency_code' })
    }
    toast.success(`${code} added to watchlist`)
    setShowAddModal(false)
  }

  async function removeCurrency(code) {
    if (watchlist.length <= 1) return
    const newList = watchlist.filter(c => c !== code); setWatchlist(newList)
    if (selectedCurrency === code) setSelectedCurrency(newList[0])
    if (org?.id) {
      await supabase.from('fx_watchlist').update({ is_active: false }).eq('org_id', org.id).eq('currency_code', code)
    }
    toast.info(`${code} removed`)
  }

  const totalUSD = cashPosition?.total_balance || 0
  const currencies = (fxData?.currencies || []).filter(c => watchlist.includes(c.code))
  const history = fxData?.history || {}
  const selected = currencies.find(c => c.code === selectedCurrency)
  const selectedHistory = history[selectedCurrency] || []
  const change = selected?.change || 0
  const change7d = selected?.change7d || 0
  const volatility = selected?.volatility || 0
  const isUp = change >= 0
  const high = selectedHistory.length > 0 ? Math.max(...selectedHistory.map(h => h.rate)) : 0
  const low = selectedHistory.length > 0 ? Math.min(...selectedHistory.map(h => h.rate)) : 0
  const avg = selectedHistory.length > 0 ? selectedHistory.reduce((s, h) => s + h.rate, 0) / selectedHistory.length : 0
  const greenColor = isDark ? '#34D399' : '#059669'
  const redColor = isDark ? '#FB7185' : '#E11D48'
  const cyanColor = isDark ? '#22D3EE' : '#0891B2'
  const deepBg = isDark ? '#080e1c' : '#f8fafc'
  const subtleBorder = isDark ? 'rgba(30,48,80,0.25)' : 'rgba(15,23,42,0.06)'
  const statusBarBg = isDark ? '#060b16' : '#f1f5f9'
  const availableToAdd = Object.keys(ALL_CURRENCIES).filter(c => !watchlist.includes(c))

  return (
    <div className="space-y-5">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-3">
          <span className="terminal-label">FX MONITOR</span>
          <span className="text-[11px] font-mono text-t3">{currencies.length} pairs</span>
          {fxData && <span className="text-[10px] font-mono text-green px-2 py-0.5 rounded border border-green/[0.1] bg-green/[0.04]">LIVE</span>}
          {fxError && <span className="text-[10px] font-mono text-red px-2 py-0.5 rounded border border-red/[0.1] bg-red/[0.04]">OFFLINE</span>}
        </div>
        <div className="flex items-center gap-2">
          {isAdmin && (
            <button onClick={() => setShowAddModal(true)} className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-[12px] font-mono text-t3 hover:text-cyan border border-border hover:border-cyan/[0.15] transition-all">
              <Plus size={12} /> Add Pair
            </button>
          )}
          <button onClick={fetchFX} disabled={fxLoading} className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-[12px] font-mono text-t3 hover:text-cyan border border-border hover:border-cyan/[0.15] transition-all disabled:opacity-50">
            <RefreshCw size={12} className={fxLoading ? 'animate-spin' : ''} /> Refresh
          </button>
        </div>
      </div>

      {/* Currency pair selector */}
      <div className="flex items-center gap-2 flex-wrap">
        {currencies.map(c => {
          const chg = c.change || 0; const up = chg >= 0; const vol = c.volatility || 0; const color = PALETTE[c.code] || '#94A3B8'
          return (
            <button key={c.code} onClick={() => setSelectedCurrency(c.code)}
              className={`group flex items-center gap-2.5 px-3.5 py-2.5 rounded-xl border transition-all ${
                selectedCurrency === c.code ? 'border-cyan/[0.2] bg-cyan/[0.04] glow-xs' : 'border-border hover:border-border-hover'}`}>
              <div className="w-8 h-8 rounded-full flex items-center justify-center shrink-0" style={{ background: `${color}15`, border: `1.5px solid ${color}35` }}>
                <span className="text-[10px] font-display font-extrabold" style={{ color }}>{c.code}</span>
              </div>
              <div className="text-left">
                <p className="font-mono text-[14px] font-bold text-t1 terminal-data">{c.rate.toFixed(4)}</p>
                <div className="flex items-center gap-2">
                  <span className={`text-[10px] font-mono font-bold ${up ? 'text-green' : 'text-red'}`}>{up ? '+' : ''}{chg.toFixed(2)}%</span>
                  {vol > 0 && <span className={`text-[9px] font-mono ${vol > 15 ? 'text-red' : vol > 8 ? 'text-amber' : 'text-t3'}`}>VOL:{vol.toFixed(0)}%</span>}
                </div>
              </div>
              {isAdmin && watchlist.length > 1 && (
                <button onClick={(e) => { e.stopPropagation(); removeCurrency(c.code) }}
                  className="opacity-0 group-hover:opacity-100 p-0.5 rounded hover:bg-red/[0.08] text-t3 hover:text-red transition-all">
                  <X size={10} />
                </button>
              )}
            </button>
          )
        })}
      </div>

      {/* Rate detail + chart */}
      {selected && (
        <div style={{ background: isDark ? '#0b1424' : '#ffffff', border: `1px solid ${isDark ? 'rgba(30,48,80,0.35)' : 'rgba(15,23,42,0.08)'}`, borderRadius: 16, overflow: 'hidden' }}>
          <div className="flex items-start justify-between px-6 pt-5 pb-3">
            <div>
              <div className="flex items-center gap-2">
                <h3 className="font-display text-[18px] font-bold">{ALL_CURRENCIES[selectedCurrency]?.name || selectedCurrency}</h3>
                <span className="text-[12px] font-mono text-t3">USD/{selectedCurrency}</span>
              </div>
              <div className="flex items-center gap-3 mt-1">
                <span className="flex items-center gap-1" style={{ color: isUp ? greenColor : redColor }}>
                  {isUp ? <ArrowUpRight size={14} /> : <ArrowDownRight size={14} />}
                  <span className="text-[13px] font-mono font-bold">{isUp ? '+' : ''}{change.toFixed(3)}% 1d</span>
                </span>
                <span className={`text-[12px] font-mono font-bold ${change7d >= 0 ? 'text-green' : 'text-red'}`}>{change7d >= 0 ? '+' : ''}{change7d.toFixed(2)}% 7d</span>
                {volatility > 0 && <span className={`text-[11px] font-mono px-2 py-0.5 rounded border ${volatility > 15 ? 'text-red border-red/[0.1] bg-red/[0.04]' : volatility > 8 ? 'text-amber border-amber/[0.1] bg-amber/[0.04]' : 'text-green border-green/[0.1] bg-green/[0.04]'}`}>VOL {volatility.toFixed(1)}%</span>}
              </div>
            </div>
            <div className="text-right">
              <p className="font-mono text-[32px] font-black text-t1 tracking-tight leading-none terminal-data">{selected.rate?.toFixed(4)}</p>
              <div className="flex items-center gap-3 mt-1.5 justify-end">
                <span className="text-[11px] text-t3">H <span className="font-mono font-semibold" style={{ color: greenColor }}>{high.toFixed(4)}</span></span>
                <span className="text-[11px] text-t3">L <span className="font-mono font-semibold" style={{ color: redColor }}>{low.toFixed(4)}</span></span>
                <span className="text-[11px] text-t3">Avg <span className="font-mono text-t2 font-semibold">{avg.toFixed(4)}</span></span>
              </div>
            </div>
          </div>
          <div className="px-4 pt-3 pb-2">
            <div className="h-[280px] chart-scanlines">
              {selectedHistory.length > 0 ? (
                <ResponsiveContainer width="100%" height="100%">
                  <AreaChart data={selectedHistory}>
                    <defs><linearGradient id="rateGrad" x1="0" y1="0" x2="0" y2="1"><stop offset="0%" stopColor={isUp?greenColor:redColor} stopOpacity={isDark?0.15:0.18} /><stop offset="100%" stopColor={isUp?greenColor:redColor} stopOpacity={0} /></linearGradient></defs>
                    <CartesianGrid strokeDasharray="1 4" stroke={isDark?'rgba(30,60,100,0.15)':'rgba(0,0,0,0.07)'} vertical={false} />
                    <XAxis dataKey="date" tick={{fontSize:10,fill:isDark?'#475569':'#64748B',fontFamily:'JetBrains Mono'}} tickLine={false} axisLine={false} interval={Math.floor(selectedHistory.length/6)} tickFormatter={v=>new Date(v).toLocaleDateString('en-US',{month:'short',day:'numeric',year:'2-digit'})} />
                    <YAxis tick={{fontSize:10,fill:isDark?'#475569':'#64748B',fontFamily:'JetBrains Mono'}} tickLine={false} axisLine={false} width={54} domain={['auto','auto']} tickFormatter={v=>v.toFixed(3)} />
                    <Tooltip content={<ChartTooltip isDark={isDark} formatLabel={v=>new Date(v).toLocaleDateString('en-US',{weekday:'short',month:'short',day:'numeric',year:'numeric'})} />} />
                    <ReferenceLine y={avg} stroke={isDark?'#506680':'#94A3B8'} strokeDasharray="6 4" strokeWidth={1} label={{value:`AVG ${avg.toFixed(4)}`,position:'right',fontSize:9,fill:isDark?'#506680':'#94A3B8',fontFamily:'JetBrains Mono,monospace'}} />
                    <Area type="monotone" dataKey="rate" name={`USD/${selectedCurrency}`} stroke={isUp?greenColor:redColor} strokeWidth={2.5} fill="url(#rateGrad)" dot={false}
                      activeDot={{r:5,strokeWidth:2.5,stroke:isDark?'#0C1323':'#fff',fill:isUp?greenColor:redColor}} />
                  </AreaChart>
                </ResponsiveContainer>
              ) : (
                <div className="h-full flex items-center justify-center">{fxLoading ? <div className="w-6 h-6 border-2 border-cyan border-t-transparent rounded-full animate-spin" /> : <p className="text-[13px] text-t3 font-mono">{fxError||'No history'}</p>}</div>
              )}
            </div>
          </div>
          <div className="flex items-center justify-between px-6 py-2.5" style={{borderTop:`1px solid ${subtleBorder}`,background:statusBarBg}}>
            <div className="flex items-center gap-4 text-[11px] text-t3">
              <span className="flex items-center gap-1.5">{fxData?<Wifi size={10} className="text-green" />:<WifiOff size={10} className="text-red" />}{fxData?'Live':'Offline'}</span>
              <span>Source: <span className="font-mono text-t2">Frankfurter/ECB</span></span>
              <span>Pts: <span className="font-mono text-t2">{selectedHistory.length}</span></span>
            </div>
            <div className="flex items-center gap-1.5 text-[11px] text-t3"><Clock size={10} /><span className="font-mono tabular-nums">{time.toLocaleTimeString('en-US',{hour12:false})}</span>{lastFetch&&<span className="ml-2">Updated {Math.round((Date.now()-lastFetch.getTime())/60000)}m ago</span>}</div>
          </div>
        </div>
      )}

      {/* Bottom row: Converter + Alerts + Cross-rates */}
      <div className="grid grid-cols-1 md:grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
        {/* Converter */}
        <div className="glass-card rounded-2xl p-5">
          <div className="flex items-center gap-2 mb-4"><Calculator size={14} className="text-cyan" /><span className="terminal-label">CONVERTER</span></div>
          <div className="space-y-3">
            <div>
              <label className="text-[10px] font-mono text-t3 uppercase tracking-wider block mb-1.5">USD AMOUNT</label>
              <input type="number" value={convertAmount} onChange={e => setConvertAmount(parseFloat(e.target.value) || 0)}
                className="w-full px-3 py-2.5 rounded-lg glass-input text-[14px] font-mono text-t1 outline-none focus:border-cyan/40" />
            </div>
            <div className="space-y-1.5">
              {currencies.slice(0, 5).map(c => {
                const sym = ALL_CURRENCIES[c.code]?.symbol || c.code
                const converted = convertAmount * c.rate
                return (
                  <div key={c.code} className="flex items-center justify-between py-1.5 border-b border-border/30 last:border-0">
                    <span className="text-[12px] font-mono text-t2">{c.code}</span>
                    <span className="text-[13px] font-mono font-bold text-t1 terminal-data">{sym}{converted >= 1e6 ? (converted/1e6).toFixed(2)+'M' : converted >= 1e3 ? Math.round(converted).toLocaleString() : converted.toFixed(2)}</span>
                  </div>
                )
              })}
            </div>
          </div>
        </div>

        {/* FX Alerts */}
        <div className="glass-card rounded-2xl p-5">
          <div className="flex items-center gap-2 mb-4"><Bell size={14} className="text-amber" /><span className="terminal-label">FX ALERTS</span></div>
          <div className="space-y-3">
            <div>
              <label className="text-[10px] font-mono text-t3 uppercase tracking-wider block mb-1.5">24H THRESHOLD</label>
              <div className="flex items-center gap-3">
                <input type="range" min="0.5" max="5" step="0.5" value={alertThreshold} onChange={e => setAlertThreshold(parseFloat(e.target.value))} className="flex-1 accent-cyan h-1" />
                <span className="font-mono text-[14px] font-bold text-cyan terminal-data w-10 text-right">{alertThreshold}%</span>
              </div>
            </div>
            <div className="border-t border-border pt-3">
              <p className="text-[10px] font-mono text-t3 uppercase tracking-wider mb-2">TRIGGERED</p>
              {currencies.filter(c => Math.abs(c.change) >= alertThreshold).length > 0 ? (
                currencies.filter(c => Math.abs(c.change) >= alertThreshold).map(c => (
                  <div key={c.code} className="flex items-center justify-between py-1.5">
                    <span className="text-[12px] font-mono font-semibold text-t1">{c.code}</span>
                    <span className="text-[11px] font-mono font-bold" style={{color:c.change>=0?greenColor:redColor}}>{c.change>=0?'+':''}{c.change.toFixed(2)}%</span>
                  </div>
                ))
              ) : <p className="text-[11px] text-t3 font-mono py-2">No alerts triggered</p>}
            </div>
            {/* Volatility ranking */}
            <div className="border-t border-border pt-3">
              <p className="text-[10px] font-mono text-t3 uppercase tracking-wider mb-2">VOLATILITY RANK</p>
              {[...currencies].sort((a, b) => (b.volatility || 0) - (a.volatility || 0)).slice(0, 4).map(c => (
                <div key={c.code} className="flex items-center justify-between py-1">
                  <span className="text-[11px] font-mono text-t2">{c.code}</span>
                  <div className="flex items-center gap-2">
                    <div className="w-16 h-[3px] bg-deep rounded-full overflow-hidden">
                      <div className="h-full rounded-full" style={{ width: `${Math.min(100, (c.volatility || 0) / 20 * 100)}%`, background: (c.volatility||0) > 15 ? redColor : (c.volatility||0) > 8 ? (isDark?'#FBBF24':'#D97706') : greenColor }} />
                    </div>
                    <span className="text-[10px] font-mono text-t3 w-8 text-right">{(c.volatility||0).toFixed(0)}%</span>
                  </div>
                </div>
              ))}
            </div>
          </div>
        </div>

        {/* Cross-rate snapshot */}
        <div className="glass-card rounded-2xl p-5">
          <div className="flex items-center gap-2 mb-4"><Activity size={14} className="text-purple" /><span className="terminal-label">CROSS RATES</span></div>
          <div className="overflow-x-auto">
            <table className="w-full text-[10px] font-mono">
              <thead>
                <tr className="border-b border-border">
                  <th className="text-left py-1.5 text-t3 font-semibold">PAIR</th>
                  <th className="text-right py-1.5 text-t3 font-semibold">RATE</th>
                  <th className="text-right py-1.5 text-t3 font-semibold">1D</th>
                  <th className="text-right py-1.5 text-t3 font-semibold">7D</th>
                </tr>
              </thead>
              <tbody>
                {currencies.map(c => (
                  <tr key={c.code} className="border-b border-border/20 hover:bg-deep transition">
                    <td className="py-1.5 font-semibold text-t1">USD/{c.code}</td>
                    <td className="py-1.5 text-right text-t1 terminal-data">{c.rate.toFixed(4)}</td>
                    <td className="py-1.5 text-right" style={{color:c.change>=0?greenColor:redColor}}>{c.change>=0?'+':''}{c.change.toFixed(2)}%</td>
                    <td className="py-1.5 text-right" style={{color:(c.change7d||0)>=0?greenColor:redColor}}>{(c.change7d||0)>=0?'+':''}{(c.change7d||0).toFixed(2)}%</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      </div>

      {/* Add currency modal */}
      {showAddModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center" onClick={() => setShowAddModal(false)}>
          <div className="absolute inset-0 bg-black/40 backdrop-blur-sm" />
          <div className="relative glass-card rounded-2xl p-6 w-full max-w-md shadow-[0_20px_60px_rgba(0,0,0,0.4)]" onClick={e => e.stopPropagation()}>
            <div className="flex items-center justify-between mb-4">
              <span className="terminal-label">ADD CURRENCY PAIR</span>
              <button onClick={() => setShowAddModal(false)} className="p-1 rounded-lg hover:bg-deep text-t3 hover:text-t1"><X size={16} /></button>
            </div>
            <div className="grid grid-cols-2 lg:grid-cols-4 gap-2 max-h-[300px] overflow-y-auto">
              {availableToAdd.map(code => (
                <button key={code} onClick={() => addCurrency(code)}
                  className="flex flex-col items-center gap-1.5 p-3 rounded-xl border border-border hover:border-cyan/[0.15] hover:bg-cyan/[0.03] transition-all">
                  <div className="w-8 h-8 rounded-full flex items-center justify-center" style={{ background: `${PALETTE[code]||'#94A3B8'}15`, border: `1.5px solid ${PALETTE[code]||'#94A3B8'}35` }}>
                    <span className="text-[9px] font-display font-extrabold" style={{ color: PALETTE[code]||'#94A3B8' }}>{code}</span>
                  </div>
                  <span className="text-[10px] font-mono text-t3">{code}</span>
                </button>
              ))}
            </div>
            <p className="text-[11px] text-t3 font-mono mt-3 text-center">{availableToAdd.length} currencies available</p>
          </div>
        </div>
      )}

      {/* Toast */}
    </div>
  )
}
