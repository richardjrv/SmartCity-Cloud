const API_URL = "https://smartcity-backend-shdc.onrender.com";
lucide.createIcons();

// --- TEMA Y ESTILOS ---
const htmlTag = document.documentElement;
const themeToggleBtn = document.getElementById("theme-toggle");
const themeIcon = document.getElementById("theme-icon");

const savedTheme = localStorage.getItem("theme_cloud") || "dark";
setTheme(savedTheme);

themeToggleBtn.addEventListener("click", () => {
    const currentTheme = htmlTag.getAttribute("data-theme");
    setTheme(currentTheme === "dark" ? "light" : "dark");
});

function setTheme(theme) {
    htmlTag.setAttribute("data-theme", theme);
    localStorage.setItem("theme_cloud", theme);
    themeIcon.setAttribute("data-lucide", theme === "light" ? "sun" : "moon");
    lucide.createIcons();
}

// Color de Acento
const savedAccent = localStorage.getItem("accent_cloud") || "blue";
setAccent(savedAccent);

document.querySelectorAll(".color-dot").forEach(dot => {
    dot.addEventListener("click", (e) => setAccent(e.target.getAttribute("data-color")));
});

function setAccent(color) {
    htmlTag.setAttribute("data-accent", color);
    localStorage.setItem("accent_cloud", color);
    document.querySelectorAll(".color-dot").forEach(dot => {
        dot.classList.toggle("active", dot.getAttribute("data-color") === color);
    });
}

// --- ACCESIBILIDAD ---
const a11yToggle = document.getElementById("a11y-toggle");
const a11yMenu = document.getElementById("a11y-menu");
let currentFontScale = parseFloat(localStorage.getItem("fontScale_cloud")) || 1;
applyFontScale(currentFontScale);

a11yToggle.addEventListener("click", () => a11yMenu.classList.toggle("hidden"));

document.getElementById("btn-text-increase").addEventListener("click", () => applyFontScale(Math.min(currentFontScale + 0.1, 1.3)));
document.getElementById("btn-text-decrease").addEventListener("click", () => applyFontScale(Math.max(currentFontScale - 0.1, 0.8)));
document.getElementById("btn-text-reset").addEventListener("click", () => applyFontScale(1));

function applyFontScale(scale) {
    currentFontScale = scale;
    document.documentElement.style.setProperty("--font-scale", scale);
    localStorage.setItem("fontScale_cloud", scale);
}

document.getElementById("check-contrast").addEventListener("change", (e) => {
    document.body.classList.toggle("high-contrast", e.target.checked);
});

document.getElementById("check-reduce-motion").addEventListener("change", (e) => {
    document.body.classList.toggle("reduce-motion", e.target.checked);
});

// --- MOSTRAR / OCULTAR CONTRASEÑA ---
document.querySelectorAll(".toggle-password").forEach(button => {
    button.addEventListener("click", () => {
        const input = document.getElementById(button.getAttribute("data-target"));
        const icon = button.querySelector("i");

        if (input.type === "password") {
            input.type = "text";
            icon.setAttribute("data-lucide", "eye-off");
        } else {
            input.type = "password";
            icon.setAttribute("data-lucide", "eye");
        }
        lucide.createIcons();
    });
});

// --- MEDIDOR DE FUERZA DE CONTRASEÑA ---
const regPasswordInput = document.getElementById("reg-password");
const strengthBar = document.getElementById("strength-bar");
const strengthText = document.getElementById("strength-text");

if (regPasswordInput) {
    regPasswordInput.addEventListener("input", () => {
        const val = regPasswordInput.value;
        let score = 0;
        if (val.length >= 8) score++;
        if (/[A-Z]/.test(val)) score++;
        if (/[0-9]/.test(val)) score++;
        if (/[^A-Za-z0-9]/.test(val)) score++;

        if (val.length === 0) {
            strengthBar.style.width = "0%";
            strengthText.innerText = "Escribe una contraseña";
            strengthText.style.color = "var(--text-muted)";
        } else if (score < 2) {
            strengthBar.style.width = "33%";
            strengthBar.style.backgroundColor = "var(--danger)";
            strengthText.innerText = "Fuerza: Débil";
            strengthText.style.color = "var(--danger)";
        } else if (score <= 3) {
            strengthBar.style.width = "66%";
            strengthBar.style.backgroundColor = "var(--warning)";
            strengthText.innerText = "Fuerza: Media";
            strengthText.style.color = "var(--warning)";
        } else {
            strengthBar.style.width = "100%";
            strengthBar.style.backgroundColor = "var(--success)";
            strengthText.innerText = "Fuerza: Fuerte";
            strengthText.style.color = "var(--success)";
        }
    });
}

// --- VISTAS ---
const loginContainer = document.getElementById("login-container");
const registerContainer = document.getElementById("register-container");
const dashboardCard = document.getElementById("dashboard-card");
const mainCard = document.getElementById("main-card");

document.getElementById("show-register").addEventListener("click", (e) => {
    e.preventDefault();
    loginContainer.classList.add("hidden");
    registerContainer.classList.remove("hidden");
});

document.getElementById("show-login").addEventListener("click", (e) => {
    e.preventDefault();
    registerContainer.classList.add("hidden");
    loginContainer.classList.remove("hidden");
});

// --- API FETCH (REGISTRO & LOGIN CON SUPABASE) ---
document.getElementById("register-form").addEventListener("submit", async (e) => {
    e.preventDefault();
    const msg = document.getElementById("register-message");
    msg.innerText = "";

    const data = {
        nombre: document.getElementById("reg-nombre").value,
        email: document.getElementById("reg-email").value,
        password: regPasswordInput.value,
        id_rol: parseInt(document.getElementById("reg-rol").value)
    };

    try {
        const response = await fetch(`${API_URL}/registro`, {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify(data)
        });

        const result = await response.json();

        if (response.ok) {
            msg.className = "alert-message success";
            msg.innerText = "¡Usuario registrado en Supabase! Redirigiendo...";
            document.getElementById("register-form").reset();
            setTimeout(() => document.getElementById("show-login").click(), 1500);
        } else {
            msg.className = "alert-message error";
            msg.innerText = result.detail || "Error al registrar.";
        }
    } catch (err) {
        msg.className = "alert-message error";
        msg.innerText = "Error de conexión con el servidor.";
    }
});

document.getElementById("login-form").addEventListener("submit", async (e) => {
    e.preventDefault();
    const msg = document.getElementById("login-message");
    msg.innerText = "";

    const data = {
        email: document.getElementById("login-email").value,
        password: document.getElementById("login-password").value
    };

    try {
        const response = await fetch(`${API_URL}/login`, {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify(data)
        });

        const result = await response.json();

        if (response.ok) {
            localStorage.setItem("token_cloud", result.access_token);
            mostrarDashboard(result.nombre, result.id_rol);
        } else {
            msg.className = "alert-message error";
            msg.innerText = result.detail || "Credenciales incorrectas.";
        }
    } catch (err) {
        msg.className = "alert-message error";
        msg.innerText = "Error de conexión con el servidor.";
    }
});

function mostrarDashboard(nombre, idRol) {
    loginContainer.classList.add("hidden");
    registerContainer.classList.add("hidden");
    dashboardCard.classList.remove("hidden");
    mainCard.classList.add("dashboard-mode");

    document.getElementById("user-name").innerText = nombre;
    document.getElementById("user-role").innerText = idRol === 1 ? "Administrador 🛠️" : "Usuario 👤";

    cargarLecturasSensores();
}

async function cargarLecturasSensores() {
    try {
        const response = await fetch(`${API_URL}/sensores/ultimas`);
        const data = await response.json();

        if (response.ok && data.length > 0) {
            const ultima = data[0];
            document.getElementById("val-temp").innerText = `${ultima.temperatura} °C`;
            document.getElementById("val-hum").innerText = `${ultima.humedad} %`;
            document.getElementById("val-air").innerText = `${ultima.calidad_aire} ICA`;
        }
    } catch (err) {
        console.log("Error al obtener lecturas de sensores", err);
    }
}

document.getElementById("btn-logout").addEventListener("click", () => {
    localStorage.removeItem("token_cloud");
    dashboardCard.classList.add("hidden");
    mainCard.classList.remove("dashboard-mode");
    loginContainer.classList.remove("hidden");
});
// ==========================================
// 🤖 LÓGICA DE CHATBOT BRUNITO AI
// ==========================================
const chatToggleBtn = document.getElementById("chat-toggle-btn");
const chatCloseBtn = document.getElementById("chat-close-btn");
const chatWindow = document.getElementById("chat-window");
const chatMessages = document.getElementById("chat-messages");
const chatInput = document.getElementById("chat-input");
const chatSendBtn = document.getElementById("chat-send-btn");
const chatTyping = document.getElementById("chat-typing");

let chatHistory = [];

// Abrir / Cerrar Chat
chatToggleBtn.addEventListener("click", () => {
    chatWindow.classList.toggle("hidden");
    if (!chatWindow.classList.contains("hidden")) {
        chatInput.focus();
    }
});

chatCloseBtn.addEventListener("click", () => {
    chatWindow.classList.add("hidden");
});

// Enviar Mensaje
chatSendBtn.addEventListener("click", enviarMensajeChat);
chatInput.addEventListener("keypress", (e) => {
    if (e.key === "Enter") enviarMensajeChat();
});

async function enviarMensajeChat() {
    const texto = chatInput.value.trim();
    if (!texto) return;

    // Agregar mensaje del usuario en UI
    agregarMensajeUI("user", texto);
    chatInput.value = "";

    // Mostrar "Pensando..."
    chatTyping.classList.remove("hidden");
    chatMessages.scrollTop = chatMessages.scrollHeight;

    try {
        const response = await fetch(`${API_URL}/api/ia/chat`, {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({
                message: texto,
                history: chatHistory
            })
        });

        const data = await response.json();
        chatTyping.classList.add("hidden");

        if (response.ok) {
            agregarMensajeUI("model", data.respuesta);

            // Guardar en el historial local
            chatHistory.push({ role: "user", content: texto });
            chatHistory.push({ role: "model", content: data.respuesta });
        } else {
            agregarMensajeUI("model", `⚠️ Error: ${data.detail || "No se pudo consultar a Brunito AI."}`);
        }
    } catch (err) {
        chatTyping.classList.add("hidden");
        agregarMensajeUI("model", "⚠️ Error de conexión con el servidor de la API.");
    }
}

function agregarMensajeUI(role, content) {
    const msgDiv = document.createElement("div");
    msgDiv.className = `chat-message ${role}`;

    const innerContent = document.createElement("div");
    innerContent.className = "message-content";
    innerContent.innerText = content;

    msgDiv.appendChild(innerContent);
    chatMessages.appendChild(msgDiv);
    chatMessages.scrollTop = chatMessages.scrollHeight;
}