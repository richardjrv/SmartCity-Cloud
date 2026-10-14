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


def cargar_historial(cursor, alerta_ids):
    if not alerta_ids:
        return {}
    cursor.execute(
        """
        SELECT h.alerta_id, h.id, h.actor_id, COALESCE(u.nombre, 'Usuario'),
               h.estado_anterior, h.estado_nuevo, h.observacion, h.creado_en
        FROM public.alerta_historial AS h
        LEFT JOIN public.usuarios AS u ON u.id = h.actor_id
        WHERE h.alerta_id = ANY(%s)
        ORDER BY h.creado_en, h.id
        """,
        (alerta_ids,),
    )
    historial = {alerta_id: [] for alerta_id in alerta_ids}
    for fila in cursor.fetchall():
        historial[fila[0]].append({
            "id": fila[1],
            "actor_id": fila[2],
            "actor": fila[3],
            "estado_anterior": fila[4],
            "estado_nuevo": fila[5],
            "observacion": fila[6],
            "creado_en": fila[7].isoformat() if fila[7] else None,
        })
    return historial


def serializar_con_historial(cursor, fila):
    alerta = serializar_alerta(fila)
    alerta["historial"] = cargar_historial(cursor, [alerta["id"]]).get(alerta["id"], [])
    return alerta


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


def usuario_comun(usuario: dict = Depends(usuario_activo)):
    """Permite enviar reportes a cuentas ciudadanas, no a administradores."""
    conn = cursor = None
    try:
        conn = get_db_connection()
        cursor = conn.cursor()
        cursor.execute("SELECT id_rol FROM public.usuarios WHERE id = %s", (usuario["user_id"],))
        fila = cursor.fetchone()
        if not fila:
            raise HTTPException(status_code=403, detail="La cuenta ya no está disponible.")
        if fila[0] != 2:
            raise HTTPException(status_code=403, detail="Solo las cuentas de usuario pueden enviar avisos.")
        return usuario
    except HTTPException:
        raise
    except Exception as error:
        raise HTTPException(status_code=503, detail="No se pudo validar el permiso para reportar.") from error
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
        filas = cursor.fetchall()
        alertas = [serializar_alerta(fila) for fila in filas]
        historial = cargar_historial(cursor, [alerta["id"] for alerta in alertas])
        for alerta in alertas:
            alerta["historial"] = historial.get(alerta["id"], [])
        return alertas
    except Exception as error:
        raise HTTPException(status_code=503, detail="No se pudieron consultar las alertas.") from error
    finally:
        cerrar_recursos(cursor, conn)


@router.post("", status_code=201)
def reportar_alerta(datos: ReporteAlertaData, usuario: dict = Depends(usuario_comun)):
    """Las cuentas ciudadanas pueden informar incidentes al administrador."""
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
        cursor.execute(
            """
            INSERT INTO public.alerta_historial
                (alerta_id, actor_id, estado_anterior, estado_nuevo, observacion)
            VALUES (%s, %s, NULL, 'pendiente', 'Aviso reportado')
            """,
            (alerta_id, usuario["user_id"]),
        )
        conn.commit()
        cursor.execute(SELECT_ALERTA + " WHERE a.id = %s", (alerta_id,))
        return serializar_con_historial(cursor, cursor.fetchone())
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
        cursor.execute("SELECT estado FROM public.alertas WHERE id = %s FOR UPDATE", (alerta_id,))
        anterior = cursor.fetchone()
        if not anterior:
            raise HTTPException(status_code=404, detail="No se encontró esa alerta.")
        observacion = datos.observacion.strip()
        if not observacion:
            raise HTTPException(status_code=422, detail="Escribe una nota breve antes de guardar.")
        cursor.execute(
            """
            UPDATE public.alertas
            SET estado = %s, actualizado_por = %s, actualizado_en = now()
            WHERE id = %s
            """,
            (datos.estado, admin["user_id"], alerta_id),
        )
        cursor.execute(
            """
            INSERT INTO public.alerta_historial
                (alerta_id, actor_id, estado_anterior, estado_nuevo, observacion)
            VALUES (%s, %s, %s, %s, %s)
            """,
            (alerta_id, admin["user_id"], anterior[0], datos.estado, observacion),
        )
        conn.commit()
        cursor.execute(SELECT_ALERTA + " WHERE a.id = %s", (alerta_id,))
        return serializar_con_historial(cursor, cursor.fetchone())
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
    """El administrador solo cambia estado y deja una nota sobre un reporte ya existente."""
    if not datos.sensor_id.strip() or not datos.metrica.strip():
        raise HTTPException(status_code=422, detail="El ESP32 y la variable de la alerta son obligatorios.")
    conn = cursor = None
    try:
        conn = get_db_connection()
        cursor = conn.cursor()
        cursor.execute(
            """
            SELECT id, estado FROM public.alertas
            WHERE sensor_id = %s AND metrica = %s AND origen = 'sensor'
            FOR UPDATE
            """,
            (datos.sensor_id.strip(), datos.metrica.strip()),
        )
        estado_anterior = cursor.fetchone()
        if not estado_anterior:
            raise HTTPException(status_code=404, detail="No existe un reporte de sensor para actualizar.")
        alerta_id, estado_actual = estado_anterior
        observacion = datos.observacion.strip()
        if not observacion:
            raise HTTPException(status_code=422, detail="Escribe una nota breve antes de guardar.")
        cursor.execute(
            """
            UPDATE public.alertas
            SET estado = %s, actualizado_por = %s, actualizado_en = now()
            WHERE id = %s
            """,
            (datos.estado, admin["user_id"], alerta_id),
        )
        cursor.execute(
            """
            INSERT INTO public.alerta_historial
                (alerta_id, actor_id, estado_anterior, estado_nuevo, observacion)
            VALUES (%s, %s, %s, %s, %s)
            """,
            (
                alerta_id,
                admin["user_id"],
                estado_actual,
                datos.estado,
                observacion,
            ),
        )
        conn.commit()
        cursor.execute(SELECT_ALERTA + " WHERE a.id = %s", (alerta_id,))
        return serializar_con_historial(cursor, cursor.fetchone())
    except HTTPException:
        if conn:
            conn.rollback()
        raise
    except Exception as error:
        if conn:
            conn.rollback()
        raise HTTPException(status_code=503, detail="No se pudo actualizar el estado de la alerta del sensor.") from error
    finally:
        cerrar_recursos(cursor, conn)
