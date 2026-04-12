-- ═══════════════════════════════════════════════════
-- 026: Table fixes + unified connector registry
-- ═══════════════════════════════════════════════════

-- Fix 1: Rename kb_articles to knowledge_base (support fn expects this name)
alter table if exists public.kb_articles rename to knowledge_base;

-- Add missing columns if rename worked
do $$ begin
  if not exists (select 1 from information_schema.columns where table_name = 'knowledge_base' and column_name = 'tags') then
    alter table public.knowledge_base add column tags text[] default '{}';
  end if;
  if not exists (select 1 from information_schema.columns where table_name = 'knowledge_base' and column_name = 'views') then
    alter table public.knowledge_base add column views int default 0;
  end if;
  if not exists (select 1 from information_schema.columns where table_name = 'knowledge_base' and column_name = 'helpful_yes') then
    alter table public.knowledge_base add column helpful_yes int default 0;
  end if;
  if not exists (select 1 from information_schema.columns where table_name = 'knowledge_base' and column_name = 'helpful_no') then
    alter table public.knowledge_base add column helpful_no int default 0;
  end if;
  if not exists (select 1 from information_schema.columns where table_name = 'knowledge_base' and column_name = 'status') then
    alter table public.knowledge_base add column status text default 'published';
  end if;
end $$;

-- Fix 2: Create csat_surveys table
create table if not exists public.csat_surveys (
  id uuid primary key default gen_random_uuid(),
  org_id uuid references public.organizations(id) on delete cascade,
  user_id uuid references auth.users(id),
  trigger_type text not null,
  trigger_id text,
  score int check (score between 1 and 5),
  feedback text,
  tags text[] default '{}',
  created_at timestamptz not null default now()
);

create index if not exists idx_csat_org on public.csat_surveys(org_id, created_at desc);
alter table public.csat_surveys enable row level security;
create policy "csat_all" on public.csat_surveys for all using (true) with check (true);

-- Fix 3: Unified connector registry
create table if not exists public.connector_registry (
  id text primary key,
  name text not null,
  provider text not null,
  category text not null,
  auth_type text not null default 'oauth' check (auth_type in ('oauth','api_key','plaid','token','none')),
  logo_url text,
  description text,
  sync_capabilities text[] default '{}',
  required_secrets text[] default '{}',
  status text default 'available' check (status in ('live','available','coming_soon','deprecated')),
  plan_required text default 'starter',
  sort_order int default 100,
  created_at timestamptz not null default now()
);

alter table public.connector_registry enable row level security;
create policy "registry_read" on public.connector_registry for select using (true);

-- Seed connector registry
insert into public.connector_registry (id, name, provider, category, auth_type, description, sync_capabilities, required_secrets, status, plan_required, sort_order) values
  ('plaid', 'Plaid', 'plaid', 'banking', 'plaid', 'Connect 12,000+ banks, credit unions, and financial institutions', '{"accounts","balances","transactions","investments"}', '{"PLAID_CLIENT_ID","PLAID_SECRET"}', 'live', 'starter', 1),
  ('stripe', 'Stripe', 'stripe', 'payments', 'oauth', 'Payment processing, subscriptions, and revenue data', '{"payments","subscriptions","invoices","payouts"}', '{"STRIPE_SECRET_KEY"}', 'live', 'starter', 2),
  ('quickbooks', 'QuickBooks Online', 'intuit', 'accounting', 'oauth', 'Sync GL accounts, invoices, bills, and payments', '{"accounts","invoices","bills","payments","journal_entries"}', '{"INTUIT_CLIENT_ID","INTUIT_CLIENT_SECRET"}', 'available', 'starter', 10),
  ('xero', 'Xero', 'xero', 'accounting', 'oauth', 'Two-way sync with Xero accounting data', '{"accounts","invoices","bills","contacts","bank_feeds"}', '{"XERO_CLIENT_ID","XERO_CLIENT_SECRET"}', 'available', 'starter', 11),
  ('sage', 'Sage Intacct', 'sage', 'erp', 'oauth', 'Enterprise accounting with multi-entity consolidation', '{"accounts","invoices","bills","dimensions","gl_entries"}', '{"SAGE_CLIENT_ID","SAGE_CLIENT_SECRET"}', 'available', 'growth', 12),
  ('netsuite', 'Oracle NetSuite', 'netsuite', 'erp', 'token', 'Enterprise ERP with subsidiary management', '{"accounts","transactions","subsidiaries","custom_records"}', '{"NETSUITE_CLIENT_ID","NETSUITE_CLIENT_SECRET"}', 'coming_soon', 'enterprise', 13),
  ('gusto', 'Gusto', 'finch', 'payroll', 'oauth', 'Payroll runs, employee data, and compensation', '{"payroll_runs","employees","compensation"}', '{"FINCH_CLIENT_ID","FINCH_CLIENT_SECRET"}', 'coming_soon', 'growth', 20),
  ('adp', 'ADP', 'finch', 'payroll', 'oauth', 'Enterprise payroll and HR data via Finch', '{"payroll_runs","employees","compensation"}', '{"FINCH_CLIENT_ID","FINCH_CLIENT_SECRET"}', 'coming_soon', 'growth', 21),
  ('rippling', 'Rippling', 'finch', 'payroll', 'oauth', 'Unified payroll, benefits, and IT via Finch', '{"payroll_runs","employees","compensation"}', '{"FINCH_CLIENT_ID","FINCH_CLIENT_SECRET"}', 'coming_soon', 'growth', 22),
  ('brex', 'Brex', 'brex', 'corporate_cards', 'api_key', 'Corporate card spend with line-item detail', '{"transactions","statements","budgets"}', '{"BREX_API_KEY"}', 'coming_soon', 'growth', 30),
  ('ramp', 'Ramp', 'ramp', 'corporate_cards', 'api_key', 'Corporate card and expense management', '{"transactions","receipts","budgets","reimbursements"}', '{"RAMP_API_KEY"}', 'coming_soon', 'growth', 31),
  ('square', 'Square', 'square', 'payments', 'oauth', 'POS payments, invoices, and deposits', '{"payments","invoices","deposits"}', '{"SQUARE_ACCESS_TOKEN"}', 'coming_soon', 'starter', 40),
  ('paypal', 'PayPal', 'paypal', 'payments', 'oauth', 'PayPal payments and payouts', '{"payments","payouts","disputes"}', '{"PAYPAL_CLIENT_ID","PAYPAL_CLIENT_SECRET"}', 'coming_soon', 'starter', 41),
  ('mercury', 'Mercury', 'mercury', 'banking', 'api_key', 'Startup banking with treasury API', '{"accounts","transactions","payments"}', '{"MERCURY_API_KEY"}', 'coming_soon', 'starter', 50),
  ('slack_int', 'Slack', 'slack', 'communication', 'oauth', 'Push alerts and daily summaries to Slack channels', '{"alerts","daily_summary","notifications"}', '{}', 'available', 'starter', 60),
  ('csv', 'CSV Upload', 'internal', 'file_import', 'none', 'Import bank statements and transaction data from CSV files', '{"transactions"}', '{}', 'live', 'starter', 70),
  ('manual', 'Manual Entry', 'internal', 'file_import', 'none', 'Enter transactions and create accounts manually', '{"transactions","accounts"}', '{}', 'live', 'starter', 71)
on conflict (id) do nothing;

-- Unified connections table
create table if not exists public.connections (
  id uuid primary key default gen_random_uuid(),
  org_id uuid not null references public.organizations(id) on delete cascade,
  connector_id text not null references public.connector_registry(id),
  provider text not null,
  display_name text,
  access_token text,
  refresh_token text,
  token_expires_at timestamptz,
  metadata jsonb default '{}',
  status text default 'connected' check (status in ('connected','disconnected','error','pending','expired')),
  error_message text,
  error_count int default 0,
  last_synced_at timestamptz,
  sync_schedule text default '6h',
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create index if not exists idx_connections_org on public.connections(org_id, status);
create index if not exists idx_connections_connector on public.connections(connector_id);
alter table public.connections enable row level security;
create policy "connections_all" on public.connections for all using (true) with check (true);

-- Sync logs
create table if not exists public.sync_logs (
  id uuid primary key default gen_random_uuid(),
  connection_id uuid not null references public.connections(id) on delete cascade,
  org_id uuid references public.organizations(id),
  records_synced int default 0,
  records_failed int default 0,
  duration_ms int,
  error text,
  status text default 'completed' check (status in ('running','completed','failed')),
  created_at timestamptz not null default now()
);

create index if not exists idx_sync_logs_conn on public.sync_logs(connection_id, created_at desc);
alter table public.sync_logs enable row level security;
create policy "sync_logs_all" on public.sync_logs for all using (true) with check (true);
