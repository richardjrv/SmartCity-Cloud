from typing import Optional
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
