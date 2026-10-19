# SQL y migraciones

Los archivos numerados documentan cambios de esquema en el orden previsto sobre una base inicial que ya contiene `usuarios`, `roles` y `lecturas_sensores`. **No ejecutes la lista completa sobre la base conectada**: las migraciones ya aplicadas se registran en Supabase y no se deben repetir.

| Archivo | Propósito |
| --- | --- |
| `001_alertas_seguimiento.sql` | Crea el centro de reportes y alertas. |
| `002_alertas_historial.sql` | Añade el historial de cambios de alertas. |
| `003_supabase_auth_migration.sql` | Vincula los perfiles de la aplicación con Supabase Auth. |
| `004_pin_acceso.sql` | Añade PIN personal y desafíos de acceso. |
| `005_auth_pin_session_gate.sql` | Valida el PIN contra la sesión autenticada. Requiere `004`. |
| `006_roles_operador.sql` | Asegura el rol Operador con `id_rol=3`. |
| `007_lecturas_sensores_ampliacion.sql` | Añade campos de sensores opcionales. |
| `008_actuadores.sql` | Catálogo de dispositivos y actuadores. |
| `009_smartcity_sensor_insights.sql` | Consultas e índices de apoyo para lecturas. |
| `010_configuracion_sistema.sql` | Guarda límites compartidos y habilita RLS sin acceso público. |
| `011_modelo_logico_sensores.sql` | Integra controladores, sensores, magnitudes, lecturas normalizadas y comandos pendientes sin reemplazar el formato que ya usa el ESP32. |

`manual/admin_user_id_to_1.sql` es una corrección puntual de datos de cuenta; no la ejecutes como parte de una instalación nueva.

Antes de aplicar cualquier cambio en producción, compara el SQL con el historial de migraciones del proyecto Supabase. La API se conecta con `DATABASE_URL`; no expongas estas tablas a las claves públicas del navegador.
