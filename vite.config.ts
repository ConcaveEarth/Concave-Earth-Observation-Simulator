import { defineConfig } from "vite";
import react from "@vitejs/plugin-react";

const repositoryBase = "/Concave-Earth-Observation-Simulator/";

export default defineConfig({
  base: process.env.NODE_ENV === "production" ? repositoryBase : "/",
  plugins: [react()],
  test: {
    environment: "jsdom",
    globals: true,
    setupFiles: "./src/test/setup.ts",
  },
});
