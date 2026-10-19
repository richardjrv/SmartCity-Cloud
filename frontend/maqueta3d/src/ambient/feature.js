import { createAmbientController } from './controller.js';
import { createAmbientScene } from './scene.js';
import { bindAmbientPanel } from './panel.js';
import { createSimulationClock } from '../simulation/clock.js';

export function mountAmbientSimulation(root, element, { lighting, flooding, visibilityTarget = document, clock, screenOptions } = {}) {
  const readContext = () => ({ lighting: lighting?.getSnapshot() ?? null, flooding: flooding?.getSnapshot() ?? null });
  const view = createAmbientScene(root, screenOptions), controller = createAmbientController(readContext);
  const updateScreen = () => view.apply(controller.getSnapshot(), readContext());
  const off = [controller.subscribe(updateScreen)];
  if (lighting) off.push(lighting.subscribe(updateScreen));
  if (flooding) off.push(flooding.subscribe(updateScreen));
  let panel;
  try { panel = bindAmbientPanel(element, controller); }
  catch (error) { off.forEach(fn => fn()); view.dispose(); throw error; }
  const runtime = createSimulationClock(controller.advance, view.animate, clock);
  const visible = () => visibilityTarget.hidden ? runtime.suspend() : runtime.resume();
  visibilityTarget.addEventListener('visibilitychange', visible); visible();
  let disposed = false;
  return { controller, view, dispose() {
    if (disposed) return; disposed = true;
    visibilityTarget.removeEventListener('visibilitychange', visible);
    runtime.dispose(); panel.dispose(); off.forEach(fn => fn()); view.dispose();
  } };
}
