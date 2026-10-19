import { FLOOD_DEFAULTS } from '../flooding/config.js';

/** Contrato preparado pero NO conectado a la aplicación. No hace peticiones,
 * no calcula llenado por tiempo y no envía órdenes a actuadores físicos.
 * Un futuro transporte deberá proporcionar lecturas y estados confirmados juntos.
 */
export function createFloodTelemetrySource({ poolCapacity, receiverCapacity }, thresholds = FLOOD_DEFAULTS) {
  if (![poolCapacity, receiverCapacity].every(v => Number.isFinite(v) && v > 0)) throw new RangeError('Capacidad inválida.');
  if (![thresholds.precaution, thresholds.critical].every(Number.isFinite) || thresholds.precaution < 0 ||
    thresholds.precaution >= thresholds.critical || thresholds.critical > 100) throw new RangeError('Umbrales inválidos.');
  const config = { ...thresholds }, listeners = new Set();
  let state = null;
  const snapshot = () => state ? { ...state, config: { ...config } } : null;
  return {
    getSnapshot: snapshot,
    update(measurement) {
      if (!measurement || ![measurement.poolPercent, measurement.receiverPercent].every(v => Number.isFinite(v) && v >= 0 && v <= 100) ||
        !['rain', 'pumpOn', 'buzzerActive', 'alarmMuted'].every(k => typeof measurement[k] === 'boolean') ||
        typeof measurement.observedAt !== 'string' || !Number.isFinite(Date.parse(measurement.observedAt))) throw new TypeError('Telemetría incompleta o inválida.');
      const { poolPercent, receiverPercent, rain, pumpOn, buzzerActive, alarmMuted, observedAt } = measurement;
      state = { source: 'telemetry', mode: 'readonly', poolPercent, receiverPercent, rain, pumpOn,
        pool: poolPercent / 100 * poolCapacity, receiver: receiverPercent / 100 * receiverCapacity,
        receiverFull: receiverPercent === 100,
        severity: poolPercent >= config.critical ? 'critical' : poolPercent >= config.precaution ? 'precaution' : 'normal',
        buzzer: buzzerActive ? alarmMuted ? 'muted' : 'active' : 'inactive', observedAt };
      for (const listener of listeners) listener(snapshot());
    },
    subscribe(fn) { listeners.add(fn); fn(snapshot()); return () => listeners.delete(fn); },
  };
}
