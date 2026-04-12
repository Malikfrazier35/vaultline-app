-- ═══════════════════════════════════════════════════
-- 021: Missing tables for Team + Settings
-- ═══════════════════════════════════════════════════

-- ── invites: team invitation tokens ──
create table if not exists public.invites (
  id uuid primary key default gen_random_uuid(),
  org_id uuid not null references public.organizations(id) on delete cascade,
  email text not null,
  role text not null default 'member' check (role in ('admin', 'member', 'viewer')),
  token text unique not null default encode(gen_random_bytes(32), 'hex'),
  status text not null default 'pending' check (status in ('pending', 'accepted', 'revoked', 'expired')),
  invited_by uuid references auth.users(id),
  accepted_at timestamptz,
  expires_at timestamptz not null default (now() + interval '7 days'),
  created_at timestamptz not null default now()
);

create index if not exists idx_invites_org on public.invites(org_id, status);
create index if not exists idx_invites_token on public.invites(token) where status = 'pending';
create index if not exists idx_invites_email on public.invites(email, org_id);

alter table public.invites enable row level security;
create policy "invites_select" on public.invites for select using (true);
create policy "invites_insert" on public.invites for insert with check (true);
create policy "invites_update" on public.invites for update using (true);
create policy "invites_delete" on public.invites for delete using (true);

-- ── notification_settings: per-org alert configuration ──
create table if not exists public.notification_settings (
  id uuid primary key default gen_random_uuid(),
  org_id uuid unique not null references public.organizations(id) on delete cascade,
  low_cash_alerts boolean default true,
  low_cash_threshold numeric(14,2) default 100000,
  daily_position_email boolean default true,
  daily_email_time text default '08:00',
  large_transaction_alerts boolean default true,
  large_transaction_threshold numeric(14,2) default 50000,
  forecast_deviation_alerts boolean default false,
  forecast_deviation_pct int default 10,
  slack_enabled boolean default false,
  slack_webhook_url text,
  slack_channel text,
  email_recipients text[] default '{}',
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

alter table public.notification_settings enable row level security;
create policy "notif_select" on public.notification_settings for select using (true);
create policy "notif_insert" on public.notification_settings for insert with check (true);
create policy "notif_update" on public.notification_settings for update using (true);

-- ── active_sessions: track user sessions for revocation ──
create table if not exists public.active_sessions (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete cascade,
  org_id uuid references public.organizations(id) on delete cascade,
  session_token text,
  ip_address text,
  user_agent text,
  last_active_at timestamptz default now(),
  revoked_at timestamptz,
  created_at timestamptz not null default now()
);

create index if not exists idx_sessions_user on public.active_sessions(user_id) where revoked_at is null;

alter table public.active_sessions enable row level security;
create policy "sessions_all" on public.active_sessions for all using (true) with check (true);

-- ── security_events: security-relevant actions ──
create table if not exists public.security_events (
  id uuid primary key default gen_random_uuid(),
  org_id uuid references public.organizations(id) on delete cascade,
  user_id uuid references auth.users(id),
  event_type text not null,
  severity text default 'info' check (severity in ('info', 'warning', 'critical')),
  description text,
  metadata jsonb default '{}',
  ip_address text,
  resolved_at timestamptz,
  created_at timestamptz not null default now()
);

create index if not exists idx_security_events_org on public.security_events(org_id, created_at desc);
create index if not exists idx_security_events_type on public.security_events(event_type, severity);

alter table public.security_events enable row level security;
create policy "security_events_all" on public.security_events for all using (true) with check (true);

-- ── Add seat limit columns to organizations if missing ──
do $$ begin
  if not exists (select 1 from information_schema.columns where table_name = 'organizations' and column_name = 'max_team_members') then
    alter table public.organizations add column max_team_members int default 3;
  end if;
end $$;
