import os

class Settings:
    PROJECT_NAME: str = "SmartCity Cloud API 🏙️"
    VERSION: str = "2.0.0"
    
    # Claves de Seguridad JWT
    SECRET_KEY: str = os.environ.get("SECRET_KEY", "clave_secreta_smartcity_cloud_2026")
    # Clave separada para firmar propuestas de actuador. Si no se configura,
    # mantiene compatibilidad con instalaciones existentes usando SECRET_KEY.
    BRUNITO_ACTION_SECRET: str = os.environ.get("BRUNITO_ACTION_SECRET", "")
    # Mantén esta clave estable: se usa como pepper adicional para el hash de PIN.
    PIN_PEPPER: str = os.environ.get("PIN_PEPPER", "")
    ALGORITHM: str = "HS256"
    
    # Claves de APIs Externas
    GROQ_API_KEY: str = os.environ.get("GROQ_API_KEY", "")

settings = Settings()
