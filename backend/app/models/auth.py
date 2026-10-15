from pydantic import BaseModel, EmailStr, Field


class LoginData(BaseModel):
    email: EmailStr
    password: str = Field(min_length=1, max_length=128)


class RegisterData(BaseModel):
    nombre: str = Field(min_length=1, max_length=120)
    email: EmailStr
    password: str = Field(min_length=8, max_length=128)


class RefreshData(BaseModel):
    refresh_token: str = Field(min_length=20, max_length=4096)


class CambiarPasswordData(BaseModel):
    password_actual: str = Field(min_length=1, max_length=128)
    password_nueva: str = Field(min_length=8, max_length=128)


class RecuperarPasswordData(BaseModel):
    email: EmailStr


class EstablecerPasswordData(BaseModel):
    access_token: str = Field(min_length=20, max_length=8192)
    password_nueva: str = Field(min_length=8, max_length=128)


class ModificarUsuarioAdminData(BaseModel):
    id_rol: int | None = None
    estado: str | None = None


class ActualizarPerfilData(BaseModel):
    nombre: str | None = Field(default=None, min_length=1, max_length=120)
    username: str | None = Field(default=None, min_length=1, max_length=60)
    avatar: str | None = Field(default=None, max_length=2048)
