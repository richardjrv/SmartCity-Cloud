-- Seguridad de la Data API: el navegador usa Supabase Auth y obtiene los
-- datos de la aplicación exclusivamente desde el backend de Render.
-- No modifica filas ni el esquema funcional; el backend conectado por
-- PostgreSQL y Supabase Auth conservan sus permisos.

begin;

revoke all privileges on all tables in schema public from anon, authenticated;
revoke all privileges on all sequences in schema public from anon, authenticated;
revoke execute on all functions in schema public from anon, authenticated;

-- Denegación explícita en las tablas actuales. El acceso de PostgreSQL del
-- backend (owner) no usa estos roles; service_role conserva el bypass de RLS.
do $$
declare
    objeto record;
begin
    for objeto in
        select c.relname
        from pg_class as c
        join pg_namespace as n on n.oid = c.relnamespace
        where n.nspname = 'public'
          and c.relkind in ('r', 'p')
    loop
        execute format(
            'alter table public.%I enable row level security',
            objeto.relname
        );
        execute format(
            'drop policy if exists api_solo_backend on public.%I',
            objeto.relname
        );
        execute format(
            'create policy api_solo_backend on public.%I for all to anon, authenticated using (false) with check (false)',
            objeto.relname
        );
    end loop;
end
$$;

commit;
