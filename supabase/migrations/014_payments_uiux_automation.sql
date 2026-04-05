-- Migration 014: Payments & Financials, UI/UX Components, Changes & Automation

-- ═══════════════════════════════════════════════════
-- 1. DIGITAL BANK-LIKE PAYMENTS & FINANCIALS
-- ═══════════════════════════════════════════════════

-- ── payment_accounts: virtual accounts for payment management ──
create table if not exists public.payment_accounts (
  id uuid primary key default gen_random_uuid(),
  org_id uuid not null references public.organizations(id) on delete cascade,
  account_id uuid references public.accounts(id),
  account_label text not null,
  account_type text not null check (account_type in ('operating', 'payroll', 'tax_reserve', 'savings', 'escrow', 'petty_cash', 'investment')),
  currency text not null default 'USD',
  current_balance numeric(16,2) not null default 0,
  available_balance numeric(16,2) not null default 0,
  pending_balance numeric(16,2) default 0,
  -- Limits
  daily_transfer_limit numeric(14,2),
  single_transfer_limit numeric(14,2),
  remaining_daily_limit numeric(14,2),
  -- Status
  status text not null default 'active' check (status in ('active', 'frozen', 'closed', 'pending_verification')),
  last_activity_at timestamptz,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

-- ── payees: registered payment recipients ──
create table if not exists public.payees (
  id uuid primary key default gen_random_uuid(),
  org_id uuid not null references public.organizations(id) on delete cascade,
  payee_name text not null,
  payee_type text not null check (payee_type in ('vendor', 'employee', 'contractor', 'tax_authority', 'intercompany', 'other')),
  -- Bank details (encrypted at rest)
  bank_name text,
  routing_number text,
  account_number_last4 text,
  account_type text check (account_type in ('checking', 'savings')),
  -- Wire
  swift_code text,
  iban text,
  -- Contact
  email text,
  phone text,
  address_line1 text,
  address_city text,
  address_state text,
  address_country text default 'US',
  -- Tax
  tax_id_last4 text,
  w9_on_file boolean not null default false,
  -- Status
  status text not null default 'active' check (status in ('active', 'inactive', 'pending_verification', 'blocked')),
  verified_at timestamptz,
  total_paid numeric(16,2) default 0,
  payment_count int default 0,
  last_paid_at timestamptz,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

-- ── payment_transactions: the core payment ledger ──
create table if not exists public.payment_transactions (
  id uuid primary key default gen_random_uuid(),
  org_id uuid not null references public.organizations(id) on delete cascade,
  -- Reference
  reference_number text unique not null,
  -- Parties
  from_account_id uuid references public.payment_accounts(id),
  to_payee_id uuid references public.payees(id),
  to_account_id uuid references public.payment_accounts(id), -- for internal transfers
  -- Amount
  amount numeric(14,2) not null,
  currency text not null default 'USD',
  fx_rate numeric(12,6),
  settled_amount numeric(14,2),
  fee numeric(10,2) default 0,
  -- Payment details
  payment_method text not null check (payment_method in ('ach', 'wire', 'internal_transfer', 'check', 'card', 'rtp', 'sepa', 'swift')),
  payment_type text not null check (payment_type in ('one_time', 'recurring', 'batch', 'scheduled', 'approval_pending')),
  category text,
  memo text,
  invoice_reference text,
  -- Schedule
  scheduled_date date,
  execution_date date,
  settlement_date date,
  value_date date,
  -- Approval
  requires_approval boolean not null default false,
  approval_status text default 'not_required' check (approval_status in ('not_required', 'pending', 'approved', 'rejected', 'expired')),
  approved_by uuid references public.profiles(id),
  approved_at timestamptz,
  rejection_reason text,
  -- Status timeline
  status text not null default 'draft' check (status in ('draft', 'pending_approval', 'approved', 'scheduled', 'processing', 'sent', 'settled', 'failed', 'returned', 'canceled', 'reversed')),
  status_history jsonb default '[]'::jsonb,
  failure_reason text,
  return_reason text,
  -- Metadata
  initiated_by uuid references public.profiles(id),
  batch_id uuid,
  idempotency_key text,
  external_id text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

-- ── payment_batches: grouped payments for batch processing ──
create table if not exists public.payment_batches (
  id uuid primary key default gen_random_uuid(),
  org_id uuid not null references public.organizations(id) on delete cascade,
  batch_name text not null,
  batch_type text not null check (batch_type in ('payroll', 'vendor_pay', 'tax_remittance', 'intercompany', 'custom')),
  -- Summary
  total_amount numeric(16,2) not null default 0,
  payment_count int not null default 0,
  currency text not null default 'USD',
  from_account_id uuid references public.payment_accounts(id),
  -- Status
  status text not null default 'draft' check (status in ('draft', 'pending_approval', 'approved', 'processing', 'completed', 'partially_completed', 'failed', 'canceled')),
  approved_by uuid references public.profiles(id),
  approved_at timestamptz,
  processed_at timestamptz,
  completed_at timestamptz,
  -- Schedule
  scheduled_date date,
  -- Audit
  initiated_by uuid references public.profiles(id),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

-- ── recurring_payments: standing orders / scheduled recurring ──
create table if not exists public.recurring_payments (
  id uuid primary key default gen_random_uuid(),
  org_id uuid not null references public.organizations(id) on delete cascade,
  from_account_id uuid references public.payment_accounts(id),
  to_payee_id uuid references public.payees(id),
  -- Payment
  amount numeric(14,2) not null,
  currency text not null default 'USD',
  payment_method text not null default 'ach',
  category text,
  memo text,
  -- Schedule
  frequency text not null check (frequency in ('weekly', 'biweekly', 'monthly', 'quarterly', 'annual')),
  day_of_month int,
  day_of_week int,
  next_payment_date date,
  end_date date,
  -- Status
  status text not null default 'active' check (status in ('active', 'paused', 'completed', 'canceled')),
  payments_made int default 0,
  total_paid numeric(16,2) default 0,
  last_payment_at timestamptz,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

-- ═══════════════════════════════════════════════════
-- 2. UI/UX IMPROVEMENTS PIPELINE
-- ═══════════════════════════════════════════════════

-- ── ui_component_registry: tracks available UI components ──
create table if not exists public.ui_component_registry (
  id text primary key, -- 'skeleton', 'empty_state', 'toast', 'modal', etc.
  name text not null,
  category text not null check (category in ('feedback', 'navigation', 'data_display', 'input', 'overlay', 'layout', 'animation')),
  description text,
  props_schema jsonb default '{}'::jsonb,
  usage_count int default 0,
  pages_used text[] default '{}',
  status text not null default 'active' check (status in ('active', 'deprecated', 'experimental')),
  created_at timestamptz not null default now()
);

-- ── ui_page_states: loading/empty/error state configs per page ──
create table if not exists public.ui_page_states (
  id uuid primary key default gen_random_uuid(),
  page_path text not null,
  state_type text not null check (state_type in ('loading', 'empty', 'error', 'offline', 'permission_denied', 'maintenance')),
  -- Content
  title text not null,
  description text,
  icon text,
  cta_text text,
  cta_url text,
  illustration_url text,
  -- Status
  enabled boolean not null default true,
  unique(page_path, state_type)
);

-- ── ui_themes: custom theme definitions ──
create table if not exists public.ui_themes (
  id uuid primary key default gen_random_uuid(),
  name text not null,
  description text,
  -- Colors
  colors jsonb not null default '{}'::jsonb, -- {primary, accent, bg, surface, text, success, warning, danger}
  -- Typography
  font_display text,
  font_body text,
  font_mono text,
  -- Borders & radii
  border_radius text default '12px',
  border_width text default '1px',
  -- Shadows
  shadow_sm text,
  shadow_md text,
  shadow_lg text,
  -- Status
  is_system boolean not null default false,
  is_default boolean not null default false,
  created_at timestamptz not null default now()
);

-- Seed UI components
insert into public.ui_component_registry (id, name, category, description, pages_used) values
  ('skeleton', 'Skeleton Loader', 'feedback', 'Animated placeholder while content loads', '{dashboard,forecast,reports,transactions}'),
  ('empty_state', 'Empty State', 'feedback', 'Illustration + CTA when no data exists', '{transactions,alerts,support,reports}'),
  ('error_boundary', 'Error Boundary', 'feedback', 'Graceful error recovery with retry', '{all}'),
  ('toast', 'Toast Notification', 'feedback', 'Temporary success/error/info messages', '{all}'),
  ('modal', 'Modal Dialog', 'overlay', 'Centered overlay for confirmations and forms', '{settings,billing,team}'),
  ('command_palette', 'Command Palette', 'navigation', 'Cmd+K global search and navigation', '{all}'),
  ('breadcrumb', 'Breadcrumb', 'navigation', 'Page hierarchy trail', '{all}'),
  ('data_table', 'Data Table', 'data_display', 'Sortable, filterable table with pagination', '{transactions,payments,audit}'),
  ('chart_tooltip', 'Chart Tooltip', 'data_display', 'Custom Recharts tooltip with theme support', '{dashboard,forecast,position}'),
  ('progress_bar', 'Progress Bar', 'feedback', 'Linear progress indicator', '{onboarding,import,reports}'),
  ('badge', 'Status Badge', 'data_display', 'Colored status indicator', '{all}'),
  ('dropdown_menu', 'Dropdown Menu', 'input', 'Action menu triggered by button', '{transactions,team,settings}'),
  ('sheet', 'Side Sheet', 'overlay', 'Slide-in panel for details and forms', '{transactions,payments}'),
  ('confetti', 'Confetti Animation', 'animation', 'Celebration effect on milestones', '{onboarding,milestones}'),
  ('step_wizard', 'Step Wizard', 'navigation', 'Multi-step form with progress', '{onboarding,import,payments}');

-- Seed page states
insert into public.ui_page_states (page_path, state_type, title, description, icon, cta_text, cta_url) values
  ('/transactions', 'empty', 'No transactions yet', 'Connect a bank account to start seeing transactions flow in automatically.', 'Receipt', 'Connect Bank', '/banks'),
  ('/alerts', 'empty', 'No active alerts', 'Set up your first alert threshold to get notified about important cash events.', 'Bell', 'Create Alert', '/alerts'),
  ('/reports', 'empty', 'No reports generated', 'Generate your first treasury report from our library of 8 professional templates.', 'FileText', 'Browse Templates', '/resources'),
  ('/forecast', 'empty', 'Not enough data to forecast', 'We need at least 30 days of transaction history to generate accurate forecasts.', 'TrendingUp', 'Import Data', '/import'),
  ('/support', 'empty', 'No open tickets', 'Everything looks good! Create a ticket if you need help with anything.', 'MessageSquare', 'New Ticket', '/support'),
  ('/dashboard', 'loading', 'Loading your treasury...', 'Fetching real-time balances, transactions, and forecast data.', 'Loader2', null, null),
  ('/dashboard', 'error', 'Something went wrong', 'We couldn''t load your dashboard data. This is usually temporary.', 'AlertTriangle', 'Try Again', '/dashboard'),
  ('/dashboard', 'offline', 'You''re offline', 'Check your internet connection. Your last-synced data is still available.', 'WifiOff', null, null);

-- Seed themes
insert into public.ui_themes (name, description, colors, font_display, font_body, font_mono, is_system, is_default) values
  ('Void (Default)', 'Dark theme with cyan accents', '{"primary":"#22D3EE","accent":"#8B5CF6","bg":"#0C1222","surface":"#1E293B","text":"#F8FAFC","success":"#22C55E","warning":"#FBBF24","danger":"#EF4444"}', 'Plus Jakarta Sans', 'Plus Jakarta Sans', 'JetBrains Mono', true, true),
  ('Daylight', 'Light theme for bright environments', '{"primary":"#0891B2","accent":"#7C3AED","bg":"#FFFFFF","surface":"#F8FAFC","text":"#0F172A","success":"#16A34A","warning":"#D97706","danger":"#DC2626"}', 'Plus Jakarta Sans', 'Plus Jakarta Sans', 'JetBrains Mono', true, false),
  ('Midnight', 'Ultra-dark OLED theme', '{"primary":"#06B6D4","accent":"#A78BFA","bg":"#000000","surface":"#111111","text":"#E2E8F0","success":"#4ADE80","warning":"#FCD34D","danger":"#F87171"}', 'Plus Jakarta Sans', 'Plus Jakarta Sans', 'JetBrains Mono', true, false);

-- ═══════════════════════════════════════════════════
-- 3. CHANGES & INFORMATION AUTOMATION PIPELINE
-- ═══════════════════════════════════════════════════

-- ── automation_rules: user-defined if/then automation rules ──
create table if not exists public.automation_rules (
  id uuid primary key default gen_random_uuid(),
  org_id uuid not null references public.organizations(id) on delete cascade,
  rule_name text not null,
  description text,
  -- Trigger
  trigger_type text not null check (trigger_type in (
    'transaction_created', 'transaction_categorized', 'balance_threshold',
    'forecast_deviation', 'payment_due', 'sync_completed', 'sync_failed',
    'report_generated', 'alert_triggered', 'invoice_overdue',
    'user_login', 'scheduled', 'webhook_received', 'manual'
  )),
  trigger_conditions jsonb not null default '{}'::jsonb, -- {"field":"amount","operator":"gt","value":50000}
  -- Actions (executed in order)
  actions jsonb not null default '[]'::jsonb, -- [{type,config}]
  -- Scheduling
  schedule_cron text, -- for 'scheduled' trigger type
  -- Status
  enabled boolean not null default true,
  last_triggered_at timestamptz,
  trigger_count int default 0,
  last_error text,
  -- Limits
  max_executions_per_day int default 100,
  executions_today int default 0,
  -- Audit
  created_by uuid references public.profiles(id),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

-- ── automation_executions: log of each rule execution ──
create table if not exists public.automation_executions (
  id uuid primary key default gen_random_uuid(),
  rule_id uuid not null references public.automation_rules(id) on delete cascade,
  org_id uuid not null references public.organizations(id) on delete cascade,
  -- Trigger context
  trigger_event jsonb not null default '{}'::jsonb, -- what triggered it
  -- Execution
  started_at timestamptz not null default now(),
  completed_at timestamptz,
  duration_ms int,
  -- Results
  status text not null default 'running' check (status in ('running', 'success', 'partial', 'failed', 'skipped')),
  actions_executed int default 0,
  actions_failed int default 0,
  results jsonb default '[]'::jsonb, -- [{action_type, status, detail}]
  error_message text,
  created_at timestamptz not null default now()
);

-- ── changelog_entries: product changelog / release notes ──
create table if not exists public.changelog_entries (
  id uuid primary key default gen_random_uuid(),
  version text not null,
  title text not null,
  body_markdown text not null,
  body_html text,
  -- Classification
  entry_type text not null check (entry_type in ('feature', 'improvement', 'fix', 'security', 'deprecation', 'breaking_change')),
  severity text default 'info' check (severity in ('info', 'minor', 'major', 'critical')),
  category text check (category in ('dashboard', 'forecasting', 'payments', 'integrations', 'security', 'api', 'performance', 'ui', 'general')),
  -- Assets
  screenshot_url text,
  video_url text,
  -- Lifecycle
  published_at timestamptz,
  status text not null default 'draft' check (status in ('draft', 'published', 'archived')),
  -- Tracking
  views int default 0,
  helpful_yes int default 0,
  helpful_no int default 0,
  created_at timestamptz not null default now()
);

-- ── webhook_subscriptions: outbound webhooks ──
create table if not exists public.webhook_subscriptions (
  id uuid primary key default gen_random_uuid(),
  org_id uuid not null references public.organizations(id) on delete cascade,
  url text not null,
  secret text not null, -- HMAC signing secret
  -- Events
  events text[] not null, -- ['transaction.created','payment.sent','alert.triggered']
  -- Config
  enabled boolean not null default true,
  retry_count int default 3,
  timeout_seconds int default 10,
  -- Health
  last_delivered_at timestamptz,
  last_status_code int,
  consecutive_failures int default 0,
  disabled_reason text,
  -- Stats
  deliveries_total int default 0,
  deliveries_failed int default 0,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

-- ── webhook_deliveries: outbound delivery log ──
create table if not exists public.webhook_deliveries (
  id uuid primary key default gen_random_uuid(),
  subscription_id uuid not null references public.webhook_subscriptions(id) on delete cascade,
  event_type text not null,
  payload jsonb not null,
  -- Response
  status_code int,
  response_body text,
  response_time_ms int,
  -- Retry
  attempt int default 1,
  next_retry_at timestamptz,
  -- Status
  delivered boolean not null default false,
  error_message text,
  created_at timestamptz not null default now()
);

-- Seed automation rule templates
insert into public.changelog_entries (version, title, body_markdown, entry_type, category, status, published_at) values
  ('1.0.0', 'Vaultline Launch', 'Initial release of Vaultline Treasury Management — real-time cash visibility, AI forecasting, multi-entity support, and Plaid + QuickBooks integrations.', 'feature', 'general', 'published', now()),
  ('1.1.0', 'Payments Pipeline', 'Bank-like payment management: ACH, wire, internal transfers, batch processing, recurring payments, and multi-level approval workflows.', 'feature', 'payments', 'published', now()),
  ('1.2.0', 'Data Intelligence', 'AI-powered data quality monitoring, automated insights, anomaly detection, and data lineage tracking across all connected sources.', 'feature', 'dashboard', 'published', now()),
  ('1.3.0', 'Automation Engine', 'Create custom if/then rules to automate categorization, notifications, approvals, and webhook deliveries based on treasury events.', 'feature', 'integrations', 'published', now());

-- ═══════════════════════════════════════════════════
-- INDEXES
-- ═══════════════════════════════════════════════════

create index if not exists idx_pay_acct_org on public.payment_accounts(org_id, status);
create index if not exists idx_payees_org on public.payees(org_id, status);
create index if not exists idx_pay_tx_org on public.payment_transactions(org_id, status, created_at desc);
create index if not exists idx_pay_tx_ref on public.payment_transactions(reference_number);
create index if not exists idx_pay_tx_from on public.payment_transactions(from_account_id, created_at desc);
create index if not exists idx_pay_tx_approval on public.payment_transactions(org_id, approval_status) where approval_status = 'pending';
create index if not exists idx_pay_batch_org on public.payment_batches(org_id, status);
create index if not exists idx_recurring_org on public.recurring_payments(org_id, status, next_payment_date);
create index if not exists idx_ui_comp on public.ui_component_registry(category, status);
create index if not exists idx_ui_states on public.ui_page_states(page_path, state_type);
create index if not exists idx_ui_themes on public.ui_themes(is_system, is_default);
create index if not exists idx_auto_rules_org on public.automation_rules(org_id, enabled, trigger_type);
create index if not exists idx_auto_exec_rule on public.automation_executions(rule_id, created_at desc);
create index if not exists idx_auto_exec_org on public.automation_executions(org_id, status, created_at desc);
create index if not exists idx_changelog on public.changelog_entries(status, published_at desc);
create index if not exists idx_webhook_subs_org on public.webhook_subscriptions(org_id, enabled);
create index if not exists idx_webhook_del_sub on public.webhook_deliveries(subscription_id, created_at desc);

-- ═══════════════════════════════════════════════════
-- RLS
-- ═══════════════════════════════════════════════════

alter table public.payment_accounts enable row level security;
alter table public.payees enable row level security;
alter table public.payment_transactions enable row level security;
alter table public.payment_batches enable row level security;
alter table public.recurring_payments enable row level security;
alter table public.ui_component_registry enable row level security;
alter table public.ui_page_states enable row level security;
alter table public.ui_themes enable row level security;
alter table public.automation_rules enable row level security;
alter table public.automation_executions enable row level security;
alter table public.changelog_entries enable row level security;
alter table public.webhook_subscriptions enable row level security;
alter table public.webhook_deliveries enable row level security;

-- Payments: org-scoped
do $$ begin execute 'drop policy if exists "' || 'Users view org payment accounts' || '" on ' || current_schema || '.'; exception when others then null; end $$;
create policy "Users view org payment accounts" on public.payment_accounts for select using (org_id in (select org_id from public.profiles where id = auth.uid()));
do $$ begin execute 'drop policy if exists "' || 'Admins manage payment accounts' || '" on ' || current_schema || '.'; exception when others then null; end $$;
create policy "Admins manage payment accounts" on public.payment_accounts for all using (org_id in (select org_id from public.profiles where id = auth.uid() and role in ('owner','admin')));
do $$ begin execute 'drop policy if exists "' || 'Users view org payees' || '" on ' || current_schema || '.'; exception when others then null; end $$;
create policy "Users view org payees" on public.payees for select using (org_id in (select org_id from public.profiles where id = auth.uid()));
do $$ begin execute 'drop policy if exists "' || 'Users manage payees' || '" on ' || current_schema || '.'; exception when others then null; end $$;
create policy "Users manage payees" on public.payees for all using (org_id in (select org_id from public.profiles where id = auth.uid()));
do $$ begin execute 'drop policy if exists "' || 'Users view org payments' || '" on ' || current_schema || '.'; exception when others then null; end $$;
create policy "Users view org payments" on public.payment_transactions for select using (org_id in (select org_id from public.profiles where id = auth.uid()));
do $$ begin execute 'drop policy if exists "' || 'Users create payments' || '" on ' || current_schema || '.'; exception when others then null; end $$;
create policy "Users create payments" on public.payment_transactions for insert with check (org_id in (select org_id from public.profiles where id = auth.uid()));
do $$ begin execute 'drop policy if exists "' || 'Users view org batches' || '" on ' || current_schema || '.'; exception when others then null; end $$;
create policy "Users view org batches" on public.payment_batches for select using (org_id in (select org_id from public.profiles where id = auth.uid()));
do $$ begin execute 'drop policy if exists "' || 'Users view org recurring' || '" on ' || current_schema || '.'; exception when others then null; end $$;
create policy "Users view org recurring" on public.recurring_payments for select using (org_id in (select org_id from public.profiles where id = auth.uid()));

-- UI: public read
do $$ begin execute 'drop policy if exists "' || 'Anyone reads components' || '" on ' || current_schema || '.'; exception when others then null; end $$;
create policy "Anyone reads components" on public.ui_component_registry for select using (true);
do $$ begin execute 'drop policy if exists "' || 'Anyone reads page states' || '" on ' || current_schema || '.'; exception when others then null; end $$;
create policy "Anyone reads page states" on public.ui_page_states for select using (true);
do $$ begin execute 'drop policy if exists "' || 'Anyone reads themes' || '" on ' || current_schema || '.'; exception when others then null; end $$;
create policy "Anyone reads themes" on public.ui_themes for select using (true);

-- Automation: org-scoped
do $$ begin execute 'drop policy if exists "' || 'Users view org automations' || '" on ' || current_schema || '.'; exception when others then null; end $$;
create policy "Users view org automations" on public.automation_rules for select using (org_id in (select org_id from public.profiles where id = auth.uid()));
do $$ begin execute 'drop policy if exists "' || 'Admins manage automations' || '" on ' || current_schema || '.'; exception when others then null; end $$;
create policy "Admins manage automations" on public.automation_rules for all using (org_id in (select org_id from public.profiles where id = auth.uid() and role in ('owner','admin')));
do $$ begin execute 'drop policy if exists "' || 'Users view org executions' || '" on ' || current_schema || '.'; exception when others then null; end $$;
create policy "Users view org executions" on public.automation_executions for select using (org_id in (select org_id from public.profiles where id = auth.uid()));
do $$ begin execute 'drop policy if exists "' || 'Anyone reads published changelog' || '" on ' || current_schema || '.'; exception when others then null; end $$;
create policy "Anyone reads published changelog" on public.changelog_entries for select using (status = 'published');
do $$ begin execute 'drop policy if exists "' || 'Users view org webhooks' || '" on ' || current_schema || '.'; exception when others then null; end $$;
create policy "Users view org webhooks" on public.webhook_subscriptions for select using (org_id in (select org_id from public.profiles where id = auth.uid()));
do $$ begin execute 'drop policy if exists "' || 'Admins manage webhooks' || '" on ' || current_schema || '.'; exception when others then null; end $$;
create policy "Admins manage webhooks" on public.webhook_subscriptions for all using (org_id in (select org_id from public.profiles where id = auth.uid() and role in ('owner','admin')));
do $$ begin execute 'drop policy if exists "' || 'Users view webhook deliveries' || '" on ' || current_schema || '.'; exception when others then null; end $$;
create policy "Users view webhook deliveries" on public.webhook_deliveries for select using (subscription_id in (select id from public.webhook_subscriptions where org_id in (select org_id from public.profiles where id = auth.uid())));

-- Service role
do $$ begin execute 'drop policy if exists "' || 'Service manages payment accounts' || '" on ' || current_schema || '.'; exception when others then null; end $$;
create policy "Service manages payment accounts" on public.payment_accounts for all using (true) with check (true);
do $$ begin execute 'drop policy if exists "' || 'Service manages payment tx' || '" on ' || current_schema || '.'; exception when others then null; end $$;
create policy "Service manages payment tx" on public.payment_transactions for all using (true) with check (true);
do $$ begin execute 'drop policy if exists "' || 'Service manages batches' || '" on ' || current_schema || '.'; exception when others then null; end $$;
create policy "Service manages batches" on public.payment_batches for all using (true) with check (true);
do $$ begin execute 'drop policy if exists "' || 'Service manages recurring' || '" on ' || current_schema || '.'; exception when others then null; end $$;
create policy "Service manages recurring" on public.recurring_payments for all using (true) with check (true);
do $$ begin execute 'drop policy if exists "' || 'Service manages automations' || '" on ' || current_schema || '.'; exception when others then null; end $$;
create policy "Service manages automations" on public.automation_rules for all using (true) with check (true);
do $$ begin execute 'drop policy if exists "' || 'Service manages executions' || '" on ' || current_schema || '.'; exception when others then null; end $$;
create policy "Service manages executions" on public.automation_executions for all using (true) with check (true);
do $$ begin execute 'drop policy if exists "' || 'Service manages changelog' || '" on ' || current_schema || '.'; exception when others then null; end $$;
create policy "Service manages changelog" on public.changelog_entries for all using (true) with check (true);
do $$ begin execute 'drop policy if exists "' || 'Service manages webhook subs' || '" on ' || current_schema || '.'; exception when others then null; end $$;
create policy "Service manages webhook subs" on public.webhook_subscriptions for all using (true) with check (true);
do $$ begin execute 'drop policy if exists "' || 'Service manages webhook del' || '" on ' || current_schema || '.'; exception when others then null; end $$;
create policy "Service manages webhook del" on public.webhook_deliveries for all using (true) with check (true);
do $$ begin execute 'drop policy if exists "' || 'Service manages page states' || '" on ' || current_schema || '.'; exception when others then null; end $$;
create policy "Service manages page states" on public.ui_page_states for all using (true) with check (true);
do $$ begin execute 'drop policy if exists "' || 'Service manages themes' || '" on ' || current_schema || '.'; exception when others then null; end $$;
create policy "Service manages themes" on public.ui_themes for all using (true) with check (true);
