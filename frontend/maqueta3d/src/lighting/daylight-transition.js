import { MathUtils } from 'three';

/** Interpola muestras del LDR en el bucle existente del visor; no crea relojes. */
export function createDaylightTransition(apply, initial = 1, duration = .1) {
  let current = initial, start = initial, target = initial, elapsed = duration;
  apply(current);
  return {
    setTarget(value) {
      if (!Number.isFinite(value)) return;
      const next = MathUtils.clamp(value, 0, 1);
      if (next === target) return;
      start = current; target = next; elapsed = 0;
    },
    update(seconds) {
      if (current === target || !Number.isFinite(seconds) || seconds <= 0) return;
      elapsed = Math.min(duration, elapsed + seconds);
      current = elapsed === duration ? target : MathUtils.lerp(start, target, elapsed / duration);
      apply(current);
    },
  };
}
