import { useTreasury } from '@/hooks/useTreasury'
import { SkeletonPage } from '@/components/Skeleton'
import { supabase } from '@/lib/supabase'
import { safeInvoke } from '@/lib/safeInvoke'
import { useAuth } from '@/hooks/useAuth'
import { isPeriodAllowed, periodRequiredPlan } from '@/lib/planEngine'
import { useToast } from '@/components/Toast'
import { useVisibilityRefetch } from '@/hooks/useVisibilityRefetch'
import { AreaChart, Area, Line, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer, ComposedChart, ReferenceLine, PieChart, Pie, Cell } from 'recharts'
import { useMemo, useState, useEffect, useCallback } from 'react'
import { useChartTheme } from '@/hooks/useChartTheme'
import { ChartTooltip } from '@/components/ChartTooltip'
import { useTheme } from '@/hooks/useTheme'
import { Flame, Clock, Target, BarChart3, TrendingDown, Calendar, Activity, AlertTriangle, Zap, Brain, Trophy, Crosshair, Lock } from 'lucide-react'
import useForecastAccuracy, { classifyAnomaly } from '@/hooks/useForecastAccuracy'

function fmt(n) { const a = Math.abs(n||0); return a >= 1e6 ? '$'+(a/1e6).toFixed(2)+'M' : a >= 1e3 ? '$'+(a/1e3).toFixed(1)+'K' : '$'+a.toFixed(0) }

function CustomDot({ cx, cy, payload, dataKey, isDark }) {
  if (!cx || !cy) return null
  if (payload?._isToday && dataKey === 'actual') return (
    <g>
      <circle cx={cx} cy={cy} r={8} fill={isDark?'rgba(34,211,238,0.1)':'rgba(8,145,178,0.08)'} stroke="none"><animate attributeName="r" from="6" to="14" dur="2s" repeatCount="indefinite" /><animate attributeName="opacity" from="0.6" to="0" dur="2s" repeatCount="indefinite" /></circle>
      <circle cx={cx} cy={cy} r={5} fill={isDark?'#22D3EE':'#0891B2'} stroke={isDark?'#0C1323':'#fff'} strokeWidth={2.5} />
    </g>
  )
  if (payload?._isLastActual && dataKey === 'forecast') return <circle cx={cx} cy={cy} r={4} fill={isDark?'#818CF8':'#6366F1'} stroke={isDark?'#0C1323':'#fff'} strokeWidth={2} />
  return null
}

function calcSMA(data, key, w) { return data.map((_, i) => { if (i < w-1) return null; const s = data.slice(i-w+1,i+1).filter(x=>x[key]!=null); return s.length===w ? s.reduce((a,x)=>a+x[key],0)/w : null }) }
function calcEMA(data, key, span) { const k=2/(span+1); let p=null; return data.map(d => { if(d[key]==null) return p; if(p===null){p=d[key];return p}; p=d[key]*k+p*(1-k); return p }) }

const MODELS = [
  { id:'linear', label:'LINEAR', desc:'Straight-line burn projection', minPlan: 'starter' },
  { id:'ema', label:'EMA', desc:'Exponential moving average trend', minPlan: 'growth' },
  { id:'monte', label:'MONTE CARLO', desc:'500-path stochastic simulation', minPlan: 'growth' },
]
const PLAN_RANK = { starter: 0, growth: 1, enterprise: 2 }

export default function Forecasting() {
  const { forecast, cashPosition, transactions, loading, dailyBalances } = useTreasury()
  const { org } = useAuth()
  const ct = useChartTheme()
  const { isDark } = useTheme()
  const [forecastData, setForecastData] = useState([])
  const [period, setPeriod] = useState('QTD')
  const [showBand, setShowBand] = useState(true)
  const [model, setModel] = useState('linear')
  const [showSMA, setShowSMA] = useState(false)
  const [showEMA, setShowEMA] = useState(false)
  const [hiddenSeries, setHiddenSeries] = useState(new Set())
  const [chartView, setChartView] = useState('forecast') // forecast | burn
  const [generating, setGenerating] = useState(false)
  const toast = useToast()

  async function handleGenerateForecast() {
    setGenerating(true)
    const { data, error } = await safeInvoke('generate-forecast', { days: 90 })
    if (error) {
      toast.error('Failed to generate forecast: ' + error)
    } else {
      toast.success('Forecast generated — 3 models computed')
      fetchForecastData()
    }
    setGenerating(false)
  }

  useEffect(() => { document.title = 'Forecasting — Vaultline' }, [])
  const fetchForecastData = useCallback(() => {
    if(!org?.id) return
    supabase.from('forecasts').select('data,confidence,monthly_burn,runway_months,generated_at').eq('org_id',org.id).order('generated_at',{ascending:false}).limit(1).then(({data})=>{if(data?.[0]?.data) setForecastData(data[0].data)})
  }, [org?.id])
  useEffect(() => { fetchForecastData() }, [fetchForecastData])
  useVisibilityRefetch(fetchForecastData, { pollMs: 60000, enabled: !!org?.id })

  const totalCash = cashPosition?.total_balance || 0
  const monthlyBurn = forecast?.monthly_burn || 0
  const runway = forecast?.runway_months || 0
  const confidence = forecast?.confidence || 0

  const chartData = useMemo(() => {
    if (!dailyBalances.length) return []
    const byDate = {}
    dailyBalances.forEach(b => { byDate[b.date] = (byDate[b.date]||0) + (b.balance||0) })
    const now2 = new Date()
    // Calendar-date cutoff — proper period filtering
    let cutoff
    if (period==='7D') cutoff = new Date(now2.getTime() - 7 * 86400000)
    else if (period==='30D') cutoff = new Date(now2.getTime() - 30 * 86400000)
    else if (period==='MTD') cutoff = new Date(now2.getFullYear(), now2.getMonth(), 1)
    else if (period==='QTD') { const q = Math.floor(now2.getMonth() / 3) * 3; cutoff = new Date(now2.getFullYear(), q, 1) }
    else cutoff = new Date(now2.getFullYear(), 0, 1) // FY
    const cutoffStr = cutoff.toISOString().split('T')[0]
    const sorted = Object.entries(byDate).filter(([date]) => date >= cutoffStr).sort(([a],[b])=>a.localeCompare(b))
    const todayStr2 = new Date().toISOString().split('T')[0]
    const data = sorted.map(([date,total],idx)=>({ date, actual:Math.round(total), forecast:null, upper:null, lower:null, emaForecast:null, monteP50:null, monteP10:null, monteP90:null, _isToday:date===todayStr2, _isLastActual:idx===sorted.length-1 }))
    if (!data.length) return []
    const lastA = data[data.length-1].actual
    data[data.length-1].forecast = lastA; data[data.length-1].upper = lastA; data[data.length-1].lower = lastA
    data[data.length-1].emaForecast = lastA; data[data.length-1].monteP50 = lastA; data[data.length-1].monteP10 = lastA; data[data.length-1].monteP90 = lastA

    const sma7 = calcSMA(data,'actual',7); const ema14 = calcEMA(data,'actual',14)
    data.forEach((d,i) => { d.sma7 = sma7[i]; d.ema14 = ema14[i] })

    const projDays = period==='7D'?3:period==='30D'?7:period==='MTD'?7:period==='QTD'?14:30
    const dailyBurn = monthlyBurn>0?monthlyBurn/30:0
    const actArr = data.filter(d=>d.actual!=null).map(d=>d.actual)
    const dRet = actArr.slice(1).map((v,i)=>v-actArr[i])
    const meanR = dRet.length>0 ? dRet.reduce((s,r)=>s+r,0)/dRet.length : -dailyBurn
    const stdD = dRet.length>2 ? Math.sqrt(dRet.reduce((s,r)=>s+(r-meanR)**2,0)/(dRet.length-1)) : totalCash*0.01
    const emaK = 2/15; let emaPrev = lastA
    const NP = 500; const monteR = Array.from({length:projDays},()=>[])

    const genProjection = (idx, pt) => {
      const emaProj = Math.round(emaPrev + meanR); emaPrev = emaProj*emaK + emaPrev*(1-emaK)
      for(let p=0;p<NP;p++){const prev=idx>0?monteR[idx-1][p]:lastA; monteR[idx].push(Math.max(0,prev+(Math.random()-0.5)*2*stdD*1.5+meanR))}
      const s=[...monteR[idx]].sort((a,b)=>a-b)
      return { emaForecast:Math.max(0,emaProj), monteP50:Math.round(s[Math.floor(NP*0.5)]), monteP10:Math.round(s[Math.floor(NP*0.1)]), monteP90:Math.round(s[Math.floor(NP*0.9)]) }
    }

    if (forecastData.length > 0) {
      forecastData.slice(0,projDays).forEach((pt,idx) => {
        const mc = genProjection(idx, pt)
        data.push({ date:pt.date, actual:null, forecast:Math.round(pt.projected_balance), upper:Math.round(pt.upper_bound), lower:Math.round(pt.lower_bound), ...mc, sma7:null, ema14:null, _isTerminal:idx===Math.min(projDays,forecastData.length)-1 })
      })
    } else if (dailyBurn > 0) {
      const lastDate = new Date(data[data.length-1].date)
      for(let i=1;i<=projDays;i++){
        const d=new Date(lastDate); d.setDate(d.getDate()+i)
        const projected=lastA-(dailyBurn*i); const spread=totalCash*0.018*i
        const mc = genProjection(i-1, null)
        data.push({ date:d.toISOString().split('T')[0], actual:null, forecast:Math.max(0,Math.round(projected)), upper:Math.max(0,Math.round(projected+spread)), lower:Math.max(0,Math.round(projected-spread)), ...mc, sma7:null, ema14:null, _isTerminal:i===projDays })
      }
    }
    // Sort all data chronologically (actuals + forecast combined)
    data.sort((a, b) => a.date.localeCompare(b.date))
    return data
  }, [dailyBalances, forecastData, monthlyBurn, totalCash, period])

  const recentTx = transactions.filter(t=>new Date(t.date)>=new Date(Date.now()-30*86400000))
  const actualBurn = recentTx.filter(t=>t.amount>0).reduce((s,t)=>s+t.amount,0)
  const burnAccuracy = monthlyBurn>0?Math.max(0,100-Math.abs((actualBurn-monthlyBurn)/monthlyBurn*100)):null
  const todayStr = new Date().toISOString().split('T')[0]
  const termPt = chartData[chartData.length-1]
  const bandW = termPt?.upper&&termPt?.lower ? termPt.upper-termPt.lower : 0
  const acts = chartData.filter(d=>d.actual!==null)
  const actTrend = acts.length>1 ? acts[acts.length-1].actual-acts[0].actual : 0
  const actTrendPct = acts.length>1&&acts[0].actual>0 ? ((actTrend/acts[0].actual)*100).toFixed(1) : null
  const cashZeroDate = useMemo(()=>{ if(monthlyBurn<=0||totalCash<=0) return null; const d=new Date(); d.setDate(d.getDate()+Math.ceil(totalCash/(monthlyBurn/30))); return d }, [totalCash,monthlyBurn])

  // Burn decomposition
  const burnBreak = useMemo(()=>{
    const cats={}; recentTx.filter(t=>t.amount>0).forEach(t=>{const c=t.category||'other'; cats[c]=(cats[c]||0)+t.amount})
    const colors={payroll:'#818CF8',vendor:'#FBBF24',saas:'#A78BFA',tax:'#FB7185',operations:'#94A3B8',other:'#64748B'}
    return Object.entries(cats).sort((a,b)=>b[1]-a[1]).slice(0,6).map(([cat,total])=>({cat:cat.charAt(0).toUpperCase()+cat.slice(1),total:Math.round(total),color:colors[cat]||'#64748B',pct:monthlyBurn>0?(total/monthlyBurn*100):0}))
  },[recentTx,monthlyBurn])

  const toggleSeries = (key) => setHiddenSeries(prev => { const n = new Set(prev); n.has(key) ? n.delete(key) : n.add(key); return n })

  // High / Low / Avg for actuals
  const actuals = chartData.filter(d => d.actual != null).map(d => d.actual)
  const highVal = actuals.length > 0 ? Math.max(...actuals) : 0
  const lowVal = actuals.length > 0 ? Math.min(...actuals) : 0
  const avgVal = actuals.length > 0 ? actuals.reduce((s, v) => s + v, 0) / actuals.length : 0

  // Burn donut data
  const burnDonut = burnBreak.map(b => ({ name: b.cat, value: b.total, color: b.color }))

  // ── ANOMALY DETECTION ENGINE ──
  const anomalies = useMemo(() => {
    if (!chartData.length) return []
    const actPts = chartData.filter(d => d.actual != null)
    if (actPts.length < 7) return []
    
    // Z-score anomaly detection on daily balance changes
    const changes = actPts.slice(1).map((d, i) => ({
      date: d.date,
      actual: d.actual,
      prev: actPts[i].actual,
      delta: d.actual - actPts[i].actual,
      pctChange: actPts[i].actual > 0 ? ((d.actual - actPts[i].actual) / actPts[i].actual) * 100 : 0,
    }))
    
    const deltas = changes.map(c => c.delta)
    const mean = deltas.reduce((s, d) => s + d, 0) / deltas.length
    const std = Math.sqrt(deltas.reduce((s, d) => s + (d - mean) ** 2, 0) / (deltas.length - 1))
    if (std === 0) return []
    
    const detected = []
    const THRESHOLD = 2.0 // z-score threshold

    changes.forEach(c => {
      const z = (c.delta - mean) / std
      if (Math.abs(z) >= THRESHOLD) {
        const severity = Math.abs(z) >= 3 ? 'critical' : 'warning'
        const direction = c.delta > 0 ? 'spike' : 'drop'
        detected.push({
          date: c.date,
          actual: c.actual,
          delta: c.delta,
          pctChange: c.pctChange,
          zScore: z,
          severity,
          direction,
          label: `${direction === 'spike' ? 'Unusual inflow' : 'Unusual outflow'}: ${fmt(Math.abs(c.delta))} (${c.pctChange > 0 ? '+' : ''}${c.pctChange.toFixed(1)}%)`,
        })
      }
    })

    // Pattern detection: consecutive declining days
    let streak = 0
    for (let i = changes.length - 1; i >= 0; i--) {
      if (changes[i].delta < 0) streak++
      else break
    }
    if (streak >= 5) {
      detected.push({
        date: changes[changes.length - 1].date,
        actual: changes[changes.length - 1].actual,
        delta: 0,
        pctChange: 0,
        zScore: 0,
        severity: 'warning',
        direction: 'pattern',
        label: `${streak}-day consecutive decline detected`,
      })
    }

    // Volatility spike detection (rolling 7-day std vs historical)
    if (actPts.length >= 14) {
      const recent7 = actPts.slice(-7).map(d => d.actual)
      const prior7 = actPts.slice(-14, -7).map(d => d.actual)
      const recentStd = Math.sqrt(recent7.reduce((s, v) => s + (v - recent7.reduce((a, b) => a + b, 0) / 7) ** 2, 0) / 6)
      const priorStd = Math.sqrt(prior7.reduce((s, v) => s + (v - prior7.reduce((a, b) => a + b, 0) / 7) ** 2, 0) / 6)
      if (priorStd > 0 && recentStd / priorStd > 2.5) {
        detected.push({
          date: actPts[actPts.length - 1].date,
          actual: actPts[actPts.length - 1].actual,
          delta: 0,
          pctChange: 0,
          zScore: 0,
          severity: 'warning',
          direction: 'volatility',
          label: `Cash volatility ${(recentStd / priorStd).toFixed(1)}x above baseline`,
        })
      }
    }

    return detected.slice(0, 5) // cap at 5 most relevant
  }, [chartData])

  // Mark anomalies on chart data
  const chartDataWithAnomalies = useMemo(() => {
    const anomalyDates = new Set(anomalies.map(a => a.date))
    return chartData.map(d => ({ ...d, _isAnomaly: anomalyDates.has(d.date) }))
  }, [chartData, anomalies])

  // ── FORECAST ACCURACY ENGINE ──
  const accuracy = useForecastAccuracy(chartData, monthlyBurn, totalCash)

  // ── ANOMALY CLASSIFICATION ──
  const classifiedAnomalies = useMemo(() => {
    return anomalies.map(a => ({
      ...a,
      classification: classifyAnomaly(a, transactions, anomalies),
    }))
  }, [anomalies, transactions])

  // Auto-switch to recommended model when accuracy data first loads
  const [autoSwitched, setAutoSwitched] = useState(false)
  useEffect(() => {
    if (accuracy.ready && accuracy.recommended && !autoSwitched) {
      // Don't force-switch, but highlight recommendation
      setAutoSwitched(true)
    }
  }, [accuracy.ready])

  if (loading) return <SkeletonPage />

  const forecastKey = model==='ema'?'emaForecast':model==='monte'?'monteP50':'forecast'
  const forecastLabel = model==='ema'?'EMA Forecast':model==='monte'?'Monte Carlo P50':'Linear Forecast'
  const forecastColor = model==='monte'?(isDark?'#34D399':'#059669'):ct.line.secondary

  const kpis = [
    { icon:Flame, label:'BURN RATE', value:monthlyBurn>0?`${fmt(monthlyBurn)}/mo`:'—', color:'red', sub:burnAccuracy?`${burnAccuracy.toFixed(0)}% accuracy`:'No data' },
    { icon:Clock, label:'RUNWAY', value:runway>0?`${runway.toFixed(1)} mo`:'—', color:runway>12?'green':runway>6?'amber':'red', sub:cashZeroDate?`Zero: ${cashZeroDate.toLocaleDateString('en-US',{month:'short',year:'numeric'})}`:'Stable' },
    { icon:Target, label:'CONFIDENCE', value:confidence>0?`${(confidence*100).toFixed(0)}%`:'—', color:confidence>0.85?'green':'amber', sub:confidence>0?`Band: ±${fmt(bandW/2)}`:'No model' },
    { icon:Activity, label:'TREND', value:actTrendPct?`${actTrendPct>0?'+':''}${actTrendPct}%`:'—', color:actTrend>=0?'green':'red', sub:`${period} actual` },
  ]

  return (
    <div className="space-y-5">
      {/* KPIs */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-3">
        {kpis.map(k => {
          const cm = {cyan:'bg-cyan/[0.08] text-cyan',green:'bg-green/[0.08] text-green',red:'bg-red/[0.08] text-red',amber:'bg-amber/[0.08] text-amber'}
          return (<div key={k.label} className="glass-card rounded-xl p-4 terminal-scanlines relative hover:border-border-hover transition-all"><div className="relative z-[2]">
            <div className="flex items-center justify-between mb-2"><div className={`w-8 h-8 rounded-lg flex items-center justify-center ${cm[k.color]}`}><k.icon size={15} /></div><span className="text-[9px] font-mono text-t3 uppercase tracking-wider">{k.label}</span></div>
            <p className="font-mono text-[22px] font-black text-t1 terminal-data tracking-tight">{k.value}</p>
            <p className="text-[11px] text-t3 font-mono mt-1">{k.sub}</p>
          </div></div>)
        })}
      </div>

      {/* ── ANOMALY ALERTS ── */}
      {classifiedAnomalies.length > 0 && (
        <div className="glass-card rounded-2xl overflow-hidden border-amber/[0.15] hover:border-amber/[0.25] transition-colors">
          <div className="px-5 pt-4 pb-1 flex items-center justify-between">
            <div className="flex items-center gap-2">
              <div className="w-7 h-7 rounded-lg flex items-center justify-center bg-amber/[0.08]">
                <Brain size={14} className="text-amber" />
              </div>
              <span className="terminal-label text-amber">ANOMALY DETECTION</span>
              <span className="text-[10px] font-mono text-t3 ml-1">{classifiedAnomalies.length} signal{classifiedAnomalies.length !== 1 ? 's' : ''}</span>
            </div>
            <span className="text-[9px] font-mono text-t4 uppercase tracking-wider">Z-SCORE &bull; PATTERN &bull; CLASSIFICATION</span>
          </div>
          <div className="px-5 pb-4 pt-2 space-y-2">
            {classifiedAnomalies.map((a, i) => {
              const cls = a.classification
              const clsColors = { purple: 'text-purple bg-purple/[0.06] border-purple/[0.08]', green: 'text-green bg-green/[0.06] border-green/[0.08]', blue: 'text-blue-400 bg-blue-400/[0.06] border-blue-400/[0.08]', cyan: 'text-cyan bg-cyan/[0.06] border-cyan/[0.08]', amber: 'text-amber bg-amber/[0.06] border-amber/[0.08]', red: 'text-red bg-red/[0.06] border-red/[0.08]', gray: 'text-t3 bg-deep border-border' }
              return (
                <div key={i} className={`flex items-start gap-3 p-3 rounded-xl border transition-all ${
                  a.severity === 'critical' ? 'bg-red/[0.04] border-red/[0.12]' : 'bg-amber/[0.04] border-amber/[0.08]'
                }`}>
                  <AlertTriangle size={14} className={`mt-0.5 flex-shrink-0 ${a.severity === 'critical' ? 'text-red' : 'text-amber'}`} />
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-2 flex-wrap">
                      <span className={`text-[10px] font-mono font-bold uppercase tracking-wider ${a.severity === 'critical' ? 'text-red' : 'text-amber'}`}>
                        {a.severity === 'critical' ? 'CRITICAL' : 'WARNING'}
                      </span>
                      <span className={`text-[9px] font-mono font-bold px-1.5 py-0.5 rounded border ${clsColors[cls.color] || clsColors.gray}`}>
                        {cls.label}
                      </span>
                      <span className="text-[10px] font-mono text-t4">
                        {new Date(a.date+'T00:00').toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: '2-digit' })}
                      </span>
                      {a.zScore !== 0 && <span className="text-[9px] font-mono text-t4 bg-deep px-1.5 py-0.5 rounded">z={Math.abs(a.zScore).toFixed(1)}</span>}
                      <span className="text-[9px] font-mono text-t4 bg-deep px-1.5 py-0.5 rounded">{cls.confidence}% conf</span>
                    </div>
                    <p className="text-[12px] text-t2 mt-0.5 leading-relaxed">{a.label}</p>
                  </div>
                  {a.direction === 'spike' && <Zap size={12} className="text-green mt-1 flex-shrink-0" />}
                  {a.direction === 'drop' && <TrendingDown size={12} className="text-red mt-1 flex-shrink-0" />}
                </div>
              )
            })}
          </div>
        </div>
      )}

      {/* ── MODEL ACCURACY PANEL ── */}
      {accuracy.ready && accuracy.scored && (
        <div className="glass-card rounded-2xl overflow-hidden hover:border-border-hover transition-colors">
          <div className="px-5 pt-4 pb-2 flex items-center justify-between">
            <div className="flex items-center gap-2">
              <div className="w-7 h-7 rounded-lg flex items-center justify-center bg-cyan/[0.08]">
                <Crosshair size={14} className="text-cyan" />
              </div>
              <span className="terminal-label">MODEL ACCURACY</span>
              <span className="text-[10px] font-mono text-t3 ml-1">{accuracy.dataPoints} pts backtested</span>
            </div>
            {accuracy.recommended && (() => {
              const recLocked = PLAN_RANK[org?.plan || 'starter'] < PLAN_RANK[MODELS.find(m => m.id === accuracy.recommended.id)?.minPlan || 'starter']
              return (
              <div className="flex items-center gap-1.5">
                <Trophy size={12} className="text-green" />
                <span className="text-[10px] font-mono font-bold text-green">BEST: {accuracy.recommended.label.toUpperCase()}</span>
                {model !== accuracy.recommended.id && !recLocked && (
                  <button onClick={() => setModel(accuracy.recommended.id)}
                    className="ml-2 text-[10px] font-mono font-bold text-cyan bg-cyan/[0.06] border border-cyan/[0.1] px-2 py-0.5 rounded hover:bg-cyan/[0.1] transition-all">
                    Switch
                  </button>
                )}
                {recLocked && (
                  <span className="ml-2 text-[10px] font-mono text-t4 flex items-center gap-1"><Lock size={8} /> Growth plan</span>
                )}
              </div>
            )})()}
          </div>
          <div className="px-5 pb-4 grid grid-cols-1 md:grid-cols-3 gap-3">
            {accuracy.scored.map((m, i) => {
              const isActive = model === m.id
              const isBest = i === 0
              const metrics = m.metrics
              if (!metrics) return null
              const cardLocked = PLAN_RANK[org?.plan || 'starter'] < PLAN_RANK[MODELS.find(md => md.id === m.id)?.minPlan || 'starter']
              return (
                <button key={m.id} onClick={() => { if (!cardLocked) setModel(m.id) }}
                  className={`p-3.5 rounded-xl text-left transition-all border ${
                    cardLocked ? 'bg-deep/30 border-border/20 opacity-50 cursor-not-allowed' :
                    isActive ? 'bg-cyan/[0.04] border-cyan/[0.12]' : 'bg-deep/50 border-border/30 hover:border-border'
                  }`}>
                  <div className="flex items-center justify-between mb-2">
                    <div className="flex items-center gap-2">
                      {cardLocked && <Lock size={10} className="text-t4" />}
                      <span className={`text-[12px] font-mono font-bold ${cardLocked ? 'text-t4' : isActive ? 'text-cyan' : 'text-t2'}`}>{m.label}</span>
                      {isBest && !cardLocked && <Trophy size={10} className="text-green" />}
                    </div>
                    <span className={`text-[10px] font-mono font-bold px-1.5 py-0.5 rounded ${
                      metrics.mape < 5 ? 'text-green bg-green/[0.06]' : metrics.mape < 15 ? 'text-amber bg-amber/[0.06]' : 'text-red bg-red/[0.06]'
                    }`}>
                      {metrics.mape.toFixed(1)}% MAPE
                    </span>
                  </div>
                  <div className="space-y-1">
                    <div className="flex justify-between text-[10px] font-mono">
                      <span className="text-t4">MAE</span>
                      <span className="text-t2">{fmt(metrics.mae)}</span>
                    </div>
                    <div className="flex justify-between text-[10px] font-mono">
                      <span className="text-t4">Direction</span>
                      <span className={metrics.directionalAccuracy > 60 ? 'text-green' : metrics.directionalAccuracy > 50 ? 'text-amber' : 'text-red'}>
                        {metrics.directionalAccuracy?.toFixed(0) || '—'}%
                      </span>
                    </div>
                    <div className="flex justify-between text-[10px] font-mono">
                      <span className="text-t4">Bias</span>
                      <span className={metrics.bias > 0 ? 'text-amber' : 'text-cyan'}>
                        {metrics.bias > 0 ? '+' : ''}{fmt(metrics.bias)}
                      </span>
                    </div>
                  </div>
                  {/* Accuracy bar */}
                  <div className="mt-2 h-[3px] rounded-full bg-border/20 overflow-hidden">
                    <div className={`h-full rounded-full transition-all ${
                      metrics.mape < 5 ? 'bg-green' : metrics.mape < 15 ? 'bg-amber' : 'bg-red'
                    }`} style={{ width: `${Math.max(5, 100 - metrics.mape)}%` }} />
                  </div>
                </button>
              )
            })}
          </div>
          {/* Seasonality + Adaptive Confidence row */}
          <div className="px-5 pb-4 flex items-center gap-4 text-[10px] font-mono text-t4 border-t border-border/20 pt-3">
            {accuracy.seasonality?.hasSeasonality && (
              <span>DAY EFFECT: <span className="text-cyan">{accuracy.seasonality.strongestDay.dayName} strongest</span> ({accuracy.seasonality.strongestDay.mean > 0 ? '+' : ''}{fmt(accuracy.seasonality.strongestDay.mean)}/day)</span>
            )}
            {accuracy.adaptiveConfidence?.calibratedConfidence != null && (
              <span>CALIBRATED CONF: <span className={accuracy.adaptiveConfidence.calibratedConfidence > 80 ? 'text-green' : accuracy.adaptiveConfidence.calibratedConfidence > 60 ? 'text-amber' : 'text-red'}>
                {accuracy.adaptiveConfidence.calibratedConfidence}%
              </span></span>
            )}
            {accuracy.adaptiveConfidence && (
              <span>95% BAND: <span className="text-t2">±{fmt(accuracy.adaptiveConfidence.bandWidth95)}</span></span>
            )}
          </div>
        </div>
      )}

      {/* Main chart */}
      <div className="glass-card rounded-2xl overflow-hidden terminal-scanlines relative hover:border-border-hover transition-colors">
        <div className="relative z-[2]">
          <div className="flex items-center justify-between px-5 pt-5 pb-2">
            <div className="flex items-center gap-3"><span className="terminal-label">FORECAST</span><span className="text-[11px] font-mono text-t3">{chartDataWithAnomalies.length} pts</span>{anomalies.length > 0 && <span className="text-[10px] font-mono text-amber bg-amber/[0.06] border border-amber/[0.08] px-2 py-0.5 rounded">{anomalies.length} anomal{anomalies.length !== 1 ? 'ies' : 'y'}</span>}
              <button onClick={handleGenerateForecast} disabled={generating} className="px-2.5 py-1 rounded-md text-[10px] font-mono font-bold transition-all bg-cyan/[0.08] text-cyan border border-cyan/[0.12] hover:bg-cyan/[0.14] disabled:opacity-50 flex items-center gap-1.5">
                {generating ? <><span className="w-3 h-3 border-2 border-cyan border-t-transparent rounded-full animate-spin" /> Running...</> : <><Zap size={10} /> Generate</>}
              </button>
            </div>
            <div className="flex items-center gap-1.5 flex-wrap">
              {MODELS.map(m => { const locked = PLAN_RANK[org?.plan || 'starter'] < PLAN_RANK[m.minPlan]; return (<button key={m.id} onClick={()=>{ if (!locked) setModel(m.id) }} title={locked ? `Requires ${m.minPlan} plan` : m.desc} className={`px-2.5 py-1 rounded-md text-[10px] font-mono font-bold transition-all flex items-center gap-1 ${locked ? 'text-t4 border border-transparent cursor-not-allowed opacity-50' : model===m.id?'bg-cyan/[0.08] text-cyan border border-cyan/[0.12]':'text-t3 hover:text-t2 border border-transparent'}`}>{locked && <Lock size={8} />}{m.label}{!locked && accuracy.recommended?.id===m.id && <Trophy size={8} className="text-green" />}</button>)})}
              <div className="w-px h-4 bg-border mx-0.5" />
              <button onClick={()=>setShowSMA(!showSMA)} className={`px-2 py-1 rounded-md text-[10px] font-mono font-bold transition-all ${showSMA?'bg-green/[0.08] text-green border border-green/[0.12]':'text-t3 border border-transparent hover:text-t2'}`}>SMA7</button>
              <button onClick={()=>setShowEMA(!showEMA)} className={`px-2 py-1 rounded-md text-[10px] font-mono font-bold transition-all ${showEMA?'bg-amber/[0.08] text-amber border border-amber/[0.12]':'text-t3 border border-transparent hover:text-t2'}`}>EMA14</button>
              <button onClick={()=>setShowBand(!showBand)} className={`px-2 py-1 rounded-md text-[10px] font-mono font-bold transition-all ${showBand?'bg-purple/[0.08] text-purple border border-purple/[0.12]':'text-t3 border border-transparent hover:text-t2'}`}>{model==='monte'?'P10-P90':'CI BAND'}</button>
              <div className="w-px h-4 bg-border mx-0.5" />
              <div className="flex items-center gap-1 p-0.5 rounded-lg bg-deep border border-border">
                {['forecast','burn'].map(v => (<button key={v} onClick={()=>setChartView(v)} className={`px-2.5 py-1 rounded-md text-[10px] font-mono font-bold transition-all ${chartView===v?'bg-cyan/[0.08] text-cyan border border-cyan/[0.12]':'text-t3 hover:text-t2 border border-transparent'}`}>{v==='forecast'?'FORECAST':'BURN'}</button>))}
              </div>
              <div className="w-px h-4 bg-border mx-0.5" />
              <div className="flex items-center gap-1 p-0.5 rounded-lg bg-deep border border-border">
                {['7D','30D','MTD','QTD','FY'].map(r => { const allowed = isPeriodAllowed(org?.plan||'starter', r); return (<button key={r} onClick={()=>allowed?setPeriod(r):null} title={!allowed?`Upgrade to ${periodRequiredPlan(r)} for ${r}`:''} className={`px-2.5 py-1 rounded-md text-[10px] font-mono font-bold transition-all ${period===r?'bg-cyan/[0.08] text-cyan border border-cyan/[0.12]':allowed?'text-t3 hover:text-t2':'text-t4/30 cursor-not-allowed line-through decoration-t4/20'}`}>{r}</button>)})}
              </div>
            </div>
          </div>
          {/* Interactive legend — click to toggle series */}
          <div className="flex items-center gap-2 px-5 pb-2 text-[10px] font-mono flex-wrap">
            {[
              { key:'actual', label:'ACTUAL', color:ct.line.primary, show:true },
              { key:'forecast', label:forecastLabel.toUpperCase(), color:forecastColor, show:true, dashed:true },
              ...(showSMA ? [{ key:'sma7', label:'SMA7', color:isDark?'#34D399':'#059669', show:true }] : []),
              ...(showEMA ? [{ key:'ema14', label:'EMA14', color:isDark?'#FBBF24':'#D97706', show:true }] : []),
              ...(showBand ? [{ key:'band', label:model==='monte'?'P10-P90':'CONF', color:ct.area?.band || forecastColor, show:true, area:true }] : []),
            ].map(s => {
              const hidden = hiddenSeries.has(s.key)
              return (
                <button key={s.key} onClick={() => toggleSeries(s.key)} className={`flex items-center gap-1.5 px-2 py-1 rounded-md transition-all border ${hidden ? 'opacity-30 border-transparent' : 'border-border'}`}>
                  {s.area ? <span className="w-3 h-2.5 rounded-sm" style={{ background: hidden ? '#475569' : s.color, opacity: 0.4 }} /> :
                   s.dashed ? <span className="w-4 h-[2px] rounded-full border-t-2 border-dashed" style={{ borderColor: hidden ? '#475569' : s.color }} /> :
                   <span className="w-4 h-[2.5px] rounded-full" style={{ background: hidden ? '#475569' : s.color }} />}
                  <span style={{ color: hidden ? '#475569' : s.color }}>{s.label}</span>
                </button>
              )
            })}
            {actuals.length > 2 && (
              <span className="ml-auto flex items-center gap-3 text-t3">
                <span>H: <span className="text-green terminal-data">{fmt(highVal)}</span></span>
                <span>L: <span className="text-red terminal-data">{fmt(lowVal)}</span></span>
                <span>AVG: <span className="text-cyan terminal-data">{fmt(avgVal)}</span></span>
              </span>
            )}
          </div>
          {/* Chart area */}
          <div className="h-[400px] px-3 pb-2">
            {chartView === 'burn' && burnDonut.length > 0 ? (
              <div className="flex items-center h-full gap-8 px-4">
                <div className="w-[280px] h-[280px]">
                  <ResponsiveContainer width="100%" height="100%">
                    <PieChart>
                      <Pie data={burnDonut} cx="50%" cy="50%" innerRadius={65} outerRadius={115} paddingAngle={3} dataKey="value">
                        {burnDonut.map((d, i) => <Cell key={i} fill={d.color} stroke="none" />)}
                      </Pie>
                      <Tooltip content={<ChartTooltip isDark={isDark} />} />
                    </PieChart>
                  </ResponsiveContainer>
                </div>
                <div className="flex-1 flex flex-col gap-2">
                  {burnBreak.map(b => (
                    <div key={b.cat} className="flex items-center justify-between px-4 py-2.5 rounded-xl" style={{ background: isDark ? 'rgba(255,255,255,0.03)' : 'rgba(0,0,0,0.02)', border: `1px solid ${b.color}20` }}>
                      <div className="flex items-center gap-3">
                        <div className="w-2.5 h-2.5 rounded-full" style={{ background: b.color }} />
                        <span className="text-[13px] font-semibold">{b.cat}</span>
                      </div>
                      <div className="flex items-center gap-3">
                        <span className="text-[14px] font-mono font-bold terminal-data">{fmt(b.total)}</span>
                        <span className="text-[10px] font-mono text-t3 w-10 text-right">{b.pct.toFixed(0)}%</span>
                      </div>
                    </div>
                  ))}
                  <div className="flex items-center justify-between px-4 py-2.5 rounded-xl mt-1" style={{ background: isDark ? 'rgba(251,113,133,0.06)' : 'rgba(225,29,72,0.04)', border: isDark ? '1px solid rgba(251,113,133,0.12)' : '1px solid rgba(225,29,72,0.1)' }}>
                    <span className="text-[12px] font-mono font-bold text-red">TOTAL BURN</span>
                    <span className="text-[16px] font-mono font-black text-red terminal-data">{fmt(monthlyBurn)}/mo</span>
                  </div>
                </div>
              </div>
            ) : chartDataWithAnomalies.length>0 ? (
              <ResponsiveContainer width="100%" height="100%">
                <ComposedChart data={chartDataWithAnomalies}>
                  <defs>
                    <linearGradient id="fvaActGrad" x1="0" y1="0" x2="0" y2="1"><stop offset="0%" stopColor={ct.line.primary} stopOpacity={isDark?0.12:0.15} /><stop offset="100%" stopColor={ct.line.primary} stopOpacity={0} /></linearGradient>
                    <linearGradient id="fvaBandGrad" x1="0" y1="0" x2="0" y2="1"><stop offset="0%" stopColor={forecastColor} stopOpacity={isDark?0.08:0.12} /><stop offset="100%" stopColor={forecastColor} stopOpacity={isDark?0.02:0.04} /></linearGradient>
                  </defs>
                  <CartesianGrid strokeDasharray="1 6" stroke={ct.grid} vertical={false} />
                  <XAxis dataKey="date" tick={{fontSize:10,fill:ct.tick,fontFamily:'JetBrains Mono,monospace'}} tickLine={false} axisLine={false} interval={Math.max(0,Math.floor(chartDataWithAnomalies.length/8))} tickFormatter={v=>new Date(v+'T00:00').toLocaleDateString('en-US',{month:'short',day:'numeric',year:'2-digit'})} />
                  <YAxis domain={['auto', 'auto']} tick={{fontSize:10,fill:ct.tick,fontFamily:'JetBrains Mono,monospace'}} tickLine={false} axisLine={false} width={65} tickFormatter={v=>v>=1e6?`$${(v/1e6).toFixed(1)}M`:`$${(v/1e3).toFixed(0)}K`} />
                  <Tooltip content={<ChartTooltip isDark={isDark} formatLabel={v=>new Date(v).toLocaleDateString('en-US',{weekday:'short',month:'short',day:'numeric',year:'numeric'})} />} cursor={{stroke:isDark?'rgba(34,211,238,0.12)':'rgba(8,145,178,0.08)',strokeWidth:1}} />
                  <ReferenceLine x={todayStr} stroke={isDark?'#22D3EE':'#0891B2'} strokeDasharray="4 4" strokeWidth={1} label={{value:'TODAY',position:'top',fontSize:9,fontWeight:700,fill:isDark?'#22D3EE':'#0891B2',fontFamily:'JetBrains Mono,monospace'}} />
                  {anomalies.filter(a=>a.zScore!==0).map((a,i) => <ReferenceLine key={`anom-${i}`} x={a.date} stroke={a.severity==='critical'?(isDark?'#F87171':'#EF4444'):(isDark?'#FBBF24':'#D97706')} strokeDasharray="1 6" strokeWidth={1} label={{value:'\u26A0',position:'top',fontSize:10}} />)}
                  {avgVal > 0 && <ReferenceLine y={Math.round(avgVal)} stroke={isDark?'rgba(148,163,184,0.25)':'rgba(100,116,139,0.2)'} strokeDasharray="6 4" label={{value:'AVG',position:'right',fontSize:9,fill:ct.tick,fontFamily:'JetBrains Mono'}} />}
                  {showBand && !hiddenSeries.has('band') && <><Area type="monotone" dataKey={model==='monte'?'monteP90':'upper'} name={model==='monte'?'P90':'Upper'} stroke="none" fill="url(#fvaBandGrad)" /><Area type="monotone" dataKey={model==='monte'?'monteP10':'lower'} name={model==='monte'?'P10':'Lower'} stroke="none" fill={isDark?'#0C1323':'#FFFFFF'} /></>}
                  {showSMA && !hiddenSeries.has('sma7') && <Line type="monotone" dataKey="sma7" name="SMA 7d" stroke={isDark?'#34D399':'#059669'} strokeWidth={1.5} dot={false} connectNulls />}
                  {showEMA && !hiddenSeries.has('ema14') && <Line type="monotone" dataKey="ema14" name="EMA 14d" stroke={isDark?'#FBBF24':'#D97706'} strokeWidth={1.5} dot={false} connectNulls />}
                  {!hiddenSeries.has('actual') && <Area type="monotone" dataKey="actual" name="Actual" stroke="none" fill="url(#fvaActGrad)" connectNulls={false} />}
                  {!hiddenSeries.has('actual') && <Line type="monotone" dataKey="actual" name="Actual" stroke={ct.line.primary} strokeWidth={2.5} connectNulls={false} dot={<CustomDot isDark={isDark} />} activeDot={{r:5,strokeWidth:2,stroke:isDark?'#0C1323':'#fff',fill:ct.line.primary}} />}
                  {!hiddenSeries.has('forecast') && <Line type="monotone" dataKey={forecastKey} name={forecastLabel} stroke={forecastColor} strokeWidth={2} strokeDasharray="6 4" connectNulls={false} dot={<CustomDot isDark={isDark} />} activeDot={{r:5,strokeWidth:2,stroke:isDark?'#0C1323':'#fff',fill:forecastColor}} />}
                </ComposedChart>
              </ResponsiveContainer>
            ) : (
              <div className="h-full flex flex-col items-center justify-center"><div className="w-14 h-14 rounded-2xl bg-cyan/[0.06] flex items-center justify-center mb-4"><BarChart3 size={24} className="text-t3" /></div><p className="text-[15px] text-t2 font-medium">Forecast model building</p><p className="text-[13px] text-t3 mt-1">Sync bank accounts to generate predictions</p></div>
            )}
          </div>
          {chartDataWithAnomalies.length>0 && (
            <div className="terminal-status flex items-center justify-between px-6 py-1.5">
              <div className="flex items-center gap-5 text-t3"><span className="terminal-live">LIVE</span><span>PTS: <span className="text-t2">{chartDataWithAnomalies.length}</span></span><span>VIEW: <span className="text-cyan">{chartView==='burn'?'BURN':'FORECAST'}</span></span><span>MODEL: <span className="text-cyan">{MODELS.find(m=>m.id===model)?.label}</span></span>{accuracy.ready&&accuracy.models[model]?.metrics&&<span>MAPE: <span className={accuracy.models[model].metrics.mape<5?'text-green':accuracy.models[model].metrics.mape<15?'text-amber':'text-red'}>{accuracy.models[model].metrics.mape.toFixed(1)}%</span></span>}{classifiedAnomalies.length>0&&<span>ALERTS: <span className="text-amber">{classifiedAnomalies.length}</span></span>}<span>CONF: <span className="text-green terminal-data">{accuracy.adaptiveConfidence?.calibratedConfidence!=null?`${accuracy.adaptiveConfidence.calibratedConfidence}%`:confidence>0?`${(confidence*100).toFixed(0)}%`:'—'}</span></span></div>
              <div className="flex items-center gap-4 text-t3">{showSMA&&!hiddenSeries.has('sma7')&&<span className="text-green">SMA7</span>}{showEMA&&!hiddenSeries.has('ema14')&&<span className="text-amber">EMA14</span>}<span>BAND: <span className="text-t2 terminal-data">±{fmt(bandW/2)}</span></span><span>PERIOD: <span className="text-cyan">{period}</span></span></div>
            </div>
          )}
        </div>
      </div>

      {/* Bottom: Outlook + Burn */}
      <div className="grid grid-cols-[1fr_320px] gap-4">
        <div className="grid grid-cols-1 md:grid-cols-3 gap-3">
          {[{label:'7-Day',idx:6,icon:Calendar},{label:'14-Day',idx:13,icon:TrendingDown},{label:'30-Day',idx:29,icon:Target}].map(o=>{
            const proj=chartData.filter(d=>d.actual==null); const pt=proj[Math.min(o.idx,proj.length-1)]
            if(!pt) return null; const projected=pt[forecastKey]||pt.forecast||0; const diff=projected-totalCash; const pct=totalCash>0?((diff/totalCash)*100):0; const neg=diff<0
            return (<div key={o.label} className="glass-card rounded-xl p-4 terminal-scanlines relative hover:border-border-hover transition-all"><div className="relative z-[2]">
              <div className="flex items-center justify-between mb-2"><div className="flex items-center gap-2"><o.icon size={13} className="text-t3" /><span className="text-[12px] font-semibold text-t2">{o.label}</span></div><span className="text-[9px] font-mono text-t3">{MODELS.find(m=>m.id===model)?.label}</span></div>
              <p className="font-mono text-[20px] font-black text-t1 terminal-data tracking-tight">{fmt(projected)}</p>
              <span className={`text-[12px] font-mono font-bold terminal-data mt-1 inline-block ${neg?'text-red':'text-green'}`}>{neg?'':'+'}{pct.toFixed(1)}%</span>
              <div className="mt-2 h-[3px] bg-deep rounded-full overflow-hidden"><div className="h-full rounded-full transition-all duration-700" style={{width:`${Math.max(5,100-Math.abs(pct))}%`,background:neg?(isDark?'#FB7185':'#E11D48'):(isDark?'#34D399':'#059669')}} /></div>
            </div></div>)
          })}
        </div>
        <div className="glass-card rounded-xl p-4 terminal-scanlines relative"><div className="relative z-[2]">
          <div className="flex items-center justify-between mb-3"><div className="flex items-center gap-2"><Flame size={13} className="text-red" /><span className="terminal-label">BURN BREAKDOWN</span></div><span className="text-[10px] font-mono text-t3">{fmt(monthlyBurn)}/mo</span></div>
          {burnBreak.length>0 ? (<div className="space-y-2">{burnBreak.map(b=>(<div key={b.cat} className="flex items-center gap-2.5"><span className="w-2 h-2 rounded-sm shrink-0" style={{background:b.color}} /><span className="text-[11px] text-t2 flex-1 truncate font-mono">{b.cat}</span><span className="text-[11px] font-mono font-bold text-t1 terminal-data">{fmt(b.total)}</span><span className="text-[10px] font-mono text-t3 w-8 text-right">{b.pct.toFixed(0)}%</span></div>))}</div>) : (<p className="text-[12px] text-t3 font-mono py-4 text-center">No spend data</p>)}
          {cashZeroDate && monthlyBurn>0 && (<div className="mt-3 pt-3 border-t border-border flex items-center justify-between"><span className="text-[10px] font-mono text-t3">CASH ZERO DATE</span><span className={`text-[11px] font-mono font-bold terminal-data ${runway>12?'text-green':runway>6?'text-amber':'text-red'}`}>{cashZeroDate.toLocaleDateString('en-US',{month:'short',day:'numeric',year:'numeric'})}</span></div>)}
        </div></div>
      </div>
    </div>
  )
}
