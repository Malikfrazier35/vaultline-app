-- ============================================================
-- VAULTLINE DATABASE SCHEMA
-- Treasury Management Platform
-- ============================================================

-- Enable required extensions
create extension if not exists "uuid-ossp";
create extension if not exists "pg_cron";

-- ============================================================
-- 1. ORGANIZATIONS (multi-tenant root)
-- ============================================================
create table if not exists public.organizations (
  id uuid primary key default uuid_generate_v4(),
  name text not null,
  slug text unique not null,
  fiscal_year_start_month int not null default 1,
  default_currency text not null default 'USD',
  stripe_customer_id text,
  stripe_subscription_id text,
  plan text not null default 'starter' check (plan in ('starter', 'growth', 'enterprise')),
  plan_status text not null default 'trialing' check (plan_status in ('trialing', 'active', 'past_due', 'canceled')),
  trial_ends_at timestamptz default (now() + interval '14 days'),
  max_bank_connections int not null default 3,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

-- ============================================================
-- 2. PROFILES (linked to auth.users)
-- ============================================================
create table if not exists public.profiles (
  id uuid primary key references auth.users(id) on delete cascade,
  org_id uuid not null references public.organizations(id) on delete cascade,
  full_name text not null,
  email text not null,
  role text not null default 'member' check (role in ('owner', 'admin', 'member', 'viewer')),
  avatar_url text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

-- ============================================================
-- 3. BANK CONNECTIONS (Plaid link sessions)
-- ============================================================
create table if not exists public.bank_connections (
  id uuid primary key default uuid_generate_v4(),
  org_id uuid not null references public.organizations(id) on delete cascade,
  plaid_item_id text unique,
  plaid_access_token text, -- encrypted in production
  institution_id text,
  institution_name text not null,
  institution_logo_url text,
  institution_color text, -- hex brand color
  status text not null default 'connected' check (status in ('connected', 'syncing', 'error', 'disconnected')),
  last_synced_at timestamptz,
  error_message text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

-- ============================================================
-- 4. ACCOUNTS (individual bank accounts)
-- ============================================================
create table if not exists public.accounts (
  id uuid primary key default uuid_generate_v4(),
  org_id uuid not null references public.organizations(id) on delete cascade,
  bank_connection_id uuid not null references public.bank_connections(id) on delete cascade,
  plaid_account_id text,
  name text not null,
  official_name text,
  type text not null check (type in ('checking', 'savings', 'credit', 'loan', 'investment', 'other')),
  subtype text,
  mask text, -- last 4 digits
  currency text not null default 'USD',
  current_balance numeric(18, 2) not null default 0,
  available_balance numeric(18, 2),
  credit_limit numeric(18, 2),
  is_active boolean not null default true,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

-- ============================================================
-- 5. TRANSACTIONS
-- ============================================================
create table if not exists public.transactions (
  id uuid primary key default uuid_generate_v4(),
  org_id uuid not null references public.organizations(id) on delete cascade,
  account_id uuid not null references public.accounts(id) on delete cascade,
  plaid_transaction_id text,
  date date not null,
  description text not null,
  amount numeric(14, 2) not null, -- positive = debit/outflow, negative = credit/inflow (Plaid convention)
  currency text not null default 'USD',
  category text check (category in ('revenue', 'payroll', 'vendor', 'saas', 'tax', 'transfer', 'operations', 'other', null)),
  category_confidence numeric(3, 2), -- AI categorization confidence 0-1
  is_pending boolean not null default false,
  merchant_name text,
  plaid_category text[], -- Plaid's own category hierarchy
  metadata jsonb default '{}',
  created_at timestamptz not null default now()
);

-- ============================================================
-- 6. DAILY BALANCES (snapshot for position tracking)
-- ============================================================
create table if not exists public.daily_balances (
  id uuid primary key default uuid_generate_v4(),
  org_id uuid not null references public.organizations(id) on delete cascade,
  account_id uuid not null references public.accounts(id) on delete cascade,
  date date not null,
  balance numeric(18, 2) not null,
  created_at timestamptz not null default now(),
  unique (account_id, date)
);

-- ============================================================
-- 7. FORECASTS
-- ============================================================
create table if not exists public.forecasts (
  id uuid primary key default uuid_generate_v4(),
  org_id uuid not null references public.organizations(id) on delete cascade,
  generated_at timestamptz not null default now(),
  horizon_days int not null default 30,
  model_version text not null default 'v1',
  data jsonb not null, -- array of {date, projected_balance, lower_bound, upper_bound}
  confidence numeric(3, 2) not null default 0.95,
  monthly_burn numeric(14, 2),
  runway_months numeric(5, 1),
  next_low_cash_date date, -- null if none projected
  notes text,
  created_at timestamptz not null default now()
);

-- ============================================================
-- 8. AI COPILOT CONVERSATIONS
-- ============================================================
create table if not exists public.copilot_messages (
  id uuid primary key default uuid_generate_v4(),
  org_id uuid not null references public.organizations(id) on delete cascade,
  user_id uuid not null references auth.users(id) on delete cascade,
  role text not null check (role in ('user', 'assistant')),
  content text not null,
  metadata jsonb default '{}',
  created_at timestamptz not null default now()
);

-- ============================================================
-- 9. NOTIFICATION SETTINGS
-- ============================================================
create table if not exists public.notification_settings (
  id uuid primary key default uuid_generate_v4(),
  org_id uuid not null references public.organizations(id) on delete cascade,
  low_cash_alerts boolean not null default true,
  low_cash_threshold numeric(14, 2) default 100000,
  daily_position_email boolean not null default true,
  daily_email_time time default '08:00',
  large_transaction_alerts boolean not null default true,
  large_transaction_threshold numeric(14, 2) default 50000,
  forecast_deviation_alerts boolean not null default false,
  forecast_deviation_pct numeric(4, 2) default 10,
  slack_enabled boolean not null default false,
  slack_webhook_url text,
  slack_channel text,
  updated_at timestamptz not null default now(),
  unique (org_id)
);

-- ============================================================
-- 10. AUDIT LOG
-- ============================================================
create table if not exists public.audit_log (
  id uuid primary key default uuid_generate_v4(),
  org_id uuid not null references public.organizations(id) on delete cascade,
  user_id uuid references auth.users(id),
  action text not null,
  resource_type text,
  resource_id uuid,
  details jsonb default '{}',
  ip_address inet,
  created_at timestamptz not null default now()
);

-- ============================================================
-- INDEXES
-- ============================================================
create index if not exists idx_profiles_org on public.profiles(org_id);
create index if not exists idx_bank_connections_org on public.bank_connections(org_id);
create index if not exists idx_accounts_org on public.accounts(org_id);
create index if not exists idx_accounts_bank on public.accounts(bank_connection_id);
create index if not exists idx_transactions_org on public.transactions(org_id);
create index if not exists idx_transactions_account on public.transactions(account_id);
create index if not exists idx_transactions_date on public.transactions(date desc);
create index if not exists idx_transactions_category on public.transactions(category);
create index if not exists idx_daily_balances_org_date on public.daily_balances(org_id, date desc);
create index if not exists idx_daily_balances_account_date on public.daily_balances(account_id, date desc);
create index if not exists idx_forecasts_org on public.forecasts(org_id, generated_at desc);
create index if not exists idx_copilot_org on public.copilot_messages(org_id, created_at desc);
create index if not exists idx_audit_org on public.audit_log(org_id, created_at desc);

-- ============================================================
-- ROW LEVEL SECURITY
-- ============================================================
alter table public.organizations enable row level security;
alter table public.profiles enable row level security;
alter table public.bank_connections enable row level security;
alter table public.accounts enable row level security;
alter table public.transactions enable row level security;
alter table public.daily_balances enable row level security;
alter table public.forecasts enable row level security;
alter table public.copilot_messages enable row level security;
alter table public.notification_settings enable row level security;
alter table public.audit_log enable row level security;

-- Helper function: get user's org_id
create or replace function public.get_user_org_id()
returns uuid
language sql
stable
security definer
as $$
  select org_id from public.profiles where id = auth.uid()
$$;

-- Organizations: users can only see their own org
do $$ begin execute 'drop policy if exists "' || 'Users can view own org' || '" on ' || current_schema || '.'; exception when others then null; end $$;
create policy "Users can view own org"
  on public.organizations for select
  using (id = public.get_user_org_id());

do $$ begin execute 'drop policy if exists "' || 'Owners can update org' || '" on ' || current_schema || '.'; exception when others then null; end $$;
create policy "Owners can update org"
  on public.organizations for update
  using (id = public.get_user_org_id());

-- Profiles: users see teammates in same org
do $$ begin execute 'drop policy if exists "' || 'Users can view org profiles' || '" on ' || current_schema || '.'; exception when others then null; end $$;
create policy "Users can view org profiles"
  on public.profiles for select
  using (org_id = public.get_user_org_id());

do $$ begin execute 'drop policy if exists "' || 'Users can update own profile' || '" on ' || current_schema || '.'; exception when others then null; end $$;
create policy "Users can update own profile"
  on public.profiles for update
  using (id = auth.uid());

-- Bank connections: org-scoped
do $$ begin execute 'drop policy if exists "' || 'Org members can view bank connections' || '" on ' || current_schema || '.'; exception when others then null; end $$;
create policy "Org members can view bank connections"
  on public.bank_connections for select
  using (org_id = public.get_user_org_id());

do $$ begin execute 'drop policy if exists "' || 'Admins can manage bank connections' || '" on ' || current_schema || '.'; exception when others then null; end $$;
create policy "Admins can manage bank connections"
  on public.bank_connections for all
  using (org_id = public.get_user_org_id());

-- Accounts: org-scoped
do $$ begin execute 'drop policy if exists "' || 'Org members can view accounts' || '" on ' || current_schema || '.'; exception when others then null; end $$;
create policy "Org members can view accounts"
  on public.accounts for select
  using (org_id = public.get_user_org_id());

-- Transactions: org-scoped
do $$ begin execute 'drop policy if exists "' || 'Org members can view transactions' || '" on ' || current_schema || '.'; exception when others then null; end $$;
create policy "Org members can view transactions"
  on public.transactions for select
  using (org_id = public.get_user_org_id());

-- Daily balances: org-scoped
do $$ begin execute 'drop policy if exists "' || 'Org members can view daily balances' || '" on ' || current_schema || '.'; exception when others then null; end $$;
create policy "Org members can view daily balances"
  on public.daily_balances for select
  using (org_id = public.get_user_org_id());

-- Forecasts: org-scoped
do $$ begin execute 'drop policy if exists "' || 'Org members can view forecasts' || '" on ' || current_schema || '.'; exception when others then null; end $$;
create policy "Org members can view forecasts"
  on public.forecasts for select
  using (org_id = public.get_user_org_id());

-- Copilot: org-scoped
do $$ begin execute 'drop policy if exists "' || 'Org members can view copilot messages' || '" on ' || current_schema || '.'; exception when others then null; end $$;
create policy "Org members can view copilot messages"
  on public.copilot_messages for select
  using (org_id = public.get_user_org_id());

do $$ begin execute 'drop policy if exists "' || 'Users can create copilot messages' || '" on ' || current_schema || '.'; exception when others then null; end $$;
create policy "Users can create copilot messages"
  on public.copilot_messages for insert
  with check (org_id = public.get_user_org_id() and user_id = auth.uid());

-- Notification settings: org-scoped
do $$ begin execute 'drop policy if exists "' || 'Org members can view notification settings' || '" on ' || current_schema || '.'; exception when others then null; end $$;
create policy "Org members can view notification settings"
  on public.notification_settings for select
  using (org_id = public.get_user_org_id());

do $$ begin execute 'drop policy if exists "' || 'Admins can update notification settings' || '" on ' || current_schema || '.'; exception when others then null; end $$;
create policy "Admins can update notification settings"
  on public.notification_settings for update
  using (org_id = public.get_user_org_id());

-- Audit log: org-scoped
do $$ begin execute 'drop policy if exists "' || 'Org members can view audit log' || '" on ' || current_schema || '.'; exception when others then null; end $$;
create policy "Org members can view audit log"
  on public.audit_log for select
  using (org_id = public.get_user_org_id());

-- ============================================================
-- AUTO-UPDATED_AT TRIGGER
-- ============================================================
create or replace function public.handle_updated_at()
returns trigger
language plpgsql
as $$
begin
  new.updated_at = now();
  return new;
end;
$$;

create trigger set_updated_at before update on public.organizations
  for each row execute function public.handle_updated_at();
create trigger set_updated_at before update on public.profiles
  for each row execute function public.handle_updated_at();
create trigger set_updated_at before update on public.bank_connections
  for each row execute function public.handle_updated_at();
create trigger set_updated_at before update on public.accounts
  for each row execute function public.handle_updated_at();
create trigger set_updated_at before update on public.notification_settings
  for each row execute function public.handle_updated_at();

-- ============================================================
-- NEW USER SIGNUP HANDLER
-- Creates org + profile on first signup
-- ============================================================
create or replace function public.handle_new_user()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
declare
  new_org_id uuid;
begin
  -- Create a default organization for the new user
  insert into public.organizations (name, slug)
  values (
    coalesce(new.raw_user_meta_data->>'company_name', split_part(new.email, '@', 1) || '''s Company'),
    lower(replace(coalesce(new.raw_user_meta_data->>'company_name', new.id::text), ' ', '-'))
  )
  returning id into new_org_id;

  -- Create the user profile
  insert into public.profiles (id, org_id, full_name, email, role)
  values (
    new.id,
    new_org_id,
    coalesce(new.raw_user_meta_data->>'full_name', split_part(new.email, '@', 1)),
    new.email,
    'owner'
  );

  -- Create default notification settings
  insert into public.notification_settings (org_id)
  values (new_org_id);

  return new;
end;
$$;

-- Trigger on auth.users insert
create trigger on_auth_user_created
  after insert on auth.users
  for each row execute function public.handle_new_user();

-- ============================================================
-- VIEWS FOR COMMON QUERIES
-- ============================================================

-- Aggregated cash position
create or replace view public.cash_position as
select
  a.org_id,
  sum(a.current_balance) as total_balance,
  sum(case when a.type in ('checking', 'savings') then a.current_balance else 0 end) as liquid_balance,
  sum(case when a.type = 'credit' then coalesce(a.credit_limit, 0) - a.current_balance else 0 end) as available_credit,
  count(distinct a.bank_connection_id) as connected_banks,
  count(*) as total_accounts
from public.accounts a
where a.is_active = true
group by a.org_id;

-- Monthly cash flow summary
create or replace view public.monthly_cashflow as
select
  t.org_id,
  date_trunc('month', t.date)::date as month,
  sum(case when t.amount < 0 then abs(t.amount) else 0 end) as total_inflows,
  sum(case when t.amount > 0 then t.amount else 0 end) as total_outflows,
  sum(case when t.amount < 0 then abs(t.amount) else -t.amount end) as net_flow,
  count(*) as transaction_count
from public.transactions t
group by t.org_id, date_trunc('month', t.date);
