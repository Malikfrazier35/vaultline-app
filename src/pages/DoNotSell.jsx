import { Shield, CheckCircle2, ExternalLink } from 'lucide-react'
import { Link } from 'react-router-dom'
import { useSEO } from '@/hooks/useSEO'

export default function DoNotSell() {
  useSEO({ title: 'Do Not Sell My Information', description: 'Vaultline does not sell or share your personal information. Learn about our privacy practices.', canonical: '/do-not-sell' })

  return (
    <div className="min-h-screen bg-void">
      <nav className="flex items-center justify-between px-6 py-4 border-b border-border">
        <Link to="/" className="flex items-center gap-2">
          <div className="w-8 h-8 rounded-lg bg-gradient-to-br from-cyan to-purple flex items-center justify-center">
            <Shield size={16} className="text-white" />
          </div>
          <span className="font-display text-lg font-black">Vault<span className="text-cyan">line</span></span>
        </Link>
      </nav>

      <div className="max-w-2xl mx-auto px-6 py-16">
        <h1 className="text-3xl font-black tracking-tight mb-2">Do Not Sell or Share My Personal Information</h1>
        <p className="text-t3 text-[14px] mb-8">California Consumer Privacy Act (CCPA) Disclosure</p>

        <div className="glass-card rounded-xl p-6 mb-8 border-green/[0.15]">
          <div className="flex items-start gap-3">
            <CheckCircle2 size={20} className="text-green mt-0.5 shrink-0" />
            <div>
              <h2 className="font-bold text-lg mb-1">Vaultline does not sell your personal information.</h2>
              <p className="text-t3 text-[14px] leading-relaxed">
                We have never sold personal information and have no plans to do so. Your financial data, account information, 
                and usage data are used solely to provide and improve the Vaultline treasury management service.
              </p>
            </div>
          </div>
        </div>

        <div className="space-y-6 text-[14px] text-t2 leading-relaxed">
          <div>
            <h3 className="font-semibold text-t1 mb-2">What we collect</h3>
            <p>We collect the minimum data necessary to operate the service: your name, email, company name, 
            bank account data (via Plaid), and usage analytics. Full details are in our <Link to="/privacy" className="text-cyan hover:underline">Privacy Policy</Link>.</p>
          </div>

          <div>
            <h3 className="font-semibold text-t1 mb-2">Service providers we share data with</h3>
            <p className="mb-2">We share data with these service providers to operate Vaultline. These are not "sales" under CCPA — they are service providers bound by data processing agreements:</p>
            <ul className="space-y-1 ml-4">
              <li className="flex items-center gap-2"><span className="w-1.5 h-1.5 rounded-full bg-cyan shrink-0" /> <span><strong>Plaid</strong> — bank account connectivity</span></li>
              <li className="flex items-center gap-2"><span className="w-1.5 h-1.5 rounded-full bg-cyan shrink-0" /> <span><strong>Stripe</strong> — payment processing</span></li>
              <li className="flex items-center gap-2"><span className="w-1.5 h-1.5 rounded-full bg-cyan shrink-0" /> <span><strong>Supabase</strong> — database and authentication</span></li>
              <li className="flex items-center gap-2"><span className="w-1.5 h-1.5 rounded-full bg-cyan shrink-0" /> <span><strong>Vercel</strong> — application hosting</span></li>
              <li className="flex items-center gap-2"><span className="w-1.5 h-1.5 rounded-full bg-cyan shrink-0" /> <span><strong>Anthropic</strong> — AI copilot processing</span></li>
              <li className="flex items-center gap-2"><span className="w-1.5 h-1.5 rounded-full bg-cyan shrink-0" /> <span><strong>Resend</strong> — transactional email delivery</span></li>
            </ul>
          </div>

          <div>
            <h3 className="font-semibold text-t1 mb-2">Your rights under CCPA</h3>
            <ul className="space-y-1 ml-4">
              <li className="flex items-start gap-2"><span className="w-1.5 h-1.5 rounded-full bg-green mt-2 shrink-0" /> <span><strong>Right to know</strong> — request what data we have about you</span></li>
              <li className="flex items-start gap-2"><span className="w-1.5 h-1.5 rounded-full bg-green mt-2 shrink-0" /> <span><strong>Right to delete</strong> — request deletion of your data</span></li>
              <li className="flex items-start gap-2"><span className="w-1.5 h-1.5 rounded-full bg-green mt-2 shrink-0" /> <span><strong>Right to opt-out</strong> — opt out of sale of personal information (we don't sell, but you can confirm this)</span></li>
              <li className="flex items-start gap-2"><span className="w-1.5 h-1.5 rounded-full bg-green mt-2 shrink-0" /> <span><strong>Right to non-discrimination</strong> — we will not discriminate against you for exercising these rights</span></li>
            </ul>
          </div>

          <div>
            <h3 className="font-semibold text-t1 mb-2">How to exercise your rights</h3>
            <p>To request data access, data deletion, or to exercise any CCPA right, email <a href="mailto:privacy@vaultline.app" className="text-cyan hover:underline">privacy@vaultline.app</a> or use the account deletion and data export features in your <Link to="/settings" className="text-cyan hover:underline">Settings</Link> page.</p>
          </div>

          <div>
            <h3 className="font-semibold text-t1 mb-2">Opt out of analytics</h3>
            <p>You can opt out of behavioral analytics tracking in your <Link to="/settings" className="text-cyan hover:underline">Settings</Link> page under "Privacy & Data."</p>
          </div>
        </div>

        <p className="text-t3 text-[12px] mt-12 pt-6 border-t border-border">Last updated: April 2026. Financial Holding LLC.</p>
      </div>
    </div>
  )
}
