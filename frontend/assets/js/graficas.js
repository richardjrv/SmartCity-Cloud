// Gráficas históricas ligeras, dibujadas con Canvas y alimentadas por la API.
const chartMetricConfig = {
    temperatura: { label: "Temperatura", unit: "°C", color: "#38bdf8" },
    humedad: { label: "Humedad", unit: "%", color: "#34d399" },
    calidad_aire: { label: "Calidad del aire", unit: "ICA", color: "#fbbf24" },
    distancia_cm: { label: "Distancia HC-SR04", unit: "cm", color: "#c084fc" }
};
const convertirNumeroLectura = valor => valor === null || valor === undefined || valor === "" ? NaN : Number(valor);
let activeChartMetric = "temperatura";
let chartReadings = [];
let homeTrendReadings = [];
let homeTrendLoadedAt = 0;
let homeTrendRequest = null;

function chartCssColor(name, fallback) {
    return getComputedStyle(document.documentElement).getPropertyValue(name).trim() || fallback;
}

function dibujarGraficaSensores() {
    const canvas = document.getElementById("sensor-history-chart");
    const empty = document.getElementById("chart-empty-state");
    const context = canvas?.getContext("2d");
    const config = chartMetricConfig[activeChartMetric];
    if (!canvas || !context || !config) return;

    const points = chartReadings.map(row => ({
        date: new Date(row.fecha_hora),
        value: convertirNumeroLectura(row[activeChartMetric])
    })).filter(point => Number.isFinite(point.value) && !Number.isNaN(point.date.getTime()));

    const rect = canvas.getBoundingClientRect();
    const width = Math.max(320, rect.width);
    const height = 320;
    const ratio = Math.min(window.devicePixelRatio || 1, 2);
    canvas.width = Math.round(width * ratio);
    canvas.height = Math.round(height * ratio);
    context.setTransform(ratio, 0, 0, ratio, 0, 0);
    context.clearRect(0, 0, width, height);

    if (!points.length) {
        canvas.classList.add("hidden");
        if (empty) {
            empty.classList.remove("hidden");
            empty.textContent = chartReadings.length
                ? `No hay lecturas de ${config.label.toLowerCase()} en este periodo.`
                : "No hay historial disponible para este periodo. Cuando el ESP32 envíe lecturas, aparecerán aquí.";
        }
        return;
    }
    canvas.classList.remove("hidden");
    empty?.classList.add("hidden");

    const styles = getComputedStyle(document.documentElement);
    const textColor = styles.getPropertyValue("--text-secondary").trim() || "#94a3b8";
    const gridColor = styles.getPropertyValue("--border-color").trim() || "#334155";
    const padding = { top: 24, right: 20, bottom: 40, left: 54 };
    const plotWidth = width - padding.left - padding.right;
    const plotHeight = height - padding.top - padding.bottom;
    let min = Math.min(...points.map(point => point.value));
    let max = Math.max(...points.map(point => point.value));
    const spread = max - min || Math.max(Math.abs(max) * .12, 1);
    min -= spread * .16;
    max += spread * .16;

    context.font = "12px system-ui, sans-serif";
    context.textAlign = "right";
    context.textBaseline = "middle";
    context.lineWidth = 1;
    for (let line = 0; line <= 4; line += 1) {
        const y = padding.top + (plotHeight / 4) * line;
        const value = max - ((max - min) / 4) * line;
        context.strokeStyle = gridColor;
        context.globalAlpha = .52;
        context.beginPath(); context.moveTo(padding.left, y); context.lineTo(width - padding.right, y); context.stroke();
        context.globalAlpha = 1;
        context.fillStyle = textColor;
        context.fillText(value.toFixed(1), padding.left - 10, y);
    }

    const firstTime = points[0].date.getTime();
    const lastTime = points.at(-1).date.getTime();
    const xFor = index => points.length < 2 ? padding.left + plotWidth / 2
        : padding.left + (lastTime === firstTime ? index / (points.length - 1) : (points[index].date.getTime() - firstTime) / (lastTime - firstTime)) * plotWidth;
    const yFor = value => padding.top + ((max - value) / (max - min)) * plotHeight;

    const gradient = context.createLinearGradient(0, padding.top, 0, padding.top + plotHeight);
    gradient.addColorStop(0, `${config.color}55`);
    gradient.addColorStop(1, `${config.color}00`);
    context.beginPath();
    points.forEach((point, index) => index ? context.lineTo(xFor(index), yFor(point.value)) : context.moveTo(xFor(index), yFor(point.value)));
    if (points.length > 1) {
        context.lineTo(xFor(points.length - 1), padding.top + plotHeight);
        context.lineTo(xFor(0), padding.top + plotHeight);
        context.closePath(); context.fillStyle = gradient; context.fill();
    }
    context.beginPath();
    points.forEach((point, index) => index ? context.lineTo(xFor(index), yFor(point.value)) : context.moveTo(xFor(index), yFor(point.value)));
    context.strokeStyle = config.color; context.lineWidth = 2.5; context.lineJoin = "round"; context.lineCap = "round"; context.stroke();
    points.forEach((point, index) => {
        if (points.length > 24 && index % Math.ceil(points.length / 18) !== 0 && index !== points.length - 1) return;
        context.beginPath(); context.arc(xFor(index), yFor(point.value), 3.2, 0, Math.PI * 2);
        context.fillStyle = config.color; context.fill();
        context.strokeStyle = chartCssColor("--bg-card", "#151c2c"); context.lineWidth = 2; context.stroke();
    });

    context.fillStyle = textColor; context.textAlign = "center"; context.textBaseline = "top";
    const labels = [points[0], points[Math.floor((points.length - 1) / 2)], points.at(-1)];
    labels.forEach((point, index) => {
        const x = index === 0 ? padding.left : index === 1 ? padding.left + plotWidth / 2 : padding.left + plotWidth;
        const format = { hour: "2-digit", minute: "2-digit" };
        if (Number(document.getElementById("chart-period")?.value) >= 24) format.day = "2-digit", format.month = "short";
        context.fillText(point.date.toLocaleString("es-EC", format), x, height - padding.bottom + 14);
    });
    const values = points.map(point => point.value);
    const avg = values.reduce((sum, value) => sum + value, 0) / values.length;
    const summary = document.getElementById("chart-data-summary");
    if (summary) summary.textContent = `${points.length} lecturas · promedio ${avg.toFixed(1)} ${config.unit} · mínimo ${Math.min(...values).toFixed(1)} · máximo ${Math.max(...values).toFixed(1)}`;
}

async function cargarGraficasSensores() {
    const empty = document.getElementById("chart-empty-state");
    const summary = document.getElementById("chart-data-summary");
    const updated = document.getElementById("chart-updated-at");
    const period = Number(document.getElementById("chart-period")?.value || 24);
    const until = new Date();
    const since = new Date(until.getTime() - period * 60 * 60 * 1000);
    if (empty) { empty.textContent = "Consultando historial…"; empty.classList.remove("hidden"); }
    document.getElementById("sensor-history-chart")?.classList.add("hidden");
    try {
        const query = new URLSearchParams({ desde: since.toISOString(), hasta: until.toISOString() });
        const result = await apiFetch(`/sensores/historial?${query.toString()}`);
        if (!result.ok) throw new Error(result.data?.detail || "No se pudo consultar el historial.");
        if (!Array.isArray(result.data)) throw new Error("La respuesta del historial no tiene el formato esperado.");
        chartReadings = result.data.filter(row => row && row.fecha_hora).sort((a, b) => new Date(a.fecha_hora) - new Date(b.fecha_hora));
        dibujarGraficaSensores();
        if (updated) updated.textContent = `Actualizado ${new Date().toLocaleTimeString("es-EC", { hour: "2-digit", minute: "2-digit" })}`;
    } catch (error) {
        chartReadings = [];
        dibujarGraficaSensores();
        if (empty) { empty.classList.remove("hidden"); empty.textContent = error.message || "No se pudo conectar con el historial de sensores."; }
        if (summary) summary.textContent = "Revisa que el backend tenga disponible /sensores/historial.";
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
    const width = Math.max(280, canvas.clientWidth);
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
    document.getElementById("chart-refresh")?.addEventListener("click", cargarGraficasSensores);
    document.getElementById("chart-period")?.addEventListener("change", cargarGraficasSensores);
    document.querySelectorAll("[data-chart-metric]").forEach(button => button.addEventListener("click", () => {
        activeChartMetric = button.dataset.chartMetric;
        document.querySelectorAll("[data-chart-metric]").forEach(option => {
            const active = option === button;
            option.classList.toggle("is-active", active);
            option.setAttribute("aria-pressed", String(active));
        });
        dibujarGraficaSensores();
    }));
    window.addEventListener("resize", () => {
        if (document.getElementById("charts-panel")?.getClientRects().length) dibujarGraficaSensores();
        if (document.getElementById("dashboard-trends")?.getClientRects().length) dibujarTendenciaInicio();
    }, { passive: true });
}
window.cargarTendenciaInicio = cargarTendenciaInicio;
document.addEventListener("DOMContentLoaded", inicializarGraficasSensores);
