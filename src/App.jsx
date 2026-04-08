import { BrowserRouter, Routes, Route, Navigate } from 'react-router-dom'
import { AuthProvider, useAuth } from '@/hooks/useAuth'
import { lazy, Suspense } from 'react'
import Layout from '@/components/Layout'
import Paywall from '@/components/Paywall'
import ErrorBoundary, { SectionBoundary } from '@/components/ErrorBoundary'
import CookieConsent from '@/components/CookieConsent'
import { ToastProvider } from '@/components/Toast'

// Retry-capable lazy loader — retries chunk loads up to 3 times with 1s delay
function lazyRetry(importFn, retries = 3) {
  return lazy(() => new Promise((resolve, reject) => {
    function attempt(remaining) {
      importFn().then(resolve).catch(err => {
        if (remaining <= 0) { reject(err); return }
        setTimeout(() => attempt(remaining - 1), 1000)
      })
    }
    attempt(retries)
  }))
}

// Lazy load all pages — only Landing loads immediately
import Landing from '@/pages/Landing'
const LPDemo = lazyRetry(() => import('@/pages/LPDemo'))
const LPTrial = lazyRetry(() => import('@/pages/LPTrial'))
const Login = lazyRetry(() => import('@/pages/Login'))
const Signup = lazyRetry(() => import('@/pages/Signup'))
const ForgotPassword = lazyRetry(() => import('@/pages/ForgotPassword'))
const ResetPassword = lazyRetry(() => import('@/pages/ResetPassword'))
const ROICalculator = lazyRetry(() => import('@/pages/ROICalculator'))
const Assessment = lazyRetry(() => import('@/pages/Assessment'))
const Support = lazyRetry(() => import('@/pages/Support'))
const StatusPage = lazyRetry(() => import('@/pages/StatusPage'))
const PartnerAdmin = lazyRetry(() => import('@/pages/PartnerAdmin'))
const SecurityCenter = lazyRetry(() => import('@/pages/SecurityCenter'))
const PrivacyCenter = lazyRetry(() => import('@/pages/PrivacyCenter'))
const Benchmark = lazyRetry(() => import('@/pages/Benchmark'))
const BurnSimulator = lazyRetry(() => import('@/pages/BurnSimulator'))
const TimeManager = lazyRetry(() => import('@/pages/TimeManager'))
const MarketingHub = lazyRetry(() => import('@/pages/MarketingHub'))
const LegalCenter = lazyRetry(() => import('@/pages/LegalCenter'))
const IndustryHub = lazyRetry(() => import('@/pages/IndustryHub'))
const DataIntelligence = lazyRetry(() => import('@/pages/DataIntelligence'))
const CashVisibility = lazyRetry(() => import('@/pages/CashVisibility'))
const UXCenter = lazyRetry(() => import('@/pages/UXCenter'))
const ResourceHub = lazyRetry(() => import('@/pages/ResourceHub'))
const PaymentHub = lazyRetry(() => import('@/pages/PaymentHub'))
const DesignSystem = lazyRetry(() => import('@/pages/DesignSystem'))
const AutomationCenter = lazyRetry(() => import('@/pages/AutomationCenter'))
const OpportunityCenter = lazyRetry(() => import('@/pages/OpportunityCenter'))
const WeaknessCenter = lazyRetry(() => import('@/pages/WeaknessCenter'))
const ThreatCenter = lazyRetry(() => import('@/pages/ThreatCenter'))
const AuditCenter = lazyRetry(() => import('@/pages/AuditCenter'))
const Privacy = lazyRetry(() => import('@/pages/Privacy'))
const Terms = lazyRetry(() => import('@/pages/Terms'))
const SecurityPage = lazyRetry(() => import('@/pages/SecurityPage'))
const HowItWorks = lazyRetry(() => import('@/pages/HowItWorks'))
const Home = lazyRetry(() => import('@/pages/Home'))
const Dashboard = lazyRetry(() => import('@/pages/Dashboard'))
const CashPosition = lazyRetry(() => import('@/pages/CashPosition'))
const Forecasting = lazyRetry(() => import('@/pages/Forecasting'))
const Transactions = lazyRetry(() => import('@/pages/Transactions'))
const BankConnections = lazyRetry(() => import('@/pages/BankConnections'))
const Reports = lazyRetry(() => import('@/pages/Reports'))
const DataImport = lazyRetry(() => import('@/pages/DataImport'))
const Billing = lazyRetry(() => import('@/pages/Billing'))
const Team = lazyRetry(() => import('@/pages/Team'))
const Settings = lazyRetry(() => import('@/pages/Settings'))
const SuperAdmin = lazyRetry(() => import('@/pages/SuperAdmin'))
const Scenarios = lazyRetry(() => import('@/pages/Scenarios'))
const Payments = lazyRetry(() => import('@/pages/Payments'))
const Alerts = lazyRetry(() => import('@/pages/Alerts'))
const MultiCurrency = lazyRetry(() => import('@/pages/MultiCurrency'))
const Entities = lazyRetry(() => import('@/pages/Entities'))
const ApiAccess = lazyRetry(() => import('@/pages/ApiAccess'))
const AuditLog = lazyRetry(() => import('@/pages/AuditLog'))
const Integrations = lazyRetry(() => import('@/pages/Integrations'))
const SSO = lazyRetry(() => import('@/pages/SSO'))
const ApiDocs = lazyRetry(() => import('@/pages/ApiDocs'))
const NotFound = lazyRetry(() => import('@/pages/NotFound'))

function Spinner() {
  return (
    <div className="min-h-screen flex bg-void">
      {/* Sidebar skeleton */}
      <div className="w-[220px] border-r border-border bg-surface hidden lg:block">
        <div className="px-7 py-5 border-b border-border">
          <div className="skeleton h-8 w-32 rounded-lg" />
        </div>
        <div className="px-4 py-6 space-y-2">
          {[1,2,3,4,5,6].map(i => <div key={i} className="skeleton h-9 w-full rounded-lg" style={{ animationDelay: `${i * 0.05}s` }} />)}
        </div>
      </div>
      {/* Content skeleton */}
      <div className="flex-1 p-8">
        <div className="space-y-6 max-w-5xl">
          <div className="skeleton h-8 w-48 rounded-lg" />
          <div className="skeleton h-4 w-72 rounded" />
          <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
            {[1,2,3,4].map(i => <div key={i} className="skeleton h-24 rounded-xl" style={{ animationDelay: `${i * 0.1}s` }} />)}
          </div>
          <div className="skeleton h-64 rounded-xl" style={{ animationDelay: '0.3s' }} />
        </div>
      </div>
    </div>
  )
}

function ProtectedRoute({ children }) {
  const { user, org, loading } = useAuth()
  if (loading) return <Spinner />
  if (!user) return <Navigate to="/login" replace />
  // Allow active and trialing users. Block canceled/past_due.
  const allowed = ['active', 'trialing']
  if (org?.plan_status && !allowed.includes(org.plan_status)) return <Paywall />
  return children
}

// Auth-only wrapper: requires login but NOT payment (for billing page)
function AuthRequired({ children }) {
  const { user, loading } = useAuth()
  if (loading) return <Spinner />
  if (!user) return <Navigate to="/login" replace />
  return children
}

// Per-page error wrapper — catches crashes without killing the app
function SafePage({ children, name }) {
  return <SectionBoundary name={name || 'Page'} height="min-h-[400px]">{children}</SectionBoundary>
}

export default function App() {
  return (
    <ErrorBoundary>
    <BrowserRouter>
      <ToastProvider>
      <AuthProvider>
        <Suspense fallback={<Spinner />}>
          <Routes>
            {/* Public */}
            <Route index element={<ErrorBoundary><Landing /></ErrorBoundary>} />
            <Route path="/login" element={<Login />} />
            <Route path="/forgot-password" element={<ForgotPassword />} />
            <Route path="/reset-password" element={<ResetPassword />} />
            <Route path="/roi" element={<ROICalculator />} />
            <Route path="/assess" element={<Assessment />} />
            <Route path="/status" element={<StatusPage />} />
            <Route path="/benchmark" element={<Benchmark />} />
            <Route path="/burn-simulator" element={<BurnSimulator />} />
            <Route path="/legal" element={<LegalCenter />} />
            <Route path="/signup" element={<Signup />} />
            <Route path="/lp/demo" element={<LPDemo />} />
            <Route path="/lp/trial" element={<LPTrial />} />
            <Route path="/privacy" element={<Privacy />} />
            <Route path="/terms" element={<Terms />} />
            <Route path="/security" element={<SecurityPage />} />
            <Route path="/how-it-works" element={<HowItWorks />} />
            <Route path="/admin" element={<SuperAdmin />} />

            {/* Protected — requires authentication but NOT payment (billing access) */}
            <Route path="/billing" element={<AuthRequired><Layout /></AuthRequired>}>
              <Route index element={<SafePage name="Billing"><Billing /></SafePage>} />
            </Route>

            {/* Protected — requires authentication AND active payment */}
            <Route path="/" element={<ProtectedRoute><Layout /></ProtectedRoute>}>
              <Route index element={<Navigate to="/home" replace />} />
              <Route path="home" element={<SafePage name="Home"><Home /></SafePage>} />
              <Route path="dashboard" element={<SafePage name="Dashboard"><Dashboard /></SafePage>} />
              <Route path="position" element={<SafePage name="Cash Position"><CashPosition /></SafePage>} />
              <Route path="forecast" element={<SafePage name="Forecasting"><Forecasting /></SafePage>} />
              <Route path="transactions" element={<SafePage name="Transactions"><Transactions /></SafePage>} />
              <Route path="banks" element={<SafePage name="Banks"><BankConnections /></SafePage>} />
              <Route path="import" element={<SafePage name="Import"><DataImport /></SafePage>} />
              <Route path="reports" element={<SafePage name="Reports"><Reports /></SafePage>} />
              <Route path="scenarios" element={<SafePage name="Scenarios"><Scenarios /></SafePage>} />
              <Route path="payments" element={<SafePage name="Payments"><Payments /></SafePage>} />
              <Route path="alerts" element={<SafePage name="Alerts"><Alerts /></SafePage>} />
              <Route path="currencies" element={<SafePage name="Multi-Currency"><MultiCurrency /></SafePage>} />
              <Route path="entities" element={<SafePage name="Entities"><Entities /></SafePage>} />
              <Route path="api" element={<SafePage name="API"><ApiAccess /></SafePage>} />
              <Route path="docs" element={<SafePage name="API Docs"><ApiDocs /></SafePage>} />
              <Route path="audit" element={<SafePage name="Audit Log"><AuditLog /></SafePage>} />
              <Route path="integrations" element={<SafePage name="Integrations"><Integrations /></SafePage>} />
              <Route path="sso" element={<SafePage name="SSO"><SSO /></SafePage>} />
              <Route path="team" element={<SafePage name="Team"><Team /></SafePage>} />
              <Route path="settings" element={<SafePage name="Settings"><Settings /></SafePage>} />
              <Route path="support" element={<SafePage name="Support"><Support /></SafePage>} />
              <Route path="partner-admin" element={<SafePage name="Partners"><PartnerAdmin /></SafePage>} />
              <Route path="security-center" element={<SafePage name="Security Center"><SecurityCenter /></SafePage>} />
              <Route path="privacy-center" element={<SafePage name="Privacy Center"><PrivacyCenter /></SafePage>} />
              <Route path="time" element={<SafePage name="Time"><TimeManager /></SafePage>} />
              <Route path="marketing" element={<SafePage name="Marketing"><MarketingHub /></SafePage>} />
              <Route path="industry" element={<SafePage name="Industry"><IndustryHub /></SafePage>} />
              <Route path="data-intelligence" element={<SafePage name="Data Intelligence"><DataIntelligence /></SafePage>} />
              <Route path="cash-visibility" element={<SafePage name="Cash Visibility"><CashVisibility /></SafePage>} />
              <Route path="ux" element={<SafePage name="UX"><UXCenter /></SafePage>} />
              <Route path="resources" element={<SafePage name="Resources"><ResourceHub /></SafePage>} />
              <Route path="payment-hub" element={<SafePage name="Payment Hub"><PaymentHub /></SafePage>} />
              <Route path="design-system" element={<SafePage name="Design System"><DesignSystem /></SafePage>} />
              <Route path="automation" element={<SafePage name="Automation"><AutomationCenter /></SafePage>} />
              <Route path="opportunities" element={<SafePage name="Opportunities"><OpportunityCenter /></SafePage>} />
              <Route path="weaknesses" element={<SafePage name="Weaknesses"><WeaknessCenter /></SafePage>} />
              <Route path="threats" element={<SafePage name="Threats"><ThreatCenter /></SafePage>} />
              <Route path="audit-center" element={<SafePage name="Audit Center"><AuditCenter /></SafePage>} />
            </Route>
            <Route path="*" element={<NotFound />} />
          </Routes>
        </Suspense>
      </AuthProvider>
      <CookieConsent />
      </ToastProvider>
    </BrowserRouter>
    </ErrorBoundary>
  )
}
