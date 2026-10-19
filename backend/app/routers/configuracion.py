from fastapi import APIRouter, Depends, HTTPException

from app.core.security import obtener_usuario_actual, requerir_operador
from app.models.configuracion import ConfiguracionSistemaData
from app.services import configuracion as servicio_configuracion

router = APIRouter(prefix="/api/configuracion-sistema", tags=["Configuración del sistema"])


@router.get("")
def obtener_configuracion(usuario: dict = Depends(obtener_usuario_actual)):
    try:
        return servicio_configuracion.obtener_configuracion()
    except Exception as error:
        raise HTTPException(status_code=503, detail="No se pudo cargar la configuración del sistema.") from error


@router.put("")
def guardar_configuracion(
    datos: ConfiguracionSistemaData,
    usuario: dict = Depends(requerir_operador),
):
    if datos.humidityMin >= datos.humidityMax:
        raise HTTPException(status_code=422, detail="La humedad mínima debe ser menor que la máxima.")
    settings = datos.dict()
    settings["sensorLabel"] = settings["sensorLabel"].strip()
    if not settings["sensorLabel"]:
        raise HTTPException(status_code=422, detail="El nombre del controlador no puede estar vacío.")
    try:
        return servicio_configuracion.guardar_configuracion(settings, usuario["user_id"])
    except Exception as error:
        raise HTTPException(status_code=503, detail="No se pudo guardar la configuración del sistema.") from error
