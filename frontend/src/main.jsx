import { createRoot } from "react-dom/client";
import { ToastViewport } from "./components/ToastViewport.jsx";
import "./styles/app.css";

const rootElement = document.getElementById("react-toast-root");

if (rootElement) {
    createRoot(rootElement).render(<ToastViewport />);
}

