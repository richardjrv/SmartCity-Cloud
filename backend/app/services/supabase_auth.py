"""Small server-side client for the Supabase Auth HTTP API."""

import json
from urllib.error import HTTPError, URLError
from urllib.parse import quote
from urllib.request import Request, urlopen

from fastapi import HTTPException

from app.core.config import settings


class SupabaseAuthError(Exception):
    def __init__(self, status: int, message: str):
        super().__init__(message)
        self.status = status
        self.message = message


def _request(method: str, path: str, payload=None, access_token: str | None = None, admin: bool = False):
    if not settings.SUPABASE_URL or not settings.SUPABASE_ANON_KEY:
        raise HTTPException(status_code=503, detail="Falta configurar SUPABASE_URL y SUPABASE_ANON_KEY en el backend.")
    base_url = settings.SUPABASE_URL.rstrip("/")
    key = settings.SUPABASE_SERVICE_ROLE_KEY if admin else settings.SUPABASE_ANON_KEY
    if admin and not key:
        raise HTTPException(status_code=503, detail="Falta configurar la clave administrativa de Supabase en el backend.")

    headers = {"apikey": key, "Content-Type": "application/json"}
    if access_token:
        headers["Authorization"] = f"Bearer {access_token}"
    elif admin:
        headers["Authorization"] = f"Bearer {key}"

    body = None if payload is None else json.dumps(payload).encode("utf-8")
    request = Request(f"{base_url}{path}", data=body, headers=headers, method=method)
    try:
        with urlopen(request, timeout=12) as response:
            raw = response.read()
    except HTTPError as error:
        raw = error.read()
        try:
            data = json.loads(raw.decode("utf-8"))
            message = data.get("msg") or data.get("message") or data.get("error_description") or data.get("error")
        except (ValueError, AttributeError):
            message = None
        raise SupabaseAuthError(error.code, message or "Supabase Auth rechazó la solicitud.") from error
    except (URLError, TimeoutError) as error:
        raise HTTPException(status_code=503, detail="No se pudo conectar con Supabase Auth.") from error

    if not raw:
        return {}
    try:
        return json.loads(raw.decode("utf-8"))
    except ValueError as error:
        raise HTTPException(status_code=502, detail="Supabase Auth devolvió una respuesta inesperada.") from error


def sign_up(email: str, password: str, name: str):
    return _request("POST", "/auth/v1/signup", {"email": email, "password": password, "data": {"full_name": name}})


def sign_in(email: str, password: str):
    return _request("POST", "/auth/v1/token?grant_type=password", {"email": email, "password": password})


def refresh_session(refresh_token: str):
    return _request("POST", "/auth/v1/token?grant_type=refresh_token", {"refresh_token": refresh_token})


def get_user(access_token: str):
    return _request("GET", "/auth/v1/user", access_token=access_token)


def sign_out(access_token: str):
    # The app's logout button should revoke only this browser's refresh token.
    # Supabase defaults to global logout, which would sign the user out on every device.
    return _request("POST", "/auth/v1/logout?scope=local", access_token=access_token)


def update_password(access_token: str, password: str, current_password: str | None = None):
    payload = {"password": password}
    if current_password is not None:
        payload["current_password"] = current_password
    return _request("PUT", "/auth/v1/user", payload, access_token=access_token)


def request_password_recovery(email: str, redirect_to: str):
    target = quote(redirect_to, safe=":/?=&")
    return _request("POST", f"/auth/v1/recover?redirect_to={target}", {"email": email})


def delete_user(user_id: str):
    return _request("DELETE", f"/auth/v1/admin/users/{quote(user_id, safe='')}", admin=True)


def public_auth_error(
    error: SupabaseAuthError,
    *,
    login: bool = False,
    session: bool = False,
) -> HTTPException:
    if error.status in (400, 401, 403, 422):
        if login:
            message = (
                "Correo o contraseña incorrectos. Si tu cuenta usa Google o Facebook, "
                "entra con ese proveedor o restablece tu contraseña."
            )
        elif session:
            message = "La sesión venció o ya no es válida. Inicia sesión nuevamente."
        else:
            message = error.message
        return HTTPException(status_code=401 if login or session else 400, detail=message)
    if error.status == 429:
        return HTTPException(status_code=429, detail="Demasiados intentos. Espera un momento e inténtalo otra vez.")
    return HTTPException(status_code=503, detail="Supabase Auth no pudo completar la solicitud.")
