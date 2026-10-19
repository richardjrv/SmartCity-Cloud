import { PARKING_IDS } from './sensors.js';

export function parkingPanelMarkup() {
  return `<section class="parking-simulation" aria-label="Parqueadero inteligente">
    <div class="parking-source"><span>Modo simulación</span><small>SIN CONEXIÓN FÍSICA</small></div>
    <h3>Parqueadero inteligente</h3>
    <div class="reading-row"><span>Capacidad</span><strong>4 vehículos</strong></div>
    <div class="reading-row"><span>Espacios disponibles</span><strong data-parking-available>—/4</strong></div>
    <div class="reading-row"><span>Estado de la barrera</span><strong data-parking-barrier>Preparando</strong></div>
    <p class="parking-full" data-parking-full hidden>PARQUEADERO LLENO</p>
    <div class="parking-slots">${PARKING_IDS.map((id) => `<span data-parking-slot="${id}"><b>${id}</b><small>Sin lectura</small></span>`).join('')}</div>
    <p class="parking-hint">P1 a P4, de izquierda a derecha en la vista frontal.</p>
    <button class="parking-primary" data-parking="enter" disabled>Ingresar vehículo</button>
    <label class="parking-exit-label">Plaza para retirar un vehículo
      <select data-parking-selection disabled aria-label="Plaza ocupada para retirar"><option value="">Preparando plazas…</option></select>
    </label>
    <div class="parking-actions"><button data-parking="exit" disabled>Retirar vehículo</button><button data-parking="reset" disabled>Reiniciar parqueadero</button></div>
    <p class="parking-message" data-parking-message role="status" aria-live="polite">Preparando el parqueadero…</p>
  </section>`;
}

export function bindParkingPanel(element, controller, runtime) {
  const q = (selector) => element.querySelector(selector);
  const selection = q('[data-parking-selection]');
  const buttons = Object.fromEntries(['enter', 'exit', 'reset'].map((id) => [id, q(`[data-parking="${id}"]`)]));
  const handlers = {
    enter: () => runtime.enter(), exit: () => runtime.exit(selection.value), reset: () => runtime.reset(),
  };
  let previousKey = '', previousOccupancy = '', disposed = false;
  function render(state) {
    const occupancy = PARKING_IDS.map((id) => Number(state.sensors[id])).join('');
    const key = [occupancy, state.phase, state.paused, state.message].join('|');
    if (key === previousKey) return;
    previousKey = key;
    q('[data-parking-available]').textContent = `${state.available}/4`;
    q('[data-parking-barrier]').textContent = { idle: 'Cerrada', opening: 'Abriendo', passing: 'Abierta', closing: 'Cerrando' }[state.phase];
    q('[data-parking-full]').hidden = state.available !== 0;
    q('[data-parking-message]').textContent = state.paused && state.busy
      ? 'Maniobra en pausa mientras la pestaña está oculta; continuará al volver.' : state.message;
    for (const id of PARKING_IDS) {
      const slot = q(`[data-parking-slot="${id}"]`);
      slot.dataset.occupied = String(state.sensors[id]);
      slot.querySelector('small').textContent = state.sensors[id] ? 'Ocupado' : 'Libre';
    }
    if (occupancy !== previousOccupancy) {
      const selected = selection.value;
      const occupied = PARKING_IDS.filter((id) => state.sensors[id]);
      selection.innerHTML = occupied.length
        ? occupied.map((id) => `<option value="${id}">${id} · Ocupado</option>`).join('')
        : '<option value="">No hay vehículos estacionados</option>';
      selection.value = occupied.includes(selected) ? selected : (occupied[0] ?? '');
      previousOccupancy = occupancy;
    }
    buttons.enter.disabled = state.busy || state.paused;
    buttons.exit.disabled = state.busy || state.paused || state.occupied === 0;
    selection.disabled = buttons.exit.disabled;
    buttons.reset.disabled = false;
  }
  for (const [id, handler] of Object.entries(handlers)) buttons[id].addEventListener('click', handler);
  const unsubscribe = controller.subscribe(render);
  return {
    dispose() {
      if (disposed) return;
      disposed = true; unsubscribe();
      for (const [id, handler] of Object.entries(handlers)) {
        buttons[id].removeEventListener('click', handler); buttons[id].disabled = true;
      }
      selection.disabled = true;
    },
  };
}
