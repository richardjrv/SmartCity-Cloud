"""Condiciones meteorológicas locales usando Open-Meteo, sin clave API."""

import json
import time
from datetime import datetime
from threading import Lock
from urllib.error import HTTPError, URLError
from urllib.parse import urlencode
from urllib.request import Request, urlopen
from zoneinfo import ZoneInfo

from fastapi import APIRouter, HTTPException

router = APIRouter(prefix="/api/clima", tags=["Clima"])

_CACHE_SECONDS = 600
_cache_lock = Lock()
_cache_expira = 0.0
_cache_respuesta: dict | None = None
_ZONA_LOCAL = ZoneInfo("America/Guayaquil")


def _condicion_wmo(codigo: int) -> tuple[str, str]:
    """Traduce códigos WMO de Open-Meteo a una descripción e icono simples."""
    if codigo == 0:
        return "Despejado", "☀️"
    if codigo == 1:
        return "Mayormente despejado", "🌤️"
    if codigo == 2:
        return "Parcialmente nublado", "⛅"
    if codigo == 3:
        return "Nublado", "☁️"
    if codigo in (45, 48):
        return "Niebla", "🌫️"
    if 51 <= codigo <= 57:
        return "Llovizna", "🌦️"
    if 61 <= codigo <= 67:
        return "Lluvia", "🌧️"
    if 71 <= codigo <= 77:
        return "Nieve", "🌨️"
    if 80 <= codigo <= 82:
        return "Chubascos", "🌧️"
    if codigo in (85, 86):
        return "Chubascos de nieve", "🌨️"
    if 95 <= codigo <= 99:
        return "Tormenta", "⛈️"
    return "Condición variable", "🌡️"


@router.get("/current")
def clima_actual():
    """Devuelve el clima actual de Puerto Francisco de Orellana."""
    global _cache_expira, _cache_respuesta

    with _cache_lock:
        ahora = time.monotonic()
        if _cache_respuesta is not None and ahora < _cache_expira:
            return _cache_respuesta

        parametros = urlencode({
            "latitude": "-0.4667",
            "longitude": "-76.9872",
            "current": "temperature_2m,relative_humidity_2m,precipitation,weather_code,wind_speed_10m",
            "temperature_unit": "celsius",
            "wind_speed_unit": "kmh",
            "precipitation_unit": "mm",
            "timezone": "America/Guayaquil",
        })
        solicitud = Request(
            f"https://api.open-meteo.com/v1/forecast?{parametros}",
            headers={"Accept": "application/json", "User-Agent": "SmartCityCloud/1.0"},
        )

        try:
            with urlopen(solicitud, timeout=8) as respuesta:
                datos = json.loads(respuesta.read().decode("utf-8"))
        except (HTTPError, URLError, TimeoutError, json.JSONDecodeError) as error:
            raise HTTPException(status_code=502, detail="No se pudo consultar el clima local.") from error

        actual = datos.get("current") or {}
        if not actual:
            raise HTTPException(status_code=502, detail="La respuesta del clima está incompleta.")

        descripcion, icono = _condicion_wmo(int(actual.get("weather_code", -1)))
        hora = actual.get("time")
        try:
            fecha_local = datetime.fromisoformat(hora).replace(tzinfo=_ZONA_LOCAL) if hora else None
        except (TypeError, ValueError):
            fecha_local = None

        _cache_respuesta = {
            "location": {
                "name": "Puerto Francisco de Orellana",
                "region": "Orellana",
                "country": "Ecuador",
            },
            "current": {
                "temp_c": actual.get("temperature_2m"),
                "condition": {"text": descripcion, "icon": icono},
                "wind_kph": actual.get("wind_speed_10m"),
                "humidity": actual.get("relative_humidity_2m"),
                "precip_mm": actual.get("precipitation"),
                "last_updated": fecha_local.isoformat() if fecha_local else None,
            },
            "provider": "Open-Meteo",
        }
        _cache_expira = ahora + _CACHE_SECONDS
        return _cache_respuesta
