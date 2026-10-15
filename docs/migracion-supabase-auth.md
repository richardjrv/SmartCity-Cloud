# Migración a Supabase Auth

La autenticación web usa Supabase Auth. `public.usuarios.id` continúa siendo entero para conservar las FK y los datos de negocio. `public.usuarios.auth_user_id` enlaza cada cuenta con `auth.users.id`; el rol sigue en la base de datos y el registro público siempre crea usuarios normales (`id_rol = 2`).

## Pasos para activar

1. En Supabase, habilita Email en **Authentication → Sign In / Providers** y deja activada la confirmación de correo.
2. En **Authentication → URL Configuration**, configura el Site URL del sitio publicado y agrega a Redirect URLs la URL exacta del sitio y la URL local que usarás para desarrollo.
3. En Render, configura estas variables del servicio backend:
   - `SUPABASE_URL`: Project URL del proyecto Supabase.
   - `SUPABASE_ANON_KEY`: publishable key (o la anon key legacy). Es una clave pública, pero solo se configura en el servidor en esta arquitectura.
   - `SUPABASE_SERVICE_ROLE_KEY`: secret/service_role key, solo para que el endpoint administrativo pueda eliminar usuarios Auth. Nunca la pongas en el frontend.
   - `FRONTEND_URL`: URL del sitio a la que Supabase debe regresar al completar recuperación de contraseña. Debe estar en Redirect URLs.
   - Conserva `DATABASE_URL` y las demás variables existentes.
4. Revisa y ejecuta una sola vez `backend/sql/supabase_auth_migration.sql` en el SQL Editor del proyecto correcto. La transacción aborta si no encuentra el rol `id=2` o detecta correos duplicados normalizados.
5. Publica el backend y el frontend actualizados.
6. Crea una cuenta nueva desde el sitio y confirma el correo. El trigger enlaza la cuenta y crea su perfil interno. Si coincide con una fila de prueba existente, la enlaza, elimina sus hashes locales y le deja rol de usuario.
7. Promueve al administrador de confianza manualmente después de confirmar esa cuenta. Sustituye el correo:

   ```sql
   update public.usuarios as u
   set id_rol = 1
   from auth.users as a
   where u.auth_user_id = a.id
     and lower(a.email) = lower('admin@tudominio.com');
   ```

## Notas de seguridad y alcance

- El registro no puede asignar roles administrativos. El nombre enviado en metadata es solo información de perfil.
- El frontend guarda el access token y el refresh token de Supabase; el backend valida cada access token consultando Supabase Auth y obtiene el rol desde `public.usuarios`.
- `public.usuarios` queda con RLS habilitado y sin permisos directos para `anon`/`authenticated`; el acceso pasa por FastAPI.
- El PIN propio de cuatro cifras deja de formar parte del login. Si se necesita un segundo factor, implementar Supabase MFA (por ejemplo TOTP) en una etapa aparte.
- Las cuentas de prueba locales no se importan con su hash `pbkdf2_sha256`. El usuario debe registrarse o restablecer su contraseña con Supabase Auth. Supabase documenta migración de hash para bcrypt/Argon2, no este formato.
- El servicio de correo predeterminado de Supabase tiene límites de envío; para producción configura SMTP propio.
- Esta migración no se ejecuta automáticamente por el código. El archivo SQL debe revisarse y ejecutarse manualmente en el proyecto Supabase.
