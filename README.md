# SmartCity Cloud

Plataforma universitaria de monitoreo IoT con un sitio estático, un explorador 3D y una API FastAPI.

## Estructura

- `frontend/`: sitio estático servido por Vercel. La raíz del proyecto Vercel debe apuntar a esta carpeta.
- `frontend/maqueta3d/`: explorador 3D y simulaciones, separado por sistemas urbanos.
- `backend/`: API FastAPI; se despliega como servicio Python en Render.
- `backend/sql/`: cambios de base de datos ordenados y scripts manuales.
- `docs/`: arquitectura y guía de migración de autenticación.

## Ejecutar el sitio

El frontend usa Vite, React y Tailwind CSS para los componentes migrados. Desde `frontend/` ejecuta `npm install` y `npm run dev`. Para generar el sitio de producción, ejecuta `npm run build`; los archivos se guardan en `frontend/dist/`. Las vistas clásicas y el explorador 3D se conservan durante la migración gradual.

Para probar la API local, configura `DATABASE_URL`, `SUPABASE_URL`, `SUPABASE_ANON_KEY`, `SECRET_KEY` y `FRONTEND_ORIGINS` en el entorno antes de iniciar el backend. El navegador usa la URL de API definida en `frontend/assets/js/api.js`.

## Ejecutar la API

```powershell
py -m venv backend\.venv
backend\.venv\Scripts\Activate.ps1
pip install -r backend\requirements.txt
cd backend
uvicorn main:app --reload
```

Las variables privadas se configuran en el entorno local o en Render; usa `backend/.env.example` como referencia de nombres. No guardes valores reales en Git. `GEMINI_API_KEY` es opcional para el asistente.

## Despliegues

- **Vercel**: conecta el repositorio GitHub, usa `main` como rama de producción y `frontend` como Root Directory. Usa `npm run build` y `dist` como directorio de salida.
- **Render**: usa `backend` como Root Directory, instala `requirements.txt` y arranca con `uvicorn main:app --host 0.0.0.0 --port $PORT`. Configura allí las variables del backend.
- Las variables privadas de Supabase y Gemini solo pertenecen al backend. La clave pública de Supabase del frontend no sustituye la autenticación ni los permisos del backend.

## Cambios de base de datos

Lee [backend/sql/README.md](backend/sql/README.md) antes de ejecutar SQL. Las migraciones existentes no se deben volver a ejecutar en una base que ya las tiene aplicadas. La configuración de sistema usa `public.configuracion_sistema`; solo el rol Operador puede modificarla.

## Flujo Git recomendado

Usa `main` para el código de producción. Para cada cambio crea una rama `feature/...` o `fix/...`, abre un pull request, intégralo y elimina la rama ya fusionada. Conserva ramas solo mientras tengan trabajo exclusivo sin integrar.

