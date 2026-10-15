// ============================================================
// 👑 MÓDULO DE ADMINISTRACIÓN DE USUARIOS (FASE 3)
// ============================================================

let adminRoleReturnFocus = null;

document.addEventListener("keydown", event => {
    if (event.key === "Escape" && !document.getElementById("admin-role-dialog")?.classList.contains("hidden")) {
        cerrarSelectorRol();
    }
});

document.addEventListener("DOMContentLoaded", () => {
    document.querySelectorAll('input[name="admin-role-choice"]').forEach(input => {
        input.addEventListener("change", actualizarResumenCambioRol);
    });
});

async function cargarUsuariosAdmin() {
    const tabla = document.getElementById("tabla-usuarios-body");
    if (!tabla) return;

    tabla.innerHTML = `
        <tr>
            <td colspan="7" class="px-4 py-8 text-center text-slate-400">
                <span class="admin-loading-state" role="status" aria-label="Cargando usuarios">
                    <span class="admin-skeleton-line"></span><span class="admin-skeleton-line"></span><span class="admin-skeleton-line"></span>
                </span>
            </td>
        </tr>
    `;

    try {
        const { ok, status, data } = await apiFetch("/api/admin/usuarios");

        if (status === 403) {
            alert("⛔ No tienes permisos de Administrador.");
            navegarA("dashboard");
            return;
        }

        if (!ok) {
            throw new Error(data.detail || "Error cargando usuarios.");
        }

        window.usuariosAdmin = data;
        actualizarResumenUsuariosAdmin(data);
        mostrarUsuariosTabla(data);
        const resumen = document.getElementById("admin-filter-results");
        if (resumen) resumen.textContent = `Mostrando ${data.length} de ${data.length} cuentas`;

    } catch (error) {
        console.error("❌ Error admin usuarios:", error);
        tabla.innerHTML = `
            <tr>
                <td colspan="7" class="px-4 py-8 text-center text-rose-400">
                    ❌ ${error.message}
                </td>
            </tr>
        `;
    }
}

function actualizarResumenUsuariosAdmin(usuarios = []) {
    const total = document.getElementById("admin-total-users");
    const activos = document.getElementById("admin-active-users");
    const admins = document.getElementById("admin-admin-users");
    const operators = document.getElementById("admin-operator-users");
    if (total) total.textContent = String(usuarios.length);
    if (activos) activos.textContent = String(usuarios.filter(usuario => usuario.estado === "activo").length);
    if (admins) admins.textContent = String(usuarios.filter(usuario => Number(usuario.id_rol) === 1).length);
    if (operators) operators.textContent = String(usuarios.filter(usuario => Number(usuario.id_rol) === 3).length);
}

function mostrarUsuariosTabla(usuarios) {
    const tabla = document.getElementById("tabla-usuarios-body");
    if (!tabla) return;

    tabla.innerHTML = "";

    if (!usuarios || !usuarios.length) {
        tabla.innerHTML = `
            <tr>
                <td colspan="7" class="px-4 py-8 text-center text-slate-400">
                    No existen usuarios registrados.
                </td>
            </tr>
        `;
        return;
    }

    const idUsuarioActual = Number(localStorage.getItem("user_id_cloud"));

    usuarios.forEach(usuario => {
        const rolId = Number(usuario.id_rol);
        const activo = usuario.estado === "activo";
        const estiloRol = rolId === 1
            ? "bg-amber-500/10 text-amber-400 border border-amber-500/20"
            : rolId === 3
                ? "bg-violet-500/10 text-violet-300 border border-violet-500/20"
                : "bg-blue-500/10 text-blue-400 border border-blue-500/20";
        const tr = document.createElement("tr");
        tr.className = "hover:bg-slate-700/30 transition border-b border-slate-700/30";

        tr.innerHTML = `
            <td class="px-4 py-3 font-mono text-slate-500" data-label="ID">#${usuario.id}</td>

            <td class="px-4 py-3" data-label="Usuario">
                <div class="admin-user-identity">
                    <div class="font-semibold text-white">${escapeHTML(usuario.nombre)}</div>
                    <div class="text-xs text-slate-500">@${escapeHTML(usuario.username)}</div>
                </div>
            </td>

            <td class="px-4 py-3 text-slate-300" data-label="Correo">${escapeHTML(usuario.email)}</td>

            <td class="px-4 py-3" data-label="Rol">
                <span class="inline-flex px-2.5 py-1 rounded-full text-xs font-semibold ${estiloRol}">
                    ${escapeHTML(usuario.rol)}
                </span>
            </td>

            <td class="px-4 py-3" data-label="Estado">
                <span class="inline-flex px-2.5 py-1 rounded-full text-xs font-semibold ${
                    activo
                        ? "bg-emerald-500/10 text-emerald-400 border border-emerald-500/20"
                        : "bg-rose-500/10 text-rose-400 border border-rose-500/20"
                }">
                    ${activo ? "🟢 Activo" : "🔴 Inactivo"}
                </span>
            </td>

            <td class="px-4 py-3 text-xs text-slate-400" data-label="Último acceso">
                ${formatearFecha(usuario.ultimo_acceso)}
            </td>

            <td class="px-4 py-3" data-label="Acciones">
                <div class="flex justify-center gap-2">
                    ${Number(usuario.id) !== idUsuarioActual ? `<button onclick="cambiarRolUsuario(${usuario.id})"
                            class="admin-change-role-button"
                            aria-label="Cambiar rol de ${escapeHTML(usuario.nombre || usuario.email || `usuario ${usuario.id}`)}"
                            title="Cambiar rol">
                        <span aria-hidden="true">✎</span><span>Cambiar rol</span>
                    </button>` : ""}

                    <button onclick="cambiarEstadoUsuario(${usuario.id}, '${usuario.estado}')"
                            class="px-2.5 py-1.5 rounded-lg bg-amber-500/10 text-amber-400 hover:bg-amber-500 hover:text-white transition text-xs"
                            title="Activar/Desactivar" aria-label="${activo ? "Desactivar" : "Activar"} cuenta de ${escapeHTML(usuario.nombre || usuario.email || `usuario ${usuario.id}`)}">
                        ${activo ? "🔴" : "🟢"}
                    </button>

                    ${
                        Number(usuario.id) !== idUsuarioActual
                            ? `<button onclick="eliminarUsuario(${usuario.id})"
                                       class="px-2.5 py-1.5 rounded-lg bg-rose-500/10 text-rose-400 hover:bg-rose-500 hover:text-white transition text-xs"
                                       title="Eliminar usuario" aria-label="Eliminar cuenta de ${escapeHTML(usuario.nombre || usuario.email || `usuario ${usuario.id}`)}">
                                    🗑️
                               </button>`
                            : ""
                    }
                </div>
            </td>
        `;

        tabla.appendChild(tr);
    });
}

function filtrarUsuarios() {
    const texto = (document.getElementById("buscar-usuario")?.value || "").toLowerCase().trim();
    const rolSeleccionado = document.getElementById("admin-filter-role")?.value || "todos";
    const estadoSeleccionado = document.getElementById("admin-filter-state")?.value || "todos";
    if (!window.usuariosAdmin) return;

    const filtrados = window.usuariosAdmin.filter(usuario => {
        const coincideTexto = (
            String(usuario.id).includes(texto) ||
            (usuario.nombre || "").toLowerCase().includes(texto) ||
            (usuario.email || "").toLowerCase().includes(texto) ||
            (usuario.username || "").toLowerCase().includes(texto) ||
            (usuario.rol || "").toLowerCase().includes(texto)
        );
        const coincideRol = rolSeleccionado === "todos" || Number(usuario.id_rol) === Number(rolSeleccionado);
        const coincideEstado = estadoSeleccionado === "todos" || usuario.estado === estadoSeleccionado;
        return coincideTexto && coincideRol && coincideEstado;
    });

    mostrarUsuariosTabla(filtrados);
    const resumen = document.getElementById("admin-filter-results");
    if (resumen) resumen.textContent = `Mostrando ${filtrados.length} de ${window.usuariosAdmin.length} cuentas`;
}

function cambiarRolUsuario(usuarioId) {
    const usuario = (window.usuariosAdmin || []).find(item => Number(item.id) === Number(usuarioId));
    const modal = document.getElementById("admin-role-dialog");
    if (!usuario || !modal) return;

    adminRoleReturnFocus = document.activeElement;
    document.getElementById("admin-role-user-name").textContent = usuario.nombre || usuario.username || usuario.email || `Usuario #${usuario.id}`;
    document.getElementById("admin-role-user-email").textContent = usuario.email || `Cuenta #${usuario.id}`;
    document.getElementById("admin-role-current").textContent = usuario.rol || nombreRolAdmin(usuario.id_rol);
    document.getElementById("admin-role-user-id").value = String(usuario.id);
    const opcionActual = modal.querySelector(`input[name="admin-role-choice"][value="${Number(usuario.id_rol)}"]`);
    if (opcionActual) opcionActual.checked = true;
    const feedback = document.getElementById("admin-role-feedback");
    if (feedback) feedback.textContent = "";
    const guardar = document.getElementById("admin-role-save");
    if (guardar) { guardar.disabled = false; guardar.textContent = "Guardar cambios"; }
    actualizarResumenCambioRol();
    modal.classList.remove("hidden");
    modal.classList.add("flex");
    modal.setAttribute("aria-hidden", "false");
    modal.querySelector('input[name="admin-role-choice"]:checked')?.focus();
}

function nombreRolAdmin(rolId) {
    return ({ 1: "Administrador", 2: "Usuario", 3: "Operador" })[Number(rolId)] || "Sin rol";
}

function actualizarResumenCambioRol() {
    const id = Number(document.getElementById("admin-role-user-id")?.value);
    const rolId = Number(document.querySelector('#admin-role-dialog input[name="admin-role-choice"]:checked')?.value);
    const usuario = (window.usuariosAdmin || []).find(item => Number(item.id) === id);
    const summary = document.getElementById("admin-role-change-summary");
    const boton = document.getElementById("admin-role-save");
    if (!summary || !usuario || !boton) return;
    const rolActual = Number(usuario.id_rol);
    if (rolActual === rolId) {
        summary.textContent = `Esta cuenta ya tiene el rol ${nombreRolAdmin(rolId)}. Selecciona otro para aplicar un cambio.`;
        boton.disabled = true;
        boton.textContent = "Sin cambios";
        return;
    }
    const permisos = {
        1: "gestionar cuentas, permisos y actuadores",
        2: "consultar el monitoreo y enviar reportes",
        3: "atender alertas y registrar su seguimiento"
    };
    const nombre = usuario.nombre || usuario.username || usuario.email || `Usuario #${usuario.id}`;
    summary.textContent = `Vas a asignar el rol ${nombreRolAdmin(rolId)} a ${nombre}. Tendrá permisos para ${permisos[rolId]}. Confirma para guardar.`;
    boton.disabled = false;
    boton.textContent = `Confirmar: ${nombreRolAdmin(rolId)}`;
}

function cerrarSelectorRol() {
    const modal = document.getElementById("admin-role-dialog");
    if (!modal) return;
    modal.classList.add("hidden");
    modal.classList.remove("flex");
    modal.setAttribute("aria-hidden", "true");
    if (adminRoleReturnFocus?.isConnected) adminRoleReturnFocus.focus();
    adminRoleReturnFocus = null;
}

async function guardarRolSeleccionado(event) {
    event.preventDefault();
    const id = Number(document.getElementById("admin-role-user-id")?.value);
    const rolId = Number(document.querySelector('input[name="admin-role-choice"]:checked')?.value);
    const usuario = (window.usuariosAdmin || []).find(item => Number(item.id) === id);
    if (!usuario || ![1, 2, 3].includes(rolId)) return;
    if (Number(usuario.id_rol) === rolId) { cerrarSelectorRol(); return; }

    const boton = document.getElementById("admin-role-save");
    const feedback = document.getElementById("admin-role-feedback");
    boton.disabled = true;
    boton.textContent = "Guardando…";
    if (feedback) feedback.textContent = "Aplicando el nuevo rol…";
    const actualizado = await modificarUsuarioAdmin(id, { id_rol: rolId }, { silencioso: true });
    if (actualizado) {
        cerrarSelectorRol();
        mostrarNotificacion(`Rol de ${usuario.nombre || usuario.email} actualizado a ${nombreRolAdmin(rolId)}.`, "exito");
    }
    else {
        boton.disabled = false;
        boton.textContent = "Guardar cambios";
        if (feedback) feedback.textContent = "No se pudo guardar. Revisa el mensaje y vuelve a intentarlo.";
    }
}

async function cambiarEstadoUsuario(usuarioId, estadoActual) {
    const nuevoEstado = estadoActual === "activo" ? "inactivo" : "activo";
    const usuario = (window.usuariosAdmin || []).find(item => Number(item.id) === Number(usuarioId));
    const nombre = usuario?.nombre || usuario?.email || `usuario #${usuarioId}`;

    if (!confirm(`¿${nuevoEstado === "activo" ? "Activar" : "Desactivar"} la cuenta de ${nombre}?`)) return;

    await modificarUsuarioAdmin(usuarioId, { estado: nuevoEstado });
}

async function modificarUsuarioAdmin(usuarioId, cambios, opciones = {}) {
    try {
        const { ok, data } = await apiFetch(`/api/admin/usuarios/${usuarioId}`, {
            method: "PUT",
            body: JSON.stringify(cambios)
        });

        if (!ok) {
            alert("❌ " + (data.detail || "No se pudo modificar el usuario."));
            return false;
        }

        if (!opciones.silencioso) mostrarNotificacion(data.mensaje || "Cambios guardados.", "exito");
        cargarUsuariosAdmin();
        return true;
    } catch (error) {
        console.error("❌ Error modificando usuario:", error);
        mostrarNotificacion("No se pudo conectar con el servidor para guardar el cambio.", "error");
        return false;
    }
}

async function eliminarUsuario(usuarioId) {
    if (!confirm(`⚠️ ¿Seguro que deseas eliminar al usuario #${usuarioId}?\n\nEsta acción no se puede deshacer.`)) return;

    try {
        const { ok, data } = await apiFetch(`/api/admin/usuarios/${usuarioId}`, {
            method: "DELETE"
        });

        if (!ok) {
            alert("❌ " + (data.detail || "No se pudo eliminar el usuario."));
            return;
        }

        alert("✅ " + data.mensaje);
        cargarUsuariosAdmin();
    } catch (error) {
        console.error("❌ Error eliminando usuario:", error);
    }
}

function escapeHTML(text) {
    if (text === null || text === undefined) return "";
    return String(text)
        .replaceAll("&", "&amp;")
        .replaceAll("<", "&lt;")
        .replaceAll(">", "&gt;")
        .replaceAll('"', "&quot;")
        .replaceAll("'", "&#039;");
}
