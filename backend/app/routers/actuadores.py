from fastapi import APIRouter, Depends, HTTPException, status
from jose import JWTError, jwt

from app.core.config import settings
from app.core.security import requerir_admin
from app.db.database import get_db_connection
from app.models.actuadores import ConfirmarOrdenActuadorData

router = APIRouter(prefix="/api/actuadores", tags=["Actuadores"])


@router.get("")
def listar_actuadores(admin: dict = Depends(requerir_admin)):
    """Devuelve el catálogo de actuadores únicamente a administradores."""
    conn = None
    cursor = None
    try:
        conn = get_db_connection()
        cursor = conn.cursor()
        cursor.execute(
            """
            SELECT id, sensor_id, nombre, tipo, estado_deseado,
                   estado_reportado, modo, activo, actualizado_en
            FROM public.actuadores
            ORDER BY nombre, sensor_id
            """
        )
        filas = cursor.fetchall()
        return [
            {
                "id": fila[0],
                "sensor_id": fila[1],
                "nombre": fila[2],
                "tipo": fila[3],
                "estado_deseado": fila[4],
                "estado_reportado": fila[5],
                "modo": fila[6],
                "activo": fila[7],
                "actualizado_en": fila[8].isoformat() if fila[8] else None,
            }
            for fila in filas
        ]
    except HTTPException:
        raise
    except Exception as error:
        raise HTTPException(status_code=503, detail="No se pudo consultar el catálogo de actuadores.") from error
    finally:
        if cursor:
            cursor.close()
        if conn:
            conn.close()


@router.post("/confirmar", status_code=status.HTTP_202_ACCEPTED)
def confirmar_orden_actuador(
    datos: ConfirmarOrdenActuadorData,
    admin: dict = Depends(requerir_admin),
):
    """Guarda una orden confirmada; el estado real espera el acuse del ESP32."""
    try:
        claims = jwt.decode(
            datos.confirmation_token,
            settings.BRUNITO_ACTION_SECRET or settings.SECRET_KEY,
            algorithms=[settings.ALGORITHM],
        )
    except JWTError as error:
        raise HTTPException(status_code=400, detail="La confirmación venció o no es válida. Pide una nueva propuesta.") from error

    if claims.get("purpose") != "actuator_confirmation":
        raise HTTPException(status_code=400, detail="El token no corresponde a una orden de actuador.")
    if str(claims.get("user_id")) != str(admin.get("user_id")):
        raise HTTPException(status_code=403, detail="Solo quien solicitó la orden puede confirmarla.")

    actuator_id = claims.get("actuator_id")
    sensor_id = claims.get("sensor_id")
    action = claims.get("accion")
    expected_version = claims.get("version")
    if (
        not isinstance(actuator_id, int)
        or not isinstance(sensor_id, str)
        or action not in ("encender", "apagar", "automatico")
        or not isinstance(expected_version, str)
    ):
        raise HTTPException(status_code=400, detail="La propuesta de orden está incompleta.")

    conn = None
    cursor = None
    try:
        conn = get_db_connection()
        cursor = conn.cursor()
        cursor.execute(
            """
            SELECT sensor_id, nombre, activo, actualizado_en, estado_deseado, estado_reportado
            FROM public.actuadores
            WHERE id = %s
            FOR UPDATE
            """,
            (actuator_id,),
        )
        actuator = cursor.fetchone()
        if not actuator or not actuator[2]:
            raise HTTPException(status_code=404, detail="El actuador ya no está disponible.")
        if actuator[0] != sensor_id:
            raise HTTPException(status_code=400, detail="La propuesta no coincide con el actuador registrado.")
        if not actuator[3] or actuator[3].isoformat() != expected_version:
            raise HTTPException(status_code=409, detail="El actuador cambió desde que se mostró la propuesta. Pide una nueva orden.")

        if action == "automatico":
            cursor.execute(
                """
                UPDATE public.actuadores
                SET modo = 'auto', actualizado_por = %s, ultimo_comando_en = NOW()
                WHERE id = %s
                """,
                (admin["user_id"], actuator_id),
            )
            estado_deseado_actual = actuator[4]
            estado = "poner en modo automático"
        else:
            estado_deseado_actual = action == "encender"
            cursor.execute(
                """
                UPDATE public.actuadores
                SET estado_deseado = %s, modo = 'manual',
                    actualizado_por = %s, ultimo_comando_en = NOW()
                WHERE id = %s
                """,
                (estado_deseado_actual, admin["user_id"], actuator_id),
            )
            estado = action
        descripcion = (
            f"Orden confirmada para {actuator[1]} ({sensor_id}): {estado}. "
            "Pendiente de confirmación del ESP32."
        )
        cursor.execute(
            """
            INSERT INTO public.auditoria (usuario_id, accion, modulo, recurso_id, descripcion)
            VALUES (%s, %s, %s, %s, %s)
            """,
            (admin["user_id"], "ORDEN_ACTUADOR", "actuadores", actuator_id, descripcion),
        )
        conn.commit()

        return {
            "mensaje": (
                f"Orden para {estado} guardada para {actuator[1]}. "
                "Queda pendiente: todavía no se envía al ESP32 ni confirma un cambio físico."
            ),
            "sensor_id": sensor_id,
            "estado_deseado": estado_deseado_actual,
            "estado_reportado": actuator[5],
            "modo": "auto" if action == "automatico" else "manual",
            "pendiente_esp32": True,
        }
    except HTTPException:
        if conn:
            conn.rollback()
        raise
    except Exception as error:
        if conn:
            conn.rollback()
        raise HTTPException(status_code=503, detail="No se pudo guardar la orden del actuador.") from error
    finally:
        if cursor:
            cursor.close()
        if conn:
            conn.close()
