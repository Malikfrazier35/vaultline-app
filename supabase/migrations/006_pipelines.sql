-- Migration 006: Customer Care, QA/Monitoring, B2B Partner pipelines

-- ═══════════════════════════════════════════════════
-- 1. CUSTOMER CARE PIPELINE
-- ═══════════════════════════════════════════════════

-- ── support_tickets: full lifecycle ticket system ──
create table if not exists public.support_tickets (
  id uuid primary key default gen_random_uuid(),
  org_id uuid not null references public.organizations(id) on delete cascade,
  created_by uuid references public.profiles(id),
  assigned_to text, -- admin email or agent name
  subject text not null,
  body text not null,
  category text not null default 'general' check (category in (
    'general', 'billing', 'integration', 'bug', 'feature_request',
    'data_issue', 'security', 'onboarding', 'account'
  )),
  priority text not null default 'medium' check (priority in ('critical', 'high', 'medium', 'low')),
  status text not null default 'open' check (status in ('open', 'in_progress', 'waiting_customer', 'waiting_internal', 'resolved', 'closed')),
  source text not null default 'app' check (source in ('app', 'email', 'api', 'chat', 'phone')),
  tags text[] default '{}',
  -- SLA tracking
  first_response_at timestamptz,
  resolved_at timestamptz,
  sla_breach boolean not null default false,
  -- Satisfaction
  csat_score int check (csat_score between 1 and 5),
  csat_feedback text,
  -- Metadata
  metadata jsonb default '{}'::jsonb,
  page_url text,
  user_agent text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

-- ── ticket_messages: threaded conversation on tickets ──
create table if not exists public.ticket_messages (
  id uuid primary key default gen_random_uuid(),
  ticket_id uuid not null references public.support_tickets(id) on delete cascade,
  sender_type text not null check (sender_type in ('customer', 'agent', 'system')),
  sender_id uuid references public.profiles(id),
  sender_name text,
  body text not null,
  attachments jsonb default '[]'::jsonb,
  is_internal boolean not null default false, -- internal notes not visible to customer
  created_at timestamptz not null default now()
);

-- ── knowledge_base: self-service help articles ──
create table if not exists public.knowledge_base (
  id uuid primary key default gen_random_uuid(),
  slug text unique not null,
  title text not null,
  body text not null,
  category text not null check (category in (
    'getting_started', 'bank_connections', 'forecasting', 'billing',
    'integrations', 'security', 'api', 'troubleshooting', 'faq'
  )),
  tags text[] default '{}',
  views int not null default 0,
  helpful_yes int not null default 0,
  helpful_no int not null default 0,
  status text not null default 'published' check (status in ('draft', 'published', 'archived')),
  author text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

-- ── csat_surveys: post-interaction satisfaction tracking ──
create table if not exists public.csat_surveys (
  id uuid primary key default gen_random_uuid(),
  org_id uuid not null references public.organizations(id) on delete cascade,
  user_id uuid references public.profiles(id),
  trigger_type text not null check (trigger_type in ('ticket_resolved', 'onboarding_complete', 'nps', 'feature_use', 'quarterly')),
  trigger_id uuid, -- e.g. ticket_id, milestone_id
  score int not null check (score between 1 and 10),
  feedback text,
  tags text[] default '{}',
  created_at timestamptz not null default now()
);

-- ═══════════════════════════════════════════════════
-- 2. QUALITY ASSURANCE / MONITORING PIPELINE
-- ═══════════════════════════════════════════════════

-- ── system_health: periodic health check snapshots ──
create table if not exists public.system_health (
  id uuid primary key default gen_random_uuid(),
  service text not null check (service in (
    'api', 'plaid_sync', 'qb_sync', 'acct_sync', 'stripe',
    'forecast_engine', 'copilot', 'fx_rates', 'edge_functions', 'database'
  )),
  status text not null check (status in ('operational', 'degraded', 'partial_outage', 'major_outage', 'maintenance')),
  response_time_ms int,
  error_rate numeric(5,2) default 0, -- percentage
  details jsonb default '{}'::jsonb,
  checked_at timestamptz not null default now()
);

-- ── incidents: incident tracking and resolution ──
create table if not exists public.incidents (
  id uuid primary key default gen_random_uuid(),
  title text not null,
  description text,
  severity text not null check (severity in ('critical', 'major', 'minor', 'maintenance')),
  status text not null default 'investigating' check (status in (
    'investigating', 'identified', 'monitoring', 'resolved', 'postmortem'
  )),
  services_affected text[] default '{}',
  started_at timestamptz not null default now(),
  identified_at timestamptz,
  resolved_at timestamptz,
  postmortem_url text,
  created_by text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

-- ── incident_updates: timeline updates on incidents ──
create table if not exists public.incident_updates (
  id uuid primary key default gen_random_uuid(),
  incident_id uuid not null references public.incidents(id) on delete cascade,
  status text not null,
  body text not null,
  created_by text,
  created_at timestamptz not null default now()
);

-- ── error_events: aggregated error tracking ──
create table if not exists public.error_events (
  id uuid primary key default gen_random_uuid(),
  org_id uuid references public.organizations(id) on delete set null,
  service text not null,
  error_type text not null, -- e.g. 'plaid_sync_failure', 'stripe_webhook_error', 'forecast_model_error'
  error_message text,
  stack_trace text,
  metadata jsonb default '{}'::jsonb,
  resolved boolean not null default false,
  created_at timestamptz not null default now()
);

-- ── sync_health: per-org data pipeline health ──
create table if not exists public.sync_health (
  id uuid primary key default gen_random_uuid(),
  org_id uuid not null references public.organizations(id) on delete cascade,
  provider text not null, -- 'plaid', 'quickbooks', 'xero', 'sage', 'csv'
  connection_id uuid,
  status text not null check (status in ('healthy', 'degraded', 'failed', 'stale')),
  last_sync_at timestamptz,
  last_error text,
  records_synced int default 0,
  error_count int default 0,
  consecutive_failures int default 0,
  checked_at timestamptz not null default now()
);

-- ═══════════════════════════════════════════════════
-- 3. B2B PARTNER PIPELINE
-- ═══════════════════════════════════════════════════

-- ── partners: partner organizations ──
create table if not exists public.partners (
  id uuid primary key default gen_random_uuid(),
  name text not null,
  type text not null check (type in ('referral', 'reseller', 'technology', 'consulting', 'integration')),
  tier text not null default 'standard' check (tier in ('standard', 'silver', 'gold', 'platinum')),
  status text not null default 'pending' check (status in ('pending', 'active', 'suspended', 'terminated')),
  -- Contact
  contact_name text,
  contact_email text,
  company_url text,
  -- Commercial
  commission_pct numeric(5,2) default 10,
  revenue_share_pct numeric(5,2) default 0,
  referral_code text unique,
  -- Integration
  api_key text unique,
  webhook_url text,
  webhook_events text[] default '{}',
  -- Tracking
  total_referrals int not null default 0,
  total_revenue numeric(14,2) not null default 0,
  total_customers int not null default 0,
  -- Lifecycle
  activated_at timestamptz,
  last_activity_at timestamptz,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

-- ── partner_referrals: tracks each referral through the funnel ──
create table if not exists public.partner_referrals (
  id uuid primary key default gen_random_uuid(),
  partner_id uuid not null references public.partners(id) on delete cascade,
  referred_email text not null,
  referred_org_id uuid references public.organizations(id),
  status text not null default 'pending' check (status in ('pending', 'signed_up', 'trialing', 'converted', 'churned')),
  plan text,
  mrr numeric(10,2) default 0,
  commission_amount numeric(10,2) default 0,
  commission_paid boolean not null default false,
  commission_paid_at timestamptz,
  attributed_at timestamptz,
  converted_at timestamptz,
  created_at timestamptz not null default now()
);

-- ── partner_webhooks_log: delivery audit trail ──
create table if not exists public.partner_webhooks_log (
  id uuid primary key default gen_random_uuid(),
  partner_id uuid not null references public.partners(id) on delete cascade,
  event_type text not null,
  payload jsonb not null,
  response_status int,
  response_body text,
  delivered boolean not null default false,
  attempts int not null default 0,
  next_retry_at timestamptz,
  created_at timestamptz not null default now()
);

-- ═══════════════════════════════════════════════════
-- INDEXES
-- ═══════════════════════════════════════════════════

-- Customer care
create index if not exists idx_tickets_org on public.support_tickets(org_id, status, created_at desc);
create index if not exists idx_tickets_status on public.support_tickets(status, priority, created_at desc);
create index if not exists idx_tickets_assigned on public.support_tickets(assigned_to, status);
create index if not exists idx_ticket_messages_ticket on public.ticket_messages(ticket_id, created_at);
create index if not exists idx_kb_category on public.knowledge_base(category, status);
create index if not exists idx_kb_slug on public.knowledge_base(slug) where status = 'published';
create index if not exists idx_csat_org on public.csat_surveys(org_id, created_at desc);
create index if not exists idx_csat_trigger on public.csat_surveys(trigger_type, created_at desc);

-- QA/Monitoring
create index if not exists idx_health_service on public.system_health(service, checked_at desc);
create index if not exists idx_incidents_status on public.incidents(status, started_at desc);
create index if not exists idx_incident_updates_incident on public.incident_updates(incident_id, created_at);
create index if not exists idx_errors_service on public.error_events(service, created_at desc);
create index if not exists idx_errors_org on public.error_events(org_id, created_at desc);
create index if not exists idx_sync_health_org on public.sync_health(org_id, provider);

-- Partner
create index if not exists idx_partners_status on public.partners(status, type);
create index if not exists idx_partners_referral on public.partners(referral_code) where status = 'active';
create index if not exists idx_partners_api on public.partners(api_key) where status = 'active';
create index if not exists idx_referrals_partner on public.partner_referrals(partner_id, status);
create index if not exists idx_referrals_email on public.partner_referrals(referred_email);
create index if not exists idx_webhooks_partner on public.partner_webhooks_log(partner_id, created_at desc);

-- ═══════════════════════════════════════════════════
-- RLS
-- ═══════════════════════════════════════════════════

alter table public.support_tickets enable row level security;
alter table public.ticket_messages enable row level security;
alter table public.knowledge_base enable row level security;
alter table public.csat_surveys enable row level security;
alter table public.system_health enable row level security;
alter table public.incidents enable row level security;
alter table public.incident_updates enable row level security;
alter table public.error_events enable row level security;
alter table public.sync_health enable row level security;
alter table public.partners enable row level security;
alter table public.partner_referrals enable row level security;
alter table public.partner_webhooks_log enable row level security;

-- Tickets: org-scoped
do $$ begin execute 'drop policy if exists "' || 'Users view own org tickets' || '" on ' || current_schema || '.'; exception when others then null; end $$;
create policy "Users view own org tickets" on public.support_tickets for select using (org_id in (select org_id from public.profiles where id = auth.uid()));
do $$ begin execute 'drop policy if exists "' || 'Users create own org tickets' || '" on ' || current_schema || '.'; exception when others then null; end $$;
create policy "Users create own org tickets" on public.support_tickets for insert with check (org_id in (select org_id from public.profiles where id = auth.uid()));
do $$ begin execute 'drop policy if exists "' || 'Users update own org tickets' || '" on ' || current_schema || '.'; exception when others then null; end $$;
create policy "Users update own org tickets" on public.support_tickets for update using (org_id in (select org_id from public.profiles where id = auth.uid()));

-- Ticket messages: via ticket org
do $$ begin execute 'drop policy if exists "' || 'Users view ticket messages' || '" on ' || current_schema || '.'; exception when others then null; end $$;
create policy "Users view ticket messages" on public.ticket_messages for select using (ticket_id in (select id from public.support_tickets where org_id in (select org_id from public.profiles where id = auth.uid())));
do $$ begin execute 'drop policy if exists "' || 'Users create ticket messages' || '" on ' || current_schema || '.'; exception when others then null; end $$;
create policy "Users create ticket messages" on public.ticket_messages for insert with check (ticket_id in (select id from public.support_tickets where org_id in (select org_id from public.profiles where id = auth.uid())));

-- KB: public read
do $$ begin execute 'drop policy if exists "' || 'Anyone reads published KB' || '" on ' || current_schema || '.'; exception when others then null; end $$;
create policy "Anyone reads published KB" on public.knowledge_base for select using (status = 'published');

-- CSAT: org-scoped
do $$ begin execute 'drop policy if exists "' || 'Users view own org CSAT' || '" on ' || current_schema || '.'; exception when others then null; end $$;
create policy "Users view own org CSAT" on public.csat_surveys for select using (org_id in (select org_id from public.profiles where id = auth.uid()));
do $$ begin execute 'drop policy if exists "' || 'Users create CSAT' || '" on ' || current_schema || '.'; exception when others then null; end $$;
create policy "Users create CSAT" on public.csat_surveys for insert with check (org_id in (select org_id from public.profiles where id = auth.uid()));

-- System health / incidents: public read (status page)
do $$ begin execute 'drop policy if exists "' || 'Anyone reads system health' || '" on ' || current_schema || '.'; exception when others then null; end $$;
create policy "Anyone reads system health" on public.system_health for select using (true);
do $$ begin execute 'drop policy if exists "' || 'Anyone reads incidents' || '" on ' || current_schema || '.'; exception when others then null; end $$;
create policy "Anyone reads incidents" on public.incidents for select using (true);
do $$ begin execute 'drop policy if exists "' || 'Anyone reads incident updates' || '" on ' || current_schema || '.'; exception when others then null; end $$;
create policy "Anyone reads incident updates" on public.incident_updates for select using (true);

-- Errors: org-scoped + admin
do $$ begin execute 'drop policy if exists "' || 'Users view own org errors' || '" on ' || current_schema || '.'; exception when others then null; end $$;
create policy "Users view own org errors" on public.error_events for select using (org_id in (select org_id from public.profiles where id = auth.uid()));

-- Sync health: org-scoped
do $$ begin execute 'drop policy if exists "' || 'Users view own org sync health' || '" on ' || current_schema || '.'; exception when others then null; end $$;
create policy "Users view own org sync health" on public.sync_health for select using (org_id in (select org_id from public.profiles where id = auth.uid()));

-- Service role for all write ops
do $$ begin execute 'drop policy if exists "' || 'Service manages tickets' || '" on ' || current_schema || '.'; exception when others then null; end $$;
create policy "Service manages tickets" on public.support_tickets for all using (true) with check (true);
do $$ begin execute 'drop policy if exists "' || 'Service manages ticket messages' || '" on ' || current_schema || '.'; exception when others then null; end $$;
create policy "Service manages ticket messages" on public.ticket_messages for all using (true) with check (true);
do $$ begin execute 'drop policy if exists "' || 'Service manages KB' || '" on ' || current_schema || '.'; exception when others then null; end $$;
create policy "Service manages KB" on public.knowledge_base for all using (true) with check (true);
do $$ begin execute 'drop policy if exists "' || 'Service manages health' || '" on ' || current_schema || '.'; exception when others then null; end $$;
create policy "Service manages health" on public.system_health for all using (true) with check (true);
do $$ begin execute 'drop policy if exists "' || 'Service manages incidents' || '" on ' || current_schema || '.'; exception when others then null; end $$;
create policy "Service manages incidents" on public.incidents for all using (true) with check (true);
do $$ begin execute 'drop policy if exists "' || 'Service manages incident updates' || '" on ' || current_schema || '.'; exception when others then null; end $$;
create policy "Service manages incident updates" on public.incident_updates for all using (true) with check (true);
do $$ begin execute 'drop policy if exists "' || 'Service manages errors' || '" on ' || current_schema || '.'; exception when others then null; end $$;
create policy "Service manages errors" on public.error_events for all using (true) with check (true);
do $$ begin execute 'drop policy if exists "' || 'Service manages sync health' || '" on ' || current_schema || '.'; exception when others then null; end $$;
create policy "Service manages sync health" on public.sync_health for all using (true) with check (true);
do $$ begin execute 'drop policy if exists "' || 'Service manages partners' || '" on ' || current_schema || '.'; exception when others then null; end $$;
create policy "Service manages partners" on public.partners for all using (true) with check (true);
do $$ begin execute 'drop policy if exists "' || 'Service manages referrals' || '" on ' || current_schema || '.'; exception when others then null; end $$;
create policy "Service manages referrals" on public.partner_referrals for all using (true) with check (true);
do $$ begin execute 'drop policy if exists "' || 'Service manages webhook logs' || '" on ' || current_schema || '.'; exception when others then null; end $$;
create policy "Service manages webhook logs" on public.partner_webhooks_log for all using (true) with check (true);
