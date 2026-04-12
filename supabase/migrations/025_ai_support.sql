-- ═══════════════════════════════════════════════════
-- 025: AI support conversation tables
-- ═══════════════════════════════════════════════════

create table if not exists public.ai_conversations (
  id uuid primary key default gen_random_uuid(),
  org_id uuid not null references public.organizations(id) on delete cascade,
  user_id uuid references auth.users(id),
  channel text not null default 'in_app' check (channel in ('in_app','voice','sms','whatsapp')),
  status text default 'active' check (status in ('active','resolved','escalated')),
  escalated_at timestamptz,
  resolved_at timestamptz,
  created_at timestamptz not null default now()
);

create index if not exists idx_ai_conv_org on public.ai_conversations(org_id, created_at desc);
alter table public.ai_conversations enable row level security;
create policy "ai_conv_all" on public.ai_conversations for all using (true) with check (true);

create table if not exists public.ai_messages (
  id uuid primary key default gen_random_uuid(),
  conversation_id uuid not null references public.ai_conversations(id) on delete cascade,
  role text not null check (role in ('user','assistant','system')),
  content text not null,
  created_at timestamptz not null default now()
);

create index if not exists idx_ai_msg_conv on public.ai_messages(conversation_id, created_at);
alter table public.ai_messages enable row level security;
create policy "ai_msg_all" on public.ai_messages for all using (true) with check (true);

create table if not exists public.ai_tool_calls (
  id uuid primary key default gen_random_uuid(),
  conversation_id uuid references public.ai_conversations(id) on delete cascade,
  org_id uuid references public.organizations(id),
  tool_name text not null,
  input jsonb default '{}',
  output jsonb default '{}',
  created_at timestamptz not null default now()
);

create index if not exists idx_ai_tools_conv on public.ai_tool_calls(conversation_id);
alter table public.ai_tool_calls enable row level security;
create policy "ai_tools_all" on public.ai_tool_calls for all using (true) with check (true);
