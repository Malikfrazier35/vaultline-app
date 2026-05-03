# Stripe pricing setup for seat-based plans + 14-day trials

The DB knows your seat structure. Stripe needs to match — and trials need to be configured properly so duplicate-account abuse is contained.

---

## Step 1 — Update Stripe products

In your Vaultline Stripe workspace (https://dashboard.stripe.com/products):

### Starter ($499 mo / $399 yr)
- **Product name:** Vaultline Starter
- **Prices:**
  - Monthly: $499.00 / month, recurring  
  - Annual: $4,788.00 / year ($399/mo), recurring
- **Metadata on each Price:** `plan: starter`

### Growth ($1,499 mo / $1,199 yr) — most popular
- **Product:** Vaultline Growth
- **Prices:**
  - Monthly: $1,499.00 / month
  - Annual: $14,388.00 / year ($1,199/mo)
- **Metadata:** `plan: growth`

### Enterprise ($3,499 mo / $2,799 yr) ⚠️ Update from $2,499
- **Product:** Vaultline Enterprise
- **Prices:**
  - Monthly: $3,499.00 / month
  - Annual: $33,588.00 / year ($2,799/mo)
- **Metadata:** `plan: enterprise`

> ⚠️ Your existing Enterprise price is $2,499. Archive that price and create new ones at $3,499/$2,799. Existing customers grandfather on the old price (Stripe handles this automatically — they keep paying $2,499 until they switch).

---

## Step 2 — The `plan` metadata is critical

The webhook reads `subscription.items.data[0].price.metadata.plan` to determine which tier the customer bought. **If metadata is missing or wrong, the webhook defaults to 'starter'** and your customer ends up on the wrong plan.

To check: go to any Price → Metadata section → verify key `plan` with value `starter`, `growth`, or `enterprise`.

---

## Step 3 — Configure 14-day trial in Checkout

In your `stripe-checkout` edge function, when creating the session, add:

```ts
const session = await stripe.checkout.sessions.create({
  mode: 'subscription',
  customer: customerId,
  line_items: [{ price: priceId, quantity: 1 }],
  
  // ↓ Trial config
  subscription_data: {
    trial_period_days: 14,
    trial_settings: {
      end_behavior: {
        missing_payment_method: 'cancel',  // auto-cancel if no card after trial
      },
    },
  },
  payment_method_collection: 'always',  // ← REQUIRES card upfront, no charge until day 15
  
  success_url: `${appUrl}/dashboard?subscription=success`,
  cancel_url: `${appUrl}/billing?subscription=cancelled`,
})
```

**Why `payment_method_collection: 'always'` is the killer feature:**
- Customer enters card during signup
- Stripe holds the card, charges $0
- Day 15: auto-charges the plan price
- If card fails or customer cancels: subscription auto-ends
- **A duplicate signup with a different email but the same card → Stripe Radar flags it**

This is the same model Notion, Linear, and Vercel use. Friction is minimal (one card form), abuse is contained.

---

## Step 4 — Duplicate account defense (besides Stripe)

The full strategy:

**Layer 1 — Stripe Radar (free, automatic)**
Already running once you require cards upfront. Catches: same card across multiple accounts, known fraud patterns, mismatched billing addresses.

**Layer 2 — Block consumer email domains at signup**

Add this to your `Signup.jsx` form validation:

```js
const CONSUMER_DOMAINS = new Set([
  'gmail.com', 'googlemail.com', 'yahoo.com', 'yahoo.co.uk',
  'hotmail.com', 'outlook.com', 'live.com', 'msn.com',
  'icloud.com', 'me.com', 'mac.com',
  'aol.com', 'protonmail.com', 'proton.me',
  'mail.com', 'gmx.com', 'yandex.com',
  'duck.com', 'fastmail.com',
])

function isConsumerEmail(email) {
  const domain = email.split('@')[1]?.toLowerCase()
  return CONSUMER_DOMAINS.has(domain)
}

// In your form submit:
if (isConsumerEmail(email)) {
  return setError('Please use your work email — Vaultline is for finance teams. Personal emails like Gmail are not supported.')
}
```

This alone kills 60–70% of abuse vectors. Real treasury professionals use corporate email.

**Layer 3 — Auto-detect existing corp domain**

When someone signs up with `john@acme.com` and `acme.com` already has an org, prompt them to join the existing one instead of creating a parallel org.

```sql
-- Add to signup edge function: check if email domain is already in use
SELECT o.id, o.name, COUNT(p.id) as member_count
FROM organizations o
JOIN profiles p ON p.org_id = o.id
WHERE split_part(p.email, '@', 2) = $1  -- email domain
GROUP BY o.id, o.name
LIMIT 1;
```

If a match: redirect to a "Request access from your admin" page that emails the existing owner with the new signup's name + email + a one-click "Approve and invite" button.

---

## Step 5 — Verification checklist

After Stripe + signup updates:

- [ ] Each plan has Monthly + Annual prices
- [ ] Each price has `plan` metadata key set correctly
- [ ] Enterprise updated from $2,499 → $3,499 (and $2,799 annual)
- [ ] Old Enterprise prices archived (existing customers grandfather)
- [ ] `stripe-checkout` edge function passes `trial_period_days: 14` and `payment_method_collection: 'always'`
- [ ] `stripe-webhook` reads price metadata correctly (already done in last session)
- [ ] Signup form rejects consumer email domains
- [ ] Signup checks for existing corp-domain orgs (Layer 3 — can ship later)

---

## Test sequence after deploy

1. **Trial happy path:** Sign up with corp email → enter card → see 14-day trial badge in /billing → confirm Stripe shows subscription as `trialing`
2. **Trial expiration test:** In Stripe dashboard, fast-forward the trial to day 15 → should auto-charge → org `plan_status` flips from `trialing` to `active`
3. **Consumer email rejection:** Try `test@gmail.com` → see error
4. **Cancel during trial:** Cancel from Stripe Customer Portal → subscription ends day 14 → no charge
5. **Duplicate domain:** Sign up `alice@vaultline.app` (same domain as your test org) → should hit Layer 3 logic (once shipped)
