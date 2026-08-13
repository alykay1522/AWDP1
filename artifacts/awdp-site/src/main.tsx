import "./installApiBaseUrl.js";
import "./installCsrfProtection.js";
import { createRoot } from "react-dom/client";
import App from "./App.jsx";
import "./index.css";
import "./site-fixes.css";

createRoot(document.getElementById("root")!).render(<App />);