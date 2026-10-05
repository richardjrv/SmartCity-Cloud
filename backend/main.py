from fastapi import FastAPI, HTTPException
from fastapi.middleware.cors import CORSMiddleware
from pydantic import BaseModel
from passlib.context import CryptContext
from jose import jwt
from database import get_db_connection

app = FastAPI(title="SmartCity Cloud API 🏙️")

# Habilitar CORS para permitir solicitudes desde el Frontend
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

# Modelos de datos de entrada
class LoginData(BaseModel):
    email: str
    password: str

class RegisterData(BaseModel):
    nombre: str
    email: str
    password: str
    id_rol: int = 2  # Por defecto: 2 (Usuario)

class LecturaSensorData(BaseModel):
    sensor_id: str
    temperatura: float
    humedad: float
    calidad_aire: float

@app.get("/")
def inicio():
    return {"mensaje": "API de SmartCity Cloud activa y conectada a Supabase 🚀"}

# --- ENDPOINT: REGISTRO DE USUARIOS ---
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
        print(f"❌ Error en Supabase / Registro: {e}")
        raise HTTPException(status_code=400, detail=f"Error en BD: {str(e)}")

# --- ENDPOINT: LOGIN DE USUARIOS ---
@app.post("/login")
def login(datos: LoginData):
    try:
        conn = get_db_connection()
        cursor = conn.cursor()
        
        cursor.execute(
            "SELECT id, nombre, password_hash, id_rol FROM usuarios WHERE email = %s", 
            (datos.email,)
        )
        usuario = cursor.fetchone()
        cursor.close()
        conn.close()

        if not usuario:
            raise HTTPException(status_code=401, detail="Credenciales incorrectas")

        user_id, nombre, password_hash, id_rol = usuario

        if not pwd_context.verify(datos.password, password_hash):
            raise HTTPException(status_code=401, detail="Credenciales incorrectas")

        token_payload = {
            "user_id": user_id,
            "nombre": nombre,
            "id_rol": id_rol
        }
        token = jwt.encode(token_payload, SECRET_KEY, algorithm=ALGORITHM)

        return {
            "access_token": token,
            "token_type": "bearer",
            "id_rol": id_rol,
            "nombre": nombre
        }
    except Exception as e:
        print(f"❌ Error en Supabase / Login: {e}")
        raise HTTPException(status_code=400, detail=f"Error en BD: {str(e)}")

# --- ENDPOINT: REGISTRAR LECTURA DE SENSOR (IoT ESP32) ---
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
        print(f"❌ Error al guardar lectura: {e}")
        raise HTTPException(status_code=400, detail=f"Error en BD: {str(e)}")

# --- ENDPOINT: OBTENER ÚLTIMAS LECTURAS DE SENSORES ---
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

        lecturas = []
        for fila in filas:
            lecturas.append({
                "id": fila[0],
                "sensor_id": fila[1],
                "temperatura": float(fila[2]),
                "humedad": float(fila[3]),
                "calidad_aire": float(fila[4]),
                "fecha_hora": str(fila[5])
            })

        return lecturas
    except Exception as e:
        print(f"❌ Error al consultar lecturas: {e}")
        raise HTTPException(status_code=400, detail=f"Error en BD: {str(e)}")