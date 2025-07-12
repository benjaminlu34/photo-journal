import { defineConfig } from "vite";
import react from "@vitejs/plugin-react";
import path from "path";

// Only load Replit plugins when in Replit mode
const isReplit = process.env.REPLIT === "true" || Boolean(process.env.REPL_ID);

export default defineConfig({
  plugins: [
    react(),
    ...(isReplit ? [import("@replit/vite-plugin-runtime-error-modal").then((m) => m.default())] : []),
    ...(isReplit ? [import("@replit/vite-plugin-cartographer").then((m) => m.cartographer())] : []),
  ],
  resolve: {
    alias: {
      "@": path.resolve(import.meta.dirname, "client", "src"),
      "@shared": path.resolve(import.meta.dirname, "shared"),
      "@assets": path.resolve(import.meta.dirname, "attached_assets"),
    },
  },
  root: path.resolve(import.meta.dirname, "client"),
  build: {
    outDir: path.resolve(import.meta.dirname, "dist/public"),
    emptyOutDir: true,
  },
  server: {
    fs: {
      strict: true,
      deny: ["**/.*"],
    },
  },
});
