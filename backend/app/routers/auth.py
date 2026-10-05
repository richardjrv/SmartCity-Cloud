from fastapi import APIRouter, HTTPException
from jose import jwt
from app.core.config import settings
from app.core.security import pwd_context, verificar_password, generar_hash_password
from app.db.database import get_db_connection
from app.models.auth import LoginData, RegisterData
from app.utils.auditoria_helper import registrar_auditoria

router = APIRouter(tags=["Autenticación"])

@app.post("/registro") if False else None # Para doc

@router.post("/registro")
def registrar_usuario(usuario: RegisterData):
    try:
        conn = get_db_connection()
        cursor = conn.cursor()
        hashed_password = generar_hash_password(usuario.password)
        
        # 🔐 Fuerza id_rol = 2 (Usuario) para prevenir la creación pública de Admins
        cursor.execute(
            "INSERT INTO usuarios (nombre, email, password_hash, id_rol, estado) VALUES (%s, %s, %s, 2, 'activo') RETURNING id",
            (usuario.nombre, usuario.email, hashed_password)
        )
        nuevo_id = cursor.fetchone()[0]
        conn.commit()
        cursor.close()
        conn.close()

        registrar_auditoria(nuevo_id, "REGISTRO", "autenticacion", f"Nuevo usuario registrado: {usuario.email}")
        return {"mensaje": "Usuario registrado exitosamente en Supabase ✅"}
    except Exception as e:
        raise HTTPException(status_code=400, detail=f"Error en BD: {str(e)}")

@router.post("/login")
def login(datos: LoginData):
    try:
        conn = get_db_connection()
        cursor = conn.cursor()
        cursor.execute("SELECT id, nombre, password_hash, id_rol, COALESCE(estado, 'activo') FROM usuarios WHERE email = %s", (datos.email,))
        usuario = cursor.fetchone()

        if not usuario or not verificar_password(datos.password, usuario[2]):
            cursor.close()
            conn.close()
            raise HTTPException(status_code=401, detail="Credenciales incorrectas")

        if usuario[4] == "inactivo":
            cursor.close()
            conn.close()
            raise HTTPException(status_code=403, detail="Tu cuenta está desactivada. Contacta al Administrador.")

        cursor.execute("UPDATE usuarios SET ultimo_acceso = NOW() WHERE id = %s", (usuario[0],))
        conn.commit()
        cursor.close()
        conn.close()

        token = jwt.encode({"user_id": usuario[0], "nombre": usuario[1], "id_rol": usuario[3]}, settings.SECRET_KEY, algorithm=settings.ALGORITHM)
        
        registrar_auditoria(usuario[0], "LOGIN", "autenticacion", "Inicio de sesión exitoso")
        return {"access_token": token, "token_type": "bearer", "id_rol": usuario[3], "nombre": usuario[1], "user_id": usuario[0]}
    except HTTPException as he:
        raise he
    except Exception as e:
        raise HTTPException(status_code=400, detail=f"Error en BD: {str(e)}")