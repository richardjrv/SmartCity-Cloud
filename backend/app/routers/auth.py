import secrets
from datetime import datetime, timedelta, timezone

from fastapi import APIRouter, Depends, Header, HTTPException

from app.core.security import extraer_token_bearer, obtener_usuario_actual
from app.db.database import get_db_connection
from app.models.auth import EstablecerPasswordData, LoginData, PinChallengeData, RecuperarPasswordData, RefreshData, RegisterData
from app.services.pin_auth import (
    PIN_BLOQUEO_MINUTOS,
    PIN_MAX_INTENTOS,
    PIN_RETO_MINUTOS,
    PIN_SESION_DIAS,
    es_token_de_recuperacion,
    hash_pin,
    validar_token_y_obtener_sesion,
    verificar_pin,
)
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
            SELECT id, nombre, email, id_rol, COALESCE(estado, 'activo'),
                   pin_hash, pin_intentos, pin_bloqueado_hasta
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


def _crear_reto_pin(cursor, user: tuple, session_id: str) -> tuple[str, bool]:
    ahora = datetime.now(timezone.utc)
    bloqueado_hasta = user[7]
    if bloqueado_hasta and bloqueado_hasta > ahora:
        segundos = max(1, int((bloqueado_hasta - ahora).total_seconds()))
        raise HTTPException(status_code=429, detail=f"PIN bloqueado temporalmente. Espera {segundos // 60 + 1} minuto(s).")
    if bloqueado_hasta:
        cursor.execute(
            "UPDATE public.usuarios SET pin_intentos = 0, pin_bloqueado_hasta = NULL WHERE id = %s",
            (user[0],),
        )

    configurar_pin = not bool(user[5])
    proposito = "setup" if configurar_pin else "login"
    reto = secrets.token_urlsafe(36)
    cursor.execute(
        """
        UPDATE public.auth_pin_challenges
        SET consumed_at = %s
        WHERE user_id = %s AND auth_session_id = %s AND consumed_at IS NULL
        """,
        (ahora, user[0], session_id),
    )
    cursor.execute(
        """
        INSERT INTO public.auth_pin_challenges (id, user_id, auth_session_id, purpose, expires_at)
        VALUES (%s, %s, %s, %s, %s)
        """,
        (reto, user[0], session_id, proposito, ahora + timedelta(minutes=PIN_RETO_MINUTOS)),
    )
    return reto, configurar_pin


def _session_response(session: dict, *, iniciar_pin: bool):
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
    access_token = session.get("access_token")
    if not access_token:
        raise HTTPException(status_code=401, detail="Supabase Auth no devolvió un token válido.")
    try:
        _, session_id, _ = validar_token_y_obtener_sesion(access_token)
    except Exception as error:
        raise HTTPException(status_code=401, detail="No se pudo validar la sesión de Supabase.") from error

    respuesta = {
        "access_token": session.get("access_token"),
        "refresh_token": session.get("refresh_token"),
        "expires_in": session.get("expires_in", 3600),
        "id": user[0],
        "user_id": user[0],
        "auth_user_id": auth_user_id,
        "nombre": user[1],
        "id_rol": user[3],
        "pin_configurado": bool(user[5]),
    }
    if iniciar_pin:
        connection = None
        cursor = None
        try:
            connection = get_db_connection()
            cursor = connection.cursor()
            cursor.execute(
                "SELECT id, nombre, email, id_rol, COALESCE(estado, 'activo'), pin_hash, pin_intentos, pin_bloqueado_hasta "
                "FROM public.usuarios WHERE auth_user_id = %s FOR UPDATE",
                (auth_user_id,),
            )
            locked_user = cursor.fetchone()
            if not locked_user or locked_user[4] != "activo":
                raise HTTPException(status_code=403, detail="Tu cuenta está desactivada.")
            challenge, configurar = _crear_reto_pin(cursor, locked_user, session_id)
            connection.commit()
            respuesta.update({
                "requiere_pin": True,
                "configurar_pin": configurar,
                "challenge_token": challenge,
                "mensaje": "Crea tu PIN personal de cuatro cifras." if configurar else "Ingresa tu PIN personal de cuatro cifras.",
                "expira_en_segundos": PIN_RETO_MINUTOS * 60,
            })
        except HTTPException:
            if connection:
                connection.rollback()
            raise
        except Exception as error:
            if connection:
                connection.rollback()
            raise HTTPException(status_code=503, detail="No se pudo iniciar la verificación del PIN.") from error
        finally:
            if cursor:
                cursor.close()
            if connection:
                connection.close()
    return respuesta


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
    return _session_response(session, iniciar_pin=True)


@router.post("/refresh")
def renovar_sesion(datos: RefreshData):
    try:
        session = refresh_session(datos.refresh_token)
    except SupabaseAuthError as error:
        raise public_auth_error(error, login=True) from error
    return _session_response(session, iniciar_pin=False)


def _pin_user_context(access_token: str):
    try:
        auth_user, session_id, _ = validar_token_y_obtener_sesion(access_token)
    except SupabaseAuthError as error:
        raise public_auth_error(error, login=True) from error
    auth_user_id = auth_user.get("id")
    if not auth_user_id:
        raise HTTPException(status_code=401, detail="Supabase Auth no devolvió un usuario válido.")
    try:
        user = _app_user(auth_user_id)
    except Exception as error:
        raise HTTPException(status_code=503, detail="No se pudo cargar el perfil de la cuenta.") from error
    if not user or user[4] != "activo":
        raise HTTPException(status_code=403, detail="La cuenta no está disponible para iniciar sesión.")
    return auth_user_id, session_id, user


@router.post("/pin/iniciar")
def iniciar_verificacion_pin(authorization: str = Header(...)):
    access_token = extraer_token_bearer(authorization)
    auth_user_id, session_id, user = _pin_user_context(access_token)
    connection = None
    cursor = None
    try:
        connection = get_db_connection()
        cursor = connection.cursor()
        cursor.execute(
            "SELECT id, nombre, email, id_rol, COALESCE(estado, 'activo'), pin_hash, pin_intentos, pin_bloqueado_hasta "
            "FROM public.usuarios WHERE auth_user_id = %s FOR UPDATE",
            (auth_user_id,),
        )
        locked_user = cursor.fetchone()
        if not locked_user or locked_user[4] != "activo":
            raise HTTPException(status_code=403, detail="La cuenta no está disponible para iniciar sesión.")
        challenge, configurar = _crear_reto_pin(cursor, locked_user, session_id)
        connection.commit()
        return {
            "challenge_token": challenge,
            "configurar_pin": configurar,
            "nombre": user[1],
            "user_id": user[0],
            "id_rol": user[3],
            "expira_en_segundos": PIN_RETO_MINUTOS * 60,
        }
    except HTTPException:
        if connection:
            connection.rollback()
        raise
    except Exception as error:
        if connection:
            connection.rollback()
        raise HTTPException(status_code=503, detail="No se pudo iniciar la verificación del PIN.") from error
    finally:
        if cursor:
            cursor.close()
        if connection:
            connection.close()


def _validar_y_consumir_reto_pin(datos: PinChallengeData, access_token: str, *, configurar: bool):
    auth_user_id, session_id, _ = _pin_user_context(access_token)
    pin_hash_nuevo = hash_pin(datos.pin) if configurar else None
    connection = None
    cursor = None
    try:
        connection = get_db_connection()
        cursor = connection.cursor()
        cursor.execute(
            """
            SELECT c.user_id, c.auth_session_id, c.purpose, c.expires_at, c.failed_attempts,
                   c.consumed_at, u.id, u.nombre, u.id_rol, COALESCE(u.estado, 'activo'),
                   u.pin_hash, u.pin_intentos, u.pin_bloqueado_hasta
            FROM public.auth_pin_challenges AS c
            JOIN public.usuarios AS u ON u.id = c.user_id
            WHERE c.id = %s AND u.auth_user_id = %s
            FOR UPDATE OF c, u
            """,
            (datos.challenge_token, auth_user_id),
        )
        reto = cursor.fetchone()
        proposito_esperado = "setup" if configurar else "login"
        if not reto or str(reto[1]) != session_id or reto[2] != proposito_esperado:
            raise HTTPException(status_code=401, detail="El paso de PIN venció. Inicia sesión nuevamente.")
        if reto[5] is not None or reto[3] <= datetime.now(timezone.utc):
            raise HTTPException(status_code=401, detail="El paso de PIN venció. Inicia sesión nuevamente.")
        if reto[9] != "activo":
            raise HTTPException(status_code=403, detail="Tu cuenta está desactivada.")

        ahora = datetime.now(timezone.utc)
        bloqueado_hasta = reto[12]
        intentos = reto[11]
        if bloqueado_hasta and bloqueado_hasta > ahora:
            segundos = max(1, int((bloqueado_hasta - ahora).total_seconds()))
            raise HTTPException(status_code=429, detail=f"PIN bloqueado temporalmente. Espera {segundos // 60 + 1} minuto(s).")
        if bloqueado_hasta:
            intentos = 0
            cursor.execute("UPDATE public.usuarios SET pin_intentos = 0, pin_bloqueado_hasta = NULL WHERE id = %s", (reto[6],))

        if configurar and reto[10]:
            raise HTTPException(status_code=409, detail="Esta cuenta ya tiene PIN. Inicia sesión nuevamente.")
        if not configurar and not reto[10]:
            raise HTTPException(status_code=409, detail="Crea primero tu PIN de acceso.")

        if not configurar and not verificar_pin(datos.pin, reto[10]):
            intentos += 1
            intentos_reto = reto[4] + 1
            bloqueo_hasta = ahora + timedelta(minutes=PIN_BLOQUEO_MINUTOS) if intentos >= PIN_MAX_INTENTOS else None
            cursor.execute(
                "UPDATE public.auth_pin_challenges SET failed_attempts = %s, consumed_at = %s WHERE id = %s",
                (intentos_reto, ahora if intentos_reto >= PIN_MAX_INTENTOS else None, datos.challenge_token),
            )
            cursor.execute(
                "UPDATE public.usuarios SET pin_intentos = %s, pin_bloqueado_hasta = %s WHERE id = %s",
                (intentos, bloqueo_hasta, reto[6]),
            )
            connection.commit()
            if bloqueo_hasta:
                raise HTTPException(status_code=429, detail="Demasiados intentos. El PIN quedó bloqueado por 15 minutos.")
            raise HTTPException(status_code=401, detail=f"PIN incorrecto. Te quedan {PIN_MAX_INTENTOS - intentos} intentos.")

        if configurar:
            cursor.execute("DELETE FROM public.auth_pin_sessions WHERE user_id = %s", (reto[6],))
            cursor.execute(
                "UPDATE public.usuarios SET pin_hash = %s, pin_intentos = 0, pin_bloqueado_hasta = NULL WHERE id = %s",
                (pin_hash_nuevo, reto[6]),
            )
        else:
            cursor.execute(
                "UPDATE public.usuarios SET pin_intentos = 0, pin_bloqueado_hasta = NULL WHERE id = %s",
                (reto[6],),
            )

        cursor.execute("UPDATE public.auth_pin_challenges SET consumed_at = %s WHERE id = %s", (ahora, datos.challenge_token))
        cursor.execute(
            """
            INSERT INTO public.auth_pin_sessions (session_id, user_id, verified_at, expires_at)
            VALUES (%s, %s, %s, %s)
            ON CONFLICT (session_id) DO UPDATE
            SET user_id = EXCLUDED.user_id, verified_at = EXCLUDED.verified_at, expires_at = EXCLUDED.expires_at
            """,
            (session_id, reto[6], ahora, ahora + timedelta(days=PIN_SESION_DIAS)),
        )
        connection.commit()
        return {"id": reto[6], "user_id": reto[6], "nombre": reto[7], "id_rol": reto[8]}
    except HTTPException:
        if connection:
            connection.rollback()
        raise
    except Exception as error:
        if connection:
            connection.rollback()
        raise HTTPException(status_code=503, detail="No se pudo verificar el PIN.") from error
    finally:
        if cursor:
            cursor.close()
        if connection:
            connection.close()


@router.post("/pin/verificar")
def verificar_pin(datos: PinChallengeData, authorization: str = Header(...)):
    return _validar_y_consumir_reto_pin(datos, extraer_token_bearer(authorization), configurar=False)


@router.post("/pin/establecer")
def establecer_pin(datos: PinChallengeData, authorization: str = Header(...)):
    return _validar_y_consumir_reto_pin(datos, extraer_token_bearer(authorization), configurar=True)


@router.post("/logout")
def logout(authorization: str = Header(...)):
    access_token = extraer_token_bearer(authorization)
    try:
        _, session_id, _ = validar_token_y_obtener_sesion(access_token)
        sign_out(access_token)
    except SupabaseAuthError as error:
        raise public_auth_error(error, login=True) from error
    connection = None
    cursor = None
    try:
        connection = get_db_connection()
        cursor = connection.cursor()
        cursor.execute("DELETE FROM public.auth_pin_sessions WHERE session_id = %s", (session_id,))
        connection.commit()
    except Exception as error:
        if connection:
            connection.rollback()
        raise HTTPException(status_code=503, detail="No se pudo cerrar la sesión de SmartCity.") from error
    finally:
        if cursor:
            cursor.close()
        if connection:
            connection.close()
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
    try:
        auth_user, _, claims = validar_token_y_obtener_sesion(datos.access_token)
        if not es_token_de_recuperacion(claims):
            raise HTTPException(status_code=403, detail="Usa el enlace de recuperación enviado a tu correo para restablecer contraseña y PIN.")
        nuevo_pin_hash = hash_pin(datos.pin_nuevo)
        update_password(datos.access_token, datos.password_nueva)
    except SupabaseAuthError as error:
        raise public_auth_error(error) from error
    connection = None
    cursor = None
    try:
        connection = get_db_connection()
        cursor = connection.cursor()
        cursor.execute(
            """
            UPDATE public.usuarios
            SET pin_hash = %s, pin_intentos = 0, pin_bloqueado_hasta = NULL
            WHERE auth_user_id = %s AND COALESCE(estado, 'activo') = 'activo'
            RETURNING id
            """,
            (nuevo_pin_hash, auth_user.get("id")),
        )
        user = cursor.fetchone()
        if not user:
            raise HTTPException(status_code=403, detail="No se pudo restablecer el PIN de esta cuenta.")
        cursor.execute("DELETE FROM public.auth_pin_sessions WHERE user_id = %s", (user[0],))
        cursor.execute(
            "UPDATE public.auth_pin_challenges SET consumed_at = NOW() WHERE user_id = %s AND consumed_at IS NULL",
            (user[0],),
        )
        connection.commit()
    except HTTPException:
        if connection:
            connection.rollback()
        raise
    except Exception as error:
        if connection:
            connection.rollback()
        raise HTTPException(status_code=503, detail="No se pudo actualizar el PIN de la cuenta.") from error
    finally:
        if cursor:
            cursor.close()
        if connection:
            connection.close()
    return {"mensaje": "Contraseña restablecida. Ya puedes iniciar sesión."}


@router.get("/sesion")
def obtener_sesion(usuario: dict = Depends(obtener_usuario_actual)):
    return {
        "id": usuario["user_id"],
        "nombre": usuario["nombre"],
        "email": usuario["email"],
        "id_rol": usuario["id_rol"],
    }
