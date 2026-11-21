create table if not exists public.morris_wallets (
  user_id uuid primary key references auth.users(id) on delete cascade,
  coins integer not null default 0 check (coins >= 0),
  items text[] not null default '{}'::text[]
);

alter table public.morris_wallets enable row level security;
revoke all on public.morris_wallets from public, anon, authenticated;

create or replace function public.morris_reward_win() returns trigger
language plpgsql security definer set search_path = ''
as $$
begin
  insert into public.morris_wallets as wallet (user_id, coins)
    values (new.winner_id, 30)
    on conflict (user_id) do update set coins = wallet.coins + excluded.coins;
  return new;
end;
$$;
revoke all on function public.morris_reward_win() from public, anon, authenticated;

-- Existing results stay as history. Each newly persisted round credits its winner once.
drop trigger if exists morris_reward_win on public.morris_results;
create trigger morris_reward_win after insert on public.morris_results
  for each row execute function public.morris_reward_win();
