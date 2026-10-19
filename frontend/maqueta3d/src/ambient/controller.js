import { AMBIENT_DEFAULTS, validateAmbientReading, ambientIndicators } from './config.js';

/** Demostración simplificada: sólo lee contexto, nunca ordena a otros sistemas. */
export function createAmbientController(readContext = () => ({}), options = {}) {
  const config = { ...AMBIENT_DEFAULTS, ...options };
  if (!Number.isFinite(config.sampleSeconds) || config.sampleSeconds < 2 || !Number.isInteger(config.historyLimit) || config.historyLimit < 1 || config.historyLimit > 100 ||
      !(config.temperatureLow < config.temperatureHigh) || !(config.humidityLow < config.humidityHigh) ||
      ![config.temperatureRate, config.humidityRate].every(v => Number.isFinite(v) && v > 0)) throw new RangeError('Configuración ambiental inválida.');
  let temperature = config.initialTemperature, humidity = config.initialHumidity, mode = 'auto', elapsed = 0, accumulated = 0;
  validateAmbientReading({ temperature, humidity }, config);
  const listeners = new Set(), history = [];
  function sample() {
    history.push({ elapsed, temperature, humidity, source: 'simulation' });
    if (history.length > config.historyLimit) history.shift();
  }
  sample(); // Primera lectura de esta sesión; no se precarga un historial anterior.
  function getSnapshot() {
    return { source: 'simulation', mode, temperature, humidity, elapsed, sensorStatus: 'virtual',
      ...ambientIndicators({ temperature, humidity }, config), history: history.map(value => ({ ...value })) };
  }
  const emit = () => { for (const listener of listeners) listener(getSnapshot()); };
  const approach = (value, target, step) => value + Math.sign(target - value) * Math.min(Math.abs(target - value), step);
  return {
    getSnapshot,
    setMode(value) {
      if (!['auto', 'manual'].includes(value)) throw new RangeError('Modo desconocido.');
      mode = value; accumulated = 0; emit();
    },
    setManual(patch) {
      if (mode !== 'manual') return false;
      if (Object.keys(patch).some(key => !['temperature', 'humidity'].includes(key))) throw new RangeError('Lectura desconocida.');
      const next = { temperature, humidity, ...patch }; validateAmbientReading(next, config);
      temperature = next.temperature; humidity = next.humidity; sample(); emit(); return true;
    },
    advance(seconds) {
      if (!Number.isFinite(seconds) || seconds < 0) throw new RangeError('Tiempo inválido.');
      // Paso por muestras exactas, incluso cuando una prueba avanza varios segundos.
      while (seconds > 0) {
        const step = Math.min(seconds, config.sampleSeconds - accumulated);
        elapsed += step; accumulated += step; seconds -= step;
        if (accumulated + 1e-9 < config.sampleSeconds) continue;
        accumulated = 0;
        if (mode === 'auto') {
          const context = readContext();
          const daylight = context.lighting?.dayFactor;
          const rain = context.flooding?.rain;
          const targetTemperature = Number.isFinite(daylight) ? 25 + 5 * daylight - (rain ? 1.5 : 0) : 28;
          const targetHumidity = context.flooding ? Math.min(100, 70 + 8 * (1 - (daylight ?? .5)) + (rain ? 14 : 0)) : 75;
          temperature = approach(temperature, targetTemperature, config.temperatureRate * config.sampleSeconds);
          humidity = approach(humidity, targetHumidity, config.humidityRate * config.sampleSeconds);
        }
        sample(); emit();
      }
    },
    subscribe(listener) { listeners.add(listener); listener(getSnapshot()); return () => listeners.delete(listener); },
  };
}
