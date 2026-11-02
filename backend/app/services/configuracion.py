"""Persistencia relacional de la configuración compartida del sistema."""

from app.db.database import get_db_connection

DEFAULTS = {
    "temperatureMax": 35,
    "humidityMin": 30,
    "humidityMax": 70,
    "airQualityMax": 100,
    "refreshSeconds": 60,
    "staleMinutes": 10,
    "sensorLabel": "ESP32",
    "notificationsEnabled": True,
}
CLAVES_CONFIGURACION_API = (
    "temperatureMax",
    "humidityMin",
    "humidityMax",
    "airQualityMax",
    "refreshSeconds",
    "staleMinutes",
    "sensorLabel",
    "notificationsEnabled",
)


def _configuracion_para_api(fila):
    return {
        "temperatureMax": float(fila[0]),
        "humidityMin": float(fila[1]),
        "humidityMax": float(fila[2]),
        "airQualityMax": float(fila[3]),
        "refreshSeconds": fila[4],
        "staleMinutes": fila[5],
        "sensorLabel": fila[6],
        "notificationsEnabled": fila[7],
    }


def obtener_configuracion():
    conn = cursor = None
    try:
        conn = get_db_connection()
        cursor = conn.cursor()
        cursor.execute(
            """SELECT temperatura_maxima, humedad_minima, humedad_maxima,
                      calidad_aire_maxima, intervalo_actualizacion_segundos,
                      minutos_sin_datos, etiqueta_sensor, notificaciones_habilitadas,
                      actualizado_en
               FROM public.configuracion_sistema
               WHERE id_configuracion = 1"""
        )
        row = cursor.fetchone()
        if not row:
            return {**DEFAULTS, "updatedAt": None}
        ajustes_api = _configuracion_para_api(row)
        return {**DEFAULTS, **ajustes_api, "updatedAt": row[8].isoformat() if row[8] else None}
    finally:
        if cursor:
            cursor.close()
        if conn:
            conn.close()


def guardar_configuracion(ajustes_api, id_usuario_actualizacion):
    conn = cursor = None
    try:
        conn = get_db_connection()
        cursor = conn.cursor()
        cursor.execute(
            """
            INSERT INTO public.configuracion_sistema
                (id_configuracion, temperatura_maxima, humedad_minima, humedad_maxima,
                 calidad_aire_maxima, intervalo_actualizacion_segundos, minutos_sin_datos,
                 etiqueta_sensor, notificaciones_habilitadas,
                 id_usuario_actualizacion, actualizado_en)
            VALUES (1, %s, %s, %s, %s, %s, %s, %s, %s, %s, now())
            ON CONFLICT (id_configuracion) DO UPDATE
            SET temperatura_maxima = EXCLUDED.temperatura_maxima,
                humedad_minima = EXCLUDED.humedad_minima,
                humedad_maxima = EXCLUDED.humedad_maxima,
                calidad_aire_maxima = EXCLUDED.calidad_aire_maxima,
                intervalo_actualizacion_segundos = EXCLUDED.intervalo_actualizacion_segundos,
                minutos_sin_datos = EXCLUDED.minutos_sin_datos,
                etiqueta_sensor = EXCLUDED.etiqueta_sensor,
                notificaciones_habilitadas = EXCLUDED.notificaciones_habilitadas,
                id_usuario_actualizacion = EXCLUDED.id_usuario_actualizacion,
                actualizado_en = now()
            RETURNING temperatura_maxima, humedad_minima, humedad_maxima,
                      calidad_aire_maxima, intervalo_actualizacion_segundos,
                      minutos_sin_datos, etiqueta_sensor, notificaciones_habilitadas,
                      actualizado_en
            """,
            (*(ajustes_api[clave] for clave in CLAVES_CONFIGURACION_API), id_usuario_actualizacion),
        )
        row = cursor.fetchone()
        conn.commit()
        ajustes_guardados = _configuracion_para_api(row)
        return {**DEFAULTS, **ajustes_guardados, "updatedAt": row[8].isoformat() if row[8] else None}
    except Exception:
        if conn:
            conn.rollback()
        raise
    finally:
        if cursor:
            cursor.close()
        if conn:
            conn.close()
