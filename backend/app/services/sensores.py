"""Operaciones de persistencia y consulta para lecturas de sensores."""

from datetime import datetime, timezone

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
MAGNITUDES_LECTURA = {
    "temperatura": ("temperatura", "Sensor de temperatura", False),
    "humedad": ("humedad", "Sensor de humedad", False),
    "calidad_aire": ("calidad_aire", "Sensor de calidad del aire", False),
    "distancia_cm": ("distancia_cm", "Sensor de distancia", False),
    "lluvia_detectada": ("lluvia_detectada", "Detector de lluvia", True),
    "luminosidad": ("luminosidad", "Sensor de luminosidad", False),
    "nivel_agua": ("nivel_agua", "Sensor de nivel de agua", False),
    "reflectancia_tcrt5000": ("reflectancia_tcrt5000", "Sensor de reflectancia", False),
    "tcrt5000_detectado": ("tcrt5000_detectado", "Detector de proximidad", True),
}
SELECT_LECTURAS = """id, sensor_id, temperatura, humedad, calidad_aire,
    distancia_cm, lluvia_detectada, luminosidad, nivel_agua,
    reflectancia_tcrt5000, tcrt5000_detectado, fecha_hora"""


class LimiteHistorialExcedido(Exception):
    """El intervalo consultado excede el máximo permitido para reportes."""


def serializar_lectura(fila):
    fecha_hora = fila[11]
    if isinstance(fecha_hora, datetime) and fecha_hora.tzinfo is None:
        # lecturas_sensores usa timestamp sin zona; el servidor de Supabase guarda UTC.
        fecha_hora = fecha_hora.replace(tzinfo=timezone.utc)
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
        "fecha_hora": fecha_hora.isoformat() if hasattr(fecha_hora, "isoformat") else str(fecha_hora),
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
            f"INSERT INTO public.lecturas_sensores ({', '.join(columnas)}) VALUES ({placeholders}) RETURNING fecha_hora",
            (lectura.sensor_id.strip(), *valores),
        )
        fecha_hora = cursor.fetchone()[0]
        _registrar_lectura_normalizada(cursor, lectura, fecha_hora)
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


def _registrar_lectura_normalizada(cursor, lectura: LecturaSensorData, fecha_hora: datetime):
    """Replica magnitudes conocidas al modelo lógico sin inventar modelo ni posición GLB."""
    sensor_id = lectura.sensor_id.strip()
    cursor.execute("SELECT ubicacion FROM public.dispositivos_iot WHERE sensor_id = %s", (sensor_id,))
    controlador = cursor.fetchone()
    if not controlador:
        return
    if fecha_hora.tzinfo is None:
        fecha_hora = fecha_hora.replace(tzinfo=timezone.utc)

    for campo, (codigo_magnitud, nombre, es_booleano) in MAGNITUDES_LECTURA.items():
        valor = getattr(lectura, campo)
        if valor is None:
            continue
        codigo_sensor = f"{sensor_id}:{campo}"
        cursor.execute(
            """
            INSERT INTO public.sensores (codigo, id_controlador, nombre, ubicacion, estado)
            VALUES (%s, %s, %s, %s, 'activo')
            ON CONFLICT (codigo) DO UPDATE SET actualizado_en = NOW()
            RETURNING id_sensor
            """,
            (codigo_sensor, sensor_id, nombre, controlador[0]),
        )
        id_sensor = cursor.fetchone()[0]
        cursor.execute("SELECT id_magnitud FROM public.magnitudes WHERE codigo = %s", (codigo_magnitud,))
        magnitud = cursor.fetchone()
        if not magnitud:
            continue
        id_magnitud = magnitud[0]
        cursor.execute(
            "INSERT INTO public.sensor_magnitud (id_sensor, id_magnitud) VALUES (%s, %s) ON CONFLICT DO NOTHING",
            (id_sensor, id_magnitud),
        )
        cursor.execute(
            """
            INSERT INTO public.lecturas (id_sensor, id_magnitud, fecha_hora, valor, valor_booleano, origen)
            VALUES (%s, %s, %s, %s, %s, 'esp32')
            """,
            (id_sensor, id_magnitud, fecha_hora, None if es_booleano else valor, valor if es_booleano else None),
        )


def obtener_ultimas_lecturas():
    conn = cursor = None
    try:
        conn = get_db_connection()
        cursor = conn.cursor()
        cursor.execute(
            f"SELECT {SELECT_LECTURAS} FROM public.lecturas_sensores WHERE sensor_id = 'ESP32' ORDER BY fecha_hora DESC LIMIT 100"
        )
        return [serializar_lectura(fila) for fila in cursor.fetchall()]
    finally:
        if cursor:
            cursor.close()
        if conn:
            conn.close()


def obtener_lectura_maqueta():
    """Devuelve la lectura más reciente del único controlador ESP32 activo."""
    conn = cursor = None
    try:
        conn = get_db_connection()
        cursor = conn.cursor()
        cursor.execute(
            f"""
            SELECT d.sensor_id, d.nombre, d.ubicacion,
                   l.id, l.sensor_id, l.temperatura, l.humedad, l.calidad_aire,
                   l.distancia_cm, l.lluvia_detectada, l.luminosidad, l.nivel_agua,
                   l.reflectancia_tcrt5000, l.tcrt5000_detectado, l.fecha_hora
            FROM public.dispositivos_iot AS d
            LEFT JOIN LATERAL (
                SELECT {SELECT_LECTURAS}
                FROM public.lecturas_sensores
                WHERE sensor_id = d.sensor_id
                ORDER BY fecha_hora DESC
                LIMIT 1
            ) AS l ON TRUE
            WHERE d.activo = TRUE
            ORDER BY CASE WHEN d.sensor_id = 'ESP32' THEN 0 ELSE 1 END, d.sensor_id
            LIMIT 1
            """
        )
        fila = cursor.fetchone()
        if not fila:
            return {"estado": "sin_controlador", "controlador": None, "lectura": None}
        controlador = {"id": fila[0], "nombre": fila[1], "ubicacion": fila[2]}
        if fila[3] is None:
            return {"estado": "sin_lecturas", "controlador": controlador, "lectura": None}
        lectura = serializar_lectura(fila[3:])
        fecha = fila[14]
        if fecha.tzinfo is None:
            fecha = fecha.replace(tzinfo=timezone.utc)
        edad_segundos = max(0, int((datetime.now(timezone.utc) - fecha.astimezone(timezone.utc)).total_seconds()))
        return {
            "estado": "actual" if edad_segundos <= 600 else "antigua",
            "controlador": controlador,
            "lectura": lectura,
            "edad_segundos": edad_segundos,
        }
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
            WHERE sensor_id = 'ESP32' AND fecha_hora >= %s AND fecha_hora <= %s
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
