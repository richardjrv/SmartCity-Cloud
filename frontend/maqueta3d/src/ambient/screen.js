import { CanvasTexture, MeshBasicMaterial, SRGBColorSpace, LinearFilter } from 'three';
import { AMBIENT_DEFAULTS } from './config.js';

export function screenContent(state, context) {
  const light = context.lighting ? context.lighting.dayFactor <= .3 ? 'NOCHE' : 'DÍA' : '—';
  const flood = context.flooding;
  const source = state.source === 'telemetry' ? 'LECTURA REAL · ESP32' : 'DATOS SIMULADOS';
  return [
    ['ESTACIÓN AMBIENTAL', `TEMP: ${state.temperature.toFixed(1)} °C`, `HUM: ${state.humidity.toFixed(1)} %`, source],
    ['ESTADO DE LA CIUDAD', `LUZ: ${light}`, `LLUVIA: ${flood ? flood.rain ? 'SÍ' : 'NO' : '—'}`,
      `AGUA: ${flood ? { normal: 'NORMAL', precaution: 'PRECAUCIÓN', critical: 'CRÍTICO' }[flood.severity] : '—'}`,
      `AMBIENTE: ${state.status === 'normal' ? 'NORMAL' : 'AVISO'}`, source],
  ];
}

/** Un material y una textura durante toda la sesión; dos canvases de composición. */
export function createEnvironmentalScreen(display, { createCanvas = () => document.createElement('canvas') } = {}) {
  if (!display.geometry?.attributes.uv || display.userData.control !== 'pantalla_dinamica') throw new Error('El display original no corresponde a la pantalla verificada.');
  const canvas = createCanvas(); canvas.width = 1200; canvas.height = 640;
  const pages = [createCanvas(), createCanvas()]; pages.forEach(page => { page.width = 1200; page.height = 640; });
  const ctx = canvas.getContext('2d'), contexts = pages.map(page => page.getContext('2d'));
  if (!ctx || contexts.some(value => !value)) throw new Error('No se pudo preparar la textura de la pantalla.');
  const texture = new CanvasTexture(canvas); texture.colorSpace = SRGBColorSpace;
  // Los UV cargados desde glTF sitúan V=0 arriba, como sus texturas con flipY=false.
  texture.flipY = false;
  texture.generateMipmaps = false; texture.minFilter = LinearFilter;
  const originalMaterial = display.material;
  const material = new MeshBasicMaterial({ map: texture, toneMapped: false, side: originalMaterial.side });
  material.name = 'SIM_Pantalla_Ambiental'; display.material = material;
  let content = [], keys = ['', ''], page = 0, previous = 0, elapsed = 0, fade = AMBIENT_DEFAULTS.fadeSeconds;
  let uploadTime = 0, disposed = false;
  function paint(index, lines) {
    const c = contexts[index]; c.fillStyle = '#0b1e2a'; c.fillRect(0, 0, 1200, 640);
    c.fillStyle = '#74dbb3'; c.font = 'bold 59px sans-serif'; c.fillText(lines[0], 54, 92);
    c.fillStyle = '#f3f8fb';
    if (index === 0) {
      c.font = 'bold 113px sans-serif'; c.fillText(lines[1], 54, 285); c.fillText(lines[2], 54, 450);
    } else {
      c.font = 'bold 67px sans-serif'; for (let i = 1; i <= 4; i++) c.fillText(lines[i], 54, 145 + i * 88);
    }
    c.fillStyle = '#a7c1cc'; c.font = '35px sans-serif'; c.fillText(lines.at(-1), 54, 600);
  }
  function composite() {
    ctx.globalAlpha = 1; ctx.fillStyle = '#0b1e2a'; ctx.fillRect(0, 0, 1200, 640);
    if (fade < AMBIENT_DEFAULTS.fadeSeconds) {
      ctx.drawImage(pages[previous], 0, 0);
      ctx.globalAlpha = fade / AMBIENT_DEFAULTS.fadeSeconds; ctx.drawImage(pages[page], 0, 0); ctx.globalAlpha = 1;
    } else ctx.drawImage(pages[page], 0, 0);
    texture.needsUpdate = true;
  }
  return {
    texture, material, canvas,
    getPresentation: () => ({ page, content: content.map(lines => [...lines]), transitioning: fade < AMBIENT_DEFAULTS.fadeSeconds }),
    apply(state, context) {
      if (disposed) return;
      content = screenContent(state, context); let changed = false;
      content.forEach((lines, index) => {
        const key = lines.join('|'); if (key === keys[index]) return;
        keys[index] = key; paint(index, lines);
        if (index === page || fade < AMBIENT_DEFAULTS.fadeSeconds) changed = true;
      });
      if (changed) composite();
    },
    animate(seconds) {
      if (disposed) return;
      elapsed += seconds;
      if (elapsed >= AMBIENT_DEFAULTS.screenSeconds) {
        elapsed %= AMBIENT_DEFAULTS.screenSeconds; previous = page; page = 1 - page; fade = 0; uploadTime = 0;
      }
      if (fade >= AMBIENT_DEFAULTS.fadeSeconds) return;
      fade = Math.min(AMBIENT_DEFAULTS.fadeSeconds, fade + seconds); uploadTime += seconds;
      if (uploadTime >= .05 || fade === AMBIENT_DEFAULTS.fadeSeconds) { uploadTime = 0; composite(); }
    },
    dispose() {
      if (disposed) return; disposed = true;
      display.material = originalMaterial; texture.dispose(); material.dispose();
    },
  };
}
