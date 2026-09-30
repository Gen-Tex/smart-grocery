create table if not exists public.grocery_sync (
  user_id uuid primary key references auth.users(id) on delete cascade,
  payload jsonb not null default '{}'::jsonb,
  updated_at timestamptz not null default now()
);

alter table public.grocery_sync enable row level security;

drop policy if exists "users read own grocery data" on public.grocery_sync;
create policy "users read own grocery data"
on public.grocery_sync for select
using (auth.uid() = user_id);

drop policy if exists "users insert own grocery data" on public.grocery_sync;
create policy "users insert own grocery data"
on public.grocery_sync for insert
with check (auth.uid() = user_id);

drop policy if exists "users update own grocery data" on public.grocery_sync;
create policy "users update own grocery data"
on public.grocery_sync for update
using (auth.uid() = user_id)
with check (auth.uid() = user_id);
