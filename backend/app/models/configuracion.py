from typing import Literal

from pydantic import BaseModel, Field


class ConfiguracionSistemaData(BaseModel):
    temperatureMax: float = Field(default=35, ge=-20, le=80)
    humidityMin: float = Field(default=30, ge=0, le=100)
    humidityMax: float = Field(default=70, ge=0, le=100)
    airQualityMax: float = Field(default=100, ge=0, le=1000)
    refreshSeconds: Literal[30, 60, 300] = 60
    staleMinutes: int = Field(default=10, ge=2, le=180)
    sensorLabel: str = Field(default="ESP32", min_length=1, max_length=40)
    notificationsEnabled: bool = True
