-- Evita que nuevas tablas, secuencias o funciones del esquema public creadas
-- por el rol de migración postgres se expongan a la Data API.
alter default privileges in schema public
    revoke all privileges on tables from anon, authenticated;
alter default privileges in schema public
    revoke all privileges on sequences from anon, authenticated;
alter default privileges in schema public
    revoke execute on functions from anon, authenticated;
