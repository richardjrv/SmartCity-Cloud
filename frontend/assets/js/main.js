// ============================================================
// 🚀 ORQUESTRADOR PRINCIPAL Y NAVEGACIÓN
// ============================================================

const TEXT_SIZE_STEPS = [0.875, 1, 1.125, 1.25];
const TEXT_SIZE_STORAGE_KEY = "smartcity_text_size";

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

    const status = document.createElement("span");
    status.id = "text-size-status";
    status.className = "sr-only";
    status.setAttribute("aria-live", "polite");

    group.append(decreaseButton, resetButton, increaseButton, status);
    toolbarParent.insertBefore(group, badge);

    window.textSizeControls = { decreaseButton, increaseButton, status };
    let savedScale = 1;
    try {
        const storedScale = Number(localStorage.getItem(TEXT_SIZE_STORAGE_KEY));
        if (TEXT_SIZE_STEPS.includes(storedScale)) savedScale = storedScale;
    } catch (error) {
        console.warn("No se pudo leer la preferencia de tamaño de texto.", error);
    }
    applyTextSize(savedScale, false);
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

function navegarA(vista) {
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
    initTextSizeControls();
    comprobarSesion();
});
