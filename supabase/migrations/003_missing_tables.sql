-- Migration 003: Missing tables referenced by frontend
-- cash_position, invites, ecosystem_products, qb_connections, accounting_connections, data_imports, fx_watchlist

-- ── cash_position: materialized view of aggregate balances per org ──
create table if not exists public.cash_position (
  id uuid primary key default gen_random_uuid(),
  org_id uuid not null references public.organizations(id) on delete cascade,
  total_balance numeric not null default 0,
  liquid_balance numeric not null default 0,
  available_credit numeric not null default 0,
  connected_banks int not null default 0,
  total_accounts int not null default 0,
  updated_at timestamptz not null default now(),
  unique(org_id)
);

-- ── invites: team invite tracking ──
create table if not exists public.invites (
  id uuid primary key default gen_random_uuid(),
  org_id uuid not null references public.organizations(id) on delete cascade,
  email text not null,
  role text not null default 'member' check (role in ('admin', 'member', 'viewer')),
  invited_by uuid references public.profiles(id),
  status text not null default 'pending' check (status in ('pending', 'accepted', 'expired', 'revoked')),
  token text unique default encode(gen_random_bytes(32), 'hex'),
  expires_at timestamptz not null default (now() + interval '7 days'),
  created_at timestamptz not null default now(),
  accepted_at timestamptz
);

-- ── ecosystem_products: tracks which suite products an org has activated ──
create table if not exists public.ecosystem_products (
  id uuid primary key default gen_random_uuid(),
  org_id uuid not null references public.organizations(id) on delete cascade,
  product text not null check (product in ('vaultline', 'financeos', 'parallax', 'emberglow')),
  status text not null default 'inactive' check (status in ('active', 'trialing', 'inactive', 'canceled')),
  stripe_subscription_id text,
  activated_at timestamptz,
  created_at timestamptz not null default now(),
  unique(org_id, product)
);

-- ── qb_connections: QuickBooks Online OAuth connections ──
create table if not exists public.qb_connections (
  id uuid primary key default gen_random_uuid(),
  org_id uuid not null references public.organizations(id) on delete cascade,
  realm_id text not null,
  company_name text,
  access_token text,
  refresh_token text,
  token_expires_at timestamptz,
  status text not null default 'connected' check (status in ('connected', 'disconnected', 'error', 'refreshing')),
  last_synced_at timestamptz,
  created_at timestamptz not null default now(),
  unique(org_id)
);

-- ── accounting_connections: Xero, Sage, NetSuite OAuth connections ──
create table if not exists public.accounting_connections (
  id uuid primary key default gen_random_uuid(),
  org_id uuid not null references public.organizations(id) on delete cascade,
  provider text not null check (provider in ('xero', 'sage', 'netsuite')),
  tenant_id text,
  company_name text,
  access_token text,
  refresh_token text,
  token_expires_at timestamptz,
  status text not null default 'connected' check (status in ('connected', 'disconnected', 'error', 'refreshing')),
  last_synced_at timestamptz,
  created_at timestamptz not null default now(),
  unique(org_id, provider)
);

-- ── data_imports: CSV and manual import history ──
create table if not exists public.data_imports (
  id uuid primary key default gen_random_uuid(),
  org_id uuid not null references public.organizations(id) on delete cascade,
  user_id uuid references public.profiles(id),
  type text not null check (type in ('csv', 'manual', 'api')),
  source text,
  file_name text,
  row_count int default 0,
  success_count int default 0,
  error_count int default 0,
  errors jsonb default '[]'::jsonb,
  status text not null default 'processing' check (status in ('processing', 'completed', 'failed')),
  created_at timestamptz not null default now(),
  completed_at timestamptz
);

-- ── fx_watchlist: user's tracked currency pairs ──
create table if not exists public.fx_watchlist (
  id uuid primary key default gen_random_uuid(),
  org_id uuid not null references public.organizations(id) on delete cascade,
  base_currency text not null default 'USD',
  target_currency text not null,
  alert_above numeric,
  alert_below numeric,
  created_at timestamptz not null default now(),
  unique(org_id, base_currency, target_currency)
);

-- ── growth_events: lifecycle event tracking (referenced in HANDOFF, may already exist on Supabase) ──
create table if not exists public.growth_events (
  id uuid primary key default gen_random_uuid(),
  org_id uuid references public.organizations(id) on delete cascade,
  user_id uuid references public.profiles(id),
  event text not null check (event in ('signup', 'trial_start', 'conversion', 'upgrade', 'downgrade', 'churn', 'reactivation', 'referral_sent', 'referral_converted')),
  metadata jsonb default '{}'::jsonb,
  created_at timestamptz not null default now()
);

-- ── Add missing columns to organizations ──
alter table public.organizations add column if not exists closed_at timestamptz;
alter table public.organizations add column if not exists closure_reason text;
alter table public.organizations add column if not exists referral_code text unique;
alter table public.organizations add column if not exists stripe_customer_id text;
alter table public.organizations add column if not exists stripe_subscription_id text;

-- ── Indexes ──
create index if not exists if not exists idx_cash_position_org on public.cash_position(org_id);
create index if not exists if not exists idx_invites_org on public.invites(org_id, status);
create index if not exists if not exists idx_invites_token on public.invites(token) where status = 'pending';
create index if not exists if not exists idx_invites_email on public.invites(email, org_id);
create index if not exists if not exists idx_eco_products_org on public.ecosystem_products(org_id);
create index if not exists if not exists idx_qb_connections_org on public.qb_connections(org_id);
create index if not exists if not exists idx_acct_connections_org on public.accounting_connections(org_id, provider);
create index if not exists if not exists idx_data_imports_org on public.data_imports(org_id, created_at desc);
create index if not exists if not exists idx_fx_watchlist_org on public.fx_watchlist(org_id);
create index if not exists if not exists idx_growth_events_org on public.growth_events(org_id, created_at desc);
create index if not exists if not exists idx_growth_events_event on public.growth_events(event, created_at desc);

-- ── RLS ──
alter table public.cash_position enable row level security;
alter table public.invites enable row level security;
alter table public.ecosystem_products enable row level security;
alter table public.qb_connections enable row level security;
alter table public.accounting_connections enable row level security;
alter table public.data_imports enable row level security;
alter table public.fx_watchlist enable row level security;
alter table public.growth_events enable row level security;

-- RLS policies: org-scoped read/write for authenticated users
do $$ begin execute 'drop policy if exists "' || 'Users can view own org cash_position' || '" on ' || current_schema || '.'; exception when others then null; end $$;
create policy "Users can view own org cash_position" on public.cash_position for select using (org_id in (select org_id from public.profiles where id = auth.uid()));
do $$ begin execute 'drop policy if exists "' || 'Users can view own org invites' || '" on ' || current_schema || '.'; exception when others then null; end $$;
create policy "Users can view own org invites" on public.invites for select using (org_id in (select org_id from public.profiles where id = auth.uid()));
do $$ begin execute 'drop policy if exists "' || 'Users can insert own org invites' || '" on ' || current_schema || '.'; exception when others then null; end $$;
create policy "Users can insert own org invites" on public.invites for insert with check (org_id in (select org_id from public.profiles where id = auth.uid()));
do $$ begin execute 'drop policy if exists "' || 'Users can view own org eco products' || '" on ' || current_schema || '.'; exception when others then null; end $$;
create policy "Users can view own org eco products" on public.ecosystem_products for select using (org_id in (select org_id from public.profiles where id = auth.uid()));
do $$ begin execute 'drop policy if exists "' || 'Users can view own org qb connections' || '" on ' || current_schema || '.'; exception when others then null; end $$;
create policy "Users can view own org qb connections" on public.qb_connections for select using (org_id in (select org_id from public.profiles where id = auth.uid()));
do $$ begin execute 'drop policy if exists "' || 'Users can view own org acct connections' || '" on ' || current_schema || '.'; exception when others then null; end $$;
create policy "Users can view own org acct connections" on public.accounting_connections for select using (org_id in (select org_id from public.profiles where id = auth.uid()));
do $$ begin execute 'drop policy if exists "' || 'Users can view own org data imports' || '" on ' || current_schema || '.'; exception when others then null; end $$;
create policy "Users can view own org data imports" on public.data_imports for select using (org_id in (select org_id from public.profiles where id = auth.uid()));
do $$ begin execute 'drop policy if exists "' || 'Users can view own org fx watchlist' || '" on ' || current_schema || '.'; exception when others then null; end $$;
create policy "Users can view own org fx watchlist" on public.fx_watchlist for select using (org_id in (select org_id from public.profiles where id = auth.uid()));
do $$ begin execute 'drop policy if exists "' || 'Users can manage own org fx watchlist' || '" on ' || current_schema || '.'; exception when others then null; end $$;
create policy "Users can manage own org fx watchlist" on public.fx_watchlist for all using (org_id in (select org_id from public.profiles where id = auth.uid()));
do $$ begin execute 'drop policy if exists "' || 'Users can view own org growth events' || '" on ' || current_schema || '.'; exception when others then null; end $$;
create policy "Users can view own org growth events" on public.growth_events for select using (org_id in (select org_id from public.profiles where id = auth.uid()));

-- Service role policies for edge functions (insert/update via service role)
do $$ begin execute 'drop policy if exists "' || 'Service can manage cash_position' || '" on ' || current_schema || '.'; exception when others then null; end $$;
create policy "Service can manage cash_position" on public.cash_position for all using (true) with check (true);
do $$ begin execute 'drop policy if exists "' || 'Service can manage growth events' || '" on ' || current_schema || '.'; exception when others then null; end $$;
create policy "Service can manage growth events" on public.growth_events for all using (true) with check (true);
do $$ begin execute 'drop policy if exists "' || 'Service can manage data imports' || '" on ' || current_schema || '.'; exception when others then null; end $$;
create policy "Service can manage data imports" on public.data_imports for all using (true) with check (true);
do $$ begin execute 'drop policy if exists "' || 'Service can manage eco products' || '" on ' || current_schema || '.'; exception when others then null; end $$;
create policy "Service can manage eco products" on public.ecosystem_products for all using (true) with check (true);
