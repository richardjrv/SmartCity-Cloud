// ============================================================
// 🚀 ORQUESTRADOR PRINCIPAL Y NAVEGACIÓN
// ============================================================

function navegarA(vista) {
    // Ocultar todas las secciones
    document.getElementById("vista-dashboard")?.classList.add("hidden");
    document.getElementById("vista-perfil")?.classList.add("hidden");
    document.getElementById("vista-admin-usuarios")?.classList.add("hidden");
    document.getElementById("vista-auth")?.classList.add("hidden");

    // Mostrar vista seleccionada
    if (vista === "dashboard") {
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
    } else if (vista === "auth") {
        document.getElementById("vista-auth")?.classList.remove("hidden");
    }
}

function mostrarDashboard(nombre, idRol) {
    document.getElementById("vista-auth")?.classList.add("hidden");
    document.getElementById("vista-dashboard")?.classList.remove("hidden");

    const navNombre = document.getElementById("nav-usuario-nombre");
    if (navNombre) navNombre.innerText = nombre;

    document.getElementById("usuario-badge")?.classList.remove("hidden");
    document.getElementById("btn-auth-accion")?.classList.remove("hidden");

    const btnAdmin = document.getElementById("btn-menu-admin");
    if (btnAdmin) {
        if (Number(idRol) === 1) {
            btnAdmin.classList.remove("hidden");
        } else {
            btnAdmin.classList.add("hidden");
        }
    }

    cargarUltimasLecturas();
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

// Inicialización de la aplicación
document.addEventListener("DOMContentLoaded", () => {
    comprobarSesion();
});