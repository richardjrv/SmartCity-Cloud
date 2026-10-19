from datetime import datetime

from fastapi import APIRouter, Depends, HTTPException

from app.core.security import obtener_usuario_actual
from app.models.sensores import LecturaSensorData
from app.services import sensores as servicio_sensores

router = APIRouter(prefix="/sensores", tags=["Sensores IoT"])


@router.post("")
def registrar_lectura(lectura: LecturaSensorData):
    if lectura.sensor_id.strip() != "ESP32":
        raise HTTPException(status_code=422, detail="Este proyecto recibe un solo controlador. Usa sensor_id='ESP32'.")
    try:
        servicio_sensores.registrar_lectura(lectura)
        return {"mensaje": "Lectura de sensor almacenada correctamente en Supabase 📡"}
    except ValueError as error:
        raise HTTPException(status_code=422, detail=str(error)) from error
    except Exception as error:
        raise HTTPException(status_code=400, detail=f"Error en BD: {str(error)}") from error


@router.get("/ultimas")
def obtener_ultimas_lecturas(usuario: dict = Depends(obtener_usuario_actual)):
    try:
        return servicio_sensores.obtener_ultimas_lecturas()
    except Exception as error:
        raise HTTPException(status_code=400, detail=f"Error en BD: {str(error)}") from error


@router.get("/maqueta")
def obtener_lectura_maqueta(usuario: dict = Depends(obtener_usuario_actual)):
    """Lectura del controlador activo para enlazar los indicadores del explorador 3D."""
    try:
        return servicio_sensores.obtener_lectura_maqueta()
    except Exception as error:
        raise HTTPException(status_code=503, detail="No se pudo consultar el estado de la maqueta.") from error


@router.get("/historial")
def obtener_historial(
    desde: datetime,
    hasta: datetime,
    usuario: dict = Depends(obtener_usuario_actual),
):
    """Devuelve las lecturas dentro del intervalo elegido para reportes."""
    if desde.tzinfo is None or hasta.tzinfo is None:
        raise HTTPException(status_code=422, detail="Las fechas deben incluir zona horaria.")
    if desde >= hasta:
        raise HTTPException(status_code=422, detail="La fecha inicial debe ser anterior a la fecha final.")

    try:
        return servicio_sensores.obtener_historial(desde, hasta)
    except servicio_sensores.LimiteHistorialExcedido as error:
        raise HTTPException(
            status_code=413,
            detail=(
                f"El intervalo tiene más de {servicio_sensores.MAX_LECTURAS_REPORTE} lecturas. "
                "Reduce el periodo para generar el PDF."
            ),
        ) from error
    except Exception as error:
        raise HTTPException(status_code=400, detail=f"Error en BD: {str(error)}") from error
