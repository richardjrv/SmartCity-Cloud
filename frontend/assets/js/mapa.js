const SENSOR_MAP_POSITIONS = [
    { x: 18, y: 24 }, { x: 48, y: 20 }, { x: 80, y: 27 },
    { x: 28, y: 48 }, { x: 70, y: 49 }, { x: 18, y: 76 },
    { x: 51, y: 78 }, { x: 83, y: 75 }, { x: 39, y: 35 },
    { x: 61, y: 64 }
];

let sensoresEnMapa = [];
let sensorEnDetalle = null;
let mapaSensoresEventosInstalados = false;

async function cargarMapaSensores() {
    const markerLayer = document.getElementById("sensor-map-markers");
    const emptyState = document.getElementById("sensor-map-empty");
    if (!markerLayer || !emptyState) return;

    emptyState.textContent = "Cargando lecturas de sensores…";
    emptyState.classList.remove("hidden");
    markerLayer.replaceChildren();
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
        if (sensoresEnMapa.length && !sensoresEnMapa.some(sensor => sensor.id === sensorEnDetalle)) {
            mostrarDetalleSensor(sensoresEnMapa[0]);
        }
    } catch (error) {
        console.error("Error cargando el mapa de sensores:", error);
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
    const markerLayer = document.getElementById("sensor-map-markers");
    const emptyState = document.getElementById("sensor-map-empty");
    if (!markerLayer || !emptyState) return;

    markerLayer.replaceChildren();
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
        marker.className = "sensor-map-marker" + (sensor.id === sensorEnDetalle ? " selected" : "");
        marker.style.left = `${position.x}%`;
        marker.style.top = `${position.y}%`;
        marker.setAttribute("aria-label", `Ver lectura del sensor ${sensor.id}`);
        marker.title = `Sensor ${sensor.id}`;

        const dot = document.createElement("span");
        dot.className = "sensor-marker-dot";
        const label = document.createElement("span");
        label.className = "sensor-marker-label";
        label.textContent = sensor.id;
        marker.append(dot, label);
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
    element("sensor-detail-message").textContent = "Últimos valores recibidos desde la API.";
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
