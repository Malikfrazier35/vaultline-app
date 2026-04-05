-- Migration 013: Cash Visibility, UI/UX Refinement, Dashboard Resources

-- ═══════════════════════════════════════════════════
-- 1. CUSTOMER CASH VISIBILITY PIPELINE
-- ═══════════════════════════════════════════════════

-- ── cash_positions_realtime: intraday cash position snapshots ──
create table if not exists public.cash_positions_realtime (
  id uuid primary key default gen_random_uuid(),
  org_id uuid not null references public.organizations(id) on delete cascade,
  account_id uuid references public.accounts(id),
  -- Balances
  ledger_balance numeric(16,2) not null default 0,
  available_balance numeric(16,2) not null default 0,
  pending_inflows numeric(16,2) default 0,
  pending_outflows numeric(16,2) default 0,
  projected_eod numeric(16,2) default 0, -- end-of-day projected
  currency text not null default 'USD',
  -- Thresholds
  minimum_balance numeric(16,2),
  target_balance numeric(16,2),
  sweep_threshold numeric(16,2),
  -- Status
  below_minimum boolean not null default false,
  above_sweep boolean not null default false,
  stale boolean not null default false,
  -- Source
  source text not null default 'plaid' check (source in ('plaid', 'api', 'manual', 'computed')),
  last_refreshed_at timestamptz not null default now(),
  refresh_frequency_minutes int default 60,
  created_at timestamptz not null default now()
);

-- ── cash_concentration: sweep / pool / ZBA rules ──
create table if not exists public.cash_concentration (
  id uuid primary key default gen_random_uuid(),
  org_id uuid not null references public.organizations(id) on delete cascade,
  rule_name text not null,
  rule_type text not null check (rule_type in ('sweep', 'pool', 'zba', 'target_balance', 'threshold')),
  -- Source and destination
  source_account_id uuid references public.accounts(id),
  dest_account_id uuid references public.accounts(id),
  -- Trigger
  trigger_type text not null check (trigger_type in ('above_threshold', 'below_minimum', 'end_of_day', 'scheduled', 'manual')),
  trigger_threshold numeric(16,2),
  trigger_target numeric(16,2),
  trigger_schedule text, -- cron expression for scheduled
  -- Execution
  enabled boolean not null default true,
  last_triggered_at timestamptz,
  last_amount numeric(16,2),
  execution_count int default 0,
  -- Notifications
  notify_on_trigger boolean not null default true,
  notify_channels text[] default '{in_app}'::text[],
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

-- ── liquidity_buffers: reserve requirements per account/entity ──
create table if not exists public.liquidity_buffers (
  id uuid primary key default gen_random_uuid(),
  org_id uuid not null references public.organizations(id) on delete cascade,
  entity_id uuid references public.entities(id),
  account_id uuid references public.accounts(id),
  buffer_name text not null,
  buffer_type text not null check (buffer_type in ('operating_reserve', 'emergency_fund', 'debt_service', 'regulatory_capital', 'payroll_reserve', 'tax_reserve', 'custom')),
  required_amount numeric(16,2) not null,
  current_amount numeric(16,2) default 0,
  currency text not null default 'USD',
  funded_pct numeric(5,2) default 0,
  -- Alert
  alert_below_pct numeric(5,2) default 80,
  status text not null default 'funded' check (status in ('funded', 'underfunded', 'critical', 'excess')),
  last_evaluated_at timestamptz,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

-- ── cash_visibility_snapshots: daily consolidated position for trending ──
create table if not exists public.cash_visibility_snapshots (
  id uuid primary key default gen_random_uuid(),
  org_id uuid not null references public.organizations(id) on delete cascade,
  snapshot_date date not null,
  -- Totals
  total_cash numeric(16,2) not null default 0,
  total_available numeric(16,2) not null default 0,
  total_pending_in numeric(16,2) default 0,
  total_pending_out numeric(16,2) default 0,
  net_position numeric(16,2) default 0,
  -- Breakdown
  by_account jsonb default '[]'::jsonb,
  by_entity jsonb default '[]'::jsonb,
  by_currency jsonb default '[]'::jsonb,
  -- Quality
  accounts_reporting int default 0,
  accounts_stale int default 0,
  data_completeness_pct int default 100,
  created_at timestamptz not null default now(),
  unique(org_id, snapshot_date)
);

-- ═══════════════════════════════════════════════════
-- 2. UI/UX REFINEMENT PIPELINE
-- ═══════════════════════════════════════════════════

-- ── ux_preferences: granular UI customization per user ──
create table if not exists public.ux_preferences (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references public.profiles(id) on delete cascade,
  -- Accessibility
  reduced_motion boolean not null default false,
  high_contrast boolean not null default false,
  font_size text not null default 'normal' check (font_size in ('compact', 'normal', 'large', 'x-large')),
  dyslexia_font boolean not null default false,
  screen_reader_hints boolean not null default false,
  -- Display
  color_mode text not null default 'system' check (color_mode in ('dark', 'light', 'system')),
  accent_color text default 'cyan', -- primary accent override
  chart_palette text default 'default' check (chart_palette in ('default', 'colorblind', 'monochrome', 'pastel', 'vivid')),
  number_abbreviation boolean not null default true, -- $1.2M vs $1,200,000
  -- Navigation
  default_landing_page text default '/dashboard',
  sidebar_width text default 'normal' check (sidebar_width in ('compact', 'normal', 'wide')),
  show_breadcrumbs boolean not null default true,
  show_page_descriptions boolean not null default true,
  -- Tables
  rows_per_page int default 25,
  sticky_headers boolean not null default true,
  column_borders boolean not null default false,
  -- Notifications
  sound_enabled boolean not null default false,
  desktop_notifications boolean not null default false,
  -- Guided help
  tooltips_enabled boolean not null default true,
  show_feature_badges boolean not null default true, -- "NEW" badges on features
  walkthrough_completed text[] default '{}', -- IDs of completed walkthroughs
  updated_at timestamptz not null default now(),
  unique(user_id)
);

-- ── ux_feedback: structured in-app feedback collection ──
create table if not exists public.ux_feedback (
  id uuid primary key default gen_random_uuid(),
  org_id uuid references public.organizations(id),
  user_id uuid references public.profiles(id),
  -- Feedback context
  page_path text not null,
  feedback_type text not null check (feedback_type in ('bug', 'feature_request', 'usability', 'praise', 'confusion', 'performance', 'other')),
  -- Content
  rating int check (rating between 1 and 5),
  title text,
  description text not null,
  screenshot_url text,
  -- Device context
  device_type text,
  viewport_width int,
  browser text,
  -- Triage
  status text not null default 'new' check (status in ('new', 'triaged', 'planned', 'in_progress', 'resolved', 'wont_fix')),
  priority text default 'medium' check (priority in ('low', 'medium', 'high', 'critical')),
  assigned_to text,
  resolution text,
  resolved_at timestamptz,
  created_at timestamptz not null default now()
);

-- ── ux_walkthroughs: guided tour / walkthrough definitions ──
create table if not exists public.ux_walkthroughs (
  id text primary key, -- 'dashboard_intro', 'forecast_setup', 'first_report'
  title text not null,
  description text,
  target_page text not null, -- '/dashboard', '/forecast', etc.
  trigger_condition text default 'first_visit', -- 'first_visit', 'feature_unlock', 'manual'
  steps jsonb not null default '[]'::jsonb, -- [{target, title, body, position}]
  plan_required text default 'starter',
  enabled boolean not null default true,
  display_order int default 100,
  created_at timestamptz not null default now()
);

-- ── ux_announcements: in-app announcements / changelog ──
create table if not exists public.ux_announcements (
  id uuid primary key default gen_random_uuid(),
  title text not null,
  body text not null,
  announcement_type text not null check (announcement_type in ('feature', 'improvement', 'fix', 'maintenance', 'security', 'promotion')),
  severity text default 'info' check (severity in ('info', 'success', 'warning', 'urgent')),
  -- Targeting
  target_plans text[] default '{}'::text[], -- empty = all plans
  target_industries text[] default '{}',
  -- Display
  display_type text default 'banner' check (display_type in ('banner', 'modal', 'toast', 'sidebar')),
  cta_text text,
  cta_url text,
  image_url text,
  -- Lifecycle
  starts_at timestamptz not null default now(),
  expires_at timestamptz,
  published boolean not null default false,
  -- Tracking
  views int default 0,
  clicks int default 0,
  dismissals int default 0,
  created_at timestamptz not null default now()
);

-- Seed walkthroughs
insert into public.ux_walkthroughs (id, title, description, target_page, steps, display_order) values
  ('dashboard_intro', 'Welcome to Vaultline', 'Get oriented with your treasury command center', '/dashboard',
   '[{"target":"[data-kpi]","title":"Your Cash at a Glance","body":"These KPIs show your total cash, runway, and burn rate in real time.","position":"bottom"},{"target":"[data-chart]","title":"Cash Trend","body":"This chart shows your cash balance over time. Hover for daily details.","position":"right"},{"target":"[data-copilot]","title":"AI Copilot","body":"Ask questions in plain English — \"What''s my runway?\" or \"Show large transactions this week.\"","position":"left"}]', 1),
  ('forecast_setup', 'Set Up Forecasting', 'Configure your first AI-powered cash forecast', '/forecast',
   '[{"target":"[data-model]","title":"Forecast Models","body":"Choose from Linear, EMA, or Monte Carlo models. Growth plans unlock all three.","position":"bottom"},{"target":"[data-anomaly]","title":"Anomaly Detection","body":"The AI watches for unusual transactions and flags them automatically.","position":"right"}]', 2),
  ('first_bank', 'Connect Your First Bank', 'Link a bank account for real-time balances', '/banks',
   '[{"target":"[data-connect]","title":"Add a Bank","body":"Click here to securely link your bank via Plaid. We never see your credentials.","position":"bottom"}]', 3),
  ('first_report', 'Generate Your First Report', 'Create a treasury report for your team', '/reports',
   '[{"target":"[data-generate]","title":"Report Templates","body":"Choose from 8 pre-built templates or create a custom report.","position":"bottom"}]', 4);

-- ═══════════════════════════════════════════════════
-- 3. CUSTOMER DASHBOARD RESOURCES PIPELINE
-- ═══════════════════════════════════════════════════

-- ── resource_library: help articles, templates, guides ──
create table if not exists public.resource_library (
  id uuid primary key default gen_random_uuid(),
  slug text unique not null,
  title text not null,
  body_markdown text,
  body_html text,
  excerpt text,
  resource_type text not null check (resource_type in (
    'getting_started', 'how_to', 'best_practice', 'template',
    'video_tutorial', 'faq', 'troubleshooting', 'api_guide',
    'integration_guide', 'release_note', 'case_study', 'webinar'
  )),
  category text not null check (category in (
    'onboarding', 'cash_management', 'forecasting', 'reporting',
    'integrations', 'security', 'billing', 'api', 'compliance', 'general'
  )),
  -- Media
  thumbnail_url text,
  video_url text,
  download_url text,
  -- Targeting
  plan_required text default 'starter',
  industries text[] default '{}', -- empty = all
  -- SEO
  meta_title text,
  meta_description text,
  keywords text[] default '{}',
  -- Status
  status text not null default 'draft' check (status in ('draft', 'published', 'archived')),
  featured boolean not null default false,
  pinned boolean not null default false,
  -- Engagement
  views int default 0,
  helpful_yes int default 0,
  helpful_no int default 0,
  avg_read_time_seconds int,
  -- Author
  author_name text,
  published_at timestamptz,
  updated_at timestamptz not null default now(),
  created_at timestamptz not null default now()
);

-- ── report_templates: downloadable/applicable report templates ──
create table if not exists public.report_templates (
  id uuid primary key default gen_random_uuid(),
  slug text unique not null,
  name text not null,
  description text,
  template_type text not null check (template_type in (
    'cash_flow', 'balance_summary', 'forecast', 'variance',
    'bank_fee_analysis', 'fx_exposure', 'board_deck',
    'audit_ready', 'budget_vs_actual', 'custom'
  )),
  -- Template definition
  config jsonb not null default '{}'::jsonb, -- columns, filters, grouping, chart type
  default_period text default 'monthly',
  default_format text default 'pdf' check (default_format in ('pdf', 'xlsx', 'csv', 'pptx')),
  -- Targeting
  plan_required text default 'starter',
  industries text[] default '{}',
  -- Status
  is_system boolean not null default false, -- built-in vs user-created
  status text not null default 'active' check (status in ('active', 'archived')),
  usage_count int default 0,
  last_used_at timestamptz,
  created_at timestamptz not null default now()
);

-- ── dashboard_widgets_user: user-pinned quick-access resources ──
create table if not exists public.dashboard_quick_links (
  id uuid primary key default gen_random_uuid(),
  org_id uuid not null references public.organizations(id) on delete cascade,
  user_id uuid not null references public.profiles(id),
  link_type text not null check (link_type in ('page', 'resource', 'report_template', 'external', 'action')),
  label text not null,
  url text not null,
  icon text, -- lucide icon name
  color text,
  position int default 0,
  created_at timestamptz not null default now(),
  unique(org_id, user_id, url)
);

-- ── sample_data_sets: demo data for new accounts ──
create table if not exists public.sample_data_sets (
  id uuid primary key default gen_random_uuid(),
  name text not null,
  description text,
  industry_id text references public.industry_profiles(id),
  -- Data
  accounts jsonb default '[]'::jsonb,
  transactions jsonb default '[]'::jsonb,
  invoices jsonb default '[]'::jsonb,
  payables jsonb default '[]'::jsonb,
  -- Status
  is_default boolean not null default false,
  created_at timestamptz not null default now()
);

-- Seed report templates
insert into public.report_templates (slug, name, description, template_type, config, is_system, plan_required) values
  ('daily-cash', 'Daily Cash Position', 'Opening/closing balances by account with intraday movement', 'cash_flow', '{"columns":["account","opening","inflows","outflows","closing","change_pct"],"period":"daily","chart":"bar"}', true, 'starter'),
  ('weekly-summary', 'Weekly Treasury Summary', 'Cash flow summary with forecast accuracy and key metrics', 'balance_summary', '{"columns":["metric","actual","forecast","variance","variance_pct"],"period":"weekly","chart":"combo"}', true, 'starter'),
  ('monthly-forecast', 'Monthly Forecast Report', '90-day forward-looking cash forecast with confidence bands', 'forecast', '{"columns":["month","projected_inflows","projected_outflows","net","cumulative","confidence"],"period":"monthly","chart":"area"}', true, 'growth'),
  ('variance-analysis', 'Budget vs Actual Variance', 'Category-level variance analysis with root cause annotations', 'variance', '{"columns":["category","budget","actual","variance","variance_pct","notes"],"period":"monthly","chart":"waterfall"}', true, 'growth'),
  ('bank-fees', 'Bank Fee Analysis', 'Fee breakdown by bank, type, and trend over time', 'bank_fee_analysis', '{"columns":["bank","fee_type","amount","trend","comparable"],"period":"monthly","chart":"stacked_bar"}', true, 'starter'),
  ('fx-exposure', 'FX Exposure Report', 'Currency-by-currency exposure with hedging recommendations', 'fx_exposure', '{"columns":["currency","exposure","hedged","unhedged","rate","impact"],"period":"monthly","chart":"treemap"}', true, 'growth'),
  ('board-deck', 'Board Treasury Deck', 'Executive-ready presentation with KPIs, trends, and outlook', 'board_deck', '{"slides":["cash_overview","trend_chart","forecast","risk_summary","recommendations"],"format":"pptx"}', true, 'enterprise'),
  ('audit-ready', 'Audit-Ready Cash Report', 'SOX-compliant cash report with full reconciliation trail', 'audit_ready', '{"columns":["date","account","description","debit","credit","balance","reconciled","source"],"period":"monthly"}', true, 'enterprise');

-- Seed resource library
insert into public.resource_library (slug, title, excerpt, resource_type, category, status, featured, pinned) values
  ('getting-started', 'Getting Started with Vaultline', 'Connect your first bank, explore the dashboard, and generate your first report in under 10 minutes.', 'getting_started', 'onboarding', 'published', true, true),
  ('connect-bank', 'How to Connect a Bank Account', 'Step-by-step guide to linking your bank via Plaid for real-time balances.', 'how_to', 'onboarding', 'published', false, false),
  ('forecast-guide', 'Understanding AI Forecasting', 'Learn how Vaultline''s three forecast models work and when to use each one.', 'how_to', 'forecasting', 'published', true, false),
  ('multi-entity', 'Setting Up Multi-Entity Treasury', 'Configure entities, map accounts, and set up consolidated views.', 'how_to', 'cash_management', 'published', false, false),
  ('api-quickstart', 'API Quick Start Guide', 'Authenticate, fetch balances, and create webhooks in 5 minutes.', 'api_guide', 'api', 'published', false, false),
  ('report-templates', 'Using Report Templates', 'Generate board-ready reports with pre-built templates.', 'how_to', 'reporting', 'published', false, false),
  ('security-best', 'Security Best Practices', 'MFA, SSO, IP allowlisting, and audit logging recommendations.', 'best_practice', 'security', 'published', false, false),
  ('plaid-troubleshoot', 'Troubleshooting Bank Connections', 'Common Plaid connection issues and how to resolve them.', 'troubleshooting', 'integrations', 'published', false, false),
  ('quickbooks-sync', 'QuickBooks Integration Guide', 'Set up bi-directional sync between Vaultline and QuickBooks Online.', 'integration_guide', 'integrations', 'published', false, false),
  ('cash-visibility-bp', 'Cash Visibility Best Practices', 'How top treasury teams achieve real-time cash visibility across all accounts.', 'best_practice', 'cash_management', 'published', true, false);

-- ═══════════════════════════════════════════════════
-- INDEXES
-- ═══════════════════════════════════════════════════

-- Cash visibility
create index if not exists idx_cash_rt_org on public.cash_positions_realtime(org_id, account_id);
create index if not exists idx_cash_rt_stale on public.cash_positions_realtime(org_id) where stale = true;
create index if not exists idx_cash_rt_below on public.cash_positions_realtime(org_id) where below_minimum = true;
create index if not exists idx_cash_conc_org on public.cash_concentration(org_id, enabled);
create index if not exists idx_liquidity_org on public.liquidity_buffers(org_id, status);
create index if not exists idx_cash_snap_org on public.cash_visibility_snapshots(org_id, snapshot_date desc);

-- UI/UX
create index if not exists idx_ux_prefs_user on public.ux_preferences(user_id);
create index if not exists idx_ux_feedback_page on public.ux_feedback(page_path, status, created_at desc);
create index if not exists idx_ux_feedback_org on public.ux_feedback(org_id, status);
create index if not exists idx_ux_walk_page on public.ux_walkthroughs(target_page) where enabled = true;
create index if not exists idx_ux_announce_active on public.ux_announcements(starts_at, expires_at) where published = true;

-- Resources
create index if not exists idx_resource_slug on public.resource_library(slug) where status = 'published';
create index if not exists idx_resource_type on public.resource_library(resource_type, category, status);
create index if not exists idx_resource_featured on public.resource_library(featured, pinned) where status = 'published';
create index if not exists idx_report_tpl_type on public.report_templates(template_type, status);
create index if not exists idx_quick_links_user on public.dashboard_quick_links(user_id, position);

-- ═══════════════════════════════════════════════════
-- RLS
-- ═══════════════════════════════════════════════════

alter table public.cash_positions_realtime enable row level security;
alter table public.cash_concentration enable row level security;
alter table public.liquidity_buffers enable row level security;
alter table public.cash_visibility_snapshots enable row level security;
alter table public.ux_preferences enable row level security;
alter table public.ux_feedback enable row level security;
alter table public.ux_walkthroughs enable row level security;
alter table public.ux_announcements enable row level security;
alter table public.resource_library enable row level security;
alter table public.report_templates enable row level security;
alter table public.dashboard_quick_links enable row level security;
alter table public.sample_data_sets enable row level security;

-- Cash visibility: org-scoped
do $$ begin execute 'drop policy if exists "' || 'Users view org cash positions' || '" on ' || current_schema || '.'; exception when others then null; end $$;
create policy "Users view org cash positions" on public.cash_positions_realtime for select using (org_id in (select org_id from public.profiles where id = auth.uid()));
do $$ begin execute 'drop policy if exists "' || 'Admins manage cash concentration' || '" on ' || current_schema || '.'; exception when others then null; end $$;
create policy "Admins manage cash concentration" on public.cash_concentration for all using (org_id in (select org_id from public.profiles where id = auth.uid() and role in ('owner','admin')));
do $$ begin execute 'drop policy if exists "' || 'Users view cash concentration' || '" on ' || current_schema || '.'; exception when others then null; end $$;
create policy "Users view cash concentration" on public.cash_concentration for select using (org_id in (select org_id from public.profiles where id = auth.uid()));
do $$ begin execute 'drop policy if exists "' || 'Users view liquidity buffers' || '" on ' || current_schema || '.'; exception when others then null; end $$;
create policy "Users view liquidity buffers" on public.liquidity_buffers for select using (org_id in (select org_id from public.profiles where id = auth.uid()));
do $$ begin execute 'drop policy if exists "' || 'Users view cash snapshots' || '" on ' || current_schema || '.'; exception when others then null; end $$;
create policy "Users view cash snapshots" on public.cash_visibility_snapshots for select using (org_id in (select org_id from public.profiles where id = auth.uid()));

-- UX: user-scoped
do $$ begin execute 'drop policy if exists "' || 'Users manage own UX prefs' || '" on ' || current_schema || '.'; exception when others then null; end $$;
create policy "Users manage own UX prefs" on public.ux_preferences for all using (user_id = auth.uid());
do $$ begin execute 'drop policy if exists "' || 'Users submit feedback' || '" on ' || current_schema || '.'; exception when others then null; end $$;
create policy "Users submit feedback" on public.ux_feedback for insert with check (user_id = auth.uid());
do $$ begin execute 'drop policy if exists "' || 'Users view own feedback' || '" on ' || current_schema || '.'; exception when others then null; end $$;
create policy "Users view own feedback" on public.ux_feedback for select using (user_id = auth.uid());
do $$ begin execute 'drop policy if exists "' || 'Anyone reads walkthroughs' || '" on ' || current_schema || '.'; exception when others then null; end $$;
create policy "Anyone reads walkthroughs" on public.ux_walkthroughs for select using (enabled = true);
do $$ begin execute 'drop policy if exists "' || 'Anyone reads announcements' || '" on ' || current_schema || '.'; exception when others then null; end $$;
create policy "Anyone reads announcements" on public.ux_announcements for select using (published = true and starts_at <= now() and (expires_at is null or expires_at > now()));

-- Resources: public read
do $$ begin execute 'drop policy if exists "' || 'Anyone reads published resources' || '" on ' || current_schema || '.'; exception when others then null; end $$;
create policy "Anyone reads published resources" on public.resource_library for select using (status = 'published');
do $$ begin execute 'drop policy if exists "' || 'Anyone reads active templates' || '" on ' || current_schema || '.'; exception when others then null; end $$;
create policy "Anyone reads active templates" on public.report_templates for select using (status = 'active');
do $$ begin execute 'drop policy if exists "' || 'Users manage own quick links' || '" on ' || current_schema || '.'; exception when others then null; end $$;
create policy "Users manage own quick links" on public.dashboard_quick_links for all using (user_id = auth.uid());
do $$ begin execute 'drop policy if exists "' || 'Anyone reads sample data' || '" on ' || current_schema || '.'; exception when others then null; end $$;
create policy "Anyone reads sample data" on public.sample_data_sets for select using (true);

-- Service role
do $$ begin execute 'drop policy if exists "' || 'Service manages cash positions' || '" on ' || current_schema || '.'; exception when others then null; end $$;
create policy "Service manages cash positions" on public.cash_positions_realtime for all using (true) with check (true);
do $$ begin execute 'drop policy if exists "' || 'Service manages liquidity' || '" on ' || current_schema || '.'; exception when others then null; end $$;
create policy "Service manages liquidity" on public.liquidity_buffers for all using (true) with check (true);
do $$ begin execute 'drop policy if exists "' || 'Service manages cash snapshots' || '" on ' || current_schema || '.'; exception when others then null; end $$;
create policy "Service manages cash snapshots" on public.cash_visibility_snapshots for all using (true) with check (true);
do $$ begin execute 'drop policy if exists "' || 'Service manages feedback' || '" on ' || current_schema || '.'; exception when others then null; end $$;
create policy "Service manages feedback" on public.ux_feedback for all using (true) with check (true);
do $$ begin execute 'drop policy if exists "' || 'Service manages walkthroughs' || '" on ' || current_schema || '.'; exception when others then null; end $$;
create policy "Service manages walkthroughs" on public.ux_walkthroughs for all using (true) with check (true);
do $$ begin execute 'drop policy if exists "' || 'Service manages announcements' || '" on ' || current_schema || '.'; exception when others then null; end $$;
create policy "Service manages announcements" on public.ux_announcements for all using (true) with check (true);
do $$ begin execute 'drop policy if exists "' || 'Service manages resources' || '" on ' || current_schema || '.'; exception when others then null; end $$;
create policy "Service manages resources" on public.resource_library for all using (true) with check (true);
do $$ begin execute 'drop policy if exists "' || 'Service manages templates' || '" on ' || current_schema || '.'; exception when others then null; end $$;
create policy "Service manages templates" on public.report_templates for all using (true) with check (true);
do $$ begin execute 'drop policy if exists "' || 'Service manages quick links' || '" on ' || current_schema || '.'; exception when others then null; end $$;
create policy "Service manages quick links" on public.dashboard_quick_links for all using (true) with check (true);
do $$ begin execute 'drop policy if exists "' || 'Service manages sample data' || '" on ' || current_schema || '.'; exception when others then null; end $$;
create policy "Service manages sample data" on public.sample_data_sets for all using (true) with check (true);
