from typing import Optional
from app.db.database import get_db_connection

def registrar_auditoria(id_usuario: Optional[int], accion: str, modulo: str, descripcion: str, id_recurso: Optional[int] = None):
    """Guarda un evento de actividad importante en la base de datos."""
    try:
        conn = get_db_connection()
        cursor = conn.cursor()
        cursor.execute(
            """
            INSERT INTO auditoria (id_usuario, accion, modulo, id_recurso, descripcion)
            VALUES (%s, %s, %s, %s, %s)
            """,
            (id_usuario, accion, modulo, id_recurso, descripcion)
        )
        conn.commit()
        cursor.close()
        conn.close()
    except Exception as e:
        print(f"⚠️ Error registrando auditoría: {e}")
