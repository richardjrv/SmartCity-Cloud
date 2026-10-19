import { AMBIENT_DEFAULTS } from './config.js';

export function ambientPanelMarkup() {
  return `<section class="environment-simulation final-simulation" aria-label="Estación ambiental DHT22">
    <div class="simulation-source"><strong>DATOS SIMULADOS</strong><small>SIN CONEXIÓN FÍSICA</small></div>
    <h3>Estación ambiental · DHT22</h3>
    <label>Modo<select data-ambient-mode disabled><option value="auto">Automático · contexto de la ciudad</option><option value="manual">Manual · ajustar lecturas</option></select></label>
    <div class="environment-readings"><div><span>Temperatura</span><strong data-ambient-temperature>—</strong></div><div><span>Humedad relativa</span><strong data-ambient-humidity>—</strong></div></div>
    <div class="reading-row"><span>Temperatura</span><strong data-ambient-temperature-state>—</strong></div>
    <div class="reading-row"><span>Humedad</span><strong data-ambient-humidity-state>—</strong></div>
    <div class="reading-row"><span>Sensor</span><strong data-ambient-sensor>Preparando sensor virtual…</strong></div>
    <label>Temperatura manual (°C)<input data-ambient-temperature-input type="number" min="${AMBIENT_DEFAULTS.temperatureMin}" max="${AMBIENT_DEFAULTS.temperatureMax}" step="0.1" value="28" disabled></label>
    <label>Humedad manual (%)<input data-ambient-humidity-input type="range" min="0" max="100" step="0.1" value="75" disabled></label>
    <div class="ambient-chart"><span>Temperatura · °C</span><svg data-ambient-temperature-chart viewBox="0 0 300 95" role="img" aria-label="Historial de temperatura de esta sesión"><path class="chart-grid" d="M32 12v65h254"/><polyline class="chart-line"/><circle r="3"/><text x="34" y="91" data-chart-start></text><text x="285" y="91" text-anchor="end" data-chart-end></text><text x="0" y="20" data-chart-max></text><text x="0" y="77" data-chart-min></text></svg></div>
    <div class="ambient-chart"><span>Humedad relativa · %</span><svg data-ambient-humidity-chart viewBox="0 0 300 95" role="img" aria-label="Historial de humedad de esta sesión"><path class="chart-grid" d="M32 12v65h254"/><polyline class="chart-line"/><circle r="3"/><text x="34" y="91" data-chart-start></text><text x="285" y="91" text-anchor="end" data-chart-end></text><text x="0" y="20" data-chart-max></text><text x="0" y="77" data-chart-min></text></svg></div>
    <p class="simulation-note" data-ambient-history>Sin muestras anteriores al inicio de esta sesión.</p>
    <p class="simulation-note">Lecturas cada 3 s; últimas 30 muestras. La pantalla original alterna ambiente y ciudad cada 6 s. Los umbrales y las variaciones son referencias de demostración, no diagnósticos meteorológicos.</p>
    <p class="simulation-message" data-ambient-message role="status">Preparando estación…</p>
  </section>`;
}

export function updateHistoryChart(svg, history, field) {
  const values = history.map(sample => sample[field]);
  const lower = Math.min(...values) - .5, upper = Math.max(...values) + .5;
  const start = history[0].elapsed, end = history.at(-1).elapsed;
  const points = history.map(sample => [34 + (end > start ? (sample.elapsed - start) / (end - start) : 0) * 250,
    77 - (sample[field] - lower) / (upper - lower) * 65]);
  svg.querySelector('polyline').setAttribute('points', points.map(point => point.map(v => v.toFixed(2)).join(',')).join(' '));
  svg.querySelector('circle').setAttribute('cx', points.at(-1)[0]); svg.querySelector('circle').setAttribute('cy', points.at(-1)[1]);
  for (const [name, value] of Object.entries({ start: `${start.toFixed(0)} s`, end: `${end.toFixed(0)} s`, max: upper.toFixed(1), min: lower.toFixed(1) })) svg.querySelector(`[data-chart-${name}]`).textContent = value;
  svg.dataset.samples = String(history.length);
  svg.setAttribute('aria-label', `${field === 'temperature' ? 'Temperatura' : 'Humedad'}: ${history.length} muestras reales de la simulación; última ${values.at(-1).toFixed(1)} ${field === 'temperature' ? '°C' : '%'}.`);
}

export function bindAmbientPanel(element, controller) {
  const q = selector => element.querySelector(selector), handlers = [];
  const on = (node, event, handler) => { node.addEventListener(event, handler); handlers.push(() => node.removeEventListener(event, handler)); };
  const execute = fn => { try { fn(); q('[data-ambient-message]').textContent = ''; } catch (error) { q('[data-ambient-message]').textContent = error.message; } };
  const mode = q('[data-ambient-mode]'), temperature = q('[data-ambient-temperature-input]'), humidity = q('[data-ambient-humidity-input]');
  on(mode, 'change', () => execute(() => controller.setMode(mode.value)));
  on(temperature, 'input', () => execute(() => controller.setManual({ temperature: temperature.value === '' ? NaN : Number(temperature.value) })));
  on(humidity, 'input', () => execute(() => controller.setManual({ humidity: Number(humidity.value) })));
  const off = controller.subscribe(state => {
    mode.disabled = false; mode.value = state.mode;
    temperature.disabled = humidity.disabled = state.mode !== 'manual';
    if (element.ownerDocument.activeElement !== temperature) temperature.value = state.temperature.toFixed(1);
    humidity.value = String(state.humidity);
    q('[data-ambient-temperature]').textContent = `${state.temperature.toFixed(1)} °C`;
    q('[data-ambient-humidity]').textContent = `${state.humidity.toFixed(1)} %`;
    const label = { low: 'Baja', normal: 'Dentro del rango de referencia', high: 'Elevada' };
    q('[data-ambient-temperature-state]').textContent = label[state.temperatureState];
    q('[data-ambient-humidity-state]').textContent = label[state.humidityState];
    q('[data-ambient-sensor]').textContent = 'DHT22 virtual · datos simulados';
    element.dataset.status = state.status;
    for (const field of ['temperature', 'humidity']) updateHistoryChart(q(`[data-ambient-${field}-chart]`), state.history, field);
    q('[data-ambient-history]').textContent = `${state.history.length} muestras de esta sesión · última a ${state.history.at(-1).elapsed.toFixed(1)} s`;
  });
  q('[data-ambient-message]').textContent = '';
  return { dispose() { off(); handlers.forEach(fn => fn()); element.querySelectorAll('input, select').forEach(node => { node.disabled = true; }); } };
}
