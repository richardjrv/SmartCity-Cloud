import * as THREE from 'three';
import { box, cylinder, mesh, releaseGroup, required } from '../simulation/objects.js';
import { RECEIVER } from './config.js';

export function createFloodScene(root) {
  const water = required(root, 'Piscina_Superficie_Agua');
  const sensor = required(root, 'Sensor_Lluvia_01');
  const level = required(root, 'Sensor_Nivel_Agua');
  const bottom = required(root, 'Piscina_Fondo');
  const original = { position: water.position.clone(), visible: water.visible, material: water.material };
  root.updateMatrixWorld(true);
  const waterBounds = new THREE.Box3().setFromObject(water);
  const baseBounds = new THREE.Box3().setFromObject(bottom);
  const waterMin = water.userData.nivel_minimo, waterMax = water.userData.nivel_maximo;
  if (![waterMin, waterMax].every(Number.isFinite) || waterMin >= waterMax) throw new Error('Rango de agua ausente en el modelo.');
  const dimensions = waterBounds.getSize(new THREE.Vector3());
  const poolCapacity = dimensions.x * dimensions.z * (waterMax - waterMin);
  const receiverCapacity = (RECEIVER.width - 2 * RECEIVER.wall) * (RECEIVER.depth - 2 * RECEIVER.wall) * (RECEIVER.waterMax - RECEIVER.waterMin);
  const initialPercent = (waterBounds.max.y - waterMin) / (waterMax - waterMin) * 100;
  const group = new THREE.Group(); group.name = 'SIM_Inundacion_Adicional';
  const dark = new THREE.MeshStandardMaterial({ color: 0x202c32, roughness: .65 });
  const metal = new THREE.MeshStandardMaterial({ color: 0x53646b, metalness: .55, roughness: .6 });
  const stone = new THREE.MeshStandardMaterial({ color: 0xa3aaa0, roughness: .95 });
  const cream = new THREE.MeshStandardMaterial({ color: 0xc9d3d1, roughness: .85 });
  const waterMaterial = new THREE.MeshStandardMaterial({ color: 0x3ca1bf, transparent: true, opacity: .62,
    roughness: .22, metalness: .1, depthWrite: false });
  water.material = waterMaterial.clone();
  // Añadir un soporte abierto bajo la placa existente: no moverla ni cubrirla.
  const support = new THREE.Group(); support.name = 'Soporte_Sensor_Lluvia'; group.add(support);
  const boardPos = sensor.getWorldPosition(new THREE.Vector3());
  const boardY = .782;
  box(support, 'Lluvia_Plataforma_Abierta', [.38, .025, .46], metal, [boardPos.x + .09, boardY, boardPos.z]);
  for (const z of [boardPos.z - .18, boardPos.z + .18]) {
    cylinder(support, `Lluvia_Columna_${z}`, .015, boardY - .72, metal, [boardPos.x, (.72 + boardY) / 2, z]);
    // Dos patas exteriores llegan al suelo: estructura elevada visible sin mover la placa.
    cylinder(support, `Lluvia_Columna_Exterior_${z}`, .016, boardY - .04, metal, [boardPos.x + .22, (boardY + .04) / 2, z]);
    box(support, `Lluvia_Pie_${z}`, [.085, .04, .085], cream, [boardPos.x + .22, .02, z]);
  }
  // Sonda roja de pistas, colocada en el lado interior del sensor ya existente.
  const probeMat = new THREE.MeshStandardMaterial({ color: 0xa62e31, roughness: .6 });
  const copper = new THREE.MeshStandardMaterial({ color: 0xd3a46a, metalness: .55, roughness: .5 });
  const probe = new THREE.Group(); probe.name = 'Sensor_Nivel_Agua_Placa_Roja';
  probe.position.set(-1.56, .45, 5.02); probe.userData.sensor = level.name; group.add(probe);
  box(probe, 'Nivel_Placa', [.018, .42, .14], probeMat);
  for (let i = 0; i < 7; i++) box(probe, `Nivel_Pista_${i}`, [.003, .37, .006], copper, [-.011, 0, -.057 + i * .019]);
  // Mini bomba sumergible: carcasa negra, rejilla y boquilla.
  const pump = new THREE.Group(); pump.name = 'Bomba_Sumergible_5V'; pump.position.set(-1.82, baseBounds.max.y, 6.21); group.add(pump);
  box(pump, 'Bomba_Carcasa', [.25, .17, .20], dark, [0, .085, 0]);
  for (const x of [-.085, .085]) for (const z of [-.06, .06]) cylinder(pump, `Bomba_Apoyo_${x}_${z}`, .025, .025, dark, [x, .0125, z]);
  for (let i = 0; i < 5; i++) box(pump, `Bomba_Rejilla_${i}`, [.018, .09, .009], metal, [-.085 + i * .04, .08, .105]);
  cylinder(pump, 'Bomba_Boquilla', .035, .08, dark, [0, .21, 0]);
  const indicatorMaterial = new THREE.MeshStandardMaterial({ color: 0x263d32, emissive: 0x39d288, emissiveIntensity: 0 });
  const indicator = box(pump, 'Bomba_Indicador', [.035, .03, .01], indicatorMaterial, [.07, .13, .108]);
  const receiver = new THREE.Group(); receiver.name = 'Deposito_Receptor_Drenaje'; receiver.position.fromArray(RECEIVER.center); group.add(receiver);
  const w = RECEIVER.width, d = RECEIVER.depth, t = RECEIVER.wall;
  box(receiver, 'Deposito_Fondo', [w, RECEIVER.floor, d], cream, [0, RECEIVER.floor / 2, 0]);
  for (const z of [-d / 2 + t / 2, d / 2 - t / 2]) box(receiver, `Deposito_Muro_Z_${z}`, [w, RECEIVER.top - RECEIVER.floor, t], cream, [0, (RECEIVER.top + RECEIVER.floor) / 2, z]);
  for (const x of [-w / 2 + t / 2, w / 2 - t / 2]) box(receiver, `Deposito_Muro_X_${x}`, [t, RECEIVER.top - RECEIVER.floor, d - 2 * t], cream, [x, (RECEIVER.top + RECEIVER.floor) / 2, 0]);
  const stones = new THREE.InstancedMesh(new THREE.DodecahedronGeometry(.06, 0), stone, 54);
  stones.name = 'Deposito_Piedras_Decorativas'; stones.castShadow = true; stones.receiveShadow = true;
  const dummy = new THREE.Object3D();
  for (let i = 0; i < 54; i++) {
    const col = i % 9, row = Math.floor(i / 9);
    dummy.position.set(-.80 + col * .2 + .015 * Math.sin(i * 2.3), .145, -.60 + row * .24);
    dummy.rotation.set(i * .7, i * .3, .4); dummy.scale.set(1, .65, .8 + .2 * Math.cos(i)); dummy.updateMatrix();
    stones.setMatrixAt(i, dummy.matrix);
  }
  receiver.add(stones);
  const receiverWater = box(receiver, 'Deposito_Superficie_Agua', [w - 2 * t - .015, .012, d - 2 * t - .015], waterMaterial, [0, RECEIVER.waterMin, 0]);
  receiverWater.castShadow = false;
  // Spline elevada sobre el muro: la manguera no perfora la piscina.
  const path = new THREE.CatmullRomCurve3([
    new THREE.Vector3(-1.82, .42, 6.21), new THREE.Vector3(-1.82, .68, 6.21),
    new THREE.Vector3(-1.67, 1.03, 6.21), new THREE.Vector3(-1.22, 1.11, 6.21),
    new THREE.Vector3(-.64, 1.04, 6.10), new THREE.Vector3(-.34, .96, 5.97),
  ]);
  const hoseMaterial = new THREE.MeshStandardMaterial({ color: 0x3c83b6, transparent: true, opacity: .72, roughness: .28, depthWrite: false });
  mesh(group, 'Manguera_Drenaje_Flexible', new THREE.TubeGeometry(path, 40, .025, 8, false), hoseMaterial);
  const flowMat = new THREE.MeshBasicMaterial({ color: 0x8edbfa, transparent: true, opacity: .82 });
  const discharge = cylinder(group, 'Descarga_Agua_Bomba', .013, .5, flowMat, [-.34, .71, 5.97]); discharge.castShadow = false;
  const streamDots = new THREE.InstancedMesh(new THREE.SphereGeometry(.02, 6, 4), flowMat, 14); streamDots.name = 'Agua_Circulando_Manguera'; group.add(streamDots);
  const buzzer = new THREE.Group(); buzzer.name = 'Zumbador_Inundacion'; buzzer.position.set(-5.92, .72, 6.35); group.add(buzzer);
  cylinder(buzzer, 'Zumbador_Cuerpo', .065, .065, dark, [0, .033, 0]);
  cylinder(buzzer, 'Zumbador_Orificio', .018, .002, new THREE.MeshBasicMaterial({ color: 0x050708 }), [0, .066, 0]);
  const beaconMat = new THREE.MeshStandardMaterial({ color: 0xb03830, emissive: 0xff3b23, emissiveIntensity: 0 });
  const beacon = cylinder(buzzer, 'Zumbador_Testigo', .01, .004, beaconMat, [.045, .067, 0]);
  // Una sola geometría de segmentos, sin cientos de mallas ni nuevas sombras.
  const count = 420, drops = new Float32Array(count * 6), seeds = [];
  for (let i = 0; i < count; i++) seeds.push({ x: -6 + 13.2 * ((i * .61803398875) % 1),
    z: -4 + 10.7 * ((i * .41421356237) % 1), y: .9 + 6 * ((i * .73205080757) % 1), speed: 3.7 + (i % 5) * .35 });
  const rainGeometry = new THREE.BufferGeometry(); rainGeometry.setAttribute('position', new THREE.BufferAttribute(drops, 3).setUsage(THREE.DynamicDrawUsage));
  const rain = new THREE.LineSegments(rainGeometry, new THREE.LineBasicMaterial({ color: 0x87b5d2, transparent: true, opacity: .6 }));
  rain.name = 'Lluvia_Virtual_Gotas'; rain.frustumCulled = false; group.add(rain);
  root.add(group);
  let state, time = 0, disposed = false;
  function apply(snapshot) {
    if (disposed) return; state = snapshot;
    water.visible = snapshot.poolPercent > .01;
    // Sólo animar la superficie prevista para nivel_agua, sin modificar los muros.
    const worldY = waterMin + (waterMax - waterMin) * snapshot.poolPercent / 100;
    water.position.copy(original.position); water.position.y += worldY - waterBounds.max.y;
    receiverWater.position.y = RECEIVER.waterMin + (RECEIVER.waterMax - RECEIVER.waterMin) * snapshot.receiverPercent / 100;
    receiverWater.visible = snapshot.receiverPercent > .01;
    rain.visible = snapshot.rain; discharge.visible = streamDots.visible = snapshot.pumpOn;
    indicator.material.emissiveIntensity = snapshot.pumpOn ? 1.8 : 0;
    beacon.material.emissiveIntensity = snapshot.alertActive || snapshot.severity === 'critical' ? 2 : 0;
  }
  function animate(dt) {
    if (disposed || !state) return; time += dt;
    if (state.rain) {
      for (let i = 0; i < count; i++) {
        const seed = seeds[i]; seed.y -= dt * seed.speed;
        const ground = seed.z < 4 ? 2.14 : .72;
        if (seed.y < ground) seed.y = 6.8;
        const offset = i * 6;
        drops.set([seed.x, seed.y, seed.z, seed.x + .025, seed.y + .13, seed.z], offset);
      }
      rainGeometry.attributes.position.needsUpdate = true;
    }
    if (state.pumpOn) {
      const waterY = receiverWater.position.y;
      discharge.scale.y = (.96 - waterY) / .5; discharge.position.y = (.96 + waterY) / 2;
      for (let i = 0; i < 14; i++) {
        dummy.position.copy(path.getPoint((time * .33 + i / 14) % 1)); dummy.rotation.set(0, 0, 0); dummy.scale.setScalar(.7);
        dummy.updateMatrix(); streamDots.setMatrixAt(i, dummy.matrix);
      }
      streamDots.instanceMatrix.needsUpdate = true;
    }
  }
  return { group, water, receiverWater, path, poolCapacity, receiverCapacity, initialPercent, apply, animate,
    dispose() {
      if (disposed) return; disposed = true;
      water.position.copy(original.position); water.visible = original.visible; water.material.dispose(); water.material = original.material;
      releaseGroup(group);
    },
  };
}
