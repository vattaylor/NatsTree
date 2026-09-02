import { defineConfig } from "vite";
import react from "@vitejs/plugin-react";

const githubPages = process.env.GITHUB_PAGES === "true";

export default defineConfig({
  base: githubPages ? "/NatsTree/" : "/",
  plugins: [react()],
  server: {
    port: 5173,
    proxy: {
      "/ws": {
        target: "http://127.0.0.1:3847",
        ws: true,
        changeOrigin: true,
      },
    },
  },
});
