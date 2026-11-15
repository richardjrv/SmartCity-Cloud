from typing import Literal
from datetime import date

from fastapi import APIRouter, Depends, HTTPException, Path
from pydantic import BaseModel, Field

from app.core.security import obtener_usuario_actual, requerir_gestor_alertas
from app.services import novedades

router = APIRouter(prefix="/novedades", tags=["Novedades"])


class NuevaNovedad(BaseModel):
    titulo: str = Field(min_length=1, max_length=120)
    imagen_base64: str = Field(min_length=1, max_length=4 * 1024 * 1024 + 8)
    categoria: Literal["comunicado_oficial", "aviso_importante", "novedad_sistema", "mantenimiento_programado"] = "novedad_sistema"
    fecha_inicio: date | None = None
    fecha_fin: date | None = None


@router.get("")
def obtener_novedades(gestion: bool = False, usuario: dict = Depends(obtener_usuario_actual)):
    if gestion and usuario.get("id_rol") not in (1, 3):
        raise HTTPException(status_code=403, detail="Solo administradores y operadores pueden gestionar novedades.")
    return novedades.listar_novedades(incluir_inactivas=gestion)


@router.post("", status_code=201)
def publicar_novedad(datos: NuevaNovedad, usuario: dict = Depends(requerir_gestor_alertas)):
    return novedades.crear_novedad(datos.titulo, datos.imagen_base64, usuario["user_id"], datos.categoria, datos.fecha_inicio, datos.fecha_fin)


@router.delete("/{id_novedad}")
def eliminar_novedad(id_novedad: int = Path(gt=0), usuario: dict = Depends(requerir_gestor_alertas)):
    novedades.eliminar_novedad(id_novedad, usuario["user_id"])
    return {"mensaje": "Novedad eliminada."}
