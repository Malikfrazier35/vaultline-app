import { useMemo } from 'react'

/**
 * Forecast Accuracy Engine
 * 
 * Backtests Linear, EMA, and Monte Carlo models against historical actuals.
 * Computes per-model MAPE, MAE, RMSE, and directional accuracy.
 * Recommends the best model and calibrates confidence bands.
 * 
 * @param {Array} dailyBalances - Array of { date, actual } with non-null actuals
 * @param {number} monthlyBurn - Monthly burn rate from forecast
 * @param {number} totalCash - Current total cash position
 */

// ── Statistical helpers ──
function mean(arr) { return arr.length > 0 ? arr.reduce((s, v) => s + v, 0) / arr.length : 0 }
function stdDev(arr) {
  if (arr.length < 2) return 0
  const m = mean(arr)
  return Math.sqrt(arr.reduce((s, v) => s + (v - m) ** 2, 0) / (arr.length - 1))
}

// ── Model implementations ──
// These mirror the Forecasting.jsx models but run over historical windows for backtesting

function linearForecast(history, steps) {
  if (history.length < 2) return []
  const dailyChanges = history.slice(1).map((v, i) => v - history[i])
  const avgChange = mean(dailyChanges)
  const last = history[history.length - 1]
  return Array.from({ length: steps }, (_, i) => Math.max(0, Math.round(last + avgChange * (i + 1))))
}

function emaForecast(history, steps, span = 14) {
  if (history.length < 2) return []
  const dailyChanges = history.slice(1).map((v, i) => v - history[i])
  const avgChange = mean(dailyChanges)
  const k = 2 / (span + 1)
  let prev = history[history.length - 1]
  const projections = []
  for (let i = 0; i < steps; i++) {
    const proj = Math.round(prev + avgChange)
    prev = proj * k + prev * (1 - k)
    projections.push(Math.max(0, proj))
  }
  return projections
}

function monteCarloForecast(history, steps, nPaths = 200) {
  if (history.length < 3) return { p50: [], p10: [], p90: [] }
  const dailyChanges = history.slice(1).map((v, i) => v - history[i])
  const mu = mean(dailyChanges)
  const sigma = stdDev(dailyChanges)
  const last = history[history.length - 1]

  const paths = Array.from({ length: steps }, () => [])
  for (let s = 0; s < steps; s++) {
    for (let p = 0; p < nPaths; p++) {
      const prev = s > 0 ? paths[s - 1][p] : last
      // Box-Muller for normal distribution
      const u1 = Math.random(), u2 = Math.random()
      const z = Math.sqrt(-2 * Math.log(u1)) * Math.cos(2 * Math.PI * u2)
      paths[s].push(Math.max(0, prev + mu + sigma * z))
    }
  }

  return {
    p50: paths.map(step => { const sorted = [...step].sort((a, b) => a - b); return Math.round(sorted[Math.floor(nPaths * 0.5)]) }),
    p10: paths.map(step => { const sorted = [...step].sort((a, b) => a - b); return Math.round(sorted[Math.floor(nPaths * 0.1)]) }),
    p90: paths.map(step => { const sorted = [...step].sort((a, b) => a - b); return Math.round(sorted[Math.floor(nPaths * 0.9)]) }),
  }
}

// ── Accuracy metrics ──
function computeMetrics(predicted, actual) {
  if (!predicted.length || !actual.length) return null
  const n = Math.min(predicted.length, actual.length)
  const pairs = Array.from({ length: n }, (_, i) => ({ p: predicted[i], a: actual[i] }))
    .filter(({ p, a }) => a != null && p != null && a !== 0)

  if (pairs.length < 2) return null

  const errors = pairs.map(({ p, a }) => p - a)
  const absErrors = errors.map(e => Math.abs(e))
  const pctErrors = pairs.map(({ p, a }) => Math.abs((p - a) / a) * 100)
  const squaredErrors = errors.map(e => e * e)

  // Directional accuracy: did we predict the right direction of change?
  let dirCorrect = 0, dirTotal = 0
  for (let i = 1; i < pairs.length; i++) {
    const actualDir = pairs[i].a - pairs[i - 1].a
    const predDir = pairs[i].p - pairs[i - 1].p
    if (actualDir !== 0) {
      dirTotal++
      if ((actualDir > 0 && predDir > 0) || (actualDir < 0 && predDir < 0)) dirCorrect++
    }
  }

  return {
    mae: mean(absErrors),
    mape: mean(pctErrors),
    rmse: Math.sqrt(mean(squaredErrors)),
    bias: mean(errors), // positive = over-predicting, negative = under-predicting
    directionalAccuracy: dirTotal > 0 ? (dirCorrect / dirTotal) * 100 : null,
    n: pairs.length,
  }
}

// ── Backtest engine ──
// Walks forward through history, using [0..t] to predict [t+1..t+horizon], then scores against actuals
function backtestModel(actuals, modelFn, horizon = 7, minHistory = 14) {
  const allPredictions = []
  const allActuals = []

  for (let t = minHistory; t < actuals.length - horizon; t++) {
    const history = actuals.slice(0, t)
    const predicted = modelFn(history, horizon)
    const actual = actuals.slice(t, t + horizon)

    for (let h = 0; h < Math.min(predicted.length, actual.length); h++) {
      allPredictions.push(predicted[h])
      allActuals.push(actual[h])
    }
  }

  return computeMetrics(allPredictions, allActuals)
}

// ── Anomaly classification ──
export function classifyAnomaly(anomaly, allTransactions, allAnomalies) {
  const date = new Date(anomaly.date)
  const dayOfMonth = date.getDate()
  const dayOfWeek = date.getDay()

  // Check if it's near a payroll cycle (1st, 15th, or last day of month)
  const lastDayOfMonth = new Date(date.getFullYear(), date.getMonth() + 1, 0).getDate()
  const isPayrollCycle = (dayOfMonth <= 2 || (dayOfMonth >= 14 && dayOfMonth <= 16) || dayOfMonth >= lastDayOfMonth - 1)
    && anomaly.direction === 'drop'

  // Check for end-of-month pattern
  const isEndOfMonth = dayOfMonth >= lastDayOfMonth - 2

  // Check for beginning-of-month inflow (revenue collection)
  const isRevenueCollection = dayOfMonth <= 5 && anomaly.direction === 'spike'

  // Check for recurring pattern — same anomaly within ±3 days in prior months
  const isRecurring = allAnomalies.filter(a => {
    if (a.date === anomaly.date) return false
    const aDate = new Date(a.date)
    const monthDiff = Math.abs((date.getFullYear() - aDate.getFullYear()) * 12 + date.getMonth() - aDate.getMonth())
    const dayDiff = Math.abs(date.getDate() - aDate.getDate())
    return monthDiff >= 1 && monthDiff <= 3 && dayDiff <= 3 && a.direction === anomaly.direction
  }).length >= 1

  // Check for weekend effect
  const isWeekendEffect = dayOfWeek === 1 && anomaly.direction === 'spike' // Monday spike from weekend processing

  // Large one-time event detection (>3σ)
  const isOneTime = Math.abs(anomaly.zScore) >= 3 && !isRecurring

  // Classify
  if (isPayrollCycle && isRecurring) return { type: 'payroll', label: 'Payroll Cycle', color: 'purple', confidence: 85 }
  if (isRevenueCollection && isRecurring) return { type: 'revenue', label: 'Revenue Collection', color: 'green', confidence: 80 }
  if (isEndOfMonth) return { type: 'month_end', label: 'Month-End Settlement', color: 'blue', confidence: 70 }
  if (isRecurring) return { type: 'recurring', label: 'Recurring Pattern', color: 'cyan', confidence: 75 }
  if (isWeekendEffect) return { type: 'weekend', label: 'Weekend Processing', color: 'amber', confidence: 60 }
  if (isOneTime) return { type: 'one_time', label: 'One-Time Event', color: 'red', confidence: 90 }
  if (anomaly.direction === 'pattern') return { type: 'trend', label: 'Trend Shift', color: 'amber', confidence: 65 }
  if (anomaly.direction === 'volatility') return { type: 'volatility', label: 'Volatility Regime', color: 'amber', confidence: 70 }
  return { type: 'unknown', label: 'Unclassified', color: 'gray', confidence: 40 }
}

// ── Day-of-week seasonality detector ──
function detectDayOfWeekSeasonality(actuals, dates) {
  if (actuals.length < 28) return null // need at least 4 weeks
  
  const changes = actuals.slice(1).map((v, i) => v - actuals[i])
  const byDay = { 0: [], 1: [], 2: [], 3: [], 4: [], 5: [], 6: [] }
  
  changes.forEach((c, i) => {
    const d = new Date(dates[i + 1]).getDay()
    byDay[d].push(c)
  })

  const dayNames = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat']
  const dayStats = Object.entries(byDay).map(([day, vals]) => ({
    day: parseInt(day),
    dayName: dayNames[parseInt(day)],
    mean: vals.length > 0 ? mean(vals) : 0,
    std: vals.length > 1 ? stdDev(vals) : 0,
    n: vals.length,
  }))

  // Check if there's meaningful day-of-week effect (F-test proxy: max variance between days)
  const overallMean = mean(changes)
  const betweenGroupVar = mean(dayStats.map(d => d.n * (d.mean - overallMean) ** 2))
  const withinGroupVar = mean(dayStats.map(d => d.std ** 2))
  const fRatio = withinGroupVar > 0 ? betweenGroupVar / withinGroupVar : 0

  return {
    dayStats,
    hasSeasonality: fRatio > 2.5, // rough threshold
    fRatio,
    strongestDay: dayStats.reduce((max, d) => Math.abs(d.mean) > Math.abs(max.mean) ? d : max, dayStats[0]),
    weakestDay: dayStats.reduce((min, d) => d.mean < min.mean ? d : min, dayStats[0]),
  }
}

// ── Main hook ──
export default function useForecastAccuracy(chartData, monthlyBurn, totalCash) {
  return useMemo(() => {
    const actPts = (chartData || []).filter(d => d.actual != null)
    if (actPts.length < 21) {
      return {
        models: null,
        recommended: null,
        seasonality: null,
        adaptiveConfidence: null,
        ready: false,
        reason: `Need at least 21 days of data (have ${actPts.length})`,
      }
    }

    const actuals = actPts.map(d => d.actual)
    const dates = actPts.map(d => d.date)

    // ── Backtest each model ──
    const linearMetrics = backtestModel(actuals, linearForecast)
    const emaMetrics = backtestModel(actuals, emaForecast)
    const monteMetrics = backtestModel(actuals, (hist, steps) => monteCarloForecast(hist, steps).p50)

    const models = {
      linear: { id: 'linear', label: 'Linear', metrics: linearMetrics },
      ema: { id: 'ema', label: 'EMA', metrics: emaMetrics },
      monte: { id: 'monte', label: 'Monte Carlo', metrics: monteMetrics },
    }

    // ── Model recommendation ──
    // Score = weighted combo of MAPE (40%), directional accuracy (30%), RMSE normalized (30%)
    const scored = Object.values(models)
      .filter(m => m.metrics)
      .map(m => {
        const mape = m.metrics.mape || 100
        const dir = m.metrics.directionalAccuracy || 50
        const rmseNorm = totalCash > 0 ? (m.metrics.rmse / totalCash) * 100 : 50
        // Lower MAPE is better, higher directional is better, lower RMSE is better
        const score = (100 - Math.min(mape, 100)) * 0.4 + dir * 0.3 + (100 - Math.min(rmseNorm, 100)) * 0.3
        return { ...m, score }
      })
      .sort((a, b) => b.score - a.score)

    const recommended = scored.length > 0 ? scored[0] : null

    // ── Day-of-week seasonality ──
    const seasonality = detectDayOfWeekSeasonality(actuals, dates)

    // ── Adaptive confidence bands ──
    // Based on actual prediction error distribution, calibrate band width
    const recentErrors = []
    const lookback = Math.min(30, actuals.length - 7)
    for (let t = Math.max(14, actuals.length - lookback); t < actuals.length - 1; t++) {
      const hist = actuals.slice(0, t)
      const predicted = linearForecast(hist, 1)
      if (predicted[0] != null) {
        recentErrors.push(Math.abs(predicted[0] - actuals[t]))
      }
    }
    
    const errorStd = stdDev(recentErrors)
    const errorMean = mean(recentErrors)
    const error95 = recentErrors.length > 0
      ? [...recentErrors].sort((a, b) => a - b)[Math.floor(recentErrors.length * 0.95)] || errorStd * 2
      : totalCash * 0.02

    const adaptiveConfidence = {
      bandWidth1Sigma: Math.round(errorStd),
      bandWidth2Sigma: Math.round(errorStd * 2),
      bandWidth95: Math.round(error95),
      meanError: Math.round(errorMean),
      calibratedConfidence: recentErrors.length > 0
        ? Math.max(0, Math.min(100, Math.round(100 - (errorMean / (totalCash || 1)) * 100 * 5)))
        : null,
    }

    return {
      models,
      scored,
      recommended,
      seasonality,
      adaptiveConfidence,
      ready: true,
      dataPoints: actPts.length,
    }
  }, [chartData, monthlyBurn, totalCash])
}
