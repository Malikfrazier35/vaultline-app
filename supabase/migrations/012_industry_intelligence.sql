-- Migration 012: Industry Diversity Acceptance & Data Intelligence

-- ═══════════════════════════════════════════════════
-- 1. INDUSTRY DIVERSITY & ACCEPTANCE PIPELINE
-- ═══════════════════════════════════════════════════

-- ── industry_profiles: master registry of supported verticals ──
create table if not exists public.industry_profiles (
  id text primary key, -- 'saas', 'healthcare', 'manufacturing', etc.
  name text not null,
  description text,
  icon text, -- lucide icon name
  color text, -- hex color
  -- Onboarding customization
  onboarding_steps jsonb not null default '[]'::jsonb, -- [{stepId, title, desc, required}]
  default_accounts text[] default '{}', -- suggested bank account types
  default_categories text[] default '{}', -- suggested transaction categories
  default_reports text[] default '{}', -- suggested report templates
  default_alerts jsonb default '[]'::jsonb, -- suggested alert thresholds
  -- Compliance requirements
  regulations text[] default '{}', -- 'sox', 'hipaa', 'pci', 'gdpr', etc.
  compliance_notes text,
  -- Terminology overrides
  terminology jsonb default '{}'::jsonb, -- {"revenue":"Tuition","client":"Patient","invoice":"Claim"}
  -- KPIs
  key_metrics text[] default '{}', -- industry-specific metrics
  benchmark_data jsonb default '{}'::jsonb, -- median values for benchmarking
  -- Marketing
  pain_points text[] default '{}',
  value_props text[] default '{}',
  case_study_url text,
  -- Status
  tier text not null default 'general' check (tier in ('general', 'supported', 'specialized', 'coming_soon')),
  display_order int default 100,
  created_at timestamptz not null default now()
);

-- ── org_industry_config: per-org industry selection and customization ──
create table if not exists public.org_industry_config (
  id uuid primary key default gen_random_uuid(),
  org_id uuid not null references public.organizations(id) on delete cascade,
  industry_id text not null references public.industry_profiles(id),
  sub_vertical text, -- e.g. 'biotech' under 'healthcare'
  company_size text check (company_size in ('startup', 'smb', 'mid_market', 'enterprise')),
  annual_revenue_range text, -- '$1M-$10M', '$10M-$50M', etc.
  employee_count_range text,
  -- Customization
  custom_terminology jsonb default '{}'::jsonb,
  custom_categories text[] default '{}',
  custom_reports text[] default '{}',
  -- Acceptance criteria tracking
  regulatory_requirements text[] default '{}',
  compliance_acknowledged boolean not null default false,
  dpa_required boolean not null default false,
  dpa_signed boolean not null default false,
  -- Onboarding progress
  onboarding_score int default 0 check (onboarding_score between 0 and 100),
  onboarding_completed_at timestamptz,
  -- Due diligence
  kyb_status text default 'pending' check (kyb_status in ('pending', 'in_progress', 'verified', 'failed', 'exempt')),
  risk_tier text default 'standard' check (risk_tier in ('low', 'standard', 'elevated', 'high')),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique(org_id)
);

-- ── industry_content: vertical-specific marketing content ──
create table if not exists public.industry_content (
  id uuid primary key default gen_random_uuid(),
  industry_id text not null references public.industry_profiles(id),
  content_type text not null check (content_type in (
    'landing_hero', 'value_prop', 'testimonial', 'case_study',
    'faq', 'comparison', 'checklist', 'roi_model', 'email_sequence',
    'ad_copy', 'social_post', 'webinar_topic'
  )),
  title text not null,
  body text,
  cta_text text,
  cta_url text,
  asset_url text,
  -- Targeting
  persona text, -- 'cfo', 'controller', 'treasury_analyst', 'ceo'
  funnel_stage text check (funnel_stage in ('awareness', 'consideration', 'decision', 'retention')),
  -- Performance
  views int default 0,
  clicks int default 0,
  conversions int default 0,
  -- Status
  status text default 'draft' check (status in ('draft', 'published', 'archived')),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

-- ── diversity_metrics: DEI tracking for customer base ──
create table if not exists public.diversity_metrics (
  id uuid primary key default gen_random_uuid(),
  period date not null, -- month
  -- Customer diversity
  total_orgs int default 0,
  industries_represented int default 0,
  geographic_regions int default 0,
  company_sizes jsonb default '{}'::jsonb, -- {"startup":12,"smb":45,...}
  -- Optional self-reported (org-level, never required)
  minority_owned_count int default 0,
  women_owned_count int default 0,
  veteran_owned_count int default 0,
  -- Industry distribution
  industry_breakdown jsonb default '{}'::jsonb, -- {"saas":30,"healthcare":15,...}
  revenue_range_breakdown jsonb default '{}'::jsonb,
  -- Goals
  target_industry_count int default 12,
  target_geo_regions int default 10,
  created_at timestamptz not null default now(),
  unique(period)
);

-- ═══════════════════════════════════════════════════
-- 2. DATA INTELLIGENCE PIPELINE
-- ═══════════════════════════════════════════════════

-- ── data_sources: registry of all connected data sources ──
create table if not exists public.data_sources (
  id uuid primary key default gen_random_uuid(),
  org_id uuid not null references public.organizations(id) on delete cascade,
  source_type text not null check (source_type in (
    'bank_plaid', 'bank_manual', 'accounting_qb', 'accounting_xero',
    'accounting_sage', 'erp', 'csv_import', 'api', 'webhook', 'manual'
  )),
  source_name text not null,
  -- Connection health
  status text not null default 'active' check (status in ('active', 'degraded', 'error', 'disconnected', 'pending')),
  last_sync_at timestamptz,
  last_sync_status text check (last_sync_status in ('success', 'partial', 'failed')),
  sync_frequency text default 'daily',
  records_synced int default 0,
  -- Data quality
  quality_score int default 0 check (quality_score between 0 and 100),
  completeness_pct int default 0,
  accuracy_score int default 0,
  freshness_hours int default 0,
  -- Schema
  fields_mapped int default 0,
  fields_total int default 0,
  unmapped_fields text[] default '{}',
  -- Metadata
  config jsonb default '{}'::jsonb,
  error_log jsonb default '[]'::jsonb,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

-- ── data_quality_rules: automated quality checks ──
create table if not exists public.data_quality_rules (
  id uuid primary key default gen_random_uuid(),
  org_id uuid references public.organizations(id) on delete cascade,
  rule_name text not null,
  description text,
  rule_type text not null check (rule_type in (
    'completeness', 'uniqueness', 'validity', 'consistency',
    'timeliness', 'accuracy', 'range_check', 'pattern_match',
    'cross_field', 'duplicate_detection', 'anomaly'
  )),
  target_table text not null, -- 'transactions', 'accounts', 'invoices', etc.
  target_field text,
  -- Rule definition
  condition jsonb not null, -- {"operator":"not_null"} or {"min":0,"max":1000000} etc.
  severity text not null default 'warning' check (severity in ('info', 'warning', 'error', 'critical')),
  -- Execution
  enabled boolean not null default true,
  last_run_at timestamptz,
  last_result text check (last_result in ('pass', 'fail', 'error')),
  violations_count int default 0,
  -- Auto-fix
  auto_fix boolean not null default false,
  fix_action text, -- 'set_default', 'flag_review', 'quarantine', 'notify'
  created_at timestamptz not null default now()
);

-- ── data_quality_issues: tracked quality violations ──
create table if not exists public.data_quality_issues (
  id uuid primary key default gen_random_uuid(),
  org_id uuid not null references public.organizations(id) on delete cascade,
  rule_id uuid references public.data_quality_rules(id),
  source_id uuid references public.data_sources(id),
  -- Issue details
  issue_type text not null,
  severity text not null default 'warning',
  table_name text not null,
  field_name text,
  record_id text,
  current_value text,
  expected_value text,
  description text,
  -- Resolution
  status text not null default 'open' check (status in ('open', 'investigating', 'resolved', 'ignored', 'auto_fixed')),
  resolved_by uuid references public.profiles(id),
  resolved_at timestamptz,
  resolution_notes text,
  -- Impact
  affected_records int default 1,
  financial_impact numeric(14,2),
  created_at timestamptz not null default now()
);

-- ── data_insights: AI-generated insights from treasury data ──
create table if not exists public.data_insights (
  id uuid primary key default gen_random_uuid(),
  org_id uuid not null references public.organizations(id) on delete cascade,
  -- Insight
  insight_type text not null check (insight_type in (
    'anomaly', 'trend', 'correlation', 'forecast_deviation',
    'cost_optimization', 'cash_pattern', 'vendor_analysis',
    'seasonal_pattern', 'risk_signal', 'benchmark_deviation',
    'duplicate_payment', 'categorization_suggestion'
  )),
  title text not null,
  description text not null,
  severity text not null default 'info' check (severity in ('info', 'suggestion', 'warning', 'alert', 'critical')),
  -- Evidence
  evidence jsonb not null default '{}'::jsonb, -- supporting data points
  affected_entities text[] default '{}', -- account IDs, transaction IDs, etc.
  financial_impact numeric(14,2),
  confidence_score int default 0 check (confidence_score between 0 and 100),
  -- Action
  recommended_action text,
  action_url text,
  -- Lifecycle
  status text not null default 'new' check (status in ('new', 'viewed', 'acknowledged', 'acted_on', 'dismissed', 'expired')),
  viewed_at timestamptz,
  acted_on_at timestamptz,
  dismissed_at timestamptz,
  expires_at timestamptz,
  -- Feedback
  helpful boolean,
  feedback_text text,
  created_at timestamptz not null default now()
);

-- ── data_lineage: tracks data flow and transformation ──
create table if not exists public.data_lineage (
  id uuid primary key default gen_random_uuid(),
  org_id uuid not null references public.organizations(id) on delete cascade,
  -- Source
  source_type text not null, -- 'plaid', 'quickbooks', 'csv', 'manual', 'computed'
  source_id text,
  source_field text,
  -- Destination
  dest_table text not null,
  dest_field text not null,
  dest_record_id text,
  -- Transformation
  transformation text, -- 'direct_map', 'computed', 'aggregated', 'enriched', 'normalized'
  transform_logic text, -- description or formula
  -- Timestamp
  processed_at timestamptz not null default now(),
  -- Audit
  batch_id text,
  record_count int default 1
);

-- ── intelligence_reports: scheduled intelligence digests ──
create table if not exists public.intelligence_reports (
  id uuid primary key default gen_random_uuid(),
  org_id uuid not null references public.organizations(id) on delete cascade,
  report_type text not null check (report_type in (
    'daily_digest', 'weekly_summary', 'monthly_intelligence',
    'anomaly_report', 'quality_report', 'trend_report',
    'risk_report', 'benchmark_report'
  )),
  title text not null,
  -- Content
  summary text,
  sections jsonb not null default '[]'::jsonb, -- [{title, body, charts, metrics}]
  insights_included uuid[] default '{}', -- references to data_insights
  -- Delivery
  generated_at timestamptz not null default now(),
  delivered_to text[] default '{}',
  delivery_method text default 'in_app' check (delivery_method in ('in_app', 'email', 'slack', 'pdf')),
  -- Metadata
  data_range_start date,
  data_range_end date,
  metrics_snapshot jsonb default '{}'::jsonb,
  created_at timestamptz not null default now()
);

-- ═══════════════════════════════════════════════════
-- INDEXES
-- ═══════════════════════════════════════════════════

-- Industry
create index if not exists idx_industry_profiles_tier on public.industry_profiles(tier, display_order);
create index if not exists idx_org_industry_org on public.org_industry_config(org_id);
create index if not exists idx_org_industry_industry on public.org_industry_config(industry_id);
create index if not exists idx_industry_content_industry on public.industry_content(industry_id, content_type, status);
create index if not exists idx_diversity_period on public.diversity_metrics(period desc);

-- Data Intelligence
create index if not exists idx_data_sources_org on public.data_sources(org_id, status);
create index if not exists idx_dq_rules_org on public.data_quality_rules(org_id, target_table, enabled);
create index if not exists idx_dq_issues_org on public.data_quality_issues(org_id, status, severity);
create index if not exists idx_dq_issues_open on public.data_quality_issues(org_id, status) where status = 'open';
create index if not exists idx_insights_org on public.data_insights(org_id, status, created_at desc);
create index if not exists idx_insights_type on public.data_insights(org_id, insight_type, created_at desc);
create index if not exists idx_insights_new on public.data_insights(org_id) where status = 'new';
create index if not exists idx_lineage_dest on public.data_lineage(org_id, dest_table, dest_field);
create index if not exists idx_lineage_source on public.data_lineage(org_id, source_type, source_id);
create index if not exists idx_intel_reports_org on public.intelligence_reports(org_id, report_type, generated_at desc);

-- ═══════════════════════════════════════════════════
-- RLS
-- ═══════════════════════════════════════════════════

alter table public.industry_profiles enable row level security;
alter table public.org_industry_config enable row level security;
alter table public.industry_content enable row level security;
alter table public.diversity_metrics enable row level security;
alter table public.data_sources enable row level security;
alter table public.data_quality_rules enable row level security;
alter table public.data_quality_issues enable row level security;
alter table public.data_insights enable row level security;
alter table public.data_lineage enable row level security;
alter table public.intelligence_reports enable row level security;

-- Public reads
do $$ begin execute 'drop policy if exists "' || 'Anyone reads industry profiles' || '" on ' || current_schema || '.'; exception when others then null; end $$;
create policy "Anyone reads industry profiles" on public.industry_profiles for select using (true);
do $$ begin execute 'drop policy if exists "' || 'Anyone reads published industry content' || '" on ' || current_schema || '.'; exception when others then null; end $$;
create policy "Anyone reads published industry content" on public.industry_content for select using (status = 'published');

-- Org-scoped
do $$ begin execute 'drop policy if exists "' || 'Users view org industry config' || '" on ' || current_schema || '.'; exception when others then null; end $$;
create policy "Users view org industry config" on public.org_industry_config for select using (org_id in (select org_id from public.profiles where id = auth.uid()));
do $$ begin execute 'drop policy if exists "' || 'Admins manage org industry config' || '" on ' || current_schema || '.'; exception when others then null; end $$;
create policy "Admins manage org industry config" on public.org_industry_config for all using (org_id in (select org_id from public.profiles where id = auth.uid() and role in ('owner','admin')));
do $$ begin execute 'drop policy if exists "' || 'Users view org data sources' || '" on ' || current_schema || '.'; exception when others then null; end $$;
create policy "Users view org data sources" on public.data_sources for select using (org_id in (select org_id from public.profiles where id = auth.uid()));
do $$ begin execute 'drop policy if exists "' || 'Users view org quality rules' || '" on ' || current_schema || '.'; exception when others then null; end $$;
create policy "Users view org quality rules" on public.data_quality_rules for select using (org_id in (select org_id from public.profiles where id = auth.uid()));
do $$ begin execute 'drop policy if exists "' || 'Users view org quality issues' || '" on ' || current_schema || '.'; exception when others then null; end $$;
create policy "Users view org quality issues" on public.data_quality_issues for select using (org_id in (select org_id from public.profiles where id = auth.uid()));
do $$ begin execute 'drop policy if exists "' || 'Users manage org quality issues' || '" on ' || current_schema || '.'; exception when others then null; end $$;
create policy "Users manage org quality issues" on public.data_quality_issues for update using (org_id in (select org_id from public.profiles where id = auth.uid()));
do $$ begin execute 'drop policy if exists "' || 'Users view org insights' || '" on ' || current_schema || '.'; exception when others then null; end $$;
create policy "Users view org insights" on public.data_insights for select using (org_id in (select org_id from public.profiles where id = auth.uid()));
do $$ begin execute 'drop policy if exists "' || 'Users manage org insights' || '" on ' || current_schema || '.'; exception when others then null; end $$;
create policy "Users manage org insights" on public.data_insights for update using (org_id in (select org_id from public.profiles where id = auth.uid()));
do $$ begin execute 'drop policy if exists "' || 'Users view org lineage' || '" on ' || current_schema || '.'; exception when others then null; end $$;
create policy "Users view org lineage" on public.data_lineage for select using (org_id in (select org_id from public.profiles where id = auth.uid()));
do $$ begin execute 'drop policy if exists "' || 'Users view org intel reports' || '" on ' || current_schema || '.'; exception when others then null; end $$;
create policy "Users view org intel reports" on public.intelligence_reports for select using (org_id in (select org_id from public.profiles where id = auth.uid()));

-- Service role
do $$ begin execute 'drop policy if exists "' || 'Service manages industry profiles' || '" on ' || current_schema || '.'; exception when others then null; end $$;
create policy "Service manages industry profiles" on public.industry_profiles for all using (true) with check (true);
do $$ begin execute 'drop policy if exists "' || 'Service manages industry content' || '" on ' || current_schema || '.'; exception when others then null; end $$;
create policy "Service manages industry content" on public.industry_content for all using (true) with check (true);
do $$ begin execute 'drop policy if exists "' || 'Service manages diversity metrics' || '" on ' || current_schema || '.'; exception when others then null; end $$;
create policy "Service manages diversity metrics" on public.diversity_metrics for all using (true) with check (true);
do $$ begin execute 'drop policy if exists "' || 'Service manages data sources' || '" on ' || current_schema || '.'; exception when others then null; end $$;
create policy "Service manages data sources" on public.data_sources for all using (true) with check (true);
do $$ begin execute 'drop policy if exists "' || 'Service manages quality rules' || '" on ' || current_schema || '.'; exception when others then null; end $$;
create policy "Service manages quality rules" on public.data_quality_rules for all using (true) with check (true);
do $$ begin execute 'drop policy if exists "' || 'Service manages quality issues' || '" on ' || current_schema || '.'; exception when others then null; end $$;
create policy "Service manages quality issues" on public.data_quality_issues for all using (true) with check (true);
do $$ begin execute 'drop policy if exists "' || 'Service manages insights' || '" on ' || current_schema || '.'; exception when others then null; end $$;
create policy "Service manages insights" on public.data_insights for all using (true) with check (true);
do $$ begin execute 'drop policy if exists "' || 'Service manages lineage' || '" on ' || current_schema || '.'; exception when others then null; end $$;
create policy "Service manages lineage" on public.data_lineage for all using (true) with check (true);
do $$ begin execute 'drop policy if exists "' || 'Service manages intel reports' || '" on ' || current_schema || '.'; exception when others then null; end $$;
create policy "Service manages intel reports" on public.intelligence_reports for all using (true) with check (true);

-- ═══════════════════════════════════════════════════
-- SEED: INDUSTRY PROFILES (12 verticals)
-- ═══════════════════════════════════════════════════

insert into public.industry_profiles (id, name, description, icon, color, onboarding_steps, default_categories, regulations, key_metrics, pain_points, value_props, tier, display_order) values
  ('saas', 'SaaS / Software', 'Subscription-based software companies with recurring revenue models', 'Code', '#8B5CF6',
   '[{"stepId":"connect_stripe","title":"Connect Stripe","desc":"Link your Stripe account for MRR tracking","required":true},{"stepId":"set_burn","title":"Set Burn Rate Alerts","desc":"Configure runway and burn rate thresholds","required":true},{"stepId":"map_arr","title":"Map ARR Sources","desc":"Tag recurring revenue transactions","required":false}]',
   '{subscription_revenue,infrastructure,payroll,marketing,sales,r_and_d,hosting}',
   '{sox,gdpr,soc2}',
   '{mrr,arr,burn_rate,runway_months,cac,ltv,net_revenue_retention}',
   '{Manual MRR tracking across Stripe/Chargebee/Recurly,Burn rate visibility lags 2+ weeks,Cannot forecast runway under different scenarios}',
   '{Real-time MRR/ARR from Stripe integration,Live burn rate with runway forecasting,Scenario modeling for fundraising}',
   'specialized', 1),

  ('healthcare', 'Healthcare', 'Hospitals, clinics, health systems, and healthcare service providers', 'Heart', '#EF4444',
   '[{"stepId":"hipaa_ack","title":"HIPAA Acknowledgment","desc":"Confirm HIPAA-compliant data handling","required":true},{"stepId":"connect_ehr","title":"Connect EHR/Billing","desc":"Link revenue cycle management system","required":false},{"stepId":"set_reimbursement","title":"Set Reimbursement Tracking","desc":"Track payer reimbursement cycles","required":true}]',
   '{patient_revenue,insurance_reimbursement,medical_supplies,staffing,equipment,facility,compliance}',
   '{hipaa,sox,cms}',
   '{days_cash_on_hand,ar_days,collection_rate,payer_mix,operating_margin}',
   '{Insurance reimbursement delays create cash flow gaps,Complex payer mix makes forecasting unreliable,HIPAA adds compliance overhead to every financial tool}',
   '{Payer-aware cash flow forecasting,HIPAA-compliant by design with BAA,Reimbursement cycle tracking and alerts}',
   'supported', 2),

  ('manufacturing', 'Manufacturing', 'Discrete and process manufacturing companies', 'Factory', '#FBBF24',
   '[{"stepId":"supply_chain","title":"Supply Chain Setup","desc":"Map key vendor payment cycles","required":true},{"stepId":"inventory_link","title":"Inventory Cost Tracking","desc":"Link inventory to cash flow impact","required":false}]',
   '{raw_materials,labor,equipment,logistics,utilities,maintenance,inventory}',
   '{sox,iso_9001}',
   '{inventory_turns,cash_conversion_cycle,days_payable,capex_ratio,working_capital}',
   '{Long cash conversion cycles tie up working capital,Commodity price volatility affects margins unpredictably,Global supply chain payments span multiple currencies}',
   '{Cash conversion cycle optimization,Multi-currency vendor payment tracking,Working capital forecasting with inventory impact}',
   'supported', 3),

  ('fintech', 'Fintech / Financial Services', 'Banks, fintechs, insurance, lending, and financial service companies', 'Landmark', '#22D3EE',
   '[{"stepId":"regulatory","title":"Regulatory Profile","desc":"Select applicable financial regulations","required":true},{"stepId":"treasury_structure","title":"Treasury Structure","desc":"Map entity and account hierarchy","required":true}]',
   '{fee_income,interest_income,trading,compliance,technology,customer_acquisition}',
   '{sox,pci_dss,bsa_aml,sec,state_mlt}',
   '{net_interest_margin,cost_of_funds,regulatory_capital_ratio,liquidity_coverage}',
   '{Regulatory capital requirements constrain cash allocation,Multiple entity structures complicate cash pooling,Real-time liquidity monitoring is table stakes}',
   '{Multi-entity cash pooling and sweeping,Regulatory capital ratio monitoring,Real-time liquidity coverage tracking}',
   'specialized', 4),

  ('real_estate', 'Real Estate', 'Commercial and residential property management, REITs, development', 'Building2', '#22C55E',
   '[{"stepId":"properties","title":"Property Portfolio","desc":"Map properties to separate cash positions","required":true},{"stepId":"lease_cycles","title":"Lease Revenue Cycles","desc":"Configure lease payment tracking","required":false}]',
   '{rental_income,property_tax,maintenance,insurance,mortgage,capex,management_fees}',
   '{sox,reit_compliance}',
   '{noi,cap_rate,occupancy_rate,debt_service_coverage,funds_from_operations}',
   '{Rent collection timing creates lumpy cash flow,Capital expenditure planning spans multiple fiscal years,Separate entity per property complicates consolidation}',
   '{Property-level cash position tracking,CapEx planning with multi-year forecasting,Consolidated portfolio cash view}',
   'supported', 5),

  ('ecommerce', 'E-Commerce / Retail', 'Online and physical retail, D2C brands, marketplace sellers', 'ShoppingCart', '#F97316',
   '[{"stepId":"connect_shopify","title":"Connect Store","desc":"Link Shopify, Amazon, or payment processor","required":true},{"stepId":"seasonal","title":"Seasonal Patterns","desc":"Tag historical seasonal revenue patterns","required":false}]',
   '{product_sales,shipping,returns,marketing,inventory,platform_fees,payment_processing}',
   '{pci_dss,sales_tax}',
   '{gross_margin,inventory_turnover,cac,aov,return_rate,payment_processing_cost}',
   '{Seasonal revenue spikes require advance inventory investment,Payment processor holds can freeze cash,Returns impact cash flow 30-90 days after sale}',
   '{Seasonal cash flow forecasting,Payment processor reconciliation,Inventory investment planning}',
   'supported', 6),

  ('nonprofit', 'Nonprofit / NGO', 'Charitable organizations, foundations, and social enterprises', 'Heart', '#EC4899',
   '[{"stepId":"fund_accounting","title":"Fund Accounting","desc":"Set up restricted vs unrestricted fund tracking","required":true},{"stepId":"grant_cycles","title":"Grant Cycles","desc":"Map grant disbursement schedules","required":false}]',
   '{grants,donations,program_services,fundraising,administrative,restricted_funds}',
   '{fasb_117,irs_990}',
   '{program_expense_ratio,fundraising_efficiency,months_reserves,grant_utilization}',
   '{Grant restrictions limit how cash can be deployed,Donation seasonality creates planning challenges,Board reporting requires fund-level transparency}',
   '{Restricted vs unrestricted fund tracking,Grant utilization dashboards,Donor-ready financial reporting}',
   'supported', 7),

  ('energy', 'Energy / Utilities', 'Oil & gas, renewable energy, utilities, and energy services', 'Zap', '#F59E0B',
   '[{"stepId":"regulatory","title":"Regulatory Framework","desc":"Select energy regulatory requirements","required":true},{"stepId":"commodity","title":"Commodity Exposure","desc":"Configure commodity price tracking","required":false}]',
   '{energy_sales,commodity_purchases,infrastructure,regulatory_compliance,hedging,maintenance}',
   '{ferc,nerc,esg}',
   '{ebitda_margin,reserve_replacement,production_cost,hedging_effectiveness}',
   '{Commodity price volatility makes revenue forecasting difficult,Capital-intensive projects require multi-year cash planning,Regulatory compliance costs are unpredictable}',
   '{Commodity-aware cash forecasting,Multi-year CapEx planning,Regulatory reserve tracking}',
   'coming_soon', 8),

  ('professional_services', 'Professional Services', 'Consulting firms, law firms, agencies, and accounting firms', 'Briefcase', '#6366F1',
   '[{"stepId":"project_billing","title":"Project Billing Setup","desc":"Configure time-based billing cycles","required":true}]',
   '{service_revenue,contractor_payments,travel,office,professional_development,insurance}',
   '{sox}',
   '{utilization_rate,realization_rate,ar_days,revenue_per_employee,backlog}',
   '{Long payment cycles on project-based work,Utilization fluctuations create revenue volatility,Multi-project cash allocation is complex}',
   '{Project-level cash flow tracking,AR aging with client-specific payment patterns,Utilization-based revenue forecasting}',
   'supported', 9),

  ('construction', 'Construction', 'General contractors, specialty trades, and construction management', 'HardHat', '#78716C',
   '[{"stepId":"project_setup","title":"Project Cost Centers","desc":"Map active projects as cost centers","required":true}]',
   '{contract_revenue,materials,subcontractor,equipment,labor,permits,insurance}',
   '{osha,prevailing_wage}',
   '{backlog_ratio,gross_margin_by_project,billing_absorption,retainage_outstanding}',
   '{Progress billing cycles delay revenue recognition,Retainage holds 5-10% of each payment for months,Material cost escalation erodes project margins}',
   '{Progress billing and retainage tracking,Project-level margin monitoring,Material cost escalation alerts}',
   'supported', 10),

  ('education', 'Education', 'Universities, K-12 schools, ed-tech companies, and training organizations', 'GraduationCap', '#3B82F6',
   '[{"stepId":"enrollment","title":"Enrollment Cycles","desc":"Map tuition and fee collection cycles","required":true}]',
   '{tuition,fees,grants,endowment,auxiliary_services,financial_aid,facilities}',
   '{ferpa,title_iv}',
   '{enrollment_yield,tuition_discount_rate,endowment_return,auxiliary_revenue_pct}',
   '{Enrollment uncertainty makes revenue forecasting challenging,Financial aid commitments create cash obligations,Endowment spending rules constrain liquidity}',
   '{Enrollment-driven revenue forecasting,Financial aid obligation tracking,Endowment spending policy monitoring}',
   'supported', 11),

  ('logistics', 'Logistics / Transportation', 'Freight, shipping, fleet management, and supply chain logistics', 'Truck', '#0EA5E9',
   '[{"stepId":"fleet","title":"Fleet Cost Centers","desc":"Map vehicles and routes to cost centers","required":false}]',
   '{freight_revenue,fuel,maintenance,insurance,driver_payroll,tolls,equipment_lease}',
   '{dot,fmcsa}',
   '{revenue_per_mile,fuel_cost_pct,deadhead_ratio,driver_turnover_cost}',
   '{Fuel price volatility directly impacts margins,Payment terms vary wildly across shippers and brokers,Fleet maintenance creates unpredictable cash demands}',
   '{Fuel cost hedging analysis,Shipper payment pattern tracking,Fleet maintenance reserve planning}',
   'coming_soon', 12);
