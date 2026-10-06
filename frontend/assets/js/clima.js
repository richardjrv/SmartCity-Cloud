// Clima exterior de Puerto Francisco de Orellana comparado con las métricas
// agregadas que ya presenta el dashboard. Las lecturas de demo siguen rotuladas.
(() => {
    const LATITUD = -0.4667;
    const LONGITUD = -76.9872;
    const INTERVALO_MS = 10 * 60 * 1000;
    const UMBRAL_TEMPERATURA = 2;
    const UMBRAL_HUMEDAD = 10;

    const parametros = new URLSearchParams({
        latitude: String(LATITUD),
        longitude: String(LONGITUD),
        current: "temperature_2m,relative_humidity_2m,precipitation,weather_code,uv_index",
        temperature_unit: "celsius",
        timezone: "America/Guayaquil"
    });
    const URL_CLIMA = `https://api.open-meteo.com/v1/forecast?${parametros}`;
    const porId = id => document.getElementById(id);
    const panel = porId("weather-compare-panel");
    if (!panel) return;

    let climaActual = null;
    let ultimaCarga = 0;
    let cargando = false;

    function leerNumeroSensor(id) {
        const texto = porId(id)?.textContent ?? "";
        const resultado = texto.match(/-?\d+(?:[.,]\d+)?/);
        if (!resultado) return null;
        const numero = Number.parseFloat(resultado[0].replace(",", "."));
        return Number.isFinite(numero) ? numero : null;
    }

    function describirClima(codigo) {
        if (codigo === 0) return ["☀️", "Despejado"];
        if (codigo === 1) return ["🌤️", "Mayormente despejado"];
        if (codigo === 2) return ["⛅", "Parcialmente nublado"];
        if (codigo === 3) return ["☁️", "Nublado"];
        if (codigo === 45 || codigo === 48) return ["🌫️", "Niebla"];
        if (codigo >= 51 && codigo <= 57) return ["🌦️", "Llovizna"];
        if (codigo >= 61 && codigo <= 67) return ["🌧️", "Lluvia"];
        if (codigo >= 71 && codigo <= 77) return ["🌨️", "Nieve"];
        if (codigo >= 80 && codigo <= 82) return ["🌧️", "Chubascos"];
        if (codigo === 85 || codigo === 86) return ["🌨️", "Chubascos de nieve"];
        if (codigo >= 95 && codigo <= 99) return ["⛈️", "Tormenta"];
        return ["🌡️", "Condición variable"];
    }

    function clasificarUv(valor) {
        if (valor < 3) return ["Bajo", "good"];
        if (valor < 6) return ["Moderado", "good"];
        if (valor < 8) return ["Alto", "warn"];
        if (valor < 11) return ["Muy alto", "warn"];
        return ["Extremo", "high"];
    }

    function pintarComparacion(metrica, sensor, clima, unidad, umbral) {
        const sensorNode = porId(`wx-${metrica}-sensor`);
        const climaNode = porId(`wx-${metrica}-api`);
        const diferenciaNode = porId(`wx-${metrica}-diff`);
        if (!sensorNode || !climaNode || !diferenciaNode) return;

        sensorNode.textContent = sensor == null ? "Sin lectura" : `${sensor.toFixed(1)} ${unidad}`;
        climaNode.textContent = clima == null ? "Sin dato" : `${clima.toFixed(1)} ${unidad}`;

        if (sensor == null || clima == null) {
            diferenciaNode.textContent = "Aún no se puede comparar";
            diferenciaNode.dataset.level = "";
            return;
        }

        const diferencia = sensor - clima;
        const magnitud = Math.abs(diferencia);
        const signo = diferencia > 0 ? "+" : "";
        diferenciaNode.textContent = magnitud <= umbral
            ? `Cercanos · ${signo}${diferencia.toFixed(1)} ${unidad}`
            : `Diferencia · ${signo}${diferencia.toFixed(1)} ${unidad}`;
        diferenciaNode.dataset.level = magnitud <= umbral
            ? "good"
            : magnitud >= umbral * 2 ? "high" : "warn";
    }

    function pintarComparaciones() {
        pintarComparacion(
            "temp",
            leerNumeroSensor("metric-temp"),
            climaActual?.temperature_2m ?? null,
            "°C",
            UMBRAL_TEMPERATURA
        );
        pintarComparacion(
            "hum",
            leerNumeroSensor("metric-hum"),
            climaActual?.relative_humidity_2m ?? null,
            "%",
            UMBRAL_HUMEDAD
        );
    }

    function pintarClimaActual(clima) {
        const codigo = Number(clima.weather_code);
        const [icono, condicion] = describirClima(codigo);
        porId("wx-condition").textContent = `${icono} ${condicion}`;

        const lluvia = Number(clima.precipitation);
        porId("wx-rain").textContent = Number.isFinite(lluvia) ? `${lluvia.toFixed(1)} mm` : "Sin dato";

        const uv = Number(clima.uv_index);
        const uvNode = porId("wx-uv");
        const nivelNode = porId("wx-uv-level");
        if (Number.isFinite(uv) && uvNode && nivelNode) {
            const [etiqueta, nivel] = clasificarUv(uv);
            uvNode.textContent = uv.toFixed(1);
            nivelNode.textContent = `Nivel ${etiqueta.toLowerCase()}`;
            nivelNode.dataset.level = nivel;
        }

        const actualizado = porId("wx-updated");
        if (actualizado) {
            const fecha = clima.time ? new Date(clima.time) : null;
            actualizado.textContent = fecha && !Number.isNaN(fecha.getTime())
                ? `Consulta ${new Intl.DateTimeFormat("es-EC", { hour: "2-digit", minute: "2-digit", timeZone: "America/Guayaquil" }).format(fecha)}.`
                : "";
        }
    }

    async function cargarClima() {
        if (cargando) return;
        cargando = true;
        const estado = porId("weather-status");
        const controller = new AbortController();
        const timeout = window.setTimeout(() => controller.abort(), 8000);

        if (estado && !climaActual) estado.textContent = "Consultando clima local…";
        try {
            const respuesta = await fetch(URL_CLIMA, {
                signal: controller.signal,
                headers: { Accept: "application/json" }
            });
            if (!respuesta.ok) throw new Error(`Open-Meteo respondió ${respuesta.status}`);

            const datos = await respuesta.json();
            if (!datos.current) throw new Error("La respuesta no contiene condiciones actuales.");

            climaActual = datos.current;
            ultimaCarga = Date.now();
            pintarClimaActual(climaActual);
            pintarComparaciones();
            if (estado) estado.textContent = "Clima actualizado";
        } catch (error) {
            console.warn("No se pudo actualizar el clima exterior:", error);
            if (estado) estado.textContent = climaActual
                ? "Sin conexión · se conserva la última consulta"
                : "No se pudo consultar el clima";
            pintarComparaciones();
        } finally {
            window.clearTimeout(timeout);
            cargando = false;
        }
    }

    if ("IntersectionObserver" in window) {
        new IntersectionObserver(entradas => {
            if (entradas.some(entrada => entrada.isIntersecting)
                && Date.now() - ultimaCarga >= INTERVALO_MS) {
                void cargarClima();
            }
        }, { rootMargin: "120px" }).observe(panel);
    } else {
        void cargarClima();
    }

    window.setInterval(() => {
        if (!document.hidden && panel.getClientRects().length
            && Date.now() - ultimaCarga >= INTERVALO_MS) {
            void cargarClima();
        }
    }, 60 * 1000);

    ["metric-temp", "metric-hum"].forEach(id => {
        const nodo = porId(id);
        if (nodo && "MutationObserver" in window) {
            new MutationObserver(pintarComparaciones).observe(nodo, {
                childList: true,
                characterData: true,
                subtree: true
            });
        }
    });
})();
