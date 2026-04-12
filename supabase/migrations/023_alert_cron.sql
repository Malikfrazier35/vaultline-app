-- ═══════════════════════════════════════════════════
-- 023: pg_cron for automated alert evaluation
-- ═══════════════════════════════════════════════════

-- Enable extensions (may already be enabled)
create extension if not exists pg_cron;
create extension if not exists pg_net;

-- Schedule alert evaluation every 6 hours
select cron.schedule(
  'evaluate-alerts-6h',
  '0 */6 * * *',
  $$
  select net.http_post(
    url := 'https://cosbviiihkxjdqcpksgv.supabase.co/functions/v1/notify',
    headers := '{"Content-Type": "application/json", "Authorization": "Bearer eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.placeholder"}'::jsonb,
    body := '{"action":"evaluate_all"}'::jsonb
  );
  $$
);

-- NOTE: Replace the Authorization Bearer token above with your actual
-- SUPABASE_SERVICE_ROLE_KEY from Project Settings -> API -> service_role key.
-- The placeholder will NOT work. Run this after replacing:
--
-- select cron.schedule(
--   'evaluate-alerts-6h',
--   '0 */6 * * *',
--   $$
--   select net.http_post(
--     url := 'https://cosbviiihkxjdqcpksgv.supabase.co/functions/v1/notify',
--     headers := jsonb_build_object(
--       'Content-Type', 'application/json',
--       'Authorization', 'Bearer YOUR_SERVICE_ROLE_KEY_HERE'
--     ),
--     body := '{"action":"evaluate_all"}'::jsonb
--   );
--   $$
-- );

-- View scheduled jobs:
-- select * from cron.job;

-- Remove a job:
-- select cron.unschedule('evaluate-alerts-6h');
