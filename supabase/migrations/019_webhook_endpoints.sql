-- ═══════════════════════════════════════════════════
-- 019: Customer webhook endpoints + delivery log
-- ═══════════════════════════════════════════════════

create table if not exists public.webhook_endpoints (
  id uuid primary key default gen_random_uuid(),
  org_id uuid not null references public.organizations(id) on delete cascade,
  url text not null,
  events text[] not null default '{balance.updated,transaction.created}'::text[],
  secret text not null,
  status text not null default 'active' check (status in ('active', 'paused', 'deleted')),
  description text,
  metadata jsonb default '{}',
  failure_count int not null default 0,
  last_success_at timestamptz,
  last_failure_at timestamptz,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table if not exists public.webhook_deliveries (
  id uuid primary key default gen_random_uuid(),
  org_id uuid not null references public.organizations(id) on delete cascade,
  endpoint_id uuid not null references public.webhook_endpoints(id) on delete cascade,
  event_type text not null,
  payload jsonb not null,
  response_status int,
  response_body text,
  latency_ms int,
  attempt int not null default 1,
  status text not null default 'pending' check (status in ('pending', 'success', 'failed', 'retrying')),
  next_retry_at timestamptz,
  created_at timestamptz not null default now()
);

create index if not exists idx_webhook_ep_org on public.webhook_endpoints(org_id) where status = 'active';
create index if not exists idx_webhook_del_ep on public.webhook_deliveries(endpoint_id, created_at desc);
create index if not exists idx_webhook_del_retry on public.webhook_deliveries(status, next_retry_at) where status = 'retrying';

alter table public.webhook_endpoints enable row level security;
alter table public.webhook_deliveries enable row level security;

create policy "webhook_ep_all" on public.webhook_endpoints for all using (true) with check (true);
create policy "webhook_del_all" on public.webhook_deliveries for all using (true) with check (true);
