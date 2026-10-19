/** Cachea el mapa del sol. Colores/intensidades no cambian la profundidad de sombras.
 * Se ejecuta en scene.onBeforeRender, después de actualizar las matrices mundiales.
 * Vigila todos los objetos que proyectan sombra, incluida la bisagra y los carros.
 */
export function createShadowCache(scene, shadowMap, sun) {
  let treeDirty = true, disposed = false, records = [];
  const watched = new Set();
  const lightMatrix = sun.matrixWorld.clone(), targetMatrix = sun.target.matrixWorld.clone();
  const projection = sun.shadow.camera.projectionMatrix.clone();
  let mapWidth = sun.shadow.mapSize.x, mapHeight = sun.shadow.mapSize.y;
  const originalAutoUpdate = shadowMap.autoUpdate;
  shadowMap.autoUpdate = false;
  shadowMap.needsUpdate = true;
  function markDirty() { treeDirty = true; }
  function unwatch() {
    watched.forEach(object => {
      object.removeEventListener('childadded', markDirty);
      object.removeEventListener('childremoved', markDirty);
    });
    watched.clear();
  }
  function rebuild() {
    unwatch(); records = [];
    scene.traverse(object => {
      watched.add(object);
      object.addEventListener('childadded', markDirty);
      object.addEventListener('childremoved', markDirty);
      if (object.isMesh || object.isLine || object.isPoints) records.push({
        object, matrix: object.matrixWorld.clone(), cast: object.castShadow,
        visible: null, geometry: object.geometry, positionVersion: -1, instanceVersion: -1,
      });
    });
    treeDirty = false;
  }
  return {
    update() {
      if (disposed) return;
      let changed = treeDirty;
      if (treeDirty) rebuild();
      sun.target.updateWorldMatrix(true, false);
      if (!lightMatrix.equals(sun.matrixWorld) || !targetMatrix.equals(sun.target.matrixWorld) ||
          !projection.equals(sun.shadow.camera.projectionMatrix) ||
          mapWidth !== sun.shadow.mapSize.x || mapHeight !== sun.shadow.mapSize.y) {
        lightMatrix.copy(sun.matrixWorld); targetMatrix.copy(sun.target.matrixWorld);
        projection.copy(sun.shadow.camera.projectionMatrix);
        mapWidth = sun.shadow.mapSize.x; mapHeight = sun.shadow.mapSize.y; changed = true;
      }
      for (const record of records) {
        const object = record.object;
        if (record.cast !== object.castShadow) { record.cast = object.castShadow; changed = true; }
        if (!object.castShadow) continue;
        let visible = true;
        for (let parent = object; parent && visible; parent = parent.parent) visible = parent.visible;
        const positionVersion = object.geometry?.attributes.position?.version ?? -1;
        const instanceVersion = object.instanceMatrix?.version ?? -1;
        if (record.visible !== visible || !record.matrix.equals(object.matrixWorld) ||
            record.geometry !== object.geometry || record.positionVersion !== positionVersion || record.instanceVersion !== instanceVersion) {
          record.visible = visible; record.matrix.copy(object.matrixWorld); record.geometry = object.geometry;
          record.positionVersion = positionVersion; record.instanceVersion = instanceVersion; changed = true;
        }
        // Mallas deformables requieren profundidad nueva aunque su matriz no cambie.
        if (visible && (object.isSkinnedMesh || object.morphTargetInfluences?.some(value => value !== 0))) changed = true;
      }
      if (changed) shadowMap.needsUpdate = true;
    },
    dispose() {
      if (disposed) return;
      disposed = true; unwatch(); records = [];
      shadowMap.autoUpdate = originalAutoUpdate;
    },
  };
}
