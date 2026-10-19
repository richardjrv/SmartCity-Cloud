/** Sólo mantiene un reloj mientras haya una maniobra; no interviene en semáforos. */
export function createParkingRuntime(controller, {
  requestFrame = (callback) => requestAnimationFrame(callback),
  cancelFrame = (id) => cancelAnimationFrame(id), now = () => performance.now(),
} = {}) {
  let frame = null, previous = 0, suspended = false, disposed = false;
  function stop() { if (frame !== null) cancelFrame(frame); frame = null; }
  function schedule() {
    if (!disposed && !suspended && frame === null && controller.getSnapshot().busy) frame = requestFrame(tick);
  }
  function tick(timestamp) {
    frame = null;
    if (disposed || suspended) return;
    // No saltar la apertura o el paso visible tras una pausa del navegador.
    controller.advance(Math.max(0, Math.min(timestamp - previous, 100)));
    previous = timestamp;
    schedule();
  }
  function request(action) {
    if (disposed || suspended) return false;
    const accepted = action();
    if (accepted) { previous = now(); schedule(); }
    return accepted;
  }
  return {
    enter: () => request(controller.requestEntry),
    exit: (slot) => request(() => controller.requestExit(slot)),
    reset() { if (disposed) return; stop(); controller.reset(); controller.setPaused(suspended); },
    suspend() { if (disposed) return; suspended = true; stop(); controller.setPaused(true); },
    resume() { if (disposed) return; suspended = false; previous = now(); controller.setPaused(false); schedule(); },
    dispose() { if (disposed) return; disposed = true; stop(); },
  };
}
