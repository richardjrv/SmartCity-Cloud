import { createCityState } from './domain/city-state.js';
import { createDashboard } from './ui/dashboard.js';
import { createCityViewer } from './scene/city-viewer.js';
import { mountTrafficSimulation } from './traffic/feature.js';
import { mountParkingSimulation } from './parking/feature.js';
import { mountLightingSimulation } from './lighting/feature.js';
import { mountFloodSimulation } from './flooding/feature.js';
import { mountAmbientSimulation } from './ambient/feature.js';
import { mountProximitySimulation } from './waste/feature.js';
import { connectParentTelemetry } from './services/parent-telemetry.js';

const ui = createDashboard(document.querySelector('#app'), createCityState());
let viewer;
let trafficFeature;
let parkingFeature;
let lightingFeature;
let floodFeature;
let ambientFeature;
let wasteFeature;
let ambientTelemetry;
const SITE_THEME_STORAGE_KEY = 'smartcity_theme';
let siteTheme = 'dark';
try {
  siteTheme = localStorage.getItem(SITE_THEME_STORAGE_KEY) === 'light' ? 'light' : 'dark';
} catch (error) {
  // El visor mantiene el tema oscuro si el almacenamiento del navegador no está disponible.
}
document.documentElement.dataset.siteTheme = siteTheme;
function applySiteTheme(theme) {
  siteTheme = theme === 'light' ? 'light' : 'dark';
  document.documentElement.dataset.siteTheme = siteTheme;
  lightingFeature?.controller.setLdrReading(siteTheme === 'light' ? 100 : 0);
}
window.addEventListener('storage', (event) => {
  if (event.key === SITE_THEME_STORAGE_KEY || event.key === null) {
    applySiteTheme(event.key === null ? 'dark' : event.newValue);
  }
});
const disposeSystems = () => { ambientTelemetry?.dispose(); ambientTelemetry = null; wasteFeature?.dispose(); ambientFeature?.dispose(); floodFeature?.dispose(); lightingFeature?.dispose(); parkingFeature?.dispose(); trafficFeature?.dispose(); };
const dispose = () => { disposeSystems(); viewer?.dispose(); };
try {
  viewer = createCityViewer(ui.viewport, { onViewChange: ui.onViewChange, onError: (error) => {
    disposeSystems();
    ui.setError(error);
  } });
  ui.bindViewer(viewer);
  const report = await viewer.load(ui.setProgress);
  ui.setReady(report);
  console.info(`Modelo base cargado: ${report.meshCount} mallas y ${report.interactiveCount} objetos interactivos reconocidos.`);
  try {
    trafficFeature = mountTrafficSimulation(viewer.getModelRoot(), document.querySelector('[data-traffic-panel]'));
  } catch (error) {
    console.error('No se pudo preparar la simulación de semáforos:', error);
    document.querySelector('[data-traffic-status]').textContent = 'Semáforos no disponibles';
    document.querySelector('[data-traffic-phase]').textContent = 'Revisa la integridad del modelo con npm run check.';
  }
  try {
    parkingFeature = mountParkingSimulation(viewer.getModelRoot(), document.querySelector('[data-parking-panel]'));
  } catch (error) {
    console.error('No se pudo preparar la simulación del parqueadero:', error);
    document.querySelector('[data-parking-message]').textContent = 'Parqueadero no disponible. Revisa la integridad del modelo.';
  }
  try {
    lightingFeature = mountLightingSimulation(viewer.getModelRoot(), document.querySelector('[data-lighting-panel]'), viewer.setDaylight);
    lightingFeature.controller.setLdrReading(siteTheme === 'light' ? 100 : 0);
  } catch (error) {
    console.error('No se pudo preparar el alumbrado:', error);
    document.querySelector('[data-lighting-message]').textContent = 'Alumbrado no disponible. Revisa la integridad del modelo.';
  }
  try {
    floodFeature = mountFloodSimulation(viewer.getModelRoot(), document.querySelector('[data-flood-panel]'));
  } catch (error) {
    console.error('No se pudo preparar inundaciones:', error);
    document.querySelector('[data-flood-message]').textContent = 'Inundaciones no disponibles. Revisa la integridad del modelo.';
  }
  try {
    ambientFeature = mountAmbientSimulation(viewer.getModelRoot(), document.querySelector('[data-ambient-panel]'), {
      lighting: lightingFeature?.controller, flooding: floodFeature?.controller,
    });
    ambientTelemetry = connectParentTelemetry(ambientFeature.controller);
  } catch (error) {
    console.error('No se pudo preparar la estación ambiental:', error);
    document.querySelector('[data-ambient-message]').textContent = 'Estación ambiental no disponible. Revisa el modelo y el soporte de canvas.';
  }
  try {
    wasteFeature = mountProximitySimulation(viewer.getModelRoot(), document.querySelector('[data-waste-panel]'));
  } catch (error) {
    console.error('No se pudo preparar el basurero:', error);
    document.querySelector('[data-waste-message]').textContent = 'Basurero no disponible. Revisa la integridad del modelo.';
  }
} catch (error) {
  console.error('Error al cargar Ciudad Inteligente:', error);
  viewer?.dispose();
  ui.setError(error);
}

if (import.meta.hot) import.meta.hot.dispose(dispose);
window.addEventListener('pagehide', (event) => { if (!event.persisted) dispose(); }, { once: true });

