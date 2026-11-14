const NOVEDADES_MAX_BYTES = 3 * 1024 * 1024;

// Al entrar, destacamos la publicación más reciente sin interrumpir la navegación.
async function mostrarNovedadInicio() {
    const usuarioId = localStorage.getItem("user_id_cloud");
    if (!usuarioId) return;
    try {
        const respuesta = await apiFetch("/novedades");
        if (!respuesta.ok || !Array.isArray(respuesta.data) || !respuesta.data.length ||
            localStorage.getItem("user_id_cloud") !== usuarioId || !obtenerToken()) return;
        const inicio = document.getElementById("dashboard-overview");
        const dashboard = document.getElementById("vista-dashboard");
        if (!inicio || !dashboard) return;
        document.getElementById("novedad-inicio")?.remove();
        const novedad = respuesta.data[0];
        const tarjeta = document.createElement("aside");
        tarjeta.id = "novedad-inicio";
        tarjeta.className = "novedad-inicio";
        tarjeta.dataset.dashboardPanel = "dashboard";
        tarjeta.classList.toggle("hidden", dashboard.dataset.currentView !== "dashboard");
        tarjeta.setAttribute("aria-labelledby", "novedad-inicio-titulo");
        if (novedad.imagen_url) {
            const imagen = document.createElement("img");
            imagen.className = "novedad-inicio-imagen";
            imagen.src = novedad.imagen_url;
            imagen.alt = "";
            tarjeta.appendChild(imagen);
        }
        const contenido = document.createElement("div");
        contenido.className = "novedad-inicio-contenido";
        const etiqueta = document.createElement("p");
        etiqueta.className = "novedad-inicio-etiqueta";
        etiqueta.textContent = "Novedades";
        const titulo = document.createElement("h2");
        titulo.id = "novedad-inicio-titulo";
        titulo.textContent = novedad.titulo;
        const acciones = document.createElement("div");
        acciones.className = "novedad-inicio-acciones";
        const ver = document.createElement("button");
        ver.type = "button";
        ver.textContent = "Ver todas las novedades";
        ver.addEventListener("click", () => navegarA("novedades"));
        const cerrar = document.createElement("button");
        cerrar.type = "button";
        cerrar.textContent = "Cerrar";
        cerrar.setAttribute("aria-label", "Cerrar novedad destacada");
        cerrar.addEventListener("click", () => { tarjeta.remove(); document.getElementById("main-content")?.focus({ preventScroll: true }); });
        acciones.append(ver, cerrar);
        contenido.append(etiqueta, titulo, acciones);
        tarjeta.appendChild(contenido);
        inicio.insertAdjacentElement("afterend", tarjeta);
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
