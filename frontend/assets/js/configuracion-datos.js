// Muestra las lecturas guardadas por la API. Pueden incluir pruebas sin sensor físico.
window.SMARTCITY_SENSOR_CONFIG = Object.freeze({ mode: "esp32" });

function usarDatosSimuladosSensores() {
    return window.SMARTCITY_SENSOR_CONFIG?.mode !== "esp32";
}
