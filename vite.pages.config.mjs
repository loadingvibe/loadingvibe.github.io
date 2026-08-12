import { resolve } from "node:path";
import { fileURLToPath } from "node:url";
import react from "@vitejs/plugin-react";
import { defineConfig } from "vite";

const projectRoot = fileURLToPath(new URL(".", import.meta.url));

export default defineConfig({
  root: resolve(projectRoot, "pages"),
  base: "/",
  publicDir: resolve(projectRoot, "public"),
  plugins: [react()],
  build: {
    outDir: resolve(projectRoot, "_site"),
    emptyOutDir: true,
    sourcemap: true,
  },
});
