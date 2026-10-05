import os
from fastapi import FastAPI, HTTPException
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

# Modelos Pydantic
class LoginData(BaseModel):
    email: str
    password: str

class RegisterData(BaseModel):
    nombre: str
    email: str
    password: str
    id_rol: int = 2

class LecturaSensorData(BaseModel):
    sensor_id: str
    temperatura: float
    humedad: float
    calidad_aire: float

class MessageHistory(BaseModel):
    role: str # "user" o "assistant" (o "model")
    content: str

class ChatRequest(BaseModel):
    message: str
    history: Optional[List[MessageHistory]] = None

@app.get("/")
def inicio():
    return {"mensaje": "API de SmartCity Cloud activa y conectada a Supabase 🚀"}

# --- ENDPOINTS EXISTENTES ---
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
        cursor.execute("SELECT id, nombre, password_hash, id_rol FROM usuarios WHERE email = %s", (datos.email,))
        usuario = cursor.fetchone()
        cursor.close()
        conn.close()

        if not usuario or not pwd_context.verify(datos.password, usuario[2]):
            raise HTTPException(status_code=401, detail="Credenciales incorrectas")

        token = jwt.encode({"user_id": usuario[0], "nombre": usuario[1], "id_rol": usuario[3]}, SECRET_KEY, algorithm=ALGORITHM)
        return {"access_token": token, "token_type": "bearer", "id_rol": usuario[3], "nombre": usuario[1]}
    except Exception as e:
        raise HTTPException(status_code=400, detail=f"Error en BD: {str(e)}")

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

        # Mantener historial del chat
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

        # 🤖 Modelo actual de Groq
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