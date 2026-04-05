-- Migration 016: Comprehensive Audit Pipeline

-- ── audit_programs: audit initiatives / campaigns ──
create table if not exists public.audit_programs (
  id uuid primary key default gen_random_uuid(),
  org_id uuid not null references public.organizations(id) on delete cascade,
  name text not null,
  description text,
  program_type text not null check (program_type in (
    'internal_audit', 'external_audit', 'sox_compliance', 'security_audit',
    'financial_controls', 'operational_audit', 'it_audit', 'vendor_audit',
    'regulatory_exam', 'self_assessment', 'continuous_monitoring'
  )),
  -- Scope
  scope_areas text[] default '{}', -- 'cash_management', 'payments', 'reporting', 'access_controls', etc.
  regulatory_framework text, -- 'sox', 'gdpr', 'pci_dss', 'iso_27001', 'soc2'
  -- Schedule
  frequency text default 'annual' check (frequency in ('one_time', 'quarterly', 'semi_annual', 'annual', 'continuous')),
  period_start date,
  period_end date,
  next_audit_date date,
  -- Team
  lead_auditor uuid references public.profiles(id),
  audit_team uuid[] default '{}',
  -- Status
  status text not null default 'planning' check (status in ('planning', 'fieldwork', 'review', 'reporting', 'completed', 'archived')),
  -- Scoring
  overall_score int check (overall_score between 0 and 100),
  risk_rating text check (risk_rating in ('low', 'moderate', 'high', 'critical')),
  findings_count int default 0,
  open_findings int default 0,
  -- Metadata
  budget_hours int,
  actual_hours int default 0,
  created_by uuid references public.profiles(id),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

-- ── audit_checklists: reusable audit checklists with items ──
create table if not exists public.audit_checklists (
  id uuid primary key default gen_random_uuid(),
  org_id uuid references public.organizations(id) on delete cascade,
  program_id uuid references public.audit_programs(id) on delete set null,
  name text not null,
  description text,
  checklist_type text not null check (checklist_type in (
    'cash_controls', 'payment_authorization', 'bank_reconciliation',
    'access_management', 'data_integrity', 'segregation_of_duties',
    'financial_reporting', 'vendor_management', 'it_general_controls',
    'change_management', 'incident_response', 'business_continuity', 'custom'
  )),
  -- Items
  items jsonb not null default '[]'::jsonb, -- [{id, question, category, risk_weight, evidence_required, help_text}]
  total_items int not null default 0,
  -- Progress
  completed_items int default 0,
  passed_items int default 0,
  failed_items int default 0,
  na_items int default 0,
  completion_pct int default 0,
  pass_rate int default 0,
  -- Status
  status text not null default 'not_started' check (status in ('not_started', 'in_progress', 'completed', 'reviewed')),
  assigned_to uuid references public.profiles(id),
  started_at timestamptz,
  completed_at timestamptz,
  reviewed_by uuid references public.profiles(id),
  reviewed_at timestamptz,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

-- ── audit_checklist_responses: individual item responses ──
create table if not exists public.audit_checklist_responses (
  id uuid primary key default gen_random_uuid(),
  checklist_id uuid not null references public.audit_checklists(id) on delete cascade,
  item_id text not null, -- matches items[].id in checklist
  -- Response
  response text not null check (response in ('pass', 'fail', 'partial', 'na', 'pending')),
  score int check (score between 0 and 100),
  -- Evidence
  notes text,
  evidence_url text,
  evidence_type text check (evidence_type in ('screenshot', 'document', 'log_extract', 'policy_link', 'interview_notes', 'system_report', 'other')),
  -- Metadata
  respondent_id uuid references public.profiles(id),
  responded_at timestamptz not null default now(),
  -- Follow-up
  finding_id uuid, -- links to audit_findings if fail
  requires_follow_up boolean not null default false,
  unique(checklist_id, item_id)
);

-- ── audit_findings: issues discovered during audits ──
create table if not exists public.audit_findings (
  id uuid primary key default gen_random_uuid(),
  org_id uuid not null references public.organizations(id) on delete cascade,
  program_id uuid references public.audit_programs(id) on delete set null,
  checklist_id uuid references public.audit_checklists(id) on delete set null,
  -- Finding details
  finding_number text not null, -- 'F-2026-001'
  title text not null,
  description text not null,
  -- Classification
  finding_type text not null check (finding_type in (
    'control_deficiency', 'material_weakness', 'significant_deficiency',
    'observation', 'recommendation', 'best_practice_gap',
    'policy_violation', 'regulatory_non_compliance', 'data_integrity_issue'
  )),
  severity text not null default 'medium' check (severity in ('low', 'medium', 'high', 'critical')),
  category text check (category in ('financial', 'operational', 'compliance', 'technology', 'security', 'process')),
  -- Risk
  risk_rating text check (risk_rating in ('low', 'moderate', 'high', 'critical')),
  likelihood text check (likelihood in ('rare', 'unlikely', 'possible', 'likely', 'almost_certain')),
  impact text check (impact in ('insignificant', 'minor', 'moderate', 'major', 'catastrophic')),
  -- Root cause
  root_cause text,
  affected_controls text[] default '{}',
  affected_processes text[] default '{}',
  -- Remediation
  recommendation text,
  management_response text,
  remediation_plan text,
  remediation_owner uuid references public.profiles(id),
  remediation_due_date date,
  remediation_completed_at timestamptz,
  -- Status
  status text not null default 'open' check (status in ('draft', 'open', 'management_review', 'remediation_planned', 'in_remediation', 'verification', 'closed', 'accepted_risk')),
  -- Evidence
  evidence_urls text[] default '{}',
  -- Lifecycle
  reported_by uuid references public.profiles(id),
  reported_at timestamptz not null default now(),
  closed_by uuid references public.profiles(id),
  closed_at timestamptz,
  -- Tracking
  days_open int generated always as (
    case when closed_at is not null then extract(day from closed_at - reported_at)::int
    else extract(day from now() - reported_at)::int end
  ) stored,
  overdue boolean generated always as (
    remediation_due_date is not null and remediation_due_date < current_date and status not in ('closed', 'accepted_risk')
  ) stored,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

-- ── audit_reports: generated audit reports ──
create table if not exists public.audit_reports (
  id uuid primary key default gen_random_uuid(),
  org_id uuid not null references public.organizations(id) on delete cascade,
  program_id uuid references public.audit_programs(id),
  -- Report
  title text not null,
  report_type text not null check (report_type in (
    'audit_summary', 'detailed_findings', 'executive_brief',
    'compliance_status', 'remediation_tracker', 'trend_analysis',
    'control_effectiveness', 'risk_assessment'
  )),
  -- Content
  summary text,
  sections jsonb default '[]'::jsonb,
  -- Metrics snapshot
  metrics jsonb default '{}'::jsonb,
  -- Distribution
  distributed_to text[] default '{}',
  distribution_date timestamptz,
  -- Status
  status text not null default 'draft' check (status in ('draft', 'review', 'final', 'distributed')),
  -- Files
  report_url text,
  format text default 'pdf',
  generated_at timestamptz not null default now(),
  created_at timestamptz not null default now()
);

-- ── audit_schedules: recurring audit calendar ──
create table if not exists public.audit_schedules (
  id uuid primary key default gen_random_uuid(),
  org_id uuid not null references public.organizations(id) on delete cascade,
  title text not null,
  description text,
  audit_type text not null,
  frequency text not null default 'quarterly',
  -- Schedule
  next_date date not null,
  last_completed_date date,
  -- Assignment
  assigned_to uuid references public.profiles(id),
  checklist_template_id uuid references public.audit_checklists(id),
  -- Status
  enabled boolean not null default true,
  created_at timestamptz not null default now()
);

-- ═══════════════════════════════════════════════════
-- INDEXES
-- ═══════════════════════════════════════════════════

create index if not exists idx_audit_prog_org on public.audit_programs(org_id, status);
create index if not exists idx_audit_check_org on public.audit_checklists(org_id, status);
create index if not exists idx_audit_check_prog on public.audit_checklists(program_id);
create index if not exists idx_audit_resp_check on public.audit_checklist_responses(checklist_id);
create index if not exists idx_audit_find_org on public.audit_findings(org_id, status, severity);
create index if not exists idx_audit_find_prog on public.audit_findings(program_id);
create index if not exists idx_audit_find_open on public.audit_findings(org_id) where status not in ('closed', 'accepted_risk');
create index if not exists idx_audit_find_overdue on public.audit_findings(org_id) where overdue = true;
create index if not exists idx_audit_report_org on public.audit_reports(org_id, status);
create index if not exists idx_audit_sched_org on public.audit_schedules(org_id, next_date);

-- ═══════════════════════════════════════════════════
-- RLS
-- ═══════════════════════════════════════════════════

alter table public.audit_programs enable row level security;
alter table public.audit_checklists enable row level security;
alter table public.audit_checklist_responses enable row level security;
alter table public.audit_findings enable row level security;
alter table public.audit_reports enable row level security;
alter table public.audit_schedules enable row level security;

do $$ begin execute 'drop policy if exists "' || 'Users view org audit programs' || '" on ' || current_schema || '.'; exception when others then null; end $$;
create policy "Users view org audit programs" on public.audit_programs for select using (org_id in (select org_id from public.profiles where id = auth.uid()));
do $$ begin execute 'drop policy if exists "' || 'Users view org checklists' || '" on ' || current_schema || '.'; exception when others then null; end $$;
create policy "Users view org checklists" on public.audit_checklists for select using (org_id in (select org_id from public.profiles where id = auth.uid()));
do $$ begin execute 'drop policy if exists "' || 'Users view checklist responses' || '" on ' || current_schema || '.'; exception when others then null; end $$;
create policy "Users view checklist responses" on public.audit_checklist_responses for select using (checklist_id in (select id from public.audit_checklists where org_id in (select org_id from public.profiles where id = auth.uid())));
do $$ begin execute 'drop policy if exists "' || 'Users manage checklist responses' || '" on ' || current_schema || '.'; exception when others then null; end $$;
create policy "Users manage checklist responses" on public.audit_checklist_responses for all using (true);
do $$ begin execute 'drop policy if exists "' || 'Users view org findings' || '" on ' || current_schema || '.'; exception when others then null; end $$;
create policy "Users view org findings" on public.audit_findings for select using (org_id in (select org_id from public.profiles where id = auth.uid()));
do $$ begin execute 'drop policy if exists "' || 'Users view org audit reports' || '" on ' || current_schema || '.'; exception when others then null; end $$;
create policy "Users view org audit reports" on public.audit_reports for select using (org_id in (select org_id from public.profiles where id = auth.uid()));
do $$ begin execute 'drop policy if exists "' || 'Users view org audit schedules' || '" on ' || current_schema || '.'; exception when others then null; end $$;
create policy "Users view org audit schedules" on public.audit_schedules for select using (org_id in (select org_id from public.profiles where id = auth.uid()));

do $$ begin execute 'drop policy if exists "' || 'Service manages audit programs' || '" on ' || current_schema || '.'; exception when others then null; end $$;
create policy "Service manages audit programs" on public.audit_programs for all using (true) with check (true);
do $$ begin execute 'drop policy if exists "' || 'Service manages checklists' || '" on ' || current_schema || '.'; exception when others then null; end $$;
create policy "Service manages checklists" on public.audit_checklists for all using (true) with check (true);
do $$ begin execute 'drop policy if exists "' || 'Service manages findings' || '" on ' || current_schema || '.'; exception when others then null; end $$;
create policy "Service manages findings" on public.audit_findings for all using (true) with check (true);
do $$ begin execute 'drop policy if exists "' || 'Service manages audit reports' || '" on ' || current_schema || '.'; exception when others then null; end $$;
create policy "Service manages audit reports" on public.audit_reports for all using (true) with check (true);
do $$ begin execute 'drop policy if exists "' || 'Service manages audit schedules' || '" on ' || current_schema || '.'; exception when others then null; end $$;
create policy "Service manages audit schedules" on public.audit_schedules for all using (true) with check (true);

-- ═══════════════════════════════════════════════════
-- SEED: Default checklist templates
-- ═══════════════════════════════════════════════════

insert into public.audit_checklists (name, description, checklist_type, items, total_items, status) values
  ('Cash Controls Assessment', 'Evaluate effectiveness of cash management controls', 'cash_controls',
   '[{"id":"cc1","question":"Are bank reconciliations performed within 5 business days of month-end?","category":"reconciliation","risk_weight":8,"evidence_required":true,"help_text":"Check reconciliation completion dates vs month-end dates"},{"id":"cc2","question":"Is there segregation of duties between payment initiation and approval?","category":"authorization","risk_weight":10,"evidence_required":true,"help_text":"Verify that no single person can both create and approve payments"},{"id":"cc3","question":"Are daily cash position reports generated and reviewed?","category":"monitoring","risk_weight":7,"evidence_required":true,"help_text":"Check for daily position report generation and evidence of review"},{"id":"cc4","question":"Are idle cash balances identified and optimized within 7 days?","category":"optimization","risk_weight":5,"evidence_required":false,"help_text":"Review sweep thresholds and idle cash detection rules"},{"id":"cc5","question":"Are all bank accounts documented and authorized?","category":"governance","risk_weight":9,"evidence_required":true,"help_text":"Compare bank account inventory to authorized account list"},{"id":"cc6","question":"Is access to banking portals restricted and logged?","category":"access","risk_weight":9,"evidence_required":true,"help_text":"Review banking portal access logs and user provisioning"},{"id":"cc7","question":"Are wire transfer limits set and enforced?","category":"authorization","risk_weight":8,"evidence_required":true,"help_text":"Check wire transfer limit configuration and override logs"},{"id":"cc8","question":"Is multi-factor authentication enabled for all financial systems?","category":"access","risk_weight":10,"evidence_required":true,"help_text":"Verify MFA enrollment for banking, treasury, and payment systems"}]',
   8, 'not_started'),
  ('Payment Authorization Review', 'Assess payment approval workflows and controls', 'payment_authorization',
   '[{"id":"pa1","question":"Are payment approval thresholds documented and enforced?","category":"policy","risk_weight":9,"evidence_required":true},{"id":"pa2","question":"Do all payments >$10K require dual approval?","category":"authorization","risk_weight":10,"evidence_required":true},{"id":"pa3","question":"Are vendor bank details verified before first payment?","category":"verification","risk_weight":9,"evidence_required":true},{"id":"pa4","question":"Is there an automated check for duplicate payments?","category":"controls","risk_weight":7,"evidence_required":false},{"id":"pa5","question":"Are recurring payment schedules reviewed quarterly?","category":"monitoring","risk_weight":6,"evidence_required":true},{"id":"pa6","question":"Are rejected/returned payments investigated within 24 hours?","category":"monitoring","risk_weight":8,"evidence_required":true}]',
   6, 'not_started'),
  ('Access Management Audit', 'Review user access controls and authentication', 'access_management',
   '[{"id":"am1","question":"Are user access reviews performed at least quarterly?","category":"review","risk_weight":8,"evidence_required":true},{"id":"am2","question":"Are terminated user accounts disabled within 24 hours?","category":"deprovisioning","risk_weight":10,"evidence_required":true},{"id":"am3","question":"Is the principle of least privilege enforced?","category":"authorization","risk_weight":9,"evidence_required":true},{"id":"am4","question":"Are admin accounts limited and monitored?","category":"privileged_access","risk_weight":10,"evidence_required":true},{"id":"am5","question":"Are password policies compliant with organizational standards?","category":"authentication","risk_weight":7,"evidence_required":true}]',
   5, 'not_started');
