alter table public.morris_match_queue
  add column selected_color text
  check (selected_color in ('mint', 'rose', 'sky', 'gold', 'aurora', 'flare'));
