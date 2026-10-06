// ============================================================
// 🔐 AUTENTICACIÓN Y SESIÓN
// ============================================================

let modoRegistro = false;

function toggleModoAuth() {
    modoRegistro = !modoRegistro;
    ocultarPasswordAuth();

    const campoNombre = document.getElementById("campo-nombre");
    const authTitulo = document.getElementById("auth-titulo");
    const authSubtitulo = document.getElementById("auth-subtitulo");
    const authBtnSubmit = document.getElementById("auth-btn-submit");
    const authToggleTexto = document.getElementById("auth-toggle-texto");
    const authToggleBtn = document.getElementById("auth-toggle-btn");
    const passwordInput = document.getElementById("auth-password");

    if (passwordInput) passwordInput.autocomplete = modoRegistro ? "new-password" : "current-password";

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

function togglePasswordVisibility() {
    const input = document.getElementById("auth-password");
    const button = document.getElementById("toggle-password-visibility");
    const label = button?.querySelector("[data-password-toggle-label]");
    if (!input || !button) return;

    const mostrar = input.type === "password";
    input.type = mostrar ? "text" : "password";
    const accessibleName = mostrar ? "Ocultar contraseña" : "Mostrar contraseña";
    button.setAttribute("aria-label", accessibleName);
    button.setAttribute("title", accessibleName);
    button.setAttribute("aria-pressed", String(mostrar));
    if (label) label.textContent = mostrar ? "Ocultar" : "Mostrar";
}

function ocultarPasswordAuth() {
    const input = document.getElementById("auth-password");
    if (input) input.type = "password";
    const button = document.getElementById("toggle-password-visibility");
    if (!button) return;
    button.setAttribute("aria-label", "Mostrar contraseña");
    button.setAttribute("title", "Mostrar contraseña");
    button.setAttribute("aria-pressed", "false");
    const label = button.querySelector("[data-password-toggle-label]");
    if (label) label.textContent = "Mostrar";
}

async function procesarAuth(e) {
    e.preventDefault();

    const email = document.getElementById("auth-email").value.trim();
    const password = document.getElementById("auth-password").value;
    ocultarPasswordAuth();

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
        navegarA("auth");
        void precalentarAPI();
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
        cerrarSesion();
    }
}

function cerrarSesion() {
    localStorage.removeItem("token_cloud");
    localStorage.removeItem("user_role_cloud");
    localStorage.removeItem("user_name_cloud");
    localStorage.removeItem("user_id_cloud");

    if (modoRegistro) toggleModoAuth();
    ocultarPasswordAuth();
    document.getElementById("form-auth")?.reset();

    // Redirige al login y oculta todo el header
    navegarA("auth");
}
