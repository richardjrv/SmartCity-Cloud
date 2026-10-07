// ============================================================
// 🤖 MÓDULO DE INTERACCIÓN CON BRUNITO AI
// ============================================================

let brunitoHistory = [];
let brunitoRecognition = null;
let brunitoListening = false;

function actualizarEstadoVozBrunito(mensaje) {
    const estado = document.getElementById("chat-voice-status");
    if (estado) estado.textContent = mensaje;
}

function alternarDictadoBrunito() {
    const SpeechRecognition = window.SpeechRecognition || window.webkitSpeechRecognition;
    const input = document.getElementById("chat-input");
    const boton = document.getElementById("chat-mic-button");

    if (!input || !boton) return;

    if (!SpeechRecognition) {
        actualizarEstadoVozBrunito("Este navegador no admite dictado por voz. Puedes escribir tu consulta.");
        return;
    }

    if (!window.isSecureContext) {
        actualizarEstadoVozBrunito("Para usar el micrófono, abre el sitio en HTTPS o en localhost.");
        return;
    }

    if (brunitoListening && brunitoRecognition) {
        actualizarEstadoVozBrunito("Finalizando dictado…");
        brunitoRecognition.stop();
        return;
    }

    const recognition = new SpeechRecognition();
    const textoPrevio = input.value.trim();
    let huboError = false;

    recognition.lang = "es-EC";
    recognition.continuous = false;
    recognition.interimResults = false;
    recognition.maxAlternatives = 1;

    recognition.onstart = () => {
        brunitoRecognition = recognition;
        brunitoListening = true;
        boton.classList.add("is-listening");
        boton.setAttribute("aria-pressed", "true");
        boton.setAttribute("aria-label", "Detener dictado por micrófono");
        boton.title = "Detener dictado";
        actualizarEstadoVozBrunito("Te escucho… Habla ahora.");
    };

    recognition.onresult = event => {
        const transcripcion = Array.from(event.results)
            .slice(event.resultIndex)
            .filter(resultado => resultado.isFinal)
            .map(resultado => resultado[0].transcript.trim())
            .filter(Boolean)
            .join(" ");

        if (!transcripcion) return;
        input.value = [textoPrevio, transcripcion].filter(Boolean).join(" ");
        input.dispatchEvent(new Event("input", { bubbles: true }));
        actualizarEstadoVozBrunito("Dictado agregado. Revísalo y presiona Enviar.");
        input.focus();
    };

    recognition.onerror = event => {
        huboError = true;
        const mensajes = {
            "not-allowed": "No se permitió el acceso al micrófono. Revisa los permisos del navegador.",
            "service-not-allowed": "El navegador bloqueó el servicio de reconocimiento de voz.",
            "audio-capture": "No se encontró un micrófono disponible.",
            "no-speech": "No detecté voz. Inténtalo otra vez.",
            "network": "Falló la conexión necesaria para reconocer la voz.",
            "aborted": "Se canceló el dictado."
        };
        actualizarEstadoVozBrunito(mensajes[event.error] || "No se pudo iniciar el dictado. Puedes escribir tu consulta.");
    };

    recognition.onend = () => {
        if (brunitoRecognition !== recognition) return;

        brunitoRecognition = null;
        brunitoListening = false;
        boton.classList.remove("is-listening");
        boton.setAttribute("aria-pressed", "false");
        boton.setAttribute("aria-label", "Dictar consulta por micrófono");
        boton.title = "Dictar consulta";

        if (!huboError && document.getElementById("chat-voice-status")?.textContent === "Te escucho… Habla ahora.") {
            actualizarEstadoVozBrunito("No detecté voz. Puedes intentarlo de nuevo o escribir tu consulta.");
        }
    };

    brunitoRecognition = recognition;
    try {
        recognition.start();
    } catch (error) {
        brunitoRecognition = null;
        brunitoListening = false;
        actualizarEstadoVozBrunito("No se pudo iniciar el micrófono. Inténtalo de nuevo.");
    }
}

function toggleChatBrunito() {
    const windowChat = document.getElementById("brunito-chat-window");
    if (!windowChat) return;

    const opening = windowChat.classList.contains("hidden");
    if (!opening && brunitoListening && brunitoRecognition) brunitoRecognition.stop();
    windowChat.classList.toggle("hidden", !opening);
    const launcher = document.getElementById("btn-chat-launcher");
    launcher?.setAttribute("aria-expanded", String(opening));
    launcher?.setAttribute("aria-label", opening ? "Cerrar chat con Brunito" : "Abrir chat con Brunito");

    if (opening) {
        document.getElementById("chat-input")?.focus();
    } else {
        launcher?.focus({ preventScroll: true });
    }
}

async function enviarMensajeBrunito(e) {
    if (e) e.preventDefault();

    const input = document.getElementById("chat-input");
    const container = document.getElementById("chat-mensajes");
    const texto = input?.value.trim();

    if (!texto || !container) return;

    // 1. Mostrar mensaje del usuario
    agregarMensajeBrunito("user", texto);
    if (input) input.value = "";

    // 2. Elemento indicador de carga
    const typing = document.createElement("div");
    typing.id = "brunito-typing";
    typing.className = "bg-slate-700/60 p-3 rounded-xl border border-slate-600/50 max-w-[85%] text-slate-400 text-xs";
    typing.innerText = "🤖 Brunito está pensando...";
    container.appendChild(typing);
    container.scrollTop = container.scrollHeight;

    try {
        const { ok, data } = await apiFetch("/api/ia/chat", {
            method: "POST",
            body: JSON.stringify({
                message: texto,
                history: brunitoHistory
            })
        });

        typing.remove();

        if (ok && data.respuesta) {
            agregarMensajeBrunito("model", data.respuesta);

            if (data.accion_pendiente) {
                const esAdmin = Number(localStorage.getItem("user_role_cloud")) === 1;
                if (esAdmin) {
                    agregarConfirmacionActuadorBrunito(data.accion_pendiente);
                } else {
                    agregarMensajeBrunito("model", "La sesión actual no tiene permisos de administrador para confirmar esta orden.");
                }
            }

            // Guardar historial para mantener el hilo de la conversación
            brunitoHistory.push({ role: "user", content: texto });
            brunitoHistory.push({ role: "assistant", content: data.respuesta });
        } else {
            agregarMensajeBrunito("model", `⚠️ ${data.detail || "No se pudo consultar a Brunito AI."}`);
        }
    } catch (error) {
        console.error("❌ Error en Brunito AI:", error);
        typing.remove();
        agregarMensajeBrunito("model", "⚠️ Error de conexión con el servidor.");
    }
}

function agregarMensajeBrunito(role, content) {
    const container = document.getElementById("chat-mensajes");
    if (!container) return;

    const msgDiv = document.createElement("div");

    if (role === "user") {
        msgDiv.className = "ml-auto bg-blue-600/80 p-3 rounded-xl max-w-[85%] text-white text-xs";
    } else {
        msgDiv.className = "bg-slate-700/60 p-3 rounded-xl border border-slate-600/50 max-w-[85%] text-slate-200 text-xs";
    }

    msgDiv.innerText = content;
    container.appendChild(msgDiv);
    container.scrollTop = container.scrollHeight;
}

function agregarConfirmacionActuadorBrunito(accion) {
    const container = document.getElementById("chat-mensajes");
    if (!container || !accion?.confirmation_token) return;

    const accionSolicitada = accion.accion || (accion.estado_deseado ? "encender" : "apagar");
    const verbo = {
        encender: "Encender",
        apagar: "Apagar",
        automatico: "Poner en modo automático"
    }[accionSolicitada] || "Cambiar";
    const tarjeta = document.createElement("section");
    tarjeta.className = "brunito-action-card";
    tarjeta.setAttribute("aria-label", "Confirmar orden de actuador");

    const titulo = document.createElement("h3");
    titulo.className = "brunito-action-title";
    titulo.textContent = `¿${verbo} ${accion.nombre || "esta luminaria"}?`;

    const detalle = document.createElement("p");
    detalle.className = "brunito-action-detail";
    detalle.textContent = `${accion.sensor_id || "Actuador"} · La orden quedará pendiente hasta conectar el ESP32.`;

    const aviso = document.createElement("p");
    aviso.className = "brunito-action-notice";
    aviso.textContent = "Confirmar guardará la orden y la registrará en auditoría. No cambia físicamente la luminaria todavía.";

    const estado = document.createElement("p");
    estado.className = "brunito-action-status";
    estado.setAttribute("role", "status");
    estado.setAttribute("aria-live", "polite");
    let segundosRestantes = Math.max(1, Math.floor(Number(accion.expira_en_segundos) || 180));
    estado.textContent = `La propuesta vence en ${segundosRestantes} segundos.`;

    const controles = document.createElement("div");
    controles.className = "brunito-action-controls";

    const confirmar = document.createElement("button");
    confirmar.type = "button";
    confirmar.className = "brunito-action-confirm";
    confirmar.textContent = `Confirmar ${verbo.toLowerCase()}`;

    const descartar = document.createElement("button");
    descartar.type = "button";
    descartar.className = "brunito-action-dismiss";
    descartar.textContent = "Descartar";

    const temporizador = window.setInterval(() => {
        segundosRestantes -= 1;
        if (segundosRestantes <= 0) {
            window.clearInterval(temporizador);
            confirmar.disabled = true;
            estado.textContent = "La propuesta venció. Vuelve a pedirle a Brunito que prepare la orden.";
            return;
        }
        estado.textContent = `La propuesta vence en ${segundosRestantes} segundos.`;
    }, 1000);

    confirmar.addEventListener("click", async () => {
        if (segundosRestantes <= 0) return;
        confirmar.disabled = true;
        descartar.disabled = true;
        estado.textContent = "Guardando orden…";
        try {
            const { ok, data } = await apiFetch("/api/actuadores/confirmar", {
                method: "POST",
                body: JSON.stringify({ confirmation_token: accion.confirmation_token })
            });
            if (!ok) throw new Error(data.detail || "No se pudo guardar la orden.");
            estado.textContent = data.mensaje || "Orden registrada como pendiente del ESP32.";
            window.clearInterval(temporizador);
            confirmar.remove();
            descartar.textContent = "Cerrar";
            descartar.disabled = false;
        } catch (error) {
            estado.textContent = error.message || "No se pudo confirmar la orden.";
            confirmar.disabled = segundosRestantes <= 0;
            descartar.disabled = false;
        }
    });

    descartar.addEventListener("click", () => {
        window.clearInterval(temporizador);
        tarjeta.remove();
    });
    controles.append(confirmar, descartar);
    tarjeta.append(titulo, detalle, aviso, estado, controles);
    container.appendChild(tarjeta);
    container.scrollTop = container.scrollHeight;
}
