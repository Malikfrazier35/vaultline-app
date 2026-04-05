-- Migration 011: Digital Legal Pipeline
-- Inspired by Netflix DNSSPI: consumer-facing privacy rights, cookie preferences,
-- GPC signal handling, versioned legal documents, regulatory compliance tracking

-- ═══════════════════════════════════════════════════
-- 1. LEGAL DOCUMENTS (versioned, auditable)
-- ═══════════════════════════════════════════════════

-- ── legal_documents: versioned legal text (ToS, Privacy, DPA, Cookie Policy, etc.) ──
create table if not exists public.legal_documents (
  id uuid primary key default gen_random_uuid(),
  slug text not null, -- 'terms', 'privacy', 'cookie-policy', 'dpa', 'sla', 'aup', 'dnsspi', 'subprocessors'
  title text not null,
  version text not null, -- '1.0', '2.1', etc.
  effective_date date not null,
  body_html text not null, -- rendered HTML
  body_markdown text, -- source markdown
  summary_of_changes text, -- what changed from prior version
  -- Metadata
  jurisdiction text[] default '{global}'::text[], -- 'global', 'us', 'eu', 'ca', 'uk'
  regulation text[] default '{}'::text[], -- 'gdpr', 'ccpa', 'pipeda', 'lgpd'
  -- Lifecycle
  status text not null default 'draft' check (status in ('draft', 'published', 'superseded', 'archived')),
  published_at timestamptz,
  superseded_at timestamptz,
  superseded_by uuid references public.legal_documents(id),
  created_by text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique(slug, version)
);

-- ── legal_acceptances: tracks who accepted which document version ──
create table if not exists public.legal_acceptances (
  id uuid primary key default gen_random_uuid(),
  document_id uuid not null references public.legal_documents(id),
  user_id uuid references public.profiles(id),
  org_id uuid references public.organizations(id),
  email text,
  -- Acceptance context
  accepted_at timestamptz not null default now(),
  ip_address text,
  user_agent text,
  method text not null default 'click' check (method in ('click', 'checkbox', 'signature', 'api', 'implicit')),
  -- Withdrawal
  withdrawn_at timestamptz,
  withdrawal_reason text,
  created_at timestamptz not null default now()
);

-- ═══════════════════════════════════════════════════
-- 2. COOKIE CONSENT (granular, per-user, GDPR-compliant)
-- ═══════════════════════════════════════════════════

-- ── cookie_preferences: per-visitor cookie consent state ──
create table if not exists public.cookie_preferences (
  id uuid primary key default gen_random_uuid(),
  visitor_id text not null, -- anonymous fingerprint or user_id
  user_id uuid references public.profiles(id),
  -- Category consent (mirrors Netflix model)
  essential boolean not null default true, -- always on, cannot opt out
  functional boolean not null default true, -- remembers preferences
  analytics boolean not null default false,
  advertising boolean not null default false,
  social_media boolean not null default false,
  -- GPC / Do Not Track
  gpc_detected boolean not null default false,
  dnt_detected boolean not null default false,
  gpc_honored boolean not null default false,
  -- Context
  ip_address text,
  user_agent text,
  geo_country text,
  geo_region text,
  -- Lifecycle
  consented_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  expires_at timestamptz default (now() + interval '365 days')
);

-- ═══════════════════════════════════════════════════
-- 3. PRIVACY RIGHTS PORTAL (CCPA/GDPR self-service)
-- ═══════════════════════════════════════════════════

-- ── privacy_rights_requests: consumer-facing self-service DSR ──
create table if not exists public.privacy_rights_requests (
  id uuid primary key default gen_random_uuid(),
  -- Requester (may not be a user)
  requester_email text not null,
  requester_name text,
  requester_phone text,
  requester_relationship text default 'self' check (requester_relationship in ('self', 'authorized_agent', 'parent_guardian')),
  -- Verification
  verified boolean not null default false,
  verification_method text check (verification_method in ('email_link', 'identity_document', 'account_login', 'phone', 'notarized')),
  verification_token text,
  verified_at timestamptz,
  -- Request details
  request_type text not null check (request_type in (
    'do_not_sell', 'do_not_share', 'opt_out_targeted_ads',
    'access', 'delete', 'correct', 'portability',
    'restrict_processing', 'object_processing', 'withdraw_consent',
    'opt_out_profiling', 'limit_sensitive_data'
  )),
  regulation text not null default 'ccpa' check (regulation in ('ccpa', 'gdpr', 'cpra', 'vcdpa', 'cpa', 'ctdpa', 'pipeda', 'lgpd', 'other')),
  jurisdiction text, -- 'california', 'virginia', 'colorado', 'connecticut', 'eu', etc.
  -- Scope
  data_categories text[] default '{}', -- 'financial', 'profile', 'usage', 'cookies', 'communications'
  specific_data text, -- free text for specific requests
  -- Processing
  status text not null default 'pending' check (status in ('pending', 'verification_sent', 'verified', 'processing', 'fulfilled', 'denied', 'appealed')),
  assigned_to text,
  -- Fulfillment
  response_method text default 'email' check (response_method in ('email', 'mail', 'portal', 'api')),
  response_sent_at timestamptz,
  export_url text,
  export_expires_at timestamptz,
  deletion_scope text, -- 'all', 'specific_categories', 'specific_data'
  deletion_confirmed_at timestamptz,
  -- Timeline (CCPA: 45 days, GDPR: 30 days)
  due_date date not null,
  extended_to date,
  extension_reason text,
  fulfilled_at timestamptz,
  denial_reason text,
  -- Appeal
  appeal_filed_at timestamptz,
  appeal_status text check (appeal_status in ('pending', 'granted', 'denied')),
  appeal_response text,
  -- Audit
  audit_trail jsonb default '[]'::jsonb,
  internal_notes text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

-- ═══════════════════════════════════════════════════
-- 4. DO NOT SELL / SHARE (CCPA/CPRA specific)
-- ═══════════════════════════════════════════════════

-- ── dnsspi_optouts: Do Not Sell or Share Personal Information registry ──
create table if not exists public.dnsspi_optouts (
  id uuid primary key default gen_random_uuid(),
  user_id uuid references public.profiles(id),
  email text,
  -- Opt-out scope (mirrors Netflix model)
  opt_out_sale boolean not null default true,
  opt_out_sharing boolean not null default true,
  opt_out_targeted_ads boolean not null default true,
  opt_out_profiling boolean not null default false,
  opt_out_matched_identifiers boolean not null default true,
  -- Method
  method text not null check (method in ('web_form', 'email', 'gpc_signal', 'authorized_agent', 'api', 'universal_opt_out')),
  -- Context
  ip_address text,
  user_agent text,
  gpc_signal boolean default false,
  jurisdiction text, -- 'california', 'virginia', etc.
  -- Lifecycle
  opted_out_at timestamptz not null default now(),
  revoked_at timestamptz, -- if user later opts back in
  created_at timestamptz not null default now()
);

-- ═══════════════════════════════════════════════════
-- 5. SUBPROCESSOR REGISTRY (GDPR Article 28)
-- ═══════════════════════════════════════════════════

-- ── subprocessors: third-party data processors ──
create table if not exists public.subprocessors (
  id uuid primary key default gen_random_uuid(),
  name text not null,
  purpose text not null,
  data_categories text[] not null default '{}',
  location text not null, -- 'United States', 'EU', etc.
  transfer_mechanism text, -- 'SCCs', 'Adequacy Decision', 'BCRs', 'DPF'
  dpa_signed boolean not null default false,
  dpa_url text,
  privacy_url text,
  security_certifications text[] default '{}', -- 'SOC 2', 'ISO 27001', 'PCI DSS'
  status text not null default 'active' check (status in ('active', 'pending', 'removed')),
  added_date date not null default current_date,
  removed_date date,
  notification_sent boolean not null default false, -- GDPR requires notifying customers of changes
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

-- ═══════════════════════════════════════════════════
-- 6. COMPLIANCE TRACKING
-- ═══════════════════════════════════════════════════

-- ── regulatory_compliance: tracks compliance status per regulation ──
create table if not exists public.regulatory_compliance (
  id uuid primary key default gen_random_uuid(),
  regulation text not null check (regulation in ('gdpr', 'ccpa', 'cpra', 'vcdpa', 'cpa', 'ctdpa', 'pipeda', 'lgpd', 'sox', 'pci_dss', 'soc2')),
  requirement_id text not null, -- e.g. 'gdpr_art_13', 'ccpa_1798.100', 'soc2_cc6.1'
  requirement_name text not null,
  description text,
  category text check (category in ('notice', 'consent', 'access', 'deletion', 'portability', 'security', 'breach', 'dpo', 'dpia', 'records', 'training', 'vendor')),
  status text not null default 'not_started' check (status in ('not_started', 'in_progress', 'compliant', 'non_compliant', 'not_applicable', 'needs_review')),
  evidence_url text,
  notes text,
  owner text,
  last_reviewed timestamptz,
  next_review_due date,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique(regulation, requirement_id)
);

-- ═══════════════════════════════════════════════════
-- INDEXES
-- ═══════════════════════════════════════════════════

create index if not exists idx_legal_docs_slug on public.legal_documents(slug, status);
create index if not exists idx_legal_docs_active on public.legal_documents(slug) where status = 'published';
create index if not exists idx_legal_accept_user on public.legal_acceptances(user_id, document_id);
create index if not exists idx_legal_accept_doc on public.legal_acceptances(document_id, accepted_at desc);
create index if not exists idx_cookie_visitor on public.cookie_preferences(visitor_id);
create index if not exists idx_cookie_user on public.cookie_preferences(user_id) where user_id is not null;
create index if not exists idx_privacy_rights_status on public.privacy_rights_requests(status, due_date);
create index if not exists idx_privacy_rights_email on public.privacy_rights_requests(requester_email);
create index if not exists idx_dnsspi_user on public.dnsspi_optouts(user_id) where revoked_at is null;
create index if not exists idx_dnsspi_email on public.dnsspi_optouts(email) where revoked_at is null;
create index if not exists idx_subprocessors_active on public.subprocessors(status) where status = 'active';
create index if not exists idx_compliance_reg on public.regulatory_compliance(regulation, status);

-- ═══════════════════════════════════════════════════
-- RLS
-- ═══════════════════════════════════════════════════

alter table public.legal_documents enable row level security;
alter table public.legal_acceptances enable row level security;
alter table public.cookie_preferences enable row level security;
alter table public.privacy_rights_requests enable row level security;
alter table public.dnsspi_optouts enable row level security;
alter table public.subprocessors enable row level security;
alter table public.regulatory_compliance enable row level security;

-- Public read for published legal docs and subprocessors
do $$ begin execute 'drop policy if exists "' || 'Anyone reads published legal docs' || '" on ' || current_schema || '.'; exception when others then null; end $$;
create policy "Anyone reads published legal docs" on public.legal_documents for select using (status = 'published');
do $$ begin execute 'drop policy if exists "' || 'Anyone reads active subprocessors' || '" on ' || current_schema || '.'; exception when others then null; end $$;
create policy "Anyone reads active subprocessors" on public.subprocessors for select using (status = 'active');

-- Users manage own data
do $$ begin execute 'drop policy if exists "' || 'Users view own acceptances' || '" on ' || current_schema || '.'; exception when others then null; end $$;
create policy "Users view own acceptances" on public.legal_acceptances for select using (user_id = auth.uid());
do $$ begin execute 'drop policy if exists "' || 'Users manage own cookie prefs' || '" on ' || current_schema || '.'; exception when others then null; end $$;
create policy "Users manage own cookie prefs" on public.cookie_preferences for all using (user_id = auth.uid());
do $$ begin execute 'drop policy if exists "' || 'Users view own DNSSPI' || '" on ' || current_schema || '.'; exception when others then null; end $$;
create policy "Users view own DNSSPI" on public.dnsspi_optouts for select using (user_id = auth.uid());

-- Service role for all writes
do $$ begin execute 'drop policy if exists "' || 'Service manages legal docs' || '" on ' || current_schema || '.'; exception when others then null; end $$;
create policy "Service manages legal docs" on public.legal_documents for all using (true) with check (true);
do $$ begin execute 'drop policy if exists "' || 'Service manages acceptances' || '" on ' || current_schema || '.'; exception when others then null; end $$;
create policy "Service manages acceptances" on public.legal_acceptances for all using (true) with check (true);
do $$ begin execute 'drop policy if exists "' || 'Service manages cookie prefs' || '" on ' || current_schema || '.'; exception when others then null; end $$;
create policy "Service manages cookie prefs" on public.cookie_preferences for all using (true) with check (true);
do $$ begin execute 'drop policy if exists "' || 'Service manages privacy rights' || '" on ' || current_schema || '.'; exception when others then null; end $$;
create policy "Service manages privacy rights" on public.privacy_rights_requests for all using (true) with check (true);
do $$ begin execute 'drop policy if exists "' || 'Service manages DNSSPI' || '" on ' || current_schema || '.'; exception when others then null; end $$;
create policy "Service manages DNSSPI" on public.dnsspi_optouts for all using (true) with check (true);
do $$ begin execute 'drop policy if exists "' || 'Service manages subprocessors' || '" on ' || current_schema || '.'; exception when others then null; end $$;
create policy "Service manages subprocessors" on public.subprocessors for all using (true) with check (true);
do $$ begin execute 'drop policy if exists "' || 'Service manages compliance' || '" on ' || current_schema || '.'; exception when others then null; end $$;
create policy "Service manages compliance" on public.regulatory_compliance for all using (true) with check (true);
do $$ begin execute 'drop policy if exists "' || 'Admins read compliance' || '" on ' || current_schema || '.'; exception when others then null; end $$;
create policy "Admins read compliance" on public.regulatory_compliance for select using (true);

-- ═══════════════════════════════════════════════════
-- SEED DATA
-- ═══════════════════════════════════════════════════

-- Seed subprocessors
insert into public.subprocessors (name, purpose, data_categories, location, transfer_mechanism, dpa_signed, security_certifications, status) values
  ('Supabase Inc.', 'Database hosting, authentication, real-time subscriptions', '{profile,financial,usage,authentication}', 'United States', 'DPF', true, '{SOC 2 Type II,ISO 27001}', 'active'),
  ('Plaid Inc.', 'Bank account linking and transaction data aggregation', '{financial,authentication}', 'United States', 'SCCs', true, '{SOC 2 Type II,ISO 27001}', 'active'),
  ('Stripe Inc.', 'Payment processing and subscription management', '{payment,billing}', 'United States', 'DPF', true, '{PCI DSS Level 1,SOC 2 Type II}', 'active'),
  ('Anthropic PBC', 'AI-powered treasury copilot (ephemeral processing, no model training)', '{financial,usage}', 'United States', 'DPF', true, '{SOC 2 Type II}', 'active'),
  ('Vercel Inc.', 'Frontend hosting, CDN, edge network', '{usage,ip_address}', 'United States', 'DPF', true, '{SOC 2 Type II,ISO 27001}', 'active'),
  ('Resend Inc.', 'Transactional and notification email delivery', '{email,name}', 'United States', 'SCCs', true, '{}', 'active'),
  ('Intuit Inc.', 'QuickBooks Online accounting data sync', '{financial,accounting}', 'United States', 'DPF', true, '{SOC 2 Type II}', 'active'),
  ('Frankfurter API', 'European Central Bank exchange rate data (no PII)', '{}', 'European Union', 'Adequacy Decision', false, '{}', 'active');

-- Seed CCPA compliance requirements
insert into public.regulatory_compliance (regulation, requirement_id, requirement_name, description, category, status) values
  ('ccpa', '1798.100', 'Right to Know — Categories', 'Disclose categories of PI collected, purposes, and categories of third parties', 'notice', 'compliant'),
  ('ccpa', '1798.100b', 'Right to Know — Specific', 'Provide specific PI collected upon verifiable consumer request', 'access', 'compliant'),
  ('ccpa', '1798.105', 'Right to Delete', 'Delete consumer PI upon verifiable request with exceptions', 'deletion', 'compliant'),
  ('ccpa', '1798.106', 'Right to Correct', 'Correct inaccurate PI upon verifiable request', 'access', 'compliant'),
  ('ccpa', '1798.110', 'Right to Know — Disclosure', 'Disclose PI collected, sold, shared in prior 12 months', 'notice', 'compliant'),
  ('ccpa', '1798.115', 'Right to Know — Sale/Share', 'Disclose categories of PI sold or shared', 'notice', 'compliant'),
  ('ccpa', '1798.120', 'Right to Opt-Out of Sale/Sharing', 'Provide DNSSPI mechanism and honor opt-out', 'consent', 'compliant'),
  ('ccpa', '1798.121', 'Right to Limit Sensitive PI', 'Limit use of sensitive PI to specified purposes', 'consent', 'compliant'),
  ('ccpa', '1798.125', 'Right to Non-Discrimination', 'No discrimination against consumers exercising rights', 'notice', 'compliant'),
  ('ccpa', '1798.130', 'Notice Requirements', 'Privacy policy, notice at collection, DNSSPI link', 'notice', 'compliant'),
  ('ccpa', '1798.135', 'DNSSPI Link', 'Provide clear "Do Not Sell or Share" link on homepage', 'consent', 'compliant'),
  ('ccpa', '1798.140', 'Opt-Out Signal', 'Recognize and honor Global Privacy Control (GPC) signals', 'consent', 'compliant'),
  ('gdpr', 'art_6', 'Lawful Basis', 'Process data only with valid legal basis', 'consent', 'compliant'),
  ('gdpr', 'art_7', 'Conditions for Consent', 'Freely given, specific, informed, unambiguous consent', 'consent', 'compliant'),
  ('gdpr', 'art_12', 'Transparent Information', 'Provide information in concise, intelligible, accessible form', 'notice', 'compliant'),
  ('gdpr', 'art_13', 'Information at Collection', 'Provide identity, purposes, legal basis, retention at time of collection', 'notice', 'compliant'),
  ('gdpr', 'art_15', 'Right of Access', 'Provide copy of personal data being processed', 'access', 'compliant'),
  ('gdpr', 'art_16', 'Right to Rectification', 'Rectify inaccurate personal data without undue delay', 'access', 'compliant'),
  ('gdpr', 'art_17', 'Right to Erasure', 'Erase personal data when no longer necessary', 'deletion', 'compliant'),
  ('gdpr', 'art_20', 'Right to Data Portability', 'Provide data in structured, machine-readable format', 'portability', 'compliant'),
  ('gdpr', 'art_21', 'Right to Object', 'Object to processing based on legitimate interests', 'consent', 'compliant'),
  ('gdpr', 'art_22', 'Automated Decision-Making', 'Right not to be subject to solely automated decisions', 'consent', 'compliant'),
  ('gdpr', 'art_25', 'Data Protection by Design', 'Implement appropriate technical and organizational measures', 'security', 'compliant'),
  ('gdpr', 'art_28', 'Processor Requirements', 'Ensure processors provide sufficient guarantees (DPAs)', 'vendor', 'compliant'),
  ('gdpr', 'art_30', 'Records of Processing', 'Maintain records of processing activities', 'records', 'compliant'),
  ('gdpr', 'art_32', 'Security of Processing', 'Implement appropriate security measures', 'security', 'compliant'),
  ('gdpr', 'art_33', 'Breach Notification — Authority', 'Notify supervisory authority within 72 hours of breach', 'breach', 'in_progress'),
  ('gdpr', 'art_34', 'Breach Notification — Individuals', 'Notify affected individuals of high-risk breaches', 'breach', 'in_progress'),
  ('gdpr', 'art_35', 'Data Protection Impact Assessment', 'Conduct DPIA for high-risk processing', 'dpia', 'compliant'),
  ('gdpr', 'art_37', 'Data Protection Officer', 'Designate DPO where required', 'dpo', 'not_applicable');
