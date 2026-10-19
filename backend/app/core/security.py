from fastapi import Depends, Header, HTTPException

from app.db.database import get_db_connection
from app.services.supabase_auth import SupabaseAuthError, public_auth_error
from app.services.supabase_sessions import validar_token_y_obtener_sesion

ROLE_ADMIN = 1
ROLE_USER = 2
ROLE_OPERATOR = 3


def extraer_token_bearer(authorization: str) -> str:
    """Parse an HTTP Bearer credential without case- or whitespace-sensitive checks."""
    partes = authorization.strip().split(None, 1)
    if len(partes) != 2 or partes[0].casefold() != "bearer" or not partes[1].strip():
        raise HTTPException(status_code=401, detail="Formato de token inválido.")
    return partes[1].strip()


def obtener_usuario_actual(authorization: str = Header(...)) -> dict:
    """Verifies the Supabase access token, then loads current app roles from Postgres."""
    access_token = extraer_token_bearer(authorization)

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
            """SELECT u.id, u.nombre, u.email, u.id_rol, COALESCE(u.estado, 'activo'), r.nombre
               FROM public.usuarios AS u LEFT JOIN public.roles AS r ON r.id = u.id_rol
               WHERE u.auth_user_id = %s""",
            (auth_user_id,),
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
    return {
        "user_id": row[0],
        "nombre": row[1],
        "email": row[2] or auth_user.get("email", ""),
        "id_rol": row[3],
        "rol": row[5],
        "auth_user_id": auth_user_id,
        "auth_session_id": session_id,
        "access_token": access_token,
    }


def requerir_admin(usuario: dict = Depends(obtener_usuario_actual)) -> dict:
    """Authorization always comes from the current database row, never user metadata."""
    if usuario.get("id_rol") != ROLE_ADMIN:
        raise HTTPException(status_code=403, detail="Acceso denegado: se requieren permisos de administrador.")
    return usuario


def requerir_gestor_alertas(usuario: dict = Depends(obtener_usuario_actual)) -> dict:
    """Administrators and operators may follow up alerts; citizen accounts may not."""
    if usuario.get("id_rol") not in (ROLE_ADMIN, ROLE_OPERATOR):
        raise HTTPException(status_code=403, detail="Acceso denegado: se requieren permisos de operación.")
    return usuario


def requerir_operador(usuario: dict = Depends(obtener_usuario_actual)) -> dict:
    """Only the operator role may change shared system configuration."""
    if usuario.get("id_rol") != ROLE_OPERATOR:
        raise HTTPException(status_code=403, detail="Acceso denegado: se requieren permisos de Operador.")
    return usuario
