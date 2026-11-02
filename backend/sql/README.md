# SQL y migraciones

Los archivos numerados documentan cambios de esquema en el orden previsto sobre una base inicial que ya contiene `usuarios`, `roles` y `lecturas_sensores`. **No ejecutes la lista completa sobre la base conectada**: las migraciones ya aplicadas se registran en Supabase y no se deben repetir.

| Archivo | Propósito |
| --- | --- |
| `001_alertas_seguimiento.sql` | Crea el centro de reportes y alertas. |
| `002_alertas_historial.sql` | Añade el historial de cambios de alertas. |
| `003_supabase_auth_migration.sql` | Vincula los perfiles de la aplicación con Supabase Auth. |
| `004_pin_acceso.sql` | Migración histórica de PIN; sus tablas y datos se archivan en `private` mediante `013`. |
| `005_auth_pin_session_gate.sql` | Migración histórica del PIN. Requiere `004`; la aplicación vigente ya no usa este flujo. |
| `006_roles_operador.sql` | Asegura el rol Operador con `id_rol=3`. |
| `007_lecturas_sensores_ampliacion.sql` | Añade campos de sensores opcionales. |
| `008_actuadores.sql` | Catálogo de dispositivos y actuadores. |
| `009_smartcity_sensor_insights.sql` | Consultas e índices de apoyo para lecturas. |
| `010_configuracion_sistema.sql` | Guarda límites compartidos y habilita RLS sin acceso público. |
| `011_modelo_logico_sensores.sql` | Integra controladores, sensores, magnitudes, lecturas normalizadas y comandos pendientes sin reemplazar el formato que ya usa el ESP32. |
| `012_un_esp32.sql` | Deja un solo controlador activo e identificable como `ESP32`; conserva inactivos los dispositivos históricos y de prueba. |
| `013_espanol_y_archivo_pin_legado.sql` | Documenta el esquema en español, archiva en `private` el acceso PIN que ya no usa la aplicación, retira columnas de autenticación sin uso y traduce `firmware_version` a `version_firmware`. Conserva los registros históricos. |
| `014_claves_especificas_y_relaciones.sql` | Cambia claves genéricas por nombres explícitos en español, agrega las relaciones faltantes entre lecturas/alertas y el dispositivo, normaliza la configuración en columnas e indexa las claves foráneas. |

`manual/admin_user_id_to_1.sql` es una corrección puntual de datos de cuenta; no la ejecutes como parte de una instalación nueva.

`manual/restringir_permisos_predeterminados_postgres.sql` y `manual/seguridad_api_solo_backend.sql` son cambios independientes y compatibles con el esquema actual. El primero evita que nuevas tablas, secuencias y funciones públicas creadas por el rol de migración `postgres` reciban acceso de la Data API. El segundo quita los permisos actuales de `anon` y `authenticated`, activa RLS y define una política de denegación explícita por tabla. Ambos se aplicaron en producción el 26 de octubre de 2026. No modifican filas ni cambian el acceso de Supabase Auth; la aplicación consulta los datos mediante Render y conserva el acceso PostgreSQL del backend. `service_role` sigue reservado para el servidor y nunca debe exponerse al navegador.

`manual/restringir_acceso_data_api_schema_public.sql` quita también el permiso `USAGE` heredado del esquema `public` para `PUBLIC`, `anon` y `authenticated`. Se aplicó en producción el 26 de octubre de 2026. El frontend solo usa endpoints de Supabase Auth, mientras Render consulta PostgreSQL directamente; `postgres` y `service_role` conservan `USAGE`. Así, la Data API no queda habilitada para los roles del navegador aunque una tabla futura recibiera accidentalmente permisos.

`manual/indices_claves_foraneas_actuales.sql` agrega cinco índices faltantes a las FK actuales y se aplicó en producción el 26 de octubre de 2026. `014_claves_especificas_y_relaciones.sql` ya contiene esos nombres con `IF NOT EXISTS`, por lo que la futura migración coordinada los reutilizará después de renombrar las columnas sin crear duplicados.

La aplicación vigente usa Supabase Auth para el acceso. `013` conserva los datos históricos del PIN en el esquema privado, quita del perfil las columnas de PIN y la columna vacía `password_hash`, y deja activo el catálogo del único `ESP32`. `014` da nombres de clave explícitos a los identificadores (por ejemplo, `id_usuario`, `id_rol`, `id_dispositivo`, `id_lectura_sensor` e `id_usuario_solicitante`) y convierte los ajustes JSON en columnas independientes con validaciones. El backend adapta esas columnas al contrato JSON camelCase que ya consume la interfaz. La migración incorpora `FK` a las lecturas y alertas solo después de comprobar que no existan registros huérfanos, y deja que un dispositivo tenga varios actuadores. Se mantienen los dispositivos y lecturas históricas.

`014` renombra columnas usadas por el backend y requiere una publicación coordinada del backend y la migración, porque ninguno de los dos puede quedar activo por separado. No la ejecutes sola ni subas el backend solo. Los archivos numerados son el historial del esquema y no deben volver a ejecutarse en bloque sobre producción.

## Mapa de relaciones después de `014`

- `roles.id_rol` → `usuarios.id_rol`; cada perfil pertenece a un rol.
- `usuarios.id_usuario_auth` → `auth.users.id`; enlaza el perfil local con Supabase Auth.
- `dispositivos_iot.id_dispositivo` → `lecturas_sensores.id_dispositivo` y `sensores.id_dispositivo`; un dispositivo puede tener muchas lecturas y varios sensores lógicos.
- `sensores.id_sensor` + `magnitudes.id_magnitud` → `sensor_magnitud`; la pareja es su clave primaria compuesta y evita repetir la misma magnitud para un sensor.
- `lecturas.id_sensor` + `lecturas.id_magnitud` → la pareja en `sensor_magnitud`; así una lectura solo puede usar una magnitud admitida por ese sensor.
- `actuadores.id_dispositivo` → `dispositivos_iot.id_dispositivo`; varios actuadores pueden asociarse al único ESP32.
- `comandos.id_actuador` → `actuadores.id_actuador`; `comandos.id_usuario_solicitante` → `usuarios.id_usuario`.
- `alerta_historial.id_alerta` → `alertas.id_alerta`; su `id_usuario_actor` identifica quién cambió el estado.
- `auditoria.id_usuario` → `usuarios.id_usuario`. `auditoria.id_recurso` queda sin FK porque puede representar recursos de módulos distintos.
- `configuracion_sistema.id_usuario_actualizacion` → `usuarios.id_usuario`; registra quién guardó los ajustes. Los límites y opciones viven en columnas tipadas, no dentro de un campo JSON.

`lecturas_sensores` conserva el formato recibido del firmware para el historial y compatibilidad actual; el servicio también replica cada magnitud al modelo normalizado `sensores` / `magnitudes` / `lecturas`.
El catálogo conserva identificadores históricos inactivos, pero la base impide que haya más de un dispositivo activo y exige que el activo sea `ESP32`.

Antes de aplicar cualquier cambio en producción, compara el SQL con el historial de migraciones del proyecto Supabase. La API se conecta con `DATABASE_URL`; no expongas estas tablas a las claves públicas del navegador.
