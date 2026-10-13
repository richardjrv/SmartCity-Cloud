// Condiciones meteorológicas locales consultadas directamente a Open-Meteo (sin clave).
(() => {
    const LATITUD = -0.4667;
    const LONGITUD = -76.9872;
    const INTERVALO_MS = 10 * 60 * 1000;
    const parametros = new URLSearchParams({
        latitude: String(LATITUD),
        longitude: String(LONGITUD),
        current: "temperature_2m,relative_humidity_2m,precipitation,apparent_temperature,weather_code,wind_speed_10m,wind_gusts_10m,uv_index",
        hourly: "precipitation_probability,precipitation,uv_index,weather_code,temperature_2m",
        forecast_days: "2",
        temperature_unit: "celsius",
        wind_speed_unit: "kmh",
        precipitation_unit: "mm",
        timezone: "America/Guayaquil"
    });
    const URL_CLIMA = `https://api.open-meteo.com/v1/forecast?${parametros}`;
    const porId = id => document.getElementById(id);
    const panel = porId("weather-local-panel");
    if (!panel) return;

    let climaActual = null;
    let ultimaCarga = 0;
    let cargaEnCurso = null;
    const numeroValido = valor => valor === null || valor === undefined || valor === "" ? null : Number(valor);

    function describirClima(codigo) {
        if (codigo === 0) return ["Despejado", "☀️"];
        if (codigo === 1) return ["Mayormente despejado", "🌤️"];
        if (codigo === 2) return ["Parcialmente nublado", "⛅"];
        if (codigo === 3) return ["Nublado", "☁️"];
        if (codigo === 45 || codigo === 48) return ["Niebla", "🌫️"];
        if (codigo >= 51 && codigo <= 57) return ["Llovizna", "🌦️"];
        if (codigo >= 61 && codigo <= 67) return ["Lluvia", "🌧️"];
        if (codigo >= 71 && codigo <= 77) return ["Nieve", "🌨️"];
        if (codigo >= 80 && codigo <= 82) return ["Chubascos", "🌧️"];
        if (codigo === 85 || codigo === 86) return ["Chubascos de nieve", "🌨️"];
        if (codigo >= 95 && codigo <= 99) return ["Tormenta", "⛈️"];
        return ["Condición variable", "🌡️"];
    }
    window.describirClimaOpenMeteo = describirClima;

    function pintarClimaActual(datos) {
        const clima = datos.current || {};
        const [condicion, icono] = describirClima(Number(clima.weather_code));
        const temperatura = numeroValido(clima.temperature_2m);
        const iconoNode = porId("wx-icon");
        const temperaturaNode = porId("wx-temperature");
        const condicionNode = porId("wx-condition");
        if (iconoNode) iconoNode.textContent = icono;
        if (condicionNode) condicionNode.textContent = condicion;
        if (temperaturaNode) {
            temperaturaNode.textContent = Number.isFinite(temperatura)
                ? `${new Intl.NumberFormat("es-EC", { maximumFractionDigits: 0 }).format(temperatura)}°`
                : "—°";
            temperaturaNode.setAttribute("aria-label", Number.isFinite(temperatura)
                ? `${temperatura.toFixed(1)} grados Celsius`
                : "Temperatura no disponible");
        }

        const precip = numeroValido(clima.precipitation);
        const viento = numeroValido(clima.wind_speed_10m);
        const rafagas = numeroValido(clima.wind_gusts_10m);
        const humedad = numeroValido(clima.relative_humidity_2m);
        const sensacion = numeroValido(clima.apparent_temperature);
        const uv = numeroValido(clima.uv_index);
        const indiceHora = datos.hourly?.time?.indexOf(clima.time) ?? -1;
        const probabilidadPronostico = numeroValido(indiceHora >= 0 ? datos.hourly?.precipitation_probability?.[indiceHora] : null);
        const uvPronostico = numeroValido(indiceHora >= 0 ? datos.hourly?.uv_index?.[indiceHora] : null);
        if (porId("wx-rain")) porId("wx-rain").textContent = Number.isFinite(precip) ? precip.toFixed(1) : "—";
        if (porId("wx-rain-probability")) porId("wx-rain-probability").textContent = Number.isFinite(probabilidadPronostico) ? `${Math.round(probabilidadPronostico)}` : "—";
        if (porId("wx-wind")) porId("wx-wind").textContent = Number.isFinite(viento) ? viento.toFixed(1) : "—";
        if (porId("wx-wind-gusts")) porId("wx-wind-gusts").textContent = Number.isFinite(rafagas) ? rafagas.toFixed(1) : "—";
        if (porId("wx-humidity")) porId("wx-humidity").textContent = Number.isFinite(humedad) ? String(Math.round(humedad)) : "—";
        if (porId("wx-apparent-temperature")) porId("wx-apparent-temperature").textContent = Number.isFinite(sensacion) ? sensacion.toFixed(1) : "—";
        if (porId("wx-uv-index")) porId("wx-uv-index").textContent = Number.isFinite(uvPronostico) ? uvPronostico.toFixed(1) : Number.isFinite(uv) ? uv.toFixed(1) : "—";

        const actualizado = porId("wx-updated");
        if (actualizado) {
            const fecha = clima.time ? new Date(`${clima.time}:00-05:00`) : null;
            actualizado.textContent = fecha && !Number.isNaN(fecha.getTime())
                ? ` · Actualizado ${new Intl.DateTimeFormat("es-EC", { hour: "2-digit", minute: "2-digit", timeZone: "America/Guayaquil" }).format(fecha)}`
                : "";
        }
    }

    async function consultarClima() {
        panel.classList.add("is-loading");
        const estado = porId("weather-status");
        const controller = new AbortController();
        const timeout = window.setTimeout(() => controller.abort(), 10000);
        if (estado && !climaActual) estado.textContent = "Consultando clima local…";

        try {
            const respuesta = await fetch(URL_CLIMA, {
                signal: controller.signal,
                headers: { Accept: "application/json" },
                cache: "no-store"
            });
            const datos = await respuesta.json();
            if (!respuesta.ok) throw new Error(`Open-Meteo respondió ${respuesta.status}`);
            if (!datos.current) throw new Error("La respuesta no contiene condiciones actuales.");

            climaActual = { ...datos.current, hourly: datos.hourly || null };
            ultimaCarga = Date.now();
            pintarClimaActual(datos);
            panel.classList.add("is-updated");
            window.setTimeout(() => panel.classList.remove("is-updated"), 1100);
            if (estado) estado.textContent = "Clima actualizado";
            return climaActual;
        } catch (error) {
            console.warn("No se pudo actualizar el clima local:", error);
            if (estado) estado.textContent = climaActual
                ? "Sin conexión · se conserva la última consulta"
                : "Clima temporalmente no disponible";
            return climaActual;
        } finally {
            window.clearTimeout(timeout);
            panel.classList.remove("is-loading");
        }
    }

    function cargarClima() {
        if (cargaEnCurso) return cargaEnCurso;
        cargaEnCurso = consultarClima().finally(() => { cargaEnCurso = null; });
        return cargaEnCurso;
    }

    async function obtenerClimaActual({ actualizar = false } = {}) {
        if (actualizar || !climaActual || Date.now() - ultimaCarga >= INTERVALO_MS) {
            await cargarClima();
        }
        if (!climaActual) return null;
        const [condicion, icono] = describirClima(Number(climaActual.weather_code));
        return {
            ...climaActual,
            timeZone: "America/Guayaquil",
            location: "Puerto Francisco de Orellana, Ecuador",
            condition: condicion,
            icon: icono,
            source: "Open-Meteo",
            fetchedAt: ultimaCarga
        };
    }

    // Brunito consume exactamente la misma consulta que alimenta el panel del clima.
    window.smartCityWeather = Object.freeze({ getCurrent: obtenerClimaActual });

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
