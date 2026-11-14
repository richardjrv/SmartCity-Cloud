-- Novedades: la API aplica autorizacion; la Data API no tiene acceso directo.
CREATE TABLE IF NOT EXISTS public.novedades (
    id_novedad bigint GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
    titulo text NOT NULL CHECK (char_length(btrim(titulo)) BETWEEN 1 AND 120),
    imagen_ruta text NOT NULL UNIQUE,
    id_usuario_autor integer NOT NULL REFERENCES public.usuarios(id_usuario),
    creado_en timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX IF NOT EXISTS novedades_creado_en_idx ON public.novedades (creado_en DESC, id_novedad DESC);
ALTER TABLE public.novedades ENABLE ROW LEVEL SECURITY;
REVOKE ALL ON public.novedades FROM anon, authenticated;
REVOKE ALL ON SEQUENCE public.novedades_id_novedad_seq FROM anon, authenticated;
