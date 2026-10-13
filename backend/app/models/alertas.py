from typing import Literal, Optional

from pydantic import BaseModel, Field


EstadoAlerta = Literal["pendiente", "en_proceso", "resuelto"]


class ReporteAlertaData(BaseModel):
    titulo: str = Field(min_length=3, max_length=120)
    descripcion: str = Field(min_length=3, max_length=1500)
    sensor_id: Optional[str] = Field(default=None, max_length=100)


class CambioEstadoAlertaData(BaseModel):
    estado: EstadoAlerta


class EstadoAlertaSensorData(BaseModel):
    sensor_id: str = Field(min_length=1, max_length=100)
    metrica: str = Field(min_length=1, max_length=80)
    titulo: str = Field(min_length=3, max_length=120)
    descripcion: str = Field(min_length=3, max_length=1500)
    estado: EstadoAlerta
