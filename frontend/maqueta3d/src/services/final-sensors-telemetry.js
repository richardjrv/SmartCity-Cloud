import { validateAmbientReading, ambientIndicators } from '../ambient/config.js';

/** Fuentes futuras de sólo lectura. No se montan, no conectan ni crean relojes. */
function source(validate, project) {
  let state = null; const listeners = new Set();
  const getSnapshot = () => state ? { ...state } : null;
  return { getSnapshot,
    update(measurement) {
      if (typeof measurement?.observedAt !== 'string' || !Number.isFinite(Date.parse(measurement.observedAt))) throw new TypeError('Falta la fecha de la medición confirmada.');
      validate(measurement); state = { ...project(measurement), source: 'telemetry', mode: 'readonly', observedAt: measurement.observedAt };
      for (const listener of listeners) listener(getSnapshot());
    },
    subscribe(listener) { listeners.add(listener); listener(getSnapshot()); return () => listeners.delete(listener); },
  };
}
export const createDhtTelemetrySource = () => source(validateAmbientReading, value => ({ temperature: value.temperature, humidity: value.humidity, ...ambientIndicators(value) }));
export const createProximityTelemetrySource = () => source(value => {
  if (typeof value.detected !== 'boolean') throw new TypeError('Detección confirmada inválida.');
}, value => ({ detected: value.detected }));
