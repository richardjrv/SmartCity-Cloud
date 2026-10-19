// Historial real del único ESP32. Cada variable mantiene su escala y unidad.
const chartSensorConfig = [
    { id: "hc-sr04", name: "HC-SR04", icon: "📏", description: "Distancia de proximidad", fields: [{ key: "distancia_cm", label: "Distancia", unit: "cm", color: "#c084fc" }] },
    { id: "lluvia", name: "Sensor de lluvia", icon: "🌧️", description: "Presencia de lluvia", fields: [{ key: "lluvia_detectada", label: "Detección", kind: "boolean", trueLabel: "Sí", falseLabel: "No", color: "#38bdf8" }] },
    { id: "ldr", name: "LDR", icon: "☀️", description: "Luminosidad; lectura sin calibrar", fields: [{ key: "luminosidad", label: "Luminosidad", unit: "lectura", color: "#fbbf24" }] },
    { id: "nivel-agua", name: "Nivel de agua", icon: "💧", description: "Lectura cruda; requiere calibración para expresarla en porcentaje", fields: [{ key: "nivel_agua", label: "Nivel", unit: "lectura", color: "#2dd4bf" }] },
    { id: "dht22", name: "DHT22", icon: "🌡️", description: "Temperatura y humedad ambiental", fields: [
        { key: "temperatura", label: "Temperatura", unit: "°C", color: "#38bdf8" },
        { key: "humedad", label: "Humedad", unit: "%", color: "#34d399" }
    ] },
    { id: "tcrt5000", name: "TCRT5000", icon: "🚘", description: "Reflectancia infrarroja y detección", fields: [
        { key: "reflectancia_tcrt5000", label: "Reflectancia", unit: "lectura", color: "#fb7185" },
        { key: "tcrt5000_detectado", label: "Detección", kind: "boolean", trueLabel: "Sí", falseLabel: "No", color: "#f97316" }
    ] },
    { id: "calidad-aire", name: "Calidad del aire", icon: "🍃", description: "Dato adicional; solo aparece si el ESP32 lo reporta", optional: true, fields: [{ key: "calidad_aire", label: "Respuesta del sensor", unit: "lectura", color: "#a3e635" }] }
];
const convertirNumeroLectura = valor => valor === null || valor === undefined || valor === "" ? NaN : Number(valor);
let chartReadings = [];
let homeTrendReadings = [];
let homeTrendLoadedAt = 0;
let homeTrendRequest = null;

function chartCssColor(name, fallback) {
    return getComputedStyle(document.documentElement).getPropertyValue(name).trim() || fallback;
}

function valorCampoGrafica(valor, config) {
    if (config.kind === "boolean") {
        if (typeof valor === "boolean") return valor ? 1 : 0;
        if (valor === 1 || valor === "1") return 1;
        if (valor === 0 || valor === "0") return 0;
        return NaN;
    }
    return convertirNumeroLectura(valor);
}

function puntosCampoGrafica(config) {
    return chartReadings.map(row => ({ date: new Date(row.fecha_hora), value: valorCampoGrafica(row[config.key], config) }))
        .filter(point => Number.isFinite(point.value) && !Number.isNaN(point.date.getTime()));
}

function formatoFechaGrafica(date, period) {
    const format = { hour: "2-digit", minute: "2-digit" };
    if (period >= 24) { format.day = "2-digit"; format.month = "short"; }
    return date.toLocaleString("es-EC", format);
}

function prepararCanvas(canvas, height) {
    const ratio = Math.min(window.devicePixelRatio || 1, 2);
    const width = Math.max(1, Math.floor(canvas.parentElement?.clientWidth || canvas.clientWidth || 1));
    canvas.width = Math.round(width * ratio);
    canvas.height = Math.round(height * ratio);
    canvas.style.height = `${height}px`;
    const context = canvas.getContext("2d");
    if (!context) return null;
    context.setTransform(ratio, 0, 0, ratio, 0, 0);
    context.clearRect(0, 0, width, height);
    return { context, width, height };
}

function dibujarActividadGeneral() {
    const canvas = document.getElementById("chart-overview-canvas");
    const empty = document.getElementById("chart-overview-empty");
    if (!canvas) return;
    if (!chartReadings.length) {
        canvas.classList.add("hidden");
        if (empty) { empty.classList.remove("hidden"); empty.textContent = "No hay registros reales en este periodo. Amplía el rango o confirma que el ESP32 y la API estén guardando el historial."; }
        const summary = document.getElementById("chart-data-summary");
        if (summary) summary.textContent = "Sin registros en el periodo seleccionado.";
        return;
    }
    canvas.classList.remove("hidden");
    empty?.classList.add("hidden");
    const result = prepararCanvas(canvas, 300);
    if (!result) return;
    const { context, width, height } = result;
    const period = Number(document.getElementById("chart-period")?.value || 24);
    const bucketCount = period <= 1 ? 6 : period <= 10 ? 10 : period <= 24 ? 12 : 14;
    const values = Array(bucketCount).fill(0);
    const start = Date.now() - period * 60 * 60 * 1000;
    const duration = period * 60 * 60 * 1000;
    chartReadings.forEach(row => {
        const date = new Date(row.fecha_hora).getTime();
        if (!Number.isFinite(date)) return;
        const index = Math.max(0, Math.min(bucketCount - 1, Math.floor(((date - start) / duration) * bucketCount)));
        values[index] += 1;
    });

    const colors = getComputedStyle(document.documentElement);
    const text = colors.getPropertyValue("--text-secondary").trim() || "#94a3b8";
    const grid = colors.getPropertyValue("--border-color").trim() || "#334155";
    const padding = { top: 24, right: 18, bottom: 42, left: 48 };
    const plotWidth = width - padding.left - padding.right;
    const plotHeight = height - padding.top - padding.bottom;
    const max = Math.max(1, ...values);
    const axisMax = Math.max(1, Math.ceil(max / 4)) * 4;
    context.font = "11px system-ui, sans-serif";
    context.textAlign = "right";
    context.textBaseline = "middle";
    for (let tick = 0; tick <= 4; tick += 1) {
        const value = axisMax - (axisMax / 4) * tick;
        const y = padding.top + (plotHeight / 4) * tick;
        context.strokeStyle = grid; context.globalAlpha = .48;
        context.beginPath(); context.moveTo(padding.left, y); context.lineTo(width - padding.right, y); context.stroke();
        context.globalAlpha = 1; context.fillStyle = text; context.fillText(String(Math.round(value)), padding.left - 9, y);
    }
    const slot = plotWidth / bucketCount;
    values.forEach((value, index) => {
        const barHeight = (value / axisMax) * plotHeight;
        const x = padding.left + index * slot + Math.max(2, slot * .16);
        const barWidth = Math.max(2, slot * .68);
        const y = padding.top + plotHeight - barHeight;
        context.fillStyle = "#38bdf8";
        context.globalAlpha = value ? .82 : .2;
        context.fillRect(x, y, barWidth, Math.max(value ? 2 : 1, barHeight));
        context.globalAlpha = 1;
    });
    context.fillStyle = text; context.textAlign = "center"; context.textBaseline = "top";
    const last = new Date();
    const first = new Date(start);
    const middle = new Date(start + duration / 2);
    [first, middle, last].forEach((date, index) => {
        const x = index === 0 ? padding.left : index === 1 ? padding.left + plotWidth / 2 : padding.left + plotWidth;
        context.fillText(formatoFechaGrafica(date, period), x, height - padding.bottom + 14);
    });
    const summary = document.getElementById("chart-data-summary");
    if (summary) summary.textContent = `${chartReadings.length} registros · actividad agrupada en ${bucketCount} intervalos`;
}

function dibujarGraficaCampo(canvas, empty, summary, config) {
    const points = puntosCampoGrafica(config);
    if (!points.length) {
        canvas.classList.add("hidden");
        empty.classList.remove("hidden");
        empty.textContent = `No hay lecturas de ${config.label.toLowerCase()} en el rango elegido. Prueba otro periodo o espera el próximo envío del ESP32.`;
        summary.textContent = "Sin datos en el periodo seleccionado.";
        return false;
    }
    canvas.classList.remove("hidden");
    empty.classList.add("hidden");
    const result = prepararCanvas(canvas, 174);
    if (!result) return false;
    const { context, width, height } = result;
    const text = chartCssColor("--text-secondary", "#94a3b8");
    const grid = chartCssColor("--border-color", "#334155");
    const padding = { top: 15, right: 12, bottom: 32, left: config.kind === "boolean" ? 58 : 48 };
    const plotWidth = width - padding.left - padding.right;
    const plotHeight = height - padding.top - padding.bottom;
    let min = config.kind === "boolean" ? 0 : Math.min(...points.map(point => point.value));
    let max = config.kind === "boolean" ? 1 : Math.max(...points.map(point => point.value));
    const spread = max - min || Math.max(Math.abs(max) * .12, 1);
    if (config.kind !== "boolean") { min -= spread * .14; max += spread * .14; }
    const firstTime = points[0].date.getTime();
    const lastTime = points.at(-1).date.getTime();
    const xFor = index => points.length < 2 ? padding.left + plotWidth / 2
        : padding.left + (lastTime === firstTime ? index / (points.length - 1) : (points[index].date.getTime() - firstTime) / (lastTime - firstTime)) * plotWidth;
    const yFor = value => padding.top + ((max - value) / (max - min || 1)) * plotHeight;
    context.font = "10px system-ui, sans-serif";
    context.textAlign = "right"; context.textBaseline = "middle";
    for (let tick = 0; tick <= 3; tick += 1) {
        const y = padding.top + (plotHeight / 3) * tick;
        const value = max - ((max - min) / 3) * tick;
        context.strokeStyle = grid; context.globalAlpha = .45;
        context.beginPath(); context.moveTo(padding.left, y); context.lineTo(width - padding.right, y); context.stroke();
        context.globalAlpha = 1; context.fillStyle = text;
        const label = config.kind === "boolean" ? (tick === 0 ? config.trueLabel : tick === 3 ? config.falseLabel : "") : value.toFixed(config.unit === "lectura" ? 0 : 1);
        if (label) context.fillText(label, padding.left - 7, y);
    }
    context.beginPath();
    points.forEach((point, index) => {
        const x = xFor(index); const y = yFor(point.value);
        if (index === 0) context.moveTo(x, y);
        else if (config.kind === "boolean") {
            context.lineTo(x, yFor(points[index - 1].value));
            context.lineTo(x, y);
        } else context.lineTo(x, y);
    });
    context.strokeStyle = config.color; context.lineWidth = 2.2; context.lineJoin = "round"; context.lineCap = "round"; context.stroke();
    points.forEach((point, index) => {
        if (points.length > 30 && index % Math.ceil(points.length / 15) !== 0 && index !== points.length - 1) return;
        context.beginPath(); context.arc(xFor(index), yFor(point.value), 2.7, 0, Math.PI * 2);
        context.fillStyle = config.color; context.fill();
    });
    context.fillStyle = text; context.textAlign = "center"; context.textBaseline = "top";
    [points[0], points[Math.floor((points.length - 1) / 2)], points.at(-1)].forEach((point, index) => {
        const x = index === 0 ? padding.left : index === 1 ? padding.left + plotWidth / 2 : padding.left + plotWidth;
        context.fillText(formatoFechaGrafica(point.date, Number(document.getElementById("chart-period")?.value || 24)), x, height - padding.bottom + 10);
    });
    if (config.kind === "boolean") {
        const detections = points.filter(point => point.value === 1).length;
        summary.textContent = `${detections} detecciones · ${points.length} lecturas registradas`;
    } else {
        const values = points.map(point => point.value);
        const average = values.reduce((sum, value) => sum + value, 0) / values.length;
        const unit = config.unit ? ` ${config.unit}` : "";
        summary.textContent = `${points.length} lecturas · promedio ${average.toFixed(1)}${unit} · mín. ${Math.min(...values).toFixed(1)} · máx. ${Math.max(...values).toFixed(1)}`;
    }
    return true;
}

function crearTarjetasSensores() {
    const container = document.getElementById("chart-sensor-grid");
    if (!container || container.childElementCount) return;
    chartSensorConfig.forEach(sensor => {
        const card = document.createElement("article");
        card.className = "chart-sensor-card";
        card.dataset.chartSensor = sensor.id;
        if (sensor.optional) { card.dataset.optionalSensor = "true"; card.hidden = true; }
        const heading = document.createElement("div");
        heading.className = "chart-sensor-heading";
        const icon = document.createElement("span"); icon.className = "chart-sensor-icon"; icon.setAttribute("aria-hidden", "true"); icon.textContent = sensor.icon;
        const titleGroup = document.createElement("div");
        const title = document.createElement("h4"); title.textContent = sensor.name;
        const description = document.createElement("p"); description.textContent = sensor.description;
        titleGroup.append(title, description);
        const status = document.createElement("span"); status.className = "chart-sensor-status"; status.dataset.chartSensorStatus = ""; status.textContent = "Esperando datos";
        heading.append(icon, titleGroup, status);
        card.appendChild(heading);
        sensor.fields.forEach(field => {
            const fieldSection = document.createElement("section"); fieldSection.className = "chart-sensor-field";
            const fieldTitle = document.createElement("h5"); fieldTitle.textContent = field.label;
            const wrap = document.createElement("div"); wrap.className = "chart-sensor-chart-wrap";
            const canvas = document.createElement("canvas"); canvas.className = "chart-sensor-canvas hidden"; canvas.setAttribute("role", "img");
            canvas.setAttribute("aria-label", `Historial de ${field.label.toLowerCase()} del sensor ${sensor.name}`);
            const empty = document.createElement("p"); empty.className = "chart-sensor-empty"; empty.setAttribute("role", "status"); empty.textContent = "Esperando historial…";
            wrap.append(canvas, empty);
            const summary = document.createElement("p"); summary.className = "chart-sensor-summary";
            fieldSection.append(fieldTitle, wrap, summary);
            card.appendChild(fieldSection);
        });
        container.appendChild(card);
    });
}

function actualizarResumenSensores() {
    let sensorsWithData = 0;
    chartSensorConfig.forEach(sensor => {
        const card = document.querySelector(`[data-chart-sensor="${sensor.id}"]`);
        if (!card) return;
        const hasData = sensor.fields.some(field => puntosCampoGrafica(field).length > 0);
        if (sensor.optional && !hasData) { card.hidden = true; return; }
        card.hidden = false;
        const status = card.querySelector("[data-chart-sensor-status]");
        if (status) { status.textContent = hasData ? "Con lecturas" : "Sin lecturas"; status.classList.toggle("has-data", hasData); }
        if (hasData) sensorsWithData += 1;
    });
    const count = document.getElementById("chart-active-sensors");
    if (count) count.textContent = String(sensorsWithData);
}

function dibujarTodasLasGraficas() {
    dibujarActividadGeneral();
    document.querySelectorAll("[data-chart-sensor]").forEach(card => {
        const sensor = chartSensorConfig.find(item => item.id === card.dataset.chartSensor);
        if (!sensor) return;
        if (sensor.optional) {
            const hasAnyData = sensor.fields.some(field => puntosCampoGrafica(field).length > 0);
            card.hidden = !hasAnyData;
            if (!hasAnyData) return;
        }
        let hasData = false;
        sensor.fields.forEach((field, index) => {
            const section = card.querySelectorAll(".chart-sensor-field")[index];
            if (!section) return;
            hasData = dibujarGraficaCampo(section.querySelector("canvas"), section.querySelector(".chart-sensor-empty"), section.querySelector(".chart-sensor-summary"), field) || hasData;
        });
        const status = card.querySelector("[data-chart-sensor-status]");
        if (status && !sensor.optional) {
            status.textContent = hasData ? "Con lecturas" : "Sin lecturas";
            status.classList.toggle("has-data", hasData);
        }
    });
    actualizarResumenSensores();
}

async function cargarGraficasSensores() {
    const empty = document.getElementById("chart-overview-empty");
    const summary = document.getElementById("chart-data-summary");
    const updated = document.getElementById("chart-updated-at");
    const button = document.getElementById("chart-refresh");
    const period = Number(document.getElementById("chart-period")?.value || 24);
    const until = new Date();
    const since = new Date(until.getTime() - period * 60 * 60 * 1000);
    if (button) { button.disabled = true; button.setAttribute("aria-busy", "true"); }
    if (empty) { empty.textContent = "Consultando historial…"; empty.classList.remove("hidden"); }
    document.getElementById("chart-overview-canvas")?.classList.add("hidden");
    try {
        const query = new URLSearchParams({ desde: since.toISOString(), hasta: until.toISOString() });
        const result = await apiFetch(`/sensores/historial?${query.toString()}`);
        if (!result.ok) throw new Error(result.data?.detail || "No se pudo consultar el historial.");
        if (!Array.isArray(result.data)) throw new Error("La respuesta del historial no tiene el formato esperado.");
        chartReadings = result.data.filter(row => row && row.fecha_hora).sort((a, b) => new Date(a.fecha_hora) - new Date(b.fecha_hora));
        dibujarTodasLasGraficas();
        const total = document.getElementById("chart-total-readings");
        if (total) total.textContent = String(chartReadings.length);
        const latest = chartReadings.at(-1);
        const lastReading = document.getElementById("chart-last-reading");
        if (lastReading) lastReading.textContent = latest ? new Date(latest.fecha_hora).toLocaleString("es-EC", { dateStyle: "short", timeStyle: "short" }) : "Sin lecturas";
        if (updated) updated.textContent = `Actualizado ${new Date().toLocaleTimeString("es-EC", { hour: "2-digit", minute: "2-digit" })}`;
    } catch (error) {
        chartReadings = [];
        dibujarTodasLasGraficas();
        const total = document.getElementById("chart-total-readings");
        if (total) total.textContent = "—";
        const active = document.getElementById("chart-active-sensors");
        if (active) active.textContent = "—";
        const latest = document.getElementById("chart-last-reading");
        if (latest) latest.textContent = "—";
        if (empty) { empty.classList.remove("hidden"); empty.textContent = error.message || "No se pudo conectar con el historial de sensores."; }
        if (summary) summary.textContent = "Revisa que el backend tenga disponible /sensores/historial.";
    } finally {
        if (button) { button.disabled = false; button.removeAttribute("aria-busy"); }
    }
}

function dibujarTendenciaInicio() {
    const canvas = document.getElementById("sensor-trend-chart");
    const empty = document.getElementById("sensor-trend-empty");
    const summary = document.getElementById("sensor-trend-summary");
    const context = canvas?.getContext("2d");
    if (!canvas || !context) return;
    const readings = homeTrendReadings.filter(row => row && row.fecha_hora
        && (Number.isFinite(convertirNumeroLectura(row.temperatura)) || Number.isFinite(convertirNumeroLectura(row.humedad))));
    if (!readings.length) {
        canvas.classList.add("hidden");
        if (empty) {
            empty.classList.remove("hidden");
            empty.textContent = "Aún no hay historial real de temperatura y humedad para mostrar. Las lecturas aparecerán cuando el ESP32 las envíe.";
        }
        if (summary) summary.textContent = "Sin lecturas históricas almacenadas.";
        return;
    }
    canvas.classList.remove("hidden");
    empty?.classList.add("hidden");
    const width = Math.max(1, Math.floor(canvas.clientWidth || canvas.parentElement?.clientWidth || 1));
    const height = 132;
    const ratio = Math.min(window.devicePixelRatio || 1, 2);
    canvas.width = Math.round(width * ratio);
    canvas.height = Math.round(height * ratio);
    context.setTransform(ratio, 0, 0, ratio, 0, 0);
    context.clearRect(0, 0, width, height);
    const padding = { top: 8, right: 10, bottom: 20, left: 10 };
    const plotWidth = width - padding.left - padding.right;
    const plotHeight = height - padding.top - padding.bottom;
    const colors = { temperatura: "#38bdf8", humedad: "#34d399" };
    context.strokeStyle = chartCssColor("--border-color", "#334155");
    context.globalAlpha = .48;
    for (let row = 0; row < 3; row += 1) {
        const y = padding.top + (plotHeight / 2) * row;
        context.beginPath(); context.moveTo(padding.left, y); context.lineTo(width - padding.right, y); context.stroke();
    }
    context.globalAlpha = 1;

    ["temperatura", "humedad"].forEach(key => {
        const points = readings.map(row => convertirNumeroLectura(row[key])).filter(Number.isFinite);
        if (!points.length) return;
        const min = Math.min(...points);
        const max = Math.max(...points);
        const spread = max - min || Math.max(Math.abs(max) * .1, 1);
        const available = readings.length;
        const coords = readings.map((row, index) => {
            const value = convertirNumeroLectura(row[key]);
            return Number.isFinite(value) ? {
                x: padding.left + (available === 1 ? .5 : index / (available - 1)) * plotWidth,
                y: padding.top + (1 - ((value - min + spread * .08) / (spread * 1.16))) * plotHeight
            } : null;
        });
        context.beginPath();
        let drawing = false;
        coords.forEach(point => {
            if (!point) { drawing = false; return; }
            if (!drawing) { context.moveTo(point.x, point.y); drawing = true; }
            else context.lineTo(point.x, point.y);
        });
        context.strokeStyle = colors[key]; context.lineWidth = 2.3; context.lineJoin = "round"; context.lineCap = "round"; context.stroke();
        const last = coords.at(-1);
        if (last) { context.beginPath(); context.arc(last.x, last.y, 3.2, 0, Math.PI * 2); context.fillStyle = colors[key]; context.fill(); }
    });
    context.fillStyle = chartCssColor("--text-secondary", "#94a3b8");
    context.font = "10px system-ui, sans-serif"; context.textBaseline = "bottom";
    context.textAlign = "left"; context.fillText("Hace 24 h", padding.left, height - 1);
    context.textAlign = "right"; context.fillText("Ahora", width - padding.right, height - 1);
    const lastReading = readings.at(-1);
    const temperaturaValor = convertirNumeroLectura(lastReading.temperatura);
    const humedadValor = convertirNumeroLectura(lastReading.humedad);
    const temperatura = Number.isFinite(temperaturaValor) ? `${temperaturaValor.toFixed(1)} °C` : "— °C";
    const humedad = Number.isFinite(humedadValor) ? `${humedadValor.toFixed(1)} %` : "— %";
    if (summary) summary.textContent = `${readings.length} lecturas · última: ${temperatura} y ${humedad} · datos de la API`;
}

async function cargarTendenciaInicio({ forzar = false } = {}) {
    const panel = document.getElementById("dashboard-trends");
    if (!panel) return;
    if (!forzar && homeTrendReadings.length && Date.now() - homeTrendLoadedAt < 60_000) {
        dibujarTendenciaInicio();
        return;
    }
    if (homeTrendRequest) return homeTrendRequest;
    const empty = document.getElementById("sensor-trend-empty");
    if (empty) { empty.textContent = "Consultando historial del ESP32…"; empty.classList.remove("hidden"); }
    document.getElementById("sensor-trend-chart")?.classList.add("hidden");
    const hasta = new Date();
    const desde = new Date(hasta.getTime() - 24 * 60 * 60 * 1000);
    const query = new URLSearchParams({ desde: desde.toISOString(), hasta: hasta.toISOString() });
    homeTrendRequest = apiFetch(`/sensores/historial?${query.toString()}`).then(result => {
        if (!result.ok) throw new Error(result.data?.detail || "No se pudo consultar el historial.");
        if (!Array.isArray(result.data)) throw new Error("La respuesta del historial tiene un formato inesperado.");
        homeTrendReadings = result.data.filter(row => row && row.fecha_hora).sort((a, b) => new Date(a.fecha_hora) - new Date(b.fecha_hora));
        homeTrendLoadedAt = Date.now();
        dibujarTendenciaInicio();
    }).catch(error => {
        homeTrendReadings = [];
        dibujarTendenciaInicio();
        if (empty) { empty.classList.remove("hidden"); empty.textContent = "No se pudo consultar el historial. Comprueba la conexión con el backend."; }
        console.info("No se pudo cargar la tendencia del ESP32:", error.message);
    }).finally(() => { homeTrendRequest = null; });
    return homeTrendRequest;
}

function inicializarGraficasSensores() {
    crearTarjetasSensores();
    document.getElementById("chart-refresh")?.addEventListener("click", cargarGraficasSensores);
    document.getElementById("chart-period")?.addEventListener("change", cargarGraficasSensores);
    window.addEventListener("resize", () => {
        if (document.getElementById("charts-panel")?.getClientRects().length) dibujarTodasLasGraficas();
        if (document.getElementById("dashboard-trends")?.getClientRects().length) dibujarTendenciaInicio();
    }, { passive: true });
}
window.cargarTendenciaInicio = cargarTendenciaInicio;
document.addEventListener("DOMContentLoaded", inicializarGraficasSensores);
