const clamp = value => Math.max(0, Math.min(100, value));
export const LIGHTING_DEFAULTS = Object.freeze({ onBelow: 30, offAbove: 45, cycleSeconds: 90 });

/** Lectura relativa 0–100 del LDR: porcentajes virtuales, no lux calibrados. */
export function createLightingController() {
  const listeners = new Set();
  let config = { ...LIGHTING_DEFAULTS }, mode = 'auto', ldr = 100, phase = 0;
  let cycle = true, target = 100, automaticOn = false;
  let manual = { existing: false, decorative: false };
  function reconcile() {
    if (ldr <= config.onBelow) automaticOn = true;
    else if (ldr >= config.offAbove) automaticOn = false;
  }
  function getSnapshot() {
    return { source: 'simulation', mode, ldr, targetLdr: cycle ? ldr : target, dayFactor: ldr / 100, cycle, config: { ...config },
      groups: mode === 'auto' ? { existing: automaticOn, decorative: automaticOn } : { ...manual } };
  }
  function emit() { reconcile(); for (const listener of listeners) listener(getSnapshot()); }
  function setIllumination(value) {
    if (!Number.isFinite(value) || value < 0 || value > 100) throw new RangeError('El LDR debe estar entre 0 y 100.');
    cycle = false; target = value; emit();
  }
  return {
    getSnapshot, setIllumination,
    // Punto de entrada desacoplado para una futura fuente; no abre conexiones.
    setLdrReading(value) {
      if (!Number.isFinite(value) || value < 0 || value > 100) throw new RangeError('Lectura LDR inválida.');
      cycle = false; ldr = target = value; emit();
    },
    setMode(value) {
      if (!['auto', 'manual'].includes(value)) throw new RangeError('Modo desconocido.');
      if (value === 'manual' && mode !== 'manual') manual = { ...getSnapshot().groups };
      mode = value; emit();
    },
    toggleGroup(id) {
      if (!Object.hasOwn(manual, id)) throw new RangeError('Grupo desconocido.');
      if (mode !== 'manual') return false;
      manual[id] = !manual[id]; emit(); return true;
    },
    setCycle(enabled) {
      if (enabled && !cycle) phase = Math.acos(Math.max(-1, Math.min(1, 2 * ldr / 100 - 1))) / (2 * Math.PI);
      cycle = Boolean(enabled); target = ldr; emit();
    },
    configure(patch) {
      if (Object.keys(patch).some(k => !Object.hasOwn(config, k))) throw new RangeError('Configuración desconocida.');
      const next = { ...config, ...patch };
      if (!Object.values(next).every(Number.isFinite) || next.onBelow < 0 || next.offAbove > 100 ||
        next.onBelow >= next.offAbove || next.cycleSeconds < 20 || next.cycleSeconds > 600) throw new RangeError('Umbrales: 0 ≤ encendido < apagado ≤ 100; ciclo de 20 a 600 s.');
      config = next; emit();
    },
    advance(seconds) {
      if (!Number.isFinite(seconds) || seconds < 0) throw new RangeError('Tiempo inválido.');
      if (cycle) { phase = (phase + seconds / config.cycleSeconds) % 1; ldr = 50 + 50 * Math.cos(phase * 2 * Math.PI); }
      else ldr += Math.sign(target - ldr) * Math.min(Math.abs(target - ldr), seconds * 30);
      ldr = clamp(ldr); emit();
    },
    subscribe(fn) { listeners.add(fn); fn(getSnapshot()); return () => listeners.delete(fn); },
  };
}
