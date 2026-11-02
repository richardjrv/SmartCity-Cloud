-- Ordena el esquema activo en español y conserva los datos del PIN legado.
-- La aplicación vigente autentica con Supabase Auth y no consulta estas tablas PIN.
-- No elimina lecturas, sensores, usuarios, alertas ni historial.

begin;

-- Archiva los retos y sesiones PIN fuera del esquema expuesto por la API.
alter table public.auth_pin_challenges set schema private;
alter table private.auth_pin_challenges rename to retos_pin_legados;
alter table private.retos_pin_legados rename column id to id_reto;
alter table private.retos_pin_legados rename column user_id to usuario_id;
alter table private.retos_pin_legados rename column purpose to proposito;
alter table private.retos_pin_legados rename column expires_at to expira_en;
alter table private.retos_pin_legados rename column failed_attempts to intentos_fallidos;
alter table private.retos_pin_legados rename column consumed_at to consumido_en;
alter table private.retos_pin_legados rename column created_at to creado_en;
alter table private.retos_pin_legados rename column auth_session_id to id_sesion_auth;

alter table public.auth_pin_sessions set schema private;
alter table private.auth_pin_sessions rename to sesiones_pin_legadas;
alter table private.sesiones_pin_legadas rename column session_id to id_sesion;
alter table private.sesiones_pin_legadas rename column user_id to usuario_id;
alter table private.sesiones_pin_legadas rename column verified_at to verificado_en;
alter table private.sesiones_pin_legadas rename column expires_at to expira_en;

-- Traduce las restricciones e índices de los objetos archivados.
alter table private.retos_pin_legados
    rename constraint auth_pin_challenges_pkey to retos_pin_legados_pkey;
alter table private.retos_pin_legados
    rename constraint auth_pin_challenges_user_id_fkey to retos_pin_legados_usuario_id_fkey;
alter table private.retos_pin_legados
    rename constraint auth_pin_challenges_purpose_check to retos_pin_legados_proposito_check;
alter table private.retos_pin_legados
    rename constraint auth_pin_challenges_failed_attempts_check to retos_pin_legados_intentos_fallidos_check;
alter table private.sesiones_pin_legadas
    rename constraint auth_pin_sessions_pkey to sesiones_pin_legadas_pkey;
alter table private.sesiones_pin_legadas
    rename constraint auth_pin_sessions_user_id_fkey to sesiones_pin_legadas_usuario_id_fkey;

alter index private.idx_auth_pin_challenges_user_created
    rename to idx_retos_pin_legados_usuario_creado;
alter index private.idx_auth_pin_challenges_expiration
    rename to idx_retos_pin_legados_expiracion;
alter index private.idx_auth_pin_challenges_session
    rename to idx_retos_pin_legados_sesion;
alter index private.idx_auth_pin_sessions_user
    rename to idx_sesiones_pin_legadas_usuario;

alter table private.retos_pin_legados enable row level security;
alter table private.sesiones_pin_legadas enable row level security;
revoke all on table private.retos_pin_legados, private.sesiones_pin_legadas
    from public, anon, authenticated;
comment on table private.retos_pin_legados is
    'Archivo de retos PIN de una versión anterior del acceso. Se conserva por trazabilidad; la aplicación actual no lo consulta.';
comment on table private.sesiones_pin_legadas is
    'Archivo de sesiones PIN de una versión anterior del acceso. Se conserva por trazabilidad; la aplicación actual no lo consulta.';

-- Conserva los hashes PIN existentes en un archivo privado antes de retirar
-- esas columnas del perfil activo. Nunca se guardó el PIN original.
create table private.pines_usuarios_legados (
    usuario_id integer primary key references public.usuarios(id) on delete cascade,
    hash_pin text,
    intentos_pin smallint not null default 0,
    bloqueado_hasta timestamptz,
    archivado_en timestamptz not null default now()
);

insert into private.pines_usuarios_legados (usuario_id, hash_pin, intentos_pin, bloqueado_hasta)
select id, pin_hash, pin_intentos, pin_bloqueado_hasta
from public.usuarios
where pin_hash is not null
   or pin_intentos <> 0
   or pin_bloqueado_hasta is not null
on conflict (usuario_id) do nothing;

alter table private.pines_usuarios_legados enable row level security;
revoke all on table private.pines_usuarios_legados from public, anon, authenticated;
comment on table private.pines_usuarios_legados is
    'Archivo privado de hashes y bloqueos PIN de una versión anterior del acceso; no contiene PIN en texto claro.';

alter table public.usuarios
    drop column pin_hash,
    drop column pin_intentos,
    drop column pin_bloqueado_hasta,
    drop column password_hash;

-- Nombre español para la versión del firmware; las vistas conservan su contrato.
alter table public.dispositivos_iot rename column firmware_version to version_firmware;

-- Descripciones legibles en español en el esquema activo.
comment on table public.roles is 'Catálogo de roles y permisos generales de la aplicación.';
comment on table public.usuarios is 'Perfiles de la aplicación vinculados a cuentas de Supabase Auth.';
comment on table public.lecturas_sensores is 'Historial de mediciones recibido del único ESP32; conserva datos anteriores para consulta.';
comment on table public.auditoria is 'Registro de acciones administrativas y cambios realizados en la aplicación.';
comment on table public.dispositivos_iot is 'Catálogo de dispositivos IoT. El dispositivo activo del proyecto es ESP32.';
comment on table public.sensores is 'Inventario de sensores físicos instalados y asociados al ESP32.';
comment on table public.sensor_magnitud is 'Relación entre cada sensor físico y las magnitudes que puede medir.';
comment on table public.magnitudes is 'Catálogo de magnitudes medidas, sus nombres, descripciones y unidades.';
comment on table public.lecturas is 'Historial normalizado por sensor y magnitud; lo utiliza el catálogo de sensores.';
comment on table public.actuadores is 'Catálogo de actuadores asociados al ESP32 y sus estados solicitados o confirmados.';
comment on table public.comandos is 'Historial de órdenes enviadas a actuadores; no confirma ejecución física por sí solo.';
comment on table public.alertas is 'Avisos de usuarios y alertas asociadas a sensores.';
comment on table public.alerta_historial is 'Trazabilidad de estados y observaciones de las alertas.';
comment on table public.configuracion_sistema is 'Límites y preferencias globales administrados por el backend.';
comment on view public.controladores is 'Vista de compatibilidad del catálogo de dispositivos; en este proyecto representa un único ESP32.';

comment on column public.usuarios.username is
    'Alias público del perfil; se conserva este nombre porque forma parte del contrato actual de la API.';
comment on column public.usuarios.auth_user_id is
    'Identificador de la cuenta correspondiente en Supabase Auth.';
comment on column public.lecturas_sensores.sensor_id is
    'Identificador enviado por el firmware; para nuevas lecturas debe ser ESP32.';
comment on column public.dispositivos_iot.sensor_id is
    'Identificador del dispositivo usado por el firmware y por la API; para el dispositivo actual es ESP32.';
comment on column public.dispositivos_iot.version_firmware is
    'Versión del firmware instalado en el dispositivo.';
comment on column public.configuracion_sistema.settings is
    'Objeto JSON de configuración; conserva claves en inglés para mantener el contrato del backend y la interfaz.';
comment on column public.configuracion_sistema.updated_by is
    'Usuario que guardó la configuración por última vez.';
comment on column public.configuracion_sistema.updated_at is
    'Fecha y hora del último cambio de configuración.';

commit;
