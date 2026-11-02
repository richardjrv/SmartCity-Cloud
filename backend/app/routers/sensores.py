from datetime import datetime, timezone

from fastapi import APIRouter, Depends, HTTPException
import psycopg2

from app.core.security import obtener_usuario_actual, requerir_admin
from app.db.database import get_db_connection
from app.models.sensores import ActualizarSensorCatalogoData, LecturaSensorData, RegistrarSensorCatalogoData
from app.services import sensores as servicio_sensores
from app.utils.auditoria_helper import registrar_auditoria

router = APIRouter(prefix="/sensores", tags=["Sensores IoT"])


@router.get("/catalogo")
def listar_catalogo_sensores(usuario: dict = Depends(obtener_usuario_actual)):
    """Consulta el inventario lógico ligado al único ESP32 para todos los roles."""
    conn = cursor = None
    try:
        conn = get_db_connection()
        cursor = conn.cursor()
        cursor.execute(
            """
            SELECT s.id_sensor, s.codigo, s.id_dispositivo, d.nombre,
                   s.nombre, s.modelo, s.ubicacion, s.estado, s.objeto_modelo,
                   s.observaciones, s.actualizado_en,
                   COALESCE(
                       array_agg(DISTINCT m.nombre) FILTER (WHERE m.nombre IS NOT NULL),
                       ARRAY[]::text[]
                   ) AS magnitudes,
                   MAX(l.fecha_hora) AS ultima_lectura,
                   d.intervalo_esperado_segundos
            FROM public.sensores AS s
            JOIN public.dispositivos_iot AS d ON d.id_dispositivo = s.id_dispositivo
            LEFT JOIN public.sensor_magnitud AS sm ON sm.id_sensor = s.id_sensor
            LEFT JOIN public.magnitudes AS m ON m.id_magnitud = sm.id_magnitud
            LEFT JOIN public.lecturas AS l
                ON l.id_sensor = sm.id_sensor AND l.id_magnitud = sm.id_magnitud
            WHERE s.id_dispositivo = 'ESP32'
            GROUP BY s.id_sensor, s.codigo, s.id_dispositivo, d.nombre,
                     s.nombre, s.modelo, s.ubicacion, s.estado, s.objeto_modelo,
                     s.observaciones, s.actualizado_en, d.intervalo_esperado_segundos
            ORDER BY s.nombre, s.id_sensor
            """
        )
        ahora = datetime.now(timezone.utc)
        sensores = []
        for fila in cursor.fetchall():
            ultima_lectura = fila[12]
            if ultima_lectura is None:
                estado_conexion = "sin_lecturas"
            else:
                fecha_lectura = ultima_lectura
                if fecha_lectura.tzinfo is None:
                    fecha_lectura = fecha_lectura.replace(tzinfo=timezone.utc)
                umbral_segundos = max(int(fila[13] or 300) * 3, 60)
                edad_segundos = max(0, (ahora - fecha_lectura.astimezone(timezone.utc)).total_seconds())
                estado_conexion = "conectado" if edad_segundos <= umbral_segundos else "sin_datos_recientes"

            sensores.append(
                {
                    "id_sensor": fila[0],
                    "codigo": fila[1],
                    "id_controlador": fila[2],
                    "controlador": fila[3],
                    "nombre": fila[4],
                    "modelo": fila[5],
                    "ubicacion": fila[6],
                    "estado": fila[7],
                    "objeto_modelo": fila[8],
                    "observaciones": fila[9],
                    "actualizado_en": fila[10].isoformat() if fila[10] else None,
                    "magnitudes": list(fila[11] or []),
                    "ultima_lectura": ultima_lectura.isoformat() if ultima_lectura else None,
                    "estado_conexion": estado_conexion,
                    "intervalo_esperado_segundos": fila[13],
                }
            )
        return {"controlador": "ESP32", "sensores": sensores}
    except Exception as error:
        raise HTTPException(status_code=503, detail="No se pudo consultar el catálogo de sensores.") from error
    finally:
        if cursor:
            cursor.close()
        if conn:
            conn.close()


@router.post("/catalogo", status_code=201)
def registrar_sensor_catalogo(
    datos: RegistrarSensorCatalogoData,
    admin: dict = Depends(requerir_admin),
):
    """Pre-registra un canal compatible; nunca crea un segundo controlador ESP32."""
    if not datos.nombre.strip():
        raise HTTPException(status_code=422, detail="El nombre del sensor no puede quedar vacío.")
    modelo = datos.modelo.strip() or None if datos.modelo is not None else None
    ubicacion = datos.ubicacion.strip() or None if datos.ubicacion is not None else None
    objeto_modelo = datos.objeto_modelo.strip() or None if datos.objeto_modelo is not None else None
    observaciones = datos.observaciones.strip() or None if datos.observaciones is not None else None

    conn = cursor = None
    try:
        conn = get_db_connection()
        cursor = conn.cursor()
        cursor.execute("SELECT id_magnitud FROM public.magnitudes WHERE codigo = %s", (servicio_sensores.MAGNITUDES_LECTURA[datos.campo][0],))
        magnitud = cursor.fetchone()
        if not magnitud:
            raise HTTPException(status_code=503, detail="No se encontró la magnitud del sensor. Verifica el catálogo lógico del ESP32.")

        codigo = f"ESP32:{datos.campo}"
        cursor.execute(
            """
            INSERT INTO public.sensores
                (codigo, id_dispositivo, nombre, modelo, ubicacion, estado, objeto_modelo, observaciones)
            VALUES (%s, 'ESP32', %s, %s, %s, 'pendiente', %s, %s)
            RETURNING id_sensor
            """,
            (codigo, datos.nombre.strip(), modelo, ubicacion, objeto_modelo, observaciones),
        )
        sensor_id = cursor.fetchone()[0]
        cursor.execute(
            "INSERT INTO public.sensor_magnitud (id_sensor, id_magnitud) VALUES (%s, %s)",
            (sensor_id, magnitud[0]),
        )
        conn.commit()
        registrar_auditoria(
            admin["user_id"],
            "REGISTRAR_SENSOR",
            "sensores",
            f"Pre-registró el canal {codigo} ({datos.nombre.strip()}).",
            sensor_id,
        )
        return {"mensaje": "Sensor pre-registrado; aparecerá activo cuando el ESP32 envíe su primera lectura.", "id_sensor": sensor_id}
    except HTTPException:
        if conn:
            conn.rollback()
        raise
    except psycopg2.errors.UniqueViolation as error:
        if conn:
            conn.rollback()
        detail = "Ese objeto 3D ya está asignado a otro sensor." if error.diag.constraint_name == "idx_sensores_objeto_modelo" else "Ese canal del ESP32 ya está registrado."
        raise HTTPException(status_code=409, detail=detail) from error
    except Exception as error:
        if conn:
            conn.rollback()
        raise HTTPException(status_code=503, detail="No se pudo registrar el sensor.") from error
    finally:
        if cursor:
            cursor.close()
        if conn:
            conn.close()


@router.patch("/catalogo/{sensor_id}")
def actualizar_sensor_catalogo(
    sensor_id: int,
    datos: ActualizarSensorCatalogoData,
    admin: dict = Depends(requerir_admin),
):
    """Permite que solo Admin edite el inventario, sin cambiar el vínculo ESP32/magnitud."""
    cambios = datos.dict(exclude_unset=True)
    if not cambios:
        raise HTTPException(status_code=422, detail="Indica al menos un campo que quieras actualizar.")

    campos_opcionales = {"modelo", "ubicacion", "objeto_modelo", "observaciones"}
    for campo, valor in list(cambios.items()):
        if campo == "nombre":
            if valor is None or not valor.strip():
                raise HTTPException(status_code=422, detail="El nombre del sensor no puede quedar vacío.")
            cambios[campo] = valor.strip()
        elif campo in campos_opcionales:
            cambios[campo] = valor.strip() or None if valor is not None else None
        elif campo == "estado" and valor is None:
            raise HTTPException(status_code=422, detail="Selecciona un estado válido para el sensor.")

    columnas_permitidas = {
        "nombre": "nombre",
        "modelo": "modelo",
        "ubicacion": "ubicacion",
        "estado": "estado",
        "objeto_modelo": "objeto_modelo",
        "observaciones": "observaciones",
    }
    asignaciones = ", ".join(f"{columnas_permitidas[campo]} = %s" for campo in cambios)
    valores = list(cambios.values())
    conn = cursor = None
    try:
        conn = get_db_connection()
        cursor = conn.cursor()
        cursor.execute(
            f"""
            UPDATE public.sensores
            SET {asignaciones}, actualizado_en = NOW()
            WHERE id_sensor = %s AND id_dispositivo = 'ESP32'
            RETURNING codigo, nombre
            """,
            (*valores, sensor_id),
        )
        sensor = cursor.fetchone()
        if not sensor:
            raise HTTPException(status_code=404, detail="No se encontró ese sensor del ESP32.")
        conn.commit()
        registrar_auditoria(
            admin["user_id"],
            "ACTUALIZAR_SENSOR",
            "sensores",
            f"Actualizó el catálogo del sensor {sensor[0]} ({sensor[1]}).",
            sensor_id,
        )
        return {"mensaje": "Sensor actualizado correctamente.", "id_sensor": sensor_id}
    except HTTPException:
        if conn:
            conn.rollback()
        raise
    except psycopg2.errors.UniqueViolation as error:
        if conn:
            conn.rollback()
        raise HTTPException(status_code=409, detail="Ese objeto 3D ya está asignado a otro sensor.") from error
    except Exception as error:
        if conn:
            conn.rollback()
        raise HTTPException(status_code=503, detail="No se pudo actualizar el sensor.") from error
    finally:
        if cursor:
            cursor.close()
        if conn:
            conn.close()


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
