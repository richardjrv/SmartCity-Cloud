from fastapi import APIRouter, Depends, Header, HTTPException

from app.core.security import obtener_usuario_actual
from app.db.database import get_db_connection
from app.models.auth import EstablecerPasswordData, LoginData, RecuperarPasswordData, RefreshData, RegisterData
from app.services.supabase_auth import (
    SupabaseAuthError,
    public_auth_error,
    refresh_session,
    request_password_recovery,
    sign_in,
    sign_out,
    sign_up,
    update_password,
)

router = APIRouter(tags=["Autenticación"])


def _app_user(auth_user_id: str):
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
        return cursor.fetchone()
    finally:
        if cursor:
            cursor.close()
        if connection:
            connection.close()


def _session_response(session: dict):
    auth_user = session.get("user") or {}
    auth_user_id = auth_user.get("id")
    if not auth_user_id:
        raise HTTPException(status_code=401, detail="Supabase Auth no devolvió un usuario válido.")
    try:
        user = _app_user(auth_user_id)
    except Exception as error:
        raise HTTPException(status_code=503, detail="No se pudo cargar el perfil de la cuenta.") from error
    if not user:
        raise HTTPException(status_code=403, detail="Confirma tu correo y vuelve a iniciar sesión.")
    if user[4] != "activo":
        raise HTTPException(status_code=403, detail="Tu cuenta está desactivada.")
    return {
        "access_token": session.get("access_token"),
        "refresh_token": session.get("refresh_token"),
        "expires_in": session.get("expires_in", 3600),
        "id": user[0],
        "user_id": user[0],
        "auth_user_id": auth_user_id,
        "nombre": user[1],
        "id_rol": user[3],
    }


@router.post("/registro")
def registrar_usuario(usuario: RegisterData):
    nombre = usuario.nombre.strip()
    if not nombre:
        raise HTTPException(status_code=400, detail="Ingresa tu nombre.")
    try:
        result = sign_up(str(usuario.email).strip().lower(), usuario.password, nombre)
    except SupabaseAuthError as error:
        raise public_auth_error(error) from error

    auth_user = result.get("user") or {}
    return {
        "mensaje": "Cuenta creada. Revisa tu correo y confirma la dirección antes de iniciar sesión.",
        "requiere_confirmacion": not bool(auth_user.get("email_confirmed_at")),
    }


@router.post("/login")
def login(datos: LoginData):
    try:
        session = sign_in(str(datos.email).strip().lower(), datos.password)
    except SupabaseAuthError as error:
        raise public_auth_error(error, login=True) from error
    return _session_response(session)


@router.post("/refresh")
def renovar_sesion(datos: RefreshData):
    try:
        session = refresh_session(datos.refresh_token)
    except SupabaseAuthError as error:
        raise public_auth_error(error, login=True) from error
    return _session_response(session)


@router.post("/logout")
def logout(authorization: str = Header(...)):
    if not authorization.startswith("Bearer "):
        raise HTTPException(status_code=401, detail="Formato de token inválido.")
    try:
        sign_out(authorization.removeprefix("Bearer ").strip())
    except SupabaseAuthError as error:
        raise public_auth_error(error, login=True) from error
    return {"mensaje": "Sesión cerrada."}


@router.post("/recuperar-password")
def recuperar_password(datos: RecuperarPasswordData):
    # Recovery mail redirects back to the exact site URL configured in Supabase Auth.
    from app.core.config import settings

    email = str(datos.email).strip().lower()
    if not settings.FRONTEND_URL:
        raise HTTPException(status_code=503, detail="Falta configurar FRONTEND_URL en el backend para recuperar contraseñas.")
    try:
        request_password_recovery(email, settings.FRONTEND_URL)
    except SupabaseAuthError as error:
        raise public_auth_error(error) from error
    return {"mensaje": "Si el correo corresponde a una cuenta, recibirás instrucciones para restablecer la contraseña."}


@router.post("/establecer-password")
def establecer_password(datos: EstablecerPasswordData):
    from app.services.supabase_auth import get_user

    try:
        get_user(datos.access_token)
        update_password(datos.access_token, datos.password_nueva)
    except SupabaseAuthError as error:
        raise public_auth_error(error) from error
    return {"mensaje": "Contraseña restablecida. Ya puedes iniciar sesión."}


@router.get("/sesion")
def obtener_sesion(usuario: dict = Depends(obtener_usuario_actual)):
    return {
        "id": usuario["user_id"],
        "nombre": usuario["nombre"],
        "email": usuario["email"],
        "id_rol": usuario["id_rol"],
    }
