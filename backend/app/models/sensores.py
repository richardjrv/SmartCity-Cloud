from typing import Literal, Optional
from pydantic import BaseModel, Field

class LecturaSensorData(BaseModel):
    sensor_id: str = Field(min_length=1, max_length=100)
    temperatura: Optional[float] = None
    humedad: Optional[float] = None
    calidad_aire: Optional[float] = None
    distancia_cm: Optional[float] = None
    lluvia_detectada: Optional[bool] = None
    luminosidad: Optional[float] = None
    nivel_agua: Optional[float] = None
    reflectancia_tcrt5000: Optional[float] = None
    tcrt5000_detectado: Optional[bool] = None


class ActualizarSensorCatalogoData(BaseModel):
    """Campos de inventario que un administrador puede corregir."""

    nombre: Optional[str] = Field(default=None, max_length=100)
    modelo: Optional[str] = Field(default=None, max_length=100)
    ubicacion: Optional[str] = Field(default=None, max_length=160)
    estado: Optional[Literal["activo", "inactivo", "pendiente"]] = None
    objeto_modelo: Optional[str] = Field(default=None, max_length=120)
    observaciones: Optional[str] = Field(default=None, max_length=500)


class RegistrarSensorCatalogoData(BaseModel):
    """Pre-registra un canal de medición ya admitido por el firmware del ESP32."""

    campo: Literal[
        "temperatura",
        "humedad",
        "calidad_aire",
        "distancia_cm",
        "lluvia_detectada",
        "luminosidad",
        "nivel_agua",
        "reflectancia_tcrt5000",
        "tcrt5000_detectado",
    ]
    nombre: str = Field(min_length=1, max_length=100)
    modelo: Optional[str] = Field(default=None, max_length=100)
    ubicacion: Optional[str] = Field(default=None, max_length=160)
    objeto_modelo: Optional[str] = Field(default=None, max_length=120)
    observaciones: Optional[str] = Field(default=None, max_length=500)
