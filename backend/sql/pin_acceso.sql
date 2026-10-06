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
    purpose text not null check (purpose in ('login', 'setup')),
    expires_at timestamptz not null,
    failed_attempts smallint not null default 0 check (failed_attempts >= 0),
    consumed_at timestamptz,
    created_at timestamptz not null default now()
);

create index if not exists idx_auth_pin_challenges_user_created
    on public.auth_pin_challenges (user_id, created_at desc);
create index if not exists idx_auth_pin_challenges_expiration
    on public.auth_pin_challenges (expires_at);

alter table public.auth_pin_challenges enable row level security;
revoke all on table public.auth_pin_challenges from public, anon, authenticated;

commit;

-- Comprobación después de ejecutar:
-- select column_name, data_type
-- from information_schema.columns
-- where table_schema = 'public' and table_name = 'usuarios'
--   and column_name in ('pin_hash', 'pin_intentos', 'pin_bloqueado_hasta');
-- select to_regclass('public.auth_pin_challenges');
