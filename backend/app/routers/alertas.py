from fastapi import APIRouter, Depends, HTTPException

from app.core.security import obtener_usuario_actual, requerir_admin
from app.db.database import get_db_connection
from app.models.alertas import (
    CambioEstadoAlertaData,
    EstadoAlertaSensorData,
    ReporteAlertaData,
)

router = APIRouter(prefix="/alertas", tags=["Alertas"])

SELECT_ALERTA = """
    SELECT a.id, a.origen, a.titulo, a.descripcion, a.sensor_id, a.metrica,
           a.estado, a.creado_por, COALESCE(c.nombre, 'Usuario'),
           a.actualizado_por, COALESCE(u.nombre, ''), a.creado_en, a.actualizado_en
    FROM public.alertas AS a
    LEFT JOIN public.usuarios AS c ON c.id = a.creado_por
    LEFT JOIN public.usuarios AS u ON u.id = a.actualizado_por
"""


def serializar_alerta(fila):
    return {
        "id": fila[0],
        "origen": fila[1],
        "titulo": fila[2],
        "descripcion": fila[3],
        "sensor_id": fila[4],
        "metrica": fila[5],
        "estado": fila[6],
        "creado_por": fila[7],
        "creador": fila[8],
        "actualizado_por": fila[9],
        "actualizador": fila[10],
        "creado_en": fila[11].isoformat() if fila[11] else None,
        "actualizado_en": fila[12].isoformat() if fila[12] else None,
    }


def cerrar_recursos(cursor, conn):
    if cursor:
        cursor.close()
    if conn:
        conn.close()


def usuario_activo(usuario: dict = Depends(obtener_usuario_actual)):
    conn = cursor = None
    try:
        conn = get_db_connection()
        cursor = conn.cursor()
        cursor.execute(
            "SELECT COALESCE(estado, 'activo') FROM public.usuarios WHERE id = %s",
            (usuario["user_id"],),
        )
        fila = cursor.fetchone()
        if not fila or fila[0] != "activo":
            raise HTTPException(status_code=403, detail="La cuenta está inactiva o ya no existe.")
        return usuario
    except HTTPException:
        raise
    except Exception as error:
        raise HTTPException(status_code=503, detail="No se pudo validar la cuenta.") from error
    finally:
        cerrar_recursos(cursor, conn)


@router.get("")
def listar_alertas(usuario: dict = Depends(usuario_activo)):
    """Usuarios autenticados pueden consultar los reportes y sus cambios de estado."""
    conn = cursor = None
    try:
        conn = get_db_connection()
        cursor = conn.cursor()
        cursor.execute(SELECT_ALERTA + " ORDER BY a.creado_en DESC, a.id DESC LIMIT 100")
        return [serializar_alerta(fila) for fila in cursor.fetchall()]
    except Exception as error:
        raise HTTPException(status_code=503, detail="No se pudieron consultar las alertas.") from error
    finally:
        cerrar_recursos(cursor, conn)


@router.post("", status_code=201)
def reportar_alerta(datos: ReporteAlertaData, usuario: dict = Depends(usuario_activo)):
    """Cualquier usuario con sesión puede informar un incidente al administrador."""
    titulo = datos.titulo.strip()
    descripcion = datos.descripcion.strip()
    if len(titulo) < 3 or len(descripcion) < 3:
        raise HTTPException(status_code=422, detail="Escribe un título y una descripción válidos.")

    conn = cursor = None
    try:
        conn = get_db_connection()
        cursor = conn.cursor()
        cursor.execute(
            """
            INSERT INTO public.alertas (origen, titulo, descripcion, sensor_id, creado_por)
            VALUES ('usuario', %s, %s, %s, %s)
            RETURNING id
            """,
            (titulo, descripcion, (datos.sensor_id or "").strip() or None, usuario["user_id"]),
        )
        alerta_id = cursor.fetchone()[0]
        conn.commit()
        cursor.execute(SELECT_ALERTA + " WHERE a.id = %s", (alerta_id,))
        return serializar_alerta(cursor.fetchone())
    except HTTPException:
        raise
    except Exception as error:
        if conn:
            conn.rollback()
        raise HTTPException(status_code=503, detail="No se pudo enviar el reporte de alerta.") from error
    finally:
        cerrar_recursos(cursor, conn)


@router.patch("/{alerta_id}/estado")
def cambiar_estado_alerta(
    alerta_id: int,
    datos: CambioEstadoAlertaData,
    admin: dict = Depends(requerir_admin),
):
    """Solo el administrador puede cambiar el seguimiento; todos pueden leerlo."""
    conn = cursor = None
    try:
        conn = get_db_connection()
        cursor = conn.cursor()
        cursor.execute(
            """
            UPDATE public.alertas
            SET estado = %s, actualizado_por = %s, actualizado_en = now()
            WHERE id = %s
            RETURNING id
            """,
            (datos.estado, admin["user_id"], alerta_id),
        )
        fila = cursor.fetchone()
        if not fila:
            raise HTTPException(status_code=404, detail="No se encontró esa alerta.")
        conn.commit()
        cursor.execute(SELECT_ALERTA + " WHERE a.id = %s", (alerta_id,))
        return serializar_alerta(cursor.fetchone())
    except HTTPException:
        if conn:
            conn.rollback()
        raise
    except Exception as error:
        if conn:
            conn.rollback()
        raise HTTPException(status_code=503, detail="No se pudo cambiar el estado de la alerta.") from error
    finally:
        cerrar_recursos(cursor, conn)


@router.put("/sensor")
def guardar_estado_alerta_sensor(
    datos: EstadoAlertaSensorData,
    admin: dict = Depends(requerir_admin),
):
    """Persiste el estado administrativo de una alerta asociada al ESP32."""
    if not datos.sensor_id.strip() or not datos.metrica.strip():
        raise HTTPException(status_code=422, detail="El ESP32 y la variable de la alerta son obligatorios.")
    if len(datos.titulo.strip()) < 3 or len(datos.descripcion.strip()) < 3:
        raise HTTPException(status_code=422, detail="Escribe un título y una descripción válidos.")
    conn = cursor = None
    try:
        conn = get_db_connection()
        cursor = conn.cursor()
        cursor.execute(
            """
            INSERT INTO public.alertas (
                origen, titulo, descripcion, sensor_id, metrica,
                estado, creado_por, actualizado_por
            )
            VALUES ('sensor', %s, %s, %s, %s, %s, %s, %s)
            ON CONFLICT (sensor_id, metrica) WHERE origen = 'sensor'
            DO UPDATE SET titulo = EXCLUDED.titulo,
                          descripcion = EXCLUDED.descripcion,
                          estado = EXCLUDED.estado,
                          actualizado_por = EXCLUDED.actualizado_por,
                          actualizado_en = now()
            RETURNING id
            """,
            (
                datos.titulo.strip(),
                datos.descripcion.strip(),
                datos.sensor_id.strip(),
                datos.metrica.strip(),
                datos.estado,
                admin["user_id"],
                admin["user_id"],
            ),
        )
        alerta_id = cursor.fetchone()[0]
        conn.commit()
        cursor.execute(SELECT_ALERTA + " WHERE a.id = %s", (alerta_id,))
        return serializar_alerta(cursor.fetchone())
    except Exception as error:
        if conn:
            conn.rollback()
        raise HTTPException(status_code=503, detail="No se pudo guardar el estado de la alerta del sensor.") from error
    finally:
        cerrar_recursos(cursor, conn)
