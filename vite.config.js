import { defineConfig } from "vite";
import react from "@vitejs/plugin-react";

export default defineConfig({
  plugins: [react()],
  server: { port: 5173 },
  // Leaflet v1.9 references `global` (Node.js); map it to globalThis for browsers
  define: { global: "globalThis" },
});
