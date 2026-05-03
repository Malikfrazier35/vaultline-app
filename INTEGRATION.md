# Vaultline — Reports + Seats + Pricing + Billing Integration

Final drop. Apply in order. Should take ~45 minutes start to finish.

---

## What's in this build

```
src/
├── styles/print.css                          [NEW]  Treasury-grade print stylesheet
├── components/PrintButton.jsx                [NEW]  Print button for any page
├── pages/
│   ├── Reports.jsx                           [NEW]  /reports page
│   ├── Pricing.jsx                           [NEW]  Public pricing page (rebuild)
│   ├── Billing.jsx                           [NEW]  In-app billing — REPLACES existing
│   ├── Team.jsx                              [NEW]  Settings/team — seat management
│   └── print/CashMemoTemplate.jsx            [NEW]  Daily Cash Position memo
supabase/
└── functions/generate-report/index.ts        [NEW]  PDF orchestration via Browserless

INTEGRATION.md (this file)
STRIPE_SETUP.md                               14-day trial config + dup-account defense
```

---

## DB migrations (already applied to your Supabase)

✅ `reports_infrastructure` — reports + report_schedules tables, branding columns, Storage bucket  
✅ `seat_management_infrastructure` — plan_seat_limits, seat counts view, can_add_seat() function

---

## Step 1 — Add the new files

Click **Add file → Create new file** on GitHub for each path. Paste contents from this build folder.

Note: `Billing.jsx` REPLACES your existing one. The current in-app /billing page has wrong pricing (Enterprise $2,499 instead of $3,499), wrong feature distribution (Multi-entity on Growth — should be Enterprise-only), and no seat info. The new file fixes all three.

---

## Step 2 — Wire print CSS globally

In `src/main.jsx`, add near other CSS imports:

```jsx
import './styles/print.css'
```

---

## Step 3 — Add routes to App.jsx

```jsx
import Reports from '@/pages/Reports'
import Pricing from '@/pages/Pricing'
import Team from '@/pages/Team'
import Billing from '@/pages/Billing'
import CashMemoTemplate from '@/pages/print/CashMemoTemplate'

<Route path="/pricing" element={<Pricing />} />
<Route path="/reports" element={
  <ProtectedRoute><Layout><Reports /></Layout></ProtectedRoute>
} />
<Route path="/billing" element={
  <ProtectedRoute><Layout><Billing /></Layout></ProtectedRoute>
} />
<Route path="/settings/team" element={
  <ProtectedRoute><Layout><Team /></Layout></ProtectedRoute>
} />

{/* Print template: NO Layout wrapper — Puppeteer needs clean render */}
<Route path="/print/cash-memo/:orgId/:date" element={<CashMemoTemplate />} />
```

---

## Step 4 — Add Reports + Team to navigation

Sidebar, under Operations:

```jsx
import { FileText, Users } from 'lucide-react'

<NavLink to="/reports"><FileText size={16} /> Reports</NavLink>
<NavLink to="/settings/team"><Users size={16} /> Team</NavLink>
```

---

## Step 5 — Remove the old support Copilot bubble

You have two Copilots overlapping. The new Treasury Copilot panel (right side, with Pinned Insights and Quick Analysis) is the keeper. The small floating bubble in the bottom-right is legacy code.

Find and remove the old one:

```bash
cd ~/Desktop/vaultline-repo
grep -rn "CopilotBubble\|SupportChat\|chat-fab\|copilot-fab\|copilot-trigger" src/
```

Remove the mount line from wherever it appears (likely `Layout.jsx` or `App.jsx`). Don't delete the file yet in case you want to revert — just unmount it.

---

## Step 6 — Browserless setup (for PDF generation)

Sign up: https://www.browserless.io

Add to Supabase secrets (https://supabase.com/dashboard/project/cosbviiihkxjdqcpksgv/functions/secrets):
- `BROWSERLESS_TOKEN` = your token
- `APP_URL` = `https://vaultline.app`

---

## Step 7 — Update Stripe products + 14-day trial

See `STRIPE_SETUP.md` for the full setup. Critical bits:
- Update Enterprise from $2,499 → $3,499 monthly ($2,799 annual)
- Each Price needs `plan` metadata key (`starter`, `growth`, or `enterprise`)
- Configure `trial_period_days: 14` + `payment_method_collection: 'always'` in stripe-checkout edge function
- Block consumer email domains in Signup.jsx form

---

## Step 8 — Deploy

```bash
cd ~/Desktop/vaultline-repo
git pull
npx supabase functions deploy generate-report --project-ref cosbviiihkxjdqcpksgv --no-verify-jwt
# If you also updated stripe-checkout for trials:
npx supabase functions deploy stripe-checkout --project-ref cosbviiihkxjdqcpksgv --no-verify-jwt
```

---

## Step 9 — Add `invitations` table if missing

```sql
CREATE TABLE IF NOT EXISTS public.invitations (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  org_id uuid NOT NULL REFERENCES organizations(id) ON DELETE CASCADE,
  email text NOT NULL,
  role text NOT NULL CHECK (role IN ('admin', 'member', 'viewer')),
  invited_by uuid REFERENCES auth.users(id),
  status text NOT NULL DEFAULT 'pending' CHECK (status IN ('pending', 'accepted', 'expired', 'revoked')),
  token text UNIQUE NOT NULL DEFAULT encode(gen_random_bytes(32), 'hex'),
  expires_at timestamptz NOT NULL DEFAULT (now() + interval '7 days'),
  created_at timestamptz DEFAULT now(),
  accepted_at timestamptz
);
ALTER TABLE public.invitations ENABLE ROW LEVEL SECURITY;
CREATE POLICY invitations_org ON invitations FOR ALL
  USING (org_id IN (SELECT org_id FROM profiles WHERE id = auth.uid()));
```

---

## Verification checklist

**Reports**
- [ ] `/reports` loads with 3 report cards
- [ ] Click Preview → opens treasury memo at `/print/cash-memo/...`
- [ ] Click Generate → row appears, status flips to completed in 5–10s
- [ ] Click Download → PDF opens
- [ ] Cmd+P on /home prints cleanly without app chrome

**Pricing (public)**
- [ ] `/pricing` shows 3 tiers with seat structure
- [ ] Annual/monthly toggle works
- [ ] Comparison table loads
- [ ] FAQ shows seat questions

**Billing (in-app)**
- [ ] `/billing` shows current plan badge + 3 seat usage cards at top
- [ ] 4 tier cards: Starter, Growth, Enterprise, Custom
- [ ] Enterprise shows $3,499 (not $2,499)
- [ ] Growth does NOT show "Multi-entity support"
- [ ] Annual/monthly toggle works
- [ ] Bottom assurances show "14-day free trial · Cancel anytime · Instant access"
- [ ] Current plan card is highlighted with cyan border + "Current plan" badge

**Team**
- [ ] `/settings/team` shows seat usage cards
- [ ] Invite modal opens
- [ ] Selecting 'viewer' on Starter is blocked with upgrade prompt
- [ ] Approaching cap shows amber warning
- [ ] Hitting cap blocks invite with upgrade CTA

**Copilot cleanup**
- [ ] No more floating bubble in bottom-right
- [ ] Treasury Copilot panel still works (right-side panel)

---

## What's NOT in this drop (intentionally deferred)

| Feature | Why deferred |
|---|---|
| Login/Signup UX rebuild + consumer email blocker + duplicate-domain detector | Deserves dedicated session — these need mockups + the existing signup flow audit |
| Weekly Cash Flash PDF template | 1hr add once CashMemoTemplate is validated |
| Scheduled auto-generation (daily 7am) | Needs pg_cron + email — separate session |
| Stripe metered usage records for seat overage | Reconcile manually until 5+ paying customers |
| `invite-user` edge function | Tell me if you don't already have one |
| Stripe webhook end-to-end re-test | Resend a real event from Stripe dashboard to verify subscription_id populates |

---

## Strategic notes

### Seat structure (locked in)
- Starter: 3 full / 0 read-only / cap 10 / +$49 overage  
- Growth: 10 full / 5 read-only (then unlimited free) / cap 50 / +$39 overage  
- Enterprise: 25 full / unlimited read-only / no caps / +$29 overage  
- Custom: Talk to sales

### Pricing locked in
- Starter: $499 mo / $399 yr
- Growth: $1,499 mo / $1,199 yr
- Enterprise: $3,499 mo / $2,799 yr (UPDATED from $2,499)

### Trial model (decided)
- 14-day free trial with credit card required upfront
- Auto-charge on day 15 unless cancelled
- Stripe Radar + consumer email block + duplicate domain detection prevent abuse
- More transparent for new product than money-back guarantee

### Copilot
- Keep the new Treasury Copilot panel (Pinned Insights, Quick Analysis, etc.)
- Remove the old floating bubble — it's redundant
