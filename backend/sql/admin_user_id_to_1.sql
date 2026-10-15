-- One-time migration: move the confirmed administrator from usuarios.id = 12
-- to usuarios.id = 1 while preserving all foreign-key references.
-- Run only for the account checked by this migration; this is not an ID reset
-- for general user rows.

begin;

do $$
begin
    if exists (select 1 from public.usuarios where id = 1) then
        raise exception 'No se puede usar usuarios.id=1: ya existe una fila.';
    end if;

    if not exists (
        select 1 from public.usuarios
        where id = 12 and auth_user_id is not null and id_rol = 1
    ) then
        raise exception 'No se encontró la cuenta Auth admin esperada en usuarios.id=12.';
    end if;
end
$$;

alter table public.actuadores drop constraint actuadores_actualizado_por_fkey;
alter table public.actuadores drop constraint actuadores_creado_por_fkey;
alter table public.alerta_historial drop constraint alerta_historial_actor_id_fkey;
alter table public.alertas drop constraint alertas_actualizado_por_fkey;
alter table public.alertas drop constraint alertas_creado_por_fkey;
alter table public.auditoria drop constraint auditoria_usuario_id_fkey;
alter table public.auth_pin_challenges drop constraint auth_pin_challenges_user_id_fkey;

update public.actuadores set actualizado_por = 1 where actualizado_por = 12;
update public.actuadores set creado_por = 1 where creado_por = 12;
update public.alerta_historial set actor_id = 1 where actor_id = 12;
update public.alertas set actualizado_por = 1 where actualizado_por = 12;
update public.alertas set creado_por = 1 where creado_por = 12;
update public.auditoria set usuario_id = 1 where usuario_id = 12;
update public.auth_pin_challenges set user_id = 1 where user_id = 12;

update public.usuarios set id = 1 where id = 12;

alter table public.actuadores
    add constraint actuadores_actualizado_por_fkey
    foreign key (actualizado_por) references public.usuarios(id) on delete set null;
alter table public.actuadores
    add constraint actuadores_creado_por_fkey
    foreign key (creado_por) references public.usuarios(id) on delete set null;
alter table public.alerta_historial
    add constraint alerta_historial_actor_id_fkey
    foreign key (actor_id) references public.usuarios(id) on delete set null;
alter table public.alertas
    add constraint alertas_actualizado_por_fkey
    foreign key (actualizado_por) references public.usuarios(id) on delete set null;
alter table public.alertas
    add constraint alertas_creado_por_fkey
    foreign key (creado_por) references public.usuarios(id) on delete set null;
alter table public.auditoria
    add constraint auditoria_usuario_id_fkey
    foreign key (usuario_id) references public.usuarios(id) on delete set null;
alter table public.auth_pin_challenges
    add constraint auth_pin_challenges_user_id_fkey
    foreign key (user_id) references public.usuarios(id) on delete cascade;

select pg_catalog.setval(
    pg_catalog.pg_get_serial_sequence('public.usuarios', 'id')::regclass,
    greatest(coalesce((select max(id) from public.usuarios), 1), 1),
    true
);

do $$
begin
    if not exists (
        select 1 from public.usuarios
        where id = 1 and auth_user_id is not null and id_rol = 1
    ) then
        raise exception 'Verificación fallida: el admin no quedó en usuarios.id=1.';
    end if;
end
$$;

commit;
