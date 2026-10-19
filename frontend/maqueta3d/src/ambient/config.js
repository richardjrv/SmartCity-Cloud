// Rangos de simulación del DHT22/AM2302, sin calibración ni conexión física.
export const AMBIENT_DEFAULTS = Object.freeze({
  temperatureMin: -40, temperatureMax: 80, humidityMin: 0, humidityMax: 100,
  initialTemperature: 28, initialHumidity: 75, sampleSeconds: 3, historyLimit: 30,
  temperatureLow: 18, temperatureHigh: 32, humidityLow: 40, humidityHigh: 80,
  temperatureRate: .05, humidityRate: .3, screenSeconds: 6, fadeSeconds: .4,
});
export function validateAmbientReading({ temperature, humidity }, config = AMBIENT_DEFAULTS) {
  if (!Number.isFinite(temperature) || temperature < config.temperatureMin || temperature > config.temperatureMax ||
      !Number.isFinite(humidity) || humidity < config.humidityMin || humidity > config.humidityMax) throw new RangeError('Temperatura: −40 a 80 °C; humedad: 0 a 100 %.');
}
export function ambientIndicators({ temperature, humidity }, config = AMBIENT_DEFAULTS) {
  const temperatureState = temperature < config.temperatureLow ? 'low' : temperature > config.temperatureHigh ? 'high' : 'normal';
  const humidityState = humidity < config.humidityLow ? 'low' : humidity > config.humidityHigh ? 'high' : 'normal';
  return { temperatureState, humidityState, status: temperatureState === 'normal' && humidityState === 'normal' ? 'normal' : 'notice' };
}
