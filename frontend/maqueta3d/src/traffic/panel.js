import { OCCUPANCY_LABELS, SCENARIOS, SENSOR_IDS, SIGNAL_GROUPS } from './config.js';

export function trafficPanelMarkup() {
  return `<div class="traffic-simulation" aria-label="Simulación de semáforos">
    <div class="traffic-source"><span class="traffic-source-dot"></span> Sensores virtuales <span>SIMULACIÓN</span></div>
    <p class="traffic-intro">Cambia la ocupación y observa cómo se reparte el tiempo de paso.</p>
    <div class="traffic-buttons" role="group" aria-label="Control de la simulación">
      <button type="button" data-traffic="start" class="traffic-primary" disabled>Iniciar</button>
      <button type="button" data-traffic="pause" disabled>Pausar</button>
      <button type="button" data-traffic="reset" title="Detener, borrar las detecciones y volver al inicio" disabled>Reiniciar</button>
    </div>
    <div class="traffic-clock"><div><strong data-traffic-status role="status" aria-live="polite">Preparando semáforos…</strong><span data-traffic-phase>Todos en rojo</span></div><div class="traffic-countdown"><output data-traffic-seconds aria-label="Tiempo restante de la fase">—</output><small>segundos</small></div></div>
    <label class="traffic-scenario-label">Situación de tráfico<select data-traffic-scenario disabled>${Object.entries(SCENARIOS).map(([id,s]) => `<option value="${id}"${id === 'none' ? ' selected' : ''}>${s.label}</option>`).join('')}<option value="custom" disabled>Prueba personalizada</option></select></label>
    <div class="traffic-streets">${['A','B'].map((group) => `
      <section class="traffic-street" aria-label="Estado de calle ${group}"><div class="traffic-street-heading"><strong>Calle ${group}</strong><span class="traffic-light-badge" data-traffic-color="${group}">En rojo</span></div>
      <small class="traffic-location">${group === 'A' ? 'Vía longitudinal · frente y fondo' : 'Vía transversal · izquierda y derecha'}</small>
      <div class="traffic-occupancy"><span data-traffic-occupancy="${group}">Sin vehículos detectados</span></div>
      <p class="traffic-turn"><span data-traffic-turn-label="${group}">Próximo verde</span><strong><span data-traffic-green="${group}">5</span> s</strong></p>
      <div class="traffic-signal-pair">${SIGNAL_GROUPS[group].map((name) => `<span data-traffic-signal="${name}" class="traffic-mini-signal" aria-label="${name.replace('_',' ')} en rojo"><b>${name.slice(-2)}</b><i data-light="red"></i><i data-light="yellow"></i><i data-light="green"></i></span>`).join('')}</div></section>`).join('')}</div>
    <p class="traffic-timing-note">Los cambios se aplican al próximo verde de cada calle. Amarillo: 2 s · Todos en rojo: 1 s.</p>
    <details class="traffic-sensor-controls"><summary>Probar sensores por separado <span aria-hidden="true">+</span></summary><div class="traffic-sensor-list">${SENSOR_IDS.map((id) => `<label class="traffic-sensor-row"><span><strong>IR-${id}</strong><small>Calle ${id[0]} · ${id[1] === '1' ? 'cerca del semáforo' : 'más alejado'}</small></span><span class="traffic-sensor-switch"><input type="checkbox" data-traffic-sensor="${id}" aria-label="Activar sensor IR-${id}" disabled><span aria-hidden="true"></span></span><span class="traffic-sensor-state" data-traffic-sensor-state="${id}">Inactivo</span></label>`).join('')}</div><p class="traffic-timing-note">Detectan presencia en dos puntos de cada entrada; no cuentan vehículos. Los carritos permanecen quietos.</p></details>
    <p class="traffic-pause-note" data-traffic-pause-note hidden>Se pausó al ocultar la pestaña. Pulsa Continuar cuando quieras.</p>
  </div>`;
}

export function bindTrafficPanel(element, controller, runtime) {
  const q = (selector) => element.querySelector(selector);
  const start = q('[data-traffic="start"]');
  const pause = q('[data-traffic="pause"]');
  const reset = q('[data-traffic="reset"]');
  const select = q('[data-traffic-scenario]');
  const status = q('[data-traffic-status]');
  const pauseNote = q('[data-traffic-pause-note]');
  const cleanups = [];
  const on = (target, event, callback) => {
    target.addEventListener(event, callback);
    cleanups.push(() => target.removeEventListener(event, callback));
  };
  const setText = (target, value) => { if (target.textContent !== String(value)) target.textContent = String(value); };
  on(start, 'click', () => { pauseNote.hidden = true; runtime.start(); });
  on(pause, 'click', () => { pauseNote.hidden = true; runtime.pause(); });
  on(reset, 'click', () => { pauseNote.hidden = true; runtime.reset(); });
  on(select, 'change', () => runtime.selectScenario(select.value));
  for (const id of SENSOR_IDS) {
    const input = q(`[data-traffic-sensor="${id}"]`);
    input.disabled = false;
    on(input, 'change', () => runtime.setSensor(id, input.checked));
  }
  select.disabled = false;
  let previousRender = null;
  let previousScenario = null;
  const unsubscribe = controller.subscribe((state) => {
    const renderKey = [state.status, state.phase, state.remainingSeconds, state.greenSecondsLocked,
      state.nextGreenSeconds.A, state.nextGreenSeconds.B, ...SENSOR_IDS.map((id) => state.sensors[id])].join('|');
    if (renderKey === previousRender) return;
    previousRender = renderKey;
    start.disabled = state.status === 'running';
    pause.disabled = state.status !== 'running';
    reset.disabled = state.status === 'idle' && !Object.values(state.sensors).some(Boolean);
    setText(start, state.status === 'paused' ? 'Continuar' : 'Iniciar');
    setText(status, { idle: 'Lista para iniciar', running: 'Simulación en marcha', paused: 'Simulación pausada' }[state.status]);
    element.dataset.simulationStatus = state.status;
    setText(q('[data-traffic-seconds]'), state.status === 'idle' ? '—' : state.remainingSeconds);
    const labels = { red: 'En rojo', yellow: 'En amarillo', green: 'En verde' };
    const phase = state.group ? `Calle ${state.group} ${labels[state.phaseColor].toLowerCase()}`
      : state.status === 'idle' ? 'Todos en rojo' : 'Todos en rojo · despeje';
    setText(q('[data-traffic-phase]'), phase);
    if (previousScenario !== state.scenario) {
      select.value = state.scenario;
      previousScenario = state.scenario;
    }
    for (const group of ['A', 'B']) {
      const color = state.signals[group];
      const badge = q(`[data-traffic-color="${group}"]`);
      badge.dataset.color = color;
      setText(badge, labels[color]);
      setText(q(`[data-traffic-occupancy="${group}"]`), OCCUPANCY_LABELS[state.occupancy[group]]);
      const greenActive = state.group === group && state.phaseColor === 'green';
      setText(q(`[data-traffic-turn-label="${group}"]`), greenActive ? 'Verde de este turno' : 'Próximo verde');
      setText(q(`[data-traffic-green="${group}"]`), greenActive ? state.greenSecondsLocked : state.nextGreenSeconds[group]);
      for (const name of SIGNAL_GROUPS[group]) {
        const mini = q(`[data-traffic-signal="${name}"]`);
        mini.dataset.color = color;
        mini.setAttribute('aria-label', `${name.replace('_', ' ')} ${labels[color].toLowerCase()}`);
      }
    }
    for (const id of SENSOR_IDS) {
      q(`[data-traffic-sensor="${id}"]`).checked = state.sensors[id];
      setText(q(`[data-traffic-sensor-state="${id}"]`), state.sensors[id] ? 'Activo' : 'Inactivo');
    }
  });
  return {
    showHiddenPause() { pauseNote.hidden = false; },
    dispose() {
      unsubscribe();
      cleanups.forEach((cleanup) => cleanup());
      element.querySelectorAll('button, input, select').forEach((control) => { control.disabled = true; });
    },
  };
}
