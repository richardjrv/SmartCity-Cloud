// Configuración compartida del sistema: el backend autoriza cambios solo al rol Operador.
const OPERATOR_CONFIG_KEY = "smartcity_operator_system_config_v1";
const OPERATOR_CONFIG_DEFAULTS = Object.freeze({
    temperatureMax: 35,
    humidityMin: 30,
    humidityMax: 70,
    airQualityMax: 100,
    refreshSeconds: 60,
    staleMinutes: 10,
    sensorLabel: "ESP32 de la maqueta",
    notificationsEnabled: true
});

function leerCacheConfiguracionSistema() {
    try {
        const value = JSON.parse(localStorage.getItem(OPERATOR_CONFIG_KEY) || "{}");
        return { ...OPERATOR_CONFIG_DEFAULTS, ...(value && typeof value === "object" ? value : {}) };
    } catch (error) {
        return { ...OPERATOR_CONFIG_DEFAULTS };
    }
}

let operatorConfigCache = leerCacheConfiguracionSistema();
let operatorConfigLoaded = false;
let operatorConfigPromise = null;
let operatorSensorTimer = null;

function obtenerConfiguracionOperador() {
    return { ...OPERATOR_CONFIG_DEFAULTS, ...operatorConfigCache };
}

function guardarCacheConfiguracionSistema(config) {
    operatorConfigCache = { ...OPERATOR_CONFIG_DEFAULTS, ...config };
    try {
        localStorage.setItem(OPERATOR_CONFIG_KEY, JSON.stringify(operatorConfigCache));
    } catch (error) {
        console.warn("No se pudo guardar una copia local de la configuración.", error);
    }
    return obtenerConfiguracionOperador();
}

async function cargarConfiguracionSistemaDesdeApi({ force = false } = {}) {
    if (operatorConfigLoaded && !force) return obtenerConfiguracionOperador();
    if (operatorConfigPromise && !force) return operatorConfigPromise;
    if (!obtenerToken()) return obtenerConfiguracionOperador();

    operatorConfigPromise = (async () => {
        const { ok, data } = await apiFetch("/api/configuracion-sistema");
        if (!ok) throw new Error(data?.detail || "No se pudo cargar la configuración compartida.");
        operatorConfigLoaded = true;
        const config = guardarCacheConfiguracionSistema(data);
        configurarMonitoreoSistema(config.refreshSeconds);
        return config;
    })();
    try {
        return await operatorConfigPromise;
    } finally {
        operatorConfigPromise = null;
    }
}

function configurarMonitoreoSistema(seconds = obtenerConfiguracionOperador().refreshSeconds) {
    if (operatorSensorTimer) clearInterval(operatorSensorTimer);
    operatorSensorTimer = null;
    const interval = Number(seconds);
    if (!obtenerToken() || ![30, 60, 300].includes(interval)) return;
    operatorSensorTimer = window.setInterval(() => {
        if (!document.hidden && obtenerToken() && typeof cargarMapaSensores === "function") {
            void cargarMapaSensores();
        }
    }, interval * 1000);
}

function detenerMonitoreoSistema() {
    if (operatorSensorTimer) clearInterval(operatorSensorTimer);
    operatorSensorTimer = null;
    operatorConfigLoaded = false;
}

async function cargarConfiguracionOperadorEnControles() {
    const status = document.getElementById("operator-config-status");
    try {
        await cargarConfiguracionSistemaDesdeApi();
        if (status) status.textContent = "Configuración compartida cargada.";
    } catch (error) {
        console.warn("Se usarán los últimos valores guardados en este navegador.", error);
        if (status) status.textContent = "No se pudo consultar la configuración compartida. Revisa la conexión con la API.";
    }
    const settings = obtenerConfiguracionOperador();
    const values = {
        "operator-temp-max": settings.temperatureMax,
        "operator-humidity-min": settings.humidityMin,
        "operator-humidity-max": settings.humidityMax,
        "operator-air-max": settings.airQualityMax,
        "operator-refresh-interval": settings.refreshSeconds,
        "operator-stale-minutes": settings.staleMinutes,
        "operator-sensor-label": settings.sensorLabel
    };
    Object.entries(values).forEach(([id, value]) => {
        const control = document.getElementById(id);
        if (control) control.value = String(value);
    });
    const notifications = document.getElementById("operator-notifications-enabled");
    if (notifications) notifications.checked = settings.notificationsEnabled !== false;
}

function leerFormularioConfiguracionOperador() {
    return {
        temperatureMax: Number(document.getElementById("operator-temp-max")?.value),
        humidityMin: Number(document.getElementById("operator-humidity-min")?.value),
        humidityMax: Number(document.getElementById("operator-humidity-max")?.value),
        airQualityMax: Number(document.getElementById("operator-air-max")?.value),
        refreshSeconds: Number(document.getElementById("operator-refresh-interval")?.value),
        staleMinutes: Number(document.getElementById("operator-stale-minutes")?.value),
        sensorLabel: String(document.getElementById("operator-sensor-label")?.value || "").trim(),
        notificationsEnabled: Boolean(document.getElementById("operator-notifications-enabled")?.checked)
    };
}

async function guardarConfiguracionOperador(event) {
    event.preventDefault();
    const form = document.getElementById("operator-config-form");
    const status = document.getElementById("operator-config-status");
    const config = leerFormularioConfiguracionOperador();
    if (!form?.reportValidity()) return;
    if (config.humidityMin >= config.humidityMax) {
        if (status) status.textContent = "La humedad mínima debe ser menor que la máxima.";
        document.getElementById("operator-humidity-min")?.focus();
        return;
    }
    if (!config.sensorLabel) {
        if (status) status.textContent = "El nombre del controlador no puede estar vacío.";
        document.getElementById("operator-sensor-label")?.focus();
        return;
    }
    if (status) status.textContent = "Guardando configuración compartida…";
    try {
        const { ok, data } = await apiFetch("/api/configuracion-sistema", {
            method: "PUT",
            body: JSON.stringify(config)
        });
        if (!ok) throw new Error(data?.detail || "La API rechazó la configuración.");
        const saved = guardarCacheConfiguracionSistema(data);
        operatorConfigLoaded = true;
        configurarMonitoreoSistema(saved.refreshSeconds);
        if (typeof cargarMapaSensores === "function") await cargarMapaSensores();
        if (status) status.textContent = "Guardada y compartida con el sistema.";
    } catch (error) {
        if (status) status.textContent = `No se pudo guardar: ${error.message}`;
    }
}

async function restablecerConfiguracionOperador() {
    const status = document.getElementById("operator-config-status");
    if (status) status.textContent = "Restaurando valores sugeridos…";
    try {
        const { ok, data } = await apiFetch("/api/configuracion-sistema", {
            method: "PUT",
            body: JSON.stringify(OPERATOR_CONFIG_DEFAULTS)
        });
        if (!ok) throw new Error(data?.detail || "La API rechazó la configuración.");
        const saved = guardarCacheConfiguracionSistema(data);
        operatorConfigLoaded = true;
        configurarMonitoreoSistema(saved.refreshSeconds);
        await cargarConfiguracionOperadorEnControles();
        if (status) status.textContent = "Valores sugeridos guardados para todos los usuarios.";
    } catch (error) {
        if (status) status.textContent = `No se pudo restaurar: ${error.message}`;
    }
}
