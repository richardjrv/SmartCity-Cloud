// ============================================================
// 🌐 CONFIGURACIÓN Y CLIENTE HTTP CENTRALIZADO
// ============================================================

const API_URL = "https://smartcity-backend-shdc.onrender.com";

function obtenerToken() {
    return localStorage.getItem("token_cloud");
}

async function apiFetch(endpoint, options = {}) {
    const token = obtenerToken();
    
    // Configurar encabezados por defecto
    const headers = {
        "Content-Type": "application/json",
        ...(options.headers || {})
    };

    if (token) {
        headers["Authorization"] = `Bearer ${token}`;
    }

    const config = {
        ...options,
        headers
    };

    try {
        const response = await fetch(`${API_URL}${endpoint}`, config);

        // Si la sesión expiró o el token es inválido
        if (response.status === 401 && endpoint !== "/login") {
            console.warn("🔒 Sesión expirada. Redirigiendo a inicio...");
            cerrarSesion();
            throw new Error("Sesión expirada");
        }

        const data = await response.json();
        return { ok: response.ok, status: response.status, data };
    } catch (error) {
        console.error(`❌ Error en petición [${endpoint}]:`, error);
        throw error;
    }
}