alter table public.morris_wallets
  add column equipped_frame text;

alter table public.morris_rooms
  drop constraint morris_rooms_host_color_check,
  drop constraint morris_rooms_guest_color_check,
  add constraint morris_rooms_host_color_check check (host_color in ('mint', 'rose', 'sky', 'gold', 'aurora', 'flare')),
  add constraint morris_rooms_guest_color_check check (guest_color in ('mint', 'rose', 'sky', 'gold', 'aurora', 'flare'));
