"""Supabase access-token validation helpers."""

from uuid import UUID

from fastapi import HTTPException
from jose import JWTError, jwt

from app.services.supabase_auth import SupabaseAuthError, get_user


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


def es_token_de_recuperacion(claims: dict) -> bool:
    methods = claims.get("amr") or []
    return any(isinstance(item, dict) and item.get("method") == "recovery" for item in methods)
