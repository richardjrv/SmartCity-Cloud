import os

class Settings:
    PROJECT_NAME: str = "SmartCity Cloud API 🏙️"
    VERSION: str = "2.0.0"
    
    # Claves de Seguridad JWT
    SECRET_KEY: str = os.environ.get("SECRET_KEY", "clave_secreta_smartcity_cloud_2026")
    # Supabase Auth: usa la clave publishable/anon aquí; nunca pongas la secret/service_role en el frontend.
    SUPABASE_URL: str = os.environ.get("SUPABASE_URL", "").rstrip("/")
    SUPABASE_ANON_KEY: str = os.environ.get("SUPABASE_ANON_KEY", "")
    SUPABASE_SERVICE_ROLE_KEY: str = os.environ.get("SUPABASE_SERVICE_ROLE_KEY", "")
    FRONTEND_URL: str = os.environ.get("FRONTEND_URL", "")
    # Clave separada para firmar propuestas de actuador. Si no se configura,
    # mantiene compatibilidad con instalaciones existentes usando SECRET_KEY.
    BRUNITO_ACTION_SECRET: str = os.environ.get("BRUNITO_ACTION_SECRET", "")
    ALGORITHM: str = "HS256"
    
    # Claves de APIs Externas
    GEMINI_API_KEY: str = os.environ.get("GEMINI_API_KEY", "")
    GEMINI_MODEL: str = os.environ.get("GEMINI_MODEL", "gemini-3.8-flash")

    # Lista separada por comas de orígenes frontend permitidos por CORS.
    # En local se aceptan Live Server y localhost; producción debe definir FRONTEND_ORIGINS.
    FRONTEND_ORIGINS: list[str] = [
        origin.strip().rstrip("/")
        for origin in os.environ.get(
            "FRONTEND_ORIGINS",
            "http://127.0.0.1:5500,http://localhost:5500,http://127.0.0.1:3000,http://localhost:3000",
        ).split(",")
        if origin.strip()
    ]

settings = Settings()
