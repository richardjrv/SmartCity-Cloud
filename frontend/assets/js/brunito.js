// ============================================================
// 🤖 MÓDULO DE INTERACCIÓN CON BRUNITO AI
// ============================================================

let brunitoHistory = [];
let brunitoRecognition = null;
let brunitoListening = false;
let brunitoWakeRecognition = null;
let brunitoWakeEnabled = false;
let brunitoWakeStarting = false;
let brunitoWakeRestartTimer = null;
let brunitoWakeRestartDelay = 700;
let brunitoWakeCommandTimer = null;
let brunitoWakeWaitingForCommand = false;
let brunitoWakeGestureHandler = null;
let brunitoWakePhraseBuffer = [];
let brunitoWakeLocaleIndex = 0;
const BRUNITO_WAKE_LOCALES = ["es-EC", "es-MX", "es-ES"];

function tipoReconocimientoVozBrunito() {
    return window.SpeechRecognition || window.webkitSpeechRecognition;
}

function actualizarBotonWakeBrunito(activo) {
    const launcher = document.getElementById("btn-chat-launcher");
    if (launcher) {
        launcher.classList.toggle("is-wake-listening", activo);
        launcher.setAttribute("aria-label", activo
            ? "Abrir chat con Brunito. Activación por voz disponible."
            : "Abrir chat con Brunito");
        launcher.title = activo
            ? "Brunito está escuchando «Oye Bruno», «Hey Bruno» o «Brunito»."
            : "Abre el chat con Brunito";
    }
}

function limpiarEsperaComandoWakeBrunito() {
    brunitoWakeWaitingForCommand = false;
    if (brunitoWakeCommandTimer) window.clearTimeout(brunitoWakeCommandTimer);
    brunitoWakeCommandTimer = null;
}

function programarReinicioWakeBrunito() {
    if (!brunitoWakeEnabled || brunitoWakeRestartTimer) return;
    brunitoWakeRestartTimer = window.setTimeout(() => {
        brunitoWakeRestartTimer = null;
        crearReconocimientoWakeBrunito();
    }, brunitoWakeRestartDelay);
    brunitoWakeRestartDelay = Math.min(brunitoWakeRestartDelay * 2, 5600);
}

function extraerComandoWakeBrunito(transcripcion) {
    const texto = String(transcripcion || "").trim();
    const llamada = /\b(?:oye|ey|hey)[\s,]+bruno\b|\bbrunito\b/i.exec(texto);
    if (!llamada) return null;
    return texto.slice(llamada.index + llamada[0].length).replace(/^[\s,.:;!?¿¡-]+/u, "").trim();
}

function activarChatPorWakeBrunito() {
    const ventana = document.getElementById("brunito-chat-window");
    if (ventana?.classList.contains("hidden")) toggleChatBrunito();
}

function procesarResultadoWakeBrunito(transcripcion) {
    const texto = String(transcripcion || "").trim();
    if (!texto) return;

    if (brunitoWakeWaitingForCommand) {
        limpiarEsperaComandoWakeBrunito();
        activarChatPorWakeBrunito();
        actualizarEstadoVozBrunito("Consulta recibida por voz.");
        void procesarMensajeBrunito(texto);
        return;
    }

    brunitoWakePhraseBuffer.push(texto);
    brunitoWakePhraseBuffer = brunitoWakePhraseBuffer.slice(-4);
    const textoAcumulado = brunitoWakePhraseBuffer.join(" ");
    const comando = extraerComandoWakeBrunito(textoAcumulado);
    if (comando === null) return;
    brunitoWakePhraseBuffer = [];

    activarChatPorWakeBrunito();
    if (comando) {
        actualizarEstadoVozBrunito("Llamada detectada. Consultando a Brunito…");
        void procesarMensajeBrunito(comando);
        return;
    }

    brunitoWakeWaitingForCommand = true;
    actualizarEstadoVozBrunito("Aquí estoy. Dime tu consulta ahora.");
    if (brunitoWakeCommandTimer) window.clearTimeout(brunitoWakeCommandTimer);
    brunitoWakeCommandTimer = window.setTimeout(() => {
        limpiarEsperaComandoWakeBrunito();
        if (brunitoWakeEnabled) actualizarEstadoVozBrunito("Sigo escuchando. Di «Oye Bruno» cuando quieras llamarme.");
    }, 9000);
}

function crearReconocimientoWakeBrunito() {
    const SpeechRecognition = tipoReconocimientoVozBrunito();
    if (!SpeechRecognition || !brunitoWakeEnabled || brunitoWakeRecognition || brunitoWakeStarting) return;

    const recognition = new SpeechRecognition();
    recognition.lang = BRUNITO_WAKE_LOCALES[brunitoWakeLocaleIndex] || "es-EC";
    recognition.continuous = true;
    recognition.interimResults = false;
    recognition.maxAlternatives = 1;
    brunitoWakeRecognition = recognition;

    recognition.onstart = () => {
        brunitoWakeStarting = false;
        brunitoWakeRestartDelay = 700;
        actualizarBotonWakeBrunito(true);
        actualizarEstadoVozBrunito("Escucha activa. Di «Oye Bruno» para llamarme.");
    };

    recognition.onresult = event => {
        for (let indice = event.resultIndex; indice < event.results.length; indice += 1) {
            const resultado = event.results[indice];
            if (resultado.isFinal) procesarResultadoWakeBrunito(resultado[0]?.transcript);
        }
    };

    recognition.onerror = event => {
        const mensajes = {
            "not-allowed": "No se permitió el micrófono. Revisa sus permisos en el navegador.",
            "service-not-allowed": "El navegador bloqueó el reconocimiento de voz.",
            "audio-capture": "No se encontró un micrófono disponible."
        };
        if (mensajes[event.error]) {
            desactivarEscuchaWakeBrunito(mensajes[event.error]);
        } else if (event.error === "language-not-supported") {
            brunitoWakeLocaleIndex += 1;
            if (brunitoWakeLocaleIndex >= BRUNITO_WAKE_LOCALES.length) {
                desactivarEscuchaWakeBrunito("El navegador no admite los idiomas de voz configurados. Prueba Safari actualizado y Español en el teclado del iPhone.");
            } else {
                actualizarEstadoVozBrunito(`Probando reconocimiento en ${BRUNITO_WAKE_LOCALES[brunitoWakeLocaleIndex]}…`);
                brunitoWakeRestartDelay = 700;
            }
        } else if (event.error !== "no-speech" && event.error !== "aborted") {
            actualizarEstadoVozBrunito("La escucha tuvo una interrupción; Brunito intentará reconectarse.");
            brunitoWakeRestartDelay = Math.min(brunitoWakeRestartDelay * 2, 5600);
        }
    };

    recognition.onend = () => {
        if (brunitoWakeRecognition !== recognition) return;
        brunitoWakeRecognition = null;
        brunitoWakeStarting = false;
        if (brunitoWakeEnabled) {
            programarReinicioWakeBrunito();
        } else {
            actualizarBotonWakeBrunito(false);
        }
    };

    brunitoWakeStarting = true;
    try {
        recognition.start();
    } catch (error) {
        if (brunitoWakeRecognition === recognition) brunitoWakeRecognition = null;
        brunitoWakeStarting = false;
        if (error?.name === "NotAllowedError" || error?.name === "SecurityError") {
            desactivarEscuchaWakeBrunito("No se permitió el micrófono. Revisa sus permisos en el navegador.");
        } else if (brunitoWakeEnabled) {
            actualizarEstadoVozBrunito("Restableciendo la escucha de Brunito…");
            programarReinicioWakeBrunito();
        }
    }
}

function desactivarEscuchaWakeBrunito(mensaje = "Escucha por voz desactivada.") {
    brunitoWakeEnabled = false;
    brunitoWakeStarting = false;
    if (brunitoWakeRestartTimer) window.clearTimeout(brunitoWakeRestartTimer);
    brunitoWakeRestartTimer = null;
    limpiarEsperaComandoWakeBrunito();
    const recognition = brunitoWakeRecognition;
    brunitoWakeRecognition = null;
    if (recognition) {
        recognition.onend = null;
        try { recognition.stop(); } catch (error) { /* El motor ya estaba detenido. */ }
    }
    actualizarBotonWakeBrunito(false);
    actualizarEstadoVozBrunito(mensaje);
}

function detenerEscuchaWakeBrunito() {
    quitarActivadoresWakeBrunito();
    if (brunitoWakeEnabled || brunitoWakeRecognition) {
        desactivarEscuchaWakeBrunito("Escucha por voz detenida.");
    } else {
        actualizarBotonWakeBrunito(false);
    }
}

function activarEscuchaWakeBrunito() {
    if (brunitoWakeEnabled) return;
    const SpeechRecognition = tipoReconocimientoVozBrunito();
    if (!SpeechRecognition) {
        actualizarEstadoVozBrunito("Este navegador no admite activación por frase. Puedes abrir el chat y usar el dictado manual.");
        mostrarNotificacion("Este navegador no admite la activación por voz de Brunito.", "info");
        return;
    }
    if (!window.isSecureContext) {
        actualizarEstadoVozBrunito("Para usar la escucha, abre el sitio en HTTPS o en localhost.");
        mostrarNotificacion("La activación por voz de Brunito requiere HTTPS o localhost.", "info");
        return;
    }
    const dictadoActivo = brunitoListening && brunitoRecognition;
    if (dictadoActivo) brunitoRecognition.stop();
    brunitoWakeEnabled = true;
    actualizarBotonWakeBrunito(true);
    actualizarEstadoVozBrunito(dictadoActivo
        ? "Cambiando del dictado a la escucha por frase…"
        : "Solicitando permiso del micrófono…");
    if (!dictadoActivo) crearReconocimientoWakeBrunito();
}

function quitarActivadoresWakeBrunito() {
    if (!brunitoWakeGestureHandler) return;
    document.removeEventListener("pointerdown", brunitoWakeGestureHandler, true);
    document.removeEventListener("keydown", brunitoWakeGestureHandler, true);
    brunitoWakeGestureHandler = null;
}

function prepararActivacionWakeBrunito() {
    if (brunitoWakeEnabled || brunitoWakeGestureHandler || !obtenerToken()) return;
    const launcher = document.getElementById("btn-chat-launcher");
    if (launcher) {
        launcher.title = "Toca o presiona una tecla en el sitio para activar la escucha de Brunito; el navegador pedirá permiso.";
        launcher.setAttribute("aria-label", "Abrir chat con Brunito. La activación por voz se preparará al interactuar con el sitio.");
    }
    brunitoWakeGestureHandler = evento => {
        if (!evento.isTrusted || !obtenerToken() || document.body.classList.contains("login-only")) return;
        quitarActivadoresWakeBrunito();
        activarEscuchaWakeBrunito();
    };
    document.addEventListener("pointerdown", brunitoWakeGestureHandler, true);
    document.addEventListener("keydown", brunitoWakeGestureHandler, true);
    mostrarNotificacion("Toca una vez el sitio y permite el micrófono. Después podrás llamar a Brunito diciendo «Oye Bruno», «Hey Bruno» o «Brunito».", "info");
}

function actualizarEstadoVozBrunito(mensaje) {
    const estado = document.getElementById("chat-voice-status");
    if (estado) estado.textContent = mensaje;
}

function alternarDictadoBrunito() {
    const SpeechRecognition = tipoReconocimientoVozBrunito();
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

    if (brunitoWakeEnabled) {
        desactivarEscuchaWakeBrunito("Escucha por frase desactivada para usar el dictado manual.");
        window.setTimeout(alternarDictadoBrunito, 350);
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
        if (brunitoWakeEnabled) crearReconocimientoWakeBrunito();
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
    launcher?.setAttribute("aria-label", opening
        ? "Cerrar chat con Brunito"
        : brunitoWakeEnabled ? "Abrir chat con Brunito. Activación por voz disponible." : "Abrir chat con Brunito");

    // Cerrar la ventana del chat no debe detener el reconocimiento de la frase de llamada.
    if (!opening && brunitoWakeEnabled && !brunitoWakeRecognition && !brunitoWakeStarting) {
        programarReinicioWakeBrunito();
    }

    if (opening) {
        document.getElementById("chat-input")?.focus();
    } else {
        launcher?.focus({ preventScroll: true });
    }
}

window.addEventListener("pagehide", detenerEscuchaWakeBrunito);

async function enviarMensajeBrunito(e) {
    if (e) e.preventDefault();

    const input = document.getElementById("chat-input");
    const texto = input?.value.trim();
    if (!texto) return;
    if (input) input.value = "";
    return procesarMensajeBrunito(texto);
}

function normalizarConsultaClimaBrunito(texto) {
    return String(texto || "")
        .normalize("NFD")
        .replace(/[\u0300-\u036f]/g, "")
        .toLowerCase();
}

function esConsultaClimaBrunito(texto) {
    const consulta = normalizarConsultaClimaBrunito(texto);
    const mencionaClima = /\b(clima|tiempo|weather|pronostico|temperatura|sensacion termica|humedad|precipitacion|lluvia|probabilidad|indice uv|uv|ultravioleta|radiacion|sol|soleado|soleada|despejado|despejada|nublado|nublada|cielo|viento|rafaga|rafagas)\b/.test(consulta);
    const consultaDeSensor = /\b(sensor|sensores|esp32|dht22)\b/.test(consulta)
        && !/\b(clima|tiempo|weather|pronostico|open meteo)\b/.test(consulta);
    return mencionaClima && !consultaDeSensor;
}

function valorClimaBrunito(valor, decimales = 1) {
    const numero = valor === null || valor === undefined || valor === "" ? NaN : Number(valor);
    return Number.isFinite(numero)
        ? new Intl.NumberFormat("es-EC", { maximumFractionDigits: decimales }).format(numero)
        : "no disponible";
}

function generarRespuestaClimaBrunito(clima, consulta) {
    if (!clima) {
        return "Ahora no tengo una lectura disponible de Open-Meteo. Inténtalo de nuevo en un momento; te responderé con los datos del panel de clima.";
    }

    const ubicacion = clima.location || "Puerto Francisco de Orellana, Ecuador";
    const ubicacionPregunta = consulta.match(/\b(?:en|de|para)\s+([a-zñ][a-zñ\s-]{2,45}?)(?=\s+(?:hoy|ahora|actual|actualmente|por favor|dime|esta|manana|y\b)|[?.,!]|$)/)?.[1]?.trim();
    const normalizarLugar = lugar => normalizarConsultaClimaBrunito(lugar || "").replace(/\s+/g, " ").trim();
    const lugarConfigurado = normalizarLugar("Puerto Francisco de Orellana Ecuador");
    const lugarSolicitado = normalizarLugar(ubicacionPregunta);
    const aliasOrellana = /\b(orellana|el coca|francisco de orellana|puerto francisco de orellana|manacisco de rellana|manacisco de orellana)\b/.test(lugarSolicitado);
    if (ubicacionPregunta && !aliasOrellana && !lugarConfigurado.includes(lugarSolicitado)) {
        return `Por ahora Open-Meteo está configurado para ${ubicacion}. No tengo datos de ${ubicacionPregunta}; para responder sobre ese lugar habría que añadir su ubicación.`;
    }

    const horaModelo = clima.time ? new Date(`${clima.time}:00-05:00`) : null;
    const horaTexto = horaModelo && !Number.isNaN(horaModelo.getTime())
        ? new Intl.DateTimeFormat("es-EC", { hour: "2-digit", minute: "2-digit", timeZone: "America/Guayaquil" }).format(horaModelo)
        : "reciente";
    const preguntarPronostico = /\b(manana|mas tarde|esta tarde|esta noche|proximas horas|pronostico|prevision|va a llover|va a hacer|probabilidad|posibilidad)\b/.test(consulta);
    const horaPronostico = /\b(manana|mañana)\b/.test(consulta) ? 24 : 6;
    const horas = clima.hourly;
    let filaPronostico = -1;
    if (preguntarPronostico && horas?.time?.length && horaModelo) {
        const objetivo = horaModelo.getTime() + horaPronostico * 60 * 60 * 1000;
        let distanciaMinima = Infinity;
        horas.time.forEach((hora, indice) => {
            const fechaHora = new Date(`${hora}:00-05:00`).getTime();
            if (fechaHora >= horaModelo.getTime() && Math.abs(fechaHora - objetivo) < distanciaMinima) {
                distanciaMinima = Math.abs(fechaHora - objetivo);
                filaPronostico = indice;
            }
        });
    }
    const indiceHoraActual = horas?.time?.indexOf(clima.time) ?? -1;
    const probabilidadActual = indiceHoraActual >= 0 ? horas.precipitation_probability?.[indiceHoraActual] : null;
    const consultaProbabilidad = /\b(probabilidad|posibilidad|llover|lluvia|precipitacion|pronostico|prevision|manana|mañana|mas tarde|esta tarde|esta noche|proximas horas)\b/.test(consulta);
    if (consultaProbabilidad && filaPronostico >= 0) {
        const probabilidad = horas.precipitation_probability?.[filaPronostico];
        const milimetros = horas.precipitation?.[filaPronostico];
        const codigo = Number(horas.weather_code?.[filaPronostico]);
        const [condicionHora] = Number.isFinite(codigo) ? window.describirClimaOpenMeteo?.(codigo) || [""] : [""];
        const horaObjetivo = new Date(`${horas.time[filaPronostico]}:00-05:00`);
        const horaFormato = new Intl.DateTimeFormat("es-EC", { hour: "2-digit", minute: "2-digit", timeZone: "America/Guayaquil" }).format(horaObjetivo);
        return `En ${ubicacion}, el pronóstico de Open-Meteo para las ${horaFormato} indica ${valorClimaBrunito(probabilidad, 0)}% de probabilidad de lluvia y ${valorClimaBrunito(milimetros)} mm de precipitación${condicionHora ? `; ${condicionHora.toLowerCase()}` : ""}.`;
    }
    if (preguntarPronostico && filaPronostico >= 0) {
        const horaObjetivo = new Date(`${horas.time[filaPronostico]}:00-05:00`);
        const horaFormato = new Intl.DateTimeFormat("es-EC", { hour: "2-digit", minute: "2-digit", timeZone: "America/Guayaquil" }).format(horaObjetivo);
        const [condicionHora] = window.describirClimaOpenMeteo?.(Number(horas.weather_code?.[filaPronostico])) || ["condición no disponible"];
        return `En ${ubicacion}, el pronóstico para las ${horaFormato} indica ${condicionHora.toLowerCase()}, ${valorClimaBrunito(horas.temperature_2m?.[filaPronostico])} °C e índice UV ${valorClimaBrunito(horas.uv_index?.[filaPronostico])}.`;
    }
    if (preguntarPronostico) {
        return `No encuentro ese horario en el pronóstico que recibí de Open-Meteo para ${ubicacion}. Inténtalo de nuevo en unos minutos.`;
    }

    const tema = /\b(humedad)\b/.test(consulta) ? `La humedad relativa` :
        /\b(uv|ultravioleta|radiacion)\b/.test(consulta) ? `El índice UV` :
        /\b(viento|rafaga|rafagas)\b/.test(consulta) ? `El viento` :
        /\b(lluvia|precipitacion|probabilidad)\b/.test(consulta) ? `La precipitación actual` :
        /\b(temperatura|sensacion termica|calor|frio)\b/.test(consulta) ? `La temperatura` : `El clima`;
    const datosRespuesta = {
        "La humedad relativa": `${valorClimaBrunito(clima.relative_humidity_2m, 0)}%`,
        "El índice UV": valorClimaBrunito(clima.uv_index),
        "El viento": `${valorClimaBrunito(clima.wind_speed_10m)} km/h, con ráfagas de ${valorClimaBrunito(clima.wind_gusts_10m)} km/h`,
        "La precipitación actual": `${valorClimaBrunito(clima.precipitation)} mm en la última hora; probabilidad de lluvia para esta hora ${valorClimaBrunito(probabilidadActual, 0)}%`,
        "La temperatura": `${valorClimaBrunito(clima.temperature_2m)} °C, sensación térmica ${valorClimaBrunito(clima.apparent_temperature)} °C`,
        "El clima": `${clima.condition || "condición no disponible"}, ${valorClimaBrunito(clima.temperature_2m)} °C; humedad ${valorClimaBrunito(clima.relative_humidity_2m, 0)}%; probabilidad de lluvia ${valorClimaBrunito(probabilidadActual, 0)}%`
    };
    return `${tema} en ${ubicacion} es ${datosRespuesta[tema]} (Open-Meteo, actualizado a las ${horaTexto}).`;
}

async function responderConsultaClimaBrunito(texto, typing) {
    try {
        const clima = await window.smartCityWeather?.getCurrent();
        const respuesta = generarRespuestaClimaBrunito(clima, normalizarConsultaClimaBrunito(texto));
        typing?.remove();
        agregarMensajeBrunito("model", respuesta);
        brunitoHistory.push({ role: "user", content: texto });
        brunitoHistory.push({ role: "assistant", content: respuesta });
    } catch (error) {
        console.warn("Brunito no pudo consultar los datos locales del clima:", error);
        typing?.remove();
        agregarMensajeBrunito("model", "No pude consultar ahora los datos meteorológicos. Prueba nuevamente en unos segundos.");
    }
}

async function procesarMensajeBrunito(texto) {
    const container = document.getElementById("chat-mensajes");
    if (!texto || !container) return;

    // 1. Mostrar mensaje del usuario
    agregarMensajeBrunito("user", texto);

    // 2. Elemento indicador de carga
    const typing = document.createElement("div");
    typing.id = "brunito-typing";
    typing.className = "bg-slate-700/60 p-3 rounded-xl border border-slate-600/50 max-w-[85%] text-slate-400 text-xs";
    typing.innerText = "🤖 Brunito está pensando...";
    container.appendChild(typing);
    container.scrollTop = container.scrollHeight;

    if (esConsultaClimaBrunito(texto)) {
        await responderConsultaClimaBrunito(texto, typing);
        return;
    }

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