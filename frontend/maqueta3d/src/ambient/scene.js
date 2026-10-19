import { Box3, Group, MeshStandardMaterial, Vector3 } from 'three';
import { required, box, releaseGroup } from '../simulation/objects.js';
import { createEnvironmentalScreen } from './screen.js';

export function createAmbientScene(root, screenOptions) {
  if (root.getObjectByName('SIM_Estacion_Ambiental')) throw new Error('La estación ambiental ya está preparada.');
  const sensor = required(root, 'Sensor_DHT22_Estacion_Ambiental');
  const display = required(root, 'Pantalla_Display_01');
  required(root, 'Casa_Muros');
  if (sensor.userData.tipo_sensor !== 'DHT22') throw new Error('El sensor ambiental no corresponde al DHT22 original.');
  const screen = createEnvironmentalScreen(display, screenOptions);
  const group = new Group(); group.name = 'SIM_Estacion_Ambiental';
  const bounds = new Box3().setFromObject(sensor), center = bounds.getCenter(new Vector3());
  const cover = new MeshStandardMaterial({ color: 0xe6ece8, roughness: .7 });
  // Techo y dos apoyos delgados: frente, laterales y parte inferior abiertos al aire.
  box(group, 'DHT22_Cubierta_Ventilada', [.29, .022, .26], cover, [center.x, bounds.max.y + .055, bounds.min.z + .13]);
  for (const x of [center.x - .125, center.x + .125]) box(group, `DHT22_Apoyo_Cubierta_${x}`, [.015, .095, .035], cover, [x, bounds.max.y + .012, bounds.min.z + .02]);
  root.add(group);
  let disposed = false;
  return { group, sensor, display, screen,
    apply: screen.apply, animate: screen.animate,
    dispose() { if (disposed) return; disposed = true; screen.dispose(); releaseGroup(group); },
  };
}
