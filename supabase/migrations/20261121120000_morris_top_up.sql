create table if not exists public.morris_top_up_orders (
  id uuid primary key,
  user_id uuid not null references auth.users(id) on delete restrict,
  baht integer not null check (baht > 0),
  coins integer not null check (coins > 0),
  transfer_ref text not null check (transfer_ref ~ '^[A-Z0-9-]{6,64}$'),
  payer_name text not null check (char_length(payer_name) between 2 and 100),
  status text not null default 'pending' check (status in ('pending','approved','rejected')),
  submitted_at timestamptz not null default clock_timestamp(),
  reviewed_at timestamptz,
  reviewed_by uuid references auth.users(id) on delete restrict
);

create unique index if not exists morris_top_up_approved_ref on public.morris_top_up_orders (transfer_ref) where status = 'approved';
create index if not exists morris_top_up_by_user on public.morris_top_up_orders (user_id, submitted_at desc);
create index if not exists morris_top_up_pending on public.morris_top_up_orders (submitted_at) where status = 'pending';
alter table public.morris_top_up_orders enable row level security;
revoke all on public.morris_top_up_orders from public, anon, authenticated;
