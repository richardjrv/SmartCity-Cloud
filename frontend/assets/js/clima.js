// Clima de Open-Meteo: ciudad elegida por el usuario, pronóstico horario y estado actual.
(() => {
    const UBICACION_INICIAL = {
        name: "Puerto Francisco de Orellana",
        label: "Puerto Francisco de Orellana, Ecuador",
        latitude: -0.4667,
        longitude: -76.9872,
        timezone: "America/Guayaquil",
        country: "Ecuador"
    };
    const INTERVALO_MS = 10 * 60 * 1000;
    const porId = id => document.getElementById(id);
    const panel = porId("weather-local-panel");
    if (!panel) return;

    let ubicacionActual = leerUbicacionGuardada();
    let climaActual = null;
    let ultimaCarga = 0;
    let cargaEnCurso = null;
    let controladorClima = null;
    const numeroValido = valor => valor === null || valor === undefined || valor === "" ? null : Number(valor);

    function leerUbicacionGuardada() {
        try {
            const guardada = JSON.parse(localStorage.getItem("smartcity_weather_city") || "null");
            if (guardada && Number.isFinite(Number(guardada.latitude)) && Number.isFinite(Number(guardada.longitude))
                && typeof guardada.label === "string" && typeof guardada.name === "string"
                && (guardada.country_code === "EC" || guardada.country === "Ecuador" || guardada.label.endsWith(", Ecuador"))) {
                return { ...UBICACION_INICIAL, ...guardada };
            }
        } catch (error) {
            console.info("Se utilizará la ubicación meteorológica predeterminada.");
        }
        return { ...UBICACION_INICIAL };
    }

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

    function formatearHora(fechaHora) {
        // Open-Meteo devuelve estos valores como hora local de la ciudad, sin offset.
        // Leer directamente la hora evita aplicar por error la zona del navegador.
        if (typeof fechaHora === "string") {
            const horaLocal = fechaHora.match(/T(\d{2}:\d{2})/);
            if (horaLocal) return horaLocal[1];
        }
        const fecha = new Date(fechaHora);
        if (Number.isNaN(fecha.getTime())) return "—";
        const zona = ubicacionActual.timezone && ubicacionActual.timezone !== "auto" ? ubicacionActual.timezone : undefined;
        return new Intl.DateTimeFormat("es-EC", {
            hour: "2-digit", minute: "2-digit", ...(zona ? { timeZone: zona } : {}), hourCycle: "h23"
        }).format(fecha);
    }

    function pintarPronostico(datos) {
        const lista = porId("weather-hourly-forecast");
        if (!lista) return;
        const hourly = datos.hourly || {};
        const horas = Array.isArray(hourly.time) ? hourly.time : [];
        const indiceActual = Math.max(0, horas.findIndex(hora => hora >= (datos.current?.time || "")));
        const indices = Array.from({ length: 12 }, (_, offset) => indiceActual + offset)
            .filter(indice => indice < horas.length);
        if (!indices.length) {
            lista.innerHTML = '<p class="weather-forecast-empty" role="status">El pronóstico horario no está disponible por ahora.</p>';
            return;
        }
        const elementos = indices.map((indice, posicion) => {
            const codigo = Number(hourly.weather_code?.[indice]);
            const [condicion, icono] = describirClima(codigo);
            const temp = numeroValido(hourly.temperature_2m?.[indice]);
            const probabilidad = numeroValido(hourly.precipitation_probability?.[indice]);
            const lluvia = numeroValido(hourly.precipitation?.[indice]);
            const etiquetaHora = posicion === 0 ? "Ahora" : formatearHora(horas[indice]);
            const tarjeta = document.createElement("article");
            tarjeta.className = "weather-hour-card";
            tarjeta.setAttribute("role", "listitem");
            tarjeta.setAttribute("aria-label", `${etiquetaHora}: ${condicion}, ${temp === null ? "temperatura no disponible" : `${Math.round(temp)} grados`}, probabilidad de lluvia ${probabilidad === null ? "no disponible" : `${Math.round(probabilidad)} por ciento`}`);
            const hora = document.createElement("span"); hora.className = "weather-hour-time"; hora.textContent = etiquetaHora;
            const icon = document.createElement("span"); icon.className = "weather-hour-icon"; icon.setAttribute("aria-hidden", "true"); icon.textContent = icono;
            const temperature = document.createElement("strong"); temperature.className = "weather-hour-temperature"; temperature.textContent = temp === null ? "—°" : `${Math.round(temp)}°`;
            const rain = document.createElement("span"); rain.className = "weather-hour-rain"; rain.textContent = probabilidad === null ? "Lluvia —" : `☔ ${Math.round(probabilidad)}%`;
            const amount = document.createElement("span"); amount.className = "weather-hour-amount"; amount.textContent = lluvia === null ? "— mm" : `${lluvia.toFixed(1)} mm`;
            tarjeta.append(hora, icon, temperature, rain, amount);
            return tarjeta;
        });
        lista.replaceChildren(...elementos);
    }

    function pintarClimaActual(datos) {
        const clima = datos.current || {};
        const [condicion, icono] = describirClima(Number(clima.weather_code));
        const temperatura = numeroValido(clima.temperature_2m);
        const iconoNode = porId("wx-icon");
        const temperaturaNode = porId("wx-temperature");
        const condicionNode = porId("wx-condition");
        const locationNode = porId("wx-location");
        if (locationNode) locationNode.textContent = ubicacionActual.label;
        if (iconoNode) {
            const codigo = Number(clima.weather_code);
            const tipoCondicion = codigo <= 1 ? "sunny"
                : codigo === 2 || codigo === 3 || codigo === 45 || codigo === 48 ? "cloudy"
                    : codigo >= 51 ? "rainy" : "cloudy";
            if (iconoNode.dataset.weatherCondition !== tipoCondicion) {
                if (iconoNode.dataset.weatherCondition) {
                    iconoNode.classList.remove("weather-icon--changing");
                    void iconoNode.offsetWidth;
                    iconoNode.classList.add("weather-icon--changing");
                    window.setTimeout(() => iconoNode.classList.remove("weather-icon--changing"), 520);
                }
                iconoNode.dataset.weatherCondition = tipoCondicion;
            }
            iconoNode.classList.remove("weather-icon--sunny", "weather-icon--cloudy", "weather-icon--rainy");
            iconoNode.classList.add(`weather-icon--${tipoCondicion}`);
            iconoNode.textContent = icono;
        }
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
        panel.querySelectorAll(".skeleton-loading").forEach(node => node.classList.remove("skeleton-loading"));
        pintarPronostico(datos);

        const actualizado = porId("wx-updated");
        if (actualizado) {
            actualizado.textContent = clima.time
                ? ` · Actualizado ${formatearHora(clima.time)}`
                : "";
        }
    }

    async function consultarClima({ silencioso = false } = {}) {
        panel.classList.add("is-loading");
        const estado = porId("weather-status");
        controladorClima?.abort();
        controladorClima = new AbortController();
        const controller = controladorClima;
        const timeout = window.setTimeout(() => controller.abort(), 10000);
        if (estado && !climaActual && !silencioso) estado.textContent = "Consultando clima…";
        const parametros = new URLSearchParams({
            latitude: String(ubicacionActual.latitude),
            longitude: String(ubicacionActual.longitude),
            current: "temperature_2m,relative_humidity_2m,precipitation,apparent_temperature,weather_code,wind_speed_10m,wind_gusts_10m,uv_index",
            hourly: "precipitation_probability,precipitation,uv_index,weather_code,temperature_2m",
            forecast_days: "2",
            temperature_unit: "celsius",
            wind_speed_unit: "kmh",
            precipitation_unit: "mm",
            timezone: "auto"
        });
        try {
            const respuesta = await fetch(`https://api.open-meteo.com/v1/forecast?${parametros}`, {
                signal: controller.signal, headers: { Accept: "application/json" }, cache: "no-store"
            });
            const datos = await respuesta.json();
            if (!respuesta.ok) throw new Error(`Open-Meteo respondió ${respuesta.status}`);
            if (!datos.current) throw new Error("La respuesta no contiene condiciones actuales.");
            if (controller.signal.aborted) return climaActual;

            climaActual = { ...datos.current, hourly: datos.hourly || null, timezone: datos.timezone };
            ubicacionActual.timezone = datos.timezone || ubicacionActual.timezone;
            ultimaCarga = Date.now();
            pintarClimaActual(datos);
            panel.classList.add("is-updated");
            window.setTimeout(() => panel.classList.remove("is-updated"), 1100);
            if (estado) {
                estado.textContent = `Clima de ${ubicacionActual.name} actualizado`;
                estado.classList.add("weather-status--live");
            }
            return climaActual;
        } catch (error) {
            if (error.name !== "AbortError" || !controller.signal.aborted) console.warn("No se pudo actualizar el clima:", error);
            if (estado && !controller.signal.aborted) {
                estado.textContent = climaActual ? "Sin conexión · se conserva la última consulta" : "Clima temporalmente no disponible";
                estado.classList.remove("weather-status--live");
            }
            return climaActual;
        } finally {
            window.clearTimeout(timeout);
            if (controladorClima === controller) {
                panel.classList.remove("is-loading");
                if (!climaActual) panel.querySelectorAll(".skeleton-loading").forEach(node => node.classList.remove("skeleton-loading"));
            }
        }
    }

    function cargarClima(opciones) {
        if (cargaEnCurso) return cargaEnCurso;
        const tarea = consultarClima(opciones).finally(() => { if (cargaEnCurso === tarea) cargaEnCurso = null; });
        cargaEnCurso = tarea;
        return tarea;
    }

    async function buscarCiudad(nombre) {
        const texto = nombre.trim();
        if (texto.length < 2) throw new Error("Escribe al menos dos letras para buscar una ciudad.");
        const input = porId("weather-city-input");
        const button = porId("weather-city-submit");
        const status = porId("weather-status");
        if (button) { button.disabled = true; button.textContent = "Buscando…"; }
        if (status) { status.textContent = `Buscando ${texto}…`; status.classList.remove("weather-status--live"); }
        try {
            const params = new URLSearchParams({ name: texto, count: "10", language: "es", format: "json", countryCode: "EC" });
            const response = await fetch(`https://geocoding-api.open-meteo.com/v1/search?${params}`, { headers: { Accept: "application/json" }, cache: "no-store" });
            const data = await response.json();
            if (!response.ok) throw new Error("No se pudo consultar el buscador de ciudades.");
            const place = data.results?.find(resultado => resultado.country_code === "EC");
            if (!place) throw new Error(`No encontramos «${texto}» entre las ciudades de Ecuador. Revisa el nombre e inténtalo de nuevo.`);
            const parts = [place.name, place.admin1, place.country].filter((part, index, all) => part && all.indexOf(part) === index);
            ubicacionActual = {
                name: place.name,
                label: parts.join(", "),
                latitude: Number(place.latitude),
                longitude: Number(place.longitude),
                timezone: place.timezone || "auto",
                country: place.country || "Ecuador",
                country_code: place.country_code
            };
            try { localStorage.setItem("smartcity_weather_city", JSON.stringify(ubicacionActual)); } catch (error) { /* La consulta sigue funcionando sin guardar preferencia. */ }
            controladorClima?.abort();
            cargaEnCurso = null;
            climaActual = null;
            ultimaCarga = 0;
            if (input) input.value = "";
            const forecast = porId("weather-hourly-forecast");
            forecast?.replaceChildren(Object.assign(document.createElement("p"), { className: "weather-forecast-empty", textContent: "Consultando pronóstico…", role: "status" }));
            await cargarClima();
        } catch (error) {
            if (status) status.textContent = error.message || "No se pudo buscar esa ciudad.";
        } finally {
            if (button) { button.disabled = false; button.textContent = "Buscar"; }
        }
    }

    async function volverAOrellana() {
        ubicacionActual = { ...UBICACION_INICIAL };
        try { localStorage.removeItem("smartcity_weather_city"); } catch (error) { /* No afecta la consulta meteorológica. */ }
        controladorClima?.abort();
        cargaEnCurso = null;
        climaActual = null;
        ultimaCarga = 0;
        await cargarClima();
    }

    async function obtenerClimaActual({ actualizar = false } = {}) {
        if (actualizar || !climaActual || Date.now() - ultimaCarga >= INTERVALO_MS) await cargarClima({ silencioso: true });
        if (!climaActual) return null;
        const [condicion, icono] = describirClima(Number(climaActual.weather_code));
        return {
            ...climaActual,
            timeZone: climaActual.timezone || ubicacionActual.timezone,
            location: ubicacionActual.label,
            condition: condicion,
            icon: icono,
            source: "Open-Meteo",
            fetchedAt: ultimaCarga
        };
    }

    window.smartCityWeather = Object.freeze({ getCurrent: obtenerClimaActual });
    porId("weather-city-search")?.addEventListener("submit", event => {
        event.preventDefault();
        void buscarCiudad(porId("weather-city-input")?.value || "");
    });
    porId("weather-city-reset")?.addEventListener("click", volverAOrellana);

    const locationNode = porId("wx-location");
    if (locationNode) locationNode.textContent = ubicacionActual.label;
    const initialStatus = porId("weather-status");
    if (initialStatus && ubicacionActual.name !== UBICACION_INICIAL.name) initialStatus.textContent = `Consultando clima de ${ubicacionActual.name}…`;
    if ("IntersectionObserver" in window) {
        new IntersectionObserver(entries => {
            if (entries.some(entry => entry.isIntersecting) && Date.now() - ultimaCarga >= INTERVALO_MS) void cargarClima();
        }, { rootMargin: "120px" }).observe(panel);
    } else {
        void cargarClima();
    }
    window.setInterval(() => {
        if (!document.hidden && panel.getClientRects().length && Date.now() - ultimaCarga >= INTERVALO_MS) void cargarClima({ silencioso: true });
    }, 60 * 1000);
})();
