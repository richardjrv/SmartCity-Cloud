// ============================================================
// 🤖 MÓDULO DE INTERACCIÓN CON BRUNITO AI
// ============================================================

let brunitoHistory = [];

function toggleChatBrunito() {
    const windowChat = document.getElementById("brunito-chat-window");
    if (!windowChat) return;

    windowChat.classList.toggle("hidden");

    if (!windowChat.classList.contains("hidden")) {
        document.getElementById("chat-input")?.focus();
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