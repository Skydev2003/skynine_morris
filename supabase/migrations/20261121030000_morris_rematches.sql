alter table public.morris_rooms
  add column if not exists host_rematch boolean not null default false,
  add column if not exists guest_rematch boolean not null default false,
  add column if not exists rematch_closed boolean not null default false;

create table if not exists public.morris_results (
  room_code text not null,
  game_revision integer not null,
  host_id uuid not null references auth.users(id) on delete cascade,
  guest_id uuid not null references auth.users(id) on delete cascade,
  winner_id uuid not null,
  finished_at timestamptz not null,
  primary key (room_code, game_revision),
  check (winner_id in (host_id, guest_id))
);

create index if not exists morris_results_host_history on public.morris_results (host_id, finished_at desc);
create index if not exists morris_results_guest_history on public.morris_results (guest_id, finished_at desc);
create index if not exists morris_results_wins on public.morris_results (winner_id);

alter table public.morris_results enable row level security;
revoke all on public.morris_results from public, anon, authenticated;
grant select on public.morris_results to authenticated;
drop policy if exists morris_results_players_read on public.morris_results;
create policy morris_results_players_read on public.morris_results for select to authenticated
  using ((select auth.uid()) in (host_id, guest_id));

create or replace function public.morris_save_result() returns trigger
language plpgsql security definer set search_path = ''
as $$
begin
  insert into public.morris_results (room_code, game_revision, host_id, guest_id, winner_id, finished_at)
    values (new.code, new.game_revision, new.host_id, new.guest_id, new.winner_id, new.finished_at)
    on conflict (room_code, game_revision) do nothing;
  return new;
end;
$$;
revoke all on function public.morris_save_result() from public, anon, authenticated;

drop trigger if exists morris_save_result on public.morris_rooms;
create trigger morris_save_result after update on public.morris_rooms
  for each row when (old.winner_id is null and new.winner_id is not null)
  execute function public.morris_save_result();

insert into public.morris_results (room_code, game_revision, host_id, guest_id, winner_id, finished_at)
select code, game_revision, host_id, guest_id, winner_id, finished_at
from public.morris_rooms where winner_id is not null
on conflict (room_code, game_revision) do nothing;
