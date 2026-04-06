import { useSEO } from '@/hooks/useSEO'
import { Link } from 'react-router-dom'
import ThemeToggle from '@/components/ThemeToggle'

export default function Privacy() {
  useSEO({ title: 'Privacy Policy', description: 'Vaultline privacy policy. How we collect, use, and protect your data. GDPR and CCPA aligned.', canonical: '/privacy' })
  return (
    <div className="min-h-screen bg-void text-t1">
      <nav className="fixed top-0 left-0 right-0 z-50 border-b border-border bg-deep">
        <div className="max-w-4xl mx-auto px-6 h-16 flex items-center justify-between">
          <Link to="/" className="font-display text-xl font-black tracking-tight">Vault<span className="bg-gradient-to-r from-cyan to-purple bg-clip-text text-transparent">line</span></Link>
          <ThemeToggle />
        </div>
      </nav>
      <div className="max-w-3xl mx-auto px-6 pt-28 pb-20">
        <h1 className="font-display text-3xl font-black mb-2">Privacy Policy</h1>
        <p className="text-t2 text-[14px] mb-10">Last updated: April 6, 2026</p>
        <div className="space-y-8 text-[14px] text-t2 leading-relaxed">
          <section>
            <h2 className="font-display text-lg font-bold text-t1 mb-3">1. Introduction</h2>
            <p>Vaultline ("we," "our," or "us"), operated by Financial Holding LLC, provides the cloud treasury management platform at vaultline.app. This Privacy Policy explains how we collect, use, store, and protect your personal and financial information.</p>
            <p className="mt-2">By creating an account or using the Service, you agree to the practices described in this policy.</p>
          </section>
          <section>
            <h2 className="font-display text-lg font-bold text-t1 mb-3">2. Information we collect</h2>
            <p className="mb-2"><span className="font-semibold text-t1">Account information:</span> Name, email address, company name, and password (stored in hashed form via Supabase Auth). If you sign up with Apple or Google, we receive only your email and display name.</p>
            <p className="mb-2"><span className="font-semibold text-t1">Company information:</span> Organization name, industry, size, address, phone, timezone, fiscal year, and default currency.</p>
            <p className="mb-2"><span className="font-semibold text-t1">Financial data:</span> When you connect bank accounts via Plaid, we receive account balances, transaction history, and account metadata. Plaid access tokens are encrypted at rest using pgsodium column-level encryption. We never store your bank login credentials.</p>
            <p className="mb-2"><span className="font-semibold text-t1">Billing information:</span> Payment processing is handled entirely by Stripe, Inc. We do not store credit card numbers on our servers.</p>
            <p className="mb-2"><span className="font-semibold text-t1">Usage data:</span> Pages visited, features used, and session duration, processed by Google Analytics (GA4) only with your cookie consent.</p>
            <p className="mb-2"><span className="font-semibold text-t1">Device data:</span> IP address, browser type, and operating system for security monitoring (login verification, after-hours detection, session anomaly detection).</p>
            <p><span className="font-semibold text-t1">Brand data:</span> If you use brand enrichment, we fetch your company's publicly available logo and theme color from your domain.</p>
          </section>
          <section>
            <h2 className="font-display text-lg font-bold text-t1 mb-3">3. How we use your information</h2>
            <p className="mb-2"><span className="font-semibold text-t1">Service delivery:</span> Real-time cash position monitoring, transaction categorization, forecasting, multi-entity consolidation, and treasury reporting.</p>
            <p className="mb-2"><span className="font-semibold text-t1">Security:</span> Fraud detection, brute force protection, anomaly scanning, session management, and audit trail generation.</p>
            <p className="mb-2"><span className="font-semibold text-t1">Product improvement:</span> Aggregated, anonymized usage analytics to optimize features and performance.</p>
            <p><span className="font-semibold text-t1">Communication:</span> Transactional emails (payment confirmations, security alerts) and, with consent, product updates.</p>
          </section>
          <section>
            <h2 className="font-display text-lg font-bold text-t1 mb-3">4. Data security</h2>
            <p className="mb-2"><span className="font-semibold text-t1">Encryption at rest:</span> Sensitive fields encrypted using pgsodium with Vault-managed keys. Decrypt restricted to service-role only.</p>
            <p className="mb-2"><span className="font-semibold text-t1">Encryption in transit:</span> TLS 1.3 enforced. HSTS with 2-year max-age and preload.</p>
            <p className="mb-2"><span className="font-semibold text-t1">Tenant isolation:</span> Row-Level Security on all tables. No tenant can access another tenant's data.</p>
            <p className="mb-2"><span className="font-semibold text-t1">Authentication:</span> Password complexity enforcement. Account lockout after 5 failed attempts. After-hours login detection.</p>
            <p className="mb-2"><span className="font-semibold text-t1">Display masking:</span> Account numbers and balances masked by default. Reveal events are logged.</p>
            <p className="mb-2"><span className="font-semibold text-t1">Export controls:</span> Re-authentication required. Rate limited to 1 per 24 hours. Account numbers masked in exports. Watermarked with user identity.</p>
            <p className="mb-2"><span className="font-semibold text-t1">Fraud detection:</span> Automated anomaly scanning for transaction velocity, balance anomalies, brute force, data exfiltration, and session hijacking.</p>
            <p><span className="font-semibold text-t1">Security headers:</span> 8 headers deployed including CSP, X-Frame-Options (DENY), HSTS, and Permissions-Policy.</p>
          </section>
          <section>
            <h2 className="font-display text-lg font-bold text-t1 mb-3">5. Data classification</h2>
            <p className="mb-1"><span className="font-semibold text-t1">Public:</span> Marketing content, pricing, documentation.</p>
            <p className="mb-1"><span className="font-semibold text-t1">Internal:</span> Aggregated analytics, system health. Authenticated access only.</p>
            <p className="mb-1"><span className="font-semibold text-t1">Confidential:</span> Transactions, balances, organization details. Org-scoped RLS, encrypted exports.</p>
            <p><span className="font-semibold text-t1">Restricted:</span> Plaid tokens, API keys, encryption keys. Column-encrypted, service-role only, decrypt audit logged.</p>
          </section>
          <section>
            <h2 className="font-display text-lg font-bold text-t1 mb-3">6. Sub-processors</h2>
            <p className="mb-2">We share data with the following services to operate the platform:</p>
            <p className="mb-1"><span className="font-semibold text-t1">Supabase, Inc.</span> — Database, authentication (AWS us-east-1). SOC 2 Type II certified.</p>
            <p className="mb-1"><span className="font-semibold text-t1">Stripe, Inc.</span> — Payment processing. PCI DSS Level 1 certified.</p>
            <p className="mb-1"><span className="font-semibold text-t1">Plaid, Inc.</span> — Bank account linking, balance and transaction sync. SOC 2 Type II certified.</p>
            <p className="mb-1"><span className="font-semibold text-t1">Vercel, Inc.</span> — Hosting, CDN, edge functions. SOC 2 Type II certified.</p>
            <p className="mb-1"><span className="font-semibold text-t1">Google LLC</span> — Analytics (GA4) and advertising (Google Ads). Subject to your cookie consent.</p>
            <p>A complete sub-processor list is available in our <Link to="/legal" className="text-cyan hover:underline">Legal Center</Link>.</p>
          </section>
          <section>
            <h2 className="font-display text-lg font-bold text-t1 mb-3">7. Cookies and tracking</h2>
            <p className="mb-2">We use a cookie consent system requiring explicit approval before setting non-essential cookies.</p>
            <p className="mb-1"><span className="font-semibold text-t1">Functional:</span> Authentication, sessions, theme preferences. Always on.</p>
            <p className="mb-1"><span className="font-semibold text-t1">Analytics:</span> Google Analytics (GA4). Requires consent. Denied by default.</p>
            <p className="mb-1"><span className="font-semibold text-t1">Advertising:</span> Google Ads conversion tracking. Requires consent. Denied by default.</p>
            <p>We honor the Global Privacy Control (GPC) signal. Manage preferences in our <Link to="/legal" className="text-cyan hover:underline">Legal Center</Link>.</p>
          </section>
          <section>
            <h2 className="font-display text-lg font-bold text-t1 mb-3">8. Data retention</h2>
            <p className="mb-1"><span className="font-semibold text-t1">Transaction data:</span> Active subscription + 90 days after cancellation.</p>
            <p className="mb-1"><span className="font-semibold text-t1">Audit logs:</span> 365 days (immutable).</p>
            <p className="mb-1"><span className="font-semibold text-t1">Security events:</span> 180 days.</p>
            <p><span className="font-semibold text-t1">Account data:</span> Until deletion is requested. Permanently removed within 30 days of request.</p>
          </section>
          <section>
            <h2 className="font-display text-lg font-bold text-t1 mb-3">9. Your rights (GDPR)</h2>
            <p className="mb-2">EEA and UK residents have rights under GDPR including access (Art. 15), rectification (Art. 16), erasure (Art. 17), restriction (Art. 18), portability (Art. 20), and objection (Art. 21).</p>
            <p>Exercise your rights via our <Link to="/legal" className="text-cyan hover:underline">Privacy Rights Portal</Link> or email privacy@vaultline.app.</p>
          </section>
          <section>
            <h2 className="font-display text-lg font-bold text-t1 mb-3">10. Your rights (CCPA/CPRA)</h2>
            <p className="mb-2">California residents have rights to know, delete, and opt-out of sale/sharing. Vaultline does not sell personal information. Opt out of data sharing via our <Link to="/legal" className="text-cyan hover:underline">Do Not Sell or Share</Link> page.</p>
            <p>We respond to CCPA requests within 45 days.</p>
          </section>
          <section>
            <h2 className="font-display text-lg font-bold text-t1 mb-3">11. Automated decision-making</h2>
            <p>Our fraud detection system uses automated anomaly scanning to identify suspicious activity. Automated checks may temporarily restrict actions pending review. No automated decisions produce legal effects without human review.</p>
          </section>
          <section>
            <h2 className="font-display text-lg font-bold text-t1 mb-3">12. International transfers</h2>
            <p>Data is stored and processed in the United States (AWS us-east-1). We rely on Standard Contractual Clauses and sub-processor certifications for international transfer compliance.</p>
          </section>
          <section>
            <h2 className="font-display text-lg font-bold text-t1 mb-3">13. Children's privacy</h2>
            <p>Vaultline is a B2B service not directed at individuals under 18. We do not knowingly collect data from children.</p>
          </section>
          <section>
            <h2 className="font-display text-lg font-bold text-t1 mb-3">14. Breach notification</h2>
            <p>In the event of a breach affecting your data, we will notify the relevant supervisory authority within 72 hours (GDPR Art. 33) and notify you directly if the breach poses high risk to your rights (GDPR Art. 34).</p>
          </section>
          <section>
            <h2 className="font-display text-lg font-bold text-t1 mb-3">15. Changes to this policy</h2>
            <p>We may update this policy to reflect changes in practices or legal requirements. Material changes will be communicated via the Service and, where appropriate, by email.</p>
          </section>
          <section>
            <h2 className="font-display text-lg font-bold text-t1 mb-3">16. Contact</h2>
            <p className="mb-1"><span className="font-semibold text-t1">Email:</span> privacy@vaultline.app</p>
            <p className="mb-1"><span className="font-semibold text-t1">Privacy portal:</span> <Link to="/legal" className="text-cyan hover:underline">vaultline.app/legal</Link></p>
            <p><span className="font-semibold text-t1">Entity:</span> Financial Holding LLC, United States</p>
          </section>
        </div>
      </div>
    </div>
  )
}
