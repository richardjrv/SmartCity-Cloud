import { createFloodScene } from './scene.js';
import { createFloodController } from './controller.js';
import { createFloodAlarm } from './audio.js';
import { bindFloodPanel } from './panel.js';
import { createSimulationClock } from '../simulation/clock.js';

export function mountFloodSimulation(root, element, visibilityTarget = document, clock, audioOptions = {}) {
  const view = createFloodScene(root);
  const controller = createFloodController(view);
  let panel;
  const alarm = createFloodAlarm({ ...audioOptions, onChange: status => panel?.audioStatus(status) });
  const off = controller.subscribe(s => { view.apply(s); alarm.apply(s); });
  try { panel = bindFloodPanel(element, controller, alarm); }
  catch (error) { off(); alarm.dispose(); view.dispose(); throw error; }
  const runtime = createSimulationClock(controller.advance, dt => { view.animate(dt); alarm.animate(dt); }, clock);
  const visible = () => {
    alarm.setSuspended(Boolean(visibilityTarget.hidden));
    if (visibilityTarget.hidden) runtime.suspend(); else runtime.resume();
  };
  visibilityTarget.addEventListener('visibilitychange', visible); visible();
  let disposed = false;
  return { controller, view, alarm, dispose() {
    if (disposed) return; disposed = true;
    visibilityTarget.removeEventListener('visibilitychange', visible);
    runtime.dispose(); panel.dispose(); off(); alarm.dispose(); view.dispose();
  } };
}
