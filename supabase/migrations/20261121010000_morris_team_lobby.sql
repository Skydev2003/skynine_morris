alter table public.morris_rooms
  add column if not exists host_character text not null default 'kai' check (host_character in ('kai', 'momo')),
  add column if not exists guest_character text not null default 'momo' check (guest_character in ('kai', 'momo')),
  add column if not exists host_color text not null default 'mint' check (host_color in ('mint', 'rose', 'sky', 'gold')),
  add column if not exists guest_color text not null default 'rose' check (guest_color in ('mint', 'rose', 'sky', 'gold')),
  add column if not exists host_ready boolean not null default false,
  add column if not exists guest_ready boolean not null default false,
  add column if not exists started_at timestamptz;

update public.morris_rooms
set started_at = coalesce(finished_at, clock_timestamp()), host_ready = true, guest_ready = true
where started_at is null and guest_id is not null and game_revision > 0;
