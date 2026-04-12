create table if not exists public.saved_scenarios (
  id uuid primary key default gen_random_uuid(),
  org_id uuid not null references public.organizations(id) on delete cascade,
  name text not null,
  scenarios jsonb not null,
  months int not null default 12,
  created_by uuid references auth.users(id),
  is_default boolean default false,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create index if not exists idx_scenarios_org on public.saved_scenarios(org_id);
alter table public.saved_scenarios enable row level security;
create policy "scenarios_all" on public.saved_scenarios for all using (true) with check (true);
