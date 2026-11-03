// ============================================================
// 👤 MÓDULO DE PERFIL DE USUARIO (FASE 1)
// ============================================================

const AVATARES_SMARTCITY = Object.freeze({
    "": "👤", "avatar:explorador": "🧑‍🚀", "avatar:ciudadana": "👩‍💻",
    "avatar:ciudadano": "👨‍💻", "avatar:creativa": "👩‍🎨",
    "avatar:ingeniero": "👨‍🔧", "avatar:robot": "🤖"
});
let avatarPerfilActual = "";
function iconoAvatar(valor) { return Object.hasOwn(AVATARES_SMARTCITY, valor || "") ? AVATARES_SMARTCITY[valor || ""] : AVATARES_SMARTCITY[""]; }
function mostrarAvatarCuenta(valor) {
    avatarPerfilActual = valor || "";
    for (const id of ["perfil-avatar", "account-menu-avatar", "header-user-avatar"]) {
        const elemento = document.getElementById(id);
        if (!elemento) continue;
        elemento.textContent = iconoAvatar(avatarPerfilActual);
        if (/^https:\/\//i.test(avatarPerfilActual)) {
            const imagen = document.createElement("img");
            imagen.src = avatarPerfilActual;
            imagen.alt = "";
            imagen.referrerPolicy = "no-referrer";
            imagen.onerror = () => { elemento.textContent = iconoAvatar(""); };
            elemento.replaceChildren(imagen);
        }
    }
}

function renderizarOpcionesAvatar() {
    const select = document.getElementById("edit-avatar");
    const contenedor = document.getElementById("avatar-choices");
    if (!select || !contenedor) return;
    contenedor.replaceChildren();
    for (const option of select.options) {
        const boton = document.createElement("button");
        boton.type = "button";
        boton.className = "avatar-choice";
        boton.setAttribute("aria-pressed", String(option.value === select.value));
        boton.setAttribute("aria-label", option.textContent.trim());
        const icono = document.createElement("span");
        icono.className = "avatar-choice-icon";
        icono.setAttribute("aria-hidden", "true");
        icono.textContent = option.value === "__existente__" ? "🖼️" : iconoAvatar(option.value);
        const nombre = document.createElement("span");
        nombre.textContent = option.textContent.replace(/^\S+\s*/, "");
        boton.append(icono, nombre);
        boton.addEventListener("click", () => {
            select.value = option.value;
            renderizarOpcionesAvatar();
            contenedor.querySelector('[aria-pressed="true"]')?.focus();
        });
        contenedor.append(boton);
    }
}

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
        const rolNombre = ({ 1: "👑 Administrador", 2: "👤 Usuario", 3: "🛠️ Operador" })[Number(data.id_rol)] || "👤 Usuario";
        if (perfRol) perfRol.innerText = data.rol || rolNombre;
        const accountName = document.getElementById("account-menu-name");
        const accountEmail = document.getElementById("account-menu-email");
        const accountRole = document.getElementById("account-menu-role");
        if (accountName) accountName.textContent = data.nombre || "Usuario";
        if (accountEmail) accountEmail.textContent = data.email || "";
        if (accountRole) accountRole.textContent = data.rol || rolNombre;

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

        mostrarAvatarCuenta(data.avatar);

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
    const selectorAvatar = document.getElementById("edit-avatar");
    selectorAvatar.querySelector('[value="__existente__"]')?.remove();
    if (avatarPerfilActual && !Object.hasOwn(AVATARES_SMARTCITY, avatarPerfilActual)) {
        selectorAvatar.add(new Option("Conservar avatar actual", "__existente__"));
        selectorAvatar.value = "__existente__";
    } else selectorAvatar.value = avatarPerfilActual;
    renderizarOpcionesAvatar();

    document.getElementById("modal-editar-perfil")?.classList.remove("hidden");
    inputNombre?.focus();
}

function abrirModalCambiarPassword() {
    const inputAct = document.getElementById("pass-actual");
    const inputNue = document.getElementById("pass-nueva");

    if (inputAct) inputAct.value = "";
    if (inputNue) inputNue.value = "";

    document.getElementById("modal-cambiar-password")?.classList.remove("hidden");
    inputAct?.focus();
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

    const avatarSeleccionado = document.getElementById("edit-avatar").value;
    const avatar = avatarSeleccionado === "__existente__" ? avatarPerfilActual : avatarSeleccionado;
    try {
        const { ok, data } = await apiFetch("/api/perfil/editar", {
            method: "PUT",
            body: JSON.stringify({ nombre, username, avatar })
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
            mostrarAvatarCuenta(avatar);
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

    if (!password_nueva || password_nueva.length < 8) {
        alert("❌ La nueva contraseña debe tener al menos 8 caracteres.");
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
