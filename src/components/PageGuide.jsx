import { useState, useEffect } from 'react'
import { Link } from 'react-router-dom'
import { X, ArrowRight, Lightbulb, BookOpen, Zap } from 'lucide-react'

/**
 * PageGuide — contextual guidance component for deep pages.
 * Shows a dismissible banner explaining what the page does,
 * what actions are available, and prerequisites if data is empty.
 *
 * Usage:
 *   <PageGuide
 *     pageId="security-center"
 *     title="Security Center"
 *     description="Monitor your security posture, review events, manage policies, and generate compliance reports."
 *     actions={['Review security events', 'Configure IP allowlist', 'Generate SOC 2 report']}
 *     prerequisites={[
 *       { label: 'Connect a bank', path: '/banks', met: bankCount > 0 },
 *     ]}
 *     tips={['Click the score ring to recalculate your security score']}
 *     isEmpty={!hasData}
 *     emptyMessage="No security events yet. Events are logged automatically as your team uses the platform."
 *   />
 */

const DISMISSED_KEY = 'vaultline-guides-dismissed'

function getDismissed() {
  try {
    return JSON.parse(localStorage.getItem(DISMISSED_KEY) || '{}')
  } catch { return {} }
}

export default function PageGuide({
  pageId,
  title,
  description,
  actions = [],
  prerequisites = [],
  tips = [],
  isEmpty = false,
  emptyMessage = '',
}) {
  const [dismissed, setDismissed] = useState(false)
  const [showTips, setShowTips] = useState(false)

  useEffect(() => {
    const d = getDismissed()
    if (d[pageId]) setDismissed(true)
  }, [pageId])

  function dismiss() {
    setDismissed(true)
    const d = getDismissed()
    d[pageId] = Date.now()
    localStorage.setItem(DISMISSED_KEY, JSON.stringify(d))
  }

  // Don't show if dismissed — unless the page is empty (always show empty state guidance)
  if (dismissed && !isEmpty) return null

  const unmetPrereqs = prerequisites.filter(p => !p.met)

  return (
    <div className="mb-5 animate-in fade-in">
      {/* Empty state guidance */}
      {isEmpty && emptyMessage && (
        <div className="glass-card rounded-2xl p-5 border-amber/[0.1] mb-3">
          <div className="flex items-start gap-3">
            <div className="w-8 h-8 rounded-lg bg-amber/[0.08] flex items-center justify-center flex-shrink-0 mt-0.5">
              <Zap size={14} className="text-amber" />
            </div>
            <div className="flex-1">
              <p className="text-[13px] font-semibold text-t1">No data yet</p>
              <p className="text-[12px] text-t3 mt-1 leading-relaxed">{emptyMessage}</p>
              {unmetPrereqs.length > 0 && (
                <div className="flex flex-wrap gap-2 mt-3">
                  {unmetPrereqs.map(p => (
                    <Link key={p.path} to={p.path}
                      className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-[11px] font-mono font-semibold bg-cyan/[0.06] text-cyan border border-cyan/[0.1] hover:bg-cyan/[0.1] transition">
                      {p.label} <ArrowRight size={10} />
                    </Link>
                  ))}
                </div>
              )}
            </div>
          </div>
        </div>
      )}

      {/* Page guide (collapsible) */}
      {!dismissed && (
        <div className="glass-card rounded-2xl overflow-hidden border-purple/[0.06]">
          <div className="px-5 py-4 flex items-start gap-3">
            <div className="w-8 h-8 rounded-lg bg-purple/[0.08] flex items-center justify-center flex-shrink-0 mt-0.5">
              <BookOpen size={14} className="text-purple" />
            </div>
            <div className="flex-1 min-w-0">
              <div className="flex items-center justify-between">
                <p className="text-[13px] font-semibold text-t1">{title}</p>
                <button onClick={dismiss}
                  className="p-1.5 rounded-lg hover:bg-deep text-t4 hover:text-t2 transition flex-shrink-0"
                  title="Dismiss guide">
                  <X size={12} />
                </button>
              </div>
              <p className="text-[12px] text-t3 mt-1 leading-relaxed">{description}</p>

              {/* Available actions */}
              {actions.length > 0 && (
                <div className="mt-3">
                  <p className="text-[10px] font-mono text-t4 uppercase tracking-wider mb-1.5">What you can do here</p>
                  <div className="flex flex-wrap gap-1.5">
                    {actions.map((action, i) => (
                      <span key={i} className="px-2.5 py-1 rounded-md bg-deep text-[11px] text-t2 border border-border/50">
                        {action}
                      </span>
                    ))}
                  </div>
                </div>
              )}

              {/* Tips toggle */}
              {tips.length > 0 && (
                <button onClick={() => setShowTips(!showTips)}
                  className="flex items-center gap-1.5 mt-3 text-[11px] font-mono text-cyan hover:text-cyan/80 transition">
                  <Lightbulb size={10} /> {showTips ? 'Hide tips' : `${tips.length} tip${tips.length > 1 ? 's' : ''}`}
                </button>
              )}
              {showTips && (
                <div className="mt-2 space-y-1.5">
                  {tips.map((tip, i) => (
                    <p key={i} className="text-[11px] text-t3 pl-4 border-l-2 border-cyan/20">{tip}</p>
                  ))}
                </div>
              )}
            </div>
          </div>
        </div>
      )}
    </div>
  )
}

/**
 * PAGE_GUIDES — contextual guide config for each deep page.
 * Import this and match against the current route.
 */
export const PAGE_GUIDES = {
  '/security-center': {
    title: 'Security Center',
    description: 'Monitor your security posture with a real-time score, review security events, manage IP allowlists, configure access policies, and generate compliance reports.',
    actions: ['Review security events', 'Recalculate security score', 'Manage IP allowlist', 'Update security policies', 'Generate SOC 2 report'],
    tips: ['The security score updates automatically based on your configuration', 'IP allowlisting is available for enterprise-grade access control', 'Export compliance reports as JSON for your auditors'],
    emptyMessage: 'Security events are logged automatically as your team uses the platform. Login attempts, policy changes, and data access are all tracked here.',
  },
  '/privacy-center': {
    title: 'Privacy Center',
    description: 'Manage consent records, handle data subject requests (DSRs), configure data retention policies, and track processing activities for GDPR/CCPA compliance.',
    actions: ['Record consent', 'Process data subject requests', 'View processing activities', 'Enforce retention policies'],
    tips: ['Data subject requests must be responded to within 30 days under GDPR', 'Consent records are immutable once created for audit trail integrity'],
    emptyMessage: 'No privacy events recorded yet. Configure consent categories and processing activities to start tracking compliance.',
  },
  '/audit-center': {
    title: 'Audit Center',
    description: 'Run audit programs, track findings with severity levels, manage compliance checklists, and monitor remediation progress across SOX, SOC 2, and internal controls.',
    actions: ['Create audit programs', 'Track audit findings', 'Run compliance checklists', 'Export audit evidence'],
    tips: ['Audit findings automatically link to the compliance framework they affect', 'Use the checklist feature to run recurring SOC 2 readiness assessments'],
    emptyMessage: 'Create your first audit program to start tracking compliance across your organization.',
  },
  '/cash-position': {
    title: 'Cash Position',
    description: 'View real-time cash balances across all connected bank accounts, track intraday movements, and monitor liquidity ratios.',
    actions: ['View consolidated balances', 'Track intraday cash movement', 'Set liquidity thresholds'],
    tips: ['The position chart updates every 60 seconds when bank connections are active', 'Click any account to see its individual balance history'],
    emptyMessage: 'Connect a bank account via Plaid to see your real-time cash position here.',
  },
  '/forecasting': {
    title: 'Cash Forecasting',
    description: 'Generate AI-powered cash flow forecasts based on historical transaction patterns. View 30, 60, and 90-day projections with confidence intervals.',
    actions: ['Generate new forecast', 'Compare forecast vs actuals', 'Adjust forecast parameters'],
    tips: ['Forecasts improve with more historical data — connect your banks for best results', 'The confidence interval narrows as the model sees more patterns'],
    emptyMessage: 'Connect a bank account and accumulate at least 30 days of transaction history to generate your first forecast.',
  },
  '/transactions': {
    title: 'Transactions',
    description: 'Search, filter, and categorize all financial transactions across your connected accounts. Smart categorization tags transactions automatically.',
    actions: ['Search transactions', 'Filter by category', 'Export transaction data'],
    tips: ['Use the search bar to find transactions by description or bank name', 'Categories are assigned automatically but can be manually overridden'],
    emptyMessage: 'Connect a bank account to start seeing transactions here. Seed data is available for demo purposes.',
  },
  '/payment-hub': {
    title: 'Payment Hub',
    description: 'Send payments, manage payees, set up approval workflows, and track payment status across all your accounts.',
    actions: ['Create payment', 'Manage payees', 'Review pending approvals', 'Track payment history'],
    tips: ['Dual approval is required for payments over your configured threshold', 'Recurring payments can be scheduled with automatic execution'],
    emptyMessage: 'Set up your first payee to start using the payment hub. Payments are processed through your connected bank accounts.',
  },
  '/scenarios': {
    title: 'Scenario Planning',
    description: 'Model what-if scenarios to stress test your cash position. Create optimistic, pessimistic, and base case projections.',
    actions: ['Create scenario', 'Compare scenarios side-by-side', 'Stress test assumptions'],
    tips: ['Start with a base case, then duplicate and modify for bull/bear scenarios', 'Scenarios can be shared with team members for collaborative planning'],
    emptyMessage: 'Create your first scenario to model potential cash flow outcomes. Historical transaction data improves scenario accuracy.',
  },
  '/data-intelligence': {
    title: 'Data Intelligence',
    description: 'Monitor data quality scores, review data lineage, generate automated insights, and track anomalies across your financial data.',
    actions: ['Review data quality scores', 'Track data lineage', 'View automated insights'],
    tips: ['Data quality scores improve as you resolve flagged issues', 'Anomaly detection runs automatically on every data sync'],
    emptyMessage: 'Connect a data source to start generating intelligence reports. The system analyzes data quality and patterns automatically.',
  },
  '/entities': {
    title: 'Multi-Entity Treasury',
    description: 'Manage multiple business entities with consolidated views across all organizations. View entity-level P&L, intercompany transfers, and consolidated reporting.',
    actions: ['Add entity', 'View consolidated position', 'Manage intercompany transfers'],
    tips: ['Entities can share bank connections or maintain separate accounts', 'Consolidated reporting rolls up across all active entities'],
    emptyMessage: 'Add your first business entity to enable multi-entity treasury management.',
  },
  '/alerts': {
    title: 'Smart Alerts',
    description: 'Configure threshold-based alerts for balance drops, large transactions, payment deadlines, and security events. Get notified via in-app, email, or Slack.',
    actions: ['Create alert rule', 'Configure notification channels', 'Review alert history'],
    tips: ['Set a low-balance alert as your first rule — it catches cash shortfalls before they happen', 'Alerts can trigger for specific accounts or across all accounts'],
    emptyMessage: 'Set up your first alert rule to start monitoring your treasury for critical events.',
  },
  '/reports': {
    title: 'Reports',
    description: 'Generate and schedule treasury reports including cash flow statements, variance analysis, bank reconciliation, and custom reports.',
    actions: ['Generate report', 'Schedule recurring reports', 'Export to PDF/CSV'],
    tips: ['Scheduled reports are emailed automatically on your chosen cadence', 'Custom reports can include any combination of accounts and date ranges'],
    emptyMessage: 'Connect bank accounts and accumulate transaction data to generate your first report.',
  },
}
