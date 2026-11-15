"""Publicaciones de título e imagen en un bucket privado de Supabase Storage."""
import base64
import binascii
import calendar
import json
import uuid
from datetime import date, datetime, timedelta, timezone
from io import BytesIO
from urllib.error import HTTPError, URLError
from urllib.parse import quote
from urllib.request import Request, urlopen

from fastapi import HTTPException
from PIL import Image, UnidentifiedImageError

from app.core.config import settings
from app.db.database import get_db_connection

BUCKET = "novedades"
MAX_BYTES = 3 * 1024 * 1024


def validar_imagen(contenido: str) -> tuple[bytes, str, str]:
    try:
        datos = base64.b64decode(contenido, validate=True)
    except (ValueError, binascii.Error) as error:
        raise HTTPException(status_code=422, detail="La imagen no es válida.") from error
    if not datos or len(datos) > MAX_BYTES:
        raise HTTPException(status_code=422, detail="La imagen debe pesar como máximo 3 MB.")
    try:
        with Image.open(BytesIO(datos)) as imagen:
            if imagen.format not in ("JPEG", "PNG", "WEBP") or imagen.width * imagen.height > 20_000_000:
                raise HTTPException(status_code=422, detail="Usa una imagen JPG, PNG o WebP de hasta 20 megapíxeles.")
            formato = imagen.format
            imagen.verify()
    except (UnidentifiedImageError, OSError, SyntaxError, Image.DecompressionBombError) as error:
        raise HTTPException(status_code=422, detail="La imagen no es válida o está dañada.") from error
    mime, extension = {"JPEG": ("image/jpeg", "jpg"), "PNG": ("image/png", "png"), "WEBP": ("image/webp", "webp")}[formato]
    return datos, mime, extension


class StorageNoExiste(Exception):
    pass


def storage_request(method: str, path: str, body: bytes | None = None, content_type: str | None = None):
    if not settings.SUPABASE_URL or not settings.SUPABASE_SERVICE_ROLE_KEY:
        raise HTTPException(status_code=503, detail="El almacenamiento de novedades no está configurado.")
    key = settings.SUPABASE_SERVICE_ROLE_KEY
    headers = {"apikey": key, "Authorization": f"Bearer {key}"}
    if content_type:
        headers["Content-Type"] = content_type
    request = Request(f"{settings.SUPABASE_URL}/storage/v1{path}", data=body, headers=headers, method=method)
    try:
        with urlopen(request, timeout=25) as response:
            return response.read()
    except HTTPError as error:
        # Storage puede informar un bucket inexistente con HTTP 400 y código
        # NoSuchBucket (además del habitual 404). No tratar otros 400 igual.
        detalle = {}
        try:
            detalle = json.loads(error.read().decode("utf-8"))
        except (ValueError, UnicodeDecodeError):
            pass
        es_bucket_ausente = (
            method == "GET" and path == f"/bucket/{BUCKET}"
            and error.code == 400 and isinstance(detalle, dict)
            and (str(detalle.get("statusCode")) == "404"
                 or detalle.get("code") == "NoSuchBucket"
                 or detalle.get("error") == "Bucket not found"
                 or detalle.get("message") == "Bucket not found")
        )
        if error.code == 404 or es_bucket_ausente:
            raise StorageNoExiste() from error
        raise HTTPException(status_code=503, detail="No se pudo acceder al almacenamiento de novedades.") from error
    except (URLError, TimeoutError) as error:
        raise HTTPException(status_code=503, detail="No se pudo acceder al almacenamiento de novedades.") from error


def asegurar_bucket_privado():
    """Inicializa el bucket por la API oficial, sin modificar el esquema storage."""
    try:
        bucket = json.loads(storage_request("GET", f"/bucket/{BUCKET}"))
    except StorageNoExiste:
        try:
            storage_request("POST", "/bucket", json.dumps({"id": BUCKET, "name": BUCKET, "public": False,
                "file_size_limit": MAX_BYTES, "allowed_mime_types": ["image/jpeg", "image/png", "image/webp"]}).encode(), "application/json")
        except HTTPException:
            # Otra petición pudo crear el bucket simultáneamente.
            pass
        try:
            bucket = json.loads(storage_request("GET", f"/bucket/{BUCKET}"))
        except (StorageNoExiste, ValueError, TypeError) as error:
            raise HTTPException(status_code=503, detail="No se pudo preparar el almacenamiento privado.") from error
    except (ValueError, TypeError) as error:
        raise HTTPException(status_code=503, detail="No se pudo comprobar el almacenamiento privado.") from error
    if bucket.get("public") is not False:
        raise HTTPException(status_code=503, detail="El almacenamiento de novedades debe ser privado.")


def validar_vigencia(inicio: date | None, fin: date | None) -> tuple[date, date]:
    if (inicio is None) != (fin is None):
        raise HTTPException(status_code=422, detail="Selecciona ambas fechas de vigencia.")
    if inicio is None:
        inicio = fin = datetime.now(timezone(timedelta(hours=-5))).date()
    mes = inicio.month % 12 + 1
    ano = inicio.year + (inicio.month == 12)
    limite = date(ano, mes, min(inicio.day, calendar.monthrange(ano, mes)[1]))
    if fin < inicio or fin >= limite:
        raise HTTPException(status_code=422, detail="El periodo debe ser de al menos un día y máximo un mes.")
    return inicio, fin


def crear_novedad(titulo: str, imagen: str, usuario_id: int, categoria: str = "novedad_sistema", fecha_inicio: date | None = None, fecha_fin: date | None = None) -> dict:
    titulo = titulo.strip()
    if not titulo or len(titulo) > 120:
        raise HTTPException(status_code=422, detail="Escribe un título de hasta 120 caracteres.")
    fecha_inicio, fecha_fin = validar_vigencia(fecha_inicio, fecha_fin)
    datos, mime, extension = validar_imagen(imagen)
    ruta = f"{uuid.uuid4().hex}.{extension}"
    asegurar_bucket_privado()
    storage_request("POST", f"/object/{BUCKET}/{ruta}", datos, mime)
    conn = cursor = None
    try:
        conn = get_db_connection()
        cursor = conn.cursor()
        cursor.execute(
            "INSERT INTO public.novedades (titulo, imagen_ruta, id_usuario_autor, categoria, fecha_inicio, fecha_fin) VALUES (%s, %s, %s, %s, %s, %s) RETURNING id_novedad",
            (titulo, ruta, usuario_id, categoria, fecha_inicio, fecha_fin),
        )
        identificador = cursor.fetchone()[0]
        conn.commit()
    except Exception as error:
        if conn:
            conn.rollback()
        try:
            storage_request("DELETE", f"/object/{BUCKET}", json.dumps({"prefixes": [ruta]}).encode(), "application/json")
        except Exception:
            pass
        raise HTTPException(status_code=503, detail="No se pudo guardar la novedad.") from error
    finally:
        if cursor:
            cursor.close()
        if conn:
            conn.close()
    return {"id_novedad": identificador}


def listar_novedades(incluir_inactivas: bool = False) -> list[dict]:
    conn = cursor = None
    try:
        conn = get_db_connection()
        cursor = conn.cursor()
        cursor.execute("""SELECT id_novedad, titulo, imagen_ruta, creado_en, categoria, fecha_inicio, fecha_fin,
                       (now() AT TIME ZONE 'America/Guayaquil')::date BETWEEN fecha_inicio AND fecha_fin AS activa
                       FROM public.novedades WHERE eliminado_en IS NULL
                       AND (%s OR (now() AT TIME ZONE 'America/Guayaquil')::date BETWEEN fecha_inicio AND fecha_fin)
                       ORDER BY creado_en DESC, id_novedad DESC LIMIT 100""", (incluir_inactivas,))
        filas = cursor.fetchall()
    except Exception as error:
        raise HTTPException(status_code=503, detail="No se pudieron consultar las novedades.") from error
    finally:
        if cursor:
            cursor.close()
        if conn:
            conn.close()
    if not filas:
        return []
    rutas = [fila[2] for fila in filas]
    respuesta = storage_request("POST", f"/object/sign/{BUCKET}", json.dumps({"paths": rutas, "expiresIn": 3600}).encode(), "application/json")
    try:
        firmadas = {item["path"]: item.get("signedURL") for item in json.loads(respuesta)}
    except (ValueError, KeyError, TypeError) as error:
        raise HTTPException(status_code=503, detail="No se pudieron cargar las imágenes.") from error
    salida = []
    for identificador, titulo, ruta, fecha, categoria, fecha_inicio, fecha_fin, activa in filas:
        firmada = firmadas.get(ruta)
        salida.append({"id": identificador, "titulo": titulo, "categoria": categoria, "creado_en": fecha.isoformat(),
                       "fecha_inicio": fecha_inicio.isoformat(), "fecha_fin": fecha_fin.isoformat(), "activa": activa,
                       "imagen_url": f"{settings.SUPABASE_URL}/storage/v1{firmada}" if firmada else None})
    return salida


def eliminar_novedad(id_novedad: int, usuario_id: int) -> None:
    """Oculta el comunicado y conserva su imagen y trazabilidad para recuperación."""
    conn = cursor = None
    try:
        conn = get_db_connection()
        cursor = conn.cursor()
        cursor.execute("UPDATE public.novedades SET eliminado_en = now(), id_usuario_eliminacion = %s WHERE id_novedad = %s AND eliminado_en IS NULL RETURNING id_novedad", (usuario_id, id_novedad))
        if not cursor.fetchone():
            raise HTTPException(status_code=404, detail="La novedad no existe o ya fue eliminada.")
        conn.commit()
    except HTTPException:
        if conn: conn.rollback()
        raise
    except Exception as error:
        if conn: conn.rollback()
        raise HTTPException(status_code=503, detail="No se pudo eliminar la novedad.") from error
    finally:
        if cursor: cursor.close()
        if conn: conn.close()
