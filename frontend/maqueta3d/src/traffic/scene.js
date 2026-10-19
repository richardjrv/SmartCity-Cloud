import { Box3, Color, Group, Mesh, MeshStandardMaterial, SphereGeometry, Vector3 } from 'three';
import { FOURTH_SIGNAL, SENSOR_LAYOUT, SIGNAL_GROUPS } from './config.js';

const COLOR_NAMES = { red: 'Roja', yellow: 'Amarilla', green: 'Verde' };
const ACTIVE_COLORS = { red: '#ff3329', yellow: '#ffc328', green: '#30ef67' };
const tolerance = 0.00003;

function getRequired(root, name) {
  const object = root.getObjectByName(name);
  if (!object) throw new Error(`No se encontró ${name} en la maqueta.`);
  return object;
}
function cloneNamed(source, newName) {
  const clone = source.clone(true);
  clone.traverse((object) => { object.name = object.name.replace(source.name, newName); });
  clone.name = newName;
  return clone;
}
function box(root, name) { return new Box3().setFromObject(getRequired(root, name)); }
function onSidewalk(bounds, sidewalk, label) {
  if (Math.abs(bounds.min.y - sidewalk.max.y) > tolerance
      || bounds.min.x < sidewalk.min.x - tolerance || bounds.max.x > sidewalk.max.x + tolerance
      || bounds.min.z < sidewalk.min.z - tolerance || bounds.max.z > sidewalk.max.z + tolerance) {
    throw new Error(`${label} no está apoyado por completo en su acera.`);
  }
}

/** Extensión aditiva del GLB en memoria. No escribe ni reemplaza el archivo. */
export function createTrafficScene(root) {
  if (root.getObjectByName('Simulacion_Semaforos')) throw new Error('Los semáforos ya fueron preparados.');
  const additions = new Group();
  additions.name = 'Simulacion_Semaforos';
  const generated = new Set();
  const sensorObjects = new Map();
  const indicators = new Map();
  const lamps = [];
  const originalMaterials = new Map();
  const ownedMaterials = new Set();
  const indicatorGeometry = new SphereGeometry(.021, 12, 8);
  let lastLightKey = null;
  let disposed = false;
  root.add(additions);

  function dispose() {
    if (disposed) return;
    disposed = true;
    for (const [object, material] of originalMaterials) object.material = material;
    for (const indicator of indicators.values()) indicator.removeFromParent();
    additions.removeFromParent();
    indicatorGeometry.dispose();
    ownedMaterials.forEach((material) => material.dispose());
  }

  try {
    const fourth = cloneNamed(getRequired(root, FOURTH_SIGNAL.template), FOURTH_SIGNAL.name);
    if (root.getObjectByName(FOURTH_SIGNAL.name)) throw new Error('Ya existe un cuarto semáforo; revisar antes de duplicarlo.');
    fourth.position.fromArray(FOURTH_SIGNAL.position);
    fourth.rotation.set(0, FOURTH_SIGNAL.yaw, 0);
    fourth.userData = { ...fourth.userData, trafficGroup: 'B', virtual: true };
    additions.add(fourth);
    fourth.traverse((object) => generated.add(object));

    // Copia de referencia antes de añadir el LED a A1; así los sensores nuevos
    // no heredan accidentalmente el indicador ni el identificador del primero.
    const template = getRequired(root, 'Sensor_IR_Via_02').clone(true);
    for (const [id, placement] of Object.entries(SENSOR_LAYOUT)) {
      const sensor = placement.existing ? getRequired(root, placement.object) : cloneNamed(template, placement.object);
      if (!placement.existing) {
        sensor.position.fromArray(placement.position);
        sensor.rotation.set(0, placement.yaw, 0);
        sensor.userData = { ...sensor.userData, id_sensor: placement.object, virtual: true, trafficSensorId: id };
        additions.add(sensor);
        sensor.traverse((object) => generated.add(object));
      }
      sensorObjects.set(id, sensor);
      const material = new MeshStandardMaterial({ color: '#4f5c50', emissive: '#000000', roughness: .35 });
      material.name = `MAT_Sensor_IR_${id}_Indicador`;
      ownedMaterials.add(material);
      const indicator = new Mesh(indicatorGeometry, material);
      indicator.name = `Sensor_IR_${id}_Indicador`;
      indicator.position.set(.053, .307, .057);
      indicator.userData.trafficSensorId = id;
      sensor.add(indicator);
      indicators.set(id, indicator);
      generated.add(indicator);
    }

    for (const [group, names] of Object.entries(SIGNAL_GROUPS)) {
      for (const signal of names) {
        for (const [color, suffix] of Object.entries(COLOR_NAMES)) {
          const object = getRequired(root, `${signal}_Luz_${suffix}`);
          if (!object.isMesh || Array.isArray(object.material)) throw new Error(`Luz no independiente: ${object.name}`);
          originalMaterials.set(object, object.material);
          const material = object.material.clone();
          material.name = `SIM_${object.name}`;
          object.material = material;
          ownedMaterials.add(material);
          lamps.push({ object, group, color, base: originalMaterials.get(object).color.clone() });
        }
      }
    }
    root.updateMatrixWorld(true);
    onSidewalk(new Box3().setFromObject(fourth), box(root, FOURTH_SIGNAL.sidewalk), fourth.name);
    for (const [id, placement] of Object.entries(SENSOR_LAYOUT)) {
      const sensor = sensorObjects.get(id);
      const bounds = new Box3().setFromObject(sensor);
      onSidewalk(bounds, box(root, placement.sidewalk), id);
      const target = new Vector3().fromArray(placement.target);
      const road = box(root, placement.road);
      if (target.x < road.min.x || target.x > road.max.x || target.z < road.min.z || target.z > road.max.z) {
        throw new Error(`El detector ${id} no observa un punto de la calzada.`);
      }
      const origin = sensor.localToWorld(new Vector3(0, .28, .054));
      const direction = new Vector3(0, 0, 1).transformDirection(sensor.matrixWorld);
      if (direction.dot(target.clone().sub(origin).normalize()) < .999) throw new Error(`Orientación incorrecta del detector ${id}.`);
    }
    const faces = {};
    for (const names of Object.values(SIGNAL_GROUPS)) {
      for (const name of names) faces[name] = new Vector3(0,0,1).transformDirection(getRequired(root, name).matrixWorld);
    }
    if (faces.Semaforo_01.dot(faces.Semaforo_02) > -.999 || faces.Semaforo_03.dot(faces.Semaforo_04) > -.999
        || Math.abs(faces.Semaforo_01.dot(faces.Semaforo_03)) > .001) {
      throw new Error('La orientación de los semáforos no corresponde a los dos ejes de la intersección.');
    }
  } catch (error) { dispose(); throw error; }

  const previousSensors = {};
  function apply(snapshot) {
    if (disposed) return;
    const key = `${snapshot.signals.A}:${snapshot.signals.B}`;
    if (lastLightKey !== key) {
      for (const { object, group, color, base } of lamps) {
        const active = snapshot.signals[group] === color;
        object.material.color.copy(base).multiplyScalar(active ? 1 : .09);
        object.material.emissive.copy(active ? new Color(ACTIVE_COLORS[color]) : new Color(0));
        object.material.emissiveIntensity = active ? 2.8 : 0;
      }
      lastLightKey = key;
    }
    for (const [id, indicator] of indicators) {
      const active = snapshot.sensors[id];
      if (previousSensors[id] === active) continue;
      indicator.material.color.set(active ? '#58ff7b' : '#4f5c50');
      indicator.material.emissive.set(active ? '#31f35d' : '#000000');
      indicator.material.emissiveIntensity = active ? 4 : 0;
      previousSensors[id] = active;
    }
  }
  return { apply, dispose, generated, sensorObjects, indicators, additions };
}
