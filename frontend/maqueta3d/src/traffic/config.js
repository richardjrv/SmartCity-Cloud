export const SENSOR_IDS = Object.freeze(['A1', 'A2', 'B1', 'B2']);
export const GREEN_SECONDS = Object.freeze({ none: 5, low: 7, high: 15, isolated: 7 });
export const TRAFFIC_TIMINGS = Object.freeze({ green: GREEN_SECONDS, yellow: 2, clearance: 1 });
export const SIGNAL_GROUPS = Object.freeze({
  A: Object.freeze(['Semaforo_01', 'Semaforo_02']),
  B: Object.freeze(['Semaforo_03', 'Semaforo_04']),
});
export const OCCUPANCY_LABELS = Object.freeze({
  none: 'Sin vehículos detectados', low: 'Tráfico bajo',
  high: 'Tráfico alto', isolated: 'Ocupación aislada',
});
export const SCENARIOS = Object.freeze({
  moreA: { label: 'Mayor ocupación en calle A', sensors: { A1: true, A2: true, B1: true, B2: false } },
  moreB: { label: 'Mayor ocupación en calle B', sensors: { A1: true, A2: false, B1: true, B2: true } },
  both: { label: 'Ambas calles congestionadas', sensors: { A1: true, A2: true, B1: true, B2: true } },
  none: { label: 'Sin ocupación', sensors: { A1: false, A2: false, B1: false, B2: false } },
});

// Coordenadas glTF (X, altura Y, Z): obtenidas de las aceras/calzadas del GLB.
// A entra desde el frente hacia el fondo (-Z); B desde la derecha hacia la izquierda (-X).
export const SENSOR_LAYOUT = Object.freeze({
  A1: { object: 'Sensor_IR_Via_02', existing: true, sidewalk: 'Acera_Lateral_Derecha_Frente_Fondo',
    position: [-1.86, 2.11, .10], yaw: -Math.PI / 2, target: [-2.825, 2.39, .10], road: 'Carretera_Longitudinal_Izquierda' },
  A2: { object: 'Sensor_IR_A2', existing: false, sidewalk: 'Acera_Lateral_Derecha_Frente_Fondo',
    position: [-1.96, 2.11, 1.40], yaw: -Math.PI / 2, target: [-2.825, 2.39, 1.40], road: 'Carretera_Longitudinal_Izquierda' },
  B1: { object: 'Sensor_IR_B1', existing: false, sidewalk: 'Acera_Transversal_Fondo_Derecha',
    position: [-1.12, 2.11, -2.77], yaw: 0, target: [-1.12, 2.39, -2.175], road: 'Carretera_Transversal_Tramo_Derecho' },
  B2: { object: 'Sensor_IR_B2', existing: false, sidewalk: 'Acera_Transversal_Fondo_Derecha',
    position: [-.28, 2.11, -2.77], yaw: 0, target: [-.28, 2.39, -2.175], road: 'Carretera_Transversal_Tramo_Derecho' },
});
export const FOURTH_SIGNAL = Object.freeze({
  name: 'Semaforo_04', template: 'Semaforo_01',
  position: [-5.12, 2.11, -2.77], yaw: -Math.PI / 2,
  sidewalk: 'Acera_Transversal_Fondo_Izquierda',
});
