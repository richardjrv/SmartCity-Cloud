import { createProximityScene } from './scene.js';
import { createProximityController } from './controller.js';
import { bindProximityPanel } from './panel.js';
import { createSimulationClock } from '../simulation/clock.js';

export function mountProximitySimulation(root, element, { visibilityTarget = document, clock } = {}) {
  const view = createProximityScene(root), controller = createProximityController();
  const off = controller.subscribe(view.apply);
  let panel;
  try { panel = bindProximityPanel(element, controller); }
  catch (error) { off(); view.dispose(); throw error; }
  // La presentación de la bisagra se actualiza cada fotograma, sin otro bucle.
  const runtime = createSimulationClock(() => {}, controller.advance, clock);
  const visible = () => visibilityTarget.hidden ? runtime.suspend() : runtime.resume();
  visibilityTarget.addEventListener('visibilitychange', visible); visible();
  let disposed = false;
  return { view, controller, dispose() {
    if (disposed) return; disposed = true;
    visibilityTarget.removeEventListener('visibilitychange', visible);
    runtime.dispose(); panel.dispose(); off(); view.dispose();
  } };
}
