// cleanup-stripe.mjs
//
// Archives the 4 prices we've confirmed are junk:
//   1. Vaultline Starter monthly $4,788 (duplicate of annual amount, wrong interval)
//   2. Vaultline Growth monthly $14,388 (duplicate of annual amount, wrong interval)
//   3. Vaultline Voice Enterprise monthly $3,499 (created on wrong product tonight)
//   4. Vaultline Voice Enterprise annual $33,588 (created on wrong product tonight)
//
// Confirmed: 0 active subscriptions reference any of these.
// Run: STRIPE_SECRET_KEY=sk_live_xxx node cleanup-stripe.mjs --apply

import Stripe from 'stripe'

const apply = process.argv.includes('--apply')
const key = process.env.STRIPE_SECRET_KEY

if (!key || !key.startsWith('sk_')) {
  console.error('ERROR: STRIPE_SECRET_KEY env var must be set to sk_live_... or sk_test_...')
  process.exit(1)
}

const stripe = new Stripe(key, { apiVersion: '2024-12-18.acacia' })

const TARGETS = [
  {
    id: 'price_1TK1RxFNFhtB2ZujqE7WB34C',
    desc: 'Vaultline Starter monthly $4,788 (junk: annual amount with month interval)',
  },
  {
    id: 'price_1TK1ShFNFhtB2ZujB3CetXNW',
    desc: 'Vaultline Growth monthly $14,388 (junk: annual amount with month interval)',
  },
  {
    id: 'price_1TTuaQFNFhtB2ZujIAMrsOzU',
    desc: 'Vaultline Voice Enterprise monthly $3,499 (created on wrong product 2026-05-05)',
  },
  {
    id: 'price_1TTuaQFNFhtB2Zujy8fibWij',
    desc: 'Vaultline Voice Enterprise annual $33,588 (created on wrong product 2026-05-05)',
  },
]

async function main() {
  console.log(`\n${apply ? 'APPLY MODE' : 'DRY-RUN MODE'} — Archive 4 junk prices\n`)
  console.log('─'.repeat(60))

  for (const t of TARGETS) {
    try {
      const p = await stripe.prices.retrieve(t.id)
      const status = p.active ? 'ACTIVE' : 'already archived'
      console.log(`\n  ${t.desc}`)
      console.log(`    id:     ${t.id}`)
      console.log(`    status: ${status}`)
      console.log(`    amount: $${(p.unit_amount / 100).toLocaleString('en-US', { minimumFractionDigits: 2 })}`)

      if (!p.active) {
        console.log(`    → skipping (already archived)`)
        continue
      }

      if (apply) {
        await stripe.prices.update(t.id, { active: false })
        console.log(`    ✓ ARCHIVED`)
      } else {
        console.log(`    → would archive`)
      }
    } catch (err) {
      console.log(`\n  ${t.desc}`)
      console.log(`    id: ${t.id}`)
      console.log(`    ✗ error: ${err.message}`)
    }
  }

  console.log('\n' + '─'.repeat(60))

  if (!apply) {
    console.log('\nDRY-RUN — nothing was changed. To apply:')
    console.log(`  node cleanup-stripe.mjs --apply\n`)
  } else {
    console.log('\nDone.\n')
  }
}

main().catch((err) => {
  console.error('FATAL:', err.message)
  process.exit(1)
})
