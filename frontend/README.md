# Frontend SmartCity Cloud

## Arquitectura durante la migración

- `src/`: componentes React, estilos Tailwind y nuevas interfaces.
- `assets/js/`: módulos clásicos que mantienen las funciones actuales mientras se migran por partes.
- `assets/css/`: estilos actuales de las vistas y módulos existentes.
- `maqueta3d/`: explorador 3D independiente; el proceso de compilación lo copia sin cambiar sus rutas.
- `scripts/copy-static.mjs`: conserva los archivos estáticos, el modelo 3D y las páginas legales en `dist/`.

La integración React inicial gestiona las notificaciones toast. La función global `mostrarNotificacion` conserva su API para que los módulos existentes no necesiten cambiar sus llamadas.

Los scripts actuales de `assets/js/` se mantienen como scripts clásicos porque exponen funciones globales usadas por controles HTML y se ejecutan en un orden establecido. El build los copia sin convertirlos a módulos; Vite puede mostrar avisos indicando que no los agrupa.

## Desarrollo local

Desde esta carpeta ejecuta `npm install` y luego `npm run dev`.

## Producción

`npm run build` genera `dist/`, incluyendo los recursos estáticos requeridos por la aplicación actual. En Vercel, usa `frontend` como directorio raíz, `npm run build` como comando de compilación y `dist` como directorio de salida.

