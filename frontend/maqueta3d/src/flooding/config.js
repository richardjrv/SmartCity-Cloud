// Coordenadas y volúmenes relativos de la maqueta; no son litros ni calibración física.
export const RECEIVER = Object.freeze({ center: [.2, 0, 5.6], width: 2.1, depth: 1.7,
  wall: .08, floor: .10, waterMin: .13, waterMax: .65, top: .73 });
export const FLOOD_DEFAULTS = Object.freeze({ precaution: 60, critical: 85, recovery: 60,
  rainRate: .055, pumpRate: .20, manualRate: .15 });
