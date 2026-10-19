export const PROXIMITY_DEFAULTS = Object.freeze({ motionSeconds: 1, closeDelaySeconds: 3 });
const smooth = value => value * value * (3 - 2 * value);

/** Tapa automática exclusivamente por presencia: no expone órdenes abrir/cerrar. */
export function createProximityController(options = {}) {
  const config = { ...PROXIMITY_DEFAULTS, ...options };
  if (!Object.values(config).every(value => Number.isFinite(value) && value > 0)) throw new RangeError('Tiempos de tapa inválidos.');
  let detected = false, phase = 'closed', opening = 0, start = 0, destination = 0, elapsed = 0, duration = 0, wait = 0;
  const listeners = new Set();
  function getSnapshot() {
    return { source: 'simulation', detected, phase, opening, closeRemaining: phase === 'waiting' ? Math.max(0, config.closeDelaySeconds - wait) : 0 };
  }
  const emit = () => { for (const listener of listeners) listener(getSnapshot()); };
  function move(target) {
    start = opening; destination = target; elapsed = 0;
    duration = config.motionSeconds * Math.abs(destination - start);
    phase = target ? 'opening' : 'closing';
  }
  return {
    getSnapshot,
    setDetected(value) {
      if (typeof value !== 'boolean') throw new TypeError('Detección de proximidad inválida.');
      if (detected === value) return;
      detected = value; wait = 0;
      if (detected) {
        if (opening < 1) move(1); else phase = 'open';
      } else if (phase === 'open') phase = 'waiting';
      // Si se retira durante apertura, termina de abrir antes de esperar.
      emit();
    },
    advance(seconds) {
      if (!Number.isFinite(seconds) || seconds < 0) throw new RangeError('Tiempo inválido.');
      let changed = false;
      while (seconds > 1e-9) {
        if (phase === 'closed' || phase === 'open') break;
        changed = true;
        if (phase === 'waiting') {
          const step = Math.min(seconds, config.closeDelaySeconds - wait); wait += step; seconds -= step;
          if (wait + 1e-9 >= config.closeDelaySeconds) move(0);
        } else {
          const step = Math.min(seconds, duration - elapsed); elapsed += step; seconds -= step;
          if (!detected && phase === 'opening') wait += step;
          opening = start + (destination - start) * smooth(Math.min(1, elapsed / duration));
          if (elapsed + 1e-9 >= duration) {
            opening = destination;
            phase = destination ? detected ? 'open' : 'waiting' : 'closed';
            if (!destination) wait = 0;
          }
        }
      }
      if (changed) emit();
    },
    subscribe(listener) { listeners.add(listener); listener(getSnapshot()); return () => listeners.delete(listener); },
  };
}
