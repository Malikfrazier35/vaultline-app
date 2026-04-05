# VAULTLINE SUITE — FULL PROJECT HANDOFF
## Paste this entire document into a new Claude chat along with uploading the vaultline-app.zip

---

## PROJECT: VAULTLINE — Treasury Management SaaS
**Live URL:** https://www.vaultline.app | **Fallback:** https://vaultline-app.vercel.app
**Builder:** Malik Frazier (malikfrazier35@yahoo.com + financialholdingllc@gmail.com)
**Working directory:** /home/claude/vaultline-app/

---

## BRAND & STACK
- **Tagline:** "Your cash position. Crystal clear." | **Positioning:** Mid-market treasury ($10M–$500M)
- **Colors:** Deep slate (#0C1222), electric cyan (#22D3EE), warm white (#F1F5F9)
- **Fonts:** Plus Jakarta Sans (display), DM Sans (body), JetBrains Mono (financial figures)
- **Stack:** React 19 + Vite 6 + Tailwind v4 + Supabase + Recharts + Lucide + React Router v7

## SUPABASE PROJECT
- **Project ID:** `cosbviiihkxjdqcpksgv` | Region: us-east-1 | Status: ACTIVE_HEALTHY
- **API URL:** `https://cosbviiihkxjdqcpksgv.supabase.co`
- **Anon Key:** `eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImNvc2J2aWlpaGt4amRxY3Brc2d2Iiwicm9sZSI6ImFub24iLCJpYXQiOjE3NzM0Mzg5NDUsImV4cCI6MjA4OTAxNDk0NX0.nUCI_pWwHjQjvdSZyLdxHclugxuBp4NRV0Vw9M2CrnA`
- **Org ID:** `ipkriolforxruwgjrvfh`

### Edge Functions (43 total):
- `stripe-checkout` — creates Stripe checkout session with customer get-or-create
- `stripe-webhook` — handles 5 subscription lifecycle events (checkout completed, sub updated/deleted, payment failed/succeeded)
- `account-close` — 4-step offboarding (preview → confirm → Stripe cancel + prorated refund + deactivate + disconnect + audit)
- `generate-forecast` — server-side 3-model forecast (Linear/EMA/Monte Carlo) with backtesting, confidence scoring, cash_position refresh. Supports cron batch mode.
- `fx-rates` — ECB/Frankfurter exchange rates (latest + 30-day history + trends, 28 currencies)
- `copilot` — AI treasury assistant (Claude streaming, treasury context, anomaly detection, balance trends)
- `team-manage` — 10 actions: invite, bulk_invite, revoke, resend, update_role, remove/suspend/reactivate member, transfer ownership, list
- `growth-engine` — nudge generation, referral tracking, cross-sell interest, lifecycle stats
- `qb-auth` — QuickBooks OAuth 2.0 initiation
- `qb-sync` — QuickBooks account/transaction sync with token refresh
- `acct-auth` — Xero/Sage/NetSuite OAuth initiation
- `acct-sync` — Xero/Sage data sync with token refresh
- `data-import` — CSV parsing, manual transaction/account creation, import history
- `super-admin` — admin overview, org management, user deactivation (admin-email gated)
- `plaid-link` — Plaid Link token creation
- `plaid-exchange` — Plaid public token exchange
- `plaid-sync` — Plaid transaction sync
- `lead-capture` — Lead scoring (0-100), auto-segmentation, upsert by email, UTM tracking, pipeline stats admin endpoint
- `notify` — Alert evaluation engine (5 rule types), email via Resend, Slack webhooks, in-app notifications, team invite emails, trial expiry checks, batch evaluation for cron
- `support` — Ticket CRUD, threaded messages, SLA breach detection, CSAT rating, knowledge base, admin stats
- `qa-monitor` — Status page data, health checks (cron), error logging/dashboard, incident CRUD, per-org sync health
- `partners` — Partner CRUD, referral tracking, commission calculation, webhook delivery, partner self-service portal via API key
- `security-ops` — Security dashboard, event logging, threat resolution, posture score calculator (20+ factors), policy CRUD, IP allowlist, session management
- `privacy-ops` — Privacy dashboard, consent record/revoke, public DSR submission, DSR workflow + audit trail, Article 30 register, retention enforcement (cron), full user data export
- `navigation` — Page view tracking, batch ingestion, feature events, onboarding steps, session close (sendBeacon), engagement scoring (cron: login streak + pages + features + time + actions → 0-100 + churn risk), admin analytics dashboard (top pages, top features, session stats, churn risk breakdown)
- `memory` — Draft CRUD (save/get/list/delete/restore with versioning + 30d expiry), user preferences (get/save/merge), session snapshots (save/get for crash recovery, 24h TTL), undo/redo (push/undo/redo, 7d TTL), cleanup (cron: purge expired snapshots + drafts + undo entries)
- `layout-ops` — Dashboard layouts (get/save/reset per page per user), widget registry (15 seeded), saved views (per page filter/sort/column configs, shareable), keyboard shortcuts CRUD
- `tools` — Interactive tool registry (6 seeded), tool submissions with lead linking, treasury benchmark engine (8 industry metrics with percentile scoring), burn rate simulator (multi-scenario runway projection), tool analytics
- `time-ops` — Task dashboard, scheduled task CRUD (9 types, 7 recurrence patterns, timezone-aware), task completion with auto-advance, timezone config (business hours, fiscal calendar), time entry logging, time breakdown analytics, task reminder cron
- `marketing-ops` — Brand kit (color palette + typography, seeded), campaign CRUD (9 types, segment targeting, budget/spend/ROI tracking), content CRUD (12 types, status workflow, SEO fields), social calendar (8 platforms), marketing dashboard (KPIs, lead sources, content breakdown, upcoming posts)
- `legal-ops` — Legal document retrieval (versioned, by slug), acceptance tracking, cookie preferences (5 categories + GPC auto-disable), DNSSPI opt-out (sale/sharing/targeted ads/profiling/matched identifiers with cascade), privacy rights requests (11 types, 8 regulations, verification + fulfillment + appeal), subprocessor registry, compliance dashboard (per-regulation %, open rights, opt-out counts)
- `industry-ops` — Industry profile registry (12 verticals seeded), org industry config (set/update with sub-vertical, company size, revenue range), industry-specific onboarding (custom steps, terminology, categories, alerts), industry content retrieval, diversity metrics calculation (cron) and retrieval
- `data-intel` — Data intelligence dashboard (source health, quality issues, AI insights, reports), data source CRUD + quality scoring, quality issue tracking (resolve/ignore), quality rules CRUD + execution (completeness/timeliness checks), AI insight generation (cron: degraded sources, low quality, open issues), insight lifecycle (view/acknowledge/act/dismiss with feedback), data lineage retrieval, intelligence reports
- `cash-visibility` — Real-time cash position dashboard (total cash, available, pending in/out, projected EOD, stale/below-minimum alerts), position refresh with threshold checks (minimum/target/sweep) + auto-notification on breach, threshold configuration, cash concentration rules CRUD (sweep/pool/ZBA/target balance), liquidity buffer management (7 buffer types, funded % calculation, status classification), daily snapshot cron (consolidated position by org for trending)
- `ux-ops` — UX preferences (accessibility: reduced motion/high contrast/font size/dyslexia font/screen reader hints; display: color mode/accent/chart palette/number abbreviation; navigation: landing page/sidebar width/breadcrumbs), feedback submission + listing, walkthrough registry (4 seeded) + completion tracking, announcement listing (active/published with date filtering)
- `resources` — Resource library (search/filter by type/category, view counting, helpful rating), report templates (list/use with usage counting, 8 system templates seeded), quick links CRUD (pin pages for dashboard), sample data sets, dashboard hub (featured resources + templates + quick links + announcements combined)
- `payment-hub` — Bank-like payment dashboard (accounts, recent tx, pending approvals, top payees, recurring, batches), payee CRUD (vendor/employee/contractor/tax/intercompany with bank details), send payment (limit checks, auto-approval for <$10K, reference generation, status timeline), approve/reject workflow, recurring payment creation (7 frequencies), transaction history with filters
- `ui-ops` — Component registry (15 seeded across 7 categories), page state configs (8 seeded: loading/empty/error/offline), theme registry (3 seeded: Void/Daylight/Midnight), design system dashboard
- `automation` — Automation rule CRUD (14 trigger types, 4 action types: notify/categorize/webhook/tag), rule execution engine (runs actions sequentially, logs results, tracks failures), webhook subscription CRUD (HMAC signing, event filtering, delivery tracking), webhook delivery log, changelog listing (4 entries seeded), daily limit reset (cron)
- `opportunity-engine` — Opportunity dashboard (pipeline value, status/type breakdown, active count, captured value), opportunity create/update with lifecycle (new→evaluating→approved→in_progress→captured), automated scanning (cron: idle cash detection via cash_positions_realtime, data quality improvement opportunities), SWOT matrix snapshot (cron: counts all O/W/T, calculates health/opportunity/risk scores, captures top items + financial summaries)
- `weakness-engine` — Weakness dashboard (open/critical/high counts, avg risk, total exposure, severity/category/type breakdowns), weakness create/update with remediation workflow (open→acknowledged→in_progress→resolved), comprehensive automated scan (cron: data quality gaps, missing integrations, stale connections, security posture below 60 — each creates weakness with severity + risk score + fix estimate), scan history with health scores
- `threat-engine` — Threat dashboard (active/escalated/worsening counts, total exposure, avg risk, category/likelihood breakdowns, SWOT trend), threat create/update with risk scoring (likelihood×impact matrix auto-calculation), automated scanning (cron: bank connection failures, cash below minimum, systemic weakness accumulation, trend updates on aging high-risk threats), escalation workflow, countermeasure tracking
- `audit-ops` — Audit dashboard (programs, findings by severity/status, checklists, templates, schedules, pass rate, avg days open), program CRUD (11 types, scoring, risk rating), checklist creation + template cloning (3 seeded: cash controls 8 items, payment auth 6 items, access management 5 items), item-level response (pass/fail/partial/NA with auto-progress + auto-pass-rate + auto-finding-creation on failure), finding CRUD (9 types, severity, remediation lifecycle: open→plan→remediate→verify→close, auto-generated finding numbers, overdue tracking), automated health check cron (overdue finding notifications, upcoming audit schedule alerts), checklist detail view with response map

### DB Schema (124 tables across 16 migrations):
- **organizations** (plan_status: trialing|active|past_due|canceled, closed_at, closure_reason, stripe_customer_id, stripe_subscription_id, referral_code, trial_ends_at default 14 days)
- **profiles** (role: owner|admin|member|viewer, status: active|deactivated|suspended)
- **bank_connections**, **accounts**, **transactions**, **daily_balances**, **forecasts**
- **cash_position** (materialized aggregate: total_balance, liquid_balance, available_credit, connected_banks, total_accounts)
- **copilot_messages**, **notification_settings**, **audit_log**
- **growth_events** (signup|trial_start|conversion|upgrade|downgrade|churn|reactivation|referral_sent|referral_converted)
- **invites** (email, role, status: pending|accepted|expired|revoked, token, expires_at)
- **ecosystem_products** (product: vaultline|financeos|parallax|emberglow, status, stripe_subscription_id)
- **qb_connections** (realm_id, company_name, access/refresh tokens, status)
- **accounting_connections** (provider: xero|sage|netsuite, tenant_id, tokens, status)
- **data_imports** (type: csv|manual|api, row/success/error counts, status)
- **fx_watchlist** (base/target currency, alert thresholds)
- **leads** (email, company, segment: spreadsheet_dependent|scaling|enterprise_ready, score 0-100, assessment/ROI data, UTM tracking, lifecycle status)
- **resource_views** (lead_id, resource_slug, type, time_spent, scroll_depth)
- **notifications** (15 alert types, severity, title/body, multi-channel delivery tracking, read/dismissed state, action deep links, 30-day expiry)
- **support_tickets** (9 categories, 4 priorities, 6 statuses, SLA tracking, CSAT)
- **ticket_messages** (threaded, sender_type: customer|agent|system, internal notes)
- **knowledge_base** (9 categories, published/draft/archived, view + helpfulness tracking)
- **csat_surveys** (5 trigger types, 1-10 score, feedback)
- **system_health** (10 services, 5 statuses, response time, error rate)
- **incidents** (4 severities, 5 statuses, timeline tracking)
- **incident_updates** (threaded updates on incidents)
- **error_events** (service, error type, stack trace, resolved flag)
- **sync_health** (per-org per-provider pipeline health)
- **partners** (5 types, 4 tiers, commission %, API key, webhook URL)
- **partner_referrals** (full funnel tracking, MRR, commission, paid status)
- **partner_webhooks_log** (delivery audit trail with retry)
- **invoices** (AR: invoice_number, client, amount, status: draft|sent|pending|overdue|paid|canceled|disputed, category, line_items)
- **payables** (AP: bill_number, vendor, amount, status: pending|scheduled|processing|paid|overdue|canceled, category, recurrence)
- **security_events** (22 event types, severity, IP/geo/device tracking, resolution workflow)
- **ip_allowlist** (CIDR-based, per-org, with labels)
- **active_sessions** (user sessions with device type, IP, geo, expiry, revocation)
- **security_policies** (per-org: MFA, password rules, session limits, IP restrictions, export controls, audit retention)
- **vulnerability_scans** (5 scan types, findings by severity)
- **security_score** (overall 0-100 + 5 sub-scores: auth, access, data, compliance, network)
- **consent_records** (11 consent types, version tracking, grant/revoke timestamps)
- **data_subject_requests** (7 DSR types, 6 statuses, GDPR/CCPA/PIPEDA/LGPD, 30-day SLA, audit trail)
- **data_processing_records** (Article 30 register, 7 legal bases, pre-seeded with 7 activities)
- **privacy_impact_assessments** (DPIA: risk levels, mitigations, DPO opinion, approval)
- **data_retention_policies** (automated lifecycle: delete/anonymize/archive, pre-seeded with 9 policies)
- **page_views** (page path, time-on-page, scroll depth, interactions, device, UTM, entry/exit)
- **feature_events** (feature name, action: viewed|used|configured|dismissed|upgraded|errored, context)
- **navigation_flows** (session-level: entry→exit path sequence, duration, page count, features used)
- **onboarding_progress** (step-by-step tracking with timing, per user per org)
- **engagement_scores** (daily per-user: 0-100 score, login streak, pages, features, time, actions, churn risk)
- **user_drafts** (auto-saved form state: 11 draft types, versioned, 30-day expiry, restore/discard)
- **user_preferences** (persistent UI state: dashboard period, forecast model, chart type, sidebar, theme, density, pinned pages, command palette recents)
- **session_snapshots** (full page state for crash recovery, 24h TTL)
- **undo_history** (operation-level undo/redo stack, entity tracking, 7-day TTL)
- **dashboard_layouts** (per-user per-page widget arrangement with presets)
- **widgets** (registry: 15 seeded widgets across 8 categories, plan-gated, config schema)
- **saved_views** (per-page filter/sort/column configs, shareable across org)
- **keyboard_shortcuts** (per-user custom shortcut mappings)
- **interactive_tools** (tool registry: 6 seeded — ROI, Assessment, Benchmark, Burn Simulator, TMS Comparison, Cash Planner)
- **tool_submissions** (captured inputs/results with lead linking)
- **scheduled_tasks** (9 task types, 7 recurrence patterns, timezone-aware, SLA tracking)
- **task_completions** (completion log with duration and notes)
- **timezone_configs** (per-org: primary timezone, display format, business hours, fiscal calendar)
- **time_entries** (manual time tracking: 9 categories, billable flag)
- **brand_assets** (centralized brand kit: colors, typography, logos — seeded with Vaultline brand)
- **marketing_campaigns** (9 types, segment targeting, budget/spend tracking, UTM, performance metrics)
- **marketing_content** (12 content types, status workflow, SEO fields, channel, performance)
- **social_calendar** (8 platforms, scheduled/published status, engagement tracking)
- **legal_documents** (versioned legal text: slug, title, version, effective_date, HTML/markdown, jurisdiction, regulation, superseded chain)
- **legal_acceptances** (document acceptance: user/org, method, IP/UA, withdrawal support)
- **cookie_preferences** (per-visitor: 5 categories, GPC/DNT detection + honoring, geo tracking)
- **privacy_rights_requests** (11 request types, 8 regulations, verification/fulfillment/appeal workflow, audit trail, deadline tracking)
- **dnsspi_optouts** (Do Not Sell/Share: sale/sharing/targeted_ads/profiling/matched_identifiers, method, GPC flag, jurisdiction)
- **subprocessors** (Article 28: 8 seeded processors with DPA, transfer mechanism, certifications)
- **regulatory_compliance** (30 seeded CCPA + GDPR requirements with per-requirement status tracking)
- **industry_profiles** (12 verticals seeded: SaaS, Healthcare, Manufacturing, Fintech, Real Estate, E-Commerce, Nonprofit, Energy, Professional Services, Construction, Education, Logistics — with custom onboarding steps, categories, regulations, KPIs, pain points, value props)
- **org_industry_config** (per-org: industry selection, sub-vertical, company size, revenue range, KYB status, risk tier, onboarding score, DPA tracking)
- **industry_content** (vertical-specific marketing: 12 content types, persona targeting, funnel stage, performance tracking)
- **diversity_metrics** (monthly DEI snapshot: industries represented, geographic regions, company sizes, optional self-reported diversity)
- **data_sources** (connected source registry: 10 source types, connection health, quality score, completeness/accuracy/freshness, field mapping)
- **data_quality_rules** (automated checks: 11 rule types, target table/field, condition schema, severity, auto-fix actions)
- **data_quality_issues** (tracked violations: severity, affected records, financial impact, resolution workflow)
- **data_insights** (AI-generated: 12 insight types, confidence scoring, recommended actions, lifecycle with feedback)
- **data_lineage** (source→dest field mapping: transformation type + logic, batch tracking)
- **intelligence_reports** (8 report types: daily/weekly/monthly digests, anomaly/quality/trend/risk/benchmark reports)
- **cash_positions_realtime** (intraday per-account: ledger/available/pending in/out/projected EOD, minimum/target/sweep thresholds, stale/below-minimum flags)
- **cash_concentration** (sweep/pool/ZBA/target/threshold rules: source/dest accounts, trigger type + threshold, execution tracking)
- **liquidity_buffers** (7 buffer types: operating/emergency/debt/regulatory/payroll/tax/custom, required vs current amount, funded %, alert threshold)
- **cash_visibility_snapshots** (daily consolidated: total cash/available/pending, by-account/entity/currency breakdown, data completeness)
- **ux_preferences** (per-user: accessibility — motion/contrast/font/dyslexia/screen reader; display — mode/accent/palette/abbreviation; navigation — landing page/sidebar/breadcrumbs; tables — rows/headers/borders; notifications — sound/desktop; guided help — tooltips/badges/completed walkthroughs)
- **ux_feedback** (structured: 7 feedback types, 1-5 rating, device context, triage workflow)
- **ux_walkthroughs** (guided tours: 4 seeded — dashboard intro, forecast setup, first bank, first report — with step-by-step JSON)
- **ux_announcements** (in-app: 6 types, severity, targeting by plan/industry, display type, CTA, tracking)
- **resource_library** (10 articles seeded: 12 resource types, 10 categories, SEO, helpful voting, featured/pinned)
- **report_templates** (8 system templates seeded: cash flow, weekly summary, monthly forecast, variance, bank fees, FX exposure, board deck, audit-ready)
- **dashboard_quick_links** (per-user pinned page shortcuts)
- **sample_data_sets** (demo data by industry for new accounts)
- **payment_accounts** (virtual accounts: 7 types, balance tracking, daily/single transfer limits)
- **payees** (registered recipients: 6 types, bank/wire details, W-9, verification, total paid tracking)
- **payment_transactions** (core ledger: 8 payment methods, 5 payment types, 11 statuses, approval workflow, status timeline, batch linking)
- **payment_batches** (grouped payments: 5 batch types, approval workflow, processing tracking)
- **recurring_payments** (standing orders: 5 frequencies, auto-scheduling, completion tracking)
- **ui_component_registry** (15 seeded: 7 categories — feedback/navigation/data_display/input/overlay/layout/animation)
- **ui_page_states** (8 seeded: loading/empty/error/offline configs per page with icon/CTA)
- **ui_themes** (3 seeded: Void dark, Daylight light, Midnight OLED — colors/typography/borders/shadows)
- **automation_rules** (if/then engine: 14 trigger types, actions JSON array, scheduling, daily limits, execution tracking)
- **automation_executions** (execution log: trigger context, duration, per-action results, status)
- **changelog_entries** (product changelog: 6 entry types, category, version, markdown body, 4 entries seeded)
- **webhook_subscriptions** (outbound webhooks: HMAC signing, event filtering, retry config, health tracking)
- **webhook_deliveries** (delivery log: status code, response time, retry tracking)
- **opportunities** (16 opportunity types, impact/effort/confidence scoring with auto-calculated priority, financial impact, recommended actions, full lifecycle: new→evaluating→approved→in_progress→captured)
- **opportunity_rules** (6 seeded: idle cash, vendor spend, early payment discount, FX rate, account consolidation, forecast surplus — with trigger conditions + default scores)
- **weaknesses** (16 weakness types, severity/risk/exploitability scoring, remediation plans with step-level tracking, review cycles, estimated fix effort)
- **weakness_scans** (comprehensive scan results: checks run, weaknesses found, new/resolved counts, overall health score)
- **threats** (16 threat types, likelihood×impact risk matrix, velocity, financial exposure min/max/expected, countermeasures, monitoring frequency, trend tracking, escalation workflow)
- **threat_monitors** (11 monitor types: fx/interest rate watch, vendor/bank health, regulatory tracker, market volatility, cyber feed, competitor watch, news sentiment, supply chain, economic indicators)
- **swot_matrix** (periodic SWOT snapshot: O/W/T counts + scores, top items, total opportunity value vs threat exposure, period-over-period delta)
- **audit_programs** (11 program types: internal/external/sox/security/financial/operational/IT/vendor/regulatory/self-assessment/continuous monitoring, scope areas, scheduling, scoring, risk rating, team assignment, budget tracking)
- **audit_checklists** (12 checklist types with items JSON array, 3 templates seeded: cash controls 8 items, payment auth 6 items, access management 5 items — auto-tracked progress/pass rate/completion %)
- **audit_checklist_responses** (per-item: pass/fail/partial/NA with evidence, auto-links to findings on failure)
- **audit_findings** (9 finding types: control deficiency/material weakness/significant deficiency/observation/recommendation/best practice gap/policy violation/regulatory non-compliance/data integrity issue, auto-generated finding numbers, remediation lifecycle, overdue tracking with computed columns)
- **audit_reports** (8 report types: summary/detailed/executive/compliance/remediation/trend/control effectiveness/risk assessment)
- **audit_schedules** (recurring audit calendar with template linking)
- RLS on all 124 tables, service role policies for edge functions

## STRIPE BILLING
- **Account ID:** `acct_1SsLDtFV8yRihVmr`
- **Vaultline Prices:** Starter $499/mo (`price_1TAdoLFV8yRihVmreiDmJaka`), Growth $1,499/mo (`price_1TAdoVFV8yRihVmr3OFQDI5C`), Enterprise $2,499/mo (`price_1TAdogFV8yRihVmrKdDLEbP7`) + annual variants
- **Suite Bundle:** `prod_UA3b3R1jKsqsSJ` — $2,799/mo (`price_1TBjU5FV8yRihVmrrk34Cb7s`), $2,239/mo annual (`price_1TBjU9FV8yRihVmrPzu68UYk`)
- **Coupons:** IpziKERn (referral 20% off), QUcD824w (bundle 15% off 3mo), 9TzkfFJB (annual first month free), lVU7DWny (loyalty $100 off)

## VERCEL DEPLOYMENT
- **Team:** `team_iqEGiHQPSkVOnKYT71yAgB5M` | **Project:** `prj_yYz1pgkkq9fyhgrOI1tyQKc5LFH3`
- **Domains:** `www.vaultline.app`, `vaultline.app`, `vaultline-app.vercel.app`

---

## REACT APP PAGES (57)

### Public Routes (no auth required):
- `/` — Landing page (hero with Recharts demo chart, features, security section, pricing, Suite GTM section, ROI + Assessment CTAs, footer)
- `/login`, `/signup` — Auth pages (signup has password strength meter + trust signals)
- `/forgot-password` — Password reset request (Supabase resetPasswordForEmail, success confirmation)
- `/reset-password` — Password reset completion (strength meter, confirm match, show/hide toggle)
- `/roi` — ROI Calculator (5 sliders, live preview, email capture, personalized results with segment + plan recommendation)
- `/assess` — Treasury Readiness Assessment (9-question quiz, scoring, email capture, readiness report + segment + plan recommendation)
- `/status` — System Status (public, per-service health, 30-day uptime, active/resolved incidents, auto-refresh 60s)
- `/privacy`, `/terms` — Legal
- `/security` — Glassmorphic Trust Center (6-layer interactive security selector, HTTP headers terminal readout, compliance frameworks with progress bars)
- `/products/financeos` — FinanceOS demo (blue/indigo brand, 3 interactive chart panels: Budget vs Actual, Variance Detective, Multi-Entity)
- `/products/parallax` — Parallax demo (amber/stone brand, 3 interactive panels: Compliance Score, Framework Coverage, CAPA Lifecycle)

### Protected Routes (auth required):
- `/dashboard` — Main dashboard with onboarding checklist, cash flow chart (FLOW/CUMUL modes, MA7+EMA14 overlays, interactive legend, high/low/avg), KPIs, print ad banner
- `/position` — Cash Position (THE BENCHMARK: 5 periods, 2 chart modes, per-account toggle legend, SMA-7+EMA-14, pie allocation, high/low/avg)
- `/forecast` — Forecasting (3 models: Linear/EMA/Monte Carlo, FORECAST/BURN toggle, burn donut, interactive legend, confidence bands, high/low/avg, 4 periods, anomaly detection panel)
- `/payments` — AP/AR Payments (3-tab: Overview/Receivables/Payables, net position, invoice/bill tables, cash impact timeline)
- `/transactions`, `/banks`, `/import`, `/reports`, `/scenarios`, `/alerts`, `/currencies`, `/entities`
- `/api`, `/docs`, `/audit`, `/integrations`, `/sso`, `/team`
- `/billing` — Stripe checkout integration
- `/settings` — 5 tabs: Company, Personal, Branding, Notifications, Account (owner-only danger zone with 4-step close account pipeline)
- `/ecosystem` — Suite overview with bundle pricing
- `/suite/financeos`, `/suite/parallax` — Authenticated aliases for product demos

### Key Components:
- Layout (collapsible sidebar, mobile overlay, hamburger menu, page meta), ErrorBoundary (page-level + SectionBoundary), ChartTooltip, GrowthNudge, Paywall, ThemeToggle
- Toast (global context provider with useToast() hook, 4 severity levels, auto-dismiss, progress bar)
- CommandPalette (Cmd+K global search, keyboard nav, 21 indexed pages)
- OnboardingChecklist (4-step setup wizard, progress bar, auto-dismiss, localStorage persistence)
- CustomerJourney (TrialBar, DunningBanner, WinBackBanner, FeatureGate, ValueReinforcement, NPSSurvey, MilestoneBanner)
- NotificationCenter (bell icon with badge, dropdown panel, realtime subscription, 15 notification types, mark read/dismiss)
- useAuth, useTreasury (500 TX + 180 daily balances, 60s polling, visibility refetch, stale detection, realtime subscriptions), useForecastAccuracy (backtesting, MAPE/MAE/RMSE, model recommendation, seasonality, adaptive confidence), useChartTheme, useTheme, useVisibilityRefetch

### Chart Complexity Standard (all 3 primary charts match):
- Period selector (3-4 options), chart mode toggle (2 modes), interactive legend (click to hide/show), SMA/EMA overlays, reference lines, high/low/avg readout, terminal status bar, custom tooltip, empty states
- All period toggles use calendar-date cutoff (not slice-based)

### Error Recovery:
- Page-level ErrorBoundary: zero auto-retry, immediate stable fallback, nav links, support email
- SectionBoundary: inline panel recovery, max 2 retries
- lazyRetry() wrapper on all 30+ page imports (3 retries × 1s delay)

### Security Hardening:
- HSTS 2yr preload, CSP, X-Frame-Options DENY, nosniff, XSS, Referrer-Policy, Permissions-Policy
- MFA hardened useAuth, idle timeout 30min, SIGNED_IN profile update non-critical
- Supabase Security Linter: 0 advisories

---

## DESIGN KITS ABSORBED
- **Kit 4 (SAAS-UIUX-4):** Dot-grid patterns, stacked bars, orange/teal/navy, A4 infographic layouts
- **Kit 5 (SAAS-UIUX-5):** Deep purple gradients, donut charts, glass-morphism rows, area charts with period pills

## DOCUMENTS GENERATED (in /mnt/user-data/outputs/):
- Vaultline-Brand-Guidelines.docx
- Vaultline-Sales-One-Pager.docx
- Vaultline-Information-Security-Policy.docx
- Vaultline-Access-Controls-Policy.docx
- Vaultline-Data-Retention-Policy.docx
- Suite-Design-Blueprint.docx (12-section shared infrastructure standards + brand independence rules)

## PRODUCT ECOSYSTEM (same Stripe account):
- **Vaultline:** Treasury management (this project)
- **FinanceOS:** Cloud FP&A — blue→purple gradient brand, "Fi" icon, landing at financeos-rho.vercel.app
- **Parallax:** Aerospace compliance — amber/stone brand (project `wlufarzeqjkpbqacxeus` on Supabase)
- **Emberglow Advisory:** ESG/sustainability advisory — amber-orange/forest green brand

## RECENT WORK THIS SESSION:
1. Chart competitive gap closure: Dashboard + Forecasting upgraded to match CashPosition (EMA-14, chart mode toggle, interactive legend, high/low/avg, burn donut)
2. Product demo pages moved to PUBLIC routes (/products/financeos, /products/parallax) — accessible from landing page without login
3. FinanceOS rebranded: green→blue/indigo to match actual brand (financeos-icon.png in /public/)
4. Security Trust Center page (/security) — glassmorphic design, interactive 6-layer selector, HTTP headers terminal, compliance progress bars
5. Landing page cleaned: fake testimonials/stats removed, replaced with verifiable capability proofs
6. Hero chart rebuilt: hand-rolled SVG replaced with Recharts ComposedChart (fixed glitching)
7. Period toggle fix: Dashboard + Forecasting now use calendar-date cutoff instead of broken .slice(-N)
8. Account closure pipeline: Settings → Account tab with 4-step offboarding (preview→survey→confirm→done), edge function handles Stripe cancel + prorated refund + deactivation + audit
9. Suite Design Blueprint document (12 sections, shared infra + brand independence)
10. Sitemap updated with /security, /products/financeos, /products/parallax
11. SWOT Analysis document (Vaultline-SWOT-Analysis.docx) — competitive landscape, pipeline assessment, SWOT matrix, tiered strategic recommendations
12. SEO hardening: FAQ structured data (5 questions for Rich Results), sitemap cleanup (removed protected /docs, added lastmod), restored preconnect links
13. AI Forecasting Evolution: anomaly detection engine added to Forecasting.jsx — Z-score detection (2σ/3σ), consecutive decline pattern (5+ days), volatility spike detection (7d rolling vs baseline), anomaly alert panel UI with severity badges, chart anomaly reference lines
14. AP/AR Payments page (/payments): 3-tab layout (Overview, Receivables, Payables), net AR/AP position hero, invoice/bill tables with search+filter, cash impact timeline, status badges, KPIs (outstanding, overdue, collected, DSO), demo data with production-ready structure. Route registered in App.jsx, sidebar added in Layout.jsx, robots.txt updated.
15. Suite Go-To-Market: landing page ecosystem section rebuilt — "The Only Unified Treasury + FP&A + Compliance Platform" headline, per-product feature lists, $2,799/mo bundle CTA with savings callout, annual pricing ($2,239/mo), Contact Sales CTA, footer updated with #suite anchor
16. Global Toast System: Toast.jsx context provider with useToast() hook — 4 severity levels (success/error/warning/info), auto-dismiss with progress bar, slide-in animation, max 5 visible. Wrapped app in ToastProvider in main.jsx.
17. Responsive Sidebar: collapsible sidebar with icon-only mode (persisted to localStorage), mobile overlay with hamburger menu in topbar, backdrop overlay, auto-close on navigation. Collapse toggle button in sidebar footer.
18. Responsive Grids: all grid-cols-4 KPI rows → grid-cols-2 lg:grid-cols-4 across 12 pages (Dashboard, Forecasting, Payments, Alerts, AuditLog, Billing, Ecosystem, Entities, Reports, Transactions, ApiAccess, SuperAdmin). All grid-cols-3 → grid-cols-1 md:grid-cols-3 across 8 pages. Mobile-responsive topbar (hamburger, hidden plan badge), main content padding p-4 sm:p-6 lg:p-8.
19. Forgot Password page (/forgot-password): Supabase resetPasswordForEmail, success confirmation with email display, retry option. Route registered, Login page links to it.
20. Password Strength Indicator: 5-check meter on Signup (length, uppercase, lowercase, digit, special char) with color-coded bars and inline requirement labels.
21. Onboarding Checklist: 4-step setup wizard (Connect bank, Company profile, Invite team, Set alerts) with progress bar, auto-dismiss on completion, localStorage persistence. Wired into Dashboard between welcome bar and KPIs.
22. Loading States: Added loading spinners with contextual messages to Alerts, Scenarios, and Entities pages.
23. Toast Integration: Wired useToast() into Settings (saveOrg, saveProfile), BankConnections (Plaid connect, QB errors, remove errors), and Billing (checkout success/error). Team.jsx swapped from inline toast to global useToast().
24. Reset Password page (/reset-password): Supabase updateUser, password strength meter, confirm match validation, show/hide toggle, toast feedback, auto-redirect to dashboard. Route registered in App.jsx.
25. Cmd+K Command Palette: Global search overlay (Cmd+K / Ctrl+K) with keyboard navigation (↑↓ Enter Escape), fuzzy search across 21 indexed pages, result highlighting, path display. Rendered in Layout.jsx.
26. Forecast Accuracy Engine (useForecastAccuracy.js): Walk-forward backtesting of all 3 models (Linear/EMA/Monte Carlo) against historical actuals. Computes per-model MAPE, MAE, RMSE, bias, and directional accuracy. Auto-recommends best model with weighted scoring (40% MAPE + 30% direction + 30% normalized RMSE). Day-of-week seasonality detection via F-ratio. Adaptive confidence band calibration from actual error distribution (1σ, 2σ, 95th percentile). Minimum 21 data points required.
27. Anomaly Classification Engine (classifyAnomaly in useForecastAccuracy.js): Classifies detected anomalies as payroll_cycle, revenue_collection, month_end_settlement, recurring_pattern, weekend_processing, one_time_event, trend_shift, or volatility_regime. Uses day-of-month heuristics, cross-month recurrence matching (±3 day window), z-score thresholds, and directional analysis. Each classification includes confidence score (40-90%).
28. Model Accuracy Panel UI: 3-column model comparison cards in Forecasting page showing MAPE (color-coded), MAE, directional accuracy, bias, accuracy progress bar. Trophy icon on best model. "Switch" button for recommended model. Seasonality detection display (strongest day-of-week effect). Adaptive calibrated confidence in terminal bar.
29. Enhanced Anomaly Panel: Classification badges on each anomaly (color-coded by type), confidence percentage, upgraded from raw z-score display to labeled categories (Payroll Cycle, Revenue Collection, Month-End Settlement, etc).
30. Copilot AI Enhancement: System prompt expanded with anomaly interpretation and model accuracy guidance. Edge function now queries daily_balances (90 days), runs server-side anomaly detection with classification, adds <anomaly_alerts> and <balance_trend> sections to treasury context. Includes 14-day trend summary and weekly averages.
31. Centralized dailyBalances: Added daily_balances fetch to useTreasury hook (180 days, single query). Forecasting.jsx now uses centralized data instead of separate fetch — eliminates duplicate query, improves cache coherence across Dashboard/Forecasting/CashPosition.
32. Customer Journey Lifecycle (CustomerJourney.jsx — 7 components): TrialBar (countdown with escalating urgency, progress bar, upgrade CTA), DunningBanner (past_due payment alert), WinBackBanner (canceled account reactivation with 30-day data retention countdown), FeatureGate (reusable plan limit overlay), ValueReinforcement (monthly recap: hours saved, transactions reconciled, balance checks, accounts monitored), NPSSurvey (0-10 score with contextual follow-up, 90-day re-survey cycle), MilestoneBanner (usage celebrations: 100/1000 tx, 5/10 accounts, 30/90 days data).
33. Customer Journey Wiring: Layout.jsx — TrialBar + DunningBanner + WinBackBanner between header and main (global). Dashboard.jsx — ValueReinforcement + MilestoneBanner + NPSSurvey after onboarding. BankConnections.jsx — plan limit gate on Add Bank button (shows usage count, upgrade prompt at max). Signup.jsx — trust signal badges (SOC 2 Ready, AES-256, Bank-Grade Security).
34. Full-Stack Pipeline Audit & Build: Identified 13 missing edge functions and 7 missing tables that the frontend was calling into void. Built all of them:
    - **Migration 003** (003_missing_tables.sql): 7 new tables (cash_position, invites, ecosystem_products, qb_connections, accounting_connections, data_imports, fx_watchlist) + growth_events + org columns (closed_at, closure_reason, referral_code, stripe_customer_id, stripe_subscription_id) + indexes + RLS policies
    - **stripe-checkout**: Creates Stripe checkout session with customer get-or-create, promotion codes
    - **stripe-webhook**: Handles 5 event types (checkout.session.completed, subscription.updated, subscription.deleted, invoice.payment_failed, invoice.payment_succeeded) with growth_events + audit_log
    - **team-manage**: 10 actions (invite, bulk_invite, revoke, resend, update_role, remove_member, suspend, reactivate, transfer_ownership, list)
    - **growth-engine**: Dashboard nudges (upgrade, cross-sell, referral, tier-upgrade), referral tracking, cross-sell interest logging
    - **account-close**: 2-step pipeline (preview with refund calc, confirm with Stripe cancel + prorated refund + team deactivation + bank disconnect + growth event + audit log)
    - **fx-rates**: ECB/Frankfurter API — latest rates, 30-day history, per-currency trends (change, pct, high, low)
    - **qb-auth**: QuickBooks OAuth 2.0 initiation with state encoding
    - **qb-sync**: QuickBooks account + transaction sync with token refresh
    - **acct-auth**: Xero/Sage/NetSuite OAuth initiation with provider config
    - **acct-sync**: Xero/Sage data sync with provider-specific token refresh
    - **data-import**: CSV row parsing, manual transaction entry, manual account creation, import history tracking
    - **super-admin**: Admin overview (org stats, growth events, audit), org updates (whitelisted fields), user deactivation
    - **generate-forecast**: Server-side forecast generation — runs all 3 models (Linear/EMA/Monte Carlo), backtests MAPE per model, picks best, calculates confidence/burn/runway, refreshes cash_position aggregate. Supports both authenticated (user-triggered) and unauthenticated (cron) invocation for batch processing all active orgs.
35. Marketing Capture Pipeline:
    - **Migration 004** (004_marketing_pipeline.sql): `leads` table (email, company, segment, score, assessment/ROI data, UTM tracking, lifecycle status) + `resource_views` table (content engagement tracking) + indexes + RLS
    - **lead-capture edge function** (18th function): Lead scoring engine (0-100) based on company size + source intent + job title + assessment answers + ROI inputs. Auto-segments into spreadsheet_dependent (<35) / scaling (35-59) / enterprise_ready (60+). Upsert by email. Admin pipeline_stats endpoint with segment/source/status breakdowns.
    - **ROI Calculator** (/roi): 5-slider interactive calculator (cash managed, bank accounts, hours/week, team size, entities). Live ROI preview (time savings, error reduction, yield optimization, fraud prevention). Email capture gate → personalized results with segment-specific plan recommendation + payback period.
    - **Treasury Readiness Assessment** (/assess): 9-question diagnostic quiz with scored options, auto-advance, progress bar. Email capture gate → readiness score out of max, segment badge, recommended plan with feature list, full answer breakdown.
    - Landing page: hero secondary CTA → "Calculate Your ROI", assessment link below hero, footer resources updated with both tools
    - Sitemap: /roi and /assess at priority 0.9
36. Notification Pipeline (full-stack):
    - **Migration 005** (005_notifications.sql): `notifications` table with 15 alert types, severity levels, multi-channel tracking (in_app/email/slack), read/dismissed state, action deep links, 30-day TTL, indexed for unread queries
    - **notify edge function** (19th function): Alert evaluation engine (low_cash, large_transaction, runway_warning, sync_failure — all checked against notification_settings thresholds), deduplication (24h window), email delivery via Resend API with branded HTML templates, Slack webhook delivery, team invite email template, mark_read/mark_all_read/dismiss actions, evaluate_all batch mode for cron, trial_check for expiring trials (day 3, 1, 0)
    - **NotificationCenter component**: Bell icon with unread badge count, dropdown panel (380px, 30 items), realtime Supabase subscription for instant push, 15 notification types with icons/colors, time-ago display, action deep links, mark-all-read, individual dismiss, click-outside close. Wired into Layout topbar.
    - **Trigger wiring**: stripe-webhook now creates payment_failed + payment_success notifications on invoice events. team-manage now sends invite email via notify function on team invite. generate-forecast now creates runway_warning (critical <6mo) and low_cash (projected <10% within 30d) notifications.

37. Customer Care Pipeline (full-stack):
    - **Migration 006** (006_pipelines.sql): `support_tickets` (9 categories, 4 priorities, 6 statuses, SLA tracking, CSAT), `ticket_messages` (threaded with internal notes), `knowledge_base` (9 categories, public read), `csat_surveys` (5 trigger types, 1-10 score)
    - **support edge function** (20th function): Ticket CRUD (create, list, get, reply, close), SLA breach detection (response + resolution targets by priority), CSAT rating per ticket, knowledge base list/get/vote, generic CSAT submission, admin ticket stats (avg response time, avg resolution time, by category/priority, CSAT average)
    - **Support page** (/support): Ticket list with status/priority/SLA badges, filter by status, create ticket form (subject, body, category, priority), ticket detail with threaded messages, reply, close, CSAT rating for resolved tickets. Added to sidebar under Account.
38. Quality Assurance / Monitoring Pipeline (full-stack):
    - **Migration 006**: `system_health` (10 services, 5 statuses, response time, error rate), `incidents` (4 severities, 5 statuses, timeline tracking), `incident_updates` (threaded), `error_events` (service + type + stack trace), `sync_health` (per-org per-provider data pipeline health)
    - **qa-monitor edge function** (21st function): Public status page data (per-service health, 30-day uptime, active/resolved incidents), `run_checks` cron action (database ping, bank sync staleness check per-org, forecast engine age, FX API health, auto-incident creation on degradation), error logging, error dashboard (admin), incident CRUD (admin), per-org sync health dashboard
    - **StatusPage** (/status, public): Overall status hero, per-service health grid with 30-day uptime %, active incidents with threaded updates, recently resolved incidents. Auto-refreshes every 60s.
39. B2B Partner Pipeline (full-stack):
    - **Migration 006**: `partners` (5 types, 4 tiers, commission/revenue share, API key, webhook URL), `partner_referrals` (full funnel: pending→signed_up→trialing→converted→churned, MRR + commission tracking), `partner_webhooks_log` (delivery audit trail with retry)
    - **partners edge function** (22nd function): Partner CRUD (create, list, update, dashboard), public referral tracking (from partner link), signup attribution, conversion + commission calculation (annual on first-year MRR), commission payment, webhook delivery with audit logging, partner self-service portal (via API key — stats, referral list, commission breakdown)
    - **PartnerAdmin page** (/partner-admin): Overview dashboard (4 KPI cards: partners, referrals, partner MRR, unpaid commissions), partner list with tier badges + referral code copy, referral table with status + MRR + commission + pay action, create partner form (name, type, tier, contact, commission %, webhook). Admin-gated.
40. Corporate Digital Security Pipeline (full-stack):
    - **Migration 008** (008_security_privacy.sql): `security_events` (22 event types, severity, IP/geo/device tracking, resolution workflow), `ip_allowlist` (CIDR-based, per-org), `active_sessions` (user sessions with device/geo, revocation), `security_policies` (per-org: MFA, password rules, session limits, IP restrictions, export controls, audit retention, review cadence), `vulnerability_scans` (5 scan types, findings by severity), `security_score` (overall + 5 sub-scores: auth, access, data, compliance, network)
    - **security-ops edge function** (23rd): Security dashboard (score + threats + events + sessions + scans), security event logging, threat resolution, score calculator (evaluates 20+ policy factors → weighted score + recommendations), policy CRUD (owner-only), IP allowlist CRUD, session management (list, revoke, revoke-all)
    - **SecurityCenter page** (/security-center): Score ring with 5 sub-scores, severity breakdown chart, recommendations panel, recent events timeline, threat queue with resolve action, session list with revoke, policy toggles + number inputs (MFA, password, session, export, classification, retention), IP allowlist management. In sidebar under Platform.
41. Corporate Digital Privacy Pipeline (full-stack):
    - **Migration 008**: `consent_records` (11 consent types, version tracking, grant/revoke with timestamps), `data_subject_requests` (7 DSR types, 6 statuses, GDPR/CCPA/PIPEDA/LGPD regulation, 30-day SLA, audit trail, data export), `data_processing_records` (Article 30 register: 7 legal bases, data categories, recipients, third-country transfers, retention, DPIA flags — pre-seeded with 7 Vaultline processing activities), `privacy_impact_assessments` (risk levels, mitigations, DPO opinion), `data_retention_policies` (automated lifecycle: delete/anonymize/archive with day thresholds — pre-seeded with 9 policies)
    - **privacy-ops edge function** (24th): Privacy dashboard (DSR queue + consent stats + processing register + retention policies + DPIAs), consent record/revoke, user consent viewer, public DSR submission (no auth), DSR status workflow with audit trail, Article 30 register CRUD, retention enforcement (cron: auto-deletes expired data per policy), full user data export (for access/portability DSR fulfillment — gathers profile, transactions, accounts, messages, audit, consents into JSON)
    - **PrivacyCenter page** (/privacy-center): 4-KPI overview (open DSRs, processing activities, consent records, retention policies), overdue DSR alert banner, consent breakdown with progress bars, DSR management with status dropdown + data export button, consent type grid with grant rates, Article 30 processing register (legal basis, data categories, subjects, recipients, retention, DPIA flags), retention policy dashboard with manual enforcement trigger. In sidebar under Platform.
42. Digital Customer Navigation Pipeline (full-stack):
    - **Migration 009** (009_navigation_memory.sql): `page_views` (path, time-on-page, scroll depth, interactions, device, UTM, entry/exit), `feature_events` (6 action types, context), `navigation_flows` (session-level: entry→exit, path sequence, duration, features used), `onboarding_progress` (step tracking with timing), `engagement_scores` (daily 0-100: login streak + pages + features + time + actions → churn risk)
    - **navigation edge function** (25th): Page view tracking, batch ingestion, feature events, onboarding steps, session close (sendBeacon), engagement scoring cron (calculates daily scores for all active users with churn risk classification: low/medium/high/critical), admin analytics dashboard (top pages, top features, session stats, churn risk breakdown, onboarding completion rate)
    - **useNavigation hook**: Drop-in — one call in Layout, auto-tracks every page transition. Measures time-on-page, scroll depth (max %), interaction count (clicks + inputs). Uses sendBeacon on unload for reliable delivery. Generates stable session ID per tab.
    - **trackFeature() / trackOnboarding()**: Fire-and-forget helper functions callable from any component. Imported in Layout for copilot tracking.
    - Wired: `useNavigation()` called in Layout.jsx — every authenticated page transition auto-tracked with zero config.
43. Digital Memory / Autosave Pipeline (full-stack):
    - **Migration 009**: `user_drafts` (11 draft types, versioned, 30-day expiry, type+key dedup), `user_preferences` (persistent UI state: 15+ fields for dashboard/forecast/chart/sidebar/theme/density/pins/recents), `session_snapshots` (page state + scroll + tab + modal + form data, 24h TTL), `undo_history` (operation type, entity type/id, previous/new state, 7-day TTL)
    - **memory edge function** (26th): Draft CRUD (save/get/list/delete/restore with auto-versioning), preferences (get/save/merge for partial jsonb updates), session snapshots (save/get for crash recovery), undo/redo (push/undo/redo with session scoping), cleanup cron (purge expired snapshots + drafts + undo entries)
    - **useAutosave hook**: Debounced auto-save (2s default), draft recovery check on mount (hasDraft → restore/discard), version tracking, saving indicator. Wired into Support ticket create form.
    - **usePreferences hook**: Load/save user preferences, mergePref for page-specific state.
    - **useUndo hook**: pushUndo/undo/redo backed by Supabase undo_history table.
    - **useSessionSnapshot hook**: Periodic crash recovery snapshots (30s interval), snapshot detection on mount.
44. Digital Layout & Functions Pipeline (full-stack):
    - **Migration 010** (010_layout_tools_time_marketing.sql): `dashboard_layouts` (per-user per-page widget arrangement), `widgets` (15 seeded across 8 categories, plan-gated), `saved_views` (per-page filter/sort/column configs, shareable), `keyboard_shortcuts` (custom shortcut mappings)
    - **layout-ops edge function** (27th): Widget registry, layout get/save/reset per page, saved views CRUD with org-sharing, keyboard shortcuts CRUD. Supports preset layouts (default, compact, executive, analyst, custom).
45. Interactive Tools Pipeline (full-stack):
    - **Migration 010**: `interactive_tools` (6 seeded tools: ROI Calculator, Treasury Assessment, Treasury Benchmark, Burn Rate Simulator, TMS Comparison, Cash Flow Planner), `tool_submissions` (inputs/results with lead linking, completion tracking)
    - **tools edge function** (28th): Tool registry (list published, get config, increment views), submission capture with lead linking, treasury benchmark engine (8 industry metrics with percentile scoring and overall score), burn rate simulator (multi-scenario runway projection with 24-month monthly projections), tool analytics dashboard
    - **Benchmark page** (/benchmark, public): 8-metric slider input, email capture, percentile scoring against industry medians with visual bars, per-metric rating (excellent/good/below_average/needs_improvement), overall score, CTA to trial
    - **BurnSimulator page** (/burn-simulator, public): 3 core sliders (cash, revenue, expenses), 5 default + custom scenarios, live runway preview, multi-scenario results with monthly projections, re-simulate loop, CTA to trial
46. Time Management & Timezone Pipeline (full-stack):
    - **Migration 010**: `scheduled_tasks` (9 task types, 7 recurrence patterns, timezone-aware scheduling, notification config), `task_completions` (duration, notes, skip flag), `timezone_configs` (primary timezone, display format, business hours, fiscal calendar, multi-timezone), `time_entries` (9 categories, billable flag, task linking)
    - **time-ops edge function** (29th): Task dashboard (overdue, due today, time breakdown), task CRUD with auto-calculated next_due_at, task completion with recurrence auto-advance, timezone config (business hours, fiscal year start), time entry logging, time list with filters, task reminder cron (notifies via notifications table)
    - **TimeManager page** (/time): Live timer bar with category + start/stop, task list with overdue highlighting + complete button, create task form (type, recurrence, date/time), time breakdown by category (7-day), timezone/calendar config (timezone, format, week start, fiscal year, business hours). In sidebar under Operations.
47. Graphic Marketing Pipeline (full-stack):
    - **Migration 010**: `brand_assets` (12 asset types, seeded with Vaultline colors + typography), `marketing_campaigns` (9 campaign types, segment targeting, budget/spend/ROI, UTM tracking, performance metrics), `marketing_content` (12 content types, status workflow: draft→review→approved→published, SEO fields, performance), `social_calendar` (8 platforms, scheduled/published status, engagement tracking)
    - **marketing-ops edge function** (30th): Brand kit retrieval + asset management, campaign CRUD (create, list, update with whitelisted fields), content CRUD (create, list, update, filter by campaign/type/status), social calendar (list events, schedule posts), marketing dashboard (4 KPIs: campaigns/leads/spend/revenue + ROI, lead source breakdown, content type breakdown, upcoming posts)
    - **MarketingHub page** (/marketing): Dashboard tab (4 KPIs, lead sources chart, content type chart, upcoming posts), Campaigns tab (list with status/type/segment badges, performance metrics), Content tab (list with type/status/channel/views/clicks), Brand tab (color palette swatches + typography display), Calendar tab (upcoming scheduled posts). In sidebar under Account. Campaign + content creation forms inline.
48. Digital Legal Pipeline (full-stack, inspired by Netflix DNSSPI):
    - **Migration 011** (011_legal_pipeline.sql): `legal_documents` (versioned legal text with slug, jurisdiction, regulation tagging, superseded chain), `legal_acceptances` (who accepted which version, with IP/UA/method, withdrawal support), `cookie_preferences` (per-visitor: 5 categories — essential/functional/analytics/advertising/social, GPC detection + honoring), `privacy_rights_requests` (11 request types including do_not_sell/share/targeted_ads + GDPR rights, 8 US state regulations + GDPR/PIPEDA/LGPD, verification workflow, fulfillment tracking, appeal process, audit trail), `dnsspi_optouts` (Do Not Sell or Share registry: sale/sharing/targeted ads/profiling/matched identifiers, GPC signal flag, jurisdiction tracking), `subprocessors` (Article 28 register: 8 Vaultline processors seeded with DPA/certification data), `regulatory_compliance` (per-requirement tracking: 30 CCPA + GDPR requirements seeded with compliance status)
    - **legal-ops edge function** (31st): Legal document retrieval (get by slug + version, list active, version history), acceptance recording + withdrawal, cookie preferences (get/save with GPC auto-disable of advertising), DNSSPI opt-out (records sale/sharing/targeted ads opt-out, cascades to cookie prefs + consent records + audit log), DNSSPI status check, privacy rights request submission (public, no auth, auto-calculates deadline per regulation), request status checker, subprocessor list (public), admin compliance dashboard (per-regulation compliance %, open rights requests, DNSSPI opt-out count, document inventory), compliance status updates
    - **LegalCenter page** (/legal, public): 5-tab portal — Privacy Rights (7 request types with radio selector, regulation picker with deadline display, submission + confirmation), Do Not Sell/Share (Netflix-style DNSSPI form with opt-out scope explanation, GPC detection badge, email opt-out), Cookie Preferences (5-category toggles with GPC auto-disable, accept all / reject all / save), Subprocessors (8 processors with location + transfer mechanism + certifications), Legal Documents (links to ToS/Privacy/Security + dynamic docs from DB with version history)
    - Footer: "Do Not Sell or Share" link added (CCPA §1798.135 requires homepage link), "Legal & Privacy Center" link added
    - Sitemap: /legal at priority 0.8
49. Industry Diversity Acceptance Digital Onboarding & Marketing Pipeline (full-stack):
    - **Migration 012** (012_industry_intelligence.sql): `industry_profiles` (12 verticals seeded with custom onboarding steps, default categories, regulations, KPIs, pain points, value props, terminology overrides), `org_industry_config` (per-org industry selection with sub-vertical, company size, revenue range, KYB/risk tier, DPA tracking, onboarding score), `industry_content` (vertical-specific marketing: 12 content types, persona targeting, funnel stage), `diversity_metrics` (monthly snapshot: industries represented, geographic regions, company size breakdown, optional DEI self-reporting)
    - **industry-ops edge function** (32nd): Industry profile listing (12 verticals, tier-filtered), org industry config get/set/update, industry-specific onboarding (custom steps from profile, progress tracking, terminology delivery, onboarding score calculation), industry content retrieval by vertical/type/funnel stage, diversity metrics calculation (cron: industry breakdown, company sizes, geographic regions) and retrieval
    - **IndustryHub page** (/industry): Setup tab (12-vertical grid selector with icons/colors/tiers, company size selector), Onboarding tab (industry-specific steps with progress bar, terminology display), Content tab (value props and pain points from vertical profile, key metrics), Diversity tab (customer diversity dashboard: total orgs, industries represented, geographic regions, target tracking). In sidebar under Account.
50. Digital Data Intelligence Pipeline (full-stack):
    - **Migration 012**: `data_sources` (10 source types, connection health, quality score, completeness/accuracy/freshness, field mapping), `data_quality_rules` (11 rule types: completeness/uniqueness/validity/consistency/timeliness/accuracy/range/pattern/cross-field/duplicate/anomaly, condition schema, severity, auto-fix), `data_quality_issues` (violation tracking: severity, affected records, financial impact, resolution workflow), `data_insights` (AI-generated: 12 insight types including anomaly/trend/correlation/forecast deviation/cost optimization/cash pattern/vendor analysis/seasonal/risk signal/benchmark/duplicate payment/categorization suggestion, confidence scoring, recommended actions, lifecycle with feedback), `data_lineage` (source→destination field mapping with transformation type + logic), `intelligence_reports` (8 report types: daily/weekly/monthly digests, anomaly/quality/trend/risk/benchmark reports)
    - **data-intel edge function** (33rd): Data intelligence dashboard (source health, quality issues, AI insights, reports), data source listing + quality scoring update, quality issue tracking (list/resolve/ignore), quality rules CRUD + execution (completeness checks on null fields, timeliness checks on stale sources), AI insight generation (cron: scans for degraded sources, low quality scores, open issue accumulation — generates risk signals + anomaly alerts + optimization suggestions), insight lifecycle management (view/acknowledge/act/dismiss with helpful/unhelpful feedback), data lineage retrieval by destination table/field, intelligence report listing + detail
    - **DataIntelligence page** (/data-intelligence): Overview tab (4 KPIs: sources/quality/issues/insights, new insight cards with acknowledge/dismiss, quality breakdown by severity), Sources tab (per-source health card: status badge, quality score gauge, completeness/accuracy bars, field mapping ratio, last sync), Quality tab (issue list), Insights tab (full insight cards: severity badge, type, confidence, description, recommended action, financial impact, thumbs up/down feedback), Lineage tab (visual data flow explanation), Reports tab (intelligence report list). In sidebar under Account.
51. Customer Cash Visibility Pipeline (full-stack):
    - **Migration 013** (013_cash_ux_resources.sql): `cash_positions_realtime` (intraday per-account: ledger/available/pending/projected EOD, minimum/target/sweep thresholds, stale/below-minimum flags, source + refresh frequency), `cash_concentration` (sweep/pool/ZBA/target/threshold rules with source/dest accounts, trigger type + threshold, execution tracking, notifications), `liquidity_buffers` (7 buffer types with required vs current amount, funded %, alert threshold, status classification), `cash_visibility_snapshots` (daily consolidated: total cash/available/pending, by-account/entity/currency breakdown, data completeness %)
    - **cash-visibility edge function** (34th): Real-time dashboard (total cash, available, pending in/out, projected EOD, stale count, below-minimum count, per-account positions, liquidity buffers summary, concentration rules, 30-day trend), position refresh with threshold checking + auto-notification on breach, threshold config, concentration rule CRUD (sweep/pool/ZBA/target balance), liquidity buffer CRUD (funded % auto-calculation, status classification: funded/underfunded/critical/excess), daily snapshot cron
    - **CashVisibility page** (/cash-visibility): 5-KPI header (total cash, available, pending in, pending out, projected EOD), alert banners for below-minimum and stale connections, Positions tab (per-account cards with balance breakdown, threshold display, stale/below-min badges), Sweep Rules tab (concentration rule list with type/trigger/execution count), Buffers tab (per-buffer cards with funded % bar and status badge), Trend tab (30-day Recharts area chart: total cash vs available). In sidebar under Treasury.
52. UI/UX Refinement Pipeline (full-stack):
    - **Migration 013**: `ux_preferences` (per-user: accessibility — reduced motion/high contrast/font size/dyslexia font/screen reader hints; display — color mode/accent/chart palette/number abbreviation; navigation — default landing/sidebar width/breadcrumbs/page descriptions; tables — rows per page/sticky headers/column borders; notifications — sound/desktop; guided help — tooltips/feature badges/completed walkthroughs), `ux_feedback` (7 types: bug/feature/usability/praise/confusion/performance/other, 1-5 rating, device context, triage workflow), `ux_walkthroughs` (4 seeded: dashboard intro, forecast setup, first bank, first report — step-by-step JSON with target element/title/body/position), `ux_announcements` (6 types, severity, plan/industry targeting, display type, CTA, view/click/dismiss tracking)
    - **ux-ops edge function** (35th): UX preferences get/save (22+ fields), feedback submission + listing, walkthrough registry + completion tracking (marks walkthrough IDs in user prefs), announcement listing (active, published, date-filtered)
    - **UXCenter page** (/ux): Preferences tab (accessibility toggles: motion/contrast/dyslexia/screen reader + font size selector; display: color mode picker + chart palette selector + toggle switches for abbreviation/breadcrumbs/tooltips/feature badges), Feedback tab (type selector with icons + title/description/rating form + feedback history list with status badges), Walkthroughs tab (4 guided tour cards with step count, target page, completed badge), Announcements tab (announcement cards with type/severity badges, CTAs). In sidebar under Account.
53. Customer Dashboard Resources Pipeline (full-stack):
    - **Migration 013**: `resource_library` (10 articles seeded: 12 resource types, 10 categories, SEO, thumbnail/video/download URLs, helpful voting, featured/pinned, view counting), `report_templates` (8 system templates seeded: daily cash, weekly summary, monthly forecast, variance analysis, bank fees, FX exposure, board deck, audit-ready — with config JSON for columns/charts/periods), `dashboard_quick_links` (per-user pinned page shortcuts with label/URL/icon/color/position), `sample_data_sets` (demo data by industry)
    - **resources edge function** (36th): Resource library (search/filter by type/category, view counting, helpful yes/no rating), report templates (list/use with usage counting + last used tracking), quick links CRUD (add/remove with auto-positioning), sample data listing, dashboard hub (combined: featured resources + system templates + user quick links + active announcements)
    - **ResourceHub page** (/resources): Overview tab (quick links bar, featured guides grid, report template cards, announcements), Library tab (search bar + category filter + resource list with type/category/views/featured badges), Templates tab (8 template cards with type/format/period/plan/usage count), Quick Links tab (pinned links list with remove + suggested pages to pin). In sidebar under Account.
54. Customer Payments & Financials Pipeline (full-stack, bank-account-like):
    - **Migration 014** (014_payments_uiux_automation.sql): `payment_accounts` (7 account types: operating/payroll/tax_reserve/savings/escrow/petty_cash/investment, balance tracking, daily/single transfer limits), `payees` (6 types with bank/wire details, W-9 tracking, verification, cumulative paid), `payment_transactions` (core ledger: 8 payment methods — ACH/wire/internal/check/card/RTP/SEPA/SWIFT, 5 payment types, 11 statuses with timeline, multi-level approval, batch linking, idempotency), `payment_batches` (5 batch types: payroll/vendor_pay/tax/intercompany/custom, approval + processing), `recurring_payments` (5 frequencies, auto-scheduling, completion tracking)
    - **payment-hub edge function** (37th): Dashboard (accounts + recent tx + pending approvals + top payees + recurring + batches), payee CRUD, send payment (auto-generates reference, checks single + daily limits, auto-requires approval for ≥$10K, builds status timeline, updates payee stats), approve/reject with audit trail, recurring payment creation, transaction history with status/method/date filtering
    - **PaymentHub page** (/payment-hub): Bank-like account cards (balance, available, pending, daily limit bar), send payment form (payee select, amount, method, memo, auto-approval warning), 5 tabs — Overview (recent transactions with status badges), Approvals (pending list with approve/reject buttons, admin-only), Payees (top payees with cumulative paid), Recurring (standing orders with next date + total paid), History (full transaction log). In sidebar under Treasury.
55. UI/UX Improvements Pipeline (full-stack):
    - **Migration 014**: `ui_component_registry` (15 seeded components across 7 categories: skeleton/empty_state/error_boundary/toast/modal/command_palette/breadcrumb/data_table/chart_tooltip/progress_bar/badge/dropdown_menu/sheet/confetti/step_wizard), `ui_page_states` (8 seeded configs: loading/empty/error/offline for dashboard, transactions, alerts, reports, forecast, support), `ui_themes` (3 seeded: Void dark default, Daylight light, Midnight OLED — full color/typography/shadow definitions)
    - **ui-ops edge function** (38th): Component registry listing, page state retrieval (by page + state type), theme listing, design system dashboard (components by category, page states by page, theme inventory)
    - **DesignSystem page** (/design-system): Overview tab (4 KPIs + components by category), Components tab (15 component cards with category/description/pages used), States tab (pages with their configured state types), Themes tab (3 theme cards with color swatches + typography). In sidebar under Platform.
56. Changes & Information Automation Pipeline (full-stack):
    - **Migration 014**: `automation_rules` (14 trigger types: transaction_created/balance_threshold/forecast_deviation/payment_due/sync_completed/sync_failed/report_generated/alert_triggered/invoice_overdue/user_login/scheduled/webhook_received/manual, actions JSON array, daily execution limits), `automation_executions` (per-execution log: trigger context, duration, per-action results), `changelog_entries` (6 entry types, category, version, markdown, 4 entries seeded for v1.0-v1.3), `webhook_subscriptions` (outbound: HMAC signing, event filtering, retry config, health tracking), `webhook_deliveries` (delivery log with status code, response time, retry tracking)
    - **automation edge function** (39th): Dashboard (rules + executions + webhooks + changelog), rule CRUD (create/update/toggle/delete), rule execution engine (runs 4 action types sequentially: notify → creates notification, categorize → updates transaction, webhook → HTTP POST with signing, tag → applies label; logs per-action results), webhook CRUD (auto-generates HMAC secret), webhook delivery log, changelog listing, daily limit reset (cron)
    - **AutomationCenter page** (/automation): Rules tab (rule cards with trigger type/action count/execution count, enable/disable toggle, delete), Executions tab (execution log with status/actions/duration), Webhooks tab (subscription list with URL/events/delivery stats/failure count), Changelog tab (version cards with entry type badges). Rule creation form with trigger type selector + action builder (add multiple actions). In sidebar under Platform.
57. Warm Light Theme Pipeline (visual):
    - **useTheme.js LIGHT_VARS** — Complete warm palette rebuild: backgrounds from cold slate (#F8FAFC/#F1F5F9) to warm cream (#FFFBF5/#FFF7ED), borders from cold slate-gray to warm sand (rgba(180,140,100)), text from cold blue-gray (#0F172A/#475569) to warm ink (#1C1410/#5C4E42), primary cyan from cold #0891B2 to warm teal #0E9AAA. Full glass system warm-tinted (warm shadows, sand borders, cream inputs). 6 new warm-exclusive CSS variables: `--warm-gradient-sidebar` (cream→peach vertical gradient), `--warm-gradient-header` (teal→amber→coral subtle tint), `--warm-gradient-kpi` (teal→purple gradient tint), `--warm-accent-line` (rainbow: teal→amber→coral), `--warm-card-shadow` (warm sand shadow), `--warm-sidebar-active` (warm teal highlight). All warm vars set to transparent/none in dark mode so they don't affect dark theme.
    - **globals.css** — 7 new warm-mode CSS classes: `.warm-accent-top` (3px rainbow gradient bar across top of entire app), `.warm-sidebar` (cream-to-peach vertical gradient on sidebar), `.warm-header-bg` (subtle multi-color header gradient tint), `.warm-kpi` (gradient-tinted KPI cards with warm shadow), `.warm-divider` (rainbow section divider at 30% opacity), `.warm-scroll` (warm sand scrollbar thumbs), `.warm-selection` (warm teal text selection highlight)
    - **Layout.jsx** — Warm classes wired conditionally on `!isDark`: `warm-accent-top` on main flex container, `warm-sidebar` on sidebar aside, `warm-header-bg` on header, `warm-divider` below header. All classes are no-ops in dark mode (vars resolve to none/transparent).
58. Opportunity Automation Pipeline (full-stack):
    - **Migration 015** (015_swot_automation.sql): `opportunities` (16 types: idle_cash_optimization/vendor_renegotiation/payment_timing/fx_arbitrage/credit_line_utilization/early_payment_discount/account_consolidation/investment_yield/cost_reduction/revenue_acceleration/process_automation/market_expansion/product_upsell/partnership/compliance_advantage/custom, auto-calculated priority_score from impact×confidence×(100-effort), financial impact + time-to-value, full lifecycle), `opportunity_rules` (6 seeded detection rules with trigger conditions + default scoring)
    - **opportunity-engine edge function** (40th): Dashboard (pipeline value, status/type breakdown, captured value), opportunity create/update with lifecycle management, automated scanning cron (idle cash detection from cash_positions_realtime — flags balances >150% of target with estimated yield at 4.5%, data quality improvement detection from data_sources field mapping gaps), SWOT matrix snapshot cron (aggregates O/W/T counts + scores + top items + financial summaries across all orgs)
    - **OpportunityCenter page** (/opportunities): 4 KPIs (pipeline value, active count, captured value, avg priority), creation form (title + value + description + impact/effort/confidence sliders), Pipeline tab (priority-sorted cards with AI-detected badges, lifecycle buttons: Evaluate→Approve→Capture→Decline, financial value display), Captured tab (captured opportunities with value), Rules tab (6 detection rules with status). In sidebar under Platform.
59. Weakness Automation Pipeline (full-stack):
    - **Migration 015**: `weaknesses` (16 types: data_quality_gap/process_manual/single_point_failure/skill_gap/technology_debt/compliance_gap/security_vulnerability/forecast_inaccuracy/reconciliation_delay/reporting_lag/vendor_concentration/bank_concentration/integration_missing/documentation_gap/audit_finding/capacity_constraint/custom, severity/risk/exploitability scoring, remediation plan with step-level tracking, review cycles), `weakness_scans` (scan results with checks run, weaknesses found, new/resolved counts, overall health score)
    - **weakness-engine edge function** (41st): Dashboard (open/critical/high counts, avg risk, total exposure, severity/category/type breakdowns), weakness create/update with remediation workflow (open→acknowledged→in_progress→resolved/mitigated/accepted), comprehensive automated scan cron (4 checks: data source quality <50% → data_quality_gap, <2 sources connected → integration_missing, sources in error state → single_point_failure, security score <60 → security_vulnerability — each creates weakness with auto-severity + risk score + fix estimate + affected areas), scan history with health scoring
    - **WeaknessCenter page** (/weaknesses): 4 KPIs (open, critical, avg risk, exposure), severity breakdown bar (critical/high/medium/low colored segments), creation form (title + severity + description + affected areas), Overview/Open tabs (severity-sorted cards with category badges, remediation workflow buttons: Ack→Fix→Resolve/Accept), Scans tab (scan history with health scores + checks/found/new/resolved metrics). In sidebar under Platform.
60. Threat Automation Pipeline (full-stack):
    - **Migration 015**: `threats` (16 types: market_volatility/interest_rate_change/fx_adverse_movement/counterparty_risk/regulatory_change/competitor_action/cyber_attack/fraud_attempt/vendor_failure/bank_instability/economic_downturn/supply_chain_disruption/talent_loss/technology_obsolescence/compliance_deadline/geopolitical/custom, likelihood×impact risk matrix with auto-calculation, velocity, financial exposure min/max/expected, countermeasures with status + effectiveness, monitoring frequency + trend tracking, escalation workflow), `threat_monitors` (11 monitor types), `swot_matrix` (periodic SWOT snapshot: O/W/T counts, health/opportunity/risk scores, top items, total value vs exposure, period delta)
    - **threat-engine edge function** (42nd): Dashboard (active/escalated/worsening counts, total exposure, avg risk, category/likelihood breakdowns, SWOT trend history), threat create/update with auto risk scoring (likelihood×impact lookup tables → 0-100), automated scanning cron (3 detectors: data source failures → vendor_failure threat, cash below minimum → counterparty_risk threat, ≥5 high/critical weaknesses → systemic technology_obsolescence threat; plus trend updater: aging high-risk threats auto-set to worsening), escalation workflow, countermeasure tracking
    - **ThreatCenter page** (/threats): 4 KPIs (active, avg risk, escalated, exposure), creation form (title + loss + likelihood/impact/category selectors), Active tab (risk-sorted cards with score badge, category/type/trend/velocity labels, escalation + mitigate + accept buttons, countermeasure count), Risk Matrix tab (5×5 likelihood×impact grid with heat coloring, threat dots plotted in cells), Monitors tab (active feed monitors with check/threat counts), SWOT Trend tab (period-over-period cards with O/W/T counts + health scores + financial summaries). In sidebar under Platform.
61. Audit Pipeline with Digital Woman Brand Illustration (full-stack):
    - **Migration 016** (016_audit_pipeline.sql): `audit_programs` (11 program types with scope areas, scheduling, scoring, risk rating, team, budget tracking), `audit_checklists` (12 types, items as JSON array with question/category/risk_weight/evidence_required/help_text, auto-tracked progress/pass/fail/NA counts + completion % + pass rate, 3 templates seeded: Cash Controls 8 items, Payment Authorization 6 items, Access Management 5 items), `audit_checklist_responses` (per-item pass/fail/partial/NA with evidence URL/type, auto-links to findings), `audit_findings` (9 finding types: control_deficiency/material_weakness/significant_deficiency/observation/recommendation/best_practice_gap/policy_violation/regulatory_non_compliance/data_integrity_issue, auto-generated finding numbers F-YYYY-NNNN, severity/risk/likelihood/impact/root cause, remediation lifecycle with due dates, computed days_open + overdue columns), `audit_reports` (8 report types), `audit_schedules` (recurring calendar with template linking)
    - **audit-ops edge function** (43rd): Dashboard (programs, findings by severity/status, checklists, templates, schedules, pass rate, avg days open), program CRUD (11 types, auto-count findings), checklist creation + template cloning from 3 seeded templates, item-level response engine (pass/fail/partial/NA → auto-updates checklist progress + pass rate, auto-creates finding with severity from risk_weight on failure, auto-transitions checklist status in_progress→completed), finding CRUD (create with auto-numbering, update remediation lifecycle: open→remediation_planned→in_remediation→verification→closed), automated health check cron (notifies remediation owners of overdue findings, alerts on upcoming scheduled audits within 7 days), checklist detail view with full response map
    - **AuditCenter page** (/audit-center): **Digital Woman SVG Hero Illustration** — inline SVG (280×200) featuring a woman with glasses reviewing a clipboard document with checkmarks, magnifying glass with verification check, mini bar chart, and shield compliance badge. Theme-aware (adapts colors for dark/light mode). Accessible with full alt text. Hero section shows illustration alongside headline + status badges (pass rate, open findings, overdue count). 5 KPIs (programs, checklists, open findings, critical, avg days open). Overview tab (severity breakdown, 3 template cards with "Start Audit" button, recent findings). Programs tab (program cards with status/type/findings/score/risk rating, creation form). Checklists tab (clickable cards with progress bars → drill into interactive checklist with pass/fail/partial/NA buttons per item, auto-finding creation on fail). Findings tab (severity-sorted cards with finding number/type/status/days open/overdue badge, remediation workflow buttons: Plan Fix→Verify→Close, creation form). Schedules tab (upcoming audit calendar). In sidebar under Compliance.

## PENDING ITEMS:

### Launch Blockers (credentials needed):
- Google OAuth (needs Google Cloud Console setup)
- Plaid production approval (in review)
- Intuit production keys (qb-auth/qb-sync ready, waiting on credentials)
- Xero/Sage production keys (acct-auth/acct-sync ready)
- Resend API key (sign up at resend.com, verify vaultline.app domain) — enables email delivery
- Stripe webhook endpoint registration in Stripe Dashboard

### Infrastructure:
- Supabase cron: `generate-forecast` daily 4am, `notify evaluate_all` hourly, `notify trial_check` daily 9am, `qa-monitor run_checks` every 5 min, `privacy-ops enforce_retention` weekly Sunday 2am, `navigation calculate_engagement` daily 11pm, `memory cleanup` daily 3am, `time-ops send_reminders` every 15 min, `industry-ops calculate_diversity` monthly 1st 6am, `data-intel generate_insights` daily 5am, `data-intel run_checks` every 6 hours, `cash-visibility daily_snapshot` daily 11:30pm, `automation reset_daily_limits` daily midnight, `opportunity-engine scan` daily 6am, `opportunity-engine swot_snapshot` weekly Monday 7am, `weakness-engine scan` daily 6:30am, `threat-engine scan` daily 7am, `audit-ops health_check` daily 8am
- SOC 2 Type II formal audit (architecture ready, $30-80K budget)
- SEO submission (Rich Results Test + Search Console sitemap) — READY TO EXECUTE

### Product:
- AI: self-learning pattern adaptation (auto-adjust model weights from rolling accuracy)
- Knowledge base: seed initial help articles for 9 categories
- SAAS UI:UX 6 kit (not yet uploaded)
- Parallax brand assets
- Carbon/Emberglow demo dashboard

### Resolved this session:
- ~~NPS survey~~ → Wired to support edge function (submit_csat)
- ~~Settings notification wiring~~ → Reads from/saves to notification_settings table with full threshold UI
- ~~FeatureGate: Copilot~~ → Daily message limit (Starter: 20, Growth: 100, Enterprise: unlimited)
- ~~FeatureGate: Reports~~ → Monthly export limit (Starter: 5, Growth: 50, Enterprise: unlimited)
- ~~FeatureGate: Forecasting~~ → Model gating (Starter: Linear only, Growth+: EMA + Monte Carlo)
- ~~Payments demo data~~ → Live Supabase queries with demo fallback + invoices/payables tables (Migration 007)

## TO DEPLOY:
```bash
# Apply migration
supabase db push

# Deploy all 43 edge functions
for fn in stripe-checkout stripe-webhook team-manage growth-engine account-close fx-rates qb-auth qb-sync acct-auth acct-sync data-import super-admin copilot generate-forecast plaid-link plaid-exchange plaid-sync lead-capture notify support qa-monitor partners security-ops privacy-ops navigation memory layout-ops tools time-ops marketing-ops legal-ops industry-ops data-intel cash-visibility ux-ops resources payment-hub ui-ops automation opportunity-engine weakness-engine threat-engine audit-ops; do
  supabase functions deploy $fn
done

# Set secrets
supabase secrets set \
  STRIPE_SECRET_KEY=sk_... \
  STRIPE_WEBHOOK_SECRET=whsec_... \
  ANTHROPIC_API_KEY=sk-ant-... \
  INTUIT_CLIENT_ID=... \
  INTUIT_CLIENT_SECRET=... \
  XERO_CLIENT_ID=... \
  XERO_CLIENT_SECRET=... \
  ADMIN_EMAILS=malikfrazier35@yahoo.com,financialholdingllc@gmail.com \
  RESEND_API_KEY=re_...

# Frontend
cd ~/Downloads/vaultline-app && npm install && vercel --prod
```

## ACCOUNTS:
- `malikfrazier35@yahoo.com` (email, owner, org "VAULTLINE", referral_code: VL-D9D866)
- `financialholdingllc@gmail.com` (google, owner, referral_code: VL-821A02)
