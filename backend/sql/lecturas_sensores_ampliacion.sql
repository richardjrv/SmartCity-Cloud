-- Amplía lecturas_sensores para HC-SR04, lluvia, LDR, nivel de agua y TCRT5000.
-- Las columnas nuevas son opcionales para conservar compatibilidad con lecturas antiguas.
alter table public.lecturas_sensores
    add column if not exists distancia_cm numeric(8, 2),
    add column if not exists lluvia_detectada boolean,
    add column if not exists luminosidad numeric(10, 2),
    add column if not exists nivel_agua numeric(10, 2),
    add column if not exists reflectancia_tcrt5000 numeric(10, 2),
    add column if not exists tcrt5000_detectado boolean;

-- Cada sensor puede enviar únicamente la variable que mide.
alter table public.lecturas_sensores
    alter column temperatura drop not null,
    alter column humedad drop not null,
    alter column calidad_aire drop not null;

comment on column public.lecturas_sensores.distancia_cm is
    'Distancia en centímetros reportada por el HC-SR04.';
comment on column public.lecturas_sensores.lluvia_detectada is
    'Presencia de lluvia según el umbral configurado; no representa milímetros de precipitación.';
comment on column public.lecturas_sensores.luminosidad is
    'Lectura cruda o calibrada del LDR; la unidad depende de la calibración del dispositivo.';
comment on column public.lecturas_sensores.nivel_agua is
    'Lectura cruda o porcentaje calibrado del sensor de nivel de agua.';
comment on column public.lecturas_sensores.reflectancia_tcrt5000 is
    'Lectura analógica de reflectancia del TCRT5000, según la calibración del dispositivo.';
comment on column public.lecturas_sensores.tcrt5000_detectado is
    'Estado digital de detección reportado por el TCRT5000.';

create index if not exists idx_lecturas_sensores_sensor_fecha_desc
    on public.lecturas_sensores (sensor_id, fecha_hora desc, id desc);
