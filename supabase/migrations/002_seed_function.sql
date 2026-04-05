-- ============================================================
-- VAULTLINE SEED DATA
-- Run AFTER a user signs up to populate their org with demo data
-- This is an edge function trigger, not auto-applied
-- ============================================================

-- Usage: Call this function after user signup to seed their org
-- SELECT public.seed_demo_data(org_id_here);

create or replace function public.seed_demo_data(target_org_id uuid)
returns void
language plpgsql
security definer
as $$
declare
  conn_chase uuid;
  conn_bofa uuid;
  conn_mercury uuid;
  conn_svb uuid;
  conn_wells uuid;
  acct_chase uuid;
  acct_bofa uuid;
  acct_mercury uuid;
  acct_svb uuid;
  acct_wells uuid;
  i int;
  tx_date date;
begin
  -- Bank connections
  insert into public.bank_connections (id, org_id, institution_name, institution_color, status, last_synced_at)
  values
    (gen_random_uuid(), target_org_id, 'JPMorgan Chase', '#1565C0', 'connected', now() - interval '2 minutes'),
    (gen_random_uuid(), target_org_id, 'Bank of America', '#C41230', 'connected', now() - interval '5 minutes'),
    (gen_random_uuid(), target_org_id, 'Mercury', '#4338CA', 'connected', now() - interval '1 minute'),
    (gen_random_uuid(), target_org_id, 'First Citizens (SVB)', '#33691E', 'connected', now() - interval '12 minutes'),
    (gen_random_uuid(), target_org_id, 'Wells Fargo', '#C62828', 'syncing', now() - interval '30 minutes');

  select id into conn_chase from public.bank_connections where org_id = target_org_id and institution_name = 'JPMorgan Chase';
  select id into conn_bofa from public.bank_connections where org_id = target_org_id and institution_name = 'Bank of America';
  select id into conn_mercury from public.bank_connections where org_id = target_org_id and institution_name = 'Mercury';
  select id into conn_svb from public.bank_connections where org_id = target_org_id and institution_name like 'First Citizens%';
  select id into conn_wells from public.bank_connections where org_id = target_org_id and institution_name = 'Wells Fargo';

  -- Accounts
  insert into public.accounts (id, org_id, bank_connection_id, name, type, mask, current_balance, available_balance)
  values
    (gen_random_uuid(), target_org_id, conn_chase, 'Operating Account', 'checking', '4821', 6142300, 6142300),
    (gen_random_uuid(), target_org_id, conn_bofa, 'Payroll Account', 'checking', '7293', 3287100, 3287100),
    (gen_random_uuid(), target_org_id, conn_mercury, 'High-Yield Savings', 'savings', '0158', 2950000, 2950000),
    (gen_random_uuid(), target_org_id, conn_svb, 'Reserves', 'checking', '3346', 1420600, 1420600),
    (gen_random_uuid(), target_org_id, conn_wells, 'Credit Line', 'credit', '8812', 400000, 2000000);

  select id into acct_chase from public.accounts where org_id = target_org_id and mask = '4821';
  select id into acct_bofa from public.accounts where org_id = target_org_id and mask = '7293';
  select id into acct_mercury from public.accounts where org_id = target_org_id and mask = '0158';
  select id into acct_svb from public.accounts where org_id = target_org_id and mask = '3346';
  select id into acct_wells from public.accounts where org_id = target_org_id and mask = '8812';

  -- Transactions (last 30 days of realistic data)
  insert into public.transactions (org_id, account_id, date, description, amount, category, is_pending) values
    -- Recent
    (target_org_id, acct_chase, current_date, 'Stripe Payout — Subscription Revenue', -284500, 'revenue', false),
    (target_org_id, acct_chase, current_date, 'AWS Infrastructure — Monthly', 47200, 'saas', false),
    (target_org_id, acct_bofa, current_date, 'Gusto Payroll Tax Deposit', 142680, 'payroll', false),
    (target_org_id, acct_bofa, current_date - 1, 'Semi-Monthly Payroll Run', 892340, 'payroll', false),
    (target_org_id, acct_chase, current_date - 1, 'Wexley Creative — Q1 Invoice', 38750, 'vendor', false),
    (target_org_id, acct_chase, current_date - 1, 'Google Cloud Platform', 18430, 'saas', false),
    (target_org_id, acct_chase, current_date - 2, 'Enterprise Client — Net 30 Payment', -165000, 'revenue', false),
    (target_org_id, acct_bofa, current_date - 2, 'Federal Tax Estimated Payment', 125000, 'tax', true),
    (target_org_id, acct_chase, current_date - 3, 'Office Lease — 450 Lexington Ave', 72000, 'operations', false),
    (target_org_id, acct_chase, current_date - 3, 'Internal Transfer to Mercury Savings', 500000, 'transfer', false),
    (target_org_id, acct_mercury, current_date - 3, 'Transfer from Chase Operating', -500000, 'transfer', false),
    (target_org_id, acct_chase, current_date - 4, 'Client Payment — Invoice #2847', -92750, 'revenue', false),
    (target_org_id, acct_chase, current_date - 4, 'Salesforce Annual License', 84000, 'saas', false),
    (target_org_id, acct_bofa, current_date - 5, 'Deel — International Contractor Pay', 67200, 'payroll', false),
    (target_org_id, acct_chase, current_date - 6, 'Customer Refund — Acct #3892', 12500, 'operations', false),
    (target_org_id, acct_chase, current_date - 7, 'Stripe Payout — Monthly Revenue', -318200, 'revenue', false),
    (target_org_id, acct_chase, current_date - 7, 'HubSpot Marketing Suite', 24000, 'saas', false),
    (target_org_id, acct_bofa, current_date - 8, 'Health Insurance — Aetna', 48500, 'operations', false),
    (target_org_id, acct_chase, current_date - 9, 'Client Payment — Invoice #2801', -145000, 'revenue', false),
    (target_org_id, acct_chase, current_date - 10, 'Datadog Monitoring', 12800, 'saas', false),
    (target_org_id, acct_bofa, current_date - 11, 'State Tax Payment — CT', 35000, 'tax', false),
    (target_org_id, acct_chase, current_date - 12, 'WeWork Conference Room Rental', 8500, 'operations', false),
    (target_org_id, acct_chase, current_date - 13, 'Client Payment — Invoice #2756', -78400, 'revenue', false),
    (target_org_id, acct_bofa, current_date - 14, 'Semi-Monthly Payroll Run', 892340, 'payroll', false),
    (target_org_id, acct_chase, current_date - 15, 'Stripe Payout — Recurring', -256800, 'revenue', false),
    (target_org_id, acct_chase, current_date - 16, 'Figma Team Plan', 3600, 'saas', false),
    (target_org_id, acct_chase, current_date - 17, 'Legal Counsel — Morrison & Foerster', 45000, 'vendor', false),
    (target_org_id, acct_chase, current_date - 18, 'Client Payment — Invoice #2712', -210000, 'revenue', false),
    (target_org_id, acct_chase, current_date - 20, 'Vercel Hosting — Enterprise', 8900, 'saas', false),
    (target_org_id, acct_bofa, current_date - 22, 'Workers Comp Insurance', 15200, 'operations', false);

  -- Daily balances (30 days)
  for i in 0..29 loop
    tx_date := current_date - i;
    insert into public.daily_balances (org_id, account_id, date, balance) values
      (target_org_id, acct_chase, tx_date, 5800000 + random() * 600000),
      (target_org_id, acct_bofa, tx_date, 3000000 + random() * 400000),
      (target_org_id, acct_mercury, tx_date, 2800000 + random() * 300000),
      (target_org_id, acct_svb, tx_date, 1300000 + random() * 200000),
      (target_org_id, acct_wells, tx_date, 350000 + random() * 100000);
  end loop;

  -- Forecast
  insert into public.forecasts (org_id, horizon_days, data, confidence, monthly_burn, runway_months)
  values (
    target_org_id,
    30,
    '[{"date":"2026-04-12","projected_balance":13600000,"lower_bound":12900000,"upper_bound":14300000}]'::jsonb,
    0.95,
    772000,
    18.4
  );
end;
$$;
