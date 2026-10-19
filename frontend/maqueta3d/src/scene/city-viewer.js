import * as THREE from 'three';
import { OrbitControls } from 'three/addons/controls/OrbitControls.js';
import { RoomEnvironment } from 'three/addons/environments/RoomEnvironment.js';
import { loadCityModel } from './model-loader.js';
import { getFramingDistance } from './camera-framing.js';
import { createDaylightEnvironment } from '../lighting/environment.js';
import { createDaylightTransition } from '../lighting/daylight-transition.js';
import { createShadowCache } from './shadow-cache.js';

/** Presentación 3D y cámara. No contiene lógica de sensores ni automatizaciones. */
export function createCityViewer(container, { onViewChange, onError } = {}) {
  const scene = new THREE.Scene();
  const renderer = new THREE.WebGLRenderer({ antialias: true, alpha: true, powerPreference: 'high-performance' });
  renderer.setPixelRatio(Math.min(window.devicePixelRatio, 2));
  renderer.outputColorSpace = THREE.SRGBColorSpace;
  renderer.toneMapping = THREE.ACESFilmicToneMapping;
  renderer.toneMappingExposure = 1.25;
  renderer.shadowMap.enabled = true;
  // Three r186 ya sustituye PCFSoft por PCF; usar directamente el filtro vigente.
  renderer.shadowMap.type = THREE.PCFShadowMap;
  renderer.setClearColor(0xf0f3ef, 0);
  const canvas = renderer.domElement;
  canvas.tabIndex = 0;
  canvas.setAttribute('aria-label', 'Maqueta 3D. Arrastra para girar; usa la rueda para acercar o alejar. También puedes usar los botones de vista.');
  container.append(canvas);

  const camera = new THREE.PerspectiveCamera(36, 1, 0.1, 150);
  const controls = new OrbitControls(camera, canvas);
  controls.enableDamping = true;
  controls.dampingFactor = 0.085;
  controls.screenSpacePanning = true;
  controls.minPolarAngle = 0.025;
  controls.maxPolarAngle = Math.PI / 2 - 0.04;
  controls.enablePan = true;
  controls.enabled = false;
  controls.addEventListener('start', () => onViewChange?.('free'));

  const environment = new RoomEnvironment();
  const generator = new THREE.PMREMGenerator(renderer);
  const environmentTarget = generator.fromScene(environment, 0.04);
  scene.environment = environmentTarget.texture;
  scene.environmentIntensity = 0.45;
  environment.dispose();
  generator.dispose();
  const ambient = new THREE.HemisphereLight(0xf4f9ff, 0x7b8c78, 1.5);
  scene.add(ambient);
  const sun = new THREE.DirectionalLight(0xfff5e9, 3.0);
  sun.position.set(-8, 17, 10);
  sun.castShadow = true;
  sun.shadow.mapSize.set(2048, 2048);
  Object.assign(sun.shadow.camera, { left: -13, right: 13, top: 13, bottom: -13, near: 0.5, far: 55 });
  sun.shadow.normalBias = 0.035;
  sun.shadow.bias = -0.0001;
  scene.add(sun);
  const shadowCache = createShadowCache(scene, renderer.shadowMap, sun);
  scene.onBeforeRender = () => shadowCache.update();
  const shell = container.closest('.viewport-shell');
  let lastEnvironment;
  const applyEnvironment = createDaylightEnvironment(scene, renderer, ambient, sun);
  const daylight = createDaylightTransition(value => {
    applyEnvironment(value);
    const environment = value <= .3 ? 'night' : 'day';
    if (shell && lastEnvironment !== environment) {
      shell.dataset.environment = environment; lastEnvironment = environment;
    }
  });

  const shadow = new THREE.Mesh(new THREE.PlaneGeometry(140, 140), new THREE.ShadowMaterial({ color: 0x536353, opacity: 0.14 }));
  shadow.name = 'Viewer_Suelo_Sombras'; // Escenografía del visor; fuera del modelo.
  shadow.rotation.x = -Math.PI / 2;
  shadow.receiveShadow = true;
  scene.add(shadow);

  const center = new THREE.Vector3();
  let radius = 8;
  let modelBounds;
  let loaded = false;
  let currentView = 'iso';
  let registry = new Map();
  let modelRoot = null;
  let disposed = false;
  const viewDirections = {
    iso: new THREE.Vector3(1.12, 0.93, 1.65).normalize(),
    top: new THREE.Vector3(0, 1, 0.001).normalize(),
    front: new THREE.Vector3(0, 0.38, 1).normalize(),
  };

  function setView(view = 'iso') {
    if (!loaded || !viewDirections[view]) return;
    currentView = view;
    // Elimina la inercia de un arrastre anterior antes de aplicar una vista fija.
    controls.enableDamping = false;
    controls.update();
    controls.target.copy(center);
    const distance = getFramingDistance(modelBounds, viewDirections[view], camera.fov, camera.aspect);
    camera.position.copy(center).addScaledVector(viewDirections[view], distance);
    camera.lookAt(center);
    controls.update();
    controls.enableDamping = true;
    onViewChange?.(view);
  }

  function resize() {
    const width = container.clientWidth;
    const height = container.clientHeight;
    if (!width || !height || disposed) return;
    const oldAspect = camera.aspect;
    camera.aspect = width / height;
    camera.updateProjectionMatrix();
    renderer.setSize(width, height);
    if (loaded && Math.abs(oldAspect - camera.aspect) > 0.06) setView(currentView);
  }
  const observer = new ResizeObserver(resize);
  observer.observe(container);
  resize();

  function zoom(factor) {
    if (!loaded) return;
    const offset = camera.position.clone().sub(controls.target);
    offset.setLength(THREE.MathUtils.clamp(offset.length() * factor, controls.minDistance, controls.maxDistance));
    camera.position.copy(controls.target).add(offset);
    controls.update();
    onViewChange?.('free');
  }

  const handleKey = (event) => {
    if (!loaded) return;
    if (event.key === '+' || event.key === '=') { event.preventDefault(); zoom(0.8); }
    if (event.key === '-') { event.preventDefault(); zoom(1.25); }
    if (event.key === 'Home') { event.preventDefault(); setView('iso'); }
  };
  const handleContextLost = (event) => {
    event.preventDefault();
    renderer.setAnimationLoop(null);
    onError?.(new Error('Se perdió el contexto gráfico. Vuelve a cargar la vista.'));
  };
  canvas.addEventListener('keydown', handleKey);
  canvas.addEventListener('webglcontextlost', handleContextLost);
  let previousFrame = null;
  renderer.setAnimationLoop(time => {
    if (document.hidden || disposed) { previousFrame = null; return; }
    daylight.update(previousFrame === null ? 0 : Math.max(0, Math.min((time - previousFrame) / 1000, .05)));
    previousFrame = time;
    controls.update();
    renderer.render(scene, camera);
  });

  async function load(onProgress) {
    const model = await loadCityModel(onProgress);
    if (disposed) return;
    scene.add(model.root);
    modelRoot = model.root;
    registry = model.registry;
    const bounds = new THREE.Box3().setFromObject(model.root);
    modelBounds = bounds;
    bounds.getCenter(center);
    radius = bounds.getBoundingSphere(new THREE.Sphere()).radius;
    shadow.position.y = bounds.min.y - 0.015;
    controls.minDistance = radius * 0.65;
    controls.maxDistance = radius * 9;
    camera.far = radius * 30;
    camera.updateProjectionMatrix();
    loaded = true;
    controls.enabled = true;
    resize();
    setView('iso');
    return { interactiveCount: registry.size, meshCount: model.meshCount };
  }

  function dispose() {
    if (disposed) return;
    disposed = true;
    renderer.setAnimationLoop(null);
    shadowCache.dispose();
    scene.onBeforeRender = () => {};
    observer.disconnect();
    controls.dispose();
    canvas.removeEventListener('keydown', handleKey);
    canvas.removeEventListener('webglcontextlost', handleContextLost);
    const geometries = new Set();
    const materials = new Set();
    const textures = new Set();
    scene.traverse((object) => {
      if (object.geometry) geometries.add(object.geometry);
      for (const material of object.material ? (Array.isArray(object.material) ? object.material : [object.material]) : []) {
        materials.add(material);
        Object.values(material).forEach((value) => { if (value?.isTexture) textures.add(value); });
      }
    });
    geometries.forEach((geometry) => geometry.dispose());
    materials.forEach((material) => material.dispose());
    textures.forEach((texture) => texture.dispose());
    environmentTarget.dispose();
    sun.shadow.dispose();
    renderer.dispose();
    canvas.remove();
    registry.clear();
  }
  function setDaylight(value) {
    if (disposed) return;
    daylight.setTarget(value);
  }
  return { load, setView, zoom, dispose, setDaylight, getModelRoot: () => modelRoot };
}
