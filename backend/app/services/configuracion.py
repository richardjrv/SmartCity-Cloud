"""Shared system settings persistence."""

from psycopg2.extras import Json

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


def obtener_configuracion():
    conn = cursor = None
    try:
        conn = get_db_connection()
        cursor = conn.cursor()
        cursor.execute(
            "SELECT settings, updated_at FROM public.configuracion_sistema WHERE id = 1"
        )
        row = cursor.fetchone()
        if not row:
            return {**DEFAULTS, "updatedAt": None}
        settings = row[0] if isinstance(row[0], dict) else {}
        return {**DEFAULTS, **settings, "updatedAt": row[1].isoformat() if row[1] else None}
    finally:
        if cursor:
            cursor.close()
        if conn:
            conn.close()


def guardar_configuracion(settings, updated_by):
    conn = cursor = None
    try:
        conn = get_db_connection()
        cursor = conn.cursor()
        cursor.execute(
            """
            INSERT INTO public.configuracion_sistema (id, settings, updated_by, updated_at)
            VALUES (1, %s, %s, now())
            ON CONFLICT (id) DO UPDATE
            SET settings = EXCLUDED.settings,
                updated_by = EXCLUDED.updated_by,
                updated_at = now()
            RETURNING settings, updated_at
            """,
            (Json(settings), updated_by),
        )
        row = cursor.fetchone()
        conn.commit()
        saved = row[0] if isinstance(row[0], dict) else settings
        return {**DEFAULTS, **saved, "updatedAt": row[1].isoformat() if row[1] else None}
    except Exception:
        if conn:
            conn.rollback()
        raise
    finally:
        if cursor:
            cursor.close()
        if conn:
            conn.close()
