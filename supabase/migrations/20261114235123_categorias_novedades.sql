-- La categoría por defecto conserva la compatibilidad con publicaciones anteriores.
ALTER TABLE public.novedades
    ADD COLUMN categoria text NOT NULL DEFAULT 'novedad_sistema'
    CHECK (categoria IN ('comunicado_oficial', 'aviso_importante', 'novedad_sistema', 'mantenimiento_programado'));
