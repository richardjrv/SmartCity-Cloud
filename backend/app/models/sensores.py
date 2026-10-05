from pydantic import BaseModel

class LecturaSensorData(BaseModel):
    sensor_id: str
    temperatura: float
    humedad: float
    calidad_aire: float