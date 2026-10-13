let alertasCompartidas = [];
let alertasInicializadas = false;
let alertasCargando = false;

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

    const label = document.createElement("label");
    label.className = "alert-status-label";
    label.textContent = "Seguimiento (solo admin)";
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
    select.addEventListener("change", () => alCambiar(select.value, select));
    label.appendChild(select);
    return label;
}

async function cambiarEstadoAlerta(alerta, estado, control) {
    const estadoAnterior = alerta.estado;
    if (control) control.disabled = true;
    try {
        let respuesta;
        if (alerta.id) {
            respuesta = await apiFetch(`/alertas/${alerta.id}/estado`, {
                method: "PATCH",
                body: JSON.stringify({ estado })
            });
        } else {
            respuesta = await apiFetch("/alertas/sensor", {
                method: "PUT",
                body: JSON.stringify({
                    sensor_id: alerta.sensor_id,
                    metrica: alerta.metrica,
                    titulo: alerta.titulo,
                    descripcion: alerta.descripcion,
                    estado
                })
            });
        }
        if (!respuesta.ok) throw new Error(respuesta.data?.detail || "No se pudo actualizar el estado.");
        reemplazarAlertaCompartida(respuesta.data);
        if (typeof actualizarVistaSensores === "function" && alerta.origen === "sensor") {
            actualizarVistaSensores({ fechaTexto: "Estado de alerta actualizado" });
        } else {
            renderizarAlertasReportadas();
        }
        control?.classList.add("is-saved");
        window.setTimeout(() => control?.classList.remove("is-saved"), 1000);
        mostrarNotificacion("Estado de alerta actualizado.", "exito");
    } catch (error) {
        if (control) control.value = estadoAnterior;
        mostrarNotificacion(error.message || "No se pudo guardar el estado.", "error");
    } finally {
        if (control) control.disabled = false;
    }
}

function reemplazarAlertaCompartida(alerta) {
    const indice = alertasCompartidas.findIndex(item => item.id === alerta.id);
    if (indice >= 0) alertasCompartidas[indice] = alerta;
    else alertasCompartidas.unshift(alerta);
}

function renderizarAlertasReportadas(destino = document.getElementById("alert-center-list")) {
    if (!destino) return;
    destino.querySelectorAll("[data-alerta-reportada]").forEach(item => item.remove());
    const reportadas = alertasCompartidas.filter(alerta => alerta.origen === "usuario");

    reportadas.forEach(alerta => {
        const item = document.createElement("article");
        item.className = `alert-item alert-item--${alerta.estado}`;
        item.dataset.alertaReportada = String(alerta.id);

        const main = document.createElement("div");
        main.className = "alert-item-main";
        const body = document.createElement("div");
        const title = document.createElement("strong");
        title.textContent = alerta.titulo;
        const description = document.createElement("p");
        description.textContent = alerta.descripcion;
        const metadata = document.createElement("p");
        const fecha = alerta.creado_en ? new Date(alerta.creado_en) : null;
        const fechaTexto = fecha && !Number.isNaN(fecha.getTime())
            ? fecha.toLocaleString("es-EC", { dateStyle: "medium", timeStyle: "short" })
            : "Fecha no disponible";
        metadata.textContent = `Reportó ${alerta.creador || "usuario"} · ${fechaTexto}${alerta.sensor_id ? ` · ${alerta.sensor_id}` : ""}`;
        if (alerta.actualizador && alerta.actualizado_en && alerta.actualizado_por) {
            const fechaCambio = new Date(alerta.actualizado_en);
            const cambioTexto = Number.isNaN(fechaCambio.getTime())
                ? ""
                : fechaCambio.toLocaleString("es-EC", { dateStyle: "short", timeStyle: "short" });
            metadata.textContent += ` · Estado actualizado por ${alerta.actualizador}${cambioTexto ? ` el ${cambioTexto}` : ""}`;
        }
        body.append(title, description, metadata);
        main.appendChild(body);

        const controls = document.createElement("div");
        controls.className = "alert-item-controls";
        controls.appendChild(crearControlEstadoAlerta(alerta, (estado, select) => {
            void cambiarEstadoAlerta(alerta, estado, select);
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
    const sensorId = document.getElementById("alert-report-sensor")?.value.trim();
    if (submit) submit.disabled = true;
    form.classList.add("is-submitting");
    form.setAttribute("aria-busy", "true");
    if (feedback) feedback.textContent = "Enviando reporte…";

    try {
        const respuesta = await apiFetch("/alertas", {
            method: "POST",
            body: JSON.stringify({ titulo, descripcion, sensor_id: sensorId || null })
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
