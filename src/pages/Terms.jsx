import { useSEO } from '@/hooks/useSEO'
import { Link } from 'react-router-dom'
import ThemeToggle from '@/components/ThemeToggle'

export default function Terms() {
  useSEO({ title: 'Terms of Service', description: 'Vaultline terms of service. Subscription terms, acceptable use, data ownership, and service level commitments.', canonical: '/terms' })
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
        <h1 className="font-display text-3xl font-black mb-2">Terms of Service</h1>
        <p className="text-t2 text-[14px] mb-10">Last updated: March 15, 2026</p>

        <div className="space-y-8 text-[15px] text-t2 leading-relaxed">
          <section>
            <h2 className="font-display text-lg font-bold text-t1 mb-3">1. Acceptance of Terms</h2>
            <p>By accessing or using the Vaultline treasury management platform ("Service"), you agree to be bound by these Terms of Service ("Terms"). If you are using the Service on behalf of a company or organization, you represent that you have the authority to bind that entity to these Terms. If you do not agree to these Terms, do not use the Service.</p>
          </section>

          <section>
            <h2 className="font-display text-lg font-bold text-t1 mb-3">2. Description of Service</h2>
            <p>Vaultline provides a cloud-based treasury management platform that aggregates bank account data, provides cash flow forecasting, AI-powered financial analysis, team collaboration tools, and integrations with third-party financial services including Plaid, QuickBooks Online, and Stripe. The Service is designed for business use by finance and treasury teams.</p>
          </section>

          <section>
            <h2 className="font-display text-lg font-bold text-t1 mb-3">3. Account Registration</h2>
            <p>To use the Service, you must create an account with accurate and complete information. You are responsible for maintaining the confidentiality of your account credentials and for all activity under your account. You must notify us immediately of any unauthorized access or use of your account.</p>
          </section>

          <section>
            <h2 className="font-display text-lg font-bold text-t1 mb-3">4. Subscription Plans and Payment</h2>
            <p className="mb-2">The Service is offered under subscription plans (Starter, Growth, Enterprise) with pricing as displayed on the billing page. All fees are billed in advance on a monthly or annual basis through Stripe.</p>
            <p className="mb-2">You authorize us to charge your payment method for the applicable subscription fees. If payment fails, we may suspend access to the Service until payment is received. Subscription fees are non-refundable except as required by law or as specified in our 14-day money-back guarantee.</p>
            <p>We reserve the right to modify pricing with 30 days' notice. Existing subscriptions will not be affected until renewal.</p>
          </section>

          <section>
            <h2 className="font-display text-lg font-bold text-t1 mb-3">5. Permitted Use</h2>
            <p className="mb-3">You agree to use the Service only for lawful business purposes and in accordance with these Terms. You may not:</p>
            <p className="mb-1">• Reverse engineer, decompile, or disassemble any part of the Service</p>
            <p className="mb-1">• Use the Service to process data for third parties without authorization</p>
            <p className="mb-1">• Attempt to gain unauthorized access to other users' accounts or data</p>
            <p className="mb-1">• Use automated means to access the Service beyond the provided API</p>
            <p className="mb-1">• Transmit malicious code or interfere with the Service's operation</p>
            <p>• Resell, sublicense, or redistribute the Service without written consent</p>
          </section>

          <section>
            <h2 className="font-display text-lg font-bold text-t1 mb-3">6. Data Ownership</h2>
            <p>You retain all ownership rights to your financial data. By using the Service, you grant Vaultline a limited, non-exclusive license to process, store, and display your data solely to provide and improve the Service. We do not claim ownership of your data and will not use it for purposes other than operating the Service.</p>
          </section>

          <section>
            <h2 className="font-display text-lg font-bold text-t1 mb-3">7. Third-Party Integrations</h2>
            <p className="mb-2">The Service integrates with third-party platforms including Plaid, Intuit QuickBooks Online, and Stripe. Your use of these integrations is subject to the respective third party's terms of service and privacy policies.</p>
            <p className="mb-2">By connecting QuickBooks Online, you authorize Vaultline to access your QuickBooks accounting data (accounts, invoices, bills, purchases) via OAuth 2.0 for the purpose of providing treasury management features. You may revoke this access at any time.</p>
            <p>We are not responsible for the availability, accuracy, or security of third-party services. If a third-party integration becomes unavailable, we will make reasonable efforts to notify affected users.</p>
          </section>

          <section>
            <h2 className="font-display text-lg font-bold text-t1 mb-3">8. Intellectual Property</h2>
            <p>The Service, including its design, features, code, documentation, and branding, is owned by Vaultline and protected by intellectual property laws. These Terms grant you a limited, revocable, non-transferable license to use the Service for its intended purpose during your active subscription.</p>
          </section>

          <section>
            <h2 className="font-display text-lg font-bold text-t1 mb-3">9. AI Copilot</h2>
            <p>The Service includes an AI-powered treasury copilot that provides financial analysis and recommendations based on your data. AI-generated insights are for informational purposes only and do not constitute financial, tax, legal, or investment advice. You are responsible for all financial decisions made using the Service. Vaultline is not liable for any losses resulting from reliance on AI-generated content.</p>
          </section>

          <section>
            <h2 className="font-display text-lg font-bold text-t1 mb-3">10. Service Availability</h2>
            <p>We strive to maintain high availability but do not guarantee uninterrupted access. The Service may be temporarily unavailable due to maintenance, updates, or circumstances beyond our control. Enterprise plan customers receive a Service Level Agreement (SLA) with defined uptime guarantees as specified in their subscription terms.</p>
          </section>

          <section>
            <h2 className="font-display text-lg font-bold text-t1 mb-3">11. Limitation of Liability</h2>
            <p>TO THE MAXIMUM EXTENT PERMITTED BY LAW, VAULTLINE SHALL NOT BE LIABLE FOR ANY INDIRECT, INCIDENTAL, SPECIAL, CONSEQUENTIAL, OR PUNITIVE DAMAGES, OR ANY LOSS OF PROFITS OR REVENUES, WHETHER INCURRED DIRECTLY OR INDIRECTLY, OR ANY LOSS OF DATA, USE, GOODWILL, OR OTHER INTANGIBLE LOSSES, RESULTING FROM YOUR USE OR INABILITY TO USE THE SERVICE. OUR TOTAL LIABILITY SHALL NOT EXCEED THE AMOUNT PAID BY YOU TO VAULTLINE IN THE 12 MONTHS PRECEDING THE CLAIM.</p>
          </section>

          <section>
            <h2 className="font-display text-lg font-bold text-t1 mb-3">12. Disclaimer of Warranties</h2>
            <p>THE SERVICE IS PROVIDED "AS IS" AND "AS AVAILABLE" WITHOUT WARRANTIES OF ANY KIND, WHETHER EXPRESS OR IMPLIED, INCLUDING BUT NOT LIMITED TO IMPLIED WARRANTIES OF MERCHANTABILITY, FITNESS FOR A PARTICULAR PURPOSE, AND NON-INFRINGEMENT. WE DO NOT WARRANT THAT FINANCIAL DATA DISPLAYED IN THE SERVICE IS COMPLETE, ACCURATE, OR CURRENT AT ALL TIMES.</p>
          </section>

          <section>
            <h2 className="font-display text-lg font-bold text-t1 mb-3">13. Termination</h2>
            <p>You may cancel your subscription at any time through the billing page or by contacting us. We may terminate or suspend your access if you violate these Terms, fail to pay subscription fees, or engage in activity that threatens the security or integrity of the Service. Upon termination, your right to use the Service ceases immediately. You may request export of your data within 30 days of termination.</p>
          </section>

          <section>
            <h2 className="font-display text-lg font-bold text-t1 mb-3">14. Governing Law</h2>
            <p>These Terms shall be governed by and construed in accordance with the laws of the State of Connecticut, without regard to its conflict of law provisions. Any disputes arising under these Terms shall be resolved in the state or federal courts located in Connecticut.</p>
          </section>

          <section>
            <h2 className="font-display text-lg font-bold text-t1 mb-3">15. Changes to Terms</h2>
            <p>We reserve the right to modify these Terms at any time. Material changes will be communicated via email or in-app notification at least 30 days before taking effect. Continued use of the Service after changes become effective constitutes acceptance of the revised Terms.</p>
          </section>

          <section>
            <h2 className="font-display text-lg font-bold text-t1 mb-3">16. Contact</h2>
            <p>For questions about these Terms, contact us at:</p>
            <p className="mt-2 text-[14px] text-cyan">legal@vaultline.app</p>
          </section>
        </div>
      </div>
    </div>
  )
}
