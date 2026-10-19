import { PARKING_IDS, availability, validateSensors } from './sensors.js';

export const PARKING_TIMINGS = Object.freeze({ opening: 1200, passing: 1800, closing: 1200 });
const smooth = (t) => t * t * (3 - 2 * t);

/** Una sola operación reserva una plaza hasta completar apertura, paso y cierre.
 * El reloj y la representación 3D no forman parte del estado de presencia.
 */
export function createParkingController(initialSensors, timings = PARKING_TIMINGS) {
  validateSensors(initialSensors);
  const initial = { ...initialSensors };
  const durations = Object.fromEntries(Object.keys(PARKING_TIMINGS).map((key) => [key, timings[key]]));
  if (Object.values(durations).some((ms) => !Number.isFinite(ms) || ms <= 0)) {
    throw new RangeError('Las duraciones deben ser positivas y finitas.');
  }
  let sensors = { ...initial };
  let phase = 'idle', elapsed = 0, operation = null, paused = false;
  let message = 'Selecciona una plaza ocupada para simular su salida.';
  const listeners = new Set();

  function getSnapshot() {
    const progress = phase === 'idle' ? 0 : Math.min(1, elapsed / durations[phase]);
    const barrierOpen = phase === 'opening' ? smooth(progress)
      : phase === 'passing' ? 1 : phase === 'closing' ? 1 - smooth(progress) : 0;
    return {
      mode: 'simulation', sensors: { ...sensors }, ...availability(sensors),
      phase, busy: phase !== 'idle', paused, barrierOpen,
      operation: operation ? { ...operation } : null, message,
    };
  }
  function emit() { for (const listener of listeners) listener(getSnapshot()); }
  function reject(reason) { message = reason; emit(); return false; }
  function request(type, slot) {
    if (phase !== 'idle') return reject('Espera a que termine el paso del vehículo y cierre la barrera.');
    if (type === 'entry') {
      slot = PARKING_IDS.find((id) => !sensors[id]);
      if (!slot) return reject('PARQUEADERO LLENO. Retira un vehículo antes de solicitar otro ingreso.');
    } else if (!PARKING_IDS.includes(slot) || !sensors[slot]) {
      return reject('Selecciona una plaza ocupada para retirar su vehículo.');
    }
    operation = { type, slot };
    phase = 'opening'; elapsed = 0;
    message = `Abriendo barrera para ${type === 'entry' ? 'ingresar a' : 'retirar el vehículo de'} ${slot}.`;
    emit(); return true;
  }
  function nextPhase() {
    elapsed = 0;
    if (phase === 'opening') {
      phase = 'passing';
      message = `${operation.type === 'entry' ? 'Simulando ingreso a' : 'Simulando salida de'} ${operation.slot}. Barrera abierta.`;
    } else if (phase === 'passing') {
      // El paso termina antes de iniciar el cierre: nunca se cierra durante el paso.
      sensors = { ...sensors, [operation.slot]: operation.type === 'entry' };
      phase = 'closing';
      message = `Paso completado en ${operation.slot}. Cerrando barrera.`;
    } else {
      message = operation.type === 'entry' ? `Vehículo estacionado en ${operation.slot}.` : `${operation.slot} está libre.`;
      phase = 'idle'; operation = null;
    }
  }
  function advance(ms) {
    if (!Number.isFinite(ms) || ms < 0) throw new RangeError('Tiempo inválido.');
    if (paused || phase === 'idle' || ms === 0) return;
    while (ms > 0 && phase !== 'idle') {
      const step = Math.min(ms, durations[phase] - elapsed);
      elapsed += step; ms -= step;
      if (elapsed >= durations[phase]) nextPhase();
    }
    emit();
  }
  function reset() {
    sensors = { ...initial }; phase = 'idle'; elapsed = 0; operation = null; paused = false;
    message = 'Parqueadero reiniciado: ocupación original y barrera cerrada.';
    emit();
  }
  function setSensorStates(patch) {
    validateSensors(patch, true);
    // Punto de integración futuro. No mezclar lecturas externas con una maniobra virtual activa.
    if (phase !== 'idle') return false;
    sensors = { ...sensors, ...patch };
    message = 'Estados de presencia actualizados en modo simulación.';
    emit(); return true;
  }
  return {
    getSnapshot, advance, reset, setSensorStates,
    requestEntry: () => request('entry'), requestExit: (slot) => request('exit', slot),
    setPaused(value) { paused = Boolean(value); emit(); },
    subscribe(listener) { listeners.add(listener); listener(getSnapshot()); return () => listeners.delete(listener); },
  };
}
