import { defineConfig } from "vitest/config";
import react from "@vitejs/plugin-react";
import path from "path";

export default defineConfig({
  plugins: [react()],
  test: {
    environment: "jsdom",
    setupFiles: ["./src/__tests__/setup.ts"],
    include: ["src/**/*.test.{ts,tsx}"],
<<<<<<< HEAD
<<<<<<< HEAD
    coverage: {
      provider: "v8",
      reporter: ["text", "html"],
      exclude: [
        "src/components/ui/**",
        "src/__tests__/**",
        "**/*.d.ts",
        "**/*.config.*",
        "next.config.*",
        ".next/**",
        "node_modules/**",
=======
=======
>>>>>>> ed055af (Add test coverage for GenEdRequirements component)

    coverage: {
      provider: "v8",
      reporter: ["text", "html", "lcov"],
      reportsDirectory: "./coverage",

      // ✅ Only measure coverage for the files you worked on
      include: [
        "src/components/requirements/**",
        "src/app/dashboard/requirements/**",
      ],

      exclude: [
        "**/node_modules/**",
        "**/.next/**",
        "**/dist/**",
        "**/coverage/**",
        "**/*.d.ts",
<<<<<<< HEAD
>>>>>>> ed055af (Add test coverage for GenEdRequirements component)
=======
>>>>>>> ed055af (Add test coverage for GenEdRequirements component)
      ],
    },
  },

  resolve: {
    alias: {
      "@": path.resolve(__dirname, "./src"),
    },
  },
});