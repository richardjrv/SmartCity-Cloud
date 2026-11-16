const NOVEDADES_MAX_BYTES = 3 * 1024 * 1024;
const NOVEDADES_CATEGORIAS = Object.freeze({
    comunicado_oficial: "Comunicado oficial",
    aviso_importante: "Aviso importante",
    novedad_sistema: "Novedad del sistema",
    mantenimiento_programado: "Mantenimiento programado"
});
let diaVigenciaNovedades = null;
let relojVigenciaNovedades = null;

function nombreCategoriaNovedad(categoria) {
    return NOVEDADES_CATEGORIAS[categoria] || "Novedad del sistema";
}

function fechaHoyEcuador() {
    const partes = new Intl.DateTimeFormat("en-CA", {timeZone:"America/Guayaquil", year:"numeric", month:"2-digit", day:"2-digit"}).formatToParts(new Date());
    const valores = Object.fromEntries(partes.map(parte => [parte.type, parte.value]));
    return `${valores.year}-${valores.month}-${valores.day}`;
}

function actualizarFechasNovedad() {
    const inicio = document.getElementById("novedades-inicio");
    const fin = document.getElementById("novedades-fin");
    if (!inicio || !fin || !inicio.value) return;
    const [ano, mes, dia] = inicio.value.split("-").map(Number);
    const ultimoDia = new Date(Date.UTC(ano, mes + 1, 0)).getUTCDate();
    const limite = new Date(Date.UTC(ano, mes, Math.min(dia, ultimoDia)));
    limite.setUTCDate(limite.getUTCDate() - 1);
    fin.min = inicio.value;
    fin.max = limite.toISOString().slice(0, 10);
    if (!fin.value || fin.value < fin.min || fin.value > fin.max) fin.value = fin.min;
}

function inicializarFechasNovedad() {
    const inicio = document.getElementById("novedades-inicio");
    const fin = document.getElementById("novedades-fin");
    if (!inicio || !fin) return;
    inicio.value = fechaHoyEcuador();
    fin.value = inicio.value;
    actualizarFechasNovedad();
}

function formatearFechaNovedad(valor) {
    const partes = String(valor || "").split("-");
    return partes.length === 3 ? `${partes[2]}/${partes[1]}/${partes[0]}` : "";
}

function revisarCambioDiaNovedades() {
    const hoy = fechaHoyEcuador();
    if (diaVigenciaNovedades && diaVigenciaNovedades !== hoy) {
        const aviso = document.getElementById("novedad-inicio");
        if (aviso?.open && aviso.dataset.fechaFin && aviso.dataset.fechaFin < hoy) aviso.close();
        const vista = document.getElementById("vista-novedades");
        if (vista && !vista.classList.contains("hidden") && obtenerToken()) void cargarNovedades();
    }
    diaVigenciaNovedades = hoy;
    clearTimeout(relojVigenciaNovedades);
    const [ano, mes, dia] = hoy.split("-").map(Number);
    const proximaMedianoche = Date.UTC(ano, mes - 1, dia + 1, 5);
    relojVigenciaNovedades = setTimeout(revisarCambioDiaNovedades, Math.max(1000, proximaMedianoche - Date.now() + 1000));
}

async function eliminarNovedad(id, titulo, boton, status) {
    if (!window.confirm(`¿Eliminar «${titulo}»? Dejará de mostrarse; se conservará para recuperación.`)) return;
    boton.disabled = true;
    try {
        const respuesta = await apiFetch(`/novedades/${encodeURIComponent(id)}`, {method: "DELETE"});
        if (!respuesta.ok) throw new Error(respuesta.data?.detail || "No se pudo eliminar la novedad.");
        await cargarNovedades();
        status.textContent = "Novedad retirada del sitio.";
    } catch (error) {
        status.textContent = error.message || "No se pudo eliminar la novedad.";
        boton.disabled = false;
    }
}

function fechaLocalNovedad() {
    const ahora = new Date();
    return `${ahora.getFullYear()}-${ahora.getMonth() + 1}-${ahora.getDate()}`;
}

// El aviso se muestra al entrar; el usuario puede ocultar esa novedad por hoy.
async function mostrarNovedadInicio(idSeleccionado = null) {
    const usuarioId = localStorage.getItem("user_id_cloud");
    if (!usuarioId) return;
    try {
        const respuesta = await apiFetch("/novedades");
        if (!respuesta.ok || !Array.isArray(respuesta.data) || !respuesta.data.length ||
            localStorage.getItem("user_id_cloud") !== usuarioId || !obtenerToken()) return;
        const inicio = document.getElementById("dashboard-overview");
        const dashboard = document.getElementById("vista-dashboard");
        if (idSeleccionado === null && (!inicio || !dashboard || dashboard.classList.contains("hidden") || dashboard.dataset.currentView !== "dashboard")) return;
        const anuncioExistente = document.getElementById("novedad-inicio");
        if (anuncioExistente?.open) return;
        anuncioExistente?.remove();
        const novedad = idSeleccionado === null ? respuesta.data[0] : respuesta.data.find(item => String(item.id) === String(idSeleccionado));
        if (!novedad) { if (idSeleccionado !== null) mostrarNotificacion("Esta novedad ya no está disponible.", "info"); return; }
        const clave = `smartcity_novedad_oculta_${usuarioId}_${novedad.id}`;
        try { if (idSeleccionado === null && localStorage.getItem(clave) === fechaLocalNovedad()) return; } catch { /* El aviso sigue disponible sin almacenamiento local. */ }
        const tarjeta = document.createElement("dialog");
        tarjeta.id = "novedad-inicio";
        tarjeta.className = "novedad-inicio";
        tarjeta.dataset.fechaFin = novedad.fecha_fin || "";
        tarjeta.setAttribute("aria-labelledby", "novedad-inicio-titulo");
        const imagenMarco = document.createElement("div");
        imagenMarco.className = "novedad-inicio-portada";
        if (novedad.imagen_url) {
            const imagen = document.createElement("img");
            imagen.className = "novedad-inicio-imagen";
            imagen.src = novedad.imagen_url;
            imagen.alt = `Imagen de la novedad: ${novedad.titulo}`;
            imagenMarco.appendChild(imagen);
        }
        const cerrarSuperior = document.createElement("button");
        cerrarSuperior.type = "button";
        cerrarSuperior.className = "novedad-inicio-cerrar";
        cerrarSuperior.textContent = "×";
        cerrarSuperior.setAttribute("aria-label", "Cerrar novedad");
        cerrarSuperior.addEventListener("click", () => tarjeta.close());
        imagenMarco.appendChild(cerrarSuperior);
        tarjeta.appendChild(imagenMarco);
        const contenido = document.createElement("div");
        contenido.className = "novedad-inicio-contenido";
        const etiqueta = document.createElement("p");
        etiqueta.className = "novedad-inicio-etiqueta";
        etiqueta.textContent = `${nombreCategoriaNovedad(novedad.categoria)} · SmartCity Cloud`;
        const titulo = document.createElement("h2");
        titulo.id = "novedad-inicio-titulo";
        titulo.textContent = novedad.titulo;
        const acciones = document.createElement("div");
        acciones.className = "novedad-inicio-acciones";
        const ocultarEtiqueta = document.createElement("label");
        ocultarEtiqueta.className = "novedad-inicio-ocultar";
        const ocultar = document.createElement("input");
        ocultar.type = "checkbox";
        ocultarEtiqueta.append(ocultar, document.createTextNode(" No volver a mostrar hoy"));
        const botones = document.createElement("div");
        botones.className = "novedad-inicio-botones";
        const ver = document.createElement("button");
        ver.type = "button";
        ver.textContent = "Ver todas las novedades";
        ver.addEventListener("click", () => { tarjeta.close(); navegarA("novedades"); });
        const cerrar = document.createElement("button");
        cerrar.type = "button";
        cerrar.className = "novedad-inicio-boton-principal";
        cerrar.textContent = "Cerrar novedad";
        cerrar.setAttribute("aria-label", "Cerrar novedad destacada");
        cerrar.addEventListener("click", () => tarjeta.close());
        botones.append(ver, cerrar);
        acciones.append(ocultarEtiqueta, botones);
        contenido.append(etiqueta, titulo, acciones);
        tarjeta.appendChild(contenido);
        // Los diálogos nativos se dibujan en una capa superior a la página.
        // Mover el cursor a esa capa lo mantiene visible sin bloquear los clics.
        const cursor = document.getElementById("orbital-cursor");
        const contenedorCursor = cursor?.parentNode;
        const siguienteCursor = cursor?.nextSibling;
        if (cursor) tarjeta.appendChild(cursor);
        tarjeta.addEventListener("close", () => {
            if (ocultar.checked) { try { localStorage.setItem(clave, fechaLocalNovedad()); } catch { /* Sin persistencia, podrá mostrarse de nuevo. */ } }
            if (cursor && contenedorCursor) {
                contenedorCursor.insertBefore(cursor, siguienteCursor?.parentNode === contenedorCursor ? siguienteCursor : null);
            }
            tarjeta.remove();
        }, { once: true });
        document.body.appendChild(tarjeta);
        tarjeta.showModal();
        cerrarSuperior.focus();
    } catch (error) {
        console.info("No se pudo cargar la novedad de inicio.", error);
    }
}

async function cargarNovedades() {
    const form = document.getElementById("novedades-form");
    const lista = document.getElementById("novedades-lista");
    const status = document.getElementById("novedades-status");
    if (!form || !lista || !status) return;
    const puedeGestionar = [1, 3].includes(Number(localStorage.getItem("user_role_cloud")));
    form.classList.toggle("hidden", !puedeGestionar);
    status.textContent = "Cargando novedades…";
    lista.replaceChildren();
    try {
        const respuesta = await apiFetch(puedeGestionar ? "/novedades?gestion=true" : "/novedades");
        if (!respuesta.ok || !Array.isArray(respuesta.data)) throw new Error(respuesta.data?.detail || "No se pudieron cargar las novedades.");
        status.textContent = respuesta.data.length ? "" : "Todavía no hay novedades publicadas.";
        respuesta.data.forEach(novedad => {
            const tarjeta = document.createElement("article");
            tarjeta.className = "novedades-card";
            if (novedad.imagen_url) {
                const imagen = document.createElement("img");
                imagen.src = novedad.imagen_url;
                imagen.alt = "";
                imagen.loading = "lazy";
                tarjeta.appendChild(imagen);
            }
            const titulo = document.createElement("h3");
            titulo.textContent = novedad.titulo;
            const categoria = document.createElement("p");
            categoria.className = "novedades-card-categoria";
            categoria.textContent = nombreCategoriaNovedad(novedad.categoria);
            tarjeta.appendChild(categoria);
            tarjeta.appendChild(titulo);
            const vigencia = document.createElement("p");
            vigencia.className = "novedades-card-vigencia";
            const estado = novedad.activa ? "Vigente" : (novedad.fecha_inicio > fechaHoyEcuador() ? "Programada" : "Finalizada");
            vigencia.textContent = `${estado} · ${formatearFechaNovedad(novedad.fecha_inicio)} al ${formatearFechaNovedad(novedad.fecha_fin)}`;
            tarjeta.appendChild(vigencia);
            if (puedeGestionar) {
                const eliminar = document.createElement("button");
                eliminar.type = "button";
                eliminar.className = "novedades-card-eliminar";
                eliminar.textContent = "Eliminar";
                eliminar.setAttribute("aria-label", `Eliminar novedad ${novedad.titulo}`);
                eliminar.addEventListener("click", () => eliminarNovedad(novedad.id, novedad.titulo, eliminar, status));
                tarjeta.appendChild(eliminar);
            }
            lista.appendChild(tarjeta);
        });
    } catch (error) { status.textContent = error.message || "No se pudieron cargar las novedades."; }
}

function leerImagenNovedad(archivo) {
    return new Promise((resolve, reject) => {
        const lector = new FileReader();
        lector.onload = () => resolve(String(lector.result).split(",", 2)[1]);
        lector.onerror = () => reject(new Error("No se pudo leer la imagen."));
        lector.readAsDataURL(archivo);
    });
}

document.addEventListener("DOMContentLoaded", () => {
    revisarCambioDiaNovedades();
    document.addEventListener("visibilitychange", () => { if (!document.hidden) revisarCambioDiaNovedades(); });
    inicializarFechasNovedad();
    document.getElementById("novedades-inicio")?.addEventListener("change", actualizarFechasNovedad);
    document.getElementById("novedades-refresh")?.addEventListener("click", cargarNovedades);
    document.getElementById("novedades-form")?.addEventListener("submit", async event => {
        event.preventDefault();
        const form = event.currentTarget;
        const status = document.getElementById("novedades-status");
        const boton = document.getElementById("novedades-publicar");
        const archivo = document.getElementById("novedades-imagen").files[0];
        const titulo = document.getElementById("novedades-titulo").value.trim();
        const categoria = document.getElementById("novedades-categoria").value;
        const fecha_inicio = document.getElementById("novedades-inicio").value;
        const fecha_fin = document.getElementById("novedades-fin").value;
        if (!titulo || !archivo) { status.textContent = "Escribe un título y selecciona una imagen."; return; }
        if (!fecha_inicio || !fecha_fin || !document.getElementById("novedades-fin").checkValidity()) { status.textContent = "Elige un periodo válido de hasta un mes."; return; }
        if (archivo.size > NOVEDADES_MAX_BYTES || !["image/jpeg", "image/png", "image/webp"].includes(archivo.type)) {
            status.textContent = "Selecciona una imagen JPG, PNG o WebP de hasta 3 MB."; return;
        }
        boton.disabled = true;
        status.textContent = "Publicando novedad…";
        try {
            const imagen_base64 = await leerImagenNovedad(archivo);
            const respuesta = await apiFetch("/novedades", { method: "POST", body: JSON.stringify({ titulo, categoria, fecha_inicio, fecha_fin, imagen_base64 }) });
            if (!respuesta.ok) throw new Error(typeof respuesta.data?.detail === "string" ? respuesta.data.detail : "No se pudo publicar la novedad.");
            form.reset();
            inicializarFechasNovedad();
            await cargarNovedades();
            status.textContent = "Novedad publicada.";
        } catch (error) { status.textContent = error.message || "No se pudo publicar la novedad."; }
        finally { boton.disabled = false; }
    });
});
