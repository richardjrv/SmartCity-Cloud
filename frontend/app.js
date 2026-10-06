// ============================================================
// 🌐 CONFIGURACIÓN
// ============================================================

const API_URL = "https://smartcity-backend-shdc.onrender.com";


// ============================================================
// 🎨 INICIALIZAR LUCIDE
// ============================================================

if (typeof lucide !== "undefined") {
    lucide.createIcons();
}


// ============================================================
// 🔐 TOKEN
// ============================================================

function obtenerToken() {
    return localStorage.getItem("token_cloud");
}


// ============================================================
// 🎨 TEMA
// ============================================================

const htmlTag = document.documentElement;
const themeToggleBtn = document.getElementById("theme-toggle");
const themeIcon = document.getElementById("theme-icon");

const savedTheme = localStorage.getItem("theme_cloud") || "dark";

setTheme(savedTheme);

if (themeToggleBtn) {
    themeToggleBtn.addEventListener("click", () => {

        const currentTheme =
            htmlTag.getAttribute("data-theme") || "dark";

        setTheme(
            currentTheme === "dark"
                ? "light"
                : "dark"
        );
    });
}

function setTheme(theme) {

    htmlTag.setAttribute(
        "data-theme",
        theme
    );

    localStorage.setItem(
        "theme_cloud",
        theme
    );

    if (themeIcon) {

        themeIcon.setAttribute(
            "data-lucide",
            theme === "light"
                ? "sun"
                : "moon"
        );

        if (typeof lucide !== "undefined") {
            lucide.createIcons();
        }
    }
}


// ============================================================
// 🎨 COLOR DE ACENTO
// ============================================================

const savedAccent =
    localStorage.getItem("accent_cloud") || "blue";

setAccent(savedAccent);

document.querySelectorAll(".color-dot").forEach(dot => {

    dot.addEventListener("click", (e) => {

        setAccent(
            e.currentTarget.getAttribute("data-color")
        );

    });

});

function setAccent(color) {

    htmlTag.setAttribute(
        "data-accent",
        color
    );

    localStorage.setItem(
        "accent_cloud",
        color
    );

    document.querySelectorAll(".color-dot").forEach(dot => {

        dot.classList.toggle(
            "active",
            dot.getAttribute("data-color") === color
        );

    });
}


// ============================================================
// ♿ ACCESIBILIDAD
// ============================================================

const a11yToggle =
    document.getElementById("a11y-toggle");

const a11yMenu =
    document.getElementById("a11y-menu");

let currentFontScale =
    parseFloat(
        localStorage.getItem("fontScale_cloud")
    ) || 1;

applyFontScale(currentFontScale);

if (a11yToggle && a11yMenu) {

    a11yToggle.addEventListener("click", () => {

        a11yMenu.classList.toggle("hidden");

    });

}

const btnTextIncrease =
    document.getElementById("btn-text-increase");

if (btnTextIncrease) {

    btnTextIncrease.addEventListener(
        "click",
        () => {

            applyFontScale(
                Math.min(
                    currentFontScale + 0.1,
                    1.3
                )
            );

        }
    );

}

const btnTextDecrease =
    document.getElementById("btn-text-decrease");

if (btnTextDecrease) {

    btnTextDecrease.addEventListener(
        "click",
        () => {

            applyFontScale(
                Math.max(
                    currentFontScale - 0.1,
                    0.8
                )
            );

        }
    );

}

const btnTextReset =
    document.getElementById("btn-text-reset");

if (btnTextReset) {

    btnTextReset.addEventListener(
        "click",
        () => applyFontScale(1)
    );

}

function applyFontScale(scale) {

    currentFontScale = scale;

    document.documentElement.style.setProperty(
        "--font-scale",
        scale
    );

    localStorage.setItem(
        "fontScale_cloud",
        scale
    );
}


// ============================================================
// 👁️ CONTRASTE
// ============================================================

const checkContrast =
    document.getElementById("check-contrast");

if (checkContrast) {

    checkContrast.addEventListener(
        "change",
        (e) => {

            document.body.classList.toggle(
                "high-contrast",
                e.target.checked
            );

        }
    );

}


// ============================================================
// 🎬 REDUCIR MOVIMIENTO
// ============================================================

const checkReduceMotion =
    document.getElementById("check-reduce-motion");

if (checkReduceMotion) {

    checkReduceMotion.addEventListener(
        "change",
        (e) => {

            document.body.classList.toggle(
                "reduce-motion",
                e.target.checked
            );

        }
    );

}


// ============================================================
// 👁️ MOSTRAR / OCULTAR CONTRASEÑA
// ============================================================

document
    .querySelectorAll(".toggle-password")
    .forEach(button => {

        button.addEventListener("click", () => {

            const input =
                document.getElementById(
                    button.getAttribute("data-target")
                );

            const icon =
                button.querySelector("i");

            if (!input) return;

            if (input.type === "password") {

                input.type = "text";

                if (icon) {
                    icon.setAttribute(
                        "data-lucide",
                        "eye-off"
                    );
                }

            } else {

                input.type = "password";

                if (icon) {
                    icon.setAttribute(
                        "data-lucide",
                        "eye"
                    );
                }
            }

            if (typeof lucide !== "undefined") {
                lucide.createIcons();
            }

        });

    });


// ============================================================
// 🔐 FUERZA DE CONTRASEÑA
// ============================================================

const regPasswordInput =
    document.getElementById("reg-password");

const strengthBar =
    document.getElementById("strength-bar");

const strengthText =
    document.getElementById("strength-text");

if (regPasswordInput) {

    regPasswordInput.addEventListener(
        "input",
        () => {

            const val =
                regPasswordInput.value;

            let score = 0;

            if (val.length >= 8) score++;

            if (/[A-Z]/.test(val)) score++;

            if (/[0-9]/.test(val)) score++;

            if (/[^A-Za-z0-9]/.test(val)) score++;

            if (val.length === 0) {

                if (strengthBar) {
                    strengthBar.style.width = "0%";
                }

                if (strengthText) {
                    strengthText.innerText =
                        "Escribe una contraseña";
                }

            } else if (score < 2) {

                if (strengthBar) {
                    strengthBar.style.width = "33%";
                    strengthBar.style.backgroundColor =
                        "var(--danger)";
                }

                if (strengthText) {
                    strengthText.innerText =
                        "Fuerza: Débil";
                }

            } else if (score <= 3) {

                if (strengthBar) {
                    strengthBar.style.width = "66%";
                    strengthBar.style.backgroundColor =
                        "var(--warning)";
                }

                if (strengthText) {
                    strengthText.innerText =
                        "Fuerza: Media";
                }

            } else {

                if (strengthBar) {
                    strengthBar.style.width = "100%";
                    strengthBar.style.backgroundColor =
                        "var(--success)";
                }

                if (strengthText) {
                    strengthText.innerText =
                        "Fuerza: Fuerte";
                }

            }

        }
    );

}


// ============================================================
// 🔄 MODO LOGIN / REGISTRO
// ============================================================

let modoRegistro = false;

const vistaAuth =
    document.getElementById("vista-auth");

const campoNombre =
    document.getElementById("campo-nombre");

const authTitulo =
    document.getElementById("auth-titulo");

const authSubtitulo =
    document.getElementById("auth-subtitulo");

const authBtnSubmit =
    document.getElementById("auth-btn-submit");

const authToggleTexto =
    document.getElementById("auth-toggle-texto");

const authToggleBtn =
    document.getElementById("auth-toggle-btn");

function toggleModoAuth() {

    modoRegistro = !modoRegistro;

    if (modoRegistro) {

        campoNombre?.classList.remove("hidden");

        authTitulo.innerText =
            "Crear Cuenta";

        authSubtitulo.innerText =
            "Regístrate en SmartCity Cloud";

        authBtnSubmit.innerText =
            "Crear Cuenta ➔";

        authToggleTexto.innerText =
            "¿Ya tienes una cuenta?";

        authToggleBtn.innerText =
            "Iniciar Sesión";

    } else {

        campoNombre?.classList.add("hidden");

        authTitulo.innerText =
            "SmartCity Cloud";

        authSubtitulo.innerText =
            "Monitoreo Urbano e IoT en la Nube";

        authBtnSubmit.innerText =
            "Iniciar Sesión ➔";

        authToggleTexto.innerText =
            "¿No tienes cuenta?";

        authToggleBtn.innerText =
            "Crear una cuenta";
    }

}


// ============================================================
// 🔐 LOGIN / REGISTRO
// ============================================================

const formAuth =
    document.getElementById("form-auth");

if (formAuth) {

    formAuth.addEventListener(
        "submit",
        procesarAuth
    );

}

async function procesarAuth(e) {

    e.preventDefault();

    const email =
        document.getElementById(
            "auth-email"
        ).value.trim();

    const password =
        document.getElementById(
            "auth-password"
        ).value;

    const msg =
        document.getElementById(
            "auth-mensaje"
        );

    if (modoRegistro) {

        const nombre =
            document.getElementById(
                "auth-nombre"
            ).value.trim();

        if (!nombre) {

            mostrarMensajeAuth(
                "Por favor ingresa tu nombre.",
                "error"
            );

            return;
        }

        // ====================================================
        // 🔐 IMPORTANTE:
        // NO mandamos id_rol.
        // FastAPI automáticamente asigna rol 2.
        // ====================================================

        const data = {

            nombre: nombre,
            email: email,
            password: password

        };

        try {

            const response =
                await fetch(
                    `${API_URL}/registro`,
                    {
                        method: "POST",
                        headers: {
                            "Content-Type":
                                "application/json"
                        },
                        body:
                            JSON.stringify(data)
                    }
                );

            const result =
                await response.json();

            if (response.ok) {

                mostrarMensajeAuth(
                    "✅ Cuenta creada correctamente. Ahora puedes iniciar sesión.",
                    "success"
                );

                document.getElementById(
                    "form-auth"
                ).reset();

                setTimeout(() => {

                    toggleModoAuth();

                }, 1500);

            } else {

                mostrarMensajeAuth(
                    result.detail ||
                    "Error al registrar.",
                    "error"
                );

            }

        } catch (error) {

            console.error(error);

            mostrarMensajeAuth(
                "❌ No se pudo conectar con el servidor.",
                "error"
            );

        }

    } else {

        const data = {

            email: email,
            password: password

        };

        try {

            const response =
                await fetch(
                    `${API_URL}/login`,
                    {
                        method: "POST",
                        headers: {
                            "Content-Type":
                                "application/json"
                        },
                        body:
                            JSON.stringify(data)
                    }
                );

            const result =
                await response.json();

            if (response.ok) {

                // ====================================================
                // 💾 GUARDAR TOKEN
                // ====================================================

                localStorage.setItem(
                    "token_cloud",
                    result.access_token
                );

                localStorage.setItem(
                    "user_role_cloud",
                    result.id_rol
                );

                localStorage.setItem(
                    "user_name_cloud",
                    result.nombre
                );

                mostrarDashboard(
                    result.nombre,
                    result.id_rol
                );

            } else {

                mostrarMensajeAuth(
                    result.detail ||
                    "Credenciales incorrectas.",
                    "error"
                );

            }

        } catch (error) {

            console.error(error);

            mostrarMensajeAuth(
                "❌ Error de conexión con el servidor.",
                "error"
            );

        }

    }

}


// ============================================================
// 💬 MENSAJE AUTH
// ============================================================

function mostrarMensajeAuth(texto, tipo) {

    let msg =
        document.getElementById(
            "auth-mensaje"
        );

    if (!msg) {

        msg =
            document.createElement("div");

        msg.id =
            "auth-mensaje";

        msg.className =
            "mt-4 text-center text-sm";

        formAuth?.appendChild(msg);

    }

    msg.innerText = texto;

    msg.className =
        tipo === "success"
            ? "mt-4 text-center text-sm text-emerald-400"
            : "mt-4 text-center text-sm text-rose-400";

}


// ============================================================
// 📊 MOSTRAR DASHBOARD
// ============================================================

function mostrarDashboard(
    nombre,
    idRol
) {

    // Ocultar login
    vistaAuth?.classList.add("hidden");

    // Mostrar dashboard
    document
        .getElementById("vista-dashboard")
        ?.classList.remove("hidden");

    // Nombre
    const navNombre =
        document.getElementById(
            "nav-usuario-nombre"
        );

    if (navNombre) {
        navNombre.innerText = nombre;
    }

    // Badge
    document
        .getElementById("usuario-badge")
        ?.classList.remove("hidden");

    // Botón cerrar sesión
    document
        .getElementById("btn-auth-accion")
        ?.classList.remove("hidden");

    // ========================================================
    // 👑 MENÚ ADMIN
    // ========================================================

    const btnAdmin =
        document.getElementById(
            "btn-menu-admin"
        );

    if (btnAdmin) {

        if (Number(idRol) === 1) {

            btnAdmin.classList.remove(
                "hidden"
            );

        } else {

            btnAdmin.classList.add(
                "hidden"
            );

        }

    }

    // ========================================================
    // 📡 CARGAR SENSORES
    // ========================================================

    cargarUltimasLecturas();

}


// ============================================================
// 📡 CARGAR ÚLTIMAS LECTURAS
// ============================================================

async function cargarUltimasLecturas() {

    try {

        const response =
            await fetch(
                `${API_URL}/sensores/ultimas`
            );

        const data =
            await response.json();

        if (
            response.ok &&
            Array.isArray(data) &&
            data.length > 0
        ) {

            const ultima =
                data[0];

            const temp =
                document.getElementById(
                    "metric-temp"
                );

            const hum =
                document.getElementById(
                    "metric-hum"
                );

            const aire =
                document.getElementById(
                    "metric-aire"
                );

            if (temp) {

                temp.innerText =
                    `${ultima.temperatura} °C`;

            }

            if (hum) {

                hum.innerText =
                    `${ultima.humedad} %`;

            }

            if (aire) {

                aire.innerText =
                    `${ultima.calidad_aire} ICA`;

            }

        }

    } catch (error) {

        console.error(
            "Error al obtener sensores:",
            error
        );

    }

}


// ============================================================
// 🧭 NAVEGACIÓN
// ============================================================

function navegarA(vista) {

    // ========================================================
    // Ocultar todas las vistas
    // ========================================================

    document
        .getElementById("vista-dashboard")
        ?.classList.add("hidden");

    document
        .getElementById("vista-perfil")
        ?.classList.add("hidden");

    document
        .getElementById("vista-admin-usuarios")
        ?.classList.add("hidden");

    document
        .getElementById("vista-auth")
        ?.classList.add("hidden");

    // ========================================================
    // Mostrar vista solicitada
    // ========================================================

    if (vista === "dashboard") {

        document
            .getElementById("vista-dashboard")
            ?.classList.remove("hidden");

        cargarUltimasLecturas();

    }

    if (vista === "perfil") {

        document
            .getElementById("vista-perfil")
            ?.classList.remove("hidden");

        cargarPerfilUsuario();

    }

    if (vista === "admin-usuarios") {

        const rol =
            Number(
                localStorage.getItem(
                    "user_role_cloud"
                )
            );

        if (rol !== 1) {

            alert(
                "⛔ No tienes permisos de Administrador."
            );

            navegarA("dashboard");

            return;
        }

        document
            .getElementById(
                "vista-admin-usuarios"
            )
            ?.classList.remove("hidden");

        cargarUsuariosAdmin();

    }

}


// ============================================================
// 👤 CARGAR PERFIL
// ============================================================

async function cargarPerfilUsuario() {

    const token =
        obtenerToken();

    if (!token) {

        cerrarSesion();

        return;
    }

    try {

        const response =
            await fetch(
                `${API_URL}/api/perfil`,
                {
                    method: "GET",
                    headers: {
                        "Authorization":
                            `Bearer ${token}`
                    }
                }
            );

        const data =
            await response.json();

        if (response.status === 401) {

            cerrarSesion();

            return;
        }

        if (!response.ok) {

            alert(
                data.detail ||
                "No se pudo cargar el perfil."
            );

            return;
        }

        // ====================================================
        // DATOS DEL PERFIL
        // ====================================================

        document.getElementById(
            "perfil-nombre"
        ).innerText =
            data.nombre || "-";

        document.getElementById(
            "perfil-username"
        ).innerText =
            `@${data.username || "-"}`;

        document.getElementById(
            "perfil-email"
        ).innerText =
            data.email || "-";

        document.getElementById(
            "perfil-rol"
        ).innerText =
            data.rol || "👤 Usuario";

        // Estado
        const estado =
            document.getElementById(
                "perfil-estado"
            );

        if (estado) {

            if (data.estado === "activo") {

                estado.innerText =
                    "🟢 Activo";

                estado.className =
                    "inline-flex items-center gap-1.5 text-emerald-400 font-semibold";

            } else {

                estado.innerText =
                    "🔴 Inactivo";

                estado.className =
                    "inline-flex items-center gap-1.5 text-rose-400 font-semibold";

            }

        }

        document.getElementById(
            "perfil-registro"
        ).innerText =
            formatearFecha(
                data.fecha_registro
            );

        document.getElementById(
            "perfil-acceso"
        ).innerText =
            formatearFecha(
                data.ultimo_acceso
            );

        // ====================================================
        // AVATAR
        // ====================================================

        const avatar =
            document.getElementById(
                "perfil-avatar"
            );

        if (avatar) {

            if (data.avatar) {

                avatar.innerHTML =
                    `<img src="${data.avatar}"
                          alt="Avatar"
                          class="w-full h-full object-cover">`;

            } else {

                avatar.innerText = "👤";

            }

        }

    } catch (error) {

        console.error(
            "Error cargando perfil:",
            error
        );

        alert(
            "❌ Error de conexión con el servidor."
        );

    }

}


// ============================================================
// 📅 FORMATEAR FECHA
// ============================================================

function formatearFecha(fecha) {

    if (!fecha) {
        return "-";
    }

    try {

        const date =
            new Date(fecha);

        if (isNaN(date.getTime())) {
            return fecha;
        }

        return date.toLocaleString(
            "es-EC",
            {
                dateStyle: "medium",
                timeStyle: "short"
            }
        );

    } catch {

        return fecha;

    }

}


// ============================================================
// ✏️ MODAL EDITAR PERFIL
// ============================================================

function abrirModalEditarPerfil() {

    const nombre =
        document.getElementById(
            "perfil-nombre"
        )?.innerText || "";

    const username =
        document.getElementById(
            "perfil-username"
        )?.innerText
        .replace("@", "") || "";

    document.getElementById(
        "edit-nombre"
    ).value = nombre;

    document.getElementById(
        "edit-username"
    ).value = username;

    document
        .getElementById(
            "modal-editar-perfil"
        )
        ?.classList.remove("hidden");

}


// ============================================================
// ❌ CERRAR MODAL
// ============================================================

function cerrarModal(idModal) {

    document
        .getElementById(idModal)
        ?.classList.add("hidden");

}


// ============================================================
// 💾 GUARDAR EDICIÓN DE PERFIL
// ============================================================

async function guardarEdicionPerfil(e) {

    e.preventDefault();

    const token =
        obtenerToken();

    if (!token) {

        alert(
            "Tu sesión ha expirado."
        );

        cerrarSesion();

        return;
    }

    const nombre =
        document.getElementById(
            "edit-nombre"
        ).value.trim();

    const username =
        document.getElementById(
            "edit-username"
        ).value.trim();

    if (!nombre || !username) {

        alert(
            "Completa todos los campos."
        );

        return;
    }

    try {

        const response =
            await fetch(
                `${API_URL}/api/perfil/editar`,
                {
                    method: "PUT",

                    headers: {
                        "Authorization":
                            `Bearer ${token}`,
                        "Content-Type":
                            "application/json"
                    },

                    body:
                        JSON.stringify({
                            nombre: nombre,
                            username: username
                        })
                }
            );

        const data =
            await response.json();

        if (response.status === 401) {

            cerrarSesion();

            return;
        }

        if (response.ok) {

            alert(
                "✅ Perfil actualizado correctamente."
            );

            cerrarModal(
                "modal-editar-perfil"
            );

            cargarPerfilUsuario();

            // Actualizar nombre del navbar
            const navNombre =
                document.getElementById(
                    "nav-usuario-nombre"
                );

            if (navNombre) {
                navNombre.innerText =
                    nombre;
            }

        } else {

            alert(
                "❌ " +
                (
                    data.detail ||
                    "Error actualizando perfil."
                )
            );

        }

    } catch (error) {

        console.error(error);

        alert(
            "❌ Error de conexión con el servidor."
        );

    }

}


// ============================================================
// 🔒 MODAL CAMBIAR CONTRASEÑA
// ============================================================

function abrirModalCambiarPassword() {

    document.getElementById(
        "pass-actual"
    ).value = "";

    document.getElementById(
        "pass-nueva"
    ).value = "";

    document
        .getElementById(
            "modal-cambiar-password"
        )
        ?.classList.remove("hidden");

}


// ============================================================
// 🔒 CAMBIAR CONTRASEÑA
// ============================================================

async function guardarNuevaPassword(e) {

    e.preventDefault();

    const token =
        obtenerToken();

    if (!token) {

        cerrarSesion();

        return;
    }

    const password_actual =
        document.getElementById(
            "pass-actual"
        ).value;

    const password_nueva =
        document.getElementById(
            "pass-nueva"
        ).value;

    if (password_nueva.length < 6) {

        alert(
            "❌ La nueva contraseña debe tener al menos 6 caracteres."
        );

        return;
    }

    try {

        const response =
            await fetch(
                `${API_URL}/api/perfil/cambiar-password`,
                {
                    method: "PUT",

                    headers: {
                        "Authorization":
                            `Bearer ${token}`,
                        "Content-Type":
                            "application/json"
                    },

                    body:
                        JSON.stringify({
                            password_actual:
                                password_actual,

                            password_nueva:
                                password_nueva
                        })
                }
            );

        const data =
            await response.json();

        if (response.status === 401) {

            cerrarSesion();

            return;
        }

        if (response.ok) {

            alert(
                "✅ " + data.mensaje
            );

            cerrarModal(
                "modal-cambiar-password"
            );

        } else {

            alert(
                "❌ " +
                (
                    data.detail ||
                    "No se pudo cambiar la contraseña."
                )
            );

        }

    } catch (error) {

        console.error(error);

        alert(
            "❌ Error de conexión con el servidor."
        );

    }

}


// ============================================================
// 👑 CARGAR USUARIOS ADMIN
// ============================================================

async function cargarUsuariosAdmin() {

    const token =
        obtenerToken();

    if (!token) {

        cerrarSesion();

        return;
    }

    const tabla =
        document.getElementById(
            "tabla-usuarios-body"
        );

    if (!tabla) return;

    tabla.innerHTML = `
        <tr>
            <td colspan="7"
                class="px-4 py-8 text-center text-slate-400">
                ⏳ Cargando usuarios...
            </td>
        </tr>
    `;

    try {

        const response =
            await fetch(
                `${API_URL}/api/admin/usuarios`,
                {
                    headers: {
                        "Authorization":
                            `Bearer ${token}`
                    }
                }
            );

        const data =
            await response.json();

        if (response.status === 403) {

            alert(
                "⛔ No tienes permisos de Administrador."
            );

            navegarA("dashboard");

            return;
        }

        if (!response.ok) {

            throw new Error(
                data.detail ||
                "Error cargando usuarios."
            );

        }

        window.usuariosAdmin =
            data;

        mostrarUsuariosTabla(data);

    } catch (error) {

        console.error(error);

        tabla.innerHTML = `
            <tr>
                <td colspan="7"
                    class="px-4 py-8 text-center text-rose-400">
                    ❌ ${error.message}
                </td>
            </tr>
        `;

    }

}


// ============================================================
// 📋 MOSTRAR TABLA USUARIOS
// ============================================================

function mostrarUsuariosTabla(usuarios) {

    const tabla =
        document.getElementById(
            "tabla-usuarios-body"
        );

    if (!tabla) return;

    tabla.innerHTML = "";

    if (!usuarios.length) {

        tabla.innerHTML = `
            <tr>
                <td colspan="7"
                    class="px-4 py-8 text-center text-slate-400">
                    No existen usuarios.
                </td>
            </tr>
        `;

        return;
    }

    usuarios.forEach(usuario => {

        const esAdmin =
            Number(usuario.id_rol) === 1;

        const activo =
            usuario.estado === "activo";

        const tr =
            document.createElement("tr");

        tr.className =
            "hover:bg-slate-700/30 transition";

        tr.innerHTML = `

            <td class="px-4 py-3">
                #${usuario.id}
            </td>

            <td class="px-4 py-3">
                <div class="font-semibold text-white">
                    ${escapeHTML(usuario.nombre)}
                </div>

                <div class="text-xs text-slate-500">
                    @${escapeHTML(usuario.username)}
                </div>
            </td>

            <td class="px-4 py-3">
                ${escapeHTML(usuario.email)}
            </td>

            <td class="px-4 py-3">

                <span class="
                    inline-flex
                    px-2.5
                    py-1
                    rounded-full
                    text-xs
                    font-semibold
                    ${
                        esAdmin
                            ? "bg-amber-500/10 text-amber-400 border border-amber-500/20"
                            : "bg-blue-500/10 text-blue-400 border border-blue-500/20"
                    }
                ">
                    ${
                        esAdmin
                            ? "👑 Admin"
                            : "👤 Usuario"
                    }
                </span>

            </td>

            <td class="px-4 py-3">

                <span class="
                    inline-flex
                    px-2.5
                    py-1
                    rounded-full
                    text-xs
                    font-semibold
                    ${
                        activo
                            ? "bg-emerald-500/10 text-emerald-400 border border-emerald-500/20"
                            : "bg-rose-500/10 text-rose-400 border border-rose-500/20"
                    }
                ">
                    ${
                        activo
                            ? "🟢 Activo"
                            : "🔴 Inactivo"
                    }
                </span>

            </td>

            <td class="px-4 py-3 text-xs">
                ${formatearFecha(usuario.ultimo_acceso)}
            </td>

            <td class="px-4 py-3">

                <div class="flex justify-center gap-2">

                    <button
                        onclick="cambiarRolUsuario(${usuario.id}, ${usuario.id_rol})"
                        class="px-2.5 py-1.5 rounded-lg bg-blue-500/10 text-blue-400 hover:bg-blue-500 hover:text-white transition text-xs"
                        title="Cambiar rol">
                        🔄
                    </button>

                    <button
                        onclick="cambiarEstadoUsuario(${usuario.id}, '${usuario.estado}')"
                        class="px-2.5 py-1.5 rounded-lg bg-amber-500/10 text-amber-400 hover:bg-amber-500 hover:text-white transition text-xs"
                        title="Cambiar estado">
                        ${
                            activo
                                ? "🔴"
                                : "🟢"
                        }
                    </button>

                    ${
                        Number(
                            usuario.id
                        ) !== Number(
                            localStorage.getItem(
                                "user_id_cloud"
                            )
                        )
                            ? `
                                <button
                                    onclick="eliminarUsuario(${usuario.id})"
                                    class="px-2.5 py-1.5 rounded-lg bg-rose-500/10 text-rose-400 hover:bg-rose-500 hover:text-white transition text-xs"
                                    title="Eliminar usuario">
                                    🗑️
                                </button>
                              `
                            : ""
                    }

                </div>

            </td>
        `;

        tabla.appendChild(tr);

    });

}


// ============================================================
// 🔎 FILTRAR USUARIOS
// ============================================================

function filtrarUsuarios() {

    const texto =
        document
            .getElementById(
                "buscar-usuario"
            )
            ?.value
            .toLowerCase()
            .trim();

    if (!window.usuariosAdmin) return;

    const filtrados =
        window.usuariosAdmin.filter(
            usuario => {

                return (
                    String(usuario.id)
                        .includes(texto) ||

                    usuario.nombre
                        .toLowerCase()
                        .includes(texto) ||

                    usuario.email
                        .toLowerCase()
                        .includes(texto) ||

                    usuario.username
                        .toLowerCase()
                        .includes(texto) ||

                    usuario.rol
                        .toLowerCase()
                        .includes(texto)
                );

            }
        );

    mostrarUsuariosTabla(
        filtrados
    );

}


// ============================================================
// 🔄 CAMBIAR ROL
// ============================================================

async function cambiarRolUsuario(
    usuarioId,
    rolActual
) {

    const nuevoRol =
        Number(rolActual) === 1
            ? 2
            : 1;

    const nombreRol =
        nuevoRol === 1
            ? "Administrador"
            : "Usuario";

    const confirmar =
        confirm(
            `¿Cambiar el rol del usuario #${usuarioId} a ${nombreRol}?`
        );

    if (!confirmar) return;

    await modificarUsuarioAdmin(
        usuarioId,
        {
            id_rol: nuevoRol
        }
    );

}


// ============================================================
// 🟢🔴 CAMBIAR ESTADO
// ============================================================

async function cambiarEstadoUsuario(
    usuarioId,
    estadoActual
) {

    const nuevoEstado =
        estadoActual === "activo"
            ? "inactivo"
            : "activo";

    const confirmar =
        confirm(
            `¿Cambiar el estado del usuario #${usuarioId} a ${nuevoEstado}?`
        );

    if (!confirmar) return;

    await modificarUsuarioAdmin(
        usuarioId,
        {
            estado: nuevoEstado
        }
    );

}


// ============================================================
// 🛠️ MODIFICAR USUARIO ADMIN
// ============================================================

async function modificarUsuarioAdmin(
    usuarioId,
    cambios
) {

    const token =
        obtenerToken();

    try {

        const response =
            await fetch(
                `${API_URL}/api/admin/usuarios/${usuarioId}`,
                {
                    method: "PUT",

                    headers: {
                        "Authorization":
                            `Bearer ${token}`,

                        "Content-Type":
                            "application/json"
                    },

                    body:
                        JSON.stringify(cambios)
                }
            );

        const data =
            await response.json();

        if (!response.ok) {

            alert(
                "❌ " +
                (
                    data.detail ||
                    "No se pudo modificar el usuario."
                )
            );

            return;
        }

        alert(
            "✅ " + data.mensaje
        );

        cargarUsuariosAdmin();

    } catch (error) {

        console.error(error);

        alert(
            "❌ Error de conexión."
        );

    }

}


// ============================================================
// 🗑️ ELIMINAR USUARIO
// ============================================================

async function eliminarUsuario(
    usuarioId
) {

    const confirmar =
        confirm(
            `⚠️ ¿Seguro que deseas eliminar al usuario #${usuarioId}?\n\nEsta acción no se puede deshacer.`
        );

    if (!confirmar) return;

    const token =
        obtenerToken();

    try {

        const response =
            await fetch(
                `${API_URL}/api/admin/usuarios/${usuarioId}`,
                {
                    method: "DELETE",

                    headers: {
                        "Authorization":
                            `Bearer ${token}`
                    }
                }
            );

        const data =
            await response.json();

        if (!response.ok) {

            alert(
                "❌ " +
                (
                    data.detail ||
                    "No se pudo eliminar."
                )
            );

            return;
        }

        alert(
            "✅ " + data.mensaje
        );

        cargarUsuariosAdmin();

    } catch (error) {

        console.error(error);

        alert(
            "❌ Error de conexión."
        );

    }

}


// ============================================================
// 🛡️ ESCAPAR HTML
// ============================================================

function escapeHTML(text) {

    if (text === null || text === undefined) {
        return "";
    }

    return String(text)
        .replaceAll("&", "&amp;")
        .replaceAll("<", "&lt;")
        .replaceAll(">", "&gt;")
        .replaceAll('"', "&quot;")
        .replaceAll("'", "&#039;");

}


// ============================================================
// 🚪 CERRAR SESIÓN
// ============================================================

function cerrarSesion() {

    localStorage.removeItem(
        "token_cloud"
    );

    localStorage.removeItem(
        "user_role_cloud"
    );

    localStorage.removeItem(
        "user_name_cloud"
    );

    localStorage.removeItem(
        "user_id_cloud"
    );

    // Ocultar vistas
    document
        .getElementById("vista-dashboard")
        ?.classList.add("hidden");

    document
        .getElementById("vista-perfil")
        ?.classList.add("hidden");

    document
        .getElementById("vista-admin-usuarios")
        ?.classList.add("hidden");

    // Mostrar auth
    document
        .getElementById("vista-auth")
        ?.classList.remove("hidden");

    // Ocultar badge
    document
        .getElementById("usuario-badge")
        ?.classList.add("hidden");

    // Ocultar admin
    document
        .getElementById("btn-menu-admin")
        ?.classList.add("hidden");

    // Volver a login
    if (modoRegistro) {
        toggleModoAuth();
    }

    document
        .getElementById("form-auth")
        ?.reset();

}


// ============================================================
// 🤖 BRUNITO AI
// ============================================================

const brunitoWindow =
    document.getElementById(
        "brunito-chat-window"
    );

const brunitoMessages =
    document.getElementById(
        "chat-mensajes"
    );

const brunitoInput =
    document.getElementById(
        "chat-input"
    );

let brunitoHistory = [];


// ============================================================
// 🤖 ABRIR / CERRAR BRUNITO
// ============================================================

function toggleChatBrunito() {

    if (!brunitoWindow) return;

    brunitoWindow.classList.toggle(
        "hidden"
    );

    if (
        !brunitoWindow.classList.contains(
            "hidden"
        )
    ) {

        brunitoInput?.focus();

    }

}


// ============================================================
// 💬 ENVIAR MENSAJE
// ============================================================

async function enviarMensajeBrunito(e) {

    if (e) {
        e.preventDefault();
    }

    const texto =
        brunitoInput?.value.trim();

    if (!texto) return;

    agregarMensajeBrunito(
        "user",
        texto
    );

    brunitoInput.value = "";

    // Mensaje temporal
    const typing =
        document.createElement("div");

    typing.id =
        "brunito-typing";

    typing.className =
        "bg-slate-700/60 p-3 rounded-xl border border-slate-600/50 max-w-[85%] text-slate-400";

    typing.innerText =
        "🤖 Brunito está pensando...";

    brunitoMessages?.appendChild(
        typing
    );

    if (brunitoMessages) {

        brunitoMessages.scrollTop =
            brunitoMessages.scrollHeight;

    }

    try {

        const response =
            await fetch(
                `${API_URL}/api/ia/chat`,
                {
                    method: "POST",

                    headers: {
                        "Content-Type":
                            "application/json"
                    },

                    body:
                        JSON.stringify({
                            message: texto,
                            history:
                                brunitoHistory
                        })
                }
            );

        const data =
            await response.json();

        typing.remove();

        if (response.ok) {

            agregarMensajeBrunito(
                "model",
                data.respuesta
            );

            // Groq espera "assistant"
            brunitoHistory.push({
                role: "user",
                content: texto
            });

            brunitoHistory.push({
                role: "assistant",
                content:
                    data.respuesta
            });

        } else {

            agregarMensajeBrunito(
                "model",
                `⚠️ ${data.detail || "No se pudo consultar a Brunito AI."}`
            );

        }

    } catch (error) {

        console.error(error);

        typing.remove();

        agregarMensajeBrunito(
            "model",
            "⚠️ Error de conexión con el servidor."
        );

    }

}


// ============================================================
// 💬 AGREGAR MENSAJE BRUNITO
// ============================================================

function agregarMensajeBrunito(
    role,
    content
) {

    if (!brunitoMessages) return;

    const msgDiv =
        document.createElement("div");

    if (role === "user") {

        msgDiv.className =
            "ml-auto bg-blue-600/80 p-3 rounded-xl max-w-[85%] text-white";

    } else {

        msgDiv.className =
            "bg-slate-700/60 p-3 rounded-xl border border-slate-600/50 max-w-[85%] text-slate-200";

    }

    msgDiv.innerText =
        content;

    brunitoMessages.appendChild(
        msgDiv
    );

    brunitoMessages.scrollTop =
        brunitoMessages.scrollHeight;

}


// ============================================================
// 🔄 RECUPERAR SESIÓN AL RECARGAR
// ============================================================

async function comprobarSesion() {

    const token =
        obtenerToken();

    if (!token) {

        document
            .getElementById("vista-auth")
            ?.classList.remove("hidden");

        return;
    }

    try {

        const response =
            await fetch(
                `${API_URL}/api/perfil`,
                {
                    headers: {
                        "Authorization":
                            `Bearer ${token}`
                    }
                }
            );

        const data =
            await response.json();

        if (!response.ok) {

            cerrarSesion();

            return;
        }

        // Guardar información actual
        localStorage.setItem(
            "user_role_cloud",
            data.id_rol
        );

        localStorage.setItem(
            "user_name_cloud",
            data.nombre
        );

        localStorage.setItem(
            "user_id_cloud",
            data.id
        );

        mostrarDashboard(
            data.nombre,
            data.id_rol
        );

    } catch (error) {

        console.error(
            "No se pudo comprobar sesión:",
            error
        );

    }

}


// ============================================================
// 🚀 INICIAR APLICACIÓN
// ============================================================

document.addEventListener(
    "DOMContentLoaded",
    () => {

        comprobarSesion();

    }
);