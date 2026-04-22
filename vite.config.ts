import { defineConfig } from "vite";
import react from "@vitejs/plugin-react";

export default defineConfig({
  plugins: [react()],
  server: {
    host: true,       // expose on LAN so tablets can connect
    port: 3000,
  },
  build: {
    outDir: "dist",
    sourcemap: false,
  },
});
