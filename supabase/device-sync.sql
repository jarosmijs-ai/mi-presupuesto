-- Run this once in the Supabase SQL Editor.
-- Each authenticated user can only read and update their own synchronized snapshot.

create table if not exists public.user_backups (
  user_id uuid primary key references auth.users(id) on delete cascade,
  payload jsonb not null default '{}'::jsonb,
  updated_at timestamptz not null default now()
);

alter table public.user_backups enable row level security;

drop policy if exists "Users can read their own backup" on public.user_backups;
create policy "Users can read their own backup"
on public.user_backups
for select
using (auth.uid() = user_id);

drop policy if exists "Users can create their own backup" on public.user_backups;
create policy "Users can create their own backup"
on public.user_backups
for insert
with check (auth.uid() = user_id);

drop policy if exists "Users can update their own backup" on public.user_backups;
create policy "Users can update their own backup"
on public.user_backups
for update
using (auth.uid() = user_id)
with check (auth.uid() = user_id);

-- Required for near-real-time updates between verified devices.
do $$
begin
  alter publication supabase_realtime add table public.user_backups;
exception
  when duplicate_object then null;
end $$;
