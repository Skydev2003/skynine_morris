create table if not exists public.morris_daily_puzzle_rewards (
  user_id uuid not null references auth.users(id) on delete cascade,
  puzzle_day date not null,
  primary key (user_id, puzzle_day)
);

alter table public.morris_daily_puzzle_rewards enable row level security;
revoke all on public.morris_daily_puzzle_rewards from public, anon, authenticated;
