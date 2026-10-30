import { createRoot } from "react-dom/client";
import { ToastViewport } from "./components/ToastViewport.jsx";

const rootElement = document.getElementById("react-toast-root");

if (rootElement) {
    createRoot(rootElement).render(<ToastViewport />);
}

