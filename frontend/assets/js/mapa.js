// Posiciones demostrativas sobre el modelo ciudad.glb. No representan instalaciones reales.
const SENSOR_MAP_POSITIONS = [
    { x: -15, z: -50 }, { x: -2, z: -50 }, { x: 12, z: -50 }, { x: 27, z: -50 },
    { x: -15, z: -35 }, { x: -2, z: -35 }, { x: 12, z: -35 }, { x: 27, z: -35 },
    { x: -15, z: -20 }, { x: -2, z: -20 }, { x: 12, z: -20 }, { x: 27, z: -20 },
    { x: -15, z: -5 }, { x: -2, z: -5 }, { x: 12, z: -5 }, { x: 27, z: -5 },
    { x: -15, z: 10 }, { x: -2, z: 10 }
];

const DEMO_SENSOR_COUNT = SENSOR_MAP_POSITIONS.length;
const DEMO_HISTORY_STEP_MS = 30 * 60 * 1000;
let sensoresEnMapa = [];
let lecturasEnVivo = [];
let historialSensores = [];
let historialDisponible = true;
let modoDemoSensores = true;
let sensorEnDetalle = null;
let mapaSensoresEventosInstalados = false;
let capaMapaActual = "estado";
let reproduccionTemporal = null;

function crearLecturaDemo(indice, fecha) {
    const hora = fecha.getHours() + fecha.getMinutes() / 60;
    const variacionDiurna = Math.sin(((hora - 14) / 24) * Math.PI * 2);
    const temperatura = 20 + (indice % 6) * 1.4 + variacionDiurna * 5.2 + Math.sin(indice * 1.7) * 1.4;
    const humedad = 52 + (indice % 5) * 4.5 - variacionDiurna * 9 + Math.cos(indice) * 3;
    let calidadAire = 28 + ((indice * 17) % 52) + Math.sin(hora / 24 * Math.PI * 2 + indice) * 9;
    let tempFinal = temperatura;
    let humedadFinal = humedad;
    if (indice === 4) calidadAire = 116 + Math.sin(hora / 4) * 5;
    if (indice === 10) humedadFinal = 84 + Math.cos(hora / 3) * 3;
    if (indice === 15) tempFinal = 36 + Math.sin(hora / 2) * 1.2;
    return {
        id: `DEMO-${String(indice + 1).padStart(2, "0")}`,
        sensor_id: `DEMO-${String(indice + 1).padStart(2, "0")}`,
        temperatura: Number(tempFinal.toFixed(1)),
        humedad: Number(humedadFinal.toFixed(1)),
        calidad_aire: Math.max(0, Math.round(calidadAire)),
        fecha_hora: fecha.toISOString(),
        fuente: "simulada"
    };
}

function crearLecturasDemo(fecha = new Date()) {
    return Array.from({ length: DEMO_SENSOR_COUNT }, (_, indice) => ({
        id: `DEMO-${String(indice + 1).padStart(2, "0")}`,
        lectura: crearLecturaDemo(indice, fecha)
    }));
}

function generarHistorialDemostrativo(desde = new Date(Date.now() - 24 * 60 * 60 * 1000), hasta = new Date()) {
    const lecturas = [];
    const inicio = Math.floor(desde.getTime() / DEMO_HISTORY_STEP_MS) * DEMO_HISTORY_STEP_MS;
    for (let timestamp = inicio; timestamp <= hasta.getTime(); timestamp += DEMO_HISTORY_STEP_MS) {
        for (let indice = 0; indice < DEMO_SENSOR_COUNT; indice += 1) {
            lecturas.push(crearLecturaDemo(indice, new Date(timestamp)));
        }
    }
    return lecturas;
}

function obtenerSensoresActivos() {
    return sensoresEnMapa;
}

function obtenerLecturasDemoActuales() {
    return crearLecturasDemo();
}

function obtenerModoDemoSensores() {
    return modoDemoSensores;
}

function obtenerHistorialDemostrativo(desde, hasta) {
    return generarHistorialDemostrativo(desde, hasta);
}

function deduplicarLecturas(lecturas) {
    const porSensor = new Map();
    lecturas.forEach(lectura => {
        const id = String(lectura.sensor_id ?? lectura.id ?? "").trim();
        if (id && !porSensor.has(id)) porSensor.set(id, { id, lectura });
    });
    return Array.from(porSensor.values());
}

async function cargarMapaSensores() {
    const markerLayer = document.getElementById("sensor-map-model");
    const emptyState = document.getElementById("sensor-map-empty");
    if (!markerLayer || !emptyState) return;

    emptyState.textContent = "Cargando lecturas de sensores…";
    emptyState.classList.remove("hidden");
    markerLayer.querySelectorAll(".city-lamp-marker").forEach(marker => marker.remove());
    instalarEventosMapaSensores();

    let lecturasReales = [];
    try {
        const respuesta = await apiFetch("/sensores/ultimas");
        if (respuesta.ok && Array.isArray(respuesta.data)) lecturasReales = respuesta.data;
    } catch (error) {
        console.info("Se mostrará el conjunto demostrativo porque no se pudo consultar el servicio de sensores.");
    }

    if (lecturasReales.length) {
        modoDemoSensores = false;
        lecturasEnVivo = deduplicarLecturas(lecturasReales);
        const hasta = new Date();
        const desde = new Date(hasta.getTime() - 24 * 60 * 60 * 1000);
        try {
            const query = new URLSearchParams({ desde: desde.toISOString(), hasta: hasta.toISOString() });
            const respuestaHistorial = await apiFetch(`/sensores/historial?${query.toString()}`);
            historialSensores = respuestaHistorial.ok && Array.isArray(respuestaHistorial.data) ? respuestaHistorial.data : [];
        } catch (error) {
            historialSensores = [];
        }
        historialDisponible = historialSensores.length > 0;
        if (!historialDisponible) historialSensores = lecturasReales;
        actualizarFuenteDatos("DATOS DE API", false);
        actualizarNotaTemporal(historialDisponible
            ? "Reproducción basada en lecturas reales guardadas en el historial."
            : "El servidor tiene lecturas actuales, pero todavía no registra historial para reproducir.");
    } else {
        modoDemoSensores = true;
        lecturasEnVivo = crearLecturasDemo();
        historialSensores = generarHistorialDemostrativo();
        historialDisponible = true;
        actualizarFuenteDatos("DEMO · DATOS SIMULADOS", true);
        actualizarNotaTemporal("Simulación demostrativa de 24 horas; no son datos de un ESP32.");
    }

    sensoresEnMapa = lecturasEnVivo;
    actualizarDisponibilidadTemporal();
    actualizarVistaSensores({ fechaTexto: modoDemoSensores ? "Escenario simulado" : "Lecturas consultadas" });
    renderizarMarcadoresSensores(document.getElementById("sensor-map-search")?.value || "");
    const seleccionado = sensoresEnMapa.find(sensor => sensor.id === sensorEnDetalle);
    if (seleccionado) mostrarDetalleSensor(seleccionado);
    else if (sensoresEnMapa.length) mostrarDetalleSensor(sensoresEnMapa[0]);
    else mostrarDetalleVacio("Aún no hay lecturas para mostrar.");
    emptyState.classList.toggle("hidden", sensoresEnMapa.length > 0);

    const actualizado = document.getElementById("sensor-map-updated");
    if (actualizado) actualizado.textContent = modoDemoSensores
        ? `Escenario de demostración · ${new Date().toLocaleTimeString("es-EC", { hour: "2-digit", minute: "2-digit" })}`
        : `Consulta API · ${new Date().toLocaleTimeString("es-EC", { hour: "2-digit", minute: "2-digit" })}`;
}

function actualizarFuenteDatos(texto, esDemo) {
    const badge = document.getElementById("sensor-data-source");
    if (badge) {
        badge.textContent = texto;
        badge.classList.toggle("demo-source", esDemo);
        badge.classList.toggle("api-source", !esDemo);
        badge.classList.remove("checking-source");
    }
    const note = document.getElementById("alert-center-note");
    if (note) note.textContent = esDemo
        ? "Estas lecturas se generan para la demostración. Los umbrales son orientativos y no sustituyen una evaluación ambiental."
        : "Lecturas recibidas por la API. Los umbrales son orientativos y no sustituyen una evaluación ambiental.";
}

function actualizarNotaTemporal(texto) {
    const note = document.getElementById("timeline-source-note");
    if (note) note.textContent = texto;
}

function actualizarDisponibilidadTemporal() {
    const slider = document.getElementById("timeline-range");
    const play = document.getElementById("timeline-play");
    if (slider) slider.disabled = !historialDisponible;
    if (play) play.disabled = !historialDisponible;
}

function instalarEventosMapaSensores() {
    if (mapaSensoresEventosInstalados) return;
    mapaSensoresEventosInstalados = true;
    document.getElementById("sensor-map-refresh")?.addEventListener("click", cargarMapaSensores);
    document.getElementById("sensor-map-search")?.addEventListener("input", event => {
        renderizarMarcadoresSensores(event.currentTarget.value);
    });
    document.getElementById("timeline-range")?.addEventListener("input", event => {
        if (reproduccionTemporal) {
            clearInterval(reproduccionTemporal);
            reproduccionTemporal = null;
            const button = document.getElementById("timeline-play");
            if (button) {
                button.textContent = "▶ Reproducir";
                button.setAttribute("aria-label", "Reproducir historial");
            }
        }
        aplicarMarcoTemporal(Number(event.currentTarget.value));
    });
}

function seleccionarCapaMapa(capa) {
    if (!["estado", "temperatura", "humedad", "calidad_aire"].includes(capa)) return;
    capaMapaActual = capa;
    document.querySelectorAll("[data-map-layer]").forEach(button => {
        button.setAttribute("aria-pressed", String(button.dataset.mapLayer === capa));
    });
    renderizarMarcadoresSensores(document.getElementById("sensor-map-search")?.value || "");
}

function nivelLectura(lectura, capa) {
    const temp = Number(lectura.temperatura);
    const humedad = Number(lectura.humedad);
    const aire = Number(lectura.calidad_aire);
    if (capa === "temperatura") return temp >= 35 ? "high" : temp >= 29 ? "warn" : "good";
    if (capa === "humedad") return humedad < 20 || humedad > 80 ? "high" : humedad < 30 || humedad > 70 ? "warn" : "good";
    if (capa === "calidad_aire") return aire > 100 ? "high" : aire > 50 ? "warn" : "good";
    if (temp >= 35 || humedad < 20 || humedad > 80 || aire > 100) return "high";
    if (temp >= 29 || humedad < 30 || humedad > 70 || aire > 50) return "warn";
    return "good";
}

function renderizarMarcadoresSensores(query = "") {
    const markerLayer = document.getElementById("sensor-map-model");
    const emptyState = document.getElementById("sensor-map-empty");
    if (!markerLayer || !emptyState) return;

    markerLayer.querySelectorAll(".city-lamp-marker").forEach(marker => marker.remove());
    const normalizedQuery = query.trim().toLocaleLowerCase("es");
    const visibles = sensoresEnMapa.map((sensor, index) => ({ ...sensor, index }))
        .filter(sensor => sensor.id.toLocaleLowerCase("es").includes(normalizedQuery));

    emptyState.classList.toggle("hidden", visibles.length > 0);
    emptyState.textContent = sensoresEnMapa.length
        ? "No hay sensores que coincidan con la búsqueda."
        : modoDemoSensores ? "Cargando el escenario simulado…" : "Aún no hay lecturas para mostrar.";

    visibles.forEach(sensor => {
        const position = SENSOR_MAP_POSITIONS[sensor.index % SENSOR_MAP_POSITIONS.length];
        const marker = document.createElement("button");
        const level = nivelLectura(sensor.lectura, capaMapaActual);
        marker.type = "button";
        marker.className = "city-lamp-marker" + (sensor.id === sensorEnDetalle ? " selected" : "");
        marker.dataset.level = level;
        marker.dataset.position = `${position.x}m 0.15m ${position.z}m`;
        marker.dataset.normal = "0m 1m 0m";
        marker.slot = `hotspot-sensor-${sensor.index}`;
        marker.setAttribute("aria-label", `Luminaria con sensor ${sensor.id}; lectura ${level === "high" ? "para revisar" : level === "warn" ? "moderada" : "dentro del rango orientativo"}. Ver detalle.`);
        marker.title = `${sensor.id} · ${capaMapaActual === "estado" ? "Estado" : capaMapaActual.replace("_", " ")}: ${formatearValorSensor(sensor.lectura[capaMapaActual] ?? sensor.lectura.temperatura)}`;

        const lamp = document.createElement("span");
        lamp.className = "city-lamp";
        lamp.setAttribute("aria-hidden", "true");
        const sensorBox = document.createElement("span");
        sensorBox.className = "city-lamp-sensor";
        sensorBox.setAttribute("aria-hidden", "true");
        const label = document.createElement("span");
        label.className = "city-lamp-label";
        label.textContent = sensor.id;
        marker.append(lamp, sensorBox, label);
        marker.addEventListener("click", () => mostrarDetalleSensor(sensor));
        markerLayer.appendChild(marker);
    });
}

function encontrarLecturasEnHora(horasAtras) {
    if (horasAtras === 0) return lecturasEnVivo;
    const objetivo = Date.now() - horasAtras * 60 * 60 * 1000;
    const porSensor = new Map();
    historialSensores.forEach(lectura => {
        const id = String(lectura.sensor_id ?? lectura.id ?? "").trim();
        const timestamp = new Date(lectura.fecha_hora).getTime();
        if (!id || !Number.isFinite(timestamp)) return;
        const actual = porSensor.get(id);
        if (!actual || Math.abs(timestamp - objetivo) < Math.abs(actual.timestamp - objetivo)) {
            porSensor.set(id, { timestamp, lectura });
        }
    });
    return Array.from(porSensor, ([id, item]) => ({ id, lectura: item.lectura }))
        .filter(item => Math.abs(new Date(item.lectura.fecha_hora).getTime() - objetivo) <= 6 * 60 * 60 * 1000);
}

function aplicarMarcoTemporal(horasAtras) {
    if (!historialDisponible) return;
    const slider = document.getElementById("timeline-range");
    const value = Math.max(0, Math.min(24, Number(horasAtras) || 0));
    if (slider) slider.value = String(value);
    const output = document.getElementById("timeline-value");
    if (output) output.textContent = value === 0 ? (modoDemoSensores ? "Ahora · demo" : "Última lectura") : `Hace ${value} h`;

    sensoresEnMapa = encontrarLecturasEnHora(value);
    const instante = new Date(Date.now() - value * 60 * 60 * 1000);
    actualizarVistaSensores({ fechaTexto: value === 0 ? "Ahora" : instante.toLocaleString("es-EC", { hour: "2-digit", minute: "2-digit" }) });
    renderizarMarcadoresSensores(document.getElementById("sensor-map-search")?.value || "");
    const sensorActivo = sensoresEnMapa.find(sensor => sensor.id === sensorEnDetalle) || sensoresEnMapa[0];
    if (sensorActivo) mostrarDetalleSensor(sensorActivo);
    else mostrarDetalleVacio("No hay lecturas guardadas cerca de esta hora.");
}

function alternarReproduccionTemporal() {
    const button = document.getElementById("timeline-play");
    if (!historialDisponible) return;
    if (reproduccionTemporal) {
        clearInterval(reproduccionTemporal);
        reproduccionTemporal = null;
        if (button) { button.textContent = "▶ Reproducir"; button.setAttribute("aria-label", "Reproducir historial"); }
        return;
    }
    const slider = document.getElementById("timeline-range");
    if (Number(slider?.value || 0) === 0 && slider) slider.value = "24";
    let siguiente = Number(slider?.value || 24);
    aplicarMarcoTemporal(siguiente);
    if (button) { button.textContent = "Ⅱ Pausar"; button.setAttribute("aria-label", "Pausar historial"); }
    reproduccionTemporal = setInterval(() => {
        siguiente -= 1;
        if (siguiente < 0) {
            clearInterval(reproduccionTemporal);
            reproduccionTemporal = null;
            if (button) { button.textContent = "▶ Reproducir"; button.setAttribute("aria-label", "Reproducir historial"); }
            return;
        }
        if (slider) slider.value = String(siguiente);
        aplicarMarcoTemporal(siguiente);
    }, 900);
}

function valoresFueraDeRango(lectura) {
    const resultado = [];
    const valido = valor => valor !== null && valor !== undefined && valor !== "" && Number.isFinite(Number(valor));
    const temp = Number(lectura.temperatura);
    const humedad = Number(lectura.humedad);
    const aire = Number(lectura.calidad_aire);
    if (valido(lectura.temperatura) && (temp < 0 || temp >= 35)) resultado.push(`Temperatura ${formatearValorSensor(temp)} °C`);
    if (valido(lectura.humedad) && (humedad < 20 || humedad > 80)) resultado.push(`Humedad ${formatearValorSensor(humedad)} %`);
    if (valido(lectura.calidad_aire) && (aire < 0 || aire > 100)) resultado.push(`ICA ${formatearValorSensor(aire)}`);
    return resultado;
}

function actualizarVistaSensores({ fechaTexto = "Ahora" } = {}) {
    actualizarMetricasDashboard(sensoresEnMapa.map(sensor => sensor.lectura));
    actualizarBadgeAlertasSensores(sensoresEnMapa);
    const ahora = new Date().toLocaleTimeString("es-EC", { hour: "2-digit", minute: "2-digit" });
    const label = document.getElementById("pulse-status-label");
    const count = document.getElementById("pulse-sensor-count");
    const alerts = document.getElementById("pulse-alert-count");
    const updated = document.getElementById("pulse-updated");
    if (label) label.textContent = modoDemoSensores ? "Escenario urbano simulado" : "Datos recibidos por la API";
    const summary = document.getElementById("city-pulse-summary");
    const strip = document.getElementById("urban-pulse-strip");
    if (summary) summary.textContent = `${sensoresEnMapa.length} puntos en el mapa · ${modoDemoSensores ? "modelo de demostración, sin ESP32 conectado" : "lecturas recibidas desde el servicio de sensores"}.`;
    if (strip) strip.dataset.source = modoDemoSensores ? "demo" : "api";
    if (count) count.textContent = String(sensoresEnMapa.length);
    if (alerts) alerts.textContent = String(sensoresEnMapa.filter(sensor => valoresFueraDeRango(sensor.lectura).length).length);
    if (updated) updated.textContent = `${fechaTexto} · actualización ${ahora}`;

    const lista = document.getElementById("alert-center-list");
    const total = document.getElementById("alert-center-count");
    if (!lista) return;
    const observaciones = sensoresEnMapa.map(sensor => ({ sensor, valores: valoresFueraDeRango(sensor.lectura) }))
        .filter(item => item.valores.length);
    if (total) total.textContent = `${observaciones.length} ${observaciones.length === 1 ? "lectura" : "lecturas"} por revisar`;
    lista.replaceChildren();
    if (!observaciones.length) {
        const vacio = document.createElement("div");
        vacio.className = "alert-empty-state";
        vacio.innerHTML = `<span aria-hidden="true">✓</span><div><strong>Sin observaciones en este momento</strong><p>${modoDemoSensores ? "Explora el mapa y cambia la hora para ver el escenario demostrativo." : "Las lecturas actuales están dentro de los rangos informativos."}</p></div>`;
        lista.appendChild(vacio);
        return;
    }
    observaciones.forEach(({ sensor, valores }) => {
        const item = document.createElement("article");
        item.className = "alert-item";
        const texto = document.createElement("div");
        const sensorLabel = document.createElement("strong");
        sensorLabel.textContent = sensor.id;
        const detail = document.createElement("p");
        detail.textContent = valores.join(" · ");
        texto.append(sensorLabel, detail);
        const button = document.createElement("button");
        button.type = "button";
        button.className = "alert-view-button";
        button.textContent = "Ver en mapa";
        button.addEventListener("click", () => {
            document.getElementById("sensor-map-section")?.scrollIntoView({ behavior: "smooth", block: "start" });
            mostrarDetalleSensor(sensor);
        });
        item.append(texto, button);
        lista.appendChild(item);
    });
}

function actualizarBadgeAlertasSensores(sensores) {
    const badge = document.getElementById("sensor-alert-badge");
    if (!badge) return;
    const fueraDeRango = sensores.filter(({ lectura }) => valoresFueraDeRango(lectura).length).length;
    badge.textContent = fueraDeRango > 99 ? "99+" : String(fueraDeRango);
    badge.setAttribute("aria-label", `${fueraDeRango} sensores con lecturas fuera de los rangos informativos configurados`);
    badge.title = fueraDeRango
        ? `${fueraDeRango} sensores para revisar. Umbrales orientativos: 0 a menos de 35 °C, 20–80 % y 0–100 ICA.`
        : "Todas las lecturas están dentro de los rangos informativos.";
    badge.classList.toggle("hidden", fueraDeRango === 0);
}

function actualizarMetricasDashboard(lecturas) {
    if (!lecturas?.length) return;
    const promedio = campo => lecturas.reduce((suma, lectura) => suma + (Number(lectura[campo]) || 0), 0) / lecturas.length;
    const formato = value => new Intl.NumberFormat("es-EC", { maximumFractionDigits: 1 }).format(value);
    const temp = document.getElementById("metric-temp");
    const humedad = document.getElementById("metric-hum");
    const aire = document.getElementById("metric-aire");
    if (temp) temp.textContent = `${formato(promedio("temperatura"))} °C`;
    if (humedad) humedad.textContent = `${formato(promedio("humedad"))} %`;
    if (aire) aire.textContent = `${formato(promedio("calidad_aire"))} ICA`;
}

function mostrarDetalleSensor(sensor) {
    if (!sensor) return;
    sensorEnDetalle = sensor.id;
    renderizarMarcadoresSensores(document.getElementById("sensor-map-search")?.value || "");
    const lectura = sensor.lectura;
    const fecha = lectura.fecha_hora ? new Date(lectura.fecha_hora) : null;
    const fechaValida = fecha && !Number.isNaN(fecha.getTime());
    const element = id => document.getElementById(id);

    element("sensor-detail-id").textContent = `Sensor ${sensor.id}`;
    element("sensor-detail-status").textContent = modoDemoSensores ? "Lectura simulada" : "Dato de API";
    element("sensor-detail-status").classList.add("has-reading");
    element("sensor-detail-message").textContent = modoDemoSensores
        ? "Esta lectura es generada para la demo; no proviene de un sensor conectado."
        : "Última lectura recibida desde el servicio de sensores.";
    element("sensor-detail-content").classList.remove("hidden");
    element("sensor-detail-temperature").textContent = `${formatearValorSensor(lectura.temperatura)} °C`;
    element("sensor-detail-humidity").textContent = `${formatearValorSensor(lectura.humedad)} %`;
    element("sensor-detail-air").textContent = `${formatearValorSensor(lectura.calidad_aire)} ICA`;
    const time = element("sensor-detail-time");
    if (fechaValida) {
        time.dateTime = fecha.toISOString();
        time.textContent = fecha.toLocaleString("es-EC", { dateStyle: "medium", timeStyle: "short" });
    } else {
        time.removeAttribute("datetime");
        time.textContent = "Fecha no disponible";
    }
}

function mostrarDetalleVacio(mensaje) {
    const id = document.getElementById("sensor-detail-id");
    const status = document.getElementById("sensor-detail-status");
    const message = document.getElementById("sensor-detail-message");
    const content = document.getElementById("sensor-detail-content");
    if (id) id.textContent = "Sin sensor seleccionado";
    if (status) {
        status.textContent = "Sin datos";
        status.classList.remove("has-reading");
    }
    if (message) message.textContent = mensaje;
    content?.classList.add("hidden");
}

function formatearValorSensor(value) {
    const number = Number(value);
    return Number.isFinite(number)
        ? new Intl.NumberFormat("es-EC", { maximumFractionDigits: 1 }).format(number)
        : "—";
}
