import psycopg2

# Opción A: Conexión mediante el Pooler de Supabase (Puerto 6543 en us-east-2)
DATABASE_URL = "postgresql://postgres.lqkobrabircleaprkroz:_Richh77%402007@aws-0-us-east-2.pooler.supabase.com:6543/postgres"

def get_db_connection():
    """Establece la conexión con la base de datos PostgreSQL en Supabase."""
    return psycopg2.connect(
        DATABASE_URL,
        connect_timeout=10,
        sslmode="require"
    )