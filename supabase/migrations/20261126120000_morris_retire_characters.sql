update public.morris_rooms
set host_character = case when host_character in ('hikaru', 'akira', 'sai') then 'kai' else host_character end,
    guest_character = case when guest_character in ('hikaru', 'akira', 'sai') then 'momo' else guest_character end
where host_character in ('hikaru', 'akira', 'sai') or guest_character in ('hikaru', 'akira', 'sai');

update public.morris_match_queue
set selected_character = null
where selected_character in ('hikaru', 'akira', 'sai');

alter table public.morris_rooms
  drop constraint morris_rooms_host_character_check,
  drop constraint morris_rooms_guest_character_check,
  add constraint morris_rooms_host_character_check
    check (host_character in ('kai', 'momo', 'matcha', 'sunny', 'rio', 'luna', 'pippin')),
  add constraint morris_rooms_guest_character_check
    check (guest_character in ('kai', 'momo', 'matcha', 'sunny', 'rio', 'luna', 'pippin'));

alter table public.morris_match_queue
  drop constraint if exists morris_match_queue_selected_character_check,
  add constraint morris_match_queue_selected_character_check
    check (selected_character in ('kai', 'momo', 'matcha', 'sunny', 'rio', 'luna', 'pippin'));
