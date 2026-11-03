import { createRoot } from "react-dom/client";
import { ToastViewport } from "./components/ToastViewport.jsx";
import "./styles/app.css";
import "./styles/auth.css";
import "./styles/responsive-audit.css";
import "./styles/mockup-refresh.css";

const rootElement = document.getElementById("react-toast-root");

if (rootElement) {
    createRoot(rootElement).render(<ToastViewport />);
}

