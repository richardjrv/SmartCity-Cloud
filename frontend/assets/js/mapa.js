// Posiciones de luminarias en metros sobre el modelo ciudad.glb (escena recreada).
const SENSOR_MAP_POSITIONS = [
    { x: -15, z: -50 }, { x: -2, z: -50 }, { x: 12, z: -50 }, { x: 27, z: -50 },
    { x: -15, z: -35 }, { x: -2, z: -35 }, { x: 12, z: -35 }, { x: 27, z: -35 },
    { x: -15, z: -20 }, { x: -2, z: -20 }, { x: 12, z: -20 }, { x: 27, z: -20 },
    { x: -15, z: -5 }, { x: -2, z: -5 }, { x: 12, z: -5 }, { x: 27, z: -5 },
    { x: -15, z: 10 }, { x: -2, z: 10 }, { x: 12, z: 10 }, { x: 27, z: 10 }
];

let sensoresEnMapa = [];
let sensorEnDetalle = null;
let mapaSensoresEventosInstalados = false;

async function cargarMapaSensores() {
    const markerLayer = document.getElementById("sensor-map-model");
    const emptyState = document.getElementById("sensor-map-empty");
    if (!markerLayer || !emptyState) return;

    emptyState.textContent = "Cargando lecturas de sensores…";
    emptyState.classList.remove("hidden");
    markerLayer.querySelectorAll(".city-lamp-marker").forEach(marker => marker.remove());
    instalarEventosMapaSensores();

    try {
        const { ok, data } = await apiFetch("/sensores/ultimas");
        if (!ok || !Array.isArray(data)) throw new Error("No se pudieron obtener las lecturas.");

        const lecturasPorSensor = new Map();
        data.forEach(lectura => {
            const id = String(lectura.sensor_id ?? "").trim();
            if (id && !lecturasPorSensor.has(id)) lecturasPorSensor.set(id, lectura);
        });
        sensoresEnMapa = Array.from(lecturasPorSensor, ([id, lectura]) => ({ id, lectura }));

        const actualizado = document.getElementById("sensor-map-updated");
        if (actualizado) actualizado.textContent = `Datos consultados: ${new Date().toLocaleTimeString("es-EC", { hour: "2-digit", minute: "2-digit" })}`;

        renderizarMarcadoresSensores(document.getElementById("sensor-map-search")?.value || "");
        const sensorSeleccionado = sensoresEnMapa.find(sensor => sensor.id === sensorEnDetalle);
        if (sensorSeleccionado) {
            mostrarDetalleSensor(sensorSeleccionado);
        } else if (sensoresEnMapa.length) {
            mostrarDetalleSensor(sensoresEnMapa[0]);
        } else {
            sensorEnDetalle = null;
            mostrarDetalleVacio("Aún no hay lecturas para mostrar.");
        }
    } catch (error) {
        console.error("Error cargando el mapa de sensores:", error);
        sensorEnDetalle = null;
        emptyState.textContent = "No se pudieron cargar las lecturas. Intenta actualizar.";
        emptyState.classList.remove("hidden");
        mostrarDetalleVacio("No hay datos disponibles en este momento.");
    }
}

function instalarEventosMapaSensores() {
    if (mapaSensoresEventosInstalados) return;
    mapaSensoresEventosInstalados = true;
    document.getElementById("sensor-map-refresh")?.addEventListener("click", cargarMapaSensores);
    document.getElementById("sensor-map-search")?.addEventListener("input", event => {
        renderizarMarcadoresSensores(event.currentTarget.value);
    });
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
        : "Aún no hay lecturas para mostrar.";

    visibles.forEach(sensor => {
        const position = SENSOR_MAP_POSITIONS[sensor.index % SENSOR_MAP_POSITIONS.length];
        const marker = document.createElement("button");
        marker.type = "button";
        marker.className = "city-lamp-marker" + (sensor.id === sensorEnDetalle ? " selected" : "");
        marker.slot = `hotspot-sensor-${sensor.index}`;
        marker.dataset.position = `${position.x}m 0.15m ${position.z}m`;
        marker.dataset.normal = "0m 1m 0m";
        marker.setAttribute("aria-label", `Luminaria inteligente con sensor ${sensor.id}. Ver última lectura.`);
        marker.title = `Luminaria · Sensor ${sensor.id}`;

        const lamp = document.createElement("span");
        lamp.className = "city-lamp";
        lamp.setAttribute("aria-hidden", "true");
        const sensorBox = document.createElement("span");
        sensorBox.className = "city-lamp-sensor";
        sensorBox.setAttribute("aria-hidden", "true");
        const label = document.createElement("span");
        label.className = "city-lamp-label";
        label.textContent = `Sensor ${sensor.id}`;
        marker.append(lamp, sensorBox, label);
        marker.addEventListener("click", () => mostrarDetalleSensor(sensor));
        markerLayer.appendChild(marker);
    });
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
    element("sensor-detail-status").textContent = "Con lecturas";
    element("sensor-detail-status").classList.add("has-reading");
    element("sensor-detail-message").textContent = "Sensor instalado en una luminaria de la escena urbana simulada.";
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
