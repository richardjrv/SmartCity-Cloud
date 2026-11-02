// Cambia a "esp32" únicamente cuando el controlador y su API estén integrados.
// En modo "demo" las lecturas se generan en este navegador y nunca se guardan en Supabase.
window.SMARTCITY_SENSOR_CONFIG = Object.freeze({ mode: "demo" });

function usarDatosSimuladosSensores() {
    return window.SMARTCITY_SENSOR_CONFIG?.mode !== "esp32";
}
