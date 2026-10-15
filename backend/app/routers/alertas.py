from fastapi import APIRouter, Depends, HTTPException

from app.core.security import ROLE_USER, obtener_usuario_actual, requerir_gestor_alertas
from app.db.database import get_db_connection
from app.models.alertas import (
    CambioEstadoAlertaData,
    EstadoAlertaSensorData,
    ReporteAlertaData,
)
from app.services import alertas as servicio_alertas

router = APIRouter(prefix="/alertas", tags=["Alertas"])


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
        if cursor:
            cursor.close()
        if conn:
            conn.close()


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
        if fila[0] != ROLE_USER:
            raise HTTPException(status_code=403, detail="Solo las cuentas de usuario pueden enviar avisos.")
        return usuario
    except HTTPException:
        raise
    except Exception as error:
        raise HTTPException(status_code=503, detail="No se pudo validar el permiso para reportar.") from error
    finally:
        if cursor:
            cursor.close()
        if conn:
            conn.close()


@router.get("")
def listar_alertas(usuario: dict = Depends(usuario_activo)):
    """Usuarios autenticados pueden consultar los reportes y sus cambios de estado."""
    try:
        return servicio_alertas.listar_alertas()
    except Exception as error:
        raise HTTPException(status_code=503, detail="No se pudieron consultar las alertas.") from error


@router.post("", status_code=201)
def reportar_alerta(datos: ReporteAlertaData, usuario: dict = Depends(usuario_comun)):
    """Las cuentas ciudadanas pueden informar incidentes al administrador."""
    try:
        return servicio_alertas.reportar_alerta(datos, usuario["user_id"])
    except ValueError as error:
        raise HTTPException(status_code=422, detail=str(error)) from error
    except Exception as error:
        raise HTTPException(status_code=503, detail="No se pudo enviar el reporte de alerta.") from error


@router.patch("/{alerta_id}/estado")
def cambiar_estado_alerta(
    alerta_id: int,
    datos: CambioEstadoAlertaData,
    gestor: dict = Depends(requerir_gestor_alertas),
):
    """Administrators and operators may follow up; all signed-in users may read."""
    try:
        return servicio_alertas.cambiar_estado_alerta(alerta_id, datos, gestor["user_id"])
    except servicio_alertas.AlertaNoEncontrada as error:
        raise HTTPException(status_code=404, detail="No se encontró esa alerta.") from error
    except servicio_alertas.NotaObligatoria as error:
        raise HTTPException(status_code=422, detail="Escribe una nota breve antes de guardar.") from error
    except Exception as error:
        raise HTTPException(status_code=503, detail="No se pudo cambiar el estado de la alerta.") from error


@router.put("/sensor")
def guardar_estado_alerta_sensor(
    datos: EstadoAlertaSensorData,
    gestor: dict = Depends(requerir_gestor_alertas),
):
    """Administrators and operators can change a sensor alert and leave a note."""
    try:
        return servicio_alertas.guardar_estado_alerta_sensor(datos, gestor["user_id"])
    except ValueError as error:
        raise HTTPException(status_code=422, detail=str(error)) from error
    except servicio_alertas.NotaObligatoria as error:
        raise HTTPException(status_code=422, detail="Escribe una nota breve antes de guardar.") from error
    except servicio_alertas.AlertaNoEncontrada as error:
        raise HTTPException(status_code=404, detail="No existe un reporte de sensor para actualizar.") from error
    except Exception as error:
        raise HTTPException(status_code=503, detail="No se pudo actualizar el estado de la alerta del sensor.") from error
