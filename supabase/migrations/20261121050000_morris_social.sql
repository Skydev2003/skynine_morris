create table public.morris_players (
  user_id uuid primary key references auth.users(id) on delete cascade,
  player_id text not null unique check (player_id ~ '^[A-Z0-9]{8}$'),
  last_seen_at timestamptz
);

create table public.morris_friendships (
  sender_id uuid not null references public.morris_players(user_id) on delete cascade,
  recipient_id uuid not null references public.morris_players(user_id) on delete cascade,
  accepted_at timestamptz,
  primary key (sender_id, recipient_id),
  check (sender_id <> recipient_id)
);

-- One relationship per pair, even if both people send the request at the same time.
create unique index morris_friendships_pair on public.morris_friendships
  (least(sender_id, recipient_id), greatest(sender_id, recipient_id));
create index morris_friendships_recipient on public.morris_friendships (recipient_id);

create table public.morris_invites (
  code text not null references public.morris_rooms(code) on delete cascade,
  sender_id uuid not null references public.morris_players(user_id) on delete cascade,
  recipient_id uuid not null references public.morris_players(user_id) on delete cascade,
  expires_at timestamptz not null,
  primary key (code, recipient_id),
  check (sender_id <> recipient_id)
);

create index morris_invites_recipient on public.morris_invites (recipient_id, expires_at);

-- Realtime delivers only a private invalidation signal. State stays behind the authenticated API.
create table public.morris_social_events (
  user_id uuid primary key references public.morris_players(user_id) on delete cascade,
  changed_at timestamptz not null default clock_timestamp()
);

alter table public.morris_players enable row level security;
alter table public.morris_friendships enable row level security;
alter table public.morris_invites enable row level security;
alter table public.morris_social_events enable row level security;

revoke all on public.morris_players, public.morris_friendships, public.morris_invites, public.morris_social_events
  from public, anon, authenticated;
grant select on public.morris_social_events to authenticated;
create policy morris_social_read_events on public.morris_social_events for select to authenticated
  using ((select auth.uid()) = user_id);

alter publication supabase_realtime add table public.morris_social_events;
