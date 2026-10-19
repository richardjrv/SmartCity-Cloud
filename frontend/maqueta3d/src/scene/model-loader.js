import { GLTFLoader } from 'three/addons/loaders/GLTFLoader.js';
import { INTERACTIVE_NAMES } from '../config/model.js';
import { removeUnusedFloodBarrier } from './remove-unused-flood-barrier.js';

export async function loadCityModel(onProgress) {
  const loader = new GLTFLoader();
  const url = new URL(`../../../ciudad.glb`, import.meta.url).href;
  const gltf = await loader.loadAsync(url, (event) => {
    onProgress?.(event.lengthComputable ? event.loaded / event.total : null);
  });

  return prepareCityModel(gltf.scene);
}

// Misma preparación en navegador y pruebas, sin normalizar escala ni origen.
export function prepareCityModel(root) {
  // Retirar únicamente el IR aislado junto al carro rojo; no participa en la automatización.
  root.getObjectByName('Sensor_IR_Via_01')?.removeFromParent();
  const registry = new Map();
  for (const name of INTERACTIVE_NAMES) {
    const object = root.getObjectByName(name);
    if (!object) throw new Error(`Falta el objeto interactivo ${name}. Revisa el GLB.`);
    registry.set(name, object);
  }
  const removedObjects = removeUnusedFloodBarrier(root);
  registry.delete('Barrera_Inundacion_Pivote');
  let meshCount = 0;
  root.traverse((object) => {
    if (!object.isMesh) return;
    meshCount += 1;
    object.castShadow = object.name !== 'Piscina_Superficie_Agua';
    object.receiveShadow = true;
  });
  return { root, registry, meshCount, removedObjects };
}

