import { defineConfig } from "vitest/config";
import path from "path";

export default defineConfig({
  // React 17+ JSX runtime, matching Next — lets *.test.tsx render components.
  esbuild: { jsx: "automatic" },
  test: {
    globals: true,
    environment: "node",
    include: ["src/**/*.test.{ts,tsx}"],
    exclude: ["node_modules"],
  },
  resolve: {
    alias: {
      "@": path.resolve(__dirname, "./src"),
    },
  },
});
