create table if not exists public.buying_groups (
  id uuid primary key default gen_random_uuid(),
  product_id text not null references public.products (id),
  creator_id uuid not null references public.profiles (id),
  region_code text not null check (region_code in (
    'all','tq','lc','tn','pt','bn','hy','hp','nb','qt','dn','qng','gl','kh','db','hn','ht',
    'ls','lch','na','qn','sl','th','cb','hue','ld','dl','hcm','dna','tni','ct','vl','dt','cm','ag'
  )),
  capacity int not null check (capacity between 2 and 50),
  status text not null default 'OPEN' check (status in ('OPEN','FULL','COMPLETED','EXPIRED','CANCELLED')),
  created_at timestamptz not null default now(),
  ends_at timestamptz not null,
  locked_at timestamptz,
  closed_at timestamptz,
  check (ends_at > created_at),
  check (locked_at is null or (locked_at >= created_at and locked_at < ends_at)),
  check (status not in ('OPEN','CANCELLED') or locked_at is null),
  check (status <> 'COMPLETED' or locked_at is not null),
  check ((closed_at is not null) = (status in ('COMPLETED','EXPIRED','CANCELLED')))
);
create unique index if not exists buying_groups_one_active on public.buying_groups (product_id, region_code)
  where status in ('OPEN','FULL');
create index if not exists buying_groups_product_idx on public.buying_groups (product_id, created_at desc);
create index if not exists buying_groups_expiring_idx on public.buying_groups (ends_at)
  where status in ('OPEN','FULL');

create table if not exists public.group_reservations (
  id uuid primary key default gen_random_uuid(),
  group_id uuid not null references public.buying_groups (id),
  user_id uuid not null references public.profiles (id),
  status text not null default 'HOLD' check (status in ('HOLD','CONFIRMED','ORDERED','CANCELLED','EXPIRED')),
  unit_price_snapshot int not null check (unit_price_snapshot > 0),
  created_at timestamptz not null default now(),
  hold_expires_at timestamptz not null,
  confirmed_at timestamptz,
  closed_at timestamptz,
  order_id text references public.orders (id),
  check (hold_expires_at > created_at and hold_expires_at <= created_at + interval '10 minutes'),
  check (status <> 'HOLD' or confirmed_at is null),
  check (status not in ('CONFIRMED','ORDERED') or confirmed_at is not null),
  check ((order_id is not null) = (status = 'ORDERED')),
  check ((closed_at is not null) = (status in ('ORDERED','CANCELLED','EXPIRED'))),
  unique (order_id, group_id)
);
create unique index if not exists group_reservations_one_active on public.group_reservations (group_id, user_id)
  where status in ('HOLD','CONFIRMED','ORDERED');
create index if not exists group_reservations_group_history on public.group_reservations (group_id, created_at desc);
create index if not exists group_reservations_user_history on public.group_reservations (user_id, group_id, created_at desc);
create index if not exists group_reservations_expiring on public.group_reservations (hold_expires_at, group_id)
  where status in ('HOLD','CONFIRMED');

create table if not exists public.idempotency_requests (
  user_id uuid not null references public.profiles (id) on delete cascade,
  operation text not null check (operation in ('create','join')),
  request_key uuid not null,
  request_payload jsonb not null check (jsonb_typeof(request_payload) = 'object'),
  response_status int check (response_status in (200,201,400,404,409)),
  response_body jsonb,
  created_at timestamptz not null default now(),
  primary key (user_id, operation, request_key),
  check ((response_status is null) = (response_body is null))
);

create table if not exists public.coin_wallets (
  user_id uuid primary key references public.profiles (id) on delete cascade,
  balance bigint not null default 0 check (balance >= 0),
  updated_at timestamptz not null default now()
);
create table if not exists public.coin_ledger (
  id bigint generated always as identity primary key,
  user_id uuid not null references public.coin_wallets (user_id) on delete cascade,
  event_ref text not null check (char_length(btrim(event_ref)) between 1 and 160),
  delta bigint not null check (delta <> 0),
  created_at timestamptz not null default now(),
  unique (user_id, event_ref)
);
create index if not exists coin_ledger_user_history on public.coin_ledger (user_id, created_at desc);

alter table public.buying_groups enable row level security;
alter table public.group_reservations enable row level security;
alter table public.idempotency_requests enable row level security;
alter table public.coin_wallets enable row level security;
alter table public.coin_ledger enable row level security;

drop policy if exists group_reservations_own on public.group_reservations;
create policy group_reservations_own on public.group_reservations for select to authenticated
  using (user_id = (select auth.uid()));
drop policy if exists coin_wallets_own on public.coin_wallets;
create policy coin_wallets_own on public.coin_wallets for select to authenticated
  using (user_id = (select auth.uid()));
drop policy if exists coin_ledger_own on public.coin_ledger;
create policy coin_ledger_own on public.coin_ledger for select to authenticated
  using (user_id = (select auth.uid()));

-- Tóm tắt nhóm công khai đi qua RPC để giới hạn cột và tính trạng thái hiệu lực.
revoke all on table public.buying_groups, public.group_reservations, public.idempotency_requests,
  public.coin_wallets, public.coin_ledger from public, anon, authenticated;
grant select on public.group_reservations, public.coin_wallets, public.coin_ledger to authenticated;
