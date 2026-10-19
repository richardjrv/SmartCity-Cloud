import { TRAFFIC_TIMINGS, SENSOR_IDS, SCENARIOS } from './config.js';
import { getOccupancies, validateSensorPatch } from './occupancy.js';

const PHASES = Object.freeze([
  { key: 'A_GREEN', group: 'A', color: 'green' },
  { key: 'A_YELLOW', group: 'A', color: 'yellow' },
  { key: 'CLEARANCE_A', group: null, color: 'red' },
  { key: 'B_GREEN', group: 'B', color: 'green' },
  { key: 'B_YELLOW', group: 'B', color: 'yellow' },
  { key: 'CLEARANCE_B', group: null, color: 'red' },
]);

/** Máquina de estados pura. El reloj, el DOM, Three.js y la fuente de señales
 * se inyectan fuera de este módulo. Cada verde se fija al comenzar su turno.
 */
export function createTrafficController(timings = TRAFFIC_TIMINGS) {
  const config = { green: { ...timings.green }, yellow: timings.yellow, clearance: timings.clearance };
  for (const value of [config.yellow, config.clearance, ...['none', 'low', 'high', 'isolated'].map((key) => config.green[key])]) {
    if (!Number.isFinite(value) || value <= 0) throw new RangeError('Los tiempos deben ser positivos y finitos.');
  }
  const listeners = new Set();
  let sensors = { ...SCENARIOS.none.sensors };
  let status = 'idle';
  let phaseIndex = -1;
  let remainingMs = 0;
  let durationMs = 0;
  let cycle = 0;

  function snapshot() {
    const phase = PHASES[phaseIndex];
    const occupancy = getOccupancies(sensors);
    const signals = { A: 'red', B: 'red' };
    if (phase?.group) signals[phase.group] = phase.color;
    return {
      status, phase: phase?.key ?? 'READY', group: phase?.group ?? null,
      phaseColor: phase?.color ?? 'red', signals, remainingMs,
      remainingSeconds: Math.ceil(remainingMs / 1000),
      greenSecondsLocked: phase?.color === 'green' ? durationMs / 1000 : null,
      cycle, sensors: { ...sensors }, occupancy,
      nextGreenSeconds: { A: config.green[occupancy.A], B: config.green[occupancy.B] },
      scenario: Object.entries(SCENARIOS).find(([, scenario]) => SENSOR_IDS.every((id) => scenario.sensors[id] === sensors[id]))?.[0] ?? 'custom',
    };
  }
  function emit() {
    for (const listener of listeners) listener(snapshot());
  }
  function enter(index) {
    phaseIndex = index;
    const phase = PHASES[index];
    if (index === 0) cycle += 1;
    const seconds = phase.color === 'green' ? config.green[getOccupancies(sensors)[phase.group]]
      : phase.color === 'yellow' ? config.yellow : config.clearance;
    durationMs = seconds * 1000;
    remainingMs = durationMs;
  }
  function start() {
    if (status === 'running') return;
    if (status === 'idle') enter(0);
    status = 'running';
    emit();
  }
  function pause() {
    if (status !== 'running') return;
    status = 'paused';
    emit();
  }
  function reset() {
    status = 'idle';
    phaseIndex = -1;
    remainingMs = durationMs = cycle = 0;
    sensors = { ...SCENARIOS.none.sensors };
    emit();
  }
  function setSensors(patch) {
    validateSensorPatch(patch); // Validación completa antes de modificar cualquier lectura.
    sensors = { ...sensors, ...patch };
    emit();
  }
  function advance(milliseconds) {
    if (!Number.isFinite(milliseconds) || milliseconds < 0) throw new RangeError('Intervalo de reloj inválido.');
    if (status !== 'running' || milliseconds === 0) return;
    let elapsed = milliseconds;
    while (elapsed >= remainingMs) {
      elapsed -= remainingMs;
      enter((phaseIndex + 1) % PHASES.length);
    }
    remainingMs -= elapsed;
    emit();
  }
  function subscribe(listener) {
    listeners.add(listener);
    listener(snapshot());
    return () => listeners.delete(listener);
  }
  return { start, pause, reset, setSensors, advance, subscribe, getSnapshot: snapshot };
}
