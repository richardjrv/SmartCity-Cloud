"""Helpers for the SmartCity PIN step layered over Supabase Auth sessions."""

import base64
import hashlib
import hmac
import secrets
from uuid import UUID

from fastapi import HTTPException
from jose import JWTError, jwt

from app.core.config import settings
from app.services.supabase_auth import SupabaseAuthError, get_user

PIN_MAX_INTENTOS = 5
PIN_BLOQUEO_MINUTOS = 15
PIN_RETO_MINUTOS = 5
PIN_SESION_DIAS = 30
SCRYPT_N = 2**14


def validar_token_y_obtener_sesion(access_token: str) -> tuple[dict, str, dict]:
    """Ask Supabase to validate the access token, then read its verified session id."""
    auth_user = get_user(access_token)
    try:
        claims = jwt.get_unverified_claims(access_token)
        if claims.get("sub") != auth_user.get("id"):
            raise ValueError("El usuario del token no coincide.")
        session_id = str(UUID(claims["session_id"]))
    except (JWTError, KeyError, TypeError, ValueError) as error:
        raise HTTPException(status_code=401, detail="La sesión de Supabase no es válida.") from error
    return auth_user, session_id, claims


def _pepper() -> bytes:
    value = settings.PIN_PEPPER or settings.SUPABASE_SERVICE_ROLE_KEY
    if not value:
        raise HTTPException(
            status_code=503,
            detail="Configura un PIN_PEPPER estable en el backend antes de activar los PIN.",
        )
    return value.encode("utf-8")


def _b64encode(value: bytes) -> str:
    return base64.urlsafe_b64encode(value).decode("ascii").rstrip("=")


def _b64decode(value: str) -> bytes:
    return base64.urlsafe_b64decode(value + "=" * (-len(value) % 4))


def hash_pin(pin: str) -> str:
    salt = secrets.token_bytes(16)
    derived = hashlib.scrypt(_pepper() + b":" + pin.encode("ascii"), salt=salt, n=SCRYPT_N, r=8, p=1, dklen=32)
    return f"scrypt-v1${_b64encode(salt)}${_b64encode(derived)}"


def verificar_pin(pin: str, stored_hash: str) -> bool:
    try:
        scheme, salt_value, digest_value = stored_hash.split("$", 2)
        if scheme != "scrypt-v1":
            return False
        salt = _b64decode(salt_value)
        expected = _b64decode(digest_value)
        actual = hashlib.scrypt(_pepper() + b":" + pin.encode("ascii"), salt=salt, n=SCRYPT_N, r=8, p=1, dklen=len(expected))
        return hmac.compare_digest(actual, expected)
    except (ValueError, TypeError):
        return False


def es_token_de_recuperacion(claims: dict) -> bool:
    methods = claims.get("amr") or []
    return any(isinstance(item, dict) and item.get("method") == "recovery" for item in methods)
