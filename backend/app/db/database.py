import os
import psycopg2

def get_db_connection():
    """Establece y retorna una conexión a la base de datos de Supabase."""
    db_url = os.environ.get("postgresql://postgres.lqkobrabircleaprkroz:_Richh77%402007@aws-0-us-east-2.pooler.supabase.com:6543/postgres")
    if not db_url:
        raise Exception("La variable de entorno DATABASE_URL no está configurada.")
    
    conn = psycopg2.connect(db_url)
    return conn