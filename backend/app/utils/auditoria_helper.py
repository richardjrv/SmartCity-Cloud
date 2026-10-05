from typing import Optional
from app.db.database import get_db_connection

def registrar_auditoria(usuario_id: Optional[int], accion: str, modulo: str, descripcion: str, recurso_id: Optional[int] = None):
    """Guarda un evento de actividad importante en la base de datos."""
    try:
        conn = get_db_connection()
        cursor = conn.cursor()
        cursor.execute(
            """
            INSERT INTO auditoria (usuario_id, accion, modulo, recurso_id, descripcion)
            VALUES (%s, %s, %s, %s, %s)
            """,
            (usuario_id, accion, modulo, recurso_id, descripcion)
        )
        conn.commit()
        cursor.close()
        conn.close()
    except Exception as e:
        print(f"⚠️ Error registrando auditoría: {e}")