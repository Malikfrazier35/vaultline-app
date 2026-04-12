-- ═══════════════════════════════════════════════════
-- 022: Notifications table for alert delivery system
-- ═══════════════════════════════════════════════════

drop table if exists public.notifications cascade;

create table public.notifications (
  id uuid primary key default gen_random_uuid(),
  org_id uuid not null references public.organizations(id) on delete cascade,
  user_id uuid references auth.users(id),
  type text not null,
  severity text not null default 'info' check (severity in ('info', 'warning', 'critical', 'success')),
  title text not null,
  body text,
  metadata jsonb default '{}',
  action_url text,
  channels_sent text[] default '{in_app}',
  email_sent_at timestamptz,
  slack_sent_at timestamptz,
  read_at timestamptz,
  dismissed_at timestamptz,
  created_at timestamptz not null default now()
);

create index idx_notif_org on public.notifications(org_id, created_at desc);
create index idx_notif_unread on public.notifications(org_id) where read_at is null and dismissed_at is null;
create index idx_notif_type on public.notifications(org_id, type, created_at desc);

alter table public.notifications enable row level security;
create policy "notif_all" on public.notifications for all using (true) with check (true);

-- ═══ pg_cron: evaluate alerts every 6 hours ═══
-- Run this separately if pg_cron is enabled:
-- select cron.schedule('evaluate-alerts', '0 */6 * * *',
--   $$select net.http_post(
--     url := 'https://cosbviiihkxjdqcpksgv.supabase.co/functions/v1/notify',
--     headers := jsonb_build_object('Content-Type', 'application/json', 'Authorization', 'Bearer ' || current_setting('app.settings.service_role_key', true)),
--     body := '{"action":"evaluate_all"}'::jsonb
--   )$$
-- );
