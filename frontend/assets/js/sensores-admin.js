(() => {
    const roleLabels = {
        1: "Administra el catálogo y los datos técnicos de cada sensor.",
        2: "Consulta el inventario y las últimas comunicaciones de los sensores.",
        3: "Supervisa el estado y la comunicación de los sensores; la edición corresponde a Admin."
    };
    const fieldLabels = {
        temperatura: "Temperatura",
        humedad: "Humedad",
        calidad_aire: "Calidad del aire",
        distancia_cm: "Distancia HC-SR04",
        lluvia_detectada: "Detección de lluvia",
        luminosidad: "Luminosidad LDR",
        nivel_agua: "Nivel de agua",
        reflectancia_tcrt5000: "Reflectancia TCRT5000",
        tcrt5000_detectado: "Detección TCRT5000"
    };
    const stateLabels = { activo: "Activo", pendiente: "Pendiente", inactivo: "Inactivo" };
    const connectionLabels = {
        conectado: "Datos recientes",
        sin_lecturas: "Sin lecturas",
        sin_datos_recientes: "Sin datos recientes"
    };
    let sensors = [];
    let sensorById = new Map();
    let returnFocus = null;
    let loading = false;

    const byId = id => document.getElementById(id);

    function fechaLocal(value) {
        if (!value) return "Sin lecturas registradas";
        const date = new Date(value);
        if (Number.isNaN(date.getTime())) return "Fecha no disponible";
        return new Intl.DateTimeFormat("es-EC", { dateStyle: "medium", timeStyle: "short" }).format(date);
    }

    function crearElemento(tag, className, text) {
        const element = document.createElement(tag);
        if (className) element.className = className;
        if (text !== undefined) element.textContent = text;
        return element;
    }

    function crearDato(label, value) {
        const item = crearElemento("div", "sensor-catalog-detail");
        item.append(crearElemento("span", "", label), crearElemento("strong", "", value || "Sin información"));
        return item;
    }

    function crearSensorCard(sensor, puedeEditar) {
        const card = crearElemento("article", `sensor-catalog-card sensor-catalog-card--${sensor.estado || "pendiente"}`);
        const top = crearElemento("div", "sensor-catalog-card-top");
        const title = crearElemento("div", "sensor-catalog-card-title");
        title.append(
            crearElemento("span", "sensor-catalog-sensor-icon", "◉"),
            (() => {
                const copy = document.createElement("div");
                copy.append(crearElemento("h4", "", sensor.nombre || "Sensor sin nombre"));
                copy.append(crearElemento("p", "", sensor.codigo || "Código sin asignar"));
                return copy;
            })()
        );
        const badges = crearElemento("div", "sensor-catalog-badges");
        badges.append(
            crearElemento("span", `sensor-catalog-state sensor-catalog-state--${sensor.estado || "pendiente"}`, stateLabels[sensor.estado] || "Pendiente"),
            crearElemento("span", `sensor-catalog-connection sensor-catalog-connection--${sensor.estado_conexion || "sin_lecturas"}`, connectionLabels[sensor.estado_conexion] || "Estado desconocido")
        );
        top.append(title, badges);

        const metrics = crearElemento("div", "sensor-catalog-magnitudes");
        const magnitudes = Array.isArray(sensor.magnitudes) ? sensor.magnitudes : [];
        if (magnitudes.length) {
            magnitudes.forEach(name => {
                const tag = crearElemento("span", "sensor-catalog-tag", name);
                metrics.append(tag);
            });
        } else {
            metrics.append(crearElemento("span", "sensor-catalog-muted", "Aún no se asocia una magnitud"));
        }

        const details = crearElemento("div", "sensor-catalog-details");
        details.append(
            crearDato("Modelo", sensor.modelo),
            crearDato("Ubicación", sensor.ubicacion),
            crearDato("Objeto 3D", sensor.objeto_modelo),
            crearDato("Última lectura", fechaLocal(sensor.ultima_lectura))
        );
        const footer = crearElemento("div", "sensor-catalog-card-footer");
        footer.append(crearElemento("span", "sensor-catalog-controller-label", `Vinculado a ${sensor.id_controlador || "ESP32"}`));
        if (puedeEditar) {
            const edit = crearElemento("button", "sensor-catalog-edit", "Editar ficha");
            edit.type = "button";
            edit.dataset.sensorEditId = String(sensor.id_sensor);
            edit.setAttribute("aria-label", `Editar ficha de ${sensor.nombre || "sensor"}`);
            footer.append(edit);
        }
        card.append(top, metrics, details);
        if (sensor.observaciones) card.append(crearElemento("p", "sensor-catalog-observations", sensor.observaciones));
        card.append(footer);
        return card;
    }

    function renderizarSensores() {
        const grid = byId("sensor-catalog-grid");
        if (!grid) return;
        const role = Number(localStorage.getItem("user_role_cloud"));
        const puedeEditar = role === 1;
        const active = sensors.filter(sensor => sensor.estado === "activo").length;
        const online = sensors.filter(sensor => sensor.estado_conexion === "conectado").length;
        const addButton = byId("sensor-catalog-add");
        const puedeRegistrar = role === 1;
        byId("sensor-catalog-total").textContent = String(sensors.length);
        byId("sensor-catalog-active").textContent = String(active);
        byId("sensor-catalog-online").textContent = String(online);
        byId("sensor-catalog-role-copy").textContent = roleLabels[role] || "Consulta el catálogo de sensores del ESP32.";
        byId("sensor-catalog-list-caption").textContent = puedeEditar
            ? "Actualiza el inventario y revisa la comunicación recibida desde el ESP32."
            : "Estado, magnitudes y hora de la última comunicación recibida.";
        if (addButton) {
            const registrados = new Set(sensors.map(sensor => sensor.codigo));
            const disponibles = Object.keys(fieldLabels).filter(field => !registrados.has(`ESP32:${field}`));
            addButton.classList.toggle("hidden", !puedeRegistrar);
            addButton.disabled = !disponibles.length;
            addButton.title = disponibles.length ? "Registrar un canal compatible con el ESP32" : "Todos los canales admitidos ya están registrados";
        }
        byId("sensor-catalog-filter-wrap")?.classList.toggle("hidden", ![1, 3].includes(role));

        if (!sensors.length) {
            const empty = crearElemento("p", "sensor-catalog-empty", "Todavía no hay sensores registrados en el catálogo.");
            empty.append(crearElemento("span", "", "Aparecerán cuando el ESP32 envíe una lectura de cada magnitud."));
            grid.replaceChildren(empty);
            return;
        }
        const filter = byId("sensor-catalog-filter")?.value || "todos";
        const visibleSensors = sensors.filter(sensor => {
            if (filter === "sin_datos") return sensor.estado_conexion !== "conectado";
            if (filter === "inactivos") return sensor.estado === "inactivo";
            return true;
        });
        if (!visibleSensors.length) {
            grid.replaceChildren(crearElemento("p", "sensor-catalog-empty", "No hay sensores para este filtro."));
            return;
        }
        grid.replaceChildren(...visibleSensors.map(sensor => crearSensorCard(sensor, puedeEditar)));
    }

    async function cargarCatalogoSensores() {
        if (loading) return;
        const grid = byId("sensor-catalog-grid");
        const status = byId("sensor-catalog-status");
        const refresh = byId("sensor-catalog-refresh");
        if (!grid) return;
        loading = true;
        if (refresh) refresh.disabled = true;
        if (status) status.textContent = "Consultando el inventario del ESP32…";
        try {
            const response = await apiFetch("/sensores/catalogo", { timeoutMs: 15000 });
            if (!response.ok) throw new Error(response.data?.detail || "No se pudo cargar el catálogo.");
            sensors = Array.isArray(response.data?.sensores) ? response.data.sensores : [];
            sensorById = new Map(sensors.map(sensor => [String(sensor.id_sensor), sensor]));
            renderizarSensores();
            if (status) status.textContent = `Inventario actualizado · ${new Intl.DateTimeFormat("es-EC", { timeStyle: "short" }).format(new Date())}`;
        } catch (error) {
            grid.replaceChildren(crearElemento("p", "sensor-catalog-empty sensor-catalog-empty--error", error.message || "No se pudo consultar el inventario."));
            if (status) status.textContent = "Comprueba tu conexión y vuelve a intentarlo.";
        } finally {
            loading = false;
            if (refresh) refresh.disabled = false;
        }
    }

    function cerrarEditor() {
        const dialog = byId("sensor-edit-dialog");
        dialog?.classList.add("hidden");
        dialog?.setAttribute("aria-hidden", "true");
        byId("sensor-edit-feedback").textContent = "";
        returnFocus?.focus();
        returnFocus = null;
    }

    function abrirEditor(sensor, trigger) {
        const dialog = byId("sensor-edit-dialog");
        const form = byId("sensor-edit-form");
        if (!dialog || !form || !sensor) return;
        returnFocus = trigger;
        form.dataset.mode = "edit";
        form.dataset.sensorId = String(sensor.id_sensor);
        byId("sensor-edit-campo-wrap").classList.add("hidden");
        form.elements.campo.disabled = true;
        byId("sensor-edit-state-wrap").classList.remove("hidden");
        form.elements.nombre.value = sensor.nombre || "";
        form.elements.modelo.value = sensor.modelo || "";
        form.elements.ubicacion.value = sensor.ubicacion || "";
        form.elements.estado.value = sensor.estado || "pendiente";
        form.elements.objeto_modelo.value = sensor.objeto_modelo || "";
        form.elements.observaciones.value = sensor.observaciones || "";
        byId("sensor-edit-title").textContent = sensor.nombre || "Editar sensor";
        dialog.classList.remove("hidden");
        dialog.setAttribute("aria-hidden", "false");
        byId("sensor-edit-feedback").textContent = "";
        form.elements.nombre.focus();
    }

    function abrirRegistro(trigger) {
        const dialog = byId("sensor-edit-dialog");
        const form = byId("sensor-edit-form");
        const field = byId("sensor-edit-campo");
        if (!dialog || !form || !field) return;
        returnFocus = trigger;
        form.reset();
        form.dataset.mode = "create";
        form.dataset.sensorId = "";
        const registrados = new Set(sensors.map(sensor => sensor.codigo));
        [...field.options].forEach(option => {
            if (option.value) option.disabled = registrados.has(`ESP32:${option.value}`);
        });
        field.disabled = false;
        byId("sensor-edit-campo-wrap").classList.remove("hidden");
        byId("sensor-edit-state-wrap").classList.add("hidden");
        byId("sensor-edit-title").textContent = "Registrar canal del ESP32";
        byId("sensor-edit-feedback").textContent = "";
        dialog.classList.remove("hidden");
        dialog.setAttribute("aria-hidden", "false");
        field.focus();
    }

    async function guardarSensor(event) {
        event.preventDefault();
        const form = event.currentTarget;
        const id = form.dataset.sensorId;
        const isCreate = form.dataset.mode === "create";
        const save = byId("sensor-edit-save");
        const feedback = byId("sensor-edit-feedback");
        const payload = Object.fromEntries(new FormData(form).entries());
        if (!isCreate && !sensorById.has(String(id))) {
            feedback.textContent = "No se pudo identificar el sensor. Actualiza el catálogo.";
            return;
        }
        if (isCreate) delete payload.estado;
        else delete payload.campo;
        save.disabled = true;
        feedback.textContent = "Guardando cambios…";
        try {
            const response = await apiFetch(isCreate ? "/sensores/catalogo" : `/sensores/catalogo/${encodeURIComponent(id)}`, {
                method: isCreate ? "POST" : "PATCH",
                timeoutMs: 15000,
                body: JSON.stringify(payload)
            });
            if (!response.ok) throw new Error(response.data?.detail || "No se pudieron guardar los cambios.");
            cerrarEditor();
            mostrarNotificacion(isCreate ? "Canal del ESP32 registrado." : "Ficha del sensor actualizada.", "exito");
            await cargarCatalogoSensores();
        } catch (error) {
            feedback.textContent = error.message || "No se pudieron guardar los cambios.";
        } finally {
            save.disabled = false;
        }
    }

    window.cargarCatalogoSensores = cargarCatalogoSensores;
    window.addEventListener("DOMContentLoaded", () => {
        byId("sensor-catalog-refresh")?.addEventListener("click", () => void cargarCatalogoSensores());
        byId("sensor-catalog-filter")?.addEventListener("change", renderizarSensores);
        byId("sensor-catalog-add")?.addEventListener("click", event => abrirRegistro(event.currentTarget));
        byId("sensor-catalog-grid")?.addEventListener("click", event => {
            const trigger = event.target.closest("[data-sensor-edit-id]");
            if (!trigger) return;
            abrirEditor(sensorById.get(trigger.dataset.sensorEditId), trigger);
        });
        byId("sensor-edit-form")?.addEventListener("submit", guardarSensor);
        byId("sensor-edit-cancel")?.addEventListener("click", cerrarEditor);
        byId("sensor-edit-close")?.addEventListener("click", cerrarEditor);
        byId("sensor-edit-dialog")?.addEventListener("click", event => {
            if (event.target === event.currentTarget) cerrarEditor();
        });
        byId("sensor-edit-dialog")?.addEventListener("keydown", event => {
            if (event.key === "Escape") cerrarEditor();
        });
    });
})();
