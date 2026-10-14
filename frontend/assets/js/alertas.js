let alertasCompartidas = [];
let alertasInicializadas = false;
let alertasCargando = false;
const alertasVistas = new Set();

const ESTADOS_ALERTA = [
    ["pendiente", "Pendiente"],
    ["en_proceso", "En proceso"],
    ["resuelto", "Resuelto"]
];

function esAdministradorAlertas() {
    return Number(localStorage.getItem("user_role_cloud")) === 1;
}

function alertaSensorGuardada(sensorId, metrica) {
    return alertasCompartidas.find(alerta =>
        alerta.origen === "sensor" && alerta.sensor_id === sensorId && alerta.metrica === metrica
    ) || null;
}

function etiquetaEstadoAlerta(estado) {
    return ESTADOS_ALERTA.find(([valor]) => valor === estado)?.[1] || "Pendiente";
}

function prioridadVisualAlerta(alerta) {
    if (alerta.origen === "sensor") {
        return /humedad/i.test(`${alerta.metrica || ""} ${alerta.titulo || ""}`) ? "media" : "alta";
    }
    return /\b(urgente|emergencia|incendio|inundacion|accidente|peligro|riesgo|herido|colapso)\b/i
        .test(`${alerta.titulo || ""} ${alerta.descripcion || ""}`) ? "alta" : "media";
}

function prepararAnimacionAlerta(item, clave, alerta) {
    const prioridad = prioridadVisualAlerta(alerta);
    item.dataset.priority = prioridad;
    if (alertasVistas.has(clave)) return;
    alertasVistas.add(clave);
    item.classList.add("alert-item--new");
    window.setTimeout(() => item.classList.remove("alert-item--new"), 5600);
}

function actualizarEstadoVisualAlerta(item, estado) {
    item.className = `alert-item alert-item--${estado}`;
    const select = item.querySelector(".alert-status-select");
    if (select) select.dataset.alertStatus = estado;
    const chip = item.querySelector(".alert-status-pill");
    if (chip) {
        chip.dataset.alertStatus = estado;
        chip.textContent = etiquetaEstadoAlerta(estado);
    }
}

function crearControlEstadoAlerta(alerta, alCambiar) {
    if (!esAdministradorAlertas()) {
        const estado = document.createElement("span");
        estado.className = "alert-status-pill";
        estado.dataset.alertStatus = alerta.estado;
        estado.textContent = etiquetaEstadoAlerta(alerta.estado);
        return estado;
    }

    const seguimiento = document.createElement("div");
    seguimiento.className = "alert-admin-followup";
    const label = document.createElement("label");
    label.className = "alert-status-label";
    label.textContent = "Estado (solo admin)";
    const select = document.createElement("select");
    select.className = "alert-status-select";
    select.dataset.alertStatus = alerta.estado;
    select.setAttribute("aria-label", `Estado de alerta: ${alerta.titulo}`);
    ESTADOS_ALERTA.forEach(([valor, nombre]) => {
        const option = document.createElement("option");
        option.value = valor;
        option.textContent = nombre;
        option.selected = alerta.estado === valor;
        select.appendChild(option);
    });
    label.appendChild(select);
    const notaLabel = document.createElement("label");
    notaLabel.className = "alert-status-label alert-observation-label";
    notaLabel.textContent = "Nota breve (obligatoria para guardar)";
    const observation = document.createElement("textarea");
    observation.className = "alert-observation-input";
    observation.maxLength = 280;
    observation.minLength = 1;
    observation.required = true;
    observation.rows = 2;
    observation.placeholder = "Ej.: Revisé el sensor; queda pendiente recalibrarlo.";
    observation.setAttribute("aria-label", `Observación administrativa para: ${alerta.titulo}`);
    notaLabel.appendChild(observation);
    const save = document.createElement("button");
    save.type = "button";
    save.className = "alert-view-button alert-followup-save";
    save.textContent = "Guardar estado y nota";
    const feedback = document.createElement("p");
    feedback.className = "alert-followup-feedback";
    feedback.setAttribute("role", "status");
    feedback.setAttribute("aria-live", "polite");
    select.addEventListener("change", () => {
        feedback.textContent = "Estado modificado. Pulsa «Guardar estado y nota» para aplicar el cambio.";
        feedback.classList.remove("is-error", "is-success");
    });
    observation.addEventListener("input", () => {
        if (feedback.classList.contains("is-error")) {
            feedback.textContent = "";
            feedback.classList.remove("is-error");
        }
    });
    save.addEventListener("click", () => alCambiar(select.value, observation.value.trim(), save, select, observation, feedback));
    seguimiento.append(label, notaLabel, save, feedback);
    return seguimiento;
}

function fechaAlerta(fechaValor, formato = "medium") {
    if (!fechaValor) return "Fecha no disponible";
    const fecha = new Date(fechaValor);
    return Number.isNaN(fecha.getTime())
        ? "Fecha no disponible"
        : fecha.toLocaleString("es-EC", { dateStyle: formato, timeStyle: "short" });
}

function crearHistorialVisualAlerta(alerta) {
    const history = document.createElement("details");
    history.className = "alert-history";
    const summary = document.createElement("summary");
    const eventos = Array.isArray(alerta.historial) ? alerta.historial : [];
    summary.textContent = `Historial de seguimiento · ${eventos.length} ${eventos.length === 1 ? "evento" : "eventos"}`;
    history.appendChild(summary);
    if (!eventos.length) {
        const empty = document.createElement("p");
        empty.className = "alert-history-empty";
        empty.textContent = "Aún no hay cambios registrados.";
        history.appendChild(empty);
        return history;
    }
    const list = document.createElement("ol");
    list.className = "alert-history-list";
    eventos.forEach(evento => {
        const row = document.createElement("li");
        const heading = document.createElement("strong");
        const transition = evento.estado_anterior
            ? `${etiquetaEstadoAlerta(evento.estado_anterior)} → ${etiquetaEstadoAlerta(evento.estado_nuevo)}`
            : `Aviso creado · ${etiquetaEstadoAlerta(evento.estado_nuevo)}`;
        heading.textContent = `${transition} · ${evento.actor || "Usuario"}`;
        const time = document.createElement("time");
        time.dateTime = evento.creado_en || "";
        time.textContent = fechaAlerta(evento.creado_en, "short");
        row.append(heading, time);
        if (evento.observacion) {
            const note = document.createElement("p");
            note.textContent = evento.observacion;
            row.appendChild(note);
        }
        list.appendChild(row);
    });
    history.appendChild(list);
    return history;
}

async function cambiarEstadoAlerta(alerta, estado, observacion, button, select, observation, feedback) {
    const estadoAnterior = alerta.estado;
    if (!observacion) {
        if (feedback) feedback.textContent = "Escribe una nota breve para guardar este cambio.";
        feedback?.classList.add("is-error");
        observation?.focus();
        return;
    }
    if (button) button.disabled = true;
    if (select) select.disabled = true;
    if (observation) observation.disabled = true;
    if (button) button.textContent = "Guardando…";
    if (feedback) {
        feedback.textContent = "Guardando el cambio…";
        feedback.classList.remove("is-error", "is-success");
    }
    try {
        let respuesta;
        if (alerta.id) {
            respuesta = await apiFetch(`/alertas/${alerta.id}/estado`, {
                method: "PATCH",
                body: JSON.stringify({ estado, observacion })
            });
        } else {
            respuesta = await apiFetch("/alertas/sensor", {
                method: "PUT",
                body: JSON.stringify({
                    sensor_id: alerta.sensor_id,
                    metrica: alerta.metrica,
                    estado,
                    observacion
                })
            });
        }
        if (!respuesta.ok) throw new Error(respuesta.data?.detail || "No se pudo actualizar el estado.");
        if (feedback) {
            feedback.textContent = "Cambio guardado. Ya aparece en el historial y las notificaciones.";
            feedback.classList.add("is-success");
        }
        if (typeof registrarNotificacionesCambiosAlertas === "function") {
            registrarNotificacionesCambiosAlertas([respuesta.data]);
        }
        reemplazarAlertaCompartida(respuesta.data);
        if (typeof actualizarVistaSensores === "function" && alerta.origen === "sensor") {
            actualizarVistaSensores({ fechaTexto: "Estado de alerta actualizado" });
        } else {
            renderizarAlertasReportadas();
        }
        const filaActualizada = Array.from(document.querySelectorAll("[data-alerta-id]"))
            .find(item => item.dataset.alertaId === String(respuesta.data.id));
        const resultadoActualizado = filaActualizada?.querySelector(".alert-followup-feedback");
        if (resultadoActualizado) {
            resultadoActualizado.textContent = "Guardado. El historial y las notificaciones ya se actualizaron.";
            resultadoActualizado.classList.add("is-success");
        }
        button?.classList.add("is-saved");
        window.setTimeout(() => button?.classList.remove("is-saved"), 1000);
        mostrarNotificacion("Seguimiento guardado en el historial.", "exito");
    } catch (error) {
        if (select) select.value = estadoAnterior;
        if (feedback) {
            feedback.textContent = error.message || "No se pudo guardar. Revisa tu conexión e inténtalo otra vez.";
            feedback.classList.add("is-error");
        }
        const mensajeError = error.message === "Failed to fetch"
            ? "No se pudo conectar con el servidor. Comprueba tu conexión e inténtalo de nuevo."
            : error.message || "No se pudo guardar. Revisa tu conexión e inténtalo otra vez.";
        if (feedback) feedback.textContent = mensajeError;
        mostrarNotificacion(mensajeError, "error");
    } finally {
        if (button) {
            button.disabled = false;
            button.textContent = "Guardar estado y nota";
        }
        if (select) select.disabled = false;
        if (observation) observation.disabled = false;
    }
}

function reemplazarAlertaCompartida(alerta) {
    const indice = alertasCompartidas.findIndex(item => item.id === alerta.id);
    if (indice >= 0) alertasCompartidas[indice] = alerta;
    else alertasCompartidas.unshift(alerta);
}

function configurarCentroAlertasPorRol(idRol = localStorage.getItem("user_role_cloud")) {
    const administrador = Number(idRol) === 1;
    const form = document.getElementById("alert-report-form");
    const nota = document.getElementById("alert-center-note");
    form?.classList.toggle("hidden", administrador);
    if (nota) {
        nota.textContent = administrador
            ? "Los usuarios envían los avisos. Desde aquí puedes cambiar su estado y dejar una nota breve; cada cambio queda en el historial y en las notificaciones."
            : "Selecciona el tipo de aviso y describe lo observado. El administrador revisará el reporte y sus cambios aparecerán aquí y en tus notificaciones.";
    }
}

function renderizarAlertasReportadas(destino = document.getElementById("alert-center-list")) {
    if (!destino) return;
    destino.querySelectorAll("[data-alerta-reportada]").forEach(item => item.remove());
    const reportadas = alertasCompartidas.filter(alerta => alerta.origen === "usuario");

    reportadas.forEach(alerta => {
        const item = document.createElement("article");
        item.className = `alert-item alert-item--${alerta.estado}`;
        item.dataset.alertaReportada = String(alerta.id);
        item.dataset.alertaId = String(alerta.id);
        prepararAnimacionAlerta(item, `usuario:${alerta.id}`, alerta);

        const main = document.createElement("div");
        main.className = "alert-item-main";
        const body = document.createElement("div");
        const title = document.createElement("strong");
        title.textContent = alerta.titulo;
        const description = document.createElement("p");
        description.textContent = alerta.descripcion;
        const metadata = document.createElement("p");
        const fechaTexto = fechaAlerta(alerta.creado_en);
        metadata.textContent = `Reportó ${alerta.creador || "usuario"} · ${fechaTexto}${alerta.sensor_id ? ` · ${alerta.sensor_id}` : ""}`;
        if (alerta.actualizador && alerta.actualizado_en && alerta.actualizado_por) {
            const cambioTexto = fechaAlerta(alerta.actualizado_en, "short");
            metadata.textContent += ` · Estado actualizado por ${alerta.actualizador}${cambioTexto ? ` el ${cambioTexto}` : ""}`;
        }
        body.append(title, description, metadata, crearHistorialVisualAlerta(alerta));
        main.appendChild(body);

        const controls = document.createElement("div");
        controls.className = "alert-item-controls";
        controls.appendChild(crearControlEstadoAlerta(alerta, (estado, observacion, button, select, input, feedback) => {
            void cambiarEstadoAlerta(alerta, estado, observacion, button, select, input, feedback);
        }));
        item.append(main, controls);
        destino.appendChild(item);
    });
    actualizarResumenEstadosAlertas();
}

async function cargarAlertasCompartidas({ silencioso = false } = {}) {
    if (alertasCargando || !obtenerToken()) return;
    alertasCargando = true;
    const feedback = document.getElementById("alert-report-feedback");
    try {
        const respuesta = await apiFetch("/alertas");
        if (!respuesta.ok || !Array.isArray(respuesta.data)) {
            throw new Error(respuesta.data?.detail || "No se pudieron cargar las alertas.");
        }
        const nuevaLista = respuesta.data;
        if (typeof registrarNotificacionesCambiosAlertas === "function") {
            registrarNotificacionesCambiosAlertas(nuevaLista);
        }
        const cambio = JSON.stringify(nuevaLista) !== JSON.stringify(alertasCompartidas);
        alertasCompartidas = nuevaLista;
        if (cambio || !silencioso) {
            if (typeof actualizarVistaSensores === "function" && Array.isArray(sensoresEnMapa)) {
                actualizarVistaSensores({ fechaTexto: "Alertas sincronizadas" });
            } else {
                renderizarAlertasReportadas();
            }
        }
        if (!silencioso && feedback) feedback.textContent = "Alertas actualizadas.";
    } catch (error) {
        if (feedback && !silencioso) feedback.textContent = error.message || "Error al consultar las alertas.";
    } finally {
        alertasCargando = false;
    }
}

async function enviarReporteAlerta(event) {
    event.preventDefault();
    const form = event.currentTarget;
    const submit = document.getElementById("alert-report-submit");
    const feedback = document.getElementById("alert-report-feedback");
    const titulo = document.getElementById("alert-report-title")?.value.trim();
    const descripcion = document.getElementById("alert-report-description")?.value.trim();
    if (submit) submit.disabled = true;
    form.classList.add("is-submitting");
    form.setAttribute("aria-busy", "true");
    if (feedback) feedback.textContent = "Enviando reporte…";

    try {
        const respuesta = await apiFetch("/alertas", {
            method: "POST",
            body: JSON.stringify({ titulo, descripcion })
        });
        if (!respuesta.ok) throw new Error(respuesta.data?.detail || "No se pudo enviar el reporte.");
        reemplazarAlertaCompartida(respuesta.data);
        form.reset();
        form.classList.remove("is-submitting", "is-success");
        void form.offsetWidth;
        form.classList.add("is-success");
        window.setTimeout(() => form.classList.remove("is-success"), 1400);
        if (feedback) feedback.textContent = "Aviso enviado al administrador. Podrás consultar aquí el estado.";
        renderizarAlertasReportadas();
        actualizarResumenEstadosAlertas();
    } catch (error) {
        if (feedback) feedback.textContent = error.message || "No se pudo enviar el reporte.";
    } finally {
        if (submit) submit.disabled = false;
        form.classList.remove("is-submitting");
        form.removeAttribute("aria-busy");
    }
}

function inicializarCentroAlertas() {
    if (alertasInicializadas) return;
    alertasInicializadas = true;
    configurarCentroAlertasPorRol();
    document.getElementById("alert-report-form")?.addEventListener("submit", enviarReporteAlerta);
    document.getElementById("alert-center-refresh")?.addEventListener("click", () => {
        void cargarAlertasCompartidas();
    });
    window.setInterval(() => {
        if (!document.hidden && obtenerToken()) {
            void cargarAlertasCompartidas({ silencioso: true });
        }
    }, 30000);
}
