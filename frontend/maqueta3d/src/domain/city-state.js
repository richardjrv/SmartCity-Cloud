/** Contrato de lectura para una futura API. null significa que no hay lectura.
 * No se generan valores simulados, conexiones ni cambios en los actuadores.
 */
export function createCityState() {
  return {
    source: 'unconnected',
    lastUpdated: null,
    traffic: { signals: [null, null, null, null] },
    lighting: { enabled: null },
    parking: { occupancy: [null, null, null, null], barrierOpen: null },
    flooding: { rain: null, waterLevel: null, barrierOpen: null },
    environment: { temperature: null, humidity: null },
    waste: { detected: null, lidOpen: null },
  };
}
