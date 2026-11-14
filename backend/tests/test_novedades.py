import base64
import json
import unittest
from datetime import datetime, timezone
from io import BytesIO
from unittest.mock import MagicMock, patch

from fastapi.testclient import TestClient
from PIL import Image

from app.core.security import obtener_usuario_actual
from app.services import novedades
from main import app


def imagen_png():
    buffer = BytesIO()
    Image.new("RGB", (2, 2), "blue").save(buffer, format="PNG")
    return base64.b64encode(buffer.getvalue()).decode("ascii")


class NovedadesTests(unittest.TestCase):
    def setUp(self):
        self.client = TestClient(app)

    def tearDown(self):
        app.dependency_overrides.clear()

    def usuario(self, rol):
        app.dependency_overrides[obtener_usuario_actual] = lambda: {"user_id": 7, "id_rol": rol}

    def test_usuario_no_puede_publicar_incluso_con_peticion_directa(self):
        self.usuario(2)
        with patch("app.services.novedades.crear_novedad") as crear:
            respuesta = self.client.post("/novedades", json={"titulo": "Hola", "imagen_base64": imagen_png()})
        self.assertEqual(respuesta.status_code, 403)
        crear.assert_not_called()

    def test_admin_y_operador_pueden_publicar(self):
        for rol in (1, 3):
            with self.subTest(rol=rol):
                self.usuario(rol)
                with patch("app.services.novedades.crear_novedad", return_value={"id_novedad": 5}) as crear:
                    respuesta = self.client.post("/novedades", json={"titulo": "Avance", "imagen_base64": imagen_png()})
                self.assertEqual(respuesta.status_code, 201)
                self.assertEqual(crear.call_args.args[2], 7)

    def test_lista_requiere_sesion(self):
        respuesta = self.client.get("/novedades")
        self.assertIn(respuesta.status_code, (401, 422))

    def test_imagen_invalida_no_se_sube(self):
        with patch("app.services.novedades.storage_request") as subir:
            with self.assertRaises(Exception):
                novedades.crear_novedad("Titulo", base64.b64encode(b"no es imagen").decode(), 1)
        subir.assert_not_called()

    def test_fallo_de_base_elimina_imagen_y_revierte(self):
        conexion = MagicMock()
        conexion.cursor.return_value.execute.side_effect = RuntimeError("fallo")
        with patch("app.services.novedades.storage_request") as storage, patch("app.services.novedades.asegurar_bucket_privado"), patch("app.services.novedades.get_db_connection", return_value=conexion):
            with self.assertRaises(Exception):
                novedades.crear_novedad("Titulo", imagen_png(), 1)
        self.assertEqual([c.args[0] for c in storage.call_args_list], ["POST", "DELETE"])
        conexion.rollback.assert_called_once()

    def test_rechaza_bucket_publico(self):
        with patch("app.services.novedades.storage_request", return_value=b'{"public": true}'):
            with self.assertRaisesRegex(Exception, "privado"):
                novedades.asegurar_bucket_privado()

    def test_lista_devuelve_url_firmada_sin_clave_privada(self):
        conexion = MagicMock()
        conexion.cursor.return_value.fetchall.return_value = [(1, "Hola", "foto.png", datetime.now(timezone.utc))]
        firmadas = json.dumps([{"path": "foto.png", "signedURL": "/object/sign/novedades/foto.png?token=demo"}]).encode()
        with patch("app.services.novedades.storage_request", return_value=firmadas), patch("app.services.novedades.get_db_connection", return_value=conexion), patch.object(novedades.settings, "SUPABASE_URL", "https://ejemplo.test"):
            result = novedades.listar_novedades()
        self.assertEqual(result[0]["imagen_url"], "https://ejemplo.test/storage/v1/object/sign/novedades/foto.png?token=demo")


if __name__ == "__main__":
    unittest.main()
