import os
from fastapi import FastAPI, HTTPException, Depends, Header
from fastapi.middleware.cors import CORSMiddleware
from pydantic import BaseModel
from typing import List, Optional
from passlib.context import CryptContext
from jose import jwt
from database import get_db_connection
from groq import Groq

app = FastAPI(title="SmartCity Cloud API 🏙️")

app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

pwd_context = CryptContext(schemes=["pbkdf2_sha256"], deprecated="auto")
SECRET_KEY = "clave_secreta_smartcity_cloud_2026"
ALGORITHM = "HS256"

# ==========================================
# 📦 MODELOS PYDANTIC
# ==========================================
class LoginData(BaseModel):
    email: str
    password: str

class RegisterData(BaseModel):
    nombre: str
    email: str
    password: str
    # 🔐 Seguridad: Eliminamos id_rol del modelo de entrada pública

class LecturaSensorData(BaseModel):
    sensor_id: str
    temperatura: float
    humedad: float
    calidad_aire: float

class MessageHistory(BaseModel):
    role: str
    content: str

class ChatRequest(BaseModel):
    message: str
    history: Optional[List[MessageHistory]] = None

class ActualizarPerfilData(BaseModel):
    nombre: Optional[str] = None
    username: Optional[str] = None
    avatar: Optional[str] = None

class CambiarPasswordData(BaseModel):
    password_actual: str
    password_nueva: str

class ModificarUsuarioAdminData(BaseModel):
    id_rol: Optional[int] = None
    estado: Optional[str] = None  # "activo" o "inactivo"

# ==========================================
# 📋 UTILIDAD DE AUDITORÍA
# ==========================================
def registrar_auditoria(usuario_id: Optional[int], accion: str, modulo: str, descripcion: str, recurso_id: Optional[int] = None):
    """Guarda un registro de actividad en la tabla auditoria."""
    try:
        conn = get_db_connection()
        cursor = conn.cursor()
        cursor.execute(
            """
            INSERT INTO auditoria (usuario_id, accion, modulo, recurso_id, descripcion)
            VALUES (%s, %s, %s, %s, %s)
            """,
            (usuario_id, accion, modulo, recurso_id, descripcion)
        )
        conn.commit()
        cursor.close()
        conn.close()
    except Exception as e:
        print(f"⚠️ Error registrando auditoría: {e}")

# ==========================================
# 🔒 DEPENDENCIAS DE SEGURIDAD Y ROLES EN VIVO
# ==========================================
def obtener_usuario_actual(authorization: str = Header(...)):
    if not authorization.startswith("Bearer "):
        raise HTTPException(status_code=401, detail="Formato de token inválido")
    
    token = authorization.split(" ")[1]
    try:
        payload = jwt.decode(token, SECRET_KEY, algorithms=[ALGORITHM])
        return payload  # Retorna dict con user_id, nombre, id_rol
    except Exception:
        raise HTTPException(status_code=401, detail="Token expirado o inválido")

def requerir_admin(usuario: dict = Depends(obtener_usuario_actual)):
    """🔍 Consulta el rol EN VIVO en la BD para evitar depender del JWT antiguo."""
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

# ==========================================
# 🚀 AUTH & REGISTRO PÚBLICO SEGURO
# ==========================================
@app.get("/")
def inicio():
    return {"mensaje": "API de SmartCity Cloud activa y conectada a Supabase 🚀"}

@app.post("/registro")
def registrar_usuario(usuario: RegisterData):
    try:
        conn = get_db_connection()
        cursor = conn.cursor()
        hashed_password = pwd_context.hash(usuario.password)
        
        # 🔐 FORZAMOS id_rol = 2 (Usuario) para prevenir la creación pública de Admins
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

@app.post("/login")
def login(datos: LoginData):
    try:
        conn = get_db_connection()
        cursor = conn.cursor()
        cursor.execute("SELECT id, nombre, password_hash, id_rol, COALESCE(estado, 'activo') FROM usuarios WHERE email = %s", (datos.email,))
        usuario = cursor.fetchone()

        if not usuario or not pwd_context.verify(datos.password, usuario[2]):
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

        token = jwt.encode({"user_id": usuario[0], "nombre": usuario[1], "id_rol": usuario[3]}, SECRET_KEY, algorithm=ALGORITHM)
        
        registrar_auditoria(usuario[0], "LOGIN", "autenticacion", "Inicio de sesión exitoso")
        return {"access_token": token, "token_type": "bearer", "id_rol": usuario[3], "nombre": usuario[1]}
    except HTTPException as he:
        raise he
    except Exception as e:
        raise HTTPException(status_code=400, detail=f"Error en BD: {str(e)}")

# ==========================================
# 👤 FASE 1: PERFIL DE USUARIO DIVERSIFICADO
# ==========================================
@app.get("/api/perfil")
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

@app.put("/api/perfil/editar")
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

@app.put("/api/perfil/cambiar-password")
def cambiar_password(datos: CambiarPasswordData, usuario: dict = Depends(obtener_usuario_actual)):
    try:
        conn = get_db_connection()
        cursor = conn.cursor()
        cursor.execute("SELECT password_hash FROM usuarios WHERE id = %s", (usuario["user_id"],))
        pass_hash = cursor.fetchone()[0]

        if not pwd_context.verify(datos.password_actual, pass_hash):
            cursor.close()
            conn.close()
            raise HTTPException(status_code=400, detail="La contraseña actual es incorrecta")

        nuevo_hash = pwd_context.hash(datos.password_nueva)
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

# ==========================================
# 👑 GESTIÓN DE USUARIOS Y AUDITORÍA ADMIN
# ==========================================
@app.get("/api/admin/usuarios")
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

@app.put("/api/admin/usuarios/{usuario_id}")
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

@app.delete("/api/admin/usuarios/{usuario_id}")
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

@app.get("/api/admin/auditoria")
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

# ==========================================
# 📡 SENSORES Y CHAT
# ==========================================
@app.post("/sensores")
def registrar_lectura(lectura: LecturaSensorData):
    try:
        conn = get_db_connection()
        cursor = conn.cursor()
        cursor.execute(
            "INSERT INTO lecturas_sensores (sensor_id, temperatura, humedad, calidad_aire) VALUES (%s, %s, %s, %s)",
            (lectura.sensor_id, lectura.temperatura, lectura.humedad, lectura.calidad_aire)
        )
        conn.commit()
        cursor.close()
        conn.close()
        return {"mensaje": "Lectura de sensor almacenada correctamente en Supabase 📡"}
    except Exception as e:
        raise HTTPException(status_code=400, detail=f"Error en BD: {str(e)}")

@app.get("/sensores/ultimas")
def obtener_ultimas_lecturas():
    try:
        conn = get_db_connection()
        cursor = conn.cursor()
        cursor.execute(
            "SELECT id, sensor_id, temperatura, humedad, calidad_aire, fecha_hora FROM lecturas_sensores ORDER BY fecha_hora DESC LIMIT 10"
        )
        filas = cursor.fetchall()
        cursor.close()
        conn.close()
        return [
            {
                "id": f[0], "sensor_id": f[1], "temperatura": float(f[2]), 
                "humedad": float(f[3]), "calidad_aire": float(f[4]), "fecha_hora": str(f[5])
            } for f in filas
        ]
    except Exception as e:
        raise HTTPException(status_code=400, detail=f"Error en BD: {str(e)}")

def obtener_contexto_ciudad_supabase():
    try:
        conn = get_db_connection()
        cursor = conn.cursor()
        cursor.execute("SELECT sensor_id, temperatura, humedad, calidad_aire, fecha_hora FROM lecturas_sensores ORDER BY fecha_hora DESC LIMIT 1")
        ultima = cursor.fetchone()
        cursor.execute("SELECT ROUND(AVG(temperatura)::numeric, 2), MAX(temperatura), MIN(temperatura), ROUND(AVG(humedad)::numeric, 2), ROUND(AVG(calidad_aire)::numeric, 2), COUNT(*) FROM lecturas_sensores WHERE fecha_hora >= NOW() - INTERVAL '24 hours'")
        stats_24h = cursor.fetchone()
        cursor.execute("SELECT DISTINCT sensor_id FROM lecturas_sensores WHERE fecha_hora >= NOW() - INTERVAL '7 days'")
        sensores_activos = [s[0] for s in cursor.fetchall()]
        cursor.close()
        conn.close()

        contexto = "--- DATOS REALES EN TIEMPO REAL DESDE SUPABASE ---\n"
        if ultima:
            contexto += f"• Última medición ({ultima[4]}): Sensor {ultima[0]}, Temp: {ultima[1]} °C, Hum: {ultima[2]} %, Calidad Aire: {ultima[3]} ICA\n"
        else:
            contexto += "• No hay mediciones recientes.\n"

        if stats_24h and stats_24h[5] > 0:
            contexto += f"• Promedio 24h ({stats_24h[5]} muestras): Max {stats_24h[1]}°C, Min {stats_24h[2]}°C, Prom {stats_24h[0]}°C, Hum Prom {stats_24h[3]}%, Aire Prom {stats_24h[4]} ICA\n"
        
        contexto += f"• Sensores Activos: {', '.join(sensores_activos) if sensores_activos else 'Ninguno'}\n"
        return contexto
    except Exception as e:
        return f"[Aviso: No se pudieron extraer datos de Supabase: {str(e)}]"

@app.post("/api/ia/chat")
def chat_brunito_ai(req: ChatRequest):
    groq_api_key = os.environ.get("GROQ_API_KEY", "")
    if not groq_api_key:
        raise HTTPException(status_code=500, detail="GROQ_API_KEY no configurada.")

    try:
        client = Groq(api_key=groq_api_key)
        datos_supabase = obtener_contexto_ciudad_supabase()

        system_instruction = (
            "Eres Brunito AI, asistente virtual de SmartCity Cloud.\n"
            "Responde en español de forma breve, amable y profesional usando los datos reales de la base de datos cuando pregunten por los sensores.\n\n"
            f"DATOS ACTUALES:\n{datos_supabase}"
        )

        messages = [{"role": "system", "content": system_instruction}]
        for msg in (req.history or []):
            role_mapped = "assistant" if msg.role in ["model", "assistant"] else "user"
            messages.append({"role": role_mapped, "content": msg.content})

        messages.append({"role": "user", "content": req.message})

        completion = client.chat.completions.create(
            model="openai/gpt-oss-20b",
            messages=messages,
            temperature=0.7,
            max_tokens=500
        )

        return {"respuesta": completion.choices[0].message.content}
    except Exception as e:
        raise HTTPException(status_code=500, detail=f"Error en Brunito AI: {str(e)}")