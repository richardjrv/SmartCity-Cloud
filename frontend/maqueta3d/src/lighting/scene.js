import * as THREE from 'three';
import { box, cylinder, required, releaseGroup } from '../simulation/objects.js';

export const DECORATIVE_LAYOUT = Object.freeze([
  { position: [-5.13, 2.11, 1.9], support: 'Acera_Lateral_Izquierda_Frente' },
  { position: [1.4, 2.11, 3.8], support: 'Acera_Frontal_Ciudad' },
  { position: [3.7, 2.11, 3.8], support: 'Acera_Frontal_Ciudad' },
  { position: [5.8, 2.11, 1.45], support: 'Acera_Extremo_Derecho' },
]);

export function createLightingScene(root, setDaylight = () => {}) {
  const existing = Array.from({ length: 5 }, (_, i) => required(root, `Farola_0${i + 1}_Difusor`));
  const ldr = required(root, 'Sensor_LDR_Alumbrado');
  const roof = required(root, 'Casa_Techo_Interior');
  const group = new THREE.Group(); group.name = 'SIM_Alumbrado_Adicional';
  const original = existing.map(object => ({ object, material: object.material }));
  const savedLdr = { parent: ldr.parent, position: ldr.position.clone(), quaternion: ldr.quaternion.clone(), scale: ldr.scale.clone() };
  const black = new THREE.MeshStandardMaterial({ color: 0x171d22, roughness: .5, metalness: .7 });
  const bronze = new THREE.MeshStandardMaterial({ color: 0x5a4935, roughness: .55, metalness: .7 });
  const decorative = [], lights = [];
  original.forEach(({ object, material }) => { object.material = material.clone(); });
  for (let i = 0; i < 4; i++) {
    const lamp = new THREE.Group(); lamp.name = `Farola_Decorativa_0${i + 1}`;
    lamp.position.fromArray(DECORATIVE_LAYOUT[i].position); group.add(lamp);
    lamp.userData.support = DECORATIVE_LAYOUT[i].support;
    cylinder(lamp, `${lamp.name}_Base`, .12, .12, black, [0, .06, 0]);
    cylinder(lamp, `${lamp.name}_Pedestal`, .068, .2, black, [0, .22, 0], .045);
    cylinder(lamp, `${lamp.name}_Poste`, .033, 1.15, black, [0, .88, 0], .026);
    for (const y of [.35, 1.32, 1.43]) cylinder(lamp, `${lamp.name}_Collarin_${y}`, .055, .035, bronze, [0, y, 0]);
    cylinder(lamp, `${lamp.name}_Base_Linterna`, .14, .055, black, [0, 1.46, 0]);
    const glass = new THREE.MeshStandardMaterial({ color: 0xffe2ab, emissive: 0xffc678,
      emissiveIntensity: 0, roughness: .35, transparent: true, opacity: .72 });
    const lens = box(lamp, `${lamp.name}_Difusor`, [.21, .27, .21], glass, [0, 1.625, 0]);
    lens.castShadow = false; decorative.push(lens);
    for (const x of [-.118, .118]) for (const z of [-.118, .118]) {
      box(lamp, `${lamp.name}_Montante_${x}_${z}`, [.018, .30, .018], black, [x, 1.625, z]);
    }
    cylinder(lamp, `${lamp.name}_Tejado`, .19, .15, black, [0, 1.845, 0], .025);
    cylinder(lamp, `${lamp.name}_Remate`, .022, .09, black, [0, 1.96, 0], 0);
    const light = new THREE.PointLight(0xffd08b, 0, 3.6, 2);
    light.name = `${lamp.name}_Luz`; light.position.set(0, 1.60, 0); lamp.add(light);
    lights.push({ light, group: 'decorative', power: 7 });
  }
  root.updateMatrixWorld(true);
  existing.forEach((object, index) => {
    const light = new THREE.PointLight(0xffe2b3, 0, 4.4, 2);
    light.name = `SIM_Farola_0${index + 1}_Luz`;
    light.position.copy(root.worldToLocal(object.getWorldPosition(new THREE.Vector3()))); light.position.y -= .08;
    group.add(light); lights.push({ light, group: 'existing', power: 10 });
  });
  root.add(group);
  // Traslado únicamente del sensor, autorizado por el usuario. GLB y edificio intactos.
  const roofBounds = new THREE.Box3().setFromObject(roof);
  root.add(ldr);
  ldr.quaternion.identity(); ldr.scale.set(1, 1, 1);
  ldr.position.copy(root.worldToLocal(new THREE.Vector3(2.9, roofBounds.max.y + .04, -2.4)));
  let disposed = false;
  const lastGroups = { existing: null, decorative: null };
  let lastDaylight;
  return {
    group, existing, decorative, lights, ldr,
    apply(state) {
      if (disposed) return;
      if (lastDaylight !== state.dayFactor) { setDaylight(state.dayFactor); lastDaylight = state.dayFactor; }
      for (const id of ['existing', 'decorative']) {
        if (lastGroups[id] === state.groups[id]) continue;
        lastGroups[id] = state.groups[id];
        for (const object of id === 'existing' ? existing : decorative) object.material.emissiveIntensity = state.groups[id] ? (id === 'existing' ? 2.3 : 2.5) : 0;
        for (const entry of lights) if (entry.group === id) entry.light.intensity = state.groups[id] ? entry.power : 0;
      }
    },
    dispose() {
      if (disposed) return; disposed = true;
      original.forEach(({ object, material }) => { object.material.dispose(); object.material = material; });
      savedLdr.parent.add(ldr); ldr.position.copy(savedLdr.position); ldr.quaternion.copy(savedLdr.quaternion); ldr.scale.copy(savedLdr.scale);
      releaseGroup(group); setDaylight(1);
    },
  };
}
