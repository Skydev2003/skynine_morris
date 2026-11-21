alter table public.morris_rooms
  drop constraint morris_rooms_host_character_check,
  drop constraint morris_rooms_guest_character_check,
  add constraint morris_rooms_host_character_check
    check (host_character in ('kai', 'momo', 'matcha', 'sunny', 'rio', 'luna', 'pippin', 'hikaru', 'akira', 'sai')),
  add constraint morris_rooms_guest_character_check
    check (guest_character in ('kai', 'momo', 'matcha', 'sunny', 'rio', 'luna', 'pippin', 'hikaru', 'akira', 'sai'));
