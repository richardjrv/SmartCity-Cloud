/** Reloj exclusivo de los sistemas nuevos. Congela el tiempo al ocultar la página. */
export function createSimulationClock(advance, animate = () => {}, {
  requestFrame = (fn) => requestAnimationFrame(fn), cancelFrame = (id) => cancelAnimationFrame(id),
  now = () => performance.now(),
} = {}) {
  let frame = null, previous = 0, accumulated = 0, suspended = true, disposed = false;
  function tick(time) {
    frame = null;
    if (disposed || suspended) return;
    const dt = Math.max(0, Math.min(time - previous, 100));
    previous = time;
    accumulated += dt;
    if (accumulated >= 100) { advance(accumulated / 1000); accumulated = 0; }
    animate(dt / 1000);
    frame = requestFrame(tick);
  }
  return {
    resume() {
      if (disposed || !suspended) return;
      suspended = false; previous = now(); frame = requestFrame(tick);
    },
    suspend() { suspended = true; if (frame !== null) cancelFrame(frame); frame = null; },
    dispose() { disposed = true; suspended = true; if (frame !== null) cancelFrame(frame); frame = null; },
  };
}
