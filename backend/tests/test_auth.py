import unittest
from unittest.mock import patch

from pydantic import ValidationError
from fastapi import HTTPException

from app.models.auth import LoginData, RegisterData
from app.routers.auth import _session_response, registrar_usuario
from app.services.supabase_auth import SupabaseAuthError, public_auth_error, sign_out


class AuthServiceTests(unittest.TestCase):
    def test_login_rejects_invalid_email_address(self):
        with self.assertRaises(ValidationError):
            LoginData(email="esto-no-es-un-correo", password="password123")

    def test_login_accepts_valid_email_address(self):
        result = LoginData(email="Richard@example.com", password="password123")

        self.assertEqual(result.email, "Richard@example.com")

    def test_registration_rejects_invalid_email_address(self):
        with self.assertRaises(ValidationError):
            RegisterData(nombre="Richard", email="correo-invalido", password="password123")

    def test_registration_normalizes_email_and_requires_confirmation(self):
        with patch("app.routers.auth.sign_up", return_value={"user": {"id": "new-user"}}) as sign_up:
            response = registrar_usuario(
                RegisterData(nombre="  Richard Ruiz  ", email="Richard@Example.com", password="password123")
            )

        sign_up.assert_called_once_with("richard@example.com", "password123", "Richard Ruiz")
        self.assertTrue(response["requiere_confirmacion"])

    def test_registration_reports_already_confirmed_account(self):
        result = {"user": {"id": "new-user", "email_confirmed_at": "2026-10-20T12:00:00Z"}}
        with patch("app.routers.auth.sign_up", return_value=result):
            response = registrar_usuario(
                RegisterData(nombre="Richard", email="richard@example.com", password="password123")
            )

        self.assertFalse(response["requiere_confirmacion"])

    def test_registration_maps_rate_limit_without_leaking_provider_message(self):
        error = SupabaseAuthError(429, "raw provider details")
        with patch("app.routers.auth.sign_up", side_effect=error):
            with self.assertRaises(HTTPException) as raised:
                registrar_usuario(
                    RegisterData(nombre="Richard", email="richard@example.com", password="password123")
                )

        self.assertEqual(raised.exception.status_code, 429)
        self.assertNotIn("raw provider details", raised.exception.detail)

    def test_registration_rejects_whitespace_only_name(self):
        with self.assertRaises(HTTPException) as raised:
            registrar_usuario(RegisterData(nombre="   ", email="richard@example.com", password="password123"))

        self.assertEqual(raised.exception.status_code, 400)

    def test_sign_out_revokes_only_the_current_session(self):
        with patch("app.services.supabase_auth._request", return_value={}) as request:
            sign_out("test-access-token")

        request.assert_called_once_with(
            "POST",
            "/auth/v1/logout?scope=local",
            access_token="test-access-token",
        )

    def test_login_error_suggests_social_provider_without_revealing_account_state(self):
        error = SupabaseAuthError(400, "Invalid login credentials")

        response = public_auth_error(error, login=True)

        self.assertEqual(response.status_code, 401)
        self.assertIn("Google o Facebook", response.detail)
        self.assertNotIn("Invalid login credentials", response.detail)

    def test_expired_session_error_does_not_claim_password_is_wrong(self):
        response = public_auth_error(SupabaseAuthError(401, "Invalid token"), session=True)

        self.assertEqual(response.status_code, 401)
        self.assertIn("La sesión venció", response.detail)

    def test_supabase_outage_during_session_validation_remains_service_unavailable(self):
        outage = HTTPException(status_code=503, detail="No se pudo conectar con Supabase Auth.")
        with patch("app.routers.auth.validar_token_y_obtener_sesion", side_effect=outage):
            with self.assertRaises(HTTPException) as raised:
                _session_response({"user": {"id": "test-user"}, "access_token": "test-access-token"})

        self.assertEqual(raised.exception.status_code, 503)

if __name__ == "__main__":
    unittest.main()
