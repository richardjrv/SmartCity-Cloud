import os

class Settings:
    PROJECT_NAME: str = "SmartCity Cloud API 🏙️"
    VERSION: str = "2.0.0"
    
    # Claves de Seguridad JWT
    SECRET_KEY: str = os.environ.get("SECRET_KEY", "clave_secreta_smartcity_cloud_2026")
    ALGORITHM: str = "HS256"
    
    # Claves de APIs Externas
    GROQ_API_KEY: str = os.environ.get("GROQ_API_KEY", "")

settings = Settings()