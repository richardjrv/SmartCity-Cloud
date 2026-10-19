import { createParkingScene } from './scene.js';
import { createParkingController } from './controller.js';
import { createParkingRuntime } from './runtime.js';
import { bindParkingPanel } from './panel.js';

export function mountParkingSimulation(modelRoot, panelElement, visibilityTarget = document, clock) {
  const presentation = createParkingScene(modelRoot);
  const controller = createParkingController(presentation.initialSensors);
  const runtime = createParkingRuntime(controller, clock);
  const unsubscribe = controller.subscribe(presentation.apply);
  let panel;
  try { panel = bindParkingPanel(panelElement, controller, runtime); }
  catch (error) { runtime.dispose(); unsubscribe(); presentation.dispose(); throw error; }
  const onVisibility = () => visibilityTarget.hidden ? runtime.suspend() : runtime.resume();
  visibilityTarget.addEventListener('visibilitychange', onVisibility);
  if (visibilityTarget.hidden) runtime.suspend();
  let disposed = false;
  return {
    dispose() {
      if (disposed) return;
      disposed = true;
      visibilityTarget.removeEventListener('visibilitychange', onVisibility);
      runtime.dispose(); panel.dispose(); unsubscribe(); presentation.dispose();
    },
  };
}
