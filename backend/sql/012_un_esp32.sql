-- La maqueta usa un único controlador con el identificador ESP32.
-- Conserva los dispositivos y lecturas anteriores como historial, pero desactiva los nodos de prueba.
begin;

update public.dispositivos_iot
set activo = false,
    actualizado_en = now()
where sensor_id <> 'ESP32-MAQUETA';

update public.dispositivos_iot
set sensor_id = 'ESP32',
    nombre = 'ESP32',
    activo = true,
    actualizado_en = now()
where sensor_id = 'ESP32-MAQUETA';

update public.dispositivos_iot
set nombre = 'ESP32', activo = true, actualizado_en = now()
where sensor_id = 'ESP32';

update public.configuracion_sistema
set settings = jsonb_set(settings, '{sensorLabel}', to_jsonb('ESP32'::text), true),
    updated_at = now()
where id = 1;

create or replace view public.controladores
with (security_invoker = true)
as
select sensor_id as id_controlador,
       nombre,
       firmware_version as modelo,
       ubicacion,
       observaciones as descripcion,
       intervalo_esperado_segundos,
       activo as estado
from public.dispositivos_iot
where sensor_id = 'ESP32' and activo = true;

commit;
