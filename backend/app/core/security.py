from fastapi import Depends, Header, HTTPException

from app.db.database import get_db_connection
from app.services.supabase_auth import SupabaseAuthError, public_auth_error
from app.services.pin_auth import validar_token_y_obtener_sesion


def obtener_usuario_actual(authorization: str = Header(...)) -> dict:
    """Verifies the Supabase access token, then loads current app roles from Postgres."""
    if not authorization.startswith("Bearer "):
        raise HTTPException(status_code=401, detail="Formato de token inválido.")

    access_token = authorization.removeprefix("Bearer ").strip()
    if not access_token:
        raise HTTPException(status_code=401, detail="Sesión inválida.")

    try:
        auth_user, session_id, _ = validar_token_y_obtener_sesion(access_token)
    except SupabaseAuthError as error:
        raise public_auth_error(error, login=True) from error

    auth_user_id = auth_user.get("id")
    if not auth_user_id:
        raise HTTPException(status_code=401, detail="Supabase Auth no devolvió un usuario válido.")

    connection = None
    cursor = None
    try:
        connection = get_db_connection()
        cursor = connection.cursor()
        cursor.execute(
            """
            SELECT u.id, u.nombre, u.email, u.id_rol, COALESCE(u.estado, 'activo'),
                   EXISTS (
                       SELECT 1 FROM public.auth_pin_sessions AS p
                       WHERE p.session_id = %s AND p.user_id = u.id AND p.expires_at > NOW()
                   )
            FROM public.usuarios AS u
            WHERE u.auth_user_id = %s
            """,
            (session_id, auth_user_id),
        )
        row = cursor.fetchone()
    except Exception as error:
        raise HTTPException(status_code=503, detail="No se pudo cargar el perfil de la cuenta.") from error
    finally:
        if cursor:
            cursor.close()
        if connection:
            connection.close()

    if not row:
        raise HTTPException(status_code=403, detail="Confirma tu correo y vuelve a iniciar sesión.")
    if row[4] != "activo":
        raise HTTPException(status_code=403, detail="Tu cuenta está desactivada.")
    if not row[5]:
        raise HTTPException(status_code=428, detail="Completa la verificación de PIN para acceder a SmartCity Cloud.")

    return {
        "user_id": row[0],
        "nombre": row[1],
        "email": row[2] or auth_user.get("email", ""),
        "id_rol": row[3],
        "auth_user_id": auth_user_id,
        "auth_session_id": session_id,
        "access_token": access_token,
    }


def requerir_admin(usuario: dict = Depends(obtener_usuario_actual)) -> dict:
    """Authorization always comes from the current database row, never user metadata."""
    if usuario.get("id_rol") != 1:
        raise HTTPException(status_code=403, detail="Acceso denegado: se requieren permisos de administrador.")
    return usuario
