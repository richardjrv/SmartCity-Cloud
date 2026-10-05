from fastapi import APIRouter, HTTPException, Depends
from app.core.security import obtener_usuario_actual, pwd_context, verificar_password, generar_hash_password
from app.db.database import get_db_connection
from app.models.auth import ActualizarPerfilData, CambiarPasswordData
from app.utils.auditoria_helper import registrar_auditoria

router = APIRouter(prefix="/api/perfil", tags=["Perfil de Usuario"])

@router.get("")
def obtener_perfil(usuario: dict = Depends(obtener_usuario_actual)):
    try:
        conn = get_db_connection()
        cursor = conn.cursor()
        cursor.execute(
            """
            SELECT id, nombre, email, username, id_rol, COALESCE(estado, 'activo'), avatar, fecha_registro, ultimo_acceso 
            FROM usuarios WHERE id = %s
            """, 
            (usuario["user_id"],)
        )
        data = cursor.fetchone()
        cursor.close()
        conn.close()

        if not data:
            raise HTTPException(status_code=404, detail="Usuario no encontrado")

        return {
            "id": data[0],
            "nombre": data[1],
            "email": data[2],
            "username": data[3] or data[2].split("@")[0],
            "id_rol": data[4],
            "rol": "👑 Administrador" if data[4] == 1 else "👤 Usuario",
            "estado": data[5],
            "avatar": data[6] or "",
            "fecha_registro": str(data[7]),
            "ultimo_acceso": str(data[8])
        }
    except Exception as e:
        raise HTTPException(status_code=400, detail=f"Error al obtener perfil: {str(e)}")

@router.put("/editar")
def editar_perfil(datos: ActualizarPerfilData, usuario: dict = Depends(obtener_usuario_actual)):
    try:
        conn = get_db_connection()
        cursor = conn.cursor()

        if datos.nombre:
            cursor.execute("UPDATE usuarios SET nombre = %s WHERE id = %s", (datos.nombre, usuario["user_id"]))
        if datos.username:
            cursor.execute("UPDATE usuarios SET username = %s WHERE id = %s", (datos.username, usuario["user_id"]))
        if datos.avatar is not None:
            cursor.execute("UPDATE usuarios SET avatar = %s WHERE id = %s", (datos.avatar, usuario["user_id"]))

        conn.commit()
        cursor.close()
        conn.close()

        registrar_auditoria(usuario["user_id"], "EDITAR_PERFIL", "perfil", "Actualizó información del perfil")
        return {"mensaje": "Perfil actualizado correctamente ✅"}
    except Exception as e:
        raise HTTPException(status_code=400, detail=f"Error al actualizar perfil: {str(e)}")

@router.put("/cambiar-password")
def cambiar_password(datos: CambiarPasswordData, usuario: dict = Depends(obtener_usuario_actual)):
    try:
        conn = get_db_connection()
        cursor = conn.cursor()
        cursor.execute("SELECT password_hash FROM usuarios WHERE id = %s", (usuario["user_id"],))
        pass_hash = cursor.fetchone()[0]

        if not verificar_password(datos.password_actual, pass_hash):
            cursor.close()
            conn.close()
            raise HTTPException(status_code=400, detail="La contraseña actual es incorrecta")

        nuevo_hash = generar_hash_password(datos.password_nueva)
        cursor.execute("UPDATE usuarios SET password_hash = %s WHERE id = %s", (nuevo_hash, usuario["user_id"]))
        conn.commit()
        cursor.close()
        conn.close()

        registrar_auditoria(usuario["user_id"], "CAMBIAR_PASSWORD", "perfil", "Cambió su contraseña de acceso")
        return {"mensaje": "Contraseña actualizada exitosamente 🔒"}
    except HTTPException as he:
        raise he
    except Exception as e:
        raise HTTPException(status_code=400, detail=f"Error al cambiar contraseña: {str(e)}")