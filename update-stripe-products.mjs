// update-stripe-products.mjs
//
// Run from ~/Desktop/vaultline-repo/ (or anywhere) with your live secret key:
//   STRIPE_SECRET_KEY=sk_live_xxx node update-stripe-products.mjs
//
// Add --apply to actually write changes. Without it, runs in dry-run mode.
//
// What it does:
//   1. Lists ALL active products in your Stripe workspace
//   2. Maps each to a tier (starter / growth / enterprise) by name match
//   3. Adds `plan` metadata to each Price under each Product
//   4. For Enterprise: archives old $2,499 price, creates new $3,499 monthly + $2,799 annual
//
// Safe to run multiple times. Idempotent.

import Stripe from 'stripe'

const apply = process.argv.includes('--apply')
const key = process.env.STRIPE_SECRET_KEY

if (!key) {
  console.error('ERROR: set STRIPE_SECRET_KEY env var (must be sk_live_... not pk_)')
  process.exit(1)
}
if (!key.startsWith('sk_')) {
  console.error('ERROR: STRIPE_SECRET_KEY must start with sk_ (got pk_? you pasted the publishable key)')
  process.exit(1)
}

const stripe = new Stripe(key, { apiVersion: '2024-12-18.acacia' })

const TIER_RULES = [
  { tier: 'starter', match: /starter/i, monthly: 49900, annual: 478800 }, // $499 / $4,788/yr
  { tier: 'growth', match: /growth/i, monthly: 149900, annual: 1438800 },
  { tier: 'enterprise', match: /enterprise/i, monthly: 349900, annual: 3358800 },
]

const fmt = (cents) => `$${(cents / 100).toLocaleString('en-US', { minimumFractionDigits: 2 })}`

function classifyProduct(product) {
  for (const rule of TIER_RULES) {
    if (rule.match.test(product.name)) return rule
  }
  return null
}

function priceInterval(price) {
  return price.recurring?.interval === 'year' ? 'annual' : 'monthly'
}

async function main() {
  console.log(`\n${apply ? 'APPLY MODE' : 'DRY-RUN MODE'} — Stripe products audit\n`)
  console.log('─'.repeat(60))

  const products = await stripe.products.list({ active: true, limit: 100 })
  if (products.data.length === 0) {
    console.error('No active products found. Create them in Stripe first.')
    process.exit(1)
  }

  const findings = []

  for (const product of products.data) {
    const rule = classifyProduct(product)
    if (!rule) continue // skip unrelated products

    const prices = await stripe.prices.list({ product: product.id, active: true, limit: 100 })

    findings.push({
      product,
      rule,
      prices: prices.data,
    })
  }

  if (findings.length === 0) {
    console.error('No products matched starter/growth/enterprise. Check product names in Stripe.')
    process.exit(1)
  }

  // Print plan
  console.log(`\nFound ${findings.length} matched products:\n`)
  for (const f of findings) {
    console.log(`  ${f.product.name} (${f.product.id}) → tier: ${f.rule.tier}`)
    for (const p of f.prices) {
      const tag = p.metadata?.plan ? `plan=${p.metadata.plan}` : 'plan=MISSING'
      console.log(`    └ ${priceInterval(p)} ${fmt(p.unit_amount)} (${p.id}) [${tag}]`)
    }
  }

  console.log('\n─'.repeat(60))
  console.log('\nActions to perform:\n')

  const actions = []

  for (const f of findings) {
    // Action 1: Add metadata to each price
    for (const p of f.prices) {
      if (p.metadata?.plan !== f.rule.tier) {
        actions.push({
          type: 'update-price-metadata',
          priceId: p.id,
          plan: f.rule.tier,
          desc: `Set plan=${f.rule.tier} on ${f.product.name} ${priceInterval(p)} (${fmt(p.unit_amount)})`,
        })
      }
    }

    // Action 2: For enterprise, archive old $2,499 monthly + create $3,499 monthly
    if (f.rule.tier === 'enterprise') {
      const expectedMonthly = f.rule.monthly
      const expectedAnnual = f.rule.annual

      const monthlyPrices = f.prices.filter(p => priceInterval(p) === 'monthly')
      const annualPrices = f.prices.filter(p => priceInterval(p) === 'annual')

      const correctMonthly = monthlyPrices.find(p => p.unit_amount === expectedMonthly)
      const correctAnnual = annualPrices.find(p => p.unit_amount === expectedAnnual)

      if (!correctMonthly) {
        // Archive any monthly prices at the wrong amount
        for (const p of monthlyPrices) {
          if (p.unit_amount !== expectedMonthly) {
            actions.push({
              type: 'archive-price',
              priceId: p.id,
              desc: `Archive Enterprise monthly at ${fmt(p.unit_amount)} (was wrong)`,
            })
          }
        }
        actions.push({
          type: 'create-price',
          productId: f.product.id,
          amount: expectedMonthly,
          interval: 'month',
          plan: 'enterprise',
          desc: `Create Enterprise monthly at ${fmt(expectedMonthly)}`,
        })
      }

      if (!correctAnnual) {
        for (const p of annualPrices) {
          if (p.unit_amount !== expectedAnnual) {
            actions.push({
              type: 'archive-price',
              priceId: p.id,
              desc: `Archive Enterprise annual at ${fmt(p.unit_amount)} (was wrong)`,
            })
          }
        }
        actions.push({
          type: 'create-price',
          productId: f.product.id,
          amount: expectedAnnual,
          interval: 'year',
          plan: 'enterprise',
          desc: `Create Enterprise annual at ${fmt(expectedAnnual)}`,
        })
      }
    }
  }

  if (actions.length === 0) {
    console.log('  Nothing to change. All products already correct.')
    process.exit(0)
  }

  for (const a of actions) {
    console.log(`  • ${a.desc}`)
  }

  if (!apply) {
    console.log('\n─'.repeat(60))
    console.log('\nDRY-RUN — nothing was changed. To apply, re-run with --apply:')
    console.log(`  STRIPE_SECRET_KEY=$STRIPE_SECRET_KEY node update-stripe-products.mjs --apply\n`)
    process.exit(0)
  }

  console.log('\n─'.repeat(60))
  console.log('\nApplying...\n')

  for (const a of actions) {
    try {
      if (a.type === 'update-price-metadata') {
        await stripe.prices.update(a.priceId, { metadata: { plan: a.plan } })
        console.log(`  ✓ ${a.desc}`)
      } else if (a.type === 'archive-price') {
        await stripe.prices.update(a.priceId, { active: false })
        console.log(`  ✓ ${a.desc}`)
      } else if (a.type === 'create-price') {
        const p = await stripe.prices.create({
          product: a.productId,
          unit_amount: a.amount,
          currency: 'usd',
          recurring: { interval: a.interval },
          metadata: { plan: a.plan },
        })
        console.log(`  ✓ ${a.desc} → ${p.id}`)
      }
    } catch (err) {
      console.error(`  ✗ ${a.desc}: ${err.message}`)
    }
  }

  console.log('\n─'.repeat(60))
  console.log('\nDone. Re-run without --apply to verify.\n')
}

main().catch((err) => {
  console.error('FATAL:', err.message)
  process.exit(1)
})
