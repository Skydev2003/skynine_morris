create table public.morris_rooms (
  code text primary key check (code ~ '^[A-Z0-9]{6}$'),
  host_id uuid not null references auth.users(id) on delete cascade,
  guest_id uuid references auth.users(id) on delete cascade,
  game jsonb not null,
  revision integer not null default 0,
  game_revision integer not null default 0,
  reaction jsonb,
  reacted_at timestamptz,
  winner_id uuid,
  finished_at timestamptz,
  constraint different_players check (guest_id is null or guest_id <> host_id),
  constraint valid_result check (
    (winner_id is null and finished_at is null) or
    (winner_id is not null and finished_at is not null and guest_id is not null
      and winner_id in (host_id, guest_id))
  )
);

create index morris_host_history on public.morris_rooms (host_id, finished_at desc);
create index morris_guest_history on public.morris_rooms (guest_id, finished_at desc);
create index morris_wins on public.morris_rooms (winner_id) where winner_id is not null;

create function public.morris_advance_revision() returns trigger
language plpgsql set search_path = ''
as $$
begin
  new.revision := old.revision + 1;
  return new;
end;
$$;

create trigger morris_room_revision before update on public.morris_rooms
for each row execute function public.morris_advance_revision();

alter table public.morris_rooms enable row level security;
revoke all on table public.morris_rooms from public, anon, authenticated;
grant select on table public.morris_rooms to authenticated;
grant select, insert, update on table public.morris_rooms to service_role;
create policy morris_players_read on public.morris_rooms for select to authenticated
  using ((select auth.uid()) in (host_id, guest_id));

alter publication supabase_realtime add table public.morris_rooms;
