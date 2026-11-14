const NOVEDADES_MAX_BYTES = 3 * 1024 * 1024;

function fechaLocalNovedad() {
    const ahora = new Date();
    return `${ahora.getFullYear()}-${ahora.getMonth() + 1}-${ahora.getDate()}`;
}

// El aviso se muestra al entrar; el usuario puede ocultar esa novedad por hoy.
async function mostrarNovedadInicio() {
    const usuarioId = localStorage.getItem("user_id_cloud");
    if (!usuarioId) return;
    try {
        const respuesta = await apiFetch("/novedades");
        if (!respuesta.ok || !Array.isArray(respuesta.data) || !respuesta.data.length ||
            localStorage.getItem("user_id_cloud") !== usuarioId || !obtenerToken()) return;
        const inicio = document.getElementById("dashboard-overview");
        const dashboard = document.getElementById("vista-dashboard");
        if (!inicio || !dashboard || dashboard.classList.contains("hidden") || dashboard.dataset.currentView !== "dashboard") return;
        document.getElementById("novedad-inicio")?.remove();
        const novedad = respuesta.data[0];
        const clave = `smartcity_novedad_oculta_${usuarioId}_${novedad.id}`;
        try { if (localStorage.getItem(clave) === fechaLocalNovedad()) return; } catch { /* El aviso sigue disponible sin almacenamiento local. */ }
        const tarjeta = document.createElement("dialog");
        tarjeta.id = "novedad-inicio";
        tarjeta.className = "novedad-inicio";
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
        etiqueta.textContent = "Novedad · SmartCity Cloud";
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
        tarjeta.addEventListener("close", () => {
            if (ocultar.checked) { try { localStorage.setItem(clave, fechaLocalNovedad()); } catch { /* Sin persistencia, podrá mostrarse de nuevo. */ } }
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
    form.classList.toggle("hidden", ![1, 3].includes(Number(localStorage.getItem("user_role_cloud"))));
    status.textContent = "Cargando novedades…";
    lista.replaceChildren();
    try {
        const respuesta = await apiFetch("/novedades");
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
            tarjeta.appendChild(titulo);
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
    document.getElementById("novedades-refresh")?.addEventListener("click", cargarNovedades);
    document.getElementById("novedades-form")?.addEventListener("submit", async event => {
        event.preventDefault();
        const form = event.currentTarget;
        const status = document.getElementById("novedades-status");
        const boton = document.getElementById("novedades-publicar");
        const archivo = document.getElementById("novedades-imagen").files[0];
        const titulo = document.getElementById("novedades-titulo").value.trim();
        if (!titulo || !archivo) { status.textContent = "Escribe un título y selecciona una imagen."; return; }
        if (archivo.size > NOVEDADES_MAX_BYTES || !["image/jpeg", "image/png", "image/webp"].includes(archivo.type)) {
            status.textContent = "Selecciona una imagen JPG, PNG o WebP de hasta 3 MB."; return;
        }
        boton.disabled = true;
        status.textContent = "Publicando novedad…";
        try {
            const imagen_base64 = await leerImagenNovedad(archivo);
            const respuesta = await apiFetch("/novedades", { method: "POST", body: JSON.stringify({ titulo, imagen_base64 }) });
            if (!respuesta.ok) throw new Error(typeof respuesta.data?.detail === "string" ? respuesta.data.detail : "No se pudo publicar la novedad.");
            form.reset();
            await cargarNovedades();
            status.textContent = "Novedad publicada.";
        } catch (error) { status.textContent = error.message || "No se pudo publicar la novedad."; }
        finally { boton.disabled = false; }
    });
});
