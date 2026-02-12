import { createRoot } from "react-dom/client";
import App from "./App";
import "./index.css";

const htmlSplash = document.getElementById("html-splash");
if (htmlSplash) {
  htmlSplash.style.opacity = "0";
  setTimeout(() => htmlSplash.remove(), 500);
}

createRoot(document.getElementById("root")!).render(<App />);
