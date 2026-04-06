import { useSEO } from '@/hooks/useSEO'
import { Link } from 'react-router-dom'
import ThemeToggle from '@/components/ThemeToggle'

export default function Terms() {
  useSEO({ title: 'Terms of Service', description: 'Vaultline terms of service. Subscription terms, acceptable use, data ownership, security responsibilities, and service commitments.', canonical: '/terms' })
  return (
    <div className="min-h-screen bg-void text-t1">
      <nav className="fixed top-0 left-0 right-0 z-50 border-b border-border bg-deep">
        <div className="max-w-4xl mx-auto px-6 h-16 flex items-center justify-between">
          <Link to="/" className="font-display text-xl font-black tracking-tight">Vault<span className="bg-gradient-to-r from-cyan to-purple bg-clip-text text-transparent">line</span></Link>
          <ThemeToggle />
        </div>
      </nav>
      <div className="max-w-3xl mx-auto px-6 pt-28 pb-20">
        <h1 className="font-display text-3xl font-black mb-2">Terms of Service</h1>
        <p className="text-t2 text-[14px] mb-10">Last updated: April 6, 2026</p>
        <div className="space-y-8 text-[14px] text-t2 leading-relaxed">

          <section>
            <h2 className="font-display text-lg font-bold text-t1 mb-3">1. Acceptance of terms</h2>
            <p>By creating an account on Vaultline ("the Service"), operated by Financial Holding LLC ("we," "our," or "us"), you agree to be bound by these Terms of Service ("Terms"). If you are using the Service on behalf of a company, you represent that you have the authority to bind that company to these Terms. If you do not agree, do not use the Service.</p>
          </section>

          <section>
            <h2 className="font-display text-lg font-bold text-t1 mb-3">2. Description of service</h2>
            <p>Vaultline is a cloud-based treasury management platform for mid-market finance teams. The Service includes real-time cash position monitoring, AI-powered cash flow forecasting, multi-entity treasury consolidation, multi-currency management, bank account integrations via Plaid, transaction categorization, scenario modeling, audit logging, security monitoring, and compliance reporting. The specific features available to you depend on your subscription plan.</p>
          </section>

          <section>
            <h2 className="font-display text-lg font-bold text-t1 mb-3">3. Account registration</h2>
            <p className="mb-2">You must provide accurate, current, and complete registration information. You are responsible for maintaining the confidentiality of your account credentials and for all activities that occur under your account. You agree to notify us immediately of any unauthorized use.</p>
            <p>Each account is scoped to a single organization. All data within your organization is isolated from other tenants via row-level security at the database layer.</p>
          </section>

          <section>
            <h2 className="font-display text-lg font-bold text-t1 mb-3">4. Subscription plans and billing</h2>
            <p className="mb-2">Vaultline offers the following subscription plans:</p>
            <p className="mb-1"><span className="font-semibold text-t1">Starter:</span> $499/month (or $399/month billed annually). Up to 3 bank connections, 30-day forecasting, basic reports.</p>
            <p className="mb-1"><span className="font-semibold text-t1">Growth:</span> $1,499/month (or $1,199/month billed annually). Up to 10 bank connections, 90-day AI forecasting, multi-entity support, API access.</p>
            <p className="mb-1"><span className="font-semibold text-t1">Enterprise:</span> $2,499/month (or $1,999/month billed annually). Unlimited bank connections, scenario modeling, compliance report generator, security center.</p>
            <p className="mb-2 mt-2"><span className="font-semibold text-t1">Free trial:</span> All plans include a 14-day free trial. No payment method is required to start a trial. At the end of the trial, you must subscribe to continue using the Service.</p>
            <p className="mb-2"><span className="font-semibold text-t1">Payment:</span> Subscription fees are billed in advance on a monthly or annual basis via Stripe, Inc. You authorize us to charge your payment method for the applicable fees. If payment fails, we may suspend access until payment is received.</p>
            <p className="mb-2"><span className="font-semibold text-t1">Cancellation:</span> You may cancel your subscription at any time from the Billing page. Upon cancellation, you retain access until the end of your current billing period. No prorated refunds are provided for partial billing periods.</p>
            <p><span className="font-semibold text-t1">Refunds:</span> We offer a 30-day money-back guarantee on all new subscriptions. If you are not satisfied within the first 30 days of a paid subscription, contact us for a full refund.</p>
          </section>

          <section>
            <h2 className="font-display text-lg font-bold text-t1 mb-3">5. Acceptable use</h2>
            <p className="mb-2">You agree not to:</p>
            <p className="mb-1">— Use the Service for any unlawful purpose or in violation of any applicable laws or regulations.</p>
            <p className="mb-1">— Attempt to gain unauthorized access to other accounts, computer systems, or networks connected to the Service.</p>
            <p className="mb-1">— Interfere with or disrupt the integrity or performance of the Service.</p>
            <p className="mb-1">— Reverse-engineer, decompile, or disassemble any portion of the Service.</p>
            <p className="mb-1">— Use automated scripts or bots to access the Service except through our documented API.</p>
            <p>— Transmit malicious code, viruses, or any other harmful technology.</p>
          </section>

          <section>
            <h2 className="font-display text-lg font-bold text-t1 mb-3">6. API usage</h2>
            <p className="mb-2">API access is available on Growth and Enterprise plans. API usage is subject to rate limits. You agree not to exceed the rate limits documented in our API documentation. We reserve the right to throttle or suspend API access for accounts that consistently exceed limits or use the API in ways that degrade service quality for other users.</p>
            <p>API keys are confidential. You are responsible for securing your API credentials and are liable for any actions taken using your keys.</p>
          </section>

          <section>
            <h2 className="font-display text-lg font-bold text-t1 mb-3">7. Data ownership</h2>
            <p className="mb-2"><span className="font-semibold text-t1">Your data:</span> You retain all ownership rights to data you upload or that is synced via bank connections. We do not claim ownership of your financial data.</p>
            <p className="mb-2"><span className="font-semibold text-t1">Our data:</span> We own all rights to aggregated, anonymized analytics derived from usage of the Service. This data cannot be used to identify you or your organization.</p>
            <p><span className="font-semibold text-t1">Data portability:</span> You may export your data at any time via the Settings page. Exports are provided in machine-readable format (CSV or JSON). Data exports are subject to the security controls described in our <Link to="/privacy" className="text-cyan hover:underline">Privacy Policy</Link>.</p>
          </section>

          <section>
            <h2 className="font-display text-lg font-bold text-t1 mb-3">8. Security responsibilities</h2>
            <p className="mb-2"><span className="font-semibold text-t1">What we secure:</span> Infrastructure, database, encryption at rest and in transit, row-level tenant isolation, session management, audit logging, security headers, fraud detection, and compliance monitoring.</p>
            <p><span className="font-semibold text-t1">What you secure:</span> Your account credentials, API keys, team member access (adding/removing users), bank connection authorizations, and export distribution. You are responsible for managing user permissions within your organization and ensuring that departed employees are removed promptly.</p>
          </section>

          <section>
            <h2 className="font-display text-lg font-bold text-t1 mb-3">9. Intellectual property</h2>
            <p>The Service, including all software, design, text, graphics, logos, and trademarks, is owned by Financial Holding LLC and protected by intellectual property laws. You are granted a limited, non-exclusive, non-transferable license to use the Service during your active subscription. This license does not include the right to modify, distribute, or create derivative works of the Service.</p>
          </section>

          <section>
            <h2 className="font-display text-lg font-bold text-t1 mb-3">10. Service availability</h2>
            <p className="mb-2">We strive to maintain high availability of the Service but do not guarantee uninterrupted access. The Service may be temporarily unavailable due to scheduled maintenance (with advance notice when possible), infrastructure failures, or force majeure events.</p>
            <p>Enterprise and Custom plan customers may negotiate specific uptime commitments under a separate Service Level Agreement (SLA).</p>
          </section>

          <section>
            <h2 className="font-display text-lg font-bold text-t1 mb-3">11. Limitation of liability</h2>
            <p className="mb-2">TO THE MAXIMUM EXTENT PERMITTED BY LAW, IN NO EVENT SHALL FINANCIAL HOLDING LLC, ITS OFFICERS, DIRECTORS, EMPLOYEES, OR AGENTS BE LIABLE FOR ANY INDIRECT, INCIDENTAL, SPECIAL, CONSEQUENTIAL, OR PUNITIVE DAMAGES ARISING FROM OR RELATED TO YOUR USE OF THE SERVICE.</p>
            <p>OUR TOTAL LIABILITY FOR ANY CLAIM ARISING FROM THESE TERMS OR YOUR USE OF THE SERVICE SHALL NOT EXCEED THE AMOUNT YOU PAID TO US IN THE TWELVE (12) MONTHS PRECEDING THE CLAIM.</p>
          </section>

          <section>
            <h2 className="font-display text-lg font-bold text-t1 mb-3">12. Indemnification</h2>
            <p>You agree to indemnify and hold harmless Financial Holding LLC from any claims, damages, losses, liabilities, and expenses (including reasonable attorney's fees) arising from your use of the Service, your violation of these Terms, or your violation of any third-party rights.</p>
          </section>

          <section>
            <h2 className="font-display text-lg font-bold text-t1 mb-3">13. Termination</h2>
            <p className="mb-2"><span className="font-semibold text-t1">By you:</span> You may cancel your account at any time via Settings. Upon cancellation, your data will be retained for 90 days (to allow re-activation), after which it will be permanently deleted.</p>
            <p><span className="font-semibold text-t1">By us:</span> We may suspend or terminate your account if you violate these Terms, engage in fraudulent activity, fail to pay subscription fees, or if required by law. We will provide reasonable notice before termination except in cases of serious violations.</p>
          </section>

          <section>
            <h2 className="font-display text-lg font-bold text-t1 mb-3">14. Dispute resolution</h2>
            <p className="mb-2">Any disputes arising from these Terms or your use of the Service shall first be addressed through good-faith negotiation. If negotiation fails, disputes will be resolved through binding arbitration administered by the American Arbitration Association (AAA) under its Commercial Arbitration Rules.</p>
            <p>These Terms are governed by the laws of the State of Maryland, United States, without regard to conflict of laws principles.</p>
          </section>

          <section>
            <h2 className="font-display text-lg font-bold text-t1 mb-3">15. Modifications to terms</h2>
            <p>We reserve the right to update these Terms at any time. Material changes will be communicated via the Service and, where appropriate, by email at least 30 days before they take effect. Continued use of the Service after changes take effect constitutes acceptance of the updated Terms.</p>
          </section>

          <section>
            <h2 className="font-display text-lg font-bold text-t1 mb-3">16. Contact</h2>
            <p className="mb-1"><span className="font-semibold text-t1">Email:</span> legal@vaultline.app</p>
            <p><span className="font-semibold text-t1">Entity:</span> Financial Holding LLC, United States</p>
          </section>

        </div>
      </div>
    </div>
  )
}
