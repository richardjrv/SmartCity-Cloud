export function proximityPanelMarkup() {
  return `<section class="environment-simulation final-simulation" aria-label="Basurero inteligente por proximidad">
    <div class="simulation-source"><strong>DATOS SIMULADOS</strong><small>SIN CONEXIÓN FÍSICA</small></div>
    <h3>Basurero inteligente · tapa automática</h3>
    <label class="proximity-toggle"><input data-waste-detection type="checkbox" disabled> Simular mano u objeto cerca del sensor</label>
    <div class="reading-row"><span>Proximidad</span><strong data-waste-detected>—</strong></div>
    <div class="reading-row"><span>Tapa</span><strong data-waste-lid>—</strong></div>
    <div class="reading-row"><span>Espera antes de cerrar</span><strong data-waste-delay>—</strong></div>
    <p class="simulation-note">La tapa depende únicamente de la detección. Se mantiene abierta mientras la mano está cerca y cierra suavemente 3 s después de retirarla. Volver a acercarla cancela el cierre.</p>
    <p class="simulation-message" data-waste-message role="status">Preparando sensor…</p>
  </section>`;
}
export function bindProximityPanel(element, controller) {
  const q = selector => element.querySelector(selector), input = q('[data-waste-detection]');
  const change = () => controller.setDetected(Boolean(input.checked)); input.addEventListener('change', change);
  let last;
  const off = controller.subscribe(state => {
    const key = `${state.detected}|${state.phase}|${state.closeRemaining.toFixed(1)}`;
    if (key === last) return; last = key;
    input.disabled = false; input.checked = state.detected;
    q('[data-waste-detected]').textContent = state.detected ? 'Mano u objeto detectado' : 'Sin detección';
    q('[data-waste-lid]').textContent = { closed: 'Cerrada', opening: 'Abriendo', open: 'Abierta', waiting: 'Abierta · esperando', closing: 'Cerrando' }[state.phase];
    q('[data-waste-delay]').textContent = state.phase === 'waiting' ? `${state.closeRemaining.toFixed(1)} s` : '—';
    element.dataset.phase = state.phase;
  });
  q('[data-waste-message]').textContent = '';
  return { dispose() { off(); input.removeEventListener('change', change); input.disabled = true; } };
}
