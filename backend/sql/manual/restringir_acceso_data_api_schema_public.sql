-- El frontend usa Supabase Auth, no consulta public por PostgREST/GraphQL.
-- Quitar USAGE bloquea la Data API a anon/authenticated incluso si un objeto
-- futuro recibiera un GRANT accidental. postgres y service_role conservan U.
revoke usage on schema public from public, anon, authenticated;
