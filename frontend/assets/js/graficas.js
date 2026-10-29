// Historial real del único ESP32. Cada variable mantiene su escala y unidad.
const chartSensorConfig = [
    { id: "hc-sr04", area: "movilidad", name: "HC-SR04", icon: "📏", description: "Distancia de proximidad", fields: [{ key: "distancia_cm", label: "Distancia", unit: "cm", color: "#8b5cf6" }] },
    { id: "lluvia", area: "ambiental", name: "Sensor de lluvia", icon: "🌧️", description: "Presencia de lluvia", fields: [{ key: "lluvia_detectada", label: "Detección", kind: "boolean", trueLabel: "Sí", falseLabel: "No", color: "#0284c7" }] },
    { id: "ldr", area: "ambiental", name: "LDR", icon: "☀️", description: "Luminosidad; lectura sin calibrar", fields: [{ key: "luminosidad", label: "Luminosidad", unit: "lectura", color: "#d97706" }] },
    { id: "nivel-agua", area: "agua", name: "Nivel de agua", icon: "💧", description: "Lectura cruda; requiere calibración para expresarla en porcentaje", fields: [{ key: "nivel_agua", label: "Nivel", unit: "lectura", color: "#0f9f92" }] },
    { id: "dht22", area: "ambiental", name: "DHT22", icon: "🌡️", description: "Temperatura y humedad ambiental", fields: [
        { key: "temperatura", label: "Temperatura", unit: "°C", color: "#38bdf8", threshold: "temperatura" },
        { key: "humedad", label: "Humedad", unit: "%", color: "#34d399", threshold: "humedad" }
    ] },
    { id: "tcrt5000", area: "movilidad", name: "TCRT5000", icon: "🚘", description: "Reflectancia infrarroja y detección", fields: [
        { key: "reflectancia_tcrt5000", label: "Reflectancia", unit: "lectura", color: "#fb7185" },
        { key: "tcrt5000_detectado", label: "Detección", kind: "boolean", trueLabel: "Sí", falseLabel: "No", color: "#f97316" }
    ] },
    { id: "calidad-aire", area: "ambiental", name: "Calidad del aire", icon: "🍃", description: "Dato adicional; solo aparece si el ESP32 lo reporta", optional: true, fields: [{ key: "calidad_aire", label: "Respuesta del sensor", unit: "lectura", color: "#65a30d", threshold: "calidad_aire" }] }
];
const convertirNumeroLectura = valor => valor === null || valor === undefined || valor === "" ? NaN : Number(valor);
let chartReadings = [];
let chartAllReadings = [];
let chartAllPreviousReadings = [];
let chartPreviousReadings = [];
let chartLatestReading = null;
let chartLoading = false;
let homeTrendReadings = [];
let homeTrendLoadedAt = 0;
let homeTrendRequest = null;
let chartRefreshTimer = null;
let homeTrendCoordinates = {};

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

function puntosCampoGrafica(config, readings = chartReadings) {
    return readings.map(row => ({ date: new Date(row.fecha_hora), value: valorCampoGrafica(row[config.key], config) }))
        .filter(point => Number.isFinite(point.value) && !Number.isNaN(point.date.getTime()));
}

function ajustesRangoGrafica() {
    return typeof obtenerConfiguracionOperador === "function" ? obtenerConfiguracionOperador() : { temperatureMax: 35, humidityMin: 30, humidityMax: 70, airQualityMax: 100, staleMinutes: 10 };
}

function umbralesCampoGrafica(config) {
    const settings = ajustesRangoGrafica();
    if (config.threshold === "temperatura") return { min: null, max: Number(settings.temperatureMax) };
    if (config.threshold === "humedad") return { min: Number(settings.humidityMin), max: Number(settings.humidityMax) };
    if (config.threshold === "calidad_aire") return { min: null, max: Number(settings.airQualityMax) };
    return null;
}

function esLecturaConAlerta(row, area = "todos") {
    if (area === "agua" || area === "movilidad") return false;
    const settings = ajustesRangoGrafica();
    const temperature = convertirNumeroLectura(row.temperatura);
    const humidity = convertirNumeroLectura(row.humedad);
    const air = convertirNumeroLectura(row.calidad_aire);
    return (Number.isFinite(temperature) && temperature > Number(settings.temperatureMax))
        || (Number.isFinite(humidity) && (humidity < Number(settings.humidityMin) || humidity > Number(settings.humidityMax)))
        || (Number.isFinite(air) && air > Number(settings.airQualityMax));
}

function areaTieneDatos(row, area) {
    if (area === "ambiental") return ["temperatura", "humedad", "calidad_aire", "lluvia_detectada", "luminosidad"].some(key => Number.isFinite(valorCampoGrafica(row[key], { kind: key === "lluvia_detectada" ? "boolean" : undefined })));
    if (area === "agua") return Number.isFinite(convertirNumeroLectura(row.nivel_agua));
    if (area === "movilidad") return ["distancia_cm", "reflectancia_tcrt5000", "tcrt5000_detectado"].some(key => Number.isFinite(valorCampoGrafica(row[key], { kind: key === "tcrt5000_detectado" ? "boolean" : undefined })));
    return true;
}

function actualizarFiltrosLocales() {
    const area = document.getElementById("chart-area-filter")?.value || "todos";
    const state = document.getElementById("chart-state-filter")?.value || "todos";
    const cumpleFiltrosLocales = row => (area === "todos" || areaTieneDatos(row, area))
        && (state === "todos" || (state === "alerta") === esLecturaConAlerta(row, area));
    chartReadings = chartAllReadings.filter(cumpleFiltrosLocales);
    chartPreviousReadings = chartAllPreviousReadings.filter(cumpleFiltrosLocales);
    document.querySelectorAll("[data-chart-sensor]").forEach(card => {
        const sensor = chartSensorConfig.find(item => item.id === card.dataset.chartSensor);
        card.dataset.areaHidden = String(area !== "todos" && sensor?.area !== area);
    });
    dibujarTodasLasGraficas();
    const total = document.getElementById("chart-total-readings");
    if (total) total.textContent = String(chartReadings.length);
    const activeCount = chartSensorConfig.filter(sensor => sensor.area === area || area === "todos")
        .filter(sensor => chartReadings.some(row => sensor.fields.some(field => Number.isFinite(valorCampoGrafica(row[field.key], field)))))
        .length;
    const active = document.getElementById("chart-active-sensors");
    if (active) active.textContent = String(activeCount);
    const alertCount = document.getElementById("chart-alert-readings");
    if (alertCount) {
        if (area === "todos" || area === "ambiental") {
            const alerts = chartAllReadings.filter(row => (area === "todos" || areaTieneDatos(row, area)) && esLecturaConAlerta(row, area)).length;
            const relevantTotal = chartAllReadings.filter(row => area === "todos" || areaTieneDatos(row, area)).length;
            const percentage = relevantTotal ? Math.round((alerts / relevantTotal) * 100) : 0;
            alertCount.textContent = `${alerts} · ${percentage}%`;
        } else alertCount.textContent = "Sin límites configurados";
    }
    const lastReading = document.getElementById("chart-last-reading");
    if (lastReading) lastReading.textContent = chartReadings.length ? new Date(chartReadings.at(-1).fecha_hora).toLocaleString("es-EC", { dateStyle: "short", timeStyle: "short" }) : "Sin lecturas";
    actualizarResumenPeriodo(area);
    redibujarGraficaAmpliada();
}

function promedioCampo(config, readings) {
    const values = puntosCampoGrafica(config, readings).map(point => point.value);
    return values.length ? values.reduce((total, value) => total + value, 0) / values.length : NaN;
}

function actualizarResumenPeriodo(area) {
    const insight = document.getElementById("chart-period-insight");
    if (!insight) return;
    if (!chartReadings.length) {
        insight.textContent = "No hay lecturas con los filtros seleccionados. Ajusta el rango o el estado para ver el resumen.";
        return;
    }
    const pieces = [`${chartReadings.length} lecturas coinciden con los filtros`];
    const temperature = chartSensorConfig.find(sensor => sensor.id === "dht22").fields[0];
    const humidity = chartSensorConfig.find(sensor => sensor.id === "dht22").fields[1];
    const metrics = area === "todos" || area === "ambiental" ? [temperature, humidity] : [];
    let hasComparison = false;
    metrics.forEach(config => {
        const current = promedioCampo(config, chartReadings);
        const previous = promedioCampo(config, chartPreviousReadings);
        if (!Number.isFinite(current)) return;
        const unit = config.unit;
        if (!Number.isFinite(previous)) {
            pieces.push(`${config.label}: promedio ${formatoValorGrafica(current, config)}`);
            return;
        }
        hasComparison = true;
        const difference = current - previous;
        const percent = Math.abs(previous) > 0.0001 ? Math.abs((difference / previous) * 100) : null;
        const direction = Math.abs(difference) < 0.05 ? "se mantuvo estable" : difference > 0 ? "subió" : "bajó";
        pieces.push(`${config.label} ${direction}${direction === "se mantuvo estable" ? "" : ` ${Math.abs(difference).toFixed(1)} ${unit}${percent === null ? "" : ` (${percent.toFixed(0)}%)`}`}`);
    });
    if (metrics.length && !hasComparison) pieces.push("aún no hay datos anteriores suficientes para comparar");
    const alerts = chartAllReadings.filter(row => (area === "todos" || areaTieneDatos(row, area)) && esLecturaConAlerta(row, area)).length;
    if (area === "todos" || area === "ambiental") pieces.push(`${alerts} lecturas ambientales fuera de límite`);
    insight.textContent = `${pieces.join(" · ")}.`;
}

function valorLocalParaInput(date) {
    const adjusted = new Date(date.getTime() - date.getTimezoneOffset() * 60_000);
    return adjusted.toISOString().slice(0, 16);
}

function aplicarPeriodoRapido() {
    const period = document.getElementById("chart-period")?.value;
    if (!period || period === "custom") return;
    const until = new Date();
    const since = new Date(until.getTime() - Number(period) * 3_600_000);
    const start = document.getElementById("chart-start-date");
    const end = document.getElementById("chart-end-date");
    if (start) start.value = valorLocalParaInput(since);
    if (end) end.value = valorLocalParaInput(until);
}

function formatoFechaGrafica(date, period) {
    const format = { hour: "2-digit", minute: "2-digit" };
    if (period >= 24) { format.day = "2-digit"; format.month = "short"; }
    return date.toLocaleString("es-EC", format);
}

function periodoGraficaHoras() {
    const start = document.getElementById("chart-start-date")?.value;
    const end = document.getElementById("chart-end-date")?.value;
    if (start && end) return Math.max(1, (new Date(end) - new Date(start)) / 3_600_000);
    const value = Number(document.getElementById("chart-period")?.value || 24);
    return Number.isFinite(value) ? value : 24;
}

function formatoValorGrafica(valor, config) {
    if (config.kind === "boolean") return valor === 1 ? config.trueLabel : config.falseLabel;
    const decimals = config.unit === "lectura" ? 0 : 1;
    return `${Number(valor).toFixed(decimals)}${config.unit ? ` ${config.unit}` : ""}`;
}

function colorConAlpha(color, alpha) {
    const match = String(color).match(/^#([\da-f]{6})$/i);
    if (!match) return color;
    const value = Number.parseInt(match[1], 16);
    return `rgba(${value >> 16}, ${(value >> 8) & 255}, ${value & 255}, ${alpha})`;
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
        if (empty) { empty.classList.remove("hidden"); empty.textContent = "No hay lecturas en este periodo. Amplía el rango o revisa que el ESP32 esté enviando datos."; }
        const summary = document.getElementById("chart-data-summary");
        if (summary) summary.textContent = "Sin registros en el periodo seleccionado.";
        return;
    }
    canvas.classList.remove("hidden");
    empty?.classList.add("hidden");
    const compactViewport = window.matchMedia("(max-width: 480px)").matches;
    const result = prepararCanvas(canvas, compactViewport ? 240 : 300);
    if (!result) return;
    const { context, width, height } = result;
    const period = periodoGraficaHoras();
    const bucketCount = period <= 1 ? 6 : period <= 10 ? 10 : period <= 24 ? 12 : 14;
    const values = Array(bucketCount).fill(0);
    const start = document.getElementById("chart-start-date")?.value ? new Date(document.getElementById("chart-start-date").value).getTime() : Date.now() - period * 3_600_000;
    const end = document.getElementById("chart-end-date")?.value ? new Date(document.getElementById("chart-end-date").value).getTime() : Date.now();
    const duration = Math.max(1, end - start);
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
        if (value) {
            const gradient = context.createLinearGradient(0, y, 0, padding.top + plotHeight);
            gradient.addColorStop(0, "#38bdf8");
            gradient.addColorStop(1, "rgba(56, 189, 248, .18)");
            context.fillStyle = gradient;
            context.beginPath();
            context.roundRect(x, y, barWidth, Math.max(3, barHeight), Math.min(7, barWidth / 2));
            context.fill();
            context.fillStyle = text;
            context.textAlign = "center";
            context.textBaseline = "bottom";
            context.font = "10px system-ui, sans-serif";
            context.fillText(String(value), x + barWidth / 2, y - 4);
        }
    });
    context.fillStyle = text; context.textBaseline = "top";
    const last = new Date(end);
    const first = new Date(start);
    const middle = new Date(start + duration / 2);
    [first, middle, last].forEach((date, index) => {
        const x = index === 0 ? padding.left : index === 1 ? padding.left + plotWidth / 2 : padding.left + plotWidth;
        context.textAlign = index === 0 ? "left" : index === 1 ? "center" : "right";
        context.fillText(formatoFechaGrafica(date, period), x, height - padding.bottom + 14);
    });
    const tooltip = document.getElementById("chart-overview-tooltip");
    canvas.tabIndex = 0;
    canvas.setAttribute("aria-describedby", "chart-data-summary");
    if (tooltip) {
        const wrap = canvas.closest(".chart-canvas-wrap");
        let guide = wrap?.querySelector("[data-chart-hover-guide]");
        if (wrap && !guide) {
            guide = document.createElement("span");
            guide.className = "chart-hover-guide";
            guide.dataset.chartHoverGuide = "";
            guide.setAttribute("aria-hidden", "true");
            wrap.appendChild(guide);
        }
        let announcement = wrap?.querySelector("[data-chart-announcement]");
        if (wrap && !announcement) {
            announcement = document.createElement("span");
            announcement.className = "chart-sr-only";
            announcement.dataset.chartAnnouncement = "";
            announcement.setAttribute("aria-live", "polite");
            announcement.setAttribute("aria-atomic", "true");
            wrap.appendChild(announcement);
        }
        let touchSelection = false;
        let selectedBucket = -1;
        const hideSelection = () => {
            tooltip.classList.remove("is-visible");
            guide?.classList.remove("is-visible");
        };
        const showBucket = (clientX, announce = false) => {
            const bounds = canvas.getBoundingClientRect();
            const wrapBounds = wrap?.getBoundingClientRect();
            const x = Math.max(0, Math.min(bounds.width, clientX - bounds.left));
            const index = Math.max(0, Math.min(bucketCount - 1, Math.floor((x - padding.left) / slot)));
            const from = new Date(start + duration / bucketCount * index);
            const to = new Date(start + duration / bucketCount * (index + 1));
            const label = `${from.toLocaleString("es-EC", { dateStyle: "short", timeStyle: "short" })} – ${to.toLocaleTimeString("es-EC", { hour: "2-digit", minute: "2-digit" })} · ${values[index]} registros`;
            const plotX = padding.left + (index + .5) * slot;
            tooltip.textContent = label;
            tooltip.style.left = `${Math.max(8, Math.min(bounds.width - 250, x + 10))}px`;
            tooltip.classList.add("is-visible");
            if (guide && wrapBounds) {
                guide.style.left = `${bounds.left - wrapBounds.left + plotX * (bounds.width / width)}px`;
                guide.style.top = `${bounds.top - wrapBounds.top + padding.top * (bounds.height / height)}px`;
                guide.style.bottom = `${wrapBounds.height - (bounds.top - wrapBounds.top + (height - padding.bottom) * (bounds.height / height))}px`;
                guide.classList.add("is-visible");
            }
            selectedBucket = index;
            if (announce && announcement) announcement.textContent = `Intervalo ${label}. Usa las flechas izquierda y derecha para recorrer los intervalos.`;
            return index;
        };
        canvas.onpointermove = event => showBucket(event.clientX);
        canvas.onpointerdown = event => {
            if (event.pointerType !== "touch") return;
            touchSelection = true;
            showBucket(event.clientX, true);
        };
        canvas.onpointerleave = () => { if (!touchSelection) hideSelection(); };
        canvas.onkeydown = event => {
            if (event.key !== "ArrowLeft" && event.key !== "ArrowRight") return;
            event.preventDefault();
            const direction = event.key === "ArrowRight" ? 1 : -1;
            const current = selectedBucket < 0 ? (direction > 0 ? -1 : bucketCount) : selectedBucket;
            const next = Math.max(0, Math.min(bucketCount - 1, current + direction));
            const bounds = canvas.getBoundingClientRect();
            const clientX = bounds.left + (padding.left + (next + .5) * slot) * (bounds.width / width);
            showBucket(clientX, true);
        };
    }
    const summary = document.getElementById("chart-data-summary");
    const activeIntervals = values.filter(value => value > 0).length;
    const peak = Math.max(...values);
    const previousTotal = chartPreviousReadings.length;
    const totalDelta = chartReadings.length - previousTotal;
    const comparison = previousTotal ? ` · ${totalDelta > 0 ? `↑ ${totalDelta} más` : totalDelta < 0 ? `↓ ${Math.abs(totalDelta)} menos` : "→ mismo total"} que el periodo anterior` : " · sin registros del periodo anterior para comparar";
    if (summary) summary.textContent = `${chartReadings.length} registros · ${activeIntervals} intervalos con actividad · máximo ${peak} registros${comparison}`;
}

function dibujarGraficaCampo(canvas, empty, summary, config, chartHeight = 174) {
    const points = puntosCampoGrafica(config);
    const expandButton = canvas.closest(".chart-sensor-field")?.querySelector("[data-chart-expand]");
    if (expandButton) expandButton.disabled = points.length === 0;
    if (!points.length) {
        canvas.classList.add("hidden");
        empty.classList.remove("hidden");
        empty.textContent = `No hay lecturas de ${config.label.toLowerCase()} en el rango elegido. Prueba otro periodo o espera el próximo envío del ESP32.`;
        summary.textContent = "Sin datos en el periodo seleccionado.";
        return false;
    }
    canvas.classList.remove("hidden");
    empty.classList.add("hidden");
    const result = prepararCanvas(canvas, chartHeight);
    if (!result) return false;
    const { context, width, height } = result;
    const text = chartCssColor("--text-secondary", "#94a3b8");
    const grid = chartCssColor("--border-color", "#334155");
    const padding = { top: 15, right: 12, bottom: 32, left: config.kind === "boolean" ? 58 : 48 };
    const plotWidth = width - padding.left - padding.right;
    const plotHeight = height - padding.top - padding.bottom;
    const thresholds = umbralesCampoGrafica(config);
    const thresholdValues = thresholds ? [thresholds.min, thresholds.max].filter(Number.isFinite) : [];
    let min = config.kind === "boolean" ? 0 : Math.min(...points.map(point => point.value), ...thresholdValues);
    let max = config.kind === "boolean" ? 1 : Math.max(...points.map(point => point.value), ...thresholdValues);
    const spread = max - min || Math.max(Math.abs(max) * .12, 1);
    if (config.kind !== "boolean") { min -= spread * .14; max += spread * .14; }
    const firstTime = points[0].date.getTime();
    const lastTime = points.at(-1).date.getTime();
    const xForTime = time => points.length < 2 ? padding.left + plotWidth / 2
        : padding.left + (lastTime === firstTime ? .5 : (time - firstTime) / (lastTime - firstTime)) * plotWidth;
    const xFor = index => xForTime(points[index].date.getTime());
    const yFor = value => padding.top + ((max - value) / (max - min || 1)) * plotHeight;
    const staleMinutes = Number(ajustesRangoGrafica().staleMinutes) || 10;
    let gapCount = 0;
    const gapPoints = puntosCampoGrafica(config, chartAllReadings);
    if (points.length > 1 && gapPoints.length > 1) {
        context.save();
        context.fillStyle = "rgba(239, 68, 68, .08)";
        context.strokeStyle = "rgba(248, 113, 113, .55)";
        context.setLineDash([3, 4]);
        gapPoints.slice(1).forEach((point, index) => {
            const previous = gapPoints[index];
            if (point.date.getTime() - previous.date.getTime() <= staleMinutes * 60_000) return;
            gapCount += 1;
            const left = xForTime(previous.date.getTime());
            const right = xForTime(point.date.getTime());
            context.fillRect(left, padding.top, Math.max(2, right - left), plotHeight);
            context.beginPath(); context.moveTo(left, padding.top); context.lineTo(left, padding.top + plotHeight); context.stroke();
            context.beginPath(); context.moveTo(right, padding.top); context.lineTo(right, padding.top + plotHeight); context.stroke();
        });
        context.restore();
    }
    if (thresholds && config.kind !== "boolean") {
        const plotBottom = padding.top + plotHeight;
        context.save();
        context.fillStyle = "rgba(16, 185, 129, .075)";
        context.strokeStyle = "rgba(245, 158, 11, .8)";
        context.setLineDash([5, 4]);
        if (Number.isFinite(thresholds.min) && Number.isFinite(thresholds.max)) {
            const upperY = yFor(thresholds.max);
            const lowerY = yFor(thresholds.min);
            context.fillStyle = "rgba(239, 68, 68, .065)";
            context.fillRect(padding.left, padding.top, plotWidth, Math.max(0, upperY - padding.top));
            context.fillRect(padding.left, lowerY, plotWidth, Math.max(0, plotBottom - lowerY));
            context.fillStyle = "rgba(16, 185, 129, .075)";
            context.fillRect(padding.left, upperY, plotWidth, lowerY - upperY);
            [thresholds.min, thresholds.max].forEach(value => {
                const y = yFor(value);
                context.beginPath(); context.moveTo(padding.left, y); context.lineTo(width - padding.right, y); context.stroke();
            });
        } else if (Number.isFinite(thresholds.max)) {
            const limitY = yFor(thresholds.max);
            context.fillRect(padding.left, limitY, plotWidth, Math.max(0, plotBottom - limitY));
            context.fillStyle = "rgba(239, 68, 68, .07)";
            context.fillRect(padding.left, padding.top, plotWidth, Math.max(0, limitY - padding.top));
            context.beginPath(); context.moveTo(padding.left, limitY); context.lineTo(width - padding.right, limitY); context.stroke();
        }
        context.restore();
    }
    const valueEl = canvas.closest(".chart-sensor-field")?.querySelector("[data-chart-current-value]");
    if (valueEl) {
        valueEl.textContent = formatoValorGrafica(points.at(-1).value, config);
        valueEl.title = `Última lectura: ${points.at(-1).date.toLocaleString("es-EC")}`;
    }
    canvas.setAttribute("aria-label", `${config.label}: ${points.length} lecturas; última ${formatoValorGrafica(points.at(-1).value, config)}; ${formatoFechaGrafica(points.at(-1).date, periodoGraficaHoras())}.`);
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
    if (config.kind !== "boolean") {
        const fill = context.createLinearGradient(0, padding.top, 0, padding.top + plotHeight);
        fill.addColorStop(0, colorConAlpha(config.color, .25));
        fill.addColorStop(1, colorConAlpha(config.color, .015));
        context.lineTo(xFor(points.length - 1), padding.top + plotHeight);
        context.lineTo(xFor(0), padding.top + plotHeight);
        context.closePath();
        context.fillStyle = fill;
        context.fill();
        context.beginPath();
        points.forEach((point, index) => {
            const x = xFor(index); const y = yFor(point.value);
            if (index === 0) context.moveTo(x, y); else context.lineTo(x, y);
        });
    }
    context.strokeStyle = config.color; context.lineWidth = 2.5; context.lineJoin = "round"; context.lineCap = "round"; context.stroke();
    points.forEach((point, index) => {
        if (points.length > 30 && index % Math.ceil(points.length / 15) !== 0 && index !== points.length - 1) return;
        context.beginPath(); context.arc(xFor(index), yFor(point.value), 2.7, 0, Math.PI * 2);
        context.fillStyle = config.color; context.fill();
    });
    if (config.kind !== "boolean") {
        const values = points.map(point => point.value);
        const extrema = [
            { label: "Máx", index: values.indexOf(Math.max(...values)), color: "#b45309", verticalOffset: -17 },
            { label: "Mín", index: values.indexOf(Math.min(...values)), color: "#0f766e", verticalOffset: 14 }
        ];
        context.save();
        context.font = "bold 9px system-ui, sans-serif";
        extrema.forEach(item => {
            const point = points[item.index];
            const x = xFor(item.index);
            const y = yFor(point.value);
            context.beginPath(); context.arc(x, y, 5.5, 0, Math.PI * 2); context.fillStyle = "#fff"; context.fill();
            context.beginPath(); context.arc(x, y, 3.5, 0, Math.PI * 2); context.fillStyle = config.color; context.fill();
            const labelWidth = context.measureText(item.label).width + 10;
            const labelX = Math.max(padding.left, Math.min(width - padding.right - labelWidth, x + 7));
            const labelY = Math.max(padding.top, Math.min(height - padding.bottom - 13, y + item.verticalOffset));
            context.fillStyle = colorConAlpha(item.color, .94);
            context.beginPath(); context.roundRect(labelX, labelY - 9, labelWidth, 14, 5); context.fill();
            context.fillStyle = "#fff"; context.textAlign = "center"; context.textBaseline = "middle";
            context.fillText(item.label, labelX + labelWidth / 2, labelY - 2);
        });
        context.restore();
    }
    context.fillStyle = text; context.textBaseline = "top";
    const dateTicks = [...new Set([0, Math.floor((points.length - 1) / 2), points.length - 1])];
    dateTicks.forEach(index => {
        const point = points[index];
        const x = xFor(index);
        context.textAlign = index === 0 ? "left" : index === points.length - 1 ? "right" : "center";
        context.fillText(formatoFechaGrafica(point.date, periodoGraficaHoras()), x, height - padding.bottom + 10);
    });
    const tooltip = canvas.closest(".chart-sensor-chart-wrap")?.querySelector("[data-chart-tooltip]");
    if (summary.id) canvas.setAttribute("aria-describedby", summary.id);
    if (tooltip) {
        const wrap = canvas.closest(".chart-sensor-chart-wrap");
        let guide = wrap?.querySelector("[data-chart-hover-guide]");
        let marker = wrap?.querySelector("[data-chart-hover-dot]");
        if (wrap && !guide) {
            guide = document.createElement("span");
            guide.className = "chart-hover-guide";
            guide.dataset.chartHoverGuide = "";
            guide.setAttribute("aria-hidden", "true");
            wrap.appendChild(guide);
        }
        if (wrap && !marker) {
            marker = document.createElement("span");
            marker.className = "chart-hover-dot";
            marker.dataset.chartHoverDot = "";
            marker.setAttribute("aria-hidden", "true");
            wrap.appendChild(marker);
        }
        let announcement = wrap?.querySelector("[data-chart-announcement]");
        if (wrap && !announcement) {
            announcement = document.createElement("span");
            announcement.className = "chart-sr-only";
            announcement.dataset.chartAnnouncement = "";
            announcement.setAttribute("aria-live", "polite");
            announcement.setAttribute("aria-atomic", "true");
            wrap.appendChild(announcement);
        }
        let touchSelection = false;
        let selectedPoint = -1;
        const hideSelection = () => {
            tooltip.classList.remove("is-visible");
            guide?.classList.remove("is-visible");
            marker?.classList.remove("is-visible");
        };
        const showPointAt = (clientX, announce = false) => {
            const bounds = canvas.getBoundingClientRect();
            const wrapBounds = wrap.getBoundingClientRect();
            const pointerX = Math.max(0, Math.min(bounds.width, clientX - bounds.left));
            let closest = 0;
            let distance = Infinity;
            points.forEach((point, index) => {
                const delta = Math.abs(xFor(index) - pointerX);
                if (delta < distance) { closest = index; distance = delta; }
            });
            const point = points[closest];
            const pointX = bounds.left - wrapBounds.left + xFor(closest) * (bounds.width / width);
            const pointY = bounds.top - wrapBounds.top + yFor(point.value) * (bounds.height / height);
            if (guide) {
                guide.style.left = `${pointX}px`;
                guide.style.top = `${bounds.top - wrapBounds.top + padding.top * (bounds.height / height)}px`;
                guide.style.bottom = `${wrapBounds.height - (bounds.top - wrapBounds.top + (height - padding.bottom) * (bounds.height / height))}px`;
                guide.classList.add("is-visible");
            }
            if (marker) {
                marker.style.left = `${pointX}px`;
                marker.style.top = `${pointY}px`;
                marker.style.setProperty("--chart-point-color", config.color);
                marker.classList.add("is-visible");
            }
            tooltip.textContent = `${point.date.toLocaleString("es-EC", { dateStyle: "medium", timeStyle: "short" })} · ${formatoValorGrafica(point.value, config)}`;
            tooltip.style.left = `${Math.max(8, Math.min(bounds.width - 190, pointerX + 10))}px`;
            tooltip.classList.add("is-visible");
            selectedPoint = closest;
            if (announce && announcement) announcement.textContent = `${config.label}: ${point.date.toLocaleString("es-EC", { dateStyle: "medium", timeStyle: "short" })}, ${formatoValorGrafica(point.value, config)}. Usa las flechas izquierda y derecha para recorrer las lecturas.`;
            return closest;
        };
        canvas.onpointermove = event => showPointAt(event.clientX);
        canvas.onpointerdown = event => {
            if (event.pointerType !== "touch") return;
            touchSelection = true;
            showPointAt(event.clientX, true);
        };
        canvas.onpointerleave = () => {
            if (!touchSelection) hideSelection();
        };
        canvas.onkeydown = event => {
            if (event.key !== "ArrowLeft" && event.key !== "ArrowRight") return;
            event.preventDefault();
            const direction = event.key === "ArrowRight" ? 1 : -1;
            const current = selectedPoint < 0 ? (direction > 0 ? -1 : points.length) : selectedPoint;
            selectedPoint = Math.max(0, Math.min(points.length - 1, current + direction));
            const bounds = canvas.getBoundingClientRect();
            showPointAt(bounds.left + xFor(selectedPoint) * (bounds.width / width), true);
        };
    }
    if (config.kind === "boolean") {
        const detections = points.filter(point => point.value === 1).length;
        const previousPoints = puntosCampoGrafica(config, chartPreviousReadings);
        const previousDetections = previousPoints.filter(point => point.value === 1).length;
        const comparison = previousPoints.length ? ` · ${previousDetections} detecciones en el periodo anterior` : " · sin datos anteriores para comparar";
        summary.textContent = `${detections} detecciones · ${points.length} lecturas registradas${comparison}${gapCount ? ` · ${gapCount} huecos mayores a ${staleMinutes} min` : ""}`;
    } else {
        const values = points.map(point => point.value);
        const average = values.reduce((sum, value) => sum + value, 0) / values.length;
        const previousAverage = promedioCampo(config, chartPreviousReadings);
        let comparison = "";
        if (Number.isFinite(previousAverage)) {
            const delta = average - previousAverage;
            const change = Math.abs(previousAverage) > .0001 ? ` (${Math.abs(delta / previousAverage * 100).toFixed(0)}%)` : "";
            comparison = ` · ${delta > .05 ? "↑" : delta < -.05 ? "↓" : "→"} ${formatoValorGrafica(Math.abs(delta), config)}${change} vs periodo anterior`;
        } else comparison = " · sin datos del periodo anterior para comparar";
        const gapSummary = gapCount ? ` · ${gapCount} huecos > ${staleMinutes} min` : "";
        summary.textContent = `${points.length} lecturas · promedio ${formatoValorGrafica(average, config)} · mín. ${formatoValorGrafica(Math.min(...values), config)} · máx. ${formatoValorGrafica(Math.max(...values), config)}${comparison}${gapSummary}`;
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
            const fieldHeading = document.createElement("div"); fieldHeading.className = "chart-field-heading";
            const current = document.createElement("strong"); current.className = "chart-current-value"; current.dataset.chartCurrentValue = ""; current.textContent = "—"; current.setAttribute("aria-label", "Última lectura");
            const expandButton = document.createElement("button");
            expandButton.type = "button";
            expandButton.className = "chart-expand-button";
            expandButton.dataset.chartExpand = "";
            expandButton.textContent = "Ampliar";
            expandButton.disabled = true;
            expandButton.setAttribute("aria-label", `Ampliar gráfica de ${field.label.toLowerCase()} del sensor ${sensor.name}`);
            fieldHeading.append(fieldTitle, current, expandButton);
            const wrap = document.createElement("div"); wrap.className = "chart-sensor-chart-wrap";
            const canvas = document.createElement("canvas"); canvas.className = "chart-sensor-canvas hidden"; canvas.setAttribute("role", "img");
            canvas.tabIndex = 0;
            canvas.setAttribute("aria-label", `Historial de ${field.label.toLowerCase()} del sensor ${sensor.name}`);
            const empty = document.createElement("p"); empty.className = "chart-sensor-empty"; empty.setAttribute("role", "status"); empty.textContent = "Esperando historial…";
            const tooltip = document.createElement("span"); tooltip.className = "chart-tooltip"; tooltip.dataset.chartTooltip = ""; tooltip.setAttribute("aria-hidden", "true");
            wrap.append(canvas, empty, tooltip);
            const summary = document.createElement("p"); summary.className = "chart-sensor-summary"; summary.id = `chart-summary-${sensor.id}-${field.key}`;
            fieldSection.append(fieldHeading, wrap, summary);
            card.appendChild(fieldSection);
            let hoverTimer = null;
            const expandAfterDelay = event => {
                if (event.pointerType !== "mouse" || window.matchMedia("(prefers-reduced-motion: reduce)").matches) return;
                window.clearTimeout(hoverTimer);
                hoverTimer = window.setTimeout(() => card.classList.add("is-hover-expanded"), 2000);
            };
            canvas.addEventListener("pointerenter", expandAfterDelay);
            canvas.addEventListener("pointerleave", () => { window.clearTimeout(hoverTimer); card.classList.remove("is-hover-expanded"); });
            canvas.addEventListener("dblclick", () => abrirGraficaAmpliada(sensor, field, canvas));
            expandButton.addEventListener("click", () => abrirGraficaAmpliada(sensor, field, expandButton));
            canvas.addEventListener("keydown", event => {
                if (event.key === "Enter" || event.key === " ") { event.preventDefault(); abrirGraficaAmpliada(sensor, field, canvas); }
            });
            canvas.title = "Pasa el cursor o toca para consultar una lectura. Usa las flechas para recorrer los puntos; activa Ampliar para ver la gráfica completa.";
        });
        container.appendChild(card);
    });
}

let graficaOrigenEnfocada = null;
let graficaSensorEnfocada = null;
let graficaCampoEnfocado = null;
let overflowAnteriorAlEnfocar = "";

function obtenerEstadoVacioGraficaEnfocada(canvas) {
    if (!canvas) return null;
    let empty = document.getElementById("chart-focus-empty");
    if (empty) return empty;
    const wrap = canvas.parentElement;
    if (!wrap) return null;
    empty = document.createElement("p");
    empty.id = "chart-focus-empty";
    empty.className = "chart-sensor-empty hidden";
    empty.setAttribute("role", "status");
    wrap.insertBefore(empty, canvas);
    return empty;
}

function abrirGraficaAmpliada(sensor, field, sourceCanvas) {
    const layer = document.getElementById("chart-focus-layer");
    const canvas = document.getElementById("chart-focus-canvas");
    const empty = obtenerEstadoVacioGraficaEnfocada(canvas);
    const summary = document.getElementById("chart-focus-summary");
    const title = document.getElementById("chart-focus-title");
    if (!layer || !canvas || !empty || !summary || !title) return;
    graficaOrigenEnfocada = sourceCanvas;
    graficaSensorEnfocada = sensor;
    graficaCampoEnfocado = field;
    title.textContent = `${sensor.name} · ${field.label}`;
    const hint = document.getElementById("chart-focus-hint");
    if (hint) hint.textContent = "Toca o recorre con el cursor la gráfica para consultar fecha y valor. Con el teclado, usa las flechas izquierda y derecha; Escape o Volver cierra esta vista.";
    layer.hidden = false;
    layer.setAttribute("aria-hidden", "false");
    overflowAnteriorAlEnfocar = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    const compactViewport = window.matchMedia("(max-width: 600px), (max-height: 500px)").matches;
    const height = Math.max(compactViewport ? 176 : 280, Math.min(560, window.innerHeight * (compactViewport ? 0.42 : 0.58)));
    dibujarGraficaCampo(canvas, empty, summary, field, height);
    document.getElementById("chart-focus-back")?.focus();
}

function cerrarGraficaAmpliada() {
    const layer = document.getElementById("chart-focus-layer");
    if (!layer || layer.hidden) return;
    layer.hidden = true;
    layer.setAttribute("aria-hidden", "true");
    document.body.style.overflow = overflowAnteriorAlEnfocar;
    if (graficaOrigenEnfocada?.isConnected && !graficaOrigenEnfocada.disabled && !graficaOrigenEnfocada.classList?.contains("hidden") && !graficaOrigenEnfocada.closest("[hidden]")) graficaOrigenEnfocada.focus();
    graficaOrigenEnfocada = null;
    graficaSensorEnfocada = null;
    graficaCampoEnfocado = null;
}

function redibujarGraficaAmpliada() {
    const layer = document.getElementById("chart-focus-layer");
    const canvas = document.getElementById("chart-focus-canvas");
    const empty = obtenerEstadoVacioGraficaEnfocada(canvas);
    const summary = document.getElementById("chart-focus-summary");
    if (!layer || layer.hidden || !canvas || !empty || !summary || !graficaCampoEnfocado) return;
    const compactViewport = window.matchMedia("(max-width: 600px), (max-height: 500px)").matches;
    const height = Math.max(compactViewport ? 176 : 280, Math.min(560, window.innerHeight * (compactViewport ? 0.42 : 0.58)));
    dibujarGraficaCampo(canvas, empty, summary, graficaCampoEnfocado, height);
}

function descargarDatosGraficaEnfocada() {
    if (!graficaSensorEnfocada || !graficaCampoEnfocado) return;
    const rows = chartReadings.filter(row => Number.isFinite(valorCampoGrafica(row[graficaCampoEnfocado.key], graficaCampoEnfocado)));
    const quote = value => `"${String(value ?? "").replaceAll('"', '""')}"`;
    const csv = [
        ["sensor", "medicion", "fecha_hora", "valor", "unidad"].map(quote).join(","),
        ...rows.map(row => [graficaSensorEnfocada.name, graficaCampoEnfocado.label, new Date(row.fecha_hora).toISOString(), row[graficaCampoEnfocado.key], graficaCampoEnfocado.unit || (graficaCampoEnfocado.kind === "boolean" ? "estado" : "lectura")].map(quote).join(","))
    ].join("\r\n");
    const blob = new Blob(["\uFEFF", csv], { type: "text/csv;charset=utf-8" });
    const url = URL.createObjectURL(blob);
    const link = document.createElement("a");
    link.href = url;
    link.download = `${graficaSensorEnfocada.id}-${graficaCampoEnfocado.key}.csv`;
    link.click();
    window.setTimeout(() => URL.revokeObjectURL(url), 1000);
}

function descargarImagenGraficaEnfocada() {
    const source = document.getElementById("chart-focus-canvas");
    if (!source || !graficaSensorEnfocada || !graficaCampoEnfocado) return;
    const output = document.createElement("canvas");
    output.width = source.width;
    output.height = source.height;
    const context = output.getContext("2d");
    if (!context) return;
    context.fillStyle = getComputedStyle(document.querySelector(".chart-focus-chart")).backgroundColor || "#111827";
    context.fillRect(0, 0, output.width, output.height);
    context.drawImage(source, 0, 0);
    const link = document.createElement("a");
    link.href = output.toDataURL("image/png");
    link.download = `${graficaSensorEnfocada.id}-${graficaCampoEnfocado.key}.png`;
    link.click();
}

function actualizarResumenSensores() {
    let sensorsWithData = 0;
    const staleMinutes = Number(ajustesRangoGrafica().staleMinutes) || 10;
    chartSensorConfig.forEach(sensor => {
        const card = document.querySelector(`[data-chart-sensor="${sensor.id}"]`);
        if (!card) return;
        const hasData = sensor.fields.some(field => puntosCampoGrafica(field).length > 0);
        if (card.dataset.areaHidden === "true") { card.hidden = true; return; }
        if (sensor.optional && !hasData) { card.hidden = true; return; }
        card.hidden = false;
        const status = card.querySelector("[data-chart-sensor-status]");
        const latest = chartLatestReading && sensor.fields.some(field => Number.isFinite(valorCampoGrafica(chartLatestReading[field.key], field))) ? chartLatestReading : null;
        const latestDate = latest ? new Date(latest.fecha_hora) : null;
        const fresh = latestDate && Number.isFinite(latestDate.getTime()) && Date.now() - latestDate.getTime() <= staleMinutes * 60_000;
        const settings = ajustesRangoGrafica();
        const latestTemperature = convertirNumeroLectura(latest?.temperatura);
        const latestHumidity = convertirNumeroLectura(latest?.humedad);
        const isAlert = latest && sensor.id === "dht22" && ((Number.isFinite(latestTemperature) && latestTemperature > Number(settings.temperatureMax))
            || (Number.isFinite(latestHumidity) && (latestHumidity < Number(settings.humidityMin) || latestHumidity > Number(settings.humidityMax))));
        const isAirAlert = latest && sensor.id === "calidad-aire" && Number.isFinite(convertirNumeroLectura(latest.calidad_aire))
            && convertirNumeroLectura(latest.calidad_aire) > Number(settings.airQualityMax);
        if (status) {
            status.textContent = !fresh ? "Sin datos recientes" : isAlert || isAirAlert ? "En alerta" : sensor.id === "dht22" || sensor.id === "calidad-aire" ? "Normal" : "Con datos";
            status.classList.toggle("has-data", Boolean(fresh && !isAlert && !isAirAlert));
            status.classList.toggle("is-alert", Boolean(isAlert || isAirAlert));
            status.classList.toggle("is-stale", !fresh);
        }
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
        const hiddenByArea = card.dataset.areaHidden === "true";
        if (hiddenByArea) { card.hidden = true; return; }
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
    });
    actualizarResumenSensores();
}

async function cargarGraficasSensores() {
    const empty = document.getElementById("chart-overview-empty");
    const summary = document.getElementById("chart-data-summary");
    const updated = document.getElementById("chart-updated-at");
    const button = document.getElementById("chart-refresh");
    const startInput = document.getElementById("chart-start-date");
    const endInput = document.getElementById("chart-end-date");
    const startValue = startInput?.value ? new Date(startInput.value) : new Date(Date.now() - 24 * 60 * 60 * 1000);
    const endValue = endInput?.value ? new Date(endInput.value) : new Date();
    if (!Number.isFinite(startValue.getTime()) || !Number.isFinite(endValue.getTime()) || startValue >= endValue) {
        if (empty) { empty.classList.remove("hidden"); empty.textContent = "El rango no es válido. La fecha inicial debe ser anterior a la fecha final."; }
        return;
    }
    if (chartLoading) return;
    chartLoading = true;
    if (button) { button.disabled = true; button.setAttribute("aria-busy", "true"); }
    if (empty) { empty.textContent = "Consultando historial…"; empty.classList.remove("hidden"); }
    document.getElementById("chart-overview-canvas")?.classList.add("hidden");
    try {
        const query = new URLSearchParams({ desde: startValue.toISOString(), hasta: endValue.toISOString() });
        const result = await apiFetch(`/sensores/historial?${query.toString()}`);
        if (!result.ok) throw new Error(result.data?.detail || "No se pudo consultar el historial.");
        if (!Array.isArray(result.data)) throw new Error("La respuesta del historial no tiene el formato esperado.");
        chartAllReadings = result.data.filter(row => row && row.fecha_hora).sort((a, b) => new Date(a.fecha_hora) - new Date(b.fecha_hora));
        const duration = endValue.getTime() - startValue.getTime();
        const previousStart = new Date(startValue.getTime() - duration);
        const previousEnd = new Date(startValue.getTime() - 1);
        chartAllPreviousReadings = [];
        try {
            const previousQuery = new URLSearchParams({ desde: previousStart.toISOString(), hasta: previousEnd.toISOString() });
            const previousResult = await apiFetch(`/sensores/historial?${previousQuery.toString()}`);
            if (previousResult.ok && Array.isArray(previousResult.data)) {
                chartAllPreviousReadings = previousResult.data.filter(row => row && row.fecha_hora).sort((a, b) => new Date(a.fecha_hora) - new Date(b.fecha_hora));
            }
        } catch (comparisonError) {
            console.info("No fue posible obtener el periodo anterior para comparar.", comparisonError.message);
        }
        try {
            const latestResult = await apiFetch("/sensores/ultimas");
            chartLatestReading = latestResult.ok && Array.isArray(latestResult.data) ? latestResult.data[0] || null : null;
        } catch (latestError) {
            chartLatestReading = null;
            console.info("No fue posible consultar el estado actual del ESP32.", latestError.message);
        }
        actualizarFiltrosLocales();
        if (updated) updated.textContent = `Actualizado ${new Date().toLocaleTimeString("es-EC", { hour: "2-digit", minute: "2-digit" })}`;
    } catch (error) {
        chartAllReadings = [];
        chartAllPreviousReadings = [];
        chartPreviousReadings = [];
        chartLatestReading = null;
        chartReadings = [];
        dibujarTodasLasGraficas();
        const total = document.getElementById("chart-total-readings");
        if (total) total.textContent = "—";
        const active = document.getElementById("chart-active-sensors");
        if (active) active.textContent = "—";
        const alerts = document.getElementById("chart-alert-readings");
        if (alerts) alerts.textContent = "—";
        const latest = document.getElementById("chart-last-reading");
        if (latest) latest.textContent = "—";
        if (empty) { empty.classList.remove("hidden"); empty.textContent = error.message || "No se pudo conectar con el historial de sensores."; }
        if (summary) summary.textContent = "Revisa que el backend tenga disponible /sensores/historial.";
    } finally {
        chartLoading = false;
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
    homeTrendCoordinates = {};
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
        homeTrendCoordinates[key] = coords;
        context.beginPath();
        let drawing = false;
        coords.forEach(point => {
            if (!point) { drawing = false; return; }
            if (!drawing) { context.moveTo(point.x, point.y); drawing = true; }
            else context.lineTo(point.x, point.y);
        });
        context.strokeStyle = colors[key]; context.lineWidth = 2.3; context.lineJoin = "round"; context.lineCap = "round"; context.stroke();
        coords.forEach(point => {
            if (!point) return;
            context.beginPath(); context.arc(point.x, point.y, 2.5, 0, Math.PI * 2); context.fillStyle = colors[key]; context.fill();
        });
    });
    context.fillStyle = chartCssColor("--text-secondary", "#94a3b8");
    context.font = "10px system-ui, sans-serif"; context.textBaseline = "bottom";
    context.textAlign = "left"; context.fillText("Hace 24 h", padding.left, height - 1);
    context.textAlign = "right"; context.fillText("Ahora", width - padding.right, height - 1);
    const tooltip = document.getElementById("sensor-trend-tooltip");
    if (tooltip) {
        const wrap = canvas.closest(".dashboard-trend-chart-wrap");
        let guide = wrap?.querySelector("[data-chart-hover-guide]");
        let markers = wrap?.querySelectorAll("[data-trend-hover-dot]");
        if (wrap && !guide) {
            guide = document.createElement("span");
            guide.className = "chart-hover-guide";
            guide.dataset.chartHoverGuide = "";
            guide.setAttribute("aria-hidden", "true");
            wrap.appendChild(guide);
        }
        if (wrap && (!markers || markers.length !== 2)) {
            wrap.querySelectorAll("[data-trend-hover-dot]").forEach(dot => dot.remove());
            ["temperatura", "humedad"].forEach(key => {
                const dot = document.createElement("span");
                dot.className = "chart-hover-dot chart-hover-dot--trend";
                dot.dataset.trendHoverDot = key;
                dot.setAttribute("aria-hidden", "true");
                wrap.appendChild(dot);
            });
            markers = wrap.querySelectorAll("[data-trend-hover-dot]");
        }
        canvas.onpointermove = event => {
            const bounds = canvas.getBoundingClientRect();
            const wrapBounds = wrap.getBoundingClientRect();
            const x = event.clientX - bounds.left;
            const index = Math.max(0, Math.min(readings.length - 1, Math.round((x - padding.left) / plotWidth * (readings.length - 1))));
            const selectedX = bounds.left - wrapBounds.left + padding.left + (readings.length === 1 ? .5 : index / (readings.length - 1)) * plotWidth;
            if (guide) {
                guide.style.left = `${selectedX}px`;
                guide.style.top = `${bounds.top - wrapBounds.top + padding.top}px`;
                guide.style.bottom = `${wrapBounds.height - (bounds.top - wrapBounds.top + height - padding.bottom)}px`;
                guide.classList.add("is-visible");
            }
            markers?.forEach(dot => {
                const coords = homeTrendCoordinates[dot.dataset.trendHoverDot];
                const point = coords?.[index];
                if (!point) { dot.classList.remove("is-visible"); return; }
                dot.style.left = `${bounds.left - wrapBounds.left + point.x}px`;
                dot.style.top = `${bounds.top - wrapBounds.top + point.y}px`;
                dot.style.setProperty("--chart-point-color", colors[dot.dataset.trendHoverDot]);
                dot.classList.add("is-visible");
            });
            const row = readings[index];
            const date = new Date(row.fecha_hora);
            const temperature = convertirNumeroLectura(row.temperatura);
            const humidity = convertirNumeroLectura(row.humedad);
            const values = [Number.isFinite(temperature) ? `${temperature.toFixed(1)} °C` : null, Number.isFinite(humidity) ? `${humidity.toFixed(1)} %` : null].filter(Boolean).join(" · ");
            tooltip.textContent = `${date.toLocaleString("es-EC", { dateStyle: "medium", timeStyle: "short" })} · ${values}`;
            tooltip.style.left = `${Math.max(8, Math.min(bounds.width - 260, x + 10))}px`;
            tooltip.classList.add("is-visible");
        };
        canvas.onpointerleave = () => {
            tooltip.classList.remove("is-visible");
            guide?.classList.remove("is-visible");
            markers?.forEach(dot => dot.classList.remove("is-visible"));
        };
    }
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
    aplicarPeriodoRapido();
    document.getElementById("chart-refresh")?.addEventListener("click", cargarGraficasSensores);
    document.getElementById("chart-period")?.addEventListener("change", () => { aplicarPeriodoRapido(); void cargarGraficasSensores(); });
    ["chart-start-date", "chart-end-date"].forEach(id => document.getElementById(id)?.addEventListener("change", () => {
        const period = document.getElementById("chart-period");
        if (period) period.value = "custom";
        void cargarGraficasSensores();
    }));
    ["chart-area-filter", "chart-state-filter"].forEach(id => document.getElementById(id)?.addEventListener("change", actualizarFiltrosLocales));
    document.getElementById("chart-focus-back")?.addEventListener("click", cerrarGraficaAmpliada);
    document.getElementById("chart-focus-download-png")?.addEventListener("click", descargarImagenGraficaEnfocada);
    document.getElementById("chart-focus-download-csv")?.addEventListener("click", descargarDatosGraficaEnfocada);
    document.getElementById("chart-focus-layer")?.addEventListener("click", event => {
        if (event.target.id === "chart-focus-layer") cerrarGraficaAmpliada();
    });
    document.addEventListener("keydown", event => {
        const layer = document.getElementById("chart-focus-layer");
        if (!layer || layer.hidden) return;
        if (event.key === "Escape") {
            event.preventDefault();
            cerrarGraficaAmpliada();
            return;
        }
        if (event.key !== "Tab") return;
        const dialog = layer.querySelector('[role="dialog"]');
        const focusable = [...(dialog?.querySelectorAll('button:not([disabled]), canvas[tabindex="0"]') || [])]
            .filter(element => element.getClientRects().length > 0);
        if (!focusable.length) { event.preventDefault(); return; }
        const first = focusable[0];
        const last = focusable.at(-1);
        if (event.shiftKey && (document.activeElement === first || !dialog?.contains(document.activeElement))) {
            event.preventDefault(); last.focus();
        } else if (!event.shiftKey && (document.activeElement === last || !dialog?.contains(document.activeElement))) {
            event.preventDefault(); first.focus();
        }
    });
    if (chartRefreshTimer) clearInterval(chartRefreshTimer);
    const configuredInterval = typeof obtenerConfiguracionOperador === "function" ? Number(obtenerConfiguracionOperador().refreshSeconds) : 60;
    const refreshMs = Math.max(30, Math.min(300, Number.isFinite(configuredInterval) ? configuredInterval : 60)) * 1000;
    chartRefreshTimer = window.setInterval(() => {
        if (document.hidden || !document.getElementById("charts-panel")?.getClientRects().length) return;
        if (document.getElementById("chart-period")?.value !== "custom") aplicarPeriodoRapido();
        void cargarGraficasSensores();
    }, refreshMs);
    window.addEventListener("resize", () => {
        if (document.getElementById("charts-panel")?.getClientRects().length) dibujarTodasLasGraficas();
        if (document.getElementById("dashboard-trends")?.getClientRects().length) dibujarTendenciaInicio();
        redibujarGraficaAmpliada();
    }, { passive: true });
}
window.cargarTendenciaInicio = cargarTendenciaInicio;
document.addEventListener("DOMContentLoaded", inicializarGraficasSensores);
