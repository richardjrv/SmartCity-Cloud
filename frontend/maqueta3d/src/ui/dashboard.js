import { icon } from './icons.js';
import { trafficPanelMarkup } from '../traffic/panel.js';
import { parkingPanelMarkup } from '../parking/panel.js';
import { lightingPanelMarkup } from '../lighting/panel.js';
import { floodPanelMarkup } from '../flooding/panel.js';
import { ambientPanelMarkup } from '../ambient/panel.js';
import { proximityPanelMarkup } from '../waste/panel.js';

export function createDashboard(root, state) {
  root.innerHTML = `
    <a class="skip-link" href="#city-systems">Ir al panel de sistemas</a>
    <header class="app-header">
      <a class="brand" href="./" aria-label="Ciudad Inteligente, inicio">
        <span class="brand-mark">${icon('city')}</span>
        <span><strong>Ciudad Inteligente<span class="brand-dot">.</span></strong><small>PROYECTO UNIVERSITARIO</small></span>
      </a>
      <div class="header-center"><span class="tiny-dot"></span> EXPLORADOR 3D</div>
      <div class="header-actions">
        <span class="phase-label">Simulación local</span>
        <details class="navigation-help">
          <summary aria-label="Ayuda de navegación">${icon('help')}</summary>
          <div class="help-popover"><strong>Explora a tu ritmo</strong><p>Arrastra con el botón izquierdo para girar.</p><p>Usa la rueda para acercar o alejar.</p><p>Botón derecho para desplazar. En pantalla táctil, gira con un dedo y acerca con dos.</p><p>Con la vista enfocada: <kbd>+</kbd> <kbd>−</kbd> para zoom y <kbd>Inicio</kbd> para restablecer.</p></div>
        </details>
      </div>
    </header>
    <main class="workspace">
      <section class="explorer" aria-labelledby="explorer-title">
        <div class="explorer-heading">
          <div><div class="eyebrow"><span class="eyebrow-line"></span> UNA VISTA A NUESTRA CIUDAD</div><h1 id="explorer-title">Explora la maqueta<span>.</span></h1><p>Un proyecto conectado empieza por conocer su espacio.</p></div>
          <span class="model-badge" id="model-badge"><span class="status-dot"></span><span id="model-badge-text">Cargando modelo</span></span>
        </div>
        <div class="viewport-shell">
          <div class="viewport-topline"><span id="model-view-label">${icon('cube')} MODELO 3D</span></div>
          <div id="city-viewport" class="city-viewport" role="group" aria-labelledby="model-view-label" data-model-status="loading" aria-busy="true"></div>
          <div class="loading-overlay" id="loading-overlay" role="status" aria-live="polite">
            <div class="loading-card"><span class="loading-symbol">${icon('city')}</span><h2 id="loading-title">Preparando tu ciudad</h2><p id="loading-detail">Cargando la maqueta 3D…</p><div class="progress-track" id="progress-track"><span id="loading-progress"></span></div><button class="retry-button" id="retry-load" hidden>Volver a cargar</button></div>
          </div>
        </div>
      </section>
      <aside class="systems-panel" id="city-systems" aria-labelledby="systems-title">
        <div class="panel-heading"><div class="eyebrow">PANEL DE LA CIUDAD</div><div class="panel-title"><h2 id="systems-title">Sistemas urbanos</h2><span class="section-count">06</span></div><p>Conoce cada parte de la maqueta.</p></div>
        <div class="system-cards">
          <details class="system-card" open>
            <summary><span class="system-icon mint">${icon('traffic')}</span><span class="system-copy"><strong>Semáforos</strong><small>Movilidad y circulación</small></span><span class="card-meta">04</span>${icon('arrow','chevron')}</summary>
            <div class="card-body" data-traffic-panel>${trafficPanelMarkup()}</div>
          </details>
          <details class="system-card">
            <summary><span class="system-icon sand">${icon('lamp')}</span><span class="system-copy"><strong>Alumbrado</strong><small>Iluminación del espacio público</small></span><span class="card-meta">09</span>${icon('arrow','chevron')}</summary>
            <div class="card-body" data-lighting-panel>${lightingPanelMarkup()}</div>
          </details>
          <details class="system-card">
            <summary><span class="system-icon blue">${icon('parking')}</span><span class="system-copy"><strong>Parqueadero</strong><small>Acceso y disponibilidad</small></span><span class="card-meta">04</span>${icon('arrow','chevron')}</summary>
            <div class="card-body" data-parking-panel>${parkingPanelMarkup()}</div>
          </details>
          <details class="system-card">
            <summary><span class="system-icon aqua">${icon('water')}</span><span class="system-copy"><strong>Inundación</strong><small>Lluvia y nivel del agua</small></span>${icon('arrow','chevron')}</summary>
            <div class="card-body" data-flood-panel>${floodPanelMarkup()}</div>
          </details>
          <details class="system-card">
            <summary><span class="system-icon coral">${icon('climate')}</span><span class="system-copy"><strong>Estación ambiental</strong><small>Temperatura y humedad</small></span>${icon('arrow','chevron')}</summary>
            <div class="card-body" data-ambient-panel>${ambientPanelMarkup()}</div>
          </details>
          <details class="system-card">
            <summary><span class="system-icon sage">${icon('trash')}</span><span class="system-copy"><strong>Residuos</strong><small>Monitoreo del contenedor</small></span>${icon('arrow','chevron')}</summary>
            <div class="card-body" data-waste-panel>${proximityPanelMarkup()}</div>
          </details>
        </div>
        <div class="panel-footer">${icon('layers')}<p>Primero el espacio.<br><strong>Después, las posibilidades.</strong></p><span>01</span></div>
      </aside>
    </main>`;

  const viewport = root.querySelector('#city-viewport');
  function setProgress(progress) {
    root.querySelector('#loading-progress').style.width = `${progress == null ? 15 : Math.round(progress * 100)}%`;
    if (progress >= 1) root.querySelector('#loading-detail').textContent = 'Preparando materiales y geometría…';
  }
  function setReady(report) {
    viewport.dataset.modelStatus = 'ready';
    viewport.dataset.interactiveCount = String(report.interactiveCount);
    viewport.dataset.meshCount = String(report.meshCount);
    viewport.setAttribute('aria-busy', 'false');
    root.querySelector('#loading-overlay').hidden = true;
    root.querySelector('#model-badge').classList.add('is-ready');
    root.querySelector('#model-badge-text').textContent = 'Modelo cargado';
  }
  function setError(error) {
    viewport.dataset.modelStatus = 'error';
    viewport.setAttribute('aria-busy', 'false');
    const overlay = root.querySelector('#loading-overlay');
    overlay.hidden = false;
    overlay.setAttribute('role', 'alert');
    root.querySelector('#loading-title').textContent = 'No pudimos abrir la maqueta';
    root.querySelector('#loading-detail').textContent = error.message?.includes('contexto')
      ? error.message : 'Comprueba que el GLB está en public/models y que tu navegador tiene WebGL 2 y aceleración gráfica habilitados.';
    root.querySelector('#progress-track').hidden = true;
    root.querySelector('#retry-load').hidden = false;
    root.querySelector('#model-badge').classList.remove('is-ready');
    root.querySelector('#model-badge-text').textContent = 'Carga pendiente';
  }
  root.querySelector('#retry-load').addEventListener('click', () => window.location.reload());
  return { viewport, setProgress, setReady, setError };
}
