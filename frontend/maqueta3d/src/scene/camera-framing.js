import { Vector3 } from 'three';

/** Distancia que encuadra las ocho esquinas sin desplazar ni escalar la maqueta. */
export function getFramingDistance(bounds, direction, fieldOfView, aspect, margin = 1.18) {
  const center = bounds.getCenter(new Vector3());
  const right = new Vector3().crossVectors(new Vector3(0, 1, 0), direction).normalize();
  const up = new Vector3().crossVectors(direction, right).normalize();
  const tanVertical = Math.tan(fieldOfView * Math.PI / 360);
  const tanHorizontal = tanVertical * aspect;
  let distance = 0;
  for (const x of [bounds.min.x, bounds.max.x]) {
    for (const y of [bounds.min.y, bounds.max.y]) {
      for (const z of [bounds.min.z, bounds.max.z]) {
        const point = new Vector3(x, y, z).sub(center);
        distance = Math.max(distance, point.dot(direction) + margin * Math.max(
          Math.abs(point.dot(right)) / tanHorizontal,
          Math.abs(point.dot(up)) / tanVertical,
        ));
      }
    }
  }
  return distance;
}
