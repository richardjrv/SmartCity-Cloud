-- Migration from the legacy FastAPI password/PIN flow to Supabase Auth.
-- Review and run manually in Supabase SQL Editor after deploying the backend changes.
-- Keeps usuarios.id (integer) so existing business-table foreign keys remain valid.

begin;

create schema if not exists private;
revoke all on schema private from public, anon, authenticated;

do $$
begin
    if not exists (select 1 from public.roles where id = 2) then
        raise exception 'Falta el rol id=2 (usuario) en public.roles.';
    end if;

    if exists (
        select 1
        from public.usuarios
        group by lower(btrim(email))
        having count(*) > 1
    ) then
        raise exception 'Hay correos duplicados normalizados en public.usuarios.';
    end if;

    if exists (
        select 1 from public.usuarios
        where email <> btrim(email) or btrim(email) = ''
    ) then
        raise exception 'Hay correos vacíos o con espacios exteriores en public.usuarios.';
    end if;
end
$$;

create unique index if not exists usuarios_email_lower_uidx
    on public.usuarios (lower(email));

do $$
begin
    if not exists (
        select 1 from pg_constraint
        where conrelid = 'public.usuarios'::regclass
          and conname = 'usuarios_email_trimmed_check'
    ) then
        alter table public.usuarios
            add constraint usuarios_email_trimmed_check
            check (email = btrim(email) and email <> '');
    end if;
end
$$;

alter table public.usuarios
    add column if not exists auth_user_id uuid;

alter table public.usuarios
    alter column password_hash drop not null;

do $$
begin
    if not exists (
        select 1 from pg_constraint
        where conrelid = 'public.usuarios'::regclass
          and conname = 'usuarios_auth_user_id_fkey'
    ) then
        alter table public.usuarios
            add constraint usuarios_auth_user_id_fkey
            foreign key (auth_user_id) references auth.users (id) on delete cascade;
    end if;
end
$$;

create unique index if not exists usuarios_auth_user_id_uidx
    on public.usuarios (auth_user_id)
    where auth_user_id is not null;

-- User-generated rows remain as audit/business history if an Auth account is deleted.
alter table public.auditoria drop constraint if exists auditoria_usuario_id_fkey;
alter table public.auditoria
    add constraint auditoria_usuario_id_fkey
    foreign key (usuario_id) references public.usuarios(id) on delete set null;

alter table public.auth_pin_challenges drop constraint if exists auth_pin_challenges_user_id_fkey;
alter table public.auth_pin_challenges
    add constraint auth_pin_challenges_user_id_fkey
    foreign key (user_id) references public.usuarios(id) on delete cascade;

alter table public.actuadores drop constraint if exists actuadores_creado_por_fkey;
alter table public.actuadores
    add constraint actuadores_creado_por_fkey
    foreign key (creado_por) references public.usuarios(id) on delete set null;
alter table public.actuadores drop constraint if exists actuadores_actualizado_por_fkey;
alter table public.actuadores
    add constraint actuadores_actualizado_por_fkey
    foreign key (actualizado_por) references public.usuarios(id) on delete set null;

alter table public.alertas drop constraint if exists alertas_creado_por_fkey;
alter table public.alertas
    add constraint alertas_creado_por_fkey
    foreign key (creado_por) references public.usuarios(id) on delete set null;
alter table public.alertas drop constraint if exists alertas_actualizado_por_fkey;
alter table public.alertas
    add constraint alertas_actualizado_por_fkey
    foreign key (actualizado_por) references public.usuarios(id) on delete set null;

alter table public.alerta_historial drop constraint if exists alerta_historial_alerta_id_fkey;
alter table public.alerta_historial
    add constraint alerta_historial_alerta_id_fkey
    foreign key (alerta_id) references public.alertas(id) on delete cascade;
alter table public.alerta_historial drop constraint if exists alerta_historial_actor_id_fkey;
alter table public.alerta_historial
    add constraint alerta_historial_actor_id_fkey
    foreign key (actor_id) references public.usuarios(id) on delete set null;

create or replace function private.sync_auth_user_to_usuarios()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
declare
    v_usuario_id integer;
    v_nombre text;
begin
    -- Do not connect an unverified email to an existing application account.
    if new.email is null or new.email_confirmed_at is null then
        return new;
    end if;

    v_nombre := nullif(btrim(coalesce(
        new.raw_user_meta_data ->> 'full_name',
        new.raw_user_meta_data ->> 'name'
    )), '');

    select u.id into v_usuario_id
    from public.usuarios as u
    where u.auth_user_id = new.id
    limit 1;

    if v_usuario_id is not null then
        update public.usuarios
        set email = new.email,
            nombre = coalesce(v_nombre, nombre)
        where id = v_usuario_id;
        return new;
    end if;

    -- Test accounts can be claimed only after email confirmation. Their old
    -- admin role is deliberately reset; administrators must be promoted manually.
    select u.id into v_usuario_id
    from public.usuarios as u
    where lower(btrim(u.email)) = lower(btrim(new.email))
      and u.auth_user_id is null
    order by u.id
    limit 1
    for update;

    if v_usuario_id is not null then
        update public.usuarios
        set auth_user_id = new.id,
            email = new.email,
            nombre = coalesce(v_nombre, nombre),
            password_hash = null,
            pin_hash = null,
            pin_intentos = 0,
            pin_bloqueado_hasta = null,
            id_rol = 2,
            estado = 'activo'
        where id = v_usuario_id;
    else
        insert into public.usuarios (
            auth_user_id, nombre, email, password_hash, id_rol, estado, fecha_registro
        ) values (
            new.id,
            coalesce(v_nombre, 'Usuario'),
            new.email,
            null,
            2,
            'activo',
            pg_catalog.now() at time zone 'UTC'
        );
    end if;

    return new;
end;
$$;

revoke all on function private.sync_auth_user_to_usuarios()
    from public, anon, authenticated;

drop trigger if exists on_auth_user_created_to_usuarios on auth.users;
create trigger on_auth_user_created_to_usuarios
    after insert on auth.users
    for each row execute function private.sync_auth_user_to_usuarios();

drop trigger if exists on_auth_user_updated_to_usuarios on auth.users;
create trigger on_auth_user_updated_to_usuarios
    after update of email, email_confirmed_at on auth.users
    for each row execute function private.sync_auth_user_to_usuarios();

-- Tables are accessed through the FastAPI backend, not directly from browser roles.
alter table public.usuarios enable row level security;
revoke all on table public.usuarios from public, anon, authenticated;
revoke all on sequence public.usuarios_id_seq from public, anon, authenticated;

commit;

-- After the first Supabase Auth signup and email confirmation, find that user by:
-- select id, auth_user_id, email, id_rol from public.usuarios where auth_user_id is not null;
-- Promote the trusted first administrator manually, using the internal integer id:
-- update public.usuarios set id_rol = 1 where auth_user_id = '<auth uuid>';
