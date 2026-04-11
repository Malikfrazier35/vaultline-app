-- Migration 017: Sample data tagging + purge infrastructure
-- Adds is_sample flag to data tables so demo data can be cleanly removed
-- when a customer connects their first real data source

-- ── Add is_sample column to data tables ──
ALTER TABLE public.transactions ADD COLUMN IF NOT EXISTS is_sample BOOLEAN DEFAULT false;
ALTER TABLE public.daily_balances ADD COLUMN IF NOT EXISTS is_sample BOOLEAN DEFAULT false;
ALTER TABLE public.accounts ADD COLUMN IF NOT EXISTS is_sample BOOLEAN DEFAULT false;
ALTER TABLE public.bank_connections ADD COLUMN IF NOT EXISTS is_sample BOOLEAN DEFAULT false;
ALTER TABLE public.invoices ADD COLUMN IF NOT EXISTS is_sample BOOLEAN DEFAULT false;
ALTER TABLE public.payables ADD COLUMN IF NOT EXISTS is_sample BOOLEAN DEFAULT false;
ALTER TABLE public.forecasts ADD COLUMN IF NOT EXISTS is_sample BOOLEAN DEFAULT false;

-- ── Track whether org has purged sample data ──
ALTER TABLE public.organizations ADD COLUMN IF NOT EXISTS sample_data_purged BOOLEAN DEFAULT false;
ALTER TABLE public.organizations ADD COLUMN IF NOT EXISTS sample_data_purged_at TIMESTAMPTZ;
ALTER TABLE public.organizations ADD COLUMN IF NOT EXISTS first_real_connection_at TIMESTAMPTZ;

-- ── Index for fast purge queries ──
CREATE INDEX IF NOT EXISTS idx_transactions_is_sample ON public.transactions (org_id, is_sample) WHERE is_sample = true;
CREATE INDEX IF NOT EXISTS idx_daily_balances_is_sample ON public.daily_balances (account_id, is_sample) WHERE is_sample = true;
CREATE INDEX IF NOT EXISTS idx_accounts_is_sample ON public.accounts (bank_connection_id, is_sample) WHERE is_sample = true;
CREATE INDEX IF NOT EXISTS idx_bank_connections_is_sample ON public.bank_connections (org_id, is_sample) WHERE is_sample = true;

-- ── Tag existing demo data as sample ──
-- Any bank_connection with institution_name starting with known demo names
UPDATE public.bank_connections SET is_sample = true 
WHERE institution_name IN ('JPMorgan Chase', 'First Citizens (SVB)', 'Wells Fargo')
AND created_at < now();

-- Tag accounts linked to sample bank connections
UPDATE public.accounts SET is_sample = true 
WHERE bank_connection_id IN (SELECT id FROM public.bank_connections WHERE is_sample = true);

-- Tag transactions linked to sample accounts
UPDATE public.transactions SET is_sample = true 
WHERE account_id IN (SELECT id FROM public.accounts WHERE is_sample = true);

-- Tag daily_balances linked to sample accounts
UPDATE public.daily_balances SET is_sample = true 
WHERE account_id IN (SELECT id FROM public.accounts WHERE is_sample = true);

-- Tag invoices/payables that are demo
UPDATE public.invoices SET is_sample = true WHERE client_name IN ('Acme Corp', 'TechVentures Inc', 'GlobalTrade LLC', 'Summit Analytics', 'Meridian Solutions');
UPDATE public.payables SET is_sample = true WHERE vendor_name IN ('AWS', 'Gusto Payroll', 'WeWork', 'Stripe', 'Datadog');
