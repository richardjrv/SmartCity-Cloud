// ============================================================
// 🔔 SISTEMA DE NOTIFICACIONES TOAST
// ============================================================
function mostrarNotificacion(mensaje, tipo = "info") {
    const container = document.getElementById("toast-container");
    if (!container) return;

    const toast = document.createElement("div");
    toast.className = `pointer-events-auto flex items-center gap-3 px-4 py-3 rounded-2xl shadow-2xl text-xs font-semibold text-white backdrop-blur-xl border transition-all duration-300 transform translate-x-10 opacity-0`;

    // Estilos según el tipo
    if (tipo === "exito") {
        toast.classList.add("bg-emerald-900/90", "border-emerald-500/50");
        toast.innerHTML = `<span>✅</span> <span>${mensaje}</span>`;
    } else if (tipo === "error") {
        toast.classList.add("bg-rose-900/90", "border-rose-500/50");
        toast.innerHTML = `<span>⚠️</span> <span>${mensaje}</span>`;
    } else {
        toast.classList.add("bg-blue-900/90", "border-blue-500/50");
        toast.innerHTML = `<span>ℹ️️</span> <span>${mensaje}</span>`;
    }

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

function initTextSizeControls() {
    const badge = document.getElementById("usuario-badge");
    const accountWrap = badge?.parentElement;
    const toolbarParent = accountWrap?.parentElement;
    if (!toolbarParent || document.getElementById("text-size-controls")) return;

    const group = document.createElement("div");
    group.id = "text-size-controls";
    group.className = "flex items-center gap-1";
    group.setAttribute("role", "group");
    group.setAttribute("aria-label", "Tamaño del texto");

    const makeButton = (label, accessibleName, action) => {
        const button = document.createElement("button");
        button.type = "button";
        button.textContent = label;
        button.className = "px-2.5 py-2 rounded-lg bg-slate-700/60 border border-slate-600 text-slate-100 hover:bg-slate-600 text-sm font-semibold transition focus-visible:outline focus-visible:outline-2 focus-visible:outline-blue-400 disabled:opacity-40 disabled:cursor-not-allowed";
        button.setAttribute("aria-label", accessibleName);
        button.addEventListener("click", action);
        return button;
    };

    const decreaseButton = makeButton("A−", "Disminuir tamaño del texto", () => changeTextSize(-1));
    const resetButton = makeButton("A", "Restablecer tamaño normal del texto", () => applyTextSize(1));
    const increaseButton = makeButton("A+", "Aumentar tamaño del texto", () => changeTextSize(1));
    const themeButton = makeButton("☀️", "Activar modo claro", toggleTheme);
    themeButton.id = "theme-toggle";
    themeButton.classList.add("inline-flex", "items-center", "gap-1");
    const status = document.createElement("span");
    status.id = "text-size-status";
    status.className = "sr-only";
    status.setAttribute("aria-live", "polite");

    group.append(decreaseButton, resetButton, increaseButton, themeButton, status);
    toolbarParent.insertBefore(group, accountWrap);
    window.textSizeControls = { decreaseButton, increaseButton, status };

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
}

function changeTextSize(direction) {
    const currentScale = Number(document.documentElement.dataset.textScale || 1);
    const currentIndex = TEXT_SIZE_STEPS.indexOf(currentScale);
    const nextIndex = Math.max(0, Math.min(TEXT_SIZE_STEPS.length - 1, currentIndex + direction));
    applyTextSize(TEXT_SIZE_STEPS[nextIndex]);
}

function applyTextSize(scale, persist = true) {
    const percentage = Math.round(scale * 100);
    document.documentElement.dataset.textScale = String(scale);
    document.documentElement.style.fontSize = percentage + "%";
    document.documentElement.style.setProperty("--font-scale", String(scale));
    const settingsSize = document.getElementById("config-text-size");
    if (settingsSize) settingsSize.value = String(scale);

    if (window.textSizeControls) {
        const { decreaseButton, increaseButton, status } = window.textSizeControls;
        decreaseButton.disabled = scale <= TEXT_SIZE_STEPS[0];
        increaseButton.disabled = scale >= TEXT_SIZE_STEPS[TEXT_SIZE_STEPS.length - 1];
        status.textContent = `Tamaño del texto: ${percentage} por ciento.`;
    }

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

    const button = document.getElementById("theme-toggle");
    if (button) {
        const nextTheme = normalizedTheme === "dark" ? "claro" : "nocturno";
        button.innerHTML = normalizedTheme === "dark" ? '<span aria-hidden="true">☀️</span><span class="hidden sm:inline">Modo claro</span>' : '<span aria-hidden="true">🌙</span><span class="hidden sm:inline">Modo nocturno</span>';
        button.setAttribute("aria-label", `Activar modo ${nextTheme}`);
        button.title = `Activar modo ${nextTheme}`;
    }

    if (persist) {
        try {
            localStorage.setItem(THEME_STORAGE_KEY, normalizedTheme);
        } catch (error) {
            console.warn("No se pudo guardar la preferencia de tema.", error);
        }
    }
}

function toggleTheme() {
    const currentTheme = document.documentElement.dataset.theme || "dark";
    applyTheme(currentTheme === "dark" ? "light" : "dark");
}

function navegarA(vista) {
    document.body.classList.toggle("login-only", vista === "auth");
    cerrarMobileNav();
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

    if (vista === "auth") {
        // Ocultar menú y componentes del header si está en el login
        document.getElementById("menu-navegacion")?.classList.add("hidden");
        document.getElementById("btn-mobile-nav")?.classList.add("hidden");
        document.getElementById("account-menu-wrap")?.classList.add("hidden");
        document.getElementById("btn-menu-configuracion")?.classList.add("hidden");

        document.getElementById("vista-auth")?.classList.remove("hidden");
    } else if (vista === "dashboard") {
        document.getElementById("vista-dashboard")?.classList.remove("hidden");
        cargarUltimasLecturas();
        cargarMapaSensores();
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

function mostrarDashboard(nombre, idRol) {
    // 🔓 Mostrar el menú superior únicamente cuando la sesión sea válida
    document.getElementById("menu-navegacion")?.classList.remove("hidden");
    document.getElementById("btn-mobile-nav")?.classList.remove("hidden");
    document.getElementById("account-menu-wrap")?.classList.remove("hidden");
    document.getElementById("btn-menu-configuracion")?.classList.remove("hidden");

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
    const menu = document.getElementById("menu-navegacion");
    const button = document.getElementById("btn-mobile-nav");
    const opening = !menu?.classList.contains("mobile-nav-open");
    menu?.classList.toggle("mobile-nav-open", opening);
    button?.setAttribute("aria-expanded", String(opening));
    button?.setAttribute("aria-label", opening ? "Cerrar navegación" : "Abrir navegación");
}

function cerrarMobileNav() {
    document.getElementById("menu-navegacion")?.classList.remove("mobile-nav-open");
    document.getElementById("btn-mobile-nav")?.setAttribute("aria-expanded", "false");
    document.getElementById("btn-mobile-nav")?.setAttribute("aria-label", "Abrir navegación");
}

async function cargarUltimasLecturas() {
    try {
        const { ok, data } = await apiFetch("/sensores/ultimas");

        if (ok && Array.isArray(data) && data.length > 0) {
            const ultima = data[0];
            const temp = document.getElementById("metric-temp");
            const hum = document.getElementById("metric-hum");
            const aire = document.getElementById("metric-aire");

            if (temp) temp.innerText = `${ultima.temperatura} °C`;
            if (hum) hum.innerText = `${ultima.humedad} %`;
            if (aire) aire.innerText = `${ultima.calidad_aire} ICA`;
        }
    } catch (error) {
        console.error("❌ Error cargando sensores:", error);
    }
}

// Inicialización de la aplicación al cargar el DOM
document.addEventListener("DOMContentLoaded", () => {
    document.body.classList.add("login-only");
    initTextSizeControls();
    initAccountMenu();
    initSiteInformation();
    initDashboardSettings();
    const reportPeriod = document.getElementById("sensor-report-period");
    const customRange = document.getElementById("sensor-report-custom-range");
    reportPeriod?.addEventListener("change", () => {
        customRange?.classList.toggle("hidden", reportPeriod.value !== "custom");
        if (reportPeriod.value === "custom") inicializarPeriodoPersonalizado();
    });
    window.addEventListener("afterprint", limpiarVistaReporte);
    comprobarSesion();
});

const SETTINGS_KEYS = {
    refresh: "smartcity_refresh_seconds",
    reportPeriod: "smartcity_report_period",
    reducedMotion: "smartcity_reduce_motion"
};
let dashboardRefreshTimer = null;

function initAccountMenu() {
    document.addEventListener("click", event => {
        const wrapper = document.getElementById("account-menu-wrap");
        if (wrapper && !wrapper.contains(event.target)) cerrarAccountMenu();
    });
    document.addEventListener("keydown", event => {
        if (event.key === "Escape") {
            cerrarAccountMenu();
            cerrarModal("site-info-modal");
            cerrarModal("contact-modal");
        }
    });
}

function toggleAccountMenu() {
    const menu = document.getElementById("account-menu");
    const trigger = document.getElementById("usuario-badge");
    const opening = menu?.classList.contains("hidden");
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
            cargarUltimasLecturas();
            if (typeof cargarMapaSensores === "function") cargarMapaSensores();
        }
    }, seconds * 1000);
}

function initDashboardSettings() {
    document.getElementById("footer-year").textContent = String(new Date().getFullYear());
    document.getElementById("config-theme")?.addEventListener("change", event => applyTheme(event.target.value));
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
    applyTheme("dark");
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
        const { ok, data } = await apiFetch("/sensores/ultimas");
        if (!ok || !Array.isArray(data) || data.length === 0) {
            mostrarNotificacion("No hay datos disponibles para exportar", "error");
            return;
        }

        let csv = "ID,Temperatura (°C),Humedad (%),Calidad Aire (ICA),Fecha\n";
        data.forEach(s => {
            csv += `${s.id || ''},${s.temperatura},${s.humedad},${s.calidad_aire},${s.fecha_registro || ''}\n`;
        });

        const blob = new Blob([csv], { type: "text/csv;charset=utf-8;" });
        const url = URL.createObjectURL(blob);
        const link = document.createElement("a");
        link.setAttribute("href", url);
        link.setAttribute("download", `SmartCity_Telemetria_${new Date().toISOString().slice(0, 10)}.csv`);
        document.body.appendChild(link);
        link.click();
        document.body.removeChild(link);

        mostrarNotificacion("Reporte CSV generado exitosamente", "exito");
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

function limpiarVistaReporte() {
    document.body.classList.remove("printing-sensor-report");
    document.getElementById("sensor-report-print")?.classList.remove("ready");
}

function agregarCelda(fila, valor) {
    const celda = document.createElement("td");
    celda.textContent = String(valor ?? "—");
    fila.appendChild(celda);
}

async function exportarSensoresPDF() {
    const selector = document.getElementById("sensor-report-period");
    const estado = document.getElementById("sensor-report-status");
    const boton = document.getElementById("sensor-report-pdf");
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

    if (boton) boton.disabled = true;
    if (estado) estado.textContent = "Consultando las lecturas del periodo…";
    try {
        const query = new URLSearchParams({ desde: desde.toISOString(), hasta: hasta.toISOString() });
        let { ok, data, status } = await apiFetch(`/sensores/historial?${query.toString()}`);
        let limitation = "";
        if (!ok && status === 404) {
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

        const filas = document.getElementById("sensor-report-rows");
        filas.replaceChildren();
        const numero = new Intl.NumberFormat("es-EC", { maximumFractionDigits: 2 });
        data.sort((a, b) => new Date(a.fecha_hora) - new Date(b.fecha_hora));
        data.forEach(lectura => {
            const fila = document.createElement("tr");
            agregarCelda(fila, new Date(lectura.fecha_hora).toLocaleString("es-EC"));
            agregarCelda(fila, lectura.sensor_id);
            agregarCelda(fila, numero.format(lectura.temperatura));
            agregarCelda(fila, numero.format(lectura.humedad));
            agregarCelda(fila, numero.format(lectura.calidad_aire));
            filas.appendChild(fila);
        });

        const promedio = campo => data.reduce((suma, lectura) => suma + Number(lectura[campo] || 0), 0) / data.length;
        document.getElementById("sensor-report-range").textContent = `Periodo: ${desde.toLocaleString("es-EC")} — ${hasta.toLocaleString("es-EC")}`;
        document.getElementById("sensor-report-generated").textContent = `Generado: ${ahora.toLocaleString("es-EC")}`;
        document.getElementById("sensor-report-summary").textContent = `${data.length} lecturas · Promedios: ${numero.format(promedio("temperatura"))} °C, ${numero.format(promedio("humedad"))} % humedad, ${numero.format(promedio("calidad_aire"))} ICA.`;
        document.getElementById("sensor-report-limitation").textContent = limitation;

        document.getElementById("sensor-report-print")?.classList.add("ready");
        document.body.classList.add("printing-sensor-report");
        if (estado) estado.textContent = limitation
            ? "Reporte listo con las últimas 10 lecturas disponibles. Actualiza el backend para obtener el historial completo."
            : "Reporte listo. En el diálogo de impresión elige «Guardar como PDF».";
        setTimeout(() => window.print(), 150);
    } catch (error) {
        console.error("Error al preparar el reporte PDF:", error);
        if (estado) estado.textContent = "No se pudo conectar con el servicio de lecturas.";
        mostrarNotificacion("No se pudo cargar el historial para el PDF.", "error");
    } finally {
        if (boton) boton.disabled = false;
    }
}
