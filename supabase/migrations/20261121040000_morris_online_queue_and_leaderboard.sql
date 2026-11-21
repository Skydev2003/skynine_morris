create table if not exists public.morris_match_queue (
  user_id uuid primary key references auth.users(id) on delete cascade,
  ticket uuid not null,
  display_name text not null,
  deadline timestamptz not null,
  room_code text references public.morris_rooms(code) on delete cascade
);
create index if not exists morris_match_queue_deadline on public.morris_match_queue (deadline) where room_code is null;
alter table public.morris_match_queue enable row level security;
revoke all on public.morris_match_queue from public, anon, authenticated;

create or replace function public.morris_leaderboard()
returns table (rank bigint, display_name text, wins bigint, is_you boolean)
language sql stable security definer set search_path = ''
as $$
  with totals as (
    select winner_id, count(*) as wins
    from public.morris_results
    group by winner_id
  ), standings as (
    select t.winner_id, dense_rank() over (order by t.wins desc) as rank, t.wins,
      coalesce(nullif(left(btrim(u.raw_user_meta_data->>'player_name'), 24), ''), 'ผู้เล่น') as display_name
    from totals t join auth.users u on u.id = t.winner_id
  ), podium as (
    select * from standings order by rank, display_name, winner_id limit 50
  )
  select s.rank, s.display_name, s.wins, s.winner_id = (select auth.uid()) as is_you
  from standings s
  where (select auth.uid()) is not null and
    (s.winner_id = (select auth.uid()) or s.winner_id in (select winner_id from podium))
  order by s.rank, s.display_name, s.winner_id;
$$;
revoke all on function public.morris_leaderboard() from public, anon, authenticated;
grant execute on function public.morris_leaderboard() to authenticated;
