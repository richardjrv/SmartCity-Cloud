// ============================================================
// 👤 MÓDULO DE PERFIL DE USUARIO (FASE 1)
// ============================================================

async function cargarPerfilUsuario() {
    const token = obtenerToken();
    if (!token) {
        cerrarSesion();
        return;
    }

    try {
        const { ok, status, data } = await apiFetch("/api/perfil");

        if (status === 401) {
            cerrarSesion();
            return;
        }

        if (!ok) {
            alert(data.detail || "No se pudo cargar el perfil.");
            return;
        }

        // Cargar datos en los elementos HTML
        const perfNombre = document.getElementById("perfil-nombre");
        const perfUser = document.getElementById("perfil-username");
        const perfEmail = document.getElementById("perfil-email");
        const perfRol = document.getElementById("perfil-rol");
        const perfEstado = document.getElementById("perfil-estado");
        const perfReg = document.getElementById("perfil-registro");
        const perfAcc = document.getElementById("perfil-acceso");
        const perfAvatar = document.getElementById("perfil-avatar");

        if (perfNombre) perfNombre.innerText = data.nombre || "-";
        if (perfUser) perfUser.innerText = `@${data.username || "-"}`;
        if (perfEmail) perfEmail.innerText = data.email || "-";
        if (perfRol) perfRol.innerText = data.rol || "👤 Usuario";
        const accountName = document.getElementById("account-menu-name");
        const accountEmail = document.getElementById("account-menu-email");
        const accountRole = document.getElementById("account-menu-role");
        if (accountName) accountName.textContent = data.nombre || "Usuario";
        if (accountEmail) accountEmail.textContent = data.email || "";
        if (accountRole) accountRole.textContent = data.rol || "Cuenta activa";

        if (perfEstado) {
            if (data.estado === "activo") {
                perfEstado.innerText = "🟢 Activo";
                perfEstado.className = "inline-flex items-center gap-1.5 text-emerald-400 font-semibold";
            } else {
                perfEstado.innerText = "🔴 Inactivo";
                perfEstado.className = "inline-flex items-center gap-1.5 text-rose-400 font-semibold";
            }
        }

        if (perfReg) perfReg.innerText = formatearFecha(data.fecha_registro);
        if (perfAcc) perfAcc.innerText = formatearFecha(data.ultimo_acceso);

        if (perfAvatar) {
            if (data.avatar) {
                perfAvatar.innerHTML = `<img src="${data.avatar}" alt="Avatar" class="w-full h-full object-cover">`;
            } else {
                perfAvatar.innerText = "👤";
            }
        }

    } catch (error) {
        console.error("❌ Error cargando perfil:", error);
    }
}

function formatearFecha(fecha) {
    if (!fecha) return "-";
    try {
        const date = new Date(fecha);
        if (isNaN(date.getTime())) return fecha;
        return date.toLocaleString("es-EC", {
            dateStyle: "medium",
            timeStyle: "short"
        });
    } catch {
        return fecha;
    }
}

// ============================================================
// ✏️ MODALES Y EDICIÓN DE PERFIL
// ============================================================

function abrirModalEditarPerfil() {
    const nombre = document.getElementById("perfil-nombre")?.innerText || "";
    const username = (document.getElementById("perfil-username")?.innerText || "").replace("@", "");

    const inputNombre = document.getElementById("edit-nombre");
    const inputUser = document.getElementById("edit-username");

    if (inputNombre) inputNombre.value = nombre;
    if (inputUser) inputUser.value = username;

    document.getElementById("modal-editar-perfil")?.classList.remove("hidden");
}

function abrirModalCambiarPassword() {
    const inputAct = document.getElementById("pass-actual");
    const inputNue = document.getElementById("pass-nueva");

    if (inputAct) inputAct.value = "";
    if (inputNue) inputNue.value = "";

    document.getElementById("modal-cambiar-password")?.classList.remove("hidden");
}

function cerrarModal(idModal) {
    document.getElementById(idModal)?.classList.add("hidden");
}

async function guardarEdicionPerfil(e) {
    e.preventDefault();

    const nombre = document.getElementById("edit-nombre")?.value.trim();
    const username = document.getElementById("edit-username")?.value.trim();

    if (!nombre || !username) {
        alert("Completa todos los campos.");
        return;
    }

    try {
        const { ok, data } = await apiFetch("/api/perfil/editar", {
            method: "PUT",
            body: JSON.stringify({ nombre, username })
        });

        if (ok) {
            alert("✅ Perfil actualizado correctamente.");
            cerrarModal("modal-editar-perfil");
            cargarPerfilUsuario();

            // Actualizar nombre en la barra de navegación
            const navNombre = document.getElementById("nav-usuario-nombre");
            if (navNombre) navNombre.innerText = nombre;
            const accountName = document.getElementById("account-menu-name");
            if (accountName) accountName.textContent = nombre;
        } else {
            alert("❌ " + (data.detail || "Error actualizando perfil."));
        }
    } catch (error) {
        console.error("❌ Error al guardar perfil:", error);
    }
}

async function guardarNuevaPassword(e) {
    e.preventDefault();

    const password_actual = document.getElementById("pass-actual")?.value;
    const password_nueva = document.getElementById("pass-nueva")?.value;

    if (!password_nueva || password_nueva.length < 6) {
        alert("❌ La nueva contraseña debe tener al menos 6 caracteres.");
        return;
    }

    try {
        const { ok, data } = await apiFetch("/api/perfil/cambiar-password", {
            method: "PUT",
            body: JSON.stringify({ password_actual, password_nueva })
        });

        if (ok) {
            alert("✅ " + (data.mensaje || "Contraseña actualizada exitosamente."));
            cerrarModal("modal-cambiar-password");
        } else {
            alert("❌ " + (data.detail || "No se pudo cambiar la contraseña."));
        }
    } catch (error) {
        console.error("❌ Error al cambiar contraseña:", error);
    }
}
