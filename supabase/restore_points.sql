create table if not exists public.restore_points (
  id uuid primary key default gen_random_uuid(),
  label text not null,
  created_by_email text,
  snapshot jsonb not null,
  created_at timestamptz not null default now()
);

alter table public.restore_points enable row level security;

drop policy if exists "restore_points_select" on public.restore_points;
create policy "restore_points_select"
on public.restore_points
for select
to authenticated
using (true);

drop policy if exists "restore_points_write" on public.restore_points;
create policy "restore_points_write"
on public.restore_points
for all
to authenticated
using (true)
with check (true);

