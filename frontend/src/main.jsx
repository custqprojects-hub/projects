import { createRoot } from "react-dom/client";
import App from "./App";
import "./index.css";
import "leaflet/dist/leaflet.css";


// Patch window.fetch to automatically include credentials: "include" for all relative API requests
const originalFetch = window.fetch;
window.fetch = async function (input, init) {
    let isRelative = false;
    let urlString = "";
    if (typeof input === "string") {
        urlString = input;
        isRelative = input.startsWith("/") || input.startsWith(window.location.origin);
    } else if (input && typeof input === "object" && "url" in input) {
        urlString = input.url;
        isRelative = urlString.startsWith("/") || urlString.startsWith(window.location.origin);
    }
    
    if (isRelative) {
        if (!init) {
            init = {};
        }
        if (!init.credentials) {
            init.credentials = "include";
        }
    }
    
    const response = await originalFetch(input, init);
    
    if (response.status === 401 && isRelative && !urlString.includes("/auth/login") && !urlString.includes("/auth/me")) {
        // Redirect to login if session is expired or invalid
        window.location.href = "/login";
    }
    
    return response;
};

document.documentElement.classList.add("dark");
createRoot(document.getElementById("root")).render(<App />);

