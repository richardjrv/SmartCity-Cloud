import { Color, MathUtils } from 'three';

/** Cambiar únicamente la iluminación del visor, sin tocar cámaras ni geometría. */
export function createDaylightEnvironment(scene, renderer, ambient, sun) {
  const daySky = new Color(0x152742), nightSky = new Color(0x0b1428);
  const daySun = new Color(0xfff5e9), nightSun = new Color(0xaec7ff);
  return value => {
    const daylight = MathUtils.clamp(value, 0, 1);
    scene.background ??= new Color();
    scene.background.copy(nightSky).lerp(daySky, daylight);
    ambient.intensity = .65 + .85 * daylight;
    sun.intensity = .25 + 2.75 * daylight;
    sun.color.copy(nightSun).lerp(daySun, daylight);
    scene.environmentIntensity = .18 + .27 * daylight;
    renderer.toneMappingExposure = 1.1 + .15 * daylight;
  };
}
