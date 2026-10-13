"""Proxy cacheado para las condiciones meteorológicas locales."""

import json
import time
from threading import Lock
from urllib.error import HTTPError, URLError
from urllib.parse import urlencode
from urllib.request import Request, urlopen

from fastapi import APIRouter, HTTPException

from app.core.config import settings

router = APIRouter(prefix="/api/clima", tags=["Clima"])

_CACHE_SECONDS = 600
_cache_lock = Lock()
_cache_expira = 0.0
_cache_respuesta: dict | None = None


@router.get("/current")
def clima_actual():
    """Devuelve el clima actual de Puerto Francisco de Orellana."""
    global _cache_expira, _cache_respuesta

    if not settings.WEATHERAPI_KEY:
        raise HTTPException(status_code=503, detail="El servicio de clima no está configurado.")

    with _cache_lock:
        ahora = time.monotonic()
        if _cache_respuesta is not None and ahora < _cache_expira:
            return _cache_respuesta

        parametros = urlencode({
            "key": settings.WEATHERAPI_KEY,
            "q": "Puerto Francisco de Orellana,Ecuador",
            "lang": "es",
        })
        solicitud = Request(
            f"https://api.weatherapi.com/v1/current.json?{parametros}",
            headers={"Accept": "application/json", "User-Agent": "SmartCityCloud/1.0"},
        )

        try:
            with urlopen(solicitud, timeout=8) as respuesta:
                datos = json.loads(respuesta.read().decode("utf-8"))
        except (HTTPError, URLError, TimeoutError, json.JSONDecodeError) as error:
            # No enviar la respuesta del proveedor: puede incluir datos de la solicitud.
            raise HTTPException(status_code=502, detail="No se pudo consultar el clima externo.") from error

        ubicacion = datos.get("location") or {}
        actual = datos.get("current") or {}
        condicion = actual.get("condition") or {}
        if not actual:
            raise HTTPException(status_code=502, detail="La respuesta del clima está incompleta.")

        _cache_respuesta = {
            "location": {
                "name": ubicacion.get("name", "Puerto Francisco de Orellana"),
                "region": ubicacion.get("region", "Orellana"),
                "country": ubicacion.get("country", "Ecuador"),
                "localtime": ubicacion.get("localtime"),
            },
            "current": {
                "temp_c": actual.get("temp_c"),
                "condition": {"text": condicion.get("text"), "icon": condicion.get("icon")},
                "wind_kph": actual.get("wind_kph"),
                "humidity": actual.get("humidity"),
                "precip_mm": actual.get("precip_mm"),
                "last_updated": actual.get("last_updated"),
            },
            "provider": "WeatherAPI.com",
        }
        _cache_expira = ahora + _CACHE_SECONDS
        return _cache_respuesta
