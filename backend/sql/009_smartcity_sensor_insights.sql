-- SmartCity Cloud: catálogo de dispositivos y consultas listas para el dashboard.
-- Requiere que public.lecturas_sensores ya exista con las columnas que usa FastAPI.
-- Ejecutar manualmente en Supabase > SQL Editor después de revisar el esquema.
-- No cambia ni borra las lecturas existentes y no expone las tablas al navegador.

begin;

do $$
begin
    if to_regclass('public.lecturas_sensores') is null then
        raise exception 'No existe public.lecturas_sensores. Revisa el nombre de la tabla antes de continuar.';
    end if;

    if not exists (
        select 1 from pg_attribute
        where attrelid = 'public.lecturas_sensores'::regclass
          and attname = 'id' and not attisdropped
    ) then
        raise exception 'lecturas_sensores necesita la columna id para ordenar lecturas con la misma fecha.';
    end if;

    if not exists (
        select 1 from pg_attribute
        where attrelid = 'public.lecturas_sensores'::regclass
          and attname = 'sensor_id' and not attisdropped
    ) then
        raise exception 'No existe la columna sensor_id en lecturas_sensores.';
    end if;

    if not exists (
        select 1 from pg_attribute
        where attrelid = 'public.lecturas_sensores'::regclass
          and attname = 'fecha_hora' and not attisdropped
    ) then
        raise exception 'No existe la columna fecha_hora en lecturas_sensores.';
    end if;

    if not exists (
        select 1 from pg_attribute
        where attrelid = 'public.lecturas_sensores'::regclass
          and attname = 'temperatura' and not attisdropped
    ) or not exists (
        select 1 from pg_attribute
        where attrelid = 'public.lecturas_sensores'::regclass
          and attname = 'humedad' and not attisdropped
    ) or not exists (
        select 1 from pg_attribute
        where attrelid = 'public.lecturas_sensores'::regclass
          and attname = 'calidad_aire' and not attisdropped
    ) then
        raise exception 'Falta una columna de medición requerida: temperatura, humedad o calidad_aire.';
    end if;
end
$$;

-- Registro de sensores: identidad, ubicación y frecuencia esperada de reporte.
-- El ESP32 nunca debe conectarse directamente a Postgres; enviará datos a FastAPI.
create table if not exists public.dispositivos_iot (
    sensor_id text primary key check (btrim(sensor_id) <> ''),
    nombre text not null default 'Sensor sin nombre',
    ubicacion text,
    latitud double precision,
    longitud double precision,
    firmware_version text,
    intervalo_esperado_segundos integer not null default 300
        check (intervalo_esperado_segundos between 10 and 86400),
    activo boolean not null default true,
    observaciones text,
    creado_en timestamptz not null default now(),
    actualizado_en timestamptz not null default now(),
    constraint dispositivos_iot_coordenadas_validas check (
        (latitud is null and longitud is null)
        or (
            latitud between -90 and 90
            and longitud between -180 and 180
        )
    )
);

comment on table public.dispositivos_iot is
    'Catálogo de sensores IoT: ubicación, firmware, intervalo y estado administrativo.';
comment on column public.dispositivos_iot.intervalo_esperado_segundos is
    'Frecuencia estimada de envío del dispositivo; se usa para marcar sensores sin actualización.';

-- Optimiza las dos consultas que usa el sitio: últimas lecturas globales e historial por sensor.
create index if not exists idx_lecturas_sensores_fecha_hora_desc
    on public.lecturas_sensores (fecha_hora desc);

create index if not exists idx_lecturas_sensores_sensor_fecha_desc
    on public.lecturas_sensores (sensor_id, fecha_hora desc, id desc);

-- Mantén los datos protegidos: la aplicación actual consulta PostgreSQL desde FastAPI.
-- No se crean políticas para anon/authenticated ni se habilita acceso del navegador.
alter table public.dispositivos_iot enable row level security;
revoke all on table public.dispositivos_iot from public, anon, authenticated;

-- Esquema interno para vistas de consulta. No agregues "private" a los esquemas expuestos
-- de la Data API de Supabase.
create schema if not exists private;
revoke all on schema private from public, anon, authenticated;

-- Una fila por sensor, incluyendo dispositivos registrados sin lecturas y sensores
-- detectados en lecturas históricas aunque todavía no estén en el catálogo.
create or replace view private.v_estado_actual_sensores
with (security_invoker = true)
as
with ultima_lectura as (
    select distinct on (l.sensor_id)
        l.sensor_id,
        l.temperatura,
        l.humedad,
        l.calidad_aire,
        l.fecha_hora
    from public.lecturas_sensores as l
    where l.sensor_id is not null
    order by l.sensor_id, l.fecha_hora desc, l.id desc
)
select
    coalesce(d.sensor_id, u.sensor_id) as sensor_id,
    d.nombre,
    d.ubicacion,
    d.latitud,
    d.longitud,
    d.firmware_version,
    d.activo,
    u.temperatura,
    u.humedad,
    u.calidad_aire,
    u.fecha_hora as ultima_lectura,
    case
        when d.sensor_id is not null and not d.activo then 'desactivado'
        when u.fecha_hora is null then 'sin_lecturas'
        when now() - u.fecha_hora > make_interval(
            secs => coalesce(d.intervalo_esperado_segundos, 300) * 2
        ) then 'sin_actualizacion'
        else 'en_linea'
    end as estado
from public.dispositivos_iot as d
full outer join ultima_lectura as u on u.sensor_id = d.sensor_id;

comment on view private.v_estado_actual_sensores is
    'Última lectura y estado estimado por sensor; ventana de desconexión = 2 × intervalo configurado.';

-- Base para gráficas y reportes horarios. Calcula datos reales almacenados, no muestras demo.
create or replace view private.v_resumen_horario_sensores
with (security_invoker = true)
as
select
    date_trunc('hour', fecha_hora) as hora,
    sensor_id,
    count(*) as cantidad_lecturas,
    round(avg(temperatura)::numeric, 2) as temperatura_promedio,
    round(min(temperatura)::numeric, 2) as temperatura_minima,
    round(max(temperatura)::numeric, 2) as temperatura_maxima,
    round(avg(humedad)::numeric, 2) as humedad_promedio,
    round(avg(calidad_aire)::numeric, 2) as calidad_aire_promedio,
    max(fecha_hora) as ultima_lectura
from public.lecturas_sensores
where fecha_hora is not null
group by date_trunc('hour', fecha_hora), sensor_id;

comment on view private.v_resumen_horario_sensores is
    'Agregados horarios por sensor para gráficas y reportes sin enviar cada lectura al frontend.';

commit;

-- Comprobación manual después de ejecutar el script:
-- select * from private.v_estado_actual_sensores order by sensor_id;
-- select * from private.v_resumen_horario_sensores order by hora desc limit 24;
