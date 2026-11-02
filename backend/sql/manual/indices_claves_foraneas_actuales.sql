-- Índices que respaldan claves foráneas existentes y evitan escaneos completos
-- al consultar o actualizar sus filas relacionadas. 014 los conserva tras
-- renombrar las columnas y usa IF NOT EXISTS para no duplicarlos.
create index if not exists idx_usuarios_id_rol
    on public.usuarios (id_rol);
create index if not exists idx_alerta_historial_id_usuario_actor
    on public.alerta_historial (actor_id);
create index if not exists idx_configuracion_id_usuario_actualizacion
    on public.configuracion_sistema (updated_by);
create index if not exists idx_sensor_magnitud_id_magnitud
    on public.sensor_magnitud (id_magnitud);
create index if not exists idx_comandos_id_usuario_solicitante
    on public.comandos (solicitado_por);
