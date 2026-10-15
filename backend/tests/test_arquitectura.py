import unittest
from datetime import datetime, timezone
from unittest.mock import patch

from app.core.config import settings
from main import app
from app.models.alertas import CambioEstadoAlertaData, ReporteAlertaData
from app.models.sensores import LecturaSensorData
from app.core.security import obtener_usuario_actual, requerir_admin
from app.routers import alertas as router_alertas
from app.routers import sensores as router_sensores
from app.services import alertas, sensores


class ArquitecturaApiTests(unittest.TestCase):
    def test_rutas_de_sensores_y_alertas_se_publican(self):
        paths = app.openapi()["paths"]
        esperadas = {
            "/sensores", "/sensores/ultimas", "/sensores/historial",
            "/alertas", "/alertas/{alerta_id}/estado", "/alertas/sensor",
        }
        self.assertTrue(esperadas.issubset(paths.keys()))

    def test_cors_usa_la_lista_configurada(self):
        middleware = next(item for item in app.user_middleware if item.cls.__name__ == "CORSMiddleware")
        self.assertEqual(middleware.kwargs["allow_origins"], settings.FRONTEND_ORIGINS)

    def test_consulta_de_sensores_requiere_usuario_autenticado(self):
        for path in ("/sensores/ultimas", "/sensores/historial"):
            route = next(item for item in router_sensores.router.routes if item.path == path)
            dependency_calls = {dependency.call for dependency in route.dependant.dependencies}
            self.assertIn(obtener_usuario_actual, dependency_calls)

    def test_operaciones_admin_de_alertas_requieren_rol_admin(self):
        for path in ("/alertas/{alerta_id}/estado", "/alertas/sensor"):
            route = next(item for item in router_alertas.router.routes if item.path == path)
            dependency_calls = {dependency.call for dependency in route.dependant.dependencies}
            self.assertIn(requerir_admin, dependency_calls)


class ServiciosDominioTests(unittest.TestCase):
    def test_lectura_sin_mediciones_se_rechaza_antes_de_conectar(self):
        lectura = LecturaSensorData(sensor_id="esp32-maqueta")
        with patch("app.services.sensores.get_db_connection") as conectar:
            with self.assertRaisesRegex(ValueError, "al menos una medición"):
                sensores.registrar_lectura(lectura)
        conectar.assert_not_called()

    def test_lectura_se_serializa_con_valores_nulos(self):
        fecha = datetime(2026, 10, 14, tzinfo=timezone.utc)
        fila = (1, "esp32-maqueta", 24, None, None, None, None, None, None, None, None, fecha)
        resultado = sensores.serializar_lectura(fila)
        self.assertEqual(resultado["sensor_id"], "esp32-maqueta")
        self.assertEqual(resultado["temperatura"], 24.0)
        self.assertIsNone(resultado["humedad"])
        self.assertEqual(resultado["fecha_hora"], fecha.isoformat())

    def test_aviso_con_titulo_invalido_no_abre_conexion(self):
        datos = ReporteAlertaData(titulo="   ", descripcion="Descripción válida")
        with patch("app.services.alertas.get_db_connection") as conectar:
            with self.assertRaisesRegex(ValueError, "título y una descripción"):
                alertas.reportar_alerta(datos, user_id=8)
        conectar.assert_not_called()

    def test_cambio_de_estado_exige_observacion(self):
        datos = CambioEstadoAlertaData(estado="pendiente", observacion=" ")
        with patch("app.services.alertas.get_db_connection") as conectar:
            with self.assertRaises(alertas.NotaObligatoria):
                alertas.cambiar_estado_alerta(3, datos, admin_id=1)
        conectar.assert_not_called()


if __name__ == "__main__":
    unittest.main()
