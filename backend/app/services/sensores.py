"""Operaciones de persistencia y consulta para lecturas de sensores."""

from datetime import datetime

from app.db.database import get_db_connection
from app.models.sensores import LecturaSensorData

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


class LimiteHistorialExcedido(Exception):
    """El intervalo consultado excede el máximo permitido para reportes."""


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


def registrar_lectura(lectura: LecturaSensorData):
    valores = [getattr(lectura, campo) for campo in CAMPOS_LECTURA]
    if all(valor is None for valor in valores):
        raise ValueError("Envía al menos una medición del sensor.")

    columnas = ("sensor_id",) + CAMPOS_LECTURA
    placeholders = ", ".join(["%s"] * len(columnas))
    conn = cursor = None
    try:
        conn = get_db_connection()
        cursor = conn.cursor()
        cursor.execute(
            f"INSERT INTO public.lecturas_sensores ({', '.join(columnas)}) VALUES ({placeholders})",
            (lectura.sensor_id.strip(), *valores),
        )
        conn.commit()
    except Exception:
        if conn:
            conn.rollback()
        raise
    finally:
        if cursor:
            cursor.close()
        if conn:
            conn.close()


def obtener_ultimas_lecturas():
    conn = cursor = None
    try:
        conn = get_db_connection()
        cursor = conn.cursor()
        cursor.execute(
            f"SELECT {SELECT_LECTURAS} FROM public.lecturas_sensores ORDER BY fecha_hora DESC LIMIT 100"
        )
        return [serializar_lectura(fila) for fila in cursor.fetchall()]
    finally:
        if cursor:
            cursor.close()
        if conn:
            conn.close()


def obtener_historial(desde: datetime, hasta: datetime):
    conn = cursor = None
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
            raise LimiteHistorialExcedido
        return [serializar_lectura(fila) for fila in filas]
    finally:
        if cursor:
            cursor.close()
        if conn:
            conn.close()
