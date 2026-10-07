import secrets
from datetime import datetime, timedelta, timezone

from fastapi import APIRouter, HTTPException
from jose import JWTError, jwt

from app.core.config import settings
from app.core.security import pwd_context, verificar_password, generar_hash_password
from app.db.database import get_db_connection
from app.models.auth import LoginData, PinChallengeData, RegisterData
from app.utils.auditoria_helper import registrar_auditoria

router = APIRouter(tags=["Autenticación"])

PIN_MAX_INTENTOS = 5
PIN_BLOQUEO_MINUTOS = 15
PIN_RETO_MINUTOS = 5


def _material_pin(pin: str) -> str:
    """Agrega un pepper del servidor antes de derivar el hash lento del PIN."""
    pepper = settings.PIN_PEPPER or settings.SECRET_KEY
    return f"smartcity-pin-v1:{pepper}:{pin}"


def _hash_pin(pin: str) -> str:
    return pwd_context.hash(_material_pin(pin))


def _crear_reto(cursor, user_id: int, proposito: str) -> str:
    ahora = datetime.now(timezone.utc)
    expira = ahora + timedelta(minutes=PIN_RETO_MINUTOS)
    challenge_id = secrets.token_urlsafe(32)
    cursor.execute(
        """
        INSERT INTO public.auth_pin_challenges (id, user_id, purpose, expires_at)
        VALUES (%s, %s, %s, %s)
        """,
        (challenge_id, user_id, proposito, expira),
    )
    return jwt.encode(
        {
            "purpose": "pin_challenge",
            "challenge_id": challenge_id,
            "user_id": user_id,
            "iat": ahora,
            "exp": expira,
        },
        settings.SECRET_KEY,
        algorithm=settings.ALGORITHM,
    )


def _leer_reto(token: str):
    try:
        claims = jwt.decode(token, settings.SECRET_KEY, algorithms=[settings.ALGORITHM])
    except JWTError as error:
        raise HTTPException(status_code=401, detail="El paso de verificación venció. Inicia sesión otra vez.") from error

    challenge_id = claims.get("challenge_id")
    user_id = claims.get("user_id")
    if claims.get("purpose") != "pin_challenge" or not isinstance(challenge_id, str) or not isinstance(user_id, int):
        raise HTTPException(status_code=401, detail="El paso de verificación no es válido.")
    return claims


def _token_sesion(usuario):
    return jwt.encode(
        {"user_id": usuario[0], "nombre": usuario[1], "id_rol": usuario[2]},
        settings.SECRET_KEY,
        algorithm=settings.ALGORITHM,
    )


@router.post("/registro")
def registrar_usuario(usuario: RegisterData):
    conn = None
    cursor = None
    try:
        conn = get_db_connection()
        cursor = conn.cursor()
        hashed_password = generar_hash_password(usuario.password)
        hashed_pin = _hash_pin(usuario.pin)

        # El registro público siempre crea una cuenta de usuario normal.
        cursor.execute(
            """
            INSERT INTO public.usuarios (nombre, email, password_hash, pin_hash, id_rol, estado)
            VALUES (%s, %s, %s, %s, 2, 'activo')
            RETURNING id
            """,
            (usuario.nombre, usuario.email, hashed_password, hashed_pin),
        )
        nuevo_id = cursor.fetchone()[0]
        conn.commit()
        registrar_auditoria(nuevo_id, "REGISTRO", "autenticacion", f"Nuevo usuario registrado: {usuario.email}")
        return {"mensaje": "Usuario registrado exitosamente en Supabase. Ya puedes iniciar sesión."}
    except HTTPException:
        if conn:
            conn.rollback()
        raise
    except Exception as error:
        if conn:
            conn.rollback()
        print(f"No se pudo registrar el usuario: {error}")
        raise HTTPException(status_code=400, detail="No se pudo crear la cuenta. Comprueba el correo e inténtalo otra vez.") from error
    finally:
        if cursor:
            cursor.close()
        if conn:
            conn.close()


@router.post("/login")
def login(datos: LoginData):
    """Valida la contraseña y entrega un reto temporal, pero todavía no una sesión."""
    conn = None
    cursor = None
    try:
        conn = get_db_connection()
        cursor = conn.cursor()
        cursor.execute(
            """
            SELECT id, nombre, password_hash, id_rol, COALESCE(estado, 'activo'),
                   pin_hash, pin_intentos, pin_bloqueado_hasta
            FROM public.usuarios
            WHERE lower(email) = lower(%s)
            """,
            (datos.email.strip(),),
        )
        usuario = cursor.fetchone()

        if not usuario or not verificar_password(datos.password, usuario[2]):
            raise HTTPException(status_code=401, detail="Credenciales incorrectas.")
        if usuario[4] != "activo":
            raise HTTPException(status_code=403, detail="Tu cuenta está desactivada. Contacta al administrador.")

        ahora = datetime.now(timezone.utc)
        bloqueo = usuario[7]
        if bloqueo and bloqueo > ahora:
            segundos = max(1, int((bloqueo - ahora).total_seconds()))
            raise HTTPException(
                status_code=429,
                detail=f"Se alcanzó el límite de intentos. Intenta de nuevo en {segundos // 60 + 1} minuto(s).",
            )
        if bloqueo:
            cursor.execute(
                "UPDATE public.usuarios SET pin_intentos = 0, pin_bloqueado_hasta = NULL WHERE id = %s",
                (usuario[0],),
            )

        proposito = "login" if usuario[5] else "setup"
        reto = _crear_reto(cursor, usuario[0], proposito)
        conn.commit()
        return {
            "requiere_pin": True,
            "configurar_pin": proposito == "setup",
            "challenge_token": reto,
            "nombre": usuario[1],
            "mensaje": "Crea tu PIN de cuatro cifras." if proposito == "setup" else "Ingresa tu PIN de cuatro cifras.",
            "expira_en_segundos": PIN_RETO_MINUTOS * 60,
        }
    except HTTPException:
        if conn:
            conn.rollback()
        raise
    except Exception as error:
        if conn:
            conn.rollback()
        print(f"No se pudo iniciar la verificación de acceso: {error}")
        raise HTTPException(status_code=503, detail="No se pudo iniciar sesión ahora. Inténtalo nuevamente.") from error
    finally:
        if cursor:
            cursor.close()
        if conn:
            conn.close()


def _obtener_reto_bloqueado(cursor, claims, proposito_esperado):
    cursor.execute(
        """
        SELECT c.user_id, c.purpose, c.expires_at, c.failed_attempts, c.consumed_at,
               u.id, u.nombre, u.id_rol, COALESCE(u.estado, 'activo'), u.pin_hash,
               u.pin_intentos, u.pin_bloqueado_hasta
        FROM public.auth_pin_challenges AS c
        JOIN public.usuarios AS u ON u.id = c.user_id
        WHERE c.id = %s AND c.user_id = %s
        FOR UPDATE OF c, u
        """,
        (claims["challenge_id"], claims["user_id"]),
    )
    reto = cursor.fetchone()
    if not reto or reto[1] != proposito_esperado:
        raise HTTPException(status_code=401, detail="El paso de verificación ya no es válido. Inicia sesión otra vez.")
    if reto[4] is not None:
        raise HTTPException(status_code=401, detail="Este PIN ya se utilizó. Inicia sesión otra vez.")
    if reto[2] <= datetime.now(timezone.utc):
        raise HTTPException(status_code=401, detail="El paso de verificación venció. Inicia sesión otra vez.")
    if reto[8] != "activo":
        raise HTTPException(status_code=403, detail="Tu cuenta está desactivada.")
    return reto


def _completar_sesion(cursor, conn, usuario, challenge_id):
    cursor.execute("UPDATE public.auth_pin_challenges SET consumed_at = NOW() WHERE id = %s", (challenge_id,))
    cursor.execute(
        """
        UPDATE public.usuarios
        SET pin_intentos = 0, pin_bloqueado_hasta = NULL, ultimo_acceso = NOW()
        WHERE id = %s
        """,
        (usuario[5],),
    )
    conn.commit()
    registrar_auditoria(usuario[5], "LOGIN", "autenticacion", "Inicio de sesión verificado con PIN")
    access_token = _token_sesion((usuario[5], usuario[6], usuario[7]))
    return {
        "access_token": access_token,
        "token_type": "bearer",
        "id_rol": usuario[7],
        "nombre": usuario[6],
        "user_id": usuario[5],
    }


@router.post("/login/verificar-pin")
def verificar_pin(datos: PinChallengeData):
    """Consume el reto de un solo uso y crea sesión solo con contraseña + PIN correctos."""
    claims = _leer_reto(datos.challenge_token)
    conn = None
    cursor = None
    try:
        conn = get_db_connection()
        cursor = conn.cursor()
        reto = _obtener_reto_bloqueado(cursor, claims, "login")

        ahora = datetime.now(timezone.utc)
        bloqueo = reto[11]
        intentos_cuenta = reto[10]
        if bloqueo and bloqueo > ahora:
            segundos = max(1, int((bloqueo - ahora).total_seconds()))
            raise HTTPException(status_code=429, detail=f"PIN bloqueado temporalmente. Espera {segundos // 60 + 1} minuto(s).")
        if bloqueo:
            intentos_cuenta = 0
            cursor.execute(
                "UPDATE public.usuarios SET pin_intentos = 0, pin_bloqueado_hasta = NULL WHERE id = %s",
                (reto[5],),
            )

        pin_correcto = pwd_context.verify(_material_pin(datos.pin), reto[9])
        if not pin_correcto:
            intentos = intentos_cuenta + 1
            intentos_reto = reto[3] + 1
            bloqueo_hasta = ahora + timedelta(minutes=PIN_BLOQUEO_MINUTOS) if intentos >= PIN_MAX_INTENTOS else None
            cursor.execute(
                "UPDATE public.auth_pin_challenges SET failed_attempts = %s, consumed_at = %s WHERE id = %s",
                (intentos_reto, ahora if intentos_reto >= PIN_MAX_INTENTOS else None, claims["challenge_id"]),
            )
            cursor.execute(
                """
                UPDATE public.usuarios
                SET pin_intentos = %s, pin_bloqueado_hasta = %s
                WHERE id = %s
                """,
                (intentos, bloqueo_hasta, reto[5]),
            )
            conn.commit()
            if bloqueo_hasta:
                raise HTTPException(status_code=429, detail="Demasiados intentos. El PIN quedó bloqueado por 15 minutos.")
            raise HTTPException(status_code=401, detail=f"PIN incorrecto. Te quedan {PIN_MAX_INTENTOS - intentos} intentos.")

        return _completar_sesion(cursor, conn, reto, claims["challenge_id"])
    except HTTPException:
        if conn:
            conn.rollback()
        raise
    except Exception as error:
        if conn:
            conn.rollback()
        print(f"No se pudo verificar el PIN: {error}")
        raise HTTPException(status_code=503, detail="No se pudo verificar el PIN ahora. Inténtalo nuevamente.") from error
    finally:
        if cursor:
            cursor.close()
        if conn:
            conn.close()


@router.post("/login/establecer-pin")
def establecer_pin(datos: PinChallengeData):
    """Activa el PIN para cuentas existentes que se registraron antes de esta mejora."""
    claims = _leer_reto(datos.challenge_token)
    conn = None
    cursor = None
    try:
        conn = get_db_connection()
        cursor = conn.cursor()
        reto = _obtener_reto_bloqueado(cursor, claims, "setup")
        if reto[9]:
            raise HTTPException(status_code=409, detail="Esta cuenta ya tiene un PIN. Inicia sesión de nuevo.")

        cursor.execute(
            """
            UPDATE public.usuarios
            SET pin_hash = %s, pin_intentos = 0, pin_bloqueado_hasta = NULL,
                ultimo_acceso = NOW()
            WHERE id = %s
            """,
            (_hash_pin(datos.pin), reto[5]),
        )
        respuesta = _completar_sesion(cursor, conn, reto, claims["challenge_id"])
        registrar_auditoria(reto[5], "PIN_CONFIGURADO", "autenticacion", "PIN de acceso configurado")
        return respuesta
    except HTTPException:
        if conn:
            conn.rollback()
        raise
    except Exception as error:
        if conn:
            conn.rollback()
        print(f"No se pudo configurar el PIN: {error}")
        raise HTTPException(status_code=503, detail="No se pudo guardar el PIN ahora. Inténtalo nuevamente.") from error
    finally:
        if cursor:
            cursor.close()
        if conn:
            conn.close()
