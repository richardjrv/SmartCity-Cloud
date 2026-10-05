from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware
from app.core.config import settings
from app.routers import auth, perfil, admin, sensores, ia

app = FastAPI(
    title=settings.PROJECT_NAME,
    version=settings.VERSION
)

# Configuración de CORS
app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

# Inclusión de Routers Modulares
app.include_router(auth.router)
app.include_router(perfil.router)
app.include_router(admin.router)
app.include_router(sensores.router)
app.include_router(ia.router)

@app.get("/")
def inicio():
    return {
        "mensaje": "API de SmartCity Cloud activa y conectada a Supabase 🚀",
        "version": settings.VERSION
    }