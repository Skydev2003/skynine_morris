alter table public.morris_rooms
  add column if not exists host_name text not null default 'โฮสต์',
  add column if not exists guest_name text not null default 'ผู้เข้าร่วม',
  add column if not exists turn_deadline timestamptz,
  add column if not exists finish_reason text;

alter table public.morris_rooms
  drop constraint if exists morris_rooms_host_character_check,
  drop constraint if exists morris_rooms_guest_character_check;

alter table public.morris_rooms
  add constraint morris_rooms_host_character_check check (host_character in ('kai', 'momo', 'matcha', 'sunny', 'rio', 'luna', 'pippin')),
  add constraint morris_rooms_guest_character_check check (guest_character in ('kai', 'momo', 'matcha', 'sunny', 'rio', 'luna', 'pippin'));
