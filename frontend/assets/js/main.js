// ============================================================
// 🔔 SISTEMA DE NOTIFICACIONES TOAST
// ============================================================
function mostrarNotificacion(mensaje, tipo = "info") {
    if (tipo === "exito") reproducirFeedbackSonoro("confirmacion");
    if (typeof window.smartCityToast === "function") {
        window.smartCityToast(String(mensaje ?? ""), tipo);
        return;
    }
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
let sidebarTooltipNode = null;
let sidebarTooltipTarget = null;
let pasosRecorridoActual = [];
let vistaAntesDelRecorrido = "dashboard";

const INICIO_POR_ROL = {
    1: {
        eyebrow: "VISTA DE ADMINISTRACIÓN",
        titulo: "Tu ciudad, bajo control",
        descripcion: "Revisa alertas, gestiona cuentas y consulta el estado de los dispositivos desde un solo lugar.",
        primary: ["Gestionar cuentas", "admin-usuarios"], secondary: ["Atender alertas", "alertas"],
        bienvenida: "Administra las cuentas y revisa primero las alertas que requieren atención."
    },
    2: {
        eyebrow: "TU ESPACIO DE MONITOREO",
        titulo: "Entérate de lo que pasa",
        descripcion: "Consulta las lecturas de la maqueta, revisa el clima y avisa al equipo si observas un problema.",
        primary: ["Reportar observación", "alertas"], secondary: ["Explorar maqueta", "maqueta"],
        bienvenida: "Consulta las mediciones y envía un reporte cuando notes algo que el equipo deba revisar."
    },
    3: {
        eyebrow: "CENTRO DE OPERACIONES",
        titulo: "Alertas listas para atender",
        descripcion: "Da seguimiento a los avisos, deja una nota en cada cambio y comprueba las lecturas de los sensores.",
        primary: ["Atender alertas", "alertas"], secondary: ["Explorar maqueta", "maqueta"],
        bienvenida: "Empieza por las alertas pendientes; cada actualización queda registrada para el equipo."
    }
};

function configurarInicioPorRol(nombre, idRol) {
    const rol = Number(idRol);
    const experiencia = INICIO_POR_ROL[rol] || INICIO_POR_ROL[2];
    const nombreCorto = String(nombre || "").trim().split(/\s+/)[0];
    const eyebrow = document.getElementById("dashboard-eyebrow");
    const title = document.getElementById("dashboard-title");
    const description = document.getElementById("dashboard-source-summary");
    if (eyebrow) eyebrow.textContent = `${experiencia.eyebrow}${nombreCorto ? ` · HOLA, ${nombreCorto.toLocaleUpperCase("es-EC")}` : ""}`;
    if (title) title.textContent = experiencia.titulo;
    if (description) description.textContent = experiencia.descripcion;
    [["role-home-primary", experiencia.primary], ["role-home-secondary", experiencia.secondary]].forEach(([id, [label, view]]) => {
        const button = document.getElementById(id);
        if (!button) return;
        button.textContent = label;
        button.onclick = () => navegarA(view);
    });

    const welcome = document.getElementById("dashboard-welcome");
    const welcomeText = document.getElementById("dashboard-welcome-text");
    const storageKey = claveBienvenidaUsuario();
    let yaVioBienvenida = false;
    try { yaVioBienvenida = localStorage.getItem(storageKey) === "true"; }
    catch (error) { console.warn("No se pudo consultar el estado de bienvenida.", error); }
    if (welcomeText) welcomeText.textContent = experiencia.bienvenida;
    welcome?.classList.toggle("hidden", yaVioBienvenida);
}

function claveBienvenidaUsuario() {
    return `smartcity_welcome_seen_v1_${localStorage.getItem("user_id_cloud") || "usuario"}`;
}

function descartarBienvenida() {
    try { localStorage.setItem(claveBienvenidaUsuario(), "true"); }
    catch (error) { console.warn("No se pudo guardar la preferencia de bienvenida.", error); }
    document.getElementById("dashboard-welcome")?.classList.add("hidden");
}

function inicializarBienvenidaDashboard() {
    document.getElementById("dashboard-welcome-dismiss")?.addEventListener("click", descartarBienvenida);
    document.getElementById("dashboard-welcome-tour")?.addEventListener("click", () => {
        descartarBienvenida();
        iniciarRecorridoGuiado();
    });
}

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
    sincronizarAccionTemaPerfil();

    if (persist) {
        try {
            localStorage.setItem(THEME_STORAGE_KEY, normalizedTheme);
        } catch (error) {
            console.warn("No se pudo guardar la preferencia de tema.", error);
        }
    }
}

function alternarTemaDesdePerfil() {
    const currentTheme = document.documentElement.dataset.theme === "light" ? "light" : "dark";
    applyTheme(currentTheme === "dark" ? "light" : "dark");
}

function sincronizarAccionTemaPerfil() {
    const button = document.getElementById("account-theme-toggle");
    const icon = document.getElementById("account-theme-icon");
    if (!button || !icon) return;
    const dark = document.documentElement.dataset.theme !== "light";
    button.setAttribute("aria-label", dark ? "Cambiar a modo claro" : "Cambiar a modo nocturno");
    button.title = dark ? "Cambiar a modo claro" : "Cambiar a modo nocturno";
    icon.innerHTML = dark
        ? '<path d="M20.9 13A8.5 8.5 0 0 1 11 3.1 8.5 8.5 0 1 0 20.9 13Z"></path>'
        : '<circle cx="12" cy="12" r="4"></circle><path d="M12 2v2m0 16v2M4.93 4.93l1.42 1.42m11.3 11.3 1.42 1.42M2 12h2m16 0h2M4.93 19.07l1.42-1.42m11.3-11.3 1.42-1.42"></path>';
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

function animarEntradaAuth() {
    const authView = document.getElementById("vista-auth");
    if (!authView || document.body.classList.contains("reduce-motion")) return;
    authView.classList.remove("auth-entry");
    requestAnimationFrame(() => authView.classList.add("auth-entry"));
}

function animarEntradaDashboard() {
    if (document.body.classList.contains("reduce-motion")) return;
    requestAnimationFrame(() => {
        const panels = Array.from(document.querySelectorAll("#vista-dashboard [data-dashboard-panel]:not(.hidden)"))
            .filter(panel => panel.getClientRects().length > 0);
        panels.forEach((panel, index) => {
            panel.classList.remove("dashboard-panel-enter");
            panel.style.setProperty("--panel-entry-order", index);
            void panel.offsetWidth;
            panel.classList.add("dashboard-panel-enter");
            window.setTimeout(() => {
                panel.classList.remove("dashboard-panel-enter");
                panel.style.removeProperty("--panel-entry-order");
            }, 900);
        });
    });
}

function inicializarAnimacionLecturas() {
    if (typeof MutationObserver !== "function") return;
    const lecturaIds = [
        "metric-temp", "metric-hum", "metric-aire", "metric-distance", "metric-rain",
        "metric-light", "metric-water-level", "metric-tcrt5000", "wx-temperature",
        "wx-rain", "wx-wind", "wx-humidity", "wx-apparent-temperature", "wx-rain-probability"
    ];
    lecturaIds.forEach(id => {
        const element = document.getElementById(id);
        if (!element) return;
        const observer = new MutationObserver(() => {
            if (document.body.classList.contains("reduce-motion")) return;
            element.classList.remove("reading-update-pulse");
            void element.offsetWidth;
            element.classList.add("reading-update-pulse");
            window.setTimeout(() => element.classList.remove("reading-update-pulse"), 650);
        });
        observer.observe(element, { childList: true, characterData: true, subtree: true });
    });
}

function sincronizarVisorMaqueta(vista) {
    const frame = document.getElementById("companion-model-frame");
    if (!frame) return;
    if (vista === "maqueta") {
        if (frame.dataset.loaded !== "true") {
            frame.src = frame.dataset.src;
            frame.dataset.loaded = "true";
        }
        return;
    }
    if (frame.dataset.loaded === "true") {
        frame.src = "about:blank";
        frame.dataset.loaded = "false";
    }
}
function navegarA(vista) {
    document.body.classList.toggle("login-only", vista === "auth");
    cerrarMobileNav();
    cerrarMenuNotificaciones();
    const token = obtenerToken();

    // 🔒 Si no hay sesión activa y no está en 'auth', redirigir forzosamente al Login
    if (!token && vista !== "auth") {
        sincronizarVisorMaqueta("auth");
        navegarA("auth");
        return;
    }

    sincronizarVisorMaqueta(vista);
    document.body.classList.toggle("sidebar-fixed-layout", vista !== "auth");

    // Ocultar todas las secciones
    document.getElementById("vista-dashboard")?.classList.add("hidden");
    document.getElementById("vista-perfil")?.classList.add("hidden");
    document.getElementById("vista-configuracion")?.classList.add("hidden");
    document.getElementById("vista-operador-config")?.classList.add("hidden");
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
        document.getElementById("dashboard-header-context")?.classList.add("hidden");
        document.getElementById("btn-dashboard-fullscreen")?.classList.add("hidden");

        document.getElementById("vista-auth")?.classList.remove("hidden");
        animarEntradaAuth();
    } else if (["dashboard", "maqueta", "clima", "alertas", "sensores", "reportes", "graficas"].includes(vista)) {
        document.getElementById("app-sidebar")?.classList.remove("hidden");
        document.getElementById("vista-dashboard")?.classList.remove("hidden");
        const vistaDashboard = vista === "sensores" ? "dashboard" : vista;
        aplicarVistaDashboard(vistaDashboard);
        animarEntradaDashboard();
        if (!dashboardSensorDataRequested) {
            dashboardSensorDataRequested = true;
            cargarMapaSensores();
        }
        if (vistaDashboard === "alertas" && typeof cargarAlertasCompartidas === "function") {
            void cargarAlertasCompartidas();
        }
        if (vistaDashboard === "dashboard" && typeof cargarTendenciaInicio === "function") void cargarTendenciaInicio();
        if (vistaDashboard === "graficas" && typeof cargarGraficasSensores === "function") void cargarGraficasSensores();
        const behavior = document.body.classList.contains("reduce-motion") ? "auto" : "smooth";
        requestAnimationFrame(() => window.scrollTo({ top: 0, behavior }));
    } else if (vista === "perfil") {
        document.getElementById("vista-perfil")?.classList.remove("hidden");
        cargarPerfilUsuario();
    } else if (vista === "configuracion") {
        document.getElementById("vista-configuracion")?.classList.remove("hidden");
        cargarConfiguracionEnControles();
    } else if (vista === "operador-config") {
        if (Number(localStorage.getItem("user_role_cloud")) !== 3) {
            alert("⛔ Esta configuración está disponible solo para el rol Operador.");
            navegarA("dashboard");
            return;
        }
        document.getElementById("vista-operador-config")?.classList.remove("hidden");
        void cargarConfiguracionOperadorEnControles();
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
    if (vista !== "auth") document.getElementById("main-content")?.focus({ preventScroll: true });
}

function aplicarVistaDashboard(vista) {
    const dashboard = document.getElementById("vista-dashboard");
    const vistasDisponibles = ["dashboard", "maqueta", "clima", "alertas", "reportes", "graficas"];
    const vistaActiva = vistasDisponibles.includes(vista) ? vista : "dashboard";
    dashboard?.setAttribute("data-current-view", vistaActiva);
    document.querySelectorAll("[data-dashboard-panel]").forEach(panel => {
        const vistas = panel.dataset.dashboardPanel.split(/\s+/);
        panel.classList.toggle("hidden", !vistas.includes(vistaActiva));
    });
}

function mostrarDashboard(nombre, idRol) {
    // 🔓 Mostrar navegación y acciones superiores únicamente con sesión válida
    document.body.classList.add("sidebar-fixed-layout");
    document.getElementById("app-sidebar")?.classList.remove("hidden");
    document.getElementById("btn-mobile-nav")?.classList.remove("hidden");
    document.getElementById("account-menu-wrap")?.classList.remove("hidden");
    document.getElementById("notification-menu-wrap")?.classList.remove("hidden");
    document.getElementById("dashboard-header-context")?.classList.remove("hidden");
    document.getElementById("btn-dashboard-fullscreen")?.classList.remove("hidden");
    renderizarNotificaciones();
    configurarInicioPorRol(nombre, idRol);
    if (typeof configurarCentroAlertasPorRol === "function") configurarCentroAlertasPorRol(idRol);
    if (typeof cargarAlertasCompartidas === "function") void cargarAlertasCompartidas({ silencioso: true });

    const navNombre = document.getElementById("nav-usuario-nombre");
    if (navNombre) navNombre.innerText = nombre;
    const menuNombre = document.getElementById("account-menu-name");
    if (menuNombre) menuNombre.textContent = nombre;
    const roleLabel = document.getElementById("account-menu-role");
    if (roleLabel) {
        roleLabel.textContent = ({ 1: "👑 Administrador", 2: "👤 Usuario", 3: "🛠️ Operador" })[Number(idRol)] || "Cuenta activa";
    }
    const alertMenuButton = document.getElementById("btn-menu-alertas");
    const alertMenuLabel = document.getElementById("sidebar-alertas-label");
    const puedeAtender = [1, 3].includes(Number(idRol));
    if (alertMenuLabel) alertMenuLabel.textContent = puedeAtender ? "Atender alertas" : "Reportar alertas";
    alertMenuButton?.setAttribute("aria-label", puedeAtender ? "Atender alertas" : "Reportar alertas");

    const btnAdmin = document.getElementById("btn-menu-admin");
    if (btnAdmin) {
        if (Number(idRol) === 1) {
            btnAdmin.classList.remove("hidden");
        } else {
            btnAdmin.classList.add("hidden");
        }
    }

    const btnOperador = document.getElementById("btn-menu-operador");
    btnOperador?.classList.toggle("hidden", Number(idRol) !== 3);
    if (Number(idRol) !== 3 && document.getElementById("vista-operador-config")?.classList.contains("hidden") === false) {
        document.getElementById("vista-operador-config")?.classList.add("hidden");
    }

    navegarA("dashboard");
    configurarMonitoreoSistema();
    if (typeof prepararActivacionWakeBrunito === "function") prepararActivacionWakeBrunito();
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
    if (opening) requestAnimationFrame(() => sidebar?.querySelector(".sidebar-link:not(.hidden)")?.focus());
    else button?.focus({ preventScroll: true });
}

function cerrarMobileNav({ devolverFoco = false } = {}) {
    document.body.classList.remove("mobile-sidebar-open");
    document.getElementById("sidebar-backdrop")?.classList.add("hidden");
    document.getElementById("btn-mobile-nav")?.setAttribute("aria-expanded", "false");
    document.getElementById("btn-mobile-nav")?.setAttribute("aria-label", "Abrir navegación");
    if (devolverFoco) document.getElementById("btn-mobile-nav")?.focus({ preventScroll: true });
}

function ocultarTooltipBarraLateral() {
    if (sidebarTooltipTarget?.getAttribute("aria-describedby") === "sidebar-tooltip") {
        sidebarTooltipTarget.removeAttribute("aria-describedby");
    }
    sidebarTooltipTarget = null;
    if (sidebarTooltipNode) {
        sidebarTooltipNode.classList.remove("is-visible");
        sidebarTooltipNode.hidden = true;
        sidebarTooltipNode.setAttribute("aria-hidden", "true");
    }
}

function mostrarTooltipBarraLateral(target) {
    if (!target || !sidebarTooltipNode || !document.body.classList.contains("sidebar-collapsed") || window.innerWidth <= 767 || !target.getClientRects().length) {
        ocultarTooltipBarraLateral();
        return;
    }
    const label = target.getAttribute("aria-label") || target.textContent.trim();
    if (!label) return;
    if (sidebarTooltipTarget && sidebarTooltipTarget !== target) {
        sidebarTooltipTarget.removeAttribute("aria-describedby");
    }
    sidebarTooltipTarget = target;
    sidebarTooltipTarget.setAttribute("aria-describedby", "sidebar-tooltip");
    sidebarTooltipNode.textContent = label;
    sidebarTooltipNode.hidden = false;
    sidebarTooltipNode.setAttribute("aria-hidden", "false");
    sidebarTooltipNode.classList.add("is-visible");

    const targetRect = target.getBoundingClientRect();
    const tooltipRect = sidebarTooltipNode.getBoundingClientRect();
    const left = Math.min(targetRect.right + 12, window.innerWidth - tooltipRect.width - 12);
    const top = Math.max(8, Math.min(targetRect.top + (targetRect.height - tooltipRect.height) / 2, window.innerHeight - tooltipRect.height - 8));
    sidebarTooltipNode.style.left = `${Math.max(8, left)}px`;
    sidebarTooltipNode.style.top = `${top}px`;
}

function inicializarTooltipsBarraLateral() {
    const sidebar = document.getElementById("app-sidebar");
    if (!sidebar) return;
    sidebarTooltipNode = document.createElement("div");
    sidebarTooltipNode.id = "sidebar-tooltip";
    sidebarTooltipNode.className = "sidebar-tooltip";
    sidebarTooltipNode.setAttribute("role", "tooltip");
    sidebarTooltipNode.setAttribute("aria-hidden", "true");
    sidebarTooltipNode.hidden = true;
    document.body.appendChild(sidebarTooltipNode);

    const tooltipTargets = sidebar.querySelectorAll(".sidebar-link, #sidebar-toggle, .sidebar-tour-button");
    tooltipTargets.forEach(target => {
        target.addEventListener("pointerenter", event => {
            if (event.pointerType !== "touch") mostrarTooltipBarraLateral(target);
        });
        target.addEventListener("pointerleave", () => {
            if (sidebarTooltipTarget === target) ocultarTooltipBarraLateral();
        });
        target.addEventListener("focus", () => mostrarTooltipBarraLateral(target));
        target.addEventListener("blur", () => {
            if (!target.matches(":hover")) ocultarTooltipBarraLateral();
        });
    });

    window.addEventListener("resize", () => {
        if (sidebarTooltipTarget) mostrarTooltipBarraLateral(sidebarTooltipTarget);
    }, { passive: true });
    window.addEventListener("scroll", () => {
        if (sidebarTooltipTarget) mostrarTooltipBarraLateral(sidebarTooltipTarget);
    }, { passive: true, capture: true });
}

function toggleSidebar() {
    const collapsed = !document.body.classList.contains("sidebar-collapsed");
    document.body.classList.toggle("sidebar-collapsed", collapsed);
    const button = document.getElementById("sidebar-toggle");
    const label = collapsed ? "Expandir barra lateral" : "Contraer barra lateral";
    if (button) {
        button.setAttribute("aria-label", label);
        button.setAttribute("aria-expanded", String(!collapsed));
        button.textContent = collapsed ? "›" : "‹";
    }
    try {
        localStorage.setItem(SIDEBAR_STORAGE_KEY, String(collapsed));
    } catch (error) {
        console.warn("No se pudo guardar el estado de la barra lateral.", error);
    }
    if (collapsed) mostrarTooltipBarraLateral(button);
    else ocultarTooltipBarraLateral();
}

function actualizarNavegacionLateral(vista) {
    const vistas = ["dashboard", "maqueta", "clima", "alertas", "reportes", "graficas", "operador-config", "admin-usuarios"];
    const activa = vistas.includes(vista) ? vista : null;
    const nav = document.querySelector(".sidebar-nav");
    document.querySelectorAll("[data-sidebar-view]").forEach(button => {
        if (button.dataset.sidebarView === activa) {
            button.setAttribute("aria-current", "page");
        } else {
            button.removeAttribute("aria-current");
        }
    });
    actualizarIndicadorNavegacionLateral(nav);
}

function actualizarIndicadorNavegacionLateral(nav = document.querySelector(".sidebar-nav")) {
    if (!nav) return;
    const activa = nav.querySelector('.sidebar-link[aria-current="page"]');
    nav.classList.toggle("has-active-link", Boolean(activa));
    if (!activa) return;
    const navRect = nav.getBoundingClientRect();
    const activeRect = activa.getBoundingClientRect();
    nav.style.setProperty("--sidebar-active-top", `${activeRect.top - navRect.top + nav.scrollTop}px`);
}

function inicializarBarraLateral() {
    try {
        const collapsed = localStorage.getItem(SIDEBAR_STORAGE_KEY) === "true";
        document.body.classList.toggle("sidebar-collapsed", collapsed);
        const button = document.getElementById("sidebar-toggle");
        if (button && collapsed) {
            button.textContent = "›";
            button.setAttribute("aria-label", "Expandir barra lateral");
            button.setAttribute("aria-expanded", "false");
        }
    } catch (error) {
        console.warn("No se pudo recuperar el estado de la barra lateral.", error);
    }
    inicializarTooltipsBarraLateral();
    actualizarIndicadorNavegacionLateral();
    window.addEventListener("resize", () => actualizarIndicadorNavegacionLateral(), { passive: true });
    document.addEventListener("keydown", event => {
        if (event.key === "Escape") {
            cerrarMobileNav({ devolverFoco: document.body.classList.contains("mobile-sidebar-open") });
            cerrarRecorridoGuiado();
        }
    });
}

const PASOS_RECORRIDO_POR_ROL = {
    1: [
        { vista: "dashboard", destino: "dashboard-overview", titulo: "1. Resumen para administración", texto: "Este inicio reúne accesos a la gestión de cuentas y al centro de alertas. Las acciones disponibles dependen de tu rol." },
        { vista: "dashboard", destino: "urban-sensors-title", titulo: "2. Estado de los sensores", texto: "Consulta las lecturas del ESP32 y su última actualización. El sitio distingue las mediciones reales de los datos de demostración." },
        { vista: "alertas", destino: "alert-center-list", titulo: "3. Seguimiento de alertas", texto: "Revisa los avisos pendientes, registra una nota al cambiar el estado y consulta el historial de cada caso." },
        { vista: "graficas", destino: "charts-panel", titulo: "4. Tendencias", texto: "Filtra las lecturas por variable y periodo para analizar los cambios guardados." },
        { vista: "admin-usuarios", destino: "admin-summary-grid", titulo: "5. Gestión de cuentas", texto: "Consulta el resumen de cuentas y cambia el rol desde la ficha correspondiente. Cada rol tiene permisos distintos." }
    ],
    2: [
        { vista: "dashboard", destino: "dashboard-overview", titulo: "1. Tu inicio", texto: "Desde aquí puedes abrir tus mediciones y enviar un aviso al equipo cuando notes un problema." },
        { vista: "dashboard", destino: "urban-sensors-title", titulo: "2. Sensores", texto: "Revisa las lecturas disponibles y cuándo se recibió el último dato del ESP32." },
        { vista: "alertas", destino: "alert-report-form", titulo: "3. Enviar un reporte", texto: "Elige el tipo de incidencia y describe qué pasó, dónde y cuándo. No incluyas datos sensibles." },
        { vista: "alertas", destino: "alert-center-list", titulo: "4. Ver el seguimiento", texto: "Tus reportes aparecen aquí. Consulta su estado, las notas y las actualizaciones del equipo." },
        { vista: "graficas", destino: "charts-panel", titulo: "5. Revisar tendencias", texto: "Elige una variable y un periodo para ver las lecturas registradas." }
    ],
    3: [
        { vista: "dashboard", destino: "dashboard-overview", titulo: "1. Tu inicio de operación", texto: "El acceso principal te lleva a las alertas. También puedes consultar sensores y sus lecturas." },
        { vista: "alertas", destino: "alert-status-filter-wrap", titulo: "2. Priorizar avisos", texto: "Usa estos filtros para concentrarte en pendientes o revisar casos que ya están en proceso o resueltos." },
        { vista: "alertas", destino: "alert-center-list", titulo: "3. Registrar seguimiento", texto: "Al cambiar un estado, agrega una nota breve. El historial guarda quién realizó el cambio y cuándo." },
        { vista: "dashboard", destino: "urban-sensors-title", titulo: "4. Consultar sensores", texto: "Verifica la última lectura del ESP32 para entender mejor cada aviso." },
        { vista: "graficas", destino: "charts-panel", titulo: "5. Ver tendencias", texto: "Consulta el historial para observar cómo cambian las mediciones con el tiempo." }
    ]
};
let pasoRecorridoActual = 0;
let recorridoGuiadoAbierto = false;

function iniciarRecorridoGuiado() {
    if (!obtenerToken()) { navegarA("auth"); return; }
    vistaAntesDelRecorrido = document.querySelector('.sidebar-link[aria-current="page"]')?.dataset.sidebarView
        || document.getElementById("vista-dashboard")?.dataset.currentView || "dashboard";
    if (!["dashboard", "maqueta", "alertas", "reportes", "graficas", "admin-usuarios"].includes(vistaAntesDelRecorrido)) vistaAntesDelRecorrido = "dashboard";
    pasosRecorridoActual = PASOS_RECORRIDO_POR_ROL[Number(localStorage.getItem("user_role_cloud"))] || PASOS_RECORRIDO_POR_ROL[2];
    cerrarMobileNav();
    pasoRecorridoActual = 0;
    const overlay = document.getElementById("tour-overlay");
    recorridoGuiadoAbierto = true;
    overlay?.classList.remove("hidden");
    overlay?.setAttribute("aria-hidden", "false");
    mostrarPasoRecorrido();
    document.getElementById("tour-next")?.focus({ preventScroll: true });
}

function mostrarPasoRecorrido() {
    const paso = pasosRecorridoActual[pasoRecorridoActual];
    if (paso.vista === "admin-usuarios") navegarA("admin-usuarios");
    else {
        if (document.getElementById("vista-dashboard")?.classList.contains("hidden")
            || !document.getElementById("vista-admin-usuarios")?.classList.contains("hidden")) navegarA("dashboard");
        aplicarVistaDashboard(paso.vista);
    }
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
    if (counter) counter.textContent = `${pasoRecorridoActual + 1} de ${pasosRecorridoActual.length}`;
    if (previous) previous.disabled = pasoRecorridoActual === 0;
    if (next) next.textContent = pasoRecorridoActual === pasosRecorridoActual.length - 1 ? "Finalizar" : "Siguiente →";
    document.getElementById("tour-next")?.focus({ preventScroll: true });
}

function avanzarRecorridoGuiado(direccion) {
    const siguiente = pasoRecorridoActual + direccion;
    if (siguiente < 0) return;
    if (siguiente >= pasosRecorridoActual.length) { cerrarRecorridoGuiado(); return; }
    pasoRecorridoActual = siguiente;
    mostrarPasoRecorrido();
}

function cerrarRecorridoGuiado() {
    const overlay = document.getElementById("tour-overlay");
    if (!recorridoGuiadoAbierto || !overlay) return;
    recorridoGuiadoAbierto = false;
    overlay.classList.add("hidden");
    overlay.setAttribute("aria-hidden", "true");
    document.querySelectorAll(".tour-highlight").forEach(element => element.classList.remove("tour-highlight"));
    if (vistaAntesDelRecorrido === "admin-usuarios") navegarA("dashboard");
    else if (["dashboard", "maqueta", "alertas", "reportes", "graficas"].includes(vistaAntesDelRecorrido)) navegarA(vistaAntesDelRecorrido);
}

// Inicialización de la aplicación al cargar el DOM
document.addEventListener("DOMContentLoaded", () => {
    document.body.classList.add("login-only");
    inicializarAnimacionLecturas();
    if (!obtenerToken()) animarEntradaAuth();
    inicializarBarraLateral();
    initTextSizeControls();
    initAccountMenu();
    initSiteInformation();
    inicializarHistorialDescargas();
    initDashboardSettings();
    inicializarCursorOrbital();
    inicializarRelojDashboard();
    inicializarBienvenidaDashboard();
    if (typeof inicializarCentroAlertas === "function") inicializarCentroAlertas();
    const reportPeriod = document.getElementById("sensor-report-period");
    const customRange = document.getElementById("sensor-report-custom-range");
    const reportPeriodSummary = document.getElementById("report-period-summary");
    const updateReportPeriodSummary = () => {
        if (!reportPeriodSummary || !reportPeriod) return;
        const selected = reportPeriod.selectedOptions[0]?.textContent || "Periodo personalizado";
        reportPeriodSummary.textContent = selected;
    };
    updateReportPeriodSummary();
    reportPeriod?.addEventListener("change", () => {
        customRange?.classList.toggle("hidden", reportPeriod.value !== "custom");
        if (reportPeriod.value === "custom") inicializarPeriodoPersonalizado();
        updateReportPeriodSummary();
    });
    comprobarSesion();
});

const SETTINGS_KEYS = {
    refresh: "smartcity_refresh_seconds",
    reportPeriod: "smartcity_report_period",
    reducedMotion: "smartcity_reduce_motion",
    soundFeedback: "smartcity_sound_feedback",
    hapticFeedback: "smartcity_haptic_feedback"
};
let dashboardRefreshTimer = null;
let jsPDFLoadPromise = null;
let dashboardClockTimer = null;
let feedbackAudioContext = null;

function preferenciaActiva(key) {
    try { return localStorage.getItem(key) === "true"; }
    catch (error) { return false; }
}

function reproducirFeedbackSonoro(tipo = "toque") {
    if (!preferenciaActiva(SETTINGS_KEYS.soundFeedback)) return;
    const AudioContextClass = window.AudioContext || window.webkitAudioContext;
    if (!AudioContextClass) return;

    try {
        feedbackAudioContext ||= new AudioContextClass();
        const contexto = feedbackAudioContext;
        const emitir = () => {
            const tonos = tipo === "confirmacion" ? [{ frecuencia: 660, demora: 0 }, { frecuencia: 880, demora: .085 }] : [{ frecuencia: 740, demora: 0 }];
            tonos.forEach(({ frecuencia, demora }) => {
                const inicio = contexto.currentTime + demora;
                const duracion = tipo === "confirmacion" ? .075 : .045;
                const oscilador = contexto.createOscillator();
                const volumen = contexto.createGain();
                oscilador.type = "sine";
                oscilador.frequency.setValueAtTime(frecuencia, inicio);
                volumen.gain.setValueAtTime(.0001, inicio);
                volumen.gain.exponentialRampToValueAtTime(.022, inicio + .008);
                volumen.gain.exponentialRampToValueAtTime(.0001, inicio + duracion);
                oscilador.connect(volumen);
                volumen.connect(contexto.destination);
                oscilador.start(inicio);
                oscilador.stop(inicio + duracion + .01);
                oscilador.addEventListener("ended", () => { oscilador.disconnect(); volumen.disconnect(); }, { once: true });
            });
        };
        if (contexto.state === "suspended") void contexto.resume().then(emitir).catch(() => {});
        else emitir();
    } catch (error) {
        // El audio es opcional y puede no estar disponible en algunos navegadores.
    }
}

function emitirFeedbackTactil() {
    if (!preferenciaActiva(SETTINGS_KEYS.hapticFeedback) || typeof navigator.vibrate !== "function") return;
    try { navigator.vibrate(8); } catch (error) { /* La vibración depende del dispositivo y el navegador. */ }
}

function instalarFeedbackInteractivo() {
    document.addEventListener("click", event => {
        if (!event.isTrusted || !(event.target instanceof Element)) return;
        const control = event.target.closest("button, [role='button']");
        if (!control || control.getAttribute("aria-disabled") === "true") return;
        reproducirFeedbackSonoro();
        emitirFeedbackTactil();
    }, { capture: true });
    document.addEventListener("change", event => {
        if (!event.isTrusted || !(event.target instanceof Element) || !event.target.matches("select, input[type='checkbox'], input[type='range']")) return;
        if (event.target.id === "config-sound-feedback" || event.target.id === "config-haptic-feedback") return;
        reproducirFeedbackSonoro();
    });
}

function actualizarRelojDashboard() {
    const ahora = new Date();
    const time = document.getElementById("dashboard-clock-time");
    const date = document.getElementById("dashboard-clock-date");
    const zona = { timeZone: "America/Guayaquil" };
    if (time) {
        time.textContent = new Intl.DateTimeFormat("es-EC", {
            ...zona, hour: "2-digit", minute: "2-digit", second: "2-digit", hourCycle: "h23"
        }).format(ahora);
        time.dateTime = ahora.toISOString();
    }
    if (date) {
        date.textContent = new Intl.DateTimeFormat("es-EC", {
            ...zona, weekday: "long", day: "numeric", month: "long", year: "numeric"
        }).format(ahora);
        date.dateTime = ahora.toISOString();
    }
}

function inicializarRelojDashboard() {
    actualizarRelojDashboard();
    if (!dashboardClockTimer) dashboardClockTimer = window.setInterval(actualizarRelojDashboard, 1000);
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
    email?.classList.add("skeleton-account-loading");
    try {
        const { ok, data } = await apiFetch("/api/perfil");
        if (!ok) return;
        if (nombre) nombre.textContent = data.nombre || "Usuario";
        const avatar = document.getElementById("account-menu-avatar");
        if (avatar) avatar.textContent = (data.nombre || "U").trim().charAt(0).toLocaleUpperCase("es");
        if (email) email.textContent = data.email || "";
        if (rol) rol.textContent = data.rol || "Cuenta activa";
    } catch (error) {
        if (email) email.textContent = "No se pudieron cargar los datos de cuenta.";
    } finally {
        email?.classList.remove("skeleton-account-loading");
    }
}

function cargarConfiguracionEnControles() {
    const refresh = document.getElementById("config-refresh-interval");
    const period = document.getElementById("config-default-period");
    const reduceMotion = document.getElementById("config-reduce-motion");
    const soundFeedback = document.getElementById("config-sound-feedback");
    const hapticFeedback = document.getElementById("config-haptic-feedback");
    const reportSelector = document.getElementById("sensor-report-period");
    try {
        const savedRefresh = localStorage.getItem(SETTINGS_KEYS.refresh) || "0";
        const savedPeriod = localStorage.getItem(SETTINGS_KEYS.reportPeriod) || "24";
        const savedReduceMotion = localStorage.getItem(SETTINGS_KEYS.reducedMotion) === "true";
        if (refresh) refresh.value = savedRefresh;
        if (period) period.value = savedPeriod;
        if (reportSelector && reportSelector.querySelector(`option[value="${savedPeriod}"]`)) reportSelector.value = savedPeriod;
        if (reduceMotion) reduceMotion.checked = savedReduceMotion;
        if (soundFeedback) soundFeedback.checked = localStorage.getItem(SETTINGS_KEYS.soundFeedback) === "true";
        if (hapticFeedback) hapticFeedback.checked = localStorage.getItem(SETTINGS_KEYS.hapticFeedback) === "true";
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
            if (typeof cargarTendenciaInicio === "function") void cargarTendenciaInicio();
        }
    }, seconds * 1000);
}


function initDashboardSettings() {
    document.getElementById("footer-year").textContent = String(new Date().getFullYear());
    document.querySelectorAll("[data-accent-option]").forEach(button => {
        button.addEventListener("click", () => applyAccent(button.dataset.accentOption));
    });
    document.getElementById("config-text-size")?.addEventListener("change", event => applyTextSize(Number(event.target.value)));
    document.getElementById("config-reduce-motion")?.addEventListener("change", event => {
        document.body.classList.toggle("reduce-motion", event.target.checked);
        localStorage.setItem(SETTINGS_KEYS.reducedMotion, String(event.target.checked));
        sincronizarCursorOrbital();
        mostrarEstadoConfiguracion("Preferencia de animación guardada.");
    });
    document.getElementById("config-sound-feedback")?.addEventListener("change", event => {
        try { localStorage.setItem(SETTINGS_KEYS.soundFeedback, String(event.target.checked)); }
        catch (error) { console.warn("No se pudo guardar el sonido de interfaz.", error); }
        if (event.target.checked) reproducirFeedbackSonoro("confirmacion");
        mostrarEstadoConfiguracion(event.target.checked ? "Sonidos de interfaz activados." : "Sonidos de interfaz desactivados.");
    });
    document.getElementById("config-haptic-feedback")?.addEventListener("change", event => {
        try { localStorage.setItem(SETTINGS_KEYS.hapticFeedback, String(event.target.checked)); }
        catch (error) { console.warn("No se pudo guardar la vibración táctil.", error); }
        if (event.target.checked) emitirFeedbackTactil();
        mostrarEstadoConfiguracion(event.target.checked ? "Vibración táctil activada si el dispositivo la admite." : "Vibración táctil desactivada.");
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
    document.getElementById("operator-config-form")?.addEventListener("submit", guardarConfiguracionOperador);
    document.getElementById("operator-config-reset")?.addEventListener("click", restablecerConfiguracionOperador);
    instalarFeedbackInteractivo();
    inicializarPantallaCompletaDashboard();
    cargarConfiguracionEnControles();
}

function inicializarPantallaCompletaDashboard() {
    const button = document.getElementById("btn-dashboard-fullscreen");
    const fullscreenRoot = document.documentElement;
    if (!button) return;
    if (typeof fullscreenRoot.requestFullscreen !== "function" || typeof document.exitFullscreen !== "function") {
        button.hidden = true;
        return;
    }

    const sincronizar = () => {
        const activa = document.fullscreenElement === fullscreenRoot;
        button.setAttribute("aria-label", activa ? "Salir de pantalla completa" : "Activar pantalla completa");
        button.title = activa ? "Salir de pantalla completa" : "Pantalla completa";
        const icon = document.getElementById("dashboard-fullscreen-icon");
        if (icon) icon.textContent = activa ? "⤢" : "⛶";
    };

    document.addEventListener("fullscreenchange", sincronizar);
    sincronizar();
}

async function togglePantallaCompletaDashboard() {
    const fullscreenRoot = document.documentElement;
    try {
        if (document.fullscreenElement === fullscreenRoot) await document.exitFullscreen();
        else await fullscreenRoot.requestFullscreen();
    } catch (error) {
        if (typeof mostrarNotificacion === "function") mostrarNotificacion("No se pudo activar la pantalla completa en este navegador.", "error");
    }
}

function inicializarCursorOrbital() {
    const cursor = document.getElementById("orbital-cursor");
    if (!cursor) return;

    const ring = cursor.querySelector(".orbital-cursor__ring");
    const frame = document.getElementById("companion-model-frame");
    const finePointer = window.matchMedia("(hover: hover) and (pointer: fine)");
    const reducedMotion = window.matchMedia("(prefers-reduced-motion: reduce)");
    let pointerInside = false;
    let x = 0;
    let y = 0;
    let ringX = 0;
    let ringY = 0;
    let animationFrame = 0;

    const bridgeFrameCursor = () => {
        if (!frame) return;
        try {
            const frameDocument = frame.contentDocument;
            if (!frameDocument) return;
            let bridgeStyle = frameDocument.getElementById("orbital-cursor-bridge-style");
            if (!bridgeStyle) {
                bridgeStyle = frameDocument.createElement("style");
                bridgeStyle.id = "orbital-cursor-bridge-style";
                bridgeStyle.textContent = "html.orbital-cursor-bridged, html.orbital-cursor-bridged * { cursor: none !important; } html.orbital-cursor-bridged :is(input, textarea, [contenteditable='true']) { cursor: text !important; } html.orbital-cursor-bridged select { cursor: pointer !important; }";
                frameDocument.head?.append(bridgeStyle);
            }
            const enabled = finePointer.matches && !reducedMotion.matches && !document.body.classList.contains("reduce-motion");
            frameDocument.documentElement?.classList.toggle("orbital-cursor-bridged", enabled);
        } catch (error) {
            // El iframe puede estar cargando o en otro origen; el cursor principal sigue funcionando fuera de él.
        }
    };

    const sincronizarVisibilidad = () => {
        const enabled = finePointer.matches && !reducedMotion.matches && !document.body.classList.contains("reduce-motion");
        document.body.classList.toggle("cursor-orbit-enabled", enabled);
        cursor.classList.toggle("is-visible", enabled && pointerInside);
        bridgeFrameCursor();
        if (!enabled && animationFrame) {
            cancelAnimationFrame(animationFrame);
            animationFrame = 0;
        }
    };

    const seguirOrbita = () => {
        const differenceX = x - ringX;
        const differenceY = y - ringY;
        ringX += differenceX * .18;
        ringY += differenceY * .18;
        ring.style.left = `${ringX}px`;
        ring.style.top = `${ringY}px`;
        if (Math.abs(differenceX) > .2 || Math.abs(differenceY) > .2) {
            animationFrame = requestAnimationFrame(seguirOrbita);
        } else {
            ringX = x;
            ringY = y;
            ring.style.left = `${x}px`;
            ring.style.top = `${y}px`;
            animationFrame = 0;
        }
    };

    const actualizarPosicion = (event, frameElement = null) => {
        if (event.pointerType !== "mouse" && event.pointerType !== "pen") return;
        if (frameElement) {
            const bounds = frameElement.getBoundingClientRect();
            x = bounds.left + event.clientX;
            y = bounds.top + event.clientY;
        } else {
            x = event.clientX;
            y = event.clientY;
        }
        cursor.style.setProperty("--cursor-x", `${x}px`);
        cursor.style.setProperty("--cursor-y", `${y}px`);
        if (!pointerInside) {
            ringX = x;
            ringY = y;
            ring.style.left = `${x}px`;
            ring.style.top = `${y}px`;
        }
        pointerInside = true;
        sincronizarVisibilidad();

        const target = event.target && typeof event.target.closest === "function" ? event.target : null;
        cursor.classList.toggle("is-paused", Boolean(target?.closest('input, textarea, select, [contenteditable="true"]')));
        cursor.classList.toggle("is-hovering", Boolean(target?.closest("a, button, [role='button'], .cursor-pointer")));
        if (!animationFrame && finePointer.matches && !reducedMotion.matches && !document.body.classList.contains("reduce-motion")) {
            animationFrame = requestAnimationFrame(seguirOrbita);
        }
    };

    document.addEventListener("pointermove", event => actualizarPosicion(event), { passive: true });

    if (frame) {
        const conectarEventosDelFrame = () => {
            bridgeFrameCursor();
            try {
                const frameDocument = frame.contentDocument;
                if (!frameDocument || frame._orbitalCursorDocument === frameDocument) return;
                frame._orbitalCursorDocument = frameDocument;
                frameDocument.addEventListener("pointermove", event => actualizarPosicion(event, frame), { passive: true });
                frameDocument.addEventListener("pointerdown", event => {
                    if (event.pointerType === "mouse" || event.pointerType === "pen") cursor.classList.add("is-pressed");
                });
                frameDocument.addEventListener("pointerup", () => cursor.classList.remove("is-pressed"));
            } catch (error) {
                // Se reintentará cuando el iframe vuelva a cargar.
            }
        };
        frame.addEventListener("load", conectarEventosDelFrame);
        conectarEventosDelFrame();
        frame.addEventListener("pointerleave", () => {
            pointerInside = false;
            cursor.classList.remove("is-visible", "is-hovering", "is-pressed", "is-paused");
        });
    }

    document.addEventListener("pointerdown", event => {
        if (event.pointerType === "mouse" || event.pointerType === "pen") cursor.classList.add("is-pressed");
    });
    document.addEventListener("pointerup", () => cursor.classList.remove("is-pressed"));
    document.addEventListener("pointerleave", () => {
        pointerInside = false;
        cursor.classList.remove("is-visible", "is-hovering", "is-pressed", "is-paused");
    });
    document.addEventListener("visibilitychange", () => {
        if (document.hidden) {
            pointerInside = false;
            cursor.classList.remove("is-visible", "is-hovering", "is-pressed", "is-paused");
        }
    });
    finePointer.addEventListener?.("change", sincronizarVisibilidad);
    reducedMotion.addEventListener?.("change", sincronizarVisibilidad);
    sincronizarVisibilidad();
}

function sincronizarCursorOrbital() {
    const cursor = document.getElementById("orbital-cursor");
    if (!cursor) return;
    const reduceMotion = document.body.classList.contains("reduce-motion") || window.matchMedia("(prefers-reduced-motion: reduce)").matches;
    const finePointer = window.matchMedia("(hover: hover) and (pointer: fine)").matches;
    document.body.classList.toggle("cursor-orbit-enabled", finePointer && !reduceMotion);
    if (reduceMotion) cursor.classList.remove("is-visible", "is-hovering", "is-pressed");
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
        : ["La plataforma utiliza los datos de cuenta necesarios para iniciar sesión y mostrar el perfil de cada usuario.", "Cuando usas Brunito, el mensaje y las lecturas de sensores pertinentes se envían a Google Gemini para generar la respuesta. En el nivel gratuito, Google puede usar el contenido enviado para mejorar sus productos, según sus condiciones.", "Evita incluir contraseñas u otra información sensible en tus mensajes a Brunito, en los mensajes de contacto o en los reportes descargados."];
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
    const boton = document.getElementById("sensor-report-csv");
    const htmlOriginal = boton?.innerHTML;
    if (boton) {
        boton.disabled = true;
        boton.setAttribute("aria-busy", "true");
        boton.innerHTML = '<span class="report-download-spinner" aria-hidden="true"></span> Preparando CSV…';
    }
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
        const filas = [[
            "Sensor", "Temperatura (°C)", "Humedad (%)", "Calidad del aire (ICA)",
            "Distancia HC-SR04 (cm)", "Lluvia detectada", "Lectura LDR", "Nivel de agua",
            "Reflectancia TCRT5000", "TCRT5000 detectado", "Fecha", "Fuente"
        ]];
        sensores.forEach(({ id, lectura }) => filas.push([
            id ?? lectura.sensor_id ?? lectura.id,
            lectura.temperatura,
            lectura.humedad,
            lectura.calidad_aire,
            lectura.distancia_cm,
            lectura.lluvia_detectada == null ? "" : lectura.lluvia_detectada ? "Sí" : "No",
            lectura.luminosidad,
            lectura.nivel_agua,
            lectura.reflectancia_tcrt5000,
            lectura.tcrt5000_detectado == null ? "" : lectura.tcrt5000_detectado ? "Sí" : "No",
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
        registrarDescargaReporte("CSV", link.download, "Lecturas más recientes");

        mostrarNotificacion(demo ? "CSV demostrativo descargado; sus datos están marcados como simulados." : "CSV generado exitosamente.", "exito");
    } catch (err) {
        mostrarNotificacion("Error al exportar CSV", "error");
    } finally {
        if (boton) {
            boton.disabled = false;
            boton.removeAttribute("aria-busy");
            boton.innerHTML = htmlOriginal;
        }
    }
}

const DOWNLOAD_HISTORY_BASE_KEY = "smartcity_report_downloads_v1";

function claveHistorialDescargas() {
    const usuario = localStorage.getItem("user_id_cloud") || localStorage.getItem("user_name_cloud") || "anonimo";
    return `${DOWNLOAD_HISTORY_BASE_KEY}:${usuario}`;
}

function obtenerHistorialDescargas() {
    try {
        const entries = JSON.parse(localStorage.getItem(claveHistorialDescargas()) || "[]");
        return Array.isArray(entries) ? entries.slice(0, 20) : [];
    } catch { return []; }
}

function registrarDescargaReporte(formato, archivo, periodoPersonalizado = "") {
    const periodo = periodoPersonalizado || document.getElementById("sensor-report-period")?.selectedOptions?.[0]?.textContent || "Periodo seleccionado";
    const historial = [{ formato, archivo, periodo, fecha: new Date().toISOString() }, ...obtenerHistorialDescargas()].slice(0, 20);
    try { localStorage.setItem(claveHistorialDescargas(), JSON.stringify(historial)); } catch { /* La descarga no depende del historial local. */ }
    renderizarHistorialDescargas(historial);
}

function renderizarHistorialDescargas(historial = obtenerHistorialDescargas()) {
    const lista = document.getElementById("download-history-list");
    if (!lista) return;
    lista.replaceChildren();
    if (!historial.length) {
        const vacio = document.createElement("li");
        vacio.className = "download-history-empty";
        vacio.textContent = "Todavía no hay reportes descargados.";
        lista.append(vacio);
        return;
    }
    historial.forEach(item => {
        const fila = document.createElement("li");
        fila.className = "download-history-item";
        const icono = document.createElement("span");
        icono.className = "download-history-icon";
        icono.textContent = item.formato === "PDF" ? "📄" : "📊";
        icono.setAttribute("aria-hidden", "true");
        const detalle = document.createElement("span");
        detalle.className = "download-history-detail";
        const nombre = document.createElement("strong");
        nombre.textContent = item.archivo || `Reporte ${item.formato}`;
        const meta = document.createElement("small");
        const fecha = new Date(item.fecha);
        meta.textContent = `${item.periodo || "Periodo seleccionado"} · ${Number.isNaN(fecha.getTime()) ? "Fecha desconocida" : new Intl.DateTimeFormat("es-EC", { dateStyle: "medium", timeStyle: "short" }).format(fecha)}`;
        detalle.append(nombre, meta);
        fila.append(icono, detalle);
        lista.append(fila);
    });
}

function inicializarHistorialDescargas() {
    renderizarHistorialDescargas();
    document.getElementById("clear-download-history")?.addEventListener("click", () => {
        try { localStorage.removeItem(claveHistorialDescargas()); } catch { /* El control sigue siendo usable sin persistencia local. */ }
        renderizarHistorialDescargas([]);
    });
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
    const widths = [42, 34, 25, 23, 23, 22, 20, 22, 22, 33];
    const headings = ["Fecha y hora", "Sensor", "Temp. °C", "Humedad %", "Aire ICA", "Dist. cm", "Lluvia", "LDR", "Nivel agua", "TCRT5000"];
    const number = new Intl.NumberFormat("es-EC", { maximumFractionDigits: 2 });
    const average = field => {
        const values = data.map(reading => reading[field]).filter(value => value !== null && value !== undefined && value !== "").map(Number).filter(Number.isFinite);
        return values.length ? number.format(values.reduce((sum, value) => sum + value, 0) / values.length) : "sin datos";
    };
    const formatNumber = value => {
        if (value === null || value === undefined || value === "") return "—";
        const parsed = Number(value);
        return Number.isFinite(parsed) ? number.format(parsed) : "—";
    };
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
        pdf.text(`Promedios: ${average("temperatura")} °C · ${average("humedad")} % humedad · ${average("calidad_aire")} ICA`, margin, y);
        pdf.text(`Lecturas adicionales promedio: distancia ${average("distancia_cm")} cm · LDR ${average("luminosidad")} · nivel de agua ${average("nivel_agua")}`, margin, y + 5);
        y += 13;
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
            formatNumber(reading.temperatura),
            formatNumber(reading.humedad),
            formatNumber(reading.calidad_aire),
            formatNumber(reading.distancia_cm),
            reading.lluvia_detectada == null ? "—" : reading.lluvia_detectada ? "Sí" : "No",
            formatNumber(reading.luminosidad),
            formatNumber(reading.nivel_agua),
            formatNumber(reading.reflectancia_tcrt5000),
            reading.tcrt5000_detectado == null ? "—" : reading.tcrt5000_detectado ? "Sí" : "No"
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
        boton.innerHTML = '<span class="report-download-spinner" aria-hidden="true"></span> Generando PDF…';
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
        registrarDescargaReporte("PDF", `SmartCity_${demo ? "DEMO_SIMULADA_" : ""}Reporte_${ahora.toISOString().slice(0, 10)}.pdf`);
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
