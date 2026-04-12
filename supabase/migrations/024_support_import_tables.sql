-- ═══════════════════════════════════════════════════
-- 024: Support + Import tables
-- ═══════════════════════════════════════════════════

-- ── support_tickets ──
create table if not exists public.support_tickets (
  id uuid primary key default gen_random_uuid(),
  org_id uuid not null references public.organizations(id) on delete cascade,
  created_by uuid references auth.users(id),
  subject text not null,
  status text not null default 'open' check (status in ('open','in_progress','waiting_customer','waiting_internal','resolved','closed')),
  priority text not null default 'medium' check (priority in ('critical','high','medium','low')),
  category text default 'general',
  csat_score int check (csat_score between 1 and 5),
  first_response_at timestamptz,
  resolved_at timestamptz,
  closed_at timestamptz,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create index if not exists idx_tickets_org on public.support_tickets(org_id, status, created_at desc);
alter table public.support_tickets enable row level security;
create policy "tickets_all" on public.support_tickets for all using (true) with check (true);

-- ── ticket_messages ──
create table if not exists public.ticket_messages (
  id uuid primary key default gen_random_uuid(),
  ticket_id uuid not null references public.support_tickets(id) on delete cascade,
  sender_type text not null default 'customer' check (sender_type in ('customer','agent','system')),
  sender_id uuid,
  body text not null,
  is_internal boolean default false,
  created_at timestamptz not null default now()
);

create index if not exists idx_messages_ticket on public.ticket_messages(ticket_id, created_at);
alter table public.ticket_messages enable row level security;
create policy "messages_all" on public.ticket_messages for all using (true) with check (true);

-- ── data_imports ──
create table if not exists public.data_imports (
  id uuid primary key default gen_random_uuid(),
  org_id uuid not null references public.organizations(id) on delete cascade,
  source text not null default 'csv',
  file_name text,
  total_rows int default 0,
  imported_rows int default 0,
  skipped_rows int default 0,
  status text default 'completed' check (status in ('pending','processing','completed','failed')),
  error_message text,
  created_at timestamptz not null default now()
);

create index if not exists idx_imports_org on public.data_imports(org_id, created_at desc);
alter table public.data_imports enable row level security;
create policy "imports_all" on public.data_imports for all using (true) with check (true);

-- ── qb_connections ──
create table if not exists public.qb_connections (
  id uuid primary key default gen_random_uuid(),
  org_id uuid not null references public.organizations(id) on delete cascade,
  realm_id text,
  company_name text,
  access_token text,
  refresh_token text,
  token_expires_at timestamptz,
  status text default 'connected',
  last_synced_at timestamptz,
  created_at timestamptz not null default now()
);

alter table public.qb_connections enable row level security;
create policy "qb_all" on public.qb_connections for all using (true) with check (true);

-- ── accounting_connections ──
create table if not exists public.accounting_connections (
  id uuid primary key default gen_random_uuid(),
  org_id uuid not null references public.organizations(id) on delete cascade,
  provider text not null,
  tenant_id text,
  company_name text,
  access_token text,
  refresh_token text,
  token_expires_at timestamptz,
  status text default 'connected',
  last_synced_at timestamptz,
  created_at timestamptz not null default now()
);

alter table public.accounting_connections enable row level security;
create policy "acct_conn_all" on public.accounting_connections for all using (true) with check (true);

-- ── kb_articles (knowledge base) ──
create table if not exists public.kb_articles (
  id uuid primary key default gen_random_uuid(),
  title text not null,
  slug text unique not null,
  body text not null,
  category text default 'general',
  helpful_count int default 0,
  not_helpful_count int default 0,
  is_published boolean default true,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

alter table public.kb_articles enable row level security;
create policy "kb_read" on public.kb_articles for select using (true);
create policy "kb_write" on public.kb_articles for all using (true) with check (true);
