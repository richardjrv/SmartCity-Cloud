import { createTrafficController } from './controller.js';
import { createTrafficRuntime } from './runtime.js';
import { createTrafficScene } from './scene.js';
import { bindTrafficPanel } from './panel.js';

/** Composición del sistema. Una futura fuente física entregará booleanos a
 * controller.setSensors(); la lógica y el presentador no necesitan reconstruirse.
 */
export function mountTrafficSimulation(modelRoot, panelElement, visibilityTarget = document, clock) {
  const presentation = createTrafficScene(modelRoot);
  const controller = createTrafficController();
  const runtime = createTrafficRuntime(controller, clock);
  const unsubscribe = controller.subscribe(presentation.apply);
  let panel;
  try {
    panel = bindTrafficPanel(panelElement, controller, runtime);
  } catch (error) {
    runtime.dispose();
    unsubscribe();
    presentation.dispose();
    throw error;
  }
  let disposed = false;
  const onVisibility = () => {
    if (visibilityTarget.hidden && controller.getSnapshot().status === 'running') {
      runtime.pause();
      panel.showHiddenPause();
    }
  };
  visibilityTarget.addEventListener('visibilitychange', onVisibility);
  return {
    dispose() {
      if (disposed) return;
      disposed = true;
      visibilityTarget.removeEventListener('visibilitychange', onVisibility);
      runtime.dispose();
      panel.dispose();
      unsubscribe();
      presentation.dispose();
    },
  };
}
