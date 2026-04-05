-- Migration 007: AR/AP pipeline — invoices (receivables) and payables

create table if not exists public.invoices (
  id uuid primary key default gen_random_uuid(),
  org_id uuid not null references public.organizations(id) on delete cascade,
  invoice_number text not null,
  client_name text not null,
  client_email text,
  amount numeric(14,2) not null,
  currency text not null default 'USD',
  issued_date date not null default current_date,
  due_date date not null,
  paid_date date,
  status text not null default 'sent' check (status in ('draft', 'sent', 'pending', 'overdue', 'paid', 'canceled', 'disputed')),
  category text default 'services' check (category in ('subscription', 'services', 'consulting', 'license', 'other')),
  notes text,
  line_items jsonb default '[]'::jsonb,
  metadata jsonb default '{}'::jsonb,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table if not exists public.payables (
  id uuid primary key default gen_random_uuid(),
  org_id uuid not null references public.organizations(id) on delete cascade,
  bill_number text,
  vendor_name text not null,
  vendor_email text,
  amount numeric(14,2) not null,
  currency text not null default 'USD',
  issued_date date default current_date,
  due_date date not null,
  paid_date date,
  status text not null default 'pending' check (status in ('pending', 'scheduled', 'processing', 'paid', 'overdue', 'canceled')),
  category text default 'other' check (category in ('payroll', 'infrastructure', 'software', 'rent', 'utilities', 'insurance', 'professional_services', 'other')),
  recurrence text check (recurrence in ('one_time', 'weekly', 'monthly', 'quarterly', 'annual')),
  notes text,
  metadata jsonb default '{}'::jsonb,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create index if not exists idx_invoices_org on public.invoices(org_id, status, due_date);
create index if not exists idx_invoices_overdue on public.invoices(org_id, due_date) where status in ('sent', 'pending', 'overdue');
create index if not exists idx_payables_org on public.payables(org_id, status, due_date);
create index if not exists idx_payables_upcoming on public.payables(org_id, due_date) where status in ('pending', 'scheduled');

alter table public.invoices enable row level security;
alter table public.payables enable row level security;

do $$ begin execute 'drop policy if exists "' || 'Users view own org invoices' || '" on ' || current_schema || '.'; exception when others then null; end $$;
create policy "Users view own org invoices" on public.invoices for select using (org_id in (select org_id from public.profiles where id = auth.uid()));
do $$ begin execute 'drop policy if exists "' || 'Users manage own org invoices' || '" on ' || current_schema || '.'; exception when others then null; end $$;
create policy "Users manage own org invoices" on public.invoices for all using (org_id in (select org_id from public.profiles where id = auth.uid()));
do $$ begin execute 'drop policy if exists "' || 'Users view own org payables' || '" on ' || current_schema || '.'; exception when others then null; end $$;
create policy "Users view own org payables" on public.payables for select using (org_id in (select org_id from public.profiles where id = auth.uid()));
do $$ begin execute 'drop policy if exists "' || 'Users manage own org payables' || '" on ' || current_schema || '.'; exception when others then null; end $$;
create policy "Users manage own org payables" on public.payables for all using (org_id in (select org_id from public.profiles where id = auth.uid()));
do $$ begin execute 'drop policy if exists "' || 'Service manages invoices' || '" on ' || current_schema || '.'; exception when others then null; end $$;
create policy "Service manages invoices" on public.invoices for all using (true) with check (true);
do $$ begin execute 'drop policy if exists "' || 'Service manages payables' || '" on ' || current_schema || '.'; exception when others then null; end $$;
create policy "Service manages payables" on public.payables for all using (true) with check (true);
