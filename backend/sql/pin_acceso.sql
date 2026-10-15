-- SmartCity Cloud: PIN personal de cuatro cifras como segundo paso del login.
-- Ejecutar manualmente en Supabase > SQL Editor.
-- Los PIN se guardan como hashes; los retos no entregan un JWT de sesión.

begin;

alter table public.usuarios
    add column if not exists pin_hash text,
    add column if not exists pin_intentos smallint not null default 0,
    add column if not exists pin_bloqueado_hasta timestamptz;

comment on column public.usuarios.pin_hash is
    'Hash lento del PIN de acceso; nunca almacena las cuatro cifras originales.';
comment on column public.usuarios.pin_intentos is
    'Intentos fallidos consecutivos del PIN; cinco intentos activan el bloqueo temporal.';
comment on column public.usuarios.pin_bloqueado_hasta is
    'Fin del bloqueo temporal después de exceder los intentos permitidos del PIN.';

create table if not exists public.auth_pin_challenges (
    id text primary key,
    user_id integer not null references public.usuarios(id) on delete cascade,
    auth_session_id uuid,
    purpose text not null check (purpose in ('login', 'setup', 'reset')),
    expires_at timestamptz not null,
    failed_attempts smallint not null default 0 check (failed_attempts >= 0),
    consumed_at timestamptz,
    created_at timestamptz not null default now()
);

-- Ajusta la restricción aunque la tabla se hubiera creado antes sin flujo de recuperación.
alter table public.auth_pin_challenges
    drop constraint if exists auth_pin_challenges_purpose_check;
alter table public.auth_pin_challenges
    add constraint auth_pin_challenges_purpose_check
    check (purpose in ('login', 'setup', 'reset'));
alter table public.auth_pin_challenges
    add column if not exists auth_session_id uuid;

create index if not exists idx_auth_pin_challenges_user_created
    on public.auth_pin_challenges (user_id, created_at desc);
create index if not exists idx_auth_pin_challenges_expiration
    on public.auth_pin_challenges (expires_at);
create index if not exists idx_auth_pin_challenges_session
    on public.auth_pin_challenges (auth_session_id, user_id, created_at desc);

-- Una sesión solo puede usar la API después de que su usuario confirme el PIN.
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

alter table public.auth_pin_challenges enable row level security;
revoke all on table public.auth_pin_challenges from public, anon, authenticated;

commit;

-- Comprobación después de ejecutar:
-- select column_name, data_type
-- from information_schema.columns
-- where table_schema = 'public' and table_name = 'usuarios'
--   and column_name in ('pin_hash', 'pin_intentos', 'pin_bloqueado_hasta');
-- select to_regclass('public.auth_pin_challenges');
