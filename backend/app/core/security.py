from fastapi import Depends, Header, HTTPException

from app.db.database import get_db_connection
from app.services.supabase_auth import SupabaseAuthError, get_user, public_auth_error


def obtener_usuario_actual(authorization: str = Header(...)) -> dict:
    """Verifies the Supabase access token, then loads current app roles from Postgres."""
    if not authorization.startswith("Bearer "):
        raise HTTPException(status_code=401, detail="Formato de token inválido.")

    access_token = authorization.removeprefix("Bearer ").strip()
    if not access_token:
        raise HTTPException(status_code=401, detail="Sesión inválida.")

    try:
        auth_user = get_user(access_token)
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
            SELECT id, nombre, email, id_rol, COALESCE(estado, 'activo')
            FROM public.usuarios
            WHERE auth_user_id = %s
            """,
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
        "auth_user_id": auth_user_id,
        "access_token": access_token,
    }


def requerir_admin(usuario: dict = Depends(obtener_usuario_actual)) -> dict:
    """Authorization always comes from the current database row, never user metadata."""
    if usuario.get("id_rol") != 1:
        raise HTTPException(status_code=403, detail="Acceso denegado: se requieren permisos de administrador.")
    return usuario
