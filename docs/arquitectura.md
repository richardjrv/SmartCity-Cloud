# Arquitectura actual y organización gradual

## Estado actual

- `frontend/index.html` contiene las vistas y estructura principal de la interfaz.
- `frontend/assets/js/` separa autenticación, alertas/notificaciones, clima, gráficas, mapa, perfil, administración, configuración del operador y acceso a la API.
- `frontend/assets/css/` contiene estilos compartidos y hojas por vista; `frontend/maqueta3d/src/styles/` contiene el tema del explorador 3D.
- `frontend/assets/models/` guarda el GLB de la maqueta, cargado por `frontend/maqueta3d/src/scene/model-loader.js`.
- `backend/main.py` crea la aplicación FastAPI e incluye routers.
- `backend/app/` separa `routers`, `models`, `core`, `db`, `services` y `utils`.
- Los servicios de dominio concentran consultas PostgreSQL; los routers validan HTTP y autorización.
- Supabase se conecta desde FastAPI mediante PostgreSQL (`psycopg2`); el frontend no debe recibir credenciales privadas.

## Patrón recomendado

Usamos un monolito modular por dominio. Cada dominio conserva sus rutas HTTP y modelos de entrada, delega reglas/consultas a servicios y concentra el acceso a datos detrás de funciones de servicio. Esto mantiene una sola aplicación y despliegue sin introducir la complejidad de microservicios.

```text
frontend/
  index.html
  assets/
    models/              modelos 3D estáticos
    vendor/              librerías de terceros locales
    css/                 estilos globales y hojas de cada vista
    js/                  módulos clásicos cargados en orden desde index.html
  maqueta3d/
    src/                 visor y sistemas de simulación por dominio
backend/
  main.py                composición de FastAPI y middleware
  app/
    core/                configuración y seguridad
    db/                  conexión PostgreSQL/Supabase
    models/              esquemas de entrada y salida
    routers/             validación HTTP, dependencias y códigos HTTP
    services/            reglas de negocio y operaciones de dominio
    utils/               utilidades transversales
  sql/                   scripts numerados y cambios manuales separados
docs/
  arquitectura.md
  migracion-supabase-auth.md
```

La configuración del sistema se guarda en `public.configuracion_sistema`. FastAPI exige el rol Operador para modificarla; los clientes autenticados pueden consultarla para aplicar los mismos límites. La tabla tiene RLS activado y no concede permisos a las claves públicas del navegador.

## Configuración y controles

- `FRONTEND_ORIGINS` define los orígenes CORS permitidos, separados por comas. En producción se debe configurar con el dominio exacto del frontend.
- Operaciones de administración y seguimiento de alertas verifican rol en el servidor. El módulo de alertas valida además que las cuentas ciudadanas solo creen avisos.
- Los endpoints GET de sensores ahora exigen un JWT válido. La ingesta POST del ESP32 todavía no exige clave de dispositivo: antes de cerrar ese acceso hay que provisionar una credencial en el firmware y desplegarla como secreto; el firmware no está en este repositorio.
- La maqueta usa un solo controlador activo, con `sensor_id=ESP32`; el firmware debe enviar ese identificador exacto. La API rechaza identificadores distintos. Los dispositivos históricos quedan inactivos y sus lecturas se conservan.
- Mantener `DATABASE_URL`, `SECRET_KEY` y `GEMINI_API_KEY` solamente en variables de entorno del backend. La clave de Gemini se crea en Google AI Studio; nunca debe añadirse al frontend ni al repositorio.
- El asistente usa el modelo `gemini-3.8-flash` por defecto, configurable con `GEMINI_MODEL`. La API ofrece un nivel gratuito con límites; la búsqueda fundamentada con Google Search puede requerir facturación, así que no se activa automáticamente.

## Reglas para cambios futuros

1. Los routers no deberían contener SQL ni lógica extensa.
2. La lógica de dominio va en `app/services/`; las dependencias HTTP (usuario, rol, parámetros) permanecen en `app/routers/`.
3. Las llamadas del navegador pasan por `frontend/assets/js/api.js`.
4. Antes de publicar, revisar configuración CORS, secretos y permisos de cada endpoint.
5. Los cambios de base de datos deben documentarse y versionarse en `backend/sql/`; consulta su README antes de ejecutar scripts y no vuelvas a aplicar cambios ya registrados.
