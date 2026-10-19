export const PARKING_IDS = Object.freeze(['P1', 'P2', 'P3', 'P4']);

/** Señales virtuales de presencia: true = ocupado. Sin transporte ni electrónica. */
export function validateSensors(sensors, partial = false) {
  if (!sensors || typeof sensors !== 'object' || Array.isArray(sensors)) {
    throw new TypeError('Se necesitan estados de presencia por plaza.');
  }
  for (const [id, value] of Object.entries(sensors)) {
    if (!PARKING_IDS.includes(id) || typeof value !== 'boolean') {
      throw new TypeError(`Estado inválido para ${id}.`);
    }
  }
  if (!partial && PARKING_IDS.some((id) => typeof sensors[id] !== 'boolean')) {
    throw new TypeError('Se necesitan las cuatro plazas P1–P4.');
  }
}

export function availability(sensors) {
  validateSensors(sensors);
  const occupied = PARKING_IDS.filter((id) => sensors[id]).length;
  return { capacity: PARKING_IDS.length, occupied, available: PARKING_IDS.length - occupied };
}
