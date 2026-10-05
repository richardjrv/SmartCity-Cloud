// ============================================================
// 👑 MÓDULO DE ADMINISTRACIÓN DE USUARIOS (FASE 3)
// ============================================================

async function cargarUsuariosAdmin() {
    const tabla = document.getElementById("tabla-usuarios-body");
    if (!tabla) return;

    tabla.innerHTML = `
        <tr>
            <td colspan="7" class="px-4 py-8 text-center text-slate-400">
                ⏳ Cargando usuarios...
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
        mostrarUsuariosTabla(data);

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
        const esAdmin = Number(usuario.id_rol) === 1;
        const activo = usuario.estado === "activo";
        const tr = document.createElement("tr");
        tr.className = "hover:bg-slate-700/30 transition border-b border-slate-700/30";

        tr.innerHTML = `
            <td class="px-4 py-3 font-mono text-slate-500">#${usuario.id}</td>

            <td class="px-4 py-3">
                <div class="font-semibold text-white">${escapeHTML(usuario.nombre)}</div>
                <div class="text-xs text-slate-500">@${escapeHTML(usuario.username)}</div>
            </td>

            <td class="px-4 py-3 text-slate-300">${escapeHTML(usuario.email)}</td>

            <td class="px-4 py-3">
                <span class="inline-flex px-2.5 py-1 rounded-full text-xs font-semibold ${
                    esAdmin
                        ? "bg-amber-500/10 text-amber-400 border border-amber-500/20"
                        : "bg-blue-500/10 text-blue-400 border border-blue-500/20"
                }">
                    ${esAdmin ? "👑 Admin" : "👤 Usuario"}
                </span>
            </td>

            <td class="px-4 py-3">
                <span class="inline-flex px-2.5 py-1 rounded-full text-xs font-semibold ${
                    activo
                        ? "bg-emerald-500/10 text-emerald-400 border border-emerald-500/20"
                        : "bg-rose-500/10 text-rose-400 border border-rose-500/20"
                }">
                    ${activo ? "🟢 Activo" : "🔴 Inactivo"}
                </span>
            </td>

            <td class="px-4 py-3 text-xs text-slate-400">
                ${formatearFecha(usuario.ultimo_acceso)}
            </td>

            <td class="px-4 py-3">
                <div class="flex justify-center gap-2">
                    <button onclick="cambiarRolUsuario(${usuario.id}, ${usuario.id_rol})"
                            class="px-2.5 py-1.5 rounded-lg bg-blue-500/10 text-blue-400 hover:bg-blue-500 hover:text-white transition text-xs"
                            title="Cambiar Rol">
                        🔄
                    </button>

                    <button onclick="cambiarEstadoUsuario(${usuario.id}, '${usuario.estado}')"
                            class="px-2.5 py-1.5 rounded-lg bg-amber-500/10 text-amber-400 hover:bg-amber-500 hover:text-white transition text-xs"
                            title="Activar/Desactivar">
                        ${activo ? "🔴" : "🟢"}
                    </button>

                    ${
                        Number(usuario.id) !== idUsuarioActual
                            ? `<button onclick="eliminarUsuario(${usuario.id})"
                                       class="px-2.5 py-1.5 rounded-lg bg-rose-500/10 text-rose-400 hover:bg-rose-500 hover:text-white transition text-xs"
                                       title="Eliminar usuario">
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
    if (!window.usuariosAdmin) return;

    const filtrados = window.usuariosAdmin.filter(usuario => {
        return (
            String(usuario.id).includes(texto) ||
            (usuario.nombre || "").toLowerCase().includes(texto) ||
            (usuario.email || "").toLowerCase().includes(texto) ||
            (usuario.username || "").toLowerCase().includes(texto) ||
            (usuario.rol || "").toLowerCase().includes(texto)
        );
    });

    mostrarUsuariosTabla(filtrados);
}

async function cambiarRolUsuario(usuarioId, rolActual) {
    const nuevoRol = Number(rolActual) === 1 ? 2 : 1;
    const nombreRol = nuevoRol === 1 ? "Administrador" : "Usuario";

    if (!confirm(`¿Cambiar el rol del usuario #${usuarioId} a ${nombreRol}?`)) return;

    await modificarUsuarioAdmin(usuarioId, { id_rol: nuevoRol });
}

async function cambiarEstadoUsuario(usuarioId, estadoActual) {
    const nuevoEstado = estadoActual === "activo" ? "inactivo" : "activo";

    if (!confirm(`¿Cambiar el estado del usuario #${usuarioId} a ${nuevoEstado}?`)) return;

    await modificarUsuarioAdmin(usuarioId, { estado: nuevoEstado });
}

async function modificarUsuarioAdmin(usuarioId, cambios) {
    try {
        const { ok, data } = await apiFetch(`/api/admin/usuarios/${usuarioId}`, {
            method: "PUT",
            body: JSON.stringify(cambios)
        });

        if (!ok) {
            alert("❌ " + (data.detail || "No se pudo modificar el usuario."));
            return;
        }

        alert("✅ " + data.mensaje);
        cargarUsuariosAdmin();
    } catch (error) {
        console.error("❌ Error modificando usuario:", error);
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