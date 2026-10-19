const REFRESH_MS = 15_000;

/** Lee el endpoint autenticado del sitio anfitrión; el iframe nunca guarda ni reenvía tokens. */
export function connectParentTelemetry(controller, { intervalMs = REFRESH_MS } = {}) {
  let timer = null, stopped = false, inFlight = false;

  async function refresh() {
    if (stopped || inFlight) return;
    inFlight = true;
    try {
      if (window.parent === window || window.parent.location.origin !== window.location.origin ||
          typeof window.parent.apiFetch !== 'function') {
        controller.setTelemetryStatus('error');
        return;
      }
      const response = await window.parent.apiFetch('/sensores/maqueta', { timeoutMs: 10_000 });
      if (!response.ok) throw new Error(`API ${response.status}`);
      const result = response.data;
      if (result.estado !== 'actual' || !result.lectura) {
        controller.setTelemetryStatus(result.estado || 'error');
        return;
      }
      if (!Number.isFinite(result.lectura.temperatura) || !Number.isFinite(result.lectura.humedad)) {
        controller.setTelemetryStatus('sin_lecturas');
        return;
      }
      controller.setTelemetry(result.lectura);
    } catch (error) {
      controller.setTelemetryStatus('error');
      console.info('La estación ambiental conserva la simulación hasta recibir una lectura real.', error);
    } finally {
      inFlight = false;
    }
  }

  void refresh();
  timer = window.setInterval(refresh, intervalMs);
  return { refresh, dispose() { stopped = true; if (timer !== null) window.clearInterval(timer); } };
}
