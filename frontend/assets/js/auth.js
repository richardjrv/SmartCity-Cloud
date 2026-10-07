// ============================================================
// AUTENTICACIÓN Y SESIÓN
// ============================================================

let modoRegistro = false;
let retoPinActual = null;
let configurarPinActual = false;

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
                if (evento.key === "Backspace" && !campo.value && indice > 0) {
                    campos[indice - 1].focus();
                }
            });

            campo.addEventListener("paste", evento => {
                const texto = evento.clipboardData?.getData("text") || "";
                const digitos = texto.replace(/\D/g, "");
                if (!digitos) return;
                evento.preventDefault();
                distribuirPin(grupo, digitos, indice);
            });
        });
    });

    establecerCamposObligatorios("[data-pin-group='registro-pin']", false);
    establecerCamposObligatorios("[data-pin-group='registro-pin-confirmacion']", false);
    establecerCamposObligatorios("[data-pin-group='login-pin-confirmacion']", false);
}

function distribuirPin(grupo, valor, inicio) {
    const campos = Array.from(grupo.querySelectorAll(".pin-digit"));
    const digitos = valor.replace(/\D/g, "");
    campos.slice(inicio).forEach((campo, indice) => {
        campo.value = digitos[indice] || "";
    });

    const indiceEnfoque = Math.min(inicio + digitos.length, campos.length - 1);
    campos[indiceEnfoque]?.focus();
}

function obtenerPin(nombreGrupo) {
    const grupo = document.querySelector(`[data-pin-group="${nombreGrupo}"]`);
    return grupo
        ? Array.from(grupo.querySelectorAll(".pin-digit")).map(campo => campo.value).join("")
        : "";
}

function limpiarPin(nombreGrupo) {
    const grupo = document.querySelector(`[data-pin-group="${nombreGrupo}"]`);
    grupo?.querySelectorAll(".pin-digit").forEach(campo => {
        campo.value = "";
    });
}

function establecerCamposObligatorios(selector, obligatorios) {
    document.querySelectorAll(`${selector} .pin-digit`).forEach(campo => {
        campo.required = obligatorios;
    });
}

function toggleModoAuth() {
    modoRegistro = !modoRegistro;
    ocultarPasswordAuth();

    const campoNombre = document.getElementById("campo-nombre");
    const campoPin = document.getElementById("campo-pin");
    const authTitulo = document.getElementById("auth-titulo");
    const authSubtitulo = document.getElementById("auth-subtitulo");
    const authBtnSubmit = document.getElementById("auth-btn-submit");
    const authToggleTexto = document.getElementById("auth-toggle-texto");
    const authToggleBtn = document.getElementById("auth-toggle-btn");
    const passwordInput = document.getElementById("auth-password");

    if (passwordInput) passwordInput.autocomplete = modoRegistro ? "new-password" : "current-password";

    campoNombre?.classList.toggle("hidden", !modoRegistro);
    campoPin?.classList.toggle("hidden", !modoRegistro);
    establecerCamposObligatorios("[data-pin-group='registro-pin']", modoRegistro);
    establecerCamposObligatorios("[data-pin-group='registro-pin-confirmacion']", modoRegistro);
    limpiarPin("registro-pin");
    limpiarPin("registro-pin-confirmacion");

    if (modoRegistro) {
        if (authTitulo) authTitulo.innerText = "Crear Cuenta";
        if (authSubtitulo) authSubtitulo.innerText = "Regístrate en SmartCity Cloud";
        if (authBtnSubmit) authBtnSubmit.innerText = "Crear Cuenta ➔";
        if (authToggleTexto) authToggleTexto.innerText = "¿Ya tienes una cuenta?";
        if (authToggleBtn) authToggleBtn.innerText = "Iniciar Sesión";
    } else {
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
        const pin = obtenerPin("registro-pin");
        const pinConfirmacion = obtenerPin("registro-pin-confirmacion");
        if (!nombre) {
            mostrarMensajeAuth("Por favor ingresa tu nombre.", "error");
            return;
        }
        if (!/^[0-9]{4}$/.test(pin)) {
            mostrarMensajeAuth("El PIN debe tener exactamente cuatro números.", "error");
            return;
        }
        if (pin !== pinConfirmacion) {
            mostrarMensajeAuth("Los PIN no coinciden.", "error");
            return;
        }

        try {
            const { ok, data } = await apiFetch("/registro", {
                method: "POST",
                body: JSON.stringify({ nombre, email, password, pin })
            });

            if (ok) {
                mostrarMensajeAuth("✅ Cuenta creada correctamente. Ahora puedes iniciar sesión.", "success");
                document.getElementById("form-auth")?.reset();
                limpiarPin("registro-pin");
                limpiarPin("registro-pin-confirmacion");
                setTimeout(() => toggleModoAuth(), 1500);
            } else {
                mostrarMensajeAuth(data.detail || "Error al registrar.", "error");
            }
        } catch (error) {
            mostrarMensajeAuth("❌ No se pudo conectar con el servidor.", "error");
        }
        return;
    }

    try {
        const { ok, data } = await apiFetch("/login", {
            method: "POST",
            body: JSON.stringify({ email, password })
        });

        if (!ok) {
            mostrarMensajeAuth(data.detail || "Credenciales incorrectas.", "error");
            return;
        }

        if (!data.requiere_pin || typeof data.challenge_token !== "string") {
            mostrarMensajeAuth("El servidor no inició la verificación del PIN. Inténtalo de nuevo.", "error");
            return;
        }

        retoPinActual = data.challenge_token;
        configurarPinActual = Boolean(data.configurar_pin);
        mostrarPasoPin(data.nombre);
    } catch (error) {
        mostrarMensajeAuth("❌ Error de conexión con el servidor.", "error");
    }
}

function mostrarPasoPin(nombre) {
    const formularioAuth = document.getElementById("form-auth");
    const formularioPin = document.getElementById("form-pin-step");
    const contenedorToggle = document.getElementById("auth-toggle-container");
    const titulo = document.getElementById("pin-step-title");
    const descripcion = document.getElementById("pin-step-description");
    const boton = document.getElementById("pin-step-submit");
    const confirmacion = document.getElementById("pin-confirmation-fields");
    const estado = document.getElementById("pin-step-status");

    formularioAuth?.classList.add("hidden");
    formularioPin?.classList.remove("hidden");
    contenedorToggle?.classList.add("hidden");
    if (titulo) titulo.textContent = configurarPinActual ? "Crea tu PIN de acceso" : "Verifica tu acceso";
    if (descripcion) {
        descripcion.textContent = configurarPinActual
            ? `Hola${nombre ? `, ${nombre}` : ""}. Elige un PIN de cuatro cifras para proteger tu cuenta.`
            : "Ingresa tu PIN de cuatro cifras para completar el inicio de sesión.";
    }
    if (boton) boton.textContent = configurarPinActual ? "Guardar PIN y continuar" : "Verificar PIN";
    confirmacion?.classList.toggle("hidden", !configurarPinActual);
    establecerCamposObligatorios("[data-pin-group='login-pin-confirmacion']", configurarPinActual);
    limpiarPin("login-pin");
    limpiarPin("login-pin-confirmacion");
    if (estado) estado.textContent = "";
    document.querySelector("[data-pin-group='login-pin'] .pin-digit")?.focus();
}

async function procesarPasoPin(evento) {
    evento.preventDefault();
    if (!retoPinActual) {
        cancelarPasoPin("La verificación venció. Inicia sesión nuevamente.");
        return;
    }

    const pin = obtenerPin("login-pin");
    const pinConfirmacion = obtenerPin("login-pin-confirmacion");
    const estado = document.getElementById("pin-step-status");
    const boton = document.getElementById("pin-step-submit");
    if (!/^[0-9]{4}$/.test(pin)) {
        if (estado) estado.textContent = "Ingresa los cuatro números de tu PIN.";
        return;
    }
    if (configurarPinActual && pin !== pinConfirmacion) {
        if (estado) estado.textContent = "Los PIN no coinciden.";
        return;
    }

    const endpoint = configurarPinActual ? "/login/establecer-pin" : "/login/verificar-pin";
    if (boton) boton.disabled = true;
    if (estado) estado.textContent = "";

    try {
        const { ok, status, data } = await apiFetch(endpoint, {
            method: "POST",
            body: JSON.stringify({ challenge_token: retoPinActual, pin })
        });

        if (ok) {
            completarInicioSesion(data);
            return;
        }

        if (status === 401 && !String(data.detail || "").startsWith("PIN incorrecto")) {
            cancelarPasoPin(data.detail || "La verificación venció. Inicia sesión nuevamente.");
            return;
        }
        if (status === 429) {
            cancelarPasoPin(data.detail || "Se alcanzó el límite de intentos. Vuelve a iniciar sesión más tarde.");
            return;
        }
        if (estado) estado.textContent = data.detail || "No se pudo verificar el PIN.";
        limpiarPin("login-pin");
        document.querySelector("[data-pin-group='login-pin'] .pin-digit")?.focus();
    } catch (error) {
        if (estado) estado.textContent = "No se pudo conectar con el servidor. Inténtalo nuevamente.";
    } finally {
        if (boton?.isConnected) boton.disabled = false;
    }
}

function completarInicioSesion(data) {
    retoPinActual = null;
    configurarPinActual = false;
    localStorage.setItem("token_cloud", data.access_token);
    localStorage.setItem("user_role_cloud", data.id_rol);
    localStorage.setItem("user_name_cloud", data.nombre);
    localStorage.setItem("user_id_cloud", data.user_id);
    mostrarDashboard(data.nombre, data.id_rol);
}

function cancelarPasoPin(mensaje = "") {
    retoPinActual = null;
    configurarPinActual = false;
    limpiarPin("login-pin");
    limpiarPin("login-pin-confirmacion");
    document.getElementById("form-pin-step")?.classList.add("hidden");
    document.getElementById("form-auth")?.classList.remove("hidden");
    document.getElementById("auth-toggle-container")?.classList.remove("hidden");
    establecerCamposObligatorios("[data-pin-group='login-pin-confirmacion']", false);
    const clave = document.getElementById("auth-password");
    if (clave) clave.value = "";
    ocultarPasswordAuth();
    if (mensaje) mostrarMensajeAuth(mensaje, "error");
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

    if (retoPinActual) cancelarPasoPin();
    if (modoRegistro) toggleModoAuth();
    ocultarPasswordAuth();
    document.getElementById("form-auth")?.reset();
    document.getElementById("form-pin-step")?.reset();

    navegarA("auth");
}

inicializarCamposPin();
