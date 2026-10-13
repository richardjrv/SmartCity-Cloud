// Condiciones meteorológicas locales de Open-Meteo, sin clave API.
(() => {
    const API_URL = "https://smartcity-backend-shdc.onrender.com/api/clima/current";
    const INTERVALO_MS = 10 * 60 * 1000;
    const porId = id => document.getElementById(id);
    const panel = porId("weather-local-panel");
    if (!panel) return;

    let climaActual = null;
    let ultimaCarga = 0;
    let cargando = false;
    const numeroValido = valor => valor === null || valor === undefined || valor === "" ? null : Number(valor);

    function pintarClimaActual(datos) {
        const clima = datos.current || {};
        const ubicacion = datos.location || {};
        const condicion = clima.condition || {};
        const temperatura = numeroValido(clima.temp_c);
        const iconoNode = porId("wx-icon");
        const temperaturaNode = porId("wx-temperature");
        const condicionNode = porId("wx-condition");

        if (iconoNode) {
            const iconUrl = condicion.icon;
            iconoNode.textContent = typeof iconUrl === "string" ? iconUrl : "🌤️";
        }
        if (condicionNode) condicionNode.textContent = condicion.text || "Condición no disponible";
        if (temperaturaNode) {
            temperaturaNode.textContent = Number.isFinite(temperatura)
                ? `${new Intl.NumberFormat("es-EC", { maximumFractionDigits: 0 }).format(temperatura)}°`
                : "—°";
            temperaturaNode.setAttribute("aria-label", Number.isFinite(temperatura)
                ? `${temperatura.toFixed(1)} grados Celsius`
                : "Temperatura no disponible");
        }

        const precip = numeroValido(clima.precip_mm);
        const viento = numeroValido(clima.wind_kph);
        const humedad = numeroValido(clima.humidity);
        if (porId("wx-rain")) porId("wx-rain").textContent = Number.isFinite(precip) ? precip.toFixed(1) : "—";
        if (porId("wx-wind")) porId("wx-wind").textContent = Number.isFinite(viento) ? viento.toFixed(1) : "—";
        if (porId("wx-humidity")) porId("wx-humidity").textContent = Number.isFinite(humedad) ? String(Math.round(humedad)) : "—";

        const lugar = [ubicacion.name, ubicacion.region, ubicacion.country].filter(Boolean).join(", ");
        if (porId("header-weather-location") && lugar) {
            porId("header-weather-location").textContent = `📍 ${lugar}`;
        }
        const actualizado = porId("wx-updated");
        if (actualizado) {
            const fecha = clima.last_updated ? new Date(clima.last_updated) : null;
            actualizado.textContent = fecha && !Number.isNaN(fecha.getTime())
                ? ` · Actualizado ${new Intl.DateTimeFormat("es-EC", { hour: "2-digit", minute: "2-digit", timeZone: "America/Guayaquil" }).format(fecha)}`
                : "";
        }
    }

    async function cargarClima() {
        if (cargando) return;
        cargando = true;
        panel.classList.add("is-loading");
        const estado = porId("weather-status");
        const controller = new AbortController();
        const timeout = window.setTimeout(() => controller.abort(), 10000);
        if (estado && !climaActual) estado.textContent = "Consultando clima local…";

        try {
            const respuesta = await fetch(API_URL, {
                signal: controller.signal,
                headers: { Accept: "application/json" },
                cache: "no-store"
            });
            const datos = await respuesta.json();
            if (!respuesta.ok) throw new Error(datos.detail || `El backend respondió ${respuesta.status}`);
            if (!datos.current) throw new Error("La respuesta no contiene condiciones actuales.");

            climaActual = datos;
            ultimaCarga = Date.now();
            pintarClimaActual(datos);
            panel.classList.add("is-updated");
            window.setTimeout(() => panel.classList.remove("is-updated"), 1100);
            if (estado) estado.textContent = "Clima actualizado";
        } catch (error) {
            console.warn("No se pudo actualizar el clima local:", error);
            if (estado) estado.textContent = climaActual
                ? "Sin conexión · se conserva la última consulta"
                : "Clima temporalmente no disponible";
        } finally {
            window.clearTimeout(timeout);
            panel.classList.remove("is-loading");
            cargando = false;
        }
    }

    if ("IntersectionObserver" in window) {
        new IntersectionObserver(entradas => {
            if (entradas.some(entrada => entrada.isIntersecting)
                && Date.now() - ultimaCarga >= INTERVALO_MS) void cargarClima();
        }, { rootMargin: "120px" }).observe(panel);
    } else {
        void cargarClima();
    }

    window.setInterval(() => {
        if (!document.hidden && panel.getClientRects().length
            && Date.now() - ultimaCarga >= INTERVALO_MS) void cargarClima();
    }, 60 * 1000);
})();
