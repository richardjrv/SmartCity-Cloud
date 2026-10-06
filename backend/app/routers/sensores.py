from datetime import datetime
from fastapi import APIRouter, HTTPException
from app.db.database import get_db_connection
from app.models.sensores import LecturaSensorData

router = APIRouter(prefix="/sensores", tags=["Sensores IoT"])
MAX_LECTURAS_REPORTE = 10000

@router.post("")
def registrar_lectura(lectura: LecturaSensorData):
    try:
        conn = get_db_connection()
        cursor = conn.cursor()
        cursor.execute(
            "INSERT INTO lecturas_sensores (sensor_id, temperatura, humedad, calidad_aire) VALUES (%s, %s, %s, %s)",
            (lectura.sensor_id, lectura.temperatura, lectura.humedad, lectura.calidad_aire)
        )
        conn.commit()
        cursor.close()
        conn.close()
        return {"mensaje": "Lectura de sensor almacenada correctamente en Supabase 📡"}
    except Exception as e:
        raise HTTPException(status_code=400, detail=f"Error en BD: {str(e)}")

@router.get("/ultimas")
def obtener_ultimas_lecturas():
    try:
        conn = get_db_connection()
        cursor = conn.cursor()
        cursor.execute(
            "SELECT id, sensor_id, temperatura, humedad, calidad_aire, fecha_hora FROM lecturas_sensores ORDER BY fecha_hora DESC LIMIT 10"
        )
        filas = cursor.fetchall()
        cursor.close()
        conn.close()
        return [
            {
                "id": f[0], "sensor_id": f[1], "temperatura": float(f[2]), 
                "humedad": float(f[3]), "calidad_aire": float(f[4]), "fecha_hora": str(f[5])
            } for f in filas
        ]
    except Exception as e:
        raise HTTPException(status_code=400, detail=f"Error en BD: {str(e)}")

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
            """
            SELECT id, sensor_id, temperatura, humedad, calidad_aire, fecha_hora
            FROM lecturas_sensores
            WHERE fecha_hora >= %s AND fecha_hora <= %s
            ORDER BY fecha_hora ASC
            LIMIT %s
            """,
            (desde, hasta, MAX_LECTURAS_REPORTE + 1)
        )
        filas = cursor.fetchall()
        if len(filas) > MAX_LECTURAS_REPORTE:
            raise HTTPException(
                status_code=413,
                detail=f"El intervalo tiene más de {MAX_LECTURAS_REPORTE} lecturas. Reduce el periodo para generar el PDF."
            )

        return [
            {
                "id": fila[0],
                "sensor_id": fila[1],
                "temperatura": float(fila[2]),
                "humedad": float(fila[3]),
                "calidad_aire": float(fila[4]),
                "fecha_hora": fila[5].isoformat()
            }
            for fila in filas
        ]
    except HTTPException:
        raise
    except Exception as e:
        raise HTTPException(status_code=400, detail=f"Error en BD: {str(e)}")
    finally:
        if cursor:
            cursor.close()
        if conn:
            conn.close()
