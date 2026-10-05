from fastapi import Depends, HTTPException, Header
from passlib.context import CryptContext
from jose import jwt
from app.core.config import settings
from app.db.database import get_db_connection

pwd_context = CryptContext(schemes=["pbkdf2_sha256"], deprecated="auto")

def verificar_password(plain_password: str, hashed_password: str) -> bool:
    """Verifica si una contraseña en texto plano coincide con su hash."""
    return pwd_context.verify(plain_password, hashed_password)

def generar_hash_password(password: str) -> str:
    """Genera el hash pbkdf2_sha256 de una contraseña."""
    return pwd_context.hash(password)

def obtener_usuario_actual(authorization: str = Header(...)) -> dict:
    """Valida el token JWT enviado en el encabezado Authorization."""
    if not authorization.startswith("Bearer "):
        raise HTTPException(status_code=401, detail="Formato de token inválido")
    
    token = authorization.split(" ")[1]
    try:
        payload = jwt.decode(token, settings.SECRET_KEY, algorithms=[settings.ALGORITHM])
        return payload  # Contiene user_id, nombre, id_rol
    except Exception:
        raise HTTPException(status_code=401, detail="Token expirado o inválido")

def requerir_admin(usuario: dict = Depends(obtener_usuario_actual)) -> dict:
    """🔍 Consulta el rol y estado EN VIVO en Supabase para evitar vulnerabilidades de JWT obsoleto."""
    try:
        conn = get_db_connection()
        cursor = conn.cursor()
        cursor.execute("SELECT id_rol, COALESCE(estado, 'activo') FROM usuarios WHERE id = %s", (usuario["user_id"],))
        data = cursor.fetchone()
        cursor.close()
        conn.close()

        if not data or data[1] != "activo":
            raise HTTPException(status_code=403, detail="Cuenta inactiva o inexistente.")
        
        if data[0] != 1:  # 1 = Administrador
            raise HTTPException(status_code=403, detail="Acceso denegado: Se requieren permisos de Administrador.")

        return usuario
    except HTTPException as he:
        raise he
    except Exception as e:
        raise HTTPException(status_code=500, detail=f"Error verificando permisos: {str(e)}")