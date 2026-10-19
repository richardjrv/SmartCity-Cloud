import { PARKING_IDS } from './sensors.js';

/** Reutiliza exclusivamente la bisagra, los vehículos y los indicadores del GLB. */
export function createParkingScene(root) {
  function required(name) {
    const object = root.getObjectByName(name);
    if (!object) throw new Error(`Falta ${name} en el modelo del parqueadero.`);
    return object;
  }
  const barrier = required('Barrera_Parqueadero_Pivote');
  const arm = required('Barrera_Brazo_Blanco');
  if (arm.parent !== barrier || barrier.userData.eje_gltf !== 'X' || barrier.userData.signo_apertura_gltf !== 1) {
    throw new Error('La bisagra del parqueadero no corresponde a la configuración verificada.');
  }
  // Resolver todo antes de modificar materiales: un GLB incompleto queda intacto.
  const slots = PARKING_IDS.map((id, index) => {
    const suffix = String(index + 1).padStart(2, '0');
    const car = required(`Auto_Parqueadero_${suffix}`);
    const sensor = required(`Sensor_HCSR04_Parqueadero_${suffix}`);
    const indicator = required(`Indicador_Ocupacion_${suffix}`);
    if (!indicator.material?.emissive || car.parent !== sensor.parent || sensor.parent !== indicator.parent) {
      throw new Error(`Los componentes de ${id} no están organizados como en el modelo aprobado.`);
    }
    return { id, car, sensor, indicator, originalMaterial: indicator.material, originalVisible: car.visible };
  });
  const originalRotation = barrier.quaternion.clone();
  const initialAngle = barrier.rotation.x;
  for (const slot of slots) {
    slot.indicator.material = slot.originalMaterial.clone();
    slot.indicator.material.name = `SIM_${slot.indicator.name}`;
  }
  const initialSensors = Object.fromEntries(slots.map(({ id, car }) => {
    let visible = true;
    for (let current = car; current; current = current.parent) visible &&= current.visible;
    return [id, visible];
  }));
  let disposed = false;
  return {
    initialSensors, slots, barrier,
    apply(snapshot) {
      if (disposed) return;
      barrier.rotation.x = initialAngle + snapshot.barrierOpen * Math.PI / 2;
      for (const { id, car, indicator } of slots) {
        // No se desplazan carros por las calles: la presencia cambia al completar el paso simulado.
        car.visible = snapshot.sensors[id];
        const color = snapshot.sensors[id] ? 0xe64336 : 0x34c66b;
        indicator.material.color.setHex(color);
        indicator.material.emissive.setHex(color);
        indicator.material.emissiveIntensity = 1.4;
      }
    },
    dispose() {
      if (disposed) return;
      disposed = true;
      barrier.quaternion.copy(originalRotation);
      for (const { car, indicator, originalMaterial, originalVisible } of slots) {
        car.visible = originalVisible;
        indicator.material.dispose();
        indicator.material = originalMaterial;
      }
    },
  };
}
