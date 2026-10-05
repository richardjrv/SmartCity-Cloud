import os
from fastapi import APIRouter, HTTPException
from groq import Groq
from app.core.config import settings
from app.db.database import get_db_connection
from app.models.ia import ChatRequest

router = APIRouter(prefix="/api/ia", tags=["Inteligencia Artificial"])

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

@router.post("/chat")
def chat_brunito_ai(req: ChatRequest):
    groq_api_key = settings.GROQ_API_KEY or os.environ.get("GROQ_API_KEY", "")
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