create extension if not exists pgcrypto;

create table if not exists public.products (
  id uuid primary key default gen_random_uuid(),
  code text not null unique,
  name text not null,
  category text,
  location text,
  stock numeric(14,2) not null default 0,
  min_stock numeric(14,2) not null default 0,
  active boolean not null default true,
  created_at timestamptz not null default now()
);

create table if not exists public.product_images (
  id uuid primary key default gen_random_uuid(),
  product_id uuid not null references public.products(id) on delete cascade,
  path text not null,
  created_at timestamptz not null default now()
);

create table if not exists public.movements (
  id uuid primary key default gen_random_uuid(),
  product_id uuid not null references public.products(id),
  type text not null check (type in ('ENTRY','EXIT')),
  quantity numeric(14,2) not null check (quantity > 0),
  reason text not null,
  requested_by text,
  notes text,
  created_by uuid,
  created_at timestamptz not null default now()
);

create or replace function public.register_movement(
  p_product_id uuid,
  p_type text,
  p_quantity numeric,
  p_reason text,
  p_requested_by text default null,
  p_notes text default null,
  p_created_by uuid default null
) returns uuid
language plpgsql
security definer
as $$
declare
  current_stock numeric;
  movement_id uuid;
begin
  if p_quantity is null or p_quantity <= 0 then
    raise exception 'La cantidad debe ser mayor a 0';
  end if;

  if p_type not in ('ENTRY', 'EXIT') then
    raise exception 'Tipo de movimiento invalido';
  end if;

  select stock into current_stock
  from public.products
  where id = p_product_id and active = true
  for update;

  if current_stock is null then
    raise exception 'Producto no encontrado o inactivo';
  end if;

  if p_type = 'EXIT' and current_stock < p_quantity then
    raise exception 'Stock insuficiente';
  end if;

  if p_type = 'ENTRY' then
    update public.products
    set stock = stock + p_quantity
    where id = p_product_id;
  else
    update public.products
    set stock = stock - p_quantity
    where id = p_product_id;
  end if;

  insert into public.movements (
    product_id, type, quantity, reason, requested_by, notes, created_by
  ) values (
    p_product_id, p_type, p_quantity, p_reason, p_requested_by, p_notes, p_created_by
  )
  returning id into movement_id;

  return movement_id;
end;
$$;

create or replace function public.cleanup_old_movements(days_to_keep integer default 365)
returns integer
language plpgsql
security definer
as $$
declare
  deleted_count integer;
begin
  delete from public.movements
  where created_at < now() - make_interval(days => days_to_keep);

  get diagnostics deleted_count = row_count;
  return deleted_count;
end;
$$;

alter table public.products enable row level security;
alter table public.product_images enable row level security;
alter table public.movements enable row level security;

drop policy if exists "products_select" on public.products;
create policy "products_select" on public.products for select to authenticated using (true);
drop policy if exists "products_write" on public.products;
create policy "products_write" on public.products for all to authenticated using (true) with check (true);

drop policy if exists "images_select" on public.product_images;
create policy "images_select" on public.product_images for select to authenticated using (true);
drop policy if exists "images_write" on public.product_images;
create policy "images_write" on public.product_images for all to authenticated using (true) with check (true);

drop policy if exists "movements_select" on public.movements;
create policy "movements_select" on public.movements for select to authenticated using (true);
drop policy if exists "movements_write" on public.movements;
create policy "movements_write" on public.movements for all to authenticated using (true) with check (true);

grant execute on function public.register_movement(uuid, text, numeric, text, text, text, uuid) to authenticated;
grant execute on function public.cleanup_old_movements(integer) to authenticated;

