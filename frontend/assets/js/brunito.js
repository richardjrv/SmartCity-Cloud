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
