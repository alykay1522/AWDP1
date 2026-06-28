import "./installApiBaseUrl.js";
import { createRoot } from "react-dom/client";
import App from "./AppEnhanced.jsx";
import "./index.css";
import "./site-fixes.css";

createRoot(document.getElementById("root")!).render(<App />);
