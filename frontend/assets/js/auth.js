// ============================================================
// 🔐 AUTENTICACIÓN Y SESIÓN
// ============================================================

let modoRegistro = false;

function toggleModoAuth() {
    modoRegistro = !modoRegistro;

    const campoNombre = document.getElementById("campo-nombre");
    const authTitulo = document.getElementById("auth-titulo");
    const authSubtitulo = document.getElementById("auth-subtitulo");
    const authBtnSubmit = document.getElementById("auth-btn-submit");
    const authToggleTexto = document.getElementById("auth-toggle-texto");
    const authToggleBtn = document.getElementById("auth-toggle-btn");

    if (modoRegistro) {
        campoNombre?.classList.remove("hidden");
        if (authTitulo) authTitulo.innerText = "Crear Cuenta";
        if (authSubtitulo) authSubtitulo.innerText = "Regístrate en SmartCity Cloud";
        if (authBtnSubmit) authBtnSubmit.innerText = "Crear Cuenta ➔";
        if (authToggleTexto) authToggleTexto.innerText = "¿Ya tienes una cuenta?";
        if (authToggleBtn) authToggleBtn.innerText = "Iniciar Sesión";
    } else {
        campoNombre?.classList.add("hidden");
        if (authTitulo) authTitulo.innerText = "SmartCity Cloud";
        if (authSubtitulo) authSubtitulo.innerText = "Monitoreo Urbano e IoT en la Nube";
        if (authBtnSubmit) authBtnSubmit.innerText = "Iniciar Sesión ➔";
        if (authToggleTexto) authToggleTexto.innerText = "¿No tienes cuenta?";
        if (authToggleBtn) authToggleBtn.innerText = "Crear una cuenta";
    }
}

async function procesarAuth(e) {
    e.preventDefault();

    const email = document.getElementById("auth-email").value.trim();
    const password = document.getElementById("auth-password").value;

    if (modoRegistro) {
        const nombre = document.getElementById("auth-nombre").value.trim();
        if (!nombre) {
            mostrarMensajeAuth("Por favor ingresa tu nombre.", "error");
            return;
        }

        try {
            // 🔐 Nota: No se envía id_rol. Backend fuerza siempre rol 2
            const { ok, data } = await apiFetch("/registro", {
                method: "POST",
                body: JSON.stringify({ nombre, email, password })
            });

            if (ok) {
                mostrarMensajeAuth("✅ Cuenta creada correctamente. Ahora puedes iniciar sesión.", "success");
                document.getElementById("form-auth")?.reset();
                setTimeout(() => toggleModoAuth(), 1500);
            } else {
                mostrarMensajeAuth(data.detail || "Error al registrar.", "error");
            }
        } catch (error) {
            mostrarMensajeAuth("❌ No se pudo conectar con el servidor.", "error");
        }
    } else {
        try {
            const { ok, data } = await apiFetch("/login", {
                method: "POST",
                body: JSON.stringify({ email, password })
            });

            if (ok) {
                localStorage.setItem("token_cloud", data.access_token);
                localStorage.setItem("user_role_cloud", data.id_rol);
                localStorage.setItem("user_name_cloud", data.nombre);
                localStorage.setItem("user_id_cloud", data.user_id);

                mostrarDashboard(data.nombre, data.id_rol);
            } else {
                mostrarMensajeAuth(data.detail || "Credenciales incorrectas.", "error");
            }
        } catch (error) {
            mostrarMensajeAuth("❌ Error de conexión con el servidor.", "error");
        }
    }
}

function mostrarMensajeAuth(texto, tipo) {
    let msg = document.getElementById("auth-mensaje");
    if (!msg) {
        msg = document.createElement("div");
        msg.id = "auth-mensaje";
        msg.className = "mt-4 text-center text-sm";
        document.getElementById("form-auth")?.appendChild(msg);
    }

    msg.innerText = texto;
    msg.className = tipo === "success"
        ? "mt-4 text-center text-sm text-emerald-400"
        : "mt-4 text-center text-sm text-rose-400";
}

async function comprobarSesion() {
    const token = obtenerToken();
    if (!token) {
        document.getElementById("vista-auth")?.classList.remove("hidden");
        return;
    }

    try {
        const { ok, data } = await apiFetch("/api/perfil");
        if (!ok) {
            cerrarSesion();
            return;
        }

        localStorage.setItem("user_role_cloud", data.id_rol);
        localStorage.setItem("user_name_cloud", data.nombre);
        localStorage.setItem("user_id_cloud", data.id);

        mostrarDashboard(data.nombre, data.id_rol);
    } catch (error) {
        console.error("No se pudo comprobar sesión:", error);
    }
}

function cerrarSesion() {
    localStorage.removeItem("token_cloud");
    localStorage.removeItem("user_role_cloud");
    localStorage.removeItem("user_name_cloud");
    localStorage.removeItem("user_id_cloud");

    // Ocultar vistas
    document.getElementById("vista-dashboard")?.classList.add("hidden");
    document.getElementById("vista-perfil")?.classList.add("hidden");
    document.getElementById("vista-admin-usuarios")?.classList.add("hidden");

    // Mostrar login
    document.getElementById("vista-auth")?.classList.remove("hidden");
    document.getElementById("usuario-badge")?.classList.add("hidden");
    document.getElementById("btn-menu-admin")?.classList.add("hidden");

    if (modoRegistro) toggleModoAuth();
    document.getElementById("form-auth")?.reset();
}