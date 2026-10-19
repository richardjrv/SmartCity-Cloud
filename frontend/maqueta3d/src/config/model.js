// Estos identificadores pertenecen al GLB aprobado. No renombrar al cargarlo.
export const MODEL_FILE = 'Ciudad_Inteligente_Web.glb';
export const MODEL_SHA256 = '39b6fe62db4a7134a4a866f1b2e0c08a4ccc038bcc814e5572c86d744589eb63';
export const INTERACTIVE_NAMES = Object.freeze([
  ...[1, 2, 3].flatMap((id) => ['Roja', 'Amarilla', 'Verde'].map(
    (color) => `Semaforo_${String(id).padStart(2, '0')}_Luz_${color}`,
  )),
  ...[1, 2, 3, 4, 5].map((id) => `Farola_0${id}_Difusor`),
  'Barrera_Parqueadero_Pivote',
  'Barrera_Inundacion_Pivote',
  'Piscina_Superficie_Agua',
  'Pantalla_Display_01',
  ...[1, 2, 3, 4].map((id) => `Indicador_Ocupacion_0${id}`),
]);
