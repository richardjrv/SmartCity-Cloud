// ============================================================
// 🔔 SISTEMA DE NOTIFICACIONES TOAST
// ============================================================
function mostrarNotificacion(mensaje, tipo = "info") {
    const container = document.getElementById("toast-container");
    if (!container) return;

    const toast = document.createElement("div");
    toast.className = `pointer-events-auto flex items-center gap-3 px-4 py-3 rounded-2xl shadow-2xl text-xs font-semibold text-white backdrop-blur-xl border transition-all duration-300 transform translate-x-10 opacity-0`;
    toast.setAttribute("role", tipo === "error" ? "alert" : "status");
    toast.setAttribute("aria-live", tipo === "error" ? "assertive" : "polite");
    const icon = document.createElement("span");
    const text = document.createElement("span");
    text.textContent = String(mensaje ?? "");

    // Estilos según el tipo
    if (tipo === "exito") {
        toast.classList.add("bg-emerald-900/90", "border-emerald-500/50");
        icon.textContent = "✅";
    } else if (tipo === "error") {
        toast.classList.add("bg-rose-900/90", "border-rose-500/50");
        icon.textContent = "⚠️";
    } else {
        toast.classList.add("bg-blue-900/90", "border-blue-500/50");
        icon.textContent = "ℹ️";
    }
    icon.setAttribute("aria-hidden", "true");
    toast.append(icon, text);

    container.appendChild(toast);

    // Animación de entrada
    setTimeout(() => {
        toast.classList.remove("translate-x-10", "opacity-0");
    }, 10);

    // Salida automática
    setTimeout(() => {
        toast.classList.add("translate-x-10", "opacity-0");
        setTimeout(() => toast.remove(), 300);
    }, 3500);
}
// ============================================================
// 🚀 ORQUESTRADOR PRINCIPAL Y NAVEGACIÓN
// ============================================================

const TEXT_SIZE_STEPS = [0.875, 1, 1.125, 1.25];
const TEXT_SIZE_STORAGE_KEY = "smartcity_text_size";
const THEME_STORAGE_KEY = "smartcity_theme";
const ACCENT_STORAGE_KEY = "accent_cloud";
const ACCENT_OPTIONS = ["blue", "green", "purple", "orange"];
const SIDEBAR_STORAGE_KEY = "smartcity_sidebar_collapsed";
let dashboardSensorDataRequested = false;

function initTextSizeControls() {
    let savedScale = 1;
    try {
        const storedScale = Number(localStorage.getItem(TEXT_SIZE_STORAGE_KEY));
        if (TEXT_SIZE_STEPS.includes(storedScale)) savedScale = storedScale;
    } catch (error) {
        console.warn("No se pudo leer la preferencia de tamaño de texto.", error);
    }
    applyTextSize(savedScale, false);
    let savedTheme = "dark";
    try {
        const storedTheme = localStorage.getItem(THEME_STORAGE_KEY);
        if (storedTheme === "light" || storedTheme === "dark") savedTheme = storedTheme;
    } catch (error) {
        console.warn("No se pudo leer la preferencia de tema.", error);
    }
    applyTheme(savedTheme, false);
    let savedAccent = "blue";
    try {
        const storedAccent = localStorage.getItem(ACCENT_STORAGE_KEY);
        if (ACCENT_OPTIONS.includes(storedAccent)) savedAccent = storedAccent;
    } catch (error) {
        console.warn("No se pudo leer la preferencia de color.", error);
    }
    applyAccent(savedAccent, false);
}

function applyTextSize(scale, persist = true) {
    const percentage = Math.round(scale * 100);
    document.documentElement.dataset.textScale = String(scale);
    document.documentElement.style.fontSize = percentage + "%";
    document.documentElement.style.setProperty("--font-scale", String(scale));
    const settingsSize = document.getElementById("config-text-size");
    if (settingsSize) settingsSize.value = String(scale);

    if (persist) {
        try {
            localStorage.setItem(TEXT_SIZE_STORAGE_KEY, String(scale));
        } catch (error) {
            console.warn("No se pudo guardar la preferencia de tamaño de texto.", error);
        }
    }
}
function applyTheme(theme, persist = true) {
    const normalizedTheme = theme === "light" ? "light" : "dark";
    document.documentElement.dataset.theme = normalizedTheme;
    document.documentElement.classList.toggle("dark", normalizedTheme === "dark");
    const settingsTheme = document.getElementById("config-theme");
    if (settingsTheme) settingsTheme.value = normalizedTheme;

    if (persist) {
        try {
            localStorage.setItem(THEME_STORAGE_KEY, normalizedTheme);
        } catch (error) {
            console.warn("No se pudo guardar la preferencia de tema.", error);
        }
    }
}

function applyAccent(color, persist = true) {
    const normalizedColor = ACCENT_OPTIONS.includes(color) ? color : "blue";
    document.documentElement.dataset.accent = normalizedColor;
    document.querySelectorAll("[data-accent-option]").forEach(button => {
        const selected = button.dataset.accentOption === normalizedColor;
        button.classList.toggle("active", selected);
        button.setAttribute("aria-pressed", String(selected));
    });

    if (persist) {
        try {
            localStorage.setItem(ACCENT_STORAGE_KEY, normalizedColor);
            mostrarEstadoConfiguracion("Color de acento guardado.");
        } catch (error) {
            console.warn("No se pudo guardar la preferencia de color.", error);
        }
    }
}

function navegarA(vista) {
    document.body.classList.toggle("login-only", vista === "auth");
    cerrarMobileNav();
    cerrarMenuNotificaciones();
    const token = obtenerToken();

    // 🔒 Si no hay sesión activa y no está en 'auth', redirigir forzosamente al Login
    if (!token && vista !== "auth") {
        navegarA("auth");
        return;
    }

    // Ocultar todas las secciones
    document.getElementById("vista-dashboard")?.classList.add("hidden");
    document.getElementById("vista-perfil")?.classList.add("hidden");
    document.getElementById("vista-configuracion")?.classList.add("hidden");
    document.getElementById("vista-admin-usuarios")?.classList.add("hidden");
    document.getElementById("vista-auth")?.classList.add("hidden");
    cerrarAccountMenu();
    actualizarNavegacionLateral(vista);

    if (vista === "auth") {
        // La sesión es el requisito para mostrar la navegación de la aplicación.
        document.getElementById("app-sidebar")?.classList.add("hidden");
        document.getElementById("btn-mobile-nav")?.classList.add("hidden");
        document.getElementById("account-menu-wrap")?.classList.add("hidden");
        document.getElementById("notification-menu-wrap")?.classList.add("hidden");
        document.getElementById("btn-menu-configuracion")?.classList.add("hidden");

        document.getElementById("vista-auth")?.classList.remove("hidden");
    } else if (["dashboard", "capas", "tiempo", "simulador", "alertas", "sensores", "reportes"].includes(vista)) {
        document.getElementById("app-sidebar")?.classList.remove("hidden");
        document.getElementById("vista-dashboard")?.classList.remove("hidden");
        const vistaDashboard = vista === "sensores" ? "tiempo" : vista;
        aplicarVistaDashboard(vistaDashboard);
        if (!dashboardSensorDataRequested) {
            dashboardSensorDataRequested = true;
            cargarMapaSensores();
        }
        if (vistaDashboard === "capas") seleccionarCapaMapa(capaMapaActual || "estado");
        const behavior = document.body.classList.contains("reduce-motion") ? "auto" : "smooth";
        requestAnimationFrame(() => window.scrollTo({ top: 0, behavior }));
    } else if (vista === "perfil") {
        document.getElementById("vista-perfil")?.classList.remove("hidden");
        cargarPerfilUsuario();
    } else if (vista === "configuracion") {
        document.getElementById("vista-configuracion")?.classList.remove("hidden");
        cargarConfiguracionEnControles();
    } else if (vista === "admin-usuarios") {
        const rol = Number(localStorage.getItem("user_role_cloud"));
        if (rol !== 1) {
            alert("⛔ No tienes permisos de Administrador.");
            navegarA("dashboard");
            return;
        }
        document.getElementById("vista-admin-usuarios")?.classList.remove("hidden");
        cargarUsuariosAdmin();
    }
}

function aplicarVistaDashboard(vista) {
    const dashboard = document.getElementById("vista-dashboard");
    const vistasDisponibles = ["dashboard", "capas", "tiempo", "simulador", "alertas", "reportes"];
    const vistaActiva = vistasDisponibles.includes(vista) ? vista : "dashboard";
    dashboard?.setAttribute("data-current-view", vistaActiva);
    document.querySelectorAll("[data-dashboard-panel]").forEach(panel => {
        const vistas = panel.dataset.dashboardPanel.split(/\s+/);
        panel.classList.toggle("hidden", !vistas.includes(vistaActiva));
    });
}

function mostrarDashboard(nombre, idRol) {
    // 🔓 Mostrar navegación y acciones superiores únicamente con sesión válida
    document.getElementById("app-sidebar")?.classList.remove("hidden");
    document.getElementById("btn-mobile-nav")?.classList.remove("hidden");
    document.getElementById("account-menu-wrap")?.classList.remove("hidden");
    document.getElementById("notification-menu-wrap")?.classList.remove("hidden");
    document.getElementById("btn-menu-configuracion")?.classList.remove("hidden");
    renderizarNotificaciones();

    const navNombre = document.getElementById("nav-usuario-nombre");
    if (navNombre) navNombre.innerText = nombre;
    const menuNombre = document.getElementById("account-menu-name");
    if (menuNombre) menuNombre.textContent = nombre;

    const btnAdmin = document.getElementById("btn-menu-admin");
    if (btnAdmin) {
        if (Number(idRol) === 1) {
            btnAdmin.classList.remove("hidden");
        } else {
            btnAdmin.classList.add("hidden");
        }
    }

    navegarA("dashboard");
}

function toggleMobileNav() {
    const sidebar = document.getElementById("app-sidebar");
    const button = document.getElementById("btn-mobile-nav");
    const backdrop = document.getElementById("sidebar-backdrop");
    const opening = !document.body.classList.contains("mobile-sidebar-open");
    document.body.classList.toggle("mobile-sidebar-open", opening);
    sidebar?.classList.remove("hidden");
    backdrop?.classList.toggle("hidden", !opening);
    button?.setAttribute("aria-expanded", String(opening));
    button?.setAttribute("aria-label", opening ? "Cerrar navegación" : "Abrir navegación");
}

function cerrarMobileNav() {
    document.body.classList.remove("mobile-sidebar-open");
    document.getElementById("sidebar-backdrop")?.classList.add("hidden");
    document.getElementById("btn-mobile-nav")?.setAttribute("aria-expanded", "false");
    document.getElementById("btn-mobile-nav")?.setAttribute("aria-label", "Abrir navegación");
}

function toggleSidebar() {
    const collapsed = !document.body.classList.contains("sidebar-collapsed");
    document.body.classList.toggle("sidebar-collapsed", collapsed);
    const button = document.getElementById("sidebar-toggle");
    const label = collapsed ? "Expandir barra lateral" : "Contraer barra lateral";
    if (button) {
        button.setAttribute("aria-label", label);
        button.title = label;
        button.setAttribute("aria-expanded", String(!collapsed));
        button.textContent = collapsed ? "›" : "‹";
    }
    try {
        localStorage.setItem(SIDEBAR_STORAGE_KEY, String(collapsed));
    } catch (error) {
        console.warn("No se pudo guardar el estado de la barra lateral.", error);
    }
}

function actualizarNavegacionLateral(vista) {
    const vistas = ["dashboard", "capas", "tiempo", "simulador", "alertas", "reportes", "admin-usuarios"];
    const activa = vistas.includes(vista) ? vista : null;
    document.querySelectorAll("[data-sidebar-view]").forEach(button => {
        if (button.dataset.sidebarView === activa) {
            button.setAttribute("aria-current", "page");
        } else {
            button.removeAttribute("aria-current");
        }
    });
}

function inicializarBarraLateral() {
    try {
        const collapsed = localStorage.getItem(SIDEBAR_STORAGE_KEY) === "true";
        document.body.classList.toggle("sidebar-collapsed", collapsed);
        const button = document.getElementById("sidebar-toggle");
        if (button && collapsed) {
            button.textContent = "›";
            button.setAttribute("aria-label", "Expandir barra lateral");
            button.title = "Expandir barra lateral";
            button.setAttribute("aria-expanded", "false");
        }
    } catch (error) {
        console.warn("No se pudo recuperar el estado de la barra lateral.", error);
    }
    document.addEventListener("keydown", event => {
        if (event.key === "Escape") {
            cerrarMobileNav();
            cerrarRecorridoGuiado();
        }
    });
}

function actualizarSimuladorUrbano() {
    const atenuacion = Number(document.getElementById("simulator-dimming")?.value || 0);
    const horas = Number(document.getElementById("simulator-hours")?.value || 0);
    const luminarias = 18;
    const potenciaPorLuminariaKw = 0.1;
    const ahorroDiario = luminarias * potenciaPorLuminariaKw * horas * (atenuacion / 100);
    const formato = value => new Intl.NumberFormat("es-EC", { maximumFractionDigits: 1 }).format(value);
    const porcentaje = document.getElementById("simulator-dimming-value");
    const duracion = document.getElementById("simulator-hours-value");
    const diario = document.getElementById("simulator-daily-saving");
    const anual = document.getElementById("simulator-yearly-saving");
    const conteo = document.getElementById("simulator-lamp-count");
    if (porcentaje) porcentaje.textContent = `${atenuacion} %`;
    if (duracion) duracion.textContent = `${horas} h`;
    if (diario) diario.textContent = `${formato(ahorroDiario)} kWh`;
    if (anual) anual.textContent = `${formato(ahorroDiario * 365)} kWh`;
    if (conteo) conteo.textContent = `${luminarias} simuladas`;
}

const PASOS_RECORRIDO = [
    { vista: "dashboard", destino: "city-3d-panel", titulo: "Pulso de la ciudad", texto: "El modelo 3D es la vista central. Si el ESP32 aún no está conectado, la pantalla lo indicará y usará lecturas simuladas." },
    { vista: "capas", destino: "map-layer-toolbar", titulo: "Explora las capas", texto: "Cambia entre temperatura, humedad, calidad del aire y estado general. Los colores orientan la lectura del mapa." },
    { vista: "tiempo", destino: "timeline-panel", titulo: "Viaja en el tiempo", texto: "Mueve el control o reproduce las últimas 24 horas. La demo usa muestras simuladas y el modo conectado usa el historial guardado." },
    { vista: "dashboard", destino: "urban-pulse-strip", titulo: "Revisa el pulso urbano", texto: "Aquí ves cuántos sensores aparecen, cuántas lecturas requieren revisión y de dónde vienen los datos." },
    { vista: "simulador", destino: "simulator-panel", titulo: "Prueba un escenario", texto: "El simulador estima ahorro con supuestos editables. No mide consumo real ni controla luminarias físicas." },
    { vista: "alertas", destino: "alert-center-panel", titulo: "Revisa observaciones", texto: "Los rangos son orientativos para la demostración y ayudan a ubicar lecturas que merecen revisión." },
    { vista: "reportes", destino: "reportes-panel", titulo: "Descarga tus reportes", texto: "Descarga directamente un CSV o un PDF del periodo elegido. Los datos demo quedan etiquetados como simulados." }
];
let pasoRecorridoActual = 0;

function iniciarRecorridoGuiado() {
    if (!obtenerToken()) { navegarA("auth"); return; }
    if (document.getElementById("vista-dashboard")?.classList.contains("hidden")) navegarA("dashboard");
    cerrarMobileNav();
    pasoRecorridoActual = 0;
    const overlay = document.getElementById("tour-overlay");
    overlay?.classList.remove("hidden");
    overlay?.setAttribute("aria-hidden", "false");
    mostrarPasoRecorrido();
    document.getElementById("tour-next")?.focus({ preventScroll: true });
}

function mostrarPasoRecorrido() {
    const paso = PASOS_RECORRIDO[pasoRecorridoActual];
    aplicarVistaDashboard(paso.vista);
    document.querySelectorAll(".tour-highlight").forEach(element => element.classList.remove("tour-highlight"));
    const target = document.getElementById(paso.destino);
    target?.classList.add("tour-highlight");
    target?.scrollIntoView({
        behavior: document.body.classList.contains("reduce-motion") ? "auto" : "smooth",
        block: "center"
    });
    const title = document.getElementById("tour-step-title");
    const description = document.getElementById("tour-step-description");
    const counter = document.getElementById("tour-step-counter");
    const previous = document.getElementById("tour-previous");
    const next = document.getElementById("tour-next");
    if (title) title.textContent = paso.titulo;
    if (description) description.textContent = paso.texto;
    if (counter) counter.textContent = `${pasoRecorridoActual + 1} de ${PASOS_RECORRIDO.length}`;
    if (previous) previous.disabled = pasoRecorridoActual === 0;
    if (next) next.textContent = pasoRecorridoActual === PASOS_RECORRIDO.length - 1 ? "Finalizar" : "Siguiente →";
}

function avanzarRecorridoGuiado(direccion) {
    const siguiente = pasoRecorridoActual + direccion;
    if (siguiente < 0) return;
    if (siguiente >= PASOS_RECORRIDO.length) { cerrarRecorridoGuiado(); return; }
    pasoRecorridoActual = siguiente;
    mostrarPasoRecorrido();
}

function cerrarRecorridoGuiado() {
    const overlay = document.getElementById("tour-overlay");
    overlay?.classList.add("hidden");
    overlay?.setAttribute("aria-hidden", "true");
    document.querySelectorAll(".tour-highlight").forEach(element => element.classList.remove("tour-highlight"));
}

// Inicialización de la aplicación al cargar el DOM
document.addEventListener("DOMContentLoaded", () => {
    document.body.classList.add("login-only");
    inicializarBarraLateral();
    initTextSizeControls();
    initAccountMenu();
    initSiteInformation();
    initDashboardSettings();
    document.getElementById("simulator-dimming")?.addEventListener("input", actualizarSimuladorUrbano);
    document.getElementById("simulator-hours")?.addEventListener("input", actualizarSimuladorUrbano);
    actualizarSimuladorUrbano();
    const reportPeriod = document.getElementById("sensor-report-period");
    const customRange = document.getElementById("sensor-report-custom-range");
    reportPeriod?.addEventListener("change", () => {
        customRange?.classList.toggle("hidden", reportPeriod.value !== "custom");
        if (reportPeriod.value === "custom") inicializarPeriodoPersonalizado();
    });
    comprobarSesion();
});

const SETTINGS_KEYS = {
    refresh: "smartcity_refresh_seconds",
    reportPeriod: "smartcity_report_period",
    reducedMotion: "smartcity_reduce_motion"
};
let dashboardRefreshTimer = null;
let jsPDFLoadPromise = null;

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

function leerEstadosAlertasUsuario() {
    try {
        const parsed = JSON.parse(localStorage.getItem(claveNotificacionesUsuario("estados_alertas")) || "{}");
        return parsed && typeof parsed === "object" && !Array.isArray(parsed) ? parsed : {};
    } catch (error) {
        return {};
    }
}

function obtenerEstadoAlertaSensor(clave) {
    const estado = leerEstadosAlertasUsuario()[clave];
    return ["pendiente", "revision", "resuelta"].includes(estado) ? estado : "pendiente";
}

function guardarEstadoAlertaSensor(clave, estado) {
    if (!["pendiente", "revision", "resuelta"].includes(estado)) return;
    const estados = leerEstadosAlertasUsuario();
    estados[clave] = estado;
    try {
        localStorage.setItem(claveNotificacionesUsuario("estados_alertas"), JSON.stringify(estados));
    } catch (error) {
        console.warn("No se pudo guardar el estado de la alerta.", error);
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
        action.textContent = "Abrir sensor →";
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
    if (seleccionada.sensorId) {
        navegarA("tiempo");
        const sensor = typeof sensoresEnMapa !== "undefined"
            ? sensoresEnMapa.find(item => item.id === seleccionada.sensorId)
            : null;
        if (sensor && typeof mostrarDetalleSensor === "function") mostrarDetalleSensor(sensor);
    }
}

function registrarNotificacionesSensores(sensores, esDemo = false) {
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
        valoresFueraDeRango(lectura).forEach(valor => {
            const metrica = valor.split(/\s+/)[0];
            const key = `${id}::${metrica}`;
            actuales[key] = { sensorId: id, valor };
            if (!anteriores[key]) {
                guardarEstadoAlertaSensor(key, "pendiente");
                eventos.push({ titulo: "Lectura fuera de rango", mensaje: `${id}: ${valor}`, sensorId: id, demo: esDemo });
            }
        });
    });

    Object.entries(anteriores).forEach(([key, alerta]) => {
        if (actuales[key]) return;
        const sensorId = alerta?.sensorId || key.split("::")[0];
        const metrica = key.split("::")[1] || "Lectura";
        eventos.push({
            titulo: "Lectura normalizada",
            mensaje: `${sensorId}: ${metrica} volvió al rango informativo.`,
            sensorId,
            demo: esDemo
        });
    });

    try {
        localStorage.setItem(estadoKey, JSON.stringify(actuales));
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

function initAccountMenu() {
    document.addEventListener("click", event => {
        const wrapper = document.getElementById("account-menu-wrap");
        if (wrapper && !wrapper.contains(event.target)) cerrarAccountMenu();
        const notifications = document.getElementById("notification-menu-wrap");
        if (notifications && !notifications.contains(event.target)) cerrarMenuNotificaciones();
    });
    document.addEventListener("keydown", event => {
        if (event.key === "Escape") {
            cerrarAccountMenu();
            cerrarMenuNotificaciones();
            cerrarModal("site-info-modal");
            cerrarModal("contact-modal");
            cerrarModal("modal-editar-perfil");
            cerrarModal("modal-cambiar-password");
        }
    });
}

function toggleAccountMenu() {
    const menu = document.getElementById("account-menu");
    const trigger = document.getElementById("usuario-badge");
    const opening = menu?.classList.contains("hidden");
    if (opening) cerrarMenuNotificaciones();
    menu?.classList.toggle("hidden", !opening);
    trigger?.setAttribute("aria-expanded", String(Boolean(opening)));
    if (opening) cargarResumenCuenta();
}

function cerrarAccountMenu() {
    document.getElementById("account-menu")?.classList.add("hidden");
    document.getElementById("usuario-badge")?.setAttribute("aria-expanded", "false");
}

async function cargarResumenCuenta() {
    const nombre = document.getElementById("account-menu-name");
    const email = document.getElementById("account-menu-email");
    const rol = document.getElementById("account-menu-role");
    try {
        const { ok, data } = await apiFetch("/api/perfil");
        if (!ok) return;
        if (nombre) nombre.textContent = data.nombre || "Usuario";
        if (email) email.textContent = data.email || "";
        if (rol) rol.textContent = data.rol || "Cuenta activa";
    } catch (error) {
        if (email) email.textContent = "No se pudieron cargar los datos de cuenta.";
    }
}

function cargarConfiguracionEnControles() {
    const refresh = document.getElementById("config-refresh-interval");
    const period = document.getElementById("config-default-period");
    const reduceMotion = document.getElementById("config-reduce-motion");
    const reportSelector = document.getElementById("sensor-report-period");
    try {
        const savedRefresh = localStorage.getItem(SETTINGS_KEYS.refresh) || "0";
        const savedPeriod = localStorage.getItem(SETTINGS_KEYS.reportPeriod) || "24";
        const savedReduceMotion = localStorage.getItem(SETTINGS_KEYS.reducedMotion) === "true";
        if (refresh) refresh.value = savedRefresh;
        if (period) period.value = savedPeriod;
        if (reportSelector && reportSelector.querySelector(`option[value="${savedPeriod}"]`)) reportSelector.value = savedPeriod;
        if (reduceMotion) reduceMotion.checked = savedReduceMotion;
        document.body.classList.toggle("reduce-motion", savedReduceMotion);
        configureDashboardRefresh(Number(savedRefresh));
    } catch (error) {
        console.warn("No se pudieron recuperar las preferencias.", error);
    }
}

function configureDashboardRefresh(seconds) {
    if (dashboardRefreshTimer) clearInterval(dashboardRefreshTimer);
    dashboardRefreshTimer = null;
    if (!seconds) return;
    dashboardRefreshTimer = setInterval(() => {
        const dashboard = document.getElementById("vista-dashboard");
        if (!dashboard?.classList.contains("hidden")) {
            if (typeof cargarMapaSensores === "function") cargarMapaSensores();
        }
    }, seconds * 1000);
}

function initDashboardSettings() {
    document.getElementById("footer-year").textContent = String(new Date().getFullYear());
    document.getElementById("config-theme")?.addEventListener("change", event => applyTheme(event.target.value));
    document.querySelectorAll("[data-accent-option]").forEach(button => {
        button.addEventListener("click", () => applyAccent(button.dataset.accentOption));
    });
    document.getElementById("config-text-size")?.addEventListener("change", event => applyTextSize(Number(event.target.value)));
    document.getElementById("config-reduce-motion")?.addEventListener("change", event => {
        document.body.classList.toggle("reduce-motion", event.target.checked);
        localStorage.setItem(SETTINGS_KEYS.reducedMotion, String(event.target.checked));
        mostrarEstadoConfiguracion("Preferencia de animación guardada.");
    });
    document.getElementById("config-refresh-interval")?.addEventListener("change", event => {
        localStorage.setItem(SETTINGS_KEYS.refresh, event.target.value);
        configureDashboardRefresh(Number(event.target.value));
        mostrarEstadoConfiguracion("Frecuencia de actualización guardada.");
    });
    document.getElementById("config-default-period")?.addEventListener("change", event => {
        localStorage.setItem(SETTINGS_KEYS.reportPeriod, event.target.value);
        const selector = document.getElementById("sensor-report-period");
        if (selector) selector.value = event.target.value;
        document.getElementById("sensor-report-custom-range")?.classList.add("hidden");
        mostrarEstadoConfiguracion("Periodo inicial del reporte guardado.");
    });
    document.getElementById("config-reset")?.addEventListener("click", restablecerConfiguracion);
    cargarConfiguracionEnControles();
}

function mostrarEstadoConfiguracion(mensaje) {
    const estado = document.getElementById("config-status");
    if (!estado) return;
    estado.textContent = mensaje;
    setTimeout(() => { if (estado.textContent === mensaje) estado.textContent = ""; }, 2500);
}

function restablecerConfiguracion() {
    Object.values(SETTINGS_KEYS).forEach(key => localStorage.removeItem(key));
    localStorage.removeItem(TEXT_SIZE_STORAGE_KEY);
    localStorage.removeItem(THEME_STORAGE_KEY);
    localStorage.removeItem(ACCENT_STORAGE_KEY);
    applyTheme("dark");
    applyAccent("blue", false);
    applyTextSize(1);
    cargarConfiguracionEnControles();
    mostrarEstadoConfiguracion("Preferencias restablecidas.");
}

function initSiteInformation() {
    document.getElementById("site-info-modal")?.addEventListener("click", event => {
        if (event.target.id === "site-info-modal") cerrarModal("site-info-modal");
    });
    document.getElementById("contact-modal")?.addEventListener("click", event => {
        if (event.target.id === "contact-modal") cerrarModal("contact-modal");
    });
}

function abrirInfoSitio(tipo) {
    const title = document.getElementById("site-info-title");
    const content = document.getElementById("site-info-content");
    const textos = tipo === "acerca"
        ? ["SmartCity Cloud es una plataforma demostrativa de monitoreo urbano e IoT.", "El panel presenta lecturas de sensores y una escena 3D con luminarias simuladas para explorar cómo podría visualizarse una ciudad conectada.", "El modelo no representa dispositivos instalados ni mediciones tomadas directamente en una calle."]
        : ["La plataforma utiliza los datos de cuenta necesarios para iniciar sesión y mostrar el perfil de cada usuario.", "Las lecturas de sensores se utilizan para mostrar métricas y generar reportes dentro de SmartCity Cloud.", "Evita incluir contraseñas u otra información sensible en los mensajes de contacto o en los reportes descargados."];
    title.textContent = tipo === "acerca" ? "Acerca del proyecto" : "Privacidad";
    content.replaceChildren(...textos.map(texto => {
        const parrafo = document.createElement("p");
        parrafo.textContent = texto;
        return parrafo;
    }));
    const modal = document.getElementById("site-info-modal");
    modal.classList.remove("hidden");
    modal.classList.add("flex");
    modal.querySelector("button")?.focus();
}

function abrirModalContacto() {
    const modal = document.getElementById("contact-modal");
    modal.classList.remove("hidden");
    modal.classList.add("flex");
    document.getElementById("contact-name")?.focus();
}

function enviarConsultaContacto(event) {
    event.preventDefault();
    const nombre = document.getElementById("contact-name").value.trim();
    const correo = document.getElementById("contact-email").value.trim();
    const motivo = document.getElementById("contact-reason").value;
    const mensaje = document.getElementById("contact-message").value.trim();
    const subject = `[SmartCity Cloud] ${motivo}`;
    const body = `Nombre: ${nombre}\nCorreo: ${correo}\nMotivo: ${motivo}\n\n${mensaje}`;
    const mailto = `mailto:richard.ruizvuni@gmail.com?subject=${encodeURIComponent(subject)}&body=${encodeURIComponent(body)}`;
    document.getElementById("contact-status").textContent = "Se abrirá tu aplicación de correo; revisa el borrador y pulsa Enviar para remitirlo.";
    window.location.href = mailto;
}
// ============================================================
// 📥 EXPORTACIÓN DE DATOS (CSV Y PDF)
// ============================================================

async function exportarSensoresCSV() {
    try {
        let sensores = typeof obtenerSensoresActivos === "function" ? obtenerSensoresActivos() : [];
        const demo = typeof obtenerModoDemoSensores === "function" && obtenerModoDemoSensores();
        if (!sensores.length) {
            if (demo && typeof obtenerLecturasDemoActuales === "function") {
                sensores = obtenerLecturasDemoActuales();
            } else {
                const respuesta = await apiFetch("/sensores/ultimas");
                if (respuesta.ok && Array.isArray(respuesta.data)) sensores = respuesta.data.map(lectura => ({ id: lectura.sensor_id, lectura }));
            }
        }
        if (!sensores.length) {
            mostrarNotificacion("No hay datos disponibles para exportar", "error");
            return;
        }
        const escapar = valor => `"${String(valor ?? "").replaceAll('"', '""')}"`;
        const filas = [["Sensor", "Temperatura (°C)", "Humedad (%)", "Calidad del aire (ICA)", "Fecha", "Fuente"]];
        sensores.forEach(({ id, lectura }) => filas.push([
            id ?? lectura.sensor_id ?? lectura.id,
            lectura.temperatura,
            lectura.humedad,
            lectura.calidad_aire,
            lectura.fecha_hora,
            demo ? "SIMULADO - DEMO" : "API"
        ]));
        const csv = `\uFEFF${filas.map(fila => fila.map(escapar).join(",")).join("\r\n")}`;
        const blob = new Blob([csv], { type: "text/csv;charset=utf-8;" });
        const url = URL.createObjectURL(blob);
        const link = document.createElement("a");
        link.setAttribute("href", url);
        link.setAttribute("download", `SmartCity_${demo ? "DEMO_SIMULADA_" : ""}Telemetria_${new Date().toISOString().slice(0, 10)}.csv`);
        document.body.appendChild(link);
        link.click();
        document.body.removeChild(link);
        setTimeout(() => URL.revokeObjectURL(url), 1000);

        mostrarNotificacion(demo ? "CSV demostrativo descargado; sus datos están marcados como simulados." : "CSV generado exitosamente.", "exito");
    } catch (err) {
        mostrarNotificacion("Error al exportar CSV", "error");
    }
}

function fechaParaInputLocal(fecha) {
    const ajustada = new Date(fecha.getTime() - fecha.getTimezoneOffset() * 60000);
    return ajustada.toISOString().slice(0, 16);
}

function inicializarPeriodoPersonalizado() {
    const ahora = new Date();
    const inicio = new Date(ahora.getTime() - 24 * 60 * 60 * 1000);
    const campoInicio = document.getElementById("sensor-report-start");
    const campoFin = document.getElementById("sensor-report-end");
    if (campoInicio && !campoInicio.value) campoInicio.value = fechaParaInputLocal(inicio);
    if (campoFin && !campoFin.value) campoFin.value = fechaParaInputLocal(ahora);
}

function cargarJsPDF() {
    if (window.jspdf?.jsPDF) return Promise.resolve(window.jspdf.jsPDF);
    if (jsPDFLoadPromise) return jsPDFLoadPromise;

    jsPDFLoadPromise = new Promise((resolve, reject) => {
        const script = document.createElement("script");
        script.src = "assets/vendor/jspdf.umd.min.js";
        script.async = true;
        script.onload = () => window.jspdf?.jsPDF
            ? resolve(window.jspdf.jsPDF)
            : reject(new Error("La biblioteca PDF no se pudo inicializar."));
        script.onerror = () => reject(new Error("No se pudo cargar la biblioteca para generar el PDF."));
        document.head.appendChild(script);
    });
    return jsPDFLoadPromise;
}

function generarPdfLecturas(jsPDF, { data, desde, hasta, generado, demo, limitation }) {
    const pdf = new jsPDF({ orientation: "landscape", unit: "mm", format: "a4", compress: true });
    const pageWidth = pdf.internal.pageSize.getWidth();
    const pageHeight = pdf.internal.pageSize.getHeight();
    const margin = 12;
    const widths = [68, 52, 47, 47, 50];
    const headings = ["Fecha y hora", "Sensor", "Temperatura °C", "Humedad %", "Calidad del aire"];
    const number = new Intl.NumberFormat("es-EC", { maximumFractionDigits: 2 });
    const average = field => data.reduce((sum, reading) => sum + Number(reading[field] || 0), 0) / data.length;
    const dateFormat = date => date.toLocaleString("es-EC", { dateStyle: "medium", timeStyle: "short" });
    let y = 0;

    const drawHeader = page => {
        pdf.setFillColor(15, 23, 42);
        pdf.rect(0, 0, pageWidth, 37, "F");
        pdf.setTextColor(248, 250, 252);
        pdf.setFont("helvetica", "bold");
        pdf.setFontSize(18);
        pdf.text("SmartCity Cloud · Reporte de sensores", margin, 15);
        pdf.setFont("helvetica", "normal");
        pdf.setFontSize(9);
        pdf.setTextColor(203, 213, 225);
        pdf.text(`Periodo: ${dateFormat(desde)} — ${dateFormat(hasta)}`, margin, 23);
        pdf.text(`Generado: ${dateFormat(generado)} · ${data.length} lecturas`, margin, 29);
        if (demo) {
            pdf.setTextColor(253, 230, 138);
            pdf.setFont("helvetica", "bold");
            pdf.text("DATOS SIMULADOS PARA DEMOSTRACIÓN · No son mediciones reales de un ESP32", margin, 35);
        }

        y = demo ? 48 : 43;
        pdf.setTextColor(71, 85, 105);
        pdf.setFont("helvetica", "normal");
        pdf.setFontSize(9);
        pdf.text(`Promedios: ${number.format(average("temperatura"))} °C · ${number.format(average("humedad"))} % humedad · ${number.format(average("calidad_aire"))} ICA`, margin, y);
        y += 9;
        pdf.setFillColor(37, 99, 235);
        pdf.roundedRect(margin, y, pageWidth - margin * 2, 9, 1.5, 1.5, "F");
        pdf.setTextColor(255, 255, 255);
        pdf.setFont("helvetica", "bold");
        pdf.setFontSize(8);
        let x = margin + 3;
        headings.forEach((heading, index) => {
            pdf.text(heading, x, y + 5.8);
            x += widths[index];
        });
        y += 9;
        if (limitation) {
            pdf.setTextColor(146, 64, 14);
            pdf.setFont("helvetica", "normal");
            pdf.setFontSize(7.5);
            const lines = pdf.splitTextToSize(limitation, pageWidth - margin * 2);
            pdf.text(lines, margin, y + 3);
            y += lines.length * 3.5 + 4;
        }
        pdf.setFont("helvetica", "normal");
        pdf.setFontSize(8);
    };

    drawHeader();
    data.forEach((reading, index) => {
        const values = [
            dateFormat(new Date(reading.fecha_hora)),
            String(reading.sensor_id ?? "—"),
            number.format(Number(reading.temperatura)),
            number.format(Number(reading.humedad)),
            number.format(Number(reading.calidad_aire))
        ];
        if (y + 8 > pageHeight - 13) {
            pdf.addPage();
            drawHeader();
        }
        if (index % 2 === 0) {
            pdf.setFillColor(241, 245, 249);
            pdf.rect(margin, y, pageWidth - margin * 2, 8, "F");
        }
        pdf.setTextColor(30, 41, 59);
        let x = margin + 3;
        values.forEach((value, column) => {
            pdf.text(pdf.splitTextToSize(value, widths[column] - 6)[0], x, y + 5.2);
            x += widths[column];
        });
        y += 8;
    });

    const pages = pdf.internal.getNumberOfPages();
    for (let page = 1; page <= pages; page += 1) {
        pdf.setPage(page);
        pdf.setDrawColor(226, 232, 240);
        pdf.line(margin, pageHeight - 9, pageWidth - margin, pageHeight - 9);
        pdf.setTextColor(100, 116, 139);
        pdf.setFontSize(8);
        pdf.text(`SmartCity Cloud · Página ${page} de ${pages}`, pageWidth - margin, pageHeight - 4, { align: "right" });
    }

    const suffix = generado.toISOString().slice(0, 10);
    pdf.save(`SmartCity_${demo ? "DEMO_SIMULADA_" : ""}Reporte_${suffix}.pdf`);
}

async function exportarSensoresPDF() {
    const selector = document.getElementById("sensor-report-period");
    const estado = document.getElementById("sensor-report-status");
    const boton = document.getElementById("sensor-report-pdf");
    const botonHtmlOriginal = boton?.innerHTML;
    const desdeInput = document.getElementById("sensor-report-start");
    const hastaInput = document.getElementById("sensor-report-end");
    const ahora = new Date();
    let desde;
    let hasta = ahora;

    if (selector?.value === "custom") {
        desde = new Date(desdeInput?.value || "");
        hasta = new Date(hastaInput?.value || "");
        if (!desdeInput?.value || !hastaInput?.value || Number.isNaN(desde.getTime()) || Number.isNaN(hasta.getTime()) || desde >= hasta) {
            if (estado) estado.textContent = "Elige un intervalo válido: la fecha inicial debe ser anterior a la final.";
            mostrarNotificacion("Revisa las fechas del periodo personalizado.", "error");
            return;
        }
    } else {
        const horas = Number(selector?.value || 24);
        desde = new Date(ahora.getTime() - horas * 60 * 60 * 1000);
    }

    if (boton) {
        boton.disabled = true;
        boton.setAttribute("aria-busy", "true");
        boton.textContent = "Preparando PDF…";
    }
    if (estado) estado.textContent = "Consultando las lecturas del periodo…";
    try {
        const demoActivo = typeof obtenerModoDemoSensores === "function" && obtenerModoDemoSensores();
        const query = new URLSearchParams({ desde: desde.toISOString(), hasta: hasta.toISOString() });
        let respuestaHistorial = {};
        try {
            respuestaHistorial = await apiFetch(`/sensores/historial?${query.toString()}`);
        } catch (error) {
            if (!demoActivo) throw error;
        }
        let { ok, data, status } = respuestaHistorial;
        let limitation = "";
        if (!demoActivo && !ok && status === 404) {
            // Compatibilidad temporal con el backend publicado antes de añadir /historial.
            const respaldo = await apiFetch("/sensores/ultimas");
            if (respaldo.ok && Array.isArray(respaldo.data)) {
                data = respaldo.data.filter(lectura => {
                    const fecha = new Date(lectura.fecha_hora);
                    return !Number.isNaN(fecha.getTime()) && fecha >= desde && fecha <= hasta;
                });
                ok = true;
                limitation = "Aviso: el servidor aún no tiene activa la consulta histórica. Este PDF usa únicamente las últimas 10 lecturas disponibles; actualiza el backend para incluir todo el intervalo.";
            }
        }
        let demo = false;
        if (demoActivo && (!ok || !Array.isArray(data) || data.length === 0)) {
            data = obtenerHistorialDemostrativo(desde, hasta);
            ok = true;
            demo = true;
            limitation = "DATOS SIMULADOS PARA DEMOSTRACIÓN. No provienen de sensores ESP32 ni representan mediciones reales.";
        }
        if (!ok) {
            const mensaje = data?.detail || "No se pudo obtener el historial de sensores.";
            if (estado) estado.textContent = mensaje;
            mostrarNotificacion(mensaje, "error");
            return;
        }
        if (!Array.isArray(data) || data.length === 0) {
            if (estado) estado.textContent = "No hay lecturas registradas en el intervalo seleccionado.";
            mostrarNotificacion("No hay lecturas en ese periodo.", "info");
            return;
        }

        data.sort((a, b) => new Date(a.fecha_hora) - new Date(b.fecha_hora));
        const jsPDF = await cargarJsPDF();
        generarPdfLecturas(jsPDF, { data, desde, hasta, generado: ahora, demo, limitation });
        if (estado) estado.textContent = demo
            ? "PDF demostrativo descargado. El archivo identifica claramente las lecturas simuladas."
            : limitation
            ? "PDF descargado con las últimas 10 lecturas disponibles; el servidor aún no ofrece el historial completo."
            : "PDF descargado correctamente.";
        mostrarNotificacion(demo ? "PDF demostrativo descargado; sus datos están marcados como simulados." : "Reporte PDF descargado correctamente.", "exito");
    } catch (error) {
        console.error("Error al preparar el reporte PDF:", error);
        if (estado) estado.textContent = "No se pudo conectar con el servicio de lecturas.";
        mostrarNotificacion("No se pudo cargar el historial para el PDF.", "error");
    } finally {
        if (boton) {
            boton.disabled = false;
            boton.removeAttribute("aria-busy");
            boton.innerHTML = botonHtmlOriginal;
        }
    }
}
