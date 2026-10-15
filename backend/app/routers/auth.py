from fastapi import APIRouter, Depends, Header, HTTPException

from app.core.security import extraer_token_bearer, obtener_usuario_actual
from app.models.auth import EstablecerPasswordData, LoginData, RecuperarPasswordData, RefreshData, RegisterData
from app.services.supabase_sessions import es_token_de_recuperacion, validar_token_y_obtener_sesion
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


def _session_response(session: dict):
    auth_user = session.get("user") or {}
    auth_user_id = auth_user.get("id")
    if not auth_user_id:
        raise HTTPException(status_code=401, detail="Supabase Auth no devolvió un usuario válido.")
    access_token = session.get("access_token")
    if not access_token:
        raise HTTPException(status_code=401, detail="Supabase Auth no devolvió un token válido.")
    try:
        auth_user, _, _ = validar_token_y_obtener_sesion(access_token)
    except Exception as error:
        raise HTTPException(status_code=401, detail="No se pudo validar la sesión de Supabase.") from error

    connection = None
    cursor = None
    try:
        from app.db.database import get_db_connection

        connection = get_db_connection()
        cursor = connection.cursor()
        cursor.execute(
            """SELECT id, nombre, email, id_rol, COALESCE(estado, 'activo')
               FROM public.usuarios WHERE auth_user_id = %s""",
            (auth_user_id,),
        )
        user = cursor.fetchone()
    except Exception as error:
        raise HTTPException(status_code=503, detail="No se pudo cargar el perfil de la cuenta.") from error
    finally:
        if cursor:
            cursor.close()
        if connection:
            connection.close()

    if not user:
        raise HTTPException(status_code=403, detail="Confirma tu correo y vuelve a iniciar sesión.")
    if user[4] != "activo":
        raise HTTPException(status_code=403, detail="Tu cuenta está desactivada.")
    return {
        "access_token": access_token,
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
    access_token = extraer_token_bearer(authorization)
    try:
        sign_out(access_token)
    except SupabaseAuthError as error:
        raise public_auth_error(error, login=True) from error
    return {"mensaje": "Sesión cerrada."}


@router.post("/recuperar-password")
def recuperar_password(datos: RecuperarPasswordData):
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
    try:
        _, _, claims = validar_token_y_obtener_sesion(datos.access_token)
        if not es_token_de_recuperacion(claims):
            raise HTTPException(status_code=403, detail="Usa el enlace de recuperación enviado a tu correo para restablecer la contraseña.")
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
