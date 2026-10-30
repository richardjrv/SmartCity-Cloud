import { useEffect, useRef, useState } from "react";

const TOAST_STYLES = {
    exito: {
        className: "bg-emerald-900/90 border-emerald-500/50",
        icon: "✅",
    },
    error: {
        className: "bg-rose-900/90 border-rose-500/50",
        icon: "⚠️",
    },
    info: {
        className: "bg-blue-900/90 border-blue-500/50",
        icon: "ℹ️",
    },
};

export function ToastViewport() {
    const [notifications, setNotifications] = useState([]);
    const timers = useRef(new Map());

    useEffect(() => {
        function notify(message, type = "info") {
            const id = globalThis.crypto?.randomUUID?.() ?? `${Date.now()}-${Math.random()}`;
            const style = TOAST_STYLES[type] ?? TOAST_STYLES.info;

            setNotifications((current) => [
                ...current,
                { id, message: String(message ?? ""), type, style, visible: false },
            ].slice(-5));

            const entranceFrame = window.requestAnimationFrame(() => {
                setNotifications((current) => current.map((item) => (
                    item.id === id ? { ...item, visible: true } : item
                )));
            });

            const exitTimer = window.setTimeout(() => {
                setNotifications((current) => current.map((item) => (
                    item.id === id ? { ...item, visible: false } : item
                )));

                const removalTimer = window.setTimeout(() => {
                    setNotifications((current) => current.filter((item) => item.id !== id));
                    timers.current.delete(id);
                }, 320);
                timers.current.set(id, { entranceFrame, exitTimer, removalTimer });
            }, 3500);

            timers.current.set(id, { entranceFrame, exitTimer });
        }

        const previousHandler = window.smartCityToast;
        window.smartCityToast = notify;

        return () => {
            if (window.smartCityToast === notify) {
                window.smartCityToast = previousHandler;
            }
            timers.current.forEach(({ entranceFrame, exitTimer, removalTimer }) => {
                if (entranceFrame !== undefined) window.cancelAnimationFrame(entranceFrame);
                if (exitTimer !== undefined) window.clearTimeout(exitTimer);
                if (removalTimer !== undefined) window.clearTimeout(removalTimer);
            });
            timers.current.clear();
        };
    }, []);

    return (
        <div className="flex flex-col gap-3 pointer-events-none">
            {notifications.map((notification) => (
                <div
                    key={notification.id}
                    className={`pointer-events-auto flex items-center gap-3 rounded-2xl border px-4 py-3 text-xs font-semibold text-white shadow-2xl backdrop-blur-xl transition-all duration-300 motion-reduce:transition-none ${notification.style.className} ${notification.visible ? "translate-x-0 opacity-100" : "translate-x-10 opacity-0"}`}
                    role={notification.type === "error" ? "alert" : "status"}
                    aria-live={notification.type === "error" ? "assertive" : "polite"}
                    aria-atomic="true"
                >
                    <span aria-hidden="true">{notification.style.icon}</span>
                    <span>{notification.message}</span>
                </div>
            ))}
        </div>
    );
}

