// Centralized FastAPI client. Supabase access tokens are refreshed before expiry.
const API_URL = "https://smartcity-backend-shdc.onrender.com";

let apiWarmupPromise = null;
let sessionRefreshPromise = null;

function precalentarAPI() {
    if (apiWarmupPromise) return apiWarmupPromise;
    apiWarmupPromise = fetch(`${API_URL}/`, { cache: "no-store" })
        .then(response => response.ok ? response.json() : Promise.reject(new Error(`API respondió ${response.status}`)))
        .catch(error => {
            apiWarmupPromise = null;
            console.info("No se pudo precalentar la API; el acceso continuará normalmente.", error);
            return null;
        });
    return apiWarmupPromise;
}

function obtenerToken() {
    return localStorage.getItem("token_cloud");
}

async function renovarSesionSupabase() {
    if (sessionRefreshPromise) return sessionRefreshPromise;
    const refreshToken = localStorage.getItem("refresh_token_cloud");
    if (!refreshToken) return false;
    sessionRefreshPromise = (async () => {
        try {
            const response = await fetch(`${API_URL}/refresh`, {
                method: "POST",
                headers: { "Content-Type": "application/json" },
                body: JSON.stringify({ refresh_token: refreshToken })
            });
            if (!response.ok) return false;
            guardarSesionSupabase(await response.json());
            return true;
        } catch (error) {
            console.warn("No se pudo renovar la sesión.", error);
            return false;
        } finally {
            sessionRefreshPromise = null;
        }
    })();
    return sessionRefreshPromise;
}

function esRutaPublicaAuth(endpoint) {
    return ["/registro", "/login", "/refresh", "/logout", "/recuperar-password", "/establecer-password"].includes(endpoint);
}

async function enviarApi(endpoint, options, token) {
    const { timeoutMs, ...fetchOptions } = options;
    const headers = { "Content-Type": "application/json", ...(fetchOptions.headers || {}) };
    if (token) headers.Authorization = `Bearer ${token}`;
    const signal = fetchOptions.signal || (timeoutMs ? AbortSignal.timeout(timeoutMs) : undefined);
    return fetch(`${API_URL}${endpoint}`, { ...fetchOptions, headers, signal });
}

async function apiFetch(endpoint, options = {}) {
    const publicAuth = esRutaPublicaAuth(endpoint);
    let token = publicAuth ? null : obtenerToken();
    if (!publicAuth && token) {
        const expiresAt = Number(localStorage.getItem("token_expires_cloud") || 0);
        if (expiresAt && expiresAt - Math.floor(Date.now() / 1000) < 60) {
            await renovarSesionSupabase();
            token = obtenerToken();
        }
    }

    try {
        let response = await enviarApi(endpoint, options, token);
        if (response.status === 401 && !publicAuth && localStorage.getItem("refresh_token_cloud")) {
            const refreshed = await renovarSesionSupabase();
            if (refreshed) response = await enviarApi(endpoint, options, obtenerToken());
        }
        if (response.status === 401 && !publicAuth) {
            console.warn("Sesión expirada. Volviendo al acceso.");
            void cerrarSesion(false);
            throw new Error("Sesión expirada.");
        }
        const data = response.status === 204 ? {} : await response.json();
        return { ok: response.ok, status: response.status, data };
    } catch (error) {
        console.error(`Error en petición [${endpoint}]:`, error);
        throw error;
    }
}
