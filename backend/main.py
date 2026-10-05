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
    id_rol: int = 2  # 1: Administrador, 2: Usuario por defecto

class LecturaSensorData(BaseModel):
    sensor_id: str
    temperatura: float
    humedad: float
    calidad_aire: float

class MessageHistory(BaseModel):
    role: str  # "user" o "assistant"
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
# 🔒 DEPENDENCIAS DE SEGURIDAD Y ROLES (FASE 2)
# ==========================================
def obtener_usuario_actual(authorization: str = Header(...)):
    """Valida el token JWT enviado en la cabecera Authorization."""
    if not authorization.startswith("Bearer "):
        raise HTTPException(status_code=401, detail="Formato de token inválido")
    
    token = authorization.split(" ")[1]
    try:
        payload = jwt.decode(token, SECRET_KEY, algorithms=[ALGORITHM])
        return payload  # Retorna diccionario con user_id, nombre, id_rol
    except Exception:
        raise HTTPException(status_code=401, detail="Token expirado o inválido")

def requerir_admin(usuario: dict = Depends(obtener_usuario_actual)):
    """Verifica si el usuario autenticado tiene rol de Administrador (id_rol == 1)."""
    if usuario.get("id_rol") != 1:
        raise HTTPException(
            status_code=403, 
            detail="Acceso denegado: Se requieren permisos de Administrador."
        )
    return usuario

# ==========================================
# 🚀 ENDPOINTS PÚBLICOS Y AUTENTICACIÓN
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
        cursor.execute(
            "INSERT INTO usuarios (nombre, email, password_hash, id_rol) VALUES (%s, %s, %s, %s)",
            (usuario.nombre, usuario.email, hashed_password, usuario.id_rol)
        )
        conn.commit()
        cursor.close()
        conn.close()
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

        # Actualizar fecha de último acceso
        cursor.execute("UPDATE usuarios SET ultimo_acceso = NOW() WHERE id = %s", (usuario[0],))
        conn.commit()
        cursor.close()
        conn.close()

        token = jwt.encode({"user_id": usuario[0], "nombre": usuario[1], "id_rol": usuario[3]}, SECRET_KEY, algorithm=ALGORITHM)

        return {"access_token": token, "token_type": "bearer", "id_rol": usuario[3], "nombre": usuario[1]}
    except HTTPException as he:
        raise he
    except Exception as e:
        raise HTTPException(status_code=400, detail=f"Error en BD: {str(e)}")

# ==========================================
# 👤 FASE 1: MI PERFIL (USUARIOS Y ADMINS)
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
        return {"mensaje": "Perfil actualizado correctamente ✅"}
    except Exception as e:
        raise HTTPException(status_code=400, detail=f"Error al actualizar perfil: {str(e)}")

@app.put("/api/perfil/cambiar-password")
def cambiar_password(datos: CambiarPasswordData, usuario: dict = Depends(obtener_usuario_actual)):
    try:
        conn = get_db_connection()
        cursor = conn.cursor()
        cursor.execute("SELECT password_hash FROM usuarios WHERE id = %s", (usuario["user_id"],))
        pass_actual_hash = cursor.fetchone()[0]

        if not pwd_context.verify(datos.password_actual, pass_actual_hash):
            cursor.close()
            conn.close()
            raise HTTPException(status_code=400, detail="La contraseña actual es incorrecta")

        nuevo_hash = pwd_context.hash(datos.password_nueva)
        cursor.execute("UPDATE usuarios SET password_hash = %s WHERE id = %s", (nuevo_hash, usuario["user_id"]))
        conn.commit()
        cursor.close()
        conn.close()

        return {"mensaje": "Contraseña actualizada exitosamente 🔒"}
    except HTTPException as he:
        raise he
    except Exception as e:
        raise HTTPException(status_code=400, detail=f"Error al cambiar contraseña: {str(e)}")

# ==========================================
# 👑 FASE 3: GESTIÓN DE USUARIOS (SOLO ADMINISTRADOR)
# ==========================================
@app.get("/api/admin/usuarios")
def listar_usuarios_admin(admin: dict = Depends(requerir_admin)):
    """Obtiene la lista completa de usuarios para la tabla de administración."""
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
    """Permite al Admin cambiar el rol o activar/desactivar un usuario."""
    try:
        conn = get_db_connection()
        cursor = conn.cursor()

        if datos.id_rol is not None:
            cursor.execute("UPDATE usuarios SET id_rol = %s WHERE id = %s", (datos.id_rol, usuario_id))
        if datos.estado is not None:
            cursor.execute("UPDATE usuarios SET estado = %s WHERE id = %s", (datos.estado, usuario_id))

        conn.commit()
        cursor.close()
        conn.close()
        return {"mensaje": f"Usuario #{usuario_id} actualizado por el Administrador ✅"}
    except Exception as e:
        raise HTTPException(status_code=400, detail=f"Error modificando usuario: {str(e)}")

@app.delete("/api/admin/usuarios/{usuario_id}")
def eliminar_usuario_admin(usuario_id: int, admin: dict = Depends(requerir_admin)):
    """Permite al Administrador eliminar un usuario del sistema."""
    if usuario_id == admin["user_id"]:
        raise HTTPException(status_code=400, detail="No puedes eliminar tu propia cuenta de Administrador.")

    try:
        conn = get_db_connection()
        cursor = conn.cursor()
        cursor.execute("DELETE FROM usuarios WHERE id = %s", (usuario_id,))
        conn.commit()
        cursor.close()
        conn.close()
        return {"mensaje": f"Usuario #{usuario_id} eliminado del sistema 🗑️"}
    except Exception as e:
        raise HTTPException(status_code=400, detail=f"Error eliminando usuario: {str(e)}")

# ==========================================
# 📡 ENDPOINTS DE SENSORES
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

# ==========================================
# 🤖 ENDPOINT INTELIGENTE: BRUNITO AI (GROQ + SUPABASE)
# ==========================================
def obtener_contexto_ciudad_supabase():
    try:
        conn = get_db_connection()
        cursor = conn.cursor()

        cursor.execute("""
            SELECT sensor_id, temperatura, humedad, calidad_aire, fecha_hora 
            FROM lecturas_sensores ORDER BY fecha_hora DESC LIMIT 1
        """)
        ultima = cursor.fetchone()

        cursor.execute("""
            SELECT 
                ROUND(AVG(temperatura)::numeric, 2) AS temp_prom,
                MAX(temperatura) AS temp_max,
                MIN(temperatura) AS temp_min,
                ROUND(AVG(humedad)::numeric, 2) AS hum_prom,
                ROUND(AVG(calidad_aire)::numeric, 2) AS aire_prom,
                COUNT(*) AS total_lecturas
            FROM lecturas_sensores 
            WHERE fecha_hora >= NOW() - INTERVAL '24 hours'
        """)
        stats_24h = cursor.fetchone()

        cursor.execute("SELECT DISTINCT sensor_id FROM lecturas_sensores WHERE fecha_hora >= NOW() - INTERVAL '7 days'")
        sensores_activos = [s[0] for s in cursor.fetchall()]

        cursor.close()
        conn.close()

        contexto = "--- DATOS REALES EN TIEMPO REAL DESDE SUPABASE ---\n"
        if ultima:
            contexto += (
                f"• Última medición registrada ({ultima[4]}):\n"
                f"  - Sensor Origen: {ultima[0]}\n"
                f"  - Temperatura Actual: {ultima[1]} °C\n"
                f"  - Humedad Relativa: {ultima[2]} %\n"
                f"  - Calidad del Aire (ICA): {ultima[3]} (Índice de Calidad)\n"
            )
        else:
            contexto += "• No hay mediciones recientes registradas.\n"

        if stats_24h and stats_24h[5] > 0:
            contexto += (
                f"• Resumen Estadístico Últimas 24 Horas ({stats_24h[5]} muestras):\n"
                f"  - Temperatura Máxima: {stats_24h[1]} °C\n"
                f"  - Temperatura Mínima: {stats_24h[2]} °C\n"
                f"  - Temperatura Promedio: {stats_24h[0]} °C\n"
                f"  - Humedad Promedio: {stats_24h[3]} %\n"
                f"  - Calidad del Aire Promedio: {stats_24h[4]} ICA\n"
            )
        
        contexto += f"• Nodos/Sensores Activos en el Sistema: {', '.join(sensores_activos) if sensores_activos else 'Ninguno'}\n"
        contexto += "--------------------------------------------------\n"

        return contexto
    except Exception as e:
        return f"[Aviso: No se pudieron extraer los datos en vivo de Supabase debido a: {str(e)}]"

@app.post("/api/ia/chat")
def chat_brunito_ai(req: ChatRequest):
    groq_api_key = os.environ.get("GROQ_API_KEY", "")

    if not groq_api_key:
        raise HTTPException(
            status_code=500,
            detail="La variable de entorno GROQ_API_KEY no está configurada en el servidor."
        )

    try:
        client = Groq(api_key=groq_api_key)
        datos_supabase = obtener_contexto_ciudad_supabase()

        system_instruction = (
            "Eres Brunito AI, el asistente virtual e inteligente "
            "de la plataforma SmartCity Cloud.\n\n"
            "Tu función es conversar con el usuario y responder "
            "preguntas sobre ciudades inteligentes, tecnología, IoT "
            "y los datos de sensores de SmartCity.\n\n"
            "INSTRUCCIONES:\n"
            "1. Si el usuario saluda, responde amablemente.\n"
            "2. Usa los datos reales de Supabase cuando el usuario "
            "pregunte por sensores, temperatura, humedad o calidad del aire.\n"
            "3. Nunca inventes valores de sensores.\n"
            "4. Si no existen datos, dilo claramente.\n"
            "5. Responde en español.\n"
            "6. Sé breve, claro y amigable.\n\n"
            f"DATOS ACTUALES DE SUPABASE:\n{datos_supabase}"
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

        respuesta_texto = completion.choices[0].message.content
        return {"respuesta": respuesta_texto}

    except Exception as e:
        print(f"❌ Error en Brunito AI (Groq): {e}")
        raise HTTPException(status_code=500, detail=f"Error procesando la solicitud con Groq: {str(e)}")