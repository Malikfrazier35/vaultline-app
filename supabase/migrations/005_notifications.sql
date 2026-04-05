-- Migration 005: Notification pipeline — in-app notifications + delivery history

create table if not exists public.notifications (
  id uuid primary key default gen_random_uuid(),
  org_id uuid not null references public.organizations(id) on delete cascade,
  user_id uuid references public.profiles(id), -- null = org-wide, set = specific user
  type text not null check (type in (
    'low_cash', 'large_transaction', 'forecast_deviation', 'runway_warning',
    'sync_failure', 'payment_failed', 'payment_success', 'trial_expiring',
    'team_invite', 'team_joined', 'anomaly_detected', 'forecast_ready',
    'account_activity', 'system', 'milestone'
  )),
  severity text not null default 'info' check (severity in ('critical', 'warning', 'info', 'success')),
  title text not null,
  body text,
  metadata jsonb default '{}'::jsonb,
  -- Delivery tracking
  channels_sent text[] default '{}', -- e.g. {'in_app', 'email', 'slack'}
  email_sent_at timestamptz,
  slack_sent_at timestamptz,
  -- User interaction
  read_at timestamptz,
  dismissed_at timestamptz,
  action_url text, -- deep link to relevant page
  -- Lifecycle
  created_at timestamptz not null default now(),
  expires_at timestamptz default (now() + interval '30 days')
);

create index if not exists idx_notifications_user on public.notifications(user_id, read_at, created_at desc) where dismissed_at is null;
create index if not exists idx_notifications_org on public.notifications(org_id, created_at desc);
create index if not exists idx_notifications_unread on public.notifications(user_id, created_at desc) where read_at is null and dismissed_at is null;
create index if not exists idx_notifications_type on public.notifications(org_id, type, created_at desc);

alter table public.notifications enable row level security;

do $$ begin execute 'drop policy if exists "' || 'Users see own notifications' || '" on ' || current_schema || '.'; exception when others then null; end $$;
create policy "Users see own notifications" on public.notifications for select
  using (user_id = auth.uid() or (user_id is null and org_id in (select org_id from public.profiles where id = auth.uid())));

do $$ begin execute 'drop policy if exists "' || 'Users can update own notifications' || '" on ' || current_schema || '.'; exception when others then null; end $$;
create policy "Users can update own notifications" on public.notifications for update
  using (user_id = auth.uid() or (user_id is null and org_id in (select org_id from public.profiles where id = auth.uid())));

do $$ begin execute 'drop policy if exists "' || 'Service manages notifications' || '" on ' || current_schema || '.'; exception when others then null; end $$;
create policy "Service manages notifications" on public.notifications for all using (true) with check (true);
