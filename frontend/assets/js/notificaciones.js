// Centro de notificaciones: almacenamiento local por cuenta y avisos de sensores.

function claveNotificacionesUsuario(sufijo) {
    const usuarioId = localStorage.getItem("user_id_cloud") || localStorage.getItem("user_name_cloud") || "usuario";
    return `smartcity_${sufijo}_${usuarioId}`;
}

function leerNotificacionesUsuario() {
    try {
        const parsed = JSON.parse(localStorage.getItem(claveNotificacionesUsuario("notificaciones")) || "[]");
        return Array.isArray(parsed) ? parsed : [];
    } catch (error) {
        return [];
    }
}

function guardarNotificacionesUsuario(notificaciones) {
    try {
        localStorage.setItem(claveNotificacionesUsuario("notificaciones"), JSON.stringify(notificaciones.slice(0, 40)));
    } catch (error) {
        console.warn("No se pudieron guardar las notificaciones en este navegador.", error);
    }
}

function claveHistorialAlertasVisto() {
    const usuarioId = localStorage.getItem("user_id_cloud") || localStorage.getItem("user_name_cloud") || "usuario";
    return `smartcity_historial_alertas_visto_${usuarioId}`;
}

function registrarNotificacionesCambiosAlertas(alertas) {
    if (!Array.isArray(alertas) || !alertas.length) return;
    const vistoKey = claveHistorialAlertasVisto();
    let idsVistos = [];
    let primeraCarga = false;
    try {
        const stored = localStorage.getItem(vistoKey);
        primeraCarga = stored === null;
        idsVistos = stored ? JSON.parse(stored) : [];
        if (!Array.isArray(idsVistos)) idsVistos = [];
    } catch (error) {
        idsVistos = [];
    }

    const vistoSet = new Set(idsVistos.map(String));
    const eventos = alertas.flatMap(alerta => (Array.isArray(alerta.historial) ? alerta.historial : [])
        .filter(evento => evento.estado_anterior && evento.id !== undefined && evento.id !== null)
        .map(evento => ({ alerta, evento })))
        .sort((a, b) => new Date(a.evento.creado_en) - new Date(b.evento.creado_en));
    const notificacionesNuevas = [];
    const limiteInicial = Date.now() - 7 * 24 * 60 * 60 * 1000;
    eventos.forEach(({ alerta, evento }) => {
        const id = String(evento.id);
        if (vistoSet.has(id)) return;
        vistoSet.add(id);
        const fecha = evento.creado_en ? new Date(evento.creado_en) : new Date();
        if (primeraCarga && (Number.isNaN(fecha.getTime()) || fecha.getTime() < limiteInicial)) return;
        const nota = evento.observacion ? ` Nota: ${evento.observacion}` : "";
        notificacionesNuevas.push({
            id: `alerta-${id}`,
            type: "alerta_estado",
            alertId: alerta.id,
            titulo: `Actualización: ${alerta.titulo || "Aviso"}`,
            mensaje: `${evento.actor || "El administrador"} cambió el estado a ${etiquetaEstadoAlerta(evento.estado_nuevo)}.${nota}`,
            fecha: evento.creado_en || new Date().toISOString(),
            leida: false
        });
    });

    try {
        localStorage.setItem(vistoKey, JSON.stringify(Array.from(vistoSet).slice(-1500)));
    } catch (error) {
        console.warn("No se pudo guardar el registro de cambios de alertas vistos.", error);
    }
    if (notificacionesNuevas.length) {
        guardarNotificacionesUsuario([...notificacionesNuevas.reverse(), ...leerNotificacionesUsuario()]);
        renderizarNotificaciones();
    }
}

function renderizarNotificaciones() {
    const list = document.getElementById("notification-list");
    const badge = document.getElementById("notification-unread-count");
    const button = document.getElementById("btn-notificaciones");
    if (!list || !badge || !button) return;

    const notificaciones = leerNotificacionesUsuario();
    const unread = notificaciones.filter(item => !item.leida).length;
    badge.textContent = unread > 99 ? "99+" : String(unread);
    badge.classList.toggle("hidden", unread === 0);
    button.setAttribute("aria-label", unread ? `Notificaciones, ${unread} sin leer` : "Notificaciones");
    list.replaceChildren();

    if (!notificaciones.length) {
        const empty = document.createElement("p");
        empty.className = "notification-empty";
        empty.textContent = "No tienes avisos por ahora.";
        list.appendChild(empty);
        return;
    }

    notificaciones.forEach(item => {
        const row = document.createElement("button");
        row.type = "button";
        row.className = `notification-item${item.leida ? "" : " is-unread"}`;
        row.setAttribute("role", "listitem");
        row.addEventListener("click", () => abrirNotificacion(item.id));

        const heading = document.createElement("span");
        heading.className = "notification-item-heading";
        const title = document.createElement("strong");
        title.textContent = item.titulo || "Aviso de sensor";
        const time = document.createElement("time");
        const date = new Date(item.fecha);
        time.textContent = Number.isNaN(date.getTime()) ? "" : date.toLocaleString("es-EC", { dateStyle: "short", timeStyle: "short" });
        heading.append(title, time);

        const message = document.createElement("span");
        message.className = "notification-item-message";
        message.textContent = item.mensaje || "";
        row.append(heading, message);

        const tags = document.createElement("span");
        tags.className = "notification-item-tags";
        if (item.sensorId) {
            const sensor = document.createElement("span");
            sensor.className = "notification-sensor-tag";
            sensor.textContent = item.sensorId;
            tags.appendChild(sensor);
        }
        if (item.demo) {
            const demo = document.createElement("span");
            demo.className = "notification-demo-tag";
            demo.textContent = "DEMO";
            tags.appendChild(demo);
        }
        const action = document.createElement("span");
        action.className = "notification-open-hint";
        action.textContent = item.type === "alerta_estado" ? "Ver alerta →" : "Abrir sensor →";
        tags.append(action);
        row.appendChild(tags);
        list.appendChild(row);
    });
}

function toggleMenuNotificaciones() {
    const menu = document.getElementById("notification-menu");
    const trigger = document.getElementById("btn-notificaciones");
    if (!menu || !trigger) return;
    const opening = menu.classList.contains("hidden");
    if (opening) cerrarAccountMenu();
    menu.classList.toggle("hidden", !opening);
    trigger.setAttribute("aria-expanded", String(opening));
}

function cerrarMenuNotificaciones() {
    document.getElementById("notification-menu")?.classList.add("hidden");
    document.getElementById("btn-notificaciones")?.setAttribute("aria-expanded", "false");
}

function marcarTodasNotificacionesLeidas() {
    guardarNotificacionesUsuario(leerNotificacionesUsuario().map(item => ({ ...item, leida: true })));
    renderizarNotificaciones();
}

function abrirNotificacion(id) {
    const notificaciones = leerNotificacionesUsuario();
    const seleccionada = notificaciones.find(item => item.id === id);
    if (!seleccionada) return;
    guardarNotificacionesUsuario(notificaciones.map(item => item.id === id ? { ...item, leida: true } : item));
    renderizarNotificaciones();
    cerrarMenuNotificaciones();
    if (seleccionada.alertId !== undefined && seleccionada.alertId !== null) {
        navegarA("alertas");
        window.setTimeout(() => {
            const alerta = Array.from(document.querySelectorAll("[data-alerta-id]"))
                .find(element => element.dataset.alertaId === String(seleccionada.alertId));
            alerta?.scrollIntoView({ behavior: document.body.classList.contains("reduce-motion") ? "auto" : "smooth", block: "center" });
            const historial = alerta?.querySelector(".alert-history");
            if (historial) historial.open = true;
        }, 100);
        return;
    }
    if (seleccionada.sensorId) {
        navegarA("dashboard");
        const sensor = typeof sensoresEnMapa !== "undefined"
            ? sensoresEnMapa.find(item => item.id === seleccionada.sensorId)
            : null;
        if (sensor && typeof mostrarDetalleSensor === "function") mostrarDetalleSensor(sensor);
    }
}

function registrarNotificacionesSensores(sensores, esDemo = false) {
    const notificationsEnabled = obtenerConfiguracionOperador().notificationsEnabled !== false;
    const estadoKey = claveNotificacionesUsuario("alertas_activas");
    let anteriores = {};
    try {
        anteriores = JSON.parse(localStorage.getItem(estadoKey) || "{}");
        if (!anteriores || typeof anteriores !== "object" || Array.isArray(anteriores)) anteriores = {};
    } catch (error) {
        anteriores = {};
    }

    const actuales = {};
    const eventos = [];
    sensores.forEach(({ id, lectura }) => {
        (esDemo ? [] : valoresFueraDeRango(lectura)).forEach(valor => {
            const metrica = valor.split(/\s+/)[0];
            const key = `${id}::${metrica}`;
            actuales[key] = { sensorId: id, valor };
            if (notificationsEnabled && !anteriores[key]) {
                eventos.push({ titulo: "Lectura fuera de rango", mensaje: `${id}: ${valor}`, sensorId: id, demo: esDemo });
            }
        });
    });

    // Solo avisar al cruzar un umbral; los valores de demostración quedan excluidos.
    try {
        localStorage.setItem(estadoKey, JSON.stringify(notificationsEnabled ? actuales : {}));
    } catch (error) {
        console.warn("No se pudo actualizar el estado de las alertas.", error);
    }

    if (eventos.length) {
        const existentes = leerNotificacionesUsuario();
        const fecha = new Date().toISOString();
        const nuevas = eventos.map((evento, index) => ({
            ...evento,
            id: `${Date.now()}-${index}-${Math.random().toString(36).slice(2, 7)}`,
            fecha,
            leida: false
        }));
        guardarNotificacionesUsuario([...nuevas, ...existentes]);
    }
    renderizarNotificaciones();
}

function registrarEstadoConexionSensor({ sensorId, ultimaLectura, huboRespuestaReal }) {
    const settings = obtenerConfiguracionOperador();
    const lastSeenKey = claveNotificacionesUsuario("sensor_ultima_lectura");
    const offlineKey = claveNotificacionesUsuario("sensor_sin_datos");
    const label = String(settings.sensorLabel || sensorId || "ESP32");
    if (huboRespuestaReal && ultimaLectura) {
        const timestamp = new Date(ultimaLectura).getTime();
        if (Number.isFinite(timestamp)) {
            try { localStorage.setItem(lastSeenKey, String(timestamp)); }
            catch (error) { console.warn("No se pudo guardar la última lectura recibida.", error); }
        }
    }
    let lastSeen = 0;
    try { lastSeen = Number(localStorage.getItem(lastSeenKey) || 0); }
    catch (error) { /* La detección de desconexión queda desactivada si el almacenamiento no está disponible. */ }
    const ageMs = Date.now() - lastSeen;
    const limitMs = Math.max(2, Number(settings.staleMinutes) || 10) * 60_000;
    const stale = lastSeen > 0 && ageMs >= limitMs;
    let wasOffline = false;
    try { wasOffline = localStorage.getItem(offlineKey) === "true"; }
    catch (error) { /* La notificación se conserva en memoria si no se puede leer el estado. */ }

    if (!stale) {
        try { localStorage.removeItem(offlineKey); } catch (error) { /* No afecta al panel. */ }
        return;
    }
    if (!settings.notificationsEnabled || wasOffline) return;

    const minutes = Math.floor(ageMs / 60_000);
    const notification = {
        id: `sensor-sin-datos-${Date.now()}`,
        titulo: `Sin datos · ${label}`,
        mensaje: `No llegan lecturas desde hace ${minutes} min. Revisa la conexión del ESP32.`,
        sensorId: String(sensorId || label),
        fecha: new Date().toISOString(),
        leida: false,
        origen: "sensor"
    };
    guardarNotificacionesUsuario([notification, ...leerNotificacionesUsuario()]);
    try { localStorage.setItem(offlineKey, "true"); } catch (error) { /* Puede repetirse en el siguiente ciclo si el almacenamiento está lleno. */ }
    renderizarNotificaciones();
}
