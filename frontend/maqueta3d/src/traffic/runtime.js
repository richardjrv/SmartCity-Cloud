import { SCENARIOS } from './config.js';

/** Reloj de simulación desacoplado del controlador y del renderizado. */
export function createTrafficRuntime(controller, {
  requestFrame = (callback) => requestAnimationFrame(callback),
  cancelFrame = (id) => cancelAnimationFrame(id),
  now = () => performance.now(),
} = {}) {
  let frame = null;
  let previous = null;
  let disposed = false;
  function tick(timestamp) {
    frame = null;
    if (disposed || controller.getSnapshot().status !== 'running') return;
    // Un bloqueo del navegador no debe omitir visualmente el amarillo ni el despeje.
    controller.advance(Math.max(0, Math.min(timestamp - previous, 250)));
    previous = timestamp;
    frame = requestFrame(tick);
  }
  function stopClock() {
    if (frame !== null) cancelFrame(frame);
    frame = null;
    previous = null;
  }
  function start() {
    if (disposed || controller.getSnapshot().status === 'running') return;
    previous = now();
    controller.start();
    frame = requestFrame(tick);
  }
  function pause() { stopClock(); controller.pause(); }
  function reset() { stopClock(); controller.reset(); }
  function selectScenario(id) {
    if (!SCENARIOS[id]) throw new RangeError('Escenario desconocido.');
    controller.setSensors(SCENARIOS[id].sensors);
  }
  function setSensor(id, active) { controller.setSensors({ [id]: active }); }
  function dispose() { stopClock(); controller.pause(); disposed = true; }
  return { start, pause, reset, selectScenario, setSensor, dispose };
}
