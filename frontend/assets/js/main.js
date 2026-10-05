// ============================================================
// 🚀 ORQUESTRADOR PRINCIPAL Y NAVEGACIÓN
// ============================================================

const TEXT_SIZE_STEPS = [0.875, 1, 1.125, 1.25];
const TEXT_SIZE_STORAGE_KEY = "smartcity_text_size";
const THEME_STORAGE_KEY = "smartcity_theme";

function installAccessibilityStyles() {
    if (document.getElementById("accessibility-view-styles")) return;

    const style = document.createElement("style");
    style.id = "accessibility-view-styles";
    style.textContent = `
        body.login-only #menu-navegacion,
        body.login-only #usuario-badge,
        body.login-only #btn-auth-accion,
        body.login-only #vista-dashboard,
        body.login-only #vista-perfil,
        body.login-only #vista-admin-usuarios,
        body.login-only #brunito-chat-window,
        body.login-only button[onclick="toggleChatBrunito()"] {
            display: none !important;
        }
        body.login-only #vista-auth { display: flex !important; }

        html[data-theme="light"] body {
            background-color: #f1f5f9 !important;
            color: #0f172a !important;
        }
        html[data-theme="light"] [class~="bg-slate-900"],
        html[data-theme="light"] [class~="bg-slate-900/80"],
        html[data-theme="light"] [class~="bg-slate-900/90"],
        html[data-theme="light"] [class~="bg-slate-800"],
        html[data-theme="light"] [class~="bg-slate-800/90"],
        html[data-theme="light"] [class~="bg-slate-800/80"],
        html[data-theme="light"] [class~="bg-slate-800/60"],
        html[data-theme="light"] [class~="bg-slate-800/40"] {
            background-color: #fff !important;
        }
        html[data-theme="light"] [class~="bg-slate-700"],
        html[data-theme="light"] [class~="bg-slate-700/80"],
        html[data-theme="light"] [class~="bg-slate-700/60"],
        html[data-theme="light"] [class~="bg-slate-700/50"],
        html[data-theme="light"] [class~="bg-slate-700/40"] {
            background-color: #e2e8f0 !important;
        }
        html[data-theme="light"] [class~="border-slate-700"],
        html[data-theme="light"] [class~="border-slate-700/60"],
        html[data-theme="light"] [class~="border-slate-700/50"],
        html[data-theme="light"] [class~="border-slate-700/30"],
        html[data-theme="light"] [class~="border-slate-600"],
        html[data-theme="light"] [class~="border-slate-600/50"] {
            border-color: #cbd5e1 !important;
        }
        html[data-theme="light"] [class~="text-slate-100"],
        html[data-theme="light"] [class~="text-slate-200"],
        html[data-theme="light"] [class~="text-slate-300"] {
            color: #0f172a !important;
        }
        html[data-theme="light"] [class~="text-slate-400"] { color: #475569 !important; }
        html[data-theme="light"] [class~="text-slate-500"] { color: #64748b !important; }
        html[data-theme="light"] [class~="text-white"]:not([class*="bg-blue-"]):not([class*="bg-rose-"]):not([class*="bg-emerald-"]):not([class*="bg-amber-"]) {
            color: #0f172a !important;
        }
    `;
    document.head.appendChild(style);
}

function initTextSizeControls() {
    const badge = document.getElementById("usuario-badge");
    const toolbarParent = badge?.parentElement;
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
    toolbarParent.insertBefore(group, badge);

    window.textSizeControls = { decreaseButton, increaseButton, status };
    let savedScale = 1;
    let savedTheme = "dark";
    try {
        const storedScale = Number(localStorage.getItem(TEXT_SIZE_STORAGE_KEY));
        if (TEXT_SIZE_STEPS.includes(storedScale)) savedScale = storedScale;
        const storedTheme = localStorage.getItem(THEME_STORAGE_KEY);
        if (storedTheme === "light" || storedTheme === "dark") savedTheme = storedTheme;
    } catch (error) {
        console.warn("No se pudieron leer las preferencias de accesibilidad.", error);
    }
    applyTextSize(savedScale, false);
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

    const button = document.getElementById("theme-toggle");
    if (button) {
        const nextTheme = normalizedTheme === "dark" ? "claro" : "nocturno";
        button.innerHTML = normalizedTheme === "dark"
            ? '<span aria-hidden="true">☀️</span><span class="hidden sm:inline">Modo claro</span>'
            : '<span aria-hidden="true">🌙</span><span class="hidden sm:inline">Modo nocturno</span>';
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
    const token = obtenerToken();

    if (!token && vista !== "auth") {
        navegarA("auth");
        return;
    }

    document.getElementById("vista-dashboard")?.classList.add("hidden");
    document.getElementById("vista-perfil")?.classList.add("hidden");
    document.getElementById("vista-admin-usuarios")?.classList.add("hidden");
    document.getElementById("vista-auth")?.classList.add("hidden");

    if (vista === "auth") {
        document.getElementById("menu-navegacion")?.classList.add("hidden");
        document.getElementById("usuario-badge")?.classList.add("hidden");
        document.getElementById("btn-auth-accion")?.classList.add("hidden");
        document.getElementById("vista-auth")?.classList.remove("hidden");
    } else if (vista === "dashboard") {
        document.getElementById("vista-dashboard")?.classList.remove("hidden");
        cargarUltimasLecturas();
    } else if (vista === "perfil") {
        document.getElementById("vista-perfil")?.classList.remove("hidden");
        cargarPerfilUsuario();
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
    document.getElementById("menu-navegacion")?.classList.remove("hidden");
    document.getElementById("usuario-badge")?.classList.remove("hidden");
    document.getElementById("btn-auth-accion")?.classList.remove("hidden");

    const navNombre = document.getElementById("nav-usuario-nombre");
    if (navNombre) navNombre.innerText = nombre;

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

document.addEventListener("DOMContentLoaded", () => {
    document.body.classList.add("login-only");
    installAccessibilityStyles();
    initTextSizeControls();
    comprobarSesion();
});
