"""Reglas de negocio y persistencia del seguimiento de alertas."""

from app.db.database import get_db_connection

SELECT_ALERTA = """
    SELECT a.id, a.origen, a.titulo, a.descripcion, a.sensor_id, a.metrica,
           a.estado, a.creado_por, COALESCE(c.nombre, 'Usuario'),
           a.actualizado_por, COALESCE(u.nombre, ''), a.creado_en, a.actualizado_en
    FROM public.alertas AS a
    LEFT JOIN public.usuarios AS c ON c.id = a.creado_por
    LEFT JOIN public.usuarios AS u ON u.id = a.actualizado_por
"""


class AlertaNoEncontrada(Exception):
    pass


class NotaObligatoria(Exception):
    pass


def serializar_alerta(fila):
    return {
        "id": fila[0], "origen": fila[1], "titulo": fila[2], "descripcion": fila[3],
        "sensor_id": fila[4], "metrica": fila[5], "estado": fila[6], "creado_por": fila[7],
        "creador": fila[8], "actualizado_por": fila[9], "actualizador": fila[10],
        "creado_en": fila[11].isoformat() if fila[11] else None,
        "actualizado_en": fila[12].isoformat() if fila[12] else None,
    }


def _cargar_historial(cursor, alerta_ids):
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
            "id": fila[1], "actor_id": fila[2], "actor": fila[3],
            "estado_anterior": fila[4], "estado_nuevo": fila[5],
            "observacion": fila[6], "creado_en": fila[7].isoformat() if fila[7] else None,
        })
    return historial


def _cerrar(cursor, conn):
    if cursor:
        cursor.close()
    if conn:
        conn.close()


def listar_alertas():
    conn = cursor = None
    try:
        conn = get_db_connection()
        cursor = conn.cursor()
        cursor.execute(SELECT_ALERTA + " ORDER BY a.creado_en DESC, a.id DESC LIMIT 100")
        filas = cursor.fetchall()
        alertas = [serializar_alerta(fila) for fila in filas]
        historial = _cargar_historial(cursor, [alerta["id"] for alerta in alertas])
        for alerta in alertas:
            alerta["historial"] = historial.get(alerta["id"], [])
        return alertas
    finally:
        _cerrar(cursor, conn)


def obtener_alerta(cursor, alerta_id):
    cursor.execute(SELECT_ALERTA + " WHERE a.id = %s", (alerta_id,))
    fila = cursor.fetchone()
    if not fila:
        raise AlertaNoEncontrada
    alerta = serializar_alerta(fila)
    alerta["historial"] = _cargar_historial(cursor, [alerta_id]).get(alerta_id, [])
    return alerta


def reportar_alerta(datos, user_id):
    titulo, descripcion = datos.titulo.strip(), datos.descripcion.strip()
    if len(titulo) < 3 or len(descripcion) < 3:
        raise ValueError("Escribe un título y una descripción válidos.")
    conn = cursor = None
    try:
        conn = get_db_connection()
        cursor = conn.cursor()
        cursor.execute(
            """INSERT INTO public.alertas (origen, titulo, descripcion, sensor_id, creado_por)
               VALUES ('usuario', %s, %s, %s, %s) RETURNING id""",
            (titulo, descripcion, (datos.sensor_id or "").strip() or None, user_id),
        )
        alerta_id = cursor.fetchone()[0]
        cursor.execute(
            """INSERT INTO public.alerta_historial
               (alerta_id, actor_id, estado_anterior, estado_nuevo, observacion)
               VALUES (%s, %s, NULL, 'pendiente', 'Aviso reportado')""",
            (alerta_id, user_id),
        )
        conn.commit()
        return obtener_alerta(cursor, alerta_id)
    except Exception:
        if conn:
            conn.rollback()
        raise
    finally:
        _cerrar(cursor, conn)


def cambiar_estado_alerta(alerta_id, datos, admin_id):
    observacion = datos.observacion.strip()
    if not observacion:
        raise NotaObligatoria
    conn = cursor = None
    try:
        conn = get_db_connection()
        cursor = conn.cursor()
        cursor.execute("SELECT estado FROM public.alertas WHERE id = %s FOR UPDATE", (alerta_id,))
        anterior = cursor.fetchone()
        if not anterior:
            raise AlertaNoEncontrada
        cursor.execute(
            """UPDATE public.alertas SET estado = %s, actualizado_por = %s, actualizado_en = now()
               WHERE id = %s""",
            (datos.estado, admin_id, alerta_id),
        )
        cursor.execute(
            """INSERT INTO public.alerta_historial
               (alerta_id, actor_id, estado_anterior, estado_nuevo, observacion)
               VALUES (%s, %s, %s, %s, %s)""",
            (alerta_id, admin_id, anterior[0], datos.estado, observacion),
        )
        conn.commit()
        return obtener_alerta(cursor, alerta_id)
    except Exception:
        if conn:
            conn.rollback()
        raise
    finally:
        _cerrar(cursor, conn)


def guardar_estado_alerta_sensor(datos, admin_id):
    sensor_id, metrica = datos.sensor_id.strip(), datos.metrica.strip()
    if not sensor_id or not metrica:
        raise ValueError("El ESP32 y la variable de la alerta son obligatorios.")
    observacion = datos.observacion.strip()
    if not observacion:
        raise NotaObligatoria
    conn = cursor = None
    try:
        conn = get_db_connection()
        cursor = conn.cursor()
        cursor.execute(
            """SELECT id, estado FROM public.alertas
               WHERE sensor_id = %s AND metrica = %s AND origen = 'sensor' FOR UPDATE""",
            (sensor_id, metrica),
        )
        anterior = cursor.fetchone()
        if not anterior:
            raise AlertaNoEncontrada
        alerta_id, estado_actual = anterior
        cursor.execute(
            """UPDATE public.alertas SET estado = %s, actualizado_por = %s, actualizado_en = now()
               WHERE id = %s""",
            (datos.estado, admin_id, alerta_id),
        )
        cursor.execute(
            """INSERT INTO public.alerta_historial
               (alerta_id, actor_id, estado_anterior, estado_nuevo, observacion)
               VALUES (%s, %s, %s, %s, %s)""",
            (alerta_id, admin_id, estado_actual, datos.estado, observacion),
        )
        conn.commit()
        return obtener_alerta(cursor, alerta_id)
    except Exception:
        if conn:
            conn.rollback()
        raise
    finally:
        _cerrar(cursor, conn)
