import { createLightingController } from './controller.js';
import { createLightingScene } from './scene.js';
import { bindLightingPanel } from './panel.js';
import { createSimulationClock } from '../simulation/clock.js';

export function mountLightingSimulation(root, element, setDaylight, visibilityTarget = document, clock) {
  const view = createLightingScene(root, setDaylight), controller = createLightingController();
  const off = controller.subscribe(view.apply);
  let panel;
  try { panel = bindLightingPanel(element, controller); }
  catch (error) { off(); view.dispose(); throw error; }
  const runtime = createSimulationClock(controller.advance, undefined, clock);
  const visible = () => visibilityTarget.hidden ? runtime.suspend() : runtime.resume();
  visibilityTarget.addEventListener('visibilitychange', visible); visible();
  let disposed = false;
  return { controller, view, dispose() {
    if (disposed) return; disposed = true;
    visibilityTarget.removeEventListener('visibilitychange', visible);
    runtime.dispose(); panel.dispose(); off(); view.dispose();
  } };
}
