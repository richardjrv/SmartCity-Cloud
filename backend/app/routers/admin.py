from fastapi import APIRouter, HTTPException, Depends
from app.core.security import requerir_admin
from app.db.database import get_db_connection
from app.models.auth import ModificarUsuarioAdminData
from app.utils.auditoria_helper import registrar_auditoria

router = APIRouter(prefix="/api/admin", tags=["Administración"])

@router.get("/usuarios")
def listar_usuarios_admin(admin: dict = Depends(requerir_admin)):
    try:
        conn = get_db_connection()
        cursor = conn.cursor()
        cursor.execute(
            """
            SELECT id, nombre, email, username, id_rol, COALESCE(estado, 'activo'), fecha_registro, ultimo_acceso 
            FROM usuarios ORDER BY id ASC
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
                "rol": "👑 Admin" if f[4] == 1 else "👤 Usuario",
                "estado": f[5],
                "fecha_registro": str(f[6]),
                "ultimo_acceso": str(f[7])
            } for f in filas
        ]
    except Exception as e:
        raise HTTPException(status_code=400, detail=f"Error al listar usuarios: {str(e)}")

@router.put("/usuarios/{usuario_id}")
def modificar_usuario_admin(usuario_id: int, datos: ModificarUsuarioAdminData, admin: dict = Depends(requerir_admin)):
    try:
        conn = get_db_connection()
        cursor = conn.cursor()

        if datos.id_rol is not None:
            cursor.execute("UPDATE usuarios SET id_rol = %s WHERE id = %s", (datos.id_rol, usuario_id))
            registrar_auditoria(admin["user_id"], "CAMBIAR_ROL", "usuarios", f"Cambió rol de usuario #{usuario_id} a {datos.id_rol}", usuario_id)

        if datos.estado is not None:
            cursor.execute("UPDATE usuarios SET estado = %s WHERE id = %s", (datos.estado, usuario_id))
            registrar_auditoria(admin["user_id"], "CAMBIAR_ESTADO", "usuarios", f"Cambió estado de usuario #{usuario_id} a {datos.estado}", usuario_id)

        conn.commit()
        cursor.close()
        conn.close()
        return {"mensaje": f"Usuario #{usuario_id} actualizado por el Administrador ✅"}
    except Exception as e:
        raise HTTPException(status_code=400, detail=f"Error modificando usuario: {str(e)}")

@router.delete("/usuarios/{usuario_id}")
def eliminar_usuario_admin(usuario_id: int, admin: dict = Depends(requerir_admin)):
    if usuario_id == admin["user_id"]:
        raise HTTPException(status_code=400, detail="No puedes eliminar tu propia cuenta.")

    try:
        conn = get_db_connection()
        cursor = conn.cursor()
        cursor.execute("DELETE FROM usuarios WHERE id = %s", (usuario_id,))
        conn.commit()
        cursor.close()
        conn.close()

        registrar_auditoria(admin["user_id"], "ELIMINAR_USUARIO", "usuarios", f"Eliminó al usuario #{usuario_id}", usuario_id)
        return {"mensaje": f"Usuario #{usuario_id} eliminado 🗑️"}
    except Exception as e:
        raise HTTPException(status_code=400, detail=f"Error eliminando usuario: {str(e)}")

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