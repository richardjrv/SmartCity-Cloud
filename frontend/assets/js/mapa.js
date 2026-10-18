// Posiciones demostrativas sobre el modelo ciudad.glb. No representan instalaciones reales.
const SENSOR_MAP_POSITIONS = [
    { x: 0.58, y: 1.2, z: 1.18 }
];

const DEMO_SENSOR_ID = "DEMO-ESP32-MAQUETA";
const DEMO_SENSOR_COUNT = 1;
const DEMO_HISTORY_STEP_MS = 30 * 60 * 1000;
let sensoresEnMapa = [];
let lecturasEnVivo = [];
let modoDemoSensores = true;
let lecturaApiReciente = false;
let fechaUltimaLecturaSensor = null;
let temporizadorAntiguedadSensor = null;
let sensorEnDetalle = null;
let mapaSensoresEventosInstalados = false;
let capaMapaActual = "estado";

function crearLecturaDemo(indice, fecha) {
    const hora = fecha.getHours() + fecha.getMinutes() / 60;
    const variacionDiurna = Math.sin(((hora - 14) / 24) * Math.PI * 2);
    const temperatura = 20 + (indice % 6) * 1.4 + variacionDiurna * 5.2 + Math.sin(indice * 1.7) * 1.4;
    const humedad = 52 + (indice % 5) * 4.5 - variacionDiurna * 9 + Math.cos(indice) * 3;
    let calidadAire = 28 + ((indice * 17) % 52) + Math.sin(hora / 24 * Math.PI * 2 + indice) * 9;
    let tempFinal = temperatura;
    let humedadFinal = humedad;
    return {
        id: DEMO_SENSOR_ID,
        sensor_id: DEMO_SENSOR_ID,
        temperatura: Number(tempFinal.toFixed(1)),
        humedad: Number(humedadFinal.toFixed(1)),
        calidad_aire: Math.max(0, Math.round(calidadAire)),
        distancia_cm: Number((24 + Math.sin(hora) * 5).toFixed(1)),
        lluvia_detectada: fecha.getHours() < 6,
        luminosidad: Math.round(420 + Math.sin(hora / 24 * Math.PI * 2) * 280),
        nivel_agua: Number((38 + Math.sin(hora / 8) * 8).toFixed(1)),
        reflectancia_tcrt5000: Math.round(510 + Math.sin(hora * 1.4) * 90),
        tcrt5000_detectado: hora % 4 < 1,
        fecha_hora: fecha.toISOString(),
        fuente: "simulada"
    };
}

function crearLecturasDemo(fecha = new Date()) {
    return Array.from({ length: DEMO_SENSOR_COUNT }, (_, indice) => ({
        id: DEMO_SENSOR_ID,
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
    if (!temporizadorAntiguedadSensor) {
        temporizadorAntiguedadSensor = window.setInterval(actualizarAntiguedadSensor, 30_000);
    }

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
        // La maqueta tiene una sola placa ESP32: conserva únicamente su lectura más reciente.
        lecturasEnVivo = deduplicarLecturas(lecturasReales)
            .sort((a, b) => new Date(b.lectura.fecha_hora || 0) - new Date(a.lectura.fecha_hora || 0))
            .slice(0, 1);
        const fechaUltima = new Date(lecturasEnVivo[0]?.lectura?.fecha_hora || 0);
        const edadLectura = Date.now() - fechaUltima.getTime();
        const lecturaReciente = Number.isFinite(fechaUltima.getTime()) && edadLectura >= 0 && edadLectura <= 10 * 60 * 1000;
        lecturaApiReciente = lecturaReciente;
        fechaUltimaLecturaSensor = Number.isFinite(fechaUltima.getTime()) ? fechaUltima : null;
        actualizarFuenteDatos(lecturaReciente ? "API · LECTURA RECIENTE" : "API · ÚLTIMA LECTURA ANTIGUA", false, !lecturaReciente, fechaUltima);
    } else {
        modoDemoSensores = true;
        lecturaApiReciente = false;
        fechaUltimaLecturaSensor = null;
        lecturasEnVivo = crearLecturasDemo();
        actualizarFuenteDatos("DEMO · DATOS SIMULADOS", true);
    }

    sensoresEnMapa = lecturasEnVivo;
    if (typeof registrarNotificacionesSensores === "function") {
        registrarNotificacionesSensores(sensoresEnMapa, modoDemoSensores);
    }
    if (typeof cargarAlertasCompartidas === "function") {
        await cargarAlertasCompartidas({ silencioso: true });
    }
    actualizarVistaSensores({ fechaTexto: modoDemoSensores ? "Escenario simulado" : "Lecturas consultadas" });
    renderizarMarcadoresSensores();
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

function describirAntiguedadLectura(fecha) {
    if (!(fecha instanceof Date) || !Number.isFinite(fecha.getTime())) return "fecha no disponible";
    const minutos = Math.max(0, Math.floor((Date.now() - fecha.getTime()) / 60000));
    if (minutos < 1) return "hace menos de 1 min";
    if (minutos < 60) return `hace ${minutos} min`;
    const horas = Math.floor(minutos / 60);
    if (horas < 24) return `hace ${horas} h`;
    const dias = Math.floor(horas / 24);
    return `hace ${dias} d`;
}

function actualizarFuenteDatos(texto, esDemo, esAntigua = false, ultimaLectura = null) {
    const badge = document.getElementById("sensor-data-source");
    if (badge) {
        badge.textContent = texto;
        badge.classList.toggle("demo-source", esDemo);
        badge.classList.toggle("api-source", !esDemo);
        badge.classList.toggle("stale-source", esAntigua);
        badge.classList.remove("checking-source");
    }
    const estadoEsp32 = document.getElementById("esp32-connection-state");
    if (estadoEsp32) {
        const antiguedad = ultimaLectura ? describirAntiguedadLectura(ultimaLectura) : "";
        estadoEsp32.textContent = esDemo ? "Demo · ESP32 aún no conectado"
            : esAntigua ? `Lectura antigua · ${antiguedad || "antigua"}`
                : `Dato reciente · ${antiguedad || "hace poco"}`;
        estadoEsp32.title = ultimaLectura && Number.isFinite(ultimaLectura.getTime())
            ? `Último dato recibido: ${new Intl.DateTimeFormat("es-EC", { dateStyle: "medium", timeStyle: "short", timeZone: "America/Guayaquil" }).format(ultimaLectura)}`
            : esDemo ? "Se muestran datos simulados; el ESP32 aún no ha reportado mediciones reales." : "No se dispone de la fecha de la última lectura.";
        estadoEsp32.setAttribute("aria-label", estadoEsp32.title);
        estadoEsp32.classList.toggle("demo-source", esDemo);
        estadoEsp32.classList.toggle("api-source", !esDemo);
        estadoEsp32.classList.toggle("stale-source", esAntigua);
        estadoEsp32.classList.remove("checking-source");
    }
    const note = document.getElementById("alert-center-note");
    if (note) note.textContent = esDemo
        ? "Valores de demostración para un ESP32. No provienen de la maqueta ni sustituyen una evaluación ambiental."
        : "Lecturas reportadas por el único ESP32 de la maqueta. Los colores no indican normalidad porque aún no hay umbrales calibrados.";
}

function actualizarAntiguedadSensor() {
    if (modoDemoSensores || !fechaUltimaLecturaSensor) return;
    const badge = document.getElementById("esp32-connection-state");
    if (!badge) return;
    const edadMs = Date.now() - fechaUltimaLecturaSensor.getTime();
    const esAntigua = edadMs < 0 || edadMs > 10 * 60 * 1000;
    const cambioEstado = lecturaApiReciente === esAntigua;
    lecturaApiReciente = !esAntigua;
    const antiguedad = describirAntiguedadLectura(fechaUltimaLecturaSensor);
    badge.textContent = esAntigua ? `Lectura antigua · ${antiguedad}` : `Dato reciente · ${antiguedad}`;
    badge.classList.toggle("stale-source", esAntigua);
    badge.classList.toggle("api-source", !esAntigua);
    badge.title = `Último dato recibido: ${new Intl.DateTimeFormat("es-EC", { dateStyle: "medium", timeStyle: "short", timeZone: "America/Guayaquil" }).format(fechaUltimaLecturaSensor)}`;
    badge.setAttribute("aria-label", badge.title);
    const mapaBadge = document.getElementById("sensor-data-source");
    if (mapaBadge && cambioEstado) {
        mapaBadge.textContent = esAntigua ? "API · ÚLTIMA LECTURA ANTIGUA" : "API · LECTURA RECIENTE";
        mapaBadge.classList.toggle("stale-source", esAntigua);
        mapaBadge.classList.toggle("api-source", !esAntigua);
    }
    actualizarMetricasDashboard(sensoresEnMapa.map(sensor => sensor.lectura));
    const detalleAbierto = document.getElementById("sensor-detail-content")?.classList.contains("hidden") === false;
    const detalleEstado = document.getElementById("sensor-detail-status");
    if (detalleAbierto && detalleEstado) {
        detalleEstado.textContent = esAntigua ? `Lectura antigua · ${antiguedad}` : `Dato reciente · ${antiguedad}`;
        detalleEstado.classList.toggle("stale-reading", esAntigua);
    }
    if (cambioEstado) actualizarVistaSensores({ fechaTexto: esAntigua ? "Última lectura antigua" : "Lectura reciente" });
}

function instalarEventosMapaSensores() {
    if (mapaSensoresEventosInstalados) return;
    mapaSensoresEventosInstalados = true;
    document.getElementById("sensor-map-refresh")?.addEventListener("click", cargarMapaSensores);
}

function seleccionarCapaMapa(capa) {
    if (!["estado", "temperatura", "humedad", "calidad_aire"].includes(capa)) return;
    capaMapaActual = capa;
    document.querySelectorAll("[data-map-layer]").forEach(button => {
        button.setAttribute("aria-pressed", String(button.dataset.mapLayer === capa));
    });
    renderizarMarcadoresSensores();
}

function nivelLectura() {
    // No se muestran categorías de riesgo hasta acordar límites calibrados para esta maqueta.
    return "unknown";
}

function renderizarMarcadoresSensores() {
    const markerLayer = document.getElementById("sensor-map-model");
    const emptyState = document.getElementById("sensor-map-empty");
    if (!markerLayer || !emptyState) return;

    markerLayer.querySelectorAll(".city-lamp-marker").forEach(marker => marker.remove());
    const visibles = sensoresEnMapa.map((sensor, index) => ({ ...sensor, index }));

    emptyState.classList.toggle("hidden", visibles.length > 0);
    emptyState.textContent = sensoresEnMapa.length
        ? "No hay un ESP32 que mostrar."
        : modoDemoSensores ? "Cargando el escenario simulado…" : "Aún no hay lecturas para mostrar.";

    visibles.forEach(sensor => {
        const position = SENSOR_MAP_POSITIONS[sensor.index % SENSOR_MAP_POSITIONS.length];
        const marker = document.createElement("button");
        const level = nivelLectura(sensor.lectura, capaMapaActual);
        marker.type = "button";
        marker.className = "city-lamp-marker" + (sensor.id === sensorEnDetalle ? " selected" : "");
        marker.dataset.level = level;
        marker.dataset.source = modoDemoSensores ? "demo" : "api";
        marker.dataset.position = `${position.x}m ${position.y}m ${position.z}m`;
        marker.dataset.normal = "0m 1m 0m";
        marker.slot = `hotspot-sensor-${sensor.index}`;
        marker.setAttribute("aria-label", `Controlador ESP32 ${sensor.id}; ${level === "unknown" ? "lectura disponible, sin umbrales configurados" : "estado no disponible"}. Ver lecturas.`);
        marker.title = `${sensor.id} · ${capaMapaActual === "estado" ? "Estado" : capaMapaActual.replace("_", " ")}: ${formatearValorSensor(sensor.lectura[capaMapaActual] ?? sensor.lectura.temperatura)}`;

        const board = document.createElement("span");
        board.className = "esp32-map-icon";
        board.textContent = "ESP32";
        board.setAttribute("aria-hidden", "true");
        const label = document.createElement("span");
        label.className = "city-lamp-label";
        label.textContent = modoDemoSensores ? "ESP32 · MAQUETA" : sensor.id;
        marker.append(board, label);
        marker.addEventListener("click", () => mostrarDetalleSensor(sensor));
        markerLayer.appendChild(marker);
    });
}

function valoresFueraDeRango(lectura) {
    // No generar alertas automáticas hasta definir rangos verificados para sensores calibrados.
    return [];
}

function actualizarVistaSensores({ fechaTexto = "Ahora" } = {}) {
    actualizarMetricasDashboard(sensoresEnMapa.map(sensor => sensor.lectura));
    actualizarBadgeAlertasSensores(sensoresEnMapa);
    const ahora = new Date().toLocaleTimeString("es-EC", { hour: "2-digit", minute: "2-digit" });
    const label = document.getElementById("pulse-status-label");
    const count = document.getElementById("pulse-sensor-count");
    const alerts = document.getElementById("pulse-alert-count");
    const updated = document.getElementById("pulse-updated");
    if (label) label.textContent = modoDemoSensores ? "Datos de demostración" : lecturaApiReciente ? "Lectura reciente desde la API" : "Última lectura antigua · revisar ESP32";
    const summary = document.getElementById("city-pulse-summary");
    const strip = document.getElementById("urban-pulse-strip");
    const dashboardSource = document.getElementById("dashboard-source-summary");
    if (dashboardSource) dashboardSource.textContent = modoDemoSensores
        ? "Valores demostrativos para un solo ESP32; todavía no son mediciones de la maqueta."
        : lecturaApiReciente ? "Un ESP32 envía a la API las mediciones de los sensores de la maqueta."
            : "La API conserva una lectura anterior; comprueba que el ESP32 siga enviando datos.";
    if (summary) summary.textContent = modoDemoSensores
        ? "Un marcador de referencia representa el ESP32; las lecturas son demostrativas."
        : lecturaApiReciente ? "Un ESP32 concentra y reporta las lecturas de todos los sensores conectados."
            : "Se muestra la última lectura almacenada. La conexión del ESP32 necesita revisión.";
    if (strip) strip.dataset.source = modoDemoSensores ? "demo" : lecturaApiReciente ? "api" : "stale";
    if (count) count.textContent = String(sensoresEnMapa.length);
    if (alerts) alerts.textContent = String(sensoresEnMapa.filter(sensor => valoresFueraDeRango(sensor.lectura).length).length);
    if (updated) updated.textContent = `${fechaTexto} · actualización ${ahora}`;

    const lista = document.getElementById("alert-center-list");
    const total = document.getElementById("alert-center-count");
    if (!lista) return;
    const observaciones = sensoresEnMapa.flatMap(sensor => valoresFueraDeRango(sensor.lectura)
        .map(valor => ({ sensor, valor, metrica: valor.split(/\s+/)[0] })));
    lista.replaceChildren();
    const hayReportesDeUsuarios = typeof alertasCompartidas !== "undefined"
        && alertasCompartidas.some(alerta => alerta.origen === "usuario");
    if (!observaciones.length && !hayReportesDeUsuarios) {
        const vacio = document.createElement("div");
        vacio.className = "alert-empty-state";
        const puedeAtender = typeof puedeGestionarAlertas === "function" && puedeGestionarAlertas();
        vacio.innerHTML = `<span aria-hidden="true">✓</span><div><strong>${puedeAtender ? "Todo al día" : "Sin novedades por ahora"}</strong><p>${modoDemoSensores ? "Las lecturas mostradas son una referencia de demostración; aquí aparecerán tus reportes." : puedeAtender ? "No hay avisos pendientes. Las lecturas no se clasifican como seguras o peligrosas hasta calibrar sus umbrales." : "Aquí aparecerán tus reportes y los cambios de estado. Los datos de sensores se muestran sin umbrales calibrados."}</p></div>`;
        lista.appendChild(vacio);
    }
    observaciones.forEach(({ sensor, valor, metrica }) => {
        const guardada = typeof alertaSensorGuardada === "function"
            ? alertaSensorGuardada(sensor.id, metrica)
            : null;
        const alerta = {
            ...guardada,
            id: guardada?.id || null,
            origen: "sensor",
            sensor_id: sensor.id,
            metrica,
            titulo: `Lectura fuera de rango · ${metrica}`,
            descripcion: valor,
            estado: guardada?.estado || "pendiente"
        };
        const item = document.createElement("article");
        item.className = `alert-item alert-item--${alerta.estado}`;
        item.dataset.alertStatus = alerta.estado;
        if (alerta.id) item.dataset.alertaId = String(alerta.id);
        if (typeof prepararAnimacionAlerta === "function") {
            prepararAnimacionAlerta(item, `sensor:${sensor.id}:${metrica}`, alerta);
        }
        const main = document.createElement("div");
        main.className = "alert-item-main";
        const texto = document.createElement("div");
        const sensorLabel = document.createElement("strong");
        sensorLabel.textContent = sensor.id;
        const detail = document.createElement("p");
        detail.textContent = valor;
        texto.append(sensorLabel, detail);
        if (guardada && typeof crearHistorialVisualAlerta === "function") {
            texto.appendChild(crearHistorialVisualAlerta(guardada));
        }
        main.appendChild(texto);

        const controls = document.createElement("div");
        controls.className = "alert-item-controls";
        const statusControl = typeof crearControlEstadoAlerta === "function"
            ? crearControlEstadoAlerta(alerta, (estado, observacion, button, select, observation, feedback) => {
                void cambiarEstadoAlerta(alerta, estado, observacion, button, select, observation, feedback);
            })
            : document.createTextNode("Pendiente");

        const button = document.createElement("button");
        button.type = "button";
        button.className = "alert-view-button";
        button.textContent = "Ver en mapa";
        button.addEventListener("click", () => {
            if (typeof navegarA === "function") navegarA("dashboard");
            mostrarDetalleSensor(sensor);
        });
        controls.append(statusControl, button);
        item.append(main, controls);
        lista.appendChild(item);
    });
    if (typeof renderizarAlertasReportadas === "function") renderizarAlertasReportadas(lista);
    actualizarResumenEstadosAlertas();
}

function actualizarResumenEstadosAlertas() {
    const lista = document.getElementById("alert-center-list");
    const total = document.getElementById("alert-center-count");
    if (!lista || !total) return;
    const estados = Array.from(lista.querySelectorAll("[data-alert-status]"), element => element.dataset.alertStatus);
    const pendientes = estados.filter(estado => estado === "pendiente").length;
    const enProceso = estados.filter(estado => estado === "en_proceso").length;
    const resueltas = estados.filter(estado => estado === "resuelto").length;
    total.textContent = `${estados.length} ${estados.length === 1 ? "alerta" : "alertas"} · ${pendientes} pendientes · ${enProceso} en proceso · ${resueltas} resueltas`;
    if (typeof actualizarFiltrosAlertas === "function") actualizarFiltrosAlertas();
}

function actualizarBadgeAlertasSensores(sensores) {
    const badge = document.getElementById("sensor-alert-badge");
    if (!badge) return;
    const fueraDeRango = sensores.filter(({ lectura }) => valoresFueraDeRango(lectura).length).length;
    badge.textContent = fueraDeRango > 99 ? "99+" : String(fueraDeRango);
    badge.setAttribute("aria-label", `${fueraDeRango} lecturas fuera de umbrales configurados`);
    badge.title = "No hay umbrales calibrados. Los avisos los reportan los usuarios; el administrador actualiza su estado.";
    badge.classList.toggle("hidden", fueraDeRango === 0);
}

function actualizarMetricasDashboard(lecturas) {
    const valores = campo => (lecturas || [])
        .map(lectura => lectura[campo])
        .filter(value => value !== null && value !== undefined && value !== "" && Number.isFinite(Number(value)))
        .map(Number);
    const promedio = campo => {
        const disponibles = valores(campo);
        return disponibles.length ? disponibles.reduce((suma, value) => suma + value, 0) / disponibles.length : null;
    };
    const formato = value => new Intl.NumberFormat("es-EC", { maximumFractionDigits: 1 }).format(value);
    const asignar = (id, valor) => {
        const node = document.getElementById(id);
        if (node) {
            node.textContent = valor;
            node.classList.remove("skeleton-loading");
        }
    };
    const fechaLectura = lecturas
        .filter(lectura => lectura.fecha_hora)
        .map(lectura => new Date(lectura.fecha_hora))
        .filter(fecha => Number.isFinite(fecha.getTime()))
        .sort((a, b) => b - a)[0];
    const edadLecturaMs = fechaLectura ? Date.now() - fechaLectura.getTime() : 0;
    const lecturaEsAntigua = Boolean(fechaLectura && (edadLecturaMs < 0 || edadLecturaMs > 10 * 60 * 1000));
    const fuente = (id, disponible) => {
        const source = document.getElementById(id);
        if (!source) return;
        source.textContent = !disponible
            ? "Sin lectura recibida"
            : modoDemoSensores ? "Demo · valor de referencia"
                : `ESP32 · ${fechaLectura ? describirAntiguedadLectura(fechaLectura) : "hora no disponible"}`;
        source.dataset.source = !disponible ? "missing" : modoDemoSensores ? "demo" : lecturaEsAntigua ? "stale" : "api";
    };
    const temp = promedio("temperatura");
    const humedad = promedio("humedad");
    const aire = promedio("calidad_aire");
    const distancia = promedio("distancia_cm");
    const luz = promedio("luminosidad");
    const agua = promedio("nivel_agua");
    asignar("metric-temp", temp === null ? "— °C" : `${formato(temp)} °C`);
    asignar("metric-hum", humedad === null ? "— %" : `${formato(humedad)} %`);
    asignar("metric-aire", aire === null ? "— ICA" : `${formato(aire)} ICA`);
    asignar("metric-distance", distancia === null ? "— cm" : `${formato(distancia)} cm`);
    asignar("metric-light", luz === null ? "—" : formato(luz));
    asignar("metric-water-level", agua === null ? "—" : formato(agua));

    const lluvia = (lecturas || []).find(lectura => lectura.lluvia_detectada !== null && lectura.lluvia_detectada !== undefined);
    asignar("metric-rain", lluvia
        ? (lluvia.lluvia_detectada ? "Lluvia detectada" : "Sin lluvia")
        : "Sin lectura");
    const tcrt = (lecturas || []).find(lectura => lectura.tcrt5000_detectado !== null && lectura.tcrt5000_detectado !== undefined);
    const reflejo = promedio("reflectancia_tcrt5000");
    asignar("metric-tcrt5000", tcrt
        ? (tcrt.tcrt5000_detectado ? "Objeto detectado" : "Sin detección")
        : reflejo === null ? "Sin lectura" : `Lectura ${formato(reflejo)}`);
    fuente("metric-temp-source", temp !== null);
    fuente("metric-hum-source", humedad !== null);
    fuente("metric-aire-source", aire !== null);
    fuente("metric-distance-source", distancia !== null);
    fuente("metric-rain-source", Boolean(lluvia));
    fuente("metric-light-source", luz !== null);
    fuente("metric-water-source", agua !== null);
    fuente("metric-tcrt-source", Boolean(tcrt) || reflejo !== null);

    // Evita clasificar valores como seguros o peligrosos sin umbrales calibrados para la maqueta.
    ["metric-temp", "metric-hum", "metric-aire"].forEach(id => {
        const card = document.getElementById(id)?.closest(".dashboard-metric-card");
        if (card) delete card.dataset.readingState;
    });
}

function mostrarDetalleSensor(sensor) {
    if (!sensor) return;
    sensorEnDetalle = sensor.id;
    renderizarMarcadoresSensores();
    const lectura = sensor.lectura;
    const fecha = lectura.fecha_hora ? new Date(lectura.fecha_hora) : null;
    const fechaValida = fecha && !Number.isNaN(fecha.getTime());
    const element = id => document.getElementById(id);

    element("sensor-detail-id").textContent = `ESP32 ${sensor.id}`;
    const detailStatus = element("sensor-detail-status");
    const fechaDetalleAntigua = fechaValida && Date.now() - fecha.getTime() > 10 * 60 * 1000;
    detailStatus.textContent = modoDemoSensores ? "Dato de demostración"
        : `${fechaDetalleAntigua ? "Lectura antigua" : "Dato reciente"} · ${fechaValida ? describirAntiguedadLectura(fecha) : "hora no disponible"}`;
    detailStatus.classList.toggle("has-reading", !modoDemoSensores && !fechaDetalleAntigua);
    detailStatus.classList.toggle("stale-reading", !modoDemoSensores && fechaDetalleAntigua);
    element("sensor-detail-message").textContent = modoDemoSensores
        ? "Valores de referencia para un ESP32; no provienen de la maqueta."
        : fechaDetalleAntigua ? "Se conserva el último dato recibido; revisa la conexión del ESP32."
            : "Últimas lecturas reportadas por el ESP32 de la maqueta.";
    element("sensor-detail-content").classList.remove("hidden");
    element("sensor-detail-temperature").textContent = `${formatearValorSensor(lectura.temperatura)} °C`;
    element("sensor-detail-humidity").textContent = `${formatearValorSensor(lectura.humedad)} %`;
    element("sensor-detail-air").textContent = `${formatearValorSensor(lectura.calidad_aire)} ICA`;
    element("sensor-detail-distance").textContent = lectura.distancia_cm == null ? "—" : `${formatearValorSensor(lectura.distancia_cm)} cm`;
    element("sensor-detail-rain").textContent = lectura.lluvia_detectada == null ? "—" : lectura.lluvia_detectada ? "Detectada" : "No detectada";
    element("sensor-detail-light").textContent = lectura.luminosidad == null ? "—" : formatearValorSensor(lectura.luminosidad);
    element("sensor-detail-water-level").textContent = lectura.nivel_agua == null ? "—" : formatearValorSensor(lectura.nivel_agua);
    element("sensor-detail-tcrt-detected").textContent = lectura.tcrt5000_detectado == null ? "—" : lectura.tcrt5000_detectado ? "Objeto detectado" : "Sin detección";
    element("sensor-detail-tcrt-reflectance").textContent = lectura.reflectancia_tcrt5000 == null ? "—" : formatearValorSensor(lectura.reflectancia_tcrt5000);
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
    if (value === null || value === undefined || value === "") return "—";
    const number = Number(value);
    return Number.isFinite(number)
        ? new Intl.NumberFormat("es-EC", { maximumFractionDigits: 1 }).format(number)
        : "—";
}
