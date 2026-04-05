-- Migration 015: SWOT Automation — Opportunities, Weaknesses, Threats

-- ═══════════════════════════════════════════════════
-- 1. OPPORTUNITY AUTOMATION PIPELINE
-- ═══════════════════════════════════════════════════

-- ── opportunities: detected and tracked strategic opportunities ──
create table if not exists public.opportunities (
  id uuid primary key default gen_random_uuid(),
  org_id uuid not null references public.organizations(id) on delete cascade,
  -- Detection
  title text not null,
  description text not null,
  opportunity_type text not null check (opportunity_type in (
    'idle_cash_optimization', 'vendor_renegotiation', 'payment_timing',
    'fx_arbitrage', 'credit_line_utilization', 'early_payment_discount',
    'account_consolidation', 'investment_yield', 'cost_reduction',
    'revenue_acceleration', 'process_automation', 'market_expansion',
    'product_upsell', 'partnership', 'compliance_advantage', 'custom'
  )),
  category text not null check (category in ('financial', 'operational', 'strategic', 'market', 'technology')),
  -- Scoring
  impact_score int not null default 0 check (impact_score between 0 and 100),
  effort_score int not null default 0 check (effort_score between 0 and 100), -- lower = easier
  confidence_score int not null default 0 check (confidence_score between 0 and 100),
  priority_score int generated always as (
    case when effort_score = 0 then impact_score * confidence_score / 100
    else (impact_score * confidence_score * (100 - effort_score)) / 10000 end
  ) stored,
  -- Financial impact
  estimated_annual_value numeric(14,2),
  estimated_one_time_value numeric(14,2),
  time_to_value_days int,
  -- Evidence
  evidence jsonb not null default '{}'::jsonb,
  source text not null check (source in ('ai_detected', 'rule_triggered', 'benchmark_gap', 'trend_analysis', 'user_reported', 'market_data', 'system')),
  related_entities text[] default '{}',
  -- Action
  recommended_actions jsonb default '[]'::jsonb, -- [{action, description, effort, impact}]
  action_url text,
  -- Lifecycle
  status text not null default 'new' check (status in ('new', 'evaluating', 'approved', 'in_progress', 'captured', 'declined', 'expired')),
  assigned_to uuid references public.profiles(id),
  evaluated_at timestamptz,
  approved_at timestamptz,
  captured_at timestamptz,
  captured_value numeric(14,2),
  declined_reason text,
  expires_at timestamptz,
  -- Audit
  detected_by text, -- 'idle_cash_scanner', 'vendor_analyzer', etc.
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

-- ── opportunity_rules: automated detection rules ──
create table if not exists public.opportunity_rules (
  id uuid primary key default gen_random_uuid(),
  org_id uuid references public.organizations(id) on delete cascade, -- null = system-wide
  rule_name text not null,
  description text,
  opportunity_type text not null,
  -- Trigger conditions
  trigger_type text not null check (trigger_type in (
    'balance_above_threshold', 'vendor_spend_concentration', 'payment_pattern',
    'fx_rate_movement', 'benchmark_deviation', 'forecast_surplus',
    'unused_credit_line', 'recurring_fee_detected', 'seasonal_pattern',
    'data_quality_improvement', 'scheduled', 'manual'
  )),
  conditions jsonb not null default '{}'::jsonb,
  -- Scoring defaults
  default_impact int default 50,
  default_effort int default 50,
  default_confidence int default 70,
  -- Status
  enabled boolean not null default true,
  last_run_at timestamptz,
  opportunities_generated int default 0,
  created_at timestamptz not null default now()
);

-- ═══════════════════════════════════════════════════
-- 2. WEAKNESS AUTOMATION PIPELINE
-- ═══════════════════════════════════════════════════

-- ── weaknesses: detected internal gaps and vulnerabilities ──
create table if not exists public.weaknesses (
  id uuid primary key default gen_random_uuid(),
  org_id uuid not null references public.organizations(id) on delete cascade,
  title text not null,
  description text not null,
  weakness_type text not null check (weakness_type in (
    'data_quality_gap', 'process_manual', 'single_point_failure',
    'skill_gap', 'technology_debt', 'compliance_gap', 'security_vulnerability',
    'forecast_inaccuracy', 'reconciliation_delay', 'reporting_lag',
    'vendor_concentration', 'bank_concentration', 'integration_missing',
    'documentation_gap', 'audit_finding', 'capacity_constraint', 'custom'
  )),
  category text not null check (category in ('process', 'technology', 'people', 'data', 'compliance', 'financial')),
  -- Severity
  severity text not null default 'medium' check (severity in ('low', 'medium', 'high', 'critical')),
  risk_score int not null default 0 check (risk_score between 0 and 100),
  exploitability text default 'medium' check (exploitability in ('low', 'medium', 'high')), -- how easily a threat can exploit this
  -- Impact
  affected_areas text[] default '{}', -- 'forecasting', 'reporting', 'cash_visibility', etc.
  financial_exposure numeric(14,2),
  operational_impact text, -- 'delays reporting by 3 days', etc.
  -- Evidence
  evidence jsonb not null default '{}'::jsonb,
  source text not null check (source in ('ai_detected', 'quality_check', 'audit_finding', 'benchmark_gap', 'user_reported', 'incident_post_mortem', 'system')),
  related_entities text[] default '{}',
  -- Remediation
  remediation_plan jsonb default '[]'::jsonb, -- [{step, owner, deadline, status}]
  estimated_fix_effort text check (estimated_fix_effort in ('trivial', 'small', 'medium', 'large', 'epic')),
  estimated_fix_days int,
  -- Lifecycle
  status text not null default 'open' check (status in ('open', 'acknowledged', 'remediation_planned', 'in_progress', 'mitigated', 'accepted', 'resolved', 'wont_fix')),
  assigned_to uuid references public.profiles(id),
  acknowledged_at timestamptz,
  remediation_started_at timestamptz,
  resolved_at timestamptz,
  accepted_reason text, -- if accepted without fix
  -- Review
  last_reviewed_at timestamptz,
  next_review_date date,
  review_count int default 0,
  -- Audit
  detected_by text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

-- ── weakness_scans: automated weakness detection runs ──
create table if not exists public.weakness_scans (
  id uuid primary key default gen_random_uuid(),
  org_id uuid not null references public.organizations(id) on delete cascade,
  scan_type text not null check (scan_type in (
    'data_quality', 'process_health', 'integration_coverage',
    'security_posture', 'compliance_readiness', 'forecast_accuracy',
    'comprehensive', 'custom'
  )),
  -- Results
  started_at timestamptz not null default now(),
  completed_at timestamptz,
  duration_ms int,
  checks_run int default 0,
  weaknesses_found int default 0,
  new_weaknesses int default 0,
  resolved_since_last int default 0,
  -- Summary
  overall_health_score int check (overall_health_score between 0 and 100),
  findings jsonb default '[]'::jsonb,
  -- Status
  status text not null default 'running' check (status in ('running', 'completed', 'failed')),
  error_message text,
  created_at timestamptz not null default now()
);

-- ═══════════════════════════════════════════════════
-- 3. THREAT AUTOMATION PIPELINE
-- ═══════════════════════════════════════════════════

-- ── threats: external threats and risk events ──
create table if not exists public.threats (
  id uuid primary key default gen_random_uuid(),
  org_id uuid not null references public.organizations(id) on delete cascade,
  title text not null,
  description text not null,
  threat_type text not null check (threat_type in (
    'market_volatility', 'interest_rate_change', 'fx_adverse_movement',
    'counterparty_risk', 'regulatory_change', 'competitor_action',
    'cyber_attack', 'fraud_attempt', 'vendor_failure', 'bank_instability',
    'economic_downturn', 'supply_chain_disruption', 'talent_loss',
    'technology_obsolescence', 'compliance_deadline', 'geopolitical', 'custom'
  )),
  category text not null check (category in ('financial', 'operational', 'regulatory', 'market', 'technology', 'geopolitical')),
  -- Risk assessment
  likelihood text not null default 'medium' check (likelihood in ('rare', 'unlikely', 'possible', 'likely', 'almost_certain')),
  impact_level text not null default 'medium' check (impact_level in ('insignificant', 'minor', 'moderate', 'major', 'catastrophic')),
  risk_score int not null default 0 check (risk_score between 0 and 100),
  velocity text default 'medium' check (velocity in ('slow', 'medium', 'fast', 'immediate')), -- how fast it materializes
  -- Financial exposure
  potential_loss_min numeric(14,2),
  potential_loss_max numeric(14,2),
  expected_loss numeric(14,2), -- probability-weighted
  -- Evidence
  evidence jsonb not null default '{}'::jsonb,
  source text not null check (source in ('ai_detected', 'market_monitor', 'news_alert', 'rate_watch', 'vendor_monitor', 'security_scan', 'user_reported', 'regulatory_feed', 'system')),
  external_url text,
  related_entities text[] default '{}',
  -- Linked weaknesses this threat can exploit
  exploits_weaknesses uuid[] default '{}',
  -- Countermeasures
  countermeasures jsonb default '[]'::jsonb, -- [{measure, status, owner, effectiveness}]
  contingency_plan text,
  -- Monitoring
  monitoring_enabled boolean not null default true,
  monitor_frequency text default 'daily' check (monitor_frequency in ('hourly', 'daily', 'weekly', 'monthly')),
  last_monitored_at timestamptz,
  trend text default 'stable' check (trend in ('improving', 'stable', 'worsening', 'escalating')),
  -- Lifecycle
  status text not null default 'active' check (status in ('active', 'monitoring', 'mitigated', 'materialized', 'expired', 'accepted')),
  assigned_to uuid references public.profiles(id),
  escalated boolean not null default false,
  escalated_at timestamptz,
  materialized_at timestamptz,
  materialized_loss numeric(14,2),
  mitigated_at timestamptz,
  -- Review
  last_reviewed_at timestamptz,
  next_review_date date,
  review_count int default 0,
  -- Audit
  detected_by text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

-- ── threat_monitors: automated threat detection feeds ──
create table if not exists public.threat_monitors (
  id uuid primary key default gen_random_uuid(),
  org_id uuid references public.organizations(id) on delete cascade,
  monitor_name text not null,
  monitor_type text not null check (monitor_type in (
    'fx_rate_watch', 'interest_rate_watch', 'vendor_health',
    'bank_stability', 'regulatory_tracker', 'market_volatility',
    'cyber_threat_feed', 'competitor_watch', 'news_sentiment',
    'supply_chain', 'economic_indicators', 'custom'
  )),
  -- Configuration
  config jsonb not null default '{}'::jsonb, -- thresholds, watched entities, etc.
  alert_threshold jsonb default '{}'::jsonb, -- when to create a threat
  -- Status
  enabled boolean not null default true,
  last_check_at timestamptz,
  last_alert_at timestamptz,
  checks_run int default 0,
  threats_generated int default 0,
  -- Health
  consecutive_failures int default 0,
  last_error text,
  created_at timestamptz not null default now()
);

-- ── swot_matrix: periodic SWOT snapshot for strategic review ──
create table if not exists public.swot_matrix (
  id uuid primary key default gen_random_uuid(),
  org_id uuid not null references public.organizations(id) on delete cascade,
  period date not null,
  -- Counts
  strengths_count int default 0,
  weaknesses_count int default 0,
  opportunities_count int default 0,
  threats_count int default 0,
  -- Scores
  overall_health_score int check (overall_health_score between 0 and 100),
  opportunity_score int check (opportunity_score between 0 and 100),
  risk_score int check (risk_score between 0 and 100),
  -- Top items (for dashboard)
  top_opportunities jsonb default '[]'::jsonb,
  top_weaknesses jsonb default '[]'::jsonb,
  top_threats jsonb default '[]'::jsonb,
  -- Financial summary
  total_opportunity_value numeric(16,2) default 0,
  total_threat_exposure numeric(16,2) default 0,
  total_weakness_exposure numeric(16,2) default 0,
  -- Delta from previous period
  opportunity_delta int default 0,
  weakness_delta int default 0,
  threat_delta int default 0,
  created_at timestamptz not null default now(),
  unique(org_id, period)
);

-- ═══════════════════════════════════════════════════
-- INDEXES
-- ═══════════════════════════════════════════════════

create index if not exists idx_opps_org on public.opportunities(org_id, status, created_at desc);
create index if not exists idx_opps_type on public.opportunities(org_id, opportunity_type, status);
create index if not exists idx_opps_priority on public.opportunities(org_id, priority_score desc) where status in ('new', 'evaluating', 'approved');
create index if not exists idx_opp_rules_org on public.opportunity_rules(org_id, enabled);
create index if not exists idx_weak_org on public.weaknesses(org_id, status, severity);
create index if not exists idx_weak_type on public.weaknesses(org_id, weakness_type, status);
create index if not exists idx_weak_critical on public.weaknesses(org_id) where severity in ('high', 'critical') and status not in ('resolved', 'wont_fix');
create index if not exists idx_weak_scans on public.weakness_scans(org_id, created_at desc);
create index if not exists idx_threats_org on public.threats(org_id, status, risk_score desc);
create index if not exists idx_threats_type on public.threats(org_id, threat_type, status);
create index if not exists idx_threats_active on public.threats(org_id) where status in ('active', 'monitoring') and risk_score >= 60;
create index if not exists idx_threat_monitors on public.threat_monitors(org_id, enabled);
create index if not exists idx_swot_matrix on public.swot_matrix(org_id, period desc);

-- ═══════════════════════════════════════════════════
-- RLS
-- ═══════════════════════════════════════════════════

alter table public.opportunities enable row level security;
alter table public.opportunity_rules enable row level security;
alter table public.weaknesses enable row level security;
alter table public.weakness_scans enable row level security;
alter table public.threats enable row level security;
alter table public.threat_monitors enable row level security;
alter table public.swot_matrix enable row level security;

do $$ begin execute 'drop policy if exists "' || 'Users view org opportunities' || '" on ' || current_schema || '.'; exception when others then null; end $$;
create policy "Users view org opportunities" on public.opportunities for select using (org_id in (select org_id from public.profiles where id = auth.uid()));
do $$ begin execute 'drop policy if exists "' || 'Users manage org opportunities' || '" on ' || current_schema || '.'; exception when others then null; end $$;
create policy "Users manage org opportunities" on public.opportunities for update using (org_id in (select org_id from public.profiles where id = auth.uid()));
do $$ begin execute 'drop policy if exists "' || 'Users view org weaknesses' || '" on ' || current_schema || '.'; exception when others then null; end $$;
create policy "Users view org weaknesses" on public.weaknesses for select using (org_id in (select org_id from public.profiles where id = auth.uid()));
do $$ begin execute 'drop policy if exists "' || 'Users manage org weaknesses' || '" on ' || current_schema || '.'; exception when others then null; end $$;
create policy "Users manage org weaknesses" on public.weaknesses for update using (org_id in (select org_id from public.profiles where id = auth.uid()));
do $$ begin execute 'drop policy if exists "' || 'Users view org threats' || '" on ' || current_schema || '.'; exception when others then null; end $$;
create policy "Users view org threats" on public.threats for select using (org_id in (select org_id from public.profiles where id = auth.uid()));
do $$ begin execute 'drop policy if exists "' || 'Users manage org threats' || '" on ' || current_schema || '.'; exception when others then null; end $$;
create policy "Users manage org threats" on public.threats for update using (org_id in (select org_id from public.profiles where id = auth.uid()));
do $$ begin execute 'drop policy if exists "' || 'Users view org swot matrix' || '" on ' || current_schema || '.'; exception when others then null; end $$;
create policy "Users view org swot matrix" on public.swot_matrix for select using (org_id in (select org_id from public.profiles where id = auth.uid()));
do $$ begin execute 'drop policy if exists "' || 'Admins manage opp rules' || '" on ' || current_schema || '.'; exception when others then null; end $$;
create policy "Admins manage opp rules" on public.opportunity_rules for all using (org_id in (select org_id from public.profiles where id = auth.uid() and role in ('owner','admin')));
do $$ begin execute 'drop policy if exists "' || 'Admins manage threat monitors' || '" on ' || current_schema || '.'; exception when others then null; end $$;
create policy "Admins manage threat monitors" on public.threat_monitors for all using (org_id in (select org_id from public.profiles where id = auth.uid() and role in ('owner','admin')));
do $$ begin execute 'drop policy if exists "' || 'Users view weakness scans' || '" on ' || current_schema || '.'; exception when others then null; end $$;
create policy "Users view weakness scans" on public.weakness_scans for select using (org_id in (select org_id from public.profiles where id = auth.uid()));

-- Service role
do $$ begin execute 'drop policy if exists "' || 'Service manages opportunities' || '" on ' || current_schema || '.'; exception when others then null; end $$;
create policy "Service manages opportunities" on public.opportunities for all using (true) with check (true);
do $$ begin execute 'drop policy if exists "' || 'Service manages opp rules' || '" on ' || current_schema || '.'; exception when others then null; end $$;
create policy "Service manages opp rules" on public.opportunity_rules for all using (true) with check (true);
do $$ begin execute 'drop policy if exists "' || 'Service manages weaknesses' || '" on ' || current_schema || '.'; exception when others then null; end $$;
create policy "Service manages weaknesses" on public.weaknesses for all using (true) with check (true);
do $$ begin execute 'drop policy if exists "' || 'Service manages weakness scans' || '" on ' || current_schema || '.'; exception when others then null; end $$;
create policy "Service manages weakness scans" on public.weakness_scans for all using (true) with check (true);
do $$ begin execute 'drop policy if exists "' || 'Service manages threats' || '" on ' || current_schema || '.'; exception when others then null; end $$;
create policy "Service manages threats" on public.threats for all using (true) with check (true);
do $$ begin execute 'drop policy if exists "' || 'Service manages threat monitors' || '" on ' || current_schema || '.'; exception when others then null; end $$;
create policy "Service manages threat monitors" on public.threat_monitors for all using (true) with check (true);
do $$ begin execute 'drop policy if exists "' || 'Service manages swot matrix' || '" on ' || current_schema || '.'; exception when others then null; end $$;
create policy "Service manages swot matrix" on public.swot_matrix for all using (true) with check (true);

-- ═══════════════════════════════════════════════════
-- SEED: System-wide opportunity rules
-- ═══════════════════════════════════════════════════

insert into public.opportunity_rules (rule_name, description, opportunity_type, trigger_type, conditions, default_impact, default_effort, default_confidence) values
  ('Idle Cash Detector', 'Flags accounts with balances above operating needs for 7+ days', 'idle_cash_optimization', 'balance_above_threshold', '{"threshold_multiplier":1.5,"min_days_idle":7}', 75, 20, 85),
  ('Vendor Spend Concentrator', 'Identifies top vendors eligible for volume discount renegotiation', 'vendor_renegotiation', 'vendor_spend_concentration', '{"min_annual_spend":50000,"min_payment_count":12}', 60, 40, 70),
  ('Early Payment Discount Scanner', 'Detects invoices where 2/10 net 30 saves money vs cost of capital', 'early_payment_discount', 'payment_pattern', '{"min_discount_pct":1.5,"max_cost_of_capital_pct":5}', 50, 15, 80),
  ('FX Rate Opportunity Watch', 'Alerts when tracked currency pairs move favorably beyond threshold', 'fx_arbitrage', 'fx_rate_movement', '{"movement_pct":2,"favorable_direction":"buy_low"}', 65, 30, 60),
  ('Account Consolidation Finder', 'Identifies accounts that could be consolidated to reduce fees', 'account_consolidation', 'balance_above_threshold', '{"min_accounts":3,"min_avg_balance":5000}', 45, 35, 75),
  ('Forecast Surplus Alert', 'Detects when forecast shows persistent cash surplus above target', 'investment_yield', 'forecast_surplus', '{"surplus_threshold_pct":20,"min_months":3}', 70, 25, 65);
