export function lightingPanelMarkup() {
  return `<section class="environment-simulation" aria-label="Alumbrado inteligente">
    <div class="simulation-source">Modo simulación <small>SIN CONEXIÓN FÍSICA</small></div>
    <h3>Alumbrado inteligente</h3>
    <label>Modo<select data-lighting-mode disabled><option value="auto">Automático · LDR</option><option value="manual">Manual · grupos independientes</option></select></label>
    <div class="reading-row"><span>LDR virtual</span><strong data-lighting-reading>—</strong></div>
    <div class="reading-row"><span>Ambiente</span><strong data-lighting-sky>—</strong></div>
    <div class="reading-row"><span>5 postes existentes</span><strong data-lighting-existing>—</strong></div>
    <div class="reading-row"><span>4 farolas decorativas</span><strong data-lighting-decorative>—</strong></div>
    <div class="simulation-actions"><button data-lighting="existing" disabled>Encender postes</button><button data-lighting="decorative" disabled>Encender farolas</button></div>
    <label>Iluminación ambiental virtual (0–100 %)<input data-lighting-ldr type="range" min="0" max="100" value="100" disabled></label>
    <div class="simulation-actions"><button data-lighting="day" disabled>Demostrar día</button><button data-lighting="night" disabled>Demostrar noche</button></div>
    <button class="simulation-wide" data-lighting="cycle" disabled>Pausar ciclo día/noche</button>
    <details class="simulation-settings"><summary>Umbrales LDR y ciclo</summary>
      <label>Encender a ≤ (%)<input data-lighting-on type="number" min="0" max="99" value="30"></label>
      <label>Apagar a ≥ (%)<input data-lighting-off type="number" min="1" max="100" value="45"></label>
      <label>Duración del ciclo (s)<input data-lighting-period type="number" min="20" max="600" value="90"></label>
      <button data-lighting="configure" disabled>Aplicar configuración</button>
    </details>
    <p class="simulation-note">El cielo depende del LDR, incluso en modo manual. El ciclo inicia de día y cambia progresivamente; una lectura fijada pausa el ciclo.</p>
    <p class="simulation-message" data-lighting-message role="status">Preparando alumbrado…</p>
  </section>`;
}
export function bindLightingPanel(element, controller) {
  const q = selector => element.querySelector(selector), handlers = [];
  const on = (node, event, fn) => { node.addEventListener(event, fn); handlers.push(() => node.removeEventListener(event, fn)); };
  const mode = q('[data-lighting-mode]'), slider = q('[data-lighting-ldr]');
  on(mode, 'change', () => controller.setMode(mode.value));
  on(slider, 'input', () => controller.setIllumination(Number(slider.value)));
  for (const id of ['existing', 'decorative', 'day', 'night', 'cycle', 'configure']) {
    on(q(`[data-lighting="${id}"]`), 'click', () => {
      try {
        if (['existing', 'decorative'].includes(id)) controller.toggleGroup(id);
        if (id === 'day' || id === 'night') controller.setIllumination(id === 'day' ? 100 : 0);
        if (id === 'cycle') controller.setCycle(!controller.getSnapshot().cycle);
        if (id === 'configure') controller.configure({ onBelow: Number(q('[data-lighting-on]').value),
          offAbove: Number(q('[data-lighting-off]').value), cycleSeconds: Number(q('[data-lighting-period]').value) });
        q('[data-lighting-message]').textContent = '';
      } catch (error) { q('[data-lighting-message]').textContent = error.message; }
    });
  }
  let last = '';
  const off = controller.subscribe(s => {
    const key = [s.mode, Math.round(s.ldr), Math.round(s.targetLdr), s.cycle, s.groups.existing, s.groups.decorative].join('|');
    if (key === last) return; last = key;
    mode.disabled = slider.disabled = false; mode.value = s.mode; slider.value = String(Math.round(s.targetLdr));
    q('[data-lighting-reading]').textContent = `${Math.round(s.ldr)} %`;
    q('[data-lighting-sky]').textContent = s.ldr >= 65 ? 'Día' : s.ldr <= 25 ? 'Noche' : 'Transición';
    for (const id of ['existing', 'decorative']) {
      q(`[data-lighting-${id}]`).textContent = s.groups[id] ? 'Encendidas' : 'Apagadas';
      const button = q(`[data-lighting="${id}"]`); button.disabled = s.mode !== 'manual';
      button.setAttribute('aria-pressed', String(s.groups[id]));
      button.textContent = `${s.groups[id] ? 'Apagar' : 'Encender'} ${id === 'existing' ? 'postes' : 'farolas'}`;
    }
    for (const id of ['day', 'night', 'cycle', 'configure']) q(`[data-lighting="${id}"]`).disabled = false;
    q('[data-lighting="cycle"]').textContent = s.cycle ? 'Pausar ciclo día/noche' : 'Continuar ciclo día/noche';
  });
  q('[data-lighting-message]').textContent = '';
  return { dispose() { off(); handlers.forEach(fn => fn()); element.querySelectorAll('button, select, input').forEach(o => { o.disabled = true; }); } };
}
