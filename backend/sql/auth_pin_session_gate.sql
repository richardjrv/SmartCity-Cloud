-- Add the server-side session gate for the post-login personal PIN step.
-- Safe to run after the original pin_acceso.sql migration.

begin;

alter table public.auth_pin_challenges
    add column if not exists auth_session_id uuid;

create index if not exists idx_auth_pin_challenges_session
    on public.auth_pin_challenges (auth_session_id, user_id, created_at desc);

create table if not exists public.auth_pin_sessions (
    session_id uuid primary key,
    user_id integer not null references public.usuarios(id) on delete cascade,
    verified_at timestamptz not null default now(),
    expires_at timestamptz not null
);

create index if not exists idx_auth_pin_sessions_user
    on public.auth_pin_sessions (user_id);

alter table public.auth_pin_sessions enable row level security;
revoke all on table public.auth_pin_sessions from public, anon, authenticated;

commit;

-- Confirm the upgrade:
-- select column_name from information_schema.columns
-- where table_schema = 'public' and table_name = 'auth_pin_challenges'
--   and column_name = 'auth_session_id';
-- select to_regclass('public.auth_pin_sessions');
