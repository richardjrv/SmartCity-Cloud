/** Web Audio se crea y se reanuda sólo desde una interacción explícita. */
export function createFloodAlarm({ AudioContextClass = globalThis.AudioContext ?? globalThis.webkitAudioContext,
  onChange = () => {} } = {}) {
  let context, oscillator, gain, enabled = false, suspended = false, disposed = false, phase = 0;
  let audible = false, error = '', latest;
  function silence() { if (gain && context) gain.gain.setValueAtTime(0, context.currentTime); audible = false; }
  function getStatus() { return { enabled: enabled && context?.state === 'running', audible, supported: !!AudioContextClass, error }; }
  return {
    getStatus,
    async enable() {
      if (disposed) return false;
      if (!AudioContextClass) { error = 'Este navegador no ofrece Web Audio.'; onChange(getStatus()); return false; }
      try {
        if (!context) {
          context = new AudioContextClass(); gain = context.createGain(); gain.gain.value = 0;
          oscillator = context.createOscillator(); oscillator.type = 'square'; oscillator.frequency.value = 780;
          oscillator.connect(gain); gain.connect(context.destination); oscillator.start();
        }
        await context.resume();
        if (disposed) return false;
        enabled = context.state === 'running'; error = enabled ? '' : 'Pulsa Habilitar sonido para reanudar el audio.';
        onChange(getStatus()); return enabled;
      } catch { error = 'Audio bloqueado: pulsa Habilitar sonido para volver a intentarlo.'; onChange(getStatus()); return false; }
    },
    apply(state) { latest = state; if (state.buzzer !== 'active') { silence(); onChange(getStatus()); } },
    animate(dt) {
      if (disposed) return; phase += dt;
      const wasAudible = audible;
      audible = enabled && !suspended && context?.state === 'running' && latest?.buzzer === 'active';
      if (gain && context) gain.gain.setTargetAtTime(audible && phase % .8 < .3 ? .025 : 0, context.currentTime, .015);
      if (wasAudible !== audible) onChange(getStatus());
    },
    setSuspended(value) { suspended = value; if (value) silence(); onChange(getStatus()); },
    dispose() {
      if (disposed) return; disposed = true; silence();
      oscillator?.stop(); oscillator?.disconnect(); gain?.disconnect();
      context?.close().catch(() => {});
    },
  };
}
