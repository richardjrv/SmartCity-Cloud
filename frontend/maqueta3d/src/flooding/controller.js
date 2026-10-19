import { FLOOD_DEFAULTS } from './config.js';
const epsilon = 1e-9;

/** Balance volumétrico virtual. En la futura etapa física se sustituirá la fuente
 * temporal por lecturas confirmadas; este controlador no representa hardware real.
 */
export function createFloodController({ poolCapacity, receiverCapacity, initialPercent = 0 }, options = {}) {
  if (![poolCapacity, receiverCapacity].every(v => Number.isFinite(v) && v > 0) ||
    !Number.isFinite(initialPercent) || initialPercent < 0 || initialPercent > 100) throw new RangeError('Capacidades o nivel inicial inválidos.');
  const listeners = new Set();
  let config = { ...FLOOD_DEFAULTS }, mode = 'auto', rain = false;
  let pool = poolCapacity * initialPercent / 100, receiver = 0;
  let automaticDemand = initialPercent >= config.critical, manualDemand = false, muted = false;
  let alertActive = initialPercent >= config.critical;
  let adjustment = 0, seconds = 0;
  const balance = { initial: pool, rain: 0, manualAdded: 0, manualRemoved: 0, drainedReceiver: 0, transferred: 0, overflow: 0 };
  function reconcile() {
    const percent = pool / poolCapacity * 100;
    if (percent >= config.critical - epsilon) { automaticDemand = true; alertActive = true; }
    if (percent <= config.recovery + epsilon) { automaticDemand = false; alertActive = false; muted = false; }
    if (pool <= epsilon || receiverCapacity - receiver <= epsilon) manualDemand = false;
  }
  function getSnapshot() {
    const poolPercent = pool / poolCapacity * 100, receiverPercent = receiver / receiverCapacity * 100;
    const severity = poolPercent >= config.critical - epsilon ? 'critical' : poolPercent >= config.precaution - epsilon ? 'precaution' : 'normal';
    const receiverFull = receiverCapacity - receiver <= epsilon;
    const pumpRequested = mode === 'auto' ? automaticDemand : manualDemand;
    const pumpOn = pumpRequested && pool > epsilon && !receiverFull;
    return { source: 'simulation', mode, rain, pool, receiver, poolCapacity, receiverCapacity, poolPercent, receiverPercent,
      severity, pumpOn, receiverFull, pumpBlocked: pumpRequested && !pumpOn, muted, alertActive,
      buzzer: alertActive ? muted ? 'muted' : 'active' : 'inactive',
      adjustment, seconds, config: { ...config }, balance: { ...balance },
    };
  }
  function emit() { reconcile(); for (const fn of listeners) fn(getSnapshot()); }
  function configure(patch) {
    if (Object.keys(patch).some(k => !Object.hasOwn(config, k))) throw new RangeError('Parámetro desconocido.');
    const next = { ...config, ...patch };
    if (!Object.values(next).every(Number.isFinite) || next.precaution <= 0 || next.critical > 100 ||
      next.precaution >= next.critical || next.recovery < 0 || next.recovery >= next.critical ||
      next.rainRate < 0 || next.rainRate > 1 || next.pumpRate <= 0 || next.pumpRate > 2 ||
      next.manualRate <= 0 || next.manualRate > 2) throw new RangeError('Umbrales inválidos: recuperación < crítico y precaución < crítico. Revisa también los caudales.');
    config = next; emit();
  }
  configure(options);
  return {
    getSnapshot, configure,
    setMode(value) {
      if (!['auto', 'manual'].includes(value)) throw new RangeError('Modo desconocido.');
      if (value !== mode) { manualDemand = false; adjustment = 0; }
      mode = value; emit();
    },
    setRain(value) {
      if (typeof value !== 'boolean') throw new TypeError('La condición de lluvia debe ser booleana.');
      rain = value; emit();
    },
    requestPump(enabled) {
      if (typeof enabled !== 'boolean') throw new TypeError('Estado de bomba inválido.');
      if (mode !== 'manual' || (enabled && (pool <= epsilon || receiverCapacity - receiver <= epsilon))) return false;
      manualDemand = enabled; emit(); return true;
    },
    adjustPool(percent) {
      if (!Number.isFinite(percent) || Math.abs(percent) > 100) throw new RangeError('Ajuste inválido.');
      if (mode !== 'manual') return false;
      adjustment = percent / 100 * poolCapacity; emit(); return true;
    },
    emptyPool() {
      if (mode !== 'manual') return false;
      balance.manualRemoved += pool; pool = 0; adjustment = 0; manualDemand = false; emit(); return true;
    },
    emptyReceiver() { balance.drainedReceiver += receiver; receiver = 0; emit(); },
    mute() { if (alertActive) muted = true; emit(); },
    advance(dt) {
      if (!Number.isFinite(dt) || dt < 0) throw new RangeError('Tiempo inválido.');
      let remaining = dt;
      // Subpasos para evaluar el encendido incluso al cruzar un umbral durante un avance largo.
      while (remaining > epsilon) {
        const step = Math.min(.05, remaining); remaining -= step; seconds += step;
        reconcile();
        const s = getSnapshot();
        const input = rain ? config.rainRate * step : 0;
        balance.rain += input;
        let added = 0;
        if (mode === 'manual' && Math.abs(adjustment) > epsilon) {
          added = Math.sign(adjustment) * Math.min(Math.abs(adjustment), config.manualRate * step);
          adjustment -= added;
          if (added >= 0) { added = Math.min(added, Math.max(0, poolCapacity - pool - input)); balance.manualAdded += added; }
          else { added = -Math.min(-added, pool); balance.manualRemoved -= added; }
        }
        const available = Math.max(0, pool + input + added);
        // En automático no extraer por debajo del nivel de recuperación.
        const drainable = mode === 'auto' ? Math.max(0, available - poolCapacity * config.recovery / 100) : available;
        const transfer = s.pumpOn ? Math.min(config.pumpRate * step, drainable, receiverCapacity - receiver) : 0;
        receiver += transfer; balance.transferred += transfer;
        const nextPool = available - transfer;
        // Lluvia extrema: contabilizar el excedente y advertir; nunca dibujar agua sobre los muros.
        balance.overflow += Math.max(0, nextPool - poolCapacity);
        pool = Math.min(poolCapacity, nextPool);
        reconcile();
      }
      emit();
    },
    subscribe(fn) { listeners.add(fn); fn(getSnapshot()); return () => listeners.delete(fn); },
  };
}
