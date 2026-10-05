from pydantic import BaseModel
from typing import Optional

class LoginData(BaseModel):
    email: str
    password: str

class RegisterData(BaseModel):
    nombre: str
    email: str
    password: str
    # 🔐 Seguridad: id_rol excluido para evitar escalada de privilegios en el registro público

class ActualizarPerfilData(BaseModel):
    nombre: Optional[str] = None
    username: Optional[str] = None
    avatar: Optional[str] = None

class CambiarPasswordData(BaseModel):
    password_actual: str
    password_nueva: str

class ModificarUsuarioAdminData(BaseModel):
    id_rol: Optional[int] = None
    estado: Optional[str] = None  # "activo" o "inactivo"