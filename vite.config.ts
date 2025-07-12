import { defineConfig } from "vite";
import react from "@vitejs/plugin-react";
import path from "path";

import runtimeError from "@replit/vite-plugin-runtime-error-modal";
import { cartographer } from "@replit/vite-plugin-cartographer"; // note the named export

const isReplit = process.env.REPLIT === "true" || Boolean(process.env.REPL_ID);

export default defineConfig({
  plugins: [
    react(),
    ...(isReplit ? [runtimeError(), cartographer()] : [])
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
    fs: { strict: true, deny: ["**/.*"] },
  },
});
