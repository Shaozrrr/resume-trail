alter table public.user_data
add column if not exists prepare_sessions text;
