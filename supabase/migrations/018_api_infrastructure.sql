-- ═══════════════════════════════════════════════════
-- 018: API infrastructure + resource content
-- ═══════════════════════════════════════════════════

-- ── api_keys: secure key storage ──
create table if not exists public.api_keys (
  id uuid primary key default gen_random_uuid(),
  org_id uuid not null references public.organizations(id) on delete cascade,
  name text not null,
  key_prefix text not null,        -- first 12 chars (for display: vl_live_XXXX)
  key_suffix text not null,        -- last 4 chars (for identification)
  key_hash text not null,          -- SHA-256 hash of the full key
  scopes text[] not null default '{read:accounts,read:transactions,read:forecast}'::text[],
  environment text not null default 'production' check (environment in ('production', 'sandbox')),
  rate_limit_per_min int not null default 1000,
  created_by uuid references auth.users(id),
  last_used_at timestamptz,
  revoked_at timestamptz,
  expires_at timestamptz,
  created_at timestamptz not null default now()
);

create index if not exists idx_api_keys_org on public.api_keys(org_id) where revoked_at is null;
create index if not exists idx_api_keys_hash on public.api_keys(key_hash) where revoked_at is null;

alter table public.api_keys enable row level security;
create policy "org members read api keys" on public.api_keys for select using (
  org_id in (select org_id from public.profiles where id = auth.uid())
);
create policy "org members insert api keys" on public.api_keys for insert with check (
  org_id in (select org_id from public.profiles where id = auth.uid())
);
create policy "org members update api keys" on public.api_keys for update using (
  org_id in (select org_id from public.profiles where id = auth.uid())
);

-- ── api_usage: request logging ──
create table if not exists public.api_usage (
  id uuid primary key default gen_random_uuid(),
  org_id uuid not null references public.organizations(id) on delete cascade,
  key_id uuid references public.api_keys(id),
  endpoint text not null,
  method text not null default 'GET',
  status_code int not null default 200,
  latency_ms int,
  request_ip text,
  created_at timestamptz not null default now()
);

create index if not exists idx_api_usage_org_day on public.api_usage(org_id, created_at desc);
create index if not exists idx_api_usage_key on public.api_usage(key_id, created_at desc);

alter table public.api_usage enable row level security;
create policy "org members read api usage" on public.api_usage for select using (
  org_id in (select org_id from public.profiles where id = auth.uid())
);

-- ── Seed announcements ──
insert into public.ux_announcements (title, body, announcement_type, severity, display_type, cta_text, cta_url, published) values
  ('Embedded Stripe checkout is live', 'Credit card collection is now built into the onboarding flow. No redirects.', 'feature', 'info', 'banner', 'View Billing', '/billing', true),
  ('API access now available', 'Growth and Enterprise plans can now generate API keys and query treasury data programmatically.', 'feature', 'info', 'banner', 'Get API Key', '/api', true),
  ('AI Treasury Copilot improvements', 'Copilot now has page-aware context, screenshot analysis, and persistent memory across sessions.', 'improvement', 'success', 'banner', null, null, true)
on conflict do nothing;

-- ── Add body content to existing resources ──
update public.resource_library set body_markdown = '# Getting Started with Vaultline

Welcome to Vaultline — your treasury command center. This guide walks you through setup in under 10 minutes.

## Step 1: Connect your first bank
Navigate to **Bank Connections** in the sidebar and click **Connect Bank**. We support 12,000+ institutions via Plaid. Your credentials never touch our servers.

## Step 2: Explore the dashboard
Once connected, your **Dashboard** populates with real-time balances, cash position charts, and AI-powered insights. The Treasury Copilot is available in the bottom-right corner.

## Step 3: Generate your first report
Go to **Reports** and select a template — Daily Cash Position is a great starting point. Export as PDF, Excel, or CSV.

## Step 4: Set up alerts
Configure threshold alerts in **Treasury Ops** to get notified when balances drop below your targets.

## Next steps
- [Understanding AI Forecasting](/resources/forecast-guide)
- [QuickBooks Integration](/resources/quickbooks-sync)
- [Security Best Practices](/resources/security-best)' where slug = 'getting-started';

update public.resource_library set body_markdown = '# How to Connect a Bank Account

Vaultline uses Plaid to securely connect to your bank accounts. Here''s how:

## Prerequisites
- An active Vaultline account
- Online banking credentials for your bank

## Connection steps
1. Go to **Bank Connections** in the left sidebar
2. Click **Connect Bank** in the top right
3. Search for your bank in the Plaid dialog
4. Enter your online banking credentials directly with your bank (never stored by Vaultline)
5. Select which accounts to sync
6. Click **Continue** — balances appear within 60 seconds

## Supported institutions
We support 12,000+ banks, credit unions, and financial institutions across the US, Canada, and UK via Plaid.

## Troubleshooting
- **Bank not found?** Try searching by the full official name
- **Connection failed?** Ensure your online banking is active and MFA is enabled at your bank
- **Stale data?** Click **Sync** on the Bank Connections page to force a refresh' where slug = 'connect-bank';

update public.resource_library set body_markdown = '# Understanding AI Forecasting

Vaultline offers three forecasting models. Here''s how each works and when to use them.

## Linear Regression
Best for stable businesses with predictable cash flows. Projects future balances based on historical trends using a least-squares fit.

**When to use:** Steady-state businesses, utility payments, recurring revenue

## Exponential Moving Average (EMA)
Weights recent data more heavily than older data. Adapts faster to changing conditions than linear regression.

**When to use:** Seasonal businesses, post-fundraise transitions, rapid growth

## Monte Carlo Simulation
Runs 1,000+ probabilistic scenarios to generate confidence bands. Shows best-case, worst-case, and most-likely outcomes.

**When to use:** Board presentations, scenario planning, fundraising runway analysis

## Forecast accuracy
Every forecast includes a MAPE (Mean Absolute Percentage Error) backtest score. Lower is better — under 10% is excellent.

## Auto-recommendation
Vaultline automatically selects the best model for your data by backtesting all three against your last 90 days. Look for the **Recommended** badge.' where slug = 'forecast-guide';

update public.resource_library set body_markdown = '# API Quick Start Guide

Authenticate and start querying treasury data in 5 minutes.

## Authentication
All API requests require a Bearer token. Generate one at **Settings → API Access**.

```
curl https://api.vaultline.app/v1/cash-position \
  -H "Authorization: Bearer vl_live_..." \
  -H "Content-Type: application/json"
```

## Core endpoints

| Method | Endpoint | Description |
|--------|----------|-------------|
| GET | /v1/accounts | List connected bank accounts |
| GET | /v1/transactions | Query transactions with filters |
| GET | /v1/cash-position | Current cash position summary |
| GET | /v1/forecast | Cash flow forecast & runway |
| GET | /v1/balances/daily | Historical daily balances |
| POST | /v1/webhooks | Register a webhook endpoint |

## Rate limits
- Starter: Not available
- Growth: 1,000 requests/minute
- Enterprise: 5,000 requests/minute

## Webhooks
Register a webhook to receive real-time notifications when balances change, transactions are detected, or forecasts update.

```json
POST /v1/webhooks
{
  "url": "https://your-app.com/webhook",
  "events": ["balance.updated", "transaction.created"]
}
```' where slug = 'api-quickstart';

update public.resource_library set body_markdown = '# Security Best Practices

Protect your treasury data with these recommended configurations.

## Multi-Factor Authentication
Enable MFA for all team members. Go to **Settings → Security** to enforce org-wide MFA requirements.

## Team permissions
Use role-based access control to limit who can view sensitive financial data:
- **Admin**: Full access including billing and API keys
- **Manager**: Read/write access to all treasury features
- **Viewer**: Read-only access to dashboards and reports

## API key security
- Never expose production keys in client-side code
- Use server-to-server calls only
- Rotate keys quarterly or immediately if compromised
- Use sandbox keys for development and testing

## Audit trail
Every action in Vaultline is logged. View the complete audit trail at **Settings → Audit Log**.

## Data encryption
- All data encrypted at rest (AES-256)
- All connections encrypted in transit (TLS 1.3)
- Row-level security isolates each organization''s data
- HSTS enforced on all endpoints' where slug = 'security-best';
