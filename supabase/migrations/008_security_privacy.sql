-- Migration 008: Corporate Digital Security + Digital Privacy pipelines

-- ═══════════════════════════════════════════════════
-- 1. CORPORATE DIGITAL SECURITY
-- ═══════════════════════════════════════════════════

-- ── security_events: real-time threat/anomaly tracking ──
create table if not exists public.security_events (
  id uuid primary key default gen_random_uuid(),
  org_id uuid not null references public.organizations(id) on delete cascade,
  user_id uuid references public.profiles(id),
  event_type text not null check (event_type in (
    'login_success', 'login_failed', 'login_anomaly', 'mfa_challenge', 'mfa_failure',
    'password_changed', 'password_reset', 'session_expired', 'session_revoked',
    'role_escalation', 'permission_change', 'api_key_created', 'api_key_revoked',
    'data_export', 'bulk_data_access', 'ip_blocked', 'rate_limited',
    'suspicious_activity', 'brute_force_detected', 'impossible_travel',
    'new_device', 'new_location', 'after_hours_access'
  )),
  severity text not null default 'info' check (severity in ('critical', 'high', 'medium', 'low', 'info')),
  description text,
  ip_address text,
  user_agent text,
  geo_location jsonb default '{}'::jsonb, -- { country, region, city, lat, lng }
  device_fingerprint text,
  metadata jsonb default '{}'::jsonb,
  resolved boolean not null default false,
  resolved_by uuid references public.profiles(id),
  resolved_at timestamptz,
  created_at timestamptz not null default now()
);

-- ── ip_allowlist: org-level IP restrictions ──
create table if not exists public.ip_allowlist (
  id uuid primary key default gen_random_uuid(),
  org_id uuid not null references public.organizations(id) on delete cascade,
  cidr text not null, -- e.g. '10.0.0.0/24' or '192.168.1.1/32'
  label text, -- e.g. 'Office VPN', 'Home'
  created_by uuid references public.profiles(id),
  enabled boolean not null default true,
  created_at timestamptz not null default now()
);

-- ── active_sessions: track all active user sessions ──
create table if not exists public.active_sessions (
  id uuid primary key default gen_random_uuid(),
  org_id uuid not null references public.organizations(id) on delete cascade,
  user_id uuid not null references public.profiles(id),
  session_token_hash text not null, -- hashed session identifier
  ip_address text,
  user_agent text,
  device_type text check (device_type in ('desktop', 'mobile', 'tablet', 'api', 'unknown')),
  geo_location jsonb default '{}'::jsonb,
  last_active_at timestamptz not null default now(),
  expires_at timestamptz not null default (now() + interval '24 hours'),
  revoked boolean not null default false,
  created_at timestamptz not null default now()
);

-- ── security_policies: org-level security configuration ──
create table if not exists public.security_policies (
  id uuid primary key default gen_random_uuid(),
  org_id uuid not null references public.organizations(id) on delete cascade,
  -- Authentication
  mfa_required boolean not null default false,
  mfa_methods text[] default '{totp,sms}'::text[],
  password_min_length int not null default 12,
  password_require_uppercase boolean not null default true,
  password_require_number boolean not null default true,
  password_require_special boolean not null default true,
  password_expiry_days int default null, -- null = no expiry
  max_failed_logins int not null default 5,
  lockout_duration_minutes int not null default 30,
  -- Session
  session_timeout_minutes int not null default 480, -- 8 hours
  concurrent_sessions_max int not null default 5,
  -- Access
  ip_allowlist_enabled boolean not null default false,
  after_hours_alerts boolean not null default false,
  business_hours_start time default '08:00',
  business_hours_end time default '18:00',
  business_timezone text default 'America/New_York',
  -- Data
  export_approval_required boolean not null default false,
  api_access_enabled boolean not null default true,
  data_classification_enabled boolean not null default false,
  -- Compliance
  audit_retention_days int not null default 365,
  security_review_interval_days int not null default 90,
  last_security_review timestamptz,
  next_security_review timestamptz,
  updated_at timestamptz not null default now(),
  unique(org_id)
);

-- ── vulnerability_scans: track security assessments ──
create table if not exists public.vulnerability_scans (
  id uuid primary key default gen_random_uuid(),
  scan_type text not null check (scan_type in ('dependency', 'configuration', 'access_review', 'penetration', 'compliance')),
  status text not null default 'pending' check (status in ('pending', 'running', 'completed', 'failed')),
  findings_critical int not null default 0,
  findings_high int not null default 0,
  findings_medium int not null default 0,
  findings_low int not null default 0,
  findings_info int not null default 0,
  details jsonb default '[]'::jsonb,
  remediation_notes text,
  scanned_by text,
  started_at timestamptz,
  completed_at timestamptz,
  created_at timestamptz not null default now()
);

-- ── security_score: rolling security posture score ──
create table if not exists public.security_score (
  id uuid primary key default gen_random_uuid(),
  org_id uuid not null references public.organizations(id) on delete cascade,
  overall_score int not null check (overall_score between 0 and 100),
  auth_score int not null default 0,
  access_score int not null default 0,
  data_score int not null default 0,
  compliance_score int not null default 0,
  network_score int not null default 0,
  breakdown jsonb default '{}'::jsonb,
  recommendations jsonb default '[]'::jsonb,
  calculated_at timestamptz not null default now()
);

-- ═══════════════════════════════════════════════════
-- 2. CORPORATE DIGITAL PRIVACY
-- ═══════════════════════════════════════════════════

-- ── consent_records: tracks user consent for data processing ──
create table if not exists public.consent_records (
  id uuid primary key default gen_random_uuid(),
  org_id uuid not null references public.organizations(id) on delete cascade,
  user_id uuid references public.profiles(id),
  email text,
  consent_type text not null check (consent_type in (
    'terms_of_service', 'privacy_policy', 'marketing_email', 'analytics_tracking',
    'third_party_sharing', 'data_processing', 'cookie_essential', 'cookie_analytics',
    'cookie_marketing', 'financial_data_sync', 'ai_processing'
  )),
  granted boolean not null,
  version text not null default '1.0', -- policy version consented to
  ip_address text,
  user_agent text,
  granted_at timestamptz,
  revoked_at timestamptz,
  expires_at timestamptz,
  created_at timestamptz not null default now()
);

-- ── data_subject_requests (DSR): GDPR/CCPA rights workflow ──
create table if not exists public.data_subject_requests (
  id uuid primary key default gen_random_uuid(),
  org_id uuid references public.organizations(id) on delete set null,
  requester_email text not null,
  requester_name text,
  request_type text not null check (request_type in (
    'access', 'rectification', 'erasure', 'portability',
    'restrict_processing', 'object_processing', 'withdraw_consent'
  )),
  regulation text not null default 'gdpr' check (regulation in ('gdpr', 'ccpa', 'pipeda', 'lgpd', 'other')),
  status text not null default 'received' check (status in (
    'received', 'verified', 'in_progress', 'completed', 'denied', 'extended'
  )),
  priority text not null default 'normal' check (priority in ('urgent', 'normal')),
  -- Processing
  verified_at timestamptz,
  verification_method text,
  assigned_to text,
  -- Data scope
  data_categories text[] default '{}', -- e.g. {'financial', 'profile', 'usage', 'communications'}
  systems_affected text[] default '{}', -- e.g. {'supabase', 'stripe', 'plaid', 'resend'}
  -- Fulfillment
  export_url text, -- for access/portability: signed URL to data export
  export_expires_at timestamptz,
  deletion_confirmed boolean default false,
  -- Timeline
  due_date date not null default (current_date + 30), -- GDPR 30-day deadline
  extended_to date,
  extension_reason text,
  completed_at timestamptz,
  -- Audit
  notes text,
  audit_trail jsonb default '[]'::jsonb,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

-- ── data_processing_records: Article 30 GDPR register ──
create table if not exists public.data_processing_records (
  id uuid primary key default gen_random_uuid(),
  activity_name text not null,
  purpose text not null,
  legal_basis text not null check (legal_basis in (
    'consent', 'contract', 'legal_obligation', 'vital_interests',
    'public_interest', 'legitimate_interests'
  )),
  data_categories text[] not null default '{}',
  data_subjects text[] not null default '{}', -- e.g. {'customers', 'employees', 'leads'}
  recipients text[] default '{}', -- third parties who receive this data
  third_country_transfers text[] default '{}', -- countries outside EU
  transfer_safeguards text, -- e.g. 'Standard Contractual Clauses'
  retention_period text not null, -- e.g. '3 years after account closure'
  retention_days int,
  security_measures text[] default '{}',
  automated_decision_making boolean not null default false,
  dpia_required boolean not null default false,
  dpia_completed boolean not null default false,
  last_reviewed timestamptz,
  status text not null default 'active' check (status in ('active', 'archived', 'under_review')),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

-- ── privacy_impact_assessments: DPIA records ──
create table if not exists public.privacy_impact_assessments (
  id uuid primary key default gen_random_uuid(),
  processing_record_id uuid references public.data_processing_records(id),
  title text not null,
  description text,
  risk_level text not null check (risk_level in ('low', 'medium', 'high', 'critical')),
  risks_identified jsonb default '[]'::jsonb,
  mitigations jsonb default '[]'::jsonb,
  residual_risk text check (residual_risk in ('low', 'medium', 'high', 'critical')),
  dpo_opinion text,
  approved_by text,
  approved_at timestamptz,
  status text not null default 'draft' check (status in ('draft', 'in_review', 'approved', 'rejected')),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

-- ── data_retention_policies: automated retention + purge rules ──
create table if not exists public.data_retention_policies (
  id uuid primary key default gen_random_uuid(),
  data_type text not null, -- e.g. 'transactions', 'copilot_messages', 'audit_log', 'leads'
  table_name text not null,
  retention_days int not null,
  action text not null default 'delete' check (action in ('delete', 'anonymize', 'archive')),
  filter_column text not null default 'created_at',
  enabled boolean not null default true,
  last_executed timestamptz,
  records_processed int default 0,
  created_at timestamptz not null default now()
);

-- ═══════════════════════════════════════════════════
-- INDEXES
-- ═══════════════════════════════════════════════════

-- Security
create index if not exists idx_sec_events_org on public.security_events(org_id, created_at desc);
create index if not exists idx_sec_events_type on public.security_events(event_type, severity, created_at desc);
create index if not exists idx_sec_events_user on public.security_events(user_id, created_at desc);
create index if not exists idx_sec_events_ip on public.security_events(ip_address, created_at desc);
create index if not exists idx_sec_events_unresolved on public.security_events(org_id, severity) where resolved = false;
create index if not exists idx_ip_allowlist_org on public.ip_allowlist(org_id) where enabled = true;
create index if not exists idx_sessions_user on public.active_sessions(user_id, last_active_at desc) where revoked = false;
create index if not exists idx_sessions_org on public.active_sessions(org_id, last_active_at desc) where revoked = false;
create index if not exists idx_sec_policies_org on public.security_policies(org_id);
create index if not exists idx_vuln_scans_type on public.vulnerability_scans(scan_type, created_at desc);
create index if not exists idx_sec_score_org on public.security_score(org_id, calculated_at desc);

-- Privacy
create index if not exists idx_consent_org on public.consent_records(org_id, consent_type);
create index if not exists idx_consent_user on public.consent_records(user_id, consent_type);
create index if not exists idx_consent_email on public.consent_records(email, consent_type);
create index if not exists idx_dsr_status on public.data_subject_requests(status, due_date);
create index if not exists idx_dsr_email on public.data_subject_requests(requester_email);
create index if not exists idx_dpr_status on public.data_processing_records(status);
create index if not exists idx_dpia_status on public.privacy_impact_assessments(status);
create index if not exists idx_retention_enabled on public.data_retention_policies(enabled, table_name);

-- ═══════════════════════════════════════════════════
-- RLS
-- ═══════════════════════════════════════════════════

alter table public.security_events enable row level security;
alter table public.ip_allowlist enable row level security;
alter table public.active_sessions enable row level security;
alter table public.security_policies enable row level security;
alter table public.vulnerability_scans enable row level security;
alter table public.security_score enable row level security;
alter table public.consent_records enable row level security;
alter table public.data_subject_requests enable row level security;
alter table public.data_processing_records enable row level security;
alter table public.privacy_impact_assessments enable row level security;
alter table public.data_retention_policies enable row level security;

-- Security: org-scoped for admins
do $$ begin execute 'drop policy if exists "' || 'Admins view security events' || '" on ' || current_schema || '.'; exception when others then null; end $$;
create policy "Admins view security events" on public.security_events for select using (org_id in (select org_id from public.profiles where id = auth.uid() and role in ('owner', 'admin')));
do $$ begin execute 'drop policy if exists "' || 'Admins view IP allowlist' || '" on ' || current_schema || '.'; exception when others then null; end $$;
create policy "Admins view IP allowlist" on public.ip_allowlist for select using (org_id in (select org_id from public.profiles where id = auth.uid() and role in ('owner', 'admin')));
do $$ begin execute 'drop policy if exists "' || 'Admins manage IP allowlist' || '" on ' || current_schema || '.'; exception when others then null; end $$;
create policy "Admins manage IP allowlist" on public.ip_allowlist for all using (org_id in (select org_id from public.profiles where id = auth.uid() and role in ('owner', 'admin')));
do $$ begin execute 'drop policy if exists "' || 'Users view own sessions' || '" on ' || current_schema || '.'; exception when others then null; end $$;
create policy "Users view own sessions" on public.active_sessions for select using (user_id = auth.uid());
do $$ begin execute 'drop policy if exists "' || 'Admins view org sessions' || '" on ' || current_schema || '.'; exception when others then null; end $$;
create policy "Admins view org sessions" on public.active_sessions for select using (org_id in (select org_id from public.profiles where id = auth.uid() and role in ('owner', 'admin')));
do $$ begin execute 'drop policy if exists "' || 'Admins view security policies' || '" on ' || current_schema || '.'; exception when others then null; end $$;
create policy "Admins view security policies" on public.security_policies for select using (org_id in (select org_id from public.profiles where id = auth.uid() and role in ('owner', 'admin')));
do $$ begin execute 'drop policy if exists "' || 'Owners manage security policies' || '" on ' || current_schema || '.'; exception when others then null; end $$;
create policy "Owners manage security policies" on public.security_policies for all using (org_id in (select org_id from public.profiles where id = auth.uid() and role = 'owner'));
do $$ begin execute 'drop policy if exists "' || 'Admins view security score' || '" on ' || current_schema || '.'; exception when others then null; end $$;
create policy "Admins view security score" on public.security_score for select using (org_id in (select org_id from public.profiles where id = auth.uid() and role in ('owner', 'admin')));

-- Privacy: admin-scoped + service role
do $$ begin execute 'drop policy if exists "' || 'Admins view consent' || '" on ' || current_schema || '.'; exception when others then null; end $$;
create policy "Admins view consent" on public.consent_records for select using (org_id in (select org_id from public.profiles where id = auth.uid() and role in ('owner', 'admin')));
do $$ begin execute 'drop policy if exists "' || 'Admins view DSR' || '" on ' || current_schema || '.'; exception when others then null; end $$;
create policy "Admins view DSR" on public.data_subject_requests for select using (org_id in (select org_id from public.profiles where id = auth.uid() and role in ('owner', 'admin')));
do $$ begin execute 'drop policy if exists "' || 'Anyone reads processing records' || '" on ' || current_schema || '.'; exception when others then null; end $$;
create policy "Anyone reads processing records" on public.data_processing_records for select using (status = 'active');
do $$ begin execute 'drop policy if exists "' || 'Admins view DPIA' || '" on ' || current_schema || '.'; exception when others then null; end $$;
create policy "Admins view DPIA" on public.privacy_impact_assessments for select using (true);
do $$ begin execute 'drop policy if exists "' || 'Admins view retention policies' || '" on ' || current_schema || '.'; exception when others then null; end $$;
create policy "Admins view retention policies" on public.data_retention_policies for select using (true);

-- Service role for all writes
do $$ begin execute 'drop policy if exists "' || 'Service manages security events' || '" on ' || current_schema || '.'; exception when others then null; end $$;
create policy "Service manages security events" on public.security_events for all using (true) with check (true);
do $$ begin execute 'drop policy if exists "' || 'Service manages sessions' || '" on ' || current_schema || '.'; exception when others then null; end $$;
create policy "Service manages sessions" on public.active_sessions for all using (true) with check (true);
do $$ begin execute 'drop policy if exists "' || 'Service manages security score' || '" on ' || current_schema || '.'; exception when others then null; end $$;
create policy "Service manages security score" on public.security_score for all using (true) with check (true);
do $$ begin execute 'drop policy if exists "' || 'Service manages vuln scans' || '" on ' || current_schema || '.'; exception when others then null; end $$;
create policy "Service manages vuln scans" on public.vulnerability_scans for all using (true) with check (true);
do $$ begin execute 'drop policy if exists "' || 'Service manages consent' || '" on ' || current_schema || '.'; exception when others then null; end $$;
create policy "Service manages consent" on public.consent_records for all using (true) with check (true);
do $$ begin execute 'drop policy if exists "' || 'Service manages DSR' || '" on ' || current_schema || '.'; exception when others then null; end $$;
create policy "Service manages DSR" on public.data_subject_requests for all using (true) with check (true);
do $$ begin execute 'drop policy if exists "' || 'Service manages DPR' || '" on ' || current_schema || '.'; exception when others then null; end $$;
create policy "Service manages DPR" on public.data_processing_records for all using (true) with check (true);
do $$ begin execute 'drop policy if exists "' || 'Service manages DPIA' || '" on ' || current_schema || '.'; exception when others then null; end $$;
create policy "Service manages DPIA" on public.privacy_impact_assessments for all using (true) with check (true);
do $$ begin execute 'drop policy if exists "' || 'Service manages retention' || '" on ' || current_schema || '.'; exception when others then null; end $$;
create policy "Service manages retention" on public.data_retention_policies for all using (true) with check (true);
do $$ begin execute 'drop policy if exists "' || 'Service manages security policies' || '" on ' || current_schema || '.'; exception when others then null; end $$;
create policy "Service manages security policies" on public.security_policies for all using (true) with check (true);

-- ═══════════════════════════════════════════════════
-- SEED: Default security policies on org creation
-- ═══════════════════════════════════════════════════
create or replace function public.handle_new_org_security()
returns trigger language plpgsql security definer as $$
begin
  insert into public.security_policies (org_id) values (new.id);
  return new;
end;
$$;

create trigger on_org_created_security
  after insert on public.organizations
  for each row execute function public.handle_new_org_security();

-- Seed default data processing records (Article 30 register)
insert into public.data_processing_records (activity_name, purpose, legal_basis, data_categories, data_subjects, recipients, retention_period, retention_days, security_measures, status) values
  ('User Account Management', 'Provide and maintain user accounts', 'contract', '{profile,email,authentication}', '{customers}', '{supabase}', '3 years after account closure', 1095, '{encryption_at_rest,encryption_in_transit,access_controls,audit_logging}', 'active'),
  ('Financial Data Processing', 'Aggregate and analyze financial transactions', 'contract', '{financial,transactions,balances,accounts}', '{customers}', '{plaid,supabase}', 'Duration of account + 7 years', 2555, '{encryption_at_rest,encryption_in_transit,access_controls,bank_grade_security}', 'active'),
  ('AI Cash Forecasting', 'Generate cash flow forecasts using machine learning', 'legitimate_interests', '{financial,transactions,balances}', '{customers}', '{anthropic}', 'Duration of account', null, '{data_minimization,no_model_training,ephemeral_processing}', 'active'),
  ('Payment Processing', 'Process subscription payments', 'contract', '{payment_method,billing_address,email}', '{customers}', '{stripe}', '7 years per financial regulations', 2555, '{pci_dss_compliance,tokenization}', 'active'),
  ('Email Communications', 'Send transactional and notification emails', 'contract', '{email,name}', '{customers}', '{resend}', '90 days after delivery', 90, '{tls_encryption,domain_verification}', 'active'),
  ('Marketing Lead Capture', 'Capture and score leads from marketing tools', 'consent', '{email,company,role,assessment_data}', '{leads}', '{supabase}', '2 years after last activity', 730, '{encryption_at_rest,access_controls}', 'active'),
  ('Analytics & Usage Tracking', 'Monitor product usage for improvement', 'legitimate_interests', '{usage_events,feature_engagement,session_data}', '{customers}', '{supabase}', '1 year', 365, '{pseudonymization,aggregation,access_controls}', 'active');

-- Seed default retention policies
insert into public.data_retention_policies (data_type, table_name, retention_days, action, filter_column, enabled) values
  ('Audit log entries', 'audit_log', 365, 'archive', 'created_at', true),
  ('Copilot messages', 'copilot_messages', 180, 'delete', 'created_at', true),
  ('Security events', 'security_events', 365, 'archive', 'created_at', true),
  ('Active sessions (expired)', 'active_sessions', 30, 'delete', 'expires_at', true),
  ('Notification history', 'notifications', 90, 'delete', 'created_at', true),
  ('Support tickets (closed)', 'support_tickets', 730, 'archive', 'updated_at', true),
  ('Resource views', 'resource_views', 180, 'delete', 'created_at', true),
  ('Partner webhook logs', 'partner_webhooks_log', 90, 'delete', 'created_at', true),
  ('Error events', 'error_events', 90, 'delete', 'created_at', true);
