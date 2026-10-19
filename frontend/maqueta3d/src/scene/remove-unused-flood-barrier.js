// Conjunto independiente verificado en el GLB aprobado; no alimenta inundaciones.
// El «Receptor» es el poste que sostiene el brazo, no el depósito de agua.
export function removeUnusedFloodBarrier(root) {
  const group = root.getObjectByName('Barrera_Inundacion_Conjunto');
  const pivot = root.getObjectByName('Barrera_Inundacion_Pivote');
  const expected = new Map([
    ['Barrera_Inundacion_Conjunto', group?.parent],
    ...['Base', 'Carcasa', 'Receptor', 'Pivote'].map(part => [`Barrera_Inundacion_${part}`, group]),
    ['Barrera_Inundacion_Brazo', pivot],
    ...Array.from({ length: 9 }, (_, i) => [`Barrera_Inundacion_Franja_0${i + 1}`, pivot]),
  ]);
  const objects = [];
  group?.traverse(object => objects.push(object));
  if (!group || !pivot || group.parent?.name !== 'Ciudad_Inteligente_Interactiva' ||
      pivot.userData.control !== 'barrera_inundacion' || objects.length !== expected.size ||
      new Set(objects.map(object => object.name)).size !== expected.size ||
      objects.some(object => !expected.has(object.name) || expected.get(object.name) !== object.parent) ||
      Math.abs(pivot.position.x + 1.90) > .001 || Math.abs(pivot.position.y - 2.72) > .001 ||
      Math.abs(pivot.position.z - 3.77) > .001) {
    throw new Error('La barrera de inundación no coincide con el conjunto verificado; no se ha eliminado.');
  }
  group.removeFromParent();
  // Liberar sólo recursos exclusivos de las piezas retiradas; los compartidos siguen vivos.
  const retainedGeometry = new Set(), retainedMaterial = new Set();
  const materials = object => object.material ? (Array.isArray(object.material) ? object.material : [object.material]) : [];
  root.traverse(object => {
    if (object.geometry) retainedGeometry.add(object.geometry);
    materials(object).forEach(material => retainedMaterial.add(material));
  });
  const geometry = new Set(), material = new Set();
  objects.forEach(object => {
    if (object.geometry && !retainedGeometry.has(object.geometry)) geometry.add(object.geometry);
    materials(object).forEach(value => { if (!retainedMaterial.has(value)) material.add(value); });
  });
  geometry.forEach(value => value.dispose());
  material.forEach(value => value.dispose());
  return objects.map(object => object.name);
}
