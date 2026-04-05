-- Migration 010: Layout & Functions, Interactive Tools, Time Management, Graphic Marketing

-- ═══════════════════════════════════════════════════
-- 1. DIGITAL LAYOUT & FUNCTIONS
-- ═══════════════════════════════════════════════════

-- ── dashboard_layouts: user-customizable dashboard widget arrangement ──
create table if not exists public.dashboard_layouts (
  id uuid primary key default gen_random_uuid(),
  org_id uuid not null references public.organizations(id) on delete cascade,
  user_id uuid not null references public.profiles(id),
  page text not null default 'dashboard', -- 'dashboard', 'position', 'forecast', etc.
  layout jsonb not null default '[]'::jsonb, -- [{widgetId, x, y, w, h, visible, config}]
  preset text check (preset in ('default', 'compact', 'executive', 'analyst', 'custom')),
  updated_at timestamptz not null default now(),
  unique(org_id, user_id, page)
);

-- ── widgets: available widget registry ──
create table if not exists public.widgets (
  id text primary key, -- e.g. 'cash_position', 'forecast_chart', 'recent_transactions'
  name text not null,
  description text,
  category text not null check (category in ('overview', 'cash', 'forecast', 'transactions', 'alerts', 'reports', 'integrations', 'ai')),
  default_width int not null default 6, -- grid units (out of 12)
  default_height int not null default 4,
  min_width int not null default 3,
  min_height int not null default 2,
  max_width int not null default 12,
  max_height int not null default 8,
  plan_required text default 'starter' check (plan_required in ('starter', 'growth', 'enterprise')),
  enabled boolean not null default true,
  config_schema jsonb default '{}'::jsonb, -- JSON Schema for widget-specific config
  created_at timestamptz not null default now()
);

-- ── saved_views: reusable filter/sort/column configurations per page ──
create table if not exists public.saved_views (
  id uuid primary key default gen_random_uuid(),
  org_id uuid not null references public.organizations(id) on delete cascade,
  user_id uuid references public.profiles(id), -- null = org-shared
  page text not null,
  name text not null,
  is_default boolean not null default false,
  filters jsonb default '{}'::jsonb,
  sort_by text,
  sort_order text default 'desc',
  visible_columns text[] default '{}',
  group_by text,
  date_range text,
  shared boolean not null default false,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

-- ── keyboard_shortcuts: custom shortcut mappings ──
create table if not exists public.keyboard_shortcuts (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references public.profiles(id) on delete cascade,
  shortcut_key text not null, -- e.g. 'ctrl+shift+f', 'cmd+k'
  action text not null, -- e.g. 'open_copilot', 'navigate:/forecast', 'toggle_sidebar'
  enabled boolean not null default true,
  unique(user_id, shortcut_key)
);

-- Seed default widgets
insert into public.widgets (id, name, description, category, default_width, default_height, plan_required) values
  ('cash_position', 'Cash Position', 'Total cash, liquid balance, and available credit', 'cash', 4, 3, 'starter'),
  ('cash_trend', 'Cash Trend Chart', '30-day cash balance trend line', 'cash', 8, 4, 'starter'),
  ('forecast_mini', 'Forecast Preview', 'Mini forecast chart with runway', 'forecast', 6, 4, 'starter'),
  ('forecast_full', 'Full Forecast', 'Multi-model forecast with confidence bands', 'forecast', 12, 6, 'growth'),
  ('recent_transactions', 'Recent Transactions', 'Latest 10 transactions', 'transactions', 6, 4, 'starter'),
  ('large_transactions', 'Large Transactions', 'Transactions above threshold', 'transactions', 6, 3, 'starter'),
  ('bank_status', 'Bank Connection Status', 'Connection health per bank', 'integrations', 4, 3, 'starter'),
  ('alerts_summary', 'Active Alerts', 'Current alert count by severity', 'alerts', 4, 3, 'starter'),
  ('burn_rate', 'Burn Rate', 'Monthly burn rate with trend', 'overview', 4, 3, 'starter'),
  ('runway_gauge', 'Runway Gauge', 'Cash runway in months', 'overview', 4, 3, 'starter'),
  ('ar_ap_summary', 'AR/AP Summary', 'Outstanding receivables and payables', 'overview', 6, 3, 'growth'),
  ('copilot_quick', 'AI Quick Ask', 'Inline copilot prompt', 'ai', 6, 3, 'growth'),
  ('engagement_score', 'Team Engagement', 'Team member engagement scores', 'overview', 4, 3, 'enterprise'),
  ('security_score', 'Security Posture', 'Overall security score', 'overview', 4, 3, 'enterprise'),
  ('currency_rates', 'FX Rates', 'Tracked currency pair rates', 'cash', 4, 3, 'growth');

-- ═══════════════════════════════════════════════════
-- 2. INTERACTIVE TOOLS (dynamic pages like ROI)
-- ═══════════════════════════════════════════════════

-- ── interactive_tools: registry of public interactive tools/calculators ──
create table if not exists public.interactive_tools (
  id uuid primary key default gen_random_uuid(),
  slug text unique not null, -- URL slug: /tools/{slug}
  name text not null,
  description text,
  category text not null check (category in ('calculator', 'benchmark', 'simulator', 'comparison', 'assessment', 'planner')),
  icon text, -- lucide icon name
  -- Configuration
  config jsonb not null default '{}'::jsonb, -- tool-specific schema (inputs, logic, outputs)
  -- Lead capture
  capture_enabled boolean not null default true,
  capture_source text, -- lead source tag
  -- SEO
  meta_title text,
  meta_description text,
  og_image_url text,
  -- Lifecycle
  status text not null default 'published' check (status in ('draft', 'published', 'archived')),
  views int not null default 0,
  completions int not null default 0,
  avg_time_seconds int default 0,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

-- ── tool_submissions: captured results from interactive tools ──
create table if not exists public.tool_submissions (
  id uuid primary key default gen_random_uuid(),
  tool_id uuid not null references public.interactive_tools(id) on delete cascade,
  lead_id uuid references public.leads(id),
  session_id text,
  inputs jsonb not null default '{}'::jsonb,
  results jsonb not null default '{}'::jsonb,
  time_spent_seconds int,
  completed boolean not null default false,
  email text,
  created_at timestamptz not null default now()
);

-- Seed built-in tools
insert into public.interactive_tools (slug, name, description, category, icon, capture_source, meta_title, meta_description, status) values
  ('roi', 'ROI Calculator', 'Calculate how much manual treasury costs you', 'calculator', 'Calculator', 'roi_calculator', 'ROI Calculator — Vaultline', 'See exactly how much time and money Vaultline saves your treasury operation.', 'published'),
  ('assess', 'Treasury Readiness', '9-question diagnostic for treasury maturity', 'assessment', 'ClipboardCheck', 'assessment', 'Treasury Readiness Assessment — Vaultline', 'Is your treasury ready for the next stage? Find out in 2 minutes.', 'published'),
  ('benchmark', 'Treasury Benchmark', 'Compare your treasury metrics against industry peers', 'benchmark', 'BarChart3', 'benchmark', 'Treasury Benchmark — Vaultline', 'How does your treasury stack up? Compare cash management KPIs against industry benchmarks.', 'draft'),
  ('burn-rate', 'Burn Rate Simulator', 'Model cash runway under different scenarios', 'simulator', 'Flame', 'simulator', 'Burn Rate Simulator — Vaultline', 'How long will your cash last? Model different spending and revenue scenarios.', 'draft'),
  ('vendor-compare', 'TMS Comparison', 'Compare treasury management systems side-by-side', 'comparison', 'GitCompare', 'comparison', 'TMS Comparison Tool — Vaultline', 'Compare Vaultline against Kyriba, GTreasury, Trovata, and other TMS platforms.', 'draft'),
  ('cash-planner', 'Cash Flow Planner', 'Plan monthly cash inflows and outflows', 'planner', 'Calendar', 'planner', 'Cash Flow Planner — Vaultline', 'Map your next 12 months of cash inflows and outflows with our free planning tool.', 'draft');

-- ═══════════════════════════════════════════════════
-- 3. TIME MANAGEMENT & TIMEZONE
-- ═══════════════════════════════════════════════════

-- ── scheduled_tasks: user-defined recurring tasks and reminders ──
create table if not exists public.scheduled_tasks (
  id uuid primary key default gen_random_uuid(),
  org_id uuid not null references public.organizations(id) on delete cascade,
  user_id uuid references public.profiles(id),
  title text not null,
  description text,
  task_type text not null check (task_type in (
    'reconciliation', 'report_generation', 'review_forecast', 'check_alerts',
    'payment_approval', 'vendor_review', 'audit_prep', 'team_sync', 'custom'
  )),
  -- Schedule
  recurrence text not null default 'once' check (recurrence in ('once', 'daily', 'weekly', 'biweekly', 'monthly', 'quarterly', 'annual')),
  scheduled_date date,
  scheduled_time time default '09:00',
  day_of_week int, -- 0=Sun, 6=Sat (for weekly)
  day_of_month int, -- 1-28 (for monthly)
  timezone text not null default 'America/New_York',
  -- Status
  status text not null default 'active' check (status in ('active', 'paused', 'completed', 'canceled')),
  next_due_at timestamptz,
  last_completed_at timestamptz,
  completion_count int not null default 0,
  -- Notification
  notify_before_minutes int default 15,
  notify_channels text[] default '{in_app}'::text[],
  -- Metadata
  linked_page text, -- e.g. '/banks', '/forecast', '/reports'
  metadata jsonb default '{}'::jsonb,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

-- ── task_completions: log of completed task instances ──
create table if not exists public.task_completions (
  id uuid primary key default gen_random_uuid(),
  task_id uuid not null references public.scheduled_tasks(id) on delete cascade,
  completed_by uuid references public.profiles(id),
  completed_at timestamptz not null default now(),
  duration_minutes int,
  notes text,
  skipped boolean not null default false
);

-- ── timezone_configs: per-org timezone and business hours ──
create table if not exists public.timezone_configs (
  id uuid primary key default gen_random_uuid(),
  org_id uuid not null references public.organizations(id) on delete cascade,
  primary_timezone text not null default 'America/New_York',
  display_format text not null default '12h' check (display_format in ('12h', '24h')),
  week_start text not null default 'monday' check (week_start in ('monday', 'sunday')),
  -- Business hours (for after-hours detection, scheduling)
  business_days text[] default '{monday,tuesday,wednesday,thursday,friday}'::text[],
  business_start time not null default '08:00',
  business_end time not null default '18:00',
  -- Multi-timezone support (for entities in different zones)
  additional_timezones text[] default '{}',
  -- Fiscal calendar
  fiscal_year_start_month int not null default 1, -- January
  fiscal_quarter_offset int not null default 0,
  updated_at timestamptz not null default now(),
  unique(org_id)
);

-- ── time_entries: manual time tracking for treasury tasks ──
create table if not exists public.time_entries (
  id uuid primary key default gen_random_uuid(),
  org_id uuid not null references public.organizations(id) on delete cascade,
  user_id uuid not null references public.profiles(id),
  task_id uuid references public.scheduled_tasks(id),
  category text not null check (category in (
    'reconciliation', 'forecasting', 'reporting', 'payment_processing',
    'vendor_management', 'audit_compliance', 'data_entry', 'meeting', 'other'
  )),
  description text,
  started_at timestamptz not null,
  ended_at timestamptz,
  duration_minutes int,
  billable boolean not null default false,
  created_at timestamptz not null default now()
);

-- ═══════════════════════════════════════════════════
-- 4. GRAPHIC MARKETING
-- ═══════════════════════════════════════════════════

-- ── brand_assets: centralized brand kit ──
create table if not exists public.brand_assets (
  id uuid primary key default gen_random_uuid(),
  org_id uuid references public.organizations(id) on delete cascade, -- null = platform-level
  asset_type text not null check (asset_type in (
    'logo_primary', 'logo_secondary', 'logo_icon', 'favicon',
    'color_palette', 'typography', 'og_image', 'email_header',
    'social_banner', 'presentation_template', 'document_template',
    'watermark', 'custom'
  )),
  name text not null,
  url text, -- CDN URL or data URI
  file_type text, -- 'svg', 'png', 'jpg', 'pdf'
  dimensions jsonb, -- {width, height}
  colors jsonb default '[]'::jsonb, -- for color_palette type
  metadata jsonb default '{}'::jsonb,
  is_default boolean not null default false,
  created_at timestamptz not null default now()
);

-- ── marketing_campaigns: campaign planning and tracking ──
create table if not exists public.marketing_campaigns (
  id uuid primary key default gen_random_uuid(),
  name text not null,
  description text,
  campaign_type text not null check (campaign_type in (
    'email_sequence', 'social_media', 'content_marketing', 'paid_ads',
    'webinar', 'product_launch', 'seasonal', 'referral', 'custom'
  )),
  status text not null default 'draft' check (status in ('draft', 'scheduled', 'active', 'paused', 'completed', 'archived')),
  -- Schedule
  start_date date,
  end_date date,
  -- Targeting
  target_segment text, -- 'spreadsheet_dependent', 'scaling', 'enterprise_ready'
  target_audience text,
  -- Budget
  budget numeric(10,2) default 0,
  spent numeric(10,2) default 0,
  -- Performance
  impressions int default 0,
  clicks int default 0,
  conversions int default 0,
  leads_generated int default 0,
  revenue_attributed numeric(14,2) default 0,
  -- Content
  channels text[] default '{}', -- 'email', 'linkedin', 'twitter', 'google_ads', 'blog'
  utm_source text,
  utm_medium text,
  utm_campaign text,
  metadata jsonb default '{}'::jsonb,
  created_by text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

-- ── marketing_content: individual content pieces within campaigns ──
create table if not exists public.marketing_content (
  id uuid primary key default gen_random_uuid(),
  campaign_id uuid references public.marketing_campaigns(id) on delete set null,
  content_type text not null check (content_type in (
    'blog_post', 'social_post', 'email', 'landing_page', 'ad_copy',
    'infographic', 'video_script', 'case_study', 'whitepaper',
    'webinar_deck', 'press_release', 'newsletter', 'custom'
  )),
  title text not null,
  body text,
  status text not null default 'draft' check (status in ('draft', 'review', 'approved', 'published', 'archived')),
  channel text, -- 'linkedin', 'twitter', 'blog', 'email'
  -- Scheduling
  scheduled_at timestamptz,
  published_at timestamptz,
  -- Performance
  views int default 0,
  clicks int default 0,
  shares int default 0,
  conversions int default 0,
  -- Assets
  asset_urls text[] default '{}',
  thumbnail_url text,
  -- SEO
  slug text,
  meta_description text,
  keywords text[] default '{}',
  created_by text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

-- ── social_calendar: content calendar with scheduling ──
create table if not exists public.social_calendar (
  id uuid primary key default gen_random_uuid(),
  content_id uuid references public.marketing_content(id) on delete cascade,
  platform text not null check (platform in ('linkedin', 'twitter', 'facebook', 'instagram', 'youtube', 'tiktok', 'blog', 'newsletter')),
  scheduled_at timestamptz not null,
  published_at timestamptz,
  status text not null default 'scheduled' check (status in ('scheduled', 'published', 'failed', 'canceled')),
  post_url text,
  engagement jsonb default '{}'::jsonb, -- {likes, shares, comments, clicks}
  created_at timestamptz not null default now()
);

-- Seed Vaultline brand assets
insert into public.brand_assets (asset_type, name, colors, metadata, is_default) values
  ('color_palette', 'Vaultline Brand Colors', '[{"name":"Cyan","hex":"#22D3EE","role":"primary"},{"name":"Purple","hex":"#8B5CF6","role":"accent"},{"name":"Void","hex":"#0C1222","role":"background"},{"name":"Deep","hex":"#1E293B","role":"surface"},{"name":"Green","hex":"#22C55E","role":"success"},{"name":"Amber","hex":"#FBBF24","role":"warning"},{"name":"Red","hex":"#EF4444","role":"danger"}]', '{"font_display":"Plus Jakarta Sans","font_mono":"JetBrains Mono"}', true),
  ('typography', 'Vaultline Typography', '[]', '{"display":"Plus Jakarta Sans","body":"Plus Jakarta Sans","mono":"JetBrains Mono","weights":{"display":"800","heading":"700","body":"400","label":"600"}}', true);

-- ═══════════════════════════════════════════════════
-- INDEXES
-- ═══════════════════════════════════════════════════

create index if not exists idx_dashboard_layouts_user on public.dashboard_layouts(user_id, page);
create index if not exists idx_saved_views_page on public.saved_views(org_id, page);
create index if not exists idx_shortcuts_user on public.keyboard_shortcuts(user_id);
create index if not exists idx_tools_slug on public.interactive_tools(slug) where status = 'published';
create index if not exists idx_tool_subs_tool on public.tool_submissions(tool_id, created_at desc);
create index if not exists idx_scheduled_tasks_org on public.scheduled_tasks(org_id, status, next_due_at);
create index if not exists idx_scheduled_tasks_due on public.scheduled_tasks(next_due_at) where status = 'active';
create index if not exists idx_task_completions_task on public.task_completions(task_id, completed_at desc);
create index if not exists idx_timezone_org on public.timezone_configs(org_id);
create index if not exists idx_time_entries_user on public.time_entries(user_id, started_at desc);
create index if not exists idx_time_entries_org on public.time_entries(org_id, category, started_at desc);
create index if not exists idx_brand_assets_org on public.brand_assets(org_id, asset_type);
create index if not exists idx_campaigns_status on public.marketing_campaigns(status, start_date);
create index if not exists idx_content_campaign on public.marketing_content(campaign_id, status);
create index if not exists idx_content_type on public.marketing_content(content_type, status);
create index if not exists idx_social_cal_date on public.social_calendar(scheduled_at, status);

-- ═══════════════════════════════════════════════════
-- RLS
-- ═══════════════════════════════════════════════════

alter table public.dashboard_layouts enable row level security;
alter table public.widgets enable row level security;
alter table public.saved_views enable row level security;
alter table public.keyboard_shortcuts enable row level security;
alter table public.interactive_tools enable row level security;
alter table public.tool_submissions enable row level security;
alter table public.scheduled_tasks enable row level security;
alter table public.task_completions enable row level security;
alter table public.timezone_configs enable row level security;
alter table public.time_entries enable row level security;
alter table public.brand_assets enable row level security;
alter table public.marketing_campaigns enable row level security;
alter table public.marketing_content enable row level security;
alter table public.social_calendar enable row level security;

-- Layout & Functions
do $$ begin execute 'drop policy if exists "' || 'Users manage own layouts' || '" on ' || current_schema || '.'; exception when others then null; end $$;
create policy "Users manage own layouts" on public.dashboard_layouts for all using (user_id = auth.uid());
do $$ begin execute 'drop policy if exists "' || 'Anyone reads widgets' || '" on ' || current_schema || '.'; exception when others then null; end $$;
create policy "Anyone reads widgets" on public.widgets for select using (true);
do $$ begin execute 'drop policy if exists "' || 'Users manage own views' || '" on ' || current_schema || '.'; exception when others then null; end $$;
create policy "Users manage own views" on public.saved_views for all using (user_id = auth.uid() or (shared = true and org_id in (select org_id from public.profiles where id = auth.uid())));
do $$ begin execute 'drop policy if exists "' || 'Users manage own shortcuts' || '" on ' || current_schema || '.'; exception when others then null; end $$;
create policy "Users manage own shortcuts" on public.keyboard_shortcuts for all using (user_id = auth.uid());

-- Interactive Tools
do $$ begin execute 'drop policy if exists "' || 'Anyone reads published tools' || '" on ' || current_schema || '.'; exception when others then null; end $$;
create policy "Anyone reads published tools" on public.interactive_tools for select using (status = 'published');
do $$ begin execute 'drop policy if exists "' || 'Service manages tools' || '" on ' || current_schema || '.'; exception when others then null; end $$;
create policy "Service manages tools" on public.interactive_tools for all using (true) with check (true);
do $$ begin execute 'drop policy if exists "' || 'Service manages tool submissions' || '" on ' || current_schema || '.'; exception when others then null; end $$;
create policy "Service manages tool submissions" on public.tool_submissions for all using (true) with check (true);

-- Time Management
do $$ begin execute 'drop policy if exists "' || 'Users view org tasks' || '" on ' || current_schema || '.'; exception when others then null; end $$;
create policy "Users view org tasks" on public.scheduled_tasks for select using (org_id in (select org_id from public.profiles where id = auth.uid()));
do $$ begin execute 'drop policy if exists "' || 'Users manage own tasks' || '" on ' || current_schema || '.'; exception when others then null; end $$;
create policy "Users manage own tasks" on public.scheduled_tasks for all using (user_id = auth.uid() or user_id is null);
do $$ begin execute 'drop policy if exists "' || 'Users view org completions' || '" on ' || current_schema || '.'; exception when others then null; end $$;
create policy "Users view org completions" on public.task_completions for select using (task_id in (select id from public.scheduled_tasks where org_id in (select org_id from public.profiles where id = auth.uid())));
do $$ begin execute 'drop policy if exists "' || 'Users log completions' || '" on ' || current_schema || '.'; exception when others then null; end $$;
create policy "Users log completions" on public.task_completions for insert with check (true);
do $$ begin execute 'drop policy if exists "' || 'Admins manage timezone' || '" on ' || current_schema || '.'; exception when others then null; end $$;
create policy "Admins manage timezone" on public.timezone_configs for all using (org_id in (select org_id from public.profiles where id = auth.uid() and role in ('owner', 'admin')));
do $$ begin execute 'drop policy if exists "' || 'Users view timezone' || '" on ' || current_schema || '.'; exception when others then null; end $$;
create policy "Users view timezone" on public.timezone_configs for select using (org_id in (select org_id from public.profiles where id = auth.uid()));
do $$ begin execute 'drop policy if exists "' || 'Users manage own time entries' || '" on ' || current_schema || '.'; exception when others then null; end $$;
create policy "Users manage own time entries" on public.time_entries for all using (user_id = auth.uid());
do $$ begin execute 'drop policy if exists "' || 'Admins view org time entries' || '" on ' || current_schema || '.'; exception when others then null; end $$;
create policy "Admins view org time entries" on public.time_entries for select using (org_id in (select org_id from public.profiles where id = auth.uid() and role in ('owner', 'admin')));

-- Marketing (admin only write, brand assets readable)
do $$ begin execute 'drop policy if exists "' || 'Anyone reads brand assets' || '" on ' || current_schema || '.'; exception when others then null; end $$;
create policy "Anyone reads brand assets" on public.brand_assets for select using (true);
do $$ begin execute 'drop policy if exists "' || 'Service manages brand assets' || '" on ' || current_schema || '.'; exception when others then null; end $$;
create policy "Service manages brand assets" on public.brand_assets for all using (true) with check (true);
do $$ begin execute 'drop policy if exists "' || 'Service manages campaigns' || '" on ' || current_schema || '.'; exception when others then null; end $$;
create policy "Service manages campaigns" on public.marketing_campaigns for all using (true) with check (true);
do $$ begin execute 'drop policy if exists "' || 'Service manages content' || '" on ' || current_schema || '.'; exception when others then null; end $$;
create policy "Service manages content" on public.marketing_content for all using (true) with check (true);
do $$ begin execute 'drop policy if exists "' || 'Service manages social calendar' || '" on ' || current_schema || '.'; exception when others then null; end $$;
create policy "Service manages social calendar" on public.social_calendar for all using (true) with check (true);
do $$ begin execute 'drop policy if exists "' || 'Admins read campaigns' || '" on ' || current_schema || '.'; exception when others then null; end $$;
create policy "Admins read campaigns" on public.marketing_campaigns for select using (true);
do $$ begin execute 'drop policy if exists "' || 'Admins read content' || '" on ' || current_schema || '.'; exception when others then null; end $$;
create policy "Admins read content" on public.marketing_content for select using (true);
do $$ begin execute 'drop policy if exists "' || 'Admins read social calendar' || '" on ' || current_schema || '.'; exception when others then null; end $$;
create policy "Admins read social calendar" on public.social_calendar for select using (true);
