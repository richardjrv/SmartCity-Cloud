import * as THREE from 'three';

/** Piezas nuevas en coordenadas glTF. Nunca modifica geometrías del GLB. */
export function mesh(parent, name, geometry, material, position = [0, 0, 0]) {
  const object = new THREE.Mesh(geometry, material);
  object.name = name; object.position.fromArray(position);
  object.castShadow = true; object.receiveShadow = true;
  parent.add(object); return object;
}
export const box = (parent, name, size, material, position) => mesh(parent, name, new THREE.BoxGeometry(...size), material, position);
export const cylinder = (parent, name, radius, height, material, position, top = radius) =>
  mesh(parent, name, new THREE.CylinderGeometry(top, radius, height, 12), material, position);
export function releaseGroup(group) {
  group.removeFromParent();
  const geometries = new Set(), materials = new Set();
  group.traverse(o => {
    if (o.geometry) geometries.add(o.geometry);
    for (const m of o.material ? (Array.isArray(o.material) ? o.material : [o.material]) : []) materials.add(m);
  });
  geometries.forEach(g => g.dispose()); materials.forEach(m => m.dispose());
}
export function required(root, name) {
  const object = root.getObjectByName(name);
  if (!object) throw new Error(`Falta ${name} en la maqueta aprobada.`);
  return object;
}
