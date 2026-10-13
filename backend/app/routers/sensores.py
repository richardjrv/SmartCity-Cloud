from datetime import datetime

from fastapi import APIRouter, HTTPException

from app.db.database import get_db_connection
from app.models.sensores import LecturaSensorData

router = APIRouter(prefix="/sensores", tags=["Sensores IoT"])
MAX_LECTURAS_REPORTE = 10000
CAMPOS_LECTURA = (
    "temperatura",
    "humedad",
    "calidad_aire",
    "distancia_cm",
    "lluvia_detectada",
    "luminosidad",
    "nivel_agua",
    "reflectancia_tcrt5000",
    "tcrt5000_detectado",
)
SELECT_LECTURAS = """id, sensor_id, temperatura, humedad, calidad_aire,
    distancia_cm, lluvia_detectada, luminosidad, nivel_agua,
    reflectancia_tcrt5000, tcrt5000_detectado, fecha_hora"""


def serializar_lectura(fila):
    return {
        "id": fila[0],
        "sensor_id": fila[1],
        "temperatura": float(fila[2]) if fila[2] is not None else None,
        "humedad": float(fila[3]) if fila[3] is not None else None,
        "calidad_aire": float(fila[4]) if fila[4] is not None else None,
        "distancia_cm": float(fila[5]) if fila[5] is not None else None,
        "lluvia_detectada": fila[6],
        "luminosidad": float(fila[7]) if fila[7] is not None else None,
        "nivel_agua": float(fila[8]) if fila[8] is not None else None,
        "reflectancia_tcrt5000": float(fila[9]) if fila[9] is not None else None,
        "tcrt5000_detectado": fila[10],
        "fecha_hora": fila[11].isoformat() if hasattr(fila[11], "isoformat") else str(fila[11]),
    }


@router.post("")
def registrar_lectura(lectura: LecturaSensorData):
    valores = [getattr(lectura, campo) for campo in CAMPOS_LECTURA]
    if all(valor is None for valor in valores):
        raise HTTPException(status_code=422, detail="Envía al menos una medición del sensor.")

    conn = None
    cursor = None
    try:
        conn = get_db_connection()
        cursor = conn.cursor()
        columnas = ("sensor_id",) + CAMPOS_LECTURA
        placeholders = ", ".join(["%s"] * len(columnas))
        cursor.execute(
            f"INSERT INTO public.lecturas_sensores ({', '.join(columnas)}) VALUES ({placeholders})",
            (lectura.sensor_id.strip(), *valores),
        )
        conn.commit()
        return {"mensaje": "Lectura de sensor almacenada correctamente en Supabase 📡"}
    except Exception as error:
        if conn:
            conn.rollback()
        raise HTTPException(status_code=400, detail=f"Error en BD: {str(error)}") from error
    finally:
        if cursor:
            cursor.close()
        if conn:
            conn.close()


@router.get("/ultimas")
def obtener_ultimas_lecturas():
    conn = None
    cursor = None
    try:
        conn = get_db_connection()
        cursor = conn.cursor()
        cursor.execute(
            f"SELECT {SELECT_LECTURAS} FROM public.lecturas_sensores ORDER BY fecha_hora DESC LIMIT 100"
        )
        return [serializar_lectura(fila) for fila in cursor.fetchall()]
    except Exception as error:
        raise HTTPException(status_code=400, detail=f"Error en BD: {str(error)}") from error
    finally:
        if cursor:
            cursor.close()
        if conn:
            conn.close()


@router.get("/historial")
def obtener_historial(desde: datetime, hasta: datetime):
    """Devuelve las lecturas dentro del intervalo elegido para reportes."""
    if desde.tzinfo is None or hasta.tzinfo is None:
        raise HTTPException(status_code=422, detail="Las fechas deben incluir zona horaria.")
    if desde >= hasta:
        raise HTTPException(status_code=422, detail="La fecha inicial debe ser anterior a la fecha final.")

    conn = None
    cursor = None
    try:
        conn = get_db_connection()
        cursor = conn.cursor()
        cursor.execute(
            f"""
            SELECT {SELECT_LECTURAS}
            FROM public.lecturas_sensores
            WHERE fecha_hora >= %s AND fecha_hora <= %s
            ORDER BY fecha_hora ASC
            LIMIT %s
            """,
            (desde, hasta, MAX_LECTURAS_REPORTE + 1),
        )
        filas = cursor.fetchall()
        if len(filas) > MAX_LECTURAS_REPORTE:
            raise HTTPException(
                status_code=413,
                detail=f"El intervalo tiene más de {MAX_LECTURAS_REPORTE} lecturas. Reduce el periodo para generar el PDF.",
            )
        return [serializar_lectura(fila) for fila in filas]
    except HTTPException:
        raise
    except Exception as error:
        raise HTTPException(status_code=400, detail=f"Error en BD: {str(error)}") from error
    finally:
        if cursor:
            cursor.close()
        if conn:
            conn.close()
