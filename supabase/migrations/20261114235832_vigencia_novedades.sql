-- Las publicaciones existentes permanecen visibles durante un mes desde la migración.
ALTER TABLE public.novedades
    ADD COLUMN fecha_inicio date NOT NULL DEFAULT ((now() AT TIME ZONE 'America/Guayaquil')::date),
    ADD COLUMN fecha_fin date NOT NULL DEFAULT (((now() AT TIME ZONE 'America/Guayaquil')::date + interval '1 month' - interval '1 day')::date),
    ADD COLUMN eliminado_en timestamptz,
    ADD COLUMN id_usuario_eliminacion integer REFERENCES public.usuarios(id_usuario),
    ADD CONSTRAINT novedades_vigencia_valida CHECK (
        fecha_fin >= fecha_inicio AND fecha_fin < (fecha_inicio + interval '1 month')::date
    );
