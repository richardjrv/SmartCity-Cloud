import re
from typing import Optional

from pydantic import BaseModel, Field, validator


class LoginData(BaseModel):
    email: str
    password: str


class PinChallengeData(BaseModel):
    challenge_token: str = Field(min_length=20, max_length=4096)
    pin: str = Field(min_length=4, max_length=4)

    @validator("pin")
    def pin_debe_ser_numerico(cls, value):
        if not re.fullmatch(r"[0-9]{4}", value):
            raise ValueError("El PIN debe tener exactamente cuatro números.")
        return value


class RegisterData(BaseModel):
    nombre: str
    email: str
    password: str
    pin: str = Field(min_length=4, max_length=4)

    @validator("pin")
    def pin_debe_ser_numerico(cls, value):
        if not re.fullmatch(r"[0-9]{4}", value):
            raise ValueError("El PIN debe tener exactamente cuatro números.")
        return value
    # id_rol se excluye para impedir crear administradores desde el registro público.


class ActualizarPerfilData(BaseModel):
    nombre: Optional[str] = None
    username: Optional[str] = None
    avatar: Optional[str] = None


class CambiarPasswordData(BaseModel):
    password_actual: str
    password_nueva: str


class ModificarUsuarioAdminData(BaseModel):
    id_rol: Optional[int] = None
    estado: Optional[str] = None
