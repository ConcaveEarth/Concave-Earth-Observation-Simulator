import { defineConfig } from "vite";
import react from "@vitejs/plugin-react";

const repositoryBase = "/Concave-Earth-Observation-Simulator/";

export default defineConfig({
  base: process.env.NODE_ENV === "production" ? repositoryBase : "/",
  plugins: [react()],
  build: {
    chunkSizeWarningLimit: 700,
    rollupOptions: {
      output: {
        manualChunks(id) {
          if (id.includes("node_modules/echarts")) {
            return "echarts";
          }

          if (id.includes("@radix-ui")) {
            return "radix";
          }

          if (
            id.includes("node_modules/react") ||
            id.includes("node_modules/react-dom")
          ) {
            return "react-vendor";
          }

          return undefined;
        },
      },
    },
  },
  test: {
    environment: "jsdom",
    globals: true,
    setupFiles: "./src/test/setup.ts",
  },
});
