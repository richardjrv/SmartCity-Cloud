export function floodPanelMarkup() {
  return `<section class="environment-simulation flood-simulation" aria-label="Control de lluvia e inundaciones">
    <div class="simulation-source">Modo simulación <small>SIN CONEXIÓN FÍSICA</small></div>
    <h3>Control de lluvia e inundaciones</h3>
    <label>Modo<select data-flood-mode disabled><option value="auto">Automático · sensores virtuales</option><option value="manual">Manual · demostración</option></select></label>
    <div class="reading-row"><span>Sensor de lluvia</span><strong data-flood-rain>—</strong></div>
    <div class="reading-row"><span>Nivel de piscina</span><strong data-flood-level>—</strong></div>
    <progress data-flood-pool-progress max="100" value="0" aria-label="Nivel simulado de piscina"></progress>
    <div class="reading-row"><span>Estado del agua</span><strong data-flood-severity>—</strong></div>
    <div class="reading-row"><span>Bomba de 5 V</span><strong data-flood-pump>—</strong></div>
    <div class="reading-row"><span>Zumbador</span><strong data-flood-buzzer>—</strong></div>
    <div class="reading-row"><span>Depósito receptor</span><strong data-flood-receiver>—</strong></div>
    <progress data-flood-receiver-progress max="100" value="0" aria-label="Nivel simulado del depósito"></progress>
    <p class="flood-alert" data-flood-alert role="alert" hidden>ALERTA: NIVEL CRÍTICO DE AGUA</p>
    <p class="flood-full" data-flood-full role="status" hidden>DEPÓSITO LLENO: traslado detenido. Vacía el receptor para continuar.</p>
    <p class="simulation-message" data-flood-pump-message role="status"></p>
    <div class="simulation-actions"><button data-flood="rain-start" disabled>Iniciar lluvia</button><button data-flood="rain-stop" disabled>Detener lluvia</button></div>
    <div class="flood-manual" data-flood-manual>
      <p class="simulation-note">Controles manuales de demostración</p>
      <div class="simulation-actions"><button data-flood="increase" disabled>Subir nivel +10 %</button><button data-flood="decrease" disabled>Bajar nivel −10 %</button></div>
      <div class="simulation-actions"><button data-flood="pump" disabled>Encender bomba</button><button data-flood="empty-pool" disabled>Vaciar piscina</button></div>
    </div>
    <button class="simulation-wide" data-flood="empty-receiver" disabled>Vaciar depósito receptor</button>
    <div class="simulation-actions"><button data-flood="audio" disabled>Habilitar sonido</button><button data-flood="mute" disabled>Silenciar alarma</button></div>
    <p class="simulation-note" data-flood-audio-status>El audio necesita una interacción; habilítalo antes de probar la alerta.</p>
    <details class="simulation-settings"><summary>Umbrales y caudales virtuales</summary>
      <label>Precaución (%)<input data-flood-precaution type="number" min="1" max="99" value="60"></label>
      <label>Nivel crítico (%)<input data-flood-critical type="number" min="2" max="100" value="85"></label>
      <label>Recuperación (%)<input data-flood-recovery type="number" min="0" max="99" value="60"></label>
      <label>Aporte de lluvia (u³/s)<input data-flood-rain-rate type="number" min="0" max="1" step="0.005" value="0.055"></label>
      <label>Extracción de bomba (u³/s)<input data-flood-pump-rate type="number" min="0.005" max="2" step="0.005" value="0.20"></label>
      <button data-flood="configure" disabled>Aplicar configuración</button>
    </details>
    <p class="simulation-note">Porcentajes y caudales virtuales, sin calibración física. La lluvia no cambia el día/noche. Cambiar de modo conserva el agua. El drenaje automático se detiene al nivel de recuperación.</p>
    <p class="simulation-message" data-flood-message role="status">Preparando inundaciones…</p>
  </section>`;
}

export function bindFloodPanel(element, controller, alarm) {
  const q = selector => element.querySelector(selector), handlers = [];
  const on = (node, event, fn) => { node.addEventListener(event, fn); handlers.push(() => node.removeEventListener(event, fn)); };
  const mode = q('[data-flood-mode]');
  on(mode, 'change', () => controller.setMode(mode.value));
  const actions = {
    'rain-start': () => controller.setRain(true), 'rain-stop': () => controller.setRain(false),
    increase: () => controller.adjustPool(10), decrease: () => controller.adjustPool(-10),
    pump: () => controller.requestPump(!controller.getSnapshot().pumpOn),
    'empty-pool': () => controller.emptyPool(), 'empty-receiver': () => controller.emptyReceiver(),
    mute: () => controller.mute(), audio: () => alarm.enable(),
    configure: () => controller.configure({ precaution: Number(q('[data-flood-precaution]').value),
      critical: Number(q('[data-flood-critical]').value), recovery: Number(q('[data-flood-recovery]').value),
      rainRate: Number(q('[data-flood-rain-rate]').value), pumpRate: Number(q('[data-flood-pump-rate]').value) }),
  };
  for (const [id, fn] of Object.entries(actions)) on(q(`[data-flood="${id}"]`), 'click', () => {
    try { fn(); q('[data-flood-message]').textContent = ''; }
    catch (error) { q('[data-flood-message]').textContent = error.message; }
  });
  let last = '';
  const off = controller.subscribe(s => {
    const key = [s.mode, s.rain, s.poolPercent.toFixed(1), s.receiverPercent.toFixed(1), s.severity, s.pumpOn, s.buzzer, s.receiverFull, s.pumpBlocked, s.alertActive, s.balance.overflow > 0].join('|');
    if (key === last) return; last = key;
    mode.disabled = false; mode.value = s.mode;
    q('[data-flood-rain]').textContent = s.rain ? 'LLUVIA DETECTADA' : 'SECO';
    q('[data-flood-level]').textContent = `${s.poolPercent.toFixed(1)} %`;
    q('[data-flood-receiver]').textContent = `${s.receiverPercent.toFixed(1)} %`;
    q('[data-flood-pool-progress]').value = s.poolPercent; q('[data-flood-receiver-progress]').value = s.receiverPercent;
    q('[data-flood-severity]').textContent = { normal: 'Normal', precaution: 'Precaución', critical: 'Crítico' }[s.severity];
    element.dataset.severity = s.severity;
    q('[data-flood-alert]').hidden = !s.alertActive;
    q('[data-flood-alert]').textContent = s.severity === 'critical' ? 'ALERTA: NIVEL CRÍTICO DE AGUA'
      : 'ALERTA: NIVEL CRÍTICO DE AGUA detectado. Nivel actual en recuperación.';
    q('[data-flood-full]').hidden = !s.receiverFull;
    q('[data-flood-pump]').textContent = s.pumpOn ? 'BOMBA ENCENDIDA' : 'BOMBA APAGADA';
    q('[data-flood-buzzer]').textContent = { active: 'Activo', muted: 'Silenciado', inactive: 'Inactivo' }[s.buzzer];
    q('[data-flood-pump-message]').textContent = s.pumpOn ? 'BOMBA DE DRENAJE ACTIVADA'
      : s.pumpBlocked ? 'Bomba detenida por límite de seguridad.'
      : s.balance.overflow > 0 ? 'Se registró aporte excedente: la piscina alcanzó su capacidad máxima.' : '';
    for (const [id] of Object.entries(actions)) q(`[data-flood="${id}"]`).disabled = false;
    q('[data-flood="rain-start"]').disabled = s.rain; q('[data-flood="rain-stop"]').disabled = !s.rain;
    for (const id of ['increase', 'decrease', 'empty-pool', 'pump']) q(`[data-flood="${id}"]`).disabled = s.mode !== 'manual';
    q('[data-flood="pump"]').disabled ||= !s.pumpOn && (s.poolPercent === 0 || s.receiverFull);
    q('[data-flood="pump"]').textContent = s.pumpOn ? 'Apagar bomba' : 'Encender bomba';
    q('[data-flood="pump"]').setAttribute('aria-pressed', String(s.pumpOn));
    q('[data-flood-manual]').dataset.enabled = String(s.mode === 'manual');
    q('[data-flood="mute"]').disabled = !s.alertActive || s.muted;
  });
  function audioStatus(status) {
    q('[data-flood-audio-status]').textContent = status.error || (!status.supported ? 'Audio no disponible en este navegador.'
      : status.audible ? 'Alarma sonora activa.' : status.enabled ? 'Audio habilitado. La alarma sonará al nivel crítico.' : 'Habilita el sonido con el botón antes de probar la alerta.');
  }
  audioStatus(alarm.getStatus()); q('[data-flood-message]').textContent = '';
  return { audioStatus, dispose() {
    off(); handlers.forEach(fn => fn()); element.querySelectorAll('button, select, input').forEach(o => { o.disabled = true; });
  } };
}
