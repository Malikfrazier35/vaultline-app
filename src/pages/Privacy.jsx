import { useSEO } from '@/hooks/useSEO'
import { Link } from 'react-router-dom'
import ThemeToggle from '@/components/ThemeToggle'

export default function Privacy() {
  useSEO({ title: 'Privacy Policy', description: 'Vaultline privacy policy. How we collect, use, and protect your data. GDPR and CCPA compliant.', canonical: '/privacy' })
  return (
    <div className="min-h-screen bg-void text-t1">
      <nav className="fixed top-0 left-0 right-0 z-50 border-b border-border bg-deep">
        <div className="max-w-4xl mx-auto px-6 h-16 flex items-center justify-between">
          <Link to="/" className="font-display text-xl font-black tracking-tight">
            Vault<span className="bg-gradient-to-r from-cyan to-purple bg-clip-text text-transparent">line</span>
          </Link>
          <ThemeToggle />
        </div>
      </nav>

      <div className="max-w-3xl mx-auto px-6 pt-28 pb-20">
        <h1 className="font-display text-3xl font-black mb-2">Privacy Policy</h1>
        <p className="text-t2 text-[14px] mb-10">Last updated: March 15, 2026</p>

        <div className="space-y-8 text-[15px] text-t2 leading-relaxed">
          <section>
            <h2 className="font-display text-lg font-bold text-t1 mb-3">1. Introduction</h2>
            <p>Vaultline ("we," "our," or "us") operates the Vaultline treasury management platform located at www.vaultline.app (the "Service"). This Privacy Policy explains how we collect, use, disclose, and safeguard your information when you use our Service.</p>
          </section>

          <section>
            <h2 className="font-display text-lg font-bold text-t1 mb-3">2. Information We Collect</h2>
            <p className="mb-3">We collect the following types of information:</p>
            <p className="mb-2"><span className="font-semibold text-t1">Account Information:</span> When you create an account, we collect your name, email address, company name, and password (stored in hashed form).</p>
            <p className="mb-2"><span className="font-semibold text-t1">Financial Data:</span> When you connect bank accounts via Plaid or QuickBooks Online, we receive account names, balances, and transaction histories. We use Plaid Inc. and Intuit Inc. as authorized data intermediaries. We do not store your banking credentials.</p>
            <p className="mb-2"><span className="font-semibold text-t1">Billing Information:</span> Payment processing is handled by Stripe, Inc. We do not store credit card numbers on our servers. We receive only transaction confirmation data (plan type, payment status).</p>
            <p><span className="font-semibold text-t1">Usage Data:</span> We collect information about how you interact with the Service, including pages visited, features used, and copilot queries.</p>
          </section>

          <section>
            <h2 className="font-display text-lg font-bold text-t1 mb-3">3. How We Use Your Information</h2>
            <p className="mb-3">We use collected information to:</p>
            <p className="mb-1">• Provide, maintain, and improve the Service</p>
            <p className="mb-1">• Display your treasury data, generate forecasts, and power the AI copilot</p>
            <p className="mb-1">• Process transactions and manage billing</p>
            <p className="mb-1">• Send service-related notifications and alerts</p>
            <p className="mb-1">• Detect, prevent, and address security issues</p>
            <p>• Comply with legal obligations</p>
          </section>

          <section>
            <h2 className="font-display text-lg font-bold text-t1 mb-3">4. Third-Party Services</h2>
            <p className="mb-3">We integrate with the following third-party services that may have access to your data:</p>
            <p className="mb-2"><span className="font-semibold text-t1">Plaid Inc.</span> — Facilitates bank account connections. Subject to the <a href="https://plaid.com/legal/" target="_blank" rel="noopener noreferrer" className="text-cyan hover:underline">Plaid Privacy Policy</a>.</p>
            <p className="mb-2"><span className="font-semibold text-t1">Intuit Inc. (QuickBooks Online)</span> — Syncs accounting data via OAuth 2.0. Subject to the <a href="https://www.intuit.com/privacy/" target="_blank" rel="noopener noreferrer" className="text-cyan hover:underline">Intuit Privacy Statement</a>. We access QuickBooks data only with your explicit authorization and only for the purposes of displaying and analyzing your financial data within Vaultline.</p>
            <p className="mb-2"><span className="font-semibold text-t1">Stripe, Inc.</span> — Processes subscription payments. Subject to the <a href="https://stripe.com/privacy" target="_blank" rel="noopener noreferrer" className="text-cyan hover:underline">Stripe Privacy Policy</a>.</p>
            <p className="mb-2"><span className="font-semibold text-t1">Anthropic, PBC</span> — Powers the AI treasury copilot. Your financial data is sent to Claude for analysis during copilot conversations only. We do not use your data to train AI models.</p>
            <p><span className="font-semibold text-t1">Supabase, Inc.</span> — Provides database hosting and authentication infrastructure.</p>
          </section>

          <section>
            <h2 className="font-display text-lg font-bold text-t1 mb-3">5. Data Security</h2>
            <p>We implement industry-standard security measures including encryption in transit (TLS 1.3), encryption at rest, row-level security policies isolating each organization's data, and secure token storage for third-party integrations. Access tokens for Plaid and QuickBooks are stored server-side and never exposed to the client application. Despite these measures, no method of electronic transmission or storage is 100% secure.</p>
          </section>

          <section>
            <h2 className="font-display text-lg font-bold text-t1 mb-3">6. Data Retention</h2>
            <p>We retain your financial data for as long as your account is active or as needed to provide the Service. When you disconnect a bank account or QuickBooks connection, we stop syncing new data but retain previously synced data unless you request deletion. You may request deletion of your account and all associated data at any time by contacting us.</p>
          </section>

          <section>
            <h2 className="font-display text-lg font-bold text-t1 mb-3">7. Data Sharing</h2>
            <p>We do not sell your personal information or financial data. We share data only with the third-party service providers listed in Section 4, and only to the extent necessary to operate the Service. We may disclose information if required by law, regulation, or legal process.</p>
          </section>

          <section>
            <h2 className="font-display text-lg font-bold text-t1 mb-3">8. Your Rights</h2>
            <p className="mb-3">You have the right to:</p>
            <p className="mb-1">• Access your personal data stored in Vaultline</p>
            <p className="mb-1">• Correct inaccurate information</p>
            <p className="mb-1">• Delete your account and associated data</p>
            <p className="mb-1">• Disconnect third-party integrations at any time</p>
            <p>• Export your data in a machine-readable format</p>
          </section>

          <section>
            <h2 className="font-display text-lg font-bold text-t1 mb-3">9. QuickBooks Online Data Use</h2>
            <p>When you connect QuickBooks Online to Vaultline, we access your accounting data (accounts, invoices, bills, purchases) solely to provide treasury management features within our Service. We do not share your QuickBooks data with any parties other than those listed in Section 4. You may disconnect QuickBooks at any time from the Import Data page, which will stop all future data syncing.</p>
          </section>

          <section>
            <h2 className="font-display text-lg font-bold text-t1 mb-3">10. Children's Privacy</h2>
            <p>The Service is not intended for individuals under the age of 18. We do not knowingly collect personal information from children.</p>
          </section>

          <section>
            <h2 className="font-display text-lg font-bold text-t1 mb-3">11. Changes to This Policy</h2>
            <p>We may update this Privacy Policy from time to time. We will notify you of material changes by posting the new policy on this page and updating the "Last updated" date. Continued use of the Service after changes constitutes acceptance of the updated policy.</p>
          </section>

          <section>
            <h2 className="font-display text-lg font-bold text-t1 mb-3">12. Contact Us</h2>
            <p>If you have questions about this Privacy Policy or our data practices, contact us at:</p>
            <p className="mt-2 text-[14px] text-cyan">privacy@vaultline.app</p>
          </section>
        </div>
      </div>
    </div>
  )
}
