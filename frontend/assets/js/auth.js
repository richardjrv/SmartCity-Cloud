// Supabase Auth is proxied through FastAPI; only user access tokens reach the API.
let modoRegistro = false;
let cierreSesionEnCurso = false;
let recoveryAccessToken = null;
let retoPinActual = null;
let configurarPinActual = false;
let sesionPendientePin = null;

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
    return iniciarSesionSocial("facebook", "auth-btn-facebook");
}

async function iniciarSesionGoogle() {
    return iniciarSesionSocial("google", "auth-btn-google");
}

async function iniciarSesionSocial(provider, buttonId) {
    const button = document.getElementById(buttonId);
    if (!supabaseAuthClient) {
        mostrarMensajeAuth("No se pudo cargar el inicio de sesión social. Recarga la página e inténtalo otra vez.", "error");
        return;
    }

    button.disabled = true;
    button.setAttribute("aria-busy", "true");
    try {
        const { error } = await supabaseAuthClient.auth.signInWithOAuth({
            provider,
            options: {
                redirectTo: `${window.location.origin}${window.location.pathname}`
            }
        });
        if (error) throw error;
    } catch (error) {
        console.error(`No se pudo iniciar OAuth con ${provider}:`, error);
        const nombreProveedor = provider === "google" ? "Google" : "Facebook";
        mostrarMensajeAuth(`No se pudo iniciar con ${nombreProveedor}. Revisa la configuración del proveedor e inténtalo otra vez.`, "error");
        button.disabled = false;
        button.removeAttribute("aria-busy");
    }
}

function limpiarParametrosOAuth(url) {
    ["code", "state", "error", "error_code", "error_description"].forEach(key => url.searchParams.delete(key));
    window.history.replaceState({}, document.title, `${url.pathname}${url.search}${url.hash}`);
}

function activarCamposPin(grupo, activar) {
    document.querySelectorAll(`[data-pin-group="${grupo}"] .pin-digit`).forEach(campo => {
        campo.required = activar;
    });
}

function obtenerPin(grupoNombre) {
    const grupo = document.querySelector(`[data-pin-group="${grupoNombre}"]`);
    return grupo ? Array.from(grupo.querySelectorAll(".pin-digit")).map(campo => campo.value).join("") : "";
}

function limpiarPin(grupoNombre) {
    document.querySelectorAll(`[data-pin-group="${grupoNombre}"] .pin-digit`).forEach(campo => { campo.value = ""; });
}

function distribuirPin(grupo, valor, inicio) {
    const campos = Array.from(grupo.querySelectorAll(".pin-digit"));
    const digitos = valor.replace(/\D/g, "");
    campos.slice(inicio).forEach((campo, indice) => { campo.value = digitos[indice] || ""; });
    campos[Math.min(inicio + digitos.length, campos.length - 1)]?.focus();
}

function inicializarCamposPin() {
    document.querySelectorAll("[data-pin-group]").forEach(grupo => {
        const campos = Array.from(grupo.querySelectorAll(".pin-digit"));
        campos.forEach((campo, indice) => {
            campo.addEventListener("input", () => {
                const valor = campo.value.replace(/\D/g, "");
                if (valor.length > 1) {
                    distribuirPin(grupo, valor, indice);
                    return;
                }
                campo.value = valor;
                if (valor && indice < campos.length - 1) campos[indice + 1].focus();
            });
            campo.addEventListener("keydown", evento => {
                if (evento.key === "Backspace" && !campo.value && indice > 0) campos[indice - 1].focus();
            });
            campo.addEventListener("paste", evento => {
                const digitos = (evento.clipboardData?.getData("text") || "").replace(/\D/g, "");
                if (!digitos) return;
                evento.preventDefault();
                distribuirPin(grupo, digitos, indice);
            });
        });
    });
    activarCamposPin("pin-confirm", false);
}

async function iniciarPasoPinOAuth(session) {
    try {
        const response = await fetch(`${API_URL}/pin/iniciar`, {
            method: "POST",
            headers: { Authorization: `Bearer ${session.access_token}` }
        });
        const data = await response.json().catch(() => ({}));
        if (!response.ok) throw new Error(data.detail || "No se pudo iniciar la verificación del PIN.");
        sesionPendientePin = {
            access_token: session.access_token,
            refresh_token: session.refresh_token,
            expires_in: session.expires_in,
            expires_at: session.expires_at
        };
        retoPinActual = data.challenge_token;
        configurarPinActual = Boolean(data.configurar_pin);
        mostrarPasoPin(data.nombre);
        return true;
    } catch (error) {
        console.error("No se pudo iniciar la verificación PIN de la sesión social:", error);
        await supabaseAuthClient.auth.signOut({ scope: "local" }).catch(() => {});
        mostrarMensajeAuth(error.message || "No se pudo iniciar la verificación PIN.", "error");
        return true;
    }
}

async function procesarRetornoOAuth() {
    const url = new URL(window.location.href);
    const providerError = url.searchParams.get("error_description") || url.searchParams.get("error");
    if (providerError) {
        limpiarParametrosOAuth(url);
        mostrarMensajeAuth("El proveedor de inicio de sesión canceló o rechazó la solicitud. Puedes intentarlo de nuevo.", "error");
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
        return await iniciarPasoPinOAuth(session);
    } catch (error) {
        console.error("No se pudo completar el inicio de sesión social:", error);
        ["token_cloud", "refresh_token_cloud", "token_expires_cloud", "user_role_cloud", "user_name_cloud", "user_id_cloud"].forEach(key => localStorage.removeItem(key));
        await supabaseAuthClient.auth.signOut({ scope: "local" }).catch(() => {});
        mostrarMensajeAuth(error.message || "No se pudo completar el inicio de sesión social.", "error");
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
    ["form-auth", "campo-pin", "form-recovery-request", "form-recovery-password"].forEach(formId => {
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
        document.getElementById("auth-password").value = "";
        if (!data.requiere_pin || !data.challenge_token || !data.access_token || !data.refresh_token) {
            throw new Error("El servidor no inició la verificación del PIN. Inténtalo de nuevo.");
        }
        sesionPendientePin = data;
        retoPinActual = data.challenge_token;
        configurarPinActual = Boolean(data.configurar_pin);
        mostrarPasoPin(data.nombre);
    } catch (error) {
        mostrarMensajeAuth(error.message || "No se pudo conectar con el servidor. Inténtalo otra vez.", "error");
    } finally {
        button.disabled = false;
        button.textContent = modoRegistro ? "Crear Cuenta ➔" : "Iniciar Sesión ➔";
    }
}

function mostrarPasoPin(nombre = "") {
    document.getElementById("form-auth")?.classList.add("hidden");
    const formularioPin = document.getElementById("campo-pin");
    formularioPin?.classList.remove("hidden");
    const card = document.querySelector(".auth-card");
    card?.classList.remove("auth-mode-animate");
    void card?.offsetWidth;
    card?.classList.add("auth-mode-animate");
    document.getElementById("auth-toggle-container")?.classList.add("hidden");

    const title = document.getElementById("pin-step-title");
    const description = document.getElementById("pin-step-description");
    const button = document.getElementById("pin-step-submit");
    const confirmation = document.getElementById("pin-confirmation-fields");
    const status = document.getElementById("pin-step-status");
    if (title) title.textContent = configurarPinActual ? "Crea tu PIN personal" : "Verifica tu acceso";
    if (description) {
        description.textContent = configurarPinActual
            ? `Hola${nombre ? `, ${nombre}` : ""}. Elige un PIN personal de cuatro cifras para proteger tu cuenta.`
            : "Ingresa tu PIN personal de cuatro cifras para completar el inicio de sesión.";
    }
    if (button) button.textContent = configurarPinActual ? "Guardar PIN y continuar" : "Verificar PIN";
    confirmation?.classList.toggle("hidden", !configurarPinActual);
    activarCamposPin("pin-confirm", configurarPinActual);
    limpiarPin("pin-login");
    limpiarPin("pin-confirm");
    if (status) status.textContent = "";
    document.querySelector('[data-pin-group="pin-login"] .pin-digit')?.focus();
}

async function procesarPasoPin(event) {
    event.preventDefault();
    if (!retoPinActual || !sesionPendientePin?.access_token) {
        cancelarPasoPin("La verificación venció. Inicia sesión nuevamente.");
        return;
    }
    const pin = obtenerPin("pin-login");
    const confirmation = obtenerPin("pin-confirm");
    const status = document.getElementById("pin-step-status");
    const button = document.getElementById("pin-step-submit");
    if (!/^[0-9]{4}$/.test(pin)) {
        if (status) status.textContent = "Ingresa los cuatro números de tu PIN.";
        return;
    }
    if (configurarPinActual && pin !== confirmation) {
        if (status) status.textContent = "Los PIN no coinciden.";
        return;
    }

    if (button) button.disabled = true;
    if (status) status.textContent = "";
    const endpoint = configurarPinActual ? "/pin/establecer" : "/pin/verificar";
    try {
        const response = await fetch(`${API_URL}${endpoint}`, {
            method: "POST",
            headers: {
                "Content-Type": "application/json",
                Authorization: `Bearer ${sesionPendientePin.access_token}`
            },
            body: JSON.stringify({ challenge_token: retoPinActual, pin })
        });
        const data = await response.json().catch(() => ({}));
        if (!response.ok) {
            if (response.status === 401 && !String(data.detail || "").startsWith("PIN incorrecto")) {
                cancelarPasoPin(data.detail || "La verificación venció. Inicia sesión nuevamente.");
                return;
            }
            if (response.status === 429) {
                cancelarPasoPin(data.detail || "Se alcanzó el límite de intentos. Vuelve a iniciar sesión más tarde.");
                return;
            }
            if (status) status.textContent = data.detail || "No se pudo verificar el PIN.";
            limpiarPin("pin-login");
            document.querySelector('[data-pin-group="pin-login"] .pin-digit')?.focus();
            return;
        }
        completarInicioSesion(data);
    } catch (error) {
        if (status) status.textContent = "No se pudo conectar con el servidor. Inténtalo nuevamente.";
    } finally {
        if (button?.isConnected) button.disabled = false;
    }
}

function completarInicioSesion(profile) {
    const session = sesionPendientePin;
    if (!session) return;
    guardarSesionSupabase({
        ...profile,
        access_token: session.access_token,
        refresh_token: session.refresh_token,
        expires_in: session.expires_in,
        expires_at: session.expires_at
    });
    retoPinActual = null;
    configurarPinActual = false;
    sesionPendientePin = null;
    limpiarPin("pin-login");
    limpiarPin("pin-confirm");
    document.getElementById("campo-pin")?.classList.add("hidden");
    document.getElementById("auth-toggle-container")?.classList.remove("hidden");
    void entrarAlDashboard(profile.nombre || "Usuario", profile.id_rol);
}

function cancelarPasoPin(mensaje = "") {
    const pending = sesionPendientePin;
    retoPinActual = null;
    configurarPinActual = false;
    sesionPendientePin = null;
    limpiarPin("pin-login");
    limpiarPin("pin-confirm");
    activarCamposPin("pin-confirm", false);
    document.getElementById("campo-pin")?.classList.add("hidden");
    document.getElementById("form-auth")?.classList.remove("hidden");
    document.getElementById("auth-toggle-container")?.classList.remove("hidden");
    if (pending) {
        void fetch(`${API_URL}/logout`, {
            method: "POST",
            headers: { Authorization: `Bearer ${pending.access_token}` }
        }).catch(() => {});
        ["token_cloud", "refresh_token_cloud", "token_expires_cloud", "user_role_cloud", "user_name_cloud", "user_id_cloud"].forEach(key => localStorage.removeItem(key));
        void supabaseAuthClient?.auth.signOut({ scope: "local" });
    }
    if (mensaje) mostrarMensajeAuth(mensaje, "error");
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
    const pin = document.getElementById("recovery-new-pin").value;
    const pinConfirmation = document.getElementById("recovery-confirm-pin").value;
    if (!recoveryAccessToken) {
        status.textContent = "El enlace venció o no es válido. Solicita otro.";
        return;
    }
    if (!/^[0-9]{4}$/.test(pin)) {
        status.textContent = "El PIN debe tener exactamente cuatro números.";
        return;
    }
    if (pin !== pinConfirmation) {
        status.textContent = "Los PIN no coinciden.";
        return;
    }
    status.textContent = "Guardando…";
    try {
        const { ok, data } = await apiFetch("/establecer-password", {
            method: "POST",
            body: JSON.stringify({ access_token: recoveryAccessToken, password_nueva: password, pin_nuevo: pin })
        });
        status.textContent = ok ? data.mensaje : (data.detail || "No se pudo cambiar la contraseña.");
        status.className = `min-h-5 text-center text-sm ${ok ? "text-emerald-400" : "text-rose-400"}`;
        if (ok) {
            recoveryAccessToken = null;
            window.history.replaceState({}, document.title, window.location.pathname + window.location.search);
            document.getElementById("form-recovery-password")?.reset();
            await supabaseAuthClient?.auth.signOut({ scope: "local" }).catch(() => {});
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
    if (await procesarRetornoOAuth()) return;
    if (prepararRecuperacionAuth()) return;
    if (!obtenerToken()) {
        if (supabaseAuthClient) {
            const { data } = await supabaseAuthClient.auth.getSession();
            if (data.session?.access_token) {
                await iniciarPasoPinOAuth(data.session);
                return;
            }
        }
        navegarA("auth");
        void precalentarAPI();
        return;
    }
    try {
        const { ok, status, data } = await apiFetch("/api/perfil");
        if (!ok) {
            if (status === 428) {
                sesionPendientePin = {
                    access_token: obtenerToken(),
                    refresh_token: localStorage.getItem("refresh_token_cloud"),
                    expires_in: Number(localStorage.getItem("token_expires_cloud") || 0) - Math.floor(Date.now() / 1000)
                };
                const response = await fetch(`${API_URL}/pin/iniciar`, {
                    method: "POST",
                    headers: { Authorization: `Bearer ${sesionPendientePin.access_token}` }
                });
                const pinInfo = await response.json().catch(() => ({}));
                if (!response.ok) {
                    cancelarPasoPin(pinInfo.detail || "No se pudo iniciar la verificación del PIN.");
                    navegarA("auth");
                    return;
                }
                retoPinActual = pinInfo.challenge_token;
                configurarPinActual = Boolean(pinInfo.configurar_pin);
                mostrarPasoPin(pinInfo.nombre);
                return;
            }
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
    await supabaseAuthClient?.auth.signOut({ scope: "local" }).catch(() => {});
    if (typeof detenerEscuchaWakeBrunito === "function") detenerEscuchaWakeBrunito();
    ["token_cloud", "refresh_token_cloud", "token_expires_cloud", "user_role_cloud", "user_name_cloud", "user_id_cloud"].forEach(key => localStorage.removeItem(key));
    recoveryAccessToken = null;
    retoPinActual = null;
    configurarPinActual = false;
    sesionPendientePin = null;
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
