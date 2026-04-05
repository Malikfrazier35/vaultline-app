-- ══════════════════════════════════════════════════════════════════════
-- VAULTLINE TIER 3 TABLES — Makes shell pages functional
-- Run against: cosbviiihkxjdqcpksgv (Vaultline, us-east-1)
-- ══════════════════════════════════════════════════════════════════════

-- ┌─────────────────────────────────────┐
-- │  SWOT / RISK ENGINE                 │
-- └─────────────────────────────────────┘

CREATE TABLE IF NOT EXISTS threats (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  org_id uuid NOT NULL REFERENCES organizations(id) ON DELETE CASCADE,
  title text NOT NULL,
  description text,
  threat_type text DEFAULT 'custom',
  category text DEFAULT 'financial',
  likelihood text DEFAULT 'possible',
  impact_level text DEFAULT 'moderate',
  risk_score int DEFAULT 50,
  velocity text DEFAULT 'medium',
  trend text DEFAULT 'stable',
  potential_loss_min numeric,
  potential_loss_max numeric,
  expected_loss numeric,
  source text DEFAULT 'user_reported',
  detected_by text,
  status text DEFAULT 'active',
  escalated boolean DEFAULT false,
  review_count int DEFAULT 0,
  countermeasures jsonb DEFAULT '[]',
  last_reviewed_at timestamptz,
  created_at timestamptz DEFAULT now(),
  updated_at timestamptz DEFAULT now()
);

CREATE TABLE IF NOT EXISTS threat_monitors (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  org_id uuid REFERENCES organizations(id) ON DELETE CASCADE,
  monitor_name text NOT NULL,
  monitor_type text DEFAULT 'threshold',
  config jsonb DEFAULT '{}',
  enabled boolean DEFAULT true,
  last_triggered_at timestamptz,
  created_at timestamptz DEFAULT now()
);

CREATE TABLE IF NOT EXISTS weaknesses (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  org_id uuid NOT NULL REFERENCES organizations(id) ON DELETE CASCADE,
  title text NOT NULL,
  description text,
  weakness_type text DEFAULT 'custom',
  category text DEFAULT 'process',
  severity text DEFAULT 'medium',
  risk_score int DEFAULT 50,
  affected_areas text[] DEFAULT '{}',
  financial_exposure numeric,
  remediation_plan jsonb DEFAULT '[]',
  estimated_fix_effort text,
  source text DEFAULT 'user_reported',
  detected_by text,
  status text DEFAULT 'open',
  assigned_to uuid,
  created_at timestamptz DEFAULT now(),
  updated_at timestamptz DEFAULT now()
);

CREATE TABLE IF NOT EXISTS weakness_scans (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  org_id uuid NOT NULL REFERENCES organizations(id) ON DELETE CASCADE,
  scan_type text DEFAULT 'full',
  findings_count int DEFAULT 0,
  new_findings int DEFAULT 0,
  resolved_findings int DEFAULT 0,
  summary jsonb DEFAULT '{}',
  created_at timestamptz DEFAULT now()
);

CREATE TABLE IF NOT EXISTS opportunities (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  org_id uuid NOT NULL REFERENCES organizations(id) ON DELETE CASCADE,
  title text NOT NULL,
  description text,
  opportunity_type text DEFAULT 'custom',
  category text DEFAULT 'financial',
  impact_score int DEFAULT 50,
  effort_score int DEFAULT 50,
  confidence_score int DEFAULT 50,
  estimated_annual_value numeric,
  estimated_one_time_value numeric,
  captured_value numeric DEFAULT 0,
  source text DEFAULT 'user_reported',
  detected_by text,
  recommended_actions jsonb DEFAULT '[]',
  status text DEFAULT 'identified',
  assigned_to uuid,
  created_at timestamptz DEFAULT now(),
  updated_at timestamptz DEFAULT now()
);

CREATE TABLE IF NOT EXISTS opportunity_rules (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  org_id uuid REFERENCES organizations(id) ON DELETE CASCADE,
  rule_name text NOT NULL,
  rule_type text DEFAULT 'threshold',
  config jsonb DEFAULT '{}',
  enabled boolean DEFAULT true,
  created_at timestamptz DEFAULT now()
);

CREATE TABLE IF NOT EXISTS swot_matrix (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  org_id uuid NOT NULL REFERENCES organizations(id) ON DELETE CASCADE,
  period text NOT NULL,
  strengths_count int DEFAULT 0,
  weaknesses_count int DEFAULT 0,
  opportunities_count int DEFAULT 0,
  threats_count int DEFAULT 0,
  health_score int DEFAULT 50,
  summary jsonb DEFAULT '{}',
  created_at timestamptz DEFAULT now()
);

CREATE TABLE IF NOT EXISTS data_sources (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  org_id uuid NOT NULL REFERENCES organizations(id) ON DELETE CASCADE,
  source_name text NOT NULL,
  source_type text DEFAULT 'bank',
  status text DEFAULT 'active',
  quality_score int DEFAULT 100,
  completeness_pct int DEFAULT 100,
  fields_mapped int DEFAULT 0,
  fields_total int DEFAULT 0,
  last_synced_at timestamptz,
  created_at timestamptz DEFAULT now()
);

-- ┌─────────────────────────────────────┐
-- │  CASH VISIBILITY                    │
-- └─────────────────────────────────────┘

CREATE TABLE IF NOT EXISTS cash_positions_realtime (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  org_id uuid NOT NULL REFERENCES organizations(id) ON DELETE CASCADE,
  account_id uuid,
  institution_name text,
  account_name text,
  current_balance numeric DEFAULT 0,
  available_balance numeric DEFAULT 0,
  currency text DEFAULT 'USD',
  last_updated_at timestamptz DEFAULT now(),
  created_at timestamptz DEFAULT now()
);

CREATE TABLE IF NOT EXISTS cash_concentration (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  org_id uuid NOT NULL REFERENCES organizations(id) ON DELETE CASCADE,
  institution_name text,
  total_balance numeric DEFAULT 0,
  account_count int DEFAULT 0,
  concentration_pct numeric DEFAULT 0,
  risk_level text DEFAULT 'normal',
  created_at timestamptz DEFAULT now()
);

CREATE TABLE IF NOT EXISTS cash_visibility_snapshots (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  org_id uuid NOT NULL REFERENCES organizations(id) ON DELETE CASCADE,
  snapshot_date date NOT NULL,
  total_cash numeric DEFAULT 0,
  total_debt numeric DEFAULT 0,
  net_position numeric DEFAULT 0,
  accounts_reporting int DEFAULT 0,
  data_completeness_pct int DEFAULT 100,
  created_at timestamptz DEFAULT now()
);

CREATE TABLE IF NOT EXISTS liquidity_buffers (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  org_id uuid NOT NULL REFERENCES organizations(id) ON DELETE CASCADE,
  buffer_name text NOT NULL,
  target_amount numeric DEFAULT 0,
  current_amount numeric DEFAULT 0,
  buffer_type text DEFAULT 'operating',
  status text DEFAULT 'adequate',
  created_at timestamptz DEFAULT now(),
  updated_at timestamptz DEFAULT now()
);

-- ┌─────────────────────────────────────┐
-- │  SECURITY CENTER                    │
-- └─────────────────────────────────────┘

CREATE TABLE IF NOT EXISTS security_policies (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  org_id uuid NOT NULL REFERENCES organizations(id) ON DELETE CASCADE,
  policy_name text NOT NULL,
  category text DEFAULT 'access',
  ip_allowlist_enabled boolean DEFAULT false,
  concurrent_sessions_max int DEFAULT 5,
  audit_retention_days int DEFAULT 365,
  data_classification_enabled boolean DEFAULT false,
  after_hours_alerts boolean DEFAULT false,
  mfa_required boolean DEFAULT true,
  config jsonb DEFAULT '{}',
  created_at timestamptz DEFAULT now(),
  updated_at timestamptz DEFAULT now()
);

CREATE TABLE IF NOT EXISTS security_events (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  org_id uuid NOT NULL REFERENCES organizations(id) ON DELETE CASCADE,
  event_type text NOT NULL,
  severity text DEFAULT 'info',
  description text,
  source_ip text,
  user_id uuid,
  resolved boolean DEFAULT false,
  resolved_at timestamptz,
  created_at timestamptz DEFAULT now()
);

CREATE TABLE IF NOT EXISTS active_sessions (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  org_id uuid NOT NULL REFERENCES organizations(id) ON DELETE CASCADE,
  user_id uuid NOT NULL,
  ip_address text,
  user_agent text,
  started_at timestamptz DEFAULT now(),
  last_active_at timestamptz DEFAULT now(),
  is_active boolean DEFAULT true
);

CREATE TABLE IF NOT EXISTS ip_allowlist (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  org_id uuid NOT NULL REFERENCES organizations(id) ON DELETE CASCADE,
  ip_address text NOT NULL,
  label text,
  added_by uuid,
  created_at timestamptz DEFAULT now()
);

CREATE TABLE IF NOT EXISTS vulnerability_scans (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  org_id uuid NOT NULL REFERENCES organizations(id) ON DELETE CASCADE,
  scan_type text DEFAULT 'full',
  findings_count int DEFAULT 0,
  critical_count int DEFAULT 0,
  high_count int DEFAULT 0,
  medium_count int DEFAULT 0,
  low_count int DEFAULT 0,
  summary jsonb DEFAULT '{}',
  created_at timestamptz DEFAULT now()
);

CREATE TABLE IF NOT EXISTS security_score (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  org_id uuid NOT NULL REFERENCES organizations(id) ON DELETE CASCADE,
  score int DEFAULT 50,
  components jsonb DEFAULT '{}',
  calculated_at timestamptz DEFAULT now()
);

-- ┌─────────────────────────────────────┐
-- │  AUDIT CENTER                       │
-- └─────────────────────────────────────┘

CREATE TABLE IF NOT EXISTS audit_programs (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  org_id uuid NOT NULL REFERENCES organizations(id) ON DELETE CASCADE,
  name text NOT NULL,
  framework text DEFAULT 'custom',
  status text DEFAULT 'active',
  owner_id uuid,
  description text,
  created_at timestamptz DEFAULT now(),
  updated_at timestamptz DEFAULT now()
);

CREATE TABLE IF NOT EXISTS audit_schedules (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  org_id uuid NOT NULL REFERENCES organizations(id) ON DELETE CASCADE,
  program_id uuid REFERENCES audit_programs(id) ON DELETE CASCADE,
  title text NOT NULL,
  scheduled_date date,
  status text DEFAULT 'scheduled',
  assigned_to uuid,
  created_at timestamptz DEFAULT now()
);

CREATE TABLE IF NOT EXISTS audit_checklists (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  org_id uuid NOT NULL REFERENCES organizations(id) ON DELETE CASCADE,
  program_id uuid REFERENCES audit_programs(id) ON DELETE CASCADE,
  title text NOT NULL,
  is_template boolean DEFAULT false,
  items jsonb DEFAULT '[]',
  assigned_to uuid,
  status text DEFAULT 'not_started',
  progress_pct int DEFAULT 0,
  due_date date,
  created_at timestamptz DEFAULT now(),
  updated_at timestamptz DEFAULT now()
);

CREATE TABLE IF NOT EXISTS audit_checklist_responses (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  org_id uuid NOT NULL REFERENCES organizations(id) ON DELETE CASCADE,
  checklist_id uuid REFERENCES audit_checklists(id) ON DELETE CASCADE,
  item_id text NOT NULL,
  response text DEFAULT 'pending',
  notes text,
  evidence_urls text[] DEFAULT '{}',
  responded_by uuid,
  responded_at timestamptz DEFAULT now()
);

CREATE TABLE IF NOT EXISTS audit_findings (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  org_id uuid NOT NULL REFERENCES organizations(id) ON DELETE CASCADE,
  program_id uuid REFERENCES audit_programs(id) ON DELETE CASCADE,
  title text NOT NULL,
  severity text DEFAULT 'medium',
  status text DEFAULT 'open',
  description text,
  remediation text,
  assigned_to uuid,
  due_date date,
  created_at timestamptz DEFAULT now(),
  updated_at timestamptz DEFAULT now()
);

-- ┌─────────────────────────────────────┐
-- │  SUPPORT                            │
-- └─────────────────────────────────────┘

CREATE TABLE IF NOT EXISTS support_tickets (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  org_id uuid NOT NULL REFERENCES organizations(id) ON DELETE CASCADE,
  created_by uuid NOT NULL,
  subject text NOT NULL,
  body text,
  category text DEFAULT 'general',
  priority text DEFAULT 'medium',
  status text DEFAULT 'open',
  source text DEFAULT 'app',
  page_url text,
  user_agent text,
  first_response_at timestamptz,
  resolved_at timestamptz,
  csat_score int,
  csat_feedback text,
  created_at timestamptz DEFAULT now(),
  updated_at timestamptz DEFAULT now()
);

CREATE TABLE IF NOT EXISTS ticket_messages (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  ticket_id uuid NOT NULL REFERENCES support_tickets(id) ON DELETE CASCADE,
  sender_type text DEFAULT 'customer',
  sender_id uuid,
  body text NOT NULL,
  created_at timestamptz DEFAULT now()
);

CREATE TABLE IF NOT EXISTS csat_surveys (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  org_id uuid NOT NULL REFERENCES organizations(id) ON DELETE CASCADE,
  ticket_id uuid REFERENCES support_tickets(id) ON DELETE SET NULL,
  score int NOT NULL,
  feedback text,
  created_by uuid,
  created_at timestamptz DEFAULT now()
);

CREATE TABLE IF NOT EXISTS knowledge_base (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  title text NOT NULL,
  category text DEFAULT 'general',
  body text,
  tags text[] DEFAULT '{}',
  published boolean DEFAULT true,
  views int DEFAULT 0,
  helpful_count int DEFAULT 0,
  created_at timestamptz DEFAULT now(),
  updated_at timestamptz DEFAULT now()
);

-- ┌─────────────────────────────────────┐
-- │  DATA INTELLIGENCE                  │
-- └─────────────────────────────────────┘

CREATE TABLE IF NOT EXISTS data_quality_rules (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  org_id uuid NOT NULL REFERENCES organizations(id) ON DELETE CASCADE,
  rule_name text NOT NULL,
  rule_type text DEFAULT 'completeness',
  table_name text,
  column_name text,
  threshold numeric DEFAULT 95,
  enabled boolean DEFAULT true,
  created_at timestamptz DEFAULT now()
);

CREATE TABLE IF NOT EXISTS data_quality_issues (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  org_id uuid NOT NULL REFERENCES organizations(id) ON DELETE CASCADE,
  rule_id uuid REFERENCES data_quality_rules(id) ON DELETE SET NULL,
  issue_type text DEFAULT 'missing_data',
  severity text DEFAULT 'medium',
  table_name text,
  description text,
  resolution_notes text,
  status text DEFAULT 'open',
  created_at timestamptz DEFAULT now(),
  resolved_at timestamptz
);

CREATE TABLE IF NOT EXISTS data_insights (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  org_id uuid NOT NULL REFERENCES organizations(id) ON DELETE CASCADE,
  insight_type text DEFAULT 'anomaly',
  title text NOT NULL,
  description text,
  impact text DEFAULT 'medium',
  status text DEFAULT 'new',
  helpful boolean,
  data jsonb DEFAULT '{}',
  created_at timestamptz DEFAULT now()
);

CREATE TABLE IF NOT EXISTS data_lineage (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  org_id uuid NOT NULL REFERENCES organizations(id) ON DELETE CASCADE,
  source_table text,
  target_table text,
  transform_type text,
  description text,
  created_at timestamptz DEFAULT now()
);

CREATE TABLE IF NOT EXISTS intelligence_reports (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  org_id uuid NOT NULL REFERENCES organizations(id) ON DELETE CASCADE,
  report_type text DEFAULT 'weekly',
  title text,
  summary text,
  data jsonb DEFAULT '{}',
  created_at timestamptz DEFAULT now()
);

-- ┌─────────────────────────────────────┐
-- │  PLATFORM / INFRA                   │
-- └─────────────────────────────────────┘

CREATE TABLE IF NOT EXISTS leads (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  email text,
  name text,
  company text,
  source text DEFAULT 'website',
  tool text,
  page_url text,
  inputs jsonb DEFAULT '{}',
  score int,
  created_at timestamptz DEFAULT now()
);

CREATE TABLE IF NOT EXISTS resource_views (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  resource_type text,
  resource_id text,
  viewer_email text,
  ip_address text,
  created_at timestamptz DEFAULT now()
);

CREATE TABLE IF NOT EXISTS growth_events (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  org_id uuid REFERENCES organizations(id) ON DELETE CASCADE,
  event_type text NOT NULL,
  event_data jsonb DEFAULT '{}',
  user_id uuid,
  created_at timestamptz DEFAULT now()
);

CREATE TABLE IF NOT EXISTS interactive_tools (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  tool_name text NOT NULL,
  tool_type text DEFAULT 'calculator',
  config jsonb DEFAULT '{}',
  enabled boolean DEFAULT true,
  created_at timestamptz DEFAULT now()
);

CREATE TABLE IF NOT EXISTS tool_submissions (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  tool_id uuid REFERENCES interactive_tools(id) ON DELETE SET NULL,
  tool_name text,
  email text,
  inputs jsonb DEFAULT '{}',
  results jsonb DEFAULT '{}',
  created_at timestamptz DEFAULT now()
);

-- ┌─────────────────────────────────────┐
-- │  STATUS / MONITORING                │
-- └─────────────────────────────────────┘

CREATE TABLE IF NOT EXISTS system_health (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  service_name text NOT NULL,
  status text DEFAULT 'operational',
  response_time_ms int,
  uptime_pct numeric DEFAULT 100,
  checked_at timestamptz DEFAULT now()
);

CREATE TABLE IF NOT EXISTS sync_health (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  org_id uuid REFERENCES organizations(id) ON DELETE CASCADE,
  connection_type text,
  connection_id uuid,
  status text DEFAULT 'healthy',
  last_sync_at timestamptz,
  error_message text,
  checked_at timestamptz DEFAULT now()
);

CREATE TABLE IF NOT EXISTS incidents (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  title text NOT NULL,
  severity text DEFAULT 'minor',
  status text DEFAULT 'investigating',
  affected_services text[] DEFAULT '{}',
  description text,
  started_at timestamptz DEFAULT now(),
  resolved_at timestamptz,
  created_at timestamptz DEFAULT now()
);

CREATE TABLE IF NOT EXISTS incident_updates (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  incident_id uuid NOT NULL REFERENCES incidents(id) ON DELETE CASCADE,
  status text NOT NULL,
  message text,
  created_at timestamptz DEFAULT now()
);

CREATE TABLE IF NOT EXISTS error_events (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  org_id uuid REFERENCES organizations(id) ON DELETE CASCADE,
  error_type text,
  message text,
  stack_trace text,
  page_url text,
  user_id uuid,
  created_at timestamptz DEFAULT now()
);

CREATE TABLE IF NOT EXISTS qb_connections (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  org_id uuid NOT NULL REFERENCES organizations(id) ON DELETE CASCADE,
  realm_id text,
  access_token text,
  refresh_token text,
  status text DEFAULT 'active',
  last_synced_at timestamptz,
  created_at timestamptz DEFAULT now(),
  updated_at timestamptz DEFAULT now()
);

CREATE TABLE IF NOT EXISTS accounting_connections (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  org_id uuid NOT NULL REFERENCES organizations(id) ON DELETE CASCADE,
  provider text NOT NULL,
  status text DEFAULT 'connected',
  config jsonb DEFAULT '{}',
  last_synced_at timestamptz,
  created_at timestamptz DEFAULT now()
);

-- ┌─────────────────────────────────────┐
-- │  ROW LEVEL SECURITY                 │
-- └─────────────────────────────────────┘

-- Enable RLS on all new tables
DO $$ 
DECLARE t text;
BEGIN
  FOR t IN SELECT unnest(ARRAY[
    'threats','threat_monitors','weaknesses','weakness_scans','opportunities','opportunity_rules',
    'swot_matrix','data_sources','cash_positions_realtime','cash_concentration',
    'cash_visibility_snapshots','liquidity_buffers','security_policies','security_events',
    'active_sessions','ip_allowlist','vulnerability_scans','security_score',
    'audit_programs','audit_schedules','audit_checklists','audit_checklist_responses','audit_findings',
    'support_tickets','ticket_messages','csat_surveys','knowledge_base',
    'data_quality_rules','data_quality_issues','data_insights','data_lineage','intelligence_reports',
    'leads','resource_views','growth_events','interactive_tools','tool_submissions',
    'system_health','sync_health','incidents','incident_updates','error_events',
    'qb_connections','accounting_connections'
  ])
  LOOP
    EXECUTE format('ALTER TABLE %I ENABLE ROW LEVEL SECURITY', t);
  END LOOP;
END $$;

-- Org-scoped SELECT policies (authenticated users can read their own org's data)
DO $$
DECLARE t text;
BEGIN
  FOR t IN SELECT unnest(ARRAY[
    'threats','threat_monitors','weaknesses','weakness_scans','opportunities','opportunity_rules',
    'swot_matrix','data_sources','cash_positions_realtime','cash_concentration',
    'cash_visibility_snapshots','liquidity_buffers','security_policies','security_events',
    'active_sessions','ip_allowlist','vulnerability_scans','security_score',
    'audit_programs','audit_schedules','audit_checklists','audit_checklist_responses','audit_findings',
    'support_tickets','ticket_messages','csat_surveys',
    'data_quality_rules','data_quality_issues','data_insights','data_lineage','intelligence_reports',
    'growth_events','sync_health','error_events','qb_connections','accounting_connections'
  ])
  LOOP
    EXECUTE format(
      'CREATE POLICY IF NOT EXISTS %I ON %I FOR SELECT TO authenticated USING (org_id = (SELECT org_id FROM profiles WHERE id = auth.uid()))',
      'sel_' || t, t
    );
  END LOOP;
END $$;

-- Public-read tables (no org_id scope needed)
CREATE POLICY IF NOT EXISTS sel_knowledge_base ON knowledge_base FOR SELECT TO authenticated USING (published = true);
CREATE POLICY IF NOT EXISTS sel_system_health ON system_health FOR SELECT TO authenticated USING (true);
CREATE POLICY IF NOT EXISTS sel_incidents ON incidents FOR SELECT TO authenticated USING (true);
CREATE POLICY IF NOT EXISTS sel_incident_updates ON incident_updates FOR SELECT TO authenticated USING (true);
CREATE POLICY IF NOT EXISTS sel_interactive_tools ON interactive_tools FOR SELECT TO authenticated USING (true);
CREATE POLICY IF NOT EXISTS sel_leads ON leads FOR SELECT TO service_role USING (true);
CREATE POLICY IF NOT EXISTS sel_resource_views ON resource_views FOR SELECT TO service_role USING (true);
CREATE POLICY IF NOT EXISTS sel_tool_submissions ON tool_submissions FOR SELECT TO service_role USING (true);

-- INSERT policies for public tools (anon can submit leads, tool results)
CREATE POLICY IF NOT EXISTS ins_leads ON leads FOR INSERT TO anon WITH CHECK (true);
CREATE POLICY IF NOT EXISTS ins_resource_views ON resource_views FOR INSERT TO anon WITH CHECK (true);
CREATE POLICY IF NOT EXISTS ins_tool_submissions ON tool_submissions FOR INSERT TO anon WITH CHECK (true);

-- Service role full access (edge functions use service_role key)
-- Edge functions already bypass RLS via service_role, so no additional policies needed.

-- ┌─────────────────────────────────────┐
-- │  INDEXES                            │
-- └─────────────────────────────────────┘

CREATE INDEX IF NOT EXISTS idx_threats_org ON threats(org_id);
CREATE INDEX IF NOT EXISTS idx_threats_status ON threats(org_id, status);
CREATE INDEX IF NOT EXISTS idx_weaknesses_org ON weaknesses(org_id);
CREATE INDEX IF NOT EXISTS idx_weaknesses_status ON weaknesses(org_id, status);
CREATE INDEX IF NOT EXISTS idx_opportunities_org ON opportunities(org_id);
CREATE INDEX IF NOT EXISTS idx_opportunities_status ON opportunities(org_id, status);
CREATE INDEX IF NOT EXISTS idx_swot_org ON swot_matrix(org_id, period);
CREATE INDEX IF NOT EXISTS idx_security_events_org ON security_events(org_id, created_at);
CREATE INDEX IF NOT EXISTS idx_support_tickets_org ON support_tickets(org_id, status);
CREATE INDEX IF NOT EXISTS idx_ticket_messages_ticket ON ticket_messages(ticket_id);
CREATE INDEX IF NOT EXISTS idx_audit_checklists_org ON audit_checklists(org_id);
CREATE INDEX IF NOT EXISTS idx_data_quality_issues_org ON data_quality_issues(org_id, status);
CREATE INDEX IF NOT EXISTS idx_leads_email ON leads(email);
CREATE INDEX IF NOT EXISTS idx_cash_positions_rt_org ON cash_positions_realtime(org_id);
CREATE INDEX IF NOT EXISTS idx_incidents_status ON incidents(status);

-- Done. 45 new tables, RLS enabled on all, org-scoped policies, indexed.
