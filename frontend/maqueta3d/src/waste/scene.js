import { Box3, Group, MeshStandardMaterial, Vector3 } from 'three';
import { required, box, cylinder, releaseGroup } from '../simulation/objects.js';

export function createProximityScene(root) {
  if (root.getObjectByName('SIM_Basurero_Proximidad')) throw new Error('El basurero ya está preparado.');
  const bin = required(root, 'Basurero_Conjunto'), lid = required(root, 'Basurero_Tapa_Pivote');
  const cover = required(root, 'Basurero_Tapa'), body = required(root, 'Basurero_Cuerpo');
  if (lid.parent !== bin || cover.parent !== lid || !body.userData.hueco_interior) throw new Error('El contenedor no corresponde a la jerarquía verificada.');
  const saved = lid.quaternion.clone(), initialAngle = lid.rotation.x;
  const group = new Group(); group.name = 'SIM_Basurero_Proximidad';
  const blue = new MeshStandardMaterial({ color: 0x245685, roughness: .55 });
  const metal = new MeshStandardMaterial({ color: 0xb5bfc7, metalness: .7, roughness: .4 });
  const dark = new MeshStandardMaterial({ color: 0x17242c, roughness: .6 });
  const bounds = new Box3().setFromObject(body), center = bounds.getCenter(new Vector3());
  const sensor = new Group(); sensor.name = 'Sensor_Proximidad_Basurero';
  sensor.position.set(center.x, bounds.max.y - .14, bounds.max.z + .028);
  sensor.userData = { tipo_sensor: 'Proximidad virtual', direccion_deteccion: '+Z glTF; frente del contenedor', virtual: true };
  group.add(sensor);
  box(sensor, 'Proximidad_Basurero_Modulo', [.23, .085, .025], blue, [0, 0, 0]);
  for (const x of [-.068, .068]) {
    const tube = cylinder(sensor, `Proximidad_Basurero_Transductor_${x}`, .032, .034, metal, [x, 0, .03]); tube.rotation.x = Math.PI / 2;
    const face = cylinder(sensor, `Proximidad_Basurero_Cara_${x}`, .025, .003, dark, [x, 0, .048]); face.rotation.x = Math.PI / 2;
  }
  const hinge = lid.getWorldPosition(new Vector3());
  const servo = new Group(); servo.name = 'Servomotor_Tapa_Basurero'; group.add(servo);
  box(servo, 'Servo_Basurero_Carcasa', [.10, .16, .12], blue, [bounds.max.x + .095, hinge.y - .055, hinge.z]);
  const shaft = cylinder(servo, 'Servo_Basurero_Eje', .025, .10, metal, [bounds.max.x + .035, hinge.y, hinge.z]); shaft.rotation.z = Math.PI / 2;
  const horn = new Group(); horn.name = 'Servo_Basurero_Brazo'; horn.position.set(bounds.max.x + .025, hinge.y, hinge.z); servo.add(horn);
  box(horn, 'Servo_Basurero_Acople', [.02, .035, .14], dark, [0, 0, .05]);
  const indicator = box(sensor, 'Proximidad_Basurero_Indicador', [.014, .014, .008], new MeshStandardMaterial({ color: 0x587b68, emissive: 0x34c66b, emissiveIntensity: 0 }), [0, .032, .018]);
  root.add(group);
  let disposed = false, lastDetection;
  return { group, bin, lid, sensor, servo,
    apply(state) {
      if (disposed) return;
      lid.rotation.x = initialAngle - state.opening * Math.PI / 2;
      horn.rotation.x = -state.opening * Math.PI / 2;
      if (lastDetection !== state.detected) { indicator.material.emissiveIntensity = state.detected ? 1.6 : 0; lastDetection = state.detected; }
    },
    dispose() { if (disposed) return; disposed = true; lid.quaternion.copy(saved); releaseGroup(group); },
  };
}
