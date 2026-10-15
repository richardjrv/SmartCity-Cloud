from fastapi import APIRouter, HTTPException, Depends
from app.core.security import ROLE_ADMIN, requerir_admin
from app.db.database import get_db_connection
from app.models.auth import ModificarUsuarioAdminData
from app.services.supabase_auth import SupabaseAuthError, delete_user, public_auth_error
from app.utils.auditoria_helper import registrar_auditoria

router = APIRouter(prefix="/api/admin", tags=["Administración"])

@router.get("/usuarios")
def listar_usuarios_admin(admin: dict = Depends(requerir_admin)):
    try:
        conn = get_db_connection()
        cursor = conn.cursor()
        cursor.execute(
            """
            SELECT u.id, u.nombre, u.email, u.username, u.id_rol,
                   COALESCE(u.estado, 'activo'), u.fecha_registro, u.ultimo_acceso,
                   r.nombre
            FROM usuarios AS u LEFT JOIN public.roles AS r ON r.id = u.id_rol
            WHERE u.auth_user_id IS NOT NULL ORDER BY u.id ASC
            """
        )
        filas = cursor.fetchall()
        cursor.close()
        conn.close()

        return [
            {
                "id": f[0],
                "nombre": f[1],
                "email": f[2],
                "username": f[3] or f[2].split("@")[0],
                "id_rol": f[4],
                "rol": {"admin": "👑 Administrador", "operador": "🛠️ Operador", "usuario": "👤 Usuario"}.get(f[8], "Rol desconocido"),
                "estado": f[5],
                "fecha_registro": str(f[6]),
                "ultimo_acceso": str(f[7])
            } for f in filas
        ]
    except Exception as e:
        raise HTTPException(status_code=400, detail=f"Error al listar usuarios: {str(e)}")

@router.put("/usuarios/{usuario_id}")
def modificar_usuario_admin(usuario_id: int, datos: ModificarUsuarioAdminData, admin: dict = Depends(requerir_admin)):
    if datos.id_rol is None and datos.estado is None:
        raise HTTPException(status_code=400, detail="Indica el rol o estado que deseas cambiar.")

    conn = None
    cursor = None
    try:
        conn = get_db_connection()
        cursor = conn.cursor()
        cursor.execute("SELECT pg_advisory_xact_lock(538719, 1)")
        cursor.execute(
            "SELECT id_rol, COALESCE(estado, 'activo') FROM public.usuarios WHERE id = %s FOR UPDATE",
            (usuario_id,),
        )
        actual = cursor.fetchone()
        if not actual:
            raise HTTPException(status_code=404, detail="No se encontró esa cuenta.")

        if datos.id_rol is not None:
            if usuario_id == admin["user_id"] and datos.id_rol != ROLE_ADMIN:
                raise HTTPException(status_code=400, detail="No puedes cambiar tu propio rol de administrador.")
            cursor.execute("SELECT 1 FROM public.roles WHERE id = %s", (datos.id_rol,))
            if not cursor.fetchone():
                raise HTTPException(status_code=422, detail="El rol seleccionado no existe en el sistema.")

        if actual[0] == ROLE_ADMIN and datos.id_rol is not None and datos.id_rol != ROLE_ADMIN:
            cursor.execute("SELECT count(*) FROM public.usuarios WHERE id_rol = %s", (ROLE_ADMIN,))
            if cursor.fetchone()[0] <= 1:
                raise HTTPException(status_code=409, detail="No puedes quitar el rol al último administrador.")
        if actual[0] == ROLE_ADMIN and datos.estado == "inactivo" and actual[1] == "activo":
            cursor.execute("SELECT count(*) FROM public.usuarios WHERE id_rol = %s AND COALESCE(estado, 'activo') = 'activo'", (ROLE_ADMIN,))
            if cursor.fetchone()[0] <= 1:
                raise HTTPException(status_code=409, detail="No puedes desactivar al último administrador activo.")

        if datos.id_rol is not None:
            cursor.execute("UPDATE public.usuarios SET id_rol = %s WHERE id = %s", (datos.id_rol, usuario_id))

        if datos.estado is not None:
            cursor.execute("UPDATE public.usuarios SET estado = %s WHERE id = %s", (datos.estado, usuario_id))

        conn.commit()
        if datos.id_rol is not None:
            registrar_auditoria(admin["user_id"], "CAMBIAR_ROL", "usuarios", f"Cambió el rol de usuario #{usuario_id} a {datos.id_rol}", usuario_id)
        if datos.estado is not None:
            registrar_auditoria(admin["user_id"], "CAMBIAR_ESTADO", "usuarios", f"Cambió el estado de usuario #{usuario_id} a {datos.estado}", usuario_id)
        return {"mensaje": f"Cuenta #{usuario_id} actualizada correctamente."}
    except HTTPException:
        if conn:
            conn.rollback()
        raise
    except Exception as error:
        if conn:
            conn.rollback()
        raise HTTPException(status_code=503, detail="No se pudo actualizar la cuenta.") from error
    finally:
        if cursor:
            cursor.close()
        if conn:
            conn.close()

@router.delete("/usuarios/{usuario_id}")
def eliminar_usuario_admin(usuario_id: int, admin: dict = Depends(requerir_admin)):
    if usuario_id == admin["user_id"]:
        raise HTTPException(status_code=400, detail="No puedes eliminar tu propia cuenta.")

    conn = None
    cursor = None
    try:
        conn = get_db_connection()
        cursor = conn.cursor()
        cursor.execute("SELECT pg_advisory_lock(538719, 1)")
        cursor.execute("SELECT auth_user_id, id_rol FROM public.usuarios WHERE id = %s", (usuario_id,))
        cuenta = cursor.fetchone()
        if not cuenta or not cuenta[0]:
            raise HTTPException(status_code=404, detail="No se encontró una cuenta vinculada a Supabase Auth.")
        if cuenta[1] == ROLE_ADMIN:
            cursor.execute("SELECT count(*) FROM public.usuarios WHERE id_rol = %s", (ROLE_ADMIN,))
            if cursor.fetchone()[0] <= 1:
                raise HTTPException(status_code=409, detail="No puedes eliminar al último administrador.")
        delete_user(str(cuenta[0]))
        registrar_auditoria(admin["user_id"], "ELIMINAR_USUARIO", "usuarios", f"Eliminó al usuario #{usuario_id}", usuario_id)
        return {"mensaje": f"Usuario #{usuario_id} eliminado."}
    except HTTPException:
        raise
    except Exception as error:
        if isinstance(error, SupabaseAuthError):
            raise public_auth_error(error) from error
        raise HTTPException(status_code=503, detail="No se pudo eliminar la cuenta.") from error
    finally:
        if cursor:
            cursor.close()
        if conn:
            conn.close()

@router.get("/auditoria")
def obtener_auditoria_admin(admin: dict = Depends(requerir_admin)):
    try:
        conn = get_db_connection()
        cursor = conn.cursor()
        cursor.execute(
            """
            SELECT a.id, COALESCE(u.nombre, 'Sistema') AS usuario, a.accion, a.modulo, a.recurso_id, a.descripcion, a.fecha 
            FROM auditoria a
            LEFT JOIN usuarios u ON a.usuario_id = u.id
            ORDER BY a.fecha DESC LIMIT 100
            """
        )
        filas = cursor.fetchall()
        cursor.close()
        conn.close()

        return [
            {
                "id": f[0],
                "usuario": f[1],
                "accion": f[2],
                "modulo": f[3],
                "recurso_id": f[4],
                "descripcion": f[5],
                "fecha": str(f[6])
            } for f in filas
        ]
    except Exception as e:
        raise HTTPException(status_code=400, detail=f"Error consultando auditoría: {str(e)}")
