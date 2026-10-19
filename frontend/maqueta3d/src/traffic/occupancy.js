import { SENSOR_IDS } from './config.js';

/** Presencia en dos puntos, no conteo de vehículos. */
export function classifyOccupancy(near, far) {
  if (typeof near !== 'boolean' || typeof far !== 'boolean') throw new TypeError('Los sensores deben ser booleanos.');
  if (near && far) return 'high';
  if (near) return 'low';
  if (far) return 'isolated';
  return 'none';
}

export function validateSensorPatch(patch) {
  if (!patch || typeof patch !== 'object' || Array.isArray(patch)) throw new TypeError('Se esperaba un conjunto de sensores.');
  for (const [id, value] of Object.entries(patch)) {
    if (!SENSOR_IDS.includes(id) || typeof value !== 'boolean') throw new TypeError(`Lectura inválida: ${id}`);
  }
}

export function getOccupancies(sensors) {
  return { A: classifyOccupancy(sensors.A1, sensors.A2), B: classifyOccupancy(sensors.B1, sensors.B2) };
}
