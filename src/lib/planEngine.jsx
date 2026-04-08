// ═══════════════════════════════════════════════════════════════
// PLAN ENGINE — The brain that maps plans → features → access
// ═══════════════════════════════════════════════════════════════

import { useAuth } from '@/hooks/useAuth'
import { useMemo } from 'react'

// ── Plan Feature Map ───────────────────────────────────────────
export const PLAN_FEATURES = {
  starter: {
    label: 'Starter',
    max_bank_connections: 3,
    max_team_members: 3,
    forecast_days: 30,
    pages: [
      'home', 'dashboard', 'position', 'forecast', 'transactions',
      'banks', 'payments', 'reports', 'alerts', 'copilot',
      'team', 'settings', 'billing',
    ],
    features: [
      'cash_position', 'basic_reports', 'email_alerts', 'transaction_tagging',
    ],
    blocked_features: [
      'scenarios', 'multi_currency', 'custom_reports',
      'api_access', 'slack_alerts', 'security_center', 'audit_center',
      'sso', 'compliance_reports', 'data_import', 'entities',
    ],
  },
  growth: {
    label: 'Growth',
    max_bank_connections: 10,
    max_team_members: 15,
    forecast_days: 90,
    pages: [
      'home', 'dashboard', 'position', 'forecast', 'transactions',
      'banks', 'payments', 'reports', 'scenarios', 'alerts',
      'multi-currency', 'team', 'settings', 'billing', 'copilot',
      'import', 'entities',
    ],
    features: [
      'cash_position', 'basic_reports', 'email_alerts', 'transaction_tagging',
      'copilot', 'scenarios', 'multi_currency', 'custom_reports',
      'api_access', 'slack_alerts', 'auto_categorization', 'data_import',
      'multi_entity',
    ],
    blocked_features: [
      'security_center', 'audit_center', 'sso', 'compliance_reports',
    ],
  },
  enterprise: {
    label: 'Enterprise',
    max_bank_connections: 999,
    max_team_members: 999,
    forecast_days: 365,
    pages: [
      'home', 'dashboard', 'position', 'forecast', 'transactions',
      'banks', 'payments', 'reports', 'scenarios', 'alerts',
      'multi-currency', 'team', 'settings', 'billing', 'copilot',
      'import', 'entities', 'security-center', 'audit-center',
      'audit-log', 'integrations',
    ],
    features: [
      'cash_position', 'basic_reports', 'email_alerts', 'transaction_tagging',
      'copilot', 'scenarios', 'multi_currency', 'custom_reports',
      'api_access', 'slack_alerts', 'auto_categorization', 'data_import',
      'multi_entity', 'security_center', 'audit_center', 'sso',
      'compliance_reports', 'priority_support', 'accounting_sync',
    ],
    blocked_features: [],
  },
}

// ── Plan Gate Hook ─────────────────────────────────────────────
export function usePlanGate() {
  const { org } = useAuth()
  const plan = org?.plan || 'starter'
  const config = PLAN_FEATURES[plan] || PLAN_FEATURES.starter

  return useMemo(() => ({
    plan,
    label: config.label,
    maxConnections: config.max_bank_connections,
    maxTeamMembers: config.max_team_members,
    forecastDays: config.forecast_days,

    // Check if a specific feature is allowed
    hasFeature: (feature) => config.features.includes(feature),

    // Check if a page is allowed
    hasPage: (page) => config.pages.includes(page),

    // Check if a feature is blocked (for showing upgrade prompts)
    isBlocked: (feature) => config.blocked_features.includes(feature),

    // Get the minimum plan needed for a feature
    requiredPlan: (feature) => {
      if (PLAN_FEATURES.starter.features.includes(feature)) return 'starter'
      if (PLAN_FEATURES.growth.features.includes(feature)) return 'growth'
      return 'enterprise'
    },

    // Full config for advanced use
    config,
  }), [plan, config])
}

// ── Time Period Gating ────────────────────────────────────────
export const PLAN_PERIODS = {
  starter:    ['7D', '30D'],
  growth:     ['7D', '30D', '90D', 'MTD', 'QTD'],
  enterprise: ['7D', '30D', '90D', 'MTD', 'QTD', 'YTD', 'FY'],
}

export function getAllowedPeriods(plan) {
  return PLAN_PERIODS[plan] || PLAN_PERIODS.starter
}

export function isPeriodAllowed(plan, period) {
  return (PLAN_PERIODS[plan] || PLAN_PERIODS.starter).includes(period)
}

// Required plan for a given period
export function periodRequiredPlan(period) {
  if (PLAN_PERIODS.starter.includes(period)) return 'starter'
  if (PLAN_PERIODS.growth.includes(period)) return 'growth'
  return 'enterprise'
}
export function UpgradeGate({ feature, children, fallback }) {
  const { hasFeature, requiredPlan, label } = usePlanGate()

  if (hasFeature(feature)) return children

  const needed = requiredPlan(feature)
  const neededLabel = PLAN_FEATURES[needed]?.label || 'Growth'

  if (fallback) return fallback

  return (
    <div className="flex flex-col items-center justify-center py-16 px-6 text-center">
      <div className="w-12 h-12 rounded-xl bg-purple/[0.08] flex items-center justify-center mb-4">
        <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" className="text-purple">
          <path d="M12 2L2 7l10 5 10-5-10-5z" /><path d="M2 17l10 5 10-5" /><path d="M2 12l10 5 10-5" />
        </svg>
      </div>
      <h3 className="text-lg font-bold mb-2">Upgrade to {neededLabel}</h3>
      <p className="text-t3 text-sm max-w-md mb-6">
        This feature is available on the {neededLabel} plan and above. 
        You're currently on {label}.
      </p>
      <a href="/billing" className="px-6 py-2.5 rounded-xl bg-gradient-to-r from-cyan to-purple text-white text-sm font-semibold hover:-translate-y-px transition-all">
        Upgrade Plan
      </a>
    </div>
  )
}
