from fastapi import APIRouter, Depends
from pydantic import BaseModel, Field

from app.core.security import obtener_usuario_actual, requerir_gestor_alertas
from app.services import novedades

router = APIRouter(prefix="/novedades", tags=["Novedades"])


class NuevaNovedad(BaseModel):
    titulo: str = Field(min_length=1, max_length=120)
    imagen_base64: str = Field(min_length=1, max_length=4 * 1024 * 1024 + 8)


@router.get("")
def obtener_novedades(usuario: dict = Depends(obtener_usuario_actual)):
    return novedades.listar_novedades()


@router.post("", status_code=201)
def publicar_novedad(datos: NuevaNovedad, usuario: dict = Depends(requerir_gestor_alertas)):
    return novedades.crear_novedad(datos.titulo, datos.imagen_base64, usuario["user_id"])
