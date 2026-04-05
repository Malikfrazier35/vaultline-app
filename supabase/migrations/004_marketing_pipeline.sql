-- Migration 004: Marketing pipeline — leads, segments, content tracking

-- ── leads: captured from ROI calculator, assessment quiz, resource downloads ──
create table if not exists public.leads (
  id uuid primary key default gen_random_uuid(),
  email text not null,
  full_name text,
  company_name text,
  company_size text check (company_size in ('1-10', '11-50', '51-200', '201-500', '500+')),
  title text,
  source text not null check (source in ('roi_calculator', 'assessment', 'resource_download', 'newsletter', 'referral', 'direct', 'demo_request')),
  segment text check (segment in ('spreadsheet_dependent', 'scaling', 'enterprise_ready', 'unscored')),
  score int not null default 0,
  -- Assessment data
  assessment_answers jsonb default '{}'::jsonb,
  assessment_result text,
  -- ROI calculator data
  roi_inputs jsonb default '{}'::jsonb,
  roi_result jsonb default '{}'::jsonb,
  -- Tracking
  utm_source text,
  utm_medium text,
  utm_campaign text,
  referrer text,
  page_url text,
  -- Lifecycle
  status text not null default 'new' check (status in ('new', 'contacted', 'qualified', 'converted', 'disqualified')),
  converted_org_id uuid references public.organizations(id),
  notes text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

-- ── resource_views: track content engagement for lead scoring ──
create table if not exists public.resource_views (
  id uuid primary key default gen_random_uuid(),
  lead_id uuid references public.leads(id),
  session_id text,
  resource_slug text not null,
  resource_type text not null check (resource_type in ('guide', 'calculator', 'assessment', 'case_study', 'comparison', 'checklist')),
  time_spent_seconds int default 0,
  scroll_depth int default 0,
  created_at timestamptz not null default now()
);

-- Indexes
create index if not exists idx_leads_email on public.leads(email);
create index if not exists idx_leads_segment on public.leads(segment, status);
create index if not exists idx_leads_source on public.leads(source, created_at desc);
create index if not exists idx_leads_score on public.leads(score desc);
create index if not exists idx_resource_views_lead on public.resource_views(lead_id, created_at desc);
create index if not exists idx_resource_views_slug on public.resource_views(resource_slug, created_at desc);

-- RLS
alter table public.leads enable row level security;
alter table public.resource_views enable row level security;

-- Service role only (edge functions manage leads, not end users)
do $$ begin execute 'drop policy if exists "' || 'Service manages leads' || '" on ' || current_schema || '.'; exception when others then null; end $$;
create policy "Service manages leads" on public.leads for all using (true) with check (true);
do $$ begin execute 'drop policy if exists "' || 'Service manages resource views' || '" on ' || current_schema || '.'; exception when others then null; end $$;
create policy "Service manages resource views" on public.resource_views for all using (true) with check (true);

-- Admin read access
do $$ begin execute 'drop policy if exists "' || 'Admin reads leads' || '" on ' || current_schema || '.'; exception when others then null; end $$;
create policy "Admin reads leads" on public.leads for select using (
  auth.uid() in (select id from public.profiles where role = 'owner')
);
