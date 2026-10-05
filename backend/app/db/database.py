import os
import psycopg2

def get_db_connection():
    """Establece y retorna una conexión a la base de datos de Supabase."""
    db_url = os.environ.get("DATABASE_URL")
    if not db_url:
        raise Exception("La variable de entorno DATABASE_URL no está configurada.")
    
    conn = psycopg2.connect(db_url)
    return conn