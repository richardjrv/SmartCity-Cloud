-- Nombres descriptivos y relaciones explícitas para el esquema actual.
-- Conserva los registros y mantiene el contrato JSON del backend.
-- Requiere un corte coordinado con el despliegue del backend; no aplicar por separado.

begin;

-- Evita instalar las nuevas relaciones si ya hay identificadores huérfanos.
do $$
begin
    if (select count(*) from public.dispositivos_iot where activo) > 1
       or exists (
            select 1 from public.dispositivos_iot
            where activo and sensor_id <> 'ESP32'
       ) then
        raise exception 'El catálogo debe conservar como máximo un dispositivo activo, identificado como ESP32.';
    end if;

    if exists (
        select 1
        from public.lecturas_sensores as l
        left join public.dispositivos_iot as d on d.sensor_id = l.sensor_id
        where d.sensor_id is null
    ) then
        raise exception 'Hay lecturas_sensores sin dispositivo relacionado; corrige esas filas antes de migrar.';
    end if;

    if exists (
        select 1
        from public.alertas as a
        left join public.dispositivos_iot as d on d.sensor_id = a.sensor_id
        where a.sensor_id is not null and d.sensor_id is null
    ) then
        raise exception 'Hay alertas con sensor_id sin dispositivo relacionado; corrige esas filas antes de migrar.';
    end if;
end
$$;

-- Catálogo de roles y perfiles. El FK queda protegido contra borrar un rol en uso.
alter table public.roles rename column id to id_rol;
alter table public.roles rename constraint roles_pkey to pk_roles;
alter table public.roles rename constraint roles_nombre_key to uq_roles_nombre;
alter sequence public.roles_id_seq rename to roles_id_rol_seq;

alter table public.usuarios drop constraint usuarios_id_rol_fkey;
alter table public.usuarios rename column id to id_usuario;
alter table public.usuarios rename column username to nombre_usuario;
alter table public.usuarios rename column auth_user_id to id_usuario_auth;
alter table public.usuarios rename constraint usuarios_pkey to pk_usuarios;
alter table public.usuarios rename constraint usuarios_username_key to uq_usuarios_nombre_usuario;
alter table public.usuarios rename constraint usuarios_auth_user_id_fkey to fk_usuarios_cuenta_auth;
alter sequence public.usuarios_id_seq rename to usuarios_id_usuario_seq;
alter table public.usuarios
    add constraint fk_usuarios_rol
    foreign key (id_rol) references public.roles(id_rol) on delete restrict;

-- Lecturas sin procesar: cada registro apunta al dispositivo que lo envió.
alter table public.lecturas_sensores rename column id to id_lectura_sensor;
alter table public.lecturas_sensores rename column sensor_id to id_dispositivo;
alter table public.lecturas_sensores rename constraint lecturas_sensores_pkey to pk_lecturas_sensores;
alter sequence public.lecturas_sensores_id_seq rename to lecturas_sensores_id_lectura_sensor_seq;
alter index public.idx_lecturas_sensores_sensor_fecha_desc
    rename to idx_lecturas_sensores_id_dispositivo_fecha_desc;
alter table public.lecturas_sensores
    add constraint fk_lecturas_sensores_dispositivo
    foreign key (id_dispositivo) references public.dispositivos_iot(sensor_id)
    on update cascade on delete restrict;

-- Dispositivo físico. Se usa el mismo nombre en todas las tablas relacionadas.
alter table public.dispositivos_iot rename column sensor_id to id_dispositivo;
alter table public.dispositivos_iot rename constraint dispositivos_iot_pkey to pk_dispositivos_iot;
alter table public.dispositivos_iot rename constraint dispositivos_iot_sensor_id_check to dispositivos_iot_id_dispositivo_requerido;
alter table public.dispositivos_iot
    add constraint dispositivos_iot_solo_esp32_activo
    check (not activo or id_dispositivo = 'ESP32');
create unique index if not exists uq_dispositivos_iot_unico_activo
    on public.dispositivos_iot ((activo)) where activo = true;

-- Auditoría de usuarios.
alter table public.auditoria rename column id to id_auditoria;
alter table public.auditoria rename column usuario_id to id_usuario;
alter table public.auditoria rename column recurso_id to id_recurso;
alter table public.auditoria rename constraint auditoria_pkey to pk_auditoria;
alter table public.auditoria rename constraint auditoria_usuario_id_fkey to fk_auditoria_usuario;
alter sequence public.auditoria_id_seq rename to auditoria_id_auditoria_seq;
alter index public.auditoria_usuario_fecha_idx rename to idx_auditoria_id_usuario_fecha;

-- Inventario lógico; la FK identifica el ESP32 propietario de cada canal.
alter table public.sensores rename column id_controlador to id_dispositivo;
alter table public.sensores rename constraint sensores_id_controlador_fkey to fk_sensores_dispositivo;

-- Varios actuadores pueden pertenecer al único ESP32 del proyecto.
alter table public.actuadores drop constraint actuadores_sensor_id_key;
alter table public.actuadores rename column id to id_actuador;
alter table public.actuadores rename column sensor_id to id_dispositivo;
alter table public.actuadores rename column creado_por to id_usuario_creacion;
alter table public.actuadores rename column actualizado_por to id_usuario_actualizacion;
alter table public.actuadores rename constraint actuadores_pkey to pk_actuadores;
alter table public.actuadores rename constraint actuadores_sensor_fk to fk_actuadores_dispositivo;
alter table public.actuadores rename constraint actuadores_creado_por_fkey to fk_actuadores_usuario_creacion;
alter table public.actuadores rename constraint actuadores_actualizado_por_fkey to fk_actuadores_usuario_actualizacion;
alter index public.actuadores_creado_por_idx rename to idx_actuadores_id_usuario_creacion;
alter index public.actuadores_actualizado_por_idx rename to idx_actuadores_id_usuario_actualizacion;

-- Alertas: vincula el dispositivo cuando el aviso procede de uno.
alter table public.alertas rename column id to id_alerta;
alter table public.alertas rename column sensor_id to id_dispositivo;
alter table public.alertas rename column creado_por to id_usuario_creacion;
alter table public.alertas rename column actualizado_por to id_usuario_actualizacion;
alter table public.alertas alter column id_dispositivo type varchar using id_dispositivo::varchar;
alter table public.alertas rename constraint alertas_pkey to pk_alertas;
alter table public.alertas rename constraint alertas_creado_por_fkey to fk_alertas_usuario_creacion;
alter table public.alertas rename constraint alertas_actualizado_por_fkey to fk_alertas_usuario_actualizacion;
alter table public.alertas rename constraint alertas_sensor_campos to alertas_dispositivo_metrica_requeridos;
alter index public.alertas_creado_por_idx rename to idx_alertas_id_usuario_creacion;
alter index public.alertas_actualizado_por_idx rename to idx_alertas_id_usuario_actualizacion;
alter index public.alertas_sensor_metrica_uq rename to uq_alertas_dispositivo_metrica_sensor;
alter table public.alertas
    add constraint fk_alertas_dispositivo
    foreign key (id_dispositivo) references public.dispositivos_iot(id_dispositivo)
    on update cascade on delete set null;

-- Historial de cambios de estado de alertas.
alter table public.alerta_historial rename column id to id_historial_alerta;
alter table public.alerta_historial rename column alerta_id to id_alerta;
alter table public.alerta_historial rename column actor_id to id_usuario_actor;
alter table public.alerta_historial rename constraint alerta_historial_pkey to pk_alerta_historial;
alter table public.alerta_historial rename constraint alerta_historial_alerta_id_fkey to fk_historial_alerta;
alter table public.alerta_historial rename constraint alerta_historial_actor_id_fkey to fk_historial_usuario_actor;
alter index public.alerta_historial_alerta_fecha_idx
    rename to idx_historial_alerta_id_alerta_fecha;

-- Ajustes del sistema. Las claves internas del JSON también quedan en español;
-- la API las convierte a las claves camelCase que ya consume la interfaz.
alter table public.configuracion_sistema drop constraint configuracion_sistema_updated_by_fkey;
alter table public.configuracion_sistema rename column id to id_configuracion;
alter table public.configuracion_sistema rename column updated_by to id_usuario_actualizacion;
alter table public.configuracion_sistema rename column updated_at to actualizado_en;
alter table public.configuracion_sistema rename constraint configuracion_sistema_pkey to pk_configuracion_sistema;
alter table public.configuracion_sistema rename constraint configuracion_sistema_id_check to configuracion_sistema_id_unico;
alter table public.configuracion_sistema
    add constraint fk_configuracion_usuario_actualizacion
    foreign key (id_usuario_actualizacion) references public.usuarios(id_usuario) on delete set null;

alter table public.configuracion_sistema
    add column temperatura_maxima numeric,
    add column humedad_minima numeric,
    add column humedad_maxima numeric,
    add column calidad_aire_maxima numeric,
    add column intervalo_actualizacion_segundos integer,
    add column minutos_sin_datos integer,
    add column etiqueta_sensor text,
    add column notificaciones_habilitadas boolean;

update public.configuracion_sistema
set temperatura_maxima = coalesce(nullif(settings ->> 'temperatureMax', '')::numeric, 35),
    humedad_minima = coalesce(nullif(settings ->> 'humidityMin', '')::numeric, 30),
    humedad_maxima = coalesce(nullif(settings ->> 'humidityMax', '')::numeric, 70),
    calidad_aire_maxima = coalesce(nullif(settings ->> 'airQualityMax', '')::numeric, 100),
    intervalo_actualizacion_segundos = coalesce(nullif(settings ->> 'refreshSeconds', '')::integer, 60),
    minutos_sin_datos = coalesce(nullif(settings ->> 'staleMinutes', '')::integer, 10),
    etiqueta_sensor = coalesce(nullif(btrim(settings ->> 'sensorLabel'), ''), 'ESP32'),
    notificaciones_habilitadas = coalesce(nullif(settings ->> 'notificationsEnabled', '')::boolean, true);

alter table public.configuracion_sistema
    alter column temperatura_maxima set default 35,
    alter column temperatura_maxima set not null,
    alter column humedad_minima set default 30,
    alter column humedad_minima set not null,
    alter column humedad_maxima set default 70,
    alter column humedad_maxima set not null,
    alter column calidad_aire_maxima set default 100,
    alter column calidad_aire_maxima set not null,
    alter column intervalo_actualizacion_segundos set default 60,
    alter column intervalo_actualizacion_segundos set not null,
    alter column minutos_sin_datos set default 10,
    alter column minutos_sin_datos set not null,
    alter column etiqueta_sensor set default 'ESP32',
    alter column etiqueta_sensor set not null,
    alter column notificaciones_habilitadas set default true,
    alter column notificaciones_habilitadas set not null,
    drop column settings,
    add constraint configuracion_temperatura_valida check (temperatura_maxima between -20 and 80),
    add constraint configuracion_humedad_valida check (
        humedad_minima >= 0 and humedad_minima < humedad_maxima and humedad_maxima <= 100
    ),
    add constraint configuracion_calidad_aire_valida check (calidad_aire_maxima between 0 and 1000),
    add constraint configuracion_intervalo_valido check (intervalo_actualizacion_segundos in (30, 60, 300)),
    add constraint configuracion_minutos_sin_datos_validos check (minutos_sin_datos between 2 and 1440),
    add constraint configuracion_etiqueta_sensor_valida check (
        char_length(btrim(etiqueta_sensor)) between 1 and 40
    );

-- Historial normalizado: sus identificadores ya expresan las tablas relacionadas.
alter table public.comandos rename column solicitado_por to id_usuario_solicitante;
alter table public.comandos rename constraint comandos_solicitado_por_fkey to fk_comandos_usuario_solicitante;
alter table public.comandos rename constraint comandos_id_actuador_fkey to fk_comandos_actuador;
alter table public.comandos rename constraint comandos_pkey to pk_comandos;
alter table public.lecturas rename constraint lecturas_pkey to pk_lecturas;
alter table public.sensores rename constraint sensores_pkey to pk_sensores;
alter table public.sensor_magnitud rename constraint sensor_magnitud_pkey to pk_sensor_magnitud;
alter table public.magnitudes rename constraint magnitudes_pkey to pk_magnitudes;
alter table public.sensor_magnitud rename constraint sensor_magnitud_id_sensor_fkey to fk_sensor_magnitud_sensor;
alter table public.sensor_magnitud rename constraint sensor_magnitud_id_magnitud_fkey to fk_sensor_magnitud_magnitud;
alter table public.lecturas rename constraint lecturas_sensor_magnitud_fk to fk_lecturas_sensor_magnitud;
alter index public.usuarios_auth_user_id_uidx rename to idx_usuarios_id_usuario_auth_unico;

-- Normaliza también las referencias a usuarios en el archivo privado del PIN legado.
alter table private.pines_usuarios_legados drop constraint pines_usuarios_legados_usuario_id_fkey;
alter table private.pines_usuarios_legados rename column usuario_id to id_usuario;
alter table private.pines_usuarios_legados rename constraint pines_usuarios_legados_pkey to pk_pines_usuarios_legados;
alter table private.pines_usuarios_legados
    add constraint fk_pines_legados_usuario
    foreign key (id_usuario) references public.usuarios(id_usuario) on delete cascade;

alter table private.retos_pin_legados drop constraint retos_pin_legados_usuario_id_fkey;
alter table private.retos_pin_legados rename column usuario_id to id_usuario;
alter table private.retos_pin_legados rename constraint retos_pin_legados_pkey to pk_retos_pin_legados;
alter table private.retos_pin_legados
    add constraint fk_retos_pin_legados_usuario
    foreign key (id_usuario) references public.usuarios(id_usuario) on delete cascade;

alter table private.sesiones_pin_legadas drop constraint sesiones_pin_legadas_usuario_id_fkey;
alter table private.sesiones_pin_legadas rename column usuario_id to id_usuario;
alter table private.sesiones_pin_legadas rename constraint sesiones_pin_legadas_pkey to pk_sesiones_pin_legadas;
alter table private.sesiones_pin_legadas
    add constraint fk_sesiones_pin_legadas_usuario
    foreign key (id_usuario) references public.usuarios(id_usuario) on delete cascade;
alter table private.retos_pin_legados rename column id_sesion_auth to id_sesion_autenticacion;
alter index private.idx_retos_pin_legados_sesion
    rename to idx_retos_pin_legados_id_sesion_autenticacion_usuario;
alter index public.idx_sensores_controlador rename to idx_sensores_id_dispositivo;
alter index private.idx_retos_pin_legados_usuario_creado
    rename to idx_retos_pin_legados_id_usuario_creado;
alter index private.idx_sesiones_pin_legadas_usuario
    rename to idx_sesiones_pin_legadas_id_usuario;

-- Índices para las columnas que originan claves foráneas.
create index if not exists idx_usuarios_id_rol on public.usuarios (id_rol);
create index if not exists idx_actuadores_id_dispositivo on public.actuadores (id_dispositivo);
create index if not exists idx_alertas_id_dispositivo on public.alertas (id_dispositivo);
create index if not exists idx_alerta_historial_id_usuario_actor
    on public.alerta_historial (id_usuario_actor);
create index if not exists idx_configuracion_id_usuario_actualizacion
    on public.configuracion_sistema (id_usuario_actualizacion);
create index if not exists idx_sensor_magnitud_id_magnitud
    on public.sensor_magnitud (id_magnitud);
create index if not exists idx_comandos_id_usuario_solicitante
    on public.comandos (id_usuario_solicitante);

-- Actualiza el trigger existente de Supabase Auth; la versión anterior aún
-- hacía referencia a columnas PIN que ya no existen en public.usuarios.
create or replace function private.sync_auth_user_to_usuarios()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
declare
    v_id_usuario integer;
    v_nombre text;
begin
    if new.email is null or new.email_confirmed_at is null then
        return new;
    end if;

    v_nombre := nullif(btrim(coalesce(
        new.raw_user_meta_data ->> 'full_name',
        new.raw_user_meta_data ->> 'name'
    )), '');

    select u.id_usuario into v_id_usuario
    from public.usuarios as u
    where u.id_usuario_auth = new.id
    limit 1;

    if v_id_usuario is not null then
        update public.usuarios
        set email = new.email,
            nombre = coalesce(v_nombre, nombre)
        where id_usuario = v_id_usuario;
        return new;
    end if;

    select u.id_usuario into v_id_usuario
    from public.usuarios as u
    where lower(btrim(u.email)) = lower(btrim(new.email))
      and u.id_usuario_auth is null
    order by u.id_usuario
    limit 1
    for update;

    if v_id_usuario is not null then
        update public.usuarios
        set id_usuario_auth = new.id,
            email = new.email,
            nombre = coalesce(v_nombre, nombre),
            id_rol = 2,
            estado = 'activo'
        where id_usuario = v_id_usuario;
    else
        insert into public.usuarios (
            id_usuario_auth, nombre, email, id_rol, estado, fecha_registro
        ) values (
            new.id,
            coalesce(v_nombre, 'Usuario'),
            new.email,
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

comment on column public.roles.id_rol is 'Clave primaria del catálogo de roles.';
comment on column public.usuarios.id_usuario is 'Clave primaria del perfil local de la aplicación.';
comment on column public.usuarios.id_rol is 'Clave foránea que identifica el rol asignado al usuario.';
comment on column public.usuarios.id_usuario_auth is 'Clave foránea de la cuenta correspondiente en Supabase Auth.';
comment on column public.auditoria.id_auditoria is 'Clave primaria de la acción auditada.';
comment on column public.auditoria.id_usuario is 'Clave foránea del usuario que realizó la acción; NULL representa una acción del sistema.';
comment on column public.auditoria.id_recurso is 'Identificador del recurso auditado; no es FK porque puede pertenecer a distintos módulos.';
comment on column public.lecturas_sensores.id_lectura_sensor is 'Clave primaria del registro de medición recibido.';
comment on column public.lecturas_sensores.id_dispositivo is 'Clave foránea del dispositivo que envió la medición.';
comment on column public.dispositivos_iot.id_dispositivo is 'Clave primaria del dispositivo IoT; el dispositivo actual se identifica como ESP32.';
comment on column public.sensores.id_dispositivo is 'Clave foránea del dispositivo ESP32 al que pertenece este sensor lógico.';
comment on column public.actuadores.id_actuador is 'Clave primaria del actuador.';
comment on column public.actuadores.id_dispositivo is 'Clave foránea del dispositivo IoT que administra el actuador.';
comment on column public.actuadores.id_usuario_creacion is 'Clave foránea del usuario que registró el actuador.';
comment on column public.actuadores.id_usuario_actualizacion is 'Clave foránea del usuario que modificó el actuador por última vez.';
comment on column public.alertas.id_alerta is 'Clave primaria de la alerta.';
comment on column public.alertas.id_dispositivo is 'Clave foránea opcional del dispositivo relacionado con la alerta.';
comment on column public.alertas.id_usuario_creacion is 'Clave foránea del usuario que reportó la alerta.';
comment on column public.alertas.id_usuario_actualizacion is 'Clave foránea del usuario que actualizó la alerta por última vez.';
comment on column public.alerta_historial.id_historial_alerta is 'Clave primaria del evento del historial de una alerta.';
comment on column public.alerta_historial.id_alerta is 'Clave foránea de la alerta cuyo estado cambió.';
comment on column public.alerta_historial.id_usuario_actor is 'Clave foránea del usuario que realizó el cambio de estado.';
comment on column public.configuracion_sistema.id_configuracion is 'Clave primaria de la fila única de configuración global.';
comment on column public.configuracion_sistema.id_usuario_actualizacion is 'Clave foránea del usuario que guardó la configuración por última vez.';
comment on column public.comandos.id_comando is 'Clave primaria de la orden registrada.';
comment on column public.comandos.id_actuador is 'Clave foránea del actuador al que se dirige la orden.';
comment on column public.comandos.id_usuario_solicitante is 'Clave foránea del usuario que solicitó el comando.';
comment on column public.configuracion_sistema.temperatura_maxima is 'Límite superior de temperatura en grados Celsius.';
comment on column public.configuracion_sistema.humedad_minima is 'Límite inferior permitido de humedad relativa en porcentaje.';
comment on column public.configuracion_sistema.humedad_maxima is 'Límite superior permitido de humedad relativa en porcentaje.';
comment on column public.configuracion_sistema.calidad_aire_maxima is 'Límite superior configurado para la lectura de calidad del aire.';
comment on column public.configuracion_sistema.intervalo_actualizacion_segundos is 'Frecuencia de actualización de lecturas, expresada en segundos.';
comment on column public.configuracion_sistema.minutos_sin_datos is 'Minutos sin lecturas antes de señalar un dispositivo sin datos recientes.';
comment on column public.configuracion_sistema.etiqueta_sensor is 'Etiqueta mostrada para el ESP32 en el panel.';
comment on column public.configuracion_sistema.notificaciones_habilitadas is 'Indica si el sistema debe emitir notificaciones.';
comment on column public.sensor_magnitud.id_sensor is 'Parte de la clave primaria compuesta y FK al sensor.';
comment on column public.sensor_magnitud.id_magnitud is 'Parte de la clave primaria compuesta y FK a la magnitud.';
comment on column public.lecturas.id_sensor is 'FK al par sensor-magnitud permitido.';
comment on column public.lecturas.id_magnitud is 'FK al par sensor-magnitud permitido.';

commit;
