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
    role: str  # "user" o "assistant" (o "model")
    content: str

class ChatRequest(BaseModel):
    message: str
    history: Optional[List[MessageHistory]] = None  # Evita lista mutable en valor por defecto

# ==========================================
# 🔒 DEPENDENCIAS DE SEGURIDAD Y ROLES (FASE 5)
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
# 📋 UTILIDAD DE AUDITORÍA (FASE 4)
# ==========================================
def registrar_auditoria(usuario_id: Optional[int], accion: str, modulo: str, descripcion: str, recurso_id: Optional[int] = None):
    """Guarda un registro de actividad importante en la base de datos."""
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
            "INSERT INTO usuarios (nombre, email, password_hash, id_rol) VALUES (%s, %s, %s, %s) RETURNING id",
            (usuario.nombre, usuario.email, hashed_password, usuario.id_rol)
        )
        nuevo_id = cursor.fetchone()[0]
        conn.commit()
        cursor.close()
        conn.close()

        # Registro en auditoría
        registrar_auditoria(
            usuario_id=nuevo_id, 
            accion="REGISTER", 
            modulo="usuarios", 
            descripcion=f"Nuevo usuario registrado: {usuario.email}"
        )

        return {"mensaje": "Usuario registrado exitosamente en Supabase ✅"}
    except Exception as e:
        raise HTTPException(status_code=400, detail=f"Error en BD: {str(e)}")

@app.post("/login")
def login(datos: LoginData):
    try:
        conn = get_db_connection()
        cursor = conn.cursor()
        cursor.execute("SELECT id, nombre, password_hash, id_rol FROM usuarios WHERE email = %s", (datos.email,))
        usuario = cursor.fetchone()

        if not usuario or not pwd_context.verify(datos.password, usuario[2]):
            cursor.close()
            conn.close()
            raise HTTPException(status_code=401, detail="Credenciales incorrectas")

        # Actualizar fecha de último acceso
        cursor.execute("UPDATE usuarios SET ultimo_acceso = NOW() WHERE id = %s", (usuario[0],))
        conn.commit()
        cursor.close()
        conn.close()

        token = jwt.encode({"user_id": usuario[0], "nombre": usuario[1], "id_rol": usuario[3]}, SECRET_KEY, algorithm=ALGORITHM)

        # Registro en auditoría
        registrar_auditoria(
            usuario_id=usuario[0], 
            accion="LOGIN", 
            modulo="autenticacion", 
            descripcion="Inicio de sesión exitoso"
        )

        return {"access_token": token, "token_type": "bearer", "id_rol": usuario[3], "nombre": usuario[1]}
    except HTTPException as he:
        raise he
    except Exception as e:
        raise HTTPException(status_code=400, detail=f"Error en BD: {str(e)}")

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
# 👤 FASE 1: PERFIL DE USUARIO
# ==========================================
@app.get("/api/perfil")
def obtener_perfil(usuario: dict = Depends(obtener_usuario_actual)):
    try:
        conn = get_db_connection()
        cursor = conn.cursor()
        cursor.execute(
            """
            SELECT id, nombre, email, username, id_rol, estado, avatar, fecha_registro, ultimo_acceso 
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
            "estado": data[5] or "activo",
            "avatar": data[6] or "",
            "fecha_registro": str(data[7]),
            "ultimo_acceso": str(data[8])
        }
    except Exception as e:
        raise HTTPException(status_code=400, detail=f"Error al obtener perfil: {str(e)}")

# ==========================================
# 👥 FASE 3 Y 4: ADMINISTRACIÓN Y AUDITORÍA
# ==========================================
@app.get("/api/admin/usuarios")
def listar_usuarios(admin: dict = Depends(requerir_admin)):
    """Lista todos los usuarios del sistema (solo visible para Administradores)."""
    try:
        conn = get_db_connection()
        cursor = conn.cursor()
        cursor.execute(
            """
            SELECT id, nombre, email, username, id_rol, COALESCE(estado, 'activo'), ultimo_acceso 
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
                "ultimo_acceso": str(f[6])
            } for f in filas
        ]
    except Exception as e:
        raise HTTPException(status_code=400, detail=f"Error al listar usuarios: {str(e)}")

@app.get("/api/admin/auditoria")
def obtener_auditoria(admin: dict = Depends(requerir_admin)):
    """Muestra el historial de auditoría de actividades del sistema."""
    try:
        conn = get_db_connection()
        cursor = conn.cursor()
        cursor.execute(
            """
            SELECT a.id, COALESCE(u.nombre, 'Sistema') AS usuario, a.accion, a.modulo, a.recurso_id, a.descripcion, a.fecha 
            FROM auditoria a
            LEFT JOIN usuarios u ON a.usuario_id = u.id
            ORDER BY a.fecha DESC LIMIT 50
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
        raise HTTPException(status_code=400, detail=f"Error al consultar auditoría: {str(e)}")

# ==========================================
# 🤖 ENDPOINT INTELIGENTE: BRUNITO AI (GROQ + SUPABASE)
# ==========================================
def obtener_contexto_ciudad_supabase():
    """Consulta los datos en tiempo real y métricas históricas de Supabase para alimentar al LLM."""
    try:
        conn = get_db_connection()
        cursor = conn.cursor()

        # 1. Última lectura registrada
        cursor.execute("""
            SELECT sensor_id, temperatura, humedad, calidad_aire, fecha_hora 
            FROM lecturas_sensores ORDER BY fecha_hora DESC LIMIT 1
        """)
        ultima = cursor.fetchone()

        # 2. Resumen de las últimas 24 horas
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

        # 3. Sensores activos únicos
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

        # Obtener datos reales desde Supabase
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

            f"DATOS ACTUALES DE SUPABASE:\n"
            f"{datos_supabase}"
        )

        messages = [
            {
                "role": "system",
                "content": system_instruction
            }
        ]

        # Mantener historial del chat sin usar listas mutables
        for msg in (req.history or []):
            role_mapped = (
                "assistant"
                if msg.role in ["model", "assistant"]
                else "user"
            )

            messages.append({
                "role": role_mapped,
                "content": msg.content
            })

        # Mensaje actual
        messages.append({
            "role": "user",
            "content": req.message
        })

        # 🤖 Modelo activo de Groq
        completion = client.chat.completions.create(
            model="openai/gpt-oss-20b",
            messages=messages,
            temperature=0.7,
            max_tokens=500
        )

        respuesta_texto = completion.choices[0].message.content

        return {
            "respuesta": respuesta_texto
        }

    except Exception as e:
        print(f"❌ Error en Brunito AI (Groq): {e}")

        raise HTTPException(
            status_code=500,
            detail=f"Error procesando la solicitud con Groq: {str(e)}"
        )