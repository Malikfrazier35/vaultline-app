-- Migration 009: Digital Customer Navigation + Digital Memory/Autosave

-- ═══════════════════════════════════════════════════
-- 1. DIGITAL CUSTOMER NAVIGATION PIPELINE
-- ═══════════════════════════════════════════════════

-- ── page_views: every page visit with timing + context ──
create table if not exists public.page_views (
  id uuid primary key default gen_random_uuid(),
  org_id uuid references public.organizations(id) on delete cascade,
  user_id uuid references public.profiles(id) on delete set null,
  session_id text not null,
  page_path text not null,
  page_title text,
  referrer_path text, -- previous page within app
  -- Engagement
  time_on_page_ms int,
  scroll_depth_pct int default 0,
  interactions int default 0, -- clicks, form inputs, toggles
  -- Context
  entry_point boolean not null default false, -- first page of session
  exit_point boolean not null default false,
  device_type text check (device_type in ('desktop', 'mobile', 'tablet')),
  viewport_width int,
  viewport_height int,
  -- UTM (for first-touch attribution)
  utm_source text,
  utm_medium text,
  utm_campaign text,
  created_at timestamptz not null default now()
);

-- ── feature_events: granular feature adoption tracking ──
create table if not exists public.feature_events (
  id uuid primary key default gen_random_uuid(),
  org_id uuid references public.organizations(id) on delete cascade,
  user_id uuid references public.profiles(id) on delete set null,
  session_id text not null,
  feature text not null, -- e.g. 'copilot_opened', 'forecast_model_switched', 'report_generated'
  action text not null default 'used' check (action in ('viewed', 'used', 'configured', 'dismissed', 'upgraded', 'errored')),
  context jsonb default '{}'::jsonb, -- page, trigger, metadata
  created_at timestamptz not null default now()
);

-- ── navigation_flows: session-level path reconstruction ──
create table if not exists public.navigation_flows (
  id uuid primary key default gen_random_uuid(),
  org_id uuid references public.organizations(id) on delete cascade,
  user_id uuid references public.profiles(id) on delete set null,
  session_id text not null unique,
  -- Session metadata
  started_at timestamptz not null default now(),
  ended_at timestamptz,
  duration_ms int,
  page_count int default 0,
  -- Path
  entry_page text,
  exit_page text,
  path_sequence text[] default '{}', -- ordered list of pages visited
  -- Engagement summary
  total_interactions int default 0,
  features_used text[] default '{}',
  -- Source
  referrer text,
  utm_source text,
  utm_medium text,
  device_type text,
  created_at timestamptz not null default now()
);

-- ── onboarding_progress: step-by-step onboarding completion ──
create table if not exists public.onboarding_progress (
  id uuid primary key default gen_random_uuid(),
  org_id uuid not null references public.organizations(id) on delete cascade,
  user_id uuid not null references public.profiles(id),
  step_id text not null, -- e.g. 'connect_bank', 'company_profile', 'invite_team', 'set_alerts'
  step_name text not null,
  status text not null default 'pending' check (status in ('pending', 'in_progress', 'completed', 'skipped')),
  started_at timestamptz,
  completed_at timestamptz,
  time_spent_ms int,
  metadata jsonb default '{}'::jsonb,
  created_at timestamptz not null default now(),
  unique(org_id, user_id, step_id)
);

-- ── engagement_scores: daily per-user engagement scoring ──
create table if not exists public.engagement_scores (
  id uuid primary key default gen_random_uuid(),
  org_id uuid not null references public.organizations(id) on delete cascade,
  user_id uuid not null references public.profiles(id),
  date date not null default current_date,
  score int not null default 0 check (score between 0 and 100),
  -- Components
  login_streak int default 0,
  pages_visited int default 0,
  features_used int default 0,
  time_spent_minutes int default 0,
  actions_taken int default 0,
  -- Risk
  churn_risk text check (churn_risk in ('low', 'medium', 'high', 'critical')),
  last_active_at timestamptz,
  created_at timestamptz not null default now(),
  unique(org_id, user_id, date)
);

-- ═══════════════════════════════════════════════════
-- 2. DIGITAL MEMORY / AUTOSAVE PIPELINE
-- ═══════════════════════════════════════════════════

-- ── user_drafts: auto-saved form state + document drafts ──
create table if not exists public.user_drafts (
  id uuid primary key default gen_random_uuid(),
  org_id uuid not null references public.organizations(id) on delete cascade,
  user_id uuid not null references public.profiles(id),
  draft_type text not null check (draft_type in (
    'report', 'ticket', 'invoice', 'payable', 'scenario', 'forecast_config',
    'settings', 'team_invite', 'copilot_prompt', 'data_import', 'custom'
  )),
  draft_key text not null, -- unique identifier within type, e.g. 'new_ticket', 'report_cash_flow'
  title text,
  data jsonb not null default '{}'::jsonb,
  version int not null default 1,
  -- Lifecycle
  auto_saved boolean not null default true,
  last_saved_at timestamptz not null default now(),
  expires_at timestamptz default (now() + interval '30 days'),
  restored_at timestamptz,
  unique(org_id, user_id, draft_type, draft_key)
);

-- ── user_preferences: persistent per-user UI state ──
create table if not exists public.user_preferences (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references public.profiles(id) on delete cascade,
  -- Page-specific state
  preferences jsonb not null default '{}'::jsonb,
  -- Structured common prefs
  default_dashboard_period text default '30d',
  default_forecast_model text default 'linear',
  default_chart_type text default 'area',
  sidebar_collapsed boolean default false,
  theme text default 'dark',
  table_density text default 'comfortable' check (table_density in ('compact', 'comfortable', 'spacious')),
  date_format text default 'MMM d, yyyy',
  number_format text default 'en-US',
  timezone text default 'America/New_York',
  -- Feature-specific
  copilot_suggestions_shown boolean default true,
  onboarding_completed boolean default false,
  command_palette_recent text[] default '{}',
  pinned_pages text[] default '{}',
  -- Updated
  updated_at timestamptz not null default now(),
  unique(user_id)
);

-- ── session_snapshots: full page state for crash recovery ──
create table if not exists public.session_snapshots (
  id uuid primary key default gen_random_uuid(),
  org_id uuid not null references public.organizations(id) on delete cascade,
  user_id uuid not null references public.profiles(id),
  session_id text not null,
  page_path text not null,
  page_state jsonb not null default '{}'::jsonb, -- serialized component state
  scroll_position int default 0,
  active_tab text,
  active_modal text,
  form_data jsonb default '{}'::jsonb, -- any unsaved form inputs
  snapshot_at timestamptz not null default now(),
  expires_at timestamptz default (now() + interval '24 hours')
);

-- ── undo_history: operation-level undo/redo stack ──
create table if not exists public.undo_history (
  id uuid primary key default gen_random_uuid(),
  org_id uuid not null references public.organizations(id) on delete cascade,
  user_id uuid not null references public.profiles(id),
  session_id text not null,
  operation_type text not null, -- e.g. 'transaction_categorized', 'alert_threshold_changed', 'invoice_updated'
  entity_type text not null, -- 'transaction', 'account', 'invoice', 'setting', etc.
  entity_id text,
  previous_state jsonb not null,
  new_state jsonb not null,
  undone boolean not null default false,
  undone_at timestamptz,
  created_at timestamptz not null default now(),
  expires_at timestamptz default (now() + interval '7 days')
);

-- ═══════════════════════════════════════════════════
-- INDEXES
-- ═══════════════════════════════════════════════════

-- Navigation
create index if not exists idx_pageviews_org on public.page_views(org_id, created_at desc);
create index if not exists idx_pageviews_session on public.page_views(session_id, created_at);
create index if not exists idx_pageviews_path on public.page_views(page_path, created_at desc);
create index if not exists idx_pageviews_user on public.page_views(user_id, created_at desc);
create index if not exists idx_feature_events_org on public.feature_events(org_id, feature, created_at desc);
create index if not exists idx_feature_events_session on public.feature_events(session_id, created_at);
create index if not exists idx_nav_flows_org on public.navigation_flows(org_id, started_at desc);
create index if not exists idx_nav_flows_session on public.navigation_flows(session_id);
create index if not exists idx_onboarding_org on public.onboarding_progress(org_id, user_id);
create index if not exists idx_engagement_org on public.engagement_scores(org_id, date desc);
create index if not exists idx_engagement_user on public.engagement_scores(user_id, date desc);
create index if not exists idx_engagement_risk on public.engagement_scores(churn_risk, date desc) where churn_risk in ('high', 'critical');

-- Memory/Autosave
create index if not exists idx_drafts_user on public.user_drafts(user_id, draft_type, last_saved_at desc);
create index if not exists idx_drafts_org on public.user_drafts(org_id, user_id, draft_type, draft_key);
create index if not exists idx_prefs_user on public.user_preferences(user_id);
create index if not exists idx_snapshots_user on public.session_snapshots(user_id, session_id, snapshot_at desc);
create index if not exists idx_snapshots_expiry on public.session_snapshots(expires_at) where expires_at < now();
create index if not exists idx_undo_user on public.undo_history(user_id, session_id, created_at desc);
create index if not exists idx_undo_entity on public.undo_history(entity_type, entity_id);

-- ═══════════════════════════════════════════════════
-- RLS
-- ═══════════════════════════════════════════════════

alter table public.page_views enable row level security;
alter table public.feature_events enable row level security;
alter table public.navigation_flows enable row level security;
alter table public.onboarding_progress enable row level security;
alter table public.engagement_scores enable row level security;
alter table public.user_drafts enable row level security;
alter table public.user_preferences enable row level security;
alter table public.session_snapshots enable row level security;
alter table public.undo_history enable row level security;

-- Users see own data
do $$ begin execute 'drop policy if exists "' || 'Users view own page views' || '" on ' || current_schema || '.'; exception when others then null; end $$;
create policy "Users view own page views" on public.page_views for select using (user_id = auth.uid());
do $$ begin execute 'drop policy if exists "' || 'Users view own feature events' || '" on ' || current_schema || '.'; exception when others then null; end $$;
create policy "Users view own feature events" on public.feature_events for select using (user_id = auth.uid());
do $$ begin execute 'drop policy if exists "' || 'Users view own nav flows' || '" on ' || current_schema || '.'; exception when others then null; end $$;
create policy "Users view own nav flows" on public.navigation_flows for select using (user_id = auth.uid());
do $$ begin execute 'drop policy if exists "' || 'Users view own onboarding' || '" on ' || current_schema || '.'; exception when others then null; end $$;
create policy "Users view own onboarding" on public.onboarding_progress for select using (user_id = auth.uid());
do $$ begin execute 'drop policy if exists "' || 'Users manage own onboarding' || '" on ' || current_schema || '.'; exception when others then null; end $$;
create policy "Users manage own onboarding" on public.onboarding_progress for all using (user_id = auth.uid());
do $$ begin execute 'drop policy if exists "' || 'Users view own engagement' || '" on ' || current_schema || '.'; exception when others then null; end $$;
create policy "Users view own engagement" on public.engagement_scores for select using (user_id = auth.uid());
do $$ begin execute 'drop policy if exists "' || 'Users manage own drafts' || '" on ' || current_schema || '.'; exception when others then null; end $$;
create policy "Users manage own drafts" on public.user_drafts for all using (user_id = auth.uid());
do $$ begin execute 'drop policy if exists "' || 'Users manage own prefs' || '" on ' || current_schema || '.'; exception when others then null; end $$;
create policy "Users manage own prefs" on public.user_preferences for all using (user_id = auth.uid());
do $$ begin execute 'drop policy if exists "' || 'Users manage own snapshots' || '" on ' || current_schema || '.'; exception when others then null; end $$;
create policy "Users manage own snapshots" on public.session_snapshots for all using (user_id = auth.uid());
do $$ begin execute 'drop policy if exists "' || 'Users manage own undo' || '" on ' || current_schema || '.'; exception when others then null; end $$;
create policy "Users manage own undo" on public.undo_history for all using (user_id = auth.uid());

-- Admins see org-level analytics
do $$ begin execute 'drop policy if exists "' || 'Admins view org page views' || '" on ' || current_schema || '.'; exception when others then null; end $$;
create policy "Admins view org page views" on public.page_views for select using (org_id in (select org_id from public.profiles where id = auth.uid() and role in ('owner', 'admin')));
do $$ begin execute 'drop policy if exists "' || 'Admins view org feature events' || '" on ' || current_schema || '.'; exception when others then null; end $$;
create policy "Admins view org feature events" on public.feature_events for select using (org_id in (select org_id from public.profiles where id = auth.uid() and role in ('owner', 'admin')));
do $$ begin execute 'drop policy if exists "' || 'Admins view org nav flows' || '" on ' || current_schema || '.'; exception when others then null; end $$;
create policy "Admins view org nav flows" on public.navigation_flows for select using (org_id in (select org_id from public.profiles where id = auth.uid() and role in ('owner', 'admin')));
do $$ begin execute 'drop policy if exists "' || 'Admins view org engagement' || '" on ' || current_schema || '.'; exception when others then null; end $$;
create policy "Admins view org engagement" on public.engagement_scores for select using (org_id in (select org_id from public.profiles where id = auth.uid() and role in ('owner', 'admin')));

-- Service role for all writes
do $$ begin execute 'drop policy if exists "' || 'Service manages page views' || '" on ' || current_schema || '.'; exception when others then null; end $$;
create policy "Service manages page views" on public.page_views for all using (true) with check (true);
do $$ begin execute 'drop policy if exists "' || 'Service manages feature events' || '" on ' || current_schema || '.'; exception when others then null; end $$;
create policy "Service manages feature events" on public.feature_events for all using (true) with check (true);
do $$ begin execute 'drop policy if exists "' || 'Service manages nav flows' || '" on ' || current_schema || '.'; exception when others then null; end $$;
create policy "Service manages nav flows" on public.navigation_flows for all using (true) with check (true);
do $$ begin execute 'drop policy if exists "' || 'Service manages engagement' || '" on ' || current_schema || '.'; exception when others then null; end $$;
create policy "Service manages engagement" on public.engagement_scores for all using (true) with check (true);
do $$ begin execute 'drop policy if exists "' || 'Service manages snapshots' || '" on ' || current_schema || '.'; exception when others then null; end $$;
create policy "Service manages snapshots" on public.session_snapshots for all using (true) with check (true);
do $$ begin execute 'drop policy if exists "' || 'Service manages undo' || '" on ' || current_schema || '.'; exception when others then null; end $$;
create policy "Service manages undo" on public.undo_history for all using (true) with check (true);
do $$ begin execute 'drop policy if exists "' || 'Service manages prefs' || '" on ' || current_schema || '.'; exception when others then null; end $$;
create policy "Service manages prefs" on public.user_preferences for all using (true) with check (true);
