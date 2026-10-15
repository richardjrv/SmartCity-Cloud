// Supabase Auth is proxied through FastAPI; only user access tokens reach the API.
let modoRegistro = false;
let cierreSesionEnCurso = false;
let recoveryAccessToken = null;

// Publishable keys are designed for browser use; no service-role key belongs here.
const SUPABASE_AUTH_URL = "https://lqkobrabircleaprkroz.supabase.co";
const SUPABASE_PUBLISHABLE_KEY = "sb_publishable_rxby7ym-DzgC3cRB0PQxWQ_TYKfumxF";
const supabaseAuthClient = window.supabase?.createClient(
    SUPABASE_AUTH_URL,
    SUPABASE_PUBLISHABLE_KEY,
    {
        auth: {
            flowType: "pkce",
            autoRefreshToken: false,
            detectSessionInUrl: false
        }
    }
);

async function iniciarSesionFacebook() {
    const button = document.getElementById("auth-btn-facebook");
    if (!supabaseAuthClient) {
        mostrarMensajeAuth("No se pudo cargar el inicio de sesión social. Recarga la página e inténtalo otra vez.", "error");
        return;
    }

    button.disabled = true;
    button.setAttribute("aria-busy", "true");
    try {
        const { error } = await supabaseAuthClient.auth.signInWithOAuth({
            provider: "facebook",
            options: {
                redirectTo: `${window.location.origin}${window.location.pathname}`
            }
        });
        if (error) throw error;
    } catch (error) {
        console.error("No se pudo iniciar OAuth con Facebook:", error);
        mostrarMensajeAuth("No se pudo iniciar con Facebook. Revisa la configuración del proveedor e inténtalo otra vez.", "error");
        button.disabled = false;
        button.removeAttribute("aria-busy");
    }
}

function limpiarParametrosOAuth(url) {
    ["code", "state", "error", "error_code", "error_description"].forEach(key => url.searchParams.delete(key));
    window.history.replaceState({}, document.title, `${url.pathname}${url.search}${url.hash}`);
}

async function procesarRetornoFacebook() {
    const url = new URL(window.location.href);
    const providerError = url.searchParams.get("error_description") || url.searchParams.get("error");
    if (providerError) {
        limpiarParametrosOAuth(url);
        mostrarMensajeAuth("Facebook canceló o rechazó el inicio de sesión. Puedes intentarlo de nuevo.", "error");
        return true;
    }

    const code = url.searchParams.get("code");
    if (!code) return false;
    limpiarParametrosOAuth(url);

    if (!supabaseAuthClient) {
        mostrarMensajeAuth("No se pudo completar el inicio de sesión social. Recarga la página e inténtalo otra vez.", "error");
        return true;
    }

    try {
        const { data, error } = await supabaseAuthClient.auth.exchangeCodeForSession(code);
        if (error) throw error;
        const session = data.session;
        if (!session?.access_token || !session?.refresh_token) {
            throw new Error("Supabase no devolvió una sesión válida.");
        }

        localStorage.setItem("token_cloud", session.access_token);
        localStorage.setItem("refresh_token_cloud", session.refresh_token);
        localStorage.setItem("token_expires_cloud", String(session.expires_at || Math.floor(Date.now() / 1000) + Number(session.expires_in || 3600)));

        const response = await fetch(`${API_URL}/api/perfil`, {
            headers: { Authorization: `Bearer ${session.access_token}` },
            cache: "no-store"
        });
        const profile = await response.json().catch(() => ({}));
        if (!response.ok) {
            throw new Error(profile.detail || "Facebook autenticó la cuenta, pero no se pudo cargar su perfil de SmartCity.");
        }

        localStorage.setItem("user_role_cloud", String(profile.id_rol));
        localStorage.setItem("user_name_cloud", profile.nombre || "Usuario");
        localStorage.setItem("user_id_cloud", String(profile.id));
        await entrarAlDashboard(profile.nombre || "Usuario", profile.id_rol);
        return true;
    } catch (error) {
        console.error("No se pudo completar el inicio de sesión con Facebook:", error);
        ["token_cloud", "refresh_token_cloud", "token_expires_cloud", "user_role_cloud", "user_name_cloud", "user_id_cloud"].forEach(key => localStorage.removeItem(key));
        await supabaseAuthClient.auth.signOut({ scope: "local" }).catch(() => {});
        mostrarMensajeAuth(error.message || "No se pudo completar el inicio de sesión con Facebook.", "error");
        return true;
    }
}

function toggleModoAuth() {
    modoRegistro = !modoRegistro;
    const nameField = document.getElementById("campo-nombre");
    const title = document.getElementById("auth-titulo");
    const subtitle = document.getElementById("auth-subtitulo");
    const submit = document.getElementById("auth-btn-submit");
    const toggleText = document.getElementById("auth-toggle-texto");
    const toggleButton = document.getElementById("auth-toggle-btn");
    const password = document.getElementById("auth-password");

    nameField?.classList.toggle("hidden", !modoRegistro);
    const nameInput = document.getElementById("auth-nombre");
    if (nameInput) nameInput.required = modoRegistro;
    if (password) {
        password.autocomplete = modoRegistro ? "new-password" : "current-password";
        password.minLength = modoRegistro ? 8 : 1;
    }
    if (title) title.textContent = modoRegistro ? "Crear Cuenta" : "SmartCity Cloud";
    if (subtitle) subtitle.textContent = modoRegistro ? "Regístrate en SmartCity Cloud" : "Monitoreo Urbano e IoT en la Nube";
    if (submit) submit.textContent = modoRegistro ? "Crear Cuenta ➔" : "Iniciar Sesión ➔";
    if (toggleText) toggleText.textContent = modoRegistro ? "¿Ya tienes una cuenta?" : "¿No tienes cuenta?";
    if (toggleButton) toggleButton.textContent = modoRegistro ? "Iniciar Sesión" : "Crear una cuenta";
    document.getElementById("auth-forgot-password")?.classList.toggle("hidden", modoRegistro);
    mostrarFormularioAuth("form-auth");
    ocultarPasswordAuth();
    document.getElementById("form-auth")?.reset();
    limpiarMensajeAuth();
}

function togglePasswordVisibility() {
    const input = document.getElementById("auth-password");
    const button = document.getElementById("toggle-password-visibility");
    const label = button?.querySelector("[data-password-toggle-label]");
    if (!input || !button) return;
    const show = input.type === "password";
    input.type = show ? "text" : "password";
    const accessibleName = show ? "Ocultar contraseña" : "Mostrar contraseña";
    button.setAttribute("aria-label", accessibleName);
    button.setAttribute("title", accessibleName);
    button.setAttribute("aria-pressed", String(show));
    if (label) label.textContent = show ? "Ocultar" : "Mostrar";
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

function mostrarFormularioAuth(id) {
    ["form-auth", "form-recovery-request", "form-recovery-password"].forEach(formId => {
        document.getElementById(formId)?.classList.toggle("hidden", formId !== id);
    });
    document.getElementById("auth-toggle-container")?.classList.toggle("hidden", id !== "form-auth");
}

async function procesarAuth(event) {
    event.preventDefault();
    const email = document.getElementById("auth-email")?.value.trim();
    const password = document.getElementById("auth-password")?.value;
    const button = document.getElementById("auth-btn-submit");
    if (!email || !password) return;
    if (modoRegistro && password.length < 8) {
        mostrarMensajeAuth("La contraseña debe tener al menos 8 caracteres.", "error");
        return;
    }

    button.disabled = true;
    button.textContent = modoRegistro ? "Creando cuenta…" : "Verificando…";
    try {
        if (modoRegistro) {
            const nombre = document.getElementById("auth-nombre")?.value.trim();
            if (!nombre) {
                mostrarMensajeAuth("Ingresa tu nombre.", "error");
                return;
            }
            const { ok, data } = await apiFetch("/registro", {
                method: "POST",
                body: JSON.stringify({ nombre, email, password })
            });
            if (!ok) {
                mostrarMensajeAuth(data.detail || "No se pudo crear la cuenta.", "error");
                return;
            }
            mostrarMensajeAuth(data.mensaje || "Cuenta creada. Revisa tu correo para confirmarla.", "success");
            document.getElementById("form-auth")?.reset();
            window.setTimeout(() => {
                if (modoRegistro) toggleModoAuth();
            }, 1800);
            return;
        }

        const { ok, data } = await apiFetch("/login", {
            method: "POST",
            body: JSON.stringify({ email, password })
        });
        if (!ok) {
            mostrarMensajeAuth(data.detail || "No se pudo iniciar sesión.", "error");
            return;
        }
        guardarSesionSupabase(data);
        document.getElementById("auth-password").value = "";
        await entrarAlDashboard(data.nombre, data.id_rol);
    } catch (error) {
        mostrarMensajeAuth("No se pudo conectar con el servidor. Inténtalo otra vez.", "error");
    } finally {
        button.disabled = false;
        button.textContent = modoRegistro ? "Crear Cuenta ➔" : "Iniciar Sesión ➔";
    }
}

function guardarSesionSupabase(data) {
    if (!data?.access_token || !data?.refresh_token) throw new Error("Respuesta de sesión incompleta.");
    localStorage.setItem("token_cloud", data.access_token);
    localStorage.setItem("refresh_token_cloud", data.refresh_token);
    localStorage.setItem("token_expires_cloud", String(Math.floor(Date.now() / 1000) + Number(data.expires_in || 3600)));
    localStorage.setItem("user_role_cloud", String(data.id_rol));
    localStorage.setItem("user_name_cloud", data.nombre || "Usuario");
    localStorage.setItem("user_id_cloud", String(data.id));
}

async function entrarAlDashboard(nombre, role) {
    const overlay = document.getElementById("auth-loading-overlay");
    overlay?.classList.remove("hidden");
    document.body.classList.add("auth-loading-active");
    mostrarDashboard(nombre, role);
    await new Promise(resolve => window.setTimeout(resolve, 700));
    overlay?.classList.add("hidden");
    document.body.classList.remove("auth-loading-active");
}

function mostrarRecuperarPassword() {
    document.getElementById("recovery-email").value = document.getElementById("auth-email")?.value.trim() || "";
    document.getElementById("recovery-status").textContent = "";
    mostrarFormularioAuth("form-recovery-request");
}

function volverAlAcceso() {
    mostrarFormularioAuth("form-auth");
}

async function procesarSolicitudRecuperacion(event) {
    event.preventDefault();
    const status = document.getElementById("recovery-status");
    status.textContent = "Enviando…";
    status.className = "min-h-5 text-center text-sm text-slate-300";
    try {
        const { ok, data } = await apiFetch("/recuperar-password", {
            method: "POST",
            body: JSON.stringify({ email: document.getElementById("recovery-email").value.trim() })
        });
        status.textContent = ok ? data.mensaje : (data.detail || "No se pudo enviar el enlace.");
        status.className = `min-h-5 text-center text-sm ${ok ? "text-emerald-400" : "text-rose-400"}`;
    } catch {
        status.textContent = "No se pudo conectar con el servidor.";
        status.className = "min-h-5 text-center text-sm text-rose-400";
    }
}

async function procesarNuevaPassword(event) {
    event.preventDefault();
    const status = document.getElementById("recovery-new-status");
    const password = document.getElementById("recovery-new-password").value;
    if (!recoveryAccessToken) {
        status.textContent = "El enlace venció o no es válido. Solicita otro.";
        return;
    }
    status.textContent = "Guardando…";
    try {
        const { ok, data } = await apiFetch("/establecer-password", {
            method: "POST",
            body: JSON.stringify({ access_token: recoveryAccessToken, password_nueva: password })
        });
        status.textContent = ok ? data.mensaje : (data.detail || "No se pudo cambiar la contraseña.");
        status.className = `min-h-5 text-center text-sm ${ok ? "text-emerald-400" : "text-rose-400"}`;
        if (ok) {
            recoveryAccessToken = null;
            window.history.replaceState({}, document.title, window.location.pathname + window.location.search);
            document.getElementById("form-recovery-password")?.reset();
            window.setTimeout(() => {
                mostrarFormularioAuth("form-auth");
                status.textContent = "";
            }, 1800);
        }
    } catch {
        status.textContent = "No se pudo conectar con el servidor.";
        status.className = "min-h-5 text-center text-sm text-rose-400";
    }
}

function prepararRecuperacionAuth() {
    const hash = new URLSearchParams(window.location.hash.replace(/^#/, ""));
    const token = hash.get("access_token");
    if (hash.get("type") !== "recovery" || !token) return false;
    recoveryAccessToken = token;
    localStorage.removeItem("token_cloud");
    localStorage.removeItem("refresh_token_cloud");
    localStorage.removeItem("token_expires_cloud");
    mostrarFormularioAuth("form-recovery-password");
    navegarA("auth");
    return true;
}

function mostrarMensajeAuth(texto, tipo) {
    let msg = document.getElementById("auth-mensaje");
    if (!msg) {
        msg = document.createElement("div");
        msg.id = "auth-mensaje";
        msg.className = "mt-4 text-center text-sm";
        document.getElementById("form-auth")?.appendChild(msg);
    }
    msg.textContent = texto;
    msg.className = tipo === "success"
        ? "mt-4 text-center text-sm text-emerald-400"
        : "mt-4 text-center text-sm text-rose-400";
}

function limpiarMensajeAuth() {
    document.getElementById("auth-mensaje")?.remove();
}

async function comprobarSesion() {
    if (await procesarRetornoFacebook()) return;
    if (prepararRecuperacionAuth()) return;
    if (!obtenerToken()) {
        navegarA("auth");
        void precalentarAPI();
        return;
    }
    try {
        const { ok, data } = await apiFetch("/api/perfil");
        if (!ok) {
            await cerrarSesion();
            return;
        }
        localStorage.setItem("user_role_cloud", String(data.id_rol));
        localStorage.setItem("user_name_cloud", data.nombre);
        localStorage.setItem("user_id_cloud", String(data.id));
        mostrarDashboard(data.nombre, data.id_rol);
    } catch (error) {
        console.error("No se pudo comprobar la sesión:", error);
        await cerrarSesion(false);
    }
}

async function cerrarSesion(notifyServer = true) {
    if (cierreSesionEnCurso) return;
    cierreSesionEnCurso = true;
    if (notifyServer && obtenerToken()) {
        try {
            await fetch(`${API_URL}/logout`, {
                method: "POST",
                headers: { Authorization: `Bearer ${obtenerToken()}` }
            });
        } catch { /* La sesión local se limpia aunque el servidor no responda. */ }
    }
    if (typeof detenerEscuchaWakeBrunito === "function") detenerEscuchaWakeBrunito();
    ["token_cloud", "refresh_token_cloud", "token_expires_cloud", "user_role_cloud", "user_name_cloud", "user_id_cloud"].forEach(key => localStorage.removeItem(key));
    recoveryAccessToken = null;
    if (modoRegistro) toggleModoAuth();
    ocultarPasswordAuth();
    document.getElementById("form-auth")?.reset();
    const overlay = document.getElementById("auth-loading-overlay");
    const title = overlay?.querySelector(".auth-loading-card strong");
    const message = overlay?.querySelector(".auth-loading-card p");
    if (overlay) {
        overlay.classList.remove("hidden");
        if (title) title.textContent = "Sesión cerrada";
        if (message) message.textContent = "Volviendo al acceso de forma segura…";
        document.body.classList.add("auth-loading-active");
    }
    await new Promise(resolve => window.setTimeout(resolve, 450));
    navegarA("auth");
    overlay?.classList.add("hidden");
    document.body.classList.remove("auth-loading-active");
    cierreSesionEnCurso = false;
}
